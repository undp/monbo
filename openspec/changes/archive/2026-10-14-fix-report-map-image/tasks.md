## 1. Layer order (tests first)

- [x] 1.1 Add tests in `tests/utils/test_map_image_generator.py` that call `MapImageGenerator.generate` with `include_satelital_background=False` and a small synthetic loss raster (written to `tmp_path`, all loss under the polygon's edge): a polygon whose outline crosses loss pixels, and a point over loss pixels. Assert that a pixel on the outline is yellow (R and G high, B low), not red. Confirm they fail on the current code.
- [x] 1.2 In `MapImageGenerator.generate`, append the deforestation overlay before the farm overlay, and update the docstring's layer order.
- [x] 1.3 Run 1.1 and see it pass.

## 2. Image size (tests first)

- [x] 2.1 Add tests in the same file: a tall, narrow polygon (north–south extent ≥ 5× east–west) and a wide one, both at a fixed latitude. Using the zoom and size `generate` uses (`GoogleMapsAPIHelper.calculate_zoom_from_bounds` and `get_image_bounds`), assert every vertex falls inside the image at least the padding away from the binding edges. Assert the returned image is 640×420. Confirm the size assertion fails on the current code.
- [x] 2.2 Change `MapDefaults.OUTPUT_SIZE` to `(640, 420)` in `constants.py`, with a comment that the web's farm page map box (`apps/web/src/utils/deforestationReport/styles.ts`) uses the same aspect ratio.
- [x] 2.3 Update `test_generate_image_checks_the_analysed_version` (and the mock images in `test_router.py`) to expect 640×420.
- [x] 2.4 Run the API tests (`uv run pytest` in `apps/api`) and see them pass.

## 3. PDF map box

- [x] 3.1 In `styles.ts`, give `farmMapPageMapImage` an explicit width (the A4 content width, 595.28 − 2 × 30 pt) and a height of that width × 420/640, and `objectFit: "contain"`. Remove `height: "95%"` and the container's `maxHeight: "370px"`. Comment that the ratio matches the API's `MapDefaults.OUTPUT_SIZE`.
- [x] 3.2 Run the web checks (`pnpm test`, type-check, lint) in `apps/web`.

## 4. Verify in the app

- [x] 4.1 Generate a report with the two farms from the screenshots (the pentagon with loss across its southern edge, and the tall north–south strip) with the satellite background. Check the outline is visible over the red, the strip is whole with padding above and below, and the farm page layout (disclaimer, footer) is unchanged. Save screenshots under `.context/`.
- [x] 4.2 Generate the same report with the solid background (over the satellite limit) and check the same.

## 5. Docs

- [x] 5.1 Add two "Fixed" entries to `CHANGELOG.md` under `[Unreleased]`: the farm's outline is drawn above the deforestation in the report's maps, and tall farms are no longer cut off (the images are now 640×420).
