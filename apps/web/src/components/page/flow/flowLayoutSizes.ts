// Plain values, importable from the server page components.

/**
 * Height of a results table section on a stage page: the viewport below the app
 * header and the page title, so the table stays usable while the flow header
 * scrolls away above it and the next-stage card below it. Stage 1's results use
 * it as their most: a short table is only as tall as its rows.
 */
export const RESULTS_SECTION_HEIGHT = "max(420px, calc(100vh - 64px - 120px))";
