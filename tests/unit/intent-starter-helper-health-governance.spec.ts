import { describe, expect, it } from 'vitest';
import {
  collectIntentStarterHelperHealthGovernanceCapabilityItems,
  collectIntentStarterHelperReviewCapabilityUids,
  isIntentStarterHelperHighFailureSuppressed,
  resolveIntentSuppressedStarterHelperGovernanceTargets,
  resolveIntentStarterHelperHealthGovernanceTargets,
  summarizeIntentStarterHelperGovernanceReviewTargets,
} from '@/lib/intent-starter-helper-health-governance';

describe('intent-starter-helper-health-governance', () => {
  it('collects only suppressed-helper review capability uids', () => {
    expect(
      collectIntentStarterHelperReviewCapabilityUids({
        helper: '__e2e.waitForApiResponse',
        queueItems: [
          { capabilityUid: 'cap_a', recommendationKind: 'suppressed_helper_review' },
          { capabilityUid: 'cap_a', recommendationKind: 'suppressed_helper_review' },
          { capabilityUid: 'cap_b', recommendationKind: 'repair_failed' },
        ],
      })
    ).toEqual(['cap_a']);
  });

  it('detects suppressed helpers with high failure pressure', () => {
    expect(
      isIntentStarterHelperHighFailureSuppressed({
        helper: '__e2e.waitForApiResponse',
        healthStatus: 'suppressed',
        failurePressure: {
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 0,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 2,
          recentFailureWindowDays: 14,
        },
      })
    ).toBe(true);
    expect(
      isIntentStarterHelperHighFailureSuppressed({
        helper: '__e2e.waitForApiResponse',
        healthStatus: 'suppressed',
        failurePressure: {
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 0,
          recentFailedReviewExecutionCount: 1,
          recentFailedVerifyExecutionCount: 0,
          recentFailureWindowDays: 14,
        },
      })
    ).toBe(false);
  });

  it('resolves high-failure suppressed helper review targets against current capability objects', () => {
    const targets = resolveIntentStarterHelperHealthGovernanceTargets({
      helperItems: [
        {
          helper: '__e2e.waitForApiResponse',
          healthStatus: 'suppressed',
          failurePressure: {
            recentFailedReviewCapabilityCount: 0,
            recentFailedVerifyCapabilityCount: 1,
            recentFailedReviewExecutionCount: 0,
            recentFailedVerifyExecutionCount: 2,
            recentFailureWindowDays: 14,
          },
          queueItems: [
            { capabilityUid: 'cap_review_1', recommendationKind: 'suppressed_helper_review' },
            { capabilityUid: 'cap_review_2', recommendationKind: 'suppressed_helper_review' },
            { capabilityUid: 'cap_repair', recommendationKind: 'repair_failed' },
          ],
        },
        {
          helper: '__e2e.openAntdDropdown',
          healthStatus: 'suppressed',
          failurePressure: {
            recentFailedReviewCapabilityCount: 1,
            recentFailedVerifyCapabilityCount: 0,
            recentFailedReviewExecutionCount: 1,
            recentFailedVerifyExecutionCount: 0,
            recentFailureWindowDays: 14,
          },
          queueItems: [{ capabilityUid: 'cap_other', recommendationKind: 'suppressed_helper_review' }],
        },
      ],
      capabilities: [
        { capabilityUid: 'cap_review_1', name: '接口成功响应 A' },
        { capabilityUid: 'cap_review_2', name: '接口成功响应 B' },
        { capabilityUid: 'cap_repair', name: '接口修复项' },
      ],
    });

    expect(targets).toHaveLength(1);
    expect(targets[0]?.helper).toBe('__e2e.waitForApiResponse');
    expect(targets[0]?.capabilityItems.map((item) => item.capabilityUid)).toEqual(['cap_review_1', 'cap_review_2']);
  });

  it('deduplicates capability objects across governance targets by capability uid', () => {
    expect(
      collectIntentStarterHelperHealthGovernanceCapabilityItems([
        {
          helper: '__e2e.waitForApiResponse',
          capabilityItems: [
            { capabilityUid: 'cap_review_1', name: '接口成功响应 A' },
            { capabilityUid: 'cap_review_2', name: '接口成功响应 B' },
          ],
        },
        {
          helper: '__e2e.observeSubmitState',
          capabilityItems: [
            { capabilityUid: 'cap_review_2', name: '接口成功响应 B（重复）' },
            { capabilityUid: 'cap_review_3', name: '接口成功响应 C' },
          ],
        },
      ]).map((item) => item.capabilityUid)
    ).toEqual(['cap_review_1', 'cap_review_2', 'cap_review_3']);
  });

  it('resolves suppressed-helper governance targets from active linked capabilities instead of queue slices', () => {
    const targets = resolveIntentSuppressedStarterHelperGovernanceTargets({
      helpers: ['__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
      capabilities: [
        {
          capabilityUid: 'cap_review_1',
          status: 'active',
          meta: {
            starterHelper: '__e2e.waitForApiResponse',
            lastVerificationStatus: 'passed',
          },
        },
        {
          capabilityUid: 'cap_repair_1',
          status: 'active',
          meta: {
            starterHelper: '__e2e.waitForApiResponse',
            lastVerificationStatus: 'failed',
            lastVerificationExecutionUid: 'exec_failed_1',
            lastVerificationIntent: 'review',
          },
        },
        {
          capabilityUid: 'cap_review_2',
          status: 'active',
          meta: {
            starterHelper: '__e2e.observeSubmitState',
          },
        },
        {
          capabilityUid: 'cap_archived',
          status: 'archived',
          meta: {
            starterHelper: '__e2e.observeSubmitState',
          },
        },
      ],
    });

    expect(targets).toEqual([
      {
        helper: '__e2e.waitForApiResponse',
        capabilityItems: [expect.objectContaining({ capabilityUid: 'cap_review_1' })],
      },
      {
        helper: '__e2e.observeSubmitState',
        capabilityItems: [expect.objectContaining({ capabilityUid: 'cap_review_2' })],
      },
    ]);
  });

  it('summarizes recent review executions for governance targets without double-counting chained capabilities', () => {
    const result = summarizeIntentStarterHelperGovernanceReviewTargets({
      targets: [
        {
          helper: '__e2e.waitForApiResponse',
          capabilityItems: [{ capabilityUid: 'cap_review_1' }, { capabilityUid: 'cap_review_2' }],
        },
        {
          helper: '__e2e.observeSubmitState',
          capabilityItems: [{ capabilityUid: 'cap_review_3' }],
        },
      ],
      activities: [
        {
          executionUid: 'exec_review_1',
          planUid: 'plan_review_1',
          capabilityUid: 'cap_review_1',
          chainCapabilityUids: ['cap_review_2'],
          intent: 'review',
          status: 'failed',
          createdAt: '2026-03-25T01:00:00.000Z',
        },
        {
          executionUid: 'exec_review_2',
          planUid: 'plan_repair_1',
          capabilityUid: 'cap_review_3',
          intent: 'review',
          status: 'passed',
          createdAt: '2026-03-25T02:00:00.000Z',
        },
        {
          executionUid: 'exec_verify_1',
          planUid: 'plan_verify_1',
          capabilityUid: 'cap_review_1',
          intent: 'verify',
          status: 'passed',
          createdAt: '2026-03-25T03:00:00.000Z',
        },
      ],
      repairPlanUids: ['plan_repair_1'],
    });

    expect(result.summary).toEqual({
      helperCount: 2,
      capabilityCount: 3,
      recentReviewExecutionCount: 2,
      recentPassedReviewExecutionCount: 1,
      recentFailedReviewExecutionCount: 1,
      latestReviewExecutionAt: '2026-03-25T02:00:00.000Z',
      recentVerifyExecutionCount: 1,
      recentPassedVerifyExecutionCount: 1,
      recentFailedVerifyExecutionCount: 0,
      latestVerifyExecutionAt: '2026-03-25T03:00:00.000Z',
      recentRepairExecutionCount: 1,
      recentPassedRepairExecutionCount: 1,
      recentFailedRepairExecutionCount: 0,
      latestRepairExecutionAt: '2026-03-25T02:00:00.000Z',
      recentAutoRepairExecutionCount: 0,
      recentPassedAutoRepairExecutionCount: 0,
      recentFailedAutoRepairExecutionCount: 0,
      latestAutoRepairExecutionAt: '',
      recentManualRepairExecutionCount: 1,
      recentPassedManualRepairExecutionCount: 1,
      recentFailedManualRepairExecutionCount: 0,
      latestManualRepairExecutionAt: '2026-03-25T02:00:00.000Z',
    });
    expect(result.targets).toEqual([
      {
        helper: '__e2e.waitForApiResponse',
        capabilityItems: [{ capabilityUid: 'cap_review_1' }, { capabilityUid: 'cap_review_2' }],
        recentReviewExecutionCount: 1,
        recentPassedReviewExecutionCount: 0,
        recentFailedReviewExecutionCount: 1,
        latestReviewExecutionAt: '2026-03-25T01:00:00.000Z',
        recentVerifyExecutionCount: 1,
        recentPassedVerifyExecutionCount: 1,
        recentFailedVerifyExecutionCount: 0,
        latestVerifyExecutionAt: '2026-03-25T03:00:00.000Z',
        recentRepairExecutionCount: 0,
        recentPassedRepairExecutionCount: 0,
        recentFailedRepairExecutionCount: 0,
        latestRepairExecutionAt: '',
        recentAutoRepairExecutionCount: 0,
        recentPassedAutoRepairExecutionCount: 0,
        recentFailedAutoRepairExecutionCount: 0,
        latestAutoRepairExecutionAt: '',
        recentManualRepairExecutionCount: 0,
        recentPassedManualRepairExecutionCount: 0,
        recentFailedManualRepairExecutionCount: 0,
        latestManualRepairExecutionAt: '',
      },
      {
        helper: '__e2e.observeSubmitState',
        capabilityItems: [{ capabilityUid: 'cap_review_3' }],
        recentReviewExecutionCount: 1,
        recentPassedReviewExecutionCount: 1,
        recentFailedReviewExecutionCount: 0,
        latestReviewExecutionAt: '2026-03-25T02:00:00.000Z',
        recentVerifyExecutionCount: 0,
        recentPassedVerifyExecutionCount: 0,
        recentFailedVerifyExecutionCount: 0,
        latestVerifyExecutionAt: '',
        recentRepairExecutionCount: 1,
        recentPassedRepairExecutionCount: 1,
        recentFailedRepairExecutionCount: 0,
        latestRepairExecutionAt: '2026-03-25T02:00:00.000Z',
        recentAutoRepairExecutionCount: 0,
        recentPassedAutoRepairExecutionCount: 0,
        recentFailedAutoRepairExecutionCount: 0,
        latestAutoRepairExecutionAt: '',
        recentManualRepairExecutionCount: 1,
        recentPassedManualRepairExecutionCount: 1,
        recentFailedManualRepairExecutionCount: 0,
        latestManualRepairExecutionAt: '2026-03-25T02:00:00.000Z',
      },
    ]);
  });

  it('separates auto and manual repair executions when repairTriggerKind is explicit', () => {
    const result = summarizeIntentStarterHelperGovernanceReviewTargets({
      targets: [
        {
          helper: '__e2e.observeSubmitState',
          capabilityItems: [{ capabilityUid: 'cap_submit' }],
        },
      ],
      activities: [
        {
          executionUid: 'exec_auto_repair',
          planUid: 'plan_auto_repair',
          capabilityUid: 'cap_submit',
          intent: 'review',
          status: 'passed',
          repairTriggerKind: 'auto',
          createdAt: '2026-03-25T03:00:00.000Z',
        },
        {
          executionUid: 'exec_manual_repair',
          planUid: 'plan_manual_repair',
          capabilityUid: 'cap_submit',
          intent: 'review',
          status: 'failed',
          repairTriggerKind: 'manual',
          createdAt: '2026-03-25T04:00:00.000Z',
        },
      ],
    });

    expect(result.summary).toMatchObject({
      recentRepairExecutionCount: 2,
      recentPassedRepairExecutionCount: 1,
      recentFailedRepairExecutionCount: 1,
      latestRepairExecutionAt: '2026-03-25T04:00:00.000Z',
      recentAutoRepairExecutionCount: 1,
      recentPassedAutoRepairExecutionCount: 1,
      recentFailedAutoRepairExecutionCount: 0,
      latestAutoRepairExecutionAt: '2026-03-25T03:00:00.000Z',
      recentManualRepairExecutionCount: 1,
      recentPassedManualRepairExecutionCount: 0,
      recentFailedManualRepairExecutionCount: 1,
      latestManualRepairExecutionAt: '2026-03-25T04:00:00.000Z',
    });
    expect(result.targets).toEqual([
      expect.objectContaining({
        helper: '__e2e.observeSubmitState',
        recentRepairExecutionCount: 2,
        recentPassedRepairExecutionCount: 1,
        recentFailedRepairExecutionCount: 1,
        latestRepairExecutionAt: '2026-03-25T04:00:00.000Z',
        recentAutoRepairExecutionCount: 1,
        recentPassedAutoRepairExecutionCount: 1,
        recentFailedAutoRepairExecutionCount: 0,
        latestAutoRepairExecutionAt: '2026-03-25T03:00:00.000Z',
        recentManualRepairExecutionCount: 1,
        recentPassedManualRepairExecutionCount: 0,
        recentFailedManualRepairExecutionCount: 1,
        latestManualRepairExecutionAt: '2026-03-25T04:00:00.000Z',
      }),
    ]);
  });
});
