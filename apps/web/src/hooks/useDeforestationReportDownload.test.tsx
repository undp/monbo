import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataContext } from "@/context/DataContext";
import { ReportContext } from "@/context/ReportContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { MapLayerChangedError } from "@/api/deforestationAnalysis";
import { sendUsageEvent } from "@/api/usageEvents";
import { ReportPdfWorkerTerminatedError } from "@/workers/reportPdfClient";
import { createTestI18n } from "@/test/i18n";
import { makeDataContext } from "@/test/renderWithData";
import { makeFarm } from "@/test/factories";
import { useDeforestationReportDownload } from "./useDeforestationReportDownload";

vi.mock("@/api/usageEvents", () => ({ sendUsageEvent: vi.fn() }));

type ReportContextValue = React.ContextType<typeof ReportContext>;

const openSnackbar = vi.fn();
const report = {
  getCompleteReport: vi.fn(),
  getSeparatedReports: vi.fn(),
  buildLargeReportZip: vi.fn(),
};

const renderDownload = async () => {
  const i18n = await createTestI18n("en");
  const data = makeDataContext({
    selectedCountry: "CR",
    reportGenerationParams: {
      initialFarmSelection: "select",
      selectedMaps: [],
      selectedFarms: [makeFarm({ id: "a" }), makeFarm({ id: "b" })],
      downloadType: null,
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <SnackbarContext.Provider value={{ openSnackbar }}>
        <DataContext.Provider value={data}>
          <ReportContext.Provider value={report as unknown as ReportContextValue}>
            {children}
          </ReportContext.Provider>
        </DataContext.Provider>
      </SnackbarContext.Provider>
    </I18nextProvider>
  );
  return { ...renderHook(() => useDeforestationReportDownload(), { wrapper }), data };
};

const downloaded = (format: "pdf" | "zip", outcome: "ok" | "error") => [
  { type: "report_downloaded", outcome, format, farms: 2 },
  "CR",
];

beforeEach(() => {
  report.getCompleteReport.mockResolvedValue(new Blob(["pdf"]));
  report.getSeparatedReports.mockResolvedValue(new Blob(["zip"]));
  report.buildLargeReportZip.mockResolvedValue(new Blob(["zip"]));
});

describe("useDeforestationReportDownload usage events", () => {
  it("reports the complete report as one PDF", async () => {
    const { result } = await renderDownload();
    await act(() => result.current.downloadCompleteReport());
    expect(sendUsageEvent).toHaveBeenCalledExactlyOnceWith(...downloaded("pdf", "ok"));
  });

  it("reports the separated reports as a ZIP", async () => {
    const { result } = await renderDownload();
    await act(() => result.current.downloadSeparatedReports());
    expect(sendUsageEvent).toHaveBeenCalledExactlyOnceWith(...downloaded("zip", "ok"));
  });

  it("reports the large report as a ZIP", async () => {
    const { result } = await renderDownload();
    await act(() => result.current.downloadLargeReport(vi.fn()));
    expect(sendUsageEvent).toHaveBeenCalledExactlyOnceWith(...downloaded("zip", "ok"));
  });

  it("reports a failed download shown to the user", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    report.getCompleteReport.mockRejectedValue(new Error("render failed"));
    const { result } = await renderDownload();
    await act(() => result.current.downloadCompleteReport());
    expect(openSnackbar).toHaveBeenCalled();
    expect(sendUsageEvent).toHaveBeenCalledExactlyOnceWith(
      ...downloaded("pdf", "error")
    );
  });

  it("reports nothing when the user cancels a large report", async () => {
    const controller = new AbortController();
    report.buildLargeReportZip.mockImplementation(async () => {
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    });
    const { result } = await renderDownload();
    await act(() => result.current.downloadLargeReport(vi.fn(), controller.signal));
    expect(sendUsageEvent).not.toHaveBeenCalled();
  });

  it("reports nothing when the user leaves the page", async () => {
    report.getSeparatedReports.mockRejectedValue(new ReportPdfWorkerTerminatedError());
    const { result } = await renderDownload();
    await act(() => result.current.downloadSeparatedReports());
    expect(sendUsageEvent).not.toHaveBeenCalled();
  });

  it("reports nothing when a layer changed", async () => {
    report.getCompleteReport.mockRejectedValue(new MapLayerChangedError());
    const { result, data } = await renderDownload();
    await act(() => result.current.downloadCompleteReport());
    expect(data.invalidateAnalysis).toHaveBeenCalled();
    expect(sendUsageEvent).not.toHaveBeenCalled();
  });
});
