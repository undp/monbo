"use client";

import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DataContext } from "@/context/DataContext";

/**
 * Renders its children only once an analysis country is selected, and sends the
 * user to the landing page (where the country is chosen) when there is none.
 */
export const RequireCountry: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { selectedCountry, countryHydrated } = useContext(DataContext);
  const router = useRouter();

  useEffect(() => {
    if (countryHydrated && !selectedCountry) router.replace("/");
  }, [countryHydrated, selectedCountry, router]);

  if (!countryHydrated || !selectedCountry) return null;
  return <>{children}</>;
};
