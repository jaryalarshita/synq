import { useState } from 'react'
import { X, Download, FileText, Database as SqlIcon, Code, FileType2 } from 'lucide-react'
import { useSynqStore } from '../../store/useSynqStore'
import { exportToJSON, exportToCSV, exportToSQL, exportToFile } from '../../engine/exporters'
import { generateTypeScriptInterfaces } from '../../engine/typeExporter'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  activeEntityId: string | null
}

export default function ExportModal({ isOpen, onClose, activeEntityId }: ExportModalProps) {
  const { entities, generatedData } = useSynqStore()

  const [format, setFormat] = useState<'json' | 'csv' | 'sql' | 'ts'>('json')
  const [scope, setScope] = useState<'active' | 'all'>('active')

  if (!isOpen) return null

  const activeEntity = entities.find((e) => e.id === activeEntityId)
  if (!activeEntity) return null

  const handleExport = (e: React.FormEvent) => {
    e.preventDefault()

    const datasetName = 'synq_dataset'

    if (format === 'json') {
      if (scope === 'active') {
        const rows = generatedData[activeEntity.id] || []
        exportToJSON(rows, `${activeEntity.name.toLowerCase()}_data.json`)
      } else {
        // Map keys by entity name for readable JSON
        const allData: Record<string, any[]> = {}
        entities.forEach((ent) => {
          allData[ent.name] = generatedData[ent.id] || []
        })
        exportToJSON(allData, `${datasetName}.json`)
      }
    } else if (format === 'csv') {
      if (scope === 'active') {
        const headers = ['id', ...activeEntity.fields.map((f) => f.name)]
        const rows = generatedData[activeEntity.id] || []
        exportToCSV(headers, rows, `${activeEntity.name.toLowerCase()}_data.csv`)
      } else {
        // Trigger downloads for each table sequentially
        entities.forEach((ent) => {
          const headers = ['id', ...ent.fields.map((f) => f.name)]
          const rows = generatedData[ent.id] || []
          exportToCSV(headers, rows, `${ent.name.toLowerCase()}_data.csv`)
        })
      }
    } else if (format === 'ts') {
      // Types describe the schema, so the active-table scope exports just that
      // entity's interface and 'all' exports the whole module.
      const target = scope === 'active' ? [activeEntity] : entities
      const fileName = scope === 'active' ? `${activeEntity.name.toLowerCase()}.ts` : `${datasetName}.ts`
      exportToFile(generateTypeScriptInterfaces(target), fileName, 'text/plain;charset=utf-8;')
    } else if (format === 'sql') {
      if (scope === 'active') {
        exportToSQL([activeEntity], generatedData, `${activeEntity.name.toLowerCase()}_data.sql`)
      } else {
        exportToSQL(entities, generatedData, `${datasetName}.sql`)
      }
    }

    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card animate-fadeIn" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3>Export Dataset</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleExport} className="modal-form">
          {/* Format Radio Cards */}
          <div className="form-group">
            <label>Export Format</label>
            <div className="export-format-selector">
              <div
                className={`format-card ${format === 'json' ? 'active' : ''}`}
                onClick={() => setFormat('json')}
              >
                <Code size={20} className="format-icon" />
                <span className="format-title">JSON</span>
                <span className="format-desc">Raw object arrays</span>
              </div>
              <div
                className={`format-card ${format === 'csv' ? 'active' : ''}`}
                onClick={() => setFormat('csv')}
              >
                <FileText size={20} className="format-icon" />
                <span className="format-title">CSV</span>
                <span className="format-desc">Spreadsheet flat file</span>
              </div>
              <div
                className={`format-card ${format === 'sql' ? 'active' : ''}`}
                onClick={() => setFormat('sql')}
              >
                <SqlIcon size={20} className="format-icon" />
                <span className="format-title">SQL</span>
                <span className="format-desc">Relational Inserts</span>
              </div>
              <div
                className={`format-card ${format === 'ts' ? 'active' : ''}`}
                onClick={() => setFormat('ts')}
              >
                <FileType2 size={20} className="format-icon" />
                <span className="format-title">TypeScript</span>
                <span className="format-desc">Interface definitions</span>
              </div>
            </div>
          </div>

          {/* Scope selection */}
          <div className="form-group">
            <label>Dataset Scope</label>
            <div className="export-scope-selector">
              <div
                className={`scope-option ${scope === 'active' ? 'active' : ''}`}
                onClick={() => setScope('active')}
              >
                <div className="radio-dot"></div>
                <div className="scope-details">
                  <span className="scope-title">Active Table only ({activeEntity.name})</span>
                  <span className="scope-desc">Download records generated for this model.</span>
                </div>
              </div>
              <div
                className={`scope-option ${scope === 'all' ? 'active' : ''}`}
                onClick={() => setScope('all')}
              >
                <div className="radio-dot"></div>
                <div className="scope-details">
                  <span className="scope-title">All schema tables ({entities.length})</span>
                  <span className="scope-desc">
                    {format === 'sql'
                      ? 'Exports all tables sorted topologically to satisfy foreign key rules.'
                      : format === 'ts'
                        ? 'Exports an interface for every entity in one .ts module.'
                        : 'Downloads all model datasets.'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: 'var(--spacing-lg)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Download size={14} />
              <span>Download Files</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
