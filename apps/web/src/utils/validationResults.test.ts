import { describe, expect, it } from "vitest";
import { makeFarm } from "@/test/factories";
import type {
  InconsistentPolygonData,
  ValidateFarmsResponse,
} from "@/interfaces/PolygonValidation";
import {
  farmValidationViews,
  manualValidationsOf,
  matchesResultsFilter,
  parseResultsFilter,
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
  // Each letter is one polygon: its geometry stays, its ID can change
  const farm = (id: string, polygon: string) =>
    makeFarm({
      id,
      polygon: {
        type: "point",
        area: 10000,
        areaAssumed: false,
        details: { center: { lat: polygon.charCodeAt(0), lng: 0 }, radius: 56 },
      },
    });
  const farmsOf = (ids: Record<string, string>) =>
    Object.entries(ids).map(([id, polygon]) => farm(id, polygon));

  const before = manualValidationsOf(
    results({ A: "VALID_MANUALLY", B: "NOT_VALID", C: "VALID" }, [overlap("A", "B")]),
    farmsOf({ A: "a", B: "b", C: "c" })
  );

  it("keeps a validation when the farm overlaps the same farms", () => {
    const { results: reconciled, dropped } = reconcileManualValidations(
      before,
      results({ A: "NOT_VALID", B: "NOT_VALID", C: "VALID", N: "VALID" }, [
        overlap("B", "A"),
      ]),
      farmsOf({ A: "a", B: "b", C: "c", N: "n" })
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
      ]),
      farmsOf({ A: "a", B: "b", N: "n" })
    );

    expect(statusOf(reconciled, "A")).toBe("NOT_VALID");
    expect(dropped).toBe(1);
  });

  it("takes the API's status when the neighbour was deleted", () => {
    const { results: reconciled, dropped } = reconcileManualValidations(
      before,
      results({ A: "VALID", C: "VALID" }),
      farmsOf({ A: "a", C: "c" })
    );

    expect(statusOf(reconciled, "A")).toBe("VALID");
    // Nothing left to review
    expect(dropped).toBe(0);
  });

  it("drops it when the farm now has a geometry error", () => {
    const { results: reconciled, dropped } = reconcileManualValidations(
      before,
      results({ A: "NOT_VALID", B: "NOT_VALID" }, [overlap("A", "B"), invalid("A")]),
      farmsOf({ A: "a", B: "b" })
    );

    expect(statusOf(reconciled, "A")).toBe("NOT_VALID");
    expect(dropped).toBe(1);
  });

  it("follows the polygon when the API gives it another ID", () => {
    const { results: reconciled, dropped } = reconcileManualValidations(
      before,
      results({ "A-2": "NOT_VALID", "B-2": "NOT_VALID" }, [overlap("A-2", "B-2")]),
      farmsOf({ "A-2": "a", "B-2": "b" })
    );

    expect(statusOf(reconciled, "A-2")).toBe("VALID_MANUALLY");
    expect(dropped).toBe(0);
  });

  it("never moves a validation to the farm that takes its ID", () => {
    // Farms without IDs, numbered by position, in a row: each overlaps the next.
    // C (3) is validated, then A is deleted, so D becomes 3 with C's neighbours' IDs.
    const chain = (ids: string[]) =>
      ids.slice(1).map((id, index) => overlap(ids[index], id));
    const validatedC = manualValidationsOf(
      results(
        { 1: "NOT_VALID", 2: "NOT_VALID", 3: "VALID_MANUALLY", 4: "NOT_VALID", 5: "NOT_VALID" },
        chain(["1", "2", "3", "4", "5"])
      ),
      farmsOf({ 1: "a", 2: "b", 3: "c", 4: "d", 5: "e" })
    );

    const { results: reconciled, dropped } = reconcileManualValidations(
      validatedC,
      results(
        { 1: "NOT_VALID", 2: "NOT_VALID", 3: "NOT_VALID", 4: "NOT_VALID" },
        chain(["1", "2", "3", "4"])
      ),
      farmsOf({ 1: "b", 2: "c", 3: "d", 4: "e" })
    );

    // C, now 2, still overlaps B and D: it stays validated. D, now 3, does not
    // inherit C's validation through the ID
    expect(statusOf(reconciled, "2")).toBe("VALID_MANUALLY");
    expect(statusOf(reconciled, "3")).toBe("NOT_VALID");
    expect(dropped).toBe(0);
  });

  it("keeps it for the same polygon at another position", () => {
    const validatedC = manualValidationsOf(
      results({ 1: "VALID", 2: "NOT_VALID", 3: "VALID_MANUALLY" }, [overlap("2", "3")]),
      farmsOf({ 1: "a", 2: "b", 3: "c" })
    );

    const { results: reconciled, dropped } = reconcileManualValidations(
      validatedC,
      results({ 1: "NOT_VALID", 2: "NOT_VALID" }, [overlap("1", "2")]),
      farmsOf({ 1: "b", 2: "c" })
    );

    expect(statusOf(reconciled, "2")).toBe("VALID_MANUALLY");
    expect(dropped).toBe(0);
  });

  it("doesn't restore it when two farms share the validated geometry", () => {
    const { results: reconciled, dropped } = reconcileManualValidations(
      before,
      results({ A: "NOT_VALID", "A-copy": "NOT_VALID", B: "NOT_VALID" }, [
        overlap("A", "B"),
      ]),
      farmsOf({ A: "a", "A-copy": "a", B: "b" })
    );

    expect(statusOf(reconciled, "A")).toBe("NOT_VALID");
    expect(statusOf(reconciled, "A-copy")).toBe("NOT_VALID");
    // One validation was lost, whatever the number of copies
    expect(dropped).toBe(1);
  });

  it("counts it when the polygon changed: its ID is listed on another geometry", () => {
    // A drawn farm edited, or a file with fixed coordinates
    const { results: reconciled, dropped } = reconcileManualValidations(
      before,
      results({ A: "NOT_VALID", B: "NOT_VALID" }, [overlap("A", "B")]),
      farmsOf({ A: "z", B: "b" })
    );

    expect(statusOf(reconciled, "A")).toBe("NOT_VALID");
    expect(dropped).toBe(1);
  });

  it("doesn't count a changed polygon that needs no review now", () => {
    const { dropped } = reconcileManualValidations(
      before,
      results({ A: "VALID", B: "VALID" }),
      farmsOf({ A: "z", B: "b" })
    );

    expect(dropped).toBe(0);
  });
});

describe("the summary cards' filters", () => {
  const views = farmValidationViews(
    ["A", "B", "C", "D"].map((id) => makeFarm({ id })),
    results({ A: "VALID", B: "NOT_VALID", C: "NOT_VALID", D: "VALID_MANUALLY" }, [
      overlap("B", "D"),
      invalid("C"),
    ])
  );
  const idsOf = (filter: "ready" | "overlap" | "error") =>
    views
      .filter((view) => matchesResultsFilter(view, filter))
      .map(({ farm }) => farm.id);

  it("counts a farm validated manually as ready, not as overlapping", () => {
    expect(idsOf("ready")).toEqual(["A", "D"]);
    expect(idsOf("overlap")).toEqual(["B"]);
    expect(idsOf("error")).toEqual(["C"]);
  });

  it("reads only the known filters from the URL", () => {
    expect(parseResultsFilter("overlap")).toBe("overlap");
    expect(parseResultsFilter("all")).toBeNull();
    expect(parseResultsFilter(null)).toBeNull();
  });
});
