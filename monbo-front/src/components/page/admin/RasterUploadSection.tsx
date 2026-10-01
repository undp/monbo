"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
} from "@mui/material";
import UploadIcon from "@mui/icons-material/Upload";
import { useTranslation } from "react-i18next";
import { TFunction } from "i18next";
import {
  AdminApiError,
  getIngestionJob,
  setAdminLayerEnabled,
  uploadLayerRaster,
} from "@/api/adminLayers";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { DropZone } from "@/components/reusable/DropZone";
import { Text } from "@/components/reusable/Text";
import { AdminLayer, IngestionJob, JobIssue } from "@/interfaces/AdminLayer";

const POLL_INTERVAL_MS = 1500;

/** Translates an ingestion error/warning by its code; the API's English text is
 * the fallback for codes this UI doesn't know yet. */
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

interface Props {
  layer: AdminLayer;
  onLayerChanged: () => void;
}

export const RasterUploadSection: React.FC<Props> = ({ layer, onLayerChanged }) => {
  const { t } = useTranslation();
  const { withToken } = useContext(AdminSessionContext);
  const { openSnackbar } = useContext(SnackbarContext);
  const [file, setFile] = useState<File | null>(null);
  const [nodata, setNodata] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [job, setJob] = useState<IngestionJob | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  // The parent passes a new callback on every render; polling must not restart.
  const onLayerChangedRef = useRef(onLayerChanged);
  useEffect(() => {
    onLayerChangedRef.current = onLayerChanged;
  }, [onLayerChanged]);

  // Poll the job until it succeeds or fails.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const current = await withToken((token) => getIngestionJob(token, jobId));
        if (cancelled) return;
        setJob(current);
        if (current.status === "queued" || current.status === "running") {
          timer = setTimeout(tick, POLL_INTERVAL_MS);
        } else if (current.status === "succeeded") {
          onLayerChangedRef.current();
        }
      } catch (e) {
        if (cancelled) return;
        // A 4xx other than 401 (which signs out) won't change by retrying, e.g. a
        // job that no longer exists: stop and tell the admin.
        if (e instanceof AdminApiError && e.status >= 400 && e.status < 500) {
          setJobId(null);
          setUploadError(t("admin:raster:uploadErrors:statusUnavailable"));
          return;
        }
        // A network error or a 5xx: keep polling, a bit slower.
        timer = setTimeout(tick, POLL_INTERVAL_MS * 2);
      }
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, withToken, t]);

  const upload = async () => {
    if (!file) return;
    setUploadError(null);
    setJob(null);
    setProgress(0);
    try {
      const { jobId: newJobId } = await withToken((token) =>
        uploadLayerRaster(token, layer.id, file, {
          nodata: nodata.trim() ? Number(nodata) : null,
          onProgress: setProgress,
        })
      );
      setFile(null);
      setJobId(newJobId);
    } catch (e) {
      const status = e instanceof AdminApiError ? e.status : 0;
      setUploadError(
        t(
          status === 413
            ? "admin:raster:uploadErrors:tooLarge"
            : status === 409
              ? "admin:raster:uploadErrors:busy"
              : "admin:raster:uploadErrors:generic"
        )
      );
    } finally {
      setProgress(null);
    }
  };

  const publish = async () => {
    try {
      await withToken((token) => setAdminLayerEnabled(token, layer.id, true));
      onLayerChanged();
    } catch {
      openSnackbar({ message: t("admin:layers:toggleError"), type: "error" });
    }
  };

  const running = progress !== null || job?.status === "queued" || job?.status === "running";
  const nodataInvalid = nodata.trim() !== "" && !Number.isInteger(Number(nodata));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Text variant="body2">
        {layer.has_raster
          ? t("admin:raster:current", {
              filename: layer.raster_filename,
              version: layer.version,
            })
          : t("admin:raster:none")}
      </Text>
      <Text color="secondary" variant="body2">
        {t("admin:raster:requirements")}
      </Text>

      <Box sx={{ display: "flex", minHeight: 140 }}>
        <DropZone
          onDrop={(files) => setFile(files[0] ?? null)}
          accept={{ "image/tiff": [".tif", ".tiff"] }}
          disabled={running}
          hint={file ? file.name : t("admin:raster:dropHint")}
          texts={{
            activeDragzoneCallToAction: t("admin:raster:dropActive"),
            inactiveDragzoneCallToAction: t("admin:raster:dropInactive"),
            buttonText: t("admin:raster:dropButton"),
            text: t("admin:raster:dropText"),
          }}
        />
      </Box>

      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        <TextField
          label={t("admin:raster:nodata")}
          helperText={t("admin:raster:nodataHelp")}
          value={nodata}
          onChange={(e) => setNodata(e.target.value)}
          error={nodataInvalid}
          size="small"
          sx={{ width: 260 }}
          disabled={running}
        />
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={upload}
          disabled={!file || running || nodataInvalid}
          sx={{ marginTop: 0.5 }}
        >
          {t("admin:raster:upload")}
        </Button>
      </Box>

      {progress !== null && (
        <Box>
          <Text variant="body2">
            {t("admin:raster:uploading", { percent: Math.round(progress * 100) })}
          </Text>
          <LinearProgress variant="determinate" value={progress * 100} />
        </Box>
      )}
      {uploadError && <Alert severity="error">{uploadError}</Alert>}

      {job && (
        <>
          {(job.status === "queued" || job.status === "running") && (
            <Box>
              <Text variant="body2">{t(`admin:raster:status:${job.status}`)}</Text>
              <LinearProgress />
            </Box>
          )}
          {job.status === "succeeded" && (
            <Alert
              severity="success"
              action={
                !layer.enabled && (
                  <Button color="inherit" size="small" onClick={publish}>
                    {t("admin:raster:publish")}
                  </Button>
                )
              }
            >
              {t("admin:raster:status:succeeded", {
                filename: job.rasterFilename,
                version: job.version,
              })}
            </Alert>
          )}
          {job.status === "failed" && job.error && (
            <Alert severity="error">
              <strong>{t("admin:raster:status:failed")}</strong>{" "}
              {issueText(t, job.error)}
            </Alert>
          )}
          {job.warnings.map((warning) => (
            <Alert key={warning.code} severity="warning">
              {issueText(t, warning)}
            </Alert>
          ))}
          {job.report && <RasterReportTable job={job} />}
        </>
      )}
    </Box>
  );
};

const RasterReportTable: React.FC<{ job: IngestionJob }> = ({ job }) => {
  const { t } = useTranslation();
  const report = job.report!;
  const rows: [string, React.ReactNode][] = [
    [t("admin:raster:report:crs"), report.crs],
    [
      t("admin:raster:report:size"),
      t("admin:raster:report:sizeValue", {
        width: report.width,
        height: report.height,
      }),
    ],
    [
      t("admin:raster:report:resolution"),
      report.approxResolutionM != null
        ? t("admin:raster:report:resolutionValue", {
            meters: report.approxResolutionM,
          })
        : "—",
    ],
    [t("admin:raster:report:dtype"), report.dtype],
    [t("admin:raster:report:nodata"), report.nodata ?? t("admin:raster:report:none")],
    [
      t("admin:raster:report:values"),
      report.values.length ? report.values.join(", ") : t("admin:raster:report:none"),
    ],
  ];
  return (
    <Box>
      <Text variant="body2" bold sx={{ marginBottom: 1 }}>
        {t("admin:raster:report:title")}
      </Text>
      <Table size="small" sx={{ maxWidth: 640 }}>
        <TableBody>
          {rows.map(([label, value]) => (
            <TableRow key={label}>
              <TableCell sx={{ color: "text.secondary", width: 220 }}>{label}</TableCell>
              <TableCell>{value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};
