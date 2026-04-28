<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast } from '../composables/toast'
import { msgFromCatch } from '../utils/error'

const baseUrl = ref('https://api.openai.com/v1')
const apiKey = ref('')
const model = ref('gpt-4o-mini')
const saving = ref(false)
const updateChecking = ref(false)
const updateHint = ref('')

async function load() {
  baseUrl.value = (await window.api.config.get('ai_base_url')) || 'https://api.openai.com/v1'
  apiKey.value = await window.api.config.get('ai_api_key')
  model.value = (await window.api.config.get('ai_model')) || 'gpt-4o-mini'
}

onMounted(load)

async function save() {
  saving.value = true
  try {
    await window.api.config.set('ai_base_url', baseUrl.value.trim())
    await window.api.config.set('ai_api_key', apiKey.value)
    await window.api.config.set('ai_model', model.value.trim())
    showToast('AI 设置已保存', 'success')
  } catch (e) {
    showToast(`保存失败：${msgFromCatch(e)}`, 'error')
  } finally {
    saving.value = false
  }
}

async function checkUpdate() {
  updateHint.value = ''
  updateChecking.value = true
  try {
    const r = await window.api.checkUpdates()
    if ('skipped' in r && r.skipped) {
      updateHint.value = r.message
      showToast(r.message, 'info')
      return
    }
    if ('ok' in r && r.ok) {
      const remote = r.remoteVersion
      updateHint.value = remote
        ? `当前 ${r.current} · 远端 ${remote}`
        : `当前 ${r.current}（已是最新或尚未发布更高版本）`
      showToast('检查完成', 'success')
    } else if ('message' in r) {
      updateHint.value = r.message
      showToast(`检查失败：${r.message}`, 'error')
    }
  } catch (e) {
    const m = msgFromCatch(e)
    updateHint.value = m
    showToast(`检查失败：${m}`, 'error')
  } finally {
    updateChecking.value = false
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="shrink-0 border-b border-surface-border px-6 py-4">
      <h2 class="text-xl font-semibold text-white">设置</h2>
      <p class="text-sm text-slate-500">模型配置与应用程序更新（GitHub Releases）</p>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-8">
      <div class="mx-auto max-w-lg space-y-6">
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-500">Base URL</label>
          <input
            v-model="baseUrl"
            type="url"
            autocomplete="off"
            class="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-white outline-none focus:border-accent"
            placeholder="https://api.openai.com/v1"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-500">API Key</label>
          <input
            v-model="apiKey"
            type="password"
            autocomplete="off"
            class="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-white outline-none focus:border-accent"
            placeholder="sk-…"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-500">Model Name</label>
          <input
            v-model="model"
            type="text"
            class="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-white outline-none focus:border-accent"
            placeholder="gpt-4o-mini"
          />
        </div>
        <div class="flex flex-wrap items-center gap-4">
          <button
            type="button"
            class="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            :disabled="saving"
            @click="save"
          >
            {{ saving ? '保存中…' : '保存 AI 设置' }}
          </button>
        </div>

        <div class="border-t border-surface-border pt-6">
          <h3 class="mb-2 text-sm font-semibold text-white">应用更新</h3>
          <p class="mb-4 text-xs text-slate-500">
            需在 <code class="rounded bg-white/5 px-1">package.json</code> 中配置 GitHub 仓库，详见项目内 <code class="rounded bg-white/5 px-1">docs/DEVELOPMENT.md</code> 第十一节。
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              class="rounded-lg border border-surface-border px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
              :disabled="updateChecking"
              @click="checkUpdate"
            >
              {{ updateChecking ? '检查中…' : '检查更新' }}
            </button>
            <span v-if="updateHint" class="text-xs text-slate-500">{{ updateHint }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
