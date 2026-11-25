import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { DataContext } from "@/context/DataContext";
import { makeCategory, makeFarm, makeMap, makeMapResults } from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import { router, setPathname } from "@/test/navigation";
import { makeDataContext } from "@/test/renderWithData";
import { LayerResultsSection } from "./LayerResultsSection";

// The map needs a browser's map library: here it only has to be there.
vi.mock("./MapView", () => ({ MapView: () => <div>map</div> }));
vi.mock("./ResultsMapSelector", () => ({ ResultsMapSelector: () => null }));

const gfw = makeMap({ id: 1, alias: "GFW" });

const renderSection = async (view: "table" | "map") => {
  setPathname("/territorial-analysis");
  const i18n = await createTestI18n("es");
  render(
    <I18nextProvider i18n={i18n}>
      <DataContext.Provider
        value={makeDataContext({
          farmsData: [makeFarm({ id: "F01" })],
          territorialAnalysisParams: { polygonsSubset: "all", selectedMaps: [gfw] },
          territorialAnalysisResults: [makeMapResults(1, { F01: 0 })],
          availableCategories: [makeCategory()],
        })}
      >
        <LayerResultsSection view={view} />
      </DataContext.Provider>
    </I18nextProvider>
  );
};

describe("LayerResultsSection", () => {
  it("shows the table with the search, and switches to the map", async () => {
    await renderSection("table");

    expect(screen.getByRole("region", { name: "Resultado por polígono y capa" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Buscar por polígono o productor")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ver en el mapa" }));
    expect(router.push).toHaveBeenCalledWith("/territorial-analysis?view=map");
  });

  it("shows the map and switches back to the table", async () => {
    await renderSection("map");

    expect(screen.getByText("map")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Ver tabla" }));
    expect(router.push).toHaveBeenCalledWith("/territorial-analysis?view=table");
  });

  it("keeps the header in view while the table scrolls inside its frame", async () => {
    await renderSection("table");

    const frame = screen.getByTestId("results-frame");
    const container = frame.querySelector(".MuiTableContainer-root")!;
    expect(getComputedStyle(frame).overflow).toBe("auto");
    expect(getComputedStyle(container).overflowX).toBe("visible");
    expect(getComputedStyle(container).overflowY).toBe("visible");
  });
});
