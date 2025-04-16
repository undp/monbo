import { TFunction } from "i18next";
import { isCountryCode } from "./countries";

const headerTranslationMappings: Record<string, Record<string, string>> = {
  es: {
    id: "ID",
    producerName: "Nombre productor",
    productionDate: "Fecha producción",
    productionQuantity: "Cantidad producción",
    productionQuantityUnit: "Unidad cantidad producción",
    country: "País",
    region: "Región",
    farmCoordinates: "Coordenadas finca",
    area: "Superficie [hectáreas]",
    cropType: "Tipo de cultivo",
    association: "Asociación",
    documentName1: "Nombre documento 1",
    documentUrl1: "Enlace documento 1",
    documentName2: "Nombre documento 2",
    documentUrl2: "Enlace documento 2",
    documentName3: "Nombre documento 3",
    documentUrl3: "Enlace documento 3",
  },
  en: {
    id: "ID",
    producerName: "Producer name",
    productionDate: "Production date",
    productionQuantity: "Production Quantity",
    productionQuantityUnit: "Production measurement unit",
    country: "Country",
    region: "Region",
    farmCoordinates: "Land coordinates",
    area: "Area [hectares]",
    cropType: "Crop type",
    association: "Cooperative",
    documentName1: "Document name 1",
    documentUrl1: "Document link 1",
    documentName2: "Document name 2",
    documentUrl2: "Document link 2",
    documentName3: "Document name 3",
    documentUrl3: "Document link 3",
  },
};

interface ValidateDataParams {
  data: Record<string, string | number | null>[];
  mandatoryHeaders: string[];
  t: TFunction<"translation", undefined>;
  language: string;
}

/**
 * Validates the provided data against mandatory headers and optional headers.
 *
 * @param {Object} params - The parameters for the validation function.
 * @param {Array<Object>} params.data - The data to be validated, where each object represents a row.
 * @param {Array<string>} params.mandatoryHeaders - The list of mandatory headers that must be present in each row.
 * @param {string} params.language - The locale to be used for the validation.
 *
 * @throws {Error} Throws an error with the message "mandatory-data-missing" if any mandatory header is missing in a row.
 * @throws {Error} Throws an error with the message "invalid-coordinates" if the coordinates in the "Coordenadas finca" field are invalid.
 */
export const validateData = ({
  data,
  mandatoryHeaders,
  t,
  language,
}: ValidateDataParams): string[] => {
  const errorMessages: string[] = [];

  data.forEach((row, idx) => {
    const rowIdx = idx + 3; // The template has 3 rows of headers, so we need to add 3 to the index for proper row numbering
    // Check if all mandatory headers are present in each row
    mandatoryHeaders.forEach((header) => {
      if (!row[header]) {
        const errorMsg = t("common:parseFileError:mandatoryDataMissing", {
          header: headerTranslationMappings[language][header],
          row: rowIdx,
        });
        errorMessages.push(errorMsg);
      }
    });

    //Check if coordinates are valid
    const coordinatesRegex =
      /^\[\s*(\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)\s*,?\s*)*\]$/;
    if (
      "farmCoordinates" in row &&
      typeof row["farmCoordinates"] === "string" &&
      !coordinatesRegex.test(row["farmCoordinates"])
    ) {
      const errorMsg = t("common:parseFileError:invalidCoordinates", {
        row: rowIdx,
      });
      errorMessages.push(errorMsg);
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

  return errorMessages;
};
