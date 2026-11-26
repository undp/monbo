import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import { createTestI18n } from "@/test/i18n";
import { inTimeZone, TIME_ZONES } from "@/test/timeZone";
import { shortFormatDateByLanguage } from "@/utils/dates";
import { emptyValues, validateManualFarm } from "./ManualFarmModalForm";

describe.each(TIME_ZONES)("a manual farm's production date in %s", (zone) => {
  inTimeZone(zone);

  it("is the day picked in the date input", async () => {
    const t = (await createTestI18n("es")).getFixedT("es") as TFunction;
    const { row, fieldErrors } = validateManualFarm({
      values: {
        ...emptyValues(),
        producerName: "Ana Pérez",
        productionDate: "2025-01-15",
        productionQuantity: "100",
        productionQuantityUnit: "kg",
        cropType: "Café",
        area: "1",
      },
      drawing: { type: "point", center: { lat: 10.1, lng: -84.3 } },
      t,
      language: "es",
    });

    expect(fieldErrors).toEqual({});
    expect(shortFormatDateByLanguage(row!.productionDate!, "es")).toBe(
      "15-01-2025"
    );
  });
});
