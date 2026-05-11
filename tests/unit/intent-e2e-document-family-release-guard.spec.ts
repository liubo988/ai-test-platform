import { describe, expect, it } from 'vitest';
import {
  buildIntentE2EDocumentFamilyReleaseGuardReport,
  renderIntentE2EDocumentFamilyReleaseGuardMarkdown,
} from '@/lib/intent-e2e-document-family-release-guard';
import { buildIntentE2EDocumentFamilyGovernanceReport } from '@/lib/intent-e2e-document-family-governance';
import type { IntentE2EDocumentRealClickSeedReport } from '@/lib/intent-e2e-document-real-click-seed';
import type { IntentE2ETrafficQualityReport } from '@/lib/intent-e2e-traffic-quality';

function makeTrafficReport(
  override: Partial<IntentE2ETrafficQualityReport['documentFamilySelection']> = {}
): IntentE2ETrafficQualityReport {
  return {
    projectUid: 'proj_default',
    documentFamilySelection: {
      mode: 'post_instrumentation_real_click',
      selectionSource: 'real_click_events',
      recommendedTopFamilies: ['doc_create_reopen_verify'],
      historicalIntentDraftCount: 0,
      documentLikeHistoricalDraftCount: 0,
      notes: [],
      candidates: [
        {
          family: 'doc_create_reopen_verify',
          signalCount: 3,
          realClickSignalCount: 3,
          historicalIntentDraftCount: 0,
          withImageCount: 0,
          withoutImageCount: 3,
          latestSeenAt: '2026-05-08T08:00:00.000Z',
          examples: [],
        },
      ],
      ...override,
    },
  } as unknown as IntentE2ETrafficQualityReport;
}

function makeSeedReport(status = 'passed', runId = 'intent-run-doc-1'): IntentE2EDocumentRealClickSeedReport {
  return {
    version: 1,
    generatedAt: '2026-05-08T08:01:00.000Z',
    projectUid: 'proj_default',
    sourcePolicy: 'launch_decision_runs_without_intent_draft_uid',
    denominatorPolicy: 'source=real_click',
    dryRun: false,
    summary: {
      sampleCount: 1,
      admissibleDocumentSamples: 1,
      referenceOnlyBusinessFlowSamples: 0,
      autoRunStarted: 1,
      terminalRuns: 1,
      passedRuns: status === 'passed' ? 1 : 0,
      failedRuns: status === 'failed' ? 1 : 0,
      blockedRuns: 0,
      timedOutRuns: 0,
    },
    results: [
      {
        sampleId: 'project-knowledge-document-import-preview',
        name: '项目知识文档导入后预览验收',
        moduleUid: 'mod_1773303139537_c84d8476',
        targetUrl: 'http://127.0.0.1:3666/projects/proj_default?intentView=knowledge',
        input: '导入知识文档后校验当前预览和文档块正文锚点',
        provenance: 'document_surface_current_system',
        expectedPriorityScenarioFamily: 'untracked',
        documentFamily: 'doc_create_reopen_verify',
        admissibility: 'document_family_admissible',
        notes: [],
        launchDecision: 'auto_run',
        launchReason: 'launch_ready',
        runId,
        status,
        errorMessage: '',
        timedOut: false,
        matchedRuleIds: [],
        matchedRecipeSlugs: ['document.project-knowledge-import-preview'],
      },
    ],
  };
}

describe('intent e2e document family release guard', () => {
  it('passes doc_create_reopen_verify when real-click traffic, governance, and seed evidence are present', () => {
    const report = buildIntentE2EDocumentFamilyReleaseGuardReport({
      projectUid: 'proj_default',
      trafficQualityReport: makeTrafficReport(),
      governanceReport: buildIntentE2EDocumentFamilyGovernanceReport({
        projectUid: 'proj_default',
        candidateFamilies: ['doc_create_reopen_verify'],
        generatedAt: '2026-05-08T08:00:00.000Z',
      }),
      seedReports: [
        makeSeedReport('passed', 'intent-run-doc-1'),
        makeSeedReport('passed', 'intent-run-doc-2'),
        makeSeedReport('passed', 'intent-run-doc-3'),
      ],
      generatedAt: '2026-05-08T08:02:00.000Z',
    });

    expect(report.passed).toBe(true);
    expect(report.summary).toMatchObject({
      baselineCount: 1,
      passedBaselines: 1,
      totalRealClickSignals: 3,
      totalAdmissiblePassedRuns: 3,
    });
    expect(report.baselines[0]).toMatchObject({
      family: 'doc_create_reopen_verify',
      status: 'passed',
      governanceStatus: 'contract_ready',
      fixtureId: 'project-knowledge-document-import-preview-v1',
      recipeSlugs: ['document.project-knowledge-import-preview'],
    });
    expect(report.baselines[0].thresholds).toMatchObject({
      minRealClickSignals: 3,
      minAdmissiblePassedRuns: 3,
    });
    expect(report.baselines[0].requiredEvidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining('knowledge_import_notice'),
        expect.stringContaining('current_preview_document_name'),
        expect.stringContaining('document_chunk_body_anchor'),
      ])
    );
  });

  it('fails when traffic-quality is not using post-instrumentation real-click selection', () => {
    const report = buildIntentE2EDocumentFamilyReleaseGuardReport({
      projectUid: 'proj_default',
      trafficQualityReport: makeTrafficReport({
        mode: 'historical_intent_drafts_fallback',
        selectionSource: 'historical_intent_drafts',
      }),
      seedReports: [makeSeedReport()],
    });

    expect(report.passed).toBe(false);
    expect(report.baselines[0].failures.map((failure) => failure.failureMode)).toContain(
      'traffic_selection_not_real_click'
    );
  });

  it('fails when admissible document seed passes are missing', () => {
    const report = buildIntentE2EDocumentFamilyReleaseGuardReport({
      projectUid: 'proj_default',
      trafficQualityReport: makeTrafficReport(),
      seedReports: [makeSeedReport('failed', 'intent-run-doc-failed')],
    });

    expect(report.passed).toBe(false);
    expect(report.baselines[0].failures.map((failure) => failure.failureMode)).toContain(
      'insufficient_admissible_passed_runs'
    );
  });

  it('renders markdown with source policy, fixture, and failures', () => {
    const report = buildIntentE2EDocumentFamilyReleaseGuardReport({
      projectUid: 'proj_default',
      trafficQualityReport: makeTrafficReport(),
      seedReports: [],
      generatedAt: '2026-05-08T08:02:00.000Z',
    });
    const markdown = renderIntentE2EDocumentFamilyReleaseGuardMarkdown(report);

    expect(markdown).toContain('# Intent E2E Document Family Release Guard');
    expect(markdown).toContain('post_instrumentation_real_click_only');
    expect(markdown).toContain('project-knowledge-document-import-preview-v1');
    expect(markdown).toContain('insufficient_admissible_passed_runs');
    expect(markdown).toContain('## Stop Conditions');
  });
});
