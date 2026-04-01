import { createHash } from 'node:crypto';
import type { ScenarioCard } from '@/lib/ai/scenario-card';
import type { IntentCompiledExecutionTemplate } from '@/lib/intent-execution-compiler';
import type { IntentExecutionPlan, IntentVerificationPlan } from '@/lib/intent-execution-plan';

export type PlatformTestType = 'browser_e2e' | 'api_flow' | 'repo_test' | 'contract_check';
export type PlatformRunnerType = 'playwright_runner' | 'http_runner' | 'repo_test_runner' | 'contract_runner';

export interface PlatformTestCaseAsset {
  schemaVersion: 1;
  source: 'intent_e2e';
  caseId: string;
  title: string;
  description: string;
  projectUid: string;
  moduleUid: string;
  tags: string[];
  typeFields: {
    taskMode: 'page' | 'scenario';
    entryUrl: string;
    targetUrl: string;
    successCriteriaCount: number;
  };
}

export interface PlatformTestSpecAsset {
  schemaVersion: 1;
  source: 'intent_e2e';
  specId: string;
  summary: string;
  targetUrl: string;
  scenarioEntryUrl: string;
  stepCount: number;
  compiledSlotCount: number;
  hasStructuredPlan: boolean;
  typeFields: {
    taskMode: 'page' | 'scenario';
    matchedRecipeSlugs: string[];
  };
}

export interface PlatformVerificationContractAsset {
  schemaVersion: 1;
  source: 'intent_e2e';
  contractId: string;
  expectedOutcome: string;
  requiredCheckCount: number;
  checkKinds: string[];
  stableIdentifiers: string[];
  typeFields: {
    verificationPlanAvailable: boolean;
    policyNotes: string[];
  };
}

export interface PlatformArtifactContractAsset {
  schemaVersion: 1;
  source: 'intent_e2e';
  artifactKinds: string[];
  supportsStreaming: boolean;
  typeFields: {
    browserSession: boolean;
    compiledTemplate: boolean;
    structuredPatch: boolean;
    repairObservation: boolean;
  };
}

export interface PlatformTestAssetBundle {
  testType: PlatformTestType;
  runnerType: PlatformRunnerType;
  testCase: PlatformTestCaseAsset;
  testSpec: PlatformTestSpecAsset;
  verificationContract: PlatformVerificationContractAsset;
  artifactContract: PlatformArtifactContractAsset;
}

export interface PlatformTestAssetBundleSummary {
  testType: PlatformTestType;
  runnerType: PlatformRunnerType;
  testCaseId: string;
  testSpecId: string;
  verificationContractId: string;
  artifactKinds: string[];
}

export const DEFAULT_INTENT_E2E_TEST_TYPE: PlatformTestType = 'browser_e2e';
export const DEFAULT_INTENT_E2E_RUNNER_TYPE: PlatformRunnerType = 'playwright_runner';

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

function createDeterministicId(prefix: string, seedParts: Array<string | null | undefined>): string {
  const seed = seedParts.map((item) => (typeof item === 'string' ? item.trim() : '')).join('|');
  return `${prefix}-${createHash('sha1').update(seed).digest('hex').slice(0, 12)}`;
}

function normalizeTaskMode(value: unknown): 'page' | 'scenario' {
  return value === 'page' ? 'page' : 'scenario';
}

export function normalizePlatformTestType(value: unknown): PlatformTestType | '' {
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

export function normalizePlatformRunnerType(value: unknown): PlatformRunnerType | '' {
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

export interface BuildBrowserE2EPlatformTestAssetBundleInput {
  projectUid?: string;
  moduleUid?: string;
  requestInput?: string;
  scenarioCard: ScenarioCard;
  description: string;
  targetUrl: string;
  scenarioEntryUrl?: string;
  executionPlan?: IntentExecutionPlan;
  verificationPlan?: IntentVerificationPlan;
  precheckPolicyNotes?: string[];
  compiledTemplate?: IntentCompiledExecutionTemplate;
}

export interface ResolvePlatformTestAssetBundleInput {
  testType?: unknown;
  runnerType?: unknown;
  testCase?: PlatformTestCaseAsset | null;
  testSpec?: PlatformTestSpecAsset | null;
  verificationContract?: PlatformVerificationContractAsset | null;
  artifactContract?: PlatformArtifactContractAsset | null;
  projectUid?: string;
  moduleUid?: string;
  requestInput?: string;
  scenarioCard?: ScenarioCard | null;
  description?: string;
  targetUrl?: string;
  scenarioEntryUrl?: string;
  executionPlan?: IntentExecutionPlan;
  verificationPlan?: IntentVerificationPlan;
  precheckPolicyNotes?: string[];
  compiledTemplate?: IntentCompiledExecutionTemplate;
}

function hasCompletePlatformTestAssetBundle(
  input: Pick<
    ResolvePlatformTestAssetBundleInput,
    'testCase' | 'testSpec' | 'verificationContract' | 'artifactContract'
  >
): input is {
  testCase: PlatformTestCaseAsset;
  testSpec: PlatformTestSpecAsset;
  verificationContract: PlatformVerificationContractAsset;
  artifactContract: PlatformArtifactContractAsset;
} {
  return Boolean(input.testCase && input.testSpec && input.verificationContract && input.artifactContract);
}

export function buildBrowserE2EPlatformTestAssetBundle(
  input: BuildBrowserE2EPlatformTestAssetBundleInput
): PlatformTestAssetBundle {
  const projectUid = input.projectUid?.trim() || '';
  const moduleUid = input.moduleUid?.trim() || '';
  const taskMode = normalizeTaskMode(input.scenarioCard.taskMode);
  const targetUrl = input.targetUrl.trim();
  const scenarioEntryUrl = input.scenarioEntryUrl?.trim() || input.scenarioCard.flowDefinition.entryUrl?.trim() || targetUrl;
  const title = input.scenarioCard.title.trim() || input.requestInput?.trim() || 'AI 意图测试';
  const description = input.description.trim() || input.scenarioCard.featureDescription.trim() || title;
  const matchedRecipeSlugs = uniqueStrings([
    ...(input.executionPlan?.matchedRecipeSlugs || []),
    ...(input.verificationPlan?.matchedRecipeSlugs || []),
  ]);
  const stableIdentifiers = uniqueStrings(
    (input.verificationPlan?.checks || []).flatMap((check) => check.stableIdentifiers || [])
  );
  const checkKinds = uniqueStrings((input.verificationPlan?.checks || []).map((check) => check.kind));
  const requiredCheckCount = (input.verificationPlan?.checks || []).filter((check) => check.required).length;
  const stepCount = input.executionPlan?.steps.length || input.scenarioCard.flowDefinition.steps.length || 0;
  const compiledSlotCount = input.compiledTemplate?.slots.length || 0;
  const policyNotes = uniqueStrings([...(input.verificationPlan?.policyNotes || []), ...(input.precheckPolicyNotes || [])]);
  const expectedOutcome =
    input.verificationPlan?.expectedOutcome?.trim() ||
    input.executionPlan?.expectedOutcome?.trim() ||
    input.scenarioCard.flowDefinition.expectedOutcome?.trim() ||
    '';
  const caseId = createDeterministicId('tc', [projectUid, moduleUid, title, targetUrl, taskMode]);
  const specId = createDeterministicId('ts', [caseId, scenarioEntryUrl, String(stepCount), matchedRecipeSlugs.join(',')]);
  const contractId = createDeterministicId('vc', [
    specId,
    expectedOutcome,
    checkKinds.join(','),
    stableIdentifiers.join(','),
    policyNotes.join('|'),
  ]);

  return {
    testType: DEFAULT_INTENT_E2E_TEST_TYPE,
    runnerType: DEFAULT_INTENT_E2E_RUNNER_TYPE,
    testCase: {
      schemaVersion: 1,
      source: 'intent_e2e',
      caseId,
      title,
      description,
      projectUid,
      moduleUid,
      tags: uniqueStrings([
        DEFAULT_INTENT_E2E_TEST_TYPE,
        `task_mode:${taskMode}`,
        matchedRecipeSlugs.length > 0 ? 'recipe_attached' : '',
      ]),
      typeFields: {
        taskMode,
        entryUrl: scenarioEntryUrl,
        targetUrl,
        successCriteriaCount: input.scenarioCard.successCriteria.length,
      },
    },
    testSpec: {
      schemaVersion: 1,
      source: 'intent_e2e',
      specId,
      summary: input.executionPlan?.summary?.trim() || input.scenarioCard.featureDescription.trim() || description,
      targetUrl,
      scenarioEntryUrl,
      stepCount,
      compiledSlotCount,
      hasStructuredPlan: Boolean(input.executionPlan),
      typeFields: {
        taskMode,
        matchedRecipeSlugs,
      },
    },
    verificationContract: {
      schemaVersion: 1,
      source: 'intent_e2e',
      contractId,
      expectedOutcome,
      requiredCheckCount,
      checkKinds,
      stableIdentifiers,
      typeFields: {
        verificationPlanAvailable: Boolean(input.verificationPlan),
        policyNotes,
      },
    },
    artifactContract: {
      schemaVersion: 1,
      source: 'intent_e2e',
      artifactKinds: uniqueStrings([
        'scenario_card',
        input.executionPlan ? 'execution_plan' : '',
        input.verificationPlan ? 'verification_plan' : '',
        input.compiledTemplate ? 'compiled_template' : '',
        'attempt_trace',
        'final_result',
      ]),
      supportsStreaming: true,
      typeFields: {
        browserSession: true,
        compiledTemplate: Boolean(input.compiledTemplate),
        structuredPatch: true,
        repairObservation: true,
      },
    },
  };
}

export function resolvePlatformTestAssetBundle(
  input: ResolvePlatformTestAssetBundleInput
): PlatformTestAssetBundle | null {
  const testType = normalizePlatformTestType(input.testType) || DEFAULT_INTENT_E2E_TEST_TYPE;
  const runnerType = normalizePlatformRunnerType(input.runnerType) || DEFAULT_INTENT_E2E_RUNNER_TYPE;

  if (hasCompletePlatformTestAssetBundle(input)) {
    return {
      testType,
      runnerType,
      testCase: clonePlatformTestCaseAsset(input.testCase)!,
      testSpec: clonePlatformTestSpecAsset(input.testSpec)!,
      verificationContract: clonePlatformVerificationContractAsset(input.verificationContract)!,
      artifactContract: clonePlatformArtifactContractAsset(input.artifactContract)!,
    };
  }

  const scenarioCard = input.scenarioCard || null;
  if (!scenarioCard) return null;
  if (testType !== DEFAULT_INTENT_E2E_TEST_TYPE || runnerType !== DEFAULT_INTENT_E2E_RUNNER_TYPE) {
    return null;
  }

  const targetUrl =
    input.targetUrl?.trim() || scenarioCard.targetUrl.trim() || scenarioCard.flowDefinition.entryUrl.trim();
  if (!targetUrl) return null;

  return buildBrowserE2EPlatformTestAssetBundle({
    projectUid: input.projectUid,
    moduleUid: input.moduleUid,
    requestInput: input.requestInput,
    scenarioCard,
    description: input.description?.trim() || scenarioCard.featureDescription.trim() || scenarioCard.title.trim() || targetUrl,
    targetUrl,
    scenarioEntryUrl: input.scenarioEntryUrl?.trim() || scenarioCard.flowDefinition.entryUrl.trim() || targetUrl,
    executionPlan: input.executionPlan,
    verificationPlan: input.verificationPlan,
    precheckPolicyNotes: input.precheckPolicyNotes,
    compiledTemplate: input.compiledTemplate,
  });
}

export function clonePlatformTestCaseAsset(
  value?: PlatformTestCaseAsset | null
): PlatformTestCaseAsset | undefined {
  if (!value) return undefined;
  return {
    ...value,
    tags: [...value.tags],
    typeFields: {
      ...value.typeFields,
    },
  };
}

export function clonePlatformTestSpecAsset(
  value?: PlatformTestSpecAsset | null
): PlatformTestSpecAsset | undefined {
  if (!value) return undefined;
  return {
    ...value,
    typeFields: {
      ...value.typeFields,
      matchedRecipeSlugs: [...value.typeFields.matchedRecipeSlugs],
    },
  };
}

export function clonePlatformVerificationContractAsset(
  value?: PlatformVerificationContractAsset | null
): PlatformVerificationContractAsset | undefined {
  if (!value) return undefined;
  return {
    ...value,
    checkKinds: [...value.checkKinds],
    stableIdentifiers: [...value.stableIdentifiers],
    typeFields: {
      ...value.typeFields,
      policyNotes: [...value.typeFields.policyNotes],
    },
  };
}

export function clonePlatformArtifactContractAsset(
  value?: PlatformArtifactContractAsset | null
): PlatformArtifactContractAsset | undefined {
  if (!value) return undefined;
  return {
    ...value,
    artifactKinds: [...value.artifactKinds],
    typeFields: {
      ...value.typeFields,
    },
  };
}

export function clonePlatformTestAssetBundle(
  value?: PlatformTestAssetBundle | null
): PlatformTestAssetBundle | undefined {
  if (!value) return undefined;
  return {
    testType: value.testType,
    runnerType: value.runnerType,
    testCase: clonePlatformTestCaseAsset(value.testCase)!,
    testSpec: clonePlatformTestSpecAsset(value.testSpec)!,
    verificationContract: clonePlatformVerificationContractAsset(value.verificationContract)!,
    artifactContract: clonePlatformArtifactContractAsset(value.artifactContract)!,
  };
}

export function summarizePlatformTestAssetBundle(
  value?: PlatformTestAssetBundle | null
): PlatformTestAssetBundleSummary | null {
  if (!value) return null;
  return {
    testType: value.testType,
    runnerType: value.runnerType,
    testCaseId: value.testCase.caseId,
    testSpecId: value.testSpec.specId,
    verificationContractId: value.verificationContract.contractId,
    artifactKinds: [...value.artifactContract.artifactKinds],
  };
}
