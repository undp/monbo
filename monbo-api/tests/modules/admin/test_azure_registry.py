"""The operator's Azure registry upload must reject stale local copies."""

import json

import pytest

from app.modules.admin.azure_registry import (
    CountryFolderConflict,
    RegistryChanged,
    publish,
    snapshot,
)


class FakeLease:
    def __init__(self, file):
        self.file = file

    def release(self):
        self.file.leased = False


class FakeDownload:
    def __init__(self, data):
        self.data = data

    def readall(self):
        return self.data


class FakeFile:
    def __init__(self, data=None, registry=None):
        self.data = data
        self.registry = registry
        self.etag = "v1"
        self.leased = False

    def exists(self):
        return self.data is not None

    def get_file_properties(self):
        return type("Properties", (), {"etag": self.etag})()

    def download_file(self):
        return FakeDownload(self.data)

    def acquire_lease(self):
        assert not self.leased
        self.leased = True
        return FakeLease(self)

    def upload_file(self, data, lease=None):
        if self.registry is not None:
            assert self.registry.leased
        if self.leased:
            assert lease is not None and lease.file is self
        self.data = data
        self.etag = "v2"


class FakeDirectory:
    def __init__(self, paths, path, registry):
        self.paths = paths
        self.path = path
        self.registry = registry

    def exists(self):
        return self.path in self.paths

    def create_directory(self):
        assert self.registry.leased
        self.paths.add(self.path)


class FakeShare:
    def __init__(self):
        self.files = {"countries.json": FakeFile(b'{"countries": []}\n')}
        self.directories = set()

    def get_file_client(self, path):
        return self.files.setdefault(
            path, FakeFile(registry=self.files["countries.json"])
        )

    def get_directory_client(self, path):
        return FakeDirectory(self.directories, path, self.files["countries.json"])


def test_publish_rejects_an_outdated_registry_after_another_operator_writes(tmp_path):
    share = FakeShare()
    local = tmp_path / "countries.json"
    etag = snapshot(share, local)

    local.write_text('{"countries": [{"code": "CO"}]}')
    publish(share, etag, local)
    first_update = share.files["countries.json"].data

    local.write_text('{"countries": [{"code": "EC"}]}')
    with pytest.raises(RegistryChanged):
        publish(share, etag, local)

    assert share.files["countries.json"].data == first_update
    assert not share.files["countries.json"].leased


def test_publish_adds_country_folder_while_holding_registry_lease(tmp_path):
    share = FakeShare()
    local = tmp_path / "countries.json"
    index = tmp_path / "index.json"
    index.write_text("[]\n")
    etag = snapshot(share, local)
    local.write_text(json.dumps({"countries": [{"code": "PE"}]}))

    publish(share, etag, local, "PE", index)

    assert share.files["PE/index.json"].data == b"[]\n"
    assert "PE/metadata/attributes/es" in share.directories
    assert "PE/layers/rasters" in share.directories
    assert share.files["countries.json"].data == local.read_bytes()
    assert not share.files["countries.json"].leased


def test_publish_does_not_replace_an_orphan_folder_with_layers(tmp_path):
    share = FakeShare()
    share.files["PE/index.json"] = FakeFile(b'[{"id": 1}]')
    local = tmp_path / "countries.json"
    index = tmp_path / "index.json"
    index.write_text("[]\n")
    etag = snapshot(share, local)

    with pytest.raises(CountryFolderConflict):
        publish(share, etag, local, "PE", index)

    assert share.files["PE/index.json"].data == b'[{"id": 1}]'
    assert not share.files["countries.json"].leased
