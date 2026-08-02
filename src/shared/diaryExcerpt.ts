import type { DiaryTaskHint } from './types.ts'
import { formatStoredAsLocal } from './datetime.ts'

export const TASK_BLOCK_START = '<!-- doing-list:task-excerpt:start -->'
export const TASK_BLOCK_END = '<!-- doing-list:task-excerpt:end -->'

/** 只去掉带明确边界的新式任务摘录；旧版无结束边界，保留它以避免误删用户正文。 */
export function stripImportedTaskBlock(text: string): string {
  let result = text
  let start = result.indexOf(TASK_BLOCK_START)
  while (start >= 0) {
    const end = result.indexOf(TASK_BLOCK_END, start + TASK_BLOCK_START.length)
    if (end < 0) break
    result = `${result.slice(0, start)}${result.slice(end + TASK_BLOCK_END.length)}`
    start = result.indexOf(TASK_BLOCK_START)
  }
  return result
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
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
  return `${TASK_BLOCK_START}\n—— ${date} 任务摘录 ——\n${body}\n${TASK_BLOCK_END}`
}
