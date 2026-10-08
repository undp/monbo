import { readFileSync } from "node:fs";
import path from "node:path";

// Vitest runs from apps/web (pnpm --dir apps/web test).
const PUBLIC_DIR = path.join(process.cwd(), "public");

/** The bytes of a file the app serves from `public/`, e.g. "files/x.xlsx". */
export const readPublicFile = (relativePath: string): Uint8Array =>
  new Uint8Array(readFileSync(path.join(PUBLIC_DIR, relativePath)));

/**
 * Bytes as the browser's File, as an <input type="file"> would give them. Built in
 * the test environment so jsdom's FileReader can read it.
 */
export const toFile = (bytes: Uint8Array | ArrayBuffer, name: string): File =>
  new File([bytes as BlobPart], name);
