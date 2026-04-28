/// <reference types="vite/client" />
import type { DoingListApi } from '../preload/index'

declare global {
  interface Window {
    api: DoingListApi
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

export {}
