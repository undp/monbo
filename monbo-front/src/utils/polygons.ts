import { formatNumber } from "./numbers";

/**
 * Parses the given area and returns a formatted string representing the area in either hectares (ha) or square meters (m²).
 * If the area is greater than 5000 square meters, it converts the area to hectares and rounds it to two decimal places.
 * Otherwise, it returns the area in square meters.
 *
 * @param {number} area - The area to be parsed, in square meters.
 * @returns {string} - The formatted area string in either hectares or square meters.
 */
export const parsePolygonArea = (area: number): string => {
  const transformedArea =
    area > 5000
      ? Math.round((area / 10000 + Number.EPSILON) * 100) / 100
      : area;
  return area > 5000
    ? `${formatNumber(transformedArea)} ha`
    : `${formatNumber(transformedArea, 0)} m²`;
};

/**
 * Parses an area in square meters and converts it to hectares with the specified number of decimal places.
 *
 * @param {number} area - The area in square meters to be converted.
 * @param {number} decimals - The number of decimal places for the result. Defaults to 2.
 * @returns {string} - The formatted area string in hectares.
 */
export const parseAreaToHectares = (
  area: number,
  decimals: number = 2,
  withUnit: boolean = true
): string => {
  const hectares = area / 10000;
  return `${formatNumber(hectares, decimals)}${withUnit ? " ha" : ""}`;
};

/**
 * Parses a latitude value into a formatted string with degrees and hemisphere.
 *
 * @param latitude - The latitude value to be parsed.
 * @returns A string representing the latitude in degrees with the hemisphere (N or S).
 */
export const parseLatitude = (latitude: number): string => {
  return `${Math.abs(latitude).toFixed(6)}° (${latitude > 0 ? "N" : "S"})`;
};

/**
 * Parses a longitude value and returns a formatted string with the absolute value
 * to six decimal places followed by the degree symbol and the direction (E for East, O for West).
 *
 * @param longitude - The longitude value to be parsed.
 * @returns A formatted string representing the longitude with direction.
 */
export const parseLongitude = (longitude: number): string => {
  return `${Math.abs(longitude).toFixed(6)}° (${longitude > 0 ? "E" : "O"})`;
};
