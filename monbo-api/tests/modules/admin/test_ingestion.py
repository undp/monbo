import json
import os
import time

import numpy as np
import pytest
import rasterio
from fastapi.testclient import TestClient
from rasterio.transform import from_origin

from app.config import env
from app.main import create_app
from app.modules.admin import ingestion
from app.modules.admin.ingestion import ingestion_slot, new_job
from tests.modules.admin.support import COUNTRY_PASSKEYS, bearer, login

GFW = {
    "id": 0,
    "raster_filename": "gfw.tif",
    "attributes_filename": "gfw.json",
    "considerations_filename": "gfw.md",
    "pixel_size": 30,
    "baseline": "2020",
    "compared_against": "2023",
    "references": [],
}
NEW = {
    **GFW,
    "id": 6,
    "raster_filename": None,
    "attributes_filename": "layer-6.json",
    "considerations_filename": "layer-6.md",
    "enabled": False,
    "version": 0,  # created in the admin, no raster yet
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
def layers(colombia, country_root, staging):
    """Colombia's layers (the admin session's country), plus one in Ecuador."""
    colombia.write_index([GFW, NEW])
    colombia.store.rasters_dir.mkdir(parents=True)
    write_tif(colombia.store.rasters_dir / "gfw.tif", binary(), tiled=False)
    country_root.country("EC").write_index([{**NEW, "id": 7}])
    return colombia


def ecuador_headers(client):
    return bearer(login(client, passkey=COUNTRY_PASSKEYS["EC"]).json()["token"])


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


def entry(country, layer_id):
    index = json.loads(country.store.index_path.read_text())
    return next(e for e in index if e["id"] == layer_id)


def assert_no_staging_left(country, staging):
    assert not [p for p in staging.glob("*") if p.is_file()]
    assert not [p for p in country.jobs.staging_dir.glob("*") if p.is_file()]


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
    assert job["country"] == "CO"
    assert job["rasterFilename"] == "layer-6-v1.tif"
    assert job["version"] == 1
    report = job["report"]
    assert report["crs"] == "EPSG:4326"
    assert (report["width"], report["height"]) == (2048, 2048)
    assert report["dtype"] == "uint8"
    assert report["values"] == [0, 1]
    assert 25 < report["approxResolutionM"] < 35

    assert entry(layers, 6)["raster_filename"] == "layer-6-v1.tif"
    assert entry(layers, 6)["version"] == 1
    with rasterio.open(layers.root / "layers" / "rasters" / "layer-6-v1.tif") as cog:
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
    assert next(layer for layer in public if layer["id"] == 6)["version"] == 1
    tile = client.get("/deforestation_analysis/tiles/CO/6/dynamic/14/4710/8201.png")
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
        seen["status"] = layers.jobs.read_job(job_id)["status"]
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


@pytest.mark.parametrize("declared", [True, False])
def test_loss_value_cannot_be_nodata(layers, client, admin_headers, tmp_path, declared):
    content = write_tif(tmp_path / "in.tif", binary(), nodata=1 if declared else None)
    params = {} if declared else {"nodata": 1}

    job = job_for(
        client, admin_headers, upload(client, admin_headers, content, **params)
    )

    assert job["status"] == "failed"
    assert job["error"]["code"] == "nodata_is_loss"
    assert entry(layers, 6)["raster_filename"] is None


def test_upload_rejects_resolution_mismatch(layers, client, admin_headers, tmp_path):
    # 10 m raster, but the layer is configured as 30 m. Accepting it would
    # multiply every deforested area by nine.
    content = write_tif(
        tmp_path / "in.tif",
        binary(),
        transform=from_origin(-76.5, -0.2, 0.00009, 0.00009),
    )

    job = job_for(client, admin_headers, upload(client, admin_headers, content))

    assert job["status"] == "failed"
    assert job["error"]["code"] == "resolution_mismatch"
    assert job["error"]["params"]["declared"] == 30
    assert 9 < job["error"]["params"]["measured"] < 11
    assert entry(layers, 6)["raster_filename"] is None


def test_edit_during_conversion_cannot_activate_a_mismatched_raster(
    layers, client, admin_headers, tmp_path, monkeypatch
):
    content = write_tif(tmp_path / "in.tif", binary())
    real_convert = ingestion.convert_to_cog

    def edit_layer_while_converting(src, dst):
        index = layers.store.read_index()
        index[1]["pixel_size"] = 10
        layers.store.write_index(index)
        real_convert(src, dst)

    monkeypatch.setattr(ingestion, "convert_to_cog", edit_layer_while_converting)

    job = job_for(client, admin_headers, upload(client, admin_headers, content))

    assert job["status"] == "failed"
    assert job["error"]["code"] == "resolution_mismatch"
    assert entry(layers, 6)["raster_filename"] is None


def test_all_zeros_succeeds_with_a_warning(layers, client, admin_headers, tmp_path):
    content = write_tif(tmp_path / "in.tif", np.zeros((64, 64), "uint8"))

    job = job_for(client, admin_headers, upload(client, admin_headers, content))

    assert job["status"] == "succeeded"
    assert [w["code"] for w in job["warnings"]] == ["no_loss_pixels"]


# --- Rejected rasters --------------------------------------------------------------


def vrt(path):
    """A VRT (XML) that points GDAL at another file on the server."""
    source = write_tif(path.with_name("source.tif"), binary())
    assert source
    return (
        '<VRTDataset rasterXSize="64" rasterYSize="64"><VRTRasterBand dataType="Byte" '
        'band="1"><SimpleSource><SourceFilename relativeToVRT="0">'
        f"{path.with_name('source.tif')}</SourceFilename><SourceBand>1</SourceBand>"
        "</SimpleSource></VRTRasterBand></VRTDataset>"
    ).encode()


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
        (vrt, "not_geotiff", {}),
    ],
    ids=["stray", "loss-years", "bands", "float", "no-crs", "png", "garbage", "vrt"],
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
    assert entry(layers, 6)["version"] == 0
    assert_no_staging_left(layers, staging)


def test_only_the_gtiff_driver_parses_uploads(tmp_path, monkeypatch):
    # GDAL must not even try other drivers: a VRT or WMS XML is parsed at open time
    # and can make the server read local files or URLs.
    from app.modules.layers import processing

    path = tmp_path / "in.tif"
    path.write_bytes(vrt(path))
    opened = []
    real_open = processing.rasterio.open

    def spy(path, *args, **kwargs):
        opened.append(kwargs.get("driver"))
        return real_open(path, *args, **kwargs)

    monkeypatch.setattr(processing.rasterio, "open", spy)

    with pytest.raises(processing.IngestionError, match="GeoTIFF"):
        processing.validate_raster(path, None)
    assert opened == ["GTiff"]


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


def test_another_countrys_layer_is_404(layers, staging, client, admin_headers):
    # Layer 7 is Ecuador's.
    assert upload(client, admin_headers, b"x", layer_id=7).status_code == 404
    assert_no_staging_left(layers, staging)


def test_another_countrys_job_is_404(layers, client, admin_headers, tmp_path):
    response = upload(client, admin_headers, write_tif(tmp_path / "in.tif", binary()))
    job_id = response.json()["jobId"]

    assert client.get(f"/admin/jobs/{job_id}", headers=admin_headers).status_code == 200
    ecuador = client.get(f"/admin/jobs/{job_id}", headers=ecuador_headers(client))
    assert ecuador.status_code == 404


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


def test_a_busy_slot_does_not_name_the_other_country(layers, client, tmp_path):
    """A CO job holds the slot; an EC admin is told to retry, nothing more."""
    assert ingestion_slot.acquire("a" * 32)
    try:
        response = upload(
            client,
            ecuador_headers(client),
            write_tif(tmp_path / "in.tif", binary()),
            layer_id=7,
        )
    finally:
        ingestion_slot.release("a" * 32)

    assert response.status_code == 409
    assert "CO" not in response.text
    assert "Colombia" not in response.text


@pytest.mark.parametrize("job_id", ["0" * 32, "not-a-job", "..%2F..%2Findex"])
def test_unknown_jobs_are_404(layers, client, admin_headers, job_id):
    assert client.get(f"/admin/jobs/{job_id}", headers=admin_headers).status_code == 404


# --- Restart ---------------------------------------------------------------------


STALE = "2026-01-01T00:00:00Z"


def make_old(path):
    stale = time.time() - ingestion.STALE_JOB_SECONDS - 60
    os.utime(path, (stale, stale))


def test_restart_marks_interrupted_jobs_failed_and_cleans_staging(
    layers, staging, admin_env
):
    running = {
        **new_job("b" * 32, "CO", 6, None),
        "status": "running",
        "updatedAt": STALE,
    }
    done = {**new_job("c" * 32, "CO", 6, None), "status": "succeeded"}
    layers.jobs.write_job(running)
    layers.jobs.write_job(done)
    staging.mkdir()
    (staging / f"{'b' * 32}.tif").write_bytes(b"partial")
    layers.jobs.staging_dir.mkdir(parents=True)
    (layers.jobs.staging_dir / f"{'b' * 32}.tif").write_bytes(b"partial")
    make_old(layers.jobs.staging_dir / f"{'b' * 32}.tif")

    with TestClient(create_app()):  # runs the startup hook
        pass

    assert layers.jobs.read_job("b" * 32)["status"] == "failed"
    assert layers.jobs.read_job("b" * 32)["error"]["code"] == "interrupted"
    assert layers.jobs.read_job("c" * 32)["status"] == "succeeded"
    assert_no_staging_left(layers, staging)
    assert entry(layers, 6)["raster_filename"] is None


# --- Phase and progress ------------------------------------------------------------


def test_job_reports_its_phase_and_validation_progress(
    layers, client, admin_headers, tmp_path, monkeypatch
):
    """A 4x4-window raster: progress is written as validation advances, throttled,
    then the job moves to converting."""
    from app.modules.layers import processing

    monkeypatch.setattr(processing, "WINDOW_SIZE", 16)
    monkeypatch.setattr(ingestion, "PROGRESS_INTERVAL_S", 0)
    monkeypatch.setattr(ingestion, "PROGRESS_STEP", 0.25)
    seen = []
    real_write = layers.jobs.write_job

    def record(job):
        seen.append((job["status"], job["phase"], job["progress"]))
        real_write(job)

    monkeypatch.setattr(type(layers.jobs), "write_job", lambda self, job: record(job))

    job = job_for(
        client,
        admin_headers,
        upload(client, admin_headers, write_tif(tmp_path / "in.tif", binary())),
    )

    assert job["status"] == "succeeded"
    assert (job["phase"], job["progress"]) == (None, None)
    validating = [p for status, phase, p in seen if phase == "validating"]
    assert validating == [0, 0.25, 0.5, 0.75, 1.0]  # 16 windows, one write per 25%
    assert ("running", "converting", None) in seen
    assert seen.index(("running", "converting", None)) > len(validating)


def test_a_failed_progress_write_doesnt_fail_the_ingestion(
    layers, client, admin_headers, tmp_path, monkeypatch
):
    from app.modules.layers import processing

    monkeypatch.setattr(processing, "WINDOW_SIZE", 16)
    monkeypatch.setattr(ingestion, "PROGRESS_INTERVAL_S", 0)
    real_write = type(layers.jobs).write_job

    def flaky(self, job):
        if job["phase"] == "validating" and job["progress"]:
            raise OSError("the share hiccuped")
        real_write(self, job)

    monkeypatch.setattr(type(layers.jobs), "write_job", flaky)

    job = job_for(
        client,
        admin_headers,
        upload(client, admin_headers, write_tif(tmp_path / "in.tif", binary())),
    )

    assert job["status"] == "succeeded"


def test_progress_writes_are_throttled_in_time(layers, monkeypatch):
    monkeypatch.setattr(ingestion, "PROGRESS_INTERVAL_S", 3600)
    job = new_job("d" * 32, "CO", 6, None)
    writes = []
    monkeypatch.setattr(
        type(layers.jobs), "write_job", lambda self, j: writes.append(j)
    )
    progress = ingestion._ValidationProgress(layers.jobs, job)

    for done in range(1, 1001):
        progress(done, 1000)

    assert writes == []


# --- Cancellation ------------------------------------------------------------------


def cancel(client, headers, job_id):
    return client.delete(f"/admin/jobs/{job_id}", headers=headers)


def cancel_during(monkeypatch, function_name):
    """Cancel the job from inside `function_name`, as a DELETE arriving meanwhile
    would (TestClient runs the background task within the upload request)."""
    real = getattr(ingestion, function_name)
    outcome = {}

    def cancelling(src, *args, **kwargs):
        if "cancel" not in outcome:  # only the first job
            outcome["cancel"] = ingestion_slot.cancel(ingestion_slot.job_id)
        return real(src, *args, **kwargs)

    monkeypatch.setattr(ingestion, function_name, cancelling)
    return outcome


def test_cancel_during_validation(
    layers, staging, client, admin_headers, tmp_path, monkeypatch
):
    from app.modules.layers import processing

    monkeypatch.setattr(processing, "WINDOW_SIZE", 16)
    outcome = cancel_during(monkeypatch, "validate_raster")

    job = job_for(
        client,
        admin_headers,
        upload(client, admin_headers, write_tif(tmp_path / "in.tif", binary())),
    )

    assert outcome["cancel"] == "cancelled"
    assert job["status"] == "cancelled"
    assert job["error"] is None
    assert entry(layers, 6)["raster_filename"] is None
    assert_no_staging_left(layers, staging)
    # The slot was released: a new upload goes through.
    ok = upload(client, admin_headers, write_tif(tmp_path / "in.tif", binary()))
    assert job_for(client, admin_headers, ok)["status"] == "succeeded"


def test_cancel_during_conversion_takes_effect_when_it_returns(
    layers, staging, client, admin_headers, tmp_path, monkeypatch
):
    outcome = cancel_during(monkeypatch, "convert_to_cog")

    job = job_for(
        client,
        admin_headers,
        upload(client, admin_headers, write_tif(tmp_path / "in.tif", binary())),
    )

    assert outcome["cancel"] == "cancelled"
    assert job["status"] == "cancelled"
    assert entry(layers, 6)["raster_filename"] is None
    assert entry(layers, 6)["version"] == 0
    assert_no_staging_left(layers, staging)


def test_cancelling_once_activation_began_is_too_late(
    layers, client, admin_headers, tmp_path, monkeypatch
):
    outcome = cancel_during(monkeypatch, "activate")

    job = job_for(
        client,
        admin_headers,
        upload(client, admin_headers, write_tif(tmp_path / "in.tif", binary())),
    )

    assert outcome["cancel"] == "too_late"
    assert job["status"] == "succeeded"
    assert entry(layers, 6)["raster_filename"] == "layer-6-v1.tif"


def running_job(layers, job_id, country="CO"):
    """A job holding the slot, as while the background task runs."""
    layers.jobs.write_job({**new_job(job_id, country, 6, None), "status": "running"})
    assert ingestion_slot.acquire(job_id)


def test_cancel_endpoint(layers, client, admin_headers):
    running_job(layers, "e" * 32)
    try:
        response = cancel(client, admin_headers, "e" * 32)
        assert response.status_code == 202
        assert ingestion_slot.is_cancelled("e" * 32)
        # Once cancelled, activation is refused.
        assert ingestion_slot.begin_activation("e" * 32) is False
    finally:
        ingestion_slot.release("e" * 32)


def test_cancel_endpoint_after_activation_began_is_409(layers, client, admin_headers):
    running_job(layers, "e" * 32)
    try:
        assert ingestion_slot.begin_activation("e" * 32)
        assert cancel(client, admin_headers, "e" * 32).status_code == 409
        assert not ingestion_slot.is_cancelled("e" * 32)
    finally:
        ingestion_slot.release("e" * 32)


def test_cancelling_an_ended_job_is_409(layers, client, admin_headers, tmp_path):
    response = upload(client, admin_headers, write_tif(tmp_path / "in.tif", binary()))
    job = job_for(client, admin_headers, response)

    assert cancel(client, admin_headers, job["jobId"]).status_code == 409
    assert job_for(client, admin_headers, response)["status"] == "succeeded"


def test_cancelling_another_countrys_job_is_404(layers, client):
    running_job(layers, "f" * 32)
    try:
        assert cancel(client, ecuador_headers(client), "f" * 32).status_code == 404
        assert not ingestion_slot.is_cancelled("f" * 32)
    finally:
        ingestion_slot.release("f" * 32)


def test_cancelling_an_unknown_job_is_404(layers, client, admin_headers):
    assert cancel(client, admin_headers, "0" * 32).status_code == 404


def test_cancel_preflight_allows_delete(layers, client):
    response = client.options(
        "/admin/jobs/" + "0" * 32,
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "DELETE",
        },
    )
    assert response.status_code == 200
    assert "DELETE" in response.headers["access-control-allow-methods"]


def test_restart_leaves_a_previous_revisions_live_job_alone(layers, staging, admin_env):
    # During a deploy the old revision is still ingesting when the new one starts.
    live = {**new_job("d" * 32, "CO", 6, None), "status": "running"}
    layers.jobs.write_job(live)
    layers.jobs.staging_dir.mkdir(parents=True)
    activating = layers.jobs.staging_dir / f"{'d' * 32}.tif"
    activating.write_bytes(b"cog being activated")

    with TestClient(create_app()):
        pass

    assert layers.jobs.read_job("d" * 32)["status"] == "running"
    assert activating.exists()


def test_upload_is_refused_while_another_process_is_ingesting(
    layers, client, admin_headers, tmp_path
):
    layers.jobs.write_job({**new_job("e" * 32, "CO", 6, None), "status": "running"})

    response = upload(client, admin_headers, write_tif(tmp_path / "in.tif", binary()))

    assert response.status_code == 409


def test_a_job_nobody_updates_is_reported_as_interrupted(layers, client, admin_headers):
    layers.jobs.write_job(
        {**new_job("f" * 32, "CO", 6, None), "status": "running", "updatedAt": STALE}
    )

    job = client.get(f"/admin/jobs/{'f' * 32}", headers=admin_headers).json()

    assert job["status"] == "failed"
    assert job["error"]["code"] == "interrupted"
    assert layers.jobs.read_job("f" * 32)["status"] == "failed"


def test_a_failed_job_is_never_brought_back(layers, staging, tmp_path):
    # The old revision's job was marked interrupted; its next update must not
    # resurrect it, and it must not activate its raster.
    staged = staging / f"{'a' * 32}.tif"
    staging.mkdir()
    staged.write_bytes(write_tif(tmp_path / "in.tif", binary()))
    job = new_job("a" * 32, "CO", 6, None)
    layers.jobs.write_job({**job, "status": "failed"})

    ingestion.run_ingestion("a" * 32, "CO", 6, staged, None)

    assert layers.jobs.read_job("a" * 32)["status"] == "failed"
    assert entry(layers, 6)["raster_filename"] is None


def test_an_upload_whose_client_left_starts_no_job(
    layers, staging, client, admin_headers, tmp_path, monkeypatch
):
    """The admin cancelled once the whole file was sent: the API must not ingest it."""
    from starlette.requests import Request

    async def disconnected(self):
        return True

    monkeypatch.setattr(Request, "is_disconnected", disconnected)

    response = upload(client, admin_headers, write_tif(tmp_path / "in.tif", binary()))

    assert response.status_code == 400
    assert layers.jobs.list_jobs() == []
    assert entry(layers, 6)["raster_filename"] is None
    assert_no_staging_left(layers, staging)
    assert ingestion_slot.job_id is None
