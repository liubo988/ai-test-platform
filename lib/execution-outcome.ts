export type ExecutionOutcomeKind =
  | 'passed'
  | 'queued'
  | 'running'
  | 'canceled'
  | 'missing_prerequisite'
  | 'skipped_failure'
  | 'queue_timeout'
  | 'worker_timeout'
  | 'script_failure'
  | 'failed';

export type ExecutionOutcomeTone = 'emerald' | 'slate' | 'amber' | 'rose';

export type ExecutionOutcomeInput = {
  status?: string;
  resultSummary?: string;
  errorMessage?: string;
};

export type ExecutionOutcomeDescriptor = {
  kind: ExecutionOutcomeKind;
  status: string;
  shortLabel: string;
  title: string;
  summary: string;
  detail: string;
  hint: string;
  tone: ExecutionOutcomeTone;
  repairRecommended: boolean;
  isFailure: boolean;
};

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function describeExecutionOutcome(input: ExecutionOutcomeInput): ExecutionOutcomeDescriptor {
  const status = trimmed(input.status).toLowerCase() || 'unknown';
  const summary = trimmed(input.resultSummary);
  const detail = trimmed(input.errorMessage);
  const combined = `${summary}\n${detail}`;

  if (status === 'passed') {
    return {
      kind: 'passed',
      status,
      shortLabel: '通过',
      title: '执行通过',
      summary: summary || '执行成功',
      detail,
      hint: '测试脚本已按预期完成，可继续查看日志或沉淀为稳定能力。',
      tone: 'emerald',
      repairRecommended: false,
      isFailure: false,
    };
  }

  if (status === 'running') {
    return {
      kind: 'running',
      status,
      shortLabel: '执行中',
      title: '执行中',
      summary: summary || '执行正在进行中',
      detail,
      hint: '日志、浏览器实时画面和步骤状态会持续刷新。',
      tone: 'amber',
      repairRecommended: false,
      isFailure: false,
    };
  }

  if (status === 'queued') {
    return {
      kind: 'queued',
      status,
      shortLabel: '排队中',
      title: '等待执行',
      summary: summary || '执行已入队，等待 worker 接管',
      detail,
      hint: '如果长时间停留在排队中，优先检查执行队列和 worker 是否健康。',
      tone: 'slate',
      repairRecommended: false,
      isFailure: false,
    };
  }

  if (status === 'canceled') {
    return {
      kind: 'canceled',
      status,
      shortLabel: '已取消',
      title: '执行已取消',
      summary: summary || '执行已被取消',
      detail,
      hint: '本次执行被中断，没有产出完整验证结果。',
      tone: 'slate',
      repairRecommended: false,
      isFailure: false,
    };
  }

  if (/^跳过:/u.test(detail)) {
    if (/(缺少 E2E_|请先设置 E2E_|检测到登录页|当前页面需要登录)/u.test(combined)) {
      return {
        kind: 'missing_prerequisite',
        status,
        shortLabel: '缺少前置变量',
        title: '缺少运行前变量',
        summary: summary || '执行失败（前置条件不足）',
        detail,
        hint: '先补齐运行前变量、登录凭证或上游步骤提取值后再重跑；AI 纠错不能补出缺失输入。',
        tone: 'amber',
        repairRecommended: false,
        isFailure: true,
      };
    }

    return {
      kind: 'skipped_failure',
      status,
      shortLabel: '前置条件不足',
      title: '执行被前置条件拦截',
      summary: summary || '执行失败（前置条件不足）',
      detail,
      hint: '这类失败通常不是脚本写错，而是测试数据、登录态或任务前提没有满足，先补条件再重跑。',
      tone: 'amber',
      repairRecommended: false,
      isFailure: true,
    };
  }

  if (/执行未启动：排队状态超时|排队超时/u.test(combined)) {
    return {
      kind: 'queue_timeout',
      status,
      shortLabel: '排队超时',
      title: '执行未被 worker 接管',
      summary: summary || '执行失败（排队超时）',
      detail,
      hint: '这不是脚本本身的断言失败。优先检查执行队列、服务进程或 worker 是否可用，再重新执行。',
      tone: 'amber',
      repairRecommended: false,
      isFailure: true,
    };
  }

  if (/执行超时：worker 无响应|执行失败（执行超时）/u.test(combined)) {
    return {
      kind: 'worker_timeout',
      status,
      shortLabel: '执行超时',
      title: 'worker 执行超时',
      summary: summary || '执行失败（执行超时）',
      detail,
      hint: '先看失败前最后几条日志和页面状态，确认是站点卡住、登录阻塞还是脚本等待点有问题；再决定是否做 AI 纠错。',
      tone: 'amber',
      repairRecommended: true,
      isFailure: true,
    };
  }

  if (detail) {
    return {
      kind: 'script_failure',
      status,
      shortLabel: '脚本失败',
      title: '脚本执行失败',
      summary: summary || '执行失败',
      detail,
      hint: '优先看失败步骤、locator、等待顺序和断言，再决定是否发起 AI 纠错。',
      tone: 'rose',
      repairRecommended: true,
      isFailure: true,
    };
  }

  return {
    kind: 'failed',
    status,
    shortLabel: '执行失败',
    title: '执行失败',
    summary: summary || '执行失败',
    detail,
    hint: '请先查看执行日志和失败步骤，确认是环境问题还是脚本问题。',
    tone: 'rose',
    repairRecommended: true,
    isFailure: true,
  };
}

export function buildExecutionRepairBlockedMessage(input: ExecutionOutcomeInput): string | null {
  const outcome = describeExecutionOutcome(input);
  if (outcome.status !== 'failed' || outcome.repairRecommended) {
    return null;
  }

  return `当前失败类型不适合 AI 纠错：${outcome.title}。${outcome.hint}`;
}
