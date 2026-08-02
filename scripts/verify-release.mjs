#!/usr/bin/env node
/** 确保发布 tag、package.json 与 CHANGELOG.md 的版本一致。 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8')
const version = packageJson.version
const expectedTag = `v${version}`
const actualTag = process.env.GITHUB_REF_NAME?.trim()

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`package.json 中的版本格式无效：${version}`)
}

if (actualTag && actualTag !== expectedTag) {
  throw new Error(`发布 tag ${actualTag} 与 package.json 版本 ${version} 不一致，应为 ${expectedTag}`)
}

if (!changelog.includes(`## [${version}]`)) {
  throw new Error(`CHANGELOG.md 缺少版本 ${version} 的发布记录`)
}

console.log(`发布版本校验通过：${actualTag || expectedTag}`)
