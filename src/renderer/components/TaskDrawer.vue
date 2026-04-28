<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { Category, TaskReflection, TaskStatus } from '../../shared/types'
import { categoriesRevision } from '../composables/categoriesSync'
import { formatStoredAsLocal } from '../../shared/datetime'
import { showToast } from '../composables/toast'
import { msgFromCatch } from '../utils/error'
import { toPlain } from '../utils/ipcPayload'

const props = defineProps<{
  open: boolean
  taskId: number | null
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const categories = ref<Category[]>([])
const loading = ref(false)
const title = ref('')
const description = ref('')
const categorySelect = ref<string>('') /** 空串 = 未分类 */
const firstReflectionDraft = ref('')
const newReflectionInput = ref('')
const reflections = ref<TaskReflection[]>([])
const attachmentPaths = ref<string[]>([])
const status = ref<TaskStatus>('todo')
const resolvedUrls = ref<Record<string, string>>({})
const aiResult = ref('')
const aiLoading = ref(false)

const isNew = computed(() => props.taskId === null)

async function loadCategories() {
  if (!window.api) return
  try {
    categories.value = await window.api.categories.list()
  } catch (e) {
    console.error(e)
  }
}

async function resolvePaths(paths: string[]) {
  const map: Record<string, string> = {}
  for (const p of paths) {
    map[p] = await window.api.attachments.resolveUrl(p)
  }
  resolvedUrls.value = map
}

async function loadReflections() {
  if (!props.taskId || !window.api) {
    reflections.value = []
    return
  }
  try {
    reflections.value = await window.api.reflections.listByTask(props.taskId)
  } catch (e) {
    console.error(e)
    reflections.value = []
  }
}

async function loadTask() {
  newReflectionInput.value = ''
  firstReflectionDraft.value = ''
  if (props.taskId === null) {
    title.value = ''
    description.value = ''
    categorySelect.value = ''
    reflections.value = []
    attachmentPaths.value = []
    status.value = 'todo'
    resolvedUrls.value = {}
    return
  }
  const t = await window.api.tasks.get(props.taskId)
  if (!t) return
  title.value = t.title
  description.value = t.description
  categorySelect.value = t.category_id != null ? String(t.category_id) : ''
  attachmentPaths.value = [...t.attachment_paths]
  status.value = t.status
  await resolvePaths(attachmentPaths.value)
  await loadReflections()
}

async function addReflection() {
  if (!window.api) {
    showToast('无法连接主进程，请用 Electron 打开应用', 'error')
    return
  }
  if (props.taskId == null) {
    showToast('请先打开一个已保存的任务', 'info')
    return
  }
  const text = newReflectionInput.value.trim()
  if (!text) {
    showToast('请输入感悟内容', 'info')
    return
  }
  try {
    await window.api.reflections.add(props.taskId, text)
    newReflectionInput.value = ''
    await loadReflections()
    emit('saved')
    showToast('已添加感悟', 'success')
  } catch (e) {
    showToast(`添加失败：${msgFromCatch(e)}`, 'error')
  }
}

async function removeReflection(id: number) {
  if (!confirm('删除这条感悟？')) return
  try {
    await window.api.reflections.delete(id)
    await loadReflections()
    emit('saved')
    showToast('已删除', 'info')
  } catch (e) {
    showToast(`删除失败：${msgFromCatch(e)}`, 'error')
  }
}

watch(
  () => [props.open, props.taskId] as const,
  async ([o]) => {
    if (!o) return
    await loadCategories()
    await loadTask()
  }
)

watch(categoriesRevision, () => {
  if (props.open) void loadCategories()
})

onMounted(loadCategories)

async function save() {
  if (!window.api) {
    showToast('无法连接主进程，请用 Electron 打开应用', 'error')
    return
  }
  const t = title.value.trim()
  if (!t) {
    showToast('请填写标题', 'info')
    return
  }
  loading.value = true
  try {
    const cat =
      categorySelect.value === '' ? null : Number.parseInt(categorySelect.value, 10)
    if (isNew.value) {
      const created = await window.api.tasks.create(
        toPlain({
          title: t,
          description: description.value,
          category_id: cat,
          insight: '',
          attachment_paths: attachmentPaths.value,
          status: status.value
        })
      )
      const first = firstReflectionDraft.value.trim()
      if (first) {
        await window.api.reflections.add(created.id, first)
      }
    } else {
      await window.api.tasks.update(
        props.taskId!,
        toPlain({
          title: t,
          description: description.value,
          category_id: cat,
          attachment_paths: attachmentPaths.value,
          status: status.value
        })
      )
    }
    showToast('已保存', 'success')
    emit('saved')
    emit('close')
  } catch (e) {
    console.error(e)
    showToast(`保存失败：${msgFromCatch(e)}`, 'error')
  } finally {
    loading.value = false
  }
}

async function removeTask() {
  if (!props.taskId || !confirm('确定删除此任务？')) return
  try {
    await window.api.tasks.delete(props.taskId)
    showToast('已删除任务', 'info')
    emit('saved')
    emit('close')
  } catch (e) {
    showToast(`删除失败：${msgFromCatch(e)}`, 'error')
  }
}

async function pickImages() {
  try {
    const paths = await window.api.attachments.pickMany()
    if (!paths.length) return
    attachmentPaths.value = [...attachmentPaths.value, ...paths]
    await resolvePaths(attachmentPaths.value)
  } catch (e) {
    showToast(`添加图片失败：${msgFromCatch(e)}`, 'error')
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (!files?.length) return
  const paths: string[] = []
  for (let i = 0; i < files.length; i++) {
    const f = files[i] as File & { path?: string }
    if (f.path) paths.push(f.path)
  }
  if (!paths.length) return
  void (async () => {
    try {
      const rel = await window.api.attachments.fromPaths(paths)
      attachmentPaths.value = [...attachmentPaths.value, ...rel]
      await resolvePaths(attachmentPaths.value)
    } catch (e) {
      showToast(`拖拽图片失败：${msgFromCatch(e)}`, 'error')
    }
  })()
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}

function removeAttachment(idx: number) {
  attachmentPaths.value.splice(idx, 1)
  const next = [...attachmentPaths.value]
  void resolvePaths(next)
}

async function runAi() {
  if (isNew.value || !props.taskId) {
    showToast('请先保存任务后再分析', 'info')
    return
  }
  aiLoading.value = true
  aiResult.value = ''
  try {
    aiResult.value = await window.api.ai.analyzeTask(props.taskId)
  } catch (e) {
    aiResult.value = `错误：${msgFromCatch(e)}`
  } finally {
    aiLoading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-drawer-title"
      >
          <div
            v-if="open"
            class="flex h-[min(92vh,920px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface-card shadow-2xl xl:max-w-5xl"
            @click.stop
          >
            <header class="flex shrink-0 items-center justify-between border-b border-surface-border px-6 py-4">
              <div>
                <h2 id="task-drawer-title" class="text-lg font-semibold text-white">
                  {{ isNew ? '新建任务' : '任务详情' }}
                </h2>
                <p class="mt-0.5 text-xs text-slate-500">请用底部「取消 / 保存」关闭</p>
              </div>
              <button
                type="button"
                class="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="关闭"
                @click="emit('close')"
              >
                ✕
              </button>
            </header>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div>
                <label class="mb-1 block text-xs font-medium text-slate-500">标题 *</label>
                <input
                  v-model="title"
                  class="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-white outline-none focus:border-accent"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-slate-500">状态</label>
                <select
                  v-model="status"
                  class="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-white outline-none focus:border-accent"
                >
                  <option value="todo">未开始</option>
                  <option value="doing">进行中</option>
                  <option value="done">已完成</option>
                </select>
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-slate-500">分类</label>
                <select
                  v-model="categorySelect"
                  class="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-white outline-none focus:border-accent"
                >
                  <option value="">未分类</option>
                  <option v-for="c in categories" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
                </select>
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-slate-500">详细描述</label>
                <textarea
                  v-model="description"
                  rows="6"
                  class="w-full min-h-[140px] resize-y rounded-lg border border-surface-border bg-surface px-3 py-2 text-white outline-none focus:border-accent"
                />
              </div>
              <div class="rounded-xl border border-surface-border bg-surface/40 p-4">
                <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <label class="text-xs font-medium text-slate-400">感悟时间轴</label>
                  <p class="text-[11px] text-slate-600">带时间记录；日记可按日引入对应感悟</p>
                </div>

                <div v-if="!isNew && reflections.length" class="mb-4 max-h-56 space-y-2 overflow-y-auto pr-1">
                  <div
                    v-for="r in reflections"
                    :key="r.id"
                    class="rounded-lg border border-surface-border bg-surface/80 px-3 py-2.5 text-sm"
                  >
                    <div class="mb-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <time :datetime="r.created_at">{{ formatStoredAsLocal(r.created_at) }}</time>
                      <button
                        type="button"
                        class="text-red-400/80 hover:text-red-400"
                        @click="removeReflection(r.id)"
                      >
                        删除
                      </button>
                    </div>
                    <p class="whitespace-pre-wrap text-slate-300">{{ r.content }}</p>
                  </div>
                </div>
                <p v-else-if="!isNew && !reflections.length" class="mb-3 text-xs text-slate-600">暂无感悟，可在下方添加第一条。</p>

                <div v-if="isNew" class="space-y-2">
                  <label class="block text-xs font-medium text-slate-500">首条感悟（可选，保存任务后写入时间轴）</label>
                  <textarea
                    v-model="firstReflectionDraft"
                    rows="3"
                    class="w-full resize-y rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-accent"
                    placeholder="例如：今天开始了这个任务，计划是…"
                  />
                </div>
                <div v-else class="space-y-2">
                  <label class="block text-xs font-medium text-slate-500">添加一条感悟</label>
                  <textarea
                    v-model="newReflectionInput"
                    rows="3"
                    class="w-full resize-y rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-accent"
                    placeholder="随时记录新想法，不会覆盖旧内容…"
                  />
                  <button
                    type="button"
                    class="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                    @click="addReflection"
                  >
                    添加感悟
                  </button>
                </div>
              </div>

              <div>
                <label class="mb-1 block text-xs font-medium text-slate-500">附件图片</label>
                <div
                  class="rounded-xl border-2 border-dashed border-surface-border bg-surface/50 p-4 text-center transition hover:border-accent/50"
                  @drop="onDrop"
                  @dragover="onDragOver"
                >
                  <p class="mb-2 text-sm text-slate-500">拖拽图片到此处，或</p>
                  <button
                    type="button"
                    class="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                    @click="pickImages"
                  >
                    选择图片
                  </button>
                </div>
                <div v-if="attachmentPaths.length" class="mt-3 grid grid-cols-3 gap-2">
                  <div v-for="(p, i) in attachmentPaths" :key="p + i" class="relative aspect-square overflow-hidden rounded-lg bg-black/40">
                    <img v-if="resolvedUrls[p]" :src="resolvedUrls[p]" alt="" class="h-full w-full object-cover" />
                    <button
                      type="button"
                      class="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-xs text-white hover:bg-red-600"
                      @click="removeAttachment(i)"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="!isNew" class="rounded-lg border border-surface-border bg-surface/80 p-4">
                <div class="mb-2 flex items-center justify-between">
                  <span class="text-sm font-medium text-slate-300">AI 难点分析</span>
                  <button
                    type="button"
                    class="rounded-md bg-accent/20 px-3 py-1 text-xs text-accent-muted hover:bg-accent/30 disabled:opacity-50"
                    :disabled="aiLoading"
                    @click="runAi"
                  >
                    {{ aiLoading ? '分析中…' : '根据心得生成建议' }}
                  </button>
                </div>
                <p v-if="aiResult" class="whitespace-pre-wrap text-sm leading-relaxed text-slate-400">{{ aiResult }}</p>
                <p v-else class="text-xs text-slate-600">使用上方「感悟时间轴」与任务描述，依设置中的模型生成建议。</p>
              </div>
            </div>

            <footer class="flex shrink-0 items-center justify-between gap-2 border-t border-surface-border px-6 py-4">
              <button
                v-if="!isNew"
                type="button"
                class="text-sm text-red-400/90 hover:text-red-400"
                @click="removeTask"
              >
                删除任务
              </button>
              <div v-else />
              <div class="flex gap-2">
                <button
                  type="button"
                  class="rounded-lg border border-surface-border px-4 py-2 text-sm hover:bg-white/5"
                  @click="emit('close')"
                >
                  取消
                </button>
                <button
                  type="button"
                  class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                  :disabled="loading"
                  @click="save"
                >
                  {{ loading ? '保存中…' : '保存' }}
                </button>
              </div>
            </footer>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.2s ease, transform 0.28s ease;
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}
</style>
