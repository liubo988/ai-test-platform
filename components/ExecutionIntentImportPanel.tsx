'use client';

import ExecutionIntentImportHeader from '@/components/ExecutionIntentImportHeader';
import ExecutionIntentImportSummary from '@/components/ExecutionIntentImportSummary';
import {
  executionIntentImportBadgeTone,
  executionIntentImportLabel,
  executionIntentImportPanelTone,
} from '@/lib/execution-intent-import-ui';
import type { IntentImportStatus } from '@/lib/intent-e2e-import';
import type {
  ExecutionWorkspaceLinkAction,
  ExecutionWorkspacePresetBadge,
  ExecutionWorkspacePresetDetailItem,
} from '@/lib/execution-workspace-link-contract';

export default function ExecutionIntentImportPanel({
  status,
  panelClassName,
  title = '执行来源',
  titleAs = 'h2',
  titleClassName,
  badgeShapeClassName,
  badgeToneVariant = 'workbench',
  description,
  descriptionClassName,
  importedFromRunId,
  importedAtLabel,
  presetBadges,
  presetDetails,
  presetActions,
  summaryContainerClassName,
  summaryImportedAtClassName,
  actionKeyPrefix = 'intent-import',
  actionRowClassName,
  actionLinkClassName,
}: {
  status?: IntentImportStatus | '' | string;
  panelClassName: string;
  title?: string;
  titleAs?: 'h2' | 'p';
  titleClassName: string;
  badgeShapeClassName: string;
  badgeToneVariant?: 'workbench' | 'console';
  description: string;
  descriptionClassName: string;
  importedFromRunId: string;
  importedAtLabel?: string;
  presetBadges: ExecutionWorkspacePresetBadge[];
  presetDetails: ExecutionWorkspacePresetDetailItem[];
  presetActions: ExecutionWorkspaceLinkAction[];
  summaryContainerClassName?: string;
  summaryImportedAtClassName?: string;
  actionKeyPrefix?: string;
  actionRowClassName?: string;
  actionLinkClassName: string;
}) {
  return (
    <div className={`${panelClassName} ${executionIntentImportPanelTone(status)}`.trim()}>
      <ExecutionIntentImportHeader
        title={title}
        titleAs={titleAs}
        titleClassName={titleClassName}
        badgeLabel={executionIntentImportLabel(status)}
        badgeClassName={`${badgeShapeClassName} ${executionIntentImportBadgeTone(status, badgeToneVariant)}`.trim()}
        description={description}
        descriptionClassName={descriptionClassName}
      />
      <ExecutionIntentImportSummary
        importedFromRunId={importedFromRunId}
        importedAtLabel={importedAtLabel}
        presetBadges={presetBadges}
        presetDetails={presetDetails}
        presetActions={presetActions}
        containerClassName={summaryContainerClassName}
        importedAtClassName={summaryImportedAtClassName}
        actionKeyPrefix={actionKeyPrefix}
        actionRowClassName={actionRowClassName}
        actionLinkClassName={actionLinkClassName}
      />
    </div>
  );
}
