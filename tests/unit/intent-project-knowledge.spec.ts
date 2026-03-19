import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildIntentActionDSL } from '@/lib/intent-action-dsl';
import {
  applyIntentProjectKnowledgeToDsl,
  listIntentProjectKnowledgeBackups,
  mergeIntentProjectKnowledgeRules,
  renderIntentProjectKnowledge,
  resetIntentProjectKnowledgeCache,
  resolveIntentProjectKnowledge,
  restoreIntentProjectKnowledgeBackup,
} from '@/lib/intent-project-knowledge';

let tempDir = '';
let knowledgeFile = '';

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-project-knowledge-'));
  knowledgeFile = path.join(tempDir, 'project-knowledge.json');
  process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH = knowledgeFile;
  resetIntentProjectKnowledgeCache();
});

afterEach(() => {
  delete process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH;
  resetIntentProjectKnowledgeCache();
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('intent-project-knowledge', () => {
  it('matches configured project rules and patches the DSL', () => {
    fs.writeFileSync(
      knowledgeFile,
      JSON.stringify(
        {
          version: 1,
          rules: [
            {
              id: 'custom.checkout-submit',
              title: '结算提交页',
              match: {
                urlIncludes: ['/checkout'],
                descriptionIncludes: ['提交订单'],
              },
              promptNotes: ['提交类场景要先等接口成功，再断言成功页。'],
              capabilitySlugs: ['assert.wait-for-api-response'],
              addGlobalRules: ['结算提交页优先等待 /api/checkout/submit 响应成功。'],
              stepPatches: [
                {
                  whenStepTypes: ['ui', 'assert'],
                  stepTextIncludes: ['提交订单', '成功页'],
                  addAllowedActions: ['wait_for_response', 'assert_response_ok'],
                  addPreferredHelpers: ['__e2e.waitForApiResponse'],
                  addRequiredAssertions: ['/api/checkout/submit 响应成功', '成功页主标题出现'],
                  addForbiddenPatterns: ['只看 toast 不等接口'],
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

    const baseDsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/checkout',
      featureDescription: '填写手机号后提交订单',
      expectedOutcome: '成功页出现',
      steps: [
        {
          stepUid: 'step_1',
          stepType: 'ui',
          title: '提交订单',
          target: 'https://example.com/checkout',
          instruction: '点击提交订单按钮并等待跳转',
          expectedResult: '成功页出现',
          extractVariable: '',
        },
      ],
    });

    const resolution = resolveIntentProjectKnowledge({
      snapshot: {
        url: 'https://example.com/checkout',
        title: 'Checkout',
        buttons: [],
        headings: [{ level: 'H1', text: 'Checkout' }],
        bodyTextExcerpt: '来源 提交订单 成功页',
        frames: [],
      },
      description: '填写手机号并提交订单，最后看到成功页',
      dsl: baseDsl,
    });
    const patched = applyIntentProjectKnowledgeToDsl(baseDsl, resolution);
    const rendered = renderIntentProjectKnowledge(resolution);

    expect(resolution.matches).toHaveLength(1);
    expect(resolution.matches[0].ruleId).toBe('custom.checkout-submit');
    expect(resolution.capabilitySlugs).toContain('assert.wait-for-api-response');
    expect(patched.globalRules.join('\n')).toContain('/api/checkout/submit');
    expect(patched.steps[0].allowedActions).toContain('wait_for_response');
    expect(patched.steps[0].preferredHelpers).toContain('__e2e.waitForApiResponse');
    expect(patched.steps[0].requiredAssertions).toContain('/api/checkout/submit 响应成功');
    expect(patched.steps[0].forbiddenPatterns).toContain('只看 toast 不等接口');
    expect(rendered).toContain('## 项目知识规则（动态裁剪）');
    expect(rendered).toContain('custom.checkout-submit');
    expect(rendered).toContain('提交类场景要先等接口成功');
  });

  it('lists backups and restores the selected backup into the live profile', async () => {
    fs.writeFileSync(
      knowledgeFile,
      JSON.stringify(
        {
          version: 1,
          rules: [
            {
              id: 'custom.checkout-submit',
              title: '结算提交页',
              match: { urlIncludes: ['/checkout'] },
              promptNotes: ['先等接口成功'],
              capabilitySlugs: ['assert.wait-for-api-response'],
              addGlobalRules: [],
              addPreferredPrimitives: [],
              addOutputContract: [],
              stepPatches: [],
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    const mergeResult = await mergeIntentProjectKnowledgeRules([
      {
        id: 'custom.orders-list',
        title: '订单列表',
        match: { urlIncludes: ['/orders'] },
        promptNotes: ['优先等待列表渲染'],
        capabilitySlugs: ['assert.wait-for-table-ready'],
        addGlobalRules: [],
        addPreferredPrimitives: [],
        addOutputContract: [],
        stepPatches: [],
      },
    ]);

    const backups = await listIntentProjectKnowledgeBackups();
    const restored = await restoreIntentProjectKnowledgeBackup(backups.backups[0]?.path || null);
    const liveProfile = JSON.parse(fs.readFileSync(knowledgeFile, 'utf8'));

    expect(mergeResult.backupPath).toBeTruthy();
    expect(backups.backups.length).toBeGreaterThan(0);
    expect(backups.backups[0].path).toBe(mergeResult.backupPath);
    expect(restored.restoredFrom).toBe(mergeResult.backupPath);
    expect(restored.backupCreated).toBeTruthy();
    expect(restored.profile.rules).toHaveLength(1);
    expect(restored.profile.rules[0].id).toBe('custom.checkout-submit');
    expect(liveProfile.rules).toHaveLength(1);
    expect(liveProfile.rules[0].id).toBe('custom.checkout-submit');
  });

  it('returns empty matches when no knowledge file exists', () => {
    const baseDsl = buildIntentActionDSL({
      taskMode: 'page',
      targetUrl: 'https://example.com/plain',
      featureDescription: '访问普通页面',
      expectedOutcome: '页面可见',
    });

    const resolution = resolveIntentProjectKnowledge({
      snapshot: {
        url: 'https://example.com/plain',
        title: 'Plain Page',
        buttons: [],
        headings: [],
        bodyTextExcerpt: 'hello',
        frames: [],
      },
      description: '访问页面并验证可见',
      dsl: baseDsl,
    });

    expect(resolution.matches).toEqual([]);
    expect(renderIntentProjectKnowledge(resolution)).toBe('');
  });
});
