import { getOverlapThreshold } from "@/config/runtime";
import { isOverlapAboveThreshold } from "./overlap";
import {
  classifyResult,
  deforestationRule,
  findingRatio,
  type ClassificationRule,
} from "./layerResults";

const languageLocale = {
  es: "es-CL",
  en: "en-US",
} as Record<string, string>;

const DEFAULT_DECIMAL_PLACES = 1;
const DEFAULT_DISPLAY_THRESHOLD = Math.pow(10, -DEFAULT_DECIMAL_PLACES);

// Intl.NumberFormat accepts up to 20 fraction digits in every engine (older ones
// throw above that), and the API accepts any percentage, so this is the display
// limit, not a validation: a threshold below 1e-20% would still read "< 0%".
const MAX_THRESHOLD_DECIMAL_PLACES = 20;

/**
 * The decimal places a threshold is written with (0.25 → 2, 1 → 0, 0.0000001 → 7).
 * Uses toFixed instead of String() so exponent notation (1e-7) counts its decimals.
 * @param {number} threshold - A threshold, in percent (0-100)
 */
const getThresholdDecimalPlaces = (threshold: number): number => {
  for (let places = 0; places < MAX_THRESHOLD_DECIMAL_PLACES; places++) {
    if (Number(threshold.toFixed(places)) === threshold) return places;
  }
  return MAX_THRESHOLD_DECIMAL_PLACES;
};

/**
 * Decimal places for a value above the threshold: as many as the threshold has,
 * and at least DEFAULT_DECIMAL_PLACES (a 1% threshold still shows "1,4%").
 * @param {number} threshold - A threshold, in percent (0-100)
 * @returns {number} Number of decimal places to display
 */
const getDecimalPlacesForThreshold = (threshold: number): number =>
  Math.max(DEFAULT_DECIMAL_PLACES, getThresholdDecimalPlaces(threshold));

/**
 * A threshold as a percentage with its own decimals, e.g. "0,5%" in Spanish.
 * @param {number} threshold - A threshold, in percent (0-100)
 */
export const formatThreshold = (threshold: number, language: string): string =>
  formatPercentage(
    threshold / 100,
    getThresholdDecimalPlaces(threshold),
    language
  );

/**
 * The label of a value at or below a threshold, e.g. "< 0,5%" in Spanish.
 * @param {number} threshold - A threshold, in percent (0-100)
 */
const formattedBelowThreshold = (threshold: number, language: string): string =>
  `< ${formatThreshold(threshold, language)}`;

// Computed per call: the thresholds come from GET /config at startup.
const overlapDecimalPlaces = () =>
  getDecimalPlacesForThreshold(getOverlapThreshold());

/**
 * Formats a number to a string with a specified number of decimal places.
 *
 * @param value - The number to format.
 * @param decimals - The number of decimal places to include in the formatted string. Defaults to 2.
 * @returns The formatted number as a string.
 */
export const formatNumber = (
  value: number,
  decimals = 2,
  language = "es"
): string => {
  const numberLocale = languageLocale[language];
  const formatter = new Intl.NumberFormat(numberLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });

  return formatter.format(value);
};

/**
 * Formats a number as a percentage string.
 *
 * @param value - The number to format as a percentage.
 * @param decimals - The number of decimal places to include in the formatted percentage. Defaults to 0.
 * @returns The formatted percentage string.
 */
export const formatPercentage = (
  value: number,
  decimals = 0,
  language = "es"
): string => {
  const numberLocale = languageLocale[language];
  const formatter = new Intl.NumberFormat(numberLocale, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });

  return formatter.format(value);
};

/**
 * Formats the default display threshold as a percentage string with a "less than" symbol.
 *
 * Takes the DEFAULT_DISPLAY_THRESHOLD constant, divides it by 100 to convert to decimal,
 * formats it as a percentage using the specified language locale and DEFAULT_DECIMAL_PLACES,
 * and prepends a "less than" symbol.
 *
 * @param language - The language code to use for number formatting (e.g. "es", "en")
 * @returns A string in the format "< X%" where X is the formatted threshold percentage
 */
const formattedDefaultDisplayThreshold = (language: string): string => {
  const formattedValue = formatPercentage(
    DEFAULT_DISPLAY_THRESHOLD / 100,
    DEFAULT_DECIMAL_PLACES,
    language
  );
  return `< ${formattedValue}`;
};

/**
 * Formats an overlap value as a percentage string.
 *
 * If an overlap threshold is defined (getOverlapThreshold() > 0),
 * values below the threshold are displayed as "< X%" where X is the threshold.
 * Otherwise, values below DEFAULT_DISPLAY_THRESHOLD are displayed as "< X%".
 *
 * Values of 0 are displayed as "0%".
 * All other values are formatted as percentages with overlapDecimalPlaces decimal places.
 *
 * @param value - The overlap value to format (between 0 and 1)
 * @returns The formatted percentage string
 */
export const formatOverlapPercentage = (
  value: number,
  language = "es"
): string => {
  if (value === 0) return "0%";

  // No threshold defined by user, so we use the default threshold for displaying the overlap
  if (getOverlapThreshold() === 0) {
    if (100 * value < DEFAULT_DISPLAY_THRESHOLD)
      return formattedDefaultDisplayThreshold(language);
    return formatPercentage(value, DEFAULT_DECIMAL_PLACES, language);
  }

  // Threshold defined by user, so we use it for displaying the overlap
  if (!isOverlapAboveThreshold(value))
    return formattedBelowThreshold(getOverlapThreshold(), language);

  return formatPercentage(value, overlapDecimalPlaces(), language);
};

/**
 * Formats a layer result as the percentage of the farm that is a finding: `value`
 * for an `avoid` rule, `1 − value` for a `required` one. Deforestation by default
 * (the PDF and the exports, until they read categories).
 *
 * If the rule has a threshold (> 0), findings at or below it are displayed as
 * "< X%" where X is the threshold. Otherwise, findings below
 * DEFAULT_DISPLAY_THRESHOLD are displayed as "< X%".
 *
 * A finding of 0 is displayed as "0%". All other findings are formatted with the
 * threshold's decimal places (at least DEFAULT_DECIMAL_PLACES).
 *
 * @param value - The layer result to format (between 0 and 1)
 * @returns The formatted percentage string
 */
export const formatResultPercentage = (
  value: number,
  language = "es",
  rule: ClassificationRule = deforestationRule()
): string => {
  const finding = findingRatio(value, rule.polarity);
  if (finding === 0) return "0%";

  // No threshold defined by user, so we use the default threshold for displaying the finding
  if (rule.thresholdPercentage === 0) {
    if (100 * finding < DEFAULT_DISPLAY_THRESHOLD)
      return formattedDefaultDisplayThreshold(language);
    return formatPercentage(finding, DEFAULT_DECIMAL_PLACES, language);
  }

  // Threshold defined by user, so we use it for displaying the finding
  if (classifyResult(value, rule) === "ok")
    return formattedBelowThreshold(rule.thresholdPercentage, language);

  return formatFindingPercentage(finding, rule.thresholdPercentage, language);
};

// The tolerance for "on the threshold": floating point puts 100 × 0.05 a hair above
// 5. The same idea as the classification's (layerResults.ts), so a finding the
// classification calls equal to the threshold is not shown as above or below it.
const THRESHOLD_ROUNDING_ULPS = 8;

/**
 * A finding as a percentage next to its rule's threshold, for the stage 2 cells and
 * the PDF. Meant for a `flagged` result; for a result of any class, use
 * formatResultPercentage with the rule, which also covers results at or
 * below the threshold.
 *
 * Contract (the text always agrees with the classification against the threshold):
 * - Decimals: as many as the threshold has, and at least DEFAULT_DECIMAL_PLACES:
 *   "18%", "2,4%", "2,44%" with a 2,25 threshold.
 * - 0 reads "0%".
 * - A finding above 0 that rounds to 0 (only possible with a threshold of 0, e.g.
 *   0.0004 → 0.04%) reads "< 0,1%", never "0%".
 * - A finding above the threshold that rounds to the threshold or below it reads
 *   "> 5%" (the threshold, with its own decimals), never "5%": with a threshold of
 *   5, 0.0504 reads "> 5%" and 0.0551 reads "5,5%".
 * - A finding below the threshold that rounds to the threshold or above it reads
 *   "< 5%" (e.g. 0.0496). A finding on the threshold reads "5%".
 *
 * Takes the finding, not `value`: for a `required` rule that is `1 − value`
 * (`findingRatio`).
 *
 * @param finding - The share of the farm that is a finding (0-1)
 * @param thresholdPercentage - The rule's threshold, in percent (0-100)
 * @param language - "es" (default) or "en"
 */
export const formatFindingPercentage = (
  finding: number,
  thresholdPercentage: number,
  language = "es"
): string => {
  const decimals = getDecimalPlacesForThreshold(thresholdPercentage);
  const resolution = Math.pow(10, -decimals);
  const percent = 100 * finding;
  if (finding > 0 && percent < resolution)
    return `< ${formatPercentage(resolution / 100, decimals, language)}`;

  // The value as displayed, rounded exactly as formatPercentage rounds it.
  const shown = Number(
    formatPercentage(finding, decimals, "en").replace(/[%,]/g, "")
  );
  const tolerance =
    THRESHOLD_ROUNDING_ULPS *
    Number.EPSILON *
    Math.max(Math.abs(percent), Math.abs(thresholdPercentage), 100);
  const above = percent - thresholdPercentage > tolerance;
  const below = thresholdPercentage - percent > tolerance;
  if (above && shown <= thresholdPercentage)
    return `> ${formatThreshold(thresholdPercentage, language)}`;
  if (below && shown >= thresholdPercentage)
    return `< ${formatThreshold(thresholdPercentage, language)}`;
  return formatPercentage(finding, decimals, language);
};
