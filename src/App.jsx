import { useEffect, useRef, useState } from 'react'
import {
  Database,
  Search,
  TrendingUp,
  Target,
  Loader2,
  XCircle,
  FileText,
  Download,
  Terminal,
  MessageSquarePlus
} from 'lucide-react'
import axios from 'axios'

const HISTORY_STORAGE_KEY = 'aeolus_query_history'
const MAX_HISTORY_ITEMS = 20
const API_KEY_PROVIDER = 'mx'
const THEME_STORAGE_KEY = 'aeolus_theme'

const THEME_OPTIONS = [
  {
    id: 'palette-05',
    name: '紫靛赛博',
    desc: '深紫底 + 靛蓝高亮',
    swatch: 'from-indigo-400 to-cyan-400'
  },
  {
    id: 'palette-01',
    name: '蓝绿科技',
    desc: '深色背景 + 蓝绿高亮',
    swatch: 'from-cyan-300 to-cyan-500'
  }
]

const SKILL_TYPES = [
  {
    id: 'findata',
    name: 'MX_FinData',
    title: '金融数据查询',
    icon: Database,
    color: 'bg-blue-500',
    description: '查询股票、ETF、债券等金融数据',
    placeholder: '例如: 贵州茅台近期走势如何',
    needsSelectType: false
  },
  {
    id: 'finsearch',
    name: 'MX_FinSearch',
    title: '金融资讯搜索',
    icon: Search,
    color: 'bg-green-500',
    description: '搜索最新金融新闻、研报、公告',
    placeholder: '例如: 寒武纪 688256 最新研报与公告',
    needsSelectType: false
  },
  {
    id: 'macrodata',
    name: 'MX_MacroData',
    title: '宏观经济数据',
    icon: TrendingUp,
    color: 'bg-purple-500',
    description: '查询GDP、CPI、PMI等宏观数据',
    placeholder: '例如: 中国GDP',
    needsSelectType: false
  },
  {
    id: 'stockpick',
    name: 'MX_StockPick',
    title: '选股/选基金',
    icon: Target,
    color: 'bg-cyan-500',
    description: '按条件筛选股票、基金、ETF',
    placeholder: '例如: 股价大于100元',
    needsSelectType: true,
    selectOptions: ['A股', '港股', '美股', '板块', '基金', 'ETF', '可转债']
  }
]

function App() {
  const logoRef = useRef(null)
  const [selectedSkill, setSelectedSkill] = useState(SKILL_TYPES[0])
  const [query, setQuery] = useState('')
  const [selectType, setSelectType] = useState('A股')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [previewTitle, setPreviewTitle] = useState('内容预览')
  const [previewContent, setPreviewContent] = useState('请先发起查询，或在左侧点击文件预览。')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [activeFile, setActiveFile] = useState(null)
  const [previewType, setPreviewType] = useState('text')
  const [sheetData, setSheetData] = useState([])
  const [activeSheetName, setActiveSheetName] = useState('')
  const [previewView, setPreviewView] = useState('table')
  const [previewRawContent, setPreviewRawContent] = useState('')
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [themeId, setThemeId] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)
      return saved || 'palette-05'
    } catch {
      return 'palette-05'
    }
  })
  const [apiKeysInfo, setApiKeysInfo] = useState({
    provider: API_KEY_PROVIDER,
    providerLabel: 'MX API Key',
    envVar: 'EM_API_KEY',
    storageFile: 'EM_API_KEY.local',
    activeIndex: 0,
    activeKey: '',
    activeKeyMasked: '',
    keys: []
  })
  const [apiKeyReveal, setApiKeyReveal] = useState(false)
  const [apiKeyLoading, setApiKeyLoading] = useState(false)
  const [apiKeyError, setApiKeyError] = useState('')
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [ribbonPieces, setRibbonPieces] = useState([])
  const [historyItems, setHistoryItems] = useState(() => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    axios
      .get('http://localhost:3001/api/query-history-from-files')
      .then((res) => {
        const fileItems = res.data?.items || []
        if (fileItems.length === 0) return
        const localRaw = localStorage.getItem(HISTORY_STORAGE_KEY)
        let localItems = []
        try {
          localItems = localRaw ? JSON.parse(localRaw) : []
        } catch {
          localItems = []
        }
        const seen = new Set(fileItems.map((i) => i.id))
        const merged = [
          ...fileItems,
          ...localItems.filter((i) => !seen.has(i.id) && i.source !== 'aeolus')
        ]
        merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        setHistoryItems(merged.slice(0, MAX_HISTORY_ITEMS))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const nextTheme = THEME_OPTIONS.some((t) => t.id === themeId) ? themeId : 'palette-05'
    document.documentElement.setAttribute('data-theme', nextTheme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    } catch {
      // ignore storage errors
    }
  }, [themeId])

  const persistHistory = (items) => {
    setHistoryItems(items)
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items))
    } catch {
      // ignore storage errors
    }
  }

  const appendHistory = ({ skillId, skillName, queryText, selectTypeValue, success, message }) => {
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      skillId,
      skillName,
      query: queryText,
      selectType: selectTypeValue || '',
      success,
      message: message || ''
    }
    const next = [item, ...historyItems].slice(0, MAX_HISTORY_ITEMS)
    persistHistory(next)
  }

  const formatHistoryTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) {
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const parseNewsItemsFromPreview = (rawText) => {
    const text = String(rawText || '').trim()
    if (!text) return []

    const tryParse = (candidate) => {
      try {
        const obj = JSON.parse(candidate)
        const items = Array.isArray(obj?.data) ? obj.data : []
        return items
          .map((item, idx) => ({
            id: item?.code || `news-${idx}`,
            title: String(item?.title || '').trim(),
            content: String(item?.content || '').trim(),
            date: String(item?.date || '').trim(),
            source: String(item?.source || '').trim(),
            jumpUrl: String(item?.jumpUrl || '').trim()
          }))
          .filter((item) => item.title || item.content)
      } catch {
        return []
      }
    }

    // 1) 直接是 JSON
    let newsItems = tryParse(text)
    if (newsItems.length > 0) return newsItems

    // 2) 可能包在 ```json ... ``` 代码块里
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (codeBlockMatch?.[1]) {
      newsItems = tryParse(codeBlockMatch[1].trim())
      if (newsItems.length > 0) return newsItems
    }

    // 3) 兜底：截取首个 { 到最后一个 } 再试
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      newsItems = tryParse(text.slice(start, end + 1))
      if (newsItems.length > 0) return newsItems
    }

    return []
  }

  const summarizeText = (text, maxLength = 220) => {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim()
    if (normalized.length <= maxLength) return normalized
    return `${normalized.slice(0, maxLength)}...`
  }

  const getPresetQuery = (skill) => {
    const raw = String(skill?.placeholder || '')
    return raw.replace(/^例如[:：]\s*/, '').trim()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const effectiveQuery = query.trim() || getPresetQuery(selectedSkill)
    if (!effectiveQuery) {
      setError('请输入查询内容')
      return
    }
    if (!query.trim()) {
      setQuery(effectiveQuery)
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await axios.post('http://localhost:3001/api/query', {
        skillType: selectedSkill.id,
        query: effectiveQuery,
        selectType: selectedSkill.needsSelectType ? selectType : undefined
      })

      const data = response.data
      setResult(data)
      setPreviewType('text')
      setSheetData([])
      setActiveSheetName('')
      const firstFile = data?.files?.dataFiles?.find((f) => f.exists) ?? data?.files?.dataFiles?.[0]
      if (firstFile?.exists) {
        setActiveFile(firstFile)
        await handlePreviewFile(firstFile)
      } else {
        setActiveFile(null)
        if (data?.files?.description) {
          setPreviewTitle('数据说明')
          setPreviewContent(data.files.description)
        } else if (data?.output) {
          setPreviewTitle('执行输出')
          setPreviewContent(data.output)
        } else {
          setPreviewTitle('结果')
          setPreviewContent('查询已完成，但暂无可展示文本。')
        }
      }
      appendHistory({
        skillId: selectedSkill.id,
        skillName: selectedSkill.title,
        queryText: effectiveQuery,
        selectTypeValue: selectedSkill.needsSelectType ? selectType : '',
        success: true,
        message: '执行完成'
      })
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || '查询失败'
      setError(errMsg)
      setPreviewTitle('错误')
      setPreviewContent(errMsg)
      appendHistory({
        skillId: selectedSkill.id,
        skillName: selectedSkill.title,
        queryText: effectiveQuery,
        selectTypeValue: selectedSkill.needsSelectType ? selectType : '',
        success: false,
        message: errMsg
      })
    } finally {
      setLoading(false)
    }
  }

  const rerunHistoryItem = async (item) => {
    const matchedSkill = SKILL_TYPES.find((s) => s.id === item.skillId) || SKILL_TYPES[0]
    setSelectedSkill(matchedSkill)
    setQuery(item.query || '')
    setSelectType(item.selectType || 'A股')
    setError(null)
    setResult(null)
    setActiveFile(null)
    if (item.source === 'aeolus' && item.dataFilePath) {
      const file = {
        path: item.dataFilePath,
        name: item.dataFileName || item.dataFilePath?.split(/[/\\]/).pop() || '结果文件',
        exists: true
      }
      setActiveFile(file)
      await handlePreviewFile(file)
    } else {
      setPreviewType('text')
      setSheetData([])
      setActiveSheetName('')
      setPreviewTitle('历史记录')
      setPreviewContent(`已回填历史查询：${item.query || ''}\n点击“开始查询”可重新执行。`)
    }
  }

  const handlePreviewFile = async (file) => {
    if (!file?.path) return
    if (!file.exists) {
      setPreviewTitle(`文件预览：${file.name || '未知文件'}`)
      setPreviewType('text')
      setSheetData([])
      setActiveSheetName('')
      setPreviewContent('该文件在服务器上不存在，请先重新查询生成后再预览。')
      return
    }
    setPreviewLoading(true)
    setPreviewTitle(`文件预览：${file.name}`)
    setActiveFile(file)
    try {
      const response = await axios.get('http://localhost:3001/api/file-content', {
        params: { path: file.path }
      })
      const data = response.data || {}
      if (data.previewType === 'xlsx' || data.previewType === 'csv') {
        const sheets = Array.isArray(data.sheets) ? data.sheets : []
        setPreviewType(data.previewType)
        setSheetData(sheets)
        setActiveSheetName(sheets[0]?.name || '')
        setPreviewRawContent(data?.descriptionContent || '')
        setPreviewView('table')
        setPreviewContent('')
      } else {
        setPreviewType('text')
        setSheetData([])
        setActiveSheetName('')
        setPreviewRawContent('')
        setPreviewContent(data?.content || '文件内容为空')
      }
    } catch (err) {
      setPreviewType('text')
      setSheetData([])
      setActiveSheetName('')
      if (err.response?.status === 404) {
        setPreviewContent('文件不存在（可能已被移动或删除），请重新执行查询后再预览。')
      } else {
        setPreviewContent(err.response?.data?.error || err.message || '文件预览失败')
      }
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleNewSession = () => {
    setQuery('')
    setResult(null)
    setError(null)
    setActiveFile(null)
    setPreviewTitle('内容预览')
    setPreviewContent('请选择功能并开始查询。')
    setPreviewType('text')
    setSheetData([])
    setActiveSheetName('')
    setPreviewView('table')
    setPreviewRawContent('')
  }

  const loadApiKeys = async () => {
    setApiKeyLoading(true)
    setApiKeyError('')
    try {
      const res = await axios.get('http://localhost:3001/api/api-keys', {
        params: { provider: API_KEY_PROVIDER }
      })
      if (res.data?.success) {
        setApiKeysInfo(res.data)
      } else {
        setApiKeyError(res.data?.error || '加载 API Key 失败')
      }
    } catch (err) {
      setApiKeyError(err.response?.data?.error || err.message || '加载 API Key 失败')
    } finally {
      setApiKeyLoading(false)
    }
  }

  const openApiKeyModal = async () => {
    setUserMenuOpen(false)
    setApiKeyModalOpen(true)
    setApiKeyReveal(false)
    await loadApiKeys()
  }

  const setActiveApiKey = async (index) => {
    setApiKeyLoading(true)
    setApiKeyError('')
    try {
      const res = await axios.post('http://localhost:3001/api/api-keys', {
        provider: API_KEY_PROVIDER,
        action: 'setActive',
        index
      })
      if (!res.data?.success) throw new Error(res.data?.error || '切换失败')
      await loadApiKeys()
    } catch (err) {
      setApiKeyError(err.response?.data?.error || err.message || '切换失败')
    } finally {
      setApiKeyLoading(false)
    }
  }

  const addApiKey = async () => {
    const key = newKeyValue.trim()
    if (!key) return
    setApiKeyLoading(true)
    setApiKeyError('')
    try {
      const res = await axios.post('http://localhost:3001/api/api-keys', {
        provider: API_KEY_PROVIDER,
        action: 'add',
        name: newKeyName.trim(),
        key,
        setActive: true
      })
      if (!res.data?.success) throw new Error(res.data?.error || '保存失败')
      setNewKeyName('')
      setNewKeyValue('')
      await loadApiKeys()
    } catch (err) {
      setApiKeyError(err.response?.data?.error || err.message || '保存失败')
    } finally {
      setApiKeyLoading(false)
    }
  }

  const deleteApiKey = async (index) => {
    setApiKeyLoading(true)
    setApiKeyError('')
    try {
      const res = await axios.post('http://localhost:3001/api/api-keys', {
        provider: API_KEY_PROVIDER,
        action: 'delete',
        index
      })
      if (!res.data?.success) throw new Error(res.data?.error || '删除失败')
      await loadApiKeys()
    } catch (err) {
      setApiKeyError(err.response?.data?.error || err.message || '删除失败')
    } finally {
      setApiKeyLoading(false)
    }
  }

  const handleDownloadFile = (file) => {
    if (!file?.path) return
    if (!file.exists) {
      setPreviewTitle(`文件下载：${file.name || '未知文件'}`)
      setPreviewContent('该文件在服务器上不存在，请先重新查询生成后再下载。')
      return
    }
    const url = `http://localhost:3001/api/download?path=${encodeURIComponent(file.path)}`
    window.open(url, '_blank')
  }

  const triggerLogoBurst = () => {
    const rect = logoRef.current?.getBoundingClientRect()
    if (!rect) return

    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const colors = ['#00f2ea', '#818cf8', '#22d3ee', '#ff2d55', '#8efcf7']
    const pieces = Array.from({ length: 28 }).map((_, idx) => {
      const angle = (Math.PI * 2 * idx) / 28 + (Math.random() - 0.5) * 0.4
      const distance = 70 + Math.random() * 110
      return {
        id: `${Date.now()}-${idx}`,
        x: centerX,
        y: centerY,
        tx: Math.cos(angle) * distance,
        ty: Math.sin(angle) * distance - (20 + Math.random() * 30),
        rotate: Math.round((Math.random() - 0.5) * 720),
        color: colors[idx % colors.length],
        delay: Math.round(Math.random() * 120)
      }
    })

    setRibbonPieces(pieces)
    window.setTimeout(() => setRibbonPieces([]), 1100)
  }

  const previewNewsItems = parseNewsItemsFromPreview(previewContent)

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-dark)] text-[var(--text-main)]">
      <aside className="w-64 glass border-r border-glass flex flex-col shrink-0 backdrop-blur-sm">
        <div className="px-6 pt-5 pb-3">
          <h1
            ref={logoRef}
            onClick={triggerLogoBurst}
            className="text-2xl font-extrabold tracking-tight bg-clip-text text-transparent cursor-pointer select-none"
            style={{ backgroundImage: 'linear-gradient(90deg, var(--logo-grad-from), var(--logo-grad-to))' }}
          >
            Aeolus
          </h1>
          <p className="text-[11px] text-slate-400 mt-1">金融skill使用平台</p>
        </div>

        <nav className="flex-1 flex flex-col min-h-0 px-4">
          <button
            type="button"
            onClick={handleNewSession}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent-blue)] hover:bg-[var(--accent-cyan)] text-slate-900 text-sm font-semibold transition-all shadow-lg shadow-black/20"
          >
            <MessageSquarePlus className="w-4 h-4" />
            新增会话
          </button>

          <div className="text-[11px] tracking-wide text-slate-500 font-semibold px-2 mt-4 mb-2">
            历史与收藏
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <div className="space-y-2 pb-4">
              {historyItems.length === 0 ? (
                <p className="text-[11px] text-slate-500 px-3">暂无历史记录</p>
              ) : (
                historyItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => rerunHistoryItem(item)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg border border-glass hover:bg-slate-700/50 hover:border-indigo-400/30 transition-all"
                    title={item.query}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-slate-300 truncate">{item.skillName}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-500">{formatHistoryTime(item.createdAt)}</span>
                        <span className={`text-[10px] ${item.success ? 'text-cyan-400' : 'text-rose-400'}`}>
                          {item.success ? '成功' : '失败'}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5 leading-tight">{item.query}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-glass relative">
          {userMenuOpen && (
            <div className="absolute bottom-[78px] left-4 right-4 z-20 p-3 rounded-xl border border-glass bg-slate-900/95 backdrop-blur-sm shadow-2xl">
              <div className="text-[11px] text-slate-500 mb-2 px-1">配色</div>
              <div className="space-y-2">
                {THEME_OPTIONS.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setThemeId(theme.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-all ${
                      themeId === theme.id
                        ? 'border-[var(--accent-blue)] bg-slate-800/80'
                        : 'border-glass bg-slate-800/60 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-3 rounded-full bg-gradient-to-r ${theme.swatch}`} />
                      <span className="text-xs text-slate-200 truncate">{theme.name}</span>
                    </div>
                    {themeId === theme.id && <span className="text-[10px] text-[var(--accent-cyan)]">当前</span>}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={openApiKeyModal}
                className="mt-3 w-full px-3 py-2 text-xs font-medium rounded-lg bg-slate-700/60 hover:bg-slate-600/60 text-slate-200 border border-glass transition-all"
              >
                API Key 管理
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            className="w-full flex items-center space-x-3 p-2.5 hover:bg-slate-700/50 rounded-xl transition-all text-left border border-transparent hover:border-glass"
          >
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
              A
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate text-slate-300">用户中心</p>
            </div>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 p-6 gap-4 overflow-hidden">
          <div className="shrink-0 max-w-6xl mx-auto w-full">
            <div className="glass p-5 rounded-2xl border border-glass backdrop-blur-sm shadow-xl shadow-black/20">
              <div className="flex flex-wrap gap-2 mb-4">
                {SKILL_TYPES.map((skill) => {
                  const Icon = skill.icon
                  const isActive = selectedSkill.id === skill.id
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => {
                        setSelectedSkill(skill)
                        setQuery('')
                        setResult(null)
                        setError(null)
                        setActiveFile(null)
                        setPreviewTitle('内容预览')
                        setPreviewContent('请选择功能并开始查询。')
                      }}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                        isActive
                          ? 'bg-[var(--accent-blue)] text-slate-900 shadow-lg shadow-black/20'
                          : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 hover:text-slate-300 border border-glass'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <div className="text-left">
                        <div className={`text-[11px] font-mono leading-none mb-0.5 ${isActive ? 'text-slate-800/70' : 'text-slate-500'}`}>
                          {skill.name}
                        </div>
                        <div className="text-sm font-medium leading-none">{skill.title}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <label className="block text-base font-semibold text-slate-300 mb-3">
                <Terminal className="w-4 h-4 inline mr-2 text-cyan-400" />
                请输入查询内容
              </label>
              <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={selectedSkill.placeholder}
                  className="flex-1 bg-slate-900/60 border border-glass rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--accent-blue)] transition-all"
                />
                {selectedSkill.needsSelectType && (
                  <select
                    value={selectType}
                    onChange={(e) => setSelectType(e.target.value)}
                    className="bg-slate-900/60 border border-glass rounded-xl px-4 py-3 text-sm text-slate-200 min-w-[120px] focus:outline-none focus:border-[var(--accent-blue)] transition-all"
                  >
                    {selectedSkill.selectOptions.map((option) => (
                      <option key={option} value={option} className="bg-slate-800">
                        {option}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[var(--accent-blue)] hover:bg-[var(--accent-cyan)] text-slate-900 px-8 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-black/20 inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>{loading ? '查询中' : '开始查询'}</span>
                </button>
              </form>
              {error && (
                <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-sm text-rose-400">
                  <XCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col max-w-6xl mx-auto w-full">
            <div className="flex-1 min-h-0 glass rounded-2xl border border-glass overflow-hidden flex flex-col backdrop-blur-sm shadow-xl shadow-black/20">
                  <div className="px-5 py-2.5 border-b border-glass flex flex-col gap-2 bg-slate-800/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-cyan-500/20 text-cyan-400 rounded-lg flex items-center justify-center">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-200">
                            查询结果
                          </h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!activeFile?.exists && activeFile && (
                          <span className="text-[11px] px-2 py-1 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            404 错误
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => activeFile && handleDownloadFile(activeFile)}
                          disabled={!activeFile?.exists}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-700/50 border border-glass rounded-lg hover:bg-slate-600/50 hover:text-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Download className="w-3.5 h-3.5" />
                          下载
                        </button>
                      </div>
                    </div>
                    {result?.files?.dataFiles?.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto custom-scrollbar">
                        {result.files.dataFiles.map((file, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setActiveFile(file)
                              handlePreviewFile(file)
                            }}
                            disabled={!file.exists}
                            className={`text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap transition-all disabled:opacity-50 ${
                              activeFile?.path === file.path
                                ? 'bg-[var(--accent-blue)] text-slate-900 border-[var(--accent-blue)]'
                                : 'bg-slate-700/50 text-slate-400 border-glass hover:bg-slate-600/50 hover:text-slate-300'
                            }`}
                          >
                            {`结果 ${idx + 1}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {previewLoading ? (
                    <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-cyan)] mb-3" />
                      <p className="text-slate-400 text-sm">正在加载预览...</p>
                    </div>
                  ) : (
                    <>
                      {(previewType === 'xlsx' || previewType === 'csv') && sheetData.length > 0 ? (
                        <div className="flex-1 min-h-0 flex flex-col">
                          <div className="px-5 py-2 border-b border-glass bg-slate-800/30">
                            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
                              <div className="flex shrink-0 space-x-1 bg-slate-900/60 p-0.5 rounded-lg border border-glass">
                                <button
                                  type="button"
                                  onClick={() => setPreviewView('table')}
                                  className={`px-3 py-1 text-[11px] font-medium rounded-md whitespace-nowrap transition-all ${
                                    previewView === 'table' ? 'bg-[var(--accent-blue)] text-slate-900' : 'text-slate-500 hover:text-slate-300'
                                  }`}
                                >
                                  表格
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPreviewView('text')}
                                  className={`px-3 py-1 text-[11px] font-medium rounded-md whitespace-nowrap transition-all ${
                                    previewView === 'text' ? 'bg-[var(--accent-blue)] text-slate-900' : 'text-slate-500 hover:text-slate-300'
                                  }`}
                                >
                                  说明
                                </button>
                              </div>
                              {previewType === 'xlsx' && sheetData.length > 1 && (
                                <div className="flex gap-2 ml-1">
                                  {sheetData.map((sheet) => (
                                    <button
                                      key={sheet.name}
                                      type="button"
                                      onClick={() => setActiveSheetName(sheet.name)}
                                      className={`text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap transition-all ${
                                        activeSheetName === sheet.name
                                          ? 'bg-[var(--accent-blue)] text-slate-900 border-[var(--accent-blue)]'
                                          : 'bg-slate-700/50 text-slate-400 border-glass hover:bg-slate-600/50'
                                      }`}
                                    >
                                      {sheet.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          {previewView === 'table' ? (
                            <div className="p-5 overflow-auto flex-1 custom-scrollbar">
                              <table className="min-w-full text-xs border border-glass divide-y divide-slate-700/50 rounded-lg overflow-hidden">
                                <thead className="bg-slate-800/80 sticky top-0 z-10">
                                  <tr>
                                    {(sheetData.find((s) => s.name === activeSheetName)?.headers || []).map((header) => (
                                      <th
                                        key={header}
                                        className="px-4 py-3 text-left font-semibold text-[var(--accent-cyan)] uppercase tracking-wider border-b border-r border-glass last:border-r-0"
                                      >
                                        {header}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="bg-slate-900/40 divide-y divide-slate-700/40">
                                  {(sheetData.find((s) => s.name === activeSheetName)?.rows || []).map((row, rowIdx) => (
                                    <tr key={rowIdx} className="hover:bg-slate-700/30 transition-colors">
                                      {(sheetData.find((s) => s.name === activeSheetName)?.headers || []).map((header) => (
                                        <td
                                          key={`${rowIdx}-${header}`}
                                          className="px-4 py-3 text-slate-300 whitespace-nowrap border-r border-slate-700/40 last:border-r-0 font-mono text-[11px]"
                                        >
                                          {String(row?.[header] ?? '')}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="flex-1 overflow-auto p-6 bg-slate-950 custom-scrollbar">
                              <pre className="text-cyan-300 text-xs leading-relaxed font-mono whitespace-pre-wrap">
                                {previewRawContent || '无说明文件'}
                              </pre>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 min-h-0 p-5 overflow-auto custom-scrollbar">
                          {previewNewsItems.length > 0 ? (
                            <div className="space-y-3">
                              {previewNewsItems.map((item) => (
                                <article
                                  key={item.id}
                                  className="rounded-xl border border-glass bg-slate-900/40 p-4 hover:border-[var(--accent-blue)] transition-all"
                                >
                                  <h4 className="text-sm font-semibold text-slate-100 leading-6">
                                    {item.title || '未命名资讯'}
                                  </h4>
                                  <div className="mt-1 text-[11px] text-slate-500">
                                    {item.date ? item.date : '时间未知'}
                                    {item.source ? `  ·  ${item.source}` : ''}
                                  </div>
                                  <p className="mt-2 text-sm text-slate-300 leading-6">
                                    {summarizeText(item.content, 260) || '暂无摘要内容。'}
                                  </p>
                                  {item.jumpUrl && (
                                    <a
                                      href={item.jumpUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex mt-3 text-xs text-cyan-300 hover:text-cyan-200"
                                    >
                                      查看原文
                                    </a>
                                  )}
                                </article>
                              ))}
                            </div>
                          ) : (
                            <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">{previewContent}</pre>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
      </main>

      {apiKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setApiKeyModalOpen(false)}
          />
          <div className="relative w-[560px] max-w-[92vw] bg-slate-800 rounded-2xl shadow-2xl border border-glass overflow-hidden">
            <div className="px-6 py-4 border-b border-glass flex items-center justify-between bg-slate-800/80">
              <div>
                <h3 className="text-sm font-bold text-slate-200">API Key 管理</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{apiKeysInfo.providerLabel || 'MX API Key'}</p>
              </div>
              <button
                type="button"
                onClick={() => setApiKeyModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm px-3 py-1.5 rounded-lg hover:bg-slate-700/50 transition-all"
              >
                关闭
              </button>
            </div>

            <div className="p-6 space-y-4">
              {apiKeyError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-sm text-rose-400">
                  {apiKeyError}
                </div>
              )}

              <div className="p-3 rounded-xl border border-glass bg-slate-900/50 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-300">当前 Key</div>
                  <div className="mt-1 text-xs font-mono text-[var(--accent-cyan)] break-all">
                    {apiKeyReveal ? (apiKeysInfo.activeKey || '') : (apiKeysInfo.activeKeyMasked || '')}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setApiKeyReveal((v) => !v)}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-slate-300 border border-glass transition-all"
                  >
                    {apiKeyReveal ? '隐藏' : '显示'}
                  </button>
                  <button
                    type="button"
                    onClick={loadApiKeys}
                    disabled={apiKeyLoading}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-slate-300 border border-glass disabled:opacity-60 transition-all"
                  >
                    刷新
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-auto custom-scrollbar pr-1">
                {(apiKeysInfo.keys || []).length === 0 ? (
                  <div className="text-xs text-slate-500">暂无已保存 key</div>
                ) : (
                  apiKeysInfo.keys.map((k) => (
                    <div
                      key={k.index}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                        apiKeysInfo.activeIndex === k.index ? 'border-[var(--accent-blue)] bg-slate-800/80' : 'border-glass bg-slate-800/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-200 truncate">{k.name}</div>
                        <div className="text-[11px] font-mono text-slate-400 break-all">{apiKeyReveal ? k.key : k.masked}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setActiveApiKey(k.index)}
                          disabled={apiKeyLoading}
                          className="px-2.5 py-1.5 text-[11px] font-medium bg-[var(--accent-blue)] hover:bg-[var(--accent-cyan)] text-slate-900 rounded-lg disabled:opacity-60 transition-all"
                        >
                          使用
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteApiKey(k.index)}
                          disabled={apiKeyLoading}
                          className="px-2.5 py-1.5 text-[11px] font-medium bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 border border-glass rounded-lg disabled:opacity-60 transition-all"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="名称（可选）"
                  className="w-full bg-slate-900/60 border border-glass rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--accent-blue)] transition-all"
                />
                <input
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  placeholder={`粘贴 ${apiKeysInfo.envVar || 'EM_API_KEY'}`}
                  className="w-full bg-slate-900/60 border border-glass rounded-xl px-3 py-2 text-sm font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--accent-blue)] transition-all"
                />
                <button
                  type="button"
                  onClick={addApiKey}
                  disabled={apiKeyLoading || !newKeyValue.trim()}
                  className="w-full px-4 py-2 rounded-xl bg-[var(--accent-blue)] hover:bg-[var(--accent-cyan)] text-slate-900 text-sm font-semibold transition-all shadow-lg shadow-black/20 disabled:opacity-60"
                >
                  保存并切换
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {ribbonPieces.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-[70]">
          {ribbonPieces.map((piece) => (
            <span
              key={piece.id}
              className="logo-ribbon-piece"
              style={{
                left: `${piece.x}px`,
                top: `${piece.y}px`,
                '--tx': `${piece.tx}px`,
                '--ty': `${piece.ty}px`,
                '--rot': `${piece.rotate}deg`,
                '--delay': `${piece.delay}ms`,
                background: piece.color
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default App
