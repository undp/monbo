import { POLYGON_VALIDATION_URL } from "@/config/env";
import { ValidateFarmsResponse } from "@/interfaces/PolygonValidation";
import { FarmData } from "@/interfaces/Farm";
import { usageHeaders } from "@/utils/usageSession";
import type { components } from "./schema";

// `country` is the selected country, for the validation's usage event.
export const validatePolygons = async (
  data: FarmData[],
  country: string | null
): Promise<ValidateFarmsResponse> => {
  const body: components["schemas"]["FarmPolygonDetailData"][] = data.map(({ id, polygon }) => ({
    id,
    type: polygon.type,
    details: polygon.details,
  }));
  const response = await fetch(POLYGON_VALIDATION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...usageHeaders(country),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error("Error validating polygons");
  }

  return response.json();
};
