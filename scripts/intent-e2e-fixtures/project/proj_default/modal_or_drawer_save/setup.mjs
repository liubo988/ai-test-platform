import {
  MODAL_OR_DRAWER_SAVE_FIXTURE_FAMILY,
  MODAL_OR_DRAWER_SAVE_FIXTURE_VERSION,
  buildModalOrDrawerSaveContract,
  resolveFixtureState,
  writeJsonFile,
} from './_shared.mjs';
import { runModalOrDrawerSaveRemoteRecovery } from './_remote_recovery.mjs';

const state = resolveFixtureState();
const contract = buildModalOrDrawerSaveContract(state.targetUrl);
const remoteRecovery = await runModalOrDrawerSaveRemoteRecovery({
  phase: 'snapshot',
  state,
  contract,
  existingState: null,
});
const now = new Date().toISOString();
const payload = {
  version: MODAL_OR_DRAWER_SAVE_FIXTURE_VERSION,
  family: MODAL_OR_DRAWER_SAVE_FIXTURE_FAMILY,
  phase: 'setup',
  status: 'ready',
  createdAt: now,
  updatedAt: now,
  fixtureRef: state.fixtureRef,
  projectUid: state.projectUid,
  moduleUid: state.moduleUid,
  targetUrl: state.targetUrl,
  runId: state.runId,
  owner: state.owner,
  idempotencyKey: state.idempotencyKey,
  strategy: state.strategy,
  contract,
  remoteRecovery,
};

await writeJsonFile(state.statePath, payload);
await writeJsonFile(state.latestPath, payload);

console.log(
  JSON.stringify({
    summary: `modal_or_drawer_save fixture setup ready: ${state.idempotencyKey}`,
    family: MODAL_OR_DRAWER_SAVE_FIXTURE_FAMILY,
    scenarioId: contract.scenarioId,
    setupMode: contract.setupMode,
    remoteRecoveryStatus: remoteRecovery.status,
    remoteRecoveryAdapterRef: remoteRecovery.adapterRef,
    statePath: state.statePath,
  })
);
