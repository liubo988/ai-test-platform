import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildIntentE2EProjectAssetAvailability } from '@/lib/intent-e2e-asset-readiness';

let tempDir = '';
let legacyKnowledgePath = '';
let legacyRepairMemoryPath = '';
let projectAssetRoot = '';

function ensureJson(filePath: string, payload: unknown = { version: 1 }): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-e2e-asset-readiness-'));
  legacyKnowledgePath = path.join(tempDir, 'intent-e2e.project-knowledge.json');
  legacyRepairMemoryPath = path.join(tempDir, 'intent-e2e-repair-memory.json');
  projectAssetRoot = path.join(tempDir, 'projects');
  process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH = legacyKnowledgePath;
  process.env.INTENT_E2E_REPAIR_MEMORY_PATH = legacyRepairMemoryPath;
  process.env.INTENT_E2E_PROJECT_ASSET_ROOT = projectAssetRoot;
});

afterEach(() => {
  delete process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH;
  delete process.env.INTENT_E2E_REPAIR_MEMORY_PATH;
  delete process.env.INTENT_E2E_PROJECT_ASSET_ROOT;
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('buildIntentE2EProjectAssetAvailability', () => {
  it('keeps real cold-start projects blocked even when a legacy global knowledge file exists', () => {
    ensureJson(legacyKnowledgePath);

    const availability = buildIntentE2EProjectAssetAvailability({
      projectUid: 'proj_cold',
    });

    expect(availability).toEqual({
      status: 'asset_missing',
      projectUid: 'proj_cold',
      onboardingPath: path.join(projectAssetRoot, 'proj_cold', 'intent-e2e.project-onboarding.json'),
      knowledgePath: path.join(projectAssetRoot, 'proj_cold', 'intent-e2e.project-knowledge.json'),
      repairMemoryPath: path.join(projectAssetRoot, 'proj_cold', 'intent-e2e-repair-memory.json'),
      hasOnboarding: false,
      onboardingReady: false,
      hasKnowledgeAsset: false,
      hasRepairMemoryAsset: false,
      reasons: ['onboarding_manifest_missing', 'project_knowledge_missing', 'repair_memory_missing'],
    });
  });

  it('treats legacy knowledge plus project-scoped repair memory as compatible historical assets', () => {
    ensureJson(legacyKnowledgePath);
    ensureJson(path.join(projectAssetRoot, 'proj_default', 'intent-e2e-repair-memory.json'));

    const availability = buildIntentE2EProjectAssetAvailability({
      projectUid: 'proj_default',
    });

    expect(availability).toEqual({
      status: 'ready',
      projectUid: 'proj_default',
      onboardingPath: path.join(projectAssetRoot, 'proj_default', 'intent-e2e.project-onboarding.json'),
      knowledgePath: legacyKnowledgePath,
      repairMemoryPath: path.join(projectAssetRoot, 'proj_default', 'intent-e2e-repair-memory.json'),
      hasOnboarding: false,
      onboardingReady: false,
      hasKnowledgeAsset: true,
      hasRepairMemoryAsset: true,
      reasons: [],
    });
  });

  it('does not force onboarding for legacy projects that already have project-scoped knowledge', () => {
    ensureJson(path.join(projectAssetRoot, 'proj_legacy', 'intent-e2e.project-knowledge.json'));

    const availability = buildIntentE2EProjectAssetAvailability({
      projectUid: 'proj_legacy',
    });

    expect(availability).toEqual({
      status: 'ready',
      projectUid: 'proj_legacy',
      onboardingPath: path.join(projectAssetRoot, 'proj_legacy', 'intent-e2e.project-onboarding.json'),
      knowledgePath: path.join(projectAssetRoot, 'proj_legacy', 'intent-e2e.project-knowledge.json'),
      repairMemoryPath: path.join(projectAssetRoot, 'proj_legacy', 'intent-e2e-repair-memory.json'),
      hasOnboarding: false,
      onboardingReady: false,
      hasKnowledgeAsset: true,
      hasRepairMemoryAsset: false,
      reasons: ['repair_memory_missing'],
    });
  });
});
