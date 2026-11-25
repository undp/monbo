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

describe("ReportPdfClient ZIP jobs", () => {
  const CONFIG = { deforestationThresholdPercentage: 0, overlapThresholdPercentage: 0 };
  const farm = { id: "F01" } as ReportPdfRequest["farms"][number];

  /** Answers the last message posted to `worker` with `data`. */
  const answerLast = (worker: FakeWorker, data: object) =>
    worker.reply({ id: idOf(worker, worker.messages.length - 1), ...data });

  it("starts, adds farms and finishes a job", async () => {
    const client = new ReportPdfClient();
    const starting = client.startZip({ locale: "es", config: CONFIG, maps: [] });
    const [worker] = FakeWorker.instances;
    expect(worker.messages[0]).toMatchObject({ job: 0, zip: { op: "start", locale: "es" } });
    answerLast(worker, { added: 0 });
    const job = await starting;

    const adding = job.add(farm, [], []);
    expect(worker.messages[1]).toMatchObject({ job: 0, zip: { op: "add", farm } });
    answerLast(worker, { added: 1 });
    expect(await adding).toBe(1);

    const finishing = job.finish();
    expect(worker.messages[2]).toMatchObject({ job: 0, zip: { op: "finish" } });
    answerLast(worker, { blob: new Blob(["zip"]) });
    expect(await (await finishing).text()).toBe("zip");
  });

  it("gives each job its own id", async () => {
    const client = new ReportPdfClient();
    const first = client.startZip({ locale: "es", config: CONFIG, maps: [] });
    const [worker] = FakeWorker.instances;
    answerLast(worker, { added: 0 });
    await first;
    const second = client.startZip({ locale: "es", config: CONFIG, maps: [] });
    answerLast(worker, { added: 0 });
    await second;

    expect(worker.messages.map((m) => (m as { job: number }).job)).toEqual([0, 1]);
  });

  it("cancels a job in the worker", async () => {
    const client = new ReportPdfClient();
    const starting = client.startZip({ locale: "es", config: CONFIG, maps: [] });
    const [worker] = FakeWorker.instances;
    answerLast(worker, { added: 0 });
    const job = await starting;

    job.cancel();

    expect(worker.messages[1]).toMatchObject({ job: 0, zip: { op: "cancel" } });
  });

  it("rejects a farm the worker failed to render", async () => {
    const client = new ReportPdfClient();
    const starting = client.startZip({ locale: "es", config: CONFIG, maps: [] });
    const [worker] = FakeWorker.instances;
    answerLast(worker, { added: 0 });
    const job = await starting;

    const adding = job.add(farm, [], []);
    answerLast(worker, { error: "Font failed to load" });

    await expect(adding).rejects.toThrow("Font failed to load");
  });

  it("rejects the job's pending farms when the worker is terminated", async () => {
    const client = new ReportPdfClient();
    const starting = client.startZip({ locale: "es", config: CONFIG, maps: [] });
    const [worker] = FakeWorker.instances;
    answerLast(worker, { added: 0 });
    const job = await starting;
    const adding = job.add(farm, [], []);

    client.terminate();
    job.cancel(); // nothing left to message

    await expect(adding).rejects.toBeInstanceOf(ReportPdfWorkerTerminatedError);
    expect(worker.messages).toHaveLength(2);
  });
});
