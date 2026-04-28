<script setup lang="ts">
import { formatLocalDateYmd, parseStoredTime } from '../../shared/datetime'
import type { Task } from '../../shared/types'

defineProps<{ task: Task; imageUrl?: string | null }>()
const emit = defineEmits<{ open: [id: number] }>()

const statusLabel: Record<string, string> = {
  todo: '未开始',
  doing: '进行中',
  done: '已完成'
}

const statusClass: Record<string, string> = {
  todo: 'bg-slate-600/40 text-slate-300',
  doing: 'bg-amber-500/20 text-amber-300',
  done: 'bg-emerald-500/20 text-emerald-300'
}

function formatTaskDate(iso: string) {
  return formatLocalDateYmd(parseStoredTime(iso))
}
</script>

<template>
  <article
    class="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-card transition hover:border-accent/40 hover:shadow-lg hover:shadow-black/20"
    @click="emit('open', task.id)"
  >
    <div v-if="imageUrl" class="aspect-video w-full overflow-hidden bg-black/30">
      <img :src="imageUrl" alt="" class="h-full w-full object-cover transition group-hover:scale-[1.02]" />
    </div>
    <div class="flex flex-1 flex-col p-4">
      <div class="mb-2 flex items-start justify-between gap-2">
        <h3 class="line-clamp-2 font-medium leading-snug text-white">{{ task.title }}</h3>
        <span
          class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
          :class="statusClass[task.status] ?? statusClass.todo"
        >
          {{ statusLabel[task.status] }}
        </span>
      </div>
      <p v-if="task.description" class="mb-2 line-clamp-2 text-sm text-slate-500">
        {{ task.description }}
      </p>
      <div class="mt-auto flex items-center justify-between gap-2 text-xs text-slate-500">
        <span v-if="task.category_name" class="truncate rounded bg-white/5 px-2 py-0.5">{{ task.category_name }}</span>
        <span v-else class="text-slate-600">未分类</span>
        <time :datetime="task.created_at">{{ formatTaskDate(task.created_at) }}</time>
      </div>
    </div>
  </article>
</template>
