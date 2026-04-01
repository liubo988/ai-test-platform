'use client';

import ExecutionPresetActionRow from '@/components/ExecutionPresetActionRow';
import ExecutionPresetBadgeRow from '@/components/ExecutionPresetBadgeRow';
import ExecutionPresetDetailGrid from '@/components/ExecutionPresetDetailGrid';
import type {
  ExecutionWorkspaceLinkAction,
  ExecutionWorkspacePresetBadge,
  ExecutionWorkspacePresetDetailItem,
} from '@/lib/execution-workspace-link-contract';

export default function ExecutionIntentImportSummary({
  importedFromRunId,
  importedAtLabel,
  presetBadges,
  presetDetails,
  presetActions,
  containerClassName,
  importedAtClassName,
  actionRowClassName,
  actionLinkClassName,
  actionKeyPrefix = 'intent-import',
}: {
  importedFromRunId: string;
  importedAtLabel?: string;
  presetBadges: ExecutionWorkspacePresetBadge[];
  presetDetails: ExecutionWorkspacePresetDetailItem[];
  presetActions: ExecutionWorkspaceLinkAction[];
  containerClassName?: string;
  importedAtClassName?: string;
  actionRowClassName?: string;
  actionLinkClassName: string;
  actionKeyPrefix?: string;
}) {
  return (
    <div className={containerClassName}>
      <div className="rounded-xl border border-current/10 bg-white/70 px-3 py-2">
        <p className="text-[10px] uppercase tracking-[0.16em] opacity-60">来源 Run ID</p>
        <p className="mt-1 break-all font-mono text-[11px] leading-5" title={importedFromRunId}>
          {importedFromRunId}
        </p>
      </div>
      <ExecutionPresetBadgeRow badges={presetBadges} />
      <ExecutionPresetDetailGrid items={presetDetails} />
      {importedAtLabel ? <p className={importedAtClassName || 'mt-2 text-[11px] opacity-70'}>{importedAtLabel}</p> : null}
      <ExecutionPresetActionRow
        actions={presetActions}
        keyPrefix={actionKeyPrefix}
        className={actionRowClassName}
        linkClassName={actionLinkClassName}
      />
    </div>
  );
}
