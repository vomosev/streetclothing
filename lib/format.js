// lib/format.js
// Pure formatting helpers shared across the STREET/PLATINUM storefront.
// No side effects, no browser-only APIs at module scope.

const ZERO_DECIMAL_CURRENCIES = ['JPY', 'XOF', 'XAF', 'UGX', 'RWF', 'KRW', 'VND', 'CLP', 'BIF', 'DJF', 'GNF', 'KMF', 'MGA', 'PYG', 'VUV'];

/**
 * True when the currency has no minor unit (amounts are not divided by 100).
 */
export function isZeroDecimalCurrency(currency) {
  if (!currency || typeof currency !== 'string') return false;
  return ZERO_DECIMAL_CURRENCIES.includes(currency.toUpperCase());
}

/**
 * Convert a smallest-unit integer amount into its major-unit number.
 */
export function toMajorUnits(amountInCents, currency = 'USD') {
  const amount = Number(amountInCents);
  if (!Number.isFinite(amount)) return 0;
  return isZeroDecimalCurrency(currency) ? amount : amount / 100;
}

/**
 * Format an amount given in the smallest currency unit (e.g. 1500 -> "$15.00").
 */
export function formatPrice(amountInCents, currency = 'USD') {
  const code = typeof currency === 'string' && currency.trim() ? currency.trim().toUpperCase() : 'USD';
  const value = toMajorUnits(amountInCents, code);

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
    }).format(value);
  } catch (err) {
    // Unknown currency code or an environment without full ICU data.
    const fixed = isZeroDecimalCurrency(code) ? String(Math.round(value)) : value.toFixed(2);
    return `${code} ${fixed}`;
  }
}

/**
 * Format a date-ish value into a readable medium date. Returns '—' when invalid.
 */
export function formatDate(value, options) {
  if (value === null || value === undefined || value === '') return '—';

  let date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    // Treat 10-digit numbers as unix seconds.
    date = new Date(value < 1e12 ? value * 1000 : value);
  } else {
    date = new Date(value);
  }

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';

  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(options || {}),
    }).format(date);
  } catch (err) {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Format a date value with the time of day included.
 */
export function formatDateTime(value) {
  return formatDate(value, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Turn a billing interval into readable copy: 'per month', 'every 3 weeks'.
 */
export function formatInterval(input) {
  if (!input) return '';

  const interval = typeof input === 'string' ? input : input.interval;
  const rawCount = typeof input === 'string' ? 1 : input.intervalCount;

  if (!interval || typeof interval !== 'string') return '';

  const unit = interval.toLowerCase();
  const count = Number.isFinite(Number(rawCount)) && Number(rawCount) > 0 ? Math.round(Number(rawCount)) : 1;

  if (count === 1) return `per ${unit}`;
  return `every ${count} ${unit}s`;
}

/**
 * Convert slugs / snake_case / SCREAMING_CASE into Title Case words.
 */
export function titleCase(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (!text) return '';

  return text
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Small helper used by badges to present statuses consistently.
 */
export function formatStatus(status) {
  return titleCase(status || 'unknown');
}

export default {
  formatPrice,
  formatDate,
  formatDateTime,
  formatInterval,
  formatStatus,
  titleCase,
  toMajorUnits,
  isZeroDecimalCurrency,
};