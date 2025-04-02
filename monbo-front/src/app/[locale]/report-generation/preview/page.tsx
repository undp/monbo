"use client";

import { NavigateHomepageWhenEmptyData } from "@/components/reusable/NavigateHomepageWhenEmptyData";
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  PDFViewer,
} from "@react-pdf/renderer";
import { useTranslation } from "react-i18next";
import { Box } from "@mui/material";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import { FarmData } from "@/interfaces/Farm";
import {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import { useContext } from "react";
import { DataContext } from "@/context/DataContext";

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: "row",
    backgroundColor: "#E4E4E4",
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1,
  },
});

// Create Document Component
const MyReport = ({
  farmsData,
  deforestationAnalysisResults,
  mapsData,
}: {
  farmsData: FarmData[];
  deforestationAnalysisResults: DeforestationAnalysisMapResults[];
  mapsData: MapData[];
}) => (
  <Document>
    {farmsData.map((farm) =>
      deforestationAnalysisResults.map((mapResults) => {
        const farmResult = mapResults.farmResults.find(
          (r) => r.farmId === farm.id
        );
        if (!farmResult) return null;
        const map = mapsData.find((m) => m.id === mapResults.mapId);

        return (
          <Page
            key={`${farm.id}-${mapResults.mapId}`}
            size="A4"
            style={styles.page}
          >
            <View style={styles.section}>
              <Text>ID: {farm.id}</Text>
              <Text>Productor: {farm.producer}</Text>
              <Text>Fecha de producción: {farm.productionDate}</Text>
              <Text>Producción: {farm.production}</Text>
              <Text>Cantidad de producción: {farm.productionQuantityUnit}</Text>
              <Text>País: {farm.country}</Text>
              <Text>Región: {farm.region}</Text>
              <Text>Tipo de cultivo: {farm.cropType}</Text>
              <Text>Asociación: {farm.association}</Text>

              <Text>Mapa: {map?.name}</Text>
              <Text>Deforestación: {farmResult.value}%</Text>
            </View>
          </Page>
        );
      })
    )}
  </Document>
);

export default function DeforestationAnalysis() {
  const {} = useTranslation(["deforestationAnalysis"]);
  const { farmsData, deforestationAnalysisResults } =
    useVisibleDataForDeforestationPage();
  const { availableMaps } = useContext(DataContext);

  return (
    <Box sx={{ width: "100%", height: "100vh" }}>
      <NavigateHomepageWhenEmptyData />
      <PDFViewer style={{ width: "100%", height: "100%" }}>
        <MyReport
          farmsData={farmsData}
          deforestationAnalysisResults={deforestationAnalysisResults}
          mapsData={availableMaps}
        />
      </PDFViewer>
    </Box>
  );
}
