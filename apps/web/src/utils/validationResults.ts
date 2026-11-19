import { FarmData } from "@/interfaces/Farm";
import {
  FarmValidationStatus,
  InconsistentPolygonData,
  OverlapData,
  ValidateFarmsResponse,
} from "@/interfaces/PolygonValidation";

// The stage 1 results as one table: a view per farm built from the API's
// farmResults and its pairwise inconsistencies.

export type GeometryInconsistency = Exclude<
  InconsistentPolygonData,
  { type: "overlap" }
>;

/** One overlap of a farm, seen from that farm: the other farm and the overlap. */
export interface FarmOverlap {
  neighbourId: string;
  data: OverlapData;
}

/**
 * What the farm's row says, in this order: a geometry error (it can't be analysed
 * nor validated manually), a manual validation, an overlap to review, or ready.
 */
export type FarmStatusKind =
  | "geometryError"
  | "validatedManually"
  | "overlap"
  | "ready";

export interface FarmValidationView {
  farm: FarmData;
  status: FarmValidationStatus;
  kind: FarmStatusKind;
  geometryInconsistency: GeometryInconsistency | null;
  overlaps: FarmOverlap[];
}

const overlapsOf = (
  farmId: string,
  inconsistencies: ValidateFarmsResponse["inconsistencies"]
): FarmOverlap[] =>
  inconsistencies.flatMap((inconsistency) => {
    if (inconsistency.type !== "overlap" || !inconsistency.farmIds.includes(farmId))
      return [];
    const neighbourId = inconsistency.farmIds.find((id) => id !== farmId);
    return neighbourId ? [{ neighbourId, data: inconsistency.data }] : [];
  });

/** The view of each farm, in upload order. */
export const farmValidationViews = (
  farms: FarmData[],
  results: ValidateFarmsResponse
): FarmValidationView[] => {
  const statuses = new Map(
    results.farmResults.map(({ farmId, status }) => [farmId, status])
  );
  return farms.map((farm) => {
    const status = statuses.get(farm.id) ?? FarmValidationStatus.VALID;
    const geometryInconsistency =
      results.inconsistencies.find(
        (inconsistency): inconsistency is GeometryInconsistency =>
          inconsistency.type !== "overlap" && inconsistency.farmIds.includes(farm.id)
      ) ?? null;
    const overlaps = overlapsOf(farm.id, results.inconsistencies);
    const kind: FarmStatusKind = geometryInconsistency
      ? "geometryError"
      : status === FarmValidationStatus.VALID_MANUALLY
        ? "validatedManually"
        : overlaps.length > 0
          ? "overlap"
          : "ready";
    return { farm, status, kind, geometryInconsistency, overlaps };
  });
};

/** The farm's status set to `status`, the others' kept. */
export const withFarmStatus = (
  results: ValidateFarmsResponse,
  farmId: string,
  status: FarmValidationStatus
): ValidateFarmsResponse => ({
  ...results,
  farmResults: results.farmResults.map((result) =>
    result.farmId === farmId ? { ...result, status } : result
  ),
});

/**
 * A farm's geometry as text. It names the same farm across parses whatever ID
 * the API gives it: farms without an ID get theirs by position, or at random,
 * so deleting a row can hand a validated farm's ID to another one.
 */
export const geometryKey = (farm: FarmData): string =>
  JSON.stringify(
    farm.polygon.type === "point"
      ? [farm.polygon.details.center, farm.polygon.details.radius]
      : (farm.polygon.details?.parts ?? null)
  );

/** A farm validated manually: its ID then, and the geometries it overlapped, sorted. */
export interface ManualValidation {
  farmId: string;
  neighbours: string[];
}

/** Each farm validated manually, by its geometry. */
export type ManualValidations = Map<string, ManualValidation>;

const geometryKeys = (farms: FarmData[]) =>
  new Map(farms.map((farm) => [farm.id, geometryKey(farm)]));

const neighbourKeys = (
  farmId: string,
  inconsistencies: ValidateFarmsResponse["inconsistencies"],
  keys: Map<string, string>
) =>
  overlapsOf(farmId, inconsistencies)
    .map(({ neighbourId }) => keys.get(neighbourId) ?? `id:${neighbourId}`)
    .sort();

/** The manual validations of these results, to put back after a new validation. */
export const manualValidationsOf = (
  results: ValidateFarmsResponse | null,
  farms: FarmData[] | null
): ManualValidations => {
  if (!results || !farms) return new Map();
  const keys = geometryKeys(farms);
  return new Map(
    results.farmResults.flatMap(({ farmId, status }) => {
      const key = keys.get(farmId);
      return status === FarmValidationStatus.VALID_MANUALLY && key !== undefined
        ? [
            [
              key,
              {
                farmId,
                neighbours: neighbourKeys(farmId, results.inconsistencies, keys),
              },
            ] as const,
          ]
        : [];
    })
  );
};

const sameKeys = (a: string[], b: string[]) =>
  a.length === b.length && a.every((key, index) => key === b[index]);

/**
 * A new validation's results with the earlier manual validations put back. A
 * farm gets its validation back only if it is the same polygon (same geometry,
 * whatever its ID now), overlaps exactly the same polygons as when it was
 * validated, has no geometry error and no other farm in the list shares its
 * geometry: nobody stays validated over an overlap they didn't see, and a
 * validation never moves to another farm.
 *
 * `dropped` counts the earlier validations, each once, that now need a review:
 * the polygon is still listed but didn't get it back, or a farm with its ID is
 * listed with another geometry (an edited drawing, fixed coordinates). One that
 * is gone from the list (deleted) needs none. Telling a changed polygon from a
 * deleted one by its ID is a best effort: it can warn once too often when
 * positional IDs shift, and it misses a polygon whose geometry and ID both
 * changed (no ID in the file, coordinates fixed and a row deleted). Either way
 * the validation itself is never kept on a polygon nobody reviewed.
 */
export const reconcileManualValidations = (
  validated: ManualValidations,
  results: ValidateFarmsResponse,
  farms: FarmData[]
): { results: ValidateFarmsResponse; dropped: number } => {
  const keys = geometryKeys(farms);
  const idsPerKey = new Map<string, string[]>();
  keys.forEach((key, farmId) =>
    idsPerKey.set(key, [...(idsPerKey.get(key) ?? []), farmId])
  );
  const farmResults = results.farmResults.map((result) => {
    const key = keys.get(result.farmId);
    const before = key === undefined ? undefined : validated.get(key);
    if (!before || result.status !== FarmValidationStatus.NOT_VALID) return result;
    const hasGeometryError = results.inconsistencies.some(
      ({ type, farmIds }) => type !== "overlap" && farmIds.includes(result.farmId)
    );
    const now = neighbourKeys(result.farmId, results.inconsistencies, keys);
    return !hasGeometryError &&
      idsPerKey.get(key!)?.length === 1 &&
      sameKeys(before.neighbours, now)
      ? { ...result, status: FarmValidationStatus.VALID_MANUALLY }
      : result;
  });

  const statuses = new Map(farmResults.map(({ farmId, status }) => [farmId, status]));
  const needsReview = (farmId: string) =>
    statuses.get(farmId) === FarmValidationStatus.NOT_VALID;
  let dropped = 0;
  validated.forEach(({ farmId }, key) => {
    const sameGeometry = idsPerKey.get(key);
    if (sameGeometry) {
      // Listed still: dropped unless one of them is validated (or valid) now
      if (sameGeometry.every(needsReview)) dropped += 1;
    } else if (keys.has(farmId) && needsReview(farmId)) {
      // Its ID, on another geometry: the polygon changed
      dropped += 1;
    }
  });
  return { results: { ...results, farmResults }, dropped };
};

/** The summary cards above the results, each of them a filter of the table. */
export type ResultsFilter = "ready" | "overlap" | "error";

const RESULTS_FILTERS: ResultsFilter[] = ["ready", "overlap", "error"];

/** The filter in the URL's `status`, or null for none (or an unknown one). */
export const parseResultsFilter = (value: string | null): ResultsFilter | null =>
  RESULTS_FILTERS.find((filter) => filter === value) ?? null;

/**
 * Whether a farm counts in a summary card, and so shows when the card filters
 * the table: ready to analyze (valid, or validated manually), or still not valid
 * because of an overlap or of its geometry. A farm with both is in both.
 */
export const matchesResultsFilter = (
  view: FarmValidationView,
  filter: ResultsFilter
): boolean => {
  if (filter === "ready") return view.status !== FarmValidationStatus.NOT_VALID;
  if (view.status !== FarmValidationStatus.NOT_VALID) return false;
  return filter === "overlap"
    ? view.overlaps.length > 0
    : view.geometryInconsistency !== null;
};
