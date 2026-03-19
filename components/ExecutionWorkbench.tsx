'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BrowserView from '@/components/BrowserView';
import type { IntentImportStatus } from '@/lib/intent-e2e-import';
import {
  buildIntentCapabilityPreset,
  buildIntentCapabilityWorkbenchHref,
  createIntentCapabilityLaunchToken,
  stashIntentCapabilityPreset,
} from '@/lib/intent-capability-preset';
import { type FlowDefinition, type TaskMode } from '@/lib/task-flow';

type ExecutionStatus = 'queued' | 'running' | 'passed' | 'failed' | 'canceled';

type ConversationItem = {
  conversationUid: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  messageType: 'thinking' | 'code' | 'status' | 'error';
  content: string;
  createdAt: string;
};

type EventItem = {
  eventType: string;
  payload: unknown;
  createdAt: string;
};

type ArtifactItem = {
  artifactType: string;
  storagePath: string;
  meta: unknown;
  createdAt: string;
};

type ExecutionDetail = {
  execution: {
    executionUid: string;
    planUid: string;
    configUid: string;
    projectUid: string;
    status: ExecutionStatus;
    startedAt: string;
    endedAt: string;
    durationMs: number;
    resultSummary: string;
    errorMessage: string;
    workerSessionId: string;
    createdAt: string;
  };
  plan: {
    planUid: string;
    planTitle: string;
    planVersion: number;
    planSummary: string;
  } | null;
  config: {
    configUid: string;
    projectUid: string;
    moduleUid: string;
    moduleName: string;
    name: string;
    targetUrl: string;
    featureDescription: string;
    taskMode: TaskMode;
    flowDefinition: FlowDefinition | null;
    authSource: 'project' | 'task' | 'none';
  } | null;
  project: {
    projectUid: string;
    name: string;
  } | null;
  planCases: Array<{ caseUid: string; tier: string; caseName: string; expectedResult: string }>;
  events: EventItem[];
  conversations: ConversationItem[];
  artifacts: ArtifactItem[];
  intentImport: {
    importedFromRunId: string;
    importedStatus: IntentImportStatus | '';
    importedAt: string;
  } | null;
};

function statusTone(status: ExecutionStatus): string {
  switch (status) {
    case 'passed':
      return 'bg-emerald-100 text-emerald-700';
    case 'failed':
      return 'bg-rose-100 text-rose-700';
    case 'running':
      return 'bg-amber-100 text-amber-700';
    case 'queued':
      return 'bg-zinc-100 text-zinc-700';
    default:
      return 'bg-zinc-200 text-zinc-700';
  }
}

function messageTone(kind: ConversationItem['messageType']): string {
  if (kind === 'error') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (kind === 'status') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (kind === 'thinking') return 'border-sky-200 bg-sky-50 text-sky-800';
  return 'border-zinc-200 bg-zinc-50 text-zinc-700';
}

function intentImportTone(status?: IntentImportStatus | '' | string): string {
  return status === 'failed' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700';
}

function intentImportPanelTone(status?: IntentImportStatus | '' | string): string {
  return status === 'failed'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : 'border-violet-200 bg-violet-50 text-violet-900';
}

function intentImportLabel(status?: IntentImportStatus | '' | string): string {
  if (status === 'failed') return 'Intent 导入失败';
  if (status === 'passed') return 'Intent 导入通过';
  return 'Intent 导入';
}

function formatMoment(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function ExecutionWorkbench({ executionUid }: { executionUid: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [error, setError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const autoRepairFollowedRef = useRef('');

  const loadDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/test-executions/${executionUid}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载执行详情失败');
      setDetail(json);
      setEvents(json.events || []);
      setConversations(json.conversations || []);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    }
  }, [executionUid]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    autoRepairFollowedRef.current = '';
  }, [executionUid]);

  useEffect(() => {
    const es = new EventSource(`/api/test-executions/${executionUid}/stream`);
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as EventItem;
        if (data.eventType === 'connected') return;
        setEvents((prev) => {
          const next = [...prev, data];
          if (next.length > 600) return next.slice(next.length - 600);
          return next;
        });
        if (data.eventType === 'status') {
          void loadDetail();
        }
      } catch {
        // ignore malformed event
      }
    };
    es.onerror = () => {
      // Keep native EventSource reconnection; delayed auto-repair status may
      // arrive after the execution itself is already marked failed.
    };

    return () => {
      es.close();
    };
  }, [executionUid, loadDetail]);

  useEffect(() => {
    if (!detail) return;
    const latestAutoRepairStatus = [...events].reverse().find((item) => item.eventType === 'status');
    const autoRepairPending =
      latestAutoRepairStatus &&
      typeof (latestAutoRepairStatus.payload as Record<string, unknown> | null)?.status === 'string' &&
      String((latestAutoRepairStatus.payload as Record<string, unknown>).status) === 'auto_repair_pending';
    if (detail.execution.status !== 'running' && detail.execution.status !== 'queued' && !autoRepairPending) return;
    const timer = setInterval(() => {
      void loadDetail();
    }, 3000);
    return () => clearInterval(timer);
  }, [detail, events, loadDetail]);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/conversations?scene=plan_execution&refUid=${executionUid}`);
        const json = await res.json();
        if (res.ok) {
          setConversations(json.items || []);
        }
      } catch {
        // ignore polling error
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [executionUid]);

  const frameCount = useMemo(() => events.filter((e) => e.eventType === 'frame').length, [events]);
  const autoRepairFollowUp = useMemo(() => {
    for (const event of [...events].reverse()) {
      if (event.eventType !== 'status') continue;
      const payload = (event.payload || {}) as Record<string, unknown>;
      const status = String(payload.status || '');
      if (!status.startsWith('auto_repair_')) continue;
      return {
        status,
        summary: String(payload.summary || ''),
        nextExecutionUid: typeof payload.nextExecutionUid === 'string' ? payload.nextExecutionUid : '',
        nextRunPath: typeof payload.nextRunPath === 'string' ? payload.nextRunPath : '',
        remainingRetries: typeof payload.remainingRetries === 'number' ? payload.remainingRetries : null,
      };
    }
    return null;
  }, [events]);
  const capabilityLaunch = useMemo(() => {
    const config = detail?.config;
    const project = detail?.project;
    if (!config || !project) return null;

    const preset = buildIntentCapabilityPreset({
      sourceLabel: `执行「${config.name}」`,
      name: config.name,
      targetUrl: config.targetUrl,
      featureDescription: config.featureDescription,
      taskMode: config.taskMode,
      flowDefinition: config.flowDefinition,
      authSource: config.authSource,
    });
    const token = createIntentCapabilityLaunchToken({
      projectUid: project.projectUid,
      preset,
    });

    return {
      preset,
      token,
      href: buildIntentCapabilityWorkbenchHref({
        projectUid: project.projectUid,
        moduleUid: config.moduleUid,
        token,
      }),
    };
  }, [detail?.config, detail?.project]);

  useEffect(() => {
    if (!autoRepairFollowUp?.nextRunPath || autoRepairFollowUp.status !== 'auto_repair_started') return;
    const followKey = `${executionUid}:${autoRepairFollowUp.nextExecutionUid || autoRepairFollowUp.nextRunPath}`;
    if (autoRepairFollowedRef.current === followKey) return;
    autoRepairFollowedRef.current = followKey;
    if (typeof window !== 'undefined') {
      const storageKey = `execution:auto-repair-followed:${executionUid}`;
      if (window.sessionStorage.getItem(storageKey) === followKey) return;
      window.sessionStorage.setItem(storageKey, followKey);
    }
    setActionNotice(`自动修复已启动，正在跳转到新执行 ${autoRepairFollowUp.nextExecutionUid || ''}`.trim());
    const timer = window.setTimeout(() => {
      router.push(autoRepairFollowUp.nextRunPath);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [autoRepairFollowUp, executionUid, router]);

  const downloadGeneratedSpec = () => {
    if (!generatedSpec) return;
    const meta = (generatedSpec.meta || {}) as Record<string, unknown>;
    const content = typeof meta.content === 'string' ? meta.content : '';
    if (!content) return;
    const fileNameRaw =
      (typeof meta.fileName === 'string' && meta.fileName) ||
      generatedSpec.storagePath.split('/').pop() ||
      `${executionUid}.spec.ts`;
    const fileName = fileNameRaw.replace(/\s+/g, '-');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!detail) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
        {error || '正在加载执行详情...'}
      </div>
    );
  }

  const { execution, plan, config, project, artifacts } = detail;
  const screencastActive = execution.status === 'queued' || execution.status === 'running';
  const generatedSpec = artifacts.find((item) => item.artifactType === 'generated_spec');

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_6px_24px_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Execution</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-zinc-900">执行工作台</h1>
              {detail.intentImport && (
                <span className={`rounded-md px-2.5 py-1 text-xs ${intentImportTone(detail.intentImport.importedStatus)}`}>
                  {intentImportLabel(detail.intentImport.importedStatus)}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {project?.name ? `${project.name} / ` : ''}{config?.name || execution.executionUid}
            </p>
            {actionNotice && <p className="mt-2 text-xs text-blue-600">{actionNotice}</p>}
          </div>
          <div className="text-right">
            <span className={`rounded-md px-2.5 py-1 text-xs ${statusTone(execution.status)}`}>{execution.status}</span>
            <p className="mt-2 text-xs text-zinc-500">计划: {plan?.planTitle || execution.planUid}</p>
            <p className="text-xs text-zinc-400">版本: v{plan?.planVersion || '-'}</p>
          </div>
        </div>
        {autoRepairFollowUp?.summary && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p>{autoRepairFollowUp.summary}</p>
            {autoRepairFollowUp.nextRunPath && (
              <div className="mt-2">
                <Link
                  href={autoRepairFollowUp.nextRunPath}
                  className="inline-flex items-center rounded-md border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100"
                >
                  查看自动修复后的新执行
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="min-h-[560px] rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_6px_20px_rgba(0,0,0,0.04)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-zinc-900">执行中的 LLM 对话</h2>
            <div className="flex items-center gap-2">
              {execution.status === 'passed' && capabilityLaunch && (
                <Link
                  href={capabilityLaunch.href}
                  onClick={() => {
                    stashIntentCapabilityPreset(capabilityLaunch.token, capabilityLaunch.preset);
                  }}
                  className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                >
                  沉淀为稳定能力
                </Link>
              )}
              <span className="text-xs text-zinc-500">{conversations.length} 条</span>
            </div>
          </div>
          <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
            {conversations.length === 0 && <p className="text-sm text-zinc-400">暂无对话内容</p>}
            {conversations.map((item) => (
              <div key={item.conversationUid} className={`rounded-lg border px-3 py-2 text-sm ${messageTone(item.messageType)}`}>
                <div className="mb-1 flex items-center justify-between text-xs opacity-70">
                  <span>{item.role}</span>
                  <span>{new Date(item.createdAt).toLocaleTimeString('zh-CN')}</span>
                </div>
                <p className="whitespace-pre-wrap break-words">{item.content}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {detail.intentImport && (
            <div className={`rounded-2xl border p-5 shadow-[0_6px_20px_rgba(0,0,0,0.04)] ${intentImportPanelTone(detail.intentImport.importedStatus)}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">执行来源</h2>
                <span className={`rounded-md px-2 py-1 text-[11px] ${intentImportTone(detail.intentImport.importedStatus)}`}>
                  {intentImportLabel(detail.intentImport.importedStatus)}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 opacity-80">
                这条执行历史由 Intent E2E 工作台导入，用于把自然语言测试结果沉淀到项目工作台。
              </p>
              <div className="mt-3 rounded-xl border border-current/10 bg-white/70 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.16em] opacity-60">来源 Run ID</p>
                <p className="mt-1 break-all font-mono text-[11px] leading-5" title={detail.intentImport.importedFromRunId}>
                  {detail.intentImport.importedFromRunId}
                </p>
              </div>
              {detail.intentImport.importedAt && (
                <p className="mt-2 text-[11px] opacity-70">导入时间：{formatMoment(detail.intentImport.importedAt)}</p>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_6px_20px_rgba(0,0,0,0.04)]">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">浏览器实时画面</h2>
              <span className="text-xs text-zinc-500">帧事件: {frameCount}</span>
            </div>
            <BrowserView sessionId={execution.workerSessionId} isActive={screencastActive} hideHeader compact />
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_6px_20px_rgba(0,0,0,0.04)]">
            <h2 className="mb-2 text-base font-semibold text-zinc-900">执行事件</h2>
            <div className="max-h-[240px] space-y-1 overflow-y-auto text-xs text-zinc-600">
              {events.slice(-80).map((event, idx) => (
                <div key={`${event.createdAt}-${idx}`} className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1">
                  <p className="font-medium text-zinc-700">[{event.eventType}] {new Date(event.createdAt).toLocaleTimeString('zh-CN')}</p>
                  <p className="mt-0.5 break-all text-zinc-500">{JSON.stringify(event.payload)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_6px_20px_rgba(0,0,0,0.04)]">
        <h2 className="mb-3 text-base font-semibold text-zinc-900">计划用例层级</h2>
        {detail.planCases.length === 0 && <p className="text-sm text-zinc-400">暂无用例详情</p>}
        {detail.planCases.length > 0 && (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {detail.planCases.map((c) => (
              <div key={c.caseUid} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">{c.tier}</p>
                <p className="mt-1 text-sm font-medium text-zinc-800">{c.caseName}</p>
                <p className="mt-1 text-xs text-zinc-500">{c.expectedResult}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_6px_20px_rgba(0,0,0,0.04)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">执行产物</h2>
          <button
            onClick={downloadGeneratedSpec}
            disabled={!generatedSpec}
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 disabled:opacity-50"
          >
            下载本次脚本
          </button>
        </div>
        {artifacts.length === 0 && <p className="text-sm text-zinc-400">暂无产物</p>}
        {artifacts.length > 0 && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {artifacts.map((artifact, idx) => (
              <div key={`${artifact.storagePath}-${idx}`} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs">
                <p className="font-medium text-zinc-700">{artifact.artifactType}</p>
                <p className="mt-1 break-all text-zinc-500">{artifact.storagePath}</p>
                <p className="mt-1 text-zinc-400">{new Date(artifact.createdAt).toLocaleString('zh-CN')}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
