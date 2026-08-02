export type TaskStatus = 'todo' | 'doing' | 'done'

export interface Category {
  id: number
  name: string
  created_at: string
}

export interface Task {
  id: number
  title: string
  description: string
  category_id: number | null
  category_name: string | null
  insight: string
  attachment_paths: string[]
  status: TaskStatus
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface Diary {
  id: number
  date: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface AiConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface AiConfigPublic {
  baseUrl: string
  model: string
  hasApiKey: boolean
}

export interface AiConfigSaveInput {
  baseUrl: string
  model: string
  apiKey?: string
  clearApiKey?: boolean
}

export interface TaskCreateInput {
  title: string
  description?: string
  category_id?: number | null
  attachment_paths?: string[]
  status?: TaskStatus
  first_reflection?: string
}

export type TaskUpdateInput = Partial<
  Pick<Task, 'title' | 'description' | 'category_id' | 'attachment_paths' | 'status'>
>

export interface DiaryUpsertInput {
  date: string
  title?: string
  content?: string
}

export type DiaryExportInput =
  | { mode: 'one'; date: string; title: string; content: string }
  | { mode: 'all' }

export type DiaryExportResult = { canceled: true } | { ok: true; path: string }

export type UpdateCheckResult =
  | { skipped: true; message: string }
  | { ok: true; current: string; remoteVersion: string | null }
  | { ok: false; message: string }

/** 单条任务感悟（时间轴一条） */
export interface TaskReflection {
  id: number
  task_id: number
  content: string
  created_at: string
}

/** 日记「引入」时，每条任务附带当日感悟条目 */
export interface DiaryTaskHint {
  id: number
  title: string
  /** 与 tasks.insight 同步，一般为最新一条感悟摘要 */
  insight: string
  status: TaskStatus
  updated_at: string
  completed_at: string | null
  /** 所选日历日写下的感悟（按时间升序） */
  reflections_on_day: Pick<TaskReflection, 'id' | 'content' | 'created_at'>[]
}
