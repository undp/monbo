import { FarmData } from "@/interfaces/Farm";
import { calendarDay } from "./dates";

export const getCoordinates = (farm: FarmData): string[] => {
  const coordinates: string[] = [];
  if (farm.polygon.type === "point") {
    const center = farm.polygon.details.center;
    coordinates.push(`(${center.lng},${center.lat})`);
  } else {
    // Every ring of every part: exteriors and holes
    farm.polygon.details?.parts.forEach((part) =>
      [part.exterior, ...part.holes].flat().forEach((point) => {
        coordinates.push(`(${point.lng},${point.lat})`);
      })
    );
  }
  return coordinates;
};

/**
 * The farm's area in hectares, not rounded; null when the API couldn't compute it
 * and for a point whose area was assumed, which the user never declared.
 */
export const areaHectares = (farm: FarmData): number | null => {
  if (farm.polygon.type === "point" && farm.polygon.areaAssumed) return null;
  return farm.polygon.area && farm.polygon.area > 0
    ? farm.polygon.area / 10000
    : null;
};

/*
This EUDR document is intended for users (Economic Operators) of the European Commission’s EUDR
Information System (IS) and for parties interested in producing compatible geolocation files for use in
the central EUDR information system.
*/
export const getRowCommonDataAsObject = (
  farm: FarmData
): Record<string, string | number> => {
  const area = areaHectares(farm);
  return {
    id: farm.id,
    /* EUDR GeoJson File Description Additional Properties */
    ProducerName: farm.producer,
    ProducerCountry: farm.country || "", // ISO 3166-1 alpha-2 country code
    // The EUDR reads Area as a number of hectares and a string as 0
    ...(area !== null ? { Area: area } : {}),
    /* Our custom properties */
    productionDate: farm.productionDate ? calendarDay(farm.productionDate) : "",
    production: farm.production.toString(),
    productionQuantityUnit: farm.productionQuantityUnit || "",
    region: farm.region || "",
    coordinates: getCoordinates(farm).join(", "),
    cropType: farm.cropType,
    association: farm.association || "",
    // document1: "",
    // document2: "",
    // document3: "",
  };
};
