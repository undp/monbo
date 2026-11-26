"use client";

import { GoogleMapsContext } from "@vis.gl/react-google-maps";
import { useContext, useEffect } from "react";
import { LAYER_ANALYSIS_TILES_URL } from "@/config/env";
import { DataContext } from "@/context/DataContext";
import { useSelectedMap } from "@/hooks/useSelectedMapName";

export const LayerTilesOverlay = () => {
  const { id, version } = useSelectedMap();
  // Layer ids are numbered within each country.
  const { selectedCountry } = useContext(DataContext);
  const map = useContext(GoogleMapsContext)?.map;

  useEffect(() => {
    if (!map) return;

    const overlay = new google.maps.ImageMapType({
      name: "Layer tiles",
      // `v` changes when the layer's raster is replaced, so cached tiles aren't reused
      getTileUrl: (coord, zoom) =>
        zoom < 12
          ? null
          : `${LAYER_ANALYSIS_TILES_URL}/${selectedCountry}/${id}/dynamic/${zoom}/${coord.x}/${coord.y}.png?v=${version}`,
      tileSize: new google.maps.Size(256, 256),
      maxZoom: 20,
      minZoom: 12,
    });
    map.overlayMapTypes.push(overlay);

    return () => {
      // Google disables its API when it rejects the key: getArray() then returns undefined
      const overlays: google.maps.MapType[] | undefined =
        map.overlayMapTypes.getArray();
      const idx = overlays?.indexOf(overlay) ?? -1;
      if (idx > -1) {
        map.overlayMapTypes.removeAt(idx);
      }
    };
  }, [id, version, selectedCountry, map]);

  return null;
};
