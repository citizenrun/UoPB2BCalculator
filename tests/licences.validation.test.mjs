/**
 * Paid-module tests — worker/licences.mjs (proprietary, see LICENSE-paid).
 *
 * Covers the two things a licence webhook must never get wrong: accepting an
 * unsigned or forged request, and minting a second key when the provider
 * retries an event it already delivered.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifySignature, generateKey, applyEvent } from '../worker/licences.mjs';
import worker from '../worker/index.mjs';

const SECRET = 'test-signing-secret';
const sign = (body) => createHmac('sha256', SECRET).update(body).digest('hex');

function makeKV() {
  return {
    store: new Map(),
    async get(k) { return this.store.has(k) ? this.store.get(k) : null; },
    async put(k, v) { this.store.set(k, v); }
  };
}

const event = (name, id, attrs = {}) => ({
  meta: { event_name: name },
  data: { id, attributes: attrs }
});

describe('webhook signature', () => {
  it('accepts a correctly signed body', async () => {
    const body = JSON.stringify(event('order_created', '1'));
    expect(await verifySignature(body, sign(body), SECRET)).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const body = JSON.stringify(event('order_created', '1'));
    const sig = sign(body);
    const tampered = JSON.stringify(event('order_created', '999'));
    expect(await verifySignature(tampered, sig, SECRET)).toBe(false);
  });

  it('rejects a wrong secret, a missing signature and a missing secret', async () => {
    const body = 'x';
    expect(await verifySignature(body, sign(body), 'other-secret')).toBe(false);
    expect(await verifySignature(body, null, SECRET)).toBe(false);
    expect(await verifySignature(body, sign(body), undefined)).toBe(false);
  });

  it('is case- and whitespace-insensitive about the hex signature', async () => {
    const body = 'x';
    expect(await verifySignature(body, ' ' + sign(body).toUpperCase() + ' ', SECRET)).toBe(true);
  });
});

describe('generateKey', () => {
  it('produces grouped, unambiguous, unique keys', () => {
    const k = generateKey();
    expect(k).toMatch(/^[A-HJ-NP-Z2-9]{5}(-[A-HJ-NP-Z2-9]{5}){3}$/);
    const many = new Set(Array.from({ length: 500 }, generateKey));
    expect(many.size).toBe(500);
  });
});

describe('applyEvent', () => {
  let env;
  beforeEach(() => { env = { LICENCE_KEYS: makeKV() }; });

  it('issues a key on a new order', async () => {
    const r = await applyEvent(event('order_created', '42', { variant_name: 'Advanced' }), env);
    expect(r.ok).toBe(true);
    expect(r.action).toBe('issued');
    const rec = JSON.parse(await env.LICENCE_KEYS.get(r.key));
    expect(rec.status).toBe('active');
    expect(rec.plan).toBe('Advanced');
    expect(Date.parse(rec.expires)).toBeGreaterThan(Date.now());
  });

  it('is idempotent — a retried event reuses the same key', async () => {
    const ev = event('order_created', '42', { variant_name: 'Advanced' });
    const a = await applyEvent(ev, env);
    const b = await applyEvent(ev, env);
    expect(b.key).toBe(a.key);
    expect(b.action).toBe('renewed');
    const keys = [...env.LICENCE_KEYS.store.keys()].filter((k) => !k.startsWith('order:'));
    expect(keys).toHaveLength(1);
  });

  it('extends the same key on renewal', async () => {
    const a = await applyEvent(event('subscription_created', '7', { renews_at: '2027-01-01T00:00:00Z' }), env);
    const b = await applyEvent(event('subscription_payment_success', '7', { renews_at: '2028-01-01T00:00:00Z' }), env);
    expect(b.key).toBe(a.key);
    expect(JSON.parse(await env.LICENCE_KEYS.get(a.key)).expires).toBe('2028-01-01T00:00:00Z');
  });

  it('revokes on refund and on cancellation', async () => {
    for (const evName of ['order_refunded', 'subscription_expired']) {
      env = { LICENCE_KEYS: makeKV() };
      const a = await applyEvent(event('order_created', '9'), env);
      const r = await applyEvent(event(evName, '9', { ends_at: '2026-01-01T00:00:00Z' }), env);
      expect(r.action).toBe('revoked');
      expect(JSON.parse(await env.LICENCE_KEYS.get(a.key)).status).toBe('revoked');
    }
  });

  it('ignores unrelated events without issuing anything', async () => {
    const r = await applyEvent(event('license_key_created', '5'), env);
    expect(r.action).toBe('ignored');
    expect(env.LICENCE_KEYS.store.size).toBe(0);
  });

  it('rejects malformed payloads', async () => {
    expect((await applyEvent({}, env)).ok).toBe(false);
    expect((await applyEvent({ meta: {} }, env)).ok).toBe(false);
  });
});

describe('webhook route end to end', () => {
  const env = () => ({
    LICENCE_KEYS: makeKV(),
    LS_WEBHOOK_SECRET: SECRET,
    ALLOWED_ORIGINS: 'http://localhost:5173'
  });
  const post = (body, sig, e) => worker.fetch(new Request('https://x/v1/webhook/lemonsqueezy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(sig ? { 'X-Signature': sig } : {}) },
    body
  }), e);

  it('issues on a signed order and never echoes the key', async () => {
    const e = env();
    const body = JSON.stringify(event('order_created', '77', { variant_name: 'Advanced' }));
    const res = await post(body, sign(body), e);
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out).toEqual({ ok: true, action: 'issued' });
    expect(JSON.stringify(out)).not.toMatch(/[A-HJ-NP-Z2-9]{5}-/);
  });

  it('rejects an unsigned or forged webhook', async () => {
    const e = env();
    const body = JSON.stringify(event('order_created', '78'));
    expect((await post(body, null, e)).status).toBe(401);
    expect((await post(body, 'deadbeef', e)).status).toBe(401);
    expect(e.LICENCE_KEYS.store.size).toBe(0);
  });

  it('issued keys then work against the paid endpoint', async () => {
    const e = env();
    const body = JSON.stringify(event('order_created', '79', { variant_name: 'Advanced' }));
    await post(body, sign(body), e);
    const key = [...e.LICENCE_KEYS.store.keys()].find((k) => !k.startsWith('order:'));

    const call = (k) => worker.fetch(new Request('https://x/v1/reconcile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Licence-Key': k, Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        gross: 27140, nonCash: 140, kup: 10493.02, cumTaxBase: 90204.7,
        netAddon: 50 - 15.75 - 167.82, netto: 19786.82, ppkPct: 0
      })
    }), e);

    const good = await call(key);
    expect(good.status).toBe(200);
    expect((await good.json()).matches).toBe(true);
    expect((await call('NOT-A-REAL-KEY')).status).toBe(403);
  });
});
