export const GCP_MAPS_PLATFORM_API_KEY =
  process.env.NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY ||
  `${
    process.env.NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY ??
    "__NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY__"
  }`;

export const GET_MAPS_URL =
  process.env.NEXT_PUBLIC_GET_MAPS_URL ||
  `${process.env.NEXT_PUBLIC_API_URL ?? "__NEXT_PUBLIC_API_URL__"}/maps`;

export const GET_COUNTRIES_URL =
  process.env.NEXT_PUBLIC_GET_COUNTRIES_URL ||
  `${process.env.NEXT_PUBLIC_API_URL ?? "__NEXT_PUBLIC_API_URL__"}/countries`;

// The thresholds (overlap, deforestation) come from here, not from this file: the API
// owns them (src/config/runtime.ts).
export const GET_CONFIG_URL =
  process.env.NEXT_PUBLIC_GET_CONFIG_URL ||
  `${process.env.NEXT_PUBLIC_API_URL ?? "__NEXT_PUBLIC_API_URL__"}/config`;

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

// Layers admin (only answers when the API has the admin configured)
export const ADMIN_API_URL =
  process.env.NEXT_PUBLIC_ADMIN_API_URL ||
  `${process.env.NEXT_PUBLIC_API_URL ?? "__NEXT_PUBLIC_API_URL__"}/admin`;

export const DOWNLOAD_GEOJSON_URL =
  process.env.NEXT_PUBLIC_DOWNLOAD_GEOJSON_URL ||
  `${
    process.env.NEXT_PUBLIC_API_URL ?? "__NEXT_PUBLIC_API_URL__"
  }/download-geojson`;

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

// Where the landing page's "Contact us to add your country" button leads: an
// https: URL or a mailto: link. Anything else (unset, or the placeholder left
// when the container sets no value) hides the button.
export const CONTACT_URL = (() => {
  const raw =
    process.env.NEXT_PUBLIC_CONTACT_URL ?? "__NEXT_PUBLIC_CONTACT_URL__";
  return /^(https:|mailto:)/i.test(raw.trim()) ? raw.trim() : null;
})();
