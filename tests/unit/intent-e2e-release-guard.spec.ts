import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateIntentE2EReleaseGuardReport,
  normalizeIntentE2EReleaseGuardConfig,
  preflightIntentE2EReleaseGuardConfig,
} from '@/lib/intent-e2e-release-guard';
import type { IntentE2EBenchmarkCompareReport } from '@/lib/intent-e2e-benchmark';

function makeCompareReport(
  overrides: Partial<Pick<IntentE2EBenchmarkCompareReport, 'cases' | 'priorityScenarioFamilies'>> = {}
): IntentE2EBenchmarkCompareReport {
  return {
    cases: overrides.cases || [],
    priorityScenarioFamilies: overrides.priorityScenarioFamilies || [],
  } as IntentE2EBenchmarkCompareReport;
}

describe('intent e2e release guard', () => {
  it('normalizes release guard config and baseline defaults', () => {
    const config = normalizeIntentE2EReleaseGuardConfig({
      version: 1,
      projectUid: 'proj_default',
      baselines: [
        {
          priorityScenarioFamily: 'list_search_detail',
          benchmarkPath: 'reports/bench.json',
        },
      ],
    });

    expect(config).toMatchObject({
      version: 1,
      projectUid: 'proj_default',
      label: 'intent-e2e-release-guard',
      failOn: {
        regression: true,
        missing: true,
        insufficientEvidence: true,
      },
      baselines: [
        {
          id: 'list_search_detail-1',
          projectUid: 'proj_default',
          priorityScenarioFamily: 'list_search_detail',
          benchmarkPath: 'reports/bench.json',
          runLimit: 200,
          comparedLabel: 'intent-e2e-release-guard-list_search_detail-current',
        },
      ],
    });
  });

  it('rejects configs without tracked baselines', () => {
    expect(() =>
      normalizeIntentE2EReleaseGuardConfig({
        version: 1,
        projectUid: 'proj_default',
        baselines: [
          {
            priorityScenarioFamily: 'untracked',
            benchmarkPath: 'reports/bench.json',
          },
        ],
      })
    ).toThrow('缺少有效 priorityScenarioFamily');
  });

  it('fails on regressed, missing, and insufficient-evidence compare results', () => {
    const failures = evaluateIntentE2EReleaseGuardReport(
      makeCompareReport({
        cases: [
          {
            evalCaseId: 'case_regressed',
            priorityScenarioFamily: 'business_to_order',
            comparisonStatus: 'regressed',
            comparisonNote: 'terminal -100pt',
          },
          {
            evalCaseId: 'case_missing',
            priorityScenarioFamily: 'list_search_detail',
            comparisonStatus: 'missing',
            comparisonNote: '当前 scope 内未找到可回放 run',
          },
        ] as IntentE2EBenchmarkCompareReport['cases'],
        priorityScenarioFamilies: [
          {
            priorityScenarioFamily: 'business_create_list_verify',
            conclusion: 'insufficient_evidence',
            missingCases: 0,
            note: '当前窗口 2 次 terminal 样本',
          },
        ] as IntentE2EBenchmarkCompareReport['priorityScenarioFamilies'],
      }),
      {
        regression: true,
        missing: true,
        insufficientEvidence: true,
      }
    );

    expect(failures).toEqual([
      expect.objectContaining({
        scope: 'case',
        failureMode: 'regression',
        id: 'case_regressed',
      }),
      expect.objectContaining({
        scope: 'case',
        failureMode: 'missing',
        id: 'case_missing',
      }),
      expect.objectContaining({
        scope: 'family',
        failureMode: 'insufficient_evidence',
        id: 'business_create_list_verify',
      }),
    ]);
  });

  it('can ignore insufficient evidence while still failing regressions', () => {
    const failures = evaluateIntentE2EReleaseGuardReport(
      makeCompareReport({
        cases: [
          {
            evalCaseId: 'case_regressed',
            priorityScenarioFamily: 'business_to_order',
            comparisonStatus: 'regressed',
            comparisonNote: 'first-pass -100pt',
          },
          {
            evalCaseId: 'case_insufficient',
            priorityScenarioFamily: 'list_search_detail',
            comparisonStatus: 'insufficient_evidence',
            comparisonNote: '当前窗口 2 次 terminal 样本',
          },
        ] as IntentE2EBenchmarkCompareReport['cases'],
        priorityScenarioFamilies: [
          {
            priorityScenarioFamily: 'list_search_detail',
            conclusion: 'insufficient_evidence',
            missingCases: 0,
            note: '当前窗口 2 次 terminal 样本',
          },
        ] as IntentE2EBenchmarkCompareReport['priorityScenarioFamilies'],
      }),
      {
        regression: true,
        missing: true,
        insufficientEvidence: false,
      }
    );

    expect(failures).toEqual([
      expect.objectContaining({
        failureMode: 'regression',
        id: 'case_regressed',
      }),
    ]);
  });

  it('preflights portable release guard assets without database access', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-release-guard-preflight-'));
    try {
      const recipePath = path.join(tempDir, 'recipes.json');
      const benchmarkPath = path.join(tempDir, 'benchmark.json');
      const currentSlicePath = path.join(tempDir, 'current-slice.json');

      fs.writeFileSync(
        recipePath,
        JSON.stringify(
          {
            version: 1,
            recipes: [],
          },
          null,
          2
        ),
        'utf8'
      );
      fs.writeFileSync(
        benchmarkPath,
        JSON.stringify(
          {
            version: 1,
            benchmarkUid: 'bench_ok',
            frozenAt: '2026-04-28T09:00:00.000Z',
            scope: {
              projectUid: 'proj_default',
              priorityScenarioFamily: 'list_search_detail',
            },
            proofWindow: {
              mode: 'non_weak',
            },
            summary: {
              runCount: 3,
            },
            cases: [{ evalCaseId: 'case_1' }],
          },
          null,
          2
        ),
        'utf8'
      );
      fs.writeFileSync(
        currentSlicePath,
        JSON.stringify(
          {
            version: 1,
            sliceUid: 'slice_ok',
            projectUid: 'proj_default',
            benchmarkUid: 'bench_ok',
            benchmarkPath,
            priorityScenarioFamily: 'list_search_detail',
            proofWindow: 'non_weak',
            afterTerminalRunId: 'intent-run-boundary',
            afterFinishedAt: '2026-04-28T09:01:00.000Z',
            declaredReason: 'unit test',
            createdFromCompareReport: '',
            createdAt: '2026-04-28T09:02:00.000Z',
          },
          null,
          2
        ),
        'utf8'
      );

      const config = normalizeIntentE2EReleaseGuardConfig({
        version: 1,
        projectUid: 'proj_default',
        recipeAssetInput: recipePath,
        baselines: [
          {
            priorityScenarioFamily: 'list_search_detail',
            benchmarkPath,
            currentSlicePath,
          },
        ],
      });
      const report = preflightIntentE2EReleaseGuardConfig(config, {
        configPath: path.join(tempDir, 'release-guard.json'),
        checkedAt: '2026-04-28T09:03:00.000Z',
      });

      expect(report).toMatchObject({
        checkedAt: '2026-04-28T09:03:00.000Z',
        projectUid: 'proj_default',
        baselineCount: 1,
        passed: false,
        summary: {
          errorCount: 1,
          warningCount: 0,
        },
      });
      expect(report.issues).toEqual([
        expect.objectContaining({
          kind: 'missing_file',
          scope: 'config',
        }),
      ]);

      fs.writeFileSync(path.join(tempDir, 'release-guard.json'), JSON.stringify({ version: 1 }), 'utf8');
      const passingReport = preflightIntentE2EReleaseGuardConfig(config, {
        configPath: path.join(tempDir, 'release-guard.json'),
        checkedAt: '2026-04-28T09:03:00.000Z',
      });

      expect(passingReport.passed).toBe(true);
      expect(passingReport.summary.errorCount).toBe(0);
      expect(passingReport.checkedFiles).toEqual(
        expect.arrayContaining([
          path.join(tempDir, 'release-guard.json'),
          recipePath,
          benchmarkPath,
          currentSlicePath,
        ])
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('preflight fails when current-slice points at a different benchmark', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-release-guard-preflight-mismatch-'));
    try {
      const benchmarkPath = path.join(tempDir, 'benchmark.json');
      const currentSlicePath = path.join(tempDir, 'current-slice.json');
      fs.writeFileSync(
        benchmarkPath,
        JSON.stringify(
          {
            version: 1,
            benchmarkUid: 'bench_expected',
            frozenAt: '2026-04-28T09:00:00.000Z',
            scope: {
              projectUid: 'proj_default',
              priorityScenarioFamily: 'business_to_order',
            },
            proofWindow: {
              mode: 'non_weak',
            },
            summary: {
              runCount: 3,
            },
            cases: [{ evalCaseId: 'case_1' }],
          },
          null,
          2
        ),
        'utf8'
      );
      fs.writeFileSync(
        currentSlicePath,
        JSON.stringify(
          {
            version: 1,
            sliceUid: 'slice_bad',
            projectUid: 'proj_default',
            benchmarkUid: 'bench_other',
            benchmarkPath,
            priorityScenarioFamily: 'business_to_order',
            proofWindow: 'non_weak',
            afterTerminalRunId: 'intent-run-boundary',
            afterFinishedAt: '2026-04-28T09:01:00.000Z',
            declaredReason: 'unit test',
            createdFromCompareReport: '',
            createdAt: '2026-04-28T09:02:00.000Z',
          },
          null,
          2
        ),
        'utf8'
      );

      const config = normalizeIntentE2EReleaseGuardConfig({
        version: 1,
        projectUid: 'proj_default',
        baselines: [
          {
            priorityScenarioFamily: 'business_to_order',
            benchmarkPath,
            currentSlicePath,
          },
        ],
      });
      const report = preflightIntentE2EReleaseGuardConfig(config);

      expect(report.passed).toBe(false);
      expect(report.issues).toEqual([
        expect.objectContaining({
          kind: 'current_slice_mismatch',
          scope: 'current_slice',
          message: expect.stringContaining('benchmarkUid 不匹配'),
        }),
      ]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
