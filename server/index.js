import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const SKILLS_BASE_PATH = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(SKILLS_BASE_PATH, 'skills');
const HISTORY_DIR = path.join(SKILLS_BASE_PATH, 'history');
const XLSX_API = XLSX?.utils ? XLSX : (XLSX?.default || {});
const API_KEY_PROVIDERS = {
  mx: {
    id: 'mx',
    label: 'MX API Key',
    envVar: 'EM_API_KEY',
    filePath: path.join(SKILLS_BASE_PATH, 'EM_API_KEY.local')
  }
};

const SKILL_CONFIGS = {
  findata: {
    name: 'MX_FinData',
    pythonPath: path.join(SKILLS_DIR, 'MX_FinData', 'venv', 'Scripts', 'python.exe'),
    scriptPath: path.join(SKILLS_DIR, 'MX_FinData', 'scripts', 'get_data.py'),
    outputDir: path.join(HISTORY_DIR, 'MX_FinData'),
    args: (query) => ['--query', query]
  },
  finsearch: {
    name: 'MX_FinSearch',
    pythonPath: path.join(SKILLS_DIR, 'MX_FinSearch', 'venv', 'Scripts', 'python.exe'),
    scriptPath: path.join(SKILLS_DIR, 'MX_FinSearch', 'scripts', 'get_data.py'),
    outputDir: path.join(HISTORY_DIR, 'MX_FinSearch'),
    args: (query) => [query]
  },
  macrodata: {
    name: 'MX_MacroData',
    pythonPath: path.join(SKILLS_DIR, 'MX_MacroData', 'venv', 'Scripts', 'python.exe'),
    scriptPath: path.join(SKILLS_DIR, 'MX_MacroData', 'scripts', 'get_data.py'),
    outputDir: path.join(HISTORY_DIR, 'MX_MacroData'),
    args: (query) => ['--query', query]
  },
  stockpick: {
    name: 'MX_StockPick',
    pythonPath: path.join(SKILLS_DIR, 'MX_StockPick', 'venv', 'Scripts', 'python.exe'),
    scriptPath: path.join(SKILLS_DIR, 'MX_StockPick', 'scripts', 'get_data.py'),
    outputDir: path.join(HISTORY_DIR, 'MX_StockPick'),
    args: (query, selectType) => ['--query', query, '--select-type', selectType || 'A股']
  }
};

function resolveApiKeyProvider(providerId = 'mx') {
  const key = String(providerId || 'mx').trim().toLowerCase();
  return API_KEY_PROVIDERS[key] || null;
}

function listApiKeyProviders() {
  return Object.values(API_KEY_PROVIDERS).map((p) => ({
    id: p.id,
    label: p.label
  }));
}

function loadApiKeyFromLocalFile(providerConfig = API_KEY_PROVIDERS.mx) {
  try {
    if (!fs.existsSync(providerConfig.filePath)) {
      return '';
    }

    const content = fs.readFileSync(providerConfig.filePath, 'utf-8');
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    return lines[0] || '';
  } catch (error) {
    console.error(`读取 ${path.basename(providerConfig.filePath)} 失败:`, error);
    return '';
  }
}

function getEffectiveApiKey(providerConfig = API_KEY_PROVIDERS.mx) {
  const envKey = (process.env[providerConfig.envVar] || '').trim();
  if (envKey) return envKey;

  const fileKey = loadApiKeyFromLocalFile(providerConfig).trim();
  if (fileKey) {
    process.env[providerConfig.envVar] = fileKey;
  }
  return fileKey;
}

function parseApiKeysFileContent(content) {
  const lines = String(content || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const keys = lines
    .map((line) => {
      const eq = line.indexOf('=');
      if (eq > 0) {
        const name = line.slice(0, eq).trim();
        const key = line.slice(eq + 1).trim();
        if (!key) return null;
        return { name: name || '未命名', key };
      }
      return { name: '', key: line };
    })
    .filter(Boolean);

  return keys.map((k, i) => ({
    name: k.name || `Key ${i + 1}`,
    key: k.key
  }));
}

function readApiKeys(providerConfig = API_KEY_PROVIDERS.mx) {
  try {
    if (!fs.existsSync(providerConfig.filePath)) return [];
    const content = fs.readFileSync(providerConfig.filePath, 'utf-8');
    return parseApiKeysFileContent(content);
  } catch (error) {
    console.error(`读取 ${path.basename(providerConfig.filePath)} 失败:`, error);
    return [];
  }
}

function writeApiKeys(keys, providerConfig = API_KEY_PROVIDERS.mx) {
  const safeKeys = Array.isArray(keys) ? keys : [];
  const lines = [`# ${providerConfig.label} (first one is active)`];
  safeKeys.forEach((k, idx) => {
    const name = String(k?.name || `Key ${idx + 1}`).trim();
    const key = String(k?.key || '').trim();
    if (!key) return;
    lines.push(`${name}=${key}`);
  });
  fs.writeFileSync(providerConfig.filePath, lines.join('\n') + '\n', 'utf-8');
}

function maskKey(key) {
  const s = String(key || '');
  if (!s) return '';
  if (s.length <= 8) return '*'.repeat(s.length);
  return `${s.slice(0, 4)}****${s.slice(-4)}`;
}

function executePythonScript(config, query, additionalParams = {}) {
  return new Promise((resolve, reject) => {
    const args = config.args(query, additionalParams.selectType);
    const providerConfig = API_KEY_PROVIDERS.mx;
    const apiKey = getEffectiveApiKey(providerConfig);
    
    if (!apiKey) {
      reject(
        new Error(
          `${providerConfig.label} 未设置。请设置环境变量 ${providerConfig.envVar}，或在项目根目录 ${path.basename(providerConfig.filePath)} 中填写 key。`
        )
      );
      return;
    }
    
    const pythonProcess = spawn(config.pythonPath, [config.scriptPath, ...args], {
      env: { 
        ...process.env,
        [providerConfig.envVar]: apiKey,
        PYTHONIOENCODING: 'utf-8'
      },
      cwd: SKILLS_BASE_PATH,
      shell: true,
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const text = data.toString('utf8');
      stdout += text;
      console.log(text);
    });

    pythonProcess.stderr.on('data', (data) => {
      const text = data.toString('utf8');
      stderr += text;
      console.error(text);
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`执行失败: ${stderr || stdout}`));
      } else {
        resolve({ stdout, stderr });
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`无法启动Python进程: ${error.message}`));
    });
  });
}

function parseOutputFiles(stdout, config) {
  const files = {
    dataFiles: [],
    descriptionFile: null
  };

  const lines = stdout.split('\n');
  
  for (const line of lines) {
    if (line.includes('xlsx:') || line.includes('CSV:') || line.includes('文件:')) {
      const match = line.match(/[A-Z]:\\[^\s]+\.(xlsx|csv|txt)/i);
      if (match) {
        const filePath = match[0];
        if (filePath.endsWith('.txt') && filePath.includes('description')) {
          files.descriptionFile = filePath;
        } else {
          files.dataFiles.push(filePath);
        }
      }
    }
    
    if (line.includes('Saved:') || line.includes('描述:')) {
      const match = line.match(/[A-Z]:\\[^\s]+\.txt/i);
      if (match) {
        files.descriptionFile = match[0];
      }
    }
  }

  return files;
}

function resolveExistingPath(originalPath, config) {
  const baseName = path.basename(originalPath || '');
  const candidates = [
    originalPath,
    path.join(config.outputDir, baseName),
    path.join(HISTORY_DIR, config.name, baseName)
  ].filter(Boolean);

  const uniqueCandidates = [...new Set(candidates.map((p) => path.resolve(p)))];
  for (const candidate of uniqueCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return originalPath;
}

function readFileContent(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (error) {
    console.error(`读取文件失败 ${filePath}:`, error);
  }
  return null;
}

function isPathInsideBase(targetPath) {
  const normalizedBase = path.resolve(SKILLS_BASE_PATH);
  const normalizedTarget = path.resolve(targetPath);
  return normalizedTarget.startsWith(normalizedBase);
}

app.post('/api/query', async (req, res) => {
  const { skillType, query, selectType } = req.body;

  if (!skillType || !query) {
    return res.status(400).json({ error: '缺少必要参数: skillType 和 query' });
  }

  const config = SKILL_CONFIGS[skillType];
  if (!config) {
    return res.status(400).json({ error: '无效的 skillType' });
  }

  try {
    const result = await executePythonScript(config, query, { selectType });
    const files = parseOutputFiles(result.stdout, config);
    files.dataFiles = files.dataFiles.map((filePath) => resolveExistingPath(filePath, config));
    if (files.descriptionFile) {
      files.descriptionFile = resolveExistingPath(files.descriptionFile, config);
    }
    
    let description = null;
    if (files.descriptionFile) {
      description = readFileContent(files.descriptionFile);
    }

    const dataFileContents = files.dataFiles.map(filePath => ({
      path: filePath,
      name: path.basename(filePath),
      exists: fs.existsSync(filePath)
    }));

    res.json({
      success: true,
      skillType: config.name,
      query,
      output: result.stdout,
      files: {
        dataFiles: dataFileContents,
        descriptionFile: files.descriptionFile,
        description
      }
    });
  } catch (error) {
    console.error('执行错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/api-keys', (req, res) => {
  const provider = resolveApiKeyProvider(req.query?.provider || 'mx');
  if (!provider) {
    return res.status(400).json({ success: false, error: '无效的 provider' });
  }
  const keys = readApiKeys(provider);
  const activeKey = (process.env[provider.envVar] || '').trim() || (keys[0]?.key || '');
  const activeIndex = keys.findIndex((k) => k.key === activeKey);
  return res.json({
    success: true,
    provider: provider.id,
    providerLabel: provider.label,
    envVar: provider.envVar,
    storageFile: path.basename(provider.filePath),
    providers: listApiKeyProviders(),
    activeIndex: activeIndex >= 0 ? activeIndex : 0,
    activeKey,
    activeKeyMasked: maskKey(activeKey),
    keys: keys.map((k, idx) => ({
      index: idx,
      name: k.name,
      key: k.key,
      masked: maskKey(k.key)
    }))
  });
});

app.post('/api/api-keys', (req, res) => {
  try {
    const provider = resolveApiKeyProvider(req.body?.provider || req.query?.provider || 'mx');
    if (!provider) {
      return res.status(400).json({ success: false, error: '无效的 provider' });
    }
    const { action } = req.body || {};
    const keys = readApiKeys(provider);

    if (action === 'setActive') {
      const index = Number(req.body?.index);
      if (!Number.isFinite(index) || index < 0 || index >= keys.length) {
        return res.status(400).json({ success: false, error: '无效的 key 索引' });
      }
      const next = [keys[index], ...keys.filter((_, i) => i !== index)];
      writeApiKeys(next, provider);
      process.env[provider.envVar] = next[0]?.key || '';
      return res.json({ success: true });
    }

    if (action === 'add') {
      const key = String(req.body?.key || '').trim();
      const name = String(req.body?.name || '').trim() || `Key ${keys.length + 1}`;
      const setActive = Boolean(req.body?.setActive);
      if (!key) {
        return res.status(400).json({ success: false, error: 'key 不能为空' });
      }
      const deduped = keys.filter((k) => k.key !== key);
      const inserted = { name, key };
      const next = setActive ? [inserted, ...deduped] : [...deduped, inserted];
      writeApiKeys(next, provider);
      if (setActive) process.env[provider.envVar] = key;
      return res.json({ success: true });
    }

    if (action === 'delete') {
      const index = Number(req.body?.index);
      if (!Number.isFinite(index) || index < 0 || index >= keys.length) {
        return res.status(400).json({ success: false, error: '无效的 key 索引' });
      }
      const next = keys.filter((_, i) => i !== index);
      writeApiKeys(next, provider);
      const current = (process.env[provider.envVar] || '').trim();
      if (current && keys[index]?.key === current) {
        process.env[provider.envVar] = next[0]?.key || '';
      }
      return res.json({ success: true });
    }

    return res.status(400).json({ success: false, error: '未知 action' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || '更新 key 失败' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const SKILL_FOLDER_MAP = {
  MX_FinData: 'findata',
  MX_FinSearch: 'finsearch',
  MX_MacroData: 'macrodata',
  MX_StockPick: 'stockpick'
};
const SKILL_TITLE_MAP = {
  MX_FinData: '金融数据查询',
  MX_FinSearch: '金融资讯搜索',
  MX_MacroData: '宏观经济数据',
  MX_StockPick: '选股/选基金'
};

function loadQueryHistoryFromHistory() {
  const items = [];
  if (!fs.existsSync(HISTORY_DIR)) return items;

  // 动态读取 history 下所有子文件夹，兼容未来新增技能
  const skillFolders = fs.readdirSync(HISTORY_DIR).filter((f) => {
    return fs.statSync(path.join(HISTORY_DIR, f)).isDirectory();
  });

  for (const folder of skillFolders) {
    const dir = path.join(HISTORY_DIR, folder);
    if (!fs.existsSync(dir)) continue;

    const skillId = SKILL_FOLDER_MAP[folder] || folder.toLowerCase();
    const skillName = SKILL_TITLE_MAP[folder] || folder;

    if (folder === 'MX_FinSearch') {
      const files = fs.readdirSync(dir).filter((f) => f.startsWith('financial_search_') && f.endsWith('.txt'));
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
      items.push({
        id: `file-${folder}-${path.basename(file, '.txt')}`,
        source: 'aeolus',
        skillId,
        skillName,
        query: '金融资讯搜索',
        selectType: '',
        createdAt: stat.mtime.toISOString(),
        success: true,
        message: '已生成',
        filePath,
        dataFilePath: filePath,
        dataFileName: file
      });
      }
      continue;
    }

    const descFiles = fs.readdirSync(dir).filter((f) => f.includes('_description.txt'));
    for (const file of descFiles) {
      const filePath = path.join(dir, file);
      const baseId = path.basename(file, '_description.txt');
      let query = '';
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const match = content.match(/查询内容[：:]\s*(.+?)(?:\n|$)/);
        if (match) query = match[1].trim();
      } catch {
        // ignore
      }
      const stat = fs.statSync(filePath);
      let dataFilePath = null;
      let dataFileName = null;
      if (folder === 'MX_FinData') {
        const xlsxPath = path.join(dir, `${baseId}.xlsx`);
        if (fs.existsSync(xlsxPath)) {
          dataFilePath = xlsxPath;
          dataFileName = `${baseId}.xlsx`;
        }
      } else if (folder === 'MX_StockPick') {
        const csvPath = path.join(dir, `${baseId}.csv`);
        if (fs.existsSync(csvPath)) {
          dataFilePath = csvPath;
          dataFileName = `${baseId}.csv`;
        }
      } else if (folder === 'MX_MacroData') {
        const csvFiles = fs.readdirSync(dir).filter((f) => f.startsWith(baseId) && f.endsWith('.csv'));
        if (csvFiles.length > 0) {
          dataFilePath = path.join(dir, csvFiles[0]);
          dataFileName = csvFiles[0];
        }
      }
      items.push({
        id: `file-${folder}-${baseId}`,
        source: 'aeolus',
        skillId,
        skillName,
        query: query || `${skillName} 查询`,
        selectType: folder === 'MX_StockPick' ? 'A股' : '',
        createdAt: stat.mtime.toISOString(),
        success: true,
        message: '已生成',
        filePath,
        dataFilePath,
        dataFileName
      });
    }
  }

  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return items.slice(0, 50);
}

app.get('/api/query-history-from-files', (req, res) => {
  try {
    const items = loadQueryHistoryFromHistory();
    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/file-content', (req, res) => {
  const filePath = req.query.path;

  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ success: false, error: '缺少参数 path' });
  }

  if (!isPathInsideBase(filePath)) {
    return res.status(403).json({ success: false, error: '无权限访问该文件' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: '文件不存在' });
  }

  const ext = path.extname(filePath).toLowerCase();
  const textExts = new Set(['.txt', '.csv', '.log', '.json', '.md']);

  if (ext === '.xlsx' || ext === '.xls') {
    try {
      if (typeof XLSX_API.read !== 'function' || !XLSX_API.utils) {
        return res.status(500).json({ success: false, error: 'Excel 解析器初始化失败，请检查 xlsx 依赖导入方式。' });
      }
      const excelBuffer = fs.readFileSync(filePath);
      const workbook = XLSX_API.read(excelBuffer, { type: 'buffer', cellDates: true });
      const maxRowsPerSheet = 200;
      const maxColsPerSheet = 50;

      const sheets = workbook.SheetNames.map((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX_API.utils.sheet_to_json(worksheet, { header: 1, raw: false });
        const safeRows = rows.slice(0, maxRowsPerSheet).map((row) => {
          const normalized = Array.isArray(row) ? row : [];
          return normalized.slice(0, maxColsPerSheet);
        });

        let headers = [];
        if (safeRows.length > 0) {
          headers = safeRows[0].map((h, index) => String(h || `列${index + 1}`));
        }
        if (headers.length === 0) {
          headers = ['列1'];
        }

        const bodyRows = safeRows.slice(1).map((row) => {
          const resultRow = {};
          headers.forEach((header, index) => {
            resultRow[header] = row?.[index] ?? '';
          });
          return resultRow;
        });

        return {
          name: sheetName,
          headers,
          rows: bodyRows,
          rowCount: Math.max(safeRows.length - 1, 0)
        };
      });

      const firstSheet = sheets[0];
      const csvLines = firstSheet
        ? [firstSheet.headers.join(','), ...firstSheet.rows.map((r) => firstSheet.headers.map((h) => r[h] ?? '').join(','))]
        : [];
      const content = csvLines.join('\n');

      const xlsxBase = path.basename(filePath, ext);
      const descPath = path.join(path.dirname(filePath), xlsxBase + '_description.txt');
      let descriptionContent = '';
      if (fs.existsSync(descPath)) {
        try {
          descriptionContent = fs.readFileSync(descPath, 'utf-8');
        } catch {
          descriptionContent = '';
        }
      }

      return res.json({
        success: true,
        fileName: path.basename(filePath),
        extension: ext,
        isPreviewable: true,
        previewType: 'xlsx',
        truncated: false,
        sheets,
        content,
        descriptionContent
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: `Excel 预览失败: ${error.message}` });
    }
  }

  if (ext === '.csv') {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/).filter((line) => line.trim());
      const maxRows = 200;
      const maxCols = 50;
      if (lines.length === 0) {
        return res.json({
          success: true,
          fileName: path.basename(filePath),
          extension: ext,
          isPreviewable: true,
          previewType: 'csv',
          sheets: [{ name: 'Sheet1', headers: ['列1'], rows: [], rowCount: 0 }],
          descriptionContent: ''
        });
      }
      const headerLine = lines[0];
      const headers = headerLine.split(',').map((h) => String((h || '').trim() || '列'));
      const safeHeaders = headers.length > 0 ? headers.slice(0, maxCols) : ['列1'];
      const bodyRows = lines.slice(1, maxRows + 1).map((line) => {
        const values = line.split(',');
        const obj = {};
        safeHeaders.forEach((h, i) => {
          obj[h] = String((values[i] ?? '').trim());
        });
        return obj;
      });
      const sheets = [{ name: 'Sheet1', headers: safeHeaders, rows: bodyRows, rowCount: bodyRows.length }];
      const descPath = path.join(path.dirname(filePath), path.basename(filePath, '.csv') + '_description.txt');
      let descriptionContent = '';
      if (fs.existsSync(descPath)) {
        try {
          descriptionContent = fs.readFileSync(descPath, 'utf-8');
        } catch {
          descriptionContent = '';
        }
      }
      return res.json({
        success: true,
        fileName: path.basename(filePath),
        extension: ext,
        isPreviewable: true,
        previewType: 'csv',
        sheets,
        descriptionContent
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: `CSV 解析失败: ${error.message}` });
    }
  }

  if (!textExts.has(ext)) {
    return res.json({
      success: true,
      fileName: path.basename(filePath),
      extension: ext,
      isPreviewable: false,
      previewType: 'text',
      content: `暂不支持在线预览 ${ext || '该类型'} 文件，请点击下载查看。`
    });
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const maxLen = 20000;
    const truncated = content.length > maxLen;
    const preview = truncated ? `${content.slice(0, maxLen)}\n\n...（内容过长，已截断）` : content;

    res.json({
      success: true,
      fileName: path.basename(filePath),
      extension: ext,
      isPreviewable: true,
      previewType: 'text',
      content: preview,
      truncated
    });
  } catch (error) {
    res.status(500).json({ success: false, error: `读取文件失败: ${error.message}` });
  }
});

app.get('/api/download', (req, res) => {
  const filePath = req.query.path;

  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ success: false, error: '缺少参数 path' });
  }

  if (!isPathInsideBase(filePath)) {
    return res.status(403).json({ success: false, error: '无权限访问该文件' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: '文件不存在' });
  }

  return res.download(filePath, path.basename(filePath));
});

app.listen(PORT, () => {
  console.log(`🚀 Aeolus API Server 运行在 http://localhost:${PORT}`);
  console.log(`📁 Skills 基础路径: ${SKILLS_BASE_PATH}`);
});
