/**
 * Proprietary — see LICENSE-paid.
 *
 * Cloudflare Worker exposing the paid payslip-reconciliation endpoint.
 *
 * Deliberately minimal: a licence key in a header, checked against a KV
 * namespace. No accounts, no database, no personal data stored — the request
 * body is figures the caller already has, and nothing is persisted.
 *
 *   wrangler dev            # local, uses LICENCE_KEYS from wrangler.toml vars
 *   wrangler deploy
 */
import { reconcile } from './reconcile.mjs';

const CORS = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Licence-Key',
  'Access-Control-Max-Age': '86400'
});

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : allowed[0] || '';
}

/**
 * A key is valid if it is listed in the LICENCE_KEYS KV namespace and has not
 * expired. Keys are issued by the payment provider's webhook, not here.
 */
async function checkLicence(key, env) {
  if (!key) return { ok: false, status: 401, error: 'licence key required' };
  if (!env.LICENCE_KEYS) return { ok: false, status: 503, error: 'licensing unavailable' };
  const raw = await env.LICENCE_KEYS.get(key);
  if (!raw) return { ok: false, status: 403, error: 'invalid licence key' };
  let rec;
  try { rec = JSON.parse(raw); } catch { return { ok: false, status: 403, error: 'invalid licence key' }; }
  if (rec.expires && Date.parse(rec.expires) < Date.now()) {
    return { ok: false, status: 403, error: 'licence expired' };
  }
  return { ok: true };
}

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }
  });

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    const cors = CORS(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors);

    const url = new URL(request.url);
    if (url.pathname !== '/v1/reconcile') return json({ error: 'not found' }, 404, cors);

    const lic = await checkLicence(request.headers.get('X-Licence-Key'), env);
    if (!lic.ok) return json({ error: lic.error }, lic.status, cors);

    let input;
    try {
      input = await request.json();
    } catch {
      return json({ error: 'invalid JSON body' }, 400, cors);
    }

    const result = reconcile(input);
    return json(result, result.ok ? 200 : 400, cors);
  }
};
