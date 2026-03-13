import {
  archiveTestConfig,
  createTestConfig,
  getProjectByUid,
  getProjectCapabilityByUid,
  getTestConfigByUid,
  listModulesByProject,
  listProjectCapabilities,
  upsertProjectCapability,
  type ProjectCapabilityRecord,
  type TestConfigRecord,
} from '@/lib/db/repository';
import {
  buildCapabilityVerificationChainMarker,
  buildCapabilityVerificationMarker,
  buildExecutionVerifiedCapabilityMeta,
  buildVerificationAttemptMeta,
  parseCapabilityVerificationChainMarker,
  parseCapabilityVerificationMarker,
} from '@/lib/capability-verification';
import { getIntentCapabilityFlowDefinition } from '@/lib/intent-capability-preset';
import { createScenarioStep, type FlowDefinition, type ScenarioStepType } from '@/lib/task-flow';

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function collectVariableNames(values: string[]): string[] {
  return uniq(
    values.flatMap((item) =>
      item
        .split(/[,\n]/)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function clampText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function capabilityStepType(
  capabilityType: ProjectCapabilityRecord['capabilityType']
): ScenarioStepType {
  switch (capabilityType) {
    case 'query':
      return 'extract';
    case 'assertion':
      return 'assert';
    default:
      return 'ui';
  }
}

function summarizeAssertions(capability: ProjectCapabilityRecord): string {
  const assertions = uniq(capability.assertions).slice(0, 3);
  if (assertions.length > 0) {
    return assertions.join('；');
  }
  return capability.name.trim();
}

function inferExtractVariableName(capability: ProjectCapabilityRecord, expectedResult: string): string {
  const haystack = `${capability.name}\n${capability.steps.join('\n')}\n${expectedResult}`.toLowerCase();
  if (haystack.includes('商机id') || haystack.includes('businessid') || haystack.includes('business id')) {
    return 'businessId';
  }
  if (haystack.includes('订单id') || haystack.includes('orderid') || haystack.includes('order id')) {
    return 'orderId';
  }
  if (haystack.includes('企业名称') || haystack.includes('company')) {
    return 'companyName';
  }
  if (haystack.includes('手机号') || haystack.includes('电话') || haystack.includes('phone')) {
    return 'contactPhone';
  }
  return '';
}

function getCapabilitySourceFlow(capability: ProjectCapabilityRecord): FlowDefinition | null {
  if (capability.capabilityType !== 'composite') return null;
  return getIntentCapabilityFlowDefinition(capability.meta, capability.entryUrl);
}

function collectCapabilityVerificationChain(input: {
  capability: ProjectCapabilityRecord;
  capabilities: ProjectCapabilityRecord[];
}): ProjectCapabilityRecord[] {
  const capabilityIndex = new Map(input.capabilities.map((item) => [item.slug, item]));
  const ordered: ProjectCapabilityRecord[] = [];
  const selected = new Set<string>();
  const visiting = new Set<string>();

  const appendCapability = (capability: ProjectCapabilityRecord) => {
    if (selected.has(capability.slug) || visiting.has(capability.slug)) return;
    visiting.add(capability.slug);
    for (const dependencySlug of capability.dependsOn) {
      const dependency = capabilityIndex.get(dependencySlug);
      if (!dependency || dependency.status !== 'active') continue;
      appendCapability(dependency);
    }
    visiting.delete(capability.slug);
    selected.add(capability.slug);
    ordered.push(capability);
  };

  appendCapability(input.capability);
  return ordered;
}

function buildCapabilityVerificationFlow(input: {
  orderedCapabilities: ProjectCapabilityRecord[];
  capability: ProjectCapabilityRecord;
  projectLoginUrl: string;
}): FlowDefinition {
  const steps = input.orderedCapabilities.flatMap((capability) => {
    const preservedFlow = getCapabilitySourceFlow(capability);
    if (preservedFlow?.steps.length) {
      return preservedFlow.steps.map((step, index) =>
        createScenarioStep({
          stepUid: step.stepUid || `${capability.capabilityUid}_step_${index + 1}`,
          stepType: step.stepType,
          title: step.title || clampText(`${capability.name} ${index + 1}`, 48),
          target: step.target.trim() || preservedFlow.entryUrl.trim() || capability.entryUrl.trim() || input.projectLoginUrl.trim(),
          instruction: step.instruction.trim() || capability.description.trim() || capability.name.trim(),
          expectedResult: step.expectedResult.trim() || summarizeAssertions(capability),
          extractVariable: step.extractVariable.trim(),
        })
      );
    }

    const expectedResult = summarizeAssertions(capability);
    return [
      createScenarioStep({
        stepType: capabilityStepType(capability.capabilityType),
        title: clampText(capability.name, 48),
        target: capability.entryUrl.trim() || input.projectLoginUrl.trim(),
        instruction: uniq(capability.steps).join('；').trim() || capability.description.trim() || capability.name.trim(),
        expectedResult,
        extractVariable:
          capability.capabilityType === 'query'
            ? inferExtractVariableName(capability, expectedResult)
            : '',
      }),
    ];
  });

  const sharedVariables = collectVariableNames(
    input.orderedCapabilities.flatMap((item) => {
      const preservedFlow = getCapabilitySourceFlow(item);
      if (!preservedFlow) return [];
      return [
        ...preservedFlow.sharedVariables,
        ...preservedFlow.steps.map((step) => step.extractVariable),
      ];
    }).concat(steps.map((step) => step.extractVariable)).filter(Boolean)
  );
  const capabilityEntryUrls = input.orderedCapabilities.map((item) => ({
    capabilityType: item.capabilityType,
    entryUrl: getCapabilitySourceFlow(item)?.entryUrl.trim() || item.entryUrl.trim(),
  }));
  const entryUrl =
    capabilityEntryUrls.find((item) => item.capabilityType !== 'auth' && item.entryUrl)?.entryUrl ||
    capabilityEntryUrls.find((item) => item.entryUrl)?.entryUrl ||
    input.capability.entryUrl.trim() ||
    input.projectLoginUrl.trim();
  const expectedOutcome = uniq(
    input.orderedCapabilities.flatMap((item) => {
      const preservedFlow = getCapabilitySourceFlow(item);
      return [preservedFlow?.expectedOutcome || '', ...item.assertions];
    }).filter(Boolean)
  ).slice(0, 4).join('；');
  const cleanupNotes = uniq(
    input.orderedCapabilities.flatMap((item) => {
      const preservedFlow = getCapabilitySourceFlow(item);
      return [preservedFlow?.cleanupNotes || '', item.cleanupNotes];
    }).filter(Boolean)
  ).join('\n');

  return {
    version: 1,
    entryUrl,
    sharedVariables,
    expectedOutcome,
    cleanupNotes,
    steps,
  };
}

function buildCapabilityVerificationDescription(
  capability: ProjectCapabilityRecord,
  flow: FlowDefinition,
  orderedCapabilities: ProjectCapabilityRecord[]
): string {
  return [
    buildCapabilityVerificationMarker(capability.capabilityUid),
    buildCapabilityVerificationChainMarker(orderedCapabilities.map((item) => item.capabilityUid)),
    `验证目标：${capability.name}`,
    `能力标识：${capability.slug}`,
    `能力类型：${capability.capabilityType}`,
    orderedCapabilities.length > 1 ? `验证链路：${orderedCapabilities.map((item) => item.name).join(' -> ')}` : '',
    flow.expectedOutcome ? `关键断言：${flow.expectedOutcome}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function toCapabilityInput(
  capability: ProjectCapabilityRecord,
  meta: Record<string, unknown>
): Parameters<typeof upsertProjectCapability>[1] {
  return {
    slug: capability.slug,
    name: capability.name,
    description: capability.description,
    capabilityType: capability.capabilityType,
    entryUrl: capability.entryUrl,
    triggerPhrases: capability.triggerPhrases,
    preconditions: capability.preconditions,
    steps: capability.steps,
    assertions: capability.assertions,
    cleanupNotes: capability.cleanupNotes,
    dependsOn: capability.dependsOn,
    sortOrder: capability.sortOrder,
    status: capability.status,
    sourceDocumentUid: capability.sourceDocumentUid,
    meta,
  };
}

export async function createCapabilityVerificationConfig(input: {
  projectUid: string;
  capabilityUid: string;
  moduleUid?: string;
  actorLabel?: string;
}): Promise<{ config: TestConfigRecord; capability: ProjectCapabilityRecord }> {
  const capability = await getProjectCapabilityByUid(input.capabilityUid);
  if (!capability || capability.projectUid !== input.projectUid) {
    throw new Error('能力不存在');
  }
  if (capability.status !== 'active') {
    throw new Error('请先恢复该能力，再发起验证');
  }

  const project = await getProjectByUid(input.projectUid);
  if (!project) {
    throw new Error('项目不存在');
  }

  const moduleUid =
    input.moduleUid?.trim() ||
    (await listModulesByProject(input.projectUid)).find((item) => item.status === 'active')?.moduleUid ||
    '';
  if (!moduleUid) {
    throw new Error('当前项目没有可用模块，无法创建验证任务');
  }

  const capabilities = await listProjectCapabilities(input.projectUid, { status: 'active' });
  const orderedCapabilities = collectCapabilityVerificationChain({
    capability,
    capabilities,
  });
  const flow = buildCapabilityVerificationFlow({
    orderedCapabilities,
    capability,
    projectLoginUrl: project.loginUrl || '',
  });

  if (!flow.entryUrl.trim()) {
    throw new Error('能力缺少可执行入口地址，请先补充入口 URL 或导航依赖后再验证');
  }

  const config = await createTestConfig(
    {
      projectUid: input.projectUid,
      moduleUid,
      sortOrder: 999,
      name: clampText(`验证能力：${capability.name}`, 60),
      targetUrl: flow.entryUrl,
      featureDescription: buildCapabilityVerificationDescription(capability, flow, orderedCapabilities),
      taskMode: 'scenario',
      flowDefinition: flow,
    },
    { actorLabel: input.actorLabel || '能力验证' }
  );

  return { config, capability };
}

export async function finalizeCapabilityVerification(input: {
  configUid: string;
  planUid: string;
  executionUid: string;
  status: 'passed' | 'failed';
  actorLabel?: string;
}): Promise<void> {
  const config = await getTestConfigByUid(input.configUid);
  if (!config) return;

  const capabilityUid = parseCapabilityVerificationMarker(config.featureDescription || '');
  const chainCapabilityUids = parseCapabilityVerificationChainMarker(config.featureDescription || '');
  if (!capabilityUid) return;

  const capability = await getProjectCapabilityByUid(capabilityUid);
  if (!capability || capability.projectUid !== config.projectUid) {
    await archiveTestConfig(config.configUid, { actorLabel: input.actorLabel || '能力验证' }).catch(() => {});
    return;
  }

  const checkedAt = new Date().toISOString();
  const attemptMeta = buildVerificationAttemptMeta(capability.meta, {
    executionUid: input.executionUid,
    status: input.status,
    checkedAt,
  });
  const nextMeta =
    input.status === 'passed'
      ? buildExecutionVerifiedCapabilityMeta(attemptMeta, {
          planUid: input.planUid,
          executionUid: input.executionUid,
          verifiedAt: checkedAt,
        })
      : attemptMeta;

  await upsertProjectCapability(
    capability.projectUid,
    toCapabilityInput(capability, nextMeta),
    { actorLabel: input.actorLabel || '能力验证' }
  );

  if (input.status === 'passed' && chainCapabilityUids.length > 1) {
    const chainCapabilities = await Promise.all(chainCapabilityUids.map((item) => getProjectCapabilityByUid(item)));
    for (const chainCapability of chainCapabilities) {
      if (!chainCapability || chainCapability.projectUid !== config.projectUid || chainCapability.capabilityUid === capability.capabilityUid) {
        continue;
      }
      const chainMeta = buildExecutionVerifiedCapabilityMeta(chainCapability.meta, {
        planUid: input.planUid,
        executionUid: input.executionUid,
        verifiedAt: checkedAt,
      });
      await upsertProjectCapability(
        chainCapability.projectUid,
        toCapabilityInput(chainCapability, chainMeta),
        { actorLabel: input.actorLabel || '能力验证' }
      );
    }
  }

  await archiveTestConfig(config.configUid, { actorLabel: input.actorLabel || '能力验证' }).catch(() => {});
}
