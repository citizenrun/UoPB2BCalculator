---
name: uop-kalkulator
description: >
  Build, update, or extend the Polish UoP salary calculator (kalkulator wynagrodzeń UoP).
  Use this skill whenever the user asks to work on the UoP calculator (`index.html` at repo root), add features,
  fix calculations, change the UI, add bilingual support, or discuss Polish payroll tax formulas
  (KUP, ZUS 30x cap, 32% bracket, koszty autorskie). Also use when the user asks about
  Polish tax calculations, brutto-netto conversion, or anything related to Polish employment
  contracts and salary math. Trigger on any mention of: kalkulator, UoP, brutto, netto,
  ZUS, KUP, koszty autorskie, Polish salary, pasek płac, or the calculator HTML file.
---

# UoP Salary Calculator — Project Skill

## What This Is
A standalone HTML salary calculator for Polish UoP (umowa o pracę) employment.
**Target audience:** expats in Polish IT (primary user: Serhii, QA automation engineer, Exadel Poland, Wrocław).
**Output:** single self-contained `index.html` (open in a browser as-is; optional Vite for local dev).
**Current file:** `index.html` at repository root. Local preview: `npm run dev`. Production static build: `npm run build` → `dist/`.

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

### Serhii's parameters:
- Brutto: 27 000 zł/mc, no PPK
- KUP: reverse-engineered = **11 215,88 zł/mc** for full months
- Fixed deductions: Medicover 15,75 + Multisport 167,82 = **183,57 zł/mc**
- Work days 2025: [23,20,21,22,22,21,23,21,22,23,20,23]

### Model accuracy: ~1.2% annual error. Jan/Feb/Apr/May: exact (0–4 zł diff).

---

## Tax Formulas (Confirmed Correct)

```
ZUS_social  = brutto × (9.76% + 1.50% + 2.45%)   ← capped by 30x limit (em+re only)
ZUS_health  = (brutto − ZUS_social) × 9%
KUP         = 50% × honorarium_fraction × (brutto − ZUS_social) × (work_days/total_days)
              ← capped at 120 000 zł/year; after cap: KUP = 250 zł/mc flat
taxbase     = max(0, brutto − ZUS_social − KUP)
tax         = max(0, taxbase × 12% − 300)   [cumulative dochód ≤ 120 000 zł]
              OR taxbase × 32%              [above threshold]
              OR split at crossing month
netto       = brutto − ZUS_social − ZUS_health − tax − PPK_employee − fixed_deductions
```

**ZUS rates** (unchanged since 2014, safe to hardcode): em 9.76%, re 1.5%, ch 2.45%, zdrow 9%.
**Tax brackets** (safe to hardcode): 12% / 32% threshold 120 000 zł, kwota wolna = 300 zł/mc reduction.

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

## Known Anomalies (Do NOT Model — Employer-Side Only)

| Month | Anomaly | Cause |
|-------|---------|-------|
| Czerwiec | Higher netto (+734 vs model) | Employer used remaining annual KUP in one payment |
| Sierpień/Wrzesień | Lower than model | KUP limit exhaustion + 32% bracket interaction |
| Grudzień | Higher by ~4 300 zł | **Roczne rozliczenie zaliczek** (art. 37 ustawy PIT) — employer recalculates annual tax liability and refunds overpaid advances in December. Standard Polish payroll practice. |

→ Show November/December with `*` marker explaining they will be higher in reality.
→ Annual total is more reliable than individual months for Q4.

---

## Polish Public Holidays (Verified — Mon-Fri weekday occurrences per month)

Computed from full statutory list: Nowy Rok, Trzech Króli, Wielkanoc, Poniedziałek Wielkanocny, Święto Pracy, Święto Konstytucji, Zesłanie Ducha Świętego (Sunday, never weekday), Boże Ciało, Wniebowzięcie NMP, Wszystkich Świętych, Święto Niepodległości, Boże Narodzenie ×2.

```javascript
// Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
2024: [1,  0,  0,  1,  3,  0,  0,  1,  0,  0,  2,  2]  // sum=10
2025: [2,  0,  0,  1,  1,  1,  0,  1,  0,  0,  1,  2]  // sum=9
2026: [2,  0,  0,  1,  1,  1,  0,  0,  0,  0,  1,  1]  // sum=7
2027: [2,  0,  1,  0,  2,  0,  0,  0,  0,  0,  2,  0]  // sum=7
```

**Key dates that shift yearly (Easter-dependent):**
- Poniedziałek Wielkanocny: 2024=Apr 1, 2025=Apr 21, 2026=Apr 6, 2027=Mar 29
- Boże Ciało (60 days after Easter): 2024=May 30, 2025=Jun 19, 2026=Jun 4, 2027=May 27

**How holidays affect KUP calculation:**
Public holidays are **paid days** — employer still applies KUP for them.
Only actual vacation/absence days reduce KUP proportionally.
Holidays are shown in the vacation grid to cap max vacation inputs per month.
This is confirmed by Jan 2025 calibration: Jan has 2 weekday holidays but KUP = full 11 215,88 zł.

**Work days (Mon-Fri only, no holiday subtraction — employer payroll basis):**
```javascript
2024: [22,21,22,21,23,20,23,22,21,23,21,21]  // sum=261 (note: differs from holiday-adjusted)
2025: [23,20,21,22,22,21,23,21,22,23,20,23]  // sum=261 ← calibrated against real data
2026: [22,20,22,22,21,22,23,21,22,22,21,23]  // sum=261
2027: [21,20,22,22,21,22,22,22,22,21,21,23]  // sum=257
```

---

## Features Status

### ✅ Implemented
- Month-by-month netto table
- ZUS 30x cap with mid-month split calculation
- 12%→32% bracket tracked on cumulative taxbase
- Annual KUP limit + proportional vacation day reduction (holidays do NOT reduce KUP)
- Fixed deductions (Medicover, Multisport, other)
- Vacation days per month (capped by working days minus public holidays)
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
- **Employer cost tab** — emeryt 9.76%, rent 6.5%, wypad 1.67%, FP 2.45%, FGŚP 0.1%, PPK 1.5%
- **Public holidays hardcoded** per year (2024–2027), verified against computed values
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
- Employer total = brutto × (1 + 9.76% + 6.5% + 1.67% + 2.45% + 0.1% + 1.5%) ≈ brutto × 1.2259
- For 27 000 brutto: employer pays ~33 099 zł → this is the fair B2B invoice equivalent

### B2B Hidden Costs (subtract from B2B net for honest comparison)
- Accounting: ~250–400 zł/month
- No paid vacation: 20 days ≈ 8% annual revenue loss
- No employer sick pay guarantee (ZUS pays 80% only after 30 days)
- Equipment, software, phone etc.

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

## Verifier Scripts (on-demand)

If `scripts/verify_math.py` exists in this repo, run: `python3 scripts/verify_math.py` before large calculation changes.
For extracted JS, use `node --check <file.js>` or the project linter. Sanity check build: `npm run build`.
Run when the user asks for verification before delivering calculator changes.
