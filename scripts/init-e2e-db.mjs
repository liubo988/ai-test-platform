import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import mysql from 'mysql2/promise';

function must(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

const schemaPath = path.join(process.cwd(), 'scripts', 'e2e-platform-schema.sql');
const LEGACY_PROJECT_UID = 'proj_legacy_default';

function normalizeModuleName(value) {
  const raw = `${value || ''}`.trim();
  return raw || '通用模块';
}

function legacyModuleUid(projectUid, moduleName) {
  const hash = createHash('sha1').update(`${projectUid}:${moduleName}`).digest('hex').slice(0, 12);
  return `mod_legacy_${hash}`;
}

async function main() {
  const sql = await fs.readFile(schemaPath, 'utf8');
  const connection = await mysql.createConnection({
    host: must('DB_HOST'),
    user: must('DB_USER'),
    password: must('DB_PASSWORD'),
    database: must('DB_NAME'),
    port: Number(process.env.DB_PORT || 3306),
    multipleStatements: true,
    charset: 'utf8mb4',
  });

  try {
    await connection.query(sql);
    await ensureProjectTables(connection);
    await ensureModuleTables(connection);
    await ensureConfigurationColumns(connection);
    await ensureDerivedProjectColumns(connection);
    await ensureIndexes(connection);
    await migrateLegacyData(connection);
    console.log('E2E platform schema initialized.');
  } finally {
    await connection.end();
  }
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.tables
     WHERE table_schema = ? AND table_name = ?`,
    [must('DB_NAME'), tableName]
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [must('DB_NAME'), tableName, columnName]
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
}

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.statistics
     WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
    [must('DB_NAME'), tableName, indexName]
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
}

async function addColumnIfMissing(connection, tableName, columnName, ddl) {
  const exists = await columnExists(connection, tableName, columnName);
  if (!exists) {
    await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${ddl}`);
  }
}

async function addIndexIfMissing(connection, tableName, indexName, ddl) {
  const exists = await indexExists(connection, tableName, indexName);
  if (!exists) {
    await connection.query(`ALTER TABLE ${tableName} ADD ${ddl}`);
  }
}

async function ensureProjectTables(connection) {
  const hasProjects = await tableExists(connection, 'test_projects');
  if (!hasProjects) {
    await connection.query(`
      CREATE TABLE test_projects (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        project_uid VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        cover_image_url TEXT NULL,
        auth_required TINYINT(1) NOT NULL DEFAULT 0,
        login_url TEXT NULL,
        login_username VARCHAR(255) NULL,
        login_password_enc TEXT NULL,
        login_description TEXT NULL,
        status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_test_projects_uid (project_uid),
        KEY idx_test_projects_status_updated (status, updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    return;
  }

  await addColumnIfMissing(connection, 'test_projects', 'description', `description TEXT NOT NULL`);
  await addColumnIfMissing(connection, 'test_projects', 'cover_image_url', `cover_image_url TEXT NULL`);
  await addColumnIfMissing(connection, 'test_projects', 'auth_required', `auth_required TINYINT(1) NOT NULL DEFAULT 0`);
  await addColumnIfMissing(connection, 'test_projects', 'login_url', `login_url TEXT NULL`);
  await addColumnIfMissing(connection, 'test_projects', 'login_username', `login_username VARCHAR(255) NULL`);
  await addColumnIfMissing(connection, 'test_projects', 'login_password_enc', `login_password_enc TEXT NULL`);
  await addColumnIfMissing(connection, 'test_projects', 'login_description', `login_description TEXT NULL`);
  await addColumnIfMissing(connection, 'test_projects', 'status', `status ENUM('active', 'archived') NOT NULL DEFAULT 'active'`);
}

async function ensureModuleTables(connection) {
  const hasModules = await tableExists(connection, 'test_modules');
  if (!hasModules) {
    await connection.query(`
      CREATE TABLE test_modules (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        module_uid VARCHAR(64) NOT NULL,
        project_uid VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        sort_order INT NOT NULL DEFAULT 100,
        status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_test_modules_uid (module_uid),
        KEY idx_test_modules_project_sort (project_uid, status, sort_order, updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    return;
  }

  await addColumnIfMissing(connection, 'test_modules', 'description', `description TEXT NULL`);
  await addColumnIfMissing(connection, 'test_modules', 'sort_order', `sort_order INT NOT NULL DEFAULT 100`);
  await addColumnIfMissing(connection, 'test_modules', 'status', `status ENUM('active', 'archived') NOT NULL DEFAULT 'active'`);
}

async function ensureConfigurationColumns(connection) {
  await addColumnIfMissing(connection, 'test_configurations', 'project_uid', `project_uid VARCHAR(64) NULL AFTER config_uid`);
  await addColumnIfMissing(connection, 'test_configurations', 'module_uid', `module_uid VARCHAR(64) NULL AFTER project_uid`);
  await addColumnIfMissing(connection, 'test_configurations', 'sort_order', `sort_order INT NOT NULL DEFAULT 100 AFTER module_uid`);
  await addColumnIfMissing(connection, 'test_configurations', 'module_name', `module_name VARCHAR(128) NOT NULL DEFAULT 'general' AFTER sort_order`);
}

async function ensureDerivedProjectColumns(connection) {
  await addColumnIfMissing(connection, 'test_plans', 'project_uid', `project_uid VARCHAR(64) NULL AFTER plan_uid`);
  await addColumnIfMissing(connection, 'test_plan_cases', 'project_uid', `project_uid VARCHAR(64) NULL AFTER case_uid`);
  await addColumnIfMissing(connection, 'test_executions', 'project_uid', `project_uid VARCHAR(64) NULL AFTER config_uid`);
  await addColumnIfMissing(connection, 'llm_conversations', 'project_uid', `project_uid VARCHAR(64) NULL AFTER conversation_uid`);
  await addColumnIfMissing(connection, 'execution_stream_events', 'project_uid', `project_uid VARCHAR(64) NULL AFTER execution_uid`);
  await addColumnIfMissing(connection, 'execution_artifacts', 'project_uid', `project_uid VARCHAR(64) NULL AFTER execution_uid`);
}

async function ensureIndexes(connection) {
  await addIndexIfMissing(
    connection,
    'test_modules',
    'idx_test_modules_project_sort',
    `INDEX idx_test_modules_project_sort (project_uid, status, sort_order, updated_at)`
  );
  await addIndexIfMissing(
    connection,
    'test_configurations',
    'idx_test_configurations_project_module',
    `INDEX idx_test_configurations_project_module (project_uid, module_uid, status, sort_order)`
  );
  await addIndexIfMissing(
    connection,
    'test_plans',
    'idx_test_plans_project_config_version',
    `INDEX idx_test_plans_project_config_version (project_uid, config_uid, plan_version)`
  );
  await addIndexIfMissing(
    connection,
    'test_executions',
    'idx_test_executions_project_created',
    `INDEX idx_test_executions_project_created (project_uid, created_at)`
  );
  await addIndexIfMissing(
    connection,
    'llm_conversations',
    'idx_llm_conversations_project_scene_ref_time',
    `INDEX idx_llm_conversations_project_scene_ref_time (project_uid, scene, ref_uid, created_at)`
  );
  await addIndexIfMissing(
    connection,
    'execution_stream_events',
    'idx_execution_stream_events_project_execution_time',
    `INDEX idx_execution_stream_events_project_execution_time (project_uid, execution_uid, created_at)`
  );
  await addIndexIfMissing(
    connection,
    'execution_artifacts',
    'idx_execution_artifacts_project_execution_time',
    `INDEX idx_execution_artifacts_project_execution_time (project_uid, execution_uid, created_at)`
  );
}

async function ensureLegacyProject(connection) {
  const [rows] = await connection.query(
    `SELECT project_uid
     FROM test_projects
     WHERE project_uid = ?
     LIMIT 1`,
    [LEGACY_PROJECT_UID]
  );

  if (rows?.[0]?.project_uid) return LEGACY_PROJECT_UID;

  await connection.query(
    `INSERT INTO test_projects
      (project_uid, name, description, cover_image_url, auth_required, login_url, login_username, login_password_enc, login_description, status)
     VALUES (?, '历史迁移项目', '系统自动迁移的历史测试任务集合。建议后续按真实业务拆分为独立项目。', NULL, 0, NULL, NULL, NULL, NULL, 'active')`,
    [LEGACY_PROJECT_UID]
  );

  return LEGACY_PROJECT_UID;
}

async function ensureLegacyModules(connection, projectUid) {
  const [rows] = await connection.query(
    `SELECT DISTINCT COALESCE(NULLIF(TRIM(module_name), ''), '通用模块') AS module_name
     FROM test_configurations`
  );

  for (const row of rows) {
    const moduleName = normalizeModuleName(row.module_name);
    const moduleUid = legacyModuleUid(projectUid, moduleName);

    await connection.query(
      `INSERT INTO test_modules
        (module_uid, project_uid, name, description, sort_order, status)
       VALUES (?, ?, ?, '由历史数据迁移自动生成', 100, 'active')
       ON DUPLICATE KEY UPDATE name = VALUES(name), project_uid = VALUES(project_uid)`,
      [moduleUid, projectUid, moduleName]
    );
  }
}

async function migrateLegacyData(connection) {
  const [configCountRows] = await connection.query(`SELECT COUNT(*) AS total FROM test_configurations`);
  const totalConfigs = Number(configCountRows?.[0]?.total || 0);
  if (totalConfigs === 0) return;

  const legacyProjectUid = await ensureLegacyProject(connection);
  await ensureLegacyModules(connection, legacyProjectUid);

  await connection.query(
    `UPDATE test_configurations
     SET project_uid = ?
     WHERE project_uid IS NULL OR project_uid = ''`,
    [legacyProjectUid]
  );

  const [configs] = await connection.query(
    `SELECT config_uid, project_uid, COALESCE(NULLIF(TRIM(module_name), ''), '通用模块') AS module_name
     FROM test_configurations
     WHERE module_uid IS NULL OR module_uid = ''`
  );

  for (const row of configs) {
    const projectUid = row.project_uid || legacyProjectUid;
    const moduleName = normalizeModuleName(row.module_name);
    const moduleUid = legacyModuleUid(projectUid, moduleName);

    await connection.query(
      `INSERT INTO test_modules
        (module_uid, project_uid, name, description, sort_order, status)
       VALUES (?, ?, ?, '由历史数据迁移自动生成', 100, 'active')
       ON DUPLICATE KEY UPDATE name = VALUES(name), project_uid = VALUES(project_uid)`,
      [moduleUid, projectUid, moduleName]
    );

    await connection.query(
      `UPDATE test_configurations
       SET module_uid = ?, module_name = ?
       WHERE config_uid = ?`,
      [moduleUid, moduleName, row.config_uid]
    );
  }

  await connection.query(
    `UPDATE test_plans p
     JOIN test_configurations c ON c.config_uid = p.config_uid
     SET p.project_uid = c.project_uid
     WHERE p.project_uid IS NULL OR p.project_uid = ''`
  );

  await connection.query(
    `UPDATE test_plan_cases pc
     JOIN test_plans p ON p.plan_uid = pc.plan_uid
     SET pc.project_uid = p.project_uid
     WHERE pc.project_uid IS NULL OR pc.project_uid = ''`
  );

  await connection.query(
    `UPDATE test_executions e
     JOIN test_configurations c ON c.config_uid = e.config_uid
     SET e.project_uid = c.project_uid
     WHERE e.project_uid IS NULL OR e.project_uid = ''`
  );

  await connection.query(
    `UPDATE llm_conversations lc
     JOIN test_configurations c ON c.config_uid = lc.ref_uid
     SET lc.project_uid = c.project_uid
     WHERE lc.scene = 'plan_generation' AND (lc.project_uid IS NULL OR lc.project_uid = '')`
  );

  await connection.query(
    `UPDATE llm_conversations lc
     JOIN test_executions e ON e.execution_uid = lc.ref_uid
     SET lc.project_uid = e.project_uid
     WHERE lc.scene = 'plan_execution' AND (lc.project_uid IS NULL OR lc.project_uid = '')`
  );

  await connection.query(
    `UPDATE execution_stream_events ev
     JOIN test_executions e ON e.execution_uid = ev.execution_uid
     SET ev.project_uid = e.project_uid
     WHERE ev.project_uid IS NULL OR ev.project_uid = ''`
  );

  await connection.query(
    `UPDATE execution_artifacts ar
     JOIN test_executions e ON e.execution_uid = ar.execution_uid
     SET ar.project_uid = e.project_uid
     WHERE ar.project_uid IS NULL OR ar.project_uid = ''`
  );

  await connection.query(`UPDATE test_configurations SET project_uid = ? WHERE project_uid IS NULL OR project_uid = ''`, [legacyProjectUid]);
  await connection.query(`UPDATE test_plans SET project_uid = ? WHERE project_uid IS NULL OR project_uid = ''`, [legacyProjectUid]);
  await connection.query(`UPDATE test_plan_cases SET project_uid = ? WHERE project_uid IS NULL OR project_uid = ''`, [legacyProjectUid]);
  await connection.query(`UPDATE test_executions SET project_uid = ? WHERE project_uid IS NULL OR project_uid = ''`, [legacyProjectUid]);
  await connection.query(`UPDATE llm_conversations SET project_uid = ? WHERE project_uid IS NULL OR project_uid = ''`, [legacyProjectUid]);
  await connection.query(`UPDATE execution_stream_events SET project_uid = ? WHERE project_uid IS NULL OR project_uid = ''`, [legacyProjectUid]);
  await connection.query(`UPDATE execution_artifacts SET project_uid = ? WHERE project_uid IS NULL OR project_uid = ''`, [legacyProjectUid]);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
