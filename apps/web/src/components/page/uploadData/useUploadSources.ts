import { useCallback, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { SnackbarContext } from "@/context/SnackbarContext";
import { FarmRow } from "@/interfaces/FarmRow";
import { notifyUploadErrors } from "@/utils/uploadErrors";
import {
  GeoSource,
  UploadSource,
  attachExcel,
  detachExcel,
  isMissingData,
  newSourceKey,
  readExcelSource,
  readGeoFileWithExcel,
  readGeoSource,
  sourceErrors,
  sourceLabel,
} from "@/utils/uploadSources";

/**
 * The upload step's list of sources. It lives in the upload page, not in the step,
 * so it survives the loading screen: when /farms/parse rejects the upload, the user
 * gets the same list back to fix it.
 */
export const useUploadSources = (selectedCountry: string | null) => {
  const [sources, setSources] = useState<UploadSource[]>([]);
  const [reading, setReading] = useState(0);
  const { openSnackbar } = useContext(SnackbarContext);
  const { t, i18n } = useTranslation();

  const context = { t, language: i18n.language, selectedCountry };

  /** Shows why a source can't be uploaded, naming it. */
  const notifyErrors = useCallback(
    (source: UploadSource) => {
      const label = sourceLabel(source, t);
      const errors = sourceErrors(source).map((message) => `${label}: ${message}`);
      if (errors.length > 0) notifyUploadErrors(openSnackbar, errors, t);
    },
    [openSnackbar, t]
  );

  const replace = useCallback(
    (source: UploadSource) =>
      setSources((current) =>
        current.map((item) => (item.key === source.key ? source : item))
      ),
    []
  );

  /** Reads each file as a source and adds it, unless `keep` says no. */
  const addSources = async (
    files: File[],
    read: (file: File) => Promise<UploadSource>,
    keep: (source: UploadSource) => boolean = () => true
  ) => {
    setReading((count) => count + files.length);
    for (const file of files) {
      try {
        const source = await read(file);
        if (keep(source)) setSources((current) => [...current, source]);
        // A geo file missing the farms' data waits for its Excel: the list says
        // so and how, and its errors are one click away
        if (!isMissingData(source)) notifyErrors(source);
      } finally {
        setReading((count) => count - 1);
      }
    }
  };

  /** Option 1. An Excel without coordinates isn't listed: its message points
   * to option 3. */
  const addExcelFiles = (files: File[]) =>
    addSources(
      files,
      (file) => readExcelSource(file, context),
      (source) => !(source.kind === "excel" && source.withoutCoordinates)
    );

  /** Option 2 */
  const addGeoFiles = (files: File[]) =>
    addSources(files, (file) => readGeoSource(file, context));

  /** Option 3: the geo file and its Excel, joined by ID, as one source */
  const addGeoFileWithExcel = (geoFile: File, excelFile: File) =>
    addSources([geoFile], (file) => readGeoFileWithExcel(file, excelFile, context));

  const attach = async (source: GeoSource, file: File) => {
    setReading((count) => count + 1);
    try {
      const joined = await attachExcel(source, file, context);
      replace(joined);
      notifyErrors(joined);
    } finally {
      setReading((count) => count - 1);
    }
  };

  const detach = (source: GeoSource) => replace(detachExcel(source));

  const remove = (source: UploadSource) =>
    setSources((current) => current.filter((item) => item.key !== source.key));

  /** Adds a manual farm, or replaces the one being edited. */
  const saveManual = (row: FarmRow, key?: string) =>
    setSources((current) =>
      key
        ? current.map((item) =>
            item.key === key && item.kind === "manual" ? { ...item, row } : item
          )
        : [...current, { kind: "manual", key: newSourceKey(), row }]
    );

  return {
    sources,
    reading: reading > 0,
    addExcelFiles,
    addGeoFiles,
    addGeoFileWithExcel,
    attach,
    detach,
    remove,
    saveManual,
    notifyErrors,
  };
};

export type UploadSourcesState = ReturnType<typeof useUploadSources>;
