#!/usr/bin/env node
/** 删除仓库内的本地构建产物。不会访问仓库外的安装目录或用户数据。 */
import { existsSync, rmSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = resolve(root, 'release')
const targetRelativePath = relative(root, target)

if (
  targetRelativePath === '' ||
  targetRelativePath.startsWith('..') ||
  targetRelativePath.includes(':')
) {
  throw new Error(`拒绝清理仓库外路径：${target}`)
}

if (!existsSync(target)) {
  console.log(`[skip] 构建产物目录不存在：${target}`)
  process.exit(0)
}

rmSync(target, { recursive: true, force: true })
console.log(`[ok] 已删除本地构建产物：${target}`)
