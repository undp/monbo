/**
 * Options for a `t()` whose message is shown as text, not HTML: interpolated names,
 * ids and API messages must not be escaped (a "'" would show as "&#39;"). React and
 * MUI escape the text when they render it, so nothing becomes markup.
 */
export const AS_TEXT = { interpolation: { escapeValue: false } };
