import { useCallback, useContext, useEffect, useRef, useState } from "react";
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
  isReadForCountry,
  newSourceKey,
  readExcelSource,
  readGeoFileWithExcel,
  readGeoSource,
  rereadSources,
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
  // The context as it is now, for a read that ends after a render changed it
  const contextRef = useRef(context);
  useEffect(() => {
    contextRef.current = context;
  });

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

  /**
   * The source read against the country selected now. The user can change the
   * country while a file is being read: the source would be listed validated for
   * the old country, and the recheck on a country change (below) only sees the
   * listed sources. So a source read for another country is read again.
   */
  const settled = async (source: UploadSource, readFor: string | null) => {
    let current = source;
    let country = readFor;
    while (country !== contextRef.current.selectedCountry) {
      country = contextRef.current.selectedCountry;
      [current] = await rereadSources([current], contextRef.current);
    }
    return current;
  };

  /** Reads each file as a source and adds it, unless `keep` says no. */
  const addSources = async (
    files: File[],
    read: (file: File) => Promise<UploadSource>,
    keep: (source: UploadSource) => boolean = () => true
  ) => {
    setReading((count) => count + files.length);
    for (const file of files) {
      try {
        const source = await settled(await read(file), context.selectedCountry);
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
      const joined = await settled(
        await attachExcel(source, file, context),
        context.selectedCountry
      );
      replace(joined);
      notifyErrors(joined);
    } finally {
      setReading((count) => count - 1);
    }
  };

  const detach = (source: GeoSource) => replace(detachExcel(source));

  // A file's farms are checked against the country selected when it is read
  // (`readFor`). When the user changes the country in the header, every listed
  // file read for another one is read again, so a file with farms in another
  // country stops being uploadable. A source the user edits meanwhile (an Excel
  // detached, a manual farm saved) keeps its edit: a result only replaces the
  // very version that was read, and an edited file still read for another
  // country is read again on the next run.
  const rereading = useRef(new Set<string>());
  useEffect(() => {
    const stale = sources.filter(
      (source) =>
        !isReadForCountry(source, selectedCountry) &&
        !rereading.current.has(source.key)
    );
    if (stale.length === 0) return;
    stale.forEach((source) => rereading.current.add(source.key));
    setReading((count) => count + 1);
    const done = () => {
      stale.forEach((source) => rereading.current.delete(source.key));
      setReading((count) => count - 1);
    };
    rereadSources(stale, { t, language: i18n.language, selectedCountry })
      .then((reread) => {
        done();
        setSources((current) =>
          current.map((item) => {
            const index = stale.indexOf(item);
            return index === -1 ? item : reread[index];
          })
        );
        reread.forEach((source) => {
          if (!isMissingData(source)) notifyErrors(source);
        });
      })
      .catch((error) => {
        console.error(error);
        done();
      });
  }, [sources, selectedCountry, t, i18n.language, notifyErrors]);

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
    // Also while a file is still to be read again for the selected country
    reading:
      reading > 0 ||
      sources.some((source) => !isReadForCountry(source, selectedCountry)),
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
