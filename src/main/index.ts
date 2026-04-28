import { app, BrowserWindow, dialog } from 'electron'
import { ipcHandle } from './ipcSerialize'
import { dirname, join } from 'path'
import { fileURLToPath } from 'node:url'
import {
  openDatabase,
  taskRepo,
  categoryRepo,
  diaryRepo,
  configRepo,
  getTasksForDiaryHint,
  reflectionRepo
} from '../db/database'
import { copyImageToAttachments, resolveAttachmentPath } from './attachments'
import { openAiChat } from './ai'
import { formatStoredAsLocal } from '../shared/datetime'
import type { AiConfig, TaskStatus } from '../shared/types'
import { setupUpdater } from './updater'

const __dirname = dirname(fileURLToPath(import.meta.url))

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

let mainWindow: BrowserWindow | null = null

function getUserDataPath(): string {
  return app.getPath('userData')
}

function getDbPath(): string {
  return join(getUserDataPath(), 'doing-list.db')
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f1419'
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
  }

  ipcHandle('app:getUserDataPath', () => getUserDataPath())

  ipcHandle('config:get', (_e, key: string) => configRepo.get(key))
  ipcHandle('config:set', (_e, key: string, value: string) => {
    configRepo.set(key, value)
  })

  ipcHandle('categories:list', () => categoryRepo.list())
  ipcHandle('categories:create', (_e, name: string) => categoryRepo.create(name))
  ipcHandle('categories:update', (_e, id: number, name: string) => categoryRepo.update(id, name))
  ipcHandle('categories:delete', (_e, id: number) => categoryRepo.delete(id))

  ipcHandle('tasks:list', (_e, categoryId: number | null | 'all') => taskRepo.list(categoryId))
  ipcHandle('tasks:get', (_e, id: number) => taskRepo.get(id))
  ipcHandle(
    'tasks:create',
    (
      _e,
      input: {
        title: string
        description?: string
        category_id?: number | null
        insight?: string
        attachment_paths?: string[]
        status?: TaskStatus
      }
    ) => taskRepo.create(input)
  )
  ipcHandle(
    'tasks:update',
    (
      _e,
      id: number,
      input: Partial<{
        title: string
        description: string
        category_id: number | null
        insight: string
        attachment_paths: string[]
        status: TaskStatus
      }>
    ) => taskRepo.update(id, input)
  )
  ipcHandle('tasks:delete', (_e, id: number) => taskRepo.delete(id))

  ipcHandle('reflections:listByTask', (_e, taskId: number) => reflectionRepo.listByTask(Number(taskId)))
  ipcHandle(
    'reflections:add',
    (_e, payload: { taskId: number; content: string }) =>
      reflectionRepo.add(Number(payload.taskId), String(payload.content ?? ''))
  )
  ipcHandle('reflections:delete', (_e, reflectionId: number) => reflectionRepo.delete(Number(reflectionId)))

  ipcHandle('diaries:list', () => diaryRepo.list())
  ipcHandle('diaries:getByDate', (_e, date: string) => diaryRepo.getByDate(date))
  ipcHandle('diaries:getBetween', (_e, start: string, end: string) => diaryRepo.getBetween(start, end))
  ipcHandle(
    'diaries:upsert',
    (_e, input: { date: string; title?: string; content?: string }) => diaryRepo.upsert(input)
  )
  ipcHandle('diaries:delete', (_e, id: number) => diaryRepo.delete(id))
  ipcHandle('diaries:tasksForDay', (_e, date: string) => getTasksForDiaryHint(date))

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
    return r.filePaths.map((p) => copyImageToAttachments(getUserDataPath(), p))
  })

  ipcHandle('attachments:fromPaths', (_e, absolutePaths: string[]) => {
    const root = getUserDataPath()
    return absolutePaths.map((p) => copyImageToAttachments(root, p))
  })

  ipcHandle('attachments:resolveUrl', (_e, relativePath: string) => {
    const full = resolveAttachmentPath(getUserDataPath(), relativePath)
    return `file:///${full.replace(/\\/g, '/')}`
  })

  ipcHandle('ai:analyzeTask', async (_e, taskId: number) => {
    const baseUrl = configRepo.get('ai_base_url')
    const apiKey = configRepo.get('ai_api_key')
    const model = configRepo.get('ai_model')
    if (!baseUrl || !apiKey) throw new Error('请先在设置中配置 AI 的 Base URL 与 API Key')
    const task = taskRepo.get(taskId)
    if (!task) throw new Error('任务不存在')
    const cfg: AiConfig = { baseUrl, apiKey, model }
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

  ipcHandle('ai:reviewPeriod', async (_e, start: string, end: string) => {
    const baseUrl = configRepo.get('ai_base_url')
    const apiKey = configRepo.get('ai_api_key')
    const model = configRepo.get('ai_model')
    if (!baseUrl || !apiKey) throw new Error('请先在设置中配置 AI 的 Base URL 与 API Key')
    const diaries = diaryRepo.getBetween(start, end)
    if (!diaries.length) throw new Error('该时间段内没有日记内容')
    const cfg: AiConfig = { baseUrl, apiKey, model }
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
