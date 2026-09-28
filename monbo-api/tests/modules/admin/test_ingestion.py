import json

import numpy as np
import pytest
import rasterio
from fastapi.testclient import TestClient
from rasterio.transform import from_origin

from app.config import env
from app.main import create_app
from app.modules.admin import ingestion
from app.modules.admin.ingestion import ingestion_slot, new_job

GFW = {
    "id": 0,
    "raster_filename": "gfw.tif",
    "attributes_filename": "gfw.json",
    "considerations_filename": "gfw.md",
    "pixel_size": 30,
    "baseline": "2020",
    "compared_against": "2023",
    "references": [],
    "available_countries_codes": ["EC"],
}
NEW = {
    **GFW,
    "id": 6,
    "raster_filename": None,
    "attributes_filename": "layer-6.json",
    "considerations_filename": "layer-6.md",
    "enabled": False,
    "version": 1,
}
# ~30 m pixels over the Ecuadorian Amazon
TRANSFORM = from_origin(-76.5, -0.2, 0.00027, 0.00027)


def binary(size=64, seed=0):
    return (np.random.default_rng(seed).random((size, size)) > 0.8).astype("uint8")


def write_tif(path, data, *, crs="EPSG:4326", nodata=None, driver="GTiff", **options):
    data = data if data.ndim == 3 else data[np.newaxis]
    profile = {
        "driver": driver,
        "width": data.shape[2],
        "height": data.shape[1],
        "count": data.shape[0],
        "dtype": data.dtype,
        "transform": TRANSFORM,
        **options,
    }
    if crs:
        profile["crs"] = crs
    if nodata is not None:
        profile["nodata"] = nodata
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(data)
    return path.read_bytes()


@pytest.fixture
def staging(tmp_path, monkeypatch):
    directory = tmp_path / "staging"
    monkeypatch.setattr(env, "ADMIN_STAGING_DIR", str(directory))
    return directory


@pytest.fixture
def layers(maps_root, staging):
    maps_root.write_index([GFW, NEW])
    maps_root.store.rasters_dir.mkdir(parents=True)
    write_tif(maps_root.store.rasters_dir / "gfw.tif", binary(), tiled=False)
    return maps_root


def upload(client, headers, content, layer_id=6, **params):
    return client.put(
        f"/admin/layers/{layer_id}/raster",
        params=params,
        content=content,
        headers={**headers, "Content-Type": "image/tiff"},
    )


def job_for(client, headers, response):
    assert response.status_code == 202, response.text
    job = client.get(f"/admin/jobs/{response.json()['jobId']}", headers=headers)
    assert job.status_code == 200
    return job.json()


def entry(maps_root, layer_id):
    index = json.loads(maps_root.store.index_path.read_text())
    return next(e for e in index if e["id"] == layer_id)


def assert_no_staging_left(maps_root, staging):
    assert not [p for p in staging.glob("*") if p.is_file()]
    assert not [p for p in maps_root.store.staging_dir.glob("*") if p.is_file()]


# --- Success -----------------------------------------------------------------------


def test_valid_upload_is_converted_and_activated(
    layers, staging, client, admin_headers, tmp_path
):
    data = binary(size=2048)
    # Strip-organized and uncompressed, like several of the current layers.
    content = write_tif(tmp_path / "in.tif", data, tiled=False)

    job = job_for(client, admin_headers, upload(client, admin_headers, content))

    assert job["status"] == "succeeded"
    assert job["error"] is None
    assert job["rasterFilename"] == "layer-6-v2.tif"
    assert job["version"] == 2
    report = job["report"]
    assert report["crs"] == "EPSG:4326"
    assert (report["width"], report["height"]) == (2048, 2048)
    assert report["dtype"] == "uint8"
    assert report["values"] == [0, 1]
    assert 25 < report["approxResolutionM"] < 35

    assert entry(layers, 6)["raster_filename"] == "layer-6-v2.tif"
    assert entry(layers, 6)["version"] == 2
    with rasterio.open(layers.root / "layers" / "rasters" / "layer-6-v2.tif") as cog:
        assert cog.profile["tiled"] is True
        assert cog.profile["compress"] == "deflate"
        assert cog.overviews(1)
        assert np.array_equal(cog.read(1), data)
    assert_no_staging_left(layers, staging)

    # Now it can be published and its tiles are served.
    assert (
        client.patch(
            "/admin/layers/6", json={"enabled": True}, headers=admin_headers
        ).status_code
        == 200
    )
    public = TestClient(create_app()).get("/maps").json()
    assert next(layer for layer in public if layer["id"] == 6)["version"] == 2
    tile = client.get("/deforestation_analysis/tiles/6/dynamic/14/4710/8201.png")
    assert tile.status_code == 200


def test_replacing_a_raster_keeps_the_previous_file(
    layers, client, admin_headers, tmp_path
):
    content = write_tif(tmp_path / "in.tif", binary(seed=1))

    first = job_for(client, admin_headers, upload(client, admin_headers, content, 0))
    second = job_for(client, admin_headers, upload(client, admin_headers, content, 0))

    assert (first["rasterFilename"], first["version"]) == ("gfw-v2.tif", 2)
    assert (second["rasterFilename"], second["version"]) == ("gfw-v3.tif", 3)
    rasters = layers.root / "layers" / "rasters"
    assert {p.name for p in rasters.iterdir()} == {
        "gfw.tif",
        "gfw-v2.tif",
        "gfw-v3.tif",
    }


def test_bit_packed_rasters_are_converted(layers, client, admin_headers, tmp_path):
    """Like ecuador2.tif: 2-bit samples with nodata 3."""
    data = binary()
    data[:4, :] = 3
    content = write_tif(tmp_path / "in.tif", data, nodata=3, nbits=2, tiled=False)

    job = job_for(client, admin_headers, upload(client, admin_headers, content))

    assert job["status"] == "succeeded", job["error"]
    with rasterio.open(layers.store.rasters_dir / job["rasterFilename"]) as cog:
        assert np.array_equal(cog.read(1), data)
        assert cog.nodata == 3


def test_job_is_running_while_it_converts(
    layers, client, admin_headers, tmp_path, monkeypatch
):
    seen = {}
    real_convert = ingestion.convert_to_cog

    def spy(src, dst):
        job_id = src.stem
        seen["status"] = layers.store.read_job(job_id)["status"]
        real_convert(src, dst)

    monkeypatch.setattr(ingestion, "convert_to_cog", spy)

    upload(client, admin_headers, write_tif(tmp_path / "in.tif", binary()))

    assert seen["status"] == "running"


def test_custom_nodata(layers, client, admin_headers, tmp_path):
    data = binary()
    data[:4, :] = 3
    content = write_tif(tmp_path / "in.tif", data)

    without = job_for(client, admin_headers, upload(client, admin_headers, content))
    assert without["status"] == "failed"
    assert without["error"]["code"] == "not_binary"
    assert without["error"]["params"]["values"] == [3]
    assert "upload again with that nodata" in without["error"]["message"]

    with_nodata = job_for(
        client, admin_headers, upload(client, admin_headers, content, nodata=3)
    )
    assert with_nodata["status"] == "succeeded"
    assert with_nodata["report"]["nodata"] == 3
    path = layers.root / "layers" / "rasters" / with_nodata["rasterFilename"]
    with rasterio.open(path) as cog:
        assert cog.nodata == 3


def test_declared_nodata_wins_over_the_requested_one(
    layers, client, admin_headers, tmp_path
):
    content = write_tif(tmp_path / "in.tif", binary(), nodata=255)

    job = job_for(
        client, admin_headers, upload(client, admin_headers, content, nodata=3)
    )

    assert job["status"] == "succeeded"
    assert [w["code"] for w in job["warnings"]] == ["nodata_ignored"]
    assert job["report"]["nodata"] == 255


def test_all_zeros_succeeds_with_a_warning(layers, client, admin_headers, tmp_path):
    content = write_tif(tmp_path / "in.tif", np.zeros((64, 64), "uint8"))

    job = job_for(client, admin_headers, upload(client, admin_headers, content))

    assert job["status"] == "succeeded"
    assert [w["code"] for w in job["warnings"]] == ["no_loss_pixels"]


# --- Rejected rasters --------------------------------------------------------------


def stray_value(data):
    data = data.copy()
    data[-1, -1] = 2
    return data


@pytest.mark.parametrize(
    "make, code, params",
    [
        (lambda p: write_tif(p, stray_value(binary())), "not_binary", {"values": [2]}),
        (
            lambda p: write_tif(
                p, np.array([[0, 2021], [2022, 2023]] * 32, "uint16").repeat(32, 1)
            ),
            "loss_years",
            {"values": [2021, 2022, 2023]},
        ),
        (lambda p: write_tif(p, np.stack([binary()] * 3)), "band_count", {"bands": 3}),
        (
            lambda p: write_tif(p, binary().astype("float32")),
            "not_integer",
            {"dtype": "float32"},
        ),
        (lambda p: write_tif(p, binary(), crs=None), "no_crs", {}),
        (lambda p: write_tif(p, binary(), crs=None, driver="PNG"), "not_geotiff", {}),
        (lambda p: b"this is not a raster at all", "not_geotiff", {}),
    ],
    ids=["stray", "loss-years", "bands", "float", "no-crs", "png", "garbage"],
)
def test_invalid_rasters_are_rejected(
    layers, staging, client, admin_headers, tmp_path, make, code, params
):
    job = job_for(
        client, admin_headers, upload(client, admin_headers, make(tmp_path / "in.tif"))
    )

    assert job["status"] == "failed"
    assert job["error"]["code"] == code
    for key, value in params.items():
        assert job["error"]["params"][key] == value
    # The layer is untouched and nothing is left behind.
    assert entry(layers, 6)["raster_filename"] is None
    assert entry(layers, 6)["version"] == 1
    assert_no_staging_left(layers, staging)


def test_loss_years_message_explains_what_to_do(
    layers, client, admin_headers, tmp_path
):
    data = np.full((64, 64), 2021, "uint16")
    job = job_for(
        client,
        admin_headers,
        upload(client, admin_headers, write_tif(tmp_path / "in.tif", data)),
    )

    assert "look like loss years" in job["error"]["message"]


def test_verification_mismatch_leaves_the_layer_unchanged(
    layers, client, admin_headers, tmp_path, monkeypatch
):
    def corrupting_convert(src, dst):
        with rasterio.open(src) as source:
            profile = source.profile
            data = source.read(1)
        data[0, 0] = 1 - data[0, 0]
        with rasterio.open(dst, "w", **profile) as out:
            out.write(data, 1)

    monkeypatch.setattr(ingestion, "convert_to_cog", corrupting_convert)

    job = job_for(
        client,
        admin_headers,
        upload(client, admin_headers, write_tif(tmp_path / "in.tif", binary())),
    )

    assert job["error"]["code"] == "conversion_mismatch"
    assert entry(layers, 6)["raster_filename"] is None
    assert not list((layers.root / "layers" / "rasters").glob("layer-6*"))


# --- Upload handling ---------------------------------------------------------------


def test_upload_requires_an_admin_session(layers, client):
    response = client.put("/admin/layers/6/raster", content=b"x")

    assert response.status_code == 401


def test_unknown_layer_is_404(layers, client, admin_headers):
    assert upload(client, admin_headers, b"x", layer_id=999).status_code == 404


def test_fractional_nodata_is_422(layers, client, admin_headers):
    assert upload(client, admin_headers, b"x", nodata=3.5).status_code == 422


def test_empty_body_is_400(layers, staging, client, admin_headers):
    assert upload(client, admin_headers, b"").status_code == 400
    assert_no_staging_left(layers, staging)


def test_oversized_upload_is_413(
    layers, staging, client, admin_headers, monkeypatch, tmp_path
):
    monkeypatch.setattr(env, "ADMIN_MAX_UPLOAD_MB", 1)
    big = b"\0" * (2 * 1024 * 1024)

    assert upload(client, admin_headers, big).status_code == 413

    # Without a Content-Length (chunked), the limit is enforced while streaming.
    def chunks():
        for _ in range(32):
            yield b"\0" * (64 * 1024)

    assert upload(client, admin_headers, chunks()).status_code == 413
    assert_no_staging_left(layers, staging)
    # The slot was released: the next upload goes through.
    ok = upload(client, admin_headers, write_tif(tmp_path / "in.tif", binary()))
    assert ok.status_code == 202


def test_only_one_ingestion_at_a_time(layers, client, admin_headers, tmp_path):
    assert ingestion_slot.acquire("a" * 32)
    try:
        response = upload(
            client, admin_headers, write_tif(tmp_path / "in.tif", binary())
        )
    finally:
        ingestion_slot.release("a" * 32)

    assert response.status_code == 409


@pytest.mark.parametrize("job_id", ["0" * 32, "not-a-job", "..%2F..%2Findex"])
def test_unknown_jobs_are_404(layers, client, admin_headers, job_id):
    assert client.get(f"/admin/jobs/{job_id}", headers=admin_headers).status_code == 404


# --- Restart ---------------------------------------------------------------------


def test_restart_marks_interrupted_jobs_failed_and_cleans_staging(
    layers, staging, admin_env
):
    running = {**new_job("b" * 32, 6, None), "status": "running"}
    done = {**new_job("c" * 32, 6, None), "status": "succeeded"}
    layers.store.write_job(running)
    layers.store.write_job(done)
    staging.mkdir()
    (staging / f"{'b' * 32}.tif").write_bytes(b"partial")
    layers.store.staging_dir.mkdir(parents=True)
    (layers.store.staging_dir / f"{'b' * 32}.tif").write_bytes(b"partial")

    with TestClient(create_app()):  # runs the startup hook
        pass

    assert layers.store.read_job("b" * 32)["status"] == "failed"
    assert layers.store.read_job("b" * 32)["error"]["code"] == "interrupted"
    assert layers.store.read_job("c" * 32)["status"] == "succeeded"
    assert_no_staging_left(layers, staging)
    assert entry(layers, 6)["raster_filename"] is None
