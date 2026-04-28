import { copyFileSync, mkdirSync } from 'fs'
import { extname, join } from 'path'
import { randomBytes } from 'crypto'

/** 将用户选择的文件复制到 userData/attachments，返回相对 userData 的路径，如 attachments/xxx.png */
export function copyImageToAttachments(userDataRoot: string, absoluteSourcePath: string): string {
  const dir = join(userDataRoot, 'attachments')
  mkdirSync(dir, { recursive: true })
  const ext = extname(absoluteSourcePath).toLowerCase() || '.png'
  const safeExt = /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '.png'
  const name = `${Date.now()}_${randomBytes(4).toString('hex')}${safeExt}`
  const dest = join(dir, name)
  copyFileSync(absoluteSourcePath, dest)
  return join('attachments', name).replace(/\\/g, '/')
}

export function resolveAttachmentPath(userDataRoot: string, relativePath: string): string {
  return join(userDataRoot, relativePath)
}
