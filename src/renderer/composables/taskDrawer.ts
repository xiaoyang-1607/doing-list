import { ref } from 'vue'

/** 任务抽屉是否打开（用于侧栏切换路由前确认，避免误离 Doing 页导致编辑中断） */
export const isTaskDrawerOpen = ref(false)
