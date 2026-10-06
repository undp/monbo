import { FARMS_PARSER_URL } from "@/config/env";
import { FarmData } from "@/interfaces/Farm";

export const generateFarmsData = async (
  data: Record<string, unknown>[],
  locale?: string
): Promise<FarmData[]> => {
  const url = `${FARMS_PARSER_URL}${locale ? `?locale=${locale}` : ""}`;
  const response = await fetch(url, {
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
