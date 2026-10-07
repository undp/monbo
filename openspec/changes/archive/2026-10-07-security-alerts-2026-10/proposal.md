## Why

The public repository has 30 open Dependabot alerts: 1 critical, 17 high, 9 medium and 3 low. Only one family of alerts is reachable in practice: `xlsx` (SheetJS) 0.18.5 parses the Excel files users upload, in their browser, and it is vulnerable to prototype pollution and ReDoS. npm has no patched version, because SheetJS stopped publishing there. The other 26 are old transitive versions that the lockfiles never refreshed. Two of them are out of reach of a refresh, because their parent pins them. Meanwhile, nothing scans the code or the commits: secret scanning and code scanning are off.

## What Changes

- **SheetJS from its CDN.** `xlsx` moves from npm 0.18.5 to 0.20.3, installed from SheetJS's tarball (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`). The code is unchanged. Dependabot can't update a dependency outside the registry, so the README documents how to bump it by hand.
- **Lockfile refresh.** Transitive dependencies move to their patched versions within the ranges their parents declare:
  - `brace-expansion` and `tmp` (via `exceljs`);
  - `yaml` and `@babel/runtime` (via `@emotion`);
  - `mdast-util-to-hast` (via `react-markdown`);
  - `source-map-js` (via `next`/`postcss`);
  - `@humanfs/node` (via `eslint`).
- **Overrides only where a parent's range excludes the fix:**
  - `shell-quote`: `concurrently` 10.0.5 pins exactly 1.9.0, in the root lockfile;
  - `uuid`: `exceljs` asks for `^8.3.0`, and the fix is in 11.1.1.

  Each override is commented with the reason and when to remove it.
- **`cryptography` 50** in `tools/update-gfw-tmf`, through Dependabot's open PR #58.
- **Dependabot cleanup:**
  - close the PRs left behind by the monorepo move, which target paths that no longer exist (#44, #52, #55, #56);
  - triage the open ones (#57, #59, #60).
- **Repository scanning.** Turn on, with the user's confirmation since these are repository settings:
  - secret scanning with push protection;
  - CodeQL default setup for Python, JavaScript/TypeScript and Actions.
- **Every alert is resolved:** fixed, or dismissed in GitHub with a written reason.

## Capabilities

### New Capabilities

- `repository-security-scanning`: secret scanning with push protection and CodeQL code scanning are enabled on the public repository, and their alerts are triaged like Dependabot's.

### Modified Capabilities

- `automated-dependency-updates`: open security alerts are resolved, by fixing them or dismissing them with a written reason. Dependencies Dependabot can't update (a vendor tarball, a `pnpm` override) are listed with their manual check.
- `frontend-dependency-toolchain`: a dependency may come from outside the npm registry only when the registry has no patched version, as the vendor's versioned tarball URL; its content isn't hash-verified, and the README says so. `pnpm` overrides are allowed only for transitive fixes a parent's range excludes, each one commented.

## Impact

- **`apps/web`:**
  - `package.json`: `xlsx` source, `pnpm.overrides`;
  - `pnpm-lock.yaml`;
  - README: how to bump SheetJS.
  - No application code changes; the Excel upload and the result downloads must keep working.
- **Root:** `package.json` (`pnpm.overrides` for `shell-quote`) and `pnpm-lock.yaml`.
- **`tools/update-gfw-tmf`:** `uv.lock`, through PR #58.
- **Install:** CI and Docker builds fetch `xlsx` from `cdn.sheetjs.com`, a new host besides the npm registry.
- **GitHub:**
  - repository security settings;
  - alert dismissals;
  - closing orphaned Dependabot PRs;
  - a new "CodeQL" check on pull requests, not required.
- **Deploy:** merging into `dev` redeploys the web app, with no change in behaviour.
