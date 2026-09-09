import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { exportToJSON, exportToCSV, exportToSQL } from './exporters'
import type { Entity, SchemaField } from '../store/useSynqStore'

function field(overrides: Partial<SchemaField> & Pick<SchemaField, 'name' | 'type'>): SchemaField {
  return { id: crypto.randomUUID(), ...overrides }
}

function entity(name: string, fields: SchemaField[] = []): Entity {
  return { id: crypto.randomUUID(), name, fields }
}

// Exporters trigger a real browser download; capture the Blob and filename
// that would have been handed to the user instead of writing anything.
let downloads: { name: string; blob: Blob }[] = []

beforeEach(() => {
  downloads = []
  let pendingBlob: Blob | null = null

  URL.createObjectURL = vi.fn((blob: Blob) => {
    pendingBlob = blob
    return 'blob:mock-url'
  }) as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL

  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    downloads.push({ name: this.getAttribute('download') || '', blob: pendingBlob! })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function lastDownloadText(): Promise<string> {
  return await downloads[downloads.length - 1].blob.text()
}

describe('exportToJSON', () => {
  it('downloads pretty-printed JSON under the requested filename', async () => {
    exportToJSON([{ id: 'u1', email: 'a@b.com' }], 'users.json')

    expect(downloads).toHaveLength(1)
    expect(downloads[0].name).toBe('users.json')
    const text = await lastDownloadText()
    expect(JSON.parse(text)).toEqual([{ id: 'u1', email: 'a@b.com' }])
    expect(text).toContain('\n  ') // indented, not minified
  })
})

describe('exportToCSV', () => {
  it('writes a header row followed by one line per record', async () => {
    exportToCSV(['id', 'name'], [{ id: 'u1', name: 'Ada' }, { id: 'u2', name: 'Grace' }], 'users.csv')

    const text = await lastDownloadText()
    expect(text.split('\n')).toEqual(['id,name', 'u1,Ada', 'u2,Grace'])
  })

  it('quotes values containing commas, quotes, or newlines', async () => {
    exportToCSV(
      ['note'],
      [{ note: 'Hello, world' }, { note: 'She said "hi"' }, { note: 'line1\nline2' }],
      'notes.csv'
    )

    const text = await lastDownloadText()
    expect(text).toContain('"Hello, world"')
    expect(text).toContain('"She said ""hi"""') // inner quotes doubled
    expect(text).toContain('"line1\nline2"')
  })

  it('renders null and undefined cells as empty strings', async () => {
    exportToCSV(['a', 'b'], [{ a: null, b: undefined }], 'x.csv')

    const text = await lastDownloadText()
    expect(text.split('\n')[1]).toBe(',')
  })
})

describe('exportToSQL', () => {
  it('emits INSERT statements with parent tables ordered before children', async () => {
    const users = entity('Users', [field({ name: 'email', type: 'email' })])
    const orders = entity('Orders', [
      field({ name: 'userId', type: 'foreign_key', referenceEntityId: users.id })
    ])
    const data = {
      [users.id]: [{ id: 'u1', email: 'a@b.com' }],
      [orders.id]: [{ id: 'o1', userId: 'u1' }]
    }

    // Deliberately pass the child first — topological order should still win.
    exportToSQL([orders, users], data, 'dump.sql')

    const text = await lastDownloadText()
    expect(text.indexOf('INSERT INTO users')).toBeLessThan(text.indexOf('INSERT INTO orders'))
    expect(text).toContain("('u1', 'a@b.com')")
  })

  it('formats numbers raw, booleans as TRUE/FALSE, and nulls as NULL', async () => {
    const products = entity('Products', [
      field({ name: 'price', type: 'currency' }),
      field({ name: 'inStock', type: 'boolean' }),
      field({ name: 'label', type: 'string' })
    ])

    exportToSQL([products], { [products.id]: [{ id: 'p1', price: 9.99, inStock: true, label: null }] }, 'p.sql')

    const text = await lastDownloadText()
    expect(text).toContain("('p1', 9.99, TRUE, NULL)")
  })

  it("escapes single quotes in string values so the SQL stays valid", async () => {
    const users = entity('Users', [field({ name: 'name', type: 'string' })])

    exportToSQL([users], { [users.id]: [{ id: 'u1', name: "O'Brien" }] }, 'u.sql')

    const text = await lastDownloadText()
    expect(text).toContain("'O''Brien'")
  })

  it('skips entities that have no generated rows', async () => {
    const users = entity('Users')
    const empty = entity('Empty')

    exportToSQL([users, empty], { [users.id]: [{ id: 'u1' }] }, 'u.sql')

    const text = await lastDownloadText()
    expect(text).toContain('INSERT INTO users')
    expect(text).not.toContain('INSERT INTO empty')
  })

  it('chunks large datasets into separate INSERT statements every 500 rows', async () => {
    const users = entity('Users')
    const rows = Array.from({ length: 1001 }, (_, i) => ({ id: `u${i}` }))

    exportToSQL([users], { [users.id]: rows }, 'u.sql')

    const text = await lastDownloadText()
    expect(text.match(/INSERT INTO users/g)).toHaveLength(3) // 500 + 500 + 1
  })
})
