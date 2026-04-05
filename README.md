# UoP B2B Calculator

Polish **umowa o pracę (UoP)** salary calculator: bilingual (PL/EN), month-by-month net, ZUS cap, KUP modes, calibration data, and employer-cost view. Single-page static app.

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

## GitHub (this project)

### Private repository and Pages

- **GitHub Free:** Pages is only available if the **repository is public**. Your code stays private only if you use another host (Netlify, Cloudflare Pages, Vercel) connected to the private repo—those are fine on free tiers.
- **GitHub Pro / Team / Enterprise:** You can use Pages with a **private** repo. The **website URL is still public** (anyone with the link can open the calculator). Only **GitHub Enterprise** offers access-controlled Pages.

### One-time setup on github.com

1. Open the repo → **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, choose **GitHub Actions** (not “Deploy from a branch”).
3. Push to `main` (or run the workflow manually: **Actions** → **Deploy to GitHub Pages** → **Run workflow**).

After the first successful run, Settings → Pages shows the site URL (typically `https://<your-username>.github.io/UoPB2BCalculator/` if that is your repo name).

### `gh` CLI (optional)

If you use [GitHub CLI](https://cli.github.com/):

```bash
gh repo view --web              # open repo settings in browser
gh workflow run "Deploy to GitHub Pages"   # manual deploy
```

No deploy secrets are required for this workflow; `GITHUB_TOKEN` is enough.

## Cursor skill

Domain rules and calibration notes for agents live in [`.cursor/skills/uop-kalkulator/SKILL.md`](.cursor/skills/uop-kalkulator/SKILL.md).

## License

MIT — see [LICENSE](LICENSE).
