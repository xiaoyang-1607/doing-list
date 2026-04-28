import type { AiConfig } from '../shared/types'

export async function openAiChat(
  config: AiConfig,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const base = config.baseUrl.replace(/\/$/, '')
  const url = `${base}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o-mini',
      messages
    })
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`API ${res.status}: ${t.slice(0, 500)}`)
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const text = data.choices?.[0]?.message?.content
  if (typeof text !== 'string') throw new Error('无效的 API 响应')
  return text.trim()
}
