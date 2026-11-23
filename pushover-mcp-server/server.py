import os

import httpx
from dotenv import load_dotenv
from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

load_dotenv()

mcp = MCPServer("Pushover Notifier")

PUSHOVER_URL = "https://api.pushover.net/1/messages.json"
REQUEST_TIMEOUT = 10.0


@mcp.tool()
async def notify_owner(name: str, contact: str, message: str) -> dict:
    """Send a Pushover notification to the business owner about a new lead."""
    token = os.environ.get("PUSHOVER_APP_TOKEN")
    user = os.environ.get("PUSHOVER_USER_KEY")
    if not token or not user:
        # ToolError (not a plain exception): its message reaches the caller,
        # which the chat backend's logs rely on — a bare Exception here would
        # be flattened to a generic "Error executing tool" with no detail.
        raise ToolError("PUSHOVER_APP_TOKEN and PUSHOVER_USER_KEY must be set")

    body = f"{name} ({contact}): {message}"
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        resp = await client.post(
            PUSHOVER_URL,
            data={"token": token, "user": user, "message": body},
        )
    resp.raise_for_status()
    data = resp.json()
    if data.get("status") != 1:
        raise ToolError(f"Pushover rejected the notification: {data.get('errors')}")
    return {"status": "sent"}


if __name__ == "__main__":
    # Default port 8000 collides with the backend's own uvicorn process —
    # this server needs its own port.
    mcp.run(transport="streamable-http", port=int(os.environ.get("PORT", 8001)))
