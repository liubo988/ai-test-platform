import { type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { getDbPool } from './client';
import { decryptSecret, encryptSecret } from './crypto';
import { uid } from './ids';

export type ProjectStatus = 'active' | 'archived';
export type ModuleStatus = 'active' | 'archived';
export type ConfigStatus = 'active' | 'archived';
export type CoverageMode = 'all_tiers';
export type Tier = 'simple' | 'medium' | 'complex';
export type ExecutionStatus = 'queued' | 'running' | 'passed' | 'failed' | 'canceled';
export type AuthSource = 'project' | 'task' | 'none';
export type ProjectMemberRole = 'owner' | 'editor' | 'viewer';
export type ProjectActorRole = ProjectMemberRole | 'none';
export type ProjectActivityEntityType = 'project' | 'module' | 'config' | 'plan' | 'execution' | 'member';

export interface TestProjectInput {
  name: string;
  description: string;
  coverImageUrl?: string;
  authRequired?: boolean;
  loginUrl?: string;
  loginUsername?: string;
  loginPassword?: string;
  loginDescription?: string;
}

export interface TestProjectRecord {
  projectUid: string;
  name: string;
  description: string;
  coverImageUrl: string;
  authRequired: boolean;
  loginUrl: string;
  loginUsername: string;
  loginPasswordMasked: string;
  loginDescription: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  moduleCount: number;
  taskCount: number;
  executionCount: number;
  passedExecutionCount: number;
  failedExecutionCount: number;
  activeExecutionCount: number;
  passRate: number;
  latestExecutionUid: string;
  latestExecutionStatus: string;
  lastExecutionAt: string;
}

export interface WorkspaceUserRecord {
  userUid: string;
  displayName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMemberRecord {
  memberUid: string;
  projectUid: string;
  userUid: string;
  role: ProjectMemberRole;
  displayName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestModuleInput {
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface TestModuleRecord {
  moduleUid: string;
  projectUid: string;
  name: string;
  description: string;
  sortOrder: number;
  status: ModuleStatus;
  taskCount: number;
  executionCount: number;
  passedExecutionCount: number;
  failedExecutionCount: number;
  activeExecutionCount: number;
  passRate: number;
  latestExecutionUid: string;
  latestExecutionStatus: string;
  lastExecutionAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestConfigInput {
  projectUid?: string;
  moduleUid?: string;
  sortOrder?: number;
  name: string;
  targetUrl: string;
  featureDescription: string;
  authRequired?: boolean;
  loginUrl?: string;
  loginUsername?: string;
  loginPassword?: string;
}

export interface TestConfigRecord {
  configUid: string;
  projectUid: string;
  projectName: string;
  moduleUid: string;
  moduleName: string;
  sortOrder: number;
  name: string;
  targetUrl: string;
  featureDescription: string;
  authRequired: boolean;
  authSource: AuthSource;
  loginUrl: string;
  loginUsername: string;
  loginPasswordMasked: string;
  loginDescription: string;
  legacyAuthRequired: boolean;
  legacyLoginUrl: string;
  legacyLoginUsername: string;
  coverageMode: CoverageMode;
  status: ConfigStatus;
  createdAt: string;
  updatedAt: string;
  latestPlanUid: string;
  latestPlanVersion: number;
  latestExecutionUid: string;
  latestExecutionStatus: string;
}

export interface TestPlanInput {
  projectUid: string;
  configUid: string;
  planTitle: string;
  planCode: string;
  planSummary: string;
  generationModel: string;
  generationPrompt: string;
  generatedFiles: Array<{ name: string; content: string; language: string }>;
  tiers: { simple: number; medium: number; complex: number };
}

export interface TestPlanRecord {
  planUid: string;
  projectUid: string;
  configUid: string;
  planTitle: string;
  planVersion: number;
  planCode: string;
  planSummary: string;
  generatedFiles: Array<{ name: string; content: string; language: string }>;
  createdAt: string;
}

export interface PlanCaseInput {
  projectUid: string;
  planUid: string;
  tier: Tier;
  caseName: string;
  caseSteps: unknown;
  expectedResult: string;
  sortOrder: number;
}

export interface LlmConversationInput {
  projectUid: string;
  scene: 'plan_generation' | 'plan_execution';
  refUid: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  messageType: 'thinking' | 'code' | 'status' | 'error';
  content: string;
}

export interface ProjectActivityLogInput {
  projectUid: string;
  entityType: ProjectActivityEntityType;
  entityUid: string;
  actionType: string;
  actorLabel?: string;
  title: string;
  detail?: string;
  meta?: unknown;
}

export interface ProjectActivityLogRecord {
  activityUid: string;
  projectUid: string;
  entityType: ProjectActivityEntityType;
  entityUid: string;
  actionType: string;
  actorLabel: string;
  title: string;
  detail: string;
  meta: unknown;
  createdAt: string;
}

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function maskPassword(raw: string): string {
  if (!raw) return '';
  if (raw.length <= 2) return '**';
  return `${raw.slice(0, 1)}${'*'.repeat(Math.max(2, raw.length - 2))}${raw.slice(-1)}`;
}

function toIso(value: unknown): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function toPercent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

const DEFAULT_WORKSPACE_USER_UID = 'usr_default_owner';
const DEFAULT_WORKSPACE_USER_NAME = '演示管理员';
const DEFAULT_WORKSPACE_USER_EMAIL = 'owner@local.dev';

let projectActivityTableReady: Promise<void> | null = null;
let projectCollaborationTablesReady: Promise<void> | null = null;

async function ensureProjectActivityLogTable(): Promise<void> {
  if (!projectActivityTableReady) {
    projectActivityTableReady = (async () => {
      const pool = getDbPool();
      await pool.query(`
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
    })().catch((error) => {
      projectActivityTableReady = null;
      throw error;
    });
  }

  return projectActivityTableReady;
}

async function ensureProjectCollaborationTables(): Promise<void> {
  if (!projectCollaborationTablesReady) {
    projectCollaborationTablesReady = (async () => {
      const pool = getDbPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS workspace_users (
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
      await pool.query(`
        CREATE TABLE IF NOT EXISTS project_members (
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
      await pool.execute<ResultSetHeader>(
        `INSERT INTO workspace_users (user_uid, display_name, email)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           display_name = VALUES(display_name),
           email = VALUES(email)`,
        [DEFAULT_WORKSPACE_USER_UID, DEFAULT_WORKSPACE_USER_NAME, DEFAULT_WORKSPACE_USER_EMAIL]
      );

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT p.project_uid
         FROM test_projects p
         LEFT JOIN project_members pm
           ON pm.project_uid = p.project_uid AND pm.role = 'owner'
         WHERE pm.member_uid IS NULL`
      );

      for (const row of rows) {
        await pool.execute<ResultSetHeader>(
          `INSERT INTO project_members (member_uid, project_uid, user_uid, role)
           VALUES (?, ?, ?, 'owner')
           ON DUPLICATE KEY UPDATE role = VALUES(role)`,
          [uid('mem'), String(row.project_uid), DEFAULT_WORKSPACE_USER_UID]
        );
      }
    })().catch((error) => {
      projectCollaborationTablesReady = null;
      throw error;
    });
  }

  return projectCollaborationTablesReady;
}

function roleLabel(role: ProjectMemberRole): string {
  switch (role) {
    case 'owner':
      return '负责人';
    case 'editor':
      return '编辑者';
    case 'viewer':
      return '查看者';
    default:
      return role;
  }
}

function normalizeProjectRow(row: RowDataPacket): TestProjectRecord {
  const password = decryptSecret((row.login_password_enc as string | null) ?? null);
  const executionCount = Number(row.execution_count || 0);
  const passedExecutionCount = Number(row.passed_execution_count || 0);
  return {
    projectUid: String(row.project_uid),
    name: String(row.name),
    description: row.description ? String(row.description) : '',
    coverImageUrl: row.cover_image_url ? String(row.cover_image_url) : '',
    authRequired: !!row.auth_required,
    loginUrl: row.login_url ? String(row.login_url) : '',
    loginUsername: row.login_username ? String(row.login_username) : '',
    loginPasswordMasked: maskPassword(password),
    loginDescription: row.login_description ? String(row.login_description) : '',
    status: row.status as ProjectStatus,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    moduleCount: Number(row.module_count || 0),
    taskCount: Number(row.task_count || 0),
    executionCount,
    passedExecutionCount,
    failedExecutionCount: Number(row.failed_execution_count || 0),
    activeExecutionCount: Number(row.active_execution_count || 0),
    passRate: toPercent(passedExecutionCount, executionCount),
    latestExecutionUid: row.latest_execution_uid ? String(row.latest_execution_uid) : '',
    latestExecutionStatus: row.latest_execution_status ? String(row.latest_execution_status) : '',
    lastExecutionAt: toIso(row.last_execution_at),
  };
}

function normalizeModuleRow(row: RowDataPacket): TestModuleRecord {
  const executionCount = Number(row.execution_count || 0);
  const passedExecutionCount = Number(row.passed_execution_count || 0);
  return {
    moduleUid: String(row.module_uid),
    projectUid: String(row.project_uid),
    name: String(row.name),
    description: row.description ? String(row.description) : '',
    sortOrder: Number(row.sort_order || 100),
    status: row.status as ModuleStatus,
    taskCount: Number(row.task_count || 0),
    executionCount,
    passedExecutionCount,
    failedExecutionCount: Number(row.failed_execution_count || 0),
    activeExecutionCount: Number(row.active_execution_count || 0),
    passRate: toPercent(passedExecutionCount, executionCount),
    latestExecutionUid: row.latest_execution_uid ? String(row.latest_execution_uid) : '',
    latestExecutionStatus: row.latest_execution_status ? String(row.latest_execution_status) : '',
    lastExecutionAt: toIso(row.last_execution_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function resolveAuthFromRow(row: RowDataPacket): {
  source: AuthSource;
  authRequired: boolean;
  loginUrl: string;
  loginUsername: string;
  loginPasswordPlain: string;
  loginDescription: string;
} {
  const projectPassword = decryptSecret((row.project_login_password_enc as string | null) ?? null);
  const legacyPassword = decryptSecret((row.login_password_enc as string | null) ?? null);

  if (!!row.project_auth_required) {
    return {
      source: 'project',
      authRequired: true,
      loginUrl: row.project_login_url ? String(row.project_login_url) : '',
      loginUsername: row.project_login_username ? String(row.project_login_username) : '',
      loginPasswordPlain: projectPassword,
      loginDescription: row.project_login_description ? String(row.project_login_description) : '',
    };
  }

  if (!!row.auth_required) {
    return {
      source: 'task',
      authRequired: true,
      loginUrl: row.login_url ? String(row.login_url) : '',
      loginUsername: row.login_username ? String(row.login_username) : '',
      loginPasswordPlain: legacyPassword,
      loginDescription: '',
    };
  }

  return {
    source: 'none',
    authRequired: false,
    loginUrl: '',
    loginUsername: '',
    loginPasswordPlain: '',
    loginDescription: '',
  };
}

function normalizeConfigRow(row: RowDataPacket): TestConfigRecord {
  const resolvedAuth = resolveAuthFromRow(row);

  return {
    configUid: String(row.config_uid),
    projectUid: row.project_uid ? String(row.project_uid) : '',
    projectName: row.project_name ? String(row.project_name) : '',
    moduleUid: row.module_uid ? String(row.module_uid) : '',
    moduleName: row.module_display_name ? String(row.module_display_name) : row.module_name ? String(row.module_name) : 'general',
    sortOrder: Number(row.sort_order || 100),
    name: String(row.name),
    targetUrl: String(row.target_url),
    featureDescription: String(row.feature_description),
    authRequired: resolvedAuth.authRequired,
    authSource: resolvedAuth.source,
    loginUrl: resolvedAuth.loginUrl,
    loginUsername: resolvedAuth.loginUsername,
    loginPasswordMasked: maskPassword(resolvedAuth.loginPasswordPlain),
    loginDescription: resolvedAuth.loginDescription,
    legacyAuthRequired: !!row.auth_required,
    legacyLoginUrl: row.login_url ? String(row.login_url) : '',
    legacyLoginUsername: row.login_username ? String(row.login_username) : '',
    coverageMode: row.coverage_mode as CoverageMode,
    status: row.status as ConfigStatus,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    latestPlanUid: row.latest_plan_uid ? String(row.latest_plan_uid) : '',
    latestPlanVersion: Number(row.latest_plan_version || 0),
    latestExecutionUid: row.latest_execution_uid ? String(row.latest_execution_uid) : '',
    latestExecutionStatus: row.latest_execution_status ? String(row.latest_execution_status) : '',
  };
}

function normalizePlanRow(row: RowDataPacket): TestPlanRecord {
  return {
    planUid: String(row.plan_uid),
    projectUid: row.project_uid ? String(row.project_uid) : '',
    configUid: String(row.config_uid),
    planTitle: String(row.plan_title),
    planVersion: Number(row.plan_version),
    planCode: String(row.plan_code),
    planSummary: row.plan_summary ? String(row.plan_summary) : '',
    generatedFiles: safeJsonParse<Array<{ name: string; content: string; language: string }>>(row.generated_files_json, []),
    createdAt: toIso(row.created_at),
  };
}

function normalizeProjectActivityRow(row: RowDataPacket): ProjectActivityLogRecord {
  return {
    activityUid: String(row.activity_uid),
    projectUid: String(row.project_uid),
    entityType: row.entity_type as ProjectActivityEntityType,
    entityUid: String(row.entity_uid),
    actionType: String(row.action_type),
    actorLabel: row.actor_label ? String(row.actor_label) : 'system',
    title: String(row.title),
    detail: row.detail ? String(row.detail) : '',
    meta: safeJsonParse<unknown>(row.meta, {}),
    createdAt: toIso(row.created_at),
  };
}

function normalizeWorkspaceUserRow(row: RowDataPacket): WorkspaceUserRecord {
  return {
    userUid: String(row.user_uid),
    displayName: String(row.display_name),
    email: String(row.email),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function normalizeProjectMemberRow(row: RowDataPacket): ProjectMemberRecord {
  return {
    memberUid: String(row.member_uid),
    projectUid: String(row.project_uid),
    userUid: String(row.user_uid),
    role: row.role as ProjectMemberRole,
    displayName: String(row.display_name),
    email: String(row.email),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

async function lookupExecutionProjectUid(executionUid: string): Promise<string> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT project_uid FROM test_executions WHERE execution_uid = ? LIMIT 1`,
    [executionUid]
  );
  return rows[0]?.project_uid ? String(rows[0].project_uid) : '';
}

async function getWorkspaceUserByUid(userUid: string): Promise<WorkspaceUserRecord | null> {
  await ensureProjectCollaborationTables();
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT user_uid, display_name, email, created_at, updated_at
     FROM workspace_users
     WHERE user_uid = ?
     LIMIT 1`,
    [userUid]
  );
  const row = rows[0];
  return row ? normalizeWorkspaceUserRow(row) : null;
}

async function getWorkspaceUserByEmail(email: string): Promise<WorkspaceUserRecord | null> {
  await ensureProjectCollaborationTables();
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT user_uid, display_name, email, created_at, updated_at
     FROM workspace_users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );
  const row = rows[0];
  return row ? normalizeWorkspaceUserRow(row) : null;
}

async function upsertWorkspaceUser(displayName: string, email: string): Promise<WorkspaceUserRecord> {
  await ensureProjectCollaborationTables();
  const pool = getDbPool();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedDisplayName = displayName.trim();
  const existing = await getWorkspaceUserByEmail(normalizedEmail);

  if (existing) {
    if (existing.displayName !== normalizedDisplayName) {
      await pool.execute<ResultSetHeader>(
        `UPDATE workspace_users
         SET display_name = ?
         WHERE user_uid = ?`,
        [normalizedDisplayName, existing.userUid]
      );
    }
    const row = await getWorkspaceUserByUid(existing.userUid);
    if (!row) throw new Error('更新成员失败');
    return row;
  }

  const userUid = uid('usr');
  await pool.execute<ResultSetHeader>(
    `INSERT INTO workspace_users (user_uid, display_name, email)
     VALUES (?, ?, ?)`,
    [userUid, normalizedDisplayName, normalizedEmail]
  );
  const row = await getWorkspaceUserByUid(userUid);
  if (!row) throw new Error('创建成员失败');
  return row;
}

async function countProjectOwners(projectUid: string): Promise<number> {
  await ensureProjectCollaborationTables();
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt
     FROM project_members
     WHERE project_uid = ? AND role = 'owner'`,
    [projectUid]
  );
  return Number(rows[0]?.cnt || 0);
}

async function ensureProjectNameAvailable(name: string, excludeProjectUid = ''): Promise<void> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT project_uid
     FROM test_projects
     WHERE status = 'active'
       AND name = ?
       AND (? = '' OR project_uid <> ?)
     LIMIT 1`,
    [name, excludeProjectUid, excludeProjectUid]
  );
  if (rows[0]?.project_uid) {
    throw new Error('项目名称已存在');
  }
}

async function ensureModuleNameAvailable(projectUid: string, name: string, excludeModuleUid = ''): Promise<void> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT module_uid
     FROM test_modules
     WHERE project_uid = ?
       AND name = ?
       AND (? = '' OR module_uid <> ?)
     LIMIT 1`,
    [projectUid, name, excludeModuleUid, excludeModuleUid]
  );
  if (rows[0]?.module_uid) {
    throw new Error('模块名称已存在');
  }
}

async function requireProject(projectUid: string) {
  const project = await getProjectByUid(projectUid);
  if (!project || project.status !== 'active') {
    throw new Error('项目不存在或已归档');
  }
  return project;
}

async function requireModule(moduleUid: string) {
  const module = await getModuleByUid(moduleUid);
  if (!module || module.status !== 'active') {
    throw new Error('模块不存在或已归档');
  }
  return module;
}

export async function listProjects(params: { keyword?: string; status?: ProjectStatus; page?: number; pageSize?: number }) {
  const pool = getDbPool();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const offset = (page - 1) * pageSize;
  const status = params.status || 'active';
  const keyword = (params.keyword || '').trim();

  const where: string[] = ['p.status = ?'];
  const args: unknown[] = [status];

  if (keyword) {
    const like = `%${keyword}%`;
    where.push('(p.name LIKE ? OR p.description LIKE ?)');
    args.push(like, like);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      p.*,
      (
        SELECT COUNT(*)
        FROM test_modules m
        WHERE m.project_uid = p.project_uid AND m.status = p.status
      ) AS module_count,
      (
        SELECT COUNT(*)
        FROM test_configurations c
        WHERE c.project_uid = p.project_uid AND c.status = p.status
      ) AS task_count,
      (
        SELECT COUNT(*)
        FROM test_executions e
        WHERE e.project_uid = p.project_uid
      ) AS execution_count,
      (
        SELECT COUNT(*)
        FROM test_executions e
        WHERE e.project_uid = p.project_uid AND e.status = 'passed'
      ) AS passed_execution_count,
      (
        SELECT COUNT(*)
        FROM test_executions e
        WHERE e.project_uid = p.project_uid AND e.status = 'failed'
      ) AS failed_execution_count,
      (
        SELECT COUNT(*)
        FROM test_executions e
        WHERE e.project_uid = p.project_uid AND e.status IN ('queued', 'running')
      ) AS active_execution_count,
      (
        SELECT e.execution_uid
        FROM test_executions e
        WHERE e.project_uid = p.project_uid
        ORDER BY e.created_at DESC
        LIMIT 1
      ) AS latest_execution_uid,
      (
        SELECT e.status
        FROM test_executions e
        WHERE e.project_uid = p.project_uid
        ORDER BY e.created_at DESC
        LIMIT 1
      ) AS latest_execution_status,
      (
        SELECT e.created_at
        FROM test_executions e
        WHERE e.project_uid = p.project_uid
        ORDER BY e.created_at DESC
        LIMIT 1
      ) AS last_execution_at
     FROM test_projects p
     ${whereSql}
     ORDER BY p.updated_at DESC, p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...args, pageSize, offset]
  );

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM test_projects p ${whereSql}`,
    args
  );

  return {
    page,
    pageSize,
    total: Number(countRows[0]?.total || 0),
    items: rows.map(normalizeProjectRow),
  };
}

export async function getProjectByUid(projectUid: string): Promise<(TestProjectRecord & { loginPasswordPlain: string }) | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      p.*,
      (
        SELECT COUNT(*)
        FROM test_modules m
        WHERE m.project_uid = p.project_uid AND m.status = p.status
      ) AS module_count,
      (
        SELECT COUNT(*)
        FROM test_configurations c
        WHERE c.project_uid = p.project_uid AND c.status = p.status
      ) AS task_count,
      (
        SELECT COUNT(*)
        FROM test_executions e
        WHERE e.project_uid = p.project_uid
      ) AS execution_count,
      (
        SELECT COUNT(*)
        FROM test_executions e
        WHERE e.project_uid = p.project_uid AND e.status = 'passed'
      ) AS passed_execution_count,
      (
        SELECT COUNT(*)
        FROM test_executions e
        WHERE e.project_uid = p.project_uid AND e.status = 'failed'
      ) AS failed_execution_count,
      (
        SELECT COUNT(*)
        FROM test_executions e
        WHERE e.project_uid = p.project_uid AND e.status IN ('queued', 'running')
      ) AS active_execution_count,
      (
        SELECT e.execution_uid
        FROM test_executions e
        WHERE e.project_uid = p.project_uid
        ORDER BY e.created_at DESC
        LIMIT 1
      ) AS latest_execution_uid,
      (
        SELECT e.status
        FROM test_executions e
        WHERE e.project_uid = p.project_uid
        ORDER BY e.created_at DESC
        LIMIT 1
      ) AS latest_execution_status,
      (
        SELECT e.created_at
        FROM test_executions e
        WHERE e.project_uid = p.project_uid
        ORDER BY e.created_at DESC
        LIMIT 1
      ) AS last_execution_at
     FROM test_projects p
     WHERE p.project_uid = ?
     LIMIT 1`,
    [projectUid]
  );
  const row = rows[0];
  if (!row) return null;

  const password = decryptSecret((row.login_password_enc as string | null) ?? null);
  return {
    ...normalizeProjectRow(row),
    loginPasswordPlain: password,
  };
}

export async function ensureWorkspaceActor(userUid = ''): Promise<WorkspaceUserRecord> {
  await ensureProjectCollaborationTables();
  if (userUid.trim()) {
    const existing = await getWorkspaceUserByUid(userUid.trim());
    if (existing) return existing;
  }

  const fallback = await getWorkspaceUserByUid(DEFAULT_WORKSPACE_USER_UID);
  if (!fallback) {
    throw new Error('默认操作者不存在');
  }
  return fallback;
}

export async function listProjectMembers(projectUid: string): Promise<ProjectMemberRecord[]> {
  await ensureProjectCollaborationTables();
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      pm.member_uid,
      pm.project_uid,
      pm.user_uid,
      pm.role,
      u.display_name,
      u.email,
      pm.created_at,
      pm.updated_at
     FROM project_members pm
     JOIN workspace_users u ON u.user_uid = pm.user_uid
     WHERE pm.project_uid = ?
     ORDER BY FIELD(pm.role, 'owner', 'editor', 'viewer'), pm.created_at ASC, pm.id ASC`,
    [projectUid]
  );

  return rows.map(normalizeProjectMemberRow);
}

export async function getProjectMemberByUserUid(projectUid: string, userUid: string): Promise<ProjectMemberRecord | null> {
  await ensureProjectCollaborationTables();
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      pm.member_uid,
      pm.project_uid,
      pm.user_uid,
      pm.role,
      u.display_name,
      u.email,
      pm.created_at,
      pm.updated_at
     FROM project_members pm
     JOIN workspace_users u ON u.user_uid = pm.user_uid
     WHERE pm.project_uid = ? AND pm.user_uid = ?
     LIMIT 1`,
    [projectUid, userUid]
  );

  const row = rows[0];
  return row ? normalizeProjectMemberRow(row) : null;
}

export async function getProjectMemberByUid(memberUid: string): Promise<ProjectMemberRecord | null> {
  await ensureProjectCollaborationTables();
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      pm.member_uid,
      pm.project_uid,
      pm.user_uid,
      pm.role,
      u.display_name,
      u.email,
      pm.created_at,
      pm.updated_at
     FROM project_members pm
     JOIN workspace_users u ON u.user_uid = pm.user_uid
     WHERE pm.member_uid = ?
     LIMIT 1`,
    [memberUid]
  );

  const row = rows[0];
  return row ? normalizeProjectMemberRow(row) : null;
}

export async function getProjectActorRole(projectUid: string, userUid: string): Promise<ProjectActorRole> {
  const member = await getProjectMemberByUserUid(projectUid, userUid);
  return member?.role || 'none';
}

export async function ensureProjectOwnerMembership(projectUid: string, userUid: string): Promise<ProjectMemberRecord> {
  await ensureProjectCollaborationTables();
  const project = await getProjectByUid(projectUid);
  if (!project) throw new Error('项目不存在');

  const actor = await ensureWorkspaceActor(userUid);
  const existing = await getProjectMemberByUserUid(projectUid, actor.userUid);
  const pool = getDbPool();

  if (existing) {
    if (existing.role !== 'owner') {
      await pool.execute<ResultSetHeader>(
        `UPDATE project_members
         SET role = 'owner'
         WHERE member_uid = ?`,
        [existing.memberUid]
      );
      const row = await getProjectMemberByUid(existing.memberUid);
      if (!row) throw new Error('更新负责人失败');
      return row;
    }
    return existing;
  }

  const memberUid = uid('mem');
  await pool.execute<ResultSetHeader>(
    `INSERT INTO project_members (member_uid, project_uid, user_uid, role)
     VALUES (?, ?, ?, 'owner')`,
    [memberUid, projectUid, actor.userUid]
  );
  const row = await getProjectMemberByUid(memberUid);
  if (!row) throw new Error('绑定项目负责人失败');
  return row;
}

export async function addProjectMember(
  projectUid: string,
  input: { displayName: string; email: string; role: ProjectMemberRole },
  options?: { actorLabel?: string }
): Promise<ProjectMemberRecord> {
  await ensureProjectCollaborationTables();
  const project = await getProjectByUid(projectUid);
  if (!project) throw new Error('项目不存在');

  const displayName = input.displayName.trim();
  const email = input.email.trim().toLowerCase();
  if (!displayName || !email) {
    throw new Error('请填写完整的成员姓名和邮箱');
  }

  const user = await upsertWorkspaceUser(displayName, email);
  const existing = await getProjectMemberByUserUid(projectUid, user.userUid);
  if (existing) {
    throw new Error('该成员已经在项目中');
  }

  const pool = getDbPool();
  const memberUid = uid('mem');
  await pool.execute<ResultSetHeader>(
    `INSERT INTO project_members (member_uid, project_uid, user_uid, role)
     VALUES (?, ?, ?, ?)`,
    [memberUid, projectUid, user.userUid, input.role]
  );

  const row = await getProjectMemberByUid(memberUid);
  if (!row) throw new Error('添加成员失败');
  await insertProjectActivityLog({
    projectUid,
    entityType: 'member',
    entityUid: row.memberUid,
    actionType: 'member_added',
    actorLabel: options?.actorLabel,
    title: `添加成员「${row.displayName}」`,
    detail: `已将成员加入项目，并授予 ${roleLabel(row.role)} 权限。`,
    meta: {
      userUid: row.userUid,
      email: row.email,
      role: row.role,
    },
  });
  return row;
}

export async function updateProjectMemberRole(
  memberUid: string,
  role: ProjectMemberRole,
  options?: { actorLabel?: string }
): Promise<ProjectMemberRecord> {
  await ensureProjectCollaborationTables();
  const member = await getProjectMemberByUid(memberUid);
  if (!member) throw new Error('成员不存在');
  if (member.role === role) return member;

  if (member.role === 'owner' && role !== 'owner') {
    const ownerCount = await countProjectOwners(member.projectUid);
    if (ownerCount <= 1) {
      throw new Error('项目至少需要保留一位负责人');
    }
  }

  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `UPDATE project_members
     SET role = ?
     WHERE member_uid = ?`,
    [role, memberUid]
  );

  const row = await getProjectMemberByUid(memberUid);
  if (!row) throw new Error('更新成员角色失败');
  await insertProjectActivityLog({
    projectUid: row.projectUid,
    entityType: 'member',
    entityUid: row.memberUid,
    actionType: 'member_role_updated',
    actorLabel: options?.actorLabel,
    title: `调整成员「${row.displayName}」权限`,
    detail: `权限由 ${roleLabel(member.role)} 调整为 ${roleLabel(row.role)}。`,
    meta: {
      userUid: row.userUid,
      previousRole: member.role,
      currentRole: row.role,
    },
  });
  return row;
}

export async function removeProjectMember(memberUid: string, options?: { actorLabel?: string }): Promise<void> {
  await ensureProjectCollaborationTables();
  const member = await getProjectMemberByUid(memberUid);
  if (!member) throw new Error('成员不存在');

  if (member.role === 'owner') {
    const ownerCount = await countProjectOwners(member.projectUid);
    if (ownerCount <= 1) {
      throw new Error('项目至少需要保留一位负责人');
    }
  }

  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(`DELETE FROM project_members WHERE member_uid = ?`, [memberUid]);
  await insertProjectActivityLog({
    projectUid: member.projectUid,
    entityType: 'member',
    entityUid: member.memberUid,
    actionType: 'member_removed',
    actorLabel: options?.actorLabel,
    title: `移除成员「${member.displayName}」`,
    detail: `成员已从项目移除，原角色为 ${roleLabel(member.role)}。`,
    meta: {
      userUid: member.userUid,
      email: member.email,
      role: member.role,
    },
  });
}

export async function createTestProject(
  input: TestProjectInput,
  options?: { actorLabel?: string; actorUserUid?: string }
): Promise<TestProjectRecord> {
  const pool = getDbPool();
  const projectUid = uid('proj');
  const name = input.name.trim();
  const authRequired = !!input.authRequired;

  await ensureProjectNameAvailable(name);

  await pool.execute<ResultSetHeader>(
    `INSERT INTO test_projects
      (project_uid, name, description, cover_image_url, auth_required, login_url, login_username, login_password_enc, login_description, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [
      projectUid,
      name,
      input.description.trim(),
      input.coverImageUrl?.trim() || null,
      authRequired ? 1 : 0,
      authRequired ? (input.loginUrl?.trim() || null) : null,
      authRequired ? (input.loginUsername?.trim() || null) : null,
      authRequired ? encryptSecret(input.loginPassword || '') : null,
      authRequired ? (input.loginDescription?.trim() || null) : null,
    ]
  );

  const row = await getProjectByUid(projectUid);
  if (!row) throw new Error('创建项目失败');
  await ensureProjectOwnerMembership(projectUid, options?.actorUserUid || DEFAULT_WORKSPACE_USER_UID);
  await insertProjectActivityLog({
    projectUid,
    entityType: 'project',
    entityUid: projectUid,
    actionType: 'project_created',
    actorLabel: options?.actorLabel,
    title: `创建项目「${row.name}」`,
    detail: row.description || '已创建新的测试项目。',
    meta: {
      status: row.status,
      authRequired: row.authRequired,
    },
  });
  return row;
}

export async function updateTestProject(projectUid: string, input: TestProjectInput, options?: { actorLabel?: string }): Promise<TestProjectRecord> {
  const pool = getDbPool();
  const existing = await getProjectByUid(projectUid);
  if (!existing) throw new Error('项目不存在');

  const name = input.name.trim();
  const authRequired = !!input.authRequired;

  await ensureProjectNameAvailable(name, projectUid);

  const encryptedPassword = authRequired ? encryptSecret(input.loginPassword || existing.loginPasswordPlain) : null;

  await pool.execute<ResultSetHeader>(
    `UPDATE test_projects
     SET name = ?,
         description = ?,
         cover_image_url = ?,
         auth_required = ?,
         login_url = ?,
         login_username = ?,
         login_password_enc = ?,
         login_description = ?
     WHERE project_uid = ?`,
    [
      name,
      input.description.trim(),
      input.coverImageUrl?.trim() || null,
      authRequired ? 1 : 0,
      authRequired ? (input.loginUrl?.trim() || null) : null,
      authRequired ? (input.loginUsername?.trim() || null) : null,
      encryptedPassword,
      authRequired ? (input.loginDescription?.trim() || null) : null,
      projectUid,
    ]
  );

  const row = await getProjectByUid(projectUid);
  if (!row) throw new Error('更新项目失败');
  await insertProjectActivityLog({
    projectUid,
    entityType: 'project',
    entityUid: projectUid,
    actionType: 'project_updated',
    actorLabel: options?.actorLabel,
    title: `更新项目「${row.name}」`,
    detail: existing.name !== row.name ? `项目名称由「${existing.name}」更新为「${row.name}」。` : '已更新项目配置。',
    meta: {
      previousName: existing.name,
      currentName: row.name,
      authRequired: row.authRequired,
    },
  });
  return row;
}

export async function archiveTestProject(projectUid: string, options?: { actorLabel?: string }): Promise<void> {
  const pool = getDbPool();
  const existing = await getProjectByUid(projectUid);
  if (!existing) throw new Error('项目不存在');
  await pool.execute<ResultSetHeader>(`UPDATE test_projects SET status = 'archived' WHERE project_uid = ?`, [projectUid]);
  await pool.execute<ResultSetHeader>(`UPDATE test_modules SET status = 'archived' WHERE project_uid = ?`, [projectUid]);
  await pool.execute<ResultSetHeader>(`UPDATE test_configurations SET status = 'archived' WHERE project_uid = ?`, [projectUid]);
  await insertProjectActivityLog({
    projectUid,
    entityType: 'project',
    entityUid: projectUid,
    actionType: 'project_archived',
    actorLabel: options?.actorLabel,
    title: `归档项目「${existing.name}」`,
    detail: `项目及其下属 ${existing.moduleCount} 个模块、${existing.taskCount} 个任务已归档。`,
    meta: {
      moduleCount: existing.moduleCount,
      taskCount: existing.taskCount,
    },
  });
}

export async function restoreTestProject(projectUid: string, options?: { actorLabel?: string }): Promise<void> {
  const pool = getDbPool();
  const project = await getProjectByUid(projectUid);
  if (!project) throw new Error('项目不存在');

  await pool.execute<ResultSetHeader>(`UPDATE test_projects SET status = 'active' WHERE project_uid = ?`, [projectUid]);
  await pool.execute<ResultSetHeader>(`UPDATE test_modules SET status = 'active' WHERE project_uid = ?`, [projectUid]);
  await pool.execute<ResultSetHeader>(`UPDATE test_configurations SET status = 'active' WHERE project_uid = ?`, [projectUid]);
  await insertProjectActivityLog({
    projectUid,
    entityType: 'project',
    entityUid: projectUid,
    actionType: 'project_restored',
    actorLabel: options?.actorLabel,
    title: `恢复项目「${project.name}」`,
    detail: `项目及其下属 ${project.moduleCount} 个模块、${project.taskCount} 个任务已恢复。`,
    meta: {
      moduleCount: project.moduleCount,
      taskCount: project.taskCount,
    },
  });
}

export async function listModulesByProject(projectUid: string, params?: { status?: ModuleStatus | 'all' }): Promise<TestModuleRecord[]> {
  const pool = getDbPool();
  const status = params?.status || 'active';

  const where: string[] = ['m.project_uid = ?'];
  const args: unknown[] = [projectUid];

  if (status !== 'all') {
    where.push('m.status = ?');
    args.push(status);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      m.*,
      (
        SELECT COUNT(*)
        FROM test_configurations c
        WHERE c.module_uid = m.module_uid AND c.status = m.status
      ) AS task_count,
      (
        SELECT COUNT(*)
        FROM test_executions e
        JOIN test_configurations c ON c.config_uid = e.config_uid
        WHERE c.module_uid = m.module_uid
      ) AS execution_count,
      (
        SELECT COUNT(*)
        FROM test_executions e
        JOIN test_configurations c ON c.config_uid = e.config_uid
        WHERE c.module_uid = m.module_uid AND e.status = 'passed'
      ) AS passed_execution_count,
      (
        SELECT COUNT(*)
        FROM test_executions e
        JOIN test_configurations c ON c.config_uid = e.config_uid
        WHERE c.module_uid = m.module_uid AND e.status = 'failed'
      ) AS failed_execution_count,
      (
        SELECT COUNT(*)
        FROM test_executions e
        JOIN test_configurations c ON c.config_uid = e.config_uid
        WHERE c.module_uid = m.module_uid AND e.status IN ('queued', 'running')
      ) AS active_execution_count,
      (
        SELECT e.execution_uid
        FROM test_executions e
        JOIN test_configurations c ON c.config_uid = e.config_uid
        WHERE c.module_uid = m.module_uid
        ORDER BY e.created_at DESC
        LIMIT 1
      ) AS latest_execution_uid,
      (
        SELECT e.status
        FROM test_executions e
        JOIN test_configurations c ON c.config_uid = e.config_uid
        WHERE c.module_uid = m.module_uid
        ORDER BY e.created_at DESC
        LIMIT 1
      ) AS latest_execution_status,
      (
        SELECT e.created_at
        FROM test_executions e
        JOIN test_configurations c ON c.config_uid = e.config_uid
        WHERE c.module_uid = m.module_uid
        ORDER BY e.created_at DESC
        LIMIT 1
      ) AS last_execution_at
     FROM test_modules m
     WHERE ${where.join(' AND ')}
     ORDER BY m.sort_order ASC, m.updated_at DESC`,
    args
  );

  return rows.map(normalizeModuleRow);
}

export async function getModuleByUid(moduleUid: string): Promise<TestModuleRecord | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      m.*,
      (
        SELECT COUNT(*)
        FROM test_configurations c
        WHERE c.module_uid = m.module_uid AND c.status = m.status
      ) AS task_count,
      (
        SELECT COUNT(*)
        FROM test_executions e
        JOIN test_configurations c ON c.config_uid = e.config_uid
        WHERE c.module_uid = m.module_uid
      ) AS execution_count,
      (
        SELECT COUNT(*)
        FROM test_executions e
        JOIN test_configurations c ON c.config_uid = e.config_uid
        WHERE c.module_uid = m.module_uid AND e.status = 'passed'
      ) AS passed_execution_count,
      (
        SELECT COUNT(*)
        FROM test_executions e
        JOIN test_configurations c ON c.config_uid = e.config_uid
        WHERE c.module_uid = m.module_uid AND e.status = 'failed'
      ) AS failed_execution_count,
      (
        SELECT COUNT(*)
        FROM test_executions e
        JOIN test_configurations c ON c.config_uid = e.config_uid
        WHERE c.module_uid = m.module_uid AND e.status IN ('queued', 'running')
      ) AS active_execution_count,
      (
        SELECT e.execution_uid
        FROM test_executions e
        JOIN test_configurations c ON c.config_uid = e.config_uid
        WHERE c.module_uid = m.module_uid
        ORDER BY e.created_at DESC
        LIMIT 1
      ) AS latest_execution_uid,
      (
        SELECT e.status
        FROM test_executions e
        JOIN test_configurations c ON c.config_uid = e.config_uid
        WHERE c.module_uid = m.module_uid
        ORDER BY e.created_at DESC
        LIMIT 1
      ) AS latest_execution_status,
      (
        SELECT e.created_at
        FROM test_executions e
        JOIN test_configurations c ON c.config_uid = e.config_uid
        WHERE c.module_uid = m.module_uid
        ORDER BY e.created_at DESC
        LIMIT 1
      ) AS last_execution_at
     FROM test_modules m
     WHERE m.module_uid = ?
     LIMIT 1`,
    [moduleUid]
  );

  const row = rows[0];
  if (!row) return null;
  return normalizeModuleRow(row);
}

export async function createTestModule(projectUid: string, input: TestModuleInput, options?: { actorLabel?: string }): Promise<TestModuleRecord> {
  const pool = getDbPool();
  const moduleUid = uid('mod');
  const name = input.name.trim();

  await requireProject(projectUid);
  await ensureModuleNameAvailable(projectUid, name);

  await pool.execute<ResultSetHeader>(
    `INSERT INTO test_modules
      (module_uid, project_uid, name, description, sort_order, status)
     VALUES (?, ?, ?, ?, ?, 'active')`,
    [
      moduleUid,
      projectUid,
      name,
      input.description?.trim() || null,
      Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 100,
    ]
  );

  const row = await getModuleByUid(moduleUid);
  if (!row) throw new Error('创建模块失败');
  await insertProjectActivityLog({
    projectUid,
    entityType: 'module',
    entityUid: row.moduleUid,
    actionType: 'module_created',
    actorLabel: options?.actorLabel,
    title: `创建模块「${row.name}」`,
    detail: row.description || `已新增模块，排序号 ${row.sortOrder}。`,
    meta: {
      status: row.status,
      sortOrder: row.sortOrder,
    },
  });
  return row;
}

export async function updateTestModule(moduleUid: string, input: TestModuleInput, options?: { actorLabel?: string }): Promise<TestModuleRecord> {
  const pool = getDbPool();
  const existing = await getModuleByUid(moduleUid);
  if (!existing) throw new Error('模块不存在');

  const name = input.name.trim();
  await requireProject(existing.projectUid);
  await ensureModuleNameAvailable(existing.projectUid, name, moduleUid);

  await pool.execute<ResultSetHeader>(
    `UPDATE test_modules
     SET name = ?, description = ?, sort_order = ?
     WHERE module_uid = ?`,
    [
      name,
      input.description?.trim() || null,
      Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : existing.sortOrder,
      moduleUid,
    ]
  );

  await pool.execute<ResultSetHeader>(
    `UPDATE test_configurations
     SET module_name = ?
     WHERE module_uid = ?`,
    [name, moduleUid]
  );

  const row = await getModuleByUid(moduleUid);
  if (!row) throw new Error('更新模块失败');
  const detailParts: string[] = [];
  if (existing.name !== row.name) {
    detailParts.push(`模块名称由「${existing.name}」更新为「${row.name}」`);
  }
  if (existing.sortOrder !== row.sortOrder) {
    detailParts.push(`排序号由 ${existing.sortOrder} 调整为 ${row.sortOrder}`);
  }
  await insertProjectActivityLog({
    projectUid: row.projectUid,
    entityType: 'module',
    entityUid: row.moduleUid,
    actionType: 'module_updated',
    actorLabel: options?.actorLabel,
    title: `更新模块「${row.name}」`,
    detail: detailParts.length > 0 ? `${detailParts.join('；')}。` : '已更新模块配置。',
    meta: {
      previousName: existing.name,
      currentName: row.name,
      previousSortOrder: existing.sortOrder,
      currentSortOrder: row.sortOrder,
    },
  });
  return row;
}

export async function archiveTestModule(moduleUid: string, options?: { actorLabel?: string }): Promise<void> {
  const pool = getDbPool();
  const module = await getModuleByUid(moduleUid);
  if (!module) throw new Error('模块不存在');
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM test_configurations WHERE module_uid = ? AND status = 'active'`,
    [moduleUid]
  );
  if (Number(rows[0]?.cnt) > 0) {
    throw new Error('该模块下还有任务，请先删除或移动任务后再归档模块');
  }
  await pool.execute<ResultSetHeader>(`UPDATE test_modules SET status = 'archived' WHERE module_uid = ?`, [moduleUid]);
  await insertProjectActivityLog({
    projectUid: module.projectUid,
    entityType: 'module',
    entityUid: module.moduleUid,
    actionType: 'module_archived',
    actorLabel: options?.actorLabel,
    title: `归档模块「${module.name}」`,
    detail: '模块已归档，当前无启用中的测试任务。',
    meta: {
      taskCount: module.taskCount,
    },
  });
}

export async function restoreTestModule(moduleUid: string, options?: { actorLabel?: string }): Promise<void> {
  const pool = getDbPool();
  const module = await getModuleByUid(moduleUid);
  if (!module) throw new Error('模块不存在');

  const project = await getProjectByUid(module.projectUid);
  if (!project || project.status !== 'active') {
    throw new Error('请先恢复所属项目');
  }

  await pool.execute<ResultSetHeader>(`UPDATE test_modules SET status = 'active' WHERE module_uid = ?`, [moduleUid]);
  await pool.execute<ResultSetHeader>(`UPDATE test_configurations SET status = 'active' WHERE module_uid = ?`, [moduleUid]);
  await insertProjectActivityLog({
    projectUid: module.projectUid,
    entityType: 'module',
    entityUid: module.moduleUid,
    actionType: 'module_restored',
    actorLabel: options?.actorLabel,
    title: `恢复模块「${module.name}」`,
    detail: `模块及其下属 ${module.taskCount} 个任务已恢复。`,
    meta: {
      taskCount: module.taskCount,
    },
  });
}

export async function listTestConfigs(params: {
  keyword?: string;
  status?: ConfigStatus | 'all';
  page?: number;
  pageSize?: number;
  projectUid?: string;
  moduleUid?: string;
}) {
  const pool = getDbPool();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const offset = (page - 1) * pageSize;
  const status = params.status || 'active';
  const keyword = (params.keyword || '').trim();

  const where: string[] = [];
  const args: unknown[] = [];

  if (status !== 'all') {
    where.push('c.status = ?');
    args.push(status);
  }

  if (params.projectUid) {
    where.push('c.project_uid = ?');
    args.push(params.projectUid);
  }

  if (params.moduleUid) {
    where.push('c.module_uid = ?');
    args.push(params.moduleUid);
  }

  if (keyword) {
    const like = `%${keyword}%`;
    where.push('(c.name LIKE ? OR m.name LIKE ? OR c.target_url LIKE ? OR c.feature_description LIKE ?)');
    args.push(like, like, like, like);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      c.*,
      m.name AS module_display_name,
      p.name AS project_name,
      p.auth_required AS project_auth_required,
      p.login_url AS project_login_url,
      p.login_username AS project_login_username,
      p.login_password_enc AS project_login_password_enc,
      p.login_description AS project_login_description,
      (
        SELECT p2.plan_uid
        FROM test_plans p2
        WHERE p2.config_uid = c.config_uid
        ORDER BY p2.plan_version DESC
        LIMIT 1
      ) AS latest_plan_uid,
      (
        SELECT p2.plan_version
        FROM test_plans p2
        WHERE p2.config_uid = c.config_uid
        ORDER BY p2.plan_version DESC
        LIMIT 1
      ) AS latest_plan_version,
      (
        SELECT e2.execution_uid
        FROM test_executions e2
        WHERE e2.config_uid = c.config_uid
        ORDER BY e2.created_at DESC
        LIMIT 1
      ) AS latest_execution_uid,
      (
        SELECT e2.status
        FROM test_executions e2
        WHERE e2.config_uid = c.config_uid
        ORDER BY e2.created_at DESC
        LIMIT 1
      ) AS latest_execution_status
     FROM test_configurations c
     LEFT JOIN test_modules m ON m.module_uid = c.module_uid
     LEFT JOIN test_projects p ON p.project_uid = c.project_uid
     ${whereSql}
     ORDER BY c.sort_order ASC, c.updated_at DESC
     LIMIT ? OFFSET ?`,
    [...args, pageSize, offset]
  );

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM test_configurations c
     LEFT JOIN test_modules m ON m.module_uid = c.module_uid
     LEFT JOIN test_projects p ON p.project_uid = c.project_uid
     ${whereSql}`,
    args
  );

  return {
    page,
    pageSize,
    total: Number(countRows[0]?.total || 0),
    items: rows.map(normalizeConfigRow),
  };
}

export async function getTestConfigByUid(configUid: string): Promise<(TestConfigRecord & { loginPasswordPlain: string }) | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      c.*,
      m.name AS module_display_name,
      p.name AS project_name,
      p.auth_required AS project_auth_required,
      p.login_url AS project_login_url,
      p.login_username AS project_login_username,
      p.login_password_enc AS project_login_password_enc,
      p.login_description AS project_login_description,
      (
        SELECT p2.plan_uid
        FROM test_plans p2
        WHERE p2.config_uid = c.config_uid
        ORDER BY p2.plan_version DESC
        LIMIT 1
      ) AS latest_plan_uid,
      (
        SELECT p2.plan_version
        FROM test_plans p2
        WHERE p2.config_uid = c.config_uid
        ORDER BY p2.plan_version DESC
        LIMIT 1
      ) AS latest_plan_version,
      (
        SELECT e2.execution_uid
        FROM test_executions e2
        WHERE e2.config_uid = c.config_uid
        ORDER BY e2.created_at DESC
        LIMIT 1
      ) AS latest_execution_uid,
      (
        SELECT e2.status
        FROM test_executions e2
        WHERE e2.config_uid = c.config_uid
        ORDER BY e2.created_at DESC
        LIMIT 1
      ) AS latest_execution_status
     FROM test_configurations c
     LEFT JOIN test_modules m ON m.module_uid = c.module_uid
     LEFT JOIN test_projects p ON p.project_uid = c.project_uid
     WHERE c.config_uid = ?
     LIMIT 1`,
    [configUid]
  );

  const row = rows[0];
  if (!row) return null;

  const plainPassword = decryptSecret((row.login_password_enc as string | null) ?? null);
  return {
    ...normalizeConfigRow(row),
    loginPasswordPlain: plainPassword,
  };
}

export async function createTestConfig(input: TestConfigInput, options?: { actorLabel?: string }): Promise<TestConfigRecord> {
  const pool = getDbPool();
  const configUid = uid('cfg');
  const projectUid = input.projectUid?.trim();
  const moduleUid = input.moduleUid?.trim();

  if (!projectUid || !moduleUid) {
    throw new Error('创建任务必须指定项目和模块');
  }

  await requireProject(projectUid);
  const module = await requireModule(moduleUid);
  if (module.projectUid !== projectUid) {
    throw new Error('模块不属于当前项目');
  }

  const legacyAuthRequired = !!input.authRequired;
  const encryptedPassword = legacyAuthRequired ? encryptSecret(input.loginPassword || '') : null;

  await pool.execute<ResultSetHeader>(
    `INSERT INTO test_configurations
      (config_uid, project_uid, module_uid, sort_order, module_name, name, target_url, feature_description, auth_required, login_url, login_username, login_password_enc, coverage_mode, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'all_tiers', 'active')`,
    [
      configUid,
      projectUid,
      moduleUid,
      Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 100,
      module.name,
      input.name.trim(),
      input.targetUrl.trim(),
      input.featureDescription.trim(),
      legacyAuthRequired ? 1 : 0,
      legacyAuthRequired ? (input.loginUrl?.trim() || null) : null,
      legacyAuthRequired ? (input.loginUsername?.trim() || null) : null,
      encryptedPassword,
    ]
  );

  const row = await getTestConfigByUid(configUid);
  if (!row) throw new Error('创建任务失败');
  await insertProjectActivityLog({
    projectUid,
    entityType: 'config',
    entityUid: row.configUid,
    actionType: 'config_created',
    actorLabel: options?.actorLabel,
    title: `创建任务「${row.name}」`,
    detail: `归属模块「${row.moduleName}」，目标地址 ${row.targetUrl}。`,
    meta: {
      moduleUid: row.moduleUid,
      moduleName: row.moduleName,
      targetUrl: row.targetUrl,
    },
  });
  return row;
}

export async function updateTestConfig(configUid: string, input: TestConfigInput, options?: { actorLabel?: string }): Promise<TestConfigRecord> {
  const pool = getDbPool();
  const existing = await getTestConfigByUid(configUid);
  if (!existing) throw new Error('任务不存在');

  const nextProjectUid = (input.projectUid || existing.projectUid).trim();
  if (nextProjectUid !== existing.projectUid) {
    throw new Error('暂不支持跨项目移动任务');
  }

  const nextModuleUid = (input.moduleUid || existing.moduleUid).trim();
  const module = await requireModule(nextModuleUid);
  if (module.projectUid !== nextProjectUid) {
    throw new Error('模块不属于当前项目');
  }

  const nextLegacyAuthRequired = input.authRequired ?? existing.legacyAuthRequired;
  const nextLegacyLoginUrl = nextLegacyAuthRequired ? input.loginUrl?.trim() ?? existing.legacyLoginUrl : '';
  const nextLegacyLoginUsername = nextLegacyAuthRequired ? input.loginUsername?.trim() ?? existing.legacyLoginUsername : '';
  const encryptedPassword = nextLegacyAuthRequired ? encryptSecret(input.loginPassword || existing.loginPasswordPlain) : null;

  await pool.execute<ResultSetHeader>(
    `UPDATE test_configurations
     SET project_uid = ?,
         module_uid = ?,
         sort_order = ?,
         module_name = ?,
         name = ?,
         target_url = ?,
         feature_description = ?,
         auth_required = ?,
         login_url = ?,
         login_username = ?,
         login_password_enc = ?
     WHERE config_uid = ?`,
    [
      nextProjectUid,
      nextModuleUid,
      Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : existing.sortOrder,
      module.name,
      input.name.trim(),
      input.targetUrl.trim(),
      input.featureDescription.trim(),
      nextLegacyAuthRequired ? 1 : 0,
      nextLegacyAuthRequired ? (nextLegacyLoginUrl || null) : null,
      nextLegacyAuthRequired ? (nextLegacyLoginUsername || null) : null,
      encryptedPassword,
      configUid,
    ]
  );

  const row = await getTestConfigByUid(configUid);
  if (!row) throw new Error('更新任务失败');
  const detailParts: string[] = [];
  if (existing.name !== row.name) {
    detailParts.push(`任务名称由「${existing.name}」更新为「${row.name}」`);
  }
  if (existing.moduleUid !== row.moduleUid) {
    detailParts.push(`已移动到模块「${row.moduleName}」`);
  }
  if (existing.targetUrl !== row.targetUrl) {
    detailParts.push('已更新目标地址');
  }
  await insertProjectActivityLog({
    projectUid: row.projectUid,
    entityType: 'config',
    entityUid: row.configUid,
    actionType: 'config_updated',
    actorLabel: options?.actorLabel,
    title: `更新任务「${row.name}」`,
    detail: detailParts.length > 0 ? `${detailParts.join('；')}。` : '已更新任务配置。',
    meta: {
      previousName: existing.name,
      currentName: row.name,
      previousModuleUid: existing.moduleUid,
      currentModuleUid: row.moduleUid,
      previousTargetUrl: existing.targetUrl,
      currentTargetUrl: row.targetUrl,
    },
  });
  return row;
}

export async function archiveTestConfig(configUid: string, options?: { actorLabel?: string }): Promise<void> {
  const pool = getDbPool();
  const config = await getTestConfigByUid(configUid);
  if (!config) throw new Error('任务不存在');
  await pool.execute<ResultSetHeader>(`UPDATE test_configurations SET status = 'archived' WHERE config_uid = ?`, [configUid]);
  await insertProjectActivityLog({
    projectUid: config.projectUid,
    entityType: 'config',
    entityUid: config.configUid,
    actionType: 'config_archived',
    actorLabel: options?.actorLabel,
    title: `归档任务「${config.name}」`,
    detail: `任务已从模块「${config.moduleName}」归档。`,
    meta: {
      moduleUid: config.moduleUid,
      moduleName: config.moduleName,
    },
  });
}

export async function restoreTestConfig(configUid: string, options?: { actorLabel?: string }): Promise<void> {
  const pool = getDbPool();
  const config = await getTestConfigByUid(configUid);
  if (!config) throw new Error('任务不存在');

  const project = await getProjectByUid(config.projectUid);
  if (!project || project.status !== 'active') {
    throw new Error('请先恢复所属项目');
  }

  const module = await getModuleByUid(config.moduleUid);
  if (!module || module.status !== 'active') {
    throw new Error('请先恢复所属模块');
  }

  await pool.execute<ResultSetHeader>(`UPDATE test_configurations SET status = 'active' WHERE config_uid = ?`, [configUid]);
  await insertProjectActivityLog({
    projectUid: config.projectUid,
    entityType: 'config',
    entityUid: config.configUid,
    actionType: 'config_restored',
    actorLabel: options?.actorLabel,
    title: `恢复任务「${config.name}」`,
    detail: `任务已恢复到模块「${config.moduleName}」。`,
    meta: {
      moduleUid: config.moduleUid,
      moduleName: config.moduleName,
    },
  });
}

export async function getLatestPlanByConfigUid(configUid: string): Promise<TestPlanRecord | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM test_plans WHERE config_uid = ? ORDER BY plan_version DESC LIMIT 1`,
    [configUid]
  );
  const row = rows[0];
  if (!row) return null;
  return normalizePlanRow(row);
}

export async function createTestPlan(input: TestPlanInput): Promise<TestPlanRecord> {
  const pool = getDbPool();
  const [versionRows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(plan_version), 0) AS max_version FROM test_plans WHERE config_uid = ?`,
    [input.configUid]
  );
  const nextVersion = Number(versionRows[0]?.max_version || 0) + 1;
  const planUid = uid('plan');

  await pool.execute<ResultSetHeader>(
    `INSERT INTO test_plans
      (plan_uid, project_uid, config_uid, plan_title, plan_version, plan_code, plan_summary, tier_simple_count, tier_medium_count, tier_complex_count, generation_model, generation_prompt, generated_files_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      planUid,
      input.projectUid,
      input.configUid,
      input.planTitle,
      nextVersion,
      input.planCode,
      input.planSummary,
      input.tiers.simple,
      input.tiers.medium,
      input.tiers.complex,
      input.generationModel,
      input.generationPrompt,
      JSON.stringify(input.generatedFiles),
    ]
  );

  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM test_plans WHERE plan_uid = ? LIMIT 1`, [planUid]);
  const row = rows[0];
  if (!row) throw new Error('创建测试计划失败');
  return normalizePlanRow(row);
}

export async function createPlanCases(cases: PlanCaseInput[]): Promise<void> {
  if (cases.length === 0) return;
  const pool = getDbPool();
  const values: Array<string | number | null> = [];
  const placeholders: string[] = [];

  for (const item of cases) {
    placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, 1)');
    values.push(
      uid('case'),
      item.projectUid,
      item.planUid,
      item.tier,
      item.caseName,
      JSON.stringify(item.caseSteps || []),
      item.expectedResult,
      item.sortOrder
    );
  }

  await pool.execute<ResultSetHeader>(
    `INSERT INTO test_plan_cases
      (case_uid, project_uid, plan_uid, tier, case_name, case_steps, expected_result, sort_order, enabled)
     VALUES ${placeholders.join(',')}`,
    values
  );
}

export async function listPlanCases(planUid: string): Promise<Array<{ caseUid: string; tier: Tier; caseName: string; caseSteps: unknown; expectedResult: string; enabled: boolean; sortOrder: number }>> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM test_plan_cases WHERE plan_uid = ? ORDER BY sort_order ASC, created_at ASC`,
    [planUid]
  );

  return rows.map((row) => ({
    caseUid: String(row.case_uid),
    tier: row.tier as Tier,
    caseName: String(row.case_name),
    caseSteps: safeJsonParse<unknown>(row.case_steps, []),
    expectedResult: row.expected_result ? String(row.expected_result) : '',
    enabled: !!row.enabled,
    sortOrder: Number(row.sort_order || 0),
  }));
}

export async function createExecution(input: { planUid: string; configUid: string; projectUid: string; workerSessionId: string; triggerSource?: 'manual' | 'api' }) {
  const pool = getDbPool();
  const executionUid = uid('exec');

  await pool.execute<ResultSetHeader>(
    `INSERT INTO test_executions (execution_uid, plan_uid, config_uid, project_uid, trigger_source, status, worker_session_id)
     VALUES (?, ?, ?, ?, ?, 'queued', ?)`,
    [executionUid, input.planUid, input.configUid, input.projectUid, input.triggerSource || 'manual', input.workerSessionId]
  );

  await updateExecutionStatus(executionUid, 'running', { startedAt: new Date() }, input.projectUid);
  return executionUid;
}

export async function findRunningExecution(planUid: string): Promise<string | null> {
  const pool = getDbPool();
  const STALE_MINUTES = 3; // worker 超时 120s + 60s 缓冲

  // 将超时的 running 状态自动标记为 failed
  await pool.execute<ResultSetHeader>(
    `UPDATE test_executions
     SET status = 'failed', error_message = '执行超时：worker 无响应', ended_at = NOW(3)
     WHERE plan_uid = ? AND status = 'running'
       AND started_at < DATE_SUB(NOW(3), INTERVAL ? MINUTE)`,
    [planUid, STALE_MINUTES]
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT execution_uid
     FROM test_executions
     WHERE plan_uid = ? AND status = 'running'
     ORDER BY created_at DESC
     LIMIT 1`,
    [planUid]
  );
  return rows[0]?.execution_uid ? String(rows[0].execution_uid) : null;
}

export async function updateExecutionStatus(
  executionUid: string,
  status: ExecutionStatus,
  extra?: { startedAt?: Date; endedAt?: Date; durationMs?: number; resultSummary?: string; errorMessage?: string },
  projectUid?: string
): Promise<void> {
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `UPDATE test_executions
     SET status = ?,
         started_at = COALESCE(?, started_at),
         ended_at = COALESCE(?, ended_at),
         duration_ms = COALESCE(?, duration_ms),
         result_summary = COALESCE(?, result_summary),
         error_message = COALESCE(?, error_message)
     WHERE execution_uid = ?`,
    [
      status,
      extra?.startedAt || null,
      extra?.endedAt || null,
      extra?.durationMs ?? null,
      extra?.resultSummary || null,
      extra?.errorMessage || null,
      executionUid,
    ]
  );

  const resolvedProjectUid = projectUid || (await lookupExecutionProjectUid(executionUid));
  if (!resolvedProjectUid) return;

  await insertExecutionEvent(
    executionUid,
    'status',
    {
      status,
      at: new Date().toISOString(),
      summary: extra?.resultSummary || '',
    },
    resolvedProjectUid
  );
}

export async function insertExecutionEvent(
  executionUid: string,
  eventType: 'frame' | 'log' | 'step' | 'artifact' | 'status',
  payload: unknown,
  projectUid?: string
): Promise<void> {
  const pool = getDbPool();
  const resolvedProjectUid = projectUid || (await lookupExecutionProjectUid(executionUid));
  if (!resolvedProjectUid) {
    throw new Error('执行记录缺少项目归属，无法写入事件');
  }

  await pool.execute<ResultSetHeader>(
    `INSERT INTO execution_stream_events (execution_uid, project_uid, event_type, payload)
     VALUES (?, ?, ?, ?)`,
    [executionUid, resolvedProjectUid, eventType, JSON.stringify(payload)]
  );
}

export async function listExecutionEvents(executionUid: string): Promise<Array<{ eventType: string; payload: unknown; createdAt: string }>> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT event_type, payload, created_at
     FROM execution_stream_events
     WHERE execution_uid = ?
     ORDER BY created_at ASC, id ASC`,
    [executionUid]
  );

  return rows.map((row) => ({
    eventType: String(row.event_type),
    payload: safeJsonParse<unknown>(row.payload, {}),
    createdAt: toIso(row.created_at),
  }));
}

export async function getExecution(executionUid: string): Promise<{
  executionUid: string;
  planUid: string;
  configUid: string;
  projectUid: string;
  status: ExecutionStatus;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  resultSummary: string;
  errorMessage: string;
  workerSessionId: string;
  createdAt: string;
} | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM test_executions WHERE execution_uid = ? LIMIT 1`,
    [executionUid]
  );
  const row = rows[0];
  if (!row) return null;

  return {
    executionUid: String(row.execution_uid),
    planUid: String(row.plan_uid),
    configUid: String(row.config_uid),
    projectUid: row.project_uid ? String(row.project_uid) : '',
    status: row.status as ExecutionStatus,
    startedAt: toIso(row.started_at),
    endedAt: toIso(row.ended_at),
    durationMs: Number(row.duration_ms || 0),
    resultSummary: row.result_summary ? String(row.result_summary) : '',
    errorMessage: row.error_message ? String(row.error_message) : '',
    workerSessionId: row.worker_session_id ? String(row.worker_session_id) : '',
    createdAt: toIso(row.created_at),
  };
}

export async function listExecutionsByConfigUid(configUid: string, limit = 30): Promise<
  Array<{
    executionUid: string;
    planUid: string;
    projectUid: string;
    status: ExecutionStatus;
    startedAt: string;
    endedAt: string;
    durationMs: number;
    resultSummary: string;
    errorMessage: string;
    workerSessionId: string;
    createdAt: string;
  }>
> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM test_executions WHERE config_uid = ? ORDER BY created_at DESC LIMIT ?`,
    [configUid, Math.max(1, Math.min(100, limit))]
  );

  return rows.map((row) => ({
    executionUid: String(row.execution_uid),
    planUid: String(row.plan_uid),
    projectUid: row.project_uid ? String(row.project_uid) : '',
    status: row.status as ExecutionStatus,
    startedAt: toIso(row.started_at),
    endedAt: toIso(row.ended_at),
    durationMs: Number(row.duration_ms || 0),
    resultSummary: row.result_summary ? String(row.result_summary) : '',
    errorMessage: row.error_message ? String(row.error_message) : '',
    workerSessionId: row.worker_session_id ? String(row.worker_session_id) : '',
    createdAt: toIso(row.created_at),
  }));
}

export async function insertLlmConversation(input: LlmConversationInput): Promise<void> {
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `INSERT INTO llm_conversations (conversation_uid, project_uid, scene, ref_uid, role, message_type, content)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uid('msg'), input.projectUid, input.scene, input.refUid, input.role, input.messageType, input.content]
  );
}

export async function listLlmConversations(scene: 'plan_generation' | 'plan_execution', refUid: string) {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT conversation_uid, role, message_type, content, created_at
     FROM llm_conversations
     WHERE scene = ? AND ref_uid = ?
     ORDER BY created_at ASC, id ASC`,
    [scene, refUid]
  );

  return rows.map((row) => ({
    conversationUid: String(row.conversation_uid),
    role: row.role,
    messageType: row.message_type,
    content: String(row.content),
    createdAt: toIso(row.created_at),
  }));
}

export async function insertProjectActivityLog(input: ProjectActivityLogInput): Promise<void> {
  await ensureProjectActivityLogTable();
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `INSERT INTO project_activity_logs
      (activity_uid, project_uid, entity_type, entity_uid, action_type, actor_label, title, detail, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid('act'),
      input.projectUid,
      input.entityType,
      input.entityUid,
      input.actionType,
      input.actorLabel?.trim() || 'system',
      input.title,
      input.detail?.trim() || null,
      input.meta === undefined ? null : JSON.stringify(input.meta),
    ]
  );
}

export async function listProjectActivityLogs(projectUid: string, limit = 20): Promise<ProjectActivityLogRecord[]> {
  await ensureProjectActivityLogTable();
  const pool = getDbPool();
  const safeLimit = Math.max(1, Math.min(100, limit));
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT activity_uid, project_uid, entity_type, entity_uid, action_type, actor_label, title, detail, meta, created_at
     FROM project_activity_logs
     WHERE project_uid = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [projectUid, safeLimit]
  );

  return rows.map(normalizeProjectActivityRow);
}

export async function getPlanByUid(planUid: string): Promise<TestPlanRecord | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM test_plans WHERE plan_uid = ? LIMIT 1`,
    [planUid]
  );
  const row = rows[0];
  if (!row) return null;
  return normalizePlanRow(row);
}

export async function insertExecutionArtifact(input: {
  executionUid: string;
  projectUid: string;
  artifactType: 'video' | 'screenshot' | 'trace' | 'report' | 'generated_spec';
  storagePath: string;
  meta?: unknown;
}): Promise<void> {
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `INSERT INTO execution_artifacts (execution_uid, project_uid, artifact_type, storage_path, meta)
     VALUES (?, ?, ?, ?, ?)`,
    [input.executionUid, input.projectUid, input.artifactType, input.storagePath, input.meta ? JSON.stringify(input.meta) : null]
  );
}

export async function listExecutionArtifacts(executionUid: string): Promise<Array<{ artifactType: string; storagePath: string; meta: unknown; createdAt: string }>> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT artifact_type, storage_path, meta, created_at
     FROM execution_artifacts
     WHERE execution_uid = ?
     ORDER BY created_at ASC, id ASC`,
    [executionUid]
  );

  return rows.map((row) => ({
    artifactType: String(row.artifact_type),
    storagePath: String(row.storage_path),
    meta: safeJsonParse<unknown>(row.meta, {}),
    createdAt: toIso(row.created_at),
  }));
}
