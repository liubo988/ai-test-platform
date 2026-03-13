/**
 * @typedef {{
 *   baseUrl: string,
 *   apiKey: string,
 *   isAzure: boolean,
 *   retryDelayMs?: number,
 *   maxAttempts?: number,
 *   fetchImpl?: typeof fetch,
 * }} ResponsesRequestOptions
 */

/**
 * @param {{ apiKey: string, isAzure: boolean }} options
 * @returns {Record<string, string>}
 */
export function getOpenAIHeaders({ apiKey, isAzure }) {
  if (isAzure) {
    return { 'api-key': apiKey, 'Content-Type': 'application/json' };
  }
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {number} status
 * @param {string} bodyText
 * @returns {boolean}
 */
export function isRetryableResponsesFailure(status, bodyText) {
  if ([408, 409, 429, 500, 502, 503, 504].includes(status)) return true;
  return /type ['"]reasoning['"] was provided without its required following item/i.test(bodyText);
}

/**
 * @param {Record<string, unknown>} body
 * @param {ResponsesRequestOptions} options
 * @returns {Promise<Response>}
 */
export async function createResponsesRequest(body, options) {
  const {
    baseUrl,
    apiKey,
    isAzure,
    retryDelayMs = 350,
    maxAttempts = 2,
    fetchImpl = fetch,
  } = options;
  const url = `${baseUrl}/responses`;

  for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
    let resp;

    try {
      resp = await fetchImpl(url, {
        method: 'POST',
        headers: getOpenAIHeaders({ apiKey, isAzure }),
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (attempt < maxAttempts) {
        await sleep(retryDelayMs);
        continue;
      }
      throw error instanceof Error ? error : new Error(String(error));
    }

    if (resp.ok) {
      return resp;
    }

    const errText = await resp.text();
    if (attempt < maxAttempts && isRetryableResponsesFailure(resp.status, errText)) {
      await sleep(retryDelayMs);
      continue;
    }

    throw new Error(`LLM request failed: ${resp.status} ${errText}`);
  }

  throw new Error('LLM request failed: responses request did not complete');
}
