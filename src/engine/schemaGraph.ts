import type { Entity } from '../store/useSynqStore'

/**
 * Performs a topological sort on entities based on foreign key dependencies.
 * If a cycle is detected, throws an Error.
 *
 * Lives apart from dataGenerator so consumers that only need dependency
 * ordering (e.g. the SQL exporter) don't pull in the Faker bundle.
 */
export function getGenerationOrder(entities: Entity[]): Entity[] {
  const order: Entity[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()

  const entityMap = new Map<string, Entity>(entities.map((e) => [e.id, e]))

  function visit(entityId: string) {
    if (visiting.has(entityId)) {
      // Find the names in the cycle for a descriptive error message
      const cycleEntities = Array.from(visiting).map((id) => entityMap.get(id)?.name || id)
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
