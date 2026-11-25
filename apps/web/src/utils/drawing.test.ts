import { describe, expect, it } from "vitest";
import {
  addOpenVertex,
  addVertex,
  areaToRadius,
  canClose,
  closeOpenRing,
  closeRing,
  deleteRing,
  deleteRingVertex,
  deleteVertex,
  discardOpenRing,
  Drawing,
  DrawingEdit,
  drawingProblem,
  drawingToGeometryFields,
  farmRowToDrawing,
  insertRingVertex,
  insertVertex,
  moveRingVertex,
  moveVertex,
  orientRing,
  Part,
  pathCrosses,
  PolygonDrawing,
  Ring,
  segmentsIntersect,
  startDrawing,
  startRing,
} from "./drawing";
import { getCountryBounds } from "./countryBounds";
import { FarmRow } from "@/interfaces/FarmRow";

const p = (lng: number, lat: number) => ({ lat, lng });

// A unit square, counter-clockwise from the origin
const square = [p(0, 0), p(1, 0), p(1, 1), p(0, 1)];

const row = (fields: Partial<FarmRow>): FarmRow => ({
  documents: [],
  ...fields,
});

describe("segmentsIntersect", () => {
  it("finds a crossing, a touch and a collinear overlap", () => {
    expect(segmentsIntersect(p(0, 0), p(1, 1), p(0, 1), p(1, 0))).toBe(true);
    expect(segmentsIntersect(p(0, 0), p(2, 0), p(1, 0), p(1, 1))).toBe(true);
    expect(segmentsIntersect(p(0, 0), p(2, 0), p(1, 0), p(3, 0))).toBe(true);
  });

  it("ignores segments apart, parallel or collinear without overlap", () => {
    expect(segmentsIntersect(p(0, 0), p(1, 0), p(0, 1), p(1, 1))).toBe(false);
    expect(segmentsIntersect(p(0, 0), p(1, 0), p(2, 0), p(3, 0))).toBe(false);
    expect(segmentsIntersect(p(0, 0), p(1, 1), p(2, 0), p(3, -1))).toBe(false);
  });
});

describe("pathCrosses", () => {
  it("accepts a square, open or closed", () => {
    expect(pathCrosses(square, false)).toBe(false);
    expect(pathCrosses(square, true)).toBe(false);
  });

  it("rejects a bow tie", () => {
    const bowTie = [p(0, 0), p(1, 1), p(1, 0), p(0, 1)];
    expect(pathCrosses(bowTie, false)).toBe(true);
  });

  it("rejects a path that folds back over its last edge", () => {
    expect(pathCrosses([p(0, 0), p(2, 0), p(1, 0)], false)).toBe(true);
  });

  it("accepts three vertices in a straight line while open", () => {
    expect(pathCrosses([p(0, 0), p(1, 0), p(2, 0)], false)).toBe(false);
  });

  it("rejects a repeated vertex", () => {
    expect(pathCrosses([p(0, 0), p(1, 0), p(1, 1), p(1, 0)], false)).toBe(true);
  });
});

describe("addVertex", () => {
  it("adds a vertex at the end", () => {
    expect(addVertex(square.slice(0, 3), p(0, 1))).toEqual(square);
    expect(addVertex([], p(0, 0))).toEqual([p(0, 0)]);
  });

  it("rejects a vertex whose edge crosses the path", () => {
    // From (1, 1) to (0.5, -1) crosses the first edge, (0, 0)–(1, 0)
    expect(addVertex(square.slice(0, 3), p(0.5, -1))).toBeNull();
  });

  it("rejects a second click on the same spot", () => {
    expect(addVertex(square.slice(0, 2), p(1, 0))).toBeNull();
  });
});

describe("moveVertex", () => {
  it("moves a vertex", () => {
    expect(moveVertex(square, 2, p(2, 2), true)).toEqual([
      p(0, 0),
      p(1, 0),
      p(2, 2),
      p(0, 1),
    ]);
  });

  it("rejects a move that makes edges cross", () => {
    // (1, 1) dragged past the opposite edges, below (0, 0)–(1, 0)
    expect(moveVertex(square, 2, p(0.5, -1), true)).toBeNull();
  });

  it("checks the closing edge only once closed", () => {
    // Moving (0, 1) to (2, 0.5): its edge to (0, 0) crosses (1, 0)–(1, 1)
    expect(moveVertex(square, 3, p(2, 0.5), false)).not.toBeNull();
    expect(moveVertex(square, 3, p(2, 0.5), true)).toBeNull();
  });
});

describe("insertVertex", () => {
  it("inserts a midpoint dragged out of an edge", () => {
    expect(insertVertex(square, 1, p(0.5, -0.5), true)).toEqual([
      p(0, 0),
      p(0.5, -0.5),
      p(1, 0),
      p(1, 1),
      p(0, 1),
    ]);
  });

  it("rejects a midpoint dragged across the polygon", () => {
    expect(insertVertex(square, 1, p(0.5, 2), true)).toBeNull();
  });
});

describe("deleteVertex", () => {
  it("deletes a vertex", () => {
    expect(deleteVertex(square, 1, true)).toEqual([p(0, 0), p(1, 1), p(0, 1)]);
  });

  it("keeps at least 3 vertices in a closed polygon", () => {
    expect(deleteVertex(square.slice(0, 3), 0, true)).toBeNull();
  });

  it("can undo vertices while drawing", () => {
    expect(deleteVertex([p(0, 0), p(1, 0)], 1, false)).toEqual([p(0, 0)]);
  });

  it("rejects a delete whose new edge would cross another", () => {
    // A U: removing (4, 0) joins (0, 0) to (4, 4), across the U's right arm
    const u = [
      p(0, 0),
      p(4, 0),
      p(4, 4),
      p(3, 4),
      p(3, 1),
      p(1, 1),
      p(1, 4),
      p(0, 4),
    ];
    expect(deleteVertex(u, 1, true)).toBeNull();
    // Removing (3, 1) joins (3, 4) to (1, 1), which crosses nothing
    expect(deleteVertex(u, 4, true)).toHaveLength(7);
  });
});

describe("canClose and closeRing", () => {
  it("needs 3 vertices and a closing edge that crosses nothing", () => {
    expect(canClose(square.slice(0, 2))).toBe(false);
    expect(canClose(square)).toBe(true);
    // A Z: its closing edge, (1, 1)–(0, 0), crosses the middle one
    expect(canClose([p(0, 0), p(1, 0), p(0, 1), p(1, 1)])).toBe(false);
  });

  it("repeats the first position at the end, in [lng, lat]", () => {
    expect(closeRing([p(-70.1, -33.4), p(-70, -33.4), p(-70, -33.3)])).toEqual([
      [-70.1, -33.4],
      [-70, -33.4],
      [-70, -33.3],
      [-70.1, -33.4],
    ]);
  });

  it("rounds to 7 decimals", () => {
    expect(closeRing([p(-70.123456789, -33.987654321)])[0]).toEqual([
      -70.1234568, -33.9876543,
    ]);
  });
});

describe("areaToRadius", () => {
  it("is the radius of a circle of that area, like the API's", () => {
    // 1 ha = 10,000 m²: r = sqrt(10000 / π)
    expect(areaToRadius(1)).toBe(56.42);
    expect(areaToRadius(2.5)).toBe(89.21);
  });
});

// Rings of a farm 10 units wide, counter-clockwise
const rect = (west: number, south: number, east: number, north: number) => [
  p(west, south),
  p(east, south),
  p(east, north),
  p(west, north),
];
const OUTER = rect(0, 0, 10, 10);
const HOLE = rect(2, 2, 5, 5);
const ISLAND = rect(3, 3, 4, 4);
const BESIDE = rect(20, 0, 25, 5);

const polygon = (...parts: Part[]): PolygonDrawing => ({
  type: "polygon",
  parts,
  open: null,
});

// Draws a ring as the user does: its vertices one by one, then "Close polygon"
const draw = (
  drawing: PolygonDrawing | null,
  kind: "part" | "hole",
  ring: Ring
): DrawingEdit => {
  let current = drawing
    ? startRing(drawing, kind)
    : { ...startDrawing(ring[0]), open: { kind, vertices: [] } };
  for (const vertex of ring) {
    const added = addOpenVertex(current, vertex);
    if (!added.ok) return added;
    current = added.drawing;
  }
  return closeOpenRing(current);
};

const drawn = (
  edit: DrawingEdit | { ok: true; drawing: null }
): PolygonDrawing => {
  if (!edit.ok) throw new Error(`rejected: ${edit.problem}`);
  if (!edit.drawing) throw new Error("no drawing left");
  return edit.drawing;
};

const problem = (edit: DrawingEdit | { ok: true; drawing: null }) => (edit.ok ? null : edit.problem);

describe("drawing parts and holes", () => {
  it("closes the first ring as the farm's first part", () => {
    expect(drawn(draw(null, "part", OUTER))).toEqual(
      polygon({ exterior: OUTER, holes: [] })
    );
  });

  it("adds a hole to the part it lies in, and a part beside it", () => {
    const withHole = drawn(draw(drawn(draw(null, "part", OUTER)), "hole", HOLE));
    const farm = drawn(draw(withHole, "part", BESIDE));

    expect(farm.parts).toHaveLength(2);
    expect(farm.parts[0].holes).toHaveLength(1);
    expect(farm.parts[1]).toEqual({ exterior: BESIDE, holes: [] });
  });

  it("accepts a part inside another part's hole, and a hole in that island", () => {
    const withHole = drawn(draw(drawn(draw(null, "part", OUTER)), "hole", HOLE));
    const island = drawn(draw(withHole, "part", ISLAND));
    const lake = drawn(draw(island, "hole", rect(3.2, 3.2, 3.8, 3.8)));

    expect(island.parts).toHaveLength(2);
    // The hole goes to the island, the innermost part around it
    expect(lake.parts[1].holes).toHaveLength(1);
    expect(lake.parts[0].holes).toHaveLength(1);
  });

  it("rejects a hole's vertex off the farm, from the first one", () => {
    const hole = startRing(drawn(draw(null, "part", OUTER)), "hole");
    expect(problem(addOpenVertex(hole, p(-1, 5)))).toBe("holeOutside");
    // On the border it isn't inside either: rejected one way or the other
    expect(["holeOutside", "ringsTouch"]).toContain(
      problem(addOpenVertex(hole, p(0, 5)))
    );
    const first = drawn(addOpenVertex(hole, p(2, 2)));
    expect(problem(addOpenVertex(first, p(12, 2)))).toBe("holeOutside");
  });

  it("rejects a hole's vertex in another hole", () => {
    const farm = drawn(draw(drawn(draw(null, "part", OUTER)), "hole", HOLE));
    expect(problem(addOpenVertex(startRing(farm, "hole"), p(3, 3)))).toBe(
      "holeInHole"
    );
  });

  it("rejects a new part's vertex on the farm, but not in a hole", () => {
    const farm = drawn(draw(drawn(draw(null, "part", OUTER)), "hole", HOLE));
    const part = startRing(farm, "part");
    expect(problem(addOpenVertex(part, p(8, 8)))).toBe("partOverlaps");
    expect(addOpenVertex(part, p(3, 3)).ok).toBe(true);
    // A first vertex off the farm, then one on it
    const outside = drawn(addOpenVertex(part, p(12, 8)));
    expect(problem(addOpenVertex(outside, p(8, 8)))).toBe("partOverlaps");
  });

  it("rejects an open ring's edge that crosses a closed ring", () => {
    const part = startRing(drawn(draw(null, "part", OUTER)), "part");
    const first = drawn(addOpenVertex(part, p(-1, 5)));
    // Both vertices off the farm, the edge across it
    expect(problem(addOpenVertex(first, p(11, 5)))).toBe("ringsTouch");
  });

  it("rejects a hole outside the farm, and one inside another hole", () => {
    const farm = drawn(draw(drawn(draw(null, "part", OUTER)), "hole", HOLE));
    expect(problem(draw(farm, "hole", BESIDE))).toBe("holeOutside");
    expect(problem(draw(farm, "hole", ISLAND))).toBe("holeInHole");
    // A hole around the other one
    expect(problem(draw(farm, "hole", rect(1, 1, 6, 6)))).toBe("holeInHole");
  });

  it("rejects a part on another one, or around it", () => {
    const farm = drawn(draw(null, "part", HOLE));
    expect(problem(draw(farm, "part", ISLAND))).toBe("partOverlaps");
    expect(problem(draw(farm, "part", OUTER))).toBe("partOverlaps");
    // Overlapping: its first vertex lies on the other part
    expect(problem(draw(farm, "part", rect(4, 4, 8, 8)))).toBe("partOverlaps");
  });

  it("rejects parts that share an edge or a vertex", () => {
    const farm = drawn(draw(null, "part", rect(0, 0, 5, 5)));
    expect(problem(draw(farm, "part", rect(5, 0, 8, 5)))).toBe("ringsTouch");
    expect(problem(draw(farm, "part", rect(5, 5, 8, 8)))).toBe("ringsTouch");
  });

  it("needs 3 vertices, and a closing edge that crosses nothing, to close", () => {
    const farm = startRing(drawn(draw(null, "part", OUTER)), "hole");
    const two = [p(2, 2), p(3, 2)].reduce(
      (current, vertex) => drawn(addOpenVertex(current, vertex)),
      farm
    );
    expect(problem(closeOpenRing(two))).toBe("minVertices");
  });
});

describe("editing a farm's rings", () => {
  const farm = drawn(
    draw(drawn(draw(drawn(draw(null, "part", OUTER)), "hole", HOLE)), "part", BESIDE)
  );
  const exterior = { part: 0, hole: null };
  const hole = { part: 0, hole: 0 };

  it("rejects an exterior vertex dragged over a hole", () => {
    // OUTER's vertex (10, 10) dragged to (3, 3), inside the hole
    expect(problem(moveRingVertex(farm, exterior, 2, p(3, 3)))).toBe(
      "ringsTouch"
    );
  });

  it("rejects a hole vertex dragged out of its part, or onto another part", () => {
    expect(problem(moveRingVertex(farm, hole, 2, p(12, 5)))).toBe("ringsTouch");
    expect(problem(moveRingVertex(farm, hole, 2, p(22, 3)))).toBe("ringsTouch");
  });

  it("moves and inserts vertices that keep the rules", () => {
    const moved = drawn(moveRingVertex(farm, hole, 2, p(6, 6)));
    expect(moved.parts[0].holes[0][2]).toEqual(p(6, 6));
    const inserted = drawn(insertRingVertex(farm, exterior, 1, p(5, -1)));
    expect(inserted.parts[0].exterior).toHaveLength(5);
  });

  it("keeps a closed ring's 3 vertices", () => {
    const triangle = drawn(draw(null, "part", [p(0, 0), p(4, 0), p(2, 3)]));
    expect(
      problem(deleteRingVertex(triangle, { part: 0, hole: null }, 0))
    ).toBe("minVertices");
  });

  it("deletes a hole, and a part with its holes, but not the last part", () => {
    const withoutHole = drawn(deleteRing(farm, hole));
    expect(withoutHole.parts[0].holes).toEqual([]);

    const withoutPart = drawn(deleteRing(farm, exterior));
    expect(withoutPart.parts).toHaveLength(1);
    expect(withoutPart.parts[0].exterior).toEqual(BESIDE);

    expect(problem(deleteRing(withoutPart, exterior))).toBe("lastPart");
  });

  it("won't delete the hole an island lies in", () => {
    const island = drawn(draw(farm, "part", ISLAND));
    expect(problem(deleteRing(island, hole))).toBe("partOverlaps");
  });

  it("lets the open ring lose every vertex, and leaves no drawing for the first", () => {
    const open = drawn(addOpenVertex(startDrawing(p(0, 0)), p(1, 0)));
    const one = drawn(deleteRingVertex(open, "open", 1));
    expect(deleteRingVertex(one, "open", 0)).toEqual({ ok: true, drawing: null });
  });

  it("discards the ring being drawn", () => {
    const opened = startRing(farm, "hole");
    expect(discardOpenRing(opened)).toEqual(farm);
    expect(discardOpenRing(startDrawing(p(0, 0)))).toBeNull();
  });
});

describe("orientRing", () => {
  const clockwise = [p(0, 0), p(0, 1), p(1, 1), p(1, 0)];

  it("winds an exterior counter-clockwise and a hole clockwise", () => {
    expect(orientRing(square, false)).toBe(square);
    expect(orientRing(clockwise, true)).toBe(clockwise);
  });

  it("keeps the first vertex first when it turns a ring around", () => {
    expect(orientRing(clockwise, false)).toEqual([
      p(0, 0),
      p(1, 0),
      p(1, 1),
      p(0, 1),
    ]);
    expect(orientRing(square, true)).toEqual([p(0, 0), p(0, 1), p(1, 1), p(1, 0)]);
  });

  it("orients a ring drawn the other way when it closes", () => {
    const farm = drawn(draw(null, "part", [...OUTER].reverse()));
    expect(farm.parts[0].exterior[0]).toEqual(OUTER[3]);
    expect(orientRing(farm.parts[0].exterior, false)).toBe(
      farm.parts[0].exterior
    );
  });
});

describe("drawingProblem", () => {
  it("accepts a farm with a hole, a part beside it and an island", () => {
    expect(
      drawingProblem([
        { exterior: OUTER, holes: [HOLE] },
        { exterior: BESIDE, holes: [] },
        { exterior: ISLAND, holes: [] },
      ])
    ).toBeNull();
  });
});

describe("drawingToGeometryFields", () => {
  it("writes one part as a Polygon, with its holes after its exterior", () => {
    expect(drawingToGeometryFields(polygon({ exterior: square, holes: [] })))
      .toEqual({
        coordinatesFormat: "GeoJSON",
        geometryType: "Polygon",
        farmCoordinates: "[[[0,0],[1,0],[1,1],[0,1],[0,0]]]",
      });
    expect(
      drawingToGeometryFields(
        polygon({ exterior: OUTER, holes: [orientRing(HOLE, true)] })
      )?.farmCoordinates
    ).toBe(
      "[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[2,2],[2,5],[5,5],[5,2],[2,2]]]"
    );
  });

  it("writes several parts as a MultiPolygon", () => {
    expect(
      drawingToGeometryFields(
        polygon({ exterior: square, holes: [] }, { exterior: BESIDE, holes: [] })
      )
    ).toEqual({
      coordinatesFormat: "GeoJSON",
      geometryType: "MultiPolygon",
      farmCoordinates:
        "[[[[0,0],[1,0],[1,1],[0,1],[0,0]]],[[[20,0],[25,0],[25,5],[20,5],[20,0]]]]",
    });
  });

  it("writes a point as [lng, lat]", () => {
    expect(
      drawingToGeometryFields({ type: "point", center: p(-84.0023, 9.8783) })
    ).toEqual({
      coordinatesFormat: "GeoJSON",
      geometryType: "Point",
      farmCoordinates: "[-84.0023,9.8783]",
    });
  });

  it("has no geometry while a ring is being drawn, or for broken parts", () => {
    expect(drawingToGeometryFields(startDrawing(p(0, 0)))).toBeNull();
    const farm = polygon({ exterior: square, holes: [] });
    expect(
      drawingToGeometryFields(
        drawn(addOpenVertex(startRing(farm, "hole"), p(0.5, 0.5)))
      )
    ).toBeNull();
    // A hole started and not drawn is a ring being drawn: discard it to add
    expect(drawingToGeometryFields(startRing(farm, "hole"))).toBeNull();
    expect(drawingToGeometryFields(startRing(farm, "part"))).toBeNull();
    expect(
      drawingToGeometryFields(
        polygon({ exterior: [p(0, 0), p(1, 1), p(1, 0), p(0, 1)], holes: [] })
      )
    ).toBeNull();
  });
});

describe("farmRowToDrawing", () => {
  it("reads back a point, a polygon with a hole and a MultiPolygon it wrote", () => {
    const drawings: Drawing[] = [
      { type: "point", center: p(-84.0023, 9.8783) },
      polygon({ exterior: OUTER, holes: [orientRing(HOLE, true)] }),
      polygon(
        { exterior: OUTER, holes: [orientRing(HOLE, true)] },
        { exterior: BESIDE, holes: [] },
        { exterior: ISLAND, holes: [] }
      ),
    ];
    for (const drawing of drawings) {
      expect(farmRowToDrawing(row(drawingToGeometryFields(drawing)!))).toEqual({
        editable: true,
        drawing,
      });
    }
  });

  it("reads a one-part MultiPolygon row written with a Polygon's rings", () => {
    expect(
      farmRowToDrawing(
        row({
          coordinatesFormat: "GeoJSON",
          geometryType: "MultiPolygon",
          farmCoordinates: "[[[0,0],[1,0],[1,1],[0,1],[0,0]]]",
        })
      )
    ).toEqual({ editable: true, drawing: polygon({ exterior: square, holes: [] }) });
  });

  it("orients the rings it reads", () => {
    const result = farmRowToDrawing(
      row({
        coordinatesFormat: "GeoJSON",
        geometryType: "Polygon",
        // Exterior clockwise, hole counter-clockwise
        farmCoordinates:
          "[[[0,0],[0,10],[10,10],[10,0],[0,0]],[[2,2],[5,2],[5,5],[2,5],[2,2]]]",
      })
    );
    if (!result.editable || result.drawing.type !== "polygon") {
      throw new Error("expected an editable polygon");
    }
    const [part] = result.drawing.parts;
    expect(orientRing(part.exterior, false)).toBe(part.exterior);
    expect(orientRing(part.holes[0], true)).toBe(part.holes[0]);
  });

  it("says why other rows aren't editable", () => {
    const reason = (fields: Partial<FarmRow>) => {
      const result = farmRowToDrawing(row(fields));
      return result.editable ? null : result.reason;
    };
    expect(
      reason({
        coordinatesFormat: "WKT",
        geometryType: "Polygon",
        farmCoordinates: "POLYGON((0 0, 1 0, 1 1, 0 0))",
      })
    ).toBe("format");
    expect(
      reason({
        coordinatesFormat: "GeoJSON",
        geometryType: "Point",
        farmCoordinates: "not json",
      })
    ).toBe("invalid");
    expect(
      reason({
        coordinatesFormat: "GeoJSON",
        geometryType: "Polygon",
        farmCoordinates: "[[[0,0],[1,1],[1,0],[0,1],[0,0]]]",
      })
    ).toBe("invalid");
    // A hole outside its part
    expect(
      reason({
        coordinatesFormat: "GeoJSON",
        geometryType: "Polygon",
        farmCoordinates:
          "[[[0,0],[4,0],[4,4],[0,4],[0,0]],[[6,6],[7,6],[7,7],[6,6]]]",
      })
    ).toBe("invalid");
  });
});

describe("getCountryBounds", () => {
  it("has the selected country's box, as [west, south, east, north]", () => {
    const chile = getCountryBounds("CL")!;
    // Mainland Chile, without Easter Island
    expect(chile.west).toBeGreaterThan(-76);
    expect(chile.east).toBeLessThan(-66);
    expect(chile.south).toBeLessThan(-55);
    expect(chile.north).toBeGreaterThan(-18);
    expect(getCountryBounds("cl")).toEqual(chile);
  });

  it("is null for an unknown code or no country", () => {
    expect(getCountryBounds("ZZ")).toBeNull();
    expect(getCountryBounds(null)).toBeNull();
  });
});
