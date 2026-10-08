import {
  getDeforestationThreshold,
  getOverlapThreshold,
} from "@/config/runtime";
import {
  isDeforestationAboveThreshold,
  isOverlapAboveThreshold,
} from "./deforestation";

const languageLocale = {
  es: "es-CL",
  en: "en-US",
} as Record<string, string>;

const DEFAULT_DECIMAL_PLACES = 1;
const DEFAULT_DISPLAY_THRESHOLD = Math.pow(10, -DEFAULT_DECIMAL_PLACES);

const MAX_THRESHOLD_DECIMAL_PLACES = 6;

/**
 * The decimal places a threshold is written with (0.25 → 2, 1 → 0). Uses toFixed
 * instead of String() so float noise (0.1 + 0.2) and exponent notation don't count.
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
 * The label of a value at or below a threshold, e.g. "< 0,5%" in Spanish.
 * @param {number} threshold - A threshold, in percent (0-100)
 */
const formattedBelowThreshold = (threshold: number, language: string): string =>
  `< ${formatPercentage(
    threshold / 100,
    getThresholdDecimalPlaces(threshold),
    language
  )}`;

// Computed per call: the thresholds come from GET /config at startup.
const deforestationDecimalPlaces = () =>
  getDecimalPlacesForThreshold(getDeforestationThreshold());

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

  // No threshold defined by user, so we use the default threshold for displaying deforestation
  if (getOverlapThreshold() === 0) {
    if (100 * value < DEFAULT_DISPLAY_THRESHOLD)
      return formattedDefaultDisplayThreshold(language);
    return formatPercentage(value, DEFAULT_DECIMAL_PLACES, language);
  }

  // Threshold defined by user, so we use it for displaying deforestation
  if (!isOverlapAboveThreshold(value))
    return formattedBelowThreshold(getOverlapThreshold(), language);

  return formatPercentage(value, overlapDecimalPlaces(), language);
};

/**
 * Formats a deforestation value as a percentage string.
 *
 * If a deforestation threshold is defined (getDeforestationThreshold() > 0),
 * values below the threshold are displayed as "< X%" where X is the threshold.
 * Otherwise, values below DEFAULT_DISPLAY_THRESHOLD are displayed as "< X%".
 *
 * Values of 0 are displayed as "0%".
 * All other values are formatted as percentages with deforestationDecimalPlaces decimal places.
 *
 * @param value - The deforestation value to format (between 0 and 1)
 * @returns The formatted percentage string
 */
export const formatDeforestationPercentage = (
  value: number,
  language = "es"
): string => {
  if (value === 0) return "0%";

  // No threshold defined by user, so we use the default threshold for displaying deforestation
  if (getDeforestationThreshold() === 0) {
    if (100 * value < DEFAULT_DISPLAY_THRESHOLD)
      return formattedDefaultDisplayThreshold(language);
    return formatPercentage(value, DEFAULT_DECIMAL_PLACES, language);
  }

  // Threshold defined by user, so we use it for displaying deforestation
  if (!isDeforestationAboveThreshold(value))
    return formattedBelowThreshold(getDeforestationThreshold(), language);

  return formatPercentage(value, deforestationDecimalPlaces(), language);
};
