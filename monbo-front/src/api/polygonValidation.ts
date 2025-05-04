import { POLYGON_VALIDATION_URL } from "@/config/env";
import { ValidateFarmsResponse } from "@/interfaces/PolygonValidation";
import { FarmData } from "@/interfaces/Farm";

export const validatePolygons = async (
  data: FarmData[]
): Promise<ValidateFarmsResponse> => {
  const body = data.map(({ id, polygon }) => ({
    id,
    type: polygon.type,
    path: polygon.type === "polygon" ? polygon.details?.path ?? null : null,
    center: polygon.details?.center ?? null,
  }));
  const response = await fetch(POLYGON_VALIDATION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error("Error validating polygons");
  }

  return response.json();
};
