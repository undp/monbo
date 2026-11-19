"use client";

import React, { useContext, useRef, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import DrawOutlinedIcon from "@mui/icons-material/DrawOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AddLocationAltOutlinedIcon from "@mui/icons-material/AddLocationAltOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import PentagonOutlinedIcon from "@mui/icons-material/PentagonOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { Accept } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { DropZone } from "@/components/reusable/DropZone";
import { Text } from "@/components/reusable/Text";
import { sum } from "lodash";
import { FlowSection } from "@/components/page/flow/FlowSection";
import {
  FLOW_COLORS,
  FOREST_IMAGE,
  HEADING_FONT,
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
  isMissingData,
  isUploadable,
  sourceErrors,
  sourceLabel,
  sourceProblem,
  sourceRows,
  uploadSummary,
  uploadSummaryText,
} from "@/utils/uploadSources";
import { GeoFileFieldsHelp } from "./GeoFileFieldsHelp";
import { ManualFarmModal } from "./manualFarm/ManualFarmModal";
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
   * the counts and the button (stage 1). "embedded": all of it inside the card
   * of a page that has its own bar (stage 2).
   */
  variant?: "page" | "embedded";
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
      <Box
        sx={{
          flexGrow: 1,
          minHeight: 160,
          borderRadius: "12px",
          border: `1.5px dashed #a9c4dc`,
          background: `linear-gradient(rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.55)), url(${FOREST_IMAGE}) center / cover`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          padding: "22px",
          textAlign: "center",
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            backgroundColor: FLOW_COLORS.blue50,
            color: FLOW_COLORS.blue,
          }}
        >
          <EditOutlinedIcon />
        </Box>
        <Box component="b" sx={{ color: FLOW_COLORS.ink, fontSize: 14 }}>
          {t("common:farmsUpload:drawTitle")}
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddLocationAltOutlinedIcon />}
          onClick={() => setManualFarm({ open: true, editing: null })}
          disabled={disabled}
        >
          {t("common:farmsUpload:openMap")}
        </Button>
      </Box>
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
        <Box>
          <Box
            component="h3"
            sx={{
              margin: 0,
              marginBottom: 1.5,
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: FLOW_COLORS.muted,
            }}
          >
            {t("common:farmsUpload:howTo")}
          </Box>
          {/* In order, but with bullets: digits here read like the flow's stages. */}
          <Box
            component="ol"
            sx={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 1.25,
            }}
          >
            {Array.from({ length: current.steps }, (_, index) => (
              <Box
                component="li"
                key={`${method}-${index}`}
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1.25,
                  fontSize: 14,
                  color: FLOW_COLORS.ink2,
                }}
              >
                <ChevronRightRoundedIcon
                  aria-hidden
                  sx={{ fontSize: 18, color: FLOW_COLORS.leafDark, marginTop: "1px" }}
                />
                {t(`${methodKey}:steps:${index + 1}`)}
              </Box>
            ))}
          </Box>
          {(links[method].length > 0 || method === "geoData") && (
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                columnGap: 2,
                rowGap: 1,
                marginTop: 1.75,
              }}
            >
              {links[method].map((link) => (
                <Box
                  component="a"
                  key={link.href}
                  href={link.href}
                  download
                  sx={HOW_TO_LINK}
                >
                  {link.template && (
                    <FileDownloadOutlinedIcon aria-hidden sx={{ fontSize: 16 }} />
                  )}
                  {link.label}
                </Box>
              ))}
              {method === "geoData" && (
                <Box
                  component="button"
                  type="button"
                  onClick={() => setFieldsHelpOpen(true)}
                  sx={HOW_TO_LINK}
                >
                  {t("common:farmsUpload:cards:geoData:fieldsHelp")}
                </Box>
              )}
            </Box>
          )}
        </Box>
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
      <List
        dense
        disablePadding
        sx={{
          border: `1px solid ${FLOW_COLORS.line}`,
          borderRadius: "12px",
          overflow: "hidden",
          "& > li:last-of-type": { borderBottom: "none" },
        }}
      >
        {sources.map((source) => (
          <SourceItem
            key={source.key}
            source={source}
            onRemove={() => upload.remove(source)}
            onShowErrors={() => upload.notifyErrors(source)}
            onAttachExcel={() => chooseExcelFor(source)}
            onDetachExcel={() => canAttachExcel(source) && upload.detach(source)}
            onEdit={() =>
              source.kind === "manual" &&
              setManualFarm({ open: true, editing: source })
            }
          />
        ))}
        {reading && (
          <ListItem>
            <ListItemIcon>
              <CircularProgress size={20} />
            </ListItemIcon>
            <ListItemText primary={t("common:farmsUpload:reading")} />
          </ListItem>
        )}
      </List>
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
        {(sources.length > 0 || reading) && (
          <Box
            sx={{
              position: "sticky",
              bottom: 0,
              zIndex: 2,
              marginX: { xs: -1.5, md: -3 },
              marginBottom: { xs: -1.5, md: -3 },
              paddingX: { xs: 2, md: 3 },
              minHeight: 72,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              columnGap: 2.25,
              rowGap: 1,
              paddingY: 1.5,
              backgroundColor: FLOW_COLORS.white,
              borderTop: `1px solid ${FLOW_COLORS.line}`,
              boxShadow: "0 -8px 24px rgba(11, 37, 69, 0.06)",
            }}
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
            {summary.sourcesWithProblems > 0 && (
              <Box component="span" sx={{ fontSize: 14, color: FLOW_COLORS.warn }}>
                {t("common:farmsUpload:summary:sourcesWithProblems", {
                  count: summary.sourcesWithProblems,
                })}
              </Box>
            )}
            <Button
              variant="contained"
              onClick={submit}
              disabled={!canSubmit}
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{ marginLeft: "auto" }}
            >
              {submitLabel}
            </Button>
          </Box>
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

interface HowToLink {
  label: string;
  href: string;
  /** A template to fill in, shown with a download icon */
  template?: boolean;
}

/** A link of the "how to" panel: blue text, also on its buttons. */
const HOW_TO_LINK = {
  display: "inline-flex",
  alignItems: "center",
  gap: 0.5,
  padding: 0,
  border: "none",
  background: "none",
  font: "inherit",
  fontSize: 14,
  fontWeight: 500,
  color: FLOW_COLORS.blue,
  textDecoration: "none",
  cursor: "pointer",
  "&:hover": { textDecoration: "underline" },
} as const;

interface MethodButtonProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  /** Farms already listed from this method */
  loaded: number;
  selected: boolean;
  onClick: () => void;
}

/** One way to upload: picking it shows its steps and its control below. */
const MethodButton: React.FC<MethodButtonProps> = ({
  icon,
  title,
  description,
  loaded,
  selected,
  onClick,
}) => {
  const { t } = useTranslation();
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        gap: 0.75,
        padding: "14px",
        textAlign: "left",
        borderRadius: "12px",
        border: `1.5px solid ${selected ? FLOW_COLORS.blue : FLOW_COLORS.line}`,
        backgroundColor: selected ? FLOW_COLORS.blue25 : FLOW_COLORS.white,
        boxShadow: selected ? "0 0 0 3px rgba(13, 100, 160, 0.08)" : "none",
        transition: "border-color .15s, background-color .15s",
        "&:hover": { borderColor: selected ? FLOW_COLORS.blue : "#b9d3e8" },
        "&.Mui-focusVisible": { outline: `2px solid ${FLOW_COLORS.blue}`, outlineOffset: 2 },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 34,
          height: 34,
          borderRadius: "9px",
          display: "grid",
          placeItems: "center",
          backgroundColor: FLOW_COLORS.blue50,
          color: FLOW_COLORS.blue,
        }}
      >
        {icon}
      </Box>
      <Box
        component="span"
        sx={{
          fontFamily: HEADING_FONT,
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1.2,
          color: FLOW_COLORS.ink,
        }}
      >
        {title}
      </Box>
      <Box
        component="span"
        sx={{ fontSize: 12.5, lineHeight: 1.35, color: FLOW_COLORS.muted }}
      >
        {description}
      </Box>
      {loaded > 0 && (
        <Box
          component="span"
          sx={{
            position: "absolute",
            top: 12,
            right: 12,
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 999,
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            color: FLOW_COLORS.ok,
            backgroundColor: FLOW_COLORS.okBackground,
          }}
        >
          {t("common:farmsUpload:loadedCount", { count: loaded })}
        </Box>
      )}
    </ButtonBase>
  );
};

const SummaryStat: React.FC<{
  icon: React.ReactNode;
  count: number;
  label: string;
}> = ({ icon, count, label }) => (
  <Box
    component="span"
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1,
      fontSize: 14,
      color: FLOW_COLORS.ink2,
      "& svg": { color: FLOW_COLORS.muted },
    }}
  >
    {icon}
    <Box component="b" sx={{ color: FLOW_COLORS.ink, fontSize: 16 }}>
      {count}
    </Box>
    {label}
  </Box>
);

interface PairDropZoneProps {
  file: File | null;
  onFile: (file: File | null) => void;
  accept: Accept;
  disabled?: boolean;
  title: string;
  extensions: string;
  invalidTypeMessage: string;
}

/** One of option 3's two files: a drop zone, or the chosen file. */
const PairDropZone: React.FC<PairDropZoneProps> = ({
  file,
  onFile,
  accept,
  disabled,
  title,
  extensions,
  invalidTypeMessage,
}) => {
  const { t } = useTranslation();
  if (file)
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          minHeight: 160,
          padding: 2,
          borderRadius: "12px",
          border: `1.5px solid ${FLOW_COLORS.line}`,
          backgroundColor: FLOW_COLORS.white,
        }}
      >
        <Box component="b" sx={{ fontSize: 14, color: FLOW_COLORS.ink2 }}>
          {title}
        </Box>
        <Chip
          label={file.name}
          onDelete={() => onFile(null)}
          sx={{ maxWidth: "100%" }}
        />
      </Box>
    );
  return (
    <Box sx={{ display: "flex" }}>
      <DropZone
        appearance="flow"
        compact
        disabled={disabled}
        onDrop={(files) => onFile(files[0] ?? null)}
        accept={accept}
        invalidTypeMessage={invalidTypeMessage}
        texts={{
          inactiveDragzoneCallToAction: title,
          activeDragzoneCallToAction: t("common:farmsUpload:dropzoneActive"),
          text: t("common:farmsUpload:browsePrefix"),
          buttonText: t("common:farmsUpload:browse"),
          allowedExtensions: extensions,
        }}
      />
    </Box>
  );
};

interface SourceItemProps {
  source: UploadSource;
  onRemove: () => void;
  onShowErrors: () => void;
  onAttachExcel: () => void;
  onDetachExcel: () => void;
  onEdit: () => void;
}

const SOURCE_ICONS = {
  excel: <DescriptionOutlinedIcon />,
  geo: <PublicOutlinedIcon />,
  manual: <DrawOutlinedIcon />,
};

const SourceItem: React.FC<SourceItemProps> = ({
  source,
  onRemove,
  onShowErrors,
  onAttachExcel,
  onDetachExcel,
  onEdit,
}) => {
  const { t } = useTranslation();
  const errors = sourceErrors(source);
  const problem = sourceProblem(source, t);
  const geoExcel = source.kind === "geo" ? source.excel : null;
  const missingData = isMissingData(source);

  const count = t("common:farmsUpload:farmCount", {
    count: sourceRows(source).length,
  });
  const secondary =
    problem ??
    (geoExcel
      ? `${count} · ${t("common:farmsUpload:joinedWith", {
          name: geoExcel.name,
          interpolation: { escapeValue: false },
        })}`
      : count);

  return (
    <ListItem divider sx={{ flexWrap: "wrap", columnGap: 1, rowGap: 0.5 }}>
      <ListItemIcon sx={{ minWidth: 40 }}>{SOURCE_ICONS[source.kind]}</ListItemIcon>
      <ListItemText
        sx={{ flex: "1 1 260px", margin: 0 }}
        primary={sourceLabel(source, t)}
        secondary={secondary}
        slotProps={{
          secondary: {
            color: problem
              ? missingData
                ? "warning.dark"
                : "error"
              : "text.secondary",
          },
        }}
      />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          marginLeft: "auto",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        {errors.length > 1 && (
          <Button size="small" onClick={onShowErrors}>
            {t("common:farmsUpload:showErrors")}
          </Button>
        )}
        {geoExcel && (
          <Button size="small" onClick={onDetachExcel}>
            {t("common:farmsUpload:removeExcel")}
          </Button>
        )}
        {missingData && (
          <Button size="small" variant="outlined" onClick={onAttachExcel}>
            {t("common:farmsUpload:attachExcel")}
          </Button>
        )}
        {source.kind === "manual" && (
          <Tooltip title={t("common:farmsUpload:edit")}>
            <IconButton aria-label={t("common:farmsUpload:edit")} onClick={onEdit}>
              <EditOutlinedIcon />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={t("common:farmsUpload:remove")}>
          <IconButton aria-label={t("common:farmsUpload:remove")} onClick={onRemove}>
            <DeleteOutlineIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </ListItem>
  );
};
