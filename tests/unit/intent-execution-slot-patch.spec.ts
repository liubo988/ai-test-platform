import { describe, expect, it } from 'vitest';
import {
  applyIntentExecutionSlotPatch,
  buildIntentExecutionRepairPatchSchema,
  buildIntentExecutionSlotPatchSchema,
  extractIntentExecutionSlotCode,
  hasIntentExecutionSlotMarkers,
  normalizeIntentExecutionRepairPatch,
  normalizeIntentExecutionSlotPatch,
  resolveIntentExecutionPatchTargetSlotUids,
} from '@/lib/intent-execution-slot-patch';
import { compileIntentExecutionTemplate } from '@/lib/intent-execution-compiler';

function createTemplate() {
  return compileIntentExecutionTemplate({
    description: '创建商机并回列表校验',
    executionPlan: {
      version: 1,
      compiler: 'deterministic_dsl_v1',
      mode: 'scenario',
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
          stepType: 'ui',
          title: '提交创建商机',
          target: 'https://example.com/#/business/createbusiness',
          goal: '填写表单并提交，等待页面收敛',
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
          stepType: 'assert',
          title: '列表校验',
          target: 'https://example.com/#/business/businesslist',
          goal: '按 businessId 检索并命中目标行',
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
      version: 1,
      strategy: 'deterministic_verification_v1',
      expectedOutcome: '创建成功并能按 businessId 检索到记录',
      cleanupNotes: '',
      checks: [
        {
          checkUid: 'verify_success_1',
          kind: 'response',
          source: 'success_criteria',
          title: '成功标准 1',
          instruction: '提交接口成功',
          preferredHelpers: ['__e2e.waitForApiResponse'],
          relatedPlanStepUids: ['plan_step_1'],
          required: true,
        },
        {
          checkUid: 'verify_success_2',
          kind: 'table_row',
          source: 'success_criteria',
          title: '成功标准 2',
          instruction: '列表检索到目标 businessId',
          preferredHelpers: ['__e2e.findAntdTableRow'],
          relatedPlanStepUids: ['plan_step_2'],
          required: true,
        },
      ],
    },
  });
}

describe('intent-execution-slot-patch', () => {
  it('builds a strict schema and resolves target slots from failed step titles', () => {
    const template = createTemplate();
    const schema = buildIntentExecutionSlotPatchSchema(['plan_step_2', 'verification']);

    expect(schema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['version', 'slots'],
    });

    expect(resolveIntentExecutionPatchTargetSlotUids(template, { failedStepTitle: 'Step 2: 列表校验' })).toEqual(['plan_step_2']);
    expect(resolveIntentExecutionPatchTargetSlotUids(template, { failedStepTitle: 'Verification: 最终业务验收' })).toEqual(['verification']);
    expect(resolveIntentExecutionPatchTargetSlotUids(template, { failedStepTitle: '未知失败' })).toEqual([
      'plan_step_1',
      'plan_step_2',
      'verification',
    ]);
  });

  it('normalizes and applies slot patches while keeping markers for future repair', () => {
    const template = createTemplate();
    const patch = normalizeIntentExecutionSlotPatch(
      {
        version: 1,
        slots: [
          {
            slotUid: 'plan_step_1',
            code: [
              "const createResp = __e2e.waitForApiResponse(page, { urlIncludes: '/business', method: 'POST' });",
              '// 点击保存前先注册关键接口等待',
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
              "await test.step('意外追加的外层包装', async () => {",
              "  await expect(page.locator('body')).toBeVisible();",
              '});',
            ].join('\n'),
          },
        ],
      },
      ['plan_step_1', 'plan_step_2', 'verification']
    );

    const nextCode = applyIntentExecutionSlotPatch(template.code, patch);

    expect(hasIntentExecutionSlotMarkers(nextCode, 'plan_step_1')).toBe(true);
    expect(nextCode).toContain("const createResp = __e2e.waitForApiResponse(page, { urlIncludes: '/business', method: 'POST' });");
    expect(nextCode).toContain("const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.businessId, '新入库'] });");
    expect(nextCode).toContain("await expect.poll(() => page.url()).toContain('#/business/businesslist');");
    expect(nextCode).not.toContain('__PLAN_SLOT_plan_step_1__');
    expect(extractIntentExecutionSlotCode(nextCode, 'plan_step_2')).toContain('__e2e.findAntdTableRow');
  });

  it('salvages slot patches that accidentally echo test wrappers or slot markers', () => {
    const template = createTemplate();
    const patch = normalizeIntentExecutionSlotPatch(
      {
        version: 1,
        slots: [
          {
            slotUid: 'plan_step_1',
            code: [
              "test('slot fill', async ({ page }) => {",
              "  await test.step('Step 1: 提交创建商机', async () => {",
              '    // SLOT_START: plan_step_1',
              "    const createResp = __e2e.waitForApiResponse(page, { urlIncludes: '/business', method: 'POST' });",
              '    await submitButton.click();',
              "    artifacts['plan_step_1'] = await createResp;",
              "    shared.businessId = 'BIZ-001';",
              '    // SLOT_END: plan_step_1',
              '  });',
              '});',
            ].join('\n'),
          },
          {
            slotUid: 'plan_step_2',
            code: [
              '// 模型偶尔会先输出一步说明，再包一层 test.step',
              "await test.step('Step 2: 列表校验', async () => {",
              "  const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.businessId, '新入库'] });",
              "  await expect(targetRow).toContainText(shared.businessId);",
              '});',
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
      },
      ['plan_step_1', 'plan_step_2', 'verification']
    );

    expect(patch.slots[0]?.code).toContain("const createResp = __e2e.waitForApiResponse(page, { urlIncludes: '/business', method: 'POST' });");
    expect(patch.slots[0]?.code).not.toContain('SLOT_START');
    expect(patch.slots[0]?.code).not.toContain('test(');
    expect(patch.slots[1]?.code).toContain("__e2e.findAntdTableRow(page, { hasTexts: [shared.businessId, '新入库'] })");
    expect(patch.slots[1]?.code).not.toContain('test.step');
    expect(patch.slots[2]?.code).toBe([
      "expect(shared.businessId).toBe('BIZ-001');",
      "await expect.poll(() => page.url()).toContain('#/business/businesslist');",
    ].join('\n'));

    const nextCode = applyIntentExecutionSlotPatch(template.code, patch);
    expect(nextCode).toContain("artifacts['plan_step_1'] = await createResp;");
    expect(nextCode).toContain("const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.businessId, '新入库'] });");
  });

  it('relaxes over-strict business list/detail hash regex matchers in slot code', () => {
    const template = createTemplate();
    const patch = normalizeIntentExecutionSlotPatch(
      {
        version: 1,
        slots: [
          {
            slotUid: 'plan_step_1',
            code: 'await submitButton.click();',
          },
          {
            slotUid: 'plan_step_2',
            code: "await expect(page.url()).toMatch(/#\\/business\\/(businesslist|detail)\\//i);",
          },
          {
            slotUid: 'verification',
            code: "await expect(page).toHaveURL(/#\\/business\\/(businesslist|detail)\\//i);",
          },
        ],
      },
      ['plan_step_1', 'plan_step_2', 'verification']
    );

    expect(patch.slots[1]?.code).toBe("await expect(page.url()).toMatch(/#\\/business\\/(businesslist|detail)(\\/|$)/i);");
    expect(patch.slots[2]?.code).toBe("await expect(page).toHaveURL(/#\\/business\\/(businesslist|detail)(\\/|$)/i);");

    const nextCode = applyIntentExecutionSlotPatch(template.code, patch);
    expect(nextCode).toContain("/#\\/business\\/(businesslist|detail)(\\/|$)/i");
    expect(nextCode).not.toContain("/#\\/business\\/(businesslist|detail)\\//i");
  });

  it('trims trailing plain slot markers and next-step wrappers when a slot patch spills into later slots', () => {
    const patch = normalizeIntentExecutionSlotPatch(
      {
        version: 1,
        slots: [
          {
            slotUid: 'plan_step_1',
            code: [
              "const createResp = __e2e.waitForApiResponse(page, { urlIncludes: '/business', method: 'POST' });",
              'await submitButton.click();',
              "artifacts['plan_step_1'] = await createResp;",
              "shared.businessId = 'BIZ-001';",
              'SLOT_START: plan_step_2',
              "await test.step('Step 2: 列表校验', async () => {",
              "  const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.businessId, '新入库'] });",
              "  await expect(targetRow).toContainText(shared.businessId);",
              '});',
              'SLOT_END: plan_step_2',
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
            code: "expect(shared.businessId).toBe('BIZ-001');",
          },
        ],
      },
      ['plan_step_1', 'plan_step_2', 'verification']
    );

    expect(patch.slots[0]?.code).toBe(
      [
        "const createResp = __e2e.waitForApiResponse(page, { urlIncludes: '/business', method: 'POST' });",
        'await submitButton.click();',
        "artifacts['plan_step_1'] = await createResp;",
        "shared.businessId = 'BIZ-001';",
      ].join('\n')
    );
    expect(patch.slots[0]?.code).not.toContain('SLOT_START: plan_step_2');
    expect(patch.slots[0]?.code).not.toContain('test.step');
  });

  it('builds and normalizes repair-specific patch outputs', () => {
    const schema = buildIntentExecutionRepairPatchSchema({
      targetSlotUids: ['plan_step_2'],
      planStepUids: ['plan_step_2'],
      checkUids: ['verify_success_2'],
      recipeSlugs: ['business.create'],
    });

    expect(schema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['version', 'patchedPlan', 'patchedVerifier', 'patchedRecipeSelection', 'slots'],
    });
    expect((schema as any).properties.patchedPlan.properties.planStepUids.uniqueItems).toBeUndefined();
    expect((schema as any).properties.patchedVerifier.properties.checkUids.uniqueItems).toBeUndefined();
    expect((schema as any).properties.patchedRecipeSelection.properties.recipeSlugs.uniqueItems).toBeUndefined();

    const repairPatch = normalizeIntentExecutionRepairPatch(
      {
        version: 1,
        patchedPlan: {
          planStepUids: ['plan_step_2'],
        },
        patchedVerifier: {
          checkUids: ['verify_success_2'],
        },
        patchedRecipeSelection: {
          recipeSlugs: ['business.create'],
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
      },
      {
        targetSlotUids: ['plan_step_2'],
        planStepUids: ['plan_step_2'],
        checkUids: ['verify_success_2'],
        recipeSlugs: ['business.create'],
      }
    );

    expect(repairPatch).toEqual({
      version: 1,
      patchedPlan: {
        planStepUids: ['plan_step_2'],
      },
      patchedVerifier: {
        checkUids: ['verify_success_2'],
      },
      patchedRecipeSelection: {
        recipeSlugs: ['business.create'],
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
    });
  });
});
