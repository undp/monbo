"use client";

import { BaseModal, BaseModalProps } from "@/components/reusable/BaseModal";
import { Text } from "@/components/reusable/Text";
import { DataContext } from "@/context/DataContext";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import {
  Box,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MultiSelectionStep } from "../uploadData/MultiSelectionStep";
import { useCountryAndMapsSelection } from "@/hooks/useCountryAndMapsSelection";
import { MultiSelector } from "@/components/reusable/selectors/MultiSelector";
import { MessageBox } from "@/components/reusable/MessageBox";

export const DeforestationModal: React.FC<
  Pick<BaseModalProps, "isOpen" | "handleClose">
> = ({ isOpen, handleClose }) => {
  const { t } = useTranslation();
  const {
    farmsData,
    availableMaps,
    polygonsValidationResults,
    deforestationAnalysisParams: { polygonsSubset, selectedMaps },
    setDeforestationAnalysisParams,
  } = useContext(DataContext);
  const router = useRouter();

  const allFarmsAmount = useMemo(() => farmsData?.length || 0, [farmsData]);

  const validFarmsAmount = useMemo(
    () =>
      polygonsValidationResults?.farmResults.filter(
        ({ status }) => status !== FarmValidationStatus.NOT_VALID
      ).length || 0,
    [polygonsValidationResults]
  );

  const onPolygonsSelectionChange = useCallback(
    (value: "all" | "valid") => {
      setDeforestationAnalysisParams((prev) => ({
        ...prev,
        polygonsSubset: value,
      }));
    },
    [setDeforestationAnalysisParams]
  );

  const onCountrySelectionChangeEffect = useCallback(() => {
    // When the user selects a country, we need to clear the selected maps

    setDeforestationAnalysisParams((prev) => ({
      ...prev,
      selectedMaps: [],
    }));
  }, [setDeforestationAnalysisParams]);

  const {
    selectedCountries,
    countriesOptions,
    onCountrySelectionChange,
    mapOptions,
    selectedMapsOptions,
  } = useCountryAndMapsSelection({
    selectedMaps,
    availableMaps,
    onCountrySelectionChangeEffect,
  });

  const onMapSelectionChange = useCallback(
    (mapId: string, checked: boolean) => {
      if (checked) {
        setDeforestationAnalysisParams((prev) => ({
          ...prev,
          selectedMaps: [
            ...prev.selectedMaps,
            availableMaps.find((m) => m.id === Number(mapId))!,
          ],
        }));
      } else {
        setDeforestationAnalysisParams((prev) => ({
          ...prev,
          selectedMaps: prev.selectedMaps.filter((m) => m.id !== Number(mapId)),
        }));
      }
    },
    [availableMaps, setDeforestationAnalysisParams]
  );

  const handleContinue = useCallback(() => {
    if (!farmsData) return;
    router.push("/deforestation-analysis/upload-data");
  }, [farmsData, router]);

  return (
    <BaseModal
      isOpen={isOpen}
      handleClose={handleClose}
      title={t("polygonValidation:deforestationModal:title")}
      maxWidth="sm"
      onAfterClose={() => {
        setDeforestationAnalysisParams((prev) => ({
          ...prev,
          polygonsSubset: null,
        }));
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Text variant="h3" bold>
            {t("polygonValidation:deforestationModal:polygonSelection")}
          </Text>
          <RadioGroup value={polygonsSubset} row sx={{ gap: 5 }}>
            <FormControlLabel
              value="all"
              control={<Radio />}
              label={`${t(
                "polygonValidation:deforestationModal:all"
              )} (${allFarmsAmount})`}
              onChange={() => onPolygonsSelectionChange("all")}
            />
            <FormControlLabel
              value="valid"
              control={<Radio />}
              label={`${t(
                "polygonValidation:deforestationModal:valid"
              )} (${validFarmsAmount})`}
              onChange={() => onPolygonsSelectionChange("valid")}
            />
          </RadioGroup>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text variant="h3" bold>
              {t("polygonValidation:deforestationModal:mapsSelection")}
            </Text>
            <MultiSelector
              sx={{ width: 250 }}
              selectedOptions={selectedCountries}
              options={countriesOptions}
              label={t(
                "deforestationAnalysis:uploadDataPage:mapSelectionStep:countrySelectorLabel"
              )}
              onChange={onCountrySelectionChange}
              compact
            />
          </Box>
          <MultiSelectionStep
            sx={{ flexDirection: "column", gap: 1 }}
            selectedOptions={selectedMapsOptions}
            options={mapOptions}
            onChange={onMapSelectionChange}
          />
          {!selectedCountries.length && (
            <MessageBox
              message={t(
                "deforestationAnalysis:uploadDataPage:mapSelectionStep:noCountriesSelected"
              )}
            />
          )}
          {selectedCountries.length > 0 && !mapOptions.length && (
            <MessageBox
              message={t(
                "deforestationAnalysis:uploadDataPage:mapSelectionStep:noMapsAvailable"
              )}
            />
          )}
        </Box>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
        <Button
          variant="contained"
          disabled={!polygonsSubset || selectedMaps.length == 0}
          onClick={handleContinue}
        >
          {t("polygonValidation:deforestationModal:continue")}
        </Button>
      </Box>
    </BaseModal>
  );
};
