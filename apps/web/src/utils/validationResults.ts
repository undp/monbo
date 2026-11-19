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

/** Each farm validated manually, by ID, with the IDs it overlapped, sorted. */
export type ManualValidations = Map<string, string[]>;

const neighbourIds = (
  farmId: string,
  inconsistencies: ValidateFarmsResponse["inconsistencies"]
) =>
  overlapsOf(farmId, inconsistencies)
    .map(({ neighbourId }) => neighbourId)
    .sort();

export const manualValidationsOf = (
  results: ValidateFarmsResponse | null
): ManualValidations =>
  new Map(
    (results?.farmResults ?? [])
      .filter(({ status }) => status === FarmValidationStatus.VALID_MANUALLY)
      .map(({ farmId }) => [farmId, neighbourIds(farmId, results!.inconsistencies)])
  );

const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/**
 * A new validation's results with the earlier manual validations put back, for
 * the farms that overlap exactly the same farms as when they were validated and
 * have no geometry error: nobody stays validated over an overlap they didn't see.
 * `dropped` counts the farms that were validated and now need a review again.
 */
export const reconcileManualValidations = (
  validated: ManualValidations,
  results: ValidateFarmsResponse
): { results: ValidateFarmsResponse; dropped: number } => {
  let dropped = 0;
  const farmResults = results.farmResults.map((result) => {
    const before = validated.get(result.farmId);
    if (!before || result.status !== FarmValidationStatus.NOT_VALID) return result;
    const hasGeometryError = results.inconsistencies.some(
      ({ type, farmIds }) => type !== "overlap" && farmIds.includes(result.farmId)
    );
    const now = neighbourIds(result.farmId, results.inconsistencies);
    if (!hasGeometryError && sameIds(before, now))
      return { ...result, status: FarmValidationStatus.VALID_MANUALLY };
    dropped += 1;
    return result;
  });
  return { results: { ...results, farmResults }, dropped };
};
