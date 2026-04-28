<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Category } from '../../shared/types'
import { taskFilterId } from '../composables/taskFilter'
import { bumpCategoriesRevision } from '../composables/categoriesSync'
import { showToast } from '../composables/toast'
import { isTaskDrawerOpen } from '../composables/taskDrawer'
import { msgFromCatch } from '../utils/error'

const router = useRouter()
const route = useRoute()

const categories = ref<Category[]>([])
const filterId = taskFilterId
const newCat = ref('')
const editingId = ref<number | null>(null)
const editingName = ref('')

const nav = computed(() => [
  { path: '/', label: 'Doing List', icon: '◆' },
  { path: '/diary', label: '日记', icon: '◇' },
  { path: '/settings', label: '设置', icon: '○' }
])

/** 路由 name 为主，避免 hash 下 path 偶发不渲染分类区 */
const showDoingFilters = computed(
  () => route.name === 'doing' || route.path === '/' || route.path === ''
)

async function loadCats() {
  if (!window.api) {
    console.error('[Doing List] preload 未注入 window.api，请使用 Electron 运行')
    return
  }
  try {
    categories.value = await window.api.categories.list()
  } catch (e) {
    console.error(e)
    showToast(`加载分类失败：${msgFromCatch(e)}`, 'error')
  }
}

onMounted(loadCats)

async function addCategory() {
  if (!window.api) {
    showToast('无法连接主进程，请用 Electron 打开应用', 'error')
    return
  }
  const name = newCat.value.trim()
  if (!name) return
  try {
    await window.api.categories.create(name)
    newCat.value = ''
    await loadCats()
    bumpCategoriesRevision()
    showToast('已添加分类', 'success')
  } catch (e) {
    const msg = msgFromCatch(e)
    showToast(
      msg.includes('UNIQUE') || msg.includes('unique') ? '该分类名称已存在' : `创建分类失败：${msg}`,
      'error'
    )
  }
}

async function saveEdit(id: number) {
  const name = editingName.value.trim()
  if (!name) {
    editingId.value = null
    return
  }
  try {
    await window.api.categories.update(id, name)
    editingId.value = null
    await loadCats()
    bumpCategoriesRevision()
    showToast('分类已更新', 'success')
  } catch (e) {
    showToast(`重命名失败：${msgFromCatch(e)}`, 'error')
  }
}

async function removeCat(id: number) {
  if (!confirm('删除分类？相关任务的分类将清空。')) return
  try {
    await window.api.categories.delete(id)
    if (filterId.value === id) filterId.value = 'all'
    await loadCats()
    bumpCategoriesRevision()
    showToast('已删除分类', 'info')
  } catch (e) {
    showToast(`删除失败：${msgFromCatch(e)}`, 'error')
  }
}

function isActive(path: string) {
  return route.path === path
}

/** 抽屉打开时切页前确认，避免未保存任务随路由卸载丢失 */
function goNav(path: string) {
  if (path === route.path) return
  if (isTaskDrawerOpen.value) {
    if (
      !confirm(
        '任务编辑框仍打开，切换页面可能丢失未保存内容。离开？'
      )
    ) {
      return
    }
  }
  void router.push(path)
}
</script>

<template>
  <aside
    class="flex w-60 shrink-0 flex-col border-r border-surface-border bg-surface-card/80 backdrop-blur-sm"
  >
    <div class="border-b border-surface-border px-4 py-5">
      <h1 class="text-lg font-semibold tracking-tight text-white">Doing List</h1>
      <p class="mt-1 text-xs text-slate-500">任务驱动 · 日记沉淀</p>
    </div>

    <nav class="space-y-0.5 px-2 py-3">
      <button
        v-for="item in nav"
        :key="item.path"
        type="button"
        class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition"
        :class="
          isActive(item.path)
            ? 'bg-accent/15 text-accent-muted'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        "
        @click="goNav(item.path)"
      >
        <span class="w-5 text-center opacity-80">{{ item.icon }}</span>
        {{ item.label }}
      </button>
    </nav>

    <div v-if="showDoingFilters" class="mt-2 flex-1 overflow-hidden border-t border-surface-border px-2 pt-3">
      <p class="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-slate-500">分类筛选</p>
      <button
        type="button"
        class="mb-1 flex w-full items-center rounded-lg px-3 py-1.5 text-left text-sm"
        :class="filterId === 'all' ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5'"
        @click="filterId = 'all'"
      >
        全部
      </button>
      <button
        type="button"
        class="mb-1 flex w-full items-center rounded-lg px-3 py-1.5 text-left text-sm"
        :class="filterId === null ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5'"
        @click="filterId = null"
      >
        未分类
      </button>
      <div class="max-h-48 overflow-y-auto">
        <div
          v-for="c in categories"
          :key="c.id"
          class="group mb-1 flex items-center gap-1 rounded-lg px-1 py-0.5 hover:bg-white/5"
        >
          <button
            type="button"
            class="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm"
            :class="filterId === c.id ? 'bg-white/10 text-white' : 'text-slate-400'"
            @click="filterId = c.id"
          >
            {{ c.name }}
          </button>
          <button
            type="button"
            class="rounded p-1 text-slate-500 opacity-0 hover:text-accent group-hover:opacity-100"
            title="重命名"
            @click="editingId = c.id; editingName = c.name"
          >
            ✎
          </button>
          <button
            type="button"
            class="rounded p-1 text-slate-500 opacity-0 hover:text-red-400 group-hover:opacity-100"
            title="删除"
            @click="removeCat(c.id)"
          >
            ×
          </button>
        </div>
      </div>
      <div v-if="editingId !== null" class="mt-2 flex gap-1 px-1">
        <input
          v-model="editingName"
          class="min-w-0 flex-1 rounded border border-surface-border bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
          @keydown.enter="saveEdit(editingId!)"
        />
        <button
          type="button"
          class="rounded bg-accent px-2 text-xs text-white"
          @click="saveEdit(editingId!)"
        >
          保存
        </button>
      </div>
      <div class="mt-3 flex gap-1 px-1">
        <input
          v-model="newCat"
          placeholder="新分类…"
          class="min-w-0 flex-1 rounded border border-surface-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
          @keydown.enter="addCategory"
        />
        <button
          type="button"
          class="shrink-0 rounded bg-white/10 px-2 text-sm hover:bg-white/15"
          @click="addCategory"
        >
          +
        </button>
      </div>
    </div>
    <div v-else class="flex-1" />
  </aside>
</template>
