import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { generateCodeSnippets } from '../../engine/codeGenerators'

interface CodeSnippetProps {
  method: 'GET' | 'POST'
  path: string
  body?: string
}

export default function CodeSnippet({ method, path, body }: CodeSnippetProps) {
  const [activeTab, setActiveTab] = useState<'curl' | 'fetch'>('curl')
  const [copied, setCopied] = useState(false)

  const snippets = generateCodeSnippets(method, path, body)
  const activeSnippet = activeTab === 'curl' ? snippets.curl : snippets.fetch

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
