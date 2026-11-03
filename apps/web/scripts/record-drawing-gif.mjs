// Records public/images/manual-farm-drawing-{es,en}.gif, the "How to draw" animation
// of the manual farm modal: clicks on the satellite map add the vertices, "Close
// polygon" closes it, and a vertex is dragged. It drives the real modal with
// Playwright, saves a screenshot of the map and its buttons per frame, and
// record-drawing-gif.py assembles them with Pillow (with a drawn cursor: headless
// screenshots have none). Re-run it when the modal's look changes.
//
// It needs:
// - the app running with a Google Maps key (the API isn't used), e.g. from the repo
//   root: `pnpm --dir apps/web dev`, with NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY set;
// - Playwright installed outside the repo (it isn't a dependency), e.g.
//   `npm i --prefix /tmp/pw playwright@1.57.0 && npx --prefix /tmp/pw playwright
//   install chromium-headless-shell`;
// - uv, for the API's environment, which has Pillow.
//
// Then, from the repo root:
//
//   PLAYWRIGHT=/tmp/pw/node_modules/playwright BASE_URL=http://localhost:3000 \
//     node apps/web/scripts/record-drawing-gif.mjs
//
// CHROMIUM may give the browser's executable, if Playwright can't find its own.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(WEB, "../..");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT ?? "playwright"
);

// A coffee plot in Barva, Heredia (Costa Rica), and the polygon drawn over it, in
// pixels from the map's center (the map is 768×440 at this viewport)
const FARM = { lat: 10.0363, lng: -84.1268 };
const VERTICES = [
  [-133, -92],
  [47, -97],
  [62, 33],
  [-58, 73],
  [-148, 23],
];
// The vertex dragged once the polygon is closed, and where to
const DRAG = { vertex: 2, to: [92, 52] };
const VIEWPORT = { width: 1440, height: 900 };
// Frame timing, in milliseconds
const STEP = 80;
const MOVE_STEPS = 6;

const locale = (language, namespace) =>
  JSON.parse(
    readFileSync(path.join(WEB, `src/locales/${language}/${namespace}.json`), "utf8")
  );

const record = async (browser, language, framesDir) => {
  const { goTo, actions, howTo } = locale(language, "manualFarm");
  const { farmsUpload } = locale(language, "common");

  const context = await browser.newContext({ viewport: VIEWPORT });
  // Any country: the map is moved to the farm
  await context.addInitScript(() =>
    sessionStorage.setItem("monbo.selectedCountry", "CR")
  );
  const page = await context.newPage();
  const prefix = language === "es" ? "" : `/${language}`;
  await page.goto(`${BASE_URL}${prefix}/polygons-validation/upload-data`);
  await page.getByRole("button", { name: farmsUpload.addManually }).first().click();
  const dialog = page.getByRole("dialog");
  const map = dialog.locator(".gm-style").first();
  await map.waitFor({ timeout: 30000 });

  await dialog.getByLabel(goTo.latitude).fill(String(FARM.lat));
  await dialog.getByLabel(goTo.longitude).fill(String(FARM.lng));
  await dialog.getByRole("button", { name: actions.go, exact: true }).click();
  // The animation's own button isn't recorded in it
  const howToButton = dialog.getByRole("button", { name: howTo.button });
  if (await howToButton.count()) {
    await howToButton.evaluate((button) => {
      button.style.visibility = "hidden";
    });
  }
  await page.mouse.move(0, 0);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // The map and the row of buttons above it
  const mapBox = await map.boundingBox();
  const modeBox = await dialog.getByRole("group").first().boundingBox();
  const top = Math.floor(modeBox.y) - 8;
  const clip = {
    x: Math.floor(mapBox.x),
    y: top,
    width: Math.round(mapBox.width),
    height: Math.round(mapBox.y + mapBox.height - top),
  };
  const center = [mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2];
  const onMap = ([dx, dy]) => [center[0] + dx, center[1] + dy];

  const frames = [];
  let cursor = onMap([40, 160]);
  const frame = async ({ duration = STEP, click = false, kind = "crosshair" } = {}) => {
    const file = `${String(frames.length).padStart(3, "0")}.png`;
    await page.screenshot({ path: path.join(framesDir, file), clip });
    frames.push({
      file,
      duration,
      click,
      kind,
      x: cursor[0] - clip.x,
      y: cursor[1] - clip.y,
    });
  };
  // The cursor glides to the target, a frame per step
  const moveTo = async (target, kind, { pressed = false } = {}) => {
    const [fromX, fromY] = cursor;
    for (let step = 1; step <= MOVE_STEPS; step++) {
      const ease = 0.5 - Math.cos((Math.PI * step) / MOVE_STEPS) / 2;
      cursor = [fromX + (target[0] - fromX) * ease, fromY + (target[1] - fromY) * ease];
      await page.mouse.move(...cursor);
      if (pressed) await page.waitForTimeout(60);
      await frame({ kind });
    }
  };
  const click = async (kind, hold) => {
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(300);
    await frame({ click: true, kind, duration: hold });
  };

  await page.mouse.move(...cursor);
  await frame({ duration: 900 });
  for (const vertex of VERTICES) {
    await moveTo(onMap(vertex), "crosshair");
    await click("crosshair", 450);
  }

  const finish = await dialog
    .getByRole("button", { name: actions.finish, exact: true })
    .boundingBox();
  await moveTo([finish.x + finish.width / 2, finish.y + finish.height / 2], "arrow");
  await frame({ kind: "arrow", duration: 300 });
  await click("arrow", 900);

  await moveTo(onMap(VERTICES[DRAG.vertex]), "arrow");
  await frame({ kind: "arrow", duration: 300 });
  await page.mouse.down();
  await moveTo(onMap(DRAG.to), "arrow", { pressed: true });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await frame({ kind: "arrow", duration: 400 });
  await moveTo(onMap([150, 140]), "crosshair");
  await frame({ duration: 2200 });

  await context.close();
  return frames;
};

const browser = await chromium.launch(
  process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}
);
try {
  for (const language of ["es", "en"]) {
    const framesDir = mkdtempSync(path.join(tmpdir(), `monbo-drawing-${language}-`));
    try {
      const frames = await record(browser, language, framesDir);
      writeFileSync(path.join(framesDir, "frames.json"), JSON.stringify(frames));
      const output = path.join(WEB, `public/images/manual-farm-drawing-${language}.gif`);
      mkdirSync(path.dirname(output), { recursive: true });
      execFileSync(
        "uv",
        [
          "run",
          "--directory",
          path.join(REPO, "apps/api"),
          "python",
          "-I",
          path.join(WEB, "scripts/record-drawing-gif.py"),
          framesDir,
          output,
        ],
        { stdio: "inherit" }
      );
    } finally {
      rmSync(framesDir, { recursive: true, force: true });
    }
  }
} finally {
  await browser.close();
}
