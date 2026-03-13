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
const DEFAULT_WORKSPACE_USER_UID = 'usr_default_owner';
const DEFAULT_WORKSPACE_USER_NAME = '演示管理员';
const DEFAULT_WORKSPACE_USER_EMAIL = 'owner@local.dev';

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
    await ensureCollaborationTables(connection);
    await ensureModuleTables(connection);
    await ensureConfigurationColumns(connection);
    await ensureDerivedProjectColumns(connection);
    await ensureProjectActivityTables(connection);
    await ensureProjectKnowledgeTables(connection);
    await ensureIndexes(connection);
    await migrateLegacyData(connection);
    await seedDefaultProjectOwners(connection);
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

async function ensureCollaborationTables(connection) {
  const hasUsers = await tableExists(connection, 'workspace_users');
  if (!hasUsers) {
    await connection.query(`
      CREATE TABLE workspace_users (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_uid VARCHAR(64) NOT NULL,
        display_name VARCHAR(128) NOT NULL,
        email VARCHAR(255) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_workspace_users_uid (user_uid),
        UNIQUE KEY uk_workspace_users_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  const hasMembers = await tableExists(connection, 'project_members');
  if (!hasMembers) {
    await connection.query(`
      CREATE TABLE project_members (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        member_uid VARCHAR(64) NOT NULL,
        project_uid VARCHAR(64) NOT NULL,
        user_uid VARCHAR(64) NOT NULL,
        role ENUM('owner', 'editor', 'viewer') NOT NULL DEFAULT 'viewer',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_project_members_uid (member_uid),
        UNIQUE KEY uk_project_members_project_user (project_uid, user_uid),
        KEY idx_project_members_project_role (project_uid, role, created_at),
        KEY idx_project_members_user_project (user_uid, project_uid),
        CONSTRAINT fk_project_members_project_uid FOREIGN KEY (project_uid) REFERENCES test_projects (project_uid)
          ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT fk_project_members_user_uid FOREIGN KEY (user_uid) REFERENCES workspace_users (user_uid)
          ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  await connection.query(
    `INSERT INTO workspace_users (user_uid, display_name, email)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), email = VALUES(email)`,
    [DEFAULT_WORKSPACE_USER_UID, DEFAULT_WORKSPACE_USER_NAME, DEFAULT_WORKSPACE_USER_EMAIL]
  );
}

async function ensureConfigurationColumns(connection) {
  await addColumnIfMissing(connection, 'test_configurations', 'project_uid', `project_uid VARCHAR(64) NULL AFTER config_uid`);
  await addColumnIfMissing(connection, 'test_configurations', 'module_uid', `module_uid VARCHAR(64) NULL AFTER project_uid`);
  await addColumnIfMissing(connection, 'test_configurations', 'sort_order', `sort_order INT NOT NULL DEFAULT 100 AFTER module_uid`);
  await addColumnIfMissing(connection, 'test_configurations', 'module_name', `module_name VARCHAR(128) NOT NULL DEFAULT 'general' AFTER sort_order`);
  await addColumnIfMissing(connection, 'test_configurations', 'task_mode', `task_mode ENUM('page', 'scenario') NOT NULL DEFAULT 'page' AFTER feature_description`);
  await addColumnIfMissing(connection, 'test_configurations', 'flow_definition', `flow_definition JSON NULL AFTER task_mode`);
}

async function ensureDerivedProjectColumns(connection) {
  await addColumnIfMissing(connection, 'test_plans', 'project_uid', `project_uid VARCHAR(64) NULL AFTER plan_uid`);
  await addColumnIfMissing(connection, 'test_plan_cases', 'project_uid', `project_uid VARCHAR(64) NULL AFTER case_uid`);
  await addColumnIfMissing(connection, 'test_executions', 'project_uid', `project_uid VARCHAR(64) NULL AFTER config_uid`);
  await addColumnIfMissing(connection, 'llm_conversations', 'project_uid', `project_uid VARCHAR(64) NULL AFTER conversation_uid`);
  await addColumnIfMissing(connection, 'execution_stream_events', 'project_uid', `project_uid VARCHAR(64) NULL AFTER execution_uid`);
  await addColumnIfMissing(connection, 'execution_artifacts', 'project_uid', `project_uid VARCHAR(64) NULL AFTER execution_uid`);
}

async function ensureProjectActivityTables(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS project_activity_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      activity_uid VARCHAR(64) NOT NULL,
      project_uid VARCHAR(64) NOT NULL,
      entity_type VARCHAR(32) NOT NULL,
      entity_uid VARCHAR(64) NOT NULL,
      action_type VARCHAR(64) NOT NULL,
      actor_label VARCHAR(128) NOT NULL DEFAULT 'system',
      title VARCHAR(255) NOT NULL,
      detail TEXT NULL,
      meta JSON NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uk_project_activity_logs_uid (activity_uid),
      KEY idx_project_activity_logs_project_time (project_uid, created_at),
      CONSTRAINT fk_project_activity_logs_project_uid FOREIGN KEY (project_uid) REFERENCES test_projects (project_uid)
        ON UPDATE CASCADE ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureProjectKnowledgeTables(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS project_knowledge_documents (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      document_uid VARCHAR(64) NOT NULL,
      project_uid VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      source_type ENUM('manual', 'notes', 'execution', 'system') NOT NULL DEFAULT 'manual',
      source_path TEXT NULL,
      source_hash VARCHAR(64) NULL,
      status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
      meta JSON NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uk_project_knowledge_documents_uid (document_uid),
      UNIQUE KEY uk_project_knowledge_documents_project_name (project_uid, name),
      KEY idx_project_knowledge_documents_project_status_updated (project_uid, status, updated_at),
      CONSTRAINT fk_project_knowledge_documents_project_uid FOREIGN KEY (project_uid) REFERENCES test_projects (project_uid)
        ON UPDATE CASCADE ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS project_knowledge_chunks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      chunk_uid VARCHAR(64) NOT NULL,
      document_uid VARCHAR(64) NOT NULL,
      project_uid VARCHAR(64) NOT NULL,
      heading VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      keywords_json JSON NULL,
      source_line_start INT NOT NULL DEFAULT 0,
      source_line_end INT NOT NULL DEFAULT 0,
      token_estimate INT NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      meta JSON NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uk_project_knowledge_chunks_uid (chunk_uid),
      KEY idx_project_knowledge_chunks_project_document_sort (project_uid, document_uid, sort_order),
      CONSTRAINT fk_project_knowledge_chunks_document_uid FOREIGN KEY (document_uid) REFERENCES project_knowledge_documents (document_uid)
        ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT fk_project_knowledge_chunks_project_uid FOREIGN KEY (project_uid) REFERENCES test_projects (project_uid)
        ON UPDATE CASCADE ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS project_capabilities (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      capability_uid VARCHAR(64) NOT NULL,
      project_uid VARCHAR(64) NOT NULL,
      slug VARCHAR(128) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      capability_type ENUM('auth', 'navigation', 'action', 'assertion', 'query', 'composite') NOT NULL,
      entry_url TEXT NULL,
      trigger_phrases_json JSON NULL,
      preconditions_json JSON NULL,
      steps_json JSON NULL,
      assertions_json JSON NULL,
      cleanup_notes TEXT NULL,
      depends_on_json JSON NULL,
      sort_order INT NOT NULL DEFAULT 100,
      status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
      source_document_uid VARCHAR(64) NULL,
      meta JSON NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uk_project_capabilities_uid (capability_uid),
      UNIQUE KEY uk_project_capabilities_project_slug (project_uid, slug),
      KEY idx_project_capabilities_project_status_sort (project_uid, status, sort_order, updated_at),
      CONSTRAINT fk_project_capabilities_project_uid FOREIGN KEY (project_uid) REFERENCES test_projects (project_uid)
        ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT fk_project_capabilities_source_document_uid FOREIGN KEY (source_document_uid) REFERENCES project_knowledge_documents (document_uid)
        ON UPDATE CASCADE ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
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
  await addIndexIfMissing(
    connection,
    'project_activity_logs',
    'idx_project_activity_logs_project_time',
    `INDEX idx_project_activity_logs_project_time (project_uid, created_at)`
  );
  await addIndexIfMissing(
    connection,
    'project_members',
    'idx_project_members_project_role',
    `INDEX idx_project_members_project_role (project_uid, role, created_at)`
  );
  await addIndexIfMissing(
    connection,
    'project_members',
    'idx_project_members_user_project',
    `INDEX idx_project_members_user_project (user_uid, project_uid)`
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

async function seedDefaultProjectOwners(connection) {
  const [rows] = await connection.query(
    `SELECT p.project_uid
     FROM test_projects p
     LEFT JOIN project_members pm
       ON pm.project_uid = p.project_uid AND pm.role = 'owner'
     WHERE pm.member_uid IS NULL`
  );

  for (const row of rows) {
    await connection.query(
      `INSERT INTO project_members
        (member_uid, project_uid, user_uid, role)
       VALUES (?, ?, ?, 'owner')
       ON DUPLICATE KEY UPDATE role = VALUES(role)`,
      [`mem_seed_${row.project_uid}`, row.project_uid, DEFAULT_WORKSPACE_USER_UID]
    );
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
