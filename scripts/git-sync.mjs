#!/usr/bin/env node
/** 等价于依次执行 git push 与推送 tags（避免 npm 走 PowerShell 5 时无法用 &&）。 */
import { execSync } from 'node:child_process'

execSync('git push -u origin HEAD', { stdio: 'inherit' })
execSync('git push origin --tags', { stdio: 'inherit' })
