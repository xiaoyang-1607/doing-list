import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { utcBoundsForLocalCalendarDay } from '../shared/datetime'
import type { Category, Diary, DiaryTaskHint, Task, TaskReflection, TaskStatus } from '../shared/types'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadSchema(): string {
  try {
    return readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
  } catch {
    return ''
  }
}

const FALLBACK_SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category_id INTEGER,
  insight TEXT NOT NULL DEFAULT '',
  attachment_paths TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
CREATE TABLE IF NOT EXISTS task_reflections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_task_reflections_task ON task_reflections(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reflections_created ON task_reflections(created_at);
CREATE TABLE IF NOT EXISTS diaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_diaries_date ON diaries(date);
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
`

let db: Database.Database | null = null

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS task_reflections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_task_reflections_task ON task_reflections(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_reflections_created ON task_reflections(created_at);
  `)
  const flag = database.prepare(`SELECT value FROM config WHERE key=?`).get('migration_task_reflections_v1') as
    | { value: string }
    | undefined
  if (!flag) {
    try {
      database
        .prepare(
          `INSERT INTO task_reflections (task_id, content, created_at)
           SELECT id, insight, updated_at FROM tasks WHERE TRIM(COALESCE(insight,'')) != ''`
        )
        .run()
    } catch (e) {
      console.error('[DB] migration task_reflections copy', e)
    }
    database
      .prepare(`INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
      .run('migration_task_reflections_v1', '1')
  }
}

export function openDatabase(dbPath: string): Database.Database {
  if (db) return db
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  const sql = loadSchema() || FALLBACK_SCHEMA
  db.exec(sql)
  runMigrations(db)
  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

function rowToTask(row: Record<string, unknown>): Task {
  let paths: string[] = []
  try {
    paths = JSON.parse((row.attachment_paths as string) || '[]') as string[]
  } catch {
    paths = []
  }
  return {
    id: row.id as number,
    title: row.title as string,
    description: (row.description as string) ?? '',
    category_id: row.category_id != null ? (row.category_id as number) : null,
    category_name: (row.category_name as string) ?? null,
    insight: (row.insight as string) ?? '',
    attachment_paths: paths,
    status: row.status as TaskStatus,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    completed_at: row.completed_at != null ? (row.completed_at as string) : null
  }
}

export const taskRepo = {
  list(categoryId: number | null | 'all'): Task[] {
    const d = getDb()
    let sql = `
      SELECT t.*, c.name AS category_name
      FROM tasks t
      LEFT JOIN categories c ON c.id = t.category_id
    `
    const params: (number | string)[] = []
    if (categoryId === 'all') {
      /* 不筛选 */
    } else if (categoryId === null || categoryId === undefined) {
      sql += ` WHERE t.category_id IS NULL`
    } else {
      sql += ` WHERE t.category_id = ?`
      params.push(categoryId)
    }
    sql += ` ORDER BY t.created_at DESC`
    const stmt = d.prepare(sql)
    const rows = params.length ? stmt.all(...params) : stmt.all()
    return (rows as Record<string, unknown>[]).map(rowToTask)
  },

  get(id: number): Task | undefined {
    const d = getDb()
    const row = d
      .prepare(
        `SELECT t.*, c.name AS category_name FROM tasks t
         LEFT JOIN categories c ON c.id = t.category_id WHERE t.id = ?`
      )
      .get(id) as Record<string, unknown> | undefined
    return row ? rowToTask(row) : undefined
  },

  create(input: {
    title: string
    description?: string
    category_id?: number | null
    insight?: string
    attachment_paths?: string[]
    status?: TaskStatus
  }): Task {
    const d = getDb()
    const now = new Date().toISOString()
    const result = d
      .prepare(
        `INSERT INTO tasks (title, description, category_id, insight, attachment_paths, status, created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.title,
        input.description ?? '',
        input.category_id ?? null,
        input.insight ?? '',
        JSON.stringify(input.attachment_paths ?? []),
        input.status ?? 'todo',
        now,
        now,
        input.status === 'done' ? now : null
      )
    const id = Number(result.lastInsertRowid)
    return this.get(id)!
  },

  update(
    id: number,
    input: Partial<{
      title: string
      description: string
      category_id: number | null
      insight: string
      attachment_paths: string[]
      status: TaskStatus
    }>
  ): Task | undefined {
    const d = getDb()
    const cur = this.get(id)
    if (!cur) return undefined
    const now = new Date().toISOString()
    const title = input.title ?? cur.title
    const description = input.description ?? cur.description
    const category_id =
      input.category_id !== undefined ? input.category_id : cur.category_id
    const insight = input.insight ?? cur.insight
    const attachment_paths = input.attachment_paths ?? cur.attachment_paths
    let status = input.status ?? cur.status
    let completed_at = cur.completed_at
    if (input.status === 'done' && cur.status !== 'done') {
      completed_at = now
    } else if (input.status && input.status !== 'done') {
      completed_at = null
    }
    d.prepare(
      `UPDATE tasks SET title=?, description=?, category_id=?, insight=?, attachment_paths=?, status=?, updated_at=?, completed_at=? WHERE id=?`
    ).run(
      title,
      description,
      category_id,
      insight,
      JSON.stringify(attachment_paths),
      status,
      now,
      completed_at,
      id
    )
    return this.get(id)
  },

  delete(id: number): boolean {
    const r = getDb().prepare(`DELETE FROM tasks WHERE id=?`).run(id)
    return r.changes > 0
  }
}

export const categoryRepo = {
  list(): Category[] {
    return getDb()
      .prepare(`SELECT * FROM categories ORDER BY name ASC`)
      .all() as Category[]
  },
  create(name: string): Category {
    const d = getDb()
    const now = new Date().toISOString()
    const r = d.prepare(`INSERT INTO categories (name, created_at) VALUES (?, ?)`).run(name, now)
    return {
      id: Number(r.lastInsertRowid),
      name,
      created_at: now
    }
  },
  update(id: number, name: string): Category | undefined {
    const d = getDb()
    d.prepare(`UPDATE categories SET name=? WHERE id=?`).run(name, id)
    return d.prepare(`SELECT * FROM categories WHERE id=?`).get(id) as Category | undefined
  },
  delete(id: number): boolean {
    return getDb().prepare(`DELETE FROM categories WHERE id=?`).run(id).changes > 0
  }
}

export const diaryRepo = {
  list(): Diary[] {
    return getDb()
      .prepare(`SELECT * FROM diaries ORDER BY date DESC`)
      .all() as Diary[]
  },
  getByDate(date: string): Diary | undefined {
    return getDb()
      .prepare(`SELECT * FROM diaries WHERE date=?`)
      .get(date) as Diary | undefined
  },
  getBetween(start: string, end: string): Diary[] {
    return getDb()
      .prepare(`SELECT * FROM diaries WHERE date >= ? AND date <= ? ORDER BY date ASC`)
      .all(start, end) as Diary[]
  },
  upsert(input: { date: string; title?: string; content?: string }): Diary {
    const d = getDb()
    const now = new Date().toISOString()
    const existing = this.getByDate(input.date)
    if (existing) {
      const title = input.title ?? existing.title
      const content = input.content ?? existing.content
      d.prepare(`UPDATE diaries SET title=?, content=?, updated_at=? WHERE date=?`).run(
        title,
        content,
        now,
        input.date
      )
      return this.getByDate(input.date)!
    }
    d.prepare(`INSERT INTO diaries (date, title, content, created_at, updated_at) VALUES (?,?,?,?,?)`).run(
      input.date,
      input.title ?? '',
      input.content ?? '',
      now,
      now
    )
    return this.getByDate(input.date)!
  },
  delete(id: number): boolean {
    return getDb().prepare(`DELETE FROM diaries WHERE id=?`).run(id).changes > 0
  }
}

export const configRepo = {
  get(key: string): string {
    const row = getDb().prepare(`SELECT value FROM config WHERE key=?`).get(key) as
      | { value: string }
      | undefined
    return row?.value ?? ''
  },
  set(key: string, value: string): void {
    getDb()
      .prepare(`INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
      .run(key, value)
  }
}

export const reflectionRepo = {
  listByTask(taskId: number): TaskReflection[] {
    const tid = Math.trunc(Number(taskId))
    if (!Number.isFinite(tid) || tid < 1) return []
    return getDb()
      .prepare(`SELECT * FROM task_reflections WHERE task_id=? ORDER BY created_at DESC`)
      .all(tid) as TaskReflection[]
  },

  add(taskId: number, content: string): TaskReflection {
    const tid = Math.trunc(Number(taskId))
    if (!Number.isFinite(tid) || tid < 1) throw new Error('无效的任务 ID')
    const c = content.trim()
    if (!c) throw new Error('感悟内容不能为空')
    const d = getDb()
    const now = new Date().toISOString()
    const r = d.prepare(`INSERT INTO task_reflections (task_id, content, created_at) VALUES (?,?,?)`).run(tid, c, now)
    const latest = d
      .prepare(`SELECT content FROM task_reflections WHERE task_id=? ORDER BY created_at DESC LIMIT 1`)
      .get(tid) as { content: string } | undefined
    const insightText = latest?.content ?? c
    d.prepare(`UPDATE tasks SET insight=?, updated_at=? WHERE id=?`).run(insightText, now, tid)
    return {
      id: Number(r.lastInsertRowid),
      task_id: tid,
      content: c,
      created_at: now
    }
  },

  delete(reflectionId: number): boolean {
    const rid = Math.trunc(Number(reflectionId))
    if (!Number.isFinite(rid) || rid < 1) return false
    const d = getDb()
    const row = d.prepare(`SELECT task_id FROM task_reflections WHERE id=?`).get(rid) as
      | { task_id: number }
      | undefined
    if (!row) return false
    const taskId = row.task_id
    d.prepare(`DELETE FROM task_reflections WHERE id=?`).run(rid)
    const now = new Date().toISOString()
    const latest = d
      .prepare(`SELECT content FROM task_reflections WHERE task_id=? ORDER BY created_at DESC LIMIT 1`)
      .get(taskId) as { content: string } | undefined
    d.prepare(`UPDATE tasks SET insight=?, updated_at=? WHERE id=?`).run(latest?.content ?? '', now, taskId)
    return true
  }
}

/** 指定日历日：已完成（按完成日）或当日有更新且为进行中/已完成；并附带当日感悟时间轴条目（与日记同步） */
export function getTasksForDiaryHint(dateStr: string): DiaryTaskHint[] {
  const d = getDb()
  const { start, end } = utcBoundsForLocalCalendarDay(dateStr)
  const rows = d
    .prepare(
      `SELECT id, title, insight, status, updated_at, completed_at FROM tasks
       WHERE (
         status = 'done' AND completed_at IS NOT NULL
         AND datetime(completed_at) >= datetime(?) AND datetime(completed_at) <= datetime(?)
       ) OR (
         status IN ('doing', 'done')
         AND datetime(updated_at) >= datetime(?) AND datetime(updated_at) <= datetime(?)
       )
       ORDER BY updated_at DESC`
    )
    .all(start, end, start, end) as Record<string, unknown>[]
  return rows.map((r) => {
    const taskId = r.id as number
    const refs = d
      .prepare(
        `SELECT id, content, created_at FROM task_reflections
         WHERE task_id=? AND datetime(created_at) >= datetime(?) AND datetime(created_at) <= datetime(?)
         ORDER BY datetime(created_at) ASC`
      )
      .all(taskId, start, end) as Pick<TaskReflection, 'id' | 'content' | 'created_at'>[]
    return {
      id: taskId,
      title: r.title as string,
      insight: (r.insight as string) ?? '',
      status: r.status as TaskStatus,
      updated_at: r.updated_at as string,
      completed_at: r.completed_at != null ? (r.completed_at as string) : null,
      reflections_on_day: refs
    }
  })
}
