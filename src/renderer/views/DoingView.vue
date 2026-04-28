<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { Task } from '../../shared/types'
import { taskFilterId } from '../composables/taskFilter'
import { isTaskDrawerOpen } from '../composables/taskDrawer'
import { showToast } from '../composables/toast'
import { msgFromCatch } from '../utils/error'
import TaskCard from '../components/TaskCard.vue'
import TaskDrawer from '../components/TaskDrawer.vue'

const tasks = ref<Task[]>([])
const drawerOpen = ref(false)
const drawerTaskId = ref<number | null>(null)
const thumbUrls = ref<Record<number, string | null>>({})

async function loadTasks() {
  if (!window.api) {
    console.error('[Doing List] window.api 未就绪')
    return
  }
  try {
    tasks.value = await window.api.tasks.list(taskFilterId.value)
    thumbUrls.value = {}
    for (const t of tasks.value) {
      const first = t.attachment_paths[0]
      if (first) {
        thumbUrls.value[t.id] = await window.api.attachments.resolveUrl(first)
      } else {
        thumbUrls.value[t.id] = null
      }
    }
  } catch (e) {
    const msg = msgFromCatch(e)
    console.error(e)
    showToast(`加载任务失败：${msg}`, 'error')
  }
}

onMounted(loadTasks)
watch(taskFilterId, loadTasks)

watch(drawerOpen, (v) => {
  isTaskDrawerOpen.value = v
})
onUnmounted(() => {
  isTaskDrawerOpen.value = false
})

function openNew() {
  drawerTaskId.value = null
  drawerOpen.value = true
}

function openTask(id: number) {
  drawerTaskId.value = id
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
}

async function onSaved() {
  await loadTasks()
}
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="flex shrink-0 items-center justify-between border-b border-surface-border px-6 py-4">
      <div>
        <h2 class="text-xl font-semibold text-white">Doing List</h2>
        <p class="text-sm text-slate-500">默认按创建时间倒序</p>
      </div>
      <button
        type="button"
        class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-900/20 hover:bg-blue-600"
        @click="openNew"
      >
        + 新建任务
      </button>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6">
      <div
        v-if="!tasks.length"
        class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-border py-24 text-slate-500"
      >
        <p>暂无任务</p>
        <button type="button" class="mt-4 text-accent-muted hover:underline" @click="openNew">创建第一个任务</button>
      </div>
      <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <TaskCard
          v-for="t in tasks"
          :key="t.id"
          :task="t"
          :image-url="thumbUrls[t.id]"
          @open="openTask"
        />
      </div>
    </div>

    <TaskDrawer
      :open="drawerOpen"
      :task-id="drawerTaskId"
      @close="closeDrawer"
      @saved="onSaved"
    />
  </div>
</template>
