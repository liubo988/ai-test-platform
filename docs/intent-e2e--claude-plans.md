# Intent E2E 阶段 1 详细开发计划

## 修复核心缺陷

**目标：** 将成功率从 14.3% 提升到 40-50%

---

## 任务 1：启用 Slot-based Patching

### 1.1 修改 `repairExecution()` 使用 slot patching

**文件：** `lib/services/test-plan-service.ts:748-860`

**当前问题：**
- 第 807-823 行调用 `repairTest()` 完整重新生成代码
- 未使用 `IntentExecutionSlotPatch` 基础设施
- `repairTest()` 内部虽已有 `streamStructuredRepairPatchGeneration`（`lib/test-generator.ts:2673`），但 `repairExecution()` 未利用结构化修复输出

**修改步骤：**

#### 步骤 1.1.1：解析原始执行计划中的 slot 标记

在 `repairExecution()` 第 796 行（`const events = await listExecutionEvents(executionUid);`）之后添加：

```typescript
// 新增：检查原始代码是否包含 slot 标记
const hasSlotMarkers = hasIntentExecutionSlotMarkers(plan.planCode);
```

需要导入（文件顶部已有相关导入则跳过）：
```typescript
import {
  hasIntentExecutionSlotMarkers,
  resolveIntentExecutionPatchTargetSlotUids,
  applyIntentExecutionSlotPatch,
} from '@/lib/intent-execution-slot-patch';
import { compileIntentExecutionTemplate } from '@/lib/intent-execution-compiler';
```

**验证标准：**
- `hasIntentExecutionSlotMarkers()` 能正确检测 `// SLOT_START:` 标记（函数位于 `lib/intent-execution-slot-patch.ts:126`）
- 无 slot 标记时 `hasSlotMarkers` 返回 `false`

#### 步骤 1.1.2：识别失败的 slot

在步骤 1.1.1 之后添加：

```typescript
let targetSlotUids: string[] = [];
let originalTemplate: IntentCompiledExecutionTemplate | null = null;

if (hasSlotMarkers) {
  // 尝试编译出 template 以定位失败 slot
  try {
    originalTemplate = compileIntentExecutionTemplate(plan.planCode);
    targetSlotUids = resolveIntentExecutionPatchTargetSlotUids(
      originalTemplate,
      { failedStepTitle: execution.resultSummary || '' }
    );
  } catch {
    // 编译失败则降级到完整重新生成
    originalTemplate = null;
  }
}
```

**关键逻辑：**
- 使用 `compileIntentExecutionTemplate()`（`lib/intent-execution-compiler.ts`）解析代码为 template
- 使用 `resolveIntentExecutionPatchTargetSlotUids()`（`lib/intent-execution-slot-patch.ts:148`）根据失败步骤标题匹配 slot
- 编译失败时自动降级

**验证标准：**
- `"Step 2 失败"` → 返回包含 `plan_step_2` 的数组
- `"最终业务验收失败"` → 返回包含 `verification` 的数组
- 无法匹配 → 返回所有 slot UID
- 编译失败 → `originalTemplate` 为 `null`，走降级路径

#### 步骤 1.1.3：分支处理 — slot patching 或完整重新生成

将现有的第 807-823 行代码（`const repairedCode = await collectGeneratedCode({...})`）替换为分支逻辑：

```typescript
let repairedCode: string;

if (originalTemplate && targetSlotUids.length > 0) {
  // 路径 A：使用 slot patching
  try {
    repairedCode = await collectGeneratedCode({
      projectUid: config.projectUid,
      refUid: config.configUid,
      stream: repairTest(
        snapshot,
        promptDescription,
        {
          previousCode: plan.planCode,
          executionError: execution.errorMessage || execution.resultSummary || '执行失败',
          recentEvents: buildRepairEventDigest(events),
          repairMemoryHints: [], // 任务 2 会填充
          // 传递 slot 上下文给 repairTest，让其内部走 structured repair 路径
          originalTemplate,
          targetSlotUids,
        },
        auth,
        promptContext,
        llmConfig
      ),
      completionMessage: 'AI 纠错完成（slot patching），正在写入修复计划与用例',
    });
  } catch (slotError) {
    console.error('[repairExecution] slot patching 失败，降级到完整重新生成', slotError);
    // 降级：完整重新生成
    repairedCode = await collectGeneratedCode({
      projectUid: config.projectUid,
      refUid: config.configUid,
      stream: repairTest(
        snapshot,
        promptDescription,
        {
          previousCode: plan.planCode,
          executionError: execution.errorMessage || execution.resultSummary || '执行失败',
          recentEvents: buildRepairEventDigest(events),
        },
        auth,
        promptContext,
        llmConfig
      ),
      completionMessage: 'AI 纠错完成，正在写入修复计划与用例',
    });
  }
} else {
  // 路径 B：完整重新生成（无 slot 标记或无法解析 template）
  repairedCode = await collectGeneratedCode({
    projectUid: config.projectUid,
    refUid: config.configUid,
    stream: repairTest(
      snapshot,
      promptDescription,
      {
        previousCode: plan.planCode,
        executionError: execution.errorMessage || execution.resultSummary || '执行失败',
        recentEvents: buildRepairEventDigest(events),
      },
      auth,
      promptContext,
      llmConfig
    ),
    completionMessage: 'AI 纠错完成，正在写入修复计划与用例',
  });
}
```

**注意：** `repairTest()`（`lib/test-generator.ts:2838`）的 `RepairTestContext` 接口（`lib/test-generator.ts:92`）需要确认是否已包含 `originalTemplate` 和 `targetSlotUids` 字段。如果没有，需要在步骤 1.2 中扩展。

**验证标准：**
- 有 slot 标记的代码走路径 A
- 无 slot 标记的旧代码走路径 B
- 路径 A 失败时自动降级到路径 B
- 降级时有 console.error 日志

---

### 1.2 扩展 `RepairTestContext` 支持 slot 信息

**文件：** `lib/test-generator.ts:92`

**当前 `RepairTestContext` 接口：**

检查 `RepairTestContext`（第 92 行）是否已包含以下字段，如果没有则添加：

```typescript
export interface RepairTestContext {
  // ... 现有字段保持不变 ...
  previousCode: string;
  executionError: string;
  recentEvents?: string[];
  repairMemoryHints?: IntentRepairMemoryHint[];
  // 新增（如果不存在）：
  originalTemplate?: IntentCompiledExecutionTemplate;
  targetSlotUids?: string[];
}
```

**验证标准：**
- 接口变更不影响现有调用方
- 新增字段均为可选

---

### 1.3 确保 `repairTest()` 内部利用 slot 信息

**文件：** `lib/test-generator.ts:2838`

**检查 `repairTest()` 函数体：** 确认当 `repair.originalTemplate` 和 `repair.targetSlotUids` 存在时，内部是否会调用 `streamStructuredRepairPatchGeneration`（第 2673 行）走结构化修复路径。

如果当前逻辑没有根据这些字段做分支，需要在 `repairTest()` 函数中添加判断：

```typescript
// 在 repairTest() 函数体内（第 2838 行之后的函数体中）
if (repair.originalTemplate && repair.targetSlotUids?.length) {
  // 走 structured repair patch 生成路径
  yield* streamStructuredRepairPatchGeneration(
    snapshot, description, repair, auth, context, runtimeOverrides, signal, planning
  );
  return;
}
// 否则走原有完整重新生成路径
```

**验证标准：**
- 传入 `originalTemplate` + `targetSlotUids` 时走结构化修复路径
- 不传入时保持原有行为不变
- 生成的 `structured_patch` 事件包含正确的 slot 代码

---

### 1.4 测试验证

**新建文件：** `tests/unit/test-plan-service-slot-patch.spec.ts`

```typescript
import { repairExecution } from '@/lib/services/test-plan-service';

// 测试 1：有 slot 标记时使用 slot patching
test('repairExecution 使用 slot patching 修复失败步骤', async () => {
  // mock 一个包含 SLOT_START/SLOT_END 标记的失败执行
  const execution = createFailedExecution({
    resultSummary: 'Step 2: 点击生成订单按钮 - 失败',
    planCode: '// SLOT_START: plan_step_1\n...\n// SLOT_END: plan_step_1\n// SLOT_START: plan_step_2\n...\n// SLOT_END: plan_step_2',
  });

  const result = await repairExecution(execution.executionUid);

  // 验证走了 slot patching 路径
  expect(result.planCode).toContain('// SLOT_START: plan_step_2');
  expect(result.planCode).toContain('// SLOT_END: plan_step_2');
});

// 测试 2：无 slot 标记时自动降级
test('repairExecution 在无 slot 标记时降级到完整重新生成', async () => {
  const execution = createFailedExecution({
    planCode: 'test("old code", async ({ page }) => { /* no slot markers */ })',
  });

  const result = await repairExecution(execution.executionUid);

  expect(result.planCode).not.toContain('SLOT_START');
});

// 测试 3：slot patching 失败时降级
test('repairExecution 在 slot patching 异常时降级到完整重新生成', async () => {
  // mock repairTest 在 slot 模式下抛出异常
  const execution = createFailedExecution({
    planCode: '// SLOT_START: broken\n...\n// SLOT_END: broken',
  });

  const result = await repairExecution(execution.executionUid);

  // 应该成功（通过降级）
  expect(result.planUid).toBeDefined();
});
```

---

## 任务 2：闭合知识学习循环

### 2.1 修复时读取 repair memory hints

**文件：** `lib/services/test-plan-service.ts:748-860`

**当前问题：**
- `repairTest()` 的 `RepairTestContext` 已定义 `repairMemoryHints` 字段
- 但 `repairExecution()` 调用时未填充该字段（第 807-823 行传入的对象无此字段）
- `listRelevantIntentRepairHints()`（`lib/ai/intent-repair-memory.ts:394`）从未被调用

**修改步骤：**

#### 步骤 2.1.1：在 `repairExecution()` 中读取 hints

在第 796 行（`const events = await listExecutionEvents(executionUid);`）之后添加：

```typescript
// 新增：读取 repair memory hints
const repairMemoryHints = await listRelevantIntentRepairHints(
  {
    targetUrl: config.targetUrl || snapshot.url,
    pageTitle: snapshot.title,
    description: promptDescription,
    executionError: execution.errorMessage || execution.resultSummary || '执行失败',
    previousCode: plan.planCode,
    recentEvents: buildRepairEventDigest(events),
  },
  3, // 最多返回 3 个相关 hint
  { projectUid: config.projectUid }
);
```

需要导入（检查文件顶部是否已有，没有则添加）：
```typescript
import {
  listRelevantIntentRepairHints,
  recordIntentRepairFailure,
  recordIntentRepairResolution,
} from '@/lib/ai/intent-repair-memory';
```

**验证标准：**
- 能正确读取项目作用域的 repair memory
- 返回最相关的 3 个 hint
- 无 hint 时返回空数组（不影响流程）

#### 步骤 2.1.2：将 hints 传递给 `repairTest()` 调用

将步骤 1.1.3 中所有 `repairTest()` 调用的 `repairMemoryHints: []` 改为 `repairMemoryHints`：

```typescript
stream: repairTest(
  snapshot,
  promptDescription,
  {
    previousCode: plan.planCode,
    executionError: execution.errorMessage || execution.resultSummary || '执行失败',
    recentEvents: buildRepairEventDigest(events),
    repairMemoryHints, // ← 填充真实 hints
    originalTemplate,
    targetSlotUids,
  },
  auth,
  promptContext,
  llmConfig
),
```

同样修改路径 B（完整重新生成）中的调用，也传入 `repairMemoryHints`。

**验证标准：**
- hints 正确传递到 `repairTest()`
- `repairTest()` 内部调用 `renderIntentRepairMemoryHints()`（`lib/ai/intent-repair-memory.ts:422`）将 hints 渲染到 LLM prompt 中

---

### 2.2 成功修复后更新 repair memory

**文件：** `lib/ai/intent-e2e-service.ts`

**当前问题：**
- 修复成功后未调用 `recordIntentRepairResolution()`（`lib/ai/intent-repair-memory.ts:359`）
- 失败时未调用 `recordIntentRepairFailure()`（`lib/ai/intent-repair-memory.ts:307`）
- 文件顶部已导入这些函数（第 50-53 行），但函数体中未使用

**修改步骤：**

#### 步骤 2.2.1：在修复重试循环中记录失败

在 `runIntentDrivenE2EStream()` 函数（第 1567 行）的修复重试循环中（第 1749 行的 `for` 循环），找到执行失败的分支，添加：

```typescript
// 在检测到执行失败后添加
if (!testResult.success) {
  try {
    await recordIntentRepairFailure(
      {
        targetUrl: request.targetUrl || '',
        pageTitle: request.name || '',
        description: request.featureDescription || request.name || '',
        executionError: testResult.error || '执行失败',
        previousCode: currentCode,
        recentEvents: testResult.steps?.map(s => `${s.title}: ${s.status}`) || [],
      },
      { projectUid: request.projectUid || '' }
    );
  } catch (memErr) {
    console.error('[repair-memory] 记录失败异常', memErr);
  }
}
```

**验证标准：**
- 失败时自动记录到 repair memory
- 记录异常不影响主流程（try-catch 保护）
- 相同失败会聚合到同一 cluster

#### 步骤 2.2.2：在修复成功后记录成功

在同一循环中，找到修复成功的分支（即之前失败、本次重试成功的场景），添加：

```typescript
// 修复成功后记录
if (testResult.success && attemptIndex > 0) {
  try {
    const previousError = previousAttempt?.error || '';
    const previousCode = previousAttempt?.code || '';
    const hints = await listRelevantIntentRepairHints(
      {
        targetUrl: request.targetUrl || '',
        description: request.featureDescription || request.name || '',
        executionError: previousError,
        previousCode,
      },
      5,
      { projectUid: request.projectUid || '' }
    );

    if (hints.length > 0) {
      await recordIntentRepairResolution(
        {
          clusterIds: hints.map(h => h.clusterId),
          targetUrl: request.targetUrl || '',
          description: request.featureDescription || request.name || '',
          fixedCode: currentCode,
          finalResult: testResult,
        },
        { projectUid: request.projectUid || '' }
      );
    }
  } catch (memErr) {
    console.error('[repair-memory] 记录成功修复异常', memErr);
  }
}
```

**注意：** 需要在循环中保存上一次尝试的错误信息和代码，以便匹配 repair memory cluster。检查现有循环逻辑中是否已有 `previousAttempt` 类似变量，如果没有需要添加。

**验证标准：**
- 修复成功时自动更新 repair memory
- 成功策略被提取并记录
- `resolvedCount` 正确递增

---

### 2.3 实现策略提升逻辑

**文件：** `lib/intent-project-knowledge.ts`（新增导出函数）

在文件末尾添加新函数：

```typescript
/**
 * 当 repair memory cluster 成功率达标时，自动提升为项目知识规则。
 */
export async function promoteRepairStrategyToKnowledge(
  cluster: IntentRepairMemoryClusterSnapshot,
  projectUid: string
): Promise<boolean> {
  // 提升条件：成功率 >= 60%，至少修复过 3 次，有成功策略
  if (
    cluster.successRate < 0.6 ||
    cluster.resolvedCount < 3 ||
    cluster.successfulStrategies.length === 0
  ) {
    return false;
  }

  // 检查是否已提升过（避免重复）
  const profile = getIntentProjectKnowledgeProfile(projectUid);
  const alreadyPromoted = profile.rules.some(
    r => r.metadata?.repairClusterId === cluster.clusterId
  );
  if (alreadyPromoted) {
    return false;
  }

  // 构建知识规则
  const newRule: IntentProjectKnowledgeRule = {
    ruleId: `repair-promoted-${cluster.clusterId}`,
    category: cluster.category || 'interaction',
    condition: {
      urlPattern: cluster.sampleUrls?.[0] || '*',
      tags: cluster.tags || [],
    },
    guidance: [
      `针对 "${cluster.category}" 类型的失败，推荐策略：`,
      ...cluster.successfulStrategies.map(s => `- ${s}`),
      cluster.antiPatterns.length > 0 ? `\n常见误区：` : '',
      ...cluster.antiPatterns.map(a => `- 避免: ${a}`),
    ].filter(Boolean).join('\n'),
    metadata: {
      repairClusterId: cluster.clusterId,
      promotedAt: new Date().toISOString(),
      successRate: cluster.successRate,
      resolvedCount: cluster.resolvedCount,
      source: 'repair-memory-promotion',
    },
  };

  // 通过 mergeIntentProjectKnowledgeRules 添加
  await mergeIntentProjectKnowledgeRules([newRule]);
  console.log(`[knowledge-promotion] 提升 cluster=${cluster.clusterId} 到项目知识库`);
  return true;
}
```

需要导入（检查文件顶部，通常在同文件内不需要额外导入）：
```typescript
import type { IntentRepairMemoryClusterSnapshot } from '@/lib/ai/intent-repair-memory';
```

**注意：** `IntentProjectKnowledgeRule`（第 101 行）的字段名需要对照实际定义。上面代码中的 `ruleId`、`category`、`condition`、`guidance`、`metadata` 需要与实际接口匹配，可能需要调整字段名。

**验证标准：**
- 成功率 >= 60% 且修复次数 >= 3 时自动提升
- 已提升过的 cluster 不会重复提升
- 生成的规则包含成功策略和反模式

---

### 2.4 在修复成功后触发策略提升

**文件：** `lib/ai/intent-e2e-service.ts`

在步骤 2.2.2 记录成功修复之后，添加策略提升逻辑：

```typescript
// 紧接 recordIntentRepairResolution 之后
if (hints.length > 0) {
  const { listIntentRepairMemoryClusters } = await import('@/lib/ai/intent-repair-memory');
  const { promoteRepairStrategyToKnowledge } = await import('@/lib/intent-project-knowledge');
  const clusters = await listIntentRepairMemoryClusters(request.projectUid || '');

  for (const hint of hints) {
    const cluster = clusters.find(c => c.clusterId === hint.clusterId);
    if (cluster) {
      try {
        await promoteRepairStrategyToKnowledge(cluster, request.projectUid || '');
      } catch (promoteErr) {
        console.error('[knowledge-promotion] 提升异常', promoteErr);
      }
    }
  }
}
```

**验证标准：**
- 修复成功后自动检查是否应该提升
- 提升异常不影响修复主流程
- 符合条件的策略自动添加到项目知识库

---

### 2.5 测试验证

**新建文件：** `tests/unit/intent-repair-memory-integration.spec.ts`

```typescript
// 测试 1：repair memory hints 被使用
test('repairExecution 读取并使用 repair memory hints', async () => {
  await recordIntentRepairFailure({
    targetUrl: 'http://example.com/business',
    description: '点击下拉选项失败',
    executionError: 'ant-select-dropdown-hidden',
    previousCode: 'page.click(...)',
  });

  const execution = createFailedExecution({
    errorMessage: 'ant-select-dropdown-hidden',
  });

  const result = await repairExecution(execution.executionUid);
  expect(result.planUid).toBeDefined();
});

// 测试 2：成功修复后更新 memory
test('修复成功后更新 repair memory', async () => {
  const hint = await recordIntentRepairFailure({
    targetUrl: 'http://example.com',
    description: '测试',
    executionError: 'element not found',
    previousCode: 'page.click("#btn")',
  });

  await recordIntentRepairResolution({
    clusterIds: [hint.clusterId],
    targetUrl: 'http://example.com',
    description: '测试',
    fixedCode: 'await page.waitForSelector("#btn"); page.click("#btn");',
    finalResult: { success: true, duration: 1000, steps: [], error: null },
  });

  const clusters = await listIntentRepairMemoryClusters();
  const updated = clusters.find(c => c.clusterId === hint.clusterId);
  expect(updated?.resolvedCount).toBeGreaterThanOrEqual(1);
});

// 测试 3：策略自动提升
test('成功率达标后自动提升到项目知识库', async () => {
  const cluster: IntentRepairMemoryClusterSnapshot = {
    clusterId: 'test-cluster',
    category: 'interaction',
    tags: ['antd', 'select'],
    seenCount: 5,
    resolvedCount: 4,
    successRate: 0.8,
    representativeError: 'ant-select-dropdown-hidden',
    successfulStrategies: ['__e2e.selectAntdOption'],
    antiPatterns: ['page.click on hidden dropdown'],
    sampleUrls: ['http://example.com'],
    lastSeenAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    normalizedError: 'ant-select-dropdown-hidden',
    sampleTitles: [],
    sampleDescriptions: [],
    lastFailureCodeExcerpt: '',
    lastSuccessfulCodeExcerpt: '',
  };

  const promoted = await promoteRepairStrategyToKnowledge(cluster, 'project-test');
  expect(promoted).toBe(true);
});
```

---

## 任务 3：增强失败上下文

### 3.1 移除事件数量限制

**文件：** `lib/services/test-plan-service.ts:532`

**当前问题：**
- `buildRepairEventDigest()` 仅保留最后 24 个非 frame 事件

**修改：**

找到 `buildRepairEventDigest()` 函数（第 532 行），将硬编码的数量限制改为可配置或移除：

```typescript
function buildRepairEventDigest(
  events: Awaited<ReturnType<typeof listExecutionEvents>>,
  limit = 100 // 大幅提高上限，从 24 → 100
): string[] {
  const filtered = events.filter(e => e.level !== 'frame');
  // 保留最后 limit 个事件
  return filtered.slice(-limit).map(e => `[${e.timestamp}] ${e.level}: ${e.message}`);
}
```

**验证标准：**
- 默认保留最后 100 个事件（足够诊断大多数问题）
- 不会因事件过多导致 token 超限（100 条事件约 2000-5000 tokens）
- 仍然过滤 frame 级别事件

---

### 3.2 添加浏览器控制台日志捕获

**文件：** `lib/test-executor.ts:150`

**当前 `TestResult` 接口（第 12 行）：**
```typescript
export interface TestResult {
  success: boolean;
  duration: number;
  steps: StepResult[];
  error: string | null;
}
```

#### 步骤 3.2.1：扩展 `TestResult` 接口

```typescript
export interface TestResult {
  success: boolean;
  duration: number;
  steps: StepResult[];
  error: string | null;
  consoleLogs?: string[];      // 新增
  failedRequests?: NetworkRequestLog[]; // 新增
}

// 新增接口
export interface NetworkRequestLog {
  url: string;
  method: string;
  status: number;
  duration?: number;
}
```

#### 步骤 3.2.2：在 `executeTest()` 中捕获控制台日志和网络请求

在 `executeTest()` 函数（第 150 行）中，worker 进程通过消息机制返回结果。需要在 worker 中添加控制台和网络监听，或者在主进程处理 worker 消息时收集这些信息。

**方案 A（推荐 — 修改 worker 模板）：**

如果 worker 中有 Playwright `page` 对象，在 worker 代码模板中添加：

```typescript
// 在 worker 中的 page 初始化后添加
const __consoleLogs: string[] = [];
const __failedRequests: { url: string; method: string; status: number }[] = [];

page.on('console', msg => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    __consoleLogs.push(`[console.${msg.type()}] ${msg.text()}`);
  }
});

page.on('pageerror', error => {
  __consoleLogs.push(`[page-error] ${error.message}`);
});

page.on('response', response => {
  if (response.status() >= 400) {
    __failedRequests.push({
      url: response.url(),
      method: response.request().method(),
      status: response.status(),
    });
  }
});

// 在测试完成后，将这些信息通过 worker 消息发送回主进程
```

**方案 B（如果 worker 不方便修改）：**

在 `executeTest()` 的结果收集中，从 worker 日志消息中提取控制台错误和网络失败。

**验证标准：**
- 捕获所有 `console.error` 和 `console.warn`
- 捕获所有 4xx/5xx 网络请求
- 保存到 `TestResult` 中

---

### 3.3 在修复 prompt 中包含增强上下文

**文件：** `lib/test-generator.ts`

在 `buildRepairPrompt()` 函数（第 2207 行）中，检查是否已包含控制台日志和网络失败信息。如果没有，在 prompt 末尾添加：

```typescript
// 在 buildRepairPrompt() 中添加上下文章节
if (repair.consoleLogs?.length) {
  prompt += `\n\n## 浏览器控制台错误\n${repair.consoleLogs.join('\n')}`;
}

if (repair.failedRequests?.length) {
  prompt += `\n\n## 失败的网络请求\n${
    repair.failedRequests.map(r => `- ${r.method} ${r.url} → ${r.status}`).join('\n')
  }`;
}
```

同时需要扩展 `RepairTestContext`（第 92 行）添加：
```typescript
consoleLogs?: string[];
failedRequests?: NetworkRequestLog[];
```

**验证标准：**
- 修复 prompt 包含控制台日志
- 修复 prompt 包含失败的网络请求
- 新增字段为可选，不影响现有调用

---

### 3.4 测试验证

**新建文件：** `tests/unit/test-executor-context.spec.ts`

```typescript
// 测试 1：TestResult 支持新字段
test('TestResult 包含 consoleLogs 和 failedRequests 字段', () => {
  const result: TestResult = {
    success: false,
    duration: 1000,
    steps: [],
    error: 'test error',
    consoleLogs: ['[console.error] something broke'],
    failedRequests: [{ url: '/api/data', method: 'GET', status: 500 }],
  };

  expect(result.consoleLogs).toHaveLength(1);
  expect(result.failedRequests).toHaveLength(1);
});

// 测试 2：buildRepairEventDigest 提高上限
test('buildRepairEventDigest 保留更多事件', () => {
  const events = Array.from({ length: 50 }, (_, i) => ({
    timestamp: `2026-04-01T00:00:${i}`,
    level: 'step',
    message: `事件 ${i}`,
  }));

  const digest = buildRepairEventDigest(events);
  expect(digest.length).toBeGreaterThan(24); // 原限制为 24
  expect(digest.length).toBeLessThanOrEqual(100);
});
```

---

## 完成标准

### 功能验收

1. **Slot-based patching 工作正常**
   - 修复仅修改失败的 slot，其他步骤不变
   - 旧代码（无 slot 标记）自动降级到完整重新生成
   - slot patching 异常时自动降级
   - 生成的 patch 格式正确

2. **Repair memory 闭环**
   - 失败时自动记录到 repair memory
   - 修复时读取并使用 repair hints
   - 成功时更新 repair memory
   - 成功率达标后自动提升到知识库

3. **失败上下文增强**
   - 事件上限提高到 100（从 24）
   - 捕获浏览器控制台错误
   - 捕获失败的网络请求
   - 修复 prompt 包含所有上下文

### 代码质量验收

1. 所有新增单元测试通过
2. 现有测试不受影响（`npm test` 通过）
3. 无安全漏洞（敏感信息过滤）
4. 错误处理完善（所有新增逻辑用 try-catch 保护）

---

## 风险点与注意事项

| 风险 | 表现 | 缓解措施 |
|------|------|----------|
| LLM 生成的 slot patch 格式不正确 | 包含 `test()` 外层包装或 slot 标记 | `sanitizeIntentExecutionSlotCode()` 已实现自动清理 |
| slot 映射失败 | 无法匹配失败步骤到正确 slot | `resolveIntentExecutionPatchTargetSlotUids()` 会降级返回所有 slot |
| 旧代码无 slot 标记 | 走 slot patching 路径失败 | `hasIntentExecutionSlotMarkers()` 前置检查 + 降级 |
| repair memory 文件路径冲突 | 多项目共享同一文件 | `projectUid` 参数隔离 |
| 知识规则膨胀 | 自动提升导致规则过多 | 严格提升条件：成功率 >= 60%，次数 >= 3 |
| 上下文过大 | token 超限 | 事件上限 100 条，约 2000-5000 tokens |
| 敏感信息泄露 | 控制台日志含 token/密码 | 保存前过滤 Authorization header 等 |

---

## 代码修改清单

### 修改文件

| 文件 | 修改内容 | 行数估计 |
|------|----------|----------|
| `lib/services/test-plan-service.ts` | slot patching 分支 + repair memory hints 读取 | +80 行 |
| `lib/test-generator.ts` | 扩展 `RepairTestContext` + `buildRepairPrompt()` 增强 | +30 行 |
| `lib/ai/intent-e2e-service.ts` | 记录修复失败/成功 + 触发策略提升 | +60 行 |
| `lib/intent-project-knowledge.ts` | 新增 `promoteRepairStrategyToKnowledge()` | +50 行 |
| `lib/test-executor.ts` | 扩展 `TestResult` + 控制台/网络捕获 | +40 行 |

### 新增测试文件

| 文件 | 测试内容 |
|------|----------|
| `tests/unit/test-plan-service-slot-patch.spec.ts` | slot patching + 降级 |
| `tests/unit/intent-repair-memory-integration.spec.ts` | memory 闭环 + 策略提升 |
| `tests/unit/test-executor-context.spec.ts` | 增强上下文捕获 |

---

## 关键函数参考表

| 函数 | 文件:行号 | 用途 |
|------|-----------|------|
| `repairExecution()` | `lib/services/test-plan-service.ts:748` | 修复入口（主要修改点） |
| `repairTest()` | `lib/test-generator.ts:2838` | LLM 修复代码生成 |
| `buildRepairPrompt()` | `lib/test-generator.ts:2207` | 构建修复 prompt |
| `buildRepairEventDigest()` | `lib/services/test-plan-service.ts:532` | 事件摘要（提高上限） |
| `collectGeneratedCode()` | `lib/services/test-plan-service.ts:401` | 收集 LLM 流式输出 |
| `runIntentDrivenE2EStream()` | `lib/ai/intent-e2e-service.ts:1567` | E2E 执行主循环 |
| `hasIntentExecutionSlotMarkers()` | `lib/intent-execution-slot-patch.ts:126` | 检测 slot 标记 |
| `resolveIntentExecutionPatchTargetSlotUids()` | `lib/intent-execution-slot-patch.ts:148` | 定位失败 slot |
| `applyIntentExecutionSlotPatch()` | `lib/intent-execution-slot-patch.ts:404` | 应用 slot patch |
| `listRelevantIntentRepairHints()` | `lib/ai/intent-repair-memory.ts:394` | 读取修复提示 |
| `recordIntentRepairFailure()` | `lib/ai/intent-repair-memory.ts:307` | 记录修复失败 |
| `recordIntentRepairResolution()` | `lib/ai/intent-repair-memory.ts:359` | 记录修复成功 |
| `renderIntentRepairMemoryHints()` | `lib/ai/intent-repair-memory.ts:422` | 渲染 hints 到 prompt |
| `listIntentRepairMemoryClusters()` | `lib/ai/intent-repair-memory.ts:449` | 列出所有 cluster |
| `mergeIntentProjectKnowledgeRules()` | `lib/intent-project-knowledge.ts:1604` | 合并知识规则 |
| `getIntentProjectKnowledgeProfile()` | `lib/intent-project-knowledge.ts:1234` | 读取知识配置 |
| `executeTest()` | `lib/test-executor.ts:150` | Playwright 测试执行 |

---

## 实现顺序建议

```
Day 1-2: 任务 1（slot patching）
  → 1.1 修改 repairExecution() 分支逻辑
  → 1.2 扩展 RepairTestContext
  → 1.3 确保 repairTest() 内部利用 slot 信息
  → 1.4 测试

Day 3: 任务 2.1-2.2（repair memory 读写）
  → 2.1 读取 hints 并传递
  → 2.2 记录修复失败/成功

Day 4: 任务 2.3-2.4（策略提升）
  → 2.3 实现提升逻辑
  → 2.4 触发提升
  → 2.5 测试

Day 5: 任务 3（增强上下文）
  → 3.1 移除事件限制
  → 3.2 控制台/网络捕获
  → 3.3 修复 prompt 增强
  → 3.4 测试

Day 6: 集成测试 + 收尾
  → 端到端手动测试
  → 修复发现的问题
```
