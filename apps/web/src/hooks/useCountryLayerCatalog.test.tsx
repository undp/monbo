import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMaps } from "@/api/layerAnalysis";
import { getLayerCategories } from "@/api/layerCategories";
import { deferred } from "@/test/deferred";
import { makeLayerCategory, makeMap } from "@/test/factories";
import { useCountryLayerCatalog } from "./useCountryLayerCatalog";

vi.mock("@/api/layerAnalysis", () => ({ getMaps: vi.fn() }));
vi.mock("@/api/layerCategories", () => ({ getLayerCategories: vi.fn() }));

const deforestation = makeLayerCategory();
const ideam = makeMap({ id: 3, name: "IDEAM", country: "CO" });
const maate = makeMap({ id: 2, name: "MAATE", country: "EC" });

beforeEach(() => {
  vi.mocked(getLayerCategories).mockReset().mockResolvedValue([deforestation]);
  vi.mocked(getMaps).mockReset().mockImplementation(async (_language, country) =>
    country === "CO" ? [ideam] : [maate]
  );
});

describe("useCountryLayerCatalog", () => {
  it("fetches the country's categories and layers in the page's language", async () => {
    const { result } = renderHook(() => useCountryLayerCatalog("CO", "es"));

    expect(result.current.status).toBe("loading");
    await waitFor(() =>
      expect(result.current).toEqual({
        status: "ready",
        catalog: { categories: [deforestation], maps: [ideam] },
      })
    );
    expect(getLayerCategories).toHaveBeenCalledWith("CO");
    expect(getMaps).toHaveBeenCalledWith("es", "CO");
  });

  it("is idle without a country", () => {
    const { result } = renderHook(() => useCountryLayerCatalog(null, "es"));

    expect(result.current).toEqual({ status: "idle" });
    expect(getMaps).not.toHaveBeenCalled();
  });

  it("fetches a country once per language", async () => {
    const { result, rerender } = renderHook(
      ({ country }) => useCountryLayerCatalog(country, "es"),
      { initialProps: { country: "CO" } }
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    rerender({ country: "EC" });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    rerender({ country: "CO" });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(getMaps).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({ catalog: { maps: [ideam] } });
  });

  it("fetches again when the page opens again", async () => {
    const first = renderHook(() => useCountryLayerCatalog("CO", "es"));
    await waitFor(() => expect(first.result.current.status).toBe("ready"));
    first.unmount();

    const second = renderHook(() => useCountryLayerCatalog("CO", "es"));
    await waitFor(() => expect(second.result.current.status).toBe("ready"));

    expect(getMaps).toHaveBeenCalledTimes(2);
  });

  it("drops the response of a country no longer selected", async () => {
    const slow = deferred<ReturnType<typeof makeMap>[]>();
    vi.mocked(getMaps).mockImplementation((_language, country) =>
      country === "CO" ? slow.promise : Promise.resolve([maate])
    );
    const { result, rerender } = renderHook(
      ({ country }) => useCountryLayerCatalog(country, "es"),
      { initialProps: { country: "CO" } }
    );
    rerender({ country: "EC" });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(async () => slow.resolve([ideam]));

    expect(result.current).toMatchObject({ catalog: { maps: [maate] } });
  });

  it("reports and logs a failure, and fetches again on retry", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("down");
    vi.mocked(getLayerCategories).mockRejectedValueOnce(failure);
    const { result } = renderHook(() => useCountryLayerCatalog("CO", "es"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(consoleError).toHaveBeenCalledWith("Error loading the layers of CO:", failure);
    consoleError.mockRestore();

    act(() => {
      if (result.current.status === "error") result.current.retry();
    });

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(getLayerCategories).toHaveBeenCalledTimes(2);
  });
});
