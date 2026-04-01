'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BrowserView from '@/components/BrowserView';
import ExecutionIntentImportPanel from '@/components/ExecutionIntentImportPanel';
import ExecutionIntentImportStatusBadge from '@/components/ExecutionIntentImportStatusBadge';
import ExecutionPresetBadgeRow from '@/components/ExecutionPresetBadgeRow';
import {
  buildExecutionItemWorkspaceLinkActions,
  type ExecutionArtifactItem as ArtifactItem,
  type ExecutionConversationItem as ConversationItem,
  type ExecutionDetail,
  type ExecutionEventItem as EventItem,
} from '@/lib/execution-detail-contract';
import { formatExecutionMoment, summarizeExecutionTextList } from '@/lib/execution-detail-format';
import { buildExecutionDetailPresetViewModel } from '@/lib/execution-detail-preset-view-model';
import { executionConversationMessageTone, executionStatusTone } from '@/lib/execution-detail-tone';
import {
  buildIntentCapabilityPreset,
  buildIntentCapabilityWorkbenchHref,
  createIntentCapabilityLaunchToken,
  stashIntentCapabilityPreset,
} from '@/lib/intent-capability-preset';
import {
  pickLatestCapabilityVerificationExecutionObservationFromEvents,
  readCapabilityVerificationExecutionObservation,
} from '@/lib/capability-verification-observation-cache';
import {
  buildExecutionArtifactAnchorId,
  buildExecutionWorkspacePresetBadges,
  buildExecutionWorkspaceLinkActions,
  findExecutionArtifactByConversationContext,
  isExecutionArtifactFocused,
  pickPreferredExecutionWorkspacePresetContext,
  readExecutionArtifactAnchorIdFromHash,
  readExecutionArtifactDownloadEntry,
} from '@/lib/execution-workspace-link-contract';

export default function ExecutionWorkbench({ executionUid }: { executionUid: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  const [capabilityExecutionObservation, setCapabilityExecutionObservation] = useState(
    () => readCapabilityVerificationExecutionObservation(executionUid)
  );
  const [events, setEvents] = useState<EventItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [error, setError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [artifactFocusHash, setArtifactFocusHash] = useState('');
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
    if (typeof window === 'undefined') return;
    const syncArtifactFocusHash = () => {
      setArtifactFocusHash(window.location.hash || '');
    };
    syncArtifactFocusHash();
    window.addEventListener('hashchange', syncArtifactFocusHash);
    return () => {
      window.removeEventListener('hashchange', syncArtifactFocusHash);
    };
  }, [executionUid]);

  useEffect(() => {
    setCapabilityExecutionObservation(readCapabilityVerificationExecutionObservation(executionUid));
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
  const persistedCapabilityExecutionObservation = useMemo(
    () => pickLatestCapabilityVerificationExecutionObservationFromEvents(events),
    [events]
  );
  const effectiveCapabilityExecutionObservation = persistedCapabilityExecutionObservation || capabilityExecutionObservation;
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
        nextWorkspaceHistoryPath:
          typeof payload.nextWorkspaceHistoryPath === 'string' ? payload.nextWorkspaceHistoryPath : '',
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

  const downloadArtifactContent = (artifact?: ArtifactItem | null) => {
    const entry = readExecutionArtifactDownloadEntry(artifact);
    if (!entry) return;
    const fileName = (entry.fileName || `${executionUid}.spec.ts`).replace(/\s+/g, '-');
    const blob = new Blob([entry.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadGeneratedSpec = () => {
    downloadArtifactContent(generatedSpec);
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
  const {
    executionContextLinkActions,
    executionPresetBadges,
    intentImportPresetBadges,
    intentImportPresetDetails,
    intentImportPresetActions,
  } = buildExecutionDetailPresetViewModel(detail);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_6px_24px_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Execution</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-zinc-900">执行工作台</h1>
              {detail.intentImport && (
                <ExecutionIntentImportStatusBadge
                  status={detail.intentImport.importedStatus}
                  variant="workbench"
                  className="rounded-md px-2.5 py-1 text-xs"
                />
              )}
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {project?.name ? `${project.name} / ` : ''}{config?.name || execution.executionUid}
            </p>
            {actionNotice && <p className="mt-2 text-xs text-blue-600">{actionNotice}</p>}
            <ExecutionPresetBadgeRow badges={executionPresetBadges} />
            {executionContextLinkActions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {executionContextLinkActions.map((action) => (
                  <Link
                    key={`execution-context-${action.key}-${action.href}`}
                    href={action.href}
                    className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-sky-200 hover:bg-white hover:text-sky-700"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="text-right">
            <span className={`rounded-md px-2.5 py-1 text-xs ${executionStatusTone(execution.status, 'workbench')}`}>
              {execution.status}
            </span>
            <p className="mt-2 text-xs text-zinc-500">计划: {plan?.planTitle || execution.planUid}</p>
            <p className="text-xs text-zinc-400">版本: v{plan?.planVersion || '-'}</p>
          </div>
        </div>
        {autoRepairFollowUp?.summary && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p>{autoRepairFollowUp.summary}</p>
            {autoRepairFollowUp.nextRunPath && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={autoRepairFollowUp.nextRunPath}
                  className="inline-flex items-center rounded-md border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100"
                >
                  查看自动修复后的新执行
                </Link>
                {autoRepairFollowUp.nextWorkspaceHistoryPath && (
                  <Link
                    href={autoRepairFollowUp.nextWorkspaceHistoryPath}
                    className="inline-flex items-center rounded-md border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100"
                  >
                    查看聚焦执行历史
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
        {detail.capabilityVerification && effectiveCapabilityExecutionObservation?.latestRepairObservationSummary ? (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
            <p>
              能力验证上下文：
              {detail.capabilityVerification.targetName || detail.capabilityVerification.capabilityUid}
              {detail.capabilityVerification.strategyLabel ? ` · ${detail.capabilityVerification.strategyLabel}` : ''}
            </p>
            <p className="mt-1 leading-5">
              最近关联 verifier observation：{effectiveCapabilityExecutionObservation.latestRepairObservationSummary}
              {effectiveCapabilityExecutionObservation.latestRepairObservationVerifierCheckUids.length > 0
                ? ` · verifier ${summarizeExecutionTextList(effectiveCapabilityExecutionObservation.latestRepairObservationVerifierCheckUids, 2)}`
                : ''}
              {effectiveCapabilityExecutionObservation.latestRepairObservationAt
                ? ` · ${formatExecutionMoment(effectiveCapabilityExecutionObservation.latestRepairObservationAt)}`
                : ''}
            </p>
          </div>
        ) : null}
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
            {conversations.map((item) => {
              const conversationLinkActions = buildExecutionWorkspaceLinkActions(item);
              const conversationPresetBadges = buildExecutionWorkspacePresetBadges(
                pickPreferredExecutionWorkspacePresetContext({
                  executionContext: item.executionContext,
                  nextExecutionContext: item.nextExecutionContext,
                })
              );
              const matchedArtifact = findExecutionArtifactByConversationContext(artifacts, item.executionArtifactContext);
              const artifactAnchorId = item.executionArtifactContext
                ? buildExecutionArtifactAnchorId(item.executionArtifactContext.storagePath)
                : '';
              const downloadableArtifact = readExecutionArtifactDownloadEntry(matchedArtifact);
              return (
                <div
                  key={item.conversationUid}
                  className={`rounded-lg border px-3 py-2 text-sm ${executionConversationMessageTone(item.messageType, 'workbench')}`}
                >
                  <div className="mb-1 flex items-center justify-between text-xs opacity-70">
                    <span>{item.role}</span>
                    <span>{new Date(item.createdAt).toLocaleTimeString('zh-CN')}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words">{item.content}</p>
                  <ExecutionPresetBadgeRow badges={conversationPresetBadges} />
                  {item.executionArtifactContext && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600">
                        关联产物：{item.executionArtifactContext.fileName || item.executionArtifactContext.artifactType}
                      </span>
                      {matchedArtifact && artifactAnchorId && (
                        <a
                          href={`#${artifactAnchorId}`}
                          onClick={() => {
                            setArtifactFocusHash(`#${artifactAnchorId}`);
                          }}
                          className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 transition hover:border-sky-200 hover:text-sky-700"
                        >
                          查看关联产物
                        </a>
                      )}
                      {item.executionArtifactContext.artifactType === 'generated_spec' && downloadableArtifact && matchedArtifact && (
                        <button
                          type="button"
                          onClick={() => {
                            downloadArtifactContent(matchedArtifact);
                          }}
                          className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 transition hover:border-sky-200 hover:text-sky-700"
                        >
                          下载关联脚本
                        </button>
                      )}
                    </div>
                  )}
                  {conversationLinkActions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {conversationLinkActions.map((action) => (
                        <Link
                          key={`${item.conversationUid}-${action.key}-${action.href}`}
                          href={action.href}
                          className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 transition hover:border-sky-200 hover:text-sky-700"
                        >
                          {action.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {detail.intentImport && (
            <ExecutionIntentImportPanel
              status={detail.intentImport.importedStatus}
              panelClassName="rounded-2xl border p-5 shadow-[0_6px_20px_rgba(0,0,0,0.04)]"
              title="执行来源"
              titleAs="h2"
              titleClassName="text-base font-semibold"
              badgeShapeClassName="rounded-md px-2 py-1 text-[11px]"
              badgeToneVariant="workbench"
              description="这条执行历史由 Intent E2E 工作台导入，用于把自然语言测试结果沉淀到项目工作台。"
              descriptionClassName="mt-2 text-xs leading-5 opacity-80"
              importedFromRunId={detail.intentImport.importedFromRunId}
              importedAtLabel={
                detail.intentImport.importedAt ? `导入时间：${formatExecutionMoment(detail.intentImport.importedAt)}` : ''
              }
              presetBadges={intentImportPresetBadges}
              presetDetails={intentImportPresetDetails}
              presetActions={intentImportPresetActions}
              actionKeyPrefix="intent-import"
              actionRowClassName="mt-3 flex flex-wrap gap-2"
              actionLinkClassName="rounded-md border border-current/15 bg-white/80 px-3 py-1.5 text-[11px] font-medium transition hover:bg-white"
            />
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
              {events.slice(-80).map((event, idx) => {
                const eventLinkActions = buildExecutionItemWorkspaceLinkActions(event, event.payload);
                const effectiveEventLinkActions = eventLinkActions.length > 0 ? eventLinkActions : executionContextLinkActions;
                const eventPresetBadges = buildExecutionWorkspacePresetBadges(
                  pickPreferredExecutionWorkspacePresetContext({
                    executionContext: event.executionContext,
                    nextExecutionContext: event.nextExecutionContext,
                  })
                );
                return (
                  <div key={`${event.createdAt}-${idx}`} className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1">
                    <p className="font-medium text-zinc-700">[{event.eventType}] {new Date(event.createdAt).toLocaleTimeString('zh-CN')}</p>
                    <p className="mt-0.5 break-all text-zinc-500">{JSON.stringify(event.payload)}</p>
                    <ExecutionPresetBadgeRow badges={eventPresetBadges} />
                    {effectiveEventLinkActions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {effectiveEventLinkActions.map((action) => (
                          <Link
                            key={`${event.createdAt}-${action.key}-${action.href}`}
                            href={action.href}
                            className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-sky-200 hover:text-sky-700"
                          >
                            {action.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
            {artifacts.map((artifact, idx) => {
              const artifactLinkActions = buildExecutionItemWorkspaceLinkActions(artifact, artifact.meta);
              const effectiveArtifactLinkActions = artifactLinkActions.length > 0 ? artifactLinkActions : executionContextLinkActions;
              const artifactAnchorId = buildExecutionArtifactAnchorId(artifact.storagePath);
              const artifactPresetBadges = buildExecutionWorkspacePresetBadges(
                pickPreferredExecutionWorkspacePresetContext({
                  executionContext: artifact.executionContext,
                  nextExecutionContext: artifact.nextExecutionContext,
                })
              );
              const artifactFocused =
                Boolean(readExecutionArtifactAnchorIdFromHash(artifactFocusHash)) &&
                isExecutionArtifactFocused(artifact.storagePath, artifactFocusHash);
              return (
                <div
                  key={`${artifact.storagePath}-${idx}`}
                  id={artifactAnchorId}
                  className={`scroll-mt-24 rounded-lg border p-3 text-xs transition ${
                    artifactFocused
                      ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-100'
                      : 'border-zinc-200 bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-zinc-700">{artifact.artifactType}</p>
                    {artifactFocused && (
                      <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                        已定位
                      </span>
                    )}
                  </div>
                  <p className="mt-1 break-all text-zinc-500">{artifact.storagePath}</p>
                  <p className="mt-1 text-zinc-400">{new Date(artifact.createdAt).toLocaleString('zh-CN')}</p>
                  <ExecutionPresetBadgeRow badges={artifactPresetBadges} />
                  {effectiveArtifactLinkActions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {effectiveArtifactLinkActions.map((action) => (
                        <Link
                          key={`${artifact.storagePath}-${action.key}-${action.href}`}
                          href={action.href}
                          className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-sky-200 hover:text-sky-700"
                        >
                          {action.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
