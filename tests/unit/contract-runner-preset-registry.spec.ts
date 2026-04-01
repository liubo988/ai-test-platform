import { describe, expect, it } from 'vitest';

import {
  getContractRunnerPresetDefinition,
  getContractRunnerPresetManifest,
  resolveContractRunnerPresetTargets,
} from '@/lib/contract-runner-preset-registry';

describe('contract-runner-preset-registry', () => {
  it('loads the repo-owned contract preset manifest with stable definitions', () => {
    const manifest = getContractRunnerPresetManifest();

    expect(manifest).toEqual({
      version: 1,
      presets: [
        {
          presetId: 'openapi_file',
          displayName: 'OpenAPI File',
          contractKind: 'openapi_document',
          targetPolicy: {
            mode: 'contract_file',
            defaultTargets: [],
            maxTargets: 1,
          },
        },
      ],
    });
  });

  it('accepts normalized contract file targets under the controlled contracts root', () => {
    const preset = getContractRunnerPresetDefinition('openapi_file');
    if (!preset) throw new Error('expected openapi_file preset');

    expect(resolveContractRunnerPresetTargets(preset, ['contracts/demo/petstore.yaml'])).toEqual({
      targets: ['contracts/demo/petstore.yaml'],
      invalidTargets: [],
    });
  });

  it('rejects targets that escape the controlled contract roots or extensions', () => {
    const preset = getContractRunnerPresetDefinition('openapi_file');
    if (!preset) throw new Error('expected openapi_file preset');

    expect(resolveContractRunnerPresetTargets(preset, ['../openapi.yaml', 'contracts/demo/openapi.txt'])).toEqual({
      targets: [],
      invalidTargets: ['../openapi.yaml', 'contracts/demo/openapi.txt'],
    });
  });
});
