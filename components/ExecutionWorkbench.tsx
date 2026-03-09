'use client';

import { useEffect, useMemo, useState } from 'react';
import BrowserView from '@/components/BrowserView';

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
  planCases: Array<{ caseUid: string; tier: string; caseName: string; expectedResult: string }>;
  events: EventItem[];
  conversations: ConversationItem[];
  artifacts: ArtifactItem[];
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

export default function ExecutionWorkbench({ executionUid }: { executionUid: string }) {
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [error, setError] = useState('');

  const loadDetail = async () => {
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
  };

  useEffect(() => {
    void loadDetail();
  }, [executionUid]);

  useEffect(() => {
    const es = new EventSource(`/api/test-executions/${executionUid}/stream`);
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as EventItem;
        if (data.eventType !== 'connected') {
          setEvents((prev) => {
            const next = [...prev, data];
            if (next.length > 600) return next.slice(next.length - 600);
            return next;
          });
        }
      } catch {
        // ignore malformed event
      }
    };
    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [executionUid]);

  useEffect(() => {
    if (!detail) return;
    if (detail.execution.status === 'running' || detail.execution.status === 'queued') {
      const timer = setInterval(() => {
        void loadDetail();
      }, 3000);
      return () => clearInterval(timer);
    }
    return;
  }, [detail]);

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

  const { execution, plan, artifacts } = detail;
  const generatedSpec = artifacts.find((item) => item.artifactType === 'generated_spec');

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_6px_24px_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Execution</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">执行工作台</h1>
            <p className="mt-1 text-sm text-zinc-500">任务: {execution.executionUid}</p>
          </div>
          <div className="text-right">
            <span className={`rounded-md px-2.5 py-1 text-xs ${statusTone(execution.status)}`}>{execution.status}</span>
            <p className="mt-2 text-xs text-zinc-500">计划: {plan?.planTitle || execution.planUid}</p>
            <p className="text-xs text-zinc-400">版本: v{plan?.planVersion || '-'}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="min-h-[560px] rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_6px_20px_rgba(0,0,0,0.04)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">执行中的 LLM 对话</h2>
            <span className="text-xs text-zinc-500">{conversations.length} 条</span>
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
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_6px_20px_rgba(0,0,0,0.04)]">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">浏览器实时画面</h2>
              <span className="text-xs text-zinc-500">帧事件: {frameCount}</span>
            </div>
            <BrowserView sessionId={execution.workerSessionId} isActive={execution.status === 'running'} hideHeader compact />
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
