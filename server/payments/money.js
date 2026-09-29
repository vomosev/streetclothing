'use strict';

// Every amount in the payments module is an integer in the currency's smallest
// unit (cents, kobo, pesewas...). Providers that want major units (Flutterwave,
// PayPal) convert at the edge with these helpers.

const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
  'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

function decimalsFor(currency) {
  return ZERO_DECIMAL.has(String(currency).toUpperCase()) ? 0 : 2;
}

function toMajor(amountMinor, currency) {
  return Number(amountMinor) / 10 ** decimalsFor(currency);
}

function toMajorString(amountMinor, currency) {
  return toMajor(amountMinor, currency).toFixed(decimalsFor(currency));
}

function fromMajor(amountMajor, currency) {
  return Math.round(Number(amountMajor) * 10 ** decimalsFor(currency));
}

module.exports = { decimalsFor, toMajor, toMajorString, fromMajor };
