import json

from app import openapi
from app.modules.admin.models import IngestionJob


def test_export_is_deterministic():
    assert openapi.render() == openapi.render()


def test_export_includes_the_admin_and_config():
    document = json.loads(openapi.render())
    assert "/admin/jobs/{job_id}" in document["paths"]
    assert "/config" in document["paths"]
    schemas = document["components"]["schemas"]
    for name in ("IngestionJob", "AdminLayer", "ConfigData", "PointSummary"):
        assert name in schemas


def test_committed_openapi_is_up_to_date():
    """CI runs `python -m app.openapi --check`; this keeps the suite honest too."""
    assert openapi.main(["--check"]) == 0


def test_check_fails_on_a_stale_file(tmp_path, monkeypatch, capsys):
    stale = tmp_path / "openapi.json"
    stale.write_text("{}\n", encoding="utf-8")
    monkeypatch.setattr(openapi, "OPENAPI_PATH", stale)
    assert openapi.main(["--check"]) == 1
    assert "pnpm contracts" in capsys.readouterr().err


def test_polygon_summary_is_discriminated_by_type():
    schema = json.loads(openapi.render())["components"]["schemas"]["FarmData"]
    polygon = schema["properties"]["polygon"]
    assert polygon["discriminator"]["propertyName"] == "type"
    assert "polygon" in schema["required"]


def test_polygon_inconsistency_is_discriminated_by_type():
    schemas = json.loads(openapi.render())["components"]["schemas"]
    items = schemas["PolygonInconsistenciesResponse"]["properties"]["inconsistencies"]
    mapping = items["items"]["discriminator"]["mapping"]
    assert set(mapping) == {"overlap", "invalid_geometry", "empty_polygon"}


def _schema_refs(node, found):
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "$ref":
                found.add(value.rsplit("/", 1)[-1])
            else:
                _schema_refs(value, found)
    elif isinstance(node, list):
        for value in node:
            _schema_refs(value, found)
    return found


def test_response_fields_are_all_required():
    """Responses always include every field, so the generated types mustn't mark
    any optional: a response model with defaults needs
    `json_schema_serialization_defaults_required`."""
    document = json.loads(openapi.render())
    schemas = document["components"]["schemas"]
    pending = _schema_refs(
        [
            response
            for operations in document["paths"].values()
            for operation in operations.values()
            for code, response in operation["responses"].items()
            if code.startswith("2")
        ],
        set(),
    )
    seen: set[str] = set()
    while pending:
        name = pending.pop()
        seen.add(name)
        pending |= _schema_refs(schemas[name], set()) - seen
    optional = {
        name: sorted(
            set(schemas[name].get("properties", {}))
            - set(schemas[name].get("required", []))
        )
        for name in seen
    }
    assert {name: fields for name, fields in optional.items() if fields} == {}


def test_job_saved_by_an_earlier_release_still_validates():
    """Jobs from before phases and progress existed lack those fields."""
    job = IngestionJob.model_validate(
        {
            "jobId": "a" * 32,
            "country": "CO",
            "layerId": 3,
            "status": "succeeded",
            "createdAt": "2026-10-01T00:00:00Z",
            "updatedAt": "2026-10-01T00:01:00Z",
        }
    )
    assert job.phase is None and job.progress is None and job.warnings == []
