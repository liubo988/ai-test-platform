import { describe, expect, it } from 'vitest';

import {
  extractIntentImportRunIdFromArtifactMeta,
  extractIntentImportRunIdFromPrompt,
  extractIntentImportStatusFromArtifactMeta,
  normalizeIntentImportStatusFromActionType,
} from '@/lib/intent-e2e-import';

describe('intent-e2e-import', () => {
  it('extracts runId from an intent import generation prompt', () => {
    expect(
      extractIntentImportRunIdFromPrompt(
        ['[intent_e2e_import] runId=intent-run-123', '用户输入：访问结算页并提交订单'].join('\n')
      )
    ).toBe('intent-run-123');
  });

  it('returns empty when the prompt is not an intent import prompt', () => {
    expect(extractIntentImportRunIdFromPrompt('[AI纠错] 原执行: exec_1')).toBe('');
    expect(extractIntentImportRunIdFromPrompt(null)).toBe('');
  });

  it('normalizes import status from activity action types', () => {
    expect(normalizeIntentImportStatusFromActionType('plan_imported_passed')).toBe('passed');
    expect(normalizeIntentImportStatusFromActionType('plan_imported_failed')).toBe('failed');
    expect(normalizeIntentImportStatusFromActionType('config_updated')).toBe('');
  });

  it('extracts runId and status from execution artifact metadata', () => {
    expect(
      extractIntentImportRunIdFromArtifactMeta({
        fileName: 'intent-pass.spec.ts',
        importedFromRunId: 'intent-run-456',
        success: true,
      })
    ).toBe('intent-run-456');
    expect(extractIntentImportStatusFromArtifactMeta({ success: true })).toBe('passed');
    expect(extractIntentImportStatusFromArtifactMeta({ success: false })).toBe('failed');
    expect(extractIntentImportStatusFromArtifactMeta({})).toBe('');
  });
});
