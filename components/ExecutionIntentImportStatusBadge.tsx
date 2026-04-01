'use client';

import {
  executionIntentImportBadgeTone,
  executionIntentImportLabel,
} from '@/lib/execution-intent-import-ui';
import type { IntentImportStatus } from '@/lib/intent-e2e-import';

export default function ExecutionIntentImportStatusBadge({
  status,
  variant,
  className,
}: {
  status?: IntentImportStatus | '' | string;
  variant: 'workbench' | 'console';
  className: string;
}) {
  return (
    <span className={`${className} ${executionIntentImportBadgeTone(status, variant)}`.trim()}>
      {executionIntentImportLabel(status)}
    </span>
  );
}
