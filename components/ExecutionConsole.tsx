'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    moduleUid: string;
    name: string;
    moduleName: string;
    targetUrl: string;
    featureDescription: string;
    authSource: 'project' | 'task' | 'none';
    loginDescription: string;
  } | null;
  project: {
    projectUid: string;
    name: string;
    authRequired: boolean;
    loginDescription: string;
  } | null;
  events: EventItem[];
  conversations: ConversationItem[];
  artifacts: ArtifactItem[];
};

function statusTone(status: ExecutionStatus): string {
  switch (status) {
    case 'passed':
      return 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/20';
    case 'failed':
      return 'bg-rose-500/12 text-rose-700 ring-rose-500/20';
    case 'running':
      return 'bg-amber-500/12 text-amber-700 ring-amber-500/20';
    case 'queued':
      return 'bg-slate-500/12 text-slate-700 ring-slate-500/20';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function messageTone(kind: ConversationItem['messageType']): string {
  if (kind === 'error') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (kind === 'status') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (kind === 'thinking') return 'border-sky-200 bg-sky-50 text-sky-800';
  return 'border-slate-200 bg-white text-slate-700';
}

function renderEventLine(event: EventItem): string {
  const payload = (event.payload || {}) as Record<string, unknown>;
  if (event.eventType === 'step') {
    return `${String(payload.title || '-')}: ${String(payload.status || '-')}${payload.error ? ` · ${String(payload.error)}` : ''}`;
  }
  if (event.eventType === 'log') {
    return `${String(payload.level || 'info')}: ${String(payload.message || '')}`;
  }
  if (event.eventType === 'status') {
    return `${String(payload.status || '-')}: ${String(payload.summary || '')}`;
  }
  return JSON.stringify(event.payload);
}

export default function ExecutionConsole({ executionUid }: { executionUid: string }) {
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [error, setError] = useState('');
  const [showEvents, setShowEvents] = useState(false);

  // Replay state
  const [replayMode, setReplayMode] = useState(false);
  const [replayFrames, setReplayFrames] = useState<number[]>([]);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [replayLoading, setReplayLoading] = useState(false);
  const replayCanvasRef = useRef<HTMLCanvasElement>(null);
  const replayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadReplayFrames = useCallback(async () => {
    setReplayLoading(true);
    try {
      const res = await fetch(`/api/execution-details/${executionUid}/frames`);
      const json = await res.json();
      if (res.ok && json.frames?.length > 0) {
        setReplayFrames(json.frames);
        setReplayIndex(0);
        setReplayMode(true);
        setReplayPlaying(true);
        renderReplayFrame(json.frames[0]);
      } else {
        setReplayFrames([]);
        alert('暂无可回放的帧数据');
      }
    } catch {
      alert('加载帧数据失败');
    } finally {
      setReplayLoading(false);
    }
  }, [executionUid]);

  function renderReplayFrame(frameNum: number) {
    const canvas = replayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = `/api/execution-details/${executionUid}/frames?frame=${frameNum}`;
  }

  useEffect(() => {
    if (replayMode && replayFrames.length > 0) {
      renderReplayFrame(replayFrames[replayIndex]);
    }
  }, [replayIndex, replayMode]);

  useEffect(() => {
    if (replayPlaying && replayFrames.length > 0) {
      const interval = Math.max(33, Math.round(100 / replaySpeed));
      replayTimerRef.current = setInterval(() => {
        setReplayIndex((prev) => {
          if (prev >= replayFrames.length - 1) {
            setReplayPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, interval);
    }
    return () => {
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    };
  }, [replayPlaying, replaySpeed, replayFrames.length]);

  async function loadDetail() {
    try {
      const res = await fetch(`/api/execution-details/${executionUid}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载执行详情失败');
      setDetail(json);
      setEvents(json.events || []);
      setConversations(json.conversations || []);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [executionUid]);

  useEffect(() => {
    const es = new EventSource(`/api/test-executions/${executionUid}/stream`);
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as EventItem;
        if (data.eventType === 'connected') return;
        setEvents((prev) => {
          const next = [...prev, data];
          return next.length > 600 ? next.slice(next.length - 600) : next;
        });
      } catch {
        // ignore malformed event
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [executionUid]);

  useEffect(() => {
    if (!detail) return;
    if (detail.execution.status !== 'running' && detail.execution.status !== 'queued') return;
    const timer = setInterval(() => {
      void loadDetail();
    }, 3000);
    return () => clearInterval(timer);
  }, [detail]);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/conversations?scene=plan_execution&refUid=${executionUid}`);
        const json = await res.json();
        if (res.ok) setConversations(json.items || []);
      } catch {
        // ignore polling error
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [executionUid]);

  const frameCount = useMemo(() => events.filter((item) => item.eventType === 'frame').length, [events]);
  const visibleEvents = useMemo(
    () => events.filter((item) => item.eventType !== 'frame').slice(-120),
    [events]
  );

  function downloadGeneratedSpec() {
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
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!detail) {
    return (
      <div className="rounded-[28px] border border-white/70 bg-white/80 p-6 text-sm text-slate-500 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        {error || '正在加载执行详情...'}
      </div>
    );
  }

  const { execution, plan, config, project, artifacts } = detail;
  const generatedSpec = artifacts.find((item) => item.artifactType === 'generated_spec');

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-white/70 bg-white/78 px-5 py-4 shadow-[0_16px_48px_rgba(15,23,42,0.10)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${statusTone(execution.status)}`}>
              {execution.status}
            </span>
            <h1 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">执行工作台</h1>
            <span className="text-sm text-slate-500">
              {project?.name ? `${project.name} / ` : ''}{config?.name || execution.configUid}
            </span>
            {config?.moduleName && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                {config.moduleName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>v{plan?.planVersion || '-'}</span>
              <span className="h-3 w-px bg-slate-200" />
              <span>{frameCount} 帧</span>
              <span className="h-3 w-px bg-slate-200" />
              <span>{execution.durationMs ? `${(execution.durationMs / 1000).toFixed(1)}s` : '-'}</span>
            </div>
            {project && (
              <Link
                href={`/projects/${project.projectUid}${config?.moduleUid ? `?module=${config.moduleUid}` : ''}`}
                className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
              >
                返回项目
              </Link>
            )}
          </div>
        </div>
        {(plan?.planSummary || execution.resultSummary) && (
          <p className="mt-2 text-sm leading-6 text-slate-500">{plan?.planSummary || execution.resultSummary}</p>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[3fr_7fr]">
        {/* 左侧：文字信息区 30% */}
        <div className="space-y-4">
          <section className="rounded-[24px] border border-white/70 bg-white/78 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-950">任务上下文</h2>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowEvents(!showEvents)}
                  className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-medium transition ${
                    showEvents ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  执行事件{visibleEvents.length > 0 && ` (${visibleEvents.length})`}
                </button>
                <button
                  onClick={downloadGeneratedSpec}
                  disabled={!generatedSpec}
                  className="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  下载脚本
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">目标 URL</p>
                <p className="mt-1.5 break-all text-xs leading-5 text-slate-800">{config?.targetUrl || '-'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">登录策略</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-800">
                  {config?.authSource === 'project' ? '继承项目认证' : config?.authSource === 'task' ? '使用任务兼容认证' : '无需登录'}
                </p>
                {(config?.loginDescription || project?.loginDescription) && (
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">{config?.loginDescription || project?.loginDescription}</p>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">任务描述</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">{config?.featureDescription || '暂无任务描述。'}</p>
              </div>
            </div>
          </section>

          {showEvents && (
            <section className="rounded-[24px] border border-blue-100 bg-blue-50/40 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-950">执行事件</h2>
                <span className="text-[11px] text-slate-500">{visibleEvents.length} 条</span>
              </div>
              <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
                {visibleEvents.map((event, index) => (
                  <div key={`${event.createdAt}-${index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                      <span>{event.eventType}</span>
                      <span>{new Date(event.createdAt).toLocaleTimeString('zh-CN')}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-4 text-slate-700">
                      {renderEventLine(event)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-[24px] border border-amber-100 bg-amber-50/30 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                <h2 className="text-sm font-semibold text-slate-950">LLM 对话</h2>
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">{conversations.length} 条</span>
            </div>

            <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
              {conversations.length === 0 && <p className="text-xs text-slate-400">暂无对话内容</p>}
              {conversations.map((item) => (
                <div key={item.conversationUid} className={`rounded-xl border px-3 py-2.5 text-xs shadow-[0_4px_12px_rgba(15,23,42,0.03)] ${messageTone(item.messageType)}`}>
                  <div className="mb-1 flex items-center justify-between text-[10px] opacity-70">
                    <span className="font-medium">{item.role}</span>
                    <span>{new Date(item.createdAt).toLocaleTimeString('zh-CN')}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words leading-5">{item.content}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 右侧：浏览器实时画面 70% */}
        <div className="xl:sticky xl:top-8 xl:self-start">
          <section className="rounded-[30px] border border-white/70 bg-white/78 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {replayMode ? (
                  <>
                    <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">执行回放</h2>
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
                      {replayIndex + 1} / {replayFrames.length}
                    </span>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">浏览器实时画面</h2>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {replayMode ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={async () => {
                        if (!confirm('确定要删除此次执行的回放数据吗？')) return;
                        await fetch(`/api/execution-details/${executionUid}/frames`, { method: 'DELETE' });
                        setReplayMode(false); setReplayPlaying(false); setReplayFrames([]);
                      }}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100"
                    >
                      清除数据
                    </button>
                    <button
                      onClick={() => { setReplayMode(false); setReplayPlaying(false); }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      返回实时
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => void loadReplayFrames()}
                    disabled={replayLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-100 disabled:opacity-50"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {replayLoading ? '加载中...' : '回放'}
                  </button>
                )}
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium tracking-[0.16em] text-slate-600">
                  session {execution.workerSessionId}
                </span>
              </div>
            </div>

            {replayMode ? (
              <div>
                <div className="rounded-lg bg-zinc-950 p-2">
                  <div className="relative overflow-hidden rounded-lg bg-zinc-900">
                    <canvas ref={replayCanvasRef} width={1280} height={720} className="h-auto w-full" />
                  </div>
                </div>
                {/* Replay controls */}
                <div className="mt-3 space-y-2">
                  {/* Progress bar */}
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, replayFrames.length - 1)}
                    value={replayIndex}
                    onChange={(e) => { setReplayIndex(Number(e.target.value)); setReplayPlaying(false); }}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {/* Prev frame */}
                      <button
                        onClick={() => { setReplayPlaying(false); setReplayIndex((p) => Math.max(0, p - 1)); }}
                        disabled={replayIndex <= 0}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      {/* Play/Pause */}
                      <button
                        onClick={() => {
                          if (replayIndex >= replayFrames.length - 1) setReplayIndex(0);
                          setReplayPlaying((p) => !p);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700"
                      >
                        {replayPlaying ? (
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                        ) : (
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        )}
                      </button>
                      {/* Next frame */}
                      <button
                        onClick={() => { setReplayPlaying(false); setReplayIndex((p) => Math.min(replayFrames.length - 1, p + 1)); }}
                        disabled={replayIndex >= replayFrames.length - 1}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                    {/* Speed control */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">速度</span>
                      {[0.5, 1, 2, 4].map((s) => (
                        <button
                          key={s}
                          onClick={() => setReplaySpeed(s)}
                          className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                            replaySpeed === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <BrowserView sessionId={execution.workerSessionId} isActive={execution.status === 'running'} hideHeader compact />
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
