# 安全策略

## 支持范围

安全修复优先应用于 `master` 分支和最新 GitHub Release。旧版本可能不再接收补丁，用户应尽快升级到最新稳定版。

## 私下报告漏洞

请使用仓库的 [GitHub Private Vulnerability Reporting](https://github.com/xiaoyang-1607/doing-list/security/advisories/new) 提交报告，不要公开创建 Issue、Discussion 或 Pull Request。

报告中建议包含：

- 受影响版本、操作系统和复现前提
- 可重复的最小步骤或概念验证
- 实际影响与预期行为
- 你已尝试的缓解方式

请勿在测试中访问、修改或公开他人的数据，也不要进行拒绝服务、社会工程或供应链投毒。维护者确认问题并准备修复前，请保持细节私密。

## 用户侧安全建议

- 仅从本仓库 Releases 下载安装包，并核对 Release 中的 SHA-256。
- 为 AI 服务使用可撤销、低权限、有限额的独立 API Key。
- 非本机 AI 服务只使用 HTTPS。
- 定期备份 `%APPDATA%\doing-list`，但不要把数据库或附件提交到公开仓库。
