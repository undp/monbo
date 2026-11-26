## Why

Three small leftovers of the layer manager (#116) in the web flow, tracked in #168 (MB-8 of
#172): `/home` answers a temporary redirect (307) while every other retired route answers 308; on
the start page, the configuration wait and its error are drawn under the transparent header; and
two things reported but unverified since — the farm list of the map view at 390 px (review of
#144) and intermittent test timeouts.

## What Changes

- `/home`, `/es/home` and `/en/home` answer a permanent redirect (HTTP 308) to the start page.
- On the start page, while `GET /config` loads or after it fails, the gate shows a navy band the
  height of the header behind it, so the header reads and the wait or error sits below it. Other
  pages are unchanged (the layout's `HeaderSpacer` already covers them).
- The map view at 390 px is checked in the browser; the result is recorded in the PR.
- The full web suite runs 5 times; any test that passes the 5 s timeout is made faster or given a
  measured, commented timeout.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `country-selection`: the `/home` redirect becomes permanent (308).
- `product-configuration`: the configuration wait and error stay clear of the header on the start page.

## Impact

- Web only: `src/proxy.tsx`, `src/proxy.test.ts`, `src/components/reusable/RuntimeConfigGate.tsx`
  and a new test beside it; possibly test files that time out.
- No API or contract change. A 308 is cached by browsers; the targets don't depend on any state.

## Non-goals

- Changing the locale router's own redirects (`/` → `/en` by cookie stays 307, from
  `next-i18n-router`).
- Redesigning the map view; a reproduced 390 px defect goes back to the planner.
- `docs/excel_integration` (written by the documenter stage).
