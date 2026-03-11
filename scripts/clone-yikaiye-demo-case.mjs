import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';

function uid(prefix) {
  return `${prefix}_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

const SOURCE_CONFIG_UID = process.env.SOURCE_CONFIG_UID || 'cfg_1773119051091_babde38c';
const ACTOR_LABEL = 'Codex';

function buildConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    charset: 'utf8mb4',
  });
}

async function getSourceConfig(conn, configUid) {
  const [rows] = await conn.query(
    `SELECT *
     FROM test_configurations
     WHERE config_uid = ? AND status = 'active'
     LIMIT 1`,
    [configUid]
  );
  return rows[0] || null;
}

async function getLatestPlan(conn, configUid) {
  const [rows] = await conn.query(
    `SELECT *
     FROM test_plans
     WHERE config_uid = ?
     ORDER BY plan_version DESC
     LIMIT 1`,
    [configUid]
  );
  return rows[0] || null;
}

async function getPlanCases(conn, planUid) {
  const [rows] = await conn.query(
    `SELECT *
     FROM test_plan_cases
     WHERE plan_uid = ?
     ORDER BY sort_order ASC, created_at ASC`,
    [planUid]
  );
  return rows;
}

async function getNextCopyName(conn, projectUid, moduleUid, sourceName) {
  const [rows] = await conn.query(
    `SELECT name
     FROM test_configurations
     WHERE project_uid = ?
       AND module_uid = ?
       AND status = 'active'
       AND (name = ? OR name LIKE ?)
     ORDER BY created_at ASC`,
    [projectUid, moduleUid, sourceName, `${sourceName}（副本%）`]
  );

  const used = new Set(
    rows
      .map((row) => String(row.name || ''))
      .map((name) => {
        const match = name.match(/（副本(\d+)）$/);
        return match ? Number(match[1]) : 0;
      })
      .filter((n) => Number.isFinite(n))
  );

  let index = 1;
  while (used.has(index)) {
    index += 1;
  }
  return `${sourceName}（副本${index}）`;
}

async function getNextSortOrder(conn, projectUid, moduleUid) {
  const [[row]] = await conn.query(
    `SELECT COALESCE(MAX(sort_order), 0) AS max_sort
     FROM test_configurations
     WHERE project_uid = ? AND module_uid = ?`,
    [projectUid, moduleUid]
  );
  return Number(row.max_sort || 0) + 10;
}

async function insertActivityLog(conn, payload) {
  await conn.execute(
    `INSERT INTO project_activity_logs
      (activity_uid, project_uid, entity_type, entity_uid, action_type, actor_label, title, detail, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid('act'),
      payload.projectUid,
      payload.entityType,
      payload.entityUid,
      payload.actionType,
      ACTOR_LABEL,
      payload.title,
      payload.detail,
      JSON.stringify(payload.meta || {}),
    ]
  );
}

async function main() {
  const conn = await buildConnection();

  try {
    await conn.beginTransaction();

    const sourceConfig = await getSourceConfig(conn, SOURCE_CONFIG_UID);
    if (!sourceConfig) {
      throw new Error(`未找到源任务: ${SOURCE_CONFIG_UID}`);
    }

    const sourcePlan = await getLatestPlan(conn, SOURCE_CONFIG_UID);
    if (!sourcePlan) {
      throw new Error(`源任务没有可复制的最新计划: ${SOURCE_CONFIG_UID}`);
    }

    const sourceCases = await getPlanCases(conn, String(sourcePlan.plan_uid));
    const newTaskName = await getNextCopyName(
      conn,
      String(sourceConfig.project_uid),
      String(sourceConfig.module_uid),
      String(sourceConfig.name)
    );
    const nextSortOrder = await getNextSortOrder(conn, String(sourceConfig.project_uid), String(sourceConfig.module_uid));

    const newConfigUid = uid('cfg');
    await conn.execute(
      `INSERT INTO test_configurations
        (config_uid, project_uid, module_uid, sort_order, module_name, name, target_url, feature_description, task_mode, flow_definition, auth_required, login_url, login_username, login_password_enc, coverage_mode, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newConfigUid,
        sourceConfig.project_uid,
        sourceConfig.module_uid,
        nextSortOrder,
        sourceConfig.module_name,
        newTaskName,
        sourceConfig.target_url,
        sourceConfig.feature_description,
        sourceConfig.task_mode,
        sourceConfig.flow_definition,
        sourceConfig.auth_required,
        sourceConfig.login_url,
        sourceConfig.login_username,
        sourceConfig.login_password_enc,
        sourceConfig.coverage_mode || 'all_tiers',
        sourceConfig.status || 'active',
      ]
    );

    const newPlanUid = uid('plan');
    const newPlanTitle = `${newTaskName} - 演示计划`;
    await conn.execute(
      `INSERT INTO test_plans
        (plan_uid, project_uid, config_uid, plan_title, plan_version, plan_code, plan_summary, tier_simple_count, tier_medium_count, tier_complex_count, generation_model, generation_prompt, generated_files_json)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newPlanUid,
        sourcePlan.project_uid,
        newConfigUid,
        newPlanTitle,
        sourcePlan.plan_code,
        sourcePlan.plan_summary,
        sourcePlan.tier_simple_count,
        sourcePlan.tier_medium_count,
        sourcePlan.tier_complex_count,
        sourcePlan.generation_model || 'manual-copy',
        sourcePlan.generation_prompt,
        sourcePlan.generated_files_json,
      ]
    );

    for (const sourceCase of sourceCases) {
      await conn.execute(
        `INSERT INTO test_plan_cases
          (case_uid, project_uid, plan_uid, tier, case_name, case_steps, expected_result, sort_order, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uid('case'),
          sourceCase.project_uid,
          newPlanUid,
          sourceCase.tier,
          `${String(sourceCase.case_name)}（副本）`,
          sourceCase.case_steps,
          sourceCase.expected_result,
          sourceCase.sort_order,
          sourceCase.enabled,
        ]
      );
    }

    await insertActivityLog(conn, {
      projectUid: String(sourceConfig.project_uid),
      entityType: 'config',
      entityUid: newConfigUid,
      actionType: 'config_created',
      title: `复制任务「${newTaskName}」`,
      detail: `基于任务「${sourceConfig.name}」复制，保留业务流定义和最新通过计划。`,
      meta: {
        sourceConfigUid: sourceConfig.config_uid,
        sourceConfigName: sourceConfig.name,
        moduleUid: sourceConfig.module_uid,
        moduleName: sourceConfig.module_name,
        targetUrl: sourceConfig.target_url,
      },
    });

    await insertActivityLog(conn, {
      projectUid: String(sourceConfig.project_uid),
      entityType: 'plan',
      entityUid: newPlanUid,
      actionType: 'plan_generated',
      title: `复制计划「${newPlanTitle}」`,
      detail: `基于计划「${sourcePlan.plan_title}」复制，包含 ${sourceCases.length} 个计划用例。`,
      meta: {
        sourcePlanUid: sourcePlan.plan_uid,
        sourcePlanTitle: sourcePlan.plan_title,
        sourcePlanVersion: sourcePlan.plan_version,
        copiedCaseCount: sourceCases.length,
      },
    });

    await conn.commit();

    console.log(
      JSON.stringify(
        {
          ok: true,
          sourceConfigUid: String(sourceConfig.config_uid),
          sourceTaskName: String(sourceConfig.name),
          copiedConfigUid: newConfigUid,
          copiedTaskName: newTaskName,
          copiedPlanUid: newPlanUid,
          copiedPlanTitle: newPlanTitle,
          copiedCaseCount: sourceCases.length,
        },
        null,
        2
      )
    );
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
