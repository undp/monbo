"use client";

import React, { useContext, useMemo, useState } from "react";
import { Box, Button } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { orderBy } from "lodash";
import { TFunction } from "i18next";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Table, RowData, Header } from "@/components/reusable/Table";
import { Text } from "@/components/reusable/Text";
import { MomboIcon } from "@/components/icons/MomboIcon";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { PolygonDetailModal } from "@/components/page/polygonsValidation/PolygonDetailModal";
import { GeometryInconsistencyModal } from "@/components/page/polygonsValidation/GeometryInconsistencyModal";
import { FarmOverlapsModal } from "@/components/page/polygonsValidation/FarmOverlapsModal";
import { DataContext } from "@/context/DataContext";
import { useSearch } from "@/hooks/useSearch";
import { useSortedTable } from "@/hooks/useSortedTable";
import { FarmData } from "@/interfaces/Farm";
import { parseAreaToHectares } from "@/utils/polygons";
import { removeDiacritics } from "@/utils/strings";
import {
  FarmValidationView,
  GeometryInconsistency,
  farmValidationViews,
} from "@/utils/validationResults";

const EMPTY_CELL = "—";
const SEARCH_KEYS = ["farm.id", "farm.producer", "farm.cropType"];

/** What a geometry error means, in words: the API's reason is GEOS's text. */
const geometryErrorText = (
  inconsistency: GeometryInconsistency,
  t: TFunction<"translation", undefined>
) => {
  if (inconsistency.type === "empty_polygon")
    return t("polygonValidation:results:status:emptyPolygon");
  const reason = inconsistency.data.reason.toLowerCase();
  if (reason.includes("self-intersection"))
    return t("polygonValidation:results:status:selfIntersection");
  if (reason.startsWith("too few points"))
    return t("polygonValidation:results:status:tooFewPoints");
  if (reason.startsWith("hole lies outside shell"))
    return t("polygonValidation:results:status:holeOutside");
  return t("polygonValidation:results:status:invalidGeometry");
};

/** The farm's status in words, as its row shows it. */
export const statusText = (
  view: FarmValidationView,
  t: TFunction<"translation", undefined>,
  language: string
): string => {
  switch (view.kind) {
    case "geometryError":
      return geometryErrorText(view.geometryInconsistency!, t);
    case "validatedManually":
      return t("polygonValidation:results:status:validatedManually");
    case "overlap":
      return view.overlaps.length === 1
        ? t("polygonValidation:results:status:overlapWith", {
            id: view.overlaps[0].neighbourId,
            area: parseAreaToHectares(view.overlaps[0].data.area, 2, true, language),
            interpolation: { escapeValue: false },
          })
        : t("polygonValidation:results:status:overlapMany", {
            count: view.overlaps.length,
          });
    case "ready":
      return t("polygonValidation:results:status:ready");
  }
};

const STATUS_STYLE: Record<
  FarmValidationView["kind"],
  { color: string; background: string; Icon: typeof CheckCircleOutlineRoundedIcon }
> = {
  ready: {
    color: FLOW_COLORS.ok,
    background: FLOW_COLORS.okBackground,
    Icon: CheckCircleOutlineRoundedIcon,
  },
  validatedManually: {
    color: FLOW_COLORS.blue,
    background: FLOW_COLORS.blue50,
    Icon: VerifiedOutlinedIcon,
  },
  overlap: {
    color: FLOW_COLORS.warn,
    background: FLOW_COLORS.warnBackground,
    Icon: WarningAmberRoundedIcon,
  },
  geometryError: {
    color: FLOW_COLORS.bad,
    background: FLOW_COLORS.badBackground,
    Icon: ErrorOutlineRoundedIcon,
  },
};

/** "Listo", "Se superpone con CO-006 (0,12 ha)"…, and "Revisar" when it applies. */
const StatusCell: React.FC<{
  view: FarmValidationView;
  onReview: () => void;
}> = ({ view, onReview }) => {
  const { t, i18n } = useTranslation();
  const { color, background, Icon } = STATUS_STYLE[view.kind];
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        columnGap: 1.5,
        rowGap: 0.5,
      }}
    >
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          borderRadius: 999,
          padding: "4px 10px",
          fontSize: 12.5,
          fontWeight: 600,
          lineHeight: 1.3,
          color,
          backgroundColor: background,
        }}
      >
        <Icon aria-hidden sx={{ fontSize: 16 }} />
        {statusText(view, t, i18n.language)}
      </Box>
      {view.kind !== "ready" && (
        <Button
          size="small"
          aria-label={t("polygonValidation:results:reviewFarm", {
            id: view.farm.id,
            interpolation: { escapeValue: false },
          })}
          onClick={(event) => {
            // The row itself opens the farm's detail
            event.stopPropagation();
            onReview();
          }}
          sx={{ minWidth: 0, padding: "2px 8px", fontWeight: 600 }}
        >
          {t("polygonValidation:results:review")}
        </Button>
      )}
    </Box>
  );
};

const originText = (
  farm: FarmData,
  t: TFunction<"translation", undefined>
): string => {
  if (!farm.origin) return EMPTY_CELL;
  if (farm.origin.method === "manual")
    return t("polygonValidation:results:drawn");
  return farm.origin.fileName ?? EMPTY_CELL;
};

const productionText = (farm: FarmData, language: string) =>
  `${farm.production.toLocaleString(language)} ${farm.productionQuantityUnit}`;

/** The order of the statuses when sorting by them: what needs a look first. */
const KIND_ORDER: Record<FarmValidationView["kind"], number> = {
  geometryError: 0,
  overlap: 1,
  validatedManually: 2,
  ready: 3,
};

const sortKey = (attr: string, view: FarmValidationView, numericIds: boolean) => {
  switch (attr) {
    case "id":
      return numericIds ? Number(view.farm.id) : view.farm.id;
    case "producer":
      return removeDiacritics(view.farm.producer).toLowerCase();
    case "cropType":
      return removeDiacritics(view.farm.cropType).toLowerCase();
    case "production":
      return view.farm.production;
    case "area":
      return view.farm.polygon.area ?? -1;
    case "status":
      return KIND_ORDER[view.kind];
    default:
      return 0;
  }
};

type Review =
  | { kind: "overlaps"; farmId: string }
  | { kind: "geometry"; inconsistency: GeometryInconsistency };

/**
 * Stage 1's results: one row per farm, in upload order, with its status and, when
 * it needs a look, "Revisar". An overlapping farm opens all its overlaps, where it
 * can be validated manually; a geometry error opens its explanation.
 */
export const ValidationResultsTable: React.FC = () => {
  const { farmsData, polygonsValidationResults } = useContext(DataContext);
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchValue = searchParams.get("search")?.toString() || "";
  const [sortedBy, setSortedBy] = useSortedTable();
  const [detail, setDetail] = useState<RowData<FarmData> | null>(null);
  const [review, setReview] = useState<Review | null>(null);

  const views = useMemo(
    () =>
      farmsData && polygonsValidationResults
        ? farmValidationViews(farmsData, polygonsValidationResults)
        : [],
    [farmsData, polygonsValidationResults]
  );
  const searchOptions = useMemo(() => ({ keys: SEARCH_KEYS }), []);
  const found = useSearch<FarmValidationView>(views, searchValue, searchOptions);
  const shown = useMemo(() => {
    if (!sortedBy) return found;
    const numericIds = found.every(({ farm }) => !isNaN(Number(farm.id)));
    return orderBy(
      found,
      (view) => sortKey(sortedBy.attr, view, numericIds),
      sortedBy.order
    );
  }, [found, sortedBy]);

  const reviewedView =
    review?.kind === "overlaps"
      ? views.find(({ farm }) => farm.id === review.farmId) ?? null
      : null;

  const headers: Header[] = [
    { name: t("polygonValidation:results:columns:id"), attr: "id", type: "label", sortable: true },
    { name: t("polygonValidation:results:columns:producer"), attr: "producer", type: "label", sortable: true },
    { name: t("polygonValidation:results:columns:crop"), attr: "cropType", type: "label", sortable: true },
    {
      name: t("polygonValidation:results:columns:production"),
      attr: "production",
      type: "label",
      sortable: true,
      columnStyle: { textAlign: "right" },
    },
    {
      name: t("polygonValidation:results:columns:area"),
      attr: "area",
      type: "label",
      sortable: true,
      columnStyle: { textAlign: "right" },
    },
    { name: t("polygonValidation:results:columns:type"), attr: "type", type: "label" },
    { name: t("polygonValidation:results:columns:origin"), attr: "origin", type: "label" },
    { name: t("polygonValidation:results:columns:status"), attr: "status", type: "label", sortable: true },
  ];

  const rows: RowData<FarmData>[] = shown.map((view) => {
    const { farm } = view;
    return {
      data: farm,
      cells: {
        id: { value: farm.id, cellStyle: { fontWeight: 600 } },
        producer: { value: farm.producer },
        cropType: { value: farm.cropType },
        production: {
          value: productionText(farm, i18n.language),
          cellStyle: { textAlign: "right", whiteSpace: "nowrap" },
        },
        area: {
          value:
            farm.polygon.area === null
              ? EMPTY_CELL
              : parseAreaToHectares(farm.polygon.area, 2, true, i18n.language),
          cellStyle: { textAlign: "right", whiteSpace: "nowrap" },
        },
        type: {
          value: t(farm.polygon.type === "point" ? "common:point" : "common:polygon"),
        },
        origin: {
          value: originText(farm, t),
          cellStyle: { maxWidth: 200, wordBreak: "break-word" },
        },
        status: {
          value: (
            <StatusCell
              view={view}
              onReview={() =>
                setReview(
                  view.kind === "geometryError"
                    ? { kind: "geometry", inconsistency: view.geometryInconsistency! }
                    : { kind: "overlaps", farmId: farm.id }
                )
              }
            />
          ),
        },
      },
    };
  });

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        width: "100%",
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
          paddingX: 1,
          paddingTop: 0.5,
        }}
      >
        <Text variant="body1" bold>
          {t("polygonValidation:results:count", { count: views.length })}
        </Text>
        <Button
          startIcon={<AddRoundedIcon />}
          onClick={() => router.push("/polygons-validation/upload-data")}
          sx={{ marginLeft: "auto", fontWeight: 600 }}
        >
          {t("polygonValidation:results:addMore")}
        </Button>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {rows.length === 0 ? (
          <Box
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <MomboIcon sx={{ fontSize: 64 }} />
            <Text variant="h3" bold>
              {t("polygonValidation:noResults")}
            </Text>
          </Box>
        ) : (
          <Table
            headers={headers}
            headerStyle={{ backgroundColor: "#fff" }}
            rows={rows}
            onRowClick={setDetail}
            sortedBy={sortedBy}
            sortBy={setSortedBy}
          />
        )}
      </Box>
      <PolygonDetailModal
        isOpen={detail !== null}
        handleClose={() => setDetail(null)}
        row={detail}
      />
      <FarmOverlapsModal
        view={reviewedView}
        onClose={() => setReview(null)}
      />
      <GeometryInconsistencyModal
        isOpen={review?.kind === "geometry"}
        handleClose={() => setReview(null)}
        row={
          review?.kind === "geometry"
            ? { cells: {}, data: review.inconsistency }
            : null
        }
      />
    </Box>
  );
};
