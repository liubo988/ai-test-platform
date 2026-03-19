import type { TestResult } from '@/lib/test-executor';

export type IntentE2EFailureClass =
  | 'env_transient'
  | 'auth_failed'
  | 'permission_blocked'
  | 'data_missing'
  | 'selector_drift'
  | 'assertion_too_strict'
  | 'workflow_gap'
  | 'unknown';

export interface IntentE2EFailureTriage {
  failureClass: IntentE2EFailureClass;
  repairable: boolean;
  summary: string;
  matchedSignals: string[];
}

type SignalRule = {
  signal: string;
  pattern: RegExp;
};

type TriageRule = {
  failureClass: IntentE2EFailureClass;
  repairable: boolean;
  summary: string;
  signals: SignalRule[];
};

const TRIAGE_RULES: TriageRule[] = [
  {
    failureClass: 'auth_failed',
    repairable: false,
    summary: '判定为认证阻塞：登录流程或会话状态异常，本次不继续自动修复脚本。',
    signals: [
      { signal: '登录页停留', pattern: /登录后(?:再次访问目标页面)?仍停留在登录页/i },
      { signal: '登录页不可识别', pattern: /未能进入可识别的登录页/i },
      { signal: '缺少统一登录账号', pattern: /缺少\s*e2e_username/i },
      { signal: '缺少统一登录密码', pattern: /缺少\s*e2e_password/i },
      { signal: '登录说明或凭证异常', pattern: /请检查登录说明或凭证/i },
      { signal: '需要重新登录', pattern: /未登录|请先登录|登录已失效|session expired/i },
      { signal: '跳回登录页', pattern: /login page|sign in/i },
    ],
  },
  {
    failureClass: 'permission_blocked',
    repairable: false,
    summary: '判定为权限阻塞：当前账号似乎无权限访问目标内容，本次不继续自动修复脚本。',
    signals: [
      { signal: '无权限', pattern: /无权限|暂无权限|权限不足/i },
      { signal: '403', pattern: /\b403\b|forbidden|access denied/i },
      { signal: '权限拦截页', pattern: /没有权限|permission denied/i },
    ],
  },
  {
    failureClass: 'env_transient',
    repairable: false,
    summary: '判定为环境阻塞：检测到服务或网络异常，本次不继续自动修复脚本。',
    signals: [
      { signal: '服务开小差', pattern: /服务开小差|服务异常|系统繁忙/i },
      { signal: '稍后重试', pattern: /稍后重试|请稍后再试|稍后再试/i },
      { signal: '接口暂时异常', pattern: /接口(?:暂时)?异常|请求失败|response error/i },
      { signal: '网关错误', pattern: /\b502\b|\b503\b|\b504\b|bad gateway|service unavailable|gateway timeout/i },
      { signal: '网络连接异常', pattern: /econnreset|econnrefused|net::err|network error|连接重置|连接失败/i },
      { signal: '上游超时', pattern: /upstream timeout|timed out while waiting for response/i },
    ],
  },
  {
    failureClass: 'data_missing',
    repairable: false,
    summary: '判定为数据阻塞：页面缺少目标数据或查询结果为空，本次不继续自动修复脚本。',
    signals: [
      { signal: '暂无数据', pattern: /暂无数据|暂无相关数据|无数据/i },
      { signal: '查询为空', pattern: /未查询到|查询结果为空|搜索结果为空|没有搜索结果/i },
      { signal: '未找到记录', pattern: /未找到(?:任何)?记录|找不到目标数据|没有匹配数据/i },
      { signal: '未返回服务数据', pattern: /未返回任何(?:服务)?数据|当前未返回任何(?:服务)?数据/i },
      { signal: '空状态页', pattern: /空状态|empty state|列表为空/i },
    ],
  },
  {
    failureClass: 'assertion_too_strict',
    repairable: true,
    summary: '判定为断言过严：页面动作可能已经完成，但当前成功判定不够稳，继续自动修复脚本。',
    signals: [
      { signal: 'expect toBeTruthy', pattern: /expect\(received\)\.toBeTruthy\(\)|received:\s*false/i },
      { signal: 'expect matcher failed', pattern: /expect\((?:locator|received)[\s\S]*?\)\.[a-z]+/i },
      { signal: 'Expected/Received 对比', pattern: /expected:\s|received:\s/i },
      { signal: '可见性断言失败', pattern: /toBeVisible\(\)\s+failed|toBeHidden\(\)\s+failed|toHaveText\(\)\s+failed/i },
    ],
  },
  {
    failureClass: 'selector_drift',
    repairable: true,
    summary: '判定为定位器漂移：页面结构或可见性发生变化，继续自动修复脚本。',
    signals: [
      { signal: 'locator not found', pattern: /locator not found|waiting for locator|failed to find/i },
      { signal: 'locator API 失败', pattern: /locator\(|getByRole\(|getByText\(|getByPlaceholder\(/i },
      { signal: 'strict mode violation', pattern: /strict mode violation/i },
      { signal: '元素不可见', pattern: /element is not attached|element is outside of the viewport|received:\s*hidden/i },
      { signal: '行操作缺失', pattern: /未找到行操作|row action not found|未找到按钮/i },
    ],
  },
  {
    failureClass: 'workflow_gap',
    repairable: true,
    summary: '判定为流程缺口：当前脚本步骤编排不完整或顺序不对，继续自动修复脚本。',
    signals: [
      { signal: '业务流程缺口', pattern: /cannot read properties of null|is not a function|unexpected token/i },
      { signal: '页面切换缺口', pattern: /frame was detached|target page, context or browser has been closed/i },
      { signal: '步骤顺序不对', pattern: /before each|after each|navigation.*interrupted|execution context was destroyed/i },
    ],
  },
];

function collectFailureText(result: TestResult, logs: Array<{ level: string; message: string }>): string {
  return [
    result.error || '',
    ...result.steps.map((step) => step.error || ''),
    ...logs.map((log) => log.message || ''),
  ]
    .filter(Boolean)
    .join('\n');
}

function findMatchedSignals(source: string, signals: SignalRule[]): string[] {
  if (!source.trim()) return [];
  return signals.filter((signal) => signal.pattern.test(source)).map((signal) => signal.signal);
}

export function classifyIntentE2EFailure(
  result: TestResult,
  logs: Array<{ level: string; message: string }> = []
): IntentE2EFailureTriage | null {
  if (result.success) return null;

  const source = collectFailureText(result, logs);

  for (const rule of TRIAGE_RULES) {
    const matchedSignals = findMatchedSignals(source, rule.signals);
    if (matchedSignals.length === 0) continue;
    return {
      failureClass: rule.failureClass,
      repairable: rule.repairable,
      summary: rule.summary,
      matchedSignals,
    };
  }

  return {
    failureClass: 'unknown',
    repairable: true,
    summary: '暂未识别明确失败类型，先沿用自动修复策略。',
    matchedSignals: [],
  };
}

export function formatIntentE2EFailureTriage(triage: IntentE2EFailureTriage): string {
  return triage.matchedSignals.length > 0 ? `${triage.summary} 命中特征：${triage.matchedSignals.join('、')}` : triage.summary;
}
