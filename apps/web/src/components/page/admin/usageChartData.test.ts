import { describe, expect, it } from "vitest";
import type { UsageBlock, UsageReport } from "@/api/adminUsage";
import {
  COUNTRY_COLORS,
  FUNNEL_COLORS,
  OTHER_COLOR,
  countryColors,
  countryShares,
  funnelStages,
  stepOutcomes,
  weeklySeries,
} from "./usageChartData";

const block = (sessions: number, uploads = 0, overrides: Partial<UsageBlock> = {}): UsageBlock => ({
  sessions,
  upload: {
    ok: uploads,
    errors: { invalid_input: 1, server_error: 2 },
    sessions: Math.min(sessions, uploads),
    farms: 0,
    polygons: 0,
    points: 0,
    avgFarmsPerUpload: null,
  },
  validation: {
    ok: 0,
    errors: { invalid_input: 0, server_error: 0 },
    sessions: 0,
    farms: 0,
    invalidFarms: 0,
  },
  analysis: { ok: 0, errors: { invalid_input: 0, server_error: 3 }, sessions: 0, farms: 0 },
  reports: {
    requested: 0,
    requestedSessions: 0,
    downloaded: { pdf: 4, zip: 1 },
    downloadErrors: 2,
    farmsDownloaded: 0,
  },
  ...overrides,
});

const report = (countries: [string, UsageBlock][]): UsageReport => ({
  from: "2026-11-01",
  to: "2026-11-09",
  totals: block(0),
  byCountry: countries.map(([country, b]) => ({ ...b, country })),
  weekly: [],
  sources: { server: [], browser: [] },
});

const name = (code: string) => `name of ${code}`;

describe("countryShares", () => {
  it("gives each country its share, in percent, with a fixed color", () => {
    const slices = countryShares(
      report([
        ["CO", block(1)],
        ["CR", block(3)],
      ]),
      "sessions",
      name,
      "Other"
    );
    expect(slices).toEqual([
      { id: "CO", label: "name of CO", value: 1, percent: 25, color: COUNTRY_COLORS[0] },
      { id: "CR", label: "name of CR", value: 3, percent: 75, color: COUNTRY_COLORS[1] },
    ]);
  });

  it("keeps a country's color in every metric, even when another has no slice", () => {
    const data = report([
      ["CO", block(1, 0)],
      ["CR", block(1, 5)],
    ]);
    const uploads = countryShares(data, "uploads", name, "Other");
    expect(uploads).toEqual([
      expect.objectContaining({ id: "CR", percent: 100, color: COUNTRY_COLORS[1] }),
    ]);
  });

  it("folds the unknown country and those past the fifth into Other", () => {
    const codes = ["AR", "BO", "CO", "CR", "EC", "PE"];
    const data = report([
      ...codes.map((code): [string, UsageBlock] => [code, block(1)]),
      ["unknown", block(2)],
    ]);
    const slices = countryShares(data, "sessions", name, "Other");
    expect(slices.map(({ id }) => id)).toEqual(["AR", "BO", "CO", "CR", "EC", "other"]);
    expect(slices.at(-1)).toEqual({
      id: "other",
      label: "Other",
      value: 3,
      percent: 37.5,
      color: OTHER_COLOR,
    });
    expect(countryColors(data).get("PE")).toBeUndefined();
  });

  it("has no slices without data", () => {
    expect(countryShares(report([["CO", block(0)]]), "analyses", name, "Other")).toEqual([]);
  });

  it("counts downloaded reports in both formats", () => {
    const [slice] = countryShares(report([["CO", block(1)]]), "reportsDownloaded", name, "Other");
    expect(slice.value).toBe(5);
  });
});

describe("funnelStages", () => {
  it("gives the sessions at each step and their share of all sessions", () => {
    const totals = block(10, 8, {
      analysis: { ok: 6, errors: { invalid_input: 0, server_error: 0 }, sessions: 5, farms: 0 },
      reports: {
        requested: 3,
        requestedSessions: 2,
        downloaded: { pdf: 0, zip: 0 },
        downloadErrors: 0,
        farmsDownloaded: 0,
      },
    });
    expect(funnelStages(totals)).toEqual([
      { stage: "sessions", value: 10, percent: 100, color: FUNNEL_COLORS[0] },
      { stage: "uploaded", value: 8, percent: 80, color: FUNNEL_COLORS[1] },
      { stage: "analyzed", value: 5, percent: 50, color: FUNNEL_COLORS[2] },
      { stage: "requestedReport", value: 2, percent: 20, color: FUNNEL_COLORS[3] },
    ]);
  });

  it("has no percentages without sessions", () => {
    expect(funnelStages(block(0)).every(({ percent }) => percent === null)).toBe(true);
  });
});

describe("stepOutcomes", () => {
  it("splits each step into successful, invalid input and failed", () => {
    expect(stepOutcomes(block(1, 7))).toEqual([
      { step: "upload", ok: 7, invalidInput: 1, failed: 2 },
      { step: "validation", ok: 0, invalidInput: 0, failed: 0 },
      { step: "analysis", ok: 0, invalidInput: 0, failed: 3 },
      { step: "download", ok: 5, invalidInput: 0, failed: 2 },
    ]);
  });
});

describe("weeklySeries", () => {
  it("gives a metric week by week", () => {
    const weekly = [
      { ...block(2, 1), weekStart: "2026-10-26" },
      { ...block(5, 3), weekStart: "2026-11-02" },
    ];
    expect(weeklySeries(weekly, "sessions")).toEqual([2, 5]);
    expect(weeklySeries(weekly, "uploads")).toEqual([1, 3]);
    expect(weeklySeries(weekly, "reportsDownloaded")).toEqual([5, 5]);
  });
});
