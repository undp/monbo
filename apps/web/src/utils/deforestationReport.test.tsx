import { beforeEach, describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import { setRuntimeConfig } from "@/config/runtime";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import {
  makeCategory,
  makeFarm,
  makeFrontierCategory,
  makeMap,
  makeMapResults,
} from "@/test/factories";
import {
  findAll,
  pagesText,
  pdfTree,
  textOf,
  type PdfNode,
} from "@/test/pdfTree";
import type { DeforestationAnalysisMapResults } from "@/interfaces/DeforestationAnalysis";
import type { FarmData } from "@/interfaces/Farm";
import type { LayerCategory } from "@/interfaces/LayerCategory";
import { DeforestationReportDocument } from "./deforestationReport";
import {
  LONGEST_WHOLE_WORD,
  referenceLines,
  reportWordParts,
} from "./deforestationReport/wordBreaks";
import { LayerScopePages, REPORT_ANCHORS } from "./deforestationReport/sections";
import { Considerations } from "./deforestationReport/considerations";

const tFor = async (locale: TestLocale) =>
  (await createTestI18n(locale)).getFixedT(locale) as TFunction;

const deforestation = makeCategory({ thresholdPercentage: 2 });
const frontier = makeFrontierCategory();
const protectedAreas = makeCategory({
  id: "protected_areas",
  name: { es: "Áreas protegidas", en: "Protected areas" },
  description: {
    es: "Superficie dentro de un área protegida.",
    en: "Area inside a protected area.",
  },
  icon: "shield",
  color: "#1565c0",
  thresholdPercentage: 0,
  resultLabels: {
    ok: { es: "Fuera de áreas protegidas", en: "Outside protected areas" },
    flagged: { es: "En área protegida", en: "In a protected area" },
  },
  temporal: false,
});
const CATEGORIES = [deforestation, protectedAreas, frontier];

const gfw = makeMap({ id: 1, name: "Global Forest Watch", alias: "GFW" });
const tmf = makeMap({ id: 2, name: "Tropical Moist Forest", alias: "TMF" });
const runap = makeMap({
  id: 3,
  name: "RUNAP",
  alias: "RUNAP",
  categoryId: "protected_areas",
  baseline: null,
  comparedAgainst: null,
  contentDate: "2024",
});
const upra = makeMap({
  id: 4,
  name: "Frontera agrícola UPRA",
  alias: "UPRA",
  categoryId: "agricultural_frontier",
  baseline: null,
  comparedAgainst: null,
  contentDate: "2023",
});
const MAPS = [gfw, tmf, runap, upra];

const F01 = makeFarm({ id: "F01", association: "Cooperativa del Sur" });
const F02 = makeFarm({ id: "F02" });
// Every result null: still has its sheet
const F03 = makeFarm({ id: "F03", polygon: { ...F01.polygon, area: -1 } });

const RESULTS = [
  makeMapResults(4, { F01: 0.82, F02: 1, F03: null }),
  makeMapResults(1, { F01: 0, F02: 0.05, F03: null }),
  makeMapResults(2, { F01: null, F02: 0, F03: null }),
  makeMapResults(3, { F01: 0, F02: 0, F03: null }),
];

const renderReport = async ({
  locale = "es",
  farms = [F01, F02, F03],
  results = RESULTS,
  categories = CATEGORIES,
  satelliteBackground = false,
}: {
  locale?: TestLocale;
  farms?: FarmData[];
  results?: DeforestationAnalysisMapResults[];
  categories?: LayerCategory[];
  satelliteBackground?: boolean;
} = {}) =>
  DeforestationReportDocument({
    farmsData: farms,
    deforestationAnalysisResults: results,
    mapsData: MAPS,
    categories,
    images: farms.flatMap((farm) =>
      MAPS.map((map) => ({
        mapId: map.id,
        farmId: farm.id,
        url: `blob:${farm.id}-${map.id}`,
      }))
    ),
    satelliteBackground,
    t: await tFor(locale),
    language: locale,
  });

beforeEach(() => {
  setRuntimeConfig({
    deforestationThresholdPercentage: 2,
    overlapThresholdPercentage: 1,
  });
});

describe("the report's cover", () => {
  it("lists the categories and the index, and shows no result", async () => {
    const [cover] = pagesText(await renderReport());

    expect(cover).toContain("Reporte de análisis territorial");
    expect(cover).toContain("Polígonos : 3");
    expect(cover).toContain("Deforestación · 2 capas");
    expect(cover).toContain("Áreas protegidas · 1 capa");
    expect(cover).toContain("Frontera agrícola · 1 capa");
    expect(cover).toContain("2. Metodología");
    expect(cover).not.toMatch(/%/);
    for (const category of CATEGORIES) {
      expect(cover).not.toContain(category.resultLabels.ok.es);
      expect(cover).not.toContain(category.resultLabels.flagged.es);
    }
    expect(cover).not.toContain("Sin dato");
  });

  it("links its index to the sections", async () => {
    const tree = pdfTree(await renderReport());
    const [cover] = findAll(tree, "PAGE");
    const links = findAll(cover.children, "LINK").map(({ props }) => props.src);
    expect(links).toEqual(
      Object.values(REPORT_ANCHORS).map((anchor) => `#${anchor}`)
    );
    const ids = findAll(tree, "VIEW").map(({ props }) => props.id);
    for (const anchor of Object.values(REPORT_ANCHORS))
      expect(ids.filter((id) => id === anchor)).toHaveLength(1);
  });
});

describe("a farm's sheet", () => {
  const sheetOf = (pages: string[], farmId: string) =>
    pages.find(
      (page) =>
        page.startsWith("FICHA DEL POLÍGONO") && page.includes(`n°${farmId}`)
    )!;

  it("groups the results by category, in the API's order", async () => {
    const sheet = sheetOf(pagesText(await renderReport()), "F01");

    const order = ["Deforestación", "Áreas protegidas", "Frontera agrícola"].map(
      (name) => sheet.indexOf(name, sheet.indexOf("Resultados por categoría"))
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // 18% outside the agricultural frontier (required, threshold 5)
    expect(sheet).toMatch(/UPRA\) 2023 Hallazgo 18% FUERA DE LA FRONTERA AGRÍCOLA/);
    expect(sheet).toContain("1 de 3 categorías sin observaciones");
  });

  it("shows a null result as No data, without a finding", async () => {
    const sheet = sheetOf(pagesText(await renderReport()), "F01");
    expect(sheet).toMatch(/Tropical Moist Forest \(TMF\) 2020–2023 SIN DATO/);
    // Deforestation has no flagged layer but one without data: not "free"
    expect(sheet).toMatch(/Deforestación SIN DATO/);
  });

  it("keeps a farm whose every result is null", async () => {
    const pages = pagesText(await renderReport());
    const sheet = sheetOf(pages, "F03");
    expect(sheet).toContain("0 de 3 categorías sin observaciones");
    expect(sheet.match(/SIN DATO/g)).toHaveLength(3 + 4);
    // An area that could not be computed is not a value
    expect(sheet).toContain("Superficie total (ha) N/D");
    // No map page for it
    expect(pages.filter((page) => page.includes("n°F03"))).toHaveLength(1);
  });

  it("reads in English with the categories' English labels", async () => {
    const pages = pagesText(await renderReport({ locale: "en" }));
    const sheet = pages.find((page) => page.startsWith("POLYGON SHEET"))!;
    expect(sheet).toContain("Results by category");
    expect(sheet).toContain("OUTSIDE THE AGRICULTURAL FRONTIER");
    expect(sheet).toContain("NO DATA");
  });
});

describe("the map pages", () => {
  it("are one per layer with a result, titled with category and layer", async () => {
    const pages = pagesText(await renderReport());
    const maps = pages.filter((page) => page.startsWith("MAPA DE LA CAPA"));
    // F01: 3 layers with a result (TMF is null); F02: 4; F03: none
    expect(maps).toHaveLength(7);
    expect(maps.filter((page) => page.includes("n°F01"))).toHaveLength(3);
    expect(maps[0]).toMatch(/Deforestación Global Forest Watch/);
  });

  it("mention satellite imagery only when the maps have it", async () => {
    const without = pagesText(await renderReport());
    expect(without.join(" ")).not.toContain("Google Maps");

    const withSatellite = pagesText(
      await renderReport({ satelliteBackground: true })
    ).filter((page) => page.startsWith("MAPA DE LA CAPA"));
    expect(
      withSatellite.every((page) =>
        page.includes("La imagen satelital de Google Maps es referencial")
      )
    ).toBe(true);
  });
});

describe("the methodology", () => {
  it("explains each category of the report, with its threshold and labels", async () => {
    const page = pagesText(await renderReport()).find((p) =>
      p.startsWith("METODOLOGÍA")
    )!;
    expect(page).toContain("Área total del polígono");
    expect(page).toMatch(
      /Frontera agrícola No coincidir con la capa Zonas donde se permite la producción agropecuaria\. 5% DENTRO DE LA FRONTERA AGRÍCOLA FUERA DE LA FRONTERA AGRÍCOLA/
    );
    expect(page).toMatch(/Deforestación Coincidir con la capa/);
    expect(page).toContain("RUNAP Áreas protegidas");
  });
});

describe("the scope and limits pages", () => {
  it("cover every selected layer, also one whose results are all null", async () => {
    const pages = pagesText(
      await renderReport({
        results: [...RESULTS.slice(1), makeMapResults(4, { F01: null })],
        farms: [F01],
      })
    ).filter((page) => page.startsWith("ALCANCES Y LÍMITES DE LAS CAPAS"));
    expect(pages).toHaveLength(4);
    expect(pages.at(-1)).toContain("Categoría : Frontera agrícola");
  });
});

describe("a layer whose category is unknown", () => {
  it("is No data, under No category, and never classified", async () => {
    const pages = pagesText(
      await renderReport({ categories: [deforestation], farms: [F01] })
    );
    const sheet = pages.find((page) => page.startsWith("FICHA DEL POLÍGONO"))!;
    expect(sheet).toMatch(/Sin categoría SIN DATO/);
    expect(sheet).not.toContain("FUERA DE LA FRONTERA");
    expect(pages[0]).toContain("Sin categoría · 2 capas");
  });
});

describe("a layer's considerations", () => {
  it("keep a heading bold, and bold and italic only where marked", () => {
    const tree = pdfTree(
      Considerations({ considerations: "### Scope\n- Plain **bold** _italic_" })
    );
    const [heading, ...rest] = findAll(tree, "TEXT");
    expect(heading.props.style).toMatchObject({ fontWeight: 700 });
    // Its plain segment doesn't override the heading's weight
    expect(findAll(heading.children, "TEXT")[0].props.style).toEqual({});
    const styles = rest.map(({ props }) => props.style);
    expect(styles).toContainEqual({ fontWeight: "bold" });
    expect(styles).toContainEqual({ fontStyle: "italic" });
  });
});

describe("the report's word breaks", () => {
  it("keeps Spanish and English words whole", () => {
    for (const word of ["protegida", "identifica", "Deforestación", "Consideraciones"])
      expect(reportWordParts(word)).toEqual([word]);
  });

  it("splits a long URL after its separators, in parts that fit a cell", () => {
    const url =
      "https://glad.earthengine.app/view/global-forest-change#bl=off;old=off;dl=1;lon=20;lat=10;zoom=3;";
    const parts = reportWordParts(url);
    expect(parts.join("")).toBe(url);
    expect(parts.length).toBeGreaterThan(3);
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(24);
    // Each break falls right after a separator of the URL, never after a "-"
    // (react-pdf adds its own "-" at a break: it would read "--")
    for (const part of parts.slice(0, -1)) expect(part).toMatch(/[/?#&;=.]$/);
    expect(parts.some((part) => part.includes("global-forest-change#"))).toBe(true);
  });

  it("cuts a long word without separators in fixed parts", () => {
    const id = "a".repeat(45);
    expect(reportWordParts(id)).toEqual(["a".repeat(24), "a".repeat(21)]);
  });
});

describe("a layer's references", () => {
  const drive =
    "https://drive.google.com/drive/folders/1_4Y_tGth6FSJl32VlAeq8kX5lhP1GUlf";
  const gfwUrl =
    "https://glad.earthengine.app/view/global-forest-change#bl=off;old=off;dl=1;lon=20;lat=10;zoom=3;";

  it("print exactly as the URL, in lines react-pdf never breaks", () => {
    for (const url of [drive, gfwUrl, "https://short.example/x"]) {
      const lines = referenceLines(url);
      expect(lines.join("")).toBe(url);
      // Whole words for react-pdf (reportWordParts): no break, so no "-" added
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(LONGEST_WHOLE_WORD);
        expect(reportWordParts(line)).toEqual([line]);
      }
    }
  });

  it("link every printed line to the whole URL", async () => {
    const t = await tFor("es");
    const layer = makeMap({ id: 3, references: [drive, gfwUrl] });
    const tree = pdfTree(
      LayerScopePages({
        groups: [
          {
            category: makeCategory(),
            layers: [
              {
                id: 3,
                categoryId: "deforestation",
                map: layer,
                category: makeCategory(),
                results: makeMapResults(3, {}),
              },
            ],
          },
        ],
        t,
        language: "es",
      })
    );
    const links = findAll(tree, "LINK").filter(({ props }) =>
      [drive, gfwUrl].includes(props.src as string)
    );
    const printed = (url: string) =>
      links
        .filter(({ props }) => props.src === url)
        .map(({ children }) => children.join(""))
        .join("");
    expect(printed(drive)).toBe(drive);
    expect(printed(gfwUrl)).toBe(gfwUrl);
    expect(links.length).toBeGreaterThan(2);
  });
});

describe("a sublist or a heading in the considerations", () => {
  /** The considerations' top-level elements: blocks and single lines. */
  const topLevel = (considerations: string) =>
    pdfTree(Considerations({ considerations })) as PdfNode[];

  it("keeps the item that opens a sublist with its first sub-item", () => {
    const [block, ipcc, last] = topLevel(
      "- Differences with other definitions:\n  - FAO\n  - IPCC\n- Last item"
    );
    expect(block.props.wrap).toBe(false);
    expect(textOf(block.children)).toBe("• Differences with other definitions: • FAO");
    expect(textOf([ipcc])).toBe("• IPCC");
    expect(textOf([last])).toBe("• Last item");
  });

  it("keeps a heading with the line under it, past empty lines", () => {
    const [block, rest] = topLevel(
      "### Scope\n\n- Under the heading\n- Next"
    );
    expect(block.props.wrap).toBe(false);
    expect(textOf(block.children)).toBe("Scope • Under the heading");
    expect(textOf([rest])).toBe("• Next");
  });

  it("keeps the section's title with the first block", () => {
    const [first, rest] = pdfTree(
      Considerations({
        considerations: "### Scope\n- One\n- Two",
        title: "Considerations",
      })
    ) as PdfNode[];
    expect(first.props.wrap).toBe(false);
    expect(textOf(first.children)).toBe("Considerations Scope • One");
    expect(textOf([rest])).toBe("• Two");
  });

  it("chains a heading with an item that opens a sublist", () => {
    const [block, rest] = topLevel("### Scope\n- Kinds:\n  - One\n  - Two");
    expect(textOf(block.children)).toBe("Scope • Kinds: • One");
    expect(textOf([rest])).toBe("• Two");
  });
});
