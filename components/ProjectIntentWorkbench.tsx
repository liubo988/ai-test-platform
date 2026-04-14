'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  compareCapabilityVerificationOrder,
  describeCapabilityVerification,
  getCapabilityLastVerificationAttempt,
  resolveCapabilityVerificationLaunchPolicy,
  type CapabilityVerificationIntent,
  type CapabilityVerificationStatus,
} from '@/lib/capability-verification';
import { getIntentCapabilityFlowDefinition, type IntentCapabilityPreset } from '@/lib/intent-capability-preset';
import {
  buildIntentCapabilityMetaSearchText,
  describeIntentCapabilityOrigin,
  readIntentCapabilityStarterHelper,
  type IntentCapabilityOriginKind,
} from '@/lib/intent-capability-origin';
import type { IntentRecipe } from '@/lib/intent-recipe-registry';
import type { IntentPromotionEvidence } from '@/lib/intent-promotion-evidence';
import type { IntentPromotionGraderDecision } from '@/lib/intent-promotion-grader-decision';
import type { IntentPromotionGraderInput } from '@/lib/intent-promotion-grader-input';
import type { IntentPromotionGraderAuditOutput, IntentPromotionGraderSummary } from '@/lib/intent-promotion-grader-output';
import type {
  IntentPromotionGovernanceAuditActionKind,
  IntentPromotionGovernanceAuditSourceView,
} from '@/lib/intent-promotion-governance-audit';
import {
  isCapabilityVerificationPromotionCriticalItem,
  isCapabilityVerificationPromotionFocusItem,
  resolveCapabilityVerificationRecommendationTargets,
  summarizeCapabilityVerificationPromotionFocus,
} from '@/lib/capability-verification-recommendation-queue';
import { readExecutionEntryNavigationTargets } from '@/lib/execution-entry-navigation';
import { describeExecutionOutcome } from '@/lib/execution-outcome';
import {
  collectIntentStarterHelperHealthGovernanceCapabilityItems,
  isIntentStarterHelperHighFailureSuppressed,
  resolveIntentSuppressedStarterHelperGovernanceTargets,
} from '@/lib/intent-starter-helper-health-governance';
import {
  buildIntentProjectRecipeFromWorkbench,
  buildIntentProjectRecipePatchFromWorkbench,
  buildIntentProjectRecipeWorkbenchFormDefaults,
  normalizeIntentProjectRecipeWorkbenchSlug,
  type IntentProjectRecipeWorkbenchForm,
} from '@/lib/intent-project-recipe-workbench';
import { applyCapabilitySelectionToRecipe, type RecipeDraft } from '@/lib/project-knowledge';
import { buildTaskDraftFromRecipe, type IntentTaskDraft } from '@/lib/recipe-task-draft';
import {
  hasIntentVerificationFailurePressureViewHighFailure,
  normalizeIntentVerificationFailurePressureViewSummary,
} from '@/lib/intent-verification-failure-pressure-view';
import { pickLatestIntentVerificationFailurePressureObservation } from '@/lib/intent-verification-failure-pressure-summary';
import { stashCapabilityVerificationExecutionObservation } from '@/lib/capability-verification-observation-cache';

export type { IntentTaskDraft } from '@/lib/recipe-task-draft';

type KnowledgeSourceType = 'manual' | 'notes' | 'execution' | 'system';
type CapabilityType = 'auth' | 'navigation' | 'action' | 'assertion' | 'query' | 'composite';

type KnowledgeDocumentItem = {
  documentUid: string;
  name: string;
  sourceType: KnowledgeSourceType;
  sourcePath: string;
  status: 'active' | 'archived';
  chunkCount: number;
};

type KnowledgeChunkItem = {
  chunkUid: string;
  documentUid: string;
  heading: string;
  content: string;
  keywords: string[];
  sourceLineStart: number;
  sourceLineEnd: number;
  tokenEstimate: number;
  sortOrder: number;
};

type CapabilityItem = {
  capabilityUid: string;
  slug: string;
  name: string;
  description: string;
  capabilityType: CapabilityType;
  entryUrl: string;
  triggerPhrases: string[];
  preconditions: string[];
  steps: string[];
  assertions: string[];
  cleanupNotes: string;
  dependsOn: string[];
  sortOrder: number;
  status: 'active' | 'archived';
  sourceDocumentUid: string;
  meta: unknown;
};

type ModuleOption = {
  moduleUid: string;
  name: string;
};

type DraftRecipeResponse = {
  recipe: RecipeDraft;
  capabilityCount: number;
  knowledgeChunkCount: number;
};

type ProjectRecipeProfileResponse = {
  registryPath: string;
  profile: {
    version: 1;
    recipes: IntentRecipe[];
  };
};

type ProjectRecipeBackupItem = {
  path: string;
  fileName: string;
  createdAt: string;
  sizeBytes: number;
};

type ProjectRecipeBackupsResponse = {
  registryPath: string;
  backupDir: string;
  backups: ProjectRecipeBackupItem[];
};

type ProjectRecipeAuditOperation = 'register' | 'merge' | 'update' | 'restore';

type ProjectRecipeAuditEntry = {
  auditId: string;
  occurredAt: string;
  operation: ProjectRecipeAuditOperation;
  projectUid: string;
  actorLabel: string;
  title: string;
  detail: string;
  writtenTo: string;
  backupPath: string | null;
  comparison: {
    beforeRecipeCount: number;
    afterRecipeCount: number;
    addedRecipeSlugs: string[];
    removedRecipeSlugs?: string[];
    updatedRecipeSlugs: string[];
    skippedRecipeSlugs: string[];
  };
};

type ProjectRecipeAuditsResponse = {
  auditLogPath: string;
  items: ProjectRecipeAuditEntry[];
};

type ProjectRecipeMutationResponse = {
  mode: 'register' | 'merge' | 'update';
  result: {
    writtenTo: string;
    backupPath: string | null;
    addedRecipeSlugs?: string[];
    updatedRecipeSlugs?: string[];
    skippedRecipeSlugs?: string[];
  };
  auditEntry?: ProjectRecipeAuditEntry;
  auditWarning?: string;
  error?: string;
};

type ProjectRecipeRestoreResponse = {
  restoredFrom: string;
  writtenTo: string;
  backupCreated: string | null;
  comparison: {
    beforeRecipeCount: number;
    afterRecipeCount: number;
    addedRecipeSlugs: string[];
    removedRecipeSlugs: string[];
    updatedRecipeSlugs: string[];
  };
  auditEntry?: ProjectRecipeAuditEntry;
  auditWarning?: string;
  error?: string;
};

type ProjectRecipeGovernanceStatus = 'promote' | 'degrade' | 'observe' | 'synced';

type ProjectRecipeGovernanceDecisionPatch = {
  slug: string;
  successRate: number;
  lastVerifiedAt: string;
};

type ProjectRecipeGovernanceDecisionItem = {
  slug: string;
  title: string;
  description: string;
  status: ProjectRecipeGovernanceStatus;
  statusLabel: string;
  reason: string;
  canApply: boolean;
  currentSuccessRate: number;
  currentLastVerifiedAt: string;
  runtimeSuccessRate: number;
  runtimeLastVerifiedAt: string;
  runCount: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
  latestRepairObservationAt: string;
  latestRepairObservationSummary: string;
  recommendedPatch: ProjectRecipeGovernanceDecisionPatch | null;
};

type ProjectRecipeGovernanceSummary = {
  totalProjectRecipes: number;
  actionableCount: number;
  promoteCount: number;
  degradeCount: number;
  observeCount: number;
  syncedCount: number;
  runLimit: number;
  latestRepairObservationAt: string;
  latestRepairObservationRecipeSlug: string;
  latestRepairObservationRecipeTitle: string;
  latestRepairObservationSummary: string;
};

type ProjectRecipeGovernanceResponse = {
  summary: ProjectRecipeGovernanceSummary;
  items: ProjectRecipeGovernanceDecisionItem[];
};

type DeriveCapabilityResponse = {
  items: CapabilityItem[];
  skipped: Array<{ chunkUid: string; reason: string; capabilityName: string }>;
  summary: {
    requestedChunks: number;
    derivedCount: number;
    skippedCount: number;
    executionVerifiedCount: number;
    knowledgeInferredCount: number;
  };
};

type CapabilityVerificationLaunchResponse = {
  configUid: string;
  planUid: string;
  planVersion: number;
  executionUid: string;
  runPath?: string;
  workspacePath?: string;
  workspaceHistoryPath?: string;
  workspaceQueryPath?: string;
  executionContext?: {
    runPath?: string;
    workspacePath?: string;
    workspaceHistoryPath?: string;
  } | null;
};

type CapabilityVerificationMode = 'verify' | 'repair';
type CapabilityVerificationExecutionStatus = 'queued' | 'running' | 'passed' | 'failed' | 'canceled';

type CapabilityVerificationMonitorItem = {
  capabilityUid: string;
  capabilityName: string;
  executionUid: string;
  runPath: string;
  workspacePath: string;
  workspaceHistoryPath: string;
  mode: CapabilityVerificationMode;
  verificationIntent?: CapabilityVerificationIntent;
  status: CapabilityVerificationExecutionStatus;
  synced: boolean;
  resultSummary: string;
  errorMessage: string;
  latestRepairObservationAt: string;
  latestRepairObservationSummary: string;
  latestRepairObservationVerifierCheckUids: string[];
};

type CapabilityVerificationBatch = {
  batchUid: string;
  title: string;
  mode: CapabilityVerificationMode;
  verificationIntent?: CapabilityVerificationIntent;
  moduleName: string;
  startedAt: string;
  lastCheckedAt: string;
  completedAt: string;
  refreshError: string;
  items: CapabilityVerificationMonitorItem[];
};

type CapabilityExecutionDetailVerificationContext = {
  capabilityUid: string;
  chainCapabilityUids: string[];
  intent: CapabilityVerificationIntent;
  targetName: string;
  strategyLabel: string;
};

type CapabilityExecutionDetailResponse = {
  execution: {
    executionUid: string;
    status: CapabilityVerificationExecutionStatus;
    startedAt: string;
    endedAt: string;
    resultSummary: string;
    errorMessage: string;
  };
  capabilityVerification?: CapabilityExecutionDetailVerificationContext | null;
};

type CapabilityStarterHelperHealthItem = {
  helper: string;
  runCount: number;
  passedRuns: number;
  passRate: number;
  suggestedReuseRuns: number;
  source: 'promoted' | 'stable';
  healthStatus: 'preferred' | 'watching' | 'neutral' | 'suppressed';
  healthLabel: string;
  promotionEvidence?: IntentPromotionEvidence | null;
  supportingRuleIds: string[];
  supportingRuleTitles: string[];
  knowledgeChangeTier?: 'preferred' | 'watching';
  knowledgeChangeWatchingKind?: 'recovering' | 'mixed';
  knowledgeChangeSignal?: 'positive' | 'negative';
  knowledgeChangeSignalReason: string;
  knowledgeChangeDecisionableRuleCount: number;
  knowledgeChangeSupportingAuditIds: string[];
  preferredPromotionStatus:
    | 'await_more_positive_rules'
    | 'blocked_by_mixed_evidence'
    | 'await_long_term_recovery'
    | '';
  preferredPromotionReason: string;
  preferredAutoPromotionCondition: string;
  preferredPromotionRequiredPositiveRuleCount: number;
  preferredPromotionPositiveRuleCount: number;
  preferredPromotionNegativeRuleCount: number;
  recommendation: string;
  linkedCapabilities: Array<{
    capabilityUid: string;
    name: string;
    slug: string;
    status: 'active' | 'archived';
  }>;
  activeLinkedCapabilityCount: number;
  archivedLinkedCapabilityCount: number;
  governanceTargetCapabilityCount: number;
  governanceRecommendationStatus:
    | 'await_governance_targets'
    | 'blocked_by_recent_failures'
    | 'await_direct_verify'
    | 'await_more_capability_recovery'
    | '';
  governanceRecommendationReason: string;
  governanceAutoUnlockCondition: string;
  governanceRequiredPassedCapabilityCount: number;
  governancePassedCapabilityCount: number;
  governanceDirectVerifyPassedCapabilityCount: number;
  queueItems: Array<{
    capabilityUid: string;
    capabilityName: string;
    recommendationKind: string;
    recommendedMode: CapabilityVerificationMode | '';
    lastVerificationIntent: CapabilityVerificationIntent | '';
    latestRepairObservationAt?: string;
    latestRepairObservationSummary?: string;
    latestRepairObservationVerifierCheckUids?: string[];
    promotionGraderDecision?: IntentPromotionGraderDecision | null;
    promotionGraderAudit?: IntentPromotionGraderAuditOutput | null;
  }>;
  recommendedCapabilityCount: number;
  recommendedRepairCount: number;
  recommendedReviewCount: number;
  recommendedVerificationCount: number;
  latestRepairObservationAt?: string;
  latestRepairObservationSummary?: string;
  latestRepairObservationVerifierCheckUids?: string[];
  failurePressureSummary?: {
    recentFailedReviewCapabilityCount: number;
    recentFailedVerifyCapabilityCount: number;
    recentFailedReviewExecutionCount: number;
    recentFailedVerifyExecutionCount: number;
    recentFailureWindowDays: number;
    highFailureCandidateCount: number;
    highFailureRepairCount: number;
    highFailureGovernanceCount: number;
    latestRepairObservationAt?: string;
    latestRepairObservationSummary?: string;
    latestRepairObservationVerifierCheckUids?: string[];
  };
  failurePressure: {
    recentFailedReviewCapabilityCount: number;
    recentFailedVerifyCapabilityCount: number;
    recentFailedReviewExecutionCount: number;
    recentFailedVerifyExecutionCount: number;
    recentFailureWindowDays: number;
  };
  recentFailedReviewCapabilityCount: number;
  recentFailedVerifyCapabilityCount: number;
};

type CapabilityStarterHelperHealthSnapshotResponse = {
  snapshot: {
    version: 1;
    snapshotId: string;
    capturedAt: string;
    projectUid: string;
    actorLabel: string;
    source: {
      runLimit: number;
      auditLimit: number;
      queueLimit: number;
      starterHelperCount: number;
      suppressedStarterHelperCount: number;
      capabilityCount: number;
      activeCapabilityCount: number;
      archivedCapabilityCount: number;
      queueCandidateCount: number;
      queueReturnedCount: number;
    };
    summary: {
      totalHelpers: number;
      preferredCount: number;
      watchingCount: number;
      recoveringWatchingCount: number;
      mixedWatchingCount: number;
      neutralCount: number;
      suppressedCount: number;
      promoteReadyCount: number;
      blockedByFailurePressureCount: number;
      weakRecoveryCount: number;
      governanceHelperCount: number;
      linkedActiveCapabilityCount: number;
      linkedArchivedCapabilityCount: number;
      recommendedCapabilityCount: number;
      recommendedRepairCount: number;
      recommendedReviewCount: number;
      promotionGraderSummary?: IntentPromotionGraderSummary;
      failurePressureSummary?: {
        recentFailedReviewCapabilityCount: number;
        recentFailedVerifyCapabilityCount: number;
        recentFailedReviewExecutionCount: number;
        recentFailedVerifyExecutionCount: number;
        recentFailureWindowDays: number;
        highFailureCandidateCount: number;
        highFailureRepairCount: number;
        highFailureGovernanceCount: number;
        latestRepairObservationAt?: string;
        latestRepairObservationSummary?: string;
        latestRepairObservationVerifierCheckUids?: string[];
      };
      failurePressure: {
        recentFailedReviewCapabilityCount: number;
        recentFailedVerifyCapabilityCount: number;
        recentFailedReviewExecutionCount: number;
        recentFailedVerifyExecutionCount: number;
        recentFailureWindowDays: number;
      };
      recentFailedReviewCapabilityCount: number;
      recentFailedVerifyCapabilityCount: number;
    };
    items: CapabilityStarterHelperHealthItem[];
  };
  auditLogPath: string;
  fresh: boolean;
  staleFallback: boolean;
  refreshError: string;
};

type CapabilitySuppressedStarterHistoryItem = {
  helper: string;
  suppressionReason: string;
  supportingRuleIds: string[];
  supportingRuleTitles: string[];
  knowledgeChangeDecisionableRuleCount: number;
  knowledgeChangeSupportingAuditIds: string[];
  activeLinkedCapabilityCount: number;
  archivedLinkedCapabilityCount: number;
};

type CapabilityVerificationRecommendationKind =
  | 'repair_failed'
  | 'suppressed_helper_review'
  | 'starter_promotion'
  | 'watching_starter_verification'
  | 'knowledge_verification'
  | 'unknown_verification';

type CapabilityVerificationRecommendationItem = {
  capabilityUid: string;
  slug: string;
  name: string;
  capabilityType: CapabilityType;
  verificationStatus: CapabilityVerificationStatus;
  verificationLabel: string;
  originKind: IntentCapabilityOriginKind;
  originLabel: string;
  recommendationKind: CapabilityVerificationRecommendationKind;
  recommendationLabel: string;
  recommendedMode: CapabilityVerificationMode;
  reason: string;
  starterHelper: string;
  starterKnowledgeChangeSignal: 'positive' | 'negative' | '';
  starterKnowledgeChangeTier: 'preferred' | 'watching' | '';
  starterKnowledgeChangeWatchingKind: 'recovering' | 'mixed' | '';
  starterKnowledgeChangeDecisionableRuleCount: number;
  suppressedStarterHelper: boolean;
  suppressedStarterReason: string;
  suppressedStarterActiveLinkedCapabilityCount: number;
  supportingRuleNames: string[];
  lastVerificationStatus: 'passed' | 'failed' | '';
  lastVerificationExecutionUid: string;
  lastVerificationCheckedAt: string;
  lastVerificationIntent: CapabilityVerificationIntent | '';
  recentFailedReviewExecutionCount: number;
  recentFailedVerifyExecutionCount: number;
  recentFailureWindowDays: number;
  recentStarterHelperFailedReviewExecutionCount: number;
  recentStarterHelperFailedVerifyExecutionCount: number;
  recentStarterHelperFailureWindowDays: number;
  latestRepairObservationAt?: string;
  latestRepairObservationSummary?: string;
  latestRepairObservationVerifierCheckUids?: string[];
  highFailurePressure: boolean;
  highFailurePressureSource: 'capability' | 'starter_helper' | 'mixed' | '';
  promotionEvidence?: IntentPromotionEvidence | null;
  promotionGraderInput?: IntentPromotionGraderInput | null;
  promotionGraderDecision?: IntentPromotionGraderDecision | null;
  promotionGraderAudit?: IntentPromotionGraderAuditOutput | null;
};

type CapabilityVerificationRecommendationResponse = {
  summary: {
    totalActiveCapabilities: number;
    candidateCount: number;
    returnedCount: number;
    repairCount: number;
    suppressedReviewCount: number;
    starterVerificationCount: number;
    knowledgeVerificationCount: number;
    unknownVerificationCount: number;
    failurePressureSummary?: {
      recentFailedReviewCapabilityCount: number;
      recentFailedVerifyCapabilityCount: number;
      recentFailedReviewExecutionCount: number;
      recentFailedVerifyExecutionCount: number;
      recentFailureWindowDays: number;
      highFailureCandidateCount: number;
      highFailureRepairCount: number;
      highFailureGovernanceCount: number;
      latestRepairObservationAt?: string;
      latestRepairObservationSummary?: string;
      latestRepairObservationVerifierCheckUids?: string[];
    };
    promotionGraderSummary?: IntentPromotionGraderSummary;
    highFailureCandidateCount: number;
    highFailureRepairCount: number;
    highFailureGovernanceCount: number;
  };
  items: CapabilityVerificationRecommendationItem[];
};

type CapabilityPromotionGovernanceAuditLaunchItem = {
  capabilityUid: string;
  capabilityName: string;
  sourceHelper: string;
  recommendationKind: string;
  recommendedMode: CapabilityVerificationMode | '';
  verificationIntent: CapabilityVerificationIntent | '';
  promotionGraderAudit?: IntentPromotionGraderAuditOutput | null;
};

type CapabilityVerificationQueueFocus = 'auto' | 'all' | 'high_failure' | 'promotion';

type WorkbenchView = 'recipe' | 'knowledge' | 'capability';

type KnowledgeFormState = {
  name: string;
  sourceType: KnowledgeSourceType;
  sourcePath: string;
  content: string;
};

type CapabilityFormState = {
  slug: string;
  name: string;
  description: string;
  capabilityType: CapabilityType;
  entryUrl: string;
  triggerPhrases: string;
  preconditions: string;
  steps: string;
  assertions: string;
  cleanupNotes: string;
  dependsOn: string;
  sortOrder: number;
  sourceDocumentUid: string;
  meta: unknown;
};

type RecipeWorkbenchFormState = IntentProjectRecipeWorkbenchForm;

type CapabilityEditorSection = 'basic' | 'matching' | 'execution' | 'cleanup';

type CapabilityEditorSectionState = Record<CapabilityEditorSection, boolean>;

type CapabilityOriginFilter = 'all' | IntentCapabilityOriginKind;
type CapabilityVerificationFilter = 'all' | CapabilityVerificationStatus;

type ProjectIntentWorkbenchProps = {
  projectUid: string;
  activeModules: ModuleOption[];
  defaultTaskModuleUid: string;
  canEditContent: boolean;
  creationBlockedReason: string;
  onApplyTaskDraft: (draft: IntentTaskDraft) => void;
  hideTrigger?: boolean;
  externalOpenKey?: string;
  externalOpenView?: WorkbenchView;
  launchPreset?: {
    token: string;
    view: WorkbenchView;
    capabilityPreset: IntentCapabilityPreset;
  } | null;
  onLaunchPresetConsumed?: (token: string) => void;
};

function capabilityTypeLabel(value: CapabilityType): string {
  switch (value) {
    case 'auth':
      return '登录';
    case 'navigation':
      return '导航';
    case 'action':
      return '动作';
    case 'assertion':
      return '断言';
    case 'query':
      return '查询';
    case 'composite':
      return '复合';
    default:
      return value;
  }
}

function capabilityTypeTone(value: CapabilityType): string {
  switch (value) {
    case 'auth':
      return 'bg-slate-100 text-slate-700 ring-slate-200';
    case 'navigation':
      return 'bg-sky-50 text-sky-700 ring-sky-200';
    case 'action':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'query':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'assertion':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    case 'composite':
      return 'bg-violet-50 text-violet-700 ring-violet-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function capabilityVerificationStatusTone(value: CapabilityVerificationStatus): string {
  switch (value) {
    case 'execution_verified':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'knowledge_inferred':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    default:
      return 'bg-slate-100 text-slate-500 ring-slate-200';
  }
}

function capabilityVerificationTone(meta: unknown): string {
  return capabilityVerificationStatusTone(describeCapabilityVerification(meta).status);
}

function capabilityOriginTone(value: IntentCapabilityOriginKind): string {
  switch (value) {
    case 'starter_asset':
      return 'bg-blue-50 text-blue-700 ring-blue-200';
    case 'execution_derived':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'knowledge_document':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'manual':
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function capabilityVerificationFilterLabel(value: CapabilityVerificationFilter): string {
  switch (value) {
    case 'execution_verified':
      return '执行验证';
    case 'knowledge_inferred':
      return '知识提炼';
    case 'unknown':
      return '未标注';
    case 'all':
    default:
      return '全部状态';
  }
}

function capabilityOriginFilterLabel(value: CapabilityOriginFilter): string {
  switch (value) {
    case 'starter_asset':
      return 'Starter 资产';
    case 'execution_derived':
      return '执行沉淀';
    case 'knowledge_document':
      return '知识提炼';
    case 'manual':
      return '手工维护';
    case 'all':
    default:
      return '全部来源';
  }
}

function starterHelperSourceLabel(value: 'promoted' | 'stable' | ''): string {
  switch (value) {
    case 'promoted':
      return '转正规则';
    case 'stable':
      return '稳定规则';
    default:
      return '';
  }
}

function starterHelperSourceTone(value: 'promoted' | 'stable' | ''): string {
  switch (value) {
    case 'promoted':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'stable':
      return 'bg-sky-50 text-sky-700 ring-sky-200';
    default:
      return 'bg-slate-100 text-slate-500 ring-slate-200';
  }
}

function starterHelperKnowledgeSignalLabel(value: 'positive' | 'negative' | ''): string {
  switch (value) {
    case 'positive':
      return '长期正向';
    case 'negative':
      return '长期负向';
    default:
      return '';
  }
}

function starterHelperKnowledgeSignalTone(value: 'positive' | 'negative' | ''): string {
  switch (value) {
    case 'positive':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'negative':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    default:
      return 'bg-slate-100 text-slate-500 ring-slate-200';
  }
}

function starterHelperKnowledgeTierLabel(
  value: 'preferred' | 'watching' | '',
  watchingKind: 'recovering' | 'mixed' | '' = ''
): string {
  switch (value) {
    case 'preferred':
      return '优先层';
    case 'watching':
      return watchingKind === 'mixed' ? '混合观察' : watchingKind === 'recovering' ? '恢复观察' : '观察中';
    default:
      return '';
  }
}

function starterHelperKnowledgeTierTone(
  value: 'preferred' | 'watching' | '',
  watchingKind: 'recovering' | 'mixed' | '' = ''
): string {
  switch (value) {
    case 'preferred':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'watching':
      return watchingKind === 'recovering'
        ? 'bg-sky-50 text-sky-700 ring-sky-200'
        : 'bg-amber-50 text-amber-700 ring-amber-200';
    default:
      return 'bg-slate-100 text-slate-500 ring-slate-200';
  }
}

function starterHelperHealthTone(
  value: 'preferred' | 'watching' | 'neutral' | 'suppressed',
  watchingKind: 'recovering' | 'mixed' | '' = ''
): string {
  switch (value) {
    case 'preferred':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'watching':
      return watchingKind === 'recovering'
        ? 'bg-sky-50 text-sky-700 ring-sky-200'
        : 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'suppressed':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    case 'neutral':
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function starterHelperGovernanceRecommendationLabel(
  value: CapabilityStarterHelperHealthItem['governanceRecommendationStatus']
): string {
  switch (value) {
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

function starterHelperGovernanceRecommendationTone(
  value: CapabilityStarterHelperHealthItem['governanceRecommendationStatus']
): string {
  switch (value) {
    case 'await_governance_targets':
      return 'bg-slate-100 text-slate-600 ring-slate-200';
    case 'blocked_by_recent_failures':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    case 'await_direct_verify':
      return 'bg-blue-50 text-blue-700 ring-blue-200';
    case 'await_more_capability_recovery':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function starterHelperPreferredPromotionLabel(
  value: CapabilityStarterHelperHealthItem['preferredPromotionStatus']
): string {
  switch (value) {
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
  value: CapabilityStarterHelperHealthItem['preferredPromotionStatus']
): string {
  switch (value) {
    case 'await_more_positive_rules':
      return 'bg-blue-50 text-blue-700 ring-blue-200';
    case 'blocked_by_mixed_evidence':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'await_long_term_recovery':
      return 'bg-cyan-50 text-cyan-700 ring-cyan-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function promotionEvidenceReadinessLabel(
  value: IntentPromotionEvidence['readiness'] | undefined | null
): string {
  switch (value) {
    case 'promote_ready':
      return '证据可提级';
    case 'watching':
      return '证据观察中';
    case 'suppressed':
      return '证据已过滤';
    case 'blocked_by_failure_pressure':
      return '高压阻断';
    case 'not_ready':
    default:
      return '证据未就绪';
  }
}

function promotionEvidenceReadinessTone(
  value: IntentPromotionEvidence['readiness'] | undefined | null
): string {
  switch (value) {
    case 'promote_ready':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'watching':
      return 'bg-blue-50 text-blue-700 ring-blue-200';
    case 'suppressed':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    case 'blocked_by_failure_pressure':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'not_ready':
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function capabilityVerificationRecommendationTone(value: CapabilityVerificationRecommendationKind): string {
  switch (value) {
    case 'repair_failed':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    case 'suppressed_helper_review':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'starter_promotion':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'watching_starter_verification':
      return 'bg-blue-50 text-blue-700 ring-blue-200';
    case 'knowledge_verification':
    case 'unknown_verification':
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function capabilityVerificationQueueFocusLabel(value: CapabilityVerificationQueueFocus): string {
  switch (value) {
    case 'promotion':
      return '提级治理';
    case 'high_failure':
      return '高频失败';
    case 'auto':
      return '自动';
    case 'all':
    default:
      return '全部';
  }
}

function sourceTypeLabel(value: KnowledgeSourceType): string {
  switch (value) {
    case 'notes':
      return '笔记';
    case 'execution':
      return '执行沉淀';
    case 'system':
      return '系统';
    case 'manual':
    default:
      return '手册';
  }
}

function sourceTypeVerificationHint(value: KnowledgeSourceType): string {
  switch (value) {
    case 'execution':
      return '执行沉淀文档自动沉淀后会标记为执行验证，并在 recipe 同分时优先命中。';
    case 'system':
      return '系统知识默认作为结构化上下文使用；若来自真实执行结论，可在导入后沉淀为执行验证能力。';
    case 'notes':
      return '笔记文档自动沉淀后默认标记为知识提炼，适合补充命中词和页面结构。';
    case 'manual':
    default:
      return '手册文档自动沉淀后默认标记为知识提炼，后续结合执行沉淀可升级命中优先级。';
  }
}

function workbenchViewLabel(value: WorkbenchView): string {
  switch (value) {
    case 'knowledge':
      return '知识文档';
    case 'capability':
      return '稳定能力';
    case 'recipe':
    default:
      return '需求编排';
  }
}

function workbenchViewDescription(value: WorkbenchView): string {
  switch (value) {
    case 'knowledge':
      return '导入手册、浏览目录并预览切块结果。';
    case 'capability':
      return '搜索、筛选、验证并编辑稳定能力。';
    case 'recipe':
    default:
      return '输入需求、检查覆盖并回填任务草稿。';
  }
}

function excerpt(text: string, maxLength = 150): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function formatDateTimeLabel(value: string): string {
  if (!value) return '刚刚';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatPercentLabel(value: number): string {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) return '未回填';
  const percent = normalized > 1 ? normalized : normalized * 100;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

function formatFileSizeLabel(value: number): string {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${Math.floor(size)} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatProjectRecipeChangeList(values: string[]): string {
  const items = values.map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items.join('、') : '无';
}

function summarizeShortTextList(values: string[], limit = 2): string {
  const items = values.map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) return '';
  if (items.length <= limit) return items.join(' / ');
  return `${items.slice(0, limit).join(' / ')} 等 ${items.length} 项`;
}

function buildCapabilityVerificationObservationKey(
  capabilityUid: string,
  verificationIntent?: CapabilityVerificationIntent | ''
): string {
  return `${capabilityUid.trim()}::${verificationIntent === 'review' ? 'review' : verificationIntent === 'verify' ? 'verify' : 'all'}`;
}

function createEmptyCapabilityVerificationObservation(): Pick<
  CapabilityVerificationMonitorItem,
  'latestRepairObservationAt' | 'latestRepairObservationSummary' | 'latestRepairObservationVerifierCheckUids'
> {
  return {
    latestRepairObservationAt: '',
    latestRepairObservationSummary: '',
    latestRepairObservationVerifierCheckUids: [],
  };
}

function resolveCapabilityLastVerificationIntent(item: CapabilityItem): CapabilityVerificationIntent | undefined {
  const lastAttempt = getCapabilityLastVerificationAttempt(item.meta);
  return lastAttempt.intent === 'review' || lastAttempt.intent === 'verify' ? lastAttempt.intent : undefined;
}

function projectRecipeAuditOperationLabel(value: ProjectRecipeAuditOperation): string {
  switch (value) {
    case 'register':
      return '注册';
    case 'merge':
      return '合并';
    case 'update':
      return '更新';
    case 'restore':
      return '恢复';
    default:
      return value;
  }
}

function projectRecipeGovernanceStatusClassName(value: ProjectRecipeGovernanceStatus): string {
  switch (value) {
    case 'promote':
      return 'bg-emerald-100 text-emerald-700';
    case 'degrade':
      return 'bg-rose-100 text-rose-700';
    case 'synced':
      return 'bg-slate-100 text-slate-600';
    case 'observe':
    default:
      return 'bg-amber-100 text-amber-700';
  }
}

function isTerminalExecutionStatus(status: CapabilityVerificationExecutionStatus): boolean {
  return status === 'passed' || status === 'failed' || status === 'canceled';
}

function normalizeCapabilityExecutionStatus(input: unknown): CapabilityVerificationExecutionStatus {
  if (input === 'running' || input === 'passed' || input === 'failed' || input === 'canceled') return input;
  return 'queued';
}

function normalizeCapabilityVerificationIntent(input: unknown): CapabilityVerificationIntent {
  return input === 'review' ? 'review' : 'verify';
}

function isCapabilityVerificationSynced(input: {
  capability: CapabilityItem | undefined;
  batchStartedAt: string;
  executionUid: string;
  executionStatus: CapabilityVerificationExecutionStatus;
}): boolean {
  if (!input.capability) return false;

  const lastAttempt = getCapabilityLastVerificationAttempt(input.capability.meta);
  if (lastAttempt.executionUid === input.executionUid) return true;
  if (!lastAttempt.checkedAt) return false;

  const checkedAt = Date.parse(lastAttempt.checkedAt);
  const batchStartedAt = Date.parse(input.batchStartedAt);
  if (Number.isNaN(checkedAt) || Number.isNaN(batchStartedAt) || checkedAt < batchStartedAt) {
    return false;
  }

  if (input.executionStatus === 'passed') {
    return describeCapabilityVerification(input.capability.meta).status === 'execution_verified';
  }

  return true;
}

function createCapabilityVerificationBatchUid(): string {
  return `capability-batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildPromotionGovernanceAuditLaunchItems(
  capabilities: CapabilityItem[],
  sourceItems: CapabilityPromotionGovernanceAuditLaunchItem[],
  fallbackVerificationIntent: CapabilityVerificationIntent
): CapabilityPromotionGovernanceAuditLaunchItem[] {
  const sourceByCapabilityUid = new Map(sourceItems.map((item) => [item.capabilityUid, item]));

  return capabilities.flatMap<CapabilityPromotionGovernanceAuditLaunchItem>((capability) => {
    const source = sourceByCapabilityUid.get(capability.capabilityUid);
    if (!source?.promotionGraderAudit) return [];

    return [
      {
        capabilityUid: capability.capabilityUid,
        capabilityName: source.capabilityName || capability.name,
        sourceHelper: source.sourceHelper || source.promotionGraderAudit.starterHelper,
        recommendationKind: source.recommendationKind,
        recommendedMode: source.recommendedMode,
        verificationIntent: source.verificationIntent || fallbackVerificationIntent,
        promotionGraderAudit: source.promotionGraderAudit,
      },
    ];
  });
}

function buildPromotionGovernanceAuditSourceItemsFromQueue(
  queueItems: CapabilityVerificationRecommendationItem[]
): CapabilityPromotionGovernanceAuditLaunchItem[] {
  return queueItems.flatMap<CapabilityPromotionGovernanceAuditLaunchItem>((item) => {
    if (!item.promotionGraderAudit) return [];
    return [
      {
        capabilityUid: item.capabilityUid,
        capabilityName: item.name,
        sourceHelper: item.starterHelper || item.promotionGraderAudit.starterHelper,
        recommendationKind: item.recommendationKind,
        recommendedMode: item.recommendedMode,
        verificationIntent:
          item.promotionGraderAudit.verificationIntent ||
          item.promotionGraderDecision?.verificationIntent ||
          item.lastVerificationIntent,
        promotionGraderAudit: item.promotionGraderAudit,
      },
    ];
  });
}

function buildPromotionGovernanceAuditSourceItemsFromHelperHealth(
  helperItems: CapabilityStarterHelperHealthItem[]
): CapabilityPromotionGovernanceAuditLaunchItem[] {
  return helperItems.flatMap<CapabilityPromotionGovernanceAuditLaunchItem>((helperItem) =>
    helperItem.queueItems.flatMap((queueItem) => {
      if (!queueItem.promotionGraderAudit) return [];
      return [
        {
          capabilityUid: queueItem.capabilityUid,
          capabilityName: queueItem.capabilityName,
          sourceHelper: helperItem.helper,
          recommendationKind: queueItem.recommendationKind,
          recommendedMode: queueItem.recommendedMode,
          verificationIntent:
            queueItem.promotionGraderAudit.verificationIntent ||
            queueItem.promotionGraderDecision?.verificationIntent ||
            queueItem.lastVerificationIntent,
          promotionGraderAudit: queueItem.promotionGraderAudit,
        },
      ];
    })
  );
}

function describeCapabilityVerificationBatchKind(input: {
  mode: CapabilityVerificationMode;
  verificationIntent?: CapabilityVerificationIntent;
}): { label: string; className: string } {
  if (input.mode === 'repair') {
    return {
      label: '失败修复',
      className: 'bg-violet-50 text-violet-700 ring-violet-200',
    };
  }
  if (input.verificationIntent === 'review') {
    return {
      label: '保守复核',
      className: 'bg-amber-50 text-amber-700 ring-amber-200',
    };
  }
  return {
    label: '验证升级',
    className: 'bg-blue-50 text-blue-700 ring-blue-200',
  };
}

function describeCapabilityVerificationSyncLabel(input: {
  mode: CapabilityVerificationMode;
  verificationIntent?: CapabilityVerificationIntent;
  status: CapabilityVerificationExecutionStatus;
  synced: boolean;
}): string {
  if (!input.synced) return '等待目录回写';
  if (input.status !== 'passed') return '目录已同步';
  if (input.mode === 'verify' && input.verificationIntent === 'review') return '已完成保守复核';
  return '已升级执行验证';
}

function describeCapabilityVerificationLaunchLabel(
  mode: CapabilityVerificationMode,
  verificationIntent?: CapabilityVerificationIntent
): string {
  if (mode === 'repair') return '验证修复';
  return verificationIntent === 'review' ? '保守复核' : '能力验证';
}

function capabilityVerificationIntentLabel(value: CapabilityVerificationIntent | ''): string {
  if (value === 'review') return '保守复核';
  if (value === 'verify') return '标准验证';
  return '未标注意图';
}

function summarizeCapabilityItems(items: CapabilityItem[], maxItems = 3): string {
  if (items.length === 0) return '';
  const names = items.map((item) => `「${item.name}」`);
  if (names.length <= maxItems) return names.join('、');
  return `${names.slice(0, maxItems).join('、')} 等 ${items.length} 条`;
}

function summarizeCapabilityFailures(
  failures: Array<{ item: CapabilityItem; reason: string }>,
  maxItems = 2
): string {
  if (failures.length === 0) return '';
  const summary = failures
    .slice(0, maxItems)
    .map(({ item, reason }) => `「${item.name}」${excerpt(reason, 24)}`)
    .join('；');
  return failures.length > maxItems ? `${summary}；另 ${failures.length - maxItems} 条失败` : summary;
}

function parseMultilineValues(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function formatMultilineValues(values: string[]): string {
  return values.map((item) => item.trim()).filter(Boolean).join('\n');
}

function toSafeSortOrder(input: string | number): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : 100;
}

function matchesCapabilitySearch(item: CapabilityItem, query: string, sourceDocumentName = '', metaSearchText = ''): boolean {
  if (!query) return true;

  const haystack = [
    item.slug,
    item.name,
    item.description,
    capabilityTypeLabel(item.capabilityType),
    item.entryUrl,
    item.cleanupNotes,
    sourceDocumentName,
    ...item.triggerPhrases,
    ...item.preconditions,
    ...item.steps,
    ...item.assertions,
    ...item.dependsOn,
    metaSearchText,
  ]
    .join('\n')
    .toLowerCase();

  return haystack.includes(query);
}

function createDefaultKnowledgeForm(): KnowledgeFormState {
  return {
    name: '',
    sourceType: 'manual',
    sourcePath: '',
    content: '',
  };
}

function createDefaultCapabilityForm(): CapabilityFormState {
  return {
    slug: '',
    name: '',
    description: '',
    capabilityType: 'action',
    entryUrl: '',
    triggerPhrases: '',
    preconditions: '',
    steps: '',
    assertions: '',
    cleanupNotes: '',
    dependsOn: '',
    sortOrder: 100,
    sourceDocumentUid: '',
    meta: null,
  };
}

function createDefaultRecipeWorkbenchForm(): RecipeWorkbenchFormState {
  return {
    slug: '',
    title: '',
    description: '',
  };
}

function capabilityToFormState(item: CapabilityItem): CapabilityFormState {
  return {
    slug: item.slug,
    name: item.name,
    description: item.description,
    capabilityType: item.capabilityType,
    entryUrl: item.entryUrl,
    triggerPhrases: formatMultilineValues(item.triggerPhrases),
    preconditions: formatMultilineValues(item.preconditions),
    steps: formatMultilineValues(item.steps),
    assertions: formatMultilineValues(item.assertions),
    cleanupNotes: item.cleanupNotes,
    dependsOn: formatMultilineValues(item.dependsOn),
    sortOrder: item.sortOrder,
    sourceDocumentUid: item.sourceDocumentUid || '',
    meta: item.meta ?? null,
  };
}

function capabilityPresetToFormState(item: IntentCapabilityPreset): CapabilityFormState {
  return {
    slug: item.slug,
    name: item.name,
    description: item.description,
    capabilityType: item.capabilityType,
    entryUrl: item.entryUrl,
    triggerPhrases: formatMultilineValues(item.triggerPhrases),
    preconditions: formatMultilineValues(item.preconditions),
    steps: formatMultilineValues(item.steps),
    assertions: formatMultilineValues(item.assertions),
    cleanupNotes: item.cleanupNotes,
    dependsOn: formatMultilineValues(item.dependsOn),
    sortOrder: item.sortOrder,
    sourceDocumentUid: item.sourceDocumentUid || '',
    meta: item.meta ?? null,
  };
}

function createCapabilityEditorSectionState(form: CapabilityFormState = createDefaultCapabilityForm()): CapabilityEditorSectionState {
  const flowPreview = form.capabilityType === 'composite' ? getIntentCapabilityFlowDefinition(form.meta, form.entryUrl) : null;
  return {
    basic: true,
    matching: Boolean(form.triggerPhrases.trim() || form.preconditions.trim()),
    execution: Boolean(form.steps.trim() || form.assertions.trim() || flowPreview?.steps.length),
    cleanup: Boolean(form.cleanupNotes.trim() || form.dependsOn.trim()),
  };
}

function normalizeCapabilityMetaForSave(capabilityType: CapabilityType, meta: unknown): unknown {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const next = { ...(meta as Record<string, unknown>) };
  if (capabilityType !== 'composite') {
    delete next.flowDefinition;
    delete next.sourceTaskMode;
  }
  return Object.keys(next).length > 0 ? next : null;
}

export default function ProjectIntentWorkbench({
  projectUid,
  activeModules,
  defaultTaskModuleUid,
  canEditContent,
  creationBlockedReason,
  onApplyTaskDraft,
  hideTrigger = false,
  externalOpenKey = '',
  externalOpenView = 'recipe',
  launchPreset,
  onLaunchPresetConsumed,
}: ProjectIntentWorkbenchProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<WorkbenchView>('recipe');
  const [loadingContext, setLoadingContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [knowledgeSaving, setKnowledgeSaving] = useState(false);
  const [capabilitySaving, setCapabilitySaving] = useState(false);
  const [documentActioningUid, setDocumentActioningUid] = useState('');
  const [capabilityActioningUid, setCapabilityActioningUid] = useState('');
  const [verifyingCapabilityUid, setVerifyingCapabilityUid] = useState('');
  const [verifyingCapabilityMode, setVerifyingCapabilityMode] = useState<CapabilityVerificationMode | ''>('');
  const [derivingKnowledgeTarget, setDerivingKnowledgeTarget] = useState('');
  const [loadingDocumentPreview, setLoadingDocumentPreview] = useState(false);
  const [documents, setDocuments] = useState<KnowledgeDocumentItem[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityItem[]>([]);
  const [documentPreviewChunks, setDocumentPreviewChunks] = useState<KnowledgeChunkItem[]>([]);
  const [documentPreviewSearch, setDocumentPreviewSearch] = useState('');
  const [selectedDocumentUid, setSelectedDocumentUid] = useState('');
  const [editingCapabilityUid, setEditingCapabilityUid] = useState('');
  const [capabilityModalOpen, setCapabilityModalOpen] = useState(false);
  const [capabilitySearch, setCapabilitySearch] = useState('');
  const [capabilityOriginFilter, setCapabilityOriginFilter] = useState<CapabilityOriginFilter>('all');
  const [capabilityVerificationFilter, setCapabilityVerificationFilter] = useState<CapabilityVerificationFilter>('all');
  const [capabilityHelperFilter, setCapabilityHelperFilter] = useState('');
  const [capabilityStarterHelperHealthSnapshot, setCapabilityStarterHelperHealthSnapshot] =
    useState<CapabilityStarterHelperHealthSnapshotResponse | null>(null);
  const [capabilityStarterHelperHealthLoading, setCapabilityStarterHelperHealthLoading] = useState(false);
  const [capabilityStarterHelperHealthError, setCapabilityStarterHelperHealthError] = useState('');
  const [capabilityStarterHelperHealthLoadedProjectUid, setCapabilityStarterHelperHealthLoadedProjectUid] = useState('');
  const [capabilityVerificationQueue, setCapabilityVerificationQueue] =
    useState<CapabilityVerificationRecommendationResponse | null>(null);
  const [capabilityVerificationQueueLoading, setCapabilityVerificationQueueLoading] = useState(false);
  const [capabilityVerificationQueueError, setCapabilityVerificationQueueError] = useState('');
  const [capabilityVerificationQueueLoadedProjectUid, setCapabilityVerificationQueueLoadedProjectUid] = useState('');
  const [capabilityVerificationQueueFocus, setCapabilityVerificationQueueFocus] = useState<CapabilityVerificationQueueFocus>('auto');
  const [selectedCapabilityUids, setSelectedCapabilityUids] = useState<string[]>([]);
  const [bulkCapabilityAction, setBulkCapabilityAction] = useState<'' | 'archive' | 'verify' | 'repair'>('');
  const [capabilityVerificationBatches, setCapabilityVerificationBatches] = useState<CapabilityVerificationBatch[]>([]);
  const [requirement, setRequirement] = useState('创建商机并在商机列表按手机号校验落库');
  const [selectedModuleUid, setSelectedModuleUid] = useState(defaultTaskModuleUid);
  const [recipeResponse, setRecipeResponse] = useState<DraftRecipeResponse | null>(null);
  const [recipeWorkbenchForm, setRecipeWorkbenchForm] = useState<RecipeWorkbenchFormState>(() => createDefaultRecipeWorkbenchForm());
  const [projectRecipeProfile, setProjectRecipeProfile] = useState<ProjectRecipeProfileResponse | null>(null);
  const [projectRecipeBackups, setProjectRecipeBackups] = useState<ProjectRecipeBackupsResponse | null>(null);
  const [projectRecipeAudits, setProjectRecipeAudits] = useState<ProjectRecipeAuditsResponse | null>(null);
  const [projectRecipeGovernance, setProjectRecipeGovernance] = useState<ProjectRecipeGovernanceResponse | null>(null);
  const [projectRecipeAssetsLoading, setProjectRecipeAssetsLoading] = useState(false);
  const [projectRecipeAssetsError, setProjectRecipeAssetsError] = useState('');
  const [projectRecipeAssetsLoadedProjectUid, setProjectRecipeAssetsLoadedProjectUid] = useState('');
  const [projectRecipeSaving, setProjectRecipeSaving] = useState(false);
  const [projectRecipeRestoringPath, setProjectRecipeRestoringPath] = useState('');
  const [projectRecipeGovernanceApplyingSlug, setProjectRecipeGovernanceApplyingSlug] = useState('');
  const [expandedProjectRecipeAuditIds, setExpandedProjectRecipeAuditIds] = useState<string[]>([]);
  const [selectedRecipeCapabilitySlugs, setSelectedRecipeCapabilitySlugs] = useState<string[]>([]);
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeFormState>(() => createDefaultKnowledgeForm());
  const [capabilityForm, setCapabilityForm] = useState<CapabilityFormState>(() => createDefaultCapabilityForm());
  const [capabilitySections, setCapabilitySections] = useState<CapabilityEditorSectionState>(() => createCapabilityEditorSectionState());
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [appliedLaunchToken, setAppliedLaunchToken] = useState('');
  const [appliedExternalOpenKey, setAppliedExternalOpenKey] = useState('');

  const documentNameByUid = useMemo(() => new Map(documents.map((item) => [item.documentUid, item.name])), [documents]);
  const activeDocuments = documents.filter((item) => item.status === 'active');
  const activeCapabilities = capabilities.filter((item) => item.status === 'active');
  const archivedCapabilityCount = Math.max(0, capabilities.length - activeCapabilities.length);
  const deferredDocumentPreviewSearch = useDeferredValue(documentPreviewSearch);
  const documentPreviewSearchQuery = deferredDocumentPreviewSearch.trim().toLowerCase();
  const deferredCapabilitySearch = useDeferredValue(capabilitySearch);
  const capabilitySearchQuery = deferredCapabilitySearch.trim().toLowerCase();
  const filteredDocumentPreviewChunks = documentPreviewChunks.filter((item) => {
    if (!documentPreviewSearchQuery) return true;
    const haystack = [item.heading, item.content, item.keywords.join(' ')].join('\n').toLowerCase();
    return haystack.includes(documentPreviewSearchQuery);
  });
  const capabilityStarterHelperOptions = useMemo(
    () =>
      Array.from(
        new Set(
          activeCapabilities
            .map((item) => readIntentCapabilityStarterHelper(item.meta))
            .map((item) => item.trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [activeCapabilities]
  );
  const starterCapabilityCount = useMemo(
    () => activeCapabilities.filter((item) => describeIntentCapabilityOrigin(item.meta).kind === 'starter_asset').length,
    [activeCapabilities]
  );
  const capabilityCatalogItems = useMemo(
    () =>
      capabilities
        .filter((item) => {
          const sourceDocumentName = documentNameByUid.get(item.sourceDocumentUid) || '';
          const origin = describeIntentCapabilityOrigin(item.meta);
          const verification = describeCapabilityVerification(item.meta);
          const starterHelper = readIntentCapabilityStarterHelper(item.meta);

          return (
            matchesCapabilitySearch(
              item,
              capabilitySearchQuery,
              sourceDocumentName,
              buildIntentCapabilityMetaSearchText(item.meta)
            ) &&
            (capabilityOriginFilter === 'all' || origin.kind === capabilityOriginFilter) &&
            (capabilityVerificationFilter === 'all' || verification.status === capabilityVerificationFilter) &&
            (!capabilityHelperFilter || starterHelper === capabilityHelperFilter)
          );
        })
        .sort((left, right) => {
          if (left.status !== right.status) {
            return left.status === 'active' ? -1 : 1;
          }
          return compareCapabilityVerificationOrder(left, right);
        }),
    [
      capabilities,
      capabilityHelperFilter,
      capabilityOriginFilter,
      capabilitySearchQuery,
      capabilityVerificationFilter,
      documentNameByUid,
    ]
  );
  const visibleSelectableCapabilityUids = useMemo(
    () => capabilityCatalogItems.filter((item) => item.status === 'active').map((item) => item.capabilityUid),
    [capabilityCatalogItems]
  );
  const visibleSelectableCapabilityUidSet = useMemo(
    () => new Set(visibleSelectableCapabilityUids),
    [visibleSelectableCapabilityUids]
  );
  const selectedCapabilityUidSet = useMemo(
    () => new Set(selectedCapabilityUids.filter((item) => visibleSelectableCapabilityUidSet.has(item))),
    [selectedCapabilityUids, visibleSelectableCapabilityUidSet]
  );
  const selectedCapabilityItems = useMemo(
    () => capabilityCatalogItems.filter((item) => item.status === 'active' && selectedCapabilityUidSet.has(item.capabilityUid)),
    [capabilityCatalogItems, selectedCapabilityUidSet]
  );
  const selectedRepairableCapabilityItems = useMemo(
    () =>
      selectedCapabilityItems.filter((item) => {
        const lastAttempt = getCapabilityLastVerificationAttempt(item.meta);
        return lastAttempt.status === 'failed' && Boolean(lastAttempt.executionUid);
      }),
    [selectedCapabilityItems]
  );
  const selectedVerifiableCapabilityItems = useMemo(
    () =>
      selectedCapabilityItems.filter((item) => {
        const lastAttempt = getCapabilityLastVerificationAttempt(item.meta);
        return !(lastAttempt.status === 'failed' && Boolean(lastAttempt.executionUid));
      }),
    [selectedCapabilityItems]
  );
  const selectedStarterCapabilityCount = useMemo(
    () => selectedCapabilityItems.filter((item) => describeIntentCapabilityOrigin(item.meta).kind === 'starter_asset').length,
    [selectedCapabilityItems]
  );
  const effectiveVerificationModuleUid = selectedModuleUid || defaultTaskModuleUid || activeModules[0]?.moduleUid || '';
  const selectedModuleName = activeModules.find((item) => item.moduleUid === effectiveVerificationModuleUid)?.name || '未选择';
  const hasCapabilityVerificationModule = Boolean(effectiveVerificationModuleUid);
  const capabilityCatalogBusy = Boolean(capabilityActioningUid || verifyingCapabilityUid || bulkCapabilityAction || capabilitySaving);
  const scopedCapabilityStarterHelperHealthSnapshot =
    capabilityStarterHelperHealthLoadedProjectUid === projectUid ? capabilityStarterHelperHealthSnapshot : null;
  const scopedCapabilityVerificationQueue =
    capabilityVerificationQueueLoadedProjectUid === projectUid ? capabilityVerificationQueue : null;
  const scopedProjectRecipeProfile = projectRecipeAssetsLoadedProjectUid === projectUid ? projectRecipeProfile : null;
  const scopedProjectRecipeBackups = projectRecipeAssetsLoadedProjectUid === projectUid ? projectRecipeBackups : null;
  const scopedProjectRecipeAudits = projectRecipeAssetsLoadedProjectUid === projectUid ? projectRecipeAudits : null;
  const scopedProjectRecipeGovernance = projectRecipeAssetsLoadedProjectUid === projectUid ? projectRecipeGovernance : null;
  const capabilityVerificationQueueItems = scopedCapabilityVerificationQueue?.items || [];
  const capabilityVerificationQueueSummary = scopedCapabilityVerificationQueue?.summary || null;
  const capabilityStarterHelperHealthItems = scopedCapabilityStarterHelperHealthSnapshot?.snapshot.items || [];
  const projectRecipeProfileItems = scopedProjectRecipeProfile?.profile.recipes || [];
  const projectRecipeBackupItems = scopedProjectRecipeBackups?.backups || [];
  const projectRecipeAuditItems = scopedProjectRecipeAudits?.items || [];
  const projectRecipeGovernanceItems = scopedProjectRecipeGovernance?.items || [];
  const projectRecipeGovernanceSummary = scopedProjectRecipeGovernance?.summary || {
    totalProjectRecipes: 0,
    actionableCount: 0,
    promoteCount: 0,
    degradeCount: 0,
    observeCount: 0,
    syncedCount: 0,
    runLimit: 50,
    latestRepairObservationAt: '',
    latestRepairObservationRecipeSlug: '',
    latestRepairObservationRecipeTitle: '',
    latestRepairObservationSummary: '',
  };
  const projectRecipeProfilePreviewItems = projectRecipeProfileItems.slice(0, 4);
  const projectRecipeBackupPreviewItems = projectRecipeBackupItems.slice(0, 4);
  const projectRecipeAuditPreviewItems = projectRecipeAuditItems.slice(0, 4);
  const projectRecipeProfileBySlug = useMemo(
    () => new Map(projectRecipeProfileItems.map((item) => [item.slug, item])),
    [projectRecipeProfileItems]
  );
  const hasScopedProjectRecipeAssets = Boolean(
    scopedProjectRecipeProfile || scopedProjectRecipeBackups || scopedProjectRecipeAudits || scopedProjectRecipeGovernance
  );
  const capabilityStarterHelperHealthSummary = scopedCapabilityStarterHelperHealthSnapshot?.snapshot.summary || {
    totalHelpers: 0,
    preferredCount: 0,
    watchingCount: 0,
    recoveringWatchingCount: 0,
    mixedWatchingCount: 0,
    neutralCount: 0,
    suppressedCount: 0,
    promoteReadyCount: 0,
    blockedByFailurePressureCount: 0,
    weakRecoveryCount: 0,
    governanceHelperCount: 0,
    linkedActiveCapabilityCount: 0,
    linkedArchivedCapabilityCount: 0,
    recommendedCapabilityCount: 0,
    recommendedRepairCount: 0,
    recommendedReviewCount: 0,
    failurePressureSummary: {
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
    },
    failurePressure: {
      recentFailedReviewCapabilityCount: 0,
      recentFailedVerifyCapabilityCount: 0,
      recentFailedReviewExecutionCount: 0,
      recentFailedVerifyExecutionCount: 0,
      recentFailureWindowDays: 14,
    },
    recentFailedReviewCapabilityCount: 0,
    recentFailedVerifyCapabilityCount: 0,
  };
  const capabilityVerificationQueueFailureSummary = useMemo(
    () => normalizeIntentVerificationFailurePressureViewSummary(capabilityVerificationQueueSummary),
    [capabilityVerificationQueueSummary]
  );
  const capabilityStarterHelperFailureSummary = useMemo(
    () => normalizeIntentVerificationFailurePressureViewSummary(capabilityStarterHelperHealthSummary),
    [capabilityStarterHelperHealthSummary]
  );
  const capabilitySuppressedStarterHelperHistoryByHelper = useMemo(
    () =>
      new Map<string, CapabilitySuppressedStarterHistoryItem>(
        capabilityStarterHelperHealthItems
          .filter((item) => item.healthStatus === 'suppressed')
          .map((item) => [
            item.helper,
            {
              helper: item.helper,
              suppressionReason: item.recommendation,
              supportingRuleIds: item.supportingRuleIds,
              supportingRuleTitles: item.supportingRuleTitles,
              knowledgeChangeDecisionableRuleCount: item.knowledgeChangeDecisionableRuleCount,
              knowledgeChangeSupportingAuditIds: item.knowledgeChangeSupportingAuditIds,
              activeLinkedCapabilityCount: item.activeLinkedCapabilityCount,
              archivedLinkedCapabilityCount: item.archivedLinkedCapabilityCount,
            },
          ])
      ),
    [capabilityStarterHelperHealthItems]
  );
  const highFailureCapabilityVerificationQueueItems = useMemo(
    () => capabilityVerificationQueueItems.filter((item) => item.highFailurePressure),
    [capabilityVerificationQueueItems]
  );
  const promotionCapabilityVerificationQueueItems = useMemo(
    () => capabilityVerificationQueueItems.filter((item) => isCapabilityVerificationPromotionFocusItem(item)),
    [capabilityVerificationQueueItems]
  );
  const promotionCriticalCapabilityVerificationQueueItems = useMemo(
    () => promotionCapabilityVerificationQueueItems.filter((item) => isCapabilityVerificationPromotionCriticalItem(item)),
    [promotionCapabilityVerificationQueueItems]
  );
  const promotionCapabilityVerificationQueueSummary = useMemo(
    () => summarizeCapabilityVerificationPromotionFocus(capabilityVerificationQueueItems),
    [capabilityVerificationQueueItems]
  );
  const autoCapabilityVerificationQueueFocus: Exclude<CapabilityVerificationQueueFocus, 'auto'> =
    promotionCapabilityVerificationQueueSummary.criticalCount > 0
      ? 'promotion'
      : highFailureCapabilityVerificationQueueItems.length > 0
        ? 'high_failure'
        : promotionCapabilityVerificationQueueSummary.candidateCount > 0
          ? 'promotion'
          : 'all';
  const effectiveCapabilityVerificationQueueFocus: Exclude<CapabilityVerificationQueueFocus, 'auto'> =
    capabilityVerificationQueueFocus === 'auto' ? autoCapabilityVerificationQueueFocus : capabilityVerificationQueueFocus;
  const focusedCapabilityVerificationQueueItems = useMemo(
    () => {
      if (effectiveCapabilityVerificationQueueFocus === 'promotion') {
        return promotionCapabilityVerificationQueueItems;
      }
      if (effectiveCapabilityVerificationQueueFocus === 'high_failure') {
        return highFailureCapabilityVerificationQueueItems;
      }
      return capabilityVerificationQueueItems;
    },
    [
      capabilityVerificationQueueItems,
      effectiveCapabilityVerificationQueueFocus,
      highFailureCapabilityVerificationQueueItems,
      promotionCapabilityVerificationQueueItems,
    ]
  );
  const focusedCapabilityVerificationQueueItemCount = focusedCapabilityVerificationQueueItems.length;
  const hiddenCapabilityVerificationQueueItemCount = Math.max(
    0,
    capabilityVerificationQueueItems.length - focusedCapabilityVerificationQueueItemCount
  );
  const visibleCapabilityVerificationRecommendationItems = useMemo(
    () =>
      focusedCapabilityVerificationQueueItems.filter((item) => visibleSelectableCapabilityUidSet.has(item.capabilityUid)),
    [focusedCapabilityVerificationQueueItems, visibleSelectableCapabilityUidSet]
  );
  const visibleCapabilityVerificationRecommendationCount = visibleCapabilityVerificationRecommendationItems.length;
  const recommendedCapabilityVerificationTargets = useMemo(
    () =>
      resolveCapabilityVerificationRecommendationTargets({
        capabilities,
        queueItems: capabilityVerificationQueueItems,
      }),
    [capabilities, capabilityVerificationQueueItems]
  );
  const recommendedVerifyCapabilityItems = recommendedCapabilityVerificationTargets.verifyItems;
  const recommendedReviewCapabilityItems = recommendedCapabilityVerificationTargets.reviewItems;
  const recommendedRepairCapabilityItems = recommendedCapabilityVerificationTargets.repairItems;
  const highFailureCapabilityVerificationTargets = useMemo(
    () =>
      resolveCapabilityVerificationRecommendationTargets({
        capabilities,
        queueItems: highFailureCapabilityVerificationQueueItems,
      }),
    [capabilities, highFailureCapabilityVerificationQueueItems]
  );
  const highFailureRecommendedVerifyCapabilityItems = highFailureCapabilityVerificationTargets.verifyItems;
  const highFailureRecommendedReviewCapabilityItems = highFailureCapabilityVerificationTargets.reviewItems;
  const highFailureRecommendedRepairCapabilityItems = highFailureCapabilityVerificationTargets.repairItems;
  const promotionCapabilityVerificationTargets = useMemo(
    () =>
      resolveCapabilityVerificationRecommendationTargets({
        capabilities,
        queueItems: promotionCapabilityVerificationQueueItems,
      }),
    [capabilities, promotionCapabilityVerificationQueueItems]
  );
  const promotionRecommendedVerifyCapabilityItems = promotionCapabilityVerificationTargets.verifyItems;
  const promotionRecommendedReviewCapabilityItems = promotionCapabilityVerificationTargets.reviewItems;
  const highFailureSuppressedStarterHelperItems = useMemo(
    () => capabilityStarterHelperHealthItems.filter((item) => isIntentStarterHelperHighFailureSuppressed(item)),
    [capabilityStarterHelperHealthItems]
  );
  const suppressedStarterHelperGovernanceTargets = useMemo(
    () =>
      resolveIntentSuppressedStarterHelperGovernanceTargets({
        helpers: highFailureSuppressedStarterHelperItems,
        capabilities: activeCapabilities,
      }),
    [activeCapabilities, highFailureSuppressedStarterHelperItems]
  );
  const suppressedStarterHelperGovernanceReviewCapabilityItems = useMemo(
    () => collectIntentStarterHelperHealthGovernanceCapabilityItems(suppressedStarterHelperGovernanceTargets),
    [suppressedStarterHelperGovernanceTargets]
  );
  const capabilityVerificationBatchObservationMaps = useMemo(() => {
    const exactGroups = new Map<string, unknown[]>();
    const fallbackGroups = new Map<string, unknown[]>();
    const registerObservation = (
      capabilityUid: string,
      verificationIntent: CapabilityVerificationIntent | '',
      source: unknown
    ) => {
      const normalizedCapabilityUid = capabilityUid.trim();
      if (!normalizedCapabilityUid) return;

      const fallbackCurrent = fallbackGroups.get(normalizedCapabilityUid) || [];
      fallbackCurrent.push(source);
      fallbackGroups.set(normalizedCapabilityUid, fallbackCurrent);

      if (!verificationIntent) return;
      const exactKey = buildCapabilityVerificationObservationKey(normalizedCapabilityUid, verificationIntent);
      const exactCurrent = exactGroups.get(exactKey) || [];
      exactCurrent.push(source);
      exactGroups.set(exactKey, exactCurrent);
    };

    for (const item of capabilityVerificationQueueItems) {
      registerObservation(item.capabilityUid, item.lastVerificationIntent, item);
    }

    for (const helperItem of capabilityStarterHelperHealthItems) {
      for (const queueItem of helperItem.queueItems) {
        registerObservation(queueItem.capabilityUid, queueItem.lastVerificationIntent, queueItem);
      }
    }

    const exact = new Map<
      string,
      Pick<
        CapabilityVerificationMonitorItem,
        'latestRepairObservationAt' | 'latestRepairObservationSummary' | 'latestRepairObservationVerifierCheckUids'
      >
    >();
    const fallback = new Map<
      string,
      Pick<
        CapabilityVerificationMonitorItem,
        'latestRepairObservationAt' | 'latestRepairObservationSummary' | 'latestRepairObservationVerifierCheckUids'
      >
    >();

    for (const [key, items] of exactGroups.entries()) {
      exact.set(key, pickLatestIntentVerificationFailurePressureObservation(items));
    }
    for (const [capabilityUid, items] of fallbackGroups.entries()) {
      fallback.set(capabilityUid, pickLatestIntentVerificationFailurePressureObservation(items));
    }

    return { exact, fallback };
  }, [capabilityStarterHelperHealthItems, capabilityVerificationQueueItems]);
  const resolveCapabilityVerificationBatchObservation = (
    capabilityUid: string,
    verificationIntent?: CapabilityVerificationIntent
  ): Pick<
    CapabilityVerificationMonitorItem,
    'latestRepairObservationAt' | 'latestRepairObservationSummary' | 'latestRepairObservationVerifierCheckUids'
  > => {
    const normalizedCapabilityUid = capabilityUid.trim();
    if (!normalizedCapabilityUid) return createEmptyCapabilityVerificationObservation();

    if (verificationIntent) {
      const exact = capabilityVerificationBatchObservationMaps.exact.get(
        buildCapabilityVerificationObservationKey(normalizedCapabilityUid, verificationIntent)
      );
      if (exact && (exact.latestRepairObservationSummary || exact.latestRepairObservationVerifierCheckUids.length > 0)) {
        return exact;
      }
    }

    const fallback = capabilityVerificationBatchObservationMaps.fallback.get(normalizedCapabilityUid);
    if (fallback && (fallback.latestRepairObservationSummary || fallback.latestRepairObservationVerifierCheckUids.length > 0)) {
      return fallback;
    }

    return createEmptyCapabilityVerificationObservation();
  };
  const activeCapabilityVerificationBatchCount = useMemo(
    () => capabilityVerificationBatches.filter((item) => !item.completedAt).length,
    [capabilityVerificationBatches]
  );
  const activeCapabilityVerificationBatchSignature = useMemo(
    () =>
      capabilityVerificationBatches
        .filter((item) => !item.completedAt)
        .map((item) => item.batchUid)
        .join('|'),
    [capabilityVerificationBatches]
  );
  const completedCapabilityVerificationBatchCount = useMemo(
    () => capabilityVerificationBatches.filter((item) => Boolean(item.completedAt)).length,
    [capabilityVerificationBatches]
  );
  const baseRecipe = recipeResponse?.recipe || null;
  const recipeCapabilityDependents = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of baseRecipe?.matchedCapabilities || []) {
      for (const dependencySlug of item.dependsOn) {
        const current = map.get(dependencySlug) || [];
        current.push(item.slug);
        map.set(dependencySlug, current);
      }
    }
    return map;
  }, [baseRecipe]);
  const selectedRecipeCapabilitySlugSet = useMemo(
    () => new Set(selectedRecipeCapabilitySlugs.map((item) => item.trim()).filter(Boolean)),
    [selectedRecipeCapabilitySlugs]
  );
  const effectiveRecipe =
    baseRecipe &&
    applyCapabilitySelectionToRecipe({
      recipe: baseRecipe,
      selectedCapabilitySlugs: selectedRecipeCapabilitySlugs,
    });
  const capabilityFlowPreview =
    capabilityForm.capabilityType === 'composite'
      ? getIntentCapabilityFlowDefinition(capabilityForm.meta, capabilityForm.entryUrl)
      : null;
  const draftPreview =
    effectiveRecipe && selectedModuleUid
      ? buildTaskDraftFromRecipe({
          recipe: effectiveRecipe,
          moduleUid: selectedModuleUid,
        })
      : null;
  const uncoveredRequirementClauses = effectiveRecipe?.requirementCoverage.uncoveredClauses || [];
  const coverageBlockedReason =
    effectiveRecipe && effectiveRecipe.matchedCapabilities.length === 0
      ? '请至少选择一个能力后再生成测试计划。'
      : uncoveredRequirementClauses.length > 0
        ? `当前能力库还不能完整覆盖该需求，未命中的需求片段：${uncoveredRequirementClauses.join('；')}。请先补充稳定能力后再回填任务。`
        : '';
  const coveredRequirementCount = effectiveRecipe?.requirementCoverage.clauses.filter((item) => item.covered).length || 0;
  const totalRequirementCount = effectiveRecipe?.requirementCoverage.clauses.length || 0;
  const matchedCapabilityCount = effectiveRecipe?.matchedCapabilities.length || 0;
  const availableRecipeCapabilityCount = baseRecipe?.matchedCapabilities.length || 0;
  const normalizedRecipeWorkbenchSlug = normalizeIntentProjectRecipeWorkbenchSlug(recipeWorkbenchForm.slug);
  const existingProjectRecipe = normalizedRecipeWorkbenchSlug
    ? projectRecipeProfileBySlug.get(normalizedRecipeWorkbenchSlug) || null
    : null;
  const recipeWorkbenchPayloadPreview = effectiveRecipe
    ? buildIntentProjectRecipeFromWorkbench({
        form: recipeWorkbenchForm,
        requirement: requirement.trim(),
        recipe: effectiveRecipe,
      })
    : null;
  const projectRecipeMutationBusy =
    projectRecipeSaving || Boolean(projectRecipeRestoringPath) || Boolean(projectRecipeGovernanceApplyingSlug);
  const canPersistProjectRecipe =
    canEditContent &&
    Boolean(effectiveRecipe) &&
    !coverageBlockedReason &&
    Boolean(scopedProjectRecipeProfile) &&
    !projectRecipeAssetsLoading &&
    !projectRecipeMutationBusy;

  useEffect(() => {
    if (!baseRecipe) {
      setSelectedRecipeCapabilitySlugs([]);
      return;
    }

    setSelectedRecipeCapabilitySlugs(baseRecipe.matchedCapabilities.map((item) => item.slug));
  }, [baseRecipe]);

  useEffect(() => {
    setRecipeWorkbenchForm(
      buildIntentProjectRecipeWorkbenchFormDefaults({
        requirement,
        recipe: baseRecipe,
      })
    );
  }, [baseRecipe, requirement]);

  function collectRecipeCapabilityDependencySlugs(slug: string, seen = new Set<string>()): Set<string> {
    if (!baseRecipe || seen.has(slug)) return seen;
    seen.add(slug);
    const capability = baseRecipe.matchedCapabilities.find((item) => item.slug === slug);
    if (!capability) return seen;
    for (const dependencySlug of capability.dependsOn) {
      if (!baseRecipe.matchedCapabilities.some((item) => item.slug === dependencySlug)) continue;
      collectRecipeCapabilityDependencySlugs(dependencySlug, seen);
    }
    return seen;
  }

  function collectRecipeCapabilityDependentSlugs(slug: string, selectedSet: Set<string>, seen = new Set<string>()): Set<string> {
    if (seen.has(slug)) return seen;
    seen.add(slug);
    const dependents = recipeCapabilityDependents.get(slug) || [];
    for (const dependentSlug of dependents) {
      if (!selectedSet.has(dependentSlug)) continue;
      collectRecipeCapabilityDependentSlugs(dependentSlug, selectedSet, seen);
    }
    return seen;
  }

  function resetRecipeCapabilitySelection() {
    if (!baseRecipe) return;
    setSelectedRecipeCapabilitySlugs(baseRecipe.matchedCapabilities.map((item) => item.slug));
  }

  function toggleRecipeCapabilitySelection(slug: string) {
    if (!baseRecipe) return;

    setSelectedRecipeCapabilitySlugs((current) => {
      const currentSet = new Set(current);
      if (currentSet.has(slug)) {
        const toRemove = collectRecipeCapabilityDependentSlugs(slug, currentSet);
        for (const item of toRemove) currentSet.delete(item);
      } else {
        const toAdd = collectRecipeCapabilityDependencySlugs(slug);
        for (const item of toAdd) currentSet.add(item);
      }

      return baseRecipe.matchedCapabilities.map((item) => item.slug).filter((item) => currentSet.has(item));
    });
  }

  useEffect(() => {
    if (!selectedModuleUid) {
      setSelectedModuleUid(defaultTaskModuleUid);
      return;
    }
    if (activeModules.length > 0 && !activeModules.some((item) => item.moduleUid === selectedModuleUid)) {
      setSelectedModuleUid(defaultTaskModuleUid || activeModules[0]?.moduleUid || '');
    }
  }, [activeModules, defaultTaskModuleUid, selectedModuleUid]);

  useEffect(() => {
    if (!capabilityHelperFilter) return;
    if (capabilityStarterHelperOptions.includes(capabilityHelperFilter)) return;
    setCapabilityHelperFilter('');
  }, [capabilityHelperFilter, capabilityStarterHelperOptions]);

  useEffect(() => {
    setCapabilityStarterHelperHealthSnapshot(null);
    setCapabilityStarterHelperHealthError('');
    setCapabilityStarterHelperHealthLoadedProjectUid('');
    setCapabilityVerificationQueue(null);
    setCapabilityVerificationQueueError('');
    setCapabilityVerificationQueueLoadedProjectUid('');
    setCapabilityVerificationQueueFocus('auto');
    setProjectRecipeProfile(null);
    setProjectRecipeBackups(null);
    setProjectRecipeAudits(null);
    setProjectRecipeGovernance(null);
    setProjectRecipeAssetsError('');
    setProjectRecipeAssetsLoadedProjectUid('');
    setProjectRecipeSaving(false);
    setProjectRecipeRestoringPath('');
    setProjectRecipeGovernanceApplyingSlug('');
    setExpandedProjectRecipeAuditIds([]);
    setRecipeResponse(null);
    setSelectedRecipeCapabilitySlugs([]);
    setRecipeWorkbenchForm(createDefaultRecipeWorkbenchForm());
  }, [projectUid]);

  useEffect(() => {
    setSelectedCapabilityUids((current) => {
      const next = current.filter((item) => visibleSelectableCapabilityUidSet.has(item));
      return next.length === current.length ? current : next;
    });
  }, [visibleSelectableCapabilityUidSet]);

  useEffect(() => {
    if (!open) return;
    void loadContext();
  }, [open, projectUid]);

  useEffect(() => {
    if (!open || view !== 'capability') return;
    if (capabilityStarterHelperHealthLoadedProjectUid === projectUid && !capabilityStarterHelperHealthLoading) return;
    void loadCapabilityStarterHelperHealthSnapshot();
  }, [
    capabilityStarterHelperHealthLoadedProjectUid,
    capabilityStarterHelperHealthLoading,
    open,
    projectUid,
    view,
  ]);

  useEffect(() => {
    if (!open || view !== 'capability') return;
    if (capabilityVerificationQueueLoadedProjectUid === projectUid && !capabilityVerificationQueueLoading) return;
    void loadCapabilityVerificationQueue();
  }, [
    capabilityVerificationQueue,
    capabilityVerificationQueueLoadedProjectUid,
    capabilityVerificationQueueLoading,
    open,
    projectUid,
    view,
  ]);

  useEffect(() => {
    if (!open || view !== 'recipe') return;
    if (projectRecipeAssetsLoadedProjectUid === projectUid && !projectRecipeAssetsLoading) return;
    void loadProjectRecipeAssets();
  }, [open, projectRecipeAssetsLoadedProjectUid, projectRecipeAssetsLoading, projectUid, view]);

  useEffect(() => {
    if (!open || activeCapabilityVerificationBatchCount === 0) return;

    void refreshCapabilityVerificationBatches();
    const timer = window.setInterval(() => {
      void refreshCapabilityVerificationBatches();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [activeCapabilityVerificationBatchCount, activeCapabilityVerificationBatchSignature, open, projectUid]);

  useEffect(() => {
    if (!launchPreset?.token || appliedLaunchToken === launchPreset.token) return;

    setAppliedLaunchToken(launchPreset.token);
    const nextForm = capabilityPresetToFormState(launchPreset.capabilityPreset);
    setEditingCapabilityUid('');
    setCapabilityForm(nextForm);
    setCapabilitySections(createCapabilityEditorSectionState(nextForm));
    setCapabilitySearch('');
    setDocumentPreviewSearch('');
    setView(launchPreset.view);
    setCapabilityModalOpen(true);
    setError('');
    setNotice(`已根据${launchPreset.capabilityPreset.sourceLabel}预填能力草稿`);
    setOpen(true);
    onLaunchPresetConsumed?.(launchPreset.token);
  }, [appliedLaunchToken, launchPreset, onLaunchPresetConsumed]);

  useEffect(() => {
    if (!externalOpenKey || externalOpenKey === appliedExternalOpenKey) return;
    setAppliedExternalOpenKey(externalOpenKey);
    setView(externalOpenView);
    openWorkbench();
  }, [appliedExternalOpenKey, externalOpenKey, externalOpenView]);

  function showError(message: string) {
    setNotice('');
    setError(message);
  }

  function showNotice(message: string) {
    setError('');
    setNotice(message);
  }

  function openWorkbench() {
    setError('');
    setNotice('');
    setCapabilitySearch('');
    setDocumentPreviewSearch('');
    setCapabilityModalOpen(false);
    setOpen(true);
  }

  function closeWorkbench() {
    setOpen(false);
    setError('');
    setNotice('');
    setCapabilitySearch('');
    setDocumentPreviewSearch('');
    setSelectedCapabilityUids([]);
    setCapabilityModalOpen(false);
  }

  function toggleCapabilitySelection(capabilityUid: string) {
    setSelectedCapabilityUids((current) => {
      const currentSet = new Set(current);
      if (currentSet.has(capabilityUid)) {
        currentSet.delete(capabilityUid);
      } else {
        currentSet.add(capabilityUid);
      }
      return visibleSelectableCapabilityUids.filter((item) => currentSet.has(item));
    });
  }

  function selectAllVisibleCapabilities() {
    setSelectedCapabilityUids(visibleSelectableCapabilityUids);
  }

  function clearSelectedCapabilities() {
    setSelectedCapabilityUids([]);
  }

  function selectCapabilityVerificationRecommendations() {
    if (focusedCapabilityVerificationQueueItems.length === 0) {
      showError('当前没有可选中的推荐验证队列');
      return;
    }

    const nextSelected = visibleCapabilityVerificationRecommendationItems.map((item) => item.capabilityUid);
    const hiddenCount = focusedCapabilityVerificationQueueItems.length - nextSelected.length;
    if (nextSelected.length === 0) {
      showError('当前筛选没有展示推荐队列里的能力，请先清空筛选或切换筛选条件');
      return;
    }

    setSelectedCapabilityUids(nextSelected);
    showNotice(
      hiddenCount > 0
        ? `已选中当前队列视图下的 ${nextSelected.length} 条推荐能力，另有 ${hiddenCount} 条因目录筛选未显示`
        : `已选中当前队列视图中的 ${nextSelected.length} 条能力`
    );
  }

  function selectHighFailureCapabilityVerificationRecommendations() {
    const nextSelected = visibleCapabilityVerificationRecommendationItems
      .filter((item) => item.highFailurePressure)
      .map((item) => item.capabilityUid);
    const hiddenCount = highFailureCapabilityVerificationQueueItems.length - nextSelected.length;

    if (highFailureCapabilityVerificationQueueItems.length === 0) {
      showError('当前推荐队列里没有高频失败对象');
      return;
    }
    if (nextSelected.length === 0) {
      showError('当前筛选没有展示高频失败对象，请先清空筛选或切换筛选条件');
      return;
    }

    setSelectedCapabilityUids(nextSelected);
    showNotice(
      hiddenCount > 0
        ? `已选中当前筛选下的 ${nextSelected.length} 条高频失败对象，另有 ${hiddenCount} 条因筛选未显示`
        : `已选中 ${nextSelected.length} 条高频失败对象`
    );
  }

  function focusCapabilityStarterHelper(helper: string) {
    if (!helper.trim()) return;
    setCapabilityHelperFilter(helper);
    showNotice(`已切换到 Starter Helper「${helper}」筛选`);
  }

  function applyDocumentCollection(nextDocuments: KnowledgeDocumentItem[]) {
    setDocuments(nextDocuments);

    if (selectedDocumentUid && !nextDocuments.some((item) => item.documentUid === selectedDocumentUid)) {
      setSelectedDocumentUid('');
      setDocumentPreviewChunks([]);
      setDocumentPreviewSearch('');
    }
  }

  function applyCapabilityCollection(nextCapabilities: CapabilityItem[]) {
    setCapabilities(nextCapabilities);

    if (editingCapabilityUid && !nextCapabilities.some((item) => item.capabilityUid === editingCapabilityUid)) {
      setEditingCapabilityUid('');
      setCapabilityModalOpen(false);
    }
  }

  async function fetchProjectKnowledgeDocuments(): Promise<KnowledgeDocumentItem[]> {
    const res = await fetch(`/api/projects/${projectUid}/knowledge?status=all`);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || '加载项目知识失败');
    }
    return (json.documents || []) as KnowledgeDocumentItem[];
  }

  async function fetchProjectCapabilities(): Promise<CapabilityItem[]> {
    const res = await fetch(`/api/projects/${projectUid}/capabilities?status=all`);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || '加载项目能力失败');
    }
    return (json.items || []) as CapabilityItem[];
  }

  async function fetchProjectRecipeProfile(): Promise<ProjectRecipeProfileResponse> {
    const res = await fetch(`/api/projects/${projectUid}/intent-recipes`, {
      cache: 'no-store',
    });
    const json = (await res.json()) as ProjectRecipeProfileResponse & { error?: string };
    if (!res.ok) {
      throw new Error(json.error || '加载项目 recipe profile 失败');
    }
    return {
      registryPath: json.registryPath || '',
      profile: {
        version: 1,
        recipes: Array.isArray(json.profile?.recipes) ? json.profile.recipes : [],
      },
    };
  }

  async function fetchProjectRecipeBackups(): Promise<ProjectRecipeBackupsResponse> {
    const res = await fetch(`/api/projects/${projectUid}/intent-recipes/backups?limit=6`, {
      cache: 'no-store',
    });
    const json = (await res.json()) as ProjectRecipeBackupsResponse & { error?: string };
    if (!res.ok) {
      throw new Error(json.error || '加载项目 recipe 备份失败');
    }
    return {
      registryPath: json.registryPath || '',
      backupDir: json.backupDir || '',
      backups: Array.isArray(json.backups) ? json.backups : [],
    };
  }

  async function fetchProjectRecipeAudits(): Promise<ProjectRecipeAuditsResponse> {
    const res = await fetch(`/api/projects/${projectUid}/intent-recipes/audits?limit=6`, {
      cache: 'no-store',
    });
    const json = (await res.json()) as ProjectRecipeAuditsResponse & { error?: string };
    if (!res.ok) {
      throw new Error(json.error || '加载项目 recipe 审计失败');
    }
    return {
      auditLogPath: json.auditLogPath || '',
      items: Array.isArray(json.items) ? json.items : [],
    };
  }

  async function fetchProjectRecipeGovernance(): Promise<ProjectRecipeGovernanceResponse> {
    const res = await fetch(`/api/projects/${projectUid}/intent-recipes/governance?limit=4&runLimit=50`, {
      cache: 'no-store',
    });
    const json = (await res.json()) as ProjectRecipeGovernanceResponse & { error?: string };
    if (!res.ok) {
      throw new Error(json.error || '加载项目 recipe 治理建议失败');
    }
    return {
      summary: {
        totalProjectRecipes: Number(json.summary?.totalProjectRecipes) || 0,
        actionableCount: Number(json.summary?.actionableCount) || 0,
        promoteCount: Number(json.summary?.promoteCount) || 0,
        degradeCount: Number(json.summary?.degradeCount) || 0,
        observeCount: Number(json.summary?.observeCount) || 0,
        syncedCount: Number(json.summary?.syncedCount) || 0,
        runLimit: Number(json.summary?.runLimit) || 50,
        latestRepairObservationAt: json.summary?.latestRepairObservationAt || '',
        latestRepairObservationRecipeSlug: json.summary?.latestRepairObservationRecipeSlug || '',
        latestRepairObservationRecipeTitle: json.summary?.latestRepairObservationRecipeTitle || '',
        latestRepairObservationSummary: json.summary?.latestRepairObservationSummary || '',
      },
      items: Array.isArray(json.items) ? json.items : [],
    };
  }

  async function fetchCapabilityStarterHelperHealthSnapshot(options?: { force?: boolean }): Promise<CapabilityStarterHelperHealthSnapshotResponse> {
    const search = new URLSearchParams({
      runLimit: '50',
      auditLimit: '12',
      queueLimit: '8',
    });
    if (options?.force) {
      search.set('refresh', '1');
    }
    const res = await fetch(`/api/projects/${projectUid}/capabilities/helper-health?${search.toString()}`, {
      cache: 'no-store',
    });
    const json = (await res.json()) as CapabilityStarterHelperHealthSnapshotResponse & { error?: string };
    if (!res.ok) {
      throw new Error(json.error || '加载 Starter Helper 健康视图失败');
    }
    return {
      snapshot: json.snapshot,
      auditLogPath: json.auditLogPath || '',
      fresh: Boolean(json.fresh),
      staleFallback: Boolean(json.staleFallback),
      refreshError: typeof json.refreshError === 'string' ? json.refreshError : '',
    };
  }

  async function fetchCapabilityVerificationQueue(): Promise<CapabilityVerificationRecommendationResponse> {
    const search = new URLSearchParams({
      limit: '8',
      runLimit: '50',
      auditLimit: '12',
    });
    const res = await fetch(`/api/projects/${projectUid}/capabilities/verification-queue?${search.toString()}`, {
      cache: 'no-store',
    });
    const json = (await res.json()) as CapabilityVerificationRecommendationResponse & { error?: string };
    if (!res.ok) {
      throw new Error(json.error || '加载能力验证推荐队列失败');
    }
    return {
      summary: json.summary || {
        totalActiveCapabilities: 0,
        candidateCount: 0,
        returnedCount: 0,
        repairCount: 0,
        suppressedReviewCount: 0,
        starterVerificationCount: 0,
        knowledgeVerificationCount: 0,
        unknownVerificationCount: 0,
        failurePressureSummary: {
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
        },
        highFailureCandidateCount: 0,
        highFailureRepairCount: 0,
        highFailureGovernanceCount: 0,
      },
      items: json.items || [],
    };
  }

  function registerCapabilityVerificationBatch(input: {
    batchUid?: string;
    title: string;
    mode: CapabilityVerificationMode;
    verificationIntent?: CapabilityVerificationIntent;
    moduleName: string;
    items: Array<{
      capabilityUid: string;
      capabilityName: string;
      executionUid: string;
      runPath: string;
      workspacePath: string;
      workspaceHistoryPath: string;
      mode: CapabilityVerificationMode;
      verificationIntent?: CapabilityVerificationIntent;
      latestRepairObservationAt?: string;
      latestRepairObservationSummary?: string;
      latestRepairObservationVerifierCheckUids?: string[];
    }>;
  }) {
    if (input.items.length === 0) return;

    const startedAt = new Date().toISOString();
    const batchVerificationIntent =
      input.mode === 'verify'
        ? normalizeCapabilityVerificationIntent(input.verificationIntent || input.items[0]?.verificationIntent || 'verify')
        : undefined;
    const batch: CapabilityVerificationBatch = {
      batchUid: input.batchUid || createCapabilityVerificationBatchUid(),
      title: input.title,
      mode: input.mode,
      verificationIntent: batchVerificationIntent,
      moduleName: input.moduleName,
      startedAt,
      lastCheckedAt: '',
      completedAt: '',
      refreshError: '',
      items: input.items.map((item) => ({
        capabilityUid: item.capabilityUid,
        capabilityName: item.capabilityName,
        executionUid: item.executionUid,
        runPath: item.runPath,
        workspacePath: item.workspacePath,
        workspaceHistoryPath: item.workspaceHistoryPath,
        mode: item.mode,
        verificationIntent:
          item.mode === 'verify'
            ? normalizeCapabilityVerificationIntent(item.verificationIntent || batchVerificationIntent || 'verify')
            : undefined,
        status: 'queued',
        synced: false,
        resultSummary: '',
        errorMessage: '',
        latestRepairObservationAt: item.latestRepairObservationAt || '',
        latestRepairObservationSummary: item.latestRepairObservationSummary || '',
        latestRepairObservationVerifierCheckUids: item.latestRepairObservationVerifierCheckUids || [],
      })),
    };

    setCapabilityVerificationBatches((current) => [batch, ...current].slice(0, 6));
  }

  function openCapabilityVerificationRun(
    item: Pick<
      CapabilityVerificationMonitorItem,
      | 'capabilityUid'
      | 'executionUid'
      | 'runPath'
      | 'workspacePath'
      | 'workspaceHistoryPath'
      | 'verificationIntent'
      | 'latestRepairObservationAt'
      | 'latestRepairObservationSummary'
      | 'latestRepairObservationVerifierCheckUids'
    >
  ) {
    if (typeof window === 'undefined') return;
    const navigation = readExecutionEntryNavigationTargets(item);
    if (!navigation.runPath) return;

    stashCapabilityVerificationExecutionObservation(item.executionUid, {
      capabilityUid: item.capabilityUid,
      verificationIntent: item.verificationIntent,
      latestRepairObservationAt: item.latestRepairObservationAt,
      latestRepairObservationSummary: item.latestRepairObservationSummary,
      latestRepairObservationVerifierCheckUids: item.latestRepairObservationVerifierCheckUids,
    });
    window.open(navigation.runPath, '_blank', 'noopener,noreferrer');
  }

  function openCapabilityVerificationWorkspace(
    item: Pick<CapabilityVerificationMonitorItem, 'executionUid' | 'runPath' | 'workspacePath' | 'workspaceHistoryPath'>,
    target: 'workspace' | 'workspaceHistory'
  ) {
    if (typeof window === 'undefined') return;
    const navigation = readExecutionEntryNavigationTargets(item);
    const path =
      target === 'workspaceHistory'
        ? navigation.hasWorkspaceHistoryPath
          ? navigation.workspaceHistoryPath
          : ''
        : navigation.workspacePath;
    if (!path) return;
    window.open(path, '_blank', 'noopener,noreferrer');
  }

  function dismissCapabilityVerificationBatch(batchUid: string) {
    setCapabilityVerificationBatches((current) => current.filter((item) => item.batchUid !== batchUid));
  }

  function clearCompletedCapabilityVerificationBatches() {
    setCapabilityVerificationBatches((current) => current.filter((item) => !item.completedAt));
  }

  async function loadContext() {
    setLoadingContext(true);
    setError('');
    try {
      const [nextDocuments, nextCapabilities] = await Promise.all([
        fetchProjectKnowledgeDocuments(),
        fetchProjectCapabilities(),
      ]);
      applyDocumentCollection(nextDocuments);
      applyCapabilityCollection(nextCapabilities);
      if (open && view === 'capability') {
        void loadCapabilityVerificationQueue({ force: true });
      }
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '加载需求编排上下文失败');
    } finally {
      setLoadingContext(false);
    }
  }

  async function loadCapabilityStarterHelperHealthSnapshot(options?: { force?: boolean }) {
    if (!projectUid) {
      setCapabilityStarterHelperHealthSnapshot(null);
      setCapabilityStarterHelperHealthError('');
      setCapabilityStarterHelperHealthLoadedProjectUid('');
      return;
    }
    if (!options?.force && capabilityStarterHelperHealthLoadedProjectUid === projectUid && capabilityStarterHelperHealthSnapshot) {
      return;
    }

    setCapabilityStarterHelperHealthLoading(true);
    setCapabilityStarterHelperHealthError('');
    try {
      const snapshot = await fetchCapabilityStarterHelperHealthSnapshot(options);
      setCapabilityStarterHelperHealthSnapshot(snapshot);
      setCapabilityStarterHelperHealthLoadedProjectUid(projectUid);
    } catch (err: unknown) {
      setCapabilityStarterHelperHealthSnapshot(null);
      setCapabilityStarterHelperHealthLoadedProjectUid(projectUid);
      setCapabilityStarterHelperHealthError(err instanceof Error ? err.message : '加载 Starter Helper 健康视图失败');
    } finally {
      setCapabilityStarterHelperHealthLoading(false);
    }
  }

  async function loadCapabilityVerificationQueue(options?: { force?: boolean }) {
    if (!projectUid) {
      setCapabilityVerificationQueue(null);
      setCapabilityVerificationQueueError('');
      setCapabilityVerificationQueueLoadedProjectUid('');
      return;
    }
    if (!options?.force && capabilityVerificationQueueLoadedProjectUid === projectUid && capabilityVerificationQueue) {
      return;
    }

    setCapabilityVerificationQueueLoading(true);
    setCapabilityVerificationQueueError('');
    try {
      const queue = await fetchCapabilityVerificationQueue();
      setCapabilityVerificationQueue(queue);
      setCapabilityVerificationQueueLoadedProjectUid(projectUid);
    } catch (err: unknown) {
      setCapabilityVerificationQueue(null);
      setCapabilityVerificationQueueLoadedProjectUid(projectUid);
      setCapabilityVerificationQueueError(err instanceof Error ? err.message : '加载能力验证推荐队列失败');
    } finally {
      setCapabilityVerificationQueueLoading(false);
    }
  }

  async function loadProjectRecipeAssets(options?: { force?: boolean }) {
    if (!projectUid) {
      setProjectRecipeProfile(null);
      setProjectRecipeBackups(null);
      setProjectRecipeAudits(null);
      setProjectRecipeGovernance(null);
      setProjectRecipeAssetsError('');
      setProjectRecipeAssetsLoadedProjectUid('');
      return;
    }
    if (
      !options?.force &&
      projectRecipeAssetsLoadedProjectUid === projectUid &&
      projectRecipeProfile &&
      projectRecipeBackups &&
      projectRecipeAudits &&
      projectRecipeGovernance
    ) {
      return;
    }

    setProjectRecipeAssetsLoading(true);
    setProjectRecipeAssetsError('');
    try {
      const [nextProfile, nextBackups, nextAudits, nextGovernance] = await Promise.all([
        fetchProjectRecipeProfile(),
        fetchProjectRecipeBackups(),
        fetchProjectRecipeAudits(),
        fetchProjectRecipeGovernance(),
      ]);
      setProjectRecipeProfile(nextProfile);
      setProjectRecipeBackups(nextBackups);
      setProjectRecipeAudits(nextAudits);
      setProjectRecipeGovernance(nextGovernance);
      setProjectRecipeAssetsLoadedProjectUid(projectUid);
    } catch (err: unknown) {
      if (projectRecipeAssetsLoadedProjectUid !== projectUid) {
        setProjectRecipeProfile(null);
        setProjectRecipeBackups(null);
        setProjectRecipeAudits(null);
        setProjectRecipeGovernance(null);
      }
      setProjectRecipeAssetsLoadedProjectUid(projectUid);
      setProjectRecipeAssetsError(err instanceof Error ? err.message : '加载项目 recipe 资产失败');
    } finally {
      setProjectRecipeAssetsLoading(false);
    }
  }

  async function refreshCapabilityVerificationBatches() {
    const activeBatches = capabilityVerificationBatches.filter((item) => !item.completedAt);
    if (activeBatches.length === 0) return;

    try {
      const nextCapabilities = await fetchProjectCapabilities();
      applyCapabilityCollection(nextCapabilities);
      const capabilityIndex = new Map(nextCapabilities.map((item) => [item.capabilityUid, item]));
      const executionUids = Array.from(
        new Set(activeBatches.flatMap((batch) => batch.items.map((item) => item.executionUid)).filter(Boolean))
      );
      const executionDetails = await Promise.all(
        executionUids.map(async (executionUid) => {
          const res = await fetch(`/api/test-executions/${executionUid}`);
          const json = (await res.json()) as CapabilityExecutionDetailResponse | { error?: string };
          if (!res.ok) {
            throw new Error((json as { error?: string }).error || `加载执行 ${executionUid} 失败`);
          }
          return [executionUid, json as CapabilityExecutionDetailResponse] as const;
        })
      );
      const executionDetailByUid = new Map(executionDetails);
      const checkedAt = new Date().toISOString();

      setCapabilityVerificationBatches((current) =>
        current.map((batch) => {
          if (batch.completedAt) return batch;

          let allSynced = true;
          const nextItems = batch.items.map((item) => {
            const detail = executionDetailByUid.get(item.executionUid);
            const capability = capabilityIndex.get(item.capabilityUid);
            const status = normalizeCapabilityExecutionStatus(detail?.execution?.status || item.status);
            const rawVerificationIntent =
              detail?.capabilityVerification?.intent ||
              item.verificationIntent ||
              batch.verificationIntent ||
              (item.mode === 'verify' ? 'verify' : '');
            const verificationIntent =
              rawVerificationIntent === 'review' || rawVerificationIntent === 'verify'
                ? normalizeCapabilityVerificationIntent(rawVerificationIntent)
                : undefined;
            const synced = isCapabilityVerificationSynced({
              capability,
              batchStartedAt: batch.startedAt,
              executionUid: item.executionUid,
              executionStatus: status,
            });
            if (!synced || !isTerminalExecutionStatus(status)) {
              allSynced = false;
            }

            return {
              ...item,
              status,
              verificationIntent,
              synced,
              resultSummary: detail?.execution?.resultSummary || item.resultSummary,
              errorMessage: detail?.execution?.errorMessage || item.errorMessage,
            };
          });

          const verificationIntent =
            batch.mode === 'verify'
              ? normalizeCapabilityVerificationIntent(
                  nextItems.find((item) => item.verificationIntent === 'review')?.verificationIntent ||
                    batch.verificationIntent ||
                    'verify'
                )
              : undefined;

          return {
            ...batch,
            verificationIntent,
            items: nextItems,
            lastCheckedAt: checkedAt,
            completedAt: allSynced ? checkedAt : '',
            refreshError: '',
          };
        })
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '刷新能力验证批次失败';
      setCapabilityVerificationBatches((current) =>
        current.map((item) => (item.completedAt ? item : { ...item, refreshError: message }))
      );
    }
  }

  async function loadDocumentPreview(documentUid: string) {
    if (!documentUid) {
      setSelectedDocumentUid('');
      setDocumentPreviewChunks([]);
      setDocumentPreviewSearch('');
      return;
    }

    setSelectedDocumentUid(documentUid);
    setDocumentPreviewSearch('');
    setLoadingDocumentPreview(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        documentUid,
        includeChunks: 'true',
        status: 'all',
        limit: '120',
      });
      const res = await fetch(`/api/projects/${projectUid}/knowledge?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '加载知识文档预览失败');
      }
      setDocumentPreviewChunks((json.chunks || []) as KnowledgeChunkItem[]);
      setView('knowledge');
    } catch (err: unknown) {
      setDocumentPreviewChunks([]);
      showError(err instanceof Error ? err.message : '加载知识文档预览失败');
    } finally {
      setLoadingDocumentPreview(false);
    }
  }

  async function submitRequirement() {
    if (!requirement.trim()) {
      showError('请先输入测试需求描述');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/draft-recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement: requirement.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '生成需求编排草案失败');
      }
      const payload = json as DraftRecipeResponse;
      setRecipeResponse(payload);
      setSelectedRecipeCapabilitySlugs(payload.recipe?.matchedCapabilities.map((item) => item.slug) || []);
      setNotice('');
    } catch (err: unknown) {
      setRecipeResponse(null);
      setSelectedRecipeCapabilitySlugs([]);
      showError(err instanceof Error ? err.message : '生成需求编排草案失败');
    } finally {
      setSubmitting(false);
    }
  }

  function resetRecipeWorkbenchFormFromCurrentRecipe() {
    setRecipeWorkbenchForm(
      buildIntentProjectRecipeWorkbenchFormDefaults({
        requirement,
        recipe: effectiveRecipe || baseRecipe,
      })
    );
  }

  async function saveProjectRecipeAsset() {
    if (!canEditContent) {
      showError('当前操作者没有权限沉淀项目 recipe');
      return;
    }
    if (!effectiveRecipe) {
      showError('请先生成可落盘的 recipe');
      return;
    }
    if (coverageBlockedReason) {
      showError(coverageBlockedReason);
      return;
    }
    if (!scopedProjectRecipeProfile || projectRecipeAssetsLoading) {
      showError('项目 recipe 资产尚未加载完成，请稍后再试');
      return;
    }

    const nextRecipe = buildIntentProjectRecipeFromWorkbench({
      form: recipeWorkbenchForm,
      requirement: requirement.trim(),
      recipe: effectiveRecipe,
    });
    const existingRecipe = projectRecipeProfileBySlug.get(nextRecipe.slug) || null;
    const payload = existingRecipe
      ? {
          mode: 'update' as const,
          recipe: buildIntentProjectRecipePatchFromWorkbench({
            form: recipeWorkbenchForm,
            requirement: requirement.trim(),
            recipe: effectiveRecipe,
          }),
        }
      : {
          mode: 'register' as const,
          recipes: [nextRecipe],
        };

    setProjectRecipeSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/intent-recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ProjectRecipeMutationResponse;
      if (!res.ok) {
        throw new Error(json.error || '保存项目 recipe 失败');
      }

      setRecipeWorkbenchForm({
        slug: nextRecipe.slug,
        title: nextRecipe.title,
        description: nextRecipe.description,
      });
      await loadProjectRecipeAssets({ force: true });

      const addedCount = json.result.addedRecipeSlugs?.length || 0;
      const updatedCount = json.result.updatedRecipeSlugs?.length || 0;
      const skippedCount = json.result.skippedRecipeSlugs?.length || 0;
      const actionLabel = existingRecipe ? '更新' : '注册';
      const summary =
        addedCount > 0 || updatedCount > 0
          ? `${actionLabel}完成：${nextRecipe.slug}`
          : skippedCount > 0
            ? `未检测到新变更：${nextRecipe.slug}`
            : `${actionLabel}完成：${nextRecipe.slug}`;

      showNotice(json.auditWarning ? `${summary}；审计告警：${json.auditWarning}` : summary);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '保存项目 recipe 失败');
    } finally {
      setProjectRecipeSaving(false);
    }
  }

  async function restoreProjectRecipeBackup(item: ProjectRecipeBackupItem) {
    if (!canEditContent) {
      showError('当前操作者没有权限恢复项目 recipe 备份');
      return;
    }
    if (!item.path.trim()) {
      showError('缺少可恢复的 backupPath');
      return;
    }
    if (!confirm(`确认恢复备份“${item.fileName}”？当前项目 recipe profile 会回滚到该快照。`)) {
      return;
    }

    setProjectRecipeRestoringPath(item.path);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/intent-recipes/backups/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backupPath: item.path,
        }),
      });
      const json = (await res.json()) as ProjectRecipeRestoreResponse;
      if (!res.ok) {
        throw new Error(json.error || '恢复项目 recipe 备份失败');
      }

      await loadProjectRecipeAssets({ force: true });
      const changedCount =
        (json.comparison.addedRecipeSlugs?.length || 0) +
        (json.comparison.updatedRecipeSlugs?.length || 0) +
        (json.comparison.removedRecipeSlugs?.length || 0);
      const summary =
        changedCount > 0
          ? `已恢复 recipe 备份：${item.fileName}`
          : `已恢复 recipe 备份：${item.fileName}（未检测到 profile 差异）`;
      showNotice(json.auditWarning ? `${summary}；审计告警：${json.auditWarning}` : summary);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '恢复项目 recipe 备份失败');
    } finally {
      setProjectRecipeRestoringPath('');
    }
  }

  async function applyProjectRecipeGovernanceDecision(item: ProjectRecipeGovernanceDecisionItem) {
    if (!canEditContent) {
      showError('当前操作者没有权限应用项目 recipe 治理建议');
      return;
    }
    if (!item.canApply || !item.recommendedPatch) {
      showError('当前治理建议还不能直接应用');
      return;
    }
    if (
      !confirm(
        `确认应用「${item.title}」的治理建议？当前会把成功率更新为 ${formatPercentLabel(item.recommendedPatch.successRate)}，并回填最近验证时间。`
      )
    ) {
      return;
    }

    setProjectRecipeGovernanceApplyingSlug(item.slug);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/intent-recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'update',
          recipe: item.recommendedPatch,
        }),
      });
      const json = (await res.json()) as ProjectRecipeMutationResponse;
      if (!res.ok) {
        throw new Error(json.error || '应用项目 recipe 治理建议失败');
      }

      await loadProjectRecipeAssets({ force: true });
      const summary = `已应用 recipe 治理建议：${item.slug}（${item.statusLabel}）`;
      showNotice(json.auditWarning ? `${summary}；审计告警：${json.auditWarning}` : summary);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '应用项目 recipe 治理建议失败');
    } finally {
      setProjectRecipeGovernanceApplyingSlug('');
    }
  }

  function toggleProjectRecipeAuditDrillDown(auditId: string) {
    setExpandedProjectRecipeAuditIds((current) =>
      current.includes(auditId) ? current.filter((item) => item !== auditId) : [...current, auditId]
    );
  }

  async function submitKnowledgeDocument() {
    if (!canEditContent) {
      showError('当前操作者没有权限导入项目知识');
      return;
    }
    if (!knowledgeForm.name.trim()) {
      showError('请填写知识文档名称');
      return;
    }
    if (!knowledgeForm.content.trim()) {
      showError('请填写知识文档内容');
      return;
    }

    setKnowledgeSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: knowledgeForm.name.trim(),
          sourceType: knowledgeForm.sourceType,
          sourcePath: knowledgeForm.sourcePath.trim(),
          content: knowledgeForm.content,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '导入项目知识失败');
      }

      await loadContext();
      if (json.document?.documentUid) {
        await loadDocumentPreview(String(json.document.documentUid));
        setCapabilityForm((current) => ({
          ...current,
          sourceDocumentUid: String(json.document.documentUid),
        }));
      }
      setKnowledgeForm(createDefaultKnowledgeForm());
      showNotice(`知识文档「${json.document?.name || knowledgeForm.name.trim()}」已导入`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '导入项目知识失败');
    } finally {
      setKnowledgeSaving(false);
    }
  }

  async function archiveKnowledgeDocument(item: KnowledgeDocumentItem) {
    if (!canEditContent) {
      showError('当前操作者没有权限导入项目知识');
      return;
    }
    if (item.status !== 'active') {
      showError('知识文档已经归档');
      return;
    }
    if (!confirm(`确认归档知识文档“${item.name}”？归档后它将不再参与 recipe 证据检索。`)) return;

    setDocumentActioningUid(item.documentUid);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/knowledge/${item.documentUid}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '归档项目知识失败');
      }
      await loadContext();
      showNotice(`知识文档「${item.name}」已归档`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '归档项目知识失败');
    } finally {
      setDocumentActioningUid('');
    }
  }

  async function restoreKnowledgeDocument(item: KnowledgeDocumentItem) {
    if (!canEditContent) {
      showError('当前操作者没有权限导入项目知识');
      return;
    }
    if (item.status !== 'archived') {
      showError('知识文档已经是启用状态');
      return;
    }

    setDocumentActioningUid(item.documentUid);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/knowledge/${item.documentUid}/restore`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '恢复项目知识失败');
      }
      await loadContext();
      showNotice(`知识文档「${item.name}」已恢复`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '恢复项目知识失败');
    } finally {
      setDocumentActioningUid('');
    }
  }

  function resetCapabilityForm() {
    setEditingCapabilityUid('');
    const nextForm = createDefaultCapabilityForm();
    setCapabilityForm(nextForm);
    setCapabilitySections(createCapabilityEditorSectionState(nextForm));
  }

  function openCreateCapabilityModal(sourceDocumentUid = '') {
    setEditingCapabilityUid('');
    const nextForm = {
      ...createDefaultCapabilityForm(),
      sourceDocumentUid,
    };
    setCapabilityForm(nextForm);
    setCapabilitySections(createCapabilityEditorSectionState(nextForm));
    setCapabilityModalOpen(true);
    setView('capability');
    setError('');
    setNotice('');
  }

  function closeCapabilityModal() {
    setCapabilityModalOpen(false);
  }

  function toggleCapabilitySection(section: CapabilityEditorSection) {
    setCapabilitySections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function editCapability(item: CapabilityItem) {
    if (item.status !== 'active') {
      showError('请先恢复能力，再编辑');
      return;
    }
    setEditingCapabilityUid(item.capabilityUid);
    const nextForm = capabilityToFormState(item);
    setCapabilityForm(nextForm);
    setCapabilitySections(createCapabilityEditorSectionState(nextForm));
    setCapabilityModalOpen(true);
    setView('capability');
    setError('');
    setNotice('');
  }

  async function requestCapabilityArchive(item: CapabilityItem) {
    const res = await fetch(`/api/projects/${projectUid}/capabilities/${item.capabilityUid}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || '归档项目能力失败');
    }
  }

  function resolveCapabilityVerificationModuleUid(): string {
    if (!effectiveVerificationModuleUid) {
      showError('当前项目没有可用模块，无法创建验证任务');
      return '';
    }
    return effectiveVerificationModuleUid;
  }

  async function requestCapabilityVerification(
    item: CapabilityItem,
    input: {
      moduleUid?: string;
      mode: CapabilityVerificationMode;
      verificationIntent?: CapabilityVerificationIntent;
      latestRepairObservationAt?: string;
      latestRepairObservationSummary?: string;
      latestRepairObservationVerifierCheckUids?: string[];
    }
  ): Promise<CapabilityVerificationLaunchResponse> {
    const res = await fetch(`/api/projects/${projectUid}/capabilities/${item.capabilityUid}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleUid: input.moduleUid || '',
        mode: input.mode,
        verificationIntent: input.verificationIntent,
        latestRepairObservationAt: input.latestRepairObservationAt || '',
        latestRepairObservationSummary: input.latestRepairObservationSummary || '',
        latestRepairObservationVerifierCheckUids: input.latestRepairObservationVerifierCheckUids || [],
      }),
    });
    const json = (await res.json()) as CapabilityVerificationLaunchResponse | { error?: string };
    if (!res.ok) {
      throw new Error((json as { error?: string }).error || '启动能力验证失败');
    }
    return json as CapabilityVerificationLaunchResponse;
  }

  async function requestPromotionGovernanceAudit(input: {
    actionKind: IntentPromotionGovernanceAuditActionKind;
    sourceView: IntentPromotionGovernanceAuditSourceView;
    batchUid: string;
    moduleUid?: string;
    moduleName?: string;
    items: Array<
      CapabilityPromotionGovernanceAuditLaunchItem & {
        configUid: string;
        planUid: string;
        executionUid: string;
        runPath: string;
      }
    >;
  }): Promise<void> {
    const res = await fetch(`/api/projects/${projectUid}/capabilities/promotion-governance-audits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionKind: input.actionKind,
        sourceView: input.sourceView,
        batchUid: input.batchUid,
        moduleUid: input.moduleUid || '',
        moduleName: input.moduleName || '',
        items: input.items,
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      throw new Error(json.error || '写入 promotion governance 审计失败');
    }
  }

  async function archiveCapability(item: CapabilityItem) {
    if (!canEditContent) {
      showError('当前操作者没有权限维护项目能力');
      return;
    }
    if (item.status !== 'active') {
      showError('能力已经归档');
      return;
    }
    if (!confirm(`确认归档能力“${item.name}”？归档后它将不再参与 recipe 编排。`)) return;

    setCapabilityActioningUid(item.capabilityUid);
    setError('');
    try {
      await requestCapabilityArchive(item);
      if (editingCapabilityUid === item.capabilityUid) {
        resetCapabilityForm();
        setCapabilityModalOpen(false);
      }
      await loadContext();
      showNotice(`能力「${item.name}」已归档`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '归档项目能力失败');
    } finally {
      setCapabilityActioningUid('');
    }
  }

  async function restoreCapability(item: CapabilityItem) {
    if (!canEditContent) {
      showError('当前操作者没有权限维护项目能力');
      return;
    }
    if (item.status !== 'archived') {
      showError('能力已经是启用状态');
      return;
    }

    setCapabilityActioningUid(item.capabilityUid);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/capabilities/${item.capabilityUid}/restore`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '恢复项目能力失败');
      }
      await loadContext();
      showNotice(`能力「${item.name}」已恢复`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '恢复项目能力失败');
    } finally {
      setCapabilityActioningUid('');
    }
  }

  async function submitCapability() {
    if (!canEditContent) {
      showError('当前操作者没有权限维护项目能力');
      return;
    }
    if (!capabilityForm.slug.trim() || !capabilityForm.name.trim() || !capabilityForm.description.trim()) {
      showError('请填写完整的 slug、名称和描述');
      return;
    }

    setCapabilitySaving(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/capabilities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: capabilityForm.slug.trim().toLowerCase(),
          name: capabilityForm.name.trim(),
          description: capabilityForm.description.trim(),
          capabilityType: capabilityForm.capabilityType,
          entryUrl: capabilityForm.entryUrl.trim(),
          triggerPhrases: parseMultilineValues(capabilityForm.triggerPhrases),
          preconditions: parseMultilineValues(capabilityForm.preconditions),
          steps: parseMultilineValues(capabilityForm.steps),
          assertions: parseMultilineValues(capabilityForm.assertions),
          cleanupNotes: capabilityForm.cleanupNotes.trim(),
          dependsOn: parseMultilineValues(capabilityForm.dependsOn),
          sortOrder: capabilityForm.sortOrder,
          sourceDocumentUid: capabilityForm.sourceDocumentUid || '',
          meta: normalizeCapabilityMetaForSave(capabilityForm.capabilityType, capabilityForm.meta),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '写入项目能力失败');
      }

      const saved = ((json.items || [])[0] || null) as CapabilityItem | null;
      await loadContext();
      if (saved) {
        setEditingCapabilityUid(saved.capabilityUid);
        setCapabilityForm(capabilityToFormState(saved));
      }
      setCapabilityModalOpen(false);
      showNotice(`能力「${saved?.name || capabilityForm.name.trim()}」已保存`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '写入项目能力失败');
    } finally {
      setCapabilitySaving(false);
    }
  }

  async function deriveCapabilitiesFromKnowledge(documentUid: string, chunkUid?: string) {
    if (!canEditContent) {
      showError('当前操作者没有权限维护项目能力');
      return;
    }
    if (!documentUid) {
      showError('请先选择知识文档');
      return;
    }

    const targetKey = chunkUid ? `${documentUid}:${chunkUid}` : documentUid;
    setDerivingKnowledgeTarget(targetKey);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/knowledge/${documentUid}/derive-capabilities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunkUid ? { chunkUid } : {}),
      });
      const json = (await res.json()) as DeriveCapabilityResponse | { error?: string };
      if (!res.ok) {
        throw new Error((json as { error?: string }).error || '自动沉淀稳定能力失败');
      }

      await loadContext();
      await loadDocumentPreview(documentUid);

      const payload = json as DeriveCapabilityResponse;
      const firstItem = payload.items?.[0];
      if (payload.items?.length === 1 && firstItem) {
        setEditingCapabilityUid(firstItem.capabilityUid);
        setCapabilityForm(capabilityToFormState(firstItem));
      }

      const summary = payload.summary;
      const detail = [
        summary.derivedCount > 0 ? `已沉淀 ${summary.derivedCount} 条能力` : '没有新增可沉淀能力',
        summary.executionVerifiedCount > 0 ? `${summary.executionVerifiedCount} 条执行验证` : '',
        summary.knowledgeInferredCount > 0 ? `${summary.knowledgeInferredCount} 条知识提炼` : '',
        summary.skippedCount > 0 ? `${summary.skippedCount} 条跳过` : '',
        summary.executionVerifiedCount === 0 && summary.knowledgeInferredCount > 0
          ? '当前为知识提炼，执行沉淀后会优先命中执行验证能力'
          : '',
      ]
        .filter(Boolean)
        .join('，');

      showNotice(detail || '自动沉淀已完成');
      setView(payload.items?.length > 0 ? 'capability' : 'knowledge');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '自动沉淀稳定能力失败');
    } finally {
      setDerivingKnowledgeTarget('');
    }
  }

  async function launchCapabilityVerification(item: CapabilityItem, mode: CapabilityVerificationMode) {
    if (!canEditContent) {
      showError('当前操作者没有权限维护项目能力');
      return;
    }
    if (item.status !== 'active') {
      showError('请先恢复能力，再发起验证');
      return;
    }

    const launchPolicy = resolveCapabilityVerificationLaunchPolicy(item.meta);
    if (mode === 'repair' && !launchPolicy.canRepair) {
      showError('该能力还没有可修复的失败验证记录，请先发起一次验证');
      return;
    }

    setVerifyingCapabilityUid(item.capabilityUid);
    setVerifyingCapabilityMode(mode);
    setError('');
    try {
      const moduleUid = mode === 'verify' ? resolveCapabilityVerificationModuleUid() : '';
      const verificationIntent =
        mode === 'verify'
          ? normalizeCapabilityVerificationIntent(launchPolicy.primaryMode)
          : resolveCapabilityLastVerificationIntent(item);
      const observation = resolveCapabilityVerificationBatchObservation(item.capabilityUid, verificationIntent);
      if (mode === 'verify' && !moduleUid) return;
      const payload = await requestCapabilityVerification(item, {
        moduleUid,
        mode,
        verificationIntent,
        latestRepairObservationAt: observation.latestRepairObservationAt,
        latestRepairObservationSummary: observation.latestRepairObservationSummary,
        latestRepairObservationVerifierCheckUids: observation.latestRepairObservationVerifierCheckUids,
      });
      const launchNavigation = readExecutionEntryNavigationTargets(payload);
      registerCapabilityVerificationBatch({
        title: mode === 'repair' ? `能力修复：${item.name}` : `能力验证：${item.name}`,
        mode,
        verificationIntent,
        moduleName: mode === 'verify' ? selectedModuleName : '最近失败执行',
        items: [
          {
            capabilityUid: item.capabilityUid,
            capabilityName: item.name,
            executionUid: payload.executionUid,
            runPath: launchNavigation.runPath,
            workspacePath: launchNavigation.workspacePath,
            workspaceHistoryPath: launchNavigation.workspaceHistoryPath,
            mode,
            verificationIntent,
            latestRepairObservationAt: observation.latestRepairObservationAt,
            latestRepairObservationSummary: observation.latestRepairObservationSummary,
            latestRepairObservationVerifierCheckUids: observation.latestRepairObservationVerifierCheckUids,
          },
        ],
      });
      showNotice(
        mode === 'repair'
          ? `已启动验证修复，AI 会基于上次失败执行重写并重跑脚本（运行 ${payload.executionUid}）`
          : `已启动能力验证，执行通过后会自动升级为执行验证（运行 ${payload.executionUid}）`
      );
      if (launchNavigation.runPath) {
        openCapabilityVerificationRun({
          capabilityUid: item.capabilityUid,
          executionUid: payload.executionUid,
          runPath: launchNavigation.runPath,
          workspacePath: launchNavigation.workspacePath,
          workspaceHistoryPath: launchNavigation.workspaceHistoryPath,
          verificationIntent,
          latestRepairObservationAt: observation.latestRepairObservationAt,
          latestRepairObservationSummary: observation.latestRepairObservationSummary,
          latestRepairObservationVerifierCheckUids: observation.latestRepairObservationVerifierCheckUids,
        });
      }
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '启动能力验证失败');
    } finally {
      setVerifyingCapabilityUid('');
      setVerifyingCapabilityMode('');
    }
  }

  async function verifyCapability(item: CapabilityItem) {
    await launchCapabilityVerification(item, 'verify');
  }

  async function repairCapability(item: CapabilityItem) {
    await launchCapabilityVerification(item, 'repair');
  }

  async function archiveSelectedCapabilities() {
    if (!canEditContent) {
      showError('当前操作者没有权限维护项目能力');
      return;
    }
    if (selectedCapabilityItems.length === 0) {
      showError('请先选择要归档的能力');
      return;
    }
    if (
      !confirm(
        `确认归档已选 ${selectedCapabilityItems.length} 条能力（${summarizeCapabilityItems(selectedCapabilityItems)}）？归档后它们将不再参与 recipe 编排。`
      )
    ) {
      return;
    }

    setBulkCapabilityAction('archive');
    setError('');
    try {
      const succeeded: CapabilityItem[] = [];
      const failed: Array<{ item: CapabilityItem; reason: string }> = [];

      for (const item of selectedCapabilityItems) {
        try {
          await requestCapabilityArchive(item);
          succeeded.push(item);
        } catch (err: unknown) {
          failed.push({
            item,
            reason: err instanceof Error ? err.message : '归档项目能力失败',
          });
        }
      }

      if (succeeded.some((item) => item.capabilityUid === editingCapabilityUid)) {
        resetCapabilityForm();
        setCapabilityModalOpen(false);
      }
      if (succeeded.length > 0) {
        await loadContext();
      }

      if (failed.length === 0) {
        showNotice(`已归档 ${succeeded.length} 条能力`);
        return;
      }

      const failureSummary = summarizeCapabilityFailures(failed);
      if (succeeded.length > 0) {
        showNotice(`已归档 ${succeeded.length} 条能力，${failed.length} 条失败：${failureSummary}`);
        return;
      }

      showError(`批量归档失败：${failureSummary}`);
    } finally {
      setBulkCapabilityAction('');
    }
  }

  async function launchCapabilityVerificationBatch(
    items: CapabilityItem[],
    mode: CapabilityVerificationMode,
    options?: {
      confirmMessage?: string;
      batchTitle?: string;
      clearSelection?: boolean;
      verificationIntent?: CapabilityVerificationIntent;
      governanceAudit?: {
        actionKind: IntentPromotionGovernanceAuditActionKind;
        sourceView: IntentPromotionGovernanceAuditSourceView;
        items: CapabilityPromotionGovernanceAuditLaunchItem[];
      };
    }
  ) {
    if (!canEditContent) {
      showError('当前操作者没有权限维护项目能力');
      return;
    }
    if (items.length === 0) {
      showError(mode === 'repair' ? '请先选择最近验证失败的能力' : '请先选择要验证的能力');
      return;
    }

    const moduleUid = mode === 'verify' ? resolveCapabilityVerificationModuleUid() : '';
    if (mode === 'verify' && !moduleUid) return;

    const confirmMessage =
      options?.confirmMessage ||
      mode === 'repair'
        ? `确认对已选 ${items.length} 条失败能力发起修复（${summarizeCapabilityItems(items)}）？系统会基于各自最近失败执行重跑脚本。`
        : `确认对已选 ${items.length} 条能力发起验证（${summarizeCapabilityItems(items)}）？将使用当前模块「${selectedModuleName}」。`;
    if (!confirm(confirmMessage)) return;

    setBulkCapabilityAction(mode);
    setError('');
    try {
      const batchUid = createCapabilityVerificationBatchUid();
      const launched: Array<{
        item: CapabilityItem;
        payload: CapabilityVerificationLaunchResponse;
        navigation: ReturnType<typeof readExecutionEntryNavigationTargets>;
        verificationIntent?: CapabilityVerificationIntent;
        observation: Pick<
          CapabilityVerificationMonitorItem,
          'latestRepairObservationAt' | 'latestRepairObservationSummary' | 'latestRepairObservationVerifierCheckUids'
        >;
      }> = [];
      const failed: Array<{ item: CapabilityItem; reason: string }> = [];
      const effectiveVerificationIntent =
        mode === 'verify' ? normalizeCapabilityVerificationIntent(options?.verificationIntent || 'verify') : undefined;
      const launchLabel = describeCapabilityVerificationLaunchLabel(mode, effectiveVerificationIntent);

      for (const item of items) {
        try {
          const itemVerificationIntent = mode === 'repair' ? resolveCapabilityLastVerificationIntent(item) : effectiveVerificationIntent;
          const observation = resolveCapabilityVerificationBatchObservation(item.capabilityUid, itemVerificationIntent);
          const payload = await requestCapabilityVerification(item, {
            moduleUid,
            mode,
            verificationIntent: itemVerificationIntent,
            latestRepairObservationAt: observation.latestRepairObservationAt,
            latestRepairObservationSummary: observation.latestRepairObservationSummary,
            latestRepairObservationVerifierCheckUids: observation.latestRepairObservationVerifierCheckUids,
          });
          const navigation = readExecutionEntryNavigationTargets(payload);
          launched.push({ item, payload, navigation, verificationIntent: itemVerificationIntent, observation });
        } catch (err: unknown) {
          failed.push({
            item,
            reason: err instanceof Error ? err.message : '启动能力验证失败',
          });
        }
      }

      if (options?.clearSelection !== false) {
        setSelectedCapabilityUids([]);
      }
      const moduleName = mode === 'verify' ? selectedModuleName : '最近失败执行';
      let governanceAuditError = '';

      if (options?.governanceAudit && launched.length > 0) {
        const governanceAuditItemByCapabilityUid = new Map(
          options.governanceAudit.items.map((item) => [item.capabilityUid, item])
        );
        const auditItems = launched.flatMap((launchedItem) => {
          const source = governanceAuditItemByCapabilityUid.get(launchedItem.item.capabilityUid);
          if (!source?.promotionGraderAudit) return [];
          return [
            {
              ...source,
              configUid: launchedItem.payload.configUid,
              planUid: launchedItem.payload.planUid,
              executionUid: launchedItem.payload.executionUid,
              runPath: launchedItem.navigation.runPath,
            },
          ];
        });

        if (auditItems.length > 0) {
          try {
            await requestPromotionGovernanceAudit({
              actionKind: options.governanceAudit.actionKind,
              sourceView: options.governanceAudit.sourceView,
              batchUid,
              moduleUid,
              moduleName,
              items: auditItems,
            });
          } catch (err: unknown) {
            governanceAuditError = err instanceof Error ? err.message : '写入 promotion governance 审计失败';
          }
        }
      }

      registerCapabilityVerificationBatch({
        batchUid,
        title: options?.batchTitle || (mode === 'repair' ? '批量修复失败项' : '批量验证能力'),
        mode,
        verificationIntent: effectiveVerificationIntent,
        moduleName,
        items: launched.map(({ item, payload, navigation, verificationIntent: itemVerificationIntent, observation }) => {
          return {
            capabilityUid: item.capabilityUid,
            capabilityName: item.name,
            executionUid: payload.executionUid,
            runPath: navigation.runPath,
            workspacePath: navigation.workspacePath,
            workspaceHistoryPath: navigation.workspaceHistoryPath,
            mode,
            verificationIntent: itemVerificationIntent,
            latestRepairObservationAt: observation.latestRepairObservationAt,
            latestRepairObservationSummary: observation.latestRepairObservationSummary,
            latestRepairObservationVerifierCheckUids: observation.latestRepairObservationVerifierCheckUids,
          };
        }),
      });

      const successMessage = launched.length > 0 ? `已启动 ${launched.length} 条${launchLabel}` : '';
      const firstRunMessage =
        launched.length > 0
          ? mode === 'repair'
            ? `首条修复运行 ${launched[0]?.payload.executionUid}`
            : `首条${launchLabel}运行 ${launched[0]?.payload.executionUid}`
          : '';
      const failureSummary = summarizeCapabilityFailures(failed);

      if (launched.length === 0) {
        showError(`${mode === 'repair' ? '批量修复启动失败' : '批量验证启动失败'}：${failureSummary}`);
        return;
      }

      showNotice(
        [
          successMessage,
          mode === 'verify' ? `模块「${selectedModuleName}」` : '',
          firstRunMessage,
          failed.length > 0 ? `${failed.length} 条失败：${failureSummary}` : '',
          governanceAuditError ? `治理审计未落盘：${governanceAuditError}` : '',
        ]
          .filter(Boolean)
          .join('，')
      );
    } finally {
      setBulkCapabilityAction('');
    }
  }

  async function verifySelectedCapabilities() {
    await launchCapabilityVerificationBatch(selectedVerifiableCapabilityItems, 'verify');
  }

  async function repairSelectedCapabilities() {
    await launchCapabilityVerificationBatch(selectedRepairableCapabilityItems, 'repair');
  }

  async function verifyRecommendedCapabilities() {
    await launchCapabilityVerificationBatch(recommendedVerifyCapabilityItems, 'verify', {
      confirmMessage: `确认按推荐队列发起 ${recommendedVerifyCapabilityItems.length} 条能力验证（${summarizeCapabilityItems(
        recommendedVerifyCapabilityItems
      )}）？将使用当前模块「${selectedModuleName}」。`,
      batchTitle: '推荐队列：能力验证',
      clearSelection: false,
      verificationIntent: 'verify',
    });
  }

  async function reviewRecommendedCapabilities() {
    await launchCapabilityVerificationBatch(recommendedReviewCapabilityItems, 'verify', {
      confirmMessage: `确认按推荐队列发起 ${recommendedReviewCapabilityItems.length} 条保守复核（${summarizeCapabilityItems(
        recommendedReviewCapabilityItems
      )}）？这批主要包含 suppressed helper、高压阻断、弱恢复或 mixed observing 命中的能力，将使用当前模块「${selectedModuleName}」。`,
      batchTitle: '推荐队列：保守复核',
      clearSelection: false,
      verificationIntent: 'review',
      governanceAudit: {
        actionKind: 'recommended_review_batch',
        sourceView: 'verification_queue',
        items: buildPromotionGovernanceAuditLaunchItems(
          recommendedReviewCapabilityItems,
          buildPromotionGovernanceAuditSourceItemsFromQueue(capabilityVerificationQueueItems),
          'review'
        ),
      },
    });
  }

  async function repairRecommendedCapabilities() {
    await launchCapabilityVerificationBatch(recommendedRepairCapabilityItems, 'repair', {
      confirmMessage: `确认按推荐队列发起 ${recommendedRepairCapabilityItems.length} 条验证修复（${summarizeCapabilityItems(
        recommendedRepairCapabilityItems
      )}）？系统会基于各自最近失败执行重跑脚本。`,
      batchTitle: '推荐队列：能力修复',
      clearSelection: false,
    });
  }

  async function reviewHighFailureCapabilities() {
    await launchCapabilityVerificationBatch(highFailureRecommendedReviewCapabilityItems, 'verify', {
      confirmMessage: `确认按高频失败队列发起 ${highFailureRecommendedReviewCapabilityItems.length} 条保守复核（${summarizeCapabilityItems(
        highFailureRecommendedReviewCapabilityItems
      )}）？这批对象近期存在明显 helper 漂移、高压阻断或弱恢复风险，将使用当前模块「${selectedModuleName}」。`,
      batchTitle: '高频失败：保守复核',
      clearSelection: false,
      verificationIntent: 'review',
      governanceAudit: {
        actionKind: 'high_failure_review_batch',
        sourceView: 'verification_queue',
        items: buildPromotionGovernanceAuditLaunchItems(
          highFailureRecommendedReviewCapabilityItems,
          buildPromotionGovernanceAuditSourceItemsFromQueue(highFailureCapabilityVerificationQueueItems),
          'review'
        ),
      },
    });
  }

  async function verifyPromotionCapabilities() {
    await launchCapabilityVerificationBatch(promotionRecommendedVerifyCapabilityItems, 'verify', {
      confirmMessage: `确认按提级治理视图发起 ${promotionRecommendedVerifyCapabilityItems.length} 条能力验证（${summarizeCapabilityItems(
        promotionRecommendedVerifyCapabilityItems
      )}）？这批对象已具备明确的 starter promotion evidence，将使用当前模块「${selectedModuleName}」。`,
      batchTitle: '提级治理：能力验证',
      clearSelection: false,
      verificationIntent: 'verify',
      governanceAudit: {
        actionKind: 'promotion_verify_batch',
        sourceView: 'verification_queue',
        items: buildPromotionGovernanceAuditLaunchItems(
          promotionRecommendedVerifyCapabilityItems,
          buildPromotionGovernanceAuditSourceItemsFromQueue(promotionCapabilityVerificationQueueItems),
          'verify'
        ),
      },
    });
  }

  async function reviewPromotionCapabilities() {
    await launchCapabilityVerificationBatch(promotionRecommendedReviewCapabilityItems, 'verify', {
      confirmMessage: `确认按提级治理视图发起 ${promotionRecommendedReviewCapabilityItems.length} 条保守复核（${summarizeCapabilityItems(
        promotionRecommendedReviewCapabilityItems
      )}）？这批对象命中了 suppressed / 高压阻断 / 弱恢复等 promotion 风险，需要先保守确认，再决定是否继续提级治理。将使用当前模块「${selectedModuleName}」。`,
      batchTitle: '提级治理：保守复核',
      clearSelection: false,
      verificationIntent: 'review',
      governanceAudit: {
        actionKind: 'promotion_review_batch',
        sourceView: 'verification_queue',
        items: buildPromotionGovernanceAuditLaunchItems(
          promotionRecommendedReviewCapabilityItems,
          buildPromotionGovernanceAuditSourceItemsFromQueue(promotionCapabilityVerificationQueueItems),
          'review'
        ),
      },
    });
  }

  async function reviewSuppressedStarterHelperGovernanceCapabilities() {
    await launchCapabilityVerificationBatch(suppressedStarterHelperGovernanceReviewCapabilityItems, 'verify', {
      confirmMessage: `确认按 Starter Helper 健康视图发起 ${suppressedStarterHelperGovernanceReviewCapabilityItems.length} 条保守复核（${summarizeCapabilityItems(
        suppressedStarterHelperGovernanceReviewCapabilityItems
      )}）？这批能力来自 ${suppressedStarterHelperGovernanceTargets.length} 个近期高频失败且已过滤的 helper，将使用当前模块「${selectedModuleName}」。`,
      batchTitle: 'Helper 健康：已过滤高频复核',
      clearSelection: false,
      verificationIntent: 'review',
      governanceAudit: {
        actionKind: 'suppressed_helper_review_batch',
        sourceView: 'helper_health',
        items: buildPromotionGovernanceAuditLaunchItems(
          suppressedStarterHelperGovernanceReviewCapabilityItems,
          buildPromotionGovernanceAuditSourceItemsFromHelperHealth(highFailureSuppressedStarterHelperItems),
          'review'
        ),
      },
    });
  }

  async function repairHighFailureCapabilities() {
    await launchCapabilityVerificationBatch(highFailureRecommendedRepairCapabilityItems, 'repair', {
      confirmMessage: `确认按高频失败队列发起 ${highFailureRecommendedRepairCapabilityItems.length} 条验证修复（${summarizeCapabilityItems(
        highFailureRecommendedRepairCapabilityItems
      )}）？这批对象近期已经反复失败，将优先进入止血修复。`,
      batchTitle: '高频失败：能力修复',
      clearSelection: false,
    });
  }

  function applyTaskDraft() {
    if (!effectiveRecipe) return;
    if (coverageBlockedReason) {
      showError(coverageBlockedReason);
      return;
    }
    if (creationBlockedReason) {
      showError(creationBlockedReason);
      return;
    }
    if (!selectedModuleUid) {
      showError('请先选择目标模块');
      return;
    }

    const draft = buildTaskDraftFromRecipe({
      recipe: effectiveRecipe,
      moduleUid: selectedModuleUid,
    });
    onApplyTaskDraft(draft);
    closeWorkbench();
  }

  const viewSwitchPanel = (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {([
          {
            key: 'recipe' as WorkbenchView,
            label: '需求编排',
            badge: recipeResponse?.recipe ? `${matchedCapabilityCount} 命中` : '主视图',
          },
          {
            key: 'knowledge' as WorkbenchView,
            label: '知识文档',
            badge: `${activeDocuments.length} 启用`,
          },
          {
            key: 'capability' as WorkbenchView,
            label: '稳定能力',
            badge: `${activeCapabilities.length} 可用`,
          },
        ]).map((item) => (
          <button
            key={item.key}
            aria-label={item.label}
            onClick={() => setView(item.key)}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
              view === item.key
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <span>{item.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                view === item.key ? 'bg-white/12 text-white/92' : 'bg-white text-slate-500'
              }`}
            >
              {item.badge}
            </span>
          </button>
        ))}
      </div>

      {!canEditContent && view !== 'recipe' && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          当前角色只能查看知识和能力内容，不能导入知识或保存能力。
        </div>
      )}
    </div>
  );

  const knowledgeCatalogPanel = (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">知识目录</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">浏览项目手册、笔记与执行沉淀，选中文档后可直接预览切块结果。</p>
        </div>
        <div className="text-right">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500">
            {recipeResponse?.knowledgeChunkCount || activeDocuments.reduce((sum, item) => sum + item.chunkCount, 0)} chunks
          </span>
          <p className="mt-1 text-[11px] text-slate-400">{activeDocuments.length} 启用 / {documents.length} 总计</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {loadingContext && documents.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">加载知识库中...</p>
        )}
        {!loadingContext && documents.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">当前项目还没有知识文档。</p>
        )}
        {documents.map((item) => {
          const selected = item.documentUid === selectedDocumentUid;
          const archived = item.status === 'archived';
          return (
            <div
              key={item.documentUid}
              className={`rounded-2xl border px-3 py-3 transition ${
                archived
                  ? 'border-amber-200 bg-amber-50/60'
                  : selected
                    ? 'border-sky-200 bg-sky-50/60'
                    : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words text-sm font-medium text-slate-800">{item.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{item.chunkCount} 块</span>
                    {selected && !archived && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-200">
                        当前预览
                      </span>
                    )}
                    {archived && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                        已归档
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400">
                    {sourceTypeLabel(item.sourceType)} · {item.status}
                    {item.sourcePath ? ` · ${item.sourcePath}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <button
                    onClick={() => void loadDocumentPreview(item.documentUid)}
                    className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-600 transition hover:bg-slate-50"
                  >
                    预览
                  </button>
                  {canEditContent &&
                    (archived ? (
                      <button
                        aria-label={`恢复知识文档 ${item.name}`}
                        onClick={() => void restoreKnowledgeDocument(item)}
                        disabled={documentActioningUid === item.documentUid}
                        className="h-7 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                      >
                        恢复
                      </button>
                    ) : (
                      <>
                        <button
                          aria-label={`设为能力来源 ${item.name}`}
                          onClick={() => openCreateCapabilityModal(item.documentUid)}
                          className="h-7 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[11px] text-blue-700 transition hover:bg-blue-100"
                        >
                          设为来源
                        </button>
                        <button
                          aria-label={`归档知识文档 ${item.name}`}
                          onClick={() => void archiveKnowledgeDocument(item)}
                          disabled={documentActioningUid === item.documentUid}
                          className="h-7 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                        >
                          归档
                        </button>
                      </>
                    ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const capabilityCatalogPanel = (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">能力目录</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">支持按来源、Starter Helper 和验证状态筛选，方便批量沉淀后继续审核。</p>
        </div>
        <div className="text-right">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500">
            {activeCapabilities.length} 项可用能力
          </span>
          <p className="mt-1 text-[11px] text-slate-400">
            其中 {starterCapabilityCount} 项来自 Starter 资产
            {archivedCapabilityCount > 0 ? ` · ${archivedCapabilityCount} 项已归档` : ''}
          </p>
          {capabilitySearchQuery && <p className="mt-1 text-[11px] text-slate-400">{capabilityCatalogItems.length} 条匹配</p>}
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_160px_160px_220px_auto] xl:items-end">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">搜索稳定能力</label>
          <input
            value={capabilitySearch}
            onChange={(event) => setCapabilitySearch(event.target.value)}
            aria-label="搜索稳定能力"
            placeholder="搜索名称、slug、触发短语、来源、helper"
            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-slate-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">来源</label>
          <select
            value={capabilityOriginFilter}
            onChange={(event) => setCapabilityOriginFilter(event.target.value as CapabilityOriginFilter)}
            aria-label="能力来源筛选"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="all">{capabilityOriginFilterLabel('all')}</option>
            <option value="starter_asset">{capabilityOriginFilterLabel('starter_asset')}</option>
            <option value="execution_derived">{capabilityOriginFilterLabel('execution_derived')}</option>
            <option value="knowledge_document">{capabilityOriginFilterLabel('knowledge_document')}</option>
            <option value="manual">{capabilityOriginFilterLabel('manual')}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">验证状态</label>
          <select
            value={capabilityVerificationFilter}
            onChange={(event) => setCapabilityVerificationFilter(event.target.value as CapabilityVerificationFilter)}
            aria-label="能力验证状态筛选"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="all">{capabilityVerificationFilterLabel('all')}</option>
            <option value="execution_verified">{capabilityVerificationFilterLabel('execution_verified')}</option>
            <option value="knowledge_inferred">{capabilityVerificationFilterLabel('knowledge_inferred')}</option>
            <option value="unknown">{capabilityVerificationFilterLabel('unknown')}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Starter Helper</label>
          <select
            value={capabilityHelperFilter}
            onChange={(event) => setCapabilityHelperFilter(event.target.value)}
            aria-label="Starter Helper 筛选"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="">全部 Helper</option>
            {capabilityStarterHelperOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        {canEditContent && (
          <button
            onClick={() => openCreateCapabilityModal(selectedDocumentUid)}
            className="h-10 rounded-xl bg-slate-900 px-4 text-[11px] font-medium text-white transition hover:bg-slate-700"
          >
            新增稳定能力
          </button>
        )}
      </div>

      {(capabilityStarterHelperHealthLoading ||
        capabilityStarterHelperHealthError ||
        scopedCapabilityStarterHelperHealthSnapshot ||
        capabilityStarterHelperHealthItems.length > 0) && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">Starter Helper 健康视图</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                这里把优先层、观察层、已过滤 helper 和 capability 推荐治理队列合到同一视角里。先看 helper 健康，再决定哪些 capability 该优先复核或修复。
              </p>
              {capabilityStarterHelperFailureSummary.latestRepairObservationSummary ? (
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  最近 verifier repair observation：{capabilityStarterHelperFailureSummary.latestRepairObservationSummary}
                  {(capabilityStarterHelperFailureSummary.latestRepairObservationVerifierCheckUids || []).length > 0
                    ? ` · verifier ${summarizeShortTextList(
                        capabilityStarterHelperFailureSummary.latestRepairObservationVerifierCheckUids || [],
                        2
                      )}`
                    : ''}
                  {capabilityStarterHelperFailureSummary.latestRepairObservationAt
                    ? ` · ${formatDateTimeLabel(capabilityStarterHelperFailureSummary.latestRepairObservationAt)}`
                    : ''}
                </p>
              ) : null}
              {scopedCapabilityStarterHelperHealthSnapshot?.snapshot.capturedAt ? (
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  最近快照：{formatDateTimeLabel(scopedCapabilityStarterHelperHealthSnapshot.snapshot.capturedAt)}
                  {scopedCapabilityStarterHelperHealthSnapshot.staleFallback ? ' · 当前使用旧快照回退' : ''}
                </p>
              ) : null}
              {scopedCapabilityStarterHelperHealthSnapshot?.auditLogPath ? (
                <p className="mt-1 break-all text-[11px] leading-5 text-slate-400">
                  审计文件：{scopedCapabilityStarterHelperHealthSnapshot.auditLogPath}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {capabilityStarterHelperHealthItems.length > 0 && (
                <>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700">
                    Helper {capabilityStarterHelperHealthSummary.totalHelpers}
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-medium text-emerald-700">
                    优先层 {capabilityStarterHelperHealthSummary.preferredCount}
                  </span>
                  <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-medium text-sky-700">
                    恢复观察 {capabilityStarterHelperHealthSummary.recoveringWatchingCount}
                  </span>
                  <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-medium text-amber-700">
                    混合观察 {capabilityStarterHelperHealthSummary.mixedWatchingCount}
                  </span>
                  <span className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-medium text-rose-700">
                    已过滤 {capabilityStarterHelperHealthSummary.suppressedCount}
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-medium text-emerald-700">
                    证据可提级 {capabilityStarterHelperHealthSummary.promoteReadyCount}
                  </span>
                  <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-medium text-amber-700">
                    高压阻断 {capabilityStarterHelperHealthSummary.blockedByFailurePressureCount}
                  </span>
                  <span className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-[11px] font-medium text-cyan-700">
                    弱恢复 {capabilityStarterHelperHealthSummary.weakRecoveryCount}
                  </span>
                  <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-medium text-sky-700">
                    待治理 {capabilityStarterHelperHealthSummary.governanceHelperCount}
                  </span>
                  {suppressedStarterHelperGovernanceTargets.length > 0 && (
                    <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-medium text-amber-700">
                      已过滤高频 helper {suppressedStarterHelperGovernanceTargets.length}
                    </span>
                  )}
                  {suppressedStarterHelperGovernanceReviewCapabilityItems.length > 0 && (
                    <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-medium text-amber-700">
                      独立复核能力 {suppressedStarterHelperGovernanceReviewCapabilityItems.length}
                    </span>
                  )}
                  {capabilityStarterHelperFailureSummary.highFailureCandidateCount > 0 && (
                    <span className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-medium text-rose-700">
                      高频失败 {capabilityStarterHelperFailureSummary.highFailureCandidateCount}
                    </span>
                  )}
                  <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-medium text-amber-700">
                    复核失败 {capabilityStarterHelperFailureSummary.recentFailedReviewCapabilityCount}
                  </span>
                  <span className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-medium text-rose-700">
                    验证失败 {capabilityStarterHelperFailureSummary.recentFailedVerifyCapabilityCount}
                  </span>
                </>
              )}
              {canEditContent && suppressedStarterHelperGovernanceReviewCapabilityItems.length > 0 && (
                <button
                  onClick={() => void reviewSuppressedStarterHelperGovernanceCapabilities()}
                  disabled={
                    capabilityCatalogBusy ||
                    suppressedStarterHelperGovernanceReviewCapabilityItems.length === 0 ||
                    !hasCapabilityVerificationModule
                  }
                  className="h-8 rounded-lg border border-amber-300 bg-amber-50 px-3 text-[11px] font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                >
                  启动已过滤 Helper 复核 ({suppressedStarterHelperGovernanceReviewCapabilityItems.length})
                </button>
              )}
              <button
                onClick={() => void loadCapabilityStarterHelperHealthSnapshot({ force: true })}
                disabled={capabilityStarterHelperHealthLoading}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                {capabilityStarterHelperHealthLoading ? '刷新中...' : '刷新健康视图'}
              </button>
            </div>
          </div>

          {capabilityStarterHelperHealthError ? (
            <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-[11px] leading-5 text-slate-700">
              {capabilityStarterHelperHealthError}
            </p>
          ) : null}

          {!capabilityStarterHelperHealthError && scopedCapabilityStarterHelperHealthSnapshot?.refreshError ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[11px] leading-5 text-amber-800">
              刷新失败，当前展示最近一次成功快照：{scopedCapabilityStarterHelperHealthSnapshot.refreshError}
            </p>
          ) : null}

          {!capabilityStarterHelperHealthLoading &&
          !capabilityStarterHelperHealthError &&
          capabilityStarterHelperHealthItems.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {capabilityStarterHelperHealthItems.map((item) => (
                <div key={item.helper} className="rounded-2xl border border-white/80 bg-white px-4 py-4 text-[11px] leading-5 text-slate-600">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-all font-mono text-xs text-slate-900">{item.helper}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${starterHelperSourceTone(item.source)}`}>
                          {starterHelperSourceLabel(item.source)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${starterHelperHealthTone(
                            item.healthStatus,
                            item.knowledgeChangeWatchingKind || ''
                          )}`}
                        >
                          {item.healthLabel}
                        </span>
                      </div>
                      <p className="mt-2 text-slate-500">
                        复用 {item.runCount} 次 · 通过 {item.passedRuns} 次 · 通过率 {item.passRate}%
                        {item.suggestedReuseRuns > 0 ? ` · 命中推荐 ${item.suggestedReuseRuns} 次` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.recommendedCapabilityCount > 0 && (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700 ring-1 ring-sky-200">
                          待治理 {item.recommendedCapabilityCount}
                        </span>
                      )}
                      {item.promotionEvidence && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${promotionEvidenceReadinessTone(
                            item.promotionEvidence.readiness
                          )}`}
                        >
                          {promotionEvidenceReadinessLabel(item.promotionEvidence.readiness)}
                        </span>
                      )}
                      {item.promotionEvidence?.governance.weakRecovery && (
                        <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] text-cyan-700 ring-1 ring-cyan-200">
                          弱恢复
                        </span>
                      )}
                      {item.preferredPromotionStatus && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${starterHelperPreferredPromotionTone(
                            item.preferredPromotionStatus
                          )}`}
                        >
                          {starterHelperPreferredPromotionLabel(item.preferredPromotionStatus)}
                        </span>
                      )}
                      {item.governanceRecommendationStatus && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${starterHelperGovernanceRecommendationTone(
                            item.governanceRecommendationStatus
                          )}`}
                        >
                          {starterHelperGovernanceRecommendationLabel(item.governanceRecommendationStatus)}
                        </span>
                      )}
                      {hasIntentVerificationFailurePressureViewHighFailure(item) && (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700 ring-1 ring-rose-200">
                          高频失败
                        </span>
                      )}
                      {item.recommendedRepairCount > 0 && (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700 ring-1 ring-rose-200">
                          修复 {item.recommendedRepairCount}
                        </span>
                      )}
                      {item.recommendedReviewCount > 0 && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 ring-1 ring-amber-200">
                          复核 {item.recommendedReviewCount}
                        </span>
                      )}
                      {item.failurePressure.recentFailedReviewCapabilityCount > 0 && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 ring-1 ring-amber-200">
                          复核失败 {item.failurePressure.recentFailedReviewCapabilityCount}
                        </span>
                      )}
                      {item.failurePressure.recentFailedVerifyCapabilityCount > 0 && (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700 ring-1 ring-rose-200">
                          验证失败 {item.failurePressure.recentFailedVerifyCapabilityCount}
                        </span>
                      )}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 ring-1 ring-slate-200">
                        启用能力 {item.activeLinkedCapabilityCount}
                      </span>
                      {item.archivedLinkedCapabilityCount > 0 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200">
                          已归档 {item.archivedLinkedCapabilityCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <p
                    className={`mt-3 ${
                      item.healthStatus === 'suppressed'
                        ? 'text-rose-800'
                        : item.healthStatus === 'watching'
                          ? 'text-amber-800'
                          : item.healthStatus === 'preferred'
                            ? 'text-emerald-800'
                            : 'text-slate-700'
                    }`}
                  >
                    {item.recommendation}
                  </p>
                  <div className="mt-2 space-y-1 text-slate-500">
                    {(item.failurePressure.recentFailedReviewExecutionCount > 0 ||
                      item.failurePressure.recentFailedVerifyExecutionCount > 0) && (
                      <p>
                        近 {item.failurePressure.recentFailureWindowDays} 天执行失败：
                        {item.failurePressure.recentFailedReviewExecutionCount > 0
                          ? ` 复核 ${item.failurePressure.recentFailedReviewExecutionCount} 次`
                          : ''}
                        {item.failurePressure.recentFailedReviewExecutionCount > 0 &&
                        item.failurePressure.recentFailedVerifyExecutionCount > 0
                          ? '；'
                          : ''}
                        {item.failurePressure.recentFailedVerifyExecutionCount > 0
                          ? ` 验证 ${item.failurePressure.recentFailedVerifyExecutionCount} 次`
                          : ''}
                      </p>
                    )}
                    {item.latestRepairObservationSummary ? (
                      <p>
                        最近 verifier observation：
                        {` ${item.latestRepairObservationSummary}`}
                        {(item.latestRepairObservationVerifierCheckUids || []).length > 0
                          ? ` · verifier ${summarizeShortTextList(item.latestRepairObservationVerifierCheckUids || [], 2)}`
                          : ''}
                        {item.latestRepairObservationAt ? ` · ${formatDateTimeLabel(item.latestRepairObservationAt)}` : ''}
                      </p>
                    ) : null}
                    {item.promotionEvidence && (
                      <p>
                        共享证据：
                        {` ${promotionEvidenceReadinessLabel(item.promotionEvidence.readiness)}`}
                        {item.promotionEvidence.governance.weakRecovery ? '，含自动 repair 弱恢复' : ''}
                      </p>
                    )}
                    {item.preferredPromotionReason ? <p>提级建议：{item.preferredPromotionReason}</p> : null}
                    {item.preferredAutoPromotionCondition ? <p>自动提级条件：{item.preferredAutoPromotionCondition}</p> : null}
                    {(item.preferredPromotionRequiredPositiveRuleCount > 0 ||
                      item.preferredPromotionPositiveRuleCount > 0 ||
                      item.preferredPromotionNegativeRuleCount > 0) && (
                      <p>
                        提级进度：
                        {` 长期正向 ${item.preferredPromotionPositiveRuleCount}/${item.preferredPromotionRequiredPositiveRuleCount} 条`}
                        {item.preferredPromotionNegativeRuleCount > 0
                          ? `，负向/混合 ${item.preferredPromotionNegativeRuleCount} 条`
                          : ''}
                      </p>
                    )}
                    {item.governanceRecommendationReason ? <p>治理建议：{item.governanceRecommendationReason}</p> : null}
                    {item.governanceAutoUnlockCondition ? <p>自动解封条件：{item.governanceAutoUnlockCondition}</p> : null}
                    {(item.governanceTargetCapabilityCount > 0 ||
                      item.governancePassedCapabilityCount > 0 ||
                      item.governanceDirectVerifyPassedCapabilityCount > 0) && (
                      <p>
                        当前恢复进度：
                        {` 治理目标通过 ${item.governancePassedCapabilityCount}/${item.governanceTargetCapabilityCount} 条`}
                        {item.governanceRequiredPassedCapabilityCount > 0
                          ? `，解封门槛 ${item.governanceRequiredPassedCapabilityCount} 条`
                          : ''}
                        {`，直接验证通过 ${item.governanceDirectVerifyPassedCapabilityCount} 条`}
                      </p>
                    )}
                    {item.promotionEvidence &&
                    (item.promotionEvidence.governance.releaseDirectVerifyPassedCapabilityCount > 0 ||
                      item.promotionEvidence.governance.releaseManualRepairPassedCapabilityCount > 0 ||
                      item.promotionEvidence.governance.releaseAutoRepairPassedCapabilityCount > 0) ? (
                      <p>
                        恢复证据：
                        {` 直接验证 ${item.promotionEvidence.governance.releaseDirectVerifyPassedCapabilityCount} 条`}
                        {item.promotionEvidence.governance.releaseManualRepairPassedCapabilityCount > 0
                          ? `，人工 repair ${item.promotionEvidence.governance.releaseManualRepairPassedCapabilityCount} 条`
                          : ''}
                        {item.promotionEvidence.governance.releaseAutoRepairPassedCapabilityCount > 0
                          ? `，自动 repair ${item.promotionEvidence.governance.releaseAutoRepairPassedCapabilityCount} 条`
                          : ''}
                      </p>
                    ) : null}
                    <p>支持规则：{excerpt((item.supportingRuleTitles.length > 0 ? item.supportingRuleTitles : item.supportingRuleIds).join('、'), 72)}</p>
                    {item.knowledgeChangeDecisionableRuleCount ? <p>已判定规则：{item.knowledgeChangeDecisionableRuleCount} 条</p> : null}
                    {item.knowledgeChangeSupportingAuditIds?.length ? (
                      <p>支持审计：{excerpt(item.knowledgeChangeSupportingAuditIds.join('、'), 72)}</p>
                    ) : null}
                    {item.knowledgeChangeSignal ? (
                      <p>长期 evidence：{starterHelperKnowledgeSignalLabel(item.knowledgeChangeSignal)}</p>
                    ) : item.knowledgeChangeTier ? (
                      <p>长期 evidence：{starterHelperKnowledgeTierLabel(item.knowledgeChangeTier, item.knowledgeChangeWatchingKind || '')}</p>
                    ) : null}
                    {item.linkedCapabilities.length > 0 ? (
                      <p>
                        关联能力：
                        {excerpt(item.linkedCapabilities.map((capability) => `${capability.name}${capability.status === 'archived' ? '（已归档）' : ''}`).join('、'), 88)}
                      </p>
                    ) : (
                      <p>当前还没有已沉淀 capability 直接复用该 helper。</p>
                    )}
                    {item.queueItems.length > 0 && (
                      <p>
                        推荐治理：
                        {excerpt(
                          item.queueItems
                            .map((queueItem) => {
                              const capabilityName = queueItem.capabilityName || queueItem.capabilityUid;
                              if (queueItem.recommendedMode === 'repair') {
                                return queueItem.lastVerificationIntent
                                  ? `${capabilityName}（修复 / ${capabilityVerificationIntentLabel(queueItem.lastVerificationIntent)}）`
                                  : `${capabilityName}（修复）`;
                              }
                              return `${capabilityName}（验证）`;
                            })
                            .join('、'),
                          88
                        )}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => focusCapabilityStarterHelper(item.helper)}
                      className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-600 transition hover:bg-slate-50"
                    >
                      筛选此 helper
                    </button>
                    {item.recommendedCapabilityCount > 0 && (
                      <button
                        onClick={selectCapabilityVerificationRecommendations}
                        disabled={capabilityCatalogBusy || visibleCapabilityVerificationRecommendationCount === 0}
                        className="h-7 rounded-lg border border-sky-200 bg-sky-50 px-2.5 text-[11px] font-medium text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
                      >
                        选中推荐能力
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : !capabilityStarterHelperHealthLoading &&
            !capabilityStarterHelperHealthError &&
            scopedCapabilityStarterHelperHealthSnapshot ? (
            <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-[11px] leading-5 text-slate-500">
              当前快照里还没有可展示的 Starter Helper 健康项。
            </p>
          ) : null}
        </div>
      )}

      {(capabilityVerificationQueueLoading ||
        capabilityVerificationQueueError ||
        capabilityVerificationQueueSummary ||
        capabilityVerificationQueueItems.length > 0) && (
        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/60 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-sky-900">建议验证队列</p>
              <p className="mt-1 text-xs leading-5 text-sky-700">
                这里展示的是服务侧推荐顺序，不等于能力目录默认排序。它会优先把“最近失败可修复”“命中 suppressed helper 需复核”“可转正 starter
                asset”合并成同一条治理队列。
              </p>
              {capabilityVerificationQueueFailureSummary.latestRepairObservationSummary ? (
                <p className="mt-1 text-[11px] leading-5 text-sky-700">
                  最近 verifier repair observation：{capabilityVerificationQueueFailureSummary.latestRepairObservationSummary}
                  {(capabilityVerificationQueueFailureSummary.latestRepairObservationVerifierCheckUids || []).length > 0
                    ? ` · verifier ${summarizeShortTextList(
                        capabilityVerificationQueueFailureSummary.latestRepairObservationVerifierCheckUids || [],
                        2
                      )}`
                    : ''}
                  {capabilityVerificationQueueFailureSummary.latestRepairObservationAt
                    ? ` · ${formatDateTimeLabel(capabilityVerificationQueueFailureSummary.latestRepairObservationAt)}`
                    : ''}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {capabilityVerificationQueueSummary && (
                <>
                  <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-medium text-sky-700">
                    候选 {capabilityVerificationQueueSummary.candidateCount}
                  </span>
                  <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-medium text-blue-700">
                    验证 {recommendedVerifyCapabilityItems.length}
                  </span>
                  <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-medium text-amber-700">
                    保守复核 {recommendedReviewCapabilityItems.length}
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-medium text-emerald-700">
                    提级治理 {promotionCapabilityVerificationQueueSummary.candidateCount}
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-medium text-emerald-700">
                    证据可提级 {promotionCapabilityVerificationQueueSummary.promoteReadyCount}
                  </span>
                  <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-medium text-amber-700">
                    高压阻断 {promotionCapabilityVerificationQueueSummary.blockedByFailurePressureCount}
                  </span>
                  <span className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-[11px] font-medium text-cyan-700">
                    弱恢复 {promotionCapabilityVerificationQueueSummary.weakRecoveryCount}
                  </span>
                  <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-medium text-sky-700">
                    修复 {capabilityVerificationQueueSummary.repairCount}
                  </span>
                  <span className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-medium text-rose-700">
                    高频失败 {capabilityVerificationQueueFailureSummary.highFailureCandidateCount}
                  </span>
                  <span className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-medium text-rose-700">
                    高频修复 {capabilityVerificationQueueFailureSummary.highFailureRepairCount}
                  </span>
                  <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-medium text-amber-700">
                    高频治理 {capabilityVerificationQueueFailureSummary.highFailureGovernanceCount}
                  </span>
                  <div className="inline-flex items-center rounded-xl border border-sky-200 bg-white p-1">
                    {(['auto', 'promotion', 'high_failure', 'all'] as CapabilityVerificationQueueFocus[]).map((focus) => {
                      const isActive = capabilityVerificationQueueFocus === focus;
                      const count =
                        focus === 'all'
                          ? capabilityVerificationQueueItems.length
                          : focus === 'promotion'
                            ? promotionCapabilityVerificationQueueItems.length
                            : focus === 'high_failure'
                              ? highFailureCapabilityVerificationQueueItems.length
                              : effectiveCapabilityVerificationQueueFocus === 'promotion'
                                ? promotionCapabilityVerificationQueueItems.length
                                : effectiveCapabilityVerificationQueueFocus === 'high_failure'
                                  ? highFailureCapabilityVerificationQueueItems.length
                                  : capabilityVerificationQueueItems.length;
                      return (
                        <button
                          key={focus}
                          type="button"
                          onClick={() => setCapabilityVerificationQueueFocus(focus)}
                          disabled={
                            capabilityVerificationQueueLoading ||
                            (focus === 'promotion' && promotionCapabilityVerificationQueueSummary.candidateCount === 0) ||
                            (focus === 'high_failure' &&
                              capabilityVerificationQueueSummary.highFailureCandidateCount === 0 &&
                              highFailureCapabilityVerificationQueueItems.length === 0)
                          }
                          className={`rounded-lg px-3 py-1 text-[11px] font-medium transition ${
                            isActive
                              ? 'bg-sky-600 text-white shadow-sm'
                              : 'text-sky-700 hover:bg-sky-50 disabled:text-slate-300 disabled:hover:bg-transparent'
                          }`}
                        >
                          {capabilityVerificationQueueFocusLabel(focus)}
                          {focus === 'auto' ? '' : ` (${count})`}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {canEditContent && promotionRecommendedVerifyCapabilityItems.length > 0 && (
                <button
                  onClick={() => void verifyPromotionCapabilities()}
                  disabled={capabilityCatalogBusy || promotionRecommendedVerifyCapabilityItems.length === 0 || !hasCapabilityVerificationModule}
                  className="h-8 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                >
                  启动提级验证 ({promotionRecommendedVerifyCapabilityItems.length})
                </button>
              )}
              {canEditContent && promotionRecommendedReviewCapabilityItems.length > 0 && (
                <button
                  onClick={() => void reviewPromotionCapabilities()}
                  disabled={capabilityCatalogBusy || promotionRecommendedReviewCapabilityItems.length === 0 || !hasCapabilityVerificationModule}
                  className="h-8 rounded-lg border border-cyan-300 bg-cyan-50 px-3 text-[11px] font-medium text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-50"
                >
                  启动提级复核 ({promotionRecommendedReviewCapabilityItems.length})
                </button>
              )}
              {canEditContent && highFailureRecommendedReviewCapabilityItems.length > 0 && (
                <button
                  onClick={() => void reviewHighFailureCapabilities()}
                  disabled={capabilityCatalogBusy || highFailureRecommendedReviewCapabilityItems.length === 0 || !hasCapabilityVerificationModule}
                  className="h-8 rounded-lg border border-amber-300 bg-amber-50 px-3 text-[11px] font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                >
                  启动高频复核 ({highFailureRecommendedReviewCapabilityItems.length})
                </button>
              )}
              {canEditContent && highFailureRecommendedRepairCapabilityItems.length > 0 && (
                <button
                  onClick={() => void repairHighFailureCapabilities()}
                  disabled={capabilityCatalogBusy || highFailureRecommendedRepairCapabilityItems.length === 0}
                  className="h-8 rounded-lg border border-rose-300 bg-rose-50 px-3 text-[11px] font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                >
                  启动高频修复 ({highFailureRecommendedRepairCapabilityItems.length})
                </button>
              )}
              {canEditContent && recommendedVerifyCapabilityItems.length > 0 && (
                <button
                  onClick={() => void verifyRecommendedCapabilities()}
                  disabled={capabilityCatalogBusy || recommendedVerifyCapabilityItems.length === 0 || !hasCapabilityVerificationModule}
                  className="h-8 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[11px] font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                >
                  启动推荐验证 ({recommendedVerifyCapabilityItems.length})
                </button>
              )}
              {canEditContent && recommendedReviewCapabilityItems.length > 0 && (
                <button
                  onClick={() => void reviewRecommendedCapabilities()}
                  disabled={capabilityCatalogBusy || recommendedReviewCapabilityItems.length === 0 || !hasCapabilityVerificationModule}
                  className="h-8 rounded-lg border border-amber-200 bg-amber-50 px-3 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                >
                  启动保守复核 ({recommendedReviewCapabilityItems.length})
                </button>
              )}
              {canEditContent && recommendedRepairCapabilityItems.length > 0 && (
                <button
                  onClick={() => void repairRecommendedCapabilities()}
                  disabled={capabilityCatalogBusy || recommendedRepairCapabilityItems.length === 0}
                  className="h-8 rounded-lg border border-violet-200 bg-violet-50 px-3 text-[11px] font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
                >
                  启动推荐修复 ({recommendedRepairCapabilityItems.length})
                </button>
              )}
              {canEditContent && focusedCapabilityVerificationQueueItemCount > 0 && (
                <button
                  onClick={selectCapabilityVerificationRecommendations}
                  disabled={capabilityCatalogBusy || visibleCapabilityVerificationRecommendationCount === 0}
                  className="h-8 rounded-lg border border-sky-200 bg-white px-3 text-[11px] font-medium text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
                >
                  选中推荐
                  {visibleCapabilityVerificationRecommendationCount > 0 ? ` (${visibleCapabilityVerificationRecommendationCount})` : ''}
                </button>
              )}
              {canEditContent && highFailureCapabilityVerificationQueueItems.length > 0 && (
                <button
                  onClick={selectHighFailureCapabilityVerificationRecommendations}
                  disabled={capabilityCatalogBusy}
                  className="h-8 rounded-lg border border-rose-200 bg-white px-3 text-[11px] font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  选中高频失败
                </button>
              )}
              <button
                onClick={() => void loadCapabilityVerificationQueue({ force: true })}
                disabled={capabilityVerificationQueueLoading}
                className="h-8 rounded-lg border border-sky-200 bg-white px-3 text-[11px] font-medium text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
              >
                {capabilityVerificationQueueLoading ? '刷新中...' : '刷新队列'}
              </button>
            </div>
          </div>

          {capabilityVerificationQueueError ? (
            <p className="mt-3 rounded-xl border border-sky-200 bg-white px-3 py-3 text-[11px] leading-5 text-sky-700">
              {capabilityVerificationQueueError}
            </p>
          ) : null}

          {!capabilityVerificationQueueLoading && !capabilityVerificationQueueError && capabilityVerificationQueueSummary ? (
            capabilityVerificationQueueItems.length > 0 ? (
              <div className="mt-4">
                <div className="rounded-xl border border-sky-100 bg-white/80 px-3 py-3 text-[11px] leading-5 text-sky-700">
                  <p>
                    当前视图：
                    {capabilityVerificationQueueFocus === 'auto'
                      ? `自动聚焦到「${capabilityVerificationQueueFocusLabel(effectiveCapabilityVerificationQueueFocus)}」`
                      : `只看「${capabilityVerificationQueueFocusLabel(effectiveCapabilityVerificationQueueFocus)}」`}
                    。
                    {effectiveCapabilityVerificationQueueFocus === 'promotion'
                      ? focusedCapabilityVerificationQueueItemCount > 0
                        ? ` 当前展示返回队列中的 ${focusedCapabilityVerificationQueueItemCount} 条提级治理对象（证据可提级 ${promotionCapabilityVerificationQueueSummary.promoteReadyCount} 条，高压阻断 ${promotionCapabilityVerificationQueueSummary.blockedByFailurePressureCount} 条，弱恢复 ${promotionCapabilityVerificationQueueSummary.weakRecoveryCount} 条）${
                            hiddenCapabilityVerificationQueueItemCount > 0
                              ? `，已暂时隐藏 ${hiddenCapabilityVerificationQueueItemCount} 条普通建议`
                              : ''
                          }。`
                        : ' 当前返回队列里没有提级治理对象。'
                      : effectiveCapabilityVerificationQueueFocus === 'high_failure'
                        ? focusedCapabilityVerificationQueueItemCount > 0
                          ? ` 当前展示返回队列中的 ${focusedCapabilityVerificationQueueItemCount} 条高频失败对象${
                              hiddenCapabilityVerificationQueueItemCount > 0
                                ? `，已暂时隐藏 ${hiddenCapabilityVerificationQueueItemCount} 条普通建议`
                                : ''
                            }。`
                          : ' 当前返回队列里没有高频失败对象。'
                        : ` 当前展示返回队列中的全部 ${focusedCapabilityVerificationQueueItemCount} 条建议。`}
                  </p>
                  {capabilityVerificationQueueSummary.candidateCount > capabilityVerificationQueueSummary.returnedCount && (
                    <p className="mt-1">
                      当前只返回前 {capabilityVerificationQueueSummary.returnedCount} 条建议，完整候选共 {capabilityVerificationQueueSummary.candidateCount} 条。
                    </p>
                  )}
                  {capabilityVerificationQueueSummary.highFailureCandidateCount > highFailureCapabilityVerificationQueueItems.length && (
                    <p className="mt-1">
                      完整候选中共有 {capabilityVerificationQueueSummary.highFailureCandidateCount} 条高频失败对象，当前返回窗口命中{' '}
                      {highFailureCapabilityVerificationQueueItems.length} 条。
                    </p>
                  )}
                  {capabilityVerificationQueueFocus === 'auto' &&
                    effectiveCapabilityVerificationQueueFocus === 'all' &&
                    (capabilityVerificationQueueSummary.highFailureCandidateCount > 0 ||
                      promotionCapabilityVerificationQueueSummary.candidateCount > 0) &&
                    highFailureCapabilityVerificationQueueItems.length === 0 &&
                    promotionCapabilityVerificationQueueItems.length === 0 && (
                      <p className="mt-1">
                        当前返回窗口未命中高频失败或提级治理对象，自动视图已回退到“全部”以避免空列表。
                      </p>
                    )}
                  {capabilityVerificationQueueFocus === 'auto' &&
                    effectiveCapabilityVerificationQueueFocus === 'promotion' &&
                    promotionCriticalCapabilityVerificationQueueItems.length > 0 && (
                      <p className="mt-1">
                        当前自动视图优先聚焦到提级治理，因为返回窗口里有 {promotionCriticalCapabilityVerificationQueueItems.length} 条高风险 promotion 对象。
                      </p>
                    )}
                </div>
                {focusedCapabilityVerificationQueueItemCount > 0 ? (
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {focusedCapabilityVerificationQueueItems.map((item) => (
                      <div
                        key={item.capabilityUid}
                        className="rounded-2xl border border-white/80 bg-white px-4 py-4 text-[11px] leading-5 text-slate-600"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${capabilityVerificationRecommendationTone(item.recommendationKind)}`}
                              >
                                {item.recommendationLabel}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${capabilityVerificationStatusTone(item.verificationStatus)}`}>
                                {item.verificationLabel}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${capabilityOriginTone(item.originKind)}`}>
                                {item.originLabel}
                              </span>
                              {item.promotionEvidence && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${promotionEvidenceReadinessTone(
                                    item.promotionEvidence.readiness
                                  )}`}
                                >
                                  {promotionEvidenceReadinessLabel(item.promotionEvidence.readiness)}
                                </span>
                              )}
                              {item.promotionEvidence?.governance.weakRecovery && (
                                <span className="rounded-full px-2 py-0.5 text-[10px] ring-1 ring-cyan-200 bg-cyan-50 text-cyan-700">
                                  弱恢复
                                </span>
                              )}
                              {item.highFailurePressure && (
                                <span className="rounded-full px-2 py-0.5 text-[10px] ring-1 ring-rose-200 bg-rose-50 text-rose-700">
                                  高频失败
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm font-semibold text-slate-900">{item.name}</p>
                            <p className="mt-1 break-all text-[11px] text-slate-400">{item.slug}</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${capabilityTypeTone(item.capabilityType)}`}>
                            {capabilityTypeLabel(item.capabilityType)}
                          </span>
                        </div>

                        <p className="mt-3 text-slate-700">{excerpt(item.reason, 120)}</p>
                        <div className="mt-2 space-y-1 text-slate-500">
                          <p>建议动作：{item.recommendedMode === 'repair' ? '验证修复' : '执行验证'}</p>
                          {item.starterHelper && (
                            <p>
                              Helper：<span className="font-mono">{item.starterHelper}</span>
                            </p>
                          )}
                          {item.starterKnowledgeChangeSignal ? (
                            <p>长期 evidence：{starterHelperKnowledgeSignalLabel(item.starterKnowledgeChangeSignal)}</p>
                          ) : item.starterKnowledgeChangeTier ? (
                            <p>
                              长期 evidence：
                              {starterHelperKnowledgeTierLabel(
                                item.starterKnowledgeChangeTier,
                                item.starterKnowledgeChangeWatchingKind
                              )}
                            </p>
                          ) : null}
                          {item.starterKnowledgeChangeDecisionableRuleCount > 0 && (
                            <p>已判定规则：{item.starterKnowledgeChangeDecisionableRuleCount} 条</p>
                          )}
                          {item.supportingRuleNames.length > 0 && (
                            <p>支持规则：{excerpt(item.supportingRuleNames.join('、'), 72)}</p>
                          )}
                          {item.promotionEvidence?.preferredPromotion.pending && (
                            <p>
                              提级状态：
                              {starterHelperPreferredPromotionLabel(item.promotionEvidence.preferredPromotion.status)}
                            </p>
                          )}
                          {item.promotionEvidence?.preferredPromotion.autoPromotionCondition && (
                            <p>自动提级条件：{excerpt(item.promotionEvidence.preferredPromotion.autoPromotionCondition, 88)}</p>
                          )}
                          {item.suppressedStarterHelper && item.suppressedStarterReason && (
                            <p>Suppressed 原因：{excerpt(item.suppressedStarterReason, 88)}</p>
                          )}
                          {item.suppressedStarterActiveLinkedCapabilityCount > 0 && (
                            <p>受影响启用能力：{item.suppressedStarterActiveLinkedCapabilityCount} 条</p>
                          )}
                          {item.promotionEvidence &&
                          (item.promotionEvidence.governance.releaseDirectVerifyPassedCapabilityCount > 0 ||
                            item.promotionEvidence.governance.releaseManualRepairPassedCapabilityCount > 0 ||
                            item.promotionEvidence.governance.releaseAutoRepairPassedCapabilityCount > 0) ? (
                            <p>
                              恢复证据：
                              {` 直接验证 ${item.promotionEvidence.governance.releaseDirectVerifyPassedCapabilityCount} 条`}
                              {item.promotionEvidence.governance.releaseManualRepairPassedCapabilityCount > 0
                                ? `，人工 repair ${item.promotionEvidence.governance.releaseManualRepairPassedCapabilityCount} 条`
                                : ''}
                              {item.promotionEvidence.governance.releaseAutoRepairPassedCapabilityCount > 0
                                ? `，自动 repair ${item.promotionEvidence.governance.releaseAutoRepairPassedCapabilityCount} 条`
                                : ''}
                            </p>
                          ) : null}
                          {(item.recentFailedReviewExecutionCount > 0 || item.recentFailedVerifyExecutionCount > 0) && (
                            <p>
                              最近失败压力：
                              {item.recentFailedReviewExecutionCount > 0
                                ? ` 近${item.recentFailureWindowDays}天复核失败 ${item.recentFailedReviewExecutionCount} 次`
                                : ''}
                              {item.recentFailedReviewExecutionCount > 0 && item.recentFailedVerifyExecutionCount > 0 ? '；' : ''}
                              {item.recentFailedVerifyExecutionCount > 0
                                ? ` 近${item.recentFailureWindowDays}天验证失败 ${item.recentFailedVerifyExecutionCount} 次`
                                : ''}
                            </p>
                          )}
                          {item.latestRepairObservationSummary ? (
                            <p>
                              最近 verifier observation：
                              {` ${item.latestRepairObservationSummary}`}
                              {(item.latestRepairObservationVerifierCheckUids || []).length > 0
                                ? ` · verifier ${summarizeShortTextList(item.latestRepairObservationVerifierCheckUids || [], 2)}`
                                : ''}
                              {item.latestRepairObservationAt ? ` · ${formatDateTimeLabel(item.latestRepairObservationAt)}` : ''}
                            </p>
                          ) : null}
                          {(item.recentStarterHelperFailedReviewExecutionCount > 0 ||
                            item.recentStarterHelperFailedVerifyExecutionCount > 0) &&
                            item.starterHelper && (
                              <p>
                                Helper 压力：
                                {item.recentStarterHelperFailedReviewExecutionCount > 0
                                  ? ` 近${item.recentStarterHelperFailureWindowDays}天复核失败 ${item.recentStarterHelperFailedReviewExecutionCount} 次`
                                  : ''}
                                {item.recentStarterHelperFailedReviewExecutionCount > 0 &&
                                item.recentStarterHelperFailedVerifyExecutionCount > 0
                                  ? '；'
                                  : ''}
                                {item.recentStarterHelperFailedVerifyExecutionCount > 0
                                  ? ` 近${item.recentStarterHelperFailureWindowDays}天验证失败 ${item.recentStarterHelperFailedVerifyExecutionCount} 次`
                                  : ''}
                              </p>
                            )}
                          {item.highFailurePressure && item.highFailurePressureSource && (
                            <p>
                              高频来源：
                              {item.highFailurePressureSource === 'capability'
                                ? ' 能力自身'
                                : item.highFailurePressureSource === 'starter_helper'
                                  ? ' Starter Helper'
                                  : ' 能力自身 + Starter Helper'}
                            </p>
                          )}
                          {item.lastVerificationStatus === 'failed' && item.lastVerificationExecutionUid && (
                            <p>
                              最近失败：
                              {item.lastVerificationIntent ? `${capabilityVerificationIntentLabel(item.lastVerificationIntent)} · ` : ''}
                              {excerpt(item.lastVerificationExecutionUid, 42)}
                              {item.lastVerificationCheckedAt ? ` · ${formatDateTimeLabel(item.lastVerificationCheckedAt)}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl border border-sky-200 bg-white px-3 py-3 text-[11px] leading-5 text-slate-500">
                    当前返回队列里没有可展示的高频失败对象；可以切回“全部”查看其他建议，或刷新队列等待新窗口结果。
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-sky-200 bg-white px-3 py-3 text-[11px] leading-5 text-slate-500">
                当前没有需要优先处理的推荐队列；目录里的能力仍可按需手动发起验证或修复。
              </p>
            )
          ) : null}
        </div>
      )}

      <div className="mt-4">
        {canEditContent && visibleSelectableCapabilityUids.length > 0 && (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-700">当前筛选下可批量治理 {visibleSelectableCapabilityUids.length} 条启用能力</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  已选 {selectedCapabilityItems.length} 条
                  {selectedCapabilityItems.length > 0
                    ? `，可归档 ${selectedCapabilityItems.length} / 可验证 ${selectedVerifiableCapabilityItems.length} / 可修复 ${selectedRepairableCapabilityItems.length}`
                    : '，先勾选需要治理的能力'}
                  {selectedStarterCapabilityCount > 0 ? `；其中 ${selectedStarterCapabilityCount} 条为 Starter 资产` : ''}
                </p>
                {!hasCapabilityVerificationModule && (
                  <p className="mt-1 text-[11px] text-amber-700">当前项目还没有可用于批量验证的模块；最近失败的能力仍可直接批量修复。</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={selectAllVisibleCapabilities}
                  disabled={capabilityCatalogBusy || visibleSelectableCapabilityUids.length === 0}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  全选当前筛选
                </button>
                <button
                  onClick={clearSelectedCapabilities}
                  disabled={capabilityCatalogBusy || selectedCapabilityItems.length === 0}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  清空
                </button>
                <button
                  onClick={() => void verifySelectedCapabilities()}
                  disabled={capabilityCatalogBusy || selectedVerifiableCapabilityItems.length === 0 || !hasCapabilityVerificationModule}
                  className="h-8 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[11px] font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                >
                  {bulkCapabilityAction === 'verify'
                    ? '验证中...'
                    : `批量验证${selectedVerifiableCapabilityItems.length > 0 ? ` (${selectedVerifiableCapabilityItems.length})` : ''}`}
                </button>
                <button
                  onClick={() => void repairSelectedCapabilities()}
                  disabled={capabilityCatalogBusy || selectedRepairableCapabilityItems.length === 0}
                  className="h-8 rounded-lg border border-violet-200 bg-violet-50 px-3 text-[11px] font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
                >
                  {bulkCapabilityAction === 'repair'
                    ? '修复中...'
                    : `批量修复失败项${selectedRepairableCapabilityItems.length > 0 ? ` (${selectedRepairableCapabilityItems.length})` : ''}`}
                </button>
                <button
                  onClick={() => void archiveSelectedCapabilities()}
                  disabled={capabilityCatalogBusy || selectedCapabilityItems.length === 0}
                  className="h-8 rounded-lg border border-amber-200 bg-amber-50 px-3 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                >
                  {bulkCapabilityAction === 'archive'
                    ? '归档中...'
                    : `批量归档${selectedCapabilityItems.length > 0 ? ` (${selectedCapabilityItems.length})` : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}
        {capabilities.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">当前项目还没有稳定能力。</p>
        )}
        {capabilities.length > 0 && capabilityCatalogItems.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">
            没有匹配的稳定能力，试试名称、slug、来源标签、Starter Helper 或验证状态。
          </p>
        )}
        {capabilityCatalogItems.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {capabilityCatalogItems.map((item) => {
              const editing = item.capabilityUid === editingCapabilityUid;
              const archived = item.status === 'archived';
              const selected = selectedCapabilityUidSet.has(item.capabilityUid);
              const selectable = canEditContent && !archived;
              const verification = describeCapabilityVerification(item.meta);
              const origin = describeIntentCapabilityOrigin(item.meta);
              const lastAttempt = getCapabilityLastVerificationAttempt(item.meta);
              const launchPolicy = resolveCapabilityVerificationLaunchPolicy(item.meta);
              const preservedFlow =
                item.capabilityType === 'composite'
                  ? getIntentCapabilityFlowDefinition(item.meta, item.entryUrl)
                  : null;
              const failedVerification = lastAttempt.status === 'failed';
              const sourceDocumentName = documentNameByUid.get(item.sourceDocumentUid) || '';
              const starterHelper = readIntentCapabilityStarterHelper(item.meta);
              const suppressedStarterHistory = starterHelper ? capabilitySuppressedStarterHelperHistoryByHelper.get(starterHelper) : undefined;

              return (
                <div
                  key={item.capabilityUid}
                  className={`rounded-2xl border px-3 py-3 transition ${
                    archived
                      ? 'border-amber-200 bg-amber-50/60'
                      : failedVerification
                        ? 'border-rose-200 bg-rose-50/60'
                        : editing
                          ? 'border-emerald-200 bg-emerald-50/60'
                          : 'border-slate-200 bg-white'
                  } ${selected ? 'ring-2 ring-slate-900/10' : ''}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      {selectable && (
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCapabilitySelection(item.capabilityUid)}
                          disabled={capabilityCatalogBusy}
                          aria-label={`选择能力 ${item.name}`}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 disabled:opacity-50"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${capabilityTypeTone(
                              item.capabilityType
                            )}`}
                          >
                            {capabilityTypeLabel(item.capabilityType)}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${capabilityVerificationTone(
                              item.meta
                            )}`}
                          >
                            {verification.label}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${capabilityOriginTone(
                              origin.kind
                            )}`}
                          >
                            {origin.label}
                          </span>
                          {archived && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                              已归档
                            </span>
                          )}
                        </div>
                        <p className="mt-2 break-words text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="mt-1 break-all text-[11px] text-slate-400">{item.slug}</p>
                      </div>
                    </div>
                    {failedVerification && (
                      <span
                        title={lastAttempt.executionUid ? `最近验证失败：${lastAttempt.executionUid}` : '最近验证失败'}
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200"
                      >
                        !
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-[11px] leading-5 text-slate-600">{excerpt(item.description, 78)}</p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {sourceDocumentName && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        来源 {excerpt(sourceDocumentName, 18)}
                      </span>
                    )}
                    {item.triggerPhrases.length > 0 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        命中词 {item.triggerPhrases.length}
                      </span>
                    )}
                    {starterHelper && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700 ring-1 ring-blue-200">
                        Helper {excerpt(starterHelper, 24)}
                      </span>
                    )}
                    {origin.starterHelperSource && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${starterHelperSourceTone(origin.starterHelperSource)}`}>
                        {starterHelperSourceLabel(origin.starterHelperSource)}
                      </span>
                    )}
                    {origin.starterKnowledgeChangeSignal ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${starterHelperKnowledgeSignalTone(origin.starterKnowledgeChangeSignal)}`}
                      >
                        {starterHelperKnowledgeSignalLabel(origin.starterKnowledgeChangeSignal)}
                      </span>
                    ) : origin.starterKnowledgeChangeTier ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${starterHelperKnowledgeTierTone(
                          origin.starterKnowledgeChangeTier,
                          origin.starterKnowledgeChangeWatchingKind
                        )}`}
                      >
                        {starterHelperKnowledgeTierLabel(origin.starterKnowledgeChangeTier, origin.starterKnowledgeChangeWatchingKind)}
                      </span>
                    ) : null}
                    {origin.starterAssetScopeLabel && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        {origin.starterAssetScopeLabel}
                      </span>
                    )}
                    {origin.starterSupportingRules.length > 0 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        支持规则 {origin.starterSupportingRules.length}
                      </span>
                    )}
                    {item.dependsOn.length > 0 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        依赖 {item.dependsOn.length}
                      </span>
                    )}
                    {preservedFlow?.steps.length ? (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] text-violet-700 ring-1 ring-violet-100">
                        业务流 {preservedFlow.steps.length} 节点
                      </span>
                    ) : null}
                  </div>

                  {origin.kind === 'starter_asset' && (
                    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-[11px] leading-5 text-blue-800">
                      <p className="font-medium">Starter 证据</p>
                      <p className="mt-1">Helper：<span className="font-mono">{starterHelper || '未记录'}</span></p>
                      {origin.starterAssetScopeLabel && (
                        <p className="mt-1">适用范围：{origin.starterAssetScopeLabel}</p>
                      )}
                      {origin.starterKnowledgeChangeSignal ? (
                        <p className="mt-1">
                          长期 evidence：
                          <span className="font-medium">
                            {starterHelperKnowledgeSignalLabel(origin.starterKnowledgeChangeSignal)}
                          </span>
                          {origin.starterKnowledgeChangeDecisionableRuleCount > 0
                            ? `（${origin.starterKnowledgeChangeDecisionableRuleCount} 条已判定规则）`
                            : ''}
                        </p>
                      ) : origin.starterKnowledgeChangeTier ? (
                        <p className="mt-1">
                          长期 evidence：
                          <span className="font-medium">
                            {starterHelperKnowledgeTierLabel(
                              origin.starterKnowledgeChangeTier,
                              origin.starterKnowledgeChangeWatchingKind
                            )}
                          </span>
                          {origin.starterKnowledgeChangeDecisionableRuleCount > 0
                            ? `（${origin.starterKnowledgeChangeDecisionableRuleCount} 条已判定规则）`
                            : ''}
                        </p>
                      ) : null}
                      {origin.starterSupportingRules.length > 0 && (
                        <p className="mt-1">支持规则：{excerpt(origin.starterSupportingRules.join('、'), 56)}</p>
                      )}
                      {origin.starterKnowledgeChangeSignalReason && (
                        <p className="mt-1">
                          {origin.starterKnowledgeChangeTier === 'watching' && !origin.starterKnowledgeChangeSignal
                            ? '观察依据：'
                            : '长期依据：'}
                          {excerpt(origin.starterKnowledgeChangeSignalReason, 96)}
                        </p>
                      )}
                      {origin.starterGovernanceReleaseStatus === 'released_from_suppressed' && origin.starterGovernanceReleaseReason && (
                        <p className="mt-1">
                          治理释放：
                          {excerpt(origin.starterGovernanceReleaseReason, 96)}
                          {origin.starterGovernanceReleaseCapabilityCount > 0
                            ? `（治理目标 ${origin.starterGovernanceReleaseCapabilityCount} 条`
                            : '（'}
                          {origin.starterGovernanceReleaseDirectVerifyPassedCapabilityCount > 0
                            ? `，直接验证通过 ${origin.starterGovernanceReleaseDirectVerifyPassedCapabilityCount} 条`
                            : ''}
                          {origin.starterGovernanceReleaseLatestVerifyExecutionAt
                            ? `，最近验证 ${excerpt(origin.starterGovernanceReleaseLatestVerifyExecutionAt, 24)}`
                            : ''}
                          ）
                        </p>
                      )}
                    </div>
                  )}

                  {suppressedStarterHistory && (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2 text-[11px] leading-5 text-rose-800">
                      <p className="font-medium">Starter 历史风险</p>
                      <p className="mt-1">{excerpt(suppressedStarterHistory.suppressionReason, 108)}</p>
                      <p className="mt-1">
                        支持规则：
                        {excerpt(
                          (
                            suppressedStarterHistory.supportingRuleTitles.length > 0
                              ? suppressedStarterHistory.supportingRuleTitles
                              : suppressedStarterHistory.supportingRuleIds
                          ).join('、'),
                          64
                        )}
                      </p>
                      {suppressedStarterHistory.knowledgeChangeDecisionableRuleCount ? (
                        <p className="mt-1">已判定规则：{suppressedStarterHistory.knowledgeChangeDecisionableRuleCount} 条</p>
                      ) : null}
                      {suppressedStarterHistory.knowledgeChangeSupportingAuditIds?.length ? (
                        <p className="mt-1">支持审计：{excerpt(suppressedStarterHistory.knowledgeChangeSupportingAuditIds.join('、'), 64)}</p>
                      ) : null}
                    </div>
                  )}

                  {canEditContent ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {archived ? (
                        <button
                          aria-label={`恢复能力 ${item.name}`}
                          onClick={() => void restoreCapability(item)}
                          disabled={Boolean(bulkCapabilityAction) || capabilityActioningUid === item.capabilityUid}
                          className="h-7 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                        >
                          恢复
                        </button>
                      ) : (
                        <>
                          <button
                            aria-label={`验证能力 ${item.name}`}
                            onClick={() => void verifyCapability(item)}
                            disabled={Boolean(bulkCapabilityAction) || verifyingCapabilityUid === item.capabilityUid}
                            className="h-7 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                          >
                            {(() => {
                              if (
                                verifyingCapabilityUid === item.capabilityUid &&
                                verifyingCapabilityMode === 'verify'
                              ) {
                                return '验证中...';
                              }
                              if (verification.status === 'execution_verified') return '重新验证';
                              if (launchPolicy.canRepair) return '重新验证';
                              return '验证并升级';
                            })()}
                          </button>
                          {launchPolicy.canRepair && (
                            <button
                              aria-label={`修复能力 ${item.name}`}
                              onClick={() => void repairCapability(item)}
                              disabled={Boolean(bulkCapabilityAction) || verifyingCapabilityUid === item.capabilityUid}
                              className="h-7 rounded-lg border border-violet-200 bg-violet-50 px-2.5 text-[11px] font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
                            >
                              {verifyingCapabilityUid === item.capabilityUid && verifyingCapabilityMode === 'repair'
                                ? '修复中...'
                                : '修复上次失败'}
                            </button>
                          )}
                          <button
                            aria-label={`编辑能力 ${item.name}`}
                            onClick={() => editCapability(item)}
                            disabled={Boolean(bulkCapabilityAction)}
                            className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            编辑
                          </button>
                          <button
                            aria-label={`归档能力 ${item.name}`}
                            onClick={() => void archiveCapability(item)}
                            disabled={Boolean(bulkCapabilityAction) || capabilityActioningUid === item.capabilityUid}
                            className="h-7 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                          >
                            归档
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const recipeWorkbench = (
    <>
      <div className="rounded-[24px] border border-slate-200 bg-white p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">简单需求输入</h3>
            <p className="mt-1 text-xs text-slate-500">这里不需要手工拆业务流步骤，先描述目标、校验点和业务结果即可。</p>

            {(activeDocuments.length === 0 || activeCapabilities.length === 0) && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-700">
                <span>
                  当前项目还缺少{activeDocuments.length === 0 ? '知识文档' : ''}
                  {activeDocuments.length === 0 && activeCapabilities.length === 0 ? '和' : ''}
                  {activeCapabilities.length === 0 ? '稳定能力' : ''}，recipe 会缺少证据或无法补齐依赖。
                </span>
                {canEditContent && (
                  <button
                    onClick={() => setView(activeDocuments.length === 0 ? 'knowledge' : 'capability')}
                    className="h-8 rounded-lg border border-amber-300 bg-white px-3 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100"
                  >
                    {activeDocuments.length === 0 ? '去补知识文档' : '去补稳定能力'}
                  </button>
                )}
              </div>
            )}

            <textarea
              value={requirement}
              onChange={(event) => setRequirement(event.target.value)}
              aria-label="需求描述"
              rows={6}
              placeholder="例如：创建商机并在商机列表按手机号校验落库。"
              className="mt-4 min-h-[188px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="block text-xs font-medium text-slate-600">回填模块</label>
            <select
              value={selectedModuleUid}
              onChange={(event) => setSelectedModuleUid(event.target.value)}
              aria-label="需求回填模块"
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
            >
              <option value="">选择回填模块</option>
              {activeModules.map((item) => (
                <option key={item.moduleUid} value={item.moduleUid}>
                  {item.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => void submitRequirement()}
              disabled={submitting || loadingContext}
              className="mt-3 h-10 w-full rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              {submitting ? '编排中...' : '生成 recipe'}
            </button>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">输入建议</p>
              <div className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                <p>描述业务目标，而不是手工拆步骤。</p>
                <p>补上关键校验点，例如落库、断言、页面结果。</p>
                <p>切到知识文档或稳定能力页时，可以继续补证据和可复用动作。</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">项目级 recipe 资产</h3>
            <p className="mt-1 text-xs text-slate-500">
              这里只展示当前项目新增或覆盖的 recipe，不含内置 recipe。先看 profile、治理建议、最近 backups 和最近 audits，再继续做需求编排。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                profile {projectRecipeProfileItems.length}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                governance {projectRecipeGovernanceItems.length}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                backups {projectRecipeBackupItems.length}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                audits {projectRecipeAuditItems.length}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scopedProjectRecipeProfile?.registryPath ? (
              <span className="max-w-[420px] rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
                registry {excerpt(scopedProjectRecipeProfile.registryPath, 64)}
              </span>
            ) : null}
            <button
              onClick={() => void loadProjectRecipeAssets({ force: true })}
              disabled={projectRecipeAssetsLoading}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              {projectRecipeAssetsLoading ? '刷新中...' : '刷新资产'}
            </button>
          </div>
        </div>

        {projectRecipeAssetsError && !hasScopedProjectRecipeAssets ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] leading-5 text-slate-700">
            {projectRecipeAssetsError}
          </p>
        ) : null}

        {projectRecipeAssetsError && hasScopedProjectRecipeAssets ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[11px] leading-5 text-amber-800">
            刷新失败，当前展示最近一次成功结果：{projectRecipeAssetsError}
          </p>
        ) : null}

        {projectRecipeAssetsLoading && !hasScopedProjectRecipeAssets ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-[11px] text-slate-500">
            正在加载项目级 recipe 资产...
          </div>
        ) : null}

        {!projectRecipeAssetsLoading && hasScopedProjectRecipeAssets ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">当前 Profile</h4>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">当前项目自定义 recipe 清单，用来补充或覆盖内置编排经验。</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
                  {projectRecipeProfileItems.length} 条
                </span>
              </div>
              {scopedProjectRecipeProfile?.registryPath ? (
                <p className="mt-2 break-all text-[11px] leading-5 text-slate-400">
                  {excerpt(scopedProjectRecipeProfile.registryPath, 96)}
                </p>
              ) : null}
              {projectRecipeProfilePreviewItems.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {projectRecipeProfilePreviewItems.map((item) => (
                    <div key={item.slug} className="rounded-xl border border-white/80 bg-white px-3 py-3 text-[11px] leading-5 text-slate-600">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900">{item.title}</p>
                          <p className="mt-1 break-all text-[11px] text-slate-400">{item.slug}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                          {formatPercentLabel(item.successRate)}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">{excerpt(item.description, 88)}</p>
                      <p className="mt-2 text-[11px] text-slate-400">
                        最近验证 {item.lastVerifiedAt ? formatDateTimeLabel(item.lastVerifiedAt) : '未回填'}
                      </p>
                    </div>
                  ))}
                  {projectRecipeProfileItems.length > projectRecipeProfilePreviewItems.length ? (
                    <p className="text-[11px] text-slate-400">
                      另有 {projectRecipeProfileItems.length - projectRecipeProfilePreviewItems.length} 条未展开。
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-[11px] leading-5 text-slate-500">
                  当前项目还没有自定义 recipe；当前编排仍只会依赖内置 recipe 与能力库。
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">治理建议</h4>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">按最近 terminal run 的真实表现，给出最小 promote / degrade / observe 决策。</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
                  待应用 {projectRecipeGovernanceSummary.actionableCount}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] text-slate-500 ring-1 ring-slate-200">
                  提级 {projectRecipeGovernanceSummary.promoteCount}
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] text-slate-500 ring-1 ring-slate-200">
                  降级 {projectRecipeGovernanceSummary.degradeCount}
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] text-slate-500 ring-1 ring-slate-200">
                  观察 {projectRecipeGovernanceSummary.observeCount}
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] text-slate-500 ring-1 ring-slate-200">
                  已同步 {projectRecipeGovernanceSummary.syncedCount}
                </span>
              </div>
              {projectRecipeGovernanceSummary.latestRepairObservationSummary ? (
                <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-[11px] leading-5 text-slate-600">
                  最近 repair 观察：
                  {projectRecipeGovernanceSummary.latestRepairObservationRecipeTitle ||
                  projectRecipeGovernanceSummary.latestRepairObservationRecipeSlug
                    ? ` ${
                        projectRecipeGovernanceSummary.latestRepairObservationRecipeTitle ||
                        projectRecipeGovernanceSummary.latestRepairObservationRecipeSlug
                      } ·`
                    : ''}
                  {` ${projectRecipeGovernanceSummary.latestRepairObservationSummary}`}
                  {projectRecipeGovernanceSummary.latestRepairObservationAt
                    ? ` · ${formatDateTimeLabel(projectRecipeGovernanceSummary.latestRepairObservationAt)}`
                    : ''}
                </p>
              ) : null}
              {projectRecipeGovernanceItems.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {projectRecipeGovernanceItems.map((item) => (
                    <div key={item.slug} className="rounded-xl border border-white/80 bg-white px-3 py-3 text-[11px] leading-5 text-slate-600">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900">{item.title}</p>
                          <p className="mt-1 break-all text-[11px] text-slate-400">{item.slug}</p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${projectRecipeGovernanceStatusClassName(item.status)}`}
                        >
                          {item.statusLabel}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">{excerpt(item.reason, 108)}</p>
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] leading-5 text-slate-600">
                        <p>
                          当前：{formatPercentLabel(item.currentSuccessRate)} ·{' '}
                          {item.currentLastVerifiedAt ? formatDateTimeLabel(item.currentLastVerifiedAt) : '未回填'}
                        </p>
                        <p className="mt-1">
                          runtime：{formatPercentLabel(item.runtimeSuccessRate)} ·{' '}
                          {item.runtimeLastVerifiedAt ? formatDateTimeLabel(item.runtimeLastVerifiedAt) : '暂无 terminal run'}
                        </p>
                        <p className="mt-1">
                          样本：{item.runCount} 次 · 通过 {item.passedRuns} · 失败 {item.failedRuns} · 取消 {item.canceledRuns}
                        </p>
                      </div>
                      {item.canApply && item.recommendedPatch ? (
                        canEditContent ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => void applyProjectRecipeGovernanceDecision(item)}
                              disabled={projectRecipeAssetsLoading || projectRecipeMutationBusy}
                              className="h-7 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                            >
                              {projectRecipeGovernanceApplyingSlug === item.slug ? '应用中...' : '应用建议'}
                            </button>
                          </div>
                        ) : (
                          <p className="mt-3 text-[11px] text-slate-400">当前建议可直接应用，需 owner / editor 执行。</p>
                        )
                      ) : null}
                    </div>
                  ))}
                  {projectRecipeGovernanceSummary.totalProjectRecipes > projectRecipeGovernanceItems.length ? (
                    <p className="text-[11px] text-slate-400">
                      按优先级仅展示前 {projectRecipeGovernanceItems.length} 条，另有{' '}
                      {projectRecipeGovernanceSummary.totalProjectRecipes - projectRecipeGovernanceItems.length} 条未展示。
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-[11px] leading-5 text-slate-500">
                  当前还没有可展示的 recipe 治理建议；若项目 profile 为空，或最近 terminal run 还未命中项目 recipe，就会保持空白。
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">最近 Backups</h4>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">查看最近 recipe profile 备份，确认落盘与回滚点是否正常生成。</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
                  {projectRecipeBackupItems.length} 条
                </span>
              </div>
              {scopedProjectRecipeBackups?.backupDir ? (
                <p className="mt-2 break-all text-[11px] leading-5 text-slate-400">
                  {excerpt(scopedProjectRecipeBackups.backupDir, 96)}
                </p>
              ) : null}
              {projectRecipeBackupPreviewItems.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {projectRecipeBackupPreviewItems.map((item) => (
                    <div key={item.path} className="rounded-xl border border-white/80 bg-white px-3 py-3 text-[11px] leading-5 text-slate-600">
                      <p className="font-medium text-slate-900">{item.fileName}</p>
                      <p className="mt-1 break-all text-[11px] text-slate-400">{excerpt(item.path, 92)}</p>
                      <p className="mt-2 text-[11px] text-slate-500">
                        {formatDateTimeLabel(item.createdAt)} · {formatFileSizeLabel(item.sizeBytes)}
                      </p>
                      {canEditContent ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => void restoreProjectRecipeBackup(item)}
                            disabled={projectRecipeAssetsLoading || projectRecipeMutationBusy}
                            className="h-7 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                          >
                            {projectRecipeRestoringPath === item.path ? '恢复中...' : '恢复此备份'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {projectRecipeBackupItems.length > projectRecipeBackupPreviewItems.length ? (
                    <p className="text-[11px] text-slate-400">
                      另有 {projectRecipeBackupItems.length - projectRecipeBackupPreviewItems.length} 条未展开。
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-[11px] leading-5 text-slate-500">
                  当前还没有可展示的 recipe 备份记录。
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">最近 Audits</h4>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">查看 register / merge / update / restore 最近变更，确认治理链路已留痕。</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
                  {projectRecipeAuditItems.length} 条
                </span>
              </div>
              {scopedProjectRecipeAudits?.auditLogPath ? (
                <p className="mt-2 break-all text-[11px] leading-5 text-slate-400">
                  {excerpt(scopedProjectRecipeAudits.auditLogPath, 96)}
                </p>
              ) : null}
              {projectRecipeAuditPreviewItems.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {projectRecipeAuditPreviewItems.map((item) => {
                    const expanded = expandedProjectRecipeAuditIds.includes(item.auditId);
                    return (
                      <div key={item.auditId} className="rounded-xl border border-white/80 bg-white px-3 py-3 text-[11px] leading-5 text-slate-600">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                            {projectRecipeAuditOperationLabel(item.operation)}
                          </span>
                          <span className="text-[10px] text-slate-400">{formatDateTimeLabel(item.occurredAt)}</span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-900">{excerpt(item.title, 54)}</p>
                        <p className="mt-1 text-[11px] leading-5 text-slate-500">{excerpt(item.detail, 108)}</p>
                        <p className="mt-2 text-[11px] text-slate-400">操作者 {item.actorLabel || 'system'}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => toggleProjectRecipeAuditDrillDown(item.auditId)}
                            className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-600 transition hover:bg-slate-50"
                          >
                            {expanded ? '收起细节' : '展开细节'}
                          </button>
                        </div>
                        {expanded ? (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] leading-5 text-slate-600">
                            <p>
                              recipes：{item.comparison.beforeRecipeCount} <span className="text-slate-400">→</span>{' '}
                              {item.comparison.afterRecipeCount}
                            </p>
                            <p className="mt-1 break-all">writtenTo：{item.writtenTo}</p>
                            <p className="mt-1 break-all">backupPath：{item.backupPath || '无'}</p>
                            <p className="mt-2">新增：{formatProjectRecipeChangeList(item.comparison.addedRecipeSlugs)}</p>
                            <p className="mt-1">移除：{formatProjectRecipeChangeList(item.comparison.removedRecipeSlugs || [])}</p>
                            <p className="mt-1">更新：{formatProjectRecipeChangeList(item.comparison.updatedRecipeSlugs)}</p>
                            <p className="mt-1">跳过：{formatProjectRecipeChangeList(item.comparison.skippedRecipeSlugs)}</p>
                            <p className="mt-2 break-all text-slate-400">auditId：{item.auditId}</p>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {projectRecipeAuditItems.length > projectRecipeAuditPreviewItems.length ? (
                    <p className="text-[11px] text-slate-400">
                      另有 {projectRecipeAuditItems.length - projectRecipeAuditPreviewItems.length} 条未展开。
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-[11px] leading-5 text-slate-500">
                  当前还没有可展示的 recipe 审计记录。
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {effectiveRecipe ? (
        <div className="rounded-[24px] border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">编排结果</h3>
              <p className="mt-1 text-xs text-slate-500">
                当前返回 {availableRecipeCapabilityCount} 个可选能力，你可以按需勾选，下面的执行步骤、覆盖率和任务草稿会实时更新。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                  已选能力 {matchedCapabilityCount}/{availableRecipeCapabilityCount}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                  执行步骤 {effectiveRecipe.executionRecipe.steps.length}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                  覆盖 {coveredRequirementCount}/{totalRequirementCount}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">断言 {effectiveRecipe.executionRecipe.assertions.length}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {availableRecipeCapabilityCount > 0 && selectedRecipeCapabilitySlugs.length !== availableRecipeCapabilityCount && (
                <button
                  onClick={resetRecipeCapabilitySelection}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600 transition hover:bg-slate-50"
                >
                  还原推荐
                </button>
              )}
              <button
                onClick={applyTaskDraft}
                disabled={!canEditContent || Boolean(creationBlockedReason) || Boolean(coverageBlockedReason) || !selectedModuleUid}
                className="h-10 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                写入任务草稿
              </button>
            </div>
          </div>

          {availableRecipeCapabilityCount > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">能力选择</h4>
                  <p className="mt-1 text-xs text-slate-500">取消重复语义能力后，下方编排结果会自动收敛；重新勾选业务能力时会自动补回它依赖的前置能力。</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
                  已选 {matchedCapabilityCount} / {availableRecipeCapabilityCount}
                </span>
              </div>

              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {baseRecipe?.matchedCapabilities.map((item) => {
                  const checked = selectedRecipeCapabilitySlugSet.has(item.slug);
                  const dependentCount = recipeCapabilityDependents.get(item.slug)?.length || 0;
                  return (
                    <label
                      key={item.slug}
                      className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-3 transition ${
                        checked ? 'border-slate-900 bg-white shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRecipeCapabilitySelection(item.slug)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${capabilityTypeTone(
                              item.capabilityType
                            )}`}
                          >
                            {capabilityTypeLabel(item.capabilityType)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">score {item.score}</span>
                          {item.dependsOn.length > 0 && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">依赖 {item.dependsOn.length}</span>
                          )}
                          {dependentCount > 0 && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">被依赖 {dependentCount}</span>
                          )}
                        </div>
                        <p className={`mt-1 text-sm font-medium ${checked ? 'text-slate-900' : 'text-slate-600'}`}>{item.name}</p>
                        <p className="mt-1 break-all text-[11px] text-slate-400">{item.slug}</p>
                        {item.matchedPhrases.length > 0 && (
                          <p className="mt-1 text-[11px] leading-5 text-slate-500">命中：{item.matchedPhrases.join('、')}</p>
                        )}
                        {item.suggestedSteps.length > 0 && (
                          <p className="mt-1 text-[11px] leading-5 text-slate-500">{excerpt(item.suggestedSteps.join('；'), 90)}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {coverageBlockedReason && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{coverageBlockedReason}</div>
          )}
          {creationBlockedReason && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{creationBlockedReason}</div>
          )}

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(280px,0.82fr)]">
            <div className="space-y-3">
              {effectiveRecipe.executionRecipe.steps.map((step, index) => (
                <div key={`${step.capabilitySlug}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[10px] font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{step.capabilityName}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">{step.reason}</p>
                  {step.preconditions.length > 0 && <p className="mt-2 text-xs text-slate-500">前置：{step.preconditions.join('；')}</p>}
                  <ol className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                    {step.actions.map((action, actionIndex) => (
                      <li key={`${step.capabilitySlug}-${actionIndex}`} className="flex gap-2">
                        <span className="min-w-4 text-slate-400">{actionIndex + 1}.</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">需求覆盖</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {effectiveRecipe.requirementCoverage.clauses.map((item) => (
                    <span
                      key={item.text}
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
                        item.covered
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-rose-50 text-rose-700 ring-rose-200'
                      }`}
                    >
                      {item.covered ? '已覆盖' : '未覆盖'} · {item.text}
                    </span>
                  ))}
                </div>
                {coverageBlockedReason && (
                  <p className="mt-2 text-xs leading-5 text-rose-600">
                    未覆盖片段不会自动写入任务草稿，避免生成看上去完整、实际缺步骤的业务流。
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">关键断言</h4>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                  {effectiveRecipe.executionRecipe.assertions.length === 0 && <li>当前 recipe 还没有稳定断言。</li>}
                  {effectiveRecipe.executionRecipe.assertions.map((item, index) => (
                    <li key={`assertion-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">沉淀为项目 Recipe</h4>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">
                      把当前编排结果沉成项目级 recipe。保存时会自动派生 matcher、helper、执行计划和 verifier 计划。
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] ring-1 ${
                      existingProjectRecipe
                        ? 'bg-amber-50 text-amber-700 ring-amber-200'
                        : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    }`}
                  >
                    {existingProjectRecipe ? '更新现有 recipe' : '注册新 recipe'}
                  </span>
                </div>

                {recipeWorkbenchPayloadPreview ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
                      能力 {recipeWorkbenchPayloadPreview.matchers.capabilitySlugs?.length || 0}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
                      helper {recipeWorkbenchPayloadPreview.matchers.preferredHelpers?.length || 0}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
                      URL {recipeWorkbenchPayloadPreview.matchers.targetUrlIncludes?.length || 0}
                    </span>
                  </div>
                ) : null}

                {existingProjectRecipe ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[11px] leading-5 text-amber-800">
                    <p>当前 slug 已存在：{existingProjectRecipe.title}</p>
                    <p className="mt-1">本次会走 `update` merge，只追加/更新字段，不做整条覆盖删除。</p>
                    <p className="mt-1">
                      最近验证：{existingProjectRecipe.lastVerifiedAt ? formatDateTimeLabel(existingProjectRecipe.lastVerifiedAt) : '未回填'} · 成功率{' '}
                      {formatPercentLabel(existingProjectRecipe.successRate)}
                    </p>
                  </div>
                ) : null}

                {!canEditContent ? (
                  <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-[11px] leading-5 text-slate-500">
                    当前只有查看权限，不能沉淀项目 recipe。
                  </p>
                ) : (
                  <>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500">Slug</label>
                        <input
                          value={recipeWorkbenchForm.slug}
                          onChange={(event) => setRecipeWorkbenchForm((current) => ({ ...current, slug: event.target.value }))}
                          onBlur={() =>
                            setRecipeWorkbenchForm((current) => ({
                              ...current,
                              slug: normalizeIntentProjectRecipeWorkbenchSlug(current.slug),
                            }))
                          }
                          placeholder="custom.business-create-list"
                          className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500">标题</label>
                        <input
                          value={recipeWorkbenchForm.title}
                          onChange={(event) => setRecipeWorkbenchForm((current) => ({ ...current, title: event.target.value }))}
                          placeholder="创建商机列表回查"
                          className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500">描述</label>
                        <textarea
                          value={recipeWorkbenchForm.description}
                          onChange={(event) => setRecipeWorkbenchForm((current) => ({ ...current, description: event.target.value }))}
                          rows={3}
                          placeholder="说明这条项目 recipe 适合覆盖什么业务流。"
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700 outline-none transition focus:border-slate-400"
                        />
                      </div>
                    </div>

                    {!scopedProjectRecipeProfile ? (
                      <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-[11px] leading-5 text-slate-500">
                        {projectRecipeAssetsLoading ? '项目 recipe 资产加载中，稍后可保存。' : '项目 recipe profile 未加载成功，当前不允许提交写入。'}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        onClick={resetRecipeWorkbenchFormFromCurrentRecipe}
                        disabled={projectRecipeMutationBusy}
                        className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100"
                      >
                        重置草稿
                      </button>
                      <button
                        onClick={() => void saveProjectRecipeAsset()}
                        disabled={!canPersistProjectRecipe || !recipeWorkbenchPayloadPreview}
                        className="h-8 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {projectRecipeSaving
                          ? '保存中...'
                          : existingProjectRecipe
                            ? '更新现有 recipe'
                            : '注册项目 recipe'}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {draftPreview && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">任务草稿预览</h4>
                  <div className="mt-2 space-y-2 text-xs text-slate-600">
                    <p>
                      <span className="text-slate-400">名称：</span>
                      {draftPreview.name}
                    </p>
                    <p>
                      <span className="text-slate-400">入口：</span>
                      {draftPreview.targetUrl || '未命中 URL'}
                    </p>
                    <p>
                      <span className="text-slate-400">步骤：</span>
                      {draftPreview.flowDefinition.steps.length} 个
                    </p>
                    <p>
                      <span className="text-slate-400">共享变量：</span>
                      {draftPreview.flowDefinition.sharedVariables.join('、') || '无'}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">手册证据</h4>
                <div className="mt-2 space-y-2">
                  {effectiveRecipe.supportingKnowledge.length === 0 && (
                    <p className="text-xs text-slate-400">当前需求还没有明显的手册证据命中。</p>
                  )}
                  {effectiveRecipe.supportingKnowledge.map((item, index) => (
                    <div key={`${item.heading}-${index}`} className="rounded-xl bg-white px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-700">{item.heading}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">score {item.score}</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">{excerpt(item.excerpt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">还没有生成 recipe</p>
          <p className="mt-1 text-xs text-slate-400">先输入一句需求，再点击“生成 recipe”。</p>
        </div>
      )}
    </>
  );

  const knowledgeImportPanel = (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">导入知识文档</h3>
          <p className="mt-1 text-xs text-slate-500">同名文档会整篇替换并重新切块。</p>
        </div>
        <button
          onClick={() => setKnowledgeForm(createDefaultKnowledgeForm())}
          className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-600 transition hover:bg-slate-50"
        >
          清空
        </button>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="grid gap-4 md:grid-cols-[1fr_160px]">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">文档名称</label>
            <input
              value={knowledgeForm.name}
              onChange={(event) => setKnowledgeForm((current) => ({ ...current, name: event.target.value }))}
              disabled={!canEditContent}
              aria-label="知识文档名称"
              placeholder="例如：GBS 管帮手 PC 端操作手册"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">来源类型</label>
            <select
              value={knowledgeForm.sourceType}
              onChange={(event) =>
                setKnowledgeForm((current) => ({
                  ...current,
                  sourceType: event.target.value as KnowledgeSourceType,
                }))
              }
              disabled={!canEditContent}
              aria-label="知识来源类型"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="manual">手册</option>
              <option value="notes">笔记</option>
              <option value="execution">执行沉淀</option>
              <option value="system">系统</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] leading-5 text-slate-500">
          {sourceTypeVerificationHint(knowledgeForm.sourceType)}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">来源路径 / 备注</label>
          <input
            value={knowledgeForm.sourcePath}
            onChange={(event) => setKnowledgeForm((current) => ({ ...current, sourcePath: event.target.value }))}
            disabled={!canEditContent}
            aria-label="知识来源路径"
            placeholder="例如：docs/gbs-manual-v3.pdf"
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">知识内容</label>
          <textarea
            value={knowledgeForm.content}
            onChange={(event) => setKnowledgeForm((current) => ({ ...current, content: event.target.value }))}
            disabled={!canEditContent}
            aria-label="知识文档内容"
            rows={12}
            placeholder="粘贴手册正文、页面规则、执行结论等。"
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => void submitKnowledgeDocument()}
            disabled={knowledgeSaving || !canEditContent}
            className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {knowledgeSaving ? '导入中...' : '导入知识'}
          </button>
        </div>
      </div>
    </div>
  );

  const capabilityEditorPanel = (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{editingCapabilityUid ? '编辑稳定能力' : '维护稳定能力'}</h3>
          <p className="mt-1 text-xs text-slate-500">按分组展开填写，默认先展示基础信息。</p>
        </div>
        <button
          onClick={resetCapabilityForm}
          className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-600 transition hover:bg-slate-50"
        >
          {editingCapabilityUid ? '新建空白' : '清空'}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <button
            type="button"
            aria-expanded={capabilitySections.basic}
            onClick={() => toggleCapabilitySection('basic')}
            className="flex w-full items-center justify-between bg-slate-50/80 px-4 py-3 text-left transition hover:bg-slate-100"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">基础信息</p>
              <p className="mt-1 text-[11px] text-slate-500">slug、名称、入口地址、描述和来源文档。</p>
            </div>
            <span className="text-[11px] text-slate-400">{capabilitySections.basic ? '收起' : '展开'}</span>
          </button>
          {capabilitySections.basic && (
            <div className="border-t border-slate-200 px-4 py-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_140px]">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">能力标识</label>
                  <input
                    value={capabilityForm.slug}
                    onChange={(event) => setCapabilityForm((current) => ({ ...current, slug: event.target.value }))}
                    disabled={!canEditContent}
                    aria-label="能力标识"
                    placeholder="例如：business.list-search-by-phone"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">能力类型</label>
                  <select
                    value={capabilityForm.capabilityType}
                    onChange={(event) =>
                      setCapabilityForm((current) => ({
                        ...current,
                        capabilityType: event.target.value as CapabilityType,
                      }))
                    }
                    disabled={!canEditContent}
                    aria-label="能力类型"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="auth">登录</option>
                    <option value="navigation">导航</option>
                    <option value="action">动作</option>
                    <option value="query">查询</option>
                    <option value="assertion">断言</option>
                    <option value="composite">复合</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_120px]">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">能力名称</label>
                  <input
                    value={capabilityForm.name}
                    onChange={(event) => setCapabilityForm((current) => ({ ...current, name: event.target.value }))}
                    disabled={!canEditContent}
                    aria-label="能力名称"
                    placeholder="例如：商机列表按手机号检索"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">排序</label>
                  <input
                    type="number"
                    value={capabilityForm.sortOrder}
                    onChange={(event) =>
                      setCapabilityForm((current) => ({
                        ...current,
                        sortOrder: toSafeSortOrder(event.target.value),
                      }))
                    }
                    disabled={!canEditContent}
                    aria-label="能力排序"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-slate-600">能力入口地址</label>
                <input
                  value={capabilityForm.entryUrl}
                  onChange={(event) => setCapabilityForm((current) => ({ ...current, entryUrl: event.target.value }))}
                  disabled={!canEditContent}
                  aria-label="能力入口地址"
                  placeholder="例如：https://uat.example.com/#/business/list"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-slate-600">能力描述</label>
                <textarea
                  value={capabilityForm.description}
                  onChange={(event) => setCapabilityForm((current) => ({ ...current, description: event.target.value }))}
                  disabled={!canEditContent}
                  aria-label="能力描述"
                  rows={3}
                  placeholder="说明这个能力稳定完成什么、适用于什么场景。"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-slate-600">来源文档</label>
                <select
                  value={capabilityForm.sourceDocumentUid}
                  onChange={(event) => setCapabilityForm((current) => ({ ...current, sourceDocumentUid: event.target.value }))}
                  disabled={!canEditContent}
                  aria-label="能力来源文档"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">不关联知识文档</option>
                  {documents.map((item) => (
                    <option key={item.documentUid} value={item.documentUid}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <button
            type="button"
            aria-expanded={capabilitySections.matching}
            onClick={() => toggleCapabilitySection('matching')}
            className="flex w-full items-center justify-between bg-slate-50/80 px-4 py-3 text-left transition hover:bg-slate-100"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">命中与前置</p>
              <p className="mt-1 text-[11px] text-slate-500">触发短语和前置条件。</p>
            </div>
            <span className="text-[11px] text-slate-400">{capabilitySections.matching ? '收起' : '展开'}</span>
          </button>
          {capabilitySections.matching && (
            <div className="grid gap-4 border-t border-slate-200 px-4 py-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">触发短语</label>
                <textarea
                  value={capabilityForm.triggerPhrases}
                  onChange={(event) => setCapabilityForm((current) => ({ ...current, triggerPhrases: event.target.value }))}
                  disabled={!canEditContent}
                  aria-label="能力触发短语"
                  rows={4}
                  placeholder={'每行一个\n例如：创建商机'}
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">前置条件</label>
                <textarea
                  value={capabilityForm.preconditions}
                  onChange={(event) => setCapabilityForm((current) => ({ ...current, preconditions: event.target.value }))}
                  disabled={!canEditContent}
                  aria-label="能力前置条件"
                  rows={4}
                  placeholder={'每行一个\n例如：已登录'}
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <button
            type="button"
            aria-expanded={capabilitySections.execution}
            onClick={() => toggleCapabilitySection('execution')}
            className="flex w-full items-center justify-between bg-slate-50/80 px-4 py-3 text-left transition hover:bg-slate-100"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">动作与断言</p>
              <p className="mt-1 text-[11px] text-slate-500">步骤、断言和复合业务流节点。</p>
            </div>
            <span className="text-[11px] text-slate-400">{capabilitySections.execution ? '收起' : '展开'}</span>
          </button>
          {capabilitySections.execution && (
            <div className="border-t border-slate-200 px-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{capabilityFlowPreview ? '动作步骤摘要' : '动作步骤'}</label>
                  <textarea
                    value={capabilityForm.steps}
                    onChange={(event) => setCapabilityForm((current) => ({ ...current, steps: event.target.value }))}
                    disabled={!canEditContent}
                    aria-label="能力动作步骤"
                    rows={5}
                    placeholder={'每行一个\n例如：输入手机号并搜索'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">断言结果</label>
                  <textarea
                    value={capabilityForm.assertions}
                    onChange={(event) => setCapabilityForm((current) => ({ ...current, assertions: event.target.value }))}
                    disabled={!canEditContent}
                    aria-label="能力断言结果"
                    rows={5}
                    placeholder={'每行一个\n例如：列表展示匹配手机号'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
              </div>

              {capabilityFlowPreview?.steps.length ? (
                <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-violet-800">复合业务流节点</p>
                      <p className="mt-1 text-[11px] leading-5 text-violet-700">
                        该能力保留了原始业务流节点结构。后续“验证能力”会优先按这些节点逐步执行，不再把整条链路压成一个动作框。
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-200">
                      {capabilityFlowPreview.steps.length} 个节点
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {capabilityFlowPreview.steps.map((step, index) => (
                      <div key={step.stepUid || `capability-flow-${index}`} className="rounded-lg border border-violet-100 bg-white/80 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-violet-800">
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-100 px-1.5 font-semibold text-violet-700">
                            {index + 1}
                          </span>
                          <span className="font-medium">{step.title || `步骤 ${index + 1}`}</span>
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] text-violet-700 ring-1 ring-violet-100">
                            {step.stepType}
                          </span>
                        </div>
                        {step.target && <p className="mt-1 text-[11px] text-violet-700">目标：{step.target}</p>}
                        {step.instruction && <p className="mt-1 text-[11px] leading-5 text-violet-700">动作：{step.instruction}</p>}
                        {step.expectedResult && <p className="mt-1 text-[11px] leading-5 text-violet-700">预期：{step.expectedResult}</p>}
                        {step.extractVariable && <p className="mt-1 text-[11px] text-violet-700">变量：{step.extractVariable}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <button
            type="button"
            aria-expanded={capabilitySections.cleanup}
            onClick={() => toggleCapabilitySection('cleanup')}
            className="flex w-full items-center justify-between bg-slate-50/80 px-4 py-3 text-left transition hover:bg-slate-100"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">清理与依赖</p>
              <p className="mt-1 text-[11px] text-slate-500">收尾说明和依赖能力。</p>
            </div>
            <span className="text-[11px] text-slate-400">{capabilitySections.cleanup ? '收起' : '展开'}</span>
          </button>
          {capabilitySections.cleanup && (
            <div className="grid gap-4 border-t border-slate-200 px-4 py-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">清理说明</label>
                <textarea
                  value={capabilityForm.cleanupNotes}
                  onChange={(event) => setCapabilityForm((current) => ({ ...current, cleanupNotes: event.target.value }))}
                  disabled={!canEditContent}
                  aria-label="能力清理说明"
                  rows={4}
                  placeholder="例如：记录商机 ID 供人工清理"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">依赖能力 slug</label>
                <textarea
                  value={capabilityForm.dependsOn}
                  onChange={(event) => setCapabilityForm((current) => ({ ...current, dependsOn: event.target.value }))}
                  disabled={!canEditContent}
                  aria-label="能力依赖标识"
                  rows={4}
                  placeholder={'每行一个\n例如：auth.sms-password-login'}
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={closeCapabilityModal}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={() => void submitCapability()}
            disabled={capabilitySaving || !canEditContent}
            className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {capabilitySaving ? '保存中...' : editingCapabilityUid ? '更新能力' : '保存能力'}
          </button>
        </div>
      </div>
    </div>
  );

  const documentPreviewPanel = (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">文档块预览</h3>
          <p className="mt-1 text-xs text-slate-500">
            {selectedDocumentUid ? `当前预览：${documentNameByUid.get(selectedDocumentUid) || '未知文档'}` : '从知识目录选择一篇文档查看切块效果。'}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            手册或笔记沉淀后默认标记为“知识提炼”；执行沉淀文档会直接产出“执行验证”能力。
          </p>
        </div>
        {selectedDocumentUid && canEditContent && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => void deriveCapabilitiesFromKnowledge(selectedDocumentUid)}
              disabled={derivingKnowledgeTarget === selectedDocumentUid}
              className="h-8 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              {derivingKnowledgeTarget === selectedDocumentUid ? '沉淀中...' : '自动沉淀能力'}
            </button>
            <button
              onClick={() => openCreateCapabilityModal(selectedDocumentUid)}
              className="h-8 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[11px] font-medium text-blue-700 transition hover:bg-blue-100"
            >
              设为能力来源
            </button>
          </div>
        )}
      </div>

      {selectedDocumentUid && (
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">搜索文档块</label>
            <input
              value={documentPreviewSearch}
              onChange={(event) => setDocumentPreviewSearch(event.target.value)}
              aria-label="搜索文档块"
              placeholder="搜索标题、内容、关键词"
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-slate-400"
            />
          </div>
          {!loadingDocumentPreview && documentPreviewChunks.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500">
              {filteredDocumentPreviewChunks.length} / {documentPreviewChunks.length} 块
            </span>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {loadingDocumentPreview && <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">加载文档预览中...</p>}
        {!loadingDocumentPreview && !selectedDocumentUid && (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">选择文档后，这里会展示切块后的 heading、内容摘要和关键词。</p>
        )}
        {!loadingDocumentPreview && selectedDocumentUid && documentPreviewChunks.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">这篇文档当前没有可展示的知识块。</p>
        )}
        {!loadingDocumentPreview &&
          selectedDocumentUid &&
          documentPreviewChunks.length > 0 &&
          filteredDocumentPreviewChunks.length === 0 && (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">没有匹配的文档块，试试标题、正文关键词或业务名词。</p>
          )}
        {filteredDocumentPreviewChunks.map((item) => (
          <div key={item.chunkUid} className="rounded-xl border border-slate-200 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">#{item.sortOrder}</span>
                <span className="text-sm font-medium text-slate-800">{item.heading}</span>
              </div>
              <div className="flex items-center gap-2">
                {canEditContent && (
                  <button
                    onClick={() => void deriveCapabilitiesFromKnowledge(item.documentUid, item.chunkUid)}
                    disabled={derivingKnowledgeTarget === `${item.documentUid}:${item.chunkUid}`}
                    className="h-7 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {derivingKnowledgeTarget === `${item.documentUid}:${item.chunkUid}` ? '沉淀中...' : '生成能力'}
                  </button>
                )}
                <span className="text-[11px] text-slate-400">
                  {item.sourceLineStart > 0 && item.sourceLineEnd > 0 ? `L${item.sourceLineStart}-${item.sourceLineEnd}` : `${item.tokenEstimate} tokens`}
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">{excerpt(item.content, 260)}</p>
            {item.keywords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.keywords.map((keyword) => (
                  <span key={`${item.chunkUid}-${keyword}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const knowledgeWorkbench = (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)]">
      <div className="space-y-4">
        {knowledgeImportPanel}
        {documentPreviewPanel}
      </div>
      <div className="space-y-4">
        {knowledgeCatalogPanel}
      </div>
    </div>
  );

  const capabilityModal = capabilityModalOpen ? (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{editingCapabilityUid ? '编辑稳定能力' : '新增稳定能力'}</h3>
            <p className="mt-1 text-[11px] text-slate-500">表单维护改为弹框操作，目录页只保留能力摘要。</p>
          </div>
          <button
            onClick={closeCapabilityModal}
            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-600 transition hover:bg-slate-50"
          >
            关闭
          </button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto p-4">
          {capabilityEditorPanel}
        </div>
      </div>
    </div>
  ) : null;

  const capabilityWorkbench = (
    <div className="space-y-4">
      {capabilityCatalogPanel}
      {capabilityModal}
    </div>
  );

  const capabilityVerificationBatchPanel =
    capabilityVerificationBatches.length > 0 ? (
      <div className="rounded-[24px] border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">能力验证批次</h3>
            <p className="mt-1 text-[11px] leading-5 text-slate-400">启动后会自动轮询执行状态，并在 capability `meta` 回写完成后刷新目录。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void refreshCapabilityVerificationBatches()}
              disabled={activeCapabilityVerificationBatchCount === 0}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              刷新结果
            </button>
            {completedCapabilityVerificationBatchCount > 0 && (
              <button
                onClick={clearCompletedCapabilityVerificationBatches}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
              >
                清空已完成
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {capabilityVerificationBatches.map((batch) => {
            const queuedCount = batch.items.filter((item) => item.status === 'queued').length;
            const runningCount = batch.items.filter((item) => item.status === 'running').length;
            const passedCount = batch.items.filter((item) => item.status === 'passed').length;
            const failedCount = batch.items.filter((item) => item.status === 'failed' || item.status === 'canceled').length;
            const syncedCount = batch.items.filter((item) => item.synced).length;
            const pendingSyncCount = batch.items.filter((item) => isTerminalExecutionStatus(item.status) && !item.synced).length;
            const active = !batch.completedAt;
            const batchKind = describeCapabilityVerificationBatchKind({
              mode: batch.mode,
              verificationIntent: batch.verificationIntent,
            });

            return (
              <div
                key={batch.batchUid}
                className={`rounded-2xl border px-3 py-3 ${
                  active ? 'border-sky-200 bg-sky-50/50' : 'border-slate-200 bg-slate-50/80'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{batch.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                          active
                            ? 'bg-sky-100 text-sky-700 ring-sky-200'
                            : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        }`}
                      >
                        {active ? '监控中' : '已完成'}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${batchKind.className}`}>
                        {batchKind.label}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      启动于 {formatDateTimeLabel(batch.startedAt)}
                      {batch.moduleName ? ` · 模块 ${batch.moduleName}` : ''}
                      {batch.lastCheckedAt ? ` · 最近检查 ${formatDateTimeLabel(batch.lastCheckedAt)}` : ''}
                    </p>
                    {batch.refreshError && (
                      <p className="mt-1 text-[11px] text-rose-700">自动刷新失败：{batch.refreshError}</p>
                    )}
                  </div>
                  {batch.completedAt && (
                    <button
                      onClick={() => dismissCapabilityVerificationBatch(batch.batchUid)}
                      className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-600 transition hover:bg-slate-50"
                    >
                      关闭批次
                    </button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-600 ring-1 ring-slate-200">
                    共 {batch.items.length} 条
                  </span>
                  {queuedCount > 0 && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 ring-1 ring-slate-200">
                      排队中 {queuedCount}
                    </span>
                  )}
                  {runningCount > 0 && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 ring-1 ring-amber-200">
                      执行中 {runningCount}
                    </span>
                  )}
                  {passedCount > 0 && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 ring-1 ring-emerald-200">
                      已通过 {passedCount}
                    </span>
                  )}
                  {failedCount > 0 && (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700 ring-1 ring-rose-200">
                      未通过 {failedCount}
                    </span>
                  )}
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-600 ring-1 ring-slate-200">
                    目录已回写 {syncedCount}
                  </span>
                  {pendingSyncCount > 0 && (
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700 ring-1 ring-sky-200">
                      等待回写 {pendingSyncCount}
                    </span>
                  )}
                </div>

                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {batch.items.map((item) => {
                    const outcome = describeExecutionOutcome({
                      status: item.status,
                      resultSummary: item.resultSummary,
                      errorMessage: item.errorMessage,
                    });
                    const navigation = readExecutionEntryNavigationTargets(item);
                    const outcomeToneClass =
                      outcome.tone === 'emerald'
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : outcome.tone === 'amber'
                          ? 'bg-amber-50 text-amber-700 ring-amber-200'
                          : outcome.tone === 'rose'
                            ? 'bg-rose-50 text-rose-700 ring-rose-200'
                            : 'bg-slate-100 text-slate-600 ring-slate-200';

                    return (
                      <div key={`${batch.batchUid}-${item.executionUid}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900">{item.capabilityName}</p>
                            <p className="mt-1 break-all text-[11px] text-slate-400">{item.executionUid}</p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${outcomeToneClass}`}>
                              {outcome.shortLabel}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                                item.synced
                                  ? item.status === 'passed'
                                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                    : 'bg-slate-100 text-slate-600 ring-slate-200'
                                  : 'bg-sky-50 text-sky-700 ring-sky-200'
                              }`}
                            >
                              {describeCapabilityVerificationSyncLabel({
                                mode: item.mode,
                                verificationIntent: item.verificationIntent,
                                status: item.status,
                                synced: item.synced,
                              })}
                            </span>
                          </div>
                        </div>
                        <p className="mt-2 text-[11px] leading-5 text-slate-600">
                          {excerpt(item.errorMessage || item.resultSummary || outcome.summary, 88)}
                        </p>
                        {item.latestRepairObservationSummary ? (
                          <p className="mt-1 text-[11px] leading-5 text-slate-500">
                            最近关联 verifier observation：
                            {` ${item.latestRepairObservationSummary}`}
                            {item.latestRepairObservationVerifierCheckUids.length > 0
                              ? ` · verifier ${summarizeShortTextList(item.latestRepairObservationVerifierCheckUids, 2)}`
                              : ''}
                            {item.latestRepairObservationAt ? ` · ${formatDateTimeLabel(item.latestRepairObservationAt)}` : ''}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {navigation.runPath && (
                            <button
                              onClick={() => openCapabilityVerificationRun(item)}
                              className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-600 transition hover:bg-slate-50"
                            >
                              打开运行
                            </button>
                          )}
                          {navigation.workspacePath && (
                            <button
                              onClick={() => openCapabilityVerificationWorkspace(item, 'workspace')}
                              className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-600 transition hover:bg-slate-50"
                            >
                              打开工作台
                            </button>
                          )}
                          {navigation.hasWorkspaceHistoryPath && (
                            <button
                              onClick={() => openCapabilityVerificationWorkspace(item, 'workspaceHistory')}
                              className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-600 transition hover:bg-slate-50"
                            >
                              执行历史
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <>
      {!hideTrigger && (
        <button
          onClick={openWorkbench}
          className="h-8 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
        >
          需求编排
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-[1460px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.28)]">
            <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.28),transparent_34%),linear-gradient(135deg,#020617_0%,#0f172a_52%,#172554_100%)] px-6 py-5 text-white">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-sky-200/90">Intent Orchestration</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">需求编排工作台</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-200/85">一句需求生成 recipe，再按需切到知识文档和稳定能力页补齐证据与复用动作。</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void loadContext()}
                    disabled={loadingContext}
                    className="h-9 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
                  >
                    {loadingContext ? '刷新中...' : '刷新上下文'}
                  </button>
                  <button
                    onClick={closeWorkbench}
                    className="h-9 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-medium text-slate-100 transition hover:bg-white/15"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>

            <div className="max-h-[85vh] overflow-y-auto px-6 pb-6 pt-4">
              {error && (
                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
              )}
              {notice && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>
              )}

              <div className="space-y-4">
                {capabilityVerificationBatchPanel}
                {viewSwitchPanel}
                {view === 'recipe' ? recipeWorkbench : view === 'knowledge' ? knowledgeWorkbench : capabilityWorkbench}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
