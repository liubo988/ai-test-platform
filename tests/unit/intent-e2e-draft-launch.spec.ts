import { describe, expect, it } from 'vitest';
import {
  buildIntentDraftWorkbenchHref,
  INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE,
  normalizeIntentDraftLaunchMode,
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

  it('normalizes the supported draft launch mode only', () => {
    expect(normalizeIntentDraftLaunchMode('test_flow')).toBe(INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE);
    expect(normalizeIntentDraftLaunchMode(' draft_only ')).toBe('');
    expect(normalizeIntentDraftLaunchMode(null)).toBe('');
  });

  it('treats draft_only as a soft query decision but keeps harder blockers intact', () => {
    expect(shouldTreatQueryLaunchDecisionAsHardBlock('draft_only')).toBe(false);
    expect(shouldTreatQueryLaunchDecisionAsHardBlock('auto_run')).toBe(false);
    expect(shouldTreatQueryLaunchDecisionAsHardBlock('needs_bootstrap')).toBe(true);
    expect(shouldTreatQueryLaunchDecisionAsHardBlock('needs_fixture')).toBe(true);
  });

  it('allows explicit draft test flow to override draft_only only', () => {
    expect(shouldOverrideDraftAutoRunLaunchDecision('draft_only')).toBe(true);
    expect(shouldOverrideDraftAutoRunLaunchDecision('needs_fixture')).toBe(false);
    expect(shouldOverrideDraftAutoRunLaunchDecision('')).toBe(false);
  });
});
