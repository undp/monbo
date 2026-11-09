import { FARMS_IMPORT_URL, FARMS_PARSER_URL } from "@/config/env";
import { FarmData, ImportedFile, ImportIssue } from "@/interfaces/Farm";

// The spreadsheet's rows as read: the API validates them against InputFarmData and
// reports each problem, so they aren't typed as InputFarmData here.
export const generateFarmsData = async (
  data: Record<string, unknown>[],
  locale?: string
): Promise<FarmData[]> => {
  const url = `${FARMS_PARSER_URL}${locale ? `?locale=${locale}` : ""}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Error on parse farms");
  }

  return response.json();
};

/** The API rejected a geo file as a whole; `issue` says why, by code. */
export class GeoImportRequestError extends Error {
  constructor(readonly issue: ImportIssue) {
    super(issue.message);
  }
}

const isImportIssue = (value: unknown): value is ImportIssue =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as ImportIssue).code === "string" &&
  typeof (value as ImportIssue).message === "string";

// Reads a GeoJSON, KML, KMZ or zipped Shapefile: one feature per farm, with its
// attributes and its geometry as WKT.
export const importGeoFile = async (file: File): Promise<ImportedFile> => {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(FARMS_IMPORT_URL, { method: "POST", body });
  if (!response.ok) {
    const detail = await response
      .json()
      .then((json) => json?.detail)
      .catch(() => null);
    if (isImportIssue(detail)) throw new GeoImportRequestError(detail);
    throw new Error("Error on import geo file");
  }

  return response.json();
};
