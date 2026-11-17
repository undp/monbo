export const AVAILABLE_MAPS_POLLING_INTERVAL = 1000 * 60 * 5; // 5 minute
// Returning to the tab or opening a layer selector refetches the lists, but not
// when the same list was fetched less than this long ago.
export const ON_DEMAND_REFRESH_MIN_GAP = 1000 * 30; // 30 seconds

// A report with more farm pages than this (one sheet per selected farm, plus one map
// page per selected farm × layer pair with a result) is large. It is delivered only
// as a ZIP with one PDF per farm, built farm by farm: a complete PDF of a few
// thousand pages runs the tab out of memory (about 3500 pages crashed it, 2000
// didn't). With the sheets counted, a complete PDF has at most 1000 farm pages, of
// which fewer than 1000 carry an image: under what was measured.
export const LARGE_REPORT_FARM_PAGES = 1000;
