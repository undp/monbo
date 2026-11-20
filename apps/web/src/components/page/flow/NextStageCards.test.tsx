import { fireEvent, render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { DataContext } from "@/context/DataContext";
import { createTestI18n } from "@/test/i18n";
import { makeDataContext } from "@/test/renderWithData";
import { router } from "@/test/navigation";
import { PageFooter as ValidationPageFooter } from "@/components/page/polygonsValidation/PageFooter";
import { PageFooter as AnalysisPageFooter } from "@/components/page/territorialAnalysis/PageFooter";

const renderCard = async (card: React.ReactNode) => {
  const i18n = await createTestI18n("es");
  render(
    <I18nextProvider i18n={i18n}>
      <DataContext.Provider value={makeDataContext({ selectedCountry: "EC" })}>
        {card}
      </DataContext.Provider>
    </I18nextProvider>
  );
};

const card = () => screen.getByRole("region", { name: "Siguiente etapa" });

describe("next-stage cards", () => {
  it("closes stage 1 with the territorial analysis, going to its page", async () => {
    await renderCard(<ValidationPageFooter />);

    expect(within(card()).getByRole("heading", { name: "Análisis territorial" })).toBeTruthy();
    expect(within(card()).getByText(/Ecuador/)).toBeTruthy();

    fireEvent.click(within(card()).getByRole("button", { name: "Continuar" }));
    // No modal: the stage 2 page asks for the polygon subset and the layers.
    expect(router.push).toHaveBeenCalledWith("/territorial-analysis/layers");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes stage 2 with the report, going straight to its page", async () => {
    await renderCard(<AnalysisPageFooter />);

    expect(within(card()).getByRole("heading", { name: "Reporte" })).toBeTruthy();

    fireEvent.click(within(card()).getByRole("button", { name: "Continuar" }));
    expect(router.push).toHaveBeenCalledWith("/report-generation");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
