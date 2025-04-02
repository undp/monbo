import {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import { FarmData } from "@/interfaces/Farm";
import { Page, Text, View, Document, StyleSheet } from "@react-pdf/renderer";

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
export const DeforestationReportDocument = ({
  farmsData,
  deforestationAnalysisResults,
  mapsData,
}: {
  farmsData: FarmData[];
  deforestationAnalysisResults: DeforestationAnalysisMapResults[];
  mapsData: MapData[];
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text>PORTADA</Text>
      </View>
    </Page>
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
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text>CÁLCULO DE DEFORESTACIÓN</Text>
      </View>
    </Page>
    {deforestationAnalysisResults.map((mapResults) => {
      const map = mapsData.find((m) => m.id === mapResults.mapId)!;
      return (
        <Page size="A4" style={styles.page} key={mapResults.mapId}>
          <View style={styles.section}>
            <Text>Mapas utilizados para el análisis de deforestación</Text>
            <Text>{map.name}</Text>
          </View>
        </Page>
      );
    })}
  </Document>
);
