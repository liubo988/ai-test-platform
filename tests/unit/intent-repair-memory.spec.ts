import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getIntentRepairMemoryPath,
  listRelevantIntentRepairHints,
  recordIntentRepairFailure,
  recordIntentRepairResolution,
  renderIntentRepairMemoryHints,
  resetIntentRepairMemoryCache,
} from '@/lib/ai/intent-repair-memory';

let tempDir = '';
let memoryFile = '';
let projectAssetRoot = '';

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-repair-memory-'));
  memoryFile = path.join(tempDir, 'intent-e2e-repair-memory.json');
  projectAssetRoot = path.join(tempDir, 'projects');
  process.env.INTENT_E2E_REPAIR_MEMORY_PATH = memoryFile;
  process.env.INTENT_E2E_PROJECT_ASSET_ROOT = projectAssetRoot;
  resetIntentRepairMemoryCache();
});

afterEach(async () => {
  delete process.env.INTENT_E2E_REPAIR_MEMORY_PATH;
  delete process.env.INTENT_E2E_PROJECT_ASSET_ROOT;
  resetIntentRepairMemoryCache();
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe('intent repair memory', () => {
  it('clusters repeated failures and recalls matching hints', async () => {
    const failureInput = {
      targetUrl: 'https://uat.example.com/#/business/businesslist',
      pageTitle: '商机列表',
      description: '创建商机并生成订单',
      executionError: 'Error: 未找到行操作：查看',
      previousCode: "await __e2e.clickAntdRowAction(page, targetRow, '查看');",
      recentEvents: ['INFO createOrder success'],
      observationTags: ['obs-page-surface', 'obs-anchor-missing'],
    };

    const first = await recordIntentRepairFailure(failureInput);
    const repeated = await recordIntentRepairFailure(failureInput);
    const hints = await listRelevantIntentRepairHints(failureInput);
    const saved = JSON.parse(await fs.readFile(memoryFile, 'utf8'));

    expect(repeated.clusterId).toBe(first.clusterId);
    expect(repeated.category).toBe('row-action-not-found');
    expect(repeated.seenCount).toBe(2);
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      clusterId: first.clusterId,
      category: 'row-action-not-found',
      seenCount: 2,
    });
    expect(hints[0].tags).toContain('row-action');
    expect(hints[0].tags).toContain('obs-page-surface');
    expect(hints[0].tags).toContain('obs-anchor-missing');
    expect(saved.clusters).toHaveLength(1);
    expect(saved.clusters[0].clusterId).toBe(first.clusterId);
  });

  it('falls back to legacy memory for project reads but writes subsequent project updates into project-scoped files', async () => {
    const failureInput = {
      targetUrl: 'https://uat.example.com/#/business/businesslist',
      pageTitle: '商机列表',
      description: '创建商机并生成订单',
      executionError: 'Error: 未找到行操作：查看',
      previousCode: "await __e2e.clickAntdRowAction(page, targetRow, '查看');",
      recentEvents: ['INFO createOrder success'],
    };

    const first = await recordIntentRepairFailure(failureInput);
    const projectUid = 'proj alpha';
    const projectMemoryPath = path.join(projectAssetRoot, 'proj-alpha', 'intent-e2e-repair-memory.json');

    expect(getIntentRepairMemoryPath(projectUid)).toBe(memoryFile);
    expect(
      getIntentRepairMemoryPath(projectUid, {
        mode: 'write',
        legacyFallback: false,
      })
    ).toBe(projectMemoryPath);

    const fallbackHints = await listRelevantIntentRepairHints(failureInput, 3, { projectUid });
    await recordIntentRepairFailure(failureInput, { projectUid });
    const projectHints = await listRelevantIntentRepairHints(failureInput, 3, { projectUid });

    const legacySaved = JSON.parse(await fs.readFile(memoryFile, 'utf8')) as { clusters: Array<{ seenCount: number }> };
    const projectSaved = JSON.parse(await fs.readFile(projectMemoryPath, 'utf8')) as { clusters: Array<{ seenCount: number }> };

    expect(fallbackHints[0]?.clusterId).toBe(first.clusterId);
    expect(projectHints[0]?.seenCount).toBe(2);
    expect(legacySaved.clusters[0]?.seenCount).toBe(1);
    expect(projectSaved.clusters[0]?.seenCount).toBe(2);
    expect(getIntentRepairMemoryPath(projectUid)).toBe(projectMemoryPath);
  });

  it('stores successful strategies and renders concise memory hints', async () => {
    const failureInput = {
      targetUrl: 'https://uat.example.com/#/business/createbusiness',
      pageTitle: '创建商机',
      description: '填写商机来源并保存',
      executionError: 'Error: 未能打开当前字段的下拉面板',
      previousCode: [
        "await page.getByText('抖音', { exact: true }).click();",
        'await page.waitForTimeout(1000);',
      ].join('\n'),
      recentEvents: ['INFO open dropdown failed'],
    };

    const failure = await recordIntentRepairFailure(failureInput);
    await recordIntentRepairResolution({
      clusterIds: [failure.clusterId],
      targetUrl: failureInput.targetUrl,
      description: failureInput.description,
      fixedCode: [
        "await __e2e.selectAntdOption(page, sourceField, { label: '抖音', searchText: '抖音' });",
        "await __e2e.waitForApiResponse(page, '/crmapi/business/createOrder');",
      ].join('\n'),
      finalResult: {
        success: true,
        duration: 820,
        steps: [
          {
            title: '选择商机来源',
            status: 'passed',
            duration: 120,
            at: '2026-03-16T10:20:00.000Z',
          },
        ],
        error: null,
      },
    });

    const hints = await listRelevantIntentRepairHints(failureInput);
    const rendered = renderIntentRepairMemoryHints(hints);
    const saved = JSON.parse(await fs.readFile(memoryFile, 'utf8'));

    expect(hints[0].resolvedCount).toBe(1);
    expect(hints[0].successfulStrategies).toContain('__e2e.selectAntdOption');
    expect(hints[0].successfulStrategies).toContain('__e2e.waitForApiResponse');
    expect(rendered).toContain('## 历史相似失败记忆');
    expect(rendered).toContain(`cluster=${failure.clusterId}`);
    expect(rendered).toContain('常用修法:');
    expect(rendered).toContain('把 page.waitForTimeout 当成主同步手段');
    expect(saved.clusters[0].resolvedCount).toBe(1);
    expect(saved.clusters[0].successfulStrategies).toContain('__e2e.selectAntdOption');
  });
});
