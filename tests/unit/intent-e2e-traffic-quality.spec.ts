import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildIntentE2ETrafficQualityReport,
  recordIntentE2ETrafficQualityCounter,
  renderIntentE2ETrafficQualityMarkdown,
  type IntentE2ETrafficQualityEvent,
} from '@/lib/intent-e2e-traffic-quality';
import type { IntentE2ERunSnapshotRecord, ProjectIntentDraftSummaryRecord } from '@/lib/db/repository';

function writeJson(filePath: string, value: unknown): string {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
  return filePath;
}

function makeSnapshot(input: {
  runId: string;
  status: 'passed' | 'failed' | 'canceled';
  endedAt: string;
  request?: Record<string, unknown>;
  taskPlatform?: Record<string, unknown>;
}): IntentE2ERunSnapshotRecord {
  return {
    runId: input.runId,
    projectUid: 'proj_traffic',
    moduleUid: 'mod_traffic',
    status: input.status,
    stage: 'completed',
    requestInput: '登录后创建商机并回列表校验状态',
    targetUrl: 'https://example.test/#/business/list',
    state: {
      runId: input.runId,
      status: input.status,
      request: {
        input: '登录后创建商机并回列表校验状态',
        targetUrl: 'https://example.test/#/business/list',
        attachmentCount: 0,
        ...(input.request || {}),
      },
      taskPlatform: {
        replayOfRunId: '',
        ...(input.taskPlatform || {}),
      },
      result: {
        description: '登录后创建商机并回列表校验状态',
        scenarioCard: {
          title: '创建商机并回列表校验',
          featureDescription: '登录后创建商机并回列表校验状态',
          targetUrl: 'https://example.test/#/business/list',
          flowDefinition: {
            steps: [
              {
                title: '创建商机',
                instruction: '创建商机并回列表校验状态',
                expectedResult: '列表状态正确',
              },
            ],
          },
        },
      },
    },
    error: '',
    createdAt: '2026-04-29T09:50:00.000Z',
    updatedAt: input.endedAt,
    startedAt: '2026-04-29T09:50:05.000Z',
    endedAt: input.endedAt,
  };
}

function makeHistoricalIntentDraft(input: {
  intentDraftUid: string;
  input: string;
  targetUrl: string;
  updatedAt: string;
  attachmentCount?: number;
  status?: 'active' | 'imported' | 'archived';
}): ProjectIntentDraftSummaryRecord {
  return {
    intentDraftUid: input.intentDraftUid,
    projectUid: 'proj_traffic',
    moduleUid: 'mod_traffic',
    moduleName: '文档协作',
    title: input.input,
    input: input.input,
    targetUrlHint: input.targetUrl,
    taskMode: 'scenario',
    targetUrl: input.targetUrl,
    featureDescription: input.input,
    flowStepCount: 3,
    attachmentCount: input.attachmentCount || 0,
    planReady: true,
    planError: '',
    status: input.status || 'imported',
    importedConfigUid: '',
    importedPlanUid: '',
    importedAt: '',
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
  };
}

describe('intent e2e traffic quality', () => {
  it('keeps real clicks, benchmark reruns, and replay buckets separated', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-traffic-quality-'));
    try {
      const eventLogPath = path.join(tempDir, 'traffic.jsonl');
      const corpusPath = writeJson(path.join(tempDir, 'request-corpus.json'), {
        version: 1,
        projectUid: 'proj_traffic',
        moduleUid: 'mod_traffic',
        testType: 'browser_e2e',
        priorityScenarioFamily: 'list_search_detail',
        requests: [
          {
            requestId: 'bench_request_1',
            input: '登录后搜索订单并进入详情校验字段',
            targetUrl: 'https://example.test/#/order/list',
            attachments: [{ name: 'screen.png', dataUrl: 'data:image/png;base64,aaa' }],
          },
        ],
      });
      const benchmarkReportPath = writeJson(path.join(tempDir, 'benchmark-rerun.json'), {
        version: 1,
        generatedAt: '2026-04-29T10:05:00.000Z',
        requestCorpusPath: corpusPath,
        scope: {
          projectUid: 'proj_traffic',
          moduleUid: 'mod_traffic',
          priorityScenarioFamily: 'list_search_detail',
        },
        summary: {
          requestCount: 1,
          terminalCount: 1,
          passedRuns: 1,
        },
        runs: [
          {
            requestId: 'bench_request_1',
            runId: 'intent-run-benchmark',
            status: 'passed',
            terminal: true,
            finishedAt: '2026-04-29T10:04:00.000Z',
            priorityScenarioFamily: 'list_search_detail',
          },
        ],
      });
      const recordedEvent = await recordIntentE2ETrafficQualityCounter(
        {
          counter: 'launch_click_count',
          projectUid: 'proj_traffic',
          moduleUid: 'mod_traffic',
          source: 'real_click',
          attachment: 'without_image',
          launchDecision: 'auto_run',
          priorityScenarioFamily: 'business_create_list_verify',
          occurredAt: '2026-04-29T10:00:00.000Z',
          metadata: {
            input: '登录后创建商机并回列表校验状态',
            targetUrl: 'https://example.test/#/business/list',
          },
        },
        { eventLogPath }
      );

      const snapshots = [
        makeSnapshot({
          runId: 'intent-run-real',
          status: 'passed',
          endedAt: '2026-04-29T10:02:00.000Z',
        }),
        makeSnapshot({
          runId: 'intent-run-replay',
          status: 'failed',
          endedAt: '2026-04-29T10:03:00.000Z',
          taskPlatform: {
            replayOfRunId: 'intent-run-real',
          },
          request: {
            runControl: {
              replayOfRunId: 'intent-run-real',
            },
          },
        }),
        makeSnapshot({
          runId: 'intent-run-benchmark',
          status: 'passed',
          endedAt: '2026-04-29T10:04:00.000Z',
        }),
        makeSnapshot({
          runId: 'intent-run-draft-image',
          status: 'passed',
          endedAt: '2026-04-29T10:06:00.000Z',
          request: {
            intentDraftUid: 'idraft_image_1',
            attachmentCount: 1,
            prefilledScenarioLlmMeta: {
              attachmentOcrUsed: true,
              attachmentOcrVisualAnchorCount: 2,
              attachmentOcrTextSnippetCount: 1,
            },
          },
        }),
      ];

      const report = await buildIntentE2ETrafficQualityReport({
        projectUid: 'proj_traffic',
        generatedAt: '2026-04-29T10:10:00.000Z',
        windowDays: 1,
        eventLogPaths: [eventLogPath],
        benchmarkReportPaths: [benchmarkReportPath],
        terminalSnapshots: snapshots,
        historicalIntentDrafts: [],
      });

      expect(recordedEvent).toMatchObject({
        counter: 'launch_click_count',
        source: 'real_click',
      } satisfies Partial<IntentE2ETrafficQualityEvent>);
      expect(report.summary.realClickTerminalRunCount).toBe(1);
      expect(report.summary.realClickTerminalPassCount).toBe(1);
      expect(report.summary.benchmarkRerunTerminalRunCount).toBe(1);
      expect(report.summary.benchmarkRerunTerminalPassCount).toBe(1);
      expect(report.summary.replayTerminalRunCount).toBe(1);
      expect(report.summary.replayTerminalPassCount).toBe(0);
      expect(report.imageRouteMetrics).toMatchObject({
        allWithImageTerminalRuns: 2,
        allWithImageTerminalPasses: 2,
        allWithImageTerminalPassRate: 100,
        draftImportWithImageTerminalRuns: 1,
        draftImportWithImageTerminalPasses: 1,
        draftImportWithImageTerminalPassRate: 100,
      });
      expect(report.ocrMetrics).toMatchObject({
        terminalWithImageRunCount: 1,
        terminalOcrAnchorObservedRunCount: 1,
        terminalOcrAnchorObservedPassCount: 1,
        terminalOcrAnchorObservedPassRate: 100,
      });
      expect(report.sampleReadiness.readyForFamilySelection).toBe(false);
      expect(report.sampleReadiness.observed.realClickLaunchClicks).toBe(1);
      expect(report.sampleReadiness.observed.realClickTerminalRuns).toBe(1);
      expect(report.excludedBenchmarkRunIds).toEqual(['intent-run-benchmark']);
      expect(report.sourceSummaries.real_click.counters.launch_click_count).toBe(1);
      expect(
        report.buckets.find(
          (bucket) =>
            bucket.source === 'benchmark_rerun' &&
            bucket.attachment === 'with_image' &&
            bucket.launchDecision === 'auto_run' &&
            bucket.priorityScenarioFamily === 'list_search_detail'
        )
      ).toMatchObject({
        counters: expect.objectContaining({
          auto_run_started_count: 1,
          terminal_run_count: 1,
          terminal_pass_count: 1,
        }),
      });
      expect(report.documentFamilySelection.mode).toBe('insufficient_evidence');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('backfills untracked real_click event families from current request routing during reporting', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-traffic-quality-family-backfill-'));
    try {
      const eventLogPath = path.join(tempDir, 'traffic.jsonl');
      const requestInput =
        '参考《管帮手PC端操作手册》，进入商机列表随机勾选一条带手机号的商机，点击“批量加入通讯录”，再到我的通讯录按该手机号搜索确认联系人可见；如果当前结果为空，先切到有数量的商机进展阶段。';
      const base = {
        projectUid: 'proj_traffic',
        moduleUid: 'mod_traffic',
        source: 'real_click' as const,
        attachment: 'with_image' as const,
        launchDecision: 'auto_run' as const,
        priorityScenarioFamily: 'untracked' as const,
        metadata: {
          input: requestInput,
          targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
        },
      };

      await recordIntentE2ETrafficQualityCounter(
        {
          ...base,
          counter: 'launch_click_count',
          occurredAt: '2026-04-29T10:00:00.000Z',
        },
        { eventLogPath }
      );
      await recordIntentE2ETrafficQualityCounter(
        {
          ...base,
          counter: 'launch_gate_passed_count',
          occurredAt: '2026-04-29T10:00:30.000Z',
        },
        { eventLogPath }
      );
      await recordIntentE2ETrafficQualityCounter(
        {
          ...base,
          counter: 'auto_run_started_count',
          runId: 'intent-run-batch-contacts',
          occurredAt: '2026-04-29T10:01:00.000Z',
        },
        { eventLogPath }
      );
      await recordIntentE2ETrafficQualityCounter(
        {
          counter: 'draft_generated_count',
          projectUid: 'proj_traffic',
          moduleUid: 'mod_traffic',
          source: 'real_click',
          attachment: 'with_image',
          launchDecision: 'draft_only',
          priorityScenarioFamily: 'untracked',
          intentDraftUid: 'idraft_batch_contacts',
          occurredAt: '2026-04-29T10:02:00.000Z',
          metadata: {
            input: requestInput,
            targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
            scenarioCard: {
              notes: ['附件文字锚点：批量加入通讯录 / 手机号搜索'],
            },
            scenarioLlmMeta: {
              visionEnabled: true,
              attachmentCount: 1,
              attachmentOcrAttempted: true,
              attachmentOcrUsed: true,
              attachmentOcrVisualAnchorCount: 2,
              attachmentOcrTextSnippetCount: 1,
            },
            ocrAttempted: true,
            ocrUsed: true,
            ocrAnchorObserved: true,
          },
        },
        { eventLogPath }
      );

      const report = await buildIntentE2ETrafficQualityReport({
        projectUid: 'proj_traffic',
        generatedAt: '2026-04-29T10:10:00.000Z',
        windowDays: 1,
        eventLogPaths: [eventLogPath],
        benchmarkReportPaths: [],
        terminalSnapshots: [],
        historicalIntentDrafts: [],
      });

      expect(
        report.buckets.find(
          (bucket) =>
            bucket.source === 'real_click' &&
            bucket.attachment === 'with_image' &&
            bucket.launchDecision === 'auto_run' &&
            bucket.priorityScenarioFamily === 'business_batch_add_contacts_verify'
        )
      ).toMatchObject({
        counters: expect.objectContaining({
          launch_click_count: 1,
          launch_gate_passed_count: 1,
          auto_run_started_count: 1,
        }),
      });
      expect(
        report.buckets.find(
          (bucket) =>
            bucket.source === 'real_click' &&
            bucket.launchDecision === 'auto_run' &&
            bucket.priorityScenarioFamily === 'untracked'
        )
      ).toBeUndefined();
      expect(report.imageRouteMetrics).toMatchObject({
        realClickWithImageLaunchClicks: 1,
        realClickWithImageTrackedFamilyLaunchClicks: 1,
        realClickWithImageUntrackedLaunchClicks: 0,
        realClickWithImageLaunchGatePassed: 1,
        realClickWithImageAutoRunStarted: 1,
        imageRouteHitRate: 100,
        imageLaunchGatePassRate: 100,
      });
      expect(report.ocrMetrics).toMatchObject({
        draftGeneratedWithImageCount: 1,
        draftGeneratedOcrAttemptedCount: 1,
        draftGeneratedOcrUsedCount: 1,
        draftGeneratedOcrUsedRate: 100,
        draftGeneratedOcrRoutedToTrackedFamilyCount: 1,
        draftGeneratedOcrRouteHitRate: 100,
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('falls back to historical document-like intent drafts when real_click readiness is not met', async () => {
    const report = await buildIntentE2ETrafficQualityReport({
      projectUid: 'proj_traffic',
      generatedAt: '2026-04-29T10:10:00.000Z',
      windowDays: 30,
      eventLogPaths: [],
      benchmarkReportPaths: [],
      terminalSnapshots: [],
      historicalIntentDrafts: [
        makeHistoricalIntentDraft({
          intentDraftUid: 'idraft_doc_1',
          input: '登录企业微信文档后创建一份新文档，重新打开后校验标题和正文仍存在',
          targetUrl: 'https://docs.qq.com/doc/new',
          updatedAt: '2026-04-29T09:50:00.000Z',
        }),
        makeHistoricalIntentDraft({
          intentDraftUid: 'idraft_doc_2',
          input: '打开智能表格后编辑一行内容并保存，确认重新进入后值已更新',
          targetUrl: 'https://docs.qq.com/smartsheet/edit',
          updatedAt: '2026-04-29T09:40:00.000Z',
          attachmentCount: 1,
        }),
        makeHistoricalIntentDraft({
          intentDraftUid: 'idraft_other',
          input: '登录后台后创建一个商机并回列表验证状态',
          targetUrl: 'https://example.test/#/business/list',
          updatedAt: '2026-04-29T09:30:00.000Z',
        }),
      ],
    });

    expect(report.sampleReadiness.readyForFamilySelection).toBe(false);
    expect(report.sampleReadiness.blockingReasons).toEqual(
      expect.arrayContaining([
        'real_click launch_click_count 0 < 20',
        'real_click auto_run_started_count 0 < 10',
        'real_click terminal_run_count 0 < 10',
      ])
    );
    expect(report.documentFamilySelection.mode).toBe('historical_intent_drafts_fallback');
    expect(report.documentFamilySelection.selectionSource).toBe('historical_intent_drafts');
    expect(report.documentFamilySelection.historicalIntentDraftCount).toBe(3);
    expect(report.documentFamilySelection.documentLikeHistoricalDraftCount).toBe(2);
    expect(report.documentFamilySelection.recommendedTopFamilies).toEqual([
      'doc_create_reopen_verify',
      'doc_edit_save_verify',
    ]);
    expect(report.documentFamilySelection.candidates[0]).toMatchObject({
      family: 'doc_create_reopen_verify',
      historicalIntentDraftCount: 1,
    });
    expect(report.documentFamilySelection.candidates[1]).toMatchObject({
      family: 'doc_edit_save_verify',
      withImageCount: 1,
    });
  });

  it('uses post-instrumentation real_click launch samples for document candidate selection once readiness thresholds are met', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-traffic-quality-ready-'));
    try {
      const eventLogPath = path.join(tempDir, 'traffic.jsonl');
      await recordIntentE2ETrafficQualityCounter(
        {
          counter: 'launch_click_count',
          projectUid: 'proj_traffic',
          moduleUid: 'mod_traffic',
          source: 'real_click',
          attachment: 'without_image',
          launchDecision: 'auto_run',
          priorityScenarioFamily: 'untracked',
          occurredAt: '2026-04-29T10:00:00.000Z',
          metadata: {
            input: '打开企业微信文档并分享给同事，校验对方拥有查看权限',
            targetUrl: 'https://docs.qq.com/doc/share',
          },
        },
        { eventLogPath }
      );
      await recordIntentE2ETrafficQualityCounter(
        {
          counter: 'launch_click_count',
          projectUid: 'proj_traffic',
          moduleUid: 'mod_traffic',
          source: 'real_click',
          attachment: 'with_image',
          launchDecision: 'auto_run',
          priorityScenarioFamily: 'untracked',
          occurredAt: '2026-04-29T10:01:00.000Z',
          metadata: {
            input: '在企业微信文档里导出当前文档并校验下载文件成功',
            targetUrl: 'https://docs.qq.com/doc/export',
          },
        },
        { eventLogPath }
      );
      await recordIntentE2ETrafficQualityCounter(
        {
          counter: 'auto_run_started_count',
          projectUid: 'proj_traffic',
          moduleUid: 'mod_traffic',
          source: 'real_click',
          attachment: 'without_image',
          launchDecision: 'auto_run',
          priorityScenarioFamily: 'untracked',
          runId: 'intent-run-real-doc',
          occurredAt: '2026-04-29T10:01:30.000Z',
          metadata: {
            input: '打开企业微信文档并分享给同事，校验对方拥有查看权限',
            targetUrl: 'https://docs.qq.com/doc/share',
          },
        },
        { eventLogPath }
      );

      const report = await buildIntentE2ETrafficQualityReport({
        projectUid: 'proj_traffic',
        generatedAt: '2026-04-29T10:10:00.000Z',
        windowDays: 1,
        eventLogPaths: [eventLogPath],
        benchmarkReportPaths: [],
        terminalSnapshots: [
          makeSnapshot({
            runId: 'intent-run-real-doc',
            status: 'passed',
            endedAt: '2026-04-29T10:05:00.000Z',
            request: {
              input: '打开企业微信文档并分享给同事，校验对方拥有查看权限',
              targetUrl: 'https://docs.qq.com/doc/share',
              attachmentCount: 0,
            },
          }),
        ],
        historicalIntentDrafts: [
          makeHistoricalIntentDraft({
            intentDraftUid: 'idraft_doc_old',
            input: '登录企业微信文档后创建一份新文档并重新打开校验标题',
            targetUrl: 'https://docs.qq.com/doc/new',
            updatedAt: '2026-04-29T09:20:00.000Z',
          }),
        ],
        minRealClickLaunchClicks: 2,
        minRealClickAutoRunStarts: 1,
        minRealClickTerminalRuns: 1,
      });

      expect(report.sampleReadiness.readyForFamilySelection).toBe(true);
      expect(report.documentFamilySelection.mode).toBe('post_instrumentation_real_click');
      expect(report.documentFamilySelection.selectionSource).toBe('real_click_events');
      expect(report.documentFamilySelection.recommendedTopFamilies).toEqual([
        'doc_export_verify',
        'doc_share_permission_verify',
      ]);
      expect(report.documentFamilySelection.candidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            family: 'doc_export_verify',
            realClickSignalCount: 1,
            withImageCount: 1,
          }),
          expect.objectContaining({
            family: 'doc_share_permission_verify',
            realClickSignalCount: 1,
            withoutImageCount: 1,
          }),
        ])
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('renders a markdown report with source and bucket tables', async () => {
    const report = await buildIntentE2ETrafficQualityReport({
      projectUid: 'proj_traffic',
      generatedAt: '2026-04-29T10:10:00.000Z',
      windowDays: 1,
      eventLogPaths: [],
      benchmarkReportPaths: [],
      terminalSnapshots: [
        makeSnapshot({
          runId: 'intent-run-real',
          status: 'passed',
          endedAt: '2026-04-29T10:02:00.000Z',
        }),
      ],
      historicalIntentDrafts: [],
    });
    const markdown = renderIntentE2ETrafficQualityMarkdown(report);

    expect(markdown).toContain('# Intent E2E Traffic Quality Report');
    expect(markdown).toContain('## Sample Readiness');
    expect(markdown).toContain('## Image Route Metrics');
    expect(markdown).toContain('imageRouteHitRate');
    expect(markdown).toContain('## OCR Metrics');
    expect(markdown).toContain('draft_generated.ocr_used_rate');
    expect(markdown).toContain('## Document Family Selection');
    expect(markdown).toContain('real_click');
    expect(markdown).toContain('source | attachment | launchDecision | priorityScenarioFamily');
  });
});
