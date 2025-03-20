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
