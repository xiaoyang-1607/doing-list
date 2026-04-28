import { contextBridge, ipcRenderer } from 'electron'
import type { TaskStatus } from '../shared/types'

/**
 * 结构化克隆不接受 Vue Proxy、带原型的对象等。
 * 所有传入主进程的参数一律转为 JSON 可序列化的纯数据。
 */
function ipcArg(arg: unknown): unknown {
  if (arg === null || arg === undefined) return arg
  const t = typeof arg
  if (t === 'string' || t === 'number' || t === 'boolean') return arg
  if (t === 'bigint') return Number(arg)
  if (t === 'object') {
    return JSON.parse(JSON.stringify(arg))
  }
  throw new Error(`IPC 参数不可序列化: ${t}`)
}

function invoke(channel: string, ...args: unknown[]) {
  return ipcRenderer.invoke(channel, ...args.map(ipcArg))
}

const api = {
  getUserDataPath: (): Promise<string> => invoke('app:getUserDataPath'),
  /** 检查 GitHub Releases 更新（仅打包版本） */
  checkUpdates: () => invoke('app:checkUpdates'),

  config: {
    get: (key: string): Promise<string> => invoke('config:get', key),
    set: (key: string, value: string): Promise<void> => invoke('config:set', key, value)
  },

  categories: {
    list: () => invoke('categories:list'),
    create: (name: string) => invoke('categories:create', name),
    update: (id: number, name: string) => invoke('categories:update', id, name),
    delete: (id: number) => invoke('categories:delete', id)
  },

  tasks: {
    list: (categoryId: number | null | 'all') => invoke('tasks:list', categoryId),
    get: (id: number) => invoke('tasks:get', id),
    create: (input: {
      title: string
      description?: string
      category_id?: number | null
      insight?: string
      attachment_paths?: string[]
      status?: TaskStatus
    }) => invoke('tasks:create', input),
    update: (
      id: number,
      input: Partial<{
        title: string
        description: string
        category_id: number | null
        insight: string
        attachment_paths: string[]
        status: TaskStatus
      }>
    ) => invoke('tasks:update', id, input),
    delete: (id: number) => invoke('tasks:delete', id)
  },

  reflections: {
    listByTask: (taskId: number) => invoke('reflections:listByTask', taskId),
    /** 单对象载荷，避免多参数 IPC 在部分环境下错位 */
    add: (taskId: number, content: string) =>
      invoke('reflections:add', { taskId, content }),
    delete: (reflectionId: number) => invoke('reflections:delete', reflectionId)
  },

  diaries: {
    list: () => invoke('diaries:list'),
    getByDate: (date: string) => invoke('diaries:getByDate', date),
    getBetween: (start: string, end: string) => invoke('diaries:getBetween', start, end),
    upsert: (input: { date: string; title?: string; content?: string }) =>
      invoke('diaries:upsert', input),
    delete: (id: number) => invoke('diaries:delete', id),
    tasksForDay: (date: string) => invoke('diaries:tasksForDay', date)
  },

  attachments: {
    pick: () => invoke('attachments:pick'),
    pickMany: () => invoke('attachments:pickMany'),
    fromPaths: (absolutePaths: string[]) => invoke('attachments:fromPaths', absolutePaths),
    resolveUrl: (relativePath: string) => invoke('attachments:resolveUrl', relativePath)
  },

  ai: {
    analyzeTask: (taskId: number) => invoke('ai:analyzeTask', taskId),
    reviewPeriod: (start: string, end: string) => invoke('ai:reviewPeriod', start, end)
  }
}

export type DoingListApi = typeof api

contextBridge.exposeInMainWorld('api', api)
