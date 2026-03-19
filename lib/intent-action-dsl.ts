export type IntentActionStepType = 'ui' | 'api' | 'assert' | 'extract' | 'cleanup';

export interface IntentActionStepInput {
  stepUid: string;
  stepType: IntentActionStepType;
  title: string;
  target: string;
  instruction: string;
  expectedResult: string;
  extractVariable: string;
}

export interface IntentActionDSLStep {
  stepUid: string;
  stepType: IntentActionStepType;
  title: string;
  target: string;
  goal: string;
  allowedActions: string[];
  preferredHelpers: string[];
  requiredAssertions: string[];
  sharedVariables: string[];
  forbiddenPatterns: string[];
}

export interface IntentActionDSL {
  version: 1;
  mode: 'page' | 'scenario';
  targetUrl: string;
  summary: string;
  globalRules: string[];
  preferredPrimitives: string[];
  outputContract: string[];
  steps: IntentActionDSLStep[];
}

export interface BuildIntentActionDSLInput {
  taskMode?: 'page' | 'scenario';
  targetUrl?: string;
  featureDescription?: string;
  expectedOutcome?: string;
  successCriteria?: string[];
  sharedVariables?: string[];
  cleanupNotes?: string;
  steps?: IntentActionStepInput[];
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

function buildSyntheticStep(input: BuildIntentActionDSLInput): IntentActionStepInput {
  return {
    stepUid: 'dsl_step_1',
    stepType: 'ui',
    title: input.taskMode === 'scenario' ? '完成业务主链路' : '完成页面主验证',
    target: input.targetUrl?.trim() || '',
    instruction: input.featureDescription?.trim() || '根据用户目标完成关键页面操作',
    expectedResult: input.expectedOutcome?.trim() || input.successCriteria?.join('；') || '看到目标结果',
    extractVariable: '',
  };
}

function buildHaystack(step: IntentActionStepInput, input: BuildIntentActionDSLInput): string {
  return [
    step.title,
    step.target,
    step.instruction,
    step.expectedResult,
    step.extractVariable,
    input.featureDescription || '',
    input.expectedOutcome || '',
    ...(input.successCriteria || []),
  ]
    .join('\n')
    .toLowerCase();
}

function needsDropdownHelper(text: string): boolean {
  return /(下拉|枚举|选项|tree|treeselect|select|cascader|来源|性别|渠道|企业名称|归属|类型)/i.test(text);
}

function needsRowActionHelper(text: string): boolean {
  return /(列表|表格|行操作|三点|更多|生成订单|查看|详情|菜单)/i.test(text);
}

function needsResponseAssertion(text: string): boolean {
  return /(接口|api|response|请求|200|201|post|patch|delete|创建订单|createorder)/i.test(text);
}

function needsUrlAssertion(text: string): boolean {
  return /(url|路由|跳转|成功页|详情页|列表页|drawer|modal|页面)/i.test(text);
}

function needsExtraction(text: string, step: IntentActionStepInput): boolean {
  return Boolean(step.extractVariable) || /(提取|记录|读取|保存.*变量|capture|extract|编号|id|手机号|订单号)/i.test(text);
}

function buildAllowedActions(step: IntentActionStepInput, input: BuildIntentActionDSLInput): string[] {
  const haystack = buildHaystack(step, input);
  const baseActions =
    step.stepType === 'api'
      ? ['wait_for_response', 'assert_response_ok', 'assert_payload']
      : step.stepType === 'assert'
      ? ['scope', 'locate', 'assert_visible', 'assert_text', 'assert_url', 'assert_state']
      : step.stepType === 'extract'
      ? ['scope', 'locate', 'extract_text', 'store_variable', 'assert_variable']
      : step.stepType === 'cleanup'
      ? ['navigate', 'scope', 'locate', 'click', 'wait_for_ui', 'assert_removed']
      : ['navigate', 'scope', 'locate', 'fill', 'click', 'press', 'wait_for_ui', 'assert_visible', 'assert_text'];

  return uniqueStrings([
    ...baseActions,
    needsDropdownHelper(haystack) ? 'open_dropdown' : null,
    needsDropdownHelper(haystack) ? 'select_option' : null,
    needsRowActionHelper(haystack) ? 'find_table_row' : null,
    needsRowActionHelper(haystack) ? 'click_row_action' : null,
    needsResponseAssertion(haystack) ? 'wait_for_response' : null,
    needsResponseAssertion(haystack) ? 'assert_response_ok' : null,
    needsUrlAssertion(haystack) ? 'wait_for_url' : null,
    needsUrlAssertion(haystack) ? 'assert_url' : null,
    needsExtraction(haystack, step) ? 'extract_text' : null,
    needsExtraction(haystack, step) ? 'store_variable' : null,
  ]);
}

function buildPreferredHelpers(step: IntentActionStepInput, input: BuildIntentActionDSLInput): string[] {
  const haystack = buildHaystack(step, input);

  return uniqueStrings([
    needsDropdownHelper(haystack) ? '__e2e.openAntdDropdown' : null,
    needsDropdownHelper(haystack) ? '__e2e.selectAntdOption' : null,
    needsRowActionHelper(haystack) ? '__e2e.clickAntdRowAction' : null,
  ]);
}

function buildRequiredAssertions(step: IntentActionStepInput, input: BuildIntentActionDSLInput): string[] {
  return uniqueStrings([
    step.expectedResult,
    step.extractVariable ? `必须提取并保存变量 ${step.extractVariable}` : null,
    ...((input.successCriteria || []).slice(0, 3)),
  ]);
}

function buildForbiddenPatterns(step: IntentActionStepInput, input: BuildIntentActionDSLInput): string[] {
  const haystack = buildHaystack(step, input);

  return uniqueStrings([
    'page.waitForTimeout(...) 作为主同步手段',
    needsDropdownHelper(haystack) ? "全局 page.getByText('枚举值').click() 不做作用域收窄" : null,
    needsRowActionHelper(haystack) ? '不先定位目标行就直接点击“查看/生成订单/更多”' : null,
    needsExtraction(haystack, step) ? '编造共享变量或用随机值替代真实提取结果' : null,
    step.stepType === 'assert' || needsResponseAssertion(haystack) ? '把核心断言弱化成 toBeTruthy()/非空即可' : null,
    step.stepType === 'cleanup' ? '省略 cleanup 步骤或直接删除清理断言' : null,
  ]);
}

export function buildIntentActionDSL(input: BuildIntentActionDSLInput): IntentActionDSL {
  const rawSteps = input.steps && input.steps.length > 0 ? input.steps : [buildSyntheticStep(input)];
  const steps = rawSteps.map((step) => ({
    stepUid: step.stepUid,
    stepType: step.stepType,
    title: step.title || '未命名步骤',
    target: step.target || input.targetUrl?.trim() || '',
    goal: step.instruction || step.expectedResult || input.featureDescription || '完成当前步骤',
    allowedActions: buildAllowedActions(step, input),
    preferredHelpers: buildPreferredHelpers(step, input),
    requiredAssertions: buildRequiredAssertions(step, input),
    sharedVariables: uniqueStrings([step.extractVariable, ...(input.sharedVariables || [])]),
    forbiddenPatterns: buildForbiddenPatterns(step, input),
  }));

  const anyDropdownStep = steps.some((step) => step.preferredHelpers.includes('__e2e.selectAntdOption'));
  const anyRowActionStep = steps.some((step) => step.preferredHelpers.includes('__e2e.clickAntdRowAction'));
  const anyResponseStep = steps.some((step) => step.allowedActions.includes('wait_for_response'));
  const anyExtractStep = steps.some((step) => step.allowedActions.includes('store_variable'));

  return {
    version: 1,
    mode: input.taskMode === 'scenario' ? 'scenario' : 'page',
    targetUrl: input.targetUrl?.trim() || '',
    summary: input.featureDescription?.trim() || input.expectedOutcome?.trim() || '完成用户要求的核心验证',
    globalRules: uniqueStrings([
      '严格按 DSL 步骤顺序实现，不删减业务步骤，也不要私自新增与目标无关的大绕路。',
      '优先使用页面快照里已经暴露的 id / label / placeholder / role / iframe selector / visible container。',
      '所有等待都要绑定到可观察条件：元素可见、URL 变化、接口响应、loading 消失、Drawer/Modal 状态变化。',
      (input.sharedVariables || []).length > 0 ? `共享变量只能来自真实页面/API 提取：${input.sharedVariables?.join(', ')}` : null,
      input.expectedOutcome ? `最终业务结果必须显式校验：${input.expectedOutcome}` : null,
      input.cleanupNotes ? `如果进入 cleanup，必须执行并保留清理意图：${input.cleanupNotes}` : null,
      anyDropdownStep ? '涉及 Ant Design 下拉/树选择时，优先使用 __e2e.openAntdDropdown / __e2e.selectAntdOption。' : null,
      anyRowActionStep ? '涉及列表行末操作菜单时，优先使用 __e2e.clickAntdRowAction，而不是臆造行内按钮。' : null,
      anyResponseStep ? '关键提交步骤优先等待接口成功响应，再做 UI 成功断言，避免只看模糊成功文案。' : null,
      anyExtractStep ? 'extract 步骤必须把变量命名、提取来源和后续使用位置写清楚。' : null,
    ]),
    preferredPrimitives: uniqueStrings([
      'navigate(url): 进入入口页或下一跳页面',
      'scope(container): 先把定位范围收窄到 form-item / modal / row / frame / visible dropdown',
      'locate(selector): 基于精确字段元数据定位目标控件',
      'fill(field, value): 填写输入框/文本域',
      'click(target): 点击按钮、链接或主动作入口',
      anyDropdownStep ? 'select_option(field, label, searchText?): 通过 helper 稳定选择下拉/树节点枚举值' : null,
      anyRowActionStep ? 'click_row_action(row, label): 在目标表格行内点击查看/生成订单等动作' : null,
      anyResponseStep ? 'wait_for_response(matcher): 等待关键接口成功返回' : null,
      'assert_visible/assert_text/assert_url: 用显式断言收尾',
      anyExtractStep ? 'extract_text(target, variable): 从真实 UI/响应里提取共享变量并复用' : null,
    ]),
    outputContract: uniqueStrings([
      '输出代码时保持 DSL 步骤顺序，先实现动作，再紧跟同一步骤的显式断言。',
      '不要把多个 DSL 步骤糅成一个不可诊断的大块 try/catch。',
      '不要为了通过而删除核心断言、接口等待或变量提取步骤。',
    ]),
    steps,
  };
}

export function renderIntentActionDSL(dsl: IntentActionDSL): string {
  const lines: string[] = [
    '## 执行动作约束 DSL',
    `- 版本: ${dsl.version}`,
    `- 模式: ${dsl.mode === 'scenario' ? '业务流任务' : '单页面任务'}`,
    `- 目标入口: ${dsl.targetUrl || '未提供'}`,
    `- 摘要: ${dsl.summary}`,
    '',
    '全局规则：',
    ...dsl.globalRules.map((item, index) => `${index + 1}. ${item}`),
    '',
    '推荐原语：',
    ...dsl.preferredPrimitives.map((item, index) => `${index + 1}. ${item}`),
  ];

  dsl.steps.forEach((step, index) => {
    lines.push(
      '',
      `### DSL Step ${index + 1} [${step.stepType}] ${step.title}`,
      `- 目标: ${step.target || dsl.targetUrl || '未提供'}`,
      `- 意图: ${step.goal || '未提供'}`,
      `- 允许动作: ${step.allowedActions.join(' | ')}`,
      `- 优先 helper: ${step.preferredHelpers.length > 0 ? step.preferredHelpers.join(' | ') : '无'}`,
      `- 必须断言: ${step.requiredAssertions.length > 0 ? step.requiredAssertions.join('；') : '沿用步骤 expectedResult'}`,
      `- 共享变量: ${step.sharedVariables.length > 0 ? step.sharedVariables.join(', ') : '无'}`,
      `- 禁止模式: ${step.forbiddenPatterns.join('；')}`
    );
  });

  lines.push('', '输出契约：', ...dsl.outputContract.map((item, index) => `${index + 1}. ${item}`));
  return lines.join('\n');
}
