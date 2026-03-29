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

  it('resolves field-path hints from matched knowledge rules', () => {
    fs.writeFileSync(
      knowledgeFile,
      JSON.stringify(
        {
          version: 1,
          rules: [
            {
              id: 'customer.detail-fields',
              title: '客户详情字段映射',
              match: {
                urlIncludes: ['/customer/detail'],
                descriptionIncludes: ['详情页核对'],
              },
              promptNotes: [],
              capabilitySlugs: [],
              addGlobalRules: [],
              addPreferredPrimitives: [],
              addOutputContract: [],
              stepPatches: [],
              fieldPathHints: [
                {
                  label: '状态',
                  paths: ['auditStatusName', 'statusLabel'],
                  stableIdentifiers: ['customerCode'],
                  whenStepTypes: ['assert'],
                  stepTextIncludes: ['详情'],
                },
                {
                  label: '编号',
                  paths: ['recordCode', 'customer.code'],
                  stableIdentifier: 'customerCode',
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
      targetUrl: 'https://example.com/customer/detail/1',
      featureDescription: '打开详情页并核对状态与编号',
      expectedOutcome: '详情字段正确',
      sharedVariables: ['customerCode'],
      steps: [
        {
          stepUid: 'step_1',
          stepType: 'assert',
          title: '详情页核对',
          target: 'https://example.com/customer/detail/1',
          instruction: '在详情页核对状态和编号',
          expectedResult: '详情字段正确',
          extractVariable: '',
        },
      ],
    });

    const resolution = resolveIntentProjectKnowledge({
      snapshot: {
        url: 'https://example.com/customer/detail/1',
        title: '客户详情',
        buttons: [],
        headings: [{ level: 'H2', text: '详情信息' }],
        bodyTextExcerpt: '详情 状态 编号',
        frames: [],
      },
      description: '详情页核对 customerCode 与状态',
      dsl: baseDsl,
    });

    expect(resolution.matches).toHaveLength(1);
    expect(resolution.matches[0]?.fieldPathHints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '状态',
          paths: ['auditStatusName', 'statusLabel'],
          stableIdentifiers: ['customerCode'],
        }),
        expect.objectContaining({
          label: '编号',
          paths: ['recordCode', 'customer.code'],
          stableIdentifiers: ['customerCode'],
        }),
      ])
    );
  });

  it('resolves record-lookup and detail-surface helper hints from matched knowledge rules', () => {
    fs.writeFileSync(
      knowledgeFile,
      JSON.stringify(
        {
          version: 1,
          rules: [
            {
              id: 'customer.lookup-hints',
              title: '客户列表回查参数',
              match: {
                urlIncludes: ['/customer'],
                descriptionIncludes: ['customerCode'],
              },
              promptNotes: [],
              capabilitySlugs: [],
              addGlobalRules: [],
              addPreferredPrimitives: [],
              addOutputContract: [],
              stepPatches: [],
              recordLookupHints: [
                {
                  stableIdentifier: 'customerCode',
                  whenStepTypes: ['assert'],
                  stepTextIncludes: ['详情'],
                  listResponse: { urlIncludes: '/customer/search', method: 'POST' },
                  detailUrl: '/customer/profile/{{primaryValue}}',
                  rowHasTexts: ['customerCode', '签约中'],
                  searchSurface: {
                    keywordInput: { selector: 'input#customerKeyword:visible' },
                    searchButton: { textIncludes: '检索' },
                  },
                  tableScope: { selector: '.customer-table-wrapper' },
                  detailReadyLocator: { textIncludes: '客户详情' },
                  detailEntry: {
                    trigger: 'row_action',
                    actionLabel: '查看',
                    target: 'drawer_or_modal',
                  },
                },
              ],
              detailSurfaceHints: [
                {
                  stableIdentifier: 'customerCode',
                  whenStepTypes: ['assert'],
                  stepTextIncludes: ['详情'],
                  titleIncludes: '客户详情',
                  scopeHints: ['详情页'],
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
      targetUrl: 'https://example.com/customer/list',
      featureDescription: '列表按 customerCode 回查，必要时进入详情页核对状态',
      expectedOutcome: '找到目标客户并核对详情',
      sharedVariables: ['customerCode'],
      steps: [
        {
          stepUid: 'step_1',
          stepType: 'assert',
          title: '详情页核对',
          target: 'https://example.com/customer/list',
          instruction: '按 customerCode 检索，未命中则进入详情页核对状态',
          expectedResult: '详情状态正确',
          extractVariable: '',
        },
      ],
    });

    const resolution = resolveIntentProjectKnowledge({
      snapshot: {
        url: 'https://example.com/customer/list',
        title: '客户列表',
        buttons: [],
        headings: [{ level: 'H2', text: '客户列表' }],
        bodyTextExcerpt: '客户列表 customerCode 详情',
        frames: [],
      },
      description: '按 customerCode 回查并在详情页核对状态',
      dsl: baseDsl,
    });

    expect(resolution.matches).toHaveLength(1);
    expect(resolution.matches[0]?.recordLookupHints).toEqual([
      {
        stableIdentifiers: ['customerCode'],
        whenStepTypes: ['assert'],
        stepTextIncludes: ['详情'],
        listResponse: { urlIncludes: '/customer/search', method: 'POST' },
        detailUrl: '/customer/profile/{{primaryValue}}',
        rowHasTexts: ['customerCode', '签约中'],
        searchSurface: {
          keywordInput: { selector: 'input#customerKeyword:visible' },
          searchButton: { textIncludes: '检索' },
        },
        tableScope: { selector: '.customer-table-wrapper' },
        detailReadyLocator: { textIncludes: '客户详情' },
        detailEntry: {
          trigger: 'row_action',
          actionLabel: '查看',
          target: 'drawer_or_modal',
        },
      },
    ]);
    expect(resolution.matches[0]?.detailSurfaceHints).toEqual([
      {
        stableIdentifiers: ['customerCode'],
        whenStepTypes: ['assert'],
        stepTextIncludes: ['详情'],
        titleIncludes: '客户详情',
        scopeHints: ['详情页'],
      },
    ]);
  });

  it('parses row_click detailEntry hints without requiring an action label', () => {
    fs.writeFileSync(
      knowledgeFile,
      JSON.stringify(
        {
          version: 1,
          rules: [
            {
              id: 'customer.row-click-entry',
              title: '客户列表整行进入详情',
              match: {
                urlIncludes: ['/customer'],
                descriptionIncludes: ['customerCode'],
              },
              promptNotes: [],
              capabilitySlugs: [],
              addGlobalRules: [],
              addPreferredPrimitives: [],
              addOutputContract: [],
              stepPatches: [],
              recordLookupHints: [
                {
                  stableIdentifier: 'customerCode',
                  whenStepTypes: ['assert'],
                  stepTextIncludes: ['详情'],
                  listResponse: { urlIncludes: '/customer/search', method: 'POST' },
                  detailUrl: '/customer/profile/{{primaryValue}}',
                  rowHasTexts: ['customerCode', '签约中'],
                  detailReadyLocator: { textIncludes: '客户详情' },
                  detailEntry: {
                    trigger: 'row_click',
                    target: 'page',
                    urlIncludes: '/customer/profile/',
                  },
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
      targetUrl: 'https://example.com/customer/list',
      featureDescription: '列表按 customerCode 回查，点击整行进入详情页核对状态',
      expectedOutcome: '找到目标客户并核对详情',
      sharedVariables: ['customerCode'],
      steps: [
        {
          stepUid: 'step_1',
          stepType: 'assert',
          title: '详情页核对',
          target: 'https://example.com/customer/list',
          instruction: '按 customerCode 检索，点击整行进入详情页核对状态',
          expectedResult: '详情状态正确',
          extractVariable: '',
        },
      ],
    });

    const resolution = resolveIntentProjectKnowledge({
      snapshot: {
        url: 'https://example.com/customer/list',
        title: '客户列表',
        buttons: [],
        headings: [{ level: 'H2', text: '客户列表' }],
        bodyTextExcerpt: '客户列表 customerCode 详情',
        frames: [],
      },
      description: '按 customerCode 回查并点击整行进入详情页核对状态',
      dsl: baseDsl,
    });

    expect(resolution.matches).toHaveLength(1);
    expect(resolution.matches[0]?.recordLookupHints?.[0]?.detailEntry).toEqual({
      trigger: 'row_click',
      target: 'page',
      urlIncludes: '/customer/profile/',
    });
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
          requestedModuleUid: 'mod_alpha',
          selectedCandidateFeedbackStatuses: ['probationary'],
          selectedRiskyCandidateIds: ['candidate-1'],
          acknowledgedRiskCandidateIds: ['candidate-1'],
          appliedAcknowledgedRiskCandidateIds: ['candidate-1'],
          appliedAcknowledgedRiskCandidateFeedbackStatuses: ['probationary'],
          mergedCandidateIds: ['candidate-1'],
          mergedCandidates: [
            {
              candidateId: 'candidate-1',
              ruleId: 'custom.orders-list',
              source: 'successful_run',
            feedbackStatus: 'probationary',
            risky: true,
            overrideApplied: false,
            riskAcknowledged: true,
            runIds: ['intent-run-success-1'],
            observationTags: ['obs-page-surface', 'obs-anchor-missing'],
            observationSummary: 'page_surface=observed；anchor_presence=not_found',
          },
        ],
          mergedCandidateSources: ['successful_run'],
          mergedRunIds: ['intent-run-success-1'],
          selectionSummary: {
            requestedCandidateIds: ['candidate-1'],
            requestedCandidateCount: 1,
            selectedCandidateIds: ['candidate-1'],
            selectedCandidateCount: 1,
            selectedRuleIds: ['custom.orders-list'],
            mergeCandidateIds: ['candidate-1'],
            mergeCandidateCount: 1,
            coveredCandidateIds: [],
            coveredCandidateCount: 0,
            missingCandidateIds: [],
            missingCandidateCount: 0,
            selectedSources: ['successful_run'],
            selectedFeedbackStatuses: ['probationary'],
            selectedLifecyclePolicies: ['observe'],
            selectedRiskyCandidateIds: ['candidate-1'],
            autoPromoteCandidateIds: [],
            observeCandidateIds: ['candidate-1'],
            blockDefaultMergeCandidateIds: [],
            overrideRequiredCandidateIds: [],
            riskAcknowledgementRequiredCandidateIds: ['candidate-1'],
          },
          preflightSummary: {
            requiresOverride: false,
            requiresRiskAcknowledgement: true,
            autoPromoteCount: 0,
            observeCount: 1,
            blockDefaultMergeCount: 0,
            itemCount: 1,
            items: [
              {
                kind: 'risk_acknowledgement',
                level: 'warning',
                title: '需确认观察期风险',
                message: '本次选择包含 1 条观察期候选，需显式确认风险后才能合并。',
                provenanceType: 'risk_acknowledgement',
                candidateIds: ['candidate-1'],
                ruleIds: ['custom.orders-list'],
                feedbackStatuses: ['probationary'],
                lifecyclePolicies: ['observe'],
              },
            ],
          },
          mergeReceipts: [
            {
              kind: 'risk_acknowledgement',
              level: 'warning',
              title: '风险确认已记录',
              message: '本次合并已确认 1 条观察期候选风险。',
              provenanceType: 'risk_acknowledgement',
              candidateIds: ['candidate-1'],
              ruleIds: ['custom.orders-list'],
              feedbackStatuses: ['probationary'],
              lifecyclePolicies: ['observe'],
            },
          ],
          successfulRunKnowledgePromotionReceipt: {
            version: 1,
            receiptId: 'successful-run-knowledge-promotion-receipt-1',
            recordedAt: '2026-03-26T12:00:00.000Z',
            projectUid: 'proj_alpha',
            actorLabel: 'bobo',
            requestedModuleUid: 'mod_alpha',
            title: 'Successful Run 知识沉淀回执（1 条）',
            detail:
              '模块：mod_alpha；已请求 1 条 successful run 候选；新增规则 1 条；关联通过运行 1 条；涉及 helper 1 个；观察上下文：page_surface=observed；anchor_presence=not_found',
            summary: {
              requestedCandidateCount: 1,
              mergedCandidateCount: 1,
              mergedRuleCount: 1,
              coveredCandidateCount: 0,
              missingCandidateCount: 0,
              skippedRuleCount: 0,
              helperCount: 1,
              runCount: 1,
            },
            items: [
              {
                candidateId: 'candidate-1',
                ruleId: 'custom.orders-list',
                ruleTitle: '订单列表规则',
                source: 'successful_run',
                status: 'merged',
                feedbackStatus: 'probationary',
                lifecyclePolicy: 'observe',
                runIds: ['intent-run-success-1'],
                successfulStrategies: ['__e2e.resolvePrimaryRecord'],
                sampleUrls: ['https://example.com/orders/list'],
                observationTags: ['obs-page-surface', 'obs-anchor-missing'],
                observationSummary: 'page_surface=observed；anchor_presence=not_found',
              },
            ],
          },
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
          preflightSummary: {
            requiresOverride: false,
            requiresRiskAcknowledgement: false,
            autoPromoteCount: 0,
            observeCount: 0,
            blockDefaultMergeCount: 0,
            itemCount: 1,
            items: [
              {
                kind: 'audit',
                level: 'info',
                title: '准备回滚项目知识规则',
                message: '将从备份 reports/intent-e2e.project-knowledge.backups/target-backup.json 恢复项目知识。',
                provenanceType: 'audit',
                candidateIds: [],
                ruleIds: ['custom.orders-list'],
                feedbackStatuses: [],
                lifecyclePolicies: [],
              },
            ],
          },
          mergeReceipts: [
            {
              kind: 'audit',
              level: 'info',
              title: '回滚已完成',
              message: '已从备份 reports/intent-e2e.project-knowledge.backups/target-backup.json 恢复项目知识。',
              provenanceType: 'audit',
              candidateIds: [],
              ruleIds: ['custom.orders-list'],
              feedbackStatuses: [],
              lifecyclePolicies: [],
            },
          ],
        },
      })
    );

    const allAudits = await listIntentProjectKnowledgeAuditEntries(12);
    const projectAudits = await listIntentProjectKnowledgeAuditEntries(12, 'proj_alpha');

    expect(allAudits.auditLogPath).toBe(auditFile);
    expect(allAudits.items).toHaveLength(2);
    expect(allAudits.items[0].auditId).toBe(restoreAudit.auditId);
    expect(allAudits.items[1].auditId).toBe(mergeAudit.auditId);
    expect(allAudits.items[0].meta.preflightSummary?.itemCount).toBe(1);
    expect(allAudits.items[0].meta.mergeReceipts).toEqual([
      expect.objectContaining({
        kind: 'audit',
        title: '回滚已完成',
        ruleIds: ['custom.orders-list'],
      }),
    ]);
    expect(allAudits.items[0].detail).toContain('结构化预检 1 项');
    expect(allAudits.items[0].detail).toContain('结构化回执 1 条');
    expect(projectAudits.items).toHaveLength(1);
    expect(projectAudits.items[0].projectUid).toBe('proj_alpha');
    expect(projectAudits.items[0].meta.projectActivityLogged).toBe(true);
    expect(projectAudits.items[0].meta.requestedModuleUid).toBe('mod_alpha');
    expect(projectAudits.items[0].meta.acknowledgedRiskCandidateIds).toEqual(['candidate-1']);
    expect(projectAudits.items[0].meta.selectionSummary?.selectedCandidateCount).toBe(1);
    expect(projectAudits.items[0].meta.preflightSummary?.requiresRiskAcknowledgement).toBe(true);
    expect(projectAudits.items[0].meta.mergeReceipts).toEqual([
      expect.objectContaining({
        kind: 'risk_acknowledgement',
        title: '风险确认已记录',
        ruleIds: ['custom.orders-list'],
      }),
    ]);
    expect(projectAudits.items[0].meta.mergedCandidates).toEqual([
      expect.objectContaining({
        candidateId: 'candidate-1',
        ruleId: 'custom.orders-list',
        riskAcknowledged: true,
        observationTags: ['obs-page-surface', 'obs-anchor-missing'],
        observationSummary: 'page_surface=observed；anchor_presence=not_found',
      }),
    ]);
    expect(projectAudits.items[0].meta.successfulRunKnowledgePromotionReceipt?.items[0]).toEqual(
      expect.objectContaining({
        candidateId: 'candidate-1',
        observationTags: ['obs-page-surface', 'obs-anchor-missing'],
        observationSummary: 'page_surface=observed；anchor_presence=not_found',
      })
    );
    expect(projectAudits.items[0].detail).toContain('作用域模块：mod_alpha');
    expect(projectAudits.items[0].detail).toContain('风险确认生效 1 条');
    expect(projectAudits.items[0].detail).toContain('风险确认状态：probationary');
    expect(projectAudits.items[0].detail).toContain('规则映射候选 1 条');
    expect(projectAudits.items[0].detail).toContain('结构化范围：选中 1 条，实际 merge 1 条');
    expect(projectAudits.items[0].detail).toContain('结构化预检 1 项');
    expect(projectAudits.items[0].detail).toContain('结构化回执 1 条');
    expect(projectAudits.items[0].detail).toContain(
      'Successful Run 回执：新增规则 1 条，关联通过运行 1 条，涉及 helper 1 个，观察上下文：page_surface=observed；anchor_presence=not_found'
    );
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

  it('keeps watching probation rules active but ranks them behind stable rules', () => {
    fs.writeFileSync(
      knowledgeFile,
      JSON.stringify(
        {
          version: 1,
          rules: [
            {
              id: 'checkout.stable',
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
              id: 'checkout.new-probation',
              title: '新结算观察期规则',
              match: {
                urlIncludes: ['/checkout'],
              },
              promptNotes: ['新规则先观察，不立刻完全放量。'],
              capabilitySlugs: ['assert.watch-submit-state'],
              addGlobalRules: ['提交后补充校验按钮 loading 与接口返回。'],
              addPreferredPrimitives: [],
              addOutputContract: [],
              stepPatches: [
                {
                  whenStepTypes: ['ui'],
                  stepTextIncludes: ['提交订单'],
                  addPreferredHelpers: ['__e2e.observeSubmitState'],
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
          'checkout.stable': {
            runCount: 6,
            passedRuns: 5,
            failedRuns: 1,
            canceledRuns: 0,
            passRate: 83.3,
            rollbackCandidateCount: 0,
          },
          'checkout.new-probation': {
            runCount: 1,
            passedRuns: 1,
            failedRuns: 0,
            canceledRuns: 0,
            passRate: 100,
            rollbackCandidateCount: 0,
            probation: {
              status: 'watching',
              observedRuns: 2,
              observedPassRate: 50,
              remainingRuns: 4,
              sourceAuditId: 'audit_merge_new_checkout_rule',
              sourceTitle: '合并 1 条项目知识规则',
              backupPath: 'reports/intent-e2e.project-knowledge.backups/checkout.json',
              recommendation: '继续观察后续 4 次终态运行，再决定是否转正。',
              selectedCandidateFeedbackStatuses: ['probationary'],
              selectedRiskyCandidateIds: ['candidate-new-probation'],
              appliedOverrideCandidateIds: [],
              appliedOverrideCandidateFeedbackStatuses: [],
              appliedAcknowledgedRiskCandidateIds: ['candidate-new-probation'],
              appliedAcknowledgedRiskCandidateFeedbackStatuses: ['probationary'],
            },
          },
        },
      }
    );
    const patched = applyIntentProjectKnowledgeToDsl(baseDsl, resolution);
    const rendered = renderIntentProjectKnowledge(resolution);

    expect(resolution.matches.map((item) => item.ruleId)).toEqual(['checkout.stable', 'checkout.new-probation']);
    expect(resolution.deprioritizedMatches).toEqual([]);
    expect(resolution.matches[0]?.feedback).toMatchObject({
      status: 'preferred',
      runCount: 6,
    });
    expect(resolution.matches[1]?.feedback).toMatchObject({
      status: 'probationary',
      runCount: 1,
      scoreAdjustment: -3,
      rollbackCandidateCount: 0,
    });
    expect(resolution.matches[1]?.feedback?.reasons.join('；')).toContain('经风险确认纳入的规则仍在观察期');
    expect(patched.steps[0].preferredHelpers).toContain('__e2e.waitForApiResponse');
    expect(patched.steps[0].preferredHelpers).toContain('__e2e.observeSubmitState');
    expect(rendered).toContain('经风险确认纳入的规则仍在观察期');
  });
});
