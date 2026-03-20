/**
 * Python Runner & JSON Parser
 *
 * 负责：
 * 1. 启动本地 Python 进程执行技能脚本
 * 2. 将 Python 脚本产出的文件（xlsx/csv/txt）直接解析为 JSON 结构
 * 3. 执行完成后清理临时文件，不留任何物理文件在磁盘上
 *
 * 这样前端只需消费 JSON 数据，与文件路径完全解耦。
 */

import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { TextDecoder } from 'util'
import * as XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '../..')
const XLSX_API = XLSX?.utils ? XLSX : (XLSX?.default || {})

const MAX_ROWS = 500
const MAX_COLS = 60

export function getPythonPath() {
  return (
    process.env.AEOLUS_PYTHON_PATH ||
    path.join(PROJECT_ROOT, 'python', 'venv', 'Scripts', 'python.exe')
  )
}

function decodeOutput(chunks) {
  const buf = Buffer.concat(chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c))))
  if (buf.length === 0) return ''
  const utf8 = buf.toString('utf8')
  if (!utf8.includes('\uFFFD')) return utf8
  try { return new TextDecoder('gb18030').decode(buf) } catch { return utf8 }
}

/**
 * 执行 Python 脚本，返回原始 stdout 字符串
 */
export async function runPythonScript(scriptPath, args = [], extraEnv = {}) {
  const pythonPath = getPythonPath()

  if (!fs.existsSync(pythonPath)) {
    throw new Error(
      `Python 运行环境未找到: ${pythonPath}。\n请先执行 setup-python.ps1 初始化环境，或设置环境变量 AEOLUS_PYTHON_PATH。`
    )
  }
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`技能脚本未找到: ${scriptPath}`)
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonPath, [scriptPath, ...args], {
      env: {
        ...process.env,
        ...extraEnv,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1'
      },
      cwd: PROJECT_ROOT,
      shell: false,
      windowsHide: true
    })

    const out = []
    const err = []
    proc.stdout.on('data', (d) => out.push(Buffer.from(d)))
    proc.stderr.on('data', (d) => err.push(Buffer.from(d)))
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`脚本执行失败 (exit ${code}): ${decodeOutput(err) || decodeOutput(out)}`))
      } else {
        resolve(decodeOutput(out))
      }
    })
    proc.on('error', (e) => reject(new Error(`无法启动 Python 进程: ${e.message}`)))
  })
}

// ─── 文件解析工具 ──────────────────────────────────────────────

function extractFilePaths(stdout) {
  const dataFiles = []
  let descFile = null

  for (const line of stdout.split('\n')) {
    const m = line.match(/[A-Za-z]:\\[^\s\r\n]+\.(xlsx|xls|csv|txt)/i)
    if (!m) continue
    const fp = m[0]
    if (fp.toLowerCase().endsWith('.txt')) {
      descFile = fp
    } else {
      dataFiles.push(fp)
    }
  }
  return { dataFiles, descFile }
}

function xlsxToSheets(filePath) {
  const buf = fs.readFileSync(filePath)
  const wb = XLSX_API.read(buf, { type: 'buffer', cellDates: true })

  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    const raw = XLSX_API.utils.sheet_to_json(ws, { header: 1, raw: false })
    const safe = raw.slice(0, MAX_ROWS).map((r) => (Array.isArray(r) ? r : []).slice(0, MAX_COLS))
    const headers = safe[0]?.map((h, i) => String(h || `列${i + 1}`)) || ['列1']
    const rows = safe.slice(1).map((row) => {
      const obj = {}
      headers.forEach((h, i) => { obj[h] = row?.[i] ?? '' })
      return obj
    })
    return { name, headers, rows, rowCount: rows.length }
  })
}

function csvToSheets(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8')
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return [{ name: 'Sheet1', headers: ['列1'], rows: [], rowCount: 0 }]

  const headers = lines[0].split(',').map((h, i) => String(h.trim() || `列${i + 1}`)).slice(0, MAX_COLS)
  const rows = lines.slice(1, MAX_ROWS + 1).map((line) => {
    const vals = line.split(',')
    const obj = {}
    headers.forEach((h, i) => { obj[h] = String(vals[i]?.trim() ?? '') })
    return obj
  })
  return [{ name: 'Sheet1', headers, rows, rowCount: rows.length }]
}

// ─── 核心：输出转 JSON，清理临时文件 ──────────────────────────────

/**
 * 将 Python 脚本 stdout 中引用的文件解析为标准化 JSON 结构
 */
export function parseOutputToJson(stdout) {
  const { dataFiles, descFile } = extractFilePaths(stdout)

  let sheets = []
  let fileType = 'text'
  let fileName = ''

  for (const fp of dataFiles) {
    if (!fs.existsSync(fp)) continue
    const ext = path.extname(fp).toLowerCase()
    fileName = path.basename(fp)
    try {
      if (ext === '.xlsx' || ext === '.xls') {
        sheets = xlsxToSheets(fp)
        fileType = 'xlsx'
      } else if (ext === '.csv') {
        sheets = csvToSheets(fp)
        fileType = 'csv'
      }
    } catch (e) {
      console.error(`[pythonRunner] 解析文件失败 ${fp}:`, e.message)
    }
  }

  let description = ''
  if (descFile && fs.existsSync(descFile)) {
    try { description = fs.readFileSync(descFile, 'utf-8') } catch { /* ignore */ }
  }

  return { sheets, fileType, fileName, description, rawOutput: stdout }
}

/**
 * 清理 Python 脚本生成的所有临时文件（不留残留）
 */
export function cleanupTempFiles(stdout) {
  const { dataFiles, descFile } = extractFilePaths(stdout)
  const all = [...dataFiles, descFile].filter(Boolean)
  for (const fp of all) {
    try {
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
    } catch (e) {
      console.warn(`[pythonRunner] 清理临时文件失败 ${fp}:`, e.message)
    }
  }
}

/**
 * 根据 manifest 的 argsTemplate 构建 Python 脚本参数
 */
export function buildArgs(manifest, query, selectType = '') {
  return (manifest.argsTemplate || ['--query', '{query}']).map((token) =>
    token.replace('{query}', query).replace('{selectType}', selectType)
  )
}
