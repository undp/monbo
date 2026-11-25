import { useState } from "react";
import { Coordinates } from "@/interfaces/Map";
import {
  addOpenVertex,
  closeOpenRing,
  deleteRing,
  deleteRingVertex,
  discardOpenRing,
  Drawing,
  DrawingEdit,
  DrawingProblem,
  insertRingVertex,
  moveRingVertex,
  OpenRing,
  sameRing,
  startDrawing,
  startRing,
} from "@/utils/drawing";
import { PathEdit, VertexRef } from "./DrawingMap";

/**
 * The manual farm modal's drawing: the mode (polygon or point), the drawing, the
 * selected vertex and the last rejected edit's problem. Every edit goes through
 * utils/drawing.ts, which accepts it or says which rule it broke.
 */
export const useFarmDrawing = (initial: Drawing | null) => {
  const [mode, setMode] = useState<Drawing["type"]>(
    initial?.type ?? "polygon"
  );
  const [drawing, setDrawing] = useState<Drawing | null>(initial);
  const [selectedVertex, setSelectedVertex] = useState<VertexRef | null>(null);
  const [error, setError] = useState<DrawingProblem | null>(null);

  const polygon = drawing?.type === "polygon" ? drawing : null;

  const update = (next: Drawing | null) => {
    setDrawing(next);
    setError(null);
  };

  // An edit of the polygon: applied, or its problem shown. Whether it applied.
  const apply = (edit: DrawingEdit | { ok: true; drawing: null }) => {
    if (!edit.ok) {
      setError(edit.problem);
      return false;
    }
    setSelectedVertex(null);
    update(edit.drawing);
    return true;
  };

  const startOver = () => {
    update(null);
    setSelectedVertex(null);
  };

  const finish = () => {
    if (polygon?.open) apply(closeOpenRing(polygon));
  };

  const removeVertex = ({ ring, index }: VertexRef) => {
    if (polygon) apply(deleteRingVertex(polygon, ring, index));
  };

  const addRing = (kind: OpenRing["kind"]) => {
    if (!polygon) return;
    setSelectedVertex(null);
    update(startRing(polygon, kind));
  };

  const discardRing = () => {
    if (polygon) update(discardOpenRing(polygon));
  };

  const removeSelectedRing = () => {
    if (polygon && selectedVertex && selectedVertex.ring !== "open") {
      apply(deleteRing(polygon, selectedVertex.ring));
    }
  };

  // Whether the click placed the point or added a vertex
  const onMapClick = (position: Coordinates) => {
    if (mode === "point") {
      update({ type: "point", center: position });
      return true;
    }
    if (!polygon) {
      update(startDrawing(position));
      return true;
    }
    if (!polygon.open) {
      setSelectedVertex(null);
      return false;
    }
    return apply(addOpenVertex(polygon, position));
  };

  const onVertexClick = ({ ring, index }: VertexRef) => {
    if (!polygon) return;
    if (ring === "open") {
      if (index === 0) finish();
      return;
    }
    setSelectedVertex((current) =>
      current && sameRing(current.ring, ring) && current.index === index
        ? null
        : { ring, index }
    );
  };

  const onPathEdit = ({ ring, kind, index, position }: PathEdit) => {
    if (!polygon) return false;
    return apply(
      kind === "move"
        ? moveRingVertex(polygon, ring, index, position)
        : insertRingVertex(polygon, ring, index, position)
    );
  };

  const movePoint = (center: Coordinates) => update({ type: "point", center });

  const changeMode = (next: Drawing["type"] | null) => {
    if (!next || next === mode) return;
    setMode(next);
    startOver();
  };

  // The instructions under the map, for what the user is drawing now
  const instructionsKey =
    mode === "point"
      ? "point"
      : !polygon || (polygon.open && !polygon.parts.length)
        ? "polygon"
        : polygon.open
          ? polygon.open.kind === "hole"
            ? "newHole"
            : "newPart"
          : "polygonClosed";

  return {
    mode,
    drawing,
    polygon,
    selectedVertex,
    error,
    instructionsKey,
    clearError: () => setError(null),
    changeMode,
    startOver,
    finish,
    removeVertex,
    addRing,
    discardRing,
    removeSelectedRing,
    onMapClick,
    onVertexClick,
    onPathEdit,
    movePoint,
  };
};

export type FarmDrawing = ReturnType<typeof useFarmDrawing>;
