import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DELETE as archiveCapability } from '../../app/api/projects/[projectUid]/capabilities/[capabilityUid]/route';
import { GET as listCapabilities, POST as saveCapabilities } from '../../app/api/projects/[projectUid]/capabilities/route';
import { POST as restoreCapability } from '../../app/api/projects/[projectUid]/capabilities/[capabilityUid]/restore/route';
import { POST as draftRecipe } from '../../app/api/projects/[projectUid]/draft-recipe/route';
import { DELETE as archiveKnowledge } from '../../app/api/projects/[projectUid]/knowledge/[documentUid]/route';
import { POST as deriveCapabilities } from '../../app/api/projects/[projectUid]/knowledge/[documentUid]/derive-capabilities/route';
import { GET as listKnowledge, POST as importKnowledge } from '../../app/api/projects/[projectUid]/knowledge/route';
import { POST as restoreKnowledge } from '../../app/api/projects/[projectUid]/knowledge/[documentUid]/restore/route';
import {
  addProjectMember,
  createTestModule,
  createTestProject,
  ensureWorkspaceActor,
} from '../../lib/db/repository';
import {
  cleanupProjectGraph,
  createActorRequest,
  ensureDotEnvLoaded,
  ensureIntegrationDbReady,
  uniqueLabel,
} from './support/db-test-utils';

type Fixture = {
  projectUid: string;
  moduleUid: string;
  ownerUid: string;
  viewerUid: string;
  viewerEmail: string;
};

const cleanupQueue: Fixture[] = [];

async function setupFixture(): Promise<Fixture> {
  ensureDotEnvLoaded();
  const owner = await ensureWorkspaceActor('');
  const label = uniqueLabel('intent');
  const project = await createTestProject(
    {
      name: `需求编排项目 ${label}`,
      description: '用于 knowledge / capability / recipe API 集成测试',
      coverImageUrl: '',
      authRequired: false,
      loginUrl: '',
      loginUsername: '',
      loginPassword: '',
      loginDescription: '',
    },
    {
      actorLabel: 'integration-test',
      actorUserUid: owner.userUid,
    }
  );
  const module = await createTestModule(
    project.projectUid,
    {
      name: `业务模块 ${label}`,
      description: '用于需求编排回填模块',
      sortOrder: 10,
    },
    { actorLabel: 'integration-test' }
  );
  const viewer = await addProjectMember(
    project.projectUid,
    {
      displayName: `Viewer ${label}`,
      email: `${label}@example.com`,
      role: 'viewer',
    },
    { actorLabel: 'integration-test' }
  );

  const fixture = {
    projectUid: project.projectUid,
    moduleUid: module.moduleUid,
    ownerUid: owner.userUid,
    viewerUid: viewer.userUid,
    viewerEmail: viewer.email,
  };
  cleanupQueue.push(fixture);
  return fixture;
}

describe.sequential('project intent API integration', () => {
  beforeAll(() => {
    ensureIntegrationDbReady();
  });

  afterEach(async () => {
    while (cleanupQueue.length > 0) {
      const fixture = cleanupQueue.pop();
      if (!fixture) continue;
      await cleanupProjectGraph(fixture.projectUid, [fixture.viewerEmail]);
    }
  });

  it('imports knowledge, saves capabilities, and drafts a dependency-aware recipe', async () => {
    const fixture = await setupFixture();
    const params = { params: Promise.resolve({ projectUid: fixture.projectUid }) };

    const knowledgeReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/knowledge`, fixture.ownerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'GBS 商机列表手册',
        sourceType: 'manual',
        sourcePath: 'tmp/manuals/gbs-business-list.txt',
        content: [
          '商机列表',
          '支持按手机号、联系人姓名检索商机。',
          '搜索结果会展示商机ID、手机号和商机进展。',
          '',
          '新增商机',
          '提交后可在商机列表中查询落库结果。',
        ].join('\n'),
      }),
    });
    const knowledgeRes = await importKnowledge(knowledgeReq, params);
    expect(knowledgeRes.status).toBe(201);
    const importedKnowledge = await knowledgeRes.json();
    expect(importedKnowledge.document.name).toBe('GBS 商机列表手册');
    expect(importedKnowledge.chunks.length).toBeGreaterThan(0);

    const docUid = String(importedKnowledge.document.documentUid);

    const listKnowledgeReq = createActorRequest(
      `http://localhost/api/projects/${fixture.projectUid}/knowledge?includeChunks=true&documentUid=${docUid}&limit=50`,
      fixture.viewerUid
    );
    const listKnowledgeRes = await listKnowledge(listKnowledgeReq, params);
    expect(listKnowledgeRes.status).toBe(200);
    const knowledgePayload = await listKnowledgeRes.json();
    expect(knowledgePayload.documents).toHaveLength(1);
    expect(knowledgePayload.chunks.length).toBeGreaterThan(0);
    expect(knowledgePayload.chunks[0].heading).toContain('商机列表');

    const capabilityReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/capabilities`, fixture.ownerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            slug: 'navigation.business-list-page',
            name: '打开商机列表页',
            description: '进入商机列表页并准备执行检索。',
            capabilityType: 'navigation',
            entryUrl: 'https://uat.example.com/#/business/list',
            triggerPhrases: ['商机列表', '打开商机列表'],
            preconditions: ['已登录系统'],
            steps: ['进入商机列表页'],
            assertions: ['商机列表页加载完成'],
            cleanupNotes: '',
            dependsOn: [],
            sortOrder: 10,
            sourceDocumentUid: docUid,
          },
          {
            slug: 'business.list-search-by-phone',
            name: '商机列表按手机号检索',
            description: '按手机号查询商机并读取落库结果。',
            capabilityType: 'query',
            entryUrl: 'https://uat.example.com/#/business/list',
            triggerPhrases: ['按手机号', '手机号校验落库', '校验落库'],
            preconditions: ['已打开商机列表页'],
            steps: ['输入手机号并搜索', '读取商机ID、手机号和商机进展'],
            assertions: ['列表展示商机ID和手机号', '商机进展符合预期'],
            cleanupNotes: '记录商机ID供人工清理',
            dependsOn: ['navigation.business-list-page'],
            sortOrder: 20,
            sourceDocumentUid: docUid,
          },
        ],
      }),
    });
    const capabilityRes = await saveCapabilities(capabilityReq, params);
    expect(capabilityRes.status).toBe(201);
    const capabilityPayload = await capabilityRes.json();
    expect(capabilityPayload.items).toHaveLength(2);

    const listCapabilitiesReq = createActorRequest(
      `http://localhost/api/projects/${fixture.projectUid}/capabilities?status=active`,
      fixture.viewerUid
    );
    const listCapabilitiesRes = await listCapabilities(listCapabilitiesReq, params);
    expect(listCapabilitiesRes.status).toBe(200);
    const capabilitiesPayload = await listCapabilitiesRes.json();
    expect(capabilitiesPayload.items.map((item: { slug: string }) => item.slug)).toEqual([
      'navigation.business-list-page',
      'business.list-search-by-phone',
    ]);

    const recipeReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/draft-recipe`, fixture.viewerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requirement: '在商机列表按手机号校验落库结果',
      }),
    });
    const recipeRes = await draftRecipe(recipeReq, params);
    expect(recipeRes.status).toBe(200);
    const recipePayload = await recipeRes.json();

    expect(recipePayload.capabilityCount).toBe(2);
    expect(recipePayload.knowledgeChunkCount).toBeGreaterThan(0);
    expect(recipePayload.recipe.matchedCapabilities.map((item: { slug: string }) => item.slug)).toEqual([
      'navigation.business-list-page',
      'business.list-search-by-phone',
    ]);
    expect(recipePayload.recipe.executionRecipe.steps.map((item: { capabilitySlug: string }) => item.capabilitySlug)).toEqual([
      'navigation.business-list-page',
      'business.list-search-by-phone',
    ]);
    expect(recipePayload.recipe.executionRecipe.assertions).toContain('列表展示商机ID和手机号');
    expect(recipePayload.recipe.supportingKnowledge.length).toBeGreaterThan(0);
    expect(recipePayload.recipe.supportingKnowledge[0].heading).toContain('商机列表');
    expect(recipePayload.recipe.requirementCoverage.uncoveredClauses).toEqual([]);
  });

  it('reports uncovered requirement clauses when available capabilities only cover part of the request', async () => {
    const fixture = await setupFixture();
    const params = { params: Promise.resolve({ projectUid: fixture.projectUid }) };

    const capabilityReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/capabilities`, fixture.ownerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'business.create-core',
        name: '创建商机主链路',
        description: '填写主链路最小必填并提交。',
        capabilityType: 'action',
        entryUrl: 'https://uat.example.com/#/business/create',
        triggerPhrases: ['创建商机', '主链路提交'],
        preconditions: ['已进入创建商机页'],
        steps: ['填写最小必填并提交'],
        assertions: ['提交成功'],
        cleanupNotes: '',
        dependsOn: [],
        sortOrder: 10,
      }),
    });
    const capabilityRes = await saveCapabilities(capabilityReq, params);
    expect(capabilityRes.status).toBe(201);

    const recipeReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/draft-recipe`, fixture.viewerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requirement: '创建商机并生成订单',
      }),
    });
    const recipeRes = await draftRecipe(recipeReq, params);
    expect(recipeRes.status).toBe(200);
    const recipePayload = await recipeRes.json();

    expect(recipePayload.recipe.matchedCapabilities.map((item: { slug: string }) => item.slug)).toEqual(['business.create-core']);
    expect(recipePayload.recipe.requirementCoverage.clauses).toEqual([
      expect.objectContaining({
        text: '创建商机',
        covered: true,
      }),
      expect.objectContaining({
        text: '生成订单',
        covered: false,
      }),
    ]);
    expect(recipePayload.recipe.requirementCoverage.uncoveredClauses).toEqual(['生成订单']);
  });

  it('uses a dedicated composite capability to fully cover create-business-to-order requirements', async () => {
    const fixture = await setupFixture();
    const params = { params: Promise.resolve({ projectUid: fixture.projectUid }) };

    const capabilityReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/capabilities`, fixture.ownerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            slug: 'business.create-core',
            name: '创建商机主链路',
            description: '填写主链路最小必填并提交。',
            capabilityType: 'action',
            entryUrl: 'https://uat.example.com/#/business/create',
            triggerPhrases: ['创建商机', '主链路提交'],
            preconditions: ['已进入创建商机页'],
            steps: ['填写最小必填并提交'],
            assertions: ['提交成功'],
            cleanupNotes: '',
            dependsOn: [],
            sortOrder: 20,
          },
          {
            slug: 'composite.business-create-to-order',
            name: '创建商机并生成订单',
            description: '创建商机后在商机列表生成订单，并等待 createOrder 成功。',
            capabilityType: 'composite',
            entryUrl: 'https://uat.example.com/#/business/create',
            triggerPhrases: ['创建商机并生成订单', '商机转订单', '生成订单'],
            preconditions: ['已登录系统'],
            steps: ['创建商机', '生成订单'],
            assertions: ['createOrder 成功'],
            cleanupNotes: '记录商机ID供人工清理',
            dependsOn: [],
            sortOrder: 10,
            meta: {
              supersedes: ['business.create-core'],
              sourceTaskMode: 'scenario',
              flowDefinition: {
                version: 1,
                entryUrl: 'https://uat.example.com/#/business/create',
                sharedVariables: ['contactPhone', 'businessId'],
                expectedOutcome: '创建商机后可成功生成订单',
                cleanupNotes: '记录商机ID供人工清理',
                steps: [
                  {
                    stepUid: 'flow_1',
                    stepType: 'ui',
                    title: '创建商机',
                    target: 'https://uat.example.com/#/business/create',
                    instruction: '填写最小必填并提交',
                    expectedResult: '商机提交成功',
                    extractVariable: 'contactPhone',
                  },
                  {
                    stepUid: 'flow_2',
                    stepType: 'api',
                    title: '生成订单',
                    target: 'https://uat.example.com/#/business/list',
                    instruction: '等待 createOrder 成功响应',
                    expectedResult: 'createOrder 成功',
                    extractVariable: 'businessId',
                  },
                ],
              },
            },
          },
        ],
      }),
    });
    const capabilityRes = await saveCapabilities(capabilityReq, params);
    expect(capabilityRes.status).toBe(201);

    const recipeReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/draft-recipe`, fixture.viewerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requirement: '创建商机并生成订单',
      }),
    });
    const recipeRes = await draftRecipe(recipeReq, params);
    expect(recipeRes.status).toBe(200);
    const recipePayload = await recipeRes.json();

    expect(recipePayload.recipe.matchedCapabilities.map((item: { slug: string }) => item.slug)).toEqual([
      'composite.business-create-to-order',
    ]);
    expect(recipePayload.recipe.executionRecipe.steps.map((item: { capabilitySlug: string }) => item.capabilitySlug)).toEqual([
      'composite.business-create-to-order',
    ]);
    expect(recipePayload.recipe.requirementCoverage.uncoveredClauses).toEqual([]);
  });

  it('derives stable capabilities from knowledge chunks and links verification metadata', async () => {
    const fixture = await setupFixture();
    const projectParams = { params: Promise.resolve({ projectUid: fixture.projectUid }) };

    const knowledgeReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/knowledge`, fixture.ownerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'GBS 自动能力提炼手册',
        sourceType: 'manual',
        content: [
          '商机列表',
          '支持按手机号、联系人姓名检索商机。',
          '搜索结果会展示商机ID、手机号和商机进展。',
          '',
          '新增商机',
          '填写商机来源、联系人和联系方式后提交。',
        ].join('\n'),
      }),
    });
    const knowledgeRes = await importKnowledge(knowledgeReq, projectParams);
    expect(knowledgeRes.status).toBe(201);
    const knowledgePayload = await knowledgeRes.json();
    const documentUid = String(knowledgePayload.document.documentUid);

    const deriveReq = createActorRequest(
      `http://localhost/api/projects/${fixture.projectUid}/knowledge/${documentUid}/derive-capabilities`,
      fixture.ownerUid,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    const deriveRes = await deriveCapabilities(
      deriveReq,
      { params: Promise.resolve({ projectUid: fixture.projectUid, documentUid }) }
    );
    expect(deriveRes.status).toBe(201);
    const derivePayload = await deriveRes.json();

    expect(derivePayload.summary.derivedCount).toBeGreaterThan(0);
    expect(derivePayload.summary.knowledgeInferredCount).toBeGreaterThan(0);
    expect(
      derivePayload.items.some(
        (item: { meta?: { verificationStatus?: string } }) => item.meta?.verificationStatus === 'knowledge_inferred'
      )
    ).toBe(true);
    expect(
      derivePayload.items.some((item: { name: string }) => item.name.includes('商机列表') || item.name.includes('创建商机'))
    ).toBe(true);

    const listCapabilitiesReq = createActorRequest(
      `http://localhost/api/projects/${fixture.projectUid}/capabilities?status=active`,
      fixture.viewerUid
    );
    const listCapabilitiesRes = await listCapabilities(listCapabilitiesReq, projectParams);
    expect(listCapabilitiesRes.status).toBe(200);
    const listCapabilitiesPayload = await listCapabilitiesRes.json();
    expect(listCapabilitiesPayload.items.length).toBeGreaterThan(0);

    const recipeReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/draft-recipe`, fixture.viewerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requirement: '在商机列表按手机号检索商机',
      }),
    });
    const recipeRes = await draftRecipe(recipeReq, projectParams);
    expect(recipeRes.status).toBe(200);
    const recipePayload = await recipeRes.json();
    expect(recipePayload.recipe.matchedCapabilities.length).toBeGreaterThan(0);
    expect(recipePayload.recipe.requirementCoverage.uncoveredClauses).toEqual([]);
  });

  it('rejects knowledge and capability writes for viewer role', async () => {
    const fixture = await setupFixture();
    const params = { params: Promise.resolve({ projectUid: fixture.projectUid }) };

    const knowledgeReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/knowledge`, fixture.viewerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'viewer forbidden knowledge',
        content: 'viewer 无权导入知识',
      }),
    });
    const knowledgeRes = await importKnowledge(knowledgeReq, params);
    expect(knowledgeRes.status).toBe(403);
    expect(await knowledgeRes.json()).toEqual({ error: '当前操作者没有权限导入项目知识' });

    const capabilityReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/capabilities`, fixture.viewerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'viewer.forbidden',
        name: 'viewer forbidden',
        description: 'viewer 无权维护能力',
        capabilityType: 'action',
      }),
    });
    const capabilityRes = await saveCapabilities(capabilityReq, params);
    expect(capabilityRes.status).toBe(403);
    expect(await capabilityRes.json()).toEqual({ error: '当前操作者没有权限维护项目能力库' });
  });

  it('replaces same-name knowledge and updates same-slug capability in place', async () => {
    const fixture = await setupFixture();
    const params = { params: Promise.resolve({ projectUid: fixture.projectUid }) };

    const firstKnowledgeReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/knowledge`, fixture.ownerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '商机校验手册',
        sourceType: 'manual',
        content: ['商机列表', '支持按手机号检索商机。'].join('\n'),
      }),
    });
    const firstKnowledgeRes = await importKnowledge(firstKnowledgeReq, params);
    expect(firstKnowledgeRes.status).toBe(201);
    const firstKnowledgePayload = await firstKnowledgeRes.json();
    const firstDocumentUid = String(firstKnowledgePayload.document.documentUid);

    const replaceKnowledgeReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/knowledge`, fixture.ownerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '商机校验手册',
        sourceType: 'manual',
        content: ['商机列表', '支持按手机号和联系人姓名联合检索。', '结果展示商机ID和商机进展。'].join('\n'),
      }),
    });
    const replaceKnowledgeRes = await importKnowledge(replaceKnowledgeReq, params);
    expect(replaceKnowledgeRes.status).toBe(201);
    const replacedKnowledgePayload = await replaceKnowledgeRes.json();
    expect(replacedKnowledgePayload.document.documentUid).toBe(firstDocumentUid);
    expect(replacedKnowledgePayload.chunks.some((item: { content: string }) => item.content.includes('联系人姓名联合检索'))).toBe(true);

    const listKnowledgeReq = createActorRequest(
      `http://localhost/api/projects/${fixture.projectUid}/knowledge?includeChunks=true&documentUid=${firstDocumentUid}&limit=50`,
      fixture.ownerUid
    );
    const listKnowledgeRes = await listKnowledge(listKnowledgeReq, params);
    expect(listKnowledgeRes.status).toBe(200);
    const listedKnowledgePayload = await listKnowledgeRes.json();
    expect(listedKnowledgePayload.documents).toHaveLength(1);
    expect(listedKnowledgePayload.chunks.some((item: { content: string }) => item.content.includes('按手机号检索商机。'))).toBe(false);
    expect(listedKnowledgePayload.chunks.some((item: { content: string }) => item.content.includes('联系人姓名联合检索'))).toBe(true);

    const createCapabilityReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/capabilities`, fixture.ownerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'business.list-search',
        name: '商机列表检索',
        description: '按手机号检索商机。',
        capabilityType: 'query',
        entryUrl: 'https://uat.example.com/#/business/list',
        triggerPhrases: ['按手机号检索'],
        preconditions: ['已打开商机列表页'],
        steps: ['输入手机号并搜索'],
        assertions: ['列表展示匹配商机'],
        sourceDocumentUid: firstDocumentUid,
      }),
    });
    const createCapabilityRes = await saveCapabilities(createCapabilityReq, params);
    expect(createCapabilityRes.status).toBe(201);
    const createdCapabilityPayload = await createCapabilityRes.json();
    const firstCapabilityUid = String(createdCapabilityPayload.items[0].capabilityUid);

    const updateCapabilityReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/capabilities`, fixture.ownerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'business.list-search',
        name: '商机列表联合检索',
        description: '按手机号和联系人姓名联合检索商机。',
        capabilityType: 'query',
        entryUrl: 'https://uat.example.com/#/business/list',
        triggerPhrases: ['联合检索', '联系人姓名检索'],
        preconditions: ['已打开商机列表页'],
        steps: ['输入手机号和联系人姓名并搜索'],
        assertions: ['列表展示匹配商机与联系人姓名'],
        cleanupNotes: '记录商机ID',
        sourceDocumentUid: firstDocumentUid,
      }),
    });
    const updateCapabilityRes = await saveCapabilities(updateCapabilityReq, params);
    expect(updateCapabilityRes.status).toBe(201);
    const updatedCapabilityPayload = await updateCapabilityRes.json();
    expect(updatedCapabilityPayload.items[0].capabilityUid).toBe(firstCapabilityUid);
    expect(updatedCapabilityPayload.items[0].name).toBe('商机列表联合检索');

    const listCapabilitiesReq = createActorRequest(
      `http://localhost/api/projects/${fixture.projectUid}/capabilities?status=active`,
      fixture.ownerUid
    );
    const listCapabilitiesRes = await listCapabilities(listCapabilitiesReq, params);
    expect(listCapabilitiesRes.status).toBe(200);
    const listedCapabilitiesPayload = await listCapabilitiesRes.json();
    expect(listedCapabilitiesPayload.items).toHaveLength(1);
    expect(listedCapabilitiesPayload.items[0]).toMatchObject({
      capabilityUid: firstCapabilityUid,
      slug: 'business.list-search',
      name: '商机列表联合检索',
      description: '按手机号和联系人姓名联合检索商机。',
      cleanupNotes: '记录商机ID',
    });
    expect(listedCapabilitiesPayload.items[0].steps).toEqual(['输入手机号和联系人姓名并搜索']);
    expect(listedCapabilitiesPayload.items[0].assertions).toEqual(['列表展示匹配商机与联系人姓名']);
  });

  it('archives and restores a capability by uid', async () => {
    const fixture = await setupFixture();
    const projectParams = { params: Promise.resolve({ projectUid: fixture.projectUid }) };

    const createCapabilityReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/capabilities`, fixture.ownerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'business.archive-me',
        name: '待归档能力',
        description: '用于验证能力归档与恢复。',
        capabilityType: 'action',
        triggerPhrases: ['归档能力'],
        steps: ['执行归档前动作'],
        assertions: ['能力可见'],
      }),
    });
    const createCapabilityRes = await saveCapabilities(createCapabilityReq, projectParams);
    expect(createCapabilityRes.status).toBe(201);
    const createdCapabilityPayload = await createCapabilityRes.json();
    const capabilityUid = String(createdCapabilityPayload.items[0].capabilityUid);

    const archiveReq = createActorRequest(
      `http://localhost/api/projects/${fixture.projectUid}/capabilities/${capabilityUid}`,
      fixture.ownerUid,
      { method: 'DELETE' }
    );
    const archiveRes = await archiveCapability(archiveReq, {
      params: Promise.resolve({ projectUid: fixture.projectUid, capabilityUid }),
    });
    expect(archiveRes.status).toBe(200);

    const activeListReq = createActorRequest(
      `http://localhost/api/projects/${fixture.projectUid}/capabilities?status=active`,
      fixture.ownerUid
    );
    const activeListRes = await listCapabilities(activeListReq, projectParams);
    expect(activeListRes.status).toBe(200);
    const activeListPayload = await activeListRes.json();
    expect(activeListPayload.items).toHaveLength(0);

    const allListReq = createActorRequest(
      `http://localhost/api/projects/${fixture.projectUid}/capabilities?status=all`,
      fixture.ownerUid
    );
    const allListRes = await listCapabilities(allListReq, projectParams);
    expect(allListRes.status).toBe(200);
    const allListPayload = await allListRes.json();
    expect(allListPayload.items).toHaveLength(1);
    expect(allListPayload.items[0]).toMatchObject({
      capabilityUid,
      slug: 'business.archive-me',
      status: 'archived',
    });

    const restoreReq = createActorRequest(
      `http://localhost/api/projects/${fixture.projectUid}/capabilities/${capabilityUid}/restore`,
      fixture.ownerUid,
      { method: 'POST' }
    );
    const restoreRes = await restoreCapability(restoreReq, {
      params: Promise.resolve({ projectUid: fixture.projectUid, capabilityUid }),
    });
    expect(restoreRes.status).toBe(200);

    const restoredListReq = createActorRequest(
      `http://localhost/api/projects/${fixture.projectUid}/capabilities?status=active`,
      fixture.ownerUid
    );
    const restoredListRes = await listCapabilities(restoredListReq, projectParams);
    expect(restoredListRes.status).toBe(200);
    const restoredListPayload = await restoredListRes.json();
    expect(restoredListPayload.items).toHaveLength(1);
    expect(restoredListPayload.items[0]).toMatchObject({
      capabilityUid,
      slug: 'business.archive-me',
      status: 'active',
    });
  });

  it('archives and restores a knowledge document by uid', async () => {
    const fixture = await setupFixture();
    const projectParams = { params: Promise.resolve({ projectUid: fixture.projectUid }) };

    const importReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/knowledge`, fixture.ownerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '待归档知识文档',
        sourceType: 'manual',
        content: ['商机列表', '支持按手机号检索商机。', '搜索结果展示商机ID。'].join('\n'),
      }),
    });
    const importRes = await importKnowledge(importReq, projectParams);
    expect(importRes.status).toBe(201);
    const importPayload = await importRes.json();
    const documentUid = String(importPayload.document.documentUid);

    const archiveReq = createActorRequest(
      `http://localhost/api/projects/${fixture.projectUid}/knowledge/${documentUid}`,
      fixture.ownerUid,
      { method: 'DELETE' }
    );
    const archiveRes = await archiveKnowledge(archiveReq, {
      params: Promise.resolve({ projectUid: fixture.projectUid, documentUid }),
    });
    expect(archiveRes.status).toBe(200);

    const activeListReq = createActorRequest(
      `http://localhost/api/projects/${fixture.projectUid}/knowledge?status=active`,
      fixture.ownerUid
    );
    const activeListRes = await listKnowledge(activeListReq, projectParams);
    expect(activeListRes.status).toBe(200);
    const activeListPayload = await activeListRes.json();
    expect(activeListPayload.documents).toHaveLength(0);

    const allListReq = createActorRequest(
      `http://localhost/api/projects/${fixture.projectUid}/knowledge?status=all&includeChunks=true&documentUid=${documentUid}&limit=20`,
      fixture.ownerUid
    );
    const allListRes = await listKnowledge(allListReq, projectParams);
    expect(allListRes.status).toBe(200);
    const allListPayload = await allListRes.json();
    expect(allListPayload.documents).toHaveLength(1);
    expect(allListPayload.documents[0]).toMatchObject({
      documentUid,
      name: '待归档知识文档',
      status: 'archived',
    });
    expect(allListPayload.chunks.length).toBeGreaterThan(0);

    const archivedRecipeReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/draft-recipe`, fixture.ownerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requirement: '按手机号检索商机',
      }),
    });
    const archivedRecipeRes = await draftRecipe(archivedRecipeReq, projectParams);
    expect(archivedRecipeRes.status).toBe(409);
    expect(await archivedRecipeRes.json()).toEqual({ error: '项目还没有知识或能力数据，请先导入手册和能力库' });

    const restoreReq = createActorRequest(
      `http://localhost/api/projects/${fixture.projectUid}/knowledge/${documentUid}/restore`,
      fixture.ownerUid,
      { method: 'POST' }
    );
    const restoreRes = await restoreKnowledge(restoreReq, {
      params: Promise.resolve({ projectUid: fixture.projectUid, documentUid }),
    });
    expect(restoreRes.status).toBe(200);

    const restoredListReq = createActorRequest(
      `http://localhost/api/projects/${fixture.projectUid}/knowledge?status=active&includeChunks=true&documentUid=${documentUid}&limit=20`,
      fixture.ownerUid
    );
    const restoredListRes = await listKnowledge(restoredListReq, projectParams);
    expect(restoredListRes.status).toBe(200);
    const restoredListPayload = await restoredListRes.json();
    expect(restoredListPayload.documents).toHaveLength(1);
    expect(restoredListPayload.documents[0]).toMatchObject({
      documentUid,
      status: 'active',
    });
    expect(restoredListPayload.chunks.length).toBeGreaterThan(0);

    const restoredRecipeReq = createActorRequest(`http://localhost/api/projects/${fixture.projectUid}/draft-recipe`, fixture.ownerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requirement: '按手机号检索商机',
      }),
    });
    const restoredRecipeRes = await draftRecipe(restoredRecipeReq, projectParams);
    expect(restoredRecipeRes.status).toBe(200);
    const restoredRecipePayload = await restoredRecipeRes.json();
    expect(restoredRecipePayload.knowledgeChunkCount).toBeGreaterThan(0);
    expect(restoredRecipePayload.recipe.supportingKnowledge.length).toBeGreaterThan(0);
  });
});
