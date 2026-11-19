import { fireEvent, render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { createTestI18n } from "@/test/i18n";
import { FarmRow } from "@/interfaces/FarmRow";
import {
  ExcelSource,
  GeoSource,
  ManualSource,
  UploadSource,
} from "@/utils/uploadSources";
import { FarmsUploadStep } from "./FarmsUploadStep";
import { UploadSourcesState } from "./useUploadSources";

// The drawing modal needs Google Maps; these tests only open the methods.
vi.mock("./manualFarm/ManualFarmModal", () => ({
  ManualFarmModal: () => <div data-testid="manual-farm-modal" />,
}));

const row = (id: string, geometryType = "Polygon"): FarmRow => ({
  id,
  producerName: "Ana",
  cropType: "Cacao",
  productionQuantity: 48.5,
  productionQuantityUnit: "kg",
  geometryType,
  farmCoordinates: "POINT (0 0)",
  documents: [],
});

const excel = (rows: FarmRow[]): ExcelSource => ({
  kind: "excel",
  key: "excel-1",
  removedRows: [],
  name: "fincas.xlsx",
  file: new File([""], "fincas.xlsx"),
  readFor: "CO",
  rows,
  errorMessages: [],
  withoutCoordinates: false,
});

const kmzMissingData = (): GeoSource => ({
  kind: "geo",
  key: "geo-1",
  removedRows: [],
  name: "lotes.kmz",
  file: new File([""], "lotes.kmz"),
  readFor: "CO",
  geoFile: { format: "kmz", features: [] },
  attributeRows: [],
  attributeErrors: ["Falta el productor"],
  attributeMissing: { attributes: ["producerName"], features: 12 },
  excel: null,
});

const manual = (farm: FarmRow): ManualSource => ({
  kind: "manual",
  key: "manual-1",
  row: farm,
});

const uploadState = (sources: UploadSource[] = []): UploadSourcesState => ({
  sources,
  reading: false,
  addExcelFiles: vi.fn(),
  addGeoFiles: vi.fn(),
  addGeoFileWithExcel: vi.fn(),
  attach: vi.fn(),
  detach: vi.fn(),
  remove: vi.fn(),
  removeAll: vi.fn(),
  removeRow: vi.fn(),
  saveManual: vi.fn(),
  notifyErrors: vi.fn(),
});

const renderStep = async (
  upload: UploadSourcesState,
  props: Partial<React.ComponentProps<typeof FarmsUploadStep>> = {}
) => {
  const i18n = await createTestI18n("es");
  const onSubmit = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <FarmsUploadStep
        variant="page"
        upload={upload}
        country="CO"
        submitLabel="Validar polígonos"
        onSubmit={onSubmit}
        {...props}
      />
    </I18nextProvider>
  );
  return { onSubmit };
};

const method = (name: RegExp) => screen.getByRole("button", { name });
const drawArea = () =>
  screen.getByRole("button", {
    name: "Dibuja un polígono o marca un punto en el mapa",
  });

describe("FarmsUploadStep", () => {
  it("shows one method at a time, with its steps and its control", async () => {
    await renderStep(uploadState());

    expect(method(/Plantilla Excel/).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Descarga la plantilla.")).toBeTruthy();
    expect(screen.getByText(".xlsx o .xls")).toBeTruthy();

    fireEvent.click(method(/Dibujar en el mapa/));

    expect(method(/Plantilla Excel/).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByText("Descarga la plantilla.")).toBeNull();
    fireEvent.click(drawArea());
    expect(screen.getByTestId("manual-farm-modal")).toBeTruthy();
  });

  it("opens the map from anywhere in the drawing area, also with the keyboard", async () => {
    await renderStep(uploadState());
    fireEvent.click(method(/Dibujar en el mapa/));

    const area = drawArea();
    // One native button, so Enter and Space open it, and nothing nested inside
    expect(area.tagName).toBe("BUTTON");
    expect(within(area).queryByRole("button")).toBeNull();
    area.focus();
    expect(document.activeElement).toBe(area);
    fireEvent.click(within(area).getByText("Abrir mapa"));

    expect(screen.getByTestId("manual-farm-modal")).toBeTruthy();
  });

  it("opens the accepted fields from the geo file method", async () => {
    await renderStep(uploadState());

    fireEvent.click(method(/^Archivo geográfico(?! \+)/));

    expect(screen.getByText(".geojson, .kml, .kmz o .zip (Shapefile)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Campos aceptados" })).toBeTruthy();
  });

  it("starts with an empty list and no submit bar", async () => {
    await renderStep(uploadState());

    const list = screen.getByRole("region", { name: "Polígonos y puntos cargados" });
    expect(within(list).getByText("Aún no hay elementos.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Quitar todos" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Validar polígonos/ })).toBeNull();
  });

  it("counts what each method loaded and submits every row", async () => {
    const upload = uploadState([
      excel([row("F1"), row("F2"), row("F3", "Point")]),
      manual(row("F4")),
    ]);
    const { onSubmit } = await renderStep(upload);

    expect(within(method(/Plantilla Excel/)).getByText("3 cargados")).toBeTruthy();
    expect(within(method(/Dibujar en el mapa/)).getByText("1 cargado")).toBeTruthy();
    expect(within(method(/Archivo geográfico \+ Excel/)).queryByText(/cargado/)).toBeNull();
    expect(screen.getByText("4 fincas: 3 polígonos y 1 punto")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Quitar todos" }));
    expect(upload.removeAll).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: /Validar polígonos/ }));
    const excelOrigin = { method: "excel", fileName: "fincas.xlsx" };
    expect(onSubmit).toHaveBeenCalledWith([
      { ...row("F1"), origin: excelOrigin },
      { ...row("F2"), origin: excelOrigin },
      { ...row("F3", "Point"), origin: excelOrigin },
      { ...row("F4"), origin: { method: "manual", fileName: null } },
    ]);
  });

  it("lists one row per farm, with its data, its origin and a delete button", async () => {
    const source = excel([row("F1"), row("F2", "Point")]);
    const drawn = manual({ ...row("F4"), producerName: "José" });
    const upload = uploadState([source, drawn]);
    await renderStep(upload);

    const table = screen.getByRole("table", { name: "Polígonos y puntos cargados" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((tr) => within(tr).getAllByRole("cell").slice(0, 6).map((td) => td.textContent))).toEqual([
      ["F1", "Ana", "Cacao", "48,5 kg", "Polígono", "fincas.xlsx"],
      ["F2", "Ana", "Cacao", "48,5 kg", "Punto", "fincas.xlsx"],
      ["F4", "José", "Cacao", "48,5 kg", "Polígono", "Dibujo"],
    ]);
    // Only the drawn farm can be edited
    expect(within(table).getAllByRole("button", { name: /^Editar/ })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Quitar F2 de la lista" }));
    expect(upload.removeRow).toHaveBeenCalledWith(source, 1);
  });

  it("puts only the rows in view in the page when the list is long", async () => {
    // jsdom lays nothing out: a 520 px frame, and rows of one line each
    const frame = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(520);
    const line = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(53);
    const rows = Array.from({ length: 2000 }, (_, index) => row(`F${index + 1}`));
    await renderStep(uploadState([excel(rows)]));
    frame.mockRestore();
    line.mockRestore();

    const table = screen.getByRole("table", { name: "Polígonos y puntos cargados" });
    const shown = within(table)
      .getAllByRole("row")
      .filter((tr) => tr.getAttribute("aria-rowindex") && tr.closest("tbody"));
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(100);
    expect(within(shown[0]).getByText("F1")).toBeTruthy();
    // Screen readers still hear how many there are
    expect(table.getAttribute("aria-rowcount")).toBe("2001");
  });

  it("shows a file's problem and its actions above the rows", async () => {
    const upload = uploadState([kmzMissingData()]);
    await renderStep(upload);

    const notice = screen.getByRole("alert");
    expect(notice.textContent).toContain("lotes.kmz");
    expect(notice.textContent).toContain("12");
    fireEvent.click(within(notice).getByRole("button", { name: "Quitar archivo: lotes.kmz" }));
    expect(upload.remove).toHaveBeenCalledOnce();
    expect(within(notice).getByRole("button", { name: "Adjuntar Excel de producción: lotes.kmz" })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
