export const GCP_MAPS_PLATFORM_API_KEY =
  process.env.NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY ||
  `${
    process.env.NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY ??
    "__NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY__"
  }`;

export const GET_MAPS_URL =
  process.env.NEXT_PUBLIC_GET_MAPS_URL ||
  `${process.env.NEXT_PUBLIC_API_URL ?? "__NEXT_PUBLIC_API_URL__"}/maps`;

export const FARMS_PARSER_URL =
  process.env.NEXT_PUBLIC_FARMS_PARSER_URL ||
  `${process.env.NEXT_PUBLIC_API_URL ?? "__NEXT_PUBLIC_API_URL__"}/farms/parse`;

export const POLYGON_VALIDATION_URL =
  process.env.NEXT_PUBLIC_POLYGON_VALIDATION_URL ||
  `${
    process.env.NEXT_PUBLIC_API_URL ?? "__NEXT_PUBLIC_API_URL__"
  }/polygons_validation/validate`;

export const DEFORESTATION_ANALYSIS_URL =
  process.env.NEXT_PUBLIC_DEFORESTATION_ANALYSIS_URL ||
  `${
    process.env.NEXT_PUBLIC_API_URL ?? "__NEXT_PUBLIC_API_URL__"
  }/deforestation_analysis/analize`;

export const DEFORESTATION_ANALYSIS_TILES_URL =
  process.env.NEXT_PUBLIC_DEFORESTATION_ANALYSIS_TILES_URL ||
  `${
    process.env.NEXT_PUBLIC_API_URL ?? "__NEXT_PUBLIC_API_URL__"
  }/deforestation_analysis/tiles`;

export const DEFORESTATION_ANALYSIS_IMAGE_GENERATION_URL =
  process.env.NEXT_PUBLIC_DEFORESTATION_ANALYSIS_IMAGE_GENERATION_URL ||
  `${
    process.env.NEXT_PUBLIC_API_URL ?? "__NEXT_PUBLIC_API_URL__"
  }/deforestation_analysis/generate-image`;

export const DOWNLOAD_GEOJSON_URL =
  process.env.NEXT_PUBLIC_DOWNLOAD_GEOJSON_URL ||
  `${
    process.env.NEXT_PUBLIC_API_URL ?? "__NEXT_PUBLIC_API_URL__"
  }/download-geojson`;

// Values between 0 and 100. Ensure the same value at backend.
export const OVERLAP_THRESHOLD_PERCENTAGE = (() => {
  const raw =
    process.env.NEXT_PUBLIC_OVERLAP_THRESHOLD_PERCENTAGE ??
    "__NEXT_PUBLIC_OVERLAP_THRESHOLD_PERCENTAGE__";

  if (
    raw === "__NEXT_PUBLIC_OVERLAP_THRESHOLD_PERCENTAGE__" ||
    raw === "undefined" ||
    raw === ""
  )
    return 0;

  const value = parseFloat(raw);
  if (isNaN(value)) {
    throw new Error(
      `NEXT_PUBLIC_OVERLAP_THRESHOLD_PERCENTAGE must be a valid number, got '${raw}'`
    );
  }
  if (value < 0 || value > 100) {
    throw new Error(
      `NEXT_PUBLIC_OVERLAP_THRESHOLD_PERCENTAGE must be between 0 and 100, got ${value}`
    );
  }
  return value;
})();

// Values between 0 and 100. Ensure the same value at backend.
export const DEFORESTATION_THRESHOLD_PERCENTAGE = (() => {
  const raw =
    process.env.NEXT_PUBLIC_DEFORESTATION_THRESHOLD_PERCENTAGE ??
    "__NEXT_PUBLIC_DEFORESTATION_THRESHOLD_PERCENTAGE__";

  if (
    raw === "__NEXT_PUBLIC_DEFORESTATION_THRESHOLD_PERCENTAGE__" ||
    raw === "undefined" ||
    raw === ""
  )
    return 0;

  const value = parseFloat(raw);
  if (isNaN(value)) {
    throw new Error(
      `NEXT_PUBLIC_DEFORESTATION_THRESHOLD_PERCENTAGE must be a valid number, got '${raw}'`
    );
  }
  if (value < 0 || value > 100) {
    throw new Error(
      `NEXT_PUBLIC_DEFORESTATION_THRESHOLD_PERCENTAGE must be between 0 and 100, got ${value}`
    );
  }
  return value;
})();

export const SHOW_TESTING_ENVIRONMENT_WARNING = (() => {
  const raw =
    process.env.NEXT_PUBLIC_SHOW_TESTING_ENVIRONMENT_WARNING ??
    "__NEXT_PUBLIC_SHOW_TESTING_ENVIRONMENT_WARNING__";

  return raw.toLowerCase() === "true";
})();

export const MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION =
  (() => {
    const raw =
      process.env
        .NEXT_PUBLIC_MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION ??
      "__NEXT_PUBLIC_MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION__";

    const value = parseInt(raw);
    if (isNaN(value)) return null;

    return value;
  })();
