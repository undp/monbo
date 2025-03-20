const numberLocale = "es-CL";

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
