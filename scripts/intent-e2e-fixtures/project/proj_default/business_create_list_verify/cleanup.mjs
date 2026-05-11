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
const contract = existingState?.contract || buildBusinessCreateListVerifyContract(state, seed);
const now = new Date().toISOString();
const payload = {
  ...(existingState || {}),
  version: BUSINESS_CREATE_LIST_VERIFY_FIXTURE_VERSION,
  family: BUSINESS_CREATE_LIST_VERIFY_FIXTURE_FAMILY,
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
  cleanup: {
    stateFound: Boolean(existingState),
    cleanupPath: state.cleanupPath,
    policy: contract.cleanupPolicy,
    manualCleanupHint: contract.manualCleanupHint,
    capturedIdentifiers: {
      businessId: existingState?.createdBusiness?.businessId || '',
      contactPhone: contract.seed?.contactPhone || '',
      contactName: contract.seed?.contactName || '',
      companyName: contract.seed?.companyName || '',
      productName: contract.seed?.productName || '',
    },
  },
};

await writeJsonFile(state.statePath, payload);
await writeJsonFile(state.cleanupPath, payload);
await writeJsonFile(state.latestPath, payload);

console.log(
  JSON.stringify({
    summary: `business_create_list_verify fixture cleanup completed: ${state.idempotencyKey}`,
    family: BUSINESS_CREATE_LIST_VERIFY_FIXTURE_FAMILY,
    scenarioId: contract.scenarioId,
    stateFound: Boolean(existingState),
    contactPhone: contract.seed?.contactPhone || '',
    statePath: state.statePath,
    cleanupPath: state.cleanupPath,
  })
);
