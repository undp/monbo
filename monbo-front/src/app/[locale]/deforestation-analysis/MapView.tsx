"use client";

import { SearchBar } from "@/components/reusable/inputs/SearchBar";
import { Text } from "@/components/reusable/Text";
import { Box, Divider } from "@mui/material";
import { Suspense, useCallback, useMemo, useState } from "react";
import { FarmsList } from "@/components/page/deforestationAnalysis/FarmsList";
import { SelectedPolygonsMap } from "@/components/page/deforestationAnalysis/SelectedPolygonsMap";
import { useTranslation } from "react-i18next";
import { useSelectedMap } from "@/hooks/useSelectedMapName";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import { FarmData } from "@/interfaces/Farm";
import { useSearchParams } from "next/navigation";
import { ClassicTabs } from "@/components/reusable/ClassicTabs";
import { isDeforestationAboveThreshold } from "@/utils/deforestation";

export const MapView: React.FC = () => {
  const { t } = useTranslation();
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

  const { farmsData, deforestationAnalysisResults } =
    useVisibleDataForDeforestationPage();

  const searchParams = useSearchParams();
  const searchValue = searchParams.get("search");

  const [deforestedFarms, freeDeforestationFarms] = useMemo(() => {
    const deforested: FarmData[] = [];
    const deforestationFree: FarmData[] = [];
    farmsData.forEach((farm) => {
      const deforestationResult = deforestationAnalysisResults
        ?.find((result) => result.mapId === selectedMapId)
        ?.farmResults.find((farmResult) => farmResult.farmId === farm.id);
      if (!deforestationResult) {
        // Farms without deforestation analysis results for this map are assumed to be deforestation-free
        deforestationFree.push(farm);
      } else if (isDeforestationAboveThreshold(deforestationResult.value)) {
        deforested.push(farm);
      } else {
        deforestationFree.push(farm);
      }
    });
    return [deforested, deforestationFree];
  }, [farmsData, deforestationAnalysisResults, selectedMapId]);

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
        title: `${t("deforestationAnalysis:withDeforestation")} (${
          deforestedFarms.length
        })`,
        content: (
          <FarmsList
            farmsData={deforestedFarms}
            selectedValue={selectedPolygonIdAtList}
            onChange={onPolygonListClick}
          />
        ),
      },
      {
        id: 2,
        title: `${t("deforestationAnalysis:deforestationFreeShortText")} (${
          freeDeforestationFarms.length
        })`,
        content: (
          <FarmsList
            farmsData={freeDeforestationFarms}
            selectedValue={selectedPolygonIdAtList}
            onChange={onPolygonListClick}
          />
        ),
      },
    ];
  }, [
    deforestedFarms,
    freeDeforestationFarms,
    onPolygonListClick,
    selectedPolygonIdAtList,
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
            placeholder={t("deforestationAnalysis:searchPlaceholder")}
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
            {t("deforestationAnalysis:map")}: {selectedMapName}
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
              alignItems: "center",
            }}
          >
            {selectedMapName}
            &nbsp;&nbsp;|&nbsp;&nbsp;
            {t("deforestationAnalysis:deforestationMapFooter", {
              baselineYear: baseline,
              comparedToYear: comparedAgainst,
            })}
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <FiberManualRecordIcon
              sx={{
                width: 18,
                height: 18,
                color: "red",
                mr: 1,
              }}
            />
            {t("deforestationAnalysis:deforestation")}
          </Text>
          <Text
            sx={{
              display: "flex",
              alignItems: "center",
            }}
          >
            {t("deforestationAnalysis:satelliteImageryDisclaimer")}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
