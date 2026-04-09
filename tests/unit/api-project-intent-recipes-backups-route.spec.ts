import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/intent-project-recipe-registry', () => ({
  getIntentProjectRecipeBackupDir: vi.fn(),
  getIntentProjectRecipeRegistryPath: vi.fn(),
  listIntentProjectRecipeBackups: vi.fn(),
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

import { GET } from '../../app/api/projects/[projectUid]/intent-recipes/backups/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  getIntentProjectRecipeBackupDir,
  getIntentProjectRecipeRegistryPath,
  listIntentProjectRecipeBackups,
} from '@/lib/intent-project-recipe-registry';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('project intent recipes backups route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'bobo' },
      membership: { role: 'viewer' },
    } as never);
    vi.mocked(getIntentProjectRecipeRegistryPath).mockReturnValue('reports/intent-e2e/projects/proj_1/intent-e2e.project-recipes.json');
    vi.mocked(getIntentProjectRecipeBackupDir).mockReturnValue('reports/intent-e2e/projects/proj_1/intent-e2e.project-recipes.backups');
    vi.mocked(listIntentProjectRecipeBackups).mockResolvedValue({
      registryPath: 'intent-e2e.project-recipes.json',
      backupDir: 'reports/intent-e2e.project-recipes.backups',
      backups: [],
    } as never);
  });

  it('lists project recipe backups with project auth', async () => {
    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-recipes/backups?limit=5');
    const res = await GET(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(req, 'proj_1', ['owner', 'editor', 'viewer'], '当前操作者没有权限查看项目 recipe 备份');
    expect(listIntentProjectRecipeBackups).toHaveBeenCalledWith(
      5,
      'reports/intent-e2e/projects/proj_1/intent-e2e.project-recipes.json',
      'reports/intent-e2e/projects/proj_1/intent-e2e.project-recipes.backups'
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});
