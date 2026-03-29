import type { TestResult } from '@/lib/test-executor';
import type { PageSnapshot } from '@/lib/page-analyzer';

export type IntentE2EFailureClass =
  | 'env_transient'
  | 'auth_failed'
  | 'permission_blocked'
  | 'data_missing'
  | 'target_row_not_found'
  | 'ui_anchor_missing'
  | 'selector_drift'
  | 'assertion_too_strict'
  | 'workflow_gap'
  | 'repair_stagnated'
  | 'unknown';

export interface IntentE2EFailureTriage {
  failureClass: IntentE2EFailureClass;
  repairable: boolean;
  summary: string;
  matchedSignals: string[];
  diagnosis?: IntentE2EFailureDiagnosis | null;
}

export interface IntentE2EFailureDiagnosis {
  failureSignature: string;
  failedStepTitle: string;
  failedLocator: string;
  targetAnchor: string;
  pageUrl: string;
  repeatedCount: number;
  candidateAnchors: string[];
  frameHints: string[];
  nextActions: string[];
}

export interface IntentE2EFailureContext {
  pageUrl?: string;
  repeatedCount?: number;
  snapshot?: Pick<PageSnapshot, 'url' | 'title' | 'forms' | 'buttons' | 'tooltipElements' | 'headings' | 'frames'>;
}

type SignalRule = {
  signal: string;
  pattern: RegExp;
};

type TriageRule = {
  failureClass: IntentE2EFailureClass;
  repairable: boolean;
  summary: string;
  signals: SignalRule[];
};

function clampText(value: string, max = 140): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > max ? `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…` : normalized;
}

function uniqueStrings(values: Array<string | null | undefined>, max = 8): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
    if (items.length >= max) break;
  }

  return items;
}

function firstNonEmptyLine(value: string): string {
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .find(Boolean) || '';
}

function normalizeFailureAnchorLabel(value: string): string {
  const normalized = value.replace(/\s+/g, '').trim();
  if (!normalized) return '';
  if (/(我创建的|我跟进的|归属|范围)/.test(normalized)) {
    return '商机列表归属切换';
  }
  return normalized.slice(0, 48);
}

function normalizeSearchText(value: string): string {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function looksLikeBusinessOwnershipAnchor(value: string): boolean {
  return /(我创建的|我跟进的|归属|范围|businesslist|商机)/i.test(value);
}

function looksLikeBusinessListContext(context: IntentE2EFailureContext): boolean {
  const haystack = [
    context.pageUrl || '',
    context.snapshot?.url || '',
    context.snapshot?.title || '',
  ].join('\n');
  return /businesslist|商机列表/i.test(haystack);
}

export function extractIntentE2EFailureAnchorLabel(errorMessage: string): string {
  const candidates = [
    errorMessage.match(/未找到[“"'`]?([^”"'`\n]+)[”"'`]?筛选标签/i)?.[1],
    errorMessage.match(/getByText\('([^']+)'/i)?.[1],
    errorMessage.match(/label\[title="([^"]+)"\]/i)?.[1],
    errorMessage.match(/title=["']([^"']+)["']/i)?.[1],
    errorMessage.match(/hasText:\s*\/([^/]+)\//i)?.[1],
    errorMessage.match(/name:\s*\/([^/]+)\//i)?.[1],
  ];

  for (const candidate of candidates) {
    const normalized = normalizeFailureAnchorLabel(String(candidate || ''));
    if (normalized) return normalized;
  }

  return '';
}

export function extractIntentE2EFailureLocator(errorMessage: string): string {
  const patterns = [
    /Locator:\s*([^\n]+)/i,
    /((?:page\.)?locator\([^\n]+\))/i,
    /((?:page\.)?getByRole\([^\n]+\))/i,
    /((?:page\.)?getByText\([^\n]+\))/i,
    /((?:page\.)?getByPlaceholder\([^\n]+\))/i,
    /((?:page\.)?getByLabel\([^\n]+\))/i,
    /((?:page\.)?getByTitle\([^\n]+\))/i,
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern)?.[1];
    const value = clampText(match || '', 180);
    if (value) return value;
  }

  return '';
}

function normalizeFailureSummary(errorMessage: string): string {
  return clampText(firstNonEmptyLine(errorMessage), 120);
}

function extractIntentE2EFailedStepTitle(result: TestResult): string {
  // Worker steps are emitted inner-first: the concrete failed test.step appears before the outer test title.
  // Prefer the first failed step so repair targets the specific slot (for example Verification) instead of the whole test title.
  const failedStep = result.steps.find((step) => step.status === 'failed');
  return clampText(failedStep?.title || result.steps.at(-1)?.title || '', 80);
}

function scoreAnchorCandidate(candidate: string, targetAnchor: string): number {
  const normalizedCandidate = normalizeSearchText(candidate);
  const normalizedTarget = normalizeSearchText(targetAnchor);
  if (!normalizedCandidate) return -1;

  let score = 0;
  if (normalizedTarget) {
    if (normalizedCandidate === normalizedTarget) score += 120;
    if (normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate)) score += 90;
    if (looksLikeBusinessOwnershipAnchor(normalizedTarget) && /(我创建的|我跟进的|归属|范围|商机)/i.test(normalizedCandidate)) {
      score += 80;
    }
  }
  if (candidate.startsWith('#') || /iframe\[/.test(candidate)) score += 8;
  return score;
}

function collectSnapshotAnchorCandidates(
  snapshot?: IntentE2EFailureContext['snapshot'],
  targetAnchor = ''
): string[] {
  if (!snapshot) return [];

  const rawCandidates = uniqueStrings([
    snapshot.title,
    ...(snapshot.headings || []).map((item) => item.text),
    ...(snapshot.buttons || []).flatMap((item) => [item.text, item.title, item.ariaLabel]),
    ...(snapshot.tooltipElements || []).flatMap((item) => [item.text, item.title, item.ariaLabel]),
    ...snapshot.forms.flatMap((form) => form.fields.flatMap((field) => [field.label, field.placeholder, field.id])),
    ...(snapshot.frames || []).flatMap((frame) => [
      frame.selectorHint,
      frame.elementId ? `#${frame.elementId}` : '',
      frame.elementName ? `iframe[name="${frame.elementName}"]` : '',
    ]),
  ], 32);

  if (!targetAnchor) return rawCandidates.slice(0, 6);

  const ranked = rawCandidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: scoreAnchorCandidate(candidate, targetAnchor),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const matched = ranked.filter((item) => item.score > 0).map((item) => item.candidate);
  return (matched.length > 0 ? matched : rawCandidates).slice(0, 6);
}

function collectFrameHints(snapshot?: IntentE2EFailureContext['snapshot']): string[] {
  if (!snapshot?.frames?.length) return [];

  return uniqueStrings(
    snapshot.frames.flatMap((frame) => [
      frame.selectorHint,
      frame.elementId ? `#${frame.elementId}` : '',
      frame.elementName ? `iframe[name="${frame.elementName}"]` : '',
      (() => {
        try {
          return frame.url ? new URL(frame.url).pathname.split('/').filter(Boolean).pop() || frame.url : '';
        } catch {
          return frame.url || '';
        }
      })(),
    ]),
    4
  );
}

function buildFailureNextActions(input: {
  triage: Pick<IntentE2EFailureTriage, 'failureClass'>;
  diagnosis: Omit<IntentE2EFailureDiagnosis, 'nextActions'>;
}): string[] {
  const { triage, diagnosis } = input;
  const anchorText = diagnosis.targetAnchor ? `「${diagnosis.targetAnchor}」` : '目标控件';
  const candidateText = diagnosis.candidateAnchors.length > 0
    ? `优先从这些候选锚点重建定位：${diagnosis.candidateAnchors.slice(0, 3).join(' / ')}。`
    : '';

  switch (triage.failureClass) {
    case 'ui_anchor_missing':
      return uniqueStrings([
        `补页面契约：给 ${anchorText} 增加稳定的 label/title/data-testid 或明确的可见容器。`,
        diagnosis.frameHints.length > 0 ? '先确认真实控件是否位于 iframe 或嵌入上下文里，再决定定位策略。' : '',
        '如果这是当前项目特有的业务动作，优先沉淀为 project capability/helper，而不是继续在脚本里猜控件形态。',
      ], 3);
    case 'repair_stagnated':
      return uniqueStrings([
        '停止继续消耗自动修复额度，先核对失败签名、失败步骤和定位器是否完全重复。',
        diagnosis.targetAnchor ? `如果修复始终卡在 ${anchorText}，优先补页面契约或把该动作抽成项目级 capability。` : '',
        candidateText,
      ], 3);
    case 'target_row_not_found':
      return uniqueStrings([
        '优先从提交响应或列表检索响应里提取 businessId、orderId 等业务主键，改成按主键检索，不要继续放宽姓名或手机号文本匹配。',
        '如果列表检索接口已经返回目标记录，但 `__e2e.findAntdTableRow(...)` 仍未命中，改走详情页或详情抽屉断言联系人、手机号和状态，不要无限重试表格文本匹配。',
        candidateText,
      ], 3);
    case 'selector_drift':
      return uniqueStrings([
        diagnosis.failedLocator ? `先替换当前定位器「${diagnosis.failedLocator}」，改成基于可见锚点或容器的 scoped locator。` : '先替换当前脆弱定位器，改成基于可见锚点或容器的 scoped locator。',
        '优先复用已有 runtime helper（dropdown / row action / frame / api wait），不要回退成 click + waitForTimeout 拼装。',
        candidateText,
      ], 3);
    case 'assertion_too_strict':
      return uniqueStrings([
        '先确认业务动作是否已经完成，再把成功判定改成接口响应、状态变化或具体容器变化，不要继续用宽泛 truthy/模糊文案。',
        candidateText,
      ], 3);
    case 'workflow_gap':
      return uniqueStrings([
        '回到步骤顺序本身，先补齐导航、登录、iframe 进入或弹窗打开这类前置动作，再谈断言。',
        diagnosis.frameHints.length > 0 ? '当前页面存在 iframe 线索，优先确认是否缺少进入 frame 的步骤。' : '',
      ], 3);
    case 'data_missing':
      return ['先确认测试账号、筛选条件和种子数据是否满足前置条件，不要继续把空数据误修成脚本问题。'];
    case 'auth_failed':
      return ['先核对统一登录地址、账号凭证和登录方式说明；认证问题不应继续消耗脚本修复次数。'];
    case 'permission_blocked':
      return ['先核对当前账号是否具备目标页面和目标动作权限；权限阻塞不应继续消耗脚本修复次数。'];
    case 'env_transient':
      return ['先确认环境健康度、接口状态和网络波动；环境阻塞不应继续消耗脚本修复次数。'];
    default:
      return uniqueStrings([
        '先核对失败步骤、失败定位器和候选锚点，再决定是补页面契约还是调整脚本。',
        candidateText,
      ], 3);
  }
}

export function buildIntentE2EFailureSignature(input: {
  result: TestResult;
  triage?: Pick<IntentE2EFailureTriage, 'failureClass'> | null;
}): {
  key: string;
  anchorLabel: string;
  locator: string;
  summary: string;
  stepTitle: string;
} | null {
  if (input.result.success) return null;

  const failureClass = input.triage?.failureClass || 'unknown';
  const errorMessage = input.result.error || '';
  const anchorLabel = extractIntentE2EFailureAnchorLabel(errorMessage);
  const locator = extractIntentE2EFailureLocator(errorMessage);
  const summary = normalizeFailureSummary(errorMessage);
  const stepTitle = extractIntentE2EFailedStepTitle(input.result);

  return {
    key: `${failureClass}|${stepTitle || 'unknown-step'}|${anchorLabel || locator || summary || 'unknown-detail'}`,
    anchorLabel,
    locator,
    summary,
    stepTitle,
  };
}

export function buildIntentE2EFailureDiagnosis(
  triage: Pick<IntentE2EFailureTriage, 'failureClass'>,
  result: TestResult,
  context: IntentE2EFailureContext = {}
): IntentE2EFailureDiagnosis {
  const signature = buildIntentE2EFailureSignature({ result, triage });
  const anchorLabel = signature?.anchorLabel || '';
  const locator = signature?.locator || '';
  const pageUrl = clampText(context.pageUrl || context.snapshot?.url || '', 160);
  const candidateAnchors = collectSnapshotAnchorCandidates(context.snapshot, anchorLabel);
  const frameHints = collectFrameHints(context.snapshot);
  const diagnosisBase = {
    failureSignature: signature?.key || `${triage.failureClass}|unknown`,
    failedStepTitle: signature?.stepTitle || '',
    failedLocator: locator,
    targetAnchor: anchorLabel,
    pageUrl,
    repeatedCount: Math.max(1, Math.floor(context.repeatedCount || 1)),
    candidateAnchors,
    frameHints,
  };

  return {
    ...diagnosisBase,
    nextActions: buildFailureNextActions({
      triage,
      diagnosis: diagnosisBase,
    }),
  };
}

const TRIAGE_RULES: TriageRule[] = [
  {
    failureClass: 'auth_failed',
    repairable: false,
    summary: '判定为认证阻塞：登录流程或会话状态异常，本次不继续自动修复脚本。',
    signals: [
      { signal: '登录页停留', pattern: /登录后(?:再次访问目标页面)?仍停留在登录页/i },
      { signal: '登录页不可识别', pattern: /未能进入可识别的登录页/i },
      { signal: '缺少统一登录账号', pattern: /缺少\s*e2e_username/i },
      { signal: '缺少统一登录密码', pattern: /缺少\s*e2e_password/i },
      { signal: '登录说明或凭证异常', pattern: /请检查登录说明或凭证/i },
      { signal: '需要重新登录', pattern: /未登录|请先登录|登录已失效|session expired/i },
      { signal: '跳回登录页', pattern: /login page|sign in/i },
    ],
  },
  {
    failureClass: 'permission_blocked',
    repairable: false,
    summary: '判定为权限阻塞：当前账号似乎无权限访问目标内容，本次不继续自动修复脚本。',
    signals: [
      { signal: '无权限', pattern: /无权限|暂无权限|权限不足/i },
      { signal: '403', pattern: /\b403\b|forbidden|access denied/i },
      { signal: '权限拦截页', pattern: /没有权限|permission denied/i },
    ],
  },
  {
    failureClass: 'env_transient',
    repairable: false,
    summary: '判定为环境阻塞：检测到服务或网络异常，本次不继续自动修复脚本。',
    signals: [
      { signal: '服务开小差', pattern: /服务开小差|服务异常|系统繁忙/i },
      { signal: '稍后重试', pattern: /稍后重试|请稍后再试|稍后再试/i },
      { signal: '接口暂时异常', pattern: /接口(?:暂时)?异常|请求失败|response error/i },
      { signal: '网关错误', pattern: /\b502\b|\b503\b|\b504\b|bad gateway|service unavailable|gateway timeout/i },
      { signal: '网络连接异常', pattern: /econnreset|econnrefused|net::err|network error|连接重置|连接失败/i },
      { signal: '上游超时', pattern: /upstream timeout|timed out while waiting for response/i },
    ],
  },
  {
    failureClass: 'data_missing',
    repairable: false,
    summary: '判定为数据阻塞：页面缺少目标数据或查询结果为空，本次不继续自动修复脚本。',
    signals: [
      { signal: '暂无数据', pattern: /暂无数据|暂无相关数据|无数据/i },
      { signal: '查询为空', pattern: /未查询到|查询结果为空|搜索结果为空|没有搜索结果/i },
      { signal: '未找到记录', pattern: /未找到(?:任何)?记录|找不到目标数据|没有匹配数据/i },
      { signal: '未返回服务数据', pattern: /未返回任何(?:服务)?数据|当前未返回任何(?:服务)?数据/i },
      { signal: '空状态页', pattern: /空状态|empty state|列表为空/i },
    ],
  },
  {
    failureClass: 'ui_anchor_missing',
    repairable: false,
    summary: '判定为页面锚点缺失：当前页面没有找到业务要求里的关键切换/筛选控件，本次不继续自动修复脚本。',
    signals: [
      { signal: 'helper 未找到归属切换控件', pattern: /未找到商机列表归属切换控件/i },
      { signal: 'helper 已穷举视图切换入口', pattern: /已尝试 tab\/radio\/segmented(?:\/top dropdown)?\/form-item dropdown/i },
      { signal: 'helper 顶部归属菜单缺失目标项', pattern: /顶部归属菜单中不存在目标项|未能打开商机列表顶部归属菜单|顶部归属菜单切换后未激活目标项/i },
    ],
  },
  {
    failureClass: 'selector_drift',
    repairable: true,
    summary: '判定为定位器漂移：页面结构或可见性发生变化，继续自动修复脚本。',
    signals: [
      { signal: 'locator not found', pattern: /locator not found|waiting for locator|failed to find/i },
      { signal: 'locator API 失败', pattern: /locator\(|getByRole\(|getByText\(|getByPlaceholder\(/i },
      { signal: 'strict mode violation', pattern: /strict mode violation/i },
      { signal: '元素不可见', pattern: /element is not attached|element is outside of the viewport|element\(s\) not found|received:\s*hidden/i },
      { signal: '行操作缺失', pattern: /未找到行操作|row action not found|未找到按钮|未找到[“"'`].+?[”"'`]筛选标签/i },
    ],
  },
  {
    failureClass: 'workflow_gap',
    repairable: true,
    summary: '判定为流程缺口：当前脚本步骤编排不完整或顺序不对，继续自动修复脚本。',
    signals: [
      { signal: '业务流程缺口', pattern: /cannot read properties of null|is not a function|unexpected token/i },
      { signal: '页面切换缺口', pattern: /frame was detached|target page, context or browser has been closed/i },
      { signal: '步骤顺序不对', pattern: /before each|after each|navigation.*interrupted|execution context was destroyed/i },
    ],
  },
  {
    failureClass: 'assertion_too_strict',
    repairable: true,
    summary: '判定为断言过严：页面动作可能已经完成，但当前成功判定不够稳，继续自动修复脚本。',
    signals: [
      { signal: 'expect toBeTruthy', pattern: /expect\(received\)\.toBeTruthy\(\)|received:\s*false/i },
      { signal: 'expect matcher failed', pattern: /expect\((?:locator|received)[\s\S]*?\)\.[a-z]+/i },
      { signal: 'Expected/Received 对比', pattern: /expected:\s|received:\s/i },
      { signal: '可见性断言失败', pattern: /toBeVisible\(\)\s+failed|toBeHidden\(\)\s+failed|toHaveText\(\)\s+failed/i },
    ],
  },
];

function collectFailureText(result: TestResult, logs: Array<{ level: string; message: string }>): string {
  return [
    result.error || '',
    ...result.steps.map((step) => step.error || ''),
    ...logs.map((log) => log.message || ''),
  ]
    .filter(Boolean)
    .join('\n');
}

function findMatchedSignals(source: string, signals: SignalRule[]): string[] {
  if (!source.trim()) return [];
  return signals.filter((signal) => signal.pattern.test(source)).map((signal) => signal.signal);
}

export function classifyIntentE2EFailure(
  result: TestResult,
  logs: Array<{ level: string; message: string }> = [],
  context: IntentE2EFailureContext = {}
): IntentE2EFailureTriage | null {
  if (result.success) return null;

  const source = collectFailureText(result, logs);

  if (/状态证据缺失/i.test(source)) {
    const triage: IntentE2EFailureTriage = {
      failureClass: 'assertion_too_strict',
      repairable: true,
      summary: '判定为状态证据缺失：目标记录可能已经命中，但状态校验链尚未闭环，继续自动修复脚本。',
      matchedSignals: uniqueStrings([
        '状态证据缺失',
        /fallback 行已命中/i.test(source) ? 'fallback 行已命中' : '',
        /列表响应和详情字段都未返回状态/i.test(source) ? '列表响应和详情字段都未返回状态' : '',
      ]),
      diagnosis: null,
    };
    return {
      ...triage,
      diagnosis: buildIntentE2EFailureDiagnosis(triage, result, context),
    };
  }

  if (/未找到表格目标行/i.test(source) && looksLikeBusinessListContext(context)) {
    const triage: IntentE2EFailureTriage = {
      failureClass: 'target_row_not_found',
      repairable: true,
      summary: '判定为列表目标行定位失败：业务动作可能已完成，但回列表后的检索 / 主键回查还不够稳，继续自动修复脚本。',
      matchedSignals: uniqueStrings([
        'findAntdTableRow 未命中目标行',
        /hasTexts=/.test(source) ? '列表结果未命中业务主键' : '',
      ]),
      diagnosis: null,
    };
    return {
      ...triage,
      diagnosis: buildIntentE2EFailureDiagnosis(triage, result, context),
    };
  }

  for (const rule of TRIAGE_RULES) {
    const matchedSignals = findMatchedSignals(source, rule.signals);
    if (matchedSignals.length === 0) continue;
    const triage: IntentE2EFailureTriage = {
      failureClass: rule.failureClass,
      repairable: rule.repairable,
      summary: rule.summary,
      matchedSignals,
      diagnosis: null,
    };
    return {
      ...triage,
      diagnosis: buildIntentE2EFailureDiagnosis(triage, result, context),
    };
  }

  const triage: IntentE2EFailureTriage = {
    failureClass: 'unknown',
    repairable: true,
    summary: '暂未识别明确失败类型，先沿用自动修复策略。',
    matchedSignals: [],
    diagnosis: null,
  };

  return {
    ...triage,
    diagnosis: buildIntentE2EFailureDiagnosis(triage, result, context),
  };
}

export function formatIntentE2EFailureTriage(triage: IntentE2EFailureTriage): string {
  return triage.matchedSignals.length > 0 ? `${triage.summary} 命中特征：${triage.matchedSignals.join('、')}` : triage.summary;
}
