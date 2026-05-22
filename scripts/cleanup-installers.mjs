#!/usr/bin/env node
/**
 * 清理本地错误/过期的安装包与自定义安装目录（默认 0.1.0 相关路径）。
 * 用法: node scripts/cleanup-installers.mjs
 */
import { rmSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const targets = [
  resolve(root, 'release'),
  'D:/mydoinglist',
  'D:\\mydoinglist'
]

for (const target of [...new Set(targets)]) {
  if (!existsSync(target)) {
    console.log(`[skip] 不存在: ${target}`)
    continue
  }
  try {
    rmSync(target, { recursive: true, force: true })
    console.log(`[ok] 已删除: ${target}`)
  } catch (e) {
    console.error(`[fail] ${target}: ${e instanceof Error ? e.message : e}`)
    console.error('  若提示文件占用，请先关闭 Doing List 或从「设置 → 应用」卸载后再运行。')
  }
}
