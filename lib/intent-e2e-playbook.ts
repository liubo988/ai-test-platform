import type { IntentTrackedE2EPriorityScenarioFamily } from '@/lib/intent-e2e-priority-scenario-family';
import type { IntentProjectRecipeMergeInput } from '@/lib/intent-project-recipe-registry';
import type { IntentE2EPlaybookCandidate } from '@/lib/intent-e2e-run-review';

function uniqueStrings(values: Array<string | null | undefined>, max = 12): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
    if (items.length >= max) break;
  }

  return items;
}

function normalizeTrackedScenarioFamily(value: unknown): IntentTrackedE2EPriorityScenarioFamily | undefined {
  return value === 'business_create_list_verify' ||
    value === 'business_to_order' ||
    value === 'list_search_detail' ||
    value === 'modal_or_drawer_save' ||
    value === 'row_action_menu' ||
    value === 'list_ownership_switch'
    ? value
    : undefined;
}

function normalizeTargetPath(value: string): string {
  const raw = value.trim();
  if (!raw) return '';

  try {
    const url = raw.startsWith('http://') || raw.startsWith('https://') ? new URL(raw) : new URL(raw, 'https://intent.local');
    const hash = (url.hash || '').replace(/^#/, '').trim();
    const hashPart = hash && hash !== '/' ? (hash.startsWith('/') ? hash : `/${hash}`) : '';
    const pathPart = url.pathname && url.pathname !== '/' ? url.pathname : '';
    return hashPart || pathPart || '/';
  } catch {
    return raw.replace(/[?#].*$/, '');
  }
}

function collectMatcherFragments(candidate: IntentE2EPlaybookCandidate): string[] {
  const rawSegments = [
    candidate.title,
    ...candidate.executorPlan,
    ...candidate.verifierPlan,
  ].flatMap((value) =>
    String(value || '')
      .split(/[：:；;，,。\/|\n]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && item.length <= 24)
  );

  return uniqueStrings(rawSegments, 8);
}

function inferRequiredActions(candidate: IntentE2EPlaybookCandidate): string[] {
  const family = normalizeTrackedScenarioFamily(candidate.scenarioFamily);
  if (family === 'list_search_detail' || family === 'business_create_list_verify') {
    return ['find_table_row'];
  }
  if (family === 'modal_or_drawer_save' || family === 'business_to_order') {
    return ['observe_submit_state'];
  }
  return [];
}

function buildRecipeDescription(candidate: IntentE2EPlaybookCandidate): string {
  const targetPath = normalizeTargetPath(candidate.targetPath);
  const summary = uniqueStrings([
    candidate.executorPlan[0],
    candidate.verifierPlan[0],
  ], 2).join('；');
  return uniqueStrings([
    '从通过 run 自动沉淀的 playbook 候选，优先沿既有执行骨架和验收路径复用。',
    targetPath ? `目标路径：${targetPath}` : '',
    summary,
  ]).join(' ');
}

export function buildIntentProjectRecipeMergeInputFromPlaybookCandidate(
  candidate: IntentE2EPlaybookCandidate
): IntentProjectRecipeMergeInput {
  const targetPath = normalizeTargetPath(candidate.targetPath);
  const matcherFragments = collectMatcherFragments(candidate);

  return {
    slug: candidate.slug,
    family: normalizeTrackedScenarioFamily(candidate.scenarioFamily),
    title: candidate.title || candidate.slug,
    description: buildRecipeDescription(candidate),
    matchers: {
      targetUrlIncludes: targetPath ? [targetPath] : [],
      titleIncludes: matcherFragments.slice(0, 2),
      summaryIncludes: matcherFragments.slice(0, 4),
      requiredActions: inferRequiredActions(candidate),
      preferredHelpers: [...candidate.preferredHelpers],
    },
    requiredContext: [...candidate.preconditions],
    executorPlan: [...candidate.executorPlan],
    verifierPlan: [...candidate.verifierPlan],
    knownPitfalls: [...candidate.knownPitfalls],
    successRate: candidate.successRate,
    lastVerifiedAt: candidate.lastVerifiedAt,
  };
}

export function buildIntentProjectRecipeMergeInputsFromPlaybookCandidates(
  candidates: IntentE2EPlaybookCandidate[] = []
): IntentProjectRecipeMergeInput[] {
  return candidates
    .map((candidate) => buildIntentProjectRecipeMergeInputFromPlaybookCandidate(candidate))
    .filter((candidate) => candidate.slug && candidate.title && candidate.description);
}
