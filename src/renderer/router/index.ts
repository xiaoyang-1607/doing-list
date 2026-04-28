import { createRouter, createWebHashHistory } from 'vue-router'
import DoingView from '../views/DoingView.vue'
import DiaryView from '../views/DiaryView.vue'
import SettingsView from '../views/SettingsView.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'doing', component: DoingView },
    { path: '/diary', name: 'diary', component: DiaryView },
    { path: '/settings', name: 'settings', component: SettingsView }
  ]
})
