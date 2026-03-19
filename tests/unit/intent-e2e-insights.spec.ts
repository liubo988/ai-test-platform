import { describe, expect, it } from 'vitest';
import { buildIntentE2EInsightsFromData, buildIntentE2ERulePerformanceMapFromData } from '@/lib/ai/intent-e2e-insights';
import type { IntentE2ERunSnapshotRecord } from '@/lib/db/repository';
import type { IntentProjectKnowledgeAuditEntry } from '@/lib/intent-project-knowledge';

function makeRunSnapshot(input: Partial<IntentE2ERunSnapshotRecord> & Pick<IntentE2ERunSnapshotRecord, 'runId' | 'status'>): IntentE2ERunSnapshotRecord {
  return {
    runId: input.runId,
    projectUid: input.projectUid || 'proj_checkout',
    status: input.status,
    stage: input.stage || input.status,
    requestInput: input.requestInput || '提交订单并校验成功页',
    targetUrl: input.targetUrl || 'https://example.com/checkout',
    state: input.state || null,
    error: input.error || '',
    createdAt: input.createdAt || '2026-03-19T10:00:00.000Z',
    updatedAt: input.updatedAt || input.createdAt || '2026-03-19T10:00:00.000Z',
    startedAt: input.startedAt || input.createdAt || '2026-03-19T10:00:00.000Z',
    endedAt: input.endedAt || input.updatedAt || input.createdAt || '2026-03-19T10:00:00.000Z',
  };
}

function makeAudit(input: Partial<IntentProjectKnowledgeAuditEntry>): IntentProjectKnowledgeAuditEntry {
  return {
    auditId: input.auditId || 'audit_1',
    occurredAt: input.occurredAt || '2026-03-19T10:03:30.000Z',
    operation: input.operation || 'merge',
    projectUid: input.projectUid || 'proj_checkout',
    actorLabel: input.actorLabel || 'bobo',
    title: input.title || '合并 checkout 规则',
    detail: input.detail || '',
    writtenTo: input.writtenTo || 'intent-e2e.project-knowledge.json',
    backupPath: input.backupPath === undefined ? 'reports/intent-e2e.project-knowledge.backups/checkout.json' : input.backupPath,
    sourcePath: input.sourcePath === undefined ? 'reports/intent-e2e.project-knowledge.draft.json' : input.sourcePath,
    comparison: input.comparison || {
      before: {
        ruleCount: 8,
        enabledRuleCount: 8,
        capabilitySlugCount: 4,
        preferredHelperCount: 5,
        stepPatchCount: 9,
        urlPatternCount: 8,
      },
      after: {
        ruleCount: 10,
        enabledRuleCount: 10,
        capabilitySlugCount: 5,
        preferredHelperCount: 7,
        stepPatchCount: 11,
        urlPatternCount: 10,
      },
      addedRuleIds: ['checkout.submit'],
      removedRuleIds: [],
      updatedRuleIds: [],
    },
    meta: input.meta || {},
  };
}

describe('intent-e2e insights', () => {
  it('aggregates pass rate, knowledge hits, helper reuse, top rules, helpers, and failure classes', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'run_1',
        status: 'passed',
        endedAt: '2026-03-19T10:00:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit', 'checkout.success'],
              matchedRuleTitles: ['结算提交页', '成功页断言'],
              suggestedHelpers: ['__e2e.waitForApiResponse', '__e2e.assertTextVisible'],
            },
            attempts: [
              {
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse', '__e2e.assertTextVisible'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse', '__e2e.assertTextVisible'],
                },
              },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'run_2',
        status: 'failed',
        endedAt: '2026-03-19T10:02:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit'],
              matchedRuleTitles: ['结算提交页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [
              {
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                },
              },
            ],
            finalFailureTriage: {
              failureClass: 'selector_drift',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'run_3',
        status: 'canceled',
        endedAt: '2026-03-19T10:04:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: [],
              matchedRuleTitles: [],
              suggestedHelpers: ['__e2e.assertTextVisible'],
            },
            attempts: [
              {
                helperUsage: {
                  usedHelpers: ['__e2e.assertTextVisible'],
                  usedSuggestedHelpers: [],
                },
              },
            ],
            finalFailureTriage: {
              failureClass: 'env_transient',
            },
          },
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, [], {
      projectUid: 'proj_checkout',
      runLimit: 50,
      auditLimit: 12,
    });

    expect(result.scope).toEqual({
      projectUid: 'proj_checkout',
      runLimit: 50,
      auditLimit: 12,
    });
    expect(result.summary).toEqual({
      totalRuns: 3,
      passedRuns: 1,
      failedRuns: 1,
      canceledRuns: 1,
      passRate: 33.3,
      knowledgeHitRuns: 2,
      knowledgeHitRate: 66.7,
      suggestedHelperReuseRuns: 2,
      suggestedHelperReuseRate: 66.7,
    });
    expect(result.topRules).toEqual([
      {
        ruleId: 'checkout.submit',
        title: '结算提交页',
        runCount: 2,
        passedRuns: 1,
        passRate: 50,
      },
      {
        ruleId: 'checkout.success',
        title: '成功页断言',
        runCount: 1,
        passedRuns: 1,
        passRate: 100,
      },
    ]);
    expect(result.topHelpers).toEqual([
      {
        helper: '__e2e.assertTextVisible',
        runCount: 2,
        passedRuns: 1,
        passRate: 50,
        suggestedReuseRuns: 1,
      },
      {
        helper: '__e2e.waitForApiResponse',
        runCount: 2,
        passedRuns: 1,
        passRate: 50,
        suggestedReuseRuns: 2,
      },
    ]);
    expect(result.failureClasses).toEqual([
      { failureClass: 'env_transient', count: 1 },
      { failureClass: 'selector_drift', count: 1 },
    ]);
    expect(result.probationRules).toEqual([]);
    expect(result.rollbackCandidates).toEqual([]);
  });

  it('flags rollback candidates when pass rate drops after a merge audit', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'before_1',
        status: 'passed',
        endedAt: '2026-03-19T10:00:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'before_2',
        status: 'passed',
        endedAt: '2026-03-19T10:01:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'before_3',
        status: 'passed',
        endedAt: '2026-03-19T10:02:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'before_4',
        status: 'passed',
        endedAt: '2026-03-19T10:03:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'after_1',
        status: 'failed',
        endedAt: '2026-03-19T10:05:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit'],
              matchedRuleTitles: ['结算提交页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [],
            finalFailureTriage: {
              failureClass: 'assertion_too_strict',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'after_2',
        status: 'failed',
        endedAt: '2026-03-19T10:06:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit'],
              matchedRuleTitles: ['结算提交页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [],
            finalFailureTriage: {
              failureClass: 'workflow_gap',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'after_3',
        status: 'passed',
        endedAt: '2026-03-19T10:07:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit'],
              matchedRuleTitles: ['结算提交页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'after_4',
        status: 'failed',
        endedAt: '2026-03-19T10:08:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit'],
              matchedRuleTitles: ['结算提交页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [],
            finalFailureTriage: {
              failureClass: 'selector_drift',
            },
          },
        },
      }),
    ];
    const audits = [
      makeAudit({
        auditId: 'audit_merge_1',
        occurredAt: '2026-03-19T10:04:00.000Z',
        comparison: {
          before: {
            ruleCount: 8,
            enabledRuleCount: 8,
            capabilitySlugCount: 4,
            preferredHelperCount: 5,
            stepPatchCount: 9,
            urlPatternCount: 8,
          },
          after: {
            ruleCount: 10,
            enabledRuleCount: 10,
            capabilitySlugCount: 5,
            preferredHelperCount: 7,
            stepPatchCount: 11,
            urlPatternCount: 10,
          },
          addedRuleIds: ['checkout.submit', 'checkout.success'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, audits, {
      projectUid: 'proj_checkout',
    });

    expect(result.rollbackCandidates).toHaveLength(1);
    expect(result.probationRules[0]).toMatchObject({
      auditId: 'audit_merge_1',
      status: 'degraded',
      observedRuns: 4,
      observedPassedRuns: 1,
      observedFailedRuns: 3,
      observedPassRate: 25,
      remainingRuns: 2,
    });
    expect(result.rollbackCandidates[0]).toMatchObject({
      auditId: 'audit_merge_1',
      projectUid: 'proj_checkout',
      title: '合并 checkout 规则',
      backupPath: 'reports/intent-e2e.project-knowledge.backups/checkout.json',
      addedRuleIds: ['checkout.submit', 'checkout.success'],
      beforeRuns: 4,
      beforePassRate: 100,
      afterRuns: 4,
      afterPassRate: 25,
      passRateDelta: 75,
    });
    expect(result.rollbackCandidates[0]?.recommendation).toContain('checkout.submit / checkout.success');
    expect(result.rollbackCandidates[0]?.recommendation).toContain('reports/intent-e2e.project-knowledge.backups/checkout.json');
  });

  it('builds rule performance map with rollback risk counts', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'before_1',
        status: 'passed',
        endedAt: '2026-03-19T10:00:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'before_2',
        status: 'passed',
        endedAt: '2026-03-19T10:01:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'before_3',
        status: 'passed',
        endedAt: '2026-03-19T10:02:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'after_1',
        status: 'failed',
        endedAt: '2026-03-19T10:05:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit'],
              matchedRuleTitles: ['结算提交页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'after_2',
        status: 'failed',
        endedAt: '2026-03-19T10:06:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit'],
              matchedRuleTitles: ['结算提交页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'after_3',
        status: 'passed',
        endedAt: '2026-03-19T10:07:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit'],
              matchedRuleTitles: ['结算提交页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [],
          },
        },
      }),
    ];
    const audits = [
      makeAudit({
        occurredAt: '2026-03-19T10:04:00.000Z',
        comparison: {
          before: {
            ruleCount: 8,
            enabledRuleCount: 8,
            capabilitySlugCount: 4,
            preferredHelperCount: 5,
            stepPatchCount: 9,
            urlPatternCount: 8,
          },
          after: {
            ruleCount: 9,
            enabledRuleCount: 9,
            capabilitySlugCount: 5,
            preferredHelperCount: 6,
            stepPatchCount: 10,
            urlPatternCount: 9,
          },
          addedRuleIds: ['checkout.submit'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
      }),
    ];

    const result = buildIntentE2ERulePerformanceMapFromData(runSnapshots, audits);

    expect(result['checkout.base']).toMatchObject({
      runCount: 3,
      passedRuns: 3,
      passRate: 100,
      rollbackCandidateCount: 0,
    });
    expect(result['checkout.submit']).toMatchObject({
      runCount: 3,
      passedRuns: 1,
      failedRuns: 2,
      passRate: 33.3,
      rollbackCandidateCount: 1,
      probation: {
        status: 'degraded',
        observedRuns: 3,
        observedPassRate: 33.3,
        remainingRuns: 3,
      },
    });
  });
});
