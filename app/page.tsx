'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type ConfigStatus = 'active' | 'archived';

type ConfigItem = {
  configUid: string;
  sortOrder: number;
  moduleName: string;
  name: string;
  targetUrl: string;
  featureDescription: string;
  authRequired: boolean;
  loginUrl: string;
  loginUsername: string;
  loginPasswordMasked: string;
  coverageMode: 'all_tiers';
  status: ConfigStatus;
  createdAt: string;
  updatedAt: string;
  latestPlanUid?: string;
  latestPlanVersion?: number;
  latestExecutionUid?: string;
  latestExecutionStatus?: string;
};

type FormState = {
  sortOrder: number;
  moduleName: string;
  name: string;
  targetUrl: string;
  featureDescription: string;
  authRequired: boolean;
  loginUrl: string;
  loginUsername: string;
  loginPassword: string;
};

type PlanPreview = {
  planUid: string;
  planTitle: string;
  planVersion: number;
  planSummary: string;
  planCode: string;
  generatedFiles: Array<{ name: string; content: string; language: string }>;
  createdAt: string;
};

type PlanCase = {
  caseUid: string;
  tier: 'simple' | 'medium' | 'complex';
  caseName: string;
  expectedResult: string;
};

type ExecutionRow = {
  executionUid: string;
  planUid: string;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'canceled';
  startedAt: string;
  endedAt: string;
  durationMs: number;
  resultSummary: string;
  errorMessage: string;
  createdAt: string;
};

type ExecutionEvent = {
  eventType: string;
  payload: unknown;
  createdAt: string;
};

type EventTypeFilter = 'all' | 'step' | 'log' | 'frame' | 'status' | 'artifact';
type EventTimeRange = 'all' | '15m' | '1h' | '24h';
type EventLogLevelFilter = 'all' | 'error' | 'warn' | 'info';

const defaultForm: FormState = {
  sortOrder: 100,
  moduleName: 'general',
  name: '',
  targetUrl: '',
  featureDescription: '',
  authRequired: false,
  loginUrl: '',
  loginUsername: '',
  loginPassword: '',
};

function statusTone(status?: string): string {
  switch (status) {
    case 'passed':
      return 'bg-emerald-100 text-emerald-700';
    case 'failed':
      return 'bg-rose-100 text-rose-700';
    case 'running':
      return 'bg-amber-100 text-amber-700';
    case 'queued':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-zinc-100 text-zinc-600';
  }
}

function isErrorEvent(event: ExecutionEvent): boolean {
  const payload = (event.payload || {}) as Record<string, unknown>;

  if (event.eventType === 'step') {
    const status = String(payload.status || '').toLowerCase();
    return status === 'failed';
  }

  if (event.eventType === 'status') {
    const status = String(payload.status || '').toLowerCase();
    return status === 'failed';
  }

  if (event.eventType === 'log') {
    const level = String(payload.level || '').toLowerCase();
    if (level === 'error') return true;
  }

  const text = JSON.stringify(payload || {}).toLowerCase();
  return text.includes('error') || text.includes('failed') || text.includes('异常');
}

export default function HomePage() {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConfigStatus>('active');
  const [error, setError] = useState('');

  const [openDrawer, setOpenDrawer] = useState(false);
  const [editingUid, setEditingUid] = useState('');
  const [form, setForm] = useState<FormState>(defaultForm);

  const [actioningUid, setActioningUid] = useState('');

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPlan, setPreviewPlan] = useState<PlanPreview | null>(null);
  const [previewCases, setPreviewCases] = useState<PlanCase[]>([]);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<ExecutionRow[]>([]);
  const [historyConfigName, setHistoryConfigName] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | ExecutionRow['status']>('all');
  const [historyOrder, setHistoryOrder] = useState<'desc' | 'asc'>('desc');
  const [historyKeyword, setHistoryKeyword] = useState('');
  const [historyEventMap, setHistoryEventMap] = useState<Record<string, ExecutionEvent[]>>({});
  const [historyEventLoadingUid, setHistoryEventLoadingUid] = useState('');
  const [historyExpandedUid, setHistoryExpandedUid] = useState('');
  const [historyEventTypeFilter, setHistoryEventTypeFilter] = useState<EventTypeFilter>('all');
  const [historyEventLogLevelFilter, setHistoryEventLogLevelFilter] = useState<EventLogLevelFilter>('all');
  const [historyEventKeyword, setHistoryEventKeyword] = useState('');
  const [historyEventTimeRange, setHistoryEventTimeRange] = useState<EventTimeRange>('all');
  const [historyAutoHandled, setHistoryAutoHandled] = useState(false);

  const isEditing = useMemo(() => Boolean(editingUid), [editingUid]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        page: '1',
        pageSize: '50',
        status: statusFilter,
      });
      if (keyword.trim()) qs.set('keyword', keyword.trim());

      const res = await fetch(`/api/test-configs?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载失败');
      setItems(json.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [keyword, statusFilter]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const resetForm = () => {
    setForm(defaultForm);
    setEditingUid('');
  };

  const openCreate = () => {
    resetForm();
    setOpenDrawer(true);
  };

  const openEdit = (item: ConfigItem) => {
    setEditingUid(item.configUid);
    setForm({
      sortOrder: item.sortOrder || 100,
      moduleName: item.moduleName || 'general',
      name: item.name,
      targetUrl: item.targetUrl,
      featureDescription: item.featureDescription,
      authRequired: item.authRequired,
      loginUrl: item.loginUrl || '',
      loginUsername: item.loginUsername || '',
      loginPassword: '',
    });
    setOpenDrawer(true);
  };

  const submitForm = async () => {
    if (!form.name || !form.targetUrl || !form.featureDescription) {
      setError('请填写完整的名称、目标 URL、功能描述');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        sortOrder: Number.isFinite(Number(form.sortOrder)) ? Number(form.sortOrder) : 100,
        moduleName: form.moduleName || 'general',
        name: form.name,
        targetUrl: form.targetUrl,
        featureDescription: form.featureDescription,
        authRequired: form.authRequired,
        loginUrl: form.authRequired ? form.loginUrl : '',
        loginUsername: form.authRequired ? form.loginUsername : '',
        loginPassword: form.authRequired ? form.loginPassword : '',
      };

      const res = await fetch(isEditing ? `/api/test-configs/${editingUid}` : '/api/test-configs', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '保存失败');

      setOpenDrawer(false);
      resetForm();
      await loadList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async (configUid: string) => {
    if (!confirm('确认删除该测试配置？')) return;

    setActioningUid(configUid);
    setError('');
    try {
      const res = await fetch(`/api/test-configs/${configUid}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '删除失败');
      await loadList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setActioningUid('');
    }
  };

  const generatePlan = async (configUid: string) => {
    setActioningUid(configUid);
    setError('');
    try {
      const res = await fetch(`/api/test-configs/${configUid}/generate-plan`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '生成测试计划失败');
      await loadList();
      await openPlanPreviewByUid(json.planUid);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setActioningUid('');
    }
  };

  const executePlan = async (item: ConfigItem) => {
    if (!item.latestPlanUid) {
      setError('请先生成测试计划');
      return;
    }

    setActioningUid(item.configUid);
    setError('');
    try {
      const res = await fetch(`/api/test-plans/${item.latestPlanUid}/execute`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '执行失败');
      window.location.href = `/executions/${json.executionUid}`;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '执行失败');
      setActioningUid('');
    }
  };

  const openPlanPreviewByUid = async (planUid?: string) => {
    if (!planUid) {
      setError('暂无测试计划可预览');
      return;
    }

    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/test-plans/${planUid}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载测试计划失败');
      setPreviewPlan(json.plan);
      setPreviewCases(json.cases || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载计划失败');
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const openExecutionHistory = async (item: ConfigItem) => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryConfigName(item.name);
    setHistoryStatusFilter('all');
    setHistoryOrder('desc');
    setHistoryKeyword('');
    setHistoryExpandedUid('');
    setHistoryEventMap({});
    setHistoryEventLoadingUid('');
    setHistoryEventTypeFilter('all');
    setHistoryEventLogLevelFilter('all');
    setHistoryEventKeyword('');
    setHistoryEventTimeRange('all');
    setHistoryAutoHandled(false);
    try {
      const res = await fetch(`/api/test-configs/${item.configUid}/executions?limit=50`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载执行历史失败');
      setHistoryRows(json.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载历史失败');
      setHistoryOpen(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredHistoryRows = useMemo(() => {
    const rows = historyRows.filter((row) => {
      if (historyStatusFilter !== 'all' && row.status !== historyStatusFilter) {
        return false;
      }
      const kw = historyKeyword.trim().toLowerCase();
      if (!kw) return true;
      return (
        row.executionUid.toLowerCase().includes(kw) ||
        row.planUid.toLowerCase().includes(kw) ||
        row.resultSummary.toLowerCase().includes(kw) ||
        row.errorMessage.toLowerCase().includes(kw)
      );
    });

    rows.sort((a, b) => {
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return historyOrder === 'desc' ? bt - at : at - bt;
    });

    return rows;
  }, [historyRows, historyStatusFilter, historyKeyword, historyOrder]);

  const downloadTextFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportHistoryJson = () => {
    const filename = `execution-history-${Date.now()}.json`;
    downloadTextFile(filename, JSON.stringify(filteredHistoryRows, null, 2), 'application/json;charset=utf-8');
  };

  const csvEscape = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const exportHistoryCsv = () => {
    const header = ['execution_uid', 'plan_uid', 'status', 'created_at', 'started_at', 'ended_at', 'duration_ms', 'result_summary', 'error_message'];
    const lines = [header.join(',')];
    for (const row of filteredHistoryRows) {
      lines.push(
        [
          row.executionUid,
          row.planUid,
          row.status,
          row.createdAt,
          row.startedAt,
          row.endedAt,
          String(row.durationMs || 0),
          row.resultSummary || '',
          row.errorMessage || '',
        ]
          .map(csvEscape)
          .join(',')
      );
    }
    const filename = `execution-history-${Date.now()}.csv`;
    downloadTextFile(filename, lines.join('\n'), 'text/csv;charset=utf-8');
  };

  const downloadPlanScript = () => {
    if (!previewPlan) return;
    const content = previewPlan.generatedFiles?.[0]?.content || previewPlan.planCode || '';
    const filename = (previewPlan.generatedFiles?.[0]?.name || `${previewPlan.planUid}.spec.ts`).replace(/\s+/g, '-');
    downloadTextFile(filename, content, 'text/plain;charset=utf-8');
  };

  const payloadPreview = (payload: unknown): string => {
    try {
      return JSON.stringify(payload);
    } catch {
      return String(payload || '');
    }
  };

  const renderEventLine = (event: ExecutionEvent) => {
    const payload = (event.payload || {}) as Record<string, unknown>;
    if (event.eventType === 'step') {
      return `[step] ${String(payload.title || '-')}: ${String(payload.status || '-')}${payload.error ? ` · ${String(payload.error)}` : ''}`;
    }
    if (event.eventType === 'log') {
      return `[log] ${String(payload.level || 'info')}: ${String(payload.message || '')}`;
    }
    if (event.eventType === 'artifact') {
      return `[artifact] ${String(payload.type || '-')}: ${String(payload.name || payload.path || '')}`;
    }
    if (event.eventType === 'status') {
      return `[status] ${String(payload.status || '-')}: ${String(payload.summary || '')}`;
    }
    if (event.eventType === 'frame') {
      return `[frame] #${String(payload.frameIndex || 0)} ${payload.channel ? `(${String(payload.channel)})` : ''}`;
    }
    return `[${event.eventType}] ${payloadPreview(event.payload)}`;
  };

  const getFilteredEventsForExecution = (executionUid: string): ExecutionEvent[] => {
    let rows = historyEventMap[executionUid] || [];

    if (historyEventTypeFilter === 'all') {
      // 默认不展示 frame，避免实时画面帧日志淹没有效信息
      rows = rows.filter((item) => item.eventType !== 'frame');
    } else {
      rows = rows.filter((item) => item.eventType === historyEventTypeFilter);
    }

    if (historyEventTimeRange !== 'all') {
      const now = Date.now();
      const rangeMs =
        historyEventTimeRange === '15m'
          ? 15 * 60 * 1000
          : historyEventTimeRange === '1h'
            ? 60 * 60 * 1000
            : 24 * 60 * 60 * 1000;
      rows = rows.filter((item) => {
        const t = new Date(item.createdAt).getTime();
        return Number.isFinite(t) && now - t <= rangeMs;
      });
    }

    if (historyEventLogLevelFilter !== 'all' && (historyEventTypeFilter === 'all' || historyEventTypeFilter === 'log')) {
      rows = rows.filter((item) => {
        if (item.eventType !== 'log') return false;
        const payload = (item.payload || {}) as Record<string, unknown>;
        const level = String(payload.level || '').toLowerCase();
        return level === historyEventLogLevelFilter;
      });
    }

    const kw = historyEventKeyword.trim().toLowerCase();
    if (kw) {
      rows = rows.filter((item) => {
        const line = renderEventLine(item).toLowerCase();
        const payload = payloadPreview(item.payload).toLowerCase();
        return (
          item.eventType.toLowerCase().includes(kw) ||
          line.includes(kw) ||
          payload.includes(kw)
        );
      });
    }

    return rows;
  };

  const getHiddenFrameCountForExecution = (executionUid: string): number => {
    if (historyEventTypeFilter !== 'all') return 0;
    const all = historyEventMap[executionUid] || [];
    return all.filter((item) => item.eventType === 'frame').length;
  };

  const exportExecutionEventsJson = (executionUid: string) => {
    const rows = getFilteredEventsForExecution(executionUid);
    const filename = `execution-events-${executionUid}-${Date.now()}.json`;
    downloadTextFile(filename, JSON.stringify(rows, null, 2), 'application/json;charset=utf-8');
  };

  const exportExecutionEventsCsv = (executionUid: string) => {
    const rows = getFilteredEventsForExecution(executionUid);
    const header = ['created_at', 'event_type', 'rendered_line', 'payload_json'];
    const lines = [header.join(',')];
    for (const row of rows) {
      lines.push(
        [row.createdAt, row.eventType, renderEventLine(row), payloadPreview(row.payload)]
          .map(csvEscape)
          .join(',')
      );
    }
    const filename = `execution-events-${executionUid}-${Date.now()}.csv`;
    downloadTextFile(filename, lines.join('\n'), 'text/csv;charset=utf-8');
  };

  const getVisibleEventsForExecution = (executionUid: string): ExecutionEvent[] => {
    return getFilteredEventsForExecution(executionUid).slice(-300);
  };

  const buildEventDomId = (executionUid: string, event: ExecutionEvent, idx: number): string => {
    const ts = new Date(event.createdAt).getTime();
    const safeTs = Number.isFinite(ts) ? ts : 0;
    return `history-event-${executionUid}-${safeTs}-${event.eventType}-${idx}`;
  };

  const jumpToFirstErrorEvent = (executionUid: string) => {
    const rows = getVisibleEventsForExecution(executionUid);
    const index = rows.findIndex((item) => isErrorEvent(item));
    if (index < 0) return;
    const id = buildEventDomId(executionUid, rows[index], index);
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const toggleHistoryEvents = async (executionUid: string, options?: { autoJumpToError?: boolean }) => {
    const autoJumpToError = !!options?.autoJumpToError;

    if (historyExpandedUid === executionUid && !autoJumpToError) {
      setHistoryExpandedUid('');
      return;
    }

    setHistoryExpandedUid(executionUid);
    if (historyEventMap[executionUid]) {
      if (autoJumpToError) {
        setTimeout(() => jumpToFirstErrorEvent(executionUid), 80);
      }
      return;
    }

    setHistoryEventLoadingUid(executionUid);
    try {
      const res = await fetch(`/api/test-executions/${executionUid}/events`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载执行事件失败');
      setHistoryEventMap((prev) => ({
        ...prev,
        [executionUid]: json.events || [],
      }));
      if (autoJumpToError) {
        setTimeout(() => jumpToFirstErrorEvent(executionUid), 120);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载执行日志失败');
    } finally {
      setHistoryEventLoadingUid('');
    }
  };

  useEffect(() => {
    if (!historyOpen || historyLoading || historyAutoHandled) return;
    const failedRow = filteredHistoryRows.find((row) => row.status === 'failed');
    setHistoryAutoHandled(true);
    if (failedRow) {
      void toggleHistoryEvents(failedRow.executionUid, { autoJumpToError: true });
    }
  }, [historyOpen, historyLoading, historyAutoHandled, filteredHistoryRows]);

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-zinc-800">
      <div className="mx-auto max-w-[1280px] px-6 py-8">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)] md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">AI E2E Platform</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">测试配置中心</h1>
            <p className="mt-2 text-sm text-zinc-500">管理测试配置，生成测试计划，并执行简单-中等-复杂三层端到端测试。</p>
          </div>
          <button
            onClick={openCreate}
            className="rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
          >
            新建配置
          </button>
        </header>

        <section className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索名称 / 模块 / URL / 描述"
            className="w-[320px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-800"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ConfigStatus)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none"
          >
            <option value="active">启用中</option>
            <option value="archived">已归档</option>
          </select>
          <button
            onClick={() => void loadList()}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            刷新
          </button>
        </section>

        {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_6px_24px_rgba(0,0,0,0.04)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">排序号</th>
                  <th className="px-4 py-3">功能模块</th>
                  <th className="px-4 py-3">配置</th>
                  <th className="px-4 py-3">覆盖层级</th>
                  <th className="px-4 py-3">计划版本</th>
                  <th className="px-4 py-3">最近执行</th>
                  <th className="px-4 py-3">更新时间</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                      正在加载配置列表...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                      暂无配置，先创建一个测试配置。
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((item) => (
                    <tr key={item.configUid} className="border-t border-zinc-100 align-top">
                      <td className="px-4 py-3 text-xs text-zinc-600">{item.sortOrder}</td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700">{item.moduleName || 'general'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{item.name}</p>
                        <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{item.targetUrl}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{item.featureDescription}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">简单 + 中等 + 复杂</span>
                      </td>
                      <td className="px-4 py-3">
                        {item.latestPlanUid ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex w-fit rounded-md bg-sky-50 px-2 py-1 text-xs text-sky-700">v{item.latestPlanVersion || 1}</span>
                            <button
                              onClick={() => void openPlanPreviewByUid(item.latestPlanUid)}
                              className="w-fit text-xs text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
                            >
                              查看计划
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400">未生成</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.latestExecutionStatus ? (
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex w-fit rounded-md px-2 py-1 text-xs ${statusTone(item.latestExecutionStatus)}`}>
                              {item.latestExecutionStatus}
                            </span>
                            <button
                              onClick={() => void openExecutionHistory(item)}
                              className="w-fit text-xs text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
                            >
                              查看日志
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400">未执行</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{new Date(item.updatedAt).toLocaleString('zh-CN')}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => void generatePlan(item.configUid)}
                            disabled={Boolean(actioningUid)}
                            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                          >
                            生成测试计划
                          </button>
                          <button
                            onClick={() => void executePlan(item)}
                            disabled={Boolean(actioningUid)}
                            className="rounded-md border border-zinc-900 bg-zinc-900 px-2.5 py-1 text-xs text-white hover:bg-zinc-700 disabled:opacity-50"
                          >
                            执行测试计划
                          </button>
                          <button
                            onClick={() => openEdit(item)}
                            disabled={Boolean(actioningUid)}
                            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                          >
                            修改
                          </button>
                          <button
                            onClick={() => void deleteConfig(item.configUid)}
                            disabled={Boolean(actioningUid)}
                            className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-4 text-xs text-zinc-400">
          计划支持预览与脚本下载；列表新增排序号和功能模块字段，并持久化到 MySQL。
        </p>

        {openDrawer && (
          <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
            <div className="h-full w-full max-w-[520px] overflow-y-auto bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-900">{isEditing ? '修改测试配置' : '新建测试配置'}</h2>
                <button
                  onClick={() => {
                    setOpenDrawer(false);
                    resetForm();
                  }}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600"
                >
                  关闭
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">排序号</label>
                    <input
                      type="number"
                      value={form.sortOrder}
                      onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) || 100 }))}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">功能模块</label>
                    <input
                      value={form.moduleName}
                      onChange={(e) => setForm((p) => ({ ...p, moduleName: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
                      placeholder="如: 订单中心"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-500">配置名称</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
                    placeholder="例如：产品管理新增产品流程"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-500">目标 URL</label>
                  <input
                    value={form.targetUrl}
                    onChange={(e) => setForm((p) => ({ ...p, targetUrl: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
                    placeholder="https://example.com/products"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-500">功能描述</label>
                  <textarea
                    value={form.featureDescription}
                    onChange={(e) => setForm((p) => ({ ...p, featureDescription: e.target.value }))}
                    rows={4}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
                    placeholder="描述待测试的关键流程、断言和风险点"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={form.authRequired}
                    onChange={(e) => setForm((p) => ({ ...p, authRequired: e.target.checked }))}
                  />
                  需要登录认证
                </label>

                {form.authRequired && (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">登录 URL</label>
                        <input
                          value={form.loginUrl}
                          onChange={(e) => setForm((p) => ({ ...p, loginUrl: e.target.value }))}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
                          placeholder="https://example.com/login"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">登录用户名</label>
                        <input
                          value={form.loginUsername}
                          onChange={(e) => setForm((p) => ({ ...p, loginUsername: e.target.value }))}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
                          placeholder="手机号或邮箱"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">登录密码（仅服务端加密存储）</label>
                        <input
                          type="password"
                          value={form.loginPassword}
                          onChange={(e) => setForm((p) => ({ ...p, loginPassword: e.target.value }))}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
                          placeholder={isEditing ? '留空则沿用旧密码' : '请输入密码'}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setOpenDrawer(false);
                      resetForm();
                    }}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-600"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => void submitForm()}
                    disabled={saving}
                    className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {saving ? '保存中...' : '保存配置'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {previewOpen && (
          <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
            <div className="h-full w-full max-w-[760px] overflow-y-auto bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-900">测试计划预览</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadPlanScript}
                    disabled={!previewPlan}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 disabled:opacity-50"
                  >
                    下载脚本
                  </button>
                  <button
                    onClick={() => setPreviewOpen(false)}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600"
                  >
                    关闭
                  </button>
                </div>
              </div>

              {previewLoading && <p className="text-sm text-zinc-500">加载中...</p>}

              {!previewLoading && previewPlan && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
                    <p className="font-medium text-zinc-800">{previewPlan.planTitle}</p>
                    <p className="mt-1 text-xs text-zinc-500">UID: {previewPlan.planUid} · v{previewPlan.planVersion}</p>
                    <p className="mt-1 text-xs text-zinc-500">{new Date(previewPlan.createdAt).toLocaleString('zh-CN')}</p>
                    <p className="mt-2 text-xs text-zinc-600">{previewPlan.planSummary}</p>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-medium text-zinc-800">测试用例（简单/中等/复杂）</h3>
                    <div className="space-y-2">
                      {previewCases.map((c) => (
                        <div key={c.caseUid} className="rounded border border-zinc-200 bg-white p-2.5 text-xs">
                          <p className="font-medium text-zinc-800">[{c.tier}] {c.caseName}</p>
                          <p className="mt-1 text-zinc-500">{c.expectedResult}</p>
                        </div>
                      ))}
                      {previewCases.length === 0 && <p className="text-xs text-zinc-400">暂无用例</p>}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-medium text-zinc-800">生成代码</h3>
                    <pre className="max-h-[420px] overflow-auto rounded-lg bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-100">
{previewPlan.generatedFiles?.[0]?.content || previewPlan.planCode || '// 无代码'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {historyOpen && (
          <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
            <div className="h-full w-full max-w-[820px] overflow-y-auto bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">执行历史日志</h2>
                  <p className="text-xs text-zinc-500">{historyConfigName}</p>
                </div>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600"
                >
                  关闭
                </button>
              </div>

              {!historyLoading && (
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
                  <input
                    value={historyKeyword}
                    onChange={(e) => setHistoryKeyword(e.target.value)}
                    placeholder="按执行ID/计划ID/结果搜索"
                    className="w-[260px] rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-zinc-800"
                  />
                  <select
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value as 'all' | ExecutionRow['status'])}
                    className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="all">全部状态</option>
                    <option value="queued">queued</option>
                    <option value="running">running</option>
                    <option value="passed">passed</option>
                    <option value="failed">failed</option>
                    <option value="canceled">canceled</option>
                  </select>
                  <select
                    value={historyOrder}
                    onChange={(e) => setHistoryOrder(e.target.value as 'desc' | 'asc')}
                    className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="desc">时间: 倒序</option>
                    <option value="asc">时间: 正序</option>
                  </select>
                  <button
                    onClick={exportHistoryJson}
                    className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
                  >
                    导出 JSON
                  </button>
                  <button
                    onClick={exportHistoryCsv}
                    className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
                  >
                    导出 CSV
                  </button>
                  <select
                    value={historyEventTypeFilter}
                    onChange={(e) => setHistoryEventTypeFilter(e.target.value as EventTypeFilter)}
                    className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="all">事件: 全部(隐藏frame)</option>
                    <option value="step">事件: step</option>
                    <option value="log">事件: log</option>
                    <option value="frame">事件: frame</option>
                    <option value="status">事件: status</option>
                    <option value="artifact">事件: artifact</option>
                  </select>
                  <select
                    value={historyEventLogLevelFilter}
                    onChange={(e) => setHistoryEventLogLevelFilter(e.target.value as EventLogLevelFilter)}
                    className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="all">级别: all</option>
                    <option value="error">级别: error</option>
                    <option value="warn">级别: warn</option>
                    <option value="info">级别: info</option>
                  </select>
                  <span className="ml-auto text-xs text-zinc-500">共 {filteredHistoryRows.length} 条</span>
                </div>
              )}

              {historyLoading && <p className="text-sm text-zinc-500">加载中...</p>}

              {!historyLoading && filteredHistoryRows.length === 0 && <p className="text-sm text-zinc-400">暂无执行记录</p>}

              {!historyLoading && filteredHistoryRows.length > 0 && (
                <div className="space-y-3">
                  {filteredHistoryRows.map((row) => (
                    <div
                      key={row.executionUid}
                      className={`rounded-lg border p-3 ${
                        row.status === 'failed'
                          ? 'border-rose-300 bg-rose-50/50'
                          : row.status === 'running'
                            ? 'border-amber-300 bg-amber-50/40'
                            : 'border-zinc-200 bg-zinc-50'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-zinc-800">{row.executionUid}</p>
                          <p className="text-xs text-zinc-500">计划: {row.planUid}</p>
                        </div>
                        <div className="text-right">
                          <span className={`rounded-md px-2 py-1 text-xs ${statusTone(row.status)}`}>{row.status}</span>
                          <p className="mt-1 text-xs text-zinc-500">{new Date(row.createdAt).toLocaleString('zh-CN')}</p>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-zinc-600 md:grid-cols-3">
                        <p>开始: {row.startedAt ? new Date(row.startedAt).toLocaleString('zh-CN') : '-'}</p>
                        <p>结束: {row.endedAt ? new Date(row.endedAt).toLocaleString('zh-CN') : '-'}</p>
                        <p>耗时: {row.durationMs ? `${(row.durationMs / 1000).toFixed(1)}s` : '-'}</p>
                      </div>

                      {row.resultSummary && <p className="mt-2 text-xs text-zinc-700">结果: {row.resultSummary}</p>}
                      {row.errorMessage && (
                        <pre className="mt-2 max-h-[200px] overflow-auto rounded bg-rose-50 p-2 text-xs text-rose-700">{row.errorMessage}</pre>
                      )}

                      <div className="mt-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => void toggleHistoryEvents(row.executionUid)}
                            className="text-xs text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
                          >
                            {historyExpandedUid === row.executionUid ? '收起详细日志' : '展开详细日志'}
                          </button>
                          <a
                            href={`/executions/${row.executionUid}`}
                            className="text-xs text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
                          >
                            查看该次任务完整详情
                          </a>
                        </div>
                      </div>

                      {historyExpandedUid === row.executionUid && (
                        <div className="mt-2 rounded border border-zinc-200 bg-white p-2">
                          {historyEventLoadingUid === row.executionUid && (
                            <p className="text-xs text-zinc-500">正在加载详细日志...</p>
                          )}
                          {historyEventLoadingUid !== row.executionUid &&
                            getFilteredEventsForExecution(row.executionUid).length === 0 && (
                              <p className="text-xs text-zinc-400">该任务暂无详细事件日志</p>
                            )}
                          {historyEventLoadingUid !== row.executionUid &&
                            getFilteredEventsForExecution(row.executionUid).length > 0 && (
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    value={historyEventKeyword}
                                    onChange={(e) => setHistoryEventKeyword(e.target.value)}
                                    placeholder="筛选详细日志关键词"
                                    className="w-[220px] rounded border border-zinc-300 bg-white px-2 py-1 text-xs outline-none focus:border-zinc-800"
                                  />
                                  <select
                                    value={historyEventTimeRange}
                                    onChange={(e) => setHistoryEventTimeRange(e.target.value as EventTimeRange)}
                                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs"
                                  >
                                    <option value="all">时间: 全部</option>
                                    <option value="15m">时间: 近15分钟</option>
                                    <option value="1h">时间: 近1小时</option>
                                    <option value="24h">时间: 近24小时</option>
                                  </select>
                                  <button
                                    onClick={() => exportExecutionEventsJson(row.executionUid)}
                                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                                  >
                                    导出明细 JSON
                                  </button>
                                  <button
                                    onClick={() => exportExecutionEventsCsv(row.executionUid)}
                                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                                  >
                                    导出明细 CSV
                                  </button>
                                  <button
                                    onClick={() => jumpToFirstErrorEvent(row.executionUid)}
                                    disabled={!getVisibleEventsForExecution(row.executionUid).some((item) => isErrorEvent(item))}
                                    className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100"
                                  >
                                    定位首条 error
                                  </button>
                                  <span className="text-xs text-zinc-500">
                                    当前筛选: {historyEventTypeFilter}/{historyEventLogLevelFilter}/{historyEventTimeRange}/{historyEventKeyword || '无关键词'} · {getFilteredEventsForExecution(row.executionUid).length} 条
                                  </span>
                                  {getHiddenFrameCountForExecution(row.executionUid) > 0 && (
                                    <span className="text-xs text-zinc-400">
                                      已隐藏 frame {getHiddenFrameCountForExecution(row.executionUid)} 条
                                    </span>
                                  )}
                                </div>
                                <div className="max-h-[280px] space-y-1 overflow-auto">
                                  {getVisibleEventsForExecution(row.executionUid).map((event, idx) => (
                                  <div
                                    id={buildEventDomId(row.executionUid, event, idx)}
                                    key={`${event.createdAt}-${idx}`}
                                    className={`rounded px-2 py-1 text-xs ${
                                      isErrorEvent(event)
                                        ? 'bg-rose-50 text-rose-700'
                                        : 'bg-zinc-50 text-zinc-600'
                                    }`}
                                  >
                                    <p className="font-medium text-zinc-700">
                                      {new Date(event.createdAt).toLocaleTimeString('zh-CN')} · {renderEventLine(event)}
                                    </p>
                                  </div>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
