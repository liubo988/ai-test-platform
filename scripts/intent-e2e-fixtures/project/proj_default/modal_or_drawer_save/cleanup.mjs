import {
  MODAL_OR_DRAWER_SAVE_FIXTURE_FAMILY,
  MODAL_OR_DRAWER_SAVE_FIXTURE_VERSION,
  buildModalOrDrawerSaveContract,
  readJsonFileIfExists,
  resolveFixtureState,
  writeJsonFile,
} from './_shared.mjs';
import { runModalOrDrawerSaveRemoteRecovery } from './_remote_recovery.mjs';

const state = resolveFixtureState();
const existingState = await readJsonFileIfExists(state.statePath);
const contract = existingState?.contract || buildModalOrDrawerSaveContract(state.targetUrl);
const remoteRecovery = await runModalOrDrawerSaveRemoteRecovery({
  phase: 'restore',
  state,
  contract,
  existingState,
});
const now = new Date().toISOString();
const payload = {
  ...(existingState || {}),
  version: MODAL_OR_DRAWER_SAVE_FIXTURE_VERSION,
  family: MODAL_OR_DRAWER_SAVE_FIXTURE_FAMILY,
  phase: 'cleanup',
  status: 'cleaned',
  createdAt: existingState?.createdAt || now,
  updatedAt: now,
  cleanedAt: now,
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
  cleanup: {
    stateFound: Boolean(existingState),
    cleanupPath: state.cleanupPath,
    policy: contract.cleanupPolicy,
    remoteRecoveryStatus: remoteRecovery.status,
    remoteRecoveryOutcome: remoteRecovery.outcome || '',
  },
};

await writeJsonFile(state.statePath, payload);
await writeJsonFile(state.cleanupPath, payload);
await writeJsonFile(state.latestPath, payload);

console.log(
  JSON.stringify({
    summary: `modal_or_drawer_save fixture cleanup completed: ${state.idempotencyKey}`,
    family: MODAL_OR_DRAWER_SAVE_FIXTURE_FAMILY,
    scenarioId: contract.scenarioId,
    stateFound: Boolean(existingState),
    remoteRecoveryStatus: remoteRecovery.status,
    remoteRecoveryOutcome: remoteRecovery.outcome || '',
    statePath: state.statePath,
    cleanupPath: state.cleanupPath,
  })
);
