import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAdminCategories, setAdminCategoryEnabled } from "@/api/adminCategories";
import { AdminApiError, listAdminLayers } from "@/api/adminLayers";
import { setRuntimeConfig } from "@/config/runtime";
import theme from "@/config/theme";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import type { AdminCategories } from "@/interfaces/AdminLayer";
import { makeAdminCategory, makeAdminLayer } from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import { router } from "@/test/navigation";
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

  it("lists the cards one under the other, under the country's eyebrow, without a layers table", async () => {
    await renderPage({
      categories: [makeAdminCategory({ layerCount: 1, publishedLayerCount: 1 }), frontier],
      readable: true,
      errors: [],
    });
    await screen.findByRole("article", { name: "Deforestation" });

    expect(screen.getByText("Admin · Colombia")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Categories" })).toBeTruthy();
    expect(screen.getAllByRole("article").map((article) => article.getAttribute("aria-label"))).toEqual([
      "Deforestation",
      "Agricultural frontier",
    ]);
    expect(screen.queryByRole("table")).toBeNull();
    // Each card shows its result texts and its layers
    expect(card("Deforestation").getByText("No findings")).toBeTruthy();
    expect(card("Deforestation").getByText("With findings")).toBeTruthy();
    expect(card("Deforestation").getByText("1 layer · 1 published: IDEAM 2020-2023")).toBeTruthy();
  });

  it("opens the editor's page to create or edit a category", async () => {
    await renderPage({ categories: [makeAdminCategory(), frontier], readable: true, errors: [] });
    await screen.findByRole("article", { name: "Agricultural frontier" });

    fireEvent.click(screen.getByRole("button", { name: "New category" }));
    expect(router.push).toHaveBeenCalledWith("/en/admin/categories/new");

    fireEvent.click(card("Agricultural frontier").getByRole("button", { name: "Edit" }));
    expect(router.push).toHaveBeenCalledWith("/en/admin/categories/frontier");
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

  it("shows the API's reason as text when a switch is refused", async () => {
    vi.mocked(setAdminCategoryEnabled).mockRejectedValue(
      new AdminApiError(400, "Category 'frontier' has published layers (A & B): hide them before disabling it")
    );
    await renderPage({ categories: [makeAdminCategory(), frontier], readable: true, errors: [] });
    fireEvent.click(
      await screen.findByRole("switch", { name: "Enable the category Agricultural frontier" })
    );
    await waitFor(() =>
      expect(openSnackbar).toHaveBeenCalledWith({
        message:
          "The category's state couldn't be changed. The server refused the change: Category 'frontier' has published layers (A & B): hide them before disabling it",
        type: "error",
      })
    );
  });

  it("shows names with ' and & as typed, and never as HTML", async () => {
    await renderPage({
      categories: [
        makeAdminCategory({
          id: "ana",
          name: { es: "<b>Ríos</b>", en: "Forests & Ana's <b>rivers</b>" },
          description: { es: "<img src=x onerror=alert(1)>", en: "<img src=x onerror=alert(1)>" },
        }),
      ],
      readable: true,
      errors: [],
    });
    const article = await screen.findByRole("article", { name: "Forests & Ana's <b>rivers</b>" });
    expect(
      within(article).getByRole("switch", {
        name: "Enable the category Forests & Ana's <b>rivers</b>",
      })
    ).toBeTruthy();
    expect(within(article).getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    // React and MUI render it as text: no element comes out of a name or description.
    expect(article.querySelector("b, img")).toBeNull();
  });
});
