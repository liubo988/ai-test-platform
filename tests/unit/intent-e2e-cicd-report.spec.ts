import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/repository', () => ({
  listIntentE2ERunSnapshots: vi.fn(),
  listProjectActivityLogs: vi.fn(),
}));

vi.mock('@/lib/intent-project-knowledge', async () => {
  const actual = await vi.importActual<typeof import('@/lib/intent-project-knowledge')>('@/lib/intent-project-knowledge');
  return {
    ...actual,
    listIntentProjectKnowledgeAuditEntries: vi.fn(),
  };
});

vi.mock('@/lib/intent-e2e-benchmark', async () => {
  const actual = await vi.importActual<typeof import('@/lib/intent-e2e-benchmark')>('@/lib/intent-e2e-benchmark');
  return {
    ...actual,
    readIntentE2EBenchmark: vi.fn(),
  };
});

import { listIntentE2ERunSnapshots, listProjectActivityLogs, type IntentE2ERunSnapshotRecord } from '@/lib/db/repository';
import { readIntentE2EBenchmark, buildIntentE2EBenchmarkSuiteFromData } from '@/lib/intent-e2e-benchmark';
import { listIntentProjectKnowledgeAuditEntries } from '@/lib/intent-project-knowledge';
import { buildIntentE2ECiCdReport } from '@/lib/intent-e2e-cicd-report';
import { buildBrowserE2EPlatformTestAssetBundle } from '@/lib/test-platform-asset-model';

function createResult(success = true) {
  const scenarioCard = {
    version: 1 as const,
    title: '供应商门户登录检查',
    taskMode: 'scenario' as const,
    targetUrl: 'https://vendor.example.test/login',
    featureDescription: '登录供应商门户后检查订单列表',
    flowDefinition: {
      version: 1 as const,
      entryUrl: 'https://vendor.example.test/login',
      sharedVariables: [],
      expectedOutcome: '看到订单列表',
      cleanupNotes: '',
      steps: [],
    },
    successCriteria: ['看到订单列表'],
    visualAnchors: [],
    notes: [],
  };
  const description = '登录供应商门户后检查订单列表。';
  const platformAssets = buildBrowserE2EPlatformTestAssetBundle({
    projectUid: 'proj_vendor',
    moduleUid: 'mod_vendor',
    requestInput: '登录供应商门户后检查订单列表',
    scenarioCard,
    description,
    targetUrl: 'https://vendor.example.test/login',
    scenarioEntryUrl: 'https://vendor.example.test/login',
  });

  return {
    ...platformAssets,
    scenarioCard,
    llmMeta: {
      provider: 'openai',
      model: 'gpt-5.4',
      visionEnabled: false,
      attachmentCount: 0,
    },
    targetUrl: 'https://vendor.example.test/login',
    description,
    knowledge: {
      profilePath: 'reports/intent-e2e/projects/proj_vendor/intent-e2e.project-knowledge.json',
      matchCount: 1,
      matchedRuleIds: ['vendor.login'],
      matchedRuleTitles: ['vendor login'],
      capabilitySlugs: [],
      suggestedHelpers: [],
      starterAssets: [],
    },
    assetReadiness: {
      status: 'ready' as const,
      projectUid: 'proj_vendor',
      knowledgeMatchCount: 1,
      reasons: [],
    },
    qualitySplit: {
      bucket: success ? ('passed' as const) : ('model_quality' as const),
      blocked: false,
      qualityEligible: true,
      blockerKind: '' as const,
    },
    attempts: [],
    finalResult: {
      success,
      duration: 1200,
      error: success ? null : '订单列表未出现',
      steps: [],
    },
    finalFailureTriage: success
      ? null
      : {
          failureClass: 'assertion_too_strict' as const,
          repairable: true,
          summary: '订单列表未出现',
          matchedSignals: [],
        },
    artifactIndex: {
      schemaVersion: 1 as const,
      runId: 'intent-run-report',
      rootPath: 'reports/intent-e2e/runs/intent-run-report',
      itemCount: 2,
      byKind: [
        { kind: 'trace' as const, count: 1 },
        { kind: 'log' as const, count: 1 },
      ],
      items: [],
    },
  };
}

function createSnapshot(runId: string, result: ReturnType<typeof createResult>): IntentE2ERunSnapshotRecord {
  return {
    runId,
    projectUid: 'proj_vendor',
    moduleUid: 'mod_vendor',
    status: result.finalResult.success ? 'passed' : 'failed',
    stage: 'completed',
    requestInput: '登录供应商门户后检查订单列表',
    targetUrl: 'https://vendor.example.test/login',
    state: {
      runId,
      status: result.finalResult.success ? 'passed' : 'failed',
      stage: 'completed',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:03.000Z',
      startedAt: '2026-04-01T10:00:01.000Z',
      endedAt: '2026-04-01T10:00:03.000Z',
      request: {
        input: '登录供应商门户后检查订单列表',
        targetUrl: 'https://vendor.example.test/login',
        attachmentCount: 0,
        hasAuth: false,
        cicdProfile: 'pr_gate',
        llm: {
          provider: 'openai',
          model: 'gpt-5.4',
          apiStyle: 'responses',
          visionEnabled: false,
          selfHealRetries: 0,
          maxPlanSteps: 8,
        },
      },
      events: [],
      result,
      error: result.finalResult.error || null,
    },
    error: result.finalResult.error || '',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:03.000Z',
    startedAt: '2026-04-01T10:00:01.000Z',
    endedAt: '2026-04-01T10:00:03.000Z',
  };
}

describe('intent-e2e-cicd-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listIntentE2ERunSnapshots).mockResolvedValue([]);
    vi.mocked(listProjectActivityLogs).mockResolvedValue([]);
    vi.mocked(listIntentProjectKnowledgeAuditEntries).mockResolvedValue({
      auditLogPath: 'reports/intent-e2e.project-knowledge.audit.jsonl',
      items: [],
    } as never);
  });

  it('builds a passing report with benchmark compare and gate decision', async () => {
    const result = createResult(true);
    const baselineSnapshots = Array.from({ length: 6 }, (_, index) =>
      createSnapshot(`intent-run-baseline-${index + 1}`, result)
    );
    vi.mocked(listIntentE2ERunSnapshots).mockResolvedValue(baselineSnapshots as never);
    const benchmark = buildIntentE2EBenchmarkSuiteFromData(baselineSnapshots, {
      projectUid: 'proj_vendor',
      moduleUid: 'mod_vendor',
      label: 'vendor baseline',
      releaseCandidate: 'vendor-staging',
    });

    vi.mocked(readIntentE2EBenchmark).mockResolvedValue({
      benchmark,
      path: 'reports/intent-e2e/projects/proj_vendor/intent-e2e.benchmark.json',
    } as never);

    const report = await buildIntentE2ECiCdReport({
      runId: 'intent-run-report',
      projectUid: 'proj_vendor',
      moduleUid: 'mod_vendor',
      requestInput: '登录供应商门户后检查订单列表',
      targetUrl: 'https://vendor.example.test/login',
      status: 'passed',
      result,
      cicdProfile: 'pr_gate',
      systemOnboarding: {
        manifestId: 'vendor_portal_staging',
        displayName: 'Vendor Portal Staging',
        systemKey: 'vendor_portal',
        systemDisplayName: '供应商门户 Staging',
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        envProfile: 'staging',
        entryUrl: 'https://vendor.example.test/login',
        targetUrlFamilies: ['https://vendor.example.test/login'],
        benchmarkBinding: {
          mode: 'project_default',
          comparedLabel: 'vendor-portal-current',
        },
      },
    });
    expect(report.profile).toBe('pr_gate');
    expect(report.passFail.passed).toBe(true);
    expect(report.gate.decision).toBe('observe');
    expect(report.gate.effectiveStage).toBe('small_batch');
    expect(report.benchmarkCompare.status).toBe('unchanged');
    expect(report.benchmarkCompare.benchmarkBound).toBe(true);
    expect(report.rollbackRecommendation.level).toBe('none');
    expect(report.artifacts.rootPath).toBe('reports/intent-e2e/runs/intent-run-report');
  });

  it('fails the gate when the bound benchmark uid does not match the project default benchmark', async () => {
    const result = createResult(true);
    const baselineSnapshot = createSnapshot('intent-run-baseline', result);
    const benchmark = buildIntentE2EBenchmarkSuiteFromData([baselineSnapshot], {
      projectUid: 'proj_vendor',
      moduleUid: 'mod_vendor',
      label: 'vendor baseline',
      releaseCandidate: 'vendor-staging',
    });

    vi.mocked(readIntentE2EBenchmark).mockResolvedValue({
      benchmark,
      path: 'reports/intent-e2e/projects/proj_vendor/intent-e2e.benchmark.json',
    } as never);

    const report = await buildIntentE2ECiCdReport({
      runId: 'intent-run-report',
      projectUid: 'proj_vendor',
      moduleUid: 'mod_vendor',
      requestInput: '登录供应商门户后检查订单列表',
      targetUrl: 'https://vendor.example.test/login',
      status: 'passed',
      result,
      cicdProfile: 'release_candidate_validation',
      systemOnboarding: {
        manifestId: 'vendor_portal_staging',
        displayName: 'Vendor Portal Staging',
        systemKey: 'vendor_portal',
        systemDisplayName: '供应商门户 Staging',
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        envProfile: 'staging',
        entryUrl: 'https://vendor.example.test/login',
        targetUrlFamilies: ['https://vendor.example.test/login'],
        benchmarkBinding: {
          mode: 'project_default',
          comparedLabel: 'vendor-portal-current',
          expectedBenchmarkUid: 'bench-expected-other',
        },
      },
    });

    expect(report.benchmarkCompare.bindingSatisfied).toBe(false);
    expect(report.gate.decision).toBe('fail');
    expect(report.gate.allow).toBe(false);
  });
});
