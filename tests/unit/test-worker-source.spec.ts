import fs from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'lib/test-worker.mjs'), 'utf8');
const sourceFile = ts.createSourceFile('test-worker.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

type FakeElement = {
  key: string;
  visible?: boolean;
  placeholder?: string;
  name?: string;
  queries?: {
    css?: Record<string, FakeElement[]>;
    placeholder?: FakeElement[];
    role?: Record<string, FakeElement[]>;
  };
};

class FakeLocator {
  constructor(
    readonly elements: FakeElement[] = [],
    readonly label = 'locator'
  ) {}

  locator(selector: string) {
    const matches = this.elements.flatMap((element) => element.queries?.css?.[selector] ?? []);
    return new FakeLocator(matches, `${this.label}.locator(${selector})`);
  }

  getByPlaceholder(pattern: RegExp) {
    const matches = this.elements.flatMap((element) =>
      (element.queries?.placeholder ?? []).filter((candidate) => pattern.test(candidate.placeholder ?? ''))
    );
    return new FakeLocator(matches, `${this.label}.getByPlaceholder(${pattern.toString()})`);
  }

  getByRole(role: string, options?: { name?: RegExp }) {
    const matches = this.elements.flatMap((element) =>
      (element.queries?.role?.[role] ?? []).filter((candidate) => !options?.name || options.name.test(candidate.name ?? ''))
    );
    return new FakeLocator(matches, `${this.label}.getByRole(${role})`);
  }

  count() {
    return Promise.resolve(this.elements.length);
  }

  nth(index: number) {
    return new FakeLocator(this.elements[index] ? [this.elements[index]] : [], `${this.label}.nth(${index})`);
  }

  first() {
    return this.nth(0);
  }

  waitFor() {
    return Promise.resolve();
  }
}

function getFunctionSource(name: string) {
  let functionSource = '';

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      functionSource = node.getText(sourceFile);
      return;
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);

  if (!functionSource) {
    throw new Error(`Function not found in lib/test-worker.mjs: ${name}`);
  }

  return functionSource;
}

function compileFunction<T>(name: string, deps: Record<string, unknown> = {}) {
  const functionSource = getFunctionSource(name);
  return new Function(...Object.keys(deps), `"use strict"; return (${functionSource});`)(...Object.values(deps)) as T;
}

const isLocatorLike = (value: unknown) =>
  Boolean(value) && typeof value === 'object' && typeof (value as FakeLocator).waitFor === 'function' && typeof (value as FakeLocator).locator === 'function';
const locatorVisible = async (locator: FakeLocator) => Boolean(locator.elements[0]?.visible);

const buildPrimaryLookupScopeCandidates = compileFunction<(page: FakeLocator, options?: Record<string, unknown>) => FakeLocator[]>(
  'buildPrimaryLookupScopeCandidates',
  { isLocatorLike }
);
const buildPrimaryLookupInputCandidates = compileFunction<(page: FakeLocator, options?: Record<string, unknown>) => FakeLocator[]>(
  'buildPrimaryLookupInputCandidates',
  {
    isLocatorLike,
    buildPrimaryLookupScopeCandidates,
  }
);
const pickVisiblePrimaryLookupLocator = compileFunction<
  (candidates: FakeLocator[], timeout?: number) => Promise<FakeLocator | null>
>('pickVisiblePrimaryLookupLocator', { locatorVisible });

describe('test-worker primary lookup candidates', () => {
  it('exports a deterministic visible-filter helper for modal pending-status selection', () => {
    expect(source).toContain('async function applyDeterministicVisibleAntdFilter(page, options)');
    expect(source).toContain('function buildVisibleAntdFilterRootCandidates(page, options)');
    expect(source).toContain('function buildVisibleAntdFilterSourceCandidates(page, filterRoot, options)');
    expect(source).toContain("filteredBy: String(options?.summary || label).trim() || label");
    expect(source).toContain('applyDeterministicVisibleAntdFilter,');
  });

  it('covers account-list keyword input variants used by batch-account flows', () => {
    expect(source).toContain('#service-data-item_keyWord:visible');
    expect(source).toContain('#form_in_modal_testKeyWord:visible');
    expect(source).toContain(
      'input[id*="testKeyWord"]:visible, input[name*="testKeyWord"]:visible, input[id*="keyWord"]:visible, input[name*="keyWord"]:visible'
    );
    expect(source).toContain('请输入关键词');
  });

  it('skips hidden keyword clones and returns the visible input', async () => {
    const hiddenInput: FakeElement = {
      key: 'hidden-placeholder-input',
      visible: false,
      placeholder: '请输入关键词',
    };
    const visibleInput: FakeElement = {
      key: 'visible-placeholder-input',
      visible: true,
      placeholder: '请输入关键词',
    };
    const page = new FakeLocator(
      [
        {
          key: 'page-root',
          queries: {
            placeholder: [hiddenInput, visibleInput],
          },
        },
      ],
      'page'
    );

    const candidates = buildPrimaryLookupInputCandidates(page, {});
    const picked = await pickVisiblePrimaryLookupLocator(candidates, 30);

    expect(picked?.elements[0]?.key).toBe('visible-placeholder-input');
  });

  it('prefers scoped visible inputs before page-level fallbacks', async () => {
    const scopedInput: FakeElement = {
      key: 'scoped-visible-input',
      visible: true,
    };
    const pageInput: FakeElement = {
      key: 'page-visible-input',
      visible: true,
    };
    const scope = new FakeLocator(
      [
        {
          key: 'scope-root',
          queries: {
            css: {
              '.sourceSearch, .search, .filter, [class*="search"], [class*="filter"], .ant-form, form': [
                {
                  key: 'scope-search-container',
                  queries: {
                    css: {
                      'input[id*="testKeyWord"]:visible, input[name*="testKeyWord"]:visible, input[id*="keyWord"]:visible, input[name*="keyWord"]:visible': [
                        scopedInput,
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      ],
      'scope'
    );
    const page = new FakeLocator(
      [
        {
          key: 'page-root',
          queries: {
            css: {
              'input[id*="testKeyWord"]:visible, input[name*="testKeyWord"]:visible, input[id*="keyWord"]:visible, input[name*="keyWord"]:visible': [
                pageInput,
              ],
            },
          },
        },
      ],
      'page'
    );

    const candidates = buildPrimaryLookupInputCandidates(page, { scope });
    const picked = await pickVisiblePrimaryLookupLocator(candidates, 30);

    expect(picked?.elements[0]?.key).toBe('scoped-visible-input');
  });
});
