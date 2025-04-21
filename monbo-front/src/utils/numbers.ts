import {
  OVERLAP_THRESHOLD_PERCENTAGE,
  DEFORESTATION_THRESHOLD_PERCENTAGE,
} from "@/config/env";
import {
  isDeforestationAboveThreshold,
  isOverlapAboveThreshold,
} from "./deforestation";

const numberLocale = "es-CL";

const DEFAULT_DECIMAL_PLACES = 1;
const DEFAULT_DISPLAY_THRESHOLD = Math.pow(10, -DEFAULT_DECIMAL_PLACES);

/**
 * Determines appropriate decimal places based on threshold value
 * @param {number} threshold - A threshold value, between 0 and 1
 * @returns {number} Number of decimal places to display
 */
const getDecimalPlacesForThreshold = (threshold: number): number => {
  // If threshold is 0, use a reasonable default
  if (threshold === 0) return DEFAULT_DECIMAL_PLACES;

  // Calculate decimal places needed to show the threshold value meaningfully
  // Add 1 more place than needed to show the threshold itself
  const thresholdPlaces = Math.ceil(Math.abs(Math.log10(threshold)));

  // Ensure we have at least 1 decimal places for readability
  return Math.max(1, thresholdPlaces);
};

const deforestationDecimalPlaces = getDecimalPlacesForThreshold(
  DEFORESTATION_THRESHOLD_PERCENTAGE
);

const overlapDecimalPlaces = getDecimalPlacesForThreshold(
  OVERLAP_THRESHOLD_PERCENTAGE
);

/**
 * Formats a number to a string with a specified number of decimal places.
 *
 * @param value - The number to format.
 * @param decimals - The number of decimal places to include in the formatted string. Defaults to 2.
 * @returns The formatted number as a string.
 */
export const formatNumber = (value: number, decimals = 2): string => {
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
export const formatPercentage = (value: number, decimals = 0): string => {
  const formatter = new Intl.NumberFormat(numberLocale, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });

  return formatter.format(value);
};

/**
 * Formats an overlap value as a percentage string.
 *
 * If an overlap threshold is defined (OVERLAP_THRESHOLD_PERCENTAGE > 0),
 * values below the threshold are displayed as "< X%" where X is the threshold.
 * Otherwise, values below DEFAULT_DISPLAY_THRESHOLD are displayed as "< X%".
 *
 * Values of 0 are displayed as "0%".
 * All other values are formatted as percentages with overlapDecimalPlaces decimal places.
 *
 * @param value - The overlap value to format (between 0 and 1)
 * @returns The formatted percentage string
 */
export const formatOverlapPercentage = (value: number): string => {
  if (value === 0) return "0%";

  // No threshold defined by user, so we use the default threshold for displaying deforestation
  if (OVERLAP_THRESHOLD_PERCENTAGE === 0) {
    if (100 * value < DEFAULT_DISPLAY_THRESHOLD)
      return `< ${DEFAULT_DISPLAY_THRESHOLD}%`;
    return formatPercentage(value, overlapDecimalPlaces);
  }

  // Threshold defined by user, so we use it for displaying deforestation
  if (!isOverlapAboveThreshold(value))
    return `< ${OVERLAP_THRESHOLD_PERCENTAGE}%`;

  return formatPercentage(value, overlapDecimalPlaces);
};

/**
 * Formats a deforestation value as a percentage string.
 *
 * If a deforestation threshold is defined (DEFORESTATION_THRESHOLD_PERCENTAGE > 0),
 * values below the threshold are displayed as "< X%" where X is the threshold.
 * Otherwise, values below DEFAULT_DISPLAY_THRESHOLD are displayed as "< X%".
 *
 * Values of 0 are displayed as "0%".
 * All other values are formatted as percentages with deforestationDecimalPlaces decimal places.
 *
 * @param value - The deforestation value to format (between 0 and 1)
 * @returns The formatted percentage string
 */
export const formatDeforestationPercentage = (value: number): string => {
  if (value === 0) return "0%";

  // No threshold defined by user, so we use the default threshold for displaying deforestation
  if (DEFORESTATION_THRESHOLD_PERCENTAGE === 0) {
    if (100 * value < DEFAULT_DISPLAY_THRESHOLD)
      return `< ${DEFAULT_DISPLAY_THRESHOLD}%`;
    return formatPercentage(value, deforestationDecimalPlaces);
  }

  // Threshold defined by user, so we use it for displaying deforestation
  if (!isDeforestationAboveThreshold(value))
    return `< ${DEFORESTATION_THRESHOLD_PERCENTAGE}%`;

  return formatPercentage(value, deforestationDecimalPlaces);
};
