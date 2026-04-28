import { ref } from 'vue'

export type ToastType = 'info' | 'error' | 'success'

export type ToastItem = { id: number; message: string; type: ToastType }

const items = ref<ToastItem[]>([])
let nextId = 0

/** 全局轻提示（替代阻塞式 alert） */
export function showToast(message: string, type: ToastType = 'info', durationMs = 4000) {
  const id = ++nextId
  items.value = [...items.value, { id, message, type }]
  window.setTimeout(() => {
    items.value = items.value.filter((x) => x.id !== id)
  }, durationMs)
}

export function useToastItems() {
  return items
}
