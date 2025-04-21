import { FarmData } from "@/interfaces/Farm";

export const MANDATORY_HEADERS = [
  "",
  "OBLIGATORIO",
  "OBLIGATORIO",
  "OBLIGATORIO",
  "OBLIGATORIO",
  "OBLIGATORIO",
  "OBLIGATORIO",
  "OBLIGATORIO",
  "OBLIGATORIO",
];

export const COMMON_HEADERS = [
  "ID",
  "Nombre productor",
  "Fecha producción",
  "Cantidad producción",
  "Unidad cantidad producción",
  "País",
  "Región",
  "Coordenadas finca",
  "Tipo de cultivo",
  "Asociación",
  "Nombre documento 1",
  "Link documento 1",
  "Nombre documento 2",
  "Link documento 2",
  "Nombre documento 3",
  "Link documento 3",
];

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

export const getRowCommonDataAsArray = (farm: FarmData): string[] => {
  return [
    farm.id,
    farm.producer,
    farm.productionDate || "",
    farm.production.toString(),
    farm.productionQuantityUnit || "",
    farm.country || "",
    farm.region || "",
    `[${getCoordinates(farm).join(", ")}]`,
    farm.cropType,
    farm.association || "",
    "",
    "",
    "",
    "",
    "",
    "",
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
