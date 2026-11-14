# Fall 2026 Retreat

V1 Michigan’s mobile-friendly Bellaire retreat scrapbook for November 13–15, 2026.

Hosted site: https://v1-cabin-retreat.vibrantball16.chatgpt.site

Includes the schedule, local activities, packing checklists, weather, house details, retreat photos, and SWSH photo drop. The mobile navigation opens from a hamburger menu.

## Build and test

Use Node.js 24 or later. No dependency installation is required.

```sh
node scripts/build-worker.mjs
node --test --test-isolation=none --test-reporter=spec tests/password-gate.test.mjs
```

The build embeds the page and local assets into `dist/server/index.js`, a Cloudflare Worker ES module. The generated `dist/` directory is excluded from Git.

## Source

- `site/`: HTML, CSS, JavaScript, photos, fonts, and icons.
- `worker/index.js`: server-side password gate and asset delivery.
- `scripts/build-worker.mjs`: deterministic Worker build.
- `tests/password-gate.test.mjs`: authentication and asset-protection tests.
- `.openai/hosting.json`: existing Sites project identity.

Edit `site/` and `worker/`, then rebuild. The hosted site is managed through Sites; pushing to this repository does not automatically deploy it.

## Runtime configuration

Configure these as server-side secrets in the hosting environment:

- `RETREAT_PASSWORD`: the shared retreat password.
- `RETREAT_SESSION_SECRET`: a long, random session-signing secret.

`.env.example` lists the variable names without values. Never commit actual passwords, session secrets, cookies, or local environment files. Local environment files are not automatically loaded by the Worker build.

The deployed Worker protects both the page and its assets. Successful login issues a signed, secure, HttpOnly cookie that expires after seven days. Password changes invalidate existing sessions. A “Lock site” button clears the browser session.

This repository intentionally contains the full public source, including photos and the house address. The hosted password gate does not restrict access to files in this public repository. Do not deploy `site/` directly as a public static site if password protection is required.

## Third-party assets

Font and icon licenses are included alongside their files in `site/assets/`. Activity photo sources are credited in the site’s activities section. Retreat photos were supplied by the site owner; other image and brand rights remain with their respective owners.
