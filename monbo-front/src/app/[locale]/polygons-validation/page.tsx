import { Box } from "@mui/material";
import { Text } from "@/components/reusable/Text";
import { SectionBackground } from "@/components/reusable/SectionBackground";
import { Tabs } from "@/components/reusable/Tabs";
import { DownloadPageData } from "@/components/page/polygonsValidation/DownloadPageData";

import { ValidFarmsTable } from "./ValidFarmsTable";
import { InconsistentFarmsTable } from "./InconsistentFarmsTable";

import { TabTitle } from "@/components/page/polygonsValidation/TabTitle";
import { PageFooter } from "@/components/page/polygonsValidation/PageFooter";
import TranslationsProvider from "@/context/TranslationProvider";
import { BasePageProps } from "@/interfaces";
import initTranslations from "@/utils/i18n";
import { SearchBar } from "@/components/reusable/inputs/SearchBar";
import { Suspense } from "react";
import { NavigateHomepageWhenEmptyData } from "@/components/reusable/NavigateHomepageWhenEmptyData";

const namespaces = ["common", "polygonValidation"];

export default async function PolygonsValidationPage({
  params,
}: BasePageProps) {
  const { locale } = await params;
  const { t, resources } = await initTranslations(locale, namespaces);

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
          <Text variant="h3" bold>
            {t("polygonValidation:title")}
          </Text>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Suspense>
              <SearchBar
                placeholder={t("polygonValidation:searchPlaceholder")}
              />
            </Suspense>
            <DownloadPageData />
          </Box>
        </Box>
        <SectionBackground
          sx={{ alignSelf: "stretch", flexGrow: 1, minHeight: 300 }}
        >
          <Suspense>
            <Tabs
              tabs={[
                {
                  id: "validated",
                  title: <TabTitle type="valid" />,
                  content: <ValidFarmsTable />,
                },
                {
                  id: "inconsistents",
                  title: <TabTitle type="inconsistent" />,
                  content: <InconsistentFarmsTable />,
                },
              ]}
            />
          </Suspense>
        </SectionBackground>
      </Box>

      <PageFooter />
    </TranslationsProvider>
  );
}
