import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface CodeSnippetProps {
  method: 'GET' | 'POST'
  path: string
  body?: string
}

export default function CodeSnippet({ method, path, body }: CodeSnippetProps) {
  const [activeTab, setActiveTab] = useState<'curl' | 'fetch'>('curl')
  const [copied, setCopied] = useState(false)

  // Ensure path starts with a slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const baseUrl = 'http://localhost:5173'
  const fullUrl = `${baseUrl}${cleanPath}`

  // 1. Generate cURL snippet
  const getCurlSnippet = (): string => {
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

  // 2. Generate JavaScript fetch snippet
  const getFetchSnippet = (): string => {
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

  const activeSnippet = activeTab === 'curl' ? getCurlSnippet() : getFetchSnippet()

  const handleCopy = () => {
    navigator.clipboard.writeText(activeSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="code-snippet-container glass-card">
      <div className="snippet-header">
        <div className="snippet-tabs">
          <button
            type="button"
            className={`snippet-tab ${activeTab === 'curl' ? 'active' : ''}`}
            onClick={() => setActiveTab('curl')}
          >
            cURL
          </button>
          <button
            type="button"
            className={`snippet-tab ${activeTab === 'fetch' ? 'active' : ''}`}
            onClick={() => setActiveTab('fetch')}
          >
            JavaScript (Fetch)
          </button>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm copy-snippet-btn"
          onClick={handleCopy}
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check size={14} className="copy-check-icon" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="snippet-body">
        <pre className="code-block">
          <code>{activeSnippet}</code>
        </pre>
      </div>
    </div>
  )
}
