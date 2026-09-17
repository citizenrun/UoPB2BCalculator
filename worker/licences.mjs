/**
 * Proprietary — see LICENSE-paid.
 *
 * Licence issuing, driven by Lemon Squeezy webhooks.
 *
 * Stored per key in the LICENCE_KEYS KV namespace:
 *   { plan, expires, orderId, status }
 *
 * Deliberately NOT stored: name, email, address, card details, anything else
 * about the buyer. The merchant of record already holds that and is the data
 * controller for it; we only need to answer "is this key still valid?".
 */

const enc = new TextEncoder();

/** Constant-time comparison — avoids leaking the signature via timing. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a Lemon Squeezy webhook. The signature is a hex HMAC-SHA256 of the
 * RAW request body using the store's signing secret, sent as X-Signature.
 * The raw body must be used — re-serialising parsed JSON changes the bytes.
 */
export async function verifySignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  return timingSafeEqual(toHex(mac), signature.trim().toLowerCase());
}

/** A licence key: URL-safe, unambiguous, long enough not to be guessable. */
export function generateKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    if (i > 0 && i % 5 === 0) out += '-';
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/** Events that should grant or extend access, and those that should end it. */
const GRANTS = new Set([
  'order_created',
  'subscription_created',
  'subscription_updated',
  'subscription_payment_success',
  'subscription_resumed'
]);
const REVOKES = new Set([
  'subscription_expired',
  'subscription_cancelled',
  'order_refunded'
]);

/**
 * Apply one webhook event to KV.
 *
 * Idempotent: Lemon Squeezy retries, so the same event must not mint a second
 * key. The key is looked up by order id via an `order:<id>` pointer.
 */
export async function applyEvent(payload, env) {
  const name = payload?.meta?.event_name;
  const data = payload?.data;
  if (!name || !data) return { ok: false, status: 400, error: 'malformed payload' };
  if (!env.LICENCE_KEYS) return { ok: false, status: 503, error: 'licensing unavailable' };

  const orderId = String(data.id ?? payload?.meta?.custom_data?.order_id ?? '');
  if (!orderId) return { ok: false, status: 400, error: 'missing order id' };

  const attrs = data.attributes || {};
  const pointer = 'order:' + orderId;

  if (REVOKES.has(name)) {
    const existing = await env.LICENCE_KEYS.get(pointer);
    if (existing) {
      const rec = JSON.parse((await env.LICENCE_KEYS.get(existing)) || '{}');
      rec.status = 'revoked';
      rec.expires = attrs.ends_at || new Date().toISOString();
      await env.LICENCE_KEYS.put(existing, JSON.stringify(rec));
    }
    return { ok: true, action: 'revoked', key: existing || null };
  }

  if (!GRANTS.has(name)) return { ok: true, action: 'ignored', event: name };

  // Renewals and updates reuse the key already issued for this order.
  let key = await env.LICENCE_KEYS.get(pointer);
  const created = !key;
  if (!key) {
    key = generateKey();
    await env.LICENCE_KEYS.put(pointer, key);
  }

  const record = {
    plan: attrs.variant_name || attrs.product_name || 'advanced',
    // renews_at for subscriptions; a one-off order gets a year.
    expires: attrs.renews_at || attrs.ends_at
      || new Date(Date.now() + 365 * 86400000).toISOString(),
    orderId,
    status: 'active'
  };
  await env.LICENCE_KEYS.put(key, JSON.stringify(record));

  return { ok: true, action: created ? 'issued' : 'renewed', key, expires: record.expires };
}
