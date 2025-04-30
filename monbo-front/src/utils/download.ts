import { FarmData } from "@/interfaces/Farm";
import { parseAreaToHectares } from "./polygons";

export const getCoordinates = (farm: FarmData): string[] => {
  const coordinates: string[] = [];
  if (farm.polygon.type === "point") {
    const center = farm.polygon.details.center;
    coordinates.push(`(${center.lng},${center.lat})`);
  } else {
    farm.polygon.details.path.forEach((point) => {
      coordinates.push(`(${point.lng},${point.lat})`);
    });
  }
  return coordinates;
};

export const getRowCommonDataAsArray = (
  farm: FarmData,
  language: string
): string[] => {
  return [
    farm.id,
    farm.producer,
    farm.productionDate || "",
    farm.production.toString(),
    farm.productionQuantityUnit || "",
    farm.country || "",
    farm.region || "",
    `[${getCoordinates(farm).join(", ")}]`,
    farm.polygon.area
      ? parseAreaToHectares(farm.polygon.area, 2, false, language)
      : "",
    farm.cropType,
    farm.association || "",
    farm.documents[0]?.name || "",
    farm.documents[0]?.url || "",
    farm.documents[1]?.name || "",
    farm.documents[1]?.url || "",
    farm.documents[2]?.name || "",
    farm.documents[2]?.url || "",
  ];
};

/*
This EUDR document is intended for users (Economic Operators) of the European Commission’s EUDR
Information System (IS) and for parties interested in producing compatible geolocation files for use in
the central EUDR information system.
*/
export const getRowCommonDataAsObject = (
  farm: FarmData
): Record<string, string> => {
  return {
    id: farm.id,
    /* EUDR GeoJson File Description Additional Properties */
    ProducerName: farm.producer,
    ProducerCountry: farm.country || "", // ISO 3166-1 alpha-2 country code
    Area: "0", // TODO: when refactoring the excel manipulation, we should have the area of the farm
    /* Our custom properties */
    productionDate: farm.productionDate || "",
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
