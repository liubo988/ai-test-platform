import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/llm-client', () => ({
  callLLMStructured: vi.fn(),
  callLLMStream: vi.fn(),
}));

import { generateTest, repairTest, type GenerateEvent } from '@/lib/test-generator';
import { callLLMStructured, callLLMStream } from '@/lib/llm-client';
import { compileIntentExecutionTemplate } from '@/lib/intent-execution-compiler';
import { applyIntentExecutionSlotPatch } from '@/lib/intent-execution-slot-patch';

function createPlanning() {
  return {
    dsl: {
      version: 1 as const,
      mode: 'scenario' as const,
      targetUrl: 'https://example.com/#/business/createbusiness',
      summary: '创建商机并验证列表',
      globalRules: [],
      preferredPrimitives: [],
      outputContract: [],
      steps: [],
    },
    knowledge: {
      version: 1 as const,
      profilePath: 'intent-e2e.project-knowledge.json',
      matches: [],
      deprioritizedMatches: [],
      capabilitySlugs: [],
    },
    starterHelpers: [],
    executionPlan: {
      version: 1 as const,
      compiler: 'deterministic_dsl_v1' as const,
      mode: 'scenario' as const,
      entryUrl: 'https://example.com/#/business/createbusiness',
      summary: '创建商机并验证列表',
      expectedOutcome: '创建成功并能按 businessId 检索到记录',
      sharedVariables: ['businessId'],
      globalRules: [],
      preferredPrimitives: [],
      outputContract: [],
      steps: [
        {
          planStepUid: 'plan_step_1',
          scenarioStepUid: 'step_create',
          stepType: 'ui' as const,
          title: '提交创建商机',
          target: 'https://example.com/#/business/createbusiness',
          goal: '填写表单并提交',
          allowedActions: ['fill', 'click', 'wait_for_response', 'observe_submit_state'],
          preferredHelpers: ['__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
          requiredAssertions: ['提交接口成功'],
          extractVariable: 'businessId',
          sharedVariables: ['businessId'],
          dependsOnPlanStepUids: [],
        },
        {
          planStepUid: 'plan_step_2',
          scenarioStepUid: 'step_verify',
          stepType: 'assert' as const,
          title: '列表校验',
          target: 'https://example.com/#/business/businesslist',
          goal: '按 businessId 检索目标行',
          allowedActions: ['find_table_row', 'assert_text'],
          preferredHelpers: ['__e2e.findAntdTableRow'],
          requiredAssertions: ['列表检索到目标 businessId'],
          extractVariable: '',
          sharedVariables: ['businessId'],
          dependsOnPlanStepUids: ['plan_step_1'],
        },
      ],
    },
    verificationPlan: {
      version: 1 as const,
      strategy: 'deterministic_verification_v1' as const,
      expectedOutcome: '创建成功并能按 businessId 检索到记录',
      cleanupNotes: '',
      checks: [
        {
          checkUid: 'verify_success_1',
          kind: 'response' as const,
          source: 'success_criteria' as const,
          title: '成功标准 1',
          instruction: '提交接口成功',
          stableIdentifiers: ['businessId'],
          expectedFields: [],
          fieldSpecs: [
            {
              label: 'businessId',
              expectedSource: 'response_json' as const,
              preferredPaths: ['businessId', 'data.businessId', 'id'],
            },
          ],
          preferredHelpers: ['__e2e.waitForApiResponse'],
          relatedPlanStepUids: ['plan_step_1'],
          required: true,
        },
        {
          checkUid: 'verify_success_2',
          kind: 'table_row' as const,
          source: 'success_criteria' as const,
          title: '成功标准 2',
          instruction: '列表检索到目标 businessId，若未命中则在详情页核对联系人、手机号和状态',
          stableIdentifiers: ['businessId'],
          expectedFields: ['联系人', '手机号', '状态', 'businessId'],
          fieldSpecs: [
            {
              label: '联系人',
              expectedSource: 'list_record' as const,
              preferredPaths: ['contactName', 'contact', 'contactPerson'],
              scopeHints: ['详情页'],
            },
            {
              label: '手机号',
              expectedSource: 'list_record' as const,
              preferredPaths: ['mobile', 'phone', 'contactMobile'],
              scopeHints: ['详情页'],
            },
            {
              label: '状态',
              expectedSource: 'list_record' as const,
              preferredPaths: ['status', 'statusName', 'displayStatus'],
              scopeHints: ['详情页'],
            },
            {
              label: 'businessId',
              expectedSource: 'shared_variable' as const,
              preferredPaths: ['businessId', 'data.businessId', 'id'],
              scopeHints: ['详情页'],
            },
          ],
          recordLookup: {
            listResponse: { urlIncludes: '/business', method: 'GET' as const },
            detailUrl: '/business/detail/{{primaryValue}}',
            rowHasTexts: ['businessId', '新入库'],
            detailEntry: {
              trigger: 'row_action' as const,
              actionLabel: '查看',
              target: 'drawer_or_modal' as const,
            },
          },
          detailSurface: {
            titleIncludes: '商机详情',
            scopeHints: ['详情页'],
          },
          preferredHelpers: ['__e2e.findAntdTableRow'],
          relatedPlanStepUids: ['plan_step_2'],
          required: true,
        },
      ],
    },
  };
}

async function collect(stream: AsyncGenerator<GenerateEvent>): Promise<GenerateEvent[]> {
  const events: GenerateEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

describe('test-generator structured slot patch path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits an explicit legacy fallback reason before raw first-pass code generation', async () => {
    vi.mocked(callLLMStream).mockImplementation(
      (async function* () {
        yield { content: '```javascript\n' };
        yield { content: "test('raw fallback generation', async () => {});\n" };
        yield { content: '```' };
      }) as never
    );

    const planning = createPlanning();
    const fallbackPlanning = {
      ...planning,
      executionPlan: undefined,
    };

    const events = await collect(
      generateTest(
        {
          url: 'https://example.com/#/business/createbusiness',
          title: '创建商机',
          forms: [],
          buttons: [],
          tooltipElements: [],
          links: [],
          headings: [{ level: 'H1', text: '创建商机' }],
          bodyTextExcerpt: '创建商机 表单 提交',
          screenshot: '',
        } as any,
        '创建商机并回列表校验',
        undefined,
        {
          taskMode: 'scenario',
          scenarioEntryUrl: 'https://example.com/#/business/createbusiness',
          expectedOutcome: '创建成功并能按 businessId 检索到记录',
        },
        undefined,
        undefined,
        fallbackPlanning as any
      )
    );

    expect(vi.mocked(callLLMStructured)).not.toHaveBeenCalled();
    expect(vi.mocked(callLLMStream)).toHaveBeenCalledTimes(1);
    expect(events.map((event) => event.content).join('\n')).toContain(
      '当前 planning 未提供 ExecutionPlan，当前显式回退到自由代码生成（legacy fallback，非主链）...'
    );
    expect(events.map((event) => event.content).join('\n')).toContain('正在构造自由代码 Prompt 并调用 LLM...');
    expect(events.at(-1)?.type).toBe('complete');
    expect(events.map((event) => event.content).join('\n')).toContain("test('raw fallback generation'");
  });

  it('emits an explicit legacy fallback reason before raw repair code generation', async () => {
    vi.mocked(callLLMStream).mockImplementation(
      (async function* () {
        yield { content: '```javascript\n' };
        yield { content: "test('raw fallback repair', async () => {});\n" };
        yield { content: '```' };
      }) as never
    );

    const planning = createPlanning();
    const fallbackPlanning = {
      ...planning,
      executionPlan: undefined,
    };

    const events = await collect(
      repairTest(
        {
          url: 'https://example.com/#/business/createbusiness',
          title: '创建商机',
          forms: [],
          buttons: [],
          tooltipElements: [],
          links: [],
          headings: [{ level: 'H1', text: '创建商机' }],
          bodyTextExcerpt: '创建商机 表单 提交',
          screenshot: '',
        } as any,
        '创建商机并回列表校验',
        {
          previousCode: "test('previous', async () => {});",
          executionError: '结构化脚手架不可用',
          failedStepTitle: 'Step 2: 列表校验',
          failureSummary: '缺少 ExecutionPlan',
        },
        undefined,
        {
          taskMode: 'scenario',
          scenarioEntryUrl: 'https://example.com/#/business/createbusiness',
          expectedOutcome: '创建成功并能按 businessId 检索到记录',
        },
        undefined,
        undefined,
        fallbackPlanning as any
      )
    );

    expect(vi.mocked(callLLMStructured)).not.toHaveBeenCalled();
    expect(vi.mocked(callLLMStream)).toHaveBeenCalledTimes(1);
    expect(events.map((event) => event.content).join('\n')).toContain(
      '当前 planning 未提供 ExecutionPlan，当前 repair 显式回退到自由代码修复（legacy fallback，非主链）...'
    );
    expect(events.map((event) => event.content).join('\n')).toContain('正在构造自由代码修复 Prompt 并调用 LLM...');
    expect(events.at(-1)?.type).toBe('complete');
    expect(events.map((event) => event.content).join('\n')).toContain("test('raw fallback repair'");
  });

  it('uses structured slot patches for first-pass generation when executionPlan exists', async () => {
    vi.mocked(callLLMStructured).mockResolvedValue({
      version: 1,
      slots: [
        {
          slotUid: 'plan_step_1',
          code: [
            "const createResp = __e2e.waitForApiResponse(page, { urlIncludes: '/business', method: 'POST' });",
            'await submitButton.click();',
            "artifacts['plan_step_1'] = await createResp;",
            "shared.businessId = 'BIZ-001';",
          ].join('\n'),
        },
        {
          slotUid: 'plan_step_2',
          code: [
            "const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.businessId, '新入库'] });",
            "await expect(targetRow).toContainText(shared.businessId);",
          ].join('\n'),
        },
        {
          slotUid: 'verification',
          code: [
            "expect(shared.businessId).toBe('BIZ-001');",
            "await expect.poll(() => page.url()).toContain('#/business/businesslist');",
          ].join('\n'),
        },
      ],
    } as never);

    const planning = createPlanning();
    const events = await collect(
      generateTest(
        {
          url: 'https://example.com/#/business/createbusiness',
          title: '创建商机',
          forms: [],
          buttons: [],
          tooltipElements: [],
          links: [],
          headings: [{ level: 'H1', text: '创建商机' }],
          bodyTextExcerpt: '创建商机 表单 提交',
          screenshot: '',
        } as any,
        '创建商机并回列表校验',
        undefined,
        {
          taskMode: 'scenario',
          scenarioEntryUrl: 'https://example.com/#/business/createbusiness',
          expectedOutcome: '创建成功并能按 businessId 检索到记录',
        },
        undefined,
        undefined,
        planning as any
      )
    );

    const complete = events.find((event) => event.type === 'complete');
    expect(complete?.content).toContain("artifacts['plan_step_1'] = await createResp;");
    expect(complete?.content).toContain("__e2e.findAntdTableRow(page, { hasTexts: [shared.businessId, '新入库'] })");
    expect(complete?.content).not.toContain('__PLAN_SLOT_');
    expect(complete?.content).toContain('// SLOT_START: plan_step_1');
    expect(vi.mocked(callLLMStructured)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(callLLMStream)).not.toHaveBeenCalled();
    expect(vi.mocked(callLLMStructured).mock.calls[0]?.[0]).toMatchObject({
      schemaName: 'intent_execution_slot_patch',
    });
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain('固定骨架 [verify_success_1]：');
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain('stableIdentifiers: businessId');
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain('expectedFields: 联系人 / 手机号 / 状态 / businessId');
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain(
      'fieldSpecs: 联系人 { source=list_record; paths=contactName / contact / contactPerson; scope=详情页 }'
    );
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain(
      '结构化回查参数：listResponse=GET /business；detailUrl=#/business/detail/{{primaryValue}}；rowHasTexts=businessId / 新入库；detailEntry=trigger=row_action / actionLabel=查看 / target=drawer_or_modal'
    );
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain(
      'detailSurface: titleIncludes=商机详情; scopeHints=详情页'
    );
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain(
      'const verify_success_2Record = verify_success_2CurrentVisibleRow'
    );
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain(
      ': await __e2e.resolvePrimaryRecord(page, {'
    );
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain(
      'await __e2e.clickAntdRowAction(page, verify_success_2Record.row, "查看");'
    );
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain(
      'let verify_success_2DetailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: "商机详情", timeoutMs: 5000, required: false });'
    );
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain(
      'verify_success_2DetailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: "商机详情", timeoutMs: 2500, required: false });'
    );
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain(
      'if (!verify_success_2DetailScope) throw new Error("状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页");'
    );
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain('__e2e.pickJsonRecord(verify_success_2ListPayload');
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain(
      '__e2e.readDetailField(page, { label: "联系人", scope: verify_success_2DetailScope, titleIncludes: "商机详情", required: false })'
    );
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain(
      '如果 businessId 暂时为空，不要立刻写 expect(shared.businessId).toBeTruthy()'
    );
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain(
      '把 urlIncludes 只当辅助观察'
    );
  });

  it('short-circuits to a recipe-matched deterministic runtime template before LLM generation', async () => {
    const events = await collect(
      generateTest(
        {
          url: 'https://example.com/#/business/createbusiness',
          title: '创建商机',
          forms: [],
          buttons: [],
          tooltipElements: [],
          links: [],
          headings: [{ level: 'H1', text: '创建商机' }],
          bodyTextExcerpt: '创建商机 表单 提交',
          screenshot: '',
        } as any,
        '完成商机转化主链路',
        undefined,
        {
          taskMode: 'scenario',
          scenarioEntryUrl: 'https://example.com/#/business/createbusiness',
          expectedOutcome: '完成主链路',
        },
        undefined,
        undefined,
        {
          recipes: [
            {
              recipe: {
                version: 1,
                slug: 'business.create-to-order',
                title: '商机创建后生成订单',
                description: 'deterministic runtime recipe',
                matchers: {},
                requiredContext: [],
                executorPlan: [],
                verifierPlan: [],
                knownPitfalls: [],
                successRate: 0,
                lastVerifiedAt: '',
              },
              score: 9,
              matchedSignals: ['intent=生成订单'],
            },
          ],
        } as any
      )
    );

    const complete = events.find((event) => event.type === 'complete');
    expect(complete?.content).toContain('createOrder 成功为主断言');
    expect(complete?.content).toContain("__e2e.clickAntdRowAction(page, targetRow, '生成订单')");
    expect(vi.mocked(callLLMStructured)).not.toHaveBeenCalled();
    expect(vi.mocked(callLLMStream)).not.toHaveBeenCalled();
  });

  it('repairs only the failed slot when the previous code still preserves slot markers', async () => {
    const planning = createPlanning();
    const template = compileIntentExecutionTemplate({
      executionPlan: planning.executionPlan,
      verificationPlan: planning.verificationPlan,
      description: '创建商机并回列表校验',
    });
    const previousCode = applyIntentExecutionSlotPatch(template.code, {
      version: 1,
      slots: [
        {
          slotUid: 'plan_step_1',
          code: [
            "const createResp = __e2e.waitForApiResponse(page, { urlIncludes: '/business', method: 'POST' });",
            'await submitButton.click();',
            "artifacts['plan_step_1'] = await createResp;",
            "shared.businessId = 'BIZ-001';",
          ].join('\n'),
        },
        {
          slotUid: 'plan_step_2',
          code: [
            "const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.businessId, '旧状态'] });",
            "await expect(targetRow).toContainText(shared.businessId);",
          ].join('\n'),
        },
        {
          slotUid: 'verification',
          code: [
            "expect(shared.businessId).toBe('BIZ-001');",
            "await expect.poll(() => page.url()).toContain('#/business/businesslist');",
          ].join('\n'),
        },
      ],
    });

    vi.mocked(callLLMStructured).mockResolvedValue({
      version: 1,
      patchedPlan: {
        planStepUids: ['plan_step_2'],
      },
      patchedVerifier: {
        checkUids: ['verify_success_2'],
      },
      patchedRecipeSelection: {
        recipeSlugs: [],
      },
      slots: [
        {
          slotUid: 'plan_step_2',
          code: [
            "const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.businessId, '新入库'] });",
            "await expect(targetRow).toContainText('新入库');",
          ].join('\n'),
        },
      ],
    } as never);

    const events = await collect(
      repairTest(
        {
          url: 'https://example.com/#/business/createbusiness',
          title: '创建商机',
          forms: [],
          buttons: [],
          tooltipElements: [],
          links: [],
          headings: [{ level: 'H1', text: '创建商机' }],
          bodyTextExcerpt: '创建商机 表单 提交',
          screenshot: '',
        } as any,
        '创建商机并回列表校验',
        {
          previousCode,
          executionError: '未找到表格目标行：hasTexts=BIZ-001 | 新入库',
          failedStepTitle: 'Step 2: 列表校验',
          failureSummary: '判定为目标行未命中',
          latestTrace: ['FAILED Step 2: 列表校验: 未找到表格目标行', 'INFO 结构化诊断：步骤=Step 2: 列表校验；锚点=businessId'],
          graderDiagnosis: {
            failureClass: 'target_row_not_found',
            summary: '判定为目标行未命中，可尝试按主键检索修复。',
            failureSignature: 'target_row_not_found|Step 2: 列表校验|businessId',
            failedStepTitle: 'Step 2: 列表校验',
            targetAnchor: 'businessId',
            repeatedCount: 1,
            nextActions: ['优先按 businessId 回查，不要继续放宽文本匹配。'],
          },
        },
        undefined,
        {
          taskMode: 'scenario',
          scenarioEntryUrl: 'https://example.com/#/business/createbusiness',
          expectedOutcome: '创建成功并能按 businessId 检索到记录',
        },
        undefined,
        undefined,
        planning as any
      )
    );

    const structured = events.find((event) => event.type === 'structured_patch');
    const complete = events.find((event) => event.type === 'complete');
    expect(complete?.content).toContain("artifacts['plan_step_1'] = await createResp;");
    expect(complete?.content).toContain("hasTexts: [shared.businessId, '新入库']");
    expect(complete?.content).not.toContain("hasTexts: [shared.businessId, '旧状态']");
    expect(complete?.content).toContain("expect(shared.businessId).toBe('BIZ-001');");
    expect(structured?.type).toBe('structured_patch');
    expect(structured && structured.type === 'structured_patch' ? structured.repairOutput : undefined).toMatchObject({
      strategy: 'deterministic_repair_patch_v1',
      patchedPlan: {
        planStepUids: ['plan_step_2'],
      },
      patchedVerifier: {
        checkUids: ['verify_success_2'],
      },
      patchedRecipeSelection: {
        recipeSlugs: [],
      },
    });
    expect(vi.mocked(callLLMStructured).mock.calls[0]?.[0]).toMatchObject({
      schemaName: 'intent_execution_repair_patch',
    });
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain('## Repair Context（结构化输入）');
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain('[plan_step_2] plan_step · 列表校验');
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain('## Grader Diagnosis');
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain('failureClass: target_row_not_found');
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain('[verify_success_2] 成功标准 2');
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain('## Latest Trace（最近执行轨迹）');
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain('## Repair Output Contract（覆盖上文所有“输出纯 JS”要求）');
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain('patchedPlan: { planStepUids: [] }');
    expect(JSON.stringify(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.schema || {})).toContain('plan_step_2');
    expect(JSON.stringify(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.schema || {})).toContain('verify_success_2');
    expect(JSON.stringify(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.schema || {})).not.toContain('plan_step_1');
  });

  it('rejects structured repair patches that introduce syntax errors before worker execution', async () => {
    const planning = createPlanning();
    const template = compileIntentExecutionTemplate({
      executionPlan: planning.executionPlan,
      verificationPlan: planning.verificationPlan,
      description: '创建商机并回列表校验',
    });
    const previousCode = applyIntentExecutionSlotPatch(template.code, {
      version: 1,
      slots: [
        {
          slotUid: 'plan_step_1',
          code: [
            "const createResp = __e2e.waitForApiResponse(page, { urlIncludes: '/business', method: 'POST' });",
            'await submitButton.click();',
            "artifacts['plan_step_1'] = await createResp;",
            "shared.businessId = 'BIZ-001';",
          ].join('\n'),
        },
        {
          slotUid: 'plan_step_2',
          code: [
            "const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.businessId, '旧状态'] });",
            "await expect(targetRow).toContainText(shared.businessId);",
          ].join('\n'),
        },
        {
          slotUid: 'verification',
          code: [
            "expect(shared.businessId).toBe('BIZ-001');",
            "await expect.poll(() => page.url()).toContain('#/business/businesslist');",
          ].join('\n'),
        },
      ],
    });

    vi.mocked(callLLMStructured).mockResolvedValue({
      version: 1,
      patchedPlan: {
        planStepUids: ['plan_step_2'],
      },
      patchedVerifier: {
        checkUids: ['verify_success_2'],
      },
      patchedRecipeSelection: {
        recipeSlugs: [],
      },
      slots: [
        {
          slotUid: 'plan_step_2',
          code: [
            "const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.businessId, '新入库'] });",
            'const broken = (',
          ].join('\n'),
        },
      ],
    } as never);

    const events = await collect(
      repairTest(
        {
          url: 'https://example.com/#/business/createbusiness',
          title: '创建商机',
          forms: [],
          buttons: [],
          tooltipElements: [],
          links: [],
          headings: [{ level: 'H1', text: '创建商机' }],
          bodyTextExcerpt: '创建商机 表单 提交',
          screenshot: '',
        } as any,
        '创建商机并回列表校验',
        {
          previousCode,
          executionError: '未找到表格目标行：hasTexts=BIZ-001 | 新入库',
          failedStepTitle: 'Step 2: 列表校验',
          failureSummary: '判定为目标行未命中',
        },
        undefined,
        {
          taskMode: 'scenario',
          scenarioEntryUrl: 'https://example.com/#/business/createbusiness',
          expectedOutcome: '创建成功并能按 businessId 检索到记录',
        },
        undefined,
        undefined,
        planning as any
      )
    );

    expect(events.some((event) => event.type === 'complete')).toBe(false);
    expect(events.map((event) => event.content).join('\n')).toContain('LLM 结构化 repair patch 失败');
    expect(events.map((event) => event.content).join('\n')).toContain('repair patch 合并后脚本存在语法错误');
  });

  it('targets the verification slot when repair failedStepTitle points to final verification', async () => {
    const planning = createPlanning();
    const template = compileIntentExecutionTemplate({
      executionPlan: planning.executionPlan,
      verificationPlan: planning.verificationPlan,
      description: '创建商机并回列表校验',
    });
    const previousCode = applyIntentExecutionSlotPatch(template.code, {
      version: 1,
      slots: [
        {
          slotUid: 'plan_step_1',
          code: "artifacts['plan_step_1'] = null;",
        },
        {
          slotUid: 'plan_step_2',
          code: "artifacts['plan_step_2'] = null;",
        },
        {
          slotUid: 'verification',
          code: "const switchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/business', method: 'GET' });\nawait __e2e.switchBusinessListOwnershipView(page, { label: '我创建的', listUrl: LIST_URL });\nawait switchResp;",
        },
      ],
    });

    vi.mocked(callLLMStructured).mockResolvedValue({
      version: 1,
      patchedPlan: {
        planStepUids: [],
      },
      patchedVerifier: {
        checkUids: ['verify_success_1', 'verify_success_2'],
      },
      patchedRecipeSelection: {
        recipeSlugs: [],
      },
      slots: [
        {
          slotUid: 'verification',
          code: "await __e2e.switchBusinessListOwnershipView(page, { label: '我创建的', listUrl: LIST_URL });",
        },
      ],
    } as never);

    const events = await collect(
      repairTest(
        {
          url: 'https://example.com/#/business/createbusiness',
          title: '创建商机',
          forms: [],
          buttons: [],
          tooltipElements: [],
          links: [],
          headings: [{ level: 'H1', text: '创建商机' }],
          bodyTextExcerpt: '创建商机 表单 提交',
          screenshot: '',
        } as any,
        '创建商机并回列表校验',
        {
          previousCode,
          executionError: 'page.waitForResponse: Timeout 15000ms exceeded while waiting for event "response"',
          failedStepTitle: 'Verification: 最终业务验收',
          failureSummary: '最终验收阶段等待列表刷新超时',
          latestTrace: ['FAILED Verification: 最终业务验收: page.waitForResponse timeout'],
        },
        undefined,
        {
          taskMode: 'scenario',
          scenarioEntryUrl: 'https://example.com/#/business/createbusiness',
          expectedOutcome: '创建成功并能按 businessId 检索到记录',
        },
        undefined,
        undefined,
        planning as any
      )
    );

    const structured = events.find((event) => event.type === 'structured_patch');
    expect(structured?.type).toBe('structured_patch');
    expect(structured && structured.type === 'structured_patch' ? structured.repairOutput?.targetSlotUids : undefined).toEqual([
      'verification',
    ]);
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain('targetSlots: verification');
    expect(String(vi.mocked(callLLMStructured).mock.calls[0]?.[0]?.prompt || '')).toContain(
      '[verification] verification · 最终验收'
    );
  });
});
