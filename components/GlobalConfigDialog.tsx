'use client';

import { useEffect, useMemo, useState } from 'react';
import { INTENT_E2E_MAX_RUN_RETRY_LIMIT } from '@/lib/intent-e2e-run-limits';
import {
  defaultIntentGlobalConfigDraft,
  toIntentGlobalConfigDraft,
  type IntentGlobalConfigDraft,
  type IntentGlobalConfigResponse,
} from '@/lib/intent-global-config-browser';

type GlobalConfigDialogProps = {
  open: boolean;
  onClose: () => void;
};

function clampInteger(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export default function GlobalConfigDialog({ open, onClose }: GlobalConfigDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [configResponse, setConfigResponse] = useState<IntentGlobalConfigResponse | null>(null);
  const [draft, setDraft] = useState<IntentGlobalConfigDraft>(defaultIntentGlobalConfigDraft);

  const defaultDraft = useMemo(
    () => (configResponse ? toIntentGlobalConfigDraft(configResponse.baseConfig) : defaultIntentGlobalConfigDraft),
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
        const res = await fetch('/api/intent-e2e/global-config');
        const json = (await res.json()) as IntentGlobalConfigResponse & { error?: string };
        if (!res.ok) throw new Error(json.error || '加载全局配置失败');
        if (!active) return;
        setConfigResponse(json);
        setDraft(toIntentGlobalConfigDraft(json.config));
      } catch (loadError: unknown) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : '加载全局配置失败');
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

  function updateDraft(updater: (current: IntentGlobalConfigDraft) => IntentGlobalConfigDraft) {
    setDraft((current) => updater(current));
    setSavedMessage('');
    setError('');
  }

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
      const res = await fetch('/api/intent-e2e/global-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxConcurrentRuns: draft.maxConcurrentRuns,
          defaultRetryLimit: draft.defaultRetryLimit,
        }),
      });
      const json = (await res.json()) as IntentGlobalConfigResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || '保存全局配置失败');
      setConfigResponse(json);
      setDraft(toIntentGlobalConfigDraft(json.config));
      setSavedMessage(
        json.sharedSettings
          ? '团队共享全局配置已更新，后续新建的意图任务会默认使用这份并发与重试设置。'
          : '当前配置与服务端环境默认一致，因此未单独保存团队共享覆盖。'
      );
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : '保存全局配置失败');
    } finally {
      setSaving(false);
    }
  }

  const currentProjectConcurrentRuns = configResponse?.config.projectConcurrentRuns ?? configResponse?.baseConfig.projectConcurrentRuns ?? 1;
  const currentMaxConcurrentRuns = configResponse?.config.maxConcurrentRuns ?? draft.maxConcurrentRuns;
  const currentDefaultRetryLimit = configResponse?.config.defaultRetryLimit ?? draft.defaultRetryLimit;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[680px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">全局配置</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              这里控制的是 workspace 级意图任务平台默认值，当前作用于异步入口 `POST /api/intent-e2e/runs` 的并发配额和整轮失败重试次数。
            </p>
          </div>
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600">
            关闭
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
              正在加载全局配置…
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
                  当前为团队共享默认值，最近一次更新：{new Date(configResponse.sharedSettings.updatedAt).toLocaleString('zh-CN')} ·{' '}
                  {configResponse.sharedSettings.updatedByLabel}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                  当前没有团队共享覆盖，实际使用的是服务端环境默认配置。
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">意图任务最大并发数</span>
                  <input
                    type="number"
                    min={configResponse?.limits.maxConcurrentRuns.min ?? 1}
                    max={configResponse?.limits.maxConcurrentRuns.max ?? 8}
                    value={draft.maxConcurrentRuns}
                    onChange={(event) =>
                      updateDraft((current) => ({
                        ...current,
                        maxConcurrentRuns: clampInteger(
                          Number(event.target.value),
                          current.maxConcurrentRuns,
                          configResponse?.limits.maxConcurrentRuns.min ?? 1,
                          configResponse?.limits.maxConcurrentRuns.max ?? 8
                        ),
                      }))
                    }
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-500">超过当前配额的异步 intent 任务会进入队列等待执行。</p>
                </label>

                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">失败任务默认重试次数</span>
                  <input
                    type="number"
                    min={configResponse?.limits.defaultRetryLimit.min ?? 0}
                    max={configResponse?.limits.defaultRetryLimit.max ?? INTENT_E2E_MAX_RUN_RETRY_LIMIT}
                    value={draft.defaultRetryLimit}
                    onChange={(event) =>
                      updateDraft((current) => ({
                        ...current,
                        defaultRetryLimit: clampInteger(
                          Number(event.target.value),
                          current.defaultRetryLimit,
                          configResponse?.limits.defaultRetryLimit.min ?? 0,
                          configResponse?.limits.defaultRetryLimit.max ?? INTENT_E2E_MAX_RUN_RETRY_LIMIT
                        ),
                      }))
                    }
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-500">会直接覆盖异步 intent run 的 `runControl.retryLimit`；仅作用于平台判定为可重试的整轮失败，不影响 LLM 自愈重试次数。</p>
                </label>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-medium text-slate-900">当前生效说明</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">全局并发</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{currentMaxConcurrentRuns}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">同项目并发</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{currentProjectConcurrentRuns}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">默认重试</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{currentDefaultRetryLimit}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  同项目并发没有单独做成表单字段；如果宿主机显式设置了 `INTENT_E2E_PROJECT_MAX_CONCURRENT_RUNS`，这里会继续受该限制约束。
                </p>
                {currentProjectConcurrentRuns !== currentMaxConcurrentRuns && (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                    当前同项目并发上限低于全局并发，说明还存在项目级兜底限制；提高“全局并发”后，同一个项目内也不一定会完全并行。
                  </div>
                )}
              </div>
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
