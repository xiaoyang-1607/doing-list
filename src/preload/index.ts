import { contextBridge, ipcRenderer } from 'electron'
import type {
  AiConfigPublic,
  AiConfigSaveInput,
  Category,
  Diary,
  DiaryExportInput,
  DiaryExportResult,
  DiaryTaskHint,
  DiaryUpsertInput,
  Task,
  TaskCreateInput,
  TaskReflection,
  TaskStatus,
  TaskUpdateInput,
  UpdateCheckResult
} from '../shared/types'

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

function invoke<TResult>(channel: string, ...args: unknown[]): Promise<TResult> {
  return ipcRenderer.invoke(channel, ...args.map(ipcArg)) as Promise<TResult>
}

const api = {
  /** 检查 GitHub Releases 更新（仅打包版本） */
  checkUpdates: () => invoke<UpdateCheckResult>('app:checkUpdates'),

  aiConfig: {
    get: () => invoke<AiConfigPublic>('aiConfig:get'),
    save: (input: AiConfigSaveInput) => invoke<AiConfigPublic>('aiConfig:save', input)
  },

  categories: {
    list: () => invoke<Category[]>('categories:list'),
    create: (name: string) => invoke<Category>('categories:create', name),
    update: (id: number, name: string) => invoke<Category | undefined>('categories:update', id, name),
    delete: (id: number) => invoke<boolean>('categories:delete', id)
  },

  tasks: {
    list: (categoryId: number | null | 'all', status: TaskStatus | 'all' = 'all') =>
      invoke<Task[]>('tasks:list', categoryId, status),
    get: (id: number) => invoke<Task | undefined>('tasks:get', id),
    create: (input: TaskCreateInput) => invoke<Task>('tasks:create', input),
    update: (id: number, input: TaskUpdateInput) =>
      invoke<Task | undefined>('tasks:update', id, input),
    delete: (id: number) => invoke<boolean>('tasks:delete', id)
  },

  reflections: {
    listByTask: (taskId: number) => invoke<TaskReflection[]>('reflections:listByTask', taskId),
    /** 单对象载荷，避免多参数 IPC 在部分环境下错位 */
    add: (taskId: number, content: string) =>
      invoke<TaskReflection>('reflections:add', { taskId, content }),
    delete: (reflectionId: number) => invoke<boolean>('reflections:delete', reflectionId)
  },

  diaries: {
    list: () => invoke<Diary[]>('diaries:list'),
    getByDate: (date: string) => invoke<Diary | undefined>('diaries:getByDate', date),
    getBetween: (start: string, end: string) => invoke<Diary[]>('diaries:getBetween', start, end),
    upsert: (input: DiaryUpsertInput) => invoke<Diary>('diaries:upsert', input),
    delete: (id: number) => invoke<boolean>('diaries:delete', id),
    tasksForDay: (date: string) => invoke<DiaryTaskHint[]>('diaries:tasksForDay', date),
    exportToFile: (input: DiaryExportInput) =>
      invoke<DiaryExportResult>('diaries:exportToFile', input)
  },

  attachments: {
    pick: () => invoke<string | null>('attachments:pick'),
    pickMany: () => invoke<string[]>('attachments:pickMany'),
    fromPaths: (absolutePaths: string[]) => invoke<string[]>('attachments:fromPaths', absolutePaths),
    resolveUrl: (relativePath: string) => invoke<string>('attachments:resolveUrl', relativePath),
    discard: (relativePaths: string[]) => invoke<void>('attachments:discard', relativePaths)
  },

  ai: {
    analyzeTask: (taskId: number) => invoke<string>('ai:analyzeTask', taskId),
    reviewPeriod: (start: string, end: string) => invoke<string>('ai:reviewPeriod', start, end)
  }
}

export type DoingListApi = typeof api

contextBridge.exposeInMainWorld('api', api)
