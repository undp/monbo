import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminCategory, updateAdminCategory } from "@/api/adminCategories";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import type { AdminCategory } from "@/interfaces/AdminLayer";
import { makeAdminCategory, makeAdminLayer } from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import { CategoryPanel } from "./CategoryPanel";
import { CategoryPreview } from "./CategoryPreview";
import { categoryLocks } from "./categoryRules";
import { toCategoryFormValues } from "./categoryFormState";

vi.mock("@/api/adminCategories", () => ({
  createAdminCategory: vi.fn(),
  updateAdminCategory: vi.fn(),
}));

const session = { token: "t", expiresAt: "2099-01-01T00:00:00Z", country: "CO" };
const onSaved = vi.fn();

const renderPanel = async (
  category: AdminCategory | null,
  { layers = [makeAdminLayer()], categories = [makeAdminCategory()] } = {}
) => {
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
        <SnackbarContext.Provider value={{ openSnackbar: vi.fn() }}>
          <CategoryPanel
            open
            category={category}
            categories={categories}
            locks={categoryLocks(category, layers, true, "en")}
            globalThreshold={0}
            onClose={vi.fn()}
            onSaved={onSaved}
          />
        </SnackbarContext.Provider>
      </AdminSessionContext.Provider>
    </I18nextProvider>
  );
};

const type = (label: RegExp | string, value: string, index = 0) =>
  fireEvent.change(screen.getAllByLabelText(label)[index], { target: { value } });

/** Fills every required field of a new category except the polarity. */
const fillFrontier = () => {
  type(/^ES/, "Frontera agrícola", 0);
  type(/^EN/, "Agricultural frontier", 0);
  type("No findings · ES *", "Dentro de la frontera agrícola");
  type("No findings · EN *", "Inside the agricultural frontier");
  type("With findings · ES *", "Fuera de la frontera agrícola");
  type("With findings · EN *", "Outside the agricultural frontier");
};

const save = () => fireEvent.click(screen.getByRole("button", { name: "Create category" }));

beforeEach(() => {
  vi.mocked(createAdminCategory).mockImplementation(async (_token, input) =>
    makeAdminCategory({ ...input, thresholdPercentage: input.thresholdPercentage ?? null })
  );
});

describe("CategoryPanel", () => {
  it("doesn't save a new category without a polarity", async () => {
    await renderPanel(null);
    fillFrontier();
    save();
    expect(
      await screen.findByText("Choose what this category's layers mark.")
    ).toBeTruthy();
    expect(createAdminCategory).not.toHaveBeenCalled();
  });

  it("creates a category with the suggested id and the global threshold", async () => {
    await renderPanel(null);
    fillFrontier();
    expect((screen.getByLabelText(/^Identifier/) as HTMLInputElement).value).toBe(
      "frontera_agricola"
    );
    fireEvent.click(screen.getByRole("radio", { name: /What is allowed/ }));
    save();
    await waitFor(() => expect(createAdminCategory).toHaveBeenCalled());
    expect(vi.mocked(createAdminCategory).mock.calls[0][1]).toMatchObject({
      id: "frontera_agricola",
      polarity: "required",
      temporal: false,
      thresholdPercentage: null,
      name: { es: "Frontera agrícola", en: "Agricultural frontier" },
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("keeps the id the admin typed", async () => {
    await renderPanel(null);
    type(/^Identifier/, "frontier");
    fillFrontier();
    expect((screen.getByLabelText(/^Identifier/) as HTMLInputElement).value).toBe(
      "frontier"
    );
  });

  it("refuses an id already used in the country", async () => {
    await renderPanel(null, {
      categories: [makeAdminCategory(), makeAdminCategory({ id: "protected_areas" })],
    });
    fillFrontier();
    type(/^Identifier/, "protected_areas");
    fireEvent.click(screen.getByRole("radio", { name: /What is allowed/ }));
    save();
    expect(
      await screen.findByText("That identifier is already used in your country.")
    ).toBeTruthy();
    expect(createAdminCategory).not.toHaveBeenCalled();
  });

  it("locks the polarity and temporal of a category with published layers, naming them", async () => {
    const category = makeAdminCategory({ layerCount: 1, publishedLayerCount: 1 });
    vi.mocked(updateAdminCategory).mockResolvedValue(category);
    await renderPanel(category);
    for (const radio of screen.getAllByRole("radio")) {
      expect((radio as HTMLInputElement).disabled).toBe(true);
    }
    expect(screen.getByText(/while layers are published \(IDEAM 2020-2023\)/)).toBeTruthy();
    expect(screen.getByText(/the category has layers \(IDEAM 2020-2023\)/)).toBeTruthy();
    expect((screen.getByRole("switch", { name: /compare two years/ }) as HTMLInputElement).disabled).toBe(
      true
    );
    // The texts and the threshold can still change.
    type("No findings · EN *", "Clean");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateAdminCategory).toHaveBeenCalled());
    expect(vi.mocked(updateAdminCategory).mock.calls[0][1]).toEqual("deforestation");
  });
});

describe("CategoryPreview", () => {
  const renderPreview = async (polarity: "avoid" | "required" | null, threshold = "") => {
    const i18n = await createTestI18n("en");
    const values = {
      ...toCategoryFormValues(),
      name: { es: "Frontera agrícola", en: "Agricultural frontier" },
      polarity,
      useGlobalThreshold: threshold === "",
      threshold,
      resultLabels: {
        ok: { es: "Dentro", en: "Inside" },
        flagged: { es: "Fuera", en: "Outside" },
      },
    };
    return render(
      <I18nextProvider i18n={i18n}>
        <CategoryPreview values={values} globalThreshold={0} />
      </I18nextProvider>
    );
  };

  it("asks for a polarity before showing results", async () => {
    await renderPreview(null);
    expect(screen.getByText("Choose what the layers mark to see the preview.")).toBeTruthy();
    expect(screen.queryByText(/Outside/)).toBeNull();
  });

  it("changes which polygon has findings with the polarity", async () => {
    const { unmount } = await renderPreview("avoid");
    const preview = () => within(screen.getByRole("region", { name: "Preview" }));
    expect(preview().getByText("Polygon that overlaps the layer by 18%")).toBeTruthy();
    expect(preview().getByText("18% · Outside")).toBeTruthy();
    expect(preview().getByText("Inside")).toBeTruthy();
    unmount();

    await renderPreview("required");
    expect(preview().getByText("Polygon with 18% outside the layer")).toBeTruthy();
    expect(preview().queryByText("Polygon that overlaps the layer by 18%")).toBeNull();
    // The classifier, not the caption, picks the chip: 18% outside is still flagged.
    expect(preview().getByText("18% · Outside")).toBeTruthy();
  });

  it("keeps the example above the threshold, and says when nothing can be flagged", async () => {
    const { unmount } = await renderPreview("avoid", "40");
    expect(screen.getByText("Polygon that overlaps the layer by 45%")).toBeTruthy();
    unmount();
    await renderPreview("avoid", "100");
    expect(screen.getByText("With a 100% threshold no polygon has findings.")).toBeTruthy();
  });
});
