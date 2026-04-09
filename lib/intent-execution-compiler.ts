import type { AuthConfig } from './page-analyzer';
import type { IntentE2EPriorityScenarioFamily } from './intent-e2e-priority-scenario-family';
import { buildIntentSharedVariableJsonPaths, looksLikeIntentStableIdentifierVariable } from './intent-shared-variable-utils';
import type {
  IntentExecutionPlan,
  IntentExecutionPlanStep,
  IntentVerificationPlan,
  IntentVerificationPlanCheck,
  IntentVerificationFieldSpec,
  IntentVerificationLocatorHintSpec,
} from './intent-execution-plan';

export type IntentExecutionTemplateSlotKind = 'plan_step' | 'verification';

export interface IntentExecutionTemplateSlot {
  slotUid: string;
  kind: IntentExecutionTemplateSlotKind;
  title: string;
  planStepUid?: string;
  relatedCheckUids: string[];
  preferredHelpers: string[];
  instructions: string[];
}

export interface IntentCompiledExecutionTemplate {
  version: 1;
  compiler: IntentExecutionPlan['compiler'];
  testTitle: string;
  entryUrl: string;
  sharedVariables: string[];
  slots: IntentExecutionTemplateSlot[];
  code: string;
}

export interface CompileIntentExecutionTemplateInput {
  executionPlan: IntentExecutionPlan;
  verificationPlan?: IntentVerificationPlan;
  auth?: AuthConfig;
  description?: string;
  priorityScenarioFamily?: IntentE2EPriorityScenarioFamily;
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

function normalizeText(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function escapeForRegExp(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeTestTitle(value: string): string {
  const normalized = normalizeText(value);
  if (!normalized) return 'intent-e2e-structured-flow';
  return normalized.slice(0, 80);
}

function isValidJsIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}

function toSharedAccessor(variable: string): string {
  const normalized = normalizeText(variable);
  if (!normalized) return 'shared';
  return isValidJsIdentifier(normalized) ? `shared.${normalized}` : `shared[${JSON.stringify(normalized)}]`;
}

function toArtifactsAccessor(planStepUid: string): string {
  return `artifacts[${JSON.stringify(planStepUid)}]`;
}

function renderCommentLines(lines: string[], indent = '    '): string[] {
  return lines.filter(Boolean).map((line) => `${indent}// ${line}`);
}

function renderJsStringArray(items: string[]): string {
  return `[${items.map((item) => JSON.stringify(item)).join(', ')}]`;
}

function buildIntentExecutionStepHaystack(step: IntentExecutionPlanStep): string {
  return [step.title, step.goal, step.target, ...step.requiredAssertions].join('\n');
}

function isBusinessListPageReadyStep(step: IntentExecutionPlanStep): boolean {
  const haystack = buildIntentExecutionStepHaystack(step);
  if (!/(商机列表|businesslist)/i.test(haystack)) return false;
  if (!/(页面就绪|页面主区域|列表加载|确认页面|确认页面就绪|进入商机列表页并确认|打开商机列表页|列表页并确认)/i.test(haystack)) {
    return false;
  }

  return /(我创建的|我跟进的|归属|范围|新建商机)/i.test(haystack);
}

function isBusinessCreateFormReadyStep(step: IntentExecutionPlanStep): boolean {
  const haystack = buildIntentExecutionStepHaystack(step);
  if (!/(新建商机|创建商机|createbusiness)/i.test(haystack)) return false;
  if (
    !/(进入新建商机页|进入创建页|等待创建表单页面加载|等待创建表单|创建表单页面加载|创建流程锚点|第一页|创建页加载)/i.test(
      haystack
    )
  ) {
    return false;
  }

  return /(商机联系人信息|商机来源|关联产品意向信息|附件信息|新建商机按钮)/i.test(haystack);
}

function isBusinessCreateFinalSubmitStep(step: IntentExecutionPlanStep): boolean {
  const haystack = buildIntentExecutionStepHaystack(step);
  if (!/(新建商机|创建商机|createbusiness)/i.test(haystack)) return false;
  if (
    !step.preferredHelpers.includes('__e2e.observeSubmitState') &&
    !/(提交保存|点击提交|最终提交|提交并保存|保存商机|完成保存)/i.test(haystack)
  ) {
    return false;
  }

  return /(附件信息|上传录音文件|上传图片|businessId|列表|提交|保存)/i.test(haystack);
}

function buildBusinessListPageReadyGoal(): string {
  return '进入商机列表页并确认列表主区域 ready；以“新建商机”按钮、可见搜索框或列表容器作为稳定锚点，不要在页面 ready 阶段对整页 `getByText(\'我创建的\')` 写可见性断言。';
}

function buildBusinessListPageReadyRequiredAssertions(): string[] {
  return ['当前 URL 包含 #/business/businesslist，且列表主区域 ready（“新建商机”按钮、可见搜索框或列表容器至少一种出现）。'];
}

function buildBusinessCreateFormReadyGoal(): string {
  return '点击“新建商机”后确认已进入创建页第一页 ready；优先用单一可见锚点顺序确认，如 `page.getByRole(\'heading\', { name: \'商机联系人信息\' }).first()`、`page.locator(\'label[title="商机来源"]\').first()` 或第一页联系人/手机号字段，不要把多个 locator 用 `.or()` 合成一条 expect。';
}

function buildBusinessCreateFormReadyRequiredAssertions(): string[] {
  return ['当前 URL 已进入 #/business/createbusiness，且第一页 ready（`商机联系人信息` heading、`商机来源` label、联系人/手机号字段至少一种稳定出现）。'];
}

function buildBusinessCreateFinalSubmitGoal(): string {
  return '确认已进入创建商机最后一步并触发最终提交；先用 `附件信息 / 上传录音文件 / 上传图片` 这些末页锚点确认当前确实在附件页，再只在 scoped candidate containers 内查找最终 `保存 / 提交 / 确定` 主动作。candidate containers 至少覆盖 `attachmentAnchor` 的近邻祖先链和可见 footer/action-bar 容器，不要退化成整页 regex + `.last()`。';
}

function buildBusinessCreateFinalSubmitRequiredAssertions(): string[] {
  return ['当前页面已进入附件/末页锚点，且最终提交按钮只在 scoped candidate containers 内被命中；candidate containers 至少包含 `attachmentAnchor` 祖先链或可见 footer/action-bar 容器；点击后提交响应或提交后状态开始收敛。'];
}

function buildPriorityScenarioFamilyStepHints(
  step: IntentExecutionPlanStep,
  priorityScenarioFamily?: IntentE2EPriorityScenarioFamily
): string[] {
  if (!priorityScenarioFamily || priorityScenarioFamily === 'untracked') return [];

  switch (priorityScenarioFamily) {
    case 'business_create_list_verify':
      return step.preferredHelpers.includes('__e2e.observeSubmitState') ||
        step.preferredHelpers.includes('__e2e.resolvePrimaryRecord') ||
        step.preferredHelpers.includes('__e2e.switchBusinessListOwnershipView')
        ? [
            '当前 family = business_create_list_verify：最终成功以“提交收敛 + 列表/详情命中目标记录”为主，不要把 toast / URL 变化当最终通过。',
            '当前 family = business_create_list_verify：若本步负责切“我创建的 / 我跟进的”，只收口成切视角 + 列表 ready；唯一一次检索留给后续 __e2e.resolvePrimaryRecord(...)。',
            '当前 family = business_create_list_verify：如果目标 row 已命中、结构化列表响应也已返回，但 businessId 仍为空，不要直接报“列表响应未返回状态”；先用 rowKey / rowText 派生 derivedBusinessId，再回填 matchedRecordByDerivedBusinessId。',
          ]
        : [];
    case 'modal_or_drawer_save':
      return step.preferredHelpers.includes('__e2e.waitForVisibleAntdModal') ||
        step.preferredHelpers.includes('__e2e.observeSubmitState')
        ? [
            '当前 family = modal_or_drawer_save：所有填写和点击保存都先 scope 到当前可见 modal / drawer，再继续操作。',
            '当前 family = modal_or_drawer_save：保存后至少确认当前弹层/抽屉关闭或页面回到稳定态，不要只看 toast。',
          ]
        : [];
    case 'list_search_detail':
      return step.preferredHelpers.includes('__e2e.findAntdTableRow') ||
        step.preferredHelpers.includes('__e2e.resolvePrimaryRecord') ||
        step.preferredHelpers.includes('__e2e.readDetailField')
        ? [
            '当前 family = list_search_detail：搜索后先等待表格刷新，再定位目标行；不要搜索后直接点击第一行或第一条“查看”。',
            '当前 family = list_search_detail：进入详情后优先按字段标签读取联系人/手机号/状态，不要对整页文本做大段 toContain。',
          ]
        : [];
    default:
      return [];
  }
}

function buildPriorityScenarioFamilyVerificationHints(
  priorityScenarioFamily?: IntentE2EPriorityScenarioFamily
): string[] {
  if (!priorityScenarioFamily || priorityScenarioFamily === 'untracked') return [];

  switch (priorityScenarioFamily) {
    case 'business_create_list_verify':
      return [
        '当前 family = business_create_list_verify：最终验收优先复用列表响应 / 详情字段完成状态证据，不要求状态必须出现在同一行可见文本。',
      ];
    case 'modal_or_drawer_save':
      return [
        '当前 family = modal_or_drawer_save：最终验收至少覆盖弹层/抽屉关闭或页面回到稳定态，不要只把 toast 当最终成功。',
      ];
    case 'list_search_detail':
      return [
        '当前 family = list_search_detail：最终验收以“命中目标行 -> 进入对应详情 -> 按字段标签读值”为主，不要只验列表返回结果。',
      ];
    default:
      return [];
  }
}

function buildVerificationArtifactReuseHints(
  plan: IntentExecutionPlan,
  verificationPlan?: IntentVerificationPlan
): string[] {
  if (!verificationPlan?.checks.length) return [];

  const stepByUid = new Map(plan.steps.map((step) => [step.planStepUid, step]));
  const artifactReuseAccessors = uniqueStrings(
    verificationPlan.checks
      .flatMap((check) => check.relatedPlanStepUids || [])
      .map((uid) => stepByUid.get(uid))
      .filter((step): step is IntentExecutionPlanStep => Boolean(step))
      .filter(
        (step) =>
          step.preferredHelpers.includes('__e2e.resolvePrimaryRecord') ||
          step.preferredHelpers.includes('__e2e.findAntdTableRow') ||
          step.preferredHelpers.includes('__e2e.readDetailField')
      )
      .map((step) => toArtifactsAccessor(step.planStepUid))
  );

  if (artifactReuseAccessors.length === 0) return [];

  return [
    `若 ${artifactReuseAccessors.join(' / ')} 已写入 recordCheck / status / source 等定位证据，最终验收先直接复用这些 artifacts；只有这些 artifacts 缺少状态证据，或当前页面已离开原列表/详情上下文时，才补一次 __e2e.resolvePrimaryRecord(...) / __e2e.readDetailField(...)。`,
  ];
}

function buildDefaultJsonRecordCollectionPaths(): string[] {
  return [
    'data.list',
    'data.rows',
    'data.records',
    'data.items',
    'data.content',
    'data.data.list',
    'data.data.rows',
    'data.data.records',
    'data.data.items',
    'result.list',
    'result.rows',
    'result.records',
    'result.items',
    'result.content',
    'list',
    'rows',
    'records',
    'items',
    'content',
  ];
}

function buildGenericStatusJsonPaths(): string[] {
  return ['status', 'statusName', 'statusText', 'state', 'stateName', 'stateText', 'displayStatus', 'progress.displayStatus'];
}

function buildSharedVariables(plan: IntentExecutionPlan): string[] {
  return uniqueStrings([
    ...plan.sharedVariables,
    ...plan.steps.map((step) => step.extractVariable),
    ...plan.steps.flatMap((step) => step.sharedVariables),
  ]);
}

function toSafeIdentifier(value: string, fallback: string): string {
  const normalized = String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9_$]+/g, '_')
    .replace(/^(\d)/, '_$1')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized && isValidJsIdentifier(normalized) ? normalized : fallback;
}

function collectRelatedSharedVariables(steps: IntentExecutionPlanStep[]): string[] {
  return uniqueStrings(steps.flatMap((step) => [step.extractVariable, ...step.sharedVariables]));
}

function normalizeIntentToken(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9\u4e00-\u9fa5]+/g, '')
    .toLowerCase();
}

function isIdentifierLikeToken(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(String(value || '').trim());
}

function pickRelatedSharedVariable(steps: IntentExecutionPlanStep[]): string {
  const candidates = collectRelatedSharedVariables(steps);
  return candidates.find((variable) => looksLikeIntentStableIdentifierVariable(variable)) || candidates[0] || '';
}

function pickCheckStableIdentifier(check: IntentVerificationPlanCheck, relatedSteps: IntentExecutionPlanStep[]): string {
  const structuredCandidates = uniqueStrings(check.stableIdentifiers || []);
  return structuredCandidates.find((variable) => looksLikeIntentStableIdentifierVariable(variable)) || pickRelatedSharedVariable(relatedSteps);
}

function shouldPreferResolvePrimaryRecord(
  check: IntentVerificationPlanCheck,
  relatedSteps: IntentExecutionPlanStep[],
  sharedVariable: string
): boolean {
  if (!sharedVariable) return false;
  if (looksLikeIntentStableIdentifierVariable(sharedVariable)) return true;
  if (check.preferredHelpers.includes('__e2e.resolvePrimaryRecord')) return true;
  if (relatedSteps.some((step) => step.preferredHelpers.includes('__e2e.resolvePrimaryRecord'))) return true;
  return Boolean(check.recordLookup);
}

function pickCheckFieldSpec(check: IntentVerificationPlanCheck, label: string): IntentVerificationFieldSpec | null {
  const normalizedLabel = normalizeIntentToken(label);
  if (!normalizedLabel) return null;

  return (
    (check.fieldSpecs || []).find((spec) => {
      const normalizedSpecLabel = normalizeIntentToken(spec.label);
      return (
        normalizedSpecLabel &&
        (normalizedSpecLabel === normalizedLabel ||
          normalizedSpecLabel.includes(normalizedLabel) ||
          normalizedLabel.includes(normalizedSpecLabel))
      );
    }) || null
  );
}

function pickCheckFieldPathHints(check: IntentVerificationPlanCheck, label: string): string[] {
  const normalizedLabel = normalizeIntentToken(label);
  if (!normalizedLabel) return [];

  return uniqueStrings(
    (check.fieldPathHints || [])
      .filter((hint) => {
        const normalizedHintLabel = normalizeIntentToken(hint.label);
        return (
          normalizedHintLabel &&
          (normalizedHintLabel === normalizedLabel ||
            normalizedHintLabel.includes(normalizedLabel) ||
            normalizedLabel.includes(normalizedHintLabel))
        );
      })
      .flatMap((hint) => hint.paths || [])
  );
}

function pickCheckPreferredPaths(check: IntentVerificationPlanCheck, label: string): string[] {
  const fieldSpec = pickCheckFieldSpec(check, label);
  return uniqueStrings([...(fieldSpec?.preferredPaths || []), ...pickCheckFieldPathHints(check, label)]);
}

function pickFieldSpecTitleIncludes(fieldSpec: IntentVerificationFieldSpec | null): string {
  const titleCandidates = uniqueStrings(
    (fieldSpec?.scopeHints || []).filter((hint) => !/^(详情页|详情抽屉|详情弹层|抽屉|弹层)$/i.test(String(hint || '').trim()))
  );
  return titleCandidates[0] || '';
}

function renderCheckFieldPathHints(check: IntentVerificationPlanCheck): string {
  return uniqueStrings(
    (check.fieldPathHints || []).map((hint) => `${hint.label}: ${(hint.paths || []).join(' / ')}`)
  ).join('；');
}

function renderCheckFieldSpecs(check: IntentVerificationPlanCheck): string {
  return uniqueStrings(
    (check.fieldSpecs || []).map((spec) => {
      const parts = [
        spec.expectedSource ? `source=${spec.expectedSource}` : '',
        (spec.preferredPaths || []).length > 0 ? `paths=${(spec.preferredPaths || []).join(' / ')}` : '',
        (spec.scopeHints || []).length > 0 ? `scope=${(spec.scopeHints || []).join(' / ')}` : '',
      ].filter(Boolean);
      return parts.length > 0 ? `${spec.label} { ${parts.join('; ')} }` : spec.label;
    })
  ).join('；');
}

function pickCheckDetailSurfaceTitleIncludes(check: IntentVerificationPlanCheck, label = ''): string {
  const explicitTitle = normalizeText(check.detailSurface?.titleIncludes || '');
  if (explicitTitle) return explicitTitle;

  const fieldSpec = label ? pickCheckFieldSpec(check, label) : null;
  return pickFieldSpecTitleIncludes(fieldSpec);
}

function renderCheckRecordLookupRowHasTexts(check: IntentVerificationPlanCheck, sharedVariable: string): string {
  const rawTexts = uniqueStrings(check.recordLookup?.rowHasTexts || []);
  if (rawTexts.length === 0) {
    return `[${[sharedVariable ? toSharedAccessor(sharedVariable) : '', JSON.stringify('TODO_STABLE_STATE')].filter(Boolean).join(', ')}]`;
  }

  return `[${rawTexts
    .map((text) => {
      const normalized = normalizeText(text);
      if (!normalized) return '';
      if (sharedVariable && (normalized === sharedVariable || normalizeIntentToken(normalized) === normalizeIntentToken(sharedVariable))) {
        return toSharedAccessor(sharedVariable);
      }
      return JSON.stringify(normalized);
    })
    .filter(Boolean)
    .join(', ')}]`;
}

function renderCheckRecordLookupListResponse(check: IntentVerificationPlanCheck): string {
  const spec = check.recordLookup?.listResponse;
  if (!spec?.urlIncludes && !spec?.method) {
    return "{ urlIncludes: 'TODO', method: 'GET' }";
  }

  const parts = [
    spec.urlIncludes ? `urlIncludes: ${JSON.stringify(spec.urlIncludes)}` : '',
    spec.method ? `method: ${JSON.stringify(spec.method)}` : '',
  ].filter(Boolean);

  return `{ ${parts.join(', ')} }`;
}

function normalizeKnownHashRouteDetailUrlTemplate(template: string): string {
  const normalized = normalizeText(template);
  if (!normalized) return '';
  if (/#\/business\/detail\//i.test(normalized)) return normalized;
  if (/^(?:\/)?business\/detail\//i.test(normalized)) {
    return `#/${normalized.replace(/^\/+/, '')}`;
  }
  return normalized;
}

function renderCheckRecordLookupDetailUrl(check: IntentVerificationPlanCheck, sharedVariable: string): string {
  const template = normalizeKnownHashRouteDetailUrlTemplate(check.recordLookup?.detailUrl || '');
  if (!template) {
    return looksLikeIntentStableIdentifierVariable(sharedVariable) ? buildPrimaryDetailUrlTemplate(sharedVariable) : '';
  }

  const accessor = toSharedAccessor(sharedVariable);
  let value = template;
  let replaced = false;
  for (const placeholder of [`{{primaryValue}}`, sharedVariable ? `{{${sharedVariable}}}` : '']) {
    if (!placeholder) continue;
    if (value.includes(placeholder)) {
      value = value.split(placeholder).join(`\${${accessor}}`);
      replaced = true;
    }
  }

  return replaced ? `\`${value}\`` : JSON.stringify(value);
}

function renderCheckRecordLookupSearchSurface(check: IntentVerificationPlanCheck): string {
  const searchSurface = check.recordLookup?.searchSurface;
  const parts = [
    searchSurface?.keywordInput?.selector ? `keywordInput.selector=${searchSurface.keywordInput.selector}` : '',
    searchSurface?.keywordInput?.placeholderIncludes
      ? `keywordInput.placeholderIncludes=${searchSurface.keywordInput.placeholderIncludes}`
      : '',
    searchSurface?.searchButton?.selector ? `searchButton.selector=${searchSurface.searchButton.selector}` : '',
    searchSurface?.searchButton?.textIncludes ? `searchButton.textIncludes=${searchSurface.searchButton.textIncludes}` : '',
  ].filter(Boolean);

  return parts.join(' / ');
}

function renderCheckRecordLookupDetailEntry(check: IntentVerificationPlanCheck): string {
  const detailEntry = check.recordLookup?.detailEntry;
  const parts = [
    detailEntry?.trigger ? `trigger=${detailEntry.trigger}` : '',
    detailEntry?.actionLabel ? `actionLabel=${detailEntry.actionLabel}` : '',
    detailEntry?.target ? `target=${detailEntry.target}` : '',
    detailEntry?.urlIncludes ? `urlIncludes=${detailEntry.urlIncludes}` : '',
  ].filter(Boolean);

  return parts.join(' / ');
}

function renderLocatorHintExpression(
  hint: IntentVerificationLocatorHintSpec | undefined,
  mode: 'generic' | 'input' | 'button'
): string {
  if (!hint) return '';
  if (hint.selector) {
    return `page.locator(${JSON.stringify(hint.selector)}).first()`;
  }
  if (mode === 'input' && hint.placeholderIncludes) {
    return `page.getByPlaceholder(/${escapeForRegExp(hint.placeholderIncludes)}/i).first()`;
  }
  if (mode === 'button' && hint.textIncludes) {
    return `page.getByRole('button', { name: /${escapeForRegExp(hint.textIncludes)}/i }).first()`;
  }
  if (hint.textIncludes) {
    return `page.getByText(/${escapeForRegExp(hint.textIncludes)}/i).first()`;
  }
  return '';
}

function renderCheckRecordLookupKeywordInput(check: IntentVerificationPlanCheck): string {
  return renderLocatorHintExpression(check.recordLookup?.searchSurface?.keywordInput, 'input');
}

function renderCheckRecordLookupSearchButton(check: IntentVerificationPlanCheck): string {
  return renderLocatorHintExpression(check.recordLookup?.searchSurface?.searchButton, 'button');
}

function renderCheckRecordLookupTableScope(check: IntentVerificationPlanCheck): string {
  return renderLocatorHintExpression(check.recordLookup?.tableScope, 'generic');
}

function renderCheckRecordLookupDetailReadyLocator(check: IntentVerificationPlanCheck): string {
  return renderLocatorHintExpression(check.recordLookup?.detailReadyLocator, 'generic');
}

function renderCheckRecordLookup(check: IntentVerificationPlanCheck, sharedVariable: string): {
  rowHasTexts: string;
  listResponse: string;
  detailUrl: string;
  searchSurface: string;
  detailEntrySummary: string;
  tableScopeSummary: string;
  detailReadyLocatorSummary: string;
  keywordInput: string;
  searchButton: string;
  tableScope: string;
  detailReadyLocator: string;
} {
  return {
    rowHasTexts: renderCheckRecordLookupRowHasTexts(check, sharedVariable),
    listResponse: renderCheckRecordLookupListResponse(check),
    detailUrl: renderCheckRecordLookupDetailUrl(check, sharedVariable),
    searchSurface: renderCheckRecordLookupSearchSurface(check),
    detailEntrySummary: renderCheckRecordLookupDetailEntry(check),
    tableScopeSummary: check.recordLookup?.tableScope
      ? [
          check.recordLookup.tableScope.selector ? `tableScope.selector=${check.recordLookup.tableScope.selector}` : '',
          check.recordLookup.tableScope.textIncludes ? `tableScope.textIncludes=${check.recordLookup.tableScope.textIncludes}` : '',
        ]
          .filter(Boolean)
          .join(' / ')
      : '',
    detailReadyLocatorSummary: check.recordLookup?.detailReadyLocator
      ? [
          check.recordLookup.detailReadyLocator.selector
            ? `detailReadyLocator.selector=${check.recordLookup.detailReadyLocator.selector}`
            : '',
          check.recordLookup.detailReadyLocator.textIncludes
            ? `detailReadyLocator.textIncludes=${check.recordLookup.detailReadyLocator.textIncludes}`
            : '',
        ]
          .filter(Boolean)
          .join(' / ')
      : '',
    keywordInput: renderCheckRecordLookupKeywordInput(check),
    searchButton: renderCheckRecordLookupSearchButton(check),
    tableScope: renderCheckRecordLookupTableScope(check),
    detailReadyLocator: renderCheckRecordLookupDetailReadyLocator(check),
  };
}

function renderCheckDetailSurface(check: IntentVerificationPlanCheck): string {
  const parts = [
    check.detailSurface?.titleIncludes ? `titleIncludes=${check.detailSurface.titleIncludes}` : '',
    (check.detailSurface?.scopeHints || []).length > 0 ? `scopeHints=${(check.detailSurface?.scopeHints || []).join(' / ')}` : '',
  ].filter(Boolean);
  return parts.join('; ');
}

function buildPrimaryDetailUrlTemplate(variable: string): string {
  const accessor = toSharedAccessor(variable);
  if (/businessid/i.test(variable)) {
    return `\`#/business/detail/\${${accessor}}\``;
  }
  if (/orderid/i.test(variable)) {
    return `\`/order/detail/\${${accessor}}\``;
  }
  return `\`/detail/\${${accessor}}\``;
}

function rewriteDetailUrlPrimaryAccessor(
  detailUrlExpression: string,
  primaryAccessor: string,
  primaryValueExpression: string
): string {
  const normalizedExpression = String(detailUrlExpression || '').trim();
  if (!normalizedExpression || !primaryAccessor) {
    return normalizedExpression;
  }

  const currentInterpolation = `\${${primaryAccessor}}`;
  const nextInterpolation = `\${${primaryValueExpression}}`;
  return normalizedExpression.includes(currentInterpolation)
    ? normalizedExpression.split(currentInterpolation).join(nextInterpolation)
    : normalizedExpression;
}

function inferDetailFieldLabels(check: IntentVerificationPlanCheck, relatedSteps: IntentExecutionPlanStep[]): string[] {
  const structuredFieldSpecs = uniqueStrings((check.fieldSpecs || []).map((spec) => spec.label));
  if (structuredFieldSpecs.length > 0) return structuredFieldSpecs;

  const structuredFields = uniqueStrings(check.expectedFields || []);
  if (structuredFields.length > 0) return structuredFields;

  const haystack = normalizeText([
    check.title,
    check.instruction,
    ...relatedSteps.map((step) => step.goal),
    ...relatedSteps.flatMap((step) => step.requiredAssertions),
  ].join('\n'));
  const relatedStableIdentifierVariables = collectRelatedSharedVariables(relatedSteps).filter((variable) =>
    looksLikeIntentStableIdentifierVariable(variable)
  );

  return uniqueStrings([
    /(联系人|contact)/i.test(haystack) ? '联系人' : null,
    /(手机号|手机号码|电话|mobile|phone)/i.test(haystack) ? '手机号' : null,
    /(状态|status)/i.test(haystack) ? '状态' : null,
    /(创建时间|创建日期|时间|created\s*at|create\s*time)/i.test(haystack) ? '创建时间' : null,
    /(企业名称|公司|company)/i.test(haystack) ? '企业名称' : null,
    /(businessid|商机id)/i.test(haystack) ? 'businessId' : null,
    /(orderid|订单id|订单号)/i.test(haystack) ? 'orderId' : null,
    /(uid|编号|单号|流水号|serial|serialno|serialnumber|customercode|recordcode|recorduid)/i.test(haystack)
      ? pickRelatedSharedVariable(relatedSteps)
      : null,
    /(客户名称|customer)/i.test(haystack) ? '客户名称' : null,
    ...relatedStableIdentifierVariables,
  ]);
}

function buildDefaultDetailFieldLabels(detailFieldLabels: string[], sharedVariable: string): string[] {
  if (detailFieldLabels.length > 0) return detailFieldLabels;
  if (looksLikeIntentStableIdentifierVariable(sharedVariable)) return [sharedVariable];
  return ['状态'];
}

function resolveDetailFieldExpectedLiteral(
  label: string,
  relatedSteps: IntentExecutionPlanStep[],
  check?: IntentVerificationPlanCheck
): string {
  const normalizedLabel = normalizeIntentToken(label);
  if (!normalizedLabel) return '';

  const haystack = normalizeText(
    [
      check?.title,
      check?.instruction,
      ...(check?.expectedFields || []),
      ...relatedSteps.map((step) => step.goal),
      ...relatedSteps.flatMap((step) => step.requiredAssertions),
    ]
      .filter(Boolean)
      .join('\n')
  );

  if (/(状态|status|state)/i.test(normalizedLabel)) {
    const patterns = [
      /状态(?:列|字段|值)?(?:应为|为|是|显示为|显示成|等于|=)\s*[“"'`]?([A-Za-z0-9_\-\u4e00-\u9fa5]{1,20})/i,
      /status(?:\s+field)?(?:\s+should\s+be|\s+is|=)\s*["'`]?([A-Za-z0-9_\-]{1,20})/i,
    ];

    for (const pattern of patterns) {
      const matched = haystack.match(pattern)?.[1];
      const value = String(matched || '').trim();
      if (value) return value;
    }
  }

  return '';
}

function resolveDetailFieldExpectedExpression(
  label: string,
  relatedSteps: IntentExecutionPlanStep[],
  check?: IntentVerificationPlanCheck
): string {
  const sharedVariables = collectRelatedSharedVariables(relatedSteps);
  const normalizedLabel = normalizeIntentToken(label);
  if (!normalizedLabel) return '';

  const matchedVariable = sharedVariables.find((variable) => {
    if (!looksLikeIntentStableIdentifierVariable(variable)) return false;
    const normalizedVariable = normalizeIntentToken(variable);
    return (
      normalizedVariable === normalizedLabel ||
      normalizedVariable.includes(normalizedLabel) ||
      normalizedLabel.includes(normalizedVariable)
    );
  });

  if (matchedVariable) {
    return toSharedAccessor(matchedVariable);
  }

  const literalExpectedValue = resolveDetailFieldExpectedLiteral(label, relatedSteps, check);
  return literalExpectedValue ? JSON.stringify(literalExpectedValue) : '';
}

function buildDetailFieldRecordJsonPaths(
  label: string,
  relatedSteps: IntentExecutionPlanStep[],
  check?: IntentVerificationPlanCheck
): string[] {
  const normalizedLabel = normalizeText(label).replace(/\s+/g, '');
  const sharedVariables = collectRelatedSharedVariables(relatedSteps);
  const matchedVariable = sharedVariables.find((variable) => {
    const normalizedVariable = normalizeIntentToken(variable);
    const normalizedField = normalizeIntentToken(normalizedLabel);
    return normalizedVariable && normalizedField && (normalizedVariable === normalizedField || normalizedVariable.includes(normalizedField));
  });

  return uniqueStrings([
    check ? pickCheckPreferredPaths(check, label) : null,
    matchedVariable ? buildIntentSharedVariableJsonPaths(matchedVariable) : null,
    isIdentifierLikeToken(normalizedLabel) ? buildIntentSharedVariableJsonPaths(normalizedLabel) : null,
    /(联系人|contact)/i.test(normalizedLabel)
      ? ['contactName', 'contact', 'contactPerson', 'contactUser', 'contactUserName', 'linkman', 'name']
      : null,
    /(手机号|手机号码|电话|mobile|phone)/i.test(normalizedLabel)
      ? ['mobile', 'phone', 'telephone', 'tel', 'contactPhone', 'contactMobile', 'mobilePhone']
      : null,
    /(状态|status|state)/i.test(normalizedLabel) ? buildGenericStatusJsonPaths() : null,
    /(创建时间|创建日期|createdat|createtime|createdtime)/i.test(normalizedLabel)
      ? ['createdAt', 'createTime', 'createdTime', 'createDate', 'createdDate', 'gmtCreate']
      : null,
    /(企业名称|公司|company)/i.test(normalizedLabel)
      ? ['companyName', 'enterpriseName', 'orgName', 'organizationName', 'customerName', 'name']
      : null,
    /(客户名称|customer|client)/i.test(normalizedLabel)
      ? ['customerName', 'clientName', 'customer', 'client', 'name']
      : null,
  ].flat());
}

function buildDetailFieldSkeletonLines(
  baseName: string,
  detailFieldLabels: string[],
  relatedSteps: IntentExecutionPlanStep[],
  matchedRecordAccessor = '',
  check?: IntentVerificationPlanCheck,
  detailScopeAccessor = ''
): string[] {
  return detailFieldLabels.flatMap((label, index) => {
    const fieldValueIdentifier = toSafeIdentifier(`${baseName}DetailField${index + 1}Value`, `${baseName}DetailField${index + 1}Value`);
    const expectedValueIdentifier = toSafeIdentifier(
      `${baseName}DetailField${index + 1}Expected`,
      `${baseName}DetailField${index + 1}Expected`
    );
    const expectedExpression = resolveDetailFieldExpectedExpression(label, relatedSteps, check);
    const recordFieldPaths = buildDetailFieldRecordJsonPaths(label, relatedSteps, check);
    const fieldSpec = check ? pickCheckFieldSpec(check, label) : null;
    const titleIncludes = check ? pickCheckDetailSurfaceTitleIncludes(check, label) : pickFieldSpecTitleIncludes(fieldSpec);
    const detailFieldArgs = [
      `label: ${JSON.stringify(label)}`,
      detailScopeAccessor ? `scope: ${detailScopeAccessor}` : '',
      titleIncludes ? `titleIncludes: ${JSON.stringify(titleIncludes)}` : '',
      'required: false',
    ].filter(Boolean);
    const readDetailFieldCall = `await __e2e.readDetailField(page, { ${detailFieldArgs.join(', ')} })`;

    if (expectedExpression) {
      const specComment = fieldSpec
        ? `// fieldSpec: label=${label}; source=${fieldSpec.expectedSource || 'unknown'}${(fieldSpec.scopeHints || []).length > 0 ? `; scope=${fieldSpec.scopeHints?.join(' / ')}` : ''}`
        : '';
      return [
        specComment,
        `const ${fieldValueIdentifier} = ${readDetailFieldCall};`,
        `if (${fieldValueIdentifier}) {`,
        `  expect(${fieldValueIdentifier}).toContain(${expectedExpression});`,
        `} else {`,
        `  throw new Error(${JSON.stringify(`详情字段缺失：${label}`)});`,
        `}`,
      ].filter(Boolean);
    }

    if (matchedRecordAccessor && recordFieldPaths.length > 0) {
      const specComment = fieldSpec
        ? `// fieldSpec: label=${label}; source=${fieldSpec.expectedSource || 'unknown'}; paths=${recordFieldPaths.join(' / ')}${(fieldSpec.scopeHints || []).length > 0 ? `; scope=${fieldSpec.scopeHints?.join(' / ')}` : ''}`
        : '';
      return [
        specComment,
        `const ${fieldValueIdentifier} = ${readDetailFieldCall};`,
        `const ${expectedValueIdentifier} = ${matchedRecordAccessor} ? __e2e.pickJsonValue(${matchedRecordAccessor}, { label: ${JSON.stringify(label)}, paths: ${renderJsStringArray(
          recordFieldPaths
        )}, required: false }) : '';`,
        `if (${expectedValueIdentifier}) {`,
        `  if (${fieldValueIdentifier}) {`,
        `    expect(${fieldValueIdentifier}).toContain(${expectedValueIdentifier});`,
        `  } else {`,
        `    throw new Error(${JSON.stringify(`详情字段缺失：${label}`)});`,
        `  }`,
        `} else if (${fieldValueIdentifier}) {`,
        `  expect(${fieldValueIdentifier}).toContain('TODO_EXPECTED_${label}');`,
        `} else {`,
        `  throw new Error(${JSON.stringify(`详情字段缺失：${label}；请继续补列表响应/详情入口证据`)});`,
        `}`,
      ].filter(Boolean);
    }

    const specComment = fieldSpec
      ? `// fieldSpec: label=${label}; source=${fieldSpec.expectedSource || 'unknown'}${(fieldSpec.scopeHints || []).length > 0 ? `; scope=${fieldSpec.scopeHints?.join(' / ')}` : ''}`
      : '';
    return [
      specComment,
      `const ${fieldValueIdentifier} = ${readDetailFieldCall};`,
      `if (${fieldValueIdentifier}) {`,
      `  expect(${fieldValueIdentifier}).toContain('TODO_EXPECTED_${label}');`,
      `} else {`,
      `  throw new Error(${JSON.stringify(`详情字段缺失：${label}`)});`,
      `}`,
    ].filter(Boolean);
  });
}

function buildRecordMatchedRecordLines(
  baseName: string,
  recordAccessor: string,
  sharedVariable: string,
  primaryAccessor: string,
  candidatePaths: string[],
  enabled: boolean
): string[] {
  if (!enabled) return [];

  return [
    `const ${baseName}ListPayload = ${recordAccessor}.response ? await __e2e.readJsonResponse(${recordAccessor}.response, { required: false }) : null;`,
    `const ${baseName}MatchedRecord = ${baseName}ListPayload ? __e2e.pickJsonRecord(${baseName}ListPayload, { label: ${JSON.stringify(
      sharedVariable
    )}, value: ${primaryAccessor}, paths: ${renderJsStringArray(candidatePaths)}, collectionPaths: ${renderJsStringArray(
      buildDefaultJsonRecordCollectionPaths()
    )}, required: false }) : null;`,
  ];
}

function buildStatusEvidenceRecordLines(
  baseName: string,
  recordAccessor: string,
  resolvePrimaryRecordArgs: string[],
  enabled: boolean
): { accessor: string; lines: string[] } {
  if (!enabled) {
    return { accessor: recordAccessor, lines: [] };
  }

  const statusEvidenceRecordAccessor = toSafeIdentifier(
    `${baseName}StatusEvidenceRecordCheck`,
    `${baseName}StatusEvidenceRecordCheck`
  );

  return {
    accessor: statusEvidenceRecordAccessor,
    lines: [
      `const ${statusEvidenceRecordAccessor} = ${recordAccessor}.response ? ${recordAccessor} : ${recordAccessor}.row ? await __e2e.resolvePrimaryRecord(page, {`,
      ...resolvePrimaryRecordArgs,
      `  preferCurrentVisibleRow: false,`,
      `  maxLookupAttempts: 1,`,
      `  retryIntervalMs: 200,`,
      `}) : ${recordAccessor};`,
    ],
  };
}

function buildCurrentVisibleRowPrecheckLines(
  baseName: string,
  primaryAccessor: string,
  tableScopeExpression: string
): string[] {
  const currentVisibleRowIdentifier = toSafeIdentifier(`${baseName}CurrentVisibleRow`, `${baseName}CurrentVisibleRow`);

  return [
    `const ${currentVisibleRowIdentifier} = ${primaryAccessor} ? await (async () => {`,
    `  try {`,
    `    return await __e2e.findAntdTableRow(page, {`,
    ...(tableScopeExpression ? [`      table: ${tableScopeExpression},`] : []),
    `      hasTexts: [${primaryAccessor}],`,
    `      timeoutMs: 1200,`,
    `    });`,
    `  } catch {`,
    `    return null;`,
    `  }`,
    `})() : null;`,
  ];
}

function hasExplicitRowDetailEntrySignal(
  check: IntentVerificationPlanCheck,
  relatedSteps: IntentExecutionPlanStep[],
  detailReadyLocatorExpression: string
): boolean {
  if (check.recordLookup?.detailEntry?.trigger) {
    return true;
  }

  const explicitTitle = pickCheckDetailSurfaceTitleIncludes(check);
  if (explicitTitle) {
    return true;
  }

  if (detailReadyLocatorExpression) {
    return true;
  }

  const scopeHints = uniqueStrings(check.detailSurface?.scopeHints || []);
  if (scopeHints.some((hint) => /(详情|detail|drawer|modal|抽屉|弹层)/i.test(normalizeText(hint)))) {
    return true;
  }

  const haystack = normalizeText([
    check.title,
    check.instruction,
    ...relatedSteps.map((step) => step.goal),
    ...relatedSteps.flatMap((step) => step.requiredAssertions),
  ].join('\n'));

  return /(查看|详情|detail|drawer|modal|抽屉|弹层)/i.test(haystack);
}

function buildImplicitDetailEntryLines(
  baseName: string,
  rowAccessor: string,
  check: IntentVerificationPlanCheck,
  relatedSteps: IntentExecutionPlanStep[],
  matchedRecordAccessor: string,
  detailFieldLabels: string[],
  detailReadyLocatorExpression: string,
  detailUrlExpression: string
): string[] {
  if (check.recordLookup?.detailEntry?.trigger) return [];

  const hasRowActionHelper =
    check.preferredHelpers.includes('__e2e.clickAntdRowAction') ||
    relatedSteps.some((step) => step.preferredHelpers.includes('__e2e.clickAntdRowAction'));
  const needsStatusFallback = detailFieldLabels.some((label) => /(状态|status|state)/i.test(normalizeText(label)));
  const hasExplicitDetailEntrySignal = hasExplicitRowDetailEntrySignal(check, relatedSteps, detailReadyLocatorExpression);
  if (!hasRowActionHelper || !needsStatusFallback || !hasExplicitDetailEntrySignal) {
    return [];
  }

  // When a stable detail URL already exists, prefer the explicit detail route fallback
  // instead of guessing that the list action must open a modal/drawer.
  if (detailUrlExpression) {
    return [];
  }

  const scopeHints = uniqueStrings(check.detailSurface?.scopeHints || []);
  const prefersDetailPage =
    (scopeHints.some((hint) => /(详情页|detailpage|detail page)/i.test(normalizeText(hint))) ||
      /(详情页|detail page|跳转详情|进入详情)/i.test(
        normalizeText([
          check.title,
          check.instruction,
          ...relatedSteps.map((step) => step.goal),
          ...relatedSteps.flatMap((step) => step.requiredAssertions),
        ].join('\n'))
      )) &&
    Boolean(detailReadyLocatorExpression);

  const inferredCheck: IntentVerificationPlanCheck = {
    ...check,
    recordLookup: {
      ...(check.recordLookup || {}),
      detailEntry: {
        trigger: 'row_action',
        actionLabel: '查看',
        target: prefersDetailPage ? 'page' : 'drawer_or_modal',
        urlIncludes: prefersDetailPage ? check.recordLookup?.detailUrl || undefined : undefined,
      },
    },
  };

  return buildDetailEntryLines(
    baseName,
    rowAccessor,
    inferredCheck,
    relatedSteps,
    matchedRecordAccessor,
    detailFieldLabels,
    detailReadyLocatorExpression
  );
}

function shouldEnableDerivedBusinessIdStatusFallback(
  sharedVariable: string,
  check: IntentVerificationPlanCheck,
  relatedSteps: IntentExecutionPlanStep[],
  detailUrlExpression: string
): boolean {
  if (/businessid/i.test(sharedVariable)) {
    return true;
  }

  if (/\/business\/detail\//i.test(normalizeText(detailUrlExpression))) {
    return true;
  }

  const haystack = normalizeText(
    [
      sharedVariable,
      check.title,
      check.instruction,
      check.recordLookup?.listResponse?.urlIncludes || '',
      check.recordLookup?.detailUrl || '',
      ...relatedSteps.map((step) => [step.title, step.target, step.goal, ...step.requiredAssertions].join('\n')),
    ].join('\n')
  );

  return /(商机|businesslist|\/business\/|createbusiness)/i.test(haystack);
}

function buildDirectDetailUrlFallbackLines(
  baseName: string,
  relatedSteps: IntentExecutionPlanStep[],
  check: IntentVerificationPlanCheck,
  detailFieldLabels: string[],
  matchedRecordAccessor: string,
  detailUrlExpression: string,
  detailReadyLocatorExpression: string
): string[] {
  const titleIncludes = pickCheckDetailSurfaceTitleIncludes(check);
  const detailSurfaceIdentifier = titleIncludes
    ? toSafeIdentifier(`${baseName}DetailSurface`, `${baseName}DetailSurface`)
    : '';

  return [
    `await page.goto(${detailUrlExpression}, { waitUntil: 'domcontentloaded' });`,
    detailReadyLocatorExpression ? `await expect(${detailReadyLocatorExpression}).toBeVisible();` : '',
    ...(
      titleIncludes
        ? [
            `const ${detailSurfaceIdentifier} = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: ${JSON.stringify(
              titleIncludes
            )}, timeoutMs: 2500, required: false });`,
            `if (!${detailSurfaceIdentifier}) throw new Error(${JSON.stringify(
              `详情页无效：detailUrl 未出现${titleIncludes} surface`
            )});`,
          ]
        : []
    ),
    ...buildDetailFieldSkeletonLines(
      baseName,
      detailFieldLabels,
      relatedSteps,
      matchedRecordAccessor,
      check,
      detailSurfaceIdentifier
    ),
  ].filter(Boolean);
}

function buildRowStatusFallbackLines(
  baseName: string,
  rowAccessor: string,
  statusEvidenceRecordLines: string[],
  statusEvidenceRecordAccessor: string,
  matchedRecordAccessor: string,
  relatedSteps: IntentExecutionPlanStep[],
  check: IntentVerificationPlanCheck,
  detailFieldLabels: string[],
  sharedVariable: string,
  primaryAccessor: string,
  candidatePaths: string[],
  detailFallbackLines: string[],
  detailUrlExpression: string,
  detailReadyLocatorExpression: string
): string[] {
  const statusPaths = buildDetailFieldRecordJsonPaths('状态', relatedSteps, check);
  const rowTextIdentifier = toSafeIdentifier(`${baseName}RowText`, `${baseName}RowText`);
  const visibleRowStatusIdentifier = toSafeIdentifier(`${baseName}VisibleRowStatus`, `${baseName}VisibleRowStatus`);
  const rowKeyIdentifier = toSafeIdentifier(`${baseName}RowKey`, `${baseName}RowKey`);
  const derivedPrimaryIdentifier = toSafeIdentifier(`${baseName}DerivedPrimaryValue`, `${baseName}DerivedPrimaryValue`);
  const derivedBusinessIdIdentifier = toSafeIdentifier(`${baseName}DerivedBusinessId`, `${baseName}DerivedBusinessId`);
  const matchedRecordByDerivedBusinessIdIdentifier = toSafeIdentifier(
    `${baseName}MatchedRecordByDerivedBusinessId`,
    `${baseName}MatchedRecordByDerivedBusinessId`
  );
  const resolvedMatchedRecordIdentifier = toSafeIdentifier(
    `${baseName}ResolvedMatchedRecord`,
    `${baseName}ResolvedMatchedRecord`
  );
  const expectedStatusIdentifier = toSafeIdentifier(`${baseName}ExpectedStatus`, `${baseName}ExpectedStatus`);
  const expectedStatusAssertionIdentifier = toSafeIdentifier(
    `${baseName}ExpectedStatusAssertion`,
    `${baseName}ExpectedStatusAssertion`
  );
  const listPayloadIdentifier = toSafeIdentifier(`${baseName}ListPayload`, `${baseName}ListPayload`);
  const isBusinessListStatusFallback = shouldEnableDerivedBusinessIdStatusFallback(
    sharedVariable,
    check,
    relatedSteps,
    detailUrlExpression
  );
  const supportsDerivedBusinessIdFallback = Boolean(matchedRecordAccessor) && isBusinessListStatusFallback;
  const rowStatusHeaderLabels = uniqueStrings([
    ...(isBusinessListStatusFallback ? ['商机进展'] : []),
    ...detailFieldLabels.filter((label) => /(状态|status|state|进展|progress)/i.test(normalizeText(label))),
    '状态',
  ]);
  const effectiveMatchedRecordAccessor = supportsDerivedBusinessIdFallback
    ? resolvedMatchedRecordIdentifier
    : matchedRecordAccessor;
  const detailUrlRequiresPrimary = Boolean(
    detailUrlExpression && primaryAccessor && detailUrlExpression.includes(`\${${primaryAccessor}}`)
  );
  const detailFallbackPrimaryIdentifier = supportsDerivedBusinessIdFallback
    ? derivedBusinessIdIdentifier
    : derivedPrimaryIdentifier;
  const detailUrlFallbackExpression =
    detailUrlRequiresPrimary && primaryAccessor
      ? rewriteDetailUrlPrimaryAccessor(detailUrlExpression, primaryAccessor, detailFallbackPrimaryIdentifier)
      : detailUrlExpression;
  const expectedStatusAssertionExpression =
    resolveDetailFieldExpectedExpression('状态', relatedSteps, check) || JSON.stringify('TODO_EXPECTED_状态');
  if (statusPaths.length === 0 && !expectedStatusAssertionExpression && detailFallbackLines.length === 0) {
    return [];
  }

  return [
    `const ${rowTextIdentifier} = await ${rowAccessor}.innerText().catch(() => '');`,
    `const ${expectedStatusAssertionIdentifier} = ${expectedStatusAssertionExpression};`,
    `const ${visibleRowStatusIdentifier} = await __e2e.readAntdTableCellByHeader(page, ${rowAccessor}, { headerLabels: ${renderJsStringArray(
      rowStatusHeaderLabels
    )}, required: false });`,
    `if (${visibleRowStatusIdentifier}) {`,
    `  expect(String(${visibleRowStatusIdentifier})).toContain(String(${expectedStatusAssertionIdentifier}));`,
    `} else {`,
    ...statusEvidenceRecordLines.map((line) => `  ${line}`),
    `  const ${listPayloadIdentifier} = ${statusEvidenceRecordAccessor}.response ? await __e2e.readJsonResponse(${statusEvidenceRecordAccessor}.response, { required: false }) : null;`,
    `  const ${matchedRecordAccessor} = ${listPayloadIdentifier} ? __e2e.pickJsonRecord(${listPayloadIdentifier}, { label: ${JSON.stringify(
      sharedVariable
    )}, value: ${primaryAccessor}, paths: ${renderJsStringArray(candidatePaths)}, collectionPaths: ${renderJsStringArray(
      buildDefaultJsonRecordCollectionPaths()
    )}, required: false }) : null;`,
    ...(
      supportsDerivedBusinessIdFallback
        ? [
            `  const ${rowKeyIdentifier} = ((await ${rowAccessor}.getAttribute('data-row-key')) || '').trim();`,
            `  const ${derivedBusinessIdIdentifier} = ${toSharedAccessor('businessId')} || ((/^[A-Za-z0-9_-]{6,64}$/.test(${rowKeyIdentifier}) && !/^1\\d{10}$/.test(${rowKeyIdentifier})) ? ${rowKeyIdentifier} : '') || (((${rowTextIdentifier}.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item))) || '');`,
            `  const ${matchedRecordByDerivedBusinessIdIdentifier} = !${matchedRecordAccessor} && ${listPayloadIdentifier} && ${derivedBusinessIdIdentifier} ? __e2e.pickJsonRecord(${listPayloadIdentifier}, { label: 'derivedBusinessId', value: ${derivedBusinessIdIdentifier}, paths: ['businessId', 'id'], required: false }) : null;`,
            `  const ${resolvedMatchedRecordIdentifier} = ${matchedRecordAccessor} || ${matchedRecordByDerivedBusinessIdIdentifier};`,
          ]
        : detailUrlRequiresPrimary
        ? [
            `  const ${rowKeyIdentifier} = await ${rowAccessor}.getAttribute('data-row-key').catch(() => '');`,
            `  const ${derivedPrimaryIdentifier} = ${primaryAccessor} || ((() => { const candidate = String(${rowKeyIdentifier} || '').trim(); return /^[A-Za-z0-9_-]{6,64}$/.test(candidate) && !/^1\\d{10}$/.test(candidate) ? candidate : ''; })()) || (((String(${rowTextIdentifier} || '').match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item))) || '');`,
          ]
        : []
    ),
    `  const ${expectedStatusIdentifier} = ${
      effectiveMatchedRecordAccessor && statusPaths.length > 0
        ? `${effectiveMatchedRecordAccessor} ? __e2e.pickJsonValue(${effectiveMatchedRecordAccessor}, { label: "状态", paths: ${renderJsStringArray(
            statusPaths
          )}, required: false }) : ''`
        : "''"
    };`,
    `  if (${expectedStatusIdentifier}) {`,
    `    expect(String(${expectedStatusIdentifier})).toContain(String(${expectedStatusAssertionIdentifier}));`,
    `  } else {`,
    ...(
      detailFallbackLines.length > 0
        ? detailFallbackLines.map((line) => `    ${line}`)
        : [
            detailUrlRequiresPrimary
              ? `    if (!${detailFallbackPrimaryIdentifier}) throw new Error(${JSON.stringify('状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口')});`
              : primaryAccessor
              ? `    if (!${primaryAccessor}) throw new Error(${JSON.stringify('状态证据缺失：列表行已命中，但缺少主键且未提供详情入口')});`
              : '',
            ...(
              detailUrlExpression
                ? buildDirectDetailUrlFallbackLines(
                    baseName,
                    relatedSteps,
                    check,
                    detailFieldLabels,
                    matchedRecordAccessor,
                    detailUrlFallbackExpression,
                    detailReadyLocatorExpression
                  ).map((line) => `    ${line}`)
                : [`    throw new Error(${JSON.stringify('状态证据缺失：列表行已命中，但列表响应和详情入口都未提供状态')});`]
            ),
          ].filter(Boolean)
    ),
    `  }`,
    `}`,
  ].filter(Boolean);
}

function buildNotFoundRecordFallbackLines(
  baseName: string,
  matchedRecordAccessor: string,
  relatedSteps: IntentExecutionPlanStep[],
  check: IntentVerificationPlanCheck,
  detailFieldLabels: string[]
): string[] {
  const missingRecordError = JSON.stringify('未命中目标记录：列表未命中，且没有可用的详情回退路径');
  const statusLabel = detailFieldLabels.find((label) => /(状态|status|state)/i.test(normalizeText(label))) || '';
  if (!statusLabel) {
    return [`throw new Error(${missingRecordError});`];
  }

  const statusPaths = buildDetailFieldRecordJsonPaths(statusLabel, relatedSteps, check);
  const expectedStatusIdentifier = toSafeIdentifier(`${baseName}NotFoundExpectedStatus`, `${baseName}NotFoundExpectedStatus`);
  const expectedStatusAssertionIdentifier = toSafeIdentifier(
    `${baseName}NotFoundExpectedStatusAssertion`,
    `${baseName}NotFoundExpectedStatusAssertion`
  );
  const expectedStatusAssertionExpression =
    resolveDetailFieldExpectedExpression(statusLabel, relatedSteps, check) || JSON.stringify('TODO_EXPECTED_状态');

  return [
    `const ${expectedStatusIdentifier} = ${
      matchedRecordAccessor && statusPaths.length > 0
        ? `${matchedRecordAccessor} ? __e2e.pickJsonValue(${matchedRecordAccessor}, { label: ${JSON.stringify(
            statusLabel
          )}, paths: ${renderJsStringArray(statusPaths)}, required: false }) : ''`
        : "''"
    };`,
    `const ${expectedStatusAssertionIdentifier} = ${expectedStatusAssertionExpression};`,
    `if (${expectedStatusIdentifier}) {`,
    `  expect(String(${expectedStatusIdentifier})).toContain(String(${expectedStatusAssertionIdentifier}));`,
    `} else {`,
    `  throw new Error(${missingRecordError});`,
    `}`,
  ];
}

function buildDetailEntryLines(
  baseName: string,
  rowAccessor: string,
  check: IntentVerificationPlanCheck,
  relatedSteps: IntentExecutionPlanStep[],
  matchedRecordAccessor: string,
  detailFieldLabels: string[],
  detailReadyLocatorExpression: string
): string[] {
  const detailEntry = check.recordLookup?.detailEntry;
  if (!detailEntry?.trigger) {
    return [];
  }

  const lines =
    detailEntry.trigger === 'row_click'
      ? [`await ${rowAccessor}.scrollIntoViewIfNeeded();`, `await ${rowAccessor}.click();`]
      : detailEntry.actionLabel
      ? [`await __e2e.clickAntdRowAction(page, ${rowAccessor}, ${JSON.stringify(detailEntry.actionLabel)});`]
      : [];
  if (lines.length === 0) {
    return [];
  }
  const detailScopeIdentifier = toSafeIdentifier(`${baseName}DetailScope`, `${baseName}DetailScope`);
  const titleIncludes = pickCheckDetailSurfaceTitleIncludes(check);
  const target = detailEntry.target || 'drawer_or_modal';

  if (target === 'drawer_or_modal') {
    if (titleIncludes) {
      lines.push(
        `let ${detailScopeIdentifier} = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: ${JSON.stringify(
          titleIncludes
        )}, timeoutMs: 5000, required: false });`
      );
      lines.push(`if (!${detailScopeIdentifier}) {`);
      lines.push(
        `  ${detailScopeIdentifier} = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: ${JSON.stringify(
          titleIncludes
        )}, timeoutMs: 2500, required: false });`
      );
      lines.push(`}`);
      lines.push(
        `if (!${detailScopeIdentifier}) throw new Error(${JSON.stringify(
          '状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页'
        )});`
      );
    } else if (detailReadyLocatorExpression) {
      lines.push(`await expect(${detailReadyLocatorExpression}).toBeVisible({ timeout: 5000 });`);
      lines.push(`const ${detailScopeIdentifier} = page.locator('.ant-drawer-content:visible, .ant-modal-content:visible').last();`);
      lines.push(`await expect(${detailScopeIdentifier}).toBeVisible({ timeout: 5000 });`);
    } else {
      lines.push(`const ${detailScopeIdentifier} = await __e2e.waitForVisibleAntdModal(page, { timeoutMs: 5000 });`);
    }
    return [
      ...lines,
      ...buildDetailFieldSkeletonLines(baseName, detailFieldLabels, relatedSteps, matchedRecordAccessor, check, detailScopeIdentifier),
    ];
  }

  if (detailEntry.urlIncludes) {
    lines.push(`await expect.poll(() => page.url()).toContain(${JSON.stringify(detailEntry.urlIncludes)});`);
  } else {
    lines.push(`await page.waitForLoadState('domcontentloaded');`);
  }

  if (detailReadyLocatorExpression) {
    lines.push(`await expect(${detailReadyLocatorExpression}).toBeVisible();`);
  }

  return [
    ...lines,
    ...buildDetailFieldSkeletonLines(baseName, detailFieldLabels, relatedSteps, matchedRecordAccessor, check),
  ];
}

function pickModalStateTitleIncludes(check: IntentVerificationPlanCheck): string {
  const explicitTitle = pickCheckDetailSurfaceTitleIncludes(check);
  if (explicitTitle) return explicitTitle;

  return (
    uniqueStrings(
      (check.detailSurface?.scopeHints || []).filter(
        (hint) => !/^(详情页|详情抽屉|详情弹层|抽屉|弹层|modal|drawer|page)$/i.test(String(hint || '').trim())
      )
    )[0] || ''
  );
}

function inferModalStateExpectation(
  check: IntentVerificationPlanCheck,
  relatedSteps: IntentExecutionPlanStep[]
): 'closed' | 'visible' {
  const haystack = normalizeText([
    check.title,
    check.instruction,
    ...(check.expectedFields || []),
    ...relatedSteps.map((step) => step.goal),
    ...relatedSteps.flatMap((step) => step.requiredAssertions),
  ].join('\n'));

  if (/(关闭|关闭后|已关闭|消失|收起|隐藏|closed?|dismiss(ed)?|gone|removed?)/i.test(haystack)) {
    return 'closed';
  }
  if (/(打开|展示|显示|出现|可见|弹出|opened?|visible)/i.test(haystack)) {
    return 'visible';
  }

  const prefersSubmitObservation =
    check.preferredHelpers.includes('__e2e.observeSubmitState') ||
    relatedSteps.some((step) => step.preferredHelpers.includes('__e2e.observeSubmitState'));

  return prefersSubmitObservation ? 'closed' : 'visible';
}

function renderVisibleAntdLayerLocatorExpression(titleIncludes: string, mode: 'wrap' | 'content'): string {
  const selector =
    mode === 'content'
      ? '.ant-drawer-content:visible, .ant-modal-content:visible'
      : '.ant-drawer-content-wrapper:visible, .ant-modal-wrap:visible';

  if (!titleIncludes) {
    return `page.locator(${JSON.stringify(selector)})`;
  }

  return `page.locator(${JSON.stringify(selector)}).filter({ hasText: /${escapeForRegExp(titleIncludes)}/i })`;
}

function buildModalStateSkeletonLines(
  check: IntentVerificationPlanCheck,
  relatedSteps: IntentExecutionPlanStep[]
): string[] {
  const baseName = toSafeIdentifier(check.checkUid, 'verify_modal_state');
  const titleIncludes = pickModalStateTitleIncludes(check);
  const expectation = inferModalStateExpectation(check, relatedSteps);

  if (expectation === 'closed') {
    return [
      `const ${baseName}VisibleLayer = ${renderVisibleAntdLayerLocatorExpression(titleIncludes, 'wrap')};`,
      `await expect(${baseName}VisibleLayer).toHaveCount(0);`,
    ];
  }

  if (titleIncludes) {
    return [
      `const ${baseName}VisibleLayer = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: ${JSON.stringify(titleIncludes)}, timeoutMs: 5000 });`,
      `await expect(${baseName}VisibleLayer).toBeVisible();`,
    ];
  }

  return [
    `const ${baseName}VisibleLayer = ${renderVisibleAntdLayerLocatorExpression('', 'content')}.last();`,
    `await expect(${baseName}VisibleLayer).toBeVisible();`,
  ];
}

function buildVerificationSkeletonLines(check: IntentVerificationPlanCheck, relatedSteps: IntentExecutionPlanStep[]): string[] {
  const sharedVariable = pickCheckStableIdentifier(check, relatedSteps);
  const candidatePaths = sharedVariable
    ? uniqueStrings([...pickCheckPreferredPaths(check, sharedVariable), ...buildIntentSharedVariableJsonPaths(sharedVariable)])
    : [];
  const detailFieldLabels = buildDefaultDetailFieldLabels(inferDetailFieldLabels(check, relatedSteps), sharedVariable);
  const baseName = toSafeIdentifier(check.checkUid, 'verify_check');
  const primaryAccessor = sharedVariable ? toSharedAccessor(sharedVariable) : '';
  const relatedArtifactAccessor = relatedSteps[0] ? toArtifactsAccessor(relatedSteps[0].planStepUid) : '';
  const recordLookup = sharedVariable ? renderCheckRecordLookup(check, sharedVariable) : null;
  const recordBackedDetailFields = detailFieldLabels.filter(
    (label) =>
      !resolveDetailFieldExpectedExpression(label, relatedSteps, check) &&
      buildDetailFieldRecordJsonPaths(label, relatedSteps, check).length > 0
  );

  switch (check.kind) {
    case 'response':
      return relatedArtifactAccessor
        ? uniqueStrings([
            `const ${baseName}Resp = await ${relatedArtifactAccessor};`,
            `expect(${baseName}Resp).toBeTruthy();`,
            `expect(${baseName}Resp.ok()).toBeTruthy();`,
            `const ${baseName}Payload = await __e2e.readJsonResponse(${baseName}Resp, { required: false });`,
            sharedVariable && looksLikeIntentStableIdentifierVariable(sharedVariable)
              ? `if (${primaryAccessor}) expect(JSON.stringify(${baseName}Payload)).toContain(${primaryAccessor});`
              : `TODO: 按 ${normalizeText(check.instruction) || '业务成功字段'} 校验响应 payload。`,
          ])
        : [`TODO: 等待并校验 ${normalizeText(check.instruction) || '关键接口响应'}。`];
    case 'table_row':
      if (shouldPreferResolvePrimaryRecord(check, relatedSteps, sharedVariable)) {
        const includeDetailUrl = Boolean(recordLookup?.detailUrl) || looksLikeIntentStableIdentifierVariable(sharedVariable);
        const currentVisibleRowIdentifier = toSafeIdentifier(`${baseName}CurrentVisibleRow`, `${baseName}CurrentVisibleRow`);
        const currentVisibleRowLines = buildCurrentVisibleRowPrecheckLines(
          baseName,
          primaryAccessor,
          recordLookup?.tableScope || ''
        );
        const resolvePrimaryRecordArgs = [
          `  primaryValue: ${primaryAccessor},`,
          recordLookup?.keywordInput ? `  keywordInput: ${recordLookup.keywordInput},` : '',
          recordLookup?.searchButton ? `  searchButton: ${recordLookup.searchButton},` : '',
          recordLookup?.tableScope ? `  table: ${recordLookup.tableScope},` : '',
          `  listResponse: ${recordLookup?.listResponse || "{ urlIncludes: 'TODO', method: 'GET' }"},`,
          `  rowHasTexts: ${recordLookup?.rowHasTexts || `[${primaryAccessor}, 'TODO_STABLE_STATE']`},`,
          includeDetailUrl ? `  detailUrl: ${recordLookup?.detailUrl || buildPrimaryDetailUrlTemplate(sharedVariable)},` : '',
          recordLookup?.detailReadyLocator ? `  detailReadyLocator: ${recordLookup.detailReadyLocator},` : '',
        ].filter(Boolean);
        const matchedRecordLines = buildRecordMatchedRecordLines(
          baseName,
          `${baseName}Record`,
          sharedVariable,
          primaryAccessor,
          candidatePaths,
          recordBackedDetailFields.length > 0
        );
        const matchedRecordAccessor = recordBackedDetailFields.length > 0 ? `${baseName}MatchedRecord` : '';
        const detailUrlExpression =
          recordLookup?.detailUrl || (looksLikeIntentStableIdentifierVariable(sharedVariable) ? buildPrimaryDetailUrlTemplate(sharedVariable) : '');
        const rowDetailEntryLines =
          check.recordLookup?.detailEntry?.trigger
            ? buildDetailEntryLines(
                baseName,
                `${baseName}Record.row`,
                check,
                relatedSteps,
                matchedRecordAccessor,
                detailFieldLabels,
                recordLookup?.detailReadyLocator || ''
              )
            : [];
        const implicitRowDetailEntryLines =
          rowDetailEntryLines.length === 0
            ? buildImplicitDetailEntryLines(
                baseName,
                `${baseName}Record.row`,
                check,
                relatedSteps,
                matchedRecordAccessor,
                detailFieldLabels,
                recordLookup?.detailReadyLocator || '',
                detailUrlExpression
              )
            : [];
        const needsRowStatusEvidenceFallback =
          detailFieldLabels.some((label) => /(状态|status|state)/i.test(normalizeText(label))) &&
          rowDetailEntryLines.length === 0;
        const statusEvidenceRecord = buildStatusEvidenceRecordLines(
          baseName,
          `${baseName}Record`,
          resolvePrimaryRecordArgs,
          needsRowStatusEvidenceFallback
        );
        const rowStatusFallbackLines =
          needsRowStatusEvidenceFallback
            ? buildRowStatusFallbackLines(
                baseName,
                `${baseName}Record.row`,
                statusEvidenceRecord.lines,
                statusEvidenceRecord.accessor,
                matchedRecordAccessor,
                relatedSteps,
                check,
                detailFieldLabels,
                sharedVariable,
                primaryAccessor,
                candidatePaths,
                implicitRowDetailEntryLines,
                detailUrlExpression,
                recordLookup?.detailReadyLocator || ''
              )
            : [];

        return [
          ...currentVisibleRowLines,
          `const ${baseName}Record = ${currentVisibleRowIdentifier}`,
          `  ? { primaryValue: ${primaryAccessor}, mode: 'table_row', row: ${currentVisibleRowIdentifier}, response: null }`,
          `  : await __e2e.resolvePrimaryRecord(page, {`,
          ...resolvePrimaryRecordArgs,
          `});`,
          `if (${baseName}Record.mode === 'table_row' && ${baseName}Record.row) {`,
          `  // 这条 row 已由 __e2e.findAntdTableRow / __e2e.resolvePrimaryRecord 按主值命中；不要紧接着再对同一 row locator 重复做 toContainText(primaryValue)。`,
          ...(
            rowDetailEntryLines.length > 0
              ? [...matchedRecordLines, ...rowDetailEntryLines].map((line) => `  ${line}`)
              : rowStatusFallbackLines.length > 0
              ? [...rowStatusFallbackLines].map((line) => `  ${line}`)
              : matchedRecordLines.length > 0
              ? [
                  ...matchedRecordLines,
                  `  // TODO: 若列表行未展示预期字段且列表响应也缺少期望值，不要对空字符串做 toContain；应回退详情页 / 详情抽屉，并抛出明确的字段缺失错误。`,
                ]
              : [`  TODO: 继续在列表行内断言稳定字段，例如 状态 / 联系人。`]
          ),
          `} else if (${baseName}Record.mode === 'detail_url') {`,
          ...matchedRecordLines.map((line) => `  ${line}`),
          ...buildDetailFieldSkeletonLines(
            baseName,
            detailFieldLabels,
            relatedSteps,
            matchedRecordAccessor,
            check
          ).map((line) => `  ${line}`),
          `} else {`,
          ...matchedRecordLines.map((line) => `  ${line}`),
          ...buildNotFoundRecordFallbackLines(
            baseName,
            matchedRecordAccessor,
            relatedSteps,
            check,
            detailFieldLabels
          ).map((line) => `  ${line}`),
          `}`,
        ];
      }

      return [
        `const ${baseName}Row = await __e2e.findAntdTableRow(page, { hasTexts: ['TODO_STABLE_TEXT_1', 'TODO_STABLE_TEXT_2'] });`,
        `await expect(${baseName}Row).toContainText('TODO_EXPECTED_TEXT');`,
      ];
    case 'variable':
      if (!sharedVariable) {
        return ['TODO: 显式校验共享变量已经从真实页面或响应中提取成功。'];
      }

      if (looksLikeIntentStableIdentifierVariable(sharedVariable) && relatedArtifactAccessor) {
        return [
          `const ${baseName}Resp = await ${relatedArtifactAccessor};`,
          `const ${baseName}Payload = await __e2e.readJsonResponse(${baseName}Resp, { required: false });`,
          `const ${baseName}Expected = __e2e.pickJsonValue(${baseName}Payload, { label: '${sharedVariable}', paths: ${renderJsStringArray(candidatePaths)}, required: false });`,
          `if (${baseName}Expected) {`,
          `  expect(${primaryAccessor}).toBeTruthy();`,
          `  expect(${primaryAccessor}).toBe(${baseName}Expected);`,
          `} else {`,
          `  // TODO: 提交响应未返回该稳定标识时，不要在这里硬失败；继续用列表/详情终态验收闭环。`,
          `}`,
        ];
      }

      return [
        looksLikeIntentStableIdentifierVariable(sharedVariable)
          ? `if (${primaryAccessor}) {\n  expect(${primaryAccessor}).toMatch(/\\S+/);\n} else {\n  // TODO: 共享稳定标识允许暂时为空；继续用列表/详情终态验收闭环。\n}`
          : `TODO: 校验 ${primaryAccessor} 的真实来源和值。`,
      ];
    case 'url':
      return [`await expect.poll(() => page.url()).toContain('TODO_URL_FRAGMENT');`];
    case 'modal_state':
      return buildModalStateSkeletonLines(check, relatedSteps);
    case 'ui_state':
    default:
      return [`TODO: 显式校验 ${normalizeText(check.instruction) || '最终 UI 状态'}。`];
  }
}

function shouldInjectAuthPrelude(plan: IntentExecutionPlan, auth?: AuthConfig): boolean {
  if (!auth?.loginUrl?.trim()) return false;
  const firstExecutableStep = plan.steps.find((step) => step.stepType !== 'cleanup');
  return Boolean(firstExecutableStep?.preferredHelpers.includes('__e2e.ensureLoggedIn'));
}

function shouldPreferResponseJsonExtraction(step: IntentExecutionPlanStep): boolean {
  const extractVariable = normalizeText(step.extractVariable);
  if (!extractVariable) return false;

  return (
    step.allowedActions.includes('wait_for_response') ||
    step.preferredHelpers.includes('__e2e.waitForApiResponse') ||
    /(接口|响应|返回|json|payload|response|api)/i.test(
      [step.target, step.goal, ...step.requiredAssertions].filter(Boolean).join('\n')
    ) ||
    looksLikeIntentStableIdentifierVariable(extractVariable)
  );
}

function buildStepInstructions(
  step: IntentExecutionPlanStep,
  priorityScenarioFamily?: IntentE2EPriorityScenarioFamily
): string[] {
  const primarySharedVariable = pickRelatedSharedVariable([step]);
  const businessListPageReadyStep = isBusinessListPageReadyStep(step);
  const businessCreateFormReadyStep = isBusinessCreateFormReadyStep(step);
  const businessCreateFinalSubmitStep = isBusinessCreateFinalSubmitStep(step);
  const renderedGoal = businessListPageReadyStep
    ? buildBusinessListPageReadyGoal()
    : businessCreateFinalSubmitStep
    ? buildBusinessCreateFinalSubmitGoal()
    : businessCreateFormReadyStep
    ? buildBusinessCreateFormReadyGoal()
    : normalizeText(step.goal) || '完成当前步骤';
  const renderedRequiredAssertions = businessListPageReadyStep
    ? buildBusinessListPageReadyRequiredAssertions()
    : businessCreateFinalSubmitStep
    ? buildBusinessCreateFinalSubmitRequiredAssertions()
    : businessCreateFormReadyStep
    ? buildBusinessCreateFormReadyRequiredAssertions()
    : step.requiredAssertions.map((item) => normalizeText(item)).filter(Boolean);
  const instructions: string[] = [
    `当前步骤目标：${renderedGoal}`,
    step.target ? `必要时先进入或切换到目标上下文：${normalizeText(step.target)}` : '',
    `只实现 ${step.planStepUid} 的语义，不要顺手合并后续步骤。`,
    renderedRequiredAssertions.length > 0 ? `本步骤至少要覆盖：${renderedRequiredAssertions.join(' / ')}` : '',
  ];

  if (step.allowedActions.includes('navigate') && step.target) {
    instructions.push('如果当前 URL 或上下文不匹配，可先导航或切换 frame / modal / list context。');
  }
  if (businessListPageReadyStep) {
    instructions.push(
      "页面 ready 阶段不要直接写 `await expect(page.getByText('我创建的').first()).toBeVisible(...)`；如果后续步骤会切“我创建的 / 我跟进的”，把 ownership helper 留给后续步骤。"
    );
    instructions.push(
      "本步只确认商机列表 surface 已可交互：优先看 `page.getByRole('button', { name: '新建商机' }).first()`、`page.locator('input#businessList_keywords:visible').first()` 或列表容器，不要把归属标签裸文本可见性当作成功标准。"
    );
  }
  if (businessCreateFormReadyStep) {
    instructions.push(
      "创建页第一页 ready 阶段不要写 `await expect(contactStepHeading.or(sourceLabel)).toBeVisible(...)`；Playwright strict mode 在两个锚点同时可见时会直接失败。"
    );
    instructions.push(
      "更稳的写法是先选一个主锚点，例如 `const contactStepHeading = page.getByRole('heading', { name: '商机联系人信息' }).first()`；若它可见就直接断言它，否则再单独断言 `const sourceLabel = page.locator('label[title=\"商机来源\"]').first()` 或第一页联系人/手机号字段。需要回退时可先 `const headingVisible = await contactStepHeading.isVisible().catch(() => false);`，再按顺序分支，不要把多个 locator 合成一个 union locator。"
    );
    instructions.push(
      '只要当前步骤目标是“确认已进入第一页”，单一稳定锚点就足够；不要因为页面上多个锚点都可见，就连续把它们全部写成必须同时成立的 `toBeVisible()` 硬条件。'
    );
  }
  if (businessCreateFinalSubmitStep) {
    instructions.push(
      '进入最终提交前，先用 `附件信息 / 上传录音文件 / 上传图片` 这些末页锚点确认已经到最后一步；不要在第二页看到第二个 `保存并继续` 后就直接开始全页找最终按钮。'
    );
    instructions.push(
      "最终按钮查找不要直接退化成 `page.getByRole('button', { name: /^(?!.*保存并继续)(?!.*上一步).*(保\\s*存|提\\s*交|确\\s*定).*$/i }).last()`；这类整页 regex + `.last()` 很容易盲等到超时。"
    );
    instructions.push(
      "更稳的骨架是先 `const attachmentAnchor = page.getByText(/附件信息|上传录音文件|上传图片/).first(); await expect(attachmentAnchor).toBeVisible({ timeout: 20000 });`，再准备少量 `candidateContainers`：至少包含 `attachmentAnchor` 的前 3-4 层可见祖先链，以及 `.ant-modal-footer:visible` / `.ant-drawer-footer:visible` / `[class*=\"footer\"]:visible` / `[class*=\"action\"]:visible` 这类可见 footer/action-bar 容器。footer/action-bar 这类 selector 不要统一写成 `.first()`；每类 selector 至少枚举前 2-3 个可见命中，依次 push 进 `candidateContainers`。`attachmentAnchor` 刚 visible 时底部 action bar 可能还在异步挂载，不要只跑一轮 `count()` 就立刻 throw；给这轮 scoped candidate scan + exact submit fallback 一个短时轮询窗口（例如 3-5 秒、每 200ms 重试一次），窗口内一旦命中就停下。命中后再 `scrollIntoViewIfNeeded()` / `click({ force: true })`。如果轮询窗口内这些 scoped container 都 miss，但 `attachmentAnchor` 已经确认可见，只允许再补一层更窄的 page-level exact submit fallback，例如 `page.getByRole('button', { name: /^提\\s*交$/ }).first()`；不要重新放宽成整页 `/保\\s*存|提\\s*交|确\\s*定/` regex + `.last()`。"
    );
    instructions.push(
      "不要只尝试一个 `attachmentAnchor.locator('xpath=ancestor::*[...] [1]')`、再加 tabpane/form/modal/drawer 这几个固定容器后就直接 throw；末页最终按钮很可能挂在 tabpane 外的底部 action bar，也可能比末页锚点晚一个 tick 才挂出来。只有祖先链、多命中的可见 footer/action-bar 容器，以及这个更窄的 exact submit fallback 在短时轮询窗口里都扫描过且仍未命中时，才允许抛 `未在末页容器内找到最终提交按钮`。"
    );
  }
  if (step.preferredHelpers.includes('__e2e.ensureLoggedIn')) {
    instructions.push('默认登录预处理会在测试开头完成；除非当前步骤再次进入认证流程，否则不要手写第二套登录逻辑。');
  }
  if (step.preferredHelpers.includes('__e2e.waitForApiResponse')) {
    instructions.push(
      `点击主动作前先注册 __e2e.waitForApiResponse(page, { urlIncludes: 'TODO', method: 'POST' })，并把响应结果保存到 ${toArtifactsAccessor(step.planStepUid)}。`
    );
  }
  if (shouldPreferResponseJsonExtraction(step)) {
    const candidatePaths = buildIntentSharedVariableJsonPaths(step.extractVariable);
    instructions.push(
      `如果要提取 ${step.extractVariable}，优先从接口响应读取：const payload = await __e2e.readJsonResponse(await RESPONSE_PROMISE); const value = __e2e.pickJsonValue(payload, { label: '${step.extractVariable}', paths: ${renderJsStringArray(candidatePaths)} });`
    );
  }
  if (step.preferredHelpers.includes('__e2e.observeSubmitState')) {
    instructions.push(
      `接口成功后优先调用 __e2e.observeSubmitState(page, { submitButton, closeTitleIncludes / closeLocator / successLocator / urlIncludes })，不要只看 toast。`
    );
    instructions.push('中间步骤的“保存并继续 / 下一步”如果只是向导切换且接口名不明确，不要发明宽泛的 /business POST 等待；优先点击后等待下一块表单标题、字段或步骤锚点出现。');
    instructions.push('如果提交后“可能自动回列表，也可能仍停留当前页”，把 urlIncludes 只当辅助观察；helper 结束后仍要检查 page.url()，不在目标列表页时再显式回退导航。');
    instructions.push('如果这是多步表单 / Ant Tabs 最后一页的“保存 / 提交”，不要直接对 page 全局 getByRole(...).first()，也不要把最终主动作固化成 `getByRole(\'button\', { name: /^保\\s*存$/ }).first()`；先收窄到当前可见步骤容器（如 `.ant-tabs-tabpane-active` / 当前 modal / drawer / form block），先尝试定位 `/保\\s*存|提\\s*交|确\\s*定/i` 的最后一个主动作；如果当前 pane 内根本找不到这个最终主动作，不要立刻退化成整页 `page.getByRole(...).last()`，而是改成准备少量 `candidateContainers`，至少覆盖末页锚点附近容器、`attachmentAnchor` 祖先链、当前可见 tabpane / form，以及可见 footer/action-bar 容器，并继续排除 `保存并继续` / `上一步`；若 `attachmentAnchor` 已可见且这些 scoped 容器都 miss，只允许额外尝试一次 `page.getByRole(\'button\', { name: /^提\\s*交$/ }).first()` 这种更窄的 page-level exact submit fallback，不要重新放宽成整页 regex + `.last()`；不要把 selector 锁死在 `.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible` 这类单一路径；命中后再按需 scrollIntoViewIfNeeded()。');
    instructions.push('若已收窄到当前可见容器内的提交按钮，点击仍报 subtree intercepts pointer events / pointer events 被标题或 section-head 拦截，可对该 scoped submitButton 使用 click({ force: true })；不要对整页模糊按钮直接 force click，也不要把 `保存并继续` / `上一步` 误当成最终提交。');
  }
  if (step.preferredHelpers.includes('__e2e.selectAntdOption')) {
    instructions.push('下拉/树选择优先用 __e2e.selectAntdOption(...)，不要直接全局 page.getByText(...) 点击枚举值。');
    instructions.push('如果当前字段可见上其实是 row 内 radio / segmented / tab 风格枚举，也继续优先用 __e2e.selectAntdOption(...)；不要先假定必须打开 dropdown。');
  }
  if (step.preferredHelpers.includes('__e2e.openAntdDropdown')) {
    instructions.push('如果需要分步打开下拉，优先用 __e2e.openAntdDropdown(page, sourceRow, { settleMs: 300 })。');
  }
  if (step.preferredHelpers.includes('__e2e.waitForVisibleAntdModal')) {
    instructions.push("需要弹层时优先用 __e2e.waitForVisibleAntdModal(page, { titleIncludes: '稳定标题片段' })。");
  }
  if (step.preferredHelpers.includes('__e2e.readDetailField')) {
    instructions.push(
      "详情页 / 详情抽屉字段校验优先用 __e2e.readDetailField(page, { label: '联系人', scope?, titleIncludes?, required: false })，不要退回整页大段文本 toContain。"
    );
  }
  if (step.preferredHelpers.includes('__e2e.findAntdTableRow')) {
    instructions.push(
      "表格目标行优先用 __e2e.findAntdTableRow(page, { hasTexts: ['稳定标识', '联系人/手机号'] })，至少传两个稳定身份文本；状态只在可见时再断言，不要默认把它写成唯一匹配前提。"
    );
  }
  if (
    primarySharedVariable &&
    looksLikeIntentStableIdentifierVariable(primarySharedVariable) &&
    step.preferredHelpers.includes('__e2e.findAntdTableRow')
  ) {
    instructions.push(
      `如果 ${primarySharedVariable} 已经作为共享稳定标识从响应里真实提取，优先写 const currentVisibleRow = ${toSharedAccessor(primarySharedVariable)} ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [${toSharedAccessor(primarySharedVariable)}], timeoutMs: 1200 }); } catch { return null; } })() : null; const recordCheck = currentVisibleRow ? { primaryValue: ${toSharedAccessor(primarySharedVariable)}, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue: ${toSharedAccessor(primarySharedVariable)}, listResponse, rowHasTexts: [${toSharedAccessor(primarySharedVariable)}, '辅助身份字段'], detailUrl }); 若列表检索控件已知，再显式补 keywordInput/searchButton；未知时可先省略，让 helper 自动探测可见搜索框和搜索按钮。一旦把 keywordInput/searchButton 传给 helper，就不要在同一分支先手写 keywordInput.fill(...) + searchButton.click() 再让 helper 重复搜索；helper 会自己负责检索，双重搜索很容易触发重复列表刷新或页面脚本异常。对于“提交后回列表验收”这类场景，先短超时检查当前可见列表是否已经出现目标行，不要看到搜索框就立刻填值搜索；只有当前列表未命中时，才让 helper 保守做列表收敛轮询（例如传 maxLookupAttempts / retryIntervalMs）。列表命中后先把该行当作目标记录已命中的身份证据；如果预期状态没有出现在同一行可见文本 / 状态单元格，不要在这里硬失败，优先改读列表响应或详情字段。若 currentVisibleRow 已命中但后面还需要状态证据，而 recordCheck.response 会是 null，不要直接退化成开详情读裸状态字段；先补一跳只为拿结构化列表响应（例如 statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue: ${toSharedAccessor(primarySharedVariable)}, listResponse, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck），再从 statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...) 读取状态。未命中则直接回退详情页 / 详情抽屉，并优先用 __e2e.readDetailField(...) 做字段验收。`
    );
    instructions.push(
      `如果 \`currentVisibleRow\` / \`recordCheck.row\` 已经由 helper 命中，不要紧接着再写 \`await expect(recordCheck.row).toContainText(primaryValue)\` 或 \`await expect(currentVisibleRow).toContainText(primaryValue)\` 去证明同一个身份；helper 命中本身已经是身份证据，这类重复断言很容易重新落回 \`locator(...).nth(...)\` 行漂移。若还需要行内可见文本，只做一次 \`const rowText = await recordCheck.row.innerText().catch(() => '')\` 的保守读取。`
    );
    instructions.push(
      `如果这次 \`rowText\` 已经直接包含预期业务状态（例如“新入库”），也只能把它当作辅助线索，不要再把裸 \`rowText\` 当最终成功条件。优先继续补同一条结构化列表记录（\`statusEvidenceRecordCheck -> __e2e.readJsonResponse(...) -> __e2e.pickJsonRecord(...)\`）或详情字段；\`rowText\` 只用于辅助派生 \`derivedBusinessId\` / \`detailUrl\`。`
    );
    instructions.push(
      `若 recordCheck.response 可用，优先继续用 __e2e.readJsonResponse(recordCheck.response, { required: false }) + __e2e.pickJsonRecord(...) 找到命中的列表记录，再为详情字段生成 expected value。若行文本里缺少状态，优先用 matchedRecord 里的状态字段做断言；列表 JSON 仍拿不到状态时，再走 detailUrl / detailEntry + __e2e.readDetailField(...)。如果最终状态 / 详情字段仍为空，不要写 expect(statusText || '').toContain(...) 这类空串断言；应抛出明确的“状态/详情字段证据缺失”错误。`
    );
    instructions.push(
      `如果你开始写 \`throw new Error('状态证据缺失：列表行已命中，但列表响应未返回状态')\`，说明还缺 \`statusEvidenceRecordCheck\` 或 \`recordCheck.row -> 查看 -> 商机详情 -> readDetailField('状态')\` 这条 fallback；这条 throw 不能作为首选分支。`
    );
    instructions.push(
      `若 \`statusEvidenceRecordCheck.response\` 已返回、但此时 ${toSharedAccessor(primarySharedVariable)} 仍为空，或者 \`matchedRecord\` 仍按 ${toSharedAccessor(primarySharedVariable)} 未命中，不要继续沿用手机号/联系人直接停在“列表响应未返回状态”。对商机列表这类 family，先在已命中分支里补 \`const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()\`，再用当前 \`rowText\` 保守派生 \`const derivedBusinessId = ${toSharedAccessor(primarySharedVariable)} || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item)) || '')\`，随后优先写 \`const matchedRecordByDerivedBusinessId = !matchedRecord && listJson && derivedBusinessId ? __e2e.pickJsonRecord(listJson, { label: 'derivedBusinessId', value: derivedBusinessId, paths: ['businessId', 'id'], required: false }) : null;\`，并把 \`matchedRecord || matchedRecordByDerivedBusinessId\` 当成状态来源；只有这条结构化回填仍为空时，才继续 detailUrl / detailEntry fallback。`
    );
    instructions.push(
      `即使 ${toSharedAccessor(primarySharedVariable)} 暂时为空，只要 recordCheck.row 已命中且当前链路已经明确给出 detailEntry / 已知动作标签（如“查看”）/ 详情标题 / detailReadyLocator，也不要写 else if (${toSharedAccessor(primarySharedVariable)}) { await page.goto(...) } else { throw ... }；这时可直接对 recordCheck.row 走 __e2e.clickAntdRowAction(page, recordCheck.row, '查看')。若 detailEntry.target=drawer_or_modal 且详情标题已知，先写 let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false }); if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); } if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页')；再读状态。`
    );
    instructions.push(
      `更具体地，只有当当前链路已经明确给出 detailEntry / 已知动作标签（如“查看”）/ 详情标题时，才可写：await __e2e.clickAntdRowAction(page, recordCheck.row, '查看')；let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false }); if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); } if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页')；const statusText = await __e2e.readDetailField(page, { label: '商机进展', scope: detailScope, titleIncludes: '商机详情', required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailScope, titleIncludes: '商机详情', required: false })。若 ${toSharedAccessor(primarySharedVariable)} 非空，可优先走 detailUrl；若 ${toSharedAccessor(primarySharedVariable)} 为空且当前页面没有明确详情入口，不要臆造“查看”，而应抛出“状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口”。`
    );
    instructions.push(
      `不要凭空假定每条列表行都存在“查看”动作；只有当前链路已经明确给出 detailEntry / actionLabel / 详情标题 / detailReadyLocator 时，才允许走 row action fallback。`
    );
    instructions.push(
      `如果 recordCheck.mode === 'not_found'，且当前链路没有可用的详情回退路径，不要凭空写 const detailScope = page.locator('.ant-drawer-content:visible, .ant-modal-content:visible').last() 再去 readDetailField(...)；应先继续复用 recordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...)，仍没有命中记录 / 状态时，直接抛出“未命中目标记录：列表未命中，且没有可用的详情回退路径”这类错误。`
    );
  }
  if (
    primarySharedVariable &&
    !looksLikeIntentStableIdentifierVariable(primarySharedVariable) &&
    step.preferredHelpers.includes('__e2e.resolvePrimaryRecord')
  ) {
    instructions.push(
      `如果当前共享变量 ${primarySharedVariable} 只是手机号/联系人这类 fallback 标识，也优先写 const currentVisibleRow = ${toSharedAccessor(primarySharedVariable)} ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [${toSharedAccessor(primarySharedVariable)}], timeoutMs: 1200 }); } catch { return null; } })() : null; const recordCheck = currentVisibleRow ? { primaryValue: ${toSharedAccessor(primarySharedVariable)}, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue: ${toSharedAccessor(primarySharedVariable)}, listResponse, rowHasTexts: [${toSharedAccessor(primarySharedVariable)}] }); 先短超时检查当前可见列表是否已经收敛，不要看到搜索框就立刻填值；只有当前列表未命中时，才让 helper 保守轮询列表收敛。一旦把 keywordInput/searchButton 传给 helper，就不要再先手写 keywordInput.fill(...) + searchButton.click() 做预搜索；让 helper 独占这次检索，避免双重刷新。若 currentVisibleRow 已命中但 recordCheck.response 为 null，而后面还需要状态证据，不要直接开详情读裸状态字段；先补一跳只为拿结构化列表响应（例如 maxLookupAttempts: 1、retryIntervalMs: 200），再从 statusEvidenceRecordCheck.response 读取状态。只有 helper 明确返回 not_found 且没有 detailUrl / detailEntry 时，才退回 __e2e.findAntdTableRow(...)。不要为 ${primarySharedVariable} 合成假的 detailUrl。`
    );
    instructions.push(
      `如果 \`currentVisibleRow\` / \`recordCheck.row\` 已经由 helper 命中，不要再补 \`await expect(recordCheck.row).toContainText(${toSharedAccessor(primarySharedVariable)})\` 这类重复身份断言；helper 命中本身已经足够。若还需要可见文本，改成一次性的 \`innerText().catch(() => '')\` 读取，并在拿到列表响应 / 详情证据时优先继续走结构化链。`
    );
    instructions.push(
      `如果当前 \`rowText\` 已经直出预期业务状态（例如“新入库”），也不要直接把裸 \`rowText\` 当作最终状态证据。优先继续读取 \`statusEvidenceRecordCheck.response -> listJson -> matchedRecord\`；若结构化列表记录仍拿不到状态，再走详情页 / 详情抽屉字段回退。`
    );
    instructions.push(
      `如果 row 已命中、\`statusEvidenceRecordCheck.response\` 也已返回，但 \`matchedRecord\` 仍按 ${toSharedAccessor(primarySharedVariable)} 未命中，不要直接停在“列表响应未返回状态”。对商机列表这类 family，先在已命中分支里补 \`const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()\`，再用当前 \`rowText\` 保守派生 \`const derivedBusinessId = ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item)) || '')\`，随后优先写 \`const matchedRecordByDerivedBusinessId = !matchedRecord && listJson && derivedBusinessId ? __e2e.pickJsonRecord(listJson, { label: 'derivedBusinessId', value: derivedBusinessId, paths: ['businessId', 'id'], required: false }) : null;\`，并把 \`matchedRecord || matchedRecordByDerivedBusinessId\` 当成状态来源；只有这条结构化回填仍为空时，才继续 detailUrl / detailEntry fallback。`
    );
    instructions.push(
      `如果你开始写 \`throw new Error('状态证据缺失：列表行已命中，但列表响应未返回状态')\`，不要直接结束；先补一跳 \`statusEvidenceRecordCheck\` 去拿结构化列表响应。只有当前链路已经明确给出 \`detailEntry / actionLabel / 详情标题 / detailReadyLocator\` 时，才允许再对 \`recordCheck.row\` 走 \`查看 -> waitForVisibleAntdModal(required:false) -> waitForVisibleDetailSurface(required:false) -> readDetailField('商机进展'/'状态')\`；否则不要臆造行操作。`
    );
    instructions.push(
      `不要在 row 已命中时直接抛“无法从列表响应或详情获取状态”；必须先判断当前链路是否真的提供了详情入口，没有的话就保留 row 身份证据并按“未提供详情入口”报错。`
    );
    instructions.push(
      `如果 \`statusEvidenceRecordCheck.response\` 已返回、但 \`matchedRecord\` 仍未命中，而当前链路也没有明确 \`detailEntry / actionLabel / 详情标题 / detailReadyLocator\`，不要臆造 \`await __e2e.clickAntdRowAction(page, recordCheck.row, '查看')\`；若 ${toSharedAccessor(primarySharedVariable)} 非空可走 detailUrl，否则直接抛出“状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口”。`
    );
    instructions.push(
      `如果 fallback helper 最终返回 not_found，且没有稳定 detailUrl / detailEntry，不要直接裸读详情字段；优先继续复用 recordCheck.response 里的列表 JSON 证据。列表响应仍未命中目标记录时，直接抛出“未命中目标记录：列表未命中，且没有可用的详情回退路径”，不要伪造详情容器。`
    );
  }
  if (step.preferredHelpers.includes('__e2e.clickAntdRowAction')) {
    instructions.push("先稳定拿到 targetRow，再用 __e2e.clickAntdRowAction(page, targetRow, '动作名')。");
  }
  if (step.preferredHelpers.includes('__e2e.switchBusinessListOwnershipView')) {
    instructions.push("列表归属切换优先用 __e2e.switchBusinessListOwnershipView(page, { label: '我创建的', listUrl: TARGET_URL })。");
    instructions.push('如果当前还没真正回到商机列表，不要直接开始找“我创建的”控件；先显式回列表，再调用 helper 切换归属视角。');
    instructions.push('helper 已处理“当前已经是目标视角”和切换后的 settle；默认直接 await __e2e.switchBusinessListOwnershipView(...)，不要在外层无条件包 waitForApiResponse / waitForResponse。');
    instructions.push('不要写 const listResp = __e2e.waitForApiResponse(...); await __e2e.switchBusinessListOwnershipView(...); await listResp; 这种固定链；如果当前本来就是目标视角，helper 会直接返回，不会再触发新的 GET，这条等待会超时。');
    instructions.push(
      'helper 返回后不要再补 .ant-tabs-tab-active / .ant-radio-button-wrapper-checked / .ant-select-selection-selected-value 或整页 getByText(\'我创建的\') 这类 active-locator 断言；helper 成功本身就足够。'
    );
    instructions.push('如需辅助收敛，只允许检查当前 URL 已回列表、可见搜索框或列表 ready，然后直接进入后续搜索 / 回查。');
    instructions.push('如果切换后马上要做列表回查，不要看到可见搜索框就立刻填关键词；先短超时检查当前可见列表是否已经出现主键 / 手机号对应记录，只有当前列表未命中时再触发关键词搜索。');
    instructions.push('如果后续 assert / verification 已经会用 `__e2e.resolvePrimaryRecord(...)` 做回查，当前步骤不要再额外手写 `keywordInput.fill(...) + searchButton.click()`；把这一步收口成视角切换 + 列表 ready，让唯一一次检索留给后续 helper，或只复用已经缓存的 artifacts 响应。');
    instructions.push('只有脚本已经先确认当前不是目标视角、且这次切换请求本身就是必须消费的证据时，才允许在 helper 前注册 wait promise；更稳妥的是把后续搜索/回查接口当成最终列表证据。');
  }
  if (step.preferredHelpers.includes('__e2e.getFrame')) {
    instructions.push("如果控件在 iframe 中，优先用 __e2e.getFrame(page, { selector, urlIncludes, nameIncludes }) 进入真实业务 frame。");
  }
  if (step.extractVariable) {
    instructions.push(`必须把真实提取结果写入 ${toSharedAccessor(step.extractVariable)}，禁止编造或用随机值代替。`);
  }
  if (primarySharedVariable && looksLikeIntentStableIdentifierVariable(primarySharedVariable)) {
    instructions.push(
      `如果 ${primarySharedVariable} 暂时为空，不要立刻写 expect(${toSharedAccessor(primarySharedVariable)}).toBeTruthy()；优先继续用已知手机号/联系人/状态等稳定文本完成列表/详情终态验收。对“创建后回列表”这类收敛链，优先直接把手机号这类唯一文本继续传给 __e2e.resolvePrimaryRecord(...)（例如 primaryValue=手机号、rowHasTexts=[手机号]），让 helper 先轮询列表收敛；只有非空时再走主键 detailUrl 链。`
    );
    instructions.push(
      `当 ${primarySharedVariable} 为空、fallback 主值改用手机号时，rowHasTexts 默认只放手机号；不要再把联系人名拼回默认 rowHasTexts，否则联系人列未渲染时会把本可命中的记录误判成 not_found。联系人名只在命中行文本里确实出现时再断言。`
    );
  }

  instructions.push(...buildPriorityScenarioFamilyStepHints(step, priorityScenarioFamily));

  return uniqueStrings(instructions);
}

function buildVerificationHint(check: IntentVerificationPlanCheck, relatedSteps: IntentExecutionPlanStep[]): string {
  const sharedVariable = pickCheckStableIdentifier(check, relatedSteps);
  const candidatePaths = sharedVariable
    ? uniqueStrings([...pickCheckPreferredPaths(check, sharedVariable), ...buildIntentSharedVariableJsonPaths(sharedVariable)])
    : [];
  const detailFieldLabels = buildDefaultDetailFieldLabels(inferDetailFieldLabels(check, relatedSteps), sharedVariable);
  const detailFieldSummary = detailFieldLabels.join(' / ');
  const fallbackDerivedBusinessIdHint =
    sharedVariable && !looksLikeIntentStableIdentifierVariable(sharedVariable)
      ? ` 若 row 已命中、列表响应也已返回，但 \`matchedRecord\` 仍按 ${toSharedAccessor(sharedVariable)} 未命中，不要直接抛“状态证据缺失”；对商机列表这类 family，先用 \`rowKey / rowText\` 保守派生 \`derivedBusinessId\`，再优先补 \`matchedRecordByDerivedBusinessId = !matchedRecord && listJson && derivedBusinessId ? __e2e.pickJsonRecord(listJson, { label: 'derivedBusinessId', value: derivedBusinessId, paths: ['businessId', 'id'], required: false }) : null\`，并把 \`matchedRecord || matchedRecordByDerivedBusinessId\` 当成状态来源。`
      : '';
  const helperParamSummary = [
    check.recordLookup ? `recordLookup=${renderCheckRecordLookup(check, sharedVariable || '').detailUrl ? 'configured' : 'partial'}` : '',
    check.detailSurface ? `detailSurface=${renderCheckDetailSurface(check)}` : '',
  ]
    .filter(Boolean)
    .join('；');
  const relatedArtifactAccessors = uniqueStrings(relatedSteps.map((step) => toArtifactsAccessor(step.planStepUid)));
  const relatedArtifactReuseHint =
    relatedArtifactAccessors.length > 0
      ? ` 若 ${relatedArtifactAccessors.join(' / ')} 已写入 recordCheck / status / source，verification 先直接复用这些产物；只有它们缺少结构化状态证据，或当前页面已离开原列表/详情上下文时，才补一次 __e2e.resolvePrimaryRecord(...) / __e2e.readDetailField(...)。`
      : '';

  switch (check.kind) {
    case 'response':
      return relatedSteps.length > 0
        ? `优先复用 ${relatedSteps.map((step) => toArtifactsAccessor(step.planStepUid)).join(' / ')} 里的 response/json 做断言。`
        : '优先断言关键接口响应成功，不要只看模糊成功文案。';
    case 'table_row':
      return sharedVariable && shouldPreferResolvePrimaryRecord(check, relatedSteps, sharedVariable)
        ? `优先用 ${toSharedAccessor(sharedVariable)} 这个共享稳定标识/唯一身份文本回查目标记录。对于“提交后回列表验收”这类收敛场景，不要看到搜索框就立刻填值；先短超时用 __e2e.findAntdTableRow(page, { hasTexts: [${toSharedAccessor(sharedVariable)}], timeoutMs: 1200 }) 检查当前可见列表是否已经命中，只有当前列表未命中时，才调用 __e2e.resolvePrimaryRecord(...) 触发关键词搜索。若已知列表检索控件，再显式传 keywordInput/searchButton；未知时优先省略，让 helper 自动探测。只要已经把 keywordInput/searchButton 传给 helper，就不要在外层再手写一次 fill + click 预搜索，否则很容易触发双重刷新。如果本步只是为了最终拿到 targetRow / 复用已缓存的 row 或 response，不要再手写 \`const searchResp = __e2e.waitForApiResponse(...); await keywordInput.fill(primaryValue); await searchButton.click(); await searchResp;\` 这种“额外列表 GET 必须命中”的硬链；当前列表可能已经收敛，额外搜索也未必会再次发请求。进入 helper 后再让它保守轮询几次列表结果（例如 maxLookupAttempts / retryIntervalMs），不要手写一次 search 后立刻失败。若列表命中，先把目标行当作已命中的身份凭证；不要紧接着再写 \`await expect(recordCheck.row).toContainText(primaryValue)\` 或 \`await expect(currentVisibleRow).toContainText(primaryValue)\` 去证明同一个身份，这类重复断言很容易把表格行重新打回 \`locator(...).nth(...)\` 漂移。若还需要行内文本，只做一次 \`row.innerText().catch(() => '')\` 的保守读取。若预期状态没有出现在该行可见文本 / 状态单元格，不要直接判死，而要优先读取 recordCheck.response -> __e2e.pickJsonRecord(...) -> 状态字段，再在必要时回退详情页 / 详情抽屉用 __e2e.readDetailField(...) 逐项校验 ${detailFieldSummary}。${relatedArtifactReuseHint}如果当前共享变量只是手机号/联系人这类 fallback 标识，不要额外合成假的 detailUrl；优先把它当作列表收敛主键，只有 detailUrl / detailEntry 已真实存在时再启用详情回退。${fallbackDerivedBusinessIdHint}${helperParamSummary ? ` 当前已结构化 helper 参数：${helperParamSummary}。` : ''}`
        : sharedVariable
        ? `若已提取共享变量，优先按 ${sharedVariable} 缩小检索范围，再用 __e2e.findAntdTableRow(...) 定位结果行。`
        : '优先先缩小检索范围，再用 __e2e.findAntdTableRow(...) 做最终列表验收。';
    case 'url':
      return '显式校验最终 URL / hash，必要时使用 waitForURL 或 expect.poll(() => page.url())。';
    case 'modal_state':
      return inferModalStateExpectation(check, relatedSteps) === 'closed'
        ? `显式断言对应 modal / drawer 已关闭${pickModalStateTitleIncludes(check) ? `（titleIncludes=${pickModalStateTitleIncludes(check)}）` : ''}；若这是提交后收敛链，动作步骤里优先调用 __e2e.observeSubmitState(...)，最终验收至少补关闭断言。`
        : `显式断言对应 modal / drawer 已打开${pickModalStateTitleIncludes(check) ? `（titleIncludes=${pickModalStateTitleIncludes(check)}）` : ''}；若标题已知，优先用 __e2e.waitForVisibleAntdModal(...)。`;
    case 'variable':
      return sharedVariable
        ? looksLikeIntentStableIdentifierVariable(sharedVariable)
          ? `至少显式校验 ${toSharedAccessor(sharedVariable)} 这个共享稳定标识已被真实写入；若来源是接口，优先用 __e2e.readJsonResponse(...) + __e2e.pickJsonValue(... paths=${renderJsStringArray(candidatePaths)}) 提取，并继续传给 __e2e.resolvePrimaryRecord(...) 做列表/详情双路验收。如果接口没有返回该稳定标识，不要只写 toBeTruthy() 直接判死，而要继续让列表/详情终态验收闭环。`
          : `至少显式校验 ${toSharedAccessor(sharedVariable)} 已被真实写入。`
        : '显式校验共享变量已经从真实页面或响应中提取成功。';
    case 'ui_state':
    default:
      return '优先断言稳定的 heading / label / state / 结果容器，不要退化成宽泛真值断言。';
  }
}

function buildVerificationInstructions(
  plan: IntentExecutionPlan,
  verificationPlan?: IntentVerificationPlan,
  priorityScenarioFamily?: IntentE2EPriorityScenarioFamily
): string[] {
  if (!verificationPlan?.checks.length) {
    return ['必须显式完成最终业务验收，不要把验证逻辑省略成空实现。'];
  }

  const stepByUid = new Map(plan.steps.map((step) => [step.planStepUid, step]));
  const lines: string[] = [
    verificationPlan.expectedOutcome ? `最终业务结果：${normalizeText(verificationPlan.expectedOutcome)}` : '',
    verificationPlan.intent === 'review' ? '当前验收意图：保守复核。优先确认既有 helper、selector、断言与入口是否仍稳定可复用。' : '',
    ...(verificationPlan.policyNotes || []).map((item) =>
      `${verificationPlan.intent === 'review' ? '复核约束' : '验收约束'}：${normalizeText(item)}`
    ),
    '这里只补最终验收，不要把前面步骤的主动作重新执行一遍。',
    ...buildVerificationArtifactReuseHints(plan, verificationPlan),
    ...buildPriorityScenarioFamilyVerificationHints(priorityScenarioFamily),
  ];

  for (const check of verificationPlan.checks) {
    const relatedSteps = check.relatedPlanStepUids
      .map((uid) => stepByUid.get(uid))
      .filter((step): step is IntentExecutionPlanStep => Boolean(step));
    const recordLookupSummary = check.recordLookup
      ? renderCheckRecordLookup(check, pickCheckStableIdentifier(check, relatedSteps) || '')
      : null;

    lines.push(
      `检查项 [${check.kind}] ${normalizeText(check.title)}：${normalizeText(check.instruction)}`,
      relatedSteps.length > 0
        ? `关联步骤：${relatedSteps.map((step) => `${step.planStepUid} ${normalizeText(step.title)}`).join(' / ')}`
        : '',
      relatedSteps.some((step) => step.preferredHelpers.includes('__e2e.switchBusinessListOwnershipView'))
        ? '如果最终验收前需要切“我创建的 / 我跟进的”，默认直接 await __e2e.switchBusinessListOwnershipView(...)。helper 已处理“当前已是目标视角”和切换后 settle；禁止无条件再包一层 waitForApiResponse / waitForResponse 等新的列表 GET。'
        : '',
      (check.stableIdentifiers || []).length > 0 ? `结构化稳定标识：${(check.stableIdentifiers || []).join(' / ')}` : '',
      (check.expectedFields || []).length > 0 ? `结构化详情字段：${(check.expectedFields || []).join(' / ')}` : '',
      (check.fieldPathHints || []).length > 0 ? `结构化字段路径：${renderCheckFieldPathHints(check)}` : '',
      (check.fieldSpecs || []).length > 0 ? `结构化字段规格：${renderCheckFieldSpecs(check)}` : '',
      check.recordLookup
        ? `结构化回查参数：listResponse=${check.recordLookup.listResponse ? `${check.recordLookup.listResponse.method || ''} ${check.recordLookup.listResponse.urlIncludes || ''}`.trim() : '无'}；detailUrl=${normalizeKnownHashRouteDetailUrlTemplate(check.recordLookup.detailUrl || '') || '无'}；rowHasTexts=${(check.recordLookup.rowHasTexts || []).join(' / ') || '无'}${recordLookupSummary?.searchSurface ? `；searchSurface=${recordLookupSummary.searchSurface}` : ''}${recordLookupSummary?.tableScopeSummary ? `；tableScope=${recordLookupSummary.tableScopeSummary}` : ''}${recordLookupSummary?.detailReadyLocatorSummary ? `；detailReadyLocator=${recordLookupSummary.detailReadyLocatorSummary}` : ''}${recordLookupSummary?.detailEntrySummary ? `；detailEntry=${recordLookupSummary.detailEntrySummary}` : ''}`
        : '',
      check.detailSurface ? `结构化详情面：${renderCheckDetailSurface(check)}` : '',
      buildVerificationHint(check, relatedSteps),
      `固定骨架 [${check.checkUid}]：`,
      ...buildVerificationSkeletonLines(check, relatedSteps)
    );
  }

  return uniqueStrings(lines);
}

export function compileIntentExecutionTemplate(input: CompileIntentExecutionTemplateInput): IntentCompiledExecutionTemplate {
  const plan = input.executionPlan;
  const sharedVariables = buildSharedVariables(plan);
  const useAuthPrelude = shouldInjectAuthPrelude(plan, input.auth);
  const testTitle = sanitizeTestTitle(input.description || plan.summary || plan.expectedOutcome || plan.entryUrl);
  const slots: IntentExecutionTemplateSlot[] = [];
  const lines: string[] = [];

  lines.push(`test(${JSON.stringify(testTitle)}, async ({ page }) => {`);

  if (plan.entryUrl) {
    lines.push(`  const TARGET_URL = ${JSON.stringify(plan.entryUrl)};`);
  }

  if (sharedVariables.length > 0) {
    lines.push('  const shared = {');
    for (const variable of sharedVariables) {
      lines.push(`    ${JSON.stringify(variable)}: '',`);
    }
    lines.push('  };');
  } else {
    lines.push('  const shared = {};');
  }

  lines.push('  const artifacts = Object.create(null);');
  lines.push('');
  lines.push('  // shared 只存跨步骤业务变量；artifacts 用于复用响应、定位结果和中间观察数据。');

  if (useAuthPrelude) {
    lines.push("  test.skip(!process.env.E2E_USERNAME || !process.env.E2E_PASSWORD, '缺少 E2E_USERNAME / E2E_PASSWORD');");
    lines.push('  await __e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL });');
  } else if (plan.entryUrl) {
    lines.push("  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });");
  }

  const planSteps = plan.steps.length > 0 ? plan.steps : [
    {
      planStepUid: 'plan_step_1',
      scenarioStepUid: '',
      stepType: 'ui' as const,
      title: '完成业务主链路',
      target: plan.entryUrl,
      goal: plan.summary || plan.expectedOutcome || '完成主要业务步骤',
      allowedActions: ['navigate', 'scope', 'locate', 'fill', 'click', 'wait_for_ui', 'assert_visible'],
      preferredHelpers: [],
      requiredAssertions: plan.expectedOutcome ? [plan.expectedOutcome] : [],
      extractVariable: '',
      sharedVariables,
      dependsOnPlanStepUids: [],
    },
  ];

  for (const [index, step] of planSteps.entries()) {
    const slotUid = step.planStepUid;
    const instructions = buildStepInstructions(step, input.priorityScenarioFamily);
    slots.push({
      slotUid,
      kind: 'plan_step',
      title: step.title || `Step ${index + 1}`,
      planStepUid: step.planStepUid,
      relatedCheckUids: [],
      preferredHelpers: [...step.preferredHelpers],
      instructions,
    });

    lines.push('');
    lines.push(`  await test.step(${JSON.stringify(`Step ${index + 1}: ${step.title || `未命名步骤 ${index + 1}`}`)}, async () => {`);
    lines.push(...renderCommentLines([
      `planStepUid: ${step.planStepUid}`,
      step.scenarioStepUid ? `scenarioStepUid: ${step.scenarioStepUid}` : '',
      `stepType: ${step.stepType}`,
      step.target ? `target: ${normalizeText(step.target)}` : '',
      step.allowedActions.length > 0 ? `allowedActions: ${step.allowedActions.join(' / ')}` : '',
      step.preferredHelpers.length > 0 ? `preferredHelpers: ${step.preferredHelpers.join(' / ')}` : '',
      ...instructions,
    ]));
    lines.push(`    // SLOT_START: ${slotUid}`);
    lines.push(`    throw new Error('__PLAN_SLOT_${slotUid}__');`);
    lines.push(`    // SLOT_END: ${slotUid}`);
    lines.push('  });');
  }

  const verificationSlotUid = 'verification';
  const verificationInstructions = buildVerificationInstructions(plan, input.verificationPlan, input.priorityScenarioFamily);
  slots.push({
    slotUid: verificationSlotUid,
    kind: 'verification',
    title: '最终验收',
    relatedCheckUids: input.verificationPlan?.checks.map((check) => check.checkUid) || [],
    preferredHelpers: uniqueStrings(input.verificationPlan?.checks.flatMap((check) => check.preferredHelpers) || []),
    instructions: verificationInstructions,
  });

  lines.push('');
  lines.push(`  await test.step(${JSON.stringify('Verification: 最终业务验收')}, async () => {`);
  lines.push(...renderCommentLines([
    `expectedOutcome: ${normalizeText(input.verificationPlan?.expectedOutcome || plan.expectedOutcome || '未提供')}`,
    ...verificationInstructions,
  ]));
  lines.push(`    // SLOT_START: ${verificationSlotUid}`);
  lines.push(`    throw new Error('__PLAN_SLOT_${verificationSlotUid}__');`);
  lines.push(`    // SLOT_END: ${verificationSlotUid}`);
  lines.push('  });');
  lines.push('});');

  return {
    version: 1,
    compiler: plan.compiler,
    testTitle,
    entryUrl: plan.entryUrl,
    sharedVariables,
    slots,
    code: lines.join('\n'),
  };
}

export function renderCompiledIntentExecutionTemplate(template: IntentCompiledExecutionTemplate): string {
  return `## DeterministicExecutionTemplate（必须基于此脚手架补全）
- compiler: ${template.compiler}
- testTitle: ${template.testTitle}
- entryUrl: ${template.entryUrl || '无'}
- sharedVariables: ${template.sharedVariables.join(' / ') || '无'}
- slots: ${template.slots.map((slot) => slot.slotUid).join(' / ') || '无'}

要求：
1. 保持脚手架外层结构、\`shared / artifacts\`、\`test.step(...)\` 顺序和 \`SLOT_START / SLOT_END\` 标记不变。
2. 只替换各 slot 内的具体实现；如需新增少量辅助变量，只能在对应 slot 内新增，不要把多个步骤混到一个 slot。
3. 每个 \`plan_step\` slot 只实现当前步骤语义；最终验收集中写在 \`verification\` slot。
4. 最终输出必须删除所有 \`throw new Error('__PLAN_SLOT_...__')\` 占位实现，不得残留任何 \`__PLAN_SLOT_\` 字符串。

\`\`\`javascript
${template.code}
\`\`\``;
}
