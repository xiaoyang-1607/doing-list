# 开发指南

本文面向维护者与贡献者。终端用户使用说明见 [README.md](README.md)。

---

## 仓库结构

```
doing-list/
├── .github/workflows/   # CI：tag 触发 Release 构建
├── docs/                # 扩展文档目录（个人复盘 DEVELOPMENT.md 仅本地，不提交）
├── scripts/             # Git 同步等维护脚本
├── src/
│   ├── main/            # Electron 主进程、IPC、AI、附件
│   ├── preload/         # contextBridge
│   ├── renderer/        # Vue 3 前端
│   ├── db/              # SQLite schema 与仓储
│   └── shared/          # 共享类型
├── CONTRIBUTING.md      # 本文件
└── README.md            # 用户使用说明
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面壳 | Electron |
| 前端 | Vue 3、Vue Router（Hash）、Tailwind CSS |
| 构建 | electron-vite、TypeScript、electron-builder（NSIS） |
| 数据 | SQLite（`better-sqlite3`），库与附件在 `userData` |

---

## 环境要求

- **Node.js** 22 LTS（与 GitHub Actions 一致）
- **Windows**（当前主要开发与打包目标）
- Git

---

## 本地开发

```bash
git clone https://github.com/xiaoyang-1607/doing-list.git
cd doing-list
npm install
npm run dev
```

若 `better-sqlite3` 安装失败（Node 版本过新、无预编译包等）：

```bash
npm run install:safe
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发调试 |
| `npm run build` | 构建并打 Windows 安装包 |
| `npm run build:vite` | 仅编译资源，不打安装包 |
| `npm run release` | 构建并发布到 GitHub Releases（需 `GH_TOKEN`） |
| `npm run rebuild:native` | 重编 `better-sqlite3` |
| `npm run sync:github` | 推送当前分支与 tags |
| `npm run readme:publish -- "说明"` | 仅提交 README 并推送 |

---

## Windows / PowerShell 说明

**PowerShell 5** 不支持在一行中使用 `&&`。推送代码请分行执行，或使用 `npm run sync:github`。

若 `npm run build` 报 **`&&` 不是有效语句分隔符**：

```powershell
npm config set script-shell "C:\Windows\System32\cmd.exe"
```

或改用 [PowerShell 7](https://github.com/PowerShell/PowerShell/releases)。

---

## 构建安装包

```bash
npm run build
```

- 产物目录：**`release/`**
- 典型文件名：**`Doing List Setup {version}.exe`**
- `release/` 已在 `.gitignore` 中，**勿提交**；应上传到 GitHub Releases

---

## 发布新版本

发版前确认 `package.json` 中 **`version`** 与 **`build.publish`**（`owner` / `repo`）指向本仓库。

### 方式 A：GitHub Actions（推荐）

推送 **`v*`** 格式 tag 后，[`.github/workflows/release.yml`](.github/workflows/release.yml) 会在云端构建并上传，**无需**本机 `GH_TOKEN`。

```powershell
# 1. 递增 package.json 的 version
# 2. 提交并推送
git add package.json
git commit -m "chore: release v0.2.0"
git push

# 3. 打 tag 并推送
git tag v0.2.0
npm run sync:github
```

在 [Releases](https://github.com/xiaoyang-1607/doing-list/releases) 确认 `.exe` 已上传。tag 建议与 `version` 一致（带 `v` 前缀）。

### 方式 B：本机 `npm run release`

1. 申请 GitHub PAT（classic，`repo` 权限）
2. PowerShell：`$env:GH_TOKEN = 'ghp_…'`（**勿提交**）
3. 执行 `npm run release`

### 方式 C：本地打包 + 手动上传

1. `npm run build`
2. GitHub → Releases → Draft a new release
3. 上传 `release/` 下的安装包

---

## 同步 GitHub

日常推送：

```bash
npm run sync:github
```

等价于 `git push -u origin HEAD` 与 `git push origin --tags`（见 `scripts/git-sync.mjs`）。

---

## 数据位置（开发调试）

与正式版相同，便于联调：

- 数据库：`%APPDATA%\doing-list\doing-list.db`
- 附件：`%APPDATA%\doing-list\attachments\`

---

## 安全与提交规范

以下内容**不得**进入 Git：

- API Key、GitHub PAT、`GH_TOKEN` 等密钥
- `.env` / `.env.*`
- 代码签名私钥（`.p12`、`.pfx` 等）
- `node_modules/`、`out/`、`release/` 构建产物
- 个人开发复盘 `docs/DEVELOPMENT.md`（已在 `.gitignore`）

---

## 个人开发笔记

`docs/DEVELOPMENT.md` 用于本地记录踩坑与迭代复盘，**刻意不纳入版本库**。公开仓库仅维护 README（用户）与本 CONTRIBUTING（开发者）。
