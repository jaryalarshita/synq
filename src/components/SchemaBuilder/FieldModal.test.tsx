import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FieldModal from './FieldModal'
import { useSynqStore } from '../../store/useSynqStore'
import type { Entity } from '../../store/useSynqStore'

const entityWithEmailField: Entity = {
  id: 'a',
  name: 'Users',
  fields: [{ id: 'f-email', name: 'email', type: 'email' }]
}

beforeEach(() => {
  useSynqStore.setState({ entities: [entityWithEmailField], generatedData: {} })
})

function currentFields() {
  return useSynqStore.getState().entities.find((e) => e.id === 'a')?.fields ?? []
}

describe('FieldModal — validation', () => {
  it('requires a field name', async () => {
    const user = userEvent.setup()
    render(<FieldModal isOpen onClose={vi.fn()} entityId="a" />)

    await user.click(screen.getByRole('button', { name: 'Add Field' }))

    expect(screen.getByText('Field name is required')).toBeInTheDocument()
    expect(currentFields()).toHaveLength(1) // unchanged
  })

  it('rejects a field name that duplicates an existing field on the same entity', async () => {
    const user = userEvent.setup()
    render(<FieldModal isOpen onClose={vi.fn()} entityId="a" />)

    await user.type(screen.getByLabelText('Field Name'), 'email')
    await user.click(screen.getByRole('button', { name: 'Add Field' }))

    expect(screen.getByText('A field with this name already exists in this entity')).toBeInTheDocument()
    expect(currentFields()).toHaveLength(1)
  })

  it('requires at least one option when the field type is Enum', async () => {
    const user = userEvent.setup()
    render(<FieldModal isOpen onClose={vi.fn()} entityId="a" />)

    await user.type(screen.getByLabelText('Field Name'), 'role')
    await user.selectOptions(screen.getByLabelText('Field Type'), 'enum')
    await user.click(screen.getByRole('button', { name: 'Add Field' }))

    expect(screen.getByText('At least one option is required')).toBeInTheDocument()
    expect(currentFields()).toHaveLength(1)
  })

  it('adds a valid field to the store and closes the modal', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<FieldModal isOpen onClose={onClose} entityId="a" />)

    await user.type(screen.getByLabelText('Field Name'), 'username')
    await user.click(screen.getByRole('button', { name: 'Add Field' }))

    const fields = currentFields()
    expect(fields).toHaveLength(2)
    expect(fields[1]).toMatchObject({ name: 'username', type: 'string' })
    expect(onClose).toHaveBeenCalled()
  })
})

describe('FieldModal — distribution rules', () => {
  async function fillName(user: ReturnType<typeof userEvent.setup>, value: string) {
    await user.type(screen.getByLabelText('Field Name'), value)
  }

  async function chooseType(user: ReturnType<typeof userEvent.setup>, value: string) {
    await user.selectOptions(screen.getByLabelText('Field Type'), value)
  }

  it('hides distribution controls for non-numeric types', async () => {
    render(<FieldModal isOpen onClose={vi.fn()} entityId="a" />)

    expect(screen.queryByLabelText('Value Distribution')).not.toBeInTheDocument()
  })

  it('offers distribution controls once a numeric type is chosen', async () => {
    const user = userEvent.setup()
    render(<FieldModal isOpen onClose={vi.fn()} entityId="a" />)

    await chooseType(user, 'number')

    expect(screen.getByLabelText('Value Distribution')).toBeInTheDocument()
  })

  it('saves a uniform distribution onto the field', async () => {
    const user = userEvent.setup()
    render(<FieldModal isOpen onClose={vi.fn()} entityId="a" />)

    await fillName(user, 'score')
    await chooseType(user, 'number')
    await user.selectOptions(screen.getByLabelText('Value Distribution'), 'uniform')
    await user.type(screen.getByLabelText('Min'), '10')
    await user.type(screen.getByLabelText('Max'), '90')
    await user.click(screen.getByRole('button', { name: 'Add Field' }))

    const added = currentFields().find((f) => f.name === 'score')
    expect(added?.distribution).toEqual({ kind: 'uniform', min: 10, max: 90 })
  })

  it('rejects a uniform range whose min exceeds its max', async () => {
    const user = userEvent.setup()
    render(<FieldModal isOpen onClose={vi.fn()} entityId="a" />)

    await fillName(user, 'score')
    await chooseType(user, 'number')
    await user.selectOptions(screen.getByLabelText('Value Distribution'), 'uniform')
    await user.type(screen.getByLabelText('Min'), '90')
    await user.type(screen.getByLabelText('Max'), '10')
    await user.click(screen.getByRole('button', { name: 'Add Field' }))

    expect(screen.getByText('Min must be less than or equal to max')).toBeInTheDocument()
    expect(currentFields()).toHaveLength(1)
  })

  it('requires a positive standard deviation for a normal distribution', async () => {
    const user = userEvent.setup()
    render(<FieldModal isOpen onClose={vi.fn()} entityId="a" />)

    await fillName(user, 'score')
    await chooseType(user, 'number')
    await user.selectOptions(screen.getByLabelText('Value Distribution'), 'normal')
    await user.type(screen.getByLabelText('Mean'), '50')
    await user.type(screen.getByLabelText('Std Dev'), '0')
    await user.click(screen.getByRole('button', { name: 'Add Field' }))

    expect(
      screen.getByText('Standard deviation must be a number greater than 0')
    ).toBeInTheDocument()
  })

  it('saves a normal distribution with optional clamps', async () => {
    const user = userEvent.setup()
    render(<FieldModal isOpen onClose={vi.fn()} entityId="a" />)

    await fillName(user, 'score')
    await chooseType(user, 'number')
    await user.selectOptions(screen.getByLabelText('Value Distribution'), 'normal')
    await user.type(screen.getByLabelText('Mean'), '50')
    await user.type(screen.getByLabelText('Std Dev'), '10')
    await user.type(screen.getByLabelText('Clamp Min (optional)'), '0')
    await user.click(screen.getByRole('button', { name: 'Add Field' }))

    const added = currentFields().find((f) => f.name === 'score')
    expect(added?.distribution).toMatchObject({ kind: 'normal', mean: 50, stdDev: 10, min: 0 })
  })
})

describe('FieldModal — enum weights', () => {
  it('saves weights alongside the options', async () => {
    const user = userEvent.setup()
    render(<FieldModal isOpen onClose={vi.fn()} entityId="a" />)

    await user.type(screen.getByLabelText('Field Name'), 'role')
    await user.selectOptions(screen.getByLabelText('Field Type'), 'enum')
    await user.type(screen.getByLabelText('Enum Options (comma-separated)'), 'admin, user')
    await user.type(screen.getByLabelText('Weights (optional)'), '80, 20')
    await user.click(screen.getByRole('button', { name: 'Add Field' }))

    const added = currentFields().find((f) => f.name === 'role')
    expect(added?.weights).toEqual([80, 20])
  })

  it('rejects a weight count that does not match the options', async () => {
    const user = userEvent.setup()
    render(<FieldModal isOpen onClose={vi.fn()} entityId="a" />)

    await user.type(screen.getByLabelText('Field Name'), 'role')
    await user.selectOptions(screen.getByLabelText('Field Type'), 'enum')
    await user.type(screen.getByLabelText('Enum Options (comma-separated)'), 'admin, user, guest')
    await user.type(screen.getByLabelText('Weights (optional)'), '80, 20')
    await user.click(screen.getByRole('button', { name: 'Add Field' }))

    expect(screen.getByText(/Expected 3 weights/)).toBeInTheDocument()
  })

  it('rejects non-numeric weights', async () => {
    const user = userEvent.setup()
    render(<FieldModal isOpen onClose={vi.fn()} entityId="a" />)

    await user.type(screen.getByLabelText('Field Name'), 'role')
    await user.selectOptions(screen.getByLabelText('Field Type'), 'enum')
    await user.type(screen.getByLabelText('Enum Options (comma-separated)'), 'admin, user')
    await user.type(screen.getByLabelText('Weights (optional)'), 'lots, few')
    await user.click(screen.getByRole('button', { name: 'Add Field' }))

    expect(screen.getByText('Weights must be comma-separated numbers')).toBeInTheDocument()
  })

  it('allows omitting weights entirely', async () => {
    const user = userEvent.setup()
    render(<FieldModal isOpen onClose={vi.fn()} entityId="a" />)

    await user.type(screen.getByLabelText('Field Name'), 'role')
    await user.selectOptions(screen.getByLabelText('Field Type'), 'enum')
    await user.type(screen.getByLabelText('Enum Options (comma-separated)'), 'admin, user')
    await user.click(screen.getByRole('button', { name: 'Add Field' }))

    const added = currentFields().find((f) => f.name === 'role')
    expect(added?.weights).toBeUndefined()
  })
})

describe('FieldModal — regex pattern', () => {
  it('saves a valid pattern on a string field', async () => {
    const user = userEvent.setup()
    render(<FieldModal isOpen onClose={vi.fn()} entityId="a" />)

    await user.type(screen.getByLabelText('Field Name'), 'sku')
    // '[' and '{' are user-event keyboard syntax, so set the value directly
    fireEvent.change(screen.getByLabelText('Regex Pattern (optional)'), {
      target: { value: '[A-Z]{3}' }
    })
    await user.click(screen.getByRole('button', { name: 'Add Field' }))

    expect(currentFields().find((f) => f.name === 'sku')?.pattern).toBe('[A-Z]{3}')
  })

  it('rejects a malformed pattern before it reaches the generator', async () => {
    const user = userEvent.setup()
    render(<FieldModal isOpen onClose={vi.fn()} entityId="a" />)

    await user.type(screen.getByLabelText('Field Name'), 'sku')
    fireEvent.change(screen.getByLabelText('Regex Pattern (optional)'), {
      target: { value: '[unclosed' }
    })
    await user.click(screen.getByRole('button', { name: 'Add Field' }))

    expect(screen.getByText('Not a valid regular expression')).toBeInTheDocument()
    expect(currentFields()).toHaveLength(1)
  })

  it('clears a previously saved rule when it is removed on edit', async () => {
    useSynqStore.setState({
      entities: [
        {
          id: 'a',
          name: 'Users',
          fields: [{ id: 'f-sku', name: 'sku', type: 'string', pattern: '[A-Z]{3}' }]
        }
      ],
      generatedData: {}
    })
    const user = userEvent.setup()
    render(<FieldModal isOpen onClose={vi.fn()} entityId="a" fieldIdToEdit="f-sku" />)

    await user.clear(screen.getByLabelText('Regex Pattern (optional)'))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(currentFields().find((f) => f.name === 'sku')?.pattern).toBeUndefined()
  })
})
