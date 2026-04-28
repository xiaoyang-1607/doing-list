import { ref } from 'vue'

/** 侧边栏「分类筛选」与 Doing 列表共用 */
export const taskFilterId = ref<number | null | 'all'>('all')
