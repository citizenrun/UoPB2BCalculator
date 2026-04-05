# Agent instructions (Cursor / Codex)

**Mandatory.** Cursor loads **`.cursor/rules/agents-mandatory.mdc`** (`alwaysApply: true`) — you **must** follow this file and the table below; skills are **not** optional for matching work.

## Skills to load for this repository

Use the **Read** tool on the skill path **before** edits or domain answers when the task matches.

| When | Read (full file) |
|------|------------------|
| UoP/B2B calculator, payroll, PKWiU, `index.html`, `job-rules.json`, tests for this app | [`.cursor/skills/uop-kalkulator/SKILL.md`](.cursor/skills/uop-kalkulator/SKILL.md) |
| Git / history / stash / force-push, data-loss risk, or large risky refactors | [`.cursor/skills/agent-workflow/SKILL.md`](.cursor/skills/agent-workflow/SKILL.md) |

Also applies: **`.cursor/rules/agent-workflow.mdc`** (plan → confirm → implement for risky ops) and **`calculator-project.mdc`**.

## Protect local work before the next change

Before running commands that rewrite history, prune Git objects, hard-reset, or otherwise need a **clean** tree:

1. Run **`git status`** (and review untracked files). If there is anything the user cares about, **stop** and agree on a safe step: **`git commit`** (even a WIP commit on a branch), or an explicit stash **with a clear restore plan** — never combine **stash** with aggressive **`git gc --prune`** or similar without the user’s OK.
2. Do **not** assume uncommitted edits exist only in the editor buffer; the source of truth is the **working tree + last commit**.
3. Prefer **small commits** over long-lived uncommitted batches so recovery is always possible from `git`.

## Quick checks after changes

```bash
npm run test:unit   # Vitest — job-rules contract
npm test            # unit + production build + Playwright
```

## B2B data

Edit **`public/job-rules.json`** (or regenerate from HTML via `scripts/build-job-rules.mjs` if migrating). Do not claim full KIS verification without citations.
