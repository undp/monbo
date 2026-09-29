"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { useTranslation } from "react-i18next";
import { getCountryByNumericCode } from "@/utils/countries";
import { AvailableCountry } from "@/hooks/useAvailableCountries";

const WIDTH = 960;
const HEIGHT = 520;
// Room around the available countries, so their neighbours give some context.
const PADDING = 90;

const AVAILABLE_COLOR = "#03689E";
const SELECTED_COLOR = "#024A70";
const UNAVAILABLE_COLOR = "#E4E7EC";

type CountryFeature = Feature<Geometry, { name: string }> & { id?: string };

interface CountryMapProps {
  countries: AvailableCountry[];
  selectedCountry: string | null;
  onSelect: (code: string) => void;
}

/**
 * World map where only `countries` are highlighted and clickable. The view is
 * fitted to them. Mouse only: keyboard users pick from the list next to it.
 */
export const CountryMap: React.FC<CountryMapProps> = ({
  countries,
  selectedCountry,
  onSelect,
}) => {
  const { t } = useTranslation();
  const [features, setFeatures] = useState<CountryFeature[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Loaded on demand so the other pages don't carry the world geometry.
    import("world-atlas/countries-110m.json").then(({ default: data }) => {
      if (cancelled) return;
      const topology = data as unknown as Topology<{
        countries: GeometryCollection<{ name: string }>;
      }>;
      const collection = feature(
        topology,
        topology.objects.countries
      ) as FeatureCollection<Geometry, { name: string }>;
      setFeatures(collection.features as CountryFeature[]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const countriesByCode = useMemo(
    () => new Map(countries.map((country) => [country.code, country])),
    [countries]
  );

  const paths = useMemo(() => {
    if (!features) return null;
    // world-atlas identifies countries by their ISO 3166-1 numeric code.
    const availableCountryOf = (f: CountryFeature) => {
      const code = f.id ? getCountryByNumericCode(f.id)?.code : undefined;
      return code ? countriesByCode.get(code) : undefined;
    };
    const available = features.filter((f) => availableCountryOf(f));
    const projection = geoMercator();
    projection.fitExtent(
      [
        [PADDING, PADDING],
        [WIDTH - PADDING, HEIGHT - PADDING],
      ],
      {
        type: "FeatureCollection",
        features: available.length ? available : features,
      }
    );
    const path = geoPath(projection);
    return features.map((f, index) => ({
      key: f.id ?? `unknown-${index}`,
      d: path(f) ?? "",
      country: availableCountryOf(f),
    }));
  }, [features, countriesByCode]);

  if (!paths) {
    return (
      <Box
        sx={{
          aspectRatio: `${WIDTH} / ${HEIGHT}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      component="svg"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={t("home:landing:mapLabel")}
      sx={{
        width: "100%",
        height: "auto",
        display: "block",
        backgroundColor: alpha(AVAILABLE_COLOR, 0.04),
        borderRadius: 3,
        "& path": {
          stroke: "#FFFFFF",
          strokeWidth: 0.6,
          fill: UNAVAILABLE_COLOR,
        },
        "& path.available": {
          fill: alpha(AVAILABLE_COLOR, 0.75),
          cursor: "pointer",
          transition: "fill 120ms",
        },
        "& path.available:hover": { fill: AVAILABLE_COLOR },
        "& path.selected, & path.selected:hover": { fill: SELECTED_COLOR },
      }}
    >
      {paths.map(({ key, d, country }) =>
        country ? (
          <Tooltip key={key} title={country.name} followCursor>
            <path
              d={d}
              className={
                country.code === selectedCountry
                  ? "available selected"
                  : "available"
              }
              onClick={() => onSelect(country.code)}
            />
          </Tooltip>
        ) : (
          <path key={key} d={d} />
        )
      )}
    </Box>
  );
};
