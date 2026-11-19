import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { setRuntimeConfig } from "@/config/runtime";
import { DataContext } from "@/context/DataContext";
import type { FarmData } from "@/interfaces/Farm";
import type {
  InconsistentPolygonData,
  ValidateFarmsResponse,
} from "@/interfaces/PolygonValidation";
import { makeFarm } from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import { router, setPathname, setSearchParams } from "@/test/navigation";
import { makeDataContext } from "@/test/renderWithData";
import type { ManualSource, UploadSource } from "@/utils/uploadSources";
import { ValidationResultsTable } from "./ValidationResultsTable";

// The modals draw on Google Maps; these tests read their lists and controls.
vi.mock("@/components/reusable/Map", () => ({
  Map: () => <div data-testid="map" />,
}));

const overlap = (a: string, b: string, area = 1200): InconsistentPolygonData => ({
  type: "overlap",
  farmIds: [a, b],
  data: {
    area,
    center: { lat: 0, lng: 0 },
    parts: [],
    percentage: 0.4,
    criticality: "MEDIUM",
  },
});

const FARMS: FarmData[] = [
  makeFarm({
    id: "CO-001",
    producer: "Ana Gómez",
    origin: { method: "excel", fileName: "fincas.xlsx" },
  }),
  makeFarm({ id: "CO-003", producer: "Coop. Río" }),
  makeFarm({ id: "CO-006", producer: "Luis Pérez" }),
  makeFarm({
    id: "CO-007",
    producer: "Marta Díaz",
    origin: { method: "manual", fileName: null },
  }),
  makeFarm({
    id: "CO-005",
    producer: "Jorge Ruiz",
    polygon: { type: "polygon", area: null, details: null },
  }),
  makeFarm({
    id: "CO-008",
    producer: "Rosa León",
    polygon: { type: "point", area: 35.93, details: { center: { lat: 0, lng: 0 }, radius: 3 } },
  }),
  makeFarm({
    id: "CO-009",
    producer: "Pedro Soto",
    polygon: { type: "polygon", area: -1, details: null },
  }),
];

const RESULTS: ValidateFarmsResponse = {
  farmResults: [
    { farmId: "CO-001", status: "VALID" },
    { farmId: "CO-003", status: "NOT_VALID" },
    { farmId: "CO-006", status: "NOT_VALID" },
    { farmId: "CO-007", status: "NOT_VALID" },
    { farmId: "CO-005", status: "NOT_VALID" },
    { farmId: "CO-008", status: "VALID" },
    { farmId: "CO-009", status: "NOT_VALID" },
  ],
  inconsistencies: [
    overlap("CO-003", "CO-006", 1200),
    overlap("CO-007", "CO-006", 800),
    { type: "empty_polygon", farmIds: ["CO-005"], data: null },
    {
      type: "invalid_geometry",
      farmIds: ["CO-009"],
      data: { reason: "Self-intersection[0 0]" },
    },
  ],
};

/** The table over a real results state, so a manual validation shows up. */
const FLOW_LIST: UploadSource[] = [
  { kind: "manual", key: "drawn-1", row: {} as ManualSource["row"] },
];

/** The flow's upload list: kept, emptied after the farms were parsed from it, or none. */
type ListState = "kept" | "emptied" | "none";

const Harness = ({ list }: { list: ListState }) => {
  const [results, setResults] = useState<ValidateFarmsResponse | null>(RESULTS);
  return (
    <DataContext.Provider
      value={makeDataContext({
        farmsData: FARMS,
        polygonsValidationResults: results,
        setPolygonsValidationResults: setResults,
        uploadSources: list === "kept" ? FLOW_LIST : [],
        farmsSourcesRevision: list === "none" ? null : 3,
      })}
    >
      <ValidationResultsTable />
    </DataContext.Provider>
  );
};

const renderTable = async ({ list = "kept" as ListState } = {}) => {
  const i18n = await createTestI18n("es");
  render(
    <I18nextProvider i18n={i18n}>
      <Harness list={list} />
    </I18nextProvider>
  );
};

/** The results row of a farm; also while a modal hides the page behind it. */
const rowOf = (id: string) =>
  screen
    .getAllByRole("row", { hidden: true })
    .find(
      (row) =>
        !row.closest('[role="dialog"]') &&
        row.closest("tbody") &&
        within(row).queryByText(id)
    )!;

describe("ValidationResultsTable", () => {
  it("shows every farm in one table, without tabs, with its status", async () => {
    await renderTable();

    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(within(rowOf("CO-001")).getByText("Listo")).toBeTruthy();
    expect(within(rowOf("CO-001")).queryByRole("button", { name: /Revisar/ })).toBeNull();
    expect(within(rowOf("CO-003")).getByText("Se superpone con CO-006")).toBeTruthy();
    expect(within(rowOf("CO-006")).getByText("Se superpone con 2 polígonos")).toBeTruthy();
    expect(within(rowOf("CO-005")).getByText("El polígono no tiene vértices")).toBeTruthy();
  });

  it("shows the area after the validation, and its origin", async () => {
    await renderTable();

    expect(within(rowOf("CO-001")).getByText("1 ha")).toBeTruthy();
    expect(within(rowOf("CO-001")).getByText("fincas.xlsx")).toBeTruthy();
    expect(within(rowOf("CO-007")).getByText("Dibujo")).toBeTruthy();
    // Without area or origin
    expect(within(rowOf("CO-005")).getAllByText("—")).toHaveLength(2);
    // A small polygon in m², not "0 ha"; an area that failed is not a number
    expect(within(rowOf("CO-008")).getByText("36 m²")).toBeTruthy();
    expect(within(rowOf("CO-009")).getAllByText("—")).toHaveLength(2);
  });

  it("validates a farm with two neighbours from its review", async () => {
    // The overlap percentages are shown against the API's threshold
    setRuntimeConfig({ deforestationThresholdPercentage: 1, overlapThresholdPercentage: 1 });
    await renderTable();

    fireEvent.click(screen.getByRole("button", { name: "Revisar CO-006" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Superposiciones de CO-006")).toBeTruthy();
    expect(within(dialog).getByText("CO-003")).toBeTruthy();
    expect(within(dialog).getByText("CO-007")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Validar CO-006 manualmente" }));

    expect(within(rowOf("CO-006")).getByText("Validado manualmente")).toBeTruthy();
    // The neighbours keep their own status
    expect(within(rowOf("CO-003")).getByText("Se superpone con CO-006")).toBeTruthy();
  });

  it("opens a geometry error without a manual validation", async () => {
    await renderTable();

    fireEvent.click(screen.getByRole("button", { name: "Revisar CO-005" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("checkbox")).toBeNull();
  });

  it("filters by the search", async () => {
    setSearchParams({ search: "Marta" });
    await renderTable();

    expect(screen.getByText("CO-007")).toBeTruthy();
    expect(screen.queryByText("CO-001")).toBeNull();
  });

  it("titles the results with what they hold", async () => {
    await renderTable();

    expect(screen.getByRole("heading", { name: "Resultado de la validación" })).toBeTruthy();
    expect(screen.getByText("7 elementos · 2 polígonos y 5 puntos")).toBeTruthy();
  });

  it("shows only the farms of the summary card chosen, until all are asked for", async () => {
    setPathname("/es/polygons-validation");
    setSearchParams({ status: "overlap", search: "Marta" });
    await renderTable();

    // The overlapping farms, narrowed by the search
    expect(rowOf("CO-007")).toBeTruthy();
    expect(screen.queryByText("Ana Gómez")).toBeNull();
    expect(screen.queryByText("Coop. Río")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Mostrar todos" }));

    // The search stays
    expect(router.replace).toHaveBeenCalledWith(
      "/es/polygons-validation?search=Marta",
      { scroll: false }
    );
  });

  it("goes back to the upload list to add more polygons, without starting over", async () => {
    await renderTable();

    fireEvent.click(screen.getByRole("button", { name: "Agregar más polígonos" }));

    expect(router.push).toHaveBeenCalledWith("/polygons-validation/upload-data");
  });

  it("doesn't offer to add polygons to farms that came from no list", async () => {
    // There is no list to go back to: an empty one would replace them all
    await renderTable({ list: "none" });

    expect(screen.queryByRole("button", { name: "Agregar más polígonos" })).toBeNull();
  });

  it("still offers to add polygons after the list they came from was emptied", async () => {
    await renderTable({ list: "emptied" });

    expect(screen.getByRole("button", { name: "Agregar más polígonos" })).toBeTruthy();
  });

  it("scrolls the rows inside the frame only, so the header stays in view", async () => {
    await renderTable();

    const frame = screen.getByTestId("results-frame");
    const container = frame.querySelector(".MuiTableContainer-root")!;
    expect(getComputedStyle(frame).overflow).toBe("auto");
    expect(getComputedStyle(container).overflowX).toBe("visible");
    expect(getComputedStyle(container).overflowY).toBe("visible");
  });
});
