export type IntentE2EPriorityScenarioFamily =
  | 'business_create_list_verify'
  | 'business_to_order'
  | 'list_search_detail'
  | 'modal_or_drawer_save'
  | 'row_action_menu'
  | 'list_ownership_switch'
  | 'untracked';

export type IntentTrackedE2EPriorityScenarioFamily = Exclude<IntentE2EPriorityScenarioFamily, 'untracked'>;

export type IntentE2EPriorityScenarioFamilyRouteSource =
  | 'text_only'
  | 'text_confirmed_by_visual'
  | 'visual_anchor_salvaged';

export interface IntentE2EPriorityScenarioFamilyRoute {
  family: IntentE2EPriorityScenarioFamily;
  textFamily: IntentE2EPriorityScenarioFamily;
  visualFamily: IntentE2EPriorityScenarioFamily;
  source: IntentE2EPriorityScenarioFamilyRouteSource;
  clarifySignals: string[];
}

export type IntentE2EPriorityScenarioFamilyFixtureContract =
  | 'not_required'
  | 'project_data_dependency_explicit';

export interface IntentE2EPriorityScenarioFamilyStableIdentifierProfile {
  primaryVariables: string[];
  fallbackVariables: string[];
  responsePathHints: string[];
  detailFieldLabels: string[];
  listResponseUrlIncludes?: string;
  detailUrlTemplate?: string;
  detailTitleIncludes?: string;
}

export interface IntentE2EPriorityScenarioFamilyVerifierProfile {
  requiredEvidence: string[];
  policyNotes: string[];
  expectedFieldLabels: string[];
  detailEntry?: {
    trigger?: 'row_action' | 'row_click';
    actionLabel?: string;
    target?: 'drawer_or_modal' | 'page';
    urlIncludes?: string;
  };
}

export interface IntentE2EPriorityScenarioFamilyReadinessProfile {
  requirements: string[];
  fixtureContract: IntentE2EPriorityScenarioFamilyFixtureContract;
  notes: string[];
}

export interface IntentE2EPriorityScenarioFamilyAssetProfile {
  family: IntentTrackedE2EPriorityScenarioFamily;
  preferredCapabilitySlugs: string[];
  preferredRecipeSlugs: string[];
  executionRules: string[];
  preferredPrimitives: string[];
  outputContract: string[];
  stableIdentifier: IntentE2EPriorityScenarioFamilyStableIdentifierProfile;
  verifier: IntentE2EPriorityScenarioFamilyVerifierProfile;
  readiness: IntentE2EPriorityScenarioFamilyReadinessProfile;
}

function cloneStringArray(values: string[]): string[] {
  return values.map((item) => item.trim()).filter(Boolean);
}

const PRIORITY_SCENARIO_FAMILY_ASSET_PROFILES: Partial<
  Record<IntentTrackedE2EPriorityScenarioFamily, IntentE2EPriorityScenarioFamilyAssetProfile>
> = {
  business_create_list_verify: {
    family: 'business_create_list_verify',
    preferredCapabilitySlugs: [
      'assert.wait-for-api-response',
      'assert.watch-submit-state',
      'ui.switch-business-list-ownership-view',
      'assert.resolve-primary-record',
      'assert.read-detail-field',
    ],
    preferredRecipeSlugs: [
      'business.create',
      'business.list-ownership-switch',
      'assert.antd-table-primary-key-search',
      'intent.ui-antd-modal-drawer-save',
    ],
    executionRules: [
      '命中 family=business_create_list_verify 时，首轮优先沿“提交收敛 -> businessId/唯一身份提取 -> 列表/详情回查”固定骨架执行，不要回退成开放式整段脚本。',
      '若切“我创建的 / 我跟进的”只是为了进入正确列表视角，该步骤只负责切视角与列表 ready；唯一一次目标记录检索应由后续 `resolvePrimaryRecord(...)` 独占。',
      '若业务创建成功但 businessId 暂时为空，允许保留联系人/手机号作为 fallback identity，并继续从列表响应、rowKey、rowText 或详情回退补齐稳定标识。',
    ],
    preferredPrimitives: [
      'extract_stable_identifier(responseJson, primaryPaths[], fallbackVariables[]): 优先提取 businessId，缺失时显式保留联系人/手机号 fallback identity',
      'resolve_primary_record(primaryValue, rowHasTexts?, detailUrl?): 把列表命中、详情回退和状态证据收口成一条固定链',
    ],
    outputContract: [
      '必须优先提取 `businessId`；若当前真实响应没有返回 `businessId`，至少保留 `contactPhone / contactName` 作为 fallback identity，再继续列表/详情回查。',
      '最终通过必须同时具备：提交收敛证据、目标业务实体身份证据，以及列表响应或详情字段中的状态证据；toast / URL 变化不能单独判通过。',
      '状态字段优先读取 `商机进展`，再回退通用 `状态`；不要要求状态必须直接出现在同一行可见文本里。',
    ],
    stableIdentifier: {
      primaryVariables: ['businessId'],
      fallbackVariables: ['contactPhone', 'contactName'],
      responsePathHints: ['data.businessId', 'data.id', 'result.businessId', 'result.id'],
      detailFieldLabels: ['商机进展', '状态'],
      listResponseUrlIncludes: '/business',
      detailUrlTemplate: '/business/detail/{{primaryValue}}',
      detailTitleIncludes: '商机详情',
    },
    verifier: {
      requiredEvidence: ['submit_response', 'stable_identifier', 'table_or_detail_record', 'status_evidence'],
      policyNotes: [
        '当前 family = business_create_list_verify：最终验收必须基于真实业务实体，不允许只把“保存成功” toast、URL 切换或列表任意一行文本当作业务成功。',
        '当前 family = business_create_list_verify：若列表命中的是 fallback identity，后续仍要优先用列表响应、rowKey / rowText 派生主键，或进入详情读取 `商机进展 / 状态` 完成最终验收。',
      ],
      expectedFieldLabels: ['联系人', '手机号', '商机进展', '状态'],
      detailEntry: {
        trigger: 'row_action',
        actionLabel: '查看',
        target: 'drawer_or_modal',
      },
    },
    readiness: {
      requirements: [
        '需要登录态和可进入创建页',
        '需要可观测的提交响应或 submit-state 收敛信号',
        '需要商机列表视角切换或稳定回列表路径',
        '需要 businessId 或联系人/手机号 fallback identity 用于回查',
      ],
      fixtureContract: 'project_data_dependency_explicit',
      notes: [
        '若当前环境不允许真实创建并回查新记录，这不是 prompt 质量问题，而是显式 data/fixture gap；主链路必须保留该缺口可见。',
      ],
    },
  },
  list_search_detail: {
    family: 'list_search_detail',
    preferredCapabilitySlugs: [
      'ui.find-antd-table-row',
      'assert.resolve-primary-record',
      'assert.read-detail-field',
      'ui.click-antd-row-action',
    ],
    preferredRecipeSlugs: ['assert.antd-table-primary-key-search', 'intent.list-search-detail.primary-record'],
    executionRules: [
      '命中 family=list_search_detail 时，首轮优先沿“列表检索 -> 目标行命中 -> 进入对应详情 -> 字段级验收”固定骨架执行，不要搜索后直接点击第一条记录。',
      '如果已经拿到稳定标识，优先把它作为列表回查主值；只有主值为空时才退回联系人/手机号等 fallback identity。',
    ],
    preferredPrimitives: [
      'resolve_primary_record(primaryValue, rowHasTexts?, detailEntry?): 统一处理列表搜索、命中目标行和详情回退',
      'read_detail_field(label, scope?): 在详情页 / 抽屉内按字段标签读取联系人、手机号、状态等值',
    ],
    outputContract: [
      '最终通过必须覆盖：目标记录在列表中被稳定命中，且已进入对应详情 surface，并通过字段标签读取联系人/手机号/状态等核心字段。',
      '如果只证明“列表里有结果”但没有进入对应详情核对字段，不允许判通过。',
    ],
    stableIdentifier: {
      primaryVariables: ['customerCode', 'recordUid', 'serialNo', 'businessId', 'orderId'],
      fallbackVariables: ['contactPhone', 'contactName', 'customerName'],
      responsePathHints: ['data.id', 'data.code', 'data.customerCode', 'data.recordUid', 'data.serialNo'],
      detailFieldLabels: ['联系人', '手机号', '状态'],
      detailTitleIncludes: '详情',
    },
    verifier: {
      requiredEvidence: ['table_row', 'detail_entry', 'detail_fields'],
      policyNotes: [
        '当前 family = list_search_detail：最终验收以“命中目标行 -> 进入对应详情 -> 按字段标签读值”为主；仅列表返回结果或局部文本命中不足以通过。',
        '当前 family = list_search_detail：若详情入口存在，优先沿固定详情入口链进入详情，再用字段标签做最终核对，不要对整页大段文本做模糊断言。',
      ],
      expectedFieldLabels: ['联系人', '手机号', '状态'],
      detailEntry: {
        trigger: 'row_action',
        actionLabel: '查看',
      },
    },
    readiness: {
      requirements: [
        '需要可见列表检索面或 helper 可探测到的搜索入口',
        '需要目标记录可被稳定标识或 fallback identity 唯一定位',
        '需要详情入口或详情 surface ready 信号',
      ],
      fixtureContract: 'project_data_dependency_explicit',
      notes: [
        '若当前环境没有可检索到的目标记录，应显式暴露 data gap，而不是继续自由生成第二套详情猜测路径。',
      ],
    },
  },
  modal_or_drawer_save: {
    family: 'modal_or_drawer_save',
    preferredCapabilitySlugs: [
      'ui.wait-for-visible-antd-modal',
      'assert.wait-for-api-response',
      'assert.watch-submit-state',
      'assert.read-detail-field',
    ],
    preferredRecipeSlugs: ['ui.antd-modal-drawer-save', 'intent.modal-or-drawer-save.visible-container'],
    executionRules: [
      '命中 family=modal_or_drawer_save 时，首轮优先沿“进入当前可见 modal/drawer -> scoped 填写 -> 保存 -> 收敛观察”固定骨架执行，不要在整页范围里猜输入框或保存按钮。',
      '保存后至少要观察弹层关闭、详情值保留、列表收敛或页面回到稳定态中的一种真实业务收敛证据，不能只看 toast。',
    ],
    preferredPrimitives: [
      'scope_visible_container(titleIncludes?): 先定位当前可见 modal / drawer，再在容器内继续填写和保存',
      'observe_submit_state(trigger, response?, surface?): 把按钮 loading、容器关闭和页面稳定态统一纳入保存收敛证据',
    ],
    outputContract: [
      '必须把保存动作 scope 到当前可见 modal / drawer；禁止直接在 page 顶层对“保存 / 提交 / 确定”做模糊点击。',
      '最终通过至少要覆盖保存接口成功与容器关闭/页面稳定态其一；如果还要求校验业务结果，应继续读取详情字段或回列表验收。',
    ],
    stableIdentifier: {
      primaryVariables: ['recordId', 'customerCode', 'businessId'],
      fallbackVariables: ['contactPhone', 'contactName', 'name'],
      responsePathHints: ['data.id', 'data.recordId', 'data.code', 'data.businessId'],
      detailFieldLabels: ['联系人', '手机号', '状态'],
      detailTitleIncludes: '详情',
    },
    verifier: {
      requiredEvidence: ['submit_response', 'container_closed_or_stable_surface'],
      policyNotes: [
        '当前 family = modal_or_drawer_save：保存成功的核心证据是提交收敛 + 容器关闭或页面稳定，不允许把 toast 单独当最终成功。',
        '当前 family = modal_or_drawer_save：如果保存后还需要业务验收，优先读取当前详情字段或回列表定位目标记录，而不是在整页上做模糊文本匹配。',
      ],
      expectedFieldLabels: ['联系人', '手机号', '状态'],
    },
    readiness: {
      requirements: [
        '需要能稳定进入当前可见 modal / drawer',
        '需要明确的保存提交信号或可观测收敛路径',
        '若保存后还要业务验收，需要可读取的详情字段或回列表路径',
      ],
      fixtureContract: 'project_data_dependency_explicit',
      notes: [
        '若当前环境缺少可编辑记录或保存后没有可验证的业务结果面，应显式暴露 readiness/data gap，不能靠 toast 假装通过。',
      ],
    },
  },
};

function normalizeScenarioCard(input: unknown):
  | {
      title?: unknown;
      featureDescription?: unknown;
      visualAnchors?: unknown;
      flowDefinition?: {
        steps?: unknown;
      } | null;
    }
  | null {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? (input as {
        title?: unknown;
        featureDescription?: unknown;
        visualAnchors?: unknown;
        flowDefinition?: {
          steps?: unknown;
        } | null;
      })
    : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    )
  );
}

function stripStructuredFamilySignalSections(value: string): string {
  const lines = String(value || '').split(/\r?\n/);
  const result: string[] = [];
  let skippingVisualAnchors = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^(?:[-*]\s*)?(family_route|clarify_signal)[:：]/i.test(trimmed)) {
      continue;
    }

    if (!skippingVisualAnchors && /^(视觉锚点|visual anchors?)[:：]?$/i.test(trimmed)) {
      skippingVisualAnchors = true;
      continue;
    }

    if (skippingVisualAnchors) {
      if (!trimmed) {
        skippingVisualAnchors = false;
        continue;
      }
      if (/^[-*]\s*/.test(trimmed)) {
        continue;
      }
      skippingVisualAnchors = false;
    }

    result.push(line);
  }

  return result.join('\n');
}

function buildPriorityScenarioFamilyTextHaystack(input: {
  requestInput: string;
  targetUrl: string;
  scenarioCard: unknown;
  description: string;
}): string {
  const scenarioCard = normalizeScenarioCard(input.scenarioCard);
  const steps = Array.isArray(scenarioCard?.flowDefinition?.steps) ? scenarioCard?.flowDefinition?.steps || [] : [];

  return [
    stripStructuredFamilySignalSections(input.requestInput),
    input.targetUrl,
    stripStructuredFamilySignalSections(input.description),
    typeof scenarioCard?.title === 'string' ? scenarioCard.title : '',
    typeof scenarioCard?.featureDescription === 'string' ? scenarioCard.featureDescription : '',
    ...steps.flatMap((step) =>
      step && typeof step === 'object' && !Array.isArray(step)
        ? [
            String((step as { title?: unknown }).title || ''),
            String((step as { target?: unknown }).target || ''),
            String((step as { instruction?: unknown }).instruction || ''),
            String((step as { expectedResult?: unknown }).expectedResult || ''),
          ]
        : []
    ),
  ].join('\n');
}

function buildPriorityScenarioFamilyVisualHaystack(input: {
  visualAnchors?: unknown;
  scenarioCard: unknown;
}): string {
  const scenarioCard = normalizeScenarioCard(input.scenarioCard);
  return normalizeStringArray([
    ...normalizeStringArray(input.visualAnchors),
    ...normalizeStringArray(scenarioCard?.visualAnchors),
  ]).join('\n');
}

function classifyPriorityScenarioFamilyFromHaystack(haystack: string): IntentE2EPriorityScenarioFamily {
  const normalizedHaystack = String(haystack || '').trim();
  if (!normalizedHaystack) return 'untracked';

  const hasBusiness = /(商机|business)/i.test(normalizedHaystack);
  const hasCreateVerb = /(新建|新增|提交|submit|createbusiness|create business|business create|创建(?!的|人))/i.test(
    normalizedHaystack
  );
  const hasOrderFlow = /(createorder|生成订单|转订单|订单信息|orderid|订单id|订单号)/i.test(normalizedHaystack);
  const hasSearch = /(搜索|检索|查询|search)/i.test(normalizedHaystack);
  const hasListSurface = /(列表|表格|table|list)/i.test(normalizedHaystack);
  const hasModal = /(drawer|modal|抽屉|弹窗|弹框|弹层|对话框)/i.test(normalizedHaystack);
  const hasSaveAction = /(保存|提交|确定|save|submit|confirm)/i.test(normalizedHaystack);
  const hasCloseState = /(关闭|消失|closed|close)/i.test(normalizedHaystack);
  const hasSuccessState = /(保存成功|提交成功|success)/i.test(normalizedHaystack);
  const hasBusinessCreateSurface =
    /(新建商机|创建商机|新增商机|createbusiness|create business|business create|商机创建页|商机创建|保存成功后|新建记录)/i.test(
      normalizedHaystack
    ) ||
    (hasBusiness && hasCreateVerb);
  const hasBusinessListVerifySurface =
    /(回列表|商机列表|列表中状态|新入库|列表可见|记录存在|命中目标记录|主键回查|businessid|商机id|详情回退)/i.test(
      normalizedHaystack
    );
  const hasDetailEntry = /(进入详情|打开详情|查看详情|详情页|详情抽屉|详情弹窗|详情弹层|detail)/i.test(normalizedHaystack);
  const hasRowActionMenu =
    /(行操作|操作菜单|更多操作|操作列|末列操作|三点菜单|更多菜单|dropdown|ellipsis|下拉菜单)/i.test(normalizedHaystack);
  const hasRowActionTarget = /(查看|编辑|删除|启用|禁用|生成订单|详情|action)/i.test(normalizedHaystack);
  const hasOwnershipSwitch =
    /(我创建的|我跟进的|归属视角|归属范围|切换归属|切换视角|切换视图|视角切换|ownership|switch.*ownership|switch.*view)/i.test(
      normalizedHaystack
    );

  if (hasOrderFlow && (hasBusiness || /crmapi\/business/i.test(normalizedHaystack))) {
    return 'business_to_order';
  }
  if (hasBusiness && hasBusinessCreateSurface && hasBusinessListVerifySurface) {
    return 'business_create_list_verify';
  }
  if (hasModal && hasSaveAction && (hasCloseState || hasSuccessState)) {
    return 'modal_or_drawer_save';
  }
  if (hasOwnershipSwitch && hasListSurface && !hasBusinessCreateSurface) {
    return 'list_ownership_switch';
  }
  if (hasRowActionMenu && hasListSurface && hasRowActionTarget && !hasBusinessCreateSurface) {
    return 'row_action_menu';
  }
  if (
    hasSearch &&
    hasListSurface &&
    hasDetailEntry &&
    !hasSaveAction &&
    !hasBusinessCreateSurface &&
    !hasRowActionMenu
  ) {
    return 'list_search_detail';
  }

  return 'untracked';
}

export function formatIntentE2EPriorityScenarioFamilyLabel(family: IntentE2EPriorityScenarioFamily): string {
  switch (family) {
    case 'business_create_list_verify':
      return '创建后回列表验收';
    case 'business_to_order':
      return '创建后转订单';
    case 'list_search_detail':
      return '列表搜索详情';
    case 'modal_or_drawer_save':
      return '弹层/抽屉保存';
    case 'row_action_menu':
      return '行操作菜单';
    case 'list_ownership_switch':
      return '列表归属切换';
    default:
      return '未收口 family';
  }
}

export function resolveIntentE2EPriorityScenarioFamilyRoute(input: {
  requestInput: string;
  targetUrl: string;
  scenarioCard: unknown;
  description: string;
  visualAnchors?: unknown;
}): IntentE2EPriorityScenarioFamilyRoute {
  const textFamily = classifyPriorityScenarioFamilyFromHaystack(buildPriorityScenarioFamilyTextHaystack(input));
  const visualFamily = classifyPriorityScenarioFamilyFromHaystack(
    buildPriorityScenarioFamilyVisualHaystack({
      scenarioCard: input.scenarioCard,
      visualAnchors: input.visualAnchors,
    })
  );

  if (textFamily !== 'untracked' && visualFamily !== 'untracked' && textFamily === visualFamily) {
    return {
      family: textFamily,
      textFamily,
      visualFamily,
      source: 'text_confirmed_by_visual',
      clarifySignals: [],
    };
  }

  if (textFamily === 'untracked' && visualFamily !== 'untracked') {
    return {
      family: visualFamily,
      textFamily,
      visualFamily,
      source: 'visual_anchor_salvaged',
      clarifySignals: [],
    };
  }

  if (textFamily !== 'untracked' && visualFamily !== 'untracked' && textFamily !== visualFamily) {
    return {
      family: textFamily,
      textFamily,
      visualFamily,
      source: 'text_only',
      clarifySignals: [
        `文本更像“${formatIntentE2EPriorityScenarioFamilyLabel(textFamily)}”，但视觉锚点更像“${formatIntentE2EPriorityScenarioFamilyLabel(
          visualFamily
        )}”；当前先按文本 family 继续规划，如需真正转成 needs_clarify，应由 launch decision 统一消费。`,
      ],
    };
  }

  return {
    family: textFamily,
    textFamily,
    visualFamily,
    source: 'text_only',
    clarifySignals: [],
  };
}

export function classifyIntentE2EPriorityScenarioFamily(input: {
  requestInput: string;
  targetUrl: string;
  scenarioCard: unknown;
  description: string;
  visualAnchors?: unknown;
}): IntentE2EPriorityScenarioFamily {
  return resolveIntentE2EPriorityScenarioFamilyRoute(input).family;
}

export function normalizeIntentE2EPriorityScenarioFamily(
  value: unknown
): IntentE2EPriorityScenarioFamily | '' {
  return value === 'business_create_list_verify' ||
    value === 'business_to_order' ||
    value === 'list_search_detail' ||
    value === 'modal_or_drawer_save' ||
    value === 'row_action_menu' ||
    value === 'list_ownership_switch' ||
    value === 'untracked'
    ? value
    : '';
}

export function getIntentE2EPriorityScenarioFamilyAssetProfile(
  family?: IntentE2EPriorityScenarioFamily
): IntentE2EPriorityScenarioFamilyAssetProfile | null {
  if (!family || family === 'untracked') return null;

  const profile = PRIORITY_SCENARIO_FAMILY_ASSET_PROFILES[family];
  if (!profile) return null;

  return {
    family: profile.family,
    preferredCapabilitySlugs: cloneStringArray(profile.preferredCapabilitySlugs),
    preferredRecipeSlugs: cloneStringArray(profile.preferredRecipeSlugs),
    executionRules: cloneStringArray(profile.executionRules),
    preferredPrimitives: cloneStringArray(profile.preferredPrimitives),
    outputContract: cloneStringArray(profile.outputContract),
    stableIdentifier: {
      primaryVariables: cloneStringArray(profile.stableIdentifier.primaryVariables),
      fallbackVariables: cloneStringArray(profile.stableIdentifier.fallbackVariables),
      responsePathHints: cloneStringArray(profile.stableIdentifier.responsePathHints),
      detailFieldLabels: cloneStringArray(profile.stableIdentifier.detailFieldLabels),
      ...(profile.stableIdentifier.listResponseUrlIncludes
        ? { listResponseUrlIncludes: profile.stableIdentifier.listResponseUrlIncludes }
        : {}),
      ...(profile.stableIdentifier.detailUrlTemplate ? { detailUrlTemplate: profile.stableIdentifier.detailUrlTemplate } : {}),
      ...(profile.stableIdentifier.detailTitleIncludes
        ? { detailTitleIncludes: profile.stableIdentifier.detailTitleIncludes }
        : {}),
    },
    verifier: {
      requiredEvidence: cloneStringArray(profile.verifier.requiredEvidence),
      policyNotes: cloneStringArray(profile.verifier.policyNotes),
      expectedFieldLabels: cloneStringArray(profile.verifier.expectedFieldLabels),
      ...(profile.verifier.detailEntry
        ? {
            detailEntry: {
              ...(profile.verifier.detailEntry.trigger ? { trigger: profile.verifier.detailEntry.trigger } : {}),
              ...(profile.verifier.detailEntry.actionLabel ? { actionLabel: profile.verifier.detailEntry.actionLabel } : {}),
              ...(profile.verifier.detailEntry.target ? { target: profile.verifier.detailEntry.target } : {}),
              ...(profile.verifier.detailEntry.urlIncludes ? { urlIncludes: profile.verifier.detailEntry.urlIncludes } : {}),
            },
          }
        : {}),
    },
    readiness: {
      requirements: cloneStringArray(profile.readiness.requirements),
      fixtureContract: profile.readiness.fixtureContract,
      notes: cloneStringArray(profile.readiness.notes),
    },
  };
}
