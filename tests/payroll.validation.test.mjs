/**
 * Free-core payroll tests (AGPL). Payslip reconciliation lives in worker/ and
 * is covered by tests/reconcile.validation.test.mjs.
 *
 * Reference data: two real Comarch ERP Optima payslips ("Kwitek wypłaty"),
 * 27 000 zł/mies. contract, 2026 periods 07 and 08.
 *
 *   Contract gross                27 000,00
 *   ER Medicover Zdrowie             105,00   taxable, employer-funded (non-cash)
 *   ER Multisport Pracownik           35,00   taxable, employer-funded (non-cash)
 *   → taxable gross / ZUS base     27 140,00
 *
 *   Internet Plan Poland             +50,00   non-taxable, paid in cash
 *   Medicover Zdrowie                −15,75   non-taxable net deduction
 *   Multisport Pracownik            −167,82   non-taxable net deduction
 *   → net add-on                    −133,57
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'public/payroll.js'), 'utf8');
// eslint-disable-next-line no-new-func
const P = new Function(src + '\nreturn PayrollCore;')();

const GROSS = 27140.0;      // taxable gross
const NON_CASH = 140.0;     // ER Medicover 105 + ER Multisport 35
const NET_ADDON = 50.0 - 15.75 - 167.82; // −133,57
const CAP_2026 = 282600;

/** Cumulative taxable base before each payslip, read from "Narastająco w roku". */
const CUM_TB_BEFORE_JUL = 106188.7 - 15984.0; // 90 204,70
const CUM_TB_BEFORE_AUG = 106188.7;


const money = (n) => Math.round(n * 100) / 100;

describe('bracket-crossing month', () => {
  const taxBase = 15984.0;
  const cumBefore = CUM_TB_BEFORE_AUG;

  it('applies the full 300 zł ulga, not a pro-rata share', () => {
    expect(P.advance(taxBase, cumBefore).tax).toBe(2053);
  });

  it('a pro-rata ulga would overstate the tax by ~41 zł (the old bug)', () => {
    const i12 = P.TAX_BRACKET - cumBefore;
    const i32 = taxBase - i12;
    const prorata = i12 * 0.12 + i32 * 0.32 - 300 * (i12 / taxBase);
    expect(Math.round(prorata)).toBe(2093);
  });

  it('flags the month as 32%', () => {
    const a = P.advance(taxBase, cumBefore);
    expect(a.crossed).toBe(true);
    expect(a.rate32).toBe(true);
  });

  it('rounds base and advance to whole złoty (art. 63 § 1 Ord. pod.)', () => {
    const a = P.advance(12926.09, 0);
    expect(a.base).toBe(12926);
    expect(Number.isInteger(a.tax)).toBe(true);
  });

  it('never returns a negative advance', () => {
    expect(P.advance(1000, 0).tax).toBe(0);
  });
});


describe('employer side — "Płatnik" block', () => {
  // This employer's accident rate, read off the payslip: 181,84 / 27 140
  const WYP = 0.67;

  it('matches the payslip line for line', () => {
    const e = P.employerCost({ gross: GROSS, wypRate: WYP, ppkPct: 0 });
    expect(money(e.em)).toBe(2648.86);
    expect(money(e.re)).toBe(1764.1);
    expect(money(e.wyp)).toBe(181.84);
    expect(money(e.zusTotal)).toBe(4594.8);
    expect(money(e.fp)).toBe(664.93);
    expect(money(e.fgsp)).toBe(27.14);
  });

  it('charges no employer PPK when the employee opted out', () => {
    expect(P.employerCost({ gross: GROSS, wypRate: WYP, ppkPct: 0 }).ppk).toBe(0);
    expect(money(P.employerCost({ gross: GROSS, wypRate: WYP, ppkPct: 2 }).ppk)).toBe(407.1);
  });

  it('total loaded cost is 1.1948× gross at 0.67% and no PPK', () => {
    const e = P.employerCost({ gross: GROSS, wypRate: WYP, ppkPct: 0 });
    expect(money(e.total)).toBe(32426.87);
    expect(e.total / GROSS).toBeCloseTo(1.1948, 4);
  });

  it('the old hardcoded 1.67% overstated cost by 1% of gross', () => {
    const lo = P.employerCost({ gross: GROSS, wypRate: 0.67, ppkPct: 0 });
    const hi = P.employerCost({ gross: GROSS, wypRate: 1.67, ppkPct: 0 });
    expect(money(hi.total - lo.total)).toBe(271.4);
  });

  it('drops employer em/re once the ZUS cap is reached', () => {
    const e = P.employerCost({ gross: GROSS, wypRate: WYP, ppkPct: 0, capped: true });
    expect(e.em).toBe(0);
    expect(e.re).toBe(0);
    expect(money(e.wyp)).toBe(181.84); // wypadkowa is never capped
  });
});

describe('annual KUP budget', () => {
  const SHARE = 0.8961; // back-solved from the July 2026 payslip
  const WD_2026 = [20, 20, 22, 21, 20, 21, 23, 20, 22, 22, 20, 20];
  const social = GROSS * P.ZUS_SOCIAL_RATE;
  const fullKup = 0.5 * SHARE * (GROSS - social);

  const months = (daysOff = [], rate32From = 9) =>
    WD_2026.map((wd, i) => ({
      fullKup, workDays: wd, daysOff: daysOff[i] || 0, rate32: i >= rate32From
    }));

  it('12 full months would exceed the 120 000 zł limit, creating a buffer', () => {
    const b = P.kupBudget({ months: months() });
    expect(b.capped).toBe(true);
    expect(Math.round(b.uncapped)).toBe(125915);
    expect(Math.round(b.headroom)).toBe(5915);
  });

  it('the buffer is worth about 12 working days', () => {
    const b = P.kupBudget({ months: months() });
    expect(b.headroomDays).toBeGreaterThan(11);
    expect(b.headroomDays).toBeLessThan(13);
  });

  it('days inside the buffer leave days still free', () => {
    const b = P.kupBudget({ months: months([0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0]) });
    expect(b.daysOff).toBe(5);
    expect(b.exhausted).toBe(false);
    expect(b.daysLeft).toBeGreaterThan(6);
  });

  it('reports the buffer as spent once days off exceed it', () => {
    const b = P.kupBudget({ months: months([2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0]) });
    expect(b.daysOff).toBe(16);
    expect(b.exhausted).toBe(true);
  });

  it('counts KUP already settled this year against the buffer', () => {
    // From the August payslip: 244 260 base − social − 122 172,70 taxable base
    const used = 244260 - 244260 * P.ZUS_SOCIAL_RATE - 122172.7;
    expect(Math.round(used)).toBe(88599);
    // Periods 09/10/11 are all that is left of tax year 2026. Three full months
    // of KUP land ~78 zł over the limit, i.e. under a fifth of a day of buffer.
    const rest = P.kupBudget({ months: months().slice(0, 3), kupUsed: used });
    expect(Math.round(rest.headroom)).toBe(78);
    expect(rest.headroomDays).toBeLessThan(0.2);

    // So a single further day off in those months is already unaffordable.
    const oneDay = P.kupBudget({
      months: months([1]).slice(0, 3), kupUsed: used
    });
    expect(oneDay.exhausted).toBe(true);
  });

  it('prices a day in a 32% month at ~2.7× a day in a 12% month', () => {
    const b = P.kupBudget({ months: months() });
    expect(b.costPerDay[0]).toBeCloseTo(fullKup / 20 * 0.12, 6);
    expect(b.costPerDay[10]).toBeCloseTo(fullKup / 20 * 0.32, 6);
    expect(b.costPerDay[10] / b.costPerDay[0]).toBeCloseTo(32 / 12, 6);
  });

  it('reports no buffer when a low honorarium share keeps KUP under the limit', () => {
    const low = 0.635; // the August share, after 5 unreported creative days
    const b = P.kupBudget({
      months: WD_2026.map((wd) => ({
        fullKup: 0.5 * low * (GROSS - social), workDays: wd, daysOff: 0, rate32: false
      }))
    });
    expect(b.capped).toBe(false);
    expect(b.headroomDays).toBe(0);
  });
});

describe('ZUS 30× cap', () => {
  it('splits emerytalna/rentowa in the month the cap is crossed', () => {
    const cum = 271400; // 10 payslips × 27 140
    const z = P.zusSlice(GROSS, cum, CAP_2026);
    const part = CAP_2026 - cum; // 11 200
    expect(money(z.em)).toBe(money(part * 0.0976));
    expect(money(z.re)).toBe(money(part * 0.015));
    expect(z.capped).toBe(true);
  });

  it('never caps chorobowa', () => {
    const z = P.zusSlice(GROSS, 999999, CAP_2026);
    expect(money(z.ch)).toBe(664.93);
    expect(z.em).toBe(0);
    expect(z.re).toBe(0);
  });
});

describe('working-time calendar', () => {
  it('matches the 2026 payslips: July 23 days, August 20 days', () => {
    const wt = P.workingTime(2026);
    expect(wt.workDays[6]).toBe(23); // 184 h
    expect(wt.workDays[7]).toBe(20); // 160 h
  });

  it('applies the Saturday day-off-in-lieu rule (art. 130 § 2 KP)', () => {
    // 15 Aug 2026 and 26 Dec 2026 both fall on a Saturday
    const wt = P.workingTime(2026);
    expect(wt.satHolidays[7]).toBe(1);
    expect(wt.satHolidays[11]).toBe(1);
  });

  it('treats Wigilia as a public holiday from 2025 only', () => {
    const k = (y, m, d) => `${y}-${m}-${d}`;
    expect(P.polishHolidays(2024)[k(2024, 12, 24)]).toBeUndefined();
    expect(P.polishHolidays(2025)[k(2025, 12, 24)]).toBe(true);
    expect(P.polishHolidays(2026)[k(2026, 12, 24)]).toBe(true);
  });

  it('gives the statutory yearly working time', () => {
    // Nominal hours published by PIP for these years
    const hours = (y) => P.workingTime(y).workDays.reduce((s, d) => s + d, 0) * 8;
    expect(hours(2025)).toBe(1992);
    expect(hours(2026)).toBe(2008);
    expect(hours(2027)).toBe(2008);
  });

  it('computes Easter correctly', () => {
    const iso = (d) => d.toISOString().slice(0, 10);
    expect(iso(P.easterSunday(2025))).toBe('2025-04-20');
    expect(iso(P.easterSunday(2026))).toBe('2026-04-05');
    expect(iso(P.easterSunday(2027))).toBe('2027-03-28');
  });
});
