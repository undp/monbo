"use client";

import { useContext, useEffect } from "react";
import { DataContext } from "@/context/DataContext";
import { useRouter } from "next/navigation";

export const NavigateHomepageWhenEmptyData: React.FC = () => {
  const { farmsData } = useContext(DataContext);
  const router = useRouter();

  useEffect(() => {
    if (!farmsData) {
      router.push("/");
    }
  }, [farmsData, router]);

  return null;
};
