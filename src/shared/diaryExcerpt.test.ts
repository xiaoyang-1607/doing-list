import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildTaskExcerpt, stripImportedTaskBlock, TASK_BLOCK_START } from './diaryExcerpt.ts'
import type { DiaryTaskHint } from './types.ts'

const hint: DiaryTaskHint = {
  id: 1,
  title: '完成质量改造',
  insight: '先保护数据',
  status: 'doing',
  updated_at: '2026-08-02T02:00:00.000Z',
  completed_at: null,
  reflections_on_day: []
}

describe('diary task excerpts', () => {
  it('replaces only the bounded generated block and preserves later writing', () => {
    const excerpt = buildTaskExcerpt('2026-08-02', [hint])
    const content = `开头\n\n${excerpt}\n\n摘录之后继续写的正文`
    const stripped = stripImportedTaskBlock(content)
    assert.match(stripped, /开头/)
    assert.match(stripped, /摘录之后继续写的正文/)
    assert.doesNotMatch(stripped, new RegExp(TASK_BLOCK_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  })

  it('keeps a single generated block after repeated imports', () => {
    const first = `用户正文\n\n${buildTaskExcerpt('2026-08-02', [hint])}`
    const second = `${stripImportedTaskBlock(first)}\n\n${buildTaskExcerpt('2026-08-02', [hint])}`
    assert.equal(second.split(TASK_BLOCK_START).length, 2)
  })

  it('preserves an unbounded legacy excerpt because its end cannot be identified safely', () => {
    const legacy = '用户正文\n\n—— 今日任务摘录 ——\n- 旧任务\n后来补写的正文'
    assert.equal(stripImportedTaskBlock(legacy), legacy)
  })
})
