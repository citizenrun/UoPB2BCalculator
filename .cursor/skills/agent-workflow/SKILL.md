---
name: agent-workflow
description: >
  Use for any task involving Git history rewrite, stash, force push, bulk deletes, or large refactors.
  Enforces plan-then-confirm-then-implement. Trigger when the user asks for workflow, safety, review before acting,
  or when an operation could lose uncommitted work.
---

# Agent workflow — plan, confirm, implement

## Default (this repo)

0. **Local work** — Before anything that needs a clean tree or can drop objects: `git status`; protect edits via **commit** (WIP branch OK) or stash **only** with user agreement and no follow-up `gc --prune` without restore. Repo **`AGENTS.md`** has the full checklist.

1. **Plan** — State what you will do, files/commands touched, and **risks** (e.g. stash loss, force-push, divergent history).
2. **Confirm** — Wait for the user to approve **unless** the user already gave explicit one-shot approval in the same message (e.g. “yes, rewrite history”).
3. **Implement** — Execute only what was agreed. Prefer **commits** over long-lived **stash** before `git filter-branch`, `git gc --prune`, or `git reset --hard`.

## Never without explicit user OK

- `git filter-branch`, `git filter-repo`, history rewrite, `push --force` to shared default branch
- `git stash` then destructive cleanup (`gc --prune=now`) without restoring stash first
- `rm -rf` of project dirs, wiping `node_modules` + lockfile together without reinstall plan

## If the user is upset about a past mistake

Acknowledge, restore from git/backup when possible, then **re-implement** missing work in small verifiable commits.
