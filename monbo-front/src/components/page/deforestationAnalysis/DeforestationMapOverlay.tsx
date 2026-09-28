"use client";

import { GoogleMapsContext } from "@vis.gl/react-google-maps";
import { useContext, useEffect } from "react";
import { DEFORESTATION_ANALYSIS_TILES_URL } from "@/config/env";
import { useSelectedMap } from "@/hooks/useSelectedMapName";

export const DeforestationMapOverlay = () => {
  const { id, version } = useSelectedMap();
  const map = useContext(GoogleMapsContext)?.map;

  useEffect(() => {
    if (!map) return;

    const overlay = new google.maps.ImageMapType({
      name: "Deforestation Analysis",
      // `v` changes when the layer's raster is replaced, so cached tiles aren't reused
      getTileUrl: (coord, zoom) =>
        zoom < 12
          ? null
          : `${DEFORESTATION_ANALYSIS_TILES_URL}/${id}/dynamic/${zoom}/${coord.x}/${coord.y}.png?v=${version}`,
      tileSize: new google.maps.Size(256, 256),
      maxZoom: 20,
      minZoom: 12,
    });
    map.overlayMapTypes.push(overlay);

    return () => {
      const idx = map.overlayMapTypes.getArray().indexOf(overlay);
      if (idx > -1) {
        map.overlayMapTypes.removeAt(idx);
      }
    };
  }, [id, version, map]);

  return null;
};
