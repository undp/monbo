import { useContext, useMemo } from "react";
import { DataContext } from "@/context/DataContext";
import { useSearchParams } from "next/navigation";

export const useSelectedMap = () => {
  const {
    deforestationAnalysisParams: { selectedMaps },
  } = useContext(DataContext);

  const searchParams = useSearchParams();

  return useMemo(() => {
    const selectedMap =
      selectedMaps.find(
        (map) => map.id === Number(searchParams.get("selectedMap"))
      ) ?? selectedMaps[0];
    return {
      id: selectedMap?.id ?? null,
      name: selectedMap?.name ?? "",
      alias: selectedMap?.alias ?? "",
      baseline: selectedMap?.baseline ?? null,
      comparedAgainst: selectedMap?.comparedAgainst ?? null,
    };
  }, [selectedMaps, searchParams]);
};
