import type { AiConfig } from '../shared/types'

export async function openAiChat(
  config: AiConfig,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const base = config.baseUrl.replace(/\/$/, '')
  const url = `${base}/chat/completions`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o-mini',
        messages
      }),
      signal: AbortSignal.timeout(45_000)
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('AI 请求超时，请检查网络或接口地址')
    }
    throw error
  }
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
