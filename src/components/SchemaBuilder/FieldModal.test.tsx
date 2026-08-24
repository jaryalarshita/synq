import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
