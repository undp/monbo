"use client";

import { SearchBar } from "@/components/reusable/inputs/SearchBar";
import { Text } from "@/components/reusable/Text";
import { Box, Divider } from "@mui/material";
import { Suspense, useCallback, useMemo, useState } from "react";
import { FarmsList } from "@/components/page/territorialAnalysis/FarmsList";
import { SelectedPolygonsMap } from "@/components/page/territorialAnalysis/SelectedPolygonsMap";
import { useTranslation } from "react-i18next";
import { useSelectedMap } from "@/hooks/useSelectedMapName";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useVisibleDataForAnalysisPage } from "@/hooks/useVisibleDataForAnalysisPage";
import { useSearchParams } from "next/navigation";
import { ClassicTabs } from "@/components/reusable/ClassicTabs";
import { groupFarmsByResult } from "@/utils/layerResults";
import { useLayerReading } from "@/hooks/useLayerRules";
import { localizedText } from "@/utils/localizedText";
import { categoryTints } from "@/utils/categoryColors";
import { LayerCategoryIcon } from "@/components/reusable/LayerCategoryIcon";

export const MapView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [selectedPolygonIdAtList, setSelectedPolygonIdAtList] =
    useState<string>("all");
  const [selectedPolygonIdAtMap, setSelectedPolygonIdAtMap] = useState<
    string | null
  >(null);

  const {
    id: selectedMapId,
    name: selectedMapName,
    baseline,
    comparedAgainst,
  } = useSelectedMap();
  const { category, rule } = useLayerReading(selectedMapId);

  const { farmsData, territorialAnalysisResults } =
    useVisibleDataForAnalysisPage();

  const searchParams = useSearchParams();
  const searchValue = searchParams.get("search");

  // A farm without a result for this layer (or with a null one, or a layer whose
  // category is missing) is "no data", never ok.
  const {
    flagged: flaggedFarms,
    ok: okFarms,
    unknown: noDataFarms,
  } = useMemo(
    () =>
      groupFarmsByResult(
        farmsData,
        territorialAnalysisResults?.find(
          (result) => result.mapId === selectedMapId
        ),
        rule
      ),
    [farmsData, territorialAnalysisResults, selectedMapId, rule]
  );

  // The groups are named with the layer's category labels.
  const flaggedLabel = category
    ? localizedText(category.resultLabels.flagged, i18n.language)
    : t("territorialAnalysis:results.flagged");
  const okLabel = category
    ? localizedText(category.resultLabels.ok, i18n.language)
    : t("territorialAnalysis:results.ok");

  const onPolygonListClick = useCallback(
    (id: string) => {
      setSelectedPolygonIdAtList(id);
      // Update the polygon selected inside the map
      if (id === "all") {
        setSelectedPolygonIdAtMap(null);
      } else {
        setSelectedPolygonIdAtMap(id);
      }
    },
    [setSelectedPolygonIdAtList, setSelectedPolygonIdAtMap]
  );

  const handleTabsChange = useCallback(() => {
    setSelectedPolygonIdAtList("all");
    setSelectedPolygonIdAtMap(null);
  }, [setSelectedPolygonIdAtList, setSelectedPolygonIdAtMap]);

  const tabsOptions = useMemo(() => {
    return [
      {
        id: 1,
        title: `${flaggedLabel} (${flaggedFarms.length})`,
        content: (
          <FarmsList
            farmsData={flaggedFarms}
            selectedValue={selectedPolygonIdAtList}
            onChange={onPolygonListClick}
          />
        ),
      },
      {
        id: 2,
        title: `${okLabel} (${okFarms.length})`,
        content: (
          <FarmsList
            farmsData={okFarms}
            selectedValue={selectedPolygonIdAtList}
            onChange={onPolygonListClick}
          />
        ),
      },
      // Only when there is something to show: the column is narrow.
      ...(noDataFarms.length > 0
        ? [
            {
              id: 3,
              title: `${t("territorialAnalysis:noDataShortText")} (${
                noDataFarms.length
              })`,
              content: (
                <FarmsList
                  farmsData={noDataFarms}
                  selectedValue={selectedPolygonIdAtList}
                  onChange={onPolygonListClick}
                />
              ),
            },
          ]
        : []),
    ];
  }, [
    flaggedFarms,
    okFarms,
    noDataFarms,
    onPolygonListClick,
    selectedPolygonIdAtList,
    flaggedLabel,
    okLabel,
    t,
  ]);

  return (
    <Box
      sx={{
        padding: 2,
        pl: 0,
        display: "flex",
        width: "100%",
        gap: 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          width: "22%",
        }}
      >
        <Text sx={{ pl: 2 }} variant="h4" bold>
          {t("common:polygons")}
        </Text>
        <Divider sx={{ marginTop: 1, marginBottom: 2, ml: 2 }} />
        <Suspense>
          <SearchBar
            placeholder={t("territorialAnalysis:searchPlaceholder")}
            style={{
              width: "calc(100% - 16px)",
              marginLeft: 2,
              marginRight: 2,
            }}
          />
        </Suspense>

        {!searchValue && (
          <ClassicTabs
            tabs={tabsOptions}
            fullWidth
            onChange={handleTabsChange}
            styles={{
              root: {
                display: "flex",
                flexGrow: 1,
                flexDirection: "column",
                overflowY: "auto",
                mt: 1,
              },
              tabsContainer: {
                ml: 2,
              },
            }}
          />
        )}

        {searchValue && (
          <Box
            sx={{
              display: "flex",
              flexGrow: 1,
              flexDirection: "column",
              overflowY: "auto",
              mt: 2,
            }}
          >
            <FarmsList
              farmsData={farmsData}
              selectedValue={selectedPolygonIdAtList}
              onChange={onPolygonListClick}
            />
          </Box>
        )}
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          width: "78%",
          gap: 1,
          flexShrink: 0,
        }}
      >
        <Box>
          <Text variant="h4" bold>
            {t("territorialAnalysis:map")}: {selectedMapName}
          </Text>
        </Box>
        <SelectedPolygonsMap
          farmsData={farmsData}
          allPolygonsSelected={selectedPolygonIdAtList === "all"}
          selectedPolygonIdAtMap={selectedPolygonIdAtMap}
          setSelectedPolygonIdAtMap={setSelectedPolygonIdAtMap}
        />

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <Text
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {selectedMapName}
            {baseline !== null && comparedAgainst !== null && (
              <>
                &nbsp;&nbsp;|&nbsp;&nbsp;
                {t("territorialAnalysis:mapFooter", {
                  baselineYear: baseline,
                  comparedToYear: comparedAgainst,
                })}
              </>
            )}
            &nbsp;&nbsp;|&nbsp;&nbsp;
            {/* Tiles are red for every category; the legend names the category. */}
            <FiberManualRecordIcon
              sx={{
                width: 18,
                height: 18,
                color: "red",
                mr: 1,
              }}
            />
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                color: categoryTints(category?.color).color,
                fontWeight: 500,
              }}
            >
              <LayerCategoryIcon icon={category?.icon} sx={{ fontSize: 18 }} />
              {category
                ? localizedText(category.name, i18n.language)
                : t("territorialAnalysis:categories.uncategorized")}
            </Box>
          </Text>
          <Text
            sx={{
              display: "flex",
              alignItems: "center",
            }}
          >
            {t("territorialAnalysis:satelliteImageryDisclaimer")}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
