import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAdminCategories } from "@/api/adminCategories";
import {
  AdminApiError,
  createAdminLayer,
  listAdminLayers,
  setAdminLayerEnabled,
  updateAdminLayer,
} from "@/api/adminLayers";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import type { AdminCategory, AdminLayer } from "@/interfaces/AdminLayer";
import { makeAdminCategory, makeAdminLayer } from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import { AdminLayerEditorPageContent } from "./AdminLayerEditorPageContent";
import { AdminLayersPageContent } from "./AdminLayersPageContent";

vi.mock("@/api/adminCategories", () => ({ listAdminCategories: vi.fn() }));
vi.mock("@/api/adminLayers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/adminLayers")>()),
  listAdminLayers: vi.fn(),
  createAdminLayer: vi.fn(),
  updateAdminLayer: vi.fn(),
  setAdminLayerEnabled: vi.fn(),
}));
// The raster flow has its own states; these tests are about the form and the list.
vi.mock("./RasterUploadSection", () => ({ RasterUploadSection: () => null }));

const session = { token: "t", expiresAt: "2099-01-01T00:00:00Z", country: "CO" };
const openSnackbar = vi.fn();

const protectedAreas = makeAdminCategory({
  id: "protected_areas",
  name: { es: "Áreas protegidas", en: "Protected areas" },
  icon: "shield",
  color: "#0f7c86",
  temporal: false,
});
const frontier = makeAdminCategory({
  id: "frontier",
  name: { es: "Frontera agrícola", en: "Agricultural frontier" },
  polarity: "required",
  temporal: false,
  enabled: false,
});

const withProviders = async (children: React.ReactNode) => {
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
        <SnackbarContext.Provider value={{ openSnackbar }}>{children}</SnackbarContext.Provider>
      </AdminSessionContext.Provider>
    </I18nextProvider>
  );
};

const mockApi = (layers: AdminLayer[], categories: AdminCategory[]) => {
  vi.mocked(listAdminLayers).mockResolvedValue(layers);
  vi.mocked(listAdminCategories).mockResolvedValue({
    categories,
    readable: true,
    errors: [],
  });
};

beforeEach(() => {
  mockApi([makeAdminLayer()], [makeAdminCategory(), protectedAreas, frontier]);
});

describe("layers list", () => {
  it("shows each layer's category", async () => {
    await withProviders(<AdminLayersPageContent />);
    expect(await screen.findByRole("columnheader", { name: "Category" })).toBeTruthy();
    expect(await screen.findByText("Deforestation")).toBeTruthy();
  });

  it("says why an enabled layer in a disabled category isn't public", async () => {
    mockApi(
      [makeAdminLayer({ id: 4, category_id: "frontier", category_enabled: false, baseline: null, compared_against: null })],
      [makeAdminCategory(), frontier]
    );
    await withProviders(<AdminLayersPageContent />);
    expect(
      await screen.findByText(
        /IDEAM 2020-2023 is published, but doesn't appear in the analysis: its category “Agricultural frontier” is disabled\./
      )
    ).toBeTruthy();
    expect(screen.getByText(/Hide it; then enable its category/)).toBeTruthy();
  });

  it("shows a category that doesn't resolve by its id", async () => {
    mockApi(
      [makeAdminLayer({ id: 3, enabled: false, category_id: "wetlands", category_issue: "unknown_category", category_enabled: false })],
      [makeAdminCategory()]
    );
    await withProviders(<AdminLayersPageContent />);
    expect(await screen.findByText("wetlands · doesn't exist")).toBeTruthy();
  });

  it("explains why a layer can't be published instead of asking the API", async () => {
    mockApi(
      [makeAdminLayer({ id: 4, enabled: false, category_id: "frontier", category_enabled: false })],
      [makeAdminCategory(), frontier]
    );
    await withProviders(<AdminLayersPageContent />);
    await screen.findByText(/Agricultural frontier/);
    fireEvent.click(screen.getByRole("switch", { name: /Published/ }));
    await waitFor(() =>
      expect(openSnackbar).toHaveBeenCalledWith({
        message:
          "It can't be published: its category “Agricultural frontier” is disabled. Enable its category in Categories, or edit it and choose another one.",
        type: "warning",
      })
    );
    expect(setAdminLayerEnabled).not.toHaveBeenCalled();
  });
});

describe("layer form", () => {
  it("shows the years only for a temporal category and sends null otherwise", async () => {
    const layer = makeAdminLayer({
      id: 6,
      enabled: false,
      category_id: "protected_areas",
      baseline: null,
      compared_against: null,
    });
    mockApi([layer], [makeAdminCategory(), protectedAreas]);
    vi.mocked(updateAdminLayer).mockResolvedValue(layer);
    await withProviders(<AdminLayerEditorPageContent layerId={6} />);
    expect(await screen.findByText(/doesn't compare years/)).toBeTruthy();
    expect(screen.queryByLabelText(/Baseline year/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateAdminLayer).toHaveBeenCalled());
    expect(vi.mocked(updateAdminLayer).mock.calls[0][2]).toMatchObject({
      category_id: "protected_areas",
      baseline: null,
      compared_against: null,
    });
  });

  it("doesn't save a new layer without a category", async () => {
    await withProviders(<AdminLayerEditorPageContent />);
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByText("Choose a category")).toBeTruthy();
    expect(createAdminLayer).not.toHaveBeenCalled();
  });

  it("locks the category of a published layer", async () => {
    await withProviders(<AdminLayerEditorPageContent layerId={0} />);
    expect(
      await screen.findByText("A published layer can't change category: hide it first.")
    ).toBeTruthy();
    expect(screen.getByLabelText(/Baseline year/)).toBeTruthy();
  });
});

describe("admin texts with ' and &", () => {
  const ana = makeAdminCategory({
    id: "ana",
    name: { es: "Bosques & ríos d'Ana", en: "Forests & Ana's rivers" },
    temporal: false,
    enabled: false,
  });

  it("names a disabled category as typed in the list, without escaping it twice", async () => {
    mockApi(
      [makeAdminLayer({ id: 4, category_id: "ana", category_enabled: false, baseline: null, compared_against: null })],
      [makeAdminCategory(), ana]
    );
    await withProviders(<AdminLayersPageContent />);
    expect(
      await screen.findByText(/its category “Forests & Ana's rivers” is disabled\./)
    ).toBeTruthy();
    expect(document.body.innerHTML).not.toMatch(/&amp;amp;|&amp;#39;/);
  });

  it("shows the API's reason when publishing is refused", async () => {
    mockApi(
      [makeAdminLayer({ id: 5, enabled: false })],
      [makeAdminCategory()]
    );
    vi.mocked(setAdminLayerEnabled).mockRejectedValue(
      new AdminApiError(400, "Layer 5 can't be published: its category 'deforestation' is disabled & hidden")
    );
    await withProviders(<AdminLayersPageContent />);
    await screen.findByText("IDEAM 2020-2023");
    fireEvent.click(screen.getByRole("switch", { name: /Published/ }));
    await waitFor(() =>
      expect(openSnackbar).toHaveBeenCalledWith({
        message:
          "The layer's state could not be changed. The server refused the change: Layer 5 can't be published: its category 'deforestation' is disabled & hidden",
        type: "error",
      })
    );
  });

  it("names the category as typed in the editor's notice", async () => {
    const layer = makeAdminLayer({ id: 4, category_id: "ana", category_enabled: false, baseline: null, compared_against: null });
    mockApi([layer], [makeAdminCategory(), ana]);
    await withProviders(<AdminLayerEditorPageContent layerId={4} />);
    expect(
      await screen.findByText(/its category “Forests & Ana's rivers” is disabled\./)
    ).toBeTruthy();
  });

  it("shows the API's reason for a 409 when saving a layer", async () => {
    const layer = makeAdminLayer({ id: 6, enabled: false });
    mockApi([layer], [makeAdminCategory()]);
    vi.mocked(updateAdminLayer).mockRejectedValue(
      new AdminApiError(409, "Layer raster is unreadable: 'layer-6-v1.tif' & its copy")
    );
    await withProviders(<AdminLayerEditorPageContent layerId={6} />);
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(openSnackbar).toHaveBeenCalledWith({
        message:
          "The layer could not be saved. The server refused the change: Layer raster is unreadable: 'layer-6-v1.tif' & its copy",
        type: "error",
      })
    );
  });

  it("names the layer as typed when it is published from the list", async () => {
    const layer = makeAdminLayer({ id: 5, enabled: false });
    layer.attributes.en = { ...layer.attributes.en!, alias: "IDEAM & d'Ana <b>x</b>" };
    mockApi([layer], [makeAdminCategory()]);
    vi.mocked(setAdminLayerEnabled).mockResolvedValue({ ...layer, enabled: true });
    await withProviders(<AdminLayersPageContent />);
    await screen.findByText("IDEAM & d'Ana <b>x</b>");
    fireEvent.click(screen.getByRole("switch", { name: /Published/ }));
    await waitFor(() =>
      expect(openSnackbar).toHaveBeenCalledWith({
        message: "Layer IDEAM & d'Ana <b>x</b> published.",
        type: "success",
      })
    );
  });
});
