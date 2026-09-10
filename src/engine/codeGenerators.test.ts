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

describe('generateCodeSnippets — Python', () => {
  it('uses requests.get for a GET', () => {
    const { python } = generateCodeSnippets('GET', '/api/users')

    expect(python).toContain('import requests')
    expect(python).toContain('requests.get("http://localhost:5173/api/users")')
    expect(python).toContain('response.json()')
  })

  it('sends the payload with requests.post', () => {
    const { python } = generateCodeSnippets('POST', '/api/users', '{"email":"dev@example.com"}')

    expect(python).toContain('requests.post("http://localhost:5173/api/users", json=payload)')
    expect(python).toContain('"email": "dev@example.com"')
  })

  it('spells booleans and null the Python way, not the JSON way', () => {
    const body = JSON.stringify({ active: true, archived: false, deletedAt: null })

    const { python } = generateCodeSnippets('POST', '/api/users', body)

    expect(python).toContain('"active": True')
    expect(python).toContain('"archived": False')
    expect(python).toContain('"deletedAt": None')
    expect(python).not.toMatch(/: true|: false|: null/)
  })

  it('renders nested objects and arrays as Python literals', () => {
    const body = JSON.stringify({ tags: ['a', 'b'], meta: { ok: true } })

    const { python } = generateCodeSnippets('POST', '/api/users', body)

    expect(python).toContain('"tags": [')
    expect(python).toContain('"ok": True')
  })

  it('falls back to an empty payload for a malformed body', () => {
    const { python } = generateCodeSnippets('POST', '/api/users', 'not-json{')

    expect(python).toContain('payload = {}')
  })
})

describe('generateCodeSnippets — Axios', () => {
  it('imports axios and calls get', () => {
    const { axios } = generateCodeSnippets('GET', '/api/users')

    expect(axios).toContain("import axios from 'axios';")
    expect(axios).toContain("axios.get('http://localhost:5173/api/users')")
  })

  it('passes the parsed body as the second post argument', () => {
    const { axios } = generateCodeSnippets('POST', '/api/users', '{"email":"dev@example.com"}')

    expect(axios).toContain("axios.post('http://localhost:5173/api/users', {")
    expect(axios).toContain('"email": "dev@example.com"')
  })

  it('uses a placeholder when the body is missing', () => {
    const { axios } = generateCodeSnippets('POST', '/api/users')

    expect(axios).toContain('// payload')
  })
})

describe('generateCodeSnippets — Rust', () => {
  it('builds a reqwest GET with a tokio main', () => {
    const { rust } = generateCodeSnippets('GET', '/api/users')

    expect(rust).toContain('#[tokio::main]')
    expect(rust).toContain('reqwest::get("http://localhost:5173/api/users")')
    expect(rust).toContain('let body: Value = response.json().await?;')
  })

  it('wraps a POST payload in the json! macro', () => {
    const { rust } = generateCodeSnippets('POST', '/api/users', '{"email":"dev@example.com"}')

    expect(rust).toContain('use serde_json::{json, Value};')
    expect(rust).toContain('let payload = json!({')
    expect(rust).toContain('"email": "dev@example.com"')
    expect(rust).toContain('.json(&payload)')
  })

  it('does not import the json macro for a GET that never uses it', () => {
    const { rust } = generateCodeSnippets('GET', '/api/users')

    expect(rust).not.toContain('json!')
  })
})

describe('generateCodeSnippets — all languages', () => {
  it('returns every supported language for a request', () => {
    const snippets = generateCodeSnippets('GET', '/api/users')

    expect(Object.keys(snippets).sort()).toEqual(['axios', 'curl', 'fetch', 'python', 'rust'])
    expect(Object.values(snippets).every((s) => s.length > 0)).toBe(true)
  })

  it('points every language at the same URL', () => {
    const snippets = generateCodeSnippets('GET', '/api/orders?limit=5')

    for (const snippet of Object.values(snippets)) {
      expect(snippet).toContain('http://localhost:5173/api/orders?limit=5')
    }
  })
})
