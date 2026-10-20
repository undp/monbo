import { pdf } from "@react-pdf/renderer";
import JSZip from "jszip";
import type { TFunction } from "i18next";
import initTranslations from "@/utils/i18n";
import i18nConfig from "@/i18nConfig";
import { setRuntimeConfig } from "@/config/runtime";
import {
  DeforestationReportDocument,
  registerReportFonts,
  type DeforestationReportImage,
} from "@/utils/deforestationReport";
import type {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import type { FarmData } from "@/interfaces/Farm";
import type { DeforestationImageBlob } from "@/utils/deforestationImages";
import type {
  ReportPdfMessage,
  ReportPdfRequest,
  ReportPdfResponse,
  ZipCommand,
} from "./reportPdfProtocol";

// Renders the report off the main thread, so the page doesn't freeze. One worker
// per report page, reused for every render: @react-pdf keeps its font and image
// caches between documents.

const scope = self as unknown as Worker;

// The namespaces the report reads (it always prefixes its keys).
const NAMESPACES = ["reportGeneration", "common", "deforestationAnalysis"];

// Only this page messages the worker, but the locale picks the translations: use
// the configured value that matches it, never the message's own string.
const supportedLocale = (locale: string) => {
  const supported = i18nConfig.locales.find((l) => l === locale);
  if (!supported) throw new Error(`Unsupported locale: ${locale}`);
  return supported;
};

const translations = new Map<string, Promise<TFunction>>();
const getT = (locale: string) => {
  if (!translations.has(locale))
    translations.set(
      locale,
      initTranslations(locale, NAMESPACES).then(({ t }) => t)
    );
  return translations.get(locale)!;
};

type Locale = ReturnType<typeof supportedLocale>;

/** Object URLs for `images` while `callback` runs, revoked afterwards. */
const withImageUrls = async <T,>(
  images: DeforestationImageBlob[],
  callback: (images: DeforestationReportImage[]) => Promise<T>
): Promise<T> => {
  const withUrls = images.map(({ mapId, farmId, blob }) => ({
    mapId,
    farmId,
    url: URL.createObjectURL(blob),
  }));
  try {
    return await callback(withUrls);
  } finally {
    withUrls.forEach(({ url }) => URL.revokeObjectURL(url));
  }
};

const renderDocument = (params: {
  farms: FarmData[];
  results: DeforestationAnalysisMapResults[];
  maps: MapData[];
  images: DeforestationReportImage[];
  t: TFunction;
  locale: Locale;
  showLinks: boolean;
}) =>
  pdf(
    <DeforestationReportDocument
      farmsData={params.farms}
      deforestationAnalysisResults={params.results}
      mapsData={params.maps}
      images={params.images}
      t={params.t}
      language={params.locale}
      showLinks={params.showLinks}
    />
  ).toBlob();

const zipFileName = (farm: FarmData) => `report_farm_${farm.id}.pdf`;

const render = async (request: ReportPdfRequest): Promise<Blob> => {
  registerReportFonts();
  setRuntimeConfig(request.config);
  const locale = supportedLocale(request.locale);
  const t = await getT(locale);
  return withImageUrls(request.images, async (images) => {
    const document = (farms: FarmData[]) =>
      renderDocument({
        farms,
        results: request.results,
        maps: request.maps,
        images,
        t,
        locale,
        showLinks: request.showLinks,
      });
    if (request.kind === "complete") return document(request.farms);

    const zip = new JSZip();
    for (const farm of request.farms) {
      zip.file(zipFileName(farm), await document([farm]));
    }
    return zip.generateAsync({ type: "blob" });
  });
};

// A large report's ZIP jobs, by id: each holds its ZIP and what every farm's PDF
// shares. Its farms arrive one by one (`add`) with only their own images, so the
// worker never holds more than the farms in flight.
interface ZipJob {
  zip: JSZip;
  locale: Locale;
  t: TFunction;
  maps: MapData[];
  added: number;
}
const zipJobs = new Map<number, ZipJob>();

const runZipCommand = async (
  job: number,
  command: ZipCommand
): Promise<{ added: number } | { blob: Blob }> => {
  if (command.op === "start") {
    registerReportFonts();
    setRuntimeConfig(command.config);
    const locale = supportedLocale(command.locale);
    zipJobs.set(job, {
      zip: new JSZip(),
      locale,
      t: await getT(locale),
      maps: command.maps,
      added: 0,
    });
    return { added: 0 };
  }
  if (command.op === "cancel") {
    const state = zipJobs.get(job);
    zipJobs.delete(job);
    return { added: state?.added ?? 0 };
  }
  const state = zipJobs.get(job);
  if (!state) throw new Error(`Unknown or cancelled ZIP job ${job}`);
  if (command.op === "finish") {
    zipJobs.delete(job);
    // STORE: the PDFs are already compressed (DCT images, Flate text).
    return {
      blob: await state.zip.generateAsync({ type: "blob", compression: "STORE" }),
    };
  }
  const blob = await withImageUrls(command.images, (images) =>
    renderDocument({
      farms: [command.farm],
      results: command.results,
      maps: state.maps,
      images,
      t: state.t,
      locale: state.locale,
      showLinks: true,
    })
  );
  // Cancelled while this farm rendered: drop it.
  if (zipJobs.get(job) !== state) return { added: state.added };
  state.zip.file(zipFileName(command.farm), blob);
  return { added: ++state.added };
};

scope.onmessage = async (event: MessageEvent<ReportPdfMessage>) => {
  const message = event.data;
  const { id } = message;
  let response: ReportPdfResponse;
  try {
    response =
      "zip" in message
        ? { id, ...(await runZipCommand(message.job, message.zip)) }
        : { id, blob: await render(message.request) };
  } catch (error) {
    console.error("Error rendering the report", error);
    response = {
      id,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  scope.postMessage(response);
};
