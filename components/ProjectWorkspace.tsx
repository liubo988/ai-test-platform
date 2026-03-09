'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';

type ProjectStatus = 'active' | 'archived';
type ModuleStatus = 'active' | 'archived';
type ConfigStatus = 'active' | 'archived';
type ContentStatusFilter = 'active' | 'archived' | 'all';

type ProjectItem = {
  projectUid: string;
  name: string;
  description: string;
  coverImageUrl: string;
  authRequired: boolean;
  loginUrl: string;
  loginUsername: string;
  loginDescription: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  moduleCount: number;
  taskCount: number;
  executionCount: number;
  passedExecutionCount: number;
  failedExecutionCount: number;
  activeExecutionCount: number;
  passRate: number;
  latestExecutionUid: string;
  latestExecutionStatus: string;
  lastExecutionAt: string;
};

type ModuleItem = {
  moduleUid: string;
  projectUid: string;
  name: string;
  description: string;
  sortOrder: number;
  status: ModuleStatus;
  taskCount: number;
  executionCount: number;
  passedExecutionCount: number;
  failedExecutionCount: number;
  activeExecutionCount: number;
  passRate: number;
  latestExecutionUid: string;
  latestExecutionStatus: string;
  lastExecutionAt: string;
  createdAt: string;
  updatedAt: string;
};

type TaskItem = {
  configUid: string;
  projectUid: string;
  projectName: string;
  moduleUid: string;
  moduleName: string;
  sortOrder: number;
  name: string;
  targetUrl: string;
  featureDescription: string;
  authRequired: boolean;
  authSource: 'project' | 'task' | 'none';
  loginUrl: string;
  loginUsername: string;
  loginPasswordMasked: string;
  loginDescription: string;
  legacyAuthRequired: boolean;
  legacyLoginUrl: string;
  legacyLoginUsername: string;
  coverageMode: 'all_tiers';
  status: ConfigStatus;
  createdAt: string;
  updatedAt: string;
  latestPlanUid: string;
  latestPlanVersion: number;
  latestExecutionUid: string;
  latestExecutionStatus: string;
};

type ProjectFormState = {
  name: string;
  description: string;
  coverImageUrl: string;
  authRequired: boolean;
  loginUrl: string;
  loginUsername: string;
  loginPassword: string;
  loginDescription: string;
};

type ModuleFormState = {
  name: string;
  description: string;
  sortOrder: number;
};

type TaskFormState = {
  moduleUid: string;
  sortOrder: number;
  name: string;
  targetUrl: string;
  featureDescription: string;
};

type PlanPreview = {
  planUid: string;
  planTitle: string;
  projectUid: string;
  configUid: string;
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
  projectUid: string;
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

const defaultProjectForm: ProjectFormState = {
  name: '',
  description: '',
  coverImageUrl: '',
  authRequired: false,
  loginUrl: '',
  loginUsername: '',
  loginPassword: '',
  loginDescription: '',
};

const defaultModuleForm: ModuleFormState = {
  name: '',
  description: '',
  sortOrder: 100,
};

const defaultTaskForm: TaskFormState = {
  moduleUid: '',
  sortOrder: 100,
  name: '',
  targetUrl: '',
  featureDescription: '',
};

function statusDot(status?: string): string {
  switch (status) {
    case 'passed':
      return 'bg-emerald-500';
    case 'failed':
      return 'bg-rose-500';
    case 'running':
      return 'bg-amber-500 animate-pulse';
    case 'queued':
      return 'bg-slate-400';
    default:
      return 'bg-slate-300';
  }
}

function statusLabel(status?: string): string {
  switch (status) {
    case 'passed':
      return '通过';
    case 'failed':
      return '失败';
    case 'running':
      return '执行中';
    case 'queued':
      return '排队中';
    default:
      return '未执行';
  }
}

function statusTone(status?: string): string {
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

function payloadPreview(payload: unknown): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload || '');
  }
}

function renderEventLine(event: ExecutionEvent): string {
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
    return `[frame] ${String(payload.frameIndex || 0)}`;
  }
  return `[${event.eventType}] ${payloadPreview(event.payload)}`;
}

function isErrorEvent(event: ExecutionEvent): boolean {
  const payload = (event.payload || {}) as Record<string, unknown>;
  if (event.eventType === 'step') return String(payload.status || '').toLowerCase() === 'failed';
  if (event.eventType === 'status') return String(payload.status || '').toLowerCase() === 'failed';
  if (event.eventType === 'log') return String(payload.level || '').toLowerCase() === 'error';
  const text = payloadPreview(event.payload).toLowerCase();
  return text.includes('error') || text.includes('failed') || text.includes('异常');
}

function formatPassRate(total: number, passRate: number): string {
  return total > 0 ? `${passRate}%` : '-';
}

function formatMoment(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function ProjectWorkspace({ projectUid }: { projectUid: string }) {
  const searchParams = useSearchParams();
  const initialModuleUid = searchParams.get('module') || '';
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [activeModuleUid, setActiveModuleUid] = useState(initialModuleUid);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingModules, setLoadingModules] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [contentStatusFilter, setContentStatusFilter] = useState<ContentStatusFilter>('active');
  const [taskKeyword, setTaskKeyword] = useState('');
  const [error, setError] = useState('');
  const [actioningUid, setActioningUid] = useState('');

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(defaultProjectForm);
  const [projectSaving, setProjectSaving] = useState(false);

  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModuleUid, setEditingModuleUid] = useState('');
  const [moduleForm, setModuleForm] = useState<ModuleFormState>(defaultModuleForm);
  const [moduleSaving, setModuleSaving] = useState(false);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTaskUid, setEditingTaskUid] = useState('');
  const [taskForm, setTaskForm] = useState<TaskFormState>(defaultTaskForm);
  const [taskSaving, setTaskSaving] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPlan, setPreviewPlan] = useState<PlanPreview | null>(null);
  const [previewCases, setPreviewCases] = useState<PlanCase[]>([]);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<ExecutionRow[]>([]);
  const [historyTaskName, setHistoryTaskName] = useState('');
  const [historyKeyword, setHistoryKeyword] = useState('');
  const [historyEventKeyword, setHistoryEventKeyword] = useState('');
  const [historyExpandedUid, setHistoryExpandedUid] = useState('');
  const [historyEventMap, setHistoryEventMap] = useState<Record<string, ExecutionEvent[]>>({});
  const [historyEventLoadingUid, setHistoryEventLoadingUid] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [generatingUid, setGeneratingUid] = useState('');
  const PAGE_SIZE = 10;

  const activeModule = modules.find((item) => item.moduleUid === activeModuleUid) || null;
  const projectArchived = project?.status === 'archived';
  const defaultTaskModuleUid =
    (activeModule?.status === 'active' ? activeModule.moduleUid : '') || modules.find((item) => item.status === 'active')?.moduleUid || '';
  const filteredTasks = tasks.filter((item) => {
    const keyword = taskKeyword.trim().toLowerCase();
    if (!keyword) return true;
    return (
      item.name.toLowerCase().includes(keyword) ||
      item.targetUrl.toLowerCase().includes(keyword) ||
      item.featureDescription.toLowerCase().includes(keyword)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTasks = filteredTasks.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const filteredHistoryRows = historyRows.filter((item) => {
    const keyword = historyKeyword.trim().toLowerCase();
    if (!keyword) return true;
    return (
      item.executionUid.toLowerCase().includes(keyword) ||
      item.planUid.toLowerCase().includes(keyword) ||
      item.resultSummary.toLowerCase().includes(keyword) ||
      item.errorMessage.toLowerCase().includes(keyword)
    );
  });

  // ── data loading ──
  async function loadProject() {
    setLoadingProject(true);
    try {
      const res = await fetch(`/api/projects/${projectUid}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载项目失败');
      setProject(json.item || null);
      if (json.item) {
        if (json.item.status === 'archived') {
          setContentStatusFilter((current) => (current === 'active' ? 'archived' : current));
        }
        setProjectForm({
          name: json.item.name,
          description: json.item.description,
          coverImageUrl: json.item.coverImageUrl || '',
          authRequired: json.item.authRequired,
          loginUrl: json.item.loginUrl || '',
          loginUsername: json.item.loginUsername || '',
          loginPassword: '',
          loginDescription: json.item.loginDescription || '',
        });
      }
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载项目失败');
    } finally {
      setLoadingProject(false);
    }
  }

  async function loadModules() {
    setLoadingModules(true);
    try {
      const res = await fetch(`/api/projects/${projectUid}/modules?status=${contentStatusFilter}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载模块失败');
      const nextItems = (json.items || []) as ModuleItem[];
      setModules(nextItems);
      setActiveModuleUid((current) => {
        if (current && nextItems.some((item) => item.moduleUid === current)) return current;
        return nextItems[0]?.moduleUid || '';
      });
      if (nextItems.length === 0) setTasks([]);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载模块失败');
    } finally {
      setLoadingModules(false);
    }
  }

  async function loadTasks(moduleUid: string) {
    if (!moduleUid) { setTasks([]); return; }
    setLoadingTasks(true);
    try {
      const qs = new URLSearchParams({ projectUid, moduleUid, page: '1', pageSize: '100', status: contentStatusFilter });
      const res = await fetch(`/api/test-configs?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载任务失败');
      setTasks(json.items || []);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载任务失败');
    } finally {
      setLoadingTasks(false);
    }
  }

  useEffect(() => { void loadProject(); }, [projectUid]);
  useEffect(() => { void loadModules(); }, [projectUid, contentStatusFilter]);
  useEffect(() => { if (!activeModuleUid) return; void loadTasks(activeModuleUid); }, [projectUid, activeModuleUid, contentStatusFilter]);

  // ── form helpers ──
  function resetModuleForm() { setEditingModuleUid(''); setModuleForm(defaultModuleForm); }
  function resetTaskForm() { setEditingTaskUid(''); setTaskForm({ ...defaultTaskForm, moduleUid: defaultTaskModuleUid }); }

  function openProjectSettings() {
    if (!project) return;
    setProjectForm({
      name: project.name, description: project.description, coverImageUrl: project.coverImageUrl || '',
      authRequired: project.authRequired, loginUrl: project.loginUrl || '', loginUsername: project.loginUsername || '',
      loginPassword: '', loginDescription: project.loginDescription || '',
    });
    setProjectModalOpen(true);
  }

  function openCreateModule() {
    if (projectArchived) { setError('请先恢复项目，再新增模块'); return; }
    resetModuleForm(); setModuleModalOpen(true);
  }

  function openEditModule(module: ModuleItem) {
    if (module.status !== 'active') { setError('请先恢复模块，再编辑'); return; }
    setEditingModuleUid(module.moduleUid);
    setModuleForm({ name: module.name, description: module.description || '', sortOrder: module.sortOrder || 100 });
    setModuleModalOpen(true);
  }

  function openCreateTask() {
    if (projectArchived) { setError('请先恢复项目，再创建测试任务'); return; }
    if (!defaultTaskModuleUid && modules.length === 0) { setError('请先创建模块，再创建测试任务'); return; }
    if (!defaultTaskModuleUid) { setError('当前没有可用的启用中模块，请先恢复模块'); return; }
    resetTaskForm(); setTaskModalOpen(true);
  }

  function openEditTask(task: TaskItem) {
    if (task.status !== 'active') { setError('请先恢复任务，再编辑'); return; }
    setEditingTaskUid(task.configUid);
    setTaskForm({ moduleUid: task.moduleUid, sortOrder: task.sortOrder || 100, name: task.name, targetUrl: task.targetUrl, featureDescription: task.featureDescription });
    setTaskModalOpen(true);
  }

  // ── submit handlers ──
  async function submitProject() {
    if (!projectForm.name.trim() || !projectForm.description.trim()) { setError('请填写完整的项目名称和描述'); return; }
    setProjectSaving(true); setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectForm.name.trim(), description: projectForm.description.trim(), coverImageUrl: projectForm.coverImageUrl.trim(),
          authRequired: projectForm.authRequired,
          loginUrl: projectForm.authRequired ? projectForm.loginUrl.trim() : '',
          loginUsername: projectForm.authRequired ? projectForm.loginUsername.trim() : '',
          loginPassword: projectForm.authRequired ? projectForm.loginPassword : '',
          loginDescription: projectForm.authRequired ? projectForm.loginDescription.trim() : '',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '保存项目失败');
      setProjectModalOpen(false);
      await loadProject(); await loadModules();
      if (activeModuleUid) await loadTasks(activeModuleUid);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '保存项目失败'); }
    finally { setProjectSaving(false); }
  }

  async function submitModule() {
    if (!moduleForm.name.trim()) { setError('请输入模块名称'); return; }
    setModuleSaving(true); setError('');
    try {
      const res = await fetch(editingModuleUid ? `/api/modules/${editingModuleUid}` : `/api/projects/${projectUid}/modules`, {
        method: editingModuleUid ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: moduleForm.name.trim(), description: moduleForm.description.trim(), sortOrder: moduleForm.sortOrder }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '保存模块失败');
      setModuleModalOpen(false);
      const nextActiveUid = json.item?.moduleUid ? String(json.item.moduleUid) : activeModuleUid;
      await loadProject(); await loadModules();
      if (nextActiveUid) { setActiveModuleUid(nextActiveUid); await loadTasks(nextActiveUid); }
      resetModuleForm();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '保存模块失败'); }
    finally { setModuleSaving(false); }
  }

  async function deleteModule(module: ModuleItem) {
    if (!confirm(`确认归档模块"${module.name}"？该模块下的测试任务也会一并归档。`)) return;
    setError('');
    try {
      const res = await fetch(`/api/modules/${module.moduleUid}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '归档模块失败');
      await loadProject(); await loadModules();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '归档模块失败'); }
  }

  async function restoreModule(module: ModuleItem) {
    setActioningUid(module.moduleUid); setError('');
    try {
      const res = await fetch(`/api/modules/${module.moduleUid}/restore`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '恢复模块失败');
      await loadProject(); await loadModules();
      if (contentStatusFilter === 'archived') setTasks([]);
      else { setActiveModuleUid(module.moduleUid); await loadTasks(module.moduleUid); }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '恢复模块失败'); }
    finally { setActioningUid(''); }
  }

  async function submitTask() {
    if (!taskForm.moduleUid || !taskForm.name.trim() || !taskForm.targetUrl.trim() || !taskForm.featureDescription.trim()) {
      setError('请填写完整的模块、任务名称、目标 URL 和任务描述'); return;
    }
    setTaskSaving(true); setError('');
    try {
      const res = await fetch(editingTaskUid ? `/api/test-configs/${editingTaskUid}` : '/api/test-configs', {
        method: editingTaskUid ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectUid, moduleUid: taskForm.moduleUid, sortOrder: taskForm.sortOrder, name: taskForm.name.trim(), targetUrl: taskForm.targetUrl.trim(), featureDescription: taskForm.featureDescription.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '保存任务失败');
      setTaskModalOpen(false); setActiveModuleUid(taskForm.moduleUid);
      await loadProject(); await loadModules(); await loadTasks(taskForm.moduleUid); resetTaskForm();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '保存任务失败'); }
    finally { setTaskSaving(false); }
  }

  async function deleteTask(task: TaskItem) {
    if (!confirm(`确认归档测试任务"${task.name}"？`)) return;
    setActioningUid(task.configUid); setError('');
    try {
      const res = await fetch(`/api/test-configs/${task.configUid}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '归档任务失败');
      await loadTasks(task.moduleUid); await loadModules(); await loadProject();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '归档任务失败'); }
    finally { setActioningUid(''); }
  }

  async function restoreTask(task: TaskItem) {
    setActioningUid(task.configUid); setError('');
    try {
      const res = await fetch(`/api/test-configs/${task.configUid}/restore`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '恢复任务失败');
      await loadTasks(task.moduleUid); await loadModules(); await loadProject();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '恢复任务失败'); }
    finally { setActioningUid(''); }
  }

  async function restoreProject() {
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/restore`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '恢复项目失败');
      setContentStatusFilter('active'); await loadProject(); await loadModules();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '恢复项目失败'); }
  }

  async function generatePlan(configUid: string) {
    setGeneratingUid(configUid); setActioningUid(configUid); setError('');
    const savedModuleUid = activeModuleUid;
    try {
      const res = await fetch(`/api/test-configs/${configUid}/generate-plan`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '生成测试计划失败');
      await loadTasks(savedModuleUid); await loadModules(); await loadProject();
      setActiveModuleUid(savedModuleUid);
      await openPlanPreviewByUid(json.planUid);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '生成测试计划失败'); }
    finally { setGeneratingUid(''); setActioningUid(''); }
  }

  async function executePlan(task: TaskItem) {
    if (!task.latestPlanUid) { setError('请先为该任务生成测试计划'); return; }
    setActioningUid(task.configUid); setError('');
    try {
      const res = await fetch(`/api/test-plans/${task.latestPlanUid}/execute`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '执行测试计划失败');
      window.location.href = `/runs/${json.executionUid}`;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '执行测试计划失败');
      setActioningUid('');
    }
  }

  async function openPlanPreviewByUid(planUid?: string) {
    if (!planUid) { setError('当前任务还没有测试计划'); return; }
    setPreviewOpen(true); setPreviewLoading(true);
    try {
      const res = await fetch(`/api/test-plans/${planUid}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载测试计划失败');
      setPreviewPlan(json.plan); setPreviewCases(json.cases || []);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '加载测试计划失败'); setPreviewOpen(false); }
    finally { setPreviewLoading(false); }
  }

  async function openExecutionHistory(task: TaskItem) {
    setHistoryOpen(true); setHistoryLoading(true); setHistoryTaskName(task.name);
    setHistoryKeyword(''); setHistoryEventKeyword(''); setHistoryExpandedUid(''); setHistoryEventMap({}); setHistoryEventLoadingUid('');
    try {
      const res = await fetch(`/api/test-configs/${task.configUid}/executions?limit=50`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载执行历史失败');
      setHistoryRows(json.items || []);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '加载执行历史失败'); setHistoryOpen(false); }
    finally { setHistoryLoading(false); }
  }

  async function toggleHistoryEvents(executionUid: string) {
    if (historyExpandedUid === executionUid) { setHistoryExpandedUid(''); return; }
    setHistoryExpandedUid(executionUid);
    if (historyEventMap[executionUid]) return;
    setHistoryEventLoadingUid(executionUid);
    try {
      const res = await fetch(`/api/test-executions/${executionUid}/events`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载执行日志失败');
      setHistoryEventMap((current) => ({ ...current, [executionUid]: json.events || [] }));
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '加载执行日志失败'); }
    finally { setHistoryEventLoadingUid(''); }
  }

  function getVisibleEvents(executionUid: string) {
    const keyword = historyEventKeyword.trim().toLowerCase();
    const all = historyEventMap[executionUid] || [];
    return all.filter((item) => item.eventType !== 'frame').filter((item) => {
      if (!keyword) return true;
      return item.eventType.toLowerCase().includes(keyword) || renderEventLine(item).toLowerCase().includes(keyword);
    }).slice(-300);
  }

  function downloadTextFile(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadPlanScript() {
    if (!previewPlan) return;
    const content = previewPlan.generatedFiles?.[0]?.content || previewPlan.planCode || '';
    const filename = (previewPlan.generatedFiles?.[0]?.name || `${previewPlan.planUid}.spec.ts`).replace(/\s+/g, '-');
    downloadTextFile(filename, content, 'text/plain;charset=utf-8');
  }

  // ── render ──
  return (
    <div className="space-y-4">
      {/* ── compact top bar ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {loadingProject ? '加载中...' : project?.name || '项目不存在'}
          </h1>
          {project && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{project.moduleCount} 模块</span>
              <span className="text-slate-300">|</span>
              <span>{project.taskCount} 任务</span>
              <span className="text-slate-300">|</span>
              <span>通过率 {formatPassRate(project.executionCount, project.passRate)}</span>
              {project.activeExecutionCount > 0 && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="text-amber-600">{project.activeExecutionCount} 执行中</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openProjectSettings} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 transition hover:bg-slate-50">
            项目设置
          </button>
          <button onClick={openCreateModule} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 transition hover:bg-slate-50">
            新建模块
          </button>
          <button onClick={openCreateTask} className="h-8 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-700">
            新建任务
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      {/* ── 2:8 layout ── */}
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
        {/* ── modules sidebar ── */}
        <aside className="space-y-1.5">
          {loadingModules && <p className="px-3 py-4 text-xs text-slate-400">加载模块中...</p>}

          {!loadingModules && modules.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500">
              还没有模块
            </div>
          )}

          {!loadingModules && modules.map((module) => {
            const active = module.moduleUid === activeModuleUid;
            return (
              <button
                key={module.moduleUid}
                onClick={() => { setActiveModuleUid(module.moduleUid); setCurrentPage(1); }}
                className={`w-full rounded-lg px-3 py-2.5 text-left transition ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{module.name}</span>
                  <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    active ? 'bg-white/20 text-white/80' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {module.taskCount}
                  </span>
                </div>
                <div className={`mt-1 flex items-center gap-2 text-[11px] ${active ? 'text-white/60' : 'text-slate-400'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusDot(module.latestExecutionStatus)}`} />
                  <span>{formatPassRate(module.executionCount, module.passRate)} 通过</span>
                  <span>· {module.executionCount} 次</span>
                </div>
              </button>
            );
          })}

          {activeModule && !loadingModules && (
            <div className="mt-2 flex gap-1 px-1">
              <button onClick={() => openEditModule(activeModule)} className="flex-1 rounded-md border border-slate-200 bg-white py-1.5 text-[11px] text-slate-500 hover:bg-slate-50">
                编辑
              </button>
              <button onClick={() => void deleteModule(activeModule)} className="flex-1 rounded-md border border-rose-200 bg-rose-50 py-1.5 text-[11px] text-rose-600 hover:bg-rose-100">
                归档
              </button>
            </div>
          )}
        </aside>

        {/* ── task table area ── */}
        <div className="min-w-0">
          {/* search bar */}
          <div className="mb-3 flex items-center gap-3">
            <input
              value={taskKeyword}
              onChange={(e) => { setTaskKeyword(e.target.value); setCurrentPage(1); }}
              placeholder="搜索任务名称、URL、描述..."
              className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
            />
            {activeModule && (
              <span className="flex-shrink-0 text-xs text-slate-400">{activeModule.name} · {filteredTasks.length} 个任务</span>
            )}
          </div>

          {loadingTasks && <p className="py-8 text-center text-sm text-slate-400">加载任务中...</p>}

          {!loadingTasks && !activeModule && (
            <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">请先选择或创建模块</p>
              <p className="mt-1 text-xs text-slate-400">左侧选中模块后，这里会展示该模块下的测试任务。</p>
            </div>
          )}

          {!loadingTasks && activeModule && filteredTasks.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">当前模块没有测试任务</p>
              <button onClick={openCreateTask} className="mt-3 h-8 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white hover:bg-slate-700">
                创建测试任务
              </button>
            </div>
          )}

          {!loadingTasks && filteredTasks.length > 0 && (
            <>
              <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-slate-50/50">
                      <th className="w-[40px] px-3 py-3 text-center text-xs font-semibold text-slate-400">#</th>
                      <th className="w-[20%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">任务名称</th>
                      <th className="w-[28%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">目标地址</th>
                      <th className="w-[8%] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">计划</th>
                      <th className="w-[10%] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">状态</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {paginatedTasks.map((task, idx) => (
                      <tr key={task.configUid} className="group transition-colors hover:bg-slate-50/70">
                        <td className="px-3 py-3 text-center text-xs tabular-nums text-slate-400">
                          {(safePage - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-slate-800">{task.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block truncate text-xs text-slate-500" title={task.targetUrl}>{task.targetUrl}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {task.latestPlanUid ? (
                            <button onClick={() => void openPlanPreviewByUid(task.latestPlanUid)} className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 transition hover:bg-blue-100">
                              v{task.latestPlanVersion}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusTone(task.latestExecutionStatus)}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDot(task.latestExecutionStatus)}`} />
                            {statusLabel(task.latestExecutionStatus)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                            {/* 生成计划 */}
                            <button
                              onClick={() => void generatePlan(task.configUid)}
                              disabled={Boolean(actioningUid)}
                              title="生成测试计划"
                              className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"
                            >
                              {generatingUid === task.configUid ? '生成中' : '生成'}
                            </button>
                            {/* 执行 */}
                            <button
                              onClick={() => void executePlan(task)}
                              disabled={Boolean(actioningUid)}
                              title="执行测试计划"
                              className="h-7 rounded-md bg-slate-800 px-2.5 text-[11px] font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
                            >
                              执行
                            </button>
                            {/* 分隔线 */}
                            <span className="mx-0.5 h-4 w-px bg-slate-200" />
                            {/* 历史 */}
                            <button
                              onClick={() => void openExecutionHistory(task)}
                              title="执行历史"
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </button>
                            {/* 编辑 */}
                            <button
                              onClick={() => openEditTask(task)}
                              disabled={Boolean(actioningUid)}
                              title="编辑任务"
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l2.651 2.651M5 19h4l10.5-10.5a1.875 1.875 0 00-2.652-2.652L6.5 16.5V19H5z" /></svg>
                            </button>
                            {/* 归档 */}
                            <button
                              onClick={() => void deleteTask(task)}
                              disabled={Boolean(actioningUid)}
                              title="归档任务"
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-.867 12.142A2 2 0 0117.138 21H6.862a2 2 0 01-1.995-1.858L4 7m16 0H4m4 0V4a1 1 0 011-1h6a1 1 0 011 1v3" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* pagination */}
              {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    共 {filteredTasks.length} 条，第 {safePage}/{totalPages} 页
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                      disabled={safePage <= 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      &lt;
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                      .reduce<(number | 'dot')[]>((acc, p, i, arr) => {
                        if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('dot');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === 'dot' ? (
                          <span key={`dot-${i}`} className="px-1 text-xs text-slate-300">...</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setCurrentPage(p)}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition ${
                              p === safePage
                                ? 'bg-slate-800 text-white shadow-sm'
                                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {p}
                          </button>
                        ),
                      )}
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                      disabled={safePage >= totalPages}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modals (unchanged logic, refreshed style) ── */}

      {projectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[720px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">编辑项目</h2>
              <button onClick={() => setProjectModalOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">关闭</button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto px-5 py-5">
              <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">项目名称</label>
                    <input value={projectForm.name} onChange={(e) => setProjectForm((c) => ({ ...c, name: e.target.value }))}
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">项目描述</label>
                    <textarea value={projectForm.description} onChange={(e) => setProjectForm((c) => ({ ...c, description: e.target.value }))}
                      rows={4} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-slate-400" />
                  </div>
                </div>
                <div className="space-y-4 rounded-lg bg-slate-50 p-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={projectForm.authRequired} onChange={(e) => setProjectForm((c) => ({ ...c, authRequired: e.target.checked }))} />
                    启用统一登录认证
                  </label>
                  {projectForm.authRequired && (
                    <div className="space-y-3">
                      <input value={projectForm.loginUrl} onChange={(e) => setProjectForm((c) => ({ ...c, loginUrl: e.target.value }))}
                        placeholder="登录页 URL" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
                      <input value={projectForm.loginUsername} onChange={(e) => setProjectForm((c) => ({ ...c, loginUsername: e.target.value }))}
                        placeholder="登录账号" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
                      <input type="password" value={projectForm.loginPassword} onChange={(e) => setProjectForm((c) => ({ ...c, loginPassword: e.target.value }))}
                        placeholder="密码（留空沿用原密码）" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
                      <textarea value={projectForm.loginDescription} onChange={(e) => setProjectForm((c) => ({ ...c, loginDescription: e.target.value }))}
                        rows={3} placeholder="登录方式说明" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-slate-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button onClick={() => setProjectModalOpen(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-600">取消</button>
              <button onClick={() => void submitProject()} disabled={projectSaving}
                className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                {projectSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {moduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[480px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">{editingModuleUid ? '编辑模块' : '新建模块'}</h2>
              <button onClick={() => { setModuleModalOpen(false); resetModuleForm(); }} className="text-sm text-slate-400 hover:text-slate-600">关闭</button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">模块名称</label>
                <input value={moduleForm.name} onChange={(e) => setModuleForm((c) => ({ ...c, name: e.target.value }))}
                  placeholder="例如：商品列表" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">排序号</label>
                <input type="number" value={moduleForm.sortOrder} onChange={(e) => setModuleForm((c) => ({ ...c, sortOrder: Number(e.target.value) || 100 }))}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">模块描述</label>
                <textarea value={moduleForm.description} onChange={(e) => setModuleForm((c) => ({ ...c, description: e.target.value }))}
                  rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-slate-400" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button onClick={() => { setModuleModalOpen(false); resetModuleForm(); }} className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-600">取消</button>
              <button onClick={() => void submitModule()} disabled={moduleSaving}
                className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                {moduleSaving ? '保存中...' : editingModuleUid ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {taskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[680px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">{editingTaskUid ? '编辑任务' : '新建任务'}</h2>
              <button onClick={() => { setTaskModalOpen(false); resetTaskForm(); }} className="text-sm text-slate-400 hover:text-slate-600">关闭</button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">所属模块</label>
                  <select value={taskForm.moduleUid} onChange={(e) => setTaskForm((c) => ({ ...c, moduleUid: e.target.value }))}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400">
                    {modules.map((m) => <option key={m.moduleUid} value={m.moduleUid}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">排序号</label>
                  <input type="number" value={taskForm.sortOrder} onChange={(e) => setTaskForm((c) => ({ ...c, sortOrder: Number(e.target.value) || 100 }))}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">任务名称</label>
                <input value={taskForm.name} onChange={(e) => setTaskForm((c) => ({ ...c, name: e.target.value }))}
                  placeholder="例如：新增商品主流程" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">目标 URL</label>
                <input value={taskForm.targetUrl} onChange={(e) => setTaskForm((c) => ({ ...c, targetUrl: e.target.value }))}
                  placeholder="https://example.com/path" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">任务描述</label>
                <textarea value={taskForm.featureDescription} onChange={(e) => setTaskForm((c) => ({ ...c, featureDescription: e.target.value }))}
                  rows={5} placeholder="描述测试目标、关键路径、断言和风险点。" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-slate-400" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button onClick={() => { setTaskModalOpen(false); resetTaskForm(); }} className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-600">取消</button>
              <button onClick={() => void submitTask()} disabled={taskSaving}
                className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                {taskSaving ? '保存中...' : editingTaskUid ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[900px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">测试计划预览</h2>
              <div className="flex items-center gap-2">
                <button onClick={downloadPlanScript} disabled={!previewPlan} className="h-8 rounded-lg border border-slate-200 px-3 text-xs text-slate-600 disabled:opacity-50">下载脚本</button>
                <button onClick={() => setPreviewOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">关闭</button>
              </div>
            </div>
            <div className="max-h-[80vh] overflow-y-auto px-5 py-5">
              {previewLoading && <p className="text-sm text-slate-400">加载中...</p>}
              {!previewLoading && previewPlan && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{previewPlan.planUid}</span>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">v{previewPlan.planVersion}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{previewPlan.planTitle}</h3>
                  <p className="text-sm text-slate-500">{previewPlan.planSummary}</p>
                  {previewCases.length > 0 && (
                    <div className="grid gap-3 md:grid-cols-3">
                      {previewCases.map((c) => (
                        <div key={c.caseUid} className="rounded-lg border border-slate-200 p-3">
                          <span className="text-[10px] font-medium uppercase text-slate-400">{c.tier}</span>
                          <p className="mt-1 text-sm font-medium text-slate-800">{c.caseName}</p>
                          <p className="mt-1 text-xs text-slate-500">{c.expectedResult}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <pre className="max-h-[400px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
{previewPlan.generatedFiles?.[0]?.content || previewPlan.planCode || '// 暂无代码'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[900px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">执行历史</h2>
                <p className="mt-0.5 text-xs text-slate-400">{historyTaskName}</p>
              </div>
              <div className="flex items-center gap-2">
                <input value={historyKeyword} onChange={(e) => setHistoryKeyword(e.target.value)} placeholder="搜索"
                  className="h-8 w-40 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-slate-400" />
                <input value={historyEventKeyword} onChange={(e) => setHistoryEventKeyword(e.target.value)} placeholder="筛选日志"
                  className="h-8 w-40 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-slate-400" />
                <button onClick={() => setHistoryOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">关闭</button>
              </div>
            </div>
            <div className="max-h-[80vh] overflow-y-auto px-5 py-5">
              {historyLoading && <p className="text-sm text-slate-400">加载中...</p>}
              {!historyLoading && filteredHistoryRows.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">还没有执行记录</p>
              )}
              {!historyLoading && filteredHistoryRows.length > 0 && (
                <div className="space-y-3">
                  {filteredHistoryRows.map((row) => {
                    const visibleEvents = getVisibleEvents(row.executionUid);
                    const errorCount = visibleEvents.filter(isErrorEvent).length;
                    return (
                      <div key={row.executionUid} className={`rounded-lg border p-4 ${
                        row.status === 'failed' ? 'border-rose-200 bg-rose-50/50' : row.status === 'running' ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200'
                      }`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${statusTone(row.status)}`}>{row.status}</span>
                              <span className="text-[11px] text-slate-400">{row.executionUid}</span>
                              {errorCount > 0 && <span className="text-[11px] text-rose-600">{errorCount} 条异常</span>}
                            </div>
                            <p className="mt-2 text-sm text-slate-700">{row.resultSummary || '暂无摘要'}</p>
                            {row.errorMessage && <p className="mt-1 text-sm text-rose-600">{row.errorMessage}</p>}
                            <div className="mt-2 flex gap-3 text-[11px] text-slate-400">
                              <span>开始：{row.startedAt ? formatMoment(row.startedAt) : '-'}</span>
                              <span>耗时：{row.durationMs ? `${(row.durationMs / 1000).toFixed(1)}s` : '-'}</span>
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 gap-2">
                            <a href={`/runs/${row.executionUid}`}
                              className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-100">
                              查看详情
                            </a>
                            <button onClick={() => void toggleHistoryEvents(row.executionUid)}
                              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                              {historyExpandedUid === row.executionUid ? '收起' : '展开日志'}
                            </button>
                          </div>
                        </div>
                        {historyExpandedUid === row.executionUid && (
                          <div className="mt-3 rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                            {historyEventLoadingUid === row.executionUid && <p className="text-slate-400">加载中...</p>}
                            {historyEventLoadingUid !== row.executionUid && visibleEvents.length === 0 && <p className="text-slate-400">暂无日志</p>}
                            {historyEventLoadingUid !== row.executionUid && visibleEvents.length > 0 && (
                              <div className="max-h-[300px] space-y-1.5 overflow-y-auto">
                                {visibleEvents.map((event, i) => (
                                  <div key={`${row.executionUid}-${event.createdAt}-${i}`}
                                    className={`rounded px-2.5 py-2 ${isErrorEvent(event) ? 'bg-rose-500/15' : 'bg-white/5'}`}>
                                    <div className="flex gap-2 text-[10px] text-slate-400">
                                      <span>{event.eventType}</span>
                                      <span>{new Date(event.createdAt).toLocaleTimeString('zh-CN')}</span>
                                    </div>
                                    <p className="mt-1 whitespace-pre-wrap break-words leading-5 text-slate-100">{renderEventLine(event)}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* 生成计划全屏遮罩 */}
      {generatingUid && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/90 px-10 py-8 shadow-2xl">
            <svg className="h-10 w-10 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm font-medium text-slate-700">正在生成测试计划，请稍候…</span>
          </div>
        </div>
      )}
    </div>
  );
}
