import { describe, expect, it } from "vitest";
import { makeMapResults, makeValidationResults } from "@/test/factories";
import { setPathname } from "@/test/navigation";
import { makeDataContext, renderHookWithData } from "@/test/renderWithData";
import { useFlowStages } from "./useFlowStages";

const states = (stages: { state: string }[]) => stages.map(({ state }) => state);

describe("useFlowStages", () => {
  it("reads the current stage from the localized route", async () => {
    setPathname("/en/territorial-analysis/upload-data");
    const { result } = await renderHookWithData(useFlowStages);

    expect(result.current.current).toBe(2);
    expect(states(result.current.stages)).toEqual(["skipped", "current", "locked"]);
  });

  it("counts validation and analysis results from the data context", async () => {
    setPathname("/polygons-validation");
    const { result } = await renderHookWithData(useFlowStages, {
      context: makeDataContext({
        polygonsValidationResults: makeValidationResults({}),
        territorialAnalysisResults: [makeMapResults(1, { "farm-1": 0 })],
      }),
    });

    expect(result.current.flags).toEqual({ validationDone: true, analysisDone: true });
    expect(states(result.current.stages)).toEqual(["current", "done", "available"]);
  });

  it("doesn't count an outdated analysis", async () => {
    setPathname("/territorial-analysis/upload-data");
    const { result } = await renderHookWithData(useFlowStages, {
      context: makeDataContext({
        territorialAnalysisResults: [makeMapResults(1, { "farm-1": 0 })],
        analysisOutdated: true,
      }),
    });

    expect(result.current.flags.analysisDone).toBe(false);
    expect(states(result.current.stages)[2]).toBe("locked");
  });

  it("has no current stage outside the flow", async () => {
    setPathname("/documentation");
    const { result } = await renderHookWithData(useFlowStages);

    expect(result.current.current).toBeNull();
  });
});
