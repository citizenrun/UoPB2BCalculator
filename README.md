# UoP B2B Calculator

Polish **umowa o pracę (UoP)** salary calculator: bilingual (PL/EN), month-by-month net, ZUS cap, KUP modes, calibration data, and employer-cost view. Single-page static app.

**Live site (GitHub Pages):** [citizenrun.github.io/UoPB2BCalculator](https://citizenrun.github.io/UoPB2BCalculator/)

## Quick start

Open `index.html` in a browser, or use a local dev server:

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Build for hosting

```bash
npm run build
```

Static files are written to `dist/`. Deploy `dist/` to any static host (GitHub Pages, Netlify, Cloudflare Pages, S3, etc.).

For GitHub **project** pages (`https://<user>.github.io/<repo>/`), the workflow below passes `--base=/<repo>/` automatically. For other hosts, `npm run build` with `base: './'` in `vite.config.js` is usually enough.

## Testing

**You do not need integration tests** for the app to work; `npm run build` is the minimum sanity check.

Optional **smoke tests** (Playwright) cover: page loads, B2B tab opens, job autocomplete selects a role and sets **Ryczałt 12%** for a software match.

```bash
npm install
npx playwright install chromium   # once per machine
npm test                          # build + run tests
```

GitHub Actions: **`.github/workflows/ci.yml`** runs **unit + Playwright** on **pull requests** and on **every push to `main`**. **`.github/workflows/deploy-pages.yml`** runs only on **push to `main`**: it **tests first**, then **patch-bumps** `package.json`, appends **`CHANGELOG.md`** (first line of that commit), refreshes **`public/release.json`**, builds, publishes Pages, and pushes **`chore(release): … [skip ci]`** so the bot commit does not re-trigger deploy. The site shows **version** + **history** from `release.json` and links **`changelog.md`**. Edit **`CHANGELOG.md`** for clearer notes. Add cases in **`tests/smoke.spec.js`** when payroll logic changes.

## GitHub (this project)

### Private repository and Pages

- **GitHub Free:** Pages is only available if the **repository is public**. Your code stays private only if you use another host (Netlify, Cloudflare Pages, Vercel) connected to the private repo—those are fine on free tiers.
- **GitHub Pro / Team / Enterprise:** You can use Pages with a **private** repo. The **website URL is still public** (anyone with the link can open the calculator). Only **GitHub Enterprise** offers access-controlled Pages.

### One-time setup on github.com

1. Open the repo → **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, choose **GitHub Actions** (not “Deploy from a branch”).
3. Push to `main` to build and deploy (or re-run the latest **Deploy to GitHub Pages** job in **Actions** if a run failed).

After the first successful run, Settings → Pages shows the site URL. This repo is published at **`https://citizenrun.github.io/UoPB2BCalculator/`** (Vite build uses `base: '/UoPB2BCalculator/'` in CI via `vite build --base=/…/`).

### `gh` CLI (optional)

If you use [GitHub CLI](https://cli.github.com/):

```bash
gh repo view --web              # open repo in browser
```

Deploy is triggered by **push to `main`**; use the **Actions** tab to re-run a failed **Deploy to GitHub Pages** job.

No deploy secrets are required for this workflow; `GITHUB_TOKEN` is enough.

## Cursor (agents)

- **Rules:** [`.cursor/rules/calculator-project.mdc`](.cursor/rules/calculator-project.mdc) — stack, main files, verify commands.
- **Skill:** [`.cursor/skills/uop-kalkulator/SKILL.md`](.cursor/skills/uop-kalkulator/SKILL.md) — Polish payroll domain (UoP + B2B/ryczałt), formulas, calibration notes.

## License

MIT — see [LICENSE](LICENSE).
