import { pdf } from "@react-pdf/renderer";
import JSZip from "jszip";
import type { TFunction } from "i18next";
import initTranslations from "@/utils/i18n";
import i18nConfig from "@/i18nConfig";
import { setRuntimeConfig } from "@/config/runtime";
import {
  DeforestationReportDocument,
  registerReportFonts,
} from "@/utils/deforestationReport";
import type {
  ReportPdfMessage,
  ReportPdfRequest,
  ReportPdfResponse,
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

const render = async (request: ReportPdfRequest): Promise<Blob> => {
  registerReportFonts();
  setRuntimeConfig(request.config);
  const locale = supportedLocale(request.locale);
  const t = await getT(locale);
  const images = request.images.map(({ mapId, farmId, blob }) => ({
    mapId,
    farmId,
    url: URL.createObjectURL(blob),
  }));

  const renderDocument = (farms: ReportPdfRequest["farms"]) =>
    pdf(
      <DeforestationReportDocument
        farmsData={farms}
        deforestationAnalysisResults={request.results}
        mapsData={request.maps}
        images={images}
        t={t}
        language={locale}
        showLinks={request.showLinks}
      />
    ).toBlob();

  try {
    if (request.kind === "complete") return await renderDocument(request.farms);

    const zip = new JSZip();
    for (const farm of request.farms) {
      zip.file(`report_farm_${farm.id}.pdf`, await renderDocument([farm]));
    }
    return await zip.generateAsync({ type: "blob" });
  } finally {
    images.forEach(({ url }) => URL.revokeObjectURL(url));
  }
};

scope.onmessage = async (event: MessageEvent<ReportPdfMessage>) => {
  const { id, request } = event.data;
  let response: ReportPdfResponse;
  try {
    response = { id, blob: await render(request) };
  } catch (error) {
    console.error("Error rendering the report", error);
    response = {
      id,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  scope.postMessage(response);
};
