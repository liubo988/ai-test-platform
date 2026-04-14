export type IntentE2ECiCdProfile = 'manual' | 'pr_gate' | 'scheduled_regression' | 'release_candidate_validation';

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeIntentE2ECiCdProfile(value: unknown): IntentE2ECiCdProfile | undefined {
  switch (normalizeString(value).toLowerCase()) {
    case 'manual':
      return 'manual';
    case 'pr_gate':
      return 'pr_gate';
    case 'scheduled_regression':
      return 'scheduled_regression';
    case 'release_candidate_validation':
      return 'release_candidate_validation';
    default:
      return undefined;
  }
}

export function resolveIntentE2ECiCdProfile(value: unknown): IntentE2ECiCdProfile {
  return normalizeIntentE2ECiCdProfile(value) || 'manual';
}
