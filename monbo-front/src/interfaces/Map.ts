export interface Coordinates {
  lat: number;
  lng: number;
}
export interface PointDetails {
  center: Coordinates;
  radius: number;
}

export interface PolygonDetails {
  center: Coordinates;
  path: { lat: number; lng: number }[];
}
