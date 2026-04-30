import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import {
  normalizeIntentE2EPriorityScenarioFamily,
  type IntentE2EPriorityScenarioFamily,
} from './intent-e2e-priority-scenario-family';
import { normalizeIntentProjectUid } from './intent-project-knowledge';

export type IntentE2EKnowledgeHitEvidenceType = 'benchmark' | 'rerun_report';

export interface IntentE2EKnowledgeHitGuardEvidence {
  id: string;
  projectUid: string;
  priorityScenarioFamily: Exclude<IntentE2EPriorityScenarioFamily, 'untracked'>;
  evidencePath: string;
  evidenceType: IntentE2EKnowledgeHitEvidenceType;
  expectedRuleIds: string[];
  minKnowledgeHitRate: number;
  requirePassed: boolean;
}

export interface IntentE2EKnowledgeHitGuardConfig {
  version: 1;
  label: string;
  projectUid: string;
  evidences: IntentE2EKnowledgeHitGuardEvidence[];
}

export interface IntentE2EKnowledgeHitGuardEvidenceResult {
  id: string;
  projectUid: string;
  priorityScenarioFamily: Exclude<IntentE2EPriorityScenarioFamily, 'untracked'>;
  evidencePath: string;
  evidenceType: IntentE2EKnowledgeHitEvidenceType;
  expectedRuleIds: string[];
  matchedRuleIds: string[];
  missingRuleIds: string[];
  knowledgeHitRate: number;
  passedRuns: number;
  failedRuns: number;
  totalRuns: number;
  passed: boolean;
  failures: string[];
}

export interface IntentE2EKnowledgeHitGuardReport {
  version: 1;
  generatedAt: string;
  label: string;
  projectUid: string;
  configPath: string;
  passed: boolean;
  summary: {
    evidenceCount: number;
    passedEvidences: number;
    failedEvidences: number;
    missingRuleCount: number;
  };
  evidences: IntentE2EKnowledgeHitGuardEvidenceResult[];
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of values) {
    const value = normalizeString(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }
  return items;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePercent(value: unknown, fallback = 0): number {
  const parsed = normalizeNumber(value, fallback);
  return Math.max(0, Math.min(100, parsed));
}

function toPercent(count: number, total: number): number {
  if (!total) return 0;
  return Math.round((count / total) * 10_000) / 100;
}

function resolveInputPath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

function toDisplayPath(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath);
  return !relative || relative.startsWith('..') ? filePath : relative;
}

function normalizeEvidenceType(value: unknown): IntentE2EKnowledgeHitEvidenceType {
  return value === 'rerun_report' ? 'rerun_report' : 'benchmark';
}

export function normalizeIntentE2EKnowledgeHitGuardConfig(raw: unknown): IntentE2EKnowledgeHitGuardConfig {
  const source = asRecord(raw);
  if (!source) {
    throw new Error('knowledge hit guard config 必须是对象');
  }

  const projectUid = normalizeIntentProjectUid(source.projectUid);
  if (!projectUid) {
    throw new Error('knowledge hit guard config 缺少 projectUid');
  }

  const evidenceSource = Array.isArray(source.evidences) ? source.evidences : [];
  if (evidenceSource.length === 0) {
    throw new Error('knowledge hit guard config 至少需要 1 条 evidence');
  }

  const evidences = evidenceSource.map((item, index) => {
    const evidence = asRecord(item);
    if (!evidence) {
      throw new Error(`knowledge hit evidence 第 ${index + 1} 条必须是对象`);
    }

    const priorityScenarioFamily = normalizeIntentE2EPriorityScenarioFamily(evidence.priorityScenarioFamily);
    if (!priorityScenarioFamily || priorityScenarioFamily === 'untracked') {
      throw new Error(`knowledge hit evidence 第 ${index + 1} 条缺少有效 priorityScenarioFamily`);
    }

    const evidencePath = normalizeString(evidence.evidencePath);
    if (!evidencePath) {
      throw new Error(`knowledge hit evidence ${priorityScenarioFamily} 缺少 evidencePath`);
    }

    const expectedRuleIds = uniqueStrings(Array.isArray(evidence.expectedRuleIds) ? evidence.expectedRuleIds : []);
    if (expectedRuleIds.length === 0) {
      throw new Error(`knowledge hit evidence ${priorityScenarioFamily} 缺少 expectedRuleIds`);
    }

    return {
      id: normalizeString(evidence.id) || `${priorityScenarioFamily}-${index + 1}`,
      projectUid: normalizeIntentProjectUid(evidence.projectUid) || projectUid,
      priorityScenarioFamily,
      evidencePath,
      evidenceType: normalizeEvidenceType(evidence.evidenceType),
      expectedRuleIds,
      minKnowledgeHitRate: normalizePercent(evidence.minKnowledgeHitRate, 100),
      requirePassed: evidence.requirePassed !== false,
    } satisfies IntentE2EKnowledgeHitGuardEvidence;
  });

  return {
    version: 1,
    label: normalizeString(source.label) || 'intent-e2e-knowledge-hit-guard',
    projectUid,
    evidences,
  };
}

export async function loadIntentE2EKnowledgeHitGuardConfig(
  configPath: string
): Promise<IntentE2EKnowledgeHitGuardConfig> {
  const absolutePath = resolveInputPath(configPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`knowledge hit guard config 不存在：${configPath}`);
  }
  return normalizeIntentE2EKnowledgeHitGuardConfig(JSON.parse(await fsPromises.readFile(absolutePath, 'utf8')));
}

function extractBenchmarkEvidence(raw: unknown) {
  const source = asRecord(raw) || {};
  const summary = asRecord(source.summary) || {};
  const cases = Array.isArray(source.cases) ? source.cases : [];
  const matchedRuleIds = uniqueStrings(
    cases.flatMap((item) => {
      const record = asRecord(item) || {};
      return Array.isArray(record.matchedRuleIds) ? record.matchedRuleIds : [];
    })
  );
  return {
    matchedRuleIds,
    knowledgeHitRate: normalizePercent(summary.knowledgeHitRate, 0),
    passedRuns: Math.max(0, Math.floor(normalizeNumber(summary.passedRuns))),
    failedRuns: Math.max(0, Math.floor(normalizeNumber(summary.failedRuns))),
    totalRuns: Math.max(0, Math.floor(normalizeNumber(summary.runCount))),
  };
}

function extractRerunReportEvidence(raw: unknown) {
  const source = asRecord(raw) || {};
  const summary = asRecord(source.summary) || {};
  const runs = Array.isArray(source.runs) ? source.runs : [];
  const matchedRuleIds = uniqueStrings(
    runs.flatMap((item) => {
      const record = asRecord(item) || {};
      return Array.isArray(record.matchedRuleIds) ? record.matchedRuleIds : [];
    })
  );
  const totalRuns = Math.max(0, Math.floor(normalizeNumber(summary.requestCount, runs.length)));
  const knowledgeHitRuns = Math.max(0, Math.floor(normalizeNumber(summary.knowledgeHitRuns)));
  return {
    matchedRuleIds,
    knowledgeHitRate: normalizePercent(summary.knowledgeHitRate, toPercent(knowledgeHitRuns, totalRuns)),
    passedRuns: Math.max(0, Math.floor(normalizeNumber(summary.passedRuns))),
    failedRuns: Math.max(0, Math.floor(normalizeNumber(summary.failedRuns))),
    totalRuns,
  };
}

function evaluateEvidence(evidence: IntentE2EKnowledgeHitGuardEvidence): IntentE2EKnowledgeHitGuardEvidenceResult {
  const evidencePath = resolveInputPath(evidence.evidencePath);
  const failures: string[] = [];
  let extracted = {
    matchedRuleIds: [] as string[],
    knowledgeHitRate: 0,
    passedRuns: 0,
    failedRuns: 0,
    totalRuns: 0,
  };

  if (!fs.existsSync(evidencePath)) {
    failures.push(`证据文件不存在：${toDisplayPath(evidencePath)}`);
  } else {
    try {
      const raw = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
      extracted =
        evidence.evidenceType === 'rerun_report'
          ? extractRerunReportEvidence(raw)
          : extractBenchmarkEvidence(raw);
    } catch (error) {
      failures.push(`证据文件 JSON 无效：${toDisplayPath(evidencePath)}${error instanceof Error ? `；${error.message}` : ''}`);
    }
  }

  const missingRuleIds = evidence.expectedRuleIds.filter((ruleId) => !extracted.matchedRuleIds.includes(ruleId));
  if (missingRuleIds.length > 0) {
    failures.push(`缺少 expectedRuleIds：${missingRuleIds.join(', ')}`);
  }
  if (extracted.knowledgeHitRate < evidence.minKnowledgeHitRate) {
    failures.push(`knowledgeHitRate ${extracted.knowledgeHitRate} 低于阈值 ${evidence.minKnowledgeHitRate}`);
  }
  if (evidence.requirePassed && (extracted.passedRuns <= 0 || extracted.failedRuns > 0)) {
    failures.push(`通过证据不足：passedRuns=${extracted.passedRuns} failedRuns=${extracted.failedRuns}`);
  }

  return {
    id: evidence.id,
    projectUid: evidence.projectUid,
    priorityScenarioFamily: evidence.priorityScenarioFamily,
    evidencePath: toDisplayPath(evidencePath),
    evidenceType: evidence.evidenceType,
    expectedRuleIds: [...evidence.expectedRuleIds],
    matchedRuleIds: extracted.matchedRuleIds,
    missingRuleIds,
    knowledgeHitRate: extracted.knowledgeHitRate,
    passedRuns: extracted.passedRuns,
    failedRuns: extracted.failedRuns,
    totalRuns: extracted.totalRuns,
    passed: failures.length === 0,
    failures,
  };
}

export function runIntentE2EKnowledgeHitGuard(
  config: IntentE2EKnowledgeHitGuardConfig,
  options: {
    generatedAt?: string;
    configPath?: string;
  } = {}
): IntentE2EKnowledgeHitGuardReport {
  const evidences = config.evidences.map(evaluateEvidence);
  return {
    version: 1,
    generatedAt: normalizeString(options.generatedAt) || new Date().toISOString(),
    label: config.label,
    projectUid: config.projectUid,
    configPath: options.configPath ? toDisplayPath(resolveInputPath(options.configPath)) : '',
    passed: evidences.every((item) => item.passed),
    summary: {
      evidenceCount: evidences.length,
      passedEvidences: evidences.filter((item) => item.passed).length,
      failedEvidences: evidences.filter((item) => !item.passed).length,
      missingRuleCount: evidences.reduce((sum, item) => sum + item.missingRuleIds.length, 0),
    },
    evidences,
  };
}
