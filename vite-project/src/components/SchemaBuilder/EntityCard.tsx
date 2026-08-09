import { useState, useRef, useEffect } from 'react'
import { Edit2, Trash2, Plus, ArrowRight } from 'lucide-react'
import { useSynqStore } from '../../store/useSynqStore'
import type { Entity } from '../../store/useSynqStore'

interface EntityCardProps {
  entity: Entity
  onAddFieldClick: (entityId: string) => void
  onEditFieldClick: (entityId: string, fieldId: string) => void
}

export default function EntityCard({ entity, onAddFieldClick, onEditFieldClick }: EntityCardProps) {
  const { entities, updateEntityName, deleteEntity, deleteField } = useSynqStore()
  
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(entity.name)
  const [nameError, setNameError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setNameInput(entity.name)
  }, [entity.name])

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditingName])

  const handleSaveName = () => {
    const formatted = nameInput.trim()
    
    if (!formatted) {
      setNameInput(entity.name)
      setIsEditingName(false)
      setNameError('')
      return
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(formatted)) {
      setNameError('Invalid name format')
      inputRef.current?.focus()
      return
    }

    // Check if name is unique across other entities
    const isDuplicate = entities.some(
      (ent) => ent.name.toLowerCase() === formatted.toLowerCase() && ent.id !== entity.id
    )

    if (isDuplicate) {
      setNameError('Name must be unique')
      inputRef.current?.focus()
      return
    }

    updateEntityName(entity.id, formatted)
    setIsEditingName(false)
    setNameError('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName()
    } else if (e.key === 'Escape') {
      setNameInput(entity.name)
      setIsEditingName(false)
      setNameError('')
    }
  }

  const getTargetEntityName = (referenceId?: string) => {
    if (!referenceId) return 'deleted'
    return entities.find((ent) => ent.id === referenceId)?.name || 'deleted'
  }

  return (
    <div className="glass-card entity-card animate-fadeIn">
      {/* Entity Header */}
      <div className="entity-header">
        {isEditingName ? (
          <div className="entity-name-edit-wrapper">
            <input
              ref={inputRef}
              type="text"
              className={`entity-name-input ${nameError ? 'input-error' : ''}`}
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value)
                setNameError('')
              }}
              onBlur={handleSaveName}
              onKeyDown={handleKeyDown}
            />
            {nameError && <span className="entity-name-error">{nameError}</span>}
          </div>
        ) : (
          <div className="entity-name-display" onDoubleClick={() => setIsEditingName(true)}>
            <h4>{entity.name}</h4>
            <button className="icon-btn edit-name-btn" onClick={() => setIsEditingName(true)}>
              <Edit2 size={12} />
            </button>
          </div>
        )}
        <button 
          className="icon-btn delete-entity-btn" 
          onClick={() => deleteEntity(entity.id)}
          title="Delete Entity"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Fields List */}
      <div className="entity-fields-container">
        {entity.fields.length === 0 ? (
          <div className="empty-fields-text">No fields defined yet</div>
        ) : (
          <ul className="fields-list">
            {entity.fields.map((field) => (
              <li key={field.id} className="field-item">
                <div className="field-info">
                  <span className="field-name" title={field.name}>{field.name}</span>
                  {field.type === 'foreign_key' ? (
                    <span className="field-badge fk-badge">
                      fk <ArrowRight size={10} style={{ margin: '0 2px' }} /> {getTargetEntityName(field.referenceEntityId)}
                    </span>
                  ) : (
                    <span className={`field-badge ${field.type}-badge`}>
                      {field.type}
                    </span>
                  )}
                </div>
                <div className="field-actions">
                  <button 
                    className="icon-btn" 
                    onClick={() => onEditFieldClick(entity.id, field.id)}
                    title="Edit Field"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button 
                    className="icon-btn delete-field-btn" 
                    onClick={() => deleteField(entity.id, field.id)}
                    title="Delete Field"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Entity Footer */}
      <div className="entity-footer">
        <button 
          className="btn btn-secondary add-field-btn" 
          onClick={() => onAddFieldClick(entity.id)}
        >
          <Plus size={14} />
          <span>Add Field</span>
        </button>
      </div>
    </div>
  )
}
