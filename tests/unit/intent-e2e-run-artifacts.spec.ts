import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { archiveIntentE2ERunArtifacts } from '@/lib/intent-e2e-run-artifacts';

const SPEC_ROOT = path.join(process.cwd(), 'tmp', 'intent-e2e-run-artifacts-spec');

describe('intent-e2e-run-artifacts', () => {
  afterEach(async () => {
    delete process.env.INTENT_E2E_RUN_ARTIFACT_ROOT;
    await fs.rm(SPEC_ROOT, { recursive: true, force: true });
  });

  it('archives trace, log, screenshot, response summary, and runner artifacts into a stable index', async () => {
    process.env.INTENT_E2E_RUN_ARTIFACT_ROOT = SPEC_ROOT;

    const index = await archiveIntentE2ERunArtifacts({
      runId: 'intent-run-artifacts',
      targetUrl: 'https://example.com/checkout',
      description: '访问结算页并提交，最终看到成功页面',
      initialSnapshot: {
        url: 'https://example.com/checkout',
        title: 'Checkout',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [],
        screenshot: Buffer.from('initial-jpeg').toString('base64'),
      },
      repairSnapshots: [
        {
          attempt: 2,
          snapshot: {
            url: 'https://example.com/checkout',
            title: 'Checkout Repair',
            forms: [],
            buttons: [],
            tooltipElements: [],
            links: [],
            headings: [],
            screenshot: Buffer.from('repair-jpeg').toString('base64'),
          },
          report: {
            observedAt: '2026-04-01T10:00:00.000Z',
            pageUrl: 'https://example.com/checkout',
            pageTitle: 'Checkout Repair',
            probes: [
              {
                probeUid: 'page_surface',
                kind: 'page_surface',
                status: 'observed',
                summary: '页面可见',
                evidence: ['button=提交'],
              },
            ],
          },
        },
      ],
      attempts: [
        {
          attempt: 1,
          kind: 'generate',
          sessionId: 'intent-session-1',
          generationEvents: [{ type: 'complete', content: "test('checkout', async () => {});" }],
          logs: [{ level: 'info', message: 'runner started', at: '2026-04-01T10:00:01.000Z' }],
          result: {
            success: false,
            duration: 320,
            error: 'gateway timeout',
            steps: [{ title: '打开结算页', status: 'failed', duration: 320, error: 'gateway timeout', at: '2026-04-01T10:00:02.000Z' }],
          },
          triage: {
            failureClass: 'env_transient',
            repairable: true,
            summary: '环境暂态失败',
            matchedSignals: ['gateway timeout'],
          },
          runnerArtifacts: [
            {
              artifactType: 'trace',
              fileName: 'http-trace.json',
              content: '{"status":504}',
            },
          ],
        },
      ],
    });

    expect(index).not.toBeNull();
    expect(index?.itemCount).toBe(8);
    expect(index?.byKind).toEqual(
      expect.arrayContaining([
        { kind: 'trace', count: 2 },
        { kind: 'log', count: 1 },
        { kind: 'screenshot', count: 2 },
        { kind: 'response_summary', count: 2 },
        { kind: 'runner_artifact', count: 1 },
      ])
    );

    const files = await fs.readdir(path.join(SPEC_ROOT, 'intent-run-artifacts'));
    expect(files).toEqual(
      expect.arrayContaining([
        'run-trace.json',
        'initial-snapshot.jpg',
        'attempt-1-trace.json',
        'attempt-1-logs.txt',
        'attempt-1-response-summary.json',
        'attempt-1-http-trace.json',
        'attempt-2-repair-observation.jpg',
        'attempt-2-repair-observation.json',
      ])
    );
  });
});
