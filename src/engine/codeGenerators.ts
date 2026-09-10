const BASE_URL = 'http://localhost:5173'

export interface CodeSnippets {
  curl: string
  fetch: string
  python: string
  axios: string
  rust: string
}

/** Snippet languages in the order their tabs are displayed. */
export type SnippetLanguage = keyof CodeSnippets

export const SNIPPET_LANGUAGES: { key: SnippetLanguage; label: string }[] = [
  { key: 'curl', label: 'cURL' },
  { key: 'fetch', label: 'JavaScript (Fetch)' },
  { key: 'axios', label: 'Axios' },
  { key: 'python', label: 'Python' },
  { key: 'rust', label: 'Rust' }
]

/**
 * Generates ready-to-copy client snippets for a given mock API request
 * (method, path, and optional JSON body for POST).
 */
export function generateCodeSnippets(
  method: 'GET' | 'POST',
  path: string,
  body?: string
): CodeSnippets {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const fullUrl = `${BASE_URL}${cleanPath}`

  return {
    curl: getCurlSnippet(method, fullUrl, body),
    fetch: getFetchSnippet(method, fullUrl, body),
    python: getPythonSnippet(method, fullUrl, body),
    axios: getAxiosSnippet(method, fullUrl, body),
    rust: getRustSnippet(method, fullUrl, body)
  }
}

/**
 * Parses a JSON body for templating into a snippet. Returns null when the
 * body is absent or malformed, letting each generator fall back to a literal.
 */
function parseBody(body?: string): unknown | null {
  if (!body) return null
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

/** Renders a JS/JSON object literal indented to sit inside a snippet. */
function indentJson(value: unknown, indent: string): string {
  return JSON.stringify(value, null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? line : `${indent}${line}`))
    .join('\n')
}

function getCurlSnippet(method: 'GET' | 'POST', fullUrl: string, body?: string): string {
  if (method === 'GET') {
    return `curl -X GET "${fullUrl}"`
  }

  // Format JSON body for single line
  let singleLineBody = ''
  try {
    if (body) {
      singleLineBody = JSON.stringify(JSON.parse(body))
    }
  } catch {
    singleLineBody = body || ''
  }

  return `curl -X POST "${fullUrl}" \\\n  -H "Content-Type: application/json" \\\n  -d '${singleLineBody}'`
}

function getFetchSnippet(method: 'GET' | 'POST', fullUrl: string, body?: string): string {
  if (method === 'GET') {
    return `fetch('${fullUrl}')\n  .then(response => response.json())\n  .then(data => console.log(data))\n  .catch(error => console.error('Error:', error));`
  }

  // Format body with indentation for JS snippet
  let formattedBody = '{\n    // payload\n  }'
  try {
    if (body) {
      const parsed = JSON.parse(body)
      formattedBody = JSON.stringify(parsed, null, 2)
        .split('\n')
        .map((line, i) => (i === 0 ? line : `  ${line}`))
        .join('\n')
    }
  } catch {
    formattedBody = body || ''
  }

  return `fetch('${fullUrl}', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify(${formattedBody})\n})\n  .then(response => response.json())\n  .then(data => console.log(data))\n  .catch(error => console.error('Error:', error));`
}

/**
 * Renders a value as a Python literal. JSON's `true/false/null` are spelled
 * `True/False/None` in Python, so a raw JSON.stringify would not run.
 */
function toPythonLiteral(value: unknown, indentLevel = 1): string {
  const pad = '    '.repeat(indentLevel)
  const closingPad = '    '.repeat(indentLevel - 1)

  if (value === null || value === undefined) return 'None'
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return JSON.stringify(value)

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map((item) => `${pad}${toPythonLiteral(item, indentLevel + 1)}`)
    return `[\n${items.join(',\n')}\n${closingPad}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return '{}'
  const lines = entries.map(
    ([key, val]) => `${pad}${JSON.stringify(key)}: ${toPythonLiteral(val, indentLevel + 1)}`
  )
  return `{\n${lines.join(',\n')}\n${closingPad}}`
}

function getPythonSnippet(method: 'GET' | 'POST', fullUrl: string, body?: string): string {
  if (method === 'GET') {
    return [
      'import requests',
      '',
      `response = requests.get("${fullUrl}")`,
      'response.raise_for_status()',
      'print(response.json())'
    ].join('\n')
  }

  const parsed = parseBody(body)
  const payload = parsed === null ? '{}' : toPythonLiteral(parsed)

  return [
    'import requests',
    '',
    `payload = ${payload}`,
    '',
    `response = requests.post("${fullUrl}", json=payload)`,
    'response.raise_for_status()',
    'print(response.json())'
  ].join('\n')
}

function getAxiosSnippet(method: 'GET' | 'POST', fullUrl: string, body?: string): string {
  if (method === 'GET') {
    return [
      "import axios from 'axios';",
      '',
      `axios.get('${fullUrl}')`,
      '  .then(response => console.log(response.data))',
      "  .catch(error => console.error('Error:', error));"
    ].join('\n')
  }

  const parsed = parseBody(body)
  const payload = parsed === null ? '{\n  // payload\n}' : indentJson(parsed, '')

  return [
    "import axios from 'axios';",
    '',
    `axios.post('${fullUrl}', ${payload})`,
    '  .then(response => console.log(response.data))',
    "  .catch(error => console.error('Error:', error));"
  ].join('\n')
}

function getRustSnippet(method: 'GET' | 'POST', fullUrl: string, body?: string): string {
  if (method === 'GET') {
    return [
      'use reqwest;',
      'use serde_json::Value;',
      '',
      '#[tokio::main]',
      'async fn main() -> Result<(), Box<dyn std::error::Error>> {',
      `    let response = reqwest::get("${fullUrl}").await?;`,
      '    let body: Value = response.json().await?;',
      '    println!("{:#?}", body);',
      '    Ok(())',
      '}'
    ].join('\n')
  }

  const parsed = parseBody(body)
  // serde_json::json! accepts JSON syntax verbatim, so the body drops straight in.
  const payload = parsed === null ? '{}' : indentJson(parsed, '        ')

  return [
    'use reqwest;',
    'use serde_json::{json, Value};',
    '',
    '#[tokio::main]',
    'async fn main() -> Result<(), Box<dyn std::error::Error>> {',
    '    let client = reqwest::Client::new();',
    `    let payload = json!(${payload});`,
    '',
    `    let response = client.post("${fullUrl}")`,
    '        .json(&payload)',
    '        .send()',
    '        .await?;',
    '',
    '    let body: Value = response.json().await?;',
    '    println!("{:#?}", body);',
    '    Ok(())',
    '}'
  ].join('\n')
}
