## Context

The alerts were reviewed on 2026-10-07, after PR #62 merged. Grouped by the direct dependency that brings them in:

| Direct dependency | Alerts | Max severity | Reachable? |
| --- | --- | --- | --- |
| `exceljs` 4.4.0 (web): `brace-expansion` ×16 (via `archiver` → `glob`/`minimatch`), `tmp` ×2, `uuid` ×1 | 19 | high | No. In the browser `exceljs` loads its prebundled `dist/exceljs.min.js` (the `browser` field), which contains no `minimatch`; `tmp` only writes files in Node; `uuid`'s bug needs v3/v5/v6 with a buffer |
| `xlsx` 0.18.5 (web): prototype pollution, ReDoS (package.json + lockfile) | 4 | high | **Yes.** `XLSX.read` parses the file the user uploads, in their browser |
| `react-markdown` → `mdast-util-to-hast` | 1 | medium | Limited: it renders the layer considerations written by country admins; it injects `class`, which isn't XSS |
| `@emotion` → `babel-plugin-macros` (`yaml`, `@babel/runtime`) | 2 | medium | No |
| `next` → `postcss` → `source-map-js` | 1 | high | No (build time) |
| `eslint` → `@humanfs/node` (dev) | 1 | medium | No |
| root `concurrently` → `shell-quote` (dev) | 1 | critical | No: `quote()` runs on our own `package.json` commands |
| `tools/update-gfw-tmf` `cryptography` 49 | 1 | high | No (PKCS#7 unused); PR #58 exists |

Facts that shape the design:

- **SheetJS left npm at 0.18.5.** The fixed versions (0.19.3 and 0.20.2+) exist only on `cdn.sheetjs.com`, and 0.20.3 is the latest there.
- **Most patched transitive versions fall inside the parents' ranges.** For example `minimatch` 3 asks for `brace-expansion ^1.1.7` (fixed in 1.1.21), and `minimatch` 5 asks for `^2.0.1` (fixed in 2.1.7). The lockfiles simply haven't been refreshed.
- **Two fixes fall outside their parents' ranges:**
  - `concurrently` 10.0.5 pins `shell-quote` to exactly `1.9.0` (the fix is in 1.11.0, and 1.12.0 is the latest);
  - `exceljs` 4.4.0 (its latest release, from 2023) asks for `uuid ^8.3.0`, and the fix is in 11.1.1.
- **Dependabot security updates are enabled** yet opened no PRs for the npm alerts. Transitive updates under pnpm and pinned parents are the known gap.
- **The web installs with `pnpm install --frozen-lockfile`** in CI and in both Dockerfiles.
- **Orphaned Dependabot PRs** from before the monorepo move (`/monbo-front`, `/monbo-api`, `/scripts/...`): #44, #52, #55 and #56. The current-path equivalents are #57–#60.

## Goals / Non-Goals

**Goals:**

- Zero open Dependabot alerts. Each alert is fixed, or dismissed in GitHub with a reason that says why.
- Fix the one reachable vulnerability (`xlsx`) with no application code change.
- Leave a record of what Dependabot can't maintain, so a future bump isn't forgotten.
- Turn on secret scanning with push protection, and CodeQL.

**Non-Goals:**

- Replacing `exceljs`, or consolidating on one Excel library (the `TODO` in `src/utils/excel.ts`). This was option C in explore: SheetJS Community can't write cell styles, so downloads would lose wrapping and row heights.
- Major upgrades that Dependabot's `ignore` rules defer (MUI 9, TypeScript 7, eslint 10, Node 26).
- Making CodeQL a required check.

## Decisions

### D1. `xlsx` 0.20.3 from SheetJS's CDN tarball

```json
"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
```

- **Why it's safe enough:**
  - the URL is versioned and immutable;
  - it is served over HTTPS by the vendor itself;
  - the API of `XLSX.read`, `sheet_to_json`, `utils` and `CellObject` is the same from 0.18 to 0.20, so the code stays as is.
- **Accepted limit: no integrity hash.** pnpm doesn't record an `integrity` for a remote tarball. The lockfile holds only `resolution: {tarball: <url>}`, so a file replaced on the CDN under the same URL would install without notice. The user accepted this, with the version pinned in the URL and trust placed in SheetJS's HTTPS host (R6).
- **Alternative: vendor the tarball** (`apps/web/vendor/xlsx-0.20.3.tgz` plus `file:`). This is what SheetJS suggests for air-gapped builds. pnpm then records the `sha512` and enforces it: a test with an altered tarball failed with `ERR_PNPM_TARBALL_INTEGRITY`. It also removes the new network host. Rejected by the user, who preferred not committing a 2.4 MB binary or touching the Dockerfiles. It stays the fallback for R1 and R6.
- **Alternative: migrate reading to `exceljs`** (B in explore). Rejected: it consolidates on the stalest dependency, the source of 19 alerts.
- **The manual bump** is documented in `apps/web/README.md`: watch SheetJS's release notes, change the URL, `pnpm install`, then test the upload and downloads.

### D2. Refresh the lockfiles before adding overrides

- Run `pnpm update` for the affected packages, at any depth, in `apps/web` and at the root. Only versions within the declared ranges move.
- Then check `pnpm why` for each one.
- Overrides are only for what remains:
  - `shell-quote` at the root, scoped to its parent: `"concurrently>shell-quote": "^1.11.0"`;
  - `uuid` in `apps/web`, scoped to its parent: `"exceljs>uuid": "^11.1.1"`. `exceljs`'s Node entry uses `v4()`, which `uuid` 11 keeps, and its CommonJS build still exists. The browser bundle doesn't use the installed `uuid` at all.
- Each override carries a comment in the README (JSON has no comments) with its reason and its exit condition: "remove when `concurrently` allows `shell-quote` ≥ 1.11" and "remove when `exceljs` moves to `uuid` ≥ 11.1.1".
- **Alternative: dismiss `uuid` and `shell-quote` as "vulnerable code not used".** It's true, but an override is just as cheap, and it removes the alerts from every future review. Dismissing stays the fallback if an override breaks the build or `pnpm dev`.

### D3. Alerts that stay open are dismissed with a reason

- After the PR merges, every remaining alert is either closed automatically by the dependency graph or dismissed as `vulnerable_code_not_used`, `tolerable_risk` or `inaccurate`. `no_bandwidth` and `fix_started` are not allowed.
- Each dismissal has a one-line comment naming the evidence, e.g. "exceljs browser build is prebundled, no minimatch".
- **Expected case:** the tarball dependency. Whether the dependency graph reads `xlsx@0.20.3` from a URL entry is unknown (Q1). If it doesn't, the four `xlsx` alerts are dismissed as fixed by the CDN tarball, with the commit that does it.

### D4. Dependabot PRs

- **Close** #44, #52, #55 and #56, each with a comment saying the path moved with the monorepo and which PR supersedes it.
- **#58** (`cryptography` 50 in `tools/update-gfw-tmf`) is the fix for its alert:
  - review it and merge it in its own PR, which is the normal Dependabot flow;
  - `tools/` has no CI job, so check `uv sync --frozen` locally.
- **#57, #59 and #60** are version updates, not alerts. They are triaged in the same pass (merge or close), but their contents are out of this change's scope.

### D5. Repository scanning

- **Secret scanning and push protection** are free for public repositories. Push protection blocks a push that contains a recognised secret; the user can bypass it with a stated reason. This fits the existing policy of keeping Azure and GCP secrets out of Git.
- **CodeQL default setup**, for the `python`, `javascript-typescript` and `actions` languages:
  - it runs on pushes and pull requests to the default and protected branches, plus a weekly scan;
  - its check is not added to the rulesets.
- Both are repository settings changed through the GitHub API or UI, **only after the user confirms**. If the organisation restricts them, record that and stop: the change doesn't escalate.

## Risks / Trade-offs

- **[R1] A new install host.** `cdn.sheetjs.com` being down or blocked breaks `pnpm install` in CI and in Docker. → Mitigation: CI caches the pnpm store. If it fails repeatedly, vendor the tarball (D1, alternative).
- **[R2] Dependabot no longer watches `xlsx`.** → Mitigation: the README lists the manual bump, and `automated-dependency-updates` requires the list of unmanaged dependencies.
- **[R3] The lockfile refresh moves more than the vulnerable packages** (siblings inside the same ranges). → Mitigation:
  - only the named packages are updated;
  - review the lockfile diff;
  - tsc, lint, build, and a manual check of the upload and both downloads with the regression farms file.
- **[R4] SheetJS 0.20 parses some cells differently** (dates, numbers). → Mitigation:
  - `readExcel` already sets `cellDates`;
  - compare `/farms/parse` results for the regression farms before and after: same farms, same values.
- **[R6] The tarball's content isn't verified** (D1). A compromised `cdn.sheetjs.com` could serve other code under the same URL. → Mitigation:
  - the version is fixed in the URL;
  - the README states the limit;
  - if SheetJS's host is ever reported compromised, vendor the tarball, which pnpm verifies.
- **[R5] CodeQL's first scan reports findings in existing code.** → Mitigation: triage them like the dependency alerts: fix, or dismiss with a reason. A large backlog becomes its own change.

## Migration Plan

1. Branch from `origin/dev`.
2. Lockfile refresh and overrides (D2), and SheetJS (D1). Then tsc, lint, build, and the manual Excel checks.
3. Open a PR into `dev`. Merging redeploys the web app. Afterwards, check the alert list and dismiss the remainder (D3).
4. Dependabot PRs (D4) and repository scanning (D5), with the user's confirmation for each GitHub action.

**Rollback:** revert the PR to restore the previous lockfiles and `xlsx` 0.18.5. Repository settings can be turned off again.

## Open Questions

- **Q1.** Does GitHub's dependency graph resolve the version of a tarball URL dependency in `pnpm-lock.yaml`? This decides whether the `xlsx` alerts close themselves or need a dismissal (D3).
- **Q2.** Does the organisation allow enabling secret scanning, push protection and CodeQL at the repository level?
