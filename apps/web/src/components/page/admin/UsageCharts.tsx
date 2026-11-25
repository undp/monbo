"use client";

// The usage page's charts (@mui/x-charts). Their data and colors come from
// usageChartData.ts; these only draw them.
import React from "react";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { SparkLineChart } from "@mui/x-charts/SparkLineChart";
import { useTranslation } from "react-i18next";
import type { UsageBlock, UsageReport } from "@/api/adminUsage";
import {
  CountrySlice,
  OUTCOME_COLORS,
  TREND_COLORS,
  funnelStages,
  stepOutcomes,
  weeklySeries,
} from "./usageChartData";

// Recessive chrome: hairline grid, muted ticks.
const AXIS_SX = {
  "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": { stroke: "#c3c2b7" },
  "& .MuiChartsAxis-tickLabel": { fill: "#52514e" },
  "& .MuiChartsGrid-line": { stroke: "#e1e0d9" },
};

const useFormat = () => {
  const { i18n } = useTranslation();
  const integer = new Intl.NumberFormat(i18n.language);
  const percent = new Intl.NumberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  return {
    count: (value: number | null) => (value === null ? "" : integer.format(value)),
    percent: (value: number) => percent.format(value / 100),
  };
};

/** A tile's trend: the metric week by week, no axes. */
export const UsageSparkline: React.FC<{ data: number[]; label: string }> = ({
  data,
  label,
}) => {
  const format = useFormat();
  return (
    <SparkLineChart
      data={data}
      height={48}
      area
      curve="linear"
      color="#2a78d6"
      showTooltip
      showHighlight
      valueFormatter={(value) => format.count(value)}
      aria-label={label}
    />
  );
};

/** Sessions that reached each step of the analysis flow, with their share. */
export const UsageFunnelChart: React.FC<{ totals: UsageBlock }> = ({ totals }) => {
  const { t } = useTranslation();
  const format = useFormat();
  const stages = funnelStages(totals);
  return (
    <BarChart
      height={260}
      layout="horizontal"
      hideLegend
      grid={{ vertical: true }}
      sx={AXIS_SX}
      yAxis={[
        {
          scaleType: "band",
          data: stages.map(({ stage }) => t(`admin:usage:funnel:${stage}`)),
          width: 150,
          colorMap: {
            type: "ordinal",
            colors: stages.map(({ color }) => color),
          },
        },
      ]}
      xAxis={[
        {
          // Headroom past the longest bar for its percentage label, which the
          // chart would otherwise clip.
          max: Math.max(1, ...stages.map(({ value }) => value)) * 1.2,
          valueFormatter: (value: number) => format.count(value),
        },
      ]}
      series={[
        {
          data: stages.map(({ value }) => value),
          label: t("admin:usage:funnel:title"),
          valueFormatter: (value, { dataIndex }) => {
            const { percent } = stages[dataIndex];
            return percent === null
              ? format.count(value)
              : `${format.count(value)} (${format.percent(percent)})`;
          },
          barLabel: (item) => {
            const { percent } = stages[item.dataIndex];
            return percent === null ? null : format.percent(percent);
          },
          barLabelPlacement: "outside",
        },
      ]}
      borderRadius={4}
    />
  );
};

/** Successes and errors of each step, stacked. */
export const UsageOutcomesChart: React.FC<{ totals: UsageBlock }> = ({ totals }) => {
  const { t } = useTranslation();
  const format = useFormat();
  const rows = stepOutcomes(totals);
  const series = (["ok", "invalidInput", "failed"] as const).map((key) => ({
    data: rows.map((row) => row[key]),
    label: t(`admin:usage:outcomes:${key}`),
    color: OUTCOME_COLORS[key],
    stack: "outcomes",
    valueFormatter: (value: number | null) => format.count(value),
  }));
  return (
    <BarChart
      height={260}
      layout="horizontal"
      grid={{ vertical: true }}
      sx={AXIS_SX}
      yAxis={[
        {
          scaleType: "band",
          data: rows.map(({ step }) => t(`admin:usage:steps:${step}`)),
          width: 150,
        },
      ]}
      xAxis={[{ valueFormatter: (value: number) => format.count(value) }]}
      series={series}
      slotProps={{ legend: { position: { vertical: "top", horizontal: "center" } } }}
    />
  );
};

/** A metric's split by country, with each country's percentage on its slice. */
export const CountryShareDonut: React.FC<{ slices: CountrySlice[]; label: string }> = ({
  slices,
  label,
}) => {
  const format = useFormat();
  return (
    <PieChart
      height={220}
      hideLegend
      aria-label={label}
      series={[
        {
          data: slices.map(({ id, label, value, color }) => ({ id, label, value, color })),
          innerRadius: "55%",
          outerRadius: "95%",
          paddingAngle: 1.5,
          cornerRadius: 4,
          arcLabel: (item) =>
            format.percent(slices.find(({ id }) => id === item.id)?.percent ?? 0),
          // Too thin a slice has no room for its label; the legend and tooltip
          // still give it.
          arcLabelMinAngle: 22,
          valueFormatter: (item, { dataIndex }) =>
            `${format.count(item.value)} (${format.percent(slices[dataIndex].percent)})`,
        },
      ]}
    />
  );
};

/** Sessions, analyses and downloaded reports, one point per ISO week. */
export const UsageWeeklyChart: React.FC<{ weekly: UsageReport["weekly"] }> = ({
  weekly,
}) => {
  const { t, i18n } = useTranslation();
  const format = useFormat();
  const weekLabel = new Intl.DateTimeFormat(i18n.language, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const series = (["sessions", "analyses", "reportsDownloaded"] as const).map(
    (metric, i) => ({
      label: t(`admin:usage:weekly:${metric}`),
      data: weeklySeries(weekly, metric),
      color: TREND_COLORS[i],
      curve: "linear" as const,
      showMark: weekly.length <= 16,
      valueFormatter: (value: number | null) => format.count(value),
    })
  );

  return (
    <LineChart
      height={300}
      grid={{ horizontal: true }}
      sx={{ ...AXIS_SX, "& .MuiLineElement-root": { strokeWidth: 2 } }}
      xAxis={[
        {
          scaleType: "point",
          data: weekly.map((week) => week.weekStart),
          valueFormatter: (weekStart: string) =>
            weekLabel.format(new Date(`${weekStart}T00:00:00Z`)),
        },
      ]}
      yAxis={[{ valueFormatter: (value: number) => format.count(value) }]}
      series={series}
      slotProps={{ legend: { position: { vertical: "top", horizontal: "center" } } }}
    />
  );
};
