import { fireEvent, render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminApiError } from "@/api/adminLayers";
import { getAdminUsage, type UsageBlock, type UsageReport } from "@/api/adminUsage";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { createTestI18n } from "@/test/i18n";
import { AdminUsagePageContent } from "./AdminUsagePageContent";

vi.mock("@/api/adminUsage", () => ({ getAdminUsage: vi.fn() }));
// The charts need a real layout; their data is tested in usageChartData.test.ts.
vi.mock("./UsageCharts", () => ({
  UsageSparkline: ({ data }: { data: number[] }) => (
    <div data-testid="sparkline">{data.join(",")}</div>
  ),
  UsageFunnelChart: () => <div data-testid="funnel-chart" />,
  UsageOutcomesChart: () => <div data-testid="outcomes-chart" />,
  CountryShareDonut: ({ label }: { label: string }) => (
    <div data-testid="donut">{label}</div>
  ),
  UsageWeeklyChart: ({ weekly }: { weekly: unknown[] }) => (
    <div data-testid="weekly-chart">{weekly.length} weeks</div>
  ),
}));

const block = (overrides: Partial<UsageBlock> = {}): UsageBlock => ({
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
  ...overrides,
});

const busy = block({
  sessions: 12,
  upload: {
    ok: 3,
    errors: { invalid_input: 1, server_error: 0 },
    sessions: 9,
    farms: 90,
    polygons: 80,
    points: 10,
    avgFarmsPerUpload: 30,
  },
  analysis: { ok: 4, errors: { invalid_input: 0, server_error: 2 }, sessions: 2, farms: 40 },
  reports: {
    requested: 5,
    requestedSessions: 4,
    downloaded: { pdf: 3, zip: 2 },
    downloadErrors: 1,
    farmsDownloaded: 19,
  },
});

const report = (overrides: Partial<UsageReport> = {}): UsageReport => ({
  from: "2026-10-11",
  to: "2026-11-09",
  totals: busy,
  byCountry: [
    { ...busy, country: "CR" },
    { ...block({ sessions: 1 }), country: "unknown" },
  ],
  weekly: [
    { ...busy, weekStart: "2026-10-05" },
    { ...block(), weekStart: "2026-10-12" },
  ],
  sources: { server: ["upload", "validation", "analysis"], browser: ["reports"] },
  ...overrides,
});

const session = { token: "t", expiresAt: "2099-01-01T00:00:00Z", country: "CO" };

const renderPage = async () => {
  const i18n = await createTestI18n("en");
  render(
    <I18nextProvider i18n={i18n}>
      <AdminSessionContext.Provider
        value={{
          session,
          ready: true,
          login: vi.fn(),
          logout: vi.fn(),
          withToken: (call) => call("token"),
        }}
      >
        <AdminUsagePageContent />
      </AdminSessionContext.Provider>
    </I18nextProvider>
  );
};

const tile = (label: string) => within(screen.getByRole("group", { name: label }));
const today = () => new Date().toISOString().slice(0, 10);

beforeEach(() => {
  vi.mocked(getAdminUsage).mockResolvedValue(report());
});

describe("AdminUsagePageContent", () => {
  it("titles the page without the overline or the session's country", async () => {
    await renderPage();
    await screen.findByTestId("weekly-chart");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("App usage");
    expect(screen.queryByText("Layers admin")).toBeNull();
    expect(screen.queryByText(/Colombia/)).toBeNull();
  });

  it("shows the totals in tiles, with their source and weekly trend", async () => {
    await renderPage();
    await screen.findByTestId("weekly-chart");

    expect(tile("Sessions").getByText("12")).toBeTruthy();
    expect(tile("Sessions").getByTestId("sparkline").textContent).toBe("12,0");
    expect(tile("Farm uploads").getByText("3")).toBeTruthy();
    expect(tile("Farm uploads").getByText("30 farms per upload on average")).toBeTruthy();
    expect(tile("Farm uploads").getByText("Recorded by the server")).toBeTruthy();
    expect(tile("Deforestation analyses").getByText("4")).toBeTruthy();
    expect(tile("Deforestation analyses").getByText("2 sessions analyzed")).toBeTruthy();
    expect(tile("Reports downloaded").getByText("5")).toBeTruthy();
    expect(tile("Reports downloaded").getByText("3 as one PDF · 2 as a ZIP")).toBeTruthy();
    expect(tile("Reports downloaded").getByText("Reported by the browser")).toBeTruthy();
    expect(screen.getByText(/browser sessions, not people/)).toBeTruthy();
  });

  it("shows each country's share in a donut per metric", async () => {
    await renderPage();
    await screen.findByTestId("weekly-chart");
    // Only CR has uploads: 100 %. The unknown country has a session only.
    const uploads = within(screen.getByRole("figure", { name: "Uploads" }));
    expect(uploads.getByTestId("donut")).toBeTruthy();
    expect(uploads.getByText("Costa Rica")).toBeTruthy();
    expect(uploads.getByText("3 · 100%")).toBeTruthy();
    const sessions = within(screen.getByRole("figure", { name: "Sessions" }));
    expect(sessions.getByText("12 · 92%")).toBeTruthy();
    expect(sessions.getByText("Other")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Share by country" })).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Costa Rica", "Other"]);
  });

  it("shows the funnel and the outcomes charts", async () => {
    await renderPage();
    expect(await screen.findByTestId("funnel-chart")).toBeTruthy();
    expect(screen.getByTestId("outcomes-chart")).toBeTruthy();
  });

  it("asks for the last 30 days first", async () => {
    await renderPage();
    await screen.findByTestId("weekly-chart");
    const to = today();
    const from = new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86400000)
      .toISOString()
      .slice(0, 10);
    expect(getAdminUsage).toHaveBeenCalledWith("token", from, to);
  });

  it("shows a row per country, with an unknown country and no average", async () => {
    await renderPage();
    const table = within(await screen.findByRole("table", { name: "Detail by country" }));
    const costaRica = within(table.getByRole("row", { name: /^Costa Rica/ }));
    expect(costaRica.getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "Costa Rica",
      "3 ok · 1 errors",
      "30",
      "0 ok · 0 errors",
      "4 ok · 2 errors",
      "5",
      "5 ok · 1 errors",
    ]);
    const unknown = within(table.getByRole("row", { name: /^Unknown country/ }));
    expect(unknown.getAllByRole("cell")[2].textContent).toBe("—");
  });

  it("passes the weeks to the chart", async () => {
    await renderPage();
    expect((await screen.findByTestId("weekly-chart")).textContent).toBe("2 weeks");
  });

  it("asks for this year's range", async () => {
    await renderPage();
    await screen.findByTestId("weekly-chart");
    fireEvent.click(screen.getByRole("button", { name: "This year" }));
    await screen.findByTestId("weekly-chart");
    expect(getAdminUsage).toHaveBeenLastCalledWith(
      "token",
      `${today().slice(0, 4)}-01-01`,
      today()
    );
  });

  it("says when the range has no usage", async () => {
    vi.mocked(getAdminUsage).mockResolvedValue(report({ totals: block(), byCountry: [] }));
    await renderPage();
    expect(await screen.findByText("There is no usage in this range.")).toBeTruthy();
    expect(tile("Farm uploads").getByText("— farms per upload on average")).toBeTruthy();
    expect(screen.getByText("No data in this range.")).toBeTruthy();
    expect(tile("Sessions").getByText("0")).toBeTruthy();
  });

  it("says when the server has no usage metrics", async () => {
    vi.mocked(getAdminUsage).mockRejectedValue(new AdminApiError(503, "not configured"));
    await renderPage();
    expect(
      await screen.findByText("Usage metrics aren't configured on this server.")
    ).toBeTruthy();
  });

  it("says when the figures can't be loaded", async () => {
    vi.mocked(getAdminUsage).mockRejectedValue(new AdminApiError(500, "boom"));
    await renderPage();
    expect(await screen.findByText("The usage figures could not be loaded.")).toBeTruthy();
  });
});
