import { TFunction } from "i18next";
import { isCountryCode } from "./countries";

interface ValidateDataParams {
  data: Record<string, string>[];
  mandatoryHeaders: string[];
  headers: string[];
  t: TFunction<"translation", undefined>;
}

/**
 * Validates the provided data against mandatory headers and optional headers.
 *
 * @param {Object} params - The parameters for the validation function.
 * @param {Array<Object>} params.data - The data to be validated, where each object represents a row.
 * @param {Array<string>} params.mandatoryHeaders - The list of mandatory headers that must be present in each row.
 * @param {Array<string>} params.headers - The list of all headers, including optional ones.
 *
 * @throws {Error} Throws an error with the message "mandatory-data-missing" if any mandatory header is missing in a row.
 * @throws {Error} Throws an error with the message "invalid-coordinates" if the coordinates in the "Coordenadas finca" field are invalid.
 */
export const validateData = ({
  data,
  mandatoryHeaders,
  headers,
  t,
}: ValidateDataParams) => {
  data.forEach((row, idx) => {
    const rowIdx = idx + 3;
    // Check if all mandatory headers are present in each row
    mandatoryHeaders.forEach((header) => {
      if (!row[header]) {
        const errorMsg = t("common:parseFileError:mandatoryDataMissing", {
          header,
          row: rowIdx,
        });
        throw new Error(errorMsg);
      }
    });

    // Fill optional headers with empty string
    headers.forEach((header) => {
      if (!row[header]) {
        row[header] = "";
      }
    });

    //Check if coordinates are valid
    const coordinatesRegex =
      /^\[\s*(\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)\s*,?\s*)*\]$/;
    if (!coordinatesRegex.test(row["Coordenadas finca"]?.trim())) {
      const errorMsg = t("common:parseFileError:invalidCoordinates", {
        row: rowIdx,
      });
      throw new Error(errorMsg);
    }

    // Check the country is ISO 3166-1 alpha-2
    const country = row["País"];
    if (!isCountryCode(country)) {
      const errorMsg = t("common:parseFileError:invalidCountryCode", {
        row: rowIdx,
      });
      throw new Error(errorMsg);
    }
  });
};
