import countryBounds from "./countryBounds.json";

// [west, south, east, north] by ISO 3166-1 alpha-2 code, from Natural Earth
// (scripts/generate-country-bounds.py). A box across the antimeridian has its west
// greater than its east, as Google Maps' LatLngBounds takes it.
const BOUNDS: Record<string, number[] | undefined> = countryBounds;

/** A country's bounding box, or null for a code the table doesn't have. */
export const getCountryBounds = (
  code: string | null | undefined
): google.maps.LatLngBoundsLiteral | null => {
  const box = code ? BOUNDS[code.toUpperCase()] : undefined;
  if (!box) return null;
  const [west, south, east, north] = box;
  return { west, south, east, north };
};
