import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveIntentE2ELaunchDecision } from '@/lib/intent-e2e-launch-decision';
import {
  buildIntentE2ENewIntentReadiness,
  buildIntentE2ENewIntentReadinessReport,
  loadIntentE2ENewIntentReadinessFromTrafficQuality,
  renderIntentE2ENewIntentReadinessMarkdown,
} from '@/lib/intent-e2e-new-intent-readiness';

const readyProjectAssets = {
  status: 'ready' as const,
  projectUid: 'proj_readiness',
  reasons: [],
};

const listSearchDetailRoute = {
  family: 'list_search_detail' as const,
  textFamily: 'list_search_detail' as const,
  visualFamily: 'untracked' as const,
  source: 'text_only' as const,
  clarifySignals: [],
};

describe('intent e2e new intent readiness', () => {
  it('marks stable known-family verifier requests as direct_generate with high confidence', () => {
    const request = {
      input: '登录后用手机号 13800001111 搜索商机，进入详情并校验状态字段可见',
      targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
      projectUid: 'proj_readiness',
    };
    const launchDecision = resolveIntentE2ELaunchDecision({
      ...request,
      assetAvailability: readyProjectAssets,
      priorityScenarioFamilyRoute: listSearchDetailRoute,
    });

    const readiness = buildIntentE2ENewIntentReadiness({
      request,
      launchDecision,
      assetAvailability: readyProjectAssets,
      priorityScenarioFamilyRoute: listSearchDetailRoute,
      generatedAt: '2026-05-09T08:00:00.000Z',
    });

    expect(readiness.recommendedMode).toBe('direct_generate');
    expect(readiness.confidence).toBe('high');
    expect(readiness.missingContracts).toEqual([]);
    expect(readiness.signals.priorityScenarioFamily).toBe('list_search_detail');
    expect(readiness.signals.preferredRecipeSlugs).toEqual(
      expect.arrayContaining(['assert.antd-table-primary-key-search', 'intent.list-search-detail.primary-record'])
    );
  });

  it('keeps vague new intents in needs_clarify with explicit missing contracts', () => {
    const readiness = buildIntentE2ENewIntentReadiness({
      request: {
        input: '帮我测一下',
        projectUid: 'proj_readiness',
      },
      assetAvailability: readyProjectAssets,
      generatedAt: '2026-05-09T08:00:00.000Z',
    });

    expect(readiness.launchDecision).toBe('needs_clarify');
    expect(readiness.recommendedMode).toBe('needs_clarify');
    expect(readiness.confidence).toBe('low');
    expect(readiness.missingContracts).toEqual(
      expect.arrayContaining(['target_url', 'explicit_verifier', 'stable_family_or_document_path'])
    );
    expect(readiness.failureRecoveryPlan.map((item) => item.className)).toEqual(
      expect.arrayContaining(['weak_assertion', 'unknown_family'])
    );
  });

  it('surfaces fixture gaps for mutating requests under enforced runtime governance', () => {
    const readiness = buildIntentE2ENewIntentReadiness({
      request: {
        input: '新建商机并提交后回列表校验商机进展',
        targetUrl: 'https://uat-service.yikaiye.com/#/business/create',
        projectUid: 'proj_readiness',
        runtimeGovernance: {
          environmentProfile: 'test',
        },
      },
      assetAvailability: readyProjectAssets,
      generatedAt: '2026-05-09T08:00:00.000Z',
    });

    expect(readiness.launchDecision).toBe('needs_fixture');
    expect(readiness.recommendedMode).toBe('needs_fixture');
    expect(readiness.missingContracts).toContain('fixture_contract');
    expect(readiness.failureRecoveryPlan.map((item) => item.className)).toContain('missing_fixture');
    expect(readiness.fixtureBootstrap).toMatchObject({
      status: 'recommended',
      reason: 'missing_fixture_contract',
      strategy: 'setup_cleanup',
      owner: 'owner://project/proj_readiness/members/workspace-user',
      setupRef: 'fixture://project/proj_readiness/business_create_list_verify/setup',
      cleanupRef: 'fixture://project/proj_readiness/business_create_list_verify/cleanup',
      recommendedRuntimeGovernance: {
        environmentProfile: 'test',
        fixture: {
          strategy: 'setup_cleanup',
          owner: 'owner://project/proj_readiness/members/workspace-user',
        },
      },
    });
    expect(readiness.fixtureBootstrap?.idempotencyKey).toMatch(/^new-intent\.proj_readiness\.business_create_list_verify\.[a-f0-9]{10}$/);
    expect(readiness.fixtureBootstrap?.requiredFields.join('\n')).toContain('businessId');
  });

  it('builds modal_or_drawer_save fixture bootstrap refs for service commission intents', () => {
    const readiness = buildIntentE2ENewIntentReadiness({
      request: {
        input:
          '进入服务分佣配置页，按关键词379搜索目标服务，打开结果行“分佣配置”弹框，将“商机创建人”佣金比例修改为35%，保存后校验成功提示和弹框关闭。',
        targetUrl: 'https://uat-service.yikaiye.com/#/commission/subCommissionConfig',
        projectUid: 'proj_readiness',
        moduleUid: 'mod_commission',
        runtimeGovernance: {
          environmentProfile: 'test',
        },
      },
      assetAvailability: readyProjectAssets,
      generatedAt: '2026-05-09T08:00:00.000Z',
    });

    expect(readiness.launchDecision).toBe('needs_fixture');
    expect(readiness.recommendedMode).toBe('needs_fixture');
    expect(readiness.signals.priorityScenarioFamily).toBe('modal_or_drawer_save');
    expect(readiness.fixtureBootstrap).toMatchObject({
      strategy: 'setup_cleanup',
      owner: 'owner://project/proj_readiness/members/workspace-user',
      setupRef: 'fixture://project/proj_readiness/modal_or_drawer_save/setup',
      cleanupRef: 'fixture://project/proj_readiness/modal_or_drawer_save/cleanup',
    });
    expect(readiness.fixtureBootstrap?.idempotencyKey).toMatch(/^new-intent\.proj_readiness\.modal_or_drawer_save\.[a-f0-9]{10}$/);
    expect(readiness.fixtureBootstrap?.requiredStableIdentifiers).toEqual(
      expect.arrayContaining(['recordId', 'customerCode', 'businessId'])
    );
    expect(readiness.fixtureBootstrap?.requiredFields.join('\n')).toContain('当前可见 modal / drawer');
  });

  it('uses governed document family contracts for direct document-like generation', () => {
    const readiness = buildIntentE2ENewIntentReadiness({
      request: {
        input:
          '打开项目知识文档工作台，预览沉淀能力验证手册，点击自动沉淀能力，再到能力目录校验新生成的知识提炼稳定能力可见。',
        targetUrl: 'http://127.0.0.1:3666/projects/proj_readiness?intentView=knowledge',
        projectUid: 'proj_readiness',
      },
      assetAvailability: readyProjectAssets,
      generatedAt: '2026-05-09T08:00:00.000Z',
    });

    expect(readiness.recommendedMode).toBe('direct_generate');
    expect(readiness.confidence).toBe('high');
    expect(readiness.signals.documentFamily).toBe('doc_derive_capability_verify');
    expect(readiness.signals.documentGovernanceStatus).toBe('contract_ready');
    expect(readiness.signals.preferredRecipeSlugs).toContain('document.project-knowledge-derive-capability-preview');
  });

  it('routes unknown but verifiable requests to exploration_run instead of overstating confidence', () => {
    const readiness = buildIntentE2ENewIntentReadiness({
      request: {
        input: '进入报表中心切换高级筛选，并校验图表数值刷新成功',
        targetUrl: 'https://example.test/#/report/dashboard',
        projectUid: 'proj_readiness',
      },
      assetAvailability: readyProjectAssets,
      generatedAt: '2026-05-09T08:00:00.000Z',
    });

    expect(readiness.launchDecision).toBe('auto_run');
    expect(readiness.recommendedMode).toBe('exploration_run');
    expect(readiness.confidence).toBe('medium');
    expect(readiness.missingContracts).toEqual(expect.arrayContaining(['stable_family_or_document_path', 'recipe']));
    expect(readiness.failureRecoveryPlan.map((item) => item.className)).toContain('unknown_family');
  });

  it('renders reports and keeps real_click separated from replay traffic', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-new-readiness-'));
    const eventLogPath = path.join(tempDir, 'traffic.jsonl');
    fs.writeFileSync(
      eventLogPath,
      [
        JSON.stringify({
          version: 1,
          occurredAt: '2026-05-09T07:50:00.000Z',
          counter: 'launch_click_count',
          projectUid: 'proj_readiness',
          moduleUid: 'mod',
          source: 'real_click',
          attachment: 'without_image',
          launchDecision: 'auto_run',
          priorityScenarioFamily: 'list_search_detail',
          metadata: {
            input: '登录后用手机号 13800001111 搜索商机，进入详情并校验状态字段可见',
            targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
          },
        }),
        JSON.stringify({
          version: 1,
          occurredAt: '2026-05-09T07:55:00.000Z',
          counter: 'launch_click_count',
          projectUid: 'proj_readiness',
          moduleUid: 'mod',
          source: 'replay',
          attachment: 'without_image',
          launchDecision: 'draft_only',
          priorityScenarioFamily: 'untracked',
          metadata: {
            input: '进入报表中心切换高级筛选，并校验图表数值刷新成功',
            targetUrl: 'https://example.test/#/report/dashboard',
            replayOfRunId: 'intent-run-real',
          },
        }),
      ].join('\n'),
      'utf8'
    );

    const loaded = await loadIntentE2ENewIntentReadinessFromTrafficQuality({
      projectUid: 'proj_readiness',
      windowDays: 30,
      generatedAt: '2026-05-09T08:00:00.000Z',
      eventLogPaths: [eventLogPath],
    });
    const report = buildIntentE2ENewIntentReadinessReport({
      projectUid: 'proj_readiness',
      windowDays: 30,
      generatedAt: '2026-05-09T08:00:00.000Z',
      items: loaded.items,
      warnings: loaded.warnings,
    });
    const markdown = renderIntentE2ENewIntentReadinessMarkdown(report);

    expect(report.total).toBe(2);
    expect(report.summary.bySource).toMatchObject({
      real_click: 1,
      replay: 1,
    });
    expect(report.summary.fixtureBootstrapStrategies).toEqual({});
    expect(markdown).toContain('# Intent E2E New Intent Readiness');
    expect(markdown).toContain('source: real_click:1, replay:1');
  });

  it('uses current known fixture governance when recomputing readiness from traffic events', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-new-readiness-known-fixture-'));
    const eventLogPath = path.join(tempDir, 'traffic.jsonl');
    fs.writeFileSync(
      eventLogPath,
      JSON.stringify({
        version: 1,
        occurredAt: '2026-05-09T07:50:00.000Z',
        counter: 'launch_click_count',
        projectUid: 'proj_default',
        moduleUid: 'mod',
        source: 'real_click',
        attachment: 'without_image',
        launchDecision: 'auto_run',
        priorityScenarioFamily: 'business_create_list_verify',
        metadata: {
          input: '新建商机并提交后回到我创建的商机列表，按手机号回查并校验商机进展为新入库。',
          targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
        },
      }),
      'utf8'
    );

    const loaded = await loadIntentE2ENewIntentReadinessFromTrafficQuality({
      projectUid: 'proj_default',
      windowDays: 30,
      generatedAt: '2026-05-09T08:00:00.000Z',
      eventLogPaths: [eventLogPath],
    });

    expect(loaded.items).toHaveLength(1);
    expect(loaded.items[0]?.signals.priorityScenarioFamily).toBe('business_create_list_verify');
    expect(loaded.items[0]?.signals.hasFixtureContract).toBe(true);
    expect(loaded.items[0]?.recommendedMode).toBe('direct_generate');
    expect(loaded.items[0]?.missingContracts).not.toContain('fixture_contract');
    expect(loaded.items[0]?.fixtureBootstrap).toBeNull();
  });

  it('uses current business_to_order fixture and recipe contracts when recomputing readiness from traffic events', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-new-readiness-business-order-'));
    const eventLogPath = path.join(tempDir, 'traffic.jsonl');
    fs.writeFileSync(
      eventLogPath,
      JSON.stringify({
        version: 1,
        occurredAt: '2026-05-09T07:50:00.000Z',
        counter: 'launch_click_count',
        projectUid: 'proj_default',
        moduleUid: 'mod',
        source: 'real_click',
        attachment: 'without_image',
        launchDecision: 'auto_run',
        priorityScenarioFamily: 'business_to_order',
        metadata: {
          input:
            '登录后台后在商机列表页创建商机并生成订单：先填写最小必填商机信息并保存，回到商机列表用唯一手机号定位新建商机，从目标行操作菜单点击“生成订单”，在“确定订单信息”Drawer 中点击确定，并以 createOrder 成功响应和 Drawer 关闭作为主断言。',
          targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
        },
      }),
      'utf8'
    );

    const loaded = await loadIntentE2ENewIntentReadinessFromTrafficQuality({
      projectUid: 'proj_default',
      windowDays: 30,
      generatedAt: '2026-05-09T08:00:00.000Z',
      eventLogPaths: [eventLogPath],
    });

    expect(loaded.items).toHaveLength(1);
    expect(loaded.items[0]?.signals.priorityScenarioFamily).toBe('business_to_order');
    expect(loaded.items[0]?.signals.hasFixtureContract).toBe(true);
    expect(loaded.items[0]?.signals.preferredRecipeSlugs).toContain('business.create-to-order');
    expect(loaded.items[0]?.recommendedMode).toBe('direct_generate');
    expect(loaded.items[0]?.missingContracts).toEqual([]);
    expect(loaded.items[0]?.fixtureBootstrap).toBeNull();
  });

  it('does not surface fixture bootstrap for contract-ready document traffic even when raw priority family needs fixtures', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-new-readiness-document-'));
    const eventLogPath = path.join(tempDir, 'traffic.jsonl');
    fs.writeFileSync(
      eventLogPath,
      JSON.stringify({
        version: 1,
        occurredAt: '2026-05-09T07:50:00.000Z',
        counter: 'launch_click_count',
        projectUid: 'proj_readiness',
        moduleUid: 'mod',
        source: 'real_click',
        attachment: 'without_image',
        launchDecision: 'auto_run',
        priorityScenarioFamily: 'modal_or_drawer_save',
        metadata: {
          input:
            '打开项目知识文档工作台，编辑并保存名为“编辑保存验证手册”的已有知识文档内容，保存后校验当前预览标题、旧正文锚点不再匹配，且更新后的正文锚点在文档块预览区可见。',
          targetUrl: 'http://127.0.0.1:3666/projects/proj_readiness?intentView=knowledge',
        },
      }),
      'utf8'
    );

    const loaded = await loadIntentE2ENewIntentReadinessFromTrafficQuality({
      projectUid: 'proj_readiness',
      windowDays: 30,
      generatedAt: '2026-05-09T08:00:00.000Z',
      eventLogPaths: [eventLogPath],
    });

    expect(loaded.items).toHaveLength(1);
    expect(loaded.items[0]?.signals.documentFamily).toBe('doc_edit_save_verify');
    expect(loaded.items[0]?.signals.documentGovernanceStatus).toBe('contract_ready');
    expect(loaded.items[0]?.recommendedMode).toBe('direct_generate');
    expect(loaded.items[0]?.missingContracts).not.toContain('fixture_contract');
    expect(loaded.items[0]?.fixtureBootstrap).toBeNull();
  });
});
