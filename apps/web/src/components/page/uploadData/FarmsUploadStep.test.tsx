import { fireEvent, render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { createTestI18n } from "@/test/i18n";
import { FarmRow } from "@/interfaces/FarmRow";
import { ExcelSource, ManualSource, UploadSource } from "@/utils/uploadSources";
import { FarmsUploadStep } from "./FarmsUploadStep";
import { UploadSourcesState } from "./useUploadSources";

// The drawing modal needs Google Maps; these tests only open the methods.
vi.mock("./manualFarm/ManualFarmModal", () => ({
  ManualFarmModal: () => <div data-testid="manual-farm-modal" />,
}));

const row = (id: string, geometryType = "Polygon"): FarmRow => ({
  id,
  producerName: "Ana",
  geometryType,
  farmCoordinates: "POINT (0 0)",
  documents: [],
});

const excel = (rows: FarmRow[]): ExcelSource => ({
  kind: "excel",
  key: "excel-1",
  name: "fincas.xlsx",
  file: new File([""], "fincas.xlsx"),
  readFor: "CO",
  rows,
  errorMessages: [],
  withoutCoordinates: false,
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

describe("FarmsUploadStep", () => {
  it("shows one method at a time, with its steps and its control", async () => {
    await renderStep(uploadState());

    expect(method(/Plantilla Excel/).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Descarga la plantilla.")).toBeTruthy();
    expect(screen.getByText(".xlsx o .xls")).toBeTruthy();

    fireEvent.click(method(/Dibujar en el mapa/));

    expect(method(/Plantilla Excel/).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByText("Descarga la plantilla.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Abrir mapa" }));
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
    expect(onSubmit).toHaveBeenCalledWith([
      row("F1"),
      row("F2"),
      row("F3", "Point"),
      row("F4"),
    ]);
  });
});
