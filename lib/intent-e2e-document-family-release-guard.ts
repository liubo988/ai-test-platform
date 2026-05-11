import path from 'node:path';
import type { IntentE2EDocumentRealClickSeedReport } from '@/lib/intent-e2e-document-real-click-seed';
import type {
  IntentE2EDocumentFamilyGovernanceProfile,
  IntentE2EDocumentFamilyGovernanceReport,
} from '@/lib/intent-e2e-document-family-governance';
import {
  getIntentE2EDocumentFamilyGovernanceProfile,
  type IntentE2EDocumentFamilyGovernanceStatus,
} from '@/lib/intent-e2e-document-family-governance';
import type {
  IntentE2ETrafficQualityDocumentFamily,
  IntentE2ETrafficQualityDocumentFamilyCandidate,
  IntentE2ETrafficQualityReport,
} from '@/lib/intent-e2e-traffic-quality';

export const INTENT_E2E_DOCUMENT_FAMILY_RELEASE_GUARD_JSON_FILE =
  'intent-e2e.document-family-release-guard.latest.json';
export const INTENT_E2E_DOCUMENT_FAMILY_RELEASE_GUARD_MD_FILE =
  'intent-e2e.document-family-release-guard.latest.md';

export type IntentE2EDocumentFamilyReleaseGuardStatus = 'passed' | 'failed';
export type IntentE2EDocumentFamilyReleaseGuardFailureMode =
  | 'missing_governance_profile'
  | 'governance_contract_not_ready'
  | 'traffic_selection_not_real_click'
  | 'family_not_recommended'
  | 'insufficient_real_click_signals'
  | 'insufficient_admissible_passed_runs'
  | 'missing_required_recipe';

export interface IntentE2EDocumentFamilyReleaseGuardBaseline {
  id: string;
  projectUid: string;
  family: IntentE2ETrafficQualityDocumentFamily;
  minRealClickSignals: number;
  minAdmissiblePassedRuns: number;
  requiredRecipeSlugs: string[];
  fixtureId: string;
}

export interface IntentE2EDocumentFamilyReleaseGuardFailure {
  family: IntentE2ETrafficQualityDocumentFamily;
  failureMode: IntentE2EDocumentFamilyReleaseGuardFailureMode;
  note: string;
}

export interface IntentE2EDocumentFamilyReleaseGuardBaselineResult {
  id: string;
  projectUid: string;
  family: IntentE2ETrafficQualityDocumentFamily;
  status: IntentE2EDocumentFamilyReleaseGuardStatus;
  governanceStatus: IntentE2EDocumentFamilyGovernanceStatus | 'missing';
  sourcePolicy: 'post_instrumentation_real_click_only';
  recipeSlugs: string[];
  fixtureId: string;
  traffic: {
    documentSelectionMode: string;
    recommended: boolean;
    realClickSignalCount: number;
    signalCount: number;
    latestSeenAt: string;
  };
  seedEvidence: {
    reportCount: number;
    admissibleRunCount: number;
    terminalRunCount: number;
    passedRunCount: number;
    failedRunCount: number;
    runIds: string[];
  };
  thresholds: {
    minRealClickSignals: number;
    minAdmissiblePassedRuns: number;
  };
  requiredEvidence: string[];
  failures: IntentE2EDocumentFamilyReleaseGuardFailure[];
}

export interface IntentE2EDocumentFamilyReleaseGuardReport {
  version: 1;
  generatedAt: string;
  projectUid: string;
  label: string;
  sourcePolicy: 'post_instrumentation_real_click_only';
  passed: boolean;
  summary: {
    baselineCount: number;
    passedBaselines: number;
    failedBaselines: number;
    totalRealClickSignals: number;
    totalAdmissiblePassedRuns: number;
  };
  baselines: IntentE2EDocumentFamilyReleaseGuardBaselineResult[];
  stopConditions: string[];
}

export const DEFAULT_INTENT_E2E_DOCUMENT_FAMILY_GUARD_MIN_REAL_CLICK_SIGNALS = 3;
export const DEFAULT_INTENT_E2E_DOCUMENT_FAMILY_GUARD_MIN_ADMISSIBLE_PASSED_RUNS = 3;

function uniqueStrings(values: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || Number(value) <= 0) return fallback;
  return Math.floor(Number(value));
}

function isTerminalStatus(status: string): boolean {
  return status === 'passed' || status === 'failed' || status === 'canceled';
}

function buildDefaultBaseline(input: {
  projectUid: string;
  family: IntentE2ETrafficQualityDocumentFamily;
  profile: IntentE2EDocumentFamilyGovernanceProfile | null;
  minRealClickSignals?: number;
  minAdmissiblePassedRuns?: number;
}): IntentE2EDocumentFamilyReleaseGuardBaseline {
  return {
    id: `${input.family}-document-family-release-guard`,
    projectUid: input.projectUid,
    family: input.family,
    minRealClickSignals: normalizePositiveInt(
      input.minRealClickSignals,
      DEFAULT_INTENT_E2E_DOCUMENT_FAMILY_GUARD_MIN_REAL_CLICK_SIGNALS
    ),
    minAdmissiblePassedRuns: normalizePositiveInt(
      input.minAdmissiblePassedRuns,
      DEFAULT_INTENT_E2E_DOCUMENT_FAMILY_GUARD_MIN_ADMISSIBLE_PASSED_RUNS
    ),
    requiredRecipeSlugs: input.profile?.recipeSlugs || [],
    fixtureId: input.profile?.fixtureContract.fixtureId || '',
  };
}

function findGovernanceProfile(input: {
  family: IntentE2ETrafficQualityDocumentFamily;
  governanceReport?: IntentE2EDocumentFamilyGovernanceReport | null;
}): IntentE2EDocumentFamilyGovernanceProfile | null {
  const reportProfile = input.governanceReport?.profiles.find((profile) => profile.family === input.family);
  return reportProfile || getIntentE2EDocumentFamilyGovernanceProfile(input.family);
}

function findTrafficCandidate(
  trafficQualityReport: IntentE2ETrafficQualityReport,
  family: IntentE2ETrafficQualityDocumentFamily
): IntentE2ETrafficQualityDocumentFamilyCandidate | null {
  return trafficQualityReport.documentFamilySelection.candidates.find((candidate) => candidate.family === family) || null;
}

function aggregateSeedEvidence(input: {
  family: IntentE2ETrafficQualityDocumentFamily;
  seedReports: readonly IntentE2EDocumentRealClickSeedReport[];
}): IntentE2EDocumentFamilyReleaseGuardBaselineResult['seedEvidence'] {
  const reportCount = input.seedReports.length;
  const seenRuns = new Set<string>();
  let admissibleRunCount = 0;
  let terminalRunCount = 0;
  let passedRunCount = 0;
  let failedRunCount = 0;
  const runIds: string[] = [];

  for (const report of input.seedReports) {
    for (const result of report.results || []) {
      if (result.documentFamily !== input.family) continue;
      if (result.admissibility !== 'document_family_admissible') continue;

      const runKey = result.runId || `${report.generatedAt}:${result.sampleId}:${result.status}`;
      if (seenRuns.has(runKey)) continue;
      seenRuns.add(runKey);

      admissibleRunCount += 1;
      if (isTerminalStatus(result.status)) terminalRunCount += 1;
      if (result.status === 'passed') passedRunCount += 1;
      if (result.status === 'failed') failedRunCount += 1;
      if (result.runId) runIds.push(result.runId);
    }
  }

  return {
    reportCount,
    admissibleRunCount,
    terminalRunCount,
    passedRunCount,
    failedRunCount,
    runIds: uniqueStrings(runIds),
  };
}

function buildFailures(input: {
  baseline: IntentE2EDocumentFamilyReleaseGuardBaseline;
  profile: IntentE2EDocumentFamilyGovernanceProfile | null;
  trafficQualityReport: IntentE2ETrafficQualityReport;
  trafficCandidate: IntentE2ETrafficQualityDocumentFamilyCandidate | null;
  seedEvidence: IntentE2EDocumentFamilyReleaseGuardBaselineResult['seedEvidence'];
}): IntentE2EDocumentFamilyReleaseGuardFailure[] {
  const failures: IntentE2EDocumentFamilyReleaseGuardFailure[] = [];
  const family = input.baseline.family;

  if (!input.profile) {
    failures.push({
      family,
      failureMode: 'missing_governance_profile',
      note: '缺少 document family governance profile。',
    });
  } else if (input.profile.status !== 'contract_ready') {
    failures.push({
      family,
      failureMode: 'governance_contract_not_ready',
      note: `governance profile 状态为 ${input.profile.status}，未达到 contract_ready。`,
    });
  }

  if (input.trafficQualityReport.documentFamilySelection.mode !== 'post_instrumentation_real_click') {
    failures.push({
      family,
      failureMode: 'traffic_selection_not_real_click',
      note: `documentSelection.mode=${input.trafficQualityReport.documentFamilySelection.mode}，不是 post_instrumentation_real_click。`,
    });
  }

  if (!input.trafficQualityReport.documentFamilySelection.recommendedTopFamilies.includes(family)) {
    failures.push({
      family,
      failureMode: 'family_not_recommended',
      note: 'family 不在 traffic-quality recommendedTopFamilies 中。',
    });
  }

  const realClickSignalCount = input.trafficCandidate?.realClickSignalCount || 0;
  if (realClickSignalCount < input.baseline.minRealClickSignals) {
    failures.push({
      family,
      failureMode: 'insufficient_real_click_signals',
      note: `real_click signals=${realClickSignalCount}，低于阈值 ${input.baseline.minRealClickSignals}。`,
    });
  }

  if (input.seedEvidence.passedRunCount < input.baseline.minAdmissiblePassedRuns) {
    failures.push({
      family,
      failureMode: 'insufficient_admissible_passed_runs',
      note: `admissible passed runs=${input.seedEvidence.passedRunCount}，低于阈值 ${input.baseline.minAdmissiblePassedRuns}。`,
    });
  }

  const profileRecipeSet = new Set(input.profile?.recipeSlugs || []);
  for (const recipeSlug of input.baseline.requiredRecipeSlugs) {
    if (!profileRecipeSet.has(recipeSlug)) {
      failures.push({
        family,
        failureMode: 'missing_required_recipe',
        note: `governance profile 缺少 required recipe ${recipeSlug}。`,
      });
    }
  }

  return failures;
}

export function getIntentE2EDocumentFamilyReleaseGuardPath(projectUid: string, kind: 'json' | 'md'): string {
  const fileName =
    kind === 'json' ? INTENT_E2E_DOCUMENT_FAMILY_RELEASE_GUARD_JSON_FILE : INTENT_E2E_DOCUMENT_FAMILY_RELEASE_GUARD_MD_FILE;
  return path.join(process.cwd(), 'reports', 'intent-e2e', 'projects', projectUid, fileName);
}

export function buildIntentE2EDocumentFamilyReleaseGuardReport(input: {
  projectUid: string;
  trafficQualityReport: IntentE2ETrafficQualityReport;
  governanceReport?: IntentE2EDocumentFamilyGovernanceReport | null;
  seedReports?: readonly IntentE2EDocumentRealClickSeedReport[];
  families?: readonly IntentE2ETrafficQualityDocumentFamily[];
  minRealClickSignals?: number;
  minAdmissiblePassedRuns?: number;
  generatedAt?: string;
  label?: string;
}): IntentE2EDocumentFamilyReleaseGuardReport {
  const families =
    input.families && input.families.length > 0
      ? uniqueStrings(input.families) as IntentE2ETrafficQualityDocumentFamily[]
      : [...input.trafficQualityReport.documentFamilySelection.recommendedTopFamilies];
  const seedReports = input.seedReports || [];

  const baselines = families.map((family) => {
    const profile = findGovernanceProfile({ family, governanceReport: input.governanceReport });
    const baseline = buildDefaultBaseline({
      projectUid: input.projectUid,
      family,
      profile,
      minRealClickSignals: input.minRealClickSignals,
      minAdmissiblePassedRuns: input.minAdmissiblePassedRuns,
    });
    const trafficCandidate = findTrafficCandidate(input.trafficQualityReport, family);
    const seedEvidence = aggregateSeedEvidence({ family, seedReports });
    const failures = buildFailures({
      baseline,
      profile,
      trafficQualityReport: input.trafficQualityReport,
      trafficCandidate,
      seedEvidence,
    });

    return {
      id: baseline.id,
      projectUid: baseline.projectUid,
      family,
      status: failures.length === 0 ? 'passed' as const : 'failed' as const,
      governanceStatus: profile?.status || 'missing' as const,
      sourcePolicy: 'post_instrumentation_real_click_only' as const,
      recipeSlugs: profile?.recipeSlugs || [],
      fixtureId: profile?.fixtureContract.fixtureId || '',
      traffic: {
        documentSelectionMode: input.trafficQualityReport.documentFamilySelection.mode,
        recommended: input.trafficQualityReport.documentFamilySelection.recommendedTopFamilies.includes(family),
        realClickSignalCount: trafficCandidate?.realClickSignalCount || 0,
        signalCount: trafficCandidate?.signalCount || 0,
        latestSeenAt: trafficCandidate?.latestSeenAt || '',
      },
      seedEvidence,
      thresholds: {
        minRealClickSignals: baseline.minRealClickSignals,
        minAdmissiblePassedRuns: baseline.minAdmissiblePassedRuns,
      },
      requiredEvidence: profile?.verifierContract.requiredEvidence || [],
      failures,
    };
  });

  const passedBaselines = baselines.filter((baseline) => baseline.status === 'passed').length;
  return {
    version: 1,
    generatedAt: input.generatedAt || new Date().toISOString(),
    projectUid: input.projectUid,
    label: input.label || 'document-family-release-guard',
    sourcePolicy: 'post_instrumentation_real_click_only',
    passed: baselines.length > 0 && passedBaselines === baselines.length,
    summary: {
      baselineCount: baselines.length,
      passedBaselines,
      failedBaselines: baselines.length - passedBaselines,
      totalRealClickSignals: baselines.reduce((sum, baseline) => sum + baseline.traffic.realClickSignalCount, 0),
      totalAdmissiblePassedRuns: baselines.reduce((sum, baseline) => sum + baseline.seedEvidence.passedRunCount, 0),
    },
    baselines,
    stopConditions: [
      'traffic-quality documentSelection.mode is not post_instrumentation_real_click.',
      'candidate evidence is not source=real_click.',
      'governance profile is missing or not contract_ready.',
      'admissible document seed runs are missing or failing.',
      'scope expands into OCR-first, benchmark_rerun, replay, draft_import, or existing release-readiness summary.',
    ],
  };
}

export function renderIntentE2EDocumentFamilyReleaseGuardMarkdown(
  report: IntentE2EDocumentFamilyReleaseGuardReport
): string {
  const lines: string[] = [
    '# Intent E2E Document Family Release Guard',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- projectUid: ${report.projectUid}`,
    `- label: ${report.label}`,
    `- sourcePolicy: ${report.sourcePolicy}`,
    `- passed: ${report.passed ? 'yes' : 'no'}`,
    `- baselineCount: ${report.summary.baselineCount}`,
    `- passedBaselines: ${report.summary.passedBaselines}`,
    `- failedBaselines: ${report.summary.failedBaselines}`,
    `- totalRealClickSignals: ${report.summary.totalRealClickSignals}`,
    `- totalAdmissiblePassedRuns: ${report.summary.totalAdmissiblePassedRuns}`,
    '',
    'family | status | governance | real_click_signals | passed_runs | fixture | recipes | failures',
    '--- | --- | --- | ---: | ---: | --- | --- | ---',
    ...report.baselines.map((baseline) =>
      [
        baseline.family,
        baseline.status,
        baseline.governanceStatus,
        baseline.traffic.realClickSignalCount,
        baseline.seedEvidence.passedRunCount,
        baseline.fixtureId || '-',
        baseline.recipeSlugs.join(', ') || '-',
        baseline.failures.length > 0
          ? baseline.failures.map((failure) => `${failure.failureMode}: ${failure.note}`).join('; ')
          : '-',
      ].join(' | ')
    ),
    '',
    '## Required Evidence',
  ];

  for (const baseline of report.baselines) {
    lines.push('', `### ${baseline.family}`, ...baseline.requiredEvidence.map((item) => `- ${item}`));
  }

  lines.push('', '## Stop Conditions', ...report.stopConditions.map((item) => `- ${item}`), '');
  return lines.join('\n');
}
