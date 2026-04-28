<script setup lang="ts">
import { useToastItems } from '../composables/toast'

const toastItems = useToastItems()

const styles: Record<string, string> = {
  info: 'border-surface-border bg-surface-card/95 text-slate-200',
  error: 'border-red-500/40 bg-red-950/90 text-red-100',
  success: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100'
}
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed bottom-6 right-6 z-[200] w-[min(100%,22rem)] p-0"
      aria-live="polite"
    >
      <TransitionGroup name="toast" tag="div" class="flex flex-col gap-2">
        <div
          v-for="t in toastItems"
          :key="t.id"
          class="pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-xl backdrop-blur-sm"
          :class="styles[t.type] ?? styles.info"
        >
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(0.75rem);
}
</style>
