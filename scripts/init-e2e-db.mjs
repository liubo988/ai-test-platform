import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';

function must(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

const schemaPath = path.join(process.cwd(), 'scripts', 'e2e-platform-schema.sql');

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
    await ensureOptionalColumns(connection);
    console.log('E2E platform schema initialized.');
  } finally {
    await connection.end();
  }
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

async function ensureOptionalColumns(connection) {
  const hasSortOrder = await columnExists(connection, 'test_configurations', 'sort_order');
  if (!hasSortOrder) {
    await connection.query(`ALTER TABLE test_configurations ADD COLUMN sort_order INT NOT NULL DEFAULT 100 AFTER config_uid`);
  }

  const hasModuleName = await columnExists(connection, 'test_configurations', 'module_name');
  if (!hasModuleName) {
    await connection.query(
      `ALTER TABLE test_configurations ADD COLUMN module_name VARCHAR(128) NOT NULL DEFAULT 'general' AFTER sort_order`
    );
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
