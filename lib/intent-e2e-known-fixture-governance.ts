import { createHash } from 'node:crypto';
import type { IntentE2ERunRequest } from '@/lib/ai/intent-e2e-service';
import {
  buildIntentE2EProjectFixtureOwnerRef,
  hasIntentE2EFixtureContract,
  mergeIntentE2ERuntimeGovernance,
  type IntentE2ERuntimeGovernance,
} from '@/lib/intent-e2e-runtime-governance';
import {
  resolveIntentE2EPriorityScenarioFamilyRoute,
  type IntentE2EPriorityScenarioFamilyRoute,
} from '@/lib/intent-e2e-priority-scenario-family';
import { normalizeIntentProjectUid } from '@/lib/intent-project-knowledge';

export const INTENT_E2E_KNOWN_FIXTURE_GOVERNANCE_VERSION = 1;

export interface IntentE2EKnownFixtureGovernanceResolution {
  applied: boolean;
  reason: string;
  fixtureFamily: '' | 'business_create_list_verify' | 'business_to_order' | 'modal_or_drawer_save';
  runtimeGovernance?: IntentE2ERuntimeGovernance;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildShortFingerprint(values: string[]): string {
  return createHash('sha1')
    .update(values.map((item) => normalizeString(item)).join('\n'))
    .digest('hex')
    .slice(0, 10);
}

function resolveRequestText(request: Pick<IntentE2ERunRequest, 'input' | 'targetUrl' | 'prefilledScenarioCard'>): string {
  const scenarioCard = request.prefilledScenarioCard;
  return [
    request.input,
    request.targetUrl,
    typeof scenarioCard?.title === 'string' ? scenarioCard.title : '',
    typeof scenarioCard?.featureDescription === 'string' ? scenarioCard.featureDescription : '',
    ...(Array.isArray(scenarioCard?.visualAnchors) ? scenarioCard.visualAnchors : []),
  ]
    .map(normalizeString)
    .filter(Boolean)
    .join('\n');
}

function resolvePriorityScenarioFamilyRoute(input: {
  request: Pick<IntentE2ERunRequest, 'input' | 'targetUrl' | 'prefilledScenarioCard'>;
  priorityScenarioFamilyRoute?: IntentE2EPriorityScenarioFamilyRoute | null;
}): IntentE2EPriorityScenarioFamilyRoute {
  if (input.priorityScenarioFamilyRoute) return input.priorityScenarioFamilyRoute;

  return resolveIntentE2EPriorityScenarioFamilyRoute({
    requestInput: normalizeString(input.request.input),
    targetUrl: normalizeString(input.request.targetUrl),
    scenarioCard: input.request.prefilledScenarioCard || null,
    description:
      typeof input.request.prefilledScenarioCard?.featureDescription === 'string'
        ? input.request.prefilledScenarioCard.featureDescription
        : normalizeString(input.request.input),
    visualAnchors: input.request.prefilledScenarioCard?.visualAnchors,
  });
}

function isServiceCommissionModalOrDrawerSave(input: {
  projectUid: string;
  targetUrl: string;
  requestText: string;
  priorityScenarioFamilyRoute: IntentE2EPriorityScenarioFamilyRoute;
}): boolean {
  if (input.projectUid !== 'proj_default') return false;
  if (input.priorityScenarioFamilyRoute.family !== 'modal_or_drawer_save') return false;
  if (!/\/commission\/subcommissionconfig/i.test(input.targetUrl)) return false;

  return /(服务分佣配置|分佣配置|佣金比例|商机创建人|subcommissionconfig)/i.test(input.requestText);
}

function isBusinessCreateListVerify(input: {
  projectUid: string;
  targetUrl: string;
  requestText: string;
  priorityScenarioFamilyRoute: IntentE2EPriorityScenarioFamilyRoute;
}): boolean {
  if (input.projectUid !== 'proj_default') return false;
  if (input.priorityScenarioFamilyRoute.family !== 'business_create_list_verify') return false;
  if (!/\/business\/(businesslist|createbusiness)/i.test(input.targetUrl)) return false;

  return /(新建商机|创建商机|商机列表|我创建的|新入库|businesslist|createbusiness|商机222)/i.test(input.requestText);
}

function isBusinessToOrder(input: {
  projectUid: string;
  targetUrl: string;
  requestText: string;
  priorityScenarioFamilyRoute: IntentE2EPriorityScenarioFamilyRoute;
}): boolean {
  if (input.projectUid !== 'proj_default') return false;
  if (input.priorityScenarioFamilyRoute.family !== 'business_to_order') return false;
  if (!/\/business\/(businesslist|createbusiness)/i.test(input.targetUrl)) return false;

  return /(生成订单|商机转订单|转订单|createOrder|确定订单信息|订单信息)/i.test(input.requestText);
}

function buildKnownFixtureGovernance(input: {
  projectUid: string;
  moduleUid?: string;
  requestInput: string;
  targetUrl: string;
  fixtureFamily: 'business_create_list_verify' | 'business_to_order' | 'modal_or_drawer_save';
  actorUserUid?: string;
  runtimeGovernance?: IntentE2ERuntimeGovernance;
}): IntentE2ERuntimeGovernance {
  const fingerprint = buildShortFingerprint([
    input.projectUid,
    normalizeString(input.moduleUid),
    normalizeString(input.requestInput),
    input.targetUrl,
    input.fixtureFamily,
  ]);

  return {
    environmentProfile: input.runtimeGovernance?.environmentProfile || 'test',
    fixture: {
      strategy: 'setup_cleanup',
      setupRef: `fixture://project/${input.projectUid}/${input.fixtureFamily}/setup`,
      cleanupRef: `fixture://project/${input.projectUid}/${input.fixtureFamily}/cleanup`,
      owner: buildIntentE2EProjectFixtureOwnerRef(input.projectUid, input.actorUserUid),
      idempotencyKey: `new-intent.${input.projectUid}.${input.fixtureFamily}.${fingerprint}`,
    },
  };
}

export function resolveIntentE2EKnownFixtureGovernance(input: {
  request: Pick<
    IntentE2ERunRequest,
    'input' | 'targetUrl' | 'projectUid' | 'moduleUid' | 'runtimeGovernance' | 'prefilledScenarioCard'
  >;
  actorUserUid?: string;
  priorityScenarioFamilyRoute?: IntentE2EPriorityScenarioFamilyRoute | null;
}): IntentE2EKnownFixtureGovernanceResolution {
  if (hasIntentE2EFixtureContract(input.request.runtimeGovernance?.fixture)) {
    return {
      applied: false,
      reason: 'request_fixture_contract_present',
      fixtureFamily: '',
      runtimeGovernance: input.request.runtimeGovernance,
    };
  }

  const projectUid = normalizeIntentProjectUid(input.request.projectUid || '');
  const targetUrl = normalizeString(input.request.targetUrl);
  const requestText = resolveRequestText(input.request);
  const priorityScenarioFamilyRoute = resolvePriorityScenarioFamilyRoute({
    request: input.request,
    priorityScenarioFamilyRoute: input.priorityScenarioFamilyRoute,
  });

  const fixtureFamily = isServiceCommissionModalOrDrawerSave({
    projectUid,
    targetUrl,
    requestText,
    priorityScenarioFamilyRoute,
  })
    ? 'modal_or_drawer_save'
    : isBusinessToOrder({
        projectUid,
        targetUrl,
        requestText,
        priorityScenarioFamilyRoute,
      })
      ? 'business_to_order'
    : isBusinessCreateListVerify({
        projectUid,
        targetUrl,
        requestText,
        priorityScenarioFamilyRoute,
      })
      ? 'business_create_list_verify'
      : '';

  if (!fixtureFamily) {
    return {
      applied: false,
      reason: 'no_known_fixture_match',
      fixtureFamily: '',
      runtimeGovernance: input.request.runtimeGovernance,
    };
  }

  const fixtureGovernance = buildKnownFixtureGovernance({
    projectUid,
    moduleUid: input.request.moduleUid,
    requestInput: input.request.input,
    targetUrl,
    fixtureFamily,
    actorUserUid: input.actorUserUid,
    runtimeGovernance: input.request.runtimeGovernance,
  });

  return {
    applied: true,
    reason:
      fixtureFamily === 'modal_or_drawer_save'
        ? 'known_fixture_service_commission_modal_or_drawer_save'
        : fixtureFamily === 'business_to_order'
          ? 'known_fixture_business_to_order'
        : 'known_fixture_business_create_list_verify',
    fixtureFamily,
    runtimeGovernance: mergeIntentE2ERuntimeGovernance(input.request.runtimeGovernance, fixtureGovernance),
  };
}

export function applyIntentE2EKnownFixtureGovernance<T extends IntentE2ERunRequest>(
  request: T,
  actorUserUid?: string,
  priorityScenarioFamilyRoute?: IntentE2EPriorityScenarioFamilyRoute | null
): T {
  const resolved = resolveIntentE2EKnownFixtureGovernance({
    request,
    actorUserUid,
    priorityScenarioFamilyRoute,
  });

  if (!resolved.applied) return request;

  return {
    ...request,
    runtimeGovernance: resolved.runtimeGovernance,
  };
}
