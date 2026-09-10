import { useState } from 'react'
import { Database, Table, Globe, Activity, HelpCircle, Eye, Sparkles, AlertCircle, Trash2, Loader2, Download } from 'lucide-react'
import SchemaCanvas from './components/SchemaBuilder/SchemaCanvas'
import DataGrid from './components/DataPreview/DataGrid'
import ExportModal from './components/DataPreview/ExportModal'
import EndpointRunner from './components/APIMockSandbox/EndpointRunner'
import TrafficDashboard from './components/Observability/TrafficDashboard'
import { useSynqStore } from './store/useSynqStore'

export default function App() {
  const [activeTab, setActiveTab] = useState<'schema' | 'data' | 'api' | 'observability'>('schema')
  const {
    entities,
    generatedData,
    isGenerating,
    setGeneratedData,
    clearGeneratedData,
    setIsGenerating
  } = useSynqStore()

  const [recordCount, setRecordCount] = useState(100)
  const [errorMsg, setErrorMsg] = useState('')
  const [selectedPreviewEntityId, setSelectedPreviewEntityId] = useState<string | null>(null)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)

  const handleGenerate = () => {
    setErrorMsg('')
    setIsGenerating(true)
    
    // Smooth delay for loading state visibility
    setTimeout(async () => {
      try {
        // Loaded on demand so the Faker bundle stays out of the initial page load
        const { generateSyntheticData } = await import('./engine/dataGenerator')
        const data = generateSyntheticData(entities, recordCount)
        setGeneratedData(data)
        if (entities.length > 0) {
          // Select the first entity automatically for preview
          setSelectedPreviewEntityId(entities[0].id)
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'An error occurred during data generation.')
      } finally {
        setIsGenerating(false)
      }
    }, 600)
  }

  return (
    <div className="app-container">
      {/* Navbar */}
      <header className="navbar">
        <div className="brand">
          <Database className="brand-icon" />
          <span className="brand-name">Synq</span>
        </div>
        <div className="nav-links">
          <button
            className={`nav-btn ${activeTab === 'schema' ? 'active' : ''}`}
            onClick={() => setActiveTab('schema')}
          >
            <Database size={16} />
            <span>Schema Builder</span>
          </button>
          <button
            className={`nav-btn ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            <Table size={16} />
            <span>Data Preview</span>
          </button>
          <button
            className={`nav-btn ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
          >
            <Globe size={16} />
            <span>API Mock Sandbox</span>
          </button>
          <button
            className={`nav-btn ${activeTab === 'observability' ? 'active' : ''}`}
            onClick={() => setActiveTab('observability')}
          >
            <Activity size={16} />
            <span>Observability</span>
          </button>
        </div>
        <div className="nav-actions">
          <button
            type="button"
            className="docs-link"
            title="About Synq"
            aria-expanded={isAboutOpen}
            onClick={() => setIsAboutOpen((prev) => !prev)}
          >
            <HelpCircle size={20} />
          </button>
          {isAboutOpen && (
            <div className="about-popover glass-card animate-fadeIn" role="dialog" aria-label="About Synq">
              <h4>About Synq</h4>
              <p>
                Synq is a serverless developer tool that runs entirely in your browser: visually design
                relational schemas, generate realistic synthetic data with real foreign-key integrity,
                preview/export it, and exercise a mock REST API — no backend required.
              </p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsAboutOpen(false)}>
                Got it
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <main className="workspace">
        {activeTab === 'schema' && <SchemaCanvas />}

        {activeTab === 'data' && (
          <div className="tab-pane">
            <div className="pane-header">
              <div>
                <h2>Data Preview</h2>
                <p className="subtitle">Visualize, search, sort, and export generated synthetic records.</p>
              </div>
              {entities.length > 0 && (
                <div className="generation-controls">
                  <div className="control-group">
                    <label htmlFor="record-count-input">Count</label>
                    <input
                      id="record-count-input"
                      type="number"
                      min="1"
                      max="1000"
                      className="form-input record-count-input"
                      value={recordCount}
                      onChange={(e) => setRecordCount(Math.min(1000, Math.max(1, parseInt(e.target.value) || 1)))}
                      disabled={isGenerating}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    <span>{isGenerating ? 'Generating...' : 'Generate Data'}</span>
                  </button>
                  {Object.keys(generatedData).length > 0 && (
                    <>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setIsExportOpen(true)}
                        disabled={isGenerating}
                      >
                        <Download size={16} />
                        <span>Export</span>
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          clearGeneratedData()
                          setErrorMsg('')
                          setSelectedPreviewEntityId(null)
                        }}
                        disabled={isGenerating}
                        title="Clear Generated Data"
                      >
                        <Trash2 size={16} />
                        <span>Clear</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="error-banner animate-fadeIn">
                <AlertCircle size={18} />
                <span>{errorMsg}</span>
              </div>
            )}

            {entities.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon-wrapper">
                  <Database size={32} className="empty-icon" />
                </div>
                <h3>No Entities Defined</h3>
                <p>Go to the Schema Builder first to define your database tables and relations.</p>
                <button className="btn btn-primary btn-lg" onClick={() => setActiveTab('schema')}>
                  Go to Schema Builder
                </button>
              </div>
            ) : Object.keys(generatedData).length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon-wrapper">
                  <Eye size={32} className="empty-icon" />
                </div>
                <h3>No Synthetic Data Available</h3>
                <p>Configure the record count above and click "Generate Data" to populate your models.</p>
              </div>
            ) : (
              <div className="data-preview-layout animate-fadeIn">
                {/* Entity Navigation Sidebar */}
                <div className="data-preview-sidebar glass-card">
                  {entities.map((entity) => {
                    const rowCount = generatedData[entity.id]?.length || 0
                    const isActive = selectedPreviewEntityId === entity.id
                    return (
                      <button
                        key={entity.id}
                        className={`sidebar-item ${isActive ? 'active' : ''}`}
                        onClick={() => setSelectedPreviewEntityId(entity.id)}
                      >
                        <span className="sidebar-entity-name">{entity.name}</span>
                        <span className="sidebar-row-count">{rowCount} rows</span>
                      </button>
                    )
                  })}
                </div>

                {/* Data Preview content */}
                <div className="data-preview-content">
                  {selectedPreviewEntityId && (
                    // key remounts the grid on entity switch, resetting its
                    // internal search/sort/pagination state for free.
                    <DataGrid key={selectedPreviewEntityId} entityId={selectedPreviewEntityId} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'api' && <EndpointRunner />}

        {activeTab === 'observability' && <TrafficDashboard />}
      </main>

      {/* Export Modal overlay */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        activeEntityId={selectedPreviewEntityId}
      />

      {/* Footer */}
      <footer className="app-footer">
        <span>Synq — Serverless Synthetic Data Engine</span>
        <span>Built with React + Vite + Zustand</span>
      </footer>
    </div>
  )
}
