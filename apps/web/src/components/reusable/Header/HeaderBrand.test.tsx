import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import theme from "@/config/theme";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import { setPathname } from "@/test/navigation";
import { HeaderBrand } from "./HeaderBrand";

const renderBrand = async (locale: TestLocale) => {
  const i18n = await createTestI18n(locale);
  render(
    <ThemeProvider theme={theme}>
      <I18nextProvider i18n={i18n}>
        <HeaderBrand />
      </I18nextProvider>
    </ThemeProvider>
  );
};

const logo = () => screen.getByRole("link").querySelector("img");

describe("HeaderBrand", () => {
  it("links to the Spanish start page with the PNUD mark", async () => {
    setPathname("/polygons-validation");
    await renderBrand("es");

    const link = screen.getByRole("link", { name: "Monbo, del PNUD: ir al inicio" });
    expect(link.getAttribute("href")).toBe("/");
    expect(link.textContent).toBe("PNUD");
    expect(logo()?.getAttribute("src")).toContain("Logo.svg");
  });

  it("uses the white logo and the UNDP mark on the English start page", async () => {
    setPathname("/en");
    await renderBrand("en");

    const link = screen.getByRole("link", { name: "Monbo, by UNDP: go to the start page" });
    expect(link.getAttribute("href")).toBe("/en");
    expect(link.textContent).toBe("UNDP");
    expect(logo()?.getAttribute("src")).toContain("Logo-white.svg");
  });
});
