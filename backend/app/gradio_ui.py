from __future__ import annotations

from typing import Any

import gradio as gr
from fastapi import HTTPException


def _content_to_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and part.get("text"):
                parts.append(str(part["text"]))
        return "".join(parts)
    return str(content)


def history_to_messages(history: list | None) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    for turn in history or []:
        if isinstance(turn, dict):
            role = turn.get("role")
            content = turn.get("content", "")
        else:
            role = getattr(turn, "role", None)
            content = getattr(turn, "content", "")
        text = _content_to_text(content).strip()
        if role in ("user", "assistant") and text:
            messages.append({"role": role, "content": text})
    return messages


def _message_text(message: Any) -> str:
    if isinstance(message, dict):
        return str(message.get("text") or message.get("content") or "")
    return "" if message is None else str(message)


async def respond(message: Any, history: list) -> str:
    from app.main import ChatRequest, chat

    try:
        result = await chat(
            ChatRequest(message=_message_text(message), history=history_to_messages(history))
        )
    except HTTPException as exc:
        if isinstance(exc.detail, str):
            return exc.detail
        return "Something went wrong."
    return result.reply


demo = gr.ChatInterface(
    fn=respond,
    title="Business Health Chat",
    description="Ask about cash flow, margins, pricing, or request a follow-up. This UI calls the /chat API.",
    examples=[
        "How much cash runway should a small business keep?",
        "What's a healthy gross margin for a service business?",
        "I'd like someone to get in touch about using this on my numbers.",
    ],
)
