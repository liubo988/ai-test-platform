import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/intent-project-knowledge', () => ({
  restoreIntentProjectKnowledgeBackup: vi.fn(),
}));

import { POST } from '../../app/api/intent-e2e/project-knowledge/backups/restore/route';
import { restoreIntentProjectKnowledgeBackup } from '@/lib/intent-project-knowledge';

describe('intent project knowledge backup restore route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(restoreIntentProjectKnowledgeBackup).mockResolvedValue({
      restoredFrom: 'reports/intent-e2e.project-knowledge.backups/backup.json',
      writtenTo: 'intent-e2e.project-knowledge.json',
      backupCreated: 'reports/intent-e2e.project-knowledge.backups/current-before-restore.json',
      profile: { version: 1, rules: [] },
    } as never);
  });

  it('restores the requested backup file', async () => {
    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/backups/restore', {
      method: 'POST',
      body: JSON.stringify({ backupPath: 'reports/intent-e2e.project-knowledge.backups/backup.json' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);

    expect(restoreIntentProjectKnowledgeBackup).toHaveBeenCalledWith('reports/intent-e2e.project-knowledge.backups/backup.json');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      restoredFrom: 'reports/intent-e2e.project-knowledge.backups/backup.json',
      writtenTo: 'intent-e2e.project-knowledge.json',
      backupCreated: 'reports/intent-e2e.project-knowledge.backups/current-before-restore.json',
      profile: { version: 1, rules: [] },
    });
  });
});
