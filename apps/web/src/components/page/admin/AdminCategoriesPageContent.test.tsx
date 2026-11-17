import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAdminCategories, setAdminCategoryEnabled } from "@/api/adminCategories";
import { listAdminLayers } from "@/api/adminLayers";
import { setRuntimeConfig } from "@/config/runtime";
import theme from "@/config/theme";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import type { AdminCategories } from "@/interfaces/AdminLayer";
import { makeAdminCategory, makeAdminLayer } from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import { AdminCategoriesPageContent } from "./AdminCategoriesPageContent";

vi.mock("@/api/adminCategories", () => ({
  listAdminCategories: vi.fn(),
  setAdminCategoryEnabled: vi.fn(),
  createAdminCategory: vi.fn(),
  updateAdminCategory: vi.fn(),
}));
vi.mock("@/api/adminLayers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/adminLayers")>()),
  listAdminLayers: vi.fn(),
}));

const session = { token: "t", expiresAt: "2099-01-01T00:00:00Z", country: "CO" };
const openSnackbar = vi.fn();

const frontier = makeAdminCategory({
  id: "frontier",
  name: { es: "Frontera agrícola", en: "Agricultural frontier" },
  polarity: "required",
  temporal: false,
  thresholdPercentage: 5,
});

const renderPage = async (categories: AdminCategories) => {
  vi.mocked(listAdminCategories).mockResolvedValue(categories);
  const i18n = await createTestI18n("en");
  render(
    // The result chips read the app theme's palette.
    <ThemeProvider theme={theme}>
      <I18nextProvider i18n={i18n}>
        <AdminSessionContext.Provider
          value={{
            session,
            ready: true,
            login: vi.fn(),
            logout: vi.fn(),
            withToken: (call) => call("token"),
          }}
        >
          <SnackbarContext.Provider value={{ openSnackbar }}>
            <AdminCategoriesPageContent />
          </SnackbarContext.Provider>
        </AdminSessionContext.Provider>
      </I18nextProvider>
    </ThemeProvider>
  );
};

const card = (name: string) => within(screen.getByRole("article", { name }));

beforeEach(() => {
  setRuntimeConfig({ deforestationThresholdPercentage: 1, overlapThresholdPercentage: 1 });
  vi.mocked(listAdminLayers).mockResolvedValue([makeAdminLayer()]);
});

describe("AdminCategoriesPageContent", () => {
  it("shows each category with its rule, threshold and results", async () => {
    await renderPage({
      categories: [makeAdminCategory({ layerCount: 1, publishedLayerCount: 1 }), frontier],
      readable: true,
      errors: [],
    });
    await screen.findByRole("article", { name: "Deforestation" });
    expect(card("Deforestation").getByText("Global threshold: 1%")).toBeTruthy();
    expect(card("Agricultural frontier").getByText("Threshold: 5%")).toBeTruthy();
    expect(
      card("Agricultural frontier").getByText(
        "Marks what is allowed: falling outside the layer is a finding."
      )
    ).toBeTruthy();
    expect(card("Agricultural frontier").getByText("No layers yet.")).toBeTruthy();
  });

  it("locks the switch of a category with published layers, naming them", async () => {
    await renderPage({
      categories: [makeAdminCategory({ layerCount: 1, publishedLayerCount: 1 })],
      readable: true,
      errors: [],
    });
    const deforestation = within(await screen.findByRole("article", { name: "Deforestation" }));
    expect(
      (deforestation.getByRole("switch") as HTMLInputElement).disabled
    ).toBe(true);
    expect(
      await deforestation.findByText(
        "It has published layers (IDEAM 2020-2023). Hide them to enable or disable the category."
      )
    ).toBeTruthy();
  });

  it("disables an empty category", async () => {
    vi.mocked(setAdminCategoryEnabled).mockResolvedValue({ ...frontier, enabled: false });
    await renderPage({ categories: [makeAdminCategory(), frontier], readable: true, errors: [] });
    const switchInput = await screen.findByRole("switch", {
      name: "Enable the category Agricultural frontier",
    });
    fireEvent.click(switchInput);
    await waitFor(() =>
      expect(setAdminCategoryEnabled).toHaveBeenCalledWith("token", "frontier", false)
    );
    expect(await card("Agricultural frontier").findAllByText("Disabled")).not.toHaveLength(0);
  });

  it("offers no writes when the categories file can't be read", async () => {
    await renderPage({
      categories: [],
      readable: false,
      errors: ["categories.json is not valid JSON"],
    });
    expect(await screen.findByText("categories.json is not valid JSON")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "New category" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });
});
