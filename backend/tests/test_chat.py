import json
from unittest.mock import AsyncMock, MagicMock

import pytest


def claude_reply(reply: str, lead: dict | None = None):
    """Builds a mock Anthropic response shaped like a /chat turn's JSON output."""
    msg = MagicMock()
    msg.content = [MagicMock(text=json.dumps({"reply": reply, "lead": lead}))]
    return msg


def script(*responses):
    """Returns each response in order on successive client.messages.create calls."""
    it = iter(responses)

    def fake_create(**kwargs):
        return next(it)

    return fake_create


class TestChatBasics:
    async def test_normal_finance_question(self, async_client, mock_claude, monkeypatch):
        mock_claude.messages.create.side_effect = script(
            claude_reply("Keeping 3-6 months of cash on hand is a common cushion.")
        )
        notify = AsyncMock()
        monkeypatch.setattr("app.main.mcp_client.notify_owner", notify)

        resp = await async_client.post("/chat", json={"message": "How much cash runway should I keep?"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["reply"]
        assert body["lead"] is None
        assert body["notified"] is False
        notify.assert_not_called()

    async def test_malformed_request_body_returns_422(self, async_client):
        resp = await async_client.post("/chat", json={"history": [{"role": "nonsense", "content": "hi"}]})
        assert resp.status_code == 422

    async def test_empty_message_returns_400(self, async_client, mock_claude):
        resp = await async_client.post("/chat", json={"message": "   "})
        assert resp.status_code == 400


class TestLeadCollection:
    async def test_missing_name_and_contact_does_not_notify(self, async_client, mock_claude, monkeypatch):
        mock_claude.messages.create.side_effect = script(
            claude_reply("Sure — what's your name?", {"name": None, "contact": None, "confirmed": False})
        )
        notify = AsyncMock()
        monkeypatch.setattr("app.main.mcp_client.notify_owner", notify)

        resp = await async_client.post("/chat", json={"message": "I'd like to get in touch"})

        assert resp.status_code == 200
        assert resp.json()["notified"] is False
        notify.assert_not_called()

    async def test_confirmation_required_before_notify(self, async_client, mock_claude, monkeypatch):
        mock_claude.messages.create.side_effect = script(
            claude_reply(
                "To confirm: Jane Doe, jane@example.com — is that right?",
                {"name": "Jane Doe", "contact": "jane@example.com", "confirmed": False},
            )
        )
        notify = AsyncMock()
        monkeypatch.setattr("app.main.mcp_client.notify_owner", notify)

        resp = await async_client.post(
            "/chat",
            json={
                "message": "jane@example.com",
                "history": [
                    {"role": "assistant", "content": "What's your name?"},
                    {"role": "user", "content": "Jane Doe"},
                ],
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["lead"]["confirmed"] is False
        assert body["notified"] is False
        notify.assert_not_called()

    async def test_decline_clears_lead_and_does_not_notify(self, async_client, mock_claude, monkeypatch):
        mock_claude.messages.create.side_effect = script(
            claude_reply("No problem — let me know if you change your mind.", None)
        )
        notify = AsyncMock()
        monkeypatch.setattr("app.main.mcp_client.notify_owner", notify)

        resp = await async_client.post(
            "/chat",
            json={
                "message": "actually, never mind",
                "history": [
                    {"role": "assistant", "content": "To confirm: Jane Doe, jane@example.com — is that right?"},
                ],
            },
        )

        assert resp.status_code == 200
        assert resp.json()["lead"] is None
        notify.assert_not_called()


class TestNotification:
    async def test_confirmed_lead_triggers_notify_exactly_once(self, async_client, mock_claude, monkeypatch):
        mock_claude.messages.create.side_effect = script(
            claude_reply(
                "Thanks — let me pass that along.",
                {"name": "Jane Doe", "contact": "jane@example.com", "confirmed": True},
            )
        )
        notify = AsyncMock()
        monkeypatch.setattr("app.main.mcp_client.notify_owner", notify)

        resp = await async_client.post("/chat", json={"message": "yes, that's correct"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["notified"] is True
        assert "sent" in body["reply"].lower()
        notify.assert_called_once_with("Jane Doe", "jane@example.com", "yes, that's correct")

    async def test_notify_failure_does_not_claim_success(self, async_client, mock_claude, monkeypatch):
        mock_claude.messages.create.side_effect = script(
            claude_reply(
                "Thanks — let me pass that along.",
                {"name": "Jane Doe", "contact": "jane@example.com", "confirmed": True},
            )
        )
        notify = AsyncMock(side_effect=TimeoutError("mcp server unreachable"))
        monkeypatch.setattr("app.main.mcp_client.notify_owner", notify)

        resp = await async_client.post("/chat", json={"message": "yes, that's correct"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["notified"] is False
        assert "sent" not in body["reply"].lower()
        notify.assert_called_once()

    async def test_invalid_contact_does_not_notify(self, async_client, mock_claude, monkeypatch):
        mock_claude.messages.create.side_effect = script(
            claude_reply(
                "Thanks — let me pass that along.",
                {"name": "Jane Doe", "contact": "not-a-real-contact", "confirmed": True},
            )
        )
        notify = AsyncMock()
        monkeypatch.setattr("app.main.mcp_client.notify_owner", notify)

        resp = await async_client.post("/chat", json={"message": "yes"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["notified"] is False
        assert body["lead"]["confirmed"] is False
        notify.assert_not_called()
