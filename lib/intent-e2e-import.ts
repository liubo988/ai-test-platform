export type IntentImportStatus = 'passed' | 'failed';

const INTENT_IMPORT_PREFIX = /^\[intent_e2e_import\]\s+runId=([^\s]+)/m;

export function extractIntentImportRunIdFromPrompt(prompt: unknown): string {
  if (typeof prompt !== 'string') return '';
  const match = prompt.match(INTENT_IMPORT_PREFIX);
  return match?.[1]?.trim() || '';
}

export function normalizeIntentImportStatusFromActionType(actionType: unknown): IntentImportStatus | '' {
  if (typeof actionType !== 'string') return '';
  if (actionType === 'plan_imported_passed') return 'passed';
  if (actionType === 'plan_imported_failed') return 'failed';
  return '';
}

export function extractIntentImportRunIdFromArtifactMeta(meta: unknown): string {
  if (!meta || typeof meta !== 'object') return '';
  const runId = (meta as { importedFromRunId?: unknown }).importedFromRunId;
  return typeof runId === 'string' ? runId.trim() : '';
}

export function extractIntentImportStatusFromArtifactMeta(meta: unknown): IntentImportStatus | '' {
  if (!meta || typeof meta !== 'object') return '';
  const success = (meta as { success?: unknown }).success;
  if (success === true) return 'passed';
  if (success === false) return 'failed';
  return '';
}
