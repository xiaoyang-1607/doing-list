#!/usr/bin/env node
/** 提交 README.md 并推送当前分支，不经 shell 拼接用户输入。 */
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const message = process.argv.slice(2).join(' ').trim() || 'docs: update README'

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: options.quiet ? 'ignore' : 'inherit',
    shell: false
  })

  if (result.error) {
    throw result.error
  }

  return result.status ?? 1
}

if (run('git', ['add', '--', 'README.md']) !== 0) {
  process.exit(1)
}

if (run('git', ['diff', '--cached', '--quiet', '--', 'README.md'], { quiet: true }) === 0) {
  console.log('[readme-publish] README.md 没有需要提交的变更。')
  process.exit(0)
}

if (run('git', ['commit', '-m', message, '--', 'README.md']) !== 0) {
  process.exit(1)
}

process.exit(run('git', ['push', '-u', 'origin', 'HEAD']))
