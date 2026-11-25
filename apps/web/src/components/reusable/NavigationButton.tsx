"use client";

import { Button } from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export const NavigationButton = ({
  label,
  route,
}: {
  label: string;
  route: string;
}) => {
  const router = useRouter();

  const handleContinue = useCallback(() => {
    router.push(route);
  }, [router, route]);

  return (
    <Button variant="contained" onClick={handleContinue}>
      {label}
    </Button>
  );
};
