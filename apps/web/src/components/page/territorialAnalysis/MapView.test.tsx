import { fireEvent, render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { ThemeProvider } from "@mui/material/styles";
import theme from "@/config/theme";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setRuntimeConfig } from "@/config/runtime";
import { DataContext } from "@/context/DataContext";
import {
  makeCategory,
  makeFarm,
  makeFrontierCategory,
  makeMap,
  makeMapResults,
} from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import { setSearchParams } from "@/test/navigation";
import { makeDataContext } from "@/test/renderWithData";
import { SENTINEL_RGB, themeWithResultColor } from "@/test/resultTheme";
import { MapView } from "./MapView";

// Leaflet doesn't run in jsdom; the groups and their counts are what's under test.
vi.mock("./SelectedPolygonsMap", () => ({
  SelectedPolygonsMap: () => null,
}));

const farms = ["F01", "F02", "F03", "F04", "F05"].map((id) =>
  makeFarm({ id, producer: "Ana" })
);

const context = makeDataContext({
  farmsData: farms,
  territorialAnalysisParams: {
    polygonsSubset: "all",
    selectedMaps: [
      makeMap({ id: 1 }),
      makeMap({ id: 2, name: "TMF" }),
      makeMap({ id: 5, name: "UPRA", categoryId: "agricultural_frontier" }),
      makeMap({ id: 9, name: "Gone", categoryId: "gone" }),
    ],
  },
  territorialAnalysisResults: [
    // Layer 1: F05 lies outside the layer's coverage (null).
    makeMapResults(1, { F01: 0, F02: 0.005, F03: 0.02, F04: 0.05, F05: null }),
    // Layer 2: every farm has a result.
    makeMapResults(2, { F01: 0, F02: 0, F03: 0, F04: 0.1, F05: 0 }),
    // Layer 5 (frontier, required, 5%): F02 is 18% outside it.
    makeMapResults(5, { F01: 1, F02: 0.82, F03: 0.96, F04: 1, F05: 1 }),
    // Layer 9: its category is no longer listed.
    makeMapResults(9, { F01: 0, F02: 0, F03: 0, F04: 0, F05: 0 }),
  ],
  // The global threshold (GET /config) is 50: the categories' must win.
  availableCategories: [
    makeCategory({ thresholdPercentage: 2 }),
    makeFrontierCategory(),
  ],
});

const renderMapView = async (appTheme = theme) => {
  const i18n = await createTestI18n("es");
  // A new element each time: re-rendering the same one would let React skip MapView.
  const ui = () => (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={appTheme}>
        <DataContext.Provider value={context}>
          <MapView />
        </DataContext.Provider>
      </ThemeProvider>
    </I18nextProvider>
  );
  const rendered = render(ui());
  return { ...rendered, rerender: () => rendered.rerender(ui()) };
};

/** The farm ids listed, sorted. */
const listedFarms = (panel: HTMLElement) =>
  within(panel)
    .queryAllByRole("radio")
    .map((row) => row.getAttribute("aria-label")?.match(/^(F\d{2}) Ana:/)?.[1])
    .filter(Boolean)
    .sort();

beforeEach(() => {
  setRuntimeConfig({
    deforestationThresholdPercentage: 50,
    overlapThresholdPercentage: 1,
  });
  setSearchParams({ selectedMap: "1" });
});

describe("MapView", () => {
  it("groups the farms with the shared classification, with no-data farms apart", async () => {
    await renderMapView();

    expect(screen.getByRole("button", { name: "Con deforestación (1)" })).toBeTruthy();
    // 0, 0.005 and 0.02 are at or below the 2% threshold.
    fireEvent.click(screen.getByRole("button", { name: "Libre de deforestación (3)" }));
    expect(listedFarms(screen.getByRole("radiogroup", { name: "Polígonos" }))).toEqual([
      "F01",
      "F02",
      "F03",
    ]);

    // A null result is "no data", never deforestation-free.
    fireEvent.click(screen.getByRole("button", { name: "Sin dato (1)" }));
    expect(listedFarms(screen.getByRole("radiogroup", { name: "Polígonos" }))).toEqual(["F05"]);
    // Its chip uses the tab's wording, not "N/D".
    expect(within(screen.getByRole("radiogroup", { name: "Polígonos" })).getByText("Sin dato")).toBeTruthy();
  });

  it("names and fills the groups with a required layer's category", async () => {
    setSearchParams({ selectedMap: "5" });
    await renderMapView();

    fireEvent.click(
      screen.getByRole("button", { name: "Fuera de la frontera agrícola (1)" })
    );
    expect(listedFarms(screen.getByRole("radiogroup", { name: "Polígonos" }))).toEqual(["F02"]);
    expect(
      screen.getByRole("button", { name: "Dentro de la frontera agrícola (4)" })
    ).toBeTruthy();
    // The legend names the layer's category.
    expect(screen.getByText("Frontera agrícola")).toBeTruthy();
  });

  it("puts every farm under no data when the layer's category is missing", async () => {
    setSearchParams({ selectedMap: "9" });
    await renderMapView();

    expect(screen.getByRole("button", { name: "Con observaciones (0)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sin observaciones (0)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sin dato (5)" })).toBeTruthy();
  });

  it("hides the no-data tab when every farm has a result", async () => {
    setSearchParams({ selectedMap: "2" });
    await renderMapView();

    expect(within(screen.getByRole("group", { name: "Filtrar por resultado" })).getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Libre de deforestación (4)" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sin dato/ })).toBeNull();
  });

  it("survives switching to a layer without no-data farms from the no-data tab", async () => {
    const { rerender } = await renderMapView();
    fireEvent.click(screen.getByRole("button", { name: "Sin dato (1)" }));

    // The layer travels in ?selectedMap=, so MapView re-renders, not remounts.
    setSearchParams({ selectedMap: "2" });
    rerender();

    expect(within(screen.getByRole("group", { name: "Filtrar por resultado" })).getAllByRole("button")).toHaveLength(2);
    expect(
      screen
        .getByRole("button", { name: "Con deforestación (1)" })
        .getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("announces each farm's result, and moves the choice with the arrow keys", async () => {
    await renderMapView();
    const list = screen.getByRole("radiogroup", { name: "Polígonos" });

    // The finding is in the row's name, as the pill shows it
    const f04 = within(list).getByRole("radio", { name: /^F04 Ana: / });
    expect(f04.getAttribute("aria-label")).toMatch(/^F04 Ana: 5\s?%$/);

    // One Tab stop: the chosen row ("Todos")
    const rows = within(list).getAllByRole("radio");
    expect(rows.map((row) => row.tabIndex)).toEqual([0, -1]);

    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(rows[1].getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(rows[1]);
    // The Tab stop follows the choice
    expect(rows.map((row) => row.tabIndex)).toEqual([-1, 0]);
    fireEvent.keyDown(list, { key: "ArrowUp" });
    expect(rows[0].getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(rows[0]);
  });

  it("paints the legend's swatch with the theme's layer tile color", async () => {
    setSearchParams({ selectedMap: "5" });
    await renderMapView(themeWithResultColor("layerTile"));

    const swatch = screen.getByText("Frontera agrícola").previousElementSibling!;
    expect(getComputedStyle(swatch).backgroundColor).toBe(SENTINEL_RGB);
  });

  it("keeps the legend's swatch red", async () => {
    setSearchParams({ selectedMap: "5" });
    await renderMapView();

    const swatch = screen.getByText("Frontera agrícola").previousElementSibling!;
    expect(getComputedStyle(swatch).backgroundColor).toBe("rgb(255, 0, 0)");
  });
});
