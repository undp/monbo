import { describe, expect, it } from "vitest";
import { makeDataContext, renderHookWithData } from "@/test/renderWithData";
import { useAvailableCountries } from "./useAvailableCountries";

const loaded = makeDataContext({
  availableCountries: ["PE", "DE", "CR", "XX"],
  availableCountriesLoaded: true,
});

describe("useAvailableCountries", () => {
  it("names and sorts the countries in Spanish", async () => {
    const { result } = await renderHookWithData(useAvailableCountries, {
      context: loaded,
      locale: "es",
    });

    expect(result.current.countries).toEqual([
      { code: "DE", name: "Alemania" },
      { code: "CR", name: "Costa Rica" },
      { code: "PE", name: "Perú" },
      // An unknown code keeps the code as its name.
      { code: "XX", name: "XX" },
    ]);
  });

  it("names and sorts the countries in English", async () => {
    const { result } = await renderHookWithData(useAvailableCountries, {
      context: loaded,
      locale: "en",
    });

    expect(result.current.countries.map(({ name }) => name)).toEqual([
      "Costa Rica",
      "Germany",
      "Peru",
      "XX",
    ]);
  });

  it("is loading until the first list arrives", async () => {
    const { result } = await renderHookWithData(useAvailableCountries);

    expect(result.current).toEqual({ countries: [], loading: true, error: false });
  });

  it("reports an error only while no list has arrived", async () => {
    const failed = await renderHookWithData(useAvailableCountries, {
      context: makeDataContext({ availableCountriesError: true }),
    });
    expect(failed.result.current).toMatchObject({ loading: false, error: true });

    const refreshFailed = await renderHookWithData(useAvailableCountries, {
      context: makeDataContext({
        availableCountries: ["CR"],
        availableCountriesLoaded: true,
        availableCountriesError: true,
      }),
    });
    expect(refreshFailed.result.current).toMatchObject({ loading: false, error: false });
  });
});
