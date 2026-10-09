import { beforeEach, describe, expect, it } from "vitest";
import { FakeWorker, installFakeWorker } from "@/test/fakeWorker";
import type { ReportPdfMessage, ReportPdfRequest } from "./reportPdfProtocol";
import { ReportPdfClient, ReportPdfWorkerTerminatedError } from "./reportPdfClient";

const request = (kind: ReportPdfRequest["kind"] = "complete"): ReportPdfRequest => ({
  kind,
  locale: "es",
  showLinks: true,
  config: { deforestationThresholdPercentage: 0, overlapThresholdPercentage: 0 },
  farms: [],
  results: [],
  maps: [],
  images: [],
});

/** The id the client gave the n-th message it posted to `worker`. */
const idOf = (worker: FakeWorker, n: number) =>
  (worker.messages[n] as ReportPdfMessage).id;

beforeEach(() => {
  installFakeWorker();
});

describe("ReportPdfClient", () => {
  it("starts its worker on the first render, and only one", () => {
    const client = new ReportPdfClient();
    expect(FakeWorker.instances).toHaveLength(0);

    void client.render(request());
    void client.render(request("perFarm"));

    expect(FakeWorker.instances).toHaveLength(1);
    const [worker] = FakeWorker.instances;
    expect(worker.options).toEqual({ type: "module" });
    expect(worker.messages).toMatchObject([
      { request: { kind: "complete" } },
      { request: { kind: "perFarm" } },
    ]);
  });

  it("matches each response to its request, in any order", async () => {
    const client = new ReportPdfClient();
    const first = client.render(request());
    const second = client.render(request("perFarm"));
    const [worker] = FakeWorker.instances;

    worker.reply({ id: idOf(worker, 1), blob: new Blob(["zip"]) });
    worker.reply({ id: idOf(worker, 0), blob: new Blob(["pdf"]) });

    expect(await (await first).text()).toBe("pdf");
    expect(await (await second).text()).toBe("zip");
  });

  it("rejects a render the worker answered with an error", async () => {
    const client = new ReportPdfClient();
    const rendering = client.render(request());
    const [worker] = FakeWorker.instances;

    worker.reply({ id: idOf(worker, 0), error: "Font failed to load" });

    await expect(rendering).rejects.toThrow("Font failed to load");
  });

  it("fails every pending render when the worker crashes, and starts a new one after", async () => {
    const client = new ReportPdfClient();
    const first = client.render(request());
    const second = client.render(request());
    const [crashed] = FakeWorker.instances;

    crashed.crash("Script error");

    await expect(first).rejects.toThrow("Script error");
    await expect(second).rejects.toThrow("Script error");
    expect(crashed.terminated).toBe(true);

    void client.render(request());
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it("rejects pending renders as terminated, and starts a new worker after", async () => {
    const client = new ReportPdfClient();
    const rendering = client.render(request());
    const [worker] = FakeWorker.instances;

    client.terminate();

    await expect(rendering).rejects.toBeInstanceOf(ReportPdfWorkerTerminatedError);
    expect(worker.terminated).toBe(true);

    void client.render(request());
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it("ignores a response for a render it no longer waits for", async () => {
    const client = new ReportPdfClient();
    const rendering = client.render(request());
    const [worker] = FakeWorker.instances;

    worker.reply({ id: 99, blob: new Blob(["other"]) });
    worker.reply({ id: idOf(worker, 0), blob: new Blob(["pdf"]) });

    expect(await (await rendering).text()).toBe("pdf");
  });
});
