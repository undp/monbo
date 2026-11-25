import { GET_CONFIG_URL } from "@/config/env";
import { RuntimeConfig } from "@/config/runtime";

// Product settings owned by the API (thresholds).
export const getConfig = async (): Promise<RuntimeConfig> => {
  const response = await fetch(GET_CONFIG_URL);
  if (!response.ok) {
    throw new Error("Error on get config");
  }

  return response.json();
};
