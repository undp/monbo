"use client";

import React, { useContext, useRef, useState } from "react";
import {
  Box,
  Button,
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
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { Accept } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { DropZone } from "@/components/reusable/DropZone";
import { Text } from "@/components/reusable/Text";
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
import { ManualFarmModal } from "./ManualFarmModal";
import { UploadSourcesState } from "./useUploadSources";

const EXCEL_EXTENSIONS = Object.values(EXCEL_ACCEPT).flat().join(",");
// Geo files only: the Excel types taken out of the step's full list
const GEO_ACCEPT: Accept = Object.fromEntries(
  Object.entries(UPLOAD_FILE_ACCEPT).filter(([type]) => !(type in EXCEL_ACCEPT))
);

interface FarmsUploadStepProps {
  upload: UploadSourcesState;
  country: string | null;
  /** The step's button, e.g. "Validate polygons" */
  submitLabel: string;
  onSubmit: (rows: FarmRow[]) => void;
  disabled?: boolean;
}

/**
 * The upload step: one card per way to add farms (the Excel template, a geo file
 * with the data, a geo file with its Excel, drawing on the map), and the list of
 * what will be uploaded. Nothing is sent until the user presses the step's button.
 */
export const FarmsUploadStep: React.FC<FarmsUploadStepProps> = ({
  upload,
  country,
  submitLabel,
  onSubmit,
  disabled,
}) => {
  const { t, i18n } = useTranslation();
  const { openSnackbar } = useContext(SnackbarContext);
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
  const dropTexts = {
    activeDragzoneCallToAction: t("common:farmsUpload:dropzoneActive"),
    buttonText: t("common:farmsUpload:dropzoneButton"),
    text: t("common:farmsUpload:dropzoneText"),
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1 }}>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <OptionCard
          number={1}
          card="excel"
          steps={3}
          links={[
            { label: t("common:farmsUpload:cards:template"), href: getUploadFileTemplatePath(i18n.language) },
            { label: t("common:farmsUpload:cards:example"), href: examples.excel },
          ]}
        >
          <DropZone
            compact
            multiple
            disabled={disabled}
            onDrop={upload.addExcelFiles}
            accept={EXCEL_ACCEPT}
            invalidTypeMessage={t("common:farmsUpload:cards:excel:wrongType")}
            texts={{
              ...dropTexts,
              inactiveDragzoneCallToAction: t("common:farmsUpload:cards:excel:drop"),
              allowedExtensions: t("common:farmsUpload:cards:excel:extensions"),
            }}
          />
        </OptionCard>

        <OptionCard
          number={2}
          card="geoData"
          steps={2}
          links={[
            { label: t("common:farmsUpload:cards:exampleGeojson"), href: examples.geojson },
            { label: t("common:farmsUpload:cards:exampleShapefile"), href: examples.shapefile },
          ]}
          help={{
            label: t("common:farmsUpload:cards:geoData:fieldsHelp"),
            onClick: () => setFieldsHelpOpen(true),
          }}
        >
          <DropZone
            compact
            multiple
            disabled={disabled}
            onDrop={upload.addGeoFiles}
            accept={GEO_ACCEPT}
            invalidTypeMessage={t("common:farmsUpload:cards:geoData:wrongType")}
            texts={{
              ...dropTexts,
              inactiveDragzoneCallToAction: t("common:farmsUpload:cards:geoData:drop"),
              allowedExtensions: t("common:farmsUpload:cards:geoData:extensions"),
            }}
          />
        </OptionCard>

        <OptionCard
          number={3}
          card="geoExcel"
          steps={3}
          links={[
            { label: t("common:farmsUpload:cards:template"), href: getGeoUploadTemplatePath(i18n.language) },
            { label: t("common:farmsUpload:cards:exampleKml"), href: examples.kml },
            { label: t("common:farmsUpload:cards:exampleExcel"), href: examples.geoExcel },
          ]}
        >
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
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
        </OptionCard>

        <OptionCard number={4} card="manual" steps={3} links={[]}>
          <Button
            variant="outlined"
            startIcon={<AddLocationAltOutlinedIcon />}
            onClick={() => setManualFarm({ open: true, editing: null })}
            disabled={disabled}
          >
            {t("common:farmsUpload:addManually")}
          </Button>
        </OptionCard>
      </Box>

      <Box>
        <Box
          sx={{ display: "flex", alignItems: "baseline", gap: 1.5, flexWrap: "wrap" }}
        >
          <Text variant="body1" bold>
            {t("common:farmsUpload:listTitle")}
          </Text>
          {sources.length > 0 && (
            <Text variant="body2" color="secondary">
              {uploadSummaryText(summary, t)}
            </Text>
          )}
        </Box>
        {sources.length === 0 && !reading ? (
          <Text variant="body2" color="secondary" sx={{ marginTop: 1 }}>
            {t("common:farmsUpload:empty")}
          </Text>
        ) : (
          <List dense disablePadding>
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
        )}
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
    </Box>
  );
};

interface OptionCardProps {
  number: number;
  card: "excel" | "geoData" | "geoExcel" | "manual";
  /** How many steps its copy has */
  steps: number;
  links: { label: string; href: string }[];
  help?: { label: string; onClick: () => void };
  children: React.ReactNode;
}

/** One way to upload: when to use it, its steps, its downloads and its control. */
const OptionCard: React.FC<OptionCardProps> = ({
  number,
  card,
  steps,
  links,
  help,
  children,
}) => {
  const { t } = useTranslation();
  const key = `common:farmsUpload:cards:${card}`;
  return (
    <Box
      component="section"
      aria-labelledby={`upload-option-${number}`}
      sx={{
        border: "1px solid #e4e7ec",
        borderRadius: 2,
        padding: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        backgroundColor: "#fff",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1.5,
            backgroundColor: "primary.main",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {number}
        </Box>
        <Text variant="body1" bold id={`upload-option-${number}`}>
          {t(`${key}:title`)}
        </Text>
      </Box>
      <Text variant="body2" color="secondary">
        {t(`${key}:when`)}
      </Text>
      <Box component="ol" sx={{ margin: 0, paddingLeft: 2.5 }}>
        {Array.from({ length: steps }, (_, index) => (
          <Text component="li" variant="body2" key={index}>
            {t(`${key}:steps:${index + 1}`)}
          </Text>
        ))}
      </Box>
      <Box sx={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
        {(links.length > 0 || help) && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {help && (
              <Button
                size="small"
                startIcon={<HelpOutlineIcon />}
                onClick={help.onClick}
                sx={{ textTransform: "none" }}
              >
                {help.label}
              </Button>
            )}
            {links.map((link) => (
              <Button
                key={link.href}
                size="small"
                component="a"
                href={link.href}
                download
                startIcon={<FileDownloadOutlinedIcon />}
                sx={{ textTransform: "none" }}
              >
                {link.label}
              </Button>
            ))}
          </Box>
        )}
        {children}
      </Box>
    </Box>
  );
};

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
      <Box sx={{ display: "flex", alignItems: "center", minHeight: 96 }}>
        <Chip
          label={file.name}
          onDelete={() => onFile(null)}
          sx={{ maxWidth: "100%" }}
        />
      </Box>
    );
  return (
    <Box sx={{ display: "flex", minHeight: 96 }}>
      <DropZone
        compact
        disabled={disabled}
        onDrop={(files) => onFile(files[0] ?? null)}
        accept={accept}
        invalidTypeMessage={invalidTypeMessage}
        texts={{
          inactiveDragzoneCallToAction: title,
          activeDragzoneCallToAction: t("common:farmsUpload:dropzoneActive"),
          buttonText: t("common:farmsUpload:dropzoneButton"),
          text: "",
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
