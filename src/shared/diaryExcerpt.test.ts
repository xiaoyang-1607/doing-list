import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildTaskExcerpt,
  diaryContentForDisplay,
  parseDiaryContent,
  replaceTaskExcerpt,
  serializeDiaryContent,
  serializeVisibleDiaryContent,
  splitDiaryContent,
  stripImportedTaskBlock,
  TASK_BLOCK_END,
  TASK_BLOCK_START,
  updateTaskExcerptRange
} from './diaryExcerpt.ts'
import type { DiaryTaskHint } from './types.ts'

const hint: DiaryTaskHint = {
  id: 1,
  title: '完成质量改进',
  insight: '先保护数据',
  status: 'doing',
  updated_at: '2026-08-02T02:00:00.000Z',
  completed_at: null,
  reflections_on_day: []
}

describe('diary task excerpts', () => {
  it('splits the generated block and preserves writing on both sides', () => {
    const excerpt = buildTaskExcerpt('2026-08-02', [hint])
    const content = `开头\n\n${serializeDiaryContent('', excerpt)}\n\n摘录之后继续写的正文`
    const result = splitDiaryContent(content)

    assert.equal(result.userContent, '开头\n\n摘录之后继续写的正文')
    assert.match(result.taskExcerpt, /完成质量改进/)
  })

  it('keeps a single generated block after repeated imports', () => {
    const first = serializeDiaryContent('用户正文', buildTaskExcerpt('2026-08-02', [hint]))
    const second = serializeDiaryContent(
      stripImportedTaskBlock(first),
      buildTaskExcerpt('2026-08-02', [{ ...hint, title: '更新后的任务' }])
    )

    assert.equal(second.split(TASK_BLOCK_START).length, 2)
    assert.doesNotMatch(second, /完成质量改进/)
    assert.match(second, /更新后的任务/)
  })

  it('preserves an unbounded legacy excerpt because its end cannot be identified safely', () => {
    const legacy = '用户正文\n\n—— 今日任务摘录 ——\n- 旧任务\n后来补写的正文'
    assert.equal(stripImportedTaskBlock(legacy), legacy)
  })

  it('returns marker-free content for display, export, and AI review', () => {
    const excerpt = buildTaskExcerpt('2026-08-02', [hint])
    const stored = serializeDiaryContent('今日感想', excerpt)
    const visible = diaryContentForDisplay(stored)

    assert.equal(visible, `今日感想\n\n${excerpt}`)
    assert.doesNotMatch(visible, new RegExp(TASK_BLOCK_START))
    assert.doesNotMatch(visible, new RegExp(TASK_BLOCK_END))
  })

  it('shows a stored task excerpt inside the same editable content', () => {
    const excerpt = buildTaskExcerpt('2026-08-02', [hint])
    const stored = serializeDiaryContent('今日感想', excerpt)
    const parsed = parseDiaryContent(stored)

    assert.equal(parsed.content, `今日感想\n\n${excerpt}`)
    assert.deepEqual(parsed.taskExcerptRange, {
      start: '今日感想\n\n'.length,
      end: parsed.content.length
    })
    assert.equal(serializeVisibleDiaryContent(parsed.content, parsed.taskExcerptRange), stored)
  })

  it('replaces the tracked excerpt in place without deleting later writing', () => {
    const firstExcerpt = buildTaskExcerpt('2026-08-02', [hint])
    const content = `开头\n\n${firstExcerpt}\n\n后来补写的正文`
    const range = {
      start: '开头\n\n'.length,
      end: '开头\n\n'.length + firstExcerpt.length
    }
    const nextExcerpt = buildTaskExcerpt('2026-08-02', [{ ...hint, title: '新任务' }])
    const updated = replaceTaskExcerpt(content, range, nextExcerpt)

    assert.equal(updated.content, `开头\n\n${nextExcerpt}\n\n后来补写的正文`)
    assert.doesNotMatch(updated.content, /完成质量改进/)
  })

  it('keeps tracking the excerpt when the user edits before, inside, and after it', () => {
    const original = '正文\n\n任务摘录\n\n结尾'
    const originalRange = { start: 4, end: 8 }
    const before = `新增${original}`
    const beforeRange = updateTaskExcerptRange(original, before, originalRange)
    assert.deepEqual(beforeRange, { start: 6, end: 10 })

    const inside = before.replace('任务摘录', '任务摘录已编辑')
    const insideRange = updateTaskExcerptRange(before, inside, beforeRange)
    assert.equal(inside.slice(insideRange?.start, insideRange?.end), '任务摘录已编辑')

    const after = `${inside}补充`
    assert.deepEqual(updateTaskExcerptRange(inside, after, insideRange), insideRange)
  })
})
