// Regenerates src/utils/countryShapes.json: each country's silhouette as an SVG path
// fitted to a 100×100 box (Mercator), keyed by ISO 3166-1 numeric code (the id
// world-atlas uses). The landing page's country cards draw them.
//
// The shapes only change if the source data does, so the app ships the JSON and none
// of these libraries. To regenerate (from apps/web/):
//
//   pnpm add --save-dev d3-geo@3 topojson-client@3 world-atlas@2
//   node scripts/generate-country-shapes.mjs
//   pnpm remove d3-geo topojson-client world-atlas
//
// Small outlying islands (under 5% of the country's largest polygon, e.g. the
// Galápagos) are dropped so the mainland fills the card.

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { geoArea, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const topology = require("world-atlas/countries-110m.json");
const MIN_ISLAND_SHARE = 0.05;
const SIZE = 100;

const mainland = (country) => {
  if (country.geometry?.type !== "MultiPolygon") return country;
  const polygons = country.geometry.coordinates.map((coordinates) => ({
    coordinates,
    area: geoArea({ type: "Polygon", coordinates }),
  }));
  const largest = Math.max(...polygons.map(({ area }) => area));
  return {
    ...country,
    geometry: {
      type: "MultiPolygon",
      coordinates: polygons
        .filter(({ area }) => area >= largest * MIN_ISLAND_SHARE)
        .map(({ coordinates }) => coordinates),
    },
  };
};

const shapes = {};
for (const country of feature(topology, topology.objects.countries).features) {
  if (!country.id || !country.geometry) continue;
  const shape = mainland(country);
  const projection = geoMercator().fitSize([SIZE, SIZE], shape);
  shapes[country.id] = geoPath(projection).digits(1)(shape);
}

const target = new URL("../src/utils/countryShapes.json", import.meta.url);
writeFileSync(target, JSON.stringify(shapes, Object.keys(shapes).sort()) + "\n");
console.log(`Wrote ${Object.keys(shapes).length} country shapes to ${target.pathname}`);
