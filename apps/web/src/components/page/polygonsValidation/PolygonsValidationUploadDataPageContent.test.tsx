import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateFarmsData } from "@/api/farms";
import { validatePolygons } from "@/api/polygonValidation";
import { DataContext } from "@/context/DataContext";
import type { FarmData } from "@/interfaces/Farm";
import type {
  InconsistentPolygonData,
  ValidateFarmsResponse,
} from "@/interfaces/PolygonValidation";
import { makeFarm } from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import { makeDataContext } from "@/test/renderWithData";
import type { UploadSource } from "@/utils/uploadSources";
import { PolygonsValidationUploadDataPageContent } from "./PolygonsValidationUploadDataPageContent";

vi.mock("@/api/farms", () => ({ generateFarmsData: vi.fn() }));
vi.mock("@/api/polygonValidation", () => ({ validatePolygons: vi.fn() }));
// The upload step itself is covered elsewhere: here it only hands rows over.
vi.mock("@/components/page/uploadData/FarmsUploadStep", () => ({
  FarmsUploadStep: ({
    onSubmit,
    keepBar,
  }: {
    onSubmit: (rows: unknown[]) => void;
    keepBar?: boolean;
  }) => (
    <button data-keep-bar={keepBar} onClick={() => onSubmit([{ id: "A" }])}>
      upload
    </button>
  ),
}));

/** A point farm whose geometry is its letter: the same farm across parses. */
const farm = (id: string) =>
  makeFarm({
    id,
    polygon: {
      type: "point",
      area: 10000,
      details: { center: { lat: id.charCodeAt(0), lng: 0 }, radius: 56 },
    },
  });

const overlap = (a: string, b: string): InconsistentPolygonData => ({
  type: "overlap",
  farmIds: [a, b],
  data: {
    area: 100,
    center: { lat: 0, lng: 0 },
    parts: [],
    percentage: 0.1,
    criticality: "MEDIUM",
  },
});

// A validated manually over B; the user goes back and adds N, away from both
const BEFORE: ValidateFarmsResponse = {
  farmResults: [
    { farmId: "A", status: "VALID_MANUALLY" },
    { farmId: "B", status: "NOT_VALID" },
  ],
  inconsistencies: [overlap("A", "B")],
};
const AFTER: ValidateFarmsResponse = {
  farmResults: [
    { farmId: "A", status: "NOT_VALID" },
    { farmId: "B", status: "NOT_VALID" },
    { farmId: "N", status: "VALID" },
  ],
  inconsistencies: [overlap("A", "B")],
};

const setFarmsSourcesRevision = vi.fn();
const setReportGenerationParams = vi.fn();

/** The page over real farms and results state, as the flow keeps them. */
const Harness = () => {
  const [farms, setFarms] = useState<FarmData[] | null>([farm("A"), farm("B")]);
  const [results, setResults] = useState<ValidateFarmsResponse | null>(BEFORE);
  return (
    <>
      {/* The flow state, for the assertions */}
      <output data-testid="state">
        {JSON.stringify({ farms: farms?.map(({ id }) => id) ?? null, results })}
      </output>
      <DataContext.Provider
        value={makeDataContext({
          selectedCountry: "CO",
          farmsData: farms,
          setFarmsData: setFarms,
          polygonsValidationResults: results,
          setPolygonsValidationResults: setResults,
          // Back from "Agregar más polígonos": the flow's list is there
          uploadSources: [{ kind: "manual", key: "k" } as UploadSource],
          uploadSourcesRevision: 7,
          setFarmsSourcesRevision,
          setReportGenerationParams,
        })}
      >
        <PolygonsValidationUploadDataPageContent />
      </DataContext.Provider>
    </>
  );
};

const renderPage = async () => {
  const i18n = await createTestI18n("es");
  render(
    <I18nextProvider i18n={i18n}>
      <Harness />
    </I18nextProvider>
  );
};

const upload = () =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "upload" }));
  });

const flowState = (): {
  farms: string[] | null;
  results: ValidateFarmsResponse | null;
} => JSON.parse(screen.getByTestId("state").textContent!);

const statusOf = (farmId: string) =>
  flowState().results?.farmResults.find((result) => result.farmId === farmId)
    ?.status;

describe("PolygonsValidationUploadDataPageContent", () => {
  beforeEach(() => {
    vi.mocked(generateFarmsData).mockResolvedValue([farm("A"), farm("B"), farm("N")]);
  });

  it("doesn't validate on entry when the flow's list is there", async () => {
    await renderPage();

    expect(validatePolygons).not.toHaveBeenCalled();
    expect(statusOf("A")).toBe("VALID_MANUALLY");
  });

  it("doesn't validate on entry the farms uploaded on stage 2", async () => {
    const i18n = await createTestI18n("es");
    render(
      <I18nextProvider i18n={i18n}>
        <DataContext.Provider
          value={makeDataContext({
            selectedCountry: "CO",
            farmsData: [farm("A"), farm("B")],
            polygonsValidationResults: null,
            // The case the removed effect validated: farms, and no list
            uploadSources: [],
          })}
        >
          <PolygonsValidationUploadDataPageContent />
        </DataContext.Provider>
      </I18nextProvider>
    );

    expect(validatePolygons).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "upload" })).toBeTruthy();
  });

  it("remembers which list the farms were parsed from", async () => {
    vi.mocked(validatePolygons).mockResolvedValue(AFTER);
    await renderPage();

    await upload();

    expect(setFarmsSourcesRevision).toHaveBeenCalledWith(7);
    // The report page starts again from every new farm
    expect(setReportGenerationParams).toHaveBeenCalledWith(
      expect.objectContaining({ seeded: false, selectedFarms: [] })
    );
  });

  it("keeps a manual validation where nothing new overlaps it", async () => {
    vi.mocked(validatePolygons).mockResolvedValue(AFTER);
    await renderPage();

    await upload();

    expect(statusOf("A")).toBe("VALID_MANUALLY");
    expect(statusOf("N")).toBe("VALID");
  });

  it("shows no earlier results on the new farms when the validation fails, and a retry keeps the manual validation", async () => {
    vi.mocked(validatePolygons).mockRejectedValueOnce(new Error("offline"));
    await renderPage();

    await upload();

    // The new farms are set, without the results of the earlier ones
    expect(flowState().farms).toEqual(["A", "B", "N"]);
    expect(flowState().results).toBeNull();

    vi.mocked(validatePolygons).mockResolvedValueOnce(AFTER);
    await upload();

    expect(statusOf("A")).toBe("VALID_MANUALLY");
  });

  it("keeps the bar on an emptied list while farms are loaded from it", async () => {
    const renderWith = async (farmsData: ReturnType<typeof farm>[] | null) => {
      const i18n = await createTestI18n("es");
      render(
        <I18nextProvider i18n={i18n}>
          <DataContext.Provider
            value={makeDataContext({ selectedCountry: "CO", farmsData, uploadSources: [] })}
          >
            <PolygonsValidationUploadDataPageContent />
          </DataContext.Provider>
        </I18nextProvider>
      );
      return screen.getByRole("button", { name: "upload" }).getAttribute("data-keep-bar");
    };

    expect(await renderWith([farm("A")])).toBe("true");
    cleanup();
    expect(await renderWith(null)).toBe("false");
  });
});
