import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import {
  AdminApiError,
  getIngestionJob,
  setAdminLayerEnabled,
  uploadLayerRaster,
} from "@/api/adminLayers";
import theme from "@/config/theme";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { makeAdminLayer } from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import { IngestionJob } from "@/interfaces/AdminLayer";
import { RasterUploadSection } from "./RasterUploadSection";

vi.mock("@/api/adminLayers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/adminLayers")>()),
  setAdminLayerEnabled: vi.fn(),
  getIngestionJob: vi.fn(),
  uploadLayerRaster: vi.fn(),
  cancelIngestionJob: vi.fn(),
}));

const session = { token: "t", expiresAt: "2099-01-01T00:00:00Z", country: "CO" };

describe("RasterUploadSection texts", () => {
  // i18next would escape the file name as HTML ("R&amp;D&#39;s"): it is the admin's
  // own text and must show as typed.
  it("names the raster file as typed, with its ' and &", async () => {
    const layer = makeAdminLayer({
      id: 7,
      enabled: false,
      has_raster: true,
      raster_filename: "R&D's raster.tif",
    });
    vi.mocked(setAdminLayerEnabled).mockResolvedValue({ ...layer, enabled: true });
    const i18n = await createTestI18n("en");
    render(
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
            <SnackbarContext.Provider value={{ openSnackbar: vi.fn() }}>
              <RasterUploadSection
                layer={layer}
                categoryName="Deforestation"
                onLayerChanged={vi.fn()}
              />
            </SnackbarContext.Provider>
          </AdminSessionContext.Provider>
        </I18nextProvider>
      </ThemeProvider>
    );

    expect(
      screen.getByText("R&D's raster.tif · every pixel has the value 0 or 1.")
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Publish layer" }));
    expect(await screen.findByText("The layer now uses R&D's raster.tif.")).toBeTruthy();
    expect(document.body.innerHTML).not.toMatch(/&amp;amp;|&amp;#39;/);
  });
});

describe("RasterUploadSection upload failures", () => {
  const renderSection = async (locale: "en" | "es") => {
    const i18n = await createTestI18n(locale);
    const { container } = render(
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
            <SnackbarContext.Provider value={{ openSnackbar: vi.fn() }}>
              <RasterUploadSection
                layer={makeAdminLayer({ id: 9, has_raster: false })}
                categoryName="Deforestation"
                onLayerChanged={vi.fn()}
              />
            </SnackbarContext.Provider>
          </AdminSessionContext.Provider>
        </I18nextProvider>
      </ThemeProvider>
    );
    return container;
  };

  const upload = async (container: HTMLElement, buttonName: string) => {
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    const file = new File(["tif"], "layer.tif", { type: "image/tiff" });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: buttonName }));
  };

  it("shows the reason the API gives for a 400", async () => {
    const reason =
      "Layer 9 can't be given a raster: its index field 'version' is invalid";
    vi.mocked(uploadLayerRaster).mockRejectedValueOnce(new AdminApiError(400, reason));
    const container = await renderSection("en");
    await upload(container, "Upload and validate");
    expect(
      await screen.findByText(/The server refused the change: Layer 9 can't be given/)
    ).toBeTruthy();
  });

  it("keeps the too-large text for a 413", async () => {
    vi.mocked(uploadLayerRaster).mockRejectedValueOnce(
      new AdminApiError(413, "The raster is larger than 1 MB")
    );
    const container = await renderSection("en");
    await upload(container, "Upload and validate");
    expect(
      await screen.findByText("The file is larger than the server accepts.")
    ).toBeTruthy();
  });

  it("translates the job code invalid_fields with its field", async () => {
    vi.mocked(uploadLayerRaster).mockResolvedValueOnce({ jobId: "j1" });
    const failed: IngestionJob = {
      jobId: "j1",
      country: "CO",
      layerId: 9,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      status: "failed",
      phase: null,
      progress: null,
      rasterFilename: null,
      version: null,
      requestedNodata: null,
      report: null,
      warnings: [],
      error: {
        code: "invalid_fields",
        message: "The layer's index field 'version' is invalid",
        params: { field: "version" },
      },
    };
    vi.mocked(getIngestionJob).mockResolvedValue(failed);
    const container = await renderSection("es");
    await upload(container, "Subir y validar");
    expect(await screen.findByText(/tiene un “version” inválido/)).toBeTruthy();
    expect(screen.queryByText(/The layer's index field/)).toBeNull();
  });
});
