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
import { DataContext } from "@/context/DataContext";
import { useVisibleDataForAnalysisPage } from "@/hooks/useVisibleDataForAnalysisPage";
import { MapLayerChangedError } from "@/api/layerAnalysis";
import { getRuntimeConfig } from "@/config/runtime";
import { MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION } from "@/config/env";
import pLimit from "p-limit";
import {
  LayerImageBlob,
  fetchLayerImages,
  fetchFarmImages,
  includesSatelliteBackground,
  mapsWithResults,
} from "@/utils/layerImages";
import { layerTextsOf } from "@/utils/layerTexts";
import { countFarmPages, isLargeReport } from "@/utils/reportSize";
import {
  ReportPdfClient,
  ReportPdfWorkerTerminatedError,
  type ZipJob,
} from "@/workers/reportPdfClient";
import type { ReportPdfRequest } from "@/workers/reportPdfProtocol";
import type { FarmData } from "@/interfaces/Farm";
import type { LayerCategory } from "@/interfaces/LayerCategory";
import type {
  LayerAnalysisMapResults,
  MapData,
} from "@/interfaces/LayerAnalysis";

// The report page's images and renders, shared by the preview and the downloads:
// - every PDF renders in a worker (src/workers/reportPdf.worker.tsx);
// - the preview renders only when asked for (`requestPreview`), for the choice of
//   that moment; a later change of choice leaves it stale, not rendered again;
// - a report that isn't large fetches its images once per selection, and once its
//   preview is shown, pre-renders the complete report (with links, which the
//   preview hides), so "Download" doesn't wait for a render. The downloads always
//   take the current choice, whatever the preview shows;
// - a large report (more than LARGE_REPORT_FARM_PAGES farm pages) never renders a
//   complete PDF, which would run the tab out of memory: its preview is the first
//   farm's PDF, and its download is a ZIP built farm by farm (`buildLargeReportZip`).

interface Selection {
  /** Identifies the selection: what's rendered for it is reused. */
  key: string;
  /** What the layer images depend on: the layer texts don't change them. */
  imagesKey: string;
  country: string;
  farms: FarmData[];
  maps: MapData[];
  /** The country's categories: each layer's rule and texts in the report. */
  categories: LayerCategory[];
  results: LayerAnalysisMapResults[];
  locale: string;
  /** Its farm pages: a sheet per farm and a map per (farm, layer) with a result. */
  farmPages: number;
  isLarge: boolean;
}

/** What the requested preview's notices describe: the choice it was rendered for. */
interface PreviewInfo {
  isLarge: boolean;
  farmCount: number;
  satelliteLimit: number | null;
}

export type PreviewState = "idle" | "loading" | "ready" | "failed";

interface ReportContextValue {
  /**
   * The last preview rendered, null before the first one. It stays shown when the
   * choice changes (`isPreviewStale`) until another is requested.
   */
  previewUrl: string | null;
  /** The requested preview: none yet, rendering, shown, or failed. */
  previewState: PreviewState;
  /** The choice it shows is no longer the current one. */
  isPreviewStale: boolean;
  /** A preview of the current choice is shown or rendering: no need to ask again. */
  isPreviewCurrent: boolean;
  /** The shown preview's choice, for its notices. */
  previewInfo: PreviewInfo | null;
  /** Renders the preview of the current choice. */
  requestPreview: () => void;
  /** Renders the failed preview's choice again. */
  retryPreview: () => void;
  /** The complete report, with links: pre-rendered, or rendered now. */
  getCompleteReport: () => Promise<Blob>;
  /** A ZIP with one report per farm. */
  getSeparatedReports: () => Promise<Blob>;
  /** The current choice is large: its preview is one farm, its download a ZIP only. */
  isLarge: boolean;
  /** The selected farms: the PDFs in the ZIP. */
  farmCount: number;
  /**
   * The farms limit of the satellite background when the selection is above it,
   * so its maps go without it; null when they have it.
   */
  satelliteLimit: number | null;
  /**
   * A large report's ZIP, built farm by farm; `onProgress` gets the farms done. It
   * stops when `signal` aborts, the selection changes or the page goes away.
   */
  buildLargeReportZip: (
    onProgress: (done: number, total: number) => void,
    signal?: AbortSignal
  ) => Promise<Blob>;
}

const noSelection = () =>
  Promise.reject(new Error("No report selection to render"));

export const ReportContext = createContext<ReportContextValue>({
  previewUrl: null,
  previewState: "idle",
  isPreviewStale: false,
  isPreviewCurrent: false,
  previewInfo: null,
  requestPreview: () => {},
  retryPreview: () => {},
  getCompleteReport: noSelection,
  getSeparatedReports: noSelection,
  isLarge: false,
  farmCount: 0,
  satelliteLimit: null,
  buildLargeReportZip: noSelection,
});

// A large report's ZIP job: the farms whose images are fetched ahead, and the
// farms handed to the worker at once. Both bound the images held in memory.
const LOOK_AHEAD_FARMS = 8;
const FARMS_IN_WORKER = 2;
// One farm's PDF renders in well under a second: a worker that takes this long is
// stuck, and the job fails instead of waiting forever.
const FARM_RENDER_TIMEOUT_MS = 2 * 60 * 1000;

/** The worker didn't answer for a farm within FARM_RENDER_TIMEOUT_MS. */
export class ReportWorkerStalledError extends Error {
  constructor() {
    super("The report worker stopped answering");
    this.name = "ReportWorkerStalledError";
  }
}

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ReportWorkerStalledError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

/** Only `farm`'s results, per layer: all that its PDF needs. */
const farmResults = (
  farm: FarmData,
  results: LayerAnalysisMapResults[]
) =>
  results.map((layer) => ({
    ...layer,
    farmResults: layer.farmResults.filter(({ farmId }) => farmId === farm.id),
  }));

/** Whether the selection's images get the satellite background (all or none). */
const satelliteFor = (s: Selection) =>
  includesSatelliteBackground(
    s.farms.filter((farm) => mapsWithResults(farm, s.maps, s.results).length)
      .length
  );

/** The farms limit of the satellite background when `s` is above it. */
const satelliteLimitFor = (s: Selection | null) =>
  s && !satelliteFor(s)
    ? MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION
    : null;

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
  const params = useParams();
  const locale = params.locale as string;
  const { territorialAnalysisResults } = useVisibleDataForAnalysisPage();
  const {
    reportGenerationParams: { selectedMaps, selectedFarms },
    selectedCountry,
    availableCategories,
    invalidateAnalysis,
  } = useContext(DataContext);

  const selection = useMemo<Selection | null>(() => {
    const results = territorialAnalysisResults.filter((m) =>
      selectedMaps.some((map) => map.id === m.mapId)
    );
    if (
      !selectedCountry ||
      !selectedFarms.length ||
      !selectedMaps.length ||
      !results.length
    )
      return null;
    const imagesKey = JSON.stringify([
      selectedCountry,
      locale,
      results.map((r) => `${r.mapId}@${r.version}`).sort(),
      selectedFarms.map((f) => f.id).sort(),
      // A category edited by the admin changes the report's results and texts.
      availableCategories,
    ]);
    const key = JSON.stringify([imagesKey, selectedMaps.map(layerTextsOf)]);
    const farmPages = countFarmPages(selectedFarms, results);
    return {
      key,
      imagesKey,
      country: selectedCountry,
      farms: selectedFarms,
      maps: selectedMaps,
      categories: availableCategories,
      results,
      locale,
      farmPages,
      isLarge: isLargeReport(farmPages),
    };
  }, [
    territorialAnalysisResults,
    selectedMaps,
    selectedFarms,
    selectedCountry,
    availableCategories,
    locale,
  ]);

  // Once per selection: it looks up every farm's results.
  const satelliteLimit = useMemo(() => satelliteLimitFor(selection), [selection]);

  const clientRef = useRef<ReportPdfClient | null>(null);
  const mountedRef = useRef(true);
  const imagesRef = useRef<Keyed<LayerImageBlob[]>>(null);
  const previewRef = useRef<Keyed<Blob>>(null);
  const completeRef = useRef<Keyed<Blob>>(null);

  /** The page's worker client, started on first use; never after the page left. */
  const workerClient = useCallback(() => {
    // The page may have gone away while the images were fetched. Its cleanup
    // found no worker to terminate then, so don't start one now.
    if (!mountedRef.current) throw new ReportPdfWorkerTerminatedError();
    clientRef.current ??= new ReportPdfClient();
    return clientRef.current;
  }, []);

  const render = useCallback(
    async (
      s: Selection,
      kind: ReportPdfRequest["kind"],
      showLinks: boolean
    ): Promise<Blob> => {
      const images = await keyed(imagesRef, s.imagesKey, () =>
        fetchLayerImages(s.country, s.maps, s.farms, s.results)
      );
      return workerClient().render({
        kind,
        showLinks,
        locale: s.locale,
        config: getRuntimeConfig(),
        farms: s.farms,
        results: s.results,
        maps: s.maps,
        categories: s.categories,
        satelliteBackground: satelliteFor(s),
        images,
      });
    },
    [workerClient]
  );

  /** A large report's preview: its first farm with a result, as in the ZIP. */
  const renderFirstFarm = useCallback(
    async (s: Selection): Promise<Blob> => {
      const farm =
        s.farms.find((f) => mapsWithResults(f, s.maps, s.results).length) ??
        s.farms[0];
      const images = await fetchFarmImages({
        country: s.country,
        farm,
        maps: s.maps,
        results: s.results,
        includeSatelliteBackground: satelliteFor(s),
        limit: pLimit(20),
      });
      return workerClient().render({
        kind: "complete",
        showLinks: false,
        locale: s.locale,
        config: getRuntimeConfig(),
        farms: [farm],
        results: farmResults(farm, s.results),
        maps: s.maps,
        categories: s.categories,
        satelliteBackground: satelliteFor(s),
        images,
      });
    },
    [workerClient]
  );

  /**
   * The job's ZIP. Its generation can't be interrupted in the worker, so a cancel
   * while it runs drops the worker (the next render starts a new one), and a ZIP
   * that finished after a cancel is not returned.
   */
  const finishZip = useCallback(
    async (job: ZipJob, signal: AbortSignal): Promise<Blob> => {
      const dropWorker = () => {
        clientRef.current?.terminate();
        clientRef.current = null;
      };
      signal.addEventListener("abort", dropWorker, { once: true });
      try {
        const blob = await job.finish();
        signal.throwIfAborted();
        return blob;
      } finally {
        signal.removeEventListener("abort", dropWorker);
      }
    },
    []
  );

  /**
   * A large report's ZIP: each farm's images are fetched (a few farms ahead), its
   * PDF is added in the worker, and its images are let go, so memory doesn't grow
   * with the number of farms.
   */
  const runZipJob = useCallback(
    async (
      s: Selection,
      onProgress: (done: number, total: number) => void,
      signal: AbortSignal
    ): Promise<Blob> => {
      const includeSatelliteBackground = satelliteFor(s);
      const job = await workerClient().startZip({
        locale: s.locale,
        config: getRuntimeConfig(),
        maps: s.maps,
        categories: s.categories,
        satelliteBackground: includeSatelliteBackground,
      });
      const limit = pLimit(20);
      const total = s.farms.length;
      const images: (Promise<LayerImageBlob[]> | null | undefined)[] = [];
      const fetchAhead = (i: number) => {
        if (i >= total || images[i] !== undefined) return;
        const fetching = fetchFarmImages({
          country: s.country,
          farm: s.farms[i],
          maps: s.maps,
          results: s.results,
          includeSatelliteBackground,
          limit,
          signal,
        });
        fetching.catch(() => {}); // awaited in order below
        images[i] = fetching;
      };
      const inWorker: Promise<void>[] = [];
      try {
        for (let i = 0; i < total; i++) {
          for (let j = i; j < i + LOOK_AHEAD_FARMS; j++) fetchAhead(j);
          const farmImages = await images[i]!;
          signal.throwIfAborted();
          if (inWorker.length >= FARMS_IN_WORKER) await inWorker.shift();
          const farm = s.farms[i];
          const adding = withTimeout(
            job.add(farm, farmResults(farm, s.results), farmImages),
            FARM_RENDER_TIMEOUT_MS
          ).then((added) => {
            // A farm can finish after the job was cancelled: no progress then.
            if (!signal.aborted) onProgress(added, total);
          });
          adding.catch(() => {}); // awaited below
          inWorker.push(adding);
          images[i] = null; // the worker has its own copy now
        }
        await Promise.all(inWorker);
        signal.throwIfAborted();
        return await finishZip(job, signal);
      } catch (error) {
        if (error instanceof ReportWorkerStalledError) {
          // Don't reuse a stuck worker: the next render starts a new one.
          clientRef.current?.terminate();
          clientRef.current = null;
        } else {
          job.cancel();
        }
        throw error;
      }
    },
    [workerClient, finishZip]
  );

  // The running ZIP job, stopped when the selection changes or the page goes away.
  const zipJobRef = useRef<AbortController | null>(null);

  // The worker lives as long as the page. Renders it had in progress are dropped
  // with it, so a remount (React's dev double mount) starts them again.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      zipJobRef.current?.abort();
      clientRef.current?.terminate();
      clientRef.current = null;
      previewRef.current = null;
      completeRef.current = null;
    };
  }, []);

  const [preview, setPreview] = useState<
    ({ key: string; url: string } & PreviewInfo) | null
  >(null);
  // The choice the user asked a preview of. It is kept as it was then: the
  // current choice may change while it renders.
  const [requested, setRequested] = useState<Selection | null>(null);
  // The requested preview failed, until the user asks again.
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Read when a render fails, not a reason to render again: the effect below
  // runs only when a preview is asked for.
  const invalidateAnalysisRef = useRef(invalidateAnalysis);
  useEffect(() => {
    invalidateAnalysisRef.current = invalidateAnalysis;
  }, [invalidateAnalysis]);
  // The current choice's key, read when a preview is ready: no other is downloaded.
  const currentKeyRef = useRef<string | null>(null);
  useEffect(() => {
    currentKeyRef.current = selection?.key ?? null;
  }, [selection]);

  useEffect(() => {
    // Nothing renders until the user asks for it.
    const selection = requested;
    if (!selection) return;
    let active = true;
    // Preview first, without links (they would navigate the previewer away);
    // then the download's render, with them.
    // A large report previews one farm, and has no complete report to pre-render.
    keyed(previewRef, selection.key, () =>
      selection.isLarge
        ? renderFirstFarm(selection)
        : render(selection, "complete", false)
    )
      .then((blob) => {
        if (!active) return;
        const url = URL.createObjectURL(blob);
        setPreview((previous) => {
          if (previous) URL.revokeObjectURL(previous.url);
          return {
            key: selection.key,
            url,
            isLarge: selection.isLarge,
            farmCount: selection.farms.length,
            satelliteLimit: satelliteLimitFor(selection),
          };
        });
        // A large report has no complete PDF; a choice changed meanwhile won't be
        // downloaded as it was, and its render would hold up the current one's.
        if (selection.isLarge || selection.key !== currentKeyRef.current) return;
        // Its errors show up if the user downloads (it is rendered again then).
        keyed(completeRef, selection.key, () =>
          render(selection, "complete", true)
        ).catch(() => {});
      })
      .catch((error) => {
        if (!active || error instanceof ReportPdfWorkerTerminatedError) return;
        // A layer got a new raster after the analysis: re-run it instead of
        // previewing a report that mixes both rasters.
        if (error instanceof MapLayerChangedError)
          return invalidateAnalysisRef.current();
        console.error("Error generating the report preview:", error);
        // The failed promise was forgotten (`keyed`), so a retry renders again.
        setFailedKey(selection.key);
      });
    return () => {
      active = false;
    };
  }, [requested, attempt, render, renderFirstFarm]);

  // A ZIP job belongs to the selection it started with. By key, not identity:
  // the /maps poll replaces the selected map objects with equal ones, which gives
  // a new `selection` for the same report, and that must not stop a job.
  const selectionKey = selection?.key ?? null;
  useEffect(() => () => zipJobRef.current?.abort(), [selectionKey]);

  const requestPreview = useCallback(() => {
    if (!selection) return;
    setFailedKey(null);
    setRequested(selection);
    setAttempt((n) => n + 1);
  }, [selection]);

  const retryPreview = useCallback(() => {
    setFailedKey(null);
    setAttempt((n) => n + 1);
  }, []);

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
    if (selection.isLarge)
      return Promise.reject(new Error("A large report is downloaded as a ZIP"));
    // The pre-render if it exists, finished or not; a new render otherwise.
    return keyed(completeRef, selection.key, () =>
      render(selection, "complete", true)
    );
  }, [selection, render]);

  const getSeparatedReports = useCallback(() => {
    if (!selection) return noSelection();
    return render(selection, "perFarm", true);
  }, [selection, render]);

  const buildLargeReportZip = useCallback(
    async (
      onProgress: (done: number, total: number) => void,
      signal?: AbortSignal
    ): Promise<Blob> => {
      if (!selection) return noSelection();
      // One job at a time; the user's signal, the selection and the page stop it.
      zipJobRef.current?.abort();
      const controller = new AbortController();
      zipJobRef.current = controller;
      const abort = () => controller.abort(signal?.reason);
      if (signal?.aborted) abort();
      signal?.addEventListener("abort", abort, { once: true });
      try {
        return await runZipJob(selection, onProgress, controller.signal);
      } finally {
        signal?.removeEventListener("abort", abort);
        if (zipJobRef.current === controller) zipJobRef.current = null;
      }
    },
    [selection, runZipJob]
  );

  const previewState: PreviewState = !requested
    ? "idle"
    : failedKey === requested.key
      ? "failed"
      : preview?.key === requested.key
        ? "ready"
        : "loading";
  const requestedIsCurrent = !!selection && requested?.key === selection.key;
  const value = useMemo(
    () => ({
      previewUrl: preview?.url ?? null,
      previewState,
      isPreviewStale: previewState === "ready" && !requestedIsCurrent,
      isPreviewCurrent: requestedIsCurrent && previewState !== "failed",
      previewInfo: preview && {
        isLarge: preview.isLarge,
        farmCount: preview.farmCount,
        satelliteLimit: preview.satelliteLimit,
      },
      requestPreview,
      retryPreview,
      getCompleteReport,
      getSeparatedReports,
      isLarge: !!selection?.isLarge,
      farmCount: selection?.farms.length ?? 0,
      satelliteLimit,
      buildLargeReportZip,
    }),
    [
      preview,
      previewState,
      requestedIsCurrent,
      requestPreview,
      retryPreview,
      selection,
      satelliteLimit,
      getCompleteReport,
      getSeparatedReports,
      buildLargeReportZip,
    ]
  );

  return (
    <ReportContext.Provider value={value}>{children}</ReportContext.Provider>
  );
};
