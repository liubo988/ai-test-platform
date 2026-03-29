import type { IntentE2EInsightSuppressedStarterHelper } from './ai/intent-e2e-insights';
import { readIntentCapabilityStarterHelper } from './intent-capability-origin';

type CapabilityLike = {
  capabilityUid: string;
  name: string;
  slug: string;
  status?: string;
  meta?: unknown;
};

export type IntentSuppressedStarterHelperLinkedCapability = {
  capabilityUid: string;
  name: string;
  slug: string;
  status: 'active' | 'archived';
};

export type IntentSuppressedStarterHelperHistoryItem = IntentE2EInsightSuppressedStarterHelper & {
  linkedCapabilities: IntentSuppressedStarterHelperLinkedCapability[];
  activeLinkedCapabilityCount: number;
  archivedLinkedCapabilityCount: number;
};

function normalizeCapabilityStatus(value: string | undefined): 'active' | 'archived' {
  return value === 'archived' ? 'archived' : 'active';
}

export function buildIntentSuppressedStarterHelperHistory(
  capabilities: CapabilityLike[],
  suppressedStarterHelpers: IntentE2EInsightSuppressedStarterHelper[]
): IntentSuppressedStarterHelperHistoryItem[] {
  return suppressedStarterHelpers
    .map<IntentSuppressedStarterHelperHistoryItem>((item) => {
      const linkedCapabilities = capabilities
        .filter((capability) => readIntentCapabilityStarterHelper(capability.meta) === item.helper)
        .map((capability) => ({
          capabilityUid: capability.capabilityUid,
          name: capability.name,
          slug: capability.slug,
          status: normalizeCapabilityStatus(capability.status),
        }))
        .sort(
          (left, right) =>
            (left.status === 'archived' ? 1 : 0) - (right.status === 'archived' ? 1 : 0) ||
            left.name.localeCompare(right.name, 'zh-CN') ||
            left.slug.localeCompare(right.slug, 'zh-CN')
        );

      return {
        ...item,
        linkedCapabilities,
        activeLinkedCapabilityCount: linkedCapabilities.filter((capability) => capability.status === 'active').length,
        archivedLinkedCapabilityCount: linkedCapabilities.filter((capability) => capability.status === 'archived').length,
      };
    })
    .sort(
      (left, right) =>
        right.activeLinkedCapabilityCount - left.activeLinkedCapabilityCount ||
        right.archivedLinkedCapabilityCount - left.archivedLinkedCapabilityCount ||
        (right.knowledgeChangeDecisionableRuleCount || 0) - (left.knowledgeChangeDecisionableRuleCount || 0) ||
        right.passRate - left.passRate ||
        left.helper.localeCompare(right.helper)
    );
}
