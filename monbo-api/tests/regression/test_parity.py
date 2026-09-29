from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.layers.store import LayersRoot, set_layers_root
from tests.regression.parity import compare_clients
from tests.regression.pipeline import FIXTURE_MAPS_ROOT


def test_same_layers_give_no_differences():
    set_layers_root(LayersRoot(FIXTURE_MAPS_ROOT))
    try:
        app = create_app()
        assert compare_clients(TestClient(app), TestClient(app)) == []
    finally:
        set_layers_root(None)


class _StubClient:
    def __init__(self, map_ids):
        self.map_ids = map_ids

    def get(self, path):
        assert path == "/maps"
        client = self

        class _Response:
            def raise_for_status(self):
                pass

            def json(self):
                return [{"id": i} for i in client.map_ids]

        return _Response()


def test_different_published_layers_are_reported():
    diffs = compare_clients(_StubClient([0, 1, 2]), _StubClient([0, 1]))

    assert diffs == ["Published layers differ: [0, 1, 2] vs [0, 1]"]
