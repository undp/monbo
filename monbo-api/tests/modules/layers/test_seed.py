import json

import numpy as np
import pytest
import rasterio
from fastapi.testclient import TestClient
from rasterio.transform import from_origin

from app.main import create_app
from app.modules.layers.seed import SeedError, main, seed
from app.modules.layers.store import LayerStore, set_layer_store

TRANSFORM = from_origin(-76.5, -0.2, 0.00027, 0.00027)
LAYER_A = {
    "id": 0,
    "raster_filename": "a.tif",
    "attributes_filename": "a.json",
    "considerations_filename": "a.md",
    "pixel_size": 30,
    "baseline": "2020",
    "compared_against": "2023",
    "references": [],
    "available_countries_codes": ["EC"],
}
LAYER_B = {
    **LAYER_A,
    "id": 4,
    "raster_filename": "b-v3.tif",
    "attributes_filename": "b.json",
    "considerations_filename": "b.md",
}


def write_raster(path, data, **options):
    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=data.shape[1],
        height=data.shape[0],
        count=1,
        dtype=data.dtype,
        crs="EPSG:4326",
        transform=TRANSFORM,
        **options,
    ) as dst:
        dst.write(data, 1)


def binary(seed=0):
    return (np.random.default_rng(seed).random((96, 96)) > 0.8).astype("uint8")


@pytest.fixture
def source(tmp_path):
    root = tmp_path / "source"
    rasters = root / "layers" / "rasters"
    write_raster(rasters / "a.tif", binary(0), tiled=False)
    # Like ecuador2.tif: 2-bit samples with nodata 3.
    b = binary(1)
    b[:8] = 3
    write_raster(rasters / "b-v3.tif", b, nodata=3, nbits=2)
    for language in ("en", "es"):
        for name in ("a", "b"):
            attributes = root / "metadata" / "attributes" / language / f"{name}.json"
            attributes.parent.mkdir(parents=True, exist_ok=True)
            attributes.write_text(
                json.dumps({"name": f"{name} {language}", "alias": name})
            )
            notes = root / "metadata" / "considerations" / language / f"{name}.md"
            notes.parent.mkdir(parents=True, exist_ok=True)
            notes.write_text(f"notes {name} {language}")
    (root / "index.json").write_text(json.dumps([LAYER_A, LAYER_B]))
    return root


def read_pixels(path):
    with rasterio.open(path) as src:
        return src.read(1), src.profile, src.nodata


def test_seed_converts_every_layer_and_publishes_it(source, tmp_path):
    target = tmp_path / "target"

    seeded = seed(source, target, log=lambda _: None)

    assert [
        (e["id"], e["raster_filename"], e["enabled"], e["version"]) for e in seeded
    ] == [
        (0, "a-v1.tif", True, 1),
        (4, "b-v1.tif", True, 1),
    ]
    index = json.loads((target / "index.json").read_text())
    assert index[1]["pixel_size"] == 30  # everything else is kept
    for name, original in (("a-v1.tif", "a.tif"), ("b-v1.tif", "b-v3.tif")):
        cog, profile, nodata = read_pixels(target / "layers" / "rasters" / name)
        expected, _, expected_nodata = read_pixels(
            source / "layers" / "rasters" / original
        )
        assert np.array_equal(cog, expected)
        assert nodata == expected_nodata
        assert profile["tiled"] is True
        assert profile["compress"] == "deflate"
    assert (target / "metadata" / "considerations" / "es" / "b.md").read_text() == (
        "notes b es"
    )

    set_layer_store(LayerStore(target))
    try:
        public = TestClient(create_app()).get("/maps?language=es").json()
    finally:
        set_layer_store(None)
    assert [(layer["id"], layer["name"], layer["version"]) for layer in public] == [
        (0, "a es", 1),
        (4, "b es", 1),
    ]


def test_seed_skips_hidden_metadata_files(source, tmp_path):
    (source / "metadata" / ".DS_Store").write_bytes(b"finder")
    (source / "metadata" / "attributes" / ".DS_Store").write_bytes(b"finder")
    target = tmp_path / "target"

    seed(source, target, log=lambda _: None)

    assert not list((target / "metadata").rglob(".*"))
    assert (target / "metadata" / "attributes" / "es" / "a.json").is_file()


def test_seed_refuses_a_target_that_already_has_an_index(source, tmp_path):
    target = tmp_path / "target"
    target.mkdir()
    (target / "index.json").write_text("[]")

    with pytest.raises(SeedError, match="already has an index"):
        seed(source, target, log=lambda _: None)

    assert (target / "index.json").read_text() == "[]"


def test_a_non_binary_layer_aborts_and_leaves_nothing(source, tmp_path):
    data = binary(1)
    data[-1, -1] = 2
    write_raster(source / "layers" / "rasters" / "b-v3.tif", data)
    target = tmp_path / "target"

    with pytest.raises(SeedError, match=r"Layer 4 \(b-v3.tif\).*2"):
        seed(source, target, log=lambda _: None)

    assert not (target / "index.json").exists()
    assert not list((target / "layers" / "rasters").iterdir())


def test_lfs_pointers_are_reported(source, tmp_path):
    (source / "layers" / "rasters" / "a.tif").write_text(
        "version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 1\n"
    )

    with pytest.raises(SeedError, match="git lfs pull"):
        seed(source, tmp_path / "target", log=lambda _: None)


def test_cli(source, tmp_path, capsys):
    assert main(["--source", str(source), "--target", str(tmp_path / "t1")]) == 0
    assert "Seeded 2 layers" in capsys.readouterr().out

    assert main(["--source", str(source), "--target", str(tmp_path / "t1")]) == 1
    assert "Seed failed" in capsys.readouterr().err
