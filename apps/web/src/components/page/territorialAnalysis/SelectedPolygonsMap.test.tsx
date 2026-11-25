import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setRuntimeConfig } from "@/config/runtime";
import { DataContext } from "@/context/DataContext";
import type { FarmData } from "@/interfaces/Farm";
import { makeCategory, makeFarm, makeMap, makeMapResults } from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import { setSearchParams } from "@/test/navigation";
import { makeDataContext } from "@/test/renderWithData";
import { SelectedPolygonsMap } from "./SelectedPolygonsMap";

// Leaflet doesn't run in jsdom; the details card is what's under test.
vi.mock("@/components/reusable/Map", () => ({
  Map: () => <div data-testid="map" />,
}));
vi.mock("./LayerTilesOverlay", () => ({ LayerTilesOverlay: () => null }));

/** The map with `farm` selected, so its details card is open. */
const renderCard = async (farm: FarmData) => {
  const i18n = await createTestI18n("es");
  const context = makeDataContext({
    farmsData: [farm],
    territorialAnalysisParams: { polygonsSubset: "all", selectedMaps: [makeMap({ id: 1 })] },
    territorialAnalysisResults: [makeMapResults(1, { [farm.id]: null })],
    availableCategories: [makeCategory()],
  });
  render(
    <I18nextProvider i18n={i18n}>
      <DataContext.Provider value={context}>
        <SelectedPolygonsMap
          farmsData={[farm]}
          allPolygonsSelected
          selectedPolygonIdAtMap={farm.id}
          setSelectedPolygonIdAtMap={() => {}}
        />
      </DataContext.Provider>
    </I18nextProvider>
  );
};

/** The value next to the card's "Área:" label. */
const surface = () => screen.getByText(/^Área/).nextElementSibling?.textContent;

beforeEach(() => {
  setRuntimeConfig({ deforestationThresholdPercentage: 2, overlapThresholdPercentage: 1 });
  setSearchParams({ selectedMap: "1" });
});

describe("SelectedPolygonsMap", () => {
  it("shows the farm's area in its details card", async () => {
    await renderCard(makeFarm({ polygon: { ...makeFarm().polygon, area: 12345 } }));

    expect(surface()).toBe("1,23 ha");
  });

  it("shows a dash, not -1 m², for an area that could not be computed", async () => {
    await renderCard(makeFarm({ polygon: { ...makeFarm().polygon, area: -1 } }));

    expect(surface()).toBe("—");
  });
});
