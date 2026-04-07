export const INTENT_DRAFT_LAUNCH_QUERY_PARAM = 'draftLaunch';
export const INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE = 'test_flow';

export type IntentDraftLaunchMode = typeof INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE;

export function normalizeIntentDraftLaunchMode(value: string | null | undefined): IntentDraftLaunchMode | '' {
  return (value || '').trim() === INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE ? INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE : '';
}

export function buildIntentDraftWorkbenchHref(options: {
  projectUid: string;
  moduleUid?: string;
  draftUid: string;
  launchMode?: IntentDraftLaunchMode | '';
}): string {
  const params = new URLSearchParams();
  params.set('projectUid', options.projectUid.trim());
  if (options.moduleUid?.trim()) {
    params.set('moduleUid', options.moduleUid.trim());
  }
  params.set('draftUid', options.draftUid.trim());

  const launchMode = normalizeIntentDraftLaunchMode(options.launchMode);
  if (launchMode) {
    params.set(INTENT_DRAFT_LAUNCH_QUERY_PARAM, launchMode);
  }

  return `/intent-e2e?${params.toString()}`;
}

export function shouldTreatQueryLaunchDecisionAsHardBlock(decision: string | null | undefined): boolean {
  const normalized = (decision || '').trim();
  return normalized !== '' && normalized !== 'auto_run' && normalized !== 'draft_only';
}

export function shouldOverrideDraftAutoRunLaunchDecision(decision: string | null | undefined): boolean {
  return (decision || '').trim() === 'draft_only';
}

export function canRunIntentDraftTestFlowStatus(status: string | null | undefined): boolean {
  const normalized = (status || '').trim();
  return normalized === 'active' || normalized === 'imported';
}
