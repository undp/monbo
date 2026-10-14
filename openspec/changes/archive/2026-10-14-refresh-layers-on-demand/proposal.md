## Why

A layer an admin enables can take up to five minutes to reach users who already have the app open. The API serves it right away (one replica, the index cache is updated on write, `/maps` sends no cache headers). The delay is in the frontend: `DataProvider` lives in the locale layout, fetches `/countries` and `/maps` on mount, and then only every five minutes (`AVAILABLE_MAPS_POLLING_INTERVAL`). Navigating between pages doesn't refetch, and neither does returning to the tab. Lowering the interval isn't a fix: it would only shorten the delay, and every `/maps` call reads each layer's metadata from the SMB share.

## What Changes

- `DataProvider` refetches `/countries` and the selected country's `/maps` when the tab becomes visible again or the window regains focus. Refetches closer together than a minimum gap are skipped, so a `visibilitychange` and `focus` pair, or quick tab switching, costs one request.
- `DataProvider` exposes a function that refetches the selected country's layers. It follows the same minimum gap.
- The two places where the user chooses layers for a new analysis call that function when they open: the deforestation modal on the polygon validation page, and the deforestation upload page. The report's layer selection (`MapSelectionModal`) is not touched: it lists the layers that were already analyzed, not `/maps`.
- Every refetch goes through the same path as the poll, so invalidation, hidden-layer and late-response handling behave the same. The five-minute poll stays as a fallback.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `country-selection`: new requirement covering when the country and layer lists are refreshed (on mount, on return to the tab, when a layer selector opens, and on the poll).
- `frontend-unit-tests`: the data provider coverage adds the on-demand refreshes and the minimum gap.

## Impact

- `apps/web/src/context/DataContext.tsx`: visibility and focus listeners, the minimum gap, and the exposed refresh function on the context.
- `apps/web/src/config/constants.ts`: the minimum gap constant.
- `apps/web/src/components/page/polygonsValidation/DeforestationModal.tsx` and `apps/web/src/components/page/deforestationAnalysis/DeforestationAnalysisUploadDataPageContent.tsx`: call the refresh when they open or mount.
- `apps/web/src/context/DataContext.test.tsx`: new cases.
- API, contracts and infra: no changes. Users who switch tabs or open a selector send a few more `/maps` and `/countries` requests, bounded by the minimum gap.
