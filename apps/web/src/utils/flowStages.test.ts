import { describe, expect, it } from "vitest";
import {
  deriveFlowStages,
  flowProgress,
  stageFromPathname,
  stageAction,
  stageHref,
  type FlowFlags,
  type FlowStage,
} from "./flowStages";

const NOTHING: FlowFlags = { validationDone: false, analysisDone: false };
const VALIDATED: FlowFlags = { validationDone: true, analysisDone: false };
const ANALYZED_DIRECTLY: FlowFlags = { validationDone: false, analysisDone: true };
const BOTH: FlowFlags = { validationDone: true, analysisDone: true };

const states = (current: FlowStage | null, flags: FlowFlags) =>
  deriveFlowStages(current, flags).map(({ state }) => state);
const labels = (current: FlowStage | null, flags: FlowFlags) =>
  deriveFlowStages(current, flags).map(({ labelKey }) => labelKey.split(".").pop());

describe("stageFromPathname", () => {
  it.each([
    ["/polygons-validation", 1],
    ["/polygons-validation/upload-data", 1],
    ["/en/polygons-validation", 1],
    ["/es/deforestation-analysis/upload-data", 2],
    ["/deforestation-analysis", 2],
    ["/report-generation", 3],
    ["/report-generation/preview", 3],
    ["/en/report-generation/preview", 3],
  ])("%s is stage %i", (pathname, stage) => {
    expect(stageFromPathname(pathname)).toBe(stage);
  });

  it.each(["/", "/en", "/home", "/documentation", "/admin/layers", "/en/admin/usage"])(
    "%s is outside the flow",
    (pathname) => {
      expect(stageFromPathname(pathname)).toBeNull();
    }
  );
});

describe("deriveFlowStages", () => {
  it("normal entry: here, go straight to 2, 3 waits for results", () => {
    expect(states(1, NOTHING)).toEqual(["current", "available", "locked"]);
    expect(labels(1, NOTHING)).toEqual(["current", "direct", "locked"]);
  });

  it("after validating, on stage 2: 1 is done and 3 still waits", () => {
    expect(states(2, VALIDATED)).toEqual(["done", "current", "locked"]);
    expect(labels(2, VALIDATED)).toEqual(["done", "current", "locked"]);
  });

  it("direct entry to stage 2: 1 is skipped and optional", () => {
    expect(states(2, NOTHING)).toEqual(["skipped", "current", "locked"]);
    expect(labels(2, NOTHING)).toEqual(["skipped", "current", "locked"]);
  });

  it("analysis done: stage 3 is available, not 'go straight there'", () => {
    expect(states(2, BOTH)).toEqual(["done", "current", "available"]);
    expect(labels(2, BOTH)).toEqual(["done", "current", "available"]);
  });

  it("back on stage 1 after the analysis", () => {
    expect(states(1, BOTH)).toEqual(["current", "done", "available"]);
    expect(labels(1, BOTH)).toEqual(["current", "done", "available"]);
  });

  it("on stage 3 after a direct analysis: 1 skipped, 2 done", () => {
    expect(states(3, ANALYZED_DIRECTLY)).toEqual(["skipped", "done", "current"]);
  });

  it("stage 3 without results is locked wherever the user is", () => {
    for (const current of [1, 2] as const) {
      for (const flags of [NOTHING, VALIDATED]) {
        expect(states(current, flags)[2]).toBe("locked");
      }
    }
  });

  it("stage 2 is never locked (D5)", () => {
    for (const current of [null, 1, 2, 3] as const) {
      for (const flags of [NOTHING, VALIDATED, ANALYZED_DIRECTLY, BOTH]) {
        expect(states(current, flags)[1]).not.toBe("locked");
      }
    }
  });
});

describe("flowProgress", () => {
  it.each<[FlowStage, FlowFlags, [number, number]]>([
    [1, NOTHING, [0.35, 0]],
    [1, VALIDATED, [1, 0]],
    [2, NOTHING, [1, 0.35]],
    [2, BOTH, [1, 1]],
    [3, BOTH, [1, 1]],
  ])("on stage %i", (current, flags, progress) => {
    expect(flowProgress(current, flags)).toEqual(progress);
  });
});

describe("stageHref", () => {
  it("goes to a stage's results when it has them", () => {
    expect(stageHref(1, BOTH)).toBe("/polygons-validation");
    expect(stageHref(2, BOTH)).toBe("/deforestation-analysis");
    expect(stageHref(3, BOTH)).toBe("/report-generation");
  });

  it("goes to a stage's upload page otherwise", () => {
    expect(stageHref(1, NOTHING)).toBe("/polygons-validation/upload-data");
    expect(stageHref(2, VALIDATED)).toBe("/deforestation-analysis/upload-data");
  });
});

describe("stageAction", () => {
  const READY = { reportMapIds: [1], analysisMapIds: [1, 2], selectedFarmsCount: 3 };

  it("opens the analysis modal for stage 2 from another stage, after a validation", () => {
    expect(stageAction(2, 1, VALIDATED, READY)).toBe("analysisModal");
    expect(stageAction(2, 3, VALIDATED, READY)).toBe("analysisModal");
  });

  it("goes straight to stage 2 without a validation, or with results", () => {
    expect(stageAction(2, 1, NOTHING, READY)).toBe("navigate");
    expect(stageAction(2, 1, BOTH, READY)).toBe("navigate");
  });

  it("opens the report only when its choices are ready", () => {
    expect(stageAction(3, 2, BOTH, READY)).toBe("navigate");
  });

  it.each([
    ["no report layer", { ...READY, reportMapIds: [] }],
    ["layers ticked but no farm confirmed", { ...READY, selectedFarmsCount: 0 }],
    ["a report layer from an earlier analysis", { ...READY, reportMapIds: [3] }],
  ])("asks for the report's choices with %s", (_, selection) => {
    expect(stageAction(3, 2, BOTH, selection)).toBe("reportModal");
  });

  it("navigates for stage 1", () => {
    expect(stageAction(1, 2, VALIDATED, READY)).toBe("navigate");
  });

  it("does nothing for the current stage, and opens no dialog", () => {
    // On stage 2 while the analysis runs or after it fails: no analysis modal.
    expect(stageAction(2, 2, VALIDATED, READY)).toBe("none");
    // On the report with no farm chosen: no report modal.
    expect(stageAction(3, 3, BOTH, { ...READY, selectedFarmsCount: 0 })).toBe("none");
    expect(stageAction(1, 1, NOTHING, READY)).toBe("none");
  });
});
