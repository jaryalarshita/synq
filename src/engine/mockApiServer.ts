import type { Entity } from '../store/useSynqStore'

export interface MockApiResponse {
  status: number
  statusText: string
  data: any
  timeMs: number
}

/**
 * Parses a query string (e.g. "limit=5&role=admin") into a key-value record.
 */
function parseQueryParams(queryString: string): Record<string, string> {
  const params: Record<string, string> = {}
  if (!queryString) return params

  const pairs = queryString.split('&')
  for (const pair of pairs) {
    const [key, value] = pair.split('=')
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '')
    }
  }
  return params
}

/**
 * Simulates a server-side REST API request against local Zustand datasets.
 * Measures response timing and introduces randomized simulated network delay.
 */
export async function simulateApiRequest(
  method: 'GET' | 'POST',
  path: string,
  body: string | undefined,
  entities: Entity[],
  generatedData: Record<string, any[]>,
  addRecord: (entityId: string, record: any) => void
): Promise<MockApiResponse> {
  const startTime = performance.now()
  
  // Simulated network latency: random delay between 80ms and 240ms
  const latency = Math.floor(Math.random() * 160) + 80
  await new Promise((resolve) => setTimeout(resolve, latency))

  try {
    // 1. Split path into parts, ignoring query parameters during route matching
    const queryIndex = path.indexOf('?')
    let cleanPath = path
    let queryString = ''
    
    if (queryIndex !== -1) {
      cleanPath = path.substring(0, queryIndex)
      queryString = path.substring(queryIndex + 1)
    }

    const queryParams = parseQueryParams(queryString)
    const parts = cleanPath.replace(/^\/|\/$/g, '').split('/')

    // Check base path: must start with /api
    if (parts[0] !== 'api' || parts.length < 2) {
      const duration = Math.round(performance.now() - startTime)
      return {
        status: 404,
        statusText: 'Not Found',
        data: { error: 'Invalid API base path. Mock endpoints start with /api/[entity_name]' },
        timeMs: duration
      }
    }

    const entityName = parts[1]
    const recordId = parts[2] // undefined for GET list / POST

    // 2. Identify target entity schema
    const entity = entities.find((ent) => ent.name.toLowerCase() === entityName.toLowerCase())
    if (!entity) {
      const duration = Math.round(performance.now() - startTime)
      return {
        status: 404,
        statusText: 'Not Found',
        data: { error: `Entity '${entityName}' not found in schema definitions.` },
        timeMs: duration
      }
    }

    const rows = generatedData[entity.id] || []

    // 3. GET /api/:entity or /api/:entity/:id
    if (method === 'GET') {
      if (recordId) {
        // Individual record lookup
        const row = rows.find((r) => r.id === recordId)
        const duration = Math.round(performance.now() - startTime)
        
        if (row) {
          return {
            status: 200,
            statusText: 'OK',
            data: row,
            timeMs: duration
          }
        } else {
          return {
            status: 404,
            statusText: 'Not Found',
            data: { error: `Record with ID '${recordId}' not found in entity '${entity.name}'.` },
            timeMs: duration
          }
        }
      } else {
        // List records (supports search, column filters, page pagination)
        let filtered = [...rows]

        // Global Search parameter: `?search=john`
        if (queryParams.search) {
          const searchVal = queryParams.search.toLowerCase()
          filtered = filtered.filter((row) =>
            Object.values(row).some((cell) =>
              String(cell).toLowerCase().includes(searchVal)
            )
          )
        }

        // Column filters: e.g. `?role=admin` or `?age=25`
        const reservedParams = ['limit', 'page', 'search']
        for (const [key, val] of Object.entries(queryParams)) {
          if (reservedParams.includes(key)) continue
          
          // Check if this is a valid field name in the schema
          const fieldExists = ['id', ...entity.fields.map(f => f.name)].some(
            name => name.toLowerCase() === key.toLowerCase()
          )

          if (fieldExists) {
            filtered = filtered.filter((row) => {
              // Find matching key case-sensitively
              const actualKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase())
              if (!actualKey) return false
              return String(row[actualKey]).toLowerCase() === val.toLowerCase()
            })
          }
        }

        // Pagination: `?limit=10&page=2`
        const limitVal = parseInt(queryParams.limit)
        const pageVal = parseInt(queryParams.page) || 1
        
        if (!isNaN(limitVal) && limitVal > 0) {
          const start = (pageVal - 1) * limitVal
          const end = start + limitVal
          filtered = filtered.slice(start, end)
        }

        const duration = Math.round(performance.now() - startTime)
        return {
          status: 200,
          statusText: 'OK',
          data: filtered,
          timeMs: duration
        }
      }
    }

    // 4. POST /api/:entity
    if (method === 'POST') {
      if (recordId) {
        const duration = Math.round(performance.now() - startTime)
        return {
          status: 405,
          statusText: 'Method Not Allowed',
          data: { error: 'Method POST is not allowed on individual record paths.' },
          timeMs: duration
        }
      }

      // Parse JSON body
      let parsedBody: Record<string, any> = {}
      try {
        parsedBody = JSON.parse(body || '{}')
      } catch {
        const duration = Math.round(performance.now() - startTime)
        return {
          status: 400,
          statusText: 'Bad Request',
          data: { error: 'Malformed JSON payload body.' },
          timeMs: duration
        }
      }

      // Basic validation checks
      const validationErrors: Record<string, string> = {}
      
      for (const field of entity.fields) {
        const fieldVal = parsedBody[field.name]

        // Type checking: check basic formatting
        if (fieldVal !== undefined && fieldVal !== null) {
          if (field.type === 'email' && typeof fieldVal === 'string') {
            if (!fieldVal.includes('@')) {
              validationErrors[field.name] = 'Invalid email formatting'
            }
          }
          if ((field.type === 'number' || field.type === 'currency') && isNaN(Number(fieldVal))) {
            validationErrors[field.name] = 'Value must be a valid number'
          }
          if (field.type === 'boolean' && typeof fieldVal !== 'boolean') {
            validationErrors[field.name] = 'Value must be a boolean'
          }
          if (field.type === 'enum' && field.options) {
            if (!field.options.includes(String(fieldVal))) {
              validationErrors[field.name] = `Value must be one of: ${field.options.join(', ')}`
            }
          }
        }
      }

      if (Object.keys(validationErrors).length > 0) {
        const duration = Math.round(performance.now() - startTime)
        return {
          status: 400,
          statusText: 'Bad Request',
          data: { error: 'Schema validation failed', details: validationErrors },
          timeMs: duration
        }
      }

      // Construct new record
      const newRecord: Record<string, any> = {
        id: crypto.randomUUID() // Standard random identifier
      }

      // Set properties, mapping omitted values to null/defaults
      for (const field of entity.fields) {
        const val = parsedBody[field.name]
        newRecord[field.name] = val !== undefined ? val : null
      }

      // Persist record to store
      addRecord(entity.id, newRecord)

      const duration = Math.round(performance.now() - startTime)
      return {
        status: 201,
        statusText: 'Created',
        data: newRecord,
        timeMs: duration
      }
    }

    // Default catch-all status
    const duration = Math.round(performance.now() - startTime)
    return {
      status: 405,
      statusText: 'Method Not Allowed',
      data: { error: `HTTP method '${method}' is not supported.` },
      timeMs: duration
    }

  } catch (err: any) {
    const duration = Math.round(performance.now() - startTime)
    return {
      status: 500,
      statusText: 'Internal Server Error',
      data: { error: err.message || 'An unexpected simulator error occurred.' },
      timeMs: duration
    }
  }
}
