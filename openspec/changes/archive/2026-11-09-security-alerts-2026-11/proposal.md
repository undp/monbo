## Why

The repository has 147 open Dependabot alerts: 21 critical, 82 high, 43 medium and 1 low. They come from 12 packages. Two critical ones are unauthenticated remote code execution in Next.js 16.3.8, which runs in the dev environment that `deploy.yml` deploys on every merge into `dev`. Dependabot has already opened pull requests for most fixes. One of them, #98, conflicts with #99. Five pull requests edit the same `uv.lock` in `tools/update-gfw-tmf`, so each merge makes the next one conflict. Three alerts have no pull request at all.

## What Changes

- **Web: Next.js 16.4.5 and undici 8.12.4, through Dependabot's #98.** Dependabot rebases #98 onto `dev` after #99. Its group of 15 minor and patch bumps includes `next` 16.4.5 and `jsdom` 30.1.3, which brings `undici` 8.12.4. It closes 11 alerts, and it goes first.
- **API: one pull request for every API alert.** It closes 85 alerts:
  - `pillow` 12.3.0 → 13.0.0 (major, 82 alerts);
  - `black` 26.5.1 → 26.10.1 (dev group);
  - `certifi` ≥ 2026.10.18 and `dnspython` ≥ 2.9.0, lockfile only. `certifi` has no Dependabot pull request.

  It supersedes #84 and #91. #96 keeps its other bumps.
- **GFW/TMF script: one lockfile refresh.** `pillow`, `certifi`, `pyasn1`, `tornado` and `msgpack` move to their patched versions, lockfile only, since all five are transitive. It closes 50 alerts and supersedes #83, #89, #90, #92 and #93.
- **minimatch: dismissed with a written reason.** `@typescript-eslint/typescript-estree` asks for `minimatch ^10.2.2`, and the fix is in 11.0.1. It is development-only, and its patterns come from the repository's own lint config. The alert is dismissed as `tolerable_risk`, without an override that would force a major under typescript-eslint.
- **Every alert is resolved:** it is fixed, or dismissed in GitHub with a written reason. Superseded Dependabot pull requests are closed with a comment that names their replacement.
- **Out of scope:** the pull requests with no alerts. That is the rest of #96 (FastAPI 0.142 → 0.162, shapely 2.1 → 2.2, pytest, ruff, mypy, azure-storage-file-share), plus #69, #73, #77 and #81. They follow the normal Dependabot review.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `automated-dependency-updates`: security fixes are ordered by exposure. Fixes for code that runs in a deployed environment come first. When several Dependabot pull requests fix alerts in the same lockfile, one pull request may apply them together and supersede them.
- `python-dependency-toolchain`: a Pillow major upgrade must keep the API's rendered images within the numeric baseline's tolerances.

## Impact

- **`apps/web`:** `package.json` and `pnpm-lock.yaml`, through #98. No application code changes.
- **`apps/api`:**
  - `pyproject.toml` (`pillow`, `black`) and `uv.lock`;
  - no code changes are expected; that depends on the Pillow 13 release notes (design D3).
- **`tools/update-gfw-tmf`:** `uv.lock` only. CI doesn't run this project, so it is checked with `uv lock --check`.
- **GitHub:**
  - one alert dismissal (`minimatch`);
  - seven Dependabot pull requests closed as superseded;
  - `@dependabot rebase` comments on #98 and #96.

  Each action needs the user's confirmation.
- **Deploy:** each merge into `dev` that touches `apps/` redeploys the dev environment.
- **Docs:** `CHANGELOG.md` (Unreleased → Security).
