## Context

- `src/proxy.tsx:40-47`: the `/home` branch calls `NextResponse.redirect(url)` (Next's default,
  307); the retired stage-2 and report-preview branches pass `308` (`:30`, `:37`).
  `src/proxy.test.ts:14-24` asserts 307 for the four `/home` cases; `:26-33` asserts 307 for
  `/` → `/en` with the `en` cookie, which is `next-i18n-router`'s redirect, not ours.
- `app/[locale]/layout.tsx:73-78` renders `<HeaderSpacer />` before `RuntimeConfigBoundary`, so on
  every page but the start page the gate's states already sit below the header.
  `HeaderSpacer.tsx:10-11` returns `null` on the start page; there `HeaderBar.tsx:18-27` makes the
  bar `position: absolute`, transparent, with white text, meant to sit over the hero. The gate's
  loading (`RuntimeConfigGate.tsx:61`, `LoadingScreen` on `FLOW_COLORS.pageBackground`,
  `LoadingScreen.tsx:20-22`) and error (`:44-58`) have no hero, so the white header overlaps them
  and barely reads. `RuntimeConfigGate` has no test file today.
- `MapView.tsx:106-125` (since #148, `d0a975b`) stacks the list above the map below `md`
  (`flexDirection: { xs: "column", md: "row" }`), list panel `maxHeight: 320` at `xs`. The 72 px
  report (#144 review) described the list *column* in the old row layout, so it is likely gone;
  unverified in a browser.
- Vitest has no `testTimeout` (`apps/web/vitest.config.mts:10`), so 5 s. #144's gate saw
  `CategoryPanel.test.tsx` at 5.9 s under load, 2.8 s alone.

## Goals / Non-Goals

**Goals:** 308 for `/home`; the gate's states legible on the start page; a recorded 390 px check;
5 recorded suite runs without timeouts. **Non-Goals:** see proposal.

## Decisions

1. **308 on the `/home` branch** and update the comment above `HOME` (`proxy.tsx:7-9`) to say
   permanent. Safe to cache: the target depends only on the path (`/home` → `/`, `/en/home` →
   `/en`); the language for `/` is then the locale router's job (cookie), uncached by us.
2. **A navy band only on the start page, only in the gate's two states.** In
   `RuntimeConfigGate`, when `useIsStartPage()` and the state is `loading` or `error`, render
   `<Box data-testid="runtime-config-header-band" sx={{ backgroundColor: "landing.navy" }}><Toolbar /></Box>`
   before the content (user decision 2026-11-26, option B). `sx` palette path, not `useTheme()`,
   so renders without a `ThemeProvider` don't throw. `Toolbar` gives exactly the header's height
   at every breakpoint, as `HeaderSpacer` does.
   - Rejected: a plain `Toolbar` (option A) — the header stays white on light. Rejected: changing
     `HeaderBar` — it would alter the start page's look after load.
3. **390 px check is manual** (jsdom has no layout): open the map view at 390×844 with the
   10-farm example and record the list's width and whether names wrap. If the list is full-width
   with names on one line, record it in the PR and change nothing. If the defect reproduces,
   stop with `PLAN CONFLICT:` and the measurements — no improvised redesign.
4. **Flaky tests: 5 full runs**, recording per run the pass count and the slowest files. A test
   over 5 s in any run: first make it faster (typical cause, `userEvent.type` of long strings →
   `user.paste` or `fireEvent.change` where the test doesn't assert per-keystroke behaviour); if
   the time is inherent, set that test's timeout to 3× its slowest measured time with a comment
   citing the measurement. Never raise the global timeout.

API contract / data shape / cross-stack wiring: N/A — web only, no API.
Signal tracing: N/A — no signal.

## Hazards (Step 2b)

| File | Failure mode | Evidence |
|---|---|---|
| `src/proxy.tsx` | A permanent redirect to a state-dependent target would be cached wrongly; also must not change the locale router's 307 | `proxy.tsx:40-48`; `proxy.test.ts:26-33` |
| `src/proxy.test.ts` | The cookie case's 307 belongs to `i18nRouter`; flipping it to 308 would be wrong | `proxy.test.ts:30-31` |
| `RuntimeConfigGate.tsx` | `useTheme().palette.landing` throws in renders without a provider; `useIsStartPage` needs `usePathname` (mocked globally by `src/test/navigation.ts`) | `ResultChip.tsx:15` pattern; `test/navigation.ts:20-22` |
| `MapView.tsx` | Not touched by this change (only read); change 2 of this batch edits it | — |
| test files that time out | Raising the global timeout hides real slowness | CLAUDE.md Testing; #144 gate comment |

## Risks / Trade-offs

- [308 cached by browsers that saw `/home`] → intended: `/home` is retired.
- [Flaky tests don't reproduce in 5 runs] → recorded in the PR; not proof of absence (as the issue says).
