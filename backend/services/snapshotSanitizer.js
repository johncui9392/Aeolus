/**
 * 入库前收缩 result_payload，避免 SQLite 单条过大（借鉴 Aeolus-commercial）
 */

const MAX_SNAPSHOT_JSON_CHARS = 3_500_000
const RAW_OUTPUT_MAX = 400_000

export function sanitizeResultForSnapshot(result) {
  if (result == null) return null
  let o
  try {
    o = JSON.parse(JSON.stringify(result))
  } catch {
    return { _serializationFailed: true }
  }

  if (typeof o.rawOutput === 'string' && o.rawOutput.length > RAW_OUTPUT_MAX) {
    o.rawOutput = `${o.rawOutput.slice(0, RAW_OUTPUT_MAX)}\n…[truncated]`
  }

  const shrinkSheets = (maxRowsPerSheet) => {
    if (!Array.isArray(o.sheets)) return
    o.sheets = o.sheets.map((s) => {
      const rows = Array.isArray(s.rows) ? s.rows : []
      const slice = rows.slice(0, maxRowsPerSheet)
      return {
        name: s.name,
        headers: s.headers,
        rows: slice,
        rowCount: s.rowCount ?? rows.length,
        _rowsTruncated: rows.length > slice.length
      }
    })
    o._snapshotNote = `sheets truncated to ${maxRowsPerSheet} rows/sheet for storage`
  }

  const stringifyLen = () => {
    try {
      return JSON.stringify(o).length
    } catch {
      return Number.POSITIVE_INFINITY
    }
  }

  let n = stringifyLen()
  if (n > MAX_SNAPSHOT_JSON_CHARS) shrinkSheets(200)
  n = stringifyLen()
  if (n > MAX_SNAPSHOT_JSON_CHARS) shrinkSheets(50)
  n = stringifyLen()
  if (n > MAX_SNAPSHOT_JSON_CHARS) {
    delete o.rawOutput
    delete o.sheets
    o._truncated = true
    o._truncatedReason = 'payload exceeded storage limit'
  }

  return o
}
