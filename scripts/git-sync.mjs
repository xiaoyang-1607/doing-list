#!/usr/bin/env node
/** 推送当前分支。发布 tag 必须由维护者显式推送。 */
import { spawnSync } from 'node:child_process'

const result = spawnSync('git', ['push', '-u', 'origin', 'HEAD'], {
  stdio: 'inherit',
  shell: false
})

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)
