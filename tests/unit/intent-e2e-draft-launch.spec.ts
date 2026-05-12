import { describe, expect, it } from 'vitest';
import {
  buildIntentDraftTestFlowHref,
  buildIntentDraftWorkbenchHref,
  canRunIntentDraftTestFlowStatus,
  INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE,
  normalizeIntentDraftLaunchMode,
  resolveIntentDraftTestFlowActionLabel,
  resolveIntentDraftAutoLaunchGate,
  shouldOverrideDraftAutoRunLaunchDecision,
  shouldTreatQueryLaunchDecisionAsHardBlock,
} from '@/lib/intent-e2e-draft-launch';

describe('intent-e2e draft launch helpers', () => {
  it('builds draft workbench href with explicit test flow launch mode', () => {
    expect(
      buildIntentDraftWorkbenchHref({
        projectUid: 'proj_default',
        moduleUid: 'mod_checkout',
        draftUid: 'draft_1',
        launchMode: INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE,
      })
    ).toBe('/intent-e2e?projectUid=proj_default&moduleUid=mod_checkout&draftUid=draft_1&draftLaunch=test_flow');
  });

  it('omits blank module and launch mode from the href', () => {
    expect(
      buildIntentDraftWorkbenchHref({
        projectUid: 'proj_default',
        moduleUid: '  ',
        draftUid: 'draft_1',
        launchMode: '',
      })
    ).toBe('/intent-e2e?projectUid=proj_default&draftUid=draft_1');
  });

  it('can resume a specific run while preserving draft context', () => {
    expect(
      buildIntentDraftWorkbenchHref({
        projectUid: 'proj_default',
        moduleUid: 'mod_checkout',
        draftUid: 'draft_1',
        runId: ' intent-run-1 ',
      })
    ).toBe('/intent-e2e?projectUid=proj_default&moduleUid=mod_checkout&draftUid=draft_1&runId=intent-run-1');
  });

  it('prefers the refreshed active run when opening draft test flow', () => {
    expect(
      buildIntentDraftTestFlowHref({
        projectUid: 'proj_default',
        moduleUid: 'mod_checkout',
        draftUid: 'draft_1',
        activeRunId: '',
        latestActiveRunId: ' intent-run-2 ',
      })
    ).toBe('/intent-e2e?projectUid=proj_default&moduleUid=mod_checkout&draftUid=draft_1&runId=intent-run-2');
  });

  it('falls back to fresh launch mode when the draft still has no active run', () => {
    expect(
      buildIntentDraftTestFlowHref({
        projectUid: 'proj_default',
        moduleUid: 'mod_checkout',
        draftUid: 'draft_1',
        activeRunId: '',
        latestActiveRunId: '',
      })
    ).toBe('/intent-e2e?projectUid=proj_default&moduleUid=mod_checkout&draftUid=draft_1&draftLaunch=test_flow');
  });

  it('normalizes the supported draft launch mode only', () => {
    expect(normalizeIntentDraftLaunchMode('test_flow')).toBe(INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE);
    expect(normalizeIntentDraftLaunchMode(' draft_only ')).toBe('');
    expect(normalizeIntentDraftLaunchMode(null)).toBe('');
  });

  it('treats draft_only as a soft query decision but keeps harder blockers intact', () => {
    expect(shouldTreatQueryLaunchDecisionAsHardBlock('draft_only')).toBe(false);
    expect(shouldTreatQueryLaunchDecisionAsHardBlock('auto_run')).toBe(false);
    expect(shouldTreatQueryLaunchDecisionAsHardBlock('needs_bootstrap')).toBe(true);
    expect(shouldTreatQueryLaunchDecisionAsHardBlock('needs_bootstrap', { intentDraftUid: 'idraft_1' })).toBe(false);
    expect(shouldTreatQueryLaunchDecisionAsHardBlock('needs_fixture')).toBe(true);
    expect(shouldTreatQueryLaunchDecisionAsHardBlock('needs_fixture', { intentDraftUid: 'idraft_1' })).toBe(false);
    expect(shouldTreatQueryLaunchDecisionAsHardBlock('needs_clarify', { intentDraftUid: 'idraft_1' })).toBe(false);
  });

  it('allows explicit draft test flow to override draft_only only', () => {
    expect(shouldOverrideDraftAutoRunLaunchDecision('draft_only')).toBe(true);
    expect(shouldOverrideDraftAutoRunLaunchDecision('needs_fixture')).toBe(false);
    expect(shouldOverrideDraftAutoRunLaunchDecision('')).toBe(false);
  });

  it('allows imported drafts to keep launching the test flow', () => {
    expect(canRunIntentDraftTestFlowStatus('active')).toBe(true);
    expect(canRunIntentDraftTestFlowStatus('imported')).toBe(true);
    expect(canRunIntentDraftTestFlowStatus('archived')).toBe(false);
    expect(canRunIntentDraftTestFlowStatus('')).toBe(false);
  });

  it('uses an explicit running label once the draft is already executing', () => {
    expect(resolveIntentDraftTestFlowActionLabel(true)).toBe('继续测试');
    expect(resolveIntentDraftTestFlowActionLabel(false)).toBe('测试流程');
  });

  it('keeps waiting when draft hydration finished but launch detail is not ready yet', () => {
    expect(
      resolveIntentDraftAutoLaunchGate({
        projectUid: 'proj_default',
        draftUid: 'draft_1',
        hydratedKey: 'proj_default:draft_1',
        handledKey: '',
        draftDetailReady: false,
        payloadReady: false,
      })
    ).toEqual({
      status: 'wait',
      draftKey: 'proj_default:draft_1',
    });
  });

  it('keeps the current auto launch pending while the same draft request is already in flight', () => {
    expect(
      resolveIntentDraftAutoLaunchGate({
        projectUid: 'proj_default',
        draftUid: 'draft_1',
        hydratedKey: 'proj_default:draft_1',
        handledKey: '',
        pendingKey: 'proj_default:draft_1',
        draftDetailReady: true,
        payloadReady: true,
      })
    ).toEqual({
      status: 'pending',
      draftKey: 'proj_default:draft_1',
    });
  });

  it('marks hydrated drafts with empty payload as invalid instead of waiting forever', () => {
    expect(
      resolveIntentDraftAutoLaunchGate({
        projectUid: 'proj_default',
        draftUid: 'draft_1',
        hydratedKey: 'proj_default:draft_1',
        handledKey: '',
        draftDetailReady: true,
        payloadReady: false,
      })
    ).toEqual({
      status: 'invalid_payload',
      draftKey: 'proj_default:draft_1',
    });
  });
});
