// Where the report's text may break.
//
// react-pdf's own hyphenation uses English rules and splits Spanish words
// ("iden-tifica", "prote-gida"), so words stay whole. Only a word longer than any
// Spanish or English one (an id, a URL in a text field) is split as a last resort,
// so it doesn't run past the page: react-pdf prints a "-" at each such break.
//
// A reference URL must print exactly as it is (it is audit evidence and gets copied
// from paper), so it is never left to that: the report prints it in lines that are
// all short enough to stay whole (`referenceLines`), and react-pdf adds nothing.

/** Words up to this length are never split. */
export const LONGEST_WHOLE_WORD = 30;
/** The longest part of a split word (last resort, see above). */
const LONGEST_PART = 24;

/**
 * `word` in parts of up to `maxLength` characters, each ending after a URL separator
 * when it can (never after a "-" or "_", which a break could double), so the parts
 * read naturally. The parts, joined, give `word`.
 */
const splitAtSeparators = (word: string, maxLength: number): string[] => {
  const chunks = new RegExp(`.{1,${maxLength}}`, "g");
  const pieces = (word.match(/[^/?#&;=.]*[/?#&;=.]?/g) ?? [])
    .filter(Boolean)
    .flatMap((token) => token.match(chunks) ?? []);
  const parts: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && current.length + piece.length > maxLength) {
      parts.push(current);
      current = "";
    }
    current += piece;
  }
  if (current) parts.push(current);
  return parts;
};

/** A word's break points for react-pdf (see above): `[word]` keeps it whole. */
export const reportWordParts = (word: string): string[] =>
  word.length <= LONGEST_WHOLE_WORD
    ? [word]
    : splitAtSeparators(word, LONGEST_PART);

/**
 * A reference URL as the lines to print, one under the other: each fits a table
 * cell and is short enough that react-pdf never breaks it, so no "-" is added and
 * the lines, read in order, are exactly the URL.
 */
export const referenceLines = (url: string): string[] =>
  url.length <= LONGEST_WHOLE_WORD
    ? [url]
    : splitAtSeparators(url, LONGEST_WHOLE_WORD);
