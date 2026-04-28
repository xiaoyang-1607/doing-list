import { ipcMain } from 'electron'

/** 结构化克隆不能传带隐藏字段的对象；返回前 JSON 化，与 ipcHandle 配套。 */
export function cloneForIpcReply(result: unknown): unknown {
  if (result === null || result === undefined) return result
  const t = typeof result
  if (t === 'string' || t === 'number' || t === 'boolean') return result
  if (t === 'bigint') return Number(result)
  if (t === 'object') {
    return JSON.parse(JSON.stringify(result)) as unknown
  }
  return result
}

/** 统一包装：返回值经 clone 后再交给 IPC，避免 better-sqlite3 等返回带隐藏字段的对象 */
export function ipcHandle(
  channel: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (event: any, ...args: any[]) => any
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    const result = await fn(event, ...args)
    return cloneForIpcReply(result)
  })
}
