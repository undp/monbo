"use client";

import {
  createContext,
  MutableRefObject,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { DataContext } from "@/context/DataContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import { MapLayerChangedError } from "@/api/deforestationAnalysis";
import { getRuntimeConfig } from "@/config/runtime";
import {
  DeforestationImageBlob,
  fetchDeforestationImages,
} from "@/utils/deforestationImages";
import {
  ReportPdfClient,
  ReportPdfWorkerTerminatedError,
} from "@/workers/reportPdfClient";
import type { ReportPdfRequest } from "@/workers/reportPdfProtocol";
import type { FarmData } from "@/interfaces/Farm";
import type {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";

// The report page's images and renders, shared by the preview and both downloads:
// - the images are fetched once per selection;
// - every PDF renders in a worker (src/workers/reportPdf.worker.tsx);
// - once the preview is shown, the complete report (with links, which the preview
//   hides) is pre-rendered, so "Download" doesn't wait for a render.

interface Selection {
  /** Identifies the selection: what's fetched or rendered for it is reused. */
  key: string;
  country: string;
  farms: FarmData[];
  maps: MapData[];
  results: DeforestationAnalysisMapResults[];
  locale: string;
}

interface ReportContextValue {
  /** The rendered preview of the current selection, null while it renders. */
  previewUrl: string | null;
  isPreviewLoading: boolean;
  /** The complete report, with links: pre-rendered, or rendered now. */
  getCompleteReport: () => Promise<Blob>;
  /** A ZIP with one report per farm. */
  getSeparatedReports: () => Promise<Blob>;
}

const noSelection = () =>
  Promise.reject(new Error("No report selection to render"));

export const ReportContext = createContext<ReportContextValue>({
  previewUrl: null,
  isPreviewLoading: false,
  getCompleteReport: noSelection,
  getSeparatedReports: noSelection,
});

type Keyed<T> = { key: string; promise: Promise<T> } | null;

/** The promise for `key`, created once; forgotten if it fails, so it can retry. */
const keyed = <T,>(
  ref: MutableRefObject<Keyed<T>>,
  key: string,
  create: () => Promise<T>
): Promise<T> => {
  if (ref.current?.key === key) return ref.current.promise;
  const promise = create();
  ref.current = { key, promise };
  promise.catch(() => {
    if (ref.current?.promise === promise) ref.current = null;
  });
  return promise;
};

export const ReportProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const { openSnackbar } = useContext(SnackbarContext);
  const params = useParams();
  const locale = params.locale as string;
  const { deforestationAnalysisResults } = useVisibleDataForDeforestationPage();
  const {
    reportGenerationParams: { selectedMaps, selectedFarms },
    selectedCountry,
    invalidateAnalysis,
  } = useContext(DataContext);

  const selection = useMemo<Selection | null>(() => {
    const results = deforestationAnalysisResults.filter((m) =>
      selectedMaps.some((map) => map.id === m.mapId)
    );
    if (
      !selectedCountry ||
      !selectedFarms.length ||
      !selectedMaps.length ||
      !results.length
    )
      return null;
    const key = JSON.stringify([
      selectedCountry,
      locale,
      results.map((r) => `${r.mapId}@${r.version}`).sort(),
      selectedFarms.map((f) => f.id).sort(),
    ]);
    return {
      key,
      country: selectedCountry,
      farms: selectedFarms,
      maps: selectedMaps,
      results,
      locale,
    };
  }, [
    deforestationAnalysisResults,
    selectedMaps,
    selectedFarms,
    selectedCountry,
    locale,
  ]);

  const clientRef = useRef<ReportPdfClient | null>(null);
  const mountedRef = useRef(true);
  const imagesRef = useRef<Keyed<DeforestationImageBlob[]>>(null);
  const previewRef = useRef<Keyed<Blob>>(null);
  const completeRef = useRef<Keyed<Blob>>(null);

  const render = useCallback(
    async (
      s: Selection,
      kind: ReportPdfRequest["kind"],
      showLinks: boolean
    ): Promise<Blob> => {
      const images = await keyed(imagesRef, s.key, () =>
        fetchDeforestationImages(s.country, s.maps, s.farms, s.results)
      );
      // The page may have gone away while the images were fetched. Its cleanup
      // found no worker to terminate then, so don't start one now.
      if (!mountedRef.current) throw new ReportPdfWorkerTerminatedError();
      clientRef.current ??= new ReportPdfClient();
      return clientRef.current.render({
        kind,
        showLinks,
        locale: s.locale,
        config: getRuntimeConfig(),
        farms: s.farms,
        results: s.results,
        maps: s.maps,
        images,
      });
    },
    []
  );

  // The worker lives as long as the page. Renders it had in progress are dropped
  // with it, so a remount (React's dev double mount) starts them again.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clientRef.current?.terminate();
      clientRef.current = null;
      previewRef.current = null;
      completeRef.current = null;
    };
  }, []);

  const [preview, setPreview] = useState<{ key: string; url: string } | null>(
    null
  );

  useEffect(() => {
    if (!selection) return;
    let active = true;
    // Preview first, without links (they would navigate the previewer away);
    // then the download's render, with them.
    keyed(previewRef, selection.key, () =>
      render(selection, "complete", false)
    )
      .then((blob) => {
        if (!active) return;
        const url = URL.createObjectURL(blob);
        setPreview((previous) => {
          if (previous) URL.revokeObjectURL(previous.url);
          return { key: selection.key, url };
        });
        // Its errors show up if the user downloads (it is rendered again then).
        keyed(completeRef, selection.key, () =>
          render(selection, "complete", true)
        ).catch(() => {});
      })
      .catch((error) => {
        if (!active || error instanceof ReportPdfWorkerTerminatedError) return;
        // A layer got a new raster after the analysis: re-run it instead of
        // previewing a report that mixes both rasters.
        if (error instanceof MapLayerChangedError) return invalidateAnalysis();
        console.error("Error generating the report preview:", error);
        openSnackbar({
          message: t("common:snackbarAlerts:errorGeneratingReportPreview"),
          type: "error",
        });
      });
    return () => {
      active = false;
    };
  }, [selection, render, invalidateAnalysis, openSnackbar, t]);

  // Release the preview's blob when the page goes away.
  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => {
    previewUrlRef.current = preview?.url ?? null;
  }, [preview]);
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    []
  );

  const getCompleteReport = useCallback(() => {
    if (!selection) return noSelection();
    // The pre-render if it exists, finished or not; a new render otherwise.
    return keyed(completeRef, selection.key, () =>
      render(selection, "complete", true)
    );
  }, [selection, render]);

  const getSeparatedReports = useCallback(() => {
    if (!selection) return noSelection();
    return render(selection, "perFarm", true);
  }, [selection, render]);

  const isCurrent = !!selection && preview?.key === selection.key;
  const value = useMemo(
    () => ({
      previewUrl: isCurrent ? preview!.url : null,
      isPreviewLoading: !!selection && !isCurrent,
      getCompleteReport,
      getSeparatedReports,
    }),
    [isCurrent, preview, selection, getCompleteReport, getSeparatedReports]
  );

  return (
    <ReportContext.Provider value={value}>{children}</ReportContext.Provider>
  );
};
