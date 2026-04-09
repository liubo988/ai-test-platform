# Task Brief

## 目标

按 `docs/intent-e2e-experience-recall-playbook-plan-2026-04-09.md` 完成 `E2` 的最小闭环：

- 把 `intent-project-recipe-registry` 补成真正的 `project-aware` 资产读写
- 把 run review 里的 `playbookCandidates` 接到现有 `intent-recipes` merge 链路

## 范围

- `lib/intent-project-recipe-registry.ts`
- `lib/intent-recipe-registry.ts`
- `lib/test-generator.ts`
- `lib/intent-project-recipe-governance.ts`
- `lib/intent-e2e-playbook.ts`
- `components/IntentE2EWorkbench.tsx`
- `app/api/projects/[projectUid]/intent-recipes/**`
- 相关 unit tests

## 非目标

- 不扩 `E4 OCR`
- 不新增 DB schema
- 不新增 route
- 不改现有 SSE 协议
- 不顺手处理无关脏改动

## 验收

- recipe 资产在项目上下文下不再写入全局 legacy 文件
- playbook candidate 能通过现有项目 recipe merge 流程落库并被后续 planning 命中
- `npm run build`、受影响 `vitest`、`npm run build:web`、文档校验通过
