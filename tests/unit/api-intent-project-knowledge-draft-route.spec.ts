import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/intent-project-knowledge-draft', () => ({
  generateIntentProjectKnowledgeDraft: vi.fn(),
  writeIntentProjectKnowledgeDraft: vi.fn(),
}));

import { GET, POST } from '../../app/api/intent-e2e/project-knowledge/draft/route';
import { generateIntentProjectKnowledgeDraft, writeIntentProjectKnowledgeDraft } from '@/lib/intent-project-knowledge-draft';

describe('intent project knowledge draft route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateIntentProjectKnowledgeDraft).mockResolvedValue({ version: 1, candidates: [], summary: {} } as never);
    vi.mocked(writeIntentProjectKnowledgeDraft).mockResolvedValue('reports/intent-e2e.project-knowledge.draft.json' as never);
  });

  it('returns a draft preview for GET requests', async () => {
    const req = new NextRequest(
      'http://localhost/api/intent-e2e/project-knowledge/draft?minSeenCount=3&maxCandidates=5&projectUid=proj_1&moduleUid=mod_1'
    );
    const res = await GET(req);

    expect(generateIntentProjectKnowledgeDraft).toHaveBeenCalledWith({
      minSeenCount: 3,
      minResolvedCount: 1,
      maxCandidates: 5,
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ draft: { version: 1, candidates: [], summary: {} } });
  });

  it('writes the draft file when POST requests opt in', async () => {
    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/draft', {
      method: 'POST',
      body: JSON.stringify({ write: true, minResolvedCount: 2, projectUid: 'proj_1', moduleUid: 'mod_1' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);

    expect(generateIntentProjectKnowledgeDraft).toHaveBeenCalledWith({
      minSeenCount: 2,
      minResolvedCount: 2,
      maxCandidates: 12,
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
    });
    expect(writeIntentProjectKnowledgeDraft).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({
      draft: { version: 1, candidates: [], summary: {} },
      writtenTo: 'reports/intent-e2e.project-knowledge.draft.json',
    });
  });
});
