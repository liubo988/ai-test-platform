import type { ExecutionConversationItem, ExecutionStatus } from '@/lib/execution-detail-contract';

export type ExecutionDetailToneVariant = 'workbench' | 'console';

export function executionStatusTone(status: ExecutionStatus, variant: ExecutionDetailToneVariant = 'workbench'): string {
  if (variant === 'console') {
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

  switch (status) {
    case 'passed':
      return 'bg-emerald-100 text-emerald-700';
    case 'failed':
      return 'bg-rose-100 text-rose-700';
    case 'running':
      return 'bg-amber-100 text-amber-700';
    case 'queued':
      return 'bg-zinc-100 text-zinc-700';
    default:
      return 'bg-zinc-200 text-zinc-700';
  }
}

export function executionConversationMessageTone(
  kind: ExecutionConversationItem['messageType'],
  variant: ExecutionDetailToneVariant = 'workbench'
): string {
  if (kind === 'error') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (kind === 'status') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (kind === 'thinking') return 'border-sky-200 bg-sky-50 text-sky-800';
  return variant === 'console' ? 'border-slate-200 bg-white text-slate-700' : 'border-zinc-200 bg-zinc-50 text-zinc-700';
}
