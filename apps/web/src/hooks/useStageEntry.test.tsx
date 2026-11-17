import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeFarm, makeMapResults, makeValidationResults } from "@/test/factories";
import { router } from "@/test/navigation";
import { makeDataContext, renderHookWithData } from "@/test/renderWithData";
import { useStageEntry } from "./useStageEntry";

const withFarms = makeDataContext({ farmsData: [makeFarm()] });

describe("useStageEntry", () => {
  it.each([
    [1, "/polygons-validation/upload-data"],
    [2, "/deforestation-analysis/upload-data"],
  ] as const)("opens stage %s's upload page without farms", async (stage, path) => {
    const { result } = await renderHookWithData(() => useStageEntry(stage));

    act(() => result.current.enter());

    expect(router.push).toHaveBeenCalledWith(path);
    expect(result.current.modal.isOpen).toBe(false);
  });

  it("asks first when farms are loaded", async () => {
    const { result } = await renderHookWithData(() => useStageEntry(1), {
      context: withFarms,
    });

    act(() => result.current.enter());

    expect(router.push).not.toHaveBeenCalled();
    expect(result.current.modal.isOpen).toBe(true);
    expect(result.current.modal.title).toBe(
      "Se utilizarán los mismos datos para validar"
    );
  });

  it("continues with the same data", async () => {
    const { result } = await renderHookWithData(() => useStageEntry(2), {
      context: withFarms,
    });

    act(() => result.current.enter());
    act(() => result.current.modal.actions[1].handler());

    expect(router.push).toHaveBeenCalledWith("/deforestation-analysis");
  });

  it("drops the data to upload new data", async () => {
    const { result, context } = await renderHookWithData(() => useStageEntry(1), {
      context: withFarms,
    });

    act(() => result.current.enter());
    act(() => result.current.modal.actions[0].handler());

    expect(context.resetAnalysis).toHaveBeenCalledOnce();
    expect(router.push).toHaveBeenCalledWith("/polygons-validation/upload-data");
  });

  it("can't continue into the validation after a direct analysis", async () => {
    const { result } = await renderHookWithData(() => useStageEntry(1), {
      context: makeDataContext({
        farmsData: [makeFarm()],
        deforestationAnalysisResults: [makeMapResults(1, {})],
      }),
    });

    expect(result.current.modal.actions[1].disabled).toBe(true);
  });

  it("can't continue into the analysis with only a validation", async () => {
    const { result } = await renderHookWithData(() => useStageEntry(2), {
      context: makeDataContext({
        farmsData: [makeFarm()],
        polygonsValidationResults: makeValidationResults({}),
      }),
    });

    expect(result.current.modal.actions[1].disabled).toBe(true);
  });
});
