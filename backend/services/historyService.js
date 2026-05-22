/**
 * 本地 SQLite 查询历史：写入 / 列表 / 详情
 */
import { randomUUID } from 'crypto'
import { getDb } from '../db/initDb.js'
import { sanitizeResultForSnapshot } from './snapshotSanitizer.js'

const MAX_INPUT_QUERY = 10_000
const MAX_ERROR_MSG = 8000
const DEFAULT_LIST_LIMIT = 50

function rowToListItem(row) {
  return {
    id: row.id,
    created_at: row.created_at,
    skill_id: row.skill_id,
    skill_name: row.skill_name,
    vendor: row.vendor || 'mx',
    select_type: row.select_type || '',
    input_query: row.input_query || '',
    success: !!row.success,
    error_message: row.error_message || null,
    has_payload: Number(row.has_payload) === 1
  }
}

function parsePayload(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * @param {object} p
 * @param {string} p.skillId
 * @param {string} p.skillName
 * @param {string} [p.vendor]
 * @param {string} [p.selectType]
 * @param {string} p.inputQuery
 * @param {boolean} p.success
 * @param {string} [p.errorMessage]
 * @param {object} [p.result] - parseOutputToJson + 扩展字段
 * @param {string} [p.snapshotDir]
 * @returns {string|null} snapshot id
 */
export function insertQuerySnapshot(p) {
  const db = getDb()
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const q = String(p.inputQuery || '').slice(0, MAX_INPUT_QUERY)
  const payload = p.success ? sanitizeResultForSnapshot(p.result ?? {}) : null
  const payloadStr = payload != null ? JSON.stringify(payload) : null

  const stmt = db.prepare(
    `INSERT INTO query_snapshots (
      id, created_at, skill_id, skill_name, vendor, select_type,
      input_query, success, error_message, result_payload, snapshot_dir
    ) VALUES (
      :id, :created_at, :skill_id, :skill_name, :vendor, :select_type,
      :input_query, :success, :error_message, :result_payload, :snapshot_dir
    )`
  )
  stmt.setAllowBareNamedParameters(true)
  stmt.run({
    id,
    created_at: createdAt,
    skill_id: String(p.skillId || ''),
    skill_name: String(p.skillName || ''),
    vendor: String(p.vendor || 'mx'),
    select_type: String(p.selectType || ''),
    input_query: q,
    success: p.success ? 1 : 0,
    error_message: p.success ? null : String(p.errorMessage || '').slice(0, MAX_ERROR_MSG),
    result_payload: payloadStr,
    snapshot_dir: p.snapshotDir || null
  })

  return id
}

/**
 * @param {{ limit?: number, offset?: number }} opts
 */
export function listQuerySnapshots(opts = {}) {
  const db = getDb()
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || DEFAULT_LIST_LIMIT))
  const offset = Math.max(0, Number(opts.offset) || 0)

  const stmt = db.prepare(
    `SELECT id, created_at, skill_id, skill_name, vendor, select_type,
            input_query, success, error_message,
            CASE WHEN result_payload IS NOT NULL AND length(result_payload) > 0 THEN 1 ELSE 0 END AS has_payload
     FROM query_snapshots
     ORDER BY created_at DESC
     LIMIT :limit OFFSET :offset`
  )
  stmt.setAllowBareNamedParameters(true)
  const rows = stmt.all({ limit, offset })

  return rows.map(rowToListItem)
}

export function getQuerySnapshotById(id) {
  const db = getDb()
  const stmt = db.prepare(
    `SELECT id, created_at, skill_id, skill_name, vendor, select_type,
            input_query, success, error_message, result_payload, snapshot_dir
     FROM query_snapshots WHERE id = :id`
  )
  stmt.setAllowBareNamedParameters(true)
  const row = stmt.get({ id: String(id || '') })

  if (!row) return null

  return {
    id: row.id,
    created_at: row.created_at,
    skill_id: row.skill_id,
    skill_name: row.skill_name,
    vendor: row.vendor || 'mx',
    select_type: row.select_type || '',
    input_query: row.input_query || '',
    success: !!row.success,
    error_message: row.error_message || null,
    result_payload: parsePayload(row.result_payload),
    snapshot_dir: row.snapshot_dir || null
  }
}
