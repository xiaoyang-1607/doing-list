<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppSidebar from './components/AppSidebar.vue'
import ToastHost from './components/ToastHost.vue'
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <AppSidebar />
    <main class="min-w-0 flex-1 overflow-hidden bg-[#0b0f14]">
      <RouterView />
    </main>
    <ToastHost />
  </div>
</template>
