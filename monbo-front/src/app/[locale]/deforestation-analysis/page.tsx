import { SearchBar } from "@/components/reusable/inputs/SearchBar";
import { SectionBackground } from "@/components/reusable/SectionBackground";
import TranslationsProvider from "@/context/TranslationProvider";
import { PageWithSearchParams } from "@/interfaces";
import initTranslations from "@/utils/i18n";
import { Box, ButtonGroup } from "@mui/material";
import { DeforestationResultsTable } from "./DeforestationResultsTable";
import { MapView } from "./MapView";
import { PageFooter } from "@/components/page/deforestationAnalysis/PageFooter";

import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import { SearchParamButton } from "@/components/reusable/SearchParamButton";
import { PageTitle } from "./PageTitle";
import { NavigateHomepageWhenEmptyData } from "@/components/reusable/NavigateHomepageWhenEmptyData";
import { ResultsMapSelector } from "./ResultsMapSelector";
import { DownloadPageData } from "@/components/page/deforestationAnalysis/DownloadPageData";

const namespaces = ["common", "deforestationAnalysis"];

interface SearchParams {
  view: "table" | "map";
  selectedMapId?: string;
}

export default async function DeforestationAnalysis({
  params,
  searchParams,
}: PageWithSearchParams<SearchParams>) {
  const { locale } = await params;
  const { view } = await searchParams;
  const { t, resources } = await initTranslations(locale, namespaces);

  const selectedView = view ?? "table";

  return (
    <TranslationsProvider
      locale={locale}
      namespaces={namespaces}
      resources={resources}
    >
      <NavigateHomepageWhenEmptyData />
      <Box
        sx={{
          padding: 3,
          paddingBottom: 11,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          height: "calc(100vh - 64px)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <PageTitle />
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            {selectedView === "table" && (
              <>
                <SearchBar
                  placeholder={t("deforestationAnalysis:searchPlaceholder")}
                  style={{ minWidth: "400px" }}
                />
              </>
            )}
            {selectedView === "map" && <ResultsMapSelector />}
            <ButtonGroup>
              <SearchParamButton
                searchParamKey="view"
                searchParamValue="table"
                variant={selectedView == "table" ? "contained" : undefined}
                sx={{ padding: 0.6 }}
              >
                <FormatListBulletedIcon />
              </SearchParamButton>
              <SearchParamButton
                searchParamKey="view"
                searchParamValue="map"
                variant={selectedView == "map" ? "contained" : undefined}
                sx={{ padding: 0.6 }}
              >
                <TravelExploreIcon />
              </SearchParamButton>
            </ButtonGroup>
            <DownloadPageData />
          </Box>
        </Box>
        <SectionBackground
          sx={{ alignSelf: "stretch", flexGrow: 1, minHeight: 300, padding: 0 }}
        >
          {selectedView == "map" ? <MapView /> : <DeforestationResultsTable />}
        </SectionBackground>
      </Box>
      <PageFooter locale={locale} />
    </TranslationsProvider>
  );
}
