# Doing List 开发复盘文档

本文记录从零搭建「Doing List」桌面应用的过程、技术选型、踩坑与解决方案，便于日后维护与二次开发。

---

## 一、项目目标与功能概览

- **形态**：Windows 桌面应用（Electron 打包为 `.exe`）。
- **核心**：任务（Doing List）驱动日常；日记（Diary）沉淀内容；通过 OpenAI 兼容接口做任务分析与日记复盘。
- **存储**：SQLite（`better-sqlite3`），库文件与附件均在 `userData` 下；图片复制进 `attachments/`，库中仅存相对路径。

---

## 二、技术栈与目录结构

| 层级 | 技术 |
|------|------|
| 主进程 | Electron、`better-sqlite3`、标准 `fetch` 调用 AI |
| 预加载 | `contextBridge` 暴露 `window.api` |
| 渲染进程 | Vue 3、Vue Router（Hash）、Tailwind CSS |
| 构建 | electron-vite、TypeScript、electron-builder（NSIS） |

主要目录：

- `src/main/`：窗口、IPC、`attachments` 拷贝、AI 请求封装。
- `src/preload/`：IPC 桥接，统一对参数做可序列化处理。
- `src/db/`：Schema、`database.ts` 仓储层。
- `src/renderer/`：页面、组件、组合式函数、工具（`ipcPayload`、`utils/error`）。
- `src/shared/`：前后端共用的类型定义。
- `src/main/ipcSerialize.ts`：主进程 IPC 返回值再序列化，避免不可克隆对象传出。

---

## 三、实施阶段（与最初路线图对应）

1. **环境**：`package.json`、electron-vite、Vue3、Tailwind、IPC 骨架、目录划分。
2. **数据库**：`tasks`、`diaries`、`categories`、`config` 四表及 CRUD。
3. **Doing List**：侧栏分类、任务卡片、状态流转、抽屉编辑。
4. **附件**：复制到 `userData/attachments/`，详情页预览与拖拽。
5. **日记与 AI**：时间线、按日编辑、引入当日任务、设置页与周/月复盘。

后续迭代中补充：Toast 提示、`categoriesRevision` 同步侧栏与抽屉、错误提示与 `toPlain` 等。

---

## 四、环境问题与处理

### 4.1 `better-sqlite3` 安装失败（Node 24 / 无预编译）

**现象**：`npm install` 在编译 `better-sqlite3` 时报错（如无 ClangCL、或 prebuild 不匹配当前 Node）。

**处理**：

- 使用脚本：**先跳过生命周期脚本安装依赖，再拉取 Electron 二进制，再针对 Electron 重编原生模块**：
  - `npm run install:safe`（等价思路：`npm install --ignore-scripts` → `node node_modules/electron/install.js` → `npm run postinstall` / `electron-rebuild`）。
- 说明：针对 **Electron 的 ABI** 用 `@electron/rebuild` 编译 `better-sqlite3`，比直接用当前 Node 版本编更稳。

### 4.2 Electron 提示未安装 / `Electron uninstall`

**现象**：`npm run dev` 报 Electron 未安装。

**原因**：使用了 `npm install --ignore-scripts`，未执行 Electron 的 postinstall 下载二进制。

**处理**：执行 `node node_modules/electron/install.js` 一次；之后正常 `npm install` 可保留该流程或继续用 `install:safe`。

### 4.3 `NODE_OPTIONS=--use-system-ca` 与 Electron 冲突

**现象**：启动报错 `--use-system-ca is not allowed in NODE_OPTIONS`。

**处理**：从系统/用户环境变量中去掉该 `NODE_OPTIONS`，或在启动前清空后再运行 `npm run dev`。

### 4.4 `electron-builder` 打包失败（符号链接 / winCodeSign）

**现象**：解压 `winCodeSign` 时无法在 Windows 上创建符号链接（权限不足）。

**处理**：在 `package.json` 的 `build.win` 中设置 `signAndEditExecutable: false`（本机无代码签名需求时），避免拉取/解压依赖符号链接的工具链。

---

## 五、功能与交互问题

### 5.1 无法新建分类、无法添加任务（侧栏分类区不显示）

**现象**：侧栏只有导航，没有「分类筛选 / 新分类」区域。

**原因**：使用 `createWebHashHistory()` 时，若入口 URL 没有 `#/`（或仅有 `#`），`route.path === '/'` 可能不成立，`v-if="route.path === '/'"` 为假，整块 UI 不渲染。

**处理**：

- 在 `index.html` 里、在加载 Vue **之前**用内联脚本将 hash 规范为 `#/`。
- 侧栏展示条件改为基于 **`route.name === 'doing'`**，并保留对 `path === '/'` 或 `''` 的兜底。
- `main.ts` 中在 `router.isReady()` 后再 `mount`，保证首屏路由就绪。

### 5.2 数据库初始化失败导致「全部 IPC 不可用」

**现象**：若 `openDatabase()` 在 `app.whenReady` 里同步抛错，后续 `ipcMain.handle` 未注册，所有操作无响应。

**处理**：对 `openDatabase` 做 `try/catch`，用 `dialog.showErrorBox` 提示；业务上仍尽量保证注册 handler，或在 handler 内统一返回「数据库不可用」类错误（按项目演进选择其一即可）。

---

## 六、核心难点：`An object could not be cloned`（IPC 克隆）

**现象**：保存任务瞬间报错，栈指向 `TaskDrawer.vue` 中 `await window.api.tasks.create(...)`。

**原因要点**：

1. **渲染进程 → preload（`contextBridge`）**  
   调用 `window.api.xxx(...)` 时，参数会先经**结构化克隆**进入 preload。若参数里含 **Vue 的 Proxy**（典型：`ref` 里的数组如 `attachmentPaths.value`），在这一步就会失败，**尚未执行 preload 里的 `ipcArg`**。

2. **preload → 主进程（`ipcRenderer.invoke`）**  
   同样需要可克隆数据；因此在 preload 中对对象参数做 `JSON.parse(JSON.stringify(...))`（本项目中的 `ipcArg` / `invoke` 封装）。

3. **主进程 → 渲染进程（返回值）**  
   从 SQLite / 驱动返回的对象可能带不可克隆特性；主进程侧用 `cloneForIpcReply` + `ipcHandle` 统一 `JSON` 序列化后再通过 IPC 返回。

**处理汇总**：

| 位置 | 做法 |
|------|------|
| 渲染进程 | 调用 `window.api` 传**对象**前使用 `toPlain()`（`src/renderer/utils/ipcPayload.ts`），保证进入 preload 前已是纯 JSON 数据 |
| preload | 所有 `invoke` 参数走 `ipcArg` |
| 主进程 | `ipcHandle` + `cloneForIpcReply` 包装返回值 |

**教训**：仅改 preload 不够，**必须先**在渲染进程去掉 Proxy，再谈两侧序列化。

---

## 七、体验与工程化补充

- Toast；`categoriesRevision` 同步分类与抽屉；关键路径显式报错。
- **`msgFromCatch`**（`src/renderer/utils/error.ts`）：从 `catch` 取可读信息供 Toast 复用。

---

## 八、常用命令速查

| 命令 | 说明 |
|------|------|
| `npm run install:safe` | 推荐首次/重装依赖（含 Electron 二进制与原生模块重编） |
| `npm run dev` | 开发调试 |
| `npm run build` | 前端 + 主进程 + preload 构建并打 Windows 安装包 |
| `npm run release` | 构建并 **发布** 到 GitHub Releases（需配置 `build.publish` + 环境变量 `GH_TOKEN`，见第十一节） |
| `npm run build:vite` | 仅构建资源，不打安装包 |
| `npm run rebuild:native` | 单独重编 `better-sqlite3` |
| `npm run sync:github` | **提交后**推送当前分支与本地 tags 到 `origin`（须已配置 remote 与身份验证） |

---

## 九、数据落盘位置（Windows）

- **数据库**：`%APPDATA%\doing-list\doing-list.db`（具体以 `app.getPath('userData')` 为准，与 `package.json` 中 `name` 相关）。
- **附件**：`userData/attachments/` 下文件；库内为相对路径 `attachments/xxx`。

备份：复制整个 `userData` 下应用目录即可（含 `doing-list.db` 与 `attachments`）。

---

## 十、后续可扩展方向（非本次必做）

- 数据导出/导入、一键备份。
- 应用图标、正式发布时代码签名（减小 SmartScreen 警告）。
- 托盘、全局快捷键、Markdown 日记等。

---

## 十一、连接 GitHub 并以 Releases 分发更新

本项目已接入 **`electron-updater`**，构建产物可由 **`electron-builder` 发布到 GitHub Releases**，终端用户无需卸载重装即可在线更新（见设置页「检查更新」；打包版启动时也会静默检查）。

### 11.0 把源代码推到 GitHub（无法用应用内「一键」替代）

**不能把账号密码写进 Electron 里自动 push**，安全上也不允许。源代码同步必须在 **你的电脑** 上用 **Git** 完成；配置好 [SSH](https://docs.github.com/zh/authentication/connecting-to-github-with-ssh) 或 HTTPS 凭据后，日常使用：

1. 在 Cursor / VS Code **提交**变更；  
2. **推送**：用界面上的「推送 / Sync」，或在项目根执行：

   ```bash
   npm run sync:github
   ```

   （等价于推送当前分支到 `origin`，并推送本地 **tags**。）  
   - **首次**若无上游分支，可先：`git remote add origin https://github.com/OWNER/REPO.git`（若尚未添加），再 `git push -u origin main`（分支名按实际修改）。

之后 **GitHub Actions**（见 **11.3**）才能在你 **push 了 tag** 后在云端自动构建、上传安装包——那是「自动发布 Release」，不是替你执行 `git push`。

### 11.1 仓库配置（首次必做）

1. **在 GitHub 上创建远程仓库**（远端必须已存在，**不能**只靠 `git push` 推到一个不存在的 URL，GitHub 不会自动建库）。可以用下面两种方式之一，**无需**一定在网页上点「New」：
   - **命令行（推荐）**：安装 [GitHub CLI](https://cli.github.com/)（Windows 可用 `winget install GitHub.cli`）。在本机执行 `gh auth login` 登录后，在**项目根目录**（已 `git init` 且已有提交）执行：

     ```bash
     gh repo create 你的仓库名 --public --source=. --remote=origin --push
     ```

     其中 `你的仓库名` 与之后在 `package.json` 里填的 `repo` 一致。如需私有仓库，把 `--public` 改成 `--private`。若本地已有名为 `origin` 的 remote，可先删掉或改用其它 remote 名（见 `gh repo create --help`）。

   - **网页**：新建空仓库后，按 GitHub 提示添加 `remote` 并首次 `git push`。

2. 编辑 **`package.json`**，将下列占位符全部改为你的用户名与仓库名（需一致）：
   - **`repository`** / **`homepage`** 中的 GitHub URL  
   - **`build.publish`** 里 `"owner"`、`"repo"`  
3. **`version`**（如 `0.1.0`）即发布版本号；此后每次发新版应递增（符合 semver）。

### 11.2 本地发布 Release

1. 申请 **Personal Access Token**（classic）：至少需要 **`repo`** 权限。
2. 在终端设置环境变量（PowerShell 示例）：

   `$env:GH_TOKEN = 'ghp_xxxxx'`（勿提交到仓库）

3. 执行 **`npm run release`**：会先 `electron-vite build`，再打 Windows 安装包并通过 **`electron-builder --publish`** 上传到仓库的 **Releases**。  
   - **首次**：也可在网页上手动创建同名 Release，`release` 会往该 Release **追加资源文件**。

### 11.3 GitHub Actions 自动发版（可选）

推送符合 **`v*`** 的 **tag**（例如 `git tag v0.2.0`，再 `npm run sync:github`），若已启用仓库里的 **`.github/workflows/release.yml`**，会在云端执行与 `npm run release` 相同的构建与上传。此时 **无需**再配置 `GH_TOKEN` 到本机（工作流使用 `secrets.GITHUB_TOKEN`）。

**注意**：tag 与 `package.json` 的 `version` 应对应（团队习惯上 `v` 前缀 + 版本号一致），避免更新比较混乱。

### 11.4 客户端如何收到更新

- 安装过一次 **已从该 Releases 安装的正式包**（内含更新元数据）后，`electron-updater` 会访问 **同一 GitHub 仓库** 的最新 Release 资源；
- **开发模式**（`npm run dev`）不拉取远端更新；
- **私有仓库**的 Release 可能需要额外配置令牌，一般用 **公开仓库**分发即可。

---

*与当前仓库代码同步。*
