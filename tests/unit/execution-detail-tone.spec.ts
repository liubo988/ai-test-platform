import { describe, expect, it } from 'vitest';

import { executionConversationMessageTone, executionStatusTone } from '../../lib/execution-detail-tone';

describe('execution-detail-tone', () => {
  it('maps execution status to workbench tone classes', () => {
    expect(executionStatusTone('passed', 'workbench')).toBe('bg-emerald-100 text-emerald-700');
    expect(executionStatusTone('queued', 'workbench')).toBe('bg-zinc-100 text-zinc-700');
    expect(executionStatusTone('canceled', 'workbench')).toBe('bg-zinc-200 text-zinc-700');
  });

  it('maps execution status to console tone classes', () => {
    expect(executionStatusTone('failed', 'console')).toBe('bg-rose-500/12 text-rose-700 ring-rose-500/20');
    expect(executionStatusTone('running', 'console')).toBe('bg-amber-500/12 text-amber-700 ring-amber-500/20');
    expect(executionStatusTone('canceled', 'console')).toBe('bg-slate-100 text-slate-600 ring-slate-200');
  });

  it('maps conversation message tone with variant-specific default styling', () => {
    expect(executionConversationMessageTone('error', 'workbench')).toBe('border-rose-200 bg-rose-50 text-rose-800');
    expect(executionConversationMessageTone('thinking', 'console')).toBe('border-sky-200 bg-sky-50 text-sky-800');
    expect(executionConversationMessageTone('code', 'workbench')).toBe('border-zinc-200 bg-zinc-50 text-zinc-700');
    expect(executionConversationMessageTone('code', 'console')).toBe('border-slate-200 bg-white text-slate-700');
  });
});
