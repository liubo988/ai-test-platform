import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const targetDir = path.join(root, 'tests', 'e2e', 'generated');

async function main() {
  let entries;
  try {
    entries = await fs.readdir(targetDir, { withFileTypes: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`[cleanup] skip: cannot read ${targetDir}: ${msg}`);
    return;
  }

  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => /^gen-\d+\.spec\.ts$/.test(name));

  if (files.length === 0) {
    console.log('[cleanup] no generated spec files found');
    return;
  }

  let removed = 0;
  for (const name of files) {
    const full = path.join(targetDir, name);
    try {
      await fs.unlink(full);
      removed += 1;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`[cleanup] failed: ${name} (${msg})`);
    }
  }

  console.log(`[cleanup] removed ${removed}/${files.length} files from ${targetDir}`);
}

main().catch((error) => {
  const msg = error instanceof Error ? error.stack || error.message : String(error);
  console.error(msg);
  process.exit(1);
});
