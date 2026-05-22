#!/usr/bin/env node
/**
 * 提交 README.md 并推送到 origin（不使用 shell 里的 &&，兼容 PowerShell 5）
 * 用法: npm run readme:publish -- "提交说明"
 */
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)

const msg = process.argv.slice(2).join(' ').trim() || 'docs: update README'

execSync('git add README.md', { stdio: 'inherit', shell: true })
try {
  execSync(`git commit -m ${JSON.stringify(msg)}`, { stdio: 'inherit', shell: true })
} catch {
  console.error('[readme-publish] 无变更或提交失败（若暂无修改可忽略）')
  process.exit(1)
}
execSync('npm run sync:github', { stdio: 'inherit', shell: true, cwd: root, env: process.env })
