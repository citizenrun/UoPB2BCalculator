/**
 * Paid-module tests — worker/reconcile.mjs (proprietary, see LICENSE-paid).
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
import { month, honorariumShare, reconcile } from '../worker/reconcile.mjs';

const GROSS = 27140.0;
const NON_CASH = 140.0;
const NET_ADDON = 50.0 - 15.75 - 167.82; // −133,57
const CAP_2026 = 282600;

/** Cumulative taxable base before each payslip, from "Narastająco w roku". */
const CUM_TB_BEFORE_JUL = 106188.7 - 15984.0; // 90 204,70
const CUM_TB_BEFORE_AUG = 106188.7;

const money = (n) => Math.round(n * 100) / 100;

const PAYSLIPS = [
  {
    name: '2026-07 (23 work days / 184 h)',
    kup: 10493.02,
    cumTaxBase: CUM_TB_BEFORE_JUL,
    cumErBase: 0,
    expect: { social: 3720.89, health: 2107.72, taxBase: 12926.09, tax: 1251, netto: 19786.82 }
  },
  {
    name: '2026-08 (20 work days / 160 h) — crosses the 120 000 zł bracket',
    kup: 7435.11,
    cumTaxBase: CUM_TB_BEFORE_AUG,
    cumErBase: 217120,
    expect: { social: 3720.89, health: 2107.72, taxBase: 15984.0, tax: 2053, netto: 18984.82 }
  }
];

describe('payslip calibration — 27 000 zł, 2026', () => {
  for (const ps of PAYSLIPS) {
    describe(ps.name, () => {
      const r = month({
        gross: GROSS, nonCash: NON_CASH, kup: ps.kup,
        cumErBase: ps.cumErBase, cumTaxBase: ps.cumTaxBase, cap: CAP_2026,
        ppkPct: 0, deductions: 0, netAddon: NET_ADDON
      });

      it('social contributions match the payslip', () => {
        expect(money(r.em)).toBe(2648.86);
        expect(money(r.re)).toBe(407.1);
        expect(money(r.ch)).toBe(664.93);
        expect(money(r.social)).toBe(ps.expect.social);
      });

      it('health base and contribution match the payslip', () => {
        expect(money(r.healthBase)).toBe(23419.11);
        expect(money(r.health)).toBe(ps.expect.health);
      });

      it('taxable base matches the payslip', () => {
        expect(money(r.taxBase)).toBe(ps.expect.taxBase);
      });

      it('tax advance matches the payslip', () => {
        expect(r.tax).toBe(ps.expect.tax);
      });

      it('net pay matches the payslip to the grosz', () => {
        expect(money(r.netto)).toBe(ps.expect.netto);
      });
    });
  }
});

describe('non-cash taxable benefits', () => {
  it('raise the ZUS and PIT base but are not paid out', () => {
    const common = {
      kup: 10493.02, cumErBase: 0, cumTaxBase: CUM_TB_BEFORE_JUL,
      cap: CAP_2026, netAddon: NET_ADDON
    };
    const withBenefit = month({ ...common, gross: GROSS, nonCash: NON_CASH });
    const paidOut = month({ ...common, gross: GROSS, nonCash: 0 });
    expect(money(withBenefit.netto)).toBe(19786.82);
    expect(money(paidOut.netto - withBenefit.netto)).toBe(NON_CASH);
  });
});

describe('honorarium share back-solved from payslips', () => {
  it('July is ~89.6% — not the 87.5% (7h/8h) default', () => {
    const share = honorariumShare(10493.02, GROSS, 3720.89);
    expect(share).toBeGreaterThan(0.895);
    expect(share).toBeLessThan(0.897);
  });

  it('August is ~63.5% after 5 unreported creative days', () => {
    const share = honorariumShare(7435.11, GROSS, 3720.89);
    expect(share).toBeGreaterThan(0.634);
    expect(share).toBeLessThan(0.636);
  });
});

describe('reconcile() — the paid endpoint payload', () => {
  const input = {
    gross: GROSS, nonCash: NON_CASH, kup: 10493.02,
    cumTaxBase: CUM_TB_BEFORE_JUL, netAddon: NET_ADDON, netto: 19786.82, ppkPct: 0
  };

  it('reports an exact match for a real payslip', () => {
    const r = reconcile(input);
    expect(r.ok).toBe(true);
    expect(r.matches).toBe(true);
    // Sub-grosz float residue is expected; the claim is a match at grosz precision.
    expect(Math.abs(r.diff)).toBeLessThan(0.005);
    expect(money(r.netto)).toBe(19786.82);
  });

  it('reports a mismatch when the payslip net differs', () => {
    const r = reconcile({ ...input, netto: 19000 });
    expect(r.matches).toBe(false);
    expect(money(r.diff)).toBe(786.82);
  });

  it('returns the back-solved share', () => {
    expect(reconcile(input).share).toBeGreaterThan(0.895);
  });

  it('returns null share when no KUP was entered', () => {
    expect(reconcile({ ...input, kup: 0 }).share).toBe(null);
  });

  it('rejects missing or non-numeric required figures', () => {
    expect(reconcile({ ...input, gross: 0 }).ok).toBe(false);
    expect(reconcile({ ...input, netto: 0 }).ok).toBe(false);
    expect(reconcile({ ...input, gross: 'abc' }).ok).toBe(false);
    expect(reconcile({}).ok).toBe(false);
  });

  it('never echoes the rules back to the caller', () => {
    const keys = Object.keys(reconcile(input));
    expect(keys).not.toContain('rules');
    expect(keys).not.toContain('formula');
    // only computed figures and flags
    expect(keys.sort()).toEqual(
      ['diff', 'health', 'matches', 'netto', 'ok', 'payslipNetto', 'share', 'social', 'tax', 'taxBase'].sort()
    );
  });
});
