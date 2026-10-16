import { useContext } from "react";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapLayerChangedError } from "@/api/deforestationAnalysis";
import { setRuntimeConfig } from "@/config/runtime";
import type { DataContextValue } from "@/context/DataContext";
import { deferred } from "@/test/deferred";
import { makeFarm, makeMap, makeMapResults } from "@/test/factories";
import { setParams } from "@/test/navigation";
import { stubObjectUrls } from "@/test/objectUrls";
import { makeDataContext, renderHookWithData } from "@/test/renderWithData";
import {
  fetchDeforestationImages,
  fetchFarmImages,
  type DeforestationImageBlob,
} from "@/utils/deforestationImages";
import { isLargeReport } from "@/utils/reportSize";
import type { ReportPdfRequest } from "@/workers/reportPdfProtocol";
import { ReportPdfWorkerTerminatedError } from "@/workers/reportPdfClient";
import {
  ReportContext,
  ReportProvider,
  ReportWorkerStalledError,
} from "./ReportContext";

// The worker client, replaced: `render` and `terminate` are shared spies, and
// `created` counts the clients the provider made.
const client = vi.hoisted(() => ({
  render: vi.fn(),
  terminate: vi.fn(),
  startZip: vi.fn(),
  created: 0,
}));

vi.mock("@/workers/reportPdfClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/workers/reportPdfClient")>()),
  ReportPdfClient: class {
    constructor() {
      client.created++;
    }
    render = client.render;
    terminate = client.terminate;
    startZip = client.startZip;
  },
}));

vi.mock("@/utils/deforestationImages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/deforestationImages")>()),
  fetchDeforestationImages: vi.fn(),
  fetchFarmImages: vi.fn(),
}));

// Whether a selection is large, set per test: the real threshold needs 1000 pages.
vi.mock("@/utils/reportSize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/reportSize")>()),
  isLargeReport: vi.fn(() => false),
}));

const CONFIG = { deforestationThresholdPercentage: 1, overlapThresholdPercentage: 0 };
const gfw = makeMap({ id: 1, alias: "GFW" });
const f1 = makeFarm({ id: "F01" });
const f2 = makeFarm({ id: "F02" });
const results = [makeMapResults(1, { F01: 0.1, F02: 0 })];
const images: DeforestationImageBlob[] = [
  { mapId: 1, farmId: "F01", blob: new Blob(["F01"]) },
  { mapId: 1, farmId: "F02", blob: new Blob(["F02"]) },
];

/** A data context with an analysis and a report selection of `farms`. */
const reportContext = (farms = [f1, f2], overrides: Partial<DataContextValue> = {}) =>
  makeDataContext({
    selectedCountry: "CR",
    farmsData: [f1, f2],
    deforestationAnalysisParams: { polygonsSubset: "all", selectedMaps: [gfw] },
    deforestationAnalysisResults: results,
    reportGenerationParams: {
      initialFarmSelection: "select",
      selectedMaps: [gfw],
      selectedFarms: farms,
      downloadType: null,
    },
    ...overrides,
  });

const renderReport = (context = reportContext()) =>
  renderHookWithData(() => useContext(ReportContext), { context, wrapper: ReportProvider });

/** The requests the worker client was asked to render, in order. */
const requests = () =>
  client.render.mock.calls.map(([request]) => request as ReportPdfRequest);

let urls: ReturnType<typeof stubObjectUrls>;

beforeEach(() => {
  client.created = 0;
  client.render.mockImplementation(
    async (request: ReportPdfRequest) =>
      new Blob([`${request.kind}:${request.showLinks}`])
  );
  vi.mocked(fetchDeforestationImages).mockResolvedValue(images);
  vi.mocked(isLargeReport).mockReturnValue(false);
  urls = stubObjectUrls();
  setParams({ locale: "es" });
  setRuntimeConfig(CONFIG);
});

describe("ReportProvider without a selection", () => {
  it("has nothing to preview or download", async () => {
    const { result } = await renderReport(reportContext([]));

    expect(result.current).toMatchObject({
      previewUrl: null,
      isPreviewLoading: false,
      previewFailed: false,
    });
    await expect(result.current.getCompleteReport()).rejects.toThrow(
      "No report selection to render"
    );
    await expect(result.current.getSeparatedReports()).rejects.toThrow();
    expect(fetchDeforestationImages).not.toHaveBeenCalled();
  });
});

describe("ReportProvider with a selection", () => {
  it("previews without links, then pre-renders the complete report with them", async () => {
    const { result } = await renderReport();
    expect(result.current.isPreviewLoading).toBe(true);

    await waitFor(() => expect(result.current.previewUrl).toBe("blob:test/1"));
    await waitFor(() => expect(client.render).toHaveBeenCalledTimes(2));

    expect(result.current.isPreviewLoading).toBe(false);
    expect(fetchDeforestationImages).toHaveBeenCalledOnce();
    expect(fetchDeforestationImages).toHaveBeenCalledWith("CR", [gfw], [f1, f2], results);
    expect(requests().map(({ kind, showLinks }) => [kind, showLinks])).toEqual([
      ["complete", false],
      ["complete", true],
    ]);
    for (const request of requests()) {
      expect(request).toMatchObject({ locale: "es", config: CONFIG, images });
    }
  });

  it("downloads the pre-rendered report without rendering again", async () => {
    const { result } = await renderReport();
    await waitFor(() => expect(client.render).toHaveBeenCalledTimes(2));

    const report = await result.current.getCompleteReport();

    expect(await report.text()).toBe("complete:true");
    expect(client.render).toHaveBeenCalledTimes(2);
  });

  it("renders the separated reports from the same images", async () => {
    const { result } = await renderReport();
    await waitFor(() => expect(client.render).toHaveBeenCalledTimes(2));

    const zip = await result.current.getSeparatedReports();

    expect(await zip.text()).toBe("perFarm:true");
    expect(requests()[2]).toMatchObject({ kind: "perFarm", showLinks: true, images });
    expect(fetchDeforestationImages).toHaveBeenCalledOnce();
  });

  it("treats the same farms in another order as the same selection", async () => {
    const rendered = await renderReport();
    await waitFor(() => expect(client.render).toHaveBeenCalledTimes(2));

    rendered.setContext(reportContext([f2, f1]));
    rendered.rerender(undefined);

    expect(rendered.result.current.previewUrl).toBe("blob:test/1");
    expect(fetchDeforestationImages).toHaveBeenCalledOnce();
    expect(client.render).toHaveBeenCalledTimes(2);
  });

  it("fetches again for another selection and releases the previous preview", async () => {
    const rendered = await renderReport();
    await waitFor(() => expect(rendered.result.current.previewUrl).toBe("blob:test/1"));

    rendered.setContext(reportContext([f1]));
    rendered.rerender(undefined);
    expect(rendered.result.current.previewUrl).toBeNull();
    expect(rendered.result.current.isPreviewLoading).toBe(true);

    await waitFor(() => expect(rendered.result.current.previewUrl).toBe("blob:test/2"));
    expect(fetchDeforestationImages).toHaveBeenCalledTimes(2);
    expect(urls.revokeObjectURL).toHaveBeenCalledWith("blob:test/1");
  });
});

describe("ReportProvider failures", () => {
  it("shows a failed preview and renders it again on retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    client.render.mockRejectedValueOnce(new Error("render failed"));
    const { result } = await renderReport();

    await waitFor(() => expect(result.current.previewFailed).toBe(true));
    expect(result.current.isPreviewLoading).toBe(false);

    act(() => result.current.retryPreview());

    expect(result.current.previewFailed).toBe(false);
    await waitFor(() => expect(result.current.previewUrl).toBe("blob:test/1"));
    expect(requests()[1]).toMatchObject({ kind: "complete", showLinks: false });
  });

  it("re-runs the analysis when a layer changed, instead of failing", async () => {
    vi.mocked(fetchDeforestationImages).mockRejectedValue(new MapLayerChangedError());
    const context = reportContext();
    const { result } = await renderReport(context);

    await waitFor(() => expect(context.invalidateAnalysis).toHaveBeenCalledOnce());
    expect(result.current.previewFailed).toBe(false);
    expect(client.render).not.toHaveBeenCalled();
  });

  it("ignores a render dropped because the worker was terminated", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const dropped = deferred<Blob>();
    client.render.mockReturnValueOnce(dropped.promise);
    const { result } = await renderReport();
    await waitFor(() => expect(client.render).toHaveBeenCalledOnce());

    await act(async () => dropped.reject(new ReportPdfWorkerTerminatedError()));

    expect(result.current.previewFailed).toBe(false);
    expect(errors).not.toHaveBeenCalled();
  });
});

describe("ReportProvider unmount", () => {
  it("terminates the worker client and releases the preview", async () => {
    const { result, unmount } = await renderReport();
    await waitFor(() => expect(result.current.previewUrl).toBe("blob:test/1"));

    unmount();

    expect(client.terminate).toHaveBeenCalledOnce();
    expect(urls.revokeObjectURL).toHaveBeenCalledWith("blob:test/1");
  });

  it("starts no worker when it unmounts while the images are fetched", async () => {
    const pending = deferred<DeforestationImageBlob[]>();
    vi.mocked(fetchDeforestationImages).mockReturnValue(pending.promise);
    const { unmount } = await renderReport();
    await waitFor(() => expect(fetchDeforestationImages).toHaveBeenCalledOnce());

    unmount();
    await act(async () => pending.resolve(images));

    expect(client.created).toBe(0);
    expect(client.render).not.toHaveBeenCalled();
  });
});

describe("ReportProvider with a large report", () => {
  /** A ZIP job double: records the farms added and answers like the worker. */
  const zipJob = () => {
    const added: { farm: string; results: unknown; images: unknown }[] = [];
    const job = {
      add: vi.fn(async (farm, results, farmImages) => {
        added.push({ farm: farm.id, results, images: farmImages });
        return added.length;
      }),
      finish: vi.fn(async () => new Blob([`zip:${added.map((a) => a.farm)}`])),
      cancel: vi.fn(),
    };
    client.startZip.mockResolvedValue(job);
    return { job, added };
  };
  const farmImages = (farmId: string) => images.filter((i) => i.farmId === farmId);

  beforeEach(() => {
    vi.mocked(isLargeReport).mockReturnValue(true);
    vi.mocked(fetchFarmImages).mockImplementation(async ({ farm }) => farmImages(farm.id));
  });

  it("previews only the first farm, and pre-renders nothing", async () => {
    const { result } = await renderReport();

    await waitFor(() => expect(result.current.previewUrl).toBe("blob:test/1"));
    expect(result.current).toMatchObject({ isLarge: true, farmCount: 2 });
    expect(fetchDeforestationImages).not.toHaveBeenCalled();
    expect(fetchFarmImages).toHaveBeenCalledOnce();
    expect(vi.mocked(fetchFarmImages).mock.calls[0][0]).toMatchObject({ farm: f1 });
    expect(requests()).toHaveLength(1);
    expect(requests()[0]).toMatchObject({
      kind: "complete",
      showLinks: false,
      farms: [f1],
      images: farmImages("F01"),
    });
    await expect(result.current.getCompleteReport()).rejects.toThrow("ZIP");
  });

  it("builds the ZIP farm by farm, with each farm's results and images", async () => {
    const { job, added } = zipJob();
    const { result } = await renderReport();
    await waitFor(() => expect(result.current.previewUrl).toBe("blob:test/1"));
    const progress: [number, number][] = [];

    const zip = await result.current.buildLargeReportZip((done, total) =>
      progress.push([done, total])
    );

    expect(await zip.text()).toBe("zip:F01,F02");
    expect(client.startZip).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "es", config: CONFIG, maps: [gfw] })
    );
    expect(added).toEqual([
      { farm: "F01", results: [makeMapResults(1, { F01: 0.1 })], images: farmImages("F01") },
      { farm: "F02", results: [makeMapResults(1, { F02: 0 })], images: farmImages("F02") },
    ]);
    expect(progress).toEqual([
      [1, 2],
      [2, 2],
    ]);
    expect(job.cancel).not.toHaveBeenCalled();
  });

  it("stops and cancels the job when the user cancels", async () => {
    const { job } = zipJob();
    const pending = deferred<DeforestationImageBlob[]>();
    const { result } = await renderReport();
    await waitFor(() => expect(result.current.previewUrl).toBe("blob:test/1"));
    vi.mocked(fetchFarmImages).mockReturnValueOnce(pending.promise);
    const controller = new AbortController();

    const building = result.current.buildLargeReportZip(() => {}, controller.signal);
    const assertion = expect(building).rejects.toThrow();
    await waitFor(() => expect(client.startZip).toHaveBeenCalled());
    controller.abort();
    pending.resolve(farmImages("F01"));

    await assertion;
    expect(job.add).not.toHaveBeenCalled();
    expect(job.finish).not.toHaveBeenCalled();
    expect(job.cancel).toHaveBeenCalledOnce();
  });

  it("reports no progress for a farm that finishes after the cancel", async () => {
    const { job } = zipJob();
    // Both farms are still rendering in the worker when the user cancels.
    const renderings = [deferred<number>(), deferred<number>()];
    job.add.mockReturnValueOnce(renderings[0].promise);
    job.add.mockReturnValueOnce(renderings[1].promise);
    const { result } = await renderReport();
    await waitFor(() => expect(result.current.previewUrl).toBe("blob:test/1"));
    const controller = new AbortController();
    const progress = vi.fn();

    const building = result.current.buildLargeReportZip(progress, controller.signal);
    building.catch(() => {});
    await waitFor(() => expect(job.add).toHaveBeenCalledTimes(2));
    controller.abort();
    await act(async () => {
      renderings[0].resolve(1);
      renderings[1].resolve(2);
    });

    await expect(building).rejects.toThrow();
    expect(progress).not.toHaveBeenCalled();
  });

  it("aborts the job's requests when the page goes away", async () => {
    zipJob();
    let signal: AbortSignal | undefined;
    const { result, unmount } = await renderReport();
    await waitFor(() => expect(result.current.previewUrl).toBe("blob:test/1"));
    vi.mocked(fetchFarmImages).mockImplementation(({ signal: s }) => {
      signal = s;
      return new Promise(() => {}); // never answers
    });

    const building = result.current.buildLargeReportZip(() => {});
    building.catch(() => {});
    await waitFor(() => expect(signal).toBeDefined());
    unmount();

    expect(signal!.aborted).toBe(true);
  });

  it("fails the job, and drops the worker, when a farm never renders", async () => {
    const { job } = zipJob();
    job.add.mockImplementation(() => new Promise(() => {})); // a stuck worker
    const { result } = await renderReport();
    await waitFor(() => expect(result.current.previewUrl).toBe("blob:test/1"));
    vi.useFakeTimers();

    const building = result.current.buildLargeReportZip(() => {});
    const assertion = expect(building).rejects.toBeInstanceOf(ReportWorkerStalledError);
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

    await assertion;
    expect(client.terminate).toHaveBeenCalledOnce();
  });

  it("fails the job when a layer changed", async () => {
    const { job } = zipJob();
    const { result } = await renderReport();
    await waitFor(() => expect(result.current.previewUrl).toBe("blob:test/1"));
    vi.mocked(fetchFarmImages).mockRejectedValue(new MapLayerChangedError());

    await expect(result.current.buildLargeReportZip(() => {})).rejects.toBeInstanceOf(
      MapLayerChangedError
    );
    expect(job.cancel).toHaveBeenCalledOnce();
  });
});
