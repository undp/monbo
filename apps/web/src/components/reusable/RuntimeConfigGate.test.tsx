import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import theme from "@/config/theme";
import { setPathname } from "@/test/navigation";
import { createTestI18n } from "@/test/i18n";
import { deferred } from "@/test/deferred";
import { RuntimeConfigGate } from "./RuntimeConfigGate";

vi.mock("@/api/config", () => ({ getConfig: vi.fn() }));

import { getConfig } from "@/api/config";

const BAND = "runtime-config-header-band";

const config = {
  overlapThresholdPercentage: 5,
  deforestationThresholdPercentage: 1,
} as Awaited<ReturnType<typeof getConfig>>;

const renderGate = async (ui: ReactElement = <p>App</p>) => {
  const i18n = await createTestI18n("en");
  return render(
    <ThemeProvider theme={theme}>
      <I18nextProvider i18n={i18n}>
        <RuntimeConfigGate>{ui}</RuntimeConfigGate>
      </I18nextProvider>
    </ThemeProvider>
  );
};

describe("RuntimeConfigGate", () => {
  beforeEach(() => {
    vi.mocked(getConfig).mockReset();
  });

  it("puts a navy band above the wait on the start page", async () => {
    setPathname("/");
    vi.mocked(getConfig).mockReturnValue(deferred<typeof config>().promise);

    await renderGate();

    const band = screen.getByTestId(BAND);
    const status = screen.getByRole("status");
    expect(
      band.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("keeps the band above the error and its retry on a locale's start page", async () => {
    setPathname("/en");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getConfig).mockRejectedValue(new Error("down"));

    await renderGate();

    const retry = await screen.findByRole("button", { name: "Retry" });
    const band = screen.getByTestId(BAND);
    expect(
      band.compareDocumentPosition(retry) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("draws the band in the start page's navy", async () => {
    setPathname("/");
    vi.mocked(getConfig).mockReturnValue(deferred<typeof config>().promise);

    await renderGate();

    expect(getComputedStyle(screen.getByTestId(BAND)).backgroundColor).toBe(
      "rgb(10, 36, 64)"
    );
  });

  it("has no band on the other pages, whose layout already clears the header", async () => {
    setPathname("/territorial-analysis");
    vi.mocked(getConfig).mockReturnValue(deferred<typeof config>().promise);

    await renderGate();

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByTestId(BAND)).toBeNull();
  });

  it("renders the app without a band once the settings load", async () => {
    setPathname("/");
    vi.mocked(getConfig).mockResolvedValue(config);

    await renderGate();

    await waitFor(() => expect(screen.getByText("App")).toBeTruthy());
    expect(screen.queryByTestId(BAND)).toBeNull();
  });
});
