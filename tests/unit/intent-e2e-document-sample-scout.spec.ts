import { describe, expect, it } from 'vitest';
import { buildIntentE2EDocumentSampleScoutReport } from '@/lib/intent-e2e-document-sample-scout';
import type { IntentE2ETrafficQualityEvent } from '@/lib/intent-e2e-traffic-quality';
import type { IntentE2EFormalTaskSeedAuditReport } from '@/lib/intent-e2e-formal-task-seed-audit';

const NOW = new Date('2026-05-07T10:00:00.000Z');

function event(overrides: Partial<IntentE2ETrafficQualityEvent>): IntentE2ETrafficQualityEvent {
  return {
    version: 1,
    eventId: 'evt_default',
    occurredAt: '2026-05-07T09:00:00.000Z',
    counter: 'launch_click_count',
    source: 'real_click',
    attachment: 'without_image',
    launchDecision: 'auto_run',
    priorityScenarioFamily: 'untracked',
    projectUid: 'proj_default',
    moduleUid: 'mod_1',
    runId: '',
    intentDraftUid: '',
    requestFingerprint: 'fp',
    metadata: {
      input: '打开企业微信文档并导出为 PDF',
      targetUrl: 'https://docs.qq.com/doc/test',
    },
    ...overrides,
  };
}

function formalAudit(
  overrides: Partial<IntentE2EFormalTaskSeedAuditReport> = {}
): IntentE2EFormalTaskSeedAuditReport {
  return {
    version: 1,
    generatedAt: '2026-05-07T09:00:00.000Z',
    projectUid: 'proj_default',
    sourcePolicy: 'formal_task_seed_only',
    denominatorPolicy: 'formal task executions are seed only',
    allowedHosts: ['uat-service.yikaiye.com'],
    summary: {
      formalTaskCount: 1,
      currentSystemTaskCount: 1,
      tasksWithPassedExecutionCount: 1,
      latestPassedTaskCount: 1,
      seedEligibleCount: 1,
      documentLikeSeedEligibleCount: 1,
      outOfScopeTaskCount: 0,
    },
    candidates: [],
    documentLikeCandidates: [
      {
        configUid: 'cfg_doc',
        moduleUid: 'mod_doc',
        name: '导出文档',
        moduleName: '文档',
        targetUrl: 'https://docs.qq.com/doc/test',
        taskMode: 'page',
        featureDescription: '打开文档并导出',
        currentSystem: true,
        hasPassedExecution: true,
        latestExecutionPassed: true,
        latestExecutionUid: 'exec_1',
        latestExecutionStatus: 'passed',
        passedExecutionCount: 1,
        failedExecutionCount: 0,
        priorityScenarioFamily: 'untracked',
        documentFamily: 'doc_export_verify',
        sourceIntentDraftUid: '',
        sourceIntentDraftTitle: '',
        seedEligible: true,
        seedBlockedReasons: [],
      },
    ],
    recommendedSeedCandidates: [],
    notes: [],
    ...overrides,
  };
}

describe('buildIntentE2EDocumentSampleScoutReport', () => {
  it('finds document-like real_click launch events across configured windows', () => {
    const report = buildIntentE2EDocumentSampleScoutReport({
      projectUid: 'proj_default',
      now: NOW,
      windowDaysList: [30, 90],
      events: [
        event({ eventId: 'evt_recent_doc' }),
        event({
          eventId: 'evt_old_doc',
          occurredAt: '2026-03-20T09:00:00.000Z',
          metadata: {
            input: '打开企业微信文档并导出',
            targetUrl: 'https://docs.qq.com/doc/old',
          },
        }),
        event({
          eventId: 'evt_benchmark_doc',
          source: 'benchmark_rerun',
          metadata: {
            input: '打开企业微信文档并导出',
            targetUrl: 'https://docs.qq.com/doc/benchmark',
          },
        }),
      ],
    });

    expect(report.windows).toHaveLength(2);
    expect(report.windows[0]?.days).toBe(30);
    expect(report.windows[0]?.documentLikeRealClickLaunchClickCount).toBe(1);
    expect(report.windows[1]?.days).toBe(90);
    expect(report.windows[1]?.documentLikeRealClickLaunchClickCount).toBe(2);
    expect(report.windows[1]?.documentFamilies[0]?.family).toBe('doc_export_verify');
    expect(report.recommendation.status).toBe('ready_with_document_real_click');
  });

  it('recommends formal task seeding when only document-like formal seeds exist', () => {
    const report = buildIntentE2EDocumentSampleScoutReport({
      projectUid: 'proj_default',
      now: NOW,
      windowDaysList: [30],
      events: [
        event({
          eventId: 'evt_business',
          metadata: {
            input: '在商机列表新建商机',
            targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
          },
          priorityScenarioFamily: 'business_create_list_verify',
        }),
      ],
      formalTaskSeedAudit: formalAudit(),
    });

    expect(report.windows[0]?.documentLikeRealClickLaunchClickCount).toBe(0);
    expect(report.formalTaskSeeds.documentLikeSeedEligibleCount).toBe(1);
    expect(report.formalTaskSeeds.documentFamilies[0]?.family).toBe('doc_export_verify');
    expect(report.recommendation.status).toBe('seed_document_formal_tasks');
  });

  it('recommends collecting document real_click when no document signals exist', () => {
    const report = buildIntentE2EDocumentSampleScoutReport({
      projectUid: 'proj_default',
      now: NOW,
      windowDaysList: [30],
      events: [
        event({
          eventId: 'evt_business',
          metadata: {
            input: '在商机列表新建商机',
            targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
          },
          priorityScenarioFamily: 'business_create_list_verify',
        }),
      ],
      formalTaskSeedAudit: formalAudit({
        summary: {
          formalTaskCount: 1,
          currentSystemTaskCount: 1,
          tasksWithPassedExecutionCount: 1,
          latestPassedTaskCount: 1,
          seedEligibleCount: 1,
          documentLikeSeedEligibleCount: 0,
          outOfScopeTaskCount: 0,
        },
        documentLikeCandidates: [],
      }),
    });

    expect(report.windows[0]?.topRealClickFamilies[0]?.family).toBe('business_create_list_verify');
    expect(report.recommendation.status).toBe('collect_document_real_click');
    expect(report.recommendation.blockingReasons).toContain(
      'No document-like source=real_click launch event was found in the scanned windows.'
    );
  });
});
