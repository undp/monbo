import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it } from "vitest";
import theme from "@/config/theme";
import { createTestI18n } from "@/test/i18n";
import { SENTINEL_RGB, themeWithResultColor } from "@/test/resultTheme";
import { NoObservationsCounterChip } from "./NoObservationsCounterChip";

const renderChip = async (appTheme = theme) => {
  const i18n = await createTestI18n("es");
  render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={appTheme}>
        <NoObservationsCounterChip count={null} category={null} />
      </ThemeProvider>
    </I18nextProvider>
  );
  return screen.getByText("Sin dato");
};

describe("NoObservationsCounterChip", () => {
  it("reads the no-data background from the theme", async () => {
    const chip = await renderChip(themeWithResultColor("unknownBackground"));
    expect(getComputedStyle(chip.closest(".MuiChip-root")!).backgroundColor).toBe(SENTINEL_RGB);
  });

  it("reads the no-data text color from the theme", async () => {
    const chip = await renderChip(themeWithResultColor("unknown"));
    expect(getComputedStyle(chip.closest(".MuiChip-root")!).color).toBe(SENTINEL_RGB);
  });

  it("keeps the no-data colors", async () => {
    const chip = await renderChip();
    const style = getComputedStyle(chip.closest(".MuiChip-root")!);
    expect(style.backgroundColor).toBe("rgb(213, 213, 213)");
    expect(style.color).toBe("rgb(103, 103, 103)");
  });
});
