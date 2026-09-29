export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'https://streetclothing-api.arx-app.com:4117';

export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function buildUrl(path) {
  const base = String(API_BASE_URL || '').replace(/\/+$/, '');
  const suffix = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

export async function request(path, options = {}) {
  const { method = 'GET', body, signal, headers = {} } = options;

  const init = {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...headers,
    },
    signal,
  };

  if (body !== undefined && body !== null) {
    init.headers['Content-Type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(buildUrl(path), init);
  } catch (err) {
    if (err && (err.name === 'AbortError' || err.code === 20)) {
      throw err;
    }
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0, null);
  }

  let data = null;
  const text = await response.text().catch(() => '');
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const message =
      (data && (data.error || data.message)) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data === null ? {} : data;
}

function toQuery(params) {
  if (!params || typeof params !== 'object') return '';
  const search = new URLSearchParams();
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/* ---------- catalogue ---------- */

export function getProducts(params = {}, options = {}) {
  return request(`/api/products${toQuery(params)}`, options);
}

export function getCategories(options = {}) {
  return request('/api/products/categories', options);
}

export function getProduct(slug, options = {}) {
  return request(`/api/products/${encodeURIComponent(slug)}`, options);
}

/* ---------- auth ---------- */

export function signup({ fullName, email, password }, options = {}) {
  return request('/api/auth/signup', {
    ...options,
    method: 'POST',
    body: { fullName, email, password },
  });
}

export function login({ email, password }, options = {}) {
  return request('/api/auth/login', {
    ...options,
    method: 'POST',
    body: { email, password },
  });
}

export function logout(options = {}) {
  return request('/api/auth/logout', { ...options, method: 'POST' });
}

export function getMe(options = {}) {
  return request('/api/auth/me', options);
}

/* ---------- orders ---------- */

export function checkoutCart({ provider, items }, options = {}) {
  return request('/api/orders/checkout', {
    ...options,
    method: 'POST',
    body: { provider, items },
  });
}

export function getOrders(options = {}) {
  return request('/api/orders', options);
}

/* ---------- payments ---------- */

export function getPaymentProviders(options = {}) {
  return request('/api/payments/providers', options);
}

export function getPaymentPlans(options = {}) {
  return request('/api/payments/plans', options);
}

export function createPaymentCheckout({ provider, planId, productId }, options = {}) {
  const body = { provider };
  if (planId) body.planId = planId;
  if (productId) body.productId = productId;
  return request('/api/payments/checkout', { ...options, method: 'POST', body });
}

export function completePayment(reference, options = {}) {
  return request(`/api/payments/${encodeURIComponent(reference)}/complete`, {
    ...options,
    method: 'POST',
  });
}

export function getSubscription(options = {}) {
  return request('/api/payments/subscription', options);
}

export function cancelSubscription(options = {}) {
  return request('/api/payments/subscription/cancel', { ...options, method: 'POST' });
}

export function getManageUrl(options = {}) {
  return request('/api/payments/subscription/manage', options);
}

export default {
  API_BASE_URL,
  ApiError,
  request,
  getProducts,
  getCategories,
  getProduct,
  signup,
  login,
  logout,
  getMe,
  checkoutCart,
  getOrders,
  getPaymentProviders,
  getPaymentPlans,
  createPaymentCheckout,
  completePayment,
  getSubscription,
  cancelSubscription,
  getManageUrl,
};