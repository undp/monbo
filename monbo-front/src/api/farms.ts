import { FARMS_PARSER_URL } from "@/config/env";
import { FarmData } from "@/interfaces/Farm";

export const generateFarmsData = async (
  data: Record<string, unknown>[]
): Promise<FarmData[]> => {
  const response = await fetch(FARMS_PARSER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Error on parse farms");
  }

  return response.json();
};
