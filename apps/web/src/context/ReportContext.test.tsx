import { useContext } from "react";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapLayerChangedError } from "@/api/layerAnalysis";
import { setRuntimeConfig } from "@/config/runtime";
import type { DataContextValue } from "@/context/DataContext";
import { deferred } from "@/test/deferred";
import { makeCategory, makeFarm, makeMap, makeMapResults } from "@/test/factories";
import { setParams } from "@/test/navigation";
import { stubObjectUrls } from "@/test/objectUrls";
import { makeDataContext, renderHookWithData } from "@/test/renderWithData";
import {
  fetchLayerImages,
  fetchFarmImages,
  type LayerImageBlob,
} from "@/utils/layerImages";
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

vi.mock("@/utils/layerImages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/layerImages")>()),
  fetchLayerImages: vi.fn(),
  fetchFarmImages: vi.fn(),
}));

// A satellite background limit of 1 farm: the 2-farm selection is above it.
vi.mock("@/config/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/config/env")>()),
  MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION: 1,
}));

// Whether a selection is large, set per test: the real threshold needs 1000 pages.
vi.mock("@/utils/reportSize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/reportSize")>()),
  isLargeReport: vi.fn(() => false),
}));

const CONFIG = { deforestationThresholdPercentage: 1, overlapThresholdPercentage: 0 };
const gfw = makeMap({ id: 1, alias: "GFW" });
const categories = [makeCategory()];
const f1 = makeFarm({ id: "F01" });
const f2 = makeFarm({ id: "F02" });
const results = [makeMapResults(1, { F01: 0.1, F02: 0 })];
const images: LayerImageBlob[] = [
  { mapId: 1, farmId: "F01", blob: new Blob(["F01"]) },
  { mapId: 1, farmId: "F02", blob: new Blob(["F02"]) },
];

/** A data context with an analysis and a report selection of `farms`. */
const reportContext = (farms = [f1, f2], overrides: Partial<DataContextValue> = {}) =>
  makeDataContext({
    selectedCountry: "CR",
    farmsData: [f1, f2],
    territorialAnalysisParams: { polygonsSubset: "all", selectedMaps: [gfw] },
    territorialAnalysisResults: results,
    reportGenerationParams: {
      seeded: true,
      selectedMaps: [gfw],
      selectedFarms: farms,
      downloadType: null,
    },
    availableCategories: categories,
    ...overrides,
  });

const renderReport = (context = reportContext()) =>
  renderHookWithData(() => useContext(ReportContext), { context, wrapper: ReportProvider });

/** The report page after the user asked for the preview of `context`'s choice. */
const renderPreviewed = async (context = reportContext()) => {
  const rendered = await renderReport(context);
  act(() => rendered.result.current.requestPreview());
  return rendered;
};

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
  vi.mocked(fetchLayerImages).mockResolvedValue(images);
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
      previewState: "idle",
      isPreviewStale: false,
    });
    await expect(result.current.getCompleteReport()).rejects.toThrow(
      "No report selection to render"
    );
    await expect(result.current.getSeparatedReports()).rejects.toThrow();
    expect(fetchLayerImages).not.toHaveBeenCalled();
  });
});

describe("ReportProvider before the preview is asked for", () => {
  it("fetches and renders nothing", async () => {
    const { result } = await renderReport();

    expect(result.current).toMatchObject({
      previewUrl: null,
      previewState: "idle",
      isPreviewStale: false,
      isPreviewCurrent: false,
      previewInfo: null,
    });
    expect(fetchLayerImages).not.toHaveBeenCalled();
    expect(client.render).not.toHaveBeenCalled();
  });

  it("renders the complete report of the choice when it is downloaded", async () => {
    const { result } = await renderReport();

    const report = await result.current.getCompleteReport();

    expect(await report.text()).toBe("complete:true");
    expect(requests()).toHaveLength(1);
    expect(requests()[0]).toMatchObject({ farms: [f1, f2], showLinks: true });
  });
});

describe("ReportProvider with a selection", () => {
  it("previews without links, then pre-renders the complete report with them", async () => {
    const { result } = await renderPreviewed();
    expect(result.current.previewState).toBe("loading");
    expect(result.current.isPreviewCurrent).toBe(true);

    await waitFor(() => expect(result.current.previewUrl).toBe("blob:test/1"));
    await waitFor(() => expect(client.render).toHaveBeenCalledTimes(2));

    expect(result.current.previewState).toBe("ready");
    expect(result.current.previewInfo).toEqual({
      isLarge: false,
      farmCount: 2,
      satelliteLimit: 1,
    });
    expect(fetchLayerImages).toHaveBeenCalledOnce();
    expect(fetchLayerImages).toHaveBeenCalledWith("CR", [gfw], [f1, f2], results);
    expect(requests().map(({ kind, showLinks }) => [kind, showLinks])).toEqual([
      ["complete", false],
      ["complete", true],
    ]);
    for (const request of requests()) {
      // 2 farms, above the satellite limit of 1: the maps have no satellite photo
      expect(request).toMatchObject({
        locale: "es",
        config: CONFIG,
        images,
        categories,
        satelliteBackground: false,
      });
    }
  });

  it("leaves the preview stale when a category changes, until asked again", async () => {
    const rendered = await renderPreviewed();
    await waitFor(() => expect(client.render).toHaveBeenCalledTimes(2));

    const edited = [makeCategory({ thresholdPercentage: 5 })];
    rendered.setContext(reportContext(undefined, { availableCategories: edited }));
    rendered.rerender(undefined);

    expect(rendered.result.current.isPreviewStale).toBe(true);
    expect(client.render).toHaveBeenCalledTimes(2);

    act(() => rendered.result.current.requestPreview());

    await waitFor(() => expect(client.render).toHaveBeenCalledTimes(4));
    expect(requests()[2].categories).toEqual(edited);
  });

  it("downloads the pre-rendered report without rendering again", async () => {
    const { result } = await renderPreviewed();
    await waitFor(() => expect(client.render).toHaveBeenCalledTimes(2));

    const report = await result.current.getCompleteReport();

    expect(await report.text()).toBe("complete:true");
    expect(client.render).toHaveBeenCalledTimes(2);
  });

  it("renders the separated reports from the same images", async () => {
    const { result } = await renderPreviewed();
    await waitFor(() => expect(client.render).toHaveBeenCalledTimes(2));

    const zip = await result.current.getSeparatedReports();

    expect(await zip.text()).toBe("perFarm:true");
    expect(requests()[2]).toMatchObject({ kind: "perFarm", showLinks: true, images });
    expect(fetchLayerImages).toHaveBeenCalledOnce();
  });

  it("treats the same farms in another order as the same selection", async () => {
    const rendered = await renderPreviewed();
    await waitFor(() => expect(client.render).toHaveBeenCalledTimes(2));

    rendered.setContext(reportContext([f2, f1]));
    rendered.rerender(undefined);

    expect(rendered.result.current.previewUrl).toBe("blob:test/1");
    expect(rendered.result.current.isPreviewStale).toBe(false);
    expect(fetchLayerImages).toHaveBeenCalledOnce();
    expect(client.render).toHaveBeenCalledTimes(2);
  });

  it("keeps the shown preview, stale, when the choice changes", async () => {
    const rendered = await renderPreviewed();
    await waitFor(() => expect(rendered.result.current.previewUrl).toBe("blob:test/1"));

    rendered.setContext(reportContext([f1]));
    rendered.rerender(undefined);

    expect(rendered.result.current).toMatchObject({
      previewUrl: "blob:test/1",
      previewState: "ready",
      isPreviewStale: true,
      isPreviewCurrent: false,
    });
    expect(fetchLayerImages).toHaveBeenCalledOnce();

    // Back to the previewed choice: the preview is current again
    rendered.setContext(reportContext());
    rendered.rerender(undefined);
    expect(rendered.result.current.isPreviewStale).toBe(false);
    expect(rendered.result.current.isPreviewCurrent).toBe(true);
  });

  it("fetches again when asked for another choice, and releases the previous preview", async () => {
    const rendered = await renderPreviewed();
    await waitFor(() => expect(rendered.result.current.previewUrl).toBe("blob:test/1"));
    rendered.setContext(reportContext([f1]));
    rendered.rerender(undefined);

    act(() => rendered.result.current.requestPreview());
    expect(rendered.result.current.previewState).toBe("loading");

    await waitFor(() => expect(rendered.result.current.previewUrl).toBe("blob:test/2"));
    expect(rendered.result.current.isPreviewStale).toBe(false);
    expect(fetchLayerImages).toHaveBeenCalledTimes(2);
    expect(urls.revokeObjectURL).toHaveBeenCalledWith("blob:test/1");
  });

  it("shows the requested choice when the choice changes while it renders", async () => {
    const rendering = deferred<Blob>();
    client.render.mockReturnValueOnce(rendering.promise);
    const rendered = await renderPreviewed();
    await waitFor(() => expect(client.render).toHaveBeenCalledOnce());

    rendered.setContext(reportContext([f1]));
    rendered.rerender(undefined);
    await act(async () => rendering.resolve(new Blob(["preview"])));

    expect(requests()[0].farms).toEqual([f1, f2]);
    expect(rendered.result.current).toMatchObject({
      previewUrl: "blob:test/1",
      previewState: "ready",
      isPreviewStale: true,
    });
    expect(rendered.result.current.previewInfo?.farmCount).toBe(2);
    // Nobody downloads the requested choice now: it isn't pre-rendered
    expect(requests()).toHaveLength(1);
  });

  it("downloads the current choice, not the previewed one", async () => {
    const rendered = await renderPreviewed();
    await waitFor(() => expect(client.render).toHaveBeenCalledTimes(2));
    rendered.setContext(reportContext([f1]));
    rendered.rerender(undefined);

    await rendered.result.current.getCompleteReport();

    expect(requests()).toHaveLength(3);
    expect(requests()[2]).toMatchObject({ farms: [f1], showLinks: true });
  });
});

describe("ReportProvider satellite background", () => {
  it("gives the limit when the selection's farms are above it", async () => {
    const { result } = await renderReport();
    expect(result.current.satelliteLimit).toBe(1);
  });

  it("gives null when the maps get the satellite background", async () => {
    const { result } = await renderReport(reportContext([f1]));
    expect(result.current.satelliteLimit).toBeNull();
  });
});

describe("ReportProvider failures", () => {
  it("shows a failed preview and renders it again on retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    client.render.mockRejectedValueOnce(new Error("render failed"));
    const { result } = await renderPreviewed();

    await waitFor(() => expect(result.current.previewState).toBe("failed"));
    expect(result.current.isPreviewCurrent).toBe(false);

    act(() => result.current.retryPreview());

    expect(result.current.previewState).toBe("loading");
    await waitFor(() => expect(result.current.previewUrl).toBe("blob:test/1"));
    expect(requests()[1]).toMatchObject({ kind: "complete", showLinks: false });
  });

  it("re-runs the analysis when a layer changed, instead of failing", async () => {
    vi.mocked(fetchLayerImages).mockRejectedValue(new MapLayerChangedError());
    const context = reportContext();
    const { result } = await renderPreviewed(context);

    await waitFor(() => expect(context.invalidateAnalysis).toHaveBeenCalledOnce());
    expect(result.current.previewState).not.toBe("failed");
    expect(client.render).not.toHaveBeenCalled();
  });

  it("ignores a render dropped because the worker was terminated", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const dropped = deferred<Blob>();
    client.render.mockReturnValueOnce(dropped.promise);
    const { result } = await renderPreviewed();
    await waitFor(() => expect(client.render).toHaveBeenCalledOnce());

    await act(async () => dropped.reject(new ReportPdfWorkerTerminatedError()));

    expect(result.current.previewState).not.toBe("failed");
    expect(errors).not.toHaveBeenCalled();
  });
});

describe("ReportProvider unmount", () => {
  it("terminates the worker client and releases the preview", async () => {
    const { result, unmount } = await renderPreviewed();
    await waitFor(() => expect(result.current.previewUrl).toBe("blob:test/1"));

    unmount();

    expect(client.terminate).toHaveBeenCalledOnce();
    expect(urls.revokeObjectURL).toHaveBeenCalledWith("blob:test/1");
  });

  it("starts no worker when it unmounts while the images are fetched", async () => {
    const pending = deferred<LayerImageBlob[]>();
    vi.mocked(fetchLayerImages).mockReturnValue(pending.promise);
    const { unmount } = await renderPreviewed();
    await waitFor(() => expect(fetchLayerImages).toHaveBeenCalledOnce());

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
    const { result } = await renderPreviewed();

    await waitFor(() => expect(result.current.previewUrl).toBe("blob:test/1"));
    expect(result.current).toMatchObject({ isLarge: true, farmCount: 2 });
    expect(result.current.previewInfo).toMatchObject({ isLarge: true, farmCount: 2 });
    expect(fetchLayerImages).not.toHaveBeenCalled();
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
    const { result } = await renderPreviewed();
    await waitFor(() => expect(result.current.previewUrl).toBe("blob:test/1"));
    const progress: [number, number][] = [];

    const zip = await result.current.buildLargeReportZip((done, total) =>
      progress.push([done, total])
    );

    expect(await zip.text()).toBe("zip:F01,F02");
    expect(client.startZip).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "es",
        config: CONFIG,
        maps: [gfw],
        categories,
        satelliteBackground: false,
      })
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
    const pending = deferred<LayerImageBlob[]>();
    const { result } = await renderPreviewed();
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
    const { result } = await renderPreviewed();
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

  /** A job with F01 added and F02 waiting for its images (`pending`). */
  const jobHalfway = async () => {
    const { job } = zipJob();
    const pending = deferred<LayerImageBlob[]>();
    const rendered = await renderPreviewed();
    await waitFor(() => expect(rendered.result.current.previewUrl).toBe("blob:test/1"));
    vi.mocked(fetchFarmImages)
      .mockResolvedValueOnce(farmImages("F01"))
      .mockReturnValueOnce(pending.promise);
    const building = rendered.result.current.buildLargeReportZip(() => {});
    building.catch(() => {});
    await waitFor(() => expect(job.add).toHaveBeenCalledOnce());
    return { job, pending, rendered, building };
  };

  it("keeps the job when the maps are refreshed with the same selection", async () => {
    const { job, pending, rendered, building } = await jobHalfway();

    // The /maps poll replaces the selected map objects with equal ones: the
    // selection is a new object with the same key.
    rendered.setContext(reportContext());
    rendered.rerender(undefined);
    await act(async () => pending.resolve(farmImages("F02")));

    expect(await (await building).text()).toBe("zip:F01,F02");
    expect(job.cancel).not.toHaveBeenCalled();
  });

  it("stops the job when the selection changes", async () => {
    const { job, pending, rendered, building } = await jobHalfway();

    rendered.setContext(reportContext([f1]));
    rendered.rerender(undefined);
    await act(async () => pending.resolve(farmImages("F02")));

    await expect(building).rejects.toThrow();
    expect(job.cancel).toHaveBeenCalledOnce();
    expect(job.finish).not.toHaveBeenCalled();
  });

  /** A job with every farm added, waiting for `finish` (`finishing`). */
  const jobFinishing = async () => {
    const { job } = zipJob();
    const finishing = deferred<Blob>();
    job.finish.mockReturnValueOnce(finishing.promise);
    const { result } = await renderPreviewed();
    await waitFor(() => expect(result.current.previewUrl).toBe("blob:test/1"));
    const controller = new AbortController();
    const building = result.current.buildLargeReportZip(() => {}, controller.signal);
    building.catch(() => {});
    await waitFor(() => expect(job.finish).toHaveBeenCalledOnce());
    return { job, finishing, controller, building };
  };

  it("drops the worker when the user cancels while the ZIP is generated", async () => {
    const { finishing, controller, building } = await jobFinishing();
    // The ZIP's generation can't be interrupted: terminating the worker is what
    // stops it, and it rejects the pending answer.
    client.terminate.mockImplementationOnce(() =>
      finishing.reject(new ReportPdfWorkerTerminatedError())
    );

    controller.abort();

    await expect(building).rejects.toBeInstanceOf(ReportPdfWorkerTerminatedError);
    expect(client.terminate).toHaveBeenCalledOnce();
  });

  it("doesn't return a ZIP that finished after the cancel", async () => {
    const { finishing, controller, building } = await jobFinishing();

    controller.abort();
    await act(async () => finishing.resolve(new Blob(["zip"])));

    await expect(building).rejects.toThrow();
  });

  it("aborts the job's requests when the page goes away", async () => {
    zipJob();
    let signal: AbortSignal | undefined;
    const { result, unmount } = await renderPreviewed();
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
    const { result } = await renderPreviewed();
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
    const { result } = await renderPreviewed();
    await waitFor(() => expect(result.current.previewUrl).toBe("blob:test/1"));
    vi.mocked(fetchFarmImages).mockRejectedValue(new MapLayerChangedError());

    await expect(result.current.buildLargeReportZip(() => {})).rejects.toBeInstanceOf(
      MapLayerChangedError
    );
    expect(job.cancel).toHaveBeenCalledOnce();
  });
});
