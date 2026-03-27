/**
 * Aeolus Backend Server
 *
 * - Skills are loaded dynamically from skills/ via skillRegistry
 * - All routes pass through pluggable auth middleware
 * - Python output files are parsed to JSON and deleted immediately
 * - Frontend communicates only via /api/*, no file path dependencies
 */

import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// 确保 Windows 终端输出 UTF-8，防止中文乱码
if (process.platform === 'win32') {
  process.stdout.setEncoding('utf8')
  process.stderr.setEncoding('utf8')
}

import { loadSkills, getSkills, getSkillConfig } from './services/skillRegistry.js'
import { runPythonScript, parseOutputToJson, cleanupTempFiles, buildArgs } from './services/pythonRunner.js'
import { requireAuth, requireTier, trackUsage } from './middleware/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const PORT = process.env.PORT || 3001
const SNAPSHOT_ROOT = path.join(PROJECT_ROOT, 'tmp', 'skill-response-snapshots')

const app = express()
app.use(cors())
app.use(express.json())

// ─── 启动时加载技能插件 ───────────────────────────────────────────
loadSkills()

// ─── API Key 管理 ─────────────────────────────────────────────────

const API_KEY_PROVIDERS = {
  mx: {
    id: 'mx',
    label: 'MX API Key',
    envVar: 'EM_API_KEY',
    filePath: path.join(PROJECT_ROOT, 'EM_API_KEY.local')
  }
}

function resolveProvider(id = 'mx') {
  return API_KEY_PROVIDERS[String(id).toLowerCase()] || null
}

function parseKeyFile(content) {
  return String(content || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((line) => {
      const eq = line.indexOf('=')
      return eq > 0
        ? { name: line.slice(0, eq).trim(), key: line.slice(eq + 1).trim() }
        : { name: '', key: line }
    })
    .filter((k) => k.key)
    .map((k, i) => ({ name: k.name || `Key ${i + 1}`, key: k.key }))
}

function readKeys(provider) {
  try {
    if (!fs.existsSync(provider.filePath)) return []
    return parseKeyFile(fs.readFileSync(provider.filePath, 'utf-8'))
  } catch { return [] }
}

function writeKeys(keys, provider) {
  const lines = [`# ${provider.label} (first entry is active)`, ...keys.map((k) => `${k.name}=${k.key}`)]
  fs.writeFileSync(provider.filePath, lines.join('\n') + '\n', 'utf-8')
}

function maskKey(k) {
  const s = String(k || '')
  if (!s) return ''
  if (s.length <= 8) return '*'.repeat(s.length)
  return `${s.slice(0, 4)}****${s.slice(-4)}`
}

function getActiveKey(provider) {
  const env = (process.env[provider.envVar] || '').trim()
  if (env) return env
  const keys = readKeys(provider)
  const fileKey = keys[0]?.key || ''
  if (fileKey) process.env[provider.envVar] = fileKey
  return fileKey
}

function makeRunId() {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}_${Math.random().toString(36).slice(2, 8)}`
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function writeSnapshotFile(baseDir, fileName, data) {
  ensureDir(baseDir)
  const filePath = path.join(baseDir, fileName)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  return filePath
}

function buildStandardResult({
  skillId,
  skillName,
  query,
  selectType = '',
  parsedResult,
  snapshotDir = '',
  protocolStatus = 'ok',
  error = null
}) {
  return {
    protocolVersion: '1.0.0-draft',
    status: protocolStatus,
    meta: {
      skillId,
      skillName,
      query,
      selectType,
      generatedAt: new Date().toISOString()
    },
    payload: {
      fileType: parsedResult?.fileType || 'text',
      fileName: parsedResult?.fileName || '',
      sheetCount: Array.isArray(parsedResult?.sheets) ? parsedResult.sheets.length : 0,
      sheets: parsedResult?.sheets || [],
      description: parsedResult?.description || '',
      rawOutput: parsedResult?.rawOutput || ''
    },
    diagnostics: {
      snapshotDir,
      error
    }
  }
}

// ─── 路由 ─────────────────────────────────────────────────────────

/** 健康检查 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), skills: getSkills().length })
})

/**
 * 插件商店：获取所有已注册技能
 * 前端通过此接口动态渲染技能列表，无需硬编码
 */
app.get('/api/skills', requireAuth, (req, res) => {
  res.json({ success: true, skills: getSkills() })
})

/**
 * 执行技能查询
 * 返回标准化 JSON 数据结构，不再返回文件路径
 * 临时文件在读取后立即清理，不留残留
 */
app.post('/api/query', requireAuth, trackUsage, async (req, res) => {
  const { skillId, query, selectType } = req.body

  if (!skillId || !query) {
    return res.status(400).json({ error: '缺少必要参数: skillId 和 query' })
  }

  const skill = getSkillConfig(skillId)
  if (!skill) {
    return res.status(404).json({
      error: `技能 "${skillId}" 未找到。请检查插件商店中是否存在该技能。`
    })
  }

  const provider = API_KEY_PROVIDERS.mx
  const apiKey = getActiveKey(provider)
  if (!apiKey) {
    return res.status(400).json({
      error: `${provider.label} 未设置。请在设置中添加 API Key。`
    })
  }

  const scriptPath = path.join(skill._scriptDir, skill.script || 'get_data.py')
  const args = buildArgs(skill, query, selectType)
  const runId = makeRunId()
  const snapshotDir = path.join(SNAPSHOT_ROOT, skillId, runId)

  let stdout = ''
  try {
    stdout = await runPythonScript(scriptPath, args, { [provider.envVar]: apiKey })
    const result = parseOutputToJson(stdout)
    writeSnapshotFile(snapshotDir, 'request.json', {
      skillId,
      skillName: skill.title,
      query,
      selectType: selectType || '',
      scriptPath,
      args,
      createdAt: new Date().toISOString()
    })
    writeSnapshotFile(snapshotDir, 'raw-output.json', { rawOutput: stdout })
    writeSnapshotFile(snapshotDir, 'parsed-result.json', result)
    const standardResult = buildStandardResult({
      skillId,
      skillName: skill.title,
      query,
      selectType: selectType || '',
      parsedResult: result,
      snapshotDir,
      protocolStatus: 'ok',
      error: null
    })
    writeSnapshotFile(snapshotDir, 'standard-result.json', standardResult)

    res.json({
      success: true,
      skillId,
      skillName: skill.title,
      query,
      selectType: selectType || '',
      standardResult,
      snapshotDir,
      ...result
    })
  } catch (err) {
    console.error(`[/api/query] ${skillId} 执行失败:`, err.message)
    writeSnapshotFile(snapshotDir, 'request.json', {
      skillId,
      skillName: skill.title,
      query,
      selectType: selectType || '',
      scriptPath,
      args,
      createdAt: new Date().toISOString()
    })
    writeSnapshotFile(snapshotDir, 'error.json', {
      error: err.message,
      createdAt: new Date().toISOString()
    })
    const standardResult = buildStandardResult({
      skillId,
      skillName: skill.title,
      query,
      selectType: selectType || '',
      parsedResult: null,
      snapshotDir,
      protocolStatus: 'error',
      error: err.message
    })
    writeSnapshotFile(snapshotDir, 'standard-result.json', standardResult)
    res.status(500).json({
      success: false,
      error: err.message,
      snapshotDir,
      standardResult
    })
  } finally {
    // 无论成功失败，清理临时文件，保持服务器磁盘干净
    if (stdout) cleanupTempFiles(stdout)
  }
})

/** API Key 查询 */
app.get('/api/api-keys', requireAuth, (req, res) => {
  const provider = resolveProvider(req.query.provider)
  if (!provider) return res.status(400).json({ success: false, error: '无效的 provider' })

  const keys = readKeys(provider)
  const active = getActiveKey(provider)
  const activeIndex = keys.findIndex((k) => k.key === active)

  res.json({
    success: true,
    provider: provider.id,
    providerLabel: provider.label,
    envVar: provider.envVar,
    activeIndex: activeIndex >= 0 ? activeIndex : 0,
    activeKey: active,
    activeKeyMasked: maskKey(active),
    keys: keys.map((k, i) => ({ index: i, name: k.name, key: k.key, masked: maskKey(k.key) }))
  })
})

/** API Key 操作（添加 / 切换 / 删除） */
app.post('/api/api-keys', requireAuth, (req, res) => {
  const provider = resolveProvider(req.body?.provider)
  if (!provider) return res.status(400).json({ success: false, error: '无效的 provider' })

  const { action } = req.body
  const keys = readKeys(provider)

  if (action === 'add') {
    const key = String(req.body.key || '').trim()
    const name = String(req.body.name || '').trim() || `Key ${keys.length + 1}`
    if (!key) return res.status(400).json({ success: false, error: 'key 不能为空' })
    const deduped = keys.filter((k) => k.key !== key)
    const next = req.body.setActive ? [{ name, key }, ...deduped] : [...deduped, { name, key }]
    writeKeys(next, provider)
    if (req.body.setActive) process.env[provider.envVar] = key
    return res.json({ success: true })
  }

  if (action === 'setActive') {
    const idx = Number(req.body.index)
    if (!Number.isFinite(idx) || idx < 0 || idx >= keys.length) {
      return res.status(400).json({ success: false, error: '无效的索引' })
    }
    const next = [keys[idx], ...keys.filter((_, i) => i !== idx)]
    writeKeys(next, provider)
    process.env[provider.envVar] = next[0].key
    return res.json({ success: true })
  }

  if (action === 'delete') {
    const idx = Number(req.body.index)
    if (!Number.isFinite(idx) || idx < 0 || idx >= keys.length) {
      return res.status(400).json({ success: false, error: '无效的索引' })
    }
    const next = keys.filter((_, i) => i !== idx)
    writeKeys(next, provider)
    if (keys[idx]?.key === (process.env[provider.envVar] || '').trim()) {
      process.env[provider.envVar] = next[0]?.key || ''
    }
    return res.json({ success: true })
  }

  res.status(400).json({ success: false, error: '未知 action' })
})

// ─── 启动 ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Aeolus API Server  http://localhost:${PORT}`)
  console.log(`📦 Project root: ${PROJECT_ROOT}`)
})
