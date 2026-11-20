import type { SetStateAction } from "react";
import { act } from "@testing-library/react";
import { describe, expect, it, type Mock } from "vitest";
import type { DataContextValue } from "@/context/DataContext";
import { makeFarm, makeMap, makeMapResults } from "@/test/factories";
import { router } from "@/test/navigation";
import { makeDataContext, renderHookWithData } from "@/test/renderWithData";
import { useCountryChange } from "./useCountryChange";

/** The value a setter spy was given, applied to `prev` when it is an updater. */
const nextState = <T,>(setter: unknown, prev: T): T => {
  const [action] = (setter as Mock<(action: SetStateAction<T>) => void>).mock.calls[0];
  return typeof action === "function" ? (action as (prev: T) => T)(prev) : action;
};

const beforeAnalysis = (overrides: Partial<DataContextValue> = {}) =>
  makeDataContext({ selectedCountry: "CR", ...overrides });

describe("useCountryChange", () => {
  it("only navigates when the country doesn't change", async () => {
    const { result, context } = await renderHookWithData(useCountryChange, {
      context: beforeAnalysis(),
    });

    act(() => result.current.requestCountryChange("CR", { navigateTo: "/polygons-validation" }));

    expect(router.push).toHaveBeenCalledWith("/polygons-validation");
    expect(context.setSelectedCountry).not.toHaveBeenCalled();
  });

  it("changes at once before an analysis, keeping the farms", async () => {
    const { result, context } = await renderHookWithData(useCountryChange, {
      context: beforeAnalysis(),
    });

    act(() => result.current.requestCountryChange("PE"));

    expect(context.setSelectedCountry).toHaveBeenCalledWith("PE");
    expect(result.current.pendingCountry).toBeNull();
    expect(router.push).not.toHaveBeenCalled();

    const map = makeMap();
    expect(
      nextState(context.setTerritorialAnalysisParams, {
        polygonsSubset: "valid" as const,
        selectedMaps: [map],
      })
    ).toEqual({ polygonsSubset: "valid", selectedMaps: [] });
    // The layers being chosen on stage 2 were the other country's.
    expect(context.setAnalysisDraft).toHaveBeenCalledWith(null);
    expect(
      nextState(context.setFarmsData, [makeFarm({ country: "CR" })])?.map((f) => f.country)
    ).toEqual(["PE"]);
    expect(nextState(context.setFarmsData, null)).toBeNull();

    const report = nextState(context.setReportGenerationParams, {
      ...context.reportGenerationParams,
      seeded: true,
      selectedMaps: [map],
      selectedFarms: [makeFarm({ country: "CR" })],
    });
    expect(report.selectedMaps).toEqual([]);
    expect(report.seeded).toBe(false);
    expect(report.selectedFarms.map((f) => f.country)).toEqual(["PE"]);
  });

  it("navigates after changing when asked to", async () => {
    const { result } = await renderHookWithData(useCountryChange, {
      context: beforeAnalysis(),
    });

    act(() => result.current.requestCountryChange("PE", { navigateTo: "/polygons-validation" }));

    expect(router.push).toHaveBeenCalledWith("/polygons-validation");
  });

  describe("after an analysis", () => {
    const afterAnalysis = () =>
      beforeAnalysis({ territorialAnalysisResults: [makeMapResults(1, { F01: 0 })] });

    it("waits for the user to confirm a restart", async () => {
      const { result, context } = await renderHookWithData(useCountryChange, {
        context: afterAnalysis(),
      });

      act(() => result.current.requestCountryChange("PE", { navigateTo: "/polygons-validation" }));

      expect(result.current.pendingCountry).toBe("PE");
      expect(context.setSelectedCountry).not.toHaveBeenCalled();
      expect(context.setFarmsData).not.toHaveBeenCalled();
      expect(router.push).not.toHaveBeenCalled();
    });

    it("restarts on confirmation and goes to the start page", async () => {
      const { result, context } = await renderHookWithData(useCountryChange, {
        context: afterAnalysis(),
      });

      act(() => result.current.requestCountryChange("PE"));
      act(() => result.current.confirmRestart());

      expect(context.resetAnalysis).toHaveBeenCalledOnce();
      expect(context.setSelectedCountry).toHaveBeenCalledWith("PE");
      expect(router.push).toHaveBeenCalledWith("/");
      expect(result.current.pendingCountry).toBeNull();
    });

    it("keeps everything when the restart is cancelled", async () => {
      const { result, context } = await renderHookWithData(useCountryChange, {
        context: afterAnalysis(),
      });

      act(() => result.current.requestCountryChange("PE"));
      act(() => result.current.cancelRestart());

      expect(result.current.pendingCountry).toBeNull();
      expect(context.resetAnalysis).not.toHaveBeenCalled();
      expect(context.setSelectedCountry).not.toHaveBeenCalled();
    });

    it("does nothing on confirmation without a pending country", async () => {
      const { result, context } = await renderHookWithData(useCountryChange, {
        context: afterAnalysis(),
      });

      act(() => result.current.confirmRestart());

      expect(context.resetAnalysis).not.toHaveBeenCalled();
      expect(router.push).not.toHaveBeenCalled();
    });
  });
});
