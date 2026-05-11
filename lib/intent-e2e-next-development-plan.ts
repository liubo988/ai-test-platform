import path from 'node:path';
import {
  isIntentE2ETrafficQualityDevelopmentGateReady,
  summarizeIntentE2ETrafficQualityDevelopmentGate,
  type IntentE2ETrafficQualityNextDevelopmentGateStatus,
  type IntentE2ETrafficQualityReport,
} from '@/lib/intent-e2e-traffic-quality';
import {
  getIntentE2EDocumentFamilyGovernanceProfile,
  getIntentE2EDocumentFamilyGovernancePath,
} from '@/lib/intent-e2e-document-family-governance';
import {
  getIntentE2EDocumentFamilyReleaseGuardPath,
  type IntentE2EDocumentFamilyReleaseGuardReport,
} from '@/lib/intent-e2e-document-family-release-guard';
import type { IntentE2ENewIntentReadinessReport } from '@/lib/intent-e2e-new-intent-readiness';

export const INTENT_E2E_NEXT_DEVELOPMENT_PLAN_JSON_FILE = 'intent-e2e.next-development-plan.latest.json';
export const INTENT_E2E_NEXT_DEVELOPMENT_PLAN_MD_FILE = 'intent-e2e.next-development-plan.latest.md';
export const INTENT_E2E_NEXT_DEVELOPMENT_BRIEF_TEMPLATE_PATH =
  'docs/intent-e2e-next-development-slice-brief-template-2026-05-07.md';
export const INTENT_E2E_CURRENT_DEVELOPMENT_HANDOFF_PATH =
  'docs/intent-e2e-current-development-closure-handoff-2026-05-07.md';

export type IntentE2ENextDevelopmentDecision =
  | 'start_document_family_governance'
  | 'start_priority_family_governance'
  | 'start_new_intent_fixture_contract'
  | 'collect_real_click_samples'
  | 'collect_document_real_click'
  | 'stop_no_admissible_code_work';

export interface IntentE2ENextDevelopmentCandidate {
  family: string;
  familyType: 'document' | 'priority';
  reason: string;
  launchClickCount?: number;
  autoRunStartedCount?: number;
  terminalRunCount?: number;
  terminalPassCount?: number;
  terminalPassRate?: number | null;
  governanceStatus?: string;
  releaseGuardStatus?: string;
  knowledgeHitStatus?: string;
}

export interface IntentE2ENextDevelopmentPlanReport {
  version: 1;
  generatedAt: string;
  projectUid: string;
  windowDays: number;
  developmentReady: boolean;
  decision: IntentE2ENextDevelopmentDecision;
  gateStatus: IntentE2ETrafficQualityNextDevelopmentGateStatus;
  gateSummary: string;
  recommendedAction: string;
  blockingReasons: string[];
  requiredEvidence: string[];
  eligibleFamilies: IntentE2ENextDevelopmentCandidate[];
  realClickPriorityFamilyCandidates: IntentE2ENextDevelopmentCandidate[];
  documentFamilyCandidates: IntentE2ENextDevelopmentCandidate[];
  sourceSnapshot: {
    realClickTerminalRunCount: number;
    realClickTerminalPassCount: number;
    realClickTerminalPassRate: number | null;
    benchmarkRerunTerminalRunCount: number;
    benchmarkRerunTerminalPassCount: number;
    benchmarkRerunTerminalPassRate: number | null;
    documentSelectionMode: string;
    sampleReadiness: 'ready' | 'not_ready';
  };
  newIntentReadinessSnapshot: {
    total: number;
    realClickTotal: number;
    draftImportTotal: number;
    directGenerateCount: number;
    needsFixtureCount: number;
    draftOnlyCount: number;
    fixtureBootstrapCount: number;
    realClickFixtureBootstrapCount: number;
    topFixtureFamilies: Array<{
      family: string;
      count: number;
    }>;
  } | null;
  commands: {
    gateCheck: string;
    trafficQualityReport: string;
    newIntentReadiness: string;
    fixtureBootstrap: string;
    documentFamilyGovernance: string;
    documentFamilyReleaseGuard: string;
    releaseStatus: string;
    validation: string[];
  };
  paths: {
    briefTemplate: string;
    currentHandoff: string;
    trafficQualityJson?: string;
    trafficQualityMarkdown?: string;
    documentFamilyGovernanceJson?: string;
    documentFamilyGovernanceMarkdown?: string;
    documentFamilyReleaseGuardJson?: string;
    documentFamilyReleaseGuardMarkdown?: string;
  };
  stopConditions: string[];
}

export function getIntentE2ENextDevelopmentPlanPath(projectUid: string, kind: 'json' | 'md'): string {
  const fileName =
    kind === 'json' ? INTENT_E2E_NEXT_DEVELOPMENT_PLAN_JSON_FILE : INTENT_E2E_NEXT_DEVELOPMENT_PLAN_MD_FILE;
  return path.join(process.cwd(), 'reports', 'intent-e2e', 'projects', projectUid, fileName);
}

function decideNextDevelopmentAction(
  status: IntentE2ETrafficQualityNextDevelopmentGateStatus
): IntentE2ENextDevelopmentDecision {
  if (status === 'ready_for_document_family_governance') return 'start_document_family_governance';
  if (status === 'ready_for_ungoverned_priority_family') return 'start_priority_family_governance';
  if (status === 'blocked_on_real_click_readiness') return 'collect_real_click_samples';
  if (status === 'blocked_on_document_real_click') return 'collect_document_real_click';
  return 'stop_no_admissible_code_work';
}

function isCompletedDocumentFamilyCandidate(candidate: IntentE2ENextDevelopmentCandidate): boolean {
  return candidate.governanceStatus === 'contract_ready' && candidate.releaseGuardStatus === 'passed';
}

function inferNewIntentFixtureFamilyType(family: string): IntentE2ENextDevelopmentCandidate['familyType'] {
  return family.startsWith('doc_') ? 'document' : 'priority';
}

function buildNewIntentReadinessSnapshot(
  report?: IntentE2ENewIntentReadinessReport | null
): IntentE2ENextDevelopmentPlanReport['newIntentReadinessSnapshot'] {
  if (!report) return null;

  const fixtureFamilyCounts = new Map<string, number>();
  let fixtureBootstrapCount = 0;
  let realClickFixtureBootstrapCount = 0;

  for (const item of report.items) {
    if (!item.fixtureBootstrap) continue;
    fixtureBootstrapCount += 1;
    if (item.signals.source === 'real_click') realClickFixtureBootstrapCount += 1;
    const family = item.signals.documentFamily || item.signals.priorityScenarioFamily || 'untracked';
    fixtureFamilyCounts.set(family, (fixtureFamilyCounts.get(family) || 0) + 1);
  }

  return {
    total: report.total,
    realClickTotal: report.summary.bySource.real_click || 0,
    draftImportTotal: report.summary.bySource.draft_import || 0,
    directGenerateCount: report.summary.byRecommendedMode.direct_generate || 0,
    needsFixtureCount: report.summary.byRecommendedMode.needs_fixture || 0,
    draftOnlyCount: report.summary.byRecommendedMode.draft_only || 0,
    fixtureBootstrapCount,
    realClickFixtureBootstrapCount,
    topFixtureFamilies: Array.from(fixtureFamilyCounts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5)
      .map(([family, count]) => ({ family, count })),
  };
}

export function buildIntentE2ENextDevelopmentPlanReport(input: {
  trafficQualityReport: IntentE2ETrafficQualityReport;
  trafficQualityJsonPath?: string;
  trafficQualityMarkdownPath?: string;
  documentFamilyGovernanceJsonPath?: string;
  documentFamilyGovernanceMarkdownPath?: string;
  documentFamilyReleaseGuardJsonPath?: string;
  documentFamilyReleaseGuardMarkdownPath?: string;
  documentFamilyReleaseGuardReport?: IntentE2EDocumentFamilyReleaseGuardReport;
  newIntentReadinessReport?: IntentE2ENewIntentReadinessReport | null;
  generatedAt?: string;
}): IntentE2ENextDevelopmentPlanReport {
  const report = input.trafficQualityReport;
  const gate = report.nextPlanRecommendation.developmentGate;
  const gateStatus = gate.status;
  const gateCheckCommand = `npm run intent:next-dev:check -- --project-uid ${report.projectUid} --window-days ${report.window.days}`;
  const trafficQualityCommand = `npm run intent:traffic-quality -- --project-uid ${report.projectUid} --window-days ${report.window.days}`;
  const newIntentReadinessCommand = `npm run intent:new-intent:readiness -- --project-uid ${report.projectUid} --window-days ${report.window.days}`;
  const fixtureBootstrapCommand = `npm run intent:fixture-bootstrap -- --project-uid ${report.projectUid} --window-days ${report.window.days}`;
  const newIntentReadinessSnapshot = buildNewIntentReadinessSnapshot(input.newIntentReadinessReport);
  const hasRealClickFixtureBootstrap =
    Boolean(newIntentReadinessSnapshot) && (newIntentReadinessSnapshot?.realClickFixtureBootstrapCount || 0) > 0;

  const realClickPriorityFamilyCandidates = report.nextPlanRecommendation.realClickPriorityFamilyCandidates.map(
    (candidate) => ({
      family: candidate.family,
      familyType: 'priority' as const,
      reason: candidate.selectionReason,
      launchClickCount: candidate.launchClickCount,
      autoRunStartedCount: candidate.autoRunStartedCount,
      terminalRunCount: candidate.terminalRunCount,
      terminalPassCount: candidate.terminalPassCount,
      terminalPassRate: candidate.terminalPassRate,
      governanceStatus: candidate.governanceStatus,
      releaseGuardStatus: candidate.releaseGuardStatus,
      knowledgeHitStatus: candidate.knowledgeHitStatus,
    })
  );

  const documentReleaseGuardByFamily = new Map(
    (input.documentFamilyReleaseGuardReport?.baselines || []).map((baseline) => [baseline.family, baseline.status])
  );
  const documentFamilyCandidates = report.documentFamilySelection.candidates.map((candidate) => ({
    family: candidate.family,
    familyType: 'document' as const,
    reason: `signals=${candidate.signalCount}, real_click_signals=${candidate.realClickSignalCount}, latest=${candidate.latestSeenAt || '-'}`,
    governanceStatus: getIntentE2EDocumentFamilyGovernanceProfile(candidate.family)?.status || 'missing',
    releaseGuardStatus: documentReleaseGuardByFamily.get(candidate.family) || 'separate_guard_missing',
    knowledgeHitStatus: 'not_applicable',
  }));
  const gateDocumentFamilySet = new Set(
    gate.eligibleFamilies
      .filter((candidate) => candidate.familyType === 'document')
      .map((candidate) => candidate.family)
  );
  const gateDocumentFamilyCandidates = documentFamilyCandidates.filter((candidate) =>
    gateDocumentFamilySet.has(candidate.family)
  );
  const completedDocumentFamilySet = new Set<string>(
    documentFamilyCandidates.filter(isCompletedDocumentFamilyCandidate).map((candidate) => candidate.family)
  );
  const hasOnlyCompletedDocumentCandidates =
    gateStatus === 'ready_for_document_family_governance' &&
    gateDocumentFamilyCandidates.length > 0 &&
    gateDocumentFamilyCandidates.every(isCompletedDocumentFamilyCandidate);
  const developmentReady =
    hasRealClickFixtureBootstrap ||
    (isIntentE2ETrafficQualityDevelopmentGateReady(gateStatus) && !hasOnlyCompletedDocumentCandidates);
  const decision: IntentE2ENextDevelopmentDecision = hasRealClickFixtureBootstrap
    ? 'start_new_intent_fixture_contract'
    : hasOnlyCompletedDocumentCandidates
      ? 'collect_document_real_click'
      : decideNextDevelopmentAction(gateStatus);
  const blockingReasons = [
    ...gate.blockingReasons,
    ...(hasOnlyCompletedDocumentCandidates
      ? [
          'traffic-quality 仍只推荐已完成 contract_ready 且 document-family guard=passed 的 document family，当前没有新的未治理 document code work。',
        ]
      : []),
  ];
  const requiredEvidence = [
    ...gate.requiredEvidence,
    ...(hasRealClickFixtureBootstrap
      ? ['需要先为 new-intent readiness 中的 real_click fixtureBootstrap 候选补齐 repo-owned setup / cleanup / owner / idempotencyKey。']
      : []),
    ...(hasOnlyCompletedDocumentCandidates
      ? ['需要新的未治理 document-like source=real_click family，或继续采集真实 document-like real_click 直到出现新候选。']
      : []),
  ];
  const recommendedAction = hasRealClickFixtureBootstrap
    ? 'new-intent readiness 出现 real_click fixtureBootstrap 候选；先补 fixture contract，不要把这类缺口归为 no-actionable。'
    : hasOnlyCompletedDocumentCandidates
      ? '当前 recommended document family 已 contract_ready 且独立 guard passed；不要重复治理同一 family，继续采集新的 document-like real_click 或等待新的未治理 document family。'
      : report.nextPlanRecommendation.recommendedAction;
  const eligibleFamilies = hasRealClickFixtureBootstrap
    ? (newIntentReadinessSnapshot?.topFixtureFamilies || []).map((candidate) => ({
        family: candidate.family,
        familyType: inferNewIntentFixtureFamilyType(candidate.family),
        reason: `new_intent_real_click_fixtureBootstrap=${candidate.count}`,
      }))
    : gate.eligibleFamilies
        .filter((candidate) => {
          if (candidate.familyType !== 'document') return true;
          return !completedDocumentFamilySet.has(candidate.family);
        })
        .map((candidate) => ({
          family: candidate.family,
          familyType: candidate.familyType,
          reason: candidate.reason,
        }));

  return {
    version: 1,
    generatedAt: input.generatedAt || new Date().toISOString(),
    projectUid: report.projectUid,
    windowDays: report.window.days,
    developmentReady,
    decision,
    gateStatus,
    gateSummary: summarizeIntentE2ETrafficQualityDevelopmentGate(gate),
    recommendedAction,
    blockingReasons,
    requiredEvidence,
    eligibleFamilies,
    realClickPriorityFamilyCandidates,
    documentFamilyCandidates,
    sourceSnapshot: {
      realClickTerminalRunCount: report.summary.realClickTerminalRunCount,
      realClickTerminalPassCount: report.summary.realClickTerminalPassCount,
      realClickTerminalPassRate: report.summary.realClickTerminalPassRate,
      benchmarkRerunTerminalRunCount: report.summary.benchmarkRerunTerminalRunCount,
      benchmarkRerunTerminalPassCount: report.summary.benchmarkRerunTerminalPassCount,
      benchmarkRerunTerminalPassRate: report.summary.benchmarkRerunTerminalPassRate,
      documentSelectionMode: report.documentFamilySelection.mode,
      sampleReadiness: report.sampleReadiness.readyForFamilySelection ? 'ready' : 'not_ready',
    },
    newIntentReadinessSnapshot,
    commands: {
      gateCheck: gateCheckCommand,
      trafficQualityReport: trafficQualityCommand,
      newIntentReadiness: newIntentReadinessCommand,
      fixtureBootstrap: fixtureBootstrapCommand,
      documentFamilyGovernance: `npm run intent:document-family:governance -- --project-uid ${report.projectUid} --require-ready`,
      documentFamilyReleaseGuard: `npm run intent:document-family:guard -- --project-uid ${report.projectUid} --require-passed`,
      releaseStatus: `npm run intent:release-status -- --require-current-compare --json`,
      validation: [
        'npm run build',
        'npm run build:web',
        'npx vitest run <affected unit tests>',
        'npm run test:integration',
        'npx playwright test --grep @smoke',
        'bash scripts/check-boundaries.sh',
        'node scripts/check-doc-links.mjs',
        'node scripts/check-roadmap-progress.mjs',
      ],
    },
    paths: {
      briefTemplate: INTENT_E2E_NEXT_DEVELOPMENT_BRIEF_TEMPLATE_PATH,
      currentHandoff: INTENT_E2E_CURRENT_DEVELOPMENT_HANDOFF_PATH,
      trafficQualityJson: input.trafficQualityJsonPath,
      trafficQualityMarkdown: input.trafficQualityMarkdownPath,
      documentFamilyGovernanceJson:
        input.documentFamilyGovernanceJsonPath || getIntentE2EDocumentFamilyGovernancePath(report.projectUid, 'json'),
      documentFamilyGovernanceMarkdown:
        input.documentFamilyGovernanceMarkdownPath || getIntentE2EDocumentFamilyGovernancePath(report.projectUid, 'md'),
      documentFamilyReleaseGuardJson:
        input.documentFamilyReleaseGuardJsonPath || getIntentE2EDocumentFamilyReleaseGuardPath(report.projectUid, 'json'),
      documentFamilyReleaseGuardMarkdown:
        input.documentFamilyReleaseGuardMarkdownPath || getIntentE2EDocumentFamilyReleaseGuardPath(report.projectUid, 'md'),
    },
    stopConditions: [
      'developmentGate.status is not ready_for_document_family_governance or ready_for_ungoverned_priority_family.',
      'candidate family evidence is not based on source=real_click.',
      'implementation starts mixing benchmark_rerun / replay / draft_import into real-click success denominators.',
      'document family work lacks document-like real_click launch evidence.',
      'traffic-quality only recommends document families that are already contract_ready and document-family guard passed.',
      'new-intent readiness shows real_click fixtureBootstrap candidates; handle fixture contract first before claiming no actionable gap.',
      'scope expands into OCR-first or unrelated verifier work.',
    ],
  };
}

function renderList(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ['- -'];
}

function renderCandidateRows(candidates: IntentE2ENextDevelopmentCandidate[]): string[] {
  if (candidates.length === 0) return ['| - | - | - | - | - | - | - | - | - | - |'];
  return candidates.map((candidate) =>
    [
      candidate.family,
      candidate.familyType,
      candidate.launchClickCount ?? '-',
      candidate.autoRunStartedCount ?? '-',
      candidate.terminalRunCount ?? '-',
      candidate.terminalPassCount ?? '-',
      candidate.terminalPassRate == null ? '-' : `${candidate.terminalPassRate}%`,
      candidate.governanceStatus ?? '-',
      candidate.releaseGuardStatus ?? '-',
      candidate.knowledgeHitStatus ?? '-',
    ].join(' | ')
  );
}

function renderNewIntentTopFixtureFamilies(
  snapshot: NonNullable<IntentE2ENextDevelopmentPlanReport['newIntentReadinessSnapshot']>
): string {
  if (snapshot.topFixtureFamilies.length === 0) return '-';
  return snapshot.topFixtureFamilies.map((item) => `${item.family}:${item.count}`).join(', ');
}

export function renderIntentE2ENextDevelopmentPlanMarkdown(report: IntentE2ENextDevelopmentPlanReport): string {
  return [
    '# Intent E2E Next Development Plan',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- projectUid: ${report.projectUid}`,
    `- windowDays: ${report.windowDays}`,
    `- developmentReady: ${report.developmentReady ? 'yes' : 'no'}`,
    `- gateStatus: ${report.gateStatus}`,
    `- decision: ${report.decision}`,
    `- gateSummary: ${report.gateSummary}`,
    '',
    '## Source Snapshot',
    '',
    `- real_click terminal: ${report.sourceSnapshot.realClickTerminalPassCount}/${report.sourceSnapshot.realClickTerminalRunCount} (${report.sourceSnapshot.realClickTerminalPassRate ?? '-'}%)`,
    `- benchmark_rerun terminal: ${report.sourceSnapshot.benchmarkRerunTerminalPassCount}/${report.sourceSnapshot.benchmarkRerunTerminalRunCount} (${report.sourceSnapshot.benchmarkRerunTerminalPassRate ?? '-'}%)`,
    `- sampleReadiness: ${report.sourceSnapshot.sampleReadiness}`,
    `- documentSelectionMode: ${report.sourceSnapshot.documentSelectionMode}`,
    '',
    '## New Intent Readiness Snapshot',
    '',
    report.newIntentReadinessSnapshot
      ? `- total: ${report.newIntentReadinessSnapshot.total}`
      : '- total: -',
    report.newIntentReadinessSnapshot
      ? `- real_click: ${report.newIntentReadinessSnapshot.realClickTotal}`
      : '- real_click: -',
    report.newIntentReadinessSnapshot
      ? `- direct_generate: ${report.newIntentReadinessSnapshot.directGenerateCount}`
      : '- direct_generate: -',
    report.newIntentReadinessSnapshot
      ? `- needs_fixture: ${report.newIntentReadinessSnapshot.needsFixtureCount}`
      : '- needs_fixture: -',
    report.newIntentReadinessSnapshot
      ? `- fixtureBootstrap: ${report.newIntentReadinessSnapshot.fixtureBootstrapCount}`
      : '- fixtureBootstrap: -',
    report.newIntentReadinessSnapshot
      ? `- real_click_fixtureBootstrap: ${report.newIntentReadinessSnapshot.realClickFixtureBootstrapCount}`
      : '- real_click_fixtureBootstrap: -',
    report.newIntentReadinessSnapshot
      ? `- topFixtureFamilies: ${renderNewIntentTopFixtureFamilies(report.newIntentReadinessSnapshot)}`
      : '- topFixtureFamilies: -',
    '',
    '## Recommended Action',
    '',
    report.recommendedAction || '-',
    '',
    '## Blocking Reasons',
    '',
    ...renderList(report.blockingReasons),
    '',
    '## Required Evidence',
    '',
    ...renderList(report.requiredEvidence),
    '',
    '## Eligible Families',
    '',
    '| family | family_type | reason |',
    '| --- | --- | --- |',
    ...(report.eligibleFamilies.length > 0
      ? report.eligibleFamilies.map((candidate) => `${candidate.family} | ${candidate.familyType} | ${candidate.reason}`)
      : ['- | - | -']),
    '',
    '## Real Click Priority Candidates',
    '',
    '| family | family_type | launch_click | auto_run | terminal | passed | pass_rate | governance | release_guard | knowledge_hit |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |',
    ...renderCandidateRows(report.realClickPriorityFamilyCandidates),
    '',
    '## Document Family Candidates',
    '',
    '| family | family_type | launch_click | auto_run | terminal | passed | pass_rate | governance | release_guard | knowledge_hit |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |',
    ...renderCandidateRows(report.documentFamilyCandidates),
    '',
    '## Commands',
    '',
    `- gateCheck: \`${report.commands.gateCheck}\``,
    `- trafficQualityReport: \`${report.commands.trafficQualityReport}\``,
    `- newIntentReadiness: \`${report.commands.newIntentReadiness}\``,
    `- fixtureBootstrap: \`${report.commands.fixtureBootstrap}\``,
    `- documentFamilyGovernance: \`${report.commands.documentFamilyGovernance}\``,
    `- documentFamilyReleaseGuard: \`${report.commands.documentFamilyReleaseGuard}\``,
    `- releaseStatus: \`${report.commands.releaseStatus}\``,
    '',
    '## Validation Commands',
    '',
    ...report.commands.validation.map((command) => `- \`${command}\``),
    '',
    '## Paths',
    '',
    `- briefTemplate: ${report.paths.briefTemplate}`,
    `- currentHandoff: ${report.paths.currentHandoff}`,
    `- trafficQualityJson: ${report.paths.trafficQualityJson || '-'}`,
    `- trafficQualityMarkdown: ${report.paths.trafficQualityMarkdown || '-'}`,
    `- documentFamilyGovernanceJson: ${report.paths.documentFamilyGovernanceJson || '-'}`,
    `- documentFamilyGovernanceMarkdown: ${report.paths.documentFamilyGovernanceMarkdown || '-'}`,
    `- documentFamilyReleaseGuardJson: ${report.paths.documentFamilyReleaseGuardJson || '-'}`,
    `- documentFamilyReleaseGuardMarkdown: ${report.paths.documentFamilyReleaseGuardMarkdown || '-'}`,
    '',
    '## Stop Conditions',
    '',
    ...renderList(report.stopConditions),
    '',
  ].join('\n');
}
