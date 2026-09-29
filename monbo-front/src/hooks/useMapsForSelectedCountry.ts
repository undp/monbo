import { useContext, useMemo } from "react";
import { SelectionOption } from "@/interfaces/SelectionOption";
import { MapData } from "@/interfaces/DeforestationAnalysis";
import { DataContext } from "@/context/DataContext";

interface Props {
  selectedMaps: MapData[];
  availableMaps: MapData[];
}

interface ReturnType {
  mapOptions: SelectionOption[];
  selectedMapsOptions: SelectionOption[];
}

const getMapLabel = (map: MapData): string => {
  return `${map.name} (${map.alias})`;
};

const toOption = (map: MapData): SelectionOption => ({
  id: map.id.toString(),
  label: getMapLabel(map),
});

// The layers of `availableMaps` that cover the analysis country, as options.
export function useMapsForSelectedCountry({
  selectedMaps,
  availableMaps,
}: Props): ReturnType {
  const { selectedCountry } = useContext(DataContext);

  const mapOptions = useMemo(
    () =>
      availableMaps
        .filter(
          ({ availableCountriesCodes }) =>
            !!selectedCountry &&
            availableCountriesCodes.includes(selectedCountry)
        )
        .map(toOption),
    [availableMaps, selectedCountry]
  );

  const selectedMapsOptions = useMemo(
    () => selectedMaps.map(toOption),
    [selectedMaps]
  );

  return { mapOptions, selectedMapsOptions };
}
