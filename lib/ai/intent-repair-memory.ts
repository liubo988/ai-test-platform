import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { TestResult } from '@/lib/test-executor';

export interface IntentRepairMemoryHint {
  clusterId: string;
  category: string;
  tags: string[];
  seenCount: number;
  resolvedCount: number;
  representativeError: string;
  successfulStrategies: string[];
  antiPatterns: string[];
  sampleUrls: string[];
  lastSeenAt: string;
}

export interface IntentRepairMemoryClusterSnapshot extends IntentRepairMemoryHint {
  createdAt: string;
  updatedAt: string;
  normalizedError: string;
  successRate: number;
  sampleTitles: string[];
  sampleDescriptions: string[];
  lastFailureCodeExcerpt: string;
  lastSuccessfulCodeExcerpt: string;
}

interface IntentRepairClusterRecord extends IntentRepairMemoryHint {
  createdAt: string;
  updatedAt: string;
  normalizedError: string;
  successRate: number;
  sampleTitles: string[];
  sampleDescriptions: string[];
  lastFailureCodeExcerpt: string;
  lastSuccessfulCodeExcerpt: string;
}

interface IntentRepairMemoryStore {
  version: 1;
  updatedAt: string;
  clusters: IntentRepairClusterRecord[];
}

export interface IntentRepairObservationInput {
  targetUrl: string;
  pageTitle?: string;
  description: string;
  executionError: string;
  previousCode?: string;
  recentEvents?: string[];
  observationTags?: string[];
}

export interface IntentRepairResolutionInput {
  clusterIds: string[];
  targetUrl: string;
  description: string;
  fixedCode: string;
  finalResult: TestResult;
}

const DEFAULT_MEMORY_FILE = path.join(process.cwd(), 'reports', 'intent-e2e-repair-memory.json');
const MAX_CLUSTERS = 200;
const MAX_LIST_ITEMS = 6;
let cachePath = '';
let cacheStore: IntentRepairMemoryStore | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function truncate(text: string, max = 320): string {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function uniqueStrings(values: Array<string | null | undefined>, max = MAX_LIST_ITEMS): string[] {
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

function normalizeUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    const pathKey = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.hostname}${pathKey}`.toLowerCase();
  } catch {
    return truncate(url.toLowerCase(), 80);
  }
}

function normalizeErrorMessage(errorText: string): string {
  return truncate(
    String(errorText || '')
      .replace(/\d+ms/g, '<timeout-ms>')
      .replace(/\b\d{2,}\b/g, '<num>')
      .replace(/intent-[a-z0-9-]+/gi, '<session-id>')
      .replace(/https?:\/\/[^\s)]+/gi, '<url>'),
    260
  );
}

function buildRepairHaystack(input: IntentRepairObservationInput): string {
  return [
    input.targetUrl,
    input.pageTitle || '',
    input.description,
    input.executionError,
    input.previousCode || '',
    ...(input.recentEvents || []),
  ]
    .join('\n')
    .toLowerCase();
}

function buildClusterTags(input: IntentRepairObservationInput): string[] {
  const haystack = buildRepairHaystack(input);

  return uniqueStrings([
    /ant-select|treeselect|dropdown|cascader|枚举|下拉/i.test(haystack) ? 'antd-dropdown' : null,
    /tree-node|tree/i.test(haystack) ? 'tree-option' : null,
    /tbody tr|data-row-key|生成订单|查看|行操作|dropdown-trigger/i.test(haystack) ? 'row-action' : null,
    /iframe|framelocator|contentframe|easyindexiframe/i.test(haystack) ? 'iframe' : null,
    /createorder|waitforresponse|response|接口|post\s|patch\s|delete\s/i.test(haystack) ? 'api-response' : null,
    /businessid|orderid|contactphone|extract|提取|读取|共享变量/i.test(haystack) ? 'shared-variable' : null,
    /tobetruthy|not\.tobe\(|非空|received: false/i.test(haystack) ? 'weak-assertion' : null,
    /spin|loading|drawer|modal|初始化|null \(reading 'id'\)/i.test(haystack) ? 'page-race' : null,
    ...(input.observationTags || []),
    normalizeUrlKey(input.targetUrl),
  ]);
}

function classifyIntentRepairFailure(input: IntentRepairObservationInput): {
  category: string;
  normalizedError: string;
  tags: string[];
  antiPatterns: string[];
} {
  const haystack = buildRepairHaystack(input);
  let category = 'generic-locator-failure';

  if (/未能打开当前字段的下拉面板|ant-select-dropdown-hidden|visible dropdown/i.test(haystack)) {
    category = 'antd-dropdown-not-opened';
  } else if (/ant-select-(tree-node-content-wrapper|dropdown-menu-item|item-option-content)|tobevisible\(\) failed|scrollintoviewifneeded/i.test(haystack)) {
    category = 'antd-option-not-visible';
  } else if (/未找到行操作|data-row-key|dropdown-trigger|tbody tr/i.test(haystack)) {
    category = 'row-action-not-found';
  } else if (/iframe\[name=|framelocator|contentframe|placeholder.*iframe/i.test(haystack)) {
    category = 'iframe-context-mismatch';
  } else if (/createorder|sureorderinfodrawer|drawer.*未关闭|page\.getbytext\(\/成功/i.test(haystack)) {
    category = 'api-success-followup-assertion';
  } else if (/contactphone|businessid|contactname|tobetruthy|received: false/i.test(haystack)) {
    category = 'shared-variable-extraction-unstable';
  } else if (/null \(reading 'id'\)|ant-spin-spinning|初始化|默认数据加载/i.test(haystack)) {
    category = 'page-bootstrap-race';
  }

  return {
    category,
    normalizedError: normalizeErrorMessage(input.executionError),
    tags: buildClusterTags(input),
    antiPatterns: uniqueStrings([
      /page\.waitfortimeout/i.test(haystack) ? '把 page.waitForTimeout 当成主同步手段' : null,
      /page\.getbytext\([^)]*枚举值|page\.getbytext\([^)]*抖音|page\.getbytext\([^)]*男/i.test(haystack) ? '对下拉枚举值做全局 getByText 点击' : null,
      /getbyrole\('button'.*查看|getbyrole\('link'.*查看|行内存在可见 button/i.test(haystack) ? '假设目标动作一定以内联按钮存在' : null,
      /page\.getbytext\(\/成功/i.test(haystack) ? '用模糊成功文案替代关键业务断言' : null,
      /tobetruthy\(\)|not\.tobe\(''\)/i.test(haystack) ? '把核心字段断言弱化成 truthy/非空' : null,
      /iframe\[name=/i.test(haystack) ? '臆造 iframe[name] 选择器' : null,
    ]),
  };
}

function buildClusterId(category: string, normalizedUrl: string, normalizedError: string, tags: string[]): string {
  const signature = [category, normalizedUrl, normalizedError, ...tags.filter((item) => !item.includes('.'))].join('|');
  return `irm-${createHash('sha1').update(signature).digest('hex').slice(0, 12)}`;
}

function extractStrategiesFromCode(code: string, result?: TestResult): string[] {
  const source = [code, result?.error || '', ...(result?.steps || []).map((step) => `${step.status} ${step.title}`)].join('\n');

  return uniqueStrings([
    /__e2e\.selectAntdOption/.test(source) ? '__e2e.selectAntdOption' : null,
    /__e2e\.openAntdDropdown/.test(source) ? '__e2e.openAntdDropdown' : null,
    /__e2e\.switchBusinessListOwnershipView/.test(source) ? '__e2e.switchBusinessListOwnershipView' : null,
    /__e2e\.clickAntdRowAction/.test(source) ? '__e2e.clickAntdRowAction' : null,
    /__e2e\.getFrame/.test(source) ? '__e2e.getFrame' : null,
    /__e2e\.waitForApiResponse/.test(source) ? '__e2e.waitForApiResponse' : null,
    /frameLocator\(/.test(source) ? 'frameLocator(...)' : null,
    /waitForResponse\(/.test(source) ? 'page.waitForResponse(...)' : null,
    /scrollIntoViewIfNeeded\(/.test(source) ? 'scrollIntoViewIfNeeded()' : null,
    /drawer/i.test(source) ? '显式等待 Drawer/Modal 状态变化' : null,
    /businessId|orderId|contactPhone/.test(source) ? '提取并复用共享变量' : null,
  ]);
}

function resolveMemoryFilePath(): string {
  return process.env.INTENT_E2E_REPAIR_MEMORY_PATH?.trim() || DEFAULT_MEMORY_FILE;
}

async function loadStore(): Promise<IntentRepairMemoryStore> {
  const memoryPath = resolveMemoryFilePath();
  if (cacheStore && cachePath === memoryPath) {
    return cacheStore;
  }

  cachePath = memoryPath;
  try {
    const raw = await fs.readFile(memoryPath, 'utf8');
    const parsed = JSON.parse(raw) as IntentRepairMemoryStore;
    cacheStore = {
      version: 1,
      updatedAt: parsed.updatedAt || nowIso(),
      clusters: Array.isArray(parsed.clusters) ? parsed.clusters.slice(0, MAX_CLUSTERS) : [],
    };
    return cacheStore;
  } catch {
    cacheStore = {
      version: 1,
      updatedAt: nowIso(),
      clusters: [],
    };
    return cacheStore;
  }
}

async function saveStore(store: IntentRepairMemoryStore): Promise<void> {
  const memoryPath = resolveMemoryFilePath();
  store.updatedAt = nowIso();
  cachePath = memoryPath;
  cacheStore = store;
  await fs.mkdir(path.dirname(memoryPath), { recursive: true });
  await fs.writeFile(memoryPath, JSON.stringify(store, null, 2), 'utf8');
}

function toClusterSnapshot(record: IntentRepairClusterRecord): IntentRepairMemoryClusterSnapshot {
  return {
    clusterId: record.clusterId,
    category: record.category,
    tags: [...record.tags],
    seenCount: record.seenCount,
    resolvedCount: record.resolvedCount,
    representativeError: record.representativeError,
    successfulStrategies: [...record.successfulStrategies],
    antiPatterns: [...record.antiPatterns],
    sampleUrls: [...record.sampleUrls],
    lastSeenAt: record.lastSeenAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    normalizedError: record.normalizedError,
    successRate: record.successRate,
    sampleTitles: [...record.sampleTitles],
    sampleDescriptions: [...record.sampleDescriptions],
    lastFailureCodeExcerpt: record.lastFailureCodeExcerpt,
    lastSuccessfulCodeExcerpt: record.lastSuccessfulCodeExcerpt,
  };
}

function toHint(record: IntentRepairClusterRecord): IntentRepairMemoryHint {
  const snapshot = toClusterSnapshot(record);
  return {
    clusterId: snapshot.clusterId,
    category: snapshot.category,
    tags: snapshot.tags,
    seenCount: snapshot.seenCount,
    resolvedCount: snapshot.resolvedCount,
    representativeError: snapshot.representativeError,
    successfulStrategies: snapshot.successfulStrategies,
    antiPatterns: snapshot.antiPatterns,
    sampleUrls: snapshot.sampleUrls,
    lastSeenAt: snapshot.lastSeenAt,
  };
}

export async function recordIntentRepairFailure(input: IntentRepairObservationInput): Promise<IntentRepairMemoryHint> {
  const store = await loadStore();
  const { category, normalizedError, tags, antiPatterns } = classifyIntentRepairFailure(input);
  const urlKey = normalizeUrlKey(input.targetUrl);
  const clusterId = buildClusterId(category, urlKey, normalizedError, tags);
  const timestamp = nowIso();

  let record = store.clusters.find((item) => item.clusterId === clusterId) || null;
  if (!record) {
    record = {
      clusterId,
      category,
      tags,
      seenCount: 0,
      resolvedCount: 0,
      representativeError: normalizedError,
      successfulStrategies: [],
      antiPatterns: [],
      sampleUrls: [],
      lastSeenAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      normalizedError,
      successRate: 0,
      sampleTitles: [],
      sampleDescriptions: [],
      lastFailureCodeExcerpt: '',
      lastSuccessfulCodeExcerpt: '',
    };
    store.clusters.unshift(record);
  }

  record.seenCount += 1;
  record.lastSeenAt = timestamp;
  record.updatedAt = timestamp;
  record.representativeError = record.representativeError || normalizedError;
  record.tags = uniqueStrings([...(record.tags || []), ...tags], 10);
  record.antiPatterns = uniqueStrings([...(record.antiPatterns || []), ...antiPatterns], 10);
  record.sampleUrls = uniqueStrings([...(record.sampleUrls || []), input.targetUrl], 8);
  record.sampleTitles = uniqueStrings([...(record.sampleTitles || []), input.pageTitle || ''], 8);
  record.sampleDescriptions = uniqueStrings([...(record.sampleDescriptions || []), truncate(input.description, 160)], 8);
  record.lastFailureCodeExcerpt = truncate(input.previousCode || '', 500);
  record.successRate = record.seenCount > 0 ? Number((record.resolvedCount / record.seenCount).toFixed(3)) : 0;

  store.clusters = store.clusters.slice(0, MAX_CLUSTERS);
  await saveStore(store);
  return toHint(record);
}

export async function recordIntentRepairResolution(input: IntentRepairResolutionInput): Promise<void> {
  if (!input.clusterIds.length) return;
  const store = await loadStore();
  const timestamp = nowIso();
  const strategies = extractStrategiesFromCode(input.fixedCode, input.finalResult);
  let mutated = false;

  for (const clusterId of uniqueStrings(input.clusterIds, 20)) {
    const record = store.clusters.find((item) => item.clusterId === clusterId);
    if (!record) continue;

    record.resolvedCount += 1;
    record.updatedAt = timestamp;
    record.lastSeenAt = timestamp;
    record.sampleUrls = uniqueStrings([...(record.sampleUrls || []), input.targetUrl], 8);
    record.sampleDescriptions = uniqueStrings([...(record.sampleDescriptions || []), truncate(input.description, 160)], 8);
    record.successfulStrategies = uniqueStrings([...(record.successfulStrategies || []), ...strategies], 12);
    record.lastSuccessfulCodeExcerpt = truncate(input.fixedCode, 500);
    record.successRate = record.seenCount > 0 ? Number((record.resolvedCount / record.seenCount).toFixed(3)) : 0;
    mutated = true;
  }

  if (mutated) {
    await saveStore(store);
  }
}

function overlapScore(a: string[], b: string[]): number {
  const set = new Set(a);
  return b.reduce((acc, item) => acc + (set.has(item) ? 1 : 0), 0);
}

export async function listRelevantIntentRepairHints(
  input: IntentRepairObservationInput,
  limit = 3
): Promise<IntentRepairMemoryHint[]> {
  const store = await loadStore();
  if (store.clusters.length === 0) return [];

  const { category, normalizedError, tags } = classifyIntentRepairFailure(input);
  const urlKey = normalizeUrlKey(input.targetUrl);
  const currentClusterId = buildClusterId(category, urlKey, normalizedError, tags);

  return store.clusters
    .map((record) => {
      let score = 0;
      if (record.clusterId === currentClusterId) score += 100;
      if (record.category === category) score += 25;
      score += overlapScore(record.tags, tags) * 4;
      if (record.sampleUrls.some((item) => normalizeUrlKey(item) === urlKey)) score += 8;
      score += Math.min(record.resolvedCount, 5);
      return { record, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.record.resolvedCount - a.record.resolvedCount || b.record.seenCount - a.record.seenCount)
    .slice(0, Math.max(1, limit))
    .map((item) => toHint(item.record));
}

export function renderIntentRepairMemoryHints(hints: IntentRepairMemoryHint[]): string {
  if (hints.length === 0) return '';

  const lines: string[] = ['## 历史相似失败记忆'];
  for (const [index, hint] of hints.entries()) {
    lines.push(
      '',
      `${index + 1}. cluster=${hint.clusterId}`,
      `   - 类别: ${hint.category}`,
      `   - 标签: ${hint.tags.join(', ') || '无'}`,
      `   - 历史命中: ${hint.seenCount} 次；已修复: ${hint.resolvedCount} 次`,
      `   - 代表错误: ${hint.representativeError}`,
      `   - 常用修法: ${hint.successfulStrategies.join(' / ') || '暂无历史成功修法，请优先沿用 DSL 与高频动作库'}`,
      `   - 常见误区: ${hint.antiPatterns.join(' / ') || '无'}`
    );
  }
  return lines.join('\n');
}


export function getIntentRepairMemoryPath(): string {
  return resolveMemoryFilePath();
}

export async function listIntentRepairMemoryClusters(): Promise<IntentRepairMemoryClusterSnapshot[]> {
  const store = await loadStore();
  return store.clusters.map((record) => toClusterSnapshot(record));
}

export function resetIntentRepairMemoryCache(): void {
  cachePath = '';
  cacheStore = null;
}
