import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { DataContext } from "@/context/DataContext";
import type { ValidateFarmsResponse } from "@/interfaces/PolygonValidation";
import { makeFarm } from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import { router, setPathname, setSearchParams } from "@/test/navigation";
import { makeDataContext } from "@/test/renderWithData";
import { ValidationKpis } from "./ValidationKpis";

const RESULTS: ValidateFarmsResponse = {
  farmResults: [
    { farmId: "A", status: "VALID" },
    { farmId: "B", status: "NOT_VALID" },
    { farmId: "C", status: "NOT_VALID" },
    { farmId: "D", status: "VALID_MANUALLY" },
  ],
  inconsistencies: [
    {
      type: "overlap",
      farmIds: ["B", "D"],
      data: {
        area: 100,
        center: { lat: 0, lng: 0 },
        parts: [],
        percentage: 0.1,
        criticality: "MEDIUM",
      },
    },
    { type: "empty_polygon", farmIds: ["C"], data: null },
  ],
};

const renderKpis = async () => {
  const i18n = await createTestI18n("es");
  render(
    <I18nextProvider i18n={i18n}>
      <DataContext.Provider
        value={makeDataContext({
          farmsData: ["A", "B", "C", "D"].map((id) => makeFarm({ id })),
          polygonsValidationResults: RESULTS,
        })}
      >
        <ValidationKpis />
      </DataContext.Provider>
    </I18nextProvider>
  );
};

const card = (label: RegExp) => screen.getByRole("button", { name: label });

describe("ValidationKpis", () => {
  it("counts the polygons ready, overlapping and with a geometry error", async () => {
    await renderKpis();

    expect(card(/listos para analizar/).textContent).toMatch(/^2/);
    expect(card(/se superponen/).textContent).toMatch(/^1/);
    expect(card(/error de geometría/).textContent).toMatch(/^1/);
  });

  it("filters the table by a card, and a second press removes the filter", async () => {
    setPathname("/es/polygons-validation");
    setSearchParams({ search: "B" });
    await renderKpis();

    fireEvent.click(card(/se superponen/));
    expect(router.replace).toHaveBeenLastCalledWith(
      "/es/polygons-validation?search=B&status=overlap",
      { scroll: false }
    );
  });

  it("marks the active card, and pressing it shows all the polygons again", async () => {
    setPathname("/es/polygons-validation");
    setSearchParams({ status: "error" });
    await renderKpis();

    expect(card(/error de geometría/).getAttribute("aria-pressed")).toBe("true");
    expect(card(/listos para analizar/).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(card(/error de geometría/));
    expect(router.replace).toHaveBeenLastCalledWith("/es/polygons-validation?", {
      scroll: false,
    });
  });
});
