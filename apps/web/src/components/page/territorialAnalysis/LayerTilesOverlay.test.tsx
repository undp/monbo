import { render } from "@testing-library/react";
import { GoogleMapsContext } from "@vis.gl/react-google-maps";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataContext } from "@/context/DataContext";
import { makeMap } from "@/test/factories";
import { makeDataContext } from "@/test/renderWithData";
import { LayerTilesOverlay } from "./LayerTilesOverlay";

/** Stand-in for google.maps.ImageMapType: keeps the options it was built with. */
class FakeImageMapType {
  options: google.maps.ImageMapTypeOptions;
  constructor(options: google.maps.ImageMapTypeOptions) {
    this.options = options;
  }
}

/** The map's overlays, as a working Maps API keeps them. */
const workingOverlays = () => {
  const overlays: FakeImageMapType[] = [];
  return {
    overlays,
    overlayMapTypes: {
      push: (overlay: FakeImageMapType) => overlays.push(overlay),
      getArray: () => overlays,
      removeAt: (index: number) => overlays.splice(index, 1),
    },
  };
};

/** The map's overlays once Google rejected the key: every method is `function(){}`. */
const disabledOverlays = () => ({
  push: vi.fn(() => undefined),
  getArray: vi.fn(() => undefined),
  removeAt: vi.fn(() => undefined),
});

/** The overlay for layer 7 of Colombia at `version`, on a map with those overlays. */
const overlayOn = (overlayMapTypes: object, version: number) => {
  const context = makeDataContext({
    selectedCountry: "CO",
    territorialAnalysisParams: {
      polygonsSubset: "all",
      selectedMaps: [makeMap({ id: 7, version })],
    },
  });
  const map = { overlayMapTypes } as unknown as google.maps.Map;
  return (
    <DataContext.Provider value={context}>
      <GoogleMapsContext.Provider value={{ map }}>
        <LayerTilesOverlay />
      </GoogleMapsContext.Provider>
    </DataContext.Provider>
  );
};

beforeEach(() => {
  vi.stubGlobal("google", {
    maps: { ImageMapType: FakeImageMapType, Size: class {} },
  });
});

describe("LayerTilesOverlay", () => {
  it("adds the layer's tiles on mount and removes them on unmount", () => {
    const { overlays, overlayMapTypes } = workingOverlays();
    const { unmount } = render(overlayOn(overlayMapTypes, 3));

    expect(overlays).toHaveLength(1);
    const { getTileUrl } = overlays[0].options;
    expect(getTileUrl?.({ x: 1, y: 2 } as google.maps.Point, 12)).toBe(
      "http://api.test/layer_analysis/tiles/CO/7/dynamic/12/1/2.png?v=3"
    );
    // The tiles start at zoom 12
    expect(getTileUrl?.({ x: 1, y: 2 } as google.maps.Point, 11)).toBeNull();

    unmount();

    expect(overlays).toHaveLength(0);
  });

  it("replaces the overlay when the layer changes", () => {
    const { overlays, overlayMapTypes } = workingOverlays();
    const { rerender } = render(overlayOn(overlayMapTypes, 3));
    const first = overlays[0];

    rerender(overlayOn(overlayMapTypes, 4));

    expect(overlays).toHaveLength(1);
    expect(overlays[0]).not.toBe(first);
  });

  it("doesn't throw when unmounted after Google disabled the Maps API", () => {
    // A missing or invalid key: Google turns its methods into no-ops returning undefined
    const overlayMapTypes = disabledOverlays();
    const { unmount } = render(overlayOn(overlayMapTypes, 3));

    expect(() => unmount()).not.toThrow();
    expect(overlayMapTypes.removeAt).not.toHaveBeenCalled();
  });
});
