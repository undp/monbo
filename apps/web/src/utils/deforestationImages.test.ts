import pLimit from "p-limit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapLayerChangedError } from "@/api/deforestationAnalysis";
import { makeFarm, makeMap, makeMapResults } from "@/test/factories";
import { fetchFarmImages } from "./deforestationImages";

const farm = makeFarm({ id: "F01" });
const maps = [makeMap({ id: 1 }), makeMap({ id: 2 }), makeMap({ id: 3 })];
// No result on map 3: its image isn't needed.
const results = [
  makeMapResults(1, { F01: 0.1 }, 4),
  makeMapResults(2, { F01: 0 }),
  makeMapResults(3, { F01: null }),
];

const fetchMock = vi.fn<typeof fetch>();
const image = () => new Response(new Blob(["jpeg"]), { status: 200 });

const run = (signal?: AbortSignal) =>
  fetchFarmImages({
    country: "EC",
    farm,
    maps,
    results,
    includeSatelliteBackground: false,
    limit: pLimit(20),
    signal,
  });

const bodies = () =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

describe("fetchFarmImages", () => {
  it("fetches the farm's image for each map it has a result on", async () => {
    fetchMock.mockImplementation(async () => image());

    const images = await run();

    expect(images.map(({ mapId, farmId }) => [mapId, farmId])).toEqual([
      [1, "F01"],
      [2, "F01"],
    ]);
    expect(bodies()).toMatchObject([
      { country: "EC", mapId: 1, version: 4 },
      { country: "EC", mapId: 2, version: 1 },
    ]);
  });

  it("retries a request that failed transiently", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockImplementation(async () => image());

    const pending = run();
    await vi.runAllTimersAsync();
    const images = await pending;

    expect(images).toHaveLength(2);
    // Map 1 failed twice, then answered; map 2 answered at once.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("gives up after two retries", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => new Response("down", { status: 502 }));

    const pending = run();
    const assertion = expect(pending).rejects.toThrow("HTTP 502");
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(6); // 3 attempts x 2 maps
  });

  it("doesn't retry a layer that changed", async () => {
    fetchMock.mockImplementation(async () => new Response("changed", { status: 409 }));

    await expect(run()).rejects.toBeInstanceOf(MapLayerChangedError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("doesn't retry other client errors", async () => {
    fetchMock.mockImplementation(async () => new Response("bad", { status: 422 }));

    await expect(run()).rejects.toThrow("HTTP 422");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops when the job is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(run(controller.signal)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchFarmImages timeouts", () => {
  it("retries a request that hangs", async () => {
    vi.useFakeTimers();
    let calls = 0;
    fetchMock.mockImplementation((_input, init) => {
      calls++;
      // The first attempt never answers, until its timeout aborts it.
      if (calls === 1)
        return new Promise((_, reject) =>
          init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason))
        );
      return Promise.resolve(image());
    });

    const pending = run();
    await vi.advanceTimersByTimeAsync(61_000);
    const images = await pending;

    expect(images).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
