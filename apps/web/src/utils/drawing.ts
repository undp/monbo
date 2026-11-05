import { Coordinates } from "@/interfaces/Map";
import { FarmRow } from "@/interfaces/FarmRow";

/**
 * The geometry rules of the manual farm modal's drawing tool. The modal only wires
 * Google Maps events to these functions. A polygon farm is made of parts, each with
 * an exterior ring and holes; one more ring can be open, being drawn. An edit (a
 * vertex added, moved, inserted or deleted, a ring closed or deleted) is accepted
 * only if every ring stays simple and the rings keep the API's rules: no two of
 * them touch, holes lie inside their part, and parts lie apart or inside a hole.
 *
 * Vertices are `{ lat, lng }`, as Google Maps gives them. Edges are compared in
 * degrees, which is fine at a farm's scale.
 */

// A ring's vertices, without its first one repeated at the end
export type Ring = Coordinates[];
export type Part = { exterior: Ring; holes: Ring[] };
export type OpenRing = { kind: "part" | "hole"; vertices: Ring };
export type PolygonDrawing = {
  type: "polygon";
  // Closed rings only, oriented as Google Maps needs them (see orientRing)
  parts: Part[];
  // The ring being drawn: "Close polygon" moves it into `parts`
  open: OpenRing | null;
};
export type PointDrawing = { type: "point"; center: Coordinates };
export type Drawing = PolygonDrawing | PointDrawing;

// A closed ring: a part's exterior (hole null), or one of its holes. "open" is the
// ring being drawn.
export type RingRef = { part: number; hole: number | null } | "open";

// Why an edit isn't accepted
export type DrawingProblem =
  // A ring's edges cross
  | "crossing"
  // A closed ring needs 3 vertices
  | "minVertices"
  // Closing the open ring would make its edges cross
  | "cannotClose"
  // Two rings touch or cross
  | "ringsTouch"
  // A hole isn't inside any part
  | "holeOutside"
  // A hole is inside another hole
  | "holeInHole"
  // A part is inside another one, and not in one of its holes
  | "partOverlaps"
  // The farm keeps at least one part
  | "lastPart";

export type DrawingEdit =
  | { ok: true; drawing: PolygonDrawing }
  | { ok: false; problem: DrawingProblem };

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

// --- Rings of a drawing ---------------------------------------------------------

/** Twice the ring's signed area in degrees²: positive when counter-clockwise. */
const signedArea = (ring: Ring) =>
  ring.reduce((sum, a, i) => {
    const b = ring[(i + 1) % ring.length];
    return sum + (a.lng * b.lat - b.lng * a.lat);
  }, 0);

/**
 * The ring wound as Google Maps needs it to show a hole empty: an exterior
 * counter-clockwise, a hole clockwise. A reversed ring keeps its first vertex
 * first, so the vertex the user started with stays number 1.
 */
export const orientRing = (ring: Ring, hole: boolean): Ring => {
  const counterClockwise = signedArea(ring) > 0;
  if (counterClockwise !== hole) return ring;
  return [ring[0], ...ring.slice(1).reverse()];
};

const orientParts = (parts: Part[]): Part[] =>
  parts.map(({ exterior, holes }) => ({
    exterior: orientRing(exterior, false),
    holes: holes.map((hole) => orientRing(hole, true)),
  }));

/** Whether a point lies inside a ring (ray casting; a point on its edge may go
 * either way, which the rules never need: rings don't touch). */
export const pointInRing = (point: Coordinates, ring: Ring): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (
      a.lat > point.lat !== b.lat > point.lat &&
      point.lng <
        ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng
    ) {
      inside = !inside;
    }
  }
  return inside;
};

/** Whether any edge of one path shares a point with any edge of another. */
const pathsTouch = (
  a: Ring,
  aClosed: boolean,
  b: Ring,
  bClosed: boolean
): boolean =>
  edges(a, aClosed).some(([p, q]) =>
    edges(b, bClosed).some(([r, s]) => segmentsIntersect(p, q, r, s))
  );

const closedRings = (parts: Part[]): Ring[] =>
  parts.flatMap(({ exterior, holes }) => [exterior, ...holes]);

/**
 * The first rule the parts break, or null. With no two rings touching, one vertex
 * of a ring tells whether the whole ring lies inside another.
 */
export const drawingProblem = (parts: Part[]): DrawingProblem | null => {
  const rings = closedRings(parts);
  if (rings.some((ring) => ring.length < MIN_POLYGON_VERTICES)) {
    return "minVertices";
  }
  if (rings.some((ring) => pathCrosses(ring, true))) return "crossing";
  for (let i = 0; i < rings.length; i++) {
    for (let j = i + 1; j < rings.length; j++) {
      if (pathsTouch(rings[i], true, rings[j], true)) return "ringsTouch";
    }
  }
  for (const { exterior, holes } of parts) {
    for (const [i, hole] of holes.entries()) {
      if (!pointInRing(hole[0], exterior)) return "holeOutside";
      if (holes.some((other, j) => j !== i && pointInRing(hole[0], other))) {
        return "holeInHole";
      }
    }
  }
  for (const [i, part] of parts.entries()) {
    for (const [j, other] of parts.entries()) {
      if (i === j) continue;
      const vertex = part.exterior[0];
      if (
        pointInRing(vertex, other.exterior) &&
        !other.holes.some((hole) => pointInRing(vertex, hole))
      ) {
        return "partOverlaps";
      }
    }
  }
  return null;
};

/** Whether two references point to the same ring. */
export const sameRing = (a: RingRef, b: RingRef): boolean =>
  a === "open" || b === "open"
    ? a === b
    : a.part === b.part && a.hole === b.hole;

/** The closed ring a reference points to, or null. */
export const ringAt = (drawing: PolygonDrawing, ref: RingRef): Ring | null => {
  if (ref === "open") return drawing.open?.vertices ?? null;
  const part = drawing.parts[ref.part];
  if (!part) return null;
  return ref.hole === null ? part.exterior : (part.holes[ref.hole] ?? null);
};

const withRing = (parts: Part[], ref: Exclude<RingRef, "open">, ring: Ring) =>
  parts.map((part, i) =>
    i !== ref.part
      ? part
      : ref.hole === null
        ? { ...part, exterior: ring }
        : {
            ...part,
            holes: part.holes.map((hole, j) => (j === ref.hole ? ring : hole)),
          }
  );

// Whether a point lies on the farm: inside a part, and not in one of its holes
const onFarm = (point: Coordinates, parts: Part[]) =>
  parts.some(
    ({ exterior, holes }) =>
      pointInRing(point, exterior) &&
      !holes.some((hole) => pointInRing(point, hole))
  );

/**
 * Where a vertex of the open ring may go, from the first one: a hole's on the
 * farm, a new part's off it (in a hole is fine: an island).
 */
const placementProblem = (
  parts: Part[],
  kind: OpenRing["kind"],
  vertex: Coordinates
): DrawingProblem | null => {
  if (kind === "hole" && !onFarm(vertex, parts)) {
    return parts.some(({ exterior }) => pointInRing(vertex, exterior))
      ? "holeInHole"
      : "holeOutside";
  }
  if (kind === "part" && onFarm(vertex, parts)) return "partOverlaps";
  return null;
};

/** The open ring's problem: where its vertices lie, and the closed rings it may
 * not touch. */
const openRingProblem = (
  parts: Part[],
  { kind, vertices }: OpenRing
): DrawingProblem | null => {
  if (pathCrosses(vertices, false)) return "crossing";
  for (const vertex of vertices) {
    const problem = placementProblem(parts, kind, vertex);
    if (problem) return problem;
  }
  // A lone first vertex is a segment of no length: it may still lie on a border
  const path = vertices.length === 1 ? [vertices[0], vertices[0]] : vertices;
  return closedRings(parts).some((ring) => pathsTouch(path, false, ring, true))
    ? "ringsTouch"
    : null;
};

const accepted = (drawing: PolygonDrawing): DrawingEdit => ({
  ok: true,
  drawing,
});
const rejected = (problem: DrawingProblem): DrawingEdit => ({
  ok: false,
  problem,
});

/** A new polygon drawing: its first part's exterior, open, from one vertex. */
export const startDrawing = (vertex: Coordinates): PolygonDrawing => ({
  type: "polygon",
  parts: [],
  open: { kind: "part", vertices: [vertex] },
});

/** Starts drawing another part, or a hole: once the farm has a part. */
export const startRing = (
  drawing: PolygonDrawing,
  kind: OpenRing["kind"]
): PolygonDrawing =>
  drawing.parts.length && !drawing.open
    ? { ...drawing, open: { kind, vertices: [] } }
    : drawing;

/** The open ring discarded; null when the farm has no part left. */
export const discardOpenRing = (
  drawing: PolygonDrawing
): PolygonDrawing | null =>
  drawing.parts.length ? { ...drawing, open: null } : null;

/** One more vertex at the open ring's end. */
export const addOpenVertex = (
  drawing: PolygonDrawing,
  vertex: Coordinates
): DrawingEdit => {
  if (!drawing.open) return rejected("crossing");
  const vertices = [...drawing.open.vertices, vertex];
  const problem = openRingProblem(drawing.parts, { ...drawing.open, vertices });
  return problem
    ? rejected(problem)
    : accepted({ ...drawing, open: { ...drawing.open, vertices } });
};

/**
 * The open ring closed: an exterior becomes a new part, and a hole goes to the
 * part it lies in (the innermost one, for a hole drawn on an island).
 */
export const closeOpenRing = (drawing: PolygonDrawing): DrawingEdit => {
  const open = drawing.open;
  if (!open || open.vertices.length < MIN_POLYGON_VERTICES) {
    return rejected("minVertices");
  }
  if (!canClose(open.vertices)) return rejected("cannotClose");
  if (
    closedRings(drawing.parts).some((ring) =>
      pathsTouch(open.vertices, true, ring, true)
    )
  ) {
    return rejected("ringsTouch");
  }

  let parts: Part[];
  if (open.kind === "part") {
    parts = [...drawing.parts, { exterior: open.vertices, holes: [] }];
  } else {
    const vertex = open.vertices[0];
    const inExterior = drawing.parts.filter(({ exterior }) =>
      pointInRing(vertex, exterior)
    );
    const owner = drawing.parts.findIndex(
      ({ exterior, holes }) =>
        pointInRing(vertex, exterior) &&
        !holes.some((hole) => pointInRing(vertex, hole))
    );
    if (owner < 0) {
      return rejected(inExterior.length ? "holeInHole" : "holeOutside");
    }
    parts = drawing.parts.map((part, i) =>
      i === owner ? { ...part, holes: [...part.holes, open.vertices] } : part
    );
  }
  const problem = drawingProblem(parts);
  return problem
    ? rejected(problem)
    : accepted({ type: "polygon", parts: orientParts(parts), open: null });
};

// A closed ring replaced by an edited one, checked against the whole drawing
const editClosedRing = (
  drawing: PolygonDrawing,
  ref: Exclude<RingRef, "open">,
  ring: Ring
): DrawingEdit => {
  if (pathCrosses(ring, true)) return rejected("crossing");
  const parts = withRing(drawing.parts, ref, ring);
  const problem = drawingProblem(parts);
  // An edit can turn a ring around (a vertex dragged across the opposite edge)
  return problem
    ? rejected(problem)
    : accepted({ ...drawing, parts: orientParts(parts) });
};

const editOpenRing = (drawing: PolygonDrawing, vertices: Ring): DrawingEdit => {
  if (!drawing.open) return rejected("crossing");
  const problem = openRingProblem(drawing.parts, { ...drawing.open, vertices });
  return problem
    ? rejected(problem)
    : accepted({ ...drawing, open: { ...drawing.open, vertices } });
};

/** A vertex of any ring moved. */
export const moveRingVertex = (
  drawing: PolygonDrawing,
  ref: RingRef,
  index: number,
  vertex: Coordinates
): DrawingEdit => {
  const ring = ringAt(drawing, ref);
  if (!ring || index < 0 || index >= ring.length) return rejected("crossing");
  const moved = ring.map((v, i) => (i === index ? vertex : v));
  return ref === "open"
    ? editOpenRing(drawing, moved)
    : editClosedRing(drawing, ref, moved);
};

/** A vertex inserted in any ring (Google Maps' midpoint handles). */
export const insertRingVertex = (
  drawing: PolygonDrawing,
  ref: RingRef,
  index: number,
  vertex: Coordinates
): DrawingEdit => {
  const ring = ringAt(drawing, ref);
  if (!ring || index < 0 || index > ring.length) return rejected("crossing");
  const inserted = [...ring.slice(0, index), vertex, ...ring.slice(index)];
  return ref === "open"
    ? editOpenRing(drawing, inserted)
    : editClosedRing(drawing, ref, inserted);
};

/**
 * A vertex of any ring deleted. A closed ring keeps at least 3 vertices: the
 * ring itself goes with deleteRing. The open ring can lose all of them, and an
 * empty first ring leaves no drawing (null).
 */
export const deleteRingVertex = (
  drawing: PolygonDrawing,
  ref: RingRef,
  index: number
): DrawingEdit | { ok: true; drawing: null } => {
  const ring = ringAt(drawing, ref);
  if (!ring || index < 0 || index >= ring.length) return rejected("crossing");
  const remaining = ring.filter((_, i) => i !== index);
  if (ref === "open") {
    if (remaining.length === 0 && !drawing.parts.length) {
      return { ok: true, drawing: null };
    }
    return editOpenRing(drawing, remaining);
  }
  if (remaining.length < MIN_POLYGON_VERTICES) return rejected("minVertices");
  return editClosedRing(drawing, ref, remaining);
};

/** A closed ring deleted: a hole, or a part with its holes. The last part stays. */
export const deleteRing = (
  drawing: PolygonDrawing,
  ref: Exclude<RingRef, "open">
): DrawingEdit => {
  let parts: Part[];
  if (ref.hole === null) {
    if (drawing.parts.length <= 1) return rejected("lastPart");
    parts = drawing.parts.filter((_, i) => i !== ref.part);
  } else {
    parts = drawing.parts.map((part, i) =>
      i === ref.part
        ? { ...part, holes: part.holes.filter((_, j) => j !== ref.hole) }
        : part
    );
  }
  // Without its hole, an island would lie on the part around it
  const problem = drawingProblem(parts);
  return problem ? rejected(problem) : accepted({ ...drawing, parts });
};

/** Every vertex of the drawing, closed rings first. */
export const drawingVertices = (drawing: Drawing): Coordinates[] =>
  drawing.type === "point"
    ? [drawing.center]
    : [...closedRings(drawing.parts), drawing.open?.vertices ?? []].flat();

// --- The row's geometry ------------------------------------------------------------

/**
 * A finished drawing as the row's geometry fields, in the template's GeoJSON
 * format: a Polygon's rings (the exterior, then its holes) for one part, a
 * MultiPolygon for several, `[lng, lat]` for a point. Null while a ring is being
 * drawn (started, even without a vertex), or for parts that break a rule.
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
  // A ring started with "Add hole" or "Add part" is being drawn, even with no
  // vertex yet: the user closes or discards it
  if (drawing.open || !drawing.parts.length) return null;
  if (drawingProblem(drawing.parts)) return null;
  const polygons = drawing.parts.map(({ exterior, holes }) =>
    [exterior, ...holes].map(closeRing)
  );
  return polygons.length === 1
    ? {
        coordinatesFormat: "GeoJSON",
        geometryType: "Polygon",
        farmCoordinates: JSON.stringify(polygons[0]),
      }
    : {
        coordinatesFormat: "GeoJSON",
        geometryType: "MultiPolygon",
        farmCoordinates: JSON.stringify(polygons),
      };
};

/** Why a listed row's geometry can't be loaded in the drawing tool. */
export type NotEditableReason =
  // WKT, or no format
  | "format"
  // The coordinates don't parse, or the rings break a rule
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

// A GeoJSON ring as a drawing's ring, without its repeated last position
const toRing = (value: unknown): Ring | null => {
  if (!Array.isArray(value) || !value.every(isPosition)) return null;
  const ring = value.map(toCoordinates);
  if (ring.length > 1 && samePoint(ring[0], ring[ring.length - 1])) ring.pop();
  return ring;
};

// A GeoJSON Polygon's rings as a part
const toPart = (value: unknown): Part | null => {
  if (!Array.isArray(value) || !value.length) return null;
  const rings = value.map(toRing);
  if (rings.some((ring) => ring === null)) return null;
  const [exterior, ...holes] = rings as Ring[];
  return { exterior, holes };
};

/**
 * A listed row's geometry as a finished drawing, for edit mode: a GeoJSON Point,
 * Polygon (with its holes) or MultiPolygon. The geometry type isn't trusted for
 * polygons, as the API doesn't: the nesting tells a MultiPolygon.
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
  if (!Array.isArray(coordinates) || !Array.isArray(coordinates[0])) {
    return { editable: false, reason: "invalid" };
  }
  const multi = Array.isArray(coordinates[0][0]?.[0]);
  const parts = (multi ? coordinates : [coordinates]).map(toPart);
  if (!parts.length || parts.some((part) => part === null)) {
    return { editable: false, reason: "invalid" };
  }
  if (drawingProblem(parts as Part[])) {
    return { editable: false, reason: "invalid" };
  }
  return {
    editable: true,
    drawing: {
      type: "polygon",
      parts: orientParts(parts as Part[]),
      open: null,
    },
  };
};

/** The bounds that fit a drawing, to open the map on it in edit mode. */
export const drawingBounds = (
  drawing: Drawing,
  // A point's radius in meters, to fit its circle
  pointRadius = 0
): google.maps.LatLngBoundsLiteral | null => {
  const points = drawingVertices(drawing);
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
