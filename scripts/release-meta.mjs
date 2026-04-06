/**
 * - Writes public/release.json from CHANGELOG.md + package.json
 * - Copies CHANGELOG.md → public/changelog.md for the static site
 * - If DEPLOY_RELEASE=1: bumps patch in package.json and prepends a CHANGELOG
 *   section (summary from RELEASE_SUMMARY, first line only)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = path.join(root, 'package.json');
const clPath = path.join(root, 'CHANGELOG.md');
const outPath = path.join(root, 'public', 'release.json');
const pubChangelogPath = path.join(root, 'public', 'changelog.md');

function bump() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const parts = pkg.version.split('.').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error('package.json version must be semver x.y.z');
  }
  parts[2] += 1;
  const nv = `${parts[0]}.${parts[1]}.${parts[2]}`;
  pkg.version = nv;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  let summary = process.env.RELEASE_SUMMARY || 'Deploy';
  summary = summary.split('\n')[0].trim().replace(/\r/g, '');
  if (!summary) summary = 'Deploy';
  if (summary.length > 320) summary = summary.slice(0, 317) + '...';
  const date = new Date().toISOString().slice(0, 10);

  let cl = fs.existsSync(clPath) ? fs.readFileSync(clPath, 'utf8') : '';
  if (!cl.trimStart().startsWith('#')) {
    cl = '# Changelog\n\n' + cl;
  }
  const block = `## [${nv}] - ${date}\n- ${summary}\n\n`;
  const nl = cl.indexOf('\n');
  const insertAt = nl === -1 ? cl.length : nl + 1;
  cl = cl.slice(0, insertAt) + '\n' + block + cl.slice(insertAt);
  fs.writeFileSync(clPath, cl);
}

/**
 * @param {string} text
 * @returns {{ version: string, date: string, changes: string[] }[]}
 */
function parseChangelog(text) {
  const history = [];
  const re = /^## \[([^\]]+)\]\s*-\s*(\d{4}-\d{2}-\d{2})\s*$/gm;
  const matches = [...text.matchAll(re)];
  for (let i = 0; i < matches.length; i++) {
    const ver = matches[i][1];
    const date = matches[i][2];
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const body = text.slice(start, end).trim();
    const changes = body
      .split(/\n/)
      .map((l) => l.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
    history.push({ version: ver, date, changes });
  }
  return history;
}

function writeReleaseJson() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const cl = fs.existsSync(clPath) ? fs.readFileSync(clPath, 'utf8') : '';
  const history = parseChangelog(cl);
  const payload = {
    version: pkg.version,
    history,
    generated: new Date().toISOString().slice(0, 10),
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n');
  if (fs.existsSync(clPath)) {
    fs.copyFileSync(clPath, pubChangelogPath);
  }
}

if (process.env.DEPLOY_RELEASE === '1') {
  bump();
}
writeReleaseJson();
