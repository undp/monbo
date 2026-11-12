import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { DataContext } from "@/context/DataContext";
import { sendUsageEvent } from "@/api/usageEvents";
import { createTestI18n } from "@/test/i18n";
import { makeDataContext } from "@/test/renderWithData";
import { makeFarm } from "@/test/factories";
import { router } from "@/test/navigation";
import { PageFooter } from "./PageFooter";

vi.mock("@/api/usageEvents", () => ({ sendUsageEvent: vi.fn() }));

const renderFooter = async (farms: number) => {
  const i18n = await createTestI18n("en");
  const data = makeDataContext({
    selectedCountry: "PE",
    reportGenerationParams: {
      initialFarmSelection: "select",
      selectedMaps: [],
      selectedFarms: Array.from({ length: farms }, (_, i) =>
        makeFarm({ id: `farm-${i}` })
      ),
      downloadType: null,
    },
  });
  render(
    <I18nextProvider i18n={i18n}>
      <DataContext.Provider value={data}>
        <PageFooter />
      </DataContext.Provider>
    </I18nextProvider>
  );
};

describe("Generate report", () => {
  it("reports the request with the selected farms", async () => {
    await renderFooter(5);
    fireEvent.click(screen.getByRole("button", { name: "Generate report" }));
    expect(sendUsageEvent).toHaveBeenCalledExactlyOnceWith(
      { type: "report_requested", outcome: "ok", farms: 5 },
      "PE"
    );
    expect(router.push).toHaveBeenCalledWith("/report-generation/preview");
  });

  it("reports nothing without a selected farm", async () => {
    await renderFooter(0);
    fireEvent.click(screen.getByRole("button", { name: "Generate report" }));
    expect(sendUsageEvent).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});
