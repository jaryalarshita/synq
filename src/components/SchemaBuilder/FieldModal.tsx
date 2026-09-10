import { useState } from 'react'
import { X } from 'lucide-react'
import { useSynqStore } from '../../store/useSynqStore'
import type { SchemaField, DistributionKind, NumericDistribution } from '../../store/useSynqStore'

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

  // Advanced generation rules (v2). Empty strings mean "use the built-in
  // heuristics", so an untouched field behaves exactly as it did before.
  const [distributionKind, setDistributionKind] = useState<'' | DistributionKind>('')
  const [distMin, setDistMin] = useState('')
  const [distMax, setDistMax] = useState('')
  const [distMean, setDistMean] = useState('')
  const [distStdDev, setDistStdDev] = useState('')
  const [weightsRaw, setWeightsRaw] = useState('')
  const [pattern, setPattern] = useState('')

  // Populate the form whenever the modal opens for a (possibly different)
  // field. Adjusted during render instead of via an effect: React docs
  // recommend this "reset on prop change" pattern over an effect + extra
  // render, and it avoids a setState-in-effect lint warning.
  const openKey = isOpen ? `${entityId}:${fieldIdToEdit ?? 'new'}` : null
  const [lastOpenKey, setLastOpenKey] = useState<string | null>(null)
  if (openKey !== null && openKey !== lastOpenKey) {
    setLastOpenKey(openKey)
    if (isEditMode && fieldToEdit) {
      setName(fieldToEdit.name)
      setType(fieldToEdit.type)
      setOptionsRaw(fieldToEdit.options?.join(', ') || '')
      setReferenceEntityId(fieldToEdit.referenceEntityId || '')

      const dist = fieldToEdit.distribution
      setDistributionKind(dist?.kind ?? '')
      setDistMin(dist?.min !== undefined ? String(dist.min) : '')
      setDistMax(dist?.max !== undefined ? String(dist.max) : '')
      setDistMean(dist?.mean !== undefined ? String(dist.mean) : '')
      setDistStdDev(dist?.stdDev !== undefined ? String(dist.stdDev) : '')
      setWeightsRaw(fieldToEdit.weights?.join(', ') || '')
      setPattern(fieldToEdit.pattern || '')
    } else {
      setName('')
      setType('string')
      setOptionsRaw('')
      setReferenceEntityId(entities.find((e) => e.id !== entityId)?.id || '')
      setDistributionKind('')
      setDistMin('')
      setDistMax('')
      setDistMean('')
      setDistStdDev('')
      setWeightsRaw('')
      setPattern('')
    }
    setErrors({})
  }

  if (!isOpen || !parentEntity) return null

  const isNumeric = type === 'number' || type === 'currency'

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

    // Distribution checks (number/currency only)
    if (isNumeric && distributionKind === 'uniform') {
      const min = Number(distMin)
      const max = Number(distMax)
      if (distMin.trim() === '' || distMax.trim() === '' || isNaN(min) || isNaN(max)) {
        newErrors.distribution = 'Uniform distribution needs a numeric min and max'
      } else if (min > max) {
        newErrors.distribution = 'Min must be less than or equal to max'
      }
    }

    if (isNumeric && distributionKind === 'normal') {
      const mean = Number(distMean)
      const stdDev = Number(distStdDev)
      if (distMean.trim() === '' || isNaN(mean)) {
        newErrors.distribution = 'Normal distribution needs a numeric mean'
      } else if (distStdDev.trim() === '' || isNaN(stdDev) || stdDev <= 0) {
        newErrors.distribution = 'Standard deviation must be a number greater than 0'
      }
    }

    // Enum weight checks — weights are optional, but must line up when given
    if (type === 'enum' && weightsRaw.trim()) {
      const optionCount = optionsRaw.split(',').map((o) => o.trim()).filter(Boolean).length
      const parsed = weightsRaw.split(',').map((w) => Number(w.trim()))

      if (parsed.some(isNaN)) {
        newErrors.weights = 'Weights must be comma-separated numbers'
      } else if (parsed.length !== optionCount) {
        newErrors.weights = `Expected ${optionCount} weights to match the options, got ${parsed.length}`
      } else if (parsed.some((w) => w < 0)) {
        newErrors.weights = 'Weights cannot be negative'
      } else if (parsed.reduce((sum, w) => sum + w, 0) <= 0) {
        newErrors.weights = 'At least one weight must be greater than 0'
      }
    }

    // Regex pattern check (string only) — caught here so a bad pattern never
    // reaches the generator, where it would produce NULLs.
    if (type === 'string' && pattern.trim()) {
      try {
        new RegExp(pattern)
      } catch {
        newErrors.pattern = 'Not a valid regular expression'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    // Assemble the optional distribution, omitting blank inputs so the
    // generator falls back to its heuristics for anything left unset.
    let distribution: NumericDistribution | undefined
    if (isNumeric && distributionKind) {
      const numeric = (raw: string) => (raw.trim() === '' ? undefined : Number(raw))
      distribution =
        distributionKind === 'normal'
          ? {
              kind: 'normal',
              mean: numeric(distMean),
              stdDev: numeric(distStdDev),
              min: numeric(distMin),
              max: numeric(distMax)
            }
          : { kind: 'uniform', min: numeric(distMin), max: numeric(distMax) }
    }

    const weights =
      type === 'enum' && weightsRaw.trim()
        ? weightsRaw.split(',').map((w) => Number(w.trim()))
        : undefined

    const fieldData: Omit<SchemaField, 'id'> = {
      name: name.trim(),
      type,
      ...(type === 'enum' && {
        options: optionsRaw
          .split(',')
          .map((opt) => opt.trim())
          .filter((opt) => opt.length > 0)
      }),
      ...(type === 'foreign_key' && { referenceEntityId }),
      // Always set these three: updateField merges partially, so omitting a
      // key would leave a stale rule behind when one is cleared or the field
      // type changes (e.g. enum weights surviving a switch to string).
      distribution,
      weights,
      pattern: type === 'string' && pattern.trim() ? pattern.trim() : undefined
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

              <label htmlFor="field-weights" style={{ marginTop: 'var(--spacing-md)' }}>
                Weights (optional)
              </label>
              <input
                id="field-weights"
                type="text"
                className={`form-input ${errors.weights ? 'input-error' : ''}`}
                placeholder="e.g. 80, 15, 5"
                value={weightsRaw}
                onChange={(e) => setWeightsRaw(e.target.value)}
              />
              <span className="help-text">
                One number per option, in the same order. Leave blank for an even split.
              </span>
              {errors.weights && <span className="error-text">{errors.weights}</span>}
            </div>
          )}

          {isNumeric && (
            <div className="form-group">
              <label htmlFor="field-distribution">Value Distribution</label>
              <select
                id="field-distribution"
                className="form-select"
                value={distributionKind}
                onChange={(e) => setDistributionKind(e.target.value as '' | DistributionKind)}
              >
                <option value="">Smart defaults (based on field name)</option>
                <option value="uniform">Uniform (even across a range)</option>
                <option value="normal">Normal (bell curve around a mean)</option>
              </select>

              {distributionKind === 'uniform' && (
                <div className="dist-input-row">
                  <div className="dist-input">
                    <label htmlFor="field-dist-min">Min</label>
                    <input
                      id="field-dist-min"
                      type="number"
                      className="form-input"
                      value={distMin}
                      onChange={(e) => setDistMin(e.target.value)}
                    />
                  </div>
                  <div className="dist-input">
                    <label htmlFor="field-dist-max">Max</label>
                    <input
                      id="field-dist-max"
                      type="number"
                      className="form-input"
                      value={distMax}
                      onChange={(e) => setDistMax(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {distributionKind === 'normal' && (
                <>
                  <div className="dist-input-row">
                    <div className="dist-input">
                      <label htmlFor="field-dist-mean">Mean</label>
                      <input
                        id="field-dist-mean"
                        type="number"
                        className="form-input"
                        value={distMean}
                        onChange={(e) => setDistMean(e.target.value)}
                      />
                    </div>
                    <div className="dist-input">
                      <label htmlFor="field-dist-stddev">Std Dev</label>
                      <input
                        id="field-dist-stddev"
                        type="number"
                        className="form-input"
                        value={distStdDev}
                        onChange={(e) => setDistStdDev(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="dist-input-row">
                    <div className="dist-input">
                      <label htmlFor="field-dist-clamp-min">Clamp Min (optional)</label>
                      <input
                        id="field-dist-clamp-min"
                        type="number"
                        className="form-input"
                        value={distMin}
                        onChange={(e) => setDistMin(e.target.value)}
                      />
                    </div>
                    <div className="dist-input">
                      <label htmlFor="field-dist-clamp-max">Clamp Max (optional)</label>
                      <input
                        id="field-dist-clamp-max"
                        type="number"
                        className="form-input"
                        value={distMax}
                        onChange={(e) => setDistMax(e.target.value)}
                      />
                    </div>
                  </div>
                  <span className="help-text">
                    Clamps keep outliers in range — a bell curve is otherwise unbounded.
                  </span>
                </>
              )}

              {errors.distribution && <span className="error-text">{errors.distribution}</span>}
            </div>
          )}

          {type === 'string' && (
            <div className="form-group">
              <label htmlFor="field-pattern">Regex Pattern (optional)</label>
              <input
                id="field-pattern"
                type="text"
                className={`form-input ${errors.pattern ? 'input-error' : ''}`}
                placeholder="e.g. [A-Z]{3}-[0-9]{4}"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
              />
              <span className="help-text">
                Generates values matching this expression instead of the name-based defaults.
              </span>
              {errors.pattern && <span className="error-text">{errors.pattern}</span>}
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
