'use client';

import Link from 'next/link';
import type { ExecutionWorkspaceLinkAction } from '@/lib/execution-workspace-link-contract';

export default function ExecutionPresetActionRow({
  actions,
  className,
  linkClassName,
  keyPrefix = 'execution-preset-action',
}: {
  actions: ExecutionWorkspaceLinkAction[];
  className?: string;
  linkClassName: string;
  keyPrefix?: string;
}) {
  if (actions.length === 0) return null;

  return (
    <div className={className || 'flex flex-wrap gap-2'}>
      {actions.map((action) => (
        <Link key={`${keyPrefix}-${action.key}-${action.href}`} href={action.href} className={linkClassName}>
          {action.label}
        </Link>
      ))}
    </div>
  );
}
