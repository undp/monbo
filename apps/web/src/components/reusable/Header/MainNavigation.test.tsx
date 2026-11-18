import { fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import theme from "@/config/theme";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { DataContext, type DataContextValue } from "@/context/DataContext";
import { makeMapResults, makeValidationResults } from "@/test/factories";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import { setPathname } from "@/test/navigation";
import { makeDataContext } from "@/test/renderWithData";
import { MainNavigation } from "./MainNavigation";

const renderNavigation = async (
  locale: TestLocale = "es",
  context: DataContextValue = makeDataContext()
) => {
  const i18n = await createTestI18n(locale);
  render(
    <ThemeProvider theme={theme}>
      <I18nextProvider i18n={i18n}>
        <DataContext.Provider value={context}>
          <MainNavigation />
        </DataContext.Provider>
      </I18nextProvider>
    </ThemeProvider>
  );
};

// Below 900 px the bar hides; jsdom applies no media query, so the links count as
// hidden for the accessibility tree.
const navigation = () => within(screen.getByRole("navigation", { hidden: true }));
const link = (name: string) => navigation().getByRole("link", { name, hidden: true });
const hrefOf = (name: string) => link(name).getAttribute("href");
const currentOf = (name: string) => link(name).getAttribute("aria-current");

describe("MainNavigation", () => {
  it("links home, the analysis and the methodology in Spanish", async () => {
    setPathname("/");
    await renderNavigation("es");

    expect(hrefOf("Inicio")).toBe("/");
    expect(hrefOf("Análisis")).toBe("/polygons-validation/upload-data");
    expect(hrefOf("Metodología")).toBe("/documentation");
  });

  it("keeps the English prefix", async () => {
    setPathname("/en");
    await renderNavigation("en");

    expect(hrefOf("Home")).toBe("/en");
    expect(hrefOf("Analysis")).toBe("/en/polygons-validation/upload-data");
    expect(hrefOf("Methodology")).toBe("/en/documentation");
  });

  it("resumes the validation once it has results", async () => {
    await renderNavigation(
      "es",
      makeDataContext({ polygonsValidationResults: makeValidationResults({}) })
    );

    expect(hrefOf("Análisis")).toBe("/polygons-validation");
  });

  it("resumes the analysis once it has results", async () => {
    setPathname("/documentation");
    await renderNavigation(
      "es",
      makeDataContext({
        polygonsValidationResults: makeValidationResults({}),
        deforestationAnalysisResults: [makeMapResults(1, {})],
      })
    );

    expect(hrefOf("Análisis")).toBe("/deforestation-analysis");
  });

  it.each([
    ["/", "Inicio"],
    ["/polygons-validation", "Análisis"],
    ["/deforestation-analysis/upload-data", "Análisis"],
    ["/report-generation/preview", "Análisis"],
    ["/documentation", "Metodología"],
  ])("marks the current section on %s", async (pathname, current) => {
    setPathname(pathname);
    await renderNavigation("es");

    for (const name of ["Inicio", "Análisis", "Metodología"]) {
      expect(currentOf(name)).toBe(name === current ? "page" : null);
    }
  });

  it("marks the methodology on the English page", async () => {
    setPathname("/en/documentation");
    await renderNavigation("en");

    expect(currentOf("Methodology")).toBe("page");
  });

  it("shows only the methodology on the admin pages", async () => {
    setPathname("/en/admin/layers");
    await renderNavigation("en");

    expect(navigation().queryByRole("link", { name: "Home", hidden: true })).toBeNull();
    expect(navigation().queryByRole("link", { name: "Analysis", hidden: true })).toBeNull();
    expect(hrefOf("Methodology")).toBe("/en/documentation");
  });

  it("lists the links in the narrow-screen menu", async () => {
    setPathname("/");
    await renderNavigation("es");

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir el menú de navegación", hidden: true })
    );

    const menu = within(await screen.findByRole("menu"));
    expect(menu.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Inicio",
      "Análisis",
      "Metodología",
    ]);
  });

  it("holds the admin's country and sections in the narrow-screen menu", async () => {
    setPathname("/es/admin/categories");
    const i18n = await createTestI18n("es");
    render(
      <ThemeProvider theme={theme}>
        <I18nextProvider i18n={i18n}>
          <AdminSessionContext.Provider
            value={{
              session: { token: "t", expiresAt: "2099-01-01T00:00:00Z", country: "CO" },
              ready: true,
              login: vi.fn(),
              logout: vi.fn(),
              withToken: vi.fn(),
            }}
          >
            <DataContext.Provider value={makeDataContext()}>
              <MainNavigation />
            </DataContext.Provider>
          </AdminSessionContext.Provider>
        </I18nextProvider>
      </ThemeProvider>
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir el menú de navegación", hidden: true })
    );

    const menu = within(await screen.findByRole("menu"));
    expect(menu.getByText("Colombia")).toBeTruthy();
    expect(menu.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Capas",
      "Categorías",
      "Uso",
      "Metodología",
    ]);
    expect(
      menu.getByRole("menuitem", { name: "Categorías" }).getAttribute("aria-current")
    ).toBe("page");
  });
});
