import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { DataContext } from "@/context/DataContext";
import { createTestI18n } from "@/test/i18n";
import { setPathname } from "@/test/navigation";
import { makeDataContext } from "@/test/renderWithData";
import { CountryMenu } from "./CountryMenu";

const renderMenu = async (selectedCountry: string | null) => {
  const i18n = await createTestI18n("es");
  render(
    <I18nextProvider i18n={i18n}>
      <DataContext.Provider
        value={makeDataContext({
          selectedCountry,
          availableCountries: ["CO", "CR", "EC"],
          availableCountriesLoaded: true,
        })}
      >
        <CountryMenu />
      </DataContext.Provider>
    </I18nextProvider>
  );
};

const menuButton = () => screen.queryByRole("button", { name: "País del análisis" });

describe("CountryMenu", () => {
  it("shows the selected country on a module page", async () => {
    setPathname("/polygons-validation");
    await renderMenu("CO");

    expect(menuButton()?.textContent).toContain("Colombia");
  });

  it.each(["/", "/en"])("is hidden on the start page (%s)", async (pathname) => {
    setPathname(pathname);
    await renderMenu("CO");

    expect(menuButton()).toBeNull();
  });

  it("is hidden without a country", async () => {
    setPathname("/documentation");
    await renderMenu(null);

    expect(menuButton()).toBeNull();
  });
});
