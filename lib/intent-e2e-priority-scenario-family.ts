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
