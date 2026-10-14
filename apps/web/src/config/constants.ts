export const AVAILABLE_MAPS_POLLING_INTERVAL = 1000 * 60 * 5; // 5 minute
// Returning to the tab or opening a layer selector refetches the lists, but not
// when the same list was fetched less than this long ago.
export const ON_DEMAND_REFRESH_MIN_GAP = 1000 * 30; // 30 seconds
