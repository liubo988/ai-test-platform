import { type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { getDbPool } from './client';
import { decryptSecret, encryptSecret } from './crypto';
import { uid } from './ids';

export type CoverageMode = 'all_tiers';
export type Tier = 'simple' | 'medium' | 'complex';
export type ExecutionStatus = 'queued' | 'running' | 'passed' | 'failed' | 'canceled';

export interface TestConfigInput {
  sortOrder?: number;
  moduleName?: string;
  name: string;
  targetUrl: string;
  featureDescription: string;
  authRequired: boolean;
  loginUrl?: string;
  loginUsername?: string;
  loginPassword?: string;
}

export interface TestConfigRecord {
  configUid: string;
  sortOrder: number;
  moduleName: string;
  name: string;
  targetUrl: string;
  featureDescription: string;
  authRequired: boolean;
  loginUrl: string;
  loginUsername: string;
  loginPasswordMasked: string;
  coverageMode: CoverageMode;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface TestPlanInput {
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
  configUid: string;
  planTitle: string;
  planVersion: number;
  planCode: string;
  planSummary: string;
  generatedFiles: Array<{ name: string; content: string; language: string }>;
  createdAt: string;
}

export interface PlanCaseInput {
  planUid: string;
  tier: Tier;
  caseName: string;
  caseSteps: unknown;
  expectedResult: string;
  sortOrder: number;
}

export interface LlmConversationInput {
  scene: 'plan_generation' | 'plan_execution';
  refUid: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  messageType: 'thinking' | 'code' | 'status' | 'error';
  content: string;
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

function normalizeConfigRow(row: RowDataPacket): TestConfigRecord {
  const password = decryptSecret(row.login_password_enc as string | null);
  return {
    configUid: String(row.config_uid),
    sortOrder: Number(row.sort_order || 100),
    moduleName: row.module_name ? String(row.module_name) : 'general',
    name: String(row.name),
    targetUrl: String(row.target_url),
    featureDescription: String(row.feature_description),
    authRequired: !!row.auth_required,
    loginUrl: row.login_url ? String(row.login_url) : '',
    loginUsername: row.login_username ? String(row.login_username) : '',
    loginPasswordMasked: maskPassword(password),
    coverageMode: row.coverage_mode as CoverageMode,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listTestConfigs(params: { keyword?: string; status?: 'active' | 'archived'; page?: number; pageSize?: number }) {
  const pool = getDbPool();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const offset = (page - 1) * pageSize;
  const status = params.status || 'active';
  const keyword = (params.keyword || '').trim();

  const where: string[] = ['c.status = ?'];
  const args: unknown[] = [status];

  if (keyword) {
    where.push('(c.name LIKE ? OR c.module_name LIKE ? OR c.target_url LIKE ? OR c.feature_description LIKE ?)');
    const like = `%${keyword}%`;
    args.push(like, like, like, like);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      c.*,
      p.plan_uid AS latest_plan_uid,
      p.plan_version AS latest_plan_version,
      p.created_at AS latest_plan_created_at,
      e.execution_uid AS latest_execution_uid,
      e.status AS latest_execution_status,
      e.created_at AS latest_execution_created_at
     FROM test_configurations c
     LEFT JOIN test_plans p ON p.id = (
       SELECT p2.id FROM test_plans p2 WHERE p2.config_uid = c.config_uid ORDER BY p2.plan_version DESC LIMIT 1
     )
     LEFT JOIN test_executions e ON e.id = (
       SELECT e2.id FROM test_executions e2 WHERE e2.config_uid = c.config_uid ORDER BY e2.created_at DESC LIMIT 1
     )
     ${whereSql}
     ORDER BY c.sort_order ASC, c.updated_at DESC
     LIMIT ? OFFSET ?`,
    [...args, pageSize, offset]
  );

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM test_configurations c ${whereSql}`,
    args
  );

  const items = rows.map((row) => ({
    ...normalizeConfigRow(row),
    latestPlanUid: row.latest_plan_uid ? String(row.latest_plan_uid) : '',
    latestPlanVersion: row.latest_plan_version ? Number(row.latest_plan_version) : 0,
    latestExecutionUid: row.latest_execution_uid ? String(row.latest_execution_uid) : '',
    latestExecutionStatus: row.latest_execution_status ? String(row.latest_execution_status) : '',
  }));

  return {
    page,
    pageSize,
    total: Number(countRows[0]?.total || 0),
    items,
  };
}

export async function getTestConfigByUid(configUid: string): Promise<(TestConfigRecord & { loginPasswordPlain: string }) | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM test_configurations WHERE config_uid = ? LIMIT 1`,
    [configUid]
  );
  const row = rows[0];
  if (!row) return null;

  const plainPassword = decryptSecret(row.login_password_enc as string | null);
  const normalized = normalizeConfigRow(row);
  return {
    ...normalized,
    loginPasswordPlain: plainPassword,
  };
}

export async function createTestConfig(input: TestConfigInput): Promise<TestConfigRecord> {
  const pool = getDbPool();
  const configUid = uid('cfg');
  const encryptedPassword = input.authRequired ? encryptSecret(input.loginPassword || '') : null;

  await pool.execute<ResultSetHeader>(
    `INSERT INTO test_configurations
    (config_uid, sort_order, module_name, name, target_url, feature_description, auth_required, login_url, login_username, login_password_enc, coverage_mode, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'all_tiers', 'active')`,
    [
      configUid,
      Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 100,
      (input.moduleName || 'general').trim() || 'general',
      input.name,
      input.targetUrl,
      input.featureDescription,
      input.authRequired ? 1 : 0,
      input.authRequired ? (input.loginUrl || null) : null,
      input.authRequired ? (input.loginUsername || null) : null,
      encryptedPassword,
    ]
  );

  const row = await getTestConfigByUid(configUid);
  if (!row) throw new Error('创建配置失败');
  return row;
}

export async function updateTestConfig(configUid: string, input: TestConfigInput): Promise<TestConfigRecord> {
  const pool = getDbPool();
  const existing = await getTestConfigByUid(configUid);
  if (!existing) throw new Error('配置不存在');

  const encryptedPassword = input.authRequired
    ? encryptSecret(input.loginPassword || existing.loginPasswordPlain)
    : null;

  await pool.execute<ResultSetHeader>(
    `UPDATE test_configurations
     SET sort_order = ?, module_name = ?, name = ?, target_url = ?, feature_description = ?, auth_required = ?, login_url = ?, login_username = ?, login_password_enc = ?
     WHERE config_uid = ?`,
    [
      Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 100,
      (input.moduleName || 'general').trim() || 'general',
      input.name,
      input.targetUrl,
      input.featureDescription,
      input.authRequired ? 1 : 0,
      input.authRequired ? (input.loginUrl || null) : null,
      input.authRequired ? (input.loginUsername || null) : null,
      encryptedPassword,
      configUid,
    ]
  );

  const row = await getTestConfigByUid(configUid);
  if (!row) throw new Error('更新配置失败');
  return row;
}

export async function archiveTestConfig(configUid: string): Promise<void> {
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `UPDATE test_configurations SET status = 'archived' WHERE config_uid = ?`,
    [configUid]
  );
}

export async function getLatestPlanByConfigUid(configUid: string): Promise<TestPlanRecord | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM test_plans WHERE config_uid = ? ORDER BY plan_version DESC LIMIT 1`,
    [configUid]
  );
  const row = rows[0];
  if (!row) return null;

  return {
    planUid: String(row.plan_uid),
    configUid: String(row.config_uid),
    planTitle: String(row.plan_title),
    planVersion: Number(row.plan_version),
    planCode: String(row.plan_code),
    planSummary: row.plan_summary ? String(row.plan_summary) : '',
    generatedFiles: safeJsonParse<Array<{ name: string; content: string; language: string }>>(row.generated_files_json, []),
    createdAt: new Date(row.created_at).toISOString(),
  };
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
    (plan_uid, config_uid, plan_title, plan_version, plan_code, plan_summary, tier_simple_count, tier_medium_count, tier_complex_count, generation_model, generation_prompt, generated_files_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      planUid,
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

  return {
    planUid,
    configUid: String(row.config_uid),
    planTitle: String(row.plan_title),
    planVersion: Number(row.plan_version),
    planCode: String(row.plan_code),
    planSummary: row.plan_summary ? String(row.plan_summary) : '',
    generatedFiles: safeJsonParse<Array<{ name: string; content: string; language: string }>>(row.generated_files_json, []),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function createPlanCases(cases: PlanCaseInput[]): Promise<void> {
  if (cases.length === 0) return;
  const pool = getDbPool();
  const values: Array<string | number | null> = [];
  const placeholders: string[] = [];

  for (const item of cases) {
    placeholders.push('(?, ?, ?, ?, ?, ?, ?, 1)');
    values.push(uid('case'), item.planUid, item.tier, item.caseName, JSON.stringify(item.caseSteps || []), item.expectedResult, item.sortOrder);
  }

  await pool.execute<ResultSetHeader>(
    `INSERT INTO test_plan_cases (case_uid, plan_uid, tier, case_name, case_steps, expected_result, sort_order, enabled)
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

export async function createExecution(input: { planUid: string; configUid: string; workerSessionId: string; triggerSource?: 'manual' | 'api' }) {
  const pool = getDbPool();
  const executionUid = uid('exec');

  await pool.execute<ResultSetHeader>(
    `INSERT INTO test_executions (execution_uid, plan_uid, config_uid, trigger_source, status, worker_session_id)
     VALUES (?, ?, ?, ?, 'queued', ?)`,
    [executionUid, input.planUid, input.configUid, input.triggerSource || 'manual', input.workerSessionId]
  );

  await updateExecutionStatus(executionUid, 'running', { startedAt: new Date() });

  return executionUid;
}

export async function findRunningExecution(planUid: string): Promise<string | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT execution_uid FROM test_executions WHERE plan_uid = ? AND status = 'running' ORDER BY created_at DESC LIMIT 1`,
    [planUid]
  );
  return rows[0]?.execution_uid ? String(rows[0].execution_uid) : null;
}

export async function updateExecutionStatus(
  executionUid: string,
  status: ExecutionStatus,
  extra?: { startedAt?: Date; endedAt?: Date; durationMs?: number; resultSummary?: string; errorMessage?: string }
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

  await insertExecutionEvent(executionUid, 'status', {
    status,
    at: new Date().toISOString(),
    summary: extra?.resultSummary || '',
  });
}

export async function insertExecutionEvent(executionUid: string, eventType: 'frame' | 'log' | 'step' | 'artifact' | 'status', payload: unknown): Promise<void> {
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `INSERT INTO execution_stream_events (execution_uid, event_type, payload) VALUES (?, ?, ?)`,
    [executionUid, eventType, JSON.stringify(payload)]
  );
}

export async function listExecutionEvents(executionUid: string): Promise<Array<{ eventType: string; payload: unknown; createdAt: string }>> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT event_type, payload, created_at FROM execution_stream_events WHERE execution_uid = ? ORDER BY created_at ASC, id ASC`,
    [executionUid]
  );

  return rows.map((row) => ({
    eventType: String(row.event_type),
    payload: safeJsonParse<unknown>(row.payload, {}),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function getExecution(executionUid: string): Promise<{
  executionUid: string;
  planUid: string;
  configUid: string;
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
    status: row.status as ExecutionStatus,
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : '',
    endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : '',
    durationMs: Number(row.duration_ms || 0),
    resultSummary: row.result_summary ? String(row.result_summary) : '',
    errorMessage: row.error_message ? String(row.error_message) : '',
    workerSessionId: row.worker_session_id ? String(row.worker_session_id) : '',
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function listExecutionsByConfigUid(configUid: string, limit = 30): Promise<
  Array<{
    executionUid: string;
    planUid: string;
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
    status: row.status as ExecutionStatus,
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : '',
    endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : '',
    durationMs: Number(row.duration_ms || 0),
    resultSummary: row.result_summary ? String(row.result_summary) : '',
    errorMessage: row.error_message ? String(row.error_message) : '',
    workerSessionId: row.worker_session_id ? String(row.worker_session_id) : '',
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function insertLlmConversation(input: LlmConversationInput): Promise<void> {
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `INSERT INTO llm_conversations (conversation_uid, scene, ref_uid, role, message_type, content)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uid('msg'), input.scene, input.refUid, input.role, input.messageType, input.content]
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
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function getPlanByUid(planUid: string): Promise<TestPlanRecord | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM test_plans WHERE plan_uid = ? LIMIT 1`,
    [planUid]
  );
  const row = rows[0];
  if (!row) return null;

  return {
    planUid: String(row.plan_uid),
    configUid: String(row.config_uid),
    planTitle: String(row.plan_title),
    planVersion: Number(row.plan_version),
    planCode: String(row.plan_code),
    planSummary: row.plan_summary ? String(row.plan_summary) : '',
    generatedFiles: safeJsonParse<Array<{ name: string; content: string; language: string }>>(row.generated_files_json, []),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function insertExecutionArtifact(input: { executionUid: string; artifactType: 'video' | 'screenshot' | 'trace' | 'report' | 'generated_spec'; storagePath: string; meta?: unknown }): Promise<void> {
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `INSERT INTO execution_artifacts (execution_uid, artifact_type, storage_path, meta)
     VALUES (?, ?, ?, ?)`,
    [input.executionUid, input.artifactType, input.storagePath, input.meta ? JSON.stringify(input.meta) : null]
  );
}

export async function listExecutionArtifacts(executionUid: string): Promise<Array<{ artifactType: string; storagePath: string; meta: unknown; createdAt: string }>> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT artifact_type, storage_path, meta, created_at FROM execution_artifacts WHERE execution_uid = ? ORDER BY created_at ASC, id ASC`,
    [executionUid]
  );

  return rows.map((row) => ({
    artifactType: String(row.artifact_type),
    storagePath: String(row.storage_path),
    meta: safeJsonParse<unknown>(row.meta, {}),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}
