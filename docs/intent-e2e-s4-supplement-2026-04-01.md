# S4 补充建议：top 5 family deterministic route（2026-04-01）

## 文档定位

本文档是对 `docs/intent-e2e-success-hardening-plan-2026-04-01.md` 中 S4 切片的补充建议，基于对以下源码的交叉分析：

- `lib/ai/intent-e2e-insights.ts`：`IntentE2EPriorityScenarioFamily` 分类器
- `lib/intent-recipe-registry.ts`：8 个 builtin recipe 及评分逻辑
- `lib/intent-action-library.ts`：13+ capability 定义及 implementationNotes
- `lib/ai/scenario-card.ts`：ScenarioCard 生成及 business.create 专属 sanitization
- `lib/intent-execution-compiler.ts`：slot 编译链路

## 1. Family 分类与覆盖缺口

代码中 **已存在** `IntentE2EPriorityScenarioFamily`（`intent-e2e-insights.ts:381-386`），但只有 4 个 tracked family：

| 已有 priority family | S4 计划的 5 个 family | 对应关系 |
|---|---|---|
| `business_create_list_verify` | 新建后回列表验收 | 直接对应 |
| `business_to_order` | — | S4 未列入，但代码已有分类器和 recipe |
| `list_search_detail` | 列表搜索并进入详情 | 直接对应 |
| `modal_or_drawer_save` | 弹层/抽屉编辑保存 | 直接对应 |
| — | 行操作菜单 | **缺少分类器** |
| — | 列表归属切换后回查 | **缺少分类器**（但已有 recipe `business.list-ownership-switch`） |

### 建议

- 补 `row_action_menu` 和 `list_ownership_switch` 两个 priority family 分类到 `classifyIntentE2EPriorityScenarioFamily()`。
- `business_to_order` 已有分类器和 recipe（`business.create-to-order`），虽然 S4 未列入，但代码基础最好，建议也纳入 S4 首轮验证。
- S4 首轮先做 **3 个有 recipe 基础的 family**（`business_create_list_verify`、`modal_or_drawer_save`、`list_search_detail`），再扩到行操作和归属切换。

## 2. Recipe 与 Family 映射关系不够明确

当前 recipe registry 8 个 recipe 靠 `scoreIntentRecipe()`（`intent-recipe-registry.ts:413-467`）做关键词打分匹配，但 **recipe 没有 family 字段**。recipe 和 family 之间是隐式映射：

| Recipe | 隐式对应 family |
|---|---|
| `business.create` | business_create_list_verify |
| `business.create-to-order` | business_to_order |
| `ui.antd-modal-drawer-save` | modal_or_drawer_save |
| `assert.antd-table-primary-key-search` | list_search_detail |
| `business.list-ownership-switch` | list_ownership_switch（分类器还没有） |
| `auth.unified-login` | 跨 family 通用 |
| `business.batch-add-contacts` | untracked |
| `commission.service-ratio-config` | untracked |

### 建议

- 给每个 recipe 显式添加 `family?: IntentE2EPriorityScenarioFamily` 字段。
- 当 `classifyIntentE2EPriorityScenarioFamily()` 识别出 family 后，`selectIntentRecipeRegistry()` 优先命中同 family 的 recipe，分数加权 +5（高于当前最高的 auth +4）。
- 把 family 分类和 recipe 选择从"各自独立打分"变成"分类驱动优先命中"。

## 3. Action Library 缺少 Family 级编排

`intent-action-library.ts` 中的 capability 实现已经非常详尽（`resolve-primary-record` 有 20+ 条 implementationNotes），但当前是 **逐个 capability 独立选取**（`selectIntentActionLibrary()`）。S4 需要的是 **family 级的 capability 组合模板**。

### 建议

为每个 tracked family 定义 `familyCapabilityProfile`：

```ts
const FAMILY_CAPABILITY_PROFILES: Record<TrackedFamily, {
  requiredCapabilities: string[];   // 必须选入
  preferredOrder: string[];         // 推荐执行顺序
  forbiddenCapabilities: string[];  // 明确排除
  compilerHints: string[];          // 传给 compiler 的额外指令
}> = {
  business_create_list_verify: {
    requiredCapabilities: [
      'auth.login-with-env-credentials',
      'assert.watch-submit-state',
      'assert.resolve-primary-record',
    ],
    preferredOrder: ['login', 'navigate', 'fill', 'submit', 'waitSubmit', 'switchView', 'resolve'],
    forbiddenCapabilities: ['extract.capture-shared-variable'],
    compilerHints: ['必须用 resolve-primary-record 回列表验证，不要只检查 toast'],
  },
  modal_or_drawer_save: {
    requiredCapabilities: [
      'auth.login-with-env-credentials',
      'ui.wait-for-visible-antd-modal',
      'assert.watch-submit-state',
    ],
    preferredOrder: ['login', 'navigate', 'openModal', 'fill', 'submit', 'waitSubmit', 'verifyClose'],
    forbiddenCapabilities: [],
    compilerHints: ['保存后必须验证弹层/抽屉关闭，不能只检查 toast'],
  },
  list_search_detail: {
    requiredCapabilities: [
      'auth.login-with-env-credentials',
      'ui.find-antd-table-row',
      'assert.read-detail-field',
    ],
    preferredOrder: ['login', 'navigate', 'search', 'findRow', 'clickRow', 'readDetail'],
    forbiddenCapabilities: ['assert.watch-submit-state'],
    compilerHints: ['搜索后必须等待表格刷新再定位行，不要直接 click'],
  },
  // row_action_menu, list_ownership_switch 同理
};
```

`selectIntentActionLibrary()` 在识别到 family 后，先查 profile 强制注入 requiredCapabilities，再叠加 ScenarioCard 推断的额外 capabilities。

## 4. ScenarioCard 只有 business.create 有 Sanitization

当前 `scenario-card.ts` 有大量 `business.create` 专属硬逻辑：

- `looksLikeBusinessCreateScenarioCard()` 检测
- 列表入口 step 自动重写
- success criteria 清洗（删除过于精确的文案匹配）

但其他 family **没有等价的 sanitization**。

### 建议

- 把 `looksLikeBusinessCreateScenarioCard()` 的模式抽象为 `familyAwareScenarioCardSanitizer(card, family)`。
- 为每个 tracked family 定义：

| Family | step 校验规则 | success criteria 约束 | step 重写钩子 |
|---|---|---|---|
| `business_create_list_verify` | 已有 | 已有 | 已有 |
| `modal_or_drawer_save` | 必须有 open modal/drawer step + save step | 必须包含弹层关闭验证 | 若缺少 waitForModalClose 则自动补 |
| `list_search_detail` | 必须有 search step + detail entry step | 不应包含写操作断言 | 若搜索关键词为硬编码则标记 needs_clarify |
| `row_action_menu` | 必须有 find row + click action step | 操作结果验证（状态变更/toast/行消失） | 若未指定哪行则标记 needs_clarify |
| `list_ownership_switch` | 必须有 switch view step + verify row step | 切换后列表内容变更验证 | 自动注入 ownership view 切换逻辑 |

## 5. 图片信号进入 Family 路由的具体路径

S4 提到"图片信号进入 family 路由"，但没给实现路径。当前图片只进了 ScenarioCard 的 `visualAnchors`。

### 建议分两步做

**Step 1（低成本）**：图片辅助 family 确认

- 在 `classifyIntentE2EPriorityScenarioFamily()` 的输入中加 `visualAnchors?: string[]`。
- 用简单规则提取页面类型信号：截图中有"新建"按钮 → 可能是 create flow、有表格 → 可能是 list flow。
- 不需要新的 vision 调用，只需要利用 ScenarioCard 已经提取的 visualAnchors 描述文本。

**Step 2（中等成本）**：图片降低 family 误分类

- 当文本分类为 `untracked` 但 visualAnchors 包含强信号时（如 "modal visible"、"table with search bar"），升级为对应 family。
- 当文本分类与 visualAnchors 矛盾时（如文本说是 create 但图片是列表页），标记 `needs_clarify`。

## 6. 缺少的两个 Family 的 Recipe 需要新建

S4 的 5 个 family 中，"行操作菜单"缺少 recipe。"列表归属切换"已有 recipe `business.list-ownership-switch`，但缺少 family 分类器。

### 行操作菜单 recipe 建议骨架

```ts
{
  slug: 'ui.antd-table-row-action',
  title: '表格行操作菜单',
  description: '在列表中定位目标行，点击行内操作按钮或展开更多菜单执行操作，验证操作结果。',
  matchers: {
    urlIncludes: ['/list', '/table'],
    summaryIncludes: ['行操作', '操作菜单', '更多操作', '删除', '编辑', '启用', '禁用'],
    actionsIncludes: ['ui.find-antd-table-row', 'ui.click-antd-row-action'],
  },
  stableIdentifier: true,
  helpers: ['findRowByText', 'clickRowAction', 'waitForActionResult'],
  capabilities: ['ui.find-antd-table-row', 'ui.click-antd-row-action'],
}
```

### 列表归属切换

已有 recipe `business.list-ownership-switch`，只需补 family 分类器中的匹配规则：

```ts
// classifyIntentE2EPriorityScenarioFamily 中追加
const hasOwnershipSwitch = /(我创建的|全部商机|归属|ownership|切换视图|view.*switch)/i.test(haystack);
const hasListVerify = /(列表|表格|table|list)/i.test(haystack);
if (hasOwnershipSwitch && hasListVerify) {
  return 'list_ownership_switch';
}
```

## 7. 建议 S4 拆成 3 个子切片

S4 在原计划中排为一整刀，但实际改动范围横跨分类器、recipe、action library、ScenarioCard sanitizer、compiler hints 五层。建议拆成：

### S4a：family 分类器补全 + recipe family 字段 + recipe family 加权

- 补 `row_action_menu`、`list_ownership_switch` 两个 priority family 分类器
- 给每个 recipe 加 `family` 字段
- `selectIntentRecipeRegistry()` 命中同 family recipe 时加权 +5
- **涉及文件**：`lib/ai/intent-e2e-insights.ts`、`lib/intent-recipe-registry.ts`
- **验证**：分类准确率 + recipe 命中率

### S4b：family capability profile + ScenarioCard family-aware sanitizer

- 定义各 family 的 `requiredCapabilities / preferredOrder / forbiddenCapabilities / compilerHints`
- 为 `modal_or_drawer_save`、`list_search_detail` 补 ScenarioCard sanitization 规则
- compiler 注入 family-level hints
- **涉及文件**：`lib/intent-action-library.ts`、`lib/ai/scenario-card.ts`、`lib/intent-execution-compiler.ts`
- **验证**：per-family first_pass_rate 对比

### S4c：图片信号路由 + 新增行操作 recipe

- `classifyIntentE2EPriorityScenarioFamily()` 入参加 `visualAnchors`
- 新增 `ui.antd-table-row-action` recipe
- **涉及文件**：`lib/ai/intent-e2e-insights.ts`、`lib/intent-recipe-registry.ts`
- **验证**：untracked 误分类率下降

每个子切片可独立验证 first_pass_rate 提升，不需要等全部做完才能度量。

## 8. 度量口径建议

S4 应按 family 粒度度量，而非全局。系统已有 `IntentE2EInsightPriorityScenarioStat`（`intent-e2e-insights.ts:388-395`），每个 family 有 `totalRuns / passedRuns / failedRuns / firstPassPassRate / terminalPassRate`，S4 验证可以直接复用这套统计。

建议度量模板：

```
per_family_first_pass_rate:
  business_create_list_verify: X%
  list_search_detail: X%
  modal_or_drawer_save: X%
  row_action_menu: X%
  list_ownership_switch: X%
  untracked: X%（对比参照）

family_classification_accuracy:
  正确分类率: X%
  误分类到 untracked 率: X%

recipe_hit_rate:
  family 命中同类 recipe 率: X%
  family 命中但 recipe 不匹配率: X%
```

不需要额外埋点，直接复用现有 insights 统计出口。
