import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it } from "vitest";
import theme from "@/config/theme";
import { contrastRatio } from "@/test/contrast";
import { FLOW_COLORS } from "./flowStyles";
import { PageEyebrow } from "./PageEyebrow";

describe("PageEyebrow", () => {
  it("meets AA contrast on white and on the stage background", () => {
    render(
      <ThemeProvider theme={theme}>
        <PageEyebrow>Paso 1</PageEyebrow>
      </ThemeProvider>
    );
    const color = getComputedStyle(screen.getByText("Paso 1")).color;
    expect(color).toBe("rgb(38, 122, 80)");
    const [r, g, b] = color.match(/\d+/g)!.map(Number);
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    expect(contrastRatio(hex, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hex, FLOW_COLORS.blue25)).toBeGreaterThanOrEqual(4.5);
  });
});
