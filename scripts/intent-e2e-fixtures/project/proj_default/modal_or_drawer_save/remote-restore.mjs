import {
  MODAL_OR_DRAWER_SAVE_FIXTURE_FAMILY,
  buildModalOrDrawerSaveContract,
  readJsonFileIfExists,
  resolveFixtureState,
} from './_shared.mjs';
import { runModalOrDrawerSaveRemoteRecovery } from './_remote_recovery.mjs';

const state = resolveFixtureState({
  fixtureRef: 'fixture://project/proj_default/modal_or_drawer_save/remote-restore',
});
const existingState = await readJsonFileIfExists(state.statePath);
const contract = existingState?.contract || buildModalOrDrawerSaveContract(state.targetUrl);
const phase = process.env.INTENT_E2E_FIXTURE_REMOTE_RECOVERY_PHASE === 'snapshot' ? 'snapshot' : 'restore';
const remoteRecovery = await runModalOrDrawerSaveRemoteRecovery({
  phase,
  state,
  contract,
  existingState,
});

console.log(
  JSON.stringify({
    summary: `modal_or_drawer_save remote recovery ${remoteRecovery.status}: ${state.idempotencyKey}`,
    family: MODAL_OR_DRAWER_SAVE_FIXTURE_FAMILY,
    scenarioId: contract.scenarioId,
    phase,
    status: remoteRecovery.status,
    adapterRef: remoteRecovery.adapterRef,
    outcome: remoteRecovery.outcome || '',
    statePath: state.statePath,
  })
);
