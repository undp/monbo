"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import ForestOutlinedIcon from "@mui/icons-material/ForestOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { useTranslation } from "react-i18next";
import { AdminApiError } from "@/api/adminLayers";
import { getAdminUsage, UsageBlock, UsageReport } from "@/api/adminUsage";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { FLOW_COLORS, HEADING_FONT, STAGE_CARD } from "@/components/page/flow/flowStyles";
import { Text } from "@/components/reusable/Text";
import { getCountryName } from "@/utils/countries";
import { AdminPageContainer } from "./AdminPageContainer";
import {
  CountryShareDonut,
  UsageFunnelChart,
  UsageOutcomesChart,
  UsageSparkline,
  UsageWeeklyChart,
} from "./UsageCharts";
import {
  COUNTRY_METRICS,
  countryShares,
  downloaded,
  TrendMetric,
  weeklySeries,
} from "./usageChartData";

type Preset = "last30" | "last90" | "thisYear" | "custom";
const PRESETS: Preset[] = ["last30", "last90", "thisYear", "custom"];
// The API refuses longer ranges.
const MAX_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

// Dates are UTC days (YYYY-MM-DD), like the API's.
const todayUtc = () => new Date().toISOString().slice(0, 10);
const daysBefore = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);
const rangeDays = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;

const presetRange = (preset: Exclude<Preset, "custom">, today: string) => {
  if (preset === "thisYear") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: daysBefore(today, preset === "last30" ? 29 : 89), to: today };
};

type Load =
  | { state: "loading" }
  | { state: "loaded"; report: UsageReport }
  | { state: "notConfigured" }
  | { state: "error" };
// What came back for a range ("from/to"); any other range is still loading.
type LoadedRange = Exclude<Load, { state: "loading" }> & { range: string };

export const AdminUsagePageContent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = i18n.language === "en" ? "en" : "es";
  const { session, withToken } = useContext(AdminSessionContext);
  const [preset, setPreset] = useState<Preset>("last30");
  const [custom, setCustom] = useState(() => presetRange("last30", todayUtc()));
  const [loaded, setLoaded] = useState<LoadedRange | null>(null);

  const range = preset === "custom" ? custom : presetRange(preset, todayUtc());
  const validRange =
    /^\d{4}-\d{2}-\d{2}$/.test(range.from) &&
    /^\d{4}-\d{2}-\d{2}$/.test(range.to) &&
    range.from <= range.to &&
    rangeDays(range.from, range.to) <= MAX_RANGE_DAYS;
  const rangeKey = `${range.from}/${range.to}`;
  const load: Load =
    loaded && loaded.range === rangeKey ? loaded : { state: "loading" };

  useEffect(() => {
    if (!session || !validRange) return;
    const [from, to] = rangeKey.split("/");
    let current = true;
    withToken((token) => getAdminUsage(token, from, to))
      .then((report) => {
        if (current) setLoaded({ state: "loaded", report, range: rangeKey });
      })
      .catch((error) => {
        if (!current) return;
        const notConfigured = error instanceof AdminApiError && error.status === 503;
        setLoaded({ state: notConfigured ? "notConfigured" : "error", range: rangeKey });
      });
    return () => {
      current = false;
    };
  }, [session, withToken, rangeKey, validRange]);

  const format = useMemo(() => {
    const integer = new Intl.NumberFormat(i18n.language);
    const decimal = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
    const percent = new Intl.NumberFormat(i18n.language, {
      style: "percent",
      maximumFractionDigits: 0,
    });
    return {
      count: (value: number) => integer.format(value),
      average: (value: number | null) => (value === null ? "—" : decimal.format(value)),
      percent: (value: number) => percent.format(value / 100),
    };
  }, [i18n.language]);

  const okErrors = (ok: number, errors: number) =>
    t("admin:usage:countries:okErrors", {
      count: errors,
      ok: format.count(ok),
      errors: format.count(errors),
    });

  const countryName = (code: string) =>
    code === "unknown"
      ? t("admin:usage:countries:unknown")
      : (getCountryName(code, language) ?? code);

  return (
    <AdminPageContainer
      title={t("admin:usage:title")}
      subtitle={t("admin:usage:subtitle")}
      countryInTitle={false}
    >
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={preset}
          sx={RANGE_TOGGLE}
          aria-label={t("admin:usage:range:label")}
          onChange={(_, value: Preset | null) => {
            if (!value) return;
            // A custom range starts from the range on screen.
            if (value === "custom" && preset !== "custom") setCustom(range);
            setPreset(value);
          }}
        >
          {PRESETS.map((value) => (
            <ToggleButton key={value} value={value}>
              {t(`admin:usage:range:${value}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {preset === "custom" && (
          <>
            <TextField
              type="date"
              size="small"
              label={t("admin:usage:range:from")}
              value={custom.from}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              type="date"
              size="small"
              label={t("admin:usage:range:to")}
              value={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </>
        )}
      </Box>

      {!validRange && <Alert severity="warning">{t("admin:usage:range:invalid")}</Alert>}
      {validRange && load.state === "notConfigured" && (
        <Alert severity="info">{t("admin:usage:notConfigured")}</Alert>
      )}
      {validRange && load.state === "error" && (
        <Alert severity="error">{t("admin:usage:loadError")}</Alert>
      )}
      {validRange && load.state === "loading" && (
        <Box sx={{ display: "flex", justifyContent: "center", padding: 6 }}>
          <CircularProgress />
        </Box>
      )}
      {validRange && load.state === "loaded" && (
        <UsageReportView
          report={load.report}
          format={format}
          okErrors={okErrors}
          countryName={countryName}
        />
      )}
    </AdminPageContainer>
  );
};

/** The range presets as the stage pages' segmented control. */
const RANGE_TOGGLE = {
  backgroundColor: FLOW_COLORS.white,
  borderRadius: "10px",
  "& .MuiToggleButton-root": {
    paddingX: 1.75,
    textTransform: "none",
    fontWeight: 600,
    color: FLOW_COLORS.ink2,
    borderColor: FLOW_COLORS.line,
  },
  "& .MuiToggleButton-root:first-of-type": { borderRadius: "10px 0 0 10px" },
  "& .MuiToggleButton-root:last-of-type": { borderRadius: "0 10px 10px 0" },
  "& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover": {
    color: FLOW_COLORS.blue,
    backgroundColor: FLOW_COLORS.blue50,
  },
} as const;

interface ViewProps {
  report: UsageReport;
  format: {
    count: (value: number) => string;
    average: (value: number | null) => string;
    percent: (value: number) => string;
  };
  okErrors: (ok: number, errors: number) => string;
  countryName: (code: string) => string;
}

/** A white card holding one chart or table, with its title (the stage pages' card). */
const Card: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <Box component="section" aria-label={title} sx={{ ...STAGE_CARD, padding: { xs: 2, md: "20px 24px" } }}>
    <Box
      component="h2"
      sx={{
        margin: 0,
        fontFamily: HEADING_FONT,
        fontSize: 18,
        fontWeight: 700,
        lineHeight: 1.25,
        letterSpacing: "-0.015em",
        color: FLOW_COLORS.ink,
      }}
    >
      {title}
    </Box>
    {subtitle && (
      <Box component="p" sx={{ margin: 0, marginTop: 0.5, fontSize: 13.5, color: FLOW_COLORS.muted }}>
        {subtitle}
      </Box>
    )}
    <Box sx={{ marginTop: 2 }}>{children}</Box>
  </Box>
);

const Tile: React.FC<{
  label: string;
  value: string;
  detail?: string;
  source?: string;
  icon: React.ReactNode;
  trend: number[];
  trendLabel: string;
}> = ({ label, value, detail, source, icon, trend, trendLabel }) => (
  <Box
    role="group"
    aria-label={label}
    sx={{ ...STAGE_CARD, padding: 2.25, display: "flex", flexDirection: "column" }}
  >
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box
        aria-hidden
        sx={{
          display: "flex",
          padding: 1,
          borderRadius: "50%",
          color: FLOW_COLORS.blue,
          backgroundColor: FLOW_COLORS.blue50,
        }}
      >
        {icon}
      </Box>
      <Text color="secondary" variant="body2" bold>
        {label}
      </Text>
    </Box>
    <Box
      sx={{
        fontFamily: HEADING_FONT,
        fontSize: 38,
        fontWeight: 800,
        lineHeight: 1.2,
        marginTop: 1.5,
        color: FLOW_COLORS.ink,
      }}
    >
      {value}
    </Box>
    {detail && <Text variant="body2">{detail}</Text>}
    {/* At least two weeks, or there is no trend to draw */}
    {trend.length > 1 && (
      <Box sx={{ marginTop: 1, marginX: -1 }}>
        <UsageSparkline data={trend} label={trendLabel} />
      </Box>
    )}
    {source && (
      <Text color="secondary" variant="caption" sx={{ marginTop: "auto", paddingTop: 1 }}>
        {source}
      </Text>
    )}
  </Box>
);

const errorTotal = (block: { errors: UsageBlock["upload"]["errors"] }) =>
  block.errors.invalid_input + block.errors.server_error;

const UsageReportView: React.FC<ViewProps> = ({ report, format, okErrors, countryName }) => {
  const { t } = useTranslation();
  const { totals, weekly } = report;
  const server = t("admin:usage:sources:server");
  const browser = t("admin:usage:sources:browser");
  const trend = (metric: TrendMetric, label: string) => ({
    trend: weeklySeries(weekly, metric),
    trendLabel: t("admin:usage:tiles:trend", { label }),
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 2,
        }}
      >
        <Tile
          label={t("admin:usage:tiles:sessions")}
          value={format.count(totals.sessions)}
          detail={t("admin:usage:tiles:sessionsDetail")}
          icon={<GroupsOutlinedIcon />}
          {...trend("sessions", t("admin:usage:tiles:sessions"))}
        />
        <Tile
          label={t("admin:usage:tiles:uploads")}
          value={format.count(totals.upload.ok)}
          detail={t("admin:usage:tiles:avgFarms", {
            count: totals.upload.avgFarmsPerUpload ?? 0,
            value: format.average(totals.upload.avgFarmsPerUpload),
          })}
          source={server}
          icon={<UploadFileOutlinedIcon />}
          {...trend("uploads", t("admin:usage:tiles:uploads"))}
        />
        <Tile
          label={t("admin:usage:tiles:analyses")}
          value={format.count(totals.analysis.ok)}
          detail={t("admin:usage:tiles:analysisSessions", {
            count: totals.analysis.sessions,
            value: format.count(totals.analysis.sessions),
          })}
          source={server}
          icon={<ForestOutlinedIcon />}
          {...trend("analyses", t("admin:usage:tiles:analyses"))}
        />
        <Tile
          label={t("admin:usage:tiles:reportsRequested")}
          value={format.count(totals.reports.requested)}
          detail={t("admin:usage:tiles:requestedSessions", {
            count: totals.reports.requestedSessions,
            value: format.count(totals.reports.requestedSessions),
          })}
          source={browser}
          icon={<DescriptionOutlinedIcon />}
          {...trend("reportsRequested", t("admin:usage:tiles:reportsRequested"))}
        />
        <Tile
          label={t("admin:usage:tiles:reportsDownloaded")}
          value={format.count(downloaded(totals))}
          detail={t("admin:usage:tiles:downloadedFormats", {
            pdf: format.count(totals.reports.downloaded.pdf),
            zip: format.count(totals.reports.downloaded.zip),
          })}
          source={browser}
          icon={<FileDownloadOutlinedIcon />}
          {...trend("reportsDownloaded", t("admin:usage:tiles:reportsDownloaded"))}
        />
      </Box>

      <Card title={t("admin:usage:shares:title")} subtitle={t("admin:usage:shares:subtitle")}>
        <CountryShares report={report} format={format} countryName={countryName} />
      </Card>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          gap: 3,
        }}
      >
        <Card title={t("admin:usage:funnel:title")} subtitle={t("admin:usage:funnel:subtitle")}>
          <UsageFunnelChart totals={totals} />
        </Card>
        <Card
          title={t("admin:usage:outcomes:title")}
          subtitle={t("admin:usage:outcomes:subtitle")}
        >
          <UsageOutcomesChart totals={totals} />
        </Card>
      </Box>

      <Card title={t("admin:usage:weekly:title")}>
        <UsageWeeklyChart weekly={weekly} />
      </Card>

      <Card title={t("admin:usage:countries:title")} subtitle={t("admin:usage:countries:sources")}>
        <TableContainer>
          <Table size="small" aria-label={t("admin:usage:countries:title")}>
            <TableHead>
              <TableRow>
                <TableCell>{t("admin:usage:countries:country")}</TableCell>
                <TableCell align="right">{t("admin:usage:countries:uploads")}</TableCell>
                <TableCell align="right">{t("admin:usage:countries:avgFarms")}</TableCell>
                <TableCell align="right">
                  {t("admin:usage:countries:validations")}
                </TableCell>
                <TableCell align="right">{t("admin:usage:countries:analyses")}</TableCell>
                <TableCell align="right">
                  {t("admin:usage:countries:reportsRequested")}
                </TableCell>
                <TableCell align="right">
                  {t("admin:usage:countries:reportsDownloaded")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {report.byCountry.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>{t("admin:usage:countries:empty")}</TableCell>
                </TableRow>
              )}
              {report.byCountry.map((row) => (
                <TableRow key={row.country} hover>
                  <TableCell>{countryName(row.country)}</TableCell>
                  <TableCell align="right">
                    {okErrors(row.upload.ok, errorTotal(row.upload))}
                  </TableCell>
                  <TableCell align="right">
                    {format.average(row.upload.avgFarmsPerUpload)}
                  </TableCell>
                  <TableCell align="right">
                    {okErrors(row.validation.ok, errorTotal(row.validation))}
                  </TableCell>
                  <TableCell align="right">
                    {okErrors(row.analysis.ok, errorTotal(row.analysis))}
                  </TableCell>
                  <TableCell align="right">{format.count(row.reports.requested)}</TableCell>
                  <TableCell align="right">
                    {okErrors(downloaded(row), row.reports.downloadErrors)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
};

/** One donut per metric, with a shared legend: a country has the same color in
 * every donut. */
const CountryShares: React.FC<Pick<ViewProps, "report" | "format" | "countryName">> = ({
  report,
  format,
  countryName,
}) => {
  const { t } = useTranslation();
  const other = t("admin:usage:shares:other");
  const donuts = COUNTRY_METRICS.map((metric) => ({
    metric,
    title: t(`admin:usage:shares:${metric}`),
    slices: countryShares(report, metric, countryName, other),
  }));
  // Every country that has a slice somewhere, in slice order.
  const legend = new Map<string, { label: string; color: string }>();
  donuts.forEach(({ slices }) =>
    slices.forEach(({ id, label, color }) => legend.set(id, { label, color }))
  );

  if (legend.size === 0) {
    return <Text color="secondary">{t("admin:usage:shares:none")}</Text>;
  }
  return (
    <>
      <Box
        component="ul"
        aria-label={t("admin:usage:shares:title")}
        sx={{ display: "flex", flexWrap: "wrap", gap: 2.5, listStyle: "none", padding: 0, margin: 0 }}
      >
        {[...legend].map(([id, { label, color }]) => (
          <Box component="li" key={id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: "3px", backgroundColor: color }} />
            <Text variant="body2">{label}</Text>
          </Box>
        ))}
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
          gap: 2,
          marginTop: 2,
        }}
      >
        {donuts.map(({ metric, title, slices }) => (
          <Box key={metric} role="figure" aria-label={title}>
            <Text variant="subtitle2" bold sx={{ textAlign: "center" }}>
              {title}
            </Text>
            {slices.length === 0 ? (
              <Text color="secondary" variant="body2" sx={{ textAlign: "center", paddingY: 8 }}>
                {t("admin:usage:shares:none")}
              </Text>
            ) : (
              <>
                <CountryShareDonut slices={slices} label={title} />
                {/* The percentages as text too: small slices have no label. */}
                <Box component="ul" sx={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {slices.map((slice) => (
                    <Box
                      component="li"
                      key={slice.id}
                      sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}
                    >
                      <Text variant="caption" color="secondary">
                        {slice.label}
                      </Text>
                      <Text variant="caption">
                        {format.count(slice.value)} · {format.percent(slice.percent)}
                      </Text>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Box>
        ))}
      </Box>
    </>
  );
};
