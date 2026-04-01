import { describe, expect, it } from 'vitest';
import {
  getRepoTestRunnerPresetDefinition,
  getRepoTestRunnerPresetManifest,
  resolveRepoTestRunnerPresetTargets,
} from '@/lib/repo-test-runner-preset-registry';

describe('repo-test-runner-preset-registry', () => {
  it('loads the repo-owned preset manifest with stable definitions', () => {
    const manifest = getRepoTestRunnerPresetManifest();

    expect(manifest).toEqual({
      version: 1,
      presets: [
        {
          presetId: 'vitest_unit',
          displayName: 'Vitest Unit',
          commandKind: 'node_script',
          entryPath: 'node_modules/vitest/vitest.mjs',
          args: ['run'],
          targetPolicy: {
            mode: 'unit_test_spec',
            defaultTargets: ['tests/unit'],
            maxTargets: 12,
          },
        },
        {
          presetId: 'tsc_build',
          displayName: 'TypeScript Build',
          commandKind: 'node_script',
          entryPath: 'node_modules/typescript/bin/tsc',
          args: ['-p', 'tsconfig.json'],
          targetPolicy: {
            mode: 'none',
            defaultTargets: [],
            maxTargets: 0,
          },
        },
        {
          presetId: 'doc_links',
          displayName: 'Doc Links Check',
          commandKind: 'node_script',
          entryPath: 'scripts/check-doc-links.mjs',
          args: [],
          targetPolicy: {
            mode: 'none',
            defaultTargets: [],
            maxTargets: 0,
          },
        },
      ],
    });
  });

  it('returns default targets for presets that define a unit-test target policy', () => {
    const preset = getRepoTestRunnerPresetDefinition('vitest_unit');
    if (!preset) throw new Error('expected vitest_unit preset');

    expect(resolveRepoTestRunnerPresetTargets(preset, undefined)).toEqual({
      targets: ['tests/unit'],
      invalidTargets: [],
    });
  });

  it('keeps non-target presets empty and flags invalid target payloads', () => {
    const preset = getRepoTestRunnerPresetDefinition('doc_links');
    if (!preset) throw new Error('expected doc_links preset');

    expect(resolveRepoTestRunnerPresetTargets(preset, undefined)).toEqual({
      targets: [],
      invalidTargets: [],
    });
    expect(resolveRepoTestRunnerPresetTargets(preset, ['tests/unit/intent-runner-adapter.spec.ts'])).toEqual({
      targets: [],
      invalidTargets: ['tests/unit/intent-runner-adapter.spec.ts'],
    });
  });
});
