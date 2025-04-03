import { uniq } from "lodash";

/**
 * Removes diacritical marks (accents) from a string.
 * For example: "café" becomes "cafe", "piñata" becomes "pinata"
 *
 * This is useful for string comparisons and sorting where accented characters
 * should be treated the same as their non-accented counterparts.
 *
 * @param str - The string to remove diacritics from
 * @returns The string with diacritical marks removed
 */
export const removeDiacritics = (str: string): string => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

/**
 * Creates a comma-separated string from an array of unique texts.
 * The function removes undefined values, eliminates duplicates, and sorts the texts alphabetically.
 *
 * For example: ["apple", undefined, "banana", "apple"] becomes "apple, banana"
 *
 * This is useful for creating readable, normalized string representations of text arrays
 * where order and uniqueness matter.
 *
 * @param texts - The array of strings (and possibly undefined values) to process
 * @returns A comma-separated string of unique, sorted values
 */
export const getCommaSeparatedUniqueTexts = (texts: (string | undefined)[]) => {
  return uniq(texts).filter(Boolean).sort().join(", ");
};
