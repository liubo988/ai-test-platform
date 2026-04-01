import type { IntentImportStatus } from '@/lib/intent-e2e-import';

export function executionIntentImportBadgeTone(
  status?: IntentImportStatus | '' | string,
  variant: 'workbench' | 'console' = 'workbench'
): string {
  if (variant === 'console') {
    return status === 'failed'
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : 'bg-violet-50 text-violet-700 ring-violet-200';
  }

  return status === 'failed' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700';
}

export function executionIntentImportPanelTone(status?: IntentImportStatus | '' | string): string {
  return status === 'failed'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : 'border-violet-200 bg-violet-50 text-violet-900';
}

export function executionIntentImportLabel(status?: IntentImportStatus | '' | string): string {
  if (status === 'failed') return 'Intent 导入失败';
  if (status === 'passed') return 'Intent 导入通过';
  return 'Intent 导入';
}
