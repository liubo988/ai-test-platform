import type { IntentActionDSL, IntentActionStepInput, IntentActionStepType } from './intent-action-dsl';
import type { IntentMatchedRecipe } from './intent-recipe-registry';
import type {
  IntentProjectKnowledgeDetailSurfaceHint,
  IntentProjectKnowledgeFieldPathHint,
  IntentProjectKnowledgeLocatorHint,
  IntentProjectKnowledgeRecordLookupHint,
  IntentProjectKnowledgeResolution,
} from './intent-project-knowledge';
import { buildIntentSharedVariableJsonPaths, looksLikeIntentStableIdentifierVariable } from './intent-shared-variable-utils';
import { parseCapabilityVerificationIntent, type CapabilityVerificationIntent } from './capability-verification';

export type IntentExecutionPlanMode = 'page' | 'scenario';
export type IntentExecutionPlanCompiler = 'deterministic_dsl_v1';

export interface IntentExecutionPlanStep {
  planStepUid: string;
  scenarioStepUid: string;
  stepType: IntentActionStepType;
  title: string;
  target: string;
  goal: string;
  allowedActions: string[];
  preferredHelpers: string[];
  requiredAssertions: string[];
  extractVariable: string;
  sharedVariables: string[];
  dependsOnPlanStepUids: string[];
}

export interface IntentExecutionPlan {
  version: 1;
  compiler: IntentExecutionPlanCompiler;
  mode: IntentExecutionPlanMode;
  entryUrl: string;
  summary: string;
  expectedOutcome: string;
  sharedVariables: string[];
  matchedRecipeSlugs?: string[];
  globalRules: string[];
  preferredPrimitives: string[];
  outputContract: string[];
  steps: IntentExecutionPlanStep[];
}

export type IntentVerificationPlanCheckKind = 'url' | 'response' | 'ui_state' | 'table_row' | 'modal_state' | 'variable';

export interface IntentVerificationFieldPathHint {
  label: string;
  paths: string[];
}

export type IntentVerificationFieldExpectedSource = 'shared_variable' | 'list_record' | 'response_json' | 'unknown';

export interface IntentVerificationFieldSpec {
  label: string;
  expectedSource?: IntentVerificationFieldExpectedSource;
  preferredPaths?: string[];
  scopeHints?: string[];
}

export interface IntentVerificationResponseSpec {
  urlIncludes?: string;
  method?: string;
}

export interface IntentVerificationLocatorHintSpec {
  selector?: string;
  placeholderIncludes?: string;
  textIncludes?: string;
}

export interface IntentVerificationRecordLookupSearchSurfaceSpec {
  keywordInput?: IntentVerificationLocatorHintSpec;
  searchButton?: IntentVerificationLocatorHintSpec;
}

export type IntentVerificationDetailEntryTrigger = 'row_action' | 'row_click';
export type IntentVerificationDetailEntryTarget = 'drawer_or_modal' | 'page';

export interface IntentVerificationDetailEntrySpec {
  trigger?: IntentVerificationDetailEntryTrigger;
  actionLabel?: string;
  target?: IntentVerificationDetailEntryTarget;
  urlIncludes?: string;
}

export interface IntentVerificationRecordLookupSpec {
  listResponse?: IntentVerificationResponseSpec;
  detailUrl?: string;
  rowHasTexts?: string[];
  searchSurface?: IntentVerificationRecordLookupSearchSurfaceSpec;
  tableScope?: IntentVerificationLocatorHintSpec;
  detailReadyLocator?: IntentVerificationLocatorHintSpec;
  detailEntry?: IntentVerificationDetailEntrySpec;
}

export interface IntentVerificationDetailSurfaceSpec {
  titleIncludes?: string;
  scopeHints?: string[];
}

export interface IntentVerificationPlanCheck {
  checkUid: string;
  kind: IntentVerificationPlanCheckKind;
  source: 'success_criteria' | 'step_expected_result' | 'step_extract_variable';
  title: string;
  instruction: string;
  stableIdentifiers?: string[];
  expectedFields?: string[];
  fieldPathHints?: IntentVerificationFieldPathHint[];
  fieldSpecs?: IntentVerificationFieldSpec[];
  recordLookup?: IntentVerificationRecordLookupSpec;
  detailSurface?: IntentVerificationDetailSurfaceSpec;
  preferredHelpers: string[];
  relatedPlanStepUids: string[];
  required: boolean;
}

export interface IntentVerificationPlan {
  version: 1;
  strategy: 'deterministic_verification_v1';
  intent?: CapabilityVerificationIntent;
  matchedRecipeSlugs?: string[];
  policyNotes?: string[];
  expectedOutcome: string;
  checks: IntentVerificationPlanCheck[];
  cleanupNotes: string;
}

export interface BuildIntentExecutionPlanInput {
  taskMode?: IntentExecutionPlanMode;
  targetUrl?: string;
  featureDescription?: string;
  expectedOutcome?: string;
  successCriteria?: string[];
  sharedVariables?: string[];
  cleanupNotes?: string;
  scenarioSteps?: IntentActionStepInput[];
  knowledge?: IntentProjectKnowledgeResolution;
  recipes?: IntentMatchedRecipe[];
  dsl: IntentActionDSL;
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

function collectMatchedRecipeSlugs(recipes?: IntentMatchedRecipe[]): string[] {
  return uniqueStrings((recipes || []).map((item) => item.recipe.slug));
}

function buildRecipeExecutionRules(recipes?: IntentMatchedRecipe[]): string[] {
  return uniqueStrings(
    (recipes || []).flatMap((item) => [
      `命中 deterministic recipe ${item.recipe.slug}（${item.recipe.title}），优先沿用这条稳定执行模板，不要退回自由发挥。`,
      ...item.recipe.executorPlan.map((step) => `Recipe 执行模板：${step}`),
      ...item.recipe.knownPitfalls.map((step) => `Recipe 避坑：${step}`),
    ])
  );
}

function buildRecipeVerificationNotes(recipes?: IntentMatchedRecipe[]): string[] {
  return uniqueStrings(
    (recipes || []).flatMap((item) => [
      `命中 deterministic recipe ${item.recipe.slug}（${item.recipe.title}），最终验收优先沿用其固定 verifier 链。`,
      ...item.recipe.verifierPlan.map((step) => `Recipe 验收模板：${step}`),
      ...item.recipe.knownPitfalls.map((step) => `Recipe 避坑：${step}`),
    ])
  );
}

function normalizeIntentToken(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9\u4e00-\u9fa5]+/g, '')
    .toLowerCase();
}

function labelsLikelyMatch(left: string, right: string): boolean {
  const normalizedLeft = normalizeIntentToken(left);
  const normalizedRight = normalizeIntentToken(right);
  return Boolean(
    normalizedLeft &&
      normalizedRight &&
      (normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft))
  );
}

function looksLikeStableIdentifierFieldLabel(label: string): boolean {
  return /(编号|单号|流水号|序列号|业务号|订单号|客户号|uid|code|serial|id|no|number)/i.test(String(label || '').trim());
}

function collectRelatedTexts(instruction: string, relatedSteps: IntentExecutionPlanStep[]): string[] {
  return [
    instruction,
    ...relatedSteps.map((step) => step.title),
    ...relatedSteps.map((step) => step.goal),
    ...relatedSteps.flatMap((step) => step.requiredAssertions),
  ];
}

function pickFieldStableIdentifier(label: string, stableIdentifiers: string[]): string {
  return stableIdentifiers.find((candidate) => labelsLikelyMatch(candidate, label)) || '';
}

function buildGenericFieldJsonPaths(label: string, stableIdentifiers: string[]): string[] {
  const normalizedLabel = String(label || '').trim();
  const matchedStableIdentifier = pickFieldStableIdentifier(normalizedLabel, stableIdentifiers);

  return uniqueStrings([
    matchedStableIdentifier ? buildIntentSharedVariableJsonPaths(matchedStableIdentifier) : null,
    !matchedStableIdentifier && isIdentifierLikeToken(normalizedLabel) ? buildIntentSharedVariableJsonPaths(normalizedLabel) : null,
    /(联系人|contact)/i.test(normalizedLabel)
      ? ['contactName', 'contact', 'contactPerson', 'contactUser', 'contactUserName', 'linkman', 'name']
      : null,
    /(手机号|手机号码|电话|mobile|phone)/i.test(normalizedLabel)
      ? ['mobile', 'phone', 'telephone', 'tel', 'contactPhone', 'contactMobile', 'mobilePhone']
      : null,
    /(状态|status|state)/i.test(normalizedLabel)
      ? ['status', 'statusName', 'statusText', 'state', 'stateName', 'stateText', 'displayStatus']
      : null,
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

function inferFieldScopeHints(kind: IntentVerificationPlanCheckKind, texts: string[]): string[] {
  if (kind !== 'table_row' && kind !== 'ui_state' && kind !== 'modal_state') {
    return [];
  }

  const haystack = texts.join('\n');
  return uniqueStrings([
    /(详情抽屉|detail drawer|drawer)/i.test(haystack) ? '详情抽屉' : null,
    /(详情弹窗|详情弹框|详情弹层|detail modal|modal)/i.test(haystack) ? '详情弹层' : null,
    /(详情页|detail page|\/detail\/|进入详情)/i.test(haystack) ? '详情页' : null,
  ]);
}

function inferFieldExpectedSource(
  kind: IntentVerificationPlanCheckKind,
  label: string,
  stableIdentifiers: string[]
): IntentVerificationFieldExpectedSource {
  if (pickFieldStableIdentifier(label, stableIdentifiers)) {
    return kind === 'variable' ? 'response_json' : 'shared_variable';
  }
  if (kind === 'variable' || kind === 'response') {
    return 'response_json';
  }
  if (kind === 'table_row' || kind === 'ui_state' || kind === 'modal_state') {
    return 'list_record';
  }
  return 'unknown';
}

function inferVerificationKind(text: string, helpers: string[], actions: string[], extractVariable = ''): IntentVerificationPlanCheckKind {
  const normalizedText = String(text || '').trim();
  const haystack = [normalizedText, extractVariable, ...helpers, ...actions].join('\n').toLowerCase();
  const textLooksLikeResponse =
    /(api|response|接口|状态码|200|201|204|post\s+\/|get\s+\/|put\s+\/|delete\s+\/|patch\s+\/|\/[a-z0-9/_-]+)/i.test(normalizedText);
  const textLooksLikeModalState = /(modal|drawer|弹框|弹窗|抽屉|对话框)/i.test(normalizedText);
  const textLooksLikeTableRow = /(列表|表格|记录|目标行|row|table)/i.test(normalizedText);
  const textLooksLikeUrlState = /(url|路由|跳转|详情页|列表页|回到|进入)/i.test(normalizedText);

  if (extractVariable || /(变量|提取|读取|extract|保存变量)/i.test(haystack)) {
    return 'variable';
  }
  if (textLooksLikeResponse) {
    return 'response';
  }
  if (textLooksLikeModalState) {
    return 'modal_state';
  }
  if (textLooksLikeTableRow) {
    return 'table_row';
  }
  if (textLooksLikeUrlState) {
    return 'url';
  }
  if (helpers.includes('__e2e.waitForVisibleAntdModal') || /关闭/i.test(haystack)) {
    return 'modal_state';
  }
  if (helpers.includes('__e2e.waitForApiResponse') || actions.includes('wait_for_response') || /(api|response|接口|状态码|200|201|204)/i.test(haystack)) {
    return 'response';
  }
  if (helpers.includes('__e2e.findAntdTableRow') || /(列表|表格|记录|目标行|row|table)/i.test(haystack)) {
    return 'table_row';
  }
  return 'ui_state';
}

function renderLineList(items: string[]): string {
  return items.length > 0 ? items.join(' / ') : '无';
}

function renderFieldPathHints(hints: IntentVerificationFieldPathHint[]): string {
  return hints.length > 0 ? hints.map((hint) => `${hint.label}: ${hint.paths.join(' / ')}`).join('；') : '无';
}

function renderFieldSpecs(specs: IntentVerificationFieldSpec[]): string {
  if (specs.length === 0) return '无';

  return specs
    .map((spec) => {
      const parts = [
        spec.expectedSource ? `source=${spec.expectedSource}` : '',
        (spec.preferredPaths || []).length > 0 ? `paths=${(spec.preferredPaths || []).join(' / ')}` : '',
        (spec.scopeHints || []).length > 0 ? `scope=${(spec.scopeHints || []).join(' / ')}` : '',
      ].filter(Boolean);
      return parts.length > 0 ? `${spec.label} { ${parts.join('; ')} }` : spec.label;
    })
    .join('；');
}

function renderResponseSpec(spec?: IntentVerificationResponseSpec): string {
  if (!spec) return '无';
  const parts = [spec.method ? `method=${spec.method}` : '', spec.urlIncludes ? `urlIncludes=${spec.urlIncludes}` : ''].filter(Boolean);
  return parts.length > 0 ? parts.join('; ') : '无';
}

function renderLocatorHintSpec(spec?: IntentVerificationLocatorHintSpec): string {
  if (!spec) return '';

  const parts = [
    spec.selector ? `selector=${spec.selector}` : '',
    spec.placeholderIncludes ? `placeholderIncludes=${spec.placeholderIncludes}` : '',
    spec.textIncludes ? `textIncludes=${spec.textIncludes}` : '',
  ].filter(Boolean);

  return parts.join('; ');
}

function renderDetailEntrySpec(spec?: IntentVerificationDetailEntrySpec): string {
  if (!spec) return '';

  const parts = [
    spec.trigger ? `trigger=${spec.trigger}` : '',
    spec.actionLabel ? `actionLabel=${spec.actionLabel}` : '',
    spec.target ? `target=${spec.target}` : '',
    spec.urlIncludes ? `urlIncludes=${spec.urlIncludes}` : '',
  ].filter(Boolean);

  return parts.length > 0 ? `detailEntry{ ${parts.join('; ')} }` : '';
}

function renderRecordLookupSpec(spec?: IntentVerificationRecordLookupSpec): string {
  if (!spec) return '无';
  const parts = [
    spec.listResponse ? `listResponse{ ${renderResponseSpec(spec.listResponse)} }` : '',
    spec.detailUrl ? `detailUrl=${spec.detailUrl}` : '',
    (spec.rowHasTexts || []).length > 0 ? `rowHasTexts=${(spec.rowHasTexts || []).join(' / ')}` : '',
    renderRecordLookupSearchSurfaceSpec(spec.searchSurface),
    spec.tableScope ? `tableScope{ ${renderLocatorHintSpec(spec.tableScope)} }` : '',
    spec.detailReadyLocator ? `detailReadyLocator{ ${renderLocatorHintSpec(spec.detailReadyLocator)} }` : '',
    renderDetailEntrySpec(spec.detailEntry),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('; ') : '无';
}

function renderRecordLookupSearchSurfaceSpec(spec?: IntentVerificationRecordLookupSearchSurfaceSpec): string {
  if (!spec) return '';

  const parts = [
    spec.keywordInput?.selector ? `keywordInput.selector=${spec.keywordInput.selector}` : '',
    spec.keywordInput?.placeholderIncludes ? `keywordInput.placeholderIncludes=${spec.keywordInput.placeholderIncludes}` : '',
    spec.searchButton?.selector ? `searchButton.selector=${spec.searchButton.selector}` : '',
    spec.searchButton?.textIncludes ? `searchButton.textIncludes=${spec.searchButton.textIncludes}` : '',
  ].filter(Boolean);

  return parts.length > 0 ? `searchSurface{ ${parts.join('; ')} }` : '';
}

function renderDetailSurfaceSpec(spec?: IntentVerificationDetailSurfaceSpec): string {
  if (!spec) return '无';
  const parts = [
    spec.titleIncludes ? `titleIncludes=${spec.titleIncludes}` : '',
    (spec.scopeHints || []).length > 0 ? `scopeHints=${(spec.scopeHints || []).join(' / ')}` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('; ') : '无';
}

function isIdentifierLikeToken(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(String(value || '').trim());
}

function collectStableIdentifiersFromSteps(steps: IntentExecutionPlanStep[]): string[] {
  return uniqueStrings(
    steps.flatMap((step) => [step.extractVariable, ...step.sharedVariables]).filter((variable) => looksLikeIntentStableIdentifierVariable(variable))
  );
}

function inferExpectedFieldsFromTexts(kind: IntentVerificationPlanCheckKind, texts: string[], stableIdentifiers: string[]): string[] {
  if (kind !== 'table_row' && kind !== 'ui_state' && kind !== 'modal_state') {
    return [];
  }

  const haystack = texts.join('\n');

  return uniqueStrings([
    /(联系人|contact)/i.test(haystack) ? '联系人' : null,
    /(手机号|手机号码|电话|mobile|phone)/i.test(haystack) ? '手机号' : null,
    /(状态|status)/i.test(haystack) ? '状态' : null,
    /(创建时间|创建日期|时间|created\s*at|create\s*time)/i.test(haystack) ? '创建时间' : null,
    /(企业名称|公司|company)/i.test(haystack) ? '企业名称' : null,
    /(客户名称|customer|client)/i.test(haystack) ? '客户名称' : null,
    /(编号|单号|流水号|uid|serial|serialno|serialnumber|recordcode|recorduid|customercode|businessid|orderid)/i.test(haystack)
      ? stableIdentifiers[0] || null
      : null,
    ...(kind === 'table_row' ? stableIdentifiers : []),
  ]);
}

function stepScopedHintAppliesToSteps(
  hint: { whenStepTypes?: IntentActionStepType[]; stepTextIncludes?: string[] },
  steps: IntentExecutionPlanStep[]
): boolean {
  if ((hint.whenStepTypes || []).length > 0 && !steps.some((step) => (hint.whenStepTypes || []).includes(step.stepType))) {
    return false;
  }

  if ((hint.stepTextIncludes || []).length === 0) {
    return true;
  }

  return steps.some((step) => {
    const haystack = [step.title, step.goal, ...step.requiredAssertions, step.extractVariable, ...step.sharedVariables].join('\n').toLowerCase();
    return (hint.stepTextIncludes || []).some((item) => haystack.includes(item.toLowerCase()));
  });
}

function fieldPathHintAppliesToSteps(hint: IntentProjectKnowledgeFieldPathHint, steps: IntentExecutionPlanStep[]): boolean {
  return stepScopedHintAppliesToSteps(hint, steps);
}

function stableIdentifierHintMatches(
  hint: { stableIdentifiers?: string[] },
  stableIdentifiers: string[]
): boolean {
  const hintStableIdentifiers = uniqueStrings(hint.stableIdentifiers || []);
  if (hintStableIdentifiers.length === 0) {
    return true;
  }

  const requestedStableIdentifiers = uniqueStrings(stableIdentifiers);
  return hintStableIdentifiers.some((item) =>
    requestedStableIdentifiers.some((candidate) => labelsLikelyMatch(item, candidate))
  );
}

function fieldPathHintMatchesLabel(
  hint: IntentProjectKnowledgeFieldPathHint,
  label: string,
  stableIdentifiers: string[]
): boolean {
  const hintStableIdentifiers = uniqueStrings(hint.stableIdentifiers || []);
  const requestedStableIdentifiers = uniqueStrings(stableIdentifiers);
  const matchesLabel = labelsLikelyMatch(hint.label, label);
  const matchesStableIdentifier =
    looksLikeStableIdentifierFieldLabel(hint.label) && hintStableIdentifiers.some((item) => labelsLikelyMatch(item, label));

  if (!matchesLabel && !matchesStableIdentifier) {
    return false;
  }

  if (hintStableIdentifiers.length === 0) {
    return true;
  }

  return hintStableIdentifiers.some(
    (item) =>
      labelsLikelyMatch(item, label) || requestedStableIdentifiers.some((candidate) => labelsLikelyMatch(item, candidate))
  );
}

function toVerificationLocatorHintSpec(source?: IntentProjectKnowledgeLocatorHint | null): IntentVerificationLocatorHintSpec | undefined {
  if (!source) return undefined;

  const selector = String(source.selector || '').trim();
  const placeholderIncludes = String(source.placeholderIncludes || '').trim();
  const textIncludes = String(source.textIncludes || '').trim();
  if (!selector && !placeholderIncludes && !textIncludes) {
    return undefined;
  }

  return {
    selector: selector || undefined,
    placeholderIncludes: placeholderIncludes || undefined,
    textIncludes: textIncludes || undefined,
  };
}

function buildVerificationRecordLookupKnowledgeSpec(
  stableIdentifiers: string[],
  relatedSteps: IntentExecutionPlanStep[],
  knowledge?: IntentProjectKnowledgeResolution
): Partial<IntentVerificationRecordLookupSpec> | undefined {
  const hints = knowledge?.matches.flatMap((match) => match.recordLookupHints || []) || [];
  const applicableHints = hints.filter(
    (hint) => stepScopedHintAppliesToSteps(hint, relatedSteps) && stableIdentifierHintMatches(hint, stableIdentifiers)
  );
  if (applicableHints.length === 0) {
    return undefined;
  }

  let listResponse: IntentVerificationResponseSpec | undefined;
  let detailUrl = '';
  let rowHasTexts: string[] = [];
  let keywordInput: IntentVerificationLocatorHintSpec | undefined;
  let searchButton: IntentVerificationLocatorHintSpec | undefined;
  let tableScope: IntentVerificationLocatorHintSpec | undefined;
  let detailReadyLocator: IntentVerificationLocatorHintSpec | undefined;
  let detailEntry: IntentVerificationDetailEntrySpec | undefined;

  for (const hint of applicableHints) {
    if (hint.listResponse) {
      listResponse = {
        urlIncludes: listResponse?.urlIncludes || hint.listResponse.urlIncludes,
        method: listResponse?.method || hint.listResponse.method,
      };
    }
    if (!detailUrl && hint.detailUrl) {
      detailUrl = hint.detailUrl;
    }
    if (rowHasTexts.length === 0 && (hint.rowHasTexts || []).length > 0) {
      rowHasTexts = [...(hint.rowHasTexts || [])];
    }
    if (!keywordInput) {
      keywordInput = toVerificationLocatorHintSpec(hint.searchSurface?.keywordInput);
    }
    if (!searchButton) {
      searchButton = toVerificationLocatorHintSpec(hint.searchSurface?.searchButton);
    }
    if (!tableScope) {
      tableScope = toVerificationLocatorHintSpec(hint.tableScope);
    }
    if (!detailReadyLocator) {
      detailReadyLocator = toVerificationLocatorHintSpec(hint.detailReadyLocator);
    }
    if (!detailEntry && hint.detailEntry) {
      detailEntry = {
        trigger: hint.detailEntry.trigger,
        actionLabel: hint.detailEntry.actionLabel,
        target: hint.detailEntry.target,
        urlIncludes: hint.detailEntry.urlIncludes,
      };
    }
  }

  const searchSurface = keywordInput || searchButton ? { keywordInput, searchButton } : undefined;
  if (
    !listResponse?.urlIncludes &&
    !listResponse?.method &&
    !detailUrl &&
    rowHasTexts.length === 0 &&
    !searchSurface &&
    !tableScope &&
    !detailReadyLocator &&
    !detailEntry
  ) {
    return undefined;
  }

  return {
    listResponse: listResponse?.urlIncludes || listResponse?.method ? listResponse : undefined,
    detailUrl: detailUrl || undefined,
    rowHasTexts,
    searchSurface,
    tableScope,
    detailReadyLocator,
    detailEntry,
  };
}

function buildVerificationDetailSurfaceKnowledgeSpec(
  stableIdentifiers: string[],
  relatedSteps: IntentExecutionPlanStep[],
  knowledge?: IntentProjectKnowledgeResolution
): Partial<IntentVerificationDetailSurfaceSpec> | undefined {
  const hints = knowledge?.matches.flatMap((match) => match.detailSurfaceHints || []) || [];
  const applicableHints = hints.filter(
    (hint) => stepScopedHintAppliesToSteps(hint, relatedSteps) && stableIdentifierHintMatches(hint, stableIdentifiers)
  );
  if (applicableHints.length === 0) {
    return undefined;
  }

  const titleIncludes = applicableHints.find((hint) => String(hint.titleIncludes || '').trim())?.titleIncludes || '';
  const scopeHints = uniqueStrings(applicableHints.flatMap((hint) => hint.scopeHints || []));
  if (!titleIncludes && scopeHints.length === 0) {
    return undefined;
  }

  return {
    titleIncludes: titleIncludes || undefined,
    scopeHints,
  };
}

function buildVerificationFieldPathHints(
  labels: string[],
  stableIdentifiers: string[],
  relatedSteps: IntentExecutionPlanStep[],
  knowledge?: IntentProjectKnowledgeResolution
): IntentVerificationFieldPathHint[] {
  const knowledgeHints = knowledge?.matches.flatMap((match) => match.fieldPathHints || []) || [];
  if (knowledgeHints.length === 0) {
    return [];
  }

  const requestedLabels = uniqueStrings([...labels, ...stableIdentifiers]);
  return requestedLabels.flatMap((label) => {
    const paths = uniqueStrings(
      knowledgeHints
        .filter(
          (hint) => fieldPathHintAppliesToSteps(hint, relatedSteps) && fieldPathHintMatchesLabel(hint, label, stableIdentifiers)
        )
        .flatMap((hint) => hint.paths)
    );

    return paths.length > 0 ? [{ label, paths }] : [];
  });
}

function buildVerificationFieldSpecs(
  kind: IntentVerificationPlanCheckKind,
  labels: string[],
  stableIdentifiers: string[],
  relatedSteps: IntentExecutionPlanStep[],
  instruction: string,
  knowledge?: IntentProjectKnowledgeResolution
): IntentVerificationFieldSpec[] {
  const resolvedLabels =
    kind === 'variable'
      ? uniqueStrings([...labels, ...stableIdentifiers])
      : uniqueStrings([...labels, ...(kind === 'table_row' ? stableIdentifiers : [])]);
  if (resolvedLabels.length === 0) {
    return [];
  }

  const fieldPathHints = buildVerificationFieldPathHints(resolvedLabels, stableIdentifiers, relatedSteps, knowledge);
  const texts = collectRelatedTexts(instruction, relatedSteps);
  const scopeHints = inferFieldScopeHints(kind, texts);

  return resolvedLabels.map((label) => {
    const hintedPaths = fieldPathHints
      .filter((hint) => labelsLikelyMatch(hint.label, label))
      .flatMap((hint) => hint.paths);
    const preferredPaths = uniqueStrings([...hintedPaths, ...buildGenericFieldJsonPaths(label, stableIdentifiers)]);

    return {
      label,
      expectedSource: inferFieldExpectedSource(kind, label, stableIdentifiers),
      preferredPaths,
      scopeHints,
    } satisfies IntentVerificationFieldSpec;
  });
}

function extractRouteTokens(target: string): string[] {
  const raw = String(target || '').trim();
  if (!raw) return [];

  const segments = (() => {
    try {
      const parsed = new URL(raw);
      const hashPath = parsed.hash.replace(/^#/, '');
      return `${parsed.pathname}/${hashPath}`.split(/[/?#&]+/);
    } catch {
      return raw.split(/[/?#&]+/);
    }
  })();

  return uniqueStrings(
    segments
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => segment.replace(/^[#:]+/, ''))
      .filter(Boolean)
  );
}

function normalizeResourceToken(token: string): string {
  let normalized = String(token || '').trim().toLowerCase();
  if (!normalized) return '';
  normalized = normalized.replace(/[^a-z0-9]+/g, '');
  normalized = normalized.replace(/(list|detail|create|edit|view|index)$/i, '');
  return normalized;
}

function inferRouteResourceToken(relatedSteps: IntentExecutionPlanStep[]): string {
  const genericTokens = new Set(['http', 'https', 'www', 'com', 'cn', 'html', 'aspx', 'jsp', 'page', 'pages', 'api']);

  for (const step of relatedSteps) {
    for (const token of extractRouteTokens(step.target)) {
      const normalized = normalizeResourceToken(token);
      if (!normalized || genericTokens.has(normalized)) continue;
      if (['list', 'detail', 'create', 'edit', 'view', 'new', 'info'].includes(normalized)) continue;
      return normalized;
    }
  }

  return '';
}

function inferDetailUrlTemplate(stableIdentifiers: string[], relatedSteps: IntentExecutionPlanStep[]): string {
  if (stableIdentifiers.length === 0) {
    return '';
  }

  const resourceToken = inferRouteResourceToken(relatedSteps);
  return resourceToken ? `/${resourceToken}/detail/{{primaryValue}}` : '/detail/{{primaryValue}}';
}

function inferRowHasTexts(expectedFields: string[], stableIdentifiers: string[]): string[] {
  if (stableIdentifiers.length === 0) {
    return [];
  }

  const nonIdentifierFields = expectedFields.filter((label) => !pickFieldStableIdentifier(label, stableIdentifiers));
  const stableField =
    nonIdentifierFields.find((label) => /(状态|status)/i.test(label)) ||
    nonIdentifierFields.find((label) => /(联系人|contact)/i.test(label)) ||
    nonIdentifierFields.find((label) => /(手机号|phone|mobile)/i.test(label)) ||
    nonIdentifierFields[0];
  const todoToken = stableField
    ? /(状态|status)/i.test(stableField)
      ? 'TODO_STABLE_STATE'
      : /(联系人|contact)/i.test(stableField)
      ? 'TODO_STABLE_CONTACT'
      : /(手机号|phone|mobile)/i.test(stableField)
      ? 'TODO_STABLE_PHONE'
      : 'TODO_STABLE_TEXT'
    : 'TODO_STABLE_TEXT';

  return uniqueStrings([stableIdentifiers[0], todoToken]);
}

function inferListResponseUrlIncludes(relatedSteps: IntentExecutionPlanStep[]): string {
  const resourceToken = inferRouteResourceToken(relatedSteps);
  return resourceToken ? `/${resourceToken}` : '';
}

function inferDetailTitleIncludes(texts: string[]): string {
  const genericTitles = new Set(['详情', '详情页', '详情信息', '详情抽屉', '详情弹层', '明细', '信息']);
  const noisePattern =
    /(创建|提交|列表|检索|命中|核对|成功|失败|进入|返回|读取|提取|保存|步骤|变量|目标|等待|打开页面|关闭|回查|未命中|若未|如果|并|然后|之后|之前|回到|在详情)/i;
  const explicitTitlePatterns = [
    /(?:^|["'“”‘’\s:：>（(])([A-Za-z0-9\u4e00-\u9fa5]{1,16}(?:详情|明细|配置|信息))(?:页|弹窗|弹层|抽屉|$|["'“”‘’\s,，。；;:：)）\]])/g,
    /(?:在|到|进入|打开|查看|回到|定位到|切到|切换到)([A-Za-z0-9\u4e00-\u9fa5]{1,16}(?:详情|明细|配置|信息))(?:页|弹窗|弹层|抽屉|$)/g,
    /titleIncludes\s*[:=]\s*['"]?([A-Za-z0-9\u4e00-\u9fa5]{1,20}(?:详情|明细|配置|信息))/gi,
  ];

  for (const text of texts) {
    const source = String(text || '');

    for (const pattern of explicitTitlePatterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null = null;
      while ((match = pattern.exec(source))) {
        const normalized = String(match[1] || '').trim();
        if (!normalized || genericTitles.has(normalized)) continue;
        if (noisePattern.test(normalized)) continue;
        return normalized;
      }
    }
  }

  return '';
}

function buildVerificationDetailSurfaceSpec(
  kind: IntentVerificationPlanCheckKind,
  fieldSpecs: IntentVerificationFieldSpec[],
  instruction: string,
  relatedSteps: IntentExecutionPlanStep[],
  stableIdentifiers: string[],
  knowledge?: IntentProjectKnowledgeResolution
): IntentVerificationDetailSurfaceSpec | undefined {
  const texts = collectRelatedTexts(instruction, relatedSteps);
  const knowledgeSpec = buildVerificationDetailSurfaceKnowledgeSpec(stableIdentifiers, relatedSteps, knowledge);
  const scopeHints = uniqueStrings([
    ...(knowledgeSpec?.scopeHints || []),
    ...fieldSpecs.flatMap((spec) => spec.scopeHints || []),
    ...inferFieldScopeHints(kind, texts),
  ]);
  const titleIncludes = knowledgeSpec?.titleIncludes || inferDetailTitleIncludes(texts);

  if (!titleIncludes && scopeHints.length === 0) {
    return undefined;
  }

  return {
    titleIncludes: titleIncludes || undefined,
    scopeHints,
  };
}

function buildVerificationRecordLookupSpec(
  kind: IntentVerificationPlanCheckKind,
  stableIdentifiers: string[],
  expectedFields: string[],
  relatedSteps: IntentExecutionPlanStep[],
  knowledge?: IntentProjectKnowledgeResolution
): IntentVerificationRecordLookupSpec | undefined {
  if (kind !== 'table_row') {
    return undefined;
  }

  const knowledgeSpec = buildVerificationRecordLookupKnowledgeSpec(stableIdentifiers, relatedSteps, knowledge);
  const urlIncludes = knowledgeSpec?.listResponse?.urlIncludes || inferListResponseUrlIncludes(relatedSteps);
  const detailUrl = knowledgeSpec?.detailUrl || inferDetailUrlTemplate(stableIdentifiers, relatedSteps);
  const rowHasTexts = (knowledgeSpec?.rowHasTexts || []).length > 0 ? knowledgeSpec?.rowHasTexts || [] : inferRowHasTexts(expectedFields, stableIdentifiers);
  const searchSurface = knowledgeSpec?.searchSurface;
  const tableScope = knowledgeSpec?.tableScope;
  const detailReadyLocator = knowledgeSpec?.detailReadyLocator;
  const detailEntry = knowledgeSpec?.detailEntry;

  if (!urlIncludes && !detailUrl && rowHasTexts.length === 0 && !searchSurface && !tableScope && !detailReadyLocator && !detailEntry) {
    return undefined;
  }

  return {
    listResponse: urlIncludes
      ? {
          urlIncludes,
          method: knowledgeSpec?.listResponse?.method || 'GET',
        }
      : knowledgeSpec?.listResponse?.method
      ? { method: knowledgeSpec.listResponse.method }
      : undefined,
    detailUrl: detailUrl || undefined,
    rowHasTexts,
    searchSurface,
    tableScope,
    detailReadyLocator,
    detailEntry,
  };
}

function buildVerificationCheckMetadata(
  kind: IntentVerificationPlanCheckKind,
  instruction: string,
  relatedSteps: IntentExecutionPlanStep[],
  explicitStableIdentifiers: string[] = [],
  knowledge?: IntentProjectKnowledgeResolution
): Pick<
  IntentVerificationPlanCheck,
  'stableIdentifiers' | 'expectedFields' | 'fieldPathHints' | 'fieldSpecs' | 'recordLookup' | 'detailSurface'
> {
  const stableIdentifiers = uniqueStrings([...explicitStableIdentifiers, ...collectStableIdentifiersFromSteps(relatedSteps)]);
  const texts = collectRelatedTexts(instruction, relatedSteps);
  const expectedFields = inferExpectedFieldsFromTexts(
    kind,
    texts,
    stableIdentifiers
  );
  const fieldPathHints = buildVerificationFieldPathHints(expectedFields, stableIdentifiers, relatedSteps, knowledge);
  const fieldSpecs = buildVerificationFieldSpecs(kind, expectedFields, stableIdentifiers, relatedSteps, instruction, knowledge);
  const recordLookup = buildVerificationRecordLookupSpec(kind, stableIdentifiers, expectedFields, relatedSteps, knowledge);
  const detailSurface = buildVerificationDetailSurfaceSpec(kind, fieldSpecs, instruction, relatedSteps, stableIdentifiers, knowledge);

  return {
    stableIdentifiers,
    expectedFields,
    fieldPathHints,
    fieldSpecs,
    recordLookup,
    detailSurface,
  };
}

function buildExecutionPlanSteps(dsl: IntentActionDSL, scenarioSteps: IntentActionStepInput[], sharedVariables: string[]): IntentExecutionPlanStep[] {
  const scenarioStepByUid = new Map(scenarioSteps.map((step) => [step.stepUid, step]));

  return dsl.steps.map((step, index) => {
    const sourceStep = scenarioStepByUid.get(step.stepUid);
    const previousStep = index > 0 ? dsl.steps[index - 1] : null;

    return {
      planStepUid: `plan_step_${index + 1}`,
      scenarioStepUid: step.stepUid,
      stepType: step.stepType,
      title: step.title,
      target: step.target,
      goal: step.goal,
      allowedActions: [...step.allowedActions],
      preferredHelpers: [...step.preferredHelpers],
      requiredAssertions: [...step.requiredAssertions],
      extractVariable: sourceStep?.extractVariable?.trim() || '',
      sharedVariables: uniqueStrings([...(sourceStep?.extractVariable ? [sourceStep.extractVariable] : []), ...step.sharedVariables, ...sharedVariables]),
      dependsOnPlanStepUids: previousStep ? [`plan_step_${index}`] : [],
    };
  });
}

export function buildIntentExecutionPlan(input: BuildIntentExecutionPlanInput): IntentExecutionPlan {
  const sharedVariables = uniqueStrings(input.sharedVariables || []);
  const scenarioSteps = input.scenarioSteps || [];
  const steps = buildExecutionPlanSteps(input.dsl, scenarioSteps, sharedVariables);
  const matchedRecipeSlugs = collectMatchedRecipeSlugs(input.recipes);

  return {
    version: 1,
    compiler: 'deterministic_dsl_v1',
    mode: input.taskMode || input.dsl.mode || 'page',
    entryUrl: input.targetUrl?.trim() || input.dsl.targetUrl || '',
    summary: input.dsl.summary || input.featureDescription?.trim() || '',
    expectedOutcome: input.expectedOutcome?.trim() || (input.successCriteria || []).join('；'),
    sharedVariables,
    matchedRecipeSlugs,
    globalRules: uniqueStrings([...input.dsl.globalRules, ...buildRecipeExecutionRules(input.recipes)]),
    preferredPrimitives: [...input.dsl.preferredPrimitives],
    outputContract: [...input.dsl.outputContract],
    steps,
  };
}

export function buildIntentVerificationPlan(input: BuildIntentExecutionPlanInput, executionPlan: IntentExecutionPlan): IntentVerificationPlan {
  const intent = parseCapabilityVerificationIntent(input.featureDescription || '');
  const policyNotes = uniqueStrings([
    intent === 'review'
      ? [
          '当前是保守复核：优先确认既有 helper、selector、断言与业务入口是否仍稳定可复用。',
          '不要为了追求通过主动扩写需求外业务链路，也不要把当前能力改写成新的业务目标。',
          '若 mixed observing / suppressed helper 风险没有被稳定消除，宁可明确失败并暴露真实漂移，也不要降级成模糊成功断言。',
        ]
      : [],
    ...buildRecipeVerificationNotes(input.recipes),
  ].flat());
  const matchedRecipeSlugs = collectMatchedRecipeSlugs(input.recipes);
  const checks: IntentVerificationPlanCheck[] = [];
  const seen = new Set<string>();
  const scenarioStepByUid = new Map((input.scenarioSteps || []).map((step) => [step.stepUid, step]));

  for (const [index, criterion] of (input.successCriteria || []).entries()) {
    const normalized = criterion.trim();
    if (!normalized || seen.has(`success_criteria:${normalized}`)) continue;
    seen.add(`success_criteria:${normalized}`);
    const relatedSteps = executionPlan.steps.filter((step) =>
      step.requiredAssertions.some((assertion) => assertion.includes(normalized) || normalized.includes(assertion))
    );
    const kind = inferVerificationKind(
      normalized,
      executionPlan.steps.flatMap((step) => step.preferredHelpers),
      executionPlan.steps.flatMap((step) => step.allowedActions)
    );
    const metadata = buildVerificationCheckMetadata(kind, normalized, relatedSteps, [], input.knowledge);

    checks.push({
      checkUid: `verify_success_${index + 1}`,
      kind,
      source: 'success_criteria',
      title: `成功标准 ${index + 1}`,
      instruction: normalized,
      stableIdentifiers: metadata.stableIdentifiers,
      expectedFields: metadata.expectedFields,
      fieldPathHints: metadata.fieldPathHints,
      fieldSpecs: metadata.fieldSpecs,
      recordLookup: metadata.recordLookup,
      detailSurface: metadata.detailSurface,
      preferredHelpers: uniqueStrings(
        relatedSteps.flatMap((step) => step.preferredHelpers)
      ),
      relatedPlanStepUids: relatedSteps.map((step) => step.planStepUid),
      required: true,
    });
  }

  for (const step of executionPlan.steps) {
    for (const assertion of step.requiredAssertions) {
      const normalized = assertion.trim();
      if (!normalized || seen.has(`step_assertion:${step.planStepUid}:${normalized}`)) continue;
      seen.add(`step_assertion:${step.planStepUid}:${normalized}`);
      const kind = inferVerificationKind(normalized, step.preferredHelpers, step.allowedActions);
      const metadata = buildVerificationCheckMetadata(kind, normalized, [step], [], input.knowledge);

      checks.push({
        checkUid: `verify_step_${step.planStepUid}_${checks.length + 1}`,
        kind,
        source: 'step_expected_result',
        title: `${step.title} 验收`,
        instruction: normalized,
        stableIdentifiers: metadata.stableIdentifiers,
        expectedFields: metadata.expectedFields,
        fieldPathHints: metadata.fieldPathHints,
        fieldSpecs: metadata.fieldSpecs,
        recordLookup: metadata.recordLookup,
        detailSurface: metadata.detailSurface,
        preferredHelpers: [...step.preferredHelpers],
        relatedPlanStepUids: [step.planStepUid],
        required: true,
      });
    }

    const sourceStep = scenarioStepByUid.get(step.scenarioStepUid);
    const extractVariable = step.extractVariable || sourceStep?.extractVariable || '';
    if (!extractVariable) continue;

    const normalized = extractVariable.trim();
    if (!normalized || seen.has(`step_variable:${step.planStepUid}:${normalized}`)) continue;
    seen.add(`step_variable:${step.planStepUid}:${normalized}`);
    const metadata = buildVerificationCheckMetadata(
      'variable',
      `必须成功提取并保存变量 ${normalized}`,
      [step],
      looksLikeIntentStableIdentifierVariable(normalized) ? [normalized] : [],
      input.knowledge
    );

    checks.push({
      checkUid: `verify_variable_${step.planStepUid}`,
      kind: 'variable',
      source: 'step_extract_variable',
      title: `${step.title} 提取变量`,
      instruction: `必须成功提取并保存变量 ${normalized}`,
      stableIdentifiers: metadata.stableIdentifiers,
      expectedFields: metadata.expectedFields,
      fieldPathHints: metadata.fieldPathHints,
      fieldSpecs: metadata.fieldSpecs,
      recordLookup: metadata.recordLookup,
      detailSurface: metadata.detailSurface,
      preferredHelpers: [...step.preferredHelpers],
      relatedPlanStepUids: [step.planStepUid],
      required: true,
    });
  }

  return {
    version: 1,
    strategy: 'deterministic_verification_v1',
    intent,
    matchedRecipeSlugs,
    policyNotes,
    expectedOutcome: input.expectedOutcome?.trim() || (input.successCriteria || []).join('；'),
    checks,
    cleanupNotes: input.cleanupNotes?.trim() || '',
  };
}

export function renderIntentExecutionPlan(plan: IntentExecutionPlan): string {
  const steps = plan.steps
    .map(
      (step, index) => `- Step ${index + 1} [${step.stepType}] ${step.title || '未命名步骤'}
  - planStepUid: ${step.planStepUid}
  - scenarioStepUid: ${step.scenarioStepUid || '无'}
  - target: ${step.target || '无'}
  - goal: ${step.goal || '无'}
  - allowedActions: ${renderLineList(step.allowedActions)}
  - preferredHelpers: ${renderLineList(step.preferredHelpers)}
  - requiredAssertions: ${renderLineList(step.requiredAssertions)}
  - extractVariable: ${step.extractVariable || '无'}
  - dependsOn: ${renderLineList(step.dependsOnPlanStepUids)}`
    )
    .join('\n');

  return `## ExecutionPlan（结构化执行计划）
- compiler: ${plan.compiler}
- mode: ${plan.mode}
- entryUrl: ${plan.entryUrl || '无'}
- expectedOutcome: ${plan.expectedOutcome || '无'}
- sharedVariables: ${renderLineList(plan.sharedVariables)}
- matchedRecipes: ${renderLineList(plan.matchedRecipeSlugs || [])}
- globalRules: ${renderLineList(plan.globalRules)}
- preferredPrimitives: ${renderLineList(plan.preferredPrimitives)}

步骤：
${steps || '- 无显式步骤'}`;
}

export function renderIntentVerificationPlan(plan: IntentVerificationPlan): string {
  const checks = plan.checks
    .map(
      (check, index) => `- Check ${index + 1} [${check.kind}] ${check.title}
  - source: ${check.source}
  - instruction: ${check.instruction}
  - stableIdentifiers: ${renderLineList(check.stableIdentifiers || [])}
  - expectedFields: ${renderLineList(check.expectedFields || [])}
  - fieldPathHints: ${renderFieldPathHints(check.fieldPathHints || [])}
  - fieldSpecs: ${renderFieldSpecs(check.fieldSpecs || [])}
  - recordLookup: ${renderRecordLookupSpec(check.recordLookup)}
  - detailSurface: ${renderDetailSurfaceSpec(check.detailSurface)}
  - preferredHelpers: ${renderLineList(check.preferredHelpers)}
  - relatedPlanSteps: ${renderLineList(check.relatedPlanStepUids)}
  - required: ${check.required ? 'yes' : 'no'}`
    )
    .join('\n');

  return `## VerificationPlan（结构化验收计划）
- strategy: ${plan.strategy}
- intent: ${plan.intent || 'verify'}
- matchedRecipes: ${renderLineList(plan.matchedRecipeSlugs || [])}
- policyNotes: ${renderLineList(plan.policyNotes || [])}
- expectedOutcome: ${plan.expectedOutcome || '无'}
- cleanupNotes: ${plan.cleanupNotes || '无'}

检查项：
${checks || '- 无显式检查项'}`;
}
