import json

import pytest

from app.modules.admin import countries as cli
from app.modules.admin.auth import country_for_passkey, hash_passkey
from app.modules.layers.store import LayersRoot, set_layers_root


@pytest.fixture
def root(tmp_path):
    root = LayersRoot(tmp_path / "maps")
    root.root.mkdir()
    set_layers_root(root)
    yield root
    set_layers_root(None)


def run(root, *args):
    return cli.main([*args, "--root", str(root.root)])


def printed_passkey(output):
    return next(
        line.removeprefix("ADMIN_PASSKEY=")
        for line in output.splitlines()
        if line.startswith("ADMIN_PASSKEY=")
    )


def every_file_text(root):
    return "".join(
        path.read_text(errors="ignore")
        for path in root.root.rglob("*")
        if path.is_file()
    )


def test_add_scaffolds_the_country_and_prints_its_passkey_once(root, capsys):
    assert run(root, "add", "pe") == 0

    passkey = printed_passkey(capsys.readouterr().out)
    assert len(passkey) >= 64
    assert json.loads((root.root / "PE" / "index.json").read_text()) == []
    for kind in ("attributes", "considerations"):
        for language in ("en", "es"):
            assert (root.root / "PE" / "metadata" / kind / language).is_dir()
    assert (root.root / "PE" / "layers" / "rasters").is_dir()
    assert root.read_registry() == [
        {"code": "PE", "passkey_hash": hash_passkey(passkey), "enabled": True}
    ]
    # Only the hash is written anywhere.
    assert passkey not in every_file_text(root)
    assert country_for_passkey(passkey)["code"] == "PE"


def test_invalid_codes_are_rejected_and_nothing_is_written(root, capsys):
    assert run(root, "add", "XX") == 1

    assert "not an ISO 3166-1 alpha-2" in capsys.readouterr().err
    assert list(root.root.iterdir()) == []


def test_a_registered_country_cannot_be_added_again(root, capsys):
    run(root, "add", "CO")
    before = root.registry_path.read_bytes()

    assert run(root, "add", "CO") == 1

    assert "already registered" in capsys.readouterr().err
    assert root.registry_path.read_bytes() == before


def test_add_resumes_after_failing_to_write_the_registry(root, capsys, monkeypatch):
    def refuse(self, countries):
        raise OSError("SMB refused the replace")

    with monkeypatch.context() as patched:
        patched.setattr(LayersRoot, "write_registry", refuse)
        with pytest.raises(OSError):
            run(root, "add", "PE")
    assert json.loads((root.root / "PE" / "index.json").read_text()) == []

    assert run(root, "add", "PE") == 0

    passkey = printed_passkey(capsys.readouterr().out)
    assert country_for_passkey(passkey)["code"] == "PE"


def test_a_folder_with_layers_is_not_taken_over(root, capsys):
    (root.root / "PE").mkdir()
    (root.root / "PE" / "index.json").write_text(json.dumps([{"id": 0}]))

    assert run(root, "add", "PE") == 1

    assert "already has an index.json" in capsys.readouterr().err


def test_a_flat_root_must_be_migrated_first(root, capsys):
    (root.root / "index.json").write_text("[]")

    assert run(root, "add", "CO") == 1

    assert "migrate it first" in capsys.readouterr().err
    assert not root.registry_path.exists()


def test_rotate_replaces_only_that_countrys_passkey(root, capsys):
    run(root, "add", "CO")
    colombia = printed_passkey(capsys.readouterr().out)
    run(root, "add", "CR")
    costa_rica = printed_passkey(capsys.readouterr().out)

    assert run(root, "rotate", "CR") == 0

    rotated = printed_passkey(capsys.readouterr().out)
    assert rotated != costa_rica
    assert country_for_passkey(costa_rica) is None
    assert country_for_passkey(rotated)["code"] == "CR"
    assert country_for_passkey(colombia)["code"] == "CO"


def test_disable_and_enable_keep_the_data(root, capsys):
    run(root, "add", "EC")
    passkey = printed_passkey(capsys.readouterr().out)
    (root.root / "EC" / "index.json").write_text(
        json.dumps([{"id": 0, "enabled": True}])
    )

    assert run(root, "disable", "EC") == 0
    assert country_for_passkey(passkey) is None
    assert root.enabled_countries() == set()
    assert json.loads((root.root / "EC" / "index.json").read_text()) == [
        {"id": 0, "enabled": True}
    ]

    assert run(root, "enable", "EC") == 0
    assert country_for_passkey(passkey)["code"] == "EC"


def test_unknown_countries_cannot_be_rotated_or_disabled(root, capsys):
    run(root, "add", "CO")

    assert run(root, "rotate", "PE") == 1
    assert run(root, "disable", "PE") == 1
    assert "PE is not registered" in capsys.readouterr().err


def test_list(root, capsys):
    run(root, "add", "CO")
    run(root, "add", "PE")
    run(root, "disable", "PE")
    (root.root / "CO" / "index.json").write_text(
        json.dumps([{"id": 3, "enabled": True}, {"id": 6, "enabled": False}])
    )
    capsys.readouterr()

    assert run(root, "list") == 0

    lines = capsys.readouterr().out.splitlines()
    assert lines[0].startswith("CO  Colombia")
    assert "enabled" in lines[0] and "2 layers (1 enabled)" in lines[0]
    assert lines[1].startswith("PE  Peru")
    assert "disabled" in lines[1] and "0 layers (0 enabled)" in lines[1]


def test_commands_other_than_list_need_a_code(root):
    with pytest.raises(SystemExit):
        run(root, "add")
