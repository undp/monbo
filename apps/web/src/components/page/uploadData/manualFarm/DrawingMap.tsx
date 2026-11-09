"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  APIProvider,
  Map as GoogleMap,
  useMap,
} from "@vis.gl/react-google-maps";
import { GCP_MAPS_PLATFORM_API_KEY } from "@/config/env";
import { Coordinates } from "@/interfaces/Map";
import { Drawing, ringAt, RingRef } from "@/utils/drawing";

// The manual farm modal's map: it draws the farm with Maps JavaScript API overlays
// (Google's Drawing Library is gone) and reports the user's clicks and edits, with
// the ring they touched. The modal owns the drawing and validates every edit with
// utils/drawing.ts.

const COLOR = "#FFD54F";
// A point is placed closer than this zoom: the map zooms in on it
const POINT_ZOOM = 16;
// "Go" to coordinates zooms here
const FOCUS_ZOOM = 17;
const WORLD = { center: { lat: 0, lng: 0 }, zoom: 2 };

// A vertex of a ring
export type VertexRef = { ring: RingRef; index: number };

export type PathEdit = VertexRef & {
  // A vertex dragged, or a midpoint handle dragged out into a new vertex
  kind: "move" | "insert";
  position: Coordinates;
};

export interface DrawingMapProps {
  mode: Drawing["type"];
  drawing: Drawing | null;
  // A point farm's circle, in meters
  radius: number;
  selectedVertex: VertexRef | null;
  // Where the map opens; the world when null
  initialBounds: google.maps.LatLngBoundsLiteral | null;
  // Pans there whenever `key` changes, and zooms in unless `keepZoom`
  focus: { center: Coordinates; key: number; keepZoom?: boolean } | null;
  onMapClick: (position: Coordinates) => void;
  onVertexClick: (vertex: VertexRef) => void;
  onVertexRightClick: (vertex: VertexRef) => void;
  // Whether the edit is accepted: a rejected one is undone on the map
  onPathEdit: (edit: PathEdit) => boolean;
  onPointMove: (center: Coordinates) => void;
}

export const DrawingMap: React.FC<DrawingMapProps> = ({
  initialBounds,
  ...props
}) => (
  <APIProvider apiKey={GCP_MAPS_PLATFORM_API_KEY}>
    <GoogleMap
      mapId="test"
      mapTypeId="satellite"
      {...(initialBounds
        ? { defaultBounds: initialBounds }
        : { defaultCenter: WORLD.center, defaultZoom: WORLD.zoom })}
      disableDoubleClickZoom
      clickableIcons={false}
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl
      draggableCursor="crosshair"
    >
      <DrawingLayer {...props} />
    </GoogleMap>
  </APIProvider>
);

const toLiteral = (latLng: google.maps.LatLng): Coordinates => ({
  lat: latLng.lat(),
  lng: latLng.lng(),
});

const Dot = ({ size, filled }: { size: number; filled: boolean }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      border: `2px solid ${filled ? "#FFFFFF" : COLOR}`,
      background: filled ? COLOR : "transparent",
      boxShadow: "0 0 2px rgba(0, 0, 0, 0.8)",
      pointerEvents: "none",
    }}
  />
);

const DrawingLayer: React.FC<Omit<DrawingMapProps, "initialBounds">> = (
  props
) => {
  const map = useMap();
  const { drawing, radius, selectedVertex, focus } = props;
  // The latest callbacks, for the listeners added once per overlay
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  // Bumped to redraw the polygon after a rejected edit, which Google Maps already
  // applied to its path
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener(
      "click",
      (event: google.maps.MapMouseEvent) => {
        if (!event.latLng) return;
        if (
          latest.current.mode === "point" &&
          (map.getZoom() ?? 0) < POINT_ZOOM
        ) {
          map.setZoom(POINT_ZOOM);
          map.panTo(event.latLng);
        }
        latest.current.onMapClick(toLiteral(event.latLng));
      }
    );
    return () => listener.remove();
  }, [map]);

  useEffect(() => {
    if (!map || !focus) return;
    if (!focus.keepZoom) map.setZoom(FOCUS_ZOOM);
    map.panTo(focus.center);
  }, [map, focus]);

  useEffect(() => {
    if (!map || drawing?.type !== "polygon") return;
    // While a ring is being drawn, the closed parts let clicks through to the map,
    // where they add its vertices (a hole is drawn inside a part)
    const editable = !drawing.open;
    const style = { strokeColor: COLOR, strokeWeight: 2, map };
    const overlays: (google.maps.Polygon | google.maps.Polyline)[] = [];
    const listeners: google.maps.MapsEventListener[] = [];

    const watch = (
      overlay: google.maps.Polygon | google.maps.Polyline,
      paths: google.maps.MVCArray<google.maps.LatLng>[],
      ringOf: (path: number) => RingRef
    ) => {
      overlays.push(overlay);
      const edit = (path: number, kind: PathEdit["kind"], index: number) => {
        const position = toLiteral(paths[path].getAt(index));
        const ring = ringOf(path);
        if (!latest.current.onPathEdit({ ring, kind, index, position })) {
          setRevision((value) => value + 1);
        }
      };
      listeners.push(
        overlay.addListener("click", (event: google.maps.PolyMouseEvent) => {
          const ring = ringOf(event.path ?? 0);
          if (event.vertex !== undefined) {
            latest.current.onVertexClick({ ring, index: event.vertex });
          } else if (ring === "open" && event.latLng) {
            // A click on the line being drawn adds a vertex, as one on the map does
            latest.current.onMapClick(toLiteral(event.latLng));
          }
        }),
        overlay.addListener(
          "contextmenu",
          (event: google.maps.PolyMouseEvent) => {
            if (event.vertex !== undefined) {
              latest.current.onVertexRightClick({
                ring: ringOf(event.path ?? 0),
                index: event.vertex,
              });
            }
          }
        ),
        ...paths.flatMap((path, i) => [
          path.addListener("set_at", (index: number) => edit(i, "move", index)),
          path.addListener("insert_at", (index: number) =>
            edit(i, "insert", index)
          ),
        ])
      );
    };

    // Each part, with its holes as its other paths
    drawing.parts.forEach(({ exterior, holes }, part) => {
      const polygon = new google.maps.Polygon({
        ...style,
        paths: [exterior, ...holes],
        fillColor: COLOR,
        fillOpacity: 0.2,
        editable,
        clickable: editable,
      });
      watch(polygon, polygon.getPaths().getArray(), (path) => ({
        part,
        hole: path === 0 ? null : path - 1,
      }));
    });
    if (drawing.open?.vertices.length) {
      const line = new google.maps.Polyline({
        ...style,
        path: drawing.open.vertices,
        editable: true,
      });
      watch(line, [line.getPath()], () => "open");
    }

    return () => {
      listeners.forEach((listener) => listener.remove());
      overlays.forEach((overlay) => overlay.setMap(null));
    };
  }, [map, drawing, revision]);

  const center = drawing?.type === "point" ? drawing.center : null;
  useEffect(() => {
    if (!map || !center) return;
    const circle = new google.maps.Circle({
      map,
      center,
      radius,
      draggable: true,
      strokeColor: COLOR,
      strokeWeight: 2,
      fillColor: COLOR,
      fillOpacity: 0.2,
    });
    const listeners = [
      circle.addListener("dragend", () => {
        const moved = circle.getCenter();
        if (moved) latest.current.onPointMove(toLiteral(moved));
      }),
      // A click inside the circle moves the point there, as one on the map does
      circle.addListener("click", (event: google.maps.MapMouseEvent) => {
        if (event.latLng) latest.current.onMapClick(toLiteral(event.latLng));
      }),
    ];
    return () => {
      listeners.forEach((listener) => listener.remove());
      circle.setMap(null);
    };
  }, [map, center, radius]);

  const selected =
    drawing?.type === "polygon" && selectedVertex
      ? ringAt(drawing, selectedVertex.ring)?.[selectedVertex.index]
      : undefined;

  return (
    <>
      {/* The circle can be tiny at a low zoom: its center always shows */}
      {center && (
        <AdvancedMarker
          position={center}
          anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
          clickable={false}
        >
          <Dot size={12} filled />
        </AdvancedMarker>
      )}
      {selected && (
        <AdvancedMarker
          position={selected}
          anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
          clickable={false}
        >
          <Dot size={22} filled={false} />
        </AdvancedMarker>
      )}
    </>
  );
};
