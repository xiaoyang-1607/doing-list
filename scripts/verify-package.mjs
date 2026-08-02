#!/usr/bin/env node
/** 在打包后的 Electron 运行时中加载 SQLite，捕获陈旧或不兼容的原生模块。 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const electronPackage = JSON.parse(
  readFileSync(resolve(root, 'node_modules', 'electron', 'package.json'), 'utf8')
)
const packagedModule = resolve(
  root,
  'release',
  'win-unpacked',
  'resources',
  'app.asar.unpacked',
  'node_modules',
  'better-sqlite3'
)
const packagedPackage = JSON.parse(readFileSync(resolve(packagedModule, 'package.json'), 'utf8'))

if (packagedPackage.version !== packageJson.dependencies['better-sqlite3']) {
  throw new Error(
    `打包后的 better-sqlite3 版本为 ${packagedPackage.version}，预期 ${packageJson.dependencies['better-sqlite3']}`
  )
}

const executable = resolve(root, 'release', 'win-unpacked', 'Doing List.exe')
const script = [
  `const Database = require(${JSON.stringify(packagedModule)})`,
  "const db = new Database(':memory:')",
  "const value = db.prepare('select 1 as ok').get().ok",
  'db.close()',
  "console.log(`${process.versions.electron} ${value}`)"
].join(';')
const result = spawnSync(executable, ['-e', script], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  shell: false
})

if (result.error) throw result.error
if (result.status !== 0) {
  throw new Error(`打包后 SQLite 冒烟测试失败：${result.stderr || `退出码 ${result.status}`}`)
}

const expectedOutput = `${electronPackage.version} 1`
if (result.stdout.trim() !== expectedOutput) {
  throw new Error(`打包后 SQLite 冒烟测试输出异常：${result.stdout.trim()}`)
}

console.log(`打包后 SQLite 冒烟测试通过：Electron ${electronPackage.version}`)
