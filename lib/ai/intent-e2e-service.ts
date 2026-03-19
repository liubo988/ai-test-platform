import { analyzePage, precheckPageAccess, type AuthConfig, type PageAccessPrecheckReadyResult } from '@/lib/page-analyzer';
import { executeTest, type TestResult } from '@/lib/test-executor';
import { generateTest, repairTest, type GenerateEvent } from '@/lib/test-generator';
import { getLLMRuntimeConfig, type LLMRuntimeOverrides } from '@/lib/llm/provider-config';
import { buildGenerateInputFromScenarioCard, generateScenarioCard, type ScenarioAttachment, type ScenarioCard } from '@/lib/ai/scenario-card';
import { listRelevantIntentRepairHints, recordIntentRepairFailure, recordIntentRepairResolution } from '@/lib/ai/intent-repair-memory';
import {
  classifyIntentE2EFailure,
  formatIntentE2EFailureTriage,
  type IntentE2EFailureTriage,
} from '@/lib/ai/intent-e2e-failure-triage';

export interface IntentE2ERunRequest {
  input: string;
  targetUrl?: string;
  projectUid?: string;
  auth?: AuthConfig;
  attachments?: ScenarioAttachment[];
  llmConfig?: LLMRuntimeOverrides;
}

export interface IntentE2EAttempt {
  attempt: number;
  kind: 'generate' | 'repair';
  sessionId?: string;
  code: string;
  events: GenerateEvent[];
  logs: Array<{ level: string; message: string; at?: string }>;
  result: TestResult;
  triage?: IntentE2EFailureTriage | null;
}

export interface IntentE2ERunResult {
  scenarioCard: ScenarioCard;
  llmMeta: {
    provider: string;
    model: string;
    visionEnabled: boolean;
    attachmentCount: number;
  };
  targetUrl: string;
  description: string;
  attempts: IntentE2EAttempt[];
  finalResult: TestResult;
  finalFailureTriage?: IntentE2EFailureTriage | null;
}

export interface IntentE2ERunOptions {
  signal?: AbortSignal;
}

export type IntentE2EStreamStage =
  | 'received'
  | 'planning'
  | 'prechecking'
  | 'analyzing'
  | 'generating'
  | 'executing'
  | 'repairing'
  | 'completed'
  | 'canceled'
  | 'error';

export type IntentE2EStreamEvent =
  | {
      type: 'stage';
      stage: IntentE2EStreamStage;
      message: string;
      attempt?: number;
      kind?: IntentE2EAttempt['kind'];
    }
  | {
      type: 'scenario_card';
      scenarioCard: ScenarioCard;
      llmMeta: IntentE2ERunResult['llmMeta'];
    }
  | {
      type: 'description';
      targetUrl: string;
      description: string;
    }
  | {
      type: 'attempt_started';
      attempt: number;
      kind: IntentE2EAttempt['kind'];
    }
  | {
      type: 'attempt_event';
      attempt: number;
      kind: IntentE2EAttempt['kind'];
      event: GenerateEvent;
    }
  | {
      type: 'attempt_execution_started';
      attempt: number;
      kind: IntentE2EAttempt['kind'];
      sessionId: string;
    }
  | {
      type: 'attempt_step';
      attempt: number;
      kind: IntentE2EAttempt['kind'];
      step: TestResult['steps'][number];
    }
  | {
      type: 'attempt_log';
      attempt: number;
      kind: IntentE2EAttempt['kind'];
      log: IntentE2EAttempt['logs'][number];
    }
  | ({
      type: 'attempt_result';
    } & IntentE2EAttempt)
  | {
      type: 'final_result';
      result: IntentE2ERunResult;
    }
  | {
      type: 'error';
      message: string;
    };

export type IntentE2EStreamListener = (event: IntentE2EStreamEvent) => void | Promise<void>;

function createAbortError(message = '当前自动测试已取消'): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal, message?: string): void {
  if (!signal?.aborted) return;
  throw createAbortError(message || '当前自动测试已取消');
}

async function emit(listener: IntentE2EStreamListener | undefined, event: IntentE2EStreamEvent): Promise<void> {
  if (!listener) return;
  await listener(event);
}

function emitBackground(listener: IntentE2EStreamListener | undefined, event: IntentE2EStreamEvent): void {
  if (!listener) return;
  void Promise.resolve(listener(event)).catch(() => {});
}

async function collectGeneratedCode(
  stream: AsyncGenerator<GenerateEvent>,
  onEvent?: (event: GenerateEvent) => void | Promise<void>,
  signal?: AbortSignal
): Promise<{ code: string; events: GenerateEvent[] }> {
  const events: GenerateEvent[] = [];
  let generatedCode = '';
  let completedCode = '';
  let lastError = '';

  throwIfAborted(signal);

  for await (const event of stream) {
    throwIfAborted(signal);
    events.push(event);
    if (onEvent) await onEvent(event);

    if (event.type === 'code') {
      generatedCode += event.content;
      continue;
    }
    if (event.type === 'complete') {
      completedCode = event.content;
      continue;
    }
    if (event.type === 'error') {
      lastError = event.content.trim() || lastError;
    }
  }

  throwIfAborted(signal);

  const code = completedCode.trim() || generatedCode.trim();
  if (!code) {
    throw new Error(lastError || 'AI 未生成可执行脚本');
  }

  return { code, events };
}

function buildRepairEvents(result: TestResult, logs: Array<{ level: string; message: string }>): string[] {
  const stepLines = result.steps.map((step) => `${step.status.toUpperCase()} ${step.title}${step.error ? `: ${step.error}` : ''}`);
  const logLines = logs.slice(-12).map((item) => `${item.level.toUpperCase()} ${item.message}`);
  return [...stepLines, ...logLines].slice(-20);
}

function createSessionId(): string {
  return `intent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createTerminalFailureResult(stepTitle: string, errorMessage: string): TestResult {
  const message = errorMessage.trim() || 'AI 意图驱动 E2E 执行失败';
  return {
    success: false,
    duration: 0,
    steps: [
      {
        title: stepTitle,
        status: 'failed',
        duration: 0,
        error: message,
        at: new Date().toISOString(),
      },
    ],
    error: message,
  };
}

async function emitFinalRunState(listener: IntentE2EStreamListener | undefined, output: IntentE2ERunResult): Promise<void> {
  const finalFailureTriage = output.finalResult.success ? null : output.finalFailureTriage ?? null;

  await emit(listener, {
    type: 'stage',
    stage: 'completed',
    message:
      output.finalResult.success
        ? '自动测试已完成，最终结果：通过。'
        : finalFailureTriage
        ? formatIntentE2EFailureTriage(finalFailureTriage)
        : '自动测试已结束，但暂未完全通过。',
  });

  await emit(listener, {
    type: 'final_result',
    result: output,
  });
}

type IntentE2EPrecheckResult =
  | {
      blocked: false;
      precheck: PageAccessPrecheckReadyResult;
    }
  | {
      blocked: true;
      output: IntentE2ERunResult;
    };

async function runIntentE2EPrecheck(
  input: {
    targetUrl: string;
    description: string;
    auth?: AuthConfig;
    scenarioCard: ScenarioCard;
    llmMeta: IntentE2ERunResult['llmMeta'];
  },
  listener?: IntentE2EStreamListener,
  signal?: AbortSignal
): Promise<IntentE2EPrecheckResult> {
  throwIfAborted(signal);
  await emit(listener, {
    type: 'stage',
    stage: 'prechecking',
    message: '正在执行目标页面前置检查（页面可达性 / 登录态）…',
  });

  try {
    const precheck = await precheckPageAccess(input.targetUrl, input.auth);
    throwIfAborted(signal);
    if (precheck.status === 'blocked') {
      const finalResult = createTerminalFailureResult('前置检查', precheck.message);
      const finalFailureTriage = classifyIntentE2EFailure(
        finalResult,
        precheck.matchedSignals.map((signal) => ({ level: 'error', message: signal }))
      );
      const output: IntentE2ERunResult = {
        scenarioCard: input.scenarioCard,
        llmMeta: input.llmMeta,
        targetUrl: input.targetUrl,
        description: input.description,
        attempts: [],
        finalResult,
        finalFailureTriage,
      };

      await emitFinalRunState(listener, output);
      return {
        blocked: true,
        output,
      };
    }

    return {
      blocked: false,
      precheck,
    };
  } catch (error: unknown) {
    throwIfAborted(signal);

    const finalResult = createTerminalFailureResult('前置检查', error instanceof Error ? error.message : '页面前置检查失败');
    const finalFailureTriage = classifyIntentE2EFailure(finalResult, []);
    const output: IntentE2ERunResult = {
      scenarioCard: input.scenarioCard,
      llmMeta: input.llmMeta,
      targetUrl: input.targetUrl,
      description: input.description,
      attempts: [],
      finalResult,
      finalFailureTriage,
    };

    await emitFinalRunState(listener, output);
    return {
      blocked: true,
      output,
    };
  }
}

export async function runIntentDrivenE2EStream(
  input: IntentE2ERunRequest,
  listener?: IntentE2EStreamListener,
  options?: IntentE2ERunOptions
): Promise<IntentE2ERunResult> {
  const signal = options?.signal;
  const trimmedInput = input.input.trim();
  if (!trimmedInput) {
    throw new Error('请至少提供一句测试目标描述');
  }

  throwIfAborted(signal);
  await emit(listener, {
    type: 'stage',
    stage: 'planning',
    message: '正在把自然语言整理成 ScenarioCard…',
  });

  const scenarioCardOutput = await generateScenarioCard(
    {
      input: trimmedInput,
      targetUrlHint: input.targetUrl,
      attachments: input.attachments,
    },
    input.llmConfig,
    signal
  );

  throwIfAborted(signal);
  await emit(listener, {
    type: 'scenario_card',
    scenarioCard: scenarioCardOutput.card,
    llmMeta: scenarioCardOutput.llmMeta,
  });

  const { targetUrl, description, context } = buildGenerateInputFromScenarioCard(scenarioCardOutput.card);
  if (!targetUrl) {
    throw new Error('AI 已生成 ScenarioCard，但未能确定目标 URL；请在请求中补充 targetUrl');
  }

  await emit(listener, {
    type: 'description',
    targetUrl,
    description,
  });

  const precheck = await runIntentE2EPrecheck(
    {
      targetUrl,
      description,
      auth: input.auth,
      scenarioCard: scenarioCardOutput.card,
      llmMeta: scenarioCardOutput.llmMeta,
    },
    listener,
    signal
  );
  if (precheck.blocked) {
    return precheck.output;
  }

  await emit(listener, {
    type: 'stage',
    stage: 'analyzing',
    message: '前置检查通过，正在整理页面结构并收集执行上下文…',
  });

  const snapshot = await analyzePage(targetUrl, input.auth, {
    storageState: precheck.precheck.storageState,
  });
  throwIfAborted(signal);

  const attempts: IntentE2EAttempt[] = [];
  const runtimeConfig = getLLMRuntimeConfig(input.llmConfig);
  const observedRepairClusterIds = new Set<string>();

  let currentCode = '';
  let finalResult: TestResult | null = null;
  let finalFailureTriage: IntentE2EFailureTriage | null = null;

  for (let attemptIndex = 0; attemptIndex <= runtimeConfig.selfHealRetries; attemptIndex += 1) {
    throwIfAborted(signal);

    const attempt = attemptIndex + 1;
    const kind: IntentE2EAttempt['kind'] = attemptIndex === 0 ? 'generate' : 'repair';

    await emit(listener, {
      type: 'attempt_started',
      attempt,
      kind,
    });

    await emit(listener, {
      type: 'stage',
      stage: kind === 'generate' ? 'generating' : 'repairing',
      attempt,
      kind,
      message:
        kind === 'generate'
          ? '正在生成更稳定的 Playwright 测试脚本…'
          : `第 ${attempt} 次尝试：根据失败信息修复脚本…`,
    });

    const repairInput =
      kind === 'repair'
        ? {
            targetUrl,
            pageTitle: snapshot.title,
            description,
            executionError: finalResult?.error || '未知执行失败',
            previousCode: currentCode,
            recentEvents: buildRepairEvents(finalResult as TestResult, attempts[attempts.length - 1]?.logs || []),
          }
        : null;
    const repairMemoryHints = repairInput ? await listRelevantIntentRepairHints(repairInput) : [];

    if (repairMemoryHints.length > 0) {
      await emit(listener, {
        type: 'attempt_log',
        attempt,
        kind,
        log: {
          level: 'info',
          message: `已命中 ${repairMemoryHints.length} 条历史相似修复记忆，优先沿用已验证策略。`,
        },
      });
    }

    const generation =
      kind === 'generate'
        ? await collectGeneratedCode(
            generateTest(snapshot, description, input.auth, context, input.llmConfig, signal),
            (event) => emit(listener, { type: 'attempt_event', attempt, kind, event }),
            signal
          )
        : await collectGeneratedCode(
            repairTest(
              snapshot,
              description,
              {
                previousCode: repairInput?.previousCode || currentCode,
                executionError: repairInput?.executionError || '未知执行失败',
                recentEvents: repairInput?.recentEvents,
                repairMemoryHints,
              },
              input.auth,
              context,
              input.llmConfig,
              signal
            ),
            (event) => emit(listener, { type: 'attempt_event', attempt, kind, event }),
            signal
          );

    throwIfAborted(signal);
    currentCode = generation.code;
    const sessionId = createSessionId();

    await emit(listener, {
      type: 'attempt_execution_started',
      attempt,
      kind,
      sessionId,
    });

    await emit(listener, {
      type: 'stage',
      stage: 'executing',
      attempt,
      kind,
      message: `正在执行第 ${attempt} 次${kind === 'repair' ? '修复后' : ''}测试…`,
    });

    const logs: Array<{ level: string; message: string; at?: string }> = [];
    const result = await executeTest(currentCode, sessionId, input.auth, {
      signal,
      onStep(payload) {
        emitBackground(listener, {
          type: 'attempt_step',
          attempt,
          kind,
          step: {
            title: payload.title,
            status: payload.status,
            duration: payload.duration,
            error: payload.error,
            at: payload.at,
          },
        });
      },
      onLog(payload) {
        const logEntry = {
          level: payload.level,
          message: payload.message,
          at: payload.at,
        };

        logs.push(logEntry);
        emitBackground(listener, {
          type: 'attempt_log',
          attempt,
          kind,
          log: logEntry,
        });
      },
    });

    throwIfAborted(signal);
    const triage = result.success ? null : classifyIntentE2EFailure(result, logs);

    const attemptResult: IntentE2EAttempt = {
      attempt,
      kind,
      sessionId,
      code: currentCode,
      events: generation.events,
      logs,
      result,
      triage,
    };

    attempts.push(attemptResult);
    await emit(listener, {
      type: 'attempt_result',
      ...attemptResult,
    });

    if (triage) {
      await emit(listener, {
        type: 'attempt_log',
        attempt,
        kind,
        log: {
          level: triage.repairable ? 'warn' : 'error',
          message: formatIntentE2EFailureTriage(triage),
        },
      });
    }

    if (result.success) {
      if (observedRepairClusterIds.size > 0) {
        await recordIntentRepairResolution({
          clusterIds: [...observedRepairClusterIds],
          targetUrl,
          description,
          fixedCode: currentCode,
          finalResult: result,
        });
        observedRepairClusterIds.clear();
      }
    } else {
      finalFailureTriage = triage;

      if (triage && !triage.repairable) {
        finalResult = result;
        break;
      }

      const failureHint = await recordIntentRepairFailure({
        targetUrl,
        pageTitle: snapshot.title,
        description,
        executionError: result.error || '未知执行失败',
        previousCode: currentCode,
        recentEvents: buildRepairEvents(result, logs),
      });
      if (failureHint.clusterId) {
        observedRepairClusterIds.add(failureHint.clusterId);
      }
    }

    finalResult = result;
    if (result.success) break;
  }

  if (!finalResult) {
    throw new Error('执行链路未产出结果');
  }

  const output: IntentE2ERunResult = {
    scenarioCard: scenarioCardOutput.card,
    llmMeta: scenarioCardOutput.llmMeta,
    targetUrl,
    description,
    attempts,
    finalResult,
    finalFailureTriage: finalResult.success ? null : finalFailureTriage,
  };

  await emitFinalRunState(listener, output);
  return output;
}

export async function runIntentDrivenE2E(
  input: IntentE2ERunRequest,
  options?: IntentE2ERunOptions
): Promise<IntentE2ERunResult> {
  return runIntentDrivenE2EStream(input, undefined, options);
}
