import { ref } from 'vue'

/** 侧栏分类变更时递增，抽屉内可 watch 后刷新下拉选项 */
export const categoriesRevision = ref(0)

export function bumpCategoriesRevision() {
  categoriesRevision.value++
}
