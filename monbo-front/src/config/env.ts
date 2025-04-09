export const GOOGLE_SERVICE_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_SERVICE_API_KEY ||
  `${
    process.env.NEXT_PUBLIC_GOOGLE_SERVICE_API_KEY ??
    "__GOOGLE_SERVICE_API_KEY__"
  }`;

export const GET_MAPS_URL =
  process.env.NEXT_PUBLIC_GET_MAPS_URL ||
  `${
    process.env.NEXT_PUBLIC_API_URL ?? "__API_URL__"
  }/deforestation_analysis/get-maps`;

export const POLYGON_VALIDATION_PARSER_URL =
  process.env.NEXT_PUBLIC_POLYGON_VALIDATION_PARSER_URL ||
  `${
    process.env.NEXT_PUBLIC_API_URL ?? "__API_URL__"
  }/polygons_validation/parse-farms`;

export const POLYGON_VALIDATION_URL =
  process.env.NEXT_PUBLIC_POLYGON_VALIDATION_URL ||
  `${
    process.env.NEXT_PUBLIC_API_URL ?? "__API_URL__"
  }/polygons_validation/validate`;

export const DEFORESTATION_ANALYSIS_PARSER_URL =
  process.env.NEXT_PUBLIC_DEFORESTATION_ANALYSIS_PARSER_URL ||
  `${
    process.env.NEXT_PUBLIC_API_URL ?? "__API_URL__"
  }/deforestation_analysis/parse-farms`;

export const DEFORESTATION_ANALYSIS_URL =
  process.env.NEXT_PUBLIC_DEFORESTATION_ANALYSIS_URL ||
  `${
    process.env.NEXT_PUBLIC_API_URL ?? "__API_URL__"
  }/deforestation_analysis/analize`;

export const DEFORESTATION_ANALYSIS_TILES_URL =
  process.env.NEXT_PUBLIC_DEFORESTATION_ANALYSIS_TILES_URL ||
  `${
    process.env.NEXT_PUBLIC_API_URL ?? "__API_URL__"
  }/deforestation_analysis/tiles`;
