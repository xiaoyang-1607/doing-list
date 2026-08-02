# 开发与贡献指南

本文面向维护者和贡献者；终端用户说明见 [README.md](README.md)，安全问题请遵循 [SECURITY.md](SECURITY.md)。

## 技术栈与目录

- Electron、Vue 3、Vue Router、Tailwind CSS
- TypeScript、electron-vite、electron-builder（NSIS）
- SQLite（`better-sqlite3`）

```text
doing-list/
├─ .github/          # CI、CodeQL、Dependabot 与 Release 工作流
├─ docs/releases/    # 已发布版本说明
├─ scripts/          # 受限的维护和发布校验脚本
├─ src/main/         # Electron 主进程、IPC、AI、附件
├─ src/preload/      # contextBridge 暴露的最小 API
├─ src/renderer/     # Vue 页面与状态
├─ src/db/           # SQLite schema 与仓储
└─ src/shared/       # 主进程与渲染进程共享类型
```

## 环境与安装

- Node.js 22.12–24.x（CI 使用 Node.js 22）
- Windows 10/11
- Git

```powershell
npm ci
npm run dev
```

如果 Electron 运行时下载被网络中断，直接重试 `npm ci`。不要使用 `--force` 或 `--legacy-peer-deps` 绕过版本约束。`better-sqlite3` 13 使用随包发布的 Node-API 二进制，构建配置会跳过不必要的 ABI 重编译。

## 质量检查

提交前至少运行：

```powershell
npm run audit:prod
npm run check
```

`npm run check` 依次执行 TypeScript/Vue 类型检查、Node 测试和 electron-vite 构建。需要验证 Windows 安装包时运行 `npm run build`，产物写入被 Git 忽略的 `release/`。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动开发模式 |
| `npm test` | 运行输入校验和日记摘要测试 |
| `npm run typecheck` | TypeScript/Vue 类型检查 |
| `npm run build:vite` | 构建主进程、preload 与渲染资源 |
| `npm run check` | 执行提交前完整检查 |
| `npm run build` | 完整检查后构建 Windows 安装包 |
| `npm run verify:package` | 在打包后的 Electron 中执行 SQLite 冒烟测试 |
| `npm run cleanup:installers` | 只删除仓库内 `release/` 构建产物 |
| `npm run sync:github` | 只推送当前分支，不推送 tag |

## 代码与安全约定

- 渲染进程不得启用 Node.js 集成或直接访问文件系统、数据库和密钥。
- 新增 IPC 时同时更新共享类型，在主进程边界验证所有外部输入，并补充测试。
- 文件操作必须把解析后的路径限制在明确目录内；递归删除不得指向仓库外路径。
- 非本机网络请求必须使用 HTTPS，并设置超时和响应大小上限。
- 不得提交 `.env`、API Key、GitHub Token、数据库、用户附件、日志、安装包或代码签名私钥。
- GitHub Actions 必须固定到完整提交 SHA；Dependabot 负责提出更新 PR。
- 不要通过 shell 字符串拼接用户输入；调用子进程时传递独立参数数组。

## 提交流程

1. 从最新 `master` 创建分支。
2. 保持提交范围单一，推荐使用 `feat:`、`fix:`、`docs:`、`test:`、`refactor:`、`chore:` 前缀。
3. 更新测试和 `[Unreleased]` 变更记录。
4. 运行生产依赖审计和完整检查。
5. 推送分支并通过 CI、依赖审查和 CodeQL。

## 发布流程

发布由 `.github/workflows/release.yml` 在显式推送 `v*` tag 时触发。普通的 `npm run sync:github` 不会推送 tag，避免意外发布。

1. 更新 `package.json` 与 `package-lock.json` 中的版本。
2. 把 `CHANGELOG.md` 的待发布内容整理为 `## [x.y.z] - YYYY-MM-DD`。
3. 运行 `npm run verify:release`、`npm run audit:prod` 和 `npm run build`。
4. 提交并推送版本变更，等待 `master` CI 通过。
5. 创建与版本完全一致的 tag，并单独推送：

```powershell
git tag v0.2.0
git push origin v0.2.0
```

工作流会再次校验 tag、版本和变更日志，构建安装包，生成 `SHA256SUMS.txt`，再创建带自动发行说明的 GitHub Release。不要移动或复用已发布 tag。

## 本地数据提醒

开发模式与安装版默认共享 `%APPDATA%\doing-list`。调试删除、迁移和附件清理功能前，请先备份真实数据，或使用隔离的 Windows 测试账户。
