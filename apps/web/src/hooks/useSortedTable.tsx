import { SortBy } from "@/components/reusable/Table";
import { useCallback, useState } from "react";

export const useSortedTable = (): [SortBy | null, (attr: string) => void] => {
  const [sortedBy, setSortedBy] = useState<SortBy | null>(null);

  const handleSortBy = useCallback((attr: string) => {
    setSortedBy((prev) => {
      if (!prev) return { attr, order: "asc" };
      if (prev.attr !== attr) return { attr, order: "asc" };
      if (prev.order === "asc") return { attr: prev.attr, order: "desc" };
      return null;
    });
  }, []);

  return [sortedBy, handleSortBy];
};
