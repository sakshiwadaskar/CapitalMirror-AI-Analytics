import httpx
import pytest

import server
from mcp.server.mcpserver.exceptions import ToolError


class FakeResponse:
    def __init__(self, json_data, status_code=200):
        self._json_data = json_data
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=None, response=self)

    def json(self):
        return self._json_data


class FakeAsyncClient:
    """Stands in for httpx.AsyncClient so no real network call is made."""

    def __init__(self, response=None, raise_exc=None, **kwargs):
        self._response = response
        self._raise_exc = raise_exc
        self.post_calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    async def post(self, url, data=None):
        self.post_calls.append((url, data))
        if self._raise_exc:
            raise self._raise_exc
        return self._response


@pytest.fixture(autouse=True)
def pushover_env(monkeypatch):
    monkeypatch.setenv("PUSHOVER_APP_TOKEN", "test-token")
    monkeypatch.setenv("PUSHOVER_USER_KEY", "test-user")


async def test_successful_notification(monkeypatch):
    fake = FakeAsyncClient(response=FakeResponse({"status": 1}))
    monkeypatch.setattr(server.httpx, "AsyncClient", lambda **kwargs: fake)

    result = await server.notify_owner("Jane Doe", "jane@example.com", "Interested in the tool")

    assert result == {"status": "sent"}
    assert len(fake.post_calls) == 1
    url, data = fake.post_calls[0]
    assert url == server.PUSHOVER_URL
    assert data["token"] == "test-token"
    assert data["user"] == "test-user"
    assert "Jane Doe" in data["message"]
    assert "jane@example.com" in data["message"]


async def test_pushover_error_response(monkeypatch):
    fake = FakeAsyncClient(response=FakeResponse({"status": 0, "errors": ["invalid user key"]}))
    monkeypatch.setattr(server.httpx, "AsyncClient", lambda **kwargs: fake)

    with pytest.raises(ToolError, match="invalid user key"):
        await server.notify_owner("Jane Doe", "jane@example.com", "Interested")


async def test_network_timeout(monkeypatch):
    fake = FakeAsyncClient(raise_exc=httpx.TimeoutException("timed out"))
    monkeypatch.setattr(server.httpx, "AsyncClient", lambda **kwargs: fake)

    with pytest.raises(httpx.TimeoutException):
        await server.notify_owner("Jane Doe", "jane@example.com", "Interested")


async def test_missing_env_vars(monkeypatch):
    monkeypatch.delenv("PUSHOVER_APP_TOKEN", raising=False)
    monkeypatch.delenv("PUSHOVER_USER_KEY", raising=False)

    with pytest.raises(ToolError, match="PUSHOVER_APP_TOKEN"):
        await server.notify_owner("Jane Doe", "jane@example.com", "Interested")
