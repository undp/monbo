import { describe, expect, it } from "vitest";
import { makeFarm } from "@/test/factories";
import type {
  InconsistentPolygonData,
  ValidateFarmsResponse,
} from "@/interfaces/PolygonValidation";
import {
  farmValidationViews,
  manualValidationsOf,
  reconcileManualValidations,
  withFarmStatus,
} from "./validationResults";

const overlap = (a: string, b: string, area = 1200): InconsistentPolygonData => ({
  type: "overlap",
  farmIds: [a, b],
  data: {
    area,
    center: { lat: 0, lng: 0 },
    parts: [],
    percentage: 0.4,
    criticality: "MEDIUM",
  },
});

const invalid = (id: string): InconsistentPolygonData => ({
  type: "invalid_geometry",
  farmIds: [id],
  data: { reason: "Self-intersection" },
});

const results = (
  statuses: Record<string, "VALID" | "VALID_MANUALLY" | "NOT_VALID">,
  inconsistencies: InconsistentPolygonData[] = []
): ValidateFarmsResponse => ({
  farmResults: Object.entries(statuses).map(([farmId, status]) => ({
    farmId,
    status,
  })),
  inconsistencies,
});

const statusOf = (response: ValidateFarmsResponse, farmId: string) =>
  response.farmResults.find((result) => result.farmId === farmId)?.status;

describe("farmValidationViews", () => {
  it("gives each farm one status, in upload order", () => {
    const farms = ["A", "B", "C", "D", "E"].map((id) => makeFarm({ id }));
    const views = farmValidationViews(
      farms,
      results(
        { A: "VALID", B: "NOT_VALID", C: "NOT_VALID", D: "VALID_MANUALLY", E: "NOT_VALID" },
        // E's overlap can't come from the API (an invalid farm is left out of the
        // overlap check); it is here to show the geometry error decides
        [overlap("B", "C"), overlap("C", "D"), invalid("E"), overlap("E", "B")]
      )
    );

    expect(views.map(({ farm, kind }) => [farm.id, kind])).toEqual([
      ["A", "ready"],
      ["B", "overlap"],
      ["C", "overlap"],
      ["D", "validatedManually"],
      ["E", "geometryError"],
    ]);
  });

  it("lists every overlap of a farm, seen from that farm", () => {
    const views = farmValidationViews(
      ["A", "B", "C"].map((id) => makeFarm({ id })),
      results({ A: "NOT_VALID", B: "NOT_VALID", C: "NOT_VALID" }, [
        overlap("A", "B", 500),
        overlap("C", "A", 700),
      ])
    );

    expect(views[0].overlaps.map(({ neighbourId, data }) => [neighbourId, data.area])).toEqual([
      ["B", 500],
      ["C", 700],
    ]);
    expect(views[1].overlaps.map(({ neighbourId }) => neighbourId)).toEqual(["A"]);
  });

  it("calls a farm without inconsistencies ready", () => {
    const [view] = farmValidationViews([makeFarm({ id: "A" })], results({ A: "VALID" }));

    expect(view.kind).toBe("ready");
    expect(view.geometryInconsistency).toBeNull();
  });
});

describe("withFarmStatus", () => {
  it("changes only that farm", () => {
    const changed = withFarmStatus(
      results({ A: "NOT_VALID", B: "NOT_VALID" }, [overlap("A", "B")]),
      "A",
      "VALID_MANUALLY"
    );

    expect(statusOf(changed, "A")).toBe("VALID_MANUALLY");
    expect(statusOf(changed, "B")).toBe("NOT_VALID");
  });
});

describe("reconcileManualValidations", () => {
  const before = manualValidationsOf(
    results({ A: "VALID_MANUALLY", B: "NOT_VALID", C: "VALID" }, [overlap("A", "B")])
  );

  it("keeps a validation when the farm overlaps the same farms", () => {
    const { results: reconciled, dropped } = reconcileManualValidations(
      before,
      results({ A: "NOT_VALID", B: "NOT_VALID", C: "VALID", N: "VALID" }, [
        overlap("B", "A"),
      ])
    );

    expect(statusOf(reconciled, "A")).toBe("VALID_MANUALLY");
    expect(statusOf(reconciled, "B")).toBe("NOT_VALID");
    expect(dropped).toBe(0);
  });

  it("drops it when a new farm overlaps the validated one", () => {
    const { results: reconciled, dropped } = reconcileManualValidations(
      before,
      results({ A: "NOT_VALID", B: "NOT_VALID", N: "NOT_VALID" }, [
        overlap("A", "B"),
        overlap("N", "A"),
      ])
    );

    expect(statusOf(reconciled, "A")).toBe("NOT_VALID");
    expect(dropped).toBe(1);
  });

  it("takes the API's status when the neighbour was deleted", () => {
    const { results: reconciled, dropped } = reconcileManualValidations(
      before,
      results({ A: "VALID", C: "VALID" })
    );

    expect(statusOf(reconciled, "A")).toBe("VALID");
    // Nothing left to review
    expect(dropped).toBe(0);
  });

  it("drops it when the farm now has a geometry error", () => {
    const { results: reconciled, dropped } = reconcileManualValidations(
      before,
      results({ A: "NOT_VALID", B: "NOT_VALID" }, [overlap("A", "B"), invalid("A")])
    );

    expect(statusOf(reconciled, "A")).toBe("NOT_VALID");
    expect(dropped).toBe(1);
  });

  it("drops it when the farm's ID changed", () => {
    const { results: reconciled } = reconcileManualValidations(
      before,
      results({ "A-2": "NOT_VALID", B: "NOT_VALID" }, [overlap("A-2", "B")])
    );

    expect(statusOf(reconciled, "A-2")).toBe("NOT_VALID");
  });
});
