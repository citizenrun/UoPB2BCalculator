/**
 * Replace inline `const JOB_RULES = [...]` with fetch loader. Run after
 * `node scripts/build-job-rules.mjs` populated public/job-rules.json.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const startMark = 'const JOB_RULES = [';
const i = html.indexOf(startMark);
if (i < 0) {
  console.error('const JOB_RULES = [ not found (already patched?)');
  process.exit(1);
}
let pos = i + startMark.length;
let depth = 1;
while (pos < html.length && depth > 0) {
  const c = html[pos];
  if (c === "'") {
    pos++;
    while (pos < html.length) {
      const ch = html[pos];
      if (ch === '\\') {
        pos += 2;
        continue;
      }
      if (ch === "'") {
        pos++;
        break;
      }
      pos++;
    }
    continue;
  }
  if (c === '"') {
    pos++;
    while (pos < html.length) {
      const ch = html[pos];
      if (ch === '\\') {
        pos += 2;
        continue;
      }
      if (ch === '"') {
        pos++;
        break;
      }
      pos++;
    }
    continue;
  }
  if (c === '[') depth++;
  else if (c === ']') depth--;
  pos++;
}
const end = pos;
const before = html.slice(0, i);
const after = html.slice(end);

const inject = `let JOB_RULES = [];

function resolveAppAssetUrl(filename) {
  let p = window.location.pathname;
  if (!p.endsWith('/')) {
    if (/\\.html?$/i.test(p)) p = p.replace(/[^/]+$/, '');
    else p = p + '/';
  }
  return new URL(filename, window.location.origin + p).href;
}

(async function loadJobRulesFromJson() {
  window.__JOB_RULES_READY = false;
  window.__JOB_RULES_OK = false;
  try {
    const res = await fetch(resolveAppAssetUrl('job-rules.json'), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const rules = Array.isArray(data) ? data : (data.rules || []);
    if (!Array.isArray(rules) || rules.length < 1) throw new Error('empty rules');
    JOB_RULES = rules;
    window.__JOB_RULES_OK = true;
  } catch (err) {
    console.error('JOB_RULES load failed', err);
    JOB_RULES = [];
    window.__JOB_RULES_LOAD_ERROR = String(err && err.message ? err.message : err);
  } finally {
    window.__JOB_RULES_READY = true;
    if (!window.__JOB_RULES_OK) {
      var wb = document.getElementById('b2b-warn-body');
      if (wb && !wb.querySelector('.job-rules-load-err')) {
        var en = typeof LANG !== 'undefined' && LANG === 'en';
        wb.insertAdjacentHTML('beforeend', '<p class="job-rules-load-err" style="margin-top:10px;color:#b91c1c">' +
          (en
            ? '<strong>Role list unavailable.</strong> Use a web server (<code>npm run dev</code>) or the GitHub Pages URL — <code>file://</code> cannot load <code>job-rules.json</code>. You can still set the tax form manually.'
            : '<strong>Lista ról niedostępna.</strong> Użyj serwera (<code>npm run dev</code>) lub adresu GitHub Pages — przy <code>file://</code> nie załaduje się <code>job-rules.json</code>. Formę ustawisz ręcznie.') +
          '</p>');
      }
    }
  }
})();
`;

fs.writeFileSync(htmlPath, before + inject + after);
console.log('Patched index.html: inline JOB_RULES → fetch job-rules.json');
