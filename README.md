# Doing List

个人学习任务与日记的 Windows 桌面应用：任务分类与状态、附件图片、**感悟时间轴**（与日记「引入」按日同步），以及 OpenAI 兼容接口下的任务分析与日记复盘。

**仓库**：[github.com/xiaoyang-1607/doing-list](https://github.com/xiaoyang-1607/doing-list)

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

若 `better-sqlite3` 安装失败，可使用项目内脚本（见下文献）：

```bash
npm run install:safe
```

**Windows（PowerShell 5）：** 终端里不要在一行写多条 `git … && …`；可先 `git add` / `git commit` / `npm run sync:github` **分三行**，或一条命令：

```powershell
npm run readme:publish -- docs: 提交说明
```

若 `npm run build` 报 **`&&` 不是有效语句分隔符**，见 [docs/DEVELOPMENT.md — 第八节](docs/DEVELOPMENT.md)。

---

## 构建安装包

```bash
npm run build
```

产物在 `release/` 目录（Windows NSIS）。发布到 GitHub Releases、环境踩坑与 IPC 说明见 **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**。

---

## 许可

个人使用为主；如需开源协议可自行在仓库中补充。
