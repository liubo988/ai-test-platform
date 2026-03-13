import { createHash } from 'node:crypto';
import { describeCapabilityVerification, type CapabilityVerificationStatus } from './capability-verification';
import { normalizeKnowledgeText, type CapabilityType } from './project-knowledge';

type KnowledgeSourceType = 'manual' | 'notes' | 'execution' | 'system';

export type KnowledgeDocumentForDerive = {
  documentUid: string;
  name: string;
  sourceType: KnowledgeSourceType;
  meta: unknown;
};

export type KnowledgeChunkForDerive = {
  chunkUid: string;
  documentUid: string;
  heading: string;
  content: string;
  keywords: string[];
  sourceLineStart: number;
  sourceLineEnd: number;
  tokenEstimate: number;
  sortOrder: number;
  meta: unknown;
};

export type ExistingCapabilityForDerive = {
  capabilityUid: string;
  slug: string;
  name: string;
  capabilityType: CapabilityType;
  entryUrl: string;
  sourceDocumentUid: string;
  status: 'active' | 'archived';
  meta: unknown;
};

export type DerivedCapabilityInput = {
  slug: string;
  name: string;
  description: string;
  capabilityType: CapabilityType;
  entryUrl: string;
  triggerPhrases: string[];
  preconditions: string[];
  steps: string[];
  assertions: string[];
  cleanupNotes: string;
  dependsOn: string[];
  sortOrder: number;
  sourceDocumentUid: string;
  meta: Record<string, unknown>;
};

export type DerivedCapabilityResult = {
  items: DerivedCapabilityInput[];
  skipped: Array<{
    chunkUid: string;
    reason: string;
    capabilityName: string;
  }>;
  summary: {
    requestedChunks: number;
    derivedCount: number;
    skippedCount: number;
    executionVerifiedCount: number;
    knowledgeInferredCount: number;
  };
};

type DeriveInput = {
  document: KnowledgeDocumentForDerive;
  chunks: KnowledgeChunkForDerive[];
  projectLoginUrl?: string;
  existingCapabilities?: ExistingCapabilityForDerive[];
};

type DraftKind = 'auth' | 'navigation' | 'action' | 'query' | 'assertion';

type CapabilityDraftCandidate = Omit<DerivedCapabilityInput, 'slug'> & {
  slugSeed: string;
  chunkUid: string;
  kind: DraftKind;
};

const NAVIGATION_HINTS: Array<{ pattern: RegExp; hashPath: string }> = [
  { pattern: /新增商机|创建商机|商机录入/, hashPath: '#/business/createbusiness' },
  { pattern: /商机列表/, hashPath: '#/business/businesslist' },
  { pattern: /订单列表/, hashPath: '#/order/list' },
  { pattern: /入账管理/, hashPath: '#/payment/bookedMgmt' },
  { pattern: /搜企业/, hashPath: '#/company/easyindex' },
];

const ACTION_VERBS = /(创建|新增|提交|保存|申请|导入|导出|批量|填写|选择|点击|下单|转订单|转单|上传|下载|作废|编辑|删除)/;
const QUERY_VERBS = /(检索|查询|搜索|筛选|查找)/;
const ASSERTION_HINTS = /(校验|验证|核对|确认|展示|显示|可见|一致|成功|正确|存在|加载完成)/;
const SIDE_EFFECT_HINTS = /(收藏|通讯录|联系企业|完善企业信息|设置标签|删除|编辑|拨号)/;

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function stableHash(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 8);
}

function resolveProjectUrl(projectLoginUrl: string | undefined, hashPath: string): string {
  if (!hashPath) return '';
  if (!projectLoginUrl) return '';
  try {
    const url = new URL(projectLoginUrl);
    return `${url.origin}${url.pathname}${hashPath}`;
  } catch {
    return '';
  }
}

function normalizeHeading(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function splitSentences(content: string): string[] {
  return uniq(
    normalizeKnowledgeText(content)
      .replace(/[。！？；]/g, '\n')
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function isCompanySearchContext(heading: string, content: string): boolean {
  const haystack = `${normalizeHeading(heading)}\n${normalizeKnowledgeText(content)}`;
  return /搜企业/.test(haystack) && /企业名称|统一信用代码|股东/.test(haystack);
}

function extractAssertionHints(content: string): string[] {
  const sentences = splitSentences(content);
  return uniq(sentences.filter((item) => ASSERTION_HINTS.test(item) || /支持/.test(item)).slice(0, 4));
}

function buildQuerySteps(heading: string, content: string): string[] {
  const normalizedHeading = normalizeHeading(heading) || '当前页面';
  if (isCompanySearchContext(heading, content)) {
    return ['在搜企业页输入企业名称、统一信用代码或股东关键词', '执行搜索'];
  }

  const searchTarget = extractSearchTarget(content);
  const querySentences = splitSentences(content).filter(
    (item) => !SIDE_EFFECT_HINTS.test(item) && (QUERY_VERBS.test(item) || /可使用.+搜索|输入.+(?:搜索|检索|筛选)/.test(item))
  );

  if (querySentences.length > 0) {
    return uniq(querySentences.slice(0, 4));
  }

  return [searchTarget ? `输入${searchTarget}并执行搜索` : `在${normalizedHeading}页输入筛选条件并执行搜索`];
}

function buildQueryAssertions(heading: string, content: string): string[] {
  if (isCompanySearchContext(heading, content)) {
    return ['列表展示企业搜索结果', '结果项显示企业名称或企业状态'];
  }

  const hints = extractAssertionHints(content).filter((item) => !SIDE_EFFECT_HINTS.test(item));
  if (hints.length > 0) {
    return hints;
  }

  const searchTarget = extractSearchTarget(content);
  return [searchTarget ? `列表展示匹配${searchTarget}的结果` : '列表展示搜索结果'];
}

function inferEntryUrl(heading: string, content: string, projectLoginUrl?: string): string {
  const haystack = `${heading}\n${content}`;
  for (const item of NAVIGATION_HINTS) {
    if (item.pattern.test(haystack)) {
      return resolveProjectUrl(projectLoginUrl, item.hashPath);
    }
  }
  return '';
}

function inferNavigationName(heading: string, content: string): string {
  const haystack = `${heading}\n${content}`;
  if (/短信|验证码/.test(haystack) && /登录/.test(haystack)) return '';
  if (/新增商机|创建商机|商机录入/.test(haystack)) return '进入创建商机页';
  if (/商机列表/.test(haystack)) return '进入商机列表页';
  if (/订单列表/.test(haystack)) return '进入订单列表页';
  if (/入账管理/.test(haystack)) return '进入入账管理页';
  if (/搜企业/.test(haystack)) return '进入搜企业页';

  const normalizedHeading = normalizeHeading(heading);
  if (!normalizedHeading) return '';
  if (/(列表|管理|首页|详情|设置|页面)$/.test(normalizedHeading)) {
    return normalizedHeading.startsWith('进入') ? normalizedHeading : `进入${normalizedHeading}`;
  }
  return '';
}

function extractSearchTarget(content: string): string {
  const match = content.match(/按([^，。；\n]+?)(?:检索|查询|搜索)/);
  if (!match?.[1]) return '';
  return match[1].replace(/\s+/g, '').replace(/、/g, '、').trim();
}

function inferPrimaryKind(heading: string, content: string): DraftKind | '' {
  const haystack = `${heading}\n${content}`;
  if (/短信|验证码/.test(haystack) && /登录/.test(haystack)) return 'auth';
  if (QUERY_VERBS.test(haystack)) return 'query';
  if (ACTION_VERBS.test(haystack)) return 'action';
  if (ASSERTION_HINTS.test(haystack)) return 'assertion';
  if (inferNavigationName(heading, content)) return 'navigation';
  return '';
}

function inferPrimaryName(kind: DraftKind, heading: string, content: string): string {
  const normalizedHeading = normalizeHeading(heading) || '知识块';
  const haystack = `${heading}\n${content}`;
  if (kind === 'auth') {
    if (/短信|验证码/.test(haystack)) return '短信密码登录';
    return `${normalizedHeading}登录`;
  }
  if (kind === 'query') {
    if (isCompanySearchContext(heading, content)) return '搜企业检索';
    const searchTarget = extractSearchTarget(content);
    if (/商机列表/.test(normalizedHeading) && searchTarget) {
      return `商机列表按${searchTarget}检索`;
    }
    if (/订单列表/.test(normalizedHeading) && searchTarget) {
      return `订单列表按${searchTarget}检索`;
    }
    return searchTarget ? `${normalizedHeading}按${searchTarget}检索` : `${normalizedHeading}检索`;
  }
  if (kind === 'action') {
    if (/创建商机|新增商机|商机录入/.test(haystack)) return '创建商机主链路';
    if (/生成订单|创建订单|下单/.test(haystack)) return '创建订单主链路';
    if (/批量入账|申请入账/.test(haystack)) return '订单批量入账';
    if (/导出/.test(haystack)) return `${normalizedHeading}导出`;
    if (/导入/.test(haystack)) return `${normalizedHeading}导入`;
    return `${normalizedHeading}核心动作`;
  }
  if (kind === 'assertion') {
    return `${normalizedHeading}结果校验`;
  }
  return inferNavigationName(heading, content) || normalizedHeading;
}

function extractActionSteps(content: string): string[] {
  const sentences = splitSentences(content);
  const matched = sentences.filter((item) => ACTION_VERBS.test(item) || QUERY_VERBS.test(item));
  return uniq((matched.length > 0 ? matched : sentences).slice(0, 6));
}

function extractAssertions(content: string): string[] {
  const sentences = splitSentences(content);
  const matched = sentences.filter((item) => ASSERTION_HINTS.test(item) || /支持/.test(item));
  return uniq((matched.length > 0 ? matched : sentences.slice(0, 3)).slice(0, 4));
}

function buildMeta(input: {
  document: KnowledgeDocumentForDerive;
  chunk: KnowledgeChunkForDerive;
  kind: DraftKind;
  verificationStatus: CapabilityVerificationStatus;
}): Record<string, unknown> {
  return {
    source: 'knowledge_chunk_auto',
    verificationStatus: input.verificationStatus,
    autoDerived: {
      documentUid: input.document.documentUid,
      chunkUid: input.chunk.chunkUid,
      kind: input.kind,
      heading: input.chunk.heading,
      lineRange:
        input.chunk.sourceLineStart > 0 && input.chunk.sourceLineEnd > 0
          ? `L${input.chunk.sourceLineStart}-${input.chunk.sourceLineEnd}`
          : '',
    },
    sourceType: input.document.sourceType,
  };
}

function entryUrlHint(entryUrl: string): string {
  const tokens = entryUrl
    .split('#/')
    .pop()
    ?.toLowerCase()
    .match(/[a-z0-9]+/g);
  if (!tokens?.length) return 'chunk';
  return tokens.slice(-2).join('-');
}

function buildSlug(type: CapabilityType, candidate: CapabilityDraftCandidate): string {
  const hint = entryUrlHint(candidate.entryUrl || candidate.name);
  return `${type}.${hint}.${stableHash(candidate.slugSeed)}`;
}

function findAuthDependency(existingCapabilities: ExistingCapabilityForDerive[]): string {
  return (
    existingCapabilities.find((item) => item.status === 'active' && item.capabilityType === 'auth')?.slug || ''
  );
}

function buildNavigationCandidate(input: {
  document: KnowledgeDocumentForDerive;
  chunk: KnowledgeChunkForDerive;
  entryUrl: string;
  authSlug: string;
  verificationStatus: CapabilityVerificationStatus;
}): CapabilityDraftCandidate | null {
  const name = inferNavigationName(input.chunk.heading, input.chunk.content);
  if (!name) return null;

  const companySearchNavigation = isCompanySearchContext(input.chunk.heading, input.chunk.content);
  const assertions = companySearchNavigation
    ? ['搜企业页加载完成', '页面内可见企业搜索输入框或结果列表']
    : extractAssertionHints(input.chunk.content);
  return {
    slugSeed: `${input.document.documentUid}\n${input.chunk.chunkUid}\nnavigation\n${name}`,
    chunkUid: input.chunk.chunkUid,
    kind: 'navigation',
    name,
    description: `根据文档块「${normalizeHeading(input.chunk.heading) || '概述'}」自动提炼的导航能力。`,
    capabilityType: 'navigation',
    entryUrl: input.entryUrl,
    triggerPhrases: uniq([normalizeHeading(input.chunk.heading), name, ...input.chunk.keywords]).slice(0, 8),
    preconditions: input.authSlug ? ['已登录系统'] : [],
    steps: companySearchNavigation
      ? [input.entryUrl ? '打开搜企业入口' : '进入搜企业页']
      : uniq([
          input.entryUrl ? `打开 ${name.replace(/^进入/, '')} 对应入口` : `进入 ${name.replace(/^进入/, '')}`,
          ...extractActionSteps(input.chunk.content).slice(0, 2),
        ]).slice(0, 4),
    assertions: assertions.length > 0 ? assertions : [`${name.replace(/^进入/, '')}加载完成`],
    cleanupNotes: '',
    dependsOn: input.authSlug ? [input.authSlug] : [],
    sortOrder: 100 + input.chunk.sortOrder * 10 + 1,
    sourceDocumentUid: input.document.documentUid,
    meta: buildMeta({
      document: input.document,
      chunk: input.chunk,
      kind: 'navigation',
      verificationStatus: input.verificationStatus,
    }),
  };
}

function buildPrimaryCandidate(input: {
  document: KnowledgeDocumentForDerive;
  chunk: KnowledgeChunkForDerive;
  entryUrl: string;
  authSlug: string;
  navigationSlug: string;
  verificationStatus: CapabilityVerificationStatus;
}): CapabilityDraftCandidate | null {
  const kind = inferPrimaryKind(input.chunk.heading, input.chunk.content);
  if (!kind || kind === 'navigation') return null;

  const name = inferPrimaryName(kind, input.chunk.heading, input.chunk.content);
  const assertions =
    kind === 'query'
      ? buildQueryAssertions(input.chunk.heading, input.chunk.content)
      : extractAssertions(input.chunk.content);
  const navigationName = inferNavigationName(input.chunk.heading, input.chunk.content);
  const steps = kind === 'query' ? buildQuerySteps(input.chunk.heading, input.chunk.content) : extractActionSteps(input.chunk.content);

  return {
    slugSeed: `${input.document.documentUid}\n${input.chunk.chunkUid}\n${kind}\n${name}`,
    chunkUid: input.chunk.chunkUid,
    kind,
    name,
    description: `根据文档块「${normalizeHeading(input.chunk.heading) || '概述'}」自动提炼的${kind === 'query' ? '查询' : kind === 'action' ? '动作' : kind === 'assertion' ? '断言' : '登录'}能力。`,
    capabilityType: kind,
    entryUrl: input.entryUrl,
    triggerPhrases: uniq([name, normalizeHeading(input.chunk.heading), ...input.chunk.keywords]).slice(0, 10),
    preconditions:
      kind === 'auth'
        ? []
        : navigationName
          ? [`已进入${navigationName.replace(/^进入/, '')}`]
          : input.authSlug
            ? ['已登录系统']
            : [],
    steps,
    assertions,
    cleanupNotes: '',
    dependsOn: kind === 'auth' ? [] : input.navigationSlug ? [input.navigationSlug] : input.authSlug ? [input.authSlug] : [],
    sortOrder:
      100 +
      input.chunk.sortOrder * 10 +
      (kind === 'action' ? 3 : kind === 'query' ? 4 : kind === 'assertion' ? 5 : 0),
    sourceDocumentUid: input.document.documentUid,
    meta: buildMeta({
      document: input.document,
      chunk: input.chunk,
      kind,
      verificationStatus: input.verificationStatus,
    }),
  };
}

function matchesExistingSemantics(
  existing: ExistingCapabilityForDerive,
  candidate: CapabilityDraftCandidate
): boolean {
  if (existing.capabilityType !== candidate.capabilityType) return false;
  if (existing.name.trim() !== candidate.name.trim()) return false;
  if ((existing.entryUrl || '').trim() !== (candidate.entryUrl || '').trim()) return false;
  return existing.status === 'active';
}

function findExistingAutoDerivedSlug(
  existingCapabilities: ExistingCapabilityForDerive[],
  chunkUid: string,
  kind: DraftKind
): string {
  const existing = existingCapabilities.find((item) => {
    const meta = item.meta && typeof item.meta === 'object' ? (item.meta as Record<string, unknown>) : null;
    const autoDerived =
      meta?.autoDerived && typeof meta.autoDerived === 'object'
        ? (meta.autoDerived as Record<string, unknown>)
        : null;
    return autoDerived?.chunkUid === chunkUid && autoDerived?.kind === kind;
  });
  return existing?.slug || '';
}

export function deriveCapabilitiesFromKnowledgeDocument(input: DeriveInput): DerivedCapabilityResult {
  const existingCapabilities = input.existingCapabilities || [];
  const authSlug = findAuthDependency(existingCapabilities);
  const documentVerification = describeCapabilityVerification(input.document.meta, input.document.sourceType).status;
  const verificationStatus: CapabilityVerificationStatus =
    documentVerification === 'execution_verified' ? 'execution_verified' : 'knowledge_inferred';
  const items: DerivedCapabilityInput[] = [];
  const skipped: DerivedCapabilityResult['skipped'] = [];

  for (const chunk of input.chunks) {
    const entryUrl = inferEntryUrl(chunk.heading, chunk.content, input.projectLoginUrl);
    const navigationCandidate = buildNavigationCandidate({
      document: input.document,
      chunk,
      entryUrl,
      authSlug,
      verificationStatus,
    });

    let navigationSlug = '';
    if (navigationCandidate) {
      const duplicate = existingCapabilities.find((item) => matchesExistingSemantics(item, navigationCandidate));
      if (duplicate && !findExistingAutoDerivedSlug(existingCapabilities, chunk.chunkUid, 'navigation')) {
        navigationSlug = duplicate.slug;
        skipped.push({
          chunkUid: chunk.chunkUid,
          reason: '已存在同名同入口导航能力，复用现有能力',
          capabilityName: navigationCandidate.name,
        });
      } else {
        navigationSlug = findExistingAutoDerivedSlug(existingCapabilities, chunk.chunkUid, 'navigation') || buildSlug('navigation', navigationCandidate);
        items.push({ ...navigationCandidate, slug: navigationSlug });
      }
    }

    const primaryCandidate = buildPrimaryCandidate({
      document: input.document,
      chunk,
      entryUrl,
      authSlug,
      navigationSlug,
      verificationStatus,
    });

    if (!primaryCandidate) {
      if (!navigationCandidate) {
        skipped.push({
          chunkUid: chunk.chunkUid,
          reason: '未从该知识块识别出可沉淀的稳定动作或查询',
          capabilityName: normalizeHeading(chunk.heading) || '未命名知识块',
        });
      }
      continue;
    }

    const duplicate = existingCapabilities.find((item) => matchesExistingSemantics(item, primaryCandidate));
    if (duplicate && !findExistingAutoDerivedSlug(existingCapabilities, chunk.chunkUid, primaryCandidate.kind)) {
      skipped.push({
        chunkUid: chunk.chunkUid,
        reason: '已存在同名同入口能力，复用现有能力',
        capabilityName: primaryCandidate.name,
      });
      continue;
    }

    const primarySlug =
      findExistingAutoDerivedSlug(existingCapabilities, chunk.chunkUid, primaryCandidate.kind) ||
      buildSlug(primaryCandidate.capabilityType, primaryCandidate);
    items.push({ ...primaryCandidate, slug: primarySlug });
  }

  return {
    items,
    skipped,
    summary: {
      requestedChunks: input.chunks.length,
      derivedCount: items.length,
      skippedCount: skipped.length,
      executionVerifiedCount: items.filter(
        (item) => describeCapabilityVerification(item.meta).status === 'execution_verified'
      ).length,
      knowledgeInferredCount: items.filter(
        (item) => describeCapabilityVerification(item.meta).status === 'knowledge_inferred'
      ).length,
    },
  };
}
