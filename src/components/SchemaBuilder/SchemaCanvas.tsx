import { useState } from 'react'
import { Plus, Database } from 'lucide-react'
import { useSynqStore } from '../../store/useSynqStore'
import EntityCard from './EntityCard'
import FieldModal from './FieldModal'

export default function SchemaCanvas() {
  const { entities, addEntity } = useSynqStore()

  // Modal control states
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false)
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [selectedFieldId, setSelectedFieldId] = useState<string | undefined>(undefined)

  const handleAddEntity = () => {
    // Generate a unique default name
    const count = entities.length + 1
    let defaultName = `Entity_${count}`
    let suffix = 1
    
    while (entities.some((ent) => ent.name.toLowerCase() === defaultName.toLowerCase())) {
      defaultName = `Entity_${count}_${suffix}`
      suffix++
    }

    addEntity(defaultName)
  }

  const handleOpenAddField = (entityId: string) => {
    setSelectedEntityId(entityId)
    setSelectedFieldId(undefined)
    setIsFieldModalOpen(true)
  }

  const handleOpenEditField = (entityId: string, fieldId: string) => {
    setSelectedEntityId(entityId)
    setSelectedFieldId(fieldId)
    setIsFieldModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsFieldModalOpen(false)
    setSelectedEntityId(null)
    setSelectedFieldId(undefined)
  }

  return (
    <div className="tab-pane">
      {/* Header Toolbar */}
      <div className="pane-header">
        <div>
          <h2>Schema Builder</h2>
          <p className="subtitle">Define your database entities, properties, and foreign-key relations.</p>
        </div>
        {entities.length > 0 && (
          <button className="btn btn-primary" onClick={handleAddEntity}>
            <Plus size={16} />
            <span>Add Entity</span>
          </button>
        )}
      </div>

      {/* Main Canvas Area */}
      {entities.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrapper">
            <Database size={32} className="empty-icon animate-pulse" />
          </div>
          <h3>No Entities Defined</h3>
          <p>Create database models to begin generating relations and synthetic data schemas.</p>
          <button className="btn btn-primary btn-lg" onClick={handleAddEntity}>
            Create Entity
          </button>
        </div>
      ) : (
        <div className="schema-canvas-grid">
          {entities.map((entity) => (
            <EntityCard
              key={entity.id}
              entity={entity}
              onAddFieldClick={handleOpenAddField}
              onEditFieldClick={handleOpenEditField}
            />
          ))}
        </div>
      )}

      {/* Field Editor Dialog Modal */}
      {selectedEntityId && (
        <FieldModal
          isOpen={isFieldModalOpen}
          onClose={handleCloseModal}
          entityId={selectedEntityId}
          fieldIdToEdit={selectedFieldId}
        />
      )}
    </div>
  )
}
