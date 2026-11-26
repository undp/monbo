import { render, screen } from "@testing-library/react";
import { Button } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it } from "vitest";
import theme from "./theme";

const renderButton = (props: React.ComponentProps<typeof Button>) =>
  render(
    <ThemeProvider theme={theme}>
      <Button {...props}>Validar polígonos</Button>
    </ThemeProvider>
  );

describe("theme buttons", () => {
  it("are in sentence case, with no shadow", () => {
    renderButton({ variant: "contained" });
    const style = getComputedStyle(screen.getByRole("button", { name: "Validar polígonos" }));
    expect(style.textTransform).toBe("none");
    expect(style.boxShadow).toBe("none");
  });

  it("paint a contained primary button in the flow's blue", () => {
    renderButton({ variant: "contained" });
    expect(
      getComputedStyle(screen.getByRole("button", { name: "Validar polígonos" })).backgroundColor
    ).toBe("rgb(13, 100, 160)");
  });

  it("keep MUI's disabled look over the flow's blue", () => {
    renderButton({ variant: "contained", disabled: true });
    expect(
      getComputedStyle(screen.getByRole("button", { name: "Validar polígonos" })).backgroundColor
    ).toBe("rgba(0, 0, 0, 0.12)");
  });
});

describe("theme result colors", () => {
  it("keep the values the app and the report have always painted", () => {
    expect(theme.palette.result).toEqual({
      ok: "#2E7D32",
      okBackground: "rgba(46, 125, 50, 0.08)",
      flagged: "#D32F2F",
      flaggedBackground: "rgba(211, 47, 47, 0.08)",
      unknown: "#676767",
      unknownBackground: "#D5D5D5",
      meterFlagged: "#f2b8b2",
      meterUnknown: "#c7d3df",
      neutralBackground: "#eef2f6",
      layerTile: "#ff0000",
    });
  });
});
