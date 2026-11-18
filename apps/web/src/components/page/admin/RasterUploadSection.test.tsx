import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { setAdminLayerEnabled } from "@/api/adminLayers";
import theme from "@/config/theme";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { makeAdminLayer } from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
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
