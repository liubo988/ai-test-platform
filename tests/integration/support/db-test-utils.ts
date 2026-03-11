import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import mysql from 'mysql2/promise';
import { NextRequest } from 'next/server';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env');

let envLoaded = false;
let dbInitialized = false;

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex <= 0) return null;
  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

export function ensureDotEnvLoaded(): void {
  if (envLoaded) return;
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`Missing .env file at ${ENV_PATH}`);
  }

  const content = fs.readFileSync(ENV_PATH, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  envLoaded = true;
}

export function ensureIntegrationDbReady(): void {
  ensureDotEnvLoaded();
  if (dbInitialized) return;

  execFileSync(process.execPath, ['scripts/init-e2e-db.mjs'], {
    cwd: ROOT,
    env: process.env,
    stdio: 'pipe',
  });

  dbInitialized = true;
}

export async function cleanupProjectGraph(projectUid: string, emails: string[] = []): Promise<void> {
  ensureDotEnvLoaded();

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    charset: 'utf8mb4',
  });

  try {
    await connection.execute(`DELETE FROM execution_artifacts WHERE project_uid = ?`, [projectUid]);
    await connection.execute(`DELETE FROM execution_stream_events WHERE project_uid = ?`, [projectUid]);
    await connection.execute(`DELETE FROM llm_conversations WHERE project_uid = ?`, [projectUid]);
    await connection.execute(`DELETE FROM test_executions WHERE project_uid = ?`, [projectUid]);
    await connection.execute(`DELETE FROM test_plan_cases WHERE project_uid = ?`, [projectUid]);
    await connection.execute(`DELETE FROM test_plans WHERE project_uid = ?`, [projectUid]);
    await connection.execute(`DELETE FROM project_activity_logs WHERE project_uid = ?`, [projectUid]);
    await connection.execute(`DELETE FROM test_configurations WHERE project_uid = ?`, [projectUid]);
    await connection.execute(`DELETE FROM test_modules WHERE project_uid = ?`, [projectUid]);
    await connection.execute(`DELETE FROM project_members WHERE project_uid = ?`, [projectUid]);
    await connection.execute(`DELETE FROM test_projects WHERE project_uid = ?`, [projectUid]);

    for (const email of emails) {
      await connection.execute(`DELETE FROM workspace_users WHERE email = ?`, [email.toLowerCase()]);
    }
  } finally {
    await connection.end();
  }
}

export function createActorRequest(
  input: string | URL,
  actorUid: string,
  init?: ConstructorParameters<typeof NextRequest>[1]
): NextRequest {
  const headers = new Headers(init?.headers);
  headers.set('cookie', `e2e_actor_uid=${actorUid}`);
  return new NextRequest(input, { ...init, headers });
}

export function uniqueLabel(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
