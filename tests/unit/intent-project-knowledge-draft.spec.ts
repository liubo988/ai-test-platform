import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recordIntentRepairFailure, recordIntentRepairResolution, resetIntentRepairMemoryCache } from '@/lib/ai/intent-repair-memory';
import { resetIntentProjectKnowledgeCache } from '@/lib/intent-project-knowledge';
import {
  generateIntentProjectKnowledgeDraft,
  mergeIntentProjectKnowledgeDraftCandidates,
  renderIntentProjectKnowledgeDraftSummary,
  writeIntentProjectKnowledgeDraft,
} from '@/lib/intent-project-knowledge-draft';

let tempDir = '';
let memoryPath = '';
let knowledgePath = '';
let draftPath = '';
let backupDir = '';

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-project-knowledge-draft-'));
  memoryPath = path.join(tempDir, 'repair-memory.json');
  knowledgePath = path.join(tempDir, 'project-knowledge.json');
  draftPath = path.join(tempDir, 'project-knowledge.draft.json');
  backupDir = path.join(tempDir, 'project-knowledge-backups');
  process.env.INTENT_E2E_REPAIR_MEMORY_PATH = memoryPath;
  process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH = knowledgePath;
  process.env.INTENT_E2E_PROJECT_KNOWLEDGE_DRAFT_PATH = draftPath;
  process.env.INTENT_E2E_PROJECT_KNOWLEDGE_BACKUP_DIR = backupDir;
  resetIntentRepairMemoryCache();
  resetIntentProjectKnowledgeCache();
  await fs.writeFile(knowledgePath, JSON.stringify({ version: 1, rules: [] }, null, 2), 'utf8');
});

afterEach(async () => {
  delete process.env.INTENT_E2E_REPAIR_MEMORY_PATH;
  delete process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH;
  delete process.env.INTENT_E2E_PROJECT_KNOWLEDGE_DRAFT_PATH;
  delete process.env.INTENT_E2E_PROJECT_KNOWLEDGE_BACKUP_DIR;
  resetIntentRepairMemoryCache();
  resetIntentProjectKnowledgeCache();
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe('intent-project-knowledge-draft', () => {
  it('builds project-rule candidates from repeated resolved repair clusters', async () => {
    const failure = {
      targetUrl: 'https://uat.example.com/#/business/businesslist',
      pageTitle: '商机列表',
      description: '创建商机后在列表里生成订单',
      executionError: 'Error: 未找到行操作：查看',
      previousCode: "await page.getByRole('button', { name: '查看' }).click();",
      recentEvents: ['INFO createOrder success'],
    };

    const first = await recordIntentRepairFailure(failure);
    await recordIntentRepairFailure(failure);
    await recordIntentRepairResolution({
      clusterIds: [first.clusterId],
      targetUrl: failure.targetUrl,
      description: failure.description,
      fixedCode: [
        "await __e2e.clickAntdRowAction(page, targetRow, '生成订单');",
        "await __e2e.waitForApiResponse(page, { urlIncludes: '/crmapi/business/createOrder', method: 'POST' });",
      ].join('\n'),
      finalResult: {
        success: true,
        duration: 920,
        steps: [
          {
            title: '生成订单',
            status: 'passed',
            duration: 380,
            at: '2026-03-16T16:00:00.000Z',
          },
        ],
        error: null,
      },
    });

    const draft = await generateIntentProjectKnowledgeDraft();
    const writtenTo = await writeIntentProjectKnowledgeDraft(draft);
    const saved = JSON.parse(await fs.readFile(draftPath, 'utf8'));
    const summary = renderIntentProjectKnowledgeDraftSummary(draft);

    expect(draft.candidates).toHaveLength(1);
    expect(draft.summary.suggestedCandidates).toBe(1);
    expect(draft.candidates[0].category).toBe('row-action-not-found');
    expect(draft.candidates[0].rule.id).toContain('business-businesslist');
    expect(draft.candidates[0].rule.capabilitySlugs).toContain('ui.click-antd-row-action');
    expect(draft.candidates[0].rule.capabilitySlugs).toContain('assert.wait-for-api-response');
    expect(draft.candidates[0].rule.stepPatches[0].addPreferredHelpers).toContain('__e2e.clickAntdRowAction');
    expect(draft.candidates[0].rule.stepPatches[0].stepTextIncludes).toContain('生成订单');
    expect(draft.mergedProfilePreview.rules).toHaveLength(1);
    expect(writtenTo).toBe(draftPath);
    expect(saved.candidates).toHaveLength(1);
    expect(summary).toContain('row-action-not-found');
  });

  it('merges selected draft candidates back into the live knowledge profile', async () => {
    const failure = {
      targetUrl: 'https://uat.example.com/#/business/businesslist',
      pageTitle: '商机列表',
      description: '创建商机后在列表里生成订单',
      executionError: 'Error: 未找到行操作：生成订单',
      previousCode: "await page.getByRole('button', { name: '生成订单' }).click();",
      recentEvents: ['INFO createOrder success'],
    };

    await recordIntentRepairFailure(failure);
    const second = await recordIntentRepairFailure(failure);
    await recordIntentRepairResolution({
      clusterIds: [second.clusterId],
      targetUrl: failure.targetUrl,
      description: failure.description,
      fixedCode: [
        "await __e2e.clickAntdRowAction(page, targetRow, '生成订单');",
        "await __e2e.waitForApiResponse(page, { urlIncludes: '/crmapi/business/createOrder', method: 'POST' });",
      ].join('\n'),
      finalResult: {
        success: true,
        duration: 680,
        steps: [],
        error: null,
      },
    });

    const draft = await generateIntentProjectKnowledgeDraft();
    const mergeResult = await mergeIntentProjectKnowledgeDraftCandidates(draft, [draft.candidates[0].candidateId]);
    const savedProfile = JSON.parse(await fs.readFile(knowledgePath, 'utf8'));
    const savedBackup = JSON.parse(await fs.readFile(String(mergeResult.backupPath), 'utf8'));
    const nextDraft = await generateIntentProjectKnowledgeDraft();

    expect(mergeResult.addedRuleIds).toEqual([draft.candidates[0].rule.id]);
    expect(mergeResult.mergedCandidateIds).toEqual([draft.candidates[0].candidateId]);
    expect(mergeResult.coveredCandidateIds).toEqual([]);
    expect(mergeResult.writtenTo).toBe(knowledgePath);
    expect(mergeResult.backupPath).toContain('project-knowledge-backups');
    expect(mergeResult.diffPreview).toContain(`rules: 0 -> 1`);
    expect(mergeResult.diffPreview).toContain(`+ ${draft.candidates[0].rule.id}`);
    expect(mergeResult.summary.beforeRuleCount).toBe(0);
    expect(mergeResult.summary.afterRuleCount).toBe(1);
    expect(mergeResult.comparison.before.ruleCount).toBe(0);
    expect(mergeResult.comparison.after.ruleCount).toBe(1);
    expect(mergeResult.comparison.addedRuleIds).toEqual([draft.candidates[0].rule.id]);
    expect(mergeResult.summary.addedRules[0].ruleId).toBe(draft.candidates[0].rule.id);
    expect(savedBackup.rules).toHaveLength(0);
    expect(savedProfile.rules).toHaveLength(1);
    expect(savedProfile.rules[0].id).toBe(draft.candidates[0].rule.id);
    expect(nextDraft.candidates[0].alreadyCovered).toBe(true);
  });

  it('marks auto-generated rules as already covered when current knowledge overlaps', async () => {
    await fs.writeFile(
      knowledgePath,
      JSON.stringify(
        {
          version: 1,
          rules: [
            {
              id: 'business.row-action-existing',
              title: '商机列表 · 行操作稳定化',
              match: { urlIncludes: ['/business/businesslist'] },
              promptNotes: [],
              capabilitySlugs: ['ui.click-antd-row-action'],
              addGlobalRules: [],
              addPreferredPrimitives: [],
              addOutputContract: [],
              stepPatches: [
                {
                  whenStepTypes: ['ui'],
                  stepTextIncludes: ['查看', '生成订单'],
                  addAllowedActions: ['click_row_action'],
                  addPreferredHelpers: ['__e2e.clickAntdRowAction'],
                  addRequiredAssertions: [],
                  addForbiddenPatterns: [],
                },
              ],
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );
    resetIntentProjectKnowledgeCache();

    const failure = {
      targetUrl: 'https://uat.example.com/#/business/businesslist',
      pageTitle: '商机列表',
      description: '商机列表中打开查看详情',
      executionError: 'Error: 未找到行操作：查看',
      previousCode: "await page.getByRole('button', { name: '查看' }).click();",
      recentEvents: [],
    };

    await recordIntentRepairFailure(failure);
    const second = await recordIntentRepairFailure(failure);
    await recordIntentRepairResolution({
      clusterIds: [second.clusterId],
      targetUrl: failure.targetUrl,
      description: failure.description,
      fixedCode: "await __e2e.clickAntdRowAction(page, targetRow, '查看');",
      finalResult: {
        success: true,
        duration: 540,
        steps: [],
        error: null,
      },
    });

    const draft = await generateIntentProjectKnowledgeDraft();

    expect(draft.candidates).toHaveLength(1);
    expect(draft.candidates[0].alreadyCovered).toBe(true);
    expect(draft.candidates[0].coveredByRuleIds).toContain('business.row-action-existing');
    expect(draft.summary.alreadyCoveredCandidates).toBe(1);
    expect(draft.mergedProfilePreview.rules).toHaveLength(1);
  });
});
