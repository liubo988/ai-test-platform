import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionCandidates = ['', '.ts', '.tsx', '.js', '.mjs', '.json'];
const indexCandidates = ['index.ts', 'index.tsx', 'index.js', 'index.mjs'];

function resolveAliasPath(specifier) {
  const relativePath = specifier.slice(2);
  return resolveBasePath(path.resolve(rootDir, relativePath));
}

function resolveBasePath(basePath) {
  for (const extension of extensionCandidates) {
    const candidate = `${basePath}${extension}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  for (const indexFile of indexCandidates) {
    const candidate = path.join(basePath, indexFile);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return '';
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('next/') && !path.extname(specifier)) {
    try {
      return await nextResolve(`${specifier}.js`, context);
    } catch {
      // Fall through to default resolution when the .js subpath is not present.
    }
  }

  if (specifier.startsWith('@/')) {
    const resolvedPath = resolveAliasPath(specifier);
    if (!resolvedPath) {
      throw new Error(`无法解析 TS alias: ${specifier}`);
    }

    return {
      url: pathToFileURL(resolvedPath).href,
      shortCircuit: true,
    };
  }

  if ((specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/')) && !path.extname(specifier)) {
    const parentPath = context.parentURL?.startsWith('file:')
      ? path.dirname(fileURLToPath(context.parentURL))
      : rootDir;
    const basePath = specifier.startsWith('/')
      ? path.resolve(rootDir, specifier.slice(1))
      : path.resolve(parentPath, specifier);
    const resolvedPath = resolveBasePath(basePath);
    if (resolvedPath) {
      return {
        url: pathToFileURL(resolvedPath).href,
        shortCircuit: true,
      };
    }
  }

  return nextResolve(specifier, context);
}
