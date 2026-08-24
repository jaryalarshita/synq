import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SchemaField {
  id: string
  name: string
  type: 'uuid' | 'string' | 'email' | 'number' | 'currency' | 'date' | 'boolean' | 'enum' | 'foreign_key'
  options?: string[]
  referenceEntityId?: string
}

export interface Entity {
  id: string
  name: string
  fields: SchemaField[]
}

interface SynqState {
  entities: Entity[]
  generatedData: Record<string, any[]>
  isGenerating: boolean
  addEntity: (name: string) => void
  updateEntityName: (id: string, name: string) => void
  deleteEntity: (id: string) => void
  addField: (entityId: string, field: Omit<SchemaField, 'id'>) => void
  updateField: (entityId: string, fieldId: string, updatedField: Partial<SchemaField>) => void
  deleteField: (entityId: string, fieldId: string) => void
  setGeneratedData: (data: Record<string, any[]>) => void
  clearGeneratedData: () => void
  setIsGenerating: (isGenerating: boolean) => void
  addRecord: (entityId: string, record: any) => void
}

export const useSynqStore = create<SynqState>()(
  persist(
    (set) => ({
      entities: [],
      generatedData: {},

      addEntity: (name) => set((state) => ({
        entities: [
          ...state.entities,
          { id: crypto.randomUUID(), name, fields: [] }
        ]
      })),

      updateEntityName: (id, name) => set((state) => ({
        entities: state.entities.map((ent) =>
          ent.id === id ? { ...ent, name } : ent
        )
      })),

      deleteEntity: (id) => set((state) => {
        // Delete the entity and clean up any Foreign Key fields referencing this entity
        const entities = state.entities
          .filter((ent) => ent.id !== id)
          .map((ent) => ({
            ...ent,
            fields: ent.fields.filter(
              (field) => !(field.type === 'foreign_key' && field.referenceEntityId === id)
            )
          }))

        // Also drop any generated records that belonged to the deleted entity
        const { [id]: _removed, ...generatedData } = state.generatedData

        return { entities, generatedData }
      }),

      addField: (entityId, field) => set((state) => ({
        entities: state.entities.map((ent) =>
          ent.id === entityId
            ? { ...ent, fields: [...ent.fields, { ...field, id: crypto.randomUUID() } as SchemaField] }
            : ent
        )
      })),

      updateField: (entityId, fieldId, updatedField) => set((state) => ({
        entities: state.entities.map((ent) =>
          ent.id === entityId
            ? {
                ...ent,
                fields: ent.fields.map((f) =>
                  f.id === fieldId ? { ...f, ...updatedField } as SchemaField : f
                )
              }
            : ent
        )
      })),

      deleteField: (entityId, fieldId) => set((state) => ({
        entities: state.entities.map((ent) =>
          ent.id === entityId
            ? { ...ent, fields: ent.fields.filter((f) => f.id !== fieldId) }
            : ent
        )
      })),

      isGenerating: false,
      setGeneratedData: (data) => set({ generatedData: data }),
      clearGeneratedData: () => set({ generatedData: {} }),
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      addRecord: (entityId, record) => set((state) => ({
        generatedData: {
          ...state.generatedData,
          [entityId]: [...(state.generatedData[entityId] || []), record]
        }
      }))
    }),
    {
      name: 'synq-storage',
      // Only persist the schema/data itself, not transient UI flags
      partialize: (state) => ({
        entities: state.entities,
        generatedData: state.generatedData
      })
    }
  )
)
