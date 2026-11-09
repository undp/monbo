import { TFunction } from "i18next";
import { uniq } from "lodash";
import { Accept } from "react-dropzone";
import { FarmRow } from "@/interfaces/FarmRow";
import { ImportedFeature, ImportedFile, ImportIssue } from "@/interfaces/Farm";
import { getCountryName } from "@/utils/countries";
import {
  GeoAttributeKey,
  geoAttributeAcceptedNames,
  geoAttributeMappings,
} from "@/utils/excel";

// A geo file (GeoJSON, KML, KMZ or zipped Shapefile) is read by /farms/import: each
// feature is a farm. Its data comes from its attributes (geoFeaturesToFarmRows), or
// from an Excel joined by ID (geoFileJoin.ts).

export const GEO_FILE_EXTENSIONS = [".geojson", ".json", ".kml", ".kmz", ".zip"];

export const EXCEL_ACCEPT: Accept = {
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
};

/** What the upload's drop zone takes: the Excel template or a geo file. */
export const UPLOAD_FILE_ACCEPT: Accept = {
  ...EXCEL_ACCEPT,
  "application/geo+json": [".geojson"],
  "application/json": [".json"],
  "application/vnd.google-earth.kml+xml": [".kml"],
  "application/vnd.google-earth.kmz": [".kmz"],
  "application/zip": [".zip"],
};

const extensionOf = (file: File) => {
  const dot = file.name.lastIndexOf(".");
  return dot === -1 ? "" : file.name.slice(dot).toLowerCase();
};

export const isGeoFile = (file: File) =>
  GEO_FILE_EXTENSIONS.includes(extensionOf(file));

/** In a KML or KMZ, a placemark's name is its farm's ID when it has no ID attribute
 * (as in a Google Earth file). */
export const usesNameAsId = (geoFile: ImportedFile) =>
  geoFile.format === "kml" || geoFile.format === "kmz";

type Properties = ImportedFeature["properties"];
type PropertyValue = Properties[string];

/** An ID as farms are compared: trimmed text, so the number 1 matches "1". */
export const normalizeFarmId = (value: unknown): string | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const id = String(value).trim();
  return id === "" ? null : id;
};

/** A feature's farm ID: its `id` attribute in any case (`id`, `ID`, `Id`...), else,
 * in a KML or KMZ, its placemark's name. */
export const geoFeatureId = (
  properties: Properties,
  nameIsId: boolean
): string | null => {
  const idKeys = Object.keys(properties)
    .filter((key) => key.toLowerCase() === "id")
    // The exact `id` first, should a file have more than one spelling.
    .sort((a, b) => Number(b === "id") - Number(a === "id"));
  for (const key of [...idKeys, ...(nameIsId ? ["Name"] : [])]) {
    const id = normalizeFarmId(properties[key]);
    if (id) return id;
  }
  return null;
};

// The messages are shown as text, not HTML: names and ids from the file must not be
// escaped (a "/" would show as "&#x2F;").
export const AS_TEXT = { interpolation: { escapeValue: false } };

/** How a feature is named in messages: its position, and its ID when it has one. */
export const featureLabel = (
  t: TFunction,
  feature: ImportedFeature,
  id: string | null
): string =>
  id !== null
    ? t("common:geoFile:featureLabelWithId", {
        position: feature.position,
        id,
        ...AS_TEXT,
      })
    : t("common:geoFile:featureLabel", { position: feature.position });

/** An issue from /farms/import in the user's language; the API's English text is
 * the fallback for codes this UI doesn't know yet. */
export const geoIssueText = (
  t: TFunction,
  issue: ImportIssue,
  feature?: string
): string =>
  t(`common:geoFile:issues:${issue.code}`, {
    ...issue.params,
    feature,
    ...AS_TEXT,
    defaultValue: feature ? `${feature}: ${issue.message}` : issue.message,
  });

/** The problems /farms/import found in the features, each naming its feature. */
export const featureIssues = (t: TFunction, geoFile: ImportedFile): string[] =>
  geoFile.features.flatMap((feature) => {
    const label = featureLabel(
      t,
      feature,
      geoFeatureId(feature.properties, usesNameAsId(geoFile))
    );
    return feature.errors.map((issue) => geoIssueText(t, issue, label));
  });

/** The farms' countries in an EUDR GeoJSON's `ProducerCountry`, other than the
 * analysis country: the report would state the wrong country, as with the old
 * template's country column. */
export const otherCountryError = (
  countries: string[],
  t: TFunction,
  language: string,
  selectedCountry: string | null
): string | null => {
  const others = uniq(
    countries.map((code) => code.toUpperCase()).filter((code) => code !== selectedCountry)
  );
  if (others.length === 0) return null;
  const name = (code: string) =>
    getCountryName(code, language === "en" ? "en" : "es") ?? code;
  return t("common:parseFileError:otherCountry", {
    countries: others.map(name).join(", "),
    country: selectedCountry ? name(selectedCountry) : "",
  });
};

/** A value as the farm row takes it: trimmed, with empty strings as missing. */
const cleanValue = (value: PropertyValue): string | number | boolean | null => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

// Geo files hold machine-written numbers ("1200.5"), not the user's locale format:
// /farms/parse would read "1200.5" as 12005 in Spanish, so plain decimals are sent
// as numbers. Anything else is left for /farms/parse to read in the user's locale.
const MACHINE_NUMBER = /^-?\d+(\.\d+)?$/;
const toNumberIfMachineFormatted = (value: unknown) =>
  typeof value === "string" && MACHINE_NUMBER.test(value) ? Number(value) : value;

type CleanProperties = Map<string, ReturnType<typeof cleanValue>>;

/** The feature's attributes by lowercased, trimmed name. */
const cleanProperties = (properties: Properties): CleanProperties =>
  new Map(
    Object.entries(properties).map(([name, value]) => [
      name.trim().toLowerCase(),
      cleanValue(value),
    ])
  );

/** The value of the first accepted name the feature has a value for. */
const readAttribute = (properties: CleanProperties, names: string[]) => {
  for (const name of names) {
    const value = properties.get(name);
    if (value !== null && value !== undefined) return value;
  }
  return null;
};

/** The country a feature declares, under any of the accepted names (the EUDR
 * GeoJSON's `ProducerCountry`, a Shapefile's `PAIS`, the template's headers).
 * Only checked against the selected country, never used as the farm's country. */
export const geoFeatureCountry = (properties: Properties): string | null => {
  const country = readAttribute(
    cleanProperties(properties),
    geoAttributeAcceptedNames("country")
  );
  return typeof country === "string" ? country : null;
};

// The ID is read by geoFeatureId (with the KML name), the country only checked
const DATA_KEYS = (Object.keys(geoAttributeMappings) as GeoAttributeKey[]).filter(
  (key) => key !== "id" && key !== "country"
);

/** Which mandatory attributes the features miss, and how many features miss any. */
export interface MissingAttributes {
  attributes: GeoAttributeKey[];
  features: number;
}

interface FarmRowsResult {
  rows: FarmRow[];
  errorMessages: string[];
  missing: MissingAttributes;
}

/**
 * Turns a geo file's features into the rows /farms/parse takes, as
 * loadExcelFileFarmsData does with the template's rows: each farm's data comes from
 * its feature's attributes (geoAttributeMappings), its geometry from the file.
 */
export const geoFeaturesToFarmRows = (
  geoFile: ImportedFile,
  t: TFunction,
  language: string,
  // The analysis country: every farm gets it, so a file can't list another one.
  selectedCountry: string | null
): FarmRowsResult => {
  const errorMessages = featureIssues(t, geoFile);
  const countries: string[] = [];
  const nameIsId = usesNameAsId(geoFile);
  const missingAttributes = new Set<GeoAttributeKey>();
  let featuresMissingData = 0;

  const rows = geoFile.features.map((feature) => {
    const properties = cleanProperties(feature.properties);
    const id = geoFeatureId(feature.properties, nameIsId);
    const row: Record<string, unknown> = { id, documents: [] };
    DATA_KEYS.forEach((key) => {
      row[key] = readAttribute(properties, geoAttributeAcceptedNames(key));
    });
    row.productionQuantity = toNumberIfMachineFormatted(row.productionQuantity);
    row.area = toNumberIfMachineFormatted(row.area);
    // Monbo's GeoJSON download writes "Area": "0" for every farm
    if (row.area === 0 || row.area === "0") row.area = null;

    const country = geoFeatureCountry(feature.properties);
    if (country) countries.push(country);

    const label = featureLabel(t, feature, id);
    const missingHere = DATA_KEYS.filter(
      (key) => geoAttributeMappings[key].mandatory && row[key] === null
    );
    if (missingHere.length > 0) featuresMissingData++;
    missingHere.forEach((key) => {
      missingAttributes.add(key);
      errorMessages.push(
        t("common:geoFile:mandatoryAttributeMissing", {
          attribute: `${geoAttributeMappings[key].geoFile} / ${geoAttributeMappings[key].shapefile}`,
          feature: label,
          ...AS_TEXT,
        })
      );
    });

    return {
      ...row,
      coordinatesFormat: "WKT",
      geometryType: feature.geometryType,
      farmCoordinates: feature.farmCoordinates,
    } as FarmRow;
  });

  const missing = {
    attributes: DATA_KEYS.filter((key) => missingAttributes.has(key)),
    features: featuresMissingData,
  };
  const countryError = otherCountryError(countries, t, language, selectedCountry);
  if (countryError) return { rows, errorMessages: [countryError], missing };

  return { rows, errorMessages, missing };
};
