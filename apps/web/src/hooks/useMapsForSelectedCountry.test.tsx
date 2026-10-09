import { describe, expect, it } from "vitest";
import { makeMap } from "@/test/factories";
import { makeDataContext, renderHookWithData } from "@/test/renderWithData";
import { useMapsForSelectedCountry } from "./useMapsForSelectedCountry";

const gfw = makeMap({ id: 1, name: "Global Forest Watch", alias: "GFW", availableCountriesCodes: ["CR", "PE"] });
const tmf = makeMap({ id: 2, name: "TMF", alias: "TMF", availableCountriesCodes: ["PE"] });

describe("useMapsForSelectedCountry", () => {
  it("offers the layers that cover the selected country", async () => {
    const { result } = await renderHookWithData(
      () => useMapsForSelectedCountry({ selectedMaps: [tmf], availableMaps: [gfw, tmf] }),
      { context: makeDataContext({ selectedCountry: "CR" }) }
    );

    expect(result.current).toEqual({
      mapOptions: [{ id: "1", label: "Global Forest Watch (GFW)" }],
      selectedMapsOptions: [{ id: "2", label: "TMF" }],
    });
  });

  it("offers no layers before a country is chosen", async () => {
    const { result } = await renderHookWithData(() =>
      useMapsForSelectedCountry({ selectedMaps: [], availableMaps: [gfw, tmf] })
    );

    expect(result.current.mapOptions).toEqual([]);
  });
});
