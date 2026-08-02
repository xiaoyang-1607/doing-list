import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  rmSync,
  statSync
} from 'fs'
import { isAbsolute, join, relative, resolve } from 'path'
import { randomBytes } from 'crypto'

const MAX_IMAGE_BYTES = 20 * 1024 * 1024

function detectedImageExtension(absoluteSourcePath: string): string {
  const stat = statSync(absoluteSourcePath)
  if (!stat.isFile()) throw new Error('附件不是普通文件')
  if (stat.size > MAX_IMAGE_BYTES) throw new Error('单张图片不能超过 20 MB')

  const fd = openSync(absoluteSourcePath, 'r')
  const header = Buffer.alloc(12)
  try {
    readSync(fd, header, 0, header.length, 0)
  } finally {
    closeSync(fd)
  }
  if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return '.png'
  }
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return '.jpg'
  if (header.subarray(0, 6).toString('ascii') === 'GIF87a' || header.subarray(0, 6).toString('ascii') === 'GIF89a') {
    return '.gif'
  }
  if (header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP') {
    return '.webp'
  }
  if (header.subarray(0, 2).toString('ascii') === 'BM') return '.bmp'
  throw new Error('仅支持 PNG、JPEG、GIF、WebP 或 BMP 图片')
}

/** 将用户选择的文件复制到 userData/attachments，返回相对 userData 的路径，如 attachments/xxx.png */
export function copyImageToAttachments(userDataRoot: string, absoluteSourcePath: string): string {
  if (!isAbsolute(absoluteSourcePath)) throw new Error('附件源路径必须是绝对路径')
  const dir = join(userDataRoot, 'attachments')
  mkdirSync(dir, { recursive: true })
  const ext = detectedImageExtension(absoluteSourcePath)
  const name = `${Date.now()}_${randomBytes(4).toString('hex')}${ext}`
  const dest = join(dir, name)
  copyFileSync(absoluteSourcePath, dest)
  return join('attachments', name).replace(/\\/g, '/')
}

export function resolveAttachmentPath(userDataRoot: string, relativePath: string): string {
  if (typeof relativePath !== 'string' || isAbsolute(relativePath)) throw new Error('无效的附件路径')
  const attachmentRoot = resolve(userDataRoot, 'attachments')
  const candidate = resolve(userDataRoot, relativePath)
  const inside = relative(attachmentRoot, candidate)
  if (!inside || inside.startsWith('..') || isAbsolute(inside)) throw new Error('附件路径超出允许目录')
  return candidate
}

/** 删除候选列表中已经不被数据库引用的托管附件，不扫描或猜测其他文件。 */
export function cleanupUnusedAttachments(
  userDataRoot: string,
  referencedPaths: Iterable<string>,
  candidatePaths: Iterable<string>
): number {
  const referenced = new Set<string>()
  for (const path of referencedPaths) {
    try {
      referenced.add(resolveAttachmentPath(userDataRoot, path))
    } catch {
      // 数据库中的非法旧路径不会被当成受信任文件。
    }
  }
  let removed = 0
  for (const path of candidatePaths) {
    let absolutePath: string
    try {
      absolutePath = resolveAttachmentPath(userDataRoot, path)
    } catch {
      continue
    }
    if (referenced.has(absolutePath)) continue
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) continue
    rmSync(absolutePath, { force: true })
    removed++
  }
  return removed
}
