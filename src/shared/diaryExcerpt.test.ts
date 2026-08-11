import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildTaskExcerpt,
  diaryContentForDisplay,
  serializeDiaryContent,
  splitDiaryContent,
  stripImportedTaskBlock,
  TASK_BLOCK_END,
  TASK_BLOCK_START
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
})
