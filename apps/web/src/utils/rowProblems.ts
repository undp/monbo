import { uniq } from "lodash";
import type { GeoAttributeKey } from "@/utils/excel";

/** What is wrong with one row of a file, kept by row so that deleting the row
 * drops its problems. */
export interface RowProblems {
  /** The other-country message, when the row declares a country other than the
   * selected one */
  otherCountry: string | null;
  /** The rest of the row's problems, in the order they were found */
  errors: string[];
  /** The mandatory attributes a geo file's feature lacks; always empty for an
   * Excel row */
  missing: GeoAttributeKey[];
}

export const NO_ROW_PROBLEMS: RowProblems = {
  otherCountry: null,
  errors: [],
  missing: [],
};

/** The rows' problems as one list of messages: each other-country message once,
 * first, then the rest in row order. */
export const problemMessages = (problems: RowProblems[]): string[] => [
  ...uniq(
    problems.flatMap(({ otherCountry }) => (otherCountry ? [otherCountry] : []))
  ),
  ...problems.flatMap(({ errors }) => errors),
];
