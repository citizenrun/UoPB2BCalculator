/**
 * Payroll core — pure functions, no DOM.
 *
 * Loaded by index.html as a classic script (exposes window.PayrollCore) and
 * evaluated directly by tests/payroll.validation.test.mjs.
 *
 * Calibrated against real Comarch ERP Optima payslips (Exadel, 2026 periods
 * 07 and 08). See tests for the exact reference figures.
 */
var PayrollCore = (function () {
  'use strict';

  var ZUS = { em: 0.0976, re: 0.015, ch: 0.0245, zdrow: 0.09 };
  var ZUS_SOCIAL_RATE = ZUS.em + ZUS.re + ZUS.ch; // 0.1371
  var TAX_BRACKET = 120000;
  var KUP_ANNUAL = 120000;
  var ULGA_MONTHLY = 300;

  // ── Calendar ───────────────────────────────────────────────────────────────

  /** Gregorian Easter Sunday (Meeus/Jones/Butcher). Returns a UTC Date. */
  function easterSunday(year) {
    var a = year % 19;
    var b = Math.floor(year / 100);
    var c = year % 100;
    var d = Math.floor(b / 4);
    var e = b % 4;
    var f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4);
    var k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31);
    var day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day));
  }

  function addDays(date, n) {
    return new Date(date.getTime() + n * 86400000);
  }
  function key(date) {
    return date.getUTCFullYear() + '-' + (date.getUTCMonth() + 1) + '-' + date.getUTCDate();
  }

  /**
   * Statutory public holidays (dni ustawowo wolne od pracy).
   * Wigilia (24 Dec) is a public holiday from 2025 onward
   * (ustawa z 6.12.2024, Dz.U. 2024 poz. 1965; in force from 1.02.2025).
   */
  function polishHolidays(year) {
    var e = easterSunday(year);
    var list = [
      new Date(Date.UTC(year, 0, 1)),   // Nowy Rok
      new Date(Date.UTC(year, 0, 6)),   // Trzech Króli
      e,                                // Wielkanoc
      addDays(e, 1),                    // Poniedziałek Wielkanocny
      new Date(Date.UTC(year, 4, 1)),   // Święto Pracy
      new Date(Date.UTC(year, 4, 3)),   // Święto Konstytucji 3 Maja
      addDays(e, 49),                   // Zesłanie Ducha Świętego
      addDays(e, 60),                   // Boże Ciało
      new Date(Date.UTC(year, 7, 15)),  // Wniebowzięcie NMP
      new Date(Date.UTC(year, 10, 1)),  // Wszystkich Świętych
      new Date(Date.UTC(year, 10, 11)), // Święto Niepodległości
      new Date(Date.UTC(year, 11, 25)), // Boże Narodzenie
      new Date(Date.UTC(year, 11, 26))  // Drugi dzień Bożego Narodzenia
    ];
    if (year >= 2025) list.push(new Date(Date.UTC(year, 11, 24))); // Wigilia
    var set = Object.create(null);
    for (var i = 0; i < list.length; i++) set[key(list[i])] = true;
    return set;
  }

  /**
   * Statutory working time per month (wymiar czasu pracy, art. 130 Kodeksu pracy).
   *
   *   workDays   Mon–Fri, minus weekday public holidays, minus one day for every
   *              public holiday falling on a Saturday (art. 130 § 2 — a holiday on
   *              a non-Sunday day off lowers the working-time dimension).
   *   holidays   weekday public holidays — paid, shown for information, do NOT
   *              reduce KUP (they are already outside workDays).
   *   satHolidays days off granted in lieu of a Saturday holiday.
   */
  function workingTime(year) {
    var hol = polishHolidays(year);
    var workDays = [], holidays = [], satHolidays = [];
    for (var m = 0; m < 12; m++) { workDays[m] = 0; holidays[m] = 0; satHolidays[m] = 0; }
    var d = new Date(Date.UTC(year, 0, 1));
    while (d.getUTCFullYear() === year) {
      var m2 = d.getUTCMonth();
      var dow = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
      var isHol = !!hol[key(d)];
      if (dow >= 1 && dow <= 5) {
        if (isHol) holidays[m2]++; else workDays[m2]++;
      } else if (dow === 6 && isHol) {
        satHolidays[m2]++;
        workDays[m2]--; // day off in lieu
      }
      d = addDays(d, 1);
    }
    return { workDays: workDays, holidays: holidays, satHolidays: satHolidays };
  }

  var _wtCache = Object.create(null);
  function workingTimeCached(year) {
    if (!_wtCache[year]) _wtCache[year] = workingTime(year);
    return _wtCache[year];
  }

  // ── ZUS ────────────────────────────────────────────────────────────────────

  /**
   * Social contributions for one month, honouring the 30× annual cap.
   * The cap applies to emerytalna + rentowa only; chorobowa is never capped.
   *
   * @param gross      taxable gross for the month (includes non-cash benefits)
   * @param cumBase    cumulative emerytalna/rentowa base already used this year
   * @param cap        annual 30× limit
   */
  function zusSlice(gross, cumBase, cap) {
    var em = 0, re = 0, capped = false;
    if (cumBase >= cap) {
      capped = true;
    } else if (cumBase + gross > cap) {
      var part = cap - cumBase;
      em = part * ZUS.em;
      re = part * ZUS.re;
      capped = true;
    } else {
      em = gross * ZUS.em;
      re = gross * ZUS.re;
    }
    var ch = gross * ZUS.ch;
    var social = em + re + ch;
    var healthBase = gross - social;
    return {
      em: em, re: re, ch: ch,
      social: social,
      healthBase: healthBase,
      health: healthBase * ZUS.zdrow,
      capped: capped
    };
  }

  // ── Income tax advance (zaliczka) ──────────────────────────────────────────

  /**
   * Monthly PIT advance.
   *
   * Two details that payslips confirm and naive models get wrong:
   *  - the 300 zł monthly ulga is applied IN FULL in the month the cumulative
   *    base crosses 120 000 zł — it is not split pro rata across the 12%/32%
   *    slices (2026-08 payslip: 2 053 zł, a pro-rata ulga would give 2 093 zł);
   *  - the taxable base and the advance are each rounded to whole złoty
   *    (art. 63 § 1 Ordynacji podatkowej).
   *
   * @param taxBase    this month's taxable base (gross − social ZUS − KUP)
   * @param cumBefore  cumulative taxable base from previous months
   * @param opts.ulga       monthly tax-free amount, default 300
   * @param opts.bracket    12%/32% threshold, default 120 000
   * @param opts.round      round base and advance to whole zł, default true
   * @returns { tax, base, crossed, rate32 }
   */
  function advance(taxBase, cumBefore, opts) {
    opts = opts || {};
    var ulga = opts.ulga === undefined ? ULGA_MONTHLY : opts.ulga;
    var bracket = opts.bracket === undefined ? TAX_BRACKET : opts.bracket;
    var doRound = opts.round === undefined ? true : !!opts.round;

    var base = Math.max(0, taxBase);
    if (doRound) base = Math.round(base);

    var raw, crossed = false, rate32 = false;
    if (cumBefore >= bracket) {
      raw = base * 0.32 - ulga;
      rate32 = true;
    } else if (cumBefore + base > bracket) {
      var i12 = bracket - cumBefore;
      var i32 = base - i12;
      raw = i12 * 0.12 + i32 * 0.32 - ulga; // full ulga, not pro rata
      crossed = true;
      rate32 = true;
    } else {
      raw = base * 0.12 - ulga;
    }
    var tax = Math.max(0, raw);
    if (doRound) tax = Math.round(tax);
    return { tax: tax, base: base, crossed: crossed, rate32: rate32 };
  }

  // ── KUP ────────────────────────────────────────────────────────────────────

  /**
   * Back-solve the honorarium share actually used by payroll, from a payslip.
   * KUP = 50% × share × (gross − social ZUS)  →  share = KUP / (0.5 × base)
   */
  function honorariumShare(kup, gross, social) {
    var base = gross - social;
    if (base <= 0) return 0;
    return kup / (0.5 * base);
  }

  // ── Annual KUP budget ──────────────────────────────────────────────────────

  /**
   * How many days off you can take before the 50% KUP actually costs you money.
   *
   * When 12 full months of KUP would exceed the 120 000 zł annual limit, the
   * excess is headroom: a day with no KUP does not destroy the deduction, it
   * postpones it into a later month that was going to be capped anyway. The
   * month dips and a later month rises, and the year is unchanged. Only once
   * the headroom is gone does each further day cost
   * (KUP per day × your marginal tax rate).
   *
   * @param p.months  per month: { fullKup, workDays, daysOff, rate32 }
   *                  fullKup = that month's KUP with no absences at all
   * @param p.kupUsed KUP already settled this year (from a payslip), optional
   * @param p.cap     annual limit, default 120 000
   */
  function kupBudget(p) {
    var months = p.months || [];
    var cap = p.cap === undefined ? KUP_ANNUAL : p.cap;
    var uncapped = 0, workDays = 0, daysOff = 0;
    for (var i = 0; i < months.length; i++) {
      uncapped += months[i].fullKup || 0;
      workDays += months[i].workDays || 0;
      daysOff += months[i].daysOff || 0;
    }
    var perDay = workDays > 0 ? uncapped / workDays : 0;
    var headroom = Math.max(0, uncapped + (p.kupUsed || 0) - cap);
    var headroomDays = perDay > 0 ? headroom / perDay : 0;
    var daysLeft = headroomDays - daysOff;
    var cost = months.map(function (m) {
      var pd = m.workDays > 0 ? (m.fullKup || 0) / m.workDays : 0;
      return pd * (m.rate32 ? 0.32 : 0.12);
    });
    return {
      uncapped: uncapped,
      capped: uncapped + (p.kupUsed || 0) > cap,
      headroom: headroom,
      headroomDays: headroomDays,
      daysOff: daysOff,
      daysLeft: daysLeft,
      exhausted: daysLeft <= 0,
      perDay: perDay,
      costPerDay: cost
    };
  }

  // ── Employer side ──────────────────────────────────────────────────────────

  /**
   * What the employer pays on top of gross. Verified against the "Płatnik" block
   * of the 2026 payslips: 2 648,86 + 1 764,10 + 181,84 = 4 594,80, FP 664,93,
   * FGŚP 27,14.
   *
   * `wypRate` has no safe default — it depends on industry (PKD) and headcount.
   * This employer is at 0,67%; 1,67% is the high end. Employer PPK is only due
   * when the employee actually participates.
   *
   * @param p.gross   taxable gross for the month
   * @param p.wypRate accident-insurance rate, % (e.g. 0.67)
   * @param p.ppkPct  employee PPK rate, % — 0 means opted out, no employer PPK
   * @param p.capped  true once the ZUS 30× cap has stopped em/re
   */
  function employerCost(p) {
    var g = p.gross || 0;
    var capped = !!p.capped;
    var em = capped ? 0 : g * 0.0976;
    var re = capped ? 0 : g * 0.065;
    var wyp = g * ((p.wypRate === undefined ? 1.67 : p.wypRate) / 100);
    var fp = g * 0.0245;
    var fgsp = g * 0.001;
    var ppk = (p.ppkPct || 0) > 0 ? g * 0.015 : 0;
    return {
      em: em, re: re, wyp: wyp, fp: fp, fgsp: fgsp, ppk: ppk,
      zusTotal: em + re + wyp,
      total: g + em + re + wyp + fp + fgsp + ppk
    };
  }

  // ── Full month ─────────────────────────────────────────────────────────────

  /**
   * Net pay for one month.
   *
   * `gross` is the taxable gross — it includes employer-funded taxable benefits
   * (e.g. "ER Medicover", "ER Multisport"), which raise the ZUS and PIT base but
   * are never paid out. Those are passed separately as `nonCash` and removed
   * from the cash side, which is what makes the payslips reconcile exactly.
   *
   * @param p.gross      taxable gross (cash gross + nonCash)
   * @param p.nonCash    taxable benefits funded by the employer, not paid in cash
   * @param p.kup        deductible costs for the month
   * @param p.cumErBase  cumulative emerytalna/rentowa base before this month
   * @param p.cumTaxBase cumulative taxable base before this month
   * @param p.cap        ZUS 30× annual cap
   * @param p.ppkPct     employee PPK rate, %
   * @param p.deductions fixed net deductions (Medicover, Multisport, …)
   * @param p.netAddon   non-taxable net items, signed (e.g. +50 internet allowance)
   */
  function month(p) {
    var gross = p.gross || 0;
    var nonCash = p.nonCash || 0;
    var z = zusSlice(gross, p.cumErBase || 0, p.cap);
    var taxBase = Math.max(0, gross - z.social - (p.kup || 0));
    var a = advance(taxBase, p.cumTaxBase || 0, p);
    var ppk = gross * ((p.ppkPct || 0) / 100);
    var netto = gross - nonCash - z.social - z.health - a.tax - ppk
      - (p.deductions || 0) + (p.netAddon || 0);
    return {
      gross: gross, nonCash: nonCash,
      em: z.em, re: z.re, ch: z.ch,
      social: z.social, health: z.health, healthBase: z.healthBase,
      capped: z.capped,
      kup: p.kup || 0,
      taxBase: taxBase, taxBaseRounded: a.base,
      tax: a.tax, rate32: a.rate32, crossed: a.crossed,
      ppk: ppk,
      netto: netto
    };
  }

  return {
    ZUS: ZUS,
    ZUS_SOCIAL_RATE: ZUS_SOCIAL_RATE,
    TAX_BRACKET: TAX_BRACKET,
    KUP_ANNUAL: KUP_ANNUAL,
    ULGA_MONTHLY: ULGA_MONTHLY,
    easterSunday: easterSunday,
    polishHolidays: polishHolidays,
    workingTime: workingTimeCached,
    zusSlice: zusSlice,
    advance: advance,
    honorariumShare: honorariumShare,
    kupBudget: kupBudget,
    employerCost: employerCost,
    month: month
  };
})();

if (typeof window !== 'undefined') window.PayrollCore = PayrollCore;
