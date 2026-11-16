import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { DataContext } from "@/context/DataContext";
import { generateFarmsData } from "@/api/farms";
import { createTestI18n } from "@/test/i18n";
import { makeDataContext } from "@/test/renderWithData";
import { makeFarm, makeMap, makeValidationResults } from "@/test/factories";
import { DeforestationAnalysisUploadDataPageContent } from "./DeforestationAnalysisUploadDataPageContent";

vi.mock("@/api/farms", () => ({ generateFarmsData: vi.fn() }));
vi.mock("@/api/deforestationAnalysis", () => ({ analizeDeforestation: vi.fn() }));
// The upload step itself is covered elsewhere: here it only hands rows over.
vi.mock("@/components/page/uploadData/FarmsUploadStep", () => ({
  FarmsUploadStep: ({ onSubmit }: { onSubmit: (rows: unknown[]) => void }) => (
    <button onClick={() => onSubmit([{ id: "new-1" }])}>upload</button>
  ),
}));

describe("DeforestationAnalysisUploadDataPageContent", () => {
  it("drops the validation of earlier farms when new ones are uploaded", async () => {
    vi.mocked(generateFarmsData).mockResolvedValue([makeFarm({ id: "new-1" })]);
    const map = makeMap();
    const context = makeDataContext({
      selectedCountry: "CO",
      availableMaps: [map],
      // The stage 1 validation of another file, with no analysis yet.
      polygonsValidationResults: makeValidationResults({}),
      deforestationAnalysisParams: { polygonsSubset: "valid", selectedMaps: [map] },
    });
    const i18n = await createTestI18n("es");
    render(
      <I18nextProvider i18n={i18n}>
        <DataContext.Provider value={context}>
          <DeforestationAnalysisUploadDataPageContent />
        </DataContext.Provider>
      </I18nextProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "upload" }));

    await waitFor(() => expect(context.setFarmsData).toHaveBeenCalled());
    expect(context.setPolygonsValidationResults).toHaveBeenCalledWith(null);
  });
});
