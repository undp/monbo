"use client";

import { Button, ButtonProps } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface SearchParamButtonProps extends ButtonProps {
  searchParamKey: string;
  searchParamValue: string;
}

export const SearchParamButton: React.FC<SearchParamButtonProps> = ({
  searchParamKey,
  searchParamValue,
  children,
  ...props
}) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const onClick = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.set(searchParamKey, searchParamValue);
    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParamKey, searchParamValue, searchParams]);

  return (
    <Button onClick={onClick} {...props}>
      {children}
    </Button>
  );
};
