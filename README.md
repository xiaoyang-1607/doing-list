# Doing List

[![CI](https://github.com/xiaoyang-1607/doing-list/actions/workflows/ci.yml/badge.svg)](https://github.com/xiaoyang-1607/doing-list/actions/workflows/ci.yml)
[![CodeQL](https://github.com/xiaoyang-1607/doing-list/actions/workflows/codeql.yml/badge.svg)](https://github.com/xiaoyang-1607/doing-list/actions/workflows/codeql.yml)
[![Latest release](https://img.shields.io/github/v/release/xiaoyang-1607/doing-list)](https://github.com/xiaoyang-1607/doing-list/releases/latest)

Doing List 是一款面向 Windows 的本地任务与日记桌面应用。它把待办、分类、每日感悟和复盘放在一个轻量界面里；除用户主动使用 AI 功能外，业务数据不会上传到云端。

最新稳定版：[v0.1.2](https://github.com/xiaoyang-1607/doing-list/releases/tag/v0.1.2)。`master` 分支包含尚未发布的质量与安全改进，详情见 [CHANGELOG.md](CHANGELOG.md)。

## 功能

- 任务：创建、编辑、删除、分类，并在“未开始 / 进行中 / 已完成”之间流转
- 筛选：组合使用任务状态与分类筛选
- 感悟时间轴：为任务记录按日期组织的感悟
- 日记：自动保存、导入当天任务摘要、导出单篇或全部 Markdown
- 附件：为任务添加本地图片，删除任务或移除图片后清理无引用副本
- AI（可选）：连接 OpenAI 兼容接口，进行任务分析和周/月复盘
- 更新：安装版可从 GitHub Releases 检查新版本

## 下载与安装

1. 前往 [GitHub Releases](https://github.com/xiaoyang-1607/doing-list/releases/latest)。
2. 下载 `Doing-List-Setup-x.x.x.exe`，不要下载源码压缩包作为安装程序。
3. 运行安装程序。当前安装包尚未进行商业代码签名，Windows 可能显示“未知发布者”；请确认下载地址属于本仓库并核对校验值。

v0.1.2 安装程序 SHA-256：

```text
2ddd7e5556c55a256fb98841fc7dea01a29da307b6877dcaa0944bfa4a10b83e  Doing-List-Setup-0.1.2.exe
```

PowerShell 校验命令：

```powershell
Get-FileHash -Algorithm SHA256 .\Doing-List-Setup-0.1.2.exe
```

请勿使用 v0.1.0，该版本存在已知启动问题。推荐始终安装最新 Release。

## 数据、隐私与安全

业务数据默认位于 Windows 用户目录：

| 内容 | 路径 |
| --- | --- |
| SQLite 数据库 | `%APPDATA%\doing-list\doing-list.db` |
| 附件副本 | `%APPDATA%\doing-list\attachments\` |

- 备份：退出应用后复制整个 `%APPDATA%\doing-list\` 目录。
- 卸载：卸载程序不会自动删除上述个人数据；需要彻底移除时请先备份，再手动删除目录。
- AI：只有主动调用 AI 功能时，相关任务或日记内容才会发送到你配置的服务商。请先阅读该服务商的隐私政策。
- API Key：当前源码使用 Electron `safeStorage` 加密后再保存；渲染页面无法直接读取已保存的明文密钥。若系统不支持安全存储，应用会拒绝保存密钥。
- 网络：非本机 AI 服务地址必须使用 HTTPS；`localhost`/`127.0.0.1` 可使用 HTTP。
- 桌面隔离：窗口启用了渲染进程沙箱、上下文隔离、禁用 Node.js 集成，并限制 IPC 输入和附件路径。

发现安全问题时，请勿创建公开 Issue；按 [SECURITY.md](SECURITY.md) 中的方式私下报告。

## 开发

要求 Node.js 22.12–24.x、Git 和 Windows。`better-sqlite3` 13 使用随 npm 包发布的 Node-API 二进制，无需为 Electron 单独重编译。

```powershell
git clone https://github.com/xiaoyang-1607/doing-list.git
cd doing-list
npm ci
npm run dev
```

提交前执行：

```powershell
npm run audit:prod
npm run check
```

常用命令、项目结构和发布流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 参与贡献

欢迎通过 Issue 反馈可复现的问题，或通过 Pull Request 提交改进。提交前请确保没有包含 API Key、访问令牌、数据库、私人日记、附件或签名证书。

## 许可

仓库目前没有附加开源许可证。除法律默认允许的浏览与派生平台权利外，代码的复制、修改和再分发未获得明确授权。维护者若希望开放这些权利，应先选择并添加合适的 `LICENSE` 文件。
