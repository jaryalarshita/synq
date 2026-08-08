import { useState } from 'react'
import { Database, Table, Globe, HelpCircle, Plus, Eye, Sparkles } from 'lucide-react'

export default function App() {
  const [activeTab, setActiveTab] = useState<'schema' | 'data' | 'api'>('schema')

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
        </div>
        <div className="nav-actions">
          <a href="#docs" className="docs-link" title="Documentation">
            <HelpCircle size={20} />
          </a>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="workspace">
        {activeTab === 'schema' && (
          <div className="tab-pane">
            <div className="pane-header">
              <div>
                <h2>Schema Builder</h2>
                <p className="subtitle">Define your data models, fields, and relational mapping rules.</p>
              </div>
              <button className="btn btn-primary">
                <Plus size={16} />
                <span>Add Entity</span>
              </button>
            </div>
            
            <div className="empty-state">
              <div className="empty-icon-wrapper">
                <Database size={32} className="empty-icon animate-pulse" />
              </div>
              <h3>No Entities Created</h3>
              <p>Get started by creating your first relational database entity.</p>
              <button className="btn btn-primary btn-lg">Create First Entity</button>
            </div>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="tab-pane">
            <div className="pane-header">
              <div>
                <h2>Data Preview</h2>
                <p className="subtitle">Visualize, search, sort, and export generated synthetic records.</p>
              </div>
              <button className="btn btn-secondary">
                <Sparkles size={16} />
                <span>Generate Data</span>
              </button>
            </div>
            
            <div className="empty-state">
              <div className="empty-icon-wrapper">
                <Eye size={32} className="empty-icon" />
              </div>
              <h3>No Synthetic Data Available</h3>
              <p>Initialize or define a schema first, then generate records to see them in the grid.</p>
              <button className="btn btn-secondary btn-lg" onClick={() => setActiveTab('schema')}>
                Go to Schema Builder
              </button>
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="tab-pane">
            <div className="pane-header">
              <div>
                <h2>API Mock Sandbox</h2>
                <p className="subtitle">Simulate client requests directly against generated databases inside the browser.</p>
              </div>
            </div>
            
            <div className="empty-state">
              <div className="empty-icon-wrapper">
                <Globe size={32} className="empty-icon" />
              </div>
              <h3>Mock Server Not Initialized</h3>
              <p>Generate data for your entities to spin up standard simulated REST endpoints.</p>
              <button className="btn btn-primary btn-lg" onClick={() => setActiveTab('data')}>
                Generate Data First
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <span>Synq — Serverless Synthetic Data Engine</span>
        <span>Built with React + Vite + Zustand</span>
      </footer>
    </div>
  )
}
