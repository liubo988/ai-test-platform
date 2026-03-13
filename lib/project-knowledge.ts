import { describeCapabilityVerification } from './capability-verification';

export type KnowledgeChunkCandidate = {
  heading: string;
  content: string;
  keywords: string[];
  sourceLineStart: number;
  sourceLineEnd: number;
  tokenEstimate: number;
};

export type CapabilityType = 'auth' | 'navigation' | 'action' | 'assertion' | 'query' | 'composite';

export type CapabilityBlueprint = {
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
  meta?: unknown;
};

export type CapabilityMatch = {
  slug: string;
  name: string;
  capabilityType: CapabilityType;
  entryUrl: string;
  score: number;
  matchedPhrases: string[];
  preconditions: string[];
  suggestedSteps: string[];
  suggestedAssertions: string[];
  cleanupNotes: string;
  dependsOn: string[];
  sortOrder: number;
  meta?: unknown;
};

export type KnowledgeEvidence = {
  heading: string;
  excerpt: string;
  score: number;
  keywords: string[];
  matchedCapabilitySlugs: string[];
};

export type RequirementClauseCoverage = {
  text: string;
  covered: boolean;
  matchedCapabilitySlugs: string[];
  matchedCapabilityNames: string[];
};

export type RequirementCoverage = {
  clauses: RequirementClauseCoverage[];
  uncoveredClauses: string[];
};

export type RequirementCoverageSource = {
  slug: string;
  name: string;
  description?: string;
  phrases?: string[];
};

export type RecipeDraft = {
  title: string;
  requirement: string;
  requirementKeywords: string[];
  matchedCapabilities: CapabilityMatch[];
  supportingKnowledge: KnowledgeEvidence[];
  requirementCoverage: RequirementCoverage;
  executionRecipe: {
    steps: Array<{
      capabilitySlug: string;
      capabilityName: string;
      capabilityType: CapabilityType;
      reason: string;
      entryUrl: string;
      preconditions: string[];
      actions: string[];
    }>;
    assertions: string[];
    cleanupNotes: string[];
  };
};

const DEFAULT_HEADING = '概述';
const MAX_CHUNK_LENGTH = 680;
const COMMON_STOP_WORDS = new Set([
  '点击',
  '按钮',
  '页面',
  '列表',
  '进入',
  '功能',
  '支持',
  '默认',
  '当前',
  '进行',
  '填写',
  '查看',
  '成功',
  '系统',
  '成员',
  '信息',
  '商机',
]);
const REQUIREMENT_ACTION_HINTS = [
  '创建',
  '新增',
  '生成',
  '提交',
  '校验',
  '检索',
  '查询',
  '打开',
  '进入',
  '选择',
  '填写',
  '下单',
  '转订单',
  '转单',
  '申请',
  '支付',
  '核对',
  '验证',
  '查看',
  '搜索',
  '保存',
  '上传',
  '导出',
  '导入',
  '作废',
  '同步',
];
const REQUIREMENT_ACTION_PATTERN = REQUIREMENT_ACTION_HINTS.join('|');
const REQUIREMENT_CLAUSE_SPLIT_RE = new RegExp(
  [
    '[，,。；;！？!?\\n]+',
    `(?:并且|然后|随后|接着|再|且|同时)(?=(?:${REQUIREMENT_ACTION_PATTERN}|在))`,
    `并(?=(?:${REQUIREMENT_ACTION_PATTERN}|在))`,
    `后(?=(?:${REQUIREMENT_ACTION_PATTERN}|在))`,
  ].join('|'),
  'g'
);
const REQUIREMENT_CLAUSE_PREFIX_RE = /^(?:并且|然后|随后|接着|再|且|同时|并|后)+/;

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readSupersededCapabilitySlugs(meta: unknown): string[] {
  const value = toRecord(meta);
  if (!Array.isArray(value?.supersedes)) return [];
  return uniq(value.supersedes.map((item) => String(item)));
}

function toNonEmptyLines(raw: string): Array<{ line: string; lineNo: number }> {
  const normalized = normalizeKnowledgeText(raw);
  return normalized
    .split('\n')
    .map((line, index) => ({ line: line.trim(), lineNo: index + 1 }))
    .filter((item) => item.line);
}

export function normalizeKnowledgeText(raw: string): string {
  return raw
    .replace(/\f/g, '\n')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function looksLikeManualHeading(line: string): boolean {
  const value = line.trim();
  if (!value) return false;
  if (value.length > 34) return false;
  if (/^[0-9]+[、.)]/.test(value)) return false;
  if (/^[一二三四五六七八九十]+[、.)]/.test(value)) return false;
  if (/[：:，,。；;！？!?]/.test(value)) return false;
  if (/^(点击|输入|填写|选择|支持|默认|若|可|有|在|功能同)/.test(value)) return false;
  if (/^[A-Za-z0-9 ._-]+$/.test(value)) return false;

  return (
    /(登录|首页|管理|列表|公海|废弃池|新增商机|商机列表|客户列表|订单列表|服务列表|跟单台|操作台|续费台|通讯录|线索挖掘|地图检索|专管员列表|系统设置)$/.test(
      value
    ) || /^[\u4e00-\u9fa5A-Za-z0-9\s_-]{2,20}$/.test(value)
  );
}

function collectKeywords(heading: string, content: string): string[] {
  const tokens = `${heading}\n${content}`.match(/[\u4e00-\u9fa5A-Za-z0-9_-]{2,16}/g) || [];
  const results: string[] = [];

  for (const token of tokens) {
    const value = token.trim();
    if (!value || COMMON_STOP_WORDS.has(value) || results.includes(value)) continue;
    results.push(value);
    if (results.length >= 12) break;
  }

  return results;
}

function chunkParagraphs(
  heading: string,
  paragraphs: Array<{ text: string; start: number; end: number }>
): KnowledgeChunkCandidate[] {
  const chunks: KnowledgeChunkCandidate[] = [];
  let currentText = '';
  let chunkStart = 0;
  let chunkEnd = 0;

  const flush = () => {
    const content = currentText.trim();
    if (!content) return;
    chunks.push({
      heading,
      content,
      keywords: collectKeywords(heading, content),
      sourceLineStart: chunkStart,
      sourceLineEnd: chunkEnd,
      tokenEstimate: Math.ceil((heading.length + content.length) / 2),
    });
    currentText = '';
    chunkStart = 0;
    chunkEnd = 0;
  };

  for (const paragraph of paragraphs) {
    if (!currentText) {
      currentText = paragraph.text;
      chunkStart = paragraph.start;
      chunkEnd = paragraph.end;
      continue;
    }

    const next = `${currentText}\n${paragraph.text}`;
    if (next.length > MAX_CHUNK_LENGTH) {
      flush();
      currentText = paragraph.text;
      chunkStart = paragraph.start;
      chunkEnd = paragraph.end;
      continue;
    }

    currentText = next;
    chunkEnd = paragraph.end;
  }

  flush();
  return chunks;
}

export function buildKnowledgeChunksFromManual(raw: string): KnowledgeChunkCandidate[] {
  const lines = toNonEmptyLines(raw);
  if (lines.length === 0) return [];

  const chunks: KnowledgeChunkCandidate[] = [];
  let currentHeading = DEFAULT_HEADING;
  let currentParagraphLines: Array<{ text: string; lineNo: number }> = [];
  let currentParagraphs: Array<{ text: string; start: number; end: number }> = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length === 0) return;
    const text = currentParagraphLines.map((item) => item.text).join('\n').trim();
    if (text) {
      currentParagraphs.push({
        text,
        start: currentParagraphLines[0]?.lineNo || 0,
        end: currentParagraphLines[currentParagraphLines.length - 1]?.lineNo || 0,
      });
    }
    currentParagraphLines = [];
  };

  const flushSection = () => {
    flushParagraph();
    if (currentParagraphs.length === 0) return;
    chunks.push(...chunkParagraphs(currentHeading, currentParagraphs));
    currentParagraphs = [];
  };

  for (const item of lines) {
    if (looksLikeManualHeading(item.line)) {
      flushSection();
      currentHeading = item.line;
      continue;
    }

    currentParagraphLines.push({ text: item.line, lineNo: item.lineNo });

    if (item.line.endsWith('：') || item.line.endsWith(':')) {
      flushParagraph();
    }
  }

  flushSection();
  return chunks;
}

export function extractRequirementKeywords(input: string): string[] {
  const tokens = input.match(/[\u4e00-\u9fa5A-Za-z0-9_-]{2,24}/g) || [];
  return uniq(tokens).slice(0, 16);
}

export function scoreTextMatch(query: string, text: string, phrases: string[] = []): { score: number; matched: string[] } {
  const normalizedQuery = query.trim().toLowerCase();
  const haystack = text.trim().toLowerCase();
  const matched = new Set<string>();
  let score = 0;

  for (const phrase of phrases) {
    const value = phrase.trim();
    if (!value) continue;
    if (normalizedQuery.includes(value.toLowerCase())) {
      matched.add(value);
      score += Math.max(6, value.length * 2);
    }
  }

  for (const token of extractRequirementKeywords(query)) {
    const value = token.toLowerCase();
    if (haystack.includes(value)) {
      matched.add(token);
      score += token.length >= 4 ? 5 : 3;
    }
  }

  return { score, matched: Array.from(matched) };
}

function scorePhrasePresence(text: string, phrases: string[] = []): { score: number; matched: string[] } {
  const haystack = text.trim().toLowerCase();
  const matched = new Set<string>();
  let score = 0;

  for (const phrase of phrases) {
    const value = phrase.trim();
    if (!value) continue;
    if (haystack.includes(value.toLowerCase())) {
      matched.add(value);
      score += Math.max(6, value.length * 2);
    }
  }

  return { score, matched: Array.from(matched) };
}

function splitRequirementClauses(input: string): string[] {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const clauses = normalized
    .split(REQUIREMENT_CLAUSE_SPLIT_RE)
    .map((item) => item.replace(REQUIREMENT_CLAUSE_PREFIX_RE, '').trim())
    .filter((item) => item.length >= 2);

  return uniq(clauses.length > 0 ? clauses : [normalized]);
}

export function analyzeRequirementCoverage(input: {
  requirement: string;
  sources: RequirementCoverageSource[];
}): RequirementCoverage {
  const clauses = splitRequirementClauses(input.requirement);
  const clauseCoverage = clauses.map((clause) => {
    const matchedSources = input.sources
      .map((item) => {
        const score = scoreTextMatch(
          clause,
          [item.name, item.description || ''].filter(Boolean).join('\n'),
          uniq([item.name, ...(item.phrases || [])])
        ).score;

        return score > 0 ? { slug: item.slug, name: item.name, score } : null;
      })
      .filter((item): item is { slug: string; name: string; score: number } => Boolean(item))
      .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'zh-CN'));

    return {
      text: clause,
      covered: matchedSources.length > 0,
      matchedCapabilitySlugs: matchedSources.map((item) => item.slug),
      matchedCapabilityNames: uniq(matchedSources.map((item) => item.name)),
    };
  });

  return {
    clauses: clauseCoverage,
    uncoveredClauses: clauseCoverage.filter((item) => !item.covered).map((item) => item.text),
  };
}

function buildRequirementCoverageSourcesFromCapabilities(capabilities: CapabilityMatch[]): RequirementCoverageSource[] {
  return capabilities.map((item) => ({
    slug: item.slug,
    name: item.name,
    description: [...item.preconditions, ...item.suggestedSteps, ...item.suggestedAssertions].filter(Boolean).join('\n'),
    phrases: [item.name, ...item.matchedPhrases, ...item.suggestedSteps, ...item.suggestedAssertions],
  }));
}

function buildSupportingKnowledgeFromChunks(input: {
  requirement: string;
  knowledgeChunks: KnowledgeChunkCandidate[];
  capabilities: CapabilityMatch[];
}): KnowledgeEvidence[] {
  const capabilitySources = buildRequirementCoverageSourcesFromCapabilities(input.capabilities);

  return input.knowledgeChunks
    .map((item) => {
      const requirementScore = scoreTextMatch(input.requirement, `${item.heading}\n${item.content}`, item.keywords).score;
      const capabilityMatches = capabilitySources
        .map((source) => {
          const phrases = uniq([source.name, ...(source.phrases || [])]);
          const score = scorePhrasePresence(`${item.heading}\n${item.content}`, phrases).score;
          return score > 0 ? { slug: source.slug, score } : null;
        })
        .filter((value): value is { slug: string; score: number } => Boolean(value))
        .sort((left, right) => right.score - left.score || left.slug.localeCompare(right.slug, 'zh-CN'));
      const matchedCapabilitySlugs = capabilityMatches.map((match) => match.slug);
      const capabilityScore = capabilityMatches.reduce((total, match) => total + match.score, 0);

      return {
        heading: item.heading,
        excerpt: item.content.slice(0, 240),
        score: requirementScore + capabilityScore,
        keywords: item.keywords,
        matchedCapabilitySlugs,
      };
    })
    .filter((item) => {
      if (item.score <= 0) return false;
      if (input.capabilities.length === 0) return true;
      return item.matchedCapabilitySlugs.length > 0;
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.matchedCapabilitySlugs.length - left.matchedCapabilitySlugs.length ||
        left.heading.localeCompare(right.heading, 'zh-CN')
    )
    .slice(0, 8);
}

function filterSupportingKnowledgeByCapabilities(input: {
  supportingKnowledge: KnowledgeEvidence[];
  capabilities: CapabilityMatch[];
}): KnowledgeEvidence[] {
  const selectedCapabilitySlugSet = new Set(input.capabilities.map((item) => item.slug));
  if (selectedCapabilitySlugSet.size === 0) return [];

  return input.supportingKnowledge
    .filter((item) => item.matchedCapabilitySlugs.some((slug) => selectedCapabilitySlugSet.has(slug)))
    .map((item) => ({
      ...item,
      matchedCapabilitySlugs: item.matchedCapabilitySlugs.filter((slug) => selectedCapabilitySlugSet.has(slug)),
    }))
    .sort(
      (left, right) =>
        right.matchedCapabilitySlugs.length - left.matchedCapabilitySlugs.length ||
        right.score - left.score ||
        left.heading.localeCompare(right.heading, 'zh-CN')
    );
}

function buildExecutionRecipeFromCapabilities(selectedCapabilities: CapabilityMatch[]): RecipeDraft['executionRecipe'] {
  const assertions = Array.from(
    new Set(selectedCapabilities.flatMap((item) => item.suggestedAssertions).map((item) => item.trim()).filter(Boolean))
  );
  const cleanupNotes = Array.from(new Set(selectedCapabilities.map((item) => item.cleanupNotes.trim()).filter(Boolean)));

  return {
    steps: selectedCapabilities.map((item) => ({
      capabilitySlug: item.slug,
      capabilityName: item.name,
      capabilityType: item.capabilityType,
      reason: item.matchedPhrases.length > 0 ? `命中: ${item.matchedPhrases.join(', ')}` : item.name,
      entryUrl: item.entryUrl,
      preconditions: item.preconditions,
      actions: item.suggestedSteps,
    })),
    assertions,
    cleanupNotes,
  };
}

export function applyCapabilitySelectionToRecipe(input: {
  recipe: RecipeDraft;
  selectedCapabilitySlugs: string[];
}): RecipeDraft {
  const selectedCapabilitySlugSet = new Set(input.selectedCapabilitySlugs.map((item) => item.trim()).filter(Boolean));
  const selectedCapabilities = input.recipe.matchedCapabilities.filter((item) => selectedCapabilitySlugSet.has(item.slug));

  return {
    ...input.recipe,
    matchedCapabilities: selectedCapabilities,
    supportingKnowledge: filterSupportingKnowledgeByCapabilities({
      supportingKnowledge: input.recipe.supportingKnowledge,
      capabilities: selectedCapabilities,
    }),
    requirementCoverage: analyzeRequirementCoverage({
      requirement: input.recipe.requirement,
      sources: buildRequirementCoverageSourcesFromCapabilities(selectedCapabilities),
    }),
    executionRecipe: buildExecutionRecipeFromCapabilities(selectedCapabilities),
  };
}

export function draftRecipeFromRequirement(input: {
  requirement: string;
  capabilities: CapabilityBlueprint[];
  knowledgeChunks: KnowledgeChunkCandidate[];
  includeAuthCapability?: boolean;
}): RecipeDraft {
  type RankedCapability = CapabilityMatch & { verificationPriority: number };
  const capabilityIndex = new Map(input.capabilities.map((item) => [item.slug, item]));
  const rankedCapabilities = input.capabilities
    .map<RankedCapability>((item) => {
      const triggerScore = scoreTextMatch(input.requirement, `${item.name}\n${item.description}`, item.triggerPhrases);
      const verification = describeCapabilityVerification(item.meta);
      return {
        slug: item.slug,
        name: item.name,
        capabilityType: item.capabilityType,
        entryUrl: item.entryUrl,
        score: triggerScore.score,
        matchedPhrases: triggerScore.matched,
        preconditions: item.preconditions,
        suggestedSteps: item.steps,
        suggestedAssertions: item.assertions,
        cleanupNotes: item.cleanupNotes,
        dependsOn: item.dependsOn,
        sortOrder: item.sortOrder,
        meta: item.meta,
        verificationPriority: verification.priority,
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.verificationPriority - left.verificationPriority || left.sortOrder - right.sortOrder);

  if (input.includeAuthCapability) {
    const authCapability = input.capabilities.find((item) => item.capabilityType === 'auth');
    if (authCapability && !rankedCapabilities.some((item) => item.slug === authCapability.slug)) {
      rankedCapabilities.unshift({
        slug: authCapability.slug,
        name: authCapability.name,
        capabilityType: authCapability.capabilityType,
        entryUrl: authCapability.entryUrl,
        score: 1,
        matchedPhrases: ['统一登录前置'],
        preconditions: authCapability.preconditions,
        suggestedSteps: authCapability.steps,
        suggestedAssertions: authCapability.assertions,
        cleanupNotes: authCapability.cleanupNotes,
        dependsOn: authCapability.dependsOn,
        sortOrder: authCapability.sortOrder,
        meta: authCapability.meta,
        verificationPriority: describeCapabilityVerification(authCapability.meta).priority,
      });
    }
  }

  const rankedMatchIndex = new Map(rankedCapabilities.map((item) => [item.slug, item]));
  const selectedCapabilities: CapabilityMatch[] = [];
  const selectedCapabilitySlugs = new Set<string>();
  const visitingCapabilitySlugs = new Set<string>();
  const supersededCapabilitySlugs = new Set<string>();

  const appendCapability = (capability: RankedCapability, reason: string) => {
    if (capability.capabilityType !== 'auth' && supersededCapabilitySlugs.has(capability.slug)) {
      return;
    }
    if (selectedCapabilitySlugs.has(capability.slug) || visitingCapabilitySlugs.has(capability.slug)) {
      return;
    }

    visitingCapabilitySlugs.add(capability.slug);
    for (const dependencySlug of capability.dependsOn) {
      const dependencyBlueprint = capabilityIndex.get(dependencySlug);
      if (!dependencyBlueprint) continue;
      const dependencyMatch =
        rankedMatchIndex.get(dependencySlug) || {
          slug: dependencyBlueprint.slug,
          name: dependencyBlueprint.name,
          capabilityType: dependencyBlueprint.capabilityType,
          entryUrl: dependencyBlueprint.entryUrl,
          score: 1,
          matchedPhrases: [reason],
          preconditions: dependencyBlueprint.preconditions,
          suggestedSteps: dependencyBlueprint.steps,
          suggestedAssertions: dependencyBlueprint.assertions,
          cleanupNotes: dependencyBlueprint.cleanupNotes,
          dependsOn: dependencyBlueprint.dependsOn,
          sortOrder: dependencyBlueprint.sortOrder,
          meta: dependencyBlueprint.meta,
          verificationPriority: describeCapabilityVerification(dependencyBlueprint.meta).priority,
        };
      appendCapability(dependencyMatch, `依赖于 ${capability.name}`);
    }

    visitingCapabilitySlugs.delete(capability.slug);
    selectedCapabilitySlugs.add(capability.slug);
    selectedCapabilities.push(capability);
    for (const slug of readSupersededCapabilitySlugs(capability.meta)) {
      if (slug && slug !== capability.slug) {
        supersededCapabilitySlugs.add(slug);
      }
    }
  };

  for (const capability of rankedCapabilities.slice(0, 6)) {
    appendCapability(capability, `命中需求 ${capability.name}`);
  }
  const evidence = buildSupportingKnowledgeFromChunks({
    requirement: input.requirement,
    knowledgeChunks: input.knowledgeChunks,
    capabilities: selectedCapabilities,
  });

  const requirementCoverage = analyzeRequirementCoverage({
    requirement: input.requirement,
    sources: selectedCapabilities.map((item) => {
      const blueprint = capabilityIndex.get(item.slug);
      return {
        slug: item.slug,
        name: item.name,
        description: [blueprint?.description || '', ...item.preconditions, ...item.suggestedSteps, ...item.suggestedAssertions]
          .filter(Boolean)
          .join('\n'),
        phrases: [item.name, ...(blueprint?.triggerPhrases || []), ...item.suggestedSteps, ...item.suggestedAssertions],
      };
    }),
  });

  return {
    title: input.requirement.trim(),
    requirement: input.requirement.trim(),
    requirementKeywords: extractRequirementKeywords(input.requirement),
    matchedCapabilities: selectedCapabilities,
    supportingKnowledge: evidence,
    requirementCoverage,
    executionRecipe: buildExecutionRecipeFromCapabilities(selectedCapabilities),
  };
}
