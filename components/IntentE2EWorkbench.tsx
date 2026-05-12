'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import BrowserView from '@/components/BrowserView';
import { buildIntentE2ELaunchDecisionRequestBody } from '@/lib/ai/intent-e2e-request';
import { readExecutionEntryNavigationTargets } from '@/lib/execution-entry-navigation';
import type {
  IntentProjectKnowledgeMergeCandidateSource as IntentProjectKnowledgeDraftCandidateSource,
  IntentProjectKnowledgeMergeFeedbackStatus,
  IntentProjectKnowledgeMergeLifecyclePolicy as IntentProjectKnowledgeDraftCandidateLifecyclePolicy,
  IntentProjectKnowledgeMergeNotice as ProjectKnowledgeMergeNotice,
  IntentProjectKnowledgeMergePreflightSummary as ProjectKnowledgeMergePreflightSummary,
  IntentProjectKnowledgeMergeSelectionSummary as ProjectKnowledgeMergeSelectionSummary,
} from '@/lib/intent-project-knowledge-merge-provenance';
import {
  buildIntentCapabilityWorkbenchHref,
  createIntentCapabilityLaunchToken,
  stashIntentCapabilityPreset,
} from '@/lib/intent-capability-preset';
import {
  defaultLlmConfigDraft,
  formatLlmProviderOption,
  getLlmProviderOptions,
  isLlmProviderImplemented,
  toLlmDraft,
  type LLMConfigDraft,
  type LLMConfigResponse,
} from '@/lib/llm-config-browser';
import { buildIntentStarterCapabilityPreset } from '@/lib/intent-starter-capability-preset';
import {
  canPromoteIntentStarterAssetToProjectCapability,
  intentStarterAssetScopeLabel,
  type IntentResolvedStarterAsset,
  type IntentStarterAssetScope,
} from '@/lib/intent-starter-assets';
import {
  buildIntentStarterAssetPromotionDecision,
  summarizeIntentStarterAssetPromotionDecisions,
  type IntentStarterAssetPromotionDecision,
} from '@/lib/intent-starter-asset-promotion';
import {
  INTENT_DRAFT_LAUNCH_QUERY_PARAM,
  INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE,
  normalizeIntentDraftLaunchMode,
  resolveIntentDraftAutoLaunchGate,
  shouldOverrideDraftAutoRunLaunchDecision,
  shouldTreatQueryLaunchDecisionAsHardBlock,
} from '@/lib/intent-e2e-draft-launch';
import {
  getIntentE2EReleaseCheckStatusLabel as releaseCheckStatusLabel,
  getIntentE2EReleaseFamilyIssueMessages as releaseFamilyIssueMessages,
  getIntentE2EReleaseReadinessDetailText as releaseReadinessDetailText,
  getIntentE2EReleaseReadinessLabel as releaseReadinessLabel,
  getIntentE2EReleaseReadinessSummaryText as releaseReadinessSummaryText,
} from '@/lib/intent-e2e-release-status-view';
import {
  isIntentProjectKnowledgeDraftCandidateDeferredByDefault,
  isIntentProjectKnowledgeDraftCandidateDeprioritized,
  isIntentProjectKnowledgeDraftCandidateMergeRecommended,
  isIntentProjectKnowledgeDraftCandidateNegativeHistory,
  isIntentProjectKnowledgeDraftCandidateProbationary,
  isIntentProjectKnowledgeDraftCandidateSelectable,
} from '@/lib/intent-project-knowledge-draft-merge-policy';
import {
  hasIntentVerificationFailurePressureViewHighFailure,
  normalizeIntentVerificationFailurePressureViewSummary,
  summarizeIntentVerificationFailurePressureViewSummaryFromItems,
} from '@/lib/intent-verification-failure-pressure-view';
import { buildIntentProjectRecipeMergeInputsFromPlaybookCandidates } from '@/lib/intent-e2e-playbook';
import { buildWorkspaceProjectPath } from '@/lib/workspace-platform-query-state';
import { buildIntentE2EPromotionCoverageSummary } from '@/lib/intent-e2e-promotion-coverage';
import type { IntentSuccessfulRunKnowledgePromotionReceipt } from '@/lib/intent-successful-run-knowledge-promotion-receipt';
import type { IntentE2EPriorityScenarioFamily } from '@/lib/intent-e2e-priority-scenario-family';

type StepResult = {
  title: string;
  status: 'running' | 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  at?: string;
};

type TestResult = {
  success: boolean;
  duration: number;
  steps: StepResult[];
  error: string | null;
};

const INTENT_LAUNCH_DECISION_REQUEST_TIMEOUT_MS = 10_000;

type IntentFailureTriage = {
  failureClass:
    | 'env_transient'
    | 'auth_failed'
    | 'permission_blocked'
    | 'data_missing'
    | 'target_row_not_found'
    | 'ui_anchor_missing'
    | 'selector_drift'
    | 'assertion_too_strict'
    | 'workflow_gap'
    | 'repair_stagnated'
    | 'unknown';
  repairable: boolean;
  summary: string;
  matchedSignals: string[];
  diagnosis?: {
    failureSignature: string;
    failedStepTitle: string;
    failedLocator: string;
    targetAnchor: string;
    pageUrl: string;
    repeatedCount: number;
    candidateAnchors: string[];
    frameHints: string[];
    nextActions: string[];
  } | null;
};

type ScenarioStep = {
  stepUid: string;
  stepType: 'ui' | 'api' | 'assert' | 'extract' | 'cleanup';
  title: string;
  target: string;
  instruction: string;
  expectedResult: string;
  extractVariable: string;
};

type FlowDefinition = {
  version: 1;
  entryUrl: string;
  sharedVariables: string[];
  expectedOutcome: string;
  cleanupNotes: string;
  steps: ScenarioStep[];
};

type ScenarioCard = {
  version: 1;
  title: string;
  taskMode: 'page' | 'scenario';
  targetUrl: string;
  featureDescription: string;
  flowDefinition: FlowDefinition;
  successCriteria: string[];
  visualAnchors: string[];
  notes: string[];
};

type ExecutionPlanStep = {
  planStepUid: string;
  scenarioStepUid: string;
  stepType: ScenarioStep['stepType'];
  title: string;
  target: string;
  goal: string;
  allowedActions: string[];
  preferredHelpers: string[];
  requiredAssertions: string[];
  extractVariable: string;
  sharedVariables: string[];
  dependsOnPlanStepUids: string[];
};

type ExecutionPlan = {
  version: 1;
  compiler: 'deterministic_dsl_v1';
  mode: 'page' | 'scenario';
  entryUrl: string;
  summary: string;
  expectedOutcome: string;
  sharedVariables: string[];
  globalRules: string[];
  preferredPrimitives: string[];
  outputContract: string[];
  steps: ExecutionPlanStep[];
};

type VerificationPlanCheck = {
  checkUid: string;
  kind: 'url' | 'response' | 'ui_state' | 'table_row' | 'modal_state' | 'variable';
  source: 'success_criteria' | 'step_expected_result' | 'step_extract_variable';
  title: string;
  instruction: string;
  preferredHelpers: string[];
  relatedPlanStepUids: string[];
  required: boolean;
};

type VerificationPlan = {
  version: 1;
  strategy: 'deterministic_verification_v1';
  expectedOutcome: string;
  checks: VerificationPlanCheck[];
  cleanupNotes: string;
};

type CompiledExecutionTemplateSlot = {
  slotUid: string;
  kind: 'plan_step' | 'verification';
  title: string;
  planStepUid?: string;
  relatedCheckUids: string[];
  preferredHelpers: string[];
  instructions: string[];
};

type CompiledExecutionTemplate = {
  version: 1;
  compiler: ExecutionPlan['compiler'];
  testTitle: string;
  entryUrl: string;
  sharedVariables: string[];
  slots: CompiledExecutionTemplateSlot[];
  code: string;
};

type IntentExecutionStructuredPatchSlot = {
  slotUid: string;
  code: string;
};

type IntentExecutionStructuredPatch = {
  version: 1;
  strategy: 'deterministic_slot_patch_v1';
  targetSlotUids: string[];
  returnedSlotUids: string[];
  reusedPreviousCode: boolean;
  baseCodeSource: 'compiled_template' | 'previous_code';
  patch: {
    version: 1;
    slots: IntentExecutionStructuredPatchSlot[];
  };
};

type AttemptEvent =
  | {
      type: 'thinking' | 'code' | 'complete' | 'error';
      content: string;
    }
  | {
      type: 'structured_patch';
      content: string;
      structuredPatch: IntentExecutionStructuredPatch;
    };

type AttemptLog = {
  level: string;
  message: string;
  at?: string;
};

type IntentAttempt = {
  attempt: number;
  kind: 'generate' | 'repair';
  sessionId?: string;
  code: string;
  events: AttemptEvent[];
  logs: AttemptLog[];
  result: TestResult | null;
  helperUsage?: {
    usedHelpers: string[];
    usedSuggestedHelpers: string[];
  };
  structuredPatch?: IntentExecutionStructuredPatch;
  triage?: IntentFailureTriage | null;
  status?: 'running' | 'completed';
};

type IntentKnowledgeSummary = {
  profilePath: string;
  matchCount: number;
  matchedRuleIds: string[];
  matchedRuleTitles: string[];
  capabilitySlugs: string[];
  suggestedHelpers: string[];
  starterAssets?: IntentResolvedStarterAsset[];
};

type IntentExperienceHint = {
  hintId: string;
  kind: 'successful_run' | 'failed_run';
  outcome: 'first_pass' | 'repaired_pass' | 'failed';
  runId: string;
  projectUid: string;
  moduleUid: string;
  scenarioFamily: string;
  scenarioTitle: string;
  requestSummary: string;
  targetPath: string;
  matchScore: number;
  matchedSignals: string[];
  matchedRecipeSlugs: string[];
  chosenHelpers: string[];
  verifierStrategySummary: string;
  stableEntityHints: string[];
  pitfalls: string[];
  playbookSlugs: string[];
};

type IntentExperienceSummary = {
  source: 'project_terminal_runs';
  scannedRunCount: number;
  matchedRunCount: number;
  hints: IntentExperienceHint[];
};

type IntentPlaybookCandidate = {
  candidateId: string;
  slug: string;
  title: string;
  scenarioFamily: string;
  targetPath: string;
  matchedRecipeSlugs: string[];
  stepTypes: string[];
  preconditions: string[];
  executorPlan: string[];
  verifierPlan: string[];
  preferredHelpers: string[];
  knownPitfalls: string[];
  sourceRunIds: string[];
  successRate: number;
  lastVerifiedAt: string;
  promotionStatus: 'candidate';
};

type IntentRunReviewAction = {
  action:
    | 'reuse_similar_flow'
    | 'prepare_prerequisites'
    | 'preview_knowledge_draft'
    | 'edit_description'
    | 'handoff_manual'
    | 'promote_playbook';
  label: string;
  description: string;
  recommended: boolean;
};

type IntentRunReviewAdvice = {
  headline: string;
  summary: string;
  actions: IntentRunReviewAction[];
};

type IntentRunReview = {
  reviewedAt: string;
  summary: string;
  playbookCandidates: IntentPlaybookCandidate[];
  nextStepAdvice: IntentRunReviewAdvice | null;
};

type IntentAssetReadinessStatus = 'ready' | 'asset_missing' | 'no_hit';

type IntentAssetReadiness = {
  status: IntentAssetReadinessStatus;
  projectUid: string;
  onboardingPath?: string;
  knowledgePath?: string;
  repairMemoryPath?: string;
  hasOnboarding?: boolean;
  onboardingReady?: boolean;
  hasKnowledgeAsset?: boolean;
  hasRepairMemoryAsset?: boolean;
  knowledgeMatchCount: number;
  reasons: string[];
};

type IntentRepairBudgetReasonCode =
  | 'runtime_limit'
  | 'asset_missing'
  | 'knowledge_no_hit'
  | 'auth_blocked'
  | 'permission_blocked'
  | 'env_blocked'
  | 'data_blocked'
  | 'target_row_not_found'
  | 'workflow_gap'
  | 'unknown'
  | 'ui_anchor_missing'
  | 'repair_stagnated';

type IntentRepairBudget = {
  configuredRepairLimit: number;
  maxRepairAttempts: number;
  usedRepairAttempts: number;
  remainingRepairAttempts: number;
  exhausted: boolean;
  reasonCode: IntentRepairBudgetReasonCode;
  stopReason: string;
  summary: string;
};

type IntentFailureCtaActionKey =
  | 'prepare_prerequisites'
  | 'preview_knowledge_draft'
  | 'edit_description'
  | 'handoff_manual';

type IntentFailureCtaAction = {
  action: IntentFailureCtaActionKey;
  label: string;
  description: string;
  recommended: boolean;
  enabled: boolean;
};

type IntentFailureCta = {
  headline: string;
  summary: string;
  primaryAction: IntentFailureCtaActionKey;
  actions: IntentFailureCtaAction[];
};

type IntentQualityBucket =
  | 'passed'
  | 'auth_blocked'
  | 'permission_blocked'
  | 'env_blocked'
  | 'data_blocked'
  | 'model_quality'
  | 'canceled';

type IntentQualitySplit = {
  bucket: IntentQualityBucket;
  blocked: boolean;
  qualityEligible: boolean;
  blockerKind: 'auth' | 'permission' | 'environment' | 'data' | '';
};

type IntentResolvedUrls = {
  targetUrl: string;
  scenarioEntryUrl: string;
  precheckUrl: string;
  analyzeUrl: string;
};

type IntentPlatformTestType = 'browser_e2e' | 'api_flow' | 'repo_test' | 'contract_check';
type IntentPlatformRunnerType = 'playwright_runner' | 'http_runner' | 'repo_test_runner' | 'contract_runner';

type IntentPlatformTestCaseAsset = {
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
};

type IntentPlatformTestSpecAsset = {
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
};

type IntentPlatformVerificationContractAsset = {
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
};

type IntentPlatformArtifactContractAsset = {
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
};

type IntentRunResult = {
  testType?: IntentPlatformTestType;
  runnerType?: IntentPlatformRunnerType;
  testCase?: IntentPlatformTestCaseAsset | null;
  testSpec?: IntentPlatformTestSpecAsset | null;
  verificationContract?: IntentPlatformVerificationContractAsset | null;
  artifactContract?: IntentPlatformArtifactContractAsset | null;
  scenarioCard: ScenarioCard;
  executionPlan?: ExecutionPlan;
  verificationPlan?: VerificationPlan;
  compiledTemplate?: CompiledExecutionTemplate;
  llmMeta: {
    provider: string;
    model: string;
    visionEnabled: boolean;
    attachmentCount: number;
  };
  targetUrl: string;
  resolvedUrls?: IntentResolvedUrls;
  description: string;
  knowledge?: IntentKnowledgeSummary | null;
  experience?: IntentExperienceSummary | null;
  assetReadiness?: IntentAssetReadiness | null;
  repairBudget?: IntentRepairBudget | null;
  failureCta?: IntentFailureCta | null;
  qualitySplit?: IntentQualitySplit | null;
  review?: IntentRunReview | null;
  attempts: IntentAttempt[];
  finalResult: TestResult;
  finalFailureTriage?: IntentFailureTriage | null;
};

type IntentRunStatus = 'created' | 'running' | 'passed' | 'failed' | 'canceled';

type IntentRunRecord = {
  runId: string;
  testType?: IntentPlatformTestType;
  runnerType?: IntentPlatformRunnerType;
  status: IntentRunStatus;
  stage: Exclude<IntentStreamStage, 'idle'> | 'created';
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  endedAt?: string;
  request: {
    input: string;
    targetUrl: string;
    attachmentCount: number;
    hasAuth: boolean;
    intentDraftUid?: string;
    llm: {
      provider: string;
      model: string;
      apiStyle: string;
      visionEnabled: boolean | null;
      selfHealRetries: number | null;
      maxPlanSteps: number | null;
    };
  };
  events: IntentStreamEvent[];
  result: IntentRunResult | null;
  error: string | null;
};

type IntentRunEnvelope = {
  runId: string;
  run: IntentRunRecord;
};

type IntentRunResponse = {
  run: IntentRunRecord;
};

type IntentRunCancelResponse = {
  ok: boolean;
  run: IntentRunRecord | null;
  error?: string;
};

type ProjectIntentRecipeMutationResponse = {
  mode: 'merge' | 'register' | 'update';
  result: {
    writtenTo: string;
    backupPath?: string | null;
    addedRecipeSlugs: string[];
    updatedRecipeSlugs: string[];
    skippedRecipeSlugs: string[];
  };
  auditWarning?: string;
  rolloutWarning?: string;
  error?: string;
};

type IntentProjectAssetAvailabilityStatus = 'ready' | 'asset_missing';

type IntentProjectAssetAvailability = {
  status: IntentProjectAssetAvailabilityStatus;
  projectUid: string;
  onboardingPath?: string;
  knowledgePath?: string;
  repairMemoryPath?: string;
  hasOnboarding?: boolean;
  onboardingReady?: boolean;
  hasKnowledgeAsset?: boolean;
  hasRepairMemoryAsset?: boolean;
  reasons: string[];
};

type IntentLaunchDecisionValue = 'auto_run' | 'needs_bootstrap' | 'needs_fixture' | 'needs_clarify' | 'draft_only';

type IntentLaunchDecisionSignals = {
  projectUid: string;
  moduleUid: string;
  hasTargetUrl: boolean;
  attachmentCount: number;
  assetStatus: IntentProjectAssetAvailabilityStatus;
  requiresFixture: boolean;
  hasFixtureContract: boolean;
  hasHighFailurePressure: boolean;
  hasRepeatedFailureSuppression?: boolean;
  repeatedFailureDecision?: '' | 'needs_bootstrap' | 'needs_fixture' | 'draft_only';
  repeatedFailureReason?: string;
};

type IntentNewIntentReadinessRecommendedMode =
  | 'direct_generate'
  | 'recipe_assisted'
  | 'exploration_run'
  | 'needs_bootstrap'
  | 'needs_fixture'
  | 'needs_clarify'
  | 'draft_only';

type IntentNewIntentReadiness = {
  recommendedMode: IntentNewIntentReadinessRecommendedMode;
  confidence: 'high' | 'medium' | 'low';
  missingContracts: string[];
  failureRecoveryPlan: Array<{
    className: string;
    severity: 'high' | 'medium' | 'low';
    recommendation: string;
  }>;
  fixtureBootstrap?: {
    fixtureId: string;
    strategy: string;
    owner: string;
    idempotencyKey: string;
    setupRef: string;
    cleanupRef: string;
    requiredStableIdentifiers: string[];
    nextActions: string[];
  } | null;
  signals?: {
    source?: string;
    priorityScenarioFamily?: string;
    documentFamily?: string;
    preferredRecipeSlugs?: string[];
  };
};

type IntentLaunchDecisionResponse = {
  decision: IntentLaunchDecisionValue;
  reasons: string[];
  signals?: IntentLaunchDecisionSignals;
  assetAvailability?: IntentProjectAssetAvailability | null;
  newIntentReadiness?: IntentNewIntentReadiness | null;
  error?: string;
};

type IntentBlockedLaunchDecision = IntentLaunchDecisionResponse & {
  source: 'route' | 'query';
};

type IntentDraftLaunchDetail = {
  intentDraftUid: string;
  title: string;
  input: string;
  featureDescription: string;
  targetUrl: string;
  targetUrlHint: string;
  projectUid: string;
  moduleUid: string;
  scenarioCard: ScenarioCard | null;
  scenarioLlmMeta: Record<string, unknown>;
  planCode: string;
  attachments: Array<{
    name?: string;
    dataUrl: string;
    purpose?: string;
  }>;
  llmConfig: Record<string, unknown>;
};

type IntentStreamStage =
  | 'idle'
  | 'queued'
  | 'received'
  | 'planning'
  | 'prechecking'
  | 'analyzing'
  | 'generating'
  | 'executing'
  | 'repairing'
  | 'completed'
  | 'canceled'
  | 'error';

type IntentStreamEvent =
  | {
      type: 'stage';
      stage: Exclude<IntentStreamStage, 'idle'>;
      message: string;
      attempt?: number;
      kind?: IntentAttempt['kind'];
    }
  | {
      type: 'scenario_card';
      scenarioCard: ScenarioCard;
      llmMeta: IntentRunResult['llmMeta'];
    }
  | {
      type: 'description';
      targetUrl: string;
      scenarioEntryUrl?: string;
      precheckUrl?: string;
      analyzeUrl?: string;
      description: string;
    }
  | {
      type: 'attempt_started';
      attempt: number;
      kind: IntentAttempt['kind'];
    }
  | {
      type: 'attempt_event';
      attempt: number;
      kind: IntentAttempt['kind'];
      event: AttemptEvent;
    }
  | {
      type: 'attempt_execution_started';
      attempt: number;
      kind: IntentAttempt['kind'];
      sessionId: string;
    }
  | {
      type: 'attempt_step';
      attempt: number;
      kind: IntentAttempt['kind'];
      step: StepResult;
    }
  | {
      type: 'attempt_log';
      attempt: number;
      kind: IntentAttempt['kind'];
      log: AttemptLog;
    }
  | ({
      type: 'attempt_result';
      result: TestResult;
    } & Omit<IntentAttempt, 'status' | 'result'>)
  | {
      type: 'final_result';
      result: IntentRunResult;
    }
  | {
      type: 'error';
      message: string;
    };

type IntentProjectKnowledgeRuleMatch = {
  urlIncludes?: string[];
  titleIncludes?: string[];
  bodyIncludes?: string[];
  descriptionIncludes?: string[];
  frameUrlIncludes?: string[];
  frameSelectorIncludes?: string[];
};

type IntentProjectKnowledgeStepPatch = {
  whenStepTypes?: ScenarioStep['stepType'][];
  stepTextIncludes?: string[];
  addAllowedActions?: string[];
  addPreferredHelpers?: string[];
  addRequiredAssertions?: string[];
  addForbiddenPatterns?: string[];
};

type IntentProjectKnowledgeRule = {
  id: string;
  title: string;
  enabled?: boolean;
  match: IntentProjectKnowledgeRuleMatch;
  promptNotes: string[];
  capabilitySlugs: string[];
  addGlobalRules: string[];
  addPreferredPrimitives: string[];
  addOutputContract: string[];
  stepPatches: IntentProjectKnowledgeStepPatch[];
};

type IntentProjectKnowledgeDraftCandidateFeedback = {
  status: IntentProjectKnowledgeMergeFeedbackStatus;
  confidenceAdjustment: number;
  reasons: string[];
  supportingAuditIds: string[];
  lifecyclePolicy?: IntentProjectKnowledgeDraftCandidateLifecyclePolicy;
  lifecyclePolicyReason?: string;
};

type IntentProjectKnowledgeDraftCandidate = {
  candidateId: string;
  source: IntentProjectKnowledgeDraftCandidateSource;
  confidence: number;
  feedback?: IntentProjectKnowledgeDraftCandidateFeedback;
  category: string;
  clusterIds: string[];
  runIds?: string[];
  seenCount: number;
  resolvedCount: number;
  successRate: number;
  sampleUrls: string[];
  sampleTitles: string[];
  sampleDescriptions: string[];
  representativeErrors: string[];
  successfulStrategies: string[];
  antiPatterns: string[];
  alreadyCovered: boolean;
  coveredByRuleIds: string[];
  rule: IntentProjectKnowledgeRule;
};

type IntentProjectKnowledgeDraftSkippedItem = {
  groupKey: string;
  category: string;
  clusterIds: string[];
  sampleUrls: string[];
  reason: string;
};

type IntentProjectKnowledgeDraft = {
  version: 1;
  generatedAt: string;
  sourceMemoryPath: string;
  targetKnowledgePath: string;
  outputPath: string;
  thresholds: {
    minSeenCount: number;
    minResolvedCount: number;
    maxCandidates: number;
    projectUid?: string;
    moduleUid?: string;
  };
  summary: {
    totalClusters: number;
    eligibleClusters: number;
    totalPassedRuns: number;
    candidateGroups: number;
    repairMemoryCandidateGroups: number;
    successfulRunCandidateGroups: number;
    suggestedCandidates: number;
    alreadyCoveredCandidates: number;
    skippedItems: number;
  };
  candidates: IntentProjectKnowledgeDraftCandidate[];
  skipped: IntentProjectKnowledgeDraftSkippedItem[];
  mergedProfilePreview: {
    version: 1;
    rules: IntentProjectKnowledgeRule[];
  };
};

type ProjectKnowledgeDraftRequestOptions = {
  minSeenCount: number;
  minResolvedCount: number;
  maxCandidates: number;
  projectUid?: string;
  moduleUid?: string;
};

type ProjectKnowledgeDraftResponse = {
  draft: IntentProjectKnowledgeDraft;
  writtenTo?: string | null;
  error?: string;
};

type ProjectKnowledgeMergeSummary = {
  beforeRuleCount: number;
  afterRuleCount: number;
  addedRules: Array<{
    ruleId: string;
    title: string;
    urlIncludes: string[];
    capabilitySlugs: string[];
    promptNotes: string[];
    stepPatchCount: number;
  }>;
};

type ProjectKnowledgeProfileMetrics = {
  ruleCount: number;
  enabledRuleCount: number;
  capabilitySlugCount: number;
  preferredHelperCount: number;
  stepPatchCount: number;
  urlPatternCount: number;
};

type ProjectKnowledgeProfileComparison = {
  before: ProjectKnowledgeProfileMetrics;
  after: ProjectKnowledgeProfileMetrics;
  addedRuleIds: string[];
  removedRuleIds: string[];
  updatedRuleIds: string[];
};

type ProjectKnowledgeAuditMeta = {
  requestedCandidateIds?: string[];
  requestedModuleUid?: string;
  selectedCandidateFeedbackStatuses?: string[];
  selectedRiskyCandidateIds?: string[];
  overrideCandidateIds?: string[];
  appliedOverrideCandidateIds?: string[];
  appliedOverrideCandidateFeedbackStatuses?: string[];
  acknowledgedRiskCandidateIds?: string[];
  appliedAcknowledgedRiskCandidateIds?: string[];
  appliedAcknowledgedRiskCandidateFeedbackStatuses?: string[];
  mergedCandidateSources?: string[];
  mergedRunIds?: string[];
  mergedCandidateIds?: string[];
  coveredCandidateIds?: string[];
  missingCandidateIds?: string[];
  skippedRuleIds?: string[];
  selectionSummary?: ProjectKnowledgeMergeSelectionSummary;
  preflightSummary?: ProjectKnowledgeMergePreflightSummary;
  mergeReceipts?: ProjectKnowledgeMergeNotice[];
  successfulRunKnowledgePromotionReceipt?: IntentSuccessfulRunKnowledgePromotionReceipt | null;
  restoredFrom?: string;
  projectActivityLogged?: boolean;
  projectActivityError?: string;
};

type ProjectKnowledgeAuditItem = {
  auditId: string;
  occurredAt: string;
  operation: 'merge' | 'restore';
  projectUid: string;
  actorLabel: string;
  title: string;
  detail: string;
  writtenTo: string;
  backupPath?: string | null;
  sourcePath?: string | null;
  comparison: ProjectKnowledgeProfileComparison;
  meta: ProjectKnowledgeAuditMeta;
};

type ProjectKnowledgeMergeResponse = {
  draft: IntentProjectKnowledgeDraft;
  mergedTo: string;
  backupPath?: string | null;
  diffPreview?: string;
  summary?: ProjectKnowledgeMergeSummary;
  comparison?: ProjectKnowledgeProfileComparison;
  addedRuleIds: string[];
  skippedRuleIds: string[];
  mergedCandidateIds: string[];
  coveredCandidateIds: string[];
  missingCandidateIds: string[];
  auditEntry?: ProjectKnowledgeAuditItem;
  selectionSummary?: ProjectKnowledgeMergeSelectionSummary;
  preflightSummary?: ProjectKnowledgeMergePreflightSummary;
  mergeReceipts?: ProjectKnowledgeMergeNotice[];
  successfulRunKnowledgePromotionReceipt?: IntentSuccessfulRunKnowledgePromotionReceipt | null;
  auditWarning?: string;
  overrideWarning?: string;
  riskAcknowledgementWarning?: string;
  guardrailWarning?: string;
  error?: string;
};

type ProjectKnowledgeMergeRouteResponse = Partial<ProjectKnowledgeMergeResponse> & {
  error?: string;
};

type ProjectKnowledgeBackupItem = {
  path: string;
  fileName: string;
  createdAt: string;
  sizeBytes: number;
};

type ProjectKnowledgeBackupsResponse = {
  knowledgePath: string;
  backupDir: string;
  backups: ProjectKnowledgeBackupItem[];
  error?: string;
};

type ProjectKnowledgeAuditsResponse = {
  auditLogPath: string;
  items: ProjectKnowledgeAuditItem[];
  error?: string;
};

type IntentE2EInsightsSummary = {
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
  firstPassPassedRuns: number;
  firstPassPassRate: number;
  repairedPassRuns: number;
  repairedPassRate: number;
  terminalPassRate: number;
  passRate: number;
  modelQualityEligibleRuns: number;
  modelQualityPassRate: number;
  modelQualityFailureRuns: number;
  modelQualityFailureRate: number;
  blockedRuns: number;
  blockedRate: number;
  knowledgeHitRuns: number;
  knowledgeHitRate: number;
  suggestedHelperReuseRuns: number;
  suggestedHelperReuseRate: number;
  authBlockRuns: number;
  authBlockRate: number;
  permissionBlockedRuns: number;
  permissionBlockedRate: number;
  envBlockRuns: number;
  envBlockRate: number;
  dataBlockedRuns: number;
  dataBlockedRate: number;
  assertionFailureRuns: number;
  assertionFailureRate: number;
  assetMissingRuns: number;
  assetMissingRate: number;
  noHitRuns: number;
  noHitRate: number;
};

type IntentE2EScenarioFamily = 'page_task' | 'simple_scenario' | 'complex_enterprise_flow' | 'unknown';
type IntentE2EInsightVerificationIntent = 'verify' | 'review' | 'unknown';

type IntentE2EInsightScenarioFamilyStat = {
  family: IntentE2EScenarioFamily;
  label: string;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
  firstPassPassedRuns: number;
  firstPassPassRate: number;
  repairedPassRuns: number;
  repairedPassRate: number;
  terminalPassRate: number;
};

type IntentE2EInsightScenarioFamilySloStatus = 'meeting' | 'at_risk' | 'off_track' | 'insufficient_data';

type IntentE2EInsightScenarioFamilySloItem = {
  family: IntentE2EScenarioFamily;
  label: string;
  totalRuns: number;
  minRuns: number;
  currentFirstPassRate: number;
  currentTerminalPassRate: number;
  targetFirstPassRate: number;
  targetTerminalPassRate: number;
  firstPassGap: number;
  terminalGap: number;
  status: IntentE2EInsightScenarioFamilySloStatus;
  recommendation: string;
};

type IntentE2EInsightScenarioFamilySloOverview = {
  generatedFromRuns: number;
  trackedFamilyCount: number;
  meetingCount: number;
  atRiskCount: number;
  offTrackCount: number;
  insufficientDataCount: number;
  items: IntentE2EInsightScenarioFamilySloItem[];
};

type IntentE2EInsightRegressionWatchlistSource = 'scenario_family_slo' | 'evaluation_baseline' | 'rollback_candidate';
type IntentE2EInsightRegressionWatchlistSeverity = 'high' | 'medium';

type IntentE2EInsightRegressionWatchlistItem = {
  watchId: string;
  source: IntentE2EInsightRegressionWatchlistSource;
  severity: IntentE2EInsightRegressionWatchlistSeverity;
  title: string;
  summary: string;
  recommendation: string;
  latestObservedAt: string;
  runCount: number;
  currentFirstPassRate: number;
  currentTerminalPassRate: number;
  compareLabel: string;
  compareFirstPassRate: number | null;
  compareTerminalPassRate: number | null;
  targetFirstPassRate: number | null;
  targetTerminalPassRate: number | null;
  sourceRef: string;
  relatedRuleIds: string[];
  failureClasses: string[];
};

type IntentE2EInsightRegressionWatchlistOverview = {
  generatedFromRuns: number;
  totalItems: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  items: IntentE2EInsightRegressionWatchlistItem[];
};

type IntentE2EInsightRolloutStrategyStage = 'hold' | 'small_batch' | 'full_release';

type IntentE2EInsightRolloutStrategyGateSource =
  | 'scenario_family_slo'
  | 'regression_watchlist'
  | 'risk_lifecycle_rule'
  | 'rollback_candidate';

type IntentE2EInsightRolloutStrategyGateStatus = 'blocked' | 'warning' | 'ready';

type IntentE2EInsightRolloutStrategyGate = {
  gateId: string;
  source: IntentE2EInsightRolloutStrategyGateSource;
  status: IntentE2EInsightRolloutStrategyGateStatus;
  title: string;
  summary: string;
  recommendation: string;
  sourceRef: string;
};

type IntentE2EInsightRolloutStrategyOverview = {
  generatedFromRuns: number;
  recommendedStage: IntentE2EInsightRolloutStrategyStage;
  summary: string;
  recommendation: string;
  blockedCount: number;
  warningCount: number;
  readyCount: number;
  gates: IntentE2EInsightRolloutStrategyGate[];
};

type IntentE2EInsightVerificationIntentStat = {
  intent: IntentE2EInsightVerificationIntent;
  label: string;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
  firstPassPassedRuns: number;
  firstPassPassRate: number;
  repairedPassRuns: number;
  repairedPassRate: number;
  terminalPassRate: number;
  latestRepairObservationAt: string;
  latestRepairObservationSummary: string;
  latestRepairObservationVerifierCheckUids: string[];
};

type IntentE2EInsightCapabilityVerificationIntentStat = {
  intent: Exclude<IntentE2EInsightVerificationIntent, 'unknown'>;
  label: string;
  totalExecutions: number;
  passedExecutions: number;
  failedExecutions: number;
  passRate: number;
  latestRepairObservationAt: string;
  latestRepairObservationSummary: string;
  latestRepairObservationVerifierCheckUids: string[];
};

type IntentE2EInsightRuleStat = {
  ruleId: string;
  title: string;
  runCount: number;
  passedRuns: number;
  passRate: number;
};

type IntentE2EInsightHelperStat = {
  helper: string;
  runCount: number;
  passedRuns: number;
  passRate: number;
  suggestedReuseRuns: number;
};

type IntentE2EInsightStarterHelper = {
  helper: string;
  runCount: number;
  passedRuns: number;
  passRate: number;
  suggestedReuseRuns: number;
  source: 'promoted' | 'stable';
  supportingRuleIds: string[];
  supportingRuleTitles: string[];
  knowledgeChangeTier?: 'preferred' | 'watching';
  knowledgeChangeWatchingKind?: 'recovering' | 'mixed';
  knowledgeChangeSignal?: 'positive' | 'negative';
  knowledgeChangeSignalReason?: string;
  knowledgeChangeDecisionableRuleCount?: number;
  knowledgeChangeSupportingAuditIds?: string[];
  preferredPromotionStatus?: 'await_more_positive_rules' | 'blocked_by_mixed_evidence' | 'await_long_term_recovery';
  preferredPromotionReason?: string;
  preferredAutoPromotionCondition?: string;
  preferredPromotionRequiredPositiveRuleCount?: number;
  preferredPromotionPositiveRuleCount?: number;
  preferredPromotionNegativeRuleCount?: number;
  governanceReleaseStatus?: 'released_from_suppressed';
  governanceReleaseReason?: string;
  governanceReleaseCapabilityCount?: number;
  governanceReleaseDirectVerifyPassedCapabilityCount?: number;
  governanceReleaseLatestVerifyExecutionAt?: string;
  recentFailedReviewCapabilityCount?: number;
  recentFailedVerifyCapabilityCount?: number;
  recentFailedReviewExecutionCount?: number;
  recentFailedVerifyExecutionCount?: number;
  recentFailureWindowDays?: number;
  recordedPromotionReceiptCount?: number;
  recordedPromotionCapabilityCount?: number;
  lastPromotionRecordedAt?: string;
  lastPromotionSourceRunId?: string;
  lastPromotionModuleName?: string;
  lastPromotionScenarioTitle?: string;
  recommendation: string;
};

type IntentE2EInsightSuppressedStarterHelper = {
  helper: string;
  runCount: number;
  passedRuns: number;
  passRate: number;
  suggestedReuseRuns: number;
  source: 'promoted' | 'stable';
  supportingRuleIds: string[];
  supportingRuleTitles: string[];
  knowledgeChangeSignal: 'negative';
  knowledgeChangeSignalReason: string;
  knowledgeChangeDecisionableRuleCount?: number;
  knowledgeChangeSupportingAuditIds?: string[];
  recentFailedReviewCapabilityCount?: number;
  recentFailedVerifyCapabilityCount?: number;
  recentFailedReviewExecutionCount?: number;
  recentFailedVerifyExecutionCount?: number;
  recentFailureWindowDays?: number;
  recordedPromotionReceiptCount?: number;
  recordedPromotionCapabilityCount?: number;
  lastPromotionRecordedAt?: string;
  lastPromotionSourceRunId?: string;
  lastPromotionModuleName?: string;
  lastPromotionScenarioTitle?: string;
  governanceTargetCapabilityCount?: number;
  recentGovernanceReviewExecutionCount?: number;
  recentPassedGovernanceReviewExecutionCount?: number;
  recentFailedGovernanceReviewExecutionCount?: number;
  latestGovernanceReviewExecutionAt?: string;
  recentGovernanceVerifyExecutionCount?: number;
  recentPassedGovernanceVerifyExecutionCount?: number;
  recentFailedGovernanceVerifyExecutionCount?: number;
  latestGovernanceVerifyExecutionAt?: string;
  recentGovernanceRepairExecutionCount?: number;
  recentPassedGovernanceRepairExecutionCount?: number;
  recentFailedGovernanceRepairExecutionCount?: number;
  latestGovernanceRepairExecutionAt?: string;
  governanceCapabilities?: IntentE2EInsightSuppressedStarterHelperGovernanceCapability[];
  governanceRecommendationStatus?:
    | 'await_governance_targets'
    | 'blocked_by_recent_failures'
    | 'await_direct_verify'
    | 'await_more_capability_recovery';
  governanceRecommendationReason?: string;
  governanceAutoUnlockCondition?: string;
  governanceRequiredPassedCapabilityCount?: number;
  governancePassedCapabilityCount?: number;
  governanceDirectVerifyPassedCapabilityCount?: number;
  suppressionReason: string;
};

type IntentE2EInsightSuppressedStarterHelperGovernanceSummary = {
  helperCount: number;
  capabilityCount: number;
  recentReviewExecutionCount: number;
  recentPassedReviewExecutionCount: number;
  recentFailedReviewExecutionCount: number;
  latestReviewExecutionAt: string;
  recentVerifyExecutionCount: number;
  recentPassedVerifyExecutionCount: number;
  recentFailedVerifyExecutionCount: number;
  latestVerifyExecutionAt: string;
  recentRepairExecutionCount: number;
  recentPassedRepairExecutionCount: number;
  recentFailedRepairExecutionCount: number;
  latestRepairExecutionAt: string;
};

type IntentE2EInsightSuppressedStarterHelperGovernanceCapability = {
  capabilityUid: string;
  name: string;
  slug: string;
  latestExecutionStatus: 'passed' | 'failed' | '';
  latestExecutionIntent: 'review' | 'verify' | '';
  latestExecutionSource: 'direct' | 'repair' | '';
  latestExecutionAt: string;
  recentReviewExecutionCount: number;
  recentVerifyExecutionCount: number;
  recentRepairExecutionCount: number;
};

type IntentE2EInsightFailureClassStat = {
  failureClass: string;
  count: number;
  latestRepairObservationAt: string;
  latestRepairObservationSummary: string;
  latestRepairObservationVerifierCheckUids: string[];
};

type IntentE2EInsightFailureTraceGovernanceCategory =
  | 'environment'
  | 'data_contract'
  | 'verifier_gap'
  | 'workflow_gap'
  | 'execution_gap'
  | 'unknown_triage';

type IntentE2EInsightFailureTraceGovernanceSeverity = 'high' | 'medium' | 'low';

type IntentE2EInsightFailureTracePromotionTarget =
  | 'environment_runbook'
  | 'fixture_contract'
  | 'verifier_recipe'
  | 'workflow_recipe'
  | 'execution_guard'
  | 'manual_triage';

type IntentE2EInsightFailureTraceGovernanceItem = {
  governanceId: string;
  failureClass: string;
  category: IntentE2EInsightFailureTraceGovernanceCategory;
  severity: IntentE2EInsightFailureTraceGovernanceSeverity;
  promotionTarget: IntentE2EInsightFailureTracePromotionTarget;
  count: number;
  latestObservedAt: string;
  representativeRunIds: string[];
  affectedScenarioFamilies: IntentE2EScenarioFamily[];
  affectedPriorityScenarioFamilies: IntentE2EPriorityScenarioFamily[];
  summary: string;
  recommendation: string;
  antiPatterns: string[];
  latestRepairObservationAt: string;
  latestRepairObservationSummary: string;
  latestRepairObservationVerifierCheckUids: string[];
};

type IntentE2EInsightFailureTraceGovernanceOverview = {
  generatedFromRuns: number;
  totalItems: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
  needsTriageCount: number;
  promotionCandidateCount: number;
  items: IntentE2EInsightFailureTraceGovernanceItem[];
};

type IntentE2EInsightTraceAttemptOutcome = 'passed' | 'failed' | 'unknown';

type IntentE2EInsightRecentTraceAttempt = {
  attempt: number;
  kind: 'generate' | 'repair' | 'unknown';
  outcome: IntentE2EInsightTraceAttemptOutcome;
  failureClass: string;
  usedHelpers: string[];
  usedSuggestedHelpers: string[];
  keySignals: string[];
  structuredPatchStrategy: string;
  targetSlotUids: string[];
  returnedSlotUids: string[];
  reusedPreviousCode: boolean;
  baseCodeSource: 'compiled_template' | 'previous_code' | 'unknown';
  patchedRecipeSlugs: string[];
  patchedVerifierCheckUids: string[];
  repairObservationSummary: string;
};

type IntentE2EInsightRecentTraceResponseEvent = {
  attempt: number;
  kind: 'matched' | 'json_parsed';
  url: string;
  method: string;
  status: number | null;
  topLevelKeys: string[];
};

type IntentE2EInsightRecentTraceFinalGraderResult = {
  status: 'passed' | 'failed' | 'canceled';
  summary: string;
  failureClass: string;
  repairable: boolean | null;
};

type IntentE2EInsightRecentTraceVerifierCheckResult = {
  checkUid: string;
  title: string;
  kind: string;
  required: boolean;
  preferredHelpers: string[];
  relatedPlanStepUids: string[];
};

type IntentE2EInsightRecentTraceVerifierResult = {
  expectedOutcome: string;
  failingCheckCount: number;
  failingChecks: IntentE2EInsightRecentTraceVerifierCheckResult[];
};

type IntentE2EInsightRecentTrace = {
  traceVersion: 1;
  runId: string;
  testType: IntentPlatformTestType;
  runnerType: IntentPlatformRunnerType;
  verificationPolicyNotes: string[];
  projectUid: string;
  status: 'passed' | 'failed' | 'canceled';
  finishedAt: string;
  requestInput: string;
  targetUrl: string;
  targetPath: string;
  scenarioTitle: string;
  scenarioFamily: IntentE2EScenarioFamily;
  scenarioFamilyLabel: string;
  verificationIntent: IntentE2EInsightVerificationIntent;
  verificationIntentLabel: string;
  taskMode: 'page' | 'scenario' | 'unknown';
  stepCount: number;
  stepTypes: string[];
  snapshotSignature: string;
  compiledSlotCount: number;
  compiledSlotUids: string[];
  attemptCount: number;
  repairAttempted: boolean;
  structuredPatchAttempted: boolean;
  targetedRepairAttempted: boolean;
  knowledgeHit: boolean;
  assetReadiness: IntentAssetReadiness;
  qualitySplit: IntentQualitySplit;
  matchedRecipeSlugs: string[];
  matchedRuleIds: string[];
  matchedRuleTitles: string[];
  matchedStarterHelpers: string[];
  suggestedHelpers: string[];
  usedHelpers: string[];
  usedSuggestedHelpers: string[];
  firstPassSucceeded: boolean;
  repairedSucceeded: boolean;
  keySignals: string[];
  responseEvents: IntentE2EInsightRecentTraceResponseEvent[];
  verifierResult: IntentE2EInsightRecentTraceVerifierResult;
  finalGraderResult: IntentE2EInsightRecentTraceFinalGraderResult;
  patchedSlotUids: string[];
  latestRepairObservationSummary: string;
  latestRepairObservationRecipeSlugs: string[];
  latestRepairObservationVerifierCheckUids: string[];
  failureClass: string;
  attempts: IntentE2EInsightRecentTraceAttempt[];
};

type IntentE2EInsightRecentCapabilityVerification = {
  executionUid: string;
  configUid: string;
  configName: string;
  capabilityUid: string;
  chainCapabilityUids: string[];
  status: 'passed' | 'failed';
  intent: Exclude<IntentE2EInsightVerificationIntent, 'unknown'>;
  intentLabel: string;
  targetName: string;
  strategyLabel: string;
  summary: string;
  errorMessage: string;
  createdAt: string;
};

type IntentE2EEvaluationCandidatePriority = 'p0' | 'p1' | 'p2';

type IntentE2EEvaluationBaselineCandidate = {
  evalCaseId: string;
  snapshotSignature: string;
  scenarioFamily: IntentE2EScenarioFamily;
  scenarioFamilyLabel: string;
  taskMode: 'page' | 'scenario' | 'unknown';
  targetPath: string;
  stepTypes: string[];
  stepCount: number;
  runCount: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
  repairAttemptedRuns: number;
  knowledgeHitRuns: number;
  knowledgeHitRate: number;
  latestFinishedAt: string;
  representativeScenarioTitle: string;
  representativeRequestInput: string;
  representativeRunIds: string[];
  matchedRecipeSlugs: string[];
  matchedRuleIds: string[];
  matchedRuleTitles: string[];
  usedHelpers: string[];
  keySignals: string[];
  failureClasses: IntentE2EInsightFailureClassStat[];
  priority: IntentE2EEvaluationCandidatePriority;
  selectionReason: string;
  firstPassPassedRuns: number;
  firstPassPassRate: number;
  repairedPassRuns: number;
  repairedPassRate: number;
  terminalPassRate: number;
};

type IntentE2EEvaluationBaseline = {
  generatedFromRuns: number;
  candidateClusters: number;
  recommendedCount: number;
  recommendedFamilies: IntentE2EScenarioFamily[];
  selectionNote: string;
  candidates: IntentE2EEvaluationBaselineCandidate[];
};

type IntentE2EInsightMergeProvenanceStat = {
  key: string;
  operations: Array<'merge' | 'restore'>;
  stage: 'preflight' | 'receipt';
  kind: ProjectKnowledgeMergeNotice['kind'];
  level: ProjectKnowledgeMergeNotice['level'];
  provenanceType: ProjectKnowledgeMergeNotice['provenanceType'];
  title: string;
  auditCount: number;
  itemCount: number;
  candidateCount: number;
  ruleCount: number;
  latestOccurredAt: string;
  supportingAuditIds: string[];
};

type IntentE2EInsightRollbackCandidate = {
  auditId: string;
  occurredAt: string;
  projectUid: string;
  requestedModuleUid?: string;
  title: string;
  backupPath: string | null;
  addedRuleIds: string[];
  mergedCandidateSources: string[];
  mergedRunIds: string[];
  selectedCandidateFeedbackStatuses: string[];
  selectedRiskyCandidateIds: string[];
  appliedOverrideCandidateIds: string[];
  appliedOverrideCandidateFeedbackStatuses: string[];
  appliedAcknowledgedRiskCandidateIds: string[];
  appliedAcknowledgedRiskCandidateFeedbackStatuses: string[];
  beforeRuns: number;
  beforePassRate: number;
  beforeFirstPassRate: number;
  afterRuns: number;
  afterPassRate: number;
  afterFirstPassRate: number;
  passRateDelta: number;
  firstPassRateDelta: number;
  impactStatus: 'improving' | 'neutral' | 'regressing';
  recommendation: string;
};

type IntentE2EInsightKnowledgeChangeGrader = {
  auditId: string;
  operation: 'merge' | 'restore';
  occurredAt: string;
  projectUid: string;
  requestedModuleUid?: string;
  title: string;
  backupPath: string | null;
  restoredFrom?: string;
  affectedRuleIds: string[];
  mergedCandidateSources: string[];
  mergedRunIds: string[];
  selectedCandidateFeedbackStatuses: string[];
  selectedRiskyCandidateIds: string[];
  appliedOverrideCandidateIds: string[];
  appliedAcknowledgedRiskCandidateIds: string[];
  beforeRuns: number;
  beforePassRate: number;
  beforeFirstPassRate: number;
  afterRuns: number;
  afterPassedRuns: number;
  afterFailedRuns: number;
  afterCanceledRuns: number;
  afterPassRate: number;
  afterFirstPassPassedRuns: number;
  afterFirstPassRate: number;
  passRateDelta: number;
  firstPassRateDelta: number;
  impactStatus: 'improving' | 'neutral' | 'regressing';
  efficacyStatus: 'improving' | 'neutral' | 'regressing' | 'recovered' | 'watching' | 'still_abnormal';
  evidenceLevel: 'early' | 'decisionable';
  preflightNoticeCount: number;
  receiptNoticeCount: number;
  recommendation: string;
};

type IntentE2EInsightKnowledgeChangeRuleSummary = {
  ruleId: string;
  title: string;
  auditCount: number;
  mergeCount: number;
  restoreCount: number;
  improvingCount: number;
  neutralCount: number;
  regressingCount: number;
  recoveredCount: number;
  stillAbnormalCount: number;
  watchingCount: number;
  decisionableCount: number;
  earlyCount: number;
  latestOccurredAt: string;
  latestOperation: 'merge' | 'restore';
  latestEfficacyStatus: IntentE2EInsightKnowledgeChangeGrader['efficacyStatus'];
  latestImpactStatus: IntentE2EInsightKnowledgeChangeGrader['impactStatus'];
  netPassRateDelta: number;
  netFirstPassRateDelta: number;
  successfulRunPromotionReceiptCount: number;
  successfulRunPromotionRunCount: number;
  lastSuccessfulRunPromotionRecordedAt: string;
  lastSuccessfulRunPromotionRequestedModuleUid: string;
  lastSuccessfulRunPromotionRunIds: string[];
  supportingAuditIds: string[];
  recommendation: string;
};

type IntentE2EInsightMergeProvenanceKindCounts = {
  autoPromoteCount: number;
  observeCount: number;
  blockDefaultMergeCount: number;
  overrideCount: number;
  riskAcknowledgementCount: number;
  guardrailCount: number;
  auditCount: number;
};

type IntentE2EInsightRiskLifecycleRuleMergeProvenance = {
  preflightNoticeCount: number;
  receiptNoticeCount: number;
  preflight: IntentE2EInsightMergeProvenanceKindCounts;
  receipt: IntentE2EInsightMergeProvenanceKindCounts;
};

type IntentE2EInsightRiskLifecycleRuleRecentMergeProvenance = {
  auditWindowSize: number;
  dayWindowSize: number;
  consideredAuditCount: number;
  windowMode: 'time_window' | 'audit_count_fallback';
  windowLabel: string;
  mergeProvenance: IntentE2EInsightRiskLifecycleRuleMergeProvenance;
};

type IntentE2EInsightRiskLifecycleRule = {
  ruleId: string;
  title: string;
  mergedCandidateSources: string[];
  selectedCandidateFeedbackStatuses: string[];
  mergeAuditCount: number;
  riskySelectionCount: number;
  overrideAppliedCount: number;
  riskAcknowledgementCount: number;
  mergeProvenance: IntentE2EInsightRiskLifecycleRuleMergeProvenance;
  recentMergeProvenance: IntentE2EInsightRiskLifecycleRuleRecentMergeProvenance;
  promotedCount: number;
  watchingCount: number;
  degradedCount: number;
  rollbackCandidateCount: number;
  latestOccurredAt: string;
  latestStatus: 'rollback_candidate' | 'degraded' | 'watching' | 'promoted';
  latestImpactStatus?: 'improving' | 'neutral' | 'regressing';
  latestBackupPath: string | null;
  latestRecommendation: string;
  policy: 'block_default_merge' | 'observe_guarded' | 'auto_promote_candidate' | 'observe';
  policyReason: string;
  supportingAuditIds: string[];
};

type IntentE2EInsightProbationRule = {
  auditId: string;
  occurredAt: string;
  projectUid: string;
  requestedModuleUid?: string;
  title: string;
  backupPath: string | null;
  addedRuleIds: string[];
  mergedCandidateSources: string[];
  mergedRunIds: string[];
  selectedCandidateFeedbackStatuses: string[];
  selectedRiskyCandidateIds: string[];
  appliedOverrideCandidateIds: string[];
  appliedOverrideCandidateFeedbackStatuses: string[];
  appliedAcknowledgedRiskCandidateIds: string[];
  appliedAcknowledgedRiskCandidateFeedbackStatuses: string[];
  beforeRuns: number;
  beforePassRate: number;
  beforeFirstPassRate: number;
  observedRuns: number;
  observedPassedRuns: number;
  observedFailedRuns: number;
  observedCanceledRuns: number;
  observedPassRate: number;
  observedFirstPassPassedRuns: number;
  observedFirstPassRate: number;
  firstPassRateDelta: number;
  impactStatus: 'improving' | 'neutral' | 'regressing';
  remainingRuns: number;
  status: 'watching' | 'promoted' | 'degraded';
  recommendation: string;
};

type IntentProjectRuntimeGovernanceIssue = {
  code: string;
  message: string;
};

type IntentProjectRuntimeGovernanceStatus = {
  projectUid: string;
  path: string;
  exists: boolean;
  valid: boolean;
  ready: boolean;
  hasEnvironmentProfile: boolean;
  hasCredentialDefaults: boolean;
  hasFixtureDefaults: boolean;
  issues: IntentProjectRuntimeGovernanceIssue[];
};

type IntentE2EInsightsResponse = {
  scope: {
    projectUid: string;
    runLimit: number;
    auditLimit: number;
  };
  summary: IntentE2EInsightsSummary;
  topRules: IntentE2EInsightRuleStat[];
  topHelpers: IntentE2EInsightHelperStat[];
  starterHelpers: IntentE2EInsightStarterHelper[];
  suppressedStarterHelpers: IntentE2EInsightSuppressedStarterHelper[];
  scenarioFamilies: IntentE2EInsightScenarioFamilyStat[];
  scenarioFamilySlo: IntentE2EInsightScenarioFamilySloOverview;
  regressionWatchlist: IntentE2EInsightRegressionWatchlistOverview;
  rolloutStrategy: IntentE2EInsightRolloutStrategyOverview;
  verificationIntents: IntentE2EInsightVerificationIntentStat[];
  capabilityVerificationIntents: IntentE2EInsightCapabilityVerificationIntentStat[];
  failureClasses: IntentE2EInsightFailureClassStat[];
  failureTraceGovernance: IntentE2EInsightFailureTraceGovernanceOverview;
  mergeProvenanceStats: IntentE2EInsightMergeProvenanceStat[];
  riskLifecycleRules: IntentE2EInsightRiskLifecycleRule[];
  probationRules: IntentE2EInsightProbationRule[];
  rollbackCandidates: IntentE2EInsightRollbackCandidate[];
  knowledgeChangeGraders: IntentE2EInsightKnowledgeChangeGrader[];
  knowledgeChangeRuleSummaries: IntentE2EInsightKnowledgeChangeRuleSummary[];
  recentTraces: IntentE2EInsightRecentTrace[];
  recentCapabilityVerifications: IntentE2EInsightRecentCapabilityVerification[];
  evaluationBaseline: IntentE2EEvaluationBaseline;
  failurePressureSummary?: {
    recentFailedReviewCapabilityCount: number;
    recentFailedVerifyCapabilityCount: number;
    recentFailedReviewExecutionCount: number;
    recentFailedVerifyExecutionCount: number;
    recentFailureWindowDays: number;
    highFailureCandidateCount: number;
    highFailureRepairCount: number;
    highFailureGovernanceCount: number;
    latestRepairObservationAt: string;
    latestRepairObservationSummary: string;
    latestRepairObservationVerifierCheckUids: string[];
  };
  starterHelperFailurePressureSummary?: {
    recentFailedReviewCapabilityCount: number;
    recentFailedVerifyCapabilityCount: number;
    recentFailedReviewExecutionCount: number;
    recentFailedVerifyExecutionCount: number;
    recentFailureWindowDays: number;
    highFailureCandidateCount: number;
    highFailureRepairCount: number;
    highFailureGovernanceCount: number;
    latestRepairObservationAt: string;
    latestRepairObservationSummary: string;
    latestRepairObservationVerifierCheckUids: string[];
  };
  suppressedStarterHelperFailurePressureSummary?: {
    recentFailedReviewCapabilityCount: number;
    recentFailedVerifyCapabilityCount: number;
    recentFailedReviewExecutionCount: number;
    recentFailedVerifyExecutionCount: number;
    recentFailureWindowDays: number;
    highFailureCandidateCount: number;
    highFailureRepairCount: number;
    highFailureGovernanceCount: number;
    latestRepairObservationAt: string;
    latestRepairObservationSummary: string;
    latestRepairObservationVerifierCheckUids: string[];
  };
  suppressedStarterHelperGovernanceSummary?: IntentE2EInsightSuppressedStarterHelperGovernanceSummary;
  runtimeGovernanceStatus?: IntentProjectRuntimeGovernanceStatus;
  error?: string;
};

type IntentE2EReleaseReadinessStatus = 'ready' | 'attention' | 'blocked';

type IntentE2EReleaseCheckStatus = 'passed' | 'warning' | 'failed' | 'skipped';

type IntentE2EReleaseStatusCheck = {
  id: string;
  title: string;
  status: IntentE2EReleaseCheckStatus;
  blocking: boolean;
  message: string;
  evidencePath?: string;
};

type IntentE2EReleaseStatusFamily = {
  priorityScenarioFamily: string;
  releaseGuard: {
    status: IntentE2EReleaseCheckStatus;
    baselineId: string;
    currentRunCount: number;
    currentTerminalPassRate: number;
    currentFirstPassPassRate: number;
    failures: string[];
  } | null;
  knowledgeHit: {
    status: IntentE2EReleaseCheckStatus;
    evidenceId: string;
    expectedRuleIds: string[];
    matchedRuleIds: string[];
    knowledgeHitRate: number;
    failures: string[];
  } | null;
};

type IntentE2EReleaseStatusResponse = {
  generatedAt: string;
  projectUid: string;
  status: IntentE2EReleaseReadinessStatus;
  canRelease: boolean;
  summary: {
    checkCount: number;
    passedChecks: number;
    warningChecks: number;
    failedChecks: number;
    skippedChecks: number;
    familyCount: number;
    readyFamilies: number;
    attentionFamilies: number;
    blockedFamilies: number;
  };
  currentCompare: {
    status: 'passed' | 'failed' | 'missing' | 'skipped';
    reportPath: string;
    generatedAt: string;
    passed: boolean;
    message: string;
  };
  checks: IntentE2EReleaseStatusCheck[];
  families: IntentE2EReleaseStatusFamily[];
  error?: string;
};

type InsightWorkbenchView = 'overview' | 'quality' | 'trace' | 'governance' | 'knowledge';

type InsightWorkbenchTab = {
  key: InsightWorkbenchView;
  label: string;
  description: string;
  countLabel: string;
};

type WorkbenchRailView = 'overview' | 'live' | 'context' | 'workbench' | 'governance' | 'compile' | 'workspace';

type WorkbenchDetailView = 'scenario' | 'compile' | 'attempts';

type ProjectKnowledgeRestoreResponse = {
  restoredFrom: string;
  writtenTo: string;
  backupCreated?: string | null;
  comparison?: ProjectKnowledgeProfileComparison;
  preflightSummary?: ProjectKnowledgeMergePreflightSummary;
  mergeReceipts?: ProjectKnowledgeMergeNotice[];
  profile: {
    version: 1;
    rules: IntentProjectKnowledgeRule[];
  };
  auditEntry?: ProjectKnowledgeAuditItem;
  auditWarning?: string;
  error?: string;
};

type WorkspaceSaveMode = 'new' | 'existing';

type WorkspaceProjectOption = {
  projectUid: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
};

type WorkspaceModuleOption = {
  moduleUid: string;
  projectUid: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
};

type WorkspaceTaskOption = {
  configUid: string;
  projectUid: string;
  moduleUid: string;
  moduleName: string;
  name: string;
  targetUrl: string;
  taskMode: 'page' | 'scenario';
  status: 'active' | 'archived';
  latestPlanVersion: number;
};

type WorkspacePersistItem = {
  projectUid: string;
  moduleUid: string;
  configUid: string;
  configName: string;
  planUid: string;
  planVersion: number;
  executionUid: string;
  createdConfig: boolean;
  updatedConfig: boolean;
  importedStatus: 'passed' | 'failed';
  workspacePath: string;
  workspaceQueryPath?: string;
  workspaceHistoryPath?: string;
  runPath: string;
  executionContext?: {
    runPath: string;
    workspacePath: string;
    workspaceHistoryPath: string;
  } | null;
};

type StarterAssetPromotionReceiptSummary = {
  requestedCount: number;
  savedCount: number;
  helperCount: number;
  autoSelectedCount: number;
  manualReviewCount: number;
  directPromotionCount: number;
};

type StarterAssetPromotionReceiptResponse = {
  receiptId: string;
  title: string;
  detail: string;
  summary: StarterAssetPromotionReceiptSummary;
};

type StarterCapabilityPersistResponse = {
  items?: Array<{ capabilityUid?: string; name?: string }>;
  starterAssetPromotionReceipt?: StarterAssetPromotionReceiptResponse | null;
  starterAssetPromotionReceiptWarning?: string;
  error?: string;
};

type WorkspaceProjectsResponse = {
  items: WorkspaceProjectOption[];
  total: number;
  error?: string;
};

type WorkspaceModulesResponse = {
  items: WorkspaceModuleOption[];
  error?: string;
};

type WorkspaceTasksResponse = {
  items: WorkspaceTaskOption[];
  total: number;
  error?: string;
};

type PersistIntentRunToWorkspaceResponse = {
  item: WorkspacePersistItem;
  error?: string;
};

type ProjectAuthSummary = {
  projectUid: string;
  projectName: string;
  authRequired: boolean;
  loginUrl: string;
  loginUsername: string;
  loginDescription: string;
};

type ProjectAuthSummaryResponse = {
  item?: {
    projectUid?: string;
    name?: string;
    authRequired?: boolean;
    loginUrl?: string;
    loginUsername?: string;
    loginDescription?: string;
  };
  error?: string;
};

type IntentE2EWorkbenchProps = {
  embedded?: boolean;
  initialWorkspaceProjectUid?: string;
  initialWorkspaceModuleUid?: string;
  embeddedProjectAuth?: {
    authRequired: boolean;
    loginDescription?: string;
  };
  onClose?: () => void;
};

type AttachmentDraft = {
  id: string;
  name: string;
  dataUrl: string;
  purpose: string;
};

type AuthDraft = {
  loginUrl: string;
  username: string;
  password: string;
  loginDescription: string;
};

type IntentLaunchLlmOverride = Partial<
  Pick<LLMConfigDraft, 'provider' | 'model' | 'baseUrl' | 'apiStyle' | 'visionEnabled' | 'selfHealRetries' | 'maxPlanSteps'>
>;

type FeedItem = {
  id: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  text: string;
};

type StreamState = {
  stage: IntentStreamStage;
  message: string;
  scenarioCard: ScenarioCard | null;
  llmMeta: IntentRunResult['llmMeta'] | null;
  targetUrl: string;
  resolvedUrls: IntentResolvedUrls | null;
  description: string;
  attempts: IntentAttempt[];
  finalResult: TestResult | null;
  finalFailureTriage: IntentFailureTriage | null;
  feed: FeedItem[];
};

const STAGE_COPY: Record<IntentStreamStage, string> = {
  idle: '等待你开始新的自动测试。',
  queued: '当前任务正在队列中等待并发配额。',
  received: '请求已收到，正在启动 AI E2E 流程…',
  planning: '正在把自然语言整理成场景卡…',
  prechecking: '正在执行目标页面前置检查（页面可达性 / 登录态）…',
  analyzing: '前置检查通过，正在整理页面结构并收集执行上下文…',
  generating: '正在生成更稳定的 Playwright 测试脚本…',
  executing: '正在执行端到端测试…',
  repairing: '执行失败后，AI 正在尝试自动修复脚本…',
  completed: '自动测试流程已完成。',
  canceled: '当前自动测试已停止。',
  error: '自动测试流程发生异常。',
};

const defaultAuth: AuthDraft = {
  loginUrl: '',
  username: '',
  password: '',
  loginDescription: '',
};

const RUN_ID_STORAGE_KEY = 'intent-e2e:last-run-id';

function normalizeIntentLaunchLlmOverride(value: unknown): IntentLaunchLlmOverride | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const next: IntentLaunchLlmOverride = {};

  if (typeof record.provider === 'string' && record.provider.trim()) next.provider = record.provider.trim();
  if (typeof record.model === 'string' && record.model.trim()) next.model = record.model.trim();
  if (typeof record.baseUrl === 'string') next.baseUrl = record.baseUrl.trim();
  if (typeof record.apiStyle === 'string' && record.apiStyle.trim()) next.apiStyle = record.apiStyle.trim();
  if (typeof record.visionEnabled === 'boolean') next.visionEnabled = record.visionEnabled;
  if (typeof record.selfHealRetries === 'number' && Number.isFinite(record.selfHealRetries)) {
    next.selfHealRetries = Math.max(0, Math.floor(record.selfHealRetries));
  }
  if (typeof record.maxPlanSteps === 'number' && Number.isFinite(record.maxPlanSteps)) {
    next.maxPlanSteps = Math.max(1, Math.floor(record.maxPlanSteps));
  }

  return Object.keys(next).length > 0 ? next : null;
}

function buildIntentLaunchLlmOverrideFromRun(run: IntentRunRecord): IntentLaunchLlmOverride | null {
  return normalizeIntentLaunchLlmOverride(run.request.llm);
}

function mergeIntentLaunchLlmOverride(base: LLMConfigDraft, override?: IntentLaunchLlmOverride | null): LLMConfigDraft {
  if (!override) {
    return base;
  }

  const next: LLMConfigDraft = { ...base };
  if (typeof override.provider === 'string' && override.provider.trim()) {
    next.provider = override.provider.trim();
    next.providerImplemented = isLlmProviderImplemented(next.provider);
  }
  if (typeof override.model === 'string') next.model = override.model;
  if (typeof override.baseUrl === 'string') next.baseUrl = override.baseUrl;
  if (typeof override.apiStyle === 'string' && override.apiStyle.trim()) next.apiStyle = override.apiStyle.trim();
  if (typeof override.visionEnabled === 'boolean') next.visionEnabled = override.visionEnabled;
  if (typeof override.selfHealRetries === 'number' && Number.isFinite(override.selfHealRetries)) {
    next.selfHealRetries = Math.max(0, Math.floor(override.selfHealRetries));
  }
  if (typeof override.maxPlanSteps === 'number' && Number.isFinite(override.maxPlanSteps)) {
    next.maxPlanSteps = Math.max(1, Math.floor(override.maxPlanSteps));
  }

  return next;
}

function statusPillTone(success: boolean): string {
  return success
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-rose-200 bg-rose-50 text-rose-700';
}

function scenarioFamilySloTone(status: IntentE2EInsightScenarioFamilySloStatus): string {
  switch (status) {
    case 'meeting':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'at_risk':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'insufficient_data':
      return 'border-slate-200 bg-slate-100 text-slate-600';
    default:
      return 'border-rose-200 bg-rose-50 text-rose-700';
  }
}

function scenarioFamilySloLabel(status: IntentE2EInsightScenarioFamilySloStatus): string {
  switch (status) {
    case 'meeting':
      return '达标';
    case 'at_risk':
      return '临界';
    case 'insufficient_data':
      return '样本不足';
    default:
      return '未达标';
  }
}

function regressionWatchlistSeverityTone(severity: IntentE2EInsightRegressionWatchlistSeverity): string {
  return severity === 'high'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-amber-200 bg-amber-50 text-amber-700';
}

function regressionWatchlistSeverityLabel(severity: IntentE2EInsightRegressionWatchlistSeverity): string {
  return severity === 'high' ? '高风险' : '观察';
}

function regressionWatchlistSourceLabel(source: IntentE2EInsightRegressionWatchlistSource): string {
  switch (source) {
    case 'rollback_candidate':
      return '回滚信号';
    case 'evaluation_baseline':
      return '固定回归';
    default:
      return 'SLO';
  }
}

function failureTraceGovernanceSeverityTone(severity: IntentE2EInsightFailureTraceGovernanceSeverity): string {
  switch (severity) {
    case 'high':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'medium':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function failureTraceGovernanceSeverityLabel(severity: IntentE2EInsightFailureTraceGovernanceSeverity): string {
  switch (severity) {
    case 'high':
      return '高风险';
    case 'medium':
      return '观察';
    default:
      return '低风险';
  }
}

function failureTraceGovernanceCategoryLabel(category: IntentE2EInsightFailureTraceGovernanceCategory): string {
  switch (category) {
    case 'environment':
      return '环境治理';
    case 'data_contract':
      return '数据契约';
    case 'verifier_gap':
      return '验收缺口';
    case 'workflow_gap':
      return '流程缺口';
    case 'execution_gap':
      return '执行护栏';
    default:
      return '待 triage';
  }
}

function failureTracePromotionTargetLabel(target: IntentE2EInsightFailureTracePromotionTarget): string {
  switch (target) {
    case 'environment_runbook':
      return 'Runbook';
    case 'fixture_contract':
      return 'Fixture';
    case 'verifier_recipe':
      return 'Verifier recipe';
    case 'workflow_recipe':
      return 'Workflow recipe';
    case 'execution_guard':
      return 'Execution guard';
    default:
      return 'Manual triage';
  }
}

function rolloutStrategyStageTone(stage: IntentE2EInsightRolloutStrategyStage): string {
  switch (stage) {
    case 'full_release':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'small_batch':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-rose-200 bg-rose-50 text-rose-700';
  }
}

function rolloutStrategyStageLabel(stage: IntentE2EInsightRolloutStrategyStage): string {
  switch (stage) {
    case 'full_release':
      return '可默认放量';
    case 'small_batch':
      return '小流量灰度';
    default:
      return '暂停放量';
  }
}

function rolloutStrategyGateTone(status: IntentE2EInsightRolloutStrategyGateStatus): string {
  switch (status) {
    case 'ready':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-rose-200 bg-rose-50 text-rose-700';
  }
}

function rolloutStrategyGateLabel(status: IntentE2EInsightRolloutStrategyGateStatus): string {
  switch (status) {
    case 'ready':
      return '通过';
    case 'warning':
      return '观察';
    default:
      return '阻断';
  }
}

function releaseReadinessTone(status: IntentE2EReleaseReadinessStatus): string {
  switch (status) {
    case 'ready':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'attention':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-rose-200 bg-rose-50 text-rose-700';
  }
}

function releaseReadinessPanelTone(status: IntentE2EReleaseReadinessStatus): string {
  switch (status) {
    case 'ready':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'attention':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    default:
      return 'border-rose-200 bg-rose-50 text-rose-800';
  }
}

function releaseCheckStatusTone(status: IntentE2EReleaseCheckStatus): string {
  switch (status) {
    case 'passed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'skipped':
      return 'border-slate-200 bg-slate-50 text-slate-600';
    default:
      return 'border-rose-200 bg-rose-50 text-rose-700';
  }
}

function releaseStatusErrorTitle(message: string): string {
  if (/权限|permission|forbidden|unauthor/i.test(message)) {
    return '无权查看发布状态';
  }
  if (/no such file|ENOENT|not found|missing|找不到|不存在|未找到/i.test(message)) {
    return '发布证据尚未配置';
  }
  return '发布状态暂不可用';
}

function releaseStatusErrorDescription(message: string): string {
  if (/权限|permission|forbidden|unauthor/i.test(message)) {
    return '当前账号没有该项目的 viewer 权限，面板不会尝试绕过 API 读取本地证据。';
  }
  if (/no such file|ENOENT|not found|missing|找不到|不存在|未找到/i.test(message)) {
    return '当前项目缺少 release guard 或 knowledge-hit tracked artifacts，面板先保持空状态。';
  }
  return '服务端没有返回可消费的 release status，先保留原始错误用于排查。';
}

function rolloutStrategyGateSourceLabel(source: IntentE2EInsightRolloutStrategyGateSource): string {
  switch (source) {
    case 'scenario_family_slo':
      return 'SLO';
    case 'regression_watchlist':
      return 'Watchlist';
    case 'risk_lifecycle_rule':
      return '规则治理';
    default:
      return '回滚';
  }
}

function feedToneClass(tone: FeedItem['tone']): string {
  switch (tone) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'error':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function feedToneDotClass(tone: FeedItem['tone']): string {
  switch (tone) {
    case 'success':
      return 'bg-emerald-500';
    case 'warning':
      return 'bg-amber-500';
    case 'error':
      return 'bg-rose-500';
    default:
      return 'bg-stone-300';
  }
}

function feedToneAccentClass(tone: FeedItem['tone']): string {
  switch (tone) {
    case 'success':
      return 'text-emerald-600';
    case 'warning':
      return 'text-amber-600';
    case 'error':
      return 'text-rose-600';
    default:
      return 'text-stone-400';
  }
}

/** Parse structured feed text: `#N STATUS Step M: title` → structured parts */
function parseFeedText(text: string): {
  attempt: string | null;
  status: string | null;
  stepNum: string | null;
  body: string;
} {
  const m = text.match(/^#(\d+)\s+(PASSED|FAILED|RUNNING)\s+(.+)$/);
  if (m) {
    const stepMatch = m[3].match(/^Step\s+(\d+)\s*[:：]\s*(.+)$/i);
    if (stepMatch) return { attempt: m[1], status: m[2], stepNum: stepMatch[1], body: stepMatch[2] };
    return { attempt: m[1], status: m[2], stepNum: null, body: m[3] };
  }
  const m2 = text.match(/^#(\d+)\s+(.+)$/);
  if (m2) return { attempt: m2[1], status: null, stepNum: null, body: m2[2] };
  return { attempt: null, status: null, stepNum: null, body: text };
}

/** Typewriter text — reveals characters progressively, only used for latest feed bubble */
function TypewriterText({ text, speed = 22 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('');
  const textRef = useRef(text);

  useEffect(() => {
    // If text changed, reset and start typing the new text
    textRef.current = text;
    setDisplayed('');
    let i = 0;
    const timer = setInterval(() => {
      i++;
      if (i > textRef.current.length) {
        clearInterval(timer);
        return;
      }
      setDisplayed(textRef.current.slice(0, i));
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  const done = displayed.length >= text.length;

  return (
    <>
      {displayed}
      {!done && <span className="intent-typewriter-cursor" />}
    </>
  );
}

function attemptTone(kind: IntentAttempt['kind']): string {
  return kind === 'repair' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-sky-700 bg-sky-50 border-sky-200';
}

function attemptResultTone(attempt: IntentAttempt): string {
  if ((attempt.status || 'completed') === 'running') {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }
  return statusPillTone(Boolean(attempt.result?.success));
}

function attemptResultLabel(attempt: IntentAttempt): string {
  if ((attempt.status || 'completed') === 'running') return '执行中';
  return attempt.result?.success ? '通过' : '失败';
}

function intentFailureClassLabel(failureClass: IntentFailureTriage['failureClass']): string {
  switch (failureClass) {
    case 'env_transient':
      return '环境阻塞';
    case 'auth_failed':
      return '认证阻塞';
    case 'permission_blocked':
      return '权限阻塞';
    case 'data_missing':
      return '数据阻塞';
    case 'target_row_not_found':
      return '目标行未命中';
    case 'ui_anchor_missing':
      return '页面锚点缺失';
    case 'selector_drift':
      return '定位器漂移';
    case 'assertion_too_strict':
      return '断言过严';
    case 'workflow_gap':
      return '流程缺口';
    case 'repair_stagnated':
      return '修复停滞';
    case 'unknown':
      return '未分类';
    default:
      return '未分类';
  }
}

function intentFailureTone(triage: IntentFailureTriage): string {
  return triage.repairable ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-rose-200 bg-rose-50 text-rose-800';
}

function intentRepairBudgetReasonLabel(reasonCode: IntentRepairBudgetReasonCode): string {
  switch (reasonCode) {
    case 'asset_missing':
      return '项目资产未就绪';
    case 'knowledge_no_hit':
      return '项目知识未命中';
    case 'auth_blocked':
      return '认证阻塞';
    case 'permission_blocked':
      return '权限阻塞';
    case 'env_blocked':
      return '环境阻塞';
    case 'data_blocked':
      return '数据阻塞';
    case 'target_row_not_found':
      return '目标行未命中';
    case 'workflow_gap':
      return '流程缺口';
    case 'ui_anchor_missing':
      return '页面锚点缺失';
    case 'repair_stagnated':
      return '修复停滞';
    case 'unknown':
      return '保守收紧';
    case 'runtime_limit':
    default:
      return '运行配置';
  }
}

function normalizeIntentQualityBucket(value: unknown): IntentQualityBucket | '' {
  switch (value) {
    case 'passed':
    case 'auth_blocked':
    case 'permission_blocked':
    case 'env_blocked':
    case 'data_blocked':
    case 'model_quality':
    case 'canceled':
      return value;
    default:
      return '';
  }
}

function resolveIntentQualitySplit(input: {
  status: 'passed' | 'failed' | 'canceled';
  failureClass?: string | null;
}): IntentQualitySplit {
  const failureClass = typeof input.failureClass === 'string' ? input.failureClass.trim() : '';

  if (input.status === 'passed') {
    return {
      bucket: 'passed',
      blocked: false,
      qualityEligible: true,
      blockerKind: '',
    };
  }

  switch (failureClass) {
    case 'auth_failed':
      return {
        bucket: 'auth_blocked',
        blocked: true,
        qualityEligible: false,
        blockerKind: 'auth',
      };
    case 'permission_blocked':
      return {
        bucket: 'permission_blocked',
        blocked: true,
        qualityEligible: false,
        blockerKind: 'permission',
      };
    case 'env_transient':
      return {
        bucket: 'env_blocked',
        blocked: true,
        qualityEligible: false,
        blockerKind: 'environment',
      };
    case 'data_missing':
      return {
        bucket: 'data_blocked',
        blocked: true,
        qualityEligible: false,
        blockerKind: 'data',
      };
    default:
      if (input.status === 'canceled') {
        return {
          bucket: 'canceled',
          blocked: false,
          qualityEligible: false,
          blockerKind: '',
        };
      }

      return {
        bucket: 'model_quality',
        blocked: false,
        qualityEligible: true,
        blockerKind: '',
      };
  }
}

function normalizeIntentQualitySplit(
  value: IntentQualitySplit | null | undefined,
  fallback: {
    status: 'passed' | 'failed' | 'canceled';
    failureClass?: string | null;
  }
): IntentQualitySplit {
  const bucket = normalizeIntentQualityBucket(value?.bucket);
  if (!bucket) {
    return resolveIntentQualitySplit(fallback);
  }

  return {
    bucket,
    blocked: typeof value?.blocked === 'boolean' ? value.blocked : bucket.endsWith('_blocked'),
    qualityEligible:
      typeof value?.qualityEligible === 'boolean' ? value.qualityEligible : bucket === 'passed' || bucket === 'model_quality',
    blockerKind:
      value?.blockerKind ||
      (bucket === 'auth_blocked'
        ? 'auth'
        : bucket === 'permission_blocked'
          ? 'permission'
          : bucket === 'env_blocked'
            ? 'environment'
            : bucket === 'data_blocked'
              ? 'data'
              : ''),
  };
}

function intentQualitySplitTone(split: IntentQualitySplit): string {
  switch (split.bucket) {
    case 'passed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'auth_blocked':
    case 'permission_blocked':
    case 'env_blocked':
    case 'data_blocked':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'canceled':
      return 'border-slate-200 bg-slate-100 text-slate-600';
    default:
      return 'border-rose-200 bg-rose-50 text-rose-700';
  }
}

function intentQualitySplitLabel(split: IntentQualitySplit): string {
  switch (split.bucket) {
    case 'passed':
      return '模型通过';
    case 'auth_blocked':
      return '认证阻塞';
    case 'permission_blocked':
      return '权限阻塞';
    case 'env_blocked':
      return '环境阻塞';
    case 'data_blocked':
      return '数据阻塞';
    case 'canceled':
      return '已取消';
    default:
      return '模型质量';
  }
}

function intentPlatformTestTypeLabel(value?: IntentPlatformTestType): string {
  switch (value) {
    case 'api_flow':
      return 'API Flow';
    case 'repo_test':
      return 'Repo Test';
    case 'contract_check':
      return 'Contract Check';
    default:
      return 'Browser E2E';
  }
}

function intentPlatformRunnerTypeLabel(value?: IntentPlatformRunnerType): string {
  switch (value) {
    case 'http_runner':
      return 'HTTP Runner';
    case 'repo_test_runner':
      return 'Repo Runner';
    case 'contract_runner':
      return 'Contract Runner';
    default:
      return 'Playwright Runner';
  }
}

function stepTone(status: StepResult['status']): string {
  switch (status) {
    case 'passed':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'failed':
      return 'text-rose-700 bg-rose-50 border-rose-200';
    case 'skipped':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    default:
      return 'text-slate-700 bg-slate-50 border-slate-200';
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0%';
  const percent = value * 100;
  return `${percent >= 100 ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

function formatRatePercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0%';
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function formatKnowledgeDraftConfidence(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0%';
  if (value <= 1) {
    return formatPercent(value);
  }

  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function summarizeTextList(items: string[], limit = 3): string {
  const picked = items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
  return picked.length > 0 ? picked.join(' · ') : '—';
}

function formatMetricDelta(before: number, after: number): string {
  const delta = after - before;
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

function formatActorLabel(actorLabel: string): string {
  if (!actorLabel || actorLabel === 'system') return '系统';
  if (actorLabel === 'web') return 'Web';
  return actorLabel;
}

function intentRunStatusLabel(status: IntentRunStatus | IntentE2EInsightRecentTrace['status']): string {
  switch (status) {
    case 'passed':
      return '已通过';
    case 'failed':
      return '已失败';
    case 'canceled':
      return '已取消';
    case 'running':
      return '执行中';
    default:
      return '已创建';
  }
}

function intentRunStatusTone(status: IntentRunStatus | IntentE2EInsightRecentTrace['status']): string {
  switch (status) {
    case 'passed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'failed':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'canceled':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'running':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-600';
  }
}

function intentAssetReadinessLabel(status: IntentAssetReadinessStatus): string {
  switch (status) {
    case 'asset_missing':
      return '资产缺失';
    case 'no_hit':
      return '未命中';
    case 'ready':
    default:
      return '已就绪';
  }
}

function intentAssetReadinessTone(status: IntentAssetReadinessStatus): string {
  switch (status) {
    case 'asset_missing':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'no_hit':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'ready':
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
}

function normalizeIntentLaunchDecisionValue(value: string | null | undefined): IntentLaunchDecisionValue | '' {
  switch ((value || '').trim()) {
    case 'auto_run':
    case 'needs_bootstrap':
    case 'needs_fixture':
    case 'needs_clarify':
    case 'draft_only':
      return value!.trim() as IntentLaunchDecisionValue;
    default:
      return '';
  }
}

function isBlockedIntentLaunchDecision(value: IntentLaunchDecisionValue | '' | null | undefined): boolean {
  return Boolean(value && value !== 'auto_run');
}

function intentLaunchDecisionLabel(decision: IntentLaunchDecisionValue): string {
  switch (decision) {
    case 'needs_bootstrap':
      return '先补冷启动资产';
    case 'needs_fixture':
      return '先补前置数据';
    case 'needs_clarify':
      return '先补任务描述';
    case 'draft_only':
      return '先保留草稿';
    case 'auto_run':
    default:
      return '可直接开跑';
  }
}

function intentLaunchDecisionTone(decision: IntentLaunchDecisionValue): string {
  switch (decision) {
    case 'needs_bootstrap':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'needs_fixture':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'needs_clarify':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'draft_only':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    case 'auto_run':
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
}

function intentLaunchDecisionSummary(decision: IntentLaunchDecisionValue): string {
  switch (decision) {
    case 'needs_bootstrap':
      return '当前项目还没有准备好最小冷启动资产，先补 onboarding / 项目知识，再开始自动测试更稳。';
    case 'needs_fixture':
      return '这次请求更像写数据或依赖前置数据的任务，先补 fixture 契约，再跑自动链路。';
    case 'needs_clarify':
      return '当前描述上下文不够，先把目标、入口或成功标准补完整，再让 AI 开跑。';
    case 'draft_only':
      return '最近相似任务失败压力偏高，先保留草稿或改写描述，比继续盲跑更划算。';
    case 'auto_run':
    default:
      return '当前请求已具备自动运行条件。';
  }
}

function intentLaunchDecisionActionHint(decision: IntentLaunchDecisionValue): string {
  switch (decision) {
    case 'needs_bootstrap':
      return '下一步建议：先补 onboarding manifest、项目知识和最小 gold flow。';
    case 'needs_fixture':
      return '下一步建议：补齐 fixture 的 setup / cleanup / owner / idempotencyKey，再重新发起。';
    case 'needs_clarify':
      return '下一步建议：至少补充目标页面、入口 URL、关键步骤、成功标准中的两项。';
    case 'draft_only':
      return '下一步建议：先改写描述降低失败压力；若确认要验证，也可以显式继续开跑。';
    case 'auto_run':
    default:
      return '';
  }
}

function intentNewIntentReadinessModeLabel(mode: IntentNewIntentReadinessRecommendedMode): string {
  switch (mode) {
    case 'direct_generate':
      return '直接生成';
    case 'recipe_assisted':
      return 'Recipe 辅助';
    case 'exploration_run':
      return '探索运行';
    case 'needs_bootstrap':
      return '补冷启动';
    case 'needs_fixture':
      return '补前置数据';
    case 'needs_clarify':
      return '补描述';
    case 'draft_only':
      return '先留草稿';
    default:
      return mode;
  }
}

function intentNewIntentReadinessConfidenceLabel(confidence: IntentNewIntentReadiness['confidence']): string {
  switch (confidence) {
    case 'high':
      return '高';
    case 'medium':
      return '中';
    case 'low':
    default:
      return '低';
  }
}

function intentNewIntentMissingContractLabel(contract: string): string {
  switch (contract) {
    case 'target_url':
      return '目标 URL';
    case 'explicit_verifier':
      return '明确验收标准';
    case 'stable_family_or_document_path':
      return '稳定 family / 文档路径';
    case 'fixture_contract':
      return 'fixture 契约';
    case 'project_assets':
      return '项目冷启动资产';
    case 'stable_identifier':
      return '稳定身份字段';
    case 'recipe':
      return 'Recipe';
    case 'auth_context':
      return '登录态 / 权限上下文';
    default:
      return contract;
  }
}

function intentLaunchDecisionReasonLabel(reason: string): string {
  switch (reason) {
    case 'project_bootstrap_required':
      return '项目冷启动资产尚未完成';
    case 'fixture_contract_missing':
      return '缺少 fixture / 前置数据契约';
    case 'insufficient_request_context':
      return '任务描述缺少目标、入口或成功标准';
    case 'recent_repeated_model_failure':
      return '最近相似任务连续失败';
    case 'recent_repeated_data_block':
      return '最近相似任务连续卡在前置数据缺口';
    case 'recent_repeated_auth_block':
      return '最近相似任务连续卡在登录态';
    case 'recent_repeated_permission_block':
      return '最近相似任务连续卡在权限';
    case 'recent_repeated_environment_block':
      return '最近相似任务连续卡在环境稳定性';
    case 'high_failure_pressure':
      return '相似任务近期失败压力偏高';
    default:
      return intentAssetReadinessReasonLabel(reason);
  }
}

function intentAssetReadinessReasonLabel(reason: string): string {
  switch (reason) {
    case 'global_scope':
      return '当前为全局作用域';
    case 'onboarding_manifest_missing':
      return '缺少 onboarding manifest';
    case 'onboarding_manifest_invalid':
      return 'onboarding manifest 格式无效';
    case 'onboarding_baseUrl_missing':
      return 'onboarding 缺少 baseUrl';
    case 'onboarding_loginEntry_missing':
      return 'onboarding 缺少 loginEntry';
    case 'onboarding_targetUrlFamilies_missing':
      return 'onboarding 缺少 targetUrlFamilies';
    case 'onboarding_stableIdentifierHints_missing':
      return 'onboarding 缺少 stableIdentifierHints';
    case 'onboarding_keyResponsePatterns_missing':
      return 'onboarding 缺少 keyResponsePatterns';
    case 'onboarding_defaultListOwnershipHints_missing':
      return 'onboarding 缺少 defaultListOwnershipHints';
    case 'onboarding_detailEntryHints_missing':
      return 'onboarding 缺少 detailEntryHints';
    case 'onboarding_goldFlows_missing':
      return 'onboarding 缺少 goldFlows';
    case 'project_knowledge_missing':
      return '缺少项目知识文件';
    case 'repair_memory_missing':
      return '缺少项目 repair memory';
    case 'knowledge_no_hit':
      return '本次未命中知识规则';
    default:
      return reason || '—';
  }
}

function summarizeIntentAssetReadinessReasons(readiness: IntentAssetReadiness | null | undefined, limit = 3): string {
  if (!readiness?.reasons?.length) return '—';
  return summarizeTextList(readiness.reasons.map(intentAssetReadinessReasonLabel), limit);
}

function intentProjectRuntimeGovernanceTone(status: IntentProjectRuntimeGovernanceStatus | null | undefined): string {
  if (!status) return 'border-slate-200 bg-slate-50 text-slate-700';
  if (status.ready) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (!status.valid) return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function intentProjectRuntimeGovernanceLabel(status: IntentProjectRuntimeGovernanceStatus | null | undefined): string {
  if (!status) return '未检查';
  if (status.ready) return '已就绪';
  if (!status.exists) return '缺 manifest';
  if (!status.valid) return 'manifest 无效';
  return `${status.issues.length} 项待补`;
}

function summarizeIntentProjectRuntimeGovernanceCoverage(
  status: IntentProjectRuntimeGovernanceStatus | null | undefined
): string {
  if (!status) return '—';
  return [
    `environment ${status.hasEnvironmentProfile ? '已声明' : '缺失'}`,
    `credential ${status.hasCredentialDefaults ? '已声明' : '未声明'}`,
    `fixture ${status.hasFixtureDefaults ? '已声明' : '未声明'}`,
  ].join(' · ');
}

function insightVerificationIntentTone(intent: IntentE2EInsightVerificationIntent): string {
  switch (intent) {
    case 'review':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'verify':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'unknown':
    default:
      return 'border-slate-200 bg-slate-100 text-slate-600';
  }
}

function traceAttemptOutcomeLabel(outcome: IntentE2EInsightTraceAttemptOutcome): string {
  switch (outcome) {
    case 'passed':
      return '通过';
    case 'failed':
      return '失败';
    default:
      return '未知';
  }
}

function traceAttemptOutcomeTone(outcome: IntentE2EInsightTraceAttemptOutcome): string {
  switch (outcome) {
    case 'passed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'failed':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-600';
  }
}

function insightFailureClassLabel(failureClass: string): string {
  if (!failureClass) return '—';
  const label = intentFailureClassLabel(failureClass as IntentFailureTriage['failureClass']);
  return label === '未分类' && failureClass !== 'unknown' ? failureClass : label;
}

function priorityScenarioFamilyLabel(family: IntentE2EPriorityScenarioFamily): string {
  switch (family) {
    case 'business_create_list_verify':
      return '新建商机回列表';
    case 'business_to_order':
      return '商机转订单';
    case 'business_batch_add_contacts_verify':
      return '批量加入通讯录';
    case 'list_search_detail':
      return '列表搜索详情';
    case 'modal_or_drawer_save':
      return '弹层保存';
    case 'row_action_menu':
      return '行操作菜单';
    case 'list_ownership_switch':
      return '归属切换';
    default:
      return '未跟踪';
  }
}

function evalCandidatePriorityLabel(priority: IntentE2EEvaluationCandidatePriority): string {
  switch (priority) {
    case 'p0':
      return 'P0 必测';
    case 'p1':
      return 'P1 建议';
    default:
      return 'P2 补充';
  }
}

function evalCandidatePriorityTone(priority: IntentE2EEvaluationCandidatePriority): string {
  switch (priority) {
    case 'p0':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'p1':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-sky-200 bg-sky-50 text-sky-700';
  }
}

function probationStatusLabel(status: IntentE2EInsightProbationRule['status']): string {
  switch (status) {
    case 'degraded':
      return '已降级';
    case 'promoted':
      return '已转正';
    default:
      return '观察中';
  }
}

function probationStatusTone(status: IntentE2EInsightProbationRule['status']): string {
  switch (status) {
    case 'degraded':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'promoted':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    default:
      return 'border-sky-200 bg-sky-50 text-sky-700';
  }
}

function mergeImpactStatusLabel(status: IntentE2EInsightProbationRule['impactStatus'] | IntentE2EInsightRollbackCandidate['impactStatus']): string {
  switch (status) {
    case 'improving':
      return '收益中';
    case 'regressing':
      return '在回退';
    default:
      return '待观察';
  }
}

function mergeImpactStatusTone(status: IntentE2EInsightProbationRule['impactStatus'] | IntentE2EInsightRollbackCandidate['impactStatus']): string {
  switch (status) {
    case 'improving':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'regressing':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function knowledgeChangeEfficacyStatusLabel(status: IntentE2EInsightKnowledgeChangeGrader['efficacyStatus']): string {
  switch (status) {
    case 'improving':
      return '合并后改善';
    case 'neutral':
      return '合并后平稳';
    case 'regressing':
      return '合并后恶化';
    case 'recovered':
      return '回滚后恢复';
    case 'still_abnormal':
      return '回滚后仍异常';
    default:
      return '继续观察';
  }
}

function knowledgeChangeEfficacyStatusTone(status: IntentE2EInsightKnowledgeChangeGrader['efficacyStatus']): string {
  switch (status) {
    case 'improving':
    case 'recovered':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'regressing':
    case 'still_abnormal':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'watching':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function knowledgeChangeEvidenceLevelLabel(level: IntentE2EInsightKnowledgeChangeGrader['evidenceLevel']): string {
  return level === 'decisionable' ? '证据充分' : '早期样本';
}

function knowledgeChangeEvidenceLevelTone(level: IntentE2EInsightKnowledgeChangeGrader['evidenceLevel']): string {
  return level === 'decisionable'
    ? 'border-slate-200 bg-slate-50 text-slate-700'
    : 'border-amber-200 bg-amber-50 text-amber-700';
}

function riskLifecycleStatusLabel(status: IntentE2EInsightRiskLifecycleRule['latestStatus']): string {
  switch (status) {
    case 'rollback_candidate':
      return '回滚候选';
    case 'degraded':
      return '已降级';
    case 'promoted':
      return '已转正';
    default:
      return '观察中';
  }
}

function riskLifecycleStatusTone(status: IntentE2EInsightRiskLifecycleRule['latestStatus']): string {
  switch (status) {
    case 'rollback_candidate':
      return 'border-rose-300 bg-rose-100 text-rose-800';
    case 'degraded':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'promoted':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function riskLifecyclePolicyLabel(policy: IntentE2EInsightRiskLifecycleRule['policy']): string {
  switch (policy) {
    case 'block_default_merge':
      return '阻断默认合并';
    case 'observe_guarded':
      return '谨慎观察';
    case 'auto_promote_candidate':
      return '自动晋升候选';
    default:
      return '继续观察';
  }
}

function riskLifecyclePolicyTone(policy: IntentE2EInsightRiskLifecycleRule['policy']): string {
  switch (policy) {
    case 'block_default_merge':
      return 'border-rose-300 bg-rose-100 text-rose-800';
    case 'observe_guarded':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'auto_promote_candidate':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function summarizeRiskLifecycleRuleProvenanceStage(
  stage: 'preflight' | 'receipt',
  counts: IntentE2EInsightMergeProvenanceKindCounts
): string {
  const parts =
    stage === 'preflight'
      ? [
          counts.blockDefaultMergeCount > 0 ? `默认阻断 ${counts.blockDefaultMergeCount}` : '',
          counts.overrideCount > 0 ? `override ${counts.overrideCount}` : '',
          counts.riskAcknowledgementCount > 0 ? `风险确认 ${counts.riskAcknowledgementCount}` : '',
          counts.observeCount > 0 ? `观察 ${counts.observeCount}` : '',
          counts.autoPromoteCount > 0 ? `自动晋升 ${counts.autoPromoteCount}` : '',
        ]
      : [
          counts.overrideCount > 0 ? `override ${counts.overrideCount}` : '',
          counts.riskAcknowledgementCount > 0 ? `风险确认 ${counts.riskAcknowledgementCount}` : '',
          counts.guardrailCount > 0 ? `护栏 ${counts.guardrailCount}` : '',
          counts.auditCount > 0 ? `审计 ${counts.auditCount}` : '',
        ];

  const summary = parts.filter(Boolean);
  return summary.length > 0 ? summary.join(' · ') : '—';
}

function projectKnowledgeMergeNoticeTone(notice: Pick<ProjectKnowledgeMergeNotice, 'kind'>): string {
  switch (notice.kind) {
    case 'auto_promote':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'observe':
      return 'border-slate-200 bg-slate-50 text-slate-700';
    case 'block_default_merge':
    case 'override':
      return 'border-rose-200 bg-rose-50 text-rose-800';
    case 'risk_acknowledgement':
    case 'audit':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'guardrail':
      return 'border-violet-200 bg-violet-50 text-violet-800';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function projectKnowledgeMergeNoticeProvenanceLabel(provenanceType: ProjectKnowledgeMergeNotice['provenanceType']): string {
  switch (provenanceType) {
    case 'recommended':
      return '推荐';
    case 'observe':
      return '观察';
    case 'override':
      return 'override';
    case 'risk_acknowledgement':
      return '风险确认';
    case 'guardrail':
      return '护栏';
    default:
      return '审计';
  }
}

function mergeProvenanceStageLabel(stage: IntentE2EInsightMergeProvenanceStat['stage']): string {
  return stage === 'receipt' ? '回执' : '预检';
}

function starterHelperSourceLabel(source: IntentE2EInsightStarterHelper['source']): string {
  return source === 'promoted' ? '转正规则' : '稳定规则';
}

function starterHelperSourceTone(source: IntentE2EInsightStarterHelper['source']): string {
  return source === 'promoted'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-sky-200 bg-sky-50 text-sky-700';
}

function starterHelperKnowledgeSignalLabel(signal: IntentE2EInsightStarterHelper['knowledgeChangeSignal']): string {
  switch (signal) {
    case 'positive':
      return '长期正向';
    case 'negative':
      return '长期负向';
    default:
      return '';
  }
}

function starterHelperKnowledgeSignalTone(signal: IntentE2EInsightStarterHelper['knowledgeChangeSignal']): string {
  switch (signal) {
    case 'positive':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'negative':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function starterHelperKnowledgeTierLabel(
  tier: IntentE2EInsightStarterHelper['knowledgeChangeTier'],
  watchingKind: IntentE2EInsightStarterHelper['knowledgeChangeWatchingKind'] = undefined
): string {
  switch (tier) {
    case 'preferred':
      return '优先层';
    case 'watching':
      return watchingKind === 'mixed' ? '混合观察' : watchingKind === 'recovering' ? '恢复观察' : '观察中';
    default:
      return '';
  }
}

function starterHelperKnowledgeTierTone(
  tier: IntentE2EInsightStarterHelper['knowledgeChangeTier'],
  watchingKind: IntentE2EInsightStarterHelper['knowledgeChangeWatchingKind'] = undefined
): string {
  switch (tier) {
    case 'preferred':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'watching':
      return watchingKind === 'recovering'
        ? 'border-sky-200 bg-sky-50 text-sky-700'
        : 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function starterHelperGovernanceReleaseLabel(status: IntentE2EInsightStarterHelper['governanceReleaseStatus']): string {
  switch (status) {
    case 'released_from_suppressed':
      return '治理恢复释放';
    default:
      return '';
  }
}

function starterHelperGovernanceReleaseTone(status: IntentE2EInsightStarterHelper['governanceReleaseStatus']): string {
  switch (status) {
    case 'released_from_suppressed':
      return 'border-cyan-200 bg-cyan-50 text-cyan-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function starterHelperPreferredPromotionLabel(
  status: IntentE2EInsightStarterHelper['preferredPromotionStatus']
): string {
  switch (status) {
    case 'await_more_positive_rules':
      return '待补正向规则';
    case 'blocked_by_mixed_evidence':
      return '混合证据未清零';
    case 'await_long_term_recovery':
      return '等待长期转正';
    default:
      return '';
  }
}

function starterHelperPreferredPromotionTone(
  status: IntentE2EInsightStarterHelper['preferredPromotionStatus']
): string {
  switch (status) {
    case 'await_more_positive_rules':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'blocked_by_mixed_evidence':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'await_long_term_recovery':
      return 'border-cyan-200 bg-cyan-50 text-cyan-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function suppressedStarterHelperGovernanceRecommendationLabel(
  status: IntentE2EInsightSuppressedStarterHelper['governanceRecommendationStatus']
): string {
  switch (status) {
    case 'await_governance_targets':
      return '待补治理目标';
    case 'blocked_by_recent_failures':
      return '失败窗口未清零';
    case 'await_direct_verify':
      return '等待直接验证';
    case 'await_more_capability_recovery':
      return '等待更多恢复';
    default:
      return '';
  }
}

function suppressedStarterHelperGovernanceRecommendationTone(
  status: IntentE2EInsightSuppressedStarterHelper['governanceRecommendationStatus']
): string {
  switch (status) {
    case 'await_governance_targets':
      return 'border-slate-200 bg-slate-50 text-slate-600';
    case 'blocked_by_recent_failures':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'await_direct_verify':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'await_more_capability_recovery':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function governanceCapabilityExecutionStatusLabel(status: IntentE2EInsightSuppressedStarterHelperGovernanceCapability['latestExecutionStatus']): string {
  switch (status) {
    case 'passed':
      return '最近通过';
    case 'failed':
      return '最近失败';
    default:
      return '暂无执行';
  }
}

function governanceCapabilityExecutionStatusTone(status: IntentE2EInsightSuppressedStarterHelperGovernanceCapability['latestExecutionStatus']): string {
  switch (status) {
    case 'passed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'failed':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-500';
  }
}

function governanceCapabilityExecutionIntentLabel(intent: IntentE2EInsightSuppressedStarterHelperGovernanceCapability['latestExecutionIntent']): string {
  switch (intent) {
    case 'review':
      return '保守复核';
    case 'verify':
      return '标准验证';
    default:
      return '未执行';
  }
}

function governanceCapabilityExecutionIntentTone(intent: IntentE2EInsightSuppressedStarterHelperGovernanceCapability['latestExecutionIntent']): string {
  switch (intent) {
    case 'review':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'verify':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-500';
  }
}

function governanceCapabilityExecutionSourceLabel(source: IntentE2EInsightSuppressedStarterHelperGovernanceCapability['latestExecutionSource']): string {
  switch (source) {
    case 'repair':
      return 'AI repair';
    case 'direct':
      return '直接执行';
    default:
      return '无来源';
  }
}

function governanceCapabilityExecutionSourceTone(source: IntentE2EInsightSuppressedStarterHelperGovernanceCapability['latestExecutionSource']): string {
  switch (source) {
    case 'repair':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'direct':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-500';
  }
}

function starterAssetScopeTone(scope: IntentStarterAssetScope): string {
  return scope === 'project_capability'
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : 'border-slate-200 bg-slate-100 text-slate-600';
}

function starterAssetPromotionDecisionTone(status: IntentStarterAssetPromotionDecision['status']): string {
  switch (status) {
    case 'promote_project_capability':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'review_project_capability':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'runtime_only':
    default:
      return 'border-slate-200 bg-slate-100 text-slate-600';
  }
}

function baseCodeSourceLabel(
  source: IntentExecutionStructuredPatch['baseCodeSource'] | IntentE2EInsightRecentTraceAttempt['baseCodeSource']
): string {
  switch (source) {
    case 'compiled_template':
      return '编译模板';
    case 'previous_code':
      return '上一轮代码';
    default:
      return '未知';
  }
}

function normalizeTraceResponseEventUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    return parsed.pathname || raw;
  } catch {
    return raw;
  }
}

function summarizeTraceResponseEvents(events: IntentE2EInsightRecentTraceResponseEvent[], limit = 2): string {
  if (!events.length) return '—';

  const picked = events.slice(0, Math.max(1, Math.floor(limit || 2))).map((event) => {
    if (event.kind === 'json_parsed') {
      const keys = event.topLevelKeys.length > 0 ? ` keys ${summarizeTextList(event.topLevelKeys, 3)}` : '';
      return `#${event.attempt} JSON${keys}`;
    }

    const url = normalizeTraceResponseEventUrl(event.url);
    const status = event.status !== null ? String(event.status) : '?';
    const method = event.method || 'HTTP';
    return `#${event.attempt} ${method} ${status}${url ? ` ${url}` : ''}`;
  });

  return `${picked.join(' · ')}${events.length > picked.length ? ` 等 ${events.length} 条` : ''}`;
}

function summarizeTraceVerifierChecks(result: IntentE2EInsightRecentTraceVerifierResult, limit = 2): string {
  if (result.failingCheckCount <= 0) return '未定位到明确失败检查';

  const labels = result.failingChecks
    .map((check) => check.title.trim() || check.checkUid.trim())
    .filter(Boolean);
  const summary = summarizeTextList(labels, limit);
  return `${result.failingCheckCount} 项失败检查${summary !== '—' ? ` · ${summary}` : ''}`;
}

function projectKnowledgeOperationLabel(operation: ProjectKnowledgeAuditItem['operation'] | 'merge' | 'restore'): string {
  return operation === 'restore' ? '回滚' : '合并';
}

function summarizeIdList(items: string[], limit = 4): string {
  const picked = items.filter(Boolean).slice(0, limit);
  if (picked.length === 0) return '—';
  return items.length > picked.length ? `${picked.join('，')} 等 ${items.length} 条` : picked.join('，');
}

function projectKnowledgeComparisonMetrics(comparison: ProjectKnowledgeProfileComparison) {
  return [
    { key: 'rules', label: '规则', before: comparison.before.ruleCount, after: comparison.after.ruleCount },
    { key: 'enabled', label: '启用规则', before: comparison.before.enabledRuleCount, after: comparison.after.enabledRuleCount },
    { key: 'capabilities', label: '能力', before: comparison.before.capabilitySlugCount, after: comparison.after.capabilitySlugCount },
    { key: 'helpers', label: 'Helper', before: comparison.before.preferredHelperCount, after: comparison.after.preferredHelperCount },
    { key: 'patches', label: 'Step Patch', before: comparison.before.stepPatchCount, after: comparison.after.stepPatchCount },
    { key: 'urls', label: 'URL 模式', before: comparison.before.urlPatternCount, after: comparison.after.urlPatternCount },
  ];
}

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

function knowledgeDraftFeedbackRank(status?: IntentProjectKnowledgeDraftCandidateFeedback['status']): number {
  switch (status) {
    case 'preferred':
      return 0;
    case 'neutral':
      return 1;
    case 'probationary':
      return 2;
    case 'deprioritized':
      return 3;
    default:
      return 1;
  }
}

function knowledgeDraftFeedbackLabel(status?: IntentProjectKnowledgeDraftCandidateFeedback['status']): string {
  switch (status) {
    case 'preferred':
      return '优先推荐';
    case 'probationary':
      return '观察期';
    case 'deprioritized':
      return '自动降权';
    default:
      return '常规候选';
  }
}

function knowledgeDraftFeedbackTone(status?: IntentProjectKnowledgeDraftCandidateFeedback['status']): string {
  switch (status) {
    case 'preferred':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'probationary':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'deprioritized':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function knowledgeDraftCandidateSourceLabel(source: IntentProjectKnowledgeDraftCandidateSource): string {
  return source === 'successful_run' ? 'Successful Run' : 'Repair Memory';
}

function knowledgeDraftCandidateSourceTone(source: IntentProjectKnowledgeDraftCandidateSource): string {
  return source === 'successful_run'
    ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
    : 'border-violet-200 bg-violet-50 text-violet-700';
}

function successfulRunKnowledgePromotionReceiptStatusLabel(
  status: IntentSuccessfulRunKnowledgePromotionReceipt['items'][number]['status']
): string {
  switch (status) {
    case 'merged':
      return '已沉淀';
    case 'covered':
      return '已覆盖';
    case 'missing':
      return '已失效';
    case 'skipped_rule':
      return '重复规则';
    default:
      return '未落盘';
  }
}

function successfulRunKnowledgePromotionReceiptStatusTone(
  status: IntentSuccessfulRunKnowledgePromotionReceipt['items'][number]['status']
): string {
  switch (status) {
    case 'merged':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'covered':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'missing':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'skipped_rule':
      return 'border-slate-200 bg-slate-100 text-slate-600';
    default:
      return 'border-rose-200 bg-rose-50 text-rose-700';
  }
}

function summarizeSuccessfulRunKnowledgePromotionReceipt(
  receipt?: IntentSuccessfulRunKnowledgePromotionReceipt | null
): string {
  if (!receipt) return '';

  return [
    `Successful Run 回执：新增规则 ${receipt.summary.mergedRuleCount} 条`,
    receipt.requestedModuleUid ? `模块 ${receipt.requestedModuleUid}` : '',
    receipt.summary.coveredCandidateCount > 0 ? `已覆盖 ${receipt.summary.coveredCandidateCount} 条` : '',
    receipt.summary.skippedRuleCount > 0 ? `重复规则 ${receipt.summary.skippedRuleCount} 条` : '',
    receipt.summary.missingCandidateCount > 0 ? `失效候选 ${receipt.summary.missingCandidateCount} 条` : '',
    receipt.summary.runCount > 0 ? `关联通过运行 ${receipt.summary.runCount} 条` : '',
    receipt.summary.helperCount > 0 ? `涉及 helper ${receipt.summary.helperCount} 个` : '',
  ]
    .filter(Boolean)
    .join('，');
}

function sortKnowledgeDraftCandidates(candidates: IntentProjectKnowledgeDraftCandidate[]): IntentProjectKnowledgeDraftCandidate[] {
  return [...candidates].sort(
    (a, b) =>
      knowledgeDraftFeedbackRank(a.feedback?.status) - knowledgeDraftFeedbackRank(b.feedback?.status) ||
      b.confidence - a.confidence ||
      b.resolvedCount - a.resolvedCount ||
      b.seenCount - a.seenCount ||
      a.rule.id.localeCompare(b.rule.id)
  );
}

function defaultKnowledgeDraftCandidateIds(draft: IntentProjectKnowledgeDraft): string[] {
  return sortKnowledgeDraftCandidates(draft.candidates)
    .filter((candidate) => isIntentProjectKnowledgeDraftCandidateMergeRecommended(candidate))
    .map((candidate) => candidate.candidateId);
}

function allMergeableKnowledgeDraftCandidateIds(draft: IntentProjectKnowledgeDraft): string[] {
  return sortKnowledgeDraftCandidates(draft.candidates)
    .filter((candidate) => isIntentProjectKnowledgeDraftCandidateSelectable(candidate))
    .map((candidate) => candidate.candidateId);
}

function knowledgeDraftSelectionStateLabel(candidate: IntentProjectKnowledgeDraftCandidate, selected: boolean): string {
  if (candidate.alreadyCovered) return '已覆盖';
  if (isIntentProjectKnowledgeDraftCandidateDeferredByDefault(candidate)) {
    return selected ? '人工强选' : '默认跳过';
  }
  return selected ? '待合并' : '未选中';
}

function knowledgeDraftSelectionTone(candidate: IntentProjectKnowledgeDraftCandidate, selected: boolean): string {
  if (candidate.alreadyCovered) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (isIntentProjectKnowledgeDraftCandidateDeferredByDefault(candidate)) {
    if (!selected) {
      return isIntentProjectKnowledgeDraftCandidateDeprioritized(candidate)
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-amber-200 bg-amber-50 text-amber-700';
    }

    return isIntentProjectKnowledgeDraftCandidateDeprioritized(candidate)
      ? 'border-rose-300 bg-rose-100 text-rose-800'
      : 'border-amber-300 bg-amber-100 text-amber-800';
  }
  if (selected) {
    return candidate.feedback?.status === 'preferred'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-sky-200 bg-sky-50 text-sky-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function knowledgeDraftCandidateCardTone(candidate: IntentProjectKnowledgeDraftCandidate): string {
  if (candidate.alreadyCovered) {
    return 'border-amber-200 bg-amber-50/40';
  }
  switch (candidate.feedback?.status) {
    case 'preferred':
      return 'border-emerald-200 bg-emerald-50/30';
    case 'probationary':
      return 'border-amber-200 bg-amber-50/30';
    case 'deprioritized':
      return 'border-rose-200 bg-rose-50/30';
    default:
      return 'border-slate-200 bg-white';
  }
}

function knowledgeDraftFeedbackEvidenceReasons(feedback: IntentProjectKnowledgeDraftCandidateFeedback): string[] {
  if (!feedback.lifecyclePolicyReason) {
    return feedback.reasons;
  }

  return feedback.reasons.filter((reason) => reason !== feedback.lifecyclePolicyReason);
}

function createDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createFeedId(): string {
  return `feed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

class ProjectKnowledgeMergeError extends Error {
  response?: ProjectKnowledgeMergeRouteResponse;

  constructor(message: string, response?: ProjectKnowledgeMergeRouteResponse) {
    super(message);
    this.name = 'ProjectKnowledgeMergeError';
    this.response = response;
  }
}

function createPendingResult(): TestResult {
  return {
    success: false,
    duration: 0,
    steps: [],
    error: null,
  };
}

function normalizeCompiledTemplate(template?: CompiledExecutionTemplate | null): CompiledExecutionTemplate | undefined {
  if (!template) return undefined;

  return {
    ...template,
    sharedVariables: template.sharedVariables || [],
    slots: (template.slots || []).map((slot) => ({
      ...slot,
      relatedCheckUids: slot.relatedCheckUids || [],
      preferredHelpers: slot.preferredHelpers || [],
      instructions: slot.instructions || [],
    })),
  };
}

function normalizeStructuredPatch(
  structuredPatch?: IntentExecutionStructuredPatch | null
): IntentExecutionStructuredPatch | undefined {
  if (!structuredPatch) return undefined;

  return {
    ...structuredPatch,
    targetSlotUids: structuredPatch.targetSlotUids || [],
    returnedSlotUids: structuredPatch.returnedSlotUids || [],
    patch: {
      version: 1,
      slots: (structuredPatch.patch?.slots || []).map((slot) => ({
        slotUid: slot.slotUid,
        code: slot.code,
      })),
    },
  };
}

function normalizeAttemptEvent(event: AttemptEvent): AttemptEvent {
  if (event.type !== 'structured_patch') {
    return { ...event };
  }

  return {
    ...event,
    structuredPatch: normalizeStructuredPatch(event.structuredPatch) || event.structuredPatch,
  };
}

function normalizeIntentFailureTriage(triage?: IntentFailureTriage | null): IntentFailureTriage | null {
  if (!triage) return null;

  return {
    ...triage,
    matchedSignals: triage.matchedSignals || [],
    diagnosis: triage.diagnosis
      ? {
          ...triage.diagnosis,
          candidateAnchors: triage.diagnosis.candidateAnchors || [],
          frameHints: triage.diagnosis.frameHints || [],
          nextActions: triage.diagnosis.nextActions || [],
        }
      : null,
  };
}

function normalizeIntentExperienceSummary(summary?: IntentExperienceSummary | null): IntentExperienceSummary | null {
  if (!summary) return null;

  return {
    ...summary,
    hints: (summary.hints || []).map((hint) => ({
      ...hint,
      matchedSignals: hint.matchedSignals || [],
      matchedRecipeSlugs: hint.matchedRecipeSlugs || [],
      chosenHelpers: hint.chosenHelpers || [],
      stableEntityHints: hint.stableEntityHints || [],
      pitfalls: hint.pitfalls || [],
      playbookSlugs: hint.playbookSlugs || [],
    })),
  };
}

function normalizeIntentRunReview(review?: IntentRunReview | null): IntentRunReview | null {
  if (!review) return null;

  return {
    ...review,
    playbookCandidates: (review.playbookCandidates || []).map((candidate) => ({
      ...candidate,
      matchedRecipeSlugs: candidate.matchedRecipeSlugs || [],
      stepTypes: candidate.stepTypes || [],
      preconditions: candidate.preconditions || [],
      executorPlan: candidate.executorPlan || [],
      verifierPlan: candidate.verifierPlan || [],
      preferredHelpers: candidate.preferredHelpers || [],
      knownPitfalls: candidate.knownPitfalls || [],
      sourceRunIds: candidate.sourceRunIds || [],
    })),
    nextStepAdvice: review.nextStepAdvice
      ? {
          ...review.nextStepAdvice,
          actions: (review.nextStepAdvice.actions || []).map((action) => ({
            ...action,
          })),
        }
      : null,
  };
}

function normalizeIntentAttempt(attempt: IntentAttempt, status: IntentAttempt['status'] = 'completed'): IntentAttempt {
  return {
    ...attempt,
    events: (attempt.events || []).map((event) => normalizeAttemptEvent(event)),
    logs: (attempt.logs || []).map((log) => ({ ...log })),
    result: attempt.result
      ? {
          ...attempt.result,
          steps: (attempt.result.steps || []).map((step) => ({ ...step })),
        }
      : null,
    helperUsage: attempt.helperUsage
      ? {
          usedHelpers: attempt.helperUsage.usedHelpers || [],
          usedSuggestedHelpers: attempt.helperUsage.usedSuggestedHelpers || [],
        }
      : undefined,
    structuredPatch: normalizeStructuredPatch(attempt.structuredPatch),
    triage: normalizeIntentFailureTriage(attempt.triage),
    status,
  };
}

function normalizeRunResult(result: IntentRunResult): IntentRunResult {
  return {
    ...result,
    resolvedUrls: result.resolvedUrls
      ? {
          targetUrl: result.resolvedUrls.targetUrl || result.targetUrl,
          scenarioEntryUrl: result.resolvedUrls.scenarioEntryUrl || result.targetUrl,
          precheckUrl: result.resolvedUrls.precheckUrl || result.resolvedUrls.scenarioEntryUrl || result.targetUrl,
          analyzeUrl: result.resolvedUrls.analyzeUrl || result.resolvedUrls.scenarioEntryUrl || result.targetUrl,
        }
      : undefined,
    compiledTemplate: normalizeCompiledTemplate(result.compiledTemplate),
    knowledge: result.knowledge
      ? {
          ...result.knowledge,
          starterAssets: result.knowledge.starterAssets || [],
        }
      : result.knowledge,
    experience: normalizeIntentExperienceSummary(result.experience),
    assetReadiness: result.assetReadiness
      ? {
          ...result.assetReadiness,
          reasons: result.assetReadiness.reasons || [],
        }
      : result.assetReadiness,
    repairBudget: result.repairBudget
      ? {
          ...result.repairBudget,
        }
      : result.repairBudget,
    failureCta: result.failureCta
      ? {
          ...result.failureCta,
          actions: (result.failureCta.actions || []).map((action) => ({ ...action })),
        }
      : result.failureCta,
    qualitySplit: result.qualitySplit
      ? {
          ...result.qualitySplit,
        }
      : result.qualitySplit,
    review: normalizeIntentRunReview(result.review),
    attempts: result.attempts.map((attempt) => normalizeIntentAttempt(attempt, 'completed')),
    finalResult: {
      ...result.finalResult,
      steps: (result.finalResult.steps || []).map((step) => ({ ...step })),
    },
    finalFailureTriage: normalizeIntentFailureTriage(result.finalFailureTriage),
  };
}

function isTerminalRunStatus(status: IntentRunStatus): boolean {
  return status === 'passed' || status === 'failed' || status === 'canceled';
}

function createEmptyStreamState(): StreamState {
  return {
    stage: 'idle',
    message: '',
    scenarioCard: null,
    llmMeta: null,
    targetUrl: '',
    resolvedUrls: null,
    description: '',
    attempts: [],
    finalResult: null,
    finalFailureTriage: null,
    feed: [],
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error(`读取文件 ${file.name} 失败`));
    };
    reader.onerror = () => reject(new Error(`读取文件 ${file.name} 失败`));
    reader.readAsDataURL(file);
  });
}

function hasAuthContent(auth: AuthDraft): boolean {
  return Boolean(auth.loginUrl || auth.username || auth.password || auth.loginDescription);
}

function countByStatus(result: TestResult) {
  return result.steps.reduce(
    (acc, step) => {
      acc[step.status] += 1;
      return acc;
    },
    { passed: 0, failed: 0, skipped: 0, running: 0 }
  );
}

function pushFeed(feed: FeedItem[], text: string, tone: FeedItem['tone'] = 'info'): FeedItem[] {
  if (!text.trim()) return feed;
  return [...feed, { id: createFeedId(), tone, text: text.trim() }].slice(-24);
}

function buildDescriptionFeedText(event: Extract<IntentStreamEvent, { type: 'description' }>): string {
  const targetUrl = event.targetUrl.trim();
  const scenarioEntryUrl = event.scenarioEntryUrl?.trim() || '';
  const precheckUrl = event.precheckUrl?.trim() || scenarioEntryUrl;
  const analyzeUrl = event.analyzeUrl?.trim() || scenarioEntryUrl;

  if (!targetUrl) {
    return '执行目标已锁定：未生成 URL';
  }

  if (!scenarioEntryUrl || scenarioEntryUrl === targetUrl) {
    return `执行目标已锁定：${targetUrl}`;
  }

  return `执行目标已锁定：目标页=${targetUrl}；入口页=${scenarioEntryUrl}；precheck=${precheckUrl || scenarioEntryUrl}；analyze=${
    analyzeUrl || scenarioEntryUrl
  }`;
}

function createAttempt(attempt: number, kind: IntentAttempt['kind']): IntentAttempt {
  return {
    attempt,
    kind,
    code: '',
    events: [],
    logs: [],
    result: null,
    triage: null,
    status: 'running',
  };
}

function upsertAttempt(
  attempts: IntentAttempt[],
  attemptNumber: number,
  kind: IntentAttempt['kind'],
  updater: (attempt: IntentAttempt) => IntentAttempt
): IntentAttempt[] {
  const index = attempts.findIndex((item) => item.attempt === attemptNumber);

  if (index === -1) {
    return [...attempts, updater(createAttempt(attemptNumber, kind))].sort((a, b) => a.attempt - b.attempt);
  }

  return attempts.map((item, itemIndex) => (itemIndex === index ? updater(item) : item));
}

function hydrateStreamStateFromResult(result: IntentRunResult): StreamState {
  const finalFailureTriage = normalizeIntentFailureTriage(result.finalFailureTriage);
  return {
    stage: 'completed',
    message: result.finalResult.success ? '自动测试已完成，最终结果：通过。' : finalFailureTriage?.summary || '自动测试已结束，但暂未完全通过。',
    scenarioCard: result.scenarioCard,
    llmMeta: result.llmMeta,
    targetUrl: result.targetUrl,
    resolvedUrls: result.resolvedUrls || null,
    description: result.description,
    attempts: result.attempts.map((attempt) => normalizeIntentAttempt(attempt, 'completed')),
    finalResult: result.finalResult,
    finalFailureTriage,
    feed: [
      {
        id: createFeedId(),
        tone: result.finalResult.success ? 'success' : 'error',
        text:
          result.finalResult.success
            ? '自动测试完成：通过'
            : finalFailureTriage
            ? `自动测试结束：${intentFailureClassLabel(finalFailureTriage.failureClass)}`
            : '自动测试结束：仍有失败',
      },
    ],
  };
}

function applyIntentStreamEvent(state: StreamState, event: IntentStreamEvent): StreamState {
  switch (event.type) {
    case 'stage': {
      return {
        ...state,
        stage: event.stage,
        message: event.message || STAGE_COPY[event.stage],
        feed: pushFeed(state.feed, event.message || STAGE_COPY[event.stage], event.stage === 'completed' ? 'success' : event.stage === 'error' ? 'error' : 'info'),
      };
    }

    case 'scenario_card': {
      return {
        ...state,
        scenarioCard: event.scenarioCard,
        llmMeta: event.llmMeta,
        feed: pushFeed(state.feed, `场景卡已生成：${event.scenarioCard.title || '未命名场景'}`),
      };
    }

    case 'description': {
      return {
        ...state,
        targetUrl: event.targetUrl,
        resolvedUrls: {
          targetUrl: event.targetUrl,
          scenarioEntryUrl: event.scenarioEntryUrl?.trim() || event.targetUrl,
          precheckUrl: event.precheckUrl?.trim() || event.scenarioEntryUrl?.trim() || event.targetUrl,
          analyzeUrl: event.analyzeUrl?.trim() || event.scenarioEntryUrl?.trim() || event.targetUrl,
        },
        description: event.description,
        feed: pushFeed(state.feed, buildDescriptionFeedText(event)),
      };
    }

    case 'attempt_started': {
      return {
        ...state,
        attempts: upsertAttempt(state.attempts, event.attempt, event.kind, (attempt) => ({
          ...attempt,
          kind: event.kind,
          triage: attempt.triage || null,
          status: 'running',
        })),
        feed: pushFeed(state.feed, `开始第 ${event.attempt} 次${event.kind === 'repair' ? '修复' : '生成'}尝试`),
      };
    }

    case 'attempt_execution_started': {
      return {
        ...state,
        attempts: upsertAttempt(state.attempts, event.attempt, event.kind, (attempt) => ({
          ...attempt,
          kind: event.kind,
          sessionId: event.sessionId,
          triage: attempt.triage || null,
          status: 'running',
        })),
        feed: pushFeed(state.feed, `#${event.attempt} 浏览器会话已启动：${event.sessionId}`),
      };
    }

    case 'attempt_event': {
      const normalizedEvent = normalizeAttemptEvent(event.event);
      const nextAttempts = upsertAttempt(state.attempts, event.attempt, event.kind, (attempt) => ({
        ...attempt,
        kind: event.kind,
        events: [...attempt.events, normalizedEvent],
        code:
          normalizedEvent.type === 'code'
            ? `${attempt.code}${normalizedEvent.content}`
            : normalizedEvent.type === 'complete'
            ? normalizedEvent.content
            : attempt.code,
        structuredPatch:
          normalizedEvent.type === 'structured_patch' ? normalizeStructuredPatch(normalizedEvent.structuredPatch) : attempt.structuredPatch,
        triage: attempt.triage || null,
        status: 'running',
      }));

      const nextFeed =
        normalizedEvent.type === 'thinking' && normalizedEvent.content.trim()
          ? pushFeed(state.feed, `#${event.attempt} 思考：${normalizedEvent.content.trim()}`)
          : normalizedEvent.type === 'structured_patch'
          ? pushFeed(
              state.feed,
              `#${event.attempt} slot patch：${summarizeTextList(normalizedEvent.structuredPatch.returnedSlotUids, 3)}`
            )
          : normalizedEvent.type === 'error' && normalizedEvent.content.trim()
          ? pushFeed(state.feed, `#${event.attempt} 生成报错：${normalizedEvent.content.trim()}`, 'warning')
          : state.feed;

      return {
        ...state,
        attempts: nextAttempts,
        feed: nextFeed,
      };
    }

    case 'attempt_step': {
      return {
        ...state,
        attempts: upsertAttempt(state.attempts, event.attempt, event.kind, (attempt) => ({
          ...attempt,
          kind: event.kind,
          result: {
            ...(attempt.result || createPendingResult()),
            steps: [...(attempt.result?.steps || []), event.step],
          },
          triage: attempt.triage || null,
          status: 'running',
        })),
        feed: pushFeed(state.feed, `#${event.attempt} ${event.step.status.toUpperCase()} ${event.step.title}`, event.step.status === 'failed' ? 'warning' : 'info'),
      };
    }

    case 'attempt_log': {
      return {
        ...state,
        attempts: upsertAttempt(state.attempts, event.attempt, event.kind, (attempt) => ({
          ...attempt,
          kind: event.kind,
          logs: [...attempt.logs, event.log],
          triage: attempt.triage || null,
          status: 'running',
        })),
        feed:
          event.log.level.toLowerCase() === 'error'
            ? pushFeed(state.feed, `#${event.attempt} ${event.log.message}`, 'warning')
            : state.feed,
      };
    }

    case 'attempt_result': {
      return {
        ...state,
        attempts: upsertAttempt(state.attempts, event.attempt, event.kind, () => ({
          attempt: event.attempt,
          kind: event.kind,
          sessionId: event.sessionId,
          code: event.code,
          events: event.events.map((item) => normalizeAttemptEvent(item)),
          logs: event.logs.map((item) => ({ ...item })),
          result: {
            ...event.result,
            steps: event.result.steps.map((step) => ({ ...step })),
          },
          helperUsage: event.helperUsage,
          structuredPatch: normalizeStructuredPatch(event.structuredPatch),
          triage: normalizeIntentFailureTriage(event.triage),
          status: 'completed',
        })),
        feed: pushFeed(
          state.feed,
          `第 ${event.attempt} 次尝试${event.result.success ? '通过' : '失败'}${
            event.result.success ? '' : event.triage ? `（${intentFailureClassLabel(event.triage.failureClass)}）` : ''
          }${event.result.error ? `：${event.result.error}` : ''}`,
          event.result.success ? 'success' : 'warning'
        ),
      };
    }

    case 'final_result': {
      const finalFailureTriage = normalizeIntentFailureTriage(event.result.finalFailureTriage);
      return {
        ...state,
        stage: 'completed',
        message:
          event.result.finalResult.success
            ? '自动测试已完成，最终结果：通过。'
            : finalFailureTriage?.summary || '自动测试已结束，但暂未完全通过。',
        scenarioCard: event.result.scenarioCard,
        llmMeta: event.result.llmMeta,
        targetUrl: event.result.targetUrl,
        resolvedUrls: event.result.resolvedUrls || state.resolvedUrls,
        description: event.result.description,
        attempts: event.result.attempts.map((attempt) => normalizeIntentAttempt(attempt, 'completed')),
        finalResult: event.result.finalResult,
        finalFailureTriage,
        feed: pushFeed(
          state.feed,
          event.result.finalResult.success
            ? '自动测试完成：通过'
            : finalFailureTriage
            ? `自动测试结束：${intentFailureClassLabel(finalFailureTriage.failureClass)}`
            : '自动测试结束：仍有失败',
          event.result.finalResult.success ? 'success' : 'error'
        ),
      };
    }

    case 'error': {
      return {
        ...state,
        stage: 'error',
        message: event.message,
        feed: pushFeed(state.feed, event.message, 'error'),
      };
    }

    default:
      return state;
  }
}

function parseSSEBlock(block: string): IntentStreamEvent | null {
  const lines = block
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) return null;

  const payload = dataLines.join('\n').trim();
  if (!payload || payload === '[DONE]') return null;

  const parsed = JSON.parse(payload) as IntentStreamEvent | null;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (!('type' in parsed) || typeof parsed.type !== 'string') return null;
  return parsed;
}

async function consumeEventStream(
  response: Response,
  onEvent: (event: IntentStreamEvent) => void | Promise<void>
): Promise<void> {
  if (!response.body) {
    throw new Error('当前浏览器不支持流式响应读取');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    const parts = buffer.split(/\n\n/);
    buffer = parts.pop() || '';

    for (const part of parts) {
      const event = parseSSEBlock(part);
      if (event) {
        await onEvent(event);
      }
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const event = parseSSEBlock(buffer);
    if (event) {
      await onEvent(event);
    }
  }
}

function hydrateStreamStateFromRunRecord(run: IntentRunRecord): StreamState {
  let state = run.events.reduce((current, event) => applyIntentStreamEvent(current, event), createEmptyStreamState());

  if (run.result && !state.finalResult) {
    const normalizedResult = normalizeRunResult(run.result);
    state = {
      ...state,
      stage: 'completed',
      message:
        normalizedResult.finalResult.success
          ? '自动测试已完成，最终结果：通过。'
          : normalizedResult.finalFailureTriage?.summary || '自动测试已结束，但暂未完全通过。',
      scenarioCard: normalizedResult.scenarioCard,
      llmMeta: normalizedResult.llmMeta,
      targetUrl: normalizedResult.targetUrl,
      resolvedUrls: normalizedResult.resolvedUrls || state.resolvedUrls,
      description: normalizedResult.description,
      attempts: normalizedResult.attempts,
      finalResult: normalizedResult.finalResult,
      finalFailureTriage: normalizedResult.finalFailureTriage ?? null,
      feed:
        state.feed.length > 0
          ? state.feed
          : [
              {
                id: createFeedId(),
                tone: normalizedResult.finalResult.success ? 'success' : 'error',
                text:
                  normalizedResult.finalResult.success
                    ? '自动测试完成：通过'
                    : normalizedResult.finalFailureTriage
                    ? `自动测试结束：${intentFailureClassLabel(normalizedResult.finalFailureTriage.failureClass)}`
                    : '自动测试结束：仍有失败',
              },
            ],
    };
  }

  if (run.status === 'canceled') {
    return {
      ...state,
      stage: 'canceled',
      message: run.error || STAGE_COPY.canceled,
      feed: pushFeed(state.feed, run.error || STAGE_COPY.canceled),
    };
  }

  if (run.status === 'failed' && !state.finalResult && run.error) {
    return {
      ...state,
      stage: 'error',
      message: run.error,
      feed: pushFeed(state.feed, run.error, 'error'),
    };
  }

  if (run.stage === 'created' && state.stage === 'idle') {
    return {
      ...state,
      stage: 'received',
      message: '请求已创建，等待服务端启动自动测试…',
      feed: pushFeed(state.feed, '请求已创建，等待服务端启动自动测试…'),
    };
  }

  if (run.stage === 'queued' && state.stage === 'idle') {
    return {
      ...state,
      stage: 'queued',
      message: STAGE_COPY.queued,
      feed: pushFeed(state.feed, STAGE_COPY.queued),
    };
  }

  return state;
}

async function createIntentRun(payload: Record<string, unknown>): Promise<IntentRunRecord> {
  const res = await fetch('/api/intent-e2e/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = (await res.json().catch(() => null)) as (IntentRunEnvelope & { error?: string }) | null;
  if (!res.ok || !json?.run) {
    throw new Error(json?.error || '创建自动测试运行失败');
  }

  return json.run;
}

async function requestIntentLaunchDecision(payload: Record<string, unknown>): Promise<IntentLaunchDecisionResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, INTENT_LAUNCH_DECISION_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch('/api/intent-e2e/launch-decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildIntentE2ELaunchDecisionRequestBody(payload)),
      signal: controller.signal,
    });

    const json = (await res.json().catch(() => null)) as IntentLaunchDecisionResponse | null;
    if (!res.ok || !json?.decision) {
      throw new Error(json?.error || '计算自动测试启动决策失败');
    }

    return {
      decision: json.decision,
      reasons: Array.isArray(json.reasons) ? json.reasons : [],
      signals: json.signals,
      assetAvailability: json.assetAvailability || null,
      newIntentReadiness: json.newIntentReadiness || null,
    };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`评估启动条件超时（${Math.round(INTENT_LAUNCH_DECISION_REQUEST_TIMEOUT_MS / 1000)}s）`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchIntentRunRecord(runId: string): Promise<IntentRunRecord> {
  const res = await fetch(`/api/intent-e2e/runs/${encodeURIComponent(runId)}`, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as (IntentRunResponse & { error?: string }) | null;

  if (!res.ok || !json?.run) {
    throw new Error(json?.error || '获取自动测试运行状态失败');
  }

  return json.run;
}

async function mergeProjectRecipesFromPlaybookCandidates(
  projectUid: string,
  candidates: IntentPlaybookCandidate[]
): Promise<ProjectIntentRecipeMutationResponse> {
  const recipes = buildIntentProjectRecipeMergeInputsFromPlaybookCandidates(candidates);
  const res = await fetch(`/api/projects/${encodeURIComponent(projectUid)}/intent-recipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'merge',
      recipes,
    }),
  });
  const json = (await res.json().catch(() => null)) as ProjectIntentRecipeMutationResponse | null;
  if (!res.ok || !json?.result) {
    throw new Error(json?.error || '沉淀 playbook 到项目 recipe 失败');
  }
  return json;
}

const INTENT_RUN_REVIEW_POLL_INTERVAL_MS = 250;
const INTENT_RUN_REVIEW_POLL_MAX_ATTEMPTS = 5;

function waitForIntentRunReviewPoll(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchTerminalIntentRunReview(runId: string, seedRun: IntentRunRecord): Promise<IntentRunRecord> {
  let latestRun = seedRun;

  for (let attempt = 0; attempt < INTENT_RUN_REVIEW_POLL_MAX_ATTEMPTS; attempt += 1) {
    if (!isTerminalRunStatus(latestRun.status) || !latestRun.result || latestRun.result.review) {
      return latestRun;
    }

    await waitForIntentRunReviewPoll(INTENT_RUN_REVIEW_POLL_INTERVAL_MS);
    const nextRun = await fetchIntentRunRecord(runId).catch(() => null);
    if (nextRun) {
      latestRun = nextRun;
    }
  }

  return latestRun;
}

async function cancelIntentRunRequest(runId: string): Promise<IntentRunRecord | null> {
  const res = await fetch(`/api/intent-e2e/runs/${encodeURIComponent(runId)}/cancel`, {
    method: 'POST',
  });

  const json = (await res.json().catch(() => null)) as IntentRunCancelResponse | null;
  if (!res.ok) {
    throw new Error(json?.error || '停止当前自动测试失败');
  }

  return json?.run || null;
}

async function fetchIntentDraftLaunchDetail(projectUid: string, draftUid: string): Promise<IntentDraftLaunchDetail> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectUid)}/intent-drafts/${encodeURIComponent(draftUid)}`, {
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as { item?: IntentDraftLaunchDetail; error?: string } | null;
  if (!res.ok || !json?.item) {
    throw new Error(json?.error || '加载意图草稿详情失败');
  }

  return {
    intentDraftUid: typeof json.item.intentDraftUid === 'string' ? json.item.intentDraftUid : draftUid,
    title: typeof json.item.title === 'string' ? json.item.title : '',
    input: typeof json.item.input === 'string' ? json.item.input : '',
    featureDescription: typeof json.item.featureDescription === 'string' ? json.item.featureDescription : '',
    targetUrl: typeof json.item.targetUrl === 'string' ? json.item.targetUrl : '',
    targetUrlHint: typeof json.item.targetUrlHint === 'string' ? json.item.targetUrlHint : '',
    projectUid: typeof json.item.projectUid === 'string' ? json.item.projectUid : projectUid,
    moduleUid: typeof json.item.moduleUid === 'string' ? json.item.moduleUid : '',
    scenarioCard:
      json.item.scenarioCard && typeof json.item.scenarioCard === 'object' && !Array.isArray(json.item.scenarioCard)
        ? (json.item.scenarioCard as ScenarioCard)
        : null,
    scenarioLlmMeta:
      json.item.scenarioLlmMeta && typeof json.item.scenarioLlmMeta === 'object' && !Array.isArray(json.item.scenarioLlmMeta)
        ? (json.item.scenarioLlmMeta as Record<string, unknown>)
        : {},
    planCode: typeof json.item.planCode === 'string' ? json.item.planCode : '',
    attachments: Array.isArray(json.item.attachments)
      ? json.item.attachments
          .filter((item) => item && typeof item === 'object' && typeof item.dataUrl === 'string' && item.dataUrl.trim())
          .map((item) => ({
            name: typeof item.name === 'string' ? item.name : undefined,
            dataUrl: item.dataUrl,
            purpose: typeof item.purpose === 'string' ? item.purpose : undefined,
          }))
      : [],
    llmConfig: json.item.llmConfig && typeof json.item.llmConfig === 'object' ? json.item.llmConfig : {},
  };
}

function buildIntentDraftLaunchPayload(
  draftDetail: IntentDraftLaunchDetail,
  options: { fallbackProjectUid?: string; fallbackModuleUid?: string; llmConfig?: LLMConfigDraft | null } = {}
): Record<string, unknown> | null {
  const inputText = draftDetail.input.trim() || draftDetail.featureDescription.trim() || draftDetail.title.trim();
  if (!inputText) {
    return null;
  }

  const projectUid = draftDetail.projectUid.trim() || options.fallbackProjectUid?.trim() || '';
  const moduleUid = draftDetail.moduleUid.trim() || options.fallbackModuleUid?.trim() || '';

  return {
    input: inputText,
    targetUrl: draftDetail.targetUrl.trim() || draftDetail.targetUrlHint.trim(),
    projectUid: projectUid || undefined,
    moduleUid: moduleUid || undefined,
    intentDraftUid: draftDetail.intentDraftUid.trim() || undefined,
    prefilledScenarioCard: draftDetail.scenarioCard || undefined,
    prefilledScenarioLlmMeta: Object.keys(draftDetail.scenarioLlmMeta || {}).length > 0 ? draftDetail.scenarioLlmMeta : undefined,
    prefilledPlanCode: draftDetail.planCode.trim() ? draftDetail.planCode : undefined,
    attachments: draftDetail.attachments.map((item) => ({
      name: item.name,
      dataUrl: item.dataUrl,
      purpose: item.purpose,
    })),
    llmConfig: options.llmConfig
      ? {
          provider: options.llmConfig.provider,
          model: options.llmConfig.model.trim(),
          baseUrl: options.llmConfig.baseUrl.trim(),
          apiStyle: options.llmConfig.apiStyle,
          visionEnabled: options.llmConfig.visionEnabled,
          selfHealRetries: options.llmConfig.selfHealRetries,
          maxPlanSteps: options.llmConfig.maxPlanSteps,
        }
      : undefined,
  };
}

async function fetchProjectKnowledgeDraftPreview(
  options: ProjectKnowledgeDraftRequestOptions
): Promise<IntentProjectKnowledgeDraft> {
  const search = new URLSearchParams({
    minSeenCount: String(options.minSeenCount),
    minResolvedCount: String(options.minResolvedCount),
    maxCandidates: String(options.maxCandidates),
  });
  if (options.projectUid?.trim()) {
    search.set('projectUid', options.projectUid.trim());
  }
  if (options.moduleUid?.trim()) {
    search.set('moduleUid', options.moduleUid.trim());
  }
  const res = await fetch(`/api/intent-e2e/project-knowledge/draft?${search.toString()}`, {
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as ProjectKnowledgeDraftResponse | null;

  if (!res.ok || !json?.draft) {
    throw new Error(json?.error || '预览项目知识草稿失败');
  }

  return json.draft;
}

async function writeProjectKnowledgeDraftFromWorkbench(
  options: ProjectKnowledgeDraftRequestOptions
): Promise<{ draft: IntentProjectKnowledgeDraft; writtenTo: string | null }> {
  const res = await fetch('/api/intent-e2e/project-knowledge/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...options, write: true }),
  });
  const json = (await res.json().catch(() => null)) as ProjectKnowledgeDraftResponse | null;

  if (!res.ok || !json?.draft) {
    throw new Error(json?.error || '写出项目知识草稿失败');
  }

  return {
    draft: json.draft,
    writtenTo: json.writtenTo || null,
  };
}

async function mergeProjectKnowledgeFromWorkbench(
  options: ProjectKnowledgeDraftRequestOptions & {
    candidateIds: string[];
    overrideCandidateIds?: string[];
    acknowledgedRiskCandidateIds?: string[];
    projectUid?: string;
    moduleUid?: string;
  }
): Promise<ProjectKnowledgeMergeResponse> {
  const res = await fetch('/api/intent-e2e/project-knowledge/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  const json = (await res.json().catch(() => null)) as ProjectKnowledgeMergeRouteResponse | null;

  if (!res.ok || !json?.draft || !json?.mergedTo) {
    throw new ProjectKnowledgeMergeError(json?.error || '合并项目知识规则失败', json || undefined);
  }

  return json as ProjectKnowledgeMergeResponse;
}

async function fetchProjectKnowledgeBackups(limit = 12): Promise<ProjectKnowledgeBackupsResponse> {
  const search = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`/api/intent-e2e/project-knowledge/backups?${search.toString()}`, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as ProjectKnowledgeBackupsResponse | { error?: string } | null;

  if (!res.ok || !json || !('backups' in json)) {
    throw new Error((json as { error?: string } | null)?.error || '读取项目知识备份列表失败');
  }

  return json as ProjectKnowledgeBackupsResponse;
}

async function fetchProjectKnowledgeAudits(limit = 12, projectUid = ''): Promise<ProjectKnowledgeAuditsResponse> {
  const search = new URLSearchParams({ limit: String(limit) });
  if (projectUid.trim()) {
    search.set('projectUid', projectUid.trim());
  }

  const res = await fetch(`/api/intent-e2e/project-knowledge/audits?${search.toString()}`, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as ProjectKnowledgeAuditsResponse | { error?: string } | null;

  if (!res.ok || !json || !('items' in json)) {
    throw new Error((json as { error?: string } | null)?.error || '读取项目知识审计失败');
  }

  return json as ProjectKnowledgeAuditsResponse;
}

async function fetchIntentE2EInsights(projectUid = '', runLimit = 50, auditLimit = 12): Promise<IntentE2EInsightsResponse> {
  const search = new URLSearchParams({
    runLimit: String(runLimit),
    auditLimit: String(auditLimit),
  });
  if (projectUid.trim()) {
    search.set('projectUid', projectUid.trim());
  }

  const res = await fetch(`/api/intent-e2e/insights?${search.toString()}`, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as IntentE2EInsightsResponse | { error?: string } | null;

  if (!res.ok || !json || !('summary' in json)) {
    throw new Error((json as { error?: string } | null)?.error || '读取意图执行洞察失败');
  }

  return json as IntentE2EInsightsResponse;
}

async function fetchIntentE2EReleaseStatus(projectUid = ''): Promise<IntentE2EReleaseStatusResponse> {
  const search = new URLSearchParams({
    requireCurrentCompare: '1',
  });
  if (projectUid.trim()) {
    search.set('projectUid', projectUid.trim());
  }

  const res = await fetch(`/api/intent-e2e/release-status?${search.toString()}`, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as IntentE2EReleaseStatusResponse | { error?: string } | null;

  if (!res.ok || !json || !('status' in json)) {
    throw new Error((json as { error?: string } | null)?.error || '读取发布状态失败');
  }

  return json as IntentE2EReleaseStatusResponse;
}

async function restoreProjectKnowledgeBackupFromWorkbench(
  backupPath: string,
  projectUid = ''
): Promise<ProjectKnowledgeRestoreResponse> {
  const res = await fetch('/api/intent-e2e/project-knowledge/backups/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ backupPath, projectUid: projectUid.trim() || undefined }),
  });
  const json = (await res.json().catch(() => null)) as ProjectKnowledgeRestoreResponse | { error?: string } | null;

  if (!res.ok || !json || !('restoredFrom' in json)) {
    throw new Error((json as { error?: string } | null)?.error || '恢复项目知识备份失败');
  }

  return json as ProjectKnowledgeRestoreResponse;
}

async function fetchWorkspaceProjects(): Promise<WorkspaceProjectOption[]> {
  const res = await fetch('/api/projects?page=1&pageSize=100&status=active', { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as WorkspaceProjectsResponse | null;

  if (!res.ok || !json?.items) {
    throw new Error(json?.error || '加载项目列表失败');
  }

  return json.items;
}

async function fetchWorkspaceModules(projectUid: string): Promise<WorkspaceModuleOption[]> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectUid)}/modules?status=active`, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as WorkspaceModulesResponse | null;

  if (!res.ok || !json?.items) {
    throw new Error(json?.error || '加载模块列表失败');
  }

  return json.items;
}

async function fetchWorkspaceTasks(projectUid: string, moduleUid: string): Promise<WorkspaceTaskOption[]> {
  const search = new URLSearchParams({
    projectUid,
    moduleUid,
    page: '1',
    pageSize: '100',
    status: 'active',
  });
  const res = await fetch(`/api/test-configs?${search.toString()}`, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as WorkspaceTasksResponse | null;

  if (!res.ok || !json?.items) {
    throw new Error(json?.error || '加载任务列表失败');
  }

  return json.items;
}

async function fetchProjectAuthSummary(projectUid: string): Promise<ProjectAuthSummary> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectUid)}`, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as ProjectAuthSummaryResponse | null;

  if (!res.ok || !json?.item) {
    throw new Error(json?.error || '加载项目认证摘要失败');
  }

  return {
    projectUid: typeof json.item.projectUid === 'string' ? json.item.projectUid : projectUid,
    projectName: typeof json.item.name === 'string' ? json.item.name : '',
    authRequired: Boolean(json.item.authRequired),
    loginUrl: typeof json.item.loginUrl === 'string' ? json.item.loginUrl : '',
    loginUsername: typeof json.item.loginUsername === 'string' ? json.item.loginUsername : '',
    loginDescription: typeof json.item.loginDescription === 'string' ? json.item.loginDescription : '',
  };
}

async function persistIntentRunToWorkspaceRequest(
  runId: string,
  payload: {
    projectUid: string;
    moduleUid: string;
    configUid?: string;
    taskName?: string;
    auth?: AuthDraft;
  }
): Promise<WorkspacePersistItem> {
  const res = await fetch(`/api/intent-e2e/runs/${encodeURIComponent(runId)}/workspace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => null)) as PersistIntentRunToWorkspaceResponse | null;

  if (!res.ok || !json?.item) {
    throw new Error(json?.error || '保存到项目工作台失败');
  }

  return json.item;
}

export default function IntentE2EWorkbench({
  embedded = false,
  initialWorkspaceProjectUid = '',
  initialWorkspaceModuleUid = '',
  embeddedProjectAuth,
  onClose,
}: IntentE2EWorkbenchProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchWorkspaceProjectUid = searchParams.get('projectUid') || '';
  const searchWorkspaceModuleUid = searchParams.get('moduleUid') || '';
  const searchIntentDraftUid = searchParams.get('draftUid') || '';
  const searchRequestedRunId = searchParams.get('runId') || '';
  const searchDraftLaunchMode = normalizeIntentDraftLaunchMode(searchParams.get(INTENT_DRAFT_LAUNCH_QUERY_PARAM));
  const searchLaunchDecision = searchParams.get('launchDecision') || '';
  const searchLaunchReasons = useMemo(
    () => uniqueStrings(searchParams.getAll('launchReason')),
    [searchParams]
  );
  const launchedFromIntentDraft = Boolean(searchWorkspaceProjectUid.trim() && searchIntentDraftUid.trim());
  const collapsePreferenceContextKey = embedded
    ? 'embedded'
    : launchedFromIntentDraft
      ? `draft:${searchWorkspaceProjectUid.trim()}:${searchIntentDraftUid.trim()}`
      : 'standalone';
  const defaultWorkspaceProjectUid = initialWorkspaceProjectUid || searchWorkspaceProjectUid;
  const defaultWorkspaceModuleUid = initialWorkspaceModuleUid || searchWorkspaceModuleUid;
  const [input, setInput] = useState('访问结算页，输入一个合法手机号并提交，最终看到成功页面。');
  const [targetUrl, setTargetUrl] = useState('');
  const [auth, setAuth] = useState<AuthDraft>(defaultAuth);
  const [projectAuthSummary, setProjectAuthSummary] = useState<ProjectAuthSummary | null>(null);
  const [projectAuthSummaryLoading, setProjectAuthSummaryLoading] = useState(false);
  const [projectAuthSummaryError, setProjectAuthSummaryError] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [configResponse, setConfigResponse] = useState<LLMConfigResponse | null>(null);
  const [llmConfig, setLlmConfig] = useState<LLMConfigDraft>(defaultLlmConfigDraft);
  const providerOptions = useMemo(() => getLlmProviderOptions(configResponse), [configResponse]);
  const [running, setRunning] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [runError, setRunError] = useState('');
  const [restoreNotice, setRestoreNotice] = useState('');
  const [launchDecisionResult, setLaunchDecisionResult] = useState<IntentBlockedLaunchDecision | null>(null);
  const [result, setResult] = useState<IntentRunResult | null>(null);
  const [streamState, setStreamState] = useState<StreamState>(() => createEmptyStreamState());
  const [activeRunId, setActiveRunId] = useState('');
  const [workbenchCollapsed, setWorkbenchCollapsed] = useState(false);
  const [restoreChecked, setRestoreChecked] = useState(false);
  const [draftLaunchHydratedKey, setDraftLaunchHydratedKey] = useState('');
  const [knowledgeDraftMinSeenCount, setKnowledgeDraftMinSeenCount] = useState(2);
  const [knowledgeDraftMinResolvedCount, setKnowledgeDraftMinResolvedCount] = useState(1);
  const [knowledgeDraftMaxCandidates, setKnowledgeDraftMaxCandidates] = useState(12);
  const [knowledgeDraftLoading, setKnowledgeDraftLoading] = useState(false);
  const [knowledgeDraftWriting, setKnowledgeDraftWriting] = useState(false);
  const [knowledgeDraftMerging, setKnowledgeDraftMerging] = useState(false);
  const [knowledgeDraftError, setKnowledgeDraftError] = useState('');
  const [knowledgeDraftPreview, setKnowledgeDraftPreview] = useState<IntentProjectKnowledgeDraft | null>(null);
  const [knowledgeDraftSelectedCandidateIds, setKnowledgeDraftSelectedCandidateIds] = useState<string[]>([]);
  const [knowledgeDraftWrittenTo, setKnowledgeDraftWrittenTo] = useState('');
  const [knowledgeDraftMergedTo, setKnowledgeDraftMergedTo] = useState('');
  const [knowledgeDraftMergeBackupPath, setKnowledgeDraftMergeBackupPath] = useState('');
  const [knowledgeDraftMergeDiffPreview, setKnowledgeDraftMergeDiffPreview] = useState('');
  const [knowledgeChangeOperation, setKnowledgeChangeOperation] = useState<'merge' | 'restore' | ''>('');
  const [knowledgeChangeComparison, setKnowledgeChangeComparison] = useState<ProjectKnowledgeProfileComparison | null>(null);
  const [knowledgeMergeSelectionSummary, setKnowledgeMergeSelectionSummary] = useState<ProjectKnowledgeMergeSelectionSummary | null>(null);
  const [knowledgeMergePreflightSummary, setKnowledgeMergePreflightSummary] = useState<ProjectKnowledgeMergePreflightSummary | null>(null);
  const [knowledgeMergeReceipts, setKnowledgeMergeReceipts] = useState<ProjectKnowledgeMergeNotice[]>([]);
  const [knowledgeAuditWarning, setKnowledgeAuditWarning] = useState('');
  const [knowledgeOverrideWarning, setKnowledgeOverrideWarning] = useState('');
  const [knowledgeRiskAcknowledgementWarning, setKnowledgeRiskAcknowledgementWarning] = useState('');
  const [knowledgeGuardrailWarning, setKnowledgeGuardrailWarning] = useState('');
  const [knowledgeBackupsLoading, setKnowledgeBackupsLoading] = useState(false);
  const [knowledgeBackupRestoring, setKnowledgeBackupRestoring] = useState(false);
  const [knowledgeAuditsLoading, setKnowledgeAuditsLoading] = useState(false);
  const [knowledgeBackupDir, setKnowledgeBackupDir] = useState('');
  const [knowledgeBackups, setKnowledgeBackups] = useState<ProjectKnowledgeBackupItem[]>([]);
  const [knowledgeAuditPath, setKnowledgeAuditPath] = useState('');
  const [knowledgeAudits, setKnowledgeAudits] = useState<ProjectKnowledgeAuditItem[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [insights, setInsights] = useState<IntentE2EInsightsResponse | null>(null);
  const [releaseStatusLoading, setReleaseStatusLoading] = useState(false);
  const [releaseStatusError, setReleaseStatusError] = useState('');
  const [releaseStatus, setReleaseStatus] = useState<IntentE2EReleaseStatusResponse | null>(null);
  const [insightsView, setInsightsView] = useState<InsightWorkbenchView>('overview');
  const [railView, setRailView] = useState<WorkbenchRailView>('live');
  const [detailView, setDetailView] = useState<WorkbenchDetailView>('scenario');
  const [inputHelpOpen, setInputHelpOpen] = useState(false);
  const [executionDetailsModalOpen, setExecutionDetailsModalOpen] = useState(false);
  const [attemptDetailAttemptNumber, setAttemptDetailAttemptNumber] = useState<number | null>(null);
  const [contextPortalHost, setContextPortalHost] = useState<HTMLDivElement | null>(null);
  const [governancePortalHost, setGovernancePortalHost] = useState<HTMLDivElement | null>(null);
  const [knowledgeRestoredFrom, setKnowledgeRestoredFrom] = useState('');
  const [knowledgeRestoreBackupCreated, setKnowledgeRestoreBackupCreated] = useState('');
  const [workspaceProjects, setWorkspaceProjects] = useState<WorkspaceProjectOption[]>([]);
  const [workspaceModules, setWorkspaceModules] = useState<WorkspaceModuleOption[]>([]);
  const [workspaceTasks, setWorkspaceTasks] = useState<WorkspaceTaskOption[]>([]);
  const [workspaceProjectUid, setWorkspaceProjectUid] = useState(() => defaultWorkspaceProjectUid);
  const [workspaceModuleUid, setWorkspaceModuleUid] = useState(() => defaultWorkspaceModuleUid);
  const [workspaceConfigUid, setWorkspaceConfigUid] = useState('');
  const [workspaceTaskName, setWorkspaceTaskName] = useState('');
  const [workspaceSaveMode, setWorkspaceSaveMode] = useState<WorkspaceSaveMode>('new');
  const [workspaceLoadingProjects, setWorkspaceLoadingProjects] = useState(false);
  const [workspaceLoadingModules, setWorkspaceLoadingModules] = useState(false);
  const [workspaceLoadingTasks, setWorkspaceLoadingTasks] = useState(false);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceLoadError, setWorkspaceLoadError] = useState('');
  const [workspaceSaveError, setWorkspaceSaveError] = useState('');
  const [workspaceSaveResult, setWorkspaceSaveResult] = useState<WorkspacePersistItem | null>(null);
  const [starterCapabilitySelectedAssetSlugs, setStarterCapabilitySelectedAssetSlugs] = useState<string[]>([]);
  const [starterCapabilitySaving, setStarterCapabilitySaving] = useState(false);
  const [starterCapabilitySaveError, setStarterCapabilitySaveError] = useState('');
  const [starterCapabilitySaveNotice, setStarterCapabilitySaveNotice] = useState('');
  const [playbookPromotionSaving, setPlaybookPromotionSaving] = useState(false);
  const [playbookPromotionError, setPlaybookPromotionError] = useState('');
  const [playbookPromotionNotice, setPlaybookPromotionNotice] = useState('');
  const streamAbortRef = useRef<AbortController | null>(null);
  const workspaceTaskNamePrefillRunIdRef = useRef('');
  const launchFormHydratedRunIdRef = useRef('');
  const launchFormHydratedDraftKeyRef = useRef('');
  const launchLlmOverrideRef = useRef<IntentLaunchLlmOverride | null>(null);
  const draftLaunchDetailRef = useRef<IntentDraftLaunchDetail | null>(null);
  const draftAutoLaunchHandledKeyRef = useRef('');
  const draftAutoLaunchPendingKeyRef = useRef('');
  const draftAutoLaunchRequestSeqRef = useRef(0);
  const workbenchMountedRef = useRef(true);
  const inputHelpPopoverRef = useRef<HTMLDivElement | null>(null);
  const collapseContextRef = useRef('');
  const workspaceSaveNavigation = useMemo(
    () => (workspaceSaveResult ? readExecutionEntryNavigationTargets(workspaceSaveResult) : null),
    [workspaceSaveResult]
  );

  const displayScenarioCard = result?.scenarioCard ?? streamState.scenarioCard;
  const displayExecutionPlan = result?.executionPlan ?? null;
  const displayVerificationPlan = result?.verificationPlan ?? null;
  const displayCompiledTemplate = result?.compiledTemplate ?? null;
  const displayDescription = result?.description ?? streamState.description;
  const displayAttempts = result?.attempts ?? streamState.attempts;
  const displayFinalResult = result?.finalResult ?? streamState.finalResult;
  const displayFinalFailureTriage = result?.finalFailureTriage ?? streamState.finalFailureTriage;
  const displayLaunchDecision =
    launchDecisionResult && isBlockedIntentLaunchDecision(launchDecisionResult.decision) ? launchDecisionResult : null;
  const hasBlockedLaunchDecision = Boolean(displayLaunchDecision);
  const displayTerminalStatus = displayFinalResult
    ? displayFinalResult.success
      ? 'passed'
      : streamState.stage === 'canceled'
        ? 'canceled'
        : 'failed'
    : null;
  const displayQualitySplit = useMemo(
    () =>
      displayTerminalStatus
        ? normalizeIntentQualitySplit(result?.qualitySplit, {
            status: displayTerminalStatus,
            failureClass: displayFinalFailureTriage?.failureClass,
          })
        : null,
    [displayFinalFailureTriage?.failureClass, displayTerminalStatus, result?.qualitySplit]
  );
  const displayFailureDiagnosis = displayFinalFailureTriage?.diagnosis || null;
  const displayLlmMeta = result?.llmMeta ?? streamState.llmMeta;
  const displayKnowledge = result?.knowledge ?? null;
  const displayExperience = result?.experience ?? null;
  const displayAssetReadiness = result?.assetReadiness ?? null;
  const displayRepairBudget = !displayFinalResult?.success ? result?.repairBudget ?? null : null;
  const displayFailureCta = !displayFinalResult?.success ? result?.failureCta ?? null : null;
  const displayReview = result?.review ?? null;
  const displayBlockedReasonLabels = useMemo(
    () =>
      uniqueStrings(
        (displayLaunchDecision?.assetAvailability?.reasons?.length
          ? displayLaunchDecision.assetAvailability.reasons
          : displayLaunchDecision?.reasons || []
        ).map((item) => intentLaunchDecisionReasonLabel(item))
      ),
    [displayLaunchDecision]
  );
  const blockedProjectUid =
    displayLaunchDecision?.signals?.projectUid ||
    displayLaunchDecision?.assetAvailability?.projectUid ||
    workspaceProjectUid ||
    searchWorkspaceProjectUid.trim();
  const failureProjectUid = displayAssetReadiness?.projectUid || workspaceProjectUid || searchWorkspaceProjectUid.trim();
  const playbookPromotionProjectUid =
    workspaceProjectUid.trim() ||
    searchWorkspaceProjectUid.trim() ||
    displayAssetReadiness?.projectUid ||
    displayLaunchDecision?.signals?.projectUid ||
    '';
  const projectReturnHref = useMemo(() => {
    const sourceProjectUid = searchWorkspaceProjectUid.trim() || initialWorkspaceProjectUid.trim();
    const sourceModuleUid = searchWorkspaceModuleUid.trim() || initialWorkspaceModuleUid.trim();
    if (sourceProjectUid) {
      return buildWorkspaceProjectPath({
        projectUid: sourceProjectUid,
        moduleUid: sourceModuleUid || undefined,
      });
    }

    const currentProjectUid = workspaceProjectUid.trim();
    if (currentProjectUid) {
      return buildWorkspaceProjectPath({
        projectUid: currentProjectUid,
        moduleUid: workspaceModuleUid.trim() || undefined,
      });
    }

    const savedWorkspacePath = workspaceSaveNavigation?.workspacePath.trim() || '';
    if (savedWorkspacePath) {
      return savedWorkspacePath;
    }

    if (blockedProjectUid) {
      return buildWorkspaceProjectPath({ projectUid: blockedProjectUid });
    }

    if (failureProjectUid) {
      return buildWorkspaceProjectPath({ projectUid: failureProjectUid });
    }

    return '/intent-e2e';
  }, [
    blockedProjectUid,
    failureProjectUid,
    initialWorkspaceModuleUid,
    initialWorkspaceProjectUid,
    searchWorkspaceModuleUid,
    searchWorkspaceProjectUid,
    workspaceModuleUid,
    workspaceProjectUid,
    workspaceSaveNavigation,
  ]);
  const standaloneProjectAuthProjectUid = !embedded
    ? defaultWorkspaceProjectUid.trim() ||
      displayAssetReadiness?.projectUid ||
      workspaceProjectUid.trim() ||
      searchWorkspaceProjectUid.trim()
    : '';
  const activeProjectAuthSummary =
    projectAuthSummary && projectAuthSummary.projectUid === standaloneProjectAuthProjectUid ? projectAuthSummary : null;
  const standaloneHasProjectContext = Boolean(!embedded && standaloneProjectAuthProjectUid);
  const standaloneProjectAuthLoadingState = standaloneHasProjectContext && projectAuthSummaryLoading;
  const standaloneUsesProjectAuth = !embedded && Boolean(activeProjectAuthSummary?.authRequired);
  const standaloneProjectAuthProjectLabel =
    activeProjectAuthSummary?.projectName.trim() || standaloneProjectAuthProjectUid || '当前项目';
  const standaloneAuthSummaryText = embedded
    ? embeddedProjectAuth?.authRequired
      ? '复用项目统一认证'
      : '未配置项目认证'
    : standaloneProjectAuthLoadingState
      ? '正在同步项目认证'
      : standaloneHasProjectContext && projectAuthSummaryError
        ? '认证摘要读取失败'
      : standaloneUsesProjectAuth
        ? '复用项目统一认证'
        : hasAuthContent(auth)
          ? '已补登录信息'
          : standaloneHasProjectContext && activeProjectAuthSummary
            ? '未配置项目认证'
            : '暂未补登录';
  const standaloneAuthDetailText = embedded
    ? '统一项目认证'
    : standaloneProjectAuthLoadingState
      ? '正在读取项目登录摘要'
      : standaloneHasProjectContext && projectAuthSummaryError
        ? '查看执行上下文面板'
      : standaloneUsesProjectAuth
        ? activeProjectAuthSummary?.loginDescription?.trim()
          ? '项目登录说明已同步'
          : activeProjectAuthSummary?.loginUrl?.trim()
            ? '项目登录地址已同步'
            : '执行时默认带入项目认证'
        : auth.loginUrl.trim()
          ? '登录 URL 已填'
          : standaloneHasProjectContext && activeProjectAuthSummary
            ? '需要时可手动补充'
            : '需要时再补';
  const standaloneContextDescription = embedded
    ? '查看项目统一认证，并根据需要补充模型执行参数。'
    : standaloneUsesProjectAuth
      ? '当前运行默认复用项目统一认证；如需临时覆盖，可在下方补充本次运行的登录信息。'
      : '控制登录、模型与执行边界，避免“能跑但不稳”。';
  const standaloneContextAuthLabel = embedded
    ? embeddedProjectAuth?.authRequired
      ? '项目认证'
      : '未配认证'
    : standaloneProjectAuthLoadingState
      ? '认证加载中'
      : standaloneHasProjectContext && projectAuthSummaryError
        ? '摘要失败'
      : standaloneUsesProjectAuth
        ? '项目认证'
        : hasAuthContent(auth)
          ? '登录已填'
          : standaloneHasProjectContext && activeProjectAuthSummary
            ? '未配认证'
            : '登录留空';
  const displayTargetUrl = result?.targetUrl ?? streamState.targetUrl;
  const displayResolvedUrls = result?.resolvedUrls ?? streamState.resolvedUrls;
  const browserAttempt = [...displayAttempts].reverse().find((attempt) => Boolean(attempt.sessionId)) || null;
  const browserSessionId = browserAttempt?.sessionId || '';
  const currentStageText = streamState.message || STAGE_COPY[streamState.stage];
  const showCanceledState = !running && streamState.stage === 'canceled' && !displayFinalResult;
  const finalAttempt = displayAttempts[displayAttempts.length - 1] || null;
  const attemptDetailAttempt = useMemo(
    () => (attemptDetailAttemptNumber === null ? null : displayAttempts.find((attempt) => attempt.attempt === attemptDetailAttemptNumber) || null),
    [attemptDetailAttemptNumber, displayAttempts]
  );
  const finalStats = useMemo(() => (displayFinalResult ? countByStatus(displayFinalResult) : null), [displayFinalResult]);
  const displayUsedHelpers = useMemo(
    () => uniqueStrings(displayAttempts.flatMap((attempt) => attempt.helperUsage?.usedHelpers || [])),
    [displayAttempts]
  );
  const displayUsedSuggestedHelpers = useMemo(
    () => uniqueStrings(displayAttempts.flatMap((attempt) => attempt.helperUsage?.usedSuggestedHelpers || [])),
    [displayAttempts]
  );
  const starterHelperFailureSummary = useMemo(
    () =>
      insights?.starterHelperFailurePressureSummary
        ? normalizeIntentVerificationFailurePressureViewSummary(insights.starterHelperFailurePressureSummary)
        : summarizeIntentVerificationFailurePressureViewSummaryFromItems(insights?.starterHelpers || [], {
            itemKind: 'helper',
          }),
    [insights?.starterHelperFailurePressureSummary, insights?.starterHelpers]
  );
  const overallFailurePressureSummary = useMemo(
    () =>
      insights?.failurePressureSummary
        ? normalizeIntentVerificationFailurePressureViewSummary(insights.failurePressureSummary)
        : summarizeIntentVerificationFailurePressureViewSummaryFromItems(
            [...(insights?.starterHelpers || []), ...(insights?.suppressedStarterHelpers || [])],
            { itemKind: 'helper' }
          ),
    [insights?.failurePressureSummary, insights?.starterHelpers, insights?.suppressedStarterHelpers]
  );
  const suppressedStarterHelperFailureSummary = useMemo(
    () =>
      insights?.suppressedStarterHelperFailurePressureSummary
        ? normalizeIntentVerificationFailurePressureViewSummary(insights.suppressedStarterHelperFailurePressureSummary)
        : summarizeIntentVerificationFailurePressureViewSummaryFromItems(insights?.suppressedStarterHelpers || [], {
            itemKind: 'helper',
          }),
    [insights?.suppressedStarterHelperFailurePressureSummary, insights?.suppressedStarterHelpers]
  );
  const promotionCoverageSummary = useMemo(
    () =>
      insights
        ? buildIntentE2EPromotionCoverageSummary({
            starterHelpers: insights.starterHelpers,
            suppressedStarterHelpers: insights.suppressedStarterHelpers,
            knowledgeChangeRuleSummaries: insights.knowledgeChangeRuleSummaries,
          })
        : null,
    [insights]
  );
  const suppressedStarterHelperGovernanceSummary = useMemo(
    () =>
      insights?.suppressedStarterHelperGovernanceSummary || {
        helperCount: (insights?.suppressedStarterHelpers || []).filter((item) => (item.governanceTargetCapabilityCount || 0) > 0).length,
        capabilityCount: (insights?.suppressedStarterHelpers || []).reduce(
          (sum, item) => sum + (item.governanceTargetCapabilityCount || 0),
          0
        ),
        recentReviewExecutionCount: (insights?.suppressedStarterHelpers || []).reduce(
          (sum, item) => sum + (item.recentGovernanceReviewExecutionCount || 0),
          0
        ),
        recentPassedReviewExecutionCount: (insights?.suppressedStarterHelpers || []).reduce(
          (sum, item) => sum + (item.recentPassedGovernanceReviewExecutionCount || 0),
          0
        ),
        recentFailedReviewExecutionCount: (insights?.suppressedStarterHelpers || []).reduce(
          (sum, item) => sum + (item.recentFailedGovernanceReviewExecutionCount || 0),
          0
        ),
        latestReviewExecutionAt: '',
        recentVerifyExecutionCount: (insights?.suppressedStarterHelpers || []).reduce(
          (sum, item) => sum + (item.recentGovernanceVerifyExecutionCount || 0),
          0
        ),
        recentPassedVerifyExecutionCount: (insights?.suppressedStarterHelpers || []).reduce(
          (sum, item) => sum + (item.recentPassedGovernanceVerifyExecutionCount || 0),
          0
        ),
        recentFailedVerifyExecutionCount: (insights?.suppressedStarterHelpers || []).reduce(
          (sum, item) => sum + (item.recentFailedGovernanceVerifyExecutionCount || 0),
          0
        ),
        latestVerifyExecutionAt: '',
        recentRepairExecutionCount: (insights?.suppressedStarterHelpers || []).reduce(
          (sum, item) => sum + (item.recentGovernanceRepairExecutionCount || 0),
          0
        ),
        recentPassedRepairExecutionCount: (insights?.suppressedStarterHelpers || []).reduce(
          (sum, item) => sum + (item.recentPassedGovernanceRepairExecutionCount || 0),
          0
        ),
        recentFailedRepairExecutionCount: (insights?.suppressedStarterHelpers || []).reduce(
          (sum, item) => sum + (item.recentFailedGovernanceRepairExecutionCount || 0),
          0
        ),
        latestRepairExecutionAt: '',
      },
    [insights?.suppressedStarterHelperGovernanceSummary, insights?.suppressedStarterHelpers]
  );
  const insightWorkbenchTabs = useMemo<InsightWorkbenchTab[]>(
    () =>
      insights
        ? [
            {
              key: 'overview',
              label: '总览',
              description: '先看能否继续放量，再集中处理 watchlist、评测候选和整体失败模式。',
              countLabel: `${
                insights.regressionWatchlist.items.length + insights.rolloutStrategy.gates.length + insights.failureTraceGovernance.items.length
              } 项决策`,
            },
            {
              key: 'quality',
              label: '质量',
              description: '拆开首轮、修复、review / verify 和场景族目标，单独判断 through rate。',
              countLabel: `${
                insights.verificationIntents.filter((item) => item.totalRuns > 0).length + insights.scenarioFamilySlo.items.length
              } 组质量项`,
            },
            {
              key: 'trace',
              label: 'Trace',
              description: '直接回看最近真实运行的 helper、signals、verifier 和 repair 轨迹。',
              countLabel: `${insights.recentTraces.length} 条 trace`,
            },
            {
              key: 'governance',
              label: '治理',
              description: '统一看观察期、回滚候选、provenance 和风险生命周期，避免上下跳着找。',
              countLabel: `${
                insights.probationRules.length + insights.rollbackCandidates.length + insights.riskLifecycleRules.length
              } 个治理对象`,
            },
            {
              key: 'knowledge',
              label: '知识',
              description: '集中看规则效果、Starter 资产和被压制 helper 的恢复进度。',
              countLabel: `${
                insights.knowledgeChangeRuleSummaries.length +
                insights.starterHelpers.length +
                insights.suppressedStarterHelpers.length
              } 条规则/资产`,
            },
          ]
        : [
            { key: 'overview', label: '总览', description: '等待洞察数据。', countLabel: '等待数据' },
            { key: 'quality', label: '质量', description: '等待洞察数据。', countLabel: '等待数据' },
            { key: 'trace', label: 'Trace', description: '等待洞察数据。', countLabel: '等待数据' },
            { key: 'governance', label: '治理', description: '等待洞察数据。', countLabel: '等待数据' },
            { key: 'knowledge', label: '知识', description: '等待洞察数据。', countLabel: '等待数据' },
          ],
    [insights]
  );
  const activeInsightWorkbenchTab =
    insightWorkbenchTabs.find((item) => item.key === insightsView) ?? insightWorkbenchTabs[0];
  const heroSummaryCards = useMemo(
    () => [
      {
        key: 'entry',
        label: '入口 / 图片',
        summary: targetUrl.trim() ? '已填入口 URL' : '由 AI 推断入口',
        detail: `图片 ${attachments.length} 张 · Vision ${llmConfig.visionEnabled ? '开' : '关'}`,
      },
      {
        key: 'auth',
        label: '登录上下文',
        summary: standaloneAuthSummaryText,
        detail: standaloneAuthDetailText,
      },
      {
        key: 'learning',
        label: '学习信号',
        summary: insights
          ? `${insights.summary.totalRuns} 次历史运行`
          : insightsLoading
            ? '洞察加载中'
            : insightsError
              ? '洞察加载失败'
              : '洞察数据待加载',
        detail: insightsError
            ? '请稍后重试'
            : knowledgeDraftPreview
            ? `候选 ${knowledgeDraftPreview.candidates.length} 条`
            : '等待治理与知识沉淀',
      },
    ],
    [
      attachments.length,
      insights,
      insightsError,
      insightsLoading,
      knowledgeDraftPreview,
      llmConfig.visionEnabled,
      standaloneAuthDetailText,
      standaloneAuthSummaryText,
      targetUrl,
    ]
  );
  const insightDecisionSignals = useMemo(
    () =>
      insights
        ? [
            {
              key: 'rollout',
              title: '放量阶段',
              value: rolloutStrategyStageLabel(insights.rolloutStrategy.recommendedStage),
              detail: `阻断 ${insights.rolloutStrategy.blockedCount} · 观察 ${insights.rolloutStrategy.warningCount} · 通过 ${insights.rolloutStrategy.readyCount}`,
              toneClassName: rolloutStrategyStageTone(insights.rolloutStrategy.recommendedStage),
            },
            {
              key: 'watchlist',
              title: '回归观察',
              value:
                insights.regressionWatchlist.highSeverityCount > 0
                  ? `${insights.regressionWatchlist.highSeverityCount} 个高风险`
                  : insights.regressionWatchlist.items.length > 0
                    ? `${insights.regressionWatchlist.items.length} 个观察项`
                    : '暂无告警',
              detail: insights.regressionWatchlist.items[0]?.title || '最近样本未发现必须立刻处理的回归项。',
              toneClassName:
                insights.regressionWatchlist.highSeverityCount > 0
                  ? 'border border-rose-200 bg-rose-50 text-rose-700'
                  : insights.regressionWatchlist.mediumSeverityCount > 0
                    ? 'border border-amber-200 bg-amber-50 text-amber-700'
                    : 'border border-emerald-200 bg-emerald-50 text-emerald-700',
            },
            {
              key: 'failure-trace-governance',
              title: '失败治理',
              value:
                insights.failureTraceGovernance.highSeverityCount > 0
                  ? `${insights.failureTraceGovernance.highSeverityCount} 个高风险`
                  : insights.failureTraceGovernance.items.length > 0
                    ? `${insights.failureTraceGovernance.items.length} 个治理项`
                    : '暂无失败项',
              detail:
                insights.failureTraceGovernance.items[0]?.summary ||
                '最近终态样本没有需要单独提炼的失败 trace。',
              toneClassName:
                insights.failureTraceGovernance.highSeverityCount > 0
                  ? 'border border-rose-200 bg-rose-50 text-rose-700'
                  : insights.failureTraceGovernance.mediumSeverityCount > 0
                    ? 'border border-amber-200 bg-amber-50 text-amber-700'
                    : 'border border-slate-200 bg-slate-50 text-slate-700',
            },
            {
              key: 'rollback',
              title: '回滚状态',
              value: insights.rollbackCandidates.length > 0 ? `${insights.rollbackCandidates.length} 个候选` : '暂无回滚项',
              detail:
                insights.rollbackCandidates[0]?.title ||
                '当前没有需要优先回滚的规则合并，可以继续积累样本。',
              toneClassName:
                insights.rollbackCandidates.length > 0
                  ? 'border border-amber-200 bg-amber-50 text-amber-800'
                  : 'border border-slate-200 bg-slate-50 text-slate-700',
            },
            {
              key: 'asset',
              title: 'Starter 资产',
              value:
                promotionCoverageSummary?.coveredAssetCount || insights.starterHelpers.length > 0
                  ? `${promotionCoverageSummary?.coveredAssetCount || insights.starterHelpers.length} 个可复用资产`
                  : '待积累',
              detail:
                starterHelperFailureSummary.highFailureCandidateCount > 0
                  ? `高频失败 ${starterHelperFailureSummary.highFailureCandidateCount} 个，先治理再放量。`
                  : promotionCoverageSummary?.latestStarterHelper
                    ? `最新沉淀 ${promotionCoverageSummary.latestStarterHelper}`
                    : '优先沉淀稳定 helper，减少首轮脚本脆弱性。',
              toneClassName:
                starterHelperFailureSummary.highFailureCandidateCount > 0
                  ? 'border border-rose-200 bg-rose-50 text-rose-700'
                  : 'border border-sky-200 bg-sky-50 text-sky-700',
            },
            {
              key: 'cold-start',
              title: '冷启动信号',
              value:
                insights.summary.assetMissingRuns > 0
                  ? `${insights.summary.assetMissingRuns} 次缺资产`
                  : insights.summary.noHitRuns > 0
                    ? `${insights.summary.noHitRuns} 次 no-hit`
                    : '资产已就绪',
              detail:
                insights.summary.assetMissingRuns > 0
                  ? `缺资产 ${formatRatePercent(insights.summary.assetMissingRate)} · no-hit ${formatRatePercent(insights.summary.noHitRate)}`
                  : insights.summary.noHitRuns > 0
                    ? `knowledge no-hit ${formatRatePercent(insights.summary.noHitRate)}，优先补项目规则或 onboarding。`
                    : '最近样本里没有新的冷启动缺口进入主失败口径。',
              toneClassName:
                insights.summary.assetMissingRuns > 0
                  ? 'border border-amber-200 bg-amber-50 text-amber-800'
                  : insights.summary.noHitRuns > 0
                    ? 'border border-sky-200 bg-sky-50 text-sky-700'
                    : 'border border-emerald-200 bg-emerald-50 text-emerald-700',
            },
          ]
        : [],
    [insights, promotionCoverageSummary, starterHelperFailureSummary.highFailureCandidateCount]
  );
  const insightPriorityNotes = useMemo(
    () =>
      insights
        ? [
            {
              key: 'rollout',
              label: '放量建议',
              detail: insights.rolloutStrategy.recommendation || insights.rolloutStrategy.summary,
            },
            insights.regressionWatchlist.items[0]
              ? {
                  key: 'watchlist',
                  label: '回归焦点',
                  detail: insights.regressionWatchlist.items[0].recommendation || insights.regressionWatchlist.items[0].summary,
                }
              : null,
            insights.failureTraceGovernance.items[0]
              ? {
                  key: 'failure-trace-governance',
                  label: '失败治理',
                  detail:
                    insights.failureTraceGovernance.items[0].recommendation ||
                    insights.failureTraceGovernance.items[0].summary,
                }
              : null,
            insights.rollbackCandidates[0]
              ? {
                  key: 'rollback',
                  label: '回滚预案',
                  detail: insights.rollbackCandidates[0].recommendation,
                }
              : {
                  key: 'rollback',
                  label: '回滚状态',
                  detail: '当前没有需要优先回滚的规则合并。',
                },
            overallFailurePressureSummary.latestRepairObservationSummary
              ? {
                  key: 'repair',
                  label: '最近修复信号',
                  detail: overallFailurePressureSummary.latestRepairObservationSummary,
                }
              : null,
          ].filter((item): item is { key: string; label: string; detail: string } => Boolean(item))
        : [],
    [insights, overallFailurePressureSummary.latestRepairObservationSummary]
  );
  const starterCapabilitySelectedAssetSlugSet = useMemo(
    () => new Set(starterCapabilitySelectedAssetSlugs),
    [starterCapabilitySelectedAssetSlugs]
  );
  const starterCapabilityLaunches = useMemo(() => {
    if (!displayFinalResult?.success || !displayKnowledge?.starterAssets?.length) return [];

    return displayKnowledge.starterAssets.map((asset) => {
      const promotable = canPromoteIntentStarterAssetToProjectCapability(asset);
      const promotionDecision = buildIntentStarterAssetPromotionDecision(asset);
      const preset = buildIntentStarterCapabilityPreset({
        asset,
        targetUrl: displayTargetUrl,
        description: displayDescription,
        scenario: displayScenarioCard
          ? {
              title: displayScenarioCard.title,
              featureDescription: displayScenarioCard.featureDescription,
              successCriteria: displayScenarioCard.successCriteria,
              flowDefinition: displayScenarioCard.flowDefinition,
            }
          : null,
      });
      const token = promotable && workspaceProjectUid
        ? createIntentCapabilityLaunchToken({
            projectUid: workspaceProjectUid,
            preset,
          })
        : '';

      return {
        asset,
        promotable,
        promotionDecision,
        preset,
        token,
        href: promotable && workspaceProjectUid
          ? buildIntentCapabilityWorkbenchHref({
              projectUid: workspaceProjectUid,
              moduleUid: workspaceModuleUid || undefined,
              token,
            })
          : '',
      };
    });
  }, [
    displayDescription,
    displayFinalResult?.success,
    displayKnowledge?.starterAssets,
    displayScenarioCard,
    displayTargetUrl,
    workspaceModuleUid,
    workspaceProjectUid,
  ]);
  const selectedStarterCapabilityLaunches = useMemo(
    () =>
      starterCapabilityLaunches.filter(
        (launch) => launch.promotable && starterCapabilitySelectedAssetSlugSet.has(launch.asset.assetSlug)
      ),
    [starterCapabilityLaunches, starterCapabilitySelectedAssetSlugSet]
  );
  const promotableStarterCapabilityLaunches = useMemo(
    () => starterCapabilityLaunches.filter((launch) => canPromoteIntentStarterAssetToProjectCapability(launch.asset)),
    [starterCapabilityLaunches]
  );
  const starterCapabilityPromotionSummary = useMemo(
    () => summarizeIntentStarterAssetPromotionDecisions(starterCapabilityLaunches.map((launch) => launch.promotionDecision)),
    [starterCapabilityLaunches]
  );
  const providerIsImplemented = llmConfig.providerImplemented;
  const activeProviderOption = providerOptions.find((option) => option.provider === llmConfig.provider);
  const hasDisplayDetails = Boolean(displayScenarioCard || displayDescription || displayCompiledTemplate || displayAttempts.length > 0);
  const knowledgeDraftBusy = knowledgeDraftLoading || knowledgeDraftWriting || knowledgeDraftMerging || knowledgeBackupsLoading || knowledgeBackupRestoring;
  const knowledgeDraftDisplayCandidates = useMemo(
    () => (knowledgeDraftPreview ? sortKnowledgeDraftCandidates(knowledgeDraftPreview.candidates) : []),
    [knowledgeDraftPreview]
  );
  const knowledgeDraftSelectedCandidateIdSet = useMemo(() => new Set(knowledgeDraftSelectedCandidateIds), [knowledgeDraftSelectedCandidateIds]);
  const knowledgeDraftSelectedCount = useMemo(
    () =>
      knowledgeDraftDisplayCandidates.length > 0
        ? knowledgeDraftDisplayCandidates.filter((candidate) => knowledgeDraftSelectedCandidateIdSet.has(candidate.candidateId)).length
        : 0,
    [knowledgeDraftDisplayCandidates, knowledgeDraftSelectedCandidateIdSet]
  );
  const knowledgeDraftMergeRecommendedCount = useMemo(
    () => knowledgeDraftDisplayCandidates.filter((candidate) => isIntentProjectKnowledgeDraftCandidateMergeRecommended(candidate)).length,
    [knowledgeDraftDisplayCandidates]
  );
  const knowledgeDraftSelectableCount = useMemo(
    () => knowledgeDraftDisplayCandidates.filter((candidate) => isIntentProjectKnowledgeDraftCandidateSelectable(candidate)).length,
    [knowledgeDraftDisplayCandidates]
  );
  const knowledgeDraftDefaultDeferredCount = useMemo(
    () => knowledgeDraftDisplayCandidates.filter((candidate) => isIntentProjectKnowledgeDraftCandidateDeferredByDefault(candidate)).length,
    [knowledgeDraftDisplayCandidates]
  );
  const knowledgeDraftSelectedProbationaryCandidates = useMemo(
    () =>
      knowledgeDraftDisplayCandidates.filter(
        (candidate) => knowledgeDraftSelectedCandidateIdSet.has(candidate.candidateId) && isIntentProjectKnowledgeDraftCandidateProbationary(candidate)
      ),
    [knowledgeDraftDisplayCandidates, knowledgeDraftSelectedCandidateIdSet]
  );
  const knowledgeDraftProbationaryDeferredCount = useMemo(
    () =>
      knowledgeDraftDisplayCandidates.filter(
        (candidate) => !candidate.alreadyCovered && isIntentProjectKnowledgeDraftCandidateProbationary(candidate)
      ).length,
    [knowledgeDraftDisplayCandidates]
  );
  const knowledgeDraftSelectedProbationaryCount = knowledgeDraftSelectedProbationaryCandidates.length;
  const knowledgeDraftSelectedProbationaryCandidateIds = useMemo(
    () => knowledgeDraftSelectedProbationaryCandidates.map((candidate) => candidate.candidateId),
    [knowledgeDraftSelectedProbationaryCandidates]
  );
  const knowledgeDraftSelectedAutoPromoteCount = useMemo(
    () =>
      knowledgeDraftDisplayCandidates.filter(
        (candidate) =>
          knowledgeDraftSelectedCandidateIdSet.has(candidate.candidateId) &&
          candidate.feedback?.lifecyclePolicy === 'auto_promote_candidate'
      ).length,
    [knowledgeDraftDisplayCandidates, knowledgeDraftSelectedCandidateIdSet]
  );
  const knowledgeDraftSelectedObservePolicyCount = useMemo(
    () =>
      knowledgeDraftDisplayCandidates.filter(
        (candidate) =>
          knowledgeDraftSelectedCandidateIdSet.has(candidate.candidateId) && candidate.feedback?.lifecyclePolicy === 'observe'
      ).length,
    [knowledgeDraftDisplayCandidates, knowledgeDraftSelectedCandidateIdSet]
  );
  const knowledgeDraftSelectedBlockDefaultMergeCount = useMemo(
    () =>
      knowledgeDraftDisplayCandidates.filter(
        (candidate) =>
          knowledgeDraftSelectedCandidateIdSet.has(candidate.candidateId) &&
          candidate.feedback?.lifecyclePolicy === 'block_default_merge'
      ).length,
    [knowledgeDraftDisplayCandidates, knowledgeDraftSelectedCandidateIdSet]
  );
  const knowledgeDraftManualReviewCount = useMemo(
    () =>
      knowledgeDraftDisplayCandidates.filter(
        (candidate) => !candidate.alreadyCovered && isIntentProjectKnowledgeDraftCandidateDeprioritized(candidate)
      ).length,
    [knowledgeDraftDisplayCandidates]
  );
  const knowledgeDraftNegativeHistoryDeferredCount = useMemo(
    () =>
      knowledgeDraftDisplayCandidates.filter(
        (candidate) =>
          !candidate.alreadyCovered &&
          isIntentProjectKnowledgeDraftCandidateNegativeHistory(candidate) &&
          !isIntentProjectKnowledgeDraftCandidateProbationary(candidate) &&
          !isIntentProjectKnowledgeDraftCandidateDeprioritized(candidate)
      ).length,
    [knowledgeDraftDisplayCandidates]
  );
  const knowledgeDraftSelectedManualReviewCount = useMemo(
    () =>
      knowledgeDraftDisplayCandidates.filter(
        (candidate) =>
          knowledgeDraftSelectedCandidateIdSet.has(candidate.candidateId) &&
          isIntentProjectKnowledgeDraftCandidateDeprioritized(candidate)
      ).length,
    [knowledgeDraftDisplayCandidates, knowledgeDraftSelectedCandidateIdSet]
  );
  const knowledgeDraftSelectedNegativeHistoryDeferredCount = useMemo(
    () =>
      knowledgeDraftDisplayCandidates.filter(
        (candidate) =>
          knowledgeDraftSelectedCandidateIdSet.has(candidate.candidateId) &&
          isIntentProjectKnowledgeDraftCandidateNegativeHistory(candidate) &&
          !isIntentProjectKnowledgeDraftCandidateProbationary(candidate) &&
          !isIntentProjectKnowledgeDraftCandidateDeprioritized(candidate)
      ).length,
    [knowledgeDraftDisplayCandidates, knowledgeDraftSelectedCandidateIdSet]
  );
  const knowledgeDraftSelectedOverrideCandidateIds = useMemo(
    () =>
      knowledgeDraftDisplayCandidates
        .filter(
          (candidate) =>
            knowledgeDraftSelectedCandidateIdSet.has(candidate.candidateId) &&
            isIntentProjectKnowledgeDraftCandidateDeprioritized(candidate)
        )
        .map((candidate) => candidate.candidateId),
    [knowledgeDraftDisplayCandidates, knowledgeDraftSelectedCandidateIdSet]
  );
  const knowledgeDraftDeferredReasonSummary = useMemo(
    () =>
      [
        knowledgeDraftNegativeHistoryDeferredCount > 0 ? `负向历史证据 ${knowledgeDraftNegativeHistoryDeferredCount} 条` : '',
        knowledgeDraftProbationaryDeferredCount > 0 ? `观察期 ${knowledgeDraftProbationaryDeferredCount} 条` : '',
        knowledgeDraftManualReviewCount > 0 ? `自动降权 ${knowledgeDraftManualReviewCount} 条` : '',
      ]
        .filter(Boolean)
        .join('；'),
    [knowledgeDraftManualReviewCount, knowledgeDraftNegativeHistoryDeferredCount, knowledgeDraftProbationaryDeferredCount]
  );
  const knowledgeDraftSelectedDeferredReasonSummary = useMemo(
    () =>
      [
        knowledgeDraftSelectedNegativeHistoryDeferredCount > 0
          ? `负向历史证据 ${knowledgeDraftSelectedNegativeHistoryDeferredCount} 条`
          : '',
        knowledgeDraftSelectedProbationaryCount > 0 ? `风险确认 ${knowledgeDraftSelectedProbationaryCount} 条` : '',
        knowledgeDraftSelectedManualReviewCount > 0 ? `人工 override ${knowledgeDraftSelectedManualReviewCount} 条` : '',
      ]
        .filter(Boolean)
        .join('；'),
    [
      knowledgeDraftSelectedManualReviewCount,
      knowledgeDraftSelectedNegativeHistoryDeferredCount,
      knowledgeDraftSelectedProbationaryCount,
    ]
  );
  const workspaceSelectedTask = useMemo(
    () => workspaceTasks.find((item) => item.configUid === workspaceConfigUid) || null,
    [workspaceTasks, workspaceConfigUid]
  );
  const workspaceSelectionReady = Boolean(
    activeRunId &&
      displayFinalResult &&
      workspaceProjectUid &&
      workspaceModuleUid &&
      (workspaceSaveMode === 'new' ? workspaceTaskName.trim() : workspaceConfigUid)
  );
  const workspaceBusy = workspaceLoadingProjects || workspaceLoadingModules || workspaceLoadingTasks || workspaceSaving;
  const railStatusBadge = useMemo(() => {
    if (running) {
      return {
        label: canceling ? '停止中' : '运行中',
        className: canceling ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-sky-200 bg-sky-50 text-sky-800',
      };
    }

    if (displayLaunchDecision) {
      return {
        label: '已拦截',
        className: intentLaunchDecisionTone(displayLaunchDecision.decision),
      };
    }

    if (showCanceledState) {
      return {
        label: '已停止',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
      };
    }

    if (displayFinalResult) {
      return {
        label: displayFinalResult.success ? '通过' : '失败',
        className: statusPillTone(displayFinalResult.success),
      };
    }

    return {
      label: '待命',
      className: 'border-stone-200 bg-stone-100 text-stone-600',
    };
  }, [canceling, displayFinalResult, displayLaunchDecision, running, showCanceledState]);
  const railTabs = useMemo(() => {
    const tabs: Array<{
      key: WorkbenchRailView;
      label: string;
      description: string;
      countLabel: string;
    }> = [
      {
        key: 'live',
        label: '实时画面',
        description: '浏览器实时画面与当前会话信息集中在这里。',
        countLabel: browserSessionId ? `${streamState.feed.length} 条动态` : '等待浏览器',
      },
      {
        key: 'overview',
        label: '状态总览',
        description: '执行状态、模型、知识命中和 runId 集中在这里。',
        countLabel: running ? '执行中' : displayFinalResult ? '已有终态' : '待启动',
      },
      {
        key: 'context',
        label: '执行上下文',
        description: standaloneContextDescription,
        countLabel: `${standaloneContextAuthLabel} · ${llmConfig.provider}`,
      },
    ];

    if (!embedded) {
      tabs.push({
        key: 'workbench',
        label: '任务输入',
        description: '把任务目标、入口 URL、参考图和启动按钮集中放到右侧。',
        countLabel: `${input.trim() ? '目标已写' : '待写目标'} · ${attachments.length} 图`,
      });
      tabs.push({
        key: 'governance',
        label: '治理与学习',
        description: '把知识草稿、运行洞察、审计与回滚集中到右侧。',
        countLabel: `${insights ? `${insights.summary.totalRuns} 次运行` : '洞察待加载'} · ${
          knowledgeDraftPreview ? `${knowledgeDraftPreview.candidates.length} 候选` : '未生成草稿'
        }`,
      });
    }

    tabs.push(
      {
        key: 'compile',
        label: '编译结果',
        description: '把场景卡、ExecutionPlan、CompiledTemplate 和尝试记录都收进同一个执行详情面板。',
        countLabel: displayExecutionPlan
          ? `${displayExecutionPlan.steps.length} 步`
          : displayCompiledTemplate
            ? `${displayCompiledTemplate.slots.length} 个槽位`
            : displayAttempts.length > 0
              ? `${displayAttempts.length} 次尝试`
              : '等待编译',
      },
      {
        key: 'workspace',
        label: '保存结果',
        description: '把运行同步到项目工作台，并处理 Starter 资产沉淀。',
        countLabel:
          displayFinalResult && activeRunId ? (workspaceSaveResult ? '已沉淀' : '可保存') : '待结果',
      }
    );

    return tabs;
  }, [
    activeRunId,
    browserSessionId,
    displayAttempts.length,
    displayCompiledTemplate,
    displayExecutionPlan,
    displayFinalResult,
    embedded,
    input,
    insights,
    knowledgeDraftPreview,
    llmConfig.provider,
    running,
    standaloneContextAuthLabel,
    standaloneContextDescription,
    streamState.feed.length,
    attachments.length,
    workspaceSaveResult,
  ]);
  const activeRailTab = railTabs.find((item) => item.key === railView) ?? railTabs[0];
  const detailTabs = useMemo(
    () => [
      {
        key: 'scenario' as WorkbenchDetailView,
        label: '场景卡',
        description: '查看结构化业务卡片、成功标准和规划步骤。',
        countLabel: displayScenarioCard ? `${displayScenarioCard.flowDefinition.steps.length} 步` : '等待规划',
      },
      {
        key: 'compile' as WorkbenchDetailView,
        label: '编译结果',
        description: '查看 ExecutionPlan、CompiledTemplate、VerificationPlan 和生成说明。',
        countLabel: displayExecutionPlan
          ? `${displayExecutionPlan.steps.length} 步`
          : displayCompiledTemplate
            ? `${displayCompiledTemplate.slots.length} 个槽位`
            : '等待编译',
      },
      {
        key: 'attempts' as WorkbenchDetailView,
        label: '尝试记录',
        description: '回看首轮与修复轮次的脚本、日志、事件和 patch。',
        countLabel: `${displayAttempts.length} 次`,
      },
    ],
    [displayAttempts.length, displayCompiledTemplate, displayExecutionPlan, displayScenarioCard]
  );
  const activeDetailTab = detailTabs.find((item) => item.key === detailView) ?? detailTabs[0];
  const activeDetailPreview = useMemo(() => {
    if (detailView === 'scenario') {
      return displayScenarioCard
        ? `${displayScenarioCard.title} · ${displayScenarioCard.flowDefinition.steps.length} 步 · ${displayScenarioCard.successCriteria.length} 条成功标准`
        : 'AI 还在规划场景卡。';
    }

    if (detailView === 'compile') {
      const parts = [
        displayExecutionPlan ? `ExecutionPlan ${displayExecutionPlan.steps.length} 步` : '',
        displayCompiledTemplate ? `CompiledTemplate ${displayCompiledTemplate.slots.length} 个槽位` : '',
        displayVerificationPlan ? `VerificationPlan ${displayVerificationPlan.checks.length} 项校验` : '',
      ].filter(Boolean);

      return parts.length > 0 ? parts.join(' · ') : '编译产物和生成说明还在准备中。';
    }

    return finalAttempt
      ? `共 ${displayAttempts.length} 次尝试 · 最近第 ${finalAttempt.attempt} 次 · ${attemptResultLabel(finalAttempt)}`
      : '暂无尝试记录。';
  }, [
    detailView,
    displayAttempts.length,
    displayCompiledTemplate,
    displayExecutionPlan,
    displayScenarioCard,
    displayVerificationPlan,
    finalAttempt,
  ]);
  const liveFeedItems = useMemo(() => [...streamState.feed].reverse(), [streamState.feed]);
  const liveAttemptValue = useMemo(() => {
    if (browserAttempt) return `第 ${browserAttempt.attempt} 次`;
    if (finalAttempt) return `第 ${finalAttempt.attempt} 次`;
    return '等待首次尝试';
  }, [browserAttempt, finalAttempt]);
  const liveLogStatus = useMemo(() => {
    if (running) {
      return {
        toneClassName: canceling ? 'border-amber-200 bg-amber-50/92 text-amber-800' : 'intent-status-running border-sky-200 bg-sky-50/92 text-sky-800',
        title: canceling ? '正在停止当前自动测试' : 'AI 正在自动推进整条链路',
        detail: currentStageText,
        indicatorClassName: canceling
          ? 'h-3.5 w-3.5 rounded-full border-2 border-amber-500 border-dashed animate-spin'
          : 'h-3.5 w-3.5 rounded-full border-2 border-sky-500 border-t-transparent animate-spin',
        badgeLabel: canceling ? '停止中' : '运行中',
      };
    }

    if (displayLaunchDecision) {
      return {
        toneClassName: intentLaunchDecisionTone(displayLaunchDecision.decision),
        title: '启动已拦截',
        detail: intentLaunchDecisionSummary(displayLaunchDecision.decision),
        indicatorClassName: 'h-2 w-2 rounded-full bg-amber-500',
        badgeLabel: '已拦截',
      };
    }

    if (showCanceledState) {
      return {
        toneClassName: 'border-amber-200 bg-amber-50/92 text-amber-800',
        title: '测试已停止',
        detail: `已保留当前流式上下文和 ${displayAttempts.length} 次尝试记录，方便继续诊断。`,
        indicatorClassName: 'h-2 w-2 rounded-full bg-amber-500',
        badgeLabel: '已停止',
      };
    }

    if (displayFinalResult) {
      return {
        toneClassName: statusPillTone(displayFinalResult.success),
        title: displayFinalResult.success ? '测试通过' : '测试失败',
        detail: `共执行 ${displayAttempts.length} 次尝试 · 最终耗时 ${formatDuration(displayFinalResult.duration)}`,
        indicatorClassName: `h-2 w-2 rounded-full ${displayFinalResult.success ? 'bg-emerald-500' : 'bg-rose-500'}`,
        badgeLabel: displayFinalResult.success ? '通过' : '失败',
      };
    }

    return {
      toneClassName: 'border-stone-200 bg-stone-100/90 text-stone-600',
      title: '等待启动',
      detail: '开始自动测试后，这里会持续显示最新阶段、修复动作和关键诊断。',
      indicatorClassName: 'h-2 w-2 rounded-full bg-stone-400 animate-pulse',
      badgeLabel: '待命',
    };
  }, [canceling, currentStageText, displayAttempts.length, displayFinalResult, displayLaunchDecision, running, showCanceledState]);
  const showCollapsedWorkbenchRail = !embedded && workbenchCollapsed;
  const intentWorkbenchFormId = 'intent-e2e-launch-form';
  const renderBlockedLaunchDecisionCard = () => {
    if (!displayLaunchDecision) {
      return null;
    }

    const returnHref =
      projectReturnHref !== '/intent-e2e'
        ? projectReturnHref
        : blockedProjectUid
          ? buildWorkspaceProjectPath({ projectUid: blockedProjectUid })
          : '/';
    const assetAvailability = displayLaunchDecision.assetAvailability;
    const newIntentReadiness = displayLaunchDecision.newIntentReadiness || null;
    const topRecovery = newIntentReadiness?.failureRecoveryPlan?.[0] || null;
    const fixtureBootstrap = newIntentReadiness?.fixtureBootstrap || null;

    return (
      <div className={`rounded-[28px] border px-5 py-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)] ${intentLaunchDecisionTone(displayLaunchDecision.decision)}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-75">Launch Decision</p>
            <p className="mt-2 text-lg font-semibold text-current">当前请求先不直接开跑</p>
            <p className="mt-2 text-sm leading-6">
              {intentLaunchDecisionSummary(displayLaunchDecision.decision)}
            </p>
          </div>
          <span className="rounded-full border px-3 py-1 text-[11px] font-medium">
            {intentLaunchDecisionLabel(displayLaunchDecision.decision)}
          </span>
        </div>

        {displayBlockedReasonLabels.length > 0 && (
          <div className="mt-4 rounded-2xl border border-current/10 bg-white/60 px-4 py-3 text-sm leading-6 text-slate-700">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">判定依据</p>
            <p className="mt-2">{displayBlockedReasonLabels.join('；')}</p>
            {intentLaunchDecisionActionHint(displayLaunchDecision.decision) ? (
              <p className="mt-2 text-xs leading-6 text-slate-500">
                {intentLaunchDecisionActionHint(displayLaunchDecision.decision)}
              </p>
            ) : null}
          </div>
        )}

        {newIntentReadiness && (
          <div className="mt-3 rounded-2xl border border-current/10 bg-white/60 px-4 py-3 text-xs leading-6 text-slate-600">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-current/10 bg-white/70 px-2.5 py-1 font-medium text-slate-700">
                {intentNewIntentReadinessModeLabel(newIntentReadiness.recommendedMode)}
              </span>
              <span className="rounded-full border border-current/10 bg-white/70 px-2.5 py-1 font-medium text-slate-700">
                信心 {intentNewIntentReadinessConfidenceLabel(newIntentReadiness.confidence)}
              </span>
              {newIntentReadiness.signals?.priorityScenarioFamily ? (
                <span className="rounded-full border border-current/10 bg-white/70 px-2.5 py-1 font-mono text-[11px] text-slate-600">
                  {newIntentReadiness.signals.priorityScenarioFamily}
                </span>
              ) : null}
              {newIntentReadiness.signals?.documentFamily ? (
                <span className="rounded-full border border-current/10 bg-white/70 px-2.5 py-1 font-mono text-[11px] text-slate-600">
                  {newIntentReadiness.signals.documentFamily}
                </span>
              ) : null}
            </div>
            {newIntentReadiness.missingContracts.length > 0 ? (
              <p className="mt-2">
                缺口：{newIntentReadiness.missingContracts.map((item) => intentNewIntentMissingContractLabel(item)).join('；')}
              </p>
            ) : null}
            {topRecovery ? <p className="mt-2">补救：{topRecovery.recommendation}</p> : null}
            {fixtureBootstrap ? (
              <div className="mt-3 border-t border-current/10 pt-3">
                <p className="font-medium text-slate-700">Fixture 草稿：{fixtureBootstrap.fixtureId}</p>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-500">
                  setup {fixtureBootstrap.setupRef}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-500">
                  cleanup {fixtureBootstrap.cleanupRef}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-500">
                  idempotency {fixtureBootstrap.idempotencyKey}
                </p>
              </div>
            ) : null}
          </div>
        )}

        {assetAvailability?.projectUid && (
          <div className="mt-3 rounded-2xl border border-current/10 bg-white/60 px-4 py-3 text-xs leading-6 text-slate-600">
            <p>项目：{assetAvailability.projectUid}</p>
            <p>资产状态：{intentAssetReadinessLabel(assetAvailability.status)}</p>
            {assetAvailability.onboardingPath ? <p>onboarding：{assetAvailability.onboardingPath}</p> : null}
            {assetAvailability.knowledgePath ? <p>knowledge：{assetAvailability.knowledgePath}</p> : null}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              clearBlockedLaunchDecision({ syncQuery: launchedFromIntentDraft });
              setWorkbenchCollapsed(false);
              setRailView('workbench');
            }}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-current/15 bg-white/80 px-4 text-sm font-medium text-slate-800 transition hover:bg-white"
          >
            继续改描述
          </button>
          {displayLaunchDecision.decision === 'draft_only' && (
            <button
              type="button"
              onClick={() => {
                void overrideDraftOnlyLaunchDecision();
              }}
              disabled={running || configLoading}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-current/15 bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              高风险仍继续
            </button>
          )}
          {!embedded && (
            <button
              type="button"
              onClick={() => {
                setWorkbenchCollapsed(false);
                setRailView('governance');
                void previewProjectKnowledgeDraft();
              }}
              disabled={!workspaceProjectUid || knowledgeDraftBusy}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-current/15 bg-white/80 px-4 text-sm font-medium text-slate-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {knowledgeDraftLoading ? '预览中…' : '预览项目知识草稿'}
            </button>
          )}
          {!embedded ? (
            <Link
              href={returnHref}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-current/15 bg-white/80 px-4 text-sm font-medium text-slate-800 transition hover:bg-white"
            >
              返回项目工作台
            </Link>
          ) : onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-current/15 bg-white/80 px-4 text-sm font-medium text-slate-800 transition hover:bg-white"
            >
              关闭
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const handleFailureCtaAction = useCallback(
    async (action: IntentFailureCtaActionKey) => {
      switch (action) {
        case 'prepare_prerequisites':
          setWorkbenchCollapsed(false);
          setRailView('context');
          return;
        case 'preview_knowledge_draft':
          if (!workspaceProjectUid || knowledgeDraftBusy) {
            return;
          }
          setWorkbenchCollapsed(false);
          setRailView('governance');
          void previewProjectKnowledgeDraft();
          return;
        case 'handoff_manual':
          if (activeRunId && displayFinalResult) {
            await persistRunToWorkspace({
              mode: 'new',
              taskName: workspaceTaskName.trim() || displayScenarioCard?.title?.trim() || 'AI 意图测试任务',
              navigateTo: 'history',
            });
            return;
          }
          if (projectReturnHref !== '/intent-e2e') {
            router.push(projectReturnHref);
            return;
          }
          if (onClose) {
            onClose();
          }
          return;
        case 'edit_description':
        default:
          setWorkbenchCollapsed(false);
          setRailView('workbench');
      }
    },
    [
      activeRunId,
      displayFinalResult,
      displayScenarioCard?.title,
      knowledgeDraftBusy,
      onClose,
      persistRunToWorkspace,
      previewProjectKnowledgeDraft,
      projectReturnHref,
      router,
      workspaceTaskName,
      workspaceProjectUid,
    ]
  );

  const renderIntentWorkbenchEditor = ({
    subtitle,
    showCollapseControl = false,
    showReturnLink = false,
    submitOutsideForm = false,
  }: {
    subtitle: string;
    showCollapseControl?: boolean;
    showReturnLink?: boolean;
    submitOutsideForm?: boolean;
  }) => {
    const submitButtonProps = submitOutsideForm ? { form: intentWorkbenchFormId } : {};

    return (
      <div className="space-y-4">
        <section className="intent-e2e-hero relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(245,249,255,0.97))] px-5 py-5 text-slate-950 shadow-[0_18px_42px_rgba(15,23,42,0.06)] backdrop-blur md:px-6 md:py-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.12),rgba(96,165,250,0)_74%)] blur-2xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-10 top-0 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(148,163,184,0.12),rgba(148,163,184,0)_72%)] blur-2xl"
          />
          <div className="relative space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/90 pb-4">
              <div className="max-w-3xl">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">任务输入</p>
                <h2 className="mt-2 text-[22px] font-semibold leading-[1.14] tracking-[-0.04em] text-slate-950 md:text-[25px] xl:text-[28px]">
                  配置任务与自动测试
                </h2>
                <p className="mt-2 text-[14px] leading-6 text-slate-600">{subtitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {showCollapseControl && (
                  <button
                    type="button"
                    onClick={() => setWorkbenchCollapsed(true)}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 text-[12px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
                    title="收起"
                  >
                    收起
                  </button>
                )}
                {showReturnLink && (
                  <Link
                    href={projectReturnHref}
                    title="返回项目"
                    className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 text-[12px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
                  >
                    返回项目
                  </Link>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                {...submitButtonProps}
                disabled={running || configLoading}
                className="inline-flex h-10 min-w-[132px] items-center justify-center rounded-[16px] bg-slate-950 px-4 text-[12px] font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {running ? (canceling ? '正在停止…' : 'AI 正在自动执行…') : '开始自动测试'}
              </button>
              <button
                type="button"
                onClick={stopIntentTest}
                disabled={!running || !activeRunId || canceling}
                className="inline-flex h-10 min-w-[132px] items-center justify-center rounded-[16px] border border-rose-200 bg-rose-50 px-4 text-[12px] font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {canceling ? '停止中…' : '停止当前测试'}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearExecutionState();
                  clearBlockedLaunchDecision({ syncQuery: launchedFromIntentDraft });
                }}
                disabled={running}
                className="inline-flex h-10 min-w-[112px] items-center justify-center rounded-[16px] border border-slate-200 bg-slate-50 px-4 text-[12px] font-medium text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                清空结果
              </button>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              {heroSummaryCards.map((item) => (
                <div
                  key={item.key}
                  className="rounded-[18px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,251,255,0.95),rgba(241,246,252,0.95))] px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.03)]"
                >
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                  <p className="mt-1.5 text-[14px] font-semibold leading-6 text-slate-900">{item.summary}</p>
                  <p className="mt-1 text-[13px] leading-5 text-slate-500">{item.detail}</p>
                </div>
              ))}
            </div>

            <section className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,251,255,0.95),rgba(242,247,253,0.96))] p-4 shadow-[0_16px_36px_rgba(15,23,42,0.04)] md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">任务描述</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">把目标、入口和参考图一次交代完整</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-500">
                  目标 / URL / 参考图
                </span>
              </div>

              <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                <div className="grid gap-0 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
                  <div className="p-4 xl:border-r xl:border-slate-200">
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor="intent-e2e-input" className="text-[13px] font-medium tracking-[0.08em] text-slate-400">
                        测试目标
                      </label>
                      <div ref={inputHelpPopoverRef} className="relative">
                        <button
                          type="button"
                          aria-label="查看填写提示"
                          aria-expanded={inputHelpOpen}
                          aria-controls="intent-e2e-input-help"
                          onClick={() => setInputHelpOpen((current) => !current)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          ?
                        </button>
                        {inputHelpOpen && (
                          <div
                            id="intent-e2e-input-help"
                            className="absolute left-0 top-full z-30 mt-2 w-[300px] rounded-[18px] border border-slate-200 bg-white p-3.5 text-left shadow-[0_16px_36px_rgba(15,23,42,0.14)]"
                            role="dialog"
                            aria-label="填写提示"
                          >
                            <p className="text-sm font-medium text-slate-900">建议只写“业务结果”，不要写点击脚本</p>
                            <div className="mt-2.5 space-y-1.5 text-[13px] leading-6 text-slate-600">
                              <p>目标动作：登录 / 搜索 / 新建 / 提交 / 下单</p>
                              <p>成功标准：页面文案 / URL / 列表状态 / 接口成功</p>
                              <p>复杂页面：补一张成功态或关键表单截图，帮助模型理解页面结构。</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <textarea
                      id="intent-e2e-input"
                      value={input}
                      onChange={(targetEvent) => setInput(targetEvent.target.value)}
                      rows={embedded ? 2 : 3}
                      placeholder="例如：登录后台后创建一个商机，保存成功后看到新建记录，并且列表中状态为待跟进。"
                      className="mt-3 min-h-[164px] w-full rounded-[20px] border border-slate-200 bg-slate-50/36 px-4 py-3.5 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white xl:min-h-[220px]"
                    />
                  </div>

                  <div className="divide-y divide-slate-200">
                    <div className="p-4">
                      <label className="block">
                        <span className="text-[13px] font-medium uppercase tracking-[0.14em] text-slate-400">目标 URL</span>
                        <input
                          value={targetUrl}
                          onChange={(targetEvent) => setTargetUrl(targetEvent.target.value)}
                          placeholder="https://example.com/checkout"
                          className="mt-2.5 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/36 px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white"
                        />
                        <p className="mt-2 text-[13px] leading-6 text-slate-500">尽量给真实入口，能减少 AI 在多层导航里的试探。</p>
                      </label>
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-slate-400">参考图</p>
                          <p className="mt-1 text-[13px] leading-6 text-slate-500">补目标页、关键区域或成功态即可。</p>
                        </div>
                        <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3.5 text-[13px] text-slate-700 transition hover:bg-white">
                          上传图片
                          <input type="file" accept="image/*" multiple onChange={handleAttachmentChange} className="hidden" />
                        </label>
                      </div>

                      {!llmConfig.visionEnabled && attachments.length > 0 && (
                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                          当前已关闭 Vision，图片会保存在表单里，但不会发送给模型。
                        </div>
                      )}

                      {attachments.length === 0 ? (
                        <div className="mt-3 rounded-[20px] border border-dashed border-slate-300 bg-slate-50/60 px-4 py-4 text-center text-[13px] text-slate-400">
                          还没有上传图片；复杂页面建议补一张成功态或关键表单截图。
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {attachments.map((attachment) => (
                            <article key={attachment.id} className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                              <img src={attachment.dataUrl} alt={attachment.name} className="h-28 w-full object-cover" />
                              <div className="space-y-2.5 p-3.5">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-slate-900">{attachment.name}</p>
                                    <p className="mt-1 text-xs text-slate-500">用于辅助理解页面结构或成功态。</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeAttachment(attachment.id)}
                                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 transition hover:bg-slate-50"
                                  >
                                    删除
                                  </button>
                                </div>
                                <label className="block">
                                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">用途备注</span>
                                  <input
                                    value={attachment.purpose}
                                    onChange={(targetEvent) => updateAttachmentPurpose(attachment.id, targetEvent.target.value)}
                                    placeholder="例如：预期成功页；关键表单区域；目标按钮位置"
                                    className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-slate-50/36 px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white"
                                  />
                                </label>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>

        {(runError || restoreNotice) && (
          <div className="space-y-3">
            {runError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {runError}
              </div>
            )}
            {restoreNotice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {restoreNotice}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (collapseContextRef.current === collapsePreferenceContextKey) {
      return;
    }

    collapseContextRef.current = collapsePreferenceContextKey;
    setWorkbenchCollapsed(false);
  }, [collapsePreferenceContextKey]);

  useEffect(() => {
    if (!inputHelpOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (inputHelpPopoverRef.current?.contains(target)) {
        return;
      }
      setInputHelpOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setInputHelpOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [inputHelpOpen]);

  useEffect(() => {
    if (!executionDetailsModalOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExecutionDetailsModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executionDetailsModalOpen]);

  useEffect(() => {
    if (!hasDisplayDetails && executionDetailsModalOpen) {
      setExecutionDetailsModalOpen(false);
    }
  }, [executionDetailsModalOpen, hasDisplayDetails]);

  useEffect(() => {
    if (attemptDetailAttemptNumber === null) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAttemptDetailAttemptNumber(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attemptDetailAttemptNumber]);

  useEffect(() => {
    if (attemptDetailAttemptNumber !== null && !attemptDetailAttempt) {
      setAttemptDetailAttemptNumber(null);
    }
  }, [attemptDetailAttempt, attemptDetailAttemptNumber]);

  const renderScenarioCardDetailBody = () => {
    if (!displayScenarioCard) {
      return null;
    }

    return (
      <>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-900">场景卡</p>
            <h2 className="mt-1.5 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">{displayScenarioCard.title}</h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">{displayScenarioCard.featureDescription}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
            {displayScenarioCard.taskMode === 'scenario' ? '业务流' : '单页面'}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-3.5">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">目标 URL</p>
            <p className="mt-2 break-all text-sm text-slate-800">{displayTargetUrl || displayScenarioCard.targetUrl || '未生成'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-3.5">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">预期结果</p>
            <p className="mt-2 text-sm text-slate-800">{displayScenarioCard.flowDefinition.expectedOutcome || '未填写'}</p>
          </div>
        </div>

        {displayResolvedUrls && displayResolvedUrls.scenarioEntryUrl && displayResolvedUrls.scenarioEntryUrl !== displayResolvedUrls.targetUrl ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5">
              <p className="text-xs uppercase tracking-[0.14em] text-amber-600">Scenario Entry</p>
              <p className="mt-2 break-all text-sm text-slate-800">{displayResolvedUrls.scenarioEntryUrl}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5">
              <p className="text-xs uppercase tracking-[0.14em] text-amber-600">Precheck URL</p>
              <p className="mt-2 break-all text-sm text-slate-800">{displayResolvedUrls.precheckUrl || displayResolvedUrls.scenarioEntryUrl}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5">
              <p className="text-xs uppercase tracking-[0.14em] text-amber-600">Analyze URL</p>
              <p className="mt-2 break-all text-sm text-slate-800">{displayResolvedUrls.analyzeUrl || displayResolvedUrls.scenarioEntryUrl}</p>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-slate-900">成功标准</p>
            <ul className="mt-2.5 space-y-2 text-sm text-slate-700">
              {displayScenarioCard.successCriteria.length > 0 ? (
                displayScenarioCard.successCriteria.map((item, index) => (
                  <li key={index} className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5">
                    {item}
                  </li>
                ))
              ) : (
                <li className="text-slate-400">暂无</li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">视觉锚点</p>
            <ul className="mt-2.5 space-y-2 text-sm text-slate-700">
              {displayScenarioCard.visualAnchors.length > 0 ? (
                displayScenarioCard.visualAnchors.map((item, index) => (
                  <li key={index} className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5">
                    {item}
                  </li>
                ))
              ) : (
                <li className="text-slate-400">暂无</li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-slate-900">规划步骤</p>
          <div className="mt-2.5 space-y-2.5">
            {displayScenarioCard.flowDefinition.steps.length > 0 ? (
              displayScenarioCard.flowDefinition.steps.map((step, index) => (
                <article key={step.stepUid || index} className="rounded-2xl border border-slate-200 bg-white p-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[12px] font-bold text-slate-700">
                      {index + 1}
                    </span>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="text-[14px] font-semibold leading-tight text-slate-900">
                        {step.title || '未命名步骤'}
                      </p>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                        {step.stepType}
                      </span>
                    </div>
                  </div>
                  {(step.target || step.instruction || step.expectedResult || step.extractVariable) && (
                    <div className="mt-2.5 space-y-1.5 text-xs leading-6 text-slate-600">
                      {step.target && (
                        <p>
                          <span className="font-medium text-slate-800">目标：</span>
                          {step.target}
                        </p>
                      )}
                      {step.instruction && (
                        <p>
                          <span className="font-medium text-slate-800">动作：</span>
                          {step.instruction}
                        </p>
                      )}
                      {step.expectedResult && (
                        <p>
                          <span className="font-medium text-slate-800">预期：</span>
                          {step.expectedResult}
                        </p>
                      )}
                      {step.extractVariable && (
                        <p>
                          <span className="font-medium text-slate-800">变量：</span>
                          {step.extractVariable}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-400">
                当前卡片没有显式步骤。
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderAttemptDetailBody = (attempt: IntentAttempt) => {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs ${attemptTone(attempt.kind)}`}>
                #{attempt.attempt} · {attempt.kind === 'repair' ? 'AI 修复' : '首次生成'}
              </span>
              <span className={`rounded-full border px-3 py-1 text-xs ${attemptResultTone(attempt)}`}>{attemptResultLabel(attempt)}</span>
              {attempt.triage && (
                <span className={`rounded-full border px-3 py-1 text-xs ${intentFailureTone(attempt.triage)}`}>
                  {intentFailureClassLabel(attempt.triage.failureClass)}
                </span>
              )}
            </div>
            <p className="text-sm leading-6 text-slate-600">
              {(attempt.status || 'completed') === 'running'
                ? `实时接收 ${attempt.events.length} 条事件 · ${attempt.logs.length} 条日志 · 当前代码长度 ${attempt.code.length} 字符`
                : `耗时 ${formatDuration(attempt.result?.duration || 0)} · 代码长度 ${attempt.code.length} 字符 · 事件 ${attempt.events.length} 条`}
            </p>
            {attempt.helperUsage && attempt.helperUsage.usedHelpers.length > 0 && (
              <p className="text-xs leading-5 text-slate-500">
                helper：{summarizeTextList(attempt.helperUsage.usedHelpers, 5)}
                {attempt.helperUsage.usedSuggestedHelpers.length > 0 ? ` · 命中推荐 ${attempt.helperUsage.usedSuggestedHelpers.length} 个` : ''}
              </p>
            )}
            {attempt.sessionId && <p className="text-xs text-slate-400">浏览器会话：{attempt.sessionId}</p>}
          </div>

          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(attempt.code).catch(() => {})}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 transition hover:bg-slate-50"
          >
            复制脚本
          </button>
        </div>

        {attempt.structuredPatch && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
            <p className="font-medium text-slate-900">结构化 slot patch</p>
            <p className="mt-1">
              {attempt.structuredPatch.strategy} · base {baseCodeSourceLabel(attempt.structuredPatch.baseCodeSource)} ·
              {attempt.structuredPatch.reusedPreviousCode ? ' 复用上一轮代码' : ' 不复用上一轮代码'}
            </p>
            <p className="mt-1">target：{summarizeTextList(attempt.structuredPatch.targetSlotUids, 4)}</p>
            <p className="mt-1">returned：{summarizeTextList(attempt.structuredPatch.returnedSlotUids, 4)}</p>
          </div>
        )}

        {attempt.result?.steps.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {attempt.result.steps.map((step, index) => (
              <div key={`${attempt.attempt}-${index}`} className={`rounded-2xl border px-3 py-3 ${stepTone(step.status)}`}>
                <div className="flex items-center gap-2">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                    step.status === 'passed' ? 'bg-emerald-200/60 text-emerald-800'
                    : step.status === 'failed' ? 'bg-rose-200/60 text-rose-800'
                    : step.status === 'skipped' ? 'bg-amber-200/60 text-amber-800'
                    : 'bg-slate-200/60 text-slate-700'
                  }`}>
                    {index + 1}
                  </span>
                  <p className="min-w-0 text-[13px] font-semibold leading-tight">{step.title}</p>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] opacity-80">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                    step.status === 'passed' ? 'bg-emerald-500' : step.status === 'failed' ? 'bg-rose-500' : step.status === 'skipped' ? 'bg-amber-500' : 'bg-slate-400'
                  }`} />
                  <span className="font-medium uppercase tracking-wide">{step.status}</span>
                  <span className="text-current/60">{formatDuration(step.duration)}</span>
                </div>
                {step.error && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 opacity-90">{step.error}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-400">
            {(attempt.status || 'completed') === 'running' ? '正在等待步骤反馈…' : '本次尝试没有结构化步骤回传。'}
          </div>
        )}

        {attempt.result?.error && (
          <pre className="max-h-[180px] overflow-auto rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs leading-6 text-rose-800 whitespace-pre-wrap">
            {attempt.result.error}
          </pre>
        )}

        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <p className="text-sm font-medium text-slate-900">事件流</p>
            <div className="mt-3 max-h-[260px] space-y-2 overflow-auto pr-1 text-xs leading-5 text-slate-600">
              {attempt.events.length > 0 ? (
                attempt.events.map((item, index) => (
                  <div key={index} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="font-medium text-slate-900">{item.type}</p>
                    <p className="mt-1 whitespace-pre-wrap">{item.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-400">还没有事件。</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <p className="text-sm font-medium text-slate-900">执行日志</p>
            <div className="mt-3 max-h-[260px] space-y-2 overflow-auto pr-1 text-xs leading-5 text-slate-600">
              {attempt.logs.length > 0 ? (
                attempt.logs.map((item, index) => (
                  <div key={index} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="font-medium text-slate-900">{item.level.toUpperCase()}</p>
                    <p className="mt-1 whitespace-pre-wrap">{item.message}</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-400">没有额外日志。</p>
              )}
            </div>
          </div>
        </div>

        {attempt.structuredPatch && (
          <details className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-medium text-slate-900">查看结构化 patch JSON</summary>
            <pre className="mt-3 max-h-[240px] overflow-auto rounded-2xl bg-slate-950/96 p-4 text-xs leading-6 text-slate-100 whitespace-pre-wrap">
              {JSON.stringify(attempt.structuredPatch, null, 2)}
            </pre>
          </details>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
          <p className="text-sm font-medium text-slate-900">脚本</p>
          <pre className="mt-3 max-h-[360px] overflow-auto rounded-2xl bg-slate-950/96 p-4 text-xs leading-6 text-slate-100 whitespace-pre-wrap">
            {attempt.code || '脚本尚未返回，稍后会实时显示。'}
          </pre>
        </div>
      </div>
    );
  };
  const renderCompileDetailBody = () => {
    const compileSummaryCards = [
      {
        key: 'plan',
        label: 'ExecutionPlan',
        value: displayExecutionPlan ? `${displayExecutionPlan.steps.length} 步` : '待生成',
        detail: displayExecutionPlan
          ? `${displayExecutionPlan.compiler} · ${displayExecutionPlan.mode}`
          : '结构化执行计划生成后会出现在这里。',
      },
      {
        key: 'template',
        label: 'CompiledTemplate',
        value: displayCompiledTemplate ? `${displayCompiledTemplate.slots.length} 个槽位` : '待生成',
        detail: displayCompiledTemplate
          ? displayCompiledTemplate.testTitle || '已生成测试模板'
          : '模板代码与 slot 编译完成后会出现在这里。',
      },
      {
        key: 'verify',
        label: 'VerificationPlan',
        value: displayVerificationPlan ? `${displayVerificationPlan.checks.length} 项校验` : '待生成',
        detail: displayVerificationPlan
          ? displayVerificationPlan.strategy
          : '验证计划会在结构化编译后同步出现。',
      },
    ];

    return (
      <section className="rounded-[24px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,255,0.98))] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)] md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">编译产物</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">自然语言说明与结构化执行产物会在这里汇合，便于回看规划、编译和校验。</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
            {displayDescription ? '说明已生成' : '说明待生成'}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {compileSummaryCards.map((item) => (
            <div key={item.key} className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,251,255,0.96),rgba(242,247,253,0.96))] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
              <p className="mt-2 text-[15px] font-semibold text-slate-900">{item.value}</p>
              <p className="mt-1 text-[12px] leading-5 text-slate-500">{item.detail}</p>
            </div>
          ))}
        </div>

        {(displayExecutionPlan || displayCompiledTemplate || displayVerificationPlan) && (
          <div className="mt-4 grid gap-4">
            {displayExecutionPlan && (
              <div className="rounded-2xl border border-slate-200 bg-white/96 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">ExecutionPlan</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {displayExecutionPlan.compiler} · {displayExecutionPlan.mode} · {displayExecutionPlan.steps.length} 步
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                    {displayExecutionPlan.entryUrl || '无入口 URL'}
                  </span>
                </div>

                <div className="mt-3 space-y-3">
                  {displayExecutionPlan.steps.map((step, index) => (
                    <div key={step.planStepUid} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[12px] font-bold text-slate-700 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                          {index + 1}
                        </span>
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="text-[14px] font-semibold leading-tight text-slate-900">
                            {step.title || '未命名步骤'}
                          </p>
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                            {step.stepType}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1 text-[11px] leading-5 text-slate-600">
                        <p>目标：{step.target || '—'}</p>
                        <p>Goal：{step.goal || '—'}</p>
                        <p>Actions：{summarizeTextList(step.allowedActions, 5)}</p>
                        <p>Helpers：{summarizeTextList(step.preferredHelpers, 4)}</p>
                        <p>Assertions：{summarizeTextList(step.requiredAssertions, 3)}</p>
                        {step.extractVariable && <p>变量：{step.extractVariable}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {displayCompiledTemplate && (
              <div className="rounded-2xl border border-slate-200 bg-white/96 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">CompiledTemplate</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {displayCompiledTemplate.compiler} · {displayCompiledTemplate.slots.length} 个槽位
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                    {displayCompiledTemplate.testTitle || '未命名测试'}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">entry</p>
                    <p className="mt-2 break-all text-xs leading-5 text-slate-700">{displayCompiledTemplate.entryUrl || '—'}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      shared：{summarizeTextList(displayCompiledTemplate.sharedVariables, 4)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 xl:col-span-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">slots</p>
                    <div className="mt-2 space-y-2">
                      {displayCompiledTemplate.slots.map((slot) => (
                        <div key={slot.slotUid} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs leading-5 text-slate-600">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                              {slot.kind}
                            </span>
                            <p className="font-medium text-slate-900">{slot.slotUid}</p>
                            <p className="text-slate-500">{slot.title || '未命名 slot'}</p>
                          </div>
                          <div className="mt-2 space-y-1">
                            <p>关联 checks：{summarizeTextList(slot.relatedCheckUids, 3)}</p>
                            <p>Helpers：{summarizeTextList(slot.preferredHelpers, 4)}</p>
                            <p>指令：{summarizeTextList(slot.instructions, 2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <summary className="cursor-pointer list-none text-sm font-medium text-slate-900">查看编译模板代码</summary>
                  <pre className="mt-3 max-h-[320px] overflow-auto rounded-2xl bg-slate-950/96 p-4 text-xs leading-6 text-slate-100 whitespace-pre-wrap">
                    {displayCompiledTemplate.code}
                  </pre>
                </details>
              </div>
            )}

            {displayVerificationPlan && (
              <div className="rounded-2xl border border-slate-200 bg-white/96 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">VerificationPlan</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {displayVerificationPlan.strategy} · {displayVerificationPlan.checks.length} 项校验
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                    {displayVerificationPlan.expectedOutcome || '无 expectedOutcome'}
                  </span>
                </div>

                <div className="mt-3 space-y-3">
                  {displayVerificationPlan.checks.slice(0, 8).map((check, index) => (
                    <div key={check.checkUid} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                          {check.kind}
                        </span>
                        <p className="text-sm font-medium text-slate-900">
                          {index + 1}. {check.title}
                        </p>
                      </div>
                      <div className="mt-2 space-y-1 text-[11px] leading-5 text-slate-600">
                        <p>来源：{check.source}</p>
                        <p>规则：{check.instruction}</p>
                        <p>Helpers：{summarizeTextList(check.preferredHelpers, 4)}</p>
                        <p>关联步骤：{summarizeTextList(check.relatedPlanStepUids, 3)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!(displayExecutionPlan || displayCompiledTemplate || displayVerificationPlan) && (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(248,251,255,0.9),rgba(243,247,252,0.92))] px-4 py-4 text-sm text-slate-500">
            结构化编译产物还在准备中。开始规划和编译后，这里会依次出现 ExecutionPlan、CompiledTemplate 和 VerificationPlan。
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white/94 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-900">生成说明</p>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-500">
              {displayDescription ? '已返回' : '生成中'}
            </span>
          </div>

          {displayDescription ? (
            <pre className="mt-3 max-h-[420px] overflow-auto rounded-2xl bg-slate-950/96 p-4 text-xs leading-6 text-slate-100 whitespace-pre-wrap">
              {displayDescription}
            </pre>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(248,251,255,0.9),rgba(243,247,252,0.92))] px-4 py-4 text-sm text-slate-400">
              说明还在生成中，稍后会自动出现。
            </div>
          )}
        </div>

        {displayScenarioCard && (
          <details className="mt-4 rounded-2xl border border-slate-200 bg-white/94 px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-medium text-slate-900">查看原始场景卡 JSON</summary>
            <pre className="mt-3 max-h-[320px] overflow-auto rounded-2xl bg-slate-950/96 p-4 text-xs leading-6 text-slate-100 whitespace-pre-wrap">
              {JSON.stringify(displayScenarioCard, null, 2)}
            </pre>
          </details>
        )}
      </section>
    );
  };
  const renderAttemptsOverviewBody = () => {
    return (
      <section className="rounded-[22px] border border-black/5 bg-white/92 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.045)] md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">尝试记录</p>
            <p className="mt-1 text-xs text-slate-500">会展示首次生成以及后续 AI repair 尝试，运行中也会实时刷新。</p>
          </div>
          <p className="text-xs text-slate-500">共 {displayAttempts.length} 次</p>
        </div>

        {displayAttempts.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
            暂无尝试记录，AI 准备生成第一轮脚本后会在这里更新。
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {displayAttempts.map((attempt) => (
              <article key={attempt.attempt} className="rounded-[20px] border border-slate-200 bg-white p-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.035)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs ${attemptTone(attempt.kind)}`}>
                        #{attempt.attempt} · {attempt.kind === 'repair' ? 'AI 修复' : '首次生成'}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs ${attemptResultTone(attempt)}`}>
                        {attemptResultLabel(attempt)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {(attempt.status || 'completed') === 'running'
                        ? `实时接收 ${attempt.events.length} 条事件 · ${attempt.logs.length} 条日志 · 当前代码长度 ${attempt.code.length} 字符`
                        : `耗时 ${formatDuration(attempt.result?.duration || 0)} · 代码长度 ${attempt.code.length} 字符 · 事件 ${attempt.events.length} 条`}
                    </p>
                    {attempt.helperUsage && attempt.helperUsage.usedHelpers.length > 0 && (
                      <p className="text-xs text-slate-500">
                        helper：{summarizeTextList(attempt.helperUsage.usedHelpers, 4)}
                        {attempt.helperUsage.usedSuggestedHelpers.length > 0
                          ? ` · 命中推荐 ${attempt.helperUsage.usedSuggestedHelpers.length} 个`
                          : ''}
                      </p>
                    )}
                    {attempt.structuredPatch && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600">
                        <p className="font-medium text-slate-900">结构化 slot patch</p>
                        <p className="mt-1">
                          {attempt.structuredPatch.strategy} · base {baseCodeSourceLabel(attempt.structuredPatch.baseCodeSource)} ·
                          {attempt.structuredPatch.reusedPreviousCode ? ' 复用上一轮代码' : ' 不复用上一轮代码'}
                        </p>
                        <p className="mt-1">target：{summarizeTextList(attempt.structuredPatch.targetSlotUids, 4)}</p>
                        <p className="mt-1">returned：{summarizeTextList(attempt.structuredPatch.returnedSlotUids, 4)}</p>
                      </div>
                    )}
                    {attempt.sessionId && <p className="text-xs text-slate-400">浏览器会话：{attempt.sessionId}</p>}
                    {attempt.triage && (
                      <div className={`inline-flex max-w-full flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${intentFailureTone(attempt.triage)}`}>
                        <span className="rounded-full border px-2 py-0.5 font-medium">{intentFailureClassLabel(attempt.triage.failureClass)}</span>
                        <span>{attempt.triage.summary}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 lg:max-w-[240px] lg:justify-end">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-600">
                      步骤 {attempt.result?.steps.length || 0}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-600">
                      事件 {attempt.events.length}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-600">
                      日志 {attempt.logs.length}
                    </span>
                    {attempt.structuredPatch && (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] text-sky-700">
                        Patch
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setAttemptDetailAttemptNumber(attempt.attempt)}
                      className="inline-flex h-9 items-center justify-center rounded-full bg-slate-950 px-4 text-xs font-medium text-white transition hover:bg-slate-800"
                    >
                      查看详情
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  };
  const renderExecutionDetailsBody = () => {
    if (detailView === 'scenario') {
      return displayScenarioCard ? (
        <section className="rounded-[22px] border border-black/5 bg-white/92 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.045)] md:p-5">
          {renderScenarioCardDetailBody()}
        </section>
      ) : (
        <section className="rounded-[22px] border border-black/5 bg-white/92 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.045)] md:p-5">
          <p className="text-sm font-medium text-slate-900">场景卡</p>
          <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
            AI 还在规划中，生成后会立刻展示。
          </div>
        </section>
      );
    }

    if (detailView === 'compile') {
      return renderCompileDetailBody();
    }

    return renderAttemptsOverviewBody();
  };
  const removeRunIdFromUrl = useCallback(() => {
    if (embedded) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    if (!nextParams.has('runId')) return;
    nextParams.delete('runId');

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/intent-e2e?${nextQuery}` : '/intent-e2e');
  }, [embedded, router, searchParams]);
  const replaceWorkbenchSearchParams = useCallback(
    (mutate: (nextParams: URLSearchParams) => void) => {
      if (embedded) return;
      const nextParams = new URLSearchParams(searchParams.toString());
      mutate(nextParams);
      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `/intent-e2e?${nextQuery}` : '/intent-e2e');
    },
    [embedded, router, searchParams]
  );
  const syncLaunchDecisionQuery = useCallback(
    (decision?: IntentLaunchDecisionValue | null, reasons: string[] = []) => {
      if (!launchedFromIntentDraft) return;

      replaceWorkbenchSearchParams((nextParams) => {
        nextParams.delete(INTENT_DRAFT_LAUNCH_QUERY_PARAM);
        nextParams.delete('launchDecision');
        nextParams.delete('launchReason');
        if (!decision || decision === 'auto_run') {
          return;
        }
        nextParams.delete('runId');
        nextParams.set('launchDecision', decision);
        reasons.forEach((reason) => {
          const normalized = reason.trim();
          if (normalized) {
            nextParams.append('launchReason', normalized);
          }
        });
      });
    },
    [launchedFromIntentDraft, replaceWorkbenchSearchParams]
  );
  const clearBlockedLaunchDecision = useCallback(
    (options?: { syncQuery?: boolean }) => {
      setLaunchDecisionResult(null);
      if (options?.syncQuery) {
        syncLaunchDecisionQuery(null);
      }
    },
    [syncLaunchDecisionQuery]
  );
  const applyBlockedLaunchDecision = useCallback(
    (decision: IntentLaunchDecisionResponse, options?: { source?: 'route' | 'query'; syncQuery?: boolean }) => {
      const normalized: IntentBlockedLaunchDecision = {
        decision: decision.decision,
        reasons: uniqueStrings(decision.reasons || []),
        signals: decision.signals,
        assetAvailability: decision.assetAvailability || null,
        newIntentReadiness: decision.newIntentReadiness || null,
        source: options?.source || 'route',
      };
      setLaunchDecisionResult(normalized);
      setRunning(false);
      setCanceling(false);
      setRunError('');
      setRestoreNotice('');
      setResult(null);
      setStreamState(createEmptyStreamState());
      setActiveRunId('');
      workspaceTaskNamePrefillRunIdRef.current = '';
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(RUN_ID_STORAGE_KEY);
      }
      if (options?.syncQuery) {
        syncLaunchDecisionQuery(normalized.decision, normalized.reasons);
      }
    },
    [syncLaunchDecisionQuery]
  );

  const restoreLaunchFormFromDraft = useCallback(
    async (notice?: string) => {
      if (!searchWorkspaceProjectUid.trim() || !searchIntentDraftUid.trim()) {
        draftLaunchDetailRef.current = null;
        setDraftLaunchHydratedKey('');
        if (notice) setRestoreNotice(notice);
        return false;
      }

      const draftDetail = await fetchIntentDraftLaunchDetail(searchWorkspaceProjectUid.trim(), searchIntentDraftUid.trim());
      const draftKey = `${searchWorkspaceProjectUid.trim()}:${searchIntentDraftUid.trim()}`;

      draftLaunchDetailRef.current = draftDetail;
      launchLlmOverrideRef.current = null;
      launchFormHydratedRunIdRef.current = '';
      launchFormHydratedDraftKeyRef.current = draftKey;
      setDraftLaunchHydratedKey(draftKey);
      setInput(draftDetail.input.trim() || draftDetail.featureDescription.trim() || draftDetail.title.trim() || '');
      setTargetUrl(draftDetail.targetUrl.trim() || draftDetail.targetUrlHint.trim() || '');
      setAttachments(
        draftDetail.attachments.map((item, index) => ({
          id: `draft-${searchIntentDraftUid}-${index + 1}`,
          name: item.name || `参考图 ${index + 1}`,
          dataUrl: item.dataUrl,
          purpose: item.purpose || '',
        }))
      );
      setAuth(defaultAuth);
      if (configResponse?.llm) {
        setLlmConfig(toLlmDraft(configResponse.llm));
      }
      if (notice) setRestoreNotice(notice);
      return true;
    },
    [configResponse, searchIntentDraftUid, searchWorkspaceProjectUid]
  );

  useEffect(() => {
    if (activeRunId || !searchWorkspaceProjectUid.trim() || !searchIntentDraftUid.trim()) {
      return;
    }

    const draftKey = `${searchWorkspaceProjectUid.trim()}:${searchIntentDraftUid.trim()}`;
    if (launchFormHydratedDraftKeyRef.current === draftKey) {
      return;
    }

    let active = true;

    async function hydrateDraft() {
      try {
        await restoreLaunchFormFromDraft();
      } catch (error: unknown) {
        if (!active) return;
        setRunError(error instanceof Error ? error.message : '恢复意图草稿失败');
      }
    }

    void hydrateDraft();
    return () => {
      active = false;
    };
  }, [activeRunId, restoreLaunchFormFromDraft, searchIntentDraftUid, searchWorkspaceProjectUid]);

  useEffect(() => {
    if (activeRunId) {
      return;
    }

    const decision = normalizeIntentLaunchDecisionValue(searchLaunchDecision);
    if (!decision || decision === 'auto_run') {
      return;
    }

    if (!shouldTreatQueryLaunchDecisionAsHardBlock(decision, { intentDraftUid: searchIntentDraftUid })) {
      if (decision === 'draft_only') {
        setRestoreNotice((current) =>
          current || '系统建议先保留草稿：最近相似任务失败压力偏高。当前已恢复草稿上下文，如仍要验证，可继续手动开始自动测试。'
        );
      } else if (decision === 'needs_bootstrap' && searchIntentDraftUid.trim()) {
        setRestoreNotice((current) =>
          current || '已恢复意图草稿上下文；草稿自带可执行资产时，不再把历史 cold-start 拦截参数当作硬阻断。'
        );
      }
      return;
    }

    const reasonKey = searchLaunchReasons.join('|');
    const currentReasonKey = (launchDecisionResult?.reasons || []).join('|');
    if (launchDecisionResult?.source === 'query' && launchDecisionResult.decision === decision && currentReasonKey === reasonKey) {
      return;
    }

    applyBlockedLaunchDecision(
      {
        decision,
        reasons: searchLaunchReasons,
      },
      { source: 'query' }
    );
  }, [activeRunId, applyBlockedLaunchDecision, launchDecisionResult, searchIntentDraftUid, searchLaunchDecision, searchLaunchReasons]);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      setConfigLoading(true);
      setConfigError('');
      try {
        const res = await fetch('/api/llm/config');
        const json = (await res.json()) as LLMConfigResponse & { error?: string };
        if (!res.ok) throw new Error(json.error || '加载 LLM 配置失败');
        if (!active) return;
        setConfigResponse(json);
        setLlmConfig(mergeIntentLaunchLlmOverride(toLlmDraft(json.llm), launchLlmOverrideRef.current));
      } catch (error: unknown) {
        if (!active) return;
        setConfigError(error instanceof Error ? error.message : '加载 LLM 配置失败');
      } finally {
        if (active) setConfigLoading(false);
      }
    }

    void loadConfig();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (embedded) {
      setProjectAuthSummary(null);
      setProjectAuthSummaryLoading(false);
      setProjectAuthSummaryError('');
      return;
    }

    const projectUid = standaloneProjectAuthProjectUid.trim();
    if (!projectUid) {
      setProjectAuthSummary(null);
      setProjectAuthSummaryLoading(false);
      setProjectAuthSummaryError('');
      return;
    }

    let active = true;

    async function loadProjectAuthSummary() {
      setProjectAuthSummary((current) => (current?.projectUid === projectUid ? current : null));
      setProjectAuthSummaryLoading(true);
      setProjectAuthSummaryError('');
      try {
        const item = await fetchProjectAuthSummary(projectUid);
        if (!active) return;
        setProjectAuthSummary(item);
      } catch (error: unknown) {
        if (!active) return;
        setProjectAuthSummary(null);
        setProjectAuthSummaryError(error instanceof Error ? error.message : '加载项目认证摘要失败');
      } finally {
        if (active) setProjectAuthSummaryLoading(false);
      }
    }

    void loadProjectAuthSummary();
    return () => {
      active = false;
    };
  }, [embedded, standaloneProjectAuthProjectUid]);

  useEffect(() => {
    void refreshProjectKnowledgeBackups({ silent: true });
  }, []);

  useEffect(() => {
    void refreshProjectKnowledgeAudits({ silent: true });
  }, [workspaceProjectUid]);

  useEffect(() => {
    if (activeRunId) return;
    if (searchDraftLaunchMode === INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE) return;
    void refreshIntentE2EInsights({ silent: true });
    void refreshIntentE2EReleaseStatus({ silent: true });
  }, [activeRunId, searchDraftLaunchMode, workspaceProjectUid]);

  useEffect(() => {
    if (!activeRunId || !displayFinalResult || running) {
      return;
    }

    void refreshIntentE2EInsights({ silent: true });
  }, [activeRunId, displayFinalResult, running]);

  useEffect(() => {
    if (!displayFinalResult || workspaceLoadingProjects || workspaceProjects.length > 0) return;

    let active = true;

    async function loadWorkspaceProjects() {
      setWorkspaceLoadingProjects(true);
      setWorkspaceLoadError('');
      try {
        const items = await fetchWorkspaceProjects();
        if (!active) return;
        setWorkspaceProjects(items);
      } catch (error: unknown) {
        if (!active) return;
        setWorkspaceLoadError(error instanceof Error ? error.message : '加载项目列表失败');
      } finally {
        if (active) setWorkspaceLoadingProjects(false);
      }
    }

    void loadWorkspaceProjects();
    return () => {
      active = false;
    };
  }, [displayFinalResult, workspaceLoadingProjects, workspaceProjects.length]);

  useEffect(() => {
    setStarterCapabilitySelectedAssetSlugs(
      starterCapabilityLaunches
        .filter((launch) => launch.promotable && launch.promotionDecision.autoSelected)
        .map((launch) => launch.asset.assetSlug)
    );
    setStarterCapabilitySaveError('');
    setStarterCapabilitySaveNotice('');
  }, [activeRunId, starterCapabilityLaunches]);

  useEffect(() => {
    if (workspaceProjects.length === 0) {
      if (workspaceProjectUid) {
        setWorkspaceProjectUid('');
      }
      return;
    }

    if (!workspaceProjects.some((item) => item.projectUid === workspaceProjectUid)) {
      setWorkspaceProjectUid(workspaceProjects[0]?.projectUid || '');
    }
  }, [workspaceProjectUid, workspaceProjects]);

  useEffect(() => {
    setStarterCapabilitySaveError('');
    setStarterCapabilitySaveNotice('');
  }, [workspaceProjectUid]);

  useEffect(() => {
    if (!workspaceProjectUid) {
      setWorkspaceModules([]);
      setWorkspaceModuleUid('');
      setWorkspaceTasks([]);
      setWorkspaceConfigUid('');
      return;
    }

    let active = true;

    async function loadWorkspaceModules() {
      setWorkspaceLoadingModules(true);
      setWorkspaceLoadError('');
      try {
        const items = await fetchWorkspaceModules(workspaceProjectUid);
        if (!active) return;
        setWorkspaceModules(items);
      } catch (error: unknown) {
        if (!active) return;
        setWorkspaceModules([]);
        setWorkspaceModuleUid('');
        setWorkspaceTasks([]);
        setWorkspaceConfigUid('');
        setWorkspaceLoadError(error instanceof Error ? error.message : '加载模块列表失败');
      } finally {
        if (active) setWorkspaceLoadingModules(false);
      }
    }

    void loadWorkspaceModules();
    return () => {
      active = false;
    };
  }, [workspaceProjectUid]);

  useEffect(() => {
    if (workspaceModules.length === 0) {
      if (workspaceModuleUid) {
        setWorkspaceModuleUid('');
      }
      return;
    }

    if (!workspaceModules.some((item) => item.moduleUid === workspaceModuleUid)) {
      setWorkspaceModuleUid(workspaceModules[0]?.moduleUid || '');
    }
  }, [workspaceModuleUid, workspaceModules]);

  useEffect(() => {
    if (!workspaceProjectUid || !workspaceModuleUid) {
      setWorkspaceTasks([]);
      setWorkspaceConfigUid('');
      return;
    }

    let active = true;

    async function loadWorkspaceTasks() {
      setWorkspaceLoadingTasks(true);
      setWorkspaceLoadError('');
      try {
        const items = await fetchWorkspaceTasks(workspaceProjectUid, workspaceModuleUid);
        if (!active) return;
        setWorkspaceTasks(items);
      } catch (error: unknown) {
        if (!active) return;
        setWorkspaceTasks([]);
        setWorkspaceConfigUid('');
        setWorkspaceLoadError(error instanceof Error ? error.message : '加载任务列表失败');
      } finally {
        if (active) setWorkspaceLoadingTasks(false);
      }
    }

    void loadWorkspaceTasks();
    return () => {
      active = false;
    };
  }, [workspaceProjectUid, workspaceModuleUid]);

  useEffect(() => {
    if (workspaceTasks.length === 0) {
      if (workspaceConfigUid) {
        setWorkspaceConfigUid('');
      }
      return;
    }

    if (!workspaceTasks.some((item) => item.configUid === workspaceConfigUid)) {
      setWorkspaceConfigUid(workspaceTasks[0]?.configUid || '');
    }
  }, [workspaceConfigUid, workspaceTasks]);

  useEffect(() => {
    if (!activeRunId) {
      workspaceTaskNamePrefillRunIdRef.current = '';
      return;
    }

    const suggestedName = displayScenarioCard?.title?.trim() || 'AI 意图测试任务';
    if (workspaceTaskNamePrefillRunIdRef.current !== activeRunId) {
      workspaceTaskNamePrefillRunIdRef.current = activeRunId;
      setWorkspaceTaskName(suggestedName);
      setWorkspaceSaveError('');
      setWorkspaceSaveResult(null);
      return;
    }

    if ((workspaceTaskName === '' || workspaceTaskName === 'AI 意图测试任务') && displayScenarioCard?.title?.trim()) {
      setWorkspaceTaskName(displayScenarioCard.title.trim());
    }
  }, [activeRunId, displayScenarioCard, workspaceTaskName]);

  const applyRunRecord = useCallback((run: IntentRunRecord) => {
    setActiveRunId(run.runId);
    setLaunchDecisionResult(null);
    setResult(run.result ? normalizeRunResult(run.result) : null);
    setStreamState(hydrateStreamStateFromRunRecord(run));
    setRunError(run.status === 'failed' && !run.result ? run.error || '' : '');
    setRestoreNotice('');
    setRunning(!isTerminalRunStatus(run.status));
    setCanceling(false);
  }, []);

  const hydrateLaunchFormFromRun = useCallback(
    async (run: IntentRunRecord) => {
      if (launchFormHydratedRunIdRef.current === run.runId) {
        return;
      }

      launchFormHydratedRunIdRef.current = run.runId;

      let draftDetail: IntentDraftLaunchDetail | null = null;
      if (searchWorkspaceProjectUid.trim() && searchIntentDraftUid.trim()) {
        draftDetail = await fetchIntentDraftLaunchDetail(searchWorkspaceProjectUid.trim(), searchIntentDraftUid.trim()).catch(() => null);
      }
      launchLlmOverrideRef.current = null;

      setInput(draftDetail?.input?.trim() || run.request.input || '');
      setTargetUrl(draftDetail?.targetUrl?.trim() || draftDetail?.targetUrlHint?.trim() || run.request.targetUrl || run.result?.targetUrl || '');
      setAttachments(
        (draftDetail?.attachments || []).map((item, index) => ({
          id: `${run.runId}-attachment-${index + 1}`,
          name: item.name || `参考图 ${index + 1}`,
          dataUrl: item.dataUrl,
          purpose: item.purpose || '',
        }))
      );
      if (draftDetail || searchWorkspaceProjectUid.trim()) {
        setAuth(defaultAuth);
      }
      if (configResponse?.llm) {
        setLlmConfig(toLlmDraft(configResponse.llm));
      }
    },
    [configResponse, searchIntentDraftUid, searchWorkspaceProjectUid]
  );

  const consumeRunStreamFromServer = useCallback(
    async function consumeRunStream(runId: string, cursor = 0, reconnectAttempt = 0): Promise<void> {
      const controller = new AbortController();
      streamAbortRef.current = controller;

      try {
        const res = await fetch(`/api/intent-e2e/runs/${encodeURIComponent(runId)}/stream?cursor=${cursor}`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!res.ok) {
          const maybeJson = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(maybeJson?.error || '订阅自动测试运行失败');
        }

        await consumeEventStream(res, async (streamEvent) => {
          if (streamEvent.type === 'error') {
            setRunError(streamEvent.message);
          }

          if (streamEvent.type === 'final_result') {
            setResult(normalizeRunResult(streamEvent.result));
          }

          if (streamEvent.type === 'stage' && streamEvent.stage === 'canceled') {
            setCanceling(false);
          }

          setStreamState((current) => applyIntentStreamEvent(current, streamEvent));
        });
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          return;
        }
        throw error;
      } finally {
        if (streamAbortRef.current === controller) {
          streamAbortRef.current = null;
        }
      }

      if (controller.signal.aborted) return;

      const latestRun = await fetchIntentRunRecord(runId).catch(() => null);
      if (!latestRun) {
        setRunning(false);
        setCanceling(false);
        setRunError('流式连接已结束，且无法读取服务端运行状态。');
        return;
      }

      applyRunRecord(latestRun);

      if (isTerminalRunStatus(latestRun.status) && latestRun.result && !latestRun.result.review) {
        const reviewedRun = await fetchTerminalIntentRunReview(runId, latestRun);
        if (!streamAbortRef.current && reviewedRun.result?.review && !latestRun.result.review) {
          applyRunRecord(reviewedRun);
        }
      }

      if (!isTerminalRunStatus(latestRun.status) && reconnectAttempt < 2) {
        setStreamState((current) => ({
          ...current,
          message: '流式连接短暂中断，正在自动重连…',
          feed: pushFeed(current.feed, `流式连接短暂中断，正在自动重连（${reconnectAttempt + 1}/2）…`),
        }));
        return consumeRunStream(runId, latestRun.events.length, reconnectAttempt + 1);
      }

      if (!isTerminalRunStatus(latestRun.status)) {
        setRunError('实时连接已中断，但服务端运行仍在继续；刷新页面会自动恢复。');
        setRunning(true);
        setCanceling(false);
      }
    },
    [applyRunRecord]
  );

  const startRunStream = useCallback(
    async (runId: string, cursor = 0) => {
      streamAbortRef.current?.abort();
      await consumeRunStreamFromServer(runId, cursor, 0);
    },
    [consumeRunStreamFromServer]
  );

  const clearExecutionState = useCallback((options?: { keepRunId?: boolean }) => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setLaunchDecisionResult(null);
    setRunError('');
    setRestoreNotice('');
    setCanceling(false);
    setResult(null);
    setStreamState(createEmptyStreamState());
    setWorkspaceSaveError('');
    setWorkspaceSaveResult(null);
    setPlaybookPromotionError('');
    setPlaybookPromotionNotice('');
    if (!options?.keepRunId) {
      setActiveRunId('');
      workspaceTaskNamePrefillRunIdRef.current = '';
    }
  }, []);

  const promotePlaybookCandidates = useCallback(async () => {
    const projectUid = playbookPromotionProjectUid.trim();
    const candidates = displayReview?.playbookCandidates || [];
    if (!projectUid || candidates.length === 0) {
      return;
    }

    setPlaybookPromotionSaving(true);
    setPlaybookPromotionError('');
    setPlaybookPromotionNotice('');
    try {
      const response = await mergeProjectRecipesFromPlaybookCandidates(projectUid, candidates);
      const totalChanged = (response.result.addedRecipeSlugs?.length || 0) + (response.result.updatedRecipeSlugs?.length || 0);
      const skippedCount = response.result.skippedRecipeSlugs?.length || 0;
      setPlaybookPromotionNotice(
        [
          `已写入 ${totalChanged} 条 project recipe`,
          skippedCount > 0 ? `跳过 ${skippedCount} 条` : '',
          response.result.writtenTo ? `目标：${response.result.writtenTo}` : '',
          response.auditWarning ? `audit：${response.auditWarning}` : '',
        ]
          .filter(Boolean)
          .join('；')
      );
    } catch (error: unknown) {
      setPlaybookPromotionError(error instanceof Error ? error.message : '沉淀 playbook 到项目 recipe 失败');
    } finally {
      setPlaybookPromotionSaving(false);
    }
  }, [displayReview, playbookPromotionProjectUid]);

  useEffect(() => {
    if (embedded || typeof window === 'undefined' || !restoreChecked) return;

    if (activeRunId) {
      window.sessionStorage.setItem(RUN_ID_STORAGE_KEY, activeRunId);
      return;
    }

    window.sessionStorage.removeItem(RUN_ID_STORAGE_KEY);
  }, [activeRunId, restoreChecked]);

  useEffect(() => {
    if (embedded) {
      setRestoreChecked(true);
      return;
    }
    if (typeof window === 'undefined') return;

    let active = true;

    async function restoreRun() {
      const requestedRunId = searchRequestedRunId.trim();
      if (!requestedRunId || requestedRunId === activeRunId) {
        return;
      }

      try {
        const run = await fetchIntentRunRecord(requestedRunId);
        if (!active) return;

        applyRunRecord(run);
        await hydrateLaunchFormFromRun(run);
        window.sessionStorage.setItem(RUN_ID_STORAGE_KEY, run.runId);
        if (!isTerminalRunStatus(run.status)) {
          await startRunStream(run.runId, run.events.length);
        }
      } catch (error: unknown) {
        if (!active) return;
        window.sessionStorage.removeItem(RUN_ID_STORAGE_KEY);
        setActiveRunId('');
        setRunning(false);
        setCanceling(false);
        const message = error instanceof Error ? error.message : '恢复自动测试运行失败';
        if (message === '运行不存在') {
          setRunError('');
          removeRunIdFromUrl();
          try {
            const restored = await restoreLaunchFormFromDraft('该次运行记录已失效，已自动恢复为当前意图草稿，可直接重新开始自动测试。');
            if (!restored) {
              setRestoreNotice('该次运行记录已失效，请重新开始自动测试。');
            }
          } catch (draftError: unknown) {
            setRunError(draftError instanceof Error ? draftError.message : '恢复意图草稿失败');
          }
        } else {
          setRunError(message);
        }
      } finally {
        if (active) setRestoreChecked(true);
      }
    }

    void restoreRun();

    return () => {
      active = false;
    };
  }, [activeRunId, applyRunRecord, embedded, hydrateLaunchFormFromRun, removeRunIdFromUrl, restoreLaunchFormFromDraft, searchRequestedRunId, startRunStream]);

  useEffect(() => {
    if (embedded) {
      setRestoreChecked(true);
      return;
    }
    if (typeof window === 'undefined') return;
    if (searchRequestedRunId.trim()) return;
    if (searchDraftLaunchMode === INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE) {
      setRestoreChecked(true);
      return;
    }
    if (shouldTreatQueryLaunchDecisionAsHardBlock(searchLaunchDecision, { intentDraftUid: searchIntentDraftUid })) {
      window.sessionStorage.removeItem(RUN_ID_STORAGE_KEY);
      setRestoreChecked(true);
      return;
    }

    let active = true;

    async function restoreRun() {
      const storedRunId = window.sessionStorage.getItem(RUN_ID_STORAGE_KEY)?.trim();
      if (!storedRunId) {
        if (active) setRestoreChecked(true);
        return;
      }

      try {
        const run = await fetchIntentRunRecord(storedRunId);
        if (!active) return;

        applyRunRecord(run);
        await hydrateLaunchFormFromRun(run);
        if (!isTerminalRunStatus(run.status)) {
          await startRunStream(run.runId, run.events.length);
        }
      } catch (error: unknown) {
        if (!active) return;
        window.sessionStorage.removeItem(RUN_ID_STORAGE_KEY);
        setActiveRunId('');
        setRunning(false);
        setCanceling(false);
        const message = error instanceof Error ? error.message : '恢复自动测试运行失败';
        if (message === '运行不存在') {
          setRunError('');
          try {
            const restored = await restoreLaunchFormFromDraft('上次运行记录已失效，已恢复为当前意图草稿，可直接重新开始自动测试。');
            if (!restored) {
              setRestoreNotice('上次运行记录已失效，请重新开始自动测试。');
            }
          } catch (draftError: unknown) {
            setRunError(draftError instanceof Error ? draftError.message : '恢复意图草稿失败');
          }
        } else {
          setRunError(message);
        }
      } finally {
        if (active) setRestoreChecked(true);
      }
    }

    void restoreRun();

    return () => {
      active = false;
    };
  }, [
    applyRunRecord,
    embedded,
    hydrateLaunchFormFromRun,
    restoreLaunchFormFromDraft,
    searchDraftLaunchMode,
    searchIntentDraftUid,
    searchLaunchDecision,
    searchRequestedRunId,
    startRunStream,
  ]);

  useEffect(() => {
    if (embedded) return;
    if (searchDraftLaunchMode !== INTENT_DRAFT_TEST_FLOW_LAUNCH_MODE) return;
    if (searchRequestedRunId.trim() || activeRunId) return;

    const projectUid = searchWorkspaceProjectUid.trim();
    const draftUid = searchIntentDraftUid.trim();
    const draftDetail = draftLaunchDetailRef.current;
    const payload = draftDetail
      ? buildIntentDraftLaunchPayload(draftDetail, {
          fallbackProjectUid: projectUid,
          fallbackModuleUid: searchWorkspaceModuleUid.trim() || workspaceModuleUid,
          llmConfig,
        })
      : null;
    const autoLaunchGate = resolveIntentDraftAutoLaunchGate({
      projectUid,
      draftUid,
      hydratedKey: draftLaunchHydratedKey,
      handledKey: draftAutoLaunchHandledKeyRef.current,
      pendingKey: draftAutoLaunchPendingKeyRef.current,
      draftDetailReady: Boolean(draftDetail),
      payloadReady: Boolean(payload),
    });

    if (autoLaunchGate.status === 'wait' || autoLaunchGate.status === 'pending') {
      return;
    }

    if (autoLaunchGate.status === 'invalid_payload' || !payload) {
      draftAutoLaunchPendingKeyRef.current = '';
      draftAutoLaunchHandledKeyRef.current = autoLaunchGate.draftKey;
      setRunning(false);
      setCanceling(false);
      setRunError('当前意图草稿缺少可执行的目标描述');
      replaceWorkbenchSearchParams((nextParams) => {
        nextParams.delete(INTENT_DRAFT_LAUNCH_QUERY_PARAM);
        nextParams.delete('launchDecision');
        nextParams.delete('launchReason');
      });
      return;
    }

    draftAutoLaunchPendingKeyRef.current = autoLaunchGate.draftKey;
    const launchPayload = payload;
    const launchDraftKey = autoLaunchGate.draftKey;
    const launchRequestSeq = draftAutoLaunchRequestSeqRef.current + 1;
    draftAutoLaunchRequestSeqRef.current = launchRequestSeq;

    async function autoLaunchDraftFlow() {
      const isStaleRequest = () =>
        !workbenchMountedRef.current || draftAutoLaunchRequestSeqRef.current !== launchRequestSeq;

      clearExecutionState();
      setRunning(true);
      setCanceling(false);
      setRunError('');
      setStreamState({
        ...createEmptyStreamState(),
        stage: 'received',
        message: '正在评估启动条件…',
        feed: [{ id: createFeedId(), tone: 'info', text: '正在评估启动条件…' }],
      });

      try {
        const launchDecision = await requestIntentLaunchDecision(launchPayload);
        if (launchDecision.decision !== 'auto_run' && !shouldOverrideDraftAutoRunLaunchDecision(launchDecision.decision)) {
          if (isStaleRequest()) return;
          draftAutoLaunchPendingKeyRef.current = '';
          draftAutoLaunchHandledKeyRef.current = launchDraftKey;
          applyBlockedLaunchDecision(launchDecision, {
            source: 'route',
            syncQuery: true,
          });
          return;
        }

        if (isStaleRequest()) return;
        if (launchDecision.decision === 'draft_only') {
          setRestoreNotice('检测到最近相似任务失败压力偏高；这次来自草稿页的显式“测试流程”启动，已继续开跑。');
        }

        setRunning(true);
        setStreamState({
          ...createEmptyStreamState(),
          stage: 'received',
          message: '正在创建服务端运行…',
          feed: [{ id: createFeedId(), tone: 'info', text: '正在创建服务端运行…' }],
        });

        const run = await createIntentRun(launchPayload);
        if (isStaleRequest()) return;
        draftAutoLaunchPendingKeyRef.current = '';
        draftAutoLaunchHandledKeyRef.current = launchDraftKey;
        applyRunRecord(run);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(RUN_ID_STORAGE_KEY, run.runId);
        }
        replaceWorkbenchSearchParams((nextParams) => {
          nextParams.delete(INTENT_DRAFT_LAUNCH_QUERY_PARAM);
          nextParams.delete('launchDecision');
          nextParams.delete('launchReason');
          nextParams.set('runId', run.runId);
        });
        await startRunStream(run.runId, run.events.length);
      } catch (error: unknown) {
        if (isStaleRequest()) return;
        draftAutoLaunchPendingKeyRef.current = '';
        draftAutoLaunchHandledKeyRef.current = launchDraftKey;
        setRunning(false);
        setCanceling(false);
        setRunError(error instanceof Error ? error.message : 'AI 意图驱动 E2E 执行失败');
        replaceWorkbenchSearchParams((nextParams) => {
          nextParams.delete(INTENT_DRAFT_LAUNCH_QUERY_PARAM);
        });
      }
    }

    void autoLaunchDraftFlow();
  }, [
    activeRunId,
    applyBlockedLaunchDecision,
    applyRunRecord,
    clearExecutionState,
    draftLaunchHydratedKey,
    embedded,
    replaceWorkbenchSearchParams,
    searchDraftLaunchMode,
    searchIntentDraftUid,
    searchRequestedRunId,
    searchWorkspaceModuleUid,
    searchWorkspaceProjectUid,
    startRunStream,
    llmConfig,
    workspaceModuleUid,
  ]);

  useEffect(() => {
    workbenchMountedRef.current = true;
    return () => {
      workbenchMountedRef.current = false;
      streamAbortRef.current?.abort();
    };
  }, []);

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    const availableSlots = Math.max(0, 4 - attachments.length);
    const selectedFiles = files.slice(0, availableSlots);
    if (selectedFiles.length === 0) return;

    const nextItems = await Promise.all(
      selectedFiles.map(async (file) => ({
        id: createDraftId(),
        name: file.name,
        dataUrl: await readFileAsDataUrl(file),
        purpose: '',
      }))
    );

    setAttachments((current) => [...current, ...nextItems]);
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((item) => item.id !== id));
  }

  function updateAttachmentPurpose(id: string, purpose: string) {
    setAttachments((current) => current.map((item) => (item.id === id ? { ...item, purpose } : item)));
  }

  function resetLlmConfig() {
    if (!configResponse) return;
    setLlmConfig(toLlmDraft(configResponse.llm));
  }

  function replaceKnowledgeDraftPreview(draft: IntentProjectKnowledgeDraft) {
    setKnowledgeDraftPreview(draft);
    setKnowledgeDraftSelectedCandidateIds(defaultKnowledgeDraftCandidateIds(draft));
  }

  function upsertKnowledgeAuditEntry(entry?: ProjectKnowledgeAuditItem) {
    if (!entry) return;
    setKnowledgeAudits((current) => {
      const next = [entry, ...current.filter((item) => item.auditId !== entry.auditId)];
      return next.slice(0, 12);
    });
  }

  function toggleKnowledgeDraftCandidate(candidateId: string) {
    setKnowledgeDraftSelectedCandidateIds((current) =>
      current.includes(candidateId) ? current.filter((item) => item !== candidateId) : [...current, candidateId]
    );
  }

  function selectAllKnowledgeDraftCandidates() {
    if (!knowledgeDraftPreview) return;
    setKnowledgeDraftSelectedCandidateIds(defaultKnowledgeDraftCandidateIds(knowledgeDraftPreview));
  }

  function selectAllMergeableKnowledgeDraftCandidates() {
    if (!knowledgeDraftPreview) return;
    setKnowledgeDraftSelectedCandidateIds(allMergeableKnowledgeDraftCandidateIds(knowledgeDraftPreview));
  }

  function clearKnowledgeDraftSelection() {
    setKnowledgeDraftSelectedCandidateIds([]);
  }

  async function restoreRollbackCandidate(candidate: IntentE2EInsightRollbackCandidate) {
    if (!candidate.backupPath || knowledgeDraftBusy) return;
    const scopeLabel = candidate.projectUid || workspaceProjectUid || '当前规则集';
    const confirmed = confirm(
      [
        `确认回滚到候选备份？`,
        `范围：${scopeLabel}`,
        `合并：${candidate.title}`,
        `通过率：${formatRatePercent(candidate.beforePassRate)} -> ${formatRatePercent(candidate.afterPassRate)}`,
        `备份：${candidate.backupPath}`,
      ].join('\n')
    );
    if (!confirmed) return;
    await restoreProjectKnowledgeBackup(candidate.backupPath, candidate.projectUid || workspaceProjectUid);
  }

  async function restoreProbationRule(candidate: IntentE2EInsightProbationRule) {
    if (!candidate.backupPath || knowledgeDraftBusy) return;
    const scopeLabel = candidate.projectUid || workspaceProjectUid || '当前规则集';
    const confirmed = confirm(
      [
        `确认回滚观察期规则？`,
        `范围：${scopeLabel}`,
        `合并：${candidate.title}`,
        `观察期通过率：${formatRatePercent(candidate.observedPassRate)}`,
        `备份：${candidate.backupPath}`,
      ].join('\n')
    );
    if (!confirmed) return;
    await restoreProjectKnowledgeBackup(candidate.backupPath, candidate.projectUid || workspaceProjectUid);
  }

  async function refreshIntentE2EInsights(options?: { silent?: boolean }) {
    if (insightsLoading) return;

    setInsightsLoading(true);
    if (!options?.silent) {
      setInsightsError('');
    }

    try {
      const result = await fetchIntentE2EInsights(workspaceProjectUid);
      setInsights(result);
      setInsightsError('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '读取意图执行洞察失败';
      if (!options?.silent) {
        setInsightsError(message);
        setStreamState((current) => ({
          ...current,
          feed: pushFeed(current.feed, message, 'error'),
        }));
      }
    } finally {
      setInsightsLoading(false);
    }
  }

  async function refreshIntentE2EReleaseStatus(options?: { silent?: boolean }) {
    if (releaseStatusLoading) return;

    setReleaseStatusLoading(true);
    if (!options?.silent) {
      setReleaseStatusError('');
    }

    try {
      const result = await fetchIntentE2EReleaseStatus(workspaceProjectUid);
      setReleaseStatus(result);
      setReleaseStatusError('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '读取发布状态失败';
      if (!options?.silent) {
        setReleaseStatusError(message);
        setStreamState((current) => ({
          ...current,
          feed: pushFeed(current.feed, message, 'warning'),
        }));
      }
    } finally {
      setReleaseStatusLoading(false);
    }
  }

  async function refreshProjectKnowledgeAudits(options?: { silent?: boolean }) {
    if (knowledgeAuditsLoading) return;

    setKnowledgeAuditsLoading(true);
    if (!options?.silent) {
      setKnowledgeDraftError('');
    }

    try {
      const result = await fetchProjectKnowledgeAudits(12, workspaceProjectUid);
      setKnowledgeAuditPath(result.auditLogPath);
      setKnowledgeAudits(result.items);
    } catch (error: unknown) {
      if (!options?.silent) {
        const message = error instanceof Error ? error.message : '读取项目知识审计失败';
        setKnowledgeDraftError(message);
        setStreamState((current) => ({
          ...current,
          feed: pushFeed(current.feed, message, 'error'),
        }));
      }
    } finally {
      setKnowledgeAuditsLoading(false);
    }
  }

  async function refreshProjectKnowledgeBackups(options?: { silent?: boolean }) {
    if (knowledgeBackupsLoading || knowledgeBackupRestoring) return;

    setKnowledgeBackupsLoading(true);
    if (!options?.silent) {
      setKnowledgeDraftError('');
    }

    try {
      const result = await fetchProjectKnowledgeBackups();
      setKnowledgeBackupDir(result.backupDir);
      setKnowledgeBackups(result.backups);
    } catch (error: unknown) {
      if (!options?.silent) {
        const message = error instanceof Error ? error.message : '读取项目知识备份列表失败';
        setKnowledgeDraftError(message);
        setStreamState((current) => ({
          ...current,
          feed: pushFeed(current.feed, message, 'error'),
        }));
      }
    } finally {
      setKnowledgeBackupsLoading(false);
    }
  }

  async function restoreProjectKnowledgeBackup(backupPath: string, projectUidOverride = '') {
    if (knowledgeDraftBusy) return;

    setKnowledgeBackupRestoring(true);
    setKnowledgeDraftError('');
    setKnowledgeMergeSelectionSummary(null);
    setKnowledgeMergePreflightSummary(null);
    setKnowledgeMergeReceipts([]);
    setKnowledgeAuditWarning('');
    setKnowledgeOverrideWarning('');
    setKnowledgeRiskAcknowledgementWarning('');
    setKnowledgeGuardrailWarning('');

    try {
      const restored = await restoreProjectKnowledgeBackupFromWorkbench(backupPath, projectUidOverride || workspaceProjectUid);
      const nextDraft = await fetchProjectKnowledgeDraftPreview({
        minSeenCount: knowledgeDraftMinSeenCount,
        minResolvedCount: knowledgeDraftMinResolvedCount,
        maxCandidates: knowledgeDraftMaxCandidates,
        projectUid: workspaceProjectUid || undefined,
        moduleUid: workspaceModuleUid || undefined,
      });

      replaceKnowledgeDraftPreview(nextDraft);
      setKnowledgeRestoredFrom(restored.restoredFrom);
      setKnowledgeRestoreBackupCreated(restored.backupCreated || '');
      setKnowledgeDraftMergedTo(restored.writtenTo);
      setKnowledgeDraftMergeBackupPath('');
      setKnowledgeDraftMergeDiffPreview('');
      setKnowledgeChangeOperation('restore');
      setKnowledgeChangeComparison(restored.comparison || null);
      setKnowledgeMergePreflightSummary(restored.preflightSummary || null);
      setKnowledgeMergeReceipts(restored.mergeReceipts || []);
      setKnowledgeAuditWarning(restored.auditWarning || '');
      upsertKnowledgeAuditEntry(restored.auditEntry);
      await refreshProjectKnowledgeBackups({ silent: true });
      await refreshProjectKnowledgeAudits({ silent: true });
      await refreshIntentE2EInsights({ silent: true });
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(
          current.feed,
          [
            `项目知识已从备份 ${restored.restoredFrom} 回滚`,
            restored.backupCreated ? `回滚前当前版本已备份到 ${restored.backupCreated}` : '',
            ...(restored.mergeReceipts || []).map((receipt) => `${receipt.title}：${receipt.message}`),
            restored.auditWarning &&
            !(restored.mergeReceipts || []).some((receipt) => receipt.kind === 'audit' && receipt.level === 'warning')
              ? `审计提醒：${restored.auditWarning}`
              : '',
          ]
            .filter(Boolean)
            .join('；'),
          'success'
        ),
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '恢复项目知识备份失败';
      setKnowledgeDraftError(message);
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(current.feed, message, 'error'),
      }));
    } finally {
      setKnowledgeBackupRestoring(false);
    }
  }

  async function previewProjectKnowledgeDraft() {
    if (knowledgeDraftBusy) return;

    setKnowledgeDraftLoading(true);
    setKnowledgeDraftError('');
    setKnowledgeDraftWrittenTo('');
    setKnowledgeDraftMergedTo('');
    setKnowledgeDraftMergeBackupPath('');
    setKnowledgeDraftMergeDiffPreview('');
    setKnowledgeChangeOperation('');
    setKnowledgeChangeComparison(null);
    setKnowledgeMergeSelectionSummary(null);
    setKnowledgeMergePreflightSummary(null);
    setKnowledgeMergeReceipts([]);
    setKnowledgeAuditWarning('');
    setKnowledgeOverrideWarning('');
    setKnowledgeRiskAcknowledgementWarning('');
    setKnowledgeGuardrailWarning('');
    setKnowledgeRestoredFrom('');
    setKnowledgeRestoreBackupCreated('');

    try {
      const draft = await fetchProjectKnowledgeDraftPreview({
        minSeenCount: knowledgeDraftMinSeenCount,
        minResolvedCount: knowledgeDraftMinResolvedCount,
        maxCandidates: knowledgeDraftMaxCandidates,
        projectUid: workspaceProjectUid || undefined,
        moduleUid: workspaceModuleUid || undefined,
      });

      replaceKnowledgeDraftPreview(draft);
      await refreshProjectKnowledgeBackups({ silent: true });
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(
          current.feed,
          draft.candidates.length > 0
            ? `项目知识草稿预览已生成：建议新增 ${draft.summary.suggestedCandidates} 条，已覆盖 ${draft.summary.alreadyCoveredCandidates} 条${
                draft.candidates.filter((candidate) => isIntentProjectKnowledgeDraftCandidateDeferredByDefault(candidate)).length > 0
                  ? `，其中 ${draft.candidates.filter((candidate) => isIntentProjectKnowledgeDraftCandidateDeferredByDefault(candidate)).length} 条默认为保守复核项`
                  : ''
              }。`
            : '项目知识草稿预览已生成：当前没有新的候选规则。',
          draft.candidates.length > 0 ? 'success' : 'info'
        ),
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '预览项目知识草稿失败';
      setKnowledgeDraftError(message);
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(current.feed, message, 'error'),
      }));
    } finally {
      setKnowledgeDraftLoading(false);
    }
  }

  async function writeProjectKnowledgeDraft() {
    if (knowledgeDraftBusy) return;

    setKnowledgeDraftWriting(true);
    setKnowledgeDraftError('');
    setKnowledgeDraftMergedTo('');
    setKnowledgeDraftMergeBackupPath('');
    setKnowledgeDraftMergeDiffPreview('');
    setKnowledgeChangeOperation('');
    setKnowledgeChangeComparison(null);
    setKnowledgeMergeSelectionSummary(null);
    setKnowledgeMergePreflightSummary(null);
    setKnowledgeMergeReceipts([]);
    setKnowledgeAuditWarning('');
    setKnowledgeOverrideWarning('');
    setKnowledgeRiskAcknowledgementWarning('');
    setKnowledgeGuardrailWarning('');
    setKnowledgeRestoredFrom('');
    setKnowledgeRestoreBackupCreated('');

    try {
      const { draft, writtenTo } = await writeProjectKnowledgeDraftFromWorkbench({
        minSeenCount: knowledgeDraftMinSeenCount,
        minResolvedCount: knowledgeDraftMinResolvedCount,
        maxCandidates: knowledgeDraftMaxCandidates,
        projectUid: workspaceProjectUid || undefined,
        moduleUid: workspaceModuleUid || undefined,
      });

      const outputPath = writtenTo || draft.outputPath;
      replaceKnowledgeDraftPreview(draft);
      setKnowledgeDraftWrittenTo(outputPath);
      await refreshProjectKnowledgeBackups({ silent: true });
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(current.feed, `项目知识草稿已写出：${outputPath}`, 'success'),
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '写出项目知识草稿失败';
      setKnowledgeDraftError(message);
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(current.feed, message, 'error'),
      }));
    } finally {
      setKnowledgeDraftWriting(false);
    }
  }

  async function mergeProjectKnowledgeDraftCandidates() {
    if (knowledgeDraftBusy) return;

    if (knowledgeDraftSelectedCandidateIds.length === 0) {
      setKnowledgeDraftError('请先选择至少一条待合并候选规则；观察期、负向历史证据和自动降权项默认不会勾选，需要你手工确认。');
      return;
    }

    const preflightWarnings: string[] = [];
    if (knowledgeDraftSelectedBlockDefaultMergeCount > 0) {
      preflightWarnings.push(
        `本次选择包含 ${knowledgeDraftSelectedBlockDefaultMergeCount} 条“阻断默认合并”候选；提交后会以人工 override provenance 记录。`
      );
    } else if (knowledgeDraftSelectedManualReviewCount > 0) {
      preflightWarnings.push(
        `本次选择包含 ${knowledgeDraftSelectedManualReviewCount} 条自动降权候选；提交后会以人工 override provenance 记录。`
      );
    }
    if (knowledgeDraftSelectedProbationaryCount > 0) {
      preflightWarnings.push(
        `本次选择包含 ${knowledgeDraftSelectedProbationaryCount} 条观察期候选；提交后会写入风险确认 provenance。`
      );
    }
    if (knowledgeDraftSelectedNegativeHistoryDeferredCount > 0) {
      preflightWarnings.push(
        `本次选择包含 ${knowledgeDraftSelectedNegativeHistoryDeferredCount} 条存在负向历史证据的候选；虽然不会强制 override，但建议先复核对应 grader / rollback 记录。`
      );
    }
    if (knowledgeDraftSelectedAutoPromoteCount > 0) {
      preflightWarnings.push(`其中 ${knowledgeDraftSelectedAutoPromoteCount} 条属于“自动晋升候选”，会沿推荐路径直接纳入本次 merge。`);
    }

    if (preflightWarnings.length > 0) {
      const selectedRuleSummary = knowledgeDraftDisplayCandidates
        .filter((candidate) => knowledgeDraftSelectedCandidateIdSet.has(candidate.candidateId))
        .slice(0, 3)
        .map((candidate) => candidate.rule.id)
        .join(' / ');
      const confirmed = confirm(
        [
          '确认按当前预检结果继续合并吗？',
          ...preflightWarnings,
          selectedRuleSummary ? `候选规则：${selectedRuleSummary}${knowledgeDraftSelectedCount > 3 ? ' 等' : ''}` : '',
          '建议先小范围验证，并持续观察首次通过率、修复率和回滚候选变化。',
        ]
          .filter(Boolean)
          .join('\n')
      );
      if (!confirmed) {
        setKnowledgeDraftError('已取消合并；请先确认本次 override / 风险确认范围后再提交。');
        return;
      }
    }

    setKnowledgeDraftMerging(true);
    setKnowledgeDraftError('');
    setKnowledgeRestoredFrom('');
    setKnowledgeRestoreBackupCreated('');
    setKnowledgeMergeSelectionSummary(null);
    setKnowledgeMergePreflightSummary(null);
    setKnowledgeMergeReceipts([]);
    setKnowledgeAuditWarning('');
    setKnowledgeOverrideWarning('');
    setKnowledgeRiskAcknowledgementWarning('');
    setKnowledgeGuardrailWarning('');

    try {
      const merged = await mergeProjectKnowledgeFromWorkbench({
        minSeenCount: knowledgeDraftMinSeenCount,
        minResolvedCount: knowledgeDraftMinResolvedCount,
        maxCandidates: knowledgeDraftMaxCandidates,
        candidateIds: knowledgeDraftSelectedCandidateIds,
        overrideCandidateIds: knowledgeDraftSelectedOverrideCandidateIds,
        acknowledgedRiskCandidateIds: knowledgeDraftSelectedProbationaryCandidateIds,
        projectUid: workspaceProjectUid || undefined,
        moduleUid: workspaceModuleUid || undefined,
      });

      replaceKnowledgeDraftPreview(merged.draft);
      setKnowledgeDraftMergedTo(merged.mergedTo);
      setKnowledgeDraftMergeBackupPath(merged.backupPath || '');
      setKnowledgeDraftMergeDiffPreview(merged.diffPreview || '');
      setKnowledgeChangeOperation('merge');
      setKnowledgeChangeComparison(merged.comparison || null);
      setKnowledgeMergeSelectionSummary(merged.selectionSummary || null);
      setKnowledgeMergePreflightSummary(merged.preflightSummary || null);
      setKnowledgeMergeReceipts(merged.mergeReceipts || []);
      setKnowledgeAuditWarning(merged.auditWarning || '');
      setKnowledgeOverrideWarning(merged.overrideWarning || '');
      setKnowledgeRiskAcknowledgementWarning(merged.riskAcknowledgementWarning || '');
      setKnowledgeGuardrailWarning(merged.guardrailWarning || '');
      upsertKnowledgeAuditEntry(merged.auditEntry);
      await refreshProjectKnowledgeBackups({ silent: true });
      await refreshProjectKnowledgeAudits({ silent: true });
      await refreshIntentE2EInsights({ silent: true });
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(
          current.feed,
          [
            `项目知识已合并 ${merged.addedRuleIds.length} 条规则到 ${merged.mergedTo}`,
            merged.backupPath ? `已自动备份到 ${merged.backupPath}` : '',
            merged.coveredCandidateIds.length > 0 ? `已跳过 ${merged.coveredCandidateIds.length} 条已覆盖候选` : '',
            merged.skippedRuleIds.length > 0 ? `已跳过 ${merged.skippedRuleIds.length} 条重复规则` : '',
            merged.missingCandidateIds.length > 0 ? `有 ${merged.missingCandidateIds.length} 条候选已失效` : '',
            summarizeSuccessfulRunKnowledgePromotionReceipt(merged.successfulRunKnowledgePromotionReceipt),
            ...(merged.mergeReceipts || []).map((receipt) => `${receipt.title}：${receipt.message}`),
            merged.auditWarning && !(merged.mergeReceipts || []).some((receipt) => receipt.kind === 'audit')
              ? `审计提醒：${merged.auditWarning}`
              : '',
            merged.overrideWarning && !(merged.mergeReceipts || []).some((receipt) => receipt.kind === 'override')
              ? `Override 提醒：${merged.overrideWarning}`
              : '',
            merged.riskAcknowledgementWarning && !(merged.mergeReceipts || []).some((receipt) => receipt.kind === 'risk_acknowledgement')
              ? `风险确认：${merged.riskAcknowledgementWarning}`
              : '',
            merged.guardrailWarning && !(merged.mergeReceipts || []).some((receipt) => receipt.kind === 'guardrail')
              ? `护栏提醒：${merged.guardrailWarning}`
              : '',
          ]
            .filter(Boolean)
            .join('；'),
          merged.addedRuleIds.length > 0 ? 'success' : 'info'
        ),
      }));
    } catch (error: unknown) {
      if (error instanceof ProjectKnowledgeMergeError && error.response) {
        setKnowledgeMergeSelectionSummary(error.response.selectionSummary || null);
        setKnowledgeMergePreflightSummary(error.response.preflightSummary || null);
        setKnowledgeMergeReceipts(error.response.mergeReceipts || []);
        setKnowledgeAuditWarning(error.response.auditWarning || '');
        setKnowledgeOverrideWarning(error.response.overrideWarning || '');
        setKnowledgeRiskAcknowledgementWarning(error.response.riskAcknowledgementWarning || '');
        setKnowledgeGuardrailWarning(error.response.guardrailWarning || '');
      }
      const message = error instanceof Error ? error.message : '合并项目知识规则失败';
      setKnowledgeDraftError(message);
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(current.feed, message, 'error'),
      }));
    } finally {
      setKnowledgeDraftMerging(false);
    }
  }

  async function persistRunToWorkspace(options?: {
    mode?: WorkspaceSaveMode;
    configUid?: string;
    taskName?: string;
    navigateTo?: 'workspace' | 'history' | 'run';
  }) {
    if (!activeRunId || !displayFinalResult) return;

    if (!workspaceProjectUid) {
      setWorkspaceSaveError('请先选择一个项目');
      setWorkbenchCollapsed(false);
      setRailView('workspace');
      return;
    }
    if (!workspaceModuleUid) {
      setWorkspaceSaveError('请先选择一个模块');
      setWorkbenchCollapsed(false);
      setRailView('workspace');
      return;
    }
    const effectiveMode = options?.mode || workspaceSaveMode;
    const effectiveTaskName = options?.taskName?.trim() || workspaceTaskName.trim();
    const effectiveConfigUid = options?.configUid?.trim() || workspaceConfigUid;

    if (effectiveMode === 'new' && !effectiveTaskName) {
      setWorkspaceSaveError('请先填写任务名称');
      setWorkbenchCollapsed(false);
      setRailView('workspace');
      return;
    }
    if (effectiveMode === 'existing' && !effectiveConfigUid) {
      setWorkspaceSaveError('请先选择一个已有任务');
      setWorkbenchCollapsed(false);
      setRailView('workspace');
      return;
    }

    setWorkspaceSaving(true);
    setWorkspaceSaveError('');
    setWorkspaceSaveResult(null);

    try {
      const item = await persistIntentRunToWorkspaceRequest(activeRunId, {
        projectUid: workspaceProjectUid,
        moduleUid: workspaceModuleUid,
        configUid: effectiveMode === 'existing' ? effectiveConfigUid : undefined,
        taskName: effectiveMode === 'new' ? effectiveTaskName : undefined,
        auth: hasAuthContent(auth)
          ? {
              loginUrl: auth.loginUrl.trim(),
              username: auth.username.trim(),
              password: auth.password,
              loginDescription: auth.loginDescription.trim(),
            }
          : undefined,
      });

      setWorkspaceSaveMode('existing');
      setWorkspaceConfigUid(item.configUid);
      setWorkspaceSaveResult(item);
      const refreshedTasks = await fetchWorkspaceTasks(item.projectUid, item.moduleUid).catch(() => null);
      if (refreshedTasks) {
        setWorkspaceTasks(refreshedTasks);
      }
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(
          current.feed,
          item.createdConfig
            ? `已将当前意图运行保存为新任务「${item.configName}」并同步执行历史。`
            : `已将当前意图运行追加到任务「${item.configName}」的新脚本版本并同步执行历史。`,
          'success'
        ),
      }));

      if (options?.navigateTo) {
        const navigation = readExecutionEntryNavigationTargets(item);
        const destination =
          options.navigateTo === 'run'
            ? navigation.runPath
            : options.navigateTo === 'history'
              ? navigation.workspaceHistoryPath || navigation.workspacePath
              : navigation.workspacePath;
        if (destination) {
          router.push(destination);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '保存到项目工作台失败';
      setWorkspaceSaveError(message);
      setWorkbenchCollapsed(false);
      setRailView('workspace');
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(current.feed, message, 'error'),
      }));
    } finally {
      setWorkspaceSaving(false);
    }
  }

  function setAllStarterCapabilitiesSelected(selected: boolean) {
    setStarterCapabilitySelectedAssetSlugs(
      selected ? promotableStarterCapabilityLaunches.map((launch) => launch.asset.assetSlug) : []
    );
    setStarterCapabilitySaveError('');
    setStarterCapabilitySaveNotice('');
  }

  function toggleStarterCapabilitySelection(assetSlug: string) {
    const launch = starterCapabilityLaunches.find((item) => item.asset.assetSlug === assetSlug);
    if (!launch || !canPromoteIntentStarterAssetToProjectCapability(launch.asset)) {
      setStarterCapabilitySaveError('全局 runtime heuristic 已内置到执行环境，无需再直接沉淀到项目能力库。');
      setStarterCapabilitySaveNotice('');
      return;
    }

    setStarterCapabilitySelectedAssetSlugs((current) => {
      const next = new Set(current);
      if (next.has(assetSlug)) {
        next.delete(assetSlug);
      } else {
        next.add(assetSlug);
      }
      return promotableStarterCapabilityLaunches
        .map((launch) => launch.asset.assetSlug)
        .filter((item) => next.has(item));
    });
    setStarterCapabilitySaveError('');
    setStarterCapabilitySaveNotice('');
  }

  async function persistStarterCapabilitiesToProject() {
    if (!workspaceProjectUid) {
      setStarterCapabilitySaveError('请先选择一个项目');
      return;
    }
    if (selectedStarterCapabilityLaunches.length === 0) {
      setStarterCapabilitySaveError('请至少选择一条 Starter 资产');
      return;
    }

    setStarterCapabilitySaving(true);
    setStarterCapabilitySaveError('');
    setStarterCapabilitySaveNotice('');

    try {
      const persistableLaunches = selectedStarterCapabilityLaunches.filter((launch) => launch.promotable);
      if (persistableLaunches.length === 0) {
        throw new Error('当前没有可写入项目能力库的 Starter 资产');
      }
      const workspaceModuleName = workspaceModules.find((item) => item.moduleUid === workspaceModuleUid)?.name || '';
      const res = await fetch(`/api/projects/${workspaceProjectUid}/capabilities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: persistableLaunches.map((launch) => launch.preset),
          starterAssetPromotionReceipt: {
            sourceRunId: activeRunId,
            moduleUid: workspaceModuleUid,
            moduleName: workspaceModuleName,
            scenarioTitle: displayScenarioCard?.title?.trim() || '',
            targetUrl: (displayTargetUrl || '').trim(),
            items: persistableLaunches.map((launch) => ({
              assetSlug: launch.asset.assetSlug,
              assetTitle: launch.asset.assetTitle,
              helper: launch.asset.helper,
              source: launch.asset.source,
              scope: launch.asset.scope,
              capabilitySlug: launch.preset.slug,
              decisionStatus: launch.promotionDecision.status,
              decisionReasonCode: launch.promotionDecision.reasonCode,
              decisionReason: launch.promotionDecision.reason,
              autoSelected: launch.promotionDecision.autoSelected,
              recommendedAction: launch.promotionDecision.recommendedAction,
              runCount: launch.asset.runCount,
              passedRuns: launch.asset.passedRuns,
              passRate: launch.asset.passRate,
              suggestedReuseRuns: launch.asset.suggestedReuseRuns,
              supportingRuleIds: launch.asset.supportingRuleIds,
              supportingRuleTitles: launch.asset.supportingRuleTitles,
              matchedStepUids: launch.asset.matchedStepUids,
              knowledgeChangeSignal: launch.asset.knowledgeChangeSignal || '',
              knowledgeChangeTier: launch.asset.knowledgeChangeTier || '',
              knowledgeChangeWatchingKind: launch.asset.knowledgeChangeWatchingKind || '',
              knowledgeChangeDecisionableRuleCount: launch.asset.knowledgeChangeDecisionableRuleCount || 0,
              governanceReleaseStatus: launch.asset.governanceReleaseStatus || '',
              recentFailedReviewCapabilityCount: launch.asset.recentFailedReviewCapabilityCount || 0,
              recentFailedVerifyCapabilityCount: launch.asset.recentFailedVerifyCapabilityCount || 0,
              recentFailedReviewExecutionCount: launch.asset.recentFailedReviewExecutionCount || 0,
              recentFailedVerifyExecutionCount: launch.asset.recentFailedVerifyExecutionCount || 0,
              recentFailureWindowDays: launch.asset.recentFailureWindowDays || 0,
            })),
          },
        }),
      });
      const json = (await res.json()) as StarterCapabilityPersistResponse;
      if (!res.ok) {
        throw new Error(json.error || '批量保存 Starter 能力失败');
      }

      const savedItems = Array.isArray(json.items) ? json.items : [];
      const savedCount = savedItems.length || persistableLaunches.length;
      const receipt = json.starterAssetPromotionReceipt || null;
      const savedNames = savedItems
        .map((item) => String(item.name || '').trim())
        .filter(Boolean)
        .slice(0, 3);
      const message = [
        `已写入 ${savedCount} 条 Starter 能力草稿到项目 ${workspaceProjectUid}`,
        savedNames.length > 0 ? `包括 ${savedNames.join('、')}` : '',
        receipt
          ? `回执：直接沉淀 ${receipt.summary.directPromotionCount} 条${
              receipt.summary.manualReviewCount > 0 ? `，人工复核 ${receipt.summary.manualReviewCount} 条` : ''
            }`
          : '',
        json.starterAssetPromotionReceiptWarning ? `审计提醒：${json.starterAssetPromotionReceiptWarning}` : '',
      ]
        .filter(Boolean)
        .join('；');

      setStarterCapabilitySaveNotice(message);
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(
          current.feed,
          [
            `已将 ${savedCount} 条 Starter 资产沉淀到项目能力库：${persistableLaunches
              .map((launch) => launch.asset.assetTitle)
              .slice(0, 4)
              .join('、')}`,
            receipt ? `promotion receipt ${receipt.receiptId}` : '',
            json.starterAssetPromotionReceiptWarning ? `审计提醒：${json.starterAssetPromotionReceiptWarning}` : '',
          ]
            .filter(Boolean)
            .join('；'),
          'success'
        ),
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '批量保存 Starter 能力失败';
      setStarterCapabilitySaveError(message);
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(current.feed, message, 'error'),
      }));
    } finally {
      setStarterCapabilitySaving(false);
    }
  }

  async function stopIntentTest() {
    if (!running || !activeRunId || canceling) return;

    setCanceling(true);
    setRunError('');
    setStreamState((current) => ({
      ...current,
      message: '已向服务端发送停止请求，正在等待当前运行结束。',
      feed: pushFeed(current.feed, '已向服务端发送停止请求，正在等待当前运行结束。'),
    }));

    try {
      const latestRun = await cancelIntentRunRequest(activeRunId);
      if (latestRun && isTerminalRunStatus(latestRun.status)) {
        applyRunRecord(latestRun);
      }
    } catch (error: unknown) {
      setCanceling(false);
      setRunError(error instanceof Error ? error.message : '停止当前自动测试失败');
    }
  }

  const buildCurrentLaunchPayload = useCallback((): Record<string, unknown> => {
    const intentDraftUid = launchedFromIntentDraft ? searchIntentDraftUid.trim() : '';
    const draftDetail = launchedFromIntentDraft ? draftLaunchDetailRef.current : null;
    const draftScenarioLlmMeta = draftDetail?.scenarioLlmMeta || {};
    const draftPlanCode = draftDetail?.planCode.trim() || '';

    return {
      input: input.trim(),
      targetUrl: targetUrl.trim(),
      projectUid: defaultWorkspaceProjectUid || undefined,
      moduleUid: workspaceModuleUid || undefined,
      intentDraftUid: intentDraftUid || undefined,
      prefilledScenarioCard: draftDetail?.scenarioCard || undefined,
      prefilledScenarioLlmMeta: Object.keys(draftScenarioLlmMeta).length > 0 ? draftScenarioLlmMeta : undefined,
      prefilledPlanCode: draftPlanCode || undefined,
      attachments: attachments.map((item) => ({
        name: item.name,
        dataUrl: item.dataUrl,
        purpose: item.purpose.trim(),
      })),
      auth: hasAuthContent(auth)
        ? {
            loginUrl: auth.loginUrl.trim(),
            username: auth.username.trim(),
            password: auth.password,
            loginDescription: auth.loginDescription.trim(),
          }
        : undefined,
      llmConfig: {
        provider: llmConfig.provider,
        model: llmConfig.model.trim(),
        baseUrl: llmConfig.baseUrl.trim(),
        apiStyle: llmConfig.apiStyle,
        visionEnabled: llmConfig.visionEnabled,
        selfHealRetries: llmConfig.selfHealRetries,
        maxPlanSteps: llmConfig.maxPlanSteps,
      },
    };
  }, [attachments, auth, defaultWorkspaceProjectUid, input, launchedFromIntentDraft, llmConfig, searchIntentDraftUid, targetUrl, workspaceModuleUid]);

  const startIntentRunFromPayload = useCallback(
    async (payload: Record<string, unknown>, options?: { notice?: string }) => {
      setLaunchDecisionResult(null);
      setRunning(true);
      setCanceling(false);
      setRunError('');
      setStreamState({
        ...createEmptyStreamState(),
        stage: 'received',
        message: '正在创建服务端运行…',
        feed: [{ id: createFeedId(), tone: 'info', text: '正在创建服务端运行…' }],
      });

      try {
        const run = await createIntentRun(payload);
        applyRunRecord(run);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(RUN_ID_STORAGE_KEY, run.runId);
        }
        if (launchedFromIntentDraft) {
          replaceWorkbenchSearchParams((nextParams) => {
            nextParams.delete(INTENT_DRAFT_LAUNCH_QUERY_PARAM);
            nextParams.delete('launchDecision');
            nextParams.delete('launchReason');
            nextParams.set('runId', run.runId);
          });
        }
        if (options?.notice) {
          setRestoreNotice(options.notice);
        }
        await startRunStream(run.runId, run.events.length);
      } catch (error: unknown) {
        setRunning(false);
        setCanceling(false);
        setRunError(error instanceof Error ? error.message : 'AI 意图驱动 E2E 执行失败');
      }
    },
    [applyRunRecord, launchedFromIntentDraft, replaceWorkbenchSearchParams, startRunStream]
  );

  const overrideDraftOnlyLaunchDecision = useCallback(async () => {
    if (displayLaunchDecision?.decision !== 'draft_only') {
      return;
    }
    if (!input.trim()) {
      setRunError('请先输入一句测试目标描述');
      return;
    }

    clearBlockedLaunchDecision({ syncQuery: launchedFromIntentDraft });
    await startIntentRunFromPayload(buildCurrentLaunchPayload(), {
      notice: '已按你的显式选择继续开跑；系统仍保留“最近相似任务失败压力偏高”的提醒。',
    });
  }, [
    buildCurrentLaunchPayload,
    clearBlockedLaunchDecision,
    displayLaunchDecision?.decision,
    input,
    launchedFromIntentDraft,
    startIntentRunFromPayload,
  ]);

  async function runIntentTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!input.trim()) {
      setRunError('请先输入一句测试目标描述');
      return;
    }

    if (!providerIsImplemented) {
      setRunError(`当前 provider=${llmConfig.provider} 仅预留配置位，仓库还没实现对应适配器，请先切回 openai。`);
      return;
    }

    clearExecutionState();
    clearBlockedLaunchDecision({ syncQuery: launchedFromIntentDraft });
    const payload = buildCurrentLaunchPayload();

    try {
      const launchDecision = await requestIntentLaunchDecision(payload);
      if (launchDecision.decision !== 'auto_run') {
        applyBlockedLaunchDecision(launchDecision, {
          source: 'route',
          syncQuery: launchedFromIntentDraft,
        });
        return;
      }
      await startIntentRunFromPayload(payload);
    } catch (error: unknown) {
      setRunning(false);
      setCanceling(false);
      setRunError(error instanceof Error ? error.message : 'AI 意图驱动 E2E 执行失败');
    }
  }

  const releaseIssueChecks = releaseStatus?.checks.filter((item) => item.status !== 'passed') || [];
  const releaseIssueFamilies =
    releaseStatus?.families
      .map((family) => ({
        family,
        messages: releaseFamilyIssueMessages(family),
      }))
      .filter((item) => item.messages.length > 0) || [];
  const releaseStatusBlockingCheckCount = releaseIssueChecks.filter((item) => item.blocking).length;
  const releaseStatusHasNoIssues = Boolean(releaseStatus && releaseIssueChecks.length === 0 && releaseIssueFamilies.length === 0);
  const releaseStatusErrorHeading = releaseStatusError ? releaseStatusErrorTitle(releaseStatusError) : '';
  const releaseStatusErrorBody = releaseStatusError ? releaseStatusErrorDescription(releaseStatusError) : '';

  return (
    <main
      className={`intent-e2e-workbench relative isolate bg-[linear-gradient(180deg,#edf4ff_0%,#f4f8fd_42%,#eef4fb_100%)] font-['SF_Pro_Display','SF_Pro_Text','PingFang_SC','Helvetica_Neue',sans-serif] text-slate-900 ${
        embedded ? 'max-h-[80vh] overflow-y-auto overscroll-contain' : 'min-h-screen xl:h-screen xl:overflow-hidden'
      }`}
    >
      {!embedded && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[7%] top-14 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(148,163,184,0.18),rgba(148,163,184,0)_74%)] blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-[9%] top-8 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.14),rgba(96,165,250,0)_74%)] blur-3xl"
          />
        </>
      )}
      <div
        className={`intent-e2e-shell mx-auto ${
          embedded ? 'max-w-[1080px] px-3 py-3 md:px-4' : 'max-w-[1560px] px-4 py-6 md:px-6 lg:px-8 xl:h-full xl:px-10'
        }`}
      >
        <section
          className={`grid gap-4 ${
            embedded
              ? 'mt-3 lg:grid-cols-[minmax(0,1fr)_350px]'
              : showCollapsedWorkbenchRail
                ? 'mt-1 xl:h-full xl:min-h-0 xl:grid-cols-[56px_minmax(0,1fr)] xl:items-stretch'
                : 'mt-1 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(320px,25%)_minmax(0,75%)] xl:items-stretch'
          }`}
        >
          <form id={intentWorkbenchFormId} onSubmit={runIntentTest} className={embedded ? 'space-y-4' : 'xl:h-full xl:min-h-0'}>
            {embedded ? (
              renderIntentWorkbenchEditor({
                subtitle: '左侧输入任务，右侧查看执行、上下文与治理。',
              })
            ) : showCollapsedWorkbenchRail ? (
              <section className="intent-e2e-hero relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/90 px-2 py-3 text-slate-950 shadow-[0_18px_42px_rgba(15,23,42,0.06)] backdrop-blur xl:h-full">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.12),rgba(96,165,250,0)_74%)] blur-2xl"
                />
                <div className="relative flex h-full flex-col items-center justify-between">
                  <div className="flex w-full flex-col items-center gap-3 pt-1">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        running
                          ? 'bg-sky-500 shadow-[0_0_0_6px_rgba(56,189,248,0.16)]'
                          : displayFinalResult?.success
                            ? 'bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.14)]'
                            : displayFinalResult
                              ? 'bg-rose-500 shadow-[0_0_0_6px_rgba(244,63,94,0.14)]'
                              : 'bg-slate-300'
                      }`}
                    />
                    <span className="inline-flex min-h-[52px] items-center justify-center rounded-[16px] border border-slate-200 bg-slate-50 px-2 text-[10px] font-medium tracking-[0.12em] text-slate-500">
                      日志
                    </span>
                    {(runError || restoreNotice) && (
                      <span
                        title={runError || restoreNotice}
                        className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.16)]"
                      />
                    )}
                  </div>

                  <div className="my-4 w-px flex-1 bg-[linear-gradient(180deg,rgba(148,163,184,0),rgba(148,163,184,0.8),rgba(148,163,184,0))]" />

                  <div className="flex flex-col items-center gap-2 pb-1">
                    <button
                      type="button"
                      onClick={() => setWorkbenchCollapsed(false)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] border border-slate-200 bg-white text-[11px] font-medium leading-4 text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:text-slate-950"
                      title="展开左栏"
                    >
                      展开
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <section className="intent-e2e-feed-panel relative overflow-hidden rounded-[28px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,252,247,0.97),rgba(250,247,240,0.98))] px-5 py-5 text-stone-900 shadow-[0_18px_42px_rgba(44,37,28,0.06)] backdrop-blur md:px-6 md:py-6 xl:flex xl:h-full xl:min-h-0 xl:flex-col">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 top-6 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(217,199,163,0.18),transparent_74%)] blur-2xl"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-8 top-0 h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(194,183,164,0.14),transparent_72%)] blur-2xl"
                />
                <div className="relative flex min-h-0 flex-1 flex-col">
                  <div className="shrink-0">
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="text-[21px] font-semibold leading-[1.16] tracking-[-0.05em] text-stone-900 md:text-[27px]">实时日志</h2>
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${railStatusBadge.className}`}>
                        {railStatusBadge.label}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-2">
                      <Link
                        href={projectReturnHref}
                        className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-[14px] border border-stone-200 bg-white/70 px-3 text-[12px] font-medium text-stone-600 transition hover:border-stone-300 hover:bg-white hover:text-stone-900"
                      >
                        返回项目
                      </Link>
                      <button
                        type="button"
                        onClick={() => setRailView('workbench')}
                        className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-[14px] border border-stone-200 bg-white/70 px-3 text-[12px] font-medium text-stone-600 transition hover:border-stone-300 hover:bg-white hover:text-stone-900"
                      >
                        编辑任务
                      </button>
                      <button
                        type="button"
                        onClick={() => setRailView('live')}
                        className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-[14px] border border-sky-200 bg-sky-50 px-3 text-[12px] font-medium text-sky-700 transition hover:bg-sky-100"
                      >
                        查看画面
                      </button>
                      <button
                        type="button"
                        onClick={() => setWorkbenchCollapsed(true)}
                        className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-[14px] border border-stone-200 bg-white/70 px-3 text-[12px] font-medium text-stone-500 transition hover:border-stone-300 hover:bg-white hover:text-stone-800"
                        title="收起左栏"
                      >
                        收起
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex min-h-[540px] flex-1 flex-col overflow-hidden rounded-[24px] border border-stone-200/80 bg-gradient-to-b from-white/80 to-stone-50/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_14px_32px_rgba(44,37,28,0.05)] xl:min-h-0">
                    {/* Status header */}
                    <div className={`shrink-0 border-b border-stone-200/60 px-4 py-3 ${liveLogStatus.toneClassName}`}>
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={liveLogStatus.indicatorClassName} />
                            <p className="truncate text-[13px] font-semibold tracking-[-0.02em]">{liveLogStatus.title}</p>
                          </div>
                          <p className="mt-1 text-[11px] leading-[1.45] opacity-75">{liveLogStatus.detail}</p>
                        </div>
                        <span className="whitespace-nowrap rounded-full border border-current/10 bg-white/70 px-2 py-0.5 text-[10px] font-medium text-current">
                          {liveLogStatus.badgeLabel}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500">
                        <span className="inline-flex items-center rounded-full border border-stone-200 bg-white px-2 py-1 font-medium text-stone-700 shadow-[0_2px_8px_rgba(44,37,28,0.04)]">
                          {liveAttemptValue}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-stone-200/60 bg-white/60 px-2 py-1">
                          累计 {displayAttempts.length} 次
                        </span>
                        <span className="inline-flex items-center rounded-full border border-stone-200/60 bg-white/60 px-2 py-1">
                          最近 {streamState.feed.length} 条
                        </span>
                      </div>
                    </div>

                    {/* Feed items */}
                    {liveFeedItems.length > 0 ? (
                      <div
                        aria-live="polite"
                        className="intent-e2e-scroll min-h-0 flex-1 divide-y divide-stone-100 overflow-y-auto xl:overscroll-contain"
                      >
                        {liveFeedItems.map((item, index) => {
                          const parsed = parseFeedText(item.text);
                          const isLatest = index === 0;
                          const isStep = !!parsed.stepNum;
                          return (
                            <div
                              key={item.id}
                              className={`intent-feed-bubble px-4 py-2.5 ${isLatest ? 'bg-stone-50/50' : ''}`}
                            >
                              {isStep ? (
                                <div className="flex items-start gap-3">
                                  <span className={`mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${feedToneAccentClass(item.tone)} bg-current/[0.08]`}>
                                    <span className="relative text-current">{parsed.stepNum}</span>
                                  </span>
                                  <div className="min-w-0 pt-px">
                                    <p className="text-[13px] font-medium leading-snug text-stone-900">
                                      {isLatest ? <TypewriterText text={parsed.body} /> : parsed.body}
                                    </p>
                                    {parsed.status && (
                                      <p className={`mt-0.5 text-[11px] ${feedToneAccentClass(item.tone)}`}>
                                        {parsed.status === 'PASSED' ? '通过' : parsed.status === 'FAILED' ? '失败' : '执行中'}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-2.5">
                                  <span className={`mt-[6px] h-[5px] w-[5px] shrink-0 rounded-full ${isLatest ? 'animate-pulse' : ''} ${feedToneDotClass(item.tone)}`} />
                                  <p className="min-w-0 text-[13px] leading-[1.55] text-stone-500">
                                    {isLatest ? <TypewriterText text={parsed.body} /> : parsed.body}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="intent-e2e-scroll flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-4 xl:overscroll-contain">
                        <div className="text-center">
                          <span className="mx-auto block h-2 w-2 rounded-full bg-stone-300 animate-pulse" />
                          <p className="mt-3 text-[13px] text-stone-400">等待执行</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {contextPortalHost &&
              createPortal(
              <div className="space-y-4">
                {embedded ? (
                  <section className="rounded-[24px] border border-sky-200 bg-sky-50/85 p-4 shadow-[0_12px_28px_rgba(56,189,248,0.09)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">统一登录认证</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {embeddedProjectAuth?.authRequired
                            ? '本弹框不会单独展示登录信息表单；执行时会默认复用当前项目配置的统一登录认证。'
                            : '当前项目还没有配置统一登录认证；本弹框不再单独展示登录信息表单，如需登录请先到项目设置里配置统一认证。'}
                        </p>
                      </div>
                      <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs text-sky-700">
                        {embeddedProjectAuth?.authRequired ? '默认复用项目认证' : '未配置项目认证'}
                      </span>
                    </div>
                    {embeddedProjectAuth?.loginDescription && (
                      <div className="mt-3 rounded-2xl border border-sky-100 bg-white/80 px-3 py-3 text-xs leading-5 text-slate-600">
                        {embeddedProjectAuth.loginDescription}
                      </div>
                    )}
                  </section>
                ) : (
                  <>
                    {standaloneHasProjectContext && (
                      <section className="rounded-[24px] border border-sky-200 bg-sky-50/85 p-4 shadow-[0_12px_28px_rgba(56,189,248,0.09)]">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">项目统一认证</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              {standaloneProjectAuthLoadingState
                                ? `正在同步项目「${standaloneProjectAuthProjectLabel}」的统一登录配置。`
                                : standaloneUsesProjectAuth
                                  ? `当前页已同步项目「${standaloneProjectAuthProjectLabel}」的统一登录认证；执行时会默认复用。`
                                  : `项目「${standaloneProjectAuthProjectLabel}」当前未开启统一登录认证；如需登录，请在下方补充本次运行的登录信息。`}
                            </p>
                          </div>
                          <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs text-sky-700">
                            {standaloneProjectAuthLoadingState
                              ? '同步中'
                              : standaloneUsesProjectAuth
                                ? '默认复用项目认证'
                                : '未配置项目认证'}
                          </span>
                        </div>

                        {projectAuthSummaryError && (
                          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-700">
                            读取项目认证摘要失败：{projectAuthSummaryError}。这不会影响服务端在执行时复用项目统一认证，只影响当前页展示。
                          </div>
                        )}

                        {!standaloneProjectAuthLoadingState && standaloneUsesProjectAuth && activeProjectAuthSummary && (
                          <>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <div className="rounded-2xl border border-sky-100 bg-white/85 px-3 py-3">
                                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700">登录 URL</p>
                                <p className="mt-2 break-all text-sm leading-6 text-slate-700">
                                  {activeProjectAuthSummary.loginUrl.trim() || '未配置'}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-sky-100 bg-white/85 px-3 py-3">
                                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700">用户名</p>
                                <p className="mt-2 break-all text-sm leading-6 text-slate-700">
                                  {activeProjectAuthSummary.loginUsername.trim() || '未配置'}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 rounded-2xl border border-sky-100 bg-white/85 px-3 py-3">
                              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-700">登录说明</p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                {activeProjectAuthSummary.loginDescription.trim() || '未配置'}
                              </p>
                            </div>
                            <p className="mt-3 text-[11px] leading-5 text-slate-500">
                              密码已由项目统一认证托管，当前页不回显；如需临时覆盖本次运行，请在下方填写新的登录信息。
                            </p>
                          </>
                        )}
                      </section>
                    )}

                    <section className="intent-e2e-panel rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,251,255,0.95),rgba(242,247,253,0.96))] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {standaloneUsesProjectAuth ? '登录信息覆盖（可选）' : '登录信息（可选）'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {standaloneUsesProjectAuth
                              ? '留空则继续复用上方项目统一认证；如需临时覆盖本次运行，可补充账号、密码与登录说明。'
                              : standaloneHasProjectContext && activeProjectAuthSummary
                                ? '当前项目未配置统一认证；如果页面访问前必须登录，可在这里补充本次运行的登录信息。'
                                : '如果页面访问前必须登录，可以补充账号、密码与登录说明。'}
                          </p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
                          {standaloneUsesProjectAuth ? '留空则复用项目认证' : '可留空'}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="block">
                          <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">登录 URL</span>
                          <input
                            value={auth.loginUrl}
                            onChange={(targetEvent) => setAuth((current) => ({ ...current, loginUrl: targetEvent.target.value }))}
                            placeholder="https://example.com/login"
                            className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">用户名</span>
                          <input
                            value={auth.username}
                            onChange={(targetEvent) => setAuth((current) => ({ ...current, username: targetEvent.target.value }))}
                            placeholder="13800138000"
                            className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">密码</span>
                          <input
                            type="password"
                            value={auth.password}
                            onChange={(targetEvent) => setAuth((current) => ({ ...current, password: targetEvent.target.value }))}
                            placeholder="••••••••"
                            className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">登录说明</span>
                          <input
                            value={auth.loginDescription}
                            onChange={(targetEvent) => setAuth((current) => ({ ...current, loginDescription: targetEvent.target.value }))}
                            placeholder="例如：短信登录 / 密码登录 / SSO"
                            className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                          />
                        </label>
                      </div>
                    </section>
                  </>
                )}

                {!embedded && (
                  <section className="intent-e2e-panel rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,251,255,0.95),rgba(242,247,253,0.96))] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">LLM 配置</p>
                        <p className="mt-1 text-xs text-slate-500">默认值来自项目首页的团队共享配置；这里的修改只作用于当前页面和本次运行。</p>
                      </div>
                      <button
                        type="button"
                        onClick={resetLlmConfig}
                        disabled={!configResponse}
                        className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        恢复默认
                      </button>
                    </div>

                    {configLoading ? (
                      <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-400">正在加载配置…</div>
                    ) : configError ? (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{configError}</div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">模型服务商</span>
                            <select
                              value={llmConfig.provider}
                              onChange={(targetEvent) =>
                                setLlmConfig((current) => ({
                                  ...current,
                                  provider: targetEvent.target.value,
                                  providerImplemented: isLlmProviderImplemented(targetEvent.target.value, providerOptions),
                                }))
                              }
                              className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                            >
                              {providerOptions.map((item) => (
                                <option key={item.provider} value={item.provider}>
                                  {formatLlmProviderOption(item)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">API 风格</span>
                            <select
                              value={llmConfig.apiStyle}
                              onChange={(targetEvent) => setLlmConfig((current) => ({ ...current, apiStyle: targetEvent.target.value }))}
                              className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                            >
                              {(configResponse?.availableApiStyles || ['auto', 'responses', 'chat']).map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <label className="block">
                          <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Model</span>
                          <input
                            value={llmConfig.model}
                            onChange={(targetEvent) => setLlmConfig((current) => ({ ...current, model: targetEvent.target.value }))}
                            className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">基础 URL</span>
                          <input
                            value={llmConfig.baseUrl}
                            onChange={(targetEvent) => setLlmConfig((current) => ({ ...current, baseUrl: targetEvent.target.value }))}
                            className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                          />
                        </label>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">自愈重试次数</span>
                            <input
                              type="number"
                              min={0}
                              max={5}
                              value={llmConfig.selfHealRetries}
                              onChange={(targetEvent) =>
                                setLlmConfig((current) => ({ ...current, selfHealRetries: Math.max(0, Number(targetEvent.target.value) || 0) }))
                              }
                              className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">最大规划步数</span>
                            <input
                              type="number"
                              min={1}
                              max={12}
                              value={llmConfig.maxPlanSteps}
                              onChange={(targetEvent) =>
                                setLlmConfig((current) => ({ ...current, maxPlanSteps: Math.max(1, Number(targetEvent.target.value) || 1) }))
                              }
                              className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                            />
                          </label>
                        </div>

                        <label className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">Vision 开关</p>
                            <p className="mt-1 text-xs text-slate-500">关闭后，上传图片不会发给模型。</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={llmConfig.visionEnabled}
                            onChange={(targetEvent) => setLlmConfig((current) => ({ ...current, visionEnabled: targetEvent.target.checked }))}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                          />
                        </label>

                        {!providerIsImplemented && (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                            {activeProviderOption?.note || '当前 provider 已预留配置位，但尚未接入实际 adapter。'}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                )}
              </div>
              , contextPortalHost)}

            {!embedded &&
              governancePortalHost &&
              createPortal(
                  <section className="intent-e2e-panel rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,251,255,0.95),rgba(242,247,253,0.96))] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">项目知识草稿</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          把 repair memory 里重复出现且修成功过的失败模式，反推成下一轮更稳的项目规则，优先提升首轮生成与首轮通过率。
                        </p>
                      </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">repair 到 knowledge</span>
                    </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Min Seen</span>
                    <input
                      type="number"
                      min={1}
                      value={knowledgeDraftMinSeenCount}
                      onChange={(targetEvent) => setKnowledgeDraftMinSeenCount(Math.max(1, Number(targetEvent.target.value) || 1))}
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Min Resolved</span>
                    <input
                      type="number"
                      min={1}
                      value={knowledgeDraftMinResolvedCount}
                      onChange={(targetEvent) => setKnowledgeDraftMinResolvedCount(Math.max(1, Number(targetEvent.target.value) || 1))}
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Max Candidates</span>
                    <input
                      type="number"
                      min={1}
                      value={knowledgeDraftMaxCandidates}
                      onChange={(targetEvent) => setKnowledgeDraftMaxCandidates(Math.max(1, Number(targetEvent.target.value) || 1))}
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                    />
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={previewProjectKnowledgeDraft}
                    disabled={knowledgeDraftBusy}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {knowledgeDraftLoading ? '预览中…' : '预览草稿'}
                  </button>
                  <button
                    type="button"
                    onClick={writeProjectKnowledgeDraft}
                    disabled={knowledgeDraftBusy}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {knowledgeDraftWriting ? '写出中…' : '写出草稿文件'}
                  </button>
                  <button
                    type="button"
                    onClick={mergeProjectKnowledgeDraftCandidates}
                    disabled={knowledgeDraftBusy || knowledgeDraftSelectedCount === 0}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 px-4 text-sm text-sky-800 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {knowledgeDraftMerging ? '合并中…' : `合并选中规则（${knowledgeDraftSelectedCount}）`}
                  </button>
                  <p className="text-xs leading-5 text-slate-500">
                    这块不是让你改脚本，而是把历史修复经验自动沉淀成下一轮更稳的规则输入。
                    {knowledgeDraftDefaultDeferredCount > 0 ? ' 默认只勾选安全候选；存在历史负向证据、观察期或自动降权的规则需要你手工确认。' : ''}
                  </p>
                </div>

              {knowledgeDraftError && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {knowledgeDraftError}
                </div>
              )}

              {knowledgeDraftWrittenTo && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  草稿已写出到 <span className="font-mono text-xs">{knowledgeDraftWrittenTo}</span>
                </div>
              )}

              {knowledgeDraftMergedTo && (
                <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                  选中规则已合并到 <span className="font-mono text-xs">{knowledgeDraftMergedTo}</span>
                </div>
              )}

              {knowledgeDraftMergeBackupPath && (
                <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                  已自动备份旧规则文件到 <span className="font-mono text-xs">{knowledgeDraftMergeBackupPath}</span>
                </div>
              )}

              {knowledgeDraftMergeDiffPreview && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">本次规则变更预览</p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-[11px] leading-5 text-slate-600">
                    {knowledgeDraftMergeDiffPreview}
                  </pre>
                </div>
              )}

              {knowledgeRestoredFrom && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  已从备份 <span className="font-mono text-xs">{knowledgeRestoredFrom}</span> 回滚项目知识规则
                </div>
              )}

              {knowledgeRestoreBackupCreated && (
                <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                  回滚前当前版本已自动备份到 <span className="font-mono text-xs">{knowledgeRestoreBackupCreated}</span>
                </div>
              )}

              {knowledgeChangeComparison && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-4 text-sm text-slate-700">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{knowledgeChangeOperation === 'restore' ? '本次回滚前后对比' : '本次合并收益对比'}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">这里只比较项目知识配置本身的覆盖变化，不直接代表线上执行成功率。</p>
                    </div>
                    <span className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-medium text-emerald-700">
                      {projectKnowledgeOperationLabel(knowledgeChangeOperation || 'merge')}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {projectKnowledgeComparisonMetrics(knowledgeChangeComparison).map((metric) => {
                      const delta = metric.after - metric.before;
                      const deltaTone =
                        delta > 0
                          ? 'text-emerald-700 bg-emerald-100'
                          : delta < 0
                            ? 'text-amber-700 bg-amber-100'
                            : 'text-slate-600 bg-slate-100';

                      return (
                        <div key={metric.key} className="rounded-2xl border border-white/80 bg-white px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{metric.label}</p>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${deltaTone}`}>{formatMetricDelta(metric.before, metric.after)}</span>
                          </div>
                          <p className="mt-3 text-lg font-semibold text-slate-950">
                            {metric.before} <span className="text-slate-400">→</span> {metric.after}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-xs leading-6 text-slate-600">
                      <p className="font-medium text-slate-900">新增规则</p>
                      <p className="mt-2">{summarizeIdList(knowledgeChangeComparison.addedRuleIds)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-xs leading-6 text-slate-600">
                      <p className="font-medium text-slate-900">移除规则</p>
                      <p className="mt-2">{summarizeIdList(knowledgeChangeComparison.removedRuleIds)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-xs leading-6 text-slate-600">
                      <p className="font-medium text-slate-900">更新规则</p>
                      <p className="mt-2">{summarizeIdList(knowledgeChangeComparison.updatedRuleIds)}</p>
                    </div>
                  </div>
                </div>
              )}

              {knowledgeMergeSelectionSummary && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">本次合并范围</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">这里直接回放本次 route 最终接收到的候选选择、风险要求和策略分布。</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                      选中 {knowledgeMergeSelectionSummary.selectedCandidateCount} / 实际 merge {knowledgeMergeSelectionSummary.mergeCandidateCount}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">requested</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">{knowledgeMergeSelectionSummary.requestedCandidateCount}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">risky</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">{knowledgeMergeSelectionSummary.selectedRiskyCandidateIds.length}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-700">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-500">auto promote</p>
                      <p className="mt-2 text-lg font-semibold">{knowledgeMergeSelectionSummary.autoPromoteCandidateIds.length}</p>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-rose-700">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-rose-500">override required</p>
                      <p className="mt-2 text-lg font-semibold">{knowledgeMergeSelectionSummary.overrideRequiredCandidateIds.length}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-700">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-amber-500">risk ack required</p>
                      <p className="mt-2 text-lg font-semibold">
                        {knowledgeMergeSelectionSummary.riskAcknowledgementRequiredCandidateIds.length}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 text-xs leading-6 text-slate-600">
                    <p>规则：{summarizeIdList(knowledgeMergeSelectionSummary.selectedRuleIds)}</p>
                    <p className="mt-1">来源：{summarizeTextList(knowledgeMergeSelectionSummary.selectedSources, 3)}</p>
                    <p className="mt-1">反馈状态：{summarizeTextList(knowledgeMergeSelectionSummary.selectedFeedbackStatuses, 4)}</p>
                    <p className="mt-1">策略分布：{summarizeTextList(knowledgeMergeSelectionSummary.selectedLifecyclePolicies, 4)}</p>
                  </div>
                </div>
              )}

              {knowledgeMergePreflightSummary && knowledgeMergePreflightSummary.items.length > 0 && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">本次合并预检</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">这里展示服务端根据最终选择生成的结构化 preflight 判断，而不是拼接好的字符串提示。</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                      {knowledgeMergePreflightSummary.itemCount} 项
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {knowledgeMergePreflightSummary.items.map((item, index) => (
                      <div key={`${item.kind}-${index}`} className={`rounded-2xl border px-4 py-3 text-sm ${projectKnowledgeMergeNoticeTone(item)}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-current/20 bg-white/70 px-2.5 py-1 text-[10px] font-medium">
                            {projectKnowledgeMergeNoticeProvenanceLabel(item.provenanceType)}
                          </span>
                          <p className="font-medium">{item.title}</p>
                        </div>
                        <p className="mt-2 leading-6">{item.message}</p>
                        <div className="mt-2 text-xs leading-5 opacity-90">
                          <p>规则：{summarizeIdList(item.ruleIds)}</p>
                          {item.candidateIds.length > 0 && <p className="mt-1">候选：{summarizeIdList(item.candidateIds)}</p>}
                          {item.feedbackStatuses.length > 0 && (
                            <p className="mt-1">反馈：{summarizeTextList(item.feedbackStatuses, 4)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {knowledgeMergeReceipts.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">本次合并回执</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">这里记录本次 merge 最终真正写入的 override / 风险确认 / 护栏 / 审计回执。</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                      {knowledgeMergeReceipts.length} 条
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {knowledgeMergeReceipts.map((item, index) => (
                      <div key={`${item.kind}-${item.title}-${index}`} className={`rounded-2xl border px-4 py-3 text-sm ${projectKnowledgeMergeNoticeTone(item)}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-current/20 bg-white/70 px-2.5 py-1 text-[10px] font-medium">
                            {projectKnowledgeMergeNoticeProvenanceLabel(item.provenanceType)}
                          </span>
                          <p className="font-medium">{item.title}</p>
                        </div>
                        <p className="mt-2 leading-6">{item.message}</p>
                        <div className="mt-2 text-xs leading-5 opacity-90">
                          {item.ruleIds.length > 0 && <p>规则：{summarizeIdList(item.ruleIds)}</p>}
                          {item.candidateIds.length > 0 && <p className="mt-1">候选：{summarizeIdList(item.candidateIds)}</p>}
                          {item.feedbackStatuses.length > 0 && (
                            <p className="mt-1">反馈：{summarizeTextList(item.feedbackStatuses, 4)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {knowledgeAuditWarning && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      审计提醒：{knowledgeAuditWarning}
                    </div>
                  )}

                  {knowledgeOverrideWarning && (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                      Override 回执：{knowledgeOverrideWarning}
                    </div>
                  )}

                  {knowledgeRiskAcknowledgementWarning && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      风险确认回执：{knowledgeRiskAcknowledgementWarning}
                    </div>
                  )}

                  {knowledgeGuardrailWarning && (
                    <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                      护栏提醒：{knowledgeGuardrailWarning}
                    </div>
                  )}
                </>
              )}

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">历史运行洞察</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      用最近的运行和知识审计回答两件事：哪些规则/helper 真在拉高成功率，哪些合并可能把通过率打下来了。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void refreshIntentE2EInsights();
                      void refreshIntentE2EReleaseStatus();
                    }}
                    disabled={insightsLoading || releaseStatusLoading}
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {insightsLoading || releaseStatusLoading ? '刷新中…' : '刷新洞察'}
                  </button>
                </div>

                {insightsError && (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">
                    {insightsError}
                  </div>
                )}

                {(releaseStatus || releaseStatusLoading || releaseStatusError) && (
                  <div className="mt-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50/60 px-5 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Release Readiness</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold text-slate-950">发布状态</p>
                          {releaseStatus ? (
                            <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${releaseReadinessTone(releaseStatus.status)}`}>
                              {releaseReadinessLabel(releaseStatus.status)}
                            </span>
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
                              {releaseStatusLoading ? '读取中' : '未加载'}
                            </span>
                          )}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {releaseStatus
                            ? `项目 ${releaseStatus.projectUid} · ${releaseStatus.canRelease ? '当前证据允许发布' : '当前仍需处理证据缺口'}`
                            : '发布状态直接来自 release-status API，前端不重新计算 ready / attention / blocked。'}
                        </p>
                        {releaseStatus?.currentCompare?.message && (
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            {releaseStatus.currentCompare.message}
                            {releaseStatus.currentCompare.generatedAt ? ` · ${formatDateTime(releaseStatus.currentCompare.generatedAt)}` : ''}
                          </p>
                        )}
                        {releaseStatusError && (
                          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                            <p className="font-medium">{releaseStatusErrorHeading}</p>
                            <p className="mt-1">{releaseStatusErrorBody}</p>
                            <p className="mt-2 break-all text-amber-700">返回信息：{releaseStatusError}</p>
                          </div>
                        )}
                      </div>
                      {releaseStatus && (
                        <div className="grid min-w-[260px] grid-cols-3 gap-2 text-center">
                          <div className="rounded-2xl border border-white/80 bg-white/90 px-3 py-3">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">checks</p>
                            <p className="mt-1 text-xl font-semibold text-slate-950">{releaseStatus.summary.passedChecks}/{releaseStatus.summary.checkCount}</p>
                          </div>
                          <div className="rounded-2xl border border-white/80 bg-white/90 px-3 py-3">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">families</p>
                            <p className="mt-1 text-xl font-semibold text-slate-950">{releaseStatus.summary.readyFamilies}/{releaseStatus.summary.familyCount}</p>
                          </div>
                          <div className="rounded-2xl border border-white/80 bg-white/90 px-3 py-3">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">blocked</p>
                            <p className="mt-1 text-xl font-semibold text-slate-950">{releaseStatus.summary.blockedFamilies}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {releaseStatus && (
                      <>
                        <div className={`mt-4 rounded-2xl border px-4 py-3 text-xs leading-5 ${releaseReadinessPanelTone(releaseStatus.status)}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">{releaseReadinessSummaryText(releaseStatus.status)}</p>
                            <span className="rounded-full border border-current/20 bg-white/70 px-2.5 py-1 text-[10px] font-medium">
                              {releaseStatusBlockingCheckCount > 0 ? `${releaseStatusBlockingCheckCount} 个阻塞 check` : '无阻塞 check'}
                            </span>
                          </div>
                          <p className="mt-1">{releaseReadinessDetailText(releaseStatus.status, releaseStatus.summary)}</p>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          {releaseStatus.checks.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-white/80 bg-white/90 px-4 py-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="min-w-0 truncate text-sm font-medium text-slate-900">{item.title}</p>
                                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${releaseCheckStatusTone(item.status)}`}>
                                  {releaseCheckStatusLabel(item.status)}
                                </span>
                              </div>
                              <p className={`mt-2 text-xs leading-5 text-slate-500 ${item.status === 'passed' ? 'line-clamp-2' : ''}`}>{item.message}</p>
                              {item.status !== 'passed' && (
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                                  <span className={`rounded-full border px-2 py-0.5 ${item.blocking ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                                    {item.blocking ? '阻塞项' : '提示项'}
                                  </span>
                                  {item.evidencePath && (
                                    <span className="min-w-0 max-w-full truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-slate-500">
                                      {item.evidencePath}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          {releaseStatus.families.map((family) => {
                            const familyIssueMessages = releaseFamilyIssueMessages(family);
                            return (
                              <div
                                key={family.priorityScenarioFamily}
                                className={`rounded-2xl border px-4 py-4 ${
                                  familyIssueMessages.length > 0 ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white/90'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <p className="min-w-0 break-all font-mono text-xs font-semibold text-slate-900">{family.priorityScenarioFamily}</p>
                                  <span
                                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                      familyIssueMessages.length > 0
                                        ? family.releaseGuard?.status === 'failed' || family.knowledgeHit?.status === 'failed'
                                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                                          : 'border-amber-200 bg-amber-50 text-amber-700'
                                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    }`}
                                  >
                                    {familyIssueMessages.length > 0 ? '需处理' : '证据齐全'}
                                  </span>
                                </div>
                                <div className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
                                  <p>
                                    release：
                                    {family.releaseGuard ? (
                                      <>
                                        <span className={`ml-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${releaseCheckStatusTone(family.releaseGuard.status)}`}>
                                          {releaseCheckStatusLabel(family.releaseGuard.status)}
                                        </span>
                                        <span className="ml-1 text-slate-500">
                                          {family.releaseGuard.currentRunCount} runs · first pass {formatRatePercent(family.releaseGuard.currentFirstPassPassRate)}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="ml-1 text-amber-700">缺证据</span>
                                    )}
                                  </p>
                                  <p>
                                    knowledge：
                                    {family.knowledgeHit ? (
                                      <>
                                        <span className={`ml-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${releaseCheckStatusTone(family.knowledgeHit.status)}`}>
                                          {releaseCheckStatusLabel(family.knowledgeHit.status)}
                                        </span>
                                        <span className="ml-1 text-slate-500">{formatRatePercent(family.knowledgeHit.knowledgeHitRate)}</span>
                                      </>
                                    ) : (
                                      <span className="ml-1 text-amber-700">缺证据</span>
                                    )}
                                  </p>
                                </div>
                                {familyIssueMessages.length > 0 && (
                                  <div className="mt-3 rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-xs leading-5 text-amber-800">
                                    {familyIssueMessages.slice(0, 3).map((message, index) => (
                                      <p key={`${family.priorityScenarioFamily}-${index}-${message}`} className="break-words">
                                        {message}
                                      </p>
                                    ))}
                                    {familyIssueMessages.length > 3 && <p className="text-amber-700">另有 {familyIssueMessages.length - 3} 条原因。</p>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div
                          className={`mt-4 rounded-2xl border px-4 py-3 text-xs leading-5 ${
                            releaseStatusHasNoIssues
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : releaseStatus.status === 'blocked'
                                ? 'border-rose-200 bg-rose-50 text-rose-800'
                                : 'border-amber-200 bg-amber-50 text-amber-800'
                          }`}
                        >
                          {releaseStatusHasNoIssues ? (
                            <p className="font-medium">当前没有未通过 check 或 family 证据缺口。</p>
                          ) : (
                            <>
                              <p className="font-medium">
                                需要关注 {releaseIssueChecks.length} 个 check、{releaseIssueFamilies.length} 条 family。
                              </p>
                              <div className="mt-2 grid gap-2 md:grid-cols-2">
                                {releaseIssueChecks.map((item) => (
                                  <p key={item.id} className="break-words">
                                    {item.title}：{item.message}
                                  </p>
                                ))}
                                {releaseIssueFamilies.map((item) => (
                                  <p key={item.family.priorityScenarioFamily} className="break-words">
                                    {item.family.priorityScenarioFamily}：{item.messages[0]}
                                  </p>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {insights ? (
                  <>
                    <div className="mt-4 space-y-4">
                      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50 px-5 py-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Insights Cockpit</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold text-slate-950">当前放量判断</p>
                              <span
                                className={`rounded-full border px-3 py-1 text-[11px] font-medium ${rolloutStrategyStageTone(
                                  insights.rolloutStrategy.recommendedStage
                                )}`}
                              >
                                {rolloutStrategyStageLabel(insights.rolloutStrategy.recommendedStage)}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-600">{insights.rolloutStrategy.summary}</p>
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              {workspaceProjectUid ? `当前展示项目 ${workspaceProjectUid}` : '当前展示全局'} 最近 {insights.scope.runLimit} 次终态运行，
                              并结合最近 {insights.scope.auditLimit} 条项目知识审计生成趋势。
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-right">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">recent scope</p>
                            <p className="mt-2 text-2xl font-semibold text-slate-950">{insights.summary.totalRuns}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              通过 {insights.summary.passedRuns} · 失败 {insights.summary.failedRuns} · 取消 {insights.summary.canceledRuns}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                          <div className="rounded-2xl border border-emerald-200 bg-white/90 px-4 py-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-600">pass rate</p>
                            <p className="mt-2 text-2xl font-semibold text-emerald-900">{formatRatePercent(insights.summary.passRate)}</p>
                            <p className="mt-1 text-[11px] text-emerald-700">先看这项是否稳定抬升。</p>
                          </div>
                          <div className="rounded-2xl border border-teal-200 bg-white/90 px-4 py-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-teal-600">first pass</p>
                            <p className="mt-2 text-2xl font-semibold text-teal-900">{formatRatePercent(insights.summary.firstPassPassRate)}</p>
                            <p className="mt-1 text-[11px] text-teal-700">首轮直接通过 {insights.summary.firstPassPassedRuns} 次。</p>
                          </div>
                          <div className="rounded-2xl border border-cyan-200 bg-white/90 px-4 py-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-600">repair pass</p>
                            <p className="mt-2 text-2xl font-semibold text-cyan-900">{formatRatePercent(insights.summary.repairedPassRate)}</p>
                            <p className="mt-1 text-[11px] text-cyan-700">修复后通过 {insights.summary.repairedPassRuns} 次。</p>
                          </div>
                          <div className="rounded-2xl border border-rose-200 bg-white/90 px-4 py-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-rose-600">model quality</p>
                            <p className="mt-2 text-2xl font-semibold text-rose-900">
                              {formatRatePercent(insights.summary.modelQualityPassRate)}
                            </p>
                            <p className="mt-1 text-[11px] text-rose-700">
                              可比较样本 {insights.summary.modelQualityEligibleRuns} 次 · 失败 {insights.summary.modelQualityFailureRuns} 次。
                            </p>
                          </div>
                          <div className="rounded-2xl border border-amber-200 bg-white/90 px-4 py-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-amber-600">blocked split</p>
                            <p className="mt-2 text-2xl font-semibold text-amber-900">{formatRatePercent(insights.summary.blockedRate)}</p>
                            <p className="mt-1 text-[11px] text-amber-700">
                              auth/perm {insights.summary.authBlockRuns} · env/data {insights.summary.envBlockRuns}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-violet-200 bg-white/90 px-4 py-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-violet-600">helper reuse</p>
                            <p className="mt-2 text-2xl font-semibold text-violet-900">
                              {formatRatePercent(insights.summary.suggestedHelperReuseRate)}
                            </p>
                            <p className="mt-1 text-[11px] text-violet-700">
                              知识命中 {formatRatePercent(insights.summary.knowledgeHitRate)} · 缺资产 {formatRatePercent(insights.summary.assetMissingRate)} · no-hit {formatRatePercent(insights.summary.noHitRate)}。
                            </p>
                          </div>
                        </div>

                        {promotionCoverageSummary?.coveredAssetCount ? (
                          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[11px] leading-5 text-amber-900">
                            <p className="font-medium text-amber-950">资产沉淀覆盖</p>
                            <p className="mt-1">
                              Starter helper {promotionCoverageSummary.starterHelperCount} 个
                              {promotionCoverageSummary.starterCapabilityCount > 0
                                ? ` · 能力 ${promotionCoverageSummary.starterCapabilityCount} 条`
                                : ''}
                              {promotionCoverageSummary.successfulRunRuleCount > 0
                                ? ` · Successful Run 规则 ${promotionCoverageSummary.successfulRunRuleCount} 条`
                                : ''}
                              {promotionCoverageSummary.lastRecordedAt
                                ? ` · 最近 ${formatDateTime(promotionCoverageSummary.lastRecordedAt)}`
                                : ''}
                            </p>
                            {(promotionCoverageSummary.latestStarterHelper ||
                              promotionCoverageSummary.latestSuccessfulRunRuleId) && (
                              <p className="mt-1">
                                {promotionCoverageSummary.latestStarterHelper
                                  ? `最新 Starter：${promotionCoverageSummary.latestStarterHelper}${
                                      promotionCoverageSummary.latestStarterModuleName
                                        ? ` · ${promotionCoverageSummary.latestStarterModuleName}`
                                        : ''
                                    }${
                                      promotionCoverageSummary.latestStarterScenarioTitle
                                        ? ` / ${promotionCoverageSummary.latestStarterScenarioTitle}`
                                        : ''
                                    }`
                                  : ''}
                                {promotionCoverageSummary.latestStarterHelper && promotionCoverageSummary.latestSuccessfulRunRuleId ? ' · ' : ''}
                                {promotionCoverageSummary.latestSuccessfulRunRuleId
                                  ? `最新 Successful Run：${
                                      promotionCoverageSummary.latestSuccessfulRunRuleTitle ||
                                      promotionCoverageSummary.latestSuccessfulRunRuleId
                                    }${
                                      promotionCoverageSummary.latestSuccessfulRunRequestedModuleUid
                                        ? ` · ${promotionCoverageSummary.latestSuccessfulRunRequestedModuleUid}`
                                        : ''
                                    }`
                                  : ''}
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.84fr)_minmax(0,1.16fr)]">
                        <div className="space-y-4">
                          {insights.runtimeGovernanceStatus && (
                            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-slate-900">项目治理接入</p>
                                  <p className="mt-1 text-xs leading-5 text-slate-500">
                                    把 environment / credential / fixture manifest 的缺口提前暴露，避免等到 run blocker 才发现。
                                  </p>
                                </div>
                                <span
                                  className={`rounded-full border px-3 py-1 text-[11px] font-medium ${intentProjectRuntimeGovernanceTone(
                                    insights.runtimeGovernanceStatus
                                  )}`}
                                >
                                  {intentProjectRuntimeGovernanceLabel(insights.runtimeGovernanceStatus)}
                                </span>
                              </div>

                              <div className="mt-3 rounded-2xl border border-white/80 bg-white px-3 py-3 text-[11px] leading-5 text-slate-600">
                                <p>scope：{insights.runtimeGovernanceStatus.projectUid}</p>
                                <p className="mt-1 break-all">manifest：{insights.runtimeGovernanceStatus.path || '—'}</p>
                                <p className="mt-1">
                                  coverage：{summarizeIntentProjectRuntimeGovernanceCoverage(insights.runtimeGovernanceStatus)}
                                </p>
                              </div>

                              <div className="mt-3 space-y-2">
                                {insights.runtimeGovernanceStatus.issues.length > 0 ? (
                                  insights.runtimeGovernanceStatus.issues.map((issue) => (
                                    <div key={issue.code} className="rounded-2xl border border-white/80 bg-white px-3 py-3">
                                      <p className="text-xs leading-6 text-slate-600">{issue.message}</p>
                                    </div>
                                  ))
                                ) : (
                                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs leading-6 text-emerald-800">
                                    当前 project runtime governance manifest 校验通过，运行前不会再因默认治理声明缺失而静默漂移。
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium text-slate-900">当前优先动作</p>
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                                {insightPriorityNotes.length} 条
                              </span>
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                              {insightPriorityNotes.map((item) => (
                                <div key={item.key} className="rounded-2xl border border-white/80 bg-white px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                                  <p className="mt-2 text-xs leading-6 text-slate-600">{item.detail}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-900">决策信号</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                把是否继续放量、是否需要回滚、是否存在冷启动缺口收口到同一屏，避免在多个 tab 来回跳。
                              </p>
                            </div>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                              {insightDecisionSignals.length} 条
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                            {insightDecisionSignals.map((item, index) => (
                              <div
                                key={item.key}
                                className={`rounded-2xl px-3 py-3 ${
                                  insightDecisionSignals.length % 2 === 1 && index === insightDecisionSignals.length - 1 ? 'sm:col-span-2' : ''
                                } ${item.toneClassName}`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[11px] uppercase tracking-[0.14em] opacity-70">{item.title}</p>
                                  <span className="rounded-full border border-current/15 bg-white/80 px-2.5 py-1 text-[10px] font-medium">
                                    {item.value}
                                  </span>
                                </div>
                                <p className="mt-2 text-xs leading-5 opacity-90">{item.detail}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="sticky top-4 z-10 mt-5 rounded-3xl border border-slate-200 bg-white/95 px-4 py-4 backdrop-blur">
                      <div className="flex flex-wrap gap-2">
                        {insightWorkbenchTabs.map((item) => {
                          const active = item.key === insightsView;

                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => setInsightsView(item.key)}
                              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition ${
                                active
                                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <span>{item.label}</span>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] ${
                                  active ? 'bg-white/15 text-white' : 'bg-white text-slate-500'
                                }`}
                              >
                                {item.countLabel}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{activeInsightWorkbenchTab.label}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{activeInsightWorkbenchTab.description}</p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                          {activeInsightWorkbenchTab.countLabel}
                        </span>
                      </div>
                    </div>

                    {insightsView === 'quality' && (
                      <>
                        {insights.verificationIntents.some((item) => item.intent !== 'unknown') && (
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">验证意图分桶</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              把普通验证和保守复核拆开看 through rate，避免 `review` 继续并入 `verify` 后看不见真实稳定性差异。
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                            {insights.verificationIntents
                              .filter((item) => item.intent !== 'unknown')
                              .reduce((sum, item) => sum + item.totalRuns, 0)} 条能力验证
                          </span>
                        </div>

                        <div className="mt-4 grid items-start gap-3 xl:grid-cols-3">
                          {insights.verificationIntents
                            .filter((item) => item.totalRuns > 0)
                            .map((item) => (
                              <div key={item.intent} className="self-start rounded-2xl border border-white/80 bg-white px-4 py-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-medium text-slate-900">{item.label}</p>
                                  <span
                                    className={`rounded-full border px-3 py-1 text-[11px] font-medium ${insightVerificationIntentTone(item.intent)}`}
                                  >
                                    {item.totalRuns} runs
                                  </span>
                                </div>
                                <p className="mt-2 text-xs leading-5 text-slate-500">
                                  通过 {item.passedRuns} · 失败 {item.failedRuns} · 取消 {item.canceledRuns}
                                </p>
                                {item.latestRepairObservationSummary ? (
                                  <p className="mt-2 text-[11px] leading-5 text-slate-500">
                                    {item.latestRepairObservationSummary}
                                    {item.latestRepairObservationVerifierCheckUids.length > 0
                                      ? ` · verifier ${summarizeTextList(item.latestRepairObservationVerifierCheckUids, 2)}`
                                      : ''}
                                  </p>
                                ) : null}
                                <div className="mt-3 grid items-start gap-2 sm:grid-cols-3">
                                  <div className="h-fit rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">terminal</p>
                                    <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.terminalPassRate)}</p>
                                  </div>
                                  <div className="h-fit rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">first</p>
                                    <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.firstPassPassRate)}</p>
                                  </div>
                                  <div className="h-fit rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">repair</p>
                                    <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.repairedPassRate)}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {(insights.capabilityVerificationIntents.length > 0 || insights.recentCapabilityVerifications.length > 0) && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">能力验证执行趋势</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              这组数据直接来自 capability verification execution 的 activity log，专门看 `review / verify` 在实际能力验证链路上的通过情况。
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                            {insights.capabilityVerificationIntents.reduce((sum, item) => sum + item.totalExecutions, 0)} 条执行
                          </span>
                        </div>

                        {insights.capabilityVerificationIntents.length > 0 && (
                          <div className="mt-4 grid items-start gap-3 xl:grid-cols-3">
                            {insights.capabilityVerificationIntents.map((item) => (
                              <div key={item.intent} className="self-start rounded-2xl border border-white/80 bg-white px-4 py-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-medium text-slate-900">{item.label}</p>
                                  <span
                                    className={`rounded-full border px-3 py-1 text-[11px] font-medium ${insightVerificationIntentTone(item.intent)}`}
                                  >
                                    {item.totalExecutions} 次
                                  </span>
                                </div>
                                <p className="mt-2 text-xs leading-5 text-slate-500">
                                  通过 {item.passedExecutions} · 失败 {item.failedExecutions}
                                </p>
                                {item.latestRepairObservationSummary ? (
                                  <p className="mt-2 text-[11px] leading-5 text-slate-500">
                                    {item.latestRepairObservationSummary}
                                    {item.latestRepairObservationVerifierCheckUids.length > 0
                                      ? ` · verifier ${summarizeTextList(item.latestRepairObservationVerifierCheckUids, 2)}`
                                      : ''}
                                  </p>
                                ) : null}
                                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">pass</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.passRate)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {insights.recentCapabilityVerifications.length > 0 && (
                          <div className="mt-4 space-y-3">
                            {insights.recentCapabilityVerifications.map((item) => (
                              <div key={item.executionUid} className="rounded-2xl border border-white/80 bg-white px-4 py-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-medium text-slate-900">{item.targetName || item.configName || item.capabilityUid}</p>
                                      <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${intentRunStatusTone(item.status)}`}>
                                        {intentRunStatusLabel(item.status)}
                                      </span>
                                      <span
                                        className={`rounded-full border px-3 py-1 text-[11px] font-medium ${insightVerificationIntentTone(item.intent)}`}
                                      >
                                        {item.intentLabel}
                                      </span>
                                    </div>
                                    <p className="mt-2 text-xs leading-5 text-slate-500">
                                      {formatDateTime(item.createdAt)} · {item.strategyLabel || '未标注策略'}
                                      {item.configName ? ` · ${item.configName}` : ''}
                                    </p>
                                    <p className="mt-1 break-all font-mono text-[11px] leading-5 text-slate-400">{item.executionUid}</p>
                                  </div>
                                  <div className="text-right text-[11px] text-slate-500">
                                    <p>{item.capabilityUid}</p>
                                    <p className="mt-1">{item.chainCapabilityUids.length > 0 ? `${item.chainCapabilityUids.length} 条链路能力` : '单能力执行'}</p>
                                  </div>
                                </div>
                                <p className="mt-3 text-xs leading-6 text-slate-600">{item.summary || item.errorMessage || '—'}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {insights.scenarioFamilySlo.items.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">场景族 SLO</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              把当前场景族基线映射成固定 first / terminal 目标，用于后续灰度、回归 watchlist 和发布治理。
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                            达标 {insights.scenarioFamilySlo.meetingCount} · 临界 {insights.scenarioFamilySlo.atRiskCount} · 未达标 {insights.scenarioFamilySlo.offTrackCount}
                          </span>
                        </div>

                        <p className="mt-2 text-[11px] leading-5 text-slate-500">
                          当前 SLO 来自最近 {insights.scenarioFamilySlo.generatedFromRuns} 次终态运行；样本不足会单独标记，不直接判定达标或退化。
                        </p>

                        <div className="mt-4 grid items-start gap-3 xl:grid-cols-2">
                          {insights.scenarioFamilySlo.items.map((item) => (
                            <div key={`slo_${item.family}`} className="self-start rounded-2xl border border-white/80 bg-white px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-slate-900">{item.label}</p>
                                  <p className="mt-1 text-xs leading-5 text-slate-500">
                                    {item.totalRuns} runs · 最低判定样本 {item.minRuns}
                                  </p>
                                </div>
                                <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${scenarioFamilySloTone(item.status)}`}>
                                  {scenarioFamilySloLabel(item.status)}
                                </span>
                              </div>

                              <div className="mt-3 grid items-start gap-2 sm:grid-cols-2">
                                <div className="h-fit rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">first</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.currentFirstPassRate)}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    目标 {formatRatePercent(item.targetFirstPassRate)} · 差距 {formatRatePercent(item.firstPassGap)}
                                  </p>
                                </div>
                                <div className="h-fit rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">terminal</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.currentTerminalPassRate)}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    目标 {formatRatePercent(item.targetTerminalPassRate)} · 差距 {formatRatePercent(item.terminalGap)}
                                  </p>
                                </div>
                              </div>

                              <p className="mt-3 text-xs leading-6 text-slate-600">{item.recommendation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                      </>
                    )}

                    {insightsView === 'overview' && (
                      <>
                        {insights.regressionWatchlist.items.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">Regression Watchlist</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              把当前最需要盯的回归信号收口成单独 watchlist，先统一看 SLO 未达标项、固定回归高风险簇和明确 rollback 信号。
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                            高风险 {insights.regressionWatchlist.highSeverityCount} · 观察 {insights.regressionWatchlist.mediumSeverityCount}
                          </span>
                        </div>

                        <p className="mt-2 text-[11px] leading-5 text-slate-500">
                          当前 watchlist 来自最近 {insights.regressionWatchlist.generatedFromRuns} 次终态运行。
                        </p>

                        <div className="mt-4 grid items-start gap-3 xl:grid-cols-2">
                          {insights.regressionWatchlist.items.map((item) => (
                            <div key={item.watchId} className="self-start overflow-hidden rounded-2xl border border-white/80 bg-white px-4 py-4">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-start gap-2">
                                  <p title={item.title} className="min-w-0 flex-1 line-clamp-2 text-sm font-medium leading-6 text-slate-900">
                                    {item.title}
                                  </p>
                                  <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${regressionWatchlistSeverityTone(item.severity)}`}>
                                    {regressionWatchlistSeverityLabel(item.severity)}
                                  </span>
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                                    {regressionWatchlistSourceLabel(item.source)}
                                  </span>
                                </div>
                                <p title={item.summary} className="mt-2 line-clamp-3 text-[12px] leading-5 text-slate-500">
                                  {item.summary}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600">
                                    {item.latestObservedAt ? formatDateTime(item.latestObservedAt) : `${item.runCount} runs`}
                                  </span>
                                  <p title={item.sourceRef || undefined} className="min-w-0 flex-1 line-clamp-1 break-all font-mono text-[11px] text-slate-400">
                                    {item.sourceRef || '—'}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 grid items-start gap-2 sm:grid-cols-2">
                                <div className="h-fit rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">terminal</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.currentTerminalPassRate)}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    {item.targetTerminalPassRate !== null
                                      ? `目标 ${formatRatePercent(item.targetTerminalPassRate)}`
                                      : item.compareTerminalPassRate !== null
                                        ? `${item.compareLabel} ${formatRatePercent(item.compareTerminalPassRate)}`
                                        : `${item.runCount} runs`}
                                  </p>
                                </div>
                                <div className="h-fit rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">first</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.currentFirstPassRate)}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    {item.targetFirstPassRate !== null
                                      ? `目标 ${formatRatePercent(item.targetFirstPassRate)}`
                                      : item.compareFirstPassRate !== null
                                        ? `${item.compareLabel} ${formatRatePercent(item.compareFirstPassRate)}`
                                        : `${item.runCount} runs`}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">建议</p>
                                <p title={item.recommendation} className="mt-2 line-clamp-3 text-[12px] leading-5 text-slate-600">
                                  {item.recommendation}
                                </p>
                              </div>

                              {item.failureClasses.length > 0 || item.relatedRuleIds.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                                  {item.failureClasses.length > 0 && (
                                    <span
                                      title={`失败类 ${item.failureClasses.join(' · ')}`}
                                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1"
                                    >
                                      失败类 {summarizeTextList(item.failureClasses, 2)}
                                    </span>
                                  )}
                                  {item.relatedRuleIds.length > 0 && (
                                    <span
                                      title={`规则 ${item.relatedRuleIds.join(' · ')}`}
                                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1"
                                    >
                                      规则 {summarizeTextList(item.relatedRuleIds, 2)}
                                    </span>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {insights.failureTraceGovernance.items.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">Failure Trace Governance</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              把失败 trace 从纯统计桶拆成可治理对象，明确哪些该进入 runbook、fixture、verifier recipe、workflow recipe 或人工 triage。
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                            高风险 {insights.failureTraceGovernance.highSeverityCount} · 待 triage {insights.failureTraceGovernance.needsTriageCount} · 候选{' '}
                            {insights.failureTraceGovernance.promotionCandidateCount}
                          </span>
                        </div>

                        <p className="mt-2 text-[11px] leading-5 text-slate-500">
                          当前失败治理来自最近 {insights.failureTraceGovernance.generatedFromRuns} 次终态运行。
                        </p>

                        <div className="mt-4 grid items-start gap-3 xl:grid-cols-2">
                          {insights.failureTraceGovernance.items.map((item) => (
                            <div key={item.governanceId} className="self-start overflow-hidden rounded-2xl border border-white/80 bg-white px-4 py-4">
                              <div className="flex flex-wrap items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <p title={item.failureClass} className="line-clamp-1 text-sm font-medium leading-6 text-slate-900">
                                    {insightFailureClassLabel(item.failureClass)}
                                  </p>
                                  <p title={item.summary} className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500">
                                    {item.summary}
                                  </p>
                                </div>
                                <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${failureTraceGovernanceSeverityTone(item.severity)}`}>
                                  {failureTraceGovernanceSeverityLabel(item.severity)}
                                </span>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                                  {failureTraceGovernanceCategoryLabel(item.category)}
                                </span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                                  {failureTracePromotionTargetLabel(item.promotionTarget)}
                                </span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                                  {item.count} 次
                                </span>
                                {item.latestObservedAt ? (
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                                    {formatDateTime(item.latestObservedAt)}
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">建议</p>
                                <p title={item.recommendation} className="mt-2 line-clamp-3 text-[12px] leading-5 text-slate-600">
                                  {item.recommendation}
                                </p>
                              </div>

                              {item.antiPatterns.length > 0 && (
                                <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50/70 px-3 py-3">
                                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-amber-600">避免</p>
                                  <p title={item.antiPatterns.join(' · ')} className="mt-2 line-clamp-2 text-[12px] leading-5 text-amber-800">
                                    {summarizeTextList(item.antiPatterns, 2)}
                                  </p>
                                </div>
                              )}

                              {item.latestRepairObservationSummary ? (
                                <p className="mt-3 text-[11px] leading-5 text-slate-500">
                                  最近 repair：{item.latestRepairObservationSummary}
                                  {item.latestRepairObservationVerifierCheckUids.length > 0
                                    ? ` · verifier ${summarizeTextList(item.latestRepairObservationVerifierCheckUids, 2)}`
                                    : ''}
                                </p>
                              ) : null}

                              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                                <span
                                  title={`代表运行：${item.representativeRunIds.join(' · ')}`}
                                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1"
                                >
                                  代表运行 {summarizeIdList(item.representativeRunIds)}
                                </span>
                                <span
                                  title={`优先 family：${item.affectedPriorityScenarioFamilies.map(priorityScenarioFamilyLabel).join(' · ')}`}
                                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1"
                                >
                                  family {summarizeTextList(item.affectedPriorityScenarioFamilies.map(priorityScenarioFamilyLabel), 2)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {insights.rolloutStrategy.gates.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">上线灰度策略</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              把当前 SLO、watchlist、规则治理和回滚信号收口成统一放量建议，避免再凭感觉决定是否扩大 AI 生成覆盖面。
                            </p>
                          </div>
                          <span
                            className={`rounded-full border px-3 py-1 text-[11px] font-medium ${rolloutStrategyStageTone(
                              insights.rolloutStrategy.recommendedStage
                            )}`}
                          >
                            {rolloutStrategyStageLabel(insights.rolloutStrategy.recommendedStage)}
                          </span>
                        </div>

                        <p className="mt-2 text-[11px] leading-5 text-slate-500">
                          当前灰度建议来自最近 {insights.rolloutStrategy.generatedFromRuns} 次终态运行。阻断 {insights.rolloutStrategy.blockedCount}
                          · 观察 {insights.rolloutStrategy.warningCount} · 通过 {insights.rolloutStrategy.readyCount}
                        </p>

                        <div className="mt-3 rounded-2xl border border-white/80 bg-white px-4 py-4">
                          <p className="text-sm font-medium text-slate-900">{insights.rolloutStrategy.summary}</p>
                          <p className="mt-2 text-xs leading-6 text-slate-600">{insights.rolloutStrategy.recommendation}</p>
                        </div>

                        <div className="mt-4 grid items-start gap-3 xl:grid-cols-2">
                          {insights.rolloutStrategy.gates.map((gate) => (
                            <div key={gate.gateId} className="self-start rounded-2xl border border-white/80 bg-white px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-slate-900">{gate.title}</p>
                                    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${rolloutStrategyGateTone(gate.status)}`}>
                                      {rolloutStrategyGateLabel(gate.status)}
                                    </span>
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                                      {rolloutStrategyGateSourceLabel(gate.source)}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-slate-500">{gate.summary}</p>
                                </div>
                                <div className="text-right">
                                  <p className="break-all font-mono text-[11px] text-slate-500">{gate.sourceRef || '—'}</p>
                                </div>
                              </div>

                              <p className="mt-3 text-xs leading-6 text-slate-600">{gate.recommendation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {insights.scenarioFamilies.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">场景族基线</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              先按 page task / simple scenario / complex enterprise flow 分层看 through rate，避免只看全局平均值。
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                            {insights.scenarioFamilies.length} 个场景族
                          </span>
                        </div>

                        <div className="mt-4 grid items-start gap-3 xl:grid-cols-3">
                          {insights.scenarioFamilies.map((item) => (
                            <div key={item.family} className="self-start rounded-2xl border border-white/80 bg-white px-4 py-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-medium text-slate-900">{item.label}</p>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                                  {item.totalRuns} runs
                                </span>
                              </div>
                              <p className="mt-2 text-xs leading-5 text-slate-500">
                                通过 {item.passedRuns} · 失败 {item.failedRuns} · 取消 {item.canceledRuns}
                              </p>
                              <div className="mt-3 grid items-start gap-2 sm:grid-cols-3">
                                <div className="h-fit rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">terminal</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.terminalPassRate)}</p>
                                </div>
                                <div className="h-fit rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">first</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.firstPassPassRate)}</p>
                                </div>
                                <div className="h-fit rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">repair</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.repairedPassRate)}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {insights.evaluationBaseline.candidates.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">固定评测候选集</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              基于 `snapshotSignature` 把真实运行聚类成稳定评测候选，优先覆盖高频、复杂、失败或依赖 repair 的业务流，后面做 first-pass 对比就直接用这组基线。
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                            {insights.evaluationBaseline.recommendedCount} / {insights.evaluationBaseline.candidateClusters} clusters
                          </span>
                        </div>

                        <p className="mt-2 text-[11px] leading-5 text-slate-500">
                          {insights.evaluationBaseline.selectionNote} 当前基线来自最近 {insights.evaluationBaseline.generatedFromRuns} 次终态运行。
                        </p>

                        <div className="mt-4 grid items-start gap-3 xl:grid-cols-2">
                          {insights.evaluationBaseline.candidates.map((item) => (
                            <div key={item.evalCaseId} className="self-start overflow-hidden rounded-2xl border border-white/80 bg-white px-4 py-4">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-start gap-2">
                                  <p
                                    title={item.representativeScenarioTitle || item.representativeRequestInput}
                                    className="min-w-0 flex-1 line-clamp-2 text-sm font-medium leading-6 text-slate-900"
                                  >
                                    {item.representativeScenarioTitle || item.representativeRequestInput}
                                  </p>
                                  <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${evalCandidatePriorityTone(item.priority)}`}>
                                    {evalCandidatePriorityLabel(item.priority)}
                                  </span>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600">
                                    {item.scenarioFamilyLabel}
                                  </span>
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600">
                                    {item.runCount} runs
                                  </span>
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600">
                                    {formatDateTime(item.latestFinishedAt)}
                                  </span>
                                </div>
                                <p
                                  title={item.snapshotSignature}
                                  className="mt-2 line-clamp-1 break-all font-mono text-[11px] leading-5 text-slate-400"
                                >
                                  {item.snapshotSignature}
                                </p>
                                <div className="mt-1 space-y-1 text-[11px] text-slate-400">
                                  <p title={item.evalCaseId} className="line-clamp-1 break-all font-mono text-slate-500">
                                    {item.evalCaseId}
                                  </p>
                                  {item.targetPath ? (
                                    <p title={item.targetPath} className="line-clamp-1 break-all">
                                      {item.targetPath}
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">入选原因</p>
                                <p title={item.selectionReason} className="mt-2 line-clamp-3 text-[12px] leading-5 text-slate-600">
                                  {item.selectionReason}
                                </p>
                              </div>

                              <div className="mt-3 grid items-start gap-2 sm:grid-cols-3">
                                <div className="h-fit rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">terminal</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.terminalPassRate)}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    通过 {item.passedRuns} · 失败 {item.failedRuns}
                                  </p>
                                </div>
                                <div className="h-fit rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">first</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.firstPassPassRate)}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">首轮通过 {item.firstPassPassedRuns} 次</p>
                                </div>
                                <div className="h-fit rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">repair</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.repairedPassRate)}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    repair 通过 {item.repairedPassRuns} 次 · 尝试 {item.repairAttemptedRuns} 次
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                                <span
                                  title={`代表运行：${item.representativeRunIds.join(' · ')}`}
                                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1"
                                >
                                  代表运行 {summarizeIdList(item.representativeRunIds)}
                                </span>
                                <span
                                  title={`规则：${(item.matchedRuleTitles.length > 0 ? item.matchedRuleTitles : item.matchedRuleIds).join(' · ')}`}
                                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1"
                                >
                                  规则 {summarizeTextList(item.matchedRuleTitles.length > 0 ? item.matchedRuleTitles : item.matchedRuleIds, 2)}
                                </span>
                                <span
                                  title={`Helpers：${item.usedHelpers.join(' · ')}`}
                                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1"
                                >
                                  Helpers {summarizeTextList(item.usedHelpers, 2)}
                                </span>
                                <span
                                  title={`Signals：${item.keySignals.join(' · ')}`}
                                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1"
                                >
                                  Signals {summarizeTextList(item.keySignals, 2)}
                                </span>
                                <span
                                  title={
                                    item.failureClasses.length > 0
                                      ? `失败类：${item.failureClasses
                                          .map((failure) => `${insightFailureClassLabel(failure.failureClass)} ${failure.count}`)
                                          .join(' · ')}`
                                      : '失败类：—'
                                  }
                                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1"
                                >
                                  失败类{' '}
                                  {item.failureClasses.length > 0
                                    ? item.failureClasses
                                        .slice(0, 2)
                                        .map((failure) => `${insightFailureClassLabel(failure.failureClass)} ${failure.count}`)
                                        .join(' · ')
                                    : '—'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                      </>
                    )}

                    {insightsView === 'trace' && (
                      <>
                        {insights.recentTraces.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">最近 Trace 摘要</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              直接把最近终态运行的 run 上下文、attempt 结果链、knowledge/helper 命中和关键 signal 摘出来，后面做 grader、固定评测集和 recipe 提炼时都复用这层结构。
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                            {insights.recentTraces.length} 条 trace
                          </span>
                        </div>

                        <div className="mt-4 space-y-3">
                          {insights.recentTraces.map((item) => (
                            <div key={item.runId} className="rounded-2xl border border-white/80 bg-white px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-slate-900">{item.scenarioTitle || item.requestInput || item.runId}</p>
                                    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${intentRunStatusTone(item.status)}`}>
                                      {intentRunStatusLabel(item.status)}
                                    </span>
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                                      {intentPlatformTestTypeLabel(item.testType)}
                                    </span>
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                                      {intentPlatformRunnerTypeLabel(item.runnerType)}
                                    </span>
                                    <span
                                      className={`rounded-full border px-3 py-1 text-[11px] font-medium ${intentQualitySplitTone(
                                        item.qualitySplit
                                      )}`}
                                    >
                                      {intentQualitySplitLabel(item.qualitySplit)}
                                    </span>
                                    {item.verificationIntent !== 'unknown' && (
                                      <span
                                        className={`rounded-full border px-3 py-1 text-[11px] font-medium ${insightVerificationIntentTone(
                                          item.verificationIntent
                                        )}`}
                                      >
                                        {item.verificationIntentLabel}
                                      </span>
                                    )}
                                    {item.firstPassSucceeded && (
                                      <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[11px] font-medium text-teal-700">
                                        首轮通过
                                      </span>
                                    )}
                                    {!item.firstPassSucceeded && item.repairedSucceeded && (
                                      <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-medium text-cyan-700">
                                        修复通过
                                      </span>
                                    )}
                                    {(item.assetReadiness.status === 'asset_missing' || item.assetReadiness.status === 'no_hit') && (
                                      <span
                                        className={`rounded-full border px-3 py-1 text-[11px] font-medium ${intentAssetReadinessTone(
                                          item.assetReadiness.status
                                        )}`}
                                      >
                                        {intentAssetReadinessLabel(item.assetReadiness.status)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-slate-500">
                                    {formatDateTime(item.finishedAt)} · {item.scenarioFamilyLabel} · {item.stepCount} steps · {item.attemptCount} attempts
                                    {item.projectUid && !workspaceProjectUid ? ` · ${item.projectUid}` : ''}
                                  </p>
                                  <p className="mt-1 break-all font-mono text-[11px] leading-5 text-slate-400">{item.snapshotSignature}</p>
                                </div>
                                <div className="text-right">
                                  <p className="break-all font-mono text-[11px] text-slate-500">{item.runId}</p>
                                  <p className="mt-1 break-all text-[11px] text-slate-400">{item.targetPath || item.targetUrl || '—'}</p>
                                </div>
                              </div>

                              <div className="mt-3 grid gap-3 xl:grid-cols-5">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">knowledge</p>
                                  <p className="mt-2 text-xs leading-5 text-slate-700">
                                    {item.knowledgeHit
                                      ? summarizeTextList(item.matchedRuleTitles.length > 0 ? item.matchedRuleTitles : item.matchedRuleIds, 2)
                                      : '未命中'}
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-500">规则 {item.matchedRuleIds.length} 条</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    readiness：{intentAssetReadinessLabel(item.assetReadiness.status)} · {summarizeIntentAssetReadinessReasons(item.assetReadiness, 2)}
                                  </p>
                                  <p className="mt-1 break-all text-[11px] text-slate-500">
                                    Starter：{summarizeTextList(item.matchedStarterHelpers, 2)}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">helpers</p>
                                  <p className="mt-2 break-all text-xs leading-5 text-slate-700">{summarizeTextList(item.usedHelpers, 2)}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    推荐复用 {item.usedSuggestedHelpers.length} 次 / 建议 {item.suggestedHelpers.length} 个
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">signals</p>
                                  <p className="mt-2 break-all text-xs leading-5 text-slate-700">{summarizeTextList(item.keySignals, 3)}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    taskMode {item.taskMode} · stepTypes {summarizeTextList(item.stepTypes, 3)}
                                  </p>
                                  <p className="mt-1 break-all text-[11px] text-slate-500">
                                    响应：{summarizeTraceResponseEvents(item.responseEvents, 2)}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">template</p>
                                  <p className="mt-2 break-all text-xs leading-5 text-slate-700">
                                    {item.compiledSlotCount > 0 ? summarizeTextList(item.compiledSlotUids, 3) : '未记录 compiled template'}
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    compiled {item.compiledSlotCount} slots · patch {item.structuredPatchAttempted ? '已尝试' : '未尝试'}
                                  </p>
                                  <p className="mt-1 break-all text-[11px] text-slate-500">
                                    recipe：{summarizeTextList(item.matchedRecipeSlugs, 2)}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">result</p>
                                  <p className="mt-2 text-xs leading-5 text-slate-700">
                                    {item.status === 'passed' ? '终态通过' : insightFailureClassLabel(item.failureClass)}
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    quality：{intentQualitySplitLabel(item.qualitySplit)}
                                  </p>
                                  <p className="mt-1 break-all text-[11px] text-slate-500">
                                    grader：{item.finalGraderResult.summary}
                                  </p>
                                  {item.verifierResult.failingCheckCount > 0 ? (
                                    <p className="mt-1 break-all text-[11px] text-slate-500">
                                      verifier：{summarizeTraceVerifierChecks(item.verifierResult, 2)}
                                    </p>
                                  ) : null}
                                  {item.verifierResult.expectedOutcome ? (
                                    <p className="mt-1 break-all text-[11px] text-slate-500">
                                      期望：{item.verifierResult.expectedOutcome}
                                    </p>
                                  ) : null}
                                  {item.verificationPolicyNotes.length > 0 ? (
                                    <p className="mt-1 break-all text-[11px] text-slate-500">
                                      policy：{summarizeTextList(item.verificationPolicyNotes, 2)}
                                    </p>
                                  ) : null}
                                  {item.status !== 'passed' && item.finalGraderResult.repairable !== null ? (
                                    <p className="mt-1 text-[11px] text-slate-500">
                                      repair：{item.finalGraderResult.repairable ? '可修复' : '不继续修复'}
                                    </p>
                                  ) : null}
                                  <p className="mt-1 text-[11px] text-slate-500">{item.repairAttempted ? '包含 repair attempt' : '仅首轮 attempt'}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    {item.targetedRepairAttempted ? 'repair 为定向 slot 修补' : 'repair 未进入定向 slot 修补'}
                                  </p>
                                  <p className="mt-1 break-all text-[11px] text-slate-500">patched：{summarizeTextList(item.patchedSlotUids, 3)}</p>
                                  {item.latestRepairObservationSummary ? (
                                    <p className="mt-1 break-all text-[11px] text-slate-500">{item.latestRepairObservationSummary}</p>
                                  ) : null}
                                  {item.latestRepairObservationRecipeSlugs.length > 0 ||
                                  item.latestRepairObservationVerifierCheckUids.length > 0 ? (
                                    <p className="mt-1 break-all text-[11px] text-slate-500">
                                      scope：
                                      {[
                                        item.latestRepairObservationRecipeSlugs.length > 0
                                          ? ` recipe ${summarizeTextList(item.latestRepairObservationRecipeSlugs, 2)}`
                                          : '',
                                        item.latestRepairObservationVerifierCheckUids.length > 0
                                          ? ` verifier ${summarizeTextList(item.latestRepairObservationVerifierCheckUids, 2)}`
                                          : '',
                                      ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              {item.attempts.length > 0 && (
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  {item.attempts.map((attempt) => (
                                    <div
                                      key={`${item.runId}-${attempt.attempt}`}
                                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${traceAttemptOutcomeTone(attempt.outcome)}`}>
                                          #{attempt.attempt} {attempt.kind} · {traceAttemptOutcomeLabel(attempt.outcome)}
                                        </span>
                                        {attempt.failureClass && (
                                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                                            {insightFailureClassLabel(attempt.failureClass)}
                                          </span>
                                        )}
                                      </div>
                                      <div className="mt-2 space-y-1 text-[11px] leading-5 text-slate-500">
                                        <p>Helpers：{summarizeTextList(attempt.usedHelpers, 3)}</p>
                                        <p>Signals：{summarizeTextList(attempt.keySignals, 2)}</p>
                                        <p>Patch：{attempt.structuredPatchStrategy || '—'}</p>
                                        <p>Target：{summarizeTextList(attempt.targetSlotUids, 3)}</p>
                                        <p>Returned：{summarizeTextList(attempt.returnedSlotUids, 3)}</p>
                                        {attempt.repairObservationSummary ? <p>{attempt.repairObservationSummary}</p> : null}
                                        {attempt.patchedRecipeSlugs.length > 0 || attempt.patchedVerifierCheckUids.length > 0 ? (
                                          <p>
                                            Scope：
                                            {[
                                              attempt.patchedRecipeSlugs.length > 0
                                                ? `recipe ${summarizeTextList(attempt.patchedRecipeSlugs, 2)}`
                                                : '',
                                              attempt.patchedVerifierCheckUids.length > 0
                                                ? `verifier ${summarizeTextList(attempt.patchedVerifierCheckUids, 2)}`
                                                : '',
                                            ]
                                              .filter(Boolean)
                                              .join(' · ')}
                                          </p>
                                        ) : null}
                                        <p>
                                          Base：{baseCodeSourceLabel(attempt.baseCodeSource)} ·
                                          {attempt.reusedPreviousCode ? ' 复用上一轮代码' : ' 未复用上一轮代码'}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                      </>
                    )}

                    {insightsView === 'knowledge' && (
                      <>
                        {insights.knowledgeChangeGraders.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">变更效果 Grader</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              这里把 merge / restore 的结构化 provenance 与后续真实 run 结果直接接起来，给出第一版操作级效果证据，避免只看预检 / 回执，不看后续表现。
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                            {insights.knowledgeChangeGraders.length} 条证据
                          </span>
                        </div>

                        <div className="mt-4 space-y-3">
                          {insights.knowledgeChangeGraders.map((item) => (
                            <div key={item.auditId} className="rounded-2xl border border-white/80 bg-white px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium text-slate-900">{item.title}</p>
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700">
                                      {projectKnowledgeOperationLabel(item.operation)}
                                    </span>
                                    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${knowledgeChangeEfficacyStatusTone(item.efficacyStatus)}`}>
                                      {knowledgeChangeEfficacyStatusLabel(item.efficacyStatus)}
                                    </span>
                                    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${mergeImpactStatusTone(item.impactStatus)}`}>
                                      {mergeImpactStatusLabel(item.impactStatus)}
                                    </span>
                                    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${knowledgeChangeEvidenceLevelTone(item.evidenceLevel)}`}>
                                      {knowledgeChangeEvidenceLevelLabel(item.evidenceLevel)}
                                    </span>
                                    {item.mergedCandidateSources.includes('successful_run') && (
                                      <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-700">
                                        successful_run
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-slate-500">
                                    {formatDateTime(item.occurredAt)}
                                    {item.projectUid ? ` · ${item.projectUid}` : ''}
                                    {item.requestedModuleUid ? ` · 模块 ${item.requestedModuleUid}` : ''}
                                  </p>
                                  {item.restoredFrom && (
                                    <p className="mt-1 break-all text-[11px] text-slate-500">
                                      恢复来源：<span className="font-mono">{item.restoredFrom}</span>
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">after</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{item.afterRuns}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    通过 {item.afterPassedRuns} · 失败 {item.afterFailedRuns} · 取消 {item.afterCanceledRuns}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">terminal pass</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.afterPassRate)}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    {item.beforeRuns > 0 ? `基线 ${formatRatePercent(item.beforePassRate)}` : '暂无稳定基线'}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">first pass</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.afterFirstPassRate)}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    {item.beforeRuns > 0 ? `基线 ${formatRatePercent(item.beforeFirstPassRate)}` : '暂无首轮基线'}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">provenance</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">
                                    {item.preflightNoticeCount + item.receiptNoticeCount}
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    预检 {item.preflightNoticeCount} · 回执 {item.receiptNoticeCount}
                                  </p>
                                </div>
                              </div>

                              <p className="mt-3 text-xs leading-6 text-slate-600">{item.recommendation}</p>
                              <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                                <p>影响规则：{summarizeIdList(item.affectedRuleIds)}</p>
                                <p>
                                  变化幅度：终态 {formatRatePercent(item.passRateDelta)} · 首次 {formatRatePercent(item.firstPassRateDelta)}
                                </p>
                                {item.mergedRunIds.length > 0 && <p>关联通过运行：{summarizeIdList(item.mergedRunIds)}</p>}
                                {item.selectedCandidateFeedbackStatuses.length > 0 && (
                                  <p>候选反馈：{item.selectedCandidateFeedbackStatuses.join(' / ')}</p>
                                )}
                                {item.selectedRiskyCandidateIds.length > 0 && (
                                  <p>风险候选：{summarizeIdList(item.selectedRiskyCandidateIds)}</p>
                                )}
                                {item.appliedOverrideCandidateIds.length > 0 && (
                                  <p>人工 override：{summarizeIdList(item.appliedOverrideCandidateIds)}</p>
                                )}
                                {item.appliedAcknowledgedRiskCandidateIds.length > 0 && (
                                  <p>风险确认：{summarizeIdList(item.appliedAcknowledgedRiskCandidateIds)}</p>
                                )}
                                {item.backupPath && (
                                  <p className="break-all">
                                    关联备份：<span className="font-mono">{item.backupPath}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {insights.knowledgeChangeRuleSummaries.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">规则效果汇总</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              把多次 knowledge change grader 聚合到规则层，先看哪些规则长期改善、哪些规则持续恶化，再决定后续 safer merge、回滚和资产提升优先级。
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                            {insights.knowledgeChangeRuleSummaries.length} 条规则
                          </span>
                        </div>

                        <div className="mt-4 space-y-3">
                          {insights.knowledgeChangeRuleSummaries.map((item) => {
                            const positiveEvidenceCount = item.improvingCount + item.recoveredCount;
                            const negativeEvidenceCount = item.regressingCount + item.stillAbnormalCount;

                            return (
                              <div key={item.ruleId} className="rounded-2xl border border-white/80 bg-white px-4 py-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-medium text-slate-900">{item.title}</p>
                                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700">
                                        {projectKnowledgeOperationLabel(item.latestOperation)}
                                      </span>
                                      <span
                                        className={`rounded-full border px-3 py-1 text-[11px] font-medium ${knowledgeChangeEfficacyStatusTone(item.latestEfficacyStatus)}`}
                                      >
                                        {knowledgeChangeEfficacyStatusLabel(item.latestEfficacyStatus)}
                                      </span>
                                      <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${mergeImpactStatusTone(item.latestImpactStatus)}`}>
                                        {mergeImpactStatusLabel(item.latestImpactStatus)}
                                      </span>
                                    </div>
                                    {item.title !== item.ruleId && (
                                      <p className="mt-1 break-all text-[11px] text-slate-500">
                                        规则 ID：<span className="font-mono">{item.ruleId}</span>
                                      </p>
                                    )}
                                    <p className="mt-2 text-xs leading-5 text-slate-500">{formatDateTime(item.latestOccurredAt)}</p>
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">audits</p>
                                    <p className="mt-2 text-lg font-semibold text-slate-950">{item.auditCount}</p>
                                    <p className="mt-1 text-[11px] text-slate-500">
                                      merge {item.mergeCount} · restore {item.restoreCount}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">positive</p>
                                    <p className="mt-2 text-lg font-semibold text-slate-950">{positiveEvidenceCount}</p>
                                    <p className="mt-1 text-[11px] text-slate-500">
                                      改善 {item.improvingCount} · 恢复 {item.recoveredCount}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">negative</p>
                                    <p className="mt-2 text-lg font-semibold text-slate-950">{negativeEvidenceCount}</p>
                                    <p className="mt-1 text-[11px] text-slate-500">
                                      恶化 {item.regressingCount} · 仍异常 {item.stillAbnormalCount}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">evidence</p>
                                    <p className="mt-2 text-lg font-semibold text-slate-950">{item.decisionableCount}</p>
                                    <p className="mt-1 text-[11px] text-slate-500">
                                      充分 {item.decisionableCount} · 早期 {item.earlyCount}
                                    </p>
                                  </div>
                                </div>

                                <p className="mt-3 text-xs leading-6 text-slate-600">{item.recommendation}</p>
                                <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                                  <p>
                                    净变化：终态 {formatRatePercent(item.netPassRateDelta)} · 首次 {formatRatePercent(item.netFirstPassRateDelta)}
                                  </p>
                                  <p>
                                    平稳 {item.neutralCount} · 观察中 {item.watchingCount}
                                  </p>
                                  {item.successfulRunPromotionReceiptCount > 0 && (
                                    <p>
                                      Successful Run 沉淀：回执 {item.successfulRunPromotionReceiptCount} 次 · 关联通过运行{' '}
                                      {item.successfulRunPromotionRunCount} 条
                                      {item.lastSuccessfulRunPromotionRecordedAt
                                        ? ` · 最近 ${formatDateTime(item.lastSuccessfulRunPromotionRecordedAt)}`
                                        : ''}
                                    </p>
                                  )}
                                  {(item.lastSuccessfulRunPromotionRequestedModuleUid ||
                                    item.lastSuccessfulRunPromotionRunIds.length > 0) && (
                                    <p>
                                      最近来源：
                                      {item.lastSuccessfulRunPromotionRequestedModuleUid
                                        ? ` 模块 ${item.lastSuccessfulRunPromotionRequestedModuleUid}`
                                        : ' 模块未记录'}
                                      {item.lastSuccessfulRunPromotionRunIds.length > 0
                                        ? ` · 运行 ${summarizeIdList(item.lastSuccessfulRunPromotionRunIds)}`
                                        : ''}
                                    </p>
                                  )}
                                  {item.supportingAuditIds.length > 0 && <p>关联审计：{summarizeIdList(item.supportingAuditIds)}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                      </>
                    )}

                    {insightsView === 'governance' && (
                      <>
                        {insights.probationRules.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">新规则观察期</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              新 merge 的规则会先进入观察期；观察中轻微降权，观察期内明显拉低通过率会自动降级，并可直接回滚。
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                            {insights.probationRules.length} 条规则批次
                          </span>
                        </div>

                        <div className="mt-4 space-y-3">
                          {insights.probationRules.map((item) => (
                            <div key={item.auditId} className="rounded-2xl border border-white/80 bg-white px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium text-slate-900">{item.title}</p>
                                    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${probationStatusTone(item.status)}`}>
                                      {probationStatusLabel(item.status)}
                                    </span>
                                    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${mergeImpactStatusTone(item.impactStatus)}`}>
                                      {mergeImpactStatusLabel(item.impactStatus)}
                                    </span>
                                    {item.mergedCandidateSources.includes('successful_run') && (
                                      <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-700">
                                        successful_run
                                      </span>
                                    )}
                                    {item.selectedRiskyCandidateIds.length > 0 && (
                                      <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700">
                                        风险候选 {item.selectedRiskyCandidateIds.length}
                                      </span>
                                    )}
                                    {item.appliedOverrideCandidateIds.length > 0 && (
                                      <span className="rounded-full border border-rose-300 bg-rose-100 px-3 py-1 text-[11px] font-medium text-rose-800">
                                        override {item.appliedOverrideCandidateIds.length}
                                      </span>
                                    )}
                                    {item.appliedAcknowledgedRiskCandidateIds.length > 0 && (
                                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                                        风险确认 {item.appliedAcknowledgedRiskCandidateIds.length}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-slate-500">
                                    {formatDateTime(item.occurredAt)}
                                    {item.projectUid ? ` · ${item.projectUid}` : ''}
                                    {item.requestedModuleUid ? ` · 模块 ${item.requestedModuleUid}` : ''}
                                    {item.beforeRuns > 0 ? ` · 基线 ${formatRatePercent(item.beforePassRate)}` : ''}
                                  </p>
                                  {(item.mergedRunIds || []).length > 0 && (
                                    <p className="mt-1 text-[11px] text-slate-500">关联通过运行 {item.mergedRunIds.length} 条</p>
                                  )}
                                </div>
                                {item.status === 'degraded' && item.backupPath && (
                                  <button
                                    type="button"
                                    onClick={() => void restoreProbationRule(item)}
                                    disabled={knowledgeDraftBusy}
                                    className="inline-flex h-9 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-3 text-[11px] font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {knowledgeBackupRestoring ? '回滚中…' : '回滚观察期规则'}
                                  </button>
                                )}
                              </div>

                              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">observed</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{item.observedRuns}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    通过 {item.observedPassedRuns} · 失败 {item.observedFailedRuns} · 取消 {item.observedCanceledRuns}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">terminal pass</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.observedPassRate)}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    {item.beforeRuns > 0 ? `基线 ${formatRatePercent(item.beforePassRate)}` : '暂无稳定基线'}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">first pass</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatRatePercent(item.observedFirstPassRate)}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    {item.beforeRuns > 0 ? `基线 ${formatRatePercent(item.beforeFirstPassRate)}` : '暂无首轮基线'}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">remaining</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{item.remainingRuns}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    {item.status === 'promoted' ? '观察期已完成' : item.status === 'degraded' ? '已自动转入降级保护' : '还需更多终态运行样本'}
                                  </p>
                                </div>
                              </div>

                              <p className="mt-3 text-xs leading-6 text-slate-600">{item.recommendation}</p>
                              <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                                <p>观察规则：{summarizeIdList(item.addedRuleIds)}</p>
                                <p>
                                  首次通过率变化：{formatRatePercent(item.beforeFirstPassRate)} → {formatRatePercent(item.observedFirstPassRate)}
                                </p>
                                {item.selectedCandidateFeedbackStatuses.length > 0 && (
                                  <p>候选反馈：{item.selectedCandidateFeedbackStatuses.join(' / ')}</p>
                                )}
                                {item.selectedRiskyCandidateIds.length > 0 && (
                                  <p>风险候选：{summarizeIdList(item.selectedRiskyCandidateIds)}</p>
                                )}
                                {item.appliedOverrideCandidateIds.length > 0 && (
                                  <p>
                                    人工 override：{summarizeIdList(item.appliedOverrideCandidateIds)}
                                    {item.appliedOverrideCandidateFeedbackStatuses.length > 0
                                      ? ` · ${item.appliedOverrideCandidateFeedbackStatuses.join(' / ')}`
                                      : ''}
                                  </p>
                                )}
                                {item.appliedAcknowledgedRiskCandidateIds.length > 0 && (
                                  <p>
                                    风险确认：{summarizeIdList(item.appliedAcknowledgedRiskCandidateIds)}
                                    {item.appliedAcknowledgedRiskCandidateFeedbackStatuses.length > 0
                                      ? ` · ${item.appliedAcknowledgedRiskCandidateFeedbackStatuses.join(' / ')}`
                                      : ''}
                                  </p>
                                )}
                                {item.backupPath && (
                                  <p className="break-all">
                                    关联备份：<span className="font-mono">{item.backupPath}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {insights.rollbackCandidates.length > 0 ? (
                      <div className="mt-4 space-y-3">
                        {insights.rollbackCandidates.map((candidate) => (
                          <div key={candidate.auditId} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">{candidate.title}</p>
                                <p className="mt-1 text-xs leading-5 text-amber-800">
                                  {formatDateTime(candidate.occurredAt)} · 终态通过率 {formatRatePercent(candidate.beforePassRate)} →{' '}
                                  {formatRatePercent(candidate.afterPassRate)} · 首次通过率 {formatRatePercent(candidate.beforeFirstPassRate)} →{' '}
                                  {formatRatePercent(candidate.afterFirstPassRate)}
                                </p>
                                {candidate.projectUid && !workspaceProjectUid && (
                                  <p className="mt-1 text-[11px] text-amber-700">项目：{candidate.projectUid}</p>
                                )}
                                {(candidate.requestedModuleUid || candidate.mergedRunIds.length > 0) && (
                                  <p className="mt-1 text-[11px] text-amber-700">
                                    {candidate.requestedModuleUid ? `模块：${candidate.requestedModuleUid}` : '全项目作用域'}
                                    {candidate.mergedRunIds.length > 0 ? ` · 关联通过运行 ${candidate.mergedRunIds.length} 条` : ''}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-medium text-amber-800">
                                  可疑回滚候选
                                </span>
                                <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${mergeImpactStatusTone(candidate.impactStatus)}`}>
                                  {mergeImpactStatusLabel(candidate.impactStatus)}
                                </span>
                                {candidate.mergedCandidateSources.includes('successful_run') && (
                                  <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-700">
                                    successful_run
                                  </span>
                                )}
                                {candidate.selectedRiskyCandidateIds.length > 0 && (
                                  <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700">
                                    风险候选 {candidate.selectedRiskyCandidateIds.length}
                                  </span>
                                )}
                                {candidate.appliedOverrideCandidateIds.length > 0 && (
                                  <span className="rounded-full border border-rose-300 bg-white px-3 py-1 text-[11px] font-medium text-rose-800">
                                    override {candidate.appliedOverrideCandidateIds.length}
                                  </span>
                                )}
                                {candidate.appliedAcknowledgedRiskCandidateIds.length > 0 && (
                                  <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-medium text-amber-800">
                                    风险确认 {candidate.appliedAcknowledgedRiskCandidateIds.length}
                                  </span>
                                )}
                                {candidate.backupPath && (
                                  <button
                                    type="button"
                                    onClick={() => void restoreRollbackCandidate(candidate)}
                                    disabled={knowledgeDraftBusy}
                                    className="inline-flex h-9 items-center justify-center rounded-2xl border border-amber-300 bg-white px-3 text-[11px] font-medium text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {knowledgeBackupRestoring ? '回滚中…' : '直接回滚'}
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="mt-3 text-xs leading-6 text-amber-900">{candidate.recommendation}</p>
                            <div className="mt-3 space-y-1 text-[11px] text-amber-800">
                              <p>新增规则：{summarizeIdList(candidate.addedRuleIds)}</p>
                              <p>
                                观察窗口：前 {candidate.beforeRuns} 次 / 后 {candidate.afterRuns} 次
                              </p>
                              <p>
                                下滑幅度：终态 {formatRatePercent(candidate.passRateDelta)} · 首次 {formatRatePercent(candidate.firstPassRateDelta)}
                              </p>
                              {candidate.selectedCandidateFeedbackStatuses.length > 0 && (
                                <p>候选反馈：{candidate.selectedCandidateFeedbackStatuses.join(' / ')}</p>
                              )}
                              {candidate.selectedRiskyCandidateIds.length > 0 && (
                                <p>风险候选：{summarizeIdList(candidate.selectedRiskyCandidateIds)}</p>
                              )}
                              {candidate.appliedOverrideCandidateIds.length > 0 && (
                                <p>
                                  人工 override：{summarizeIdList(candidate.appliedOverrideCandidateIds)}
                                  {candidate.appliedOverrideCandidateFeedbackStatuses.length > 0
                                    ? ` · ${candidate.appliedOverrideCandidateFeedbackStatuses.join(' / ')}`
                                    : ''}
                                </p>
                              )}
                              {candidate.appliedAcknowledgedRiskCandidateIds.length > 0 && (
                                <p>
                                  风险确认：{summarizeIdList(candidate.appliedAcknowledgedRiskCandidateIds)}
                                  {candidate.appliedAcknowledgedRiskCandidateFeedbackStatuses.length > 0
                                    ? ` · ${candidate.appliedAcknowledgedRiskCandidateFeedbackStatuses.join(' / ')}`
                                    : ''}
                                </p>
                              )}
                              {candidate.backupPath && (
                                <p className="break-all">
                                  建议回滚备份：<span className="font-mono">{candidate.backupPath}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">
                        暂未发现明显需要优先回滚的规则合并；继续积累运行样本后，这里会自动提示。
                      </div>
                    )}

                    {insights.mergeProvenanceStats.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">Provenance 趋势</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              这里直接统计 merge / restore 的结构化 preflight / receipt notice，观察最近审计里到底多少次出现默认阻断、override、风险确认、护栏和回滚审计，而不是再从旧 warning 文本里反推。
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                            {insights.mergeProvenanceStats.length} 类 provenance
                          </span>
                        </div>

                        <div className="mt-4 grid items-start gap-3 xl:grid-cols-2">
                          {insights.mergeProvenanceStats.map((item) => (
                            <div key={item.key} className={`self-start rounded-2xl border px-4 py-4 ${projectKnowledgeMergeNoticeTone(item)}`}>
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium">{item.title}</p>
                                    <span className="rounded-full border border-current/20 bg-white/70 px-3 py-1 text-[11px] font-medium">
                                      {mergeProvenanceStageLabel(item.stage)}
                                    </span>
                                    <span className="rounded-full border border-current/20 bg-white/70 px-3 py-1 text-[11px] font-medium">
                                      {projectKnowledgeMergeNoticeProvenanceLabel(item.provenanceType)}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-xs leading-5 opacity-80">
                                    {item.latestOccurredAt ? `最近 ${formatDateTime(item.latestOccurredAt)}` : '尚无时间戳'}
                                    {item.operations.length > 0
                                      ? ` · 来源 ${item.operations.map((operation) => projectKnowledgeOperationLabel(operation)).join(' / ')}`
                                      : ''}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-current/20 bg-white/70 px-3 py-2 text-right text-[11px] opacity-80">
                                  <p className="font-medium">{item.auditCount} 次审计</p>
                                  <p className="mt-1">共 {item.itemCount} 条结构化记录</p>
                                </div>
                              </div>

                              <div className="mt-3 grid items-start gap-3 sm:grid-cols-3">
                                <div className="h-fit rounded-2xl border border-current/15 bg-white/60 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] opacity-60">audits</p>
                                  <p className="mt-2 text-lg font-semibold">{item.auditCount}</p>
                                  <p className="mt-1 text-[11px] opacity-75">命中审计数</p>
                                </div>
                                <div className="h-fit rounded-2xl border border-current/15 bg-white/60 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] opacity-60">candidates</p>
                                  <p className="mt-2 text-lg font-semibold">{item.candidateCount}</p>
                                  <p className="mt-1 text-[11px] opacity-75">关联候选数</p>
                                </div>
                                <div className="h-fit rounded-2xl border border-current/15 bg-white/60 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] opacity-60">rules</p>
                                  <p className="mt-2 text-lg font-semibold">{item.ruleCount}</p>
                                  <p className="mt-1 text-[11px] opacity-75">关联规则数</p>
                                </div>
                              </div>

                              <div className="mt-3 space-y-1 text-[11px] opacity-80">
                                <p>Kind：{item.kind}</p>
                                <p>支持审计：{summarizeIdList(item.supportingAuditIds)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {insights.riskLifecycleRules.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">风险生命周期规则</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              这里按规则汇总结构化 merge provenance、人工风险操作，以及后续转正、降级和回滚候选结果，便于判断哪些规则值得继续自动放量。
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                            {insights.riskLifecycleRules.length} 条规则
                          </span>
                        </div>

                        <div className="mt-4 space-y-3">
                          {insights.riskLifecycleRules.map((item) => (
                            <div key={item.ruleId} className="rounded-2xl border border-white/80 bg-white px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium text-slate-900">{item.title}</p>
                                    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${riskLifecycleStatusTone(item.latestStatus)}`}>
                                      {riskLifecycleStatusLabel(item.latestStatus)}
                                    </span>
                                    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${riskLifecyclePolicyTone(item.policy)}`}>
                                      {riskLifecyclePolicyLabel(item.policy)}
                                    </span>
                                    {item.latestImpactStatus && (
                                      <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${mergeImpactStatusTone(item.latestImpactStatus)}`}>
                                        {mergeImpactStatusLabel(item.latestImpactStatus)}
                                      </span>
                                    )}
                                    {item.mergedCandidateSources.includes('successful_run') && (
                                      <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-700">
                                        successful_run
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-slate-500">
                                    <span className="font-mono">{item.ruleId}</span>
                                    {item.latestOccurredAt ? ` · 最近 ${formatDateTime(item.latestOccurredAt)}` : ''}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-[11px] text-slate-500">
                                  <p className="font-medium text-slate-900">
                                    override {item.overrideAppliedCount} · 风险确认 {item.riskAcknowledgementCount}
                                  </p>
                                  <p className="mt-1">
                                    {item.recentMergeProvenance.windowLabel}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">merge</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{item.mergeAuditCount}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">风险候选 {item.riskySelectionCount} 次</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">probation</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{item.promotedCount + item.watchingCount + item.degradedCount}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    转正 {item.promotedCount} · 观察 {item.watchingCount} · 降级 {item.degradedCount}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">rollback</p>
                                  <p className="mt-2 text-lg font-semibold text-slate-950">{item.rollbackCandidateCount}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">出现回滚候选次数</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">feedback</p>
                                  <p className="mt-2 text-sm font-semibold text-slate-950">
                                    {item.selectedCandidateFeedbackStatuses.length > 0
                                      ? item.selectedCandidateFeedbackStatuses.join(' / ')
                                      : '未标记'}
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-500">历史候选初始状态</p>
                                </div>
                              </div>

                              {item.policyReason && <p className="mt-3 text-xs leading-6 text-slate-700">策略建议：{item.policyReason}</p>}
                              {item.latestRecommendation && <p className="mt-2 text-xs leading-6 text-slate-600">{item.latestRecommendation}</p>}
                              <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                                <p>来源：{item.mergedCandidateSources.join(' / ') || '未标记'}</p>
                                <p>
                                  近期窗口：{item.recentMergeProvenance.windowLabel}
                                  {item.recentMergeProvenance.consideredAuditCount > 0
                                    ? ` · 预检 ${item.recentMergeProvenance.mergeProvenance.preflightNoticeCount} 条 · 回执 ${item.recentMergeProvenance.mergeProvenance.receiptNoticeCount} 条`
                                    : ''}
                                </p>
                                <p>
                                  近期预检：
                                  {item.recentMergeProvenance.consideredAuditCount > 0
                                    ? ` ${summarizeRiskLifecycleRuleProvenanceStage('preflight', item.recentMergeProvenance.mergeProvenance.preflight)}`
                                    : ' —'}
                                </p>
                                <p>
                                  近期回执：
                                  {item.recentMergeProvenance.consideredAuditCount > 0
                                    ? ` ${summarizeRiskLifecycleRuleProvenanceStage('receipt', item.recentMergeProvenance.mergeProvenance.receipt)}`
                                    : ' —'}
                                </p>
                                <p>
                                  结构化预检：{item.mergeProvenance.preflightNoticeCount} 条
                                  {item.mergeProvenance.preflightNoticeCount > 0
                                    ? ` · ${summarizeRiskLifecycleRuleProvenanceStage('preflight', item.mergeProvenance.preflight)}`
                                    : ''}
                                </p>
                                <p>
                                  结构化回执：{item.mergeProvenance.receiptNoticeCount} 条
                                  {item.mergeProvenance.receiptNoticeCount > 0
                                    ? ` · ${summarizeRiskLifecycleRuleProvenanceStage('receipt', item.mergeProvenance.receipt)}`
                                    : ''}
                                </p>
                                <p>支持审计：{summarizeIdList(item.supportingAuditIds)}</p>
                                {item.latestBackupPath && (
                                  <p className="break-all">
                                    最近备份：<span className="font-mono">{item.latestBackupPath}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                      </>
                    )}

                    {insightsView === 'knowledge' && (
                      <>
                        {insights.starterHelpers.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">Starter Helper 建议</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              从已转正或稳定高通过率规则里抽出更适合首轮生成直接复用的 helper，优先减少手写脆弱脚本；若最近已有 review / verify 失败，这里也会直接显示并压制首轮下发。
                            </p>
                            {overallFailurePressureSummary.latestRepairObservationSummary ? (
                              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                                最近 verifier repair observation：{overallFailurePressureSummary.latestRepairObservationSummary}
                                {(overallFailurePressureSummary.latestRepairObservationVerifierCheckUids || []).length > 0
                                  ? ` · verifier ${summarizeTextList(overallFailurePressureSummary.latestRepairObservationVerifierCheckUids || [], 2)}`
                                  : ''}
                                {overallFailurePressureSummary.latestRepairObservationAt
                                  ? ` · ${formatDateTime(overallFailurePressureSummary.latestRepairObservationAt)}`
                                  : ''}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                              {insights.starterHelpers.length} 个 helper
                            </span>
                            {starterHelperFailureSummary.highFailureCandidateCount > 0 && (
                              <span className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-medium text-rose-700">
                                高频失败 {starterHelperFailureSummary.highFailureCandidateCount}
                              </span>
                            )}
                            {starterHelperFailureSummary.recentFailedReviewCapabilityCount > 0 && (
                              <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-medium text-amber-700">
                                复核失败 {starterHelperFailureSummary.recentFailedReviewCapabilityCount}
                              </span>
                            )}
                            {starterHelperFailureSummary.recentFailedVerifyCapabilityCount > 0 && (
                              <span className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-medium text-rose-700">
                                验证失败 {starterHelperFailureSummary.recentFailedVerifyCapabilityCount}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {insights.starterHelpers.map((item) => (
                            <div key={item.helper} className="rounded-2xl border border-white/80 bg-white px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="break-all font-mono text-xs text-slate-900">{item.helper}</p>
                                    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${starterHelperSourceTone(item.source)}`}>
                                      {starterHelperSourceLabel(item.source)}
                                    </span>
                                    {item.knowledgeChangeSignal ? (
                                      <span
                                        className={`rounded-full border px-3 py-1 text-[11px] font-medium ${starterHelperKnowledgeSignalTone(item.knowledgeChangeSignal)}`}
                                      >
                                        {starterHelperKnowledgeSignalLabel(item.knowledgeChangeSignal)}
                                      </span>
                                    ) : item.knowledgeChangeTier ? (
                                      <span
                                        className={`rounded-full border px-3 py-1 text-[11px] font-medium ${starterHelperKnowledgeTierTone(
                                          item.knowledgeChangeTier,
                                          item.knowledgeChangeWatchingKind
                                        )}`}
                                      >
                                        {starterHelperKnowledgeTierLabel(item.knowledgeChangeTier, item.knowledgeChangeWatchingKind)}
                                      </span>
                                    ) : null}
                                    {item.governanceReleaseStatus ? (
                                      <span
                                        className={`rounded-full border px-3 py-1 text-[11px] font-medium ${starterHelperGovernanceReleaseTone(
                                          item.governanceReleaseStatus
                                        )}`}
                                      >
                                        {starterHelperGovernanceReleaseLabel(item.governanceReleaseStatus)}
                                      </span>
                                    ) : null}
                                    {item.preferredPromotionStatus ? (
                                      <span
                                        className={`rounded-full border px-3 py-1 text-[11px] font-medium ${starterHelperPreferredPromotionTone(
                                          item.preferredPromotionStatus
                                        )}`}
                                      >
                                        {starterHelperPreferredPromotionLabel(item.preferredPromotionStatus)}
                                      </span>
                                    ) : null}
                                    {hasIntentVerificationFailurePressureViewHighFailure(item) && (
                                      <span className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-medium text-rose-700">
                                        高频失败
                                      </span>
                                    )}
                                    {(item.recentFailedReviewCapabilityCount || 0) > 0 && (
                                      <span className="rounded-full border border-amber-200 px-3 py-1 text-[11px] font-medium text-amber-700">
                                        复核失败 {item.recentFailedReviewCapabilityCount}
                                      </span>
                                    )}
                                    {(item.recentFailedVerifyCapabilityCount || 0) > 0 && (
                                      <span className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-medium text-rose-700">
                                        验证失败 {item.recentFailedVerifyCapabilityCount}
                                      </span>
                                    )}
                                    {(item.recordedPromotionReceiptCount || 0) > 0 && (
                                      <span className="rounded-full border border-sky-200 px-3 py-1 text-[11px] font-medium text-sky-700">
                                        沉淀回执 {item.recordedPromotionReceiptCount}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-slate-500">
                                    复用 {item.runCount} 次 · 通过 {item.passedRuns} 次 · 通过率 {formatRatePercent(item.passRate)}
                                    {item.suggestedReuseRuns > 0 ? ` · 命中推荐 ${item.suggestedReuseRuns} 次` : ''}
                                  </p>
                                </div>
                              </div>

                              <p className="mt-3 text-xs leading-6 text-slate-600">{item.recommendation}</p>
                              <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                                <p>支持规则：{summarizeIdList(item.supportingRuleTitles.length > 0 ? item.supportingRuleTitles : item.supportingRuleIds)}</p>
                                <p>规则 ID：{summarizeIdList(item.supportingRuleIds)}</p>
                                {item.knowledgeChangeSignalReason && (
                                  <p>
                                    {item.knowledgeChangeTier === 'watching' && !item.knowledgeChangeSignal ? '观察依据：' : '长期依据：'}
                                    {item.knowledgeChangeSignalReason}
                                    {item.knowledgeChangeDecisionableRuleCount
                                      ? `（${item.knowledgeChangeDecisionableRuleCount} 条已判定规则）`
                                      : ''}
                                  </p>
                                )}
                                {item.governanceReleaseStatus && item.governanceReleaseReason ? (
                                  <p>
                                    治理释放：
                                    {item.governanceReleaseReason}
                                    {item.governanceReleaseCapabilityCount
                                      ? `（治理目标 ${item.governanceReleaseCapabilityCount} 条`
                                      : '（'}
                                    {item.governanceReleaseDirectVerifyPassedCapabilityCount
                                      ? `，直接验证通过 ${item.governanceReleaseDirectVerifyPassedCapabilityCount} 条`
                                      : ''}
                                    {item.governanceReleaseLatestVerifyExecutionAt
                                      ? `，最近验证 ${formatDateTime(item.governanceReleaseLatestVerifyExecutionAt)}`
                                      : ''}
                                    ）
                                  </p>
                                ) : null}
                                {item.preferredPromotionReason ? <p>提级建议：{item.preferredPromotionReason}</p> : null}
                                {item.preferredAutoPromotionCondition ? <p>自动提级条件：{item.preferredAutoPromotionCondition}</p> : null}
                                {((item.preferredPromotionRequiredPositiveRuleCount || 0) > 0 ||
                                  (item.preferredPromotionPositiveRuleCount || 0) > 0 ||
                                  (item.preferredPromotionNegativeRuleCount || 0) > 0) && (
                                  <p>
                                    提级进度：
                                    {` 长期正向 ${item.preferredPromotionPositiveRuleCount || 0}/${item.preferredPromotionRequiredPositiveRuleCount || 0} 条`}
                                    {(item.preferredPromotionNegativeRuleCount || 0) > 0
                                      ? `，负向/混合 ${item.preferredPromotionNegativeRuleCount || 0} 条`
                                      : ''}
                                  </p>
                                )}
                                {(item.recentFailedReviewCapabilityCount || 0) > 0 || (item.recentFailedVerifyCapabilityCount || 0) > 0 ? (
                                  <p>
                                    最近能力反馈：
                                    {(item.recentFailedReviewCapabilityCount || 0) > 0
                                      ? ` 保守复核失败 ${item.recentFailedReviewCapabilityCount} 条`
                                      : ''}
                                    {(item.recentFailedReviewCapabilityCount || 0) > 0 &&
                                    (item.recentFailedVerifyCapabilityCount || 0) > 0
                                      ? ' ·'
                                      : ''}
                                    {(item.recentFailedVerifyCapabilityCount || 0) > 0
                                      ? ` 标准验证失败 ${item.recentFailedVerifyCapabilityCount} 条`
                                      : ''}
                                  </p>
                                ) : null}
                                {(item.recentFailedReviewExecutionCount || 0) > 0 || (item.recentFailedVerifyExecutionCount || 0) > 0 ? (
                                  <p>
                                    近 {item.recentFailureWindowDays || 14} 天执行失败：
                                    {(item.recentFailedReviewExecutionCount || 0) > 0
                                      ? ` 复核 ${item.recentFailedReviewExecutionCount} 次`
                                      : ''}
                                    {(item.recentFailedReviewExecutionCount || 0) > 0 &&
                                    (item.recentFailedVerifyExecutionCount || 0) > 0
                                      ? ' ·'
                                      : ''}
                                    {(item.recentFailedVerifyExecutionCount || 0) > 0
                                      ? ` 验证 ${item.recentFailedVerifyExecutionCount} 次`
                                      : ''}
                                  </p>
                                ) : null}
                                {(item.recordedPromotionReceiptCount || 0) > 0 ? (
                                  <p>
                                    沉淀记录：
                                    {` 已写回执 ${item.recordedPromotionReceiptCount || 0} 次`}
                                    {(item.recordedPromotionCapabilityCount || 0) > 0
                                      ? ` · 能力 ${item.recordedPromotionCapabilityCount || 0} 条`
                                      : ''}
                                    {item.lastPromotionRecordedAt ? ` · 最近 ${formatDateTime(item.lastPromotionRecordedAt)}` : ''}
                                  </p>
                                ) : null}
                                {(item.lastPromotionModuleName || item.lastPromotionScenarioTitle || item.lastPromotionSourceRunId) && (
                                  <p>
                                    最近来源：
                                    {[item.lastPromotionModuleName, item.lastPromotionScenarioTitle].filter(Boolean).join(' / ') || '未命名场景'}
                                    {item.lastPromotionSourceRunId ? ` · run ${summarizeIdList([item.lastPromotionSourceRunId])}` : ''}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {insights.suppressedStarterHelpers.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-rose-900">已过滤的 Starter Helper</p>
                            <p className="mt-1 text-xs leading-5 text-rose-700">
                              这些 helper 虽然复用频率和通过率已达到 starter 基线，但因多条 supporting rules 的长期 evidence 仍偏负向，当前不会继续下发到首轮生成。这里会优先汇总高频失败 helper 的治理摘要；若某个 helper 已进入恢复观察评估，也会在卡片内补充治理轨迹。
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-medium text-rose-700">
                              {insights.suppressedStarterHelpers.length} 个 helper
                            </span>
                            {suppressedStarterHelperGovernanceSummary.helperCount > 0 && (
                              <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-medium text-amber-700">
                                治理 helper {suppressedStarterHelperGovernanceSummary.helperCount}
                              </span>
                            )}
                            {suppressedStarterHelperGovernanceSummary.capabilityCount > 0 && (
                              <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-medium text-amber-700">
                                待复核能力 {suppressedStarterHelperGovernanceSummary.capabilityCount}
                              </span>
                            )}
                            {suppressedStarterHelperGovernanceSummary.recentReviewExecutionCount > 0 && (
                              <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-medium text-sky-700">
                                近期治理复核 {suppressedStarterHelperGovernanceSummary.recentReviewExecutionCount}
                              </span>
                            )}
                            {suppressedStarterHelperGovernanceSummary.recentVerifyExecutionCount > 0 && (
                              <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-medium text-blue-700">
                                标准验证 {suppressedStarterHelperGovernanceSummary.recentVerifyExecutionCount}
                              </span>
                            )}
                            {suppressedStarterHelperGovernanceSummary.recentRepairExecutionCount > 0 && (
                              <span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-[11px] font-medium text-violet-700">
                                repair 重跑 {suppressedStarterHelperGovernanceSummary.recentRepairExecutionCount}
                              </span>
                            )}
                            {suppressedStarterHelperFailureSummary.highFailureCandidateCount > 0 && (
                              <span className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-medium text-rose-700">
                                高频失败 {suppressedStarterHelperFailureSummary.highFailureCandidateCount}
                              </span>
                            )}
                            {suppressedStarterHelperFailureSummary.recentFailedReviewCapabilityCount > 0 && (
                              <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-medium text-amber-700">
                                复核失败 {suppressedStarterHelperFailureSummary.recentFailedReviewCapabilityCount}
                              </span>
                            )}
                            {suppressedStarterHelperFailureSummary.recentFailedVerifyCapabilityCount > 0 && (
                              <span className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-medium text-rose-700">
                                验证失败 {suppressedStarterHelperFailureSummary.recentFailedVerifyCapabilityCount}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {insights.suppressedStarterHelpers.map((item) => (
                            <div key={item.helper} className="rounded-2xl border border-white/80 bg-white px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="break-all font-mono text-xs text-slate-900">{item.helper}</p>
                                    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${starterHelperSourceTone(item.source)}`}>
                                      {starterHelperSourceLabel(item.source)}
                                    </span>
                                    <span
                                      className={`rounded-full border px-3 py-1 text-[11px] font-medium ${starterHelperKnowledgeSignalTone(item.knowledgeChangeSignal)}`}
                                    >
                                      {starterHelperKnowledgeSignalLabel(item.knowledgeChangeSignal)}
                                    </span>
                                    {hasIntentVerificationFailurePressureViewHighFailure(item) && (
                                      <span className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-medium text-rose-700">
                                        高频失败
                                      </span>
                                    )}
                                    {(item.recentFailedReviewCapabilityCount || 0) > 0 && (
                                      <span className="rounded-full border border-amber-200 px-3 py-1 text-[11px] font-medium text-amber-700">
                                        复核失败 {item.recentFailedReviewCapabilityCount}
                                      </span>
                                    )}
                                    {(item.recentFailedVerifyCapabilityCount || 0) > 0 && (
                                      <span className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-medium text-rose-700">
                                        验证失败 {item.recentFailedVerifyCapabilityCount}
                                      </span>
                                    )}
                                    {(item.governanceTargetCapabilityCount || 0) > 0 && (
                                      <span className="rounded-full border border-amber-200 px-3 py-1 text-[11px] font-medium text-amber-700">
                                        治理目标 {item.governanceTargetCapabilityCount}
                                      </span>
                                    )}
                                    {item.governanceRecommendationStatus && (
                                      <span
                                        className={`rounded-full border px-3 py-1 text-[11px] font-medium ${suppressedStarterHelperGovernanceRecommendationTone(
                                          item.governanceRecommendationStatus
                                        )}`}
                                      >
                                        {suppressedStarterHelperGovernanceRecommendationLabel(item.governanceRecommendationStatus)}
                                      </span>
                                    )}
                                    {(item.recentGovernanceReviewExecutionCount || 0) > 0 && (
                                      <span className="rounded-full border border-sky-200 px-3 py-1 text-[11px] font-medium text-sky-700">
                                        近期复核 {item.recentGovernanceReviewExecutionCount}
                                      </span>
                                    )}
                                    {(item.recentGovernanceVerifyExecutionCount || 0) > 0 && (
                                      <span className="rounded-full border border-blue-200 px-3 py-1 text-[11px] font-medium text-blue-700">
                                        标准验证 {item.recentGovernanceVerifyExecutionCount}
                                      </span>
                                    )}
                                    {(item.recentGovernanceRepairExecutionCount || 0) > 0 && (
                                      <span className="rounded-full border border-violet-200 px-3 py-1 text-[11px] font-medium text-violet-700">
                                        repair 重跑 {item.recentGovernanceRepairExecutionCount}
                                      </span>
                                    )}
                                    {(item.recordedPromotionReceiptCount || 0) > 0 && (
                                      <span className="rounded-full border border-sky-200 px-3 py-1 text-[11px] font-medium text-sky-700">
                                        沉淀回执 {item.recordedPromotionReceiptCount}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-slate-500">
                                    复用 {item.runCount} 次 · 通过 {item.passedRuns} 次 · 通过率 {formatRatePercent(item.passRate)}
                                    {item.suggestedReuseRuns > 0 ? ` · 命中推荐 ${item.suggestedReuseRuns} 次` : ''}
                                  </p>
                                </div>
                              </div>

                              <p className="mt-3 text-xs leading-6 text-rose-800">{item.suppressionReason}</p>
                              <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                                <p>支持规则：{summarizeIdList(item.supportingRuleTitles.length > 0 ? item.supportingRuleTitles : item.supportingRuleIds)}</p>
                                {item.knowledgeChangeDecisionableRuleCount ? (
                                  <p>已判定规则：{item.knowledgeChangeDecisionableRuleCount} 条</p>
                                ) : null}
                                {item.knowledgeChangeSupportingAuditIds?.length ? (
                                  <p>支持审计：{summarizeIdList(item.knowledgeChangeSupportingAuditIds)}</p>
                                ) : null}
                                {(item.recentFailedReviewCapabilityCount || 0) > 0 || (item.recentFailedVerifyCapabilityCount || 0) > 0 ? (
                                  <p>
                                    最近能力反馈：
                                    {(item.recentFailedReviewCapabilityCount || 0) > 0
                                      ? ` 保守复核失败 ${item.recentFailedReviewCapabilityCount} 条`
                                      : ''}
                                    {(item.recentFailedReviewCapabilityCount || 0) > 0 &&
                                    (item.recentFailedVerifyCapabilityCount || 0) > 0
                                      ? ' ·'
                                      : ''}
                                    {(item.recentFailedVerifyCapabilityCount || 0) > 0
                                      ? ` 标准验证失败 ${item.recentFailedVerifyCapabilityCount} 条`
                                      : ''}
                                  </p>
                                ) : null}
                                {(item.recentFailedReviewExecutionCount || 0) > 0 || (item.recentFailedVerifyExecutionCount || 0) > 0 ? (
                                  <p>
                                    近 {item.recentFailureWindowDays || 14} 天执行失败：
                                    {(item.recentFailedReviewExecutionCount || 0) > 0
                                      ? ` 复核 ${item.recentFailedReviewExecutionCount} 次`
                                      : ''}
                                    {(item.recentFailedReviewExecutionCount || 0) > 0 &&
                                    (item.recentFailedVerifyExecutionCount || 0) > 0
                                      ? ' ·'
                                      : ''}
                                    {(item.recentFailedVerifyExecutionCount || 0) > 0
                                      ? ` 验证 ${item.recentFailedVerifyExecutionCount} 次`
                                      : ''}
                                  </p>
                                ) : null}
                                {item.governanceRecommendationReason ? <p>治理建议：{item.governanceRecommendationReason}</p> : null}
                                {item.governanceAutoUnlockCondition ? <p>自动解封条件：{item.governanceAutoUnlockCondition}</p> : null}
                                {((item.governanceTargetCapabilityCount || 0) > 0 ||
                                  (item.governancePassedCapabilityCount || 0) > 0 ||
                                  (item.governanceDirectVerifyPassedCapabilityCount || 0) > 0) && (
                                  <p>
                                    当前恢复进度：
                                    {` 治理目标通过 ${item.governancePassedCapabilityCount || 0}/${item.governanceTargetCapabilityCount || 0} 条`}
                                    {(item.governanceRequiredPassedCapabilityCount || 0) > 0
                                      ? `，解封门槛 ${item.governanceRequiredPassedCapabilityCount} 条`
                                      : ''}
                                    {`，直接验证通过 ${item.governanceDirectVerifyPassedCapabilityCount || 0} 条`}
                                  </p>
                                )}
                                {(item.governanceTargetCapabilityCount || 0) > 0 ? (
                                  <p>
                                    独立治理回执：
                                    {' '}
                                    待复核能力 {item.governanceTargetCapabilityCount || 0} 条
                                    {` · 最近复核 ${item.recentGovernanceReviewExecutionCount || 0} 次`}
                                    {`（通过 ${item.recentPassedGovernanceReviewExecutionCount || 0} / 失败 ${
                                      item.recentFailedGovernanceReviewExecutionCount || 0
                                    }）`}
                                    {item.latestGovernanceReviewExecutionAt
                                      ? ` · 最近 ${formatDateTime(item.latestGovernanceReviewExecutionAt)}`
                                      : ''}
                                  </p>
                                ) : null}
                                {(item.recordedPromotionReceiptCount || 0) > 0 ? (
                                  <p>
                                    沉淀记录：
                                    {` 已写回执 ${item.recordedPromotionReceiptCount || 0} 次`}
                                    {(item.recordedPromotionCapabilityCount || 0) > 0
                                      ? ` · 能力 ${item.recordedPromotionCapabilityCount || 0} 条`
                                      : ''}
                                    {item.lastPromotionRecordedAt ? ` · 最近 ${formatDateTime(item.lastPromotionRecordedAt)}` : ''}
                                  </p>
                                ) : null}
                                {(item.lastPromotionModuleName || item.lastPromotionScenarioTitle || item.lastPromotionSourceRunId) && (
                                  <p>
                                    最近来源：
                                    {[item.lastPromotionModuleName, item.lastPromotionScenarioTitle].filter(Boolean).join(' / ') || '未命名场景'}
                                    {item.lastPromotionSourceRunId ? ` · run ${summarizeIdList([item.lastPromotionSourceRunId])}` : ''}
                                  </p>
                                )}
                                {(item.recentGovernanceVerifyExecutionCount || 0) > 0 ? (
                                  <p>
                                    标准验证轨迹：
                                    {` 最近验证 ${item.recentGovernanceVerifyExecutionCount || 0} 次`}
                                    {`（通过 ${item.recentPassedGovernanceVerifyExecutionCount || 0} / 失败 ${
                                      item.recentFailedGovernanceVerifyExecutionCount || 0
                                    }）`}
                                    {item.latestGovernanceVerifyExecutionAt
                                      ? ` · 最近 ${formatDateTime(item.latestGovernanceVerifyExecutionAt)}`
                                      : ''}
                                  </p>
                                ) : null}
                                {(item.recentGovernanceRepairExecutionCount || 0) > 0 ? (
                                  <p>
                                    AI repair 轨迹：
                                    {` 重跑 ${item.recentGovernanceRepairExecutionCount || 0} 次`}
                                    {`（通过 ${item.recentPassedGovernanceRepairExecutionCount || 0} / 失败 ${
                                      item.recentFailedGovernanceRepairExecutionCount || 0
                                    }）`}
                                    {item.latestGovernanceRepairExecutionAt
                                      ? ` · 最近 ${formatDateTime(item.latestGovernanceRepairExecutionAt)}`
                                      : ''}
                                  </p>
                                ) : null}
                              </div>

                              {item.governanceCapabilities?.length ? (
                                <div className="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/60 px-3 py-3">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <p className="text-xs font-medium text-amber-900">治理能力时间线</p>
                                      <p className="mt-1 text-[11px] leading-5 text-amber-700">
                                        展示该 helper 当前治理目标里的最近 5 条能力执行轨迹；高频失败 helper 会优先进入上方治理汇总。
                                      </p>
                                    </div>
                                    <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-medium text-amber-700">
                                      {item.governanceCapabilities.length} 条能力
                                    </span>
                                  </div>

                                  <div className="mt-3 space-y-2">
                                    {item.governanceCapabilities.map((capability) => (
                                      <div
                                        key={capability.capabilityUid}
                                        className="rounded-2xl border border-white/90 bg-white/90 px-3 py-3"
                                      >
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                          <div>
                                            <p className="text-sm font-medium text-slate-900">{capability.name}</p>
                                            <p className="mt-1 break-all font-mono text-[11px] leading-5 text-slate-500">
                                              {capability.slug}
                                            </p>
                                          </div>
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span
                                              className={`rounded-full border px-3 py-1 text-[11px] font-medium ${governanceCapabilityExecutionStatusTone(capability.latestExecutionStatus)}`}
                                            >
                                              {governanceCapabilityExecutionStatusLabel(capability.latestExecutionStatus)}
                                            </span>
                                            <span
                                              className={`rounded-full border px-3 py-1 text-[11px] font-medium ${governanceCapabilityExecutionIntentTone(capability.latestExecutionIntent)}`}
                                            >
                                              {governanceCapabilityExecutionIntentLabel(capability.latestExecutionIntent)}
                                            </span>
                                            <span
                                              className={`rounded-full border px-3 py-1 text-[11px] font-medium ${governanceCapabilityExecutionSourceTone(capability.latestExecutionSource)}`}
                                            >
                                              {governanceCapabilityExecutionSourceLabel(capability.latestExecutionSource)}
                                            </span>
                                          </div>
                                        </div>
                                        <p className="mt-2 text-[11px] leading-5 text-slate-500">
                                          {capability.latestExecutionAt
                                            ? `最近执行 ${formatDateTime(capability.latestExecutionAt)}`
                                            : '最近执行记录不足'}
                                          {` · 复核 ${capability.recentReviewExecutionCount} 次`}
                                          {` · 验证 ${capability.recentVerifyExecutionCount} 次`}
                                          {` · repair ${capability.recentRepairExecutionCount} 次`}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                      </>
                    )}

                    {insightsView === 'overview' && (
                      <div className="mt-4 grid items-start gap-3 xl:grid-cols-3">
                      <div className="self-start rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="font-medium text-slate-900">高频命中规则</p>
                        {insights.topRules.length === 0 ? (
                          <p className="mt-3 text-xs leading-5 text-slate-500">还没有足够的历史规则命中数据。</p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {insights.topRules.map((item) => (
                              <div key={item.ruleId} className="rounded-2xl border border-white/80 bg-white px-3 py-3">
                                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                                <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.ruleId}</p>
                                <p className="mt-2 text-xs text-slate-600">
                                  命中 {item.runCount} 次 · 通过 {item.passedRuns} 次 · 通过率 {formatRatePercent(item.passRate)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="self-start rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="font-medium text-slate-900">最常用 Helper</p>
                        {insights.topHelpers.length === 0 ? (
                          <p className="mt-3 text-xs leading-5 text-slate-500">还没有足够的 helper 复用数据。</p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {insights.topHelpers.map((item) => (
                              <div key={item.helper} className="rounded-2xl border border-white/80 bg-white px-3 py-3">
                                <p className="break-all font-mono text-xs text-slate-900">{item.helper}</p>
                                <p className="mt-2 text-xs text-slate-600">
                                  使用 {item.runCount} 次 · 通过率 {formatRatePercent(item.passRate)} · 命中推荐 {item.suggestedReuseRuns} 次
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="self-start rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="font-medium text-slate-900">常见失败类别</p>
                        {insights.failureClasses.length === 0 ? (
                          <p className="mt-3 text-xs leading-5 text-slate-500">最近失败样本不足，暂时没有明显模式。</p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {insights.failureClasses.map((item) => (
                              <div key={item.failureClass} className="flex items-center justify-between rounded-2xl border border-white/80 bg-white px-3 py-3">
                                <div>
                                  <p className="text-sm font-medium text-slate-900">
                                    {intentFailureClassLabel(item.failureClass as IntentFailureTriage['failureClass'])}
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-500">{item.failureClass}</p>
                                  {item.latestRepairObservationSummary ? (
                                    <p className="mt-2 text-[11px] leading-5 text-slate-500">
                                      {item.latestRepairObservationSummary}
                                      {item.latestRepairObservationVerifierCheckUids.length > 0
                                        ? ` · verifier ${summarizeTextList(item.latestRepairObservationVerifierCheckUids, 2)}`
                                        : ''}
                                    </p>
                                  ) : null}
                                </div>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                                  {item.count} 次
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                    {insightsLoading ? '正在汇总最近运行趋势…' : '洞察还未加载；点击“刷新洞察”后可查看成功率、规则命中和回滚提示。'}
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">最近审计记录</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      每次 merge / restore 都会在本地落一条审计；如果当前已选项目，也会顺带尝试写入项目 activity。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refreshProjectKnowledgeAudits()}
                    disabled={knowledgeAuditsLoading}
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {knowledgeAuditsLoading ? '刷新中…' : '刷新审计记录'}
                  </button>
                </div>
                {knowledgeAuditPath && <p className="mt-2 break-all font-mono text-[11px] text-slate-500">{knowledgeAuditPath}</p>}
                {workspaceProjectUid && (
                  <p className="mt-1 text-[11px] text-slate-500">当前仅展示项目 {workspaceProjectUid} 关联的审计记录。</p>
                )}

                {knowledgeAudits.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                    还没有项目知识审计记录；执行一次规则合并或回滚后，这里会自动出现。
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {knowledgeAudits.map((item) => {
                      const selectedRiskyCandidateCount = item.meta.selectedRiskyCandidateIds?.length || 0;
                      const appliedOverrideCount = item.meta.appliedOverrideCandidateIds?.length || 0;
                      const appliedRiskAcknowledgementCount = item.meta.appliedAcknowledgedRiskCandidateIds?.length || 0;
                      const selectedFeedbackStatuses = item.meta.selectedCandidateFeedbackStatuses || [];
                      const selectionSummary = item.meta.selectionSummary || null;
                      const preflightSummary = item.meta.preflightSummary || null;
                      const mergeReceipts = item.meta.mergeReceipts || [];
                      const successfulRunKnowledgePromotionReceipt = item.meta.successfulRunKnowledgePromotionReceipt || null;
                      const successfulRunKnowledgePromotionRunIds = successfulRunKnowledgePromotionReceipt
                        ? uniqueStrings(successfulRunKnowledgePromotionReceipt.items.flatMap((receiptItem) => receiptItem.runIds))
                        : [];
                      const autoPromoteCount = selectionSummary?.autoPromoteCandidateIds.length || 0;
                      const blockDefaultMergeCount = selectionSummary?.blockDefaultMergeCandidateIds.length || 0;
                      const hasRiskDrilldown =
                        selectedRiskyCandidateCount > 0 || appliedOverrideCount > 0 || appliedRiskAcknowledgementCount > 0;

                      return (
                        <div key={item.auditId} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                    item.operation === 'restore'
                                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                      : 'border border-sky-200 bg-sky-50 text-sky-700'
                                  }`}
                                >
                                  {projectKnowledgeOperationLabel(item.operation)}
                                </span>
                                <p className="font-medium text-slate-900">{item.title}</p>
                              </div>
                              <p className="mt-2 text-xs text-slate-500">
                                {formatDateTime(item.occurredAt)} · {formatActorLabel(item.actorLabel)}
                                {item.projectUid ? ` · ${item.projectUid}` : ''}
                              </p>
                              {(item.meta.requestedModuleUid || (item.meta.mergedCandidateSources || []).length > 0) && (
                                <p className="mt-1 text-[11px] text-slate-500">
                                  {item.meta.requestedModuleUid ? `模块 ${item.meta.requestedModuleUid}` : '全项目作用域'}
                                  {(item.meta.mergedCandidateSources || []).length > 0
                                    ? ` · 来源 ${item.meta.mergedCandidateSources?.join(' / ')}`
                                    : ''}
                                </p>
                              )}
                              {(selectedRiskyCandidateCount > 0 ||
                                appliedOverrideCount > 0 ||
                                appliedRiskAcknowledgementCount > 0 ||
                                selectedFeedbackStatuses.length > 0) && (
                                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                  {selectedRiskyCandidateCount > 0 && (
                                    <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700">
                                      风险候选 {selectedRiskyCandidateCount}
                                    </span>
                                  )}
                                  {appliedOverrideCount > 0 && (
                                    <span className="inline-flex rounded-full border border-rose-300 bg-rose-100 px-2.5 py-1 text-rose-800">
                                      override {appliedOverrideCount}
                                    </span>
                                  )}
                                  {appliedRiskAcknowledgementCount > 0 && (
                                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
                                      风险确认 {appliedRiskAcknowledgementCount}
                                    </span>
                                  )}
                                  {selectedFeedbackStatuses.length > 0 && (
                                    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                                      状态 {selectedFeedbackStatuses.join(' / ')}
                                    </span>
                                  )}
                                  {autoPromoteCount > 0 && (
                                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                                      自动晋升 {autoPromoteCount}
                                    </span>
                                  )}
                                  {blockDefaultMergeCount > 0 && (
                                    <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700">
                                      默认阻断 {blockDefaultMergeCount}
                                    </span>
                                  )}
                                  {preflightSummary && preflightSummary.itemCount > 0 && (
                                    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                                      预检 {preflightSummary.itemCount}
                                    </span>
                                  )}
                                  {mergeReceipts.length > 0 && (
                                    <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-violet-700">
                                      回执 {mergeReceipts.length}
                                    </span>
                                  )}
                                  {successfulRunKnowledgePromotionReceipt && (
                                    <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-cyan-700">
                                      Successful Run 回执
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-right text-[11px] text-slate-500">
                              <p className="font-medium text-slate-900">
                                {item.comparison.before.ruleCount} <span className="text-slate-400">→</span> {item.comparison.after.ruleCount}
                              </p>
                              <p className="mt-1">规则总数</p>
                            </div>
                          </div>

                          {item.detail && <p className="mt-3 text-xs leading-6 text-slate-600">{item.detail}</p>}

                          {selectionSummary && (
                            <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs leading-6 text-slate-600">
                              <p className="font-medium text-slate-900">结构化合并范围</p>
                              <div className="mt-2 grid gap-2 md:grid-cols-4">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">selected</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectionSummary.selectedCandidateCount}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">merged</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectionSummary.mergeCandidateCount}</p>
                                </div>
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                                  <p className="text-[10px] uppercase tracking-[0.14em] text-rose-500">override required</p>
                                  <p className="mt-1 text-sm font-semibold">{selectionSummary.overrideRequiredCandidateIds.length}</p>
                                </div>
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                                  <p className="text-[10px] uppercase tracking-[0.14em] text-amber-500">risk ack required</p>
                                  <p className="mt-1 text-sm font-semibold">{selectionSummary.riskAcknowledgementRequiredCandidateIds.length}</p>
                                </div>
                              </div>
                              <p className="mt-2">规则：{summarizeIdList(selectionSummary.selectedRuleIds)}</p>
                              <p className="mt-1">来源：{summarizeTextList(selectionSummary.selectedSources, 3)}</p>
                              <p className="mt-1">策略：{summarizeTextList(selectionSummary.selectedLifecyclePolicies, 4)}</p>
                            </div>
                          )}

                          {hasRiskDrilldown && (
                            <div className="mt-3 grid gap-2 text-[11px] text-slate-600 md:grid-cols-3">
                              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
                                <p className="font-medium text-rose-900">风险候选</p>
                                <p className="mt-1">{summarizeIdList(item.meta.selectedRiskyCandidateIds || [])}</p>
                                {selectedFeedbackStatuses.length > 0 && (
                                  <p className="mt-1 text-rose-700">状态：{selectedFeedbackStatuses.join(' / ')}</p>
                                )}
                              </div>
                              {appliedOverrideCount > 0 && (
                                <div className="rounded-xl border border-rose-300 bg-rose-100 px-3 py-2">
                                  <p className="font-medium text-rose-900">人工 Override</p>
                                  <p className="mt-1">{summarizeIdList(item.meta.appliedOverrideCandidateIds || [])}</p>
                                  {(item.meta.appliedOverrideCandidateFeedbackStatuses || []).length > 0 && (
                                    <p className="mt-1 text-rose-700">
                                      状态：{item.meta.appliedOverrideCandidateFeedbackStatuses?.join(' / ')}
                                    </p>
                                  )}
                                </div>
                              )}
                              {appliedRiskAcknowledgementCount > 0 && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                                  <p className="font-medium text-amber-900">风险确认</p>
                                  <p className="mt-1">{summarizeIdList(item.meta.appliedAcknowledgedRiskCandidateIds || [])}</p>
                                  {(item.meta.appliedAcknowledgedRiskCandidateFeedbackStatuses || []).length > 0 && (
                                    <p className="mt-1 text-amber-700">
                                      状态：{item.meta.appliedAcknowledgedRiskCandidateFeedbackStatuses?.join(' / ')}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {preflightSummary && preflightSummary.items.length > 0 && (
                            <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-medium text-slate-900">结构化预检</p>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] text-slate-600">
                                  {preflightSummary.itemCount} 项
                                </span>
                              </div>
                              <div className="mt-3 space-y-2">
                                {preflightSummary.items.map((notice, index) => (
                                  <div key={`${item.auditId}-preflight-${index}`} className={`rounded-xl border px-3 py-2 ${projectKnowledgeMergeNoticeTone(notice)}`}>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded-full border border-current/20 bg-white/70 px-2 py-0.5 text-[10px] font-medium">
                                        {projectKnowledgeMergeNoticeProvenanceLabel(notice.provenanceType)}
                                      </span>
                                      <p className="font-medium">{notice.title}</p>
                                    </div>
                                    <p className="mt-1 leading-5">{notice.message}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {mergeReceipts.length > 0 && (
                            <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-medium text-slate-900">结构化回执</p>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] text-slate-600">
                                  {mergeReceipts.length} 条
                                </span>
                              </div>
                              <div className="mt-3 space-y-2">
                                {mergeReceipts.map((receipt, index) => (
                                  <div key={`${item.auditId}-receipt-${index}`} className={`rounded-xl border px-3 py-2 ${projectKnowledgeMergeNoticeTone(receipt)}`}>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded-full border border-current/20 bg-white/70 px-2 py-0.5 text-[10px] font-medium">
                                        {projectKnowledgeMergeNoticeProvenanceLabel(receipt.provenanceType)}
                                      </span>
                                      <p className="font-medium">{receipt.title}</p>
                                    </div>
                                    <p className="mt-1 leading-5">{receipt.message}</p>
                                    {receipt.ruleIds.length > 0 && <p className="mt-1 text-[11px] opacity-90">规则：{summarizeIdList(receipt.ruleIds)}</p>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {successfulRunKnowledgePromotionReceipt && (
                            <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50/60 px-4 py-3 text-xs text-cyan-900">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="font-medium text-cyan-950">{successfulRunKnowledgePromotionReceipt.title}</p>
                                  <p className="mt-1 leading-5 text-cyan-800">{successfulRunKnowledgePromotionReceipt.detail}</p>
                                  <p className="mt-2 text-[11px] leading-5 text-cyan-800">
                                    回执：{successfulRunKnowledgePromotionReceipt.receiptId}
                                    {successfulRunKnowledgePromotionReceipt.requestedModuleUid
                                      ? ` · 模块 ${successfulRunKnowledgePromotionReceipt.requestedModuleUid}`
                                      : ''}
                                    {successfulRunKnowledgePromotionRunIds.length > 0
                                      ? ` · 运行 ${summarizeIdList(successfulRunKnowledgePromotionRunIds)}`
                                      : ''}
                                  </p>
                                </div>
                                <span className="rounded-full border border-cyan-200 bg-white px-2.5 py-1 text-[10px] font-medium text-cyan-700">
                                  {successfulRunKnowledgePromotionReceipt.summary.mergedRuleCount} 条规则
                                </span>
                              </div>
                              <div className="mt-3 grid gap-2 md:grid-cols-4">
                                <div className="rounded-xl border border-cyan-100 bg-white px-3 py-2">
                                  <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-500">requested</p>
                                  <p className="mt-1 text-sm font-semibold text-cyan-950">
                                    {successfulRunKnowledgePromotionReceipt.summary.requestedCandidateCount}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-emerald-700">
                                  <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-500">merged</p>
                                  <p className="mt-1 text-sm font-semibold">
                                    {successfulRunKnowledgePromotionReceipt.summary.mergedRuleCount}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-sky-100 bg-white px-3 py-2 text-sky-700">
                                  <p className="text-[10px] uppercase tracking-[0.14em] text-sky-500">runs</p>
                                  <p className="mt-1 text-sm font-semibold">
                                    {successfulRunKnowledgePromotionReceipt.summary.runCount}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700">
                                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">helpers</p>
                                  <p className="mt-1 text-sm font-semibold">
                                    {successfulRunKnowledgePromotionReceipt.summary.helperCount}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-3 space-y-2">
                                {successfulRunKnowledgePromotionReceipt.items.slice(0, 3).map((receiptItem) => (
                                  <div key={`${item.auditId}-${receiptItem.candidateId}`} className="rounded-xl border border-cyan-100 bg-white px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${successfulRunKnowledgePromotionReceiptStatusTone(receiptItem.status)}`}
                                      >
                                        {successfulRunKnowledgePromotionReceiptStatusLabel(receiptItem.status)}
                                      </span>
                                      {receiptItem.feedbackStatus && (
                                        <span
                                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${knowledgeDraftFeedbackTone(receiptItem.feedbackStatus)}`}
                                        >
                                          反馈 · {knowledgeDraftFeedbackLabel(receiptItem.feedbackStatus)}
                                        </span>
                                      )}
                                      {receiptItem.lifecyclePolicy && (
                                        <span
                                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${riskLifecyclePolicyTone(receiptItem.lifecyclePolicy)}`}
                                        >
                                          策略 · {riskLifecyclePolicyLabel(receiptItem.lifecyclePolicy)}
                                        </span>
                                      )}
                                      <p className="font-medium text-slate-900">{receiptItem.ruleTitle}</p>
                                    </div>
                                    <p className="mt-1 font-mono text-[11px] text-slate-500">{receiptItem.ruleId}</p>
                                    <p className="mt-1 text-[11px] text-slate-600">
                                      通过运行 {receiptItem.runIds.length} 条
                                      {receiptItem.successfulStrategies.length > 0
                                        ? ` · helper ${summarizeTextList(receiptItem.successfulStrategies, 3)}`
                                        : ''}
                                    </p>
                                  </div>
                                ))}
                                {successfulRunKnowledgePromotionReceipt.items.length > 3 && (
                                  <p className="text-[11px] text-cyan-800">
                                    其余 {successfulRunKnowledgePromotionReceipt.items.length - 3} 条 successful run 候选已折叠。
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {(item.sourcePath || item.backupPath) && (
                            <div className="mt-3 space-y-1 text-[11px] text-slate-500">
                              {item.sourcePath && (
                                <p className="break-all">
                                  来源：<span className="font-mono">{item.sourcePath}</span>
                                </p>
                              )}
                              {item.backupPath && (
                                <p className="break-all">
                                  备份：<span className="font-mono">{item.backupPath}</span>
                                </p>
                              )}
                            </div>
                          )}

                          <div className="mt-3 grid gap-2 text-[11px] text-slate-500 md:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                              <p className="font-medium text-slate-900">新增</p>
                              <p className="mt-1">{summarizeIdList(item.comparison.addedRuleIds)}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                              <p className="font-medium text-slate-900">移除</p>
                              <p className="mt-1">{summarizeIdList(item.comparison.removedRuleIds)}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                              <p className="font-medium text-slate-900">更新</p>
                              <p className="mt-1">{summarizeIdList(item.comparison.updatedRuleIds)}</p>
                            </div>
                          </div>

                          {item.meta.projectActivityLogged && (
                            <p className="mt-3 text-[11px] text-emerald-600">已同步写入项目活动记录。</p>
                          )}
                          {item.meta.projectActivityError && (
                            <p className="mt-3 text-[11px] text-amber-600">项目活动未写入：{item.meta.projectActivityError}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">规则备份</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      每次合并前都会自动备份旧规则；这里可以直接选择某个备份回滚，不需要你手动改 JSON。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refreshProjectKnowledgeBackups()}
                    disabled={knowledgeDraftBusy}
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {knowledgeBackupsLoading ? '刷新中…' : '刷新备份列表'}
                  </button>
                </div>
                {knowledgeBackupDir && <p className="mt-2 break-all font-mono text-[11px] text-slate-500">{knowledgeBackupDir}</p>}

                {knowledgeBackups.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                    还没有可回滚的规则备份；第一次执行“合并选中规则”后，这里会自动出现历史版本。
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {knowledgeBackups.map((item) => (
                      <div key={item.path} className="rounded-2xl border border-slate-200 bg-slate-50/75 px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-[11px] text-slate-600">{item.path}</p>
                            <p className="mt-2 text-xs text-slate-500">
                              {formatDateTime(item.createdAt)} · {formatFileSize(item.sizeBytes)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void restoreProjectKnowledgeBackup(item.path)}
                            disabled={knowledgeDraftBusy}
                            className="inline-flex h-10 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-4 text-xs text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {knowledgeBackupRestoring ? '回滚中…' : '回滚到此备份'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {knowledgeDraftPreview ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">repair clusters</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{knowledgeDraftPreview.summary.totalClusters}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">eligible</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{knowledgeDraftPreview.summary.eligibleClusters}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">candidate groups</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{knowledgeDraftPreview.summary.candidateGroups}</p>
                    </div>
                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-cyan-700">
                      <p className="text-xs uppercase tracking-[0.14em] text-cyan-500">passed runs</p>
                      <p className="mt-2 text-2xl font-semibold">{knowledgeDraftPreview.summary.totalPassedRuns}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
                      <p className="text-xs uppercase tracking-[0.14em] text-emerald-500">suggested</p>
                      <p className="mt-2 text-2xl font-semibold">{knowledgeDraftPreview.summary.suggestedCandidates}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
                      <p className="text-xs uppercase tracking-[0.14em] text-amber-500">already covered</p>
                      <p className="mt-2 text-2xl font-semibold">{knowledgeDraftPreview.summary.alreadyCoveredCandidates}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">merged rules</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{knowledgeDraftPreview.mergedProfilePreview.rules.length}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-xs leading-6 text-slate-600">
                    <p className="font-medium text-slate-900">预览信息</p>
                    <p className="mt-2">生成时间：{formatDateTime(knowledgeDraftPreview.generatedAt)}</p>
                    <p className="mt-1">
                      阈值：seen ≥ {knowledgeDraftPreview.thresholds.minSeenCount} · resolved ≥ {knowledgeDraftPreview.thresholds.minResolvedCount} · top {knowledgeDraftPreview.thresholds.maxCandidates}
                    </p>
                    <p className="mt-1">
                      候选来源：repair memory {knowledgeDraftPreview.summary.repairMemoryCandidateGroups} 组 · successful run {knowledgeDraftPreview.summary.successfulRunCandidateGroups} 组
                    </p>
                    {(knowledgeDraftPreview.thresholds.projectUid || knowledgeDraftPreview.thresholds.moduleUid) && (
                      <p className="mt-1">
                        作用域：{knowledgeDraftPreview.thresholds.projectUid || '当前项目'}
                        {knowledgeDraftPreview.thresholds.moduleUid ? ` / ${knowledgeDraftPreview.thresholds.moduleUid}` : ' / 全项目'}
                      </p>
                    )}
                    <p className="mt-1 break-all">
                      repair memory：<span className="font-mono">{knowledgeDraftPreview.sourceMemoryPath}</span>
                    </p>
                    <p className="mt-1 break-all">
                      目标规则：<span className="font-mono">{knowledgeDraftPreview.targetKnowledgePath}</span>
                    </p>
                    <p className="mt-1 break-all">
                      草稿输出：<span className="font-mono">{knowledgeDraftPreview.outputPath}</span>
                    </p>
                  </div>

                  {knowledgeDraftPreview.candidates.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">
                      当前没有满足阈值的新候选规则；可以继续积累 repair memory，或下调阈值再试。
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                        <div className="space-y-1">
                          <p>
                            当前已选 {knowledgeDraftSelectedCount} 条；默认推荐 {knowledgeDraftMergeRecommendedCount} / {knowledgeDraftSelectableCount} 条安全候选。
                          </p>
                          {knowledgeDraftDefaultDeferredCount > 0 && (
                            <p className="text-[11px] text-amber-700">
                              其中 {knowledgeDraftDeferredReasonSummary} 默认不会合并；如需继续纳入，请手工勾选并先小范围验证。
                              {knowledgeDraftSelectedDeferredReasonSummary ? ` 当前已手工纳入 ${knowledgeDraftSelectedDeferredReasonSummary}。` : ''}
                            </p>
                          )}
                          {(knowledgeDraftSelectedAutoPromoteCount > 0 ||
                            knowledgeDraftSelectedObservePolicyCount > 0 ||
                            knowledgeDraftSelectedBlockDefaultMergeCount > 0 ||
                            knowledgeDraftSelectedProbationaryCount > 0 ||
                            knowledgeDraftSelectedNegativeHistoryDeferredCount > 0 ||
                            knowledgeDraftSelectedManualReviewCount > 0) && (
                            <p className="text-[11px] text-slate-600">
                              本次选择预检：
                              {knowledgeDraftSelectedAutoPromoteCount > 0 ? ` 自动晋升 ${knowledgeDraftSelectedAutoPromoteCount} 条；` : ''}
                              {knowledgeDraftSelectedObservePolicyCount > 0 ? ` 继续观察 ${knowledgeDraftSelectedObservePolicyCount} 条；` : ''}
                              {knowledgeDraftSelectedNegativeHistoryDeferredCount > 0
                                ? ` 负向历史证据 ${knowledgeDraftSelectedNegativeHistoryDeferredCount} 条（建议复核）；`
                                : ''}
                              {knowledgeDraftSelectedBlockDefaultMergeCount > 0
                                ? ` 默认阻断 ${knowledgeDraftSelectedBlockDefaultMergeCount} 条（将写入 override provenance）；`
                                : knowledgeDraftSelectedManualReviewCount > 0
                                  ? ` 人工 override ${knowledgeDraftSelectedManualReviewCount} 条；`
                                  : ''}
                              {knowledgeDraftSelectedProbationaryCount > 0
                                ? ` 风险确认 ${knowledgeDraftSelectedProbationaryCount} 条（提交时会一并确认）；`
                                : ''}
                            </p>
                          )}
                          {knowledgeDraftSelectedProbationaryCount > 0 && (
                            <p className="text-[11px] text-amber-700">
                              当前包含 {knowledgeDraftSelectedProbationaryCount} 条观察期候选；提交时会要求显式确认风险，并建议先小范围验证。
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={selectAllKnowledgeDraftCandidates}
                            disabled={knowledgeDraftBusy || knowledgeDraftMergeRecommendedCount === 0}
                            className="inline-flex h-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            全选推荐项
                          </button>
                          {knowledgeDraftDefaultDeferredCount > 0 && (
                            <button
                              type="button"
                              onClick={selectAllMergeableKnowledgeDraftCandidates}
                              disabled={knowledgeDraftBusy || knowledgeDraftSelectableCount === 0}
                              className="inline-flex h-9 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-3 text-xs text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              包含保守项全选
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={clearKnowledgeDraftSelection}
                            disabled={knowledgeDraftBusy || knowledgeDraftSelectedCount === 0}
                            className="inline-flex h-9 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            清空选择
                          </button>
                        </div>
                      </div>

                      {knowledgeDraftDisplayCandidates.map((candidate) => {
                        const isSelected = knowledgeDraftSelectedCandidateIdSet.has(candidate.candidateId);
                        const selectionLabel = knowledgeDraftSelectionStateLabel(candidate, isSelected);
                        const supportsSuccessfulRuns = candidate.source === 'successful_run';
                        const feedbackEvidenceReasons = candidate.feedback ? knowledgeDraftFeedbackEvidenceReasons(candidate.feedback) : [];

                        return (
                          <article
                            key={candidate.candidateId}
                            className={`rounded-[24px] border p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ${knowledgeDraftCandidateCardTone(candidate)}`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <label
                                  className={`inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${knowledgeDraftSelectionTone(candidate, isSelected)}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={candidate.alreadyCovered}
                                    onChange={() => toggleKnowledgeDraftCandidate(candidate.candidateId)}
                                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 disabled:cursor-not-allowed"
                                  />
                                  <span>{selectionLabel}</span>
                                </label>
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{candidate.rule.title}</p>
                                  <p className="mt-1 font-mono text-[11px] text-slate-500">{candidate.rule.id}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] text-sky-700">
                                  置信度 {formatKnowledgeDraftConfidence(candidate.confidence)}
                                </span>
                                <span className={`rounded-full border px-3 py-1 text-[11px] ${knowledgeDraftCandidateSourceTone(candidate.source)}`}>
                                  {knowledgeDraftCandidateSourceLabel(candidate.source)}
                                </span>
                                <span className={`rounded-full border px-3 py-1 text-[11px] ${knowledgeDraftFeedbackTone(candidate.feedback?.status)}`}>
                                  {knowledgeDraftFeedbackLabel(candidate.feedback?.status)}
                                </span>
                                {candidate.feedback?.lifecyclePolicy && (
                                  <span
                                    className={`rounded-full border px-3 py-1 text-[11px] ${riskLifecyclePolicyTone(candidate.feedback.lifecyclePolicy)}`}
                                  >
                                    {riskLifecyclePolicyLabel(candidate.feedback.lifecyclePolicy)}
                                  </span>
                                )}
                                <span
                                  className={`rounded-full border px-3 py-1 text-[11px] ${
                                    candidate.alreadyCovered
                                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                                      : isIntentProjectKnowledgeDraftCandidateDeprioritized(candidate)
                                        ? 'border-slate-200 bg-white text-slate-600'
                                        : isIntentProjectKnowledgeDraftCandidateDeferredByDefault(candidate)
                                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                                          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  {candidate.alreadyCovered
                                    ? '已被现有规则覆盖'
                                    : isIntentProjectKnowledgeDraftCandidateDeprioritized(candidate)
                                      ? '默认不合并'
                                      : isIntentProjectKnowledgeDraftCandidateDeferredByDefault(candidate)
                                        ? '建议复核'
                                        : '建议新增'}
                                </span>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-4">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50/75 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">seen</p>
                                <p className="mt-2 text-lg font-semibold text-slate-950">{candidate.seenCount}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50/75 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">resolved</p>
                                <p className="mt-2 text-lg font-semibold text-slate-950">{candidate.resolvedCount}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50/75 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">success rate</p>
                                <p className="mt-2 text-lg font-semibold text-slate-950">{formatKnowledgeDraftConfidence(candidate.successRate)}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50/75 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                                  {supportsSuccessfulRuns ? 'passed runs' : 'clusters'}
                                </p>
                                <p className="mt-2 text-lg font-semibold text-slate-950">
                                  {supportsSuccessfulRuns ? candidate.runIds?.length || 0 : candidate.clusterIds.length}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50/75 px-3 py-3 text-xs leading-5 text-slate-600">
                                <p className="font-medium text-slate-900">样本范围</p>
                                <p className="mt-2">来源：{knowledgeDraftCandidateSourceLabel(candidate.source)}</p>
                                <p className="mt-1">分类：{candidate.category}</p>
                                {supportsSuccessfulRuns && (
                                  <p className="mt-1">关联通过运行：{candidate.runIds?.length || 0} 条</p>
                                )}
                                <p className="mt-1 break-all">URL：{summarizeTextList(candidate.sampleUrls, 2)}</p>
                                <p className="mt-1">标题：{summarizeTextList(candidate.sampleTitles, 2)}</p>
                                <p className="mt-1">描述：{summarizeTextList(candidate.sampleDescriptions, 2)}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50/75 px-3 py-3 text-xs leading-5 text-slate-600">
                                <p className="font-medium text-slate-900">策略沉淀</p>
                                <p className="mt-2">成功修法：{summarizeTextList(candidate.successfulStrategies, 3)}</p>
                                <p className="mt-1">常见误区：{summarizeTextList(candidate.antiPatterns, 3)}</p>
                                <p className="mt-1">代表错误：{summarizeTextList(candidate.representativeErrors, 2)}</p>
                              </div>
                            </div>

                            {candidate.feedback && (
                              <div className={`mt-4 rounded-2xl border px-3 py-3 text-xs leading-5 ${knowledgeDraftFeedbackTone(candidate.feedback.status)}`}>
                                <p className="font-medium">
                                  历史反馈 · {knowledgeDraftFeedbackLabel(candidate.feedback.status)} · 调整 {candidate.feedback.confidenceAdjustment >= 0 ? '+' : ''}
                                  {candidate.feedback.confidenceAdjustment}
                                </p>
                                {candidate.feedback.lifecyclePolicy && (
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span
                                      className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${riskLifecyclePolicyTone(candidate.feedback.lifecyclePolicy)}`}
                                    >
                                      {riskLifecyclePolicyLabel(candidate.feedback.lifecyclePolicy)}
                                    </span>
                                    <span className="text-slate-600">
                                      策略建议：{candidate.feedback.lifecyclePolicyReason || '—'}
                                    </span>
                                  </div>
                                )}
                                {feedbackEvidenceReasons.length > 0 && (
                                  <p className="mt-2">历史依据：{summarizeTextList(feedbackEvidenceReasons, 2)}</p>
                                )}
                                {candidate.feedback.supportingAuditIds.length > 0 && (
                                  <p className="mt-1">支持审计：{summarizeIdList(candidate.feedback.supportingAuditIds)}</p>
                                )}
                              </div>
                            )}

                            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/75 px-3 py-3 text-xs leading-5 text-slate-600">
                              <p className="font-medium text-slate-900">规则预览</p>
                              <p className="mt-2">匹配 URL：{summarizeTextList(candidate.rule.match.urlIncludes || [], 3)}</p>
                              <p className="mt-1">能力标签：{summarizeTextList(candidate.rule.capabilitySlugs, 4)}</p>
                              <p className="mt-1">Prompt Notes：{summarizeTextList(candidate.rule.promptNotes, 2)}</p>
                              <p className="mt-1">首选原语：{summarizeTextList(candidate.rule.addPreferredPrimitives, 4)}</p>
                              {candidate.alreadyCovered && (
                                <p className="mt-2 text-amber-700">已被规则 {candidate.coveredByRuleIds.join('、')} 覆盖，可优先人工合并或忽略。</p>
                              )}
                              {!candidate.alreadyCovered && isIntentProjectKnowledgeDraftCandidateDeprioritized(candidate) && (
                                <p className="mt-2 text-rose-700">该候选已被历史效果评估自动降权，默认不会进入本次 merge；如仍要纳入，请手工勾选并先小范围验证。</p>
                              )}
                              {!candidate.alreadyCovered &&
                                !isIntentProjectKnowledgeDraftCandidateDeprioritized(candidate) &&
                                isIntentProjectKnowledgeDraftCandidateDeferredByDefault(candidate) && (
                                  <p className="mt-2 text-amber-700">
                                    该候选目前属于保守复核项，默认不会进入本次 merge；如仍要纳入，请手工勾选并复核对应的历史证据与最近 grader 结果。
                                  </p>
                                )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  {knowledgeDraftPreview.skipped.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-xs leading-6 text-slate-600">
                      <p className="font-medium text-slate-900">跳过项</p>
                      <p className="mt-2">当前有 {knowledgeDraftPreview.skipped.length} 项未进入候选，常见原因是阈值不足或超过 `maxCandidates`。</p>
                      <p className="mt-1">示例：{summarizeTextList(knowledgeDraftPreview.skipped.map((item) => `${item.category}（${item.reason}）`), 2)}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">
                  还没有生成草稿预览。这里的目标是把历史 repair 经验转成未来生成时就能提前使用的项目规则。
                </div>
              )}
              </section>
              , governancePortalHost)}
          </form>

          <aside className={embedded ? 'space-y-4' : 'intent-e2e-scroll space-y-4 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:pl-1'}>
            <section className="intent-e2e-command-deck overflow-hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(245,249,255,0.97))] shadow-[0_18px_42px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              <div className="border-b border-slate-200 bg-[linear-gradient(180deg,rgba(250,252,255,0.92),rgba(244,248,253,0.96))] px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">执行与反馈中心</p>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-500">
                    {activeRailTab.countLabel}
                  </span>
                </div>

                <div className="mt-2 overflow-x-auto pb-1">
                  <div className="inline-flex min-w-max items-center gap-1 rounded-[14px] border border-slate-200 bg-slate-100/90 p-0.5">
                    {railTabs.map((item) => {
                      const active = item.key === activeRailTab.key;

                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            setRailView(item.key);
                            if (item.key === 'compile') {
                              setDetailView('compile');
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[12px] font-medium transition ${
                            active
                              ? 'bg-white text-slate-950 shadow-[0_6px_18px_rgba(15,23,42,0.05)]'
                              : 'text-slate-500 hover:bg-white hover:text-slate-900'
                          }`}
                        >
                          <span>{item.label}</span>
                          {active && (
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                              {item.countLabel}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-5">
                {railView === 'overview' && (
                  <>
                    <p className="text-sm font-medium text-slate-900">执行状态</p>

              {running ? (
                <div className={`mt-4 rounded-2xl border px-4 py-4 ${canceling ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full border-2 ${canceling ? 'border-amber-500 border-dashed' : 'animate-spin border-sky-500 border-t-transparent'}`} />
                    <div>
                      <p className="text-sm font-medium">{canceling ? '正在停止当前自动测试' : 'AI 正在自动推进整条链路'}</p>
                      <p className={`mt-1 text-xs ${canceling ? 'text-amber-700' : 'text-sky-700'}`}>{currentStageText}</p>
                      <p className={`mt-2 text-xs ${canceling ? 'text-amber-700' : 'text-sky-700'}`}>
                        场景卡 {displayScenarioCard ? '已生成' : '待生成'} · 当前已有 {displayAttempts.length} 次尝试记录
                      </p>
                    </div>
                  </div>
                </div>
              ) : showCanceledState ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">测试已停止</p>
                      <p className="mt-1 text-xs opacity-80">已保留当前流式上下文和 {displayAttempts.length} 次尝试记录，方便继续诊断。</p>
                    </div>
                    <span className="rounded-full border px-3 py-1 text-xs font-medium">已停止</span>
                  </div>
                </div>
              ) : displayFinalResult ? (
                <div className="mt-4 space-y-4">
                  <div className={`rounded-2xl border px-4 py-4 ${statusPillTone(displayFinalResult.success)}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {displayTerminalStatus === 'canceled' ? '测试已取消' : displayFinalResult.success ? '测试通过' : '测试失败'}
                        </p>
                        <p className="mt-1 text-xs opacity-80">
                          共执行 {displayAttempts.length} 次尝试 · 最终耗时 {formatDuration(displayFinalResult.duration)}
                        </p>
                        <p className="mt-2 text-[11px] opacity-80">
                          {intentPlatformTestTypeLabel(result?.testType)} · {intentPlatformRunnerTypeLabel(result?.runnerType)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {displayQualitySplit && (
                          <span
                            className={`rounded-full border px-3 py-1 text-[11px] font-medium ${intentQualitySplitTone(
                              displayQualitySplit
                            )}`}
                          >
                            {intentQualitySplitLabel(displayQualitySplit)}
                          </span>
                        )}
                        <span className="rounded-full border px-3 py-1 text-xs font-medium">
                          {displayTerminalStatus === 'canceled' ? '已取消' : displayFinalResult.success ? '通过' : '失败'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!displayFinalResult.success && displayFinalFailureTriage && (
                    <div className={`rounded-2xl border px-4 py-4 text-sm ${intentFailureTone(displayFinalFailureTriage)}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border px-3 py-1 text-[11px] font-medium">
                          {intentFailureClassLabel(displayFinalFailureTriage.failureClass)}
                        </span>
                        <span className="rounded-full border px-3 py-1 text-[11px] font-medium">
                          {displayFinalFailureTriage.repairable ? '仍可修复' : '停止自愈'}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-6">{displayFinalFailureTriage.summary}</p>
                      {displayFinalFailureTriage.matchedSignals.length > 0 && (
                        <p className="mt-2 text-xs leading-6 opacity-80">命中特征：{displayFinalFailureTriage.matchedSignals.join('、')}</p>
                      )}
                    </div>
                  )}

                  {!displayFinalResult.success && displayFailureDiagnosis && (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">结构化失败诊断</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            不再只给一句失败总结，直接把失败步骤、定位锚点和建议动作展开给你。
                          </p>
                        </div>
                        {displayFailureDiagnosis.repeatedCount > 1 && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                            连续命中 {displayFailureDiagnosis.repeatedCount} 次
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">failed step</p>
                          <p className="mt-2 text-sm font-medium text-slate-900">{displayFailureDiagnosis.failedStepTitle || '—'}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">target anchor</p>
                          <p className="mt-2 text-sm font-medium text-slate-900">{displayFailureDiagnosis.targetAnchor || '—'}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">failed locator</p>
                          <p className="mt-2 break-all font-mono text-[11px] leading-5 text-slate-700">
                            {displayFailureDiagnosis.failedLocator || '—'}
                          </p>
                        </div>
                        {displayFailureDiagnosis.candidateAnchors.length > 0 && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">candidate anchors</p>
                            <p className="mt-2 text-xs leading-6 text-slate-700">
                              {displayFailureDiagnosis.candidateAnchors.join(' / ')}
                            </p>
                          </div>
                        )}
                        {displayFailureDiagnosis.nextActions.length > 0 && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">next actions</p>
                            <div className="mt-2 space-y-2 text-xs leading-6 text-slate-700">
                              {displayFailureDiagnosis.nextActions.map((action, index) => (
                                <p key={`${index + 1}-${action}`}>{index + 1}. {action}</p>
                              ))}
                            </div>
                            {(displayFailureDiagnosis.pageUrl || displayFailureDiagnosis.frameHints.length > 0) && (
                              <div className="mt-3 space-y-1 text-[11px] leading-5 text-slate-500">
                                {displayFailureDiagnosis.pageUrl ? <p className="break-all">页面：{displayFailureDiagnosis.pageUrl}</p> : null}
                                {displayFailureDiagnosis.frameHints.length > 0 ? (
                                  <p>frame hints：{displayFailureDiagnosis.frameHints.join(' / ')}</p>
                                ) : null}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!displayFinalResult.success && (displayRepairBudget || displayFailureCta) && (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">下一步动作</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            失败结果不再只停留在总结文案，这里直接给出下一步入口。
                          </p>
                        </div>
                        {displayRepairBudget && (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                            {intentRepairBudgetReasonLabel(displayRepairBudget.reasonCode)}
                          </span>
                        )}
                      </div>

                      {displayRepairBudget && (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                            <span>repair budget</span>
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium tracking-normal text-slate-600">
                              已用 {displayRepairBudget.usedRepairAttempts}/{displayRepairBudget.maxRepairAttempts}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium tracking-normal text-slate-600">
                              {displayRepairBudget.exhausted ? '已止损' : `剩余 ${displayRepairBudget.remainingRepairAttempts}`}
                            </span>
                          </div>
                          <p className="mt-3 text-xs leading-6 text-slate-600">{displayRepairBudget.summary}</p>
                        </div>
                      )}

                      {displayFailureCta && (
                        <>
                          <div className="mt-4">
                            <p className="text-sm font-medium text-slate-900">{displayFailureCta.headline}</p>
                            <p className="mt-1 text-xs leading-6 text-slate-500">{displayFailureCta.summary}</p>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {displayFailureCta.actions.map((action) => {
                              const previewAction = action.action === 'preview_knowledge_draft';
                              const handoffAction = action.action === 'handoff_manual';
                              const enabled =
                                action.enabled &&
                                (!previewAction || Boolean(workspaceProjectUid)) &&
                                !(previewAction && knowledgeDraftBusy) &&
                                !(handoffAction && workspaceSaving);
                              const buttonLabel =
                                previewAction && knowledgeDraftLoading
                                  ? '预览中…'
                                  : handoffAction && workspaceSaving
                                    ? '导入中…'
                                    : action.label;

                              return (
                                <div key={action.action} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-slate-900">{action.label}</p>
                                    {action.recommended && (
                                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700">
                                        建议优先
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-2 text-xs leading-6 text-slate-500">{action.description}</p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void handleFailureCtaAction(action.action);
                                    }}
                                    disabled={!enabled}
                                    className="mt-3 inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {buttonLabel}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {finalStats && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">通过步骤</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{finalStats.passed}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">失败步骤</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{finalStats.failed}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">跳过步骤</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{finalStats.skipped}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : hasBlockedLaunchDecision ? (
                renderBlockedLaunchDecisionCard()
              ) : (
                <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                  还没有执行结果。填写任务输入后点击“开始自动测试”。
                </div>
              )}

              {displayLlmMeta && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">最终使用模型</p>
                  <p className="mt-2 break-all text-xs leading-6 text-slate-600">
                    {displayLlmMeta.provider} / {displayLlmMeta.model} · vision {displayLlmMeta.visionEnabled ? 'on' : 'off'} · 输入图片 {displayLlmMeta.attachmentCount} 张
                  </p>
                </div>
              )}

              {displayAssetReadiness && displayAssetReadiness.projectUid && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">项目冷启动资产</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">把 onboarding、项目知识和 repair memory 的 readiness 单独拎出来，避免继续混进纯模型失败。</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${intentAssetReadinessTone(displayAssetReadiness.status)}`}>
                      {intentAssetReadinessLabel(displayAssetReadiness.status)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">readiness</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        onboarding {displayAssetReadiness.onboardingReady ? 'ready' : displayAssetReadiness.hasOnboarding ? 'incomplete' : 'missing'} ·
                        knowledge {displayAssetReadiness.hasKnowledgeAsset ? 'ready' : 'missing'} ·
                        repair {displayAssetReadiness.hasRepairMemoryAsset ? 'ready' : 'missing'}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        命中规则 {displayAssetReadiness.knowledgeMatchCount} 条 · {summarizeIntentAssetReadinessReasons(displayAssetReadiness, 3)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">project scope</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{displayAssetReadiness.projectUid}</p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        onboarding：{displayAssetReadiness.onboardingPath || '—'}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">knowledge：{displayAssetReadiness.knowledgePath || '—'}</p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">repair memory：{displayAssetReadiness.repairMemoryPath || '—'}</p>
                    </div>
                  </div>
                </div>
              )}

              {displayKnowledge && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">知识命中与 Helper 使用</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">这块用来回答“这次为什么更容易成功”，避免继续靠猜。</p>
                    </div>
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                      {displayKnowledge.matchCount > 0 ? `命中 ${displayKnowledge.matchCount} 条规则` : '未命中规则'}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">命中规则</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{summarizeTextList(displayKnowledge.matchedRuleTitles, 3)}</p>
                      {displayKnowledge.matchedRuleIds.length > 0 && (
                        <p className="mt-2 text-[11px] leading-5 text-slate-500">{summarizeTextList(displayKnowledge.matchedRuleIds, 3)}</p>
                      )}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">helper 覆盖</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">推荐 {displayKnowledge.suggestedHelpers.length} 个 · 实际使用 {displayUsedHelpers.length} 个</p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        命中推荐 helper：{summarizeTextList(displayUsedSuggestedHelpers, 4)}
                      </p>
                    </div>
                  </div>

                    <div className="mt-2.5 space-y-1.5 text-[11px] leading-5 text-slate-500">
                      <p className="break-all">
                        规则文件：<span className="font-mono">{displayKnowledge.profilePath}</span>
                      </p>
                      <p>能力标签：{summarizeTextList(displayKnowledge.capabilitySlugs, 4)}</p>
                      <p>Starter 资产：{summarizeTextList((displayKnowledge.starterAssets || []).map((item) => item.assetTitle), 3)}</p>
                      <p>推荐 helper：{summarizeTextList(displayKnowledge.suggestedHelpers, 4)}</p>
                      <p>本次实际 helper：{summarizeTextList(displayUsedHelpers, 4)}</p>
                      {finalAttempt?.helperUsage && (
                        <p>最终尝试 helper：{summarizeTextList(finalAttempt.helperUsage.usedHelpers, 4)}</p>
                      )}
                  </div>
                </div>
              )}

              {displayExperience && (displayExperience.scannedRunCount > 0 || displayExperience.hints.length > 0) && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">相似运行经验</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">只回放结构化经验摘要，不直接把历史脚本全文塞回这次生成链路。</p>
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
                      命中 {displayExperience.hints.length} 条
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">检索范围</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        扫描 {displayExperience.scannedRunCount} 条 · 命中 {displayExperience.matchedRunCount} 条
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">source：{displayExperience.source}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">经验覆盖</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        success {displayExperience.hints.filter((hint) => hint.kind === 'successful_run').length} · failure{' '}
                        {displayExperience.hints.filter((hint) => hint.kind === 'failed_run').length}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        命中 family：{summarizeTextList(displayExperience.hints.map((hint) => hint.scenarioFamily), 3)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {displayExperience.hints.slice(0, 3).map((hint) => (
                      <div key={hint.hintId} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900">{hint.requestSummary || hint.scenarioTitle || hint.runId}</p>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${
                              hint.kind === 'successful_run'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700'
                            }`}
                          >
                            {hint.kind === 'successful_run'
                              ? hint.outcome === 'first_pass'
                                ? '首轮通过'
                                : '修复后通过'
                              : '失败避坑'}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] leading-5 text-slate-500">
                          score {hint.matchScore} · 命中 {summarizeTextList(hint.matchedSignals, 4)} · 路径 {hint.targetPath || '—'}
                        </p>
                        <div className="mt-2 space-y-1 text-[11px] leading-5 text-slate-500">
                          <p>recipes：{summarizeTextList(hint.matchedRecipeSlugs, 3)}</p>
                          <p>helpers：{summarizeTextList(hint.chosenHelpers, 4)}</p>
                          <p>stable：{summarizeTextList(hint.stableEntityHints, 3)}</p>
                          {hint.verifierStrategySummary ? <p>verifier：{hint.verifierStrategySummary}</p> : null}
                          {hint.pitfalls.length > 0 ? <p>pitfalls：{summarizeTextList(hint.pitfalls, 2)}</p> : null}
                          {hint.playbookSlugs.length > 0 ? <p>playbook：{summarizeTextList(hint.playbookSlugs, 2)}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {displayReview && (displayReview.summary || displayReview.playbookCandidates.length > 0 || displayReview.nextStepAdvice) && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">运行复盘</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">把这次 run 的经验、下一步建议和可沉淀 playbook 候选收口到同一处。</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                      {displayReview.reviewedAt ? '已复盘' : '待复盘'}
                    </span>
                  </div>

                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">summary</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{displayReview.summary || '—'}</p>
                    {displayReview.reviewedAt ? (
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">reviewedAt：{displayReview.reviewedAt}</p>
                    ) : null}
                  </div>

                  {displayReview.nextStepAdvice && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{displayReview.nextStepAdvice.headline}</p>
                          <p className="mt-1 text-xs leading-6 text-slate-500">{displayReview.nextStepAdvice.summary}</p>
                        </div>
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                          下一步 {displayReview.nextStepAdvice.actions.length} 项
                        </span>
                      </div>
                      {displayReview.nextStepAdvice.actions.length > 0 && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {displayReview.nextStepAdvice.actions.map((action) => (
                            <div key={`${action.action}-${action.label}`} className="rounded-2xl border border-white/80 bg-white px-4 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-slate-900">{action.label}</p>
                                {action.recommended && (
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700">
                                    建议优先
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 text-xs leading-6 text-slate-500">{action.description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {displayReview.playbookCandidates.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-medium text-slate-900">Playbook Candidates</p>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
                            {displayReview.playbookCandidates.length} 条
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={promotePlaybookCandidates}
                          disabled={!playbookPromotionProjectUid || playbookPromotionSaving}
                          className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium transition ${
                            !playbookPromotionProjectUid || playbookPromotionSaving
                              ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                              : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900'
                          }`}
                        >
                          {playbookPromotionSaving ? '沉淀中…' : '沉淀到项目 Recipe'}
                        </button>
                      </div>
                      <div className="mt-2 space-y-1 text-[11px] leading-5 text-slate-500">
                        {playbookPromotionProjectUid ? (
                          <p>目标项目：{playbookPromotionProjectUid}</p>
                        ) : (
                          <p>当前没有项目上下文，暂时无法把 playbook candidate 沉淀到项目 recipe。</p>
                        )}
                        {playbookPromotionNotice ? <p className="text-emerald-700">{playbookPromotionNotice}</p> : null}
                        {playbookPromotionError ? <p className="text-rose-600">{playbookPromotionError}</p> : null}
                      </div>
                      <div className="mt-3 space-y-3">
                        {displayReview.playbookCandidates.slice(0, 3).map((candidate) => (
                          <div key={candidate.candidateId} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-900">{candidate.title || candidate.slug}</p>
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700">
                                {candidate.successRate}% · {candidate.promotionStatus}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1 text-[11px] leading-5 text-slate-500">
                              <p>slug：{candidate.slug}</p>
                              <p>target：{candidate.targetPath || '—'} · family：{candidate.scenarioFamily || 'generic'}</p>
                              <p>recipes：{summarizeTextList(candidate.matchedRecipeSlugs, 3)}</p>
                              <p>helpers：{summarizeTextList(candidate.preferredHelpers, 4)}</p>
                              <p>stepTypes：{summarizeTextList(candidate.stepTypes, 4)}</p>
                              <p>pitfalls：{summarizeTextList(candidate.knownPitfalls, 2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeRunId && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">服务端 Run ID</p>
                  <p className="mt-2 break-all font-mono text-xs leading-6 text-slate-600">{activeRunId}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {running ? '刷新页面后会自动尝试恢复当前运行。' : '本次运行记录已保留，可继续查看最终结果与中间过程。'}
                  </p>
                </div>
              )}

                  </>
                )}

                {railView === 'context' && (
                  <div ref={setContextPortalHost} className="space-y-4" />
                )}

                {railView === 'workbench' && !embedded && (
                  renderIntentWorkbenchEditor({
                    subtitle: '把目标描述、入口 URL 和参考图一次写清，再直接启动自动测试。',
                    showCollapseControl: !showCollapsedWorkbenchRail,
                    submitOutsideForm: true,
                  })
                )}

                {railView === 'governance' && !embedded && (
                  <div ref={setGovernancePortalHost} className="space-y-4" />
                )}

                {railView === 'compile' && (
                  <div className="space-y-4">
                    <div className="intent-e2e-detail-launcher rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,251,255,0.95),rgba(242,247,253,0.96))] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold tracking-[-0.02em] text-slate-950">编译详情</p>
                          <p className="mt-1 text-[14px] leading-6 text-slate-600">{activeDetailPreview}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setExecutionDetailsModalOpen(true)}
                            className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 text-xs text-slate-700 transition hover:bg-slate-50"
                          >
                            全屏查看
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 overflow-x-auto">
                        <div className="flex min-w-max gap-2">
                          {detailTabs.map((item) => {
                            const active = item.key === activeDetailTab.key;

                            return (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => setDetailView(item.key)}
                                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium transition ${
                                  active
                                    ? 'border-slate-200 bg-white text-slate-950 shadow-[0_6px_18px_rgba(15,23,42,0.05)]'
                                    : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-900'
                                }`}
                              >
                                <span>{item.label}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? 'bg-slate-100 text-slate-500' : 'bg-slate-100/80 text-slate-400'}`}>
                                  {item.countLabel}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {renderExecutionDetailsBody()}
                  </div>
                )}

                {railView === 'workspace' && (
                  displayFinalResult && activeRunId ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">保存到项目工作台</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        把这次意图运行沉淀成任务、脚本版本和执行历史；即使失败，也能保留上下文继续修复。
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${statusPillTone(displayFinalResult.success)}`}>
                      {displayFinalResult.success ? '通过' : '失败'}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {workspaceLoadError && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs leading-5 text-rose-700">
                        {workspaceLoadError}
                      </div>
                    )}

                    {workspaceSaveError && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs leading-5 text-rose-700">
                        {workspaceSaveError}
                      </div>
                    )}

                    {workspaceSaveResult && (
                      <div
                        className={`rounded-2xl border px-3 py-3 text-xs leading-5 ${
                          workspaceSaveResult.importedStatus === 'passed'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-800'
                        }`}
                      >
                        <p className="font-medium">
                          {workspaceSaveResult.createdConfig ? '已创建新任务并同步执行历史' : '已追加为现有任务的新脚本版本'}
                        </p>
                        <p className="mt-1">
                          任务「{workspaceSaveResult.configName}」· 脚本 v{workspaceSaveResult.planVersion} · 执行结果
                          {workspaceSaveResult.importedStatus === 'passed' ? '通过' : '失败'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link
                            href={workspaceSaveNavigation?.workspacePath || workspaceSaveResult.workspacePath}
                            className="inline-flex h-8 items-center justify-center rounded-xl border border-current/20 bg-white/70 px-3 text-xs font-medium transition hover:bg-white"
                          >
                            打开聚焦任务
                          </Link>
                          {workspaceSaveNavigation?.hasWorkspaceHistoryPath && (
                            <Link
                              href={workspaceSaveNavigation.workspaceHistoryPath || workspaceSaveNavigation.workspacePath}
                              className="inline-flex h-8 items-center justify-center rounded-xl border border-current/20 bg-white/70 px-3 text-xs font-medium transition hover:bg-white"
                            >
                              工作台执行历史
                            </Link>
                          )}
                          <Link
                            href={workspaceSaveNavigation?.runPath || workspaceSaveResult.runPath}
                            className="inline-flex h-8 items-center justify-center rounded-xl border border-current/20 bg-white/70 px-3 text-xs font-medium transition hover:bg-white"
                          >
                            执行详情
                          </Link>
                        </div>
                      </div>
                    )}

                    {workspaceProjects.length === 0 ? (
                      workspaceLoadingProjects ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-xs text-slate-500">
                          正在加载项目列表…
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-xs leading-5 text-slate-500">
                          还没有可用项目；你可以先去
                          <Link href="/" className="mx-1 text-slate-900 underline underline-offset-4">项目中心</Link>
                          创建项目和模块。
                        </div>
                      )
                    ) : (
                      <>
                        <label className="block">
                          <span className="text-xs font-medium text-slate-600">目标项目</span>
                          <select
                            value={workspaceProjectUid}
                            onChange={(event) => {
                              setWorkspaceProjectUid(event.target.value);
                              setWorkspaceSaveError('');
                              setWorkspaceSaveResult(null);
                            }}
                            disabled={workspaceBusy}
                            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
                          >
                            {workspaceProjects.map((item) => (
                              <option key={item.projectUid} value={item.projectUid}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-xs font-medium text-slate-600">目标模块</span>
                          <select
                            value={workspaceModuleUid}
                            onChange={(event) => {
                              setWorkspaceModuleUid(event.target.value);
                              setWorkspaceSaveError('');
                              setWorkspaceSaveResult(null);
                            }}
                            disabled={workspaceBusy || !workspaceProjectUid}
                            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
                          >
                            {workspaceModules.length === 0 ? (
                              <option value="">{workspaceLoadingModules ? '正在加载模块…' : '当前项目暂无模块'}</option>
                            ) : (
                              workspaceModules.map((item) => (
                                <option key={item.moduleUid} value={item.moduleUid}>
                                  {item.name}
                                </option>
                              ))
                            )}
                          </select>
                        </label>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setWorkspaceSaveMode('new');
                              setWorkspaceSaveError('');
                              setWorkspaceSaveResult(null);
                            }}
                            className={`inline-flex h-10 items-center justify-center rounded-2xl border px-3 text-xs font-medium transition ${
                              workspaceSaveMode === 'new'
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            保存为新任务
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setWorkspaceSaveMode('existing');
                              setWorkspaceSaveError('');
                              setWorkspaceSaveResult(null);
                            }}
                            className={`inline-flex h-10 items-center justify-center rounded-2xl border px-3 text-xs font-medium transition ${
                              workspaceSaveMode === 'existing'
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            追加到已有任务
                          </button>
                        </div>

                        {workspaceSaveMode === 'new' ? (
                          <label className="block">
                            <span className="text-xs font-medium text-slate-600">任务名称</span>
                            <input
                              value={workspaceTaskName}
                              onChange={(event) => {
                                setWorkspaceTaskName(event.target.value);
                                setWorkspaceSaveError('');
                                setWorkspaceSaveResult(null);
                              }}
                              placeholder="例如：创建商机并校验列表结果"
                              disabled={workspaceBusy}
                              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
                            />
                          </label>
                        ) : workspaceTasks.length > 0 ? (
                          <>
                            <label className="block">
                              <span className="text-xs font-medium text-slate-600">已有任务</span>
                              <select
                                value={workspaceConfigUid}
                                onChange={(event) => {
                                  setWorkspaceConfigUid(event.target.value);
                                  setWorkspaceSaveError('');
                                  setWorkspaceSaveResult(null);
                                }}
                                disabled={workspaceBusy}
                                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
                              >
                                {workspaceTasks.map((item) => (
                                  <option key={item.configUid} value={item.configUid}>
                                    {item.name} · v{item.latestPlanVersion || 0}
                                  </option>
                                ))}
                              </select>
                            </label>

                            {workspaceSelectedTask && (
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600">
                                当前任务：{workspaceSelectedTask.name} · {workspaceSelectedTask.taskMode === 'scenario' ? '业务流' : '单页面'} · 最新脚本 v{workspaceSelectedTask.latestPlanVersion || 0}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-xs leading-5 text-slate-500">
                            当前模块下还没有任务；建议先用“保存为新任务”创建一条，再继续沉淀后续版本。
                          </div>
                        )}

                        {displayFinalResult.success && starterCapabilityLaunches.length > 0 && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-medium text-slate-900">Starter 资产沉淀</p>
                                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                                  当前已按 trace / 长期 evidence / 治理恢复状态做一层 promotion 判定。默认只自动勾选可直接沉淀的项目级 Starter 资产，其余保留人工复核。
                                </p>
                                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                                  其中“全局 runtime heuristic”已内置到执行环境；只有“项目级 capability”会参与一键沉淀。
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-medium text-sky-700">
                                  {starterCapabilityLaunches.length} 个命中
                                </span>
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700">
                                  可沉淀 {promotableStarterCapabilityLaunches.length} 个
                                </span>
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700">
                                  默认勾选 {starterCapabilityPromotionSummary.autoSelectedCount} 个
                                </span>
                                <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-medium text-sky-700">
                                  待复核 {starterCapabilityPromotionSummary.reviewCount} 个
                                </span>
                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] text-slate-500">
                                  已选 {selectedStarterCapabilityLaunches.length} 个
                                </span>
                              </div>
                            </div>

                            {starterCapabilitySaveError && (
                              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] leading-5 text-rose-700">
                                {starterCapabilitySaveError}
                              </div>
                            )}

                            {starterCapabilitySaveNotice && (
                              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] leading-5 text-emerald-700">
                                {starterCapabilitySaveNotice}
                              </div>
                            )}

                            {!workspaceProjectUid && (
                              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
                                先选择目标项目，才能批量保存或把 starter asset 打开为能力草稿。
                              </div>
                            )}

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setAllStarterCapabilitiesSelected(true)}
                                disabled={starterCapabilitySaving || promotableStarterCapabilityLaunches.length === 0}
                                className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                全选
                              </button>
                              <button
                                type="button"
                                onClick={() => setAllStarterCapabilitiesSelected(false)}
                                disabled={starterCapabilitySaving}
                                className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                清空
                              </button>
                              <button
                                type="button"
                                onClick={() => void persistStarterCapabilitiesToProject()}
                                disabled={!workspaceProjectUid || selectedStarterCapabilityLaunches.length === 0 || starterCapabilitySaving}
                                className="inline-flex h-8 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {starterCapabilitySaving
                                  ? '保存中…'
                                  : `一键保存 ${selectedStarterCapabilityLaunches.length || 0} 条能力`}
                              </button>
                            </div>

                            <div className="mt-3 space-y-2">
                              {starterCapabilityLaunches.map((launch) => {
                                return (
                                  <div key={launch.asset.assetSlug} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <label className="flex items-start gap-3">
                                        <input
                                          type="checkbox"
                                          checked={starterCapabilitySelectedAssetSlugSet.has(launch.asset.assetSlug)}
                                          onChange={() => toggleStarterCapabilitySelection(launch.asset.assetSlug)}
                                          disabled={starterCapabilitySaving || !launch.promotable}
                                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 disabled:cursor-not-allowed"
                                        />
                                        <div>
                                          <p className="font-medium text-slate-900">{launch.asset.assetTitle}</p>
                                          <p className="mt-1 font-mono text-[11px] text-slate-500">{launch.asset.helper}</p>
                                        </div>
                                      </label>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${starterAssetScopeTone(launch.asset.scope)}`}>
                                          {intentStarterAssetScopeLabel(launch.asset.scope)}
                                        </span>
                                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${starterHelperSourceTone(launch.asset.source)}`}>
                                          {starterHelperSourceLabel(launch.asset.source)}
                                        </span>
                                        <span
                                          className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${starterAssetPromotionDecisionTone(
                                            launch.promotionDecision.status
                                          )}`}
                                        >
                                          {launch.promotionDecision.statusLabel}
                                        </span>
                                        {launch.asset.knowledgeChangeSignal ? (
                                          <span
                                            className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${starterHelperKnowledgeSignalTone(launch.asset.knowledgeChangeSignal)}`}
                                          >
                                            {starterHelperKnowledgeSignalLabel(launch.asset.knowledgeChangeSignal)}
                                          </span>
                                        ) : launch.asset.knowledgeChangeTier ? (
                                          <span
                                            className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${starterHelperKnowledgeTierTone(
                                              launch.asset.knowledgeChangeTier,
                                              launch.asset.knowledgeChangeWatchingKind
                                            )}`}
                                          >
                                            {starterHelperKnowledgeTierLabel(
                                              launch.asset.knowledgeChangeTier,
                                              launch.asset.knowledgeChangeWatchingKind
                                            )}
                                          </span>
                                        ) : null}
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] text-slate-500">
                                          通过率 {formatRatePercent(launch.asset.passRate)}
                                        </span>
                                      </div>
                                    </div>

                                    <p className="mt-2 leading-5 text-slate-600">{launch.asset.matchSummary}</p>
                                    {!launch.promotable && (
                                      <p className="mt-2 leading-5 text-slate-500">
                                        这条能力更适合作为跨系统复用的全局 runtime heuristic，默认不参与项目能力库沉淀，也不再单独打开项目草稿精修。
                                      </p>
                                    )}
                                    <p className="mt-2 leading-5 text-slate-500">
                                      Promotion 判定：{launch.promotionDecision.reason}
                                    </p>
                                    <p className="mt-2 leading-5 text-slate-500">
                                      支持规则：{summarizeTextList(launch.asset.supportingRuleTitles, 3)}
                                    </p>
                                    <p className="mt-1 leading-5 text-slate-500">
                                      复用 {launch.asset.runCount} 次 · 建议命中 {launch.asset.suggestedReuseRuns} 次 · 覆盖步骤 {launch.asset.matchedStepUids.length} 个
                                    </p>
                                    {launch.asset.knowledgeChangeSignalReason && (
                                      <p className="mt-1 leading-5 text-slate-500">
                                        {launch.asset.knowledgeChangeTier === 'watching' && !launch.asset.knowledgeChangeSignal ? '观察依据：' : '长期依据：'}
                                        {launch.asset.knowledgeChangeSignalReason}
                                        {launch.asset.knowledgeChangeDecisionableRuleCount
                                          ? `（${launch.asset.knowledgeChangeDecisionableRuleCount} 条已判定规则）`
                                          : ''}
                                      </p>
                                    )}

                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {launch.href ? (
                                        <Link
                                          href={launch.href}
                                          onClick={() => {
                                            stashIntentCapabilityPreset(launch.token, launch.preset);
                                          }}
                                          className="inline-flex h-8 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-[11px] font-medium text-blue-700 transition hover:bg-blue-100"
                                        >
                                          打开草稿精修
                                        </Link>
                                      ) : launch.promotable ? (
                                        <span className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-3 text-[11px] text-slate-500">
                                          选择项目后可预填能力草稿
                                        </span>
                                      ) : (
                                        <span className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-3 text-[11px] text-slate-500">
                                          全局 heuristic 已内置，无需草稿精修
                                        </span>
                                      )}
                                      <span className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] text-slate-500">
                                        slug {launch.preset.slug}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => void persistRunToWorkspace()}
                          disabled={!workspaceSelectionReady || workspaceBusy}
                          className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                          {workspaceSaving
                            ? '保存中…'
                            : workspaceSaveMode === 'new'
                              ? '保存到项目工作台'
                              : '追加为新脚本版本'}
                        </button>
                      </>
                    )}
                  </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                      当前还没有可沉淀的最终结果。等一次运行进入终态后，这里会显示工作台保存和 Starter 资产处理入口。
                    </div>
                  )
                )}

                {railView === 'live' && (
                  <div className="space-y-4">
                    <div className="intent-e2e-browser-stage overflow-hidden rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)] xl:flex xl:min-h-0 xl:flex-col">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-medium ${railStatusBadge.className}`}>
                            {railStatusBadge.label}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
                            {liveAttemptValue}
                          </span>
                          {browserSessionId && (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-500">
                              {browserSessionId}
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] leading-6 text-slate-500">
                          {browserSessionId ? (running ? '执行中会持续刷新浏览器画面。' : '已保留最近一次浏览器画面。') : '执行开始后自动连接浏览器会话。'}
                        </p>
                      </div>

                      <div className="mt-4 xl:min-h-0 xl:flex-1">
                        {browserSessionId ? (
                          <BrowserView
                            sessionId={browserSessionId}
                            isActive={running}
                            hideHeader
                            compact
                            className="rounded-[28px] border border-slate-300 bg-slate-100/90 p-3.5 shadow-[0_16px_40px_rgba(15,23,42,0.10)]"
                            viewportClassName="aspect-video min-h-[260px] rounded-[22px] md:min-h-[320px] xl:min-h-[360px]"
                          />
                        ) : (
                          <div className="overflow-hidden rounded-[28px] border border-slate-300 bg-slate-100/90 p-3.5 shadow-[0_16px_40px_rgba(15,23,42,0.10)]">
                            <div className="relative aspect-video min-h-[260px] overflow-hidden rounded-[22px] border border-slate-300 bg-slate-900 md:min-h-[320px] xl:min-h-[360px]">
                              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-slate-950/60 to-transparent px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                                  <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
                                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                                </div>
                                <span className="text-[11px] font-medium tracking-[0.12em] text-slate-400">实时预览待命</span>
                              </div>
                              <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.16),transparent_46%),linear-gradient(180deg,#0f172a,#111827_58%,#0f172a)] px-6 pt-10 text-center">
                                <div className="max-w-[320px]">
                                  <p className="text-sm font-medium text-slate-100">等待浏览器会话</p>
                                  <p className="mt-3 text-[14px] leading-6 text-slate-400">
                                    开始生成并执行脚本后，这里会切到真实运行画面，并持续保留最后一帧。
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </section>

        {executionDetailsModalOpen && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(15,23,42,0.20)] px-4 py-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="编译结果"
            onClick={() => setExecutionDetailsModalOpen(false)}
          >
            <div
              className="intent-e2e-modal-surface flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/92 px-5 py-4 backdrop-blur">
                <div>
                  <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-slate-400">编译结果</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">{activeDetailTab.label}</p>
                  <p className="mt-1 text-[14px] leading-6 text-slate-600">{activeDetailTab.description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                    {activeDetailTab.countLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExecutionDetailsModalOpen(false)}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 text-sm text-slate-600 transition hover:bg-slate-50"
                  >
                    关闭
                  </button>
                </div>
              </div>
              <div className="shrink-0 border-b border-slate-200 bg-white/92 px-5 py-3 backdrop-blur">
                <div className="flex flex-wrap gap-1.5 rounded-[16px] bg-slate-100/90 p-1">
                  {detailTabs.map((item) => {
                    const active = item.key === activeDetailTab.key;

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setDetailView(item.key)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-medium transition ${
                          active
                            ? 'border-slate-200 bg-white text-slate-950 shadow-[0_1px_4px_rgba(15,23,42,0.08)]'
                            : 'border-transparent bg-transparent text-slate-500 hover:bg-white/70 hover:text-slate-900'
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? 'bg-slate-100 text-slate-600' : 'bg-white text-slate-500'}`}>
                          {item.countLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-6 md:py-5">{renderExecutionDetailsBody()}</div>
            </div>
          </div>
        )}

        {attemptDetailAttempt && (
          <div
            className="fixed inset-0 z-[130] flex items-center justify-center bg-[rgba(15,23,42,0.20)] px-4 py-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="尝试记录详情"
            onClick={() => setAttemptDetailAttemptNumber(null)}
          >
            <div
              className="intent-e2e-modal-surface flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/92 px-5 py-4 backdrop-blur">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">尝试详情</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">
                    第 {attemptDetailAttempt.attempt} 次尝试详情
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAttemptDetailAttemptNumber(null)}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 text-sm text-slate-600 transition hover:bg-slate-50"
                >
                  关闭
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-6 md:py-5">
                {renderAttemptDetailBody(attemptDetailAttempt)}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
