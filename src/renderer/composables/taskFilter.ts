import { ref } from 'vue'
import type { TaskStatus } from '../../shared/types'

/** 侧边栏「分类筛选」与 Doing 列表共用 */
export const taskFilterId = ref<number | null | 'all'>('all')

/** 侧边栏「状态筛选」：未开始 / 进行中 / 已完成 / 全部 */
export const taskStatusFilter = ref<TaskStatus | 'all'>('all')
