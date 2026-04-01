import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { evaluateIntentProjectRecipeGovernanceMutationRollout } from '@/lib/intent-project-recipe-governance';
import {
  createIntentProjectRecipeAuditEntry,
  getIntentProjectRecipeProfile,
  getIntentProjectRecipeRegistryPath,
  mergeIntentProjectRecipes,
  registerIntentProjectRecipes,
  updateIntentProjectRecipe,
  writeIntentProjectRecipeAuditEntry,
  type IntentProjectRecipeAuditComparison,
  type IntentProjectRecipeMergeInput,
} from '@/lib/intent-project-recipe-registry';
import type { IntentRecipe } from '@/lib/intent-recipe-registry';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

type MutationMode = 'register' | 'merge' | 'update';

function normalizeMode(value: unknown): MutationMode | '' {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized === 'merge' || normalized === 'update' || normalized === 'register' ? normalized : '';
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeRecipeArray(value: unknown): IntentRecipe[] {
  return Array.isArray(value) ? (value as IntentRecipe[]) : [];
}

function normalizeMergeRecipeArray(value: unknown): IntentProjectRecipeMergeInput[] {
  return Array.isArray(value) ? (value as IntentProjectRecipeMergeInput[]) : [];
}

function isRolloutSensitiveRecipeUpdate(value: unknown): value is IntentProjectRecipeMergeInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (
    Object.prototype.hasOwnProperty.call(value, 'successRate') ||
    Object.prototype.hasOwnProperty.call(value, 'lastVerifiedAt')
  );
}

function buildRegisterAuditComparison(
  beforeCount: number,
  result: Awaited<ReturnType<typeof registerIntentProjectRecipes>>
): IntentProjectRecipeAuditComparison {
  return {
    beforeRecipeCount: beforeCount,
    afterRecipeCount: result.profile.recipes.length,
    addedRecipeSlugs: [...result.addedRecipeSlugs],
    removedRecipeSlugs: [],
    updatedRecipeSlugs: [...result.updatedRecipeSlugs],
    skippedRecipeSlugs: [...result.skippedRecipeSlugs],
  };
}

function buildMutationAuditComparison(
  result: Awaited<ReturnType<typeof mergeIntentProjectRecipes>>
): IntentProjectRecipeAuditComparison {
  return {
    beforeRecipeCount: result.beforeRecipeCount,
    afterRecipeCount: result.afterRecipeCount,
    addedRecipeSlugs: [...result.addedRecipeSlugs],
    removedRecipeSlugs: [],
    updatedRecipeSlugs: [...result.updatedRecipeSlugs],
    skippedRecipeSlugs: [...result.skippedRecipeSlugs],
  };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看项目 recipe 资产');

    const response = NextResponse.json({
      registryPath: getIntentProjectRecipeRegistryPath(),
      profile: getIntentProjectRecipeProfile(),
    });

    return applyActorCookie(response, actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '读取项目 recipe 资产失败');
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限修改项目 recipe 资产');
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const mode = normalizeMode(body.mode);
    const rolloutOverride = normalizeBoolean(body.rolloutOverride);
    const rolloutOverrideReason = normalizeString(body.rolloutOverrideReason);
    const rolloutCanaryAcknowledged = normalizeBoolean(body.rolloutCanaryAcknowledged);
    const rolloutCanaryLabel = normalizeString(body.rolloutCanaryLabel);
    if (!mode) {
      return NextResponse.json({ error: '缺少必要字段: mode' }, { status: 400 });
    }

    let result: Awaited<ReturnType<typeof registerIntentProjectRecipes>> | Awaited<ReturnType<typeof mergeIntentProjectRecipes>>;
    let comparison: IntentProjectRecipeAuditComparison;
    let governanceDecision: Awaited<
      ReturnType<typeof evaluateIntentProjectRecipeGovernanceMutationRollout>
    >['governanceDecision'] = null;
    let rolloutPolicyDecision: Awaited<
      ReturnType<typeof evaluateIntentProjectRecipeGovernanceMutationRollout>
    >['rolloutPolicyDecision'] = null;

    if (mode === 'register') {
      const recipes = normalizeRecipeArray(body.recipes);
      if (recipes.length === 0) {
        return NextResponse.json({ error: '缺少必要字段: recipes' }, { status: 400 });
      }
      const beforeCount = getIntentProjectRecipeProfile().recipes.length;
      const registerResult = await registerIntentProjectRecipes(recipes);
      result = registerResult;
      comparison = buildRegisterAuditComparison(beforeCount, registerResult);
    } else if (mode === 'merge') {
      const recipes = normalizeMergeRecipeArray(body.recipes);
      if (recipes.length === 0) {
        return NextResponse.json({ error: '缺少必要字段: recipes' }, { status: 400 });
      }
      const mergeResult = await mergeIntentProjectRecipes(recipes);
      result = mergeResult;
      comparison = buildMutationAuditComparison(mergeResult);
    } else {
      const recipe = body.recipe as IntentProjectRecipeMergeInput | undefined;
      if (!recipe || typeof recipe !== 'object') {
        return NextResponse.json({ error: '缺少必要字段: recipe' }, { status: 400 });
      }

      if (isRolloutSensitiveRecipeUpdate(recipe)) {
        const governanceRollout = await evaluateIntentProjectRecipeGovernanceMutationRollout({
          projectUid,
          patch: recipe,
          rolloutOverride,
          rolloutOverrideReason,
          rolloutCanaryAcknowledged,
          rolloutCanaryLabel,
        });
        governanceDecision = governanceRollout.governanceDecision;
        rolloutPolicyDecision = governanceRollout.rolloutPolicyDecision;

        if (rolloutPolicyDecision && !rolloutPolicyDecision.allowMerge) {
          return NextResponse.json(
            {
              error: `${rolloutPolicyDecision.summary}${rolloutPolicyDecision.recommendation ? ` ${rolloutPolicyDecision.recommendation}` : ''}`.trim(),
              governanceDecision: governanceDecision || undefined,
              rolloutPolicyDecision,
            },
            { status: 409 }
          );
        }
      }

      const updateResult = await updateIntentProjectRecipe(recipe);
      result = updateResult;
      comparison = buildMutationAuditComparison(updateResult);
    }

    let auditEntry = createIntentProjectRecipeAuditEntry({
      operation: mode,
      projectUid,
      actorLabel: actor.displayName || 'system',
      writtenTo: result.writtenTo,
      backupPath: result.backupPath,
      comparison,
    });
    let auditWarning = '';

    try {
      auditEntry = await writeIntentProjectRecipeAuditEntry(auditEntry);
    } catch (error: unknown) {
      auditWarning = error instanceof Error ? error.message : '写入项目 recipe 审计失败';
    }

    const response = NextResponse.json({
      mode,
      result,
      auditEntry,
      auditWarning: auditWarning || undefined,
      governanceDecision: governanceDecision || undefined,
      rolloutPolicyDecision: rolloutPolicyDecision || undefined,
      rolloutWarning:
        rolloutPolicyDecision &&
        !(rolloutPolicyDecision.appliedMode === 'full_release' && rolloutPolicyDecision.receipts.length === 0)
          ? rolloutPolicyDecision.summary
          : undefined,
    });
    return applyActorCookie(response, actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '修改项目 recipe 资产失败');
  }
}
