/**
 * SQLite 初始化（Node 内置 node:sqlite，无需原生编译）
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DatabaseSync } from 'node:sqlite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let db = null

export function getDb() {
  if (!db) throw new Error('[HistoryDB] 未初始化，请先调用 initDb()')
  return db
}

/**
 * @param {string} projectRoot - 仓库根目录
 */
export function initDb(projectRoot) {
  const dataDir = process.env.AEOLUS_DATA_DIR
    ? path.resolve(process.env.AEOLUS_DATA_DIR)
    : path.join(projectRoot, 'data')
  const dbPath = process.env.AEOLUS_DB_PATH
    ? path.resolve(process.env.AEOLUS_DB_PATH)
    : path.join(dataDir, 'aeolus.db')

  fs.mkdirSync(dataDir, { recursive: true })
  db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL')

  const migrationPath = path.join(__dirname, 'migrations', '001_query_snapshots.sql')
  db.exec(fs.readFileSync(migrationPath, 'utf-8'))

  console.log(`[HistoryDB] ✓ ${dbPath}`)
  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}
