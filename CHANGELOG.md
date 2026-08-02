# 变更日志

本项目的显著变更记录在此文件中，版本号遵循语义化版本格式。

## [Unreleased]

### 安全

- 升级 Electron、Vite、electron-vite、electron-builder 和 SQLite 原生依赖，移除已知高危/严重依赖链。
- 将 GitHub Actions 固定到不可变提交，增加 CodeQL、依赖变更审查和 Dependabot。
- 将清理脚本限制在仓库构建目录内，普通同步不再隐式推送所有 tag。
- 完整打包前清理旧产物，防止原生依赖文件被上一版本污染。
- 增加打包后 Electron/SQLite 冒烟测试，阻止不兼容安装包进入 Release。
- 打包器复用已安装并校验的 Electron 运行时，避免重复下载造成的不一致。
- 统一安装包文件名，并在未配置代码签名时仍保留 Windows 可执行文件元数据。
- 排除非目标平台的 SQLite 二进制与构建源码，减小 Windows 安装包体积。
- 移除维护脚本中的 shell 字符串拼接，发布前校验 tag、包版本与变更日志一致性。
- 新增生产依赖审计与 Release SHA-256 清单。
- Release 上传步骤支持安全重试，不会因已创建的部分 Release 直接失败。
- Dependabot 自动处理兼容更新，主版本升级保留给人工迁移与评审。

### 改进

- 为 IPC 输入、日期、任务字段和附件路径增加运行时校验与自动化测试。
- 使用系统安全存储保护 AI API Key，并限制非本机 HTTP 服务地址。
- 加强 Electron 渲染沙箱、上下文隔离和内容安全策略。
- 增加日记自动保存、附件生命周期清理及更可靠的任务摘要导入。
- 重写用户、贡献和安全文档。

## [0.1.2] - 2026-05-22

### 新增

- 任务状态与分类组合筛选。
- 日记单篇/全部 Markdown 导出。

### 修复

- 防止重复导入自动生成的任务摘要。
- 修复早期安装包的启动与打包问题。

[Unreleased]: https://github.com/xiaoyang-1607/doing-list/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/xiaoyang-1607/doing-list/releases/tag/v0.1.2
