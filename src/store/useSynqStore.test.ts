import { describe, it, expect, beforeEach } from 'vitest'
import { useSynqStore } from './useSynqStore'

// Reset the store (it's a module-level singleton) before every test so
// state from one test can't leak into the next.
beforeEach(() => {
  useSynqStore.setState({ entities: [], generatedData: {}, isGenerating: false })
})

describe('useSynqStore entity/field CRUD', () => {
  it('adds an entity with an empty field list', () => {
    useSynqStore.getState().addEntity('Users')

    const { entities } = useSynqStore.getState()
    expect(entities).toHaveLength(1)
    expect(entities[0]).toMatchObject({ name: 'Users', fields: [] })
  })

  it('renames an entity by id', () => {
    useSynqStore.getState().addEntity('Users')
    const id = useSynqStore.getState().entities[0].id

    useSynqStore.getState().updateEntityName(id, 'Customers')

    expect(useSynqStore.getState().entities[0].name).toBe('Customers')
  })

  it('adds, updates, and deletes a field on an entity', () => {
    useSynqStore.getState().addEntity('Users')
    const entityId = useSynqStore.getState().entities[0].id

    useSynqStore.getState().addField(entityId, { name: 'email', type: 'email' })
    let field = useSynqStore.getState().entities[0].fields[0]
    expect(field.name).toBe('email')

    useSynqStore.getState().updateField(entityId, field.id, { name: 'workEmail' })
    field = useSynqStore.getState().entities[0].fields[0]
    expect(field.name).toBe('workEmail')

    useSynqStore.getState().deleteField(entityId, field.id)
    expect(useSynqStore.getState().entities[0].fields).toHaveLength(0)
  })
})

describe('useSynqStore deleteEntity', () => {
  it('removes the entity and its own generated rows', () => {
    useSynqStore.getState().addEntity('Users')
    const usersId = useSynqStore.getState().entities[0].id
    useSynqStore.getState().setGeneratedData({ [usersId]: [{ id: 'u1' }] })

    useSynqStore.getState().deleteEntity(usersId)

    const { entities, generatedData } = useSynqStore.getState()
    expect(entities).toHaveLength(0)
    expect(generatedData[usersId]).toBeUndefined()
  })

  it('drops the dangling foreign-key field from dependent entities', () => {
    useSynqStore.getState().addEntity('Users')
    const usersId = useSynqStore.getState().entities[0].id
    useSynqStore.getState().addEntity('Orders')
    const ordersId = useSynqStore.getState().entities[1].id
    useSynqStore.getState().addField(ordersId, {
      name: 'userId',
      type: 'foreign_key',
      referenceEntityId: usersId
    })

    useSynqStore.getState().deleteEntity(usersId)

    const orders = useSynqStore.getState().entities.find((e) => e.id === ordersId)
    expect(orders?.fields).toHaveLength(0)
  })

  it('strips the orphaned foreign-key value from already generated rows of dependent entities', () => {
    useSynqStore.getState().addEntity('Users')
    const usersId = useSynqStore.getState().entities[0].id
    useSynqStore.getState().addEntity('Orders')
    const ordersId = useSynqStore.getState().entities[1].id
    useSynqStore.getState().addField(ordersId, {
      name: 'userId',
      type: 'foreign_key',
      referenceEntityId: usersId
    })

    // Simulate data that was generated before the Users entity is deleted:
    // Orders rows still carry a userId pointing at a User record.
    useSynqStore.getState().setGeneratedData({
      [usersId]: [{ id: 'u1' }],
      [ordersId]: [{ id: 'o1', userId: 'u1', total: 42 }]
    })

    useSynqStore.getState().deleteEntity(usersId)

    const orderRows = useSynqStore.getState().generatedData[ordersId]
    expect(orderRows).toEqual([{ id: 'o1', total: 42 }])
    expect(orderRows[0]).not.toHaveProperty('userId')
  })

  it('leaves unrelated entities and their generated data untouched', () => {
    useSynqStore.getState().addEntity('Users')
    const usersId = useSynqStore.getState().entities[0].id
    useSynqStore.getState().addEntity('Products')
    const productsId = useSynqStore.getState().entities[1].id
    useSynqStore.getState().setGeneratedData({
      [usersId]: [{ id: 'u1' }],
      [productsId]: [{ id: 'p1', name: 'Widget' }]
    })

    useSynqStore.getState().deleteEntity(usersId)

    expect(useSynqStore.getState().generatedData[productsId]).toEqual([{ id: 'p1', name: 'Widget' }])
  })
})

describe('useSynqStore addRecord', () => {
  it('appends a record to an existing entity dataset', () => {
    useSynqStore.getState().addEntity('Users')
    const usersId = useSynqStore.getState().entities[0].id
    useSynqStore.getState().setGeneratedData({ [usersId]: [{ id: 'u1' }] })

    useSynqStore.getState().addRecord(usersId, { id: 'u2' })

    expect(useSynqStore.getState().generatedData[usersId]).toEqual([{ id: 'u1' }, { id: 'u2' }])
  })

  it('creates the dataset when the entity had no rows yet', () => {
    useSynqStore.getState().addEntity('Users')
    const usersId = useSynqStore.getState().entities[0].id

    useSynqStore.getState().addRecord(usersId, { id: 'u1' })

    expect(useSynqStore.getState().generatedData[usersId]).toEqual([{ id: 'u1' }])
  })
})
