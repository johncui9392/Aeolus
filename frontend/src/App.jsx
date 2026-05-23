import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSXLib from 'xlsx'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import {
  Database, Search, TrendingUp, Target, Loader2, XCircle,
  FileText, Download, MessageSquarePlus, ChevronRight,
  ChevronDown, Puzzle, Store
} from 'lucide-react'
import { useAuth } from './hooks/useAuth.js'

// ─── 配置 ───────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || ''
const THEME_KEY = 'aeolus_theme_v2'
const LEGACY_THEME_KEY = 'aeolus_theme'
const SKILL_VENDOR_KEY = 'aeolus_skill_vendor'
const HISTORY_LIST_LIMIT = 50
const DEFAULT_THEME = 'palette-light'
const VALID_THEME_IDS = new Set(['palette-light', 'palette-05'])

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored && VALID_THEME_IDS.has(stored)) return stored
    // 旧版默认是深色 palette-05；升级后以风清为默认，不再沿用旧缓存
    if (localStorage.getItem(LEGACY_THEME_KEY)) {
      localStorage.removeItem(LEGACY_THEME_KEY)
    }
    return DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

function writeStoredTheme(themeId) {
  try {
    localStorage.setItem(THEME_KEY, themeId)
  } catch { /* ignore */ }
}

/** 技能来源分类（插件商店顶部 Tag 筛选） */
const SKILL_VENDOR_TAGS = [
  { id: 'all', label: '全部' },
  { id: 'mx', label: '东方财富', shortLabel: '妙想', color: 'bg-amber-500/10 text-amber-700 border-amber-300/50' },
  { id: 'wind', label: 'Wind 万得', shortLabel: '万得', color: 'bg-sky-500/10 text-sky-700 border-sky-300/50' },
  { id: 'tushare', label: 'Tushare', shortLabel: 'Tushare', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-300/50' }
]

function getSkillVendor(skill) {
  if (!skill) return 'mx'
  if (skill.vendor === 'tushare') return 'tushare'
  return skill.vendor === 'wind' ? 'wind' : 'mx'
}

function vendorTagMeta(vendorId) {
  return SKILL_VENDOR_TAGS.find((t) => t.id === vendorId) || SKILL_VENDOR_TAGS[1]
}

/** 历史记录按 createdAt 升序排列（先添加在前，后添加在后） */
function normalizeHistoryByCreatedAt(items) {
  if (!Array.isArray(items)) return []
  return [...items].sort(
    (a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime()
  )
}

const THEME_OPTIONS = [
  { id: 'palette-light', name: '风清', desc: '浅色商务 · 默认', swatch: 'from-sky-400 to-cyan-500' },
  { id: 'palette-05', name: '紫靛', desc: '深紫底 + 靛蓝高亮', swatch: 'from-indigo-400 to-cyan-400' }
]

// icon 名称 → 组件映射（manifest 中以字符串声明）
const ICON_MAP = { Database, Search, TrendingUp, Target, FileText, Puzzle }

// ─── Ripple + VibeButton ─────────────────────────────────────────────────────

function useRipple() {
  const [ripples, setRipples] = useState([])
  const add = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    setRipples((p) => [...p, { id: Date.now(), x: e.clientX - rect.left - size / 2, y: e.clientY - rect.top - size / 2, size }])
    setTimeout(() => setRipples([]), 500)
  }
  return { ripples, add }
}

function VibeButton({ children, onClick, className = '', variant = 'primary', type = 'button', disabled, ...rest }) {
  const { ripples, add } = useRipple()
  const variants = {
    primary: 'bg-primary text-on-primary shadow-sm hover:shadow-md',
    secondary: 'bg-secondary-container text-on-secondary-container',
    ghost: 'hover:bg-surface-variant text-on-surface',
    surface: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest border border-outline-variant/30',
  }
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileTap={disabled ? {} : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={(e) => { add(e); if (onClick) onClick(e) }}
      className={`relative overflow-hidden font-medium transition-colors ${variants[variant] || ''} ${className}`}
      {...rest}
    >
      {ripples.map((r) => (
        <span key={r.id} className="vibe-ripple" style={{ top: r.y, left: r.x, width: r.size, height: r.size }} />
      ))}
      <div className="relative z-10 flex items-center justify-center gap-2">{children}</div>
    </motion.button>
  )
}

// ─── 前端 Excel 导出 ──────────────────────────────────────────────────────────

function exportToExcel(sheets, fileName = 'data.xlsx') {
  const wb = XLSXLib.utils.book_new()
  for (const sheet of sheets) {
    const ws = XLSXLib.utils.json_to_sheet(sheet.rows, { header: sheet.headers })
    XLSXLib.utils.book_append_sheet(wb, ws, sheet.name)
  }
  XLSXLib.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`)
}

function exportToCsv(sheets, fileName = 'data.csv') {
  if (!sheets.length) return
  const sheet = sheets[0]
  const rows = [sheet.headers.join(','), ...sheet.rows.map((r) => sheet.headers.map((h) => `"${String(r[h] ?? '')}"`).join(','))]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── 资讯解析 ────────────────────────────────────────────────────────────────

function parseNewsItems(raw) {
  const text = String(raw || '').trim()
  if (!text) return []
  const tryParse = (s) => {
    try {
      const obj = JSON.parse(s)
      const items = Array.isArray(obj?.data) ? obj.data : []
      return items.map((item, i) => ({
        id: item?.code || `n-${i}`,
        title: String(item?.title || '').trim(),
        content: String(item?.content || '').trim(),
        date: String(item?.date || '').trim(),
        source: String(item?.source || '').trim(),
        jumpUrl: String(item?.jumpUrl || '').trim()
      })).filter((it) => it.title || it.content)
    } catch { return [] }
  }
  let items = tryParse(text)
  if (items.length) return items
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (m?.[1]) { items = tryParse(m[1].trim()); if (items.length) return items }
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  if (s >= 0 && e > s) { items = tryParse(text.slice(s, e + 1)); if (items.length) return items }
  return []
}

function truncate(text, max = 260) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  return s.length <= max ? s : `${s.slice(0, max)}...`
}

function parseQaMarkdown(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  const tryParse = (s) => {
    try {
      return JSON.parse(s)
    } catch {
      return null
    }
  }
  let obj = tryParse(text)
  if (!obj) {
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (m?.[1]) obj = tryParse(m[1].trim())
  }
  if (!obj || typeof obj !== 'object') return ''
  if (!obj.ok || !obj.answer) return ''

  const answer = String(obj.answer || '').trim()
  const references = Array.isArray(obj.references) ? obj.references : []
  const cited = references.filter((r) => String(r?.referenceType || '') === 'CITED_REFERENCE')
  if (!cited.length) return answer

  const lines = ['### 溯源参考']
  for (const ref of cited) {
    const type = String(ref?.type || '').trim()
    const title = String(ref?.title || '').trim()
    const url = String(ref?.jumpUrl || '').trim()
    const source = String(ref?.source || '').trim()
    const markdown = String(ref?.markdown || '').trim()

    if ((type === '查数' || type === '选股/基') && markdown) {
      lines.push(`\n**${type}：**\n${markdown}`)
      continue
    }
    if (title) {
      if (url && source) lines.push(`- [${title}](${url})（来源：${source}）`)
      else if (url) lines.push(`- [${title}](${url})`)
      else if (source) lines.push(`- ${title}（来源：${source}）`)
      else lines.push(`- ${title}`)
    }
  }

  return `${answer}\n\n${lines.join('\n')}`.trim()
}

/** 去掉妙想类脚本打在 stdout 前的元信息行，便于把正文当 Markdown 渲染 */
function stripLeadingCliMeta(stdout) {
  const lines = String(stdout || '').split(/\r?\n/)
  const metaRes = [
    /^Saved:\s*\S/,
    /^Title:\s*.+/,
    /^ShareUrl:\s*\S/i,
    /^Share URL:\s*\S/i,
    /^(pdf|word|docx):\s*\S/i
  ]
  let i = 0
  for (; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t === '') continue
    const isMeta = metaRes.some((re) => re.test(t))
    if (!isMeta) break
  }
  return lines.slice(i).join('\n').trim()
}

/**
 * 将整段 stdout 若为 JSON 时抽出可展示正文（content/displayData）、错误或格式化为代码块。
 * 返回 null 表示交给后续逻辑（如资讯列表 parseNewsItems）。
 */
function tryParseJsonStdoutToMarkdown(text) {
  const t = String(text || '').trim()
  if (!t.startsWith('{')) return null
  try {
    const obj = JSON.parse(t)
    if (!obj || typeof obj !== 'object') return null
    if (Array.isArray(obj.data)) return null

    if (typeof obj.content === 'string' && obj.content.trim()) return obj.content.trim()

    const dd = obj.data?.displayData
    if (typeof dd === 'string' && dd.trim()) return dd.trim()

    if (typeof obj.error === 'string' && obj.error.trim()) {
      return `### 错误\n\n${obj.error.trim()}`
    }

    if (obj.records !== undefined || obj.header !== undefined || obj.section_finance !== undefined) {
      return ['```json', JSON.stringify(obj, null, 2), '```'].join('\n')
    }

    return ['```json', JSON.stringify(obj, null, 2), '```'].join('\n')
  } catch {
    return null
  }
}

/**
 * 统一从接口结果解析「给用户看」的正文与展示类型（表格技能保留 description + fileType）。
 */
function resolveSkillDisplay(data) {
  const raw = data.rawOutput || ''
  const qa = parseQaMarkdown(raw)
  if (qa) return { description: qa, fileType: 'markdown' }

  const hasTable =
    (data.fileType === 'xlsx' || data.fileType === 'csv') &&
    Array.isArray(data.sheets) &&
    data.sheets.length > 0
  if (hasTable) {
    return { description: data.description || '', fileType: data.fileType || 'text' }
  }

  const stripped = stripLeadingCliMeta(raw)
  const head = stripped.trim()

  if (/^Error:/i.test(head)) {
    const msg = stripped.replace(/^Error:\s*/i, '').trim()
    return { description: `### 错误\n\n${msg}`, fileType: 'markdown' }
  }

  const fromJson = tryParseJsonStdoutToMarkdown(stripped)
  if (fromJson !== null) return { description: fromJson, fileType: 'markdown' }

  if (stripped) return { description: stripped, fileType: 'markdown' }

  return { description: data.description || '', fileType: data.fileType || 'text' }
}

function tableObjectToRows(sectionTable = {}, nameField = '公司名称') {
  const headName = Array.isArray(sectionTable.headName) ? sectionTable.headName : []
  if (!headName.length) return []
  return Object.entries(sectionTable)
    .filter(([k, v]) => k !== 'headName' && Array.isArray(v))
    .map(([name, arr]) => {
      const row = { [nameField]: name }
      headName.forEach((h, i) => { row[h] = arr[i] ?? '' })
      return row
    })
}

function hasRenderableSnapshotPayload(payload) {
  if (!payload || typeof payload !== 'object') return false
  const hasSheets = Array.isArray(payload.sheets) && payload.sheets.length > 0
  const hasText = [payload.description, payload.content, payload.rawOutput].some(
    (v) => typeof v === 'string' && v.trim().length > 0
  )
  return hasSheets || hasText
}

function deriveSheetsFallback(payload, rawOutput) {
  if (Array.isArray(payload?.sheets) && payload.sheets.length > 0) return payload.sheets
  const parsed = parseComparableCompanySheets(rawOutput || '')
  return parsed.sheets || []
}

function parseComparableCompanySheets(rawOutput) {
  const text = String(rawOutput || '').trim()
  if (!text.startsWith('{')) return { sheets: [], note: '' }
  try {
    const obj = JSON.parse(text)
    const financeRows = tableObjectToRows(obj?.section_finance?.table, '公司名称')
    const valuationRows = tableObjectToRows(obj?.section_valuation?.table, '公司名称')
    if (!financeRows.length && !valuationRows.length) return { sheets: [], note: '' }

    const financeHeaders = financeRows.length ? Object.keys(financeRows[0]) : []
    const valuationHeaders = valuationRows.length ? Object.keys(valuationRows[0]) : []
    const sheets = []
    if (financeRows.length) {
      sheets.push({ name: '经营统计与财务指标', headers: financeHeaders, rows: financeRows, rowCount: financeRows.length })
    }
    if (valuationRows.length) {
      sheets.push({ name: '估值情况', headers: valuationHeaders, rows: valuationRows, rowCount: valuationRows.length })
    }

    const note = String(obj?.header?.frontendTitle || '').trim()
    return { sheets, note }
  } catch {
    return { sheets: [], note: '' }
  }
}

// ─── 主应用 ──────────────────────────────────────────────────────────────────

export default function App() {
  const { user } = useAuth()
  const logoRef = useRef(null)

  // ── 技能插件（从 /api/skills 动态获取）
  const [skills, setSkills] = useState([])
  const [skillsLoading, setSkillsLoading] = useState(true)
  const [skillVendorFilter, setSkillVendorFilter] = useState(() => {
    try {
      const saved = localStorage.getItem(SKILL_VENDOR_KEY)
      return SKILL_VENDOR_TAGS.some((t) => t.id === saved) ? saved : 'all'
    } catch {
      return 'all'
    }
  })
  const [selectedSkill, setSelectedSkill] = useState(null)
  const [skillsPanelOpen, setSkillsPanelOpen] = useState(true)

  const filteredSkills = useMemo(() => {
    if (skillVendorFilter === 'all') return skills
    return skills.filter((s) => getSkillVendor(s) === skillVendorFilter)
  }, [skills, skillVendorFilter])

  // ── 查询
  const [query, setQuery] = useState('')
  const [selectType, setSelectType] = useState('A股')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // ── 结果（直接存 JSON，不再存文件路径）
  const [queryResult, setQueryResult] = useState(null)
  const [sheetData, setSheetData] = useState([])
  const [activeSheetName, setActiveSheetName] = useState('')
  const [previewView, setPreviewView] = useState('table')
  const [description, setDescription] = useState('')
  const [rawOutput, setRawOutput] = useState('')
  const [fileType, setFileType] = useState('text')
  const [fileName, setFileName] = useState('')

  const resetResultState = useCallback(() => {
    setQueryResult(null)
    setError(null)
    setSheetData([])
    setActiveSheetName('')
    setDescription('')
    setRawOutput('')
    setFileType('text')
    setFileName('')
  }, [])

  // ── UI 状态
  const [themeId, setThemeId] = useState(readStoredTheme)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false)
  const [ribbonPieces, setRibbonPieces] = useState([])
  const [historyItems, setHistoryItems] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyRestoreLoading, setHistoryRestoreLoading] = useState(false)
  const [activeSnapshotId, setActiveSnapshotId] = useState(null)

  // ── API Key 状态（mx=妙想 / wind=万得）
  const [apiKeyProvider, setApiKeyProvider] = useState('mx')
  const [apiKeysInfo, setApiKeysInfo] = useState({ providerLabel: 'MX API Key', envVar: 'EM_API_KEY', activeKey: '', activeKeyMasked: '', activeIndex: 0, keys: [] })
  const [apiKeyReveal, setApiKeyReveal] = useState(false)
  const [apiKeyLoading, setApiKeyLoading] = useState(false)
  const [apiKeyError, setApiKeyError] = useState('')
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')

  // ── 主题同步
  useEffect(() => {
    const t = THEME_OPTIONS.find((o) => o.id === themeId) ? themeId : DEFAULT_THEME
    document.documentElement.setAttribute('data-theme', t)
    writeStoredTheme(t)
  }, [themeId])

  // ── 从 /api/skills 加载技能插件商店
  useEffect(() => {
    axios.get(`${API_BASE}/api/skills`)
      .then((res) => {
        const list = res.data?.skills || []
        setSkills(list)
        setSelectedSkill((prev) => {
          if (prev && list.some((s) => s.id === prev.id)) return prev
          return list[0] || null
        })
      })
      .catch(() => {
        // 后端未启动时提供静态兜底（仅 UI 展示，不可执行）
        setSkills([])
      })
      .finally(() => setSkillsLoading(false))
  }, [])

  // 切换技能来源 Tag 时，若当前选中技能不在列表内则自动选中第一项
  useEffect(() => {
    try { localStorage.setItem(SKILL_VENDOR_KEY, skillVendorFilter) } catch { /* ignore */ }
    if (!filteredSkills.length) return
    if (!selectedSkill || !filteredSkills.some((s) => s.id === selectedSkill.id)) {
      setSelectedSkill(filteredSkills[0])
      setQuery('')
      resetResultState()
    }
  }, [skillVendorFilter, filteredSkills])

  const handleSkillVendorChange = (vendorId) => {
    setSkillVendorFilter(vendorId)
  }

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/api/history`, {
        params: { limit: HISTORY_LIST_LIMIT }
      })
      if (res.data?.success) {
        const items = (res.data.items || []).map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          skillId: row.skill_id,
          skillName: row.skill_name,
          vendor: row.vendor,
          query: row.input_query,
          selectType: row.select_type || '',
          success: !!row.success,
          errorMessage: row.error_message || '',
          hasPayload: !!row.has_payload
        }))
        setHistoryItems(normalizeHistoryByCreatedAt(items))
      }
    } catch {
      // 后端未启动时保持空列表
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const applyQueryResultToView = useCallback((data) => {
    const resolved = resolveSkillDisplay(data)
    const comparableParsed = parseComparableCompanySheets(data.rawOutput || '')
    const displaySheets = (data.sheets && data.sheets.length) ? data.sheets : comparableParsed.sheets
    const descriptionText = comparableParsed.note
      ? [resolved.description, `> ${comparableParsed.note}`].filter(Boolean).join('\n\n')
      : resolved.description
    const displayFileType = displaySheets.length ? (data.fileType === 'csv' ? 'csv' : 'xlsx') : resolved.fileType

    setQueryResult(data)
    setSheetData(displaySheets)
    setActiveSheetName(displaySheets?.[0]?.name || '')
    setFileType(displayFileType)
    setFileName(data.fileName || 'data')
    setDescription(descriptionText)
    setRawOutput(data.rawOutput || '')
    const hasSheets = displaySheets.length > 0
    const preview = data.previewMode || (hasSheets ? 'table' : 'text')
    setPreviewView(hasSheets && preview !== 'text' ? 'table' : 'desc')
    setError(null)
  }, [])

  const formatTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) {
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // ── 新会话
  const handleNewSession = () => {
    setQuery('')
    setActiveSnapshotId(null)
    resetResultState()
  }

  // ── 提交查询
  const handleSubmit = async (e) => {
    e.preventDefault()
    const effectiveQuery = query.trim() || (selectedSkill?.placeholder?.replace(/^例如[:：]\s*/, '') || '')
    if (!effectiveQuery || !selectedSkill) return
    if (!query.trim()) setQuery(effectiveQuery)

    setLoading(true)
    resetResultState()

    try {
      const res = await axios.post(`${API_BASE}/api/query`, {
        skillId: selectedSkill.id,
        query: effectiveQuery,
        selectType: selectedSkill.needsSelectType ? selectType : undefined
      })
      const data = res.data
      applyQueryResultToView(data)
      if (data.snapshotId) setActiveSnapshotId(data.snapshotId)
      await fetchHistory()
    } catch (err) {
      const msg = err.response?.data?.error || err.message || '查询失败'
      setError(msg)
      if (err.response?.data?.snapshotId) setActiveSnapshotId(err.response.data.snapshotId)
      await fetchHistory()
    } finally {
      setLoading(false)
    }
  }

  /** 从 SQLite 历史详情还原结果区（参考 Commercial openCloudSnapshot） */
  const openHistorySnapshot = async (snapshotId) => {
    if (!snapshotId) return
    setHistoryRestoreLoading(true)
    setError(null)
    try {
      const res = await axios.get(`${API_BASE}/api/history/${encodeURIComponent(snapshotId)}`)
      if (!res.data?.success || !res.data.snapshot) {
        throw new Error(res.data?.error || '无法加载历史记录')
      }
      const snap = res.data.snapshot
      setActiveSnapshotId(snap.id)

      const skill = skills.find((s) => s.id === snap.skill_id)
      if (skill) {
        setSelectedSkill(skill)
        if (skill.vendor === 'tushare') setSkillVendorFilter('tushare')
        else if (skill.vendor === 'wind') setSkillVendorFilter('wind')
        else if (skill.vendor === 'mx') setSkillVendorFilter('mx')
      }
      setQuery(snap.input_query || '')
      setSelectType(snap.select_type || 'A股')

      if (snap.success && snap.result_payload && typeof snap.result_payload === 'object') {
        const payload = {
          ...snap.result_payload,
          skillId: snap.skill_id,
          skillName: snap.skill_name,
          query: snap.input_query
        }
        const restoredSheets = (Array.isArray(payload.sheets) && payload.sheets.length > 0)
          ? payload.sheets
          : deriveSheetsFallback(payload, payload.rawOutput)
        const renderable = hasRenderableSnapshotPayload(payload) || restoredSheets.length > 0
        setError(renderable ? null : '该历史记录无法完整还原展示，仅保留问句')
        setQueryResult(payload)
        setSheetData(restoredSheets)
        setActiveSheetName(restoredSheets?.[0]?.name || '')
        setFileType(payload.fileType || (restoredSheets.length > 0 ? 'xlsx' : 'text'))
        setFileName(payload.fileName || 'data')
        const resolved = resolveSkillDisplay(payload)
        const comparableParsed = parseComparableCompanySheets(payload.rawOutput || '')
        const descriptionText = comparableParsed.note
          ? [resolved.description, `> ${comparableParsed.note}`].filter(Boolean).join('\n\n')
          : resolved.description
        setDescription(descriptionText)
        setRawOutput(payload.rawOutput || '')
        const hasSheets = restoredSheets.length > 0
        const preview = payload.previewMode || (hasSheets ? 'table' : 'text')
        setPreviewView(hasSheets && preview !== 'text' ? 'table' : 'desc')
      } else if (!snap.success) {
        setQueryResult(null)
        setSheetData([])
        setActiveSheetName('')
        setDescription('')
        setRawOutput('')
        setFileType('text')
        setFileName('')
        setPreviewView('table')
        setError(snap.error_message || '查询失败')
      } else {
        resetResultState()
        setQuery(snap.input_query || '')
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message || '加载历史失败')
      setActiveSnapshotId(null)
    } finally {
      setHistoryRestoreLoading(false)
    }
  }

  // ── 前端导出
  const handleDownload = () => {
    if (!sheetData.length) return
    if (fileType === 'csv') {
      exportToCsv(sheetData, fileName || 'data.csv')
    } else {
      exportToExcel(sheetData, fileName || 'data.xlsx')
    }
  }

  // ── API Key 管理
  const loadApiKeys = async () => {
    setApiKeyLoading(true)
    setApiKeyError('')
    try {
      const res = await axios.get(`${API_BASE}/api/api-keys`, { params: { provider: apiKeyProvider } })
      if (res.data?.success) setApiKeysInfo(res.data)
      else setApiKeyError(res.data?.error || '加载失败')
    } catch (e) {
      setApiKeyError(e.response?.data?.error || e.message)
    } finally { setApiKeyLoading(false) }
  }

  const keyAction = async (action, payload = {}) => {
    setApiKeyLoading(true)
    setApiKeyError('')
    try {
      const res = await axios.post(`${API_BASE}/api/api-keys`, { provider: apiKeyProvider, action, ...payload })
      if (!res.data?.success) throw new Error(res.data?.error || '操作失败')
      await loadApiKeys()
    } catch (e) {
      setApiKeyError(e.response?.data?.error || e.message)
    } finally { setApiKeyLoading(false) }
  }

  const openApiKeyModal = async () => {
    setUserMenuOpen(false)
    setApiKeyModalOpen(true)
    setApiKeyReveal(false)
    setNewKeyName('')
    setNewKeyValue('')
    await loadApiKeys()
  }

  useEffect(() => {
    if (apiKeyModalOpen) loadApiKeys()
  }, [apiKeyProvider])

  // ── Logo 彩带爆炸
  const triggerLogoBurst = () => {
    const rect = logoRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const colors = ['#818cf8', '#52d7d1', '#c5c4dd', '#ffb4ab', '#bec2ff']
    const pieces = Array.from({ length: 28 }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / 28 + (Math.random() - 0.5) * 0.4
      const dist = 70 + Math.random() * 110
      return {
        id: `${Date.now()}-${i}`,
        x: cx, y: cy,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist - (20 + Math.random() * 30),
        rotate: Math.round((Math.random() - 0.5) * 720),
        color: colors[i % colors.length],
        delay: Math.round(Math.random() * 120)
      }
    })
    setRibbonPieces(pieces)
    setTimeout(() => setRibbonPieces([]), 1100)
  }

  const newsItems = parseNewsItems(rawOutput)
  const hasTableData = (fileType === 'xlsx' || fileType === 'csv') && sheetData.length > 0
  const activeSheet = sheetData.find((s) => s.name === activeSheetName)

  return (
    <div className="flex h-screen overflow-hidden bg-background text-on-background">

      {/* ── 侧边栏 ── */}
      <aside className="w-72 bg-surface-container border-r border-outline-variant/20 flex flex-col shrink-0 z-10">
        <div className="px-6 pt-6 pb-4">
          <h1
            ref={logoRef}
            onClick={triggerLogoBurst}
            className="text-2xl font-extrabold tracking-tight bg-clip-text text-transparent cursor-pointer select-none"
            style={{ backgroundImage: 'linear-gradient(90deg, var(--md-sys-color-primary), var(--md-sys-color-tertiary))' }}
          >
            Aeolus
          </h1>
          <p className="text-[12px] text-on-surface-variant mt-1.5 font-medium">金融 Skill 工作台</p>
        </div>

        <nav className="flex-1 flex flex-col min-h-0 px-4 mt-2">
          <VibeButton variant="primary" onClick={handleNewSession} className="w-full px-4 py-3.5 rounded-full text-sm">
            <MessageSquarePlus className="w-4 h-4" />
            新增会话
          </VibeButton>

          <div className="text-[11px] tracking-widest text-on-surface-variant font-bold px-2 mt-8 mb-3 uppercase">
            历史记录
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar -mx-2 px-2">
            <div className="space-y-1.5 pb-4">
              {historyLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-on-surface-variant">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-[12px]">加载历史…</span>
                </div>
              ) : historyItems.length === 0 ? (
                <p className="text-[12px] text-on-surface-variant px-3 py-2 text-center">暂无历史记录</p>
              ) : (
                [...historyItems].reverse().map((item) => {
                  const isActive = activeSnapshotId === item.id
                  const vendorMeta = vendorTagMeta(
                    item.vendor === 'tushare' ? 'tushare' : item.vendor === 'wind' ? 'wind' : 'mx'
                  )
                  return (
                    <motion.button
                      key={item.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      disabled={historyRestoreLoading}
                      onClick={() => openHistorySnapshot(item.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors disabled:opacity-60 ${
                        isActive
                          ? 'bg-primary-container/20 border-primary/50'
                          : 'border-transparent hover:bg-surface-container-high hover:border-outline-variant/30'
                      }`}
                      title={item.query}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-on-surface truncate">{item.skillName}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${vendorMeta.color}`}>
                            {vendorMeta.shortLabel}
                          </span>
                          <span className="text-[10px] text-on-surface-variant">{formatTime(item.createdAt)}</span>
                          <div className={`w-1.5 h-1.5 rounded-full ${item.success ? 'bg-primary' : 'bg-error'}`} />
                        </div>
                      </div>
                      <p className="text-[11px] text-on-surface-variant truncate leading-tight">{item.query}</p>
                    </motion.button>
                  )
                })
              )}
            </div>
          </div>
        </nav>

        {/* 用户区 */}
        <div className="p-4 border-t border-outline-variant/20 relative bg-surface-container">
          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="absolute bottom-[78px] left-4 right-4 z-20 p-4 rounded-[20px] border border-outline-variant/30 bg-surface-container-high shadow-[var(--menu-elevated-shadow,0_8px_30px_rgb(0,0,0,0.4))]"
              >
                <div className="text-xs font-bold text-on-surface-variant mb-3 px-1">主题配色</div>
                <div className="space-y-2">
                  {THEME_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setThemeId(t.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                        themeId === t.id ? 'border-primary bg-primary-container/20' : 'border-outline-variant/30 hover:bg-surface-container-highest'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${t.swatch} border border-outline-variant/30`} />
                      <span className={`text-xs font-medium ${themeId === t.id ? 'text-primary' : 'text-on-surface'}`}>{t.name}</span>
                    </button>
                  ))}
                </div>
                <VibeButton variant="surface" onClick={openApiKeyModal} className="mt-4 w-full px-3 py-2.5 text-xs rounded-xl">
                  API Key 管理
                </VibeButton>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => setUserMenuOpen((v) => !v)}
            className="w-full flex items-center gap-3 p-3 hover:bg-surface-container-high rounded-2xl transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm shrink-0">
              {user.name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-on-surface truncate">{user.name}</p>
            </div>
            <motion.div animate={{ rotate: userMenuOpen ? 180 : 0 }}>
              <ChevronDown className="w-4 h-4 text-on-surface-variant" />
            </motion.div>
          </motion.button>
        </div>
      </aside>

      {/* ── 主内容区 ── */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-background">
        <div className="flex-1 flex flex-col min-h-0 p-4 gap-3 overflow-hidden max-w-6xl mx-auto w-full">

          {/* 顶部工具条：默认展开技能广场，问句单行；结果区占满剩余高度 */}
          <div className="shrink-0 w-full">
            <div className="bg-surface-container-low px-3 py-2.5 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col gap-2">

              {skillsLoading ? (
                <div className="flex items-center gap-2 text-on-surface-variant text-xs py-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>加载技能…</span>
                </div>
              ) : skills.length === 0 ? (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-error-container/30 text-on-error-container text-xs">
                  <Store className="w-4 h-4 shrink-0" />
                  <span>后端未连接，请启动 backend</span>
                </div>
              ) : (
                <>
                  <motion.div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSkillsPanelOpen((v) => !v)}
                      aria-expanded={skillsPanelOpen}
                      className="inline-flex items-center gap-2 min-w-[148px] max-w-[min(100%,320px)] px-2.5 py-1.5 rounded-xl border border-outline-variant/40 bg-surface hover:bg-surface-variant/40 text-left transition-colors"
                    >
                      <Store className="w-4 h-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-on-surface leading-tight">技能广场</span>
                        <span className="block text-[10px] text-on-surface-variant truncate leading-tight mt-0.5">
                          {selectedSkill
                            ? `已选：${selectedSkill.title}`
                            : skillsPanelOpen
                              ? '请在下方列表选择技能'
                              : '点击展开技能列表'}
                        </span>
                      </div>
                      <motion.div animate={{ rotate: skillsPanelOpen ? 180 : 0 }} className="shrink-0">
                        <ChevronDown className="w-4 h-4 text-on-surface-variant" />
                      </motion.div>
                    </button>

                    {SKILL_VENDOR_TAGS.map((tag) => {
                      const isTagActive = skillVendorFilter === tag.id
                      const count = tag.id === 'all'
                        ? skills.length
                        : skills.filter((s) => getSkillVendor(s) === tag.id).length
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            handleSkillVendorChange(tag.id)
                            setSkillsPanelOpen(true)
                          }}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                            isTagActive
                              ? 'bg-primary text-on-primary border-primary'
                              : 'bg-surface/80 text-on-surface-variant border-outline-variant/30 hover:text-on-surface'
                          }`}
                        >
                          {tag.label}
                          <span className="ml-1 opacity-70">{count}</span>
                        </button>
                      )
                    })}
                  </motion.div>

                  <AnimatePresence initial={false}>
                    {skillsPanelOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-1 pb-1.5">
                          <span className="text-[11px] font-bold text-on-surface-variant tracking-wide">技能列表</span>
                          <span className="text-[10px] text-on-surface-variant">{filteredSkills.length} 个可用</span>
                        </div>
                        <motion.div className="max-h-[min(200px,28vh)] overflow-y-auto custom-scrollbar rounded-xl border border-outline-variant/20 bg-surface/30 p-2">
                          {filteredSkills.length === 0 ? (
                            <p className="text-xs text-on-surface-variant py-2 px-1">该分类下暂无技能</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {filteredSkills.map((skill) => {
                                const Icon = ICON_MAP[skill.icon] || Puzzle
                                const isActive = selectedSkill?.id === skill.id
                                const vendorMeta = vendorTagMeta(getSkillVendor(skill))
                                return (
                                  <button
                                    key={skill.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedSkill(skill)
                                      setQuery('')
                                      resetResultState()
                                      setSkillsPanelOpen(false)
                                    }}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-left transition-colors ${
                                      isActive
                                        ? 'bg-primary text-on-primary border-primary'
                                        : 'bg-surface border-outline-variant/30 hover:border-primary/40 text-on-surface'
                                    }`}
                                  >
                                    <Icon className="w-3.5 h-3.5 shrink-0" />
                                    <span className="text-xs font-semibold leading-tight">{skill.title}</span>
                                    <span className={`text-[8px] font-bold px-1 rounded border leading-none ${isActive ? 'border-on-primary/30 opacity-90' : vendorMeta.color}`}>
                                      {vendorMeta.shortLabel}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}

              <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={selectedSkill?.placeholder?.replace(/^例如[:：]\s*/, '') || '输入查询内容'}
                  className="flex-1 min-w-[160px] bg-surface border border-outline-variant rounded-xl px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25"
                />
                {selectedSkill?.needsSelectType && (
                  <select
                    value={selectType}
                    onChange={(e) => setSelectType(e.target.value)}
                    className="bg-surface border border-outline-variant rounded-xl px-3 py-2 text-sm text-on-surface min-w-[100px] focus:outline-none focus:border-primary appearance-none cursor-pointer"
                  >
                    {(selectedSkill.selectOptions || []).map((opt) => (
                      <option key={opt} value={opt} className="bg-surface-container">{opt}</option>
                    ))}
                  </select>
                )}
                <VibeButton
                  type="submit"
                  variant="primary"
                  disabled={loading || !selectedSkill}
                  className="px-4 py-2 rounded-xl text-sm shadow-sm disabled:opacity-60 shrink-0"
                >
                  {loading
                    ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Loader2 className="w-4 h-4" /></motion.div>
                    : <Search className="w-4 h-4" />}
                  <span className="font-bold">{loading ? '…' : '执行'}</span>
                </VibeButton>
              </form>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-2.5 py-2 bg-error-container text-on-error-container rounded-xl flex items-center gap-2 text-xs overflow-hidden"
                  >
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span className="font-medium line-clamp-2">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 结果展示（主区域） */}
          <div className="flex-1 min-h-0 w-full">
            <div className="h-full min-h-[200px] bg-surface-container-low rounded-2xl border border-outline-variant/30 overflow-hidden flex flex-col shadow-sm">

              {/* 结果区头部 */}
              <div className="px-4 py-2.5 border-b border-outline-variant/30 flex flex-col gap-2 bg-surface-container shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 bg-secondary-container text-on-secondary-container rounded-xl flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-on-surface truncate">
                        {queryResult ? `${queryResult.skillName} — ${queryResult.query}` : '查询结果'}
                      </h3>
                      {queryResult?.fileName && (
                        <p className="text-xs text-on-surface-variant font-mono mt-0.5">{queryResult.fileName}</p>
                      )}
                    </div>
                  </div>
                  {/* 前端导出按钮 */}
                  <VibeButton
                    variant="surface"
                    onClick={handleDownload}
                    disabled={!sheetData.length}
                    className="px-4 py-2 text-sm rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4" />
                    Export {fileType === 'csv' ? 'CSV' : 'Excel'}
                  </VibeButton>
                </div>

                {/* 多 Sheet 切换 */}
                {hasTableData && sheetData.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                    <div className="flex shrink-0 space-x-1 bg-surface-container-high p-1 rounded-xl border border-outline-variant/30">
                      <button
                        onClick={() => setPreviewView('table')}
                        className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${previewView === 'table' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                      >
                        Data Table
                      </button>
                      {description && (
                        <button
                          onClick={() => setPreviewView('desc')}
                          className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${previewView === 'desc' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                        >
                          Description
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 border-l border-outline-variant/30 pl-3">
                      {sheetData.map((s) => (
                        <button
                          key={s.name}
                          onClick={() => setActiveSheetName(s.name)}
                          className={`text-xs px-4 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors ${
                            activeSheetName === s.name
                              ? 'bg-secondary-container text-on-secondary-container'
                              : 'bg-surface text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/30'
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 结果内容区 */}
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}>
                    <Loader2 className="w-10 h-10 text-primary mb-4" />
                  </motion.div>
                  <p className="text-on-surface-variant text-sm font-medium tracking-wide">Executing skill...</p>
                </div>
              ) : hasTableData && previewView === 'table' ? (
                /* 表格视图 */
                <div className="p-6 overflow-auto flex-1 custom-scrollbar bg-surface">
                  <div className="rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm">
                    <table className="min-w-full text-sm divide-y divide-outline-variant/20">
                      <thead className="bg-surface-container sticky top-0 z-10">
                        <tr>
                          {(activeSheet?.headers || []).map((h) => (
                            <th key={h} className="px-5 py-3.5 text-left font-bold text-on-surface-variant uppercase tracking-wider border-r border-outline-variant/20 last:border-r-0 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-surface divide-y divide-outline-variant/10">
                        {(activeSheet?.rows || []).map((row, i) => (
                          <tr key={i} className="hover:bg-surface-container-lowest transition-colors">
                            {(activeSheet?.headers || []).map((h) => (
                              <td key={`${i}-${h}`} className="px-5 py-3 text-on-surface whitespace-nowrap border-r border-outline-variant/10 last:border-r-0 font-mono text-[13px]">
                                {String(row?.[h] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : hasTableData && previewView === 'desc' ? (
                /* Description 视图 */
                <div className="flex-1 overflow-auto p-8 bg-surface-container-lowest custom-scrollbar">
                  {fileType === 'markdown' ? (
                    <article className="max-w-4xl mx-auto text-on-surface leading-7">
                      <ReactMarkdown>{description || '无说明'}</ReactMarkdown>
                    </article>
                  ) : (
                    <pre className="text-primary text-sm leading-relaxed font-mono whitespace-pre-wrap max-w-4xl mx-auto">
                      {description || '无说明'}
                    </pre>
                  )}
                </div>
              ) : newsItems.length > 0 ? (
                /* 资讯卡片视图 */
                <div className="flex-1 min-h-0 p-6 overflow-auto custom-scrollbar bg-surface">
                  <div className="space-y-4 max-w-4xl mx-auto">
                    {newsItems.map((item) => (
                      <motion.article
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-3xl border border-outline-variant/30 bg-surface-container-low p-6 hover:shadow-md hover:border-primary/50 transition-all"
                      >
                        <h4 className="text-lg font-bold text-on-surface leading-tight mb-2">{item.title || '未命名资讯'}</h4>
                        <div className="flex items-center gap-2 mb-4">
                          <span className="px-2.5 py-1 rounded-md bg-secondary-container text-on-secondary-container text-[11px] font-bold tracking-wide">
                            {item.source || '未知来源'}
                          </span>
                          <span className="text-[12px] text-on-surface-variant font-medium">{item.date || '时间未知'}</span>
                        </div>
                        <p className="text-base text-on-surface-variant leading-relaxed">{truncate(item.content, 300) || '暂无摘要'}</p>
                        {item.jumpUrl && (
                          <a href={item.jumpUrl} target="_blank" rel="noreferrer" className="inline-flex items-center mt-5 text-sm font-bold text-primary hover:opacity-80 transition-opacity group">
                            阅读全文 <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                          </a>
                        )}
                      </motion.article>
                    ))}
                  </div>
                </div>
              ) : (
                /* 默认文本/空状态视图 */
                <div className="flex-1 min-h-0 p-8 overflow-auto custom-scrollbar bg-surface">
                  {description ? (
                    <div className="max-w-4xl mx-auto space-y-4">
                      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
                        <div className="text-xs font-bold tracking-wider text-primary mb-2 uppercase">Description</div>
                        {fileType === 'markdown' ? (
                          <article className="text-sm text-on-surface-variant leading-7">
                            <ReactMarkdown>{description}</ReactMarkdown>
                          </article>
                        ) : (
                          <pre className="text-sm text-on-surface-variant whitespace-pre-wrap font-mono leading-relaxed">{description}</pre>
                        )}
                      </div>
                      {rawOutput && (
                        <details className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
                          <summary className="cursor-pointer text-sm font-semibold text-on-surface">查看原始日志</summary>
                          <pre className="mt-3 text-xs text-on-surface-variant whitespace-pre-wrap font-mono leading-relaxed">{rawOutput}</pre>
                        </details>
                      )}
                    </div>
                  ) : rawOutput ? (
                    <pre className="text-base text-on-surface-variant whitespace-pre-wrap font-mono max-w-4xl mx-auto leading-relaxed">{rawOutput}</pre>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-on-surface-variant">
                      <Store className="w-12 h-12 mb-4 opacity-30" />
                      <p className="text-base font-medium opacity-60">选择上方的技能并输入查询内容以开始</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── API Key 弹窗 ── */}
      <AnimatePresence>
        {apiKeyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
              onClick={() => setApiKeyModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="relative w-[560px] max-w-[92vw] bg-surface-container-high rounded-[28px] shadow-[0_24px_60px_rgba(0,0,0,0.4)] border border-outline-variant/30 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-highest">
                <div>
                  <h3 className="text-base font-bold text-on-surface">API Key 管理</h3>
                  <div className="flex gap-2 mt-2">
                    {[
                      { id: 'mx', label: '妙想 EM' },
                      { id: 'wind', label: '万得 Wind' },
                      { id: 'tushare', label: 'Tushare' }
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setApiKeyProvider(p.id); setApiKeyReveal(false) }}
                        className={`px-3 py-1 rounded-lg text-[12px] font-bold transition-all ${apiKeyProvider === p.id ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface-variant border border-outline-variant/30'}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[12px] text-on-surface-variant mt-2">{apiKeysInfo.providerLabel}</p>
                </div>
                <VibeButton variant="ghost" onClick={() => setApiKeyModalOpen(false)} className="p-2 rounded-full">
                  <XCircle className="w-5 h-5" />
                </VibeButton>
              </div>

              <div className="p-6 space-y-5">
                {apiKeyError && (
                  <div className="p-4 bg-error-container text-on-error-container rounded-2xl text-sm font-medium">{apiKeyError}</div>
                )}

                <div className="p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Active Key</div>
                    <div className="text-sm font-mono text-primary break-all font-bold">
                      {apiKeyReveal ? (apiKeysInfo.activeKey || '—') : (apiKeysInfo.activeKeyMasked || '—')}
                    </div>
                  </div>
                  <div className="flex gap-2.5 shrink-0">
                    <VibeButton variant="surface" onClick={() => setApiKeyReveal((v) => !v)} className="px-4 py-2 text-xs rounded-xl">
                      {apiKeyReveal ? 'Hide' : 'Reveal'}
                    </VibeButton>
                    <VibeButton variant="surface" onClick={loadApiKeys} disabled={apiKeyLoading} className="px-4 py-2 text-xs rounded-xl disabled:opacity-60">
                      Refresh
                    </VibeButton>
                  </div>
                </div>

                <div className="space-y-2.5 max-h-[200px] overflow-auto custom-scrollbar pr-2">
                  {(apiKeysInfo.keys || []).length === 0 ? (
                    <div className="text-sm text-on-surface-variant text-center py-4">暂无已保存 Key</div>
                  ) : (
                    apiKeysInfo.keys.map((k) => (
                      <div key={k.index} className={`p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all ${apiKeysInfo.activeIndex === k.index ? 'border-primary bg-primary-container/10' : 'border-outline-variant/30 bg-surface'}`}>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-on-surface truncate">{k.name}</div>
                          <div className="text-[12px] font-mono text-on-surface-variant break-all mt-1">{apiKeyReveal ? k.key : k.masked}</div>
                        </div>
                        <div className="flex gap-2.5 shrink-0">
                          <VibeButton variant="primary" onClick={() => keyAction('setActive', { index: k.index })} disabled={apiKeyLoading} className="px-3.5 py-2 text-[12px] rounded-xl disabled:opacity-60">使用</VibeButton>
                          <VibeButton variant="surface" onClick={() => keyAction('delete', { index: k.index })} disabled={apiKeyLoading} className="px-3.5 py-2 text-[12px] rounded-xl disabled:opacity-60 text-error">删除</VibeButton>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  <input
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Key 名称（可选）"
                    className="w-full bg-surface border border-outline-variant rounded-2xl px-4 py-3.5 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <input
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                    placeholder={`粘贴 ${apiKeysInfo.envVar || 'API_KEY'}`}
                    className="w-full bg-surface border border-outline-variant rounded-2xl px-4 py-3.5 text-sm font-mono text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <VibeButton
                    variant="primary"
                    onClick={() => { if (newKeyValue.trim()) { keyAction('add', { name: newKeyName, key: newKeyValue, setActive: true }); setNewKeyName(''); setNewKeyValue('') } }}
                    disabled={apiKeyLoading || !newKeyValue.trim()}
                    className="w-full px-4 py-3.5 rounded-2xl text-sm shadow-md disabled:opacity-60 mt-2"
                  >
                    保存并切换
                  </VibeButton>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Logo 彩带 ── */}
      {ribbonPieces.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-[70]">
          {ribbonPieces.map((p) => (
            <span
              key={p.id}
              className="logo-ribbon-piece"
              style={{ left: `${p.x}px`, top: `${p.y}px`, '--tx': `${p.tx}px`, '--ty': `${p.ty}px`, '--rot': `${p.rotate}deg`, '--delay': `${p.delay}ms`, background: p.color }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
