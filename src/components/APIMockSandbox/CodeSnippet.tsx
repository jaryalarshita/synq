import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { generateCodeSnippets, SNIPPET_LANGUAGES, SNIPPET_BASE_URL } from '../../engine/codeGenerators'
import type { SnippetLanguage } from '../../engine/codeGenerators'

interface CodeSnippetProps {
  method: 'GET' | 'POST'
  path: string
  body?: string
}

export default function CodeSnippet({ method, path, body }: CodeSnippetProps) {
  const [activeTab, setActiveTab] = useState<SnippetLanguage>('curl')
  const [copied, setCopied] = useState(false)

  const snippets = generateCodeSnippets(method, path, body)
  const activeSnippet = snippets[activeTab]

  const handleCopy = () => {
    navigator.clipboard.writeText(activeSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="code-snippet-container glass-card">
      <div className="snippet-header">
        <div className="snippet-tabs">
          {SNIPPET_LANGUAGES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`snippet-tab ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
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
      <p className="snippet-template-note">
        Template — swap <code>{SNIPPET_BASE_URL}</code> for your API's base URL. Synq's mock
        server lives in your browser, not on the network.
      </p>
    </div>
  )
}
