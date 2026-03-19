'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  defaultLlmConfigDraft,
  toLlmDraft,
  type LLMConfigDraft,
  type LLMConfigResponse,
} from '@/lib/llm-config-browser';

type LLMConfigDialogProps = {
  open: boolean;
  onClose: () => void;
};

export default function LLMConfigDialog({ open, onClose }: LLMConfigDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [configResponse, setConfigResponse] = useState<LLMConfigResponse | null>(null);
  const [draft, setDraft] = useState<LLMConfigDraft>(defaultLlmConfigDraft);
  const [savedMessage, setSavedMessage] = useState('');

  const defaultDraft = useMemo(
    () => (configResponse ? toLlmDraft(configResponse.baseLlm) : defaultLlmConfigDraft),
    [configResponse]
  );

  useEffect(() => {
    if (!open) {
      setError('');
      setSavedMessage('');
      return;
    }

    let active = true;

    async function loadConfig() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/llm/config');
        const json = (await res.json()) as LLMConfigResponse & { error?: string };
        if (!res.ok) throw new Error(json.error || '加载 LLM 配置失败');
        if (!active) return;
        setConfigResponse(json);
        setDraft(toLlmDraft(json.llm));
      } catch (loadError: unknown) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : '加载 LLM 配置失败');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadConfig();

    return () => {
      active = false;
    };
  }, [open]);

  if (!open) return null;

  function handleRestoreDefault() {
    setDraft(defaultDraft);
    setSavedMessage('已恢复为环境默认草稿，点击“保存配置”后会清除团队共享覆盖。');
    setError('');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSavedMessage('');

    try {
      const res = await fetch('/api/llm/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: draft.provider,
          model: draft.model.trim(),
          baseUrl: draft.baseUrl.trim(),
          apiStyle: draft.apiStyle,
          visionEnabled: draft.visionEnabled,
          selfHealRetries: draft.selfHealRetries,
          maxPlanSteps: draft.maxPlanSteps,
        }),
      });
      const json = (await res.json()) as LLMConfigResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || '保存 LLM 配置失败');
      setConfigResponse(json);
      setDraft(toLlmDraft(json.llm));
      setSavedMessage(
        json.sharedSettings
          ? '团队共享 LLM 配置已更新，后续意图工作台会默认使用这份配置。'
          : '已清除团队共享覆盖，当前恢复为环境默认配置。'
      );
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : '保存 LLM 配置失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[720px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">团队共享 LLM 配置</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              这里保存的是整个工作台共享默认值，用于意图工作台运行时的模型、Vision 和重试参数；API Key 仍然只走服务端环境变量。
            </p>
          </div>
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600">
            关闭
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
              正在加载配置…
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : (
            <div className="space-y-4">
              {savedMessage && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {savedMessage}
                </div>
              )}

              {configResponse?.sharedSettings ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                  当前为团队共享默认值，最近一次更新：{new Date(configResponse.sharedSettings.updatedAt).toLocaleString('zh-CN')} · {configResponse.sharedSettings.updatedByLabel}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                  当前没有团队共享覆盖，实际使用的是服务端环境默认配置。
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Provider</span>
                  <select
                    value={draft.provider}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        provider: event.target.value,
                        providerImplemented: event.target.value === 'openai',
                      }))
                    }
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                  >
                    {(configResponse?.availableProviders || ['openai', 'gemini', 'claude']).map((item) => (
                      <option key={item} value={item}>
                        {item === 'openai' ? 'openai（已实现）' : `${item}（预留）`}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">API Style</span>
                  <select
                    value={draft.apiStyle}
                    onChange={(event) => setDraft((current) => ({ ...current, apiStyle: event.target.value }))}
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                  >
                    {(configResponse?.availableApiStyles || ['auto', 'responses', 'chat']).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Model</span>
                <input
                  value={draft.model}
                  onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Base URL</span>
                <input
                  value={draft.baseUrl}
                  onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">自愈重试次数</span>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={draft.selfHealRetries}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        selfHealRetries: Math.max(0, Number(event.target.value) || 0),
                      }))
                    }
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">最大规划步数</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={draft.maxPlanSteps}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        maxPlanSteps: Math.max(1, Number(event.target.value) || 1),
                      }))
                    }
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                  />
                </label>
              </div>

              <label className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">Vision 开关</p>
                  <p className="mt-1 text-xs text-slate-500">关闭后，上传图片不会发给模型。</p>
                </div>
                <input
                  type="checkbox"
                  checked={draft.visionEnabled}
                  onChange={(event) => setDraft((current) => ({ ...current, visionEnabled: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                />
              </label>

              {draft.provider !== 'openai' && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                  当前仅 `openai` provider 已实现；`gemini / claude` 仍然只是预留位。
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            onClick={handleRestoreDefault}
            disabled={loading || saving || !configResponse}
            className="h-10 rounded-xl border border-slate-200 px-4 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            恢复环境默认
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-xl border border-slate-200 px-4 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={loading || saving || Boolean(error)}
            className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  );
}
