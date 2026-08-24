import '@testing-library/jest-dom/vitest'

// Node 22+ ships its own global `localStorage`, which requires a
// `--localstorage-file` CLI flag to actually work — without it, the global
// exists but its methods (setItem/getItem/...) are missing, and it shadows
// jsdom's real implementation. Zustand's persist middleware then breaks with
// "storage.setItem is not a function". Replace it with a minimal in-memory
// Storage polyfill so persistence can be exercised in tests.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length() {
    return this.store.size
  }

  clear() {
    this.store.clear()
  }

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.store.delete(key)
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value))
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true
})
