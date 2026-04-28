import { app, dialog, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { ipcHandle } from './ipcSerialize'

/**
 * 打包后从 GitHub Releases 拉取更新（由 package.json build.publish 指定仓库）。
 * 开发模式不执行网络检查，仅注册 IPC 供界面提示。
 */
export function setupUpdater(getMainWindow: () => BrowserWindow | null): void {
  ipcHandle('app:checkUpdates', async () => {
    if (!app.isPackaged) {
      return { skipped: true as const, message: '开发模式未启用更新通道' }
    }
    try {
      const check = await autoUpdater.checkForUpdates()
      return {
        ok: true as const,
        current: app.getVersion(),
        remoteVersion: check?.updateInfo?.version ?? null
      }
    } catch (e: unknown) {
      return {
        ok: false as const,
        message: e instanceof Error ? e.message : String(e)
      }
    }
  })

  if (!app.isPackaged) return

  autoUpdater.autoDownload = true

  autoUpdater.on('error', (err) => {
    console.error('[electron-updater]', err)
  })

  autoUpdater.on('update-downloaded', async () => {
    const win = getMainWindow()
    const opts = {
      type: 'info' as const,
      buttons: ['稍后', '立即重启'],
      defaultId: 1,
      cancelId: 0,
      title: '新版本已就绪',
      message: '更新已下载，是否立即重启以完成安装？'
    }
    const { response } = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts)
    if (response === 1) {
      autoUpdater.quitAndInstall(false, true)
    }
  })

  void autoUpdater.checkForUpdates().catch((e) => {
    console.error('[electron-updater] 启动时检查失败', e)
  })
}
