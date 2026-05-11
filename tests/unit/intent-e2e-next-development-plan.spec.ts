import { describe, expect, it } from 'vitest';
import {
  buildIntentE2ENextDevelopmentPlanReport,
  renderIntentE2ENextDevelopmentPlanMarkdown,
} from '@/lib/intent-e2e-next-development-plan';
import type { IntentE2ENewIntentReadinessReport } from '@/lib/intent-e2e-new-intent-readiness';
import type { IntentE2ETrafficQualityReport } from '@/lib/intent-e2e-traffic-quality';

function makeTrafficQualityReport(
  override: Partial<IntentE2ETrafficQualityReport['nextPlanRecommendation']['developmentGate']> = {}
): IntentE2ETrafficQualityReport {
  const gate = {
    status: 'no_admissible_code_work' as const,
    eligibleFamilies: [],
    blockingReasons: ['最近窗口没有 document-like real_click 请求。'],
    requiredEvidence: ['收集 document-like source=real_click 请求。'],
    ...override,
  };

  return {
    version: 1,
    generatedAt: '2026-05-07T00:00:00.000Z',
    projectUid: 'proj_default',
    window: {
      days: 30,
      startedAt: '2026-04-07T00:00:00.000Z',
      endedAt: '2026-05-07T00:00:00.000Z',
    },
    summary: {
      eventCount: 0,
      terminalRunCount: 0,
      terminalPassCount: 0,
      terminalPassRate: null,
      realClickTerminalRunCount: 59,
      realClickTerminalPassCount: 49,
      realClickTerminalPassRate: 83.1,
      benchmarkRerunTerminalRunCount: 627,
      benchmarkRerunTerminalPassCount: 455,
      benchmarkRerunTerminalPassRate: 72.6,
      replayTerminalRunCount: 0,
      replayTerminalPassCount: 0,
      replayTerminalPassRate: null,
    },
    sampleReadiness: {
      readyForFamilySelection: true,
      blockingReasons: [],
      thresholds: {
        minRealClickLaunchClicks: 20,
        minRealClickAutoRunStarts: 10,
        minRealClickTerminalRuns: 10,
      },
      observed: {
        realClickLaunchClicks: 52,
        realClickDraftGenerated: 24,
        realClickLaunchGatePassed: 51,
        realClickAutoRunStarts: 51,
        realClickTerminalRuns: 59,
        realClickTerminalPasses: 49,
      },
    },
    documentFamilySelection: {
      mode: 'no_document_candidates',
      selectionSource: 'real_click_events',
      recommendedTopFamilies: [],
      historicalIntentDraftCount: 0,
      documentLikeHistoricalDraftCount: 0,
      notes: [],
      candidates: [],
    },
    nextPlanRecommendation: {
      status: 'collect_document_real_click',
      sourcePolicy: 'collect_more_real_click',
      candidateFamilies: [],
      realClickPriorityFamilyCandidates: [
        {
          family: 'business_batch_add_contacts_verify',
          launchClickCount: 39,
          autoRunStartedCount: 38,
          terminalRunCount: 46,
          terminalPassCount: 38,
          terminalPassRate: 82.6,
          withImageLaunchClickCount: 25,
          withoutImageLaunchClickCount: 14,
          governanceStatus: 'ready',
          releaseGuardStatus: 'passed',
          knowledgeHitStatus: 'passed',
          governanceEvidencePaths: [],
          selectionReason: 'source=real_click launch_click_count=39',
        },
      ],
      developmentGate: gate,
      recommendedAction: '当前没有 admissible code work。',
      denominatorPolicy: 'source=real_click only',
      blockingReasons: gate.blockingReasons,
      acceptanceCriteria: [],
      guardrails: [],
    },
  } as unknown as IntentE2ETrafficQualityReport;
}

function makeNewIntentReadinessReport(
  override: Partial<IntentE2ENewIntentReadinessReport['summary']> = {}
): IntentE2ENewIntentReadinessReport {
  const summary = {
    bySource: {
      real_click: 93,
      draft_import: 7,
    },
    byRecommendedMode: {
      direct_generate: 99,
      draft_only: 1,
    },
    byConfidence: {
      high: 99,
      medium: 1,
    },
    byLaunchDecision: {
      auto_run: 99,
      draft_only: 1,
    },
    byPriorityScenarioFamily: {},
    byDocumentFamily: {},
    fixtureBootstrapStrategies: {},
    missingContracts: {},
    failureRecoveryClasses: {},
    ...override,
  };

  return {
    version: 1,
    generatedAt: '2026-05-07T00:00:00.000Z',
    projectUid: 'proj_default',
    windowDays: 30,
    total: 100,
    summary,
    items: [],
    warnings: [],
  };
}

describe('intent e2e next development plan', () => {
  it('turns a no-work traffic-quality gate into a stop decision', () => {
    const plan = buildIntentE2ENextDevelopmentPlanReport({
      trafficQualityReport: makeTrafficQualityReport(),
      newIntentReadinessReport: makeNewIntentReadinessReport(),
      trafficQualityJsonPath: 'reports/traffic.json',
      trafficQualityMarkdownPath: 'reports/traffic.md',
      generatedAt: '2026-05-07T01:00:00.000Z',
    });

    expect(plan.developmentReady).toBe(false);
    expect(plan.gateStatus).toBe('no_admissible_code_work');
    expect(plan.decision).toBe('stop_no_admissible_code_work');
    expect(plan.commands.gateCheck).toBe(
      'npm run intent:next-dev:check -- --project-uid proj_default --window-days 30'
    );
    expect(plan.commands.newIntentReadiness).toBe(
      'npm run intent:new-intent:readiness -- --project-uid proj_default --window-days 30'
    );
    expect(plan.commands.fixtureBootstrap).toBe(
      'npm run intent:fixture-bootstrap -- --project-uid proj_default --window-days 30'
    );
    expect(plan.newIntentReadinessSnapshot).toMatchObject({
      total: 100,
      realClickTotal: 93,
      directGenerateCount: 99,
      needsFixtureCount: 0,
      realClickFixtureBootstrapCount: 0,
    });
    expect(plan.realClickPriorityFamilyCandidates[0]).toMatchObject({
      family: 'business_batch_add_contacts_verify',
      launchClickCount: 39,
      governanceStatus: 'ready',
    });
  });

  it('treats real-click new-intent fixture bootstrap candidates as actionable fixture work', () => {
    const readiness = makeNewIntentReadinessReport({
      bySource: {
        real_click: 1,
      },
      byRecommendedMode: {
        needs_fixture: 1,
      },
      fixtureBootstrapStrategies: {
        setup_cleanup: 1,
      },
      missingContracts: {
        fixture_contract: 1,
      },
    });
    readiness.total = 1;
    readiness.items = [
      {
        recommendedMode: 'needs_fixture',
        fixtureBootstrap: {
          strategy: 'setup_cleanup',
        },
        signals: {
          source: 'real_click',
          priorityScenarioFamily: 'modal_or_drawer_save',
          documentFamily: '',
        },
      },
    ] as any;

    const plan = buildIntentE2ENextDevelopmentPlanReport({
      trafficQualityReport: makeTrafficQualityReport(),
      newIntentReadinessReport: readiness,
      generatedAt: '2026-05-07T01:00:00.000Z',
    });

    expect(plan.developmentReady).toBe(true);
    expect(plan.decision).toBe('start_new_intent_fixture_contract');
    expect(plan.recommendedAction).toContain('先补 fixture contract');
    expect(plan.newIntentReadinessSnapshot).toMatchObject({
      needsFixtureCount: 1,
      fixtureBootstrapCount: 1,
      realClickFixtureBootstrapCount: 1,
      topFixtureFamilies: [{ family: 'modal_or_drawer_save', count: 1 }],
    });
    expect(plan.eligibleFamilies).toEqual([
      {
        family: 'modal_or_drawer_save',
        familyType: 'priority',
        reason: 'new_intent_real_click_fixtureBootstrap=1',
      },
    ]);
  });

  it('marks document governance as ready when the traffic-quality gate allows it', () => {
    const report = makeTrafficQualityReport({
      status: 'ready_for_document_family_governance',
      eligibleFamilies: [
        {
          family: 'doc_create_reopen_verify',
          familyType: 'document',
          reason: 'document-like source=real_click candidate is present',
        },
      ],
      blockingReasons: [],
      requiredEvidence: [],
    });
    report.documentFamilySelection = {
      ...report.documentFamilySelection,
      mode: 'post_instrumentation_real_click',
      recommendedTopFamilies: ['doc_create_reopen_verify'],
      candidates: [
        {
          family: 'doc_create_reopen_verify',
          signalCount: 2,
          realClickSignalCount: 2,
          historicalIntentDraftCount: 0,
          withImageCount: 1,
          withoutImageCount: 1,
          latestSeenAt: '2026-05-07T00:30:00.000Z',
          examples: [],
        },
      ],
    };

    const plan = buildIntentE2ENextDevelopmentPlanReport({ trafficQualityReport: report });

    expect(plan.developmentReady).toBe(true);
    expect(plan.decision).toBe('start_document_family_governance');
    expect(plan.eligibleFamilies).toEqual([
      expect.objectContaining({ family: 'doc_create_reopen_verify', familyType: 'document' }),
    ]);
    expect(plan.documentFamilyCandidates[0].reason).toContain('real_click_signals=2');
    expect(plan.documentFamilyCandidates[0].governanceStatus).toBe('contract_ready');
    expect(plan.documentFamilyCandidates[0].releaseGuardStatus).toBe('separate_guard_missing');
    expect(plan.commands.documentFamilyGovernance).toBe(
      'npm run intent:document-family:governance -- --project-uid proj_default --require-ready'
    );
    expect(plan.commands.documentFamilyReleaseGuard).toBe(
      'npm run intent:document-family:guard -- --project-uid proj_default --require-passed'
    );
    expect(plan.paths.documentFamilyGovernanceJson).toContain('intent-e2e.document-family-governance.latest.json');
    expect(plan.paths.documentFamilyReleaseGuardJson).toContain('intent-e2e.document-family-release-guard.latest.json');
  });

  it('shows the separate document family release guard status when provided', () => {
    const report = makeTrafficQualityReport({
      status: 'ready_for_document_family_governance',
      eligibleFamilies: [
        {
          family: 'doc_create_reopen_verify',
          familyType: 'document',
          reason: 'document-like source=real_click candidate is present',
        },
      ],
      blockingReasons: [],
      requiredEvidence: [],
    });
    report.documentFamilySelection = {
      ...report.documentFamilySelection,
      mode: 'post_instrumentation_real_click',
      recommendedTopFamilies: ['doc_create_reopen_verify'],
      candidates: [
        {
          family: 'doc_create_reopen_verify',
          signalCount: 2,
          realClickSignalCount: 2,
          historicalIntentDraftCount: 0,
          withImageCount: 0,
          withoutImageCount: 2,
          latestSeenAt: '2026-05-07T00:30:00.000Z',
          examples: [],
        },
      ],
    };

    const plan = buildIntentE2ENextDevelopmentPlanReport({
      trafficQualityReport: report,
      documentFamilyReleaseGuardReport: {
        baselines: [
          {
            family: 'doc_create_reopen_verify',
            status: 'passed',
          },
        ],
      } as any,
    });

    expect(plan.documentFamilyCandidates[0].releaseGuardStatus).toBe('passed');
    expect(plan.developmentReady).toBe(false);
    expect(plan.decision).toBe('collect_document_real_click');
    expect(plan.eligibleFamilies).toEqual([]);
    expect(plan.blockingReasons).toContain(
      'traffic-quality 仍只推荐已完成 contract_ready 且 document-family guard=passed 的 document family，当前没有新的未治理 document code work。'
    );
    expect(plan.recommendedAction).toContain('不要重复治理同一 family');
  });

  it('does not keep the gate ready because a lower-ranked document candidate is outside the current top-family guard', () => {
    const report = makeTrafficQualityReport({
      status: 'ready_for_document_family_governance',
      eligibleFamilies: [
        {
          family: 'doc_archive_restore_verify',
          familyType: 'document',
          reason: 'top document source=real_click candidate is present',
        },
        {
          family: 'doc_edit_save_verify',
          familyType: 'document',
          reason: 'top document source=real_click candidate is present',
        },
      ],
      blockingReasons: [],
      requiredEvidence: [],
    });
    report.documentFamilySelection = {
      ...report.documentFamilySelection,
      mode: 'post_instrumentation_real_click',
      recommendedTopFamilies: ['doc_archive_restore_verify', 'doc_edit_save_verify'],
      candidates: [
        {
          family: 'doc_archive_restore_verify',
          signalCount: 9,
          realClickSignalCount: 9,
          historicalIntentDraftCount: 0,
          withImageCount: 0,
          withoutImageCount: 9,
          latestSeenAt: '2026-05-09T02:49:00.000Z',
          examples: [],
        },
        {
          family: 'doc_edit_save_verify',
          signalCount: 6,
          realClickSignalCount: 6,
          historicalIntentDraftCount: 0,
          withImageCount: 0,
          withoutImageCount: 6,
          latestSeenAt: '2026-05-09T02:19:00.000Z',
          examples: [],
        },
        {
          family: 'doc_search_open_verify',
          signalCount: 3,
          realClickSignalCount: 3,
          historicalIntentDraftCount: 0,
          withImageCount: 0,
          withoutImageCount: 3,
          latestSeenAt: '2026-05-08T09:58:00.000Z',
          examples: [],
        },
      ],
    };

    const plan = buildIntentE2ENextDevelopmentPlanReport({
      trafficQualityReport: report,
      documentFamilyReleaseGuardReport: {
        baselines: [
          { family: 'doc_archive_restore_verify', status: 'passed' },
          { family: 'doc_edit_save_verify', status: 'passed' },
        ],
      } as any,
    });

    expect(plan.documentFamilyCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ family: 'doc_search_open_verify', releaseGuardStatus: 'separate_guard_missing' }),
      ])
    );
    expect(plan.developmentReady).toBe(false);
    expect(plan.decision).toBe('collect_document_real_click');
    expect(plan.eligibleFamilies).toEqual([]);
    expect(plan.blockingReasons).toContain(
      'traffic-quality 仍只推荐已完成 contract_ready 且 document-family guard=passed 的 document family，当前没有新的未治理 document code work。'
    );
  });

  it('renders markdown with gate, candidate, command, and stop condition sections', () => {
    const plan = buildIntentE2ENextDevelopmentPlanReport({
      trafficQualityReport: makeTrafficQualityReport(),
      newIntentReadinessReport: makeNewIntentReadinessReport(),
      generatedAt: '2026-05-07T01:00:00.000Z',
    });
    const markdown = renderIntentE2ENextDevelopmentPlanMarkdown(plan);

    expect(markdown).toContain('# Intent E2E Next Development Plan');
    expect(markdown).toContain('gateStatus: no_admissible_code_work');
    expect(markdown).toContain('## Real Click Priority Candidates');
    expect(markdown).toContain('business_batch_add_contacts_verify');
    expect(markdown).toContain('npm run intent:next-dev:check');
    expect(markdown).toContain('## New Intent Readiness Snapshot');
    expect(markdown).toContain('real_click_fixtureBootstrap: 0');
    expect(markdown).toContain('npm run intent:new-intent:readiness');
    expect(markdown).toContain('npm run intent:fixture-bootstrap');
    expect(markdown).toContain('npm run intent:document-family:governance');
    expect(markdown).toContain('npm run intent:document-family:guard');
    expect(markdown).toContain('## Stop Conditions');
  });
});
