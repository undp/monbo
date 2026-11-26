import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { readPublicFile, toFile } from "@/test/files";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import { inTimeZone, TIME_ZONES } from "@/test/timeZone";
import { shortFormatDateByLanguage } from "./dates";
import { getUploadFileTemplatePath, loadExcelFileFarmsData } from "./excel";

// The upload templates users download (public/files/), read the way the upload page
// reads them. The API's regression suite checks the same files.

const LOCALES: TestLocale[] = ["es", "en"];
const COUNTRY = "CR";
const POLYGON = "[[[-84.37,10.14],[-84.36,10.14],[-84.36,10.15],[-84.37,10.14]]]";
const PRODUCTION_DATE = new Date(2024, 10, 25);

const templateBytes = (locale: TestLocale) =>
  readPublicFile(getUploadFileTemplatePath(locale).replace(/^\//, ""));

// One farm row, in the templates' column order (row 2), with a distinct value per
// column so a column the parser doesn't recognize shows up as a missing value.
const FARM_ROW = [
  "F01",
  "Ana Pérez",
  PRODUCTION_DATE,
  48.5,
  "kg",
  "Alajuela",
  "GeoJSON",
  "Polygon",
  POLYGON,
  6.71,
  "Café Arábica",
  "Cooperativa Tierra de Sabores",
  "Declaración Jurada",
  "https://example.org/declaracion",
  "Permiso de uso de tierras",
  "https://example.org/permiso",
];

/** The template with the farm row after the example row, as an uploaded file. */
const filledTemplate = (
  locale: TestLocale,
  edit: (sheet: XLSX.WorkSheet) => void = () => {}
) => {
  const workbook = XLSX.read(templateBytes(locale), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  XLSX.utils.sheet_add_aoa(sheet, [FARM_ROW], { origin: "A4", cellDates: true });
  edit(sheet);
  const bytes: ArrayBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return toFile(bytes, `farms-${locale}.xlsx`);
};

const load = async (file: File, locale: TestLocale) => {
  const { t } = await createTestI18n(locale);
  return loadExcelFileFarmsData(file, t, locale, COUNTRY);
};

describe.each(LOCALES)("the %s upload template", (locale) => {
  it("parses empty: the example row is not a farm", async () => {
    const file = toFile(templateBytes(locale), `template-${locale}.xlsx`);
    expect(await load(file, locale)).toEqual({
      data: [],
      errorMessages: [],
      rowProblems: [],
      rowsWithCoordinates: 0,
    });
  });

  it("maps every column of a filled row", async () => {
    const { data, errorMessages } = await load(filledTemplate(locale), locale);

    expect(errorMessages).toEqual([]);
    expect(data).toHaveLength(1);
    const [farm] = data;
    expect(farm).toEqual({
      id: "F01",
      producerName: "Ana Pérez",
      productionDate: farm.productionDate,
      productionQuantity: 48.5,
      productionQuantityUnit: "kg",
      region: "Alajuela",
      coordinatesFormat: "GeoJSON",
      geometryType: "Polygon",
      farmCoordinates: POLYGON,
      area: 6.71,
      cropType: "Café Arábica",
      association: "Cooperativa Tierra de Sabores",
      documents: [
        { name: "Declaración Jurada", url: "https://example.org/declaracion" },
        { name: "Permiso de uso de tierras", url: "https://example.org/permiso" },
      ],
    });
    // An ISO string for the same local day the cell holds.
    expect(new Date(farm.productionDate as string).getTime()).toBe(
      PRODUCTION_DATE.getTime()
    );
  });

  it("doesn't recognize a renamed header", async () => {
    const file = filledTemplate(locale, (sheet) => {
      sheet["B2"] = { t: "s", v: "Productor" };
    });
    const { data, errorMessages } = await load(file, locale);

    expect(data[0]).not.toHaveProperty("producerName");
    expect(errorMessages).toHaveLength(1);
  });
});

describe.each(TIME_ZONES)("an uploaded production date in %s", (zone) => {
  inTimeZone(zone);

  const shownDate = async (edit: (sheet: XLSX.WorkSheet) => void) => {
    const { data } = await load(filledTemplate("es", edit), "es");
    return shortFormatDateByLanguage(data[0].productionDate as string, "es");
  };

  it("is the day of a date cell", async () => {
    const shown = await shownDate((sheet) => {
      // Built here, after the zone is set: a date cell holds a local day.
      XLSX.utils.sheet_add_aoa(sheet, [[new Date(2025, 0, 15)]], {
        origin: "C4",
        cellDates: true,
      });
    });
    expect(shown).toBe("15-01-2025");
  });

  it("is the day of a text cell, as in regression_farms.xlsx", async () => {
    const shown = await shownDate((sheet) => {
      sheet["C4"] = { t: "s", v: "2025-01-15" };
    });
    expect(shown).toBe("15-01-2025");
  });
});
