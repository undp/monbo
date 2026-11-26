import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdminCategory,
  listAdminCategories,
  updateAdminCategory,
} from "@/api/adminCategories";
import { listAdminLayers } from "@/api/adminLayers";
import { setRuntimeConfig } from "@/config/runtime";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import type { AdminCategories } from "@/interfaces/AdminLayer";
import { makeAdminCategory, makeAdminLayer } from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import { router } from "@/test/navigation";
import { AdminCategoryEditorPageContent } from "./AdminCategoryEditorPageContent";

// Measured in `pnpm test` on a loaded host: these tests take about 2 s alone and one took
// 5.6 s, past the 5 s default. 3x the slowest run, for the whole file. Vitest isolates
// each file, so this does not leak into other files.
vi.setConfig({ testTimeout: 17_000 });

vi.mock("@/api/adminCategories", () => ({
  createAdminCategory: vi.fn(),
  listAdminCategories: vi.fn(),
  updateAdminCategory: vi.fn(),
}));
vi.mock("@/api/adminLayers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/adminLayers")>()),
  listAdminLayers: vi.fn(),
}));

const session = { token: "t", expiresAt: "2099-01-01T00:00:00Z", country: "CO" };
const openSnackbar = vi.fn();

const protectedAreas = makeAdminCategory({
  id: "protected_areas",
  name: { es: "Áreas protegidas", en: "Protected areas" },
  polarity: "avoid",
  temporal: false,
  layerCount: 1,
  publishedLayerCount: 0,
});

const renderEditor = async (
  categoryId: string | undefined,
  categories: AdminCategories = {
    categories: [makeAdminCategory(), protectedAreas],
    readable: true,
    errors: [],
  }
) => {
  vi.mocked(listAdminCategories).mockResolvedValue(categories);
  const i18n = await createTestI18n("en");
  render(
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
          <AdminCategoryEditorPageContent categoryId={categoryId} />
        </SnackbarContext.Provider>
      </AdminSessionContext.Provider>
    </I18nextProvider>
  );
};

const type = (label: RegExp | string, value: string, index = 0) =>
  fireEvent.change(screen.getAllByLabelText(label)[index], { target: { value } });

beforeEach(() => {
  setRuntimeConfig({ deforestationThresholdPercentage: 1, overlapThresholdPercentage: 1 });
  vi.mocked(listAdminLayers).mockResolvedValue([
    makeAdminLayer({ id: 7, category_id: "protected_areas", enabled: false }),
  ]);
});

describe("AdminCategoryEditorPageContent", () => {
  it("creates a category on its own page and goes back to the list", async () => {
    vi.mocked(createAdminCategory).mockImplementation(async (_token, input) =>
      makeAdminCategory({
        ...input,
        id: "frontera_agricola",
        thresholdPercentage: input.thresholdPercentage ?? null,
      })
    );
    await renderEditor(undefined);

    expect(screen.getByText("Admin · Colombia")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "New category" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to categories" }).getAttribute("href")).toBe(
      "/en/admin/categories"
    );
    await screen.findByRole("form", { name: "New category" });
    // The preview sits beside the form, in its own region
    expect(screen.getByRole("region", { name: "Preview" })).toBeTruthy();

    type(/^ES/, "Frontera agrícola", 0);
    type(/^EN/, "Agricultural frontier", 0);
    type("No findings · ES *", "Dentro");
    type("No findings · EN *", "Inside");
    type("With findings · ES *", "Fuera");
    type("With findings · EN *", "Outside");
    fireEvent.click(screen.getByRole("radio", { name: /What is allowed/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create category" }));

    await waitFor(() => expect(createAdminCategory).toHaveBeenCalled());
    // The API makes the id from the Spanish name
    expect(vi.mocked(createAdminCategory).mock.calls[0][1]).not.toHaveProperty("id");
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/en/admin/categories"));
  });

  it("edits a category with its values and a fixed id", async () => {
    vi.mocked(updateAdminCategory).mockResolvedValue(protectedAreas);
    await renderEditor("protected_areas");

    const form = within(await screen.findByRole("form", { name: "Edit category" }));
    expect(screen.getByRole("heading", { level: 1, name: "Edit category" })).toBeTruthy();
    expect((form.getAllByLabelText(/^EN/)[0] as HTMLInputElement).value).toBe("Protected areas");
    expect(form.getByText("Identifier: protected_areas")).toBeTruthy();
    expect(form.queryByLabelText(/^Identifier/)).toBeNull();
    // A layer (hidden) locks whether its layers compare two years
    expect(
      (form.getByRole("switch", { name: /compare two years/ }) as HTMLInputElement).disabled
    ).toBe(true);

    fireEvent.click(form.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(vi.mocked(updateAdminCategory).mock.calls[0][1]).toBe("protected_areas")
    );
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/en/admin/categories"));
  });

  it("goes back to the list on cancel, without saving", async () => {
    await renderEditor("protected_areas");
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(router.push).toHaveBeenCalledWith("/en/admin/categories");
    expect(updateAdminCategory).not.toHaveBeenCalled();
  });

  it("says when the category isn't the country's", async () => {
    await renderEditor("wetlands");

    expect(await screen.findByText("This category doesn't exist in your country.")).toBeTruthy();
    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to categories" })).toBeTruthy();
  });

  it("shows the file's errors and no form when it can't be read", async () => {
    await renderEditor("protected_areas", {
      categories: [],
      readable: false,
      errors: ["categories.json is not valid JSON"],
    });

    expect(await screen.findByText("categories.json is not valid JSON")).toBeTruthy();
    expect(screen.queryByRole("form")).toBeNull();
  });
});
