---
name: uop-kalkulator
description: >
  Build, update, or extend the Polish UoP salary calculator (kalkulator wynagrodzeń UoP).
  Use this skill whenever the user asks to work on the UoP/B2B calculator (`index.html` at repo root), add features,
  fix calculations, change the UI, add bilingual support, B2B JDG/ryczałt tab, job-title PKWiU matching, or discuss Polish payroll tax formulas
  (KUP, ZUS 30x cap, 32% bracket, koszty autorskie). Also use when the user asks about
  Polish tax calculations, brutto-netto conversion, or anything related to Polish employment
  contracts and salary math. Trigger on any mention of: kalkulator, UoP, B2B, JDG, ryczałt, PKWiU, brutto, netto,
  ZUS, KUP, koszty autorskie, Polish salary, pasek płac, or the calculator HTML file.
---

# UoP Salary Calculator — Project Skill

## What This Is
A standalone HTML salary calculator for Polish UoP (umowa o pracę) employment.
**Target audience:** expats in Polish IT (primary user: Serhii, QA automation engineer, Exadel Poland, Wrocław).
**Output:** `index.html` at repo root plus **`public/job-rules.json`** (B2B role list; loaded via `fetch`). Use **`npm run dev`** / **`vite preview`** / **GitHub Pages** — `file://` on `index.html` alone will not load job rules.
**Build:** `npm run build` runs `scripts/build-job-rules.mjs` then Vite → `dist/` (includes `job-rules.json`).
**Public site:** `https://citizenrun.github.io/UoPB2BCalculator/` (GitHub Actions → GitHub Pages; `base` `/UoPB2BCalculator/`).

### Trust: B2B job rules
- **`public/job-rules.json`** is the source of truth; PKWiU↔title mapping is **heuristic**, not fully KIS-verified per row.
- CI: `tests/job-rules.validation.test.mjs` (Vitest) + Playwright `tests/smoke.spec.js`. **`data/ryczalt-art12-by-rate.json`** maps rate keys to art. 12 buckets for consistency checks only.
- Read repo **`AGENTS.md`** and follow **`.cursor/rules/agent-workflow.mdc`** (plan → confirm → implement) before destructive Git ops or large refactors.

---

## Verified Calibration Data (Serhii, 27 000 zł brutto, 2025)

### Real net payments from mBank statement:
| Month | Real netto | Notes |
|-------|-----------|-------|
| Styczeń | 19 867,99 | Baseline — exact match with model |
| Luty | 19 867,99 | Baseline — exact match |
| Marzec | 19 576,99 | **5 vacation days** |
| Kwiecień | 19 864,04 | Normal |
| Maj | 19 864,04 | Normal |
| Czerwiec | 20 602,21 | ⚠ Employer used remaining KUP allowance in one payment |
| Lipiec | 19 651,04 | **2 vacation days** |
| Sierpień | 18 583,04 | **7 vacation days** |
| Wrzesień | 18 291,74 | ⚠ ZUS cap + 32% bracket hit simultaneously |
| Październik | 19 506,96 | ZUS cap active |
| Listopad | 19 436,16 | 32% + ZUS cap |
| Grudzień | 19 793,87 | ⚠ Employer roczne rozliczenie adds ~4 300 zł |

### Serhii's parameters (2025, historical):
- Brutto: 27 000 zł/mc, no PPK
- KUP: reverse-engineered = **11 215,88 zł/mc** for full months
- Fixed deductions: Medicover 15,75 + Multisport 167,82 = **183,57 zł/mc**
- Vacation taken 2025: 14 days (Mar 5, Jul 2, Aug 7)

> **Superseded.** These figures come from bank statements, not payslips, so the
> gross was assumed to be 27 000 — it is actually **27 140** (see below). The
> "~1.2% annual error" noted here was mostly that missing 140 zł plus the
> pro-rata ulga bug. The 2026 payslip data reproduces exactly; prefer it.
> The 2025 work-day table that used to sit here was wrong (Mon–Fri counts, no
> holiday or Saturday-lieu adjustment) and has been removed — use
> `PayrollCore.workingTime(2025)` = `[21,20,21,21,20,20,23,20,22,23,18,20]`.

---

## Tax Formulas (Confirmed Correct)

Implemented in `public/payroll.js`. Reproduce both 2026 payslips to the grosz.

```
gross_tax   = cash_gross + employer_funded_taxable_benefits   ← see note below
ZUS_social  = gross_tax × (9.76% + 1.50% + 2.45%)   ← capped by 30x limit (em+re only)
ZUS_health  = (gross_tax − ZUS_social) × 9%
KUP         = 50% × honorarium_fraction × (gross_tax − ZUS_social) × (creative_days/work_days)
              ← capped at 120 000 zł/year; after cap: KUP = 250 zł/mc flat
taxbase     = round(max(0, gross_tax − ZUS_social − KUP))
tax         = round(max(0, taxbase × 12% − 300))   [cumulative dochód ≤ 120 000 zł]
              OR round(max(0, taxbase × 32% − 300))          [above threshold]
              OR round(max(0, i12 × 12% + i32 × 32% − 300))  [crossing month]
netto       = gross_tax − employer_funded_benefits − ZUS_social − ZUS_health
              − tax − PPK_employee − fixed_deductions + non_taxable_net_items
```

**Three details that payslips confirm and naive models get wrong:**

1. **Employer-funded taxable benefits are not paid out.** Payslip lines
   `ER Medicover 105,00` and `ER Multisport 35,00` go into the ZUS and PIT base
   (base is **27 140**, not 27 000) but never reach the bank. Add them to the
   base, subtract them from the cash side. Worth 140 zł/mc here.
2. **The 300 zł ulga is applied in full in the bracket-crossing month** — it is
   **not** split pro rata between the 12% and 32% slices. 2026-08 payslip:
   2 053 zł. A pro-rata ulga gives 2 093 zł. Worth ~41 zł.
3. **Taxable base and advance are each rounded to whole złoty**
   (art. 63 § 1 Ordynacji podatkowej).

**ZUS rates** (unchanged since 2014, safe to hardcode): em 9.76%, re 1.5%, ch 2.45%, zdrow 9%.
**Tax brackets** (safe to hardcode): 12% / 32% threshold 120 000 zł, kwota wolna = 300 zł/mc reduction.
**Minimum wage:** 2025 = 4 666 zł, **2026 = 4 806 zł** (consistent with B2B `health_min` 432,54 = 9% × 4 806).

---

## Verified Calibration Data — 2026 payslips (Comarch ERP Optima)

Two real payslips, 27 000 zł contract, periods 2026-07 and 2026-08. Both are
reproduced exactly by `PayrollCore.month()`; see `tests/payroll.validation.test.mjs`.

| | 2026-07 (23 d / 184 h) | 2026-08 (20 d / 160 h) |
|---|---|---|
| Taxable gross | 27 140,00 | 27 140,00 |
| ZUS em/re/ch | 2 648,86 / 407,10 / 664,93 | same |
| ZUS social | 3 720,89 | 3 720,89 |
| Health base / health | 23 419,11 / 2 107,72 | same |
| KUP ("Koszty") | 10 493,02 | 7 435,11 |
| Taxable base | 12 926,09 | 15 984,00 |
| Zaliczka | 1 251 (12%) | 2 053 (12% + 32% split) |
| **Netto** | **19 786,82** | **18 984,82** |

### Full payslip line items (source PDFs deleted — this is the record)

Employer: Exadel Poland. Payroll system: **Comarch ERP Optima**, document
"Kwitek wypłaty". Wymiar etatu 1/1, tytuł ubezpieczenia 011000, oddział NFZ 01R,
no PPK, no overtime, `Urlopy 0/0` in both months.

| Line | Opodatkowane | Nieopodatkowane |
|------|-------------:|----------------:|
| Wynagrodzenie zasadnicze /miesiąc | 27 000,00 | |
| ER Medicover Zdrowie – Health Extra | 105,00 | |
| ER Multisport Pracownik Classic | 35,00 | |
| Internet Plan Poland | | +50,00 |
| Medicover Zdrowie – Health Extra | | −15,75 |
| Multisport Pracownik Classic | | −167,82 |
| **Suma** | **27 140,00** | **−133,57** |

`Lump Sum` and `Utilization Bonus` lines exist on the July slip at 0,00 — this
employer can pay bonuses, so the bonus grid is not hypothetical.

**Składki block (identical both months):** podstawa 27 140,00 for em/re/ch/wyp;
zdrowotna base 23 419,11. Ubezpieczony: 2 648,86 / 407,10 / 664,93 / — / 2 107,72,
razem **5 828,61**. Płatnik: 2 648,86 / 1 764,10 / — / 181,84, razem 4 594,80.
FP 664,93, FGŚP 27,14, FEP 0,00. Ulga podatkowa 300,00 both months.

### ⚠ Wypadkowa is 0,67%, not 1,67% — and it is not a constant

`181,84 / 27 140 = 0,67%`. The app used to hardcode **1,67%**, overstating
employer cost by 1% of gross (**271,40 zł/mc**, ~3 257 zł/year) and inflating
the "fair B2B invoice equivalent" in the UoP↔B2B comparison.

The rate depends on **PKD and headcount** — there is no safe default. It is now
an input (`wyp-rate`), and `employerMultiplier()` derives the loaded-cost factor
instead of the old hardcoded `1.2259`:

| Scenario | Multiplier |
|---|---|
| wyp 0,67%, no PPK (this employer) | **1,1948** |
| wyp 1,67%, no PPK | 1,2048 |
| wyp 1,67% + PPK (old hardcoded value) | 1,2259 |

Loaded cost here: 27 140 × 1,1948 = **32 426,87 zł/mc**.

Second bug found the same way: employer PPK (1,5%) was charged **even when the
employee had opted out**. Now gated on `ppkPct > 0`. Both are locked by tests in
`PayrollCore.employerCost()`.

**Lesson for future calibration:** check the *Płatnik* row, not just the
*Ubezpieczony* row. Everything employer-side was unverified until this payslip.

**Narastająco w roku 2026:**

| At payslip | Podstawa podatku | Podstawa składek E-R | Payments |
|---|---:|---:|---:|
| period 07 (printed 04-08-2026) | 106 188,70 | 217 120,00 | 8 |
| period 08 (printed 07-09-2026) | 122 172,70 | 244 260,00 | 9 |

Derived: KUP used through 9 payments = 244 260 − (244 260 × 0,1371) − 122 172,70
= **88 599,25**; allowance left **31 400,75** against 3 remaining months needing
31 478,79 → **78 zł of buffer**, i.e. no room left in tax year 2026.

**Workday absence balance as of 16-09-2026:** PTO tracked in days — beginning
year 27, carryover 0, accrued YTD 26, **absence paid YTD 6**, balance **47**.
Banked Overtime 0 h. So 2026 day spend ≈ 6 vacation + 5 unreported = 11.

*(Not recorded here, deliberately: PESEL and payslip document symbols.)*

**Back-solved honorarium share:** July **89,61%**, August **63,50%** (5 working
days not reported as creative). Neither equals the app's 87,5% (7h/8h) default,
and August is not a clean 15/20 proration — **the employer's exact internal rule
is unknown; do not guess it.** Use "KUP from payslip" or the reconciliation panel.

**Payment timing:** `Narastająco w roku` on the 2026-07 payslip reads
217 120 = 8 × 27 140, and the slip was printed 4 Aug. Salary is paid a month in
arrears, so tax year 2026 holds periods **12/2025 … 11/2026**. The 12 modelled
months are the right *count*; only the labels shift. The ZUS cap lands on the
11th payment — period 10/2026, paid November. Use the YTD opening-balance
inputs to realign it.

---

## ZUS 30x Cap by Year

| Year | Limit | When it hits at 27k brutto |
|------|-------|---------------------------|
| 2024 | 234 720 zł | Month 9 (September, partial) |
| 2025 | 260 190 zł | Month 10 (October, partial) |
| 2026 | 282 600 zł | Month 11 (November, partial) |
| 2027+ | TBA — announced each December in Monitor Polski | — |

Formula: `30 × prognozowane przeciętne wynagrodzenie miesięczne` (set annually by Minister).
Cap applies only to em+re. Chorobowa (2.45%) has NO cap. Zdrowotna base shifts when ZUS_social drops.

---

## Critical KUP Facts (Research-Confirmed)

**What "80% KUP" actually means (common expat misconception):**
- "80% KUP" does NOT exist as a tax rate in Polish law
- Only two rates: **50%** (honorarium autorskie) and 20% (some civil contracts)
- "80%" = the fraction of salary/time classified as honorarium autorskie
- Actual KUP = 50% × 80% × base = 40% of base — not 80%

**Who controls KUP — IMPORTANT:**
- The honorarium autorskie provision MUST be in the employment contract or an annex
- BUT the employee does not calculate it — HR/payroll does everything
- The employee only reports creative hours (e.g. 7h/8h via timesheet)
- The employer's payroll system derives the KUP PLN amount from that
- Users typically don't know the exact PLN unless they look at their pasek płac

**KUP UX — three input modes:**
1. **None** — no koszty autorskie; standard 250 zł/mc flat (explain: this is the default fallback, minimal benefit)
2. **Auto-estimate** — user picks % of time that's twórcze → calculator derives KUP via legal formula
3. **Manual from payslip** — user enters exact PLN from "koszty uzyskania przychodu" line on pasek płac (most accurate)

**Important constraint:** Ulga dla młodych (PIT-0, under 26) and 50% KUP **cannot be used simultaneously**.

---

## Known Anomalies (Employer-Side Only)

| Month | Effect | Cause |
|-------|--------|-------|
| Czerwiec | Higher netto (+734 vs model) | **Not an anomaly — this is the annual KUP limit smoothing.** See "Annual KUP budget" below. Now modelled. |
| Sierpień/Wrzesień | Lower than model | KUP limit exhaustion + 32% bracket interaction. Now modelled. |
| Grudzień | Higher by ~4 300 zł | **Roczne rozliczenie zaliczek** (art. 37 ustawy PIT) — employer recalculates annual tax liability and refunds overpaid advances in December. Standard Polish payroll practice. **Still not modelled.** |

→ Show November/December with `*` marker explaining they will be higher in reality.
→ Annual total is more reliable than individual months for Q4.

---

## Annual KUP Budget — why vacation is often free

When 12 full months of KUP would exceed the 120 000 zł annual limit, the excess
is **headroom**. A day with no KUP does not destroy the deduction — it postpones
it into a later month that was going to be capped anyway. That month dips, a
later month rises, **the year is unchanged**. This is exactly the "Czerwiec
anomaly" above, seen from the other side.

Only once the headroom is gone does each further day cost
`KUP per day × marginal tax rate`.

At 27 140 gross and an 89,61% honorarium share:
- 12 full months of KUP ≈ **128 089 zł** (rises late in the year: after the ZUS
  30× cap, `gross − social` is larger, so monthly KUP and per-day cost both rise)
- headroom ≈ **8 089 zł ≈ 15,9 working days free per year**
- past that: ~55–63 zł/day in 12% months, **153–190 zł/day** in 32% months

**Vacation and unreported creative days spend the same budget.** Implemented as
`PayrollCore.kupBudget()`, surfaced by `renderKupBudget()`, covered by tests.

**Caveat:** this only holds while the share is high enough that
`12 × fullKup > 120 000`. At the August share (63,5%) annual KUP is ~89 000 and
there is no buffer at all — every day off costs real money.

---

## Polish Public Holidays & Working Time

**Do not hardcode these tables.** They are computed at runtime by
`public/payroll.js` → `PayrollCore.workingTime(year)`, and locked by
`tests/payroll.validation.test.mjs`. Earlier hardcoded tables in this file were
wrong for 2026 and are gone.

Statutory list: Nowy Rok, Trzech Króli, Wielkanoc, Poniedziałek Wielkanocny,
Święto Pracy, Święto Konstytucji, Zesłanie Ducha Świętego (Sunday, never a
weekday), Boże Ciało, Wniebowzięcie NMP, Wszystkich Świętych, Święto
Niepodległości, **Wigilia (24 Dec — statutory from 2025**, ustawa z 6.12.2024,
Dz.U. 2024 poz. 1965, in force 1.02.2025), Boże Narodzenie ×2.

**Verified against PIT.pl / PIP tables (Sep 2026):** 2026 = 251 days / 2 008 h,
month-for-month identical to `PayrollCore.workingTime(2026)`. PIP Katowice
derives August 2026 = 160 h with the same Aug-15-Saturday deduction.

**Two rules that naive tables miss:**

1. **Saturday holiday → day off in lieu** (art. 130 § 2 KP). A public holiday
   falling on a day off other than Sunday lowers that month's working-time
   dimension by 8 h. 15 Aug 2026 and 26 Dec 2026 are both Saturdays.
2. **Wigilia** is a public holiday from 2025 onward.

**Statutory working time (wymiar czasu pracy), computed:**
```javascript
// Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec      total h
2025: [21,20,21,21,20,20,23,20,22,23,18,20]  // 249 d  1992 h
2026: [20,20,22,21,20,21,23,20,22,22,20,20]  // 251 d  2008 h
2027: [19,20,22,22,18,22,22,22,22,21,20,21]  // 251 d  2008 h
```
Confirmed by 2026 payslips: **July 184 h = 23 d**, **August 160 h = 20 d**.

**How holidays affect KUP:**
Public holidays are **paid days** and do not reduce KUP. Because they are
already outside the working-time dimension, they sit outside both the numerator
and the denominator of `creativeDays / totalDays` — no special-casing needed.
Absences therefore cap at the month's working days, not at
`workDays − holidays` (the old double-subtraction bug).

---

## Features Status

### ✅ Implemented
- Month-by-month netto table
- ZUS 30x cap with mid-month split calculation
- 12%→32% bracket tracked on cumulative taxbase
- Annual KUP limit + proportional vacation day reduction (holidays do NOT reduce KUP)
- Fixed deductions (Medicover, Multisport, other)
- Vacation days per month (capped by that month's statutory working days)
- **Non-creative days per month** (`NC` column) — working days not reported as
  creative work, separate from vacation/L4
- **Employer-funded taxable benefits** — raise the ZUS/PIT base, excluded from cash
- **Payslip reconciliation panel** — rebuild one month from six payslip numbers,
  diff it line by line, back-solve the real honorarium share
- **YTD opening balances** — carry in `Narastająco w roku` to realign the ZUS cap
  and the 32% bracket when payroll pays a month in arrears
- Nov/Dec flagged as approximate (`*`)
- Annual total as primary starred metric
- Calibration tab vs 2025 real mBank data
- Dynamic ZUS cap input (user-editable for unknown future years)
- KUP: auto (% of time) + manual PLN + none modes
- **Bilingual PL/EN** — language toggle, all text in both languages
- **ZUS cap info panel** — plain-language explanation with progress bar, PLN savings, 32% overlap warning
- **PPK** — employee 2–4%, employer 1.5%
- **Ulga dla młodych (PIT-0)** — under 26, zero income tax up to 85 528 zł/year
- **Ulga dla powracających** — expat 4-year tax exemption
- **Employer cost section** (same UoP page, below the monthly table) — emeryt 9.76%, rent 6.5%, wypad 1.67%, FP 2.45%, FGŚP 0.1%, PPK 1.5%
- **Public holidays and working time computed** for any year (`PayrollCore.workingTime`),
  incl. Wigilia from 2025 and the Saturday day-off-in-lieu rule
- **32% overlap warning** in ZUS panel explaining why netto can DROP when cap and bracket coincide

---

## Expat User Context

What expat IT employees typically know:
- Their brutto salary ✓
- Whether employer applies koszty autorskie ("yes" or "no idea")
- They do NOT know: the formula, honorarium fraction, or exact KUP PLN unless they look at payslip

What confuses them most:
- Why December is higher than model (roczne rozliczenie)
- Why October/November netto can drop despite ZUS cap saving
- What "30-krotność ZUS" means
- Why same brutto produces different netto each month

---

## Job Title → KUP Eligibility (Research-Confirmed)

The law covers "działalność twórcza w zakresie programów komputerowych" — not just writing code. Eligibility depends on actual duties, not job title. The contract must specify honorarium autorskie.

| Role | KUP on UoP? | B2B Ryczałt rate | Notes |
|------|-------------|-----------------|-------|
| Software Developer | ✅ Yes | 12% | Core case — writing code |
| QA Automation Engineer | ✅ Yes | 12% | Writing test code = creating software |
| QA Manual Tester | ⚠️ Partial/maybe | **8.5%** | Purely repetitive testing ≠ authorial; KIS confirmed 8.5% ryczałt Apr 2025 (PKWiU 62.02.30.0) |
| UX/UI Designer | ✅ Yes | 14% (PKWiU 74.1) | Creating interfaces = authorial work |
| DevOps Engineer | ⚠️ Maybe | 12% or 8.5% | IaC scripts/pipelines = yes; pure ops = no |
| Data Engineer/Scientist | ⚠️ Maybe | 12% | Original models/code = yes |
| Product Manager | ⚠️ Unlikely | 15% (PKWiU 70.22.20.0) | Needs specific creative deliverables in contract |
| Scrum Master | ❌ Unlikely | 15% | Facilitation ≠ authorial work |
| Project Manager | ❌ Unlikely | 15% | Management/coordination ≠ authorial |
| Sound Designer | ✅ Yes | 8.5%–12% | Covered under artistic/audio works |
| Graphic Designer | ✅ Yes | 14% | Visual creative works |
| Business Analyst | ⚠️ Maybe | 8.5% | KIS confirmed 8.5% for BA role (Dec 2022 interpretation) |

---

## B2B (JDG) Tax Data — 2026 Verified

### ZUS Social — Duży ZUS 2026 (base: 5 652 zł = 60% × 9 420 zł avg wage)
```
Emerytalna:     9.76% × 5652 = 551.64 zł
Rentowa:        6.50% × 5652 = 367.38 zł
Chorobowa:      2.45% × 5652 = 138.47 zł  (VOLUNTARY)
Wypadkowa:      1.67% × 5652 =  94.39 zł
Fundusz Pracy:  2.45% × 5652 = 138.47 zł
─────────────────────────────────────────
Total (with chorobowe): 1 926.77 zł/month
Total (without):        1 788.30 zł/month
```

### Health Insurance 2026
- Skala podatkowa: 9% × income, min 432,54 zł
- Podatek liniowy: 4.9% × income, min 432,54 zł (deductible up to 14 100 zł/year)
- Ryczałt (based on Q4 2025 avg wage 9 228,64 zł):
  - Revenue ≤60 000/year → 498,35 zł/month
  - Revenue 60 001–300 000/year → 830,58 zł/month
  - Revenue >300 000/year → 1 495,04 zł/month
  - Deduct 50% of paid health from taxable revenue

### Ryczałt Rates for IT
| Form | Rate | Who |
|------|------|-----|
| Ryczałt | 12% | Programmer, QA automation, software-related advisory |
| Ryczałt | **8.5%** | Manual QA tester, BA, technical support (PKWiU 62.02.30.0) |
| Ryczałt | 14% | UX/UI designer (PKWiU 74.1) |
| Ryczałt | 15% | PM, Scrum Master, management consultants (PKWiU 70.22.20.0) |

### Fair UoP vs B2B Comparison
Correct method: B2B invoice = UoP employer total cost (what employer pays in total)
- Employer total = brutto × (1 + 9.76% + 6.5% + **wypadkowa** + 2.45% + 0.1% + PPK 1.5% if enrolled)
- **Do not hardcode 1.2259.** Wypadkowa varies by PKD/headcount and PPK may be
  opted out — use `employerMultiplier()`, which reads both.
- For this employer (27 140 taxable gross, wyp 0,67%, no PPK): **32 426,87 zł**
  → that is the fair B2B invoice equivalent, ~670 zł/mc lower than the old
  hardcoded figure suggested.

### B2B Hidden Costs (subtract from B2B net for honest comparison)
- Accounting: ~250–400 zł/month
- No paid vacation: 20 days ≈ 8% annual revenue loss
- No employer sick pay guarantee (ZUS pays 80% only after 30 days)
- Equipment, software, phone etc.

---

## Deployment — Current State

**Stack:** Vanilla JS, single `index.html` + `public/job-rules.json`. No framework, no server.
**Host:** GitHub Pages (static). URL: `https://citizenrun.github.io/UoPB2BCalculator/`
**CI/CD:**
- PRs → `.github/workflows/ci.yml` runs `npm test` (unit + build + Playwright)
- Push to `main` → `.github/workflows/deploy-pages.yml`: tests → patch-bump `package.json` → append `CHANGELOG.md` → refresh `public/release.json` → Vite build → publish Pages → push `[skip ci]` commit
- Vite `base` = `/UoPB2BCalculator/` in CI; `'./'` locally. **Never change `base` without aligning deploy workflow and Pages URL.**

**Hard constraints (GitHub Pages = public static):**
- No server-side code (no Node, Python, PHP running on server)
- No backend API (no database, no sessions, no server secrets)
- No API keys in source — HTML/JS is fully public
- Single-file architecture must be preserved unless migration is approved

---

## Deployment — Future Migration Options

If a feature genuinely requires a backend or richer stack, propose one of these. **Do not prototype. Write proposal → user approves → then work starts.**

| Option | Best for | Free tier | Notes |
|--------|----------|-----------|-------|
| **Cloudflare Workers** | API key proxying, edge functions | Yes | Secrets stored server-side; minimal latency; no cold start |
| **Vercel** | Full Next.js migration, serverless functions | Yes | Good if migrating to React/component architecture |
| **Supabase** | Persistent user data, saved profiles, auth | Yes | Postgres + auth; only if users need accounts |
| **GitHub Actions** | Scheduled data updates (e.g. annual ZUS cap auto-update) | Yes | Commits updated JSON back to repo; no user-facing backend needed |

**When to propose migration:**
- Real-time chart or complex reactive state → consider React/Next.js via Vercel
- API key needed (e.g. exchange rates, MF tax data fetch) → Cloudflare Workers proxy
- User wants to save/share their salary config → Supabase auth + storage
- Annual ZUS cap needs auto-update without manual edit → GitHub Actions cron

**UI migration path (if approved):**
Current single-file → React + Tailwind + Vite (already uses Vite, low migration cost).
Propose as separate branch. Keep GitHub Pages deploy working on `main` until migration is stable.

---

## Working Protocol

ALWAYS follow this order — no exceptions:
1. **Read this skill file first**
2. **Present a plan** — what will change, why, any risks
3. **Wait for user approval** (user says "go" or modifies plan)
4. **Then implement**

Never jump to code without explicit approval.

## Reply Style

Reply as caveman. Short. Direct. No filler. No "Great question!", no "Certainly!", no lengthy preambles.
Bad: "That's a great point! I'll now proceed to implement the changes you requested by first examining..."
Good: "Found bug. Plan: fix line 847. Go?"

## Verification (on-demand)

```bash
npm run test:unit    # Vitest — job-rules contract + math validation
npm test             # unit + build + Playwright smoke (full suite)
node --check /tmp/check.js  # syntax-check extracted JS
npm run build        # sanity-check build before delivering changes
```

Run `npm run test:unit` before delivering any calculator change that touches tax formulas or job-rules.
