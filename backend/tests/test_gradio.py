import asyncio
from unittest.mock import AsyncMock, MagicMock

from fastapi import HTTPException

from app.gradio_ui import history_to_messages, respond


class TestHistoryToMessages:
    def test_skips_empty_and_unknown_roles(self):
        messages = history_to_messages(
            [
                {"role": "user", "content": "Hi"},
                {"role": "system", "content": "ignore me"},
                {"role": "assistant", "content": "Hello"},
                {"role": "user", "content": "   "},
            ]
        )
        assert messages == [
            {"role": "user", "content": "Hi"},
            {"role": "assistant", "content": "Hello"},
        ]

    def test_flattens_multimodal_content(self):
        messages = history_to_messages(
            [{"role": "user", "content": [{"type": "text", "text": "Runway?"}]}]
        )
        assert messages[0]["content"] == "Runway?"


class TestRespond:
    def test_calls_chat_endpoint_and_returns_reply(self, monkeypatch):
        import main  # noqa: F401
        import app.main as chat_mod

        result = MagicMock()
        result.reply = "Keep 3-6 months of cash."
        chat = AsyncMock(return_value=result)
        monkeypatch.setattr(chat_mod, "chat", chat)

        reply = asyncio.run(
            respond(
                "How much runway?",
                [{"role": "user", "content": "Hi"}, {"role": "assistant", "content": "Hello"}],
            )
        )

        assert reply == "Keep 3-6 months of cash."
        req = chat.await_args.args[0]
        assert req.message == "How much runway?"
        assert [(m.role, m.content) for m in req.history] == [
            ("user", "Hi"),
            ("assistant", "Hello"),
        ]

    def test_http_errors_surface_as_chat_text(self, monkeypatch):
        import main  # noqa: F401
        import app.main as chat_mod

        monkeypatch.setattr(
            chat_mod,
            "chat",
            AsyncMock(side_effect=HTTPException(status_code=400, detail="No message provided")),
        )
        assert asyncio.run(respond("   ", [])) == "No message provided"
