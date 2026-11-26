import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { DataContext, type DataContextValue } from "@/context/DataContext";
import type { MapData } from "@/interfaces/LayerAnalysis";
import { makeMap } from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import { makeDataContext } from "@/test/renderWithData";
import { MapsDetailsModal } from "./MapsDetailsModal";

const contextWith = (selectedMaps: MapData[]): DataContextValue =>
  makeDataContext({
    territorialAnalysisParams: { polygonsSubset: "all", selectedMaps },
  });

const renderModal = async (selectedMaps: MapData[]) => {
  const i18n = await createTestI18n("es");
  const tree = (maps: MapData[]) => (
    <I18nextProvider i18n={i18n}>
      <DataContext.Provider value={contextWith(maps)}>
        <MapsDetailsModal open onClose={vi.fn()} />
      </DataContext.Provider>
    </I18nextProvider>
  );
  const { rerender } = render(tree(selectedMaps));
  return { rerenderWith: (maps: MapData[]) => rerender(tree(maps)) };
};

const first = makeMap({ id: 1, name: "Uno", alias: "Áreas test", source: "Fuente ES" });
const second = makeMap({ id: 2, name: "Dos", alias: "Segunda", source: "Segunda fuente" });
const firstEn = { ...first, alias: "Test areas", source: "Source EN" };
const secondEn = { ...second, alias: "Second", source: "Second source" };

describe("MapsDetailsModal", () => {
  it("shows the refreshed texts of the layer without a click", async () => {
    const { rerenderWith } = await renderModal([first]);
    expect(screen.getByText("Fuente ES")).toBeTruthy();

    rerenderWith([firstEn]);

    expect(screen.getByText("Source EN")).toBeTruthy();
    expect(screen.queryByText("Fuente ES")).toBeNull();
  });

  it("keeps the layer chosen by a click across a refresh", async () => {
    const { rerenderWith } = await renderModal([first, second]);
    fireEvent.click(screen.getByRole("radio", { name: /Segunda/ }));
    expect(screen.getByText("Segunda fuente")).toBeTruthy();

    rerenderWith([firstEn, secondEn]);

    expect(screen.getByText("Second source")).toBeTruthy();
    expect(screen.queryByText("Source EN")).toBeNull();
  });

  it("moves the choice with the arrow keys", async () => {
    await renderModal([first, second]);

    fireEvent.keyDown(screen.getByRole("radio", { name: /Uno/ }), {
      key: "ArrowRight",
    });

    expect(screen.getByText("Segunda fuente")).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: /Dos/ }).getAttribute("aria-checked")
    ).toBe("true");
  });

  it("falls back to the first layer when the chosen one leaves", async () => {
    const { rerenderWith } = await renderModal([first, second]);
    fireEvent.click(screen.getByRole("radio", { name: /Segunda/ }));

    rerenderWith([first]);

    expect(screen.getByText("Fuente ES")).toBeTruthy();
  });
});
