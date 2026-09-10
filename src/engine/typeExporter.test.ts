import { describe, it, expect } from 'vitest'
import { generateTypeScriptInterfaces, toPascalCase, fieldToTsType } from './typeExporter'
import type { Entity, SchemaField } from '../store/useSynqStore'

function field(overrides: Partial<SchemaField> & Pick<SchemaField, 'name' | 'type'>): SchemaField {
  return { id: crypto.randomUUID(), ...overrides }
}

function entity(name: string, fields: SchemaField[] = []): Entity {
  return { id: crypto.randomUUID(), name, fields }
}

describe('toPascalCase', () => {
  it('converts snake_case, spaces, and camelCase to PascalCase', () => {
    expect(toPascalCase('order_items')).toBe('OrderItems')
    expect(toPascalCase('order items')).toBe('OrderItems')
    expect(toPascalCase('orderItems')).toBe('OrderItems')
  })

  it('handles an already-PascalCase name', () => {
    expect(toPascalCase('Users')).toBe('Users')
  })

  it('prefixes a name starting with a digit so it stays a valid identifier', () => {
    expect(toPascalCase('2fa_tokens')).toMatch(/^Entity/)
  })

  it('falls back for a name with no usable characters', () => {
    expect(toPascalCase('---')).toBe('Entity')
  })
})

describe('fieldToTsType', () => {
  it('maps numeric types to number', () => {
    expect(fieldToTsType(field({ name: 'age', type: 'number' }))).toBe('number')
    expect(fieldToTsType(field({ name: 'price', type: 'currency' }))).toBe('number')
  })

  it('maps boolean to boolean', () => {
    expect(fieldToTsType(field({ name: 'active', type: 'boolean' }))).toBe('boolean')
  })

  it('maps text-like types to string', () => {
    for (const type of ['uuid', 'email', 'date', 'string', 'foreign_key'] as const) {
      expect(fieldToTsType(field({ name: 'x', type }))).toBe('string')
    }
  })

  it('turns enum options into a union of string literals', () => {
    const type = fieldToTsType(field({ name: 'role', type: 'enum', options: ['admin', 'user'] }))

    expect(type).toBe('"admin" | "user"')
  })

  it('falls back to string for an enum with no options', () => {
    expect(fieldToTsType(field({ name: 'role', type: 'enum' }))).toBe('string')
  })
})

describe('generateTypeScriptInterfaces', () => {
  it('notes when there is nothing to export', () => {
    expect(generateTypeScriptInterfaces([])).toContain('No entities defined')
  })

  it('declares an exported interface with an id for every entity', () => {
    const users = entity('Users', [field({ name: 'email', type: 'email' })])

    const output = generateTypeScriptInterfaces([users])

    expect(output).toContain('export interface Users {')
    expect(output).toContain('  id: string;')
    expect(output).toContain('  email: string;')
  })

  it('annotates a foreign key with the interface it points at', () => {
    const users = entity('Users')
    const orders = entity('Orders', [
      field({ name: 'userId', type: 'foreign_key', referenceEntityId: users.id })
    ])

    const output = generateTypeScriptInterfaces([orders, users])

    expect(output).toContain('userId: string; // FK -> Users.id')
  })

  it('emits referenced interfaces before the ones referencing them', () => {
    const users = entity('Users')
    const orders = entity('Orders', [
      field({ name: 'userId', type: 'foreign_key', referenceEntityId: users.id })
    ])

    const output = generateTypeScriptInterfaces([orders, users])

    expect(output.indexOf('interface Users')).toBeLessThan(output.indexOf('interface Orders'))
  })

  it('still exports a circular schema instead of throwing', () => {
    const a = entity('A')
    const b = entity('B')
    a.fields.push(field({ name: 'bId', type: 'foreign_key', referenceEntityId: b.id }))
    b.fields.push(field({ name: 'aId', type: 'foreign_key', referenceEntityId: a.id }))

    const output = generateTypeScriptInterfaces([a, b])

    expect(output).toContain('export interface A {')
    expect(output).toContain('export interface B {')
  })

  it('quotes property names that are not valid identifiers', () => {
    const users = entity('Users', [field({ name: 'first name', type: 'string' })])

    expect(generateTypeScriptInterfaces([users])).toContain('"first name": string;')
  })

  it('mentions a regex constraint in a comment', () => {
    const users = entity('Users', [field({ name: 'sku', type: 'string', pattern: '[A-Z]{3}' })])

    expect(generateTypeScriptInterfaces([users])).toContain('// matches /[A-Z]{3}/')
  })

  it('marks a foreign key whose target has been deleted', () => {
    const orders = entity('Orders', [
      field({ name: 'ghostId', type: 'foreign_key', referenceEntityId: 'gone' })
    ])

    expect(generateTypeScriptInterfaces([orders])).toContain('FK -> (deleted entity)')
  })
})
