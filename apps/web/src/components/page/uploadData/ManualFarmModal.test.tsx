import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { createTestI18n } from "@/test/i18n";
import { FarmRow } from "@/interfaces/FarmRow";
import { getCountryBounds } from "@/utils/countryBounds";
import type { DrawingMapProps } from "./DrawingMap";
import { ManualFarmModal } from "./ManualFarmModal";
import {
  parseLocaleNumber,
  validateManualFarm,
  emptyValues,
} from "./ManualFarmModalForm";

// jsdom has no Google Maps: the map is replaced by a stub that records its props,
// and the tests play the map's events through them.
let mapProps: DrawingMapProps | null = null;
vi.mock("./DrawingMap", () => ({
  DrawingMap: (props: DrawingMapProps) => {
    mapProps = props;
    return <div data-testid="drawing-map" />;
  },
}));

const map = () => {
  if (!mapProps) throw new Error("The map isn't mounted");
  return mapProps;
};

const p = (lng: number, lat: number) => ({ lat, lng });
const square = [p(-70, -33), p(-69.99, -33), p(-69.99, -32.99), p(-70, -32.99)];
const squareCoordinates =
  "[[[-70,-33],[-69.99,-33],[-69.99,-32.99],[-70,-32.99],[-70,-33]]]";

const renderModal = async (
  props: Partial<React.ComponentProps<typeof ManualFarmModal>> = {}
) => {
  mapProps = null;
  const i18n = await createTestI18n("es");
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <ManualFarmModal
        open
        country="CL"
        onCancel={onCancel}
        onSave={onSave}
        {...props}
      />
    </I18nextProvider>
  );
  // The map mounts once the Dialog has opened
  await screen.findByTestId("drawing-map");
  return { onSave, onCancel };
};

const field = (label: RegExp) =>
  screen.getByLabelText(label) as HTMLInputElement;

const type = (label: RegExp, value: string) =>
  fireEvent.change(field(label), { target: { value } });

const fillMandatoryFields = () => {
  type(/^Nombre productor/, "Juana Pérez");
  type(/^Fecha producción/, "2024-05-01");
  type(/^Cantidad producción/, "1.200,5");
  type(/^Unidad cantidad producción/, "kg");
  type(/^Tipo de cultivo/, "Café");
};

const drawSquare = () => {
  square.forEach((vertex) => act(() => map().onMapClick(vertex)));
  // A click on the first vertex closes the polygon
  act(() => map().onVertexClick(0));
};

const addButton = () => screen.getByRole("button", { name: "Agregar" });

describe("ManualFarmModal", () => {
  it("opens the map on the selected country", async () => {
    await renderModal();
    expect(map().initialBounds).toEqual(getCountryBounds("CL"));
  });

  it("adds a drawn polygon as a GeoJSON row", async () => {
    const { onSave } = await renderModal();
    expect(addButton()).toHaveProperty("disabled", true);

    drawSquare();
    expect(map().drawing).toEqual({
      type: "polygon",
      vertices: square,
      closed: true,
    });
    expect(addButton()).toHaveProperty("disabled", false);

    fillMandatoryFields();
    type(/^ID/, " F-1 ");
    fireEvent.click(addButton());

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0]).toEqual({
      id: "F-1",
      producerName: "Juana Pérez",
      // Local midnight, as the Excel loader writes a date
      productionDate: new Date(2024, 4, 1).toISOString(),
      productionQuantity: 1200.5,
      productionQuantityUnit: "kg",
      region: null,
      association: null,
      cropType: "Café",
      coordinatesFormat: "GeoJSON",
      geometryType: "Polygon",
      farmCoordinates: squareCoordinates,
      area: null,
      documents: [],
    } satisfies FarmRow);
  });

  it("rejects a vertex that makes the edges cross", async () => {
    await renderModal();
    square.slice(0, 3).forEach((vertex) => act(() => map().onMapClick(vertex)));
    // From the third vertex back below the first edge
    act(() => map().onMapClick(p(-69.995, -33.01)));

    expect(
      screen.getByText(/haría que los bordes del polígono se crucen/)
    ).toBeTruthy();
    expect(map().drawing).toEqual({
      type: "polygon",
      vertices: square.slice(0, 3),
      closed: false,
    });
  });

  it("undoes a dragged vertex that would cross, and keeps one that doesn't", async () => {
    await renderModal();
    drawSquare();

    let accepted = true;
    act(() => {
      accepted = map().onPathEdit({
        kind: "move",
        index: 2,
        position: p(-69.995, -33.01),
      });
    });
    expect(accepted).toBe(false);
    expect(map().drawing).toMatchObject({ vertices: square });

    act(() => {
      accepted = map().onPathEdit({
        kind: "move",
        index: 2,
        position: p(-69.98, -32.98),
      });
    });
    expect(accepted).toBe(true);
    expect(map().drawing).toMatchObject({
      vertices: [square[0], square[1], p(-69.98, -32.98), square[3]],
    });
  });

  it("deletes a vertex on right-click, keeping at least 3", async () => {
    await renderModal();
    drawSquare();

    act(() => map().onVertexRightClick(1));
    expect(map().drawing).toMatchObject({
      vertices: [square[0], square[2], square[3]],
    });

    act(() => map().onVertexRightClick(0));
    expect(screen.getByText(/necesita al menos 3 vértices/)).toBeTruthy();
    expect(map().drawing).toMatchObject({
      vertices: [square[0], square[2], square[3]],
    });
  });

  it("lists the vertices' coordinates as they are drawn", async () => {
    await renderModal();
    const list = () =>
      within(screen.getByRole("region", { name: /^Vértices del polígono/ }));

    act(() => map().onMapClick(square[0]));
    act(() => map().onMapClick(square[1]));
    expect(
      screen.getByRole("heading", { name: "Vértices del polígono (2)" })
    ).toBeTruthy();
    const rows = list().getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      "1-33.000000-70.000000",
      "2-33.000000-69.990000",
    ]);

    act(() => map().onMapClick(square[2]));
    act(() => map().onMapClick(square[3]));
    act(() => map().onVertexClick(0));
    act(() =>
      map().onPathEdit({ kind: "move", index: 2, position: p(-69.98, -32.98) })
    );
    expect(list().getAllByRole("row")[3].textContent).toBe(
      "3-32.980000-69.980000"
    );
  });

  it("selects a closed polygon's vertex from its row", async () => {
    await renderModal();
    drawSquare();
    const rows = within(
      screen.getByRole("region", { name: /^Vértices del polígono/ })
    ).getAllByRole("row");

    fireEvent.click(rows[2]);
    expect(map().selectedVertex).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Borrar vértice" }));
    expect(map().drawing).toMatchObject({
      vertices: [square[0], square[2], square[3]],
    });
  });

  it("shows a point's coordinates", async () => {
    await renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Punto" }));
    act(() => map().onMapClick(p(-84.0023, 9.8783)));

    const rows = within(
      screen.getByRole("region", { name: "Centro del punto" })
    ).getAllByRole("row");
    expect(rows.slice(1).map((row) => row.textContent)).toEqual([
      "9.878300-84.002300",
    ]);
  });

  it("adds a point with its area, and draws the circle of that area", async () => {
    const { onSave } = await renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Punto" }));
    act(() => map().onMapClick(p(-84.0023, 9.8783)));

    fillMandatoryFields();
    type(/^Superficie \[hectáreas\]/, "2,5");
    // r = sqrt(25,000 m² / π)
    expect(map().radius).toBe(89.21);
    fireEvent.click(addButton());

    expect(onSave.mock.calls[0][0]).toMatchObject({
      coordinatesFormat: "GeoJSON",
      geometryType: "Point",
      farmCoordinates: "[-84.0023,9.8783]",
      area: 2.5,
    });
  });

  it("marks the missing and invalid fields, and doesn't add the farm", async () => {
    const { onSave } = await renderModal();
    drawSquare();
    fillMandatoryFields();
    type(/^Tipo de cultivo/, "  ");
    type(/^Cantidad producción/, "1.2.3");
    fireEvent.click(screen.getByRole("button", { name: "Agregar documento" }));
    type(/^Enlace documento 1/, "drive/file.pdf");
    fireEvent.click(addButton());

    expect(onSave).not.toHaveBeenCalled();
    expect(field(/^Tipo de cultivo/).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Dato obligatorio")).toBeTruthy();
    expect(
      screen.getByText("Escribe un número, por ejemplo 1.200,5")
    ).toBeTruthy();
    expect(screen.getByText(/empiece con http:\/\/ o https:\/\//)).toBeTruthy();

    // Fixing a field clears its mark
    type(/^Tipo de cultivo/, "Café");
    expect(field(/^Tipo de cultivo/).getAttribute("aria-invalid")).toBe(
      "false"
    );
  });

  it("needs a point's area", async () => {
    const { onSave } = await renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Punto" }));
    act(() => map().onMapClick(p(-84, 9.8)));
    fillMandatoryFields();
    fireEvent.click(addButton());

    expect(onSave).not.toHaveBeenCalled();
    expect(field(/^Superficie/).getAttribute("aria-invalid")).toBe("true");
  });

  it("loads a listed farm, and saves its new geometry with its data", async () => {
    const initialRow: FarmRow = {
      id: "F-1",
      producerName: "Juana Pérez",
      productionDate: new Date(2024, 4, 1).toISOString(),
      productionQuantity: 1200.5,
      productionQuantityUnit: "kg",
      region: "Maule",
      association: null,
      cropType: "Café",
      coordinatesFormat: "GeoJSON",
      geometryType: "Polygon",
      farmCoordinates: squareCoordinates,
      area: null,
      documents: [{ name: "Título", url: "https://example.org/t.pdf" }],
    };
    const { onSave } = await renderModal({ initialRow });

    expect(screen.getByText("Editar finca")).toBeTruthy();
    expect(field(/^Nombre productor/).value).toBe("Juana Pérez");
    expect(field(/^Fecha producción/).value).toBe("2024-05-01");
    expect(field(/^Cantidad producción/).value).toBe("1200,5");
    expect(field(/^Enlace documento 1/).value).toBe(
      "https://example.org/t.pdf"
    );
    expect(map().drawing).toEqual({
      type: "polygon",
      vertices: square,
      closed: true,
    });
    // The map opens on the farm, not on the country
    expect(map().initialBounds).toMatchObject({ west: -70, east: -69.99 });

    act(() => {
      map().onPathEdit({ kind: "move", index: 2, position: p(-69.98, -32.98) });
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0]).toEqual({
      ...initialRow,
      farmCoordinates:
        "[[[-70,-33],[-69.99,-33],[-69.98,-32.98],[-70,-32.99],[-70,-33]]]",
    });
  });

  it("keeps a listed farm's data when its geometry can't be edited", async () => {
    await renderModal({
      initialRow: {
        producerName: "Juana Pérez",
        coordinatesFormat: "WKT",
        geometryType: "Polygon",
        farmCoordinates: "POLYGON((0 0, 1 0, 1 1, 0 0))",
        documents: [],
      },
    });
    expect(screen.getByText(/no tiene coordenadas GeoJSON/)).toBeTruthy();
    expect(field(/^Nombre productor/).value).toBe("Juana Pérez");
    expect(map().drawing).toBeNull();
    expect(screen.getByRole("button", { name: "Guardar" })).toHaveProperty(
      "disabled",
      true
    );
  });

  it("opens a larger animation of how to draw from its button", async () => {
    await renderModal();
    const animation = () => screen.queryByAltText(/^Animación: se hace clic/);
    expect(animation()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "¿Cómo dibujar?" }));
    expect(animation()?.getAttribute("src")).toBe(
      "/images/manual-farm-drawing-es.gif"
    );
    expect(screen.getByText(/Presiona «Cerrar polígono»/)).toBeTruthy();
  });

  it("adds vertices at typed coordinates", async () => {
    const { onSave } = await renderModal();
    const addPoint = () =>
      fireEvent.click(screen.getByRole("button", { name: "Agregar punto" }));
    const typePosition = ({ lat, lng }: { lat: number; lng: number }) => {
      type(/^Latitud/, String(lat).replace(".", ","));
      type(/^Longitud/, String(lng));
    };

    typePosition(square[0]);
    addPoint();
    // The first one zooms in on it, and the fields empty for the next one
    expect(map().focus).toMatchObject({ center: square[0], keepZoom: false });
    expect(field(/^Latitud/).value).toBe("");

    square.slice(1).forEach((vertex) => {
      typePosition(vertex);
      addPoint();
    });
    expect(map().focus).toMatchObject({ center: square[3], keepZoom: true });
    expect(map().drawing).toMatchObject({ vertices: square, closed: false });

    // One that crosses an edge is rejected, and stays typed to fix it
    typePosition(p(-69.995, -33.01));
    addPoint();
    expect(screen.getByText(/bordes del polígono se crucen/)).toBeTruthy();
    expect(field(/^Longitud/).value).toBe("-69.995");
    expect(map().drawing).toMatchObject({ vertices: square });

    fireEvent.click(screen.getByRole("button", { name: "Cerrar polígono" }));
    expect(
      screen.getByRole("button", { name: "Agregar punto" })
    ).toHaveProperty("disabled", true);
    fillMandatoryFields();
    fireEvent.click(addButton());
    expect(onSave.mock.calls[0][0]).toMatchObject({
      farmCoordinates: squareCoordinates,
    });
  });

  it("places a point at typed coordinates", async () => {
    await renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Punto" }));
    type(/^Latitud/, "9,8783");
    type(/^Longitud/, "-84.0023");
    fireEvent.click(screen.getByRole("button", { name: "Agregar punto" }));
    expect(map().drawing).toEqual({
      type: "point",
      center: p(-84.0023, 9.8783),
    });

    type(/^Latitud/, "95");
    type(/^Longitud/, "-84");
    fireEvent.click(screen.getByRole("button", { name: "Agregar punto" }));
    expect(screen.getByText(/latitud entre -90 y 90/)).toBeTruthy();
    expect(map().drawing).toMatchObject({ center: p(-84.0023, 9.8783) });
  });

  it("goes to typed coordinates", async () => {
    await renderModal();
    type(/^Latitud/, "-33,45");
    type(/^Longitud/, "-70.66");
    fireEvent.click(screen.getByRole("button", { name: "Ir" }));
    expect(map().focus?.center).toEqual({ lat: -33.45, lng: -70.66 });

    type(/^Latitud/, "-120");
    fireEvent.click(screen.getByRole("button", { name: "Ir" }));
    expect(screen.getByText(/latitud entre -90 y 90/)).toBeTruthy();
  });
});

describe("parseLocaleNumber", () => {
  it("reads numbers as the API does, by language", () => {
    expect(parseLocaleNumber("1.234,5", "es")).toBe(1234.5);
    expect(parseLocaleNumber("2,5", "es")).toBe(2.5);
    expect(parseLocaleNumber("1,234.5", "en")).toBe(1234.5);
    expect(parseLocaleNumber("2.5", "en")).toBe(2.5);
    // Ambiguous or malformed
    expect(parseLocaleNumber("2.5", "es")).toBeNull();
    expect(parseLocaleNumber("1,2,3", "en")).toBeNull();
    expect(parseLocaleNumber("abc", "es")).toBeNull();
  });
});

describe("validateManualFarm", () => {
  it("needs a finished drawing", async () => {
    const i18n = await createTestI18n("es");
    const result = validateManualFarm({
      values: emptyValues(),
      drawing: { type: "polygon", vertices: square, closed: false },
      t: i18n.t,
      language: "es",
    });
    expect(result.row).toBeNull();
    expect(result.missingGeometry).toBe(true);
    expect(Object.keys(result.fieldErrors).sort()).toEqual([
      "cropType",
      "producerName",
      "productionDate",
      "productionQuantity",
      "productionQuantityUnit",
    ]);
  });
});
