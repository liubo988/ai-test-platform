import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  getIntentProjectKnowledgePath,
  getIntentProjectKnowledgeProfile,
  mergeIntentProjectKnowledgeRules,
  type IntentProjectKnowledgeMergeSummary,
  type IntentProjectKnowledgeProfile,
  type IntentProjectKnowledgeRule,
  type IntentProjectKnowledgeStepPatch,
} from './intent-project-knowledge';
import {
  getIntentRepairMemoryPath,
  listIntentRepairMemoryClusters,
  type IntentRepairMemoryClusterSnapshot,
} from './ai/intent-repair-memory';

const DEFAULT_DRAFT_PATH = path.join(process.cwd(), 'reports', 'intent-e2e.project-knowledge.draft.json');
const MAX_TOKENS = 8;

export interface GenerateIntentProjectKnowledgeDraftOptions {
  minSeenCount?: number;
  minResolvedCount?: number;
  maxCandidates?: number;
}

export interface IntentProjectKnowledgeDraftCandidate {
  candidateId: string;
  confidence: number;
  category: string;
  clusterIds: string[];
  seenCount: number;
  resolvedCount: number;
  successRate: number;
  sampleUrls: string[];
  sampleTitles: string[];
  sampleDescriptions: string[];
  representativeErrors: string[];
  successfulStrategies: string[];
  antiPatterns: string[];
  alreadyCovered: boolean;
  coveredByRuleIds: string[];
  rule: IntentProjectKnowledgeRule;
}

export interface IntentProjectKnowledgeDraftSkippedItem {
  groupKey: string;
  category: string;
  clusterIds: string[];
  sampleUrls: string[];
  reason: string;
}

export interface IntentProjectKnowledgeDraft {
  version: 1;
  generatedAt: string;
  sourceMemoryPath: string;
  targetKnowledgePath: string;
  outputPath: string;
  thresholds: Required<GenerateIntentProjectKnowledgeDraftOptions>;
  summary: {
    totalClusters: number;
    eligibleClusters: number;
    candidateGroups: number;
    suggestedCandidates: number;
    alreadyCoveredCandidates: number;
    skippedItems: number;
  };
  candidates: IntentProjectKnowledgeDraftCandidate[];
  skipped: IntentProjectKnowledgeDraftSkippedItem[];
  mergedProfilePreview: IntentProjectKnowledgeProfile;
}

export interface MergeIntentProjectKnowledgeDraftCandidatesResult {
  writtenTo: string;
  backupPath: string | null;
  diffPreview: string;
  summary: IntentProjectKnowledgeMergeSummary;
  addedRuleIds: string[];
  skippedRuleIds: string[];
  mergedCandidateIds: string[];
  coveredCandidateIds: string[];
  missingCandidateIds: string[];
  profile: IntentProjectKnowledgeProfile;
}

interface ClusterGroup {
  groupKey: string;
  category: string;
  routeFragment: string;
  clusterIds: string[];
  seenCount: number;
  resolvedCount: number;
  successRate: number;
  sampleUrls: string[];
  sampleTitles: string[];
  sampleDescriptions: string[];
  representativeErrors: string[];
  successfulStrategies: string[];
  antiPatterns: string[];
  tags: string[];
}

interface CategoryRuleTemplate {
  titleSuffix: string;
  capabilitySlugs: string[];
  addGlobalRules: string[];
  addPreferredPrimitives: string[];
  addOutputContract: string[];
  promptNotes: string[];
  stepPatch: {
    whenStepTypes: IntentProjectKnowledgeStepPatch['whenStepTypes'];
    stepTextIncludes: string[];
    addAllowedActions: string[];
    addPreferredHelpers: string[];
    addRequiredAssertions: string[];
    addForbiddenPatterns: string[];
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function uniqueStrings(values: Array<string | null | undefined>, max = 99): string[] {
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

function truncate(text: string, max = 180): string {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > max ? `${normalized.slice(0, Math.max(0, max - 1))}…` : normalized;
}

function resolveDraftPath(): string {
  return process.env.INTENT_E2E_PROJECT_KNOWLEDGE_DRAFT_PATH?.trim() || DEFAULT_DRAFT_PATH;
}

export function getIntentProjectKnowledgeDraftPath(): string {
  const filePath = resolveDraftPath();
  const relative = path.relative(process.cwd(), filePath);
  return !relative || relative.startsWith('..') ? filePath : relative;
}

function normalizeRouteFragment(url: string): string {
  try {
    const parsed = new URL(url);
    const hash = (parsed.hash || '').replace(/^#/, '').trim();
    const hashPart = hash && hash !== '/' ? (hash.startsWith('/') ? hash : `/${hash}`) : '';
    const pathPart = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
    const raw = hashPart || pathPart || parsed.hostname;
    return raw.replace(/\/+/g, '/').replace(/\/\d{2,}(?=\/|$)/g, '/:num').replace(/\/+$/, '') || '/';
  } catch {
    return url.replace(/https?:\/\/[^/]+/i, '').replace(/\/+$/, '') || '/';
  }
}

function routeToIdToken(routeFragment: string): string {
  return routeFragment
    .replace(/^\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'root';
}

function selectPrimaryTitle(titles: string[]): string {
  return uniqueStrings(titles, 3)[0] || '';
}

function selectPageLabel(group: ClusterGroup): string {
  const title = selectPrimaryTitle(group.sampleTitles);
  if (title) return title;
  return group.routeFragment.split('/').filter(Boolean).slice(-1)[0] || '页面';
}

const KEYWORD_DICTIONARY = [
  '生成订单',
  'createOrder',
  '查看',
  '详情',
  '更多',
  '行操作',
  '企业名称',
  '商机来源',
  '来源',
  '性别',
  '渠道',
  '搜索',
  '筛选',
  '通讯录',
  '批量加入通讯录',
  '订单',
  '商机',
  '手机号',
  '联系人',
  'businessId',
  'orderId',
  '保存',
  '提交',
  '成功页',
  'Drawer',
  'Modal',
  'iframe',
];

function extractHighSignalKeywords(group: ClusterGroup): string[] {
  const source = [
    ...group.sampleTitles,
    ...group.sampleDescriptions,
    ...group.representativeErrors,
    group.routeFragment,
  ]
    .join('\n')
    .toLowerCase();

  return uniqueStrings(
    KEYWORD_DICTIONARY.filter((token) => source.includes(token.toLowerCase())).map((item) => item),
    MAX_TOKENS
  );
}

function capabilitySlugFromStrategy(strategy: string): string | null {
  if (/__e2e\.selectAntdOption|__e2e\.openAntdDropdown/i.test(strategy)) return 'ui.select-antd-option';
  if (/__e2e\.clickAntdRowAction/i.test(strategy)) return 'ui.click-antd-row-action';
  if (/__e2e\.getFrame|frameLocator\(/i.test(strategy)) return 'navigation.enter-iframe-context';
  if (/__e2e\.waitForApiResponse|page\.waitForResponse/i.test(strategy)) return 'assert.wait-for-api-response';
  if (/businessId|orderId|contactPhone|共享变量/i.test(strategy)) return 'extract.capture-shared-variable';
  return null;
}

const CATEGORY_TEMPLATES: Record<string, CategoryRuleTemplate> = {
  'antd-dropdown-not-opened': {
    titleSuffix: '下拉打开稳定化',
    capabilitySlugs: ['ui.select-antd-option'],
    addGlobalRules: ['涉及 Ant Design 下拉时，必须先确保当前字段真正打开了可见 dropdown，再继续选择枚举值。'],
    addPreferredPrimitives: ['open_dropdown(field): 在当前字段作用域内稳定打开可见 dropdown'],
    addOutputContract: ['下拉场景不要退回 click + waitForTimeout 的脆弱写法，优先保留 helper 路径。'],
    promptNotes: ['历史失败显示该页面的下拉经常没有真正打开；修复时优先使用 __e2e.openAntdDropdown / __e2e.selectAntdOption。'],
    stepPatch: {
      whenStepTypes: ['ui', 'assert'],
      stepTextIncludes: ['下拉', '枚举', '选择', '来源', '企业名称', '性别', '渠道'],
      addAllowedActions: ['open_dropdown', 'select_option', 'wait_for_ui'],
      addPreferredHelpers: ['__e2e.openAntdDropdown', '__e2e.selectAntdOption'],
      addRequiredAssertions: ['必须确认当前字段的可见 dropdown 已打开，再选择目标选项'],
      addForbiddenPatterns: ['重复等待 hidden dropdown', '把 page.waitForTimeout 当成打开下拉的主手段'],
    },
  },
  'antd-option-not-visible': {
    titleSuffix: '下拉选项可见性稳定化',
    capabilitySlugs: ['ui.select-antd-option'],
    addGlobalRules: ['长列表 / TreeSelect 选项默认可能不在初始可见范围，应先搜索或滚动后再点击。'],
    addPreferredPrimitives: ['select_option(field, label, searchText?): 在 dropdown 内搜索/滚动后再点击目标选项'],
    addOutputContract: ['不要一打开下拉就强行 expect(option).toBeVisible()；先缩小范围再操作。'],
    promptNotes: ['历史失败显示目标枚举值常在树形或滚动区之外；优先用 helper 的 searchText/tree 模式。'],
    stepPatch: {
      whenStepTypes: ['ui', 'assert'],
      stepTextIncludes: ['下拉', '枚举', '树', '选择', '来源', '企业名称', '性别'],
      addAllowedActions: ['select_option', 'wait_for_ui'],
      addPreferredHelpers: ['__e2e.selectAntdOption'],
      addRequiredAssertions: ['对长列表枚举项先搜索或 scrollIntoViewIfNeeded，再点击目标选项'],
      addForbiddenPatterns: ['一打开下拉就对目标 option 做 toBeVisible 断言'],
    },
  },
  'row-action-not-found': {
    titleSuffix: '表格行操作稳定化',
    capabilitySlugs: ['ui.click-antd-row-action'],
    addGlobalRules: ['表格动作必须先定位目标行，再打开行尾菜单点击目标动作，不要假设行内有固定按钮。'],
    addPreferredPrimitives: ['click_row_action(row, label): 在目标行内稳定点击查看/生成订单/更多'],
    addOutputContract: ['行操作场景必须显式保留“定位行 -> 触发菜单 -> 点击动作”的实现顺序。'],
    promptNotes: ['历史失败显示该页面的“查看 / 生成订单 / 更多”经常不以内联按钮存在，优先使用 __e2e.clickAntdRowAction。'],
    stepPatch: {
      whenStepTypes: ['ui', 'assert', 'extract'],
      stepTextIncludes: ['查看', '详情', '更多', '行操作', '生成订单', '菜单'],
      addAllowedActions: ['find_table_row', 'click_row_action', 'wait_for_ui'],
      addPreferredHelpers: ['__e2e.clickAntdRowAction'],
      addRequiredAssertions: ['必须先精确定位目标行，再触发行尾动作'],
      addForbiddenPatterns: ['不先定位目标行就全局点击“查看/生成订单/更多”'],
    },
  },
  'iframe-context-mismatch': {
    titleSuffix: 'Iframe 上下文稳定化',
    capabilitySlugs: ['navigation.enter-iframe-context'],
    addGlobalRules: ['如果真实业务控件位于 iframe 内，必须先进入正确 frame，再在 frame 内执行输入、点击和断言。'],
    addPreferredPrimitives: ['enter_frame_context(selector, urlIncludes?): 使用 __e2e.getFrame 进入真实业务 frame'],
    addOutputContract: ['iframe 场景必须体现“先进入 frame，再执行动作”的顺序。'],
    promptNotes: ['历史失败显示脚本常在顶层 page 上等待 frame 内控件，优先使用 __e2e.getFrame。'],
    stepPatch: {
      whenStepTypes: ['ui', 'assert'],
      stepTextIncludes: ['iframe', '搜索', '结果', '企业', '筛选'],
      addAllowedActions: ['enter_frame_context', 'wait_for_ui'],
      addPreferredHelpers: ['__e2e.getFrame'],
      addRequiredAssertions: ['先确认 frame 内关键输入框/按钮可见，再继续执行后续动作'],
      addForbiddenPatterns: ['在顶层 page 上直接等待 frame 内 placeholder', '臆造 iframe[name=...] 选择器'],
    },
  },
  'api-success-followup-assertion': {
    titleSuffix: '接口成功后断言稳定化',
    capabilitySlugs: ['assert.wait-for-api-response'],
    addGlobalRules: ['提交/生成类场景优先以关键接口成功响应为主，再补 UI 状态收敛断言。'],
    addPreferredPrimitives: ['wait_for_response(matcher): 在点击提交前先注册接口等待'],
    addOutputContract: ['不要只看宽泛成功 toast，至少保留接口成功和 UI 收敛中的两类证据。'],
    promptNotes: ['历史失败显示脚本经常在接口成功后继续用模糊成功文案或不稳定 follow-up 行为做主断言。'],
    stepPatch: {
      whenStepTypes: ['ui', 'api', 'assert'],
      stepTextIncludes: ['提交', '保存', '确定', '成功页', '生成订单', '订单'],
      addAllowedActions: ['wait_for_response', 'assert_response_ok', 'assert_state'],
      addPreferredHelpers: ['__e2e.waitForApiResponse'],
      addRequiredAssertions: ['关键接口响应成功后，再校验 Drawer/Modal 关闭或业务状态变化'],
      addForbiddenPatterns: ['只看 page.getByText(/成功/i).first() 这类宽泛成功断言'],
    },
  },
  'shared-variable-extraction-unstable': {
    titleSuffix: '共享变量提取稳定化',
    capabilitySlugs: ['extract.capture-shared-variable'],
    addGlobalRules: ['共享变量必须来自真实 UI 或接口响应提取，并在提取后立即做强校验。'],
    addPreferredPrimitives: ['extract_text(target, variable): 提取 businessId/orderId/手机号等真实变量并复用'],
    addOutputContract: ['不要把核心字段断言弱化成 truthy/非空即可，应明确变量来源与后续用途。'],
    promptNotes: ['历史失败显示脚本经常没有稳定提取 businessId/orderId/联系人等变量，导致后续断言漂移。'],
    stepPatch: {
      whenStepTypes: ['extract', 'ui', 'assert'],
      stepTextIncludes: ['提取', 'businessId', 'orderId', '手机号', '联系人', '变量'],
      addAllowedActions: ['extract_text', 'store_variable', 'assert_variable'],
      addPreferredHelpers: [],
      addRequiredAssertions: ['提取后的共享变量必须立即校验，并在后续步骤显式复用'],
      addForbiddenPatterns: ['把核心字段断言弱化成 toBeTruthy()/非空即可'],
    },
  },
  'page-bootstrap-race': {
    titleSuffix: '页面初始化等待稳定化',
    capabilitySlugs: ['assert.wait-for-api-response'],
    addGlobalRules: ['页面初始化 / 筛选 / 默认数据加载未稳定前，不要立即开始读取表格或触发断言。'],
    addPreferredPrimitives: ['wait_for_ui/loading: 先等待筛选区、默认数据和 loading 消失，再读结果'],
    addOutputContract: ['初始化易抖页面必须体现“等待页面稳定 -> 再操作/断言”的顺序。'],
    promptNotes: ['历史失败显示页面在初始化和筛选阶段存在 race，优先等待 loading 消失或关键请求完成。'],
    stepPatch: {
      whenStepTypes: ['ui', 'assert', 'extract'],
      stepTextIncludes: ['搜索', '筛选', '列表', '加载', '初始化', '结果'],
      addAllowedActions: ['wait_for_ui', 'wait_for_response', 'assert_state'],
      addPreferredHelpers: [],
      addRequiredAssertions: ['在读取列表或结果前，必须确认页面初始化与 loading 已稳定'],
      addForbiddenPatterns: ['页面刚可见就立刻搜索并读取结果'],
    },
  },
  'generic-locator-failure': {
    titleSuffix: '高频定位失败收敛',
    capabilitySlugs: [],
    addGlobalRules: ['命中高频定位失败时，优先收敛到页面快照中已存在的稳定字段元数据与作用域。'],
    addPreferredPrimitives: ['scope(container): 先收窄到 form-item / modal / row / frame 再定位'],
    addOutputContract: ['不要为通过而扩大成无关重写，应在当前步骤语义内收敛修复。'],
    promptNotes: ['历史失败显示该页面存在重复定位漂移，应优先使用更稳定的作用域与字段元数据。'],
    stepPatch: {
      whenStepTypes: ['ui', 'assert', 'extract'],
      stepTextIncludes: ['定位', '字段', '按钮', '列表'],
      addAllowedActions: ['scope', 'locate', 'wait_for_ui'],
      addPreferredHelpers: [],
      addRequiredAssertions: ['修复时优先使用页面快照里更稳定的定位信息'],
      addForbiddenPatterns: ['大范围 try/catch 掩盖真实定位失败'],
    },
  },
};

function buildGroup(clusters: IntentRepairMemoryClusterSnapshot[], routeFragment: string, category: string): ClusterGroup {
  const clusterIds = uniqueStrings(clusters.map((item) => item.clusterId), 99);
  const seenCount = clusters.reduce((sum, item) => sum + item.seenCount, 0);
  const resolvedCount = clusters.reduce((sum, item) => sum + item.resolvedCount, 0);
  const successRate = seenCount > 0 ? Number((resolvedCount / seenCount).toFixed(3)) : 0;

  return {
    groupKey: `${routeFragment}|${category}`,
    category,
    routeFragment,
    clusterIds,
    seenCount,
    resolvedCount,
    successRate,
    sampleUrls: uniqueStrings(clusters.flatMap((item) => item.sampleUrls), 12),
    sampleTitles: uniqueStrings(clusters.flatMap((item) => item.sampleTitles), 6),
    sampleDescriptions: uniqueStrings(clusters.flatMap((item) => item.sampleDescriptions), 8),
    representativeErrors: uniqueStrings(clusters.flatMap((item) => [item.representativeError]), 6),
    successfulStrategies: uniqueStrings(clusters.flatMap((item) => item.successfulStrategies), 12),
    antiPatterns: uniqueStrings(clusters.flatMap((item) => item.antiPatterns), 12),
    tags: uniqueStrings(clusters.flatMap((item) => item.tags), 12),
  };
}

function buildCandidateId(group: ClusterGroup): string {
  return `auto.${routeToIdToken(group.routeFragment)}.${group.category}`;
}

function buildConfidence(group: ClusterGroup): number {
  const score = Math.min(group.seenCount * 0.12 + group.resolvedCount * 0.2 + group.successRate * 0.45 + group.successfulStrategies.length * 0.04, 0.99);
  return Number(score.toFixed(3));
}

function inferCapabilitySlugs(group: ClusterGroup, template: CategoryRuleTemplate): string[] {
  return uniqueStrings([
    ...template.capabilitySlugs,
    ...group.successfulStrategies.map((item) => capabilitySlugFromStrategy(item)),
  ]);
}

function inferPreferredHelpers(group: ClusterGroup, template: CategoryRuleTemplate): string[] {
  return uniqueStrings([
    ...template.stepPatch.addPreferredHelpers,
    ...group.successfulStrategies.filter((item) => item.startsWith('__e2e.')),
  ]);
}

function buildPromptNotes(group: ClusterGroup, template: CategoryRuleTemplate): string[] {
  const strategies = group.successfulStrategies.length > 0 ? `历史高频有效修法：${group.successfulStrategies.join(' / ')}` : '';
  const antiPatterns = group.antiPatterns.length > 0 ? `历史高频误区：${group.antiPatterns.join(' / ')}` : '';
  const errors = group.representativeErrors.length > 0 ? `代表失败：${group.representativeErrors.slice(0, 2).join(' / ')}` : '';

  return uniqueStrings([...template.promptNotes, strategies, antiPatterns, errors], 8);
}

function buildStepPatch(group: ClusterGroup, template: CategoryRuleTemplate): IntentProjectKnowledgeStepPatch {
  const derivedKeywords = extractHighSignalKeywords(group);
  const preferredHelpers = inferPreferredHelpers(group, template);
  const additionalAssertions = group.successfulStrategies.length > 0 ? [`优先沿用已验证修法：${group.successfulStrategies.join(' / ')}`] : [];

  return {
    whenStepTypes: [...(template.stepPatch.whenStepTypes || [])],
    stepTextIncludes: uniqueStrings([...template.stepPatch.stepTextIncludes, ...derivedKeywords], MAX_TOKENS),
    addAllowedActions: [...template.stepPatch.addAllowedActions],
    addPreferredHelpers: preferredHelpers,
    addRequiredAssertions: uniqueStrings([...template.stepPatch.addRequiredAssertions, ...additionalAssertions], 8),
    addForbiddenPatterns: uniqueStrings([...template.stepPatch.addForbiddenPatterns, ...group.antiPatterns], 8),
  };
}

function buildMatch(group: ClusterGroup): IntentProjectKnowledgeRule['match'] {
  const titles = uniqueStrings(group.sampleTitles, 2);
  const keywords = extractHighSignalKeywords(group);
  return {
    urlIncludes: uniqueStrings([group.routeFragment, ...group.sampleUrls.map((item) => normalizeRouteFragment(item))], 3),
    titleIncludes: titles,
    descriptionIncludes: keywords.slice(0, 5),
  };
}

function buildRule(group: ClusterGroup): IntentProjectKnowledgeRule {
  const template = CATEGORY_TEMPLATES[group.category] || CATEGORY_TEMPLATES['generic-locator-failure'];
  const capabilitySlugs = inferCapabilitySlugs(group, template);
  const pageLabel = selectPageLabel(group);
  const categoryNote = `该规则由 repair memory 自动草拟：seen=${group.seenCount}, resolved=${group.resolvedCount}, successRate=${group.successRate}`;

  return {
    id: buildCandidateId(group),
    title: `${pageLabel} · ${template.titleSuffix}`,
    enabled: true,
    match: buildMatch(group),
    promptNotes: uniqueStrings([...buildPromptNotes(group, template), categoryNote], 10),
    capabilitySlugs,
    addGlobalRules: uniqueStrings([...template.addGlobalRules], 8),
    addPreferredPrimitives: uniqueStrings([...template.addPreferredPrimitives], 8),
    addOutputContract: uniqueStrings([...template.addOutputContract], 8),
    stepPatches: [buildStepPatch(group, template)],
  };
}

function collectRuleCoverageTokens(rule: IntentProjectKnowledgeRule): {
  urls: string[];
  capabilities: string[];
  helpers: string[];
} {
  return {
    urls: uniqueStrings(rule.match.urlIncludes || [], 8),
    capabilities: uniqueStrings(rule.capabilitySlugs || [], 8),
    helpers: uniqueStrings(rule.stepPatches.flatMap((patch) => patch.addPreferredHelpers || []), 12),
  };
}

function resolveCoverage(rule: IntentProjectKnowledgeRule, existingRules: IntentProjectKnowledgeRule[]): string[] {
  const candidate = collectRuleCoverageTokens(rule);

  return existingRules
    .filter((item) => {
      const current = collectRuleCoverageTokens(item);
      const urlOverlap = candidate.urls.some((url) => current.urls.includes(url));
      if (!urlOverlap) return false;

      const capabilityOverlap = candidate.capabilities.some((slug) => current.capabilities.includes(slug));
      const helperOverlap = candidate.helpers.some((helper) => current.helpers.includes(helper));
      return capabilityOverlap || helperOverlap;
    })
    .map((item) => item.id);
}

function buildClustersGroups(clusters: IntentRepairMemoryClusterSnapshot[], thresholds: Required<GenerateIntentProjectKnowledgeDraftOptions>) {
  const eligible = clusters.filter((item) => item.seenCount >= thresholds.minSeenCount && item.resolvedCount >= thresholds.minResolvedCount);
  const grouped = new Map<string, IntentRepairMemoryClusterSnapshot[]>();

  for (const cluster of eligible) {
    const routeFragment = normalizeRouteFragment(cluster.sampleUrls[0] || '/');
    const groupKey = `${routeFragment}|${cluster.category}`;
    const bucket = grouped.get(groupKey) || [];
    bucket.push(cluster);
    grouped.set(groupKey, bucket);
  }

  return {
    eligible,
    groups: [...grouped.entries()].map(([groupKey, items]) => {
      const [routeFragment, category] = groupKey.split('|');
      return buildGroup(items, routeFragment, category);
    }),
  };
}

export async function generateIntentProjectKnowledgeDraft(
  options: GenerateIntentProjectKnowledgeDraftOptions = {}
): Promise<IntentProjectKnowledgeDraft> {
  const thresholds: Required<GenerateIntentProjectKnowledgeDraftOptions> = {
    minSeenCount: Math.max(1, Math.floor(options.minSeenCount ?? 2)),
    minResolvedCount: Math.max(1, Math.floor(options.minResolvedCount ?? 1)),
    maxCandidates: Math.max(1, Math.floor(options.maxCandidates ?? 12)),
  };

  const clusters = await listIntentRepairMemoryClusters();
  const existingProfile = getIntentProjectKnowledgeProfile();
  const sourceMemoryPath = getIntentRepairMemoryPath();
  const targetKnowledgePath = getIntentProjectKnowledgePath();
  const outputPath = getIntentProjectKnowledgeDraftPath();
  const { eligible, groups } = buildClustersGroups(clusters, thresholds);

  const skipped: IntentProjectKnowledgeDraftSkippedItem[] = [];
  const candidates = groups
    .map((group) => {
      const rule = buildRule(group);
      const coveredByRuleIds = resolveCoverage(rule, existingProfile.rules);
      return {
        candidateId: createHash('sha1').update(`${group.groupKey}|${group.clusterIds.join(',')}`).digest('hex').slice(0, 12),
        confidence: buildConfidence(group),
        category: group.category,
        clusterIds: [...group.clusterIds],
        seenCount: group.seenCount,
        resolvedCount: group.resolvedCount,
        successRate: group.successRate,
        sampleUrls: [...group.sampleUrls],
        sampleTitles: [...group.sampleTitles],
        sampleDescriptions: [...group.sampleDescriptions],
        representativeErrors: [...group.representativeErrors],
        successfulStrategies: [...group.successfulStrategies],
        antiPatterns: [...group.antiPatterns],
        alreadyCovered: coveredByRuleIds.length > 0,
        coveredByRuleIds,
        rule,
      } satisfies IntentProjectKnowledgeDraftCandidate;
    })
    .sort((a, b) => b.confidence - a.confidence || b.resolvedCount - a.resolvedCount || b.seenCount - a.seenCount)
    .slice(0, thresholds.maxCandidates);

  for (const group of groups.slice(thresholds.maxCandidates)) {
    skipped.push({
      groupKey: group.groupKey,
      category: group.category,
      clusterIds: [...group.clusterIds],
      sampleUrls: [...group.sampleUrls],
      reason: `超过 maxCandidates=${thresholds.maxCandidates}`,
    });
  }

  const mergedProfilePreview: IntentProjectKnowledgeProfile = {
    version: 1,
    rules: [...existingProfile.rules, ...candidates.filter((item) => !item.alreadyCovered).map((item) => item.rule)],
  };

  return {
    version: 1,
    generatedAt: nowIso(),
    sourceMemoryPath,
    targetKnowledgePath,
    outputPath,
    thresholds,
    summary: {
      totalClusters: clusters.length,
      eligibleClusters: eligible.length,
      candidateGroups: groups.length,
      suggestedCandidates: candidates.filter((item) => !item.alreadyCovered).length,
      alreadyCoveredCandidates: candidates.filter((item) => item.alreadyCovered).length,
      skippedItems: skipped.length,
    },
    candidates,
    skipped,
    mergedProfilePreview,
  };
}

export async function writeIntentProjectKnowledgeDraft(
  draft: IntentProjectKnowledgeDraft,
  outputPath = resolveDraftPath()
): Promise<string> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(draft, null, 2), 'utf8');
  const relative = path.relative(process.cwd(), outputPath);
  return !relative || relative.startsWith('..') ? outputPath : relative;
}

export async function mergeIntentProjectKnowledgeDraftCandidates(
  draft: IntentProjectKnowledgeDraft,
  candidateIds: string[] = []
): Promise<MergeIntentProjectKnowledgeDraftCandidatesResult> {
  const requestedCandidateIds = uniqueStrings(
    candidateIds.length > 0
      ? candidateIds
      : draft.candidates.filter((candidate) => !candidate.alreadyCovered).map((candidate) => candidate.candidateId)
  );
  const selectedCandidates = draft.candidates.filter((candidate) => requestedCandidateIds.includes(candidate.candidateId));
  const selectedCandidateIdSet = new Set(selectedCandidates.map((candidate) => candidate.candidateId));
  const missingCandidateIds = requestedCandidateIds.filter((candidateId) => !selectedCandidateIdSet.has(candidateId));
  const coveredCandidates = selectedCandidates.filter((candidate) => candidate.alreadyCovered);
  const mergeCandidates = selectedCandidates.filter((candidate) => !candidate.alreadyCovered);
  const mergeResult = await mergeIntentProjectKnowledgeRules(mergeCandidates.map((candidate) => candidate.rule));
  const addedRuleIdSet = new Set(mergeResult.addedRuleIds);

  return {
    writtenTo: mergeResult.writtenTo,
    backupPath: mergeResult.backupPath,
    diffPreview: mergeResult.diffPreview,
    summary: mergeResult.summary,
    addedRuleIds: mergeResult.addedRuleIds,
    skippedRuleIds: mergeResult.skippedRuleIds,
    mergedCandidateIds: mergeCandidates
      .filter((candidate) => addedRuleIdSet.has(candidate.rule.id))
      .map((candidate) => candidate.candidateId),
    coveredCandidateIds: coveredCandidates.map((candidate) => candidate.candidateId),
    missingCandidateIds,
    profile: mergeResult.profile,
  };
}

export function renderIntentProjectKnowledgeDraftSummary(draft: IntentProjectKnowledgeDraft): string {
  const lines = [
    `repair memory clusters=${draft.summary.totalClusters}`,
    `eligible=${draft.summary.eligibleClusters}`,
    `candidateGroups=${draft.summary.candidateGroups}`,
    `suggested=${draft.summary.suggestedCandidates}`,
    `covered=${draft.summary.alreadyCoveredCandidates}`,
  ];

  for (const candidate of draft.candidates.slice(0, 5)) {
    lines.push(
      `- ${candidate.rule.id} | category=${candidate.category} | confidence=${candidate.confidence} | seen=${candidate.seenCount} | resolved=${candidate.resolvedCount}${
        candidate.alreadyCovered ? ` | coveredBy=${candidate.coveredByRuleIds.join(',')}` : ''
      }`
    );
  }

  return lines.join('\n');
}
