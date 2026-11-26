## 1. /home answers 308

Files: apps/web/src/proxy.tsx, apps/web/src/proxy.test.ts

- [x] 1.1 Fix tripwire, written first and observed red: in `proxy.test.ts`, the four `/home`
      cases (`:14-24`) expect `308`. Leave the cookie case's `307` (`:31`) as is — it is the locale
      router's.
- [x] 1.2 `proxy.tsx`: `NextResponse.redirect(url, 308)` in the `/home` branch; comment above
      `HOME` says permanent. Mutant (post-change, multi-line literal):
      `--file apps/web/src/proxy.tsx --find $'"/";\n    return NextResponse.redirect(url, 308);' --replace $'"/";\n    return NextResponse.redirect(url);' --test apps/web/src/proxy.test.ts`.

## 2. Configuration gate on the start page

Files: apps/web/src/components/reusable/RuntimeConfigGate.tsx, apps/web/src/components/reusable/RuntimeConfigGate.test.tsx

- [x] 2.1 `RuntimeConfigGate.test.tsx` (new). Mock `@/api/config` (`getConfig`) — never `fetch`;
      reset `config/runtime` state between tests as `apps/web/README.md` "Testing" says; set the
      path with `setPathname` from `src/test/navigation.ts`. Cases:
      a) start page `/`, `getConfig` pending → the band (`runtime-config-header-band`) is above the
         loading status (fix tripwire, red pre-change);
      b) start page `/en`, `getConfig` rejects → the error and its retry button show, with the band
         (fix tripwire);
      c) `/territorial-analysis`, pending → no band (regression guard);
      d) `getConfig` resolves → children render, no band (regression guard);
      e) inside `ThemeProvider` with the app theme, the band's background is `rgb(10, 36, 64)`
         (`landing.navy`).
      Mutant for a/b (post-change): `--find 'isStartPage && ' --replace 'false && '` (adapt the
      find to the final code; single-site). Mutant for c: `--find 'isStartPage && ' --replace 'true && '`.
- [x] 2.2 Implement Decision 2 of design.md in `RuntimeConfigGate.tsx`.

## 3. Map view at 390 px (manual)

Files: (none expected)

- [x] 3.1 Not automatable (jsdom has no layout). With `pnpm dev` (both apps; rasters pulled with
      `git lfs pull`), load the example farms, analyse, open `?view=map` at 390×844, and record
      in your report: the list panel's width, the list's visible height, and whether farm names
      wrap. Full-width list with one-line names → record it, no code change. Defect reproduced →
      stop with `PLAN CONFLICT:` and the measurements.

## 4. Intermittent tests

Files: apps/web/src/**/*.test.ts, apps/web/src/**/*.test.tsx

- [x] 4.1 From `apps/web`, run `pnpm test` 5 times on the tree with groups 1–2 applied; record per
      run the result line and any file over 4 s (`--reporter=verbose` or the duration column).
- [x] 4.2 For each test that exceeded 5 s in any run, apply design.md Decision 4 and re-run that
      file 3 times. If none exceeded, change nothing; the 5 result lines go in the report for the PR.

## 5. Check

- [x] 5.1 From `apps/web`: `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test` green.
      Groups 1, 2 and 4 are disjoint in files unless 4.2 edits a test of group 1 or 2.
