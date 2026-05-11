import { describe, expect, it } from 'vitest';
import {
  getIntentE2EReleaseCheckStatusLabel,
  getIntentE2EReleaseFamilyIssueMessages,
  getIntentE2EReleaseReadinessDetailText,
  getIntentE2EReleaseReadinessLabel,
  getIntentE2EReleaseReadinessSummaryText,
} from '@/lib/intent-e2e-release-status-view';

describe('intent-e2e-release-status-view', () => {
  it('renders shared release readiness labels and summaries', () => {
    expect(getIntentE2EReleaseReadinessLabel('ready')).toBe('可发布');
    expect(getIntentE2EReleaseReadinessLabel('attention')).toBe('需复核');
    expect(getIntentE2EReleaseReadinessLabel('blocked')).toBe('阻断');
    expect(getIntentE2EReleaseReadinessSummaryText('ready')).toContain('release guard、knowledge-hit');
    expect(getIntentE2EReleaseReadinessSummaryText('attention')).toContain('需要复核');
    expect(getIntentE2EReleaseReadinessSummaryText('blocked')).toContain('存在阻塞证据');
  });

  it('renders readiness detail from a shared summary contract', () => {
    const summary = {
      checkCount: 3,
      passedChecks: 2,
      warningChecks: 1,
      failedChecks: 1,
      skippedChecks: 1,
      familyCount: 4,
      readyFamilies: 3,
      blockedFamilies: 1,
    };

    expect(getIntentE2EReleaseReadinessDetailText('ready', summary)).toBe('checks 2/3 通过，families 3/4 就绪；blocked family=1。');
    expect(getIntentE2EReleaseReadinessDetailText('attention', summary)).toBe('checks 2/3 通过，warning=2；families 3/4 就绪。');
    expect(getIntentE2EReleaseReadinessDetailText('blocked', summary)).toBe('checks 2/3 通过，failed=1；blocked family=1。');
  });

  it('renders shared check status labels', () => {
    expect(getIntentE2EReleaseCheckStatusLabel('passed')).toBe('通过');
    expect(getIntentE2EReleaseCheckStatusLabel('warning')).toBe('观察');
    expect(getIntentE2EReleaseCheckStatusLabel('skipped')).toBe('跳过');
    expect(getIntentE2EReleaseCheckStatusLabel('failed')).toBe('失败');
  });

  it('summarizes family issue messages with a stable cap', () => {
    expect(
      getIntentE2EReleaseFamilyIssueMessages({
        releaseGuard: {
          status: 'failed',
          failures: ['regressed', '', 'missing'],
        },
        knowledgeHit: {
          status: 'warning',
          failures: ['weak hit', 'needs review', 'extra reason', 'overflow reason'],
        },
      })
    ).toEqual([
      'release guard 失败',
      'release：regressed',
      'release：missing',
      'knowledge-hit 观察',
      'knowledge：weak hit',
      'knowledge：needs review',
    ]);
  });

  it('marks missing family evidence explicitly', () => {
    expect(
      getIntentE2EReleaseFamilyIssueMessages({
        releaseGuard: null,
        knowledgeHit: null,
      })
    ).toEqual(['release guard evidence 缺失', 'knowledge-hit evidence 缺失']);
  });
});
