import { describe, it, expect } from 'vitest'
import { generateCodeSnippets } from './codeGenerators'

describe('generateCodeSnippets', () => {
  it('builds a plain GET curl command against the local base URL', () => {
    const { curl } = generateCodeSnippets('GET', '/api/users')

    expect(curl).toBe('curl -X GET "http://localhost:5173/api/users"')
  })

  it('normalises a path that is missing its leading slash', () => {
    const { curl, fetch } = generateCodeSnippets('GET', 'api/users')

    expect(curl).toContain('http://localhost:5173/api/users')
    expect(fetch).toContain("fetch('http://localhost:5173/api/users')")
  })

  it('preserves query parameters in both snippets', () => {
    const { curl, fetch } = generateCodeSnippets('GET', '/api/users?limit=10&page=2')

    expect(curl).toContain('/api/users?limit=10&page=2')
    expect(fetch).toContain('/api/users?limit=10&page=2')
  })

  it('collapses a POST body into a single line for curl', () => {
    const body = '{\n  "email": "dev@example.com",\n  "age": 30\n}'

    const { curl } = generateCodeSnippets('POST', '/api/users', body)

    expect(curl).toContain('-X POST')
    expect(curl).toContain(`-d '{"email":"dev@example.com","age":30}'`)
    expect(curl).toContain('-H "Content-Type: application/json"')
  })

  it('emits a POST fetch snippet with method, headers, and body', () => {
    const { fetch } = generateCodeSnippets('POST', '/api/users', '{"email":"dev@example.com"}')

    expect(fetch).toContain("method: 'POST'")
    expect(fetch).toContain("'Content-Type': 'application/json'")
    expect(fetch).toContain('JSON.stringify({')
    expect(fetch).toContain('"email": "dev@example.com"')
  })

  it('falls back to the raw body when the payload is not valid JSON', () => {
    const { curl, fetch } = generateCodeSnippets('POST', '/api/users', 'not-json{')

    expect(curl).toContain(`-d 'not-json{'`)
    expect(fetch).toContain('not-json{')
  })

  it('uses a placeholder payload when a POST has no body at all', () => {
    const { fetch } = generateCodeSnippets('POST', '/api/users')

    expect(fetch).toContain('// payload')
  })
})
