import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSXLib from 'xlsx'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import {
  Database, Search, TrendingUp, Target, Loader2, XCircle,
  FileText, Download, Terminal, MessageSquarePlus, ChevronRight,
  ChevronDown, Puzzle, Store
} from 'lucide-react'
import { useAuth } from './hooks/useAuth.js'

// ─── 配置 ───────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || ''
const HISTORY_KEY = 'aeolus_query_history'
const THEME_KEY = 'aeolus_theme'
const MAX_HISTORY = 20

const THEME_OPTIONS = [
  { id: 'palette-05', name: '紫靛赛博', desc: '深紫底 + 靛蓝高亮', swatch: 'from-indigo-400 to-cyan-400' },
  { id: 'palette-01', name: '蓝绿科技', desc: '深色背景 + 蓝绿高亮', swatch: 'from-cyan-300 to-cyan-500' }
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

// ─── 主应用 ──────────────────────────────────────────────────────────────────

export default function App() {
  const { user } = useAuth()
  const logoRef = useRef(null)

  // ── 技能插件（从 /api/skills 动态获取）
  const [skills, setSkills] = useState([])
  const [skillsLoading, setSkillsLoading] = useState(true)
  const [selectedSkill, setSelectedSkill] = useState(null)

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
  const [themeId, setThemeId] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || 'palette-05' } catch { return 'palette-05' }
  })
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false)
  const [ribbonPieces, setRibbonPieces] = useState([])
  const [historyItems, setHistoryItems] = useState(() => {
    try { const raw = localStorage.getItem(HISTORY_KEY); return raw ? JSON.parse(raw) : [] } catch { return [] }
  })

  // ── API Key 状态
  const [apiKeysInfo, setApiKeysInfo] = useState({ providerLabel: 'MX API Key', envVar: 'EM_API_KEY', activeKey: '', activeKeyMasked: '', activeIndex: 0, keys: [] })
  const [apiKeyReveal, setApiKeyReveal] = useState(false)
  const [apiKeyLoading, setApiKeyLoading] = useState(false)
  const [apiKeyError, setApiKeyError] = useState('')
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')

  // ── 主题同步
  useEffect(() => {
    const t = THEME_OPTIONS.find((o) => o.id === themeId) ? themeId : 'palette-05'
    document.documentElement.setAttribute('data-theme', t)
    try { localStorage.setItem(THEME_KEY, t) } catch { /* ignore */ }
  }, [themeId])

  // ── 从 /api/skills 加载技能插件商店
  useEffect(() => {
    axios.get(`${API_BASE}/api/skills`)
      .then((res) => {
        const list = res.data?.skills || []
        setSkills(list)
        setSelectedSkill(list[0] || null)
      })
      .catch(() => {
        // 后端未启动时提供静态兜底（仅 UI 展示，不可执行）
        setSkills([])
      })
      .finally(() => setSkillsLoading(false))
  }, [])

  // ── 历史记录持久化
  const saveHistory = useCallback((items) => {
    setHistoryItems(items)
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)) } catch { /* ignore */ }
  }, [])

  const pushHistory = useCallback((entry) => {
    saveHistory([entry, ...historyItems].slice(0, MAX_HISTORY))
  }, [historyItems, saveHistory])

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
      const qaMarkdown = parseQaMarkdown(data.rawOutput || '')
      const finalDescription = qaMarkdown || data.description || ''
      const finalFileType = qaMarkdown ? 'markdown' : (data.fileType || 'text')

      // 直接消费 JSON 结果，无需再次请求文件
      setQueryResult(data)
      setSheetData(data.sheets || [])
      setActiveSheetName(data.sheets?.[0]?.name || '')
      setFileType(finalFileType)
      setFileName(data.fileName || 'data')
      setDescription(finalDescription)
      setRawOutput(data.rawOutput || '')
      setPreviewView('table')

      pushHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
        skillId: selectedSkill.id,
        skillName: selectedSkill.title,
        query: effectiveQuery,
        selectType: selectedSkill.needsSelectType ? selectType : '',
        success: true
      })
    } catch (err) {
      const msg = err.response?.data?.error || err.message || '查询失败'
      setError(msg)
      pushHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
        skillId: selectedSkill?.id,
        skillName: selectedSkill?.title,
        query: effectiveQuery,
        success: false
      })
    } finally {
      setLoading(false)
    }
  }

  // ── 回填历史
  const rerunItem = (item) => {
    const skill = skills.find((s) => s.id === item.skillId)
    if (skill) setSelectedSkill(skill)
    setQuery(item.query || '')
    setSelectType(item.selectType || 'A股')
    resetResultState()
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
      const res = await axios.get(`${API_BASE}/api/api-keys`, { params: { provider: 'mx' } })
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
      const res = await axios.post(`${API_BASE}/api/api-keys`, { provider: 'mx', action, ...payload })
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
          <p className="text-[12px] text-on-surface-variant mt-1.5 font-medium">金融 Skill 平台</p>
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
              {historyItems.length === 0 ? (
                <p className="text-[12px] text-on-surface-variant px-3 py-2 text-center">暂无历史记录</p>
              ) : (
                historyItems.map((item) => (
                  <motion.button
                    key={item.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => rerunItem(item)}
                    className="w-full text-left px-3 py-2.5 rounded-xl border border-transparent hover:bg-surface-container-high hover:border-outline-variant/30 transition-colors"
                    title={item.query}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-on-surface truncate">{item.skillName}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-on-surface-variant">{formatTime(item.createdAt)}</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${item.success ? 'bg-primary' : 'bg-error'}`} />
                      </div>
                    </div>
                    <p className="text-[11px] text-on-surface-variant truncate leading-tight">{item.query}</p>
                  </motion.button>
                ))
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
                className="absolute bottom-[78px] left-4 right-4 z-20 p-4 rounded-[20px] border border-outline-variant/30 bg-surface-container-high shadow-[0_8px_30px_rgb(0,0,0,0.4)]"
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
              <p className="text-[11px] text-on-surface-variant capitalize">{user.tier} plan</p>
            </div>
            <motion.div animate={{ rotate: userMenuOpen ? 180 : 0 }}>
              <ChevronDown className="w-4 h-4 text-on-surface-variant" />
            </motion.div>
          </motion.button>
        </div>
      </aside>

      {/* ── 主内容区 ── */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-background">
        <div className="flex-1 flex flex-col min-h-0 p-6 gap-6 overflow-hidden">

          {/* 查询输入卡片 */}
          <div className="shrink-0 max-w-6xl mx-auto w-full">
            <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/30 shadow-[0_4px_20px_rgb(0,0,0,0.15)]">

              {/* 技能插件商店选择器 */}
              {skillsLoading ? (
                <div className="flex items-center gap-3 mb-6 text-on-surface-variant">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">正在加载插件商店...</span>
                </div>
              ) : skills.length === 0 ? (
                <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl bg-error-container/30 text-on-error-container">
                  <Store className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium">后端未连接，插件商店暂不可用。请启动 backend/ 服务。</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5 mb-6">
                  {skills.map((skill) => {
                    const Icon = ICON_MAP[skill.icon] || Puzzle
                    const isActive = selectedSkill?.id === skill.id
                    return (
                      <VibeButton
                        key={skill.id}
                        variant={isActive ? 'primary' : 'ghost'}
                        onClick={() => {
                          setSelectedSkill(skill)
                          setQuery('')
                          resetResultState()
                        }}
                        className={`px-4 py-3 rounded-2xl ${!isActive ? 'bg-surface hover:bg-surface-variant/50 border border-outline-variant/30' : ''}`}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        <div className="text-left ml-1.5">
                          <div className="text-[10px] font-mono leading-none mb-1 opacity-80 uppercase tracking-wider">
                            {skill.name}
                          </div>
                          <div className="text-sm font-semibold leading-none">{skill.title}</div>
                        </div>
                      </VibeButton>
                    )
                  })}
                </div>
              )}

              <label className="flex items-center text-sm font-bold text-primary mb-3 uppercase tracking-wider">
                <Terminal className="w-4 h-4 mr-2" />
                Query Input
              </label>

              <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={selectedSkill?.placeholder || '请输入查询内容'}
                  className="flex-1 bg-surface border border-outline-variant rounded-2xl px-5 py-4 text-base text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                />
                {selectedSkill?.needsSelectType && (
                  <select
                    value={selectType}
                    onChange={(e) => setSelectType(e.target.value)}
                    className="bg-surface border border-outline-variant rounded-2xl px-5 py-4 text-base text-on-surface min-w-[140px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm appearance-none cursor-pointer"
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
                  className="px-8 py-4 rounded-2xl text-base shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading
                    ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Loader2 className="w-5 h-5" /></motion.div>
                    : <Search className="w-5 h-5" />}
                  <span className="font-bold tracking-wide">{loading ? 'Processing' : 'Execute'}</span>
                </VibeButton>
              </form>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="p-4 bg-error-container text-on-error-container rounded-2xl flex items-center gap-3 overflow-hidden"
                  >
                    <XCircle className="w-5 h-5 shrink-0" />
                    <span className="text-sm font-medium">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 结果展示卡片 */}
          <div className="flex-1 min-h-0 max-w-6xl mx-auto w-full">
            <div className="h-full bg-surface-container-low rounded-3xl border border-outline-variant/30 overflow-hidden flex flex-col shadow-[0_4px_20px_rgb(0,0,0,0.15)]">

              {/* 结果区头部 */}
              <div className="px-6 py-4 border-b border-outline-variant/30 flex flex-col gap-3 bg-surface-container shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary-container text-on-secondary-container rounded-2xl flex items-center justify-center shadow-sm">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-on-surface tracking-wide">
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
                  <p className="text-[12px] text-on-surface-variant mt-1">{apiKeysInfo.providerLabel}</p>
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
