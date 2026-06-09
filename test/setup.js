import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Unmount React trees between tests.
afterEach(() => cleanup())

// Default fetch stub so components that load results on mount don't hit the
// network during tests. Individual tests can override global.fetch.
if (!global.fetch) {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ matches: [] }) }))
}
