import { describe, it, expect } from 'vitest'
import { getGenerationOrder, generateSyntheticData } from './dataGenerator'
import type { Entity, SchemaField } from '../store/useSynqStore'

function field(overrides: Partial<SchemaField> & Pick<SchemaField, 'name' | 'type'>): SchemaField {
  return { id: crypto.randomUUID(), ...overrides }
}

function entity(name: string, fields: SchemaField[] = []): Entity {
  return { id: crypto.randomUUID(), name, fields }
}

describe('getGenerationOrder', () => {
  it('orders a parent entity before a child that references it via foreign key', () => {
    const users = entity('Users')
    const orders = entity('Orders', [
      field({ name: 'userId', type: 'foreign_key', referenceEntityId: users.id })
    ])

    const order = getGenerationOrder([orders, users]) // deliberately given child-first

    expect(order.map((e) => e.id)).toEqual([users.id, orders.id])
  })

  it('includes every entity exactly once when there are no relations', () => {
    const a = entity('A')
    const b = entity('B')
    const c = entity('C')

    const order = getGenerationOrder([a, b, c])

    expect(order.map((e) => e.id).sort()).toEqual([a.id, b.id, c.id].sort())
  })

  it('throws a descriptive error on a circular foreign key reference', () => {
    const a = entity('A')
    const b = entity('B')
    a.fields.push(field({ name: 'bId', type: 'foreign_key', referenceEntityId: b.id }))
    b.fields.push(field({ name: 'aId', type: 'foreign_key', referenceEntityId: a.id }))

    expect(() => getGenerationOrder([a, b])).toThrow(/Circular reference detected/)
  })

  it('throws on a self-referencing foreign key', () => {
    const a = entity('A')
    a.fields.push(field({ name: 'parentId', type: 'foreign_key', referenceEntityId: a.id }))

    expect(() => getGenerationOrder([a])).toThrow(/Circular reference detected/)
  })
})

describe('generateSyntheticData', () => {
  it('returns an empty object when there are no entities', () => {
    expect(generateSyntheticData([], 10)).toEqual({})
  })

  it('generates the requested number of records per entity, each with a uuid id', () => {
    const users = entity('Users', [field({ name: 'email', type: 'email' })])

    const data = generateSyntheticData([users], 25)

    expect(data[users.id]).toHaveLength(25)
    for (const row of data[users.id]) {
      expect(row.id).toMatch(/^[0-9a-f-]{36}$/i)
      expect(row.email).toEqual(expect.any(String))
    }
  })

  it('resolves foreign keys to an id that actually exists in the parent table', () => {
    const users = entity('Users')
    const orders = entity('Orders', [
      field({ name: 'userId', type: 'foreign_key', referenceEntityId: users.id })
    ])

    const data = generateSyntheticData([users, orders], 10)

    const userIds = new Set(data[users.id].map((u) => u.id))
    for (const order of data[orders.id]) {
      expect(userIds.has(order.userId)).toBe(true)
    }
  })

  it('only produces enum values from the configured options', () => {
    const options = ['admin', 'manager', 'user']
    const users = entity('Users', [field({ name: 'role', type: 'enum', options })])

    const data = generateSyntheticData([users], 30)

    for (const row of data[users.id]) {
      expect(options).toContain(row.role)
    }
  })

  it('produces boolean values for boolean fields', () => {
    const users = entity('Users', [field({ name: 'isActive', type: 'boolean' })])

    const data = generateSyntheticData([users], 10)

    for (const row of data[users.id]) {
      expect(typeof row.isActive).toBe('boolean')
    }
  })

  it('produces ages within the 18-80 range for a number field named "age"', () => {
    const users = entity('Users', [field({ name: 'age', type: 'number' })])

    const data = generateSyntheticData([users], 50)

    for (const row of data[users.id]) {
      expect(row.age).toBeGreaterThanOrEqual(18)
      expect(row.age).toBeLessThanOrEqual(80)
    }
  })

  it('propagates the circular reference error instead of generating data', () => {
    const a = entity('A')
    const b = entity('B')
    a.fields.push(field({ name: 'bId', type: 'foreign_key', referenceEntityId: b.id }))
    b.fields.push(field({ name: 'aId', type: 'foreign_key', referenceEntityId: a.id }))

    expect(() => generateSyntheticData([a, b], 5)).toThrow(/Circular reference detected/)
  })
})
