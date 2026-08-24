import { faker } from '@faker-js/faker'
import type { Entity, SchemaField } from '../store/useSynqStore'

/**
 * Performs a topological sort on entities based on foreign key dependencies.
 * If a cycle is detected, throws an Error.
 */
export function getGenerationOrder(entities: Entity[]): Entity[] {
  const order: Entity[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()
  
  const entityMap = new Map<string, Entity>(entities.map((e) => [e.id, e]))

  function visit(entityId: string) {
    if (visiting.has(entityId)) {
      // Find the names in the cycle for a descriptive error message
      const cycleEntities = Array.from(visiting).map(id => entityMap.get(id)?.name || id)
      cycleEntities.push(entityMap.get(entityId)?.name || entityId)
      throw new Error(`Circular reference detected: ${cycleEntities.join(' ➔ ')}`)
    }
    
    if (!visited.has(entityId)) {
      visiting.add(entityId)
      const entity = entityMap.get(entityId)
      
      if (entity) {
        // Collect dependencies (entities referenced via foreign key fields)
        const dependencies = entity.fields
          .filter((f) => f.type === 'foreign_key' && f.referenceEntityId)
          .map((f) => f.referenceEntityId as string)

        for (const depId of dependencies) {
          visit(depId)
        }
      }
      
      visiting.delete(entityId)
      visited.add(entityId)
      if (entity) {
        order.push(entity)
      }
    }
  }

  for (const ent of entities) {
    visit(ent.id)
  }

  return order
}

/**
 * Generates a realistic mock value based on the schema field type and optional metadata.
 */
function generateFieldValue(
  field: SchemaField,
  generatedData: Record<string, any[]>
): any {
  const nameLower = field.name.toLowerCase()

  switch (field.type) {
    case 'uuid':
      return faker.string.uuid()

    case 'email':
      return faker.internet.email().toLowerCase()

    case 'number':
      if (nameLower.includes('age')) {
        return faker.number.int({ min: 18, max: 80 })
      }
      if (nameLower.includes('quantity') || nameLower.includes('qty') || nameLower.includes('count')) {
        return faker.number.int({ min: 1, max: 100 })
      }
      if (nameLower.includes('year')) {
        return faker.number.int({ min: 2000, max: 2026 })
      }
      return faker.number.int({ min: 1, max: 99999 })

    case 'currency':
      return parseFloat(faker.finance.amount({ min: 5, max: 2000, dec: 2 }))

    case 'date':
      // Return YYYY-MM-DD
      return faker.date.past({ years: 2 }).toISOString().split('T')[0]

    case 'boolean':
      return faker.datatype.boolean()

    case 'enum':
      if (field.options && field.options.length > 0) {
        const index = faker.number.int({ min: 0, max: field.options.length - 1 })
        return field.options[index]
      }
      return null

    case 'foreign_key': {
      const targetEntityId = field.referenceEntityId
      if (!targetEntityId) return null
      const targetRows = generatedData[targetEntityId] || []
      if (targetRows.length === 0) {
        // Return null or placeholder if parent table generated nothing
        return null
      }
      // Pick a random row from target table and copy its ID
      const randomRow = targetRows[faker.number.int({ min: 0, max: targetRows.length - 1 })]
      return randomRow.id || null
    }

    case 'string':
    default:
      if (nameLower.includes('username') || nameLower.includes('handle')) {
        return faker.internet.username()
      }
      if (nameLower.includes('name')) {
        return faker.person.fullName()
      }
      if (nameLower.includes('title') || nameLower.includes('subject') || nameLower.includes('headline')) {
        return faker.lorem.sentence({ min: 3, max: 6 })
      }
      if (nameLower.includes('desc') || nameLower.includes('bio') || nameLower.includes('summary')) {
        return faker.lorem.paragraph()
      }
      if (nameLower.includes('phone') || nameLower.includes('tel')) {
        return faker.phone.number()
      }
      if (nameLower.includes('address') || nameLower.includes('city') || nameLower.includes('street')) {
        return faker.location.streetAddress()
      }
      if (nameLower.includes('company') || nameLower.includes('org')) {
        return faker.company.name()
      }
      return faker.lorem.word()
  }
}

/**
 * Main engine entry point. Generates N records for each entity in dependency-resolved order.
 */
export function generateSyntheticData(
  entities: Entity[],
  recordCount: number
): Record<string, any[]> {
  if (entities.length === 0) return {}

  // 1. Resolve generation order (detects circular references)
  const orderedEntities = getGenerationOrder(entities)
  const generatedData: Record<string, any[]> = {}

  // 2. Generate records for each entity in order
  for (const entity of orderedEntities) {
    const rows: any[] = []
    
    for (let i = 0; i < recordCount; i++) {
      const record: Record<string, any> = {
        id: faker.string.uuid() // Every record has a standard UUID primary key 'id'
      }

      // Generate configured fields
      for (const field of entity.fields) {
        record[field.name] = generateFieldValue(field, generatedData)
      }

      rows.push(record)
    }

    generatedData[entity.id] = rows
  }

  return generatedData
}
