import { buildIntentE2EReleaseStatusReport } from '@/lib/intent-e2e-release-status';
import type { IntentE2EPriorityScenarioFamily } from '@/lib/intent-e2e-priority-scenario-family';
import type { IntentE2ETrafficQualityPriorityFamilyGovernance } from '@/lib/intent-e2e-traffic-quality';

export const DEFAULT_INTENT_E2E_RELEASE_GUARD_CONFIG_PATH =
  'artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json';
export const DEFAULT_INTENT_E2E_KNOWLEDGE_HIT_CONFIG_PATH =
  'artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit-guard.json';

function normalizePriorityFamilyGovernanceStatus(input: {
  releaseGuardStatus: IntentE2ETrafficQualityPriorityFamilyGovernance['releaseGuardStatus'];
  knowledgeHitStatus: IntentE2ETrafficQualityPriorityFamilyGovernance['knowledgeHitStatus'];
}): IntentE2ETrafficQualityPriorityFamilyGovernance['governanceStatus'] {
  if (input.releaseGuardStatus === 'passed' && input.knowledgeHitStatus === 'passed') return 'ready';
  if (input.releaseGuardStatus === 'failed' || input.knowledgeHitStatus === 'failed') return 'blocked';
  if (input.releaseGuardStatus === 'missing' && input.knowledgeHitStatus === 'missing') return 'unknown';
  return 'attention';
}

export async function loadIntentE2ETrafficQualityPriorityFamilyGovernance(
  projectUid: string
): Promise<IntentE2ETrafficQualityPriorityFamilyGovernance[]> {
  try {
    const releaseStatus = await buildIntentE2EReleaseStatusReport({
      releaseGuardConfigPath: DEFAULT_INTENT_E2E_RELEASE_GUARD_CONFIG_PATH,
      knowledgeHitConfigPath: DEFAULT_INTENT_E2E_KNOWLEDGE_HIT_CONFIG_PATH,
    });
    if (releaseStatus.projectUid !== projectUid) return [];

    return releaseStatus.families.map((family) => {
      const releaseGuardStatus = family.releaseGuard?.status || 'missing';
      const knowledgeHitStatus = family.knowledgeHit?.status || 'missing';
      return {
        family: family.priorityScenarioFamily as IntentE2EPriorityScenarioFamily,
        governanceStatus: normalizePriorityFamilyGovernanceStatus({
          releaseGuardStatus,
          knowledgeHitStatus,
        }),
        releaseGuardStatus,
        knowledgeHitStatus,
        evidencePaths: [
          family.releaseGuard?.compareReportPath,
          family.releaseGuard?.benchmarkPath,
          family.knowledgeHit?.evidencePath,
        ].filter((item): item is string => Boolean(item)),
      };
    });
  } catch {
    return [];
  }
}
