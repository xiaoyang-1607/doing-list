<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { formatLocalDateYmd } from '../../shared/datetime'
import type { Diary, DiaryTaskHint } from '../../shared/types'
import {
  buildTaskExcerpt,
  stripImportedTaskBlock,
  TASK_BLOCK_START
} from '../../shared/diaryExcerpt'
import { showToast } from '../composables/toast'
import { msgFromCatch } from '../utils/error'
import { toPlain } from '../utils/ipcPayload'

const today = formatLocalDateYmd(new Date())

const diaries = ref<Diary[]>([])
const selectedDate = ref(today)
const title = ref('')
const content = ref('')
const saving = ref(false)
const loadingDay = ref(false)
const persistedTitle = ref('')
const persistedContent = ref('')
const dirty = computed(
  () => title.value !== persistedTitle.value || content.value !== persistedContent.value
)
let autoSaveTimer: number | undefined
let loadGeneration = 0
let saveInFlight: Promise<boolean> | null = null

const aiStart = ref('')
const aiEnd = ref('')
const aiLoading = ref(false)
const aiText = ref('')

async function loadList() {
  try {
    diaries.value = await window.api.diaries.list()
  } catch (e) {
    showToast(`加载日记列表失败：${msgFromCatch(e)}`, 'error')
  }
}

async function loadDay(date = selectedDate.value): Promise<boolean> {
  const generation = ++loadGeneration
  loadingDay.value = true
  try {
    const d = await window.api.diaries.getByDate(date)
    if (generation !== loadGeneration || date !== selectedDate.value) return false
    title.value = d?.title ?? ''
    content.value = d?.content ?? ''
    persistedTitle.value = title.value
    persistedContent.value = content.value
    return true
  } catch (e) {
    if (generation === loadGeneration) showToast(`加载日记失败：${msgFromCatch(e)}`, 'error')
    return false
  } finally {
    if (generation === loadGeneration) loadingDay.value = false
  }
}

onMounted(async () => {
  await loadList()
  aiEnd.value = today
  const w = new Date()
  w.setDate(w.getDate() - 6)
  aiStart.value = formatLocalDateYmd(w)
  await loadDay()
})

async function persistCurrent(showSuccess: boolean): Promise<boolean> {
  if (autoSaveTimer !== undefined) window.clearTimeout(autoSaveTimer)
  autoSaveTimer = undefined
  if (saveInFlight) await saveInFlight
  if (!dirty.value) {
    if (showSuccess) showToast('当前内容已保存', 'info')
    return true
  }
  const snapshot = {
    date: selectedDate.value,
    title: title.value,
    content: content.value
  }
  saving.value = true
  const operation = (async () => {
    try {
      await window.api.diaries.upsert(toPlain(snapshot))
      if (selectedDate.value === snapshot.date) {
        persistedTitle.value = snapshot.title
        persistedContent.value = snapshot.content
      }
      await loadList()
      if (showSuccess) showToast('日记已保存', 'success')
      return true
    } catch (e) {
      showToast(`保存失败：${msgFromCatch(e)}`, 'error')
      return false
    } finally {
      saving.value = false
    }
  })()
  saveInFlight = operation
  const saved = await operation
  if (saveInFlight === operation) saveInFlight = null
  return saved
}

async function saveDiary() {
  await persistCurrent(true)
}

watch([title, content], () => {
  if (loadingDay.value || !dirty.value) return
  if (autoSaveTimer !== undefined) window.clearTimeout(autoSaveTimer)
  autoSaveTimer = window.setTimeout(() => {
    void persistCurrent(false)
  }, 1_000)
})

async function switchDate(date: string) {
  if (!date || date === selectedDate.value) return
  const saved = await persistCurrent(false)
  if (!saved && dirty.value && !confirm('当前日记自动保存失败，仍要切换日期吗？')) return
  const previousDate = selectedDate.value
  selectedDate.value = date
  if (!(await loadDay(date))) selectedDate.value = previousDate
}

function onDateInput(event: Event) {
  const date = (event.target as HTMLInputElement).value
  void switchDate(date)
}

onBeforeRouteLeave(async () => {
  const saved = await persistCurrent(false)
  return saved || !dirty.value || confirm('当前日记保存失败，仍要离开吗？')
})

onBeforeUnmount(() => {
  if (autoSaveTimer !== undefined) window.clearTimeout(autoSaveTimer)
})

async function importTasks() {
  let hints: DiaryTaskHint[]
  try {
    hints = await window.api.diaries.tasksForDay(selectedDate.value)
  } catch (e) {
    showToast(`读取任务失败：${msgFromCatch(e)}`, 'error')
    return
  }
  if (!hints.length) {
    showToast('该日暂无可引入的任务', 'info')
    return
  }
  const hasUnboundedLegacyBlock =
    /—— (?:.+ 任务摘录|今日任务摘录) ——/.test(content.value) &&
    !content.value.includes(TASK_BLOCK_START)
  const userPart = stripImportedTaskBlock(content.value)
  const imported = buildTaskExcerpt(selectedDate.value, hints)
  content.value = userPart ? `${userPart}\n\n${imported}\n` : `${imported}\n`
  if (hasUnboundedLegacyBlock) {
    showToast('检测到无结束边界的旧版摘录；为保护正文已保留，请手动删除旧块一次', 'info', 7_000)
  } else {
    showToast(`已引入 ${hints.length} 条任务摘要`, 'success')
  }
}

async function exportCurrentDiary() {
  try {
    const r = await window.api.diaries.exportToFile({
      mode: 'one',
      date: selectedDate.value,
      title: title.value,
      content: content.value
    })
    if ('canceled' in r && r.canceled) return
    if ('ok' in r && r.ok) showToast('本篇日记已导出', 'success')
  } catch (e) {
    showToast(`导出失败：${msgFromCatch(e)}`, 'error')
  }
}

async function exportAllDiaries() {
  try {
    const r = await window.api.diaries.exportToFile({ mode: 'all' })
    if ('canceled' in r && r.canceled) return
    if ('ok' in r && r.ok) showToast('全部日记已导出', 'success')
  } catch (e) {
    showToast(`导出失败：${msgFromCatch(e)}`, 'error')
  }
}

async function runReview() {
  if (!aiStart.value || !aiEnd.value) return
  aiLoading.value = true
  aiText.value = ''
  try {
    aiText.value = await window.api.ai.reviewPeriod(aiStart.value, aiEnd.value)
  } catch (e) {
    aiText.value = `错误：${msgFromCatch(e)}`
  } finally {
    aiLoading.value = false
  }
}

function pickDate(d: string) {
  void switchDate(d)
}
</script>

<template>
  <div class="flex h-full">
    <aside class="w-72 shrink-0 overflow-y-auto border-r border-surface-border bg-surface/50 px-3 py-4">
      <h2 class="mb-3 px-2 text-sm font-semibold uppercase tracking-wider text-slate-500">时间线</h2>
      <div v-if="!diaries.length" class="px-2 text-sm text-slate-600">暂无日记</div>
      <button
        v-for="d in diaries"
        :key="d.id"
        type="button"
        class="mb-1 flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm transition"
        :class="
          selectedDate === d.date ? 'bg-accent/20 text-white' : 'text-slate-400 hover:bg-white/5'
        "
        @click="pickDate(d.date)"
      >
        <span class="font-medium">{{ d.date }}</span>
        <span class="truncate text-xs text-slate-500">{{ d.title || '（无标题）' }}</span>
      </button>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="shrink-0 border-b border-surface-border px-6 py-4">
        <h2 class="text-xl font-semibold text-white">日记与复盘</h2>
        <p class="text-sm text-slate-500">按日书写，可一键插入所选日期对应的任务摘录</p>
      </header>

      <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <div class="flex flex-wrap items-end gap-4">
          <div>
            <label class="mb-1 block text-xs text-slate-500">日期</label>
            <input
              :value="selectedDate"
              type="date"
              class="rounded-lg border border-surface-border bg-surface px-3 py-2 text-white outline-none focus:border-accent"
              @change="onDateInput"
            />
          </div>
          <button
            type="button"
            class="rounded-lg border border-surface-border px-4 py-2 text-sm hover:bg-white/5"
            @click="importTasks"
          >
            引入任务摘录
          </button>
          <button
            type="button"
            class="rounded-lg border border-surface-border px-4 py-2 text-sm hover:bg-white/5"
            @click="exportCurrentDiary"
          >
            导出本篇
          </button>
          <button
            type="button"
            class="rounded-lg border border-surface-border px-4 py-2 text-sm hover:bg-white/5"
            @click="exportAllDiaries"
          >
            导出全部
          </button>
          <button
            type="button"
            class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            :disabled="saving"
            @click="saveDiary"
          >
            {{ saving ? '保存中…' : '保存日记' }}
          </button>
          <span class="text-xs" :class="dirty ? 'text-amber-400' : 'text-slate-600'">
            {{ dirty ? '等待自动保存…' : '已保存' }}
          </span>
        </div>

        <div>
          <label class="mb-1 block text-xs text-slate-500">标题</label>
          <input
            v-model="title"
            class="w-full max-w-xl rounded-lg border border-surface-border bg-surface px-3 py-2 text-white outline-none focus:border-accent"
            placeholder="可选"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs text-slate-500">正文</label>
          <textarea
            v-model="content"
            rows="14"
            class="w-full resize-none rounded-lg border border-surface-border bg-surface px-3 py-3 font-mono text-sm leading-relaxed text-slate-200 outline-none focus:border-accent"
            placeholder="记录今天…"
          />
        </div>

        <section class="rounded-xl border border-surface-border bg-surface-card/60 p-5">
          <h3 class="mb-3 text-sm font-semibold text-white">AI 周 / 月复盘</h3>
          <p class="mb-4 text-xs text-slate-500">汇总区间内日记并由模型简要复盘。</p>
          <div class="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label class="mb-1 block text-xs text-slate-500">开始日期</label>
              <input
                v-model="aiStart"
                type="date"
                class="rounded-lg border border-surface-border bg-surface px-3 py-2 text-white outline-none focus:border-accent"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-500">结束日期</label>
              <input
                v-model="aiEnd"
                type="date"
                class="rounded-lg border border-surface-border bg-surface px-3 py-2 text-white outline-none focus:border-accent"
              />
            </div>
            <button
              type="button"
              class="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
              :disabled="aiLoading"
              @click="runReview"
            >
              {{ aiLoading ? '分析中…' : '开始分析' }}
            </button>
          </div>
          <div
            v-if="aiText"
            class="whitespace-pre-wrap rounded-lg bg-black/30 p-4 text-sm leading-relaxed text-slate-300"
          >
            {{ aiText }}
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
