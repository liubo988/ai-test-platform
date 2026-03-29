function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

type IntentStableIdentifierKind = 'id' | 'uid' | 'code' | 'no' | 'serial';

const NON_STABLE_CODE_PREFIXES = new Set([
  'sms',
  'verify',
  'verification',
  'captcha',
  'status',
  'error',
  'result',
  'response',
  'http',
  'area',
  'country',
  'dial',
  'phone',
  'otp',
  'auth',
  'login',
  'password',
  'msg',
  'message',
  'zip',
  'postal',
]);

const NON_STABLE_NO_PREFIXES = new Set([
  ...NON_STABLE_CODE_PREFIXES,
  'page',
  'row',
  'line',
  'column',
  'col',
  'index',
  'version',
  'attempt',
  'retry',
]);

function tokenizeIntentVariable(value: string): string[] {
  return String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function toLowerCamelCase(tokens: string[]): string {
  if (tokens.length === 0) return '';

  return tokens
    .map((token, index) => (index === 0 ? token : `${token.slice(0, 1).toUpperCase()}${token.slice(1)}`))
    .join('');
}

function inferIntentStableIdentifierKind(variable: string): IntentStableIdentifierKind | null {
  const normalized = String(variable || '').trim();
  const lower = normalized.toLowerCase();
  const tokens = tokenizeIntentVariable(normalized);
  if (!normalized || tokens.length === 0) return null;

  const lastToken = tokens[tokens.length - 1] || '';
  const stemTokens = tokens.slice(0, -1);

  if (lastToken === 'id') {
    return 'id';
  }

  if (lastToken === 'uid' || lower === 'uid') {
    return 'uid';
  }

  if (tokens.includes('serial') && (lastToken === 'serial' || lastToken === 'no' || lastToken === 'number')) {
    return 'serial';
  }

  if ((lastToken === 'code' || lower === 'code') && !stemTokens.some((token) => NON_STABLE_CODE_PREFIXES.has(token))) {
    return 'code';
  }

  if ((lastToken === 'no' || lower === 'no' || (lastToken === 'number' && tokens.length > 1)) && !stemTokens.some((token) => NON_STABLE_NO_PREFIXES.has(token))) {
    return 'no';
  }

  return null;
}

function buildIntentStableIdentifierAliases(variable: string): string[] {
  const normalized = String(variable || '').trim();
  const lower = normalized.toLowerCase();
  const kind = inferIntentStableIdentifierKind(normalized);
  if (!normalized || !kind) return [];

  const tokens = tokenizeIntentVariable(normalized);
  const lastToken = tokens[tokens.length - 1] || '';
  const stemTokens = tokens.slice(0, -1);
  const stem = toLowerCamelCase(stemTokens);

  switch (kind) {
    case 'id':
      return lower === 'id' ? [] : ['id'];
    case 'uid':
      return lower === 'uid' ? [] : ['uid'];
    case 'code':
      return lower === 'code' ? [] : ['code'];
    case 'no':
      return uniqueStrings([
        lower === 'no' ? null : 'no',
        lower === 'number' ? null : 'number',
        stem && lastToken === 'no' ? `${stem}Number` : null,
        stem && lastToken === 'number' ? `${stem}No` : null,
      ]);
    case 'serial':
      return uniqueStrings([
        lower === 'serial' ? null : 'serial',
        lower === 'serialno' ? null : 'serialNo',
        lower === 'serialnumber' ? null : 'serialNumber',
        stem && lastToken === 'serial' ? `${stem}SerialNo` : null,
        stem && lastToken === 'serial' ? `${stem}SerialNumber` : null,
        stem && lastToken === 'no' ? `${stem}Number` : null,
        stem && lastToken === 'number' ? `${stem}No` : null,
        'no',
        'number',
      ]);
    default:
      return [];
  }
}

export function looksLikeIntentStableIdentifierVariable(variable: string): boolean {
  return Boolean(inferIntentStableIdentifierKind(variable));
}

export function looksLikeIntentPrimaryKeyVariable(variable: string): boolean {
  return inferIntentStableIdentifierKind(variable) === 'id';
}

export function buildIntentSharedVariableJsonPaths(variable: string): string[] {
  const normalized = String(variable || '').trim();
  if (!normalized) return [];

  const prefixes = ['', 'data.', 'result.', 'data.data.'];
  const aliases = buildIntentStableIdentifierAliases(normalized);
  const paths = prefixes.map((prefix) => `${prefix}${normalized}`);

  for (const alias of aliases) {
    paths.push(...prefixes.map((prefix) => `${prefix}${alias}`));
  }

  return uniqueStrings(paths);
}
