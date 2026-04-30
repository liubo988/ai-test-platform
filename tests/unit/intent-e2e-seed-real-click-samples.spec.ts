import { describe, expect, it } from 'vitest';
import {
  CURRENT_SYSTEM_ALLOWED_HOSTS,
  buildSamplePlan,
  buildSeedDraftSemanticSignature,
  buildSeedDraftSemanticSignatures,
  collectSeedSampleScopeUrls,
  validateCurrentSystemSeedSamples,
} from '../../scripts/intent-e2e-seed-real-click-samples.mjs';

describe('intent e2e real-click seeding scope guard', () => {
  it('accepts current-system yikaiye sample urls across request and scenario card fields', () => {
    const sample = {
      sampleId: 'manual-batch-add-contacts-guard',
      request: {
        targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
        prefilledScenarioCard: {
          targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
          flowDefinition: {
            entryUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
            steps: [
              { target: 'https://uat-service.yikaiye.com/#/business/businesslist' },
              { target: 'https://uat-service.yikaiye.com/#/mails/mailslist' },
            ],
          },
        },
      },
    };

    expect(collectSeedSampleScopeUrls(sample)).toEqual([
      'https://uat-service.yikaiye.com/#/business/businesslist',
      'https://uat-service.yikaiye.com/#/mails/mailslist',
    ]);

    expect(validateCurrentSystemSeedSamples([sample])).toEqual({
      scope: 'yikaiye_uat',
      allowedHosts: CURRENT_SYSTEM_ALLOWED_HOSTS,
      sampleCount: 1,
    });
  });

  it('rejects out-of-scope cross-system hosts before any draft can be created', () => {
    const offScopeSample = {
      sampleId: 'offscope-docs',
      request: {
        targetUrl: 'https://docs.qq.com/doc/edit',
        prefilledScenarioCard: {
          targetUrl: 'https://docs.qq.com/doc/edit',
          flowDefinition: {
            entryUrl: 'https://docs.qq.com/doc/edit',
            steps: [{ target: 'https://docs.qq.com/doc/edit' }],
          },
        },
      },
    };

    expect(() => validateCurrentSystemSeedSamples([offScopeSample])).toThrow(
      /out-of-scope host docs\.qq\.com/i
    );
  });

  it('treats title-only round suffixes as duplicates when semantic content is unchanged', () => {
    const first = buildSeedDraftSemanticSignature({
      moduleUid: 'mod_1773303139537_c84d8476',
      input:
        '参考《管帮手PC端操作手册》，进入商机列表随机勾选一条带手机号的商机，点击“批量加入通讯录”，再到我的通讯录按该手机号搜索确认联系人可见；如果当前结果为空，先切到有数量的商机进展阶段。',
      targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
    });
    const second = buildSeedDraftSemanticSignature({
      moduleUid: 'mod_1773303139537_c84d8476',
      input:
        ' 参考《管帮手PC端操作手册》，进入商机列表随机勾选一条带手机号的商机，点击“批量加入通讯录”，再到我的通讯录按该手机号搜索确认联系人可见；如果当前结果为空，先切到有数量的商机进展阶段。 ',
      targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
    });

    expect(first).toBe(second);
  });

  it('keeps the built-in mixed sample pack semantically unique within the current system', async () => {
    const samples = await buildSamplePlan({
      profile: 'mixed',
      repeat: 1,
      maxSamples: 20,
      maxSamplesExplicit: false,
    });

    const signatures = samples.map((sample) =>
      buildSeedDraftSemanticSignature({
        moduleUid: 'mod_1773303139537_c84d8476',
        input: sample.request.input,
        targetUrl: sample.request.targetUrl,
      })
    );

    expect(samples.map((sample) => sample.draftTaskName)).toEqual([
      '[AI测试样本] 手册批量加入通讯录验收',
      '[AI测试样本] 商机转订单主链路',
      '[AI测试样本] 新建商机后列表验收',
      '[AI测试样本] 订单列表详情校验',
    ]);
    expect(new Set(signatures).size).toBe(samples.length);
  });

  it('builds a dedicated with_image sample pack that exercises the AI generate attachment path', async () => {
    const samples = await buildSamplePlan({
      profile: 'with_image',
      repeat: 1,
      maxSamples: 20,
      maxSamplesExplicit: false,
    });

    expect(samples.map((sample) => sample.draftTaskName)).toEqual([
      '[AI测试样本] 图片辅助手册批量加入通讯录验收',
    ]);
    expect(validateCurrentSystemSeedSamples(samples)).toEqual({
      scope: 'yikaiye_uat',
      allowedHosts: CURRENT_SYSTEM_ALLOWED_HOSTS,
      sampleCount: 1,
    });
    expect(samples[0].request.attachments).toHaveLength(1);
    expect(samples[0].request.attachments[0]).toEqual(
      expect.objectContaining({
        name: 'business-list-batch-add-contacts-reference.png',
        dataUrl: expect.stringMatching(/^data:image\/png;base64,/),
      })
    );
    expect(samples[0].request.llmConfig).toEqual(
      expect.objectContaining({
        visionEnabled: true,
      })
    );
    expect(samples[0].request.input).toContain('附件截图');
    expect(samples[0].request.input).toContain('不要等待 toast 作为必经断言');
  });

  it('treats legacy built-in variant prompts as aliases of the same canonical sample', async () => {
    const samples = await buildSamplePlan({
      profile: 'mixed',
      repeat: 1,
      maxSamples: 20,
      maxSamplesExplicit: false,
    });
    const businessToOrderSample = samples.find((sample) => sample.sampleId === 'business-to-order');

    expect(businessToOrderSample).toBeTruthy();
    expect(
      buildSeedDraftSemanticSignatures({
        moduleUid: 'mod_1773303139537_c84d8476',
        input: businessToOrderSample.request.input,
        targetUrl: businessToOrderSample.request.targetUrl,
        signatureAliases: businessToOrderSample.signatureAliases,
      })
    ).toContain(
      buildSeedDraftSemanticSignature({
        moduleUid: 'mod_1773303139537_c84d8476',
        input:
          '登录后台后在商机列表创建商机并生成订单：先填写最小必填商机信息并保存，再用唯一手机号定位目标商机，从目标行点“生成订单”，在“确定订单信息”Drawer 确认，并以 createOrder 成功响应和 Drawer 关闭作为主断言。',
        targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
      })
    );
  });
});
