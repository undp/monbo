import { DataContext } from "@/context/DataContext";
import { useCallback, useContext } from "react";
import { pdf } from "@react-pdf/renderer";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { DeforestationReportDocument } from "@/utils/deforestationReport";

export const useDeforestationReportDownload = () => {
  const { farmsData, deforestationAnalysisResults } =
    useVisibleDataForDeforestationPage();
  const {
    deforestationAnalysisParams: { selectedMaps },
  } = useContext(DataContext);

  const downloadCompleteReport = useCallback(async () => {
    const pdfBlob = await pdf(
      <DeforestationReportDocument
        farmsData={farmsData}
        deforestationAnalysisResults={deforestationAnalysisResults}
        mapsData={selectedMaps}
      />
    ).toBlob();
    // TODO: internationalize filename
    saveAs(pdfBlob, "deforestation-complete-report.pdf");
  }, [farmsData, deforestationAnalysisResults, selectedMaps]);

  const downloadSeparatedReports = useCallback(async () => {
    const zip = new JSZip();

    // Generate PDFs and add them to zip
    for (let i = 0; i < farmsData.length; i++) {
      const farm = farmsData[i];
      const pdfBlob = await pdf(
        <DeforestationReportDocument
          farmsData={[farm]}
          deforestationAnalysisResults={deforestationAnalysisResults}
          mapsData={selectedMaps}
        />
      ).toBlob();

      zip.file(`report_farm_${farm.id}.pdf`, pdfBlob);
    }

    // Generate ZIP and trigger download
    const zipBlob = await zip.generateAsync({ type: "blob" });
    // TODO: internationalize filename
    saveAs(zipBlob, "deforestation-reports.zip");
  }, [farmsData, deforestationAnalysisResults, selectedMaps]);

  return { downloadCompleteReport, downloadSeparatedReports };
};
