'use client';

import type { ExecutionWorkspacePresetDetailItem } from '@/lib/execution-workspace-link-contract';

export default function ExecutionPresetDetailGrid({ items }: { items: ExecutionWorkspacePresetDetailItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3 grid gap-2 md:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.key}
          className={`rounded-xl border border-current/10 bg-white/70 px-3 py-2 ${item.wide ? 'md:col-span-2' : ''}`}
        >
          <p className="text-[10px] uppercase tracking-[0.16em] opacity-60">{item.label}</p>
          <p className={`mt-1 text-[11px] leading-5 ${item.monospace ? 'font-mono' : ''}`} title={item.title}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
