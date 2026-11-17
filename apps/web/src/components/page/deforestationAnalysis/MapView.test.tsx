import { fireEvent, render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setRuntimeConfig } from "@/config/runtime";
import { DataContext } from "@/context/DataContext";
import { makeFarm, makeMap, makeMapResults } from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import { setSearchParams } from "@/test/navigation";
import { makeDataContext } from "@/test/renderWithData";
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
  deforestationAnalysisParams: {
    polygonsSubset: "all",
    selectedMaps: [makeMap({ id: 1 }), makeMap({ id: 2, name: "TMF" })],
  },
  deforestationAnalysisResults: [
    // Layer 1: F05 lies outside the layer's coverage (null).
    makeMapResults(1, { F01: 0, F02: 0.005, F03: 0.02, F04: 0.05, F05: null }),
    // Layer 2: every farm has a result.
    makeMapResults(2, { F01: 0, F02: 0, F03: 0, F04: 0.1, F05: 0 }),
  ],
});

const renderMapView = async () => {
  const i18n = await createTestI18n("es");
  // A new element each time: re-rendering the same one would let React skip MapView.
  const ui = () => (
    <I18nextProvider i18n={i18n}>
      <DataContext.Provider value={context}>
        <MapView />
      </DataContext.Provider>
    </I18nextProvider>
  );
  const rendered = render(ui());
  return { ...rendered, rerender: () => rendered.rerender(ui()) };
};

/** The farm ids listed in a tab panel, sorted. */
const listedFarms = (panel: HTMLElement) =>
  within(panel)
    .queryAllByText(/^Ana - F\d+/)
    .map((element) => element.textContent?.match(/^Ana - (F\d{2})/)?.[1])
    .sort();

beforeEach(() => {
  setRuntimeConfig({
    deforestationThresholdPercentage: 2,
    overlapThresholdPercentage: 1,
  });
  setSearchParams({ selectedMap: "1" });
});

describe("MapView", () => {
  it("groups the farms with the shared classification, with no-data farms apart", async () => {
    await renderMapView();

    expect(screen.getByRole("tab", { name: "Deforestados (1)" })).toBeTruthy();
    // 0, 0.005 and 0.02 are at or below the 2% threshold.
    fireEvent.click(screen.getByRole("tab", { name: "Libre Def. (3)" }));
    expect(listedFarms(screen.getByRole("tabpanel"))).toEqual([
      "F01",
      "F02",
      "F03",
    ]);

    // A null result is "no data", never deforestation-free.
    fireEvent.click(screen.getByRole("tab", { name: "Sin dato (1)" }));
    expect(listedFarms(screen.getByRole("tabpanel"))).toEqual(["F05"]);
  });

  it("hides the no-data tab when every farm has a result", async () => {
    setSearchParams({ selectedMap: "2" });
    await renderMapView();

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Libre Def. (4)" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Sin dato/ })).toBeNull();
  });

  it("survives switching to a layer without no-data farms from the no-data tab", async () => {
    const { rerender } = await renderMapView();
    fireEvent.click(screen.getByRole("tab", { name: "Sin dato (1)" }));

    // The layer travels in ?selectedMap=, so MapView re-renders, not remounts.
    setSearchParams({ selectedMap: "2" });
    rerender();

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(
      screen
        .getByRole("tab", { name: "Deforestados (1)" })
        .getAttribute("aria-selected")
    ).toBe("true");
  });
});
