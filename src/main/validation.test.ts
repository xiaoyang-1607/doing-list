import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { httpBaseUrl, taskCreateInput, ymdDate } from './validation.ts'

describe('IPC input validation', () => {
  it('accepts real calendar dates and rejects overflow dates', () => {
    assert.equal(ymdDate('2026-08-02'), '2026-08-02')
    assert.throws(() => ymdDate('2026-02-30'), /无效/)
    assert.throws(() => ymdDate('02/08/2026'), /YYYY-MM-DD/)
  })

  it('normalizes a task and rejects unsafe values', () => {
    assert.deepEqual(
      taskCreateInput({
        title: '  学习 TypeScript  ',
        status: 'doing',
        attachment_paths: ['attachments/example.png']
      }),
      {
        title: '学习 TypeScript',
        description: undefined,
        category_id: undefined,
        attachment_paths: ['attachments/example.png'],
        status: 'doing',
        first_reflection: undefined
      }
    )
    assert.throws(() => taskCreateInput({ title: 'x', status: 'unknown' }), /任务状态/)
    assert.throws(
      () => taskCreateInput({ title: 'x', attachment_paths: ['../outside.png'] }),
      /附件路径/
    )
  })

  it('only accepts HTTP-compatible AI endpoints', () => {
    assert.equal(httpBaseUrl('https://api.openai.com/v1/'), 'https://api.openai.com/v1')
    assert.equal(httpBaseUrl('http://localhost:11434/v1'), 'http://localhost:11434/v1')
    assert.throws(() => httpBaseUrl('http://example.com/v1'), /HTTPS/)
    assert.throws(() => httpBaseUrl('file:///C:/secret'), /HTTP/)
    assert.throws(() => httpBaseUrl('https://user:pass@example.com'), /用户名/)
  })
})
