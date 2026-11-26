import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readPublicFile } from "@/test/files";

// The sample reports the start page opens (public/files/examples/README.md). A
// reader of the sample has no local API, so each farm sheet's GeoJSON link must
// reach production's.

const PRODUCTION_GEOJSON_URL =
  "https://monbo-api.orangerock-ea3c2f53.eastus.azurecontainerapps.io/download-geojson";

const SAMPLE_REPORTS = {
  es: "files/examples/es/ejemplo-reporte.pdf",
  en: "files/examples/en/example-report.pdf",
};

const SAMPLE_FARM_IDS = ["E1-001", "E1-002", "E1-003", "E1-004", "E1-005"];

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

// PDF literal strings escape `(`, `)` and `\` with a backslash.
const unescapePdfString = (value: string) => value.replace(/\\(.)/g, "$1");

/** Every link target in the PDF, from its raw objects and its compressed streams. */
const pdfUris = (bytes: Uint8Array): string[] => {
  const raw = latin1(bytes);
  const sources = [raw];
  for (const [, stream] of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      sources.push(latin1(inflateSync(Buffer.from(stream, "latin1"))));
    } catch {
      // Not a FlateDecode stream (images, fonts): it holds no links.
    }
  }
  return sources.flatMap((source) =>
    [...source.matchAll(/\/URI\s*\(((?:\\.|[^\\)])*)\)/g)].map(([, uri]) =>
      unescapePdfString(uri)
    )
  );
};

describe.each(Object.entries(SAMPLE_REPORTS))("sample report (%s)", (_, path) => {
  const uris = pdfUris(readPublicFile(path));
  const geojsonLinks = uris.filter((uri) => uri.includes("/download-geojson"));

  it("links every GeoJSON to the production API", () => {
    expect(geojsonLinks).toHaveLength(SAMPLE_FARM_IDS.length);
    for (const link of geojsonLinks) {
      expect(link.startsWith(`${PRODUCTION_GEOJSON_URL}?content=`)).toBe(true);
    }
  });

  it("has no link to a local or non-production API", () => {
    for (const uri of uris) {
      expect(uri).not.toMatch(/localhost|127\.0\.0\.1|jollymoss/);
    }
  });

  it("carries one sample farm per link", () => {
    const ids = geojsonLinks.map((link) => {
      const content = new URL(link).searchParams.get("content");
      const geojson = JSON.parse(content ?? "null");
      expect(geojson.type).toBe("FeatureCollection");
      expect(geojson.features).toHaveLength(1);
      return geojson.features[0].properties.id;
    });
    expect(ids.sort()).toEqual(SAMPLE_FARM_IDS);
  });
});
