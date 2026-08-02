import type {
  AiConfigSaveInput,
  DiaryExportInput,
  DiaryUpsertInput,
  TaskCreateInput,
  TaskStatus,
  TaskUpdateInput
} from '../shared/types'

const TASK_STATUSES = new Set<TaskStatus>(['todo', 'doing', 'done'])

function objectValue(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} 必须是对象`)
  }
  return value as Record<string, unknown>
}

export function stringValue(
  value: unknown,
  name: string,
  options: { trim?: boolean; min?: number; max?: number } = {}
): string {
  if (typeof value !== 'string') throw new Error(`${name} 必须是文本`)
  const result = options.trim ? value.trim() : value
  if (options.min != null && result.length < options.min) throw new Error(`${name}不能为空`)
  if (options.max != null && result.length > options.max) {
    throw new Error(`${name}不能超过 ${options.max} 个字符`)
  }
  return result
}

export function positiveInt(value: unknown, name = 'ID'): number {
  const result = Number(value)
  if (!Number.isSafeInteger(result) || result < 1) throw new Error(`无效的${name}`)
  return result
}

export function taskStatus(value: unknown, allowAll = false): TaskStatus | 'all' {
  if (allowAll && value === 'all') return 'all'
  if (!TASK_STATUSES.has(value as TaskStatus)) throw new Error('无效的任务状态')
  return value as TaskStatus
}

export function ymdDate(value: unknown, name = '日期'): string {
  const result = stringValue(value, name, { trim: true, min: 10, max: 10 })
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(result)
  if (!match) throw new Error(`${name}格式应为 YYYY-MM-DD`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`无效的${name}`)
  }
  return result
}

function optionalCategoryId(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return positiveInt(value, '分类 ID')
}

function attachmentPaths(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > 20) throw new Error('附件列表无效或数量超过 20')
  return value.map((item) => {
    const path = stringValue(item, '附件路径', { trim: true, min: 1, max: 300 })
    if (!/^attachments\/[a-zA-Z0-9._-]+$/.test(path)) throw new Error('附件路径无效')
    return path
  })
}

export function taskCreateInput(value: unknown): TaskCreateInput {
  const input = objectValue(value, '任务')
  return {
    title: stringValue(input.title, '标题', { trim: true, min: 1, max: 200 }),
    description:
      input.description === undefined
        ? undefined
        : stringValue(input.description, '描述', { max: 50_000 }),
    category_id: optionalCategoryId(input.category_id),
    attachment_paths: attachmentPaths(input.attachment_paths),
    status: input.status === undefined ? undefined : (taskStatus(input.status) as TaskStatus),
    first_reflection:
      input.first_reflection === undefined
        ? undefined
        : stringValue(input.first_reflection, '感悟', { max: 20_000 })
  }
}

export function taskUpdateInput(value: unknown): TaskUpdateInput {
  const input = objectValue(value, '任务')
  const result: TaskUpdateInput = {}
  if (input.title !== undefined) {
    result.title = stringValue(input.title, '标题', { trim: true, min: 1, max: 200 })
  }
  if (input.description !== undefined) {
    result.description = stringValue(input.description, '描述', { max: 50_000 })
  }
  if (input.category_id !== undefined) result.category_id = optionalCategoryId(input.category_id)
  if (input.attachment_paths !== undefined) result.attachment_paths = attachmentPaths(input.attachment_paths)
  if (input.status !== undefined) result.status = taskStatus(input.status) as TaskStatus
  return result
}

export function diaryUpsertInput(value: unknown): DiaryUpsertInput {
  const input = objectValue(value, '日记')
  return {
    date: ymdDate(input.date),
    title:
      input.title === undefined ? undefined : stringValue(input.title, '日记标题', { max: 300 }),
    content:
      input.content === undefined ? undefined : stringValue(input.content, '日记正文', { max: 500_000 })
  }
}

export function diaryExportInput(value: unknown): DiaryExportInput {
  const input = objectValue(value, '导出参数')
  if (input.mode === 'all') return { mode: 'all' }
  if (input.mode !== 'one') throw new Error('无效的导出模式')
  return {
    mode: 'one',
    date: ymdDate(input.date),
    title: stringValue(input.title, '日记标题', { max: 300 }),
    content: stringValue(input.content, '日记正文', { max: 500_000 })
  }
}

export function aiConfigSaveInput(value: unknown): AiConfigSaveInput {
  const input = objectValue(value, 'AI 设置')
  return {
    baseUrl: stringValue(input.baseUrl, 'Base URL', { trim: true, min: 1, max: 2_000 }),
    model: stringValue(input.model, '模型名称', { trim: true, min: 1, max: 200 }),
    apiKey:
      input.apiKey === undefined ? undefined : stringValue(input.apiKey, 'API Key', { max: 10_000 }),
    clearApiKey: input.clearApiKey === true
  }
}

export function httpBaseUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Base URL 不是有效网址')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Base URL 仅支持 HTTP 或 HTTPS')
  }
  const isLoopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if (url.protocol === 'http:' && !isLoopback) {
    throw new Error('非本机 Base URL 必须使用 HTTPS')
  }
  if (url.username || url.password) throw new Error('Base URL 不应包含用户名或密码')
  return url.toString().replace(/\/$/, '')
}
