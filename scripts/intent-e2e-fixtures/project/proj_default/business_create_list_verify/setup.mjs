import {
  BUSINESS_CREATE_LIST_VERIFY_FIXTURE_FAMILY,
  BUSINESS_CREATE_LIST_VERIFY_FIXTURE_VERSION,
  buildBusinessCreateListSeed,
  buildBusinessCreateListVerifyContract,
  readJsonFileIfExists,
  resolveFixtureState,
  writeJsonFile,
} from './_shared.mjs';

const state = resolveFixtureState();
const existingState = await readJsonFileIfExists(state.statePath);
const seed = buildBusinessCreateListSeed(state, existingState?.contract?.seed);
const contract = buildBusinessCreateListVerifyContract(state, seed);
const now = new Date().toISOString();
const payload = {
  version: BUSINESS_CREATE_LIST_VERIFY_FIXTURE_VERSION,
  family: BUSINESS_CREATE_LIST_VERIFY_FIXTURE_FAMILY,
  phase: 'setup',
  status: 'ready',
  createdAt: existingState?.createdAt || now,
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
};

await writeJsonFile(state.statePath, payload);
await writeJsonFile(state.latestPath, payload);

console.log(
  JSON.stringify({
    summary: `business_create_list_verify fixture setup ready: ${state.idempotencyKey}`,
    family: BUSINESS_CREATE_LIST_VERIFY_FIXTURE_FAMILY,
    scenarioId: contract.scenarioId,
    setupMode: contract.setupMode,
    contactPhone: seed.contactPhone,
    statePath: state.statePath,
  })
);
