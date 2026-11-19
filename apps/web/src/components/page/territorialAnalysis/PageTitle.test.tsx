import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { DataContext } from "@/context/DataContext";
import { makeFarm, makeMap, makeMapResults } from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import { setPathname } from "@/test/navigation";
import { makeDataContext } from "@/test/renderWithData";
import { PageTitle } from "./PageTitle";

describe("PageTitle", () => {
  it("names the stage, says what was crossed, and holds the page's actions", async () => {
    setPathname("/territorial-analysis");
    const i18n = await createTestI18n("es");
    const farms = ["F01", "F02"].map((id) => makeFarm({ id }));
    render(
      <I18nextProvider i18n={i18n}>
        <DataContext.Provider
          value={makeDataContext({
            selectedCountry: "CO",
            farmsData: farms,
            territorialAnalysisParams: {
              polygonsSubset: "all",
              selectedMaps: [makeMap({ id: 1 })],
            },
            territorialAnalysisResults: [makeMapResults(1, { F01: 0, F02: 0 })],
          })}
        >
          <PageTitle actions={<button>Cambiar capas</button>} />
        </DataContext.Provider>
      </I18nextProvider>
    );

    expect(screen.getByText("Etapa 2 de 3")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Resultados del análisis territorial" })
    ).toBeTruthy();
    expect(
      screen.getByText("2 polígonos cruzados con 1 capa de Colombia.")
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cambiar capas" })).toBeTruthy();
  });
});
