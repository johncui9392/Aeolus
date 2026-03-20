/**
 * Skill Registry
 *
 * Scans the skills/ directory for subdirectories containing manifest.json
 * and dynamically registers them as skill plugins.
 *
 * To add a new skill:
 * 1. Create a directory under skills/, e.g. skills/MY_NewSkill/
 * 2. Add skills/MY_NewSkill/manifest.json
 * 3. Add skills/MY_NewSkill/scripts/get_data.py
 * Restart the backend — the skill will be auto-discovered.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SKILLS_ROOT = path.resolve(__dirname, '../../skills')

/** 内部注册表，key=skillId, value=manifest+内部路径信息 */
const registry = new Map()

/**
 * 启动时调用一次，扫描并加载所有技能
 */
export function loadSkills() {
  if (!fs.existsSync(SKILLS_ROOT)) {
    console.warn(`[SkillRegistry] skills/ 目录不存在: ${SKILLS_ROOT}`)
    return
  }

  const folders = fs.readdirSync(SKILLS_ROOT).filter((f) =>
    fs.statSync(path.join(SKILLS_ROOT, f)).isDirectory()
  )

  let loaded = 0
  for (const folder of folders) {
    const manifestPath = path.join(SKILLS_ROOT, folder, 'manifest.json')
    if (!fs.existsSync(manifestPath)) continue

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

      // 注入内部路径（不对外暴露）
      manifest._scriptDir = path.join(SKILLS_ROOT, folder, 'scripts')
      manifest._skillRoot = path.join(SKILLS_ROOT, folder)

      if (!manifest.id) {
        console.warn(`[SkillRegistry] ${folder}/manifest.json 缺少 id 字段，跳过。`)
        continue
      }

      registry.set(manifest.id, manifest)
      loaded++
      console.log(`[SkillRegistry] ✓ Loaded: ${manifest.id} (${manifest.title})`)
    } catch (e) {
      console.error(`[SkillRegistry] ✗ 加载 ${folder} 失败:`, e.message)
    }
  }

  console.log(`[SkillRegistry] 共加载 ${loaded} 个技能插件。`)
}

/**
 * 返回对外公开的技能列表（不含内部路径）
 */
export function getSkills() {
  return Array.from(registry.values()).map(({ _scriptDir, _skillRoot, ...pub }) => pub)
}

/**
 * 获取完整技能配置（包含内部路径），供 pythonRunner 使用
 */
export function getSkillConfig(skillId) {
  return registry.get(skillId) || null
}
