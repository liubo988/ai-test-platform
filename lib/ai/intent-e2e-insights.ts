import {
  listIntentProjectKnowledgeAuditEntries,
  type IntentProjectKnowledgeAuditEntry,
  type IntentProjectKnowledgeAuditNotice,
  type IntentProjectKnowledgeAuditOperation,
  type IntentProjectKnowledgeMergedCandidateMeta,
  type IntentProjectKnowledgeRuleProbation,
} from '@/lib/intent-project-knowledge';
import {
  listIntentE2ERunSnapshots,
  listProjectCapabilities,
  listProjectActivityLogs,
  type IntentE2ERunSnapshotRecord,
  type ProjectActivityLogRecord,
  type ProjectCapabilityRecord,
} from '@/lib/db/repository';
import type { IntentRecipePerformanceFeedback } from '@/lib/intent-recipe-registry';
import {
  attachIntentStarterHelperVerificationFeedback,
  attachIntentSuppressedStarterHelperVerificationFeedback,
} from '@/lib/intent-starter-helper-verification-feedback';
import { extractIntentStarterAssetPromotionReceiptFromActivityMeta } from '@/lib/intent-starter-asset-promotion-receipt';
import {
  resolveIntentSuppressedStarterHelperGovernanceTargets,
  summarizeIntentStarterHelperGovernanceReviewTargets,
} from '@/lib/intent-starter-helper-health-governance';
import { summarizeIntentSuccessfulRunKnowledgePromotionReceiptItemsObservation } from '@/lib/intent-successful-run-knowledge-promotion-receipt';
import {
  hasIntentVerificationFailurePressureSummaryHighFailure,
  mergeIntentVerificationFailurePressureSummaryObservation,
  summarizeIntentVerificationFailurePressureSummaryFromItems,
  type IntentVerificationFailurePressureSummary,
} from '@/lib/intent-verification-failure-pressure-summary';
import { summarizeIntentExecutionRepairObservationArtifact } from '@/lib/intent-execution-artifacts';
import type { IntentE2EAssetReadiness, IntentE2EAssetReadinessStatus } from '@/lib/intent-e2e-asset-readiness';
import {
  isIntentE2EBlockedQualityBucket,
  normalizeIntentE2EQualitySplit,
  type IntentE2EBlockerKind,
  type IntentE2EQualityBucket,
  type IntentE2EQualitySplit,
} from '@/lib/intent-e2e-quality-split';
import {
  DEFAULT_INTENT_E2E_RUNNER_TYPE,
  DEFAULT_INTENT_E2E_TEST_TYPE,
  normalizePlatformRunnerType,
  normalizePlatformTestType,
  type PlatformRunnerType,
  type PlatformTestType,
} from '@/lib/test-platform-asset-model';
import {
  readIntentProjectRuntimeGovernanceStatus,
  type IntentProjectRuntimeGovernanceIssue,
  type IntentProjectRuntimeGovernanceStatus,
} from '@/lib/intent-project-runtime-governance';
import { classifyIntentE2EPriorityScenarioFamily } from '@/lib/intent-e2e-priority-scenario-family';
import type { IntentE2EPriorityScenarioFamily } from '@/lib/intent-e2e-priority-scenario-family';

export type { IntentE2EPriorityScenarioFamily } from '@/lib/intent-e2e-priority-scenario-family';

export interface IntentE2EInsightPassMetrics {
  firstPassPassedRuns: number;
  firstPassPassRate: number;
  repairedPassRuns: number;
  repairedPassRate: number;
  terminalPassRate: number;
}

export type IntentE2EScenarioFamily = 'page_task' | 'simple_scenario' | 'complex_enterprise_flow' | 'unknown';
export type IntentE2EInsightVerificationIntent = 'verify' | 'review' | 'unknown';

export interface IntentE2EInsightSummary extends IntentE2EInsightPassMetrics {
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
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
}

export interface IntentE2EInsightRuleStat {
  ruleId: string;
  title: string;
  runCount: number;
  passedRuns: number;
  passRate: number;
}

export interface IntentE2EInsightHelperStat {
  helper: string;
  runCount: number;
  passedRuns: number;
  passRate: number;
  suggestedReuseRuns: number;
}

export type IntentE2EInsightStarterHelperSource = 'promoted' | 'stable';
export type IntentE2EInsightStarterHelperKnowledgeChangeSignal = 'positive' | 'negative';
export type IntentE2EInsightStarterHelperKnowledgeChangeTier = 'preferred' | 'watching';
export type IntentE2EInsightStarterHelperWatchingKind = 'recovering' | 'mixed';
export type IntentE2EInsightRepairTriggerKind = 'auto' | 'manual';
export type IntentE2EInsightStarterHelperPreferredPromotionStatus =
  | 'await_more_positive_rules'
  | 'blocked_by_mixed_evidence'
  | 'await_long_term_recovery';
export type IntentE2EInsightSuppressedStarterHelperGovernanceRecommendationStatus =
  | 'await_governance_targets'
  | 'blocked_by_recent_failures'
  | 'await_direct_verify'
  | 'await_more_capability_recovery';

export interface IntentE2EInsightStarterHelper {
  helper: string;
  runCount: number;
  passedRuns: number;
  passRate: number;
  suggestedReuseRuns: number;
  source: IntentE2EInsightStarterHelperSource;
  supportingRuleIds: string[];
  supportingRuleTitles: string[];
  knowledgeChangeTier?: IntentE2EInsightStarterHelperKnowledgeChangeTier;
  knowledgeChangeWatchingKind?: IntentE2EInsightStarterHelperWatchingKind;
  knowledgeChangeSignal?: IntentE2EInsightStarterHelperKnowledgeChangeSignal;
  knowledgeChangeSignalReason?: string;
  knowledgeChangeDecisionableRuleCount?: number;
  knowledgeChangeSupportingAuditIds?: string[];
  preferredPromotionStatus?: IntentE2EInsightStarterHelperPreferredPromotionStatus;
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
  governanceReleaseManualRepairPassedCapabilityCount?: number;
  governanceReleaseAutoRepairPassedCapabilityCount?: number;
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
}

export interface IntentE2EInsightSuppressedStarterHelper {
  helper: string;
  runCount: number;
  passedRuns: number;
  passRate: number;
  suggestedReuseRuns: number;
  source: IntentE2EInsightStarterHelperSource;
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
  recentGovernanceAutoRepairExecutionCount?: number;
  recentPassedGovernanceAutoRepairExecutionCount?: number;
  recentFailedGovernanceAutoRepairExecutionCount?: number;
  latestGovernanceAutoRepairExecutionAt?: string;
  recentGovernanceManualRepairExecutionCount?: number;
  recentPassedGovernanceManualRepairExecutionCount?: number;
  recentFailedGovernanceManualRepairExecutionCount?: number;
  latestGovernanceManualRepairExecutionAt?: string;
  governanceCapabilities?: IntentE2EInsightSuppressedStarterHelperGovernanceCapability[];
  governanceRecommendationStatus?: IntentE2EInsightSuppressedStarterHelperGovernanceRecommendationStatus;
  governanceRecommendationReason?: string;
  governanceAutoUnlockCondition?: string;
  governanceRequiredPassedCapabilityCount?: number;
  governancePassedCapabilityCount?: number;
  governanceDirectVerifyPassedCapabilityCount?: number;
  governanceManualRepairPassedCapabilityCount?: number;
  governanceAutoRepairPassedCapabilityCount?: number;
  suppressionReason: string;
}

export interface IntentE2EInsightSuppressedStarterHelperGovernanceSummary {
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
  recentAutoRepairExecutionCount: number;
  recentPassedAutoRepairExecutionCount: number;
  recentFailedAutoRepairExecutionCount: number;
  latestAutoRepairExecutionAt: string;
  recentManualRepairExecutionCount: number;
  recentPassedManualRepairExecutionCount: number;
  recentFailedManualRepairExecutionCount: number;
  latestManualRepairExecutionAt: string;
}

export interface IntentE2EInsightSuppressedStarterHelperGovernanceCapability {
  capabilityUid: string;
  name: string;
  slug: string;
  latestExecutionStatus: 'passed' | 'failed' | '';
  latestExecutionIntent: Exclude<IntentE2EInsightVerificationIntent, 'unknown'> | '';
  latestExecutionSource: 'direct' | 'repair' | '';
  latestRepairTriggerKind: IntentE2EInsightRepairTriggerKind | '';
  latestExecutionAt: string;
  recentReviewExecutionCount: number;
  recentVerifyExecutionCount: number;
  recentRepairExecutionCount: number;
  recentAutoRepairExecutionCount: number;
  recentManualRepairExecutionCount: number;
}

export interface IntentE2EInsightFailureClassStat {
  failureClass: string;
  count: number;
  latestRepairObservationAt: string;
  latestRepairObservationSummary: string;
  latestRepairObservationVerifierCheckUids: string[];
}

export interface IntentE2EInsightScenarioFamilyStat extends IntentE2EInsightPassMetrics {
  family: IntentE2EScenarioFamily;
  label: string;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
}

export type IntentE2EInsightScenarioFamilySloStatus = 'meeting' | 'at_risk' | 'off_track' | 'insufficient_data';

export interface IntentE2EInsightScenarioFamilySloItem {
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
}

export interface IntentE2EInsightScenarioFamilySloOverview {
  generatedFromRuns: number;
  trackedFamilyCount: number;
  meetingCount: number;
  atRiskCount: number;
  offTrackCount: number;
  insufficientDataCount: number;
  items: IntentE2EInsightScenarioFamilySloItem[];
}

export type IntentE2EInsightRegressionWatchlistSource =
  | 'scenario_family_slo'
  | 'evaluation_baseline'
  | 'rollback_candidate';

export type IntentE2EInsightRegressionWatchlistSeverity = 'high' | 'medium';

export interface IntentE2EInsightRegressionWatchlistItem {
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
}

export interface IntentE2EInsightRegressionWatchlistOverview {
  generatedFromRuns: number;
  totalItems: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  items: IntentE2EInsightRegressionWatchlistItem[];
}

export type IntentE2EInsightRolloutStrategyStage = 'hold' | 'small_batch' | 'full_release';

export type IntentE2EInsightRolloutStrategyGateSource =
  | 'scenario_family_slo'
  | 'regression_watchlist'
  | 'risk_lifecycle_rule'
  | 'rollback_candidate';

export type IntentE2EInsightRolloutStrategyGateStatus = 'blocked' | 'warning' | 'ready';

export interface IntentE2EInsightRolloutStrategyGate {
  gateId: string;
  source: IntentE2EInsightRolloutStrategyGateSource;
  status: IntentE2EInsightRolloutStrategyGateStatus;
  title: string;
  summary: string;
  recommendation: string;
  sourceRef: string;
}

export interface IntentE2EInsightRolloutStrategyOverview {
  generatedFromRuns: number;
  recommendedStage: IntentE2EInsightRolloutStrategyStage;
  summary: string;
  recommendation: string;
  blockedCount: number;
  warningCount: number;
  readyCount: number;
  gates: IntentE2EInsightRolloutStrategyGate[];
}

export interface IntentE2EInsightPriorityScenarioStat extends IntentE2EInsightPassMetrics {
  family: Exclude<IntentE2EPriorityScenarioFamily, 'untracked'>;
  label: string;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
}

export interface IntentE2EInsightVerificationIntentStat extends IntentE2EInsightPassMetrics {
  intent: IntentE2EInsightVerificationIntent;
  label: string;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
  latestRepairObservationAt: string;
  latestRepairObservationSummary: string;
  latestRepairObservationVerifierCheckUids: string[];
}

export interface IntentE2EInsightCapabilityVerificationIntentStat {
  intent: Exclude<IntentE2EInsightVerificationIntent, 'unknown'>;
  label: string;
  totalExecutions: number;
  passedExecutions: number;
  failedExecutions: number;
  passRate: number;
  latestRepairObservationAt: string;
  latestRepairObservationSummary: string;
  latestRepairObservationVerifierCheckUids: string[];
}

export type IntentE2EInsightTraceAttemptOutcome = 'passed' | 'failed' | 'unknown';

export interface IntentE2EInsightRecentTraceAttempt {
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
}

export interface IntentE2EInsightRecentTraceResponseEvent {
  attempt: number;
  kind: 'matched' | 'json_parsed';
  url: string;
  method: string;
  status: number | null;
  topLevelKeys: string[];
}

export interface IntentE2EInsightRecentTraceFinalGraderResult {
  status: 'passed' | 'failed' | 'canceled';
  summary: string;
  failureClass: string;
  repairable: boolean | null;
}

export interface IntentE2EInsightRecentTraceVerifierCheckResult {
  checkUid: string;
  title: string;
  kind: string;
  required: boolean;
  preferredHelpers: string[];
  relatedPlanStepUids: string[];
}

export interface IntentE2EInsightRecentTraceVerifierResult {
  expectedOutcome: string;
  failingCheckCount: number;
  failingChecks: IntentE2EInsightRecentTraceVerifierCheckResult[];
}

export interface IntentE2EInsightRecentTrace {
  traceVersion: 1;
  runId: string;
  testType: PlatformTestType;
  runnerType: PlatformRunnerType;
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
  assetReadiness: IntentE2EAssetReadiness;
  qualitySplit: IntentE2EQualitySplit;
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
}

export interface IntentE2EInsightRecentCapabilityVerification {
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
}

export type IntentE2EEvaluationCandidatePriority = 'p0' | 'p1' | 'p2';

export interface IntentE2EEvaluationBaselineCandidate extends IntentE2EInsightPassMetrics {
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
}

export interface IntentE2EEvaluationBaseline {
  generatedFromRuns: number;
  candidateClusters: number;
  recommendedCount: number;
  recommendedFamilies: IntentE2EScenarioFamily[];
  selectionNote: string;
  candidates: IntentE2EEvaluationBaselineCandidate[];
}

export interface IntentE2EInsightRollbackCandidate {
  auditId: string;
  occurredAt: string;
  projectUid: string;
  requestedModuleUid?: string;
  title: string;
  backupPath: string | null;
  addedRuleIds: string[];
  mergedCandidateSources: string[];
  mergedRunIds: string[];
  mergedCandidates: IntentProjectKnowledgeMergedCandidateMeta[];
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
  impactStatus: IntentE2EInsightMergeImpactStatus;
  recommendation: string;
}

export type IntentE2EInsightKnowledgeChangeEfficacyStatus =
  | 'improving'
  | 'neutral'
  | 'regressing'
  | 'recovered'
  | 'watching'
  | 'still_abnormal';

export type IntentE2EInsightKnowledgeChangeEvidenceLevel = 'early' | 'decisionable';

export interface IntentE2EInsightKnowledgeChangeGrader {
  auditId: string;
  operation: IntentProjectKnowledgeAuditOperation;
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
  impactStatus: IntentE2EInsightMergeImpactStatus;
  efficacyStatus: IntentE2EInsightKnowledgeChangeEfficacyStatus;
  evidenceLevel: IntentE2EInsightKnowledgeChangeEvidenceLevel;
  preflightNoticeCount: number;
  receiptNoticeCount: number;
  recommendation: string;
}

export interface IntentE2EInsightKnowledgeChangeRuleSummary {
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
  latestOperation: IntentProjectKnowledgeAuditOperation;
  latestEfficacyStatus: IntentE2EInsightKnowledgeChangeEfficacyStatus;
  latestImpactStatus: IntentE2EInsightMergeImpactStatus;
  netPassRateDelta: number;
  netFirstPassRateDelta: number;
  successfulRunPromotionReceiptCount: number;
  successfulRunPromotionRunCount: number;
  lastSuccessfulRunPromotionRecordedAt: string;
  lastSuccessfulRunPromotionRequestedModuleUid: string;
  lastSuccessfulRunPromotionRunIds: string[];
  lastSuccessfulRunPromotionObservationSummary: string;
  supportingAuditIds: string[];
  recommendation: string;
}

export interface IntentE2ERulePerformance {
  ruleId: string;
  title: string;
  runCount: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
  passRate: number;
  rollbackCandidateCount: number;
  probation?: IntentProjectKnowledgeRuleProbation;
}

export type IntentE2EInsightProbationStatus = 'watching' | 'promoted' | 'degraded';
export type IntentE2EInsightMergeImpactStatus = 'improving' | 'neutral' | 'regressing';
export type IntentE2EInsightRiskLifecycleStatus = 'rollback_candidate' | 'degraded' | 'watching' | 'promoted';
export type IntentE2EInsightRiskLifecyclePolicy =
  | 'block_default_merge'
  | 'observe_guarded'
  | 'auto_promote_candidate'
  | 'observe';
export type IntentE2EInsightMergeProvenanceStage = 'preflight' | 'receipt';

export interface IntentE2EInsightMergeProvenanceKindCounts {
  autoPromoteCount: number;
  observeCount: number;
  blockDefaultMergeCount: number;
  overrideCount: number;
  riskAcknowledgementCount: number;
  guardrailCount: number;
  auditCount: number;
}

export interface IntentE2EInsightRiskLifecycleRuleMergeProvenance {
  preflightNoticeCount: number;
  receiptNoticeCount: number;
  preflight: IntentE2EInsightMergeProvenanceKindCounts;
  receipt: IntentE2EInsightMergeProvenanceKindCounts;
}

export interface IntentE2EInsightRiskLifecycleRuleRecentMergeProvenance {
  auditWindowSize: number;
  dayWindowSize: number;
  consideredAuditCount: number;
  windowMode: 'time_window' | 'audit_count_fallback';
  windowLabel: string;
  mergeProvenance: IntentE2EInsightRiskLifecycleRuleMergeProvenance;
}

export interface IntentE2EInsightRiskLifecycleRule {
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
  latestStatus: IntentE2EInsightRiskLifecycleStatus;
  latestImpactStatus?: IntentE2EInsightMergeImpactStatus;
  latestBackupPath: string | null;
  latestRecommendation: string;
  policy: IntentE2EInsightRiskLifecyclePolicy;
  policyReason: string;
  supportingAuditIds: string[];
}

export interface IntentE2EInsightProbationRule {
  auditId: string;
  occurredAt: string;
  projectUid: string;
  requestedModuleUid?: string;
  title: string;
  backupPath: string | null;
  addedRuleIds: string[];
  mergedCandidateSources: string[];
  mergedRunIds: string[];
  mergedCandidates: IntentProjectKnowledgeMergedCandidateMeta[];
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
  impactStatus: IntentE2EInsightMergeImpactStatus;
  remainingRuns: number;
  status: IntentE2EInsightProbationStatus;
  recommendation: string;
}

export interface IntentE2EInsightMergeProvenanceStat {
  key: string;
  operations: IntentProjectKnowledgeAuditOperation[];
  stage: IntentE2EInsightMergeProvenanceStage;
  kind: IntentProjectKnowledgeAuditNotice['kind'];
  level: IntentProjectKnowledgeAuditNotice['level'];
  provenanceType: IntentProjectKnowledgeAuditNotice['provenanceType'];
  title: string;
  auditCount: number;
  itemCount: number;
  candidateCount: number;
  ruleCount: number;
  latestOccurredAt: string;
  supportingAuditIds: string[];
}

export interface IntentE2EInsightProjectRuntimeGovernanceStatus {
  projectUid: string;
  path: string;
  exists: boolean;
  valid: boolean;
  ready: boolean;
  hasEnvironmentProfile: boolean;
  hasCredentialDefaults: boolean;
  hasFixtureDefaults: boolean;
  issues: IntentProjectRuntimeGovernanceIssue[];
}

export interface IntentE2EInsightsResult {
  scope: {
    projectUid: string;
    runLimit: number;
    auditLimit: number;
  };
  summary: IntentE2EInsightSummary;
  topRules: IntentE2EInsightRuleStat[];
  topHelpers: IntentE2EInsightHelperStat[];
  starterHelpers: IntentE2EInsightStarterHelper[];
  suppressedStarterHelpers: IntentE2EInsightSuppressedStarterHelper[];
  scenarioFamilies: IntentE2EInsightScenarioFamilyStat[];
  scenarioFamilySlo: IntentE2EInsightScenarioFamilySloOverview;
  regressionWatchlist: IntentE2EInsightRegressionWatchlistOverview;
  rolloutStrategy: IntentE2EInsightRolloutStrategyOverview;
  priorityScenarioFamilies: IntentE2EInsightPriorityScenarioStat[];
  verificationIntents: IntentE2EInsightVerificationIntentStat[];
  capabilityVerificationIntents: IntentE2EInsightCapabilityVerificationIntentStat[];
  failureClasses: IntentE2EInsightFailureClassStat[];
  mergeProvenanceStats: IntentE2EInsightMergeProvenanceStat[];
  riskLifecycleRules: IntentE2EInsightRiskLifecycleRule[];
  probationRules: IntentE2EInsightProbationRule[];
  rollbackCandidates: IntentE2EInsightRollbackCandidate[];
  knowledgeChangeGraders: IntentE2EInsightKnowledgeChangeGrader[];
  knowledgeChangeRuleSummaries: IntentE2EInsightKnowledgeChangeRuleSummary[];
  recentTraces: IntentE2EInsightRecentTrace[];
  recentCapabilityVerifications: IntentE2EInsightRecentCapabilityVerification[];
  evaluationBaseline: IntentE2EEvaluationBaseline;
  failurePressureSummary?: IntentVerificationFailurePressureSummary;
  starterHelperFailurePressureSummary?: IntentVerificationFailurePressureSummary;
  suppressedStarterHelperFailurePressureSummary?: IntentVerificationFailurePressureSummary;
  suppressedStarterHelperGovernanceSummary?: IntentE2EInsightSuppressedStarterHelperGovernanceSummary;
  runtimeGovernanceStatus?: IntentE2EInsightProjectRuntimeGovernanceStatus;
}

export type IntentE2ERepeatedFailureSuppressionDecision = 'draft_only' | 'needs_bootstrap' | 'needs_fixture';

export interface IntentE2ERepeatedFailureSuppressionSignal {
  shouldSuppress: boolean;
  scenarioFamily: IntentE2EScenarioFamily;
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  targetPath: string;
  matchedSnapshotSignature: string;
  matchedRunCount: number;
  matchedFailedRuns: number;
  recentFailureStreak: number;
  dominantQualityBucket: IntentE2EQualityBucket | '';
  dominantBlockerKind: IntentE2EBlockerKind;
  latestFailureClass: string;
  recommendedDecision: IntentE2ERepeatedFailureSuppressionDecision | '';
  reason: string;
  latestFinishedAt: string;
  representativeRunIds: string[];
  failurePressureSummary: IntentVerificationFailurePressureSummary;
}

interface BuildIntentE2EInsightsOptions {
  projectUid?: string;
  runLimit?: number;
  auditLimit?: number;
  nowMs?: number;
  runtimeGovernanceStatus?: IntentE2EInsightProjectRuntimeGovernanceStatus;
}

export interface IntentE2EInsightRunRecord {
  runId: string;
  testType: PlatformTestType;
  runnerType: PlatformRunnerType;
  verificationPolicyNotes: string[];
  projectUid: string;
  moduleUid: string;
  status: 'passed' | 'failed' | 'canceled';
  finishedAt: string;
  finishedAtMs: number;
  requestInput: string;
  targetUrl: string;
  targetPath: string;
  scenarioTitle: string;
  scenarioFamily: IntentE2EScenarioFamily;
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  verificationIntent: IntentE2EInsightVerificationIntent;
  taskMode: 'page' | 'scenario' | 'unknown';
  stepCount: number;
  stepTypes: string[];
  snapshotSignature: string;
  compiledSlotCount: number;
  compiledSlotUids: string[];
  matchedRecipeSlugs: string[];
  assetReadiness: IntentE2EAssetReadiness;
  qualitySplit: IntentE2EQualitySplit;
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
  structuredPatchAttempted: boolean;
  targetedRepairAttempted: boolean;
  patchedSlotUids: string[];
  failureClass: string;
  attempts: IntentE2EInsightRecentTraceAttempt[];
}

type InsightRunRecord = IntentE2EInsightRunRecord;

interface InsightCapabilityVerificationRecord {
  executionUid: string;
  planUid: string;
  configUid: string;
  configName: string;
  capabilityUid: string;
  chainCapabilityUids: string[];
  status: 'passed' | 'failed';
  intent: Exclude<IntentE2EInsightVerificationIntent, 'unknown'>;
  targetName: string;
  strategyLabel: string;
  summary: string;
  errorMessage: string;
  repairTriggerKind: IntentE2EInsightRepairTriggerKind | '';
  createdAt: string;
  createdAtMs: number;
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

function normalizeIntentE2EAssetReadinessStatus(value: unknown): IntentE2EAssetReadinessStatus {
  return value === 'asset_missing' || value === 'no_hit' || value === 'ready' ? value : 'ready';
}

function normalizeIntentE2EAssetReadiness(
  raw: unknown,
  fallback: {
    projectUid: string;
    knowledgeMatchCount: number;
  }
): IntentE2EAssetReadiness {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const fallbackStatus: IntentE2EAssetReadinessStatus =
    fallback.projectUid && fallback.knowledgeMatchCount <= 0 ? 'no_hit' : 'ready';
  const status = normalizeIntentE2EAssetReadinessStatus(source?.status);

  return {
    status: source ? status : fallbackStatus,
    projectUid:
      typeof source?.projectUid === 'string' && source.projectUid.trim()
        ? source.projectUid.trim()
        : fallback.projectUid,
    onboardingPath: typeof source?.onboardingPath === 'string' && source.onboardingPath.trim() ? source.onboardingPath.trim() : undefined,
    knowledgePath: typeof source?.knowledgePath === 'string' && source.knowledgePath.trim() ? source.knowledgePath.trim() : undefined,
    repairMemoryPath:
      typeof source?.repairMemoryPath === 'string' && source.repairMemoryPath.trim()
        ? source.repairMemoryPath.trim()
        : undefined,
    hasOnboarding: typeof source?.hasOnboarding === 'boolean' ? source.hasOnboarding : undefined,
    onboardingReady: typeof source?.onboardingReady === 'boolean' ? source.onboardingReady : undefined,
    hasKnowledgeAsset: typeof source?.hasKnowledgeAsset === 'boolean' ? source.hasKnowledgeAsset : undefined,
    hasRepairMemoryAsset: typeof source?.hasRepairMemoryAsset === 'boolean' ? source.hasRepairMemoryAsset : undefined,
    knowledgeMatchCount:
      typeof source?.knowledgeMatchCount === 'number' && Number.isFinite(source.knowledgeMatchCount)
        ? Math.max(0, Math.floor(source.knowledgeMatchCount))
        : fallback.knowledgeMatchCount,
    reasons: Array.isArray(source?.reasons) ? uniqueStrings(source.reasons as string[]) : source ? [] : fallbackStatus === 'no_hit' ? ['knowledge_no_hit'] : fallback.projectUid ? [] : ['global_scope'],
  };
}

function toPercent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function roundMetric(value: number): number {
  return Math.round(value * 10) / 10;
}

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeRepairTriggerKind(value: unknown): IntentE2EInsightRepairTriggerKind | '' {
  return value === 'auto' || value === 'manual' ? value : '';
}

function inferRepairTriggerKindFromActorLabel(value: unknown): IntentE2EInsightRepairTriggerKind {
  return typeof value === 'string' && value.trim() === '自动纠错' ? 'auto' : 'manual';
}

const SCENARIO_FAMILY_LABELS: Record<IntentE2EScenarioFamily, string> = {
  page_task: '单页面任务',
  simple_scenario: '简单场景',
  complex_enterprise_flow: '复杂企业流程',
  unknown: '未分类',
};

const SCENARIO_FAMILY_SLO_TARGETS: Record<
  IntentE2EScenarioFamily,
  {
    minRuns: number;
    targetFirstPassRate: number;
    targetTerminalPassRate: number;
  }
> = {
  page_task: {
    minRuns: 3,
    targetFirstPassRate: 85,
    targetTerminalPassRate: 95,
  },
  simple_scenario: {
    minRuns: 3,
    targetFirstPassRate: 70,
    targetTerminalPassRate: 85,
  },
  complex_enterprise_flow: {
    minRuns: 3,
    targetFirstPassRate: 60,
    targetTerminalPassRate: 80,
  },
  unknown: {
    minRuns: 3,
    targetFirstPassRate: 70,
    targetTerminalPassRate: 85,
  },
};

const PRIORITY_SCENARIO_FAMILY_LABELS: Record<IntentE2EPriorityScenarioFamily, string> = {
  business_create_list_verify: '新建商机后回列表验收',
  business_to_order: '商机转订单 / 生成订单',
  list_search_detail: '列表搜索并进入详情',
  modal_or_drawer_save: '弹层 / 抽屉编辑并保存',
  row_action_menu: '列表行操作菜单',
  list_ownership_switch: '列表归属切换后回查',
  untracked: '未纳入当前优先 family',
};

const VERIFICATION_INTENT_LABELS: Record<IntentE2EInsightVerificationIntent, string> = {
  verify: '标准验证',
  review: '保守复核',
  unknown: '未标注意图',
};

const TRACE_SIGNAL_PATTERNS: Array<{ pattern: RegExp; signal: string }> = [
  { pattern: /env login completed/i, signal: 'env_login_completed' },
  { pattern: /api response matched/i, signal: 'api_response_matched' },
  { pattern: /submit navigation settled/i, signal: 'submit_navigation_settled' },
  { pattern: /submit success locator visible/i, signal: 'submit_success_locator_visible' },
  { pattern: /submit state observed/i, signal: 'submit_state_observed' },
  { pattern: /ant-modal resolved/i, signal: 'ant_modal_resolved' },
  { pattern: /table row matched/i, signal: 'table_row_matched' },
  { pattern: /business-list ownership switched/i, signal: 'business_list_ownership_switched' },
];

function normalizeScenarioTaskMode(value: unknown): 'page' | 'scenario' | 'unknown' {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'page' || normalized === 'scenario') return normalized;
  return 'unknown';
}

function normalizeTraceAttemptKind(value: unknown): 'generate' | 'repair' | 'unknown' {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'generate' || normalized === 'repair') return normalized;
  return 'unknown';
}

function normalizeTraceAttemptOutcome(value: unknown): IntentE2EInsightTraceAttemptOutcome {
  if (typeof value === 'boolean') {
    return value ? 'passed' : 'failed';
  }
  return 'unknown';
}

function normalizeVerificationIntent(value: unknown): IntentE2EInsightVerificationIntent {
  if (value === 'verify' || value === 'review') return value;
  return 'unknown';
}

function resolveVerificationIntent(input: {
  verificationPlanIntent?: unknown;
  scenarioFeatureDescription?: unknown;
  description?: unknown;
}): IntentE2EInsightVerificationIntent {
  const explicitIntent = normalizeVerificationIntent(input.verificationPlanIntent);
  if (explicitIntent !== 'unknown') return explicitIntent;

  const textCandidates = [input.scenarioFeatureDescription, input.description]
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);

  for (const text of textCandidates) {
    const match = text.match(/(?:^|\n)能力验证意图：([^\n]+)/);
    const parsed = normalizeVerificationIntent(match?.[1]?.trim() || '');
    if (parsed !== 'unknown') return parsed;
  }

  return 'unknown';
}

function normalizeTargetPath(value: string): string {
  const raw = value.trim();
  if (!raw) return '';

  try {
    const url = raw.startsWith('http://') || raw.startsWith('https://') ? new URL(raw) : new URL(raw, 'https://intent.local');
    if (url.protocol === 'about:') {
      return raw;
    }
    return url.pathname || '/';
  } catch {
    return raw.replace(/[?#].*$/, '');
  }
}

function buildTraceSnapshotSignature(input: {
  scenarioFamily: IntentE2EScenarioFamily;
  taskMode: 'page' | 'scenario' | 'unknown';
  targetPath: string;
  stepTypes: string[];
}): string {
  const pathToken = input.targetPath || 'unknown_path';
  const stepToken = input.stepTypes.length > 0 ? input.stepTypes.slice(0, 5).join('+').toLowerCase() : 'no_steps';
  return [input.scenarioFamily, input.taskMode, pathToken, stepToken].join('|');
}

function extractTraceSignals(rawLogs: unknown): string[] {
  if (!Array.isArray(rawLogs)) return [];

  return uniqueStrings(
    TRACE_SIGNAL_PATTERNS.map(({ pattern, signal }) =>
      rawLogs.some(
        (log) =>
          log &&
          typeof log === 'object' &&
          !Array.isArray(log) &&
          typeof (log as { message?: unknown }).message === 'string' &&
          pattern.test(String((log as { message?: unknown }).message || ''))
      )
        ? signal
        : ''
    )
  );
}

function extractTraceResponseEvents(
  rawLogs: unknown,
  attempt: number
): IntentE2EInsightRecentTraceResponseEvent[] {
  if (!Array.isArray(rawLogs)) return [];

  const seen = new Set<string>();
  const items: IntentE2EInsightRecentTraceResponseEvent[] = [];

  for (const rawLog of rawLogs) {
    if (!rawLog || typeof rawLog !== 'object' || Array.isArray(rawLog)) continue;

    const message = typeof (rawLog as { message?: unknown }).message === 'string' ? String((rawLog as { message?: unknown }).message || '').trim().toLowerCase() : '';
    const kind: IntentE2EInsightRecentTraceResponseEvent['kind'] | null =
      message === 'api response matched' ? 'matched' : message === 'api response json parsed' ? 'json_parsed' : null;
    if (!kind) continue;

    const meta =
      (rawLog as { meta?: unknown }).meta && typeof (rawLog as { meta?: unknown }).meta === 'object' && !Array.isArray((rawLog as { meta?: unknown }).meta)
        ? ((rawLog as { meta?: unknown }).meta as {
            url?: unknown;
            method?: unknown;
            status?: unknown;
            topLevelKeys?: unknown;
          })
        : null;
    const url = typeof meta?.url === 'string' ? meta.url.trim() : '';
    const method = typeof meta?.method === 'string' ? meta.method.trim().toUpperCase() : '';
    const status = typeof meta?.status === 'number' && Number.isFinite(meta.status) ? Number(meta.status) : null;
    const topLevelKeys = Array.isArray(meta?.topLevelKeys)
      ? uniqueStrings((meta.topLevelKeys as unknown[]).map((item) => (typeof item === 'string' ? item : '')))
      : [];

    if (!url && !method && status === null && topLevelKeys.length === 0) {
      continue;
    }

    const dedupeKey = JSON.stringify([attempt, kind, url, method, status, topLevelKeys]);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    items.push({
      attempt,
      kind,
      url,
      method,
      status,
      topLevelKeys,
    });
  }

  return items;
}

function buildTraceFinalGraderResult(input: {
  status: InsightRunRecord['status'];
  failureClass: string;
  finalFailureSummary: string;
  repairable: boolean | null;
  finalResultError: string;
}): IntentE2EInsightRecentTraceFinalGraderResult {
  const summary =
    input.status === 'passed'
      ? '终态通过'
      : input.finalFailureSummary || input.finalResultError || (input.status === 'canceled' ? '终态已取消' : '终态失败');

  return {
    status: input.status,
    summary,
    failureClass: input.failureClass,
    repairable: input.status === 'passed' ? null : input.repairable,
  };
}

function normalizeTraceStepTitle(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function looksLikeVerificationStepTitle(value: string): boolean {
  const normalized = normalizeTraceStepTitle(value);
  if (!normalized) return false;
  return normalized.includes('verification') || normalized.includes('验收') || normalized.includes('校验');
}

function buildTraceVerifierResult(input: {
  verificationPlan: {
    expectedOutcome?: unknown;
    checks?: unknown;
  } | null;
  finalResult: {
    success?: unknown;
    steps?: unknown;
  } | null;
}): IntentE2EInsightRecentTraceVerifierResult {
  const expectedOutcome =
    input.verificationPlan && typeof input.verificationPlan.expectedOutcome === 'string'
      ? input.verificationPlan.expectedOutcome.trim()
      : '';
  const checks =
    input.verificationPlan && Array.isArray(input.verificationPlan.checks)
      ? (input.verificationPlan.checks as Array<{
          checkUid?: unknown;
          title?: unknown;
          kind?: unknown;
          required?: unknown;
          preferredHelpers?: unknown;
          relatedPlanStepUids?: unknown;
        }>)
      : [];
  const finalSteps =
    input.finalResult && Array.isArray(input.finalResult.steps)
      ? (input.finalResult.steps as Array<{
          title?: unknown;
          status?: unknown;
        }>)
      : [];
  const hasFailedVerificationStep = finalSteps.some(
    (step) => step && step.status === 'failed' && looksLikeVerificationStepTitle(typeof step.title === 'string' ? step.title : '')
  );
  const failingChecks = hasFailedVerificationStep
    ? checks.map((check) => ({
        checkUid: typeof check.checkUid === 'string' ? check.checkUid.trim() : '',
        title: typeof check.title === 'string' ? check.title.trim() : '',
        kind: typeof check.kind === 'string' ? check.kind.trim() : '',
        required: check.required !== false,
        preferredHelpers: Array.isArray(check.preferredHelpers)
          ? uniqueStrings((check.preferredHelpers as unknown[]).map((item) => (typeof item === 'string' ? item : '')))
          : [],
        relatedPlanStepUids: Array.isArray(check.relatedPlanStepUids)
          ? uniqueStrings((check.relatedPlanStepUids as unknown[]).map((item) => (typeof item === 'string' ? item : '')))
          : [],
      }))
      : [];

  return {
    expectedOutcome,
    failingCheckCount: failingChecks.length,
    failingChecks,
  };
}

function extractCapabilityVerificationContext(
  meta: unknown
): {
  capabilityUid: string;
  chainCapabilityUids: string[];
  intent: Exclude<IntentE2EInsightVerificationIntent, 'unknown'>;
  targetName: string;
  strategyLabel: string;
} | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const rawValue =
    (meta as { capabilityVerification?: unknown }).capabilityVerification &&
    typeof (meta as { capabilityVerification?: unknown }).capabilityVerification === 'object' &&
    !Array.isArray((meta as { capabilityVerification?: unknown }).capabilityVerification)
      ? ((meta as { capabilityVerification?: unknown }).capabilityVerification as {
          capabilityUid?: unknown;
          chainCapabilityUids?: unknown;
          intent?: unknown;
          targetName?: unknown;
          strategyLabel?: unknown;
        })
      : null;
  if (!rawValue) return null;

  const capabilityUid = typeof rawValue.capabilityUid === 'string' ? rawValue.capabilityUid.trim() : '';
  const intent = normalizeVerificationIntent(rawValue.intent);
  if (!capabilityUid || intent === 'unknown') return null;

  return {
    capabilityUid,
    chainCapabilityUids: Array.isArray(rawValue.chainCapabilityUids)
      ? uniqueStrings(rawValue.chainCapabilityUids as string[])
      : [],
    intent,
    targetName: typeof rawValue.targetName === 'string' ? rawValue.targetName.trim() : '',
    strategyLabel: typeof rawValue.strategyLabel === 'string' ? rawValue.strategyLabel.trim() : '',
  };
}

function buildEvalCaseId(snapshotSignature: string): string {
  const normalized = snapshotSignature
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `eval_${(normalized || 'unknown').slice(0, 96)}`;
}

function countStrings(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  return counts;
}

function pickTopStrings(values: string[], limit = 5): string[] {
  return [...countStrings(values).entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(1, Math.floor(limit || 5)))
    .map(([value]) => value);
}

function pickTopFailureClassStats(runs: InsightRunRecord[], limit = 3): IntentE2EInsightFailureClassStat[] {
  return [...countStrings(runs.map((run) => run.failureClass)).entries()]
    .map(([failureClass, count]) => ({
      failureClass,
      count,
      latestRepairObservationAt: '',
      latestRepairObservationSummary: '',
      latestRepairObservationVerifierCheckUids: [],
    }))
    .sort((a, b) => b.count - a.count || a.failureClass.localeCompare(b.failureClass))
    .slice(0, Math.max(1, Math.floor(limit || 3)));
}

function scenarioFamilyPriorityRank(family: IntentE2EScenarioFamily): number {
  switch (family) {
    case 'complex_enterprise_flow':
      return 0;
    case 'simple_scenario':
      return 1;
    case 'page_task':
      return 2;
    default:
      return 3;
  }
}

function priorityScenarioFamilyRank(family: IntentE2EPriorityScenarioFamily): number {
  switch (family) {
    case 'business_create_list_verify':
      return 0;
    case 'business_to_order':
      return 1;
    case 'list_search_detail':
      return 2;
    case 'modal_or_drawer_save':
      return 3;
    case 'row_action_menu':
      return 4;
    case 'list_ownership_switch':
      return 5;
    case 'untracked':
    default:
      return 6;
  }
}

function evaluationPriorityRank(priority: IntentE2EEvaluationCandidatePriority): number {
  switch (priority) {
    case 'p0':
      return 0;
    case 'p1':
      return 1;
    default:
      return 2;
  }
}

function pickEvaluationCandidatePriority(input: {
  scenarioFamily: IntentE2EScenarioFamily;
  runCount: number;
  failedRuns: number;
  repairedPassRuns: number;
  repairAttemptedRuns: number;
}): IntentE2EEvaluationCandidatePriority {
  if (
    input.scenarioFamily === 'complex_enterprise_flow' &&
    (input.failedRuns > 0 || input.repairedPassRuns > 0 || input.runCount >= 2)
  ) {
    return 'p0';
  }
  if (input.failedRuns >= 2 || (input.failedRuns > 0 && input.runCount >= 2)) {
    return 'p0';
  }
  if (input.repairAttemptedRuns > 0 || input.repairedPassRuns > 0 || input.runCount >= 3) {
    return 'p1';
  }
  return 'p2';
}

function buildEvaluationSelectionReason(input: {
  scenarioFamily: IntentE2EScenarioFamily;
  runCount: number;
  failedRuns: number;
  repairedPassRuns: number;
  knowledgeHitRate: number;
  keySignals: string[];
}): string {
  const reasons: string[] = [];

  if (input.scenarioFamily === 'complex_enterprise_flow') {
    reasons.push('复杂企业流程');
  } else if (input.scenarioFamily === 'simple_scenario') {
    reasons.push('简单场景代表流');
  } else if (input.scenarioFamily === 'page_task') {
    reasons.push('页面任务基线');
  }

  if (input.runCount >= 2) {
    reasons.push(`高频样本 ${input.runCount} runs`);
  }
  if (input.failedRuns > 0) {
    reasons.push(`含 ${input.failedRuns} 次失败`);
  }
  if (input.repairedPassRuns > 0) {
    reasons.push(`含 ${input.repairedPassRuns} 次 repair 通过`);
  }
  if (input.knowledgeHitRate <= 0) {
    reasons.push('尚未命中项目知识');
  }
  if (input.failedRuns > 0 && input.keySignals.includes('api_response_matched')) {
    reasons.push('存在接口成功后仍失败的业务验收样本');
  }

  return reasons.join('；') || '保留为固定评测基线。';
}

function extractScenarioStepTypes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return uniqueStrings(
    raw.map((step) =>
      step && typeof step === 'object' && !Array.isArray(step) && typeof (step as { stepType?: unknown }).stepType === 'string'
        ? String((step as { stepType?: unknown }).stepType)
        : ''
    )
  );
}

function classifyIntentE2EScenarioFamily(input: {
  requestInput: string;
  targetUrl: string;
  scenarioCard: unknown;
  description: string;
}): IntentE2EScenarioFamily {
  const scenarioCard =
    input.scenarioCard && typeof input.scenarioCard === 'object' && !Array.isArray(input.scenarioCard)
      ? (input.scenarioCard as {
          taskMode?: unknown;
          featureDescription?: unknown;
          flowDefinition?: {
            steps?: unknown;
          } | null;
        })
      : null;
  const taskMode = typeof scenarioCard?.taskMode === 'string' ? scenarioCard.taskMode.trim().toLowerCase() : '';
  const steps = Array.isArray(scenarioCard?.flowDefinition?.steps) ? scenarioCard?.flowDefinition?.steps || [] : [];
  const stepTypes = extractScenarioStepTypes(steps);
  const stepCount = steps.length;
  const haystack = [
    input.requestInput,
    input.targetUrl,
    input.description,
    typeof scenarioCard?.featureDescription === 'string' ? scenarioCard.featureDescription : '',
    ...steps.flatMap((step) =>
      step && typeof step === 'object' && !Array.isArray(step)
        ? [
            String((step as { title?: unknown }).title || ''),
            String((step as { target?: unknown }).target || ''),
            String((step as { instruction?: unknown }).instruction || ''),
            String((step as { expectedResult?: unknown }).expectedResult || ''),
          ]
        : []
    ),
  ]
    .join('\n')
    .toLowerCase();

  if (taskMode === 'page') {
    return 'page_task';
  }

  const hasComplexStepType = stepTypes.some((stepType) => ['api', 'extract', 'cleanup'].includes(stepType.toLowerCase()));
  const hasEnterpriseSurface = /(列表|表格|drawer|modal|弹框|iframe|详情|新建|创建|保存|提交|回列表|搜索|检索|切换|审批|订单|商机|business|order)/i.test(
    haystack
  );

  if (taskMode === 'scenario') {
    if (stepCount >= 5 || hasComplexStepType || (stepCount >= 3 && hasEnterpriseSurface)) {
      return 'complex_enterprise_flow';
    }
    return 'simple_scenario';
  }

  if (stepCount >= 5 || hasComplexStepType) {
    return 'complex_enterprise_flow';
  }
  if (stepCount >= 1 || input.requestInput.trim()) {
    return hasEnterpriseSurface ? 'complex_enterprise_flow' : 'simple_scenario';
  }
  return 'unknown';
}

function buildPassMetrics(runs: InsightRunRecord[]): IntentE2EInsightPassMetrics {
  const firstPassPassedRuns = runs.filter((run) => run.firstPassSucceeded).length;
  const repairedPassRuns = runs.filter((run) => run.repairedSucceeded).length;
  const terminalPassedRuns = runs.filter((run) => run.status === 'passed').length;

  return {
    firstPassPassedRuns,
    firstPassPassRate: toPercent(firstPassPassedRuns, runs.length),
    repairedPassRuns,
    repairedPassRate: toPercent(repairedPassRuns, runs.length),
    terminalPassRate: toPercent(terminalPassedRuns, runs.length),
  };
}

const ASSERTION_FAILURE_CLASSES = new Set(['assertion_too_strict']);
const AUTH_BLOCK_QUALITY_BUCKETS = new Set<IntentE2EQualityBucket>(['auth_blocked', 'permission_blocked']);
const ENV_BLOCK_QUALITY_BUCKETS = new Set<IntentE2EQualityBucket>(['env_blocked', 'data_blocked']);
const PERMISSION_BLOCK_QUALITY_BUCKETS = new Set<IntentE2EQualityBucket>(['permission_blocked']);
const DATA_BLOCK_QUALITY_BUCKETS = new Set<IntentE2EQualityBucket>(['data_blocked']);
const MODEL_QUALITY_FAILURE_BUCKETS = new Set<IntentE2EQualityBucket>(['model_quality']);

function countRunsByFailureClasses(runs: InsightRunRecord[], failureClasses: ReadonlySet<string>): number {
  return runs.filter((run) => failureClasses.has(run.failureClass)).length;
}

function countRunsByQualityBuckets(
  runs: InsightRunRecord[],
  buckets: ReadonlySet<IntentE2EQualityBucket>
): number {
  return runs.filter((run) => buckets.has(run.qualitySplit.bucket)).length;
}

function isIntentE2EModelQualityEligibleBucket(bucket: IntentE2EQualityBucket): boolean {
  return bucket === 'passed' || bucket === 'model_quality';
}

function getAuditMergedCandidateSources(audit: IntentProjectKnowledgeAuditEntry): string[] {
  return Array.isArray(audit.meta?.mergedCandidateSources) ? uniqueStrings(audit.meta.mergedCandidateSources) : [];
}

function getAuditMergedRunIds(audit: IntentProjectKnowledgeAuditEntry): string[] {
  return Array.isArray(audit.meta?.mergedRunIds) ? uniqueStrings(audit.meta.mergedRunIds) : [];
}

function getAuditRestoredFrom(audit: IntentProjectKnowledgeAuditEntry): string {
  return typeof audit.meta?.restoredFrom === 'string' ? audit.meta.restoredFrom.trim() : '';
}

function normalizeMergedCandidateMeta(raw: unknown): IntentProjectKnowledgeMergedCandidateMeta | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const candidateId = typeof source.candidateId === 'string' ? source.candidateId.trim() : '';
  const ruleId = typeof source.ruleId === 'string' ? source.ruleId.trim() : '';

  if (!candidateId || !ruleId) return null;

  return {
    candidateId,
    ruleId,
    source: typeof source.source === 'string' ? source.source.trim() : '',
    feedbackStatus: typeof source.feedbackStatus === 'string' ? source.feedbackStatus.trim() || undefined : undefined,
    risky: source.risky === true,
    overrideApplied: source.overrideApplied === true,
    riskAcknowledged: source.riskAcknowledged === true,
    runIds: Array.isArray(source.runIds)
      ? uniqueStrings(source.runIds.map((item) => (typeof item === 'string' ? item : '')))
      : [],
  };
}

function getAuditMergedCandidates(audit: IntentProjectKnowledgeAuditEntry): IntentProjectKnowledgeMergedCandidateMeta[] {
  if (!Array.isArray(audit.meta?.mergedCandidates)) return [];

  const seen = new Set<string>();
  const items: IntentProjectKnowledgeMergedCandidateMeta[] = [];
  for (const item of audit.meta.mergedCandidates) {
    const normalized = normalizeMergedCandidateMeta(item);
    if (!normalized) continue;
    const key = `${normalized.candidateId}::${normalized.ruleId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(normalized);
  }
  return items;
}

function getAuditRequestedModuleUid(audit: IntentProjectKnowledgeAuditEntry): string {
  return typeof audit.meta?.requestedModuleUid === 'string' ? audit.meta.requestedModuleUid.trim() : '';
}

function getAuditSelectedCandidateFeedbackStatuses(audit: IntentProjectKnowledgeAuditEntry): string[] {
  return Array.isArray(audit.meta?.selectedCandidateFeedbackStatuses)
    ? uniqueStrings(audit.meta.selectedCandidateFeedbackStatuses)
    : [];
}

function getAuditSelectedRiskyCandidateIds(audit: IntentProjectKnowledgeAuditEntry): string[] {
  return Array.isArray(audit.meta?.selectedRiskyCandidateIds) ? uniqueStrings(audit.meta.selectedRiskyCandidateIds) : [];
}

function getAuditAppliedOverrideCandidateIds(audit: IntentProjectKnowledgeAuditEntry): string[] {
  return Array.isArray(audit.meta?.appliedOverrideCandidateIds) ? uniqueStrings(audit.meta.appliedOverrideCandidateIds) : [];
}

function getAuditAppliedOverrideCandidateFeedbackStatuses(audit: IntentProjectKnowledgeAuditEntry): string[] {
  return Array.isArray(audit.meta?.appliedOverrideCandidateFeedbackStatuses)
    ? uniqueStrings(audit.meta.appliedOverrideCandidateFeedbackStatuses)
    : [];
}

function getAuditAppliedAcknowledgedRiskCandidateIds(audit: IntentProjectKnowledgeAuditEntry): string[] {
  return Array.isArray(audit.meta?.appliedAcknowledgedRiskCandidateIds)
    ? uniqueStrings(audit.meta.appliedAcknowledgedRiskCandidateIds)
    : [];
}

function getAuditAppliedAcknowledgedRiskCandidateFeedbackStatuses(audit: IntentProjectKnowledgeAuditEntry): string[] {
  return Array.isArray(audit.meta?.appliedAcknowledgedRiskCandidateFeedbackStatuses)
    ? uniqueStrings(audit.meta.appliedAcknowledgedRiskCandidateFeedbackStatuses)
    : [];
}

function getAuditPreflightItems(audit: IntentProjectKnowledgeAuditEntry): IntentProjectKnowledgeAuditNotice[] {
  return Array.isArray(audit.meta?.preflightSummary?.items) ? audit.meta.preflightSummary.items : [];
}

function getAuditMergeReceipts(audit: IntentProjectKnowledgeAuditEntry): IntentProjectKnowledgeAuditNotice[] {
  return Array.isArray(audit.meta?.mergeReceipts) ? audit.meta.mergeReceipts : [];
}

function isSuccessfulRunMergeAudit(audit: IntentProjectKnowledgeAuditEntry): boolean {
  return getAuditMergedCandidateSources(audit).includes('successful_run');
}

function createEmptyMergeProvenanceKindCounts(): IntentE2EInsightMergeProvenanceKindCounts {
  return {
    autoPromoteCount: 0,
    observeCount: 0,
    blockDefaultMergeCount: 0,
    overrideCount: 0,
    riskAcknowledgementCount: 0,
    guardrailCount: 0,
    auditCount: 0,
  };
}

function createEmptyRiskLifecycleRuleMergeProvenance(): IntentE2EInsightRiskLifecycleRuleMergeProvenance {
  return {
    preflightNoticeCount: 0,
    receiptNoticeCount: 0,
    preflight: createEmptyMergeProvenanceKindCounts(),
    receipt: createEmptyMergeProvenanceKindCounts(),
  };
}

const RISK_LIFECYCLE_RECENT_MERGE_AUDIT_WINDOW = 3;
const RISK_LIFECYCLE_RECENT_MERGE_DAY_WINDOW = 7;
const KNOWLEDGE_CHANGE_BASELINE_WINDOW = 5;
const KNOWLEDGE_CHANGE_FOLLOWUP_WINDOW = 5;
const KNOWLEDGE_CHANGE_DECISION_RUNS = 3;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function buildRecentRiskLifecycleRuleMergeWindowLabel(input: {
  auditWindowSize: number;
  dayWindowSize: number;
  consideredAuditCount: number;
  windowMode: 'time_window' | 'audit_count_fallback';
}): string {
  if (input.windowMode === 'audit_count_fallback') {
    return `最近 ${input.consideredAuditCount}/${input.auditWindowSize} 次 merge 审计（近 ${input.dayWindowSize} 天无样本）`;
  }

  return `近 ${input.dayWindowSize} 天（${input.consideredAuditCount} 次 merge 审计）`;
}

function createEmptyRecentRiskLifecycleRuleMergeProvenance(
  auditWindowSize = RISK_LIFECYCLE_RECENT_MERGE_AUDIT_WINDOW,
  dayWindowSize = RISK_LIFECYCLE_RECENT_MERGE_DAY_WINDOW
): IntentE2EInsightRiskLifecycleRuleRecentMergeProvenance {
  return {
    auditWindowSize,
    dayWindowSize,
    consideredAuditCount: 0,
    windowMode: 'time_window',
    windowLabel: buildRecentRiskLifecycleRuleMergeWindowLabel({
      auditWindowSize,
      dayWindowSize,
      consideredAuditCount: 0,
      windowMode: 'time_window',
    }),
    mergeProvenance: createEmptyRiskLifecycleRuleMergeProvenance(),
  };
}

function incrementMergeProvenanceKindCounts(
  target: IntentE2EInsightMergeProvenanceKindCounts,
  kind: IntentProjectKnowledgeAuditNotice['kind']
) {
  switch (kind) {
    case 'auto_promote':
      target.autoPromoteCount += 1;
      break;
    case 'observe':
      target.observeCount += 1;
      break;
    case 'block_default_merge':
      target.blockDefaultMergeCount += 1;
      break;
    case 'override':
      target.overrideCount += 1;
      break;
    case 'risk_acknowledgement':
      target.riskAcknowledgementCount += 1;
      break;
    case 'guardrail':
      target.guardrailCount += 1;
      break;
    case 'audit':
      target.auditCount += 1;
      break;
  }
}

function noticeMatchesRule(
  audit: IntentProjectKnowledgeAuditEntry,
  mergedCandidates: IntentProjectKnowledgeMergedCandidateMeta[],
  notice: IntentProjectKnowledgeAuditNotice,
  ruleId: string
): boolean {
  if (notice.ruleIds.includes(ruleId)) return true;

  if (notice.candidateIds.length > 0) {
    const matchedRuleIds = new Set(
      mergedCandidates
        .filter((candidate) => notice.candidateIds.includes(candidate.candidateId))
        .map((candidate) => candidate.ruleId)
    );
    if (matchedRuleIds.has(ruleId)) return true;
    if (matchedRuleIds.size === 0 && audit.comparison.addedRuleIds.length === 1) {
      return audit.comparison.addedRuleIds[0] === ruleId;
    }
  }

  if (notice.ruleIds.length === 0 && notice.candidateIds.length === 0) {
    return audit.comparison.addedRuleIds.includes(ruleId);
  }

  return false;
}

function resolveRuleLevelMergeProvenance(
  audit: IntentProjectKnowledgeAuditEntry,
  mergedCandidates: IntentProjectKnowledgeMergedCandidateMeta[],
  ruleId: string
): IntentE2EInsightRiskLifecycleRuleMergeProvenance {
  const counts = createEmptyRiskLifecycleRuleMergeProvenance();

  for (const notice of getAuditPreflightItems(audit)) {
    if (!noticeMatchesRule(audit, mergedCandidates, notice, ruleId)) continue;
    counts.preflightNoticeCount += 1;
    incrementMergeProvenanceKindCounts(counts.preflight, notice.kind);
  }

  for (const notice of getAuditMergeReceipts(audit)) {
    if (!noticeMatchesRule(audit, mergedCandidates, notice, ruleId)) continue;
    counts.receiptNoticeCount += 1;
    incrementMergeProvenanceKindCounts(counts.receipt, notice.kind);
  }

  return counts;
}

function accumulateRiskLifecycleRuleMergeProvenance(
  target: IntentE2EInsightRiskLifecycleRuleMergeProvenance,
  source: IntentE2EInsightRiskLifecycleRuleMergeProvenance
) {
  target.preflightNoticeCount += source.preflightNoticeCount;
  target.receiptNoticeCount += source.receiptNoticeCount;

  target.preflight.autoPromoteCount += source.preflight.autoPromoteCount;
  target.preflight.observeCount += source.preflight.observeCount;
  target.preflight.blockDefaultMergeCount += source.preflight.blockDefaultMergeCount;
  target.preflight.overrideCount += source.preflight.overrideCount;
  target.preflight.riskAcknowledgementCount += source.preflight.riskAcknowledgementCount;
  target.preflight.guardrailCount += source.preflight.guardrailCount;
  target.preflight.auditCount += source.preflight.auditCount;

  target.receipt.autoPromoteCount += source.receipt.autoPromoteCount;
  target.receipt.observeCount += source.receipt.observeCount;
  target.receipt.blockDefaultMergeCount += source.receipt.blockDefaultMergeCount;
  target.receipt.overrideCount += source.receipt.overrideCount;
  target.receipt.riskAcknowledgementCount += source.receipt.riskAcknowledgementCount;
  target.receipt.guardrailCount += source.receipt.guardrailCount;
  target.receipt.auditCount += source.receipt.auditCount;
}

function resolveRecentRiskLifecycleRuleMergeProvenance(
  events: Array<{ occurredAt: string; mergeProvenance: IntentE2EInsightRiskLifecycleRuleMergeProvenance }>,
  options: {
    auditWindowSize?: number;
    dayWindowSize?: number;
    nowMs?: number;
  } = {}
): IntentE2EInsightRiskLifecycleRuleRecentMergeProvenance {
  const auditWindowSize = Math.max(1, Math.floor(options.auditWindowSize || RISK_LIFECYCLE_RECENT_MERGE_AUDIT_WINDOW));
  const dayWindowSize = Math.max(1, Math.floor(options.dayWindowSize || RISK_LIFECYCLE_RECENT_MERGE_DAY_WINDOW));
  const recent = createEmptyRecentRiskLifecycleRuleMergeProvenance(auditWindowSize, dayWindowSize);
  if (events.length === 0) return recent;

  const resolvedNowMs = Number.isFinite(options.nowMs) ? Number(options.nowMs) : Date.now();
  const recentCutoffMs = resolvedNowMs - dayWindowSize * DAY_IN_MS;
  const sorted = [...events].sort(
    (a, b) =>
      toTimestamp(b.occurredAt) - toTimestamp(a.occurredAt) ||
      (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0)
  );
  const timeWindowSelected = sorted.filter((event) => {
    const occurredAtMs = toTimestamp(event.occurredAt);
    return occurredAtMs >= recentCutoffMs;
  });
  const selected =
    timeWindowSelected.length > 0 ? timeWindowSelected : sorted.slice(0, Math.max(1, Math.floor(auditWindowSize)));

  recent.consideredAuditCount = selected.length;
  recent.windowMode = timeWindowSelected.length > 0 ? 'time_window' : 'audit_count_fallback';
  recent.windowLabel = buildRecentRiskLifecycleRuleMergeWindowLabel({
    auditWindowSize,
    dayWindowSize,
    consideredAuditCount: recent.consideredAuditCount,
    windowMode: recent.windowMode,
  });
  for (const event of selected) {
    accumulateRiskLifecycleRuleMergeProvenance(recent.mergeProvenance, event.mergeProvenance);
  }

  return recent;
}

function buildRiskLifecycleProvenanceReason(
  provenance: IntentE2EInsightRiskLifecycleRuleMergeProvenance,
  label = '结构化 provenance'
): string {
  const parts: string[] = [];

  if (provenance.preflight.autoPromoteCount > 0) {
    parts.push(`自动晋升 ${provenance.preflight.autoPromoteCount} 次`);
  }
  if (provenance.preflight.observeCount > 0) {
    parts.push(`继续观察 ${provenance.preflight.observeCount} 次`);
  }
  if (provenance.preflight.blockDefaultMergeCount > 0) {
    parts.push(`默认阻断 ${provenance.preflight.blockDefaultMergeCount} 次`);
  }
  if (provenance.preflight.overrideCount > 0) {
    parts.push(`预检 override ${provenance.preflight.overrideCount} 次`);
  }
  if (provenance.preflight.riskAcknowledgementCount > 0) {
    parts.push(`预检风险确认 ${provenance.preflight.riskAcknowledgementCount} 次`);
  }
  if (provenance.receipt.overrideCount > 0) {
    parts.push(`override 回执 ${provenance.receipt.overrideCount} 次`);
  }
  if (provenance.receipt.riskAcknowledgementCount > 0) {
    parts.push(`风险确认回执 ${provenance.receipt.riskAcknowledgementCount} 次`);
  }
  if (provenance.receipt.guardrailCount > 0) {
    parts.push(`护栏回执 ${provenance.receipt.guardrailCount} 次`);
  }
  if (provenance.receipt.auditCount > 0) {
    parts.push(`审计回执 ${provenance.receipt.auditCount} 次`);
  }

  return parts.length > 0 ? `${label}：${parts.join('，')}。` : '';
}

function buildMergeProvenanceStats(
  audits: IntentProjectKnowledgeAuditEntry[],
  limit = 8
): IntentE2EInsightMergeProvenanceStat[] {
  const stageRank = { preflight: 0, receipt: 1 } satisfies Record<IntentE2EInsightMergeProvenanceStage, number>;
  const kindRank = {
    block_default_merge: 0,
    override: 1,
    risk_acknowledgement: 2,
    guardrail: 3,
    audit: 4,
    observe: 5,
    auto_promote: 6,
  } satisfies Record<IntentProjectKnowledgeAuditNotice['kind'], number>;
  const aggregates = new Map<
    string,
    {
      stage: IntentE2EInsightMergeProvenanceStage;
      kind: IntentProjectKnowledgeAuditNotice['kind'];
      level: IntentProjectKnowledgeAuditNotice['level'];
      provenanceType: IntentProjectKnowledgeAuditNotice['provenanceType'];
      title: string;
      operations: Set<IntentProjectKnowledgeAuditOperation>;
      auditIds: Set<string>;
      candidateIds: Set<string>;
      ruleIds: Set<string>;
      itemCount: number;
      latestOccurredAt: string;
    }
  >();

  const collect = (stage: IntentE2EInsightMergeProvenanceStage, audit: IntentProjectKnowledgeAuditEntry, items: IntentProjectKnowledgeAuditNotice[]) => {
    for (const item of items) {
      const key = `${stage}:${item.kind}:${item.provenanceType}`;
      const current = aggregates.get(key) || {
        stage,
        kind: item.kind,
        level: item.level,
        provenanceType: item.provenanceType,
        title: item.title,
        operations: new Set<IntentProjectKnowledgeAuditOperation>(),
        auditIds: new Set<string>(),
        candidateIds: new Set<string>(),
        ruleIds: new Set<string>(),
        itemCount: 0,
        latestOccurredAt: '',
      };

      current.level = item.level;
      current.title = current.title || item.title;
      current.operations.add(audit.operation);
      current.itemCount += 1;
      current.auditIds.add(audit.auditId);
      item.candidateIds.forEach((candidateId) => current.candidateIds.add(candidateId));
      item.ruleIds.forEach((ruleId) => current.ruleIds.add(ruleId));

      if (toTimestamp(audit.occurredAt) >= toTimestamp(current.latestOccurredAt)) {
        current.latestOccurredAt = audit.occurredAt;
      }

      aggregates.set(key, current);
    }
  };

  for (const audit of audits) {
    collect('preflight', audit, getAuditPreflightItems(audit));
    collect('receipt', audit, getAuditMergeReceipts(audit));
  }

  return [...aggregates.entries()]
    .map(([key, current]) => ({
      key,
      operations: [...current.operations],
      stage: current.stage,
      kind: current.kind,
      level: current.level,
      provenanceType: current.provenanceType,
      title: current.title,
      auditCount: current.auditIds.size,
      itemCount: current.itemCount,
      candidateCount: current.candidateIds.size,
      ruleCount: current.ruleIds.size,
      latestOccurredAt: current.latestOccurredAt,
      supportingAuditIds: [...current.auditIds],
    }))
    .sort(
      (a, b) =>
        stageRank[a.stage] - stageRank[b.stage] ||
        (a.level === 'warning' ? 0 : 1) - (b.level === 'warning' ? 0 : 1) ||
        b.auditCount - a.auditCount ||
        b.itemCount - a.itemCount ||
        kindRank[a.kind] - kindRank[b.kind] ||
        toTimestamp(b.latestOccurredAt) - toTimestamp(a.latestOccurredAt) ||
        a.key.localeCompare(b.key)
    )
    .slice(0, Math.max(1, Math.floor(limit || 8)));
}

function filterRunsForAuditScope(runs: InsightRunRecord[], audit: IntentProjectKnowledgeAuditEntry): InsightRunRecord[] {
  const requestedModuleUid = getAuditRequestedModuleUid(audit);
  return runs.filter(
    (run) =>
      (!audit.projectUid || run.projectUid === audit.projectUid) &&
      (!requestedModuleUid || run.moduleUid === requestedModuleUid)
  );
}

function roundRateDelta(beforeRate: number, afterRate: number): number {
  return Math.round((beforeRate - afterRate) * 10) / 10;
}

function classifyMergeImpactStatus(terminalPassRateDelta: number, firstPassRateDelta: number): IntentE2EInsightMergeImpactStatus {
  if (terminalPassRateDelta >= 15 || firstPassRateDelta >= 15) {
    return 'regressing';
  }
  if (terminalPassRateDelta <= -15 || firstPassRateDelta <= -15) {
    return 'improving';
  }
  return 'neutral';
}

function getAuditAffectedRuleIds(audit: IntentProjectKnowledgeAuditEntry): string[] {
  return uniqueStrings([
    ...audit.comparison.addedRuleIds,
    ...audit.comparison.removedRuleIds,
    ...audit.comparison.updatedRuleIds,
  ]);
}

function hasMeaningfulKnowledgeChangeAudit(audit: IntentProjectKnowledgeAuditEntry): boolean {
  if (audit.operation === 'merge') {
    return audit.comparison.addedRuleIds.length > 0;
  }

  return (
    getAuditAffectedRuleIds(audit).length > 0 ||
    getAuditPreflightItems(audit).length > 0 ||
    getAuditMergeReceipts(audit).length > 0 ||
    Boolean(getAuditRestoredFrom(audit))
  );
}

function resolveKnowledgeChangeEfficacyStatus(
  operation: IntentProjectKnowledgeAuditOperation,
  impactStatus: IntentE2EInsightMergeImpactStatus,
  afterRuns: number,
  afterPassRate: number,
  afterFirstPassRate: number
): IntentE2EInsightKnowledgeChangeEfficacyStatus {
  if (afterRuns < KNOWLEDGE_CHANGE_DECISION_RUNS) {
    return 'watching';
  }

  if (operation === 'restore') {
    if (impactStatus === 'improving') {
      return 'recovered';
    }
    if (impactStatus === 'regressing' || afterPassRate <= 35 || afterFirstPassRate <= 35) {
      return 'still_abnormal';
    }
    return 'watching';
  }

  if (impactStatus === 'improving') {
    return 'improving';
  }
  if (impactStatus === 'regressing') {
    return 'regressing';
  }
  return 'neutral';
}

function buildKnowledgeChangeRecommendation(input: {
  audit: IntentProjectKnowledgeAuditEntry;
  efficacyStatus: IntentE2EInsightKnowledgeChangeEfficacyStatus;
  evidenceLevel: IntentE2EInsightKnowledgeChangeEvidenceLevel;
  beforeRuns: number;
  beforePassRate: number;
  beforeFirstPassRate: number;
  afterRuns: number;
  afterPassRate: number;
  afterFirstPassRate: number;
  mergedCandidateSources: string[];
  preflightNoticeCount: number;
  receiptNoticeCount: number;
}): string {
  const scopeSummary = getAuditRequestedModuleUid(input.audit)
    ? `模块 ${getAuditRequestedModuleUid(input.audit)}`
    : input.audit.projectUid
    ? `项目 ${input.audit.projectUid}`
    : '当前全局';
  const rateSummary = `终态通过率 ${input.beforePassRate}% -> ${input.afterPassRate}%；首次通过率 ${input.beforeFirstPassRate}% -> ${input.afterFirstPassRate}%`;
  const provenanceSummary = `结构化预检 ${input.preflightNoticeCount} 条，结构化回执 ${input.receiptNoticeCount} 条`;
  const sourceSummary =
    input.audit.operation === 'merge'
      ? input.mergedCandidateSources.length > 0
        ? `来源 ${input.mergedCandidateSources.join(' / ')}`
        : '来源未标记'
      : getAuditRestoredFrom(input.audit)
      ? `恢复来源 ${getAuditRestoredFrom(input.audit)}`
      : '恢复来源未标记';

  if (input.audit.operation === 'restore') {
    if (input.efficacyStatus === 'recovered') {
      return `该次回滚后，${scopeSummary} 最近 ${input.afterRuns} 次运行中，${rateSummary}；${provenanceSummary}；${sourceSummary}，可视为 restore 已产生恢复效果。`;
    }
    if (input.efficacyStatus === 'still_abnormal') {
      return `该次回滚后，${scopeSummary} 最近 ${input.afterRuns} 次运行中，${rateSummary}；${provenanceSummary}；${sourceSummary}，说明回滚后仍异常，问题可能不只来自被恢复规则。`;
    }
    return `该次回滚后，${scopeSummary} 仅观察到 ${input.afterRuns} 次终态运行；当前 ${rateSummary}；${provenanceSummary}；${sourceSummary}，暂作为早期恢复信号继续观察。`;
  }

  if (input.efficacyStatus === 'improving') {
    return `该次合并后，${scopeSummary} 最近 ${input.afterRuns} 次运行中，${rateSummary}；${provenanceSummary}；${sourceSummary}，可作为正向 merge 证据继续累计。`;
  }
  if (input.efficacyStatus === 'regressing') {
    return `该次合并后，${scopeSummary} 最近 ${input.afterRuns} 次运行中，${rateSummary}；${provenanceSummary}；${sourceSummary}，已形成负向 merge 证据，建议暂停扩散并评估回滚。`;
  }
  if (input.efficacyStatus === 'neutral') {
    return `该次合并后，${scopeSummary} 最近 ${input.afterRuns} 次运行中，${rateSummary}；${provenanceSummary}；${sourceSummary}，暂未出现明确正负变化。`;
  }
  return `该次合并后，${scopeSummary} 仅观察到 ${input.afterRuns} 次终态运行；当前 ${rateSummary}；${provenanceSummary}；${sourceSummary}，暂作为早期信号继续观察。`;
}

function pickFinishedAt(snapshot: IntentE2ERunSnapshotRecord): { finishedAt: string; finishedAtMs: number } {
  const finishedAt = snapshot.endedAt || snapshot.updatedAt || snapshot.createdAt;
  return {
    finishedAt,
    finishedAtMs: toTimestamp(finishedAt),
  };
}

function normalizeTerminalRun(snapshot: IntentE2ERunSnapshotRecord): InsightRunRecord | null {
  if (snapshot.status !== 'passed' && snapshot.status !== 'failed' && snapshot.status !== 'canceled') {
    return null;
  }

  const state = snapshot.state && typeof snapshot.state === 'object' && !Array.isArray(snapshot.state)
      ? (snapshot.state as {
        result?: {
          scenarioCard?: unknown;
          description?: unknown;
          assetReadiness?: unknown;
          qualitySplit?: unknown;
          executionPlan?: {
            matchedRecipeSlugs?: unknown;
          } | null;
          verificationPlan?: {
            intent?: unknown;
            matchedRecipeSlugs?: unknown;
            expectedOutcome?: unknown;
            checks?: unknown;
          } | null;
          compiledTemplate?: {
            slots?: unknown;
          } | null;
          knowledge?: {
            matchedRuleIds?: unknown;
            matchedRuleTitles?: unknown;
            suggestedHelpers?: unknown;
          } | null;
          attempts?: Array<{
            attempt?: unknown;
            kind?: unknown;
            result?: {
              success?: unknown;
            } | null;
            helperUsage?: {
              usedHelpers?: unknown;
              usedSuggestedHelpers?: unknown;
            } | null;
            structuredPatch?: {
              strategy?: unknown;
              targetSlotUids?: unknown;
              returnedSlotUids?: unknown;
              reusedPreviousCode?: unknown;
              baseCodeSource?: unknown;
            } | null;
            repairOutput?: {
              observationTags?: unknown;
              observationSummary?: unknown;
              patchedVerifier?: {
                checkUids?: unknown;
              } | null;
              patchedRecipeSelection?: {
                recipeSlugs?: unknown;
              } | null;
            } | null;
            triage?: {
              failureClass?: unknown;
            } | null;
            logs?: unknown;
          }> | null;
          finalResult?: {
            success?: unknown;
            error?: unknown;
            steps?: unknown;
          } | null;
          finalFailureTriage?: {
            failureClass?: unknown;
            repairable?: unknown;
            summary?: unknown;
          } | null;
        } | null;
      })
    : {};
  const result = state.result && typeof state.result === 'object' ? state.result : null;
  const resultPlatformMeta = result as
    | {
        testType?: unknown;
        runnerType?: unknown;
        verificationContract?: {
          typeFields?: {
            policyNotes?: unknown;
          } | null;
        } | null;
      }
    | null;
  const scenarioCard =
    result?.scenarioCard && typeof result.scenarioCard === 'object' && !Array.isArray(result.scenarioCard)
      ? (result.scenarioCard as {
          title?: unknown;
          taskMode?: unknown;
          featureDescription?: unknown;
          flowDefinition?: {
            steps?: unknown;
          } | null;
        })
      : null;
  const knowledge = result?.knowledge && typeof result.knowledge === 'object' ? result.knowledge : null;
  const attempts = Array.isArray(result?.attempts) ? result?.attempts || [] : [];
  const taskMode = normalizeScenarioTaskMode(scenarioCard?.taskMode);
  const steps = Array.isArray(scenarioCard?.flowDefinition?.steps) ? scenarioCard?.flowDefinition?.steps || [] : [];
  const stepTypes = extractScenarioStepTypes(steps);
  const stepCount = steps.length;
  const scenarioFamily = classifyIntentE2EScenarioFamily({
    requestInput: snapshot.requestInput,
    targetUrl: snapshot.targetUrl,
    scenarioCard: scenarioCard,
    description: typeof result?.description === 'string' ? result.description : '',
  });
  const priorityScenarioFamily = classifyIntentE2EPriorityScenarioFamily({
    requestInput: snapshot.requestInput,
    targetUrl: snapshot.targetUrl,
    scenarioCard: scenarioCard,
    description: typeof result?.description === 'string' ? result.description : '',
  });
  const verificationIntent = resolveVerificationIntent({
    verificationPlanIntent:
      result?.verificationPlan && typeof result.verificationPlan === 'object' ? result.verificationPlan.intent : undefined,
    scenarioFeatureDescription: scenarioCard?.featureDescription,
    description: result?.description,
  });
  const targetPath = normalizeTargetPath(snapshot.targetUrl);
  const compiledSlotUids =
    result?.compiledTemplate && typeof result.compiledTemplate === 'object' && Array.isArray(result.compiledTemplate.slots)
      ? uniqueStrings(
          (result.compiledTemplate.slots as Array<{ slotUid?: unknown }>)
            .map((slot) => (typeof slot?.slotUid === 'string' ? slot.slotUid : ''))
        )
      : [];
  const matchedRecipeSlugs = uniqueStrings([
    ...(result?.executionPlan &&
    typeof result.executionPlan === 'object' &&
    Array.isArray(result.executionPlan.matchedRecipeSlugs)
      ? (result.executionPlan.matchedRecipeSlugs as string[])
      : []),
    ...(result?.verificationPlan &&
    typeof result.verificationPlan === 'object' &&
    Array.isArray(result.verificationPlan.matchedRecipeSlugs)
      ? (result.verificationPlan.matchedRecipeSlugs as string[])
      : []),
  ]);
  const matchedRuleIds = Array.isArray(knowledge?.matchedRuleIds) ? uniqueStrings(knowledge?.matchedRuleIds as string[]) : [];
  const matchedRuleTitles = Array.isArray(knowledge?.matchedRuleTitles) ? uniqueStrings(knowledge?.matchedRuleTitles as string[]) : [];
  const assetReadiness = normalizeIntentE2EAssetReadiness(
    result?.assetReadiness,
    {
      projectUid: snapshot.projectUid,
      knowledgeMatchCount: matchedRuleIds.length,
    }
  );
  const matchedStarterHelpers =
    knowledge &&
    typeof knowledge === 'object' &&
    Array.isArray((knowledge as { starterAssets?: unknown }).starterAssets)
      ? uniqueStrings(
          ((knowledge as { starterAssets?: Array<{ helper?: unknown }> }).starterAssets || []).map((item) =>
            typeof item?.helper === 'string' ? item.helper : ''
          )
        )
      : [];
  const normalizedAttempts = attempts.map((attempt, index) => {
    const usage = attempt?.helperUsage && typeof attempt.helperUsage === 'object' ? attempt.helperUsage : null;
    const structuredPatch = attempt?.structuredPatch && typeof attempt.structuredPatch === 'object' ? attempt.structuredPatch : null;
    const repairOutput =
      attempt?.repairOutput && typeof attempt.repairOutput === 'object' && !Array.isArray(attempt.repairOutput)
        ? attempt.repairOutput
        : null;
    const baseCodeSource: IntentE2EInsightRecentTraceAttempt['baseCodeSource'] =
      typeof structuredPatch?.baseCodeSource === 'string' &&
      (structuredPatch.baseCodeSource === 'compiled_template' || structuredPatch.baseCodeSource === 'previous_code')
        ? structuredPatch.baseCodeSource
        : 'unknown';
    const patchedVerifierCheckUids =
      repairOutput?.patchedVerifier &&
      typeof repairOutput.patchedVerifier === 'object' &&
      Array.isArray(repairOutput.patchedVerifier.checkUids)
        ? uniqueStrings(repairOutput.patchedVerifier.checkUids as string[])
        : [];
    const patchedRecipeSlugs =
      repairOutput?.patchedRecipeSelection &&
      typeof repairOutput.patchedRecipeSelection === 'object' &&
      Array.isArray(repairOutput.patchedRecipeSelection.recipeSlugs)
        ? uniqueStrings(repairOutput.patchedRecipeSelection.recipeSlugs as string[])
        : [];
    const repairObservationSummary = summarizeIntentExecutionRepairObservationArtifact(
      repairOutput
        ? {
            observationTags: Array.isArray(repairOutput.observationTags) ? (repairOutput.observationTags as string[]) : [],
            observationSummary:
              typeof repairOutput.observationSummary === 'string' ? repairOutput.observationSummary : undefined,
          }
        : null
    );
    return {
      attempt:
        typeof attempt?.attempt === 'number' && Number.isFinite(attempt.attempt)
          ? Math.max(1, Math.floor(attempt.attempt))
          : index + 1,
      kind: normalizeTraceAttemptKind(attempt?.kind),
      outcome: normalizeTraceAttemptOutcome(attempt?.result?.success),
      failureClass:
        attempt?.triage && typeof attempt.triage.failureClass === 'string' ? attempt.triage.failureClass.trim() : '',
      usedHelpers: Array.isArray(usage?.usedHelpers) ? uniqueStrings(usage?.usedHelpers as string[]) : [],
      usedSuggestedHelpers: Array.isArray(usage?.usedSuggestedHelpers) ? uniqueStrings(usage?.usedSuggestedHelpers as string[]) : [],
      keySignals: extractTraceSignals(attempt?.logs),
      structuredPatchStrategy:
        typeof structuredPatch?.strategy === 'string' ? structuredPatch.strategy.trim() : '',
      targetSlotUids: Array.isArray(structuredPatch?.targetSlotUids)
        ? uniqueStrings(structuredPatch?.targetSlotUids as string[])
        : [],
      returnedSlotUids: Array.isArray(structuredPatch?.returnedSlotUids)
        ? uniqueStrings(structuredPatch?.returnedSlotUids as string[])
        : [],
      reusedPreviousCode: structuredPatch?.reusedPreviousCode === true,
      baseCodeSource,
      patchedRecipeSlugs,
      patchedVerifierCheckUids,
      repairObservationSummary,
    };
  });
  const responseEvents = normalizedAttempts.flatMap((attemptRecord, index) =>
    extractTraceResponseEvents(attempts[index]?.logs, attemptRecord.attempt)
  );
  const finalFailureSummary =
    result?.finalFailureTriage && typeof result.finalFailureTriage.summary === 'string'
      ? result.finalFailureTriage.summary.trim()
      : '';
  const finalResultError =
    result?.finalResult && typeof result.finalResult.error === 'string' ? result.finalResult.error.trim() : '';
  const finalFailureRepairable =
    result?.finalFailureTriage && typeof result.finalFailureTriage.repairable === 'boolean'
      ? result.finalFailureTriage.repairable
      : null;
  const finalResultPayload =
    result?.finalResult && typeof result.finalResult === 'object' && !Array.isArray(result.finalResult) ? result.finalResult : null;
  const verificationPlanPayload: {
    expectedOutcome?: unknown;
    checks?: unknown;
    policyNotes?: unknown;
  } | null =
    result?.verificationPlan && typeof result.verificationPlan === 'object' && !Array.isArray(result.verificationPlan)
      ? result.verificationPlan
      : null;
  const verificationPolicyNotes = uniqueStrings([
    ...(resultPlatformMeta?.verificationContract?.typeFields &&
    Array.isArray(resultPlatformMeta.verificationContract.typeFields.policyNotes)
      ? (resultPlatformMeta.verificationContract.typeFields.policyNotes as string[])
      : []),
    ...(Array.isArray(verificationPlanPayload?.policyNotes) ? (verificationPlanPayload?.policyNotes as string[]) : []),
  ]);
  const fallbackFailureClass =
    snapshot.status === 'passed'
      ? ''
      : [...normalizedAttempts].reverse().find((attempt) => attempt.failureClass)?.failureClass || '';
  const finalFailureClass =
    result?.finalFailureTriage && typeof result.finalFailureTriage.failureClass === 'string'
      ? result.finalFailureTriage.failureClass.trim()
      : fallbackFailureClass;
  const testType = normalizePlatformTestType(resultPlatformMeta?.testType) || DEFAULT_INTENT_E2E_TEST_TYPE;
  const runnerType = normalizePlatformRunnerType(resultPlatformMeta?.runnerType) || DEFAULT_INTENT_E2E_RUNNER_TYPE;
  const qualitySplit = normalizeIntentE2EQualitySplit(result?.qualitySplit, {
    status: snapshot.status,
    failureClass: finalFailureClass,
  });
  const { finishedAt, finishedAtMs } = pickFinishedAt(snapshot);
  const firstAttempt = normalizedAttempts[0];
  const firstPassSucceeded =
    snapshot.status === 'passed' &&
    firstAttempt &&
    firstAttempt.kind === 'generate' &&
    firstAttempt.outcome === 'passed';
  const repairedSucceeded =
    snapshot.status === 'passed' &&
    normalizedAttempts.some((attempt) => attempt.kind === 'repair' && attempt.outcome === 'passed');

  return {
    runId: snapshot.runId,
    testType,
    runnerType,
    verificationPolicyNotes,
    projectUid: snapshot.projectUid,
    moduleUid: snapshot.moduleUid || '',
    status: snapshot.status,
    finishedAt,
    finishedAtMs,
    requestInput: snapshot.requestInput,
    targetUrl: snapshot.targetUrl,
    targetPath,
    scenarioTitle:
      typeof scenarioCard?.title === 'string' && scenarioCard.title.trim() ? scenarioCard.title.trim() : snapshot.requestInput.trim(),
    scenarioFamily,
    priorityScenarioFamily,
    verificationIntent,
    taskMode,
    stepCount,
    stepTypes,
    snapshotSignature: buildTraceSnapshotSignature({
      scenarioFamily,
      taskMode,
      targetPath,
      stepTypes,
    }),
    compiledSlotCount: compiledSlotUids.length,
    compiledSlotUids,
    matchedRecipeSlugs,
    assetReadiness,
    qualitySplit,
    matchedRuleIds,
    matchedRuleTitles,
    matchedStarterHelpers,
    suggestedHelpers: Array.isArray(knowledge?.suggestedHelpers) ? uniqueStrings(knowledge?.suggestedHelpers as string[]) : [],
    usedHelpers: uniqueStrings(normalizedAttempts.flatMap((item) => item.usedHelpers)),
    usedSuggestedHelpers: uniqueStrings(normalizedAttempts.flatMap((item) => item.usedSuggestedHelpers)),
    firstPassSucceeded,
    repairedSucceeded,
    keySignals: uniqueStrings(normalizedAttempts.flatMap((item) => item.keySignals)),
    responseEvents,
    verifierResult: buildTraceVerifierResult({
      verificationPlan: verificationPlanPayload,
      finalResult: finalResultPayload,
    }),
    finalGraderResult: buildTraceFinalGraderResult({
      status: snapshot.status,
      failureClass: finalFailureClass,
      finalFailureSummary,
      repairable: finalFailureRepairable,
      finalResultError,
    }),
    structuredPatchAttempted: normalizedAttempts.some((attempt) => Boolean(attempt.structuredPatchStrategy)),
    targetedRepairAttempted: normalizedAttempts.some(
      (attempt) =>
        attempt.kind === 'repair' &&
        attempt.baseCodeSource === 'previous_code' &&
        attempt.targetSlotUids.length > 0
    ),
    patchedSlotUids: uniqueStrings(normalizedAttempts.flatMap((attempt) => attempt.returnedSlotUids)),
    failureClass: finalFailureClass,
    attempts: normalizedAttempts,
  };
}

export function normalizeIntentE2ETerminalRunSnapshot(
  snapshot: IntentE2ERunSnapshotRecord
): IntentE2EInsightRunRecord | null {
  return normalizeTerminalRun(snapshot);
}

function buildRuleStats(runs: InsightRunRecord[]): IntentE2EInsightRuleStat[] {
  const stats = new Map<string, { title: string; runIds: Set<string>; passedRunIds: Set<string> }>();

  for (const run of runs) {
    run.matchedRuleIds.forEach((ruleId, index) => {
      const current = stats.get(ruleId) || {
        title: run.matchedRuleTitles[index] || ruleId,
        runIds: new Set<string>(),
        passedRunIds: new Set<string>(),
      };
      current.title = current.title || run.matchedRuleTitles[index] || ruleId;
      current.runIds.add(run.runId);
      if (run.status === 'passed') {
        current.passedRunIds.add(run.runId);
      }
      stats.set(ruleId, current);
    });
  }

  return [...stats.entries()]
    .map(([ruleId, current]) => ({
      ruleId,
      title: current.title || ruleId,
      runCount: current.runIds.size,
      passedRuns: current.passedRunIds.size,
      passRate: toPercent(current.passedRunIds.size, current.runIds.size),
    }))
    .sort((a, b) => b.runCount - a.runCount || b.passRate - a.passRate || a.ruleId.localeCompare(b.ruleId))
    .slice(0, 5);
}

function buildRuleTitleMap(runs: InsightRunRecord[]): Map<string, string> {
  const titles = new Map<string, string>();

  for (const run of runs) {
    run.matchedRuleIds.forEach((ruleId, index) => {
      if (titles.has(ruleId)) return;
      const title = run.matchedRuleTitles[index] || ruleId;
      titles.set(ruleId, title);
    });
  }

  return titles;
}

function buildHelperStats(runs: InsightRunRecord[]): IntentE2EInsightHelperStat[] {
  const stats = new Map<string, { runIds: Set<string>; passedRunIds: Set<string>; suggestedReuseRunIds: Set<string> }>();

  for (const run of runs) {
    for (const helper of run.usedHelpers) {
      const current = stats.get(helper) || {
        runIds: new Set<string>(),
        passedRunIds: new Set<string>(),
        suggestedReuseRunIds: new Set<string>(),
      };
      current.runIds.add(run.runId);
      if (run.status === 'passed') {
        current.passedRunIds.add(run.runId);
      }
      if (run.usedSuggestedHelpers.includes(helper)) {
        current.suggestedReuseRunIds.add(run.runId);
      }
      stats.set(helper, current);
    }
  }

  return [...stats.entries()]
    .map(([helper, current]) => ({
      helper,
      runCount: current.runIds.size,
      passedRuns: current.passedRunIds.size,
      passRate: toPercent(current.passedRunIds.size, current.runIds.size),
      suggestedReuseRuns: current.suggestedReuseRunIds.size,
    }))
    .sort((a, b) => b.runCount - a.runCount || b.passRate - a.passRate || a.helper.localeCompare(b.helper))
    .slice(0, 5);
}

function buildScenarioFamilyStats(runs: InsightRunRecord[]): IntentE2EInsightScenarioFamilyStat[] {
  const stats = new Map<
    IntentE2EScenarioFamily,
    {
      runIds: Set<string>;
      passedRunIds: Set<string>;
      failedRunIds: Set<string>;
      canceledRunIds: Set<string>;
      firstPassRunIds: Set<string>;
      repairedRunIds: Set<string>;
    }
  >();

  for (const run of runs) {
    const current = stats.get(run.scenarioFamily) || {
      runIds: new Set<string>(),
      passedRunIds: new Set<string>(),
      failedRunIds: new Set<string>(),
      canceledRunIds: new Set<string>(),
      firstPassRunIds: new Set<string>(),
      repairedRunIds: new Set<string>(),
    };
    current.runIds.add(run.runId);
    if (run.status === 'passed') {
      current.passedRunIds.add(run.runId);
    } else if (run.status === 'failed') {
      current.failedRunIds.add(run.runId);
    } else if (run.status === 'canceled') {
      current.canceledRunIds.add(run.runId);
    }
    if (run.firstPassSucceeded) {
      current.firstPassRunIds.add(run.runId);
    }
    if (run.repairedSucceeded) {
      current.repairedRunIds.add(run.runId);
    }
    stats.set(run.scenarioFamily, current);
  }

  return [...stats.entries()]
    .map(([family, current]) => ({
      family,
      label: SCENARIO_FAMILY_LABELS[family] || family,
      totalRuns: current.runIds.size,
      passedRuns: current.passedRunIds.size,
      failedRuns: current.failedRunIds.size,
      canceledRuns: current.canceledRunIds.size,
      firstPassPassedRuns: current.firstPassRunIds.size,
      firstPassPassRate: toPercent(current.firstPassRunIds.size, current.runIds.size),
      repairedPassRuns: current.repairedRunIds.size,
      repairedPassRate: toPercent(current.repairedRunIds.size, current.runIds.size),
      terminalPassRate: toPercent(current.passedRunIds.size, current.runIds.size),
    }))
    .sort((a, b) => b.totalRuns - a.totalRuns || b.terminalPassRate - a.terminalPassRate || a.label.localeCompare(b.label));
}

function scenarioFamilySloRank(family: IntentE2EScenarioFamily): number {
  switch (family) {
    case 'page_task':
      return 0;
    case 'simple_scenario':
      return 1;
    case 'complex_enterprise_flow':
      return 2;
    default:
      return 3;
  }
}

function formatInsightRateValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
}

function buildScenarioFamilySloRecommendation(item: IntentE2EInsightScenarioFamilySloItem): string {
  if (item.status === 'insufficient_data') {
    return `当前仅 ${item.totalRuns} 次终态运行，先补足到 ${item.minRuns} 次再做 SLO 判定。`;
  }

  if (item.status === 'meeting') {
    return '当前已达到场景族 SLO，继续用固定评测集与 recent trace 盯回归即可。';
  }

  if (item.status === 'at_risk') {
    if (item.firstPassGap > 0 && item.terminalGap <= 0) {
      return `终态已达标，但首轮通过率还差 ${formatInsightRateValue(item.firstPassGap)}%，下一轮优先消化首轮不稳定点。`;
    }

    if (item.terminalGap > 0 && item.firstPassGap <= 0) {
      return `首轮通过率已达标，但终态通过率还差 ${formatInsightRateValue(item.terminalGap)}%，先压 repair 后仍失败的 run。`;
    }

    return `当前已接近目标，首轮还差 ${formatInsightRateValue(item.firstPassGap)}%，终态还差 ${formatInsightRateValue(item.terminalGap)}%。`;
  }

  return `首轮通过率还差 ${formatInsightRateValue(item.firstPassGap)}%，终态通过率还差 ${formatInsightRateValue(item.terminalGap)}%，暂不建议扩大覆盖面。`;
}

function buildScenarioFamilySloOverview(
  scenarioFamilies: IntentE2EInsightScenarioFamilyStat[],
  generatedFromRuns: number
): IntentE2EInsightScenarioFamilySloOverview {
  const items = scenarioFamilies
    .map((item) => {
      const target = SCENARIO_FAMILY_SLO_TARGETS[item.family] || SCENARIO_FAMILY_SLO_TARGETS.unknown;
      const firstPassGap = Math.max(0, roundMetric(target.targetFirstPassRate - item.firstPassPassRate));
      const terminalGap = Math.max(0, roundMetric(target.targetTerminalPassRate - item.terminalPassRate));
      let status: IntentE2EInsightScenarioFamilySloStatus = 'off_track';

      if (item.totalRuns < target.minRuns) {
        status = 'insufficient_data';
      } else if (firstPassGap <= 0 && terminalGap <= 0) {
        status = 'meeting';
      } else if (terminalGap <= 0 || (firstPassGap <= 5 && terminalGap <= 5)) {
        status = 'at_risk';
      }

      const nextItem: IntentE2EInsightScenarioFamilySloItem = {
        family: item.family,
        label: item.label,
        totalRuns: item.totalRuns,
        minRuns: target.minRuns,
        currentFirstPassRate: item.firstPassPassRate,
        currentTerminalPassRate: item.terminalPassRate,
        targetFirstPassRate: target.targetFirstPassRate,
        targetTerminalPassRate: target.targetTerminalPassRate,
        firstPassGap,
        terminalGap,
        status,
        recommendation: '',
      };

      return {
        ...nextItem,
        recommendation: buildScenarioFamilySloRecommendation(nextItem),
      };
    })
    .sort(
      (a, b) =>
        scenarioFamilySloRank(a.family) - scenarioFamilySloRank(b.family) ||
        b.totalRuns - a.totalRuns ||
        a.label.localeCompare(b.label)
    );

  return {
    generatedFromRuns,
    trackedFamilyCount: items.length,
    meetingCount: items.filter((item) => item.status === 'meeting').length,
    atRiskCount: items.filter((item) => item.status === 'at_risk').length,
    offTrackCount: items.filter((item) => item.status === 'off_track').length,
    insufficientDataCount: items.filter((item) => item.status === 'insufficient_data').length,
    items,
  };
}

function regressionWatchlistSourceRank(source: IntentE2EInsightRegressionWatchlistSource): number {
  switch (source) {
    case 'rollback_candidate':
      return 0;
    case 'evaluation_baseline':
      return 1;
    default:
      return 2;
  }
}

function regressionWatchlistSeverityRank(severity: IntentE2EInsightRegressionWatchlistSeverity): number {
  return severity === 'high' ? 0 : 1;
}

function buildRegressionWatchlist(input: {
  scenarioFamilySlo: IntentE2EInsightScenarioFamilySloOverview;
  evaluationBaseline: IntentE2EEvaluationBaseline;
  rollbackCandidates: IntentE2EInsightRollbackCandidate[];
  limit?: number;
}): IntentE2EInsightRegressionWatchlistOverview {
  const items: IntentE2EInsightRegressionWatchlistItem[] = [];

  for (const candidate of input.rollbackCandidates) {
    items.push({
      watchId: `rollback:${candidate.auditId}`,
      source: 'rollback_candidate',
      severity: 'high',
      title: `回滚观察：${candidate.title}`,
      summary: `merge 后 ${candidate.afterRuns} 次运行里，终态 ${formatInsightRateValue(candidate.afterPassRate)}% / 首次 ${formatInsightRateValue(
        candidate.afterFirstPassRate
      )}%；merge 前窗口为终态 ${formatInsightRateValue(candidate.beforePassRate)}% / 首次 ${formatInsightRateValue(candidate.beforeFirstPassRate)}%。`,
      recommendation: candidate.recommendation,
      latestObservedAt: candidate.occurredAt,
      runCount: candidate.afterRuns,
      currentFirstPassRate: candidate.afterFirstPassRate,
      currentTerminalPassRate: candidate.afterPassRate,
      compareLabel: 'merge 前窗口',
      compareFirstPassRate: candidate.beforeFirstPassRate,
      compareTerminalPassRate: candidate.beforePassRate,
      targetFirstPassRate: null,
      targetTerminalPassRate: null,
      sourceRef: candidate.auditId,
      relatedRuleIds: [...candidate.addedRuleIds],
      failureClasses: [],
    });
  }

  for (const item of input.evaluationBaseline.candidates) {
    if (item.priority !== 'p0' && item.priority !== 'p1') continue;
    if (item.failedRuns <= 0 && item.repairAttemptedRuns <= 0) continue;

    const severity: IntentE2EInsightRegressionWatchlistSeverity =
      item.priority === 'p0' && (item.failedRuns > 0 || item.terminalPassRate < 60 || item.firstPassPassRate < 40)
        ? 'high'
        : 'medium';
    const failureClasses = uniqueStrings(item.failureClasses.map((failure) => failure.failureClass));
    const title = item.representativeScenarioTitle || item.representativeRequestInput || item.evalCaseId;
    const failureSummary = failureClasses.length > 0 ? `主失败类 ${failureClasses.slice(0, 2).join(' / ')}` : '已出现失败或 repair 依赖';

    items.push({
      watchId: `eval:${item.evalCaseId}`,
      source: 'evaluation_baseline',
      severity,
      title,
      summary: `${item.scenarioFamilyLabel} · ${item.runCount} runs；终态 ${formatInsightRateValue(item.terminalPassRate)}% / 首次 ${formatInsightRateValue(
        item.firstPassPassRate
      )}%；失败 ${item.failedRuns} 次，repair ${item.repairAttemptedRuns} 次，${failureSummary}。`,
      recommendation: `优先把 ${item.evalCaseId} 作为固定回归入口，围绕 ${failureSummary} 回放最近代表运行。`,
      latestObservedAt: item.latestFinishedAt,
      runCount: item.runCount,
      currentFirstPassRate: item.firstPassPassRate,
      currentTerminalPassRate: item.terminalPassRate,
      compareLabel: '',
      compareFirstPassRate: null,
      compareTerminalPassRate: null,
      targetFirstPassRate: null,
      targetTerminalPassRate: null,
      sourceRef: item.evalCaseId,
      relatedRuleIds: [...item.matchedRuleIds],
      failureClasses,
    });
  }

  for (const item of input.scenarioFamilySlo.items) {
    if (item.status !== 'off_track' && item.status !== 'at_risk') continue;

    items.push({
      watchId: `slo:${item.family}`,
      source: 'scenario_family_slo',
      severity: item.status === 'off_track' ? 'high' : 'medium',
      title: item.status === 'off_track' ? `${item.label} 未达 SLO` : `${item.label} 接近 SLO 边界`,
      summary: `当前终态 ${formatInsightRateValue(item.currentTerminalPassRate)}% / 首次 ${formatInsightRateValue(
        item.currentFirstPassRate
      )}%；SLO 目标是终态 ${formatInsightRateValue(item.targetTerminalPassRate)}% / 首次 ${formatInsightRateValue(item.targetFirstPassRate)}%。`,
      recommendation: item.recommendation,
      latestObservedAt: '',
      runCount: item.totalRuns,
      currentFirstPassRate: item.currentFirstPassRate,
      currentTerminalPassRate: item.currentTerminalPassRate,
      compareLabel: 'SLO',
      compareFirstPassRate: item.targetFirstPassRate,
      compareTerminalPassRate: item.targetTerminalPassRate,
      targetFirstPassRate: item.targetFirstPassRate,
      targetTerminalPassRate: item.targetTerminalPassRate,
      sourceRef: item.family,
      relatedRuleIds: [],
      failureClasses: [],
    });
  }

  const limit = Math.max(1, Math.floor(input.limit || 8));
  const rankedItems = items
    .sort(
      (a, b) =>
        regressionWatchlistSeverityRank(a.severity) - regressionWatchlistSeverityRank(b.severity) ||
        regressionWatchlistSourceRank(a.source) - regressionWatchlistSourceRank(b.source) ||
        toTimestamp(b.latestObservedAt) - toTimestamp(a.latestObservedAt) ||
        b.runCount - a.runCount ||
        a.watchId.localeCompare(b.watchId)
    )
    .slice(0, limit);

  return {
    generatedFromRuns: input.scenarioFamilySlo.generatedFromRuns,
    totalItems: rankedItems.length,
    highSeverityCount: rankedItems.filter((item) => item.severity === 'high').length,
    mediumSeverityCount: rankedItems.filter((item) => item.severity === 'medium').length,
    items: rankedItems,
  };
}

function rolloutStrategyGateStatusRank(status: IntentE2EInsightRolloutStrategyGateStatus): number {
  switch (status) {
    case 'blocked':
      return 0;
    case 'warning':
      return 1;
    default:
      return 2;
  }
}

function rolloutStrategyGateSourceRank(source: IntentE2EInsightRolloutStrategyGateSource): number {
  switch (source) {
    case 'scenario_family_slo':
      return 0;
    case 'regression_watchlist':
      return 1;
    case 'risk_lifecycle_rule':
      return 2;
    default:
      return 3;
  }
}

export function buildIntentE2ERolloutStrategy(input: {
  scenarioFamilySlo: IntentE2EInsightScenarioFamilySloOverview;
  regressionWatchlist: IntentE2EInsightRegressionWatchlistOverview;
  riskLifecycleRules: IntentE2EInsightRiskLifecycleRule[];
  probationRules: IntentE2EInsightProbationRule[];
  rollbackCandidates: IntentE2EInsightRollbackCandidate[];
}): IntentE2EInsightRolloutStrategyOverview {
  const gates: IntentE2EInsightRolloutStrategyGate[] = [];

  const offTrackFamilies = input.scenarioFamilySlo.items.filter((item) => item.status === 'off_track');
  const atRiskFamilies = input.scenarioFamilySlo.items.filter((item) => item.status === 'at_risk');
  const insufficientDataFamilies = input.scenarioFamilySlo.items.filter((item) => item.status === 'insufficient_data');

  if (input.scenarioFamilySlo.trackedFamilyCount === 0) {
    gates.push({
      gateId: 'rollout:slo:empty',
      source: 'scenario_family_slo',
      status: 'warning',
      title: '场景族 SLO 仍缺少灰度样本',
      summary: '当前还没有可用于灰度判定的终态运行样本，先不要直接默认放量。',
      recommendation: '先用小流量灰度补第一批终态样本，再根据 SLO 判定是否扩大覆盖面。',
      sourceRef: 'scenarioFamilySlo',
    });
  } else if (offTrackFamilies.length > 0) {
    gates.push({
      gateId: 'rollout:slo:blocked',
      source: 'scenario_family_slo',
      status: 'blocked',
      title: '场景族 SLO 仍有未达标项',
      summary: `当前有 ${offTrackFamilies.length} 个场景族未达 SLO：${pickTopStrings(
        offTrackFamilies.map((item) => item.label),
        3
      ).join(' / ')}。`,
      recommendation: '先压平未达标场景族，再考虑扩大 AI 生成覆盖面。',
      sourceRef: offTrackFamilies.map((item) => item.family).join(' / '),
    });
  } else if (atRiskFamilies.length > 0 || insufficientDataFamilies.length > 0) {
    const parts: string[] = [];
    if (atRiskFamilies.length > 0) {
      parts.push(`接近边界 ${atRiskFamilies.length} 个`);
    }
    if (insufficientDataFamilies.length > 0) {
      parts.push(`样本不足 ${insufficientDataFamilies.length} 个`);
    }
    gates.push({
      gateId: 'rollout:slo:warning',
      source: 'scenario_family_slo',
      status: 'warning',
      title: '场景族 SLO 仍需灰度观察',
      summary: `当前场景族 SLO 状态：${parts.join('，')}。`,
      recommendation: '保持小流量灰度，优先观察 first pass 与 terminal 波动是否继续收敛。',
      sourceRef: uniqueStrings([
        ...atRiskFamilies.map((item) => item.family),
        ...insufficientDataFamilies.map((item) => item.family),
      ]).join(' / '),
    });
  } else {
    gates.push({
      gateId: 'rollout:slo:ready',
      source: 'scenario_family_slo',
      status: 'ready',
      title: '场景族 SLO 已达标',
      summary: `当前 ${input.scenarioFamilySlo.meetingCount} 个已跟踪场景族都达到既定 first / terminal 目标。`,
      recommendation: '可以进入默认放量候选，但仍需盯紧最近回归信号。',
      sourceRef: 'scenarioFamilySlo',
    });
  }

  const highWatchItems = input.regressionWatchlist.items.filter((item) => item.severity === 'high');
  const mediumWatchItems = input.regressionWatchlist.items.filter((item) => item.severity === 'medium');
  if (highWatchItems.length > 0) {
    gates.push({
      gateId: 'rollout:watchlist:blocked',
      source: 'regression_watchlist',
      status: 'blocked',
      title: '高风险回归 watchlist 未清零',
      summary: `当前有 ${highWatchItems.length} 个高风险观察项：${pickTopStrings(
        highWatchItems.map((item) => item.title),
        2
      ).join(' / ')}。`,
      recommendation: '先围绕高风险 watchlist 回放固定回归，再决定是否继续放量。',
      sourceRef: highWatchItems.map((item) => item.watchId).join(' / '),
    });
  } else if (mediumWatchItems.length > 0) {
    gates.push({
      gateId: 'rollout:watchlist:warning',
      source: 'regression_watchlist',
      status: 'warning',
      title: '仍有中风险 watchlist 需要观察',
      summary: `当前还有 ${mediumWatchItems.length} 个观察项：${pickTopStrings(
        mediumWatchItems.map((item) => item.title),
        2
      ).join(' / ')}。`,
      recommendation: '继续小流量灰度，确认这些观察项不会继续恶化再扩大范围。',
      sourceRef: mediumWatchItems.map((item) => item.watchId).join(' / '),
    });
  } else {
    gates.push({
      gateId: 'rollout:watchlist:ready',
      source: 'regression_watchlist',
      status: 'ready',
      title: '当前无回归 watchlist',
      summary: '最近窗口里没有新的高风险或中风险回归观察项。',
      recommendation: '回归 watchlist 已清空，可继续参考其它门禁决定是否放量。',
      sourceRef: 'regressionWatchlist',
    });
  }

  const blockedLifecycleRules = input.riskLifecycleRules.filter((item) => item.policy === 'block_default_merge');
  const guardedLifecycleRules = input.riskLifecycleRules.filter(
    (item) => item.policy === 'observe_guarded' || item.policy === 'observe'
  );
  const watchingProbationRules = input.probationRules.filter((item) => item.status === 'watching');
  if (blockedLifecycleRules.length > 0) {
    gates.push({
      gateId: 'rollout:lifecycle:blocked',
      source: 'risk_lifecycle_rule',
      status: 'blocked',
      title: '存在默认阻断的治理规则',
      summary: `当前有 ${blockedLifecycleRules.length} 条规则命中默认阻断策略：${pickTopStrings(
        blockedLifecycleRules.map((item) => item.ruleId),
        2
      ).join(' / ')}。`,
      recommendation: '先暂停把这些规则继续作为默认路径扩散，保留定点验证或回滚通道。',
      sourceRef: blockedLifecycleRules.map((item) => item.ruleId).join(' / '),
    });
  } else if (guardedLifecycleRules.length > 0 || watchingProbationRules.length > 0) {
    const summaryParts: string[] = [];
    if (guardedLifecycleRules.length > 0) {
      summaryParts.push(`观察期 lifecycle 规则 ${guardedLifecycleRules.length} 条`);
    }
    if (watchingProbationRules.length > 0) {
      summaryParts.push(`probation merge ${watchingProbationRules.length} 条`);
    }
    gates.push({
      gateId: 'rollout:lifecycle:warning',
      source: 'risk_lifecycle_rule',
      status: 'warning',
      title: '规则治理仍处于观察窗口',
      summary: `当前仍有 ${summaryParts.join('，')}。`,
      recommendation: '继续小流量灰度，确认观察期规则和最近 merge 的真实收益稳定后再扩大默认覆盖。',
      sourceRef: uniqueStrings([
        ...guardedLifecycleRules.map((item) => item.ruleId),
        ...watchingProbationRules.map((item) => item.auditId),
      ]).join(' / '),
    });
  } else {
    gates.push({
      gateId: 'rollout:lifecycle:ready',
      source: 'risk_lifecycle_rule',
      status: 'ready',
      title: '规则治理未命中阻断窗口',
      summary: '当前没有默认阻断或观察期中的治理规则继续压制默认放量。',
      recommendation: '规则治理门禁已通过，可继续参考 SLO / watchlist 做最终放量判断。',
      sourceRef: 'riskLifecycleRules',
    });
  }

  if (input.rollbackCandidates.length > 0) {
    gates.push({
      gateId: 'rollout:rollback:blocked',
      source: 'rollback_candidate',
      status: 'blocked',
      title: '存在明确回滚候选',
      summary: `最近有 ${input.rollbackCandidates.length} 个 merge 已被识别为回滚候选：${pickTopStrings(
        input.rollbackCandidates.map((item) => item.title),
        2
      ).join(' / ')}。`,
      recommendation: '优先验证回滚或修复，再决定是否恢复灰度或继续放量。',
      sourceRef: input.rollbackCandidates.map((item) => item.auditId).join(' / '),
    });
  } else {
    gates.push({
      gateId: 'rollout:rollback:ready',
      source: 'rollback_candidate',
      status: 'ready',
      title: '当前无明确回滚候选',
      summary: '最近窗口里没有新的 merge 被判定为明确回滚候选。',
      recommendation: '回滚门禁当前放行，可继续参考其它灰度信号。',
      sourceRef: 'rollbackCandidates',
    });
  }

  const rankedGates = gates.sort(
    (a, b) =>
      rolloutStrategyGateStatusRank(a.status) - rolloutStrategyGateStatusRank(b.status) ||
      rolloutStrategyGateSourceRank(a.source) - rolloutStrategyGateSourceRank(b.source) ||
      a.gateId.localeCompare(b.gateId)
  );
  const blockedCount = rankedGates.filter((item) => item.status === 'blocked').length;
  const warningCount = rankedGates.filter((item) => item.status === 'warning').length;
  const readyCount = rankedGates.filter((item) => item.status === 'ready').length;

  const recommendedStage: IntentE2EInsightRolloutStrategyStage =
    blockedCount > 0 ? 'hold' : warningCount > 0 ? 'small_batch' : 'full_release';

  if (recommendedStage === 'hold') {
    return {
      generatedFromRuns: input.scenarioFamilySlo.generatedFromRuns,
      recommendedStage,
      summary: `当前命中 ${blockedCount} 个阻断门禁，先暂停默认放量。`,
      recommendation: '优先处理未达标 SLO、高风险回归、默认阻断规则或明确回滚候选，再重新评估灰度。',
      blockedCount,
      warningCount,
      readyCount,
      gates: rankedGates,
    };
  }

  if (recommendedStage === 'small_batch') {
    return {
      generatedFromRuns: input.scenarioFamilySlo.generatedFromRuns,
      recommendedStage,
      summary: `当前没有阻断门禁，但仍有 ${warningCount} 个观察项，建议保持小流量灰度。`,
      recommendation: '继续小批量放量，重点盯 recent traces、first pass、terminal 和规则治理观察窗口。',
      blockedCount,
      warningCount,
      readyCount,
      gates: rankedGates,
    };
  }

  return {
    generatedFromRuns: input.scenarioFamilySlo.generatedFromRuns,
    recommendedStage,
    summary: '当前关键门禁均已通过，可以进入默认放量窗口。',
    recommendation: '按默认灰度路径放量，同时持续监控 regression watchlist 与后续治理信号。',
    blockedCount,
    warningCount,
    readyCount,
    gates: rankedGates,
  };
}

function buildPriorityScenarioFamilyStats(runs: InsightRunRecord[]): IntentE2EInsightPriorityScenarioStat[] {
  const stats = new Map<
    Exclude<IntentE2EPriorityScenarioFamily, 'untracked'>,
    {
      runIds: Set<string>;
      passedRunIds: Set<string>;
      failedRunIds: Set<string>;
      canceledRunIds: Set<string>;
      firstPassRunIds: Set<string>;
      repairedRunIds: Set<string>;
    }
  >();

  for (const run of runs) {
    if (run.priorityScenarioFamily === 'untracked') continue;

    const current = stats.get(run.priorityScenarioFamily) || {
      runIds: new Set<string>(),
      passedRunIds: new Set<string>(),
      failedRunIds: new Set<string>(),
      canceledRunIds: new Set<string>(),
      firstPassRunIds: new Set<string>(),
      repairedRunIds: new Set<string>(),
    };
    current.runIds.add(run.runId);
    if (run.status === 'passed') {
      current.passedRunIds.add(run.runId);
    } else if (run.status === 'failed') {
      current.failedRunIds.add(run.runId);
    } else if (run.status === 'canceled') {
      current.canceledRunIds.add(run.runId);
    }
    if (run.firstPassSucceeded) {
      current.firstPassRunIds.add(run.runId);
    }
    if (run.repairedSucceeded) {
      current.repairedRunIds.add(run.runId);
    }
    stats.set(run.priorityScenarioFamily, current);
  }

  return [...stats.entries()]
    .map(([family, current]) => ({
      family,
      label: PRIORITY_SCENARIO_FAMILY_LABELS[family] || family,
      totalRuns: current.runIds.size,
      passedRuns: current.passedRunIds.size,
      failedRuns: current.failedRunIds.size,
      canceledRuns: current.canceledRunIds.size,
      firstPassPassedRuns: current.firstPassRunIds.size,
      firstPassPassRate: toPercent(current.firstPassRunIds.size, current.runIds.size),
      repairedPassRuns: current.repairedRunIds.size,
      repairedPassRate: toPercent(current.repairedRunIds.size, current.runIds.size),
      terminalPassRate: toPercent(current.passedRunIds.size, current.runIds.size),
    }))
    .sort(
      (a, b) =>
        priorityScenarioFamilyRank(a.family) - priorityScenarioFamilyRank(b.family) ||
        b.totalRuns - a.totalRuns ||
        b.terminalPassRate - a.terminalPassRate ||
        a.label.localeCompare(b.label)
    );
}

function verificationIntentPriorityRank(intent: IntentE2EInsightVerificationIntent): number {
  switch (intent) {
    case 'verify':
      return 0;
    case 'review':
      return 1;
    case 'unknown':
    default:
      return 2;
  }
}

function buildVerificationIntentStats(runs: InsightRunRecord[]): IntentE2EInsightVerificationIntentStat[] {
  const stats = new Map<
    IntentE2EInsightVerificationIntent,
    {
      runIds: Set<string>;
      passedRunIds: Set<string>;
      failedRunIds: Set<string>;
      canceledRunIds: Set<string>;
      firstPassRunIds: Set<string>;
      repairedRunIds: Set<string>;
      latestRepairObservationAt: string;
      latestRepairObservationAtMs: number;
      latestRepairObservationSummary: string;
      latestRepairObservationVerifierCheckUids: string[];
    }
  >();

  for (const run of runs) {
    const latestRepairObservation = pickLatestVerifierRepairObservationFromAttempts(run.attempts);
    const current = stats.get(run.verificationIntent) || {
      runIds: new Set<string>(),
      passedRunIds: new Set<string>(),
      failedRunIds: new Set<string>(),
      canceledRunIds: new Set<string>(),
      firstPassRunIds: new Set<string>(),
      repairedRunIds: new Set<string>(),
      latestRepairObservationAt: '',
      latestRepairObservationAtMs: 0,
      latestRepairObservationSummary: '',
      latestRepairObservationVerifierCheckUids: [],
    };
    current.runIds.add(run.runId);
    if (run.status === 'passed') {
      current.passedRunIds.add(run.runId);
    } else if (run.status === 'failed') {
      current.failedRunIds.add(run.runId);
    } else if (run.status === 'canceled') {
      current.canceledRunIds.add(run.runId);
    }
    if (run.firstPassSucceeded) {
      current.firstPassRunIds.add(run.runId);
    }
    if (run.repairedSucceeded) {
      current.repairedRunIds.add(run.runId);
    }
    if (
      latestRepairObservation &&
      run.finishedAtMs >= current.latestRepairObservationAtMs
    ) {
      current.latestRepairObservationAt = run.finishedAt;
      current.latestRepairObservationAtMs = run.finishedAtMs;
      current.latestRepairObservationSummary = latestRepairObservation.repairObservationSummary;
      current.latestRepairObservationVerifierCheckUids = [...latestRepairObservation.patchedVerifierCheckUids];
    }
    stats.set(run.verificationIntent, current);
  }

  return [...stats.entries()]
    .map(([intent, current]) => ({
      intent,
      label: VERIFICATION_INTENT_LABELS[intent] || intent,
      totalRuns: current.runIds.size,
      passedRuns: current.passedRunIds.size,
      failedRuns: current.failedRunIds.size,
      canceledRuns: current.canceledRunIds.size,
      firstPassPassedRuns: current.firstPassRunIds.size,
      firstPassPassRate: toPercent(current.firstPassRunIds.size, current.runIds.size),
      repairedPassRuns: current.repairedRunIds.size,
      repairedPassRate: toPercent(current.repairedRunIds.size, current.runIds.size),
      terminalPassRate: toPercent(current.passedRunIds.size, current.runIds.size),
      latestRepairObservationAt: current.latestRepairObservationAt,
      latestRepairObservationSummary: current.latestRepairObservationSummary,
      latestRepairObservationVerifierCheckUids: [...current.latestRepairObservationVerifierCheckUids],
    }))
    .sort(
      (a, b) =>
        verificationIntentPriorityRank(a.intent) - verificationIntentPriorityRank(b.intent) ||
        b.totalRuns - a.totalRuns ||
        a.label.localeCompare(b.label)
    );
}

function buildFailureClassStats(runs: InsightRunRecord[]): IntentE2EInsightFailureClassStat[] {
  const counts = new Map<
    string,
    {
      count: number;
      latestRepairObservationAt: string;
      latestRepairObservationAtMs: number;
      latestRepairObservationSummary: string;
      latestRepairObservationVerifierCheckUids: string[];
    }
  >();

  for (const run of runs) {
    if (run.status === 'passed' || !run.failureClass) continue;
    const latestRepairObservation = pickLatestVerifierRepairObservationFromAttempts(run.attempts);
    const current = counts.get(run.failureClass) || {
      count: 0,
      latestRepairObservationAt: '',
      latestRepairObservationAtMs: 0,
      latestRepairObservationSummary: '',
      latestRepairObservationVerifierCheckUids: [],
    };
    current.count += 1;
    if (
      latestRepairObservation &&
      run.finishedAtMs >= current.latestRepairObservationAtMs
    ) {
      current.latestRepairObservationAt = run.finishedAt;
      current.latestRepairObservationAtMs = run.finishedAtMs;
      current.latestRepairObservationSummary = latestRepairObservation.repairObservationSummary;
      current.latestRepairObservationVerifierCheckUids = [...latestRepairObservation.patchedVerifierCheckUids];
    }
    counts.set(run.failureClass, current);
  }

  return [...counts.entries()]
    .map(([failureClass, current]) => ({
      failureClass,
      count: current.count,
      latestRepairObservationAt: current.latestRepairObservationAt,
      latestRepairObservationSummary: current.latestRepairObservationSummary,
      latestRepairObservationVerifierCheckUids: [...current.latestRepairObservationVerifierCheckUids],
    }))
    .sort((a, b) => b.count - a.count || a.failureClass.localeCompare(b.failureClass))
    .slice(0, 5);
}

function buildRecentTraceSummaries(runs: InsightRunRecord[], limit = 8): IntentE2EInsightRecentTrace[] {
  const normalizedLimit = Math.max(1, Math.floor(limit || 8));

  return [...runs]
    .sort((a, b) => b.finishedAtMs - a.finishedAtMs || b.runId.localeCompare(a.runId))
    .slice(0, normalizedLimit)
    .map((run) => {
      const attempts = run.attempts.map((attempt) => ({
        ...attempt,
        usedHelpers: [...attempt.usedHelpers],
        usedSuggestedHelpers: [...attempt.usedSuggestedHelpers],
        keySignals: [...attempt.keySignals],
        targetSlotUids: [...attempt.targetSlotUids],
        returnedSlotUids: [...attempt.returnedSlotUids],
        patchedRecipeSlugs: [...attempt.patchedRecipeSlugs],
        patchedVerifierCheckUids: [...attempt.patchedVerifierCheckUids],
        repairObservationSummary: attempt.repairObservationSummary,
      }));
      const latestRepairObservation = pickLatestRepairObservationFromAttempts(attempts);

      return {
        traceVersion: 1,
        runId: run.runId,
        testType: run.testType,
        runnerType: run.runnerType,
        verificationPolicyNotes: [...run.verificationPolicyNotes],
        projectUid: run.projectUid,
        status: run.status,
        finishedAt: run.finishedAt,
        requestInput: run.requestInput,
        targetUrl: run.targetUrl,
        targetPath: run.targetPath,
        scenarioTitle: run.scenarioTitle,
        scenarioFamily: run.scenarioFamily,
        scenarioFamilyLabel: SCENARIO_FAMILY_LABELS[run.scenarioFamily] || run.scenarioFamily,
        verificationIntent: run.verificationIntent,
        verificationIntentLabel: VERIFICATION_INTENT_LABELS[run.verificationIntent] || run.verificationIntent,
        taskMode: run.taskMode,
        stepCount: run.stepCount,
        stepTypes: [...run.stepTypes],
        snapshotSignature: run.snapshotSignature,
        compiledSlotCount: run.compiledSlotCount,
        compiledSlotUids: [...run.compiledSlotUids],
        attemptCount: run.attempts.length,
        repairAttempted: run.attempts.some((attempt) => attempt.kind === 'repair'),
        structuredPatchAttempted: run.structuredPatchAttempted,
        targetedRepairAttempted: run.targetedRepairAttempted,
        knowledgeHit: run.assetReadiness.knowledgeMatchCount > 0 || run.matchedRuleIds.length > 0,
        assetReadiness: {
          ...run.assetReadiness,
          reasons: [...run.assetReadiness.reasons],
        },
        qualitySplit: {
          ...run.qualitySplit,
        },
        matchedRecipeSlugs: [...run.matchedRecipeSlugs],
        matchedRuleIds: [...run.matchedRuleIds],
        matchedRuleTitles: [...run.matchedRuleTitles],
        matchedStarterHelpers: [...run.matchedStarterHelpers],
        suggestedHelpers: [...run.suggestedHelpers],
        usedHelpers: [...run.usedHelpers],
        usedSuggestedHelpers: [...run.usedSuggestedHelpers],
        firstPassSucceeded: run.firstPassSucceeded,
        repairedSucceeded: run.repairedSucceeded,
        keySignals: [...run.keySignals],
        responseEvents: run.responseEvents.map((event) => ({
          attempt: event.attempt,
          kind: event.kind,
          url: event.url,
          method: event.method,
          status: event.status,
          topLevelKeys: [...event.topLevelKeys],
        })),
        verifierResult: {
          expectedOutcome: run.verifierResult.expectedOutcome,
          failingCheckCount: run.verifierResult.failingCheckCount,
          failingChecks: run.verifierResult.failingChecks.map((check) => ({
            checkUid: check.checkUid,
            title: check.title,
            kind: check.kind,
            required: check.required,
            preferredHelpers: [...check.preferredHelpers],
            relatedPlanStepUids: [...check.relatedPlanStepUids],
          })),
        },
        finalGraderResult: {
          status: run.finalGraderResult.status,
          summary: run.finalGraderResult.summary,
          failureClass: run.finalGraderResult.failureClass,
          repairable: run.finalGraderResult.repairable,
        },
        patchedSlotUids: [...run.patchedSlotUids],
        latestRepairObservationSummary: latestRepairObservation.repairObservationSummary,
        latestRepairObservationRecipeSlugs: latestRepairObservation.patchedRecipeSlugs,
        latestRepairObservationVerifierCheckUids: latestRepairObservation.patchedVerifierCheckUids,
        failureClass: run.failureClass,
        attempts,
      };
    });
}

function pickLatestRepairObservationFromAttempts(
  attempts: IntentE2EInsightRecentTraceAttempt[]
): {
  repairObservationSummary: string;
  patchedRecipeSlugs: string[];
  patchedVerifierCheckUids: string[];
} {
  for (const attempt of [...attempts].reverse()) {
    if (attempt.kind !== 'repair' || !attempt.repairObservationSummary) continue;

    return {
      repairObservationSummary: attempt.repairObservationSummary,
      patchedRecipeSlugs: [...attempt.patchedRecipeSlugs],
      patchedVerifierCheckUids: [...attempt.patchedVerifierCheckUids],
    };
  }

  for (const attempt of [...attempts].reverse()) {
    if (
      attempt.kind !== 'repair' ||
      (attempt.patchedRecipeSlugs.length === 0 && attempt.patchedVerifierCheckUids.length === 0)
    ) {
      continue;
    }

    return {
      repairObservationSummary: '',
      patchedRecipeSlugs: [...attempt.patchedRecipeSlugs],
      patchedVerifierCheckUids: [...attempt.patchedVerifierCheckUids],
    };
  }

  return {
    repairObservationSummary: '',
    patchedRecipeSlugs: [],
    patchedVerifierCheckUids: [],
  };
}

function pickLatestVerifierRepairObservationFromAttempts(
  attempts: IntentE2EInsightRecentTraceAttempt[]
): {
  repairObservationSummary: string;
  patchedVerifierCheckUids: string[];
} | null {
  for (const attempt of [...attempts].reverse()) {
    if (attempt.kind !== 'repair' || attempt.patchedVerifierCheckUids.length === 0) continue;

    return {
      repairObservationSummary: attempt.repairObservationSummary,
      patchedVerifierCheckUids: [...attempt.patchedVerifierCheckUids],
    };
  }

  return null;
}

function collectLatestRecipeRepairObservationBySlug(
  runs: InsightRunRecord[]
): Map<
  string,
  {
    observedAt: string;
    observedAtMs: number;
    observationSummary: string;
  }
> {
  const stats = new Map<
    string,
    {
      observedAt: string;
      observedAtMs: number;
      observationSummary: string;
    }
  >();

  for (const run of runs) {
    for (const attempt of run.attempts) {
      if (attempt.kind !== 'repair' || !attempt.repairObservationSummary || attempt.patchedRecipeSlugs.length === 0) {
        continue;
      }

      for (const slug of attempt.patchedRecipeSlugs) {
        const current = stats.get(slug);
        if (current && current.observedAtMs > run.finishedAtMs) continue;

        stats.set(slug, {
          observedAt: run.finishedAt,
          observedAtMs: run.finishedAtMs,
          observationSummary: attempt.repairObservationSummary,
        });
      }
    }
  }

  return stats;
}

function normalizeCapabilityVerificationActivity(
  activity: ProjectActivityLogRecord
): InsightCapabilityVerificationRecord | null {
  if (activity.entityType !== 'execution') return null;
  if (activity.actionType !== 'execution_passed' && activity.actionType !== 'execution_failed') return null;

  const context = extractCapabilityVerificationContext(activity.meta);
  if (!context) return null;
  if (context.intent !== 'verify' && context.intent !== 'review') return null;

  const meta = activity.meta && typeof activity.meta === 'object' && !Array.isArray(activity.meta)
    ? (activity.meta as {
        executionUid?: unknown;
        planUid?: unknown;
        configUid?: unknown;
        configName?: unknown;
        errorMessage?: unknown;
        repairTriggerKind?: unknown;
      })
    : null;

  return {
    executionUid:
      (typeof meta?.executionUid === 'string' && meta.executionUid.trim()) || activity.entityUid.trim(),
    planUid: typeof meta?.planUid === 'string' ? meta.planUid.trim() : '',
    configUid: typeof meta?.configUid === 'string' ? meta.configUid.trim() : '',
    configName: typeof meta?.configName === 'string' ? meta.configName.trim() : '',
    capabilityUid: context.capabilityUid,
    chainCapabilityUids: context.chainCapabilityUids,
    status: activity.actionType === 'execution_passed' ? 'passed' : 'failed',
    intent: context.intent,
    targetName: context.targetName,
    strategyLabel: context.strategyLabel || VERIFICATION_INTENT_LABELS[context.intent],
    summary: activity.detail.trim(),
    errorMessage: typeof meta?.errorMessage === 'string' ? meta.errorMessage.trim() : '',
    repairTriggerKind: normalizeRepairTriggerKind(meta?.repairTriggerKind),
    createdAt: activity.createdAt,
    createdAtMs: toTimestamp(activity.createdAt),
  };
}

function collectCapabilityVerificationRepairPlanTriggerKinds(
  activityLogs: ProjectActivityLogRecord[]
): Map<string, IntentE2EInsightRepairTriggerKind> {
  const planTriggerKinds = new Map<string, IntentE2EInsightRepairTriggerKind>();

  for (const activity of activityLogs) {
    if (activity.entityType !== 'plan' || activity.actionType !== 'plan_repaired') continue;
    const context = extractCapabilityVerificationContext(activity.meta);
    if (!context) continue;
    const planUid = activity.entityUid.trim();
    if (!planUid) continue;
    const meta =
      activity.meta && typeof activity.meta === 'object' && !Array.isArray(activity.meta)
        ? (activity.meta as {
            repairTriggerKind?: unknown;
          })
        : null;
    const repairTriggerKind =
      normalizeRepairTriggerKind(meta?.repairTriggerKind) || inferRepairTriggerKindFromActorLabel(activity.actorLabel);
    planTriggerKinds.set(planUid, repairTriggerKind);
  }

  return planTriggerKinds;
}

function collectCapabilityVerificationActivities(
  activityLogs: ProjectActivityLogRecord[]
): InsightCapabilityVerificationRecord[] {
  const repairPlanTriggerKinds = collectCapabilityVerificationRepairPlanTriggerKinds(activityLogs);

  return activityLogs
    .map(normalizeCapabilityVerificationActivity)
    .filter((item): item is InsightCapabilityVerificationRecord => Boolean(item))
    .map((item) => ({
      ...item,
      repairTriggerKind: item.repairTriggerKind || repairPlanTriggerKinds.get(item.planUid) || '',
    }));
}

type StarterHelperPromotionHistory = {
  recordedPromotionReceiptCount: number;
  recordedPromotionCapabilityCount: number;
  lastPromotionRecordedAt: string;
  lastPromotionSourceRunId: string;
  lastPromotionModuleName: string;
  lastPromotionScenarioTitle: string;
};

function collectStarterHelperPromotionHistory(
  activityLogs: ProjectActivityLogRecord[]
): Map<string, StarterHelperPromotionHistory> {
  const historyByHelper = new Map<
    string,
    StarterHelperPromotionHistory & {
      receiptIds: Set<string>;
      lastPromotionRecordedAtMs: number;
    }
  >();

  for (const activity of activityLogs) {
    if (activity.actionType !== 'starter_asset_promotion_recorded') continue;
    const receipt = extractIntentStarterAssetPromotionReceiptFromActivityMeta(activity.meta);
    if (!receipt || receipt.items.length === 0) continue;

    const receiptKey = receipt.receiptId || activity.activityUid;
    const recordedAt = receipt.recordedAt || activity.createdAt;
    const recordedAtMs = toTimestamp(recordedAt);

    for (const item of receipt.items) {
      const helper = item.helper.trim();
      if (!helper) continue;

      const current = historyByHelper.get(helper) || {
        recordedPromotionReceiptCount: 0,
        recordedPromotionCapabilityCount: 0,
        lastPromotionRecordedAt: '',
        lastPromotionSourceRunId: '',
        lastPromotionModuleName: '',
        lastPromotionScenarioTitle: '',
        lastPromotionRecordedAtMs: 0,
        receiptIds: new Set<string>(),
      };

      current.recordedPromotionCapabilityCount += 1;
      if (!current.receiptIds.has(receiptKey)) {
        current.receiptIds.add(receiptKey);
        current.recordedPromotionReceiptCount += 1;
      }
      if (recordedAtMs >= current.lastPromotionRecordedAtMs) {
        current.lastPromotionRecordedAtMs = recordedAtMs;
        current.lastPromotionRecordedAt = recordedAt;
        current.lastPromotionSourceRunId = receipt.sourceRunId || '';
        current.lastPromotionModuleName = receipt.moduleName || '';
        current.lastPromotionScenarioTitle = receipt.scenarioTitle || '';
      }
      historyByHelper.set(helper, current);
    }
  }

  return [...historyByHelper.entries()].reduce<Map<string, StarterHelperPromotionHistory>>((acc, [helper, value]) => {
    acc.set(helper, {
      recordedPromotionReceiptCount: value.recordedPromotionReceiptCount,
      recordedPromotionCapabilityCount: value.recordedPromotionCapabilityCount,
      lastPromotionRecordedAt: value.lastPromotionRecordedAt,
      lastPromotionSourceRunId: value.lastPromotionSourceRunId,
      lastPromotionModuleName: value.lastPromotionModuleName,
      lastPromotionScenarioTitle: value.lastPromotionScenarioTitle,
    });
    return acc;
  }, new Map<string, StarterHelperPromotionHistory>());
}

function attachStarterHelperPromotionHistory<T extends { helper: string }>(
  helpers: T[],
  historyByHelper: Map<string, StarterHelperPromotionHistory>
): Array<T & StarterHelperPromotionHistory> {
  return helpers.map((item) => {
    const history = historyByHelper.get(item.helper);
    if (!history) return item as T & StarterHelperPromotionHistory;

    return {
      ...item,
      recordedPromotionReceiptCount: history.recordedPromotionReceiptCount,
      recordedPromotionCapabilityCount: history.recordedPromotionCapabilityCount,
      lastPromotionRecordedAt: history.lastPromotionRecordedAt,
      lastPromotionSourceRunId: history.lastPromotionSourceRunId,
      lastPromotionModuleName: history.lastPromotionModuleName,
      lastPromotionScenarioTitle: history.lastPromotionScenarioTitle,
    };
  });
}

function buildSuppressedStarterHelperGovernanceCapabilityTimeline(input: {
  targets: Array<{
    helper: string;
    capabilityItems: ProjectCapabilityRecord[];
  }>;
  activities: Array<{
    executionUid: string;
    planUid?: string;
    capabilityUid: string;
    chainCapabilityUids: string[];
    status: 'passed' | 'failed';
    intent: Exclude<IntentE2EInsightVerificationIntent, 'unknown'>;
    repairTriggerKind?: IntentE2EInsightRepairTriggerKind | '';
    createdAt: string;
  }>;
  repairPlanUids?: string[];
}): Map<string, IntentE2EInsightSuppressedStarterHelperGovernanceCapability[]> {
  const repairPlanUidSet = new Set(uniqueStrings(input.repairPlanUids || []));
  const capabilityTimelineByHelper = new Map<string, IntentE2EInsightSuppressedStarterHelperGovernanceCapability[]>();
  const resolveActivityRepairTriggerKind = (activity: (typeof input.activities)[number]): IntentE2EInsightRepairTriggerKind | '' => {
    const planUid = typeof activity.planUid === 'string' ? activity.planUid.trim() : '';
    return normalizeRepairTriggerKind(activity.repairTriggerKind) || (planUid && repairPlanUidSet.has(planUid) ? 'manual' : '');
  };

  for (const target of input.targets) {
    const capabilityItems = target.capabilityItems
      .map<IntentE2EInsightSuppressedStarterHelperGovernanceCapability>((capability) => {
        const relatedActivities = input.activities.filter((activity) => {
          const involvedCapabilityUids = uniqueStrings([activity.capabilityUid, ...activity.chainCapabilityUids]);
          return involvedCapabilityUids.includes(capability.capabilityUid);
        });
        const latestActivity = [...relatedActivities].sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))[0];
        const latestRepairTriggerKind = latestActivity ? resolveActivityRepairTriggerKind(latestActivity) : '';

        return {
          capabilityUid: capability.capabilityUid,
          name: capability.name,
          slug: capability.slug,
          latestExecutionStatus: latestActivity?.status || '',
          latestExecutionIntent: latestActivity?.intent || '',
          latestExecutionSource: latestRepairTriggerKind ? 'repair' : latestActivity ? 'direct' : '',
          latestRepairTriggerKind,
          latestExecutionAt: latestActivity?.createdAt || '',
          recentReviewExecutionCount: relatedActivities.filter((activity) => activity.intent === 'review').length,
          recentVerifyExecutionCount: relatedActivities.filter((activity) => activity.intent === 'verify').length,
          recentRepairExecutionCount: relatedActivities.filter((activity) => Boolean(resolveActivityRepairTriggerKind(activity))).length,
          recentAutoRepairExecutionCount: relatedActivities.filter(
            (activity) => resolveActivityRepairTriggerKind(activity) === 'auto'
          ).length,
          recentManualRepairExecutionCount: relatedActivities.filter(
            (activity) => resolveActivityRepairTriggerKind(activity) === 'manual'
          ).length,
        };
      })
      .sort(
        (left, right) =>
          toTimestamp(right.latestExecutionAt) - toTimestamp(left.latestExecutionAt) ||
          (right.latestExecutionStatus === 'failed' ? 1 : 0) - (left.latestExecutionStatus === 'failed' ? 1 : 0) ||
          right.recentRepairExecutionCount - left.recentRepairExecutionCount ||
          right.recentVerifyExecutionCount - left.recentVerifyExecutionCount ||
          right.recentReviewExecutionCount - left.recentReviewExecutionCount ||
          left.name.localeCompare(right.name, 'zh-CN')
      )
      .slice(0, 5);

    capabilityTimelineByHelper.set(target.helper, capabilityItems);
  }

  return capabilityTimelineByHelper;
}

function buildCapabilityVerificationIntentStats(
  activities: InsightCapabilityVerificationRecord[],
  verificationIntentStats: IntentE2EInsightVerificationIntentStat[] = []
): IntentE2EInsightCapabilityVerificationIntentStat[] {
  const latestRepairObservationByIntent = new Map<
    Exclude<IntentE2EInsightVerificationIntent, 'unknown'>,
    Pick<
      IntentE2EInsightCapabilityVerificationIntentStat,
      'latestRepairObservationAt' | 'latestRepairObservationSummary' | 'latestRepairObservationVerifierCheckUids'
    >
  >(
    verificationIntentStats
      .filter(
        (item): item is IntentE2EInsightVerificationIntentStat & {
          intent: Exclude<IntentE2EInsightVerificationIntent, 'unknown'>;
        } => item.intent !== 'unknown'
      )
      .map((item) => [
        item.intent,
        {
          latestRepairObservationAt: item.latestRepairObservationAt,
          latestRepairObservationSummary: item.latestRepairObservationSummary,
          latestRepairObservationVerifierCheckUids: [...item.latestRepairObservationVerifierCheckUids],
        },
      ])
  );
  const stats = new Map<
    Exclude<IntentE2EInsightVerificationIntent, 'unknown'>,
    {
      executionUids: Set<string>;
      passedExecutionUids: Set<string>;
      failedExecutionUids: Set<string>;
    }
  >();

  for (const activity of activities) {
    const current = stats.get(activity.intent) || {
      executionUids: new Set<string>(),
      passedExecutionUids: new Set<string>(),
      failedExecutionUids: new Set<string>(),
    };
    current.executionUids.add(activity.executionUid);
    if (activity.status === 'passed') {
      current.passedExecutionUids.add(activity.executionUid);
    } else {
      current.failedExecutionUids.add(activity.executionUid);
    }
    stats.set(activity.intent, current);
  }

  return [...stats.entries()]
    .map(([intent, current]) => {
      const latestRepairObservation = latestRepairObservationByIntent.get(intent);
      return {
        intent,
        label: VERIFICATION_INTENT_LABELS[intent],
        totalExecutions: current.executionUids.size,
        passedExecutions: current.passedExecutionUids.size,
        failedExecutions: current.failedExecutionUids.size,
        passRate: toPercent(current.passedExecutionUids.size, current.executionUids.size),
        latestRepairObservationAt: latestRepairObservation?.latestRepairObservationAt || '',
        latestRepairObservationSummary: latestRepairObservation?.latestRepairObservationSummary || '',
        latestRepairObservationVerifierCheckUids: [...(latestRepairObservation?.latestRepairObservationVerifierCheckUids || [])],
      };
    })
    .sort(
      (a, b) =>
        verificationIntentPriorityRank(a.intent) - verificationIntentPriorityRank(b.intent) ||
        b.totalExecutions - a.totalExecutions ||
        a.label.localeCompare(b.label)
    );
}

function buildRecentCapabilityVerificationSummaries(
  activities: InsightCapabilityVerificationRecord[],
  limit = 8
): IntentE2EInsightRecentCapabilityVerification[] {
  const normalizedLimit = Math.max(1, Math.floor(limit || 8));

  return [...activities]
    .sort((a, b) => b.createdAtMs - a.createdAtMs || b.executionUid.localeCompare(a.executionUid))
    .slice(0, normalizedLimit)
    .map((activity) => ({
      executionUid: activity.executionUid,
      configUid: activity.configUid,
      configName: activity.configName,
      capabilityUid: activity.capabilityUid,
      chainCapabilityUids: [...activity.chainCapabilityUids],
      status: activity.status,
      intent: activity.intent,
      intentLabel: VERIFICATION_INTENT_LABELS[activity.intent],
      targetName: activity.targetName,
      strategyLabel: activity.strategyLabel,
      summary: activity.summary,
      errorMessage: activity.errorMessage,
      createdAt: activity.createdAt,
    }));
}

export function buildIntentSuppressedStarterHelperGovernanceInsights(input: {
  suppressedStarterHelpers: IntentE2EInsightSuppressedStarterHelper[];
  capabilities: ProjectCapabilityRecord[];
  activities: Array<{
    executionUid: string;
    planUid?: string;
    capabilityUid: string;
    chainCapabilityUids: string[];
    status: 'passed' | 'failed';
    intent: Exclude<IntentE2EInsightVerificationIntent, 'unknown'>;
    repairTriggerKind?: IntentE2EInsightRepairTriggerKind | '';
    createdAt: string;
  }>;
  repairPlanUids?: string[];
}): {
  suppressedStarterHelpers: IntentE2EInsightSuppressedStarterHelper[];
  summary: IntentE2EInsightSuppressedStarterHelperGovernanceSummary;
} {
  const governanceTargets = resolveIntentSuppressedStarterHelperGovernanceTargets({
    helpers: input.suppressedStarterHelpers.filter((item) => hasIntentVerificationFailurePressureSummaryHighFailure(item)),
    capabilities: input.capabilities,
  });
  const allGovernanceTargets = resolveIntentSuppressedStarterHelperGovernanceTargets({
    helpers: input.suppressedStarterHelpers,
    capabilities: input.capabilities,
  });
  const governanceCapabilityTimelineByHelper = buildSuppressedStarterHelperGovernanceCapabilityTimeline({
    targets: allGovernanceTargets,
    activities: input.activities,
    repairPlanUids: input.repairPlanUids,
  });
  const governance = summarizeIntentStarterHelperGovernanceReviewTargets({
    targets: governanceTargets,
    activities: input.activities,
    repairPlanUids: input.repairPlanUids,
  });
  const allGovernance = summarizeIntentStarterHelperGovernanceReviewTargets({
    targets: allGovernanceTargets,
    activities: input.activities,
    repairPlanUids: input.repairPlanUids,
  });
  const governanceByHelper = new Map(allGovernance.targets.map((item) => [item.helper, item]));

  return {
    suppressedStarterHelpers: input.suppressedStarterHelpers.map((item) => {
      const helperGovernance = governanceByHelper.get(item.helper);
      const enrichedHelper = {
        ...item,
        governanceTargetCapabilityCount: helperGovernance?.capabilityItems.length || 0,
        recentGovernanceReviewExecutionCount: helperGovernance?.recentReviewExecutionCount || 0,
        recentPassedGovernanceReviewExecutionCount: helperGovernance?.recentPassedReviewExecutionCount || 0,
        recentFailedGovernanceReviewExecutionCount: helperGovernance?.recentFailedReviewExecutionCount || 0,
        latestGovernanceReviewExecutionAt: helperGovernance?.latestReviewExecutionAt || '',
        recentGovernanceVerifyExecutionCount: helperGovernance?.recentVerifyExecutionCount || 0,
        recentPassedGovernanceVerifyExecutionCount: helperGovernance?.recentPassedVerifyExecutionCount || 0,
        recentFailedGovernanceVerifyExecutionCount: helperGovernance?.recentFailedVerifyExecutionCount || 0,
        latestGovernanceVerifyExecutionAt: helperGovernance?.latestVerifyExecutionAt || '',
        recentGovernanceRepairExecutionCount: helperGovernance?.recentRepairExecutionCount || 0,
        recentPassedGovernanceRepairExecutionCount: helperGovernance?.recentPassedRepairExecutionCount || 0,
        recentFailedGovernanceRepairExecutionCount: helperGovernance?.recentFailedRepairExecutionCount || 0,
        latestGovernanceRepairExecutionAt: helperGovernance?.latestRepairExecutionAt || '',
        recentGovernanceAutoRepairExecutionCount: helperGovernance?.recentAutoRepairExecutionCount || 0,
        recentPassedGovernanceAutoRepairExecutionCount: helperGovernance?.recentPassedAutoRepairExecutionCount || 0,
        recentFailedGovernanceAutoRepairExecutionCount: helperGovernance?.recentFailedAutoRepairExecutionCount || 0,
        latestGovernanceAutoRepairExecutionAt: helperGovernance?.latestAutoRepairExecutionAt || '',
        recentGovernanceManualRepairExecutionCount: helperGovernance?.recentManualRepairExecutionCount || 0,
        recentPassedGovernanceManualRepairExecutionCount: helperGovernance?.recentPassedManualRepairExecutionCount || 0,
        recentFailedGovernanceManualRepairExecutionCount: helperGovernance?.recentFailedManualRepairExecutionCount || 0,
        latestGovernanceManualRepairExecutionAt: helperGovernance?.latestManualRepairExecutionAt || '',
        governanceCapabilities: governanceCapabilityTimelineByHelper.get(item.helper) || [],
      };
      return {
        ...enrichedHelper,
        ...evaluateSuppressedStarterHelperGovernanceRecommendation(enrichedHelper),
      };
    }),
    summary: governance.summary,
  };
}

function buildEvaluationBaseline(runs: InsightRunRecord[]): IntentE2EEvaluationBaseline {
  const clusters = new Map<string, InsightRunRecord[]>();

  for (const run of runs) {
    const clusterKey = run.snapshotSignature || `${run.scenarioFamily}|${run.targetPath || run.targetUrl || run.runId}`;
    const current = clusters.get(clusterKey) || [];
    current.push(run);
    clusters.set(clusterKey, current);
  }

  const candidates = [...clusters.entries()]
    .map(([snapshotSignature, clusterRuns]) => {
      const orderedRuns = [...clusterRuns].sort((a, b) => b.finishedAtMs - a.finishedAtMs || b.runId.localeCompare(a.runId));
      const representative = orderedRuns[0];
      const passedRuns = clusterRuns.filter((run) => run.status === 'passed').length;
      const failedRuns = clusterRuns.filter((run) => run.status === 'failed').length;
      const canceledRuns = clusterRuns.filter((run) => run.status === 'canceled').length;
      const repairAttemptedRuns = clusterRuns.filter((run) => run.attempts.some((attempt) => attempt.kind === 'repair')).length;
      const knowledgeHitRuns = clusterRuns.filter((run) => run.matchedRuleIds.length > 0).length;
      const passMetrics = buildPassMetrics(clusterRuns);
      const failureClasses = pickTopFailureClassStats(clusterRuns, 3);
      const matchedRuleIds = pickTopStrings(clusterRuns.flatMap((run) => run.matchedRuleIds), 5);
      const matchedRecipeSlugs = pickTopStrings(clusterRuns.flatMap((run) => run.matchedRecipeSlugs), 5);
      const matchedRuleTitles = pickTopStrings(
        clusterRuns.flatMap((run) => run.matchedRuleIds.map((ruleId, index) => run.matchedRuleTitles[index] || ruleId)),
        5
      );
      const usedHelpers = pickTopStrings(clusterRuns.flatMap((run) => run.usedHelpers), 5);
      const keySignals = pickTopStrings(clusterRuns.flatMap((run) => run.keySignals), 5);
      const priority = pickEvaluationCandidatePriority({
        scenarioFamily: representative.scenarioFamily,
        runCount: clusterRuns.length,
        failedRuns,
        repairedPassRuns: passMetrics.repairedPassRuns,
        repairAttemptedRuns,
      });
      const knowledgeHitRate = toPercent(knowledgeHitRuns, clusterRuns.length);

      return {
        evalCaseId: buildEvalCaseId(snapshotSignature),
        snapshotSignature,
        scenarioFamily: representative.scenarioFamily,
        scenarioFamilyLabel: SCENARIO_FAMILY_LABELS[representative.scenarioFamily] || representative.scenarioFamily,
        taskMode: representative.taskMode,
        targetPath: representative.targetPath,
        stepTypes: [...representative.stepTypes],
        stepCount: Math.max(...clusterRuns.map((run) => run.stepCount), 0),
        runCount: clusterRuns.length,
        passedRuns,
        failedRuns,
        canceledRuns,
        repairAttemptedRuns,
        knowledgeHitRuns,
        knowledgeHitRate,
        latestFinishedAt: representative.finishedAt,
        representativeScenarioTitle: representative.scenarioTitle,
        representativeRequestInput: representative.requestInput,
        representativeRunIds: orderedRuns.slice(0, 3).map((run) => run.runId),
        matchedRecipeSlugs,
        matchedRuleIds,
        matchedRuleTitles,
        usedHelpers,
        keySignals,
        failureClasses,
        priority,
        selectionReason: buildEvaluationSelectionReason({
          scenarioFamily: representative.scenarioFamily,
          runCount: clusterRuns.length,
          failedRuns,
          repairedPassRuns: passMetrics.repairedPassRuns,
          knowledgeHitRate,
          keySignals,
        }),
        ...passMetrics,
      } satisfies IntentE2EEvaluationBaselineCandidate;
    })
    .sort((a, b) => {
      return (
        evaluationPriorityRank(a.priority) - evaluationPriorityRank(b.priority) ||
        b.runCount - a.runCount ||
        b.failedRuns - a.failedRuns ||
        scenarioFamilyPriorityRank(a.scenarioFamily) - scenarioFamilyPriorityRank(b.scenarioFamily) ||
        Date.parse(b.latestFinishedAt) - Date.parse(a.latestFinishedAt) ||
        a.evalCaseId.localeCompare(b.evalCaseId)
      );
    });

  const recommendedLimit = Math.min(10, Math.max(5, candidates.length || 0));
  const recommendedCandidates = candidates.slice(0, recommendedLimit || 5);

  return {
    generatedFromRuns: runs.length,
    candidateClusters: candidates.length,
    recommendedCount: recommendedCandidates.length,
    recommendedFamilies: uniqueStrings(recommendedCandidates.map((item) => item.scenarioFamily)) as IntentE2EScenarioFamily[],
    selectionNote: '固定评测候选按 snapshot signature 聚类，优先保留高频、复杂、失败或依赖 repair 的真实业务流。',
    candidates: recommendedCandidates,
  };
}

export function buildIntentE2EEvaluationBaselineFromRuns(
  runs: IntentE2EInsightRunRecord[]
): IntentE2EEvaluationBaseline {
  return buildEvaluationBaseline(runs);
}

export function buildIntentE2EEvaluationBaselineFromData(
  runSnapshots: IntentE2ERunSnapshotRecord[]
): IntentE2EEvaluationBaseline {
  const terminalRuns = runSnapshots.map(normalizeTerminalRun).filter((item): item is InsightRunRecord => Boolean(item));
  return buildEvaluationBaseline(terminalRuns);
}

function createNeutralFailurePressureSummary(): IntentVerificationFailurePressureSummary {
  return {
    recentFailedReviewCapabilityCount: 0,
    recentFailedVerifyCapabilityCount: 0,
    recentFailedReviewExecutionCount: 0,
    recentFailedVerifyExecutionCount: 0,
    recentFailureWindowDays: 14,
    highFailureCandidateCount: 0,
    highFailureRepairCount: 0,
    highFailureGovernanceCount: 0,
    latestRepairObservationAt: '',
    latestRepairObservationSummary: '',
    latestRepairObservationVerifierCheckUids: [],
  };
}

function createNeutralRepeatedFailureSuppressionSignal(input: {
  scenarioFamily: IntentE2EScenarioFamily;
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  targetPath: string;
}): IntentE2ERepeatedFailureSuppressionSignal {
  return {
    shouldSuppress: false,
    scenarioFamily: input.scenarioFamily,
    priorityScenarioFamily: input.priorityScenarioFamily,
    targetPath: input.targetPath,
    matchedSnapshotSignature: '',
    matchedRunCount: 0,
    matchedFailedRuns: 0,
    recentFailureStreak: 0,
    dominantQualityBucket: '',
    dominantBlockerKind: '',
    latestFailureClass: '',
    recommendedDecision: '',
    reason: '',
    latestFinishedAt: '',
    representativeRunIds: [],
    failurePressureSummary: createNeutralFailurePressureSummary(),
  };
}

function resolveRepeatedFailureSuppressionThreshold(bucket: IntentE2EQualityBucket | ''): number {
  switch (bucket) {
    case 'auth_blocked':
    case 'permission_blocked':
    case 'env_blocked':
    case 'data_blocked':
      return 2;
    default:
      return 3;
  }
}

function resolveRepeatedFailureSuppressionReason(
  bucket: IntentE2EQualityBucket | ''
): {
  recommendedDecision: IntentE2ERepeatedFailureSuppressionDecision;
  reason: string;
} {
  switch (bucket) {
    case 'auth_blocked':
      return {
        recommendedDecision: 'needs_bootstrap',
        reason: 'recent_repeated_auth_block',
      };
    case 'permission_blocked':
      return {
        recommendedDecision: 'needs_bootstrap',
        reason: 'recent_repeated_permission_block',
      };
    case 'env_blocked':
      return {
        recommendedDecision: 'needs_bootstrap',
        reason: 'recent_repeated_environment_block',
      };
    case 'data_blocked':
      return {
        recommendedDecision: 'needs_fixture',
        reason: 'recent_repeated_data_block',
      };
    default:
      return {
        recommendedDecision: 'draft_only',
        reason: 'recent_repeated_model_failure',
      };
  }
}

function matchesRepeatedFailureSuppressionRun(
  run: InsightRunRecord,
  target: {
    scenarioFamily: IntentE2EScenarioFamily;
    priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
    targetPath: string;
  }
): boolean {
  if (!target.targetPath && target.priorityScenarioFamily === 'untracked') {
    return false;
  }

  if (target.targetPath && run.targetPath !== target.targetPath) {
    return false;
  }

  if (target.priorityScenarioFamily !== 'untracked') {
    return run.priorityScenarioFamily === target.priorityScenarioFamily;
  }

  return run.scenarioFamily === target.scenarioFamily;
}

function analyzeRepeatedFailureSuppressionCluster(
  clusterRuns: InsightRunRecord[],
  target: {
    scenarioFamily: IntentE2EScenarioFamily;
    priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
    targetPath: string;
  }
): IntentE2ERepeatedFailureSuppressionSignal {
  const orderedRuns = [...clusterRuns].sort((a, b) => b.finishedAtMs - a.finishedAtMs || b.runId.localeCompare(a.runId));
  const recentFailureRuns: InsightRunRecord[] = [];

  for (const run of orderedRuns) {
    if (run.status !== 'failed') {
      if (recentFailureRuns.length > 0) break;
      return createNeutralRepeatedFailureSuppressionSignal(target);
    }
    recentFailureRuns.push(run);
  }

  const bucketStats = new Map<IntentE2EQualityBucket, number>();
  for (const run of recentFailureRuns) {
    const bucket = run.qualitySplit.bucket;
    bucketStats.set(bucket, (bucketStats.get(bucket) || 0) + 1);
  }

  const dominantQualityBucket =
    [...bucketStats.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || 'model_quality';
  const threshold = resolveRepeatedFailureSuppressionThreshold(dominantQualityBucket);
  const { recommendedDecision, reason } = resolveRepeatedFailureSuppressionReason(dominantQualityBucket);
  const latestRun = recentFailureRuns[0] || orderedRuns[0];
  const recentFailureWindowMs =
    recentFailureRuns.length > 0
      ? Math.max(
          0,
          Math.ceil(
            (recentFailureRuns[0].finishedAtMs - recentFailureRuns[recentFailureRuns.length - 1].finishedAtMs) /
              (24 * 60 * 60 * 1000)
          )
        ) + 1
      : 14;

  const shouldSuppress = recentFailureRuns.length >= threshold;

  return {
    shouldSuppress,
    scenarioFamily: target.scenarioFamily,
    priorityScenarioFamily: target.priorityScenarioFamily,
    targetPath: target.targetPath,
    matchedSnapshotSignature: latestRun?.snapshotSignature || '',
    matchedRunCount: clusterRuns.length,
    matchedFailedRuns: clusterRuns.filter((run) => run.status === 'failed').length,
    recentFailureStreak: recentFailureRuns.length,
    dominantQualityBucket,
    dominantBlockerKind: latestRun?.qualitySplit.blockerKind || '',
    latestFailureClass: latestRun?.failureClass || '',
    recommendedDecision: shouldSuppress ? recommendedDecision : '',
    reason: shouldSuppress ? reason : '',
    latestFinishedAt: latestRun?.finishedAt || '',
    representativeRunIds: orderedRuns.slice(0, 3).map((run) => run.runId),
    failurePressureSummary: shouldSuppress
      ? summarizeIntentVerificationFailurePressureSummaryFromItems(
          [
            {
              recentFailedReviewCapabilityCount: 0,
              recentFailedVerifyCapabilityCount: 0,
              recentFailedReviewExecutionCount: 0,
              recentFailedVerifyExecutionCount: recentFailureRuns.length,
              recentFailureWindowDays: Math.max(1, recentFailureWindowMs),
              highFailurePressure: true,
              latestRepairObservationAt: latestRun?.finishedAt || '',
              latestRepairObservationSummary: latestRun?.finalGraderResult.summary || latestRun?.failureClass || '',
              latestRepairObservationVerifierCheckUids: latestRun?.verifierResult.failingChecks.map((check) => check.checkUid) || [],
            },
          ],
          {
            itemKind: 'queue',
          }
        )
      : createNeutralFailurePressureSummary(),
  };
}

export function resolveIntentE2ERepeatedFailureSuppressionFromData(
  runSnapshots: IntentE2ERunSnapshotRecord[],
  input: {
    requestInput: string;
    targetUrl?: string | null;
  }
): IntentE2ERepeatedFailureSuppressionSignal {
  const scenarioFamily = classifyIntentE2EScenarioFamily({
    requestInput: input.requestInput,
    targetUrl: typeof input.targetUrl === 'string' ? input.targetUrl : '',
    scenarioCard: null,
    description: '',
  });
  const priorityScenarioFamily = classifyIntentE2EPriorityScenarioFamily({
    requestInput: input.requestInput,
    targetUrl: typeof input.targetUrl === 'string' ? input.targetUrl : '',
    scenarioCard: null,
    description: '',
  });
  const targetPath = normalizeTargetPath(typeof input.targetUrl === 'string' ? input.targetUrl : '');
  const neutral = createNeutralRepeatedFailureSuppressionSignal({
    scenarioFamily,
    priorityScenarioFamily,
    targetPath,
  });

  if (scenarioFamily === 'unknown') {
    return neutral;
  }

  const terminalRuns = runSnapshots.map(normalizeTerminalRun).filter((item): item is InsightRunRecord => Boolean(item));
  const matchedRuns = terminalRuns.filter((run) =>
    matchesRepeatedFailureSuppressionRun(run, {
      scenarioFamily,
      priorityScenarioFamily,
      targetPath,
    })
  );

  if (matchedRuns.length === 0) {
    return neutral;
  }

  const clusters = new Map<string, InsightRunRecord[]>();
  for (const run of matchedRuns) {
    const clusterKey = run.snapshotSignature || `${run.scenarioFamily}|${run.targetPath || run.targetUrl || run.runId}`;
    const current = clusters.get(clusterKey) || [];
    current.push(run);
    clusters.set(clusterKey, current);
  }

  const bestCluster = [...clusters.values()]
    .map((clusterRuns) =>
      analyzeRepeatedFailureSuppressionCluster(clusterRuns, {
        scenarioFamily,
        priorityScenarioFamily,
        targetPath,
      })
    )
    .sort((a, b) => {
      return (
        Number(b.shouldSuppress) - Number(a.shouldSuppress) ||
        b.recentFailureStreak - a.recentFailureStreak ||
        b.matchedFailedRuns - a.matchedFailedRuns ||
        Date.parse(b.latestFinishedAt) - Date.parse(a.latestFinishedAt) ||
        a.matchedSnapshotSignature.localeCompare(b.matchedSnapshotSignature)
      );
    })[0];

  return bestCluster || neutral;
}

function getStarterEligibleRuleSource(
  performance: IntentE2ERulePerformance | undefined
): IntentE2EInsightStarterHelperSource | null {
  if (!performance) return null;
  if (performance.rollbackCandidateCount > 0) return null;
  if (performance.probation?.status === 'degraded' || performance.probation?.status === 'watching') return null;
  if (performance.probation?.status === 'promoted') return 'promoted';
  if (performance.runCount >= 3 && performance.passRate >= 70) return 'stable';
  return null;
}

function resolveKnowledgeChangeRuleSummarySignal(
  summary: Pick<
    IntentE2EInsightKnowledgeChangeRuleSummary,
    'decisionableCount' | 'improvingCount' | 'recoveredCount' | 'regressingCount' | 'stillAbnormalCount'
  >
): IntentE2EInsightStarterHelperKnowledgeChangeSignal | null {
  if (summary.decisionableCount === 0) return null;

  const positiveCount = summary.improvingCount + summary.recoveredCount;
  const negativeCount = summary.regressingCount + summary.stillAbnormalCount;

  if (negativeCount > 0 && negativeCount > positiveCount) {
    return 'negative';
  }

  if (positiveCount > 0 && negativeCount === 0) {
    return 'positive';
  }

  return null;
}

const STARTER_HELPER_PREFERRED_PROMOTION_REQUIRED_POSITIVE_RULE_COUNT = 2;

function buildStarterHelperPreferredAutoPromotionCondition(
  requiredPositiveRuleCount = STARTER_HELPER_PREFERRED_PROMOTION_REQUIRED_POSITIVE_RULE_COUNT
): string {
  return `至少 ${requiredPositiveRuleCount} 条已判定 supporting rules 转为长期正向，且负向 / 混合 signal 清零后，才自动提级为长期优先层。`;
}

function buildStarterHelperKnowledgeChangeEvidence(
  helper: string,
  supportingRuleIds: string[],
  knowledgeChangeRuleSummaryByRuleId: Map<string, IntentE2EInsightKnowledgeChangeRuleSummary>
): {
  tier?: IntentE2EInsightStarterHelperKnowledgeChangeTier;
  watchingKind?: IntentE2EInsightStarterHelperWatchingKind;
  signal?: IntentE2EInsightStarterHelperKnowledgeChangeSignal;
  reason?: string;
  decisionableRuleCount: number;
  supportingAuditIds: string[];
  positiveRuleCount: number;
  negativeRuleCount: number;
} {
  const summaries = uniqueStrings(supportingRuleIds)
    .map((ruleId) => knowledgeChangeRuleSummaryByRuleId.get(ruleId))
    .filter((summary): summary is IntentE2EInsightKnowledgeChangeRuleSummary => Boolean(summary && summary.decisionableCount > 0));
  const positiveSummaries = summaries.filter((summary) => resolveKnowledgeChangeRuleSummarySignal(summary) === 'positive');
  const negativeSummaries = summaries.filter((summary) => resolveKnowledgeChangeRuleSummarySignal(summary) === 'negative');
  const supportingAuditIds = uniqueStrings(summaries.flatMap((summary) => summary.supportingAuditIds));
  const positiveRuleCount = positiveSummaries.length;
  const negativeRuleCount = negativeSummaries.length;

  if (negativeSummaries.length >= 2 && positiveSummaries.length === 0) {
    const ruleSummary =
      negativeSummaries
        .slice(0, 2)
        .map((summary) => summary.title || summary.ruleId)
        .join(' / ') || helper;
    return {
      tier: 'watching',
      signal: 'negative',
      reason: `${helper} 在 ${negativeSummaries.length} 条已判定规则（${ruleSummary}）上的长期效果仍偏负向，暂不适合作为 starter helper 默认推荐。`,
      decisionableRuleCount: summaries.length,
      supportingAuditIds,
      positiveRuleCount,
      negativeRuleCount,
    };
  }

  if (positiveSummaries.length >= 2 && negativeSummaries.length === 0) {
    const ruleSummary =
      positiveSummaries
        .slice(0, 2)
        .map((summary) => summary.title || summary.ruleId)
        .join(' / ') || helper;
    return {
      tier: 'preferred',
      signal: 'positive',
      reason: `${helper} 在 ${positiveSummaries.length} 条已判定规则（${ruleSummary}）上的长期效果持续偏正向，可优先作为 starter helper 复用。`,
      decisionableRuleCount: summaries.length,
      supportingAuditIds,
      positiveRuleCount,
      negativeRuleCount,
    };
  }

  if (positiveSummaries.length > 0 && negativeSummaries.length > 0) {
    const positiveRuleSummary =
      positiveSummaries
        .slice(0, 1)
        .map((summary) => summary.title || summary.ruleId)
        .join(' / ') || helper;
    const negativeRuleSummary =
      negativeSummaries
        .slice(0, 1)
        .map((summary) => summary.title || summary.ruleId)
        .join(' / ') || helper;
    return {
      tier: 'watching',
      watchingKind: 'mixed',
      reason: `${helper} 已出现部分正向恢复证据，但在 ${positiveSummaries.length} 条规则（${positiveRuleSummary}）与 ${negativeSummaries.length} 条规则（${negativeRuleSummary}）上仍呈混合信号，暂按观察对象保守复用。`,
      decisionableRuleCount: summaries.length,
      supportingAuditIds,
      positiveRuleCount,
      negativeRuleCount,
    };
  }

  if (positiveSummaries.length > 0 && negativeSummaries.length === 0) {
    const ruleSummary =
      positiveSummaries
        .slice(0, 2)
        .map((summary) => summary.title || summary.ruleId)
        .join(' / ') || helper;
    return {
      tier: 'watching',
      watchingKind: 'recovering',
      reason: `${helper} 已在 ${positiveSummaries.length} 条已判定规则（${ruleSummary}）上出现正向恢复证据，但证据覆盖面还不足以直接提级为长期正向 starter helper，先继续观察。`,
      decisionableRuleCount: summaries.length,
      supportingAuditIds,
      positiveRuleCount,
      negativeRuleCount,
    };
  }

  return {
    decisionableRuleCount: summaries.length,
    supportingAuditIds,
    positiveRuleCount,
    negativeRuleCount,
  };
}

function buildStarterHelperBaseRecommendation(input: {
  helper: string;
  source: IntentE2EInsightStarterHelperSource;
  supportingRuleIds: string[];
  supportingRuleTitles: string[];
  runCount: number;
  passRate: number;
  suggestedReuseRuns: number;
}): string {
  const sourceLabel = input.source === 'promoted' ? '已转正规则' : '稳定规则';
  const ruleSummary =
    input.supportingRuleTitles.slice(0, 2).join(' / ') ||
    input.supportingRuleIds.slice(0, 2).join(' / ') ||
    input.helper;
  return `${input.helper} 已在 ${sourceLabel} ${ruleSummary} 中复用 ${input.runCount} 次，通过率 ${input.passRate}%${
    input.suggestedReuseRuns > 0 ? `，其中 ${input.suggestedReuseRuns} 次直接命中知识推荐` : ''
  }；适合作为新项目首轮生成时优先尝试的 starter helper。`;
}

function compareStarterHelperItems(left: IntentE2EInsightStarterHelper, right: IntentE2EInsightStarterHelper): number {
  const sourceRank = { promoted: 1, stable: 0 } satisfies Record<IntentE2EInsightStarterHelperSource, number>;
  const resolveTierRank = (item: IntentE2EInsightStarterHelper): number => {
    if (item.knowledgeChangeSignal === 'positive') return 3;
    if (item.knowledgeChangeTier === 'watching' && item.knowledgeChangeWatchingKind === 'recovering') return 2;
    if (item.knowledgeChangeTier === 'watching') return 1;
    return 0;
  };

  return (
    sourceRank[right.source] - sourceRank[left.source] ||
    resolveTierRank(right) - resolveTierRank(left) ||
    right.passRate - left.passRate ||
    right.passedRuns - left.passedRuns ||
    right.suggestedReuseRuns - left.suggestedReuseRuns ||
    left.helper.localeCompare(right.helper)
  );
}

function compareSuppressedStarterHelperItems(
  left: IntentE2EInsightSuppressedStarterHelper,
  right: IntentE2EInsightSuppressedStarterHelper
): number {
  const sourceRank = { promoted: 1, stable: 0 } satisfies Record<IntentE2EInsightStarterHelperSource, number>;
  return (
    sourceRank[right.source] - sourceRank[left.source] ||
    (right.knowledgeChangeDecisionableRuleCount || 0) - (left.knowledgeChangeDecisionableRuleCount || 0) ||
    right.passRate - left.passRate ||
    right.passedRuns - left.passedRuns ||
    left.helper.localeCompare(right.helper)
  );
}

function evaluateStarterHelperPreferredPromotionRecommendation(input: {
  helper: string;
  knowledgeChangeTier?: IntentE2EInsightStarterHelperKnowledgeChangeTier;
  knowledgeChangeWatchingKind?: IntentE2EInsightStarterHelperWatchingKind;
  knowledgeChangeSignal?: IntentE2EInsightStarterHelperKnowledgeChangeSignal;
  governanceReleaseStatus?: 'released_from_suppressed';
  positiveRuleCount: number;
  negativeRuleCount: number;
}): Pick<
  IntentE2EInsightStarterHelper,
  | 'preferredPromotionStatus'
  | 'preferredPromotionReason'
  | 'preferredAutoPromotionCondition'
  | 'preferredPromotionRequiredPositiveRuleCount'
  | 'preferredPromotionPositiveRuleCount'
  | 'preferredPromotionNegativeRuleCount'
> {
  const empty = {
    preferredPromotionStatus: undefined,
    preferredPromotionReason: '',
    preferredAutoPromotionCondition: '',
    preferredPromotionRequiredPositiveRuleCount: 0,
    preferredPromotionPositiveRuleCount: 0,
    preferredPromotionNegativeRuleCount: 0,
  } satisfies Pick<
    IntentE2EInsightStarterHelper,
    | 'preferredPromotionStatus'
    | 'preferredPromotionReason'
    | 'preferredAutoPromotionCondition'
    | 'preferredPromotionRequiredPositiveRuleCount'
    | 'preferredPromotionPositiveRuleCount'
    | 'preferredPromotionNegativeRuleCount'
  >;

  if (input.knowledgeChangeSignal === 'positive' || input.knowledgeChangeTier === 'preferred') {
    return empty;
  }

  if (input.knowledgeChangeTier !== 'watching') {
    return empty;
  }

  const preferredAutoPromotionCondition = buildStarterHelperPreferredAutoPromotionCondition();
  const common = {
    preferredAutoPromotionCondition,
    preferredPromotionRequiredPositiveRuleCount: STARTER_HELPER_PREFERRED_PROMOTION_REQUIRED_POSITIVE_RULE_COUNT,
    preferredPromotionPositiveRuleCount: input.positiveRuleCount,
    preferredPromotionNegativeRuleCount: input.negativeRuleCount,
  } satisfies Pick<
    IntentE2EInsightStarterHelper,
    | 'preferredAutoPromotionCondition'
    | 'preferredPromotionRequiredPositiveRuleCount'
    | 'preferredPromotionPositiveRuleCount'
    | 'preferredPromotionNegativeRuleCount'
  >;

  if (input.governanceReleaseStatus === 'released_from_suppressed') {
    return {
      ...common,
      preferredPromotionStatus: 'await_long_term_recovery',
      preferredPromotionReason: `${input.helper} 虽已从 suppressed 治理恢复释放，但治理恢复只解除 starter 供给隔离，不等于长期正向 evidence 已建立；当前不会直接提级为长期优先层。`,
    };
  }

  if (input.knowledgeChangeTier === 'watching' && input.knowledgeChangeWatchingKind === 'mixed') {
    return {
      ...common,
      preferredPromotionStatus: 'blocked_by_mixed_evidence',
      preferredPromotionReason: `${input.helper} 当前长期 evidence 仍呈混合信号（正向 ${input.positiveRuleCount} 条 / 负向 ${input.negativeRuleCount} 条），需先清零冲突信号后再评估提级。`,
    };
  }

  if (input.knowledgeChangeTier === 'watching' && input.knowledgeChangeWatchingKind === 'recovering') {
    return {
      ...common,
      preferredPromotionStatus: 'await_more_positive_rules',
      preferredPromotionReason: `${input.helper} 当前长期正向已判定规则 ${input.positiveRuleCount}/${STARTER_HELPER_PREFERRED_PROMOTION_REQUIRED_POSITIVE_RULE_COUNT} 条，尚不足以自动提级为长期优先层。`,
    };
  }

  return empty;
}

type SuppressedStarterHelperGovernanceRecoveryProgress = {
  governanceCapabilities: IntentE2EInsightSuppressedStarterHelperGovernanceCapability[];
  governanceTargetCapabilityCount: number;
  requiredPassedCapabilityCount: number;
  passedCapabilities: IntentE2EInsightSuppressedStarterHelperGovernanceCapability[];
  qualifiedPassedCapabilities: IntentE2EInsightSuppressedStarterHelperGovernanceCapability[];
  directVerifyPassedCapabilities: IntentE2EInsightSuppressedStarterHelperGovernanceCapability[];
  manualRepairPassedCapabilities: IntentE2EInsightSuppressedStarterHelperGovernanceCapability[];
  autoRepairPassedCapabilities: IntentE2EInsightSuppressedStarterHelperGovernanceCapability[];
  hasHelperFailurePressure: boolean;
  hasGovernanceFailure: boolean;
};

function summarizeSuppressedStarterHelperGovernanceRecoveryProgress(
  item: IntentE2EInsightSuppressedStarterHelper
): SuppressedStarterHelperGovernanceRecoveryProgress {
  const governanceCapabilities = item.governanceCapabilities || [];
  const governanceTargetCapabilityCount = Math.max(item.governanceTargetCapabilityCount || 0, governanceCapabilities.length);
  const requiredPassedCapabilityCount = governanceTargetCapabilityCount > 0 ? Math.min(2, governanceTargetCapabilityCount) : 0;
  const hasHelperFailurePressure =
    (item.recentFailedReviewCapabilityCount || 0) > 0 ||
    (item.recentFailedVerifyCapabilityCount || 0) > 0 ||
    (item.recentFailedReviewExecutionCount || 0) > 0 ||
    (item.recentFailedVerifyExecutionCount || 0) > 0;
  const hasGovernanceFailure =
    (item.recentFailedGovernanceReviewExecutionCount || 0) > 0 ||
    (item.recentFailedGovernanceVerifyExecutionCount || 0) > 0 ||
    (item.recentFailedGovernanceRepairExecutionCount || 0) > 0;
  const passedCapabilities = governanceCapabilities.filter((capability) => capability.latestExecutionStatus === 'passed');
  const manualRepairPassedCapabilities = governanceCapabilities.filter(
    (capability) =>
      capability.latestExecutionStatus === 'passed' &&
      capability.latestExecutionSource === 'repair' &&
      capability.latestRepairTriggerKind === 'manual'
  );
  const autoRepairPassedCapabilities = governanceCapabilities.filter(
    (capability) =>
      capability.latestExecutionStatus === 'passed' &&
      capability.latestExecutionSource === 'repair' &&
      capability.latestRepairTriggerKind === 'auto'
  );
  const qualifiedPassedCapabilities = governanceCapabilities.filter(
    (capability) =>
      capability.latestExecutionStatus === 'passed' &&
      (capability.latestExecutionSource === 'direct' || capability.latestRepairTriggerKind === 'manual')
  );
  const directVerifyPassedCapabilities = governanceCapabilities.filter(
    (capability) =>
      capability.latestExecutionStatus === 'passed' &&
      capability.latestExecutionIntent === 'verify' &&
      capability.latestExecutionSource === 'direct'
  );

  return {
    governanceCapabilities,
    governanceTargetCapabilityCount,
    requiredPassedCapabilityCount,
    passedCapabilities,
    qualifiedPassedCapabilities,
    directVerifyPassedCapabilities,
    manualRepairPassedCapabilities,
    autoRepairPassedCapabilities,
    hasHelperFailurePressure,
    hasGovernanceFailure,
  };
}

function canReleaseSuppressedStarterHelperFromGovernance(
  item: IntentE2EInsightSuppressedStarterHelper,
  progress: SuppressedStarterHelperGovernanceRecoveryProgress
): boolean {
  if (progress.governanceTargetCapabilityCount <= 0 || progress.requiredPassedCapabilityCount <= 0) return false;
  if (progress.governanceCapabilities.length < progress.requiredPassedCapabilityCount) return false;
  if (progress.hasHelperFailurePressure || progress.hasGovernanceFailure) return false;
  if ((item.recentGovernanceVerifyExecutionCount || 0) <= 0) return false;
  if (progress.qualifiedPassedCapabilities.length < progress.requiredPassedCapabilityCount) return false;
  if (progress.directVerifyPassedCapabilities.length <= 0) return false;
  return true;
}

function buildSuppressedStarterHelperGovernanceAutoUnlockCondition(
  progress: SuppressedStarterHelperGovernanceRecoveryProgress
): string {
  if (progress.governanceTargetCapabilityCount <= 0 || progress.requiredPassedCapabilityCount <= 0) {
    return '先补足至少 1 条治理目标能力，再进入自动解封判定。';
  }

  return `最近失败窗口清零，且至少 ${progress.requiredPassedCapabilityCount}/${progress.governanceTargetCapabilityCount} 条治理目标能力最新状态恢复为通过（直接验证通过或人工 repair 通过），并至少 1 条完成直接标准验证通过；自动 repair 仅作为观察信号，不计入自动解封通过覆盖。`;
}

function evaluateSuppressedStarterHelperGovernanceRecommendation(
  item: IntentE2EInsightSuppressedStarterHelper
): Pick<
  IntentE2EInsightSuppressedStarterHelper,
  | 'governanceRecommendationStatus'
  | 'governanceRecommendationReason'
  | 'governanceAutoUnlockCondition'
  | 'governanceRequiredPassedCapabilityCount'
  | 'governancePassedCapabilityCount'
  | 'governanceDirectVerifyPassedCapabilityCount'
  | 'governanceManualRepairPassedCapabilityCount'
  | 'governanceAutoRepairPassedCapabilityCount'
> {
  const progress = summarizeSuppressedStarterHelperGovernanceRecoveryProgress(item);
  const governanceAutoUnlockCondition = buildSuppressedStarterHelperGovernanceAutoUnlockCondition(progress);
  const common = {
    governanceAutoUnlockCondition,
    governanceRequiredPassedCapabilityCount: progress.requiredPassedCapabilityCount,
    governancePassedCapabilityCount: progress.qualifiedPassedCapabilities.length,
    governanceDirectVerifyPassedCapabilityCount: progress.directVerifyPassedCapabilities.length,
    governanceManualRepairPassedCapabilityCount: progress.manualRepairPassedCapabilities.length,
    governanceAutoRepairPassedCapabilityCount: progress.autoRepairPassedCapabilities.length,
  } satisfies Pick<
    IntentE2EInsightSuppressedStarterHelper,
    | 'governanceAutoUnlockCondition'
    | 'governanceRequiredPassedCapabilityCount'
    | 'governancePassedCapabilityCount'
    | 'governanceDirectVerifyPassedCapabilityCount'
    | 'governanceManualRepairPassedCapabilityCount'
    | 'governanceAutoRepairPassedCapabilityCount'
  >;

  if (progress.governanceTargetCapabilityCount <= 0 || progress.requiredPassedCapabilityCount <= 0) {
    return {
      ...common,
      governanceRecommendationStatus: 'await_governance_targets',
      governanceRecommendationReason: `${item.helper} 当前还没有可跟踪的治理目标能力，暂时无法进入自动解封判定。`,
    };
  }

  if (progress.hasHelperFailurePressure || progress.hasGovernanceFailure) {
    const failureReasons: string[] = [];
    if (progress.hasHelperFailurePressure) failureReasons.push('helper 失败窗口未清零');
    if (progress.hasGovernanceFailure) failureReasons.push('治理轨迹仍有失败');
    return {
      ...common,
      governanceRecommendationStatus: 'blocked_by_recent_failures',
      governanceRecommendationReason: `${item.helper} 近 ${item.recentFailureWindowDays || 14} 天仍存在 ${failureReasons.join(' / ')}，继续保持 suppressed。`,
    };
  }

  if ((item.recentGovernanceVerifyExecutionCount || 0) <= 0 || progress.directVerifyPassedCapabilities.length <= 0) {
    return {
      ...common,
      governanceRecommendationStatus: 'await_direct_verify',
      governanceRecommendationReason: `${item.helper} 已有治理回执，但还缺少直接标准验证通过；仅靠 review / repair 结果不自动解封。`,
    };
  }

  if (
    progress.governanceCapabilities.length < progress.requiredPassedCapabilityCount ||
    progress.qualifiedPassedCapabilities.length < progress.requiredPassedCapabilityCount
  ) {
    const weakRecoverySuffix =
      progress.autoRepairPassedCapabilities.length > 0
        ? ` 当前另有 ${progress.autoRepairPassedCapabilities.length} 条仅通过自动 repair 恢复，自动 repair 只记为弱恢复信号，不能单独支撑自动解封。`
        : '';
    return {
      ...common,
      governanceRecommendationStatus: 'await_more_capability_recovery',
      governanceRecommendationReason: `${item.helper} 已出现直接标准验证通过，但治理目标能力通过覆盖仍不足；当前可计入解封的最新通过 ${progress.qualifiedPassedCapabilities.length}/${progress.governanceTargetCapabilityCount} 条，自动解封至少需要 ${progress.requiredPassedCapabilityCount} 条。${weakRecoverySuffix}`,
    };
  }

  return {
    ...common,
    governanceRecommendationStatus: undefined,
    governanceRecommendationReason: '',
  };
}

function buildRecoveredWatchingStarterHelperFromSuppressed(
  item: IntentE2EInsightSuppressedStarterHelper
): IntentE2EInsightStarterHelper | null {
  const recoveryProgress = summarizeSuppressedStarterHelperGovernanceRecoveryProgress(item);
  if (!canReleaseSuppressedStarterHelperFromGovernance(item, recoveryProgress)) return null;

  const {
    governanceTargetCapabilityCount,
    requiredPassedCapabilityCount,
    qualifiedPassedCapabilities,
    directVerifyPassedCapabilities,
    manualRepairPassedCapabilities,
    autoRepairPassedCapabilities,
  } = recoveryProgress;

  const capabilitySummary =
    qualifiedPassedCapabilities
      .slice(0, 2)
      .map((capability) => capability.name || capability.slug)
      .join(' / ') || item.helper;
  const recoveryReason = `${item.helper} 虽然在长期规则 evidence 上仍有负向历史，但最近治理目标 ${requiredPassedCapabilityCount} 条能力（${capabilitySummary}）已形成无失败恢复轨迹，且至少 1 条完成直接标准验证通过，先从 suppression 降级为恢复观察。`;
  const governanceReleaseLatestVerifyExecutionAt = item.latestGovernanceVerifyExecutionAt || '';
  const preferredPromotionRecommendation = evaluateStarterHelperPreferredPromotionRecommendation({
    helper: item.helper,
    knowledgeChangeTier: 'watching',
    knowledgeChangeWatchingKind: 'recovering',
    governanceReleaseStatus: 'released_from_suppressed',
    positiveRuleCount: 0,
    negativeRuleCount: 0,
  });

  return {
    helper: item.helper,
    runCount: item.runCount,
    passedRuns: item.passedRuns,
    passRate: item.passRate,
    suggestedReuseRuns: item.suggestedReuseRuns,
    source: item.source,
    supportingRuleIds: item.supportingRuleIds,
    supportingRuleTitles: item.supportingRuleTitles,
    knowledgeChangeTier: 'watching',
    knowledgeChangeWatchingKind: 'recovering',
    knowledgeChangeSignalReason: recoveryReason,
    knowledgeChangeDecisionableRuleCount: item.knowledgeChangeDecisionableRuleCount,
    knowledgeChangeSupportingAuditIds: item.knowledgeChangeSupportingAuditIds,
    ...preferredPromotionRecommendation,
    governanceReleaseStatus: 'released_from_suppressed',
    governanceReleaseReason: recoveryReason,
    governanceReleaseCapabilityCount: governanceTargetCapabilityCount,
    governanceReleaseDirectVerifyPassedCapabilityCount: directVerifyPassedCapabilities.length,
    governanceReleaseLatestVerifyExecutionAt,
    governanceReleaseManualRepairPassedCapabilityCount: manualRepairPassedCapabilities.length,
    governanceReleaseAutoRepairPassedCapabilityCount: autoRepairPassedCapabilities.length,
    recentFailedReviewCapabilityCount: item.recentFailedReviewCapabilityCount,
    recentFailedVerifyCapabilityCount: item.recentFailedVerifyCapabilityCount,
    recentFailedReviewExecutionCount: item.recentFailedReviewExecutionCount,
    recentFailedVerifyExecutionCount: item.recentFailedVerifyExecutionCount,
    recentFailureWindowDays: item.recentFailureWindowDays,
    recommendation: `${buildStarterHelperBaseRecommendation({
      helper: item.helper,
      source: item.source,
      supportingRuleIds: item.supportingRuleIds,
      supportingRuleTitles: item.supportingRuleTitles,
      runCount: item.runCount,
      passRate: item.passRate,
      suggestedReuseRuns: item.suggestedReuseRuns,
    })} ${recoveryReason} 当前可重新进入 starter helper 供给，但只应按恢复观察层保守使用。`,
  };
}

export function reconcileIntentStarterHelpersWithSuppressedGovernance(input: {
  starterHelpers: IntentE2EInsightStarterHelper[];
  suppressedStarterHelpers: IntentE2EInsightSuppressedStarterHelper[];
}): {
  starterHelpers: IntentE2EInsightStarterHelper[];
  suppressedStarterHelpers: IntentE2EInsightSuppressedStarterHelper[];
} {
  const starterHelpers = [...input.starterHelpers];
  const suppressedStarterHelpers: IntentE2EInsightSuppressedStarterHelper[] = [];
  const seenStarterHelpers = new Set(starterHelpers.map((item) => item.helper));

  for (const item of input.suppressedStarterHelpers) {
    const recoveredHelper = buildRecoveredWatchingStarterHelperFromSuppressed(item);
    if (recoveredHelper && !seenStarterHelpers.has(recoveredHelper.helper)) {
      starterHelpers.push(recoveredHelper);
      seenStarterHelpers.add(recoveredHelper.helper);
      continue;
    }
    suppressedStarterHelpers.push(item);
  }

  return {
    starterHelpers: starterHelpers.sort(compareStarterHelperItems).slice(0, 5),
    suppressedStarterHelpers: suppressedStarterHelpers.sort(compareSuppressedStarterHelperItems).slice(0, 5),
  };
}

function buildStarterHelpers(
  runs: InsightRunRecord[],
  rulePerformanceById: Record<string, IntentE2ERulePerformance>,
  knowledgeChangeRuleSummaries: IntentE2EInsightKnowledgeChangeRuleSummary[]
): {
  starterHelpers: IntentE2EInsightStarterHelper[];
  suppressedStarterHelpers: IntentE2EInsightSuppressedStarterHelper[];
} {
  const knowledgeChangeRuleSummaryByRuleId = new Map(knowledgeChangeRuleSummaries.map((summary) => [summary.ruleId, summary]));
  const stats = new Map<
    string,
    {
      runIds: Set<string>;
      passedRunIds: Set<string>;
      suggestedReuseRunIds: Set<string>;
      supportingRuleIds: Set<string>;
      supportingRuleTitles: Set<string>;
      promotedSourceRuleIds: Set<string>;
    }
  >();

  for (const run of runs) {
    const supportingRules = run.matchedRuleIds.reduce<
      Array<{ ruleId: string; title: string; source: IntentE2EInsightStarterHelperSource }>
    >((items, ruleId, index) => {
      const source = getStarterEligibleRuleSource(rulePerformanceById[ruleId]);
      if (!source) return items;
      items.push({
        ruleId,
        title: run.matchedRuleTitles[index] || rulePerformanceById[ruleId]?.title || ruleId,
        source,
      });
      return items;
    }, []);

    if (supportingRules.length === 0 || run.usedHelpers.length === 0) {
      continue;
    }

    for (const helper of run.usedHelpers) {
      const current = stats.get(helper) || {
        runIds: new Set<string>(),
        passedRunIds: new Set<string>(),
        suggestedReuseRunIds: new Set<string>(),
        supportingRuleIds: new Set<string>(),
        supportingRuleTitles: new Set<string>(),
        promotedSourceRuleIds: new Set<string>(),
      };
      current.runIds.add(run.runId);
      if (run.status === 'passed') {
        current.passedRunIds.add(run.runId);
      }
      if (run.usedSuggestedHelpers.includes(helper)) {
        current.suggestedReuseRunIds.add(run.runId);
      }
      for (const rule of supportingRules) {
        current.supportingRuleIds.add(rule.ruleId);
        current.supportingRuleTitles.add(rule.title);
        if (rule.source === 'promoted') {
          current.promotedSourceRuleIds.add(rule.ruleId);
        }
      }
      stats.set(helper, current);
    }
  }

  const candidates = [...stats.entries()]
    .map(([helper, current]) => {
      const runCount = current.runIds.size;
      const passedRuns = current.passedRunIds.size;
      const passRate = toPercent(passedRuns, runCount);
      const source: IntentE2EInsightStarterHelperSource = current.promotedSourceRuleIds.size > 0 ? 'promoted' : 'stable';
      const supportingRuleIds = [...current.supportingRuleIds];
      const supportingRuleTitles = [...current.supportingRuleTitles];
      const knowledgeChangeEvidence = buildStarterHelperKnowledgeChangeEvidence(
        helper,
        supportingRuleIds,
        knowledgeChangeRuleSummaryByRuleId
      );
      const suggestedReuseRuns = current.suggestedReuseRunIds.size;
      const baseRecommendation = buildStarterHelperBaseRecommendation({
        helper,
        source,
        supportingRuleIds,
        supportingRuleTitles,
        runCount,
        passRate,
        suggestedReuseRuns,
      });
      const preferredPromotionRecommendation = evaluateStarterHelperPreferredPromotionRecommendation({
        helper,
        knowledgeChangeTier: knowledgeChangeEvidence.tier,
        knowledgeChangeWatchingKind: knowledgeChangeEvidence.watchingKind,
        knowledgeChangeSignal: knowledgeChangeEvidence.signal,
        positiveRuleCount: knowledgeChangeEvidence.positiveRuleCount,
        negativeRuleCount: knowledgeChangeEvidence.negativeRuleCount,
      });

      return {
        helper,
        runCount,
        passedRuns,
        passRate,
        suggestedReuseRuns,
        source,
        supportingRuleIds,
        supportingRuleTitles,
        knowledgeChangeTier: knowledgeChangeEvidence.tier,
        knowledgeChangeWatchingKind: knowledgeChangeEvidence.watchingKind,
        knowledgeChangeSignal: knowledgeChangeEvidence.signal,
        knowledgeChangeSignalReason: knowledgeChangeEvidence.reason,
        knowledgeChangeDecisionableRuleCount:
          knowledgeChangeEvidence.decisionableRuleCount > 0 ? knowledgeChangeEvidence.decisionableRuleCount : undefined,
        knowledgeChangeSupportingAuditIds:
          knowledgeChangeEvidence.supportingAuditIds.length > 0 ? knowledgeChangeEvidence.supportingAuditIds : undefined,
        ...preferredPromotionRecommendation,
        recommendation:
          knowledgeChangeEvidence.signal === 'positive' && knowledgeChangeEvidence.reason
            ? `${baseRecommendation} ${knowledgeChangeEvidence.reason}`
            : baseRecommendation,
      } satisfies IntentE2EInsightStarterHelper;
    })
    .filter((item) => item.runCount >= 2 && item.passedRuns >= 2 && item.passRate >= 70);

  const starterHelpers = candidates
    .filter((item) => item.knowledgeChangeSignal !== 'negative')
    .sort(compareStarterHelperItems)
    .slice(0, 5);
  const suppressedStarterHelpers = candidates
    .flatMap((item) => {
      const reason =
        item.knowledgeChangeSignal === 'negative' ? String(item.knowledgeChangeSignalReason || '').trim() : '';
      if (!reason) return [];
      return [
        {
          helper: item.helper,
          runCount: item.runCount,
          passedRuns: item.passedRuns,
          passRate: item.passRate,
          suggestedReuseRuns: item.suggestedReuseRuns,
          source: item.source,
          supportingRuleIds: item.supportingRuleIds,
          supportingRuleTitles: item.supportingRuleTitles,
          knowledgeChangeSignal: 'negative' as const,
          knowledgeChangeSignalReason: reason,
          knowledgeChangeDecisionableRuleCount: item.knowledgeChangeDecisionableRuleCount,
          knowledgeChangeSupportingAuditIds: item.knowledgeChangeSupportingAuditIds,
          suppressionReason: reason,
        } satisfies IntentE2EInsightSuppressedStarterHelper,
      ];
    })
    .sort(compareSuppressedStarterHelperItems)
    .slice(0, 5);

  return {
    starterHelpers,
    suppressedStarterHelpers,
  };
}

function buildProbationRules(
  runs: InsightRunRecord[],
  audits: IntentProjectKnowledgeAuditEntry[],
  observationWindow = 6,
  limit = 6
): IntentE2EInsightProbationRule[] {
  const terminalRuns = [...runs].sort((a, b) => a.finishedAtMs - b.finishedAtMs);
  const baselineWindow = 5;
  const decisionRuns = 3;

  return audits
    .filter((audit) => audit.operation === 'merge' && audit.comparison.addedRuleIds.length > 0)
    .map((audit) => {
      const occurredAtMs = toTimestamp(audit.occurredAt);
      const scopedRuns = filterRunsForAuditScope(terminalRuns, audit);
      const beforeWindow = scopedRuns.filter((run) => run.finishedAtMs && run.finishedAtMs < occurredAtMs).slice(-baselineWindow);
      const observedWindow = scopedRuns.filter((run) => run.finishedAtMs && run.finishedAtMs > occurredAtMs).slice(0, observationWindow);
      const beforePassedRuns = beforeWindow.filter((run) => run.status === 'passed').length;
      const beforeFirstPassPassedRuns = beforeWindow.filter((run) => run.firstPassSucceeded).length;
      const observedPassedRuns = observedWindow.filter((run) => run.status === 'passed').length;
      const observedFailedRuns = observedWindow.filter((run) => run.status === 'failed').length;
      const observedCanceledRuns = observedWindow.filter((run) => run.status === 'canceled').length;
      const observedFirstPassPassedRuns = observedWindow.filter((run) => run.firstPassSucceeded).length;
      const beforePassRate = toPercent(beforePassedRuns, beforeWindow.length);
      const beforeFirstPassRate = toPercent(beforeFirstPassPassedRuns, beforeWindow.length);
      const observedPassRate = toPercent(observedPassedRuns, observedWindow.length);
      const observedFirstPassRate = toPercent(observedFirstPassPassedRuns, observedWindow.length);
      const passRateDelta = roundRateDelta(beforePassRate, observedPassRate);
      const firstPassRateDelta = roundRateDelta(beforeFirstPassRate, observedFirstPassRate);
      const remainingRuns = Math.max(0, observationWindow - observedWindow.length);
      const mergedCandidateSources = getAuditMergedCandidateSources(audit);
      const mergedRunIds = getAuditMergedRunIds(audit);
      const mergedCandidates = getAuditMergedCandidates(audit);
      const requestedModuleUid = getAuditRequestedModuleUid(audit);
      const selectedCandidateFeedbackStatuses = getAuditSelectedCandidateFeedbackStatuses(audit);
      const selectedRiskyCandidateIds = getAuditSelectedRiskyCandidateIds(audit);
      const appliedOverrideCandidateIds = getAuditAppliedOverrideCandidateIds(audit);
      const appliedOverrideCandidateFeedbackStatuses = getAuditAppliedOverrideCandidateFeedbackStatuses(audit);
      const appliedAcknowledgedRiskCandidateIds = getAuditAppliedAcknowledgedRiskCandidateIds(audit);
      const appliedAcknowledgedRiskCandidateFeedbackStatuses = getAuditAppliedAcknowledgedRiskCandidateFeedbackStatuses(audit);
      const successfulRunMerge = isSuccessfulRunMergeAudit(audit);
      const firstPassRegression =
        successfulRunMerge && beforeWindow.length >= decisionRuns && firstPassRateDelta >= 25;
      const impactStatus = classifyMergeImpactStatus(passRateDelta, firstPassRateDelta);

      let status: IntentE2EInsightProbationStatus = 'watching';
      if (
        observedWindow.length >= decisionRuns &&
        (
          observedPassRate <= 35 ||
          (beforeWindow.length >= decisionRuns && passRateDelta >= 15) ||
          firstPassRegression
        )
      ) {
        status = 'degraded';
      } else if (observedWindow.length >= observationWindow) {
        status = 'promoted';
      }

      const scopeSummary = requestedModuleUid ? `模块 ${requestedModuleUid}` : audit.projectUid ? `项目 ${audit.projectUid}` : '当前全局';
      const sourceSummary = mergedCandidateSources.length > 0 ? `来源 ${mergedCandidateSources.join(' / ')}` : '来源未标记';
      const rateSummary = `终态通过率 ${beforePassRate}% -> ${observedPassRate}%；首次通过率 ${beforeFirstPassRate}% -> ${observedFirstPassRate}%`;

      const recommendation =
        status === 'degraded'
          ? `观察期内 ${scopeSummary} 最近 ${observedWindow.length} 次运行中，${rateSummary}；${sourceSummary} 的这批规则已判定为回退风险，建议先自动降权 ${
              audit.comparison.addedRuleIds.slice(0, 2).join(' / ') || audit.title
            }，必要时回滚到 ${audit.backupPath || '最近备份'}。`
          : status === 'promoted'
          ? `新增规则已完成观察期；${scopeSummary} 最近 ${observedWindow.length} 次运行中，${rateSummary}；${sourceSummary} 可视为已转正。`
          : `新增规则仍在观察期；${scopeSummary} 已观察 ${observedWindow.length} / ${observationWindow} 次终态运行，当前 ${rateSummary}；若继续下滑，会自动降权并提示回滚。`;

      return {
        auditId: audit.auditId,
        occurredAt: audit.occurredAt,
        projectUid: audit.projectUid,
        requestedModuleUid: requestedModuleUid || undefined,
        title: audit.title,
        backupPath: audit.backupPath,
        addedRuleIds: [...audit.comparison.addedRuleIds],
        mergedCandidateSources,
        mergedRunIds,
        mergedCandidates,
        selectedCandidateFeedbackStatuses,
        selectedRiskyCandidateIds,
        appliedOverrideCandidateIds,
        appliedOverrideCandidateFeedbackStatuses,
        appliedAcknowledgedRiskCandidateIds,
        appliedAcknowledgedRiskCandidateFeedbackStatuses,
        beforeRuns: beforeWindow.length,
        beforePassRate,
        beforeFirstPassRate,
        observedRuns: observedWindow.length,
        observedPassedRuns,
        observedFailedRuns,
        observedCanceledRuns,
        observedPassRate,
        observedFirstPassPassedRuns,
        observedFirstPassRate,
        firstPassRateDelta,
        impactStatus,
        remainingRuns,
        status,
        recommendation,
      } satisfies IntentE2EInsightProbationRule;
    })
    .sort((a, b) => {
      const statusRank = { degraded: 0, watching: 1, promoted: 2 } satisfies Record<IntentE2EInsightProbationStatus, number>;
      return statusRank[a.status] - statusRank[b.status] || Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
    })
    .slice(0, Math.max(1, Math.floor(limit || 6)));
}

function buildRollbackCandidates(
  runs: InsightRunRecord[],
  audits: IntentProjectKnowledgeAuditEntry[],
  limit = 3
): IntentE2EInsightRollbackCandidate[] {
  const terminalRuns = [...runs].sort((a, b) => a.finishedAtMs - b.finishedAtMs);
  const windowSize = 5;
  const minWindowRuns = 3;

  return audits
    .filter((audit) => audit.operation === 'merge' && audit.backupPath && audit.comparison.addedRuleIds.length > 0)
    .map((audit) => {
      const occurredAtMs = toTimestamp(audit.occurredAt);
      const scopedRuns = filterRunsForAuditScope(terminalRuns, audit);
      const beforeWindow = scopedRuns.filter((run) => run.finishedAtMs && run.finishedAtMs < occurredAtMs).slice(-windowSize);
      const afterWindow = scopedRuns.filter((run) => run.finishedAtMs && run.finishedAtMs > occurredAtMs).slice(0, windowSize);
      const beforePassedRuns = beforeWindow.filter((run) => run.status === 'passed').length;
      const beforeFirstPassPassedRuns = beforeWindow.filter((run) => run.firstPassSucceeded).length;
      const afterPassedRuns = afterWindow.filter((run) => run.status === 'passed').length;
      const afterFirstPassPassedRuns = afterWindow.filter((run) => run.firstPassSucceeded).length;
      const beforePassRate = toPercent(beforePassedRuns, beforeWindow.length);
      const beforeFirstPassRate = toPercent(beforeFirstPassPassedRuns, beforeWindow.length);
      const afterPassRate = toPercent(afterPassedRuns, afterWindow.length);
      const afterFirstPassRate = toPercent(afterFirstPassPassedRuns, afterWindow.length);
      const passRateDelta = roundRateDelta(beforePassRate, afterPassRate);
      const firstPassRateDelta = roundRateDelta(beforeFirstPassRate, afterFirstPassRate);
      const mergedCandidateSources = getAuditMergedCandidateSources(audit);
      const mergedRunIds = getAuditMergedRunIds(audit);
      const mergedCandidates = getAuditMergedCandidates(audit);
      const requestedModuleUid = getAuditRequestedModuleUid(audit);
      const selectedCandidateFeedbackStatuses = getAuditSelectedCandidateFeedbackStatuses(audit);
      const selectedRiskyCandidateIds = getAuditSelectedRiskyCandidateIds(audit);
      const appliedOverrideCandidateIds = getAuditAppliedOverrideCandidateIds(audit);
      const appliedOverrideCandidateFeedbackStatuses = getAuditAppliedOverrideCandidateFeedbackStatuses(audit);
      const appliedAcknowledgedRiskCandidateIds = getAuditAppliedAcknowledgedRiskCandidateIds(audit);
      const appliedAcknowledgedRiskCandidateFeedbackStatuses = getAuditAppliedAcknowledgedRiskCandidateFeedbackStatuses(audit);
      const impactStatus = classifyMergeImpactStatus(passRateDelta, firstPassRateDelta);
      const successfulRunMerge = isSuccessfulRunMergeAudit(audit);
      const scopeSummary = requestedModuleUid ? `模块 ${requestedModuleUid}` : audit.projectUid ? `项目 ${audit.projectUid}` : '当前全局';
      const sourceSummary = mergedCandidateSources.length > 0 ? `来源 ${mergedCandidateSources.join(' / ')}` : '来源未标记';
      const riskSummary =
        passRateDelta >= firstPassRateDelta
          ? `终态通过率从 ${beforePassRate}% 降到 ${afterPassRate}%`
          : `首次通过率从 ${beforeFirstPassRate}% 降到 ${afterFirstPassRate}%`;

      return {
        auditId: audit.auditId,
        occurredAt: audit.occurredAt,
        projectUid: audit.projectUid,
        requestedModuleUid: requestedModuleUid || undefined,
        title: audit.title,
        backupPath: audit.backupPath,
        addedRuleIds: [...audit.comparison.addedRuleIds],
        mergedCandidateSources,
        mergedRunIds,
        mergedCandidates,
        selectedCandidateFeedbackStatuses,
        selectedRiskyCandidateIds,
        appliedOverrideCandidateIds,
        appliedOverrideCandidateFeedbackStatuses,
        appliedAcknowledgedRiskCandidateIds,
        appliedAcknowledgedRiskCandidateFeedbackStatuses,
        beforeRuns: beforeWindow.length,
        beforePassRate,
        beforeFirstPassRate,
        afterRuns: afterWindow.length,
        afterPassRate,
        afterFirstPassRate,
        passRateDelta,
        firstPassRateDelta,
        impactStatus,
        recommendation: `该次规则合并后，${scopeSummary} 最近 ${afterWindow.length} 次运行中，${riskSummary}；${
          successfulRunMerge ? '这批 successful run 候选未带来预期的首轮收益，' : ''
        }${sourceSummary} 建议优先检查 ${audit.comparison.addedRuleIds.slice(0, 2).join(' / ') || audit.title}，必要时回滚到 ${audit.backupPath}。`,
      } satisfies IntentE2EInsightRollbackCandidate;
    })
    .filter(
      (candidate) =>
        candidate.beforeRuns >= minWindowRuns &&
        candidate.afterRuns >= minWindowRuns &&
        (candidate.passRateDelta >= 20 || candidate.firstPassRateDelta >= 20)
    )
    .sort(
      (a, b) =>
        Math.max(b.passRateDelta, b.firstPassRateDelta) - Math.max(a.passRateDelta, a.firstPassRateDelta) ||
        Date.parse(b.occurredAt) - Date.parse(a.occurredAt)
    )
    .slice(0, Math.max(1, Math.floor(limit || 3)));
}

function buildKnowledgeChangeGraders(
  runs: InsightRunRecord[],
  audits: IntentProjectKnowledgeAuditEntry[],
  limit = 8
): IntentE2EInsightKnowledgeChangeGrader[] {
  const terminalRuns = [...runs].sort((a, b) => a.finishedAtMs - b.finishedAtMs);

  return audits
    .filter((audit) => hasMeaningfulKnowledgeChangeAudit(audit))
    .map((audit) => {
      const occurredAtMs = toTimestamp(audit.occurredAt);
      const scopedRuns = filterRunsForAuditScope(terminalRuns, audit);
      const beforeWindow = scopedRuns.filter((run) => run.finishedAtMs && run.finishedAtMs < occurredAtMs).slice(-KNOWLEDGE_CHANGE_BASELINE_WINDOW);
      const afterWindow = scopedRuns.filter((run) => run.finishedAtMs && run.finishedAtMs > occurredAtMs).slice(0, KNOWLEDGE_CHANGE_FOLLOWUP_WINDOW);
      const beforePassedRuns = beforeWindow.filter((run) => run.status === 'passed').length;
      const beforeFirstPassPassedRuns = beforeWindow.filter((run) => run.firstPassSucceeded).length;
      const afterPassedRuns = afterWindow.filter((run) => run.status === 'passed').length;
      const afterFailedRuns = afterWindow.filter((run) => run.status === 'failed').length;
      const afterCanceledRuns = afterWindow.filter((run) => run.status === 'canceled').length;
      const afterFirstPassPassedRuns = afterWindow.filter((run) => run.firstPassSucceeded).length;
      const beforePassRate = toPercent(beforePassedRuns, beforeWindow.length);
      const beforeFirstPassRate = toPercent(beforeFirstPassPassedRuns, beforeWindow.length);
      const afterPassRate = toPercent(afterPassedRuns, afterWindow.length);
      const afterFirstPassRate = toPercent(afterFirstPassPassedRuns, afterWindow.length);
      const passRateDelta = roundRateDelta(beforePassRate, afterPassRate);
      const firstPassRateDelta = roundRateDelta(beforeFirstPassRate, afterFirstPassRate);
      const impactStatus = classifyMergeImpactStatus(passRateDelta, firstPassRateDelta);
      const evidenceLevel: IntentE2EInsightKnowledgeChangeEvidenceLevel =
        afterWindow.length >= KNOWLEDGE_CHANGE_DECISION_RUNS ? 'decisionable' : 'early';
      const efficacyStatus = resolveKnowledgeChangeEfficacyStatus(
        audit.operation,
        impactStatus,
        afterWindow.length,
        afterPassRate,
        afterFirstPassRate
      );
      const mergedCandidateSources = getAuditMergedCandidateSources(audit);
      const mergedRunIds = getAuditMergedRunIds(audit);
      const selectedCandidateFeedbackStatuses = getAuditSelectedCandidateFeedbackStatuses(audit);
      const selectedRiskyCandidateIds = getAuditSelectedRiskyCandidateIds(audit);
      const appliedOverrideCandidateIds = getAuditAppliedOverrideCandidateIds(audit);
      const appliedAcknowledgedRiskCandidateIds = getAuditAppliedAcknowledgedRiskCandidateIds(audit);
      const preflightNoticeCount = getAuditPreflightItems(audit).length;
      const receiptNoticeCount = getAuditMergeReceipts(audit).length;

      return {
        auditId: audit.auditId,
        operation: audit.operation,
        occurredAt: audit.occurredAt,
        projectUid: audit.projectUid,
        requestedModuleUid: getAuditRequestedModuleUid(audit) || undefined,
        title: audit.title,
        backupPath: audit.backupPath,
        restoredFrom: getAuditRestoredFrom(audit) || undefined,
        affectedRuleIds: getAuditAffectedRuleIds(audit),
        mergedCandidateSources,
        mergedRunIds,
        selectedCandidateFeedbackStatuses,
        selectedRiskyCandidateIds,
        appliedOverrideCandidateIds,
        appliedAcknowledgedRiskCandidateIds,
        beforeRuns: beforeWindow.length,
        beforePassRate,
        beforeFirstPassRate,
        afterRuns: afterWindow.length,
        afterPassedRuns,
        afterFailedRuns,
        afterCanceledRuns,
        afterPassRate,
        afterFirstPassPassedRuns,
        afterFirstPassRate,
        passRateDelta,
        firstPassRateDelta,
        impactStatus,
        efficacyStatus,
        evidenceLevel,
        preflightNoticeCount,
        receiptNoticeCount,
        recommendation: buildKnowledgeChangeRecommendation({
          audit,
          efficacyStatus,
          evidenceLevel,
          beforeRuns: beforeWindow.length,
          beforePassRate,
          beforeFirstPassRate,
          afterRuns: afterWindow.length,
          afterPassRate,
          afterFirstPassRate,
          mergedCandidateSources,
          preflightNoticeCount,
          receiptNoticeCount,
        }),
      } satisfies IntentE2EInsightKnowledgeChangeGrader;
    })
    .sort(
      (a, b) =>
        Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
        b.afterRuns - a.afterRuns ||
        Math.abs(b.passRateDelta) - Math.abs(a.passRateDelta)
    )
    .slice(0, Math.max(1, Math.floor(limit || 8)));
}

function knowledgeChangeEfficacyPriorityRank(status: IntentE2EInsightKnowledgeChangeEfficacyStatus): number {
  switch (status) {
    case 'still_abnormal':
      return 0;
    case 'regressing':
      return 1;
    case 'watching':
      return 2;
    case 'neutral':
      return 3;
    case 'recovered':
      return 4;
    case 'improving':
      return 5;
    default:
      return 6;
  }
}

function buildKnowledgeChangeRuleSummaryRecommendation(
  summary: Pick<
    IntentE2EInsightKnowledgeChangeRuleSummary,
    | 'ruleId'
    | 'title'
    | 'auditCount'
    | 'improvingCount'
    | 'neutralCount'
    | 'regressingCount'
    | 'recoveredCount'
    | 'stillAbnormalCount'
    | 'watchingCount'
    | 'decisionableCount'
  >
): string {
  const displayTitle = summary.title || summary.ruleId;
  const positiveCount = summary.improvingCount + summary.recoveredCount;
  const negativeCount = summary.regressingCount + summary.stillAbnormalCount;

  if (summary.decisionableCount === 0 && summary.watchingCount > 0) {
    return `${displayTitle} 当前仍以早期样本为主，先继续累积后续运行证据，再决定是否放宽 merge 或继续回滚。`;
  }

  if (negativeCount > 0 && positiveCount === 0) {
    return `${displayTitle} 最近 ${summary.auditCount} 次知识变更里负向证据更明确（合并后恶化 ${summary.regressingCount} 次，回滚后仍异常 ${summary.stillAbnormalCount} 次）；应优先复核相关候选、verifier 和残余故障。`;
  }

  if (positiveCount > 0 && negativeCount === 0 && summary.decisionableCount > 0) {
    return `${displayTitle} 最近 ${summary.auditCount} 次知识变更已累计 ${positiveCount} 次正向/恢复证据；可作为后续 safer merge、规则转正和资产提升的优先观察对象。`;
  }

  if (negativeCount > positiveCount) {
    return `${displayTitle} 当前知识变更信号偏负向，建议继续保守处理该规则，暂不适合进一步放宽 merge 默认选择。`;
  }

  if (positiveCount > negativeCount) {
    return `${displayTitle} 当前知识变更信号整体偏正向，但仍存在混合样本，建议继续观察后续 run 再决定是否自动晋升。`;
  }

  if (summary.neutralCount > 0 && summary.decisionableCount > 0) {
    return `${displayTitle} 当前以平稳或混合信号为主，说明这条规则更适合作为谨慎观察对象，而不是立即自动晋升或自动回滚。`;
  }

  return `${displayTitle} 当前正负信号仍未完全收敛，继续观察后续 run 证据更稳妥。`;
}

type SuccessfulRunKnowledgePromotionHistoryByRule = {
  successfulRunPromotionReceiptCount: number;
  successfulRunPromotionRunCount: number;
  lastSuccessfulRunPromotionRecordedAt: string;
  lastSuccessfulRunPromotionRequestedModuleUid: string;
  lastSuccessfulRunPromotionRunIds: string[];
  lastSuccessfulRunPromotionObservationSummary: string;
};

function collectSuccessfulRunKnowledgePromotionHistoryByRule(
  audits: IntentProjectKnowledgeAuditEntry[]
): Map<string, SuccessfulRunKnowledgePromotionHistoryByRule> {
  const stats = new Map<
    string,
    SuccessfulRunKnowledgePromotionHistoryByRule & {
      receiptIds: Set<string>;
      runIds: Set<string>;
      lastSuccessfulRunPromotionRecordedAtMs: number;
    }
  >();

  for (const audit of audits) {
    const receipt = audit.meta.successfulRunKnowledgePromotionReceipt;
    if (!receipt || receipt.items.length === 0) continue;

    const recordedAt = receipt.recordedAt || audit.occurredAt;
    const recordedAtMs = toTimestamp(recordedAt);

    for (const item of receipt.items) {
      if (item.status !== 'merged') continue;
      const ruleId = item.ruleId.trim();
      if (!ruleId) continue;

      const current = stats.get(ruleId) || {
        successfulRunPromotionReceiptCount: 0,
        successfulRunPromotionRunCount: 0,
        lastSuccessfulRunPromotionRecordedAt: '',
        lastSuccessfulRunPromotionRequestedModuleUid: '',
        lastSuccessfulRunPromotionRunIds: [],
        lastSuccessfulRunPromotionObservationSummary: '',
        lastSuccessfulRunPromotionRecordedAtMs: 0,
        receiptIds: new Set<string>(),
        runIds: new Set<string>(),
      };

      if (!current.receiptIds.has(receipt.receiptId)) {
        current.receiptIds.add(receipt.receiptId);
        current.successfulRunPromotionReceiptCount += 1;
      }
      for (const runId of item.runIds) {
        current.runIds.add(runId);
      }
      current.successfulRunPromotionRunCount = current.runIds.size;
      if (recordedAtMs >= current.lastSuccessfulRunPromotionRecordedAtMs) {
        current.lastSuccessfulRunPromotionRecordedAtMs = recordedAtMs;
        current.lastSuccessfulRunPromotionRecordedAt = recordedAt;
        current.lastSuccessfulRunPromotionRequestedModuleUid = receipt.requestedModuleUid || audit.meta.requestedModuleUid || '';
        current.lastSuccessfulRunPromotionRunIds = uniqueStrings(item.runIds);
        current.lastSuccessfulRunPromotionObservationSummary =
          summarizeIntentSuccessfulRunKnowledgePromotionReceiptItemsObservation([item]);
      }
      stats.set(ruleId, current);
    }
  }

  return [...stats.entries()].reduce<Map<string, SuccessfulRunKnowledgePromotionHistoryByRule>>((acc, [ruleId, value]) => {
    acc.set(ruleId, {
      successfulRunPromotionReceiptCount: value.successfulRunPromotionReceiptCount,
      successfulRunPromotionRunCount: value.successfulRunPromotionRunCount,
      lastSuccessfulRunPromotionRecordedAt: value.lastSuccessfulRunPromotionRecordedAt,
      lastSuccessfulRunPromotionRequestedModuleUid: value.lastSuccessfulRunPromotionRequestedModuleUid,
      lastSuccessfulRunPromotionRunIds: [...value.lastSuccessfulRunPromotionRunIds],
      lastSuccessfulRunPromotionObservationSummary: value.lastSuccessfulRunPromotionObservationSummary,
    });
    return acc;
  }, new Map<string, SuccessfulRunKnowledgePromotionHistoryByRule>());
}

function buildKnowledgeChangeRuleSummaries(
  graders: IntentE2EInsightKnowledgeChangeGrader[],
  ruleTitles: Map<string, string>,
  successfulRunPromotionHistoryByRule: Map<string, SuccessfulRunKnowledgePromotionHistoryByRule> = new Map(),
  limit = 10
): IntentE2EInsightKnowledgeChangeRuleSummary[] {
  const stats = new Map<
    string,
    IntentE2EInsightKnowledgeChangeRuleSummary & {
      latestOccurredAtMs: number;
      supportingAuditIdSet: Set<string>;
    }
  >();

  for (const grader of graders) {
    for (const ruleId of uniqueStrings(grader.affectedRuleIds)) {
      const current = stats.get(ruleId) || {
        ruleId,
        title: ruleTitles.get(ruleId) || ruleId,
        auditCount: 0,
        mergeCount: 0,
        restoreCount: 0,
        improvingCount: 0,
        neutralCount: 0,
        regressingCount: 0,
        recoveredCount: 0,
        stillAbnormalCount: 0,
        watchingCount: 0,
        decisionableCount: 0,
        earlyCount: 0,
        latestOccurredAt: grader.occurredAt,
        latestOperation: grader.operation,
        latestEfficacyStatus: grader.efficacyStatus,
        latestImpactStatus: grader.impactStatus,
        netPassRateDelta: 0,
        netFirstPassRateDelta: 0,
        successfulRunPromotionReceiptCount: 0,
        successfulRunPromotionRunCount: 0,
        lastSuccessfulRunPromotionRecordedAt: '',
        lastSuccessfulRunPromotionRequestedModuleUid: '',
        lastSuccessfulRunPromotionRunIds: [],
        lastSuccessfulRunPromotionObservationSummary: '',
        supportingAuditIds: [],
        recommendation: '',
        latestOccurredAtMs: 0,
        supportingAuditIdSet: new Set<string>(),
      };

      current.auditCount += 1;
      current.mergeCount += grader.operation === 'merge' ? 1 : 0;
      current.restoreCount += grader.operation === 'restore' ? 1 : 0;
      current.netPassRateDelta += grader.passRateDelta;
      current.netFirstPassRateDelta += grader.firstPassRateDelta;
      current.supportingAuditIdSet.add(grader.auditId);

      switch (grader.efficacyStatus) {
        case 'improving':
          current.improvingCount += 1;
          break;
        case 'neutral':
          current.neutralCount += 1;
          break;
        case 'regressing':
          current.regressingCount += 1;
          break;
        case 'recovered':
          current.recoveredCount += 1;
          break;
        case 'still_abnormal':
          current.stillAbnormalCount += 1;
          break;
        default:
          current.watchingCount += 1;
          break;
      }

      if (grader.evidenceLevel === 'decisionable') {
        current.decisionableCount += 1;
      } else {
        current.earlyCount += 1;
      }

      const occurredAtMs = toTimestamp(grader.occurredAt);
      if (
        occurredAtMs > current.latestOccurredAtMs ||
        (occurredAtMs === current.latestOccurredAtMs &&
          knowledgeChangeEfficacyPriorityRank(grader.efficacyStatus) <
            knowledgeChangeEfficacyPriorityRank(current.latestEfficacyStatus))
      ) {
        current.latestOccurredAt = grader.occurredAt;
        current.latestOperation = grader.operation;
        current.latestEfficacyStatus = grader.efficacyStatus;
        current.latestImpactStatus = grader.impactStatus;
        current.latestOccurredAtMs = occurredAtMs;
      }

      stats.set(ruleId, current);
    }
  }

  return [...stats.values()]
    .map(({ latestOccurredAtMs: _latestOccurredAtMs, supportingAuditIdSet, ...current }) => {
      const supportingAuditIds = [...supportingAuditIdSet].sort((a, b) => a.localeCompare(b));
      const promotionHistory = successfulRunPromotionHistoryByRule.get(current.ruleId);
      const summary = {
        ...current,
        netPassRateDelta: roundMetric(current.netPassRateDelta),
        netFirstPassRateDelta: roundMetric(current.netFirstPassRateDelta),
        successfulRunPromotionReceiptCount: promotionHistory?.successfulRunPromotionReceiptCount || 0,
        successfulRunPromotionRunCount: promotionHistory?.successfulRunPromotionRunCount || 0,
        lastSuccessfulRunPromotionRecordedAt: promotionHistory?.lastSuccessfulRunPromotionRecordedAt || '',
        lastSuccessfulRunPromotionRequestedModuleUid: promotionHistory?.lastSuccessfulRunPromotionRequestedModuleUid || '',
        lastSuccessfulRunPromotionRunIds: [...(promotionHistory?.lastSuccessfulRunPromotionRunIds || [])],
        lastSuccessfulRunPromotionObservationSummary: promotionHistory?.lastSuccessfulRunPromotionObservationSummary || '',
        supportingAuditIds,
      };

      return {
        ...summary,
        recommendation: buildKnowledgeChangeRuleSummaryRecommendation(summary),
      };
    })
    .sort((a, b) => {
      const negativeDelta =
        b.regressingCount +
        b.stillAbnormalCount -
        (a.regressingCount + a.stillAbnormalCount);
      if (negativeDelta !== 0) return negativeDelta;
      if (b.decisionableCount !== a.decisionableCount) {
        return b.decisionableCount - a.decisionableCount;
      }
      const statusRankDelta =
        knowledgeChangeEfficacyPriorityRank(a.latestEfficacyStatus) -
        knowledgeChangeEfficacyPriorityRank(b.latestEfficacyStatus);
      if (statusRankDelta !== 0) return statusRankDelta;
      return toTimestamp(b.latestOccurredAt) - toTimestamp(a.latestOccurredAt) || a.ruleId.localeCompare(b.ruleId);
    })
    .slice(0, Math.max(1, Math.floor(limit || 10)));
}

function resolveRuleLevelLifecycleMeta(
  effect: Pick<
    IntentE2EInsightProbationRule | IntentE2EInsightRollbackCandidate,
    | 'addedRuleIds'
    | 'mergedCandidates'
    | 'selectedCandidateFeedbackStatuses'
    | 'selectedRiskyCandidateIds'
    | 'appliedOverrideCandidateIds'
    | 'appliedOverrideCandidateFeedbackStatuses'
    | 'appliedAcknowledgedRiskCandidateIds'
    | 'appliedAcknowledgedRiskCandidateFeedbackStatuses'
  >,
  ruleId: string
): {
  selectedCandidateFeedbackStatuses: string[];
  selectedRiskyCandidateIds: string[];
  appliedOverrideCandidateIds: string[];
  appliedOverrideCandidateFeedbackStatuses: string[];
  appliedAcknowledgedRiskCandidateIds: string[];
  appliedAcknowledgedRiskCandidateFeedbackStatuses: string[];
} {
  const exactMatches = (effect.mergedCandidates || []).filter((candidate) => candidate.ruleId === ruleId);
  if (exactMatches.length > 0) {
    return {
      selectedCandidateFeedbackStatuses: uniqueStrings(exactMatches.map((candidate) => candidate.feedbackStatus || '')),
      selectedRiskyCandidateIds: uniqueStrings(exactMatches.filter((candidate) => candidate.risky).map((candidate) => candidate.candidateId)),
      appliedOverrideCandidateIds: uniqueStrings(
        exactMatches.filter((candidate) => candidate.overrideApplied).map((candidate) => candidate.candidateId)
      ),
      appliedOverrideCandidateFeedbackStatuses: uniqueStrings(
        exactMatches.filter((candidate) => candidate.overrideApplied).map((candidate) => candidate.feedbackStatus || '')
      ),
      appliedAcknowledgedRiskCandidateIds: uniqueStrings(
        exactMatches.filter((candidate) => candidate.riskAcknowledged).map((candidate) => candidate.candidateId)
      ),
      appliedAcknowledgedRiskCandidateFeedbackStatuses: uniqueStrings(
        exactMatches.filter((candidate) => candidate.riskAcknowledged).map((candidate) => candidate.feedbackStatus || '')
      ),
    };
  }

  if ((effect.mergedCandidates || []).length === 0 && effect.addedRuleIds.includes(ruleId)) {
    return {
      selectedCandidateFeedbackStatuses: [...effect.selectedCandidateFeedbackStatuses],
      selectedRiskyCandidateIds: [...effect.selectedRiskyCandidateIds],
      appliedOverrideCandidateIds: [...effect.appliedOverrideCandidateIds],
      appliedOverrideCandidateFeedbackStatuses: [...effect.appliedOverrideCandidateFeedbackStatuses],
      appliedAcknowledgedRiskCandidateIds: [...effect.appliedAcknowledgedRiskCandidateIds],
      appliedAcknowledgedRiskCandidateFeedbackStatuses: [...effect.appliedAcknowledgedRiskCandidateFeedbackStatuses],
    };
  }

  return {
    selectedCandidateFeedbackStatuses: [],
    selectedRiskyCandidateIds: [],
    appliedOverrideCandidateIds: [],
    appliedOverrideCandidateFeedbackStatuses: [],
    appliedAcknowledgedRiskCandidateIds: [],
    appliedAcknowledgedRiskCandidateFeedbackStatuses: [],
  };
}

function buildRiskLifecycleRules(
  audits: IntentProjectKnowledgeAuditEntry[],
  probationRules: IntentE2EInsightProbationRule[],
  rollbackCandidates: IntentE2EInsightRollbackCandidate[],
  rulePerformanceById: Record<string, IntentE2ERulePerformance>,
  nowMs?: number
): IntentE2EInsightRiskLifecycleRule[] {
  const statusRank = {
    rollback_candidate: 0,
    degraded: 1,
    watching: 2,
    promoted: 3,
  } satisfies Record<IntentE2EInsightRiskLifecycleStatus, number>;
  const aggregates = new Map<
    string,
    {
      title: string;
      mergedCandidateSources: Set<string>;
      selectedCandidateFeedbackStatuses: Set<string>;
      mergeAuditCount: number;
      riskySelectionCount: number;
      overrideAppliedCount: number;
      riskAcknowledgementCount: number;
      mergeProvenance: IntentE2EInsightRiskLifecycleRuleMergeProvenance;
      mergeProvenanceEvents: Array<{
        occurredAt: string;
        mergeProvenance: IntentE2EInsightRiskLifecycleRuleMergeProvenance;
      }>;
      promotedCount: number;
      watchingCount: number;
      degradedCount: number;
      rollbackCandidateCount: number;
      latestOccurredAt: string;
      latestStatus: IntentE2EInsightRiskLifecycleStatus;
      latestImpactStatus?: IntentE2EInsightMergeImpactStatus;
      latestBackupPath: string | null;
      latestRecommendation: string;
      supportingAuditIds: Set<string>;
    }
  >();

  const ensure = (ruleId: string) => {
    const current = aggregates.get(ruleId);
    if (current) return current;
    const created = {
      title: rulePerformanceById[ruleId]?.title || ruleId,
      mergedCandidateSources: new Set<string>(),
      selectedCandidateFeedbackStatuses: new Set<string>(),
      mergeAuditCount: 0,
      riskySelectionCount: 0,
      overrideAppliedCount: 0,
      riskAcknowledgementCount: 0,
      mergeProvenance: createEmptyRiskLifecycleRuleMergeProvenance(),
      mergeProvenanceEvents: [],
      promotedCount: 0,
      watchingCount: 0,
      degradedCount: 0,
      rollbackCandidateCount: 0,
      latestOccurredAt: '',
      latestStatus: 'watching' as IntentE2EInsightRiskLifecycleStatus,
      latestImpactStatus: undefined,
      latestBackupPath: null,
      latestRecommendation: '',
      supportingAuditIds: new Set<string>(),
    };
    aggregates.set(ruleId, created);
    return created;
  };

  const updateLatest = (
    current: ReturnType<typeof ensure>,
    next: {
      occurredAt: string;
      status: IntentE2EInsightRiskLifecycleStatus;
      impactStatus?: IntentE2EInsightMergeImpactStatus;
      backupPath?: string | null;
      recommendation?: string;
    }
  ) => {
    if (!next.occurredAt) return;
    const currentTime = current.latestOccurredAt ? Date.parse(current.latestOccurredAt) : 0;
    const nextTime = Date.parse(next.occurredAt);
    if (
      !current.latestOccurredAt ||
      nextTime > currentTime ||
      (nextTime === currentTime && statusRank[next.status] < statusRank[current.latestStatus])
    ) {
      current.latestOccurredAt = next.occurredAt;
      current.latestStatus = next.status;
      current.latestImpactStatus = next.impactStatus;
      current.latestBackupPath = next.backupPath ?? null;
      current.latestRecommendation = next.recommendation || '';
    }
  };

  for (const audit of audits) {
    if (audit.operation !== 'merge' || audit.comparison.addedRuleIds.length === 0) continue;

    const mergedCandidates = getAuditMergedCandidates(audit);
    const mergedCandidateSources = getAuditMergedCandidateSources(audit);
    const selectedCandidateFeedbackStatuses = getAuditSelectedCandidateFeedbackStatuses(audit);
    const selectedRiskyCandidateIds = getAuditSelectedRiskyCandidateIds(audit);
    const appliedOverrideCandidateIds = getAuditAppliedOverrideCandidateIds(audit);
    const appliedOverrideCandidateFeedbackStatuses = getAuditAppliedOverrideCandidateFeedbackStatuses(audit);
    const appliedAcknowledgedRiskCandidateIds = getAuditAppliedAcknowledgedRiskCandidateIds(audit);
    const appliedAcknowledgedRiskCandidateFeedbackStatuses = getAuditAppliedAcknowledgedRiskCandidateFeedbackStatuses(audit);

    for (const ruleId of audit.comparison.addedRuleIds) {
      const current = ensure(ruleId);
      const mergeProvenance = resolveRuleLevelMergeProvenance(audit, mergedCandidates, ruleId);
      const lifecycle = resolveRuleLevelLifecycleMeta(
        {
          addedRuleIds: audit.comparison.addedRuleIds,
          mergedCandidates,
          selectedCandidateFeedbackStatuses,
          selectedRiskyCandidateIds,
          appliedOverrideCandidateIds,
          appliedOverrideCandidateFeedbackStatuses,
          appliedAcknowledgedRiskCandidateIds,
          appliedAcknowledgedRiskCandidateFeedbackStatuses,
        },
        ruleId
      );
      current.mergeAuditCount += 1;
      lifecycle.selectedCandidateFeedbackStatuses.forEach((status) => current.selectedCandidateFeedbackStatuses.add(status));
      lifecycle.selectedRiskyCandidateIds.forEach(() => {
        current.riskySelectionCount += 1;
      });
      lifecycle.appliedOverrideCandidateIds.forEach(() => {
        current.overrideAppliedCount += 1;
      });
      lifecycle.appliedAcknowledgedRiskCandidateIds.forEach(() => {
        current.riskAcknowledgementCount += 1;
      });
      accumulateRiskLifecycleRuleMergeProvenance(current.mergeProvenance, mergeProvenance);
      current.mergeProvenanceEvents.push({
        occurredAt: audit.occurredAt,
        mergeProvenance,
      });

      const exactMatches = mergedCandidates.filter((candidate) => candidate.ruleId === ruleId);
      if (exactMatches.length > 0) {
        exactMatches.forEach((candidate) => {
          if (candidate.source) current.mergedCandidateSources.add(candidate.source);
        });
      } else {
        mergedCandidateSources.forEach((source) => current.mergedCandidateSources.add(source));
      }

      current.supportingAuditIds.add(audit.auditId);
      current.title = rulePerformanceById[ruleId]?.title || current.title || ruleId;
      updateLatest(current, {
        occurredAt: audit.occurredAt,
        status: 'watching',
        backupPath: audit.backupPath,
      });
    }
  }

  for (const probation of probationRules) {
    for (const ruleId of probation.addedRuleIds) {
      const current = ensure(ruleId);
      current.supportingAuditIds.add(probation.auditId);
      current.title = rulePerformanceById[ruleId]?.title || current.title || ruleId;
      if (probation.status === 'promoted') current.promotedCount += 1;
      if (probation.status === 'watching') current.watchingCount += 1;
      if (probation.status === 'degraded') current.degradedCount += 1;
      probation.mergedCandidateSources.forEach((source) => current.mergedCandidateSources.add(source));
      probation.selectedCandidateFeedbackStatuses.forEach((status) => current.selectedCandidateFeedbackStatuses.add(status));
      updateLatest(current, {
        occurredAt: probation.occurredAt,
        status: probation.status,
        impactStatus: probation.impactStatus,
        backupPath: probation.backupPath,
        recommendation: probation.recommendation,
      });
    }
  }

  for (const candidate of rollbackCandidates) {
    for (const ruleId of candidate.addedRuleIds) {
      const current = ensure(ruleId);
      current.rollbackCandidateCount += 1;
      current.supportingAuditIds.add(candidate.auditId);
      current.title = rulePerformanceById[ruleId]?.title || current.title || ruleId;
      candidate.mergedCandidateSources.forEach((source) => current.mergedCandidateSources.add(source));
      candidate.selectedCandidateFeedbackStatuses.forEach((status) => current.selectedCandidateFeedbackStatuses.add(status));
      updateLatest(current, {
        occurredAt: candidate.occurredAt,
        status: 'rollback_candidate',
        impactStatus: candidate.impactStatus,
        backupPath: candidate.backupPath,
        recommendation: candidate.recommendation,
      });
    }
  }

  const resolvePolicy = (
    current: ReturnType<typeof ensure>,
    recentMergeProvenance: IntentE2EInsightRiskLifecycleRuleRecentMergeProvenance
  ): { policy: IntentE2EInsightRiskLifecyclePolicy; policyReason: string } => {
    const provenanceReason = buildRiskLifecycleProvenanceReason(current.mergeProvenance);
    const recentProvenanceLabel = recentMergeProvenance.windowLabel;
    const recentProvenanceReason =
      buildRiskLifecycleProvenanceReason(recentMergeProvenance.mergeProvenance, recentProvenanceLabel) ||
      `${recentProvenanceLabel}：未出现结构化风险信号。`;
    const repeatedStructuredBlockSignal =
      recentMergeProvenance.mergeProvenance.preflight.blockDefaultMergeCount >= 2 ||
      recentMergeProvenance.mergeProvenance.receipt.guardrailCount >= 2;
    const mixedStructuredBlockSignal =
      recentMergeProvenance.mergeProvenance.preflight.blockDefaultMergeCount >= 1 &&
      (
        recentMergeProvenance.mergeProvenance.receipt.guardrailCount >= 1 ||
        current.rollbackCandidateCount >= 1 ||
        current.degradedCount >= 1
      );
    const recentPositiveStructuredSignal =
      recentMergeProvenance.mergeProvenance.preflight.autoPromoteCount >= 2 &&
      recentMergeProvenance.mergeProvenance.preflight.blockDefaultMergeCount === 0 &&
      recentMergeProvenance.mergeProvenance.preflight.overrideCount === 0 &&
      recentMergeProvenance.mergeProvenance.preflight.riskAcknowledgementCount === 0 &&
      recentMergeProvenance.mergeProvenance.receipt.guardrailCount === 0 &&
      recentMergeProvenance.mergeProvenance.receipt.auditCount === 0 &&
      current.degradedCount === 0 &&
      current.rollbackCandidateCount === 0;
    const recentGuardedObserveSignal =
      recentMergeProvenance.mergeProvenance.preflight.observeCount >= 2 &&
      recentMergeProvenance.mergeProvenance.preflight.autoPromoteCount === 0 &&
      recentMergeProvenance.mergeProvenance.preflight.blockDefaultMergeCount === 0 &&
      recentMergeProvenance.mergeProvenance.preflight.overrideCount === 0 &&
      recentMergeProvenance.mergeProvenance.preflight.riskAcknowledgementCount === 0 &&
      recentMergeProvenance.mergeProvenance.receipt.guardrailCount === 0 &&
      recentMergeProvenance.mergeProvenance.receipt.auditCount === 0 &&
      current.degradedCount === 0 &&
      current.rollbackCandidateCount === 0;

    if (
      repeatedStructuredBlockSignal ||
      mixedStructuredBlockSignal ||
      current.rollbackCandidateCount >= 2 ||
      current.degradedCount >= 2 ||
      (current.overrideAppliedCount >= 2 && (current.rollbackCandidateCount >= 1 || current.degradedCount >= 1))
    ) {
      return {
        policy: 'block_default_merge',
        policyReason: [
          `长期高风险：override ${current.overrideAppliedCount} 次，风险确认 ${current.riskAcknowledgementCount} 次，降级 ${current.degradedCount} 次，回滚候选 ${current.rollbackCandidateCount} 次。`,
          recentProvenanceReason,
          provenanceReason,
        ]
          .filter(Boolean)
          .join(' '),
      };
    }

    if (
      recentPositiveStructuredSignal ||
      current.promotedCount >= 2 &&
      current.degradedCount === 0 &&
      current.rollbackCandidateCount === 0
    ) {
      return {
        policy: 'auto_promote_candidate',
        policyReason: [
          `长期稳定：已转正 ${current.promotedCount} 次，且暂无降级或回滚候选记录。`,
          recentProvenanceReason,
          provenanceReason,
        ]
          .filter(Boolean)
          .join(' '),
      };
    }

    if (recentGuardedObserveSignal) {
      return {
        policy: 'observe_guarded',
        policyReason: [
          `近期仍连续处于 observe provenance，尚未形成自动晋升或风险阻断信号；建议继续小范围观察，不要直接扩大默认 merge 范围。`,
          recentProvenanceReason,
          provenanceReason,
        ]
          .filter(Boolean)
          .join(' '),
      };
    }

    return {
      policy: 'observe',
      policyReason: [
        `继续观察：风险确认 ${current.riskAcknowledgementCount} 次，观察中 ${current.watchingCount} 次，降级 ${current.degradedCount} 次。`,
        recentProvenanceReason,
        provenanceReason,
      ]
        .filter(Boolean)
        .join(' '),
    };
  };

  return [...aggregates.entries()]
    .map(([ruleId, current]) => {
      const recentMergeProvenance = resolveRecentRiskLifecycleRuleMergeProvenance(current.mergeProvenanceEvents, {
        nowMs,
      });
      const policy = resolvePolicy(current, recentMergeProvenance);

      return {
        ruleId,
        title: current.title || ruleId,
        mergedCandidateSources: [...current.mergedCandidateSources],
        selectedCandidateFeedbackStatuses: [...current.selectedCandidateFeedbackStatuses],
        mergeAuditCount: current.mergeAuditCount,
        riskySelectionCount: current.riskySelectionCount,
        overrideAppliedCount: current.overrideAppliedCount,
        riskAcknowledgementCount: current.riskAcknowledgementCount,
        mergeProvenance: current.mergeProvenance,
        recentMergeProvenance,
        promotedCount: current.promotedCount,
        watchingCount: current.watchingCount,
        degradedCount: current.degradedCount,
        rollbackCandidateCount: current.rollbackCandidateCount,
        latestOccurredAt: current.latestOccurredAt,
        latestStatus: current.latestStatus,
        latestImpactStatus: current.latestImpactStatus,
        latestBackupPath: current.latestBackupPath,
        latestRecommendation: current.latestRecommendation,
        policy: policy.policy,
        policyReason: policy.policyReason,
        supportingAuditIds: [...current.supportingAuditIds],
      } satisfies IntentE2EInsightRiskLifecycleRule;
    })
    .filter(
      (item) =>
        item.overrideAppliedCount > 0 ||
        item.riskAcknowledgementCount > 0 ||
        item.rollbackCandidateCount > 0 ||
        item.mergeProvenance.preflight.autoPromoteCount > 0 ||
        item.mergeProvenance.preflight.observeCount > 0 ||
        item.mergeProvenance.preflight.blockDefaultMergeCount > 0 ||
        item.mergeProvenance.preflight.overrideCount > 0 ||
        item.mergeProvenance.preflight.riskAcknowledgementCount > 0 ||
        item.mergeProvenance.receipt.guardrailCount > 0 ||
        item.mergeProvenance.receipt.auditCount > 0
    )
    .sort(
      (a, b) =>
        (
          a.policy === 'block_default_merge'
            ? 0
            : a.policy === 'observe_guarded'
            ? 1
            : a.policy === 'observe'
            ? 2
            : 3
        ) -
          (
            b.policy === 'block_default_merge'
              ? 0
              : b.policy === 'observe_guarded'
              ? 1
              : b.policy === 'observe'
              ? 2
              : 3
          ) ||
        b.rollbackCandidateCount - a.rollbackCandidateCount ||
        b.degradedCount - a.degradedCount ||
        b.overrideAppliedCount - a.overrideAppliedCount ||
        b.riskAcknowledgementCount - a.riskAcknowledgementCount ||
        Date.parse(b.latestOccurredAt || '1970-01-01T00:00:00.000Z') - Date.parse(a.latestOccurredAt || '1970-01-01T00:00:00.000Z') ||
        a.ruleId.localeCompare(b.ruleId)
    )
    .slice(0, 8);
}

export function buildIntentE2ERulePerformanceMapFromData(
  runSnapshots: IntentE2ERunSnapshotRecord[],
  audits: IntentProjectKnowledgeAuditEntry[]
): Record<string, IntentE2ERulePerformance> {
  const terminalRuns = runSnapshots
    .map(normalizeTerminalRun)
    .filter((item): item is InsightRunRecord => Boolean(item));
  const probationRules = buildProbationRules(terminalRuns, audits, 6, Math.max(1, audits.length || 1));
  const rollbackCandidates = buildRollbackCandidates(terminalRuns, audits, Math.max(1, audits.length || 1));
  const rollbackCounts = new Map<string, number>();
  const probationByRuleId = new Map<string, IntentProjectKnowledgeRuleProbation>();
  const stats = new Map<
    string,
    {
      title: string;
      runIds: Set<string>;
      passedRunIds: Set<string>;
      failedRunIds: Set<string>;
      canceledRunIds: Set<string>;
    }
  >();

  for (const candidate of rollbackCandidates) {
    for (const ruleId of candidate.addedRuleIds) {
      rollbackCounts.set(ruleId, (rollbackCounts.get(ruleId) || 0) + 1);
    }
  }

  for (const probation of probationRules) {
    for (const ruleId of probation.addedRuleIds) {
      if (probationByRuleId.has(ruleId)) continue;
      const lifecycle = resolveRuleLevelLifecycleMeta(probation, ruleId);

      probationByRuleId.set(ruleId, {
        status: probation.status,
        observedRuns: probation.observedRuns,
        observedPassRate: probation.observedPassRate,
        remainingRuns: probation.remainingRuns,
        sourceAuditId: probation.auditId,
        sourceTitle: probation.title,
        backupPath: probation.backupPath,
        recommendation: probation.recommendation,
        selectedCandidateFeedbackStatuses: lifecycle.selectedCandidateFeedbackStatuses,
        selectedRiskyCandidateIds: lifecycle.selectedRiskyCandidateIds,
        appliedOverrideCandidateIds: lifecycle.appliedOverrideCandidateIds,
        appliedOverrideCandidateFeedbackStatuses: lifecycle.appliedOverrideCandidateFeedbackStatuses,
        appliedAcknowledgedRiskCandidateIds: lifecycle.appliedAcknowledgedRiskCandidateIds,
        appliedAcknowledgedRiskCandidateFeedbackStatuses: lifecycle.appliedAcknowledgedRiskCandidateFeedbackStatuses,
      });
    }
  }

  for (const run of terminalRuns) {
    run.matchedRuleIds.forEach((ruleId, index) => {
      const current = stats.get(ruleId) || {
        title: run.matchedRuleTitles[index] || ruleId,
        runIds: new Set<string>(),
        passedRunIds: new Set<string>(),
        failedRunIds: new Set<string>(),
        canceledRunIds: new Set<string>(),
      };
      current.title = current.title || run.matchedRuleTitles[index] || ruleId;
      current.runIds.add(run.runId);
      if (run.status === 'passed') {
        current.passedRunIds.add(run.runId);
      } else if (run.status === 'failed') {
        current.failedRunIds.add(run.runId);
      } else if (run.status === 'canceled') {
        current.canceledRunIds.add(run.runId);
      }
      stats.set(ruleId, current);
    });
  }

  const entries = [...stats.entries()].reduce<Record<string, IntentE2ERulePerformance>>((acc, [ruleId, current]) => {
    acc[ruleId] = {
      ruleId,
      title: current.title || ruleId,
      runCount: current.runIds.size,
      passedRuns: current.passedRunIds.size,
      failedRuns: current.failedRunIds.size,
      canceledRuns: current.canceledRunIds.size,
      passRate: toPercent(current.passedRunIds.size, current.runIds.size),
      rollbackCandidateCount: rollbackCounts.get(ruleId) || 0,
      probation: probationByRuleId.get(ruleId),
    };
    return acc;
  }, {});

  for (const probation of probationRules) {
    for (const ruleId of probation.addedRuleIds) {
      if (entries[ruleId]) continue;
      entries[ruleId] = {
        ruleId,
        title: ruleId,
        runCount: 0,
        passedRuns: 0,
        failedRuns: 0,
        canceledRuns: 0,
        passRate: 0,
        rollbackCandidateCount: rollbackCounts.get(ruleId) || 0,
        probation: probationByRuleId.get(ruleId),
      };
    }
  }

  return entries;
}

export function buildIntentE2ERecipePerformanceMapFromData(
  runSnapshots: IntentE2ERunSnapshotRecord[]
): Record<string, IntentRecipePerformanceFeedback> {
  const terminalRuns = runSnapshots
    .map(normalizeTerminalRun)
    .filter((item): item is InsightRunRecord => Boolean(item));
  const latestRepairObservationBySlug = collectLatestRecipeRepairObservationBySlug(terminalRuns);
  const stats = new Map<
    string,
    {
      runIds: Set<string>;
      passedRunIds: Set<string>;
      failedRunIds: Set<string>;
      canceledRunIds: Set<string>;
      latestVerifiedAt: string;
      latestVerifiedAtMs: number;
    }
  >();

  for (const run of terminalRuns) {
    for (const slug of run.matchedRecipeSlugs) {
      const current = stats.get(slug) || {
        runIds: new Set<string>(),
        passedRunIds: new Set<string>(),
        failedRunIds: new Set<string>(),
        canceledRunIds: new Set<string>(),
        latestVerifiedAt: '',
        latestVerifiedAtMs: 0,
      };
      current.runIds.add(run.runId);
      if (run.status === 'passed') {
        current.passedRunIds.add(run.runId);
      } else if (run.status === 'failed') {
        current.failedRunIds.add(run.runId);
      } else if (run.status === 'canceled') {
        current.canceledRunIds.add(run.runId);
      }
      if (run.finishedAtMs >= current.latestVerifiedAtMs) {
        current.latestVerifiedAt = run.finishedAt;
        current.latestVerifiedAtMs = run.finishedAtMs;
      }
      stats.set(slug, current);
    }
  }

  return [...stats.entries()].reduce<Record<string, IntentRecipePerformanceFeedback>>((acc, [slug, current]) => {
    const latestRepairObservation = latestRepairObservationBySlug.get(slug);
    acc[slug] = {
      runCount: current.runIds.size,
      passedRuns: current.passedRunIds.size,
      failedRuns: current.failedRunIds.size,
      canceledRuns: current.canceledRunIds.size,
      successRate: toPercent(current.passedRunIds.size, current.runIds.size),
      lastVerifiedAt: current.latestVerifiedAt,
      ...(latestRepairObservation
        ? {
            latestRepairObservationAt: latestRepairObservation.observedAt,
            latestRepairObservationSummary: latestRepairObservation.observationSummary,
          }
        : {}),
    };
    return acc;
  }, {});
}

function toIntentE2EInsightProjectRuntimeGovernanceStatus(
  status?: IntentProjectRuntimeGovernanceStatus | null
): IntentE2EInsightProjectRuntimeGovernanceStatus | undefined {
  if (!status?.projectUid) return undefined;

  return {
    projectUid: status.projectUid,
    path: status.path,
    exists: status.exists,
    valid: status.valid,
    ready: status.ready,
    hasEnvironmentProfile: status.hasEnvironmentProfile,
    hasCredentialDefaults: status.hasCredentialDefaults,
    hasFixtureDefaults: status.hasFixtureDefaults,
    issues: status.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
    })),
  };
}

export function buildIntentE2EInsightsFromData(
  runSnapshots: IntentE2ERunSnapshotRecord[],
  audits: IntentProjectKnowledgeAuditEntry[],
  options: BuildIntentE2EInsightsOptions = {},
  activityLogs: ProjectActivityLogRecord[] = []
): IntentE2EInsightsResult {
  const runLimit = Math.max(1, Math.floor(options.runLimit || runSnapshots.length || 50));
  const auditLimit = Math.max(1, Math.floor(options.auditLimit || audits.length || 12));
  const terminalRuns = runSnapshots
    .map(normalizeTerminalRun)
    .filter((item): item is InsightRunRecord => Boolean(item));
  const passedRuns = terminalRuns.filter((run) => run.status === 'passed').length;
  const failedRuns = terminalRuns.filter((run) => run.status === 'failed').length;
  const canceledRuns = terminalRuns.filter((run) => run.status === 'canceled').length;
  const blockedRuns = terminalRuns.filter((run) => isIntentE2EBlockedQualityBucket(run.qualitySplit.bucket)).length;
  const modelQualityEligibleRuns = terminalRuns.filter((run) =>
    isIntentE2EModelQualityEligibleBucket(run.qualitySplit.bucket)
  ).length;
  const modelQualityFailureRuns = countRunsByQualityBuckets(terminalRuns, MODEL_QUALITY_FAILURE_BUCKETS);
  const knowledgeHitRuns = terminalRuns.filter((run) => run.matchedRuleIds.length > 0).length;
  const suggestedHelperReuseRuns = terminalRuns.filter((run) => run.usedSuggestedHelpers.length > 0).length;
  const authBlockRuns = countRunsByQualityBuckets(terminalRuns, AUTH_BLOCK_QUALITY_BUCKETS);
  const envBlockRuns = countRunsByQualityBuckets(terminalRuns, ENV_BLOCK_QUALITY_BUCKETS);
  const permissionBlockedRuns = countRunsByQualityBuckets(terminalRuns, PERMISSION_BLOCK_QUALITY_BUCKETS);
  const dataBlockedRuns = countRunsByQualityBuckets(terminalRuns, DATA_BLOCK_QUALITY_BUCKETS);
  const assertionFailureRuns = countRunsByFailureClasses(terminalRuns, ASSERTION_FAILURE_CLASSES);
  const assetMissingRuns = terminalRuns.filter((run) => run.assetReadiness.status === 'asset_missing').length;
  const noHitRuns = terminalRuns.filter((run) => run.assetReadiness.status === 'no_hit').length;
  const passMetrics = buildPassMetrics(terminalRuns);
  const probationRules = buildProbationRules(terminalRuns, audits, 6, 6);
  const allProbationRules = buildProbationRules(terminalRuns, audits, 6, Math.max(1, audits.length || 1));
  const rollbackCandidates = buildRollbackCandidates(terminalRuns, audits);
  const allRollbackCandidates = buildRollbackCandidates(terminalRuns, audits, Math.max(1, audits.length || 1));
  const allKnowledgeChangeGraders = buildKnowledgeChangeGraders(terminalRuns, audits, Math.max(1, audits.length || 1));
  const knowledgeChangeGraders = allKnowledgeChangeGraders.slice(0, 8);
  const successfulRunPromotionHistoryByRule = collectSuccessfulRunKnowledgePromotionHistoryByRule(audits);
  const knowledgeChangeRuleSummaries = buildKnowledgeChangeRuleSummaries(
    allKnowledgeChangeGraders,
    buildRuleTitleMap(terminalRuns),
    successfulRunPromotionHistoryByRule
  );
  const rulePerformanceById = buildIntentE2ERulePerformanceMapFromData(runSnapshots, audits);
  const { starterHelpers, suppressedStarterHelpers } = buildStarterHelpers(
    terminalRuns,
    rulePerformanceById,
    knowledgeChangeRuleSummaries
  );
  const starterHelperPromotionHistory = collectStarterHelperPromotionHistory(activityLogs);
  const evaluationBaseline = buildEvaluationBaseline(terminalRuns);
  const mergeProvenanceStats = buildMergeProvenanceStats(audits);
  const riskLifecycleRules = buildRiskLifecycleRules(audits, allProbationRules, allRollbackCandidates, rulePerformanceById, options.nowMs);
  const capabilityVerificationActivities = collectCapabilityVerificationActivities(activityLogs);
  const verificationIntents = buildVerificationIntentStats(terminalRuns);
  const scenarioFamilies = buildScenarioFamilyStats(terminalRuns);
  const scenarioFamilySlo = buildScenarioFamilySloOverview(scenarioFamilies, terminalRuns.length);
  const regressionWatchlist = buildRegressionWatchlist({
    scenarioFamilySlo,
    evaluationBaseline,
    rollbackCandidates,
  });
  const rolloutStrategy = buildIntentE2ERolloutStrategy({
    scenarioFamilySlo,
    regressionWatchlist,
    riskLifecycleRules,
    probationRules,
    rollbackCandidates,
  });

  return {
    scope: {
      projectUid: options.projectUid?.trim() || '',
      runLimit,
      auditLimit,
    },
    summary: {
      totalRuns: terminalRuns.length,
      passedRuns,
      failedRuns,
      canceledRuns,
      ...passMetrics,
      passRate: toPercent(passedRuns, terminalRuns.length),
      modelQualityEligibleRuns,
      modelQualityPassRate: toPercent(passedRuns, modelQualityEligibleRuns),
      modelQualityFailureRuns,
      modelQualityFailureRate: toPercent(modelQualityFailureRuns, modelQualityEligibleRuns),
      blockedRuns,
      blockedRate: toPercent(blockedRuns, terminalRuns.length),
      knowledgeHitRuns,
      knowledgeHitRate: toPercent(knowledgeHitRuns, terminalRuns.length),
      suggestedHelperReuseRuns,
      suggestedHelperReuseRate: toPercent(suggestedHelperReuseRuns, terminalRuns.length),
      authBlockRuns,
      authBlockRate: toPercent(authBlockRuns, terminalRuns.length),
      permissionBlockedRuns,
      permissionBlockedRate: toPercent(permissionBlockedRuns, terminalRuns.length),
      envBlockRuns,
      envBlockRate: toPercent(envBlockRuns, terminalRuns.length),
      dataBlockedRuns,
      dataBlockedRate: toPercent(dataBlockedRuns, terminalRuns.length),
      assertionFailureRuns,
      assertionFailureRate: toPercent(assertionFailureRuns, terminalRuns.length),
      assetMissingRuns,
      assetMissingRate: toPercent(assetMissingRuns, terminalRuns.length),
      noHitRuns,
      noHitRate: toPercent(noHitRuns, terminalRuns.length),
    },
    topRules: buildRuleStats(terminalRuns),
    topHelpers: buildHelperStats(terminalRuns),
    starterHelpers: attachStarterHelperPromotionHistory(starterHelpers, starterHelperPromotionHistory),
    suppressedStarterHelpers: attachStarterHelperPromotionHistory(
      suppressedStarterHelpers,
      starterHelperPromotionHistory
    ),
    scenarioFamilies,
    scenarioFamilySlo,
    regressionWatchlist,
    rolloutStrategy,
    priorityScenarioFamilies: buildPriorityScenarioFamilyStats(terminalRuns),
    verificationIntents,
    capabilityVerificationIntents: buildCapabilityVerificationIntentStats(
      capabilityVerificationActivities,
      verificationIntents
    ),
    failureClasses: buildFailureClassStats(terminalRuns),
    mergeProvenanceStats,
    riskLifecycleRules,
    probationRules,
    rollbackCandidates,
    knowledgeChangeGraders,
    knowledgeChangeRuleSummaries,
    recentTraces: buildRecentTraceSummaries(terminalRuns, Math.min(runLimit, 8)),
    recentCapabilityVerifications: buildRecentCapabilityVerificationSummaries(
      capabilityVerificationActivities,
      Math.min(Math.max(4, runLimit), 8)
    ),
    evaluationBaseline,
    ...(options.runtimeGovernanceStatus
      ? {
          runtimeGovernanceStatus: {
            ...options.runtimeGovernanceStatus,
            issues: options.runtimeGovernanceStatus.issues.map((issue) => ({
              code: issue.code,
              message: issue.message,
            })),
          },
        }
      : {}),
  };
}

export function buildIntentE2EStarterHelpersFromData(
  runSnapshots: IntentE2ERunSnapshotRecord[],
  audits: IntentProjectKnowledgeAuditEntry[]
): IntentE2EInsightStarterHelper[] {
  const terminalRuns = runSnapshots
    .map(normalizeTerminalRun)
    .filter((item): item is InsightRunRecord => Boolean(item));
  const knowledgeChangeRuleSummaries = buildKnowledgeChangeRuleSummaries(
    buildKnowledgeChangeGraders(terminalRuns, audits, Math.max(1, audits.length || 1)),
    buildRuleTitleMap(terminalRuns),
    collectSuccessfulRunKnowledgePromotionHistoryByRule(audits)
  );
  const rulePerformanceById = buildIntentE2ERulePerformanceMapFromData(runSnapshots, audits);
  return buildStarterHelpers(terminalRuns, rulePerformanceById, knowledgeChangeRuleSummaries).starterHelpers;
}

export async function getIntentE2ERulePerformanceMap(
  options: BuildIntentE2EInsightsOptions = {}
): Promise<Record<string, IntentE2ERulePerformance>> {
  const projectUid = options.projectUid?.trim() || '';
  const runLimit = Math.max(1, Math.min(200, Math.floor(options.runLimit || 50)));
  const auditLimit = Math.max(1, Math.min(50, Math.floor(options.auditLimit || 12)));
  const [runs, audits] = await Promise.all([
    listIntentE2ERunSnapshots({
      projectUid,
      status: 'terminal',
      limit: runLimit,
    }),
    listIntentProjectKnowledgeAuditEntries(auditLimit, projectUid),
  ]);

  return buildIntentE2ERulePerformanceMapFromData(runs, audits.items);
}

export async function getIntentE2ERecipePerformanceMap(
  options: BuildIntentE2EInsightsOptions = {}
): Promise<Record<string, IntentRecipePerformanceFeedback>> {
  const projectUid = options.projectUid?.trim() || '';
  const runLimit = Math.max(1, Math.min(200, Math.floor(options.runLimit || 50)));
  const runs = await listIntentE2ERunSnapshots({
    projectUid,
    status: 'terminal',
    limit: runLimit,
  });

  return buildIntentE2ERecipePerformanceMapFromData(runs);
}

export async function getIntentE2EInsights(options: BuildIntentE2EInsightsOptions = {}): Promise<IntentE2EInsightsResult> {
  const projectUid = options.projectUid?.trim() || '';
  const runLimit = Math.max(1, Math.min(200, Math.floor(options.runLimit || 50)));
  const auditLimit = Math.max(1, Math.min(50, Math.floor(options.auditLimit || 12)));
  const runtimeGovernanceStatus = projectUid
    ? toIntentE2EInsightProjectRuntimeGovernanceStatus(readIntentProjectRuntimeGovernanceStatus(projectUid))
    : undefined;
  const [runs, audits, activityLogs, capabilities] = await Promise.all([
    listIntentE2ERunSnapshots({
      projectUid,
      status: 'terminal',
      limit: runLimit,
    }),
    listIntentProjectKnowledgeAuditEntries(auditLimit, projectUid),
    projectUid ? listProjectActivityLogs(projectUid, 100) : Promise.resolve([] as ProjectActivityLogRecord[]),
    projectUid ? listProjectCapabilities(projectUid, { status: 'all' }) : Promise.resolve([]),
  ]);

  const result = buildIntentE2EInsightsFromData(runs, audits.items, {
    projectUid,
    runLimit,
    auditLimit,
    runtimeGovernanceStatus,
  }, activityLogs);
  const starterHelpersWithFeedback = attachIntentStarterHelperVerificationFeedback(result.starterHelpers, capabilities, activityLogs);
  const suppressedStarterHelpersWithFeedback = attachIntentSuppressedStarterHelperVerificationFeedback(
    result.suppressedStarterHelpers,
    capabilities,
    activityLogs
  );
  const capabilityVerificationActivities = collectCapabilityVerificationActivities(activityLogs);
  const starterHelperPromotionHistory = collectStarterHelperPromotionHistory(activityLogs);
  const capabilityVerificationRepairPlanUids = Array.from(
    collectCapabilityVerificationRepairPlanTriggerKinds(activityLogs).keys()
  );
  const suppressedStarterHelperGovernance = buildIntentSuppressedStarterHelperGovernanceInsights({
    suppressedStarterHelpers: suppressedStarterHelpersWithFeedback,
    capabilities,
    activities: capabilityVerificationActivities.map((item) => ({
      executionUid: item.executionUid,
      planUid: item.planUid,
      capabilityUid: item.capabilityUid,
      chainCapabilityUids: item.chainCapabilityUids,
      intent: item.intent,
      status: item.status,
      repairTriggerKind: item.repairTriggerKind,
      createdAt: item.createdAt,
    })),
    repairPlanUids: capabilityVerificationRepairPlanUids,
  });
  const reconciledStarterHelpers = reconcileIntentStarterHelpersWithSuppressedGovernance({
    starterHelpers: starterHelpersWithFeedback,
    suppressedStarterHelpers: suppressedStarterHelperGovernance.suppressedStarterHelpers,
  });
  const finalizedSuppressedStarterHelperGovernance = buildIntentSuppressedStarterHelperGovernanceInsights({
    suppressedStarterHelpers: reconciledStarterHelpers.suppressedStarterHelpers,
    capabilities,
    activities: capabilityVerificationActivities.map((item) => ({
      executionUid: item.executionUid,
      planUid: item.planUid,
      capabilityUid: item.capabilityUid,
      chainCapabilityUids: item.chainCapabilityUids,
      intent: item.intent,
      status: item.status,
      repairTriggerKind: item.repairTriggerKind,
      createdAt: item.createdAt,
    })),
    repairPlanUids: capabilityVerificationRepairPlanUids,
  });
  const finalStarterHelpers = attachStarterHelperPromotionHistory(
    reconciledStarterHelpers.starterHelpers,
    starterHelperPromotionHistory
  );
  const finalSuppressedStarterHelpers = attachStarterHelperPromotionHistory(
    finalizedSuppressedStarterHelperGovernance.suppressedStarterHelpers,
    starterHelperPromotionHistory
  );
  const failurePressureSummary = mergeIntentVerificationFailurePressureSummaryObservation(
    summarizeIntentVerificationFailurePressureSummaryFromItems([...finalStarterHelpers, ...finalSuppressedStarterHelpers], {
      itemKind: 'helper',
    }),
    result.verificationIntents
  );

  return {
    ...result,
    starterHelpers: finalStarterHelpers,
    suppressedStarterHelpers: finalSuppressedStarterHelpers,
    failurePressureSummary,
    starterHelperFailurePressureSummary: summarizeIntentVerificationFailurePressureSummaryFromItems(
      finalStarterHelpers,
      { itemKind: 'helper' }
    ),
    suppressedStarterHelperFailurePressureSummary: summarizeIntentVerificationFailurePressureSummaryFromItems(
      finalSuppressedStarterHelpers,
      { itemKind: 'helper' }
    ),
    suppressedStarterHelperGovernanceSummary: finalizedSuppressedStarterHelperGovernance.summary,
  };
}

export async function getIntentE2EStarterHelpers(
  options: BuildIntentE2EInsightsOptions = {}
): Promise<IntentE2EInsightStarterHelper[]> {
  return (await getIntentE2EInsights(options)).starterHelpers;
}
