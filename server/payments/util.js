'use strict';

// Shared helpers for the payments module. Pre-built by the AI builder — edit
// plans.js to change what is sold; the rest of this folder is provider plumbing.

const crypto = require('crypto');

class PaymentsError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'PaymentsError';
    this.status = status;
  }
}

function newReference() {
  return `pay_${crypto.randomBytes(12).toString('hex')}`;
}

function isReference(value) {
  return typeof value === 'string' && /^pay_[a-f0-9]{24}$/.test(value);
}

// Constant-time string comparison for webhook signatures.
function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

module.exports = { PaymentsError, newReference, isReference, safeEqual, sha256 };
