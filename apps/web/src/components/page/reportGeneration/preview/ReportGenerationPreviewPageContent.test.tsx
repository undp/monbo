import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { ReportContext } from "@/context/ReportContext";
import { createTestI18n } from "@/test/i18n";
import { ReportGenerationPreviewPageContent } from "./ReportGenerationPreviewPageContent";

type ReportContextValue = React.ContextType<typeof ReportContext>;

const BASE: ReportContextValue = {
  previewUrl: null,
  isPreviewLoading: false,
  previewFailed: false,
  retryPreview: vi.fn(),
  getCompleteReport: vi.fn(),
  getSeparatedReports: vi.fn(),
  isLarge: false,
  farmCount: 0,
  satelliteLimit: null,
  buildLargeReportZip: vi.fn(),
};

const renderPreview = async (value: Partial<ReportContextValue>) => {
  const i18n = await createTestI18n("es");
  render(
    <I18nextProvider i18n={i18n}>
      <ReportContext.Provider value={{ ...BASE, ...value }}>
        <ReportGenerationPreviewPageContent />
      </ReportContext.Provider>
    </I18nextProvider>
  );
};

const notices = () => screen.queryAllByRole("alert").map((a) => a.textContent);

describe("ReportGenerationPreviewPageContent notice", () => {
  it("joins the large report and the missing satellite background in one notice", async () => {
    await renderPreview({ isLarge: true, farmCount: 495, satelliteLimit: 90 });

    expect(notices()).toEqual([
      "Este reporte tiene 495 fincas: se descarga como un ZIP con un PDF por finca y los mapas se generan sin la imagen satelital de fondo. La vista previa muestra la primera finca.",
    ]);
  });

  it("only mentions the ZIP when the maps have the satellite background", async () => {
    await renderPreview({ isLarge: true, farmCount: 495, satelliteLimit: null });

    expect(notices()).toEqual([
      "Este reporte tiene 495 fincas: se descarga como un ZIP con un PDF por finca. La vista previa muestra la primera finca.",
    ]);
  });

  it("only mentions the satellite background for a small report above the limit", async () => {
    await renderPreview({ isLarge: false, farmCount: 95, satelliteLimit: 90 });

    expect(notices()).toEqual([
      "Este reporte tiene más de 90 fincas: los mapas se generan sin la imagen satelital de fondo.",
    ]);
  });

  it("shows no notice for a small report with the satellite background", async () => {
    await renderPreview({ isLarge: false, farmCount: 20, satelliteLimit: null });

    expect(notices()).toEqual([]);
  });
});
