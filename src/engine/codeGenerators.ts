const BASE_URL = 'http://localhost:5173'

export interface CodeSnippets {
  curl: string
  fetch: string
}

/**
 * Generates ready-to-copy cURL and JavaScript fetch() snippets for a given
 * mock API request (method, path, and optional JSON body for POST).
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
    fetch: getFetchSnippet(method, fullUrl, body)
  }
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
