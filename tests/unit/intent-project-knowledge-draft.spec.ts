import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/repository', () => ({
  listIntentE2ERunSnapshots: vi.fn(),
}));

import { recordIntentRepairFailure, recordIntentRepairResolution, resetIntentRepairMemoryCache } from '@/lib/ai/intent-repair-memory';
import { listIntentE2ERunSnapshots, type IntentE2ERunSnapshotRecord } from '@/lib/db/repository';
import {
  resetIntentProjectKnowledgeCache,
  writeIntentProjectKnowledgeAuditEntry,
} from '@/lib/intent-project-knowledge';
import {
  generateIntentProjectKnowledgeDraft,
  mergeIntentProjectKnowledgeDraftCandidates,
  renderIntentProjectKnowledgeDraftSummary,
  resolveIntentProjectKnowledgeDraftCandidateSelection,
  writeIntentProjectKnowledgeDraft,
} from '@/lib/intent-project-knowledge-draft';

let tempDir = '';
let memoryPath = '';
let knowledgePath = '';
let draftPath = '';
let backupDir = '';
let auditPath = '';
let projectAssetRoot = '';

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-project-knowledge-draft-'));
  memoryPath = path.join(tempDir, 'repair-memory.json');
  knowledgePath = path.join(tempDir, 'project-knowledge.json');
  draftPath = path.join(tempDir, 'project-knowledge.draft.json');
  backupDir = path.join(tempDir, 'project-knowledge-backups');
  auditPath = path.join(tempDir, 'project-knowledge.audit.jsonl');
  projectAssetRoot = path.join(tempDir, 'projects');
  process.env.INTENT_E2E_REPAIR_MEMORY_PATH = memoryPath;
  process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH = knowledgePath;
  process.env.INTENT_E2E_PROJECT_KNOWLEDGE_DRAFT_PATH = draftPath;
  process.env.INTENT_E2E_PROJECT_KNOWLEDGE_BACKUP_DIR = backupDir;
  process.env.INTENT_E2E_PROJECT_KNOWLEDGE_AUDIT_PATH = auditPath;
  process.env.INTENT_E2E_PROJECT_ASSET_ROOT = projectAssetRoot;
  resetIntentRepairMemoryCache();
  resetIntentProjectKnowledgeCache();
  vi.mocked(listIntentE2ERunSnapshots).mockReset();
  vi.mocked(listIntentE2ERunSnapshots).mockResolvedValue([] as never);
  await fs.writeFile(knowledgePath, JSON.stringify({ version: 1, rules: [] }, null, 2), 'utf8');
});

afterEach(async () => {
  delete process.env.INTENT_E2E_REPAIR_MEMORY_PATH;
  delete process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH;
  delete process.env.INTENT_E2E_PROJECT_KNOWLEDGE_DRAFT_PATH;
  delete process.env.INTENT_E2E_PROJECT_KNOWLEDGE_BACKUP_DIR;
  delete process.env.INTENT_E2E_PROJECT_KNOWLEDGE_AUDIT_PATH;
  delete process.env.INTENT_E2E_PROJECT_ASSET_ROOT;
  resetIntentRepairMemoryCache();
  resetIntentProjectKnowledgeCache();
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

function makeRunSnapshot(input: Partial<IntentE2ERunSnapshotRecord> & Pick<IntentE2ERunSnapshotRecord, 'runId' | 'status'>): IntentE2ERunSnapshotRecord {
  return {
    runId: input.runId,
    projectUid: input.projectUid || 'proj_1',
    moduleUid: input.moduleUid || '',
    status: input.status,
    stage: input.stage || input.status,
    requestInput: input.requestInput || '按 customerCode 回查并在必要时打开详情核对状态',
    targetUrl: input.targetUrl || 'https://example.com/customer/list',
    state: input.state || null,
    error: input.error || '',
    createdAt: input.createdAt || '2026-03-23T15:00:00.000Z',
    updatedAt: input.updatedAt || input.createdAt || '2026-03-23T15:00:00.000Z',
    startedAt: input.startedAt || input.createdAt || '2026-03-23T15:00:00.000Z',
    endedAt: input.endedAt || input.updatedAt || input.createdAt || '2026-03-23T15:00:00.000Z',
  };
}

function makeAttempt(success: boolean, kind: 'generate' | 'repair' = 'generate') {
  return {
    kind,
    result: { success },
    helperUsage: {
      usedHelpers: [],
      usedSuggestedHelpers: [],
    },
  };
}

function makeKnowledgeCandidate(input: {
  ruleId: string;
  title: string;
  description: string;
  targetUrl?: string;
  preferredHelpers?: string[];
  observationTags?: string[];
  observationSummary?: string;
}) {
  return {
    candidateId: `success-candidate-${input.ruleId}`,
    source: 'successful_verification_plan',
    createdAt: '2026-03-23T15:00:00.000Z',
    targetUrl: input.targetUrl || 'https://example.com/customer/list',
    description: input.description,
    checkUid: `verify-${input.ruleId}`,
    stableIdentifiers: ['customerCode'],
    preferredHelpers: input.preferredHelpers || ['__e2e.resolvePrimaryRecord'],
    matchedRuleIds: [],
    ...(input.observationTags ? { observationTags: input.observationTags } : {}),
    ...(input.observationSummary ? { observationSummary: input.observationSummary } : {}),
    rule: {
      id: input.ruleId,
      title: input.title,
      match: {
        urlIncludes: ['/customer/list'],
      },
      promptNotes: [input.description],
      capabilitySlugs: ['assert.resolve-primary-record'],
      addGlobalRules: [],
      addPreferredPrimitives: [],
      addOutputContract: ['优先复用已验证的结构化 helper。'],
      stepPatches: [],
    },
  };
}

function makeSuccessfulKnowledgeRun(input: {
  runId: string;
  ruleId: string;
  title: string;
  description: string;
  projectUid?: string;
  moduleUid?: string;
  endedAt?: string;
  observationTags?: string[];
  observationSummary?: string;
}) {
  return makeRunSnapshot({
    runId: input.runId,
    projectUid: input.projectUid,
    moduleUid: input.moduleUid,
    status: 'passed',
    requestInput: input.description,
    targetUrl: 'https://example.com/customer/list',
    endedAt: input.endedAt || '2026-03-23T15:00:00.000Z',
    state: {
      result: {
        knowledgeCandidates: [
          makeKnowledgeCandidate({
            ruleId: input.ruleId,
            title: input.title,
            description: input.description,
            observationTags: input.observationTags,
            observationSummary: input.observationSummary,
          }),
        ],
        attempts: [makeAttempt(true)],
      },
    },
  });
}

async function seedRepairMemoryDraftCandidate() {
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

  const draft = await generateIntentProjectKnowledgeDraft({ projectUid: 'proj_1', maxCandidates: 5 });
  const candidate = draft.candidates.find((item) => item.source === 'repair_memory');

  if (!candidate) {
    throw new Error('expected repair_memory candidate');
  }

  return {
    draft,
    candidate,
  };
}

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

  it('keeps project-scoped draft and target paths while still reading legacy fallback assets before project files exist', async () => {
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
        steps: [],
        error: null,
      },
    });

    const draft = await generateIntentProjectKnowledgeDraft({ projectUid: 'proj alpha' });
    const writtenTo = await writeIntentProjectKnowledgeDraft(draft);
    const projectDraftPath = path.join(projectAssetRoot, 'proj-alpha', 'intent-e2e.project-knowledge.draft.json');
    const projectKnowledgePath = path.join(projectAssetRoot, 'proj-alpha', 'intent-e2e.project-knowledge.json');

    expect(draft.sourceMemoryPath).toBe(memoryPath);
    expect(draft.targetKnowledgePath).toBe(projectKnowledgePath);
    expect(draft.outputPath).toBe(projectDraftPath);
    expect(writtenTo).toBe(projectDraftPath);
    expect(JSON.parse(await fs.readFile(projectDraftPath, 'utf8'))).toMatchObject({
      targetKnowledgePath: projectKnowledgePath,
    });
  });

  it('boosts repair memory candidates when restore history shows recovered evidence and keeps them default-selected', async () => {
    const { candidate: baselineCandidate } = await seedRepairMemoryDraftCandidate();
    const terminalSnapshots = [
      makeRunSnapshot({
        runId: 'repair_recovered_before_1',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T19:00:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
      makeRunSnapshot({
        runId: 'repair_recovered_before_2',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T19:01:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
      makeRunSnapshot({
        runId: 'repair_recovered_before_3',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T19:02:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
      makeRunSnapshot({
        runId: 'repair_recovered_after_1',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T19:04:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'repair_recovered_after_2',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T19:05:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'repair_recovered_after_3',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T19:06:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
    ];
    vi.mocked(listIntentE2ERunSnapshots).mockImplementation(async (params) =>
      (params?.status === 'terminal' ? terminalSnapshots : []) as never
    );

    await writeIntentProjectKnowledgeAuditEntry({
      auditId: 'audit_repair_restore_recovered',
      occurredAt: '2026-03-23T19:03:00.000Z',
      operation: 'restore',
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      title: 'restore 后已恢复的 repair memory 候选',
      detail: 'repair memory restore recovered test audit',
      writtenTo: knowledgePath,
      backupPath: path.join(backupDir, 'before-repair-restore-recovered.json'),
      sourcePath: draftPath,
      comparison: {
        before: {
          ruleCount: 1,
          enabledRuleCount: 1,
          capabilitySlugCount: 2,
          preferredHelperCount: 2,
          stepPatchCount: 1,
          urlPatternCount: 1,
        },
        after: {
          ruleCount: 0,
          enabledRuleCount: 0,
          capabilitySlugCount: 0,
          preferredHelperCount: 0,
          stepPatchCount: 0,
          urlPatternCount: 0,
        },
        addedRuleIds: [],
        removedRuleIds: [baselineCandidate.rule.id],
        updatedRuleIds: [],
      },
      meta: {
        restoredFrom: path.join(backupDir, 'repair-restore-recovered.json'),
        mergedCandidateSources: ['repair_memory'],
        mergedRunIds: [],
        mergedCandidates: [
          {
            candidateId: baselineCandidate.candidateId,
            ruleId: baselineCandidate.rule.id,
            source: 'repair_memory',
            feedbackStatus: 'neutral',
            risky: false,
            overrideApplied: false,
            riskAcknowledged: false,
            runIds: [],
          },
        ],
      },
    });

    const draft = await generateIntentProjectKnowledgeDraft({ projectUid: 'proj_1', maxCandidates: 5 });
    const recoveredCandidate = draft.candidates.find((candidate) => candidate.candidateId === baselineCandidate.candidateId);
    const selection = resolveIntentProjectKnowledgeDraftCandidateSelection(draft);

    expect(recoveredCandidate?.feedback).toMatchObject({
      status: 'neutral',
      confidenceAdjustment: 6,
      knowledgeChangeSignal: 'positive',
    });
    expect(recoveredCandidate?.feedback?.reasons[0]).toContain('规则效果汇总偏正向');
    expect(recoveredCandidate?.feedback?.supportingAuditIds).toEqual(['audit_repair_restore_recovered']);
    expect(recoveredCandidate?.confidence).toBeGreaterThan(baselineCandidate.confidence);
    expect(selection.requestedCandidateIds).toContain(baselineCandidate.candidateId);
  });

  it('downranks repair memory candidates when restore history stays abnormal and defers them from default merge', async () => {
    const { candidate: baselineCandidate } = await seedRepairMemoryDraftCandidate();
    const terminalSnapshots = [
      makeRunSnapshot({
        runId: 'repair_still_abnormal_before_1',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T20:00:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
      makeRunSnapshot({
        runId: 'repair_still_abnormal_before_2',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T20:01:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
      makeRunSnapshot({
        runId: 'repair_still_abnormal_before_3',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T20:02:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
      makeRunSnapshot({
        runId: 'repair_still_abnormal_after_1',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T20:04:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
      makeRunSnapshot({
        runId: 'repair_still_abnormal_after_2',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T20:05:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
      makeRunSnapshot({
        runId: 'repair_still_abnormal_after_3',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T20:06:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
    ];
    vi.mocked(listIntentE2ERunSnapshots).mockImplementation(async (params) =>
      (params?.status === 'terminal' ? terminalSnapshots : []) as never
    );

    await writeIntentProjectKnowledgeAuditEntry({
      auditId: 'audit_repair_restore_still_abnormal',
      occurredAt: '2026-03-23T20:03:00.000Z',
      operation: 'restore',
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      title: 'restore 后仍异常的 repair memory 候选',
      detail: 'repair memory restore still abnormal test audit',
      writtenTo: knowledgePath,
      backupPath: path.join(backupDir, 'before-repair-restore-still-abnormal.json'),
      sourcePath: draftPath,
      comparison: {
        before: {
          ruleCount: 1,
          enabledRuleCount: 1,
          capabilitySlugCount: 2,
          preferredHelperCount: 2,
          stepPatchCount: 1,
          urlPatternCount: 1,
        },
        after: {
          ruleCount: 0,
          enabledRuleCount: 0,
          capabilitySlugCount: 0,
          preferredHelperCount: 0,
          stepPatchCount: 0,
          urlPatternCount: 0,
        },
        addedRuleIds: [],
        removedRuleIds: [baselineCandidate.rule.id],
        updatedRuleIds: [],
      },
      meta: {
        restoredFrom: path.join(backupDir, 'repair-restore-still-abnormal.json'),
        mergedCandidateSources: ['repair_memory'],
        mergedRunIds: [],
        mergedCandidates: [
          {
            candidateId: baselineCandidate.candidateId,
            ruleId: baselineCandidate.rule.id,
            source: 'repair_memory',
            feedbackStatus: 'deprioritized',
            risky: true,
            overrideApplied: false,
            riskAcknowledged: false,
            runIds: [],
          },
        ],
      },
    });

    const draft = await generateIntentProjectKnowledgeDraft({ projectUid: 'proj_1', maxCandidates: 5 });
    const abnormalCandidate = draft.candidates.find((candidate) => candidate.candidateId === baselineCandidate.candidateId);
    const selection = resolveIntentProjectKnowledgeDraftCandidateSelection(draft);

    expect(abnormalCandidate?.feedback).toMatchObject({
      status: 'deprioritized',
      confidenceAdjustment: -12,
      knowledgeChangeSignal: 'negative',
    });
    expect(abnormalCandidate?.feedback?.reasons[0]).toContain('规则效果汇总仍偏负向');
    expect(abnormalCandidate?.feedback?.supportingAuditIds).toEqual(['audit_repair_restore_still_abnormal']);
    expect(abnormalCandidate?.confidence).toBeLessThan(baselineCandidate.confidence);
    expect(selection.requestedCandidateIds).not.toContain(baselineCandidate.candidateId);
  });

  it('includes successful run knowledge candidates in the draft preview', async () => {
    const successfulRunSnapshots = [
      {
        runId: 'intent-run-success-1',
        projectUid: 'proj_1',
        status: 'passed',
        stage: 'completed',
        requestInput: '按 customerCode 回查并在必要时打开详情核对状态',
        targetUrl: 'https://example.com/customer/list',
        state: {
          result: {
            knowledgeCandidates: [
              {
                candidateId: 'success-candidate-customer-lookup',
                source: 'successful_verification_plan',
                createdAt: '2026-03-23T15:00:00.000Z',
                targetUrl: 'https://example.com/customer/list',
                description: '按 customerCode 回查并在必要时打开详情核对状态',
                checkUid: 'verify_customer_lookup',
                stableIdentifiers: ['customerCode'],
                preferredHelpers: [
                  '__e2e.resolvePrimaryRecord',
                  '__e2e.clickAntdRowAction',
                  '__e2e.readDetailField',
                ],
                matchedRuleIds: ['customer.lookup-hints'],
                rule: {
                  id: 'intent-success.customer-list.customer-lookup',
                  title: 'customer list · customerCode 验收候选',
                  match: {
                    urlIncludes: ['/customer/list'],
                  },
                  promptNotes: ['来自成功 run 的结构化验收候选：列表检索到目标 customerCode，必要时打开详情核对状态'],
                  capabilitySlugs: ['assert.resolve-primary-record', 'ui.click-antd-row-action', 'assert.read-detail-field'],
                  addGlobalRules: [],
                  addPreferredPrimitives: [],
                  addOutputContract: ['优先复用成功 run 中沉淀的结构化 helper 参数，不要退回模糊自由发挥。'],
                  stepPatches: [
                    {
                      whenStepTypes: ['assert'],
                      stepTextIncludes: ['customerCode', '列表', '详情', '查看'],
                      addAllowedActions: ['resolve_primary_record', 'click_row_action'],
                      addPreferredHelpers: [
                        '__e2e.resolvePrimaryRecord',
                        '__e2e.clickAntdRowAction',
                        '__e2e.readDetailField',
                      ],
                      addRequiredAssertions: ['列表检索到目标 customerCode，必要时打开详情核对状态'],
                      addForbiddenPatterns: [],
                    },
                  ],
                  fieldPathHints: [
                    {
                      label: '状态',
                      paths: ['status', 'statusName'],
                      stableIdentifiers: ['customerCode'],
                      whenStepTypes: ['assert'],
                      stepTextIncludes: ['customerCode', '列表', '详情', '查看'],
                    },
                  ],
                  recordLookupHints: [
                    {
                      stableIdentifiers: ['customerCode'],
                      whenStepTypes: ['assert'],
                      stepTextIncludes: ['customerCode', '列表', '详情', '查看'],
                      listResponse: { urlIncludes: '/customer/search', method: 'POST' },
                      detailUrl: '/customer/profile/{{primaryValue}}',
                      rowHasTexts: ['customerCode', '签约中'],
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
                      stableIdentifiers: ['customerCode'],
                      whenStepTypes: ['assert'],
                      stepTextIncludes: ['customerCode', '列表', '详情', '查看'],
                      titleIncludes: '客户详情',
                      scopeHints: ['详情页'],
                    },
                  ],
                },
              },
            ],
          },
        },
        error: '',
        createdAt: '2026-03-23T15:00:00.000Z',
        updatedAt: '2026-03-23T15:00:02.000Z',
        startedAt: '2026-03-23T15:00:00.000Z',
        endedAt: '2026-03-23T15:00:02.000Z',
      },
    ] as never;
    vi.mocked(listIntentE2ERunSnapshots).mockImplementation(async () => successfulRunSnapshots);

    const draft = await generateIntentProjectKnowledgeDraft({ maxCandidates: 5 });
    const summary = renderIntentProjectKnowledgeDraftSummary(draft);

    expect(listIntentE2ERunSnapshots).toHaveBeenNthCalledWith(1, { status: 'passed', limit: 50 });
    expect(listIntentE2ERunSnapshots).toHaveBeenNthCalledWith(2, { status: 'terminal', limit: 200 });
    expect(draft.candidates).toHaveLength(1);
    expect(draft.candidates[0].source).toBe('successful_run');
    expect(draft.candidates[0].runIds).toEqual(['intent-run-success-1']);
    expect(draft.candidates[0].feedback).toBeUndefined();
    expect(draft.candidates[0].category).toBe('successful-verification-plan');
    expect(draft.candidates[0].seenCount).toBe(1);
    expect(draft.candidates[0].successfulStrategies).toEqual([
      '__e2e.resolvePrimaryRecord',
      '__e2e.clickAntdRowAction',
      '__e2e.readDetailField',
    ]);
    expect(draft.candidates[0].rule.recordLookupHints?.[0]?.detailEntry).toEqual({
      trigger: 'row_action',
      actionLabel: '查看',
      target: 'drawer_or_modal',
    });
    expect(draft.summary.totalPassedRuns).toBe(1);
    expect(draft.summary.successfulRunCandidateGroups).toBe(1);
    expect(draft.summary.repairMemoryCandidateGroups).toBe(0);
    expect(draft.mergedProfilePreview.rules).toHaveLength(1);
    expect(summary).toContain('passed runs=1');
    expect(summary).toContain('source=successful_run');
  });

  it('prioritizes exact module successful runs and falls back to same-project samples', async () => {
    vi.mocked(listIntentE2ERunSnapshots).mockClear();
    const successfulRunSnapshots = [
      {
        runId: 'intent-run-success-mod-1',
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        status: 'passed',
        stage: 'completed',
        requestInput: '模块一的成功样本',
        targetUrl: 'https://example.com/customer/list',
        state: {
          result: {
            knowledgeCandidates: [
              {
                candidateId: 'success-candidate-mod-1',
                source: 'successful_verification_plan',
                createdAt: '2026-03-23T16:00:00.000Z',
                targetUrl: 'https://example.com/customer/list',
                description: '模块一的成功样本',
                checkUid: 'verify_mod_1',
                stableIdentifiers: ['customerCode'],
                preferredHelpers: ['__e2e.resolvePrimaryRecord'],
                matchedRuleIds: [],
                rule: {
                  id: 'intent-success.customer-list.mod-1',
                  title: 'customer list · 模块一候选',
                  match: { urlIncludes: ['/customer/list'] },
                  promptNotes: ['来自模块一'],
                  capabilitySlugs: ['assert.resolve-primary-record'],
                  addGlobalRules: [],
                  addPreferredPrimitives: [],
                  addOutputContract: [],
                  stepPatches: [],
                },
              },
            ],
          },
        },
        error: '',
        createdAt: '2026-03-23T16:00:00.000Z',
        updatedAt: '2026-03-23T16:00:02.000Z',
        startedAt: '2026-03-23T16:00:00.000Z',
        endedAt: '2026-03-23T16:00:02.000Z',
      },
      {
        runId: 'intent-run-success-mod-2',
        projectUid: 'proj_1',
        moduleUid: 'mod_2',
        status: 'passed',
        stage: 'completed',
        requestInput: '模块二的成功样本',
        targetUrl: 'https://example.com/customer/list',
        state: {
          result: {
            knowledgeCandidates: [
              {
                candidateId: 'success-candidate-mod-2',
                source: 'successful_verification_plan',
                createdAt: '2026-03-23T16:01:00.000Z',
                targetUrl: 'https://example.com/customer/list',
                description: '模块二的成功样本',
                checkUid: 'verify_mod_2',
                stableIdentifiers: ['customerCode'],
                preferredHelpers: ['__e2e.resolvePrimaryRecord'],
                matchedRuleIds: [],
                rule: {
                  id: 'intent-success.customer-list.mod-2',
                  title: 'customer list · 模块二候选',
                  match: { urlIncludes: ['/customer/list'] },
                  promptNotes: ['来自模块二'],
                  capabilitySlugs: ['assert.resolve-primary-record'],
                  addGlobalRules: [],
                  addPreferredPrimitives: [],
                  addOutputContract: [],
                  stepPatches: [],
                },
              },
            ],
          },
        },
        error: '',
        createdAt: '2026-03-23T16:01:00.000Z',
        updatedAt: '2026-03-23T16:01:02.000Z',
        startedAt: '2026-03-23T16:01:00.000Z',
        endedAt: '2026-03-23T16:01:02.000Z',
      },
      {
        runId: 'intent-run-success-other-project',
        projectUid: 'proj_2',
        moduleUid: 'mod_x',
        status: 'passed',
        stage: 'completed',
        requestInput: '其他项目样本',
        targetUrl: 'https://example.com/customer/list',
        state: {
          result: {
            knowledgeCandidates: [
              {
                candidateId: 'success-candidate-other-project',
                source: 'successful_verification_plan',
                createdAt: '2026-03-23T16:02:00.000Z',
                targetUrl: 'https://example.com/customer/list',
                description: '其他项目样本',
                checkUid: 'verify_other_project',
                stableIdentifiers: ['customerCode'],
                preferredHelpers: ['__e2e.resolvePrimaryRecord'],
                matchedRuleIds: [],
                rule: {
                  id: 'intent-success.customer-list.other-project',
                  title: 'customer list · 其他项目候选',
                  match: { urlIncludes: ['/customer/list'] },
                  promptNotes: ['来自其他项目'],
                  capabilitySlugs: ['assert.resolve-primary-record'],
                  addGlobalRules: [],
                  addPreferredPrimitives: [],
                  addOutputContract: [],
                  stepPatches: [],
                },
              },
            ],
          },
        },
        error: '',
        createdAt: '2026-03-23T16:02:00.000Z',
        updatedAt: '2026-03-23T16:02:02.000Z',
        startedAt: '2026-03-23T16:02:00.000Z',
        endedAt: '2026-03-23T16:02:02.000Z',
      },
    ] as never;
    vi.mocked(listIntentE2ERunSnapshots).mockImplementation(async () => successfulRunSnapshots);

    const moduleScopedDraft = await generateIntentProjectKnowledgeDraft({
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      maxCandidates: 5,
    });
    const projectFallbackDraft = await generateIntentProjectKnowledgeDraft({
      projectUid: 'proj_1',
      moduleUid: 'mod_missing',
      maxCandidates: 5,
    });

    expect(listIntentE2ERunSnapshots).toHaveBeenNthCalledWith(1, {
      projectUid: 'proj_1',
      status: 'passed',
      limit: 50,
    });
    expect(listIntentE2ERunSnapshots).toHaveBeenNthCalledWith(2, {
      projectUid: 'proj_1',
      status: 'terminal',
      limit: 200,
    });
    expect(listIntentE2ERunSnapshots).toHaveBeenNthCalledWith(3, {
      projectUid: 'proj_1',
      status: 'passed',
      limit: 50,
    });
    expect(listIntentE2ERunSnapshots).toHaveBeenNthCalledWith(4, {
      projectUid: 'proj_1',
      status: 'terminal',
      limit: 200,
    });
    expect(moduleScopedDraft.summary.totalPassedRuns).toBe(1);
    expect(moduleScopedDraft.candidates).toHaveLength(1);
    expect(moduleScopedDraft.candidates[0].rule.id).toBe('intent-success.customer-list.mod-1');
    expect(projectFallbackDraft.summary.totalPassedRuns).toBe(2);
    expect(projectFallbackDraft.candidates.map((candidate) => candidate.rule.id)).toEqual([
      'intent-success.customer-list.mod-1',
      'intent-success.customer-list.mod-2',
    ]);
  });

  it('keeps successful-run observation artifact in draft rule prompt notes', async () => {
    vi.mocked(listIntentE2ERunSnapshots).mockImplementation(async (params) =>
      (params?.status === 'passed'
        ? [
            makeSuccessfulKnowledgeRun({
              runId: 'intent-run-success-observed',
              ruleId: 'intent-success.customer-list.observed',
              title: 'customer list · observed candidate',
              description: 'repair 成功后沉淀的候选',
              projectUid: 'proj_1',
              observationTags: ['obs-page-surface', 'obs-anchor-missing'],
              observationSummary: 'page_surface=observed；anchor_presence=not_found',
            }),
          ]
        : []) as never
    );

    const draft = await generateIntentProjectKnowledgeDraft({ projectUid: 'proj_1', maxCandidates: 5 });

    expect(draft.candidates).toHaveLength(1);
    expect(draft.candidates[0].observationTags).toEqual(['obs-page-surface', 'obs-anchor-missing']);
    expect(draft.candidates[0].observationSummary).toBe('page_surface=observed；anchor_presence=not_found');
    expect(draft.candidates[0].rule.promptNotes).toEqual(
      expect.arrayContaining([
        '该规则由 successful runs 自动草拟：passedRuns=1',
        'repair 受控观察：page_surface=observed；anchor_presence=not_found',
        'repair 观察标签：obs-page-surface / obs-anchor-missing',
      ])
    );
  });

  it('boosts successful run candidates that previously improved first-pass rate', async () => {
    const improvingRuleId = 'intent-success.customer-list.improving';
    const neutralRuleId = 'intent-success.customer-list.neutral';
    const passedSnapshots = [
      makeSuccessfulKnowledgeRun({
        runId: 'intent-run-success-improving',
        ruleId: improvingRuleId,
        title: 'customer list · improving candidate',
        description: '历史上提升过 first-pass 的候选',
        projectUid: 'proj_1',
      }),
      makeSuccessfulKnowledgeRun({
        runId: 'intent-run-success-neutral',
        ruleId: neutralRuleId,
        title: 'customer list · neutral candidate',
        description: '尚无历史反馈的候选',
        projectUid: 'proj_1',
      }),
    ];
    const terminalSnapshots = [
      makeRunSnapshot({
        runId: 'before_1',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T15:00:00.000Z',
        state: { result: { attempts: [makeAttempt(false), makeAttempt(true, 'repair')] } },
      }),
      makeRunSnapshot({
        runId: 'before_2',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T15:01:00.000Z',
        state: { result: { attempts: [makeAttempt(false), makeAttempt(true, 'repair')] } },
      }),
      makeRunSnapshot({
        runId: 'before_3',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T15:02:00.000Z',
        state: { result: { attempts: [makeAttempt(false), makeAttempt(true, 'repair')] } },
      }),
      makeRunSnapshot({
        runId: 'after_1',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T15:04:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_2',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T15:05:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_3',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T15:06:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_4',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T15:07:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_5',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T15:08:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_6',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T15:09:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
    ];
    vi.mocked(listIntentE2ERunSnapshots).mockImplementation(async (params) =>
      (params?.status === 'terminal' ? terminalSnapshots : passedSnapshots) as never
    );

    await writeIntentProjectKnowledgeAuditEntry({
      auditId: 'audit_improving',
      occurredAt: '2026-03-23T15:03:30.000Z',
      operation: 'merge',
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      title: '合并 improving successful run 候选',
      detail: 'improving test audit',
      writtenTo: knowledgePath,
      backupPath: path.join(backupDir, 'before-improving.json'),
      sourcePath: draftPath,
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
          ruleCount: 3,
          enabledRuleCount: 3,
          capabilitySlugCount: 3,
          preferredHelperCount: 3,
          stepPatchCount: 3,
          urlPatternCount: 3,
        },
        addedRuleIds: [improvingRuleId, neutralRuleId],
        removedRuleIds: [],
        updatedRuleIds: [],
      },
      meta: {
        mergedCandidateSources: ['successful_run'],
        mergedRunIds: ['intent-run-success-improving', 'intent-run-success-neutral'],
        selectedCandidateFeedbackStatuses: ['probationary', 'preferred'],
        selectedRiskyCandidateIds: ['candidate-improving'],
        appliedOverrideCandidateIds: [],
        appliedOverrideCandidateFeedbackStatuses: [],
        appliedAcknowledgedRiskCandidateIds: ['candidate-improving'],
        appliedAcknowledgedRiskCandidateFeedbackStatuses: ['probationary'],
        mergedCandidates: [
          {
            candidateId: 'candidate-improving',
            ruleId: improvingRuleId,
            source: 'successful_run',
            feedbackStatus: 'probationary',
            risky: true,
            overrideApplied: false,
            riskAcknowledged: true,
            runIds: ['intent-run-success-improving'],
          },
          {
            candidateId: 'candidate-neutral',
            ruleId: neutralRuleId,
            source: 'successful_run',
            feedbackStatus: 'preferred',
            risky: false,
            overrideApplied: false,
            riskAcknowledged: false,
            runIds: ['intent-run-success-neutral'],
          },
        ],
      },
    });

    const draft = await generateIntentProjectKnowledgeDraft({ projectUid: 'proj_1', maxCandidates: 5 });
    const summary = renderIntentProjectKnowledgeDraftSummary(draft);

    expect(draft.candidates.map((candidate) => candidate.rule.id)).toEqual([improvingRuleId, neutralRuleId]);
    expect(draft.candidates[0].feedback).toMatchObject({
      status: 'preferred',
      confidenceAdjustment: 18,
    });
    expect(draft.candidates[0].feedback?.supportingAuditIds).toHaveLength(1);
    expect(draft.candidates[0].feedback?.reasons[0]).toContain('风险确认后 first-pass 提升');
    expect(draft.candidates[1].feedback?.reasons[0]).not.toContain('风险确认后');
    expect(draft.candidates[0].confidence).toBeGreaterThan(draft.candidates[1].confidence);
    expect(summary).toContain('feedback=preferred:+18');
  });

  it('downranks successful run candidates that previously regressed first-pass rate', async () => {
    const regressingRuleId = 'intent-success.customer-list.regressing';
    const stableRuleId = 'intent-success.customer-list.stable';
    const passedSnapshots = [
      makeSuccessfulKnowledgeRun({
        runId: 'intent-run-success-regressing',
        ruleId: regressingRuleId,
        title: 'customer list · regressing candidate',
        description: '历史上拉低过 first-pass 的候选',
        projectUid: 'proj_1',
      }),
      makeSuccessfulKnowledgeRun({
        runId: 'intent-run-success-stable',
        ruleId: stableRuleId,
        title: 'customer list · stable candidate',
        description: '尚未证明有风险的候选',
        projectUid: 'proj_1',
      }),
    ];
    const terminalSnapshots = [
      makeRunSnapshot({
        runId: 'before_1',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T16:00:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'before_2',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T16:01:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'before_3',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T16:02:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_1',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T16:04:00.000Z',
        state: { result: { attempts: [makeAttempt(false), makeAttempt(true, 'repair')] } },
      }),
      makeRunSnapshot({
        runId: 'after_2',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T16:05:00.000Z',
        state: { result: { attempts: [makeAttempt(false), makeAttempt(true, 'repair')] } },
      }),
      makeRunSnapshot({
        runId: 'after_3',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T16:06:00.000Z',
        state: { result: { attempts: [makeAttempt(false), makeAttempt(true, 'repair')] } },
      }),
    ];
    vi.mocked(listIntentE2ERunSnapshots).mockImplementation(async (params) =>
      (params?.status === 'terminal' ? terminalSnapshots : passedSnapshots) as never
    );

    await writeIntentProjectKnowledgeAuditEntry({
      auditId: 'audit_regressing',
      occurredAt: '2026-03-23T16:03:30.000Z',
      operation: 'merge',
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      title: '合并 regressing successful run 候选',
      detail: 'regressing test audit',
      writtenTo: knowledgePath,
      backupPath: path.join(backupDir, 'before-regressing.json'),
      sourcePath: draftPath,
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
          preferredHelperCount: 2,
          stepPatchCount: 2,
          urlPatternCount: 2,
        },
        addedRuleIds: [regressingRuleId],
        removedRuleIds: [],
        updatedRuleIds: [],
      },
      meta: {
        mergedCandidateSources: ['successful_run'],
        mergedRunIds: ['intent-run-success-regressing'],
        selectedCandidateFeedbackStatuses: ['deprioritized'],
        selectedRiskyCandidateIds: ['candidate-regressing'],
        appliedOverrideCandidateIds: ['candidate-regressing'],
        appliedOverrideCandidateFeedbackStatuses: ['deprioritized'],
        appliedAcknowledgedRiskCandidateIds: [],
        appliedAcknowledgedRiskCandidateFeedbackStatuses: [],
        mergedCandidates: [
          {
            candidateId: 'candidate-regressing',
            ruleId: regressingRuleId,
            source: 'successful_run',
            feedbackStatus: 'deprioritized',
            risky: true,
            overrideApplied: true,
            riskAcknowledged: false,
            runIds: ['intent-run-success-regressing'],
          },
        ],
      },
    });

    const draft = await generateIntentProjectKnowledgeDraft({ projectUid: 'proj_1', maxCandidates: 5 });
    const summary = renderIntentProjectKnowledgeDraftSummary(draft);
    const regressingCandidate = draft.candidates.find((candidate) => candidate.rule.id === regressingRuleId);
    const stableCandidate = draft.candidates.find((candidate) => candidate.rule.id === stableRuleId);

    expect(draft.candidates.map((candidate) => candidate.rule.id)).toEqual([stableRuleId, regressingRuleId]);
    expect(regressingCandidate?.feedback).toMatchObject({
      status: 'deprioritized',
      confidenceAdjustment: -32,
    });
    expect(regressingCandidate?.feedback?.supportingAuditIds).toHaveLength(1);
    expect(regressingCandidate?.feedback?.reasons[0]).toContain('人工 override 后仍出现 rollback 风险');
    expect(stableCandidate?.confidence).toBeGreaterThan(regressingCandidate?.confidence || 0);
    expect(summary).toContain('feedback=deprioritized:-32');
  });

  it('keeps successful run candidates conservative when rule summary stays negative after restore', async () => {
    const restoredRuleId = 'intent-success.customer-list.restore-still-abnormal';
    const neutralRuleId = 'intent-success.customer-list.restore-neutral';
    const passedSnapshots = [
      makeSuccessfulKnowledgeRun({
        runId: 'intent-run-success-restore-risk',
        ruleId: restoredRuleId,
        title: 'customer list · restore still abnormal candidate',
        description: '回滚后仍未恢复的候选',
        projectUid: 'proj_1',
      }),
      makeSuccessfulKnowledgeRun({
        runId: 'intent-run-success-restore-neutral',
        ruleId: neutralRuleId,
        title: 'customer list · restore neutral candidate',
        description: '没有负向 rule summary 的候选',
        projectUid: 'proj_1',
      }),
    ];
    const terminalSnapshots = [
      makeRunSnapshot({
        runId: 'restore_before_1',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T17:00:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
      makeRunSnapshot({
        runId: 'restore_before_2',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T17:01:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
      makeRunSnapshot({
        runId: 'restore_before_3',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T17:02:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
      makeRunSnapshot({
        runId: 'restore_after_1',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T17:04:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
      makeRunSnapshot({
        runId: 'restore_after_2',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T17:05:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
      makeRunSnapshot({
        runId: 'restore_after_3',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T17:06:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
    ];
    vi.mocked(listIntentE2ERunSnapshots).mockImplementation(async (params) =>
      (params?.status === 'terminal' ? terminalSnapshots : passedSnapshots) as never
    );

    await writeIntentProjectKnowledgeAuditEntry({
      auditId: 'audit_restore_still_abnormal',
      occurredAt: '2026-03-23T17:03:00.000Z',
      operation: 'restore',
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      title: 'restore 后仍异常的 successful run 候选',
      detail: 'restore still abnormal test audit',
      writtenTo: knowledgePath,
      backupPath: path.join(backupDir, 'before-restore-still-abnormal.json'),
      sourcePath: draftPath,
      comparison: {
        before: {
          ruleCount: 2,
          enabledRuleCount: 2,
          capabilitySlugCount: 2,
          preferredHelperCount: 2,
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
        removedRuleIds: [restoredRuleId],
        updatedRuleIds: [],
      },
      meta: {
        restoredFrom: path.join(backupDir, 'restore-still-abnormal.json'),
        mergedCandidateSources: ['successful_run'],
        mergedRunIds: ['intent-run-success-restore-risk'],
        mergedCandidates: [
          {
            candidateId: 'candidate-restore-risk',
            ruleId: restoredRuleId,
            source: 'successful_run',
            feedbackStatus: 'deprioritized',
            risky: true,
            overrideApplied: false,
            riskAcknowledged: false,
            runIds: ['intent-run-success-restore-risk'],
          },
        ],
      },
    });

    const draft = await generateIntentProjectKnowledgeDraft({ projectUid: 'proj_1', maxCandidates: 5 });
    const summary = renderIntentProjectKnowledgeDraftSummary(draft);
    const restoredCandidate = draft.candidates.find((candidate) => candidate.rule.id === restoredRuleId);
    const neutralCandidate = draft.candidates.find((candidate) => candidate.rule.id === neutralRuleId);

    expect(restoredCandidate?.feedback).toMatchObject({
      status: 'deprioritized',
      confidenceAdjustment: -12,
    });
    expect(restoredCandidate?.feedback?.reasons[0]).toContain('规则效果汇总仍偏负向');
    expect(restoredCandidate?.feedback?.supportingAuditIds).toEqual(['audit_restore_still_abnormal']);
    expect(neutralCandidate?.feedback).toBeUndefined();
    expect(neutralCandidate?.confidence).toBeGreaterThan(restoredCandidate?.confidence || 0);
    expect(summary).toContain('feedback=deprioritized:-12');
  });

  it('boosts successful run candidates when rule summary shows decisionable recovery evidence', async () => {
    const recoveredRuleId = 'intent-success.customer-list.restore-recovered';
    const neutralRuleId = 'intent-success.customer-list.restore-neutral';
    const passedSnapshots = [
      makeSuccessfulKnowledgeRun({
        runId: 'intent-run-success-restore-recovered',
        ruleId: recoveredRuleId,
        title: 'customer list · restore recovered candidate',
        description: '回滚后已恢复的候选',
        projectUid: 'proj_1',
      }),
      makeSuccessfulKnowledgeRun({
        runId: 'intent-run-success-restore-neutral',
        ruleId: neutralRuleId,
        title: 'customer list · restore neutral candidate',
        description: '没有正向历史证据的候选',
        projectUid: 'proj_1',
      }),
    ];
    const terminalSnapshots = [
      makeRunSnapshot({
        runId: 'recovered_before_1',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T18:00:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
      makeRunSnapshot({
        runId: 'recovered_before_2',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T18:01:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
      makeRunSnapshot({
        runId: 'recovered_before_3',
        projectUid: 'proj_1',
        status: 'failed',
        endedAt: '2026-03-23T18:02:00.000Z',
        state: { result: { attempts: [makeAttempt(false)] } },
      }),
      makeRunSnapshot({
        runId: 'recovered_after_1',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:04:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'recovered_after_2',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:05:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'recovered_after_3',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:06:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
    ];
    vi.mocked(listIntentE2ERunSnapshots).mockImplementation(async (params) =>
      (params?.status === 'terminal' ? terminalSnapshots : passedSnapshots) as never
    );

    await writeIntentProjectKnowledgeAuditEntry({
      auditId: 'audit_restore_recovered_feedback',
      occurredAt: '2026-03-23T18:03:00.000Z',
      operation: 'restore',
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      title: 'restore 后已恢复的 successful run 候选',
      detail: 'restore recovered feedback audit',
      writtenTo: knowledgePath,
      backupPath: path.join(backupDir, 'before-restore-recovered.json'),
      sourcePath: draftPath,
      comparison: {
        before: {
          ruleCount: 2,
          enabledRuleCount: 2,
          capabilitySlugCount: 2,
          preferredHelperCount: 2,
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
        removedRuleIds: [recoveredRuleId],
        updatedRuleIds: [],
      },
      meta: {
        restoredFrom: path.join(backupDir, 'restore-recovered.json'),
        mergedCandidateSources: ['successful_run'],
        mergedRunIds: ['intent-run-success-restore-recovered'],
        mergedCandidates: [
          {
            candidateId: 'candidate-restore-recovered',
            ruleId: recoveredRuleId,
            source: 'successful_run',
            feedbackStatus: 'preferred',
            risky: false,
            overrideApplied: false,
            riskAcknowledged: false,
            runIds: ['intent-run-success-restore-recovered'],
          },
        ],
      },
    });

    const draft = await generateIntentProjectKnowledgeDraft({ projectUid: 'proj_1', maxCandidates: 5 });
    const summary = renderIntentProjectKnowledgeDraftSummary(draft);
    const recoveredCandidate = draft.candidates.find((candidate) => candidate.rule.id === recoveredRuleId);
    const neutralCandidate = draft.candidates.find((candidate) => candidate.rule.id === neutralRuleId);

    expect(draft.candidates.map((candidate) => candidate.rule.id)).toEqual([recoveredRuleId, neutralRuleId]);
    expect(recoveredCandidate?.feedback).toMatchObject({
      status: 'neutral',
      confidenceAdjustment: 6,
      knowledgeChangeSignal: 'positive',
    });
    expect(recoveredCandidate?.feedback?.reasons[0]).toContain('规则效果汇总偏正向');
    expect(recoveredCandidate?.feedback?.supportingAuditIds).toEqual(['audit_restore_recovered_feedback']);
    expect(recoveredCandidate?.confidence).toBeGreaterThan(neutralCandidate?.confidence || 0);
    expect(summary).toContain('feedback=neutral:+6');
  });

  it('auto-promotes successful run candidates with repeated acknowledged promotions', async () => {
    const promotedRuleId = 'intent-success.customer-list.promoted-repeat';
    const neutralRuleId = 'intent-success.customer-list.neutral-repeat';
    const passedSnapshots = [
      makeSuccessfulKnowledgeRun({
        runId: 'intent-run-success-promoted-repeat',
        ruleId: promotedRuleId,
        title: 'customer list · promoted repeat candidate',
        description: '多次观察后稳定转正的候选',
        projectUid: 'proj_1',
      }),
      makeSuccessfulKnowledgeRun({
        runId: 'intent-run-success-neutral-repeat',
        ruleId: neutralRuleId,
        title: 'customer list · neutral repeat candidate',
        description: '没有长期转正历史的候选',
        projectUid: 'proj_1',
      }),
    ];
    const terminalSnapshots = [
      makeRunSnapshot({
        runId: 'before_promote_1',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:00:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'before_promote_2',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:01:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'before_promote_3',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:02:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_promote_1',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:04:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_promote_2',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:05:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_promote_3',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:06:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_promote_4',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:07:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_promote_5',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:08:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_promote_6',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:09:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_promote_7',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:10:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_promote_8',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:11:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_promote_9',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:12:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_promote_10',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:13:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_promote_11',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:14:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_promote_12',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T18:15:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
    ];
    vi.mocked(listIntentE2ERunSnapshots).mockImplementation(async (params) =>
      (params?.status === 'terminal' ? terminalSnapshots : passedSnapshots) as never
    );

    await writeIntentProjectKnowledgeAuditEntry({
      auditId: 'audit_promote_repeat_1',
      occurredAt: '2026-03-23T18:03:30.000Z',
      operation: 'merge',
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      title: '第一次转正候选',
      detail: 'promote repeat 1',
      writtenTo: knowledgePath,
      backupPath: path.join(backupDir, 'before-promote-repeat-1.json'),
      sourcePath: draftPath,
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
          preferredHelperCount: 2,
          stepPatchCount: 2,
          urlPatternCount: 2,
        },
        addedRuleIds: [promotedRuleId],
        removedRuleIds: [],
        updatedRuleIds: [],
      },
      meta: {
        mergedCandidateSources: ['successful_run'],
        mergedRunIds: ['intent-run-success-promoted-repeat'],
        selectedCandidateFeedbackStatuses: ['probationary'],
        selectedRiskyCandidateIds: ['candidate-promote-repeat-1'],
        appliedOverrideCandidateIds: [],
        appliedOverrideCandidateFeedbackStatuses: [],
        appliedAcknowledgedRiskCandidateIds: ['candidate-promote-repeat-1'],
        appliedAcknowledgedRiskCandidateFeedbackStatuses: ['probationary'],
        mergedCandidates: [
          {
            candidateId: 'candidate-promote-repeat-1',
            ruleId: promotedRuleId,
            source: 'successful_run',
            feedbackStatus: 'probationary',
            risky: true,
            overrideApplied: false,
            riskAcknowledged: true,
            runIds: ['intent-run-success-promoted-repeat'],
          },
        ],
      },
    });

    await writeIntentProjectKnowledgeAuditEntry({
      auditId: 'audit_promote_repeat_2',
      occurredAt: '2026-03-23T18:09:30.000Z',
      operation: 'merge',
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      title: '第二次转正候选',
      detail: 'promote repeat 2',
      writtenTo: knowledgePath,
      backupPath: path.join(backupDir, 'before-promote-repeat-2.json'),
      sourcePath: draftPath,
      comparison: {
        before: {
          ruleCount: 2,
          enabledRuleCount: 2,
          capabilitySlugCount: 2,
          preferredHelperCount: 2,
          stepPatchCount: 2,
          urlPatternCount: 2,
        },
        after: {
          ruleCount: 3,
          enabledRuleCount: 3,
          capabilitySlugCount: 3,
          preferredHelperCount: 3,
          stepPatchCount: 3,
          urlPatternCount: 3,
        },
        addedRuleIds: [promotedRuleId],
        removedRuleIds: [],
        updatedRuleIds: [],
      },
      meta: {
        mergedCandidateSources: ['successful_run'],
        mergedRunIds: ['intent-run-success-promoted-repeat'],
        selectedCandidateFeedbackStatuses: ['probationary'],
        selectedRiskyCandidateIds: ['candidate-promote-repeat-2'],
        appliedOverrideCandidateIds: [],
        appliedOverrideCandidateFeedbackStatuses: [],
        appliedAcknowledgedRiskCandidateIds: ['candidate-promote-repeat-2'],
        appliedAcknowledgedRiskCandidateFeedbackStatuses: ['probationary'],
        mergedCandidates: [
          {
            candidateId: 'candidate-promote-repeat-2',
            ruleId: promotedRuleId,
            source: 'successful_run',
            feedbackStatus: 'probationary',
            risky: true,
            overrideApplied: false,
            riskAcknowledged: true,
            runIds: ['intent-run-success-promoted-repeat'],
          },
        ],
      },
    });

    const draft = await generateIntentProjectKnowledgeDraft({ projectUid: 'proj_1', maxCandidates: 5 });
    const promotedCandidate = draft.candidates.find((candidate) => candidate.rule.id === promotedRuleId);
    const neutralCandidate = draft.candidates.find((candidate) => candidate.rule.id === neutralRuleId);

    expect(promotedCandidate?.feedback).toMatchObject({
      status: 'preferred',
      confidenceAdjustment: 11,
    });
    expect(promotedCandidate?.feedback?.lifecyclePolicy).toBe('auto_promote_candidate');
    expect(promotedCandidate?.feedback?.lifecyclePolicyReason).toContain('长期稳定：已转正 2 次');
    expect(promotedCandidate?.feedback?.reasons.join('；')).toContain('长期稳定：已转正 2 次');
    expect(neutralCandidate?.feedback).toBeUndefined();
    expect((promotedCandidate?.confidence || 0)).toBeGreaterThan(neutralCandidate?.confidence || 0);
  });

  it('maps observe_guarded insight policy back to observe in draft feedback', async () => {
    const observeRuleId = 'intent-success.customer-list.observe-repeat';
    const passedSnapshots = [
      makeSuccessfulKnowledgeRun({
        runId: 'intent-run-success-observe-repeat',
        ruleId: observeRuleId,
        title: 'customer list · observe repeat candidate',
        description: '连续命中 observe provenance 的候选',
        projectUid: 'proj_1',
      }),
    ];
    const terminalSnapshots = [
      makeRunSnapshot({
        runId: 'before_observe_1',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T19:00:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'before_observe_2',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T19:01:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'before_observe_3',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T19:02:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_observe_1',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T19:04:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_observe_2',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T19:05:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_observe_3',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T19:06:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
      makeRunSnapshot({
        runId: 'after_observe_4',
        projectUid: 'proj_1',
        status: 'passed',
        endedAt: '2026-03-23T19:07:00.000Z',
        state: { result: { attempts: [makeAttempt(true)] } },
      }),
    ];
    vi.mocked(listIntentE2ERunSnapshots).mockImplementation(async (params) =>
      (params?.status === 'terminal' ? terminalSnapshots : passedSnapshots) as never
    );

    const observeNotice = {
      kind: 'observe' as const,
      level: 'info' as const,
      title: '继续观察候选',
      message: '本次选择包含仍需持续观察的候选。',
      provenanceType: 'observe' as const,
      candidateIds: ['candidate-observe-repeat'],
      ruleIds: [observeRuleId],
      feedbackStatuses: ['neutral' as const],
      lifecyclePolicies: ['observe' as const],
    };

    await writeIntentProjectKnowledgeAuditEntry({
      auditId: 'audit_observe_repeat_1',
      occurredAt: '2026-03-23T19:03:30.000Z',
      operation: 'merge',
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      title: '第一次 observe repeat 候选',
      detail: 'observe repeat 1',
      writtenTo: knowledgePath,
      backupPath: path.join(backupDir, 'before-observe-repeat-1.json'),
      sourcePath: draftPath,
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
          preferredHelperCount: 2,
          stepPatchCount: 2,
          urlPatternCount: 2,
        },
        addedRuleIds: [observeRuleId],
        removedRuleIds: [],
        updatedRuleIds: [],
      },
      meta: {
        mergedCandidateSources: ['successful_run'],
        mergedRunIds: ['intent-run-success-observe-repeat'],
        selectedCandidateFeedbackStatuses: ['neutral'],
        selectedRiskyCandidateIds: [],
        appliedOverrideCandidateIds: [],
        appliedOverrideCandidateFeedbackStatuses: [],
        appliedAcknowledgedRiskCandidateIds: [],
        appliedAcknowledgedRiskCandidateFeedbackStatuses: [],
        mergedCandidates: [
          {
            candidateId: 'candidate-observe-repeat-1',
            ruleId: observeRuleId,
            source: 'successful_run',
            feedbackStatus: 'neutral',
            risky: false,
            overrideApplied: false,
            riskAcknowledged: false,
            runIds: ['intent-run-success-observe-repeat'],
          },
        ],
        preflightSummary: {
          requiresOverride: false,
          requiresRiskAcknowledgement: false,
          autoPromoteCount: 0,
          observeCount: 1,
          blockDefaultMergeCount: 0,
          itemCount: 1,
          items: [observeNotice],
        },
        mergeReceipts: [],
      },
    });

    await writeIntentProjectKnowledgeAuditEntry({
      auditId: 'audit_observe_repeat_2',
      occurredAt: '2026-03-23T19:05:30.000Z',
      operation: 'merge',
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      title: '第二次 observe repeat 候选',
      detail: 'observe repeat 2',
      writtenTo: knowledgePath,
      backupPath: path.join(backupDir, 'before-observe-repeat-2.json'),
      sourcePath: draftPath,
      comparison: {
        before: {
          ruleCount: 2,
          enabledRuleCount: 2,
          capabilitySlugCount: 2,
          preferredHelperCount: 2,
          stepPatchCount: 2,
          urlPatternCount: 2,
        },
        after: {
          ruleCount: 3,
          enabledRuleCount: 3,
          capabilitySlugCount: 3,
          preferredHelperCount: 3,
          stepPatchCount: 3,
          urlPatternCount: 3,
        },
        addedRuleIds: [observeRuleId],
        removedRuleIds: [],
        updatedRuleIds: [],
      },
      meta: {
        mergedCandidateSources: ['successful_run'],
        mergedRunIds: ['intent-run-success-observe-repeat'],
        selectedCandidateFeedbackStatuses: ['neutral'],
        selectedRiskyCandidateIds: [],
        appliedOverrideCandidateIds: [],
        appliedOverrideCandidateFeedbackStatuses: [],
        appliedAcknowledgedRiskCandidateIds: [],
        appliedAcknowledgedRiskCandidateFeedbackStatuses: [],
        mergedCandidates: [
          {
            candidateId: 'candidate-observe-repeat-2',
            ruleId: observeRuleId,
            source: 'successful_run',
            feedbackStatus: 'neutral',
            risky: false,
            overrideApplied: false,
            riskAcknowledged: false,
            runIds: ['intent-run-success-observe-repeat'],
          },
        ],
        preflightSummary: {
          requiresOverride: false,
          requiresRiskAcknowledgement: false,
          autoPromoteCount: 0,
          observeCount: 1,
          blockDefaultMergeCount: 0,
          itemCount: 1,
          items: [observeNotice],
        },
        mergeReceipts: [],
      },
    });

    const draft = await generateIntentProjectKnowledgeDraft({ projectUid: 'proj_1', maxCandidates: 5 });
    const observeCandidate = draft.candidates.find((candidate) => candidate.rule.id === observeRuleId);

    expect(observeCandidate?.feedback).toMatchObject({
      status: 'probationary',
      lifecyclePolicy: 'observe',
    });
    expect(observeCandidate?.feedback?.lifecyclePolicyReason).toContain('连续处于 observe provenance');
    expect(observeCandidate?.feedback?.reasons.join('；')).toContain('连续处于 observe provenance');
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
