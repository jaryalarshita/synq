import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DataGrid from './DataGrid'
import { useSynqStore } from '../../store/useSynqStore'
import type { Entity } from '../../store/useSynqStore'

const ENTITY_ID = 'entity-users'

const usersEntity: Entity = {
  id: ENTITY_ID,
  name: 'Users',
  fields: [
    { id: 'f1', name: 'name', type: 'string' },
    { id: 'f2', name: 'age', type: 'number' },
    { id: 'f3', name: 'active', type: 'boolean' }
  ]
}

function rowsOf(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `u${i}`,
    name: `Person ${i}`,
    age: i,
    active: i % 2 === 0
  }))
}

function seed(rows: any[]) {
  useSynqStore.setState({ entities: [usersEntity], generatedData: { [ENTITY_ID]: rows } })
}

beforeEach(() => {
  useSynqStore.setState({ entities: [], generatedData: {} })
})

describe('DataGrid rendering', () => {
  it('derives its columns from the entity schema, with id first', () => {
    seed(rowsOf(1))
    render(<DataGrid entityId={ENTITY_ID} />)

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(headers).toEqual(['id', 'name', 'age', 'active'])
  })

  it('renders NULL and boolean cells distinctly', () => {
    seed([{ id: 'u1', name: null, age: 5, active: true }])
    render(<DataGrid entityId={ENTITY_ID} />)

    expect(screen.getByText('NULL')).toBeInTheDocument()
    expect(screen.getByText('true')).toBeInTheDocument()
  })

  it('renders nothing when the entity no longer exists', () => {
    const { container } = render(<DataGrid entityId="missing-entity" />)

    expect(container).toBeEmptyDOMElement()
  })
})

describe('DataGrid search', () => {
  it('filters rows to those matching the query in any column', async () => {
    const user = userEvent.setup()
    seed([
      { id: 'u1', name: 'Ada', age: 36, active: true },
      { id: 'u2', name: 'Grace', age: 45, active: false }
    ])
    render(<DataGrid entityId={ENTITY_ID} />)

    await user.type(screen.getByPlaceholderText('Search records...'), 'grace')

    expect(screen.queryByText('Ada')).not.toBeInTheDocument()
    expect(screen.getByText('Grace')).toBeInTheDocument()
    expect(screen.getByText(/Showing 1–1 of 1 records/)).toBeInTheDocument()
  })

  it('shows an empty message when nothing matches', async () => {
    const user = userEvent.setup()
    seed(rowsOf(3))
    render(<DataGrid entityId={ENTITY_ID} />)

    await user.type(screen.getByPlaceholderText('Search records...'), 'zzzz')

    expect(screen.getByText('No records match your filters.')).toBeInTheDocument()
  })

  it('returns to page 1 when a search narrows the result set', async () => {
    const user = userEvent.setup()
    seed(rowsOf(60)) // 3 pages at 25/page
    render(<DataGrid entityId={ENTITY_ID} />)

    await user.click(screen.getByText('Next'))
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search records...'), 'Person 1')

    expect(screen.getByText(/Showing 1–/)).toBeInTheDocument()
  })
})

describe('DataGrid sorting', () => {
  it('sorts ascending on first header click and descending on the second', async () => {
    const user = userEvent.setup()
    seed([
      { id: 'u1', name: 'Charlie', age: 30, active: true },
      { id: 'u2', name: 'Alice', age: 20, active: false },
      { id: 'u3', name: 'Bob', age: 25, active: true }
    ])
    render(<DataGrid entityId={ENTITY_ID} />)

    const nameHeader = screen.getByRole('columnheader', { name: /name/ })

    await user.click(nameHeader)
    let firstRow = screen.getAllByRole('row')[1]
    expect(within(firstRow).getByText('Alice')).toBeInTheDocument()

    await user.click(nameHeader)
    firstRow = screen.getAllByRole('row')[1]
    expect(within(firstRow).getByText('Charlie')).toBeInTheDocument()
  })

  it('sorts numeric columns by value rather than lexicographically', async () => {
    const user = userEvent.setup()
    seed([
      { id: 'u1', name: 'A', age: 100, active: true },
      { id: 'u2', name: 'B', age: 9, active: true },
      { id: 'u3', name: 'C', age: 20, active: true }
    ])
    render(<DataGrid entityId={ENTITY_ID} />)

    await user.click(screen.getByRole('columnheader', { name: /age/ }))

    const ages = screen.getAllByRole('row').slice(1).map((r) => r.children[2].textContent)
    expect(ages).toEqual(['9', '20', '100'])
  })
})

describe('DataGrid pagination', () => {
  it('caps a page at 25 rows and reports the visible range', () => {
    seed(rowsOf(60))
    render(<DataGrid entityId={ENTITY_ID} />)

    expect(screen.getAllByRole('row')).toHaveLength(26) // header + 25 rows
    expect(screen.getByText(/Showing 1–25 of 60 records/)).toBeInTheDocument()
  })

  it('steps between pages and disables the edges', async () => {
    const user = userEvent.setup()
    seed(rowsOf(60))
    render(<DataGrid entityId={ENTITY_ID} />)

    expect(screen.getByText('Previous')).toBeDisabled()

    await user.click(screen.getByText('Next'))
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    expect(screen.getByText(/Showing 26–50 of 60 records/)).toBeInTheDocument()

    await user.click(screen.getByText('Next'))
    expect(screen.getByText('Next')).toBeDisabled()
  })

  it('hides pagination controls when everything fits on one page', () => {
    seed(rowsOf(5))
    render(<DataGrid entityId={ENTITY_ID} />)

    expect(screen.queryByText('Next')).not.toBeInTheDocument()
  })
})
