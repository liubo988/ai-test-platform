# Task Brief

## 标题
- CentOS 7 裸机 best-effort 部署脚本补齐

## 背景
- 当前仓库已有 Ubuntu 裸机部署脚本和 CentOS 7 Docker 部署脚本。
- 用户明确要求 CentOS 7 物理机、非 Docker 环境直接部署。
- 这条路径不在当前 Next.js 16 + Playwright 官方支持面内，但需要提供仓库内可执行的 best-effort 脚本与文档入口。

## 本轮目标
- 新增 CentOS 7 裸机 bootstrap 脚本，尽量把系统依赖、Node、浏览器依赖、构建和 systemd 装配串起来。
- 同步补稳定部署文档，明确使用方式与边界。

## 验收标准
- [ ] 仓库内存在可执行的 CentOS 7 裸机部署脚本入口
- [ ] 脚本会对系统类型、环境文件和关键依赖做明确检查
- [ ] 稳定文档已说明这条路径的 best-effort 边界与执行步骤

## 范围
- 会改：
  - `scripts/deploy/**`
  - `docs/**`
- 不会改：
  - 数据库 schema
  - 公共 API 契约
  - 业务主流程逻辑

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`

## 计划修改点
- 新增 CentOS 7 裸机 bootstrap 脚本
- 新增 CentOS 7 裸机部署文档
- 在 README 中补充部署入口索引

## 验证
- `bash -n scripts/deploy/*.sh`
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- CentOS 7 裸机部署依然属于 unsupported / best-effort 路径
- 浏览器运行库和 Node unofficial builds 后续可能随上游变化而漂移

## 完成后动作
- 同步稳定文档入口
