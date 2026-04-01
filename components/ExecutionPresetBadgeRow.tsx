'use client';

import type { ExecutionWorkspacePresetBadge } from '@/lib/execution-workspace-link-contract';

export default function ExecutionPresetBadgeRow({ badges }: { badges: ExecutionWorkspacePresetBadge[] }) {
  if (badges.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {badges.map((badge) => (
        <span
          key={badge.key}
          title={badge.title}
          className="inline-flex items-center rounded-md border border-sky-100 bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700"
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}
