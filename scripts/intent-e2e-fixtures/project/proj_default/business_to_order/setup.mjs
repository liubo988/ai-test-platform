import {
  BUSINESS_TO_ORDER_FIXTURE_FAMILY,
  BUSINESS_TO_ORDER_FIXTURE_VERSION,
  buildBusinessToOrderContract,
  buildBusinessToOrderSeed,
  readJsonFileIfExists,
  resolveFixtureState,
  writeJsonFile,
} from './_shared.mjs';

const state = resolveFixtureState();
const existingState = await readJsonFileIfExists(state.statePath);
const seed = buildBusinessToOrderSeed(state, existingState?.contract?.seed);
const contract = buildBusinessToOrderContract(state, seed);
const now = new Date().toISOString();
const payload = {
  version: BUSINESS_TO_ORDER_FIXTURE_VERSION,
  family: BUSINESS_TO_ORDER_FIXTURE_FAMILY,
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
    summary: `business_to_order fixture setup ready: ${state.idempotencyKey}`,
    family: BUSINESS_TO_ORDER_FIXTURE_FAMILY,
    scenarioId: contract.scenarioId,
    setupMode: contract.setupMode,
    contactPhone: seed.contactPhone,
    statePath: state.statePath,
  })
);
