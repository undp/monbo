import type { TFunction } from "i18next";
import { FarmRow } from "@/interfaces/FarmRow";
import type { ImportedFeature, ImportedFile } from "@/interfaces/Farm";
import {
  AS_TEXT,
  featureIssues,
  featureLabel,
  geoFeatureCountry,
  geoFeatureId,
  normalizeFarmId,
  otherCountryError,
  usesNameAsId,
} from "@/utils/geoFile";

// A geo file places the farms and the Excel template gives their production data:
// each Excel row is joined to the feature with the same farm ID. The geo file needs
// nothing else than that ID.

// The template has 3 header rows: its first farm is in row 4 (as in validateData).
const FIRST_DATA_ROW = 4;

/** The countries the features declare, under any accepted name, as option 2 reads
 * them. */
const declaredCountries = (features: ImportedFeature[]) =>
  features
    .map((feature) => geoFeatureCountry(feature.properties))
    .filter((code): code is string => !!code);

/** IDs that appear more than once, each with the indexes where it appears. */
const duplicates = (ids: (string | null)[]) => {
  const indexes = new Map<string, number[]>();
  ids.forEach((id, index) => {
    if (id) indexes.set(id, [...(indexes.get(id) ?? []), index]);
  });
  return [...indexes].filter(([, at]) => at.length > 1);
};

interface JoinParams {
  /** The Excel rows, without coordinates: the geo file places the farms. */
  rows: FarmRow[];
  geoFile: ImportedFile;
  t: TFunction;
  language: string;
  selectedCountry: string | null;
}

interface JoinResult {
  rows: FarmRow[];
  errorMessages: string[];
  /** IDs found in only one of the two files */
  unmatchedIds: number;
}

/**
 * Joins each Excel row to the geo file's feature with the same farm ID. The joined
 * row is the Excel row with the feature's geometry as WKT, ready for
 * `/farms/parse`. Any problem (a feature without ID, an ID repeated in either file,
 * an ID in only one of them, a feature the API couldn't use) is an error, and no
 * row is returned.
 */
export const joinRowsWithGeoFeatures = ({
  rows,
  geoFile,
  t,
  language,
  selectedCountry,
}: JoinParams): JoinResult => {
  const { features } = geoFile;
  const nameIsId = usesNameAsId(geoFile);
  const errorMessages = featureIssues(t, geoFile);

  const countryError = otherCountryError(
    declaredCountries(features),
    t,
    language,
    selectedCountry
  );
  if (countryError) errorMessages.push(countryError);

  const featureIds = features.map((feature) =>
    geoFeatureId(feature.properties, nameIsId)
  );
  features.forEach((feature, index) => {
    if (!featureIds[index])
      errorMessages.push(
        t("common:geoFileJoinErrors:featureWithoutId", {
          feature: featureLabel(t, feature, null),
        })
      );
  });
  duplicates(featureIds).forEach(([id]) =>
    errorMessages.push(
      t("common:geoFileJoinErrors:duplicateGeoId", { id, ...AS_TEXT })
    )
  );

  const rowIds = rows.map((row) => normalizeFarmId(row.id));
  rowIds.forEach((id, index) => {
    if (!id)
      errorMessages.push(
        t("common:parseFileError:mandatoryDataMissing", {
          header: "ID",
          row: index + FIRST_DATA_ROW,
        })
      );
  });
  duplicates(rowIds).forEach(([id, at]) =>
    errorMessages.push(
      t("common:geoFileJoinErrors:duplicateExcelId", {
        id,
        rows: at.map((index) => index + FIRST_DATA_ROW).join(", "),
        ...AS_TEXT,
      })
    )
  );

  const featuresById = new Map<string, ImportedFeature>();
  features.forEach((feature, index) => {
    const id = featureIds[index];
    if (id && !featuresById.has(id)) featuresById.set(id, feature);
  });
  const rowIdSet = new Set(rowIds);
  let unmatchedIds = 0;
  rowIds.forEach((id, index) => {
    if (!id || featuresById.has(id)) return;
    unmatchedIds++;
    errorMessages.push(
      t("common:geoFileJoinErrors:rowWithoutFeature", {
        id,
        row: index + FIRST_DATA_ROW,
        ...AS_TEXT,
      })
    );
  });
  features.forEach((feature, index) => {
    const id = featureIds[index];
    if (!id || rowIdSet.has(id)) return;
    unmatchedIds++;
    errorMessages.push(
      t("common:geoFileJoinErrors:featureWithoutRow", {
        feature: featureLabel(t, feature, id),
        ...AS_TEXT,
      })
    );
  });

  if (errorMessages.length > 0) return { rows: [], errorMessages, unmatchedIds };

  return {
    rows: rows.map((row, index) => {
      const id = rowIds[index]!;
      const feature = featuresById.get(id)!;
      return {
        ...row,
        id,
        coordinatesFormat: "WKT",
        geometryType: feature.geometryType,
        farmCoordinates: feature.farmCoordinates,
      };
    }),
    errorMessages: [],
    unmatchedIds: 0,
  };
};
