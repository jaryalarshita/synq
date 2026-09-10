import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExportModal from './ExportModal'
import { useSynqStore } from '../../store/useSynqStore'
import { exportToJSON, exportToCSV, exportToSQL, exportToFile } from '../../engine/exporters'
import type { Entity } from '../../store/useSynqStore'

vi.mock('../../engine/exporters', () => ({
  exportToJSON: vi.fn(),
  exportToCSV: vi.fn(),
  exportToSQL: vi.fn(),
  exportToFile: vi.fn()
}))

const users: Entity = {
  id: 'e-users',
  name: 'Users',
  fields: [{ id: 'f1', name: 'email', type: 'email' }]
}
const orders: Entity = {
  id: 'e-orders',
  name: 'Orders',
  fields: [{ id: 'f2', name: 'total', type: 'currency' }]
}

const userRows = [{ id: 'u1', email: 'a@b.com' }]
const orderRows = [{ id: 'o1', total: 10 }]

beforeEach(() => {
  vi.clearAllMocks()
  useSynqStore.setState({
    entities: [users, orders],
    generatedData: { [users.id]: userRows, [orders.id]: orderRows }
  })
})

function renderModal(onClose = vi.fn()) {
  render(<ExportModal isOpen onClose={onClose} activeEntityId={users.id} />)
  return onClose
}

describe('ExportModal visibility', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <ExportModal isOpen={false} onClose={vi.fn()} activeEntityId={users.id} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the active entity is unknown', () => {
    const { container } = render(
      <ExportModal isOpen onClose={vi.fn()} activeEntityId="nope" />
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ExportModal exporting', () => {
  it('exports only the active table as JSON by default', async () => {
    const user = userEvent.setup()
    const onClose = renderModal()

    await user.click(screen.getByText('Download Files'))

    expect(exportToJSON).toHaveBeenCalledWith(userRows, 'users_data.json')
    expect(onClose).toHaveBeenCalled()
  })

  it('keys the all-tables JSON export by entity name', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByText(/All schema tables/))
    await user.click(screen.getByText('Download Files'))

    expect(exportToJSON).toHaveBeenCalledWith(
      { Users: userRows, Orders: orderRows },
      'synq_dataset.json'
    )
  })

  it('exports CSV for the active table with an id column ahead of its fields', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByText('CSV'))
    await user.click(screen.getByText('Download Files'))

    expect(exportToCSV).toHaveBeenCalledWith(['id', 'email'], userRows, 'users_data.csv')
  })

  it('triggers one CSV download per table when exporting everything', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByText('CSV'))
    await user.click(screen.getByText(/All schema tables/))
    await user.click(screen.getByText('Download Files'))

    expect(exportToCSV).toHaveBeenCalledTimes(2)
    expect(exportToCSV).toHaveBeenNthCalledWith(1, ['id', 'email'], userRows, 'users_data.csv')
    expect(exportToCSV).toHaveBeenNthCalledWith(2, ['id', 'total'], orderRows, 'orders_data.csv')
  })

  it('passes every entity to the SQL exporter so relations stay ordered', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByText('SQL'))
    await user.click(screen.getByText(/All schema tables/))
    await user.click(screen.getByText('Download Files'))

    expect(exportToSQL).toHaveBeenCalledWith(
      [users, orders],
      { [users.id]: userRows, [orders.id]: orderRows },
      'synq_dataset.sql'
    )
  })

  it('closes without exporting anything when cancelled', async () => {
    const user = userEvent.setup()
    const onClose = renderModal()

    await user.click(screen.getByText('Cancel'))

    expect(onClose).toHaveBeenCalled()
    expect(exportToJSON).not.toHaveBeenCalled()
    expect(exportToCSV).not.toHaveBeenCalled()
    expect(exportToSQL).not.toHaveBeenCalled()
  })
})

describe('ExportModal — TypeScript interfaces', () => {
  it('exports only the active entity as a .ts file', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByText('TypeScript'))
    await user.click(screen.getByText('Download Files'))

    expect(exportToFile).toHaveBeenCalledTimes(1)
    const [content, fileName] = (exportToFile as any).mock.calls[0]
    expect(fileName).toBe('users.ts')
    expect(content).toContain('export interface Users {')
    expect(content).not.toContain('export interface Orders {')
  })

  it('exports every entity into one module for the all-tables scope', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByText('TypeScript'))
    await user.click(screen.getByText(/All schema tables/))
    await user.click(screen.getByText('Download Files'))

    const [content, fileName] = (exportToFile as any).mock.calls[0]
    expect(fileName).toBe('synq_dataset.ts')
    expect(content).toContain('export interface Users {')
    expect(content).toContain('export interface Orders {')
  })

  it('does not trigger the row-data exporters', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByText('TypeScript'))
    await user.click(screen.getByText('Download Files'))

    expect(exportToJSON).not.toHaveBeenCalled()
    expect(exportToCSV).not.toHaveBeenCalled()
    expect(exportToSQL).not.toHaveBeenCalled()
  })
})
