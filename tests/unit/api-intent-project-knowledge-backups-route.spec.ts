import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/intent-project-knowledge', () => ({
  listIntentProjectKnowledgeBackups: vi.fn(),
}));

import { GET } from '../../app/api/intent-e2e/project-knowledge/backups/route';
import { listIntentProjectKnowledgeBackups } from '@/lib/intent-project-knowledge';

describe('intent project knowledge backups route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listIntentProjectKnowledgeBackups).mockResolvedValue({
      knowledgePath: 'intent-e2e.project-knowledge.json',
      backupDir: 'reports/intent-e2e.project-knowledge.backups',
      backups: [],
    } as never);
  });

  it('returns backup list for GET requests', async () => {
    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/backups?limit=5');
    const res = await GET(req);

    expect(listIntentProjectKnowledgeBackups).toHaveBeenCalledWith(5);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      knowledgePath: 'intent-e2e.project-knowledge.json',
      backupDir: 'reports/intent-e2e.project-knowledge.backups',
      backups: [],
    });
  });
});
