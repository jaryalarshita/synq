import { create } from 'zustand'

export interface SchemaField {
  id: string
  name: string
  type: string
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
  addEntity: (name: string) => void
}

export const useSynqStore = create<SynqState>((set) => ({
  entities: [],
  generatedData: {},
  addEntity: (name) => set((state) => ({
    entities: [...state.entities, { id: crypto.randomUUID(), name, fields: [] }]
  }))
}))
