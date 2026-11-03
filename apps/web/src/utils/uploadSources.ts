import type { TFunction } from "i18next";
import { GeoImportRequestError, importGeoFile } from "@/api/farms";
import { FarmRow } from "@/interfaces/FarmRow";
import { ImportedFile } from "@/interfaces/Farm";
import {
  COORDINATE_COLUMNS,
  GEO_FILE_EXCEL_MANDATORY_HEADERS,
  loadExcelFileFarmsData,
} from "@/utils/excel";
import {
  AS_TEXT,
  MissingAttributes,
  geoFeaturesToFarmRows,
  geoIssueText,
  isGeoFile,
  normalizeFarmId,
} from "@/utils/geoFile";
import { joinRowsWithGeoFeatures } from "@/utils/geoFileJoin";

// The upload step builds one list of farms from several sources: Excel files, geo
// files (each one with or without an Excel joined to it by ID) and farms added
// manually. Each source keeps its rows and the reasons it can't be uploaded; the
// step sends every source's rows together.

interface SourceBase {
  /** Unique within the list */
  key: string;
}

export interface ExcelSource extends SourceBase {
  kind: "excel";
  name: string;
  rows: FarmRow[];
  errorMessages: string[];
  /** No row has coordinates: it belongs with a geo file (option 3) */
  withoutCoordinates: boolean;
}

export interface GeoSource extends SourceBase {
  kind: "geo";
  name: string;
  /** The features as /farms/import read them; null when the file was rejected */
  geoFile: ImportedFile | null;
  /** Without an Excel, the farms read from the features' attributes */
  attributeRows: FarmRow[];
  attributeErrors: string[];
  attributeMissing: MissingAttributes;
  /** An Excel joined by ID: then the farms' data comes from it */
  excel: {
    name: string;
    rows: FarmRow[];
    errorMessages: string[];
    unmatchedIds: number;
  } | null;
}

export interface ManualSource extends SourceBase {
  kind: "manual";
  row: FarmRow;
}

export type UploadSource = ExcelSource | GeoSource | ManualSource;

interface ReadContext {
  t: TFunction<"translation", undefined>;
  language: string;
  selectedCountry: string | null;
}

let lastKey = 0;
export const newSourceKey = () => `source-${++lastKey}`;

/** The Excel template's farms, with their coordinates in a cell. An Excel without
 * any coordinates is meant to be joined to a geo file: say so instead of listing a
 * missing coordinate for every row. */
export const readExcelSource = async (
  file: File,
  { t, language, selectedCountry }: ReadContext
): Promise<ExcelSource> => {
  const { data, errorMessages } = await loadExcelFileFarmsData(
    file,
    t,
    language,
    selectedCountry
  );
  const hasNoCoordinates =
    data.length > 0 && data.every((row) => !row.farmCoordinates);
  return {
    kind: "excel",
    key: newSourceKey(),
    name: file.name,
    rows: data,
    errorMessages: hasNoCoordinates
      ? [t("common:farmsUpload:excelWithoutCoordinates")]
      : errorMessages,
    withoutCoordinates: hasNoCoordinates,
  };
};

/** A geo file's farms, from its features' attributes. */
export const readGeoSource = async (
  file: File,
  { t, language, selectedCountry }: ReadContext
): Promise<GeoSource> => {
  const source: GeoSource = {
    kind: "geo",
    key: newSourceKey(),
    name: file.name,
    geoFile: null,
    attributeRows: [],
    attributeErrors: [],
    attributeMissing: { attributes: [], features: 0 },
    excel: null,
  };
  try {
    source.geoFile = await importGeoFile(file);
  } catch (error) {
    console.error(error);
    source.attributeErrors = [
      error instanceof GeoImportRequestError
        ? geoIssueText(t, error.issue)
        : t("common:farmsUpload:geoFileRequestFailed"),
    ];
    return source;
  }
  const { rows, errorMessages, missing } = geoFeaturesToFarmRows(
    source.geoFile,
    t,
    language,
    selectedCountry
  );
  source.attributeRows = rows;
  source.attributeErrors = errorMessages;
  source.attributeMissing = missing;
  return source;
};

/** The source as a file dropped on the step: an Excel or a geo file. */
export const readFileSource = (file: File, context: ReadContext) =>
  isGeoFile(file) ? readGeoSource(file, context) : readExcelSource(file, context);

/** A geo source with the production Excel joined to its features by ID. */
export const attachExcel = async (
  source: GeoSource,
  file: File,
  { t, language, selectedCountry }: ReadContext
): Promise<GeoSource> => {
  if (!source.geoFile) return source;
  const { data, errorMessages } = await loadExcelFileFarmsData(
    file,
    t,
    language,
    selectedCountry,
    {
      mandatoryHeaders: GEO_FILE_EXCEL_MANDATORY_HEADERS,
      ignoredColumns: COORDINATE_COLUMNS,
    }
  );
  if (errorMessages.length > 0) {
    return {
      ...source,
      excel: { name: file.name, rows: [], errorMessages, unmatchedIds: 0 },
    };
  }
  const joined = joinRowsWithGeoFeatures({
    rows: data,
    geoFile: source.geoFile,
    t,
    language,
    selectedCountry,
  });
  return {
    ...source,
    excel: {
      name: file.name,
      rows: joined.rows,
      errorMessages: joined.errorMessages,
      unmatchedIds: joined.unmatchedIds,
    },
  };
};

/** Option 3: a geo file and its production Excel, as one source. */
export const readGeoFileWithExcel = async (
  geoFile: File,
  excelFile: File,
  context: ReadContext
): Promise<GeoSource> => {
  const source = await readGeoSource(geoFile, context);
  return source.geoFile ? attachExcel(source, excelFile, context) : source;
};

export const detachExcel = (source: GeoSource): GeoSource => ({
  ...source,
  excel: null,
});

/** The farms the source contributes, when it can be uploaded. */
export const sourceRows = (source: UploadSource): FarmRow[] => {
  switch (source.kind) {
    case "excel":
      return source.rows;
    case "geo":
      return source.excel ? source.excel.rows : source.attributeRows;
    case "manual":
      return [source.row];
  }
};

/** Why the source can't be uploaded, if it can't. */
export const sourceErrors = (source: UploadSource): string[] => {
  switch (source.kind) {
    case "excel":
      return source.errorMessages;
    case "geo":
      return source.excel ? source.excel.errorMessages : source.attributeErrors;
    case "manual":
      return [];
  }
};

/** A geo file read by the API: an Excel can be joined to it. */
export const canAttachExcel = (source: UploadSource): source is GeoSource =>
  source.kind === "geo" && source.geoFile !== null;

export const isUploadable = (source: UploadSource) =>
  sourceErrors(source).length === 0 && sourceRows(source).length > 0;

/** How the source is named in messages: its file, or the manual farm's ID. */
export const sourceLabel = (
  source: UploadSource,
  t: TFunction<"translation", undefined>
): string => {
  if (source.kind !== "manual") return source.name;
  const id = normalizeFarmId(source.row.id);
  return id
    ? t("common:farmsUpload:manualFarmWithId", { id, ...AS_TEXT })
    : t("common:farmsUpload:manualFarm");
};

/** A geo file whose attributes lack the farms' data, and no Excel joined yet. */
export const isMissingData = (source: UploadSource): boolean =>
  source.kind === "geo" &&
  source.geoFile !== null &&
  !source.excel &&
  source.attributeMissing.features > 0;

/**
 * The source's problem, saying what to do about it: what a geo file misses and
 * how to bring it, IDs that don't match and the rule they follow, or else the
 * first error. Null when the source can be uploaded.
 */
export const sourceProblem = (
  source: UploadSource,
  t: TFunction<"translation", undefined>
): string | null => {
  const errors = sourceErrors(source);
  if (errors.length === 0) return null;
  if (source.kind === "geo" && isMissingData(source)) {
    const { attributes, features } = source.attributeMissing;
    return t("common:farmsUpload:problems:missingData", {
      fields: attributes
        .map((key) => t(`common:geoFile:help:fields:${key}`).toLowerCase())
        .join(", "),
      count: features,
      ...AS_TEXT,
    });
  }
  if (source.kind === "geo" && source.excel && source.excel.unmatchedIds > 0) {
    return t("common:farmsUpload:problems:unmatchedIds", {
      count: source.excel.unmatchedIds,
    });
  }
  return errors[0];
};

export interface UploadSummary {
  farms: number;
  polygons: number;
  points: number;
  sourcesWithProblems: number;
}

/** What the upload will send: the uploadable sources' farms by kind. */
export const uploadSummary = (sources: UploadSource[]): UploadSummary => {
  const rows = sources.filter(isUploadable).flatMap(sourceRows);
  const points = rows.filter((row) => row.geometryType === "Point").length;
  return {
    farms: rows.length,
    polygons: rows.length - points,
    points,
    sourcesWithProblems: sources.filter((source) => sourceErrors(source).length > 0)
      .length,
  };
};

/** "10 fincas: 9 polígonos y 1 punto · 1 fuente con problemas" */
export const uploadSummaryText = (
  summary: UploadSummary,
  t: TFunction<"translation", undefined>
): string => {
  const kinds = [
    summary.polygons > 0 &&
      t("common:farmsUpload:summary:polygons", { count: summary.polygons }),
    summary.points > 0 &&
      t("common:farmsUpload:summary:points", { count: summary.points }),
  ].filter(Boolean);
  const farms = t("common:farmsUpload:farmCount", { count: summary.farms });
  const parts = [
    kinds.length > 0
      ? `${farms}: ${kinds.join(` ${t("common:farmsUpload:summary:and")} `)}`
      : farms,
  ];
  if (summary.sourcesWithProblems > 0)
    parts.push(
      t("common:farmsUpload:summary:sourcesWithProblems", {
        count: summary.sourcesWithProblems,
      })
    );
  return parts.join(" · ");
};

interface UploadResult {
  rows: FarmRow[];
  errorMessages: string[];
}

/**
 * Every uploadable source's rows, in list order, as one upload. A source that
 * can't be uploaded, or an ID in more than one source, is an error naming the
 * sources; /farms/parse still checks the IDs within a source.
 */
export const collectUpload = (
  sources: UploadSource[],
  t: TFunction<"translation", undefined>
): UploadResult => {
  const errorMessages: string[] = [];
  sources.forEach((source) =>
    sourceErrors(source).forEach((message) =>
      errorMessages.push(`${sourceLabel(source, t)}: ${message}`)
    )
  );

  // By source, not by name: the same file can be dropped twice
  const sourcesById = new Map<string, Map<string, string>>();
  sources.forEach((source) =>
    sourceRows(source).forEach((row) => {
      const id = normalizeFarmId(row.id);
      if (!id) return;
      const inSources = sourcesById.get(id) ?? new Map<string, string>();
      inSources.set(source.key, sourceLabel(source, t));
      sourcesById.set(id, inSources);
    })
  );
  sourcesById.forEach((inSources, id) => {
    if (inSources.size > 1)
      errorMessages.push(
        t("common:farmsUpload:duplicateIdAcrossSources", {
          id,
          sources: [...inSources.values()].join(", "),
          ...AS_TEXT,
        })
      );
  });

  if (errorMessages.length > 0) return { rows: [], errorMessages };
  return { rows: sources.flatMap(sourceRows), errorMessages: [] };
};
