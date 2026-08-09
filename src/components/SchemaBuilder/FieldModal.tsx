import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useSynqStore } from '../../store/useSynqStore'
import type { SchemaField } from '../../store/useSynqStore'

interface FieldModalProps {
  isOpen: boolean
  onClose: () => void
  entityId: string
  fieldIdToEdit?: string
}

export default function FieldModal({ isOpen, onClose, entityId, fieldIdToEdit }: FieldModalProps) {
  const { entities, addField, updateField } = useSynqStore()

  const parentEntity = entities.find((ent) => ent.id === entityId)
  const isEditMode = !!fieldIdToEdit
  const fieldToEdit = parentEntity?.fields.find((f) => f.id === fieldIdToEdit)

  const [name, setName] = useState('')
  const [type, setType] = useState<SchemaField['type']>('string')
  const [optionsRaw, setOptionsRaw] = useState('')
  const [referenceEntityId, setReferenceEntityId] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Populate data when editing
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && fieldToEdit) {
        setName(fieldToEdit.name)
        setType(fieldToEdit.type)
        setOptionsRaw(fieldToEdit.options?.join(', ') || '')
        setReferenceEntityId(fieldToEdit.referenceEntityId || '')
        setErrors({})
      } else {
        setName('')
        setType('string')
        setOptionsRaw('')
        setReferenceEntityId(entities.find(e => e.id !== entityId)?.id || '')
        setErrors({})
      }
    }
  }, [isOpen, isEditMode, fieldToEdit, entities, entityId])

  if (!isOpen || !parentEntity) return null

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Name checks
    if (!name.trim()) {
      newErrors.name = 'Field name is required'
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name.trim())) {
      newErrors.name = 'Must start with a letter/underscore and contain only letters, numbers, and underscores'
    } else {
      // Check for uniqueness within the entity
      const isDuplicate = parentEntity.fields.some(
        (f) => f.name.toLowerCase() === name.trim().toLowerCase() && f.id !== fieldIdToEdit
      )
      if (isDuplicate) {
        newErrors.name = 'A field with this name already exists in this entity'
      }
    }

    // Enum checks
    if (type === 'enum' && !optionsRaw.trim()) {
      newErrors.options = 'At least one option is required'
    }

    // Foreign Key checks
    if (type === 'foreign_key') {
      if (!referenceEntityId) {
        newErrors.reference = 'Target entity is required'
      } else if (referenceEntityId === entityId) {
        newErrors.reference = 'Cannot create a foreign key to the same entity in MVP'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    const fieldData: Omit<SchemaField, 'id'> = {
      name: name.trim(),
      type,
      ...(type === 'enum' && {
        options: optionsRaw
          .split(',')
          .map((opt) => opt.trim())
          .filter((opt) => opt.length > 0)
      }),
      ...(type === 'foreign_key' && { referenceEntityId })
    }

    if (isEditMode && fieldIdToEdit) {
      updateField(entityId, fieldIdToEdit, fieldData)
    } else {
      addField(entityId, fieldData)
    }

    onClose()
  }

  // Filter out current entity for FK target candidates
  const fkTargetEntities = entities.filter((ent) => ent.id !== entityId)

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card animate-fadeIn">
        <div className="modal-header">
          <h3>{isEditMode ? 'Edit Field' : 'Add Field'}</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="field-name">Field Name</label>
            <input
              id="field-name"
              type="text"
              className={`form-input ${errors.name ? 'input-error' : ''}`}
              placeholder="e.g. email, created_at, user_id"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="field-type">Field Type</label>
            <select
              id="field-type"
              className="form-select"
              value={type}
              onChange={(e) => setType(e.target.value as SchemaField['type'])}
            >
              <option value="string">String (Text)</option>
              <option value="uuid">UUID (Identifier)</option>
              <option value="email">Email</option>
              <option value="number">Number</option>
              <option value="currency">Currency</option>
              <option value="date">Date</option>
              <option value="boolean">Boolean</option>
              <option value="enum">Enum (Select Options)</option>
              <option value="foreign_key">Foreign Key (Relation)</option>
            </select>
          </div>

          {type === 'enum' && (
            <div className="form-group">
              <label htmlFor="field-options">Enum Options (comma-separated)</label>
              <input
                id="field-options"
                type="text"
                className={`form-input ${errors.options ? 'input-error' : ''}`}
                placeholder="e.g. admin, manager, user"
                value={optionsRaw}
                onChange={(e) => setOptionsRaw(e.target.value)}
              />
              <span className="help-text">Input values separated by commas. Spaces will be trimmed.</span>
              {errors.options && <span className="error-text">{errors.options}</span>}
            </div>
          )}

          {type === 'foreign_key' && (
            <div className="form-group">
              <label htmlFor="field-reference">References Entity</label>
              {fkTargetEntities.length === 0 ? (
                <div className="warning-box">
                  Create another entity first to map a foreign key relationship.
                </div>
              ) : (
                <select
                  id="field-reference"
                  className={`form-select ${errors.reference ? 'input-error' : ''}`}
                  value={referenceEntityId}
                  onChange={(e) => setReferenceEntityId(e.target.value)}
                >
                  <option value="" disabled>Select target entity...</option>
                  {fkTargetEntities.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.name} (id)
                    </option>
                  ))}
                </select>
              )}
              {errors.reference && <span className="error-text">{errors.reference}</span>}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={type === 'foreign_key' && fkTargetEntities.length === 0}
            >
              {isEditMode ? 'Save Changes' : 'Add Field'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
