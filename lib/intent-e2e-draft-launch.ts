export const INTENT_DRAFT_LAUNCH_QUERY_PARAM = 'draftLaunch';
export const INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE = 'test_flow';

export type IntentDraftLaunchMode = typeof INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE;
export type IntentDraftAutoLaunchGateStatus = 'wait' | 'pending' | 'ready' | 'invalid_payload';

export function normalizeIntentDraftLaunchMode(value: string | null | undefined): IntentDraftLaunchMode | '' {
  return (value || '').trim() === INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE ? INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE : '';
}

export function buildIntentDraftWorkbenchHref(options: {
  projectUid: string;
  moduleUid?: string;
  draftUid: string;
  runId?: string;
  launchMode?: IntentDraftLaunchMode | '';
}): string {
  const params = new URLSearchParams();
  params.set('projectUid', options.projectUid.trim());
  if (options.moduleUid?.trim()) {
    params.set('moduleUid', options.moduleUid.trim());
  }
  params.set('draftUid', options.draftUid.trim());
  if (options.runId?.trim()) {
    params.set('runId', options.runId.trim());
  }

  const launchMode = normalizeIntentDraftLaunchMode(options.launchMode);
  if (launchMode) {
    params.set(INTENT_DRAFT_LAUNCH_QUERY_PARAM, launchMode);
  }

  return `/intent-e2e?${params.toString()}`;
}

export function buildIntentDraftTestFlowHref(options: {
  projectUid: string;
  moduleUid?: string | null;
  draftUid: string;
  activeRunId?: string | null;
  latestActiveRunId?: string | null;
}): string {
  const runId = (options.latestActiveRunId || '').trim() || (options.activeRunId || '').trim();

  return buildIntentDraftWorkbenchHref({
    projectUid: options.projectUid,
    moduleUid: options.moduleUid || undefined,
    draftUid: options.draftUid,
    runId: runId || undefined,
    launchMode: runId ? '' : INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE,
  });
}

export function shouldTreatQueryLaunchDecisionAsHardBlock(
  decision: string | null | undefined,
  options: { intentDraftUid?: string | null } = {}
): boolean {
  const normalized = (decision || '').trim();
  if (normalized && options.intentDraftUid?.trim()) {
    return false;
  }
  return normalized !== '' && normalized !== 'auto_run' && normalized !== 'draft_only';
}

export function shouldOverrideDraftAutoRunLaunchDecision(decision: string | null | undefined): boolean {
  return (decision || '').trim() === 'draft_only';
}

export function canRunIntentDraftTestFlowStatus(status: string | null | undefined): boolean {
  const normalized = (status || '').trim();
  return normalized === 'active' || normalized === 'imported';
}

export function resolveIntentDraftTestFlowActionLabel(hasActiveRun: boolean): string {
  return hasActiveRun ? '继续测试' : '测试流程';
}

export function resolveIntentDraftAutoLaunchGate(input: {
  projectUid?: string | null;
  draftUid?: string | null;
  hydratedKey?: string | null;
  handledKey?: string | null;
  pendingKey?: string | null;
  draftDetailReady?: boolean;
  payloadReady?: boolean;
}): {
  status: IntentDraftAutoLaunchGateStatus;
  draftKey: string;
} {
  const projectUid = (input.projectUid || '').trim();
  const draftUid = (input.draftUid || '').trim();
  const draftKey = projectUid && draftUid ? `${projectUid}:${draftUid}` : '';

  if (!draftKey) {
    return { status: 'wait', draftKey: '' };
  }

  if ((input.hydratedKey || '').trim() !== draftKey) {
    return { status: 'wait', draftKey };
  }

  if ((input.handledKey || '').trim() === draftKey) {
    return { status: 'wait', draftKey };
  }

  if ((input.pendingKey || '').trim() === draftKey) {
    return { status: 'pending', draftKey };
  }

  if (!input.draftDetailReady) {
    return { status: 'wait', draftKey };
  }

  if (!input.payloadReady) {
    return { status: 'invalid_payload', draftKey };
  }

  return { status: 'ready', draftKey };
}
