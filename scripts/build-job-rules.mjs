/**
 * Validates/normalizes public/job-rules.json. If index.html still has inline
 * `const JOB_RULES = [...]`, extracts from HTML first.
 * Run: node scripts/build-job-rules.mjs (also chained before vite build)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root, 'index.html');
const outPath = path.join(root, 'public', 'job-rules.json');

function extractFromHtml(html) {
  const startMark = 'const JOB_RULES = [';
  const i = html.indexOf(startMark);
  if (i < 0) return null;
  let pos = i + startMark.length;
  let depth = 1;
  const start = pos;
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
  const body = html.slice(start, pos - 1);
  return new Function('return [' + body + ']')();
}

function loadRules() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const extracted = extractFromHtml(html);
  if (extracted) {
    console.log('Extracted JOB_RULES from index.html');
    return extracted;
  }
  if (!fs.existsSync(outPath)) throw new Error('No inline JOB_RULES and missing public/job-rules.json');
  const j = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  const rules = Array.isArray(j) ? j : j.rules;
  if (!Array.isArray(rules)) throw new Error('public/job-rules.json: expected { rules: [] } or array');
  console.log('Loaded rules from public/job-rules.json');
  return rules;
}

const rules = loadRules();
const payload = {
  version: 1,
  generated: new Date().toISOString().slice(0, 10),
  rules,
  trust: {
    pkwiu_mapping: 'heuristic',
    note_pl:
      'Lista mapuje tytuły słowne na PKWiU i stawkę orientacyjnie. Wiążące są PKWiU w CEIDG, art. 12 ustawy oraz ewentualna interpretacja indywidualna.',
    note_en:
      'This list maps job titles to PKWiU and rate heuristically. Binding: your PKWiU in CEIDG, art. 12 of the Act, and any individual tax interpretation.',
  },
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log('Wrote', outPath, '—', rules.length, 'rules');
