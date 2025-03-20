import { PointDetails, PolygonDetails } from "./Map";

export interface PointTypePolygon {
  type: "point";
  details: PointDetails;
  area: number;
}

export interface PolygonTypePolygon {
  type: "polygon";
  details: PolygonDetails;
  area: number;
}

export interface FarmData {
  id: string;
  producer: string;
  producerId: string;
  cropType: string;
  production: number;
  productionDate?: string;
  productionQuantityUnit?: string;
  country?: string;
  region?: string;
  association?: string;
  polygon: PointTypePolygon | PolygonTypePolygon;
}
