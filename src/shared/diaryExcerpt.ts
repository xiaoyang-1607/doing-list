import type { DiaryTaskHint } from './types.ts'
import { formatStoredAsLocal } from './datetime.ts'

export const TASK_BLOCK_START = '<!-- doing-list:task-excerpt:start -->'
export const TASK_BLOCK_END = '<!-- doing-list:task-excerpt:end -->'

export interface DiaryContentParts {
  userContent: string
  taskExcerpt: string
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

export function diaryContentForDisplay(text: string): string {
  const { userContent, taskExcerpt } = splitDiaryContent(text)
  return [userContent, taskExcerpt].filter(Boolean).join('\n\n')
}
