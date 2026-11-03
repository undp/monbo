import { describe, expect, it } from "vitest";
import {
  addVertex,
  areaToRadius,
  canClose,
  closeRing,
  deleteVertex,
  drawingToGeometryFields,
  farmRowToDrawing,
  insertVertex,
  moveVertex,
  pathCrosses,
  segmentsIntersect,
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

describe("drawingToGeometryFields", () => {
  it("writes a polygon as a closed GeoJSON ring", () => {
    const fields = drawingToGeometryFields({
      type: "polygon",
      vertices: square,
      closed: true,
    });
    expect(fields).toEqual({
      coordinatesFormat: "GeoJSON",
      geometryType: "Polygon",
      farmCoordinates: "[[[0,0],[1,0],[1,1],[0,1],[0,0]]]",
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

  it("has no geometry for an open or crossing polygon", () => {
    expect(
      drawingToGeometryFields({
        type: "polygon",
        vertices: square,
        closed: false,
      })
    ).toBeNull();
    expect(
      drawingToGeometryFields({
        type: "polygon",
        vertices: [p(0, 0), p(1, 1), p(1, 0), p(0, 1)],
        closed: true,
      })
    ).toBeNull();
  });
});

describe("farmRowToDrawing", () => {
  it("reads back a polygon and a point it wrote", () => {
    const polygon = {
      type: "polygon" as const,
      vertices: square,
      closed: true,
    };
    const point = { type: "point" as const, center: p(-84.0023, 9.8783) };
    for (const drawing of [polygon, point]) {
      expect(farmRowToDrawing(row(drawingToGeometryFields(drawing)!))).toEqual({
        editable: true,
        drawing,
      });
    }
  });

  it("reads a one-part MultiPolygon row written with a Polygon's rings", () => {
    const result = farmRowToDrawing(
      row({
        coordinatesFormat: "GeoJSON",
        geometryType: "MultiPolygon",
        farmCoordinates: "[[[0,0],[1,0],[1,1],[0,1],[0,0]]]",
      })
    );
    expect(result).toEqual({
      editable: true,
      drawing: { type: "polygon", vertices: square, closed: true },
    });
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
    // With a hole
    expect(
      reason({
        coordinatesFormat: "GeoJSON",
        geometryType: "Polygon",
        farmCoordinates:
          "[[[0,0],[4,0],[4,4],[0,4],[0,0]],[[1,1],[2,1],[2,2],[1,1]]]",
      })
    ).toBe("shape");
    // Two parts
    expect(
      reason({
        coordinatesFormat: "GeoJSON",
        geometryType: "MultiPolygon",
        farmCoordinates:
          "[[[[0,0],[1,0],[1,1],[0,0]]],[[[5,5],[6,5],[6,6],[5,5]]]]",
      })
    ).toBe("shape");
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
