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

/** True if value looks like a filesystem path (not a bare command like `python3`). */
function looksLikeFilesystemPath(p) {
  if (!p || typeof p !== 'string') return false
  if (path.isAbsolute(p)) return true
  if (p.includes('/') || p.includes('\\')) return true
  if (/^[A-Za-z]:[\\/]/.test(p)) return true
  return false
}

/**
 * Resolve Python executable:
 * 1. AEOLUS_PYTHON_PATH (override, e.g. on Render)
 * 2. python/venv/bin/python (Linux/macOS venv)
 * 3. python/venv/Scripts/python.exe (Windows venv)
 * 4. python3 (system / PATH)
 */
export function getPythonPath() {
  const fromEnv = (process.env.AEOLUS_PYTHON_PATH || '').trim()
  if (fromEnv) return fromEnv

  const linuxVenv = path.join(PROJECT_ROOT, 'python', 'venv', 'bin', 'python')
  if (fs.existsSync(linuxVenv)) return linuxVenv

  const winVenv = path.join(PROJECT_ROOT, 'python', 'venv', 'Scripts', 'python.exe')
  if (fs.existsSync(winVenv)) return winVenv

  return 'python3'
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

  if (looksLikeFilesystemPath(pythonPath) && !fs.existsSync(pythonPath)) {
    throw new Error(
      `Python 运行环境未找到: ${pythonPath}。\n` +
        'Windows 请运行 .\\setup-python.ps1；Linux/macOS（含 Render）请运行 ./setup-python.sh；' +
        '也可设置环境变量 AEOLUS_PYTHON_PATH 指向 python 可执行文件。'
    )
  }
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`技能脚本未找到: ${scriptPath}`)
  }

  return new Promise((resolve, reject) => {
    // 避免宿主机 PYTHONHOME/PYTHONPATH 污染 venv，触发
    // "Could not find platform independent libraries <prefix>"。
    const childEnv = {
      ...process.env,
      ...extraEnv,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1'
    }
    delete childEnv.PYTHONHOME
    delete childEnv.PYTHONPATH

    const proc = spawn(pythonPath, [scriptPath, ...args], {
      env: childEnv,
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

const WIN_PATH_EXT = /[A-Za-z]:\\(?:[^\s\r\n\\]+\\)*[^\s\r\n\\]+\.(?:xlsx|xls|csv|txt)/gi
const POSIX_PATH_EXT = /\/(?:[^\s\r\n/]+\/)*[^\s\r\n/]+\.(?:xlsx|xls|csv|txt)/gi
const REL_PATH_EXT = /\b((?:\.\/)?(?:[\w.-]+[/\\])+[\w.-]+\.(?:xlsx|xls|csv|txt))\b/gi

function maskRanges(str, ranges) {
  let s = str
  for (const [a, b] of [...ranges].sort((x, y) => y[0] - x[0])) {
    if (a >= 0 && b <= s.length && b > a) {
      s = s.slice(0, a) + ' '.repeat(b - a) + s.slice(b)
    }
  }
  return s
}

function collectHitsForLine(line) {
  const hits = []
  const ranges = []

  WIN_PATH_EXT.lastIndex = 0
  for (const m of line.matchAll(WIN_PATH_EXT)) {
    hits.push({ i: m.index, s: m[0] })
    ranges.push([m.index, m.index + m[0].length])
  }
  POSIX_PATH_EXT.lastIndex = 0
  for (const m of line.matchAll(POSIX_PATH_EXT)) {
    hits.push({ i: m.index, s: m[0] })
    ranges.push([m.index, m.index + m[0].length])
  }

  const masked = maskRanges(line, ranges)
  REL_PATH_EXT.lastIndex = 0
  for (const m of masked.matchAll(REL_PATH_EXT)) {
    const token = m[1] || m[0]
    hits.push({ i: m.index, s: token })
  }

  hits.sort((a, b) => a.i - b.i)
  return hits
}

function normalizeExtractedPath(raw) {
  const s = String(raw || '').trim()
  if (!s) return null
  return path.isAbsolute(s) ? s : path.resolve(PROJECT_ROOT, s)
}

function extractFilePaths(stdout) {
  const dataFiles = []
  let descFile = null
  const seen = new Set()
  const ordered = []

  for (const line of stdout.split('\n')) {
    for (const { s } of collectHitsForLine(line)) {
      const full = normalizeExtractedPath(s)
      if (!full) continue
      const key = path.normalize(full)
      if (seen.has(key)) continue
      seen.add(key)
      ordered.push(full)
    }
  }

  for (const full of ordered) {
    if (full.toLowerCase().endsWith('.txt')) {
      descFile = full
    } else {
      dataFiles.push(full)
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
  // 保留 txt 描述文件，便于排查“前端未拿到内容”场景。
  const all = [...dataFiles].filter(Boolean)
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
