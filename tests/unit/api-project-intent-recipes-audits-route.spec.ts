import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/intent-project-recipe-registry', () => ({
  getIntentProjectRecipeAuditPath: vi.fn(),
  listIntentProjectRecipeAuditEntries: vi.fn(),
}));

vi.mock('@/lib/server/project-actor', () => ({
  applyActorCookie: vi.fn((response: NextResponse) => response),
  requireProjectRole: vi.fn(),
  toErrorResponse: vi.fn((error: unknown, fallbackMessage: string) =>
    NextResponse.json(
      { error: error instanceof Error ? error.message : fallbackMessage },
      { status: typeof (error as { status?: unknown })?.status === 'number' ? Number((error as { status?: unknown }).status) : 500 }
    )
  ),
}));

import { GET } from '../../app/api/projects/[projectUid]/intent-recipes/audits/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  getIntentProjectRecipeAuditPath,
  listIntentProjectRecipeAuditEntries,
} from '@/lib/intent-project-recipe-registry';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('project intent recipes audits route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'bobo' },
      membership: { role: 'viewer' },
    } as never);
    vi.mocked(getIntentProjectRecipeAuditPath).mockReturnValue('reports/intent-e2e/projects/proj_1/intent-e2e.project-recipes.audit.jsonl');
    vi.mocked(listIntentProjectRecipeAuditEntries).mockResolvedValue({
      auditLogPath: 'reports/intent-e2e.project-recipes.audit.jsonl',
      items: [],
    } as never);
  });

  it('lists project recipe audits with project auth', async () => {
    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-recipes/audits?limit=7');
    const res = await GET(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(req, 'proj_1', ['owner', 'editor', 'viewer'], '当前操作者没有权限查看项目 recipe 审计');
    expect(listIntentProjectRecipeAuditEntries).toHaveBeenCalledWith(
      7,
      'proj_1',
      'reports/intent-e2e/projects/proj_1/intent-e2e.project-recipes.audit.jsonl'
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});
