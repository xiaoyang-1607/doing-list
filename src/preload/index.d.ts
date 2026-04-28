import type { DoingListApi } from './index'

declare global {
  interface Window {
    api: DoingListApi
  }
}

export {}
