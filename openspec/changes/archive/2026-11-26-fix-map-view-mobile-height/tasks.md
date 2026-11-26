## 1. Map container height below md

Files: apps/web/src/components/page/territorialAnalysis/MapView.tsx, apps/web/src/components/page/territorialAnalysis/MapView.test.tsx

- [x] 1.1 Fix tripwire, written first and observed red: in `MapView.test.tsx`, locate the map
      container (the parent of the "Layer legend" note, `role="note"`) and assert its computed
      `height` is `360px` and `flexGrow` is `0`. Mutant (post-change):
      `--file apps/web/src/components/page/territorialAnalysis/MapView.tsx --find 'height: { xs: 360, md: "auto" }' --replace 'minHeight: { xs: 360, md: 0 }' --test apps/web/src/components/page/territorialAnalysis/MapView.test.tsx`.
- [x] 1.2 Apply design.md Decision 1 to the map container's `sx`.
- [x] 1.3 Manual check handed to the orchestrator (jsdom has no layout): after this change's
      commit, the orchestrator opens the map view in a browser at 390×844 (map ~360 px tall, not
      blank) and 1280×800 (map fills the height beside the list) and records the result in PR
      #183. The coder ticks this task once the hand-off is noted in its report; a failed check
      comes back as a review-round fix.
- [x] 1.4 From `apps/web`: `pnpm exec tsc --noEmit`, `pnpm run lint`, and
      `pnpm exec vitest run src/components/page/territorialAnalysis/MapView.test.tsx` pass.
