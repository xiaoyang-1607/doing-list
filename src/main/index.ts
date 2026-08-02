import { app, BrowserWindow, dialog, shell } from 'electron'
import { ipcHandle } from './ipcSerialize'
import { dirname, join } from 'path'
import { writeFileSync } from 'fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  openDatabase,
  closeDatabase,
  taskRepo,
  categoryRepo,
  diaryRepo,
  getTasksForDiaryHint,
  reflectionRepo
} from '../db/database'
import {
  cleanupUnusedAttachments,
  copyImageToAttachments,
  resolveAttachmentPath
} from './attachments'
import { openAiChat } from './ai'
import { formatStoredAsLocal } from '../shared/datetime'
import type { DiaryExportInput } from '../shared/types'
import { setupUpdater } from './updater'
import { getPrivateAiConfig, getPublicAiConfig, saveAiConfig } from './aiConfigStore'
import {
  aiConfigSaveInput,
  diaryExportInput,
  diaryUpsertInput,
  positiveInt,
  stringValue,
  taskCreateInput,
  taskStatus,
  taskUpdateInput,
  ymdDate
} from './validation'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function getUserDataPath(): string {
  return app.getPath('userData')
}

function getDbPath(): string {
  return join(getUserDataPath(), 'doing-list.db')
}

function cleanupAttachments(candidatePaths: Iterable<string>): void {
  try {
    const referenced = taskRepo.list('all', 'all').flatMap((task) => task.attachment_paths)
    const removed = cleanupUnusedAttachments(getUserDataPath(), referenced, candidatePaths)
    if (removed) console.info(`[Doing List] 已清理 ${removed} 个未引用附件`)
  } catch (error) {
    console.error('[Doing List] 清理未引用附件失败', error)
  }
}

function isHttpUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f1419'
  })
  const productionEntry = pathToFileURL(join(__dirname, '../renderer/index.html')).href
  const developmentOrigin = process.env.ELECTRON_RENDERER_URL
    ? new URL(process.env.ELECTRON_RENDERER_URL).origin
    : null
  const isAllowedRendererUrl = (url: string): boolean => {
    if (developmentOrigin) {
      try {
        return new URL(url).origin === developmentOrigin
      } catch {
        return false
      }
    }
    return url.split('#')[0] === productionEntry
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedRendererUrl(url)) return
    event.preventDefault()
    if (isHttpUrl(url)) void shell.openExternal(url)
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  try {
    openDatabase(getDbPath())
  } catch (e) {
    console.error('[Doing List] 数据库初始化失败', e)
    const msg = e instanceof Error ? e.message : String(e)
    void dialog.showErrorBox(
      '数据库初始化失败',
      `${msg}\n\n请检查磁盘权限，或尝试以管理员身份运行。若使用便携版，勿将程序放在只读目录。`
    )
    app.quit()
    return
  }

  ipcHandle('aiConfig:get', () => getPublicAiConfig())
  ipcHandle('aiConfig:save', (_e, input: unknown) => saveAiConfig(aiConfigSaveInput(input)))

  ipcHandle('categories:list', () => categoryRepo.list())
  ipcHandle('categories:create', (_e, name: unknown) =>
    categoryRepo.create(stringValue(name, '分类名称', { trim: true, min: 1, max: 100 }))
  )
  ipcHandle('categories:update', (_e, id: unknown, name: unknown) =>
    categoryRepo.update(
      positiveInt(id, '分类 ID'),
      stringValue(name, '分类名称', { trim: true, min: 1, max: 100 })
    )
  )
  ipcHandle('categories:delete', (_e, id: unknown) => categoryRepo.delete(positiveInt(id, '分类 ID')))

  ipcHandle(
    'tasks:list',
    (_e, categoryId: unknown, status: unknown = 'all') => {
      const category = categoryId === 'all' || categoryId === null
        ? categoryId
        : positiveInt(categoryId, '分类 ID')
      return taskRepo.list(category, taskStatus(status, true))
    }
  )
  ipcHandle('tasks:get', (_e, id: unknown) => taskRepo.get(positiveInt(id, '任务 ID')))
  ipcHandle('tasks:create', (_e, input: unknown) => {
    return taskRepo.create(taskCreateInput(input))
  })
  ipcHandle('tasks:update', (_e, id: unknown, input: unknown) => {
    const taskId = positiveInt(id, '任务 ID')
    const before = taskRepo.get(taskId)
    const task = taskRepo.update(taskId, taskUpdateInput(input))
    const currentPaths = new Set(task?.attachment_paths ?? [])
    cleanupAttachments((before?.attachment_paths ?? []).filter((path) => !currentPaths.has(path)))
    return task
  })
  ipcHandle('tasks:delete', (_e, id: unknown) => {
    const taskId = positiveInt(id, '任务 ID')
    const before = taskRepo.get(taskId)
    const deleted = taskRepo.delete(taskId)
    if (deleted) cleanupAttachments(before?.attachment_paths ?? [])
    return deleted
  })

  ipcHandle('reflections:listByTask', (_e, taskId: unknown) =>
    reflectionRepo.listByTask(positiveInt(taskId, '任务 ID'))
  )
  ipcHandle(
    'reflections:add',
    (_e, payload: unknown) => {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('无效的感悟参数')
      }
      const value = payload as Record<string, unknown>
      return reflectionRepo.add(
        positiveInt(value.taskId, '任务 ID'),
        stringValue(value.content, '感悟内容', { trim: true, min: 1, max: 20_000 })
      )
    }
  )
  ipcHandle('reflections:delete', (_e, reflectionId: unknown) =>
    reflectionRepo.delete(positiveInt(reflectionId, '感悟 ID'))
  )

  ipcHandle('diaries:list', () => diaryRepo.list())
  ipcHandle('diaries:getByDate', (_e, date: unknown) => diaryRepo.getByDate(ymdDate(date)))
  ipcHandle('diaries:getBetween', (_e, start: unknown, end: unknown) => {
    const from = ymdDate(start, '开始日期')
    const to = ymdDate(end, '结束日期')
    if (from > to) throw new Error('开始日期不能晚于结束日期')
    return diaryRepo.getBetween(from, to)
  })
  ipcHandle('diaries:upsert', (_e, input: unknown) => diaryRepo.upsert(diaryUpsertInput(input)))
  ipcHandle('diaries:delete', (_e, id: unknown) => diaryRepo.delete(positiveInt(id, '日记 ID')))
  ipcHandle('diaries:tasksForDay', (_e, date: unknown) => getTasksForDiaryHint(ymdDate(date)))

  ipcHandle(
    'diaries:exportToFile',
    async (
      _e,
      rawInput: unknown
    ) => {
      const input: DiaryExportInput = diaryExportInput(rawInput)
      const stamp = new Date().toISOString().slice(0, 10)
      const defaultPath =
        input.mode === 'one' ? `diary-${input.date}.md` : `doing-list-diaries-${stamp}.md`
      const r = await dialog.showSaveDialog(mainWindow!, {
        defaultPath,
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'Text', extensions: ['txt'] }
        ]
      })
      if (r.canceled || !r.filePath) return { canceled: true as const }

      const toMd = (date: string, title: string, body: string) => {
        const heading = title.trim() || '（无标题）'
        return `# ${date} ${heading}\n\n${body.trim()}\n`
      }

      let markdown: string
      if (input.mode === 'one') {
        markdown = toMd(input.date, input.title, input.content)
      } else {
        const all = diaryRepo.list()
        if (!all.length) throw new Error('暂无已保存的日记可导出')
        markdown = all.map((d) => toMd(d.date, d.title, d.content)).join('\n---\n\n')
      }

      writeFileSync(r.filePath, markdown, 'utf-8')
      return { ok: true as const, path: r.filePath }
    }
  )

  ipcHandle('attachments:pick', async () => {
    const r = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
    })
    if (r.canceled || !r.filePaths[0]) return null
    const rel = copyImageToAttachments(getUserDataPath(), r.filePaths[0])
    return rel
  })

  ipcHandle('attachments:pickMany', async () => {
    const r = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
    })
    if (r.canceled || !r.filePaths.length) return [] as string[]
    if (r.filePaths.length > 20) throw new Error('一次最多选择 20 张图片')
    return r.filePaths.map((p) => copyImageToAttachments(getUserDataPath(), p))
  })

  ipcHandle('attachments:fromPaths', (_e, absolutePaths: unknown) => {
    if (!Array.isArray(absolutePaths) || absolutePaths.length > 20) {
      throw new Error('附件列表无效或数量超过 20')
    }
    const root = getUserDataPath()
    return absolutePaths.map((path) =>
      copyImageToAttachments(
        root,
        stringValue(path, '附件源路径', { trim: true, min: 1, max: 2_000 })
      )
    )
  })

  ipcHandle('attachments:resolveUrl', (_e, relativePath: unknown) => {
    const full = resolveAttachmentPath(
      getUserDataPath(),
      stringValue(relativePath, '附件路径', { trim: true, min: 1, max: 300 })
    )
    return `file:///${full.replace(/\\/g, '/')}`
  })

  ipcHandle('attachments:discard', (_e, relativePaths: unknown) => {
    if (!Array.isArray(relativePaths) || relativePaths.length > 20) {
      throw new Error('附件列表无效或数量超过 20')
    }
    const candidates = relativePaths.map((path) =>
      stringValue(path, '附件路径', { trim: true, min: 1, max: 300 })
    )
    cleanupAttachments(candidates)
  })

  ipcHandle('ai:analyzeTask', async (_e, rawTaskId: unknown) => {
    const cfg = getPrivateAiConfig()
    if (!cfg.apiKey) throw new Error('请先在设置中配置 AI 的 API Key')
    const taskId = positiveInt(rawTaskId, '任务 ID')
    const task = taskRepo.get(taskId)
    if (!task) throw new Error('任务不存在')
    const refs = reflectionRepo.listByTask(taskId)
    const refsText =
      refs.length > 0
        ? refs
            .slice()
            .reverse()
            .map((x) => `[${formatStoredAsLocal(x.created_at)}] ${x.content}`)
            .join('\n')
        : task.insight || '（尚未填写）'
    const system =
      '你是学习教练。根据用户任务标题、描述和学习心得时间轴，用简洁中文给出可执行的下一步建议（分点列出，控制在 200 字内）。'
    const user = `标题：${task.title}\n描述：${task.description || '无'}\n感悟时间轴（旧到新）：\n${refsText}`
    return openAiChat(cfg, [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ])
  })

  ipcHandle('ai:reviewPeriod', async (_e, rawStart: unknown, rawEnd: unknown) => {
    const start = ymdDate(rawStart, '开始日期')
    const end = ymdDate(rawEnd, '结束日期')
    if (start > end) throw new Error('开始日期不能晚于结束日期')
    const cfg = getPrivateAiConfig()
    if (!cfg.apiKey) throw new Error('请先在设置中配置 AI 的 API Key')
    const diaries = diaryRepo.getBetween(start, end)
    if (!diaries.length) throw new Error('该时间段内没有日记内容')
    const blob = diaries.map((d) => `【${d.date}】${d.title}\n${d.content}`).join('\n\n---\n\n')
    const system =
      '你是心理咨询师兼效率顾问。阅读用户在这段时间的日记，用温暖、专业的中文总结：最近活动与主题、情绪与心理状态、1～3 条温和建议。控制在 400 字内。'
    return openAiChat(cfg, [
      { role: 'system', content: system },
      { role: 'user', content: `以下是指定日期范围内的日记：\n\n${blob}` }
    ])
  })

  createWindow()
  setupUpdater(() => mainWindow)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeDatabase()
})
