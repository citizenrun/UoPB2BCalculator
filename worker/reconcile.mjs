/**
 * Proprietary — see LICENSE-paid. Not covered by the AGPL that applies to the
 * rest of this repository. Do not publish, redistribute, or deploy.
 *
 * Payslip reconciliation. This never ships to the browser: the client posts the
 * six figures off a payslip and receives computed results, not the rules that
 * produced them.
 *
 * Calibrated against real Comarch ERP Optima payslips (2026 periods 07 and 08).
 */

const ZUS = { em: 0.0976, re: 0.015, ch: 0.0245, zdrow: 0.09 };
const TAX_BRACKET = 120000;
const ULGA_MONTHLY = 300;

/** Social contributions, honouring the 30× annual cap on emerytalna + rentowa. */
function zusSlice(gross, cumBase, cap) {
  let em = 0, re = 0, capped = false;
  if (cumBase >= cap) {
    capped = true;
  } else if (cumBase + gross > cap) {
    const part = cap - cumBase;
    em = part * ZUS.em;
    re = part * ZUS.re;
    capped = true;
  } else {
    em = gross * ZUS.em;
    re = gross * ZUS.re;
  }
  const ch = gross * ZUS.ch;
  const social = em + re + ch;
  const healthBase = gross - social;
  return { em, re, ch, social, healthBase, health: healthBase * ZUS.zdrow, capped };
}

/**
 * Monthly PIT advance. The 300 zł ulga applies IN FULL in the bracket-crossing
 * month — not pro rata — and both the base and the advance round to whole zł
 * (art. 63 § 1 Ordynacji podatkowej).
 */
function advance(taxBase, cumBefore, opts = {}) {
  const ulga = opts.ulga ?? ULGA_MONTHLY;
  const bracket = opts.bracket ?? TAX_BRACKET;
  const doRound = opts.round ?? true;

  let base = Math.max(0, taxBase);
  if (doRound) base = Math.round(base);

  let raw, crossed = false, rate32 = false;
  if (cumBefore >= bracket) {
    raw = base * 0.32 - ulga;
    rate32 = true;
  } else if (cumBefore + base > bracket) {
    const i12 = bracket - cumBefore;
    raw = i12 * 0.12 + (base - i12) * 0.32 - ulga;
    crossed = true;
    rate32 = true;
  } else {
    raw = base * 0.12 - ulga;
  }
  let tax = Math.max(0, raw);
  if (doRound) tax = Math.round(tax);
  return { tax, base, crossed, rate32 };
}

/**
 * Back-solve the honorarium share payroll actually used.
 * KUP = 50% × share × (gross − social ZUS)  →  share = KUP / (0.5 × base)
 */
export function honorariumShare(kup, gross, social) {
  const base = gross - social;
  if (base <= 0) return 0;
  return kup / (0.5 * base);
}

/**
 * Net pay for one month.
 *
 * `gross` is the taxable gross and includes employer-funded taxable benefits
 * ("ER Medicover", "ER Multisport"), which raise the ZUS and PIT base but are
 * never paid out. They are passed separately as `nonCash` and removed from the
 * cash side — that is what makes the payslips reconcile exactly.
 */
export function month(p) {
  const gross = p.gross || 0;
  const nonCash = p.nonCash || 0;
  const z = zusSlice(gross, p.cumErBase || 0, p.cap ?? Number.MAX_SAFE_INTEGER);
  const taxBase = Math.max(0, gross - z.social - (p.kup || 0));
  const a = advance(taxBase, p.cumTaxBase || 0, p);
  const ppk = gross * ((p.ppkPct || 0) / 100);
  const netto = gross - nonCash - z.social - z.health - a.tax - ppk
    - (p.deductions || 0) + (p.netAddon || 0);
  return {
    gross, nonCash,
    em: z.em, re: z.re, ch: z.ch,
    social: z.social, health: z.health, healthBase: z.healthBase,
    capped: z.capped,
    kup: p.kup || 0,
    taxBase, taxBaseRounded: a.base,
    tax: a.tax, rate32: a.rate32, crossed: a.crossed,
    ppk,
    netto
  };
}

const num = (v) => (Number.isFinite(+v) ? +v : 0);

/**
 * The paid endpoint's payload: rebuild the month, diff it against the payslip,
 * and report the back-solved share. Returns numbers only — never the rules.
 */
export function reconcile(input) {
  const gross = Math.max(0, num(input.gross));
  const netto = Math.max(0, num(input.netto));
  if (gross <= 0 || netto <= 0) {
    return { ok: false, error: 'gross and netto are required' };
  }
  const r = month({
    gross,
    nonCash: Math.max(0, num(input.nonCash)),
    kup: Math.max(0, num(input.kup)),
    cumErBase: 0,
    cumTaxBase: Math.max(0, num(input.cumTaxBase)),
    cap: Number.MAX_SAFE_INTEGER,
    ppkPct: Math.max(0, num(input.ppkPct)),
    deductions: 0,
    netAddon: num(input.netAddon)
  });
  const diff = r.netto - netto;
  const kup = Math.max(0, num(input.kup));
  return {
    ok: true,
    social: r.social,
    health: r.health,
    taxBase: r.taxBase,
    tax: r.tax,
    netto: r.netto,
    payslipNetto: netto,
    diff,
    matches: Math.abs(diff) < 0.005,
    share: kup > 0 ? honorariumShare(kup, gross, r.social) : null
  };
}
