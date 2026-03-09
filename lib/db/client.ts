import mysql, { type Pool, type PoolOptions } from 'mysql2/promise';

let pool: Pool | null = null;

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
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: 'Z',
    supportBigNumbers: true,
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
