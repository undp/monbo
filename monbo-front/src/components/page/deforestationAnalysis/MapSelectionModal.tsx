"use client";

import { BaseModal, BaseModalProps } from "@/components/reusable/BaseModal";
import { Text } from "@/components/reusable/Text";
import { DataContext } from "@/context/DataContext";
import {
  Box,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
} from "@mui/material";
import { useCallback, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MultiSelectionStep } from "../uploadData/MultiSelectionStep";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import { useCountryAndMapsSelection } from "@/hooks/useCountryAndMapsSelection";

interface MapSelectionModalProps
  extends Pick<BaseModalProps, "isOpen" | "handleClose"> {
  handleContinue: () => void;
}

export const MapSelectionModal: React.FC<MapSelectionModalProps> = ({
  isOpen,
  handleClose,
  handleContinue,
}) => {
  const { t } = useTranslation();
  const { farmsData } = useVisibleDataForDeforestationPage();
  const {
    deforestationAnalysisParams: { selectedMaps: selectedMapsForDeforestation },
    reportGenerationParams: {
      initialFarmSelection,
      selectedMaps: selectedMapsForReport,
    },
    setReportGenerationParams,
  } = useContext(DataContext);

  const { mapOptions, selectedMapsOptions } = useCountryAndMapsSelection({
    selectedMaps: selectedMapsForReport,
    availableMaps: selectedMapsForDeforestation,
  });

  const allFarmsAmount = useMemo(() => farmsData?.length || 0, [farmsData]);

  const onInitialFarmSelectionChange = useCallback(
    (value: "all" | "select") => {
      setReportGenerationParams((prev) => ({
        ...prev,
        initialFarmSelection: value,
      }));
    },
    [setReportGenerationParams]
  );

  const onMapSelectionChange = useCallback(
    (mapId: string, checked: boolean) => {
      if (checked) {
        setReportGenerationParams((prev) => ({
          ...prev,
          selectedMaps: [
            ...prev.selectedMaps,
            selectedMapsForDeforestation.find((m) => m.id === Number(mapId))!,
          ],
        }));
      } else {
        setReportGenerationParams((prev) => ({
          ...prev,
          selectedMaps: prev.selectedMaps.filter((m) => m.id !== Number(mapId)),
        }));
      }
    },
    [selectedMapsForDeforestation, setReportGenerationParams]
  );

  const handleContinueWrapper = useCallback(() => {
    // Update the selected farms in the report generation params based on the initial farm selection
    setReportGenerationParams((prev) => ({
      ...prev,
      selectedFarms: initialFarmSelection === "all" ? farmsData : [],
    }));
    handleContinue();
  }, [
    initialFarmSelection,
    farmsData,
    setReportGenerationParams,
    handleContinue,
  ]);

  return (
    <BaseModal
      isOpen={isOpen}
      handleClose={handleClose}
      title={t("reportGeneration:paramsSelectionModal:title")}
      maxWidth="sm"
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Text variant="h3" bold>
            {t("reportGeneration:paramsSelectionModal:selectFarmsTitle")}
          </Text>
          <RadioGroup value={initialFarmSelection} row sx={{ gap: 5 }}>
            <FormControlLabel
              value="all"
              control={<Radio />}
              label={t("reportGeneration:paramsSelectionModal:allFarms", {
                amount: allFarmsAmount,
              })}
              onChange={() => onInitialFarmSelectionChange("all")}
            />
            <FormControlLabel
              value="select"
              control={<Radio />}
              label={t("reportGeneration:paramsSelectionModal:selectFarms", {
                amount: allFarmsAmount,
              })}
              onChange={() => onInitialFarmSelectionChange("select")}
            />
          </RadioGroup>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Text variant="h3" bold>
            {t("reportGeneration:paramsSelectionModal:selectMapsTitle")}
          </Text>
          <MultiSelectionStep
            sx={{ flexDirection: "column", gap: 1 }}
            selectedOptions={selectedMapsOptions}
            options={mapOptions}
            onChange={onMapSelectionChange}
          />
        </Box>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          disabled={selectedMapsForReport.length == 0}
          onClick={handleContinueWrapper}
        >
          {t("reportGeneration:paramsSelectionModal:button")}
        </Button>
      </Box>
    </BaseModal>
  );
};
