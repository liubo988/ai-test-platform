import { describe, expect, it } from 'vitest';
import {
  buildIntentE2EPriorityTrafficTriageReport,
  renderIntentE2EPriorityTrafficTriageMarkdown,
} from '@/lib/intent-e2e-priority-traffic-triage';
import type {
  IntentE2ETrafficQualityEvent,
  IntentE2ETrafficQualityPriorityFamilyGovernance,
  IntentE2ETrafficQualityReport,
} from '@/lib/intent-e2e-traffic-quality';

const NOW = new Date('2026-05-09T10:00:00.000Z');

function event(overrides: Partial<IntentE2ETrafficQualityEvent>): IntentE2ETrafficQualityEvent {
  return {
    version: 1,
    eventId: 'evt_default',
    occurredAt: '2026-05-09T09:00:00.000Z',
    counter: 'launch_click_count',
    source: 'real_click',
    attachment: 'without_image',
    launchDecision: 'auto_run',
    priorityScenarioFamily: 'untracked',
    projectUid: 'proj_default',
    moduleUid: 'mod_1',
    runId: '',
    intentDraftUid: '',
    requestFingerprint: 'fp',
    metadata: {
      input: '打开项目知识文档工作台，在知识目录中打开知识文档并搜索文档块正文锚点',
      targetUrl: 'http://127.0.0.1:3666/projects/proj_default?intentView=knowledge',
    },
    ...overrides,
  };
}

function businessToOrderGovernance(): IntentE2ETrafficQualityPriorityFamilyGovernance[] {
  return [
    {
      family: 'business_to_order',
      governanceStatus: 'ready',
      releaseGuardStatus: 'passed',
      knowledgeHitStatus: 'passed',
      evidencePaths: ['artifacts/business-to-order.json'],
    },
  ];
}

describe('buildIntentE2EPriorityTrafficTriageReport', () => {
  it('splits untracked document-like and reroutable priority traffic from actionable unknowns', () => {
    const report = buildIntentE2EPriorityTrafficTriageReport({
      projectUid: 'proj_default',
      now: NOW,
      windowDaysList: [30],
      priorityFamilyGovernance: businessToOrderGovernance(),
      events: [
        event({ eventId: 'evt_doc' }),
        event({
          eventId: 'evt_legacy_batch',
          metadata: {
            input:
              '进入商机列表随机勾选一条带手机号的商机，点击“批量加入通讯录”，再到我的通讯录按手机号搜索确认联系人可见。',
            targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
          },
        }),
        event({
          eventId: 'evt_bto_launch',
          priorityScenarioFamily: 'business_to_order',
          metadata: {
            input: '进入商机详情生成订单并校验订单号可见',
            targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
          },
        }),
        event({
          eventId: 'evt_bto_terminal',
          counter: 'terminal_run_count',
          priorityScenarioFamily: 'business_to_order',
        }),
        event({
          eventId: 'evt_bto_pass',
          counter: 'terminal_pass_count',
          priorityScenarioFamily: 'business_to_order',
        }),
      ],
    });

    const window = report.windows[0];
    expect(window?.untracked.documentLikeLaunchClickCount).toBe(1);
    expect(window?.untracked.reroutablePriorityLaunchClickCount).toBe(1);
    expect(window?.untracked.unknownBusinessLaunchClickCount).toBe(0);
    expect(window?.untracked.segments.find((segment) => segment.classification === 'document_like')?.documentFamilies).toEqual({
      doc_search_open_verify: 1,
    });
    expect(
      window?.untracked.segments.find((segment) => segment.classification === 'reroutable_priority_family')
        ?.reroutedPriorityFamilies
    ).toEqual({
      business_batch_add_contacts_verify: 1,
    });
    expect(window?.businessToOrder.terminalPassRate).toBe(100);
    expect(window?.businessToOrder.governanceStatus).toBe('ready');
    expect(report.recommendation.status).toBe('no_actionable_priority_gap');
  });

  it('recommends triage when untracked real_click cannot be mapped to document or current priority families', () => {
    const report = buildIntentE2EPriorityTrafficTriageReport({
      projectUid: 'proj_default',
      now: NOW,
      windowDaysList: [30],
      priorityFamilyGovernance: businessToOrderGovernance(),
      events: [
        event({
          eventId: 'evt_unknown',
          metadata: {
            input: '打开运营后台校验一个新的跨模块异常提醒配置',
            targetUrl: 'https://uat-service.yikaiye.com/#/settings/unknown',
          },
        }),
      ],
    });

    expect(report.windows[0]?.untracked.unknownBusinessLaunchClickCount).toBe(1);
    expect(report.recommendation.status).toBe('triage_unknown_untracked');
    expect(renderIntentE2EPriorityTrafficTriageMarkdown(report)).toContain('unknown_business_or_product');
  });

  it('overlays business_to_order terminal counters from the latest traffic-quality report', () => {
    const trafficQualityReport = {
      window: { days: 30 },
      buckets: [
        {
          source: 'real_click',
          attachment: 'without_image',
          launchDecision: 'auto_run',
          priorityScenarioFamily: 'business_to_order',
          counters: {
            launch_click_count: 10,
            draft_generated_count: 0,
            launch_gate_passed_count: 10,
            auto_run_started_count: 10,
            terminal_run_count: 10,
            terminal_pass_count: 10,
          },
          terminalPassRate: 100,
        },
      ],
    } as unknown as IntentE2ETrafficQualityReport;
    const report = buildIntentE2EPriorityTrafficTriageReport({
      projectUid: 'proj_default',
      now: NOW,
      windowDaysList: [30],
      priorityFamilyGovernance: businessToOrderGovernance(),
      trafficQualityReport,
      events: [
        event({
          eventId: 'evt_bto_launch_only',
          priorityScenarioFamily: 'business_to_order',
          metadata: {
            input: '进入商机详情生成订单并校验订单号可见',
            targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
          },
        }),
      ],
    });

    expect(report.windows[0]?.businessToOrder.counters.terminal_run_count).toBe(10);
    expect(report.windows[0]?.businessToOrder.counters.terminal_pass_count).toBe(10);
    expect(report.windows[0]?.businessToOrder.terminalPassRate).toBe(100);
    expect(report.recommendation.status).toBe('no_actionable_priority_gap');
  });
});
