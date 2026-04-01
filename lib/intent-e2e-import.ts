export type IntentImportPlatformTestType = 'browser_e2e' | 'api_flow' | 'repo_test' | 'contract_check';
export type IntentImportPlatformRunnerType =
  | 'playwright_runner'
  | 'http_runner'
  | 'repo_test_runner'
  | 'contract_runner';

export type IntentImportStatus = 'passed' | 'failed';
export interface IntentImportPlatformSummary {
  testType: IntentImportPlatformTestType;
  runnerType: IntentImportPlatformRunnerType;
  testCaseId: string;
  testSpecId: string;
  verificationContractId: string;
  artifactKinds: string[];
  verificationPolicyNotes: string[];
}

function normalizePlatformTestType(value: unknown): IntentImportPlatformTestType | '' {
  switch (value) {
    case 'browser_e2e':
    case 'api_flow':
    case 'repo_test':
    case 'contract_check':
      return value;
    default:
      return '';
  }
}

function normalizePlatformRunnerType(value: unknown): IntentImportPlatformRunnerType | '' {
  switch (value) {
    case 'playwright_runner':
    case 'http_runner':
    case 'repo_test_runner':
    case 'contract_runner':
      return value;
    default:
      return '';
  }
}

const INTENT_IMPORT_PREFIX = /^\[intent_e2e_import\]\s+runId=([^\s]+)/m;
const INTENT_IMPORT_TEST_TYPE_PREFIX = /^平台测试类型：([^\n]+)/m;
const INTENT_IMPORT_RUNNER_TYPE_PREFIX = /^平台执行器：([^\n]+)/m;
const INTENT_IMPORT_TEST_CASE_PREFIX = /^平台用例资产：([^\n]+)/m;
const INTENT_IMPORT_TEST_SPEC_PREFIX = /^平台规格资产：([^\n]+)/m;
const INTENT_IMPORT_VERIFICATION_CONTRACT_PREFIX = /^平台验收契约：([^\n]+)/m;
const INTENT_IMPORT_VERIFICATION_POLICY_NOTE_PREFIX = /^平台验收策略：([^\n]+)/gm;
const INTENT_IMPORT_ARTIFACT_KINDS_PREFIX = /^平台产物类型：([^\n]+)/m;

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

function extractVerificationPolicyNotesFromPrompt(prompt: string): string[] {
  return uniqueStrings(
    Array.from(prompt.matchAll(INTENT_IMPORT_VERIFICATION_POLICY_NOTE_PREFIX)).map((match) => match[1] || '')
  );
}

function extractIntentImportPlatformSummaryFromBundle(bundle: unknown): IntentImportPlatformSummary | null {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) return null;

  const candidate = bundle as {
    testType?: unknown;
    runnerType?: unknown;
    testCase?: { caseId?: unknown } | null;
    testSpec?: { specId?: unknown } | null;
    verificationContract?: {
      contractId?: unknown;
      typeFields?: { policyNotes?: unknown } | null;
    } | null;
    artifactContract?: { artifactKinds?: unknown } | null;
  };
  const testType = normalizePlatformTestType(candidate.testType);
  const runnerType = normalizePlatformRunnerType(candidate.runnerType);
  if (!testType || !runnerType) return null;

  return {
    testType,
    runnerType,
    testCaseId: typeof candidate.testCase?.caseId === 'string' ? candidate.testCase.caseId.trim() : '',
    testSpecId: typeof candidate.testSpec?.specId === 'string' ? candidate.testSpec.specId.trim() : '',
    verificationContractId:
      typeof candidate.verificationContract?.contractId === 'string' ? candidate.verificationContract.contractId.trim() : '',
    artifactKinds: Array.isArray(candidate.artifactContract?.artifactKinds)
      ? candidate.artifactContract.artifactKinds
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    verificationPolicyNotes: Array.isArray(candidate.verificationContract?.typeFields?.policyNotes)
      ? uniqueStrings(candidate.verificationContract.typeFields.policyNotes)
      : [],
  };
}

function extractIntentImportPlatformSummaryFromMetaRecord(meta: unknown): IntentImportPlatformSummary | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;

  const candidate = meta as {
    testType?: unknown;
    runnerType?: unknown;
    testCaseId?: unknown;
    testSpecId?: unknown;
    verificationContractId?: unknown;
    artifactKinds?: unknown;
    verificationPolicyNotes?: unknown;
  };
  const testType = normalizePlatformTestType(candidate.testType);
  const runnerType = normalizePlatformRunnerType(candidate.runnerType);
  if (!testType || !runnerType) return null;

  return {
    testType,
    runnerType,
    testCaseId: typeof candidate.testCaseId === 'string' ? candidate.testCaseId.trim() : '',
    testSpecId: typeof candidate.testSpecId === 'string' ? candidate.testSpecId.trim() : '',
    verificationContractId:
      typeof candidate.verificationContractId === 'string' ? candidate.verificationContractId.trim() : '',
    artifactKinds: Array.isArray(candidate.artifactKinds) ? uniqueStrings(candidate.artifactKinds) : [],
    verificationPolicyNotes: Array.isArray(candidate.verificationPolicyNotes)
      ? uniqueStrings(candidate.verificationPolicyNotes)
      : [],
  };
}

export function extractIntentImportRunIdFromPrompt(prompt: unknown): string {
  if (typeof prompt !== 'string') return '';
  const match = prompt.match(INTENT_IMPORT_PREFIX);
  return match?.[1]?.trim() || '';
}

export function normalizeIntentImportStatusFromActionType(actionType: unknown): IntentImportStatus | '' {
  if (typeof actionType !== 'string') return '';
  if (actionType === 'plan_imported_passed') return 'passed';
  if (actionType === 'plan_imported_failed') return 'failed';
  return '';
}

export function extractIntentImportRunIdFromArtifactMeta(meta: unknown): string {
  if (!meta || typeof meta !== 'object') return '';
  const runId = (meta as { importedFromRunId?: unknown }).importedFromRunId;
  return typeof runId === 'string' ? runId.trim() : '';
}

export function extractIntentImportStatusFromArtifactMeta(meta: unknown): IntentImportStatus | '' {
  if (!meta || typeof meta !== 'object') return '';
  const success = (meta as { success?: unknown }).success;
  if (success === true) return 'passed';
  if (success === false) return 'failed';
  return '';
}

export function extractIntentImportPlatformSummaryFromPrompt(prompt: unknown): IntentImportPlatformSummary | null {
  if (typeof prompt !== 'string') return null;

  const testType = normalizePlatformTestType(prompt.match(INTENT_IMPORT_TEST_TYPE_PREFIX)?.[1]?.trim());
  const runnerType = normalizePlatformRunnerType(prompt.match(INTENT_IMPORT_RUNNER_TYPE_PREFIX)?.[1]?.trim());
  if (!testType || !runnerType) return null;

  const artifactKindsRaw = prompt.match(INTENT_IMPORT_ARTIFACT_KINDS_PREFIX)?.[1]?.trim() || '';

  return {
    testType,
    runnerType,
    testCaseId: prompt.match(INTENT_IMPORT_TEST_CASE_PREFIX)?.[1]?.trim() || '',
    testSpecId: prompt.match(INTENT_IMPORT_TEST_SPEC_PREFIX)?.[1]?.trim() || '',
    verificationContractId: prompt.match(INTENT_IMPORT_VERIFICATION_CONTRACT_PREFIX)?.[1]?.trim() || '',
    artifactKinds: artifactKindsRaw
      ? artifactKindsRaw
          .split('/')
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    verificationPolicyNotes: extractVerificationPolicyNotesFromPrompt(prompt),
  };
}

export function extractIntentImportPlatformSummaryFromArtifactMeta(meta: unknown): IntentImportPlatformSummary | null {
  if (!meta || typeof meta !== 'object') return null;
  const bundleSummary = extractIntentImportPlatformSummaryFromBundle(
    (meta as { platformAssetBundle?: unknown }).platformAssetBundle
  );
  if (bundleSummary) return bundleSummary;

  const platformMetaSummary = extractIntentImportPlatformSummaryFromMetaRecord(
    (meta as { platformMeta?: unknown }).platformMeta
  );
  if (platformMetaSummary) return platformMetaSummary;

  return extractIntentImportPlatformSummaryFromMetaRecord(meta);
}
