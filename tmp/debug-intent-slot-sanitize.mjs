import fs from 'node:fs';
import { Script } from 'node:vm';
import { getIntentE2ERunSnapshotByRunId } from '@/lib/db/repository';
import { applyIntentExecutionSlotPatch } from '@/lib/intent-execution-slot-patch';
import { sanitizeGeneratedCode } from '@/lib/test-generator';

const runId = process.argv[2];
if (!runId) {
  throw new Error('usage: node tmp/debug-intent-slot-sanitize.mjs <runId>');
}

const row = await getIntentE2ERunSnapshotByRunId(runId);
const state = row?.state && typeof row.state === 'object' && !Array.isArray(row.state) ? row.state : null;
const result =
  state?.result && typeof state.result === 'object' && !Array.isArray(state.result) ? state.result : null;
const compiledTemplate =
  result?.compiledTemplate && typeof result.compiledTemplate === 'object' && !Array.isArray(result.compiledTemplate)
    ? result.compiledTemplate
    : null;

if (!compiledTemplate?.code) {
  throw new Error(`compiledTemplate missing: ${runId}`);
}

const trace = JSON.parse(fs.readFileSync(`reports/intent-e2e/runs/${runId}/attempt-1-trace.json`, 'utf8'));
const structuredPatchEvent = Array.isArray(trace.generationEvents)
  ? trace.generationEvents.find((event) => event.type === 'structured_patch')
  : null;

if (!structuredPatchEvent?.structuredPatch?.patch) {
  throw new Error(`structuredPatch missing: ${runId}`);
}

const merged = applyIntentExecutionSlotPatch(compiledTemplate.code, structuredPatchEvent.structuredPatch.patch);
const sanitized = sanitizeGeneratedCode(merged.trim());

function inspect(label, code) {
  try {
    new Script(code, { filename: `${label}.js` });
    return { label, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'unknown');
    const stack = error instanceof Error ? error.stack || '' : '';
    const lineMatch = new RegExp(`${label}\\.js:(\\d+):(\\d+)`).exec(stack) || /:(\d+):(\d+)/.exec(stack);
    const lineNo = lineMatch ? Number(lineMatch[1]) : 0;
    const lines = code.split('\n');
    const start = Math.max(0, lineNo - 4);
    const end = Math.min(lines.length, lineNo + 3);
    const snippet = lines.slice(start, end).map((line, index) => `${start + index + 1}: ${line}`).join('\n');
    return { label, ok: false, message, lineNo, snippet };
  }
}

console.log(
  JSON.stringify(
    {
      merged: inspect('merged', merged),
      sanitized: inspect('sanitized', sanitized),
      sanitizedPreview: sanitized.slice(0, 4000),
    },
    null,
    2
  )
);
