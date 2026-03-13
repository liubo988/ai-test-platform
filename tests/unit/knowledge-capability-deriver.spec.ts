import { describe, expect, it } from 'vitest';
import { deriveCapabilitiesFromKnowledgeDocument } from '../../lib/knowledge-capability-deriver';

describe('knowledge capability deriver', () => {
  it('derives navigation and query capabilities from a searchable list chunk', () => {
    const result = deriveCapabilitiesFromKnowledgeDocument({
      document: {
        documentUid: 'doc_1',
        name: 'GBS 手册',
        sourceType: 'manual',
        meta: {},
      },
      projectLoginUrl: 'https://uat.example.com/#/',
      existingCapabilities: [
        {
          capabilityUid: 'cap_auth',
          slug: 'auth.sms-password-login',
          name: '短信密码登录',
          capabilityType: 'auth',
          entryUrl: 'https://uat.example.com/#/',
          sourceDocumentUid: '',
          status: 'active',
          meta: { source: 'manual+validated-run' },
        },
      ],
      chunks: [
        {
          chunkUid: 'chunk_1',
          documentUid: 'doc_1',
          heading: '商机列表',
          content: '支持按手机号、联系人姓名检索商机。搜索结果会展示商机ID、手机号和商机进展。',
          keywords: ['商机列表', '手机号', '联系人姓名'],
          sourceLineStart: 1,
          sourceLineEnd: 2,
          tokenEstimate: 50,
          sortOrder: 1,
          meta: {},
        },
      ],
    });

    expect(result.summary.derivedCount).toBeGreaterThanOrEqual(2);
    expect(result.items.map((item) => item.capabilityType)).toEqual(expect.arrayContaining(['navigation', 'query']));
    expect(result.items.find((item) => item.capabilityType === 'navigation')?.dependsOn).toEqual(['auth.sms-password-login']);
    expect(result.items.find((item) => item.capabilityType === 'query')?.meta.verificationStatus).toBe('knowledge_inferred');
  });

  it('splits 搜企业 manual chunks into navigation plus pure query capability', () => {
    const result = deriveCapabilitiesFromKnowledgeDocument({
      document: {
        documentUid: 'doc_2',
        name: 'GBS 搜企业手册',
        sourceType: 'manual',
        meta: {},
      },
      projectLoginUrl: 'https://uat-service.yikaiye.com/#/',
      existingCapabilities: [
        {
          capabilityUid: 'cap_auth',
          slug: 'auth.sms-password-login',
          name: '短信密码登录',
          capabilityType: 'auth',
          entryUrl: 'https://uat-service.yikaiye.com/#/',
          sourceDocumentUid: '',
          status: 'active',
          meta: { source: 'manual+validated-run' },
        },
      ],
      chunks: [
        {
          chunkUid: 'chunk_search_company',
          documentUid: 'doc_2',
          heading: '搜企业',
          content: [
            '可使用企业名称、统一信用代码、股东信息搜索企业：',
            '点击【设置常用筛选项】按钮可自定义筛选喜好，设置好后再点击【保存常用筛选项】按钮即',
            '点击筛选结果企业，可查看企业详情：',
            '点击搜企业列表以及企业详情页的【收藏企业】可以收藏该企业。',
            '收藏成功的企业，会展示在“线索挖掘-收藏企业-我的收藏”列表：',
          ].join('\n'),
          keywords: ['搜企业', '企业名称', '统一信用代码', '股东信息'],
          sourceLineStart: 30,
          sourceLineEnd: 40,
          tokenEstimate: 100,
          sortOrder: 2,
          meta: {},
        },
      ],
    });

    const navigation = result.items.find((item) => item.capabilityType === 'navigation');
    const query = result.items.find((item) => item.capabilityType === 'query');

    expect(navigation).toMatchObject({
      name: '进入搜企业页',
      entryUrl: 'https://uat-service.yikaiye.com/#/company/easyindex',
      dependsOn: ['auth.sms-password-login'],
    });
    expect(query).toMatchObject({
      name: '搜企业检索',
      entryUrl: 'https://uat-service.yikaiye.com/#/company/easyindex',
      dependsOn: [navigation?.slug],
      steps: ['在搜企业页输入企业名称、统一信用代码或股东关键词', '执行搜索'],
      assertions: ['列表展示企业搜索结果', '结果项显示企业名称或企业状态'],
    });
    expect(query?.steps.join('\n')).not.toContain('收藏企业');
    expect(query?.assertions.join('\n')).not.toContain('我的收藏');
  });
});
