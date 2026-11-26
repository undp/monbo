import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it } from "vitest";
import theme from "@/config/theme";
import { SENTINEL_RGB, themeWithResultColor } from "@/test/resultTheme";
import { ResultChip } from "./ResultChip";

const renderChip = (kind: "ok" | "flagged" | "neutral", appTheme = theme) =>
  render(
    <ThemeProvider theme={appTheme}>
      <ResultChip kind={kind}>Chip</ResultChip>
    </ThemeProvider>
  );

describe("ResultChip", () => {
  it("paints the neutral chip with the theme's neutral background", () => {
    renderChip("neutral", themeWithResultColor("neutralBackground"));
    expect(getComputedStyle(screen.getByText("Chip")).backgroundColor).toBe(SENTINEL_RGB);
  });

  it("keeps the neutral background value", () => {
    renderChip("neutral");
    expect(getComputedStyle(screen.getByText("Chip")).backgroundColor).toBe("rgb(238, 242, 246)");
  });

  it("keeps the ok chip's green", () => {
    renderChip("ok");
    expect(getComputedStyle(screen.getByText("Chip")).color).toBe("rgb(46, 125, 50)");
  });
});
