/**
 * Contract tests: public/job-rules.json vs B2B <select> and art. 12 rate map.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

const jobRulesFile = readJson('public/job-rules.json');
const rules = Array.isArray(jobRulesFile) ? jobRulesFile : jobRulesFile.rules;
const art12 = readJson('data/ryczalt-art12-by-rate.json');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const B2B_SELECT_RATES = [
  'ryczalt_17',
  'ryczalt_15',
  'ryczalt_14',
  'ryczalt_12',
  'ryczalt_10',
  'ryczalt_85',
  'ryczalt_55',
  'ryczalt_3',
  'linear',
  'scale',
];

describe('job-rules.json', () => {
  it('has non-empty rules array', () => {
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
  });

  it('each rule has required fields and non-empty keywords', () => {
    const seen = new Set();
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      expect(r, `rule ${i}`).toBeTruthy();
      expect(typeof r.rate, `rule ${i} rate`).toBe('string');
      expect(typeof r.pkwiu, `rule ${i} pkwiu`).toBe('string');
      expect(r.pkwiu.trim(), `rule ${i} pkwiu non-empty`).not.toBe('');
      expect(typeof r.en, `rule ${i} en`).toBe('string');
      expect(r.en.trim(), `rule ${i} en`).not.toBe('');
      expect(typeof r.pl, `rule ${i} pl`).toBe('string');
      expect(r.pl.trim(), `rule ${i} pl`).not.toBe('');
      expect(typeof r.solo_note, `rule ${i} solo_note`).toBe('boolean');
      expect(Array.isArray(r.kw), `rule ${i} kw`).toBe(true);
      expect(r.kw.length, `rule ${i} kw length`).toBeGreaterThan(0);
      for (const kw of r.kw) {
        expect(String(kw).trim().length, `rule ${i} kw item`).toBeGreaterThan(1);
      }
      const dedupeKey = r.en + '|' + r.pkwiu;
      expect(seen.has(dedupeKey), `duplicate en|pkwiu: ${dedupeKey}`).toBe(false);
      seen.add(dedupeKey);
    }
  });

  it('every ryczałt rate in rules exists in B2B select and art12-by-rate', () => {
    for (let i = 0; i < rules.length; i++) {
      const rate = rules[i].rate;
      if (rate === 'linear' || rate === 'scale') continue;
      expect(B2B_SELECT_RATES, `rule ${i} ${rate}`).toContain(rate);
      expect(art12.by_rate[rate], `rule ${i}: missing art12.by_rate[${rate}]`).toBeTruthy();
    }
  });

  it('B2B select covers art12 keys except optional unused bands', () => {
    const used = new Set(rules.map((r) => r.rate).filter((x) => x.startsWith('ryczalt_')));
    for (const key of Object.keys(art12.by_rate)) {
      if (key === 'ryczalt_125' || key === 'ryczalt_2') continue;
      expect(B2B_SELECT_RATES).toContain(key);
    }
    for (const u of used) {
      expect(art12.by_rate[u], `used rate ${u} should have art12 row`).toBeTruthy();
    }
  });
});

describe('index.html B2B markup', () => {
  it('option values match B2B_SELECT_RATES for ryczalt and income tax forms', () => {
    for (const v of B2B_SELECT_RATES) {
      expect(indexHtml).toContain(`value="${v}"`);
    }
  });

  it('does not ship duplicate inline JOB_RULES (source: public/job-rules.json)', () => {
    expect(indexHtml.includes('const JOB_RULES = [')).toBe(false);
  });
});
