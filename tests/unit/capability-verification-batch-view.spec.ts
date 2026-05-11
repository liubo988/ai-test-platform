import { describe, expect, it } from 'vitest';
import {
  filterCapabilityVerificationBatchItems,
  isCapabilityVerificationBatchItemPendingSync,
  summarizeCapabilityVerificationBatchFailures,
} from '@/lib/capability-verification-batch-view';

describe('capability-verification-batch-view', () => {
  it('groups failed batch items by execution outcome and keeps compact examples', () => {
    const result = summarizeCapabilityVerificationBatchFailures(
      [
        {
          capabilityName: '登录能力',
          executionUid: 'exec_login',
          status: 'failed',
          errorMessage: '跳过: 缺少 E2E_USERNAME',
        },
        {
          capabilityName: '搜索能力',
          executionUid: 'exec_search',
          status: 'failed',
          errorMessage: '跳过: 请先设置 E2E_PASSWORD',
        },
        {
          capabilityName: '列表断言',
          executionUid: 'exec_assert',
          status: 'failed',
          errorMessage: 'locator timeout waiting for row',
        },
        {
          capabilityName: '已通过能力',
          executionUid: 'exec_passed',
          status: 'passed',
          resultSummary: '执行成功',
        },
      ],
      { groupLimit: 3, exampleLimit: 2 }
    );

    expect(result).toMatchObject([
      {
        kind: 'missing_prerequisite',
        title: '缺少运行前变量',
        count: 2,
        repairRecommended: false,
        examples: ['登录能力', '搜索能力'],
      },
      {
        kind: 'script_failure',
        title: '脚本执行失败',
        count: 1,
        repairRecommended: true,
        examples: ['列表断言'],
      },
    ]);
  });

  it('filters terminal unsynced items for the one-click pending-sync view', () => {
    const pending = {
      capabilityName: '待回写能力',
      executionUid: 'exec_pending',
      status: 'passed',
      synced: false,
    };
    const running = {
      capabilityName: '执行中能力',
      executionUid: 'exec_running',
      status: 'running',
      synced: false,
    };
    const synced = {
      capabilityName: '已回写能力',
      executionUid: 'exec_synced',
      status: 'failed',
      synced: true,
    };

    expect(isCapabilityVerificationBatchItemPendingSync(pending)).toBe(true);
    expect(isCapabilityVerificationBatchItemPendingSync(running)).toBe(false);
    expect(isCapabilityVerificationBatchItemPendingSync(synced)).toBe(false);
    expect(filterCapabilityVerificationBatchItems([pending, running, synced], 'pending_sync')).toEqual([pending]);
    expect(filterCapabilityVerificationBatchItems([pending, running, synced], 'all')).toEqual([pending, running, synced]);
  });
});
