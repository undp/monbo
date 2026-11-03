# Assembles the "How to draw" GIF from the frames record-drawing-gif.mjs saves
# (it runs this script; see its header). Each frame gets the cursor the headless
# browser doesn't draw, and a ring on a click. One palette for all the frames, with
# no dithering, keeps the unchanged pixels identical, so each frame only stores what
# changed and the GIF stays small.
#
#   python record-drawing-gif.py <frames dir with frames.json> <output.gif>

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

# The map's own width in the modal: shown large, in the "How to draw?" dialog
WIDTH = 768
COLORS = 128
# The drawing's color in the modal (DrawingMap.tsx)
CLICK_COLOR = (255, 213, 79)
# A pointer arrow, in pixels from its tip, at the screenshots' scale
ARROW = [(0, 0), (0, 22), (5, 17), (9, 26), (13, 24), (9, 16), (16, 16)]


def draw_cursor(image: Image.Image, frame: dict) -> None:
    draw = ImageDraw.Draw(image)
    x, y = frame["x"], frame["y"]
    if frame["click"]:
        radius = 16
        draw.ellipse(
            (x - radius, y - radius, x + radius, y + radius),
            outline=CLICK_COLOR,
            width=4,
        )
    if frame["kind"] == "arrow":
        points = [(x + dx, y + dy) for dx, dy in ARROW]
        draw.polygon(points, fill="white", outline="black", width=2)
    else:
        arm = 11
        for width, color in ((5, "white"), (2, "black")):
            draw.line((x - arm, y, x + arm, y), fill=color, width=width)
            draw.line((x, y - arm, x, y + arm), fill=color, width=width)


def main(frames_dir: Path, output: Path) -> None:
    frames = json.loads((frames_dir / "frames.json").read_text())
    images = []
    for frame in frames:
        image = Image.open(frames_dir / frame["file"]).convert("RGB")
        draw_cursor(image, frame)
        height = round(image.height * WIDTH / image.width)
        images.append(image.resize((WIDTH, height), Image.Resampling.LANCZOS))

    # The last frame has every color: the map, the polygon and the buttons
    palette = images[-1].quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT)
    quantized = [
        image.quantize(palette=palette, dither=Image.Dither.NONE) for image in images
    ]
    quantized[0].save(
        output,
        save_all=True,
        append_images=quantized[1:],
        duration=[frame["duration"] for frame in frames],
        loop=0,
        disposal=1,
    )
    size = output.stat().st_size // 1024
    print(f"Wrote {output} ({len(frames)} frames, {WIDTH}×{height}, {size} KB)")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
