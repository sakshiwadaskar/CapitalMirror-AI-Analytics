import pytest

from app import mcp_client


class FakeTool:
    def __init__(self, name):
        self.name = name


class FakeListToolsResult:
    def __init__(self, tools):
        self.tools = tools


class FakeTextContent:
    def __init__(self, text):
        self.text = text


class FakeCallToolResult:
    def __init__(self, isError=False, content=None):
        self.isError = isError
        self.content = content or []


class FakeClient:
    """Stands in for mcp.Client — called like the class, returns itself as
    the async context manager, so tests never touch a real MCP transport."""

    def __init__(self, tools=("notify_owner",), call_result=None, raise_on_call=None):
        self._tools = [FakeTool(t) for t in tools]
        self._call_result = call_result or FakeCallToolResult()
        self._raise_on_call = raise_on_call
        self.call_args = None
        self.server_url = None

    def __call__(self, server_url, read_timeout_seconds=None):
        self.server_url = server_url
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    async def list_tools(self):
        return FakeListToolsResult(self._tools)

    async def call_tool(self, name, arguments, read_timeout_seconds=None):
        self.call_args = (name, arguments)
        if self._raise_on_call:
            raise self._raise_on_call
        return self._call_result


@pytest.fixture(autouse=True)
def pushover_url(monkeypatch):
    monkeypatch.setenv("PUSHOVER_MCP_SERVER_URL", "http://localhost:9000/mcp")


async def test_notify_owner_calls_tool_with_expected_args(monkeypatch):
    fake = FakeClient(call_result=FakeCallToolResult(isError=False))
    monkeypatch.setattr(mcp_client, "Client", fake)

    await mcp_client.notify_owner("Jane Doe", "jane@example.com", "Interested")

    assert fake.call_args == (
        "notify_owner",
        {"name": "Jane Doe", "contact": "jane@example.com", "message": "Interested"},
    )


async def test_missing_tool_raises(monkeypatch):
    fake = FakeClient(tools=("some_other_tool",))
    monkeypatch.setattr(mcp_client, "Client", fake)

    with pytest.raises(RuntimeError, match="notify_owner"):
        await mcp_client.notify_owner("Jane Doe", "jane@example.com", "hi")


async def test_tool_error_result_raises(monkeypatch):
    fake = FakeClient(
        call_result=FakeCallToolResult(isError=True, content=[FakeTextContent("Pushover rejected it")])
    )
    monkeypatch.setattr(mcp_client, "Client", fake)

    with pytest.raises(RuntimeError, match="Pushover rejected it"):
        await mcp_client.notify_owner("Jane Doe", "jane@example.com", "hi")


async def test_connection_or_timeout_failure_raises(monkeypatch):
    fake = FakeClient(raise_on_call=TimeoutError("connection timed out"))
    monkeypatch.setattr(mcp_client, "Client", fake)

    with pytest.raises(TimeoutError):
        await mcp_client.notify_owner("Jane Doe", "jane@example.com", "hi")


async def test_missing_server_url_raises(monkeypatch):
    monkeypatch.delenv("PUSHOVER_MCP_SERVER_URL", raising=False)

    with pytest.raises(RuntimeError, match="PUSHOVER_MCP_SERVER_URL"):
        await mcp_client.notify_owner("Jane Doe", "jane@example.com", "hi")
