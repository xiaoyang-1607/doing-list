# Doing List

个人学习任务与日记的 Windows 桌面应用：任务分类与状态、附件图片、**感悟时间轴**（与日记「引入」按日同步），以及 OpenAI 兼容接口下的任务分析与日记复盘。

**仓库**：[github.com/xiaoyang-1607/doing-list](https://github.com/xiaoyang-1607/doing-list)

---

## 下载安装（Windows）

正式版安装包在 **[GitHub Releases](https://github.com/xiaoyang-1607/doing-list/releases)** 发布。

1. 打开上方 Releases 页面，选择最新版本。
2. 下载 **`Doing List Setup x.x.x.exe`**（NSIS 安装程序）。
3. 运行安装程序并按向导完成安装。
4. 安装后可在应用 **设置 → 应用更新** 中手动检查更新；正式版启动时也会静默检查新版本。

> 若尚未发布 Release，请由维护者按下方「发布新版本」流程构建并上传安装包。

---

## 技术栈

- Electron、Vue 3、Vite、Tailwind CSS
- SQLite（`better-sqlite3`），数据与附件位于系统 `userData` 目录

---

## 开发与运行

```bash
npm install
npm run dev
```

若 `better-sqlite3` 安装失败：

```bash
npm run install:safe
```

**Windows（PowerShell 5）：** 终端不支持在一行里写 `&&`。推送代码请分行执行，或使用：

```powershell
npm run readme:publish -- docs: 提交说明
```

若 `npm run build` 报 **`&&` 不是有效语句分隔符**，可改用 cmd 作为 npm 脚本 shell：

```powershell
npm config set script-shell "C:\Windows\System32\cmd.exe"
```

或安装 [PowerShell 7](https://github.com/PowerShell/PowerShell/releases)。

---

## 构建安装包（本地）

在项目根目录执行：

```bash
npm run build
```

- 会先编译 Electron 主进程、preload 与 Vue 前端，再打包 Windows 安装程序。
- 产物位于 **`release/`** 目录，典型文件名为 **`Doing List Setup {version}.exe`**。
- `release/` 已在 `.gitignore` 中，**不要**把安装包提交进 Git；应上传到 GitHub Releases。

---

## 发布新版本（维护者）

发布前请确认 `package.json` 中 **`version`** 与 **`build.publish`**（`owner` / `repo`）已指向本仓库。

### 方式 A：GitHub Actions 自动发版（推荐）

仓库已配置 [`.github/workflows/release.yml`](.github/workflows/release.yml)。推送 **`v*`** 格式的 tag 后，会在云端构建并上传到 Releases，**无需**在本机配置 `GH_TOKEN`。

```powershell
# 1. 递增 package.json 的 version（如 0.1.0 → 0.2.0）
# 2. 提交并推送源码
git add package.json
git commit -m "chore: release v0.2.0"
git push

# 3. 打 tag 并推送（tag 建议与 version 一致，带 v 前缀）
git tag v0.2.0
npm run sync:github
```

完成后在 [Releases](https://github.com/xiaoyang-1607/doing-list/releases) 查看是否出现对应版本及 `.exe` 附件。

### 方式 B：本机构建并上传

1. 申请 GitHub **Personal Access Token**（classic，至少 **`repo`** 权限）。
2. 在 PowerShell 中设置环境变量（**勿**写入仓库）：

   ```powershell
   $env:GH_TOKEN = 'ghp_你的令牌'
   ```

3. 执行：

   ```bash
   npm run release
   ```

   等价于 `electron-vite build` + 打 NSIS 包 + 通过 `electron-builder --publish` 上传到 Releases。

### 方式 C：仅本地打包、手动上传

1. `npm run build`
2. 打开 GitHub 仓库 → **Releases** → **Draft a new release**
3. 填写 tag / 标题（建议 `v` + `package.json` 的 `version`）
4. 将 `release/` 下的 **`Doing List Setup *.exe`** 拖入附件并发布

---

## 数据位置（Windows）

- **数据库**：`%APPDATA%\doing-list\doing-list.db`
- **附件**：`%APPDATA%\doing-list\attachments\`

备份时复制上述应用目录即可。

---

## 许可

个人使用为主；如需开源协议可自行在仓库中补充。
