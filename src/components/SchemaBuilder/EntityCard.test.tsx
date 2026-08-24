import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EntityCard from './EntityCard'
import { useSynqStore } from '../../store/useSynqStore'
import type { Entity } from '../../store/useSynqStore'

function seedEntities(entities: Entity[]) {
  useSynqStore.setState({ entities, generatedData: {} })
}

const userA: Entity = { id: 'a', name: 'Users', fields: [] }
const userB: Entity = { id: 'b', name: 'Orders', fields: [] }

beforeEach(() => {
  seedEntities([userA, userB])
})

function getEntity(id: string) {
  return useSynqStore.getState().entities.find((e) => e.id === id)
}

describe('EntityCard — rename validation', () => {
  it('rejects a name that does not start with a letter/underscore and keeps the store unchanged', async () => {
    const user = userEvent.setup()
    render(<EntityCard entity={userA} onAddFieldClick={vi.fn()} onEditFieldClick={vi.fn()} />)

    await user.dblClick(screen.getByText('Users'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '1bad{Enter}')

    expect(screen.getByText('Invalid name format')).toBeInTheDocument()
    expect(getEntity('a')?.name).toBe('Users')
  })

  it('rejects a rename that collides with another entity name, case-insensitively', async () => {
    const user = userEvent.setup()
    render(<EntityCard entity={userA} onAddFieldClick={vi.fn()} onEditFieldClick={vi.fn()} />)

    await user.dblClick(screen.getByText('Users'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'orders{Enter}')

    expect(screen.getByText('Name must be unique')).toBeInTheDocument()
    expect(getEntity('a')?.name).toBe('Users')
  })

  it('accepts a valid, unique rename and persists it to the store', async () => {
    // Note: `entity` is a static prop in this isolated render (the real app
    // re-supplies it from the store via SchemaCanvas), so we assert on the
    // store write and that edit mode exits, not on the prop-driven DOM text.
    const user = userEvent.setup()
    render(<EntityCard entity={userA} onAddFieldClick={vi.fn()} onEditFieldClick={vi.fn()} />)

    await user.dblClick(screen.getByText('Users'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Customers{Enter}')

    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument())
    expect(getEntity('a')?.name).toBe('Customers')
  })
})

describe('EntityCard — delete', () => {
  it('removes the entity from the store when the delete button is clicked', async () => {
    const user = userEvent.setup()
    render(<EntityCard entity={userA} onAddFieldClick={vi.fn()} onEditFieldClick={vi.fn()} />)

    await user.click(screen.getByTitle('Delete Entity'))

    expect(getEntity('a')).toBeUndefined()
  })
})
