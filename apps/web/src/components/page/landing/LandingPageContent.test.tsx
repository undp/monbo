import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeFarm } from "@/test/factories";
import { router } from "@/test/navigation";
import { renderLanding } from "@/test/renderLanding";
import { LandingPageContent } from "./LandingPageContent";

// Counts the renders of the steps, around the real (memoized) component.
const stepRenders = vi.hoisted(() => vi.fn());
vi.mock("./LandingSteps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./LandingSteps")>();
  const { createElement, memo } = await import("react");
  type Props = Parameters<typeof actual.LandingSteps>[0];
  return {
    LandingSteps: memo(function CountedSteps(props: Props) {
      stepRenders();
      return createElement(actual.LandingSteps, props);
    }),
  };
});

const stepButton = (name: string) => screen.getByRole("button", { name });

describe("LandingPageContent", () => {
  it("shows the hero, the three steps and the start bar", async () => {
    await renderLanding(<LandingPageContent />, { selectedCountry: "CO" });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Revisa tu producción en 3 pasos."
    );
    for (const badge of [
      "Gratis y de libre acceso",
      "Sin registro",
      "No guardamos tus polígonos",
    ]) {
      expect(screen.getByText(badge)).toBeTruthy();
    }
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)
    ).toEqual([
      "Paso 1: Valida tus polígonos",
      "Paso 2: Análisis territorial",
      "Paso 3: Descarga tu reporte",
    ]);
    expect(stepButton("Empezar en Colombia")).toBeTruthy();
    expect(screen.queryByText(/mapas disponibles/i)).toBeNull();
  });

  it("changes the country without rendering the steps again", async () => {
    await renderLanding(<LandingPageContent />, { selectedCountry: "CO" });
    const firstCard = screen.getByTestId("step-1");
    const rendersBefore = stepRenders.mock.calls.length;
    expect(rendersBefore).toBeGreaterThan(0);

    fireEvent.click(stepButton("Costa Rica"));

    expect(stepButton("Empezar en Costa Rica")).toBeTruthy();
    expect(stepRenders.mock.calls.length).toBe(rendersBefore);
    // Same DOM node: the entrance animation doesn't replay.
    expect(screen.getByTestId("step-1")).toBe(firstCard);
  });

  it("keeps the category chips when the country changes", async () => {
    await renderLanding(<LandingPageContent />, { selectedCountry: "CO" });
    fireEvent.click(stepButton("Costa Rica"));

    for (const chip of ["Deforestación", "Áreas protegidas", "Frontera agrícola"]) {
      expect(screen.getByText(chip)).toBeTruthy();
    }
  });

  it.each([
    ["Valida tus polígonos", "/polygons-validation/upload-data"],
    ["Análisis territorial", "/deforestation-analysis/upload-data"],
    ["Empezar en Colombia", "/polygons-validation/upload-data"],
  ])("%s opens its stage without farms", async (name, path) => {
    await renderLanding(<LandingPageContent />, { selectedCountry: "CO" });

    fireEvent.click(stepButton(name));

    expect(router.push).toHaveBeenCalledWith(path);
  });

  it("asks about the loaded data before opening a stage", async () => {
    await renderLanding(<LandingPageContent />, {
      selectedCountry: "CO",
      context: { farmsData: [makeFarm()] },
    });

    fireEvent.click(stepButton("Análisis territorial"));

    expect(
      await screen.findByText(
        "Usarás los mismos datos en el análisis territorial"
      )
    ).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("can't press step 3", async () => {
    await renderLanding(<LandingPageContent />, { selectedCountry: "CO" });

    expect(screen.queryByRole("button", { name: "Descarga tu reporte" })).toBeNull();
    fireEvent.click(screen.getByTestId("step-3"));
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each([
    ["es", "Descargar plantilla", "/files/m1-upload-file-template-es.xlsx"],
    ["en", "Download template", "/files/m1-upload-file-template-en.xlsx"],
  ] as const)("downloads the %s template", async (locale, name, href) => {
    await renderLanding(<LandingPageContent />, { locale, selectedCountry: "CO" });

    const link = screen.getByRole("link", { name });
    expect(link.getAttribute("href")).toBe(href);
    expect(link.hasAttribute("download")).toBe(true);
  });

  it.each([
    ["es", /^Ver ejemplo de reporte/, "/files/examples/es/ejemplo-reporte.pdf"],
    ["en", /^See a sample report/, "/files/examples/en/example-report.pdf"],
  ] as const)("opens the %s sample report in a new tab", async (locale, name, href) => {
    await renderLanding(<LandingPageContent />, { locale, selectedCountry: "CO" });

    const link = screen.getByRole("link", { name });
    expect(link.getAttribute("href")).toBe(href);
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("links to the methodology", async () => {
    await renderLanding(<LandingPageContent />, { locale: "en", selectedCountry: "CO" });

    expect(screen.getByRole("link", { name: "How it works" }).getAttribute("href")).toBe(
      "/en/documentation"
    );
    expect(
      screen.getByRole("link", { name: "See layers by country" }).getAttribute("href")
    ).toBe("/en/documentation#layers");
  });
});
