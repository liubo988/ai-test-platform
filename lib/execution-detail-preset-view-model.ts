import type { ExecutionDetail } from '@/lib/execution-detail-contract';
import {
  buildExecutionWorkspaceLinkActions,
  buildExecutionWorkspacePresetBadges,
  buildExecutionWorkspacePresetDetailItems,
  buildExecutionWorkspacePresetFocusActions,
  buildExecutionWorkspacePresetSummaryBadges,
  readExecutionWorkspacePresetSummary,
  type ExecutionWorkspaceLinkAction,
  type ExecutionWorkspacePresetBadge,
  type ExecutionWorkspacePresetDetailItem,
} from '@/lib/execution-workspace-link-contract';

function normalizePolicyNotes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of value) {
    const normalized = typeof item === 'string' ? item.trim() : '';
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    items.push(normalized);
  }

  return items;
}

function buildIntentImportPolicyNoteDetailItems(
  detail: Pick<ExecutionDetail, 'intentImport'>
): ExecutionWorkspacePresetDetailItem[] {
  const policyNotes = normalizePolicyNotes(detail.intentImport?.verificationPolicyNotes);
  if (policyNotes.length === 0) return [];

  const summary =
    policyNotes.length <= 2
      ? policyNotes.join(' / ')
      : `${policyNotes.slice(0, 2).join(' / ')} 等 ${policyNotes.length} 项`;

  return [
    {
      key: 'verificationPolicyNotes',
      label: 'Verification Policy',
      value: summary,
      title: policyNotes.join('\n'),
      wide: true,
    },
  ];
}

export type ExecutionDetailPresetViewModel = {
  executionContextLinkActions: ExecutionWorkspaceLinkAction[];
  executionPresetBadges: ExecutionWorkspacePresetBadge[];
  intentImportPresetBadges: ExecutionWorkspacePresetBadge[];
  intentImportPresetDetails: ExecutionWorkspacePresetDetailItem[];
  intentImportPresetActions: ExecutionWorkspaceLinkAction[];
};

export function buildExecutionDetailPresetViewModel(
  detail: Pick<ExecutionDetail, 'executionContext' | 'intentImport'>
): ExecutionDetailPresetViewModel {
  const intentImportWorkspacePreset = detail.intentImport?.workspacePreset || null;
  const intentImportSummary = readExecutionWorkspacePresetSummary(detail.intentImport);
  const intentImportPolicyNoteDetails = buildIntentImportPolicyNoteDetailItems(detail);

  return {
    executionContextLinkActions: buildExecutionWorkspaceLinkActions(detail.executionContext),
    executionPresetBadges: buildExecutionWorkspacePresetBadges(detail.executionContext),
    intentImportPresetBadges: buildExecutionWorkspacePresetSummaryBadges(intentImportSummary),
    intentImportPresetDetails: [
      ...buildExecutionWorkspacePresetDetailItems(intentImportSummary),
      ...intentImportPolicyNoteDetails,
    ],
    intentImportPresetActions: buildExecutionWorkspacePresetFocusActions(intentImportWorkspacePreset),
  };
}
