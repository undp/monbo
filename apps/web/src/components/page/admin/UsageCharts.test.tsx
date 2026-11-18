import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import type { UsageBlock } from "@/api/adminUsage";
import { createTestI18n } from "@/test/i18n";
import { UsageFunnelChart, UsageOutcomesChart, UsageWeeklyChart } from "./UsageCharts";

// A range without usage: every count is 0.
const empty: UsageBlock = {
  sessions: 0,
  upload: {
    ok: 0,
    errors: { invalid_input: 0, server_error: 0 },
    sessions: 0,
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
  analysis: { ok: 0, errors: { invalid_input: 0, server_error: 0 }, sessions: 0, farms: 0 },
  reports: {
    requested: 0,
    requestedSessions: 0,
    downloaded: { pdf: 0, zip: 0 },
    downloadErrors: 0,
    farmsDownloaded: 0,
  },
};

describe("the usage charts", () => {
  it("say there is no data, in the user's language, instead of drawing zeros", async () => {
    const i18n = await createTestI18n("es");
    render(
      <I18nextProvider i18n={i18n}>
        <UsageFunnelChart totals={empty} />
        <UsageOutcomesChart totals={empty} />
        <UsageWeeklyChart
          weekly={[
            { ...empty, weekStart: "2025-01-06" },
            { ...empty, weekStart: "2025-01-13" },
          ]}
        />
      </I18nextProvider>
    );

    expect(screen.getAllByText("Sin datos en este rango.")).toHaveLength(3);
  });
});
