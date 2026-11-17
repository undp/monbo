import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import type { ReactElement } from "react";
import { pdf } from "@react-pdf/renderer";
import { makeCategory, makeFarm, makeMap, makeMapResults } from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import type { ReportPdfMessage, ReportPdfRequest } from "./reportPdfProtocol";

// The worker hands the categories and the satellite flag to the document. pdf() is
// replaced: rendering a real PDF needs the fonts, served by the app.
vi.mock("@react-pdf/renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@react-pdf/renderer")>()),
  pdf: vi.fn(() => ({ toBlob: async () => new Blob(["%PDF"]) })),
}));

const CONFIG = { deforestationThresholdPercentage: 2, overlapThresholdPercentage: 1 };
const CATEGORIES = [makeCategory(), makeCategory({ id: "agricultural_frontier" })];

// The worker module (which sets `self.onmessage`) and its translations are loaded
// once, with room for a cold import on a busy machine. Each test then only sends
// messages, and reads only its own responses.
beforeAll(async () => {
  await createTestI18n("es"); // the worker's translations load with real timers
  await import("./reportPdf.worker");
}, 60_000);

let posted: MockInstance<(message: unknown) => void>;
beforeEach(() => {
  posted = vi.spyOn(self, "postMessage").mockImplementation(() => {});
  vi.mocked(pdf).mockClear();
});

/** Sends `message` to the worker and returns its response to that message. */
const send = async (message: ReportPdfMessage) => {
  await (self.onmessage as (event: MessageEvent) => Promise<void>)(
    new MessageEvent("message", { data: message })
  );
  return posted.mock.calls
    .map(([response]) => response as { id: number })
    .find(({ id }) => id === message.id);
};

/** The props of the document passed to pdf() in its n-th call. */
const documentProps = (n = 0) =>
  (vi.mocked(pdf).mock.calls[n][0] as ReactElement<Record<string, unknown>>)
    .props;

describe("the report worker", () => {
  it("renders a request with its categories and satellite flag", async () => {
    const request: ReportPdfRequest = {
      kind: "complete",
      locale: "es",
      showLinks: true,
      config: CONFIG,
      farms: [makeFarm()],
      results: [makeMapResults(1, { F01: 0.5 })],
      maps: [makeMap()],
      categories: CATEGORIES,
      satelliteBackground: true,
      images: [],
    };

    const response = await send({ id: 1, request });

    expect(response).toMatchObject({ id: 1, blob: expect.any(Blob) });
    expect(documentProps()).toMatchObject({
      categories: CATEGORIES,
      satelliteBackground: true,
      language: "es",
    });
  });

  it("keeps a ZIP job's categories for each farm it adds", async () => {
    await send({
      id: 10,
      job: 7,
      zip: {
        op: "start",
        locale: "es",
        config: CONFIG,
        maps: [makeMap()],
        categories: CATEGORIES,
        satelliteBackground: false,
      },
    });
    const added = await send({
      id: 11,
      job: 7,
      zip: {
        op: "add",
        farm: makeFarm(),
        results: [makeMapResults(1, { F01: 0.5 })],
        images: [],
      },
    });

    expect(added).toEqual({ id: 11, added: 1 });
    expect(documentProps()).toMatchObject({
      categories: CATEGORIES,
      satelliteBackground: false,
    });
  });
});
