import { useState } from 'react'
import { Send, Globe, Loader2, Play } from 'lucide-react'
import { useSynqStore } from '../../store/useSynqStore'
import { simulateApiRequest } from '../../engine/mockApiServer'
import type { MockApiResponse } from '../../engine/mockApiServer'
import CodeSnippet from './CodeSnippet'

export default function EndpointRunner() {
  const { entities, generatedData, addRecord, chaosConfig } = useSynqStore()

  // Sandbox States
  const [selectedRoute, setSelectedRoute] = useState<{
    entityId: string
    method: 'GET' | 'POST'
    pathTemplate: string
  } | null>(null)

  const [method, setMethod] = useState<'GET' | 'POST'>('GET')
  const [path, setPath] = useState('/api/')
  const [bodyInput, setBodyInput] = useState('')
  const [bodyError, setBodyError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<MockApiResponse | null>(null)

  // Autoselect the first entity's GET route once entities exist. Adjusted
  // directly during render (React's recommended alternative to an
  // effect-driven initial-state setState) rather than in an effect.
  if (entities.length > 0 && !selectedRoute) {
    const firstEntity = entities[0]
    setSelectedRoute({
      entityId: firstEntity.id,
      method: 'GET',
      pathTemplate: `/api/${firstEntity.name.toLowerCase()}`
    })
  }

  const selectedEntity = selectedRoute ? entities.find((e) => e.id === selectedRoute.entityId) : undefined
  const selectedRowCount = selectedRoute ? (generatedData[selectedRoute.entityId] || []).length : 0

  // Populate the request form whenever the selected route (or the
  // availability of sample rows for it) changes. Same render-time reset
  // pattern used above/in FieldModal, keyed on everything the form derives
  // from, instead of an effect that calls setState synchronously.
  const routeFormKey = selectedRoute
    ? `${selectedRoute.entityId}:${selectedRoute.method}:${selectedRoute.pathTemplate}:${selectedRowCount}`
    : null
  const [lastRouteFormKey, setLastRouteFormKey] = useState<string | null>(null)

  if (routeFormKey !== null && routeFormKey !== lastRouteFormKey && selectedRoute && selectedEntity) {
    setLastRouteFormKey(routeFormKey)
    setMethod(selectedRoute.method)

    let initialPath = `/api/${selectedEntity.name.toLowerCase()}`
    if (selectedRoute.pathTemplate.includes('/:id')) {
      const rows = generatedData[selectedEntity.id] || []
      const sampleId = rows[0]?.id || 'sample-uuid-1234'
      initialPath = `/api/${selectedEntity.name.toLowerCase()}/${sampleId}`
    }
    setPath(initialPath)

    // Generate body template for POST requests
    if (selectedRoute.method === 'POST') {
      const templateObj: Record<string, any> = {}
      for (const field of selectedEntity.fields) {
        switch (field.type) {
          case 'uuid':
            templateObj[field.name] = crypto.randomUUID()
            break
          case 'email':
            templateObj[field.name] = 'dev@example.com'
            break
          case 'number':
            templateObj[field.name] = field.name.toLowerCase().includes('age') ? 30 : 100
            break
          case 'currency':
            templateObj[field.name] = 29.99
            break
          case 'date':
            templateObj[field.name] = new Date().toISOString().split('T')[0]
            break
          case 'boolean':
            templateObj[field.name] = true
            break
          case 'enum':
            templateObj[field.name] = field.options?.[0] || 'option'
            break
          case 'foreign_key': {
            const refRows = field.referenceEntityId ? (generatedData[field.referenceEntityId] || []) : []
            templateObj[field.name] = refRows[0]?.id || 'sample-parent-uuid'
            break
          }
          case 'string':
          default:
            templateObj[field.name] = field.name.toLowerCase().includes('name') ? 'John Doe' : 'lorem'
            break
        }
      }
      setBodyInput(JSON.stringify(templateObj, null, 2))
      setBodyError('')
    } else {
      setBodyInput('')
      setBodyError('')
    }
    // Reset old response
    setResponse(null)
  }

  if (entities.length === 0) {
    return (
      <div className="tab-pane">
        <div className="pane-header">
          <h2>API Mock Sandbox</h2>
          <p className="subtitle">Simulate client requests directly against generated databases inside the browser.</p>
        </div>
        <div className="empty-state">
          <div className="empty-icon-wrapper">
            <Globe size={32} className="empty-icon" />
          </div>
          <h3>No Entities Defined</h3>
          <p>Create database tables and populate them with synthetic data to launch mock APIs.</p>
        </div>
      </div>
    )
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate POST JSON body
    if (method === 'POST') {
      try {
        JSON.parse(bodyInput)
        setBodyError('')
      } catch {
        setBodyError('Malformed JSON payload body')
        return
      }
    }

    setIsLoading(true)
    setResponse(null)

    const res = await simulateApiRequest(
      method,
      path,
      method === 'POST' ? bodyInput : undefined,
      entities,
      generatedData,
      addRecord,
      { chaos: chaosConfig }
    )

    setResponse(res)
    setIsLoading(false)
  }

  const getStatusClass = (status: number): string => {
    if (status >= 200 && status < 300) return 'status-success'
    if (status >= 400 && status < 500) return 'status-client-error'
    return 'status-server-error'
  }

  return (
    <div className="tab-pane">
      <div className="pane-header">
        <div>
          <h2>API Mock Sandbox</h2>
          <p className="subtitle">Interact with simulated endpoints using local synthetic datasets.</p>
        </div>
      </div>

      <div className="sandbox-layout">
        {/* Routes list sidebar */}
        <div className="sandbox-sidebar glass-card">
          <div className="sidebar-group-title">Endpoints</div>
          {entities.map((entity) => {
            const hasRows = (generatedData[entity.id] || []).length > 0
            const entName = entity.name.toLowerCase()
            return (
              <div key={entity.id} className="sidebar-entity-group">
                <div className="sidebar-entity-group-name">{entity.name}</div>
                
                {/* GET All */}
                <button
                  className={`route-item ${
                    selectedRoute?.entityId === entity.id &&
                    selectedRoute.method === 'GET' &&
                    !selectedRoute.pathTemplate.includes('/:id')
                      ? 'active'
                      : ''
                  }`}
                  onClick={() =>
                    setSelectedRoute({
                      entityId: entity.id,
                      method: 'GET',
                      pathTemplate: `/api/${entName}`
                    })
                  }
                >
                  <span className="route-method get-method">GET</span>
                  <span className="route-path">/api/{entName}</span>
                </button>

                {/* GET One */}
                <button
                  className={`route-item ${
                    selectedRoute?.entityId === entity.id &&
                    selectedRoute.method === 'GET' &&
                    selectedRoute.pathTemplate.includes('/:id')
                      ? 'active'
                      : ''
                  }`}
                  onClick={() =>
                    setSelectedRoute({
                      entityId: entity.id,
                      method: 'GET',
                      pathTemplate: `/api/${entName}/:id`
                    })
                  }
                  disabled={!hasRows}
                  title={!hasRows ? 'Generate synthetic records first' : ''}
                >
                  <span className="route-method get-method">GET</span>
                  <span className="route-path">/api/{entName}/:id</span>
                </button>

                {/* POST */}
                <button
                  className={`route-item ${
                    selectedRoute?.entityId === entity.id &&
                    selectedRoute.method === 'POST'
                      ? 'active'
                      : ''
                  }`}
                  onClick={() =>
                    setSelectedRoute({
                      entityId: entity.id,
                      method: 'POST',
                      pathTemplate: `/api/${entName}`
                    })
                  }
                >
                  <span className="route-method post-method">POST</span>
                  <span className="route-path">/api/{entName}</span>
                </button>
              </div>
            )
          })}
        </div>

        {/* Sandbox details */}
        <div className="sandbox-main">
          {selectedRoute && (
            <div className="request-response-split">
              {/* Request Panel */}
              <div className="glass-card sandbox-panel">
                <div className="panel-section-title">Request Runner</div>
                <form onSubmit={handleSend} className="request-runner-form">
                  <div className="url-bar-wrapper">
                    <span className={`method-badge ${method === 'POST' ? 'post-badge' : 'get-badge'}`}>
                      {method}
                    </span>
                    <input
                      type="text"
                      className="form-input path-input"
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      disabled={isLoading}
                    />
                    <button type="submit" className="btn btn-primary send-btn" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      <span>Send</span>
                    </button>
                  </div>

                  {method === 'POST' && (
                    <div className="form-group" style={{ flex: 1, minHeight: '160px' }}>
                      <label htmlFor="payload-body">JSON Request Body</label>
                      <textarea
                        id="payload-body"
                        className={`form-input payload-textarea ${bodyError ? 'input-error' : ''}`}
                        value={bodyInput}
                        onChange={(e) => {
                          setBodyInput(e.target.value)
                          setBodyError('')
                        }}
                        disabled={isLoading}
                      />
                      {bodyError && <span className="error-text">{bodyError}</span>}
                    </div>
                  )}
                </form>

                {/* Snippets display */}
                <div className="snippet-section">
                  <CodeSnippet method={method} path={path} body={method === 'POST' ? bodyInput : undefined} />
                </div>
              </div>

              {/* Response Panel */}
              <div className="glass-card sandbox-panel response-panel">
                <div className="panel-section-title">Response Console</div>
                
                {isLoading ? (
                  <div className="response-loading">
                    <Loader2 size={28} className="animate-spin response-loader" />
                    <span>Executing simulated request...</span>
                  </div>
                ) : response ? (
                  <div className="response-output-container">
                    <div className="response-meta-row">
                      <div className="response-badge-group">
                        <span className={`status-badge ${getStatusClass(response.status)}`}>
                          {response.status} {response.statusText}
                        </span>
                        <span className="timing-badge">{response.timeMs} ms</span>
                      </div>
                    </div>
                    <div className="response-body-wrapper">
                      <pre>
                        {JSON.stringify(response.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="response-empty">
                    <Play size={28} className="response-empty-icon" />
                    <span>Send a request to see the API response output</span>
                  </div>
                )
                }
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
