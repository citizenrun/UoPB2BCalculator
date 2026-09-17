# Changelog

## [0.1.8] - 2026-09-17
- docs: keep the copyright attribution the AGPL text does not carry


## [0.1.7] - 2026-09-16
- Correct copyright name in LICENSE file


## [0.1.6] - 2026-09-16
- chore: ignore PDFs so payslips cannot be published by accident


## [Unreleased]
- feat: Lemon Squeezy webhook issues, renews and revokes licence keys — HMAC-SHA256 verified against the raw body, idempotent on retries, and it never echoes the key in its response
- feat: `public/_headers` adds a CSP and security headers for Cloudflare Pages (ignored by GitHub Pages, so it is safe to land before the migration)
- feat: Cloudflare Pages deploy workflow, `workflow_dispatch` only until the project exists
- **licence: relicensed from MIT to AGPL-3.0** for the open core; `worker/` is proprietary (LICENSE-paid). Versions up to v0.1.7 remain MIT
- feat: payslip reconciliation moved behind a licensed Cloudflare Worker endpoint — the client posts figures and receives results, the rules are no longer shipped to the browser
- feat: cookieless, no-op-by-default analytics (`public/analytics.js`), honouring DNT and GPC; records page views and fixed event names only
- fix: apply the full 300 zł ulga in the month the 32% bracket is crossed (was pro-rata — overstated tax by ~41 zł)
- fix: round the taxable base and the tax advance to whole złoty (art. 63 § 1 Ordynacji podatkowej)
- fix: employer-funded taxable benefits (ER Medicover, ER Multisport) now raise the ZUS/PIT base without being paid out
- fix: compute statutory working time per year instead of hardcoding it — adds Wigilia (24 Dec, statutory from 2025) and the Saturday day-off-in-lieu rule (art. 130 § 2 KP); August 2026 is 20 days, not 21
- fix: absences are capped by the month's working days instead of double-subtracting public holidays
- fix: minimum wage 2026 is 4 806 zł, not 4 666 zł
- fix: employer accident insurance (wypadkowe) is now an input — it varies by PKD and headcount, and the hardcoded 1,67% overstated employer cost by 1% of gross for an office/IT employer actually at 0,67%
- fix: employer PPK (1,5%) is no longer charged when the employee has opted out
- fix: employer loaded-cost multiplier is derived from the accident rate and PPK status instead of the hardcoded 1,2259, which also corrects the "fair B2B invoice equivalent" in the UoP↔B2B comparison
- feat: annual KUP budget panel — how many days off the 120 000 zł limit absorbs for free, how many you have left, and the net cost of one extra day in each month
- feat: payslip reconciliation panel — rebuild one month from six payslip numbers, diff it line by line, and back-solve the real creative-work share
- feat: per-month `NC` column for working days not reported as creative work
- feat: year-to-date opening balances from `Narastająco w roku`, to realign the ZUS cap and the 32% bracket when payroll pays a month in arrears
- refactor: payroll core extracted to `public/payroll.js`, covered by `tests/payroll.validation.test.mjs` against two real 2026 payslips

## [0.1.5] - 2026-04-15
- chore: update workspace rules and bump release to v0.1.4


## [0.1.4] - 2026-04-06
- docs(readme): version badge from live release.json (matches site footer)


## [0.1.3] - 2026-04-06
- docs(readme): show deployed version badge from package.json on main


## [0.1.2] - 2026-04-06
- fix(ci): restore CI on main push; deploy only via push to main


## [0.1.1] - 2026-04-06
- Manual deploy


All notable changes are listed here. **Patch version** (`package.json`) is bumped automatically on each successful **Deploy to GitHub Pages** workflow; the new entry’s bullet text is taken from the **first line of the triggering commit message** (merge / squash title). Edit older sections manually when you need clearer release notes.

## [0.1.0] - 2026-04-06

- Initial documented baseline for the public calculator: bilingual UoP month-by-month net (ZUS cap, KUP autorskie, PIT-0 / powrót, variable bonuses grid, employer cost view), reverse gross-from-net solver, B2B JDG tab (ryczałt / liniowy / skala, ZUS phases, day-rate invoicing, monthly extras, VAT settlement note), job-rules PKWiU autocomplete, GitHub Pages deploy with tests-before-build.
