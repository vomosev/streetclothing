'use strict';

// JSON-over-HTTPS helper shared by every provider (uses Node 18+ global fetch,
// so the payments module adds no npm dependencies).

const DEFAULT_TIMEOUT_MS = 20000;

class ProviderError extends Error {
  constructor(provider, message, { status, body } = {}) {
    super(`[${provider}] ${message}`);
    this.name = 'ProviderError';
    this.provider = provider;
    this.status = status;
    this.body = body;
  }
}

function describeError(data, fallback) {
  if (!data) return fallback;
  return (
    data.error?.message ||
    data.error_description ||
    data.details?.[0]?.description ||
    data.message ||
    (typeof data.error === 'string' ? data.error : null) ||
    fallback
  );
}

/**
 * @param {string} provider - provider id, used in error messages
 * @param {string} url
 * @param {Object} [options]
 * @param {string} [options.method='GET']
 * @param {Object} [options.headers]
 * @param {*} [options.body] - sent as JSON
 * @param {string|Object} [options.form] - sent as application/x-www-form-urlencoded
 * @returns {Promise<Object|null>} parsed JSON body (null for empty responses)
 */
async function requestJson(provider, url, { method = 'GET', headers = {}, body, form, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const init = {
    method,
    headers: { Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  };

  if (form !== undefined) {
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = typeof form === 'string' ? form : new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const pathname = new URL(url).pathname;
  let response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    throw new ProviderError(provider, `${method} ${pathname} failed: ${err.message}`);
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }
  }

  if (!response.ok) {
    throw new ProviderError(
      provider,
      `${method} ${pathname} returned ${response.status}: ${describeError(data, response.statusText)}`,
      { status: response.status, body: data }
    );
  }

  return data;
}

module.exports = { requestJson, ProviderError };
