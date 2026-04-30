import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildIntentE2EReleaseStatusReport } from '@/lib/intent-e2e-release-status';

function writeJson(filePath: string, value: unknown): string {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
  return filePath;
}

function writeStatusFixture(tempDir: string) {
  const projectUid = 'proj_default';
  const priorityScenarioFamily = 'list_search_detail';
  const recipeAssetPath = writeJson(path.join(tempDir, 'recipes.json'), {
    version: 1,
    recipes: [],
  });
  const benchmarkPath = writeJson(path.join(tempDir, 'benchmark.json'), {
    version: 1,
    benchmarkUid: 'bench_status_1',
    scope: {
      projectUid,
      priorityScenarioFamily,
    },
    summary: {
      runCount: 3,
    },
    proofWindow: {
      mode: 'non_weak',
    },
    cases: [
      {
        evalCaseId: 'case_1',
      },
    ],
  });
  const currentSlicePath = writeJson(path.join(tempDir, 'current-slice.json'), {
    version: 1,
    projectUid,
    priorityScenarioFamily,
    benchmarkUid: 'bench_status_1',
    benchmarkPath,
    proofWindow: 'non_weak',
    afterTerminalRunId: 'intent-run-before',
    afterFinishedAt: '2026-04-28T09:00:00.000Z',
    createdAt: '2026-04-28T09:10:00.000Z',
  });
  const releaseGuardConfigPath = writeJson(path.join(tempDir, 'release-guard.json'), {
    version: 1,
    label: 'status-test-release-guard',
    projectUid,
    recipeAssetInput: recipeAssetPath,
    baselines: [
      {
        id: 'list-search-detail',
        projectUid,
        priorityScenarioFamily,
        benchmarkPath,
        currentSlicePath,
      },
    ],
  });
  const knowledgeEvidencePath = writeJson(path.join(tempDir, 'knowledge-rerun.json'), {
    version: 1,
    summary: {
      requestCount: 1,
      passedRuns: 1,
      failedRuns: 0,
      knowledgeHitRuns: 1,
      knowledgeHitRate: 100,
    },
    runs: [
      {
        matchedRuleIds: ['order.list-search-detail-primary-record'],
      },
    ],
  });
  const knowledgeHitConfigPath = writeJson(path.join(tempDir, 'knowledge-hit.json'), {
    version: 1,
    label: 'status-test-knowledge-hit',
    projectUid,
    evidences: [
      {
        id: 'list-search-detail-knowledge',
        projectUid,
        priorityScenarioFamily,
        evidencePath: knowledgeEvidencePath,
        evidenceType: 'rerun_report',
        expectedRuleIds: ['order.list-search-detail-primary-record'],
        minKnowledgeHitRate: 100,
        requirePassed: true,
      },
    ],
  });
  const releaseReportDir = path.join(tempDir, 'release-reports');
  const releaseReportPath = writeJson(path.join(releaseReportDir, '2026-04-28T10-00-00-status-test.json'), {
    version: 1,
    generatedAt: '2026-04-28T10:00:00.000Z',
    label: 'status-test-release-guard',
    projectUid,
    configPath: releaseGuardConfigPath,
    recipeAssetInput: recipeAssetPath,
    failOn: {
      regression: true,
      missing: true,
      insufficientEvidence: true,
    },
    passed: true,
    summary: {
      baselineCount: 1,
      passedBaselines: 1,
      failedBaselines: 0,
      totalCases: 1,
      regressedCases: 0,
      missingCases: 0,
      insufficientEvidenceCases: 0,
    },
    baselines: [
      {
        id: 'list-search-detail',
        projectUid,
        priorityScenarioFamily,
        benchmarkPath,
        benchmarkUid: 'bench_status_1',
        benchmarkLabel: 'status-test-benchmark',
        comparedLabel: 'status-test-current',
        compareReportPath: path.join(releaseReportDir, 'compare.json'),
        passed: true,
        failures: [],
        summary: {
          totalCases: 1,
          matchedCases: 1,
          missingCases: 0,
          insufficientEvidenceCases: 0,
          regressedCases: 0,
          improvedCases: 0,
          unchangedCases: 1,
          frozenRunCount: 3,
          currentRunCount: 3,
          frozenTerminalPassRate: 100,
          currentTerminalPassRate: 100,
          frozenFirstPassPassRate: 100,
          currentFirstPassPassRate: 100,
          frozenBlockedRate: 0,
          currentBlockedRate: 0,
        },
      },
    ],
  });

  return {
    releaseGuardConfigPath,
    knowledgeHitConfigPath,
    releaseReportDir,
    releaseReportPath,
  };
}

describe('intent e2e release status', () => {
  it('reports ready when static guards and latest release compare pass', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-release-status-ready-'));
    try {
      const fixture = writeStatusFixture(tempDir);
      const report = await buildIntentE2EReleaseStatusReport({
        releaseGuardConfigPath: fixture.releaseGuardConfigPath,
        knowledgeHitConfigPath: fixture.knowledgeHitConfigPath,
        releaseGuardReportDir: fixture.releaseReportDir,
        generatedAt: '2026-04-28T10:30:00.000Z',
      });

      expect(report.status).toBe('ready');
      expect(report.canRelease).toBe(true);
      expect(report.currentCompare.status).toBe('passed');
      expect(report.summary).toMatchObject({
        passedChecks: 3,
        failedChecks: 0,
        readyFamilies: 1,
      });
      expect(report.families[0]).toMatchObject({
        priorityScenarioFamily: 'list_search_detail',
        releaseGuard: {
          status: 'passed',
          currentRunCount: 3,
        },
        knowledgeHit: {
          status: 'passed',
          matchedRuleIds: ['order.list-search-detail-primary-record'],
        },
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reports attention when static guards pass but current compare is missing', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-release-status-attention-'));
    try {
      const fixture = writeStatusFixture(tempDir);
      const emptyReportDir = path.join(tempDir, 'empty-release-reports');
      fs.mkdirSync(emptyReportDir, { recursive: true });
      const report = await buildIntentE2EReleaseStatusReport({
        releaseGuardConfigPath: fixture.releaseGuardConfigPath,
        knowledgeHitConfigPath: fixture.knowledgeHitConfigPath,
        releaseGuardReportDir: emptyReportDir,
        generatedAt: '2026-04-28T10:30:00.000Z',
      });

      expect(report.status).toBe('attention');
      expect(report.canRelease).toBe(false);
      expect(report.currentCompare.status).toBe('missing');
      expect(report.checks.find((item) => item.id === 'release_guard_current_compare')).toMatchObject({
        status: 'warning',
        blocking: false,
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reports blocked when current compare is required and missing', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-release-status-blocked-'));
    try {
      const fixture = writeStatusFixture(tempDir);
      const emptyReportDir = path.join(tempDir, 'empty-release-reports');
      fs.mkdirSync(emptyReportDir, { recursive: true });
      const report = await buildIntentE2EReleaseStatusReport({
        releaseGuardConfigPath: fixture.releaseGuardConfigPath,
        knowledgeHitConfigPath: fixture.knowledgeHitConfigPath,
        releaseGuardReportDir: emptyReportDir,
        generatedAt: '2026-04-28T10:30:00.000Z',
        requireCurrentCompare: true,
      });

      expect(report.status).toBe('blocked');
      expect(report.canRelease).toBe(false);
      expect(report.checks.find((item) => item.id === 'release_guard_current_compare')).toMatchObject({
        status: 'failed',
        blocking: true,
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
