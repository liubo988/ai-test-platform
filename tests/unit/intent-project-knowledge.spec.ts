import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildIntentActionDSL } from '@/lib/intent-action-dsl';
import {
  applyIntentProjectKnowledgeToDsl,
  createIntentProjectKnowledgeAuditEntry,
  listIntentProjectKnowledgeBackups,
  listIntentProjectKnowledgeAuditEntries,
  mergeIntentProjectKnowledgeRules,
  renderIntentProjectKnowledge,
  resetIntentProjectKnowledgeCache,
  resolveIntentProjectKnowledge,
  restoreIntentProjectKnowledgeBackup,
  writeIntentProjectKnowledgeAuditEntry,
} from '@/lib/intent-project-knowledge';

let tempDir = '';
let knowledgeFile = '';
let auditFile = '';

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-project-knowledge-'));
  knowledgeFile = path.join(tempDir, 'project-knowledge.json');
  auditFile = path.join(tempDir, 'project-knowledge.audit.jsonl');
  process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH = knowledgeFile;
  process.env.INTENT_E2E_PROJECT_KNOWLEDGE_AUDIT_PATH = auditFile;
  resetIntentProjectKnowledgeCache();
});

afterEach(() => {
  delete process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH;
  delete process.env.INTENT_E2E_PROJECT_KNOWLEDGE_AUDIT_PATH;
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
    expect(mergeResult.comparison.before.ruleCount).toBe(1);
    expect(mergeResult.comparison.after.ruleCount).toBe(2);
    expect(mergeResult.comparison.addedRuleIds).toEqual(['custom.orders-list']);
    expect(backups.backups.length).toBeGreaterThan(0);
    expect(backups.backups[0].path).toBe(mergeResult.backupPath);
    expect(restored.restoredFrom).toBe(mergeResult.backupPath);
    expect(restored.backupCreated).toBeTruthy();
    expect(restored.comparison.before.ruleCount).toBe(2);
    expect(restored.comparison.after.ruleCount).toBe(1);
    expect(restored.comparison.removedRuleIds).toEqual(['custom.orders-list']);
    expect(restored.profile.rules).toHaveLength(1);
    expect(restored.profile.rules[0].id).toBe('custom.checkout-submit');
    expect(liveProfile.rules).toHaveLength(1);
    expect(liveProfile.rules[0].id).toBe('custom.checkout-submit');
  });

  it('writes and filters project knowledge audit entries', async () => {
    const mergeAudit = await writeIntentProjectKnowledgeAuditEntry(
      createIntentProjectKnowledgeAuditEntry({
        operation: 'merge',
        projectUid: 'proj_alpha',
        actorLabel: 'bobo',
        writtenTo: 'intent-e2e.project-knowledge.json',
        backupPath: 'reports/intent-e2e.project-knowledge.backups/before-merge.json',
        comparison: {
          before: {
            ruleCount: 1,
            enabledRuleCount: 1,
            capabilitySlugCount: 1,
            preferredHelperCount: 1,
            stepPatchCount: 1,
            urlPatternCount: 1,
          },
          after: {
            ruleCount: 2,
            enabledRuleCount: 2,
            capabilitySlugCount: 2,
            preferredHelperCount: 3,
            stepPatchCount: 2,
            urlPatternCount: 2,
          },
          addedRuleIds: ['custom.orders-list'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          requestedCandidateIds: ['candidate-1'],
          mergedCandidateIds: ['candidate-1'],
          projectActivityLogged: true,
        },
      })
    );
    const restoreAudit = await writeIntentProjectKnowledgeAuditEntry(
      createIntentProjectKnowledgeAuditEntry({
        operation: 'restore',
        projectUid: 'proj_beta',
        actorLabel: 'system',
        writtenTo: 'intent-e2e.project-knowledge.json',
        backupPath: 'reports/intent-e2e.project-knowledge.backups/before-restore.json',
        sourcePath: 'reports/intent-e2e.project-knowledge.backups/target-backup.json',
        comparison: {
          before: {
            ruleCount: 2,
            enabledRuleCount: 2,
            capabilitySlugCount: 2,
            preferredHelperCount: 3,
            stepPatchCount: 2,
            urlPatternCount: 2,
          },
          after: {
            ruleCount: 1,
            enabledRuleCount: 1,
            capabilitySlugCount: 1,
            preferredHelperCount: 1,
            stepPatchCount: 1,
            urlPatternCount: 1,
          },
          addedRuleIds: [],
          removedRuleIds: ['custom.orders-list'],
          updatedRuleIds: [],
        },
        meta: {
          restoredFrom: 'reports/intent-e2e.project-knowledge.backups/target-backup.json',
        },
      })
    );

    const allAudits = await listIntentProjectKnowledgeAuditEntries(12);
    const projectAudits = await listIntentProjectKnowledgeAuditEntries(12, 'proj_alpha');

    expect(allAudits.auditLogPath).toBe(auditFile);
    expect(allAudits.items).toHaveLength(2);
    expect(allAudits.items[0].auditId).toBe(restoreAudit.auditId);
    expect(allAudits.items[1].auditId).toBe(mergeAudit.auditId);
    expect(projectAudits.items).toHaveLength(1);
    expect(projectAudits.items[0].projectUid).toBe('proj_alpha');
    expect(projectAudits.items[0].meta.projectActivityLogged).toBe(true);
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

  it('prioritizes historically stable rules and deprioritizes rollback-risk rules', () => {
    fs.writeFileSync(
      knowledgeFile,
      JSON.stringify(
        {
          version: 1,
          rules: [
            {
              id: 'checkout.safe',
              title: '稳定结算规则',
              match: {
                urlIncludes: ['/checkout'],
              },
              promptNotes: ['优先等待 checkout submit 接口。'],
              capabilitySlugs: ['assert.wait-for-api-response'],
              addGlobalRules: ['先等接口后断言成功页。'],
              addPreferredPrimitives: [],
              addOutputContract: [],
              stepPatches: [
                {
                  whenStepTypes: ['ui'],
                  stepTextIncludes: ['提交订单'],
                  addPreferredHelpers: ['__e2e.waitForApiResponse'],
                },
              ],
            },
            {
              id: 'checkout.risky',
              title: '高风险结算规则',
              match: {
                urlIncludes: ['/checkout'],
              },
              promptNotes: ['直接点提交后只看 toast。'],
              capabilitySlugs: ['assert.toast-only'],
              addGlobalRules: ['不要等接口，直接断言 toast。'],
              addPreferredPrimitives: [],
              addOutputContract: [],
              stepPatches: [
                {
                  whenStepTypes: ['ui'],
                  stepTextIncludes: ['提交订单'],
                  addPreferredHelpers: ['__e2e.assertToastVisible'],
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
          instruction: '点击提交订单按钮',
          expectedResult: '成功页出现',
          extractVariable: '',
        },
      ],
    });

    const resolution = resolveIntentProjectKnowledge(
      {
        snapshot: {
          url: 'https://example.com/checkout',
          title: 'Checkout',
          buttons: [],
          headings: [{ level: 'H1', text: 'Checkout' }],
          bodyTextExcerpt: '提交订单 成功页',
          frames: [],
        },
        description: '填写手机号并提交订单，最后看到成功页',
        dsl: baseDsl,
      },
      {
        rulePerformanceById: {
          'checkout.safe': {
            runCount: 7,
            passedRuns: 6,
            failedRuns: 1,
            canceledRuns: 0,
            passRate: 85.7,
            rollbackCandidateCount: 0,
          },
          'checkout.risky': {
            runCount: 6,
            passedRuns: 2,
            failedRuns: 4,
            canceledRuns: 0,
            passRate: 33.3,
            rollbackCandidateCount: 1,
          },
        },
      }
    );
    const patched = applyIntentProjectKnowledgeToDsl(baseDsl, resolution);

    expect(resolution.matches.map((item) => item.ruleId)).toEqual(['checkout.safe']);
    expect(resolution.deprioritizedMatches.map((item) => item.ruleId)).toEqual(['checkout.risky']);
    expect(resolution.matches[0]?.feedback).toMatchObject({
      status: 'preferred',
      runCount: 7,
    });
    expect(resolution.deprioritizedMatches[0]?.feedback).toMatchObject({
      status: 'deprioritized',
      rollbackCandidateCount: 1,
    });
    expect(patched.steps[0].preferredHelpers).toContain('__e2e.waitForApiResponse');
    expect(patched.steps[0].preferredHelpers).not.toContain('__e2e.assertToastVisible');
  });
});
