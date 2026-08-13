import type { DiaryTaskHint } from './types.ts'
import { formatStoredAsLocal } from './datetime.ts'

export const TASK_BLOCK_START = '<!-- doing-list:task-excerpt:start -->'
export const TASK_BLOCK_END = '<!-- doing-list:task-excerpt:end -->'

export interface DiaryContentParts {
  userContent: string
  taskExcerpt: string
}

export interface TaskExcerptRange {
  start: number
  end: number
}

export interface VisibleDiaryContent {
  content: string
  taskExcerptRange: TaskExcerptRange | null
}

function normalizeUserContent(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').trimEnd()
}

/** 只去掉带明确边界的新式任务摘录；旧版无结束边界，保留它以避免误删用户正文。 */
export function stripImportedTaskBlock(text: string): string {
  return splitDiaryContent(text).userContent
}

export function splitDiaryContent(text: string): DiaryContentParts {
  let result = text
  let taskExcerpt = ''
  let start = result.indexOf(TASK_BLOCK_START)
  while (start >= 0) {
    const end = result.indexOf(TASK_BLOCK_END, start + TASK_BLOCK_START.length)
    if (end < 0) break

    const excerpt = result.slice(start + TASK_BLOCK_START.length, end).trim()
    if (excerpt) taskExcerpt = excerpt
    result = `${result.slice(0, start)}${result.slice(end + TASK_BLOCK_END.length)}`
    start = result.indexOf(TASK_BLOCK_START)
  }
  return { userContent: normalizeUserContent(result), taskExcerpt }
}

export function parseDiaryContent(text: string): VisibleDiaryContent {
  let cursor = 0
  let content = ''
  let taskExcerptRange: TaskExcerptRange | null = null

  while (cursor < text.length) {
    const start = text.indexOf(TASK_BLOCK_START, cursor)
    if (start < 0) break
    const end = text.indexOf(TASK_BLOCK_END, start + TASK_BLOCK_START.length)
    if (end < 0) break

    content += text.slice(cursor, start)
    let excerpt = text.slice(start + TASK_BLOCK_START.length, end)
    if (excerpt.startsWith('\r\n')) excerpt = excerpt.slice(2)
    else if (excerpt.startsWith('\n')) excerpt = excerpt.slice(1)
    if (excerpt.endsWith('\r\n')) excerpt = excerpt.slice(0, -2)
    else if (excerpt.endsWith('\n')) excerpt = excerpt.slice(0, -1)

    const excerptStart = content.length
    content += excerpt
    if (excerpt) taskExcerptRange = { start: excerptStart, end: content.length }
    cursor = end + TASK_BLOCK_END.length
  }

  content += text.slice(cursor)
  return { content, taskExcerptRange }
}

export function buildTaskExcerpt(date: string, hints: DiaryTaskHint[]): string {
  const body = hints
    .map((hint) => {
      const lines: string[] = [`- ${hint.title}`]
      const reflections = hint.reflections_on_day ?? []
      if (reflections.length) {
        for (const reflection of reflections) {
          lines.push(`  [${formatStoredAsLocal(reflection.created_at)}] ${reflection.content}`)
        }
      } else if (hint.insight?.trim()) {
        lines.push(`  心得（摘要）：${hint.insight}`)
      }
      return lines.join('\n')
    })
    .join('\n\n')
  return `—— ${date} 任务摘录 ——\n${body}`
}

export function serializeDiaryContent(userContent: string, taskExcerpt: string): string {
  const userPart = normalizeUserContent(userContent)
  const excerptPart = taskExcerpt.trim()
  if (!excerptPart) return userPart

  const importedBlock = `${TASK_BLOCK_START}\n${excerptPart}\n${TASK_BLOCK_END}`
  return userPart ? `${userPart}\n\n${importedBlock}` : importedBlock
}

export function serializeVisibleDiaryContent(
  content: string,
  taskExcerptRange: TaskExcerptRange | null
): string {
  if (!taskExcerptRange) return content
  const { start, end } = taskExcerptRange
  if (start < 0 || end <= start || end > content.length) return content

  return `${content.slice(0, start)}${TASK_BLOCK_START}\n${content.slice(start, end)}\n${TASK_BLOCK_END}${content.slice(end)}`
}

export function replaceTaskExcerpt(
  content: string,
  taskExcerptRange: TaskExcerptRange | null,
  nextExcerpt: string
): VisibleDiaryContent {
  const excerpt = nextExcerpt.trim()
  if (taskExcerptRange) {
    const nextContent = `${content.slice(0, taskExcerptRange.start)}${excerpt}${content.slice(taskExcerptRange.end)}`
    return {
      content: nextContent,
      taskExcerptRange: { start: taskExcerptRange.start, end: taskExcerptRange.start + excerpt.length }
    }
  }

  const userPart = content.trimEnd()
  const separator = userPart ? '\n\n' : ''
  const start = userPart.length + separator.length
  return {
    content: `${userPart}${separator}${excerpt}`,
    taskExcerptRange: { start, end: start + excerpt.length }
  }
}

export function updateTaskExcerptRange(
  previousContent: string,
  nextContent: string,
  taskExcerptRange: TaskExcerptRange | null
): TaskExcerptRange | null {
  if (!taskExcerptRange || previousContent === nextContent) return taskExcerptRange

  let changeStart = 0
  const sharedLength = Math.min(previousContent.length, nextContent.length)
  while (
    changeStart < sharedLength &&
    previousContent[changeStart] === nextContent[changeStart]
  ) {
    changeStart += 1
  }

  let sharedSuffix = 0
  while (
    sharedSuffix < previousContent.length - changeStart &&
    sharedSuffix < nextContent.length - changeStart &&
    previousContent[previousContent.length - 1 - sharedSuffix] ===
      nextContent[nextContent.length - 1 - sharedSuffix]
  ) {
    sharedSuffix += 1
  }

  const previousChangeEnd = previousContent.length - sharedSuffix
  const nextChangeEnd = nextContent.length - sharedSuffix
  const delta = nextContent.length - previousContent.length
  const { start, end } = taskExcerptRange

  if (previousChangeEnd === changeStart) {
    if (changeStart < start) return { start: start + delta, end: end + delta }
    if (changeStart > end) return taskExcerptRange
    return { start, end: end + delta }
  }

  const mapBoundary = (position: number): number => {
    if (position <= changeStart) return position
    if (position >= previousChangeEnd) return position + delta
    return nextChangeEnd
  }
  const nextRange = { start: mapBoundary(start), end: mapBoundary(end) }
  return nextRange.end > nextRange.start ? nextRange : null
}

export function diaryContentForDisplay(text: string): string {
  return parseDiaryContent(text).content
}
