"use client";

import React, { useCallback, useContext, useEffect, useRef } from "react";
import {
  APIProvider,
  ControlPosition,
  Map as GoogleMap,
  GoogleMapsContext,
  MapControl,
  useMap,
} from "@vis.gl/react-google-maps";
import { GOOGLE_SERVICE_API_KEY } from "@/config/env";
import { Coordinates } from "@/interfaces/Map";
import { isEqual } from "lodash";
import { Box, Button, ButtonGroup } from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import CropFreeIcon from "@mui/icons-material/CropFree";

interface MapObject {
  id: string;
  color: string;
  fill?: boolean;
  showPoints?: boolean;
  onClick?: () => void;
}

export interface PolygonObject extends MapObject {
  type: "polygon";
  path: Coordinates[];
}
export interface CircleObject extends MapObject {
  type: "circle";
  center: Coordinates;
  radius: number;
}

interface MapProps {
  mapType?: "satellite" | "roadmap" | "hybrid" | "terrain";
  center?: Coordinates;
  objects?: (PolygonObject | CircleObject)[];
  autoZoom?: boolean;
  zoom?: number;
  onMapClick?: () => void;
  children?: React.ReactNode;
}

export const Map: React.FC<MapProps> = ({
  center,
  objects = [],
  mapType = "roadmap",
  zoom,
  autoZoom,
  onMapClick,
  children,
}) => {
  return (
    <APIProvider apiKey={GOOGLE_SERVICE_API_KEY}>
      <GoogleMap
        mapId={"test"}
        defaultZoom={zoom || 15}
        disableDefaultUI={true}
        defaultCenter={center}
        mapTypeId={mapType}
      >
        <MapControl position={ControlPosition.RIGHT_BOTTOM}>
          <CustomMapControls objects={objects} />
        </MapControl>
        <MapClickHandler onClick={onMapClick} />
        {autoZoom && <AutoZoomMap objects={objects} />}
        {objects.map((obj, idx) => {
          switch (obj.type) {
            case "polygon":
              return (
                <Polygon
                  key={idx}
                  path={obj.path}
                  color={obj.color}
                  fill={obj.fill}
                  showPoints={obj.showPoints}
                  onClick={obj.onClick}
                />
              );
            case "circle":
              return (
                <CircleMarker
                  key={idx}
                  center={obj.center}
                  radius={obj.radius}
                  color={obj.color}
                  fill={obj.fill}
                  showPoints={obj.showPoints}
                  onClick={obj.onClick}
                />
              );
          }
        })}
        {children}
      </GoogleMap>
    </APIProvider>
  );
};

const centerMap = (
  map: google.maps.Map,
  objects: (PolygonObject | CircleObject)[]
) => {
  const bounds = new google.maps.LatLngBounds();
  objects.forEach((obj) => {
    if (obj.type === "circle") {
      const circleBounds = new google.maps.Circle({
        center: obj.center,
        radius: obj.radius,
      }).getBounds();
      if (circleBounds) bounds.union(circleBounds);
    } else if (obj.type === "polygon") {
      obj.path.forEach((point) => bounds.extend(point));
    }
  });
  map.fitBounds(bounds);
};

interface CustomMapControlsProps {
  objects: (PolygonObject | CircleObject)[];
}
const CustomMapControls: React.FC<CustomMapControlsProps> = ({ objects }) => {
  const map = useMap();

  const onZoomIn = useCallback(() => {
    if (!map) return;

    const currentZoom = map.getZoom() || 0;
    map.setZoom(currentZoom + 1);
  }, [map]);

  const onZoomOut = useCallback(() => {
    if (!map) return;

    const currentZoom = map.getZoom() || 20;
    map.setZoom(currentZoom - 1);
  }, [map]);

  const onCenter = useCallback(() => {
    if (!map) return;

    centerMap(map, objects);
  }, [map, objects]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 1 }}>
      <Button
        sx={{ padding: 1, minWidth: 0 }}
        variant="contained"
        onClick={onCenter}
      >
        <CropFreeIcon />
      </Button>
      <ButtonGroup variant="contained" orientation="vertical">
        <Button sx={{ padding: 1, minWidth: 0 }} onClick={onZoomIn}>
          <AddIcon />
        </Button>
        <Button sx={{ padding: 1, minWidth: 0 }} onClick={onZoomOut}>
          <RemoveIcon />
        </Button>
      </ButtonGroup>
    </Box>
  );
};

interface MapClickHandlerProps {
  onClick?: () => void;
}
const MapClickHandler = ({ onClick }: MapClickHandlerProps) => {
  const map = useContext(GoogleMapsContext)?.map;

  useEffect(() => {
    if (!map || !onClick) return;

    const mapClickListener = map.addListener("click", () => onClick());
    return () => {
      google.maps.event.removeListener(mapClickListener);
    };
  });

  return null;
};

const generateCircle = (
  obj: google.maps.Circle,
  center: Coordinates,
  radius: number,
  color: string,
  fillOpacity: number = 0
) => (
  obj.setOptions({
    strokeColor: color,
    fillColor: color,
    strokeWeight: 2,
    fillOpacity: fillOpacity,
  }),
  obj.setCenter(center),
  obj.setRadius(radius)
);

interface AutoZoomMapProps {
  objects: (PolygonObject | CircleObject)[];
}
const AutoZoomMap = ({ objects }: AutoZoomMapProps) => {
  const map = useContext(GoogleMapsContext)?.map;
  const previousObjectsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!map) return;
    if (!objects.length) return;
    const objsIds = objects.map((o) => o.id);
    if (isEqual(previousObjectsRef.current, objsIds)) return;
    previousObjectsRef.current = objsIds;
    centerMap(map, objects);
  }, [map, objects]);

  return null;
};

interface CircleMarkerProps {
  center: Coordinates;
  radius: number;
  color: string;
  fill?: boolean;
  showPoints?: boolean;
  onClick?: () => void;
}

const CircleMarker = ({
  center,
  radius,
  color,
  showPoints,
  fill,
  onClick,
}: CircleMarkerProps) => {
  const map = useContext(GoogleMapsContext)?.map;
  const circle = useRef(new google.maps.Circle()).current;
  const centerCircle = useRef(new google.maps.Circle()).current;
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  generateCircle(circle, center, radius, color, fill ? 0.2 : 0);

  useEffect(() => {
    if (map) {
      circle.setMap(map);
      if (clickListenerRef.current) {
        google.maps.event.removeListener(clickListenerRef.current);
      }

      clickListenerRef.current = circle.addListener("click", () => onClick?.());

      if (showPoints) {
        generateCircle(centerCircle, center, 3, color, 1);
        centerCircle.setMap(map);
      }
    }
    return () => {
      circle.setMap(null);
      centerCircle.setMap(null);
    };
  }, [center, centerCircle, circle, color, map, onClick, showPoints]);

  return null;
};

interface PolygonProps {
  path: Coordinates[];
  color: string;
  fill?: boolean;
  showPoints?: boolean;
  onClick?: () => void;
}
const Polygon = ({ path, color, fill, showPoints, onClick }: PolygonProps) => {
  const map = useContext(GoogleMapsContext)?.map;
  const polygon = useRef(new google.maps.Polygon()).current;
  const points = useRef(path.map(() => new google.maps.Circle())).current;
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);

  polygon.setOptions({
    fillOpacity: fill ? 0.2 : 0,
    fillColor: color,
    strokeColor: color,
    strokeWeight: 2,
  });
  polygon.setPath(path);

  useEffect(() => {
    if (map) {
      polygon.setMap(map);
      if (clickListenerRef.current) {
        google.maps.event.removeListener(clickListenerRef.current);
      }

      clickListenerRef.current = polygon.addListener("click", () =>
        onClick?.()
      );

      if (showPoints) {
        path.forEach((point, idx) => {
          generateCircle(points[idx], point, 3, color, 1);
          points[idx].setMap(map);
        });
      }
    }

    return () => {
      polygon.setMap(null);
      points.forEach((point) => point.setMap(null));
    };
  }, [color, map, onClick, path, points, polygon, showPoints]);

  return null;
};
