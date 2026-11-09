## Context

The alerts were reviewed on 2026-11-09, after #99 merged (b033d02). Grouped by the fix that closes them:

| Fix | Alerts | Max severity | Reachable? | Dependabot PR |
| --- | --- | --- | --- | --- |
| `next` 16.3.8 → 16.4.x (web, `package.json` + lockfile) | 6 | critical | **Possibly.** Two unauthenticated RCEs (`use cache` with typed arrays, Image Optimization with SVG) and a Server Actions DoS. The app uses no `use cache` and doesn't enable SVG in `next.config.ts`, but it is a public server and the advisories are recent | #98, **conflicting** |
| `undici` 8.11.2 → 8.12.2 (web, via `jsdom`, dev) | 5 | high | No: test environment only | #98 (`jsdom` 30.1.3 resolves `undici` 8.12.4) |
| `minimatch` 10.2.6 → 11.0.1 (web, via `@typescript-eslint/typescript-estree`, dev) | 1 | medium | No: lint globs from the repository's own config | none. The parent asks for `^10.2.2` |
| `pillow` 12.3.0 → 13.0.0 (API, `pyproject.toml` + lockfile) | 82 | critical | Low. The API only opens images it produces itself (raster masks, Google Static Maps tiles). User uploads are geo and Excel files, which never reach PIL | #84 (major) |
| `certifi` → 2026.10.18 (API) | 1 | critical | **Yes.** It is the CA bundle for outbound TLS (Google Maps, Azure Files). The advisory concerns emSign roots whose intermediate keys were compromised | none |
| `dnspython` → 2.9.0 (API, via `email-validator`) | 1 | high | No | #91 |
| `black` → 26.10.1 (API, dev) | 1 | high | No. The advisory concerns black's GitHub Action, and CI runs `uv run black --check` | in group #96 |
| `pillow`, `certifi`, `pyasn1`, `tornado`, `msgpack` (`tools/update-gfw-tmf`) | 50 | critical | No. It is an operator-run script, never deployed | #83, #89, #90, #92, #93 |

Facts that shape the design:

- **`deploy.yml` deploys `dev` on every merge that touches `apps/`.** `main` predates the monorepo layout: it has no `apps/` directory. So the hotfix path of `automated-dependency-updates` doesn't apply, and a fix reaches the deployed environment by merging into `dev`.
- **#98 conflicts because #99 changed `apps/web/package.json` and `pnpm-lock.yaml`** after #98 opened. Before the conflict, its CI (`Tests, type-check, lint, build`) was green.
- **#84 (Pillow 13) passed the API job,** including `test_numeric_baseline`, which decodes and compares the rendered tile.
- **Pillow 13.0.0 (2026-10-16) breaking changes**, from its release notes:
  - drops Python 3.10;
  - stops clipping I-mode images saved as PNG;
  - moves `get_child_images` and removes `Image._show`, `ImageCms` product fields and `ExifTags.IFD.Makernote`;
  - `resize()` honours `reducing_gap` for RGBA/LA.

  The API uses `Image.new`, `open`, `fromarray(..., mode="RGBA")` on uint8 RGBA arrays, `alpha_composite`, `composite`, `convert`, `resize` (without `reducing_gap`), `Resampling.LANCZOS`, `ImageDraw.Draw`, and saves PNG and JPEG from RGB/RGBA images. None of these is affected.
- **All five vulnerable packages in `tools/update-gfw-tmf` are transitive.** `pyproject.toml` declares only `earthengine-api`, `geemap`, `GDAL` and `tenacity`. CI doesn't run this project: every check on its pull requests is `SKIPPED`.
- **In `apps/api`, `certifi` and `dnspython` are transitive.** `pillow` and `black` are pinned with `==` in `pyproject.toml`.
- **The `uv` lockfiles conflict line by line.** Merging one Dependabot PR makes every other PR on the same `uv.lock` conflict until Dependabot rebases it.
- **Dependabot opened no PR for `certifi` in `apps/api`**, though it did for the same advisory in `tools/` (#89). The cause is unknown (Q1).

## Goals / Non-Goals

**Goals:**

- Zero open Dependabot alerts. Each alert is fixed, or dismissed with a written reason.
- The deployed web stops running a Next.js version with a known RCE, as the first merge.
- Three merges instead of eight serial rebase-and-merge rounds.
- No application behaviour changes: rendered images stay within the numeric baseline, and the web passes its CI.

**Non-Goals:**

- The non-security parts of #96: FastAPI 0.142 → 0.162 and shapely 2.1 → 2.2 change the API's core and deserve their own review.
- #69, #73, #77 and #81, which fix no alert.
- CI coverage for `tools/update-gfw-tmf`.
- A release to `main`.

## Decisions

### D1. Next.js through #98, rebased by Dependabot

- Comment `@dependabot rebase` on #98. Dependabot regenerates the lockfile on top of `dev`, CI runs, and #98 merges.
- **Why not our own PR with just `next`:**
  - #98 already carries `next` 16.4.5 and `jsdom` 30.1.3 (and so `undici` 8.12.4);
  - its other 13 bumps are patches and minors that passed CI before the conflict;
  - a separate PR would leave #98 to conflict again.
- **Fallback:**
  - if the rebase fails, or CI fails on something unrelated to the alerts, comment `@dependabot recreate`;
  - if that fails too, open our own PR that bumps `next` and `eslint-config-next` to 16.4.x and refreshes `undici` within `jsdom`'s range.
- **Check before merging:** `pnpm why undici` and `pnpm why next` on the rebased branch show only patched versions.

### D2. API: one PR, not #84 + #91 + a manual certifi

- One branch from `origin/dev`:
  - `pyproject.toml`: `pillow==13.0.0`, and `black==26.10.1` in the `dev` group;
  - `uv lock --upgrade-package pillow --upgrade-package black --upgrade-package certifi --upgrade-package dnspython`.
- **Lockfile diff:** it must move only those four packages. Anything else is reverted, or explained in the PR.
- **`black` comes in here, not through #96**, because it closes the last API alert and #96 carries unrelated risk. #96 passed `black --check` with 26.10.1, so no reformatting is expected.
- **After the merge:**
  - close #84 and #91 as superseded;
  - Dependabot rebases #96, which loses `black`.
- **Alternative: merge #84, then #91, then add certifi by hand.** That is three rounds of rebase and CI on the same lockfile. Rejected.

### D3. Pillow 13 is accepted on the numeric baseline, plus a read of its release notes

- The `python-dependency-toolchain` numeric baseline already compares the decoded rendered tile, within the agreed tolerances. It is the gate for a Pillow major.
- The release notes were read against the API's Pillow calls (Context): no change applies.
- **Spot check:** generate one deforestation image through the router, with the regression farms. It must open and look the same as before the upgrade.

### D4. `tools/update-gfw-tmf`: lockfile refresh, checked without running the script

- Run `uv lock --upgrade-package` for `pillow`, `certifi`, `pyasn1`, `tornado` and `msgpack`. `pyproject.toml` doesn't change.
- **Checks:**
  - `uv lock --check`;
  - the lockfile diff moves only those packages, plus any dependency they require.
- `uv sync` needs the operator's system GDAL, so the script isn't run, as with #58. A bounded run is recommended to whoever regenerates the rasters next.
- **After the merge:** close #83, #89, #90, #92 and #93 as superseded.
- **Same PR as D2 or separate?** Separate. The path filters keep CI from running on `tools/` anyway, and a separate PR makes the API's merge independent of a project nobody tests.

### D5. `minimatch`: dismissed as `tolerable_risk`

- The fix requires `minimatch` 11, outside the `^10.2.2` that `@typescript-eslint/typescript-estree` declares.
- An override is allowed by `frontend-dependency-toolchain` ("Overrides only for transitive fixes"). Here it would force a major under typescript-eslint, for a ReDoS whose only inputs are the repository's own globs.
- **Dismissal:** `tolerable_risk`, with the comment "dev-only, via @typescript-eslint/typescript-estree (^10.2.2); patterns come from the repository's lint config, never from user input. Revisit when typescript-eslint allows minimatch 11."
- **Why not `vulnerable_code_not_used`:** the code does run (eslint matches globs), but on trusted input.

### D6. Order and GitHub actions

```
1. #98: @dependabot rebase → CI → merge          (web, 11 alerts)
2. API PR (D2)          → CI → merge             (85 alerts)
3. tools PR (D4)        → uv lock --check → merge (50 alerts)
4. Re-list the alerts → dismiss minimatch (D5) and anything else that remains
5. Close the superseded PRs; @dependabot rebase on #96 if it doesn't rebase itself
```

- Steps 2 and 3 can go in parallel with 1: they touch different lockfiles.
- Each GitHub action needs the user's confirmation first: PR comments, merges, closures and dismissals.

## Risks / Trade-offs

- **[R1] #98 carries 13 bumps beyond the security fix** (React 19.3.1, i18next 26.7, react-hook-form 7.91, vitest 5.1, …). → Mitigation:
  - CI (tsc, lint, unit tests, build);
  - a manual pass over the deployed `dev` site: farm upload, analysis, report download;
  - D1's fallback isolates `next` if anything breaks.
- **[R2] Pillow 13 changes rendering in a way the baseline tolerates but a user notices.** → Mitigation: the baseline's 1-level / 0.1% tolerance is strict, and D3's spot check covers it. Rollback is a revert.
- **[R3] The tools refresh breaks the script on the operator's machine,** which nobody runs in CI. → Mitigation:
  - only transitive patch and minor versions move;
  - `uv lock --check`;
  - the README already documents the bounded run;
  - a revert restores the old lock.
- **[R4] Dependabot reopens alerts or PRs for the superseded fixes.** → Mitigation: Dependabot closes a PR whose dependency is already up to date. Re-list after each merge.
- **[R5] Rebasing #96 conflicts again after D2.** → Mitigation: it is outside this change. `@dependabot rebase` or `recreate` regenerates it.

## Migration Plan

1. Comment `@dependabot rebase` on #98 (with the user's confirmation). Merge once CI is green.
2. Branch from `origin/dev` for D2: bump, lock, pytest, ruff, black, mypy, and the D3 spot check. Then a PR into `dev`.
3. Branch from `origin/dev` for D4: lock and `uv lock --check`. Then a PR into `dev`.
4. After the merges: re-list the alerts, dismiss `minimatch` (D5), close the superseded PRs, and check the `dev` deploy.
5. `CHANGELOG.md` → Unreleased → Security, in the D2 PR.

**Rollback:** revert the PR concerned. Each fix lives in its own lockfile, so the reverts are independent.

## Open Questions

- **Q1.** Why didn't Dependabot open a security PR for `certifi` in `apps/api`? Check the Dependabot job log (Insights → Dependency graph → Dependabot). If it's a recurring failure, it becomes its own issue. It doesn't block this change, because D2 fixes it.
- **Q2.** Is the dev environment publicly reachable? This decides how urgent step 1 is. The plan assumes yes.
