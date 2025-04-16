"use client";

import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { UploadPageContent } from "@/components/page/uploadData/UploadPageContent";
import { Text } from "@/components/reusable/Text";
import {
  readExcel,
  sheetToJson,
  removeFirstNRow,
  getSheetDataByName,
} from "@/utils/excel";
import { WorkSheet } from "xlsx";
import {
  analizeDeforestation,
  generateFarmsData,
} from "@/api/deforestationAnalysis";
import { DataContext } from "@/context/DataContext";
import { useRouter } from "next/navigation";
import { SnackbarContext } from "@/context/SnackbarContext";
import { LoadingScreen } from "@/components/reusable/LoadingScreen";
import { DownloadTemplateStep } from "@/components/page/uploadData/DownloadTemplateStep";
import { UploadFileStep } from "@/components/page/uploadData/UploadFileStep";
import { TextHeaderStepContainer } from "@/components/page/uploadData/TextHeaderStepContainer";
import { useTranslation } from "react-i18next";
import { FarmData } from "@/interfaces/Farm";
import { validateData } from "@/utils/modules";
import { MultiSelectionStep } from "@/components/page/uploadData/MultiSelectionStep";
import { MultiSelector } from "@/components/reusable/selectors/MultiSelector";
import { Box } from "@mui/material";
import { CustomHeaderStepContainer } from "@/components/page/uploadData/CustomHeaderStepContainer";
import { useCountryAndMapsSelection } from "@/hooks/useCountryAndMapsSelection";
import { MessageBox } from "@/components/reusable/MessageBox";

const parseExcelData = (worksheet: WorkSheet) => {
  // Check mandatory headers
  const headersData = sheetToJson(worksheet, { range: "A1:AA2", header: 1 });
  const headers = headersData[1] as string[];
  const mandatoryData = headersData[0] as string[];
  const mandatoryHeaders: string[] = [];
  for (let i = 0; i < headers.length; i++) {
    if (mandatoryData[i] === "OBLIGATORIO") {
      mandatoryHeaders.push(headers[i]);
    }
  }

  // Get all data
  const dataSheet = removeFirstNRow(worksheet, 1);
  return {
    data: sheetToJson(dataSheet) as Record<string, string>[],
    headers,
    mandatoryHeaders,
  };
};

const keyMapping: Record<string, string> = {
  ID: "id",
  "Nombre productor": "producerName",
  "Fecha producción": "productionDate",
  "Cantidad producción": "productionQuantity",
  "Unidad cantidad producción": "productionQuantityUnit",
  País: "country",
  Región: "region",
  "Coordenadas finca": "farmCoordinates",
  "Tipo de cultivo": "cropType",
  Asociación: "association",
};

export function DeforestationAnalysisUploadDataPageContent() {
  // const [file, setFile] = useState<File | null>(null);
  const { openSnackbar } = useContext(SnackbarContext);
  const router = useRouter();
  const {
    availableMaps,
    farmsData,
    setFarmsData,
    deforestationAnalysisParams: { selectedMaps: selectedMapsForDeforestation },
    setDeforestationAnalysisParams,
    setDeforestationAnalysisResults,
  } = useContext(DataContext);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(() => !!farmsData);
  const prevDataRef = useRef<string | null>(null);

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
    selectedMaps: selectedMapsForDeforestation,
    availableMaps,
    onCountrySelectionChangeEffect,
  });

  const onMapSelectionChange = useCallback(
    (id: string, checked: boolean) => {
      if (checked) {
        setDeforestationAnalysisParams((prev) => ({
          ...prev,
          selectedMaps: [
            ...prev.selectedMaps,
            availableMaps.find((m) => m.id === Number(id))!,
          ],
        }));
      } else {
        setDeforestationAnalysisParams((prev) => ({
          ...prev,
          selectedMaps: prev.selectedMaps.filter((m) => m.id !== Number(id)),
        }));
      }
    },
    [availableMaps, setDeforestationAnalysisParams]
  );

  const performFarmsGeneration = useCallback(
    async (data: Record<string, unknown>[]) => {
      try {
        const results = await generateFarmsData(data);
        setFarmsData(results);
      } catch (error) {
        console.error(error);
        openSnackbar({
          message: t("common:snackbarAlerts:parsingFarmsDataError"),
          type: "error",
        });
        setLoading(false);
        return;
      }
    },
    [openSnackbar, setFarmsData, t]
  );

  const performDeforestationAnalysis = useCallback(
    async (data: FarmData[]) => {
      setLoading(true);
      try {
        const response = await analizeDeforestation(
          data,
          selectedMapsForDeforestation
        );
        setDeforestationAnalysisResults(response);
        router.push("/deforestation-analysis");
        openSnackbar({
          message: t("common:snackbarAlerts:dataAnalizedSuccessfully"),
          type: "success",
        });
      } catch {
        openSnackbar({
          message: t("common:snackbarAlerts:performingAnalysisError"),
          type: "error",
        });
        // TODO: we should navigate back to polygons validation page only if coming from there
        // router.push("/polygons-validation");
        setLoading(false);
      }
    },
    [
      selectedMapsForDeforestation,
      router,
      setDeforestationAnalysisResults,
      openSnackbar,
      t,
    ]
  );

  useEffect(() => {
    const serializedData = JSON.stringify(farmsData?.map((d) => d.id));
    if (serializedData === prevDataRef.current) return;

    prevDataRef.current = serializedData;
    if (!farmsData) return;

    performDeforestationAnalysis(farmsData);
  }, [farmsData, performDeforestationAnalysis]);

  const onFileDropped = useCallback(
    async (acceptedFiles: File[]) => {
      setLoading(true);
      const file = acceptedFiles[0];
      const excel = await readExcel(file);
      const worksheet = getSheetDataByName(excel, "Polígonos válidos");
      if (!worksheet) {
        openSnackbar({
          message: t("common:snackbarAlerts:notValidFileContent"),
          type: "error",
        });
        setLoading(false);
        return;
      }
      const { data, headers, mandatoryHeaders } = parseExcelData(worksheet);

      try {
        validateData({ data, mandatoryHeaders, t });
      } catch (error) {
        const errorCode = (error as Error).message;
        openSnackbar({
          message: errorCode,
          type: "error",
        });
        return;
      }

      const remappedData = data.map((row) => {
        const newRow: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          newRow[keyMapping[key]] = value;
        }
        return newRow;
      });

      remappedData.forEach((row) => {
        if (typeof row.id === "number") {
          row.id = row.id.toString();
        }
        if (row.productionDate instanceof Date) {
          row.productionDate = row.productionDate.toISOString();
        }
      });

      performFarmsGeneration(remappedData);
    },
    [openSnackbar, t, performFarmsGeneration]
  );

  if (loading)
    return (
      <LoadingScreen
        text={t("deforestationAnalysis:uploadDataPage:loadingText")}
      />
    );

  return (
    <UploadPageContent title={t("deforestationAnalysis:uploadDataPage:title")}>
      <TextHeaderStepContainer
        title={t("deforestationAnalysis:uploadDataPage:templateStep:stepTitle")}
      >
        <DownloadTemplateStep
          title={t("deforestationAnalysis:uploadDataPage:templateStep:title")}
          description={t(
            "deforestationAnalysis:uploadDataPage:templateStep:description"
          )}
          buttonText={t(
            "deforestationAnalysis:uploadDataPage:templateStep:buttonText"
          )}
          fileUrl="/files/polygon-validation-template.xlsx" // TODO: Change to deforestation analysis template
        />
      </TextHeaderStepContainer>
      <CustomHeaderStepContainer
        header={
          <Box
            sx={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Text variant="h4" bold>
              {t(
                "deforestationAnalysis:uploadDataPage:mapSelectionStep:stepTitle"
              )}
            </Text>
            <MultiSelector
              sx={{ width: 350 }}
              selectedOptions={selectedCountries}
              options={countriesOptions}
              label={t(
                "deforestationAnalysis:uploadDataPage:mapSelectionStep:countrySelectorLabel"
              )}
              onChange={onCountrySelectionChange}
              compact
            />
          </Box>
        }
      >
        <MultiSelectionStep
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
      </CustomHeaderStepContainer>
      <TextHeaderStepContainer
        title={t("deforestationAnalysis:uploadDataPage:uploadStep:stepTitle")}
        sx={{
          flexGrow: 1,
          opacity: selectedMapsForDeforestation.length === 0 ? 0.4 : 1,
        }}
      >
        <UploadFileStep
          texts={{
            inactiveDragzoneCallToAction: t(
              "deforestationAnalysis:uploadDataPage:uploadStep:inactiveDragzoneCallToAction"
            ),
            activeDragzoneCallToAction: t(
              "deforestationAnalysis:uploadDataPage:uploadStep:activeDragzoneCallToAction"
            ),
            buttonText: t(
              "deforestationAnalysis:uploadDataPage:uploadStep:dragzoneButtonText"
            ),
            text: t(
              "deforestationAnalysis:uploadDataPage:uploadStep:dragzoneText"
            ),
          }}
          fileAccept={{
            "application/vnd.ms-excel": [".xls"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
              [".xlsx"],
          }}
          onDrop={onFileDropped}
          disabled={selectedMapsForDeforestation.length === 0}
        />
      </TextHeaderStepContainer>
    </UploadPageContent>
  );
}
