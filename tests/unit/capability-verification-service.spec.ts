import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/repository', () => ({
  archiveTestConfig: vi.fn(),
  createTestConfig: vi.fn(),
  getProjectByUid: vi.fn(),
  getProjectCapabilityByUid: vi.fn(),
  getTestConfigByUid: vi.fn(),
  listModulesByProject: vi.fn(),
  listProjectCapabilities: vi.fn(),
  upsertProjectCapability: vi.fn(),
}));

import {
  createCapabilityVerificationConfig,
  finalizeCapabilityVerification,
} from '@/lib/capability-verification-service';
import {
  buildCapabilityVerificationChainMarker,
  buildCapabilityVerificationMarker,
} from '@/lib/capability-verification';
import {
  archiveTestConfig,
  createTestConfig,
  getProjectByUid,
  getProjectCapabilityByUid,
  getTestConfigByUid,
  listModulesByProject,
  listProjectCapabilities,
  upsertProjectCapability,
} from '@/lib/db/repository';

function makeCapability(input: {
  capabilityUid: string;
  slug: string;
  name: string;
  capabilityType?: 'auth' | 'navigation' | 'query' | 'composite';
  dependsOn?: string[];
  entryUrl?: string;
  meta?: unknown;
}) {
  return {
    capabilityUid: input.capabilityUid,
    projectUid: 'proj_1',
    slug: input.slug,
    name: input.name,
    description: `${input.name} 描述`,
    capabilityType: input.capabilityType || 'query',
    entryUrl: input.entryUrl || 'https://uat.example.com/#/company/easyindex',
    triggerPhrases: [input.name],
    preconditions: [],
    steps: [input.name],
    assertions: [`${input.name} 成功`],
    cleanupNotes: '',
    dependsOn: input.dependsOn || [],
    sortOrder: 10,
    status: 'active' as const,
    sourceDocumentUid: 'doc_1',
    meta: input.meta || {},
    createdAt: '2026-03-11T00:00:00.000Z',
    updatedAt: '2026-03-11T00:00:00.000Z',
  };
}

describe('capability-verification-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(archiveTestConfig).mockResolvedValue(undefined as never);
    vi.mocked(upsertProjectCapability).mockResolvedValue({} as never);
  });

  it('writes dependency-chain markers into verification configs', async () => {
    const auth = makeCapability({
      capabilityUid: 'cap_auth',
      slug: 'auth.sms-password-login',
      name: '短信密码登录',
      capabilityType: 'auth',
      dependsOn: [],
      entryUrl: 'https://uat.example.com/#/',
    });
    const navigation = makeCapability({
      capabilityUid: 'cap_nav',
      slug: 'navigation.company-easyindex',
      name: '进入搜企业页',
      capabilityType: 'navigation',
      dependsOn: ['auth.sms-password-login'],
    });
    const query = makeCapability({
      capabilityUid: 'cap_query',
      slug: 'query.company-search',
      name: '搜企业检索',
      capabilityType: 'query',
      dependsOn: ['navigation.company-easyindex'],
    });

    vi.mocked(getProjectCapabilityByUid).mockResolvedValue(query as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_1',
      loginUrl: 'https://uat.example.com/#/',
    } as never);
    vi.mocked(listModulesByProject).mockResolvedValue([{ moduleUid: 'mod_1', status: 'active' }] as never);
    vi.mocked(listProjectCapabilities).mockResolvedValue([auth, navigation, query] as never);
    vi.mocked(createTestConfig).mockImplementation(async (input: any) => ({ configUid: 'cfg_1', ...input }) as never);

    const result = await createCapabilityVerificationConfig({
      projectUid: 'proj_1',
      capabilityUid: 'cap_query',
      actorLabel: 'tester',
    });

    expect(result.config.featureDescription).toContain(buildCapabilityVerificationMarker('cap_query'));
    expect(result.config.featureDescription).toContain(
      buildCapabilityVerificationChainMarker(['cap_auth', 'cap_nav', 'cap_query'])
    );
    expect(result.config.featureDescription).toContain('验证链路：短信密码登录 -> 进入搜企业页 -> 搜企业检索');
  });

  it('preserves multi-step composite flows when verifying scenario-derived capabilities', async () => {
    const auth = makeCapability({
      capabilityUid: 'cap_auth',
      slug: 'auth.sms-password-login',
      name: '短信密码登录',
      capabilityType: 'auth',
      entryUrl: 'https://uat.example.com/#/',
    });
    const composite = makeCapability({
      capabilityUid: 'cap_flow',
      slug: 'composite.business-create-and-check',
      name: '创建商机并列表校验',
      capabilityType: 'composite',
      dependsOn: ['auth.sms-password-login'],
      entryUrl: 'https://uat.example.com/#/business/createbusiness',
      meta: {
        sourceTaskMode: 'scenario',
        flowDefinition: {
          version: 1,
          entryUrl: 'https://uat.example.com/#/business/createbusiness',
          sharedVariables: ['contactPhone', 'businessId'],
          expectedOutcome: '创建成功并可在商机列表按手机号检索',
          cleanupNotes: '记录商机ID供人工清理',
          steps: [
            {
              stepUid: 'flow-1',
              stepType: 'ui',
              title: '填写第一页',
              target: 'https://uat.example.com/#/business/createbusiness',
              instruction: '选择商机来源=抖音，填写联系人和手机号',
              expectedResult: '进入第二页',
              extractVariable: 'contactPhone',
            },
            {
              stepUid: 'flow-2',
              stepType: 'extract',
              title: '列表按手机号检索',
              target: 'https://uat.example.com/#/business/businesslist',
              instruction: '按手机号检索新建记录并读取商机ID',
              expectedResult: '列表展示新建商机',
              extractVariable: 'businessId',
            },
          ],
        },
      },
    });

    vi.mocked(getProjectCapabilityByUid).mockResolvedValue(composite as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_1',
      loginUrl: 'https://uat.example.com/#/',
    } as never);
    vi.mocked(listModulesByProject).mockResolvedValue([{ moduleUid: 'mod_1', status: 'active' }] as never);
    vi.mocked(listProjectCapabilities).mockResolvedValue([auth, composite] as never);
    vi.mocked(createTestConfig).mockImplementation(async (input: any) => ({ configUid: 'cfg_flow', ...input }) as never);

    const result = await createCapabilityVerificationConfig({
      projectUid: 'proj_1',
      capabilityUid: 'cap_flow',
      actorLabel: 'tester',
    });

    expect(result.config.flowDefinition?.steps).toHaveLength(3);
    expect(result.config.flowDefinition?.steps.map((step) => step.title)).toEqual([
      '短信密码登录',
      '填写第一页',
      '列表按手机号检索',
    ]);
    expect(result.config.targetUrl).toBe('https://uat.example.com/#/business/createbusiness');
    expect(result.config.flowDefinition?.entryUrl).toBe('https://uat.example.com/#/business/createbusiness');
    expect(result.config.flowDefinition?.sharedVariables).toEqual(['contactPhone', 'businessId']);
    expect(result.config.flowDefinition?.expectedOutcome).toContain('创建成功并可在商机列表按手机号检索');
    expect(result.config.flowDefinition?.cleanupNotes).toContain('记录商机ID供人工清理');
  });

  it('upgrades all capabilities in the verification chain when execution passes', async () => {
    const auth = makeCapability({
      capabilityUid: 'cap_auth',
      slug: 'auth.sms-password-login',
      name: '短信密码登录',
      capabilityType: 'auth',
      meta: { source: 'manual+validated-run' },
    });
    const navigation = makeCapability({
      capabilityUid: 'cap_nav',
      slug: 'navigation.company-easyindex',
      name: '进入搜企业页',
      capabilityType: 'navigation',
      dependsOn: ['auth.sms-password-login'],
      meta: { source: 'knowledge_chunk_auto', verificationStatus: 'knowledge_inferred' },
    });
    const query = makeCapability({
      capabilityUid: 'cap_query',
      slug: 'query.company-search',
      name: '搜企业检索',
      capabilityType: 'query',
      dependsOn: ['navigation.company-easyindex'],
      meta: { source: 'knowledge_chunk_auto', verificationStatus: 'knowledge_inferred' },
    });

    const featureDescription = [
      buildCapabilityVerificationMarker('cap_query'),
      buildCapabilityVerificationChainMarker(['cap_auth', 'cap_nav', 'cap_query']),
      '验证目标：搜企业检索',
    ].join('\n');

    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_1',
      projectUid: 'proj_1',
      featureDescription,
    } as never);
    vi.mocked(getProjectCapabilityByUid).mockImplementation(async (uid: string) => {
      if (uid === 'cap_auth') return auth as never;
      if (uid === 'cap_nav') return navigation as never;
      if (uid === 'cap_query') return query as never;
      return null as never;
    });
    await finalizeCapabilityVerification({
      configUid: 'cfg_1',
      planUid: 'plan_1',
      executionUid: 'exec_1',
      status: 'passed',
      actorLabel: 'tester',
    });

    expect(upsertProjectCapability).toHaveBeenCalledTimes(3);
    for (const call of vi.mocked(upsertProjectCapability).mock.calls) {
      expect(call[0]).toBe('proj_1');
      expect(call[1].meta).toMatchObject({
        source: 'validated-plan',
        verificationStatus: 'execution_verified',
        planUid: 'plan_1',
        executionUid: 'exec_1',
        verifiedExecutionUid: 'exec_1',
        lastVerificationStatus: 'passed',
        lastVerificationExecutionUid: 'exec_1',
      });
    }
    expect(archiveTestConfig).toHaveBeenCalledWith('cfg_1', { actorLabel: 'tester' });
  });
});
