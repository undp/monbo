import { fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMaps } from "@/api/layerAnalysis";
import { getLayerCategories } from "@/api/layerCategories";
import theme from "@/config/theme";
import { setRuntimeConfig } from "@/config/runtime";
import { DataContext, type DataContextValue } from "@/context/DataContext";
import type { MapData } from "@/interfaces/DeforestationAnalysis";
import type { LayerCategory } from "@/interfaces/LayerCategory";
import { makeLayerCategory, makeMap } from "@/test/factories";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import { makeDataContext } from "@/test/renderWithData";
import type { DocumentationContent } from "@/utils/documentation";
import { MethodologyDocument } from "./MethodologyDocument";

vi.mock("@/api/layerAnalysis", () => ({ getMaps: vi.fn() }));
vi.mock("@/api/layerCategories", () => ({ getLayerCategories: vi.fn() }));

const section = (title: string, body = "") =>
  `## ${title}\n\n:::summary\n- The point of ${title}.\n:::\n\n${body}`;

const CONTENT: DocumentationContent = {
  calculation: section(
    "Calculation",
    "Visible text at 10:30.\n\n:::details[More detail: the formula]\nAbove {{deforestationThreshold}}, step by step.\n:::\n"
  ),
  categories: section("Categories"),
  layers: section("Layers"),
  limits: section("Limits"),
  upload: section("Upload"),
  validation: section("Validation"),
  area: section("Area"),
};

const deforestation = makeLayerCategory({ thresholdPercentage: 2 });
const protectedAreas = makeLayerCategory({
  id: "protected_areas",
  name: { es: "Áreas protegidas", en: "Protected areas" },
  description: { es: "Zonas protegidas por ley.", en: "Areas protected by law." },
  icon: "shield",
  color: "#0f7c86",
  polarity: "avoid",
  thresholdPercentage: 0.5,
  resultLabels: {
    ok: { es: "Fuera de áreas protegidas", en: "Outside protected areas" },
    flagged: { es: "En área protegida", en: "In a protected area" },
  },
  temporal: false,
});

const CATALOG: Record<string, { categories: LayerCategory[]; maps: MapData[] }> = {
  CO: {
    categories: [deforestation, protectedAreas],
    maps: [
      makeMap({ id: 0, name: "Global Forest Watch", alias: "GFW 2020-2023", country: "CO", coverage: "Global", contentDate: null, baseline: 2020, comparedAgainst: 2023, considerations: "### Límites\n\nNo distingue plantaciones. <b>negrita</b>", references: ["https://glad.example.org", "javascript:alert(1)"] }),
      makeMap({ id: 3, name: "IDEAM", alias: null, country: "CO", coverage: "Colombia", source: "Instituto de Hidrología", resolution: "30 x 30 metros", updateFrequency: "Anual" }),
    ],
  },
  EC: {
    categories: [deforestation],
    maps: [makeMap({ id: 2, name: "MAATE", country: "EC", coverage: "Ecuador", considerations: null })],
  },
  CR: { categories: [deforestation], maps: [] },
};

beforeEach(() => {
  vi.mocked(getLayerCategories).mockReset().mockImplementation(async (country) => CATALOG[country].categories);
  vi.mocked(getMaps).mockReset().mockImplementation(async (_language, country) => CATALOG[country!].maps);
});

const renderDocument = async (
  locale: TestLocale = "es",
  context: Partial<DataContextValue> = {}
) => {
  setRuntimeConfig({
    overlapThresholdPercentage: 1,
    deforestationThresholdPercentage: 2,
  });
  const i18n = await createTestI18n(locale);
  const value = makeDataContext({
    availableCountries: ["CO", "CR", "EC"],
    availableCountriesLoaded: true,
    ...context,
  });
  render(
    <ThemeProvider theme={theme}>
      <I18nextProvider i18n={i18n}>
        <DataContext.Provider value={value}>
          <MethodologyDocument content={CONTENT} />
        </DataContext.Provider>
      </I18nextProvider>
    </ThemeProvider>
  );
  return value;
};

const layersSection = () => document.getElementById("layers")!;
const limitsSection = () => document.getElementById("limits")!;

describe("MethodologyDocument", () => {
  it("lists the seven sections in the index, in order", async () => {
    await renderDocument();

    const index = screen.getByRole("navigation");
    const links = [...index.querySelectorAll("a")].map((a) => [
      a.textContent,
      a.getAttribute("href"),
    ]);
    expect(links).toEqual([
      ["Calculation", "#calculation"],
      ["Categories", "#categories"],
      ["Layers", "#layers"],
      ["Limits", "#limits"],
      ["Upload", "#upload"],
      ["Validation", "#validation"],
      ["Area", "#area"],
    ]);
  });

  it("shows the methodology's title in the page's language", async () => {
    await renderDocument("en");
    expect(screen.getByRole("heading", { level: 1, name: "How Monbo works" })).toBeTruthy();
  });

  it("keeps the former deforestation anchor on the calculation section", async () => {
    await renderDocument();

    const anchor = document.getElementById("deforestation");
    expect(anchor).not.toBeNull();
    expect(anchor!.closest("section")!.id).toBe("calculation");
  });

  it("goes to the URL's anchor once the page renders", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    window.location.hash = "#layers";
    try {
      await renderDocument();

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("layers"));
    } finally {
      window.location.hash = "";
    }
  });

  it("titles each summary in the page's language", async () => {
    await renderDocument("es");
    expect(screen.getAllByText("En resumen")).toHaveLength(7);
  });

  it("titles the summaries in English", async () => {
    await renderDocument("en");
    expect(screen.getAllByText("In short")).toHaveLength(7);
  });

  it("keeps a details block closed until it is clicked", async () => {
    await renderDocument();

    const toggle = screen.getByRole("button", { name: "More detail: the formula" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("opens a details block from the keyboard", async () => {
    await renderDocument();

    // A native <button> in the tab order: the browser turns Enter and Space into
    // a click (jsdom doesn't, so the app run checks the keys themselves).
    const toggle = screen.getByRole("button", { name: "More detail: the formula" });
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle.getAttribute("tabindex")).not.toBe("-1");
    toggle.focus();
    expect(document.activeElement).toBe(toggle);
  });

  it("fills in a threshold inside a details block", async () => {
    await renderDocument("en");
    expect(screen.getByText("Above 2%, step by step.", { exact: false })).toBeTruthy();
  });

  it("keeps text that looks like a directive", async () => {
    await renderDocument();
    expect(screen.getByText("Visible text at 10:30.")).toBeTruthy();
  });
});

describe("MethodologyDocument layers by country", () => {
  it("shows a tab per country, sorted by name, with its silhouette", async () => {
    await renderDocument();

    const tabs = within(layersSection()).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Colombia", "Costa Rica", "Ecuador"]);
    for (const tab of tabs) expect(tab.querySelector("svg path")).not.toBeNull();
  });

  it("selects the session's country first", async () => {
    await renderDocument("es", { selectedCountry: "EC" });

    expect(
      within(layersSection()).getByRole("tab", { name: "Ecuador" }).getAttribute("aria-selected")
    ).toBe("true");
    expect(await within(layersSection()).findByText("MAATE")).toBeTruthy();
  });

  it("starts on the first country without a session country", async () => {
    await renderDocument();

    expect(
      within(layersSection()).getByRole("tab", { name: "Colombia" }).getAttribute("aria-selected")
    ).toBe("true");
  });

  it("groups the layers under their categories, in the API's order", async () => {
    await renderDocument();

    const deforestationBlock = await within(layersSection()).findByRole("region", { name: "Deforestación" });
    const protectedBlock = within(layersSection()).getByRole("region", { name: "Áreas protegidas" });
    expect(within(deforestationBlock).getByText("Global Forest Watch")).toBeTruthy();
    expect(within(deforestationBlock).getByText("IDEAM")).toBeTruthy();
    expect(within(protectedBlock).getByText("Todavía no hay capas publicadas en esta categoría.")).toBeTruthy();
    expect(
      deforestationBlock.compareDocumentPosition(protectedBlock) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(getLayerCategories).toHaveBeenCalledWith("CO");
    expect(getMaps).toHaveBeenCalledWith("es", "CO");
  });

  it("explains each category's polarity, threshold and results", async () => {
    await renderDocument();

    const block = await within(layersSection()).findByRole("region", { name: "Áreas protegidas" });
    expect(within(block).getByText("Zonas protegidas por ley.")).toBeTruthy();
    expect(within(block).getByText(/Marca lo que se debe evitar/)).toBeTruthy();
    expect(within(block).getByText("Umbral: 0,5%")).toBeTruthy();
    expect(within(block).getByText(/Fuera de áreas protegidas · 0,5% o menos/)).toBeTruthy();
    expect(within(block).getByText(/En área protegida · más de 0,5%/)).toBeTruthy();
  });

  it("shows each layer's coverage, source, period, resolution and update frequency", async () => {
    await renderDocument();

    const row = (await within(layersSection()).findByText("IDEAM")).closest("tr")!;
    const cells = [...row.querySelectorAll("td")].map((cell) => [
      cell.getAttribute("data-label"),
      cell.textContent,
    ]);
    expect(cells).toEqual([
      ["Capa", "IDEAM"],
      ["Cobertura", "Colombia"],
      ["Fuente", "Instituto de Hidrología"],
      ["Período", "2020–2023"],
      ["Resolución", "30 x 30 metros"],
      ["Actualización", "Anual"],
    ]);
  });

  it("switches tabs without changing the session's country", async () => {
    const context = await renderDocument("es", { selectedCountry: "CO" });
    await within(layersSection()).findByText("IDEAM");

    fireEvent.click(within(layersSection()).getByRole("tab", { name: "Ecuador" }));

    expect(await within(layersSection()).findByText("MAATE")).toBeTruthy();
    expect(within(layersSection()).queryByText("IDEAM")).toBeNull();
    expect(context.setSelectedCountry).not.toHaveBeenCalled();
    expect(within(limitsSection()).getByText("Capas de Ecuador")).toBeTruthy();
  });

  it("shows an error with a retry, and keeps the rest of the page", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getMaps).mockRejectedValueOnce(new Error("down"));
    await renderDocument();
    consoleError.mockRestore();

    const [alert] = await within(layersSection()).findAllByRole("alert");
    expect(alert.textContent).toContain("No pudimos cargar las capas de Colombia.");
    expect(screen.getByText("Visible text at 10:30.")).toBeTruthy();

    fireEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));

    expect(await within(layersSection()).findByText("IDEAM")).toBeTruthy();
  });

  it("says when a country has no published layers", async () => {
    await renderDocument("es", { selectedCountry: "CR" });

    expect(
      await within(limitsSection()).findByText("Costa Rica todavía no tiene capas publicadas.")
    ).toBeTruthy();
  });
});

describe("MethodologyDocument scope and limits", () => {
  it("shows a layer's considerations and references once opened", async () => {
    await renderDocument();

    const toggle = await within(limitsSection()).findByRole("button", { name: /Global Forest Watch/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);

    expect(await within(limitsSection()).findByRole("heading", { name: "Límites" })).toBeTruthy();
    const link = within(limitsSection()).getByRole("link", { name: "https://glad.example.org" });
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("shows HTML and non-web references as text", async () => {
    await renderDocument();

    fireEvent.click(await within(limitsSection()).findByRole("button", { name: /Global Forest Watch/ }));

    const considerations = await within(limitsSection()).findByText(/No distingue plantaciones/);
    expect(considerations.querySelector("b")).toBeNull();
    expect(within(limitsSection()).getByText("javascript:alert(1)").tagName).toBe("SPAN");
  });

  it("says when a layer has no considerations", async () => {
    await renderDocument("es", { selectedCountry: "EC" });

    fireEvent.click(await within(limitsSection()).findByRole("button", { name: /MAATE/ }));

    expect(
      await within(limitsSection()).findByText("Esta capa no tiene consideraciones publicadas.")
    ).toBeTruthy();
  });
});
