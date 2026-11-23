import os

from mcp import Client

TOOL_NAME = "notify_owner"
CONNECT_TIMEOUT = 10.0
CALL_TIMEOUT = 15.0


async def notify_owner(name: str, contact: str, message: str) -> None:
    """Call the Pushover MCP server's notify_owner tool. Raises on any failure
    (missing config, connection error, timeout, or the tool itself failing) —
    callers decide what to tell the user; this never swallows errors."""
    server_url = os.environ.get("PUSHOVER_MCP_SERVER_URL")
    if not server_url:
        raise RuntimeError("PUSHOVER_MCP_SERVER_URL is not configured")

    async with Client(server_url, read_timeout_seconds=CONNECT_TIMEOUT) as client:
        tools = await client.list_tools()
        if not any(tool.name == TOOL_NAME for tool in tools.tools):
            raise RuntimeError(f"Pushover MCP server has no '{TOOL_NAME}' tool")

        result = await client.call_tool(
            TOOL_NAME,
            {"name": name, "contact": contact, "message": message},
            read_timeout_seconds=CALL_TIMEOUT,
        )

    if result.is_error:
        detail = result.content[0].text if result.content else "unknown error"
        raise RuntimeError(f"Pushover notify failed: {detail}")
