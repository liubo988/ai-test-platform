import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const distDir = process.env.NEXT_DIST_DIR?.trim() || '.next-e2e';
const port = process.env.PORT || '4187';
const nextCli = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
const nextEnvPath = path.join(ROOT, 'next-env.d.ts');
const tsconfigPath = path.join(ROOT, 'tsconfig.json');
const nextEnvSnapshot = fs.existsSync(nextEnvPath) ? fs.readFileSync(nextEnvPath, 'utf8') : null;
const tsconfigSnapshot = fs.existsSync(tsconfigPath) ? fs.readFileSync(tsconfigPath, 'utf8') : null;

function restoreWorkspaceFiles() {
  if (nextEnvSnapshot !== null) {
    fs.writeFileSync(nextEnvPath, nextEnvSnapshot);
  }
  if (tsconfigSnapshot !== null) {
    fs.writeFileSync(tsconfigPath, tsconfigSnapshot);
  }
}

globalThis.__restoreWorkspaceFiles = restoreWorkspaceFiles;

// This distDir is dedicated to the scenario smoke server. Clear stale lock/type
// artifacts left behind by interrupted runs before rebuilding it so smoke runs
// do not depend on a previous .next-e2e state.
for (const artifactPath of [
  path.join(ROOT, distDir, 'lock'),
  path.join(ROOT, distDir, 'dev', 'lock'),
  path.join(ROOT, distDir, 'types'),
  path.join(ROOT, distDir, 'dev', 'types'),
  path.join(ROOT, distDir, 'cache', '.tsbuildinfo'),
]) {
  try {
    fs.rmSync(artifactPath, { force: true, recursive: true });
  } catch {}
}

try {
  execFileSync(process.execPath, [nextCli, 'build', '--webpack'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NEXT_DIST_DIR: distDir,
    },
    stdio: 'inherit',
  });
} finally {
  restoreWorkspaceFiles();
}

process.env.NODE_ENV = 'production';
process.env.PORT = port;
process.env.NEXT_DIST_DIR = distDir;

await import('../server.mjs');
