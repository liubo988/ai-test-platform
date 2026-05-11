import type { IntentE2EReleaseStatus, IntentE2EReleaseStatusCheckStatus } from './intent-e2e-release-status';

export type IntentE2EReleaseReadinessSummaryView = {
  checkCount: number;
  passedChecks: number;
  warningChecks: number;
  failedChecks: number;
  skippedChecks: number;
  familyCount: number;
  readyFamilies: number;
  blockedFamilies: number;
};

export type IntentE2EReleaseFamilyIssueView = {
  releaseGuard: {
    status: IntentE2EReleaseStatusCheckStatus;
    failures?: string[];
  } | null;
  knowledgeHit: {
    status: IntentE2EReleaseStatusCheckStatus;
    failures?: string[];
  } | null;
};

export function getIntentE2EReleaseReadinessLabel(status: IntentE2EReleaseStatus): string {
  switch (status) {
    case 'ready':
      return '可发布';
    case 'attention':
      return '需复核';
    default:
      return '阻断';
  }
}

export function getIntentE2EReleaseReadinessSummaryText(status: IntentE2EReleaseStatus): string {
  switch (status) {
    case 'ready':
      return 'release guard、knowledge-hit 与最近 compare 证据当前齐全。';
    case 'attention':
      return '当前没有阻塞项，但仍有需要复核的证据或 compare 状态。';
    default:
      return '存在阻塞证据，先处理失败项再进入发布。';
  }
}

export function getIntentE2EReleaseReadinessDetailText(
  status: IntentE2EReleaseStatus,
  summary: IntentE2EReleaseReadinessSummaryView
): string {
  const checkText = `checks ${summary.passedChecks}/${summary.checkCount}`;
  const familyText = `families ${summary.readyFamilies}/${summary.familyCount}`;
  switch (status) {
    case 'ready':
      return `${checkText} 通过，${familyText} 就绪；blocked family=${summary.blockedFamilies}。`;
    case 'attention':
      return `${checkText} 通过，warning=${summary.warningChecks + summary.skippedChecks}；${familyText} 就绪。`;
    default:
      return `${checkText} 通过，failed=${summary.failedChecks}；blocked family=${summary.blockedFamilies}。`;
  }
}

export function getIntentE2EReleaseCheckStatusLabel(status: IntentE2EReleaseStatusCheckStatus): string {
  switch (status) {
    case 'passed':
      return '通过';
    case 'warning':
      return '观察';
    case 'skipped':
      return '跳过';
    default:
      return '失败';
  }
}

export function getIntentE2EReleaseFamilyIssueMessages(family: IntentE2EReleaseFamilyIssueView): string[] {
  const messages: string[] = [];
  if (!family.releaseGuard) {
    messages.push('release guard evidence 缺失');
  } else if (family.releaseGuard.status !== 'passed') {
    messages.push(`release guard ${getIntentE2EReleaseCheckStatusLabel(family.releaseGuard.status)}`);
  }
  for (const failure of family.releaseGuard?.failures || []) {
    if (failure.trim()) {
      messages.push(`release：${failure.trim()}`);
    }
  }

  if (!family.knowledgeHit) {
    messages.push('knowledge-hit evidence 缺失');
  } else if (family.knowledgeHit.status !== 'passed') {
    messages.push(`knowledge-hit ${getIntentE2EReleaseCheckStatusLabel(family.knowledgeHit.status)}`);
  }
  for (const failure of family.knowledgeHit?.failures || []) {
    if (failure.trim()) {
      messages.push(`knowledge：${failure.trim()}`);
    }
  }

  return messages.slice(0, 6);
}
