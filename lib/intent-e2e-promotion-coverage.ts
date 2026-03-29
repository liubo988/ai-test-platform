export interface IntentE2EPromotionCoverageStarterHelperLike {
  helper: string;
  recordedPromotionReceiptCount?: number;
  recordedPromotionCapabilityCount?: number;
  lastPromotionRecordedAt?: string;
  lastPromotionModuleName?: string;
  lastPromotionScenarioTitle?: string;
}

export interface IntentE2EPromotionCoverageRuleSummaryLike {
  ruleId: string;
  title?: string;
  successfulRunPromotionReceiptCount?: number;
  lastSuccessfulRunPromotionRecordedAt?: string;
  lastSuccessfulRunPromotionRequestedModuleUid?: string;
  lastSuccessfulRunPromotionObservationSummary?: string;
}

export interface IntentE2EInsightPromotionCoverageSummary {
  coveredAssetCount: number;
  starterHelperCount: number;
  starterCapabilityCount: number;
  successfulRunRuleCount: number;
  lastRecordedAt: string;
  latestStarterHelper: string;
  latestStarterModuleName: string;
  latestStarterScenarioTitle: string;
  latestSuccessfulRunRuleId: string;
  latestSuccessfulRunRuleTitle: string;
  latestSuccessfulRunRequestedModuleUid: string;
  latestSuccessfulRunObservationSummary: string;
}

function toTimestamp(value: string): number {
  const timestamp = Date.parse(String(value || '').trim());
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function buildIntentE2EPromotionCoverageSummary(input: {
  starterHelpers: IntentE2EPromotionCoverageStarterHelperLike[];
  suppressedStarterHelpers: IntentE2EPromotionCoverageStarterHelperLike[];
  knowledgeChangeRuleSummaries: IntentE2EPromotionCoverageRuleSummaryLike[];
}): IntentE2EInsightPromotionCoverageSummary {
  const starterHistoryByHelper = new Map<
    string,
    {
      capabilityCount: number;
      lastRecordedAt: string;
      lastRecordedAtMs: number;
    }
  >();
  const successfulRunHistoryByRuleId = new Map<
    string,
    {
      lastRecordedAt: string;
      lastRecordedAtMs: number;
      title: string;
      requestedModuleUid: string;
      observationSummary: string;
    }
  >();
  let latestRecordedAt = '';
  let latestRecordedAtMs = 0;
  let latestStarterHelper = '';
  let latestStarterModuleName = '';
  let latestStarterScenarioTitle = '';
  let latestStarterRecordedAtMs = 0;
  let latestSuccessfulRunRuleId = '';
  let latestSuccessfulRunRuleTitle = '';
  let latestSuccessfulRunRequestedModuleUid = '';
  let latestSuccessfulRunObservationSummary = '';
  let latestSuccessfulRunRecordedAtMs = 0;

  for (const helper of [...input.starterHelpers, ...input.suppressedStarterHelpers]) {
    const receiptCount = Math.max(0, Math.floor(helper.recordedPromotionReceiptCount || 0));
    const capabilityCount = Math.max(0, Math.floor(helper.recordedPromotionCapabilityCount || 0));
    const recordedAt = String(helper.lastPromotionRecordedAt || '').trim();
    if (receiptCount === 0 && capabilityCount === 0 && !recordedAt) continue;

    const current = starterHistoryByHelper.get(helper.helper) || {
      capabilityCount: 0,
      lastRecordedAt: '',
      lastRecordedAtMs: 0,
    };
    current.capabilityCount = Math.max(current.capabilityCount, capabilityCount);
    const recordedAtMs = toTimestamp(recordedAt);
    if (recordedAtMs >= current.lastRecordedAtMs) {
      current.lastRecordedAt = recordedAt;
      current.lastRecordedAtMs = recordedAtMs;
    }
    starterHistoryByHelper.set(helper.helper, current);

    if (recordedAtMs >= latestRecordedAtMs) {
      latestRecordedAt = recordedAt;
      latestRecordedAtMs = recordedAtMs;
    }
    if (recordedAtMs >= latestStarterRecordedAtMs) {
      latestStarterHelper = helper.helper;
      latestStarterModuleName = String(helper.lastPromotionModuleName || '').trim();
      latestStarterScenarioTitle = String(helper.lastPromotionScenarioTitle || '').trim();
      latestStarterRecordedAtMs = recordedAtMs;
    }
  }

  for (const rule of input.knowledgeChangeRuleSummaries) {
    const receiptCount = Math.max(0, Math.floor(rule.successfulRunPromotionReceiptCount || 0));
    const recordedAt = String(rule.lastSuccessfulRunPromotionRecordedAt || '').trim();
    if (receiptCount === 0 && !recordedAt) continue;

    const current = successfulRunHistoryByRuleId.get(rule.ruleId) || {
      lastRecordedAt: '',
      lastRecordedAtMs: 0,
      title: '',
      requestedModuleUid: '',
      observationSummary: '',
    };
    const recordedAtMs = toTimestamp(recordedAt);
    if (recordedAtMs >= current.lastRecordedAtMs) {
      current.lastRecordedAt = recordedAt;
      current.lastRecordedAtMs = recordedAtMs;
      current.title = String(rule.title || '').trim();
      current.requestedModuleUid = String(rule.lastSuccessfulRunPromotionRequestedModuleUid || '').trim();
      current.observationSummary = String(rule.lastSuccessfulRunPromotionObservationSummary || '').trim();
    }
    successfulRunHistoryByRuleId.set(rule.ruleId, current);

    if (recordedAtMs >= latestRecordedAtMs) {
      latestRecordedAt = recordedAt;
      latestRecordedAtMs = recordedAtMs;
    }
    if (recordedAtMs >= latestSuccessfulRunRecordedAtMs) {
      latestSuccessfulRunRuleId = rule.ruleId;
      latestSuccessfulRunRuleTitle = String(rule.title || '').trim();
      latestSuccessfulRunRequestedModuleUid = String(rule.lastSuccessfulRunPromotionRequestedModuleUid || '').trim();
      latestSuccessfulRunObservationSummary = String(rule.lastSuccessfulRunPromotionObservationSummary || '').trim();
      latestSuccessfulRunRecordedAtMs = recordedAtMs;
    }
  }

  return {
    coveredAssetCount: starterHistoryByHelper.size + successfulRunHistoryByRuleId.size,
    starterHelperCount: starterHistoryByHelper.size,
    starterCapabilityCount: [...starterHistoryByHelper.values()].reduce(
      (total, item) => total + item.capabilityCount,
      0
    ),
    successfulRunRuleCount: successfulRunHistoryByRuleId.size,
    lastRecordedAt: latestRecordedAt,
    latestStarterHelper,
    latestStarterModuleName,
    latestStarterScenarioTitle,
    latestSuccessfulRunRuleId,
    latestSuccessfulRunRuleTitle,
    latestSuccessfulRunRequestedModuleUid,
    latestSuccessfulRunObservationSummary,
  };
}
