import { describe, expect, it } from 'vitest';
import { buildExecutionRepairBlockedMessage, describeExecutionOutcome } from '@/lib/execution-outcome';

describe('describeExecutionOutcome', () => {
  it('classifies missing prerequisite skips as non-repairable failures', () => {
    const outcome = describeExecutionOutcome({
      status: 'failed',
      resultSummary: '执行失败（跳过步骤 1）',
      errorMessage: '跳过: 缺少 E2E_CONTACT_PHONE，无法执行“按手机号检索并校验”步骤',
    });

    expect(outcome.kind).toBe('missing_prerequisite');
    expect(outcome.shortLabel).toBe('缺少前置变量');
    expect(outcome.repairRecommended).toBe(false);
    expect(outcome.hint).toContain('AI 纠错不能补出缺失输入');
  });

  it('classifies queue timeout as environment failure instead of script failure', () => {
    const outcome = describeExecutionOutcome({
      status: 'failed',
      resultSummary: '执行失败（排队超时）',
      errorMessage: '执行未启动：排队状态超时',
    });

    expect(outcome.kind).toBe('queue_timeout');
    expect(outcome.repairRecommended).toBe(false);
    expect(outcome.title).toBe('执行未被 worker 接管');
  });

  it('classifies generic assertion failures as repairable script failures', () => {
    const outcome = describeExecutionOutcome({
      status: 'failed',
      resultSummary: '执行失败（失败步骤 1）',
      errorMessage: 'expect(locator).toBeVisible() failed',
    });

    expect(outcome.kind).toBe('script_failure');
    expect(outcome.repairRecommended).toBe(true);
    expect(outcome.title).toBe('脚本执行失败');
  });

  it('builds a repair block message for non-repairable failures', () => {
    const message = buildExecutionRepairBlockedMessage({
      status: 'failed',
      resultSummary: '执行失败（跳过步骤 1）',
      errorMessage: '跳过: 缺少 E2E_CONTACT_PHONE，无法执行“按手机号检索并校验”步骤',
    });

    expect(message).toContain('当前失败类型不适合 AI 纠错');
    expect(message).toContain('缺少运行前变量');
  });

  it('does not block repair for script failures', () => {
    const message = buildExecutionRepairBlockedMessage({
      status: 'failed',
      resultSummary: '执行失败（失败步骤 1）',
      errorMessage: 'expect(locator).toBeVisible() failed',
    });

    expect(message).toBeNull();
  });
});
