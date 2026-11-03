import { Coordinates } from "@/interfaces/Map";
import { FarmRow } from "@/interfaces/FarmRow";

/**
 * The geometry rules of the manual farm modal's drawing tool. The modal only wires
 * Google Maps events to these functions: a vertex added, moved, inserted (a midpoint
 * dragged) or deleted is accepted only if the path stays simple (no crossing edges).
 *
 * Vertices are `{ lat, lng }`, as Google Maps gives them. Edges are compared in
 * degrees, which is fine at a farm's scale.
 */

export type PolygonDrawing = {
  type: "polygon";
  vertices: Coordinates[];
  // While drawing, the path is open; "Finish" closes it
  closed: boolean;
};
export type PointDrawing = { type: "point"; center: Coordinates };
export type Drawing = PolygonDrawing | PointDrawing;

export const MIN_POLYGON_VERTICES = 3;

// Decimal places kept in a row's coordinates (about 1 cm)
const COORDINATE_DECIMALS = 7;
const EPSILON = 1e-12;

const orientation = (p: Coordinates, q: Coordinates, r: Coordinates) => {
  const value =
    (q.lng - p.lng) * (r.lat - p.lat) - (q.lat - p.lat) * (r.lng - p.lng);
  if (Math.abs(value) < EPSILON) return 0;
  return value > 0 ? 1 : -1;
};

// r is on segment pq, given the three are collinear
const onSegment = (p: Coordinates, q: Coordinates, r: Coordinates) =>
  Math.min(p.lng, q.lng) - EPSILON <= r.lng &&
  r.lng <= Math.max(p.lng, q.lng) + EPSILON &&
  Math.min(p.lat, q.lat) - EPSILON <= r.lat &&
  r.lat <= Math.max(p.lat, q.lat) + EPSILON;

const samePoint = (a: Coordinates, b: Coordinates) =>
  Math.abs(a.lat - b.lat) < EPSILON && Math.abs(a.lng - b.lng) < EPSILON;

/** Whether segments ab and cd share any point (crossing, touching or overlapping). */
export const segmentsIntersect = (
  a: Coordinates,
  b: Coordinates,
  c: Coordinates,
  d: Coordinates
): boolean => {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, b, c)) return true;
  if (o2 === 0 && onSegment(a, b, d)) return true;
  if (o3 === 0 && onSegment(c, d, a)) return true;
  if (o4 === 0 && onSegment(c, d, b)) return true;
  return false;
};

const edges = (vertices: Coordinates[], closed: boolean) => {
  const count = closed ? vertices.length : vertices.length - 1;
  return Array.from({ length: Math.max(count, 0) }, (_, i) => [
    vertices[i],
    vertices[(i + 1) % vertices.length],
  ]);
};

/**
 * Whether a path's edges cross: two edges that aren't consecutive share a point, or
 * two consecutive ones fold back over each other. A repeated vertex counts too.
 */
export const pathCrosses = (
  vertices: Coordinates[],
  closed: boolean
): boolean => {
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      if (samePoint(vertices[i], vertices[j])) return true;
    }
  }

  const pathEdges = edges(vertices, closed);
  const count = pathEdges.length;
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const [a, b] = pathEdges[i];
      const [c, d] = pathEdges[j];
      const consecutive = j === i + 1 || (closed && i === 0 && j === count - 1);
      if (!consecutive) {
        if (segmentsIntersect(a, b, c, d)) return true;
        continue;
      }
      // Consecutive edges share a vertex; they cross only by folding back, when
      // the far end of one lies on the other
      const [shared, farI, farJ] = j === i + 1 ? [b, a, d] : [a, b, c];
      if (
        orientation(farI, shared, farJ) === 0 &&
        (onSegment(shared, farI, farJ) || onSegment(shared, farJ, farI))
      ) {
        return true;
      }
    }
  }
  return false;
};

const accept = (vertices: Coordinates[], closed: boolean) =>
  pathCrosses(vertices, closed) ? null : vertices;

/** The open path with one more vertex at its end, or null if an edge would cross. */
export const addVertex = (
  vertices: Coordinates[],
  vertex: Coordinates
): Coordinates[] | null => accept([...vertices, vertex], false);

/** The path with a vertex moved, or null if an edge would cross. */
export const moveVertex = (
  vertices: Coordinates[],
  index: number,
  vertex: Coordinates,
  closed: boolean
): Coordinates[] | null => {
  if (index < 0 || index >= vertices.length) return null;
  return accept(
    vertices.map((v, i) => (i === index ? vertex : v)),
    closed
  );
};

/**
 * The path with a vertex inserted at `index` (Google Maps' midpoint handles), or
 * null if an edge would cross.
 */
export const insertVertex = (
  vertices: Coordinates[],
  index: number,
  vertex: Coordinates,
  closed: boolean
): Coordinates[] | null => {
  if (index < 0 || index > vertices.length) return null;
  return accept(
    [...vertices.slice(0, index), vertex, ...vertices.slice(index)],
    closed
  );
};

/**
 * The path without a vertex, or null if it can't go: a closed polygon keeps at
 * least 3 vertices, and the edge that joins its neighbours can't cross another.
 */
export const deleteVertex = (
  vertices: Coordinates[],
  index: number,
  closed: boolean
): Coordinates[] | null => {
  if (index < 0 || index >= vertices.length) return null;
  if (closed && vertices.length <= MIN_POLYGON_VERTICES) return null;
  return accept(
    vertices.filter((_, i) => i !== index),
    closed
  );
};

/** Whether an open path can be closed: 3 vertices, and the closing edge crosses none. */
export const canClose = (vertices: Coordinates[]): boolean =>
  vertices.length >= MIN_POLYGON_VERTICES && !pathCrosses(vertices, true);

const round = (value: number) => Number(value.toFixed(COORDINATE_DECIMALS));

const toPosition = ({ lng, lat }: Coordinates): [number, number] => [
  round(lng),
  round(lat),
];

/** The polygon as a closed GeoJSON ring of [lng, lat]: its first position repeated last. */
export const closeRing = (vertices: Coordinates[]): [number, number][] => {
  const ring = vertices.map(toPosition);
  return ring.length ? [...ring, ring[0]] : ring;
};

/** A point farm's radius in meters for its area in hectares, as the API computes it. */
export const areaToRadius = (hectares: number): number =>
  Math.round(Math.sqrt((hectares * 10_000) / Math.PI) * 100) / 100;

type GeometryFields = Pick<
  FarmRow,
  "coordinatesFormat" | "geometryType" | "farmCoordinates"
>;

/**
 * A finished drawing as the row's geometry fields, in the template's GeoJSON
 * format: `[[ring]]` for a polygon, `[lng, lat]` for a point. Null for a polygon
 * that isn't closed or whose edges cross.
 */
export const drawingToGeometryFields = (
  drawing: Drawing
): GeometryFields | null => {
  if (drawing.type === "point") {
    return {
      coordinatesFormat: "GeoJSON",
      geometryType: "Point",
      farmCoordinates: JSON.stringify(toPosition(drawing.center)),
    };
  }
  if (!drawing.closed || !canClose(drawing.vertices)) return null;
  return {
    coordinatesFormat: "GeoJSON",
    geometryType: "Polygon",
    farmCoordinates: JSON.stringify([closeRing(drawing.vertices)]),
  };
};

/** Why a listed row's geometry can't be loaded in the drawing tool. */
export type NotEditableReason =
  // WKT, or no format
  | "format"
  // A MultiPolygon, or a polygon with holes: the tool draws one ring
  | "shape"
  // The coordinates don't parse, or the ring crosses itself
  | "invalid";

export type RowDrawing =
  | { editable: true; drawing: Drawing }
  | { editable: false; reason: NotEditableReason };

const isPosition = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === "number" &&
  typeof value[1] === "number" &&
  Number.isFinite(value[0]) &&
  Number.isFinite(value[1]);

const toCoordinates = ([lng, lat]: [number, number]): Coordinates => ({
  lat,
  lng,
});

/**
 * A listed row's geometry as a finished drawing, for edit mode. Only GeoJSON
 * Points and single-ring Polygons (what this tool produces) are editable.
 */
export const farmRowToDrawing = (row: FarmRow): RowDrawing => {
  if (row.coordinatesFormat !== "GeoJSON" || !row.farmCoordinates) {
    return { editable: false, reason: "format" };
  }
  let coordinates: unknown;
  try {
    coordinates = JSON.parse(row.farmCoordinates);
  } catch {
    return { editable: false, reason: "invalid" };
  }

  if (row.geometryType === "Point") {
    return isPosition(coordinates)
      ? {
          editable: true,
          drawing: { type: "point", center: toCoordinates(coordinates) },
        }
      : { editable: false, reason: "invalid" };
  }

  if (row.geometryType !== "Polygon" && row.geometryType !== "MultiPolygon") {
    return { editable: false, reason: "invalid" };
  }
  // A Polygon's rings; "MultiPolygon" rows may hold a Polygon's coordinates too
  if (!Array.isArray(coordinates) || !Array.isArray(coordinates[0])) {
    return { editable: false, reason: "invalid" };
  }
  if (Array.isArray(coordinates[0][0]?.[0])) {
    return { editable: false, reason: "shape" };
  }
  if (coordinates.length !== 1) return { editable: false, reason: "shape" };

  const ring = coordinates[0] as unknown[];
  if (!ring.every(isPosition)) return { editable: false, reason: "invalid" };
  const vertices = ring.map(toCoordinates);
  // The ring is closed: drop its repeated first position
  if (
    vertices.length > 1 &&
    samePoint(vertices[0], vertices[vertices.length - 1])
  ) {
    vertices.pop();
  }
  if (!canClose(vertices)) return { editable: false, reason: "invalid" };
  return {
    editable: true,
    drawing: { type: "polygon", vertices, closed: true },
  };
};

/** The bounds that fit a drawing, to open the map on it in edit mode. */
export const drawingBounds = (
  drawing: Drawing,
  // A point's radius in meters, to fit its circle
  pointRadius = 0
): google.maps.LatLngBoundsLiteral | null => {
  const points = drawing.type === "point" ? [drawing.center] : drawing.vertices;
  if (!points.length) return null;
  const radius = drawing.type === "point" ? pointRadius : 0;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  // Meters to degrees of latitude, and of longitude at that latitude
  const dLat = radius / 111_320;
  const dLng =
    radius / (111_320 * Math.max(Math.cos((lats[0] * Math.PI) / 180), 0.01));
  return {
    south: Math.min(...lats) - dLat,
    north: Math.max(...lats) + dLat,
    west: Math.min(...lngs) - dLng,
    east: Math.max(...lngs) + dLng,
  };
};
