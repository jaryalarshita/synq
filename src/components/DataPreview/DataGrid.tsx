import { useState } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useSynqStore } from '../../store/useSynqStore'

interface DataGridProps {
  entityId: string
}

export default function DataGrid({ entityId }: DataGridProps) {
  const { entities, generatedData } = useSynqStore()

  const entity = entities.find((e) => e.id === entityId)
  const rows = generatedData[entityId] || []

  // Local state for search, sort, and pagination
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<string>('id')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)

  // Reset page to 1 whenever the search query changes, without a
  // dedicated effect (React's "adjust state during render" pattern —
  // avoids the extra render an effect-based reset would cause).
  const [lastSearchQuery, setLastSearchQuery] = useState(searchQuery)
  if (searchQuery !== lastSearchQuery) {
    setLastSearchQuery(searchQuery)
    setCurrentPage(1)
  }

  const pageSize = 25

  if (!entity) return null

  // 1. Gather all columns
  const columns = ['id', ...entity.fields.map((f) => f.name)]

  // 2. Filter rows by search query
  const filteredRows = rows.filter((row) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    
    // Check if query exists in any column value of the row
    return columns.some((colName) => {
      const val = row[colName]
      if (val === null || val === undefined) return false
      return String(val).toLowerCase().includes(query)
    })
  })

  // 3. Sort filtered rows
  const sortedRows = [...filteredRows].sort((a, b) => {
    const valA = a[sortColumn]
    const valB = b[sortColumn]

    if (valA === null || valA === undefined) return sortDirection === 'asc' ? 1 : -1
    if (valB === null || valB === undefined) return sortDirection === 'asc' ? -1 : 1

    let comparison: number
    if (typeof valA === 'number' && typeof valB === 'number') {
      comparison = valA - valB
    } else if (typeof valA === 'boolean' && typeof valB === 'boolean') {
      comparison = valA === valB ? 0 : valA ? 1 : -1
    } else {
      comparison = String(valA).localeCompare(String(valB))
    }

    return sortDirection === 'asc' ? comparison : -comparison
  })

  // 4. Paginate sorted rows
  const totalRows = sortedRows.length
  const totalPages = Math.ceil(totalRows / pageSize) || 1
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalRows)
  const paginatedRows = sortedRows.slice(startIndex, endIndex)

  const handleHeaderClick = (colName: string) => {
    if (sortColumn === colName) {
      // Toggle direction
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      // Set new column, default direction asc
      setSortColumn(colName)
      setSortDirection('asc')
    }
  }

  const renderSortIcon = (colName: string) => {
    if (sortColumn !== colName) {
      return <ChevronsUpDown size={12} className="sort-icon-inactive" />
    }
    return sortDirection === 'asc' ? (
      <ChevronUp size={12} className="sort-icon-active" />
    ) : (
      <ChevronDown size={12} className="sort-icon-active" />
    )
  }

  const renderCellValue = (value: any) => {
    if (value === null || value === undefined) {
      return <span className="cell-null">NULL</span>
    }
    if (typeof value === 'boolean') {
      return (
        <span className={`cell-boolean ${value ? 'boolean-true' : 'boolean-false'}`}>
          {value ? 'true' : 'false'}
        </span>
      )
    }
    return String(value)
  }

  return (
    <div className="grid-container">
      {/* Grid Toolbar */}
      <div className="grid-toolbar">
        <div className="search-box-wrapper">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="grid-meta">
          Showing {totalRows === 0 ? 0 : startIndex + 1}–{endIndex} of {totalRows} records
        </div>
      </div>

      {/* Grid Table Container */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((colName) => (
                <th key={colName} onClick={() => handleHeaderClick(colName)} className="sortable-th">
                  <div className="th-content">
                    <span>{colName}</span>
                    {renderSortIcon(colName)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="no-rows-cell">
                  No records match your filters.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, idx) => (
                <tr key={row.id || idx}>
                  {columns.map((colName) => (
                    <td key={colName} title={String(row[colName] ?? '')}>
                      {renderCellValue(row[colName])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Grid Pagination footer */}
      {totalPages > 1 && (
        <div className="grid-pagination">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <div className="pagination-info">
            Page {currentPage} of {totalPages}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
