import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SchemaCanvas from './SchemaCanvas'
import { useSynqStore } from '../../store/useSynqStore'

beforeEach(() => {
  useSynqStore.setState({ entities: [], generatedData: {} })
})

describe('SchemaCanvas', () => {
  it('shows the empty state with no entities defined', () => {
    render(<SchemaCanvas />)

    expect(screen.getByText('No Entities Defined')).toBeInTheDocument()
  })

  it('creates a uniquely-named entity per click, avoiding name collisions', async () => {
    const user = userEvent.setup()
    render(<SchemaCanvas />)

    await user.click(screen.getByText('Create Entity'))
    await user.click(await screen.findByText('Add Entity'))

    const names = useSynqStore.getState().entities.map((e) => e.name)
    expect(names).toEqual(['Entity_1', 'Entity_2'])
  })
})
