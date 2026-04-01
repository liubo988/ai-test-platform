import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/intent-project-knowledge', () => ({
  getIntentProjectKnowledgeBackupDir: vi.fn(),
  getIntentProjectKnowledgePath: vi.fn(),
  listIntentProjectKnowledgeBackups: vi.fn(),
}));

import { GET } from '../../app/api/intent-e2e/project-knowledge/backups/route';
import {
  getIntentProjectKnowledgeBackupDir,
  getIntentProjectKnowledgePath,
  listIntentProjectKnowledgeBackups,
} from '@/lib/intent-project-knowledge';

describe('intent project knowledge backups route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIntentProjectKnowledgePath).mockImplementation(
      ((projectUid = '') =>
        projectUid
          ? `reports/intent-e2e/projects/${projectUid}/intent-e2e.project-knowledge.json`
          : 'intent-e2e.project-knowledge.json') as never
    );
    vi.mocked(getIntentProjectKnowledgeBackupDir).mockImplementation(
      ((projectUid = '') =>
        projectUid
          ? `reports/intent-e2e/projects/${projectUid}/intent-e2e.project-knowledge.backups`
          : 'reports/intent-e2e.project-knowledge.backups') as never
    );
    vi.mocked(listIntentProjectKnowledgeBackups).mockResolvedValue({
      knowledgePath: 'intent-e2e.project-knowledge.json',
      backupDir: 'reports/intent-e2e.project-knowledge.backups',
      backups: [],
    } as never);
  });

  it('returns backup list for GET requests', async () => {
    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/backups?limit=5');
    const res = await GET(req);

    expect(listIntentProjectKnowledgeBackups).toHaveBeenCalledWith(
      5,
      'intent-e2e.project-knowledge.json',
      'reports/intent-e2e.project-knowledge.backups'
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      knowledgePath: 'intent-e2e.project-knowledge.json',
      backupDir: 'reports/intent-e2e.project-knowledge.backups',
      backups: [],
    });
  });

  it('uses project-scoped backup paths when project uid is provided', async () => {
    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/backups?limit=5&projectUid=proj_1');
    const res = await GET(req);

    expect(listIntentProjectKnowledgeBackups).toHaveBeenCalledWith(
      5,
      'reports/intent-e2e/projects/proj_1/intent-e2e.project-knowledge.json',
      'reports/intent-e2e/projects/proj_1/intent-e2e.project-knowledge.backups'
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      knowledgePath: 'intent-e2e.project-knowledge.json',
      backupDir: 'reports/intent-e2e.project-knowledge.backups',
      backups: [],
    });
  });
});
