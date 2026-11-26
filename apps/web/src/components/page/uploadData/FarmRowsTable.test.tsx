import { fireEvent, render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { FarmRow } from "@/interfaces/FarmRow";
import { createTestI18n } from "@/test/i18n";
import { NO_ROW_PROBLEMS } from "@/utils/rowProblems";
import { ExcelSource, ManualSource, UploadSource } from "@/utils/uploadSources";
import { FarmRowsTable } from "./FarmRowsTable";

const row = (id: string): FarmRow => ({
  id,
  producerName: "Ana",
  cropType: "Cacao",
  productionQuantity: 48.5,
  productionQuantityUnit: "kg",
  geometryType: "Polygon",
  farmCoordinates: "POINT (0 0)",
  documents: [],
});

const ERROR = "El polígono no es válido";

const excel = (removedRows: number[]): ExcelSource => ({
  kind: "excel",
  key: "excel-1",
  removedRows,
  name: "fincas.xlsx",
  file: new File([""], "fincas.xlsx"),
  readFor: "CO",
  rows: [row("F01"), row("F02"), row("F03")],
  errorMessages: [ERROR],
  rowProblems: [
    NO_ROW_PROBLEMS,
    { otherCountry: null, errors: [ERROR], missing: [] },
    NO_ROW_PROBLEMS,
  ],
  withoutCoordinates: false,
});

const manual = (): ManualSource => ({
  kind: "manual",
  key: "manual-1",
  row: row("M01"),
});

const renderTable = async (sources: UploadSource[]) => {
  const i18n = await createTestI18n("es");
  render(
    <I18nextProvider i18n={i18n}>
      <FarmRowsTable sources={sources} onRemoveRow={vi.fn()} onEdit={vi.fn()} />
    </I18nextProvider>
  );
};

const rowOf = (id: string) => screen.getByText(id).closest("tr") as HTMLElement;

describe("FarmRowsTable's row problems", () => {
  it("marks the row that has the problem, by its own position in the file", async () => {
    await renderTable([excel([0])]);

    const mark = within(rowOf("F02")).getByRole("img");
    expect(mark.getAttribute("aria-label")).toBe(`Problemas de F02: ${ERROR}`);
    expect(within(rowOf("F03")).queryByRole("img")).toBeNull();

    fireEvent.mouseOver(mark);
    expect((await screen.findByRole("tooltip")).textContent).toContain(ERROR);
  });

  it("shows no mark on a drawn farm", async () => {
    await renderTable([manual()]);

    expect(screen.getByText("M01")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
