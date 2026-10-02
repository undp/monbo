import { GET_COUNTRIES_URL } from "@/config/env";

// The countries a visitor can analyze (enabled, with at least one enabled layer).
export const getCountries = async (): Promise<{ code: string }[]> => {
  const response = await fetch(GET_COUNTRIES_URL);
  if (!response.ok) {
    throw new Error("Error on get countries");
  }

  return response.json();
};
