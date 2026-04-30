import mysql, { type Pool, type PoolOptions } from 'mysql2/promise';

let pool: Pool | null = null;

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function isTransientPoolCloseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'EPIPE' || code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'PROTOCOL_CONNECTION_LOST';
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少数据库配置: ${name}`);
  }
  return value;
}

function buildPoolOptions(): PoolOptions {
  return {
    host: requiredEnv('DB_HOST'),
    user: requiredEnv('DB_USER'),
    password: requiredEnv('DB_PASSWORD'),
    database: requiredEnv('DB_NAME'),
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: readPositiveNumberEnv('DB_POOL_SIZE', 10),
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: 'Z',
    supportBigNumbers: true,
    connectTimeout: readPositiveNumberEnv('DB_CONNECT_TIMEOUT_MS', 30000),
    enableKeepAlive: true,
    keepAliveInitialDelay: readPositiveNumberEnv('DB_KEEPALIVE_INITIAL_DELAY_MS', 0),
  };
}

export function getDbPool(): Pool {
  if (!pool) {
    pool = mysql.createPool(buildPoolOptions());
  }
  return pool;
}

export async function ensureDbReady(): Promise<void> {
  const conn = await getDbPool().getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

export async function closeDbPool(): Promise<void> {
  if (!pool) return;
  const current = pool;
  pool = null;
  try {
    await current.end();
  } catch (error) {
    if (!isTransientPoolCloseError(error)) {
      throw error;
    }
    console.warn('[db] ignored transient error while closing MySQL pool', (error as Error).message);
  }
}
