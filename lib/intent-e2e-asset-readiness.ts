import fs from 'node:fs';
import path from 'node:path';
import { getIntentRepairMemoryPath } from '@/lib/ai/intent-repair-memory';
import { getIntentProjectOnboardingPath, readIntentProjectOnboardingStatus } from '@/lib/intent-project-onboarding';
import { getIntentProjectKnowledgePath } from '@/lib/intent-project-knowledge';

export type IntentE2EProjectAssetAvailabilityStatus = 'ready' | 'asset_missing';
export type IntentE2EAssetReadinessStatus = IntentE2EProjectAssetAvailabilityStatus | 'no_hit';

export interface IntentE2EProjectAssetAvailability {
  status: IntentE2EProjectAssetAvailabilityStatus;
  projectUid: string;
  onboardingPath?: string;
  knowledgePath?: string;
  repairMemoryPath?: string;
  hasOnboarding?: boolean;
  onboardingReady?: boolean;
  hasKnowledgeAsset?: boolean;
  hasRepairMemoryAsset?: boolean;
  reasons: string[];
}

export interface IntentE2EAssetReadiness extends Omit<IntentE2EProjectAssetAvailability, 'status'> {
  status: IntentE2EAssetReadinessStatus;
  knowledgeMatchCount: number;
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

function pathExists(filePath: string): boolean {
  if (!filePath) return false;
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  return fs.existsSync(absolutePath);
}

function mapOnboardingMissingFieldToReason(field: string): string {
  switch (field) {
    case 'manifest':
      return 'onboarding_manifest_missing';
    case 'invalid_json':
      return 'onboarding_manifest_invalid';
    default:
      return `onboarding_${field}_missing`;
  }
}

export function buildIntentE2EProjectAssetAvailability(input: {
  projectUid?: string | null;
}): IntentE2EProjectAssetAvailability {
  const projectUid = input.projectUid?.trim() || '';

  if (!projectUid) {
    return {
      status: 'ready',
      projectUid: '',
      reasons: ['global_scope'],
    };
  }

  const onboardingStatus = readIntentProjectOnboardingStatus(projectUid);
  const onboardingPath = onboardingStatus.path || getIntentProjectOnboardingPath(projectUid);
  const projectKnowledgePath = getIntentProjectKnowledgePath(projectUid, { mode: 'write', legacyFallback: false });
  const legacyAwareKnowledgePath = getIntentProjectKnowledgePath(projectUid, { mode: 'read' });
  const repairMemoryPath = getIntentRepairMemoryPath(projectUid, { mode: 'write', legacyFallback: false });
  const hasProjectKnowledgeAsset = pathExists(projectKnowledgePath);
  const hasRepairMemoryAsset = pathExists(repairMemoryPath);
  const hasLegacyKnowledgeFallbackAsset =
    !hasProjectKnowledgeAsset && hasRepairMemoryAsset && pathExists(legacyAwareKnowledgePath);
  const hasKnowledgeAsset = hasProjectKnowledgeAsset || hasLegacyKnowledgeFallbackAsset;
  const allowsLegacyOnboardingCompatibility = hasKnowledgeAsset && (hasProjectKnowledgeAsset || hasRepairMemoryAsset);
  const status =
    !hasKnowledgeAsset || ((!onboardingStatus.exists || !onboardingStatus.ready) && !allowsLegacyOnboardingCompatibility)
      ? 'asset_missing'
      : 'ready';
  const reasons = uniqueStrings([
    ...(allowsLegacyOnboardingCompatibility ? [] : onboardingStatus.missingFields.map((field) => mapOnboardingMissingFieldToReason(field))),
    hasKnowledgeAsset ? '' : 'project_knowledge_missing',
    hasRepairMemoryAsset ? '' : 'repair_memory_missing',
  ]);

  return {
    status,
    projectUid,
    onboardingPath: onboardingPath || undefined,
    knowledgePath: hasLegacyKnowledgeFallbackAsset ? legacyAwareKnowledgePath : projectKnowledgePath,
    repairMemoryPath,
    hasOnboarding: onboardingStatus.exists,
    onboardingReady: onboardingStatus.ready,
    hasKnowledgeAsset,
    hasRepairMemoryAsset,
    reasons,
  };
}

export function buildIntentE2EAssetReadiness(input: {
  projectUid?: string | null;
  availability?: IntentE2EProjectAssetAvailability | null;
  knowledgeMatchCount?: number;
}): IntentE2EAssetReadiness {
  const availability = input.availability || buildIntentE2EProjectAssetAvailability({ projectUid: input.projectUid });
  const knowledgeEvaluated = typeof input.knowledgeMatchCount === 'number' && Number.isFinite(input.knowledgeMatchCount);
  const knowledgeMatchCount =
    knowledgeEvaluated
      ? Math.max(0, Math.floor(input.knowledgeMatchCount ?? 0))
      : 0;
  const reasons = uniqueStrings([
    ...availability.reasons,
    availability.status === 'ready' && knowledgeEvaluated && knowledgeMatchCount <= 0 ? 'knowledge_no_hit' : '',
  ]);
  const status: IntentE2EAssetReadinessStatus =
    availability.status === 'asset_missing' ? 'asset_missing' : !knowledgeEvaluated || knowledgeMatchCount > 0 ? 'ready' : 'no_hit';

  return {
    projectUid: availability.projectUid,
    onboardingPath: availability.onboardingPath,
    knowledgePath: availability.knowledgePath,
    repairMemoryPath: availability.repairMemoryPath,
    hasOnboarding: availability.hasOnboarding,
    onboardingReady: availability.onboardingReady,
    hasKnowledgeAsset: availability.hasKnowledgeAsset,
    hasRepairMemoryAsset: availability.hasRepairMemoryAsset,
    knowledgeMatchCount,
    status,
    reasons,
  };
}
