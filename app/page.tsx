'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

type ProjectStatus = 'active' | 'archived';

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

const defaultForm: ProjectFormState = {
  name: '',
  description: '',
  coverImageUrl: '',
  authRequired: false,
  loginUrl: '',
  loginUsername: '',
  loginPassword: '',
  loginDescription: '',
};

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
      return 'bg-white/72 text-slate-600 ring-white/45';
  }
}

function buildCoverStyle(project: ProjectItem): React.CSSProperties {
  const fallback = `linear-gradient(135deg, rgba(48,79,254,0.16), rgba(255,255,255,0.04) 34%, rgba(255,158,74,0.22))`;
  if (!project.coverImageUrl) {
    return {
      backgroundImage: fallback,
    };
  }

  return {
    backgroundImage: `linear-gradient(180deg, rgba(18,28,45,0.12), rgba(18,28,45,0.78)), url(${project.coverImageUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}

function formatPassRate(total: number, passRate: number): string {
  return total > 0 ? `${passRate}%` : '暂无';
}

function formatExecutionMoment(value: string): string {
  if (!value) return '暂无';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HomePage() {
  const router = useRouter();
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus>('active');
  const [error, setError] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [editingUid, setEditingUid] = useState('');
  const [navigatingProjectUid, setNavigatingProjectUid] = useState('');
  const [form, setForm] = useState<ProjectFormState>(defaultForm);
  const [isNavigating, startNavigation] = useTransition();

  const isEditing = Boolean(editingUid);
  const totalModules = items.reduce((sum, item) => sum + item.moduleCount, 0);
  const totalTasks = items.reduce((sum, item) => sum + item.taskCount, 0);
  const totalExecutions = items.reduce((sum, item) => sum + item.executionCount, 0);
  const totalPassedExecutions = items.reduce((sum, item) => sum + item.passedExecutionCount, 0);
  const totalActiveExecutions = items.reduce((sum, item) => sum + item.activeExecutionCount, 0);
  const fleetPassRate = totalExecutions > 0 ? Math.round((totalPassedExecutions / totalExecutions) * 100) : 0;

async function loadProjects() {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        page: '1',
        pageSize: '48',
        status: statusFilter,
      });
      if (keyword.trim()) qs.set('keyword', keyword.trim());

      const res = await fetch(`/api/projects?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载项目失败');
      setItems(json.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载项目失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, [keyword, statusFilter]);

  useEffect(() => {
    if (!isNavigating) {
      setNavigatingProjectUid('');
    }
  }, [isNavigating]);

  function resetForm() {
    setEditingUid('');
    setForm(defaultForm);
  }

  function openCreate() {
    resetForm();
    setOpenModal(true);
  }

  function openEdit(item: ProjectItem) {
    setEditingUid(item.projectUid);
    setForm({
      name: item.name,
      description: item.description,
      coverImageUrl: item.coverImageUrl,
      authRequired: item.authRequired,
      loginUrl: item.loginUrl || '',
      loginUsername: item.loginUsername || '',
      loginPassword: '',
      loginDescription: item.loginDescription || '',
    });
    setOpenModal(true);
  }

  async function submitProject() {
    if (!form.name.trim() || !form.description.trim()) {
      setError('请填写完整的项目名称和描述');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        coverImageUrl: form.coverImageUrl.trim(),
        authRequired: form.authRequired,
        loginUrl: form.authRequired ? form.loginUrl.trim() : '',
        loginUsername: form.authRequired ? form.loginUsername.trim() : '',
        loginPassword: form.authRequired ? form.loginPassword : '',
        loginDescription: form.authRequired ? form.loginDescription.trim() : '',
      };

      const res = await fetch(isEditing ? `/api/projects/${editingUid}` : '/api/projects', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '保存项目失败');

      setOpenModal(false);
      resetForm();
      await loadProjects();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存项目失败');
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(projectUid: string) {
    if (!confirm('确认归档这个测试项目？项目下的模块和任务会一并归档。')) return;

    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '删除项目失败');
      await loadProjects();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '删除项目失败');
    }
  }

  async function restoreProject(projectUid: string) {
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/restore`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '恢复项目失败');
      if (statusFilter === 'archived') {
        setItems((current) => current.filter((item) => item.projectUid !== projectUid));
      } else {
        await loadProjects();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '恢复项目失败');
    }
  }

  function openProject(projectUid: string) {
    setNavigatingProjectUid(projectUid);
    startNavigation(() => {
      router.push(`/projects/${projectUid}`);
    });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(91,135,255,0.17),transparent_32%),radial-gradient(circle_at_84%_18%,rgba(255,176,118,0.22),transparent_24%),linear-gradient(180deg,#f7f9fe_0%,#eef2f8_100%)] text-slate-900">
      <div className="mx-auto max-w-[1360px] px-5 py-8 md:px-8 lg:px-10">
        <section className="relative overflow-hidden rounded-[32px] border border-white/60 bg-white/72 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl md:p-8">
          <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(90deg,rgba(83,106,255,0.11),rgba(255,186,116,0.09),rgba(255,255,255,0))]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-slate-400">AI E2E Project Hub</p>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-950 md:text-5xl">
                让测试能力从单个用例，升级成可运营的项目资产。
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                首页现在以测试项目为中心组织数据。项目承载统一登录认证、模块划分、任务列表和执行结果，避免重复维护同一套环境信息。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px] xl:grid-cols-4">
              <div className="rounded-[24px] border border-white/70 bg-white/78 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">项目数</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{items.length}</p>
              </div>
              <div className="rounded-[24px] border border-white/70 bg-white/78 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">模块总数</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{totalModules}</p>
              </div>
              <div className="rounded-[24px] border border-white/70 bg-white/78 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">任务总数</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{totalTasks}</p>
              </div>
              <div className="rounded-[24px] border border-white/70 bg-white/78 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">整体通过率</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                  {formatPassRate(totalExecutions, fleetPassRate)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {totalExecutions > 0
                    ? `${totalPassedExecutions}/${totalExecutions} 通过 · ${totalActiveExecutions} 个执行中`
                    : '还没有执行记录'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 flex flex-col gap-4 rounded-[28px] border border-white/60 bg-white/65 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.09)] backdrop-blur-xl md:flex-row md:items-center md:justify-between md:p-5">
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索项目名称或描述"
              className="h-12 w-full rounded-2xl border border-slate-200/80 bg-white/84 px-4 text-sm text-slate-700 outline-none transition focus:border-slate-400 md:max-w-[360px]"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ProjectStatus)}
              className="h-12 rounded-2xl border border-slate-200/80 bg-white/84 px-4 text-sm text-slate-700 outline-none transition focus:border-slate-400"
            >
              <option value="active">启用中项目</option>
              <option value="archived">已归档项目</option>
            </select>
            <button
              onClick={() => void loadProjects()}
              className="h-12 rounded-2xl border border-slate-200/80 bg-white/84 px-4 text-sm text-slate-700 transition hover:bg-white"
            >
              刷新
            </button>
          </div>

          <button
            onClick={openCreate}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#111827,#334155)] px-5 text-sm font-medium text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] transition hover:scale-[1.01] hover:shadow-[0_24px_48px_rgba(15,23,42,0.22)]"
          >
            新建测试项目
          </button>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="mt-6">
          {loading && (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[360px] animate-pulse rounded-[30px] border border-white/60 bg-white/55 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
                />
              ))}
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="rounded-[32px] border border-dashed border-slate-300/90 bg-white/55 px-6 py-16 text-center shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
              <p className="text-xl font-semibold tracking-[-0.02em] text-slate-900">还没有测试项目</p>
              <p className="mt-2 text-sm text-slate-500">先创建一个项目，把统一登录和模块结构建立起来，再往里面添加具体测试任务。</p>
              <button
                onClick={openCreate}
                className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm text-white transition hover:bg-slate-800"
              >
                创建第一个项目
              </button>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <article
                  key={item.projectUid}
                  className="group relative overflow-hidden rounded-[32px] border border-white/70 bg-white/64 shadow-[0_20px_68px_rgba(15,23,42,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_80px_rgba(15,23,42,0.16)]"
                >
                  <div className="min-h-[190px] px-6 pb-6 pt-5 text-white" style={buildCoverStyle(item)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/18 px-3 py-1 text-[11px] font-medium tracking-[0.16em] text-white/88 backdrop-blur-md">
                          {item.moduleCount} 个模块
                        </span>
                        <span className="rounded-full bg-white/18 px-3 py-1 text-[11px] font-medium tracking-[0.16em] text-white/88 backdrop-blur-md">
                          {item.taskCount} 个任务
                        </span>
                        {item.activeExecutionCount > 0 && (
                          <span className="rounded-full bg-white/18 px-3 py-1 text-[11px] font-medium tracking-[0.16em] text-white/88 backdrop-blur-md">
                            {item.activeExecutionCount} 个执行中
                          </span>
                        )}
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-medium ring-1 backdrop-blur-md ${statusTone(item.latestExecutionStatus)}`}>
                        {item.latestExecutionStatus || '暂无执行'}
                      </span>
                    </div>

                    <div className="mt-14">
                      {item.status === 'archived' && (
                        <span className="inline-flex rounded-full bg-black/20 px-3 py-1 text-[11px] font-medium tracking-[0.16em] text-white/88 backdrop-blur-md">
                          已归档
                        </span>
                      )}
                      <h2 className="text-2xl font-semibold tracking-[-0.03em]">{item.name}</h2>
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/78">{item.description}</p>
                    </div>
                  </div>

                  <div className="space-y-4 px-6 pb-6 pt-5 text-slate-700">
                    <div className="grid gap-3 rounded-[24px] bg-slate-50/90 p-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">认证</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">{item.authRequired ? '项目统一登录' : '无需登录'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">最近更新</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">
                          {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('zh-CN') : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">执行通过率</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">{formatPassRate(item.executionCount, item.passRate)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.executionCount > 0
                            ? `${item.passedExecutionCount} 通过 / ${item.failedExecutionCount} 失败`
                            : '暂无执行'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">最近执行</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">{formatExecutionMoment(item.lastExecutionAt)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.executionCount > 0 ? `累计 ${item.executionCount} 次` : '等待首次执行'}
                        </p>
                      </div>
                    </div>

                    {item.authRequired && item.loginDescription && (
                      <div className="rounded-[22px] border border-slate-200/80 bg-white/84 px-4 py-3 text-xs leading-6 text-slate-500">
                        登录方式说明：{item.loginDescription}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => openProject(item.projectUid)}
                        disabled={isNavigating && navigatingProjectUid === item.projectUid}
                        className={`inline-flex h-11 flex-1 items-center justify-center rounded-2xl px-4 text-sm font-medium transition disabled:cursor-wait disabled:opacity-80 ${
                          item.status === 'archived'
                            ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            : 'bg-slate-950 text-white hover:bg-slate-800'
                        }`}
                      >
                        {isNavigating && navigatingProjectUid === item.projectUid
                          ? '正在进入...'
                          : item.status === 'archived'
                            ? '查看归档内容'
                            : '进入项目'}
                      </button>
                      {item.status === 'active' ? (
                        <>
                          <button
                            onClick={() => openEdit(item)}
                            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 transition hover:bg-slate-50"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => void deleteProject(item.projectUid)}
                            className="inline-flex h-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm text-rose-700 transition hover:bg-rose-100"
                          >
                            归档
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => void restoreProject(item.projectUid)}
                          className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm text-emerald-700 transition hover:bg-emerald-100"
                        >
                          恢复
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/28 p-3 backdrop-blur-sm md:items-center">
          <div className="w-full max-w-[760px] overflow-hidden rounded-[32px] border border-white/70 bg-white/96 shadow-[0_28px_90px_rgba(15,23,42,0.28)]">
            <div className="border-b border-slate-200/80 px-6 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Project</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    {isEditing ? '编辑测试项目' : '新建测试项目'}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setOpenModal(false);
                    resetForm();
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-600"
                >
                  关闭
                </button>
              </div>
            </div>

            <div className="max-h-[80vh] overflow-y-auto px-6 py-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">项目名称</label>
                    <input
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="例如：商品中心回归"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">卡片背景图</label>
                    <input
                      value={form.coverImageUrl}
                      onChange={(event) => setForm((current) => ({ ...current, coverImageUrl: event.target.value }))}
                      placeholder="https://..."
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">项目描述</label>
                    <textarea
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      rows={6}
                      placeholder="描述项目覆盖的业务范围、关键风险点和回归目标。"
                      className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-5 rounded-[28px] bg-slate-50/80 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">项目统一登录认证</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">项目下所有测试任务自动继承，不用重复录入。</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.authRequired}
                        onChange={(event) => setForm((current) => ({ ...current, authRequired: event.target.checked }))}
                      />
                      启用
                    </label>
                  </div>

                  {form.authRequired ? (
                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">登录页 URL</label>
                        <input
                          value={form.loginUrl}
                          onChange={(event) => setForm((current) => ({ ...current, loginUrl: event.target.value }))}
                          placeholder="https://example.com/login"
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">登录账号</label>
                        <input
                          value={form.loginUsername}
                          onChange={(event) => setForm((current) => ({ ...current, loginUsername: event.target.value }))}
                          placeholder="手机号 / 邮箱 / 用户名"
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">登录密码</label>
                        <input
                          type="password"
                          value={form.loginPassword}
                          onChange={(event) => setForm((current) => ({ ...current, loginPassword: event.target.value }))}
                          placeholder={isEditing ? '留空则沿用原密码' : '仅服务端加密存储'}
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">登录方式说明</label>
                        <textarea
                          value={form.loginDescription}
                          onChange={(event) => setForm((current) => ({ ...current, loginDescription: event.target.value }))}
                          rows={5}
                          placeholder="例如：先切换到“密码登录”tab，再输入账号密码；禁止使用扫码登录。"
                          className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-slate-400"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/84 px-4 py-5 text-sm leading-6 text-slate-500">
                      当前项目不需要统一登录。后续如果发现该业务域必须认证，再在这里补录即可，所有任务会同步继承。
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200/80 px-6 py-5">
              <button
                onClick={() => {
                  setOpenModal(false);
                  resetForm();
                }}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm text-slate-700"
              >
                取消
              </button>
              <button
                onClick={() => void submitProject()}
                disabled={saving}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? '保存中...' : isEditing ? '保存项目' : '创建项目'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
