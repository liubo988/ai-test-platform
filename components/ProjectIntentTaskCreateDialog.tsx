'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { defaultLlmConfigDraft, toLlmDraft, type LLMConfigDraft, type LLMConfigResponse } from '@/lib/llm-config-browser';

type ModuleOption = {
  moduleUid: string;
  name: string;
};

type AttachmentDraft = {
  id: string;
  name: string;
  dataUrl: string;
  purpose: string;
};

type AttachmentSeed = {
  name?: string;
  dataUrl: string;
  purpose?: string;
};

export type ProjectIntentTaskCreateItem = {
  intentDraftUid: string;
  projectUid: string;
  moduleUid: string;
  moduleName: string;
  title: string;
  input: string;
  targetUrlHint: string;
  taskMode: 'page' | 'scenario';
  targetUrl: string;
  featureDescription: string;
  flowStepCount: number;
  attachmentCount: number;
  planReady: boolean;
  planError: string;
  status: 'active' | 'imported' | 'archived';
  importedConfigUid: string;
  importedPlanUid: string;
  importedAt: string;
  createdAt: string;
  updatedAt: string;
  workspacePath: string;
};

export type ProjectIntentDraftSeed = {
  intentDraftUid: string;
  moduleUid: string;
  title: string;
  input: string;
  targetUrl: string;
  targetUrlHint: string;
  attachments: AttachmentSeed[];
  llmConfig: Record<string, unknown>;
  status: 'active' | 'imported' | 'archived';
};

type ProjectIntentTaskCreateResponse = {
  item?: ProjectIntentTaskCreateItem;
  error?: string;
};

type ProjectIntentTaskCreateDialogProps = {
  projectUid: string;
  initialModuleUid: string;
  activeModules: ModuleOption[];
  mode?: 'create' | 'edit';
  initialDraft?: ProjectIntentDraftSeed | null;
  embeddedProjectAuth?: {
    authRequired: boolean;
    loginDescription?: string;
  };
  onClose: () => void;
  onSaved: (item: ProjectIntentTaskCreateItem) => void | Promise<void>;
};

function createDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error(`读取文件 ${file.name} 失败`));
    };
    reader.onerror = () => reject(new Error(`读取文件 ${file.name} 失败`));
    reader.readAsDataURL(file);
  });
}


function createAttachmentDrafts(attachments: AttachmentSeed[]): AttachmentDraft[] {
  return attachments.map((item, index) => ({
    id: createDraftId(),
    name: item.name || `参考图 ${index + 1}`,
    dataUrl: item.dataUrl,
    purpose: item.purpose || '',
  }));
}

export default function ProjectIntentTaskCreateDialog({
  projectUid,
  initialModuleUid,
  activeModules,
  mode = 'create',
  initialDraft = null,
  onClose,
  onSaved,
}: ProjectIntentTaskCreateDialogProps) {
  const [moduleUid, setModuleUid] = useState(initialDraft?.moduleUid || initialModuleUid);
  const [taskName, setTaskName] = useState(initialDraft?.title || '');
  const [input, setInput] = useState(initialDraft?.input || '登录后台后创建一个商机，保存成功后看到新建记录，并且列表中状态为待跟进。');
  const [targetUrl, setTargetUrl] = useState(initialDraft?.targetUrlHint || initialDraft?.targetUrl || '');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>(() => createAttachmentDrafts(initialDraft?.attachments || []));
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [llmConfig, setLlmConfig] = useState<LLMConfigDraft>(defaultLlmConfigDraft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const providerIsImplemented = llmConfig.provider === 'openai' && llmConfig.providerImplemented;
  const selectedModuleName = useMemo(
    () => activeModules.find((item) => item.moduleUid === moduleUid)?.name || '未选择模块',
    [activeModules, moduleUid]
  );
  const configStatusMessage = configLoading
    ? '正在读取共享模型配置…'
    : configError
    ? configError
    : !providerIsImplemented
    ? `当前 provider=${llmConfig.provider} 仅预留配置位，仓库还没实现对应适配器，请先到首页把共享 LLM 切回 openai。`
    : '';

  useEffect(() => {
    setModuleUid(initialDraft?.moduleUid || initialModuleUid);
    setTaskName(initialDraft?.title || '');
    setInput(initialDraft?.input || '登录后台后创建一个商机，保存成功后看到新建记录，并且列表中状态为待跟进。');
    setTargetUrl(initialDraft?.targetUrlHint || initialDraft?.targetUrl || '');
    setAttachments(createAttachmentDrafts(initialDraft?.attachments || []));
    setError('');
  }, [initialDraft, initialModuleUid]);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      setConfigLoading(true);
      setConfigError('');
      try {
        const res = await fetch('/api/llm/config');
        const json = (await res.json().catch(() => null)) as (LLMConfigResponse & { error?: string }) | null;
        if (!res.ok || !json?.llm) {
          throw new Error(json?.error || '加载 LLM 配置失败');
        }
        if (!active) return;
        setLlmConfig(toLlmDraft(json.llm));
      } catch (loadError: unknown) {
        if (!active) return;
        setConfigError(loadError instanceof Error ? loadError.message : '加载 LLM 配置失败');
      } finally {
        if (active) setConfigLoading(false);
      }
    }

    void loadConfig();
    return () => {
      active = false;
    };
  }, [initialDraft?.intentDraftUid]);

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    const availableSlots = Math.max(0, 4 - attachments.length);
    if (availableSlots === 0) {
      setError('最多只能上传 4 张图片');
      return;
    }

    try {
      const nextItems = await Promise.all(
        files.slice(0, availableSlots).map(async (file) => ({
          id: createDraftId(),
          name: file.name,
          dataUrl: await readFileAsDataUrl(file),
          purpose: '',
        }))
      );
      setAttachments((current) => [...current, ...nextItems]);
      setError('');
      if (files.length > availableSlots) {
        setError('最多只能上传 4 张图片，多余图片已忽略');
      }
    } catch (attachmentError: unknown) {
      setError(attachmentError instanceof Error ? attachmentError.message : '读取图片失败');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (configLoading) {
      setError('正在读取共享模型配置，请稍后再试');
      return;
    }
    if (configError) {
      setError(configError);
      return;
    }
    if (!moduleUid) {
      setError('请先选择一个模块');
      return;
    }
    if (!input.trim()) {
      setError('请先输入一句测试目标描述');
      return;
    }
    if (!providerIsImplemented) {
      setError(`当前 provider=${llmConfig.provider} 仅预留配置位，仓库还没实现对应适配器，请先到首页把共享 LLM 切回 openai。`);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const isEditing = mode === 'edit';
      const intentDraftUid = initialDraft?.intentDraftUid || '';
      if (isEditing && !intentDraftUid) {
        throw new Error('缺少意图草稿 ID，无法保存修改');
      }

      const res = await fetch(
        isEditing
          ? `/api/projects/${encodeURIComponent(projectUid)}/intent-drafts/${encodeURIComponent(intentDraftUid)}`
          : `/api/projects/${encodeURIComponent(projectUid)}/intent-drafts`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            moduleUid,
            taskName: taskName.trim(),
            input: input.trim(),
            targetUrl: targetUrl.trim(),
            attachments: attachments.map((item) => ({
              name: item.name,
              dataUrl: item.dataUrl,
              purpose: item.purpose.trim(),
            })),
            llmConfig: {
              provider: llmConfig.provider,
              model: llmConfig.model.trim(),
              baseUrl: llmConfig.baseUrl.trim(),
              apiStyle: llmConfig.apiStyle,
              visionEnabled: llmConfig.visionEnabled,
              selfHealRetries: llmConfig.selfHealRetries,
              maxPlanSteps: llmConfig.maxPlanSteps,
            },
          }),
        }
      );
      const json = (await res.json().catch(() => null)) as ProjectIntentTaskCreateResponse | null;
      if (!res.ok || !json?.item) {
        throw new Error(json?.error || (isEditing ? '更新意图草稿失败' : '创建意图任务失败'));
      }

      await onSaved(json.item);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : mode === 'edit' ? '更新意图草稿失败' : '创建意图任务失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-h-[78vh] overflow-y-auto px-5 py-5">
      <div className="mx-auto max-w-[920px]">
        <form onSubmit={handleSubmit} className="space-y-5">
          {configStatusMessage && !configLoading && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                configError ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              {configStatusMessage}
            </div>
          )}

          {!configLoading && !configError && providerIsImplemented && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
              当前生成使用团队共享 LLM：{llmConfig.provider} / {llmConfig.model} / {llmConfig.apiStyle}
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <section className="rounded-[26px] border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">基础信息</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">先确认归属模块和草稿名称，名称可以留空交给 AI 自动生成。</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                      模块：{selectedModuleName}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                      {mode === 'edit' ? '保存后会重新生成草稿' : '只生成草稿，不自动执行'}
                    </span>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">所属模块</span>
                    <select
                      value={moduleUid}
                      onChange={(event) => setModuleUid(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                    >
                      <option value="">请选择模块</option>
                      {activeModules.map((item) => (
                        <option key={item.moduleUid} value={item.moduleUid}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">任务名称（可选）</span>
                    <input
                      value={taskName}
                      onChange={(event) => setTaskName(event.target.value)}
                      placeholder="留空则自动使用 AI 生成标题"
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-[26px] border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="mb-4">
                  <p className="text-sm font-medium text-slate-900">测试目标</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">把目标动作、成功标准、关键页面写完整，生成的场景卡和脚本会更稳。</p>
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">目标描述</span>
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    rows={7}
                    placeholder="例如：登录后台后创建一个商机，保存成功后看到新建记录，并且列表中状态为待跟进。"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-slate-400"
                  />
                </label>

                <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">目标 URL（可选）</span>
                    <input
                      value={targetUrl}
                      onChange={(event) => setTargetUrl(event.target.value)}
                      placeholder="https://example.com/entry"
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                    />
                  </label>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                    {mode === 'edit'
                      ? '保存后会重新生成这条草稿的场景卡和脚本草稿，不会自动执行。'
                      : '创建后会先保留草稿和脚本，不会自动导入正式任务。'}
                  </div>
                </div>
              </section>
            </div>

            <aside className="lg:sticky lg:top-0 lg:self-start">
              <section className="rounded-[26px] border border-slate-200 bg-slate-50/70 px-5 py-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">截图 / 参考图</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">最多 4 张，用于帮助 AI 理解页面结构和成功态。</p>
                  </div>
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 transition hover:bg-slate-50">
                    上传图片
                    <input type="file" accept="image/*" multiple onChange={handleAttachmentChange} className="hidden" />
                  </label>
                </div>

                {!llmConfig.visionEnabled && attachments.length > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    当前共享 LLM 已关闭 Vision，这些图片会保存在草稿里，但不会发送给模型。
                  </div>
                )}

                {attachments.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-400">
                    还没有上传图片。
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {attachments.map((item) => (
                      <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <img src={item.dataUrl} alt={item.name} className="h-36 w-full object-cover" />
                        <div className="space-y-3 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                              <p className="mt-1 text-xs text-slate-500">辅助理解结构或成功态</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAttachments((current) => current.filter((attachment) => attachment.id !== item.id))}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
                            >
                              删除
                            </button>
                          </div>
                          <input
                            value={item.purpose}
                            onChange={(event) =>
                              setAttachments((current) =>
                                current.map((attachment) =>
                                  attachment.id === item.id ? { ...attachment, purpose: event.target.value } : attachment
                                )
                              )
                            }
                            placeholder="例如：成功页；关键按钮位置"
                            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                          />
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>

          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <p className="text-xs leading-5 text-slate-500">
              {submitting
                ? mode === 'edit'
                  ? '正在重新生成 ScenarioCard 和脚本草稿，这一步可能需要几十秒。'
                  : '正在生成 ScenarioCard 和脚本草稿，这一步可能需要几十秒。'
                : configLoading
                ? '正在读取共享模型配置，加载完成后才能提交。'
                : configError
                ? '共享模型配置加载失败，暂时不能提交。'
                : !providerIsImplemented
                ? `当前共享模型 provider=${llmConfig.provider} 暂未接入。`
                : '参考图、原始输入和生成脚本都会保留在草稿里，后续可查看后再导入正式任务。'}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting || configLoading || Boolean(configError) || !providerIsImplemented}
                className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {submitting ? (mode === 'edit' ? '正在更新意图草稿…' : '正在生成意图草稿…') : mode === 'edit' ? '保存草稿' : '生成意图草稿'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
