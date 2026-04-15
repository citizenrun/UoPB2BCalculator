# Agent instructions (Cursor / Codex)

**Mandatory.** Cursor loads **`.cursor/rules/agents-mandatory.mdc`** (`alwaysApply: true`) — you **must** follow this file and the table below; skills are **not** optional for matching work.

## Skills to load for this repository

Use the **Read** tool on the skill path **before** edits or domain answers when the task matches.

| When | Read (full file) |
|------|------------------|
| UoP/B2B calculator, payroll, PKWiU, `index.html`, `public/job-rules.json`, tests for this app | [`.cursor/skills/uop-kalkulator/SKILL.md`](.cursor/skills/uop-kalkulator/SKILL.md) |
| Git / history / stash / force-push, data-loss risk, or large risky refactors | [`.cursor/skills/agent-workflow/SKILL.md`](.cursor/skills/agent-workflow/SKILL.md) |

Also applies: **`.cursor/rules/agent-workflow.mdc`** (plan → confirm → implement for risky ops) and **`project.mdc`** (stack, test commands).

## Project structure

- **App:** `index.html` at repo root + **`public/job-rules.json`** (B2B roles, loaded via `fetch`).
- **Build:** `npm run build` → `dist/` (Vite). Dev: `npm run dev`.
- **Tests:** `npm run test:unit` (Vitest) and `npm test` (unit + build + Playwright).
- **CI:** `.github/workflows/ci.yml` — unit + Playwright on PRs. `.github/workflows/deploy-pages.yml` — tests + deploy on push to `main`.

## Protect local work before the next change

Before running commands that rewrite history, prune Git objects, hard-reset, or otherwise need a **clean** tree:

1. Run **`git status`** and review untracked files. If anything matters, **stop** and agree: **`git commit`** (WIP branch OK) or stash with clear restore plan.
2. Do **not** assume uncommitted edits exist only in the editor buffer; source of truth is the working tree + last commit.
3. Prefer **small commits** so recovery is always possible.

## Quick checks after changes

```bash
npm run test:unit   # Vitest — job-rules contract
npm test            # unit + production build + Playwright
```

## B2B data

Edit **`public/job-rules.json`** (or regenerate from HTML via `scripts/build-job-rules.mjs`). Do not claim full KIS verification without citations.
