"use client";

import React, { useContext, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
} from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import PentagonOutlinedIcon from "@mui/icons-material/PentagonOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { Accept } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { DropZone } from "@/components/reusable/DropZone";
import { Text } from "@/components/reusable/Text";
import { sum } from "lodash";
import { FlowBottomBar } from "@/components/page/flow/FlowBottomBar";
import { FlowSection } from "@/components/page/flow/FlowSection";
import { SummaryStat } from "@/components/page/flow/SummaryStat";
import {
  FLOW_COLORS,
} from "@/components/page/flow/flowStyles";
import { getUploadExamples } from "@/config/uploadExamples";
import { SnackbarContext } from "@/context/SnackbarContext";
import { FarmRow } from "@/interfaces/FarmRow";
import { notifyUploadErrors } from "@/utils/uploadErrors";
import {
  getGeoUploadTemplatePath,
  getUploadFileTemplatePath,
} from "@/utils/excel";
import { EXCEL_ACCEPT, UPLOAD_FILE_ACCEPT } from "@/utils/geoFile";
import {
  ManualSource,
  UploadSource,
  canAttachExcel,
  collectUpload,
  isUploadable,
  sourceRows,
  uploadSummary,
  uploadSummaryText,
} from "@/utils/uploadSources";
import { FarmRowsTable } from "./FarmRowsTable";
import { DrawArea } from "./DrawArea";
import { FileNotice } from "./FileNotice";
import { GeoFileFieldsHelp } from "./GeoFileFieldsHelp";
import { HowToSteps } from "./HowToSteps";
import { ManualFarmModal } from "./manualFarm/ManualFarmModal";
import { MethodButton } from "./MethodButton";
import { PairDropZone } from "./PairDropZone";
import { HOW_TO_LINK, HowToLink } from "./uploadStepStyles";
import { UploadSourcesState } from "./useUploadSources";

const EXCEL_EXTENSIONS = Object.values(EXCEL_ACCEPT).flat().join(",");
// Geo files only: the Excel types taken out of the step's full list
const GEO_ACCEPT: Accept = Object.fromEntries(
  Object.entries(UPLOAD_FILE_ACCEPT).filter(([type]) => !(type in EXCEL_ACCEPT))
);

type Method = "excel" | "geoData" | "geoExcel" | "manual";

const METHODS: { key: Method; icon: React.ReactNode; steps: number }[] = [
  { key: "excel", icon: <TableChartOutlinedIcon fontSize="small" />, steps: 3 },
  { key: "geoData", icon: <MapOutlinedIcon fontSize="small" />, steps: 2 },
  { key: "geoExcel", icon: <DescriptionOutlinedIcon fontSize="small" />, steps: 3 },
  { key: "manual", icon: <EditOutlinedIcon fontSize="small" />, steps: 2 },
];

/** The method a listed source came from: a geo file with its Excel is option 3. */
const methodOf = (source: UploadSource): Method => {
  if (source.kind === "excel") return "excel";
  if (source.kind === "manual") return "manual";
  return source.excel ? "geoExcel" : "geoData";
};

interface FarmsUploadStepProps {
  upload: UploadSourcesState;
  country: string | null;
  /** The step's button, e.g. "Validate polygons" */
  submitLabel: string;
  onSubmit: (rows: FarmRow[]) => void;
  disabled?: boolean;
  /**
   * "page": the methods and the list as two cards, and a bar at the bottom with
   * the counts and the button (both stages' upload pages). "embedded": all of it
   * inside the card of a page that has its own bar.
   */
  variant?: "page" | "embedded";
  /**
   * Keep the bottom bar when the list is emptied: farms were loaded from it, and
   * an emptied list must not look confirmed. The button stays off until the list
   * has a farm again.
   */
  keepBar?: boolean;
}

/**
 * The upload step: the ways to add farms (the Excel template, a geo file with the
 * data, a geo file with its Excel, drawing on the map), one at a time with its
 * steps and its control, and the list of what will be uploaded. Nothing is sent
 * until the user presses the step's button.
 */
export const FarmsUploadStep: React.FC<FarmsUploadStepProps> = ({
  upload,
  country,
  submitLabel,
  onSubmit,
  disabled,
  variant = "embedded",
  keepBar = false,
}) => {
  const { t, i18n } = useTranslation();
  const { openSnackbar } = useContext(SnackbarContext);
  const [method, setMethod] = useState<Method>("excel");
  const [manualFarm, setManualFarm] = useState<{
    open: boolean;
    editing: ManualSource | null;
  }>({ open: false, editing: null });
  const [fieldsHelpOpen, setFieldsHelpOpen] = useState(false);
  // Option 3: its two files, until both are there
  const [pairGeo, setPairGeo] = useState<File | null>(null);
  const [pairExcel, setPairExcel] = useState<File | null>(null);
  const excelInput = useRef<HTMLInputElement>(null);
  const attachingTo = useRef<UploadSource | null>(null);

  const { sources, reading, addGeoFileWithExcel } = upload;
  const summary = uploadSummary(sources);
  const canSubmit =
    !disabled && !reading && sources.length > 0 && sources.every(isUploadable);
  const examples = getUploadExamples(i18n.language);
  const loadedByMethod = (key: Method) =>
    sum(
      sources
        .filter((source) => methodOf(source) === key)
        .map((source) => sourceRows(source).length)
    );
  const dropTexts = {
    inactiveDragzoneCallToAction: t("common:farmsUpload:dropTitle"),
    activeDragzoneCallToAction: t("common:farmsUpload:dropzoneActive"),
    text: t("common:farmsUpload:browsePrefix"),
    buttonText: t("common:farmsUpload:browse"),
  };

  /** Option 3: once both files are there, they go to the list as one source. */
  const choosePairFile = (kind: "geo" | "excel", file: File | null) => {
    const geo = kind === "geo" ? file : pairGeo;
    const excel = kind === "excel" ? file : pairExcel;
    if (geo && excel) {
      addGeoFileWithExcel(geo, excel);
      setPairGeo(null);
      setPairExcel(null);
      return;
    }
    setPairGeo(geo);
    setPairExcel(excel);
  };

  const submit = () => {
    const { rows, errorMessages } = collectUpload(sources, t);
    if (errorMessages.length > 0) {
      notifyUploadErrors(openSnackbar, errorMessages, t);
      return;
    }
    onSubmit(rows);
  };

  const chooseExcelFor = (source: UploadSource) => {
    attachingTo.current = source;
    excelInput.current?.click();
  };

  const onExcelChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const source = attachingTo.current;
    event.target.value = "";
    if (file && source && canAttachExcel(source)) upload.attach(source, file);
  };

  const links: Record<Method, HowToLink[]> = {
    excel: [
      { label: t("common:farmsUpload:cards:template"), href: getUploadFileTemplatePath(i18n.language), template: true },
      { label: t("common:farmsUpload:cards:example"), href: examples.excel },
    ],
    geoData: [
      { label: t("common:farmsUpload:cards:exampleGeojson"), href: examples.geojson },
      { label: t("common:farmsUpload:cards:exampleShapefile"), href: examples.shapefile },
    ],
    geoExcel: [
      { label: t("common:farmsUpload:cards:template"), href: getGeoUploadTemplatePath(i18n.language), template: true },
      { label: t("common:farmsUpload:cards:exampleKml"), href: examples.kml },
      { label: t("common:farmsUpload:cards:exampleExcel"), href: examples.geoExcel },
    ],
    manual: [],
  };

  const controls: Record<Method, React.ReactNode> = {
    excel: (
      <DropZone
        appearance="flow"
        multiple
        disabled={disabled}
        onDrop={upload.addExcelFiles}
        accept={EXCEL_ACCEPT}
        invalidTypeMessage={t("common:farmsUpload:cards:excel:wrongType")}
        texts={{
          ...dropTexts,
          allowedExtensions: t("common:farmsUpload:cards:excel:extensions"),
        }}
      />
    ),
    geoData: (
      <DropZone
        appearance="flow"
        multiple
        disabled={disabled}
        onDrop={upload.addGeoFiles}
        accept={GEO_ACCEPT}
        invalidTypeMessage={t("common:farmsUpload:cards:geoData:wrongType")}
        texts={{
          ...dropTexts,
          allowedExtensions: t("common:farmsUpload:cards:geoData:extensions"),
        }}
      />
    ),
    geoExcel: (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, flexGrow: 1 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 1.5,
            flexGrow: 1,
          }}
        >
          <PairDropZone
            file={pairGeo}
            onFile={(file) => choosePairFile("geo", file)}
            accept={GEO_ACCEPT}
            disabled={disabled}
            title={t("common:farmsUpload:cards:geoExcel:geoDrop")}
            extensions={t("common:farmsUpload:cards:geoExcel:geoExtensions")}
            invalidTypeMessage={t("common:farmsUpload:cards:geoExcel:wrongGeoType")}
          />
          <PairDropZone
            file={pairExcel}
            onFile={(file) => choosePairFile("excel", file)}
            accept={EXCEL_ACCEPT}
            disabled={disabled}
            title={t("common:farmsUpload:cards:geoExcel:excelDrop")}
            extensions={t("common:farmsUpload:cards:geoExcel:excelExtensions")}
            invalidTypeMessage={t("common:farmsUpload:cards:geoExcel:wrongExcelType")}
          />
        </Box>
        {(pairGeo || pairExcel) && (
          <Text variant="body2" color="secondary">
            {t(
              pairGeo
                ? "common:farmsUpload:cards:geoExcel:waitingExcel"
                : "common:farmsUpload:cards:geoExcel:waitingGeo"
            )}
          </Text>
        )}
      </Box>
    ),
    manual: (
      <DrawArea
        disabled={disabled}
        onClick={() => setManualFarm({ open: true, editing: null })}
      />
    ),
  };

  const current = METHODS.find(({ key }) => key === method) ?? METHODS[0];
  const methodKey = `common:farmsUpload:cards:${method}`;

  const picker = (
    <Box sx={{ opacity: disabled ? 0.5 : 1 }}>
      <Box
        role="group"
        aria-label={t("common:farmsUpload:methodsTitle")}
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        {METHODS.map(({ key, icon }) => (
          <MethodButton
            key={key}
            icon={icon}
            title={t(`common:farmsUpload:cards:${key}:title`)}
            description={t(`common:farmsUpload:cards:${key}:when`)}
            loaded={loadedByMethod(key)}
            selected={key === method}
            onClick={() => setMethod(key)}
          />
        ))}
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1.25fr" },
          gap: "22px",
          marginTop: 2,
          padding: "18px",
          borderRadius: "12px",
          backgroundColor: FLOW_COLORS.blue25,
          border: `1px solid ${FLOW_COLORS.line}`,
        }}
      >
        <HowToSteps
          steps={Array.from({ length: current.steps }, (_, index) =>
            t(`${methodKey}:steps:${index + 1}`)
          )}
          links={links[method]}
          onFieldsHelp={method === "geoData" ? () => setFieldsHelpOpen(true) : undefined}
        />
        <Box sx={{ display: "flex", minWidth: 0 }}>{controls[method]}</Box>
      </Box>
    </Box>
  );

  const removeAll =
    sources.length > 0 ? (
      <Box
        component="button"
        type="button"
        onClick={upload.removeAll}
        sx={HOW_TO_LINK}
      >
        {t("common:farmsUpload:removeAll")}
      </Box>
    ) : null;

  const fileSources = sources.filter(
    (source): source is Exclude<UploadSource, ManualSource> =>
      source.kind !== "manual"
  );

  const list =
    sources.length === 0 && !reading ? (
      <Box
        sx={{
          padding: "34px",
          textAlign: "center",
          color: FLOW_COLORS.muted,
          fontSize: 14,
          border: `1.5px dashed ${FLOW_COLORS.line}`,
          borderRadius: "12px",
        }}
      >
        {t("common:farmsUpload:emptyHint")}
      </Box>
    ) : (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
        {fileSources.map((source) => (
          <FileNotice
            key={source.key}
            source={source}
            onRemove={() => upload.remove(source)}
            onShowErrors={() => upload.notifyErrors(source)}
            onAttachExcel={() => chooseExcelFor(source)}
            onDetachExcel={() => canAttachExcel(source) && upload.detach(source)}
          />
        ))}
        <FarmRowsTable
          sources={sources}
          onRemoveRow={upload.removeRow}
          onEdit={(source) => setManualFarm({ open: true, editing: source })}
        />
        {reading && (
          <Box
            role="status"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              fontSize: 14,
              color: FLOW_COLORS.ink2,
            }}
          >
            <CircularProgress size={18} />
            {t("common:farmsUpload:reading")}
          </Box>
        )}
      </Box>
    );

  const listSubtitle =
    sources.length > 0
      ? uploadSummaryText(summary, t)
      : t("common:farmsUpload:empty");

  const hidden = (
    <>
      <input
        ref={excelInput}
        type="file"
        accept={EXCEL_EXTENSIONS}
        hidden
        onChange={onExcelChosen}
      />
      <GeoFileFieldsHelp
        open={fieldsHelpOpen}
        onClose={() => setFieldsHelpOpen(false)}
      />
      {manualFarm.open && (
        <ManualFarmModal
          open={manualFarm.open}
          country={country}
          initialRow={manualFarm.editing?.row ?? null}
          onCancel={() => setManualFarm({ open: false, editing: null })}
          onSave={(row) => {
            upload.saveManual(row, manualFarm.editing?.key);
            setManualFarm({ open: false, editing: null });
          }}
        />
      )}
    </>
  );

  if (variant === "page")
    return (
      <>
        <FlowSection
          title={t("common:farmsUpload:methodsTitle")}
          subtitle={t("common:farmsUpload:methodsSubtitle")}
          icon={<FileUploadOutlinedIcon />}
        >
          {picker}
        </FlowSection>
        <FlowSection
          title={t("common:farmsUpload:listTitle")}
          subtitle={listSubtitle}
          icon={<PentagonOutlinedIcon />}
          action={removeAll}
        >
          {list}
        </FlowSection>
        {(sources.length > 0 || reading || keepBar) && (
          <FlowBottomBar
            action={
              <Button
                variant="contained"
                onClick={submit}
                disabled={!canSubmit}
                endIcon={<ArrowForwardRoundedIcon />}
              >
                {submitLabel}
              </Button>
            }
          >
            <SummaryStat
              icon={<PentagonOutlinedIcon fontSize="small" />}
              count={summary.polygons}
              label={t("common:farmsUpload:summary:polygonsLabel", {
                count: summary.polygons,
              })}
            />
            <SummaryStat
              icon={<PlaceOutlinedIcon fontSize="small" />}
              count={summary.points}
              label={t("common:farmsUpload:summary:pointsLabel", {
                count: summary.points,
              })}
            />
            {sources.length === 0 && !reading && (
              <Box component="span" sx={{ fontSize: 14, color: FLOW_COLORS.ink2 }}>
                {t("common:farmsUpload:summary:emptyList")}
              </Box>
            )}
            {summary.sourcesWithProblems > 0 && (
              <Box component="span" sx={{ fontSize: 14, color: FLOW_COLORS.warn }}>
                {t("common:farmsUpload:summary:sourcesWithProblems", {
                  count: summary.sourcesWithProblems,
                })}
              </Box>
            )}
          </FlowBottomBar>
        )}
        {hidden}
      </>
    );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1 }}>
      {picker}
      <Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexWrap: "wrap",
            marginBottom: 1,
          }}
        >
          <Text variant="body1" bold>
            {t("common:farmsUpload:listTitle")}
          </Text>
          <Text variant="body2" color="secondary">
            {listSubtitle}
          </Text>
          {removeAll && <Box sx={{ marginLeft: "auto" }}>{removeAll}</Box>}
        </Box>
        {list}
      </Box>
      <Divider />
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {summary.farms > 0
            ? t("common:farmsUpload:submitCount", {
                label: submitLabel,
                count: summary.farms,
              })
            : submitLabel}
        </Button>
      </Box>
      {hidden}
    </Box>
  );
};
