"use client";

import React, {
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  LinearProgress,
  TextField,
  alpha,
  darken,
  useTheme,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { useTranslation } from "react-i18next";
import { TFunction } from "i18next";
import {
  AdminApiError,
  cancelIngestionJob,
  getIngestionJob,
  isAbortError,
  setAdminLayerEnabled,
  uploadLayerRaster,
} from "@/api/adminLayers";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { Text } from "@/components/reusable/Text";
import { AdminLayer, JobIssue } from "@/interfaces/AdminLayer";
import { formatNumber } from "@/utils/numbers";
import {
  dropKept,
  keepForLanguageChange,
  takeOverOnLanguageChange,
} from "@/utils/languageChange";
import { RasterDropZone } from "./RasterDropZone";
import { RasterStep, RasterSteps } from "./RasterSteps";
import { rasterButtonSx } from "./rasterStyles";

const POLL_INTERVAL_MS = 1500;
const PHASES = ["uploading", "validating", "converting"] as const;
type Phase = (typeof PHASES)[number];

/** Translates an ingestion error by its code; the API's English text is the
 * fallback for codes this UI doesn't know yet. */
const issueText = (t: TFunction, issue: JobIssue) =>
  t(`admin:raster:issues:${issue.code}`, {
    ...Object.fromEntries(
      Object.entries(issue.params).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(", ") : value,
      ])
    ),
    defaultValue: issue.message,
  });

const uploadErrorText = (t: TFunction, error: unknown) => {
  const status = error instanceof AdminApiError ? error.status : 0;
  return t(
    status === 413
      ? "admin:raster:uploadErrors:tooLarge"
      : status === 409
        ? "admin:raster:uploadErrors:busy"
        : "admin:raster:uploadErrors:generic"
  );
};

// --- State (design D3) -------------------------------------------------------------

type Flow =
  | { kind: "none" }
  | { kind: "chosen"; file: File; nodata: string; error?: string }
  | {
      kind: "processing";
      file: File;
      nodata: string;
      phase: Phase;
      // 0 to 1 while uploading and validating; null while converting
      progress: number | null;
      jobId?: string;
    }
  | { kind: "readyToPublish"; filename: string }
  | { kind: "done"; filename: string; published: boolean };

interface State {
  // Three steps (the last one publishes) when the layer wasn't published as the
  // flow started. Fixed until "Replace raster" (design D1).
  withPublishStep: boolean;
  flow: Flow;
}

type Action =
  | { type: "choose"; file: File }
  | { type: "setNodata"; nodata: string }
  | { type: "reset"; layer: AdminLayer }
  | { type: "start" }
  | { type: "uploadProgress"; progress: number }
  | { type: "uploaded"; jobId: string }
  | { type: "jobProgress"; phase: Phase; progress: number | null }
  | { type: "fail"; error: string }
  | { type: "succeeded" }
  | { type: "published" };

// Design D2: a layer with a raster that isn't published only needs publishing.
const initialState = (layer: AdminLayer): State => ({
  withPublishStep: !layer.enabled,
  flow:
    layer.has_raster && !layer.enabled && layer.raster_filename
      ? { kind: "readyToPublish", filename: layer.raster_filename }
      : { kind: "none" },
});

const reducer = (state: State, action: Action): State => {
  const { flow } = state;
  const next = (f: Flow): State => ({ ...state, flow: f });
  switch (action.type) {
    case "choose":
      return next({ kind: "chosen", file: action.file, nodata: "" });
    case "setNodata":
      return flow.kind === "chosen" ? next({ ...flow, nodata: action.nodata }) : state;
    case "reset":
      return { withPublishStep: !action.layer.enabled, flow: { kind: "none" } };
    case "start":
      return flow.kind === "chosen"
        ? next({ ...flow, kind: "processing", phase: "uploading", progress: 0 })
        : state;
    case "uploadProgress":
      return flow.kind === "processing" && !flow.jobId
        ? next({ ...flow, progress: action.progress })
        : state;
    case "uploaded":
      return flow.kind === "processing" && !flow.jobId
        ? next({ ...flow, jobId: action.jobId, phase: "validating", progress: 0 })
        : state;
    case "jobProgress":
      return flow.kind === "processing"
        ? next({ ...flow, phase: action.phase, progress: action.progress })
        : state;
    case "fail":
      return flow.kind === "processing"
        ? next({
            kind: "chosen",
            file: flow.file,
            nodata: flow.nodata,
            error: action.error,
          })
        : state;
    case "succeeded":
      if (flow.kind !== "processing") return state;
      return next(
        state.withPublishStep
          ? { kind: "readyToPublish", filename: flow.file.name }
          : { kind: "done", filename: flow.file.name, published: false }
      );
    case "published":
      return flow.kind === "readyToPublish"
        ? next({ kind: "done", filename: flow.filename, published: true })
        : state;
  }
};

const stepsFor = (t: TFunction, { flow, withPublishStep }: State): RasterStep[] => {
  const filename =
    flow.kind === "chosen" || flow.kind === "processing"
      ? flow.file.name
      : flow.kind === "none"
        ? null
        : flow.filename;
  const select: RasterStep = {
    title: t("admin:raster:steps:select:title"),
    subtitle: filename ?? t("admin:raster:steps:select:hint"),
    status: flow.kind === "none" || flow.kind === "chosen" ? "active" : "done",
  };
  const upload: RasterStep = {
    title: t("admin:raster:steps:upload:title"),
    ...(flow.kind === "processing"
      ? { subtitle: t("admin:raster:steps:upload:running"), status: "active" }
      : flow.kind === "readyToPublish" || flow.kind === "done"
        ? { subtitle: t("admin:raster:steps:upload:done"), status: "done" }
        : { subtitle: t("admin:raster:steps:upload:hint"), status: "pending" }),
  };
  if (!withPublishStep) return [select, upload];
  const publish: RasterStep = {
    title: t("admin:raster:steps:publish:title"),
    ...(flow.kind === "readyToPublish"
      ? { subtitle: t("admin:raster:steps:publish:pending"), status: "active" }
      : flow.kind === "done"
        ? { subtitle: t("admin:raster:steps:publish:done"), status: "done" }
        : { subtitle: t("admin:raster:steps:publish:hint"), status: "pending" }),
  };
  return [select, upload, publish];
};

// --- Section -----------------------------------------------------------------------

// An upload whose body is still being sent. After a language change, the remounted
// section takes it over (languageChange.ts) and follows it to the job.
interface Upload {
  request: Promise<{ jobId: string }>;
  controller: AbortController;
  // Reassigned by the section that follows the upload
  onProgress: (progress: number) => void;
}

interface HandedOver {
  state: State;
  upload: Upload | null;
}

interface Props {
  layer: AdminLayer;
  onLayerChanged: () => void;
}

export const RasterUploadSection: React.FC<Props> = ({ layer, onLayerChanged }) => {
  const { t, i18n } = useTranslation();
  const { withToken } = useContext(AdminSessionContext);
  const { openSnackbar } = useContext(SnackbarContext);
  // Changing the language remounts the page: keep the flow, including an upload
  // or a job in progress, instead of starting over.
  const handOverKey = `admin-layer-raster:${layer.id}`;
  const [handedOver] = useState(() => takeOverOnLanguageChange<HandedOver>(handOverKey));
  const [state, dispatch] = useReducer(
    reducer,
    layer,
    (l) => handedOver?.state ?? initialState(l)
  );
  const [publishing, setPublishing] = useState(false);
  const [activeUpload, setActiveUpload] = useState<Upload | null>(
    () => handedOver?.upload ?? null
  );
  useEffect(() => {
    keepForLanguageChange(handOverKey, {
      state,
      upload: activeUpload,
    } satisfies HandedOver);
  }, [handOverKey, state, activeUpload]);
  useEffect(() => () => dropKept(handOverKey), [handOverKey]);
  // The parent passes a new callback on every render; polling must not restart.
  const onLayerChangedRef = useRef(onLayerChanged);
  useEffect(() => {
    onLayerChangedRef.current = onLayerChanged;
  }, [onLayerChanged]);

  const { flow } = state;
  const jobId = flow.kind === "processing" ? flow.jobId : undefined;

  // Follow the job until it ends.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const job = await withToken((token) => getIngestionJob(token, jobId));
        if (cancelled) return;
        if (job.status === "queued" || job.status === "running") {
          dispatch({
            type: "jobProgress",
            phase: job.phase ?? "validating",
            progress: job.phase === "converting" ? null : (job.progress ?? 0),
          });
          timer = setTimeout(tick, POLL_INTERVAL_MS);
        } else if (job.status === "succeeded") {
          dispatch({ type: "succeeded" });
          onLayerChangedRef.current();
        } else if (job.status === "failed") {
          dispatch({
            type: "fail",
            error: job.error ? issueText(t, job.error) : t("admin:raster:failed"),
          });
        }
        // "cancelled": the section already went back to "no file".
      } catch {
        // A transient network error: keep polling, a bit slower.
        if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS * 2);
      }
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, withToken, t]);

  // Show the upload's progress, then follow its job.
  const followUpload = useCallback(
    async (current: Upload) => {
      current.onProgress = (progress) => dispatch({ type: "uploadProgress", progress });
      try {
        const { jobId: newJobId } = await current.request;
        if (current.controller.signal.aborted) {
          // Cancelled just as the server accepted it: stop the job it started.
          await withToken((token) => cancelIngestionJob(token, newJobId)).catch(() => {});
          return;
        }
        dispatch({ type: "uploaded", jobId: newJobId });
      } catch (e) {
        if (!isAbortError(e)) dispatch({ type: "fail", error: uploadErrorText(t, e) });
      } finally {
        setActiveUpload((active) => (active === current ? null : active));
      }
    },
    [t, withToken]
  );

  // An upload handed over by the section before the language change.
  useEffect(() => {
    if (handedOver?.upload) followUpload(handedOver.upload);
  }, [handedOver, followUpload]);

  const upload = () => {
    if (flow.kind !== "chosen") return;
    const { file, nodata } = flow;
    const controller = new AbortController();
    const current: Upload = {
      controller,
      onProgress: () => {},
      request: withToken((token) =>
        uploadLayerRaster(token, layer.id, file, {
          nodata: nodata.trim() ? Number(nodata) : null,
          onProgress: (progress) => current.onProgress(progress),
          signal: controller.signal,
        })
      ),
    };
    dispatch({ type: "start" });
    setActiveUpload(current);
    followUpload(current);
  };

  const cancel = async () => {
    if (flow.kind !== "processing") return;
    if (!flow.jobId) {
      activeUpload?.controller.abort();
      dispatch({ type: "reset", layer });
      return;
    }
    const currentJob = flow.jobId;
    try {
      const outcome = await withToken((token) => cancelIngestionJob(token, currentJob));
      // "tooLate": the raster is being activated; polling shows the outcome.
      if (outcome === "cancelled") dispatch({ type: "reset", layer });
    } catch {
      openSnackbar({ message: t("admin:raster:uploadErrors:generic"), type: "error" });
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      await withToken((token) => setAdminLayerEnabled(token, layer.id, true));
      dispatch({ type: "published" });
      onLayerChanged();
    } catch {
      openSnackbar({ message: t("admin:raster:publishError"), type: "error" });
    } finally {
      setPublishing(false);
    }
  };

  const replace = () => dispatch({ type: "reset", layer });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Text color="secondary" sx={{ fontSize: 15, maxWidth: 760, marginTop: -1 }}>
        {t("admin:raster:intro")}
      </Text>
      <RasterSteps steps={stepsFor(t, state)} />

      {flow.kind === "none" && (
        <RasterDropZone onFile={(file) => dispatch({ type: "choose", file })} />
      )}

      {flow.kind === "chosen" && (
        <>
          {flow.error && (
            <Alert severity="error">
              <strong>{t("admin:raster:failed")}</strong> {flow.error}
            </Alert>
          )}
          <FileCard
            file={flow.file}
            status={t("admin:raster:file:ready", {
              size: fileSize(flow.file, i18n.language),
            })}
            aside={
              <Button
                onClick={() => dispatch({ type: "reset", layer })}
                sx={{ ...rasterButtonSx, padding: "6px 12px" }}
              >
                {t("admin:raster:file:change")}
              </Button>
            }
          />
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <NodataField
              value={flow.nodata}
              onChange={(nodata) => dispatch({ type: "setNodata", nodata })}
            />
            <Button
              variant="contained"
              onClick={upload}
              disabled={nodataInvalid(flow.nodata)}
              sx={rasterButtonSx}
            >
              {t("admin:raster:uploadAndValidate")}
            </Button>
          </Box>
        </>
      )}

      {flow.kind === "processing" && (
        <>
          <FileCard
            file={flow.file}
            status={t(`admin:raster:phaseStatus:${flow.phase}`)}
            aside={
              flow.progress !== null && (
                <Box sx={{ fontSize: 20, fontWeight: 700, color: "primary.main" }}>
                  {Math.round(flow.progress * 100)}%
                </Box>
              )
            }
          >
            <LinearProgress
              variant={flow.progress === null ? "indeterminate" : "determinate"}
              value={(flow.progress ?? 0) * 100}
              sx={(theme) => ({
                height: 8,
                borderRadius: 4,
                marginTop: 2,
                backgroundColor: alpha(theme.palette.primary.main, 0.12),
              })}
            />
            <PhaseChecklist current={flow.phase} />
          </FileCard>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Text color="secondary" variant="body2">
              {t("admin:raster:slow")}
            </Text>
            <Button variant="outlined" onClick={cancel} sx={rasterButtonSx}>
              {t("admin:raster:cancel")}
            </Button>
          </Box>
        </>
      )}

      {flow.kind === "readyToPublish" && (
        <>
          <ValidatedNotice filename={flow.filename} />
          <Notice>{t("admin:raster:publishNotice")}</Notice>
          <Divider />
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
            <Button variant="outlined" onClick={replace} sx={rasterButtonSx}>
              {t("admin:raster:replace")}
            </Button>
            <Button
              variant="contained"
              startIcon={<VisibilityOutlinedIcon />}
              onClick={publish}
              disabled={publishing}
              sx={rasterButtonSx}
            >
              {publishing ? t("admin:raster:publishing") : t("admin:raster:publish")}
            </Button>
          </Box>
        </>
      )}

      {flow.kind === "done" && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: "primary.main",
              color: "common.white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckIcon />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Text bold sx={{ fontSize: 16 }}>
              {flow.published
                ? t("admin:raster:done:published")
                : t("admin:raster:done:updated")}
            </Text>
            <Text color="secondary" variant="body2">
              {t("admin:raster:done:text", { filename: flow.filename })}
            </Text>
          </Box>
          <Button variant="outlined" onClick={replace} sx={rasterButtonSx}>
            {t("admin:raster:replace")}
          </Button>
        </Box>
      )}
    </Box>
  );
};

// --- Pieces ------------------------------------------------------------------------

const nodataInvalid = (nodata: string) =>
  nodata.trim() !== "" && !Number.isInteger(Number(nodata));

const fileSize = (file: File, language: string) => {
  const megabytes = file.size / (1024 * 1024);
  return megabytes >= 1
    ? `${formatNumber(megabytes, 1, language)} MB`
    : `${formatNumber(file.size / 1024, 0, language)} KB`;
};

const NodataField: React.FC<{ value: string; onChange: (value: string) => void }> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation();
  return (
    <TextField
      label={t("admin:raster:nodata")}
      placeholder={t("admin:raster:nodataPlaceholder")}
      helperText={t("admin:raster:nodataHelp")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={nodataInvalid(value)}
      size="small"
      sx={{ width: 260 }}
      slotProps={{ inputLabel: { shrink: true } }}
    />
  );
};

const FileCard: React.FC<{
  file: File;
  status: string;
  aside?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ file, status, aside, children }) => (
  <Box
    sx={{
      border: 1,
      borderColor: "divider",
      borderRadius: "12px",
      padding: "18px 20px",
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      <Box
        sx={(theme) => ({
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: "8px",
          backgroundColor: alpha(theme.palette.primary.main, 0.1),
          color: "primary.main",
          fontSize: 11,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        })}
      >
        TIF
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Text
          sx={{
            fontSize: 16,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {file.name}
        </Text>
        <Text color="secondary" sx={{ fontSize: 13 }}>
          {status}
        </Text>
      </Box>
      {aside}
    </Box>
    {children}
  </Box>
);

const PhaseChecklist: React.FC<{ current: Phase }> = ({ current }) => {
  const { t } = useTranslation();
  const currentIndex = PHASES.indexOf(current);
  return (
    <Box
      component="ul"
      sx={{
        listStyle: "none",
        margin: "16px 0 0",
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      {PHASES.map((phase, index) => {
        const status =
          index < currentIndex ? "done" : index === currentIndex ? "active" : "pending";
        return (
          <Box
            component="li"
            key={phase}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              fontSize: 14,
              color: status === "pending" ? "text.disabled" : "text.primary",
            }}
          >
            {status === "done" ? (
              <CheckCircleIcon sx={{ fontSize: 20, color: "primary.main" }} />
            ) : (
              <RadioButtonUncheckedIcon
                sx={{
                  fontSize: 20,
                  color: status === "active" ? "primary.main" : "text.disabled",
                }}
              />
            )}
            {t(`admin:raster:phases:${phase}`)}
          </Box>
        );
      })}
    </Box>
  );
};

const ValidatedNotice: React.FC<{ filename: string }> = ({ filename }) => {
  const { t } = useTranslation();
  const primary = useTheme().palette.primary.main;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.5,
        padding: "16px 20px",
        borderRadius: "12px",
        backgroundColor: alpha(primary, 0.1),
      }}
    >
      <CheckCircleIcon sx={{ color: "primary.main", marginTop: "1px" }} />
      <Box>
        <Text bold sx={{ color: "primary.main", fontSize: 15 }}>
          {t("admin:raster:validated:title")}
        </Text>
        <Text sx={{ fontSize: 14 }}>
          {t("admin:raster:validated:text", { filename })}
        </Text>
      </Box>
    </Box>
  );
};

/** The design's amber notice (the theme's warning tones). */
const Notice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={(theme) => ({
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      padding: "12px 16px",
      borderRadius: "10px",
      fontSize: 14,
      backgroundColor: alpha(theme.palette.warning.main, 0.12),
      color: darken(theme.palette.warning.main, 0.5),
      "&::before": {
        content: '""',
        flexShrink: 0,
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: theme.palette.warning.main,
      },
    })}
  >
    {children}
  </Box>
);
