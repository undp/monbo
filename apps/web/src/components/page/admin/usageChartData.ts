// The usage page's charts, as data: which slice, bar or point each figure becomes,
// and its color. Pure, so it is tested without rendering a chart.
//
// The palettes were checked with the dataviz skill's validator (colorblind and
// normal-vision separation, light surface): the five country slots, the funnel's
// one-hue ramp and the outcome trio all pass.
import type { UsageBlock, UsageReport } from "@/api/adminUsage";

/** Categorical slots for countries, in fixed order. A country keeps its color in
 * every chart; past the fifth, countries fold into "Other". */
export const COUNTRY_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
/** Neutral for "Other" and the unknown country: not an identity. */
export const OTHER_COLOR = "#c3c2b7";
export const OTHER_ID = "other";
const UNKNOWN_COUNTRY = "unknown";

/** Sessions narrowing down the analysis flow: one blue, light to dark. */
export const FUNNEL_COLORS = ["#86b6ef", "#3987e5", "#256abf", "#104281"];

/** Successful, invalid input, failed: one accent and two status colors. */
export const OUTCOME_COLORS = {
  ok: "#2a78d6",
  invalidInput: "#ec835a",
  failed: "#d03b3b",
} as const;

/** The weekly trend's three series. */
export const TREND_COLORS = ["#2a78d6", "#eb6834", "#1baf7a"];

export const downloaded = (block: UsageBlock) =>
  block.reports.downloaded.pdf + block.reports.downloaded.zip;

export type CountryMetric = "sessions" | "uploads" | "analyses" | "reportsDownloaded";
export const COUNTRY_METRICS: CountryMetric[] = [
  "sessions",
  "uploads",
  "analyses",
  "reportsDownloaded",
];

const metricValue: Record<CountryMetric, (block: UsageBlock) => number> = {
  sessions: (block) => block.sessions,
  uploads: (block) => block.upload.ok,
  analyses: (block) => block.analysis.ok,
  reportsDownloaded: downloaded,
};

/** The color of each country in the report: the first five named countries (in
 * the report's order) take the slots; the rest and the unknown country fold into
 * "Other". */
export const countryColors = (report: UsageReport): Map<string, string> => {
  const named = report.byCountry
    .map((row) => row.country)
    .filter((code) => code !== UNKNOWN_COUNTRY);
  return new Map(
    named.slice(0, COUNTRY_COLORS.length).map((code, i) => [code, COUNTRY_COLORS[i]])
  );
};

export interface CountrySlice {
  id: string;
  label: string;
  value: number;
  /** Share of the metric's total, 0-100. */
  percent: number;
  color: string;
}

/** One donut: each country's share of a metric. Countries with nothing are left
 * out; "Other" goes last. */
export const countryShares = (
  report: UsageReport,
  metric: CountryMetric,
  countryName: (code: string) => string,
  otherLabel: string
): CountrySlice[] => {
  const colors = countryColors(report);
  const value = metricValue[metric];
  const total = report.byCountry.reduce((sum, row) => sum + value(row), 0);
  if (total === 0) return [];

  const slices: CountrySlice[] = [];
  let other = 0;
  for (const row of report.byCountry) {
    const amount = value(row);
    const color = colors.get(row.country);
    if (!color) other += amount;
    else if (amount > 0)
      slices.push({
        id: row.country,
        label: countryName(row.country),
        value: amount,
        percent: (amount / total) * 100,
        color,
      });
  }
  if (other > 0)
    slices.push({
      id: OTHER_ID,
      label: otherLabel,
      value: other,
      percent: (other / total) * 100,
      color: OTHER_COLOR,
    });
  return slices;
};

export type FunnelStage = "sessions" | "uploaded" | "analyzed" | "requestedReport";

/** Sessions at each step of the analysis flow. Validation is a module of its own,
 * so it isn't a step here. */
export const funnelStages = (totals: UsageBlock) => {
  const stages: [FunnelStage, number][] = [
    ["sessions", totals.sessions],
    ["uploaded", totals.upload.sessions],
    ["analyzed", totals.analysis.sessions],
    ["requestedReport", totals.reports.requestedSessions],
  ];
  return stages.map(([stage, value], i) => ({
    stage,
    value,
    /** Share of all sessions, 0-100; null without sessions. */
    percent: totals.sessions > 0 ? (value / totals.sessions) * 100 : null,
    color: FUNNEL_COLORS[i],
  }));
};

export type OutcomeStep = "upload" | "validation" | "analysis" | "download";

/** Successes and errors of each step. Server steps split their errors into
 * invalid input and server errors; a failed download is "failed". */
export const stepOutcomes = (totals: UsageBlock) => {
  const server = (step: "upload" | "validation" | "analysis") => ({
    step,
    ok: totals[step].ok,
    invalidInput: totals[step].errors.invalid_input,
    failed: totals[step].errors.server_error,
  });
  return [
    server("upload"),
    server("validation"),
    server("analysis"),
    {
      step: "download" as const,
      ok: downloaded(totals),
      invalidInput: 0,
      failed: totals.reports.downloadErrors,
    },
  ];
};

export type TrendMetric =
  | "sessions"
  | "uploads"
  | "analyses"
  | "reportsRequested"
  | "reportsDownloaded";

const trendValue: Record<TrendMetric, (block: UsageBlock) => number> = {
  sessions: (block) => block.sessions,
  uploads: (block) => block.upload.ok,
  analyses: (block) => block.analysis.ok,
  reportsRequested: (block) => block.reports.requested,
  reportsDownloaded: downloaded,
};

/** A metric week by week, oldest first. */
export const weeklySeries = (weekly: UsageReport["weekly"], metric: TrendMetric) =>
  weekly.map(trendValue[metric]);
