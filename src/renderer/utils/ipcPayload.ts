/**
 * Vue 响应式对象在传入 preload / IPC 前需转为 JSON 兼容值，
 * 否则结构化克隆会因 Proxy 等报 “could not be cloned”。
 */
export function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
