import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * How numeric values are sampled. `uniform` spreads evenly across the range;
 * `normal` clusters around a mean with the given standard deviation.
 */
export type DistributionKind = 'uniform' | 'normal'

export interface NumericDistribution {
  kind: DistributionKind
  /** Bounds for `uniform`, and the clamp applied to `normal` samples. */
  min?: number
  max?: number
  mean?: number
  stdDev?: number
}

export interface SchemaField {
  id: string
  name: string
  type: 'uuid' | 'string' | 'email' | 'number' | 'currency' | 'date' | 'boolean' | 'enum' | 'foreign_key'
  options?: string[]
  referenceEntityId?: string
  /** number/currency only: overrides the default name-based heuristics. */
  distribution?: NumericDistribution
  /** enum only: relative pick weights, positionally matched to `options`. */
  weights?: number[]
  /** string only: a regex the generated value must match. */
  pattern?: string
}

export interface Entity {
  id: string
  name: string
  fields: SchemaField[]
}

/** HTTP statuses the chaos engine can inject into a mock response. */
export type ChaosErrorStatus = 500 | 429 | 404

/**
 * Fault-injection settings applied to every simulated request. Latency is a
 * range the engine picks from; error rates are percentages (0-100) that are
 * rolled independently of one another but capped at 100% in total.
 */
export interface ChaosConfig {
  enabled: boolean
  latencyMin: number
  latencyMax: number
  errorRates: Record<ChaosErrorStatus, number>
}

export const MAX_CHAOS_LATENCY_MS = 5000

/** One simulated request, recorded for the observability dashboard. */
export interface RequestLogEntry {
  id: string
  timestamp: number
  method: 'GET' | 'POST'
  path: string
  status: number
  timeMs: number
  /** True when the chaos engine produced the response rather than the router. */
  injected: boolean
}

/**
 * Cap on retained telemetry. The log is persisted alongside the schema, so it
 * is trimmed oldest-first to keep localStorage from growing without bound.
 */
export const MAX_REQUEST_LOG_ENTRIES = 500

/** Workspace tabs, persisted so a reload returns you where you left off. */
export type WorkspaceTab = 'schema' | 'data' | 'api' | 'observability'

/** Mirrors the pre-chaos behaviour: an 80-240ms delay and no injected errors. */
export const DEFAULT_CHAOS_CONFIG: ChaosConfig = {
  enabled: false,
  latencyMin: 80,
  latencyMax: 240,
  errorRates: { 500: 0, 429: 0, 404: 0 }
}

interface SynqState {
  entities: Entity[]
  generatedData: Record<string, any[]>
  isGenerating: boolean
  chaosConfig: ChaosConfig
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
  updateChaosConfig: (patch: Partial<ChaosConfig>) => void
  resetChaosConfig: () => void
  requestLog: RequestLogEntry[]
  logRequest: (entry: Omit<RequestLogEntry, 'id' | 'timestamp'>) => void
  clearRequestLog: () => void
  activeTab: WorkspaceTab
  setActiveTab: (tab: WorkspaceTab) => void
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
        // Before mutating the schema, note which other entities had a Foreign
        // Key field pointing at the entity being deleted, so their already
        // generated rows can be scrubbed too (otherwise those rows keep a
        // dangling FK value/column for a field that no longer exists).
        const orphanedFieldNamesByEntity = new Map<string, string[]>()
        for (const ent of state.entities) {
          if (ent.id === id) continue
          const orphanedFieldNames = ent.fields
            .filter((field) => field.type === 'foreign_key' && field.referenceEntityId === id)
            .map((field) => field.name)
          if (orphanedFieldNames.length > 0) {
            orphanedFieldNamesByEntity.set(ent.id, orphanedFieldNames)
          }
        }

        // Delete the entity and clean up any Foreign Key fields referencing this entity
        const entities = state.entities
          .filter((ent) => ent.id !== id)
          .map((ent) => ({
            ...ent,
            fields: ent.fields.filter(
              (field) => !(field.type === 'foreign_key' && field.referenceEntityId === id)
            )
          }))

        // Drop any generated records that belonged to the deleted entity itself...
        const { [id]: _removed, ...restGeneratedData } = state.generatedData

        // ...and strip the now-orphaned FK columns from every other entity's
        // already generated rows so no stale reference to a deleted record survives.
        const generatedData = Object.fromEntries(
          Object.entries(restGeneratedData).map(([entityId, rows]) => {
            const orphanedFieldNames = orphanedFieldNamesByEntity.get(entityId)
            if (!orphanedFieldNames) return [entityId, rows]

            const cleanedRows = rows.map((row) => {
              const cleanedRow = { ...row }
              for (const fieldName of orphanedFieldNames) {
                delete cleanedRow[fieldName]
              }
              return cleanedRow
            })
            return [entityId, cleanedRows]
          })
        )

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
      chaosConfig: DEFAULT_CHAOS_CONFIG,

      updateChaosConfig: (patch) => set((state) => {
        const next = { ...state.chaosConfig, ...patch }

        // Clamp to the supported latency window and keep min <= max, so a
        // slider drag can never produce an impossible range.
        next.latencyMin = Math.min(Math.max(0, next.latencyMin), MAX_CHAOS_LATENCY_MS)
        next.latencyMax = Math.min(Math.max(0, next.latencyMax), MAX_CHAOS_LATENCY_MS)
        if (next.latencyMin > next.latencyMax) {
          // Whichever bound the caller just moved wins.
          if (patch.latencyMin !== undefined) next.latencyMax = next.latencyMin
          else next.latencyMin = next.latencyMax
        }

        next.errorRates = { ...state.chaosConfig.errorRates, ...(patch.errorRates || {}) }
        for (const status of Object.keys(next.errorRates) as unknown as ChaosErrorStatus[]) {
          next.errorRates[status] = Math.min(Math.max(0, next.errorRates[status]), 100)
        }

        return { chaosConfig: next }
      }),

      resetChaosConfig: () => set({ chaosConfig: DEFAULT_CHAOS_CONFIG }),

      requestLog: [],

      logRequest: (entry) => set((state) => {
        const next = [
          ...state.requestLog,
          { ...entry, id: crypto.randomUUID(), timestamp: Date.now() }
        ]
        // Keep only the most recent entries (oldest dropped first).
        return {
          requestLog: next.length > MAX_REQUEST_LOG_ENTRIES
            ? next.slice(next.length - MAX_REQUEST_LOG_ENTRIES)
            : next
        }
      }),

      clearRequestLog: () => set({ requestLog: [] }),

      activeTab: 'schema',
      setActiveTab: (tab) => set({ activeTab: tab }),

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
        generatedData: state.generatedData,
        chaosConfig: state.chaosConfig,
        requestLog: state.requestLog,
        activeTab: state.activeTab
      })
    }
  )
)
