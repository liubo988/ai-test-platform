import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import type { IntentRecipe, IntentRecipeMatcher } from './intent-recipe-registry';

export interface IntentProjectRecipeProfile {
  version: 1;
  recipes: IntentRecipe[];
}

export interface RegisterIntentProjectRecipesResult {
  writtenTo: string;
  backupPath: string | null;
  addedRecipeSlugs: string[];
  updatedRecipeSlugs: string[];
  skippedRecipeSlugs: string[];
  profile: IntentProjectRecipeProfile;
}

export interface IntentProjectRecipeMergeInput {
  slug: string;
  title?: string;
  description?: string;
  matchers?: Partial<IntentRecipeMatcher>;
  requiredContext?: string[];
  executorPlan?: string[];
  verifierPlan?: string[];
  knownPitfalls?: string[];
  successRate?: number;
  lastVerifiedAt?: string;
}

export interface MergeIntentProjectRecipesResult {
  writtenTo: string;
  backupPath: string | null;
  beforeRecipeCount: number;
  afterRecipeCount: number;
  addedRecipeSlugs: string[];
  updatedRecipeSlugs: string[];
  skippedRecipeSlugs: string[];
  profile: IntentProjectRecipeProfile;
}

export interface IntentProjectRecipeBackupItem {
  path: string;
  fileName: string;
  createdAt: string;
  sizeBytes: number;
}

export interface ListIntentProjectRecipeBackupsResult {
  registryPath: string;
  backupDir: string;
  backups: IntentProjectRecipeBackupItem[];
}

export interface IntentProjectRecipeProfileComparison {
  beforeRecipeCount: number;
  afterRecipeCount: number;
  addedRecipeSlugs: string[];
  removedRecipeSlugs: string[];
  updatedRecipeSlugs: string[];
}

export interface RestoreIntentProjectRecipeBackupResult {
  restoredFrom: string;
  writtenTo: string;
  backupCreated: string | null;
  comparison: IntentProjectRecipeProfileComparison;
  profile: IntentProjectRecipeProfile;
}

export type IntentProjectRecipeAuditOperation = 'register' | 'merge' | 'update' | 'restore';

export interface IntentProjectRecipeAuditComparison {
  beforeRecipeCount: number;
  afterRecipeCount: number;
  addedRecipeSlugs: string[];
  removedRecipeSlugs?: string[];
  updatedRecipeSlugs: string[];
  skippedRecipeSlugs: string[];
}

export interface IntentProjectRecipeAuditEntry {
  auditId: string;
  occurredAt: string;
  operation: IntentProjectRecipeAuditOperation;
  projectUid: string;
  actorLabel: string;
  title: string;
  detail: string;
  writtenTo: string;
  backupPath: string | null;
  comparison: IntentProjectRecipeAuditComparison;
}

export interface CreateIntentProjectRecipeAuditEntryInput {
  operation: IntentProjectRecipeAuditOperation;
  projectUid?: string | null;
  actorLabel?: string | null;
  writtenTo: string;
  backupPath?: string | null;
  comparison: IntentProjectRecipeAuditComparison;
}

export interface ListIntentProjectRecipeAuditEntriesResult {
  auditLogPath: string;
  items: IntentProjectRecipeAuditEntry[];
}

const DEFAULT_PROJECT_RECIPE_REGISTRY_PATH = path.join(process.cwd(), 'intent-e2e.project-recipes.json');
const DEFAULT_PROJECT_RECIPE_BACKUP_DIR = path.join(process.cwd(), 'reports', 'intent-e2e.project-recipes.backups');
const DEFAULT_PROJECT_RECIPE_AUDIT_PATH = path.join(process.cwd(), 'reports', 'intent-e2e.project-recipes.audit.jsonl');

let cachePath = '';
let cacheProfile: IntentProjectRecipeProfile | null = null;

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

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? uniqueStrings(raw.map((item) => (typeof item === 'string' ? item : '')))
    : [];
}

function normalizePercent(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(1)) : 0;
}

function normalizeCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function normalizeRecipeMatcher(raw: unknown): IntentRecipeMatcher {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    requiresAuth: source.requiresAuth === true,
    requiresStableIdentifier: source.requiresStableIdentifier === true,
    targetUrlIncludes: normalizeStringArray(source.targetUrlIncludes),
    titleIncludes: normalizeStringArray(source.titleIncludes),
    summaryIncludes: normalizeStringArray(source.summaryIncludes),
    requiredActions: normalizeStringArray(source.requiredActions),
    preferredHelpers: normalizeStringArray(source.preferredHelpers),
    capabilitySlugs: normalizeStringArray(source.capabilitySlugs),
  };
}

function normalizeRecipeMatcherPatch(raw: unknown): Partial<IntentRecipeMatcher> {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return {};

  const patch: Partial<IntentRecipeMatcher> = {};
  if (Object.prototype.hasOwnProperty.call(source, 'requiresAuth')) {
    patch.requiresAuth = source.requiresAuth === true;
  }
  if (Object.prototype.hasOwnProperty.call(source, 'requiresStableIdentifier')) {
    patch.requiresStableIdentifier = source.requiresStableIdentifier === true;
  }
  if (Object.prototype.hasOwnProperty.call(source, 'targetUrlIncludes')) {
    patch.targetUrlIncludes = normalizeStringArray(source.targetUrlIncludes);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'titleIncludes')) {
    patch.titleIncludes = normalizeStringArray(source.titleIncludes);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'summaryIncludes')) {
    patch.summaryIncludes = normalizeStringArray(source.summaryIncludes);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'requiredActions')) {
    patch.requiredActions = normalizeStringArray(source.requiredActions);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'preferredHelpers')) {
    patch.preferredHelpers = normalizeStringArray(source.preferredHelpers);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'capabilitySlugs')) {
    patch.capabilitySlugs = normalizeStringArray(source.capabilitySlugs);
  }

  return patch;
}

function cloneIntentRecipe(recipe: IntentRecipe): IntentRecipe {
  return {
    ...recipe,
    matchers: {
      requiresAuth: recipe.matchers.requiresAuth === true,
      requiresStableIdentifier: recipe.matchers.requiresStableIdentifier === true,
      targetUrlIncludes: [...(recipe.matchers.targetUrlIncludes || [])],
      titleIncludes: [...(recipe.matchers.titleIncludes || [])],
      summaryIncludes: [...(recipe.matchers.summaryIncludes || [])],
      requiredActions: [...(recipe.matchers.requiredActions || [])],
      preferredHelpers: [...(recipe.matchers.preferredHelpers || [])],
      capabilitySlugs: [...(recipe.matchers.capabilitySlugs || [])],
    },
    requiredContext: [...recipe.requiredContext],
    executorPlan: [...recipe.executorPlan],
    verifierPlan: [...recipe.verifierPlan],
    knownPitfalls: [...recipe.knownPitfalls],
  };
}

function mergeStringArray(existing: string[] | undefined, patch: string[] | undefined): string[] {
  return uniqueStrings([...(existing || []), ...(patch || [])]);
}

function mergeRecipeMatcher(
  existing: IntentRecipeMatcher | undefined,
  patch: Partial<IntentRecipeMatcher>
): IntentRecipeMatcher {
  return {
    requiresAuth: Object.prototype.hasOwnProperty.call(patch, 'requiresAuth')
      ? patch.requiresAuth === true
      : existing?.requiresAuth === true,
    requiresStableIdentifier: Object.prototype.hasOwnProperty.call(patch, 'requiresStableIdentifier')
      ? patch.requiresStableIdentifier === true
      : existing?.requiresStableIdentifier === true,
    targetUrlIncludes: mergeStringArray(existing?.targetUrlIncludes, patch.targetUrlIncludes),
    titleIncludes: mergeStringArray(existing?.titleIncludes, patch.titleIncludes),
    summaryIncludes: mergeStringArray(existing?.summaryIncludes, patch.summaryIncludes),
    requiredActions: mergeStringArray(existing?.requiredActions, patch.requiredActions),
    preferredHelpers: mergeStringArray(existing?.preferredHelpers, patch.preferredHelpers),
    capabilitySlugs: mergeStringArray(existing?.capabilitySlugs, patch.capabilitySlugs),
  };
}

function normalizeRecipe(raw: unknown): IntentRecipe | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  const slug = normalizeString(source.slug);
  const title = normalizeString(source.title);
  const description = normalizeString(source.description);
  if (!slug || !title || !description) return null;

  return {
    version: 1,
    slug,
    title,
    description,
    matchers: normalizeRecipeMatcher(source.matchers),
    requiredContext: normalizeStringArray(source.requiredContext),
    executorPlan: normalizeStringArray(source.executorPlan),
    verifierPlan: normalizeStringArray(source.verifierPlan),
    knownPitfalls: normalizeStringArray(source.knownPitfalls),
    successRate: normalizePercent(source.successRate),
    lastVerifiedAt: normalizeString(source.lastVerifiedAt),
  };
}

function normalizeMergeInput(raw: unknown): IntentProjectRecipeMergeInput | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  const slug = normalizeString(source.slug);
  if (!slug) return null;

  const normalized: IntentProjectRecipeMergeInput = {
    slug,
  };

  if (Object.prototype.hasOwnProperty.call(source, 'title')) {
    normalized.title = normalizeString(source.title);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'description')) {
    normalized.description = normalizeString(source.description);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'matchers')) {
    normalized.matchers = normalizeRecipeMatcherPatch(source.matchers);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'requiredContext')) {
    normalized.requiredContext = normalizeStringArray(source.requiredContext);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'executorPlan')) {
    normalized.executorPlan = normalizeStringArray(source.executorPlan);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'verifierPlan')) {
    normalized.verifierPlan = normalizeStringArray(source.verifierPlan);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'knownPitfalls')) {
    normalized.knownPitfalls = normalizeStringArray(source.knownPitfalls);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'successRate')) {
    normalized.successRate = normalizePercent(source.successRate);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'lastVerifiedAt')) {
    normalized.lastVerifiedAt = normalizeString(source.lastVerifiedAt);
  }

  return normalized;
}

function mergeIntentRecipe(existing: IntentRecipe | null, input: IntentProjectRecipeMergeInput): IntentRecipe | null {
  const title = normalizeString(input.title) || existing?.title || '';
  const description = normalizeString(input.description) || existing?.description || '';
  if (!title || !description) {
    return null;
  }

  return {
    version: 1,
    slug: input.slug.trim(),
    title,
    description,
    matchers: mergeRecipeMatcher(existing?.matchers, input.matchers || {}),
    requiredContext: mergeStringArray(existing?.requiredContext, input.requiredContext),
    executorPlan: mergeStringArray(existing?.executorPlan, input.executorPlan),
    verifierPlan: mergeStringArray(existing?.verifierPlan, input.verifierPlan),
    knownPitfalls: mergeStringArray(existing?.knownPitfalls, input.knownPitfalls),
    successRate: typeof input.successRate === 'number' ? normalizePercent(input.successRate) : existing?.successRate || 0,
    lastVerifiedAt:
      typeof input.lastVerifiedAt === 'string' ? normalizeString(input.lastVerifiedAt) : existing?.lastVerifiedAt || '',
  };
}

function normalizeProfile(raw: unknown): IntentProjectRecipeProfile {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const orderedSlugs: string[] = [];
  const recipesBySlug = new Map<string, IntentRecipe>();

  for (const item of Array.isArray(source.recipes) ? source.recipes : []) {
    const normalized = normalizeRecipe(item);
    if (!normalized) continue;
    if (!recipesBySlug.has(normalized.slug)) {
      orderedSlugs.push(normalized.slug);
    }
    recipesBySlug.set(normalized.slug, normalized);
  }

  return {
    version: 1,
    recipes: orderedSlugs.map((slug) => cloneIntentRecipe(recipesBySlug.get(slug)!)),
  };
}

function resolveProjectRecipeRegistryPath(): string {
  return process.env.INTENT_E2E_PROJECT_RECIPE_REGISTRY_PATH?.trim() || DEFAULT_PROJECT_RECIPE_REGISTRY_PATH;
}

function resolveProjectRecipeBackupDir(): string {
  return process.env.INTENT_E2E_PROJECT_RECIPE_BACKUP_DIR?.trim() || DEFAULT_PROJECT_RECIPE_BACKUP_DIR;
}

function resolveProjectRecipeAuditPath(): string {
  return process.env.INTENT_E2E_PROJECT_RECIPE_AUDIT_PATH?.trim() || DEFAULT_PROJECT_RECIPE_AUDIT_PATH;
}

function toDisplayPath(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath);
  if (!relative || relative.startsWith('..')) return filePath;
  return relative;
}

function toAbsolutePath(filePath: string): string {
  return path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(process.cwd(), filePath);
}

function isPathInsideDir(filePath: string, dirPath: string): boolean {
  const relative = path.relative(dirPath, filePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function loadIntentProjectRecipeProfile(): IntentProjectRecipeProfile {
  const registryPath = resolveProjectRecipeRegistryPath();
  if (cacheProfile && cachePath === registryPath) {
    return cacheProfile;
  }

  cachePath = registryPath;
  try {
    const raw = fs.readFileSync(registryPath, 'utf8');
    cacheProfile = normalizeProfile(JSON.parse(raw));
  } catch {
    cacheProfile = { version: 1, recipes: [] };
  }

  return cacheProfile;
}

export function getIntentProjectRecipeRegistryPath(): string {
  return toDisplayPath(resolveProjectRecipeRegistryPath());
}

export function getIntentProjectRecipeBackupDir(): string {
  return toDisplayPath(resolveProjectRecipeBackupDir());
}

export function getIntentProjectRecipeAuditPath(): string {
  return toDisplayPath(resolveProjectRecipeAuditPath());
}

export function getIntentProjectRecipeProfile(): IntentProjectRecipeProfile {
  return loadIntentProjectRecipeProfile();
}

export function listIntentProjectRecipes(): IntentRecipe[] {
  return getIntentProjectRecipeProfile().recipes.map((item) => cloneIntentRecipe(item));
}

export async function writeIntentProjectRecipeProfile(
  profile: IntentProjectRecipeProfile,
  outputPath = resolveProjectRecipeRegistryPath()
): Promise<string> {
  const normalizedProfile = normalizeProfile(profile);
  await fsPromises.mkdir(path.dirname(outputPath), { recursive: true });
  await fsPromises.writeFile(outputPath, JSON.stringify(normalizedProfile, null, 2), 'utf8');
  cachePath = outputPath;
  cacheProfile = normalizedProfile;
  return toDisplayPath(outputPath);
}

function buildIntentProjectRecipeProfileComparison(
  previousProfile: IntentProjectRecipeProfile,
  nextProfile: IntentProjectRecipeProfile
): IntentProjectRecipeProfileComparison {
  const previousBySlug = new Map(previousProfile.recipes.map((item) => [item.slug, item]));
  const nextBySlug = new Map(nextProfile.recipes.map((item) => [item.slug, item]));
  const addedRecipeSlugs = nextProfile.recipes
    .map((item) => item.slug)
    .filter((slug) => !previousBySlug.has(slug));
  const removedRecipeSlugs = previousProfile.recipes
    .map((item) => item.slug)
    .filter((slug) => !nextBySlug.has(slug));
  const updatedRecipeSlugs = nextProfile.recipes
    .map((item) => item.slug)
    .filter((slug) => previousBySlug.has(slug) && JSON.stringify(previousBySlug.get(slug)) !== JSON.stringify(nextBySlug.get(slug)));

  return {
    beforeRecipeCount: previousProfile.recipes.length,
    afterRecipeCount: nextProfile.recipes.length,
    addedRecipeSlugs: uniqueStrings(addedRecipeSlugs),
    removedRecipeSlugs: uniqueStrings(removedRecipeSlugs),
    updatedRecipeSlugs: uniqueStrings(updatedRecipeSlugs),
  };
}

function normalizeIntentProjectRecipeAuditComparison(raw: unknown): IntentProjectRecipeAuditComparison {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    beforeRecipeCount: normalizeCount(source.beforeRecipeCount),
    afterRecipeCount: normalizeCount(source.afterRecipeCount),
    addedRecipeSlugs: normalizeStringArray(source.addedRecipeSlugs),
    removedRecipeSlugs: normalizeStringArray(source.removedRecipeSlugs),
    updatedRecipeSlugs: normalizeStringArray(source.updatedRecipeSlugs),
    skippedRecipeSlugs: normalizeStringArray(source.skippedRecipeSlugs),
  };
}

function normalizeIntentProjectRecipeAuditEntry(raw: unknown): IntentProjectRecipeAuditEntry | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  const auditId = normalizeString(source.auditId);
  const occurredAt = normalizeString(source.occurredAt);
  const writtenTo = normalizeString(source.writtenTo);
  if (!auditId || !occurredAt || !writtenTo) return null;

  return {
    auditId,
    occurredAt,
    operation:
      source.operation === 'merge' || source.operation === 'update' || source.operation === 'restore'
        ? source.operation
        : 'register',
    projectUid: normalizeString(source.projectUid),
    actorLabel: normalizeString(source.actorLabel) || 'system',
    title: normalizeString(source.title) || '项目 recipe 审计记录',
    detail: normalizeString(source.detail),
    writtenTo,
    backupPath: normalizeString(source.backupPath) || null,
    comparison: normalizeIntentProjectRecipeAuditComparison(source.comparison),
  };
}

function buildIntentProjectRecipeAuditTitle(
  operation: IntentProjectRecipeAuditOperation,
  comparison: IntentProjectRecipeAuditComparison
): string {
  const changedCount = comparison.addedRecipeSlugs.length + comparison.updatedRecipeSlugs.length;
  switch (operation) {
    case 'merge':
      return `项目 recipe merge（变更 ${changedCount} 条）`;
    case 'restore':
      return `项目 recipe restore（变更 ${changedCount} 条）`;
    case 'update':
      return `项目 recipe update（变更 ${changedCount} 条）`;
    case 'register':
    default:
      return `项目 recipe register（变更 ${changedCount} 条）`;
  }
}

function buildIntentProjectRecipeAuditDetail(
  operation: IntentProjectRecipeAuditOperation,
  comparison: IntentProjectRecipeAuditComparison,
  backupPath: string | null
): string {
  const parts = [
    `recipes ${comparison.beforeRecipeCount} -> ${comparison.afterRecipeCount}`,
    comparison.addedRecipeSlugs.length > 0 ? `新增 ${comparison.addedRecipeSlugs.join(', ')}` : '',
    (comparison.removedRecipeSlugs || []).length > 0 ? `移除 ${(comparison.removedRecipeSlugs || []).join(', ')}` : '',
    comparison.updatedRecipeSlugs.length > 0 ? `更新 ${comparison.updatedRecipeSlugs.join(', ')}` : '',
    comparison.skippedRecipeSlugs.length > 0 ? `跳过 ${comparison.skippedRecipeSlugs.join(', ')}` : '',
    backupPath ? `备份 ${backupPath}` : '',
  ].filter(Boolean);
  return `${operation}：${parts.join('；')}`;
}

export function createIntentProjectRecipeAuditEntry(
  input: CreateIntentProjectRecipeAuditEntryInput
): IntentProjectRecipeAuditEntry {
  const comparison = normalizeIntentProjectRecipeAuditComparison(input.comparison);
  const backupPath = input.backupPath?.trim() || null;

  return {
    auditId: `intent-recipe-audit-${randomUUID()}`,
    occurredAt: new Date().toISOString(),
    operation: input.operation,
    projectUid: input.projectUid?.trim() || '',
    actorLabel: input.actorLabel?.trim() || 'system',
    title: buildIntentProjectRecipeAuditTitle(input.operation, comparison),
    detail: buildIntentProjectRecipeAuditDetail(input.operation, comparison, backupPath),
    writtenTo: input.writtenTo,
    backupPath,
    comparison,
  };
}

async function backupIntentProjectRecipeFile(targetPath = resolveProjectRecipeRegistryPath()): Promise<string | null> {
  try {
    const raw = await fsPromises.readFile(targetPath, 'utf8');
    const backupDir = resolveProjectRecipeBackupDir();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${stamp}-${path.basename(targetPath)}`);
    await fsPromises.mkdir(path.dirname(backupPath), { recursive: true });
    await fsPromises.writeFile(backupPath, raw, 'utf8');
    return toDisplayPath(backupPath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function registerIntentProjectRecipes(
  recipes: IntentRecipe[],
  outputPath = resolveProjectRecipeRegistryPath()
): Promise<RegisterIntentProjectRecipesResult> {
  const currentProfile = getIntentProjectRecipeProfile();
  const nextRecipes = currentProfile.recipes.map((item) => cloneIntentRecipe(item));
  const recipeIndexBySlug = new Map(nextRecipes.map((item, index) => [item.slug, index]));
  const addedRecipeSlugs: string[] = [];
  const updatedRecipeSlugs: string[] = [];
  const skippedRecipeSlugs: string[] = [];

  for (const candidate of recipes) {
    const normalized = normalizeRecipe(candidate);
    const candidateSlug = normalizeString((candidate as { slug?: unknown })?.slug);
    if (!normalized) {
      if (candidateSlug) skippedRecipeSlugs.push(candidateSlug);
      continue;
    }

    const existingIndex = recipeIndexBySlug.get(normalized.slug);
    if (existingIndex === undefined) {
      recipeIndexBySlug.set(normalized.slug, nextRecipes.length);
      nextRecipes.push(normalized);
      addedRecipeSlugs.push(normalized.slug);
      continue;
    }

    const previous = nextRecipes[existingIndex];
    if (JSON.stringify(previous) === JSON.stringify(normalized)) {
      skippedRecipeSlugs.push(normalized.slug);
      continue;
    }

    nextRecipes[existingIndex] = normalized;
    updatedRecipeSlugs.push(normalized.slug);
  }

  const nextProfile = normalizeProfile({
    version: 1,
    recipes: nextRecipes,
  });
  const shouldWrite = addedRecipeSlugs.length > 0 || updatedRecipeSlugs.length > 0;
  const backupPath = shouldWrite ? await backupIntentProjectRecipeFile(outputPath) : null;
  const writtenTo = shouldWrite ? await writeIntentProjectRecipeProfile(nextProfile, outputPath) : toDisplayPath(outputPath);

  return {
    writtenTo,
    backupPath,
    addedRecipeSlugs: uniqueStrings(addedRecipeSlugs),
    updatedRecipeSlugs: uniqueStrings(updatedRecipeSlugs),
    skippedRecipeSlugs: uniqueStrings(skippedRecipeSlugs),
    profile: nextProfile,
  };
}

export async function mergeIntentProjectRecipes(
  recipes: IntentProjectRecipeMergeInput[],
  outputPath = resolveProjectRecipeRegistryPath()
): Promise<MergeIntentProjectRecipesResult> {
  const currentProfile = getIntentProjectRecipeProfile();
  const nextRecipes = currentProfile.recipes.map((item) => cloneIntentRecipe(item));
  const recipeIndexBySlug = new Map(nextRecipes.map((item, index) => [item.slug, index]));
  const addedRecipeSlugs: string[] = [];
  const updatedRecipeSlugs: string[] = [];
  const skippedRecipeSlugs: string[] = [];

  for (const candidate of recipes) {
    const normalized = normalizeMergeInput(candidate);
    const candidateSlug = normalizeString((candidate as { slug?: unknown })?.slug);
    if (!normalized) {
      if (candidateSlug) skippedRecipeSlugs.push(candidateSlug);
      continue;
    }

    const existingIndex = recipeIndexBySlug.get(normalized.slug);
    const existing = existingIndex === undefined ? null : nextRecipes[existingIndex];
    const merged = mergeIntentRecipe(existing, normalized);
    if (!merged) {
      skippedRecipeSlugs.push(normalized.slug);
      continue;
    }

    if (!existing) {
      recipeIndexBySlug.set(merged.slug, nextRecipes.length);
      nextRecipes.push(merged);
      addedRecipeSlugs.push(merged.slug);
      continue;
    }

    if (JSON.stringify(existing) === JSON.stringify(merged)) {
      skippedRecipeSlugs.push(merged.slug);
      continue;
    }

    if (existingIndex === undefined) {
      skippedRecipeSlugs.push(merged.slug);
      continue;
    }

    nextRecipes[existingIndex] = merged;
    updatedRecipeSlugs.push(merged.slug);
  }

  const nextProfile = normalizeProfile({
    version: 1,
    recipes: nextRecipes,
  });
  const shouldWrite = addedRecipeSlugs.length > 0 || updatedRecipeSlugs.length > 0;
  const backupPath = shouldWrite ? await backupIntentProjectRecipeFile(outputPath) : null;
  const writtenTo = shouldWrite ? await writeIntentProjectRecipeProfile(nextProfile, outputPath) : toDisplayPath(outputPath);

  return {
    writtenTo,
    backupPath,
    beforeRecipeCount: currentProfile.recipes.length,
    afterRecipeCount: nextProfile.recipes.length,
    addedRecipeSlugs: uniqueStrings(addedRecipeSlugs),
    updatedRecipeSlugs: uniqueStrings(updatedRecipeSlugs),
    skippedRecipeSlugs: uniqueStrings(skippedRecipeSlugs),
    profile: nextProfile,
  };
}

export async function updateIntentProjectRecipe(
  recipe: IntentProjectRecipeMergeInput,
  outputPath = resolveProjectRecipeRegistryPath()
): Promise<MergeIntentProjectRecipesResult> {
  const slug = normalizeString(recipe.slug);
  if (!slug) {
    throw new Error('缺少必要字段: slug');
  }

  const currentProfile = getIntentProjectRecipeProfile();
  if (!currentProfile.recipes.some((item) => item.slug === slug)) {
    throw new Error(`目标 recipe 不存在: ${slug}`);
  }

  return mergeIntentProjectRecipes([recipe], outputPath);
}

export async function listIntentProjectRecipeBackups(
  limit = 12,
  outputPath = resolveProjectRecipeRegistryPath(),
  backupDir = resolveProjectRecipeBackupDir()
): Promise<ListIntentProjectRecipeBackupsResult> {
  const normalizedLimit = Math.max(1, Math.floor(limit || 12));
  const absoluteBackupDir = toAbsolutePath(backupDir);
  const targetBaseName = path.basename(outputPath);

  let entries: IntentProjectRecipeBackupItem[] = [];
  try {
    const dirEntries = await fsPromises.readdir(absoluteBackupDir, { withFileTypes: true });
    entries = (
      await Promise.all(
        dirEntries
          .filter((entry) => entry.isFile() && entry.name.endsWith(targetBaseName))
          .map(async (entry) => {
            const absolutePath = path.join(absoluteBackupDir, entry.name);
            const stat = await fsPromises.stat(absolutePath);
            return {
              path: toDisplayPath(absolutePath),
              fileName: entry.name,
              createdAt: stat.mtime.toISOString(),
              sizeBytes: stat.size,
            } satisfies IntentProjectRecipeBackupItem;
          })
      )
    ).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException | undefined)?.code !== 'ENOENT') {
      throw error;
    }
  }

  return {
    registryPath: toDisplayPath(outputPath),
    backupDir: toDisplayPath(absoluteBackupDir),
    backups: entries.slice(0, normalizedLimit),
  };
}

export async function restoreIntentProjectRecipeBackup(
  backupPath: string | null | undefined,
  outputPath = resolveProjectRecipeRegistryPath(),
  backupDir = resolveProjectRecipeBackupDir()
): Promise<RestoreIntentProjectRecipeBackupResult> {
  const currentProfile = getIntentProjectRecipeProfile();
  const backups = await listIntentProjectRecipeBackups(50, outputPath, backupDir);
  const selectedDisplayPath = backupPath?.trim() || backups.backups[0]?.path || '';
  if (!selectedDisplayPath) {
    throw new Error('当前没有可用的项目 recipe 备份可恢复');
  }

  const absoluteBackupDir = toAbsolutePath(backupDir);
  const absoluteBackupPath = toAbsolutePath(selectedDisplayPath);
  if (!isPathInsideDir(absoluteBackupPath, absoluteBackupDir)) {
    throw new Error('备份路径不在允许的回滚目录内');
  }

  const raw = await fsPromises.readFile(absoluteBackupPath, 'utf8');
  const restoredProfile = normalizeProfile(JSON.parse(raw));
  const backupCreated = await backupIntentProjectRecipeFile(outputPath);
  const writtenTo = await writeIntentProjectRecipeProfile(restoredProfile, outputPath);
  const comparison = buildIntentProjectRecipeProfileComparison(currentProfile, restoredProfile);

  return {
    restoredFrom: toDisplayPath(absoluteBackupPath),
    writtenTo,
    backupCreated,
    comparison,
    profile: restoredProfile,
  };
}

export async function writeIntentProjectRecipeAuditEntry(
  entry: IntentProjectRecipeAuditEntry,
  auditPath = resolveProjectRecipeAuditPath()
): Promise<IntentProjectRecipeAuditEntry> {
  const normalized = normalizeIntentProjectRecipeAuditEntry(entry);
  if (!normalized) {
    throw new Error('项目 recipe 审计记录格式无效');
  }

  await fsPromises.mkdir(path.dirname(auditPath), { recursive: true });
  await fsPromises.appendFile(auditPath, `${JSON.stringify(normalized)}\n`, 'utf8');
  return normalized;
}

export async function listIntentProjectRecipeAuditEntries(
  limit = 12,
  projectUid = '',
  auditPath = resolveProjectRecipeAuditPath()
): Promise<ListIntentProjectRecipeAuditEntriesResult> {
  const normalizedLimit = Math.max(1, Math.floor(limit || 12));
  const normalizedProjectUid = projectUid.trim();
  const items: IntentProjectRecipeAuditEntry[] = [];

  try {
    const raw = await fsPromises.readFile(auditPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean).reverse();

    for (const line of lines) {
      try {
        const parsed = normalizeIntentProjectRecipeAuditEntry(JSON.parse(line));
        if (!parsed) continue;
        if (normalizedProjectUid && parsed.projectUid !== normalizedProjectUid) continue;
        items.push(parsed);
        if (items.length >= normalizedLimit) break;
      } catch {
        continue;
      }
    }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException | undefined)?.code !== 'ENOENT') {
      throw error;
    }
  }

  return {
    auditLogPath: toDisplayPath(auditPath),
    items,
  };
}

export function resetIntentProjectRecipeCache(): void {
  cachePath = '';
  cacheProfile = null;
}
