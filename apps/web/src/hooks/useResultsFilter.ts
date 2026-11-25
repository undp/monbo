import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ResultsFilter, parseResultsFilter } from "@/utils/validationResults";

/**
 * The stage 1 results' filter, kept in the URL (`?status=`) next to the search,
 * so the summary cards and the table share it. Choosing the active filter again
 * removes it.
 */
export const useResultsFilter = (): [
  ResultsFilter | null,
  (filter: ResultsFilter | null) => void,
] => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const filter = parseResultsFilter(searchParams.get("status"));

  const toggle = useCallback(
    (next: ResultsFilter | null) => {
      const params = new URLSearchParams(searchParams);
      if (next && next !== filter) params.set("status", next);
      else params.delete("status");
      replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [filter, pathname, replace, searchParams]
  );

  return [filter, toggle];
};
