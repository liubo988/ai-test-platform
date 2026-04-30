import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  normalizeIntentE2EKnowledgeHitGuardConfig,
  runIntentE2EKnowledgeHitGuard,
} from '@/lib/intent-e2e-knowledge-hit-guard';

describe('intent e2e knowledge-hit guard', () => {
  it('passes when benchmark and rerun evidence contain expected knowledge rules', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-knowledge-hit-guard-'));
    try {
      const benchmarkPath = path.join(tempDir, 'benchmark.json');
      const rerunPath = path.join(tempDir, 'rerun.json');
      fs.writeFileSync(
        benchmarkPath,
        JSON.stringify(
          {
            version: 1,
            summary: {
              runCount: 3,
              passedRuns: 3,
              failedRuns: 0,
              knowledgeHitRate: 100,
            },
            cases: [
              {
                matchedRuleIds: ['business.create-order-flow'],
              },
            ],
          },
          null,
          2
        ),
        'utf8'
      );
      fs.writeFileSync(
        rerunPath,
        JSON.stringify(
          {
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
          },
          null,
          2
        ),
        'utf8'
      );

      const config = normalizeIntentE2EKnowledgeHitGuardConfig({
        version: 1,
        projectUid: 'proj_default',
        evidences: [
          {
            priorityScenarioFamily: 'business_to_order',
            evidencePath: benchmarkPath,
            evidenceType: 'benchmark',
            expectedRuleIds: ['business.create-order-flow'],
          },
          {
            priorityScenarioFamily: 'list_search_detail',
            evidencePath: rerunPath,
            evidenceType: 'rerun_report',
            expectedRuleIds: ['order.list-search-detail-primary-record'],
          },
        ],
      });
      const report = runIntentE2EKnowledgeHitGuard(config, {
        generatedAt: '2026-04-28T10:30:00.000Z',
        configPath: path.join(tempDir, 'knowledge-hit.json'),
      });

      expect(report).toMatchObject({
        generatedAt: '2026-04-28T10:30:00.000Z',
        projectUid: 'proj_default',
        passed: true,
        summary: {
          evidenceCount: 2,
          passedEvidences: 2,
          failedEvidences: 0,
          missingRuleCount: 0,
        },
      });
      expect(report.evidences[0].matchedRuleIds).toEqual(['business.create-order-flow']);
      expect(report.evidences[1].matchedRuleIds).toEqual(['order.list-search-detail-primary-record']);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails when an expected knowledge rule is missing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-knowledge-hit-guard-missing-'));
    try {
      const benchmarkPath = path.join(tempDir, 'benchmark.json');
      fs.writeFileSync(
        benchmarkPath,
        JSON.stringify(
          {
            version: 1,
            summary: {
              runCount: 3,
              passedRuns: 3,
              failedRuns: 0,
              knowledgeHitRate: 100,
            },
            cases: [
              {
                matchedRuleIds: ['business.create-list-status-detail-entry'],
              },
            ],
          },
          null,
          2
        ),
        'utf8'
      );
      const config = normalizeIntentE2EKnowledgeHitGuardConfig({
        version: 1,
        projectUid: 'proj_default',
        evidences: [
          {
            priorityScenarioFamily: 'business_create_list_verify',
            evidencePath: benchmarkPath,
            expectedRuleIds: ['business.create-list-status-detail-entry', 'missing.rule'],
          },
        ],
      });
      const report = runIntentE2EKnowledgeHitGuard(config);

      expect(report.passed).toBe(false);
      expect(report.summary.missingRuleCount).toBe(1);
      expect(report.evidences[0]).toEqual(
        expect.objectContaining({
          missingRuleIds: ['missing.rule'],
          failures: expect.arrayContaining([expect.stringContaining('missing.rule')]),
        })
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails when knowledge-hit rate is below the configured threshold', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-knowledge-hit-guard-rate-'));
    try {
      const rerunPath = path.join(tempDir, 'rerun.json');
      fs.writeFileSync(
        rerunPath,
        JSON.stringify(
          {
            version: 1,
            summary: {
              requestCount: 2,
              passedRuns: 2,
              failedRuns: 0,
              knowledgeHitRuns: 1,
              knowledgeHitRate: 50,
            },
            runs: [
              {
                matchedRuleIds: ['order.list-search-detail-primary-record'],
              },
              {
                matchedRuleIds: [],
              },
            ],
          },
          null,
          2
        ),
        'utf8'
      );
      const config = normalizeIntentE2EKnowledgeHitGuardConfig({
        version: 1,
        projectUid: 'proj_default',
        evidences: [
          {
            priorityScenarioFamily: 'list_search_detail',
            evidencePath: rerunPath,
            evidenceType: 'rerun_report',
            expectedRuleIds: ['order.list-search-detail-primary-record'],
            minKnowledgeHitRate: 100,
          },
        ],
      });
      const report = runIntentE2EKnowledgeHitGuard(config);

      expect(report.passed).toBe(false);
      expect(report.evidences[0].failures).toEqual(
        expect.arrayContaining([expect.stringContaining('knowledgeHitRate 50 低于阈值 100')])
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
