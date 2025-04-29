import { useCallback, useMemo } from "react";
import { SelectionOption } from "@/interfaces/SelectionOption";
import { useLocalStorage } from "./useLocalStorage";
import { flatten, map, uniq, intersection } from "lodash";
import { MapData } from "@/interfaces/DeforestationAnalysis";
import { getCountryName } from "@/utils/countries";
import { useTranslation } from "react-i18next";

interface Props {
  selectedMaps: MapData[];
  availableMaps: MapData[];
  onCountrySelectionChangeEffect?: (codes?: string[]) => void;
}

interface ReturnType {
  selectedCountries: SelectionOption[];
  countriesOptions: SelectionOption[];
  onCountrySelectionChange: (codes: string[]) => void;
  mapOptions: SelectionOption[];
  selectedMapsOptions: SelectionOption[];
}

const getMapLabel = (map: MapData): string => {
  return `${map.name} (${map.alias})`;
};

export function useCountryAndMapsSelection({
  selectedMaps,
  availableMaps,
  onCountrySelectionChangeEffect,
}: Props): ReturnType {
  const { i18n } = useTranslation();
  const [selectedCountryCodes, setSelectedCountryCodes] = useLocalStorage<
    string[]
  >("deforestationAnalysis.selectedCountries", []);

  const countriesOptions = useMemo<SelectionOption[]>(
    () =>
      uniq(flatten(map(availableMaps, "availableCountriesCodes"))).map(
        (code) => ({
          id: code,
          label: getCountryName(code, i18n.language as "en" | "es") ?? code,
        })
      ),
    [availableMaps, i18n.language]
  );

  const selectedCountries = useMemo<SelectionOption[]>(
    () =>
      countriesOptions.filter(({ id }) => selectedCountryCodes.includes(id)),
    [countriesOptions, selectedCountryCodes]
  );

  const filteredMapOptions = useMemo(() => {
    const countryCodes = map(selectedCountries, "id");
    const filteredMaps = availableMaps.filter(
      ({ availableCountriesCodes }) =>
        intersection(availableCountriesCodes, countryCodes).length > 0
    );

    return map(filteredMaps, (map) => ({
      id: map.id.toString(),
      label: getMapLabel(map),
    }));
  }, [availableMaps, selectedCountries]);

  const selectedMapsOptions = useMemo(
    () =>
      selectedMaps.map((map) => ({
        id: map.id.toString(),
        label: getMapLabel(map),
      })),
    [selectedMaps]
  );

  const onCountrySelectionChange = useCallback(
    (codes: string[]) => {
      setSelectedCountryCodes(codes);
      onCountrySelectionChangeEffect?.(codes);
    },
    [setSelectedCountryCodes, onCountrySelectionChangeEffect]
  );

  return {
    countriesOptions,
    selectedCountries,
    onCountrySelectionChange,
    mapOptions: filteredMapOptions,
    selectedMapsOptions,
  };
}
