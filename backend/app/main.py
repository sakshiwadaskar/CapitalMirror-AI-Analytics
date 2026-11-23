import logging
import re
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import mcp_client
from app.agent import run_chat_turn

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_MESSAGE_LENGTH = 2000
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^\+?[\d\s\-().]{7,20}$")


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class LeadInfo(BaseModel):
    name: Optional[str] = None
    contact: Optional[str] = None
    confirmed: bool = False


class ChatResponse(BaseModel):
    reply: str
    lead: Optional[LeadInfo] = None
    notified: bool = False


def _looks_like_contact(contact: str) -> bool:
    return bool(EMAIL_RE.match(contact) or PHONE_RE.match(contact))


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    message = req.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="No message provided")
    if len(message) > MAX_MESSAGE_LENGTH:
        raise HTTPException(status_code=400, detail="Message too long")

    history = [m.model_dump() for m in req.history]
    reply, lead_dict = run_chat_turn(message, history)
    lead = LeadInfo(**lead_dict) if lead_dict else None

    notified = False
    if lead and lead.confirmed:
        if lead.name and lead.contact and _looks_like_contact(lead.contact):
            try:
                await mcp_client.notify_owner(lead.name, lead.contact, message)
                notified = True
                reply = f"{reply}\n\nSent — they'll be in touch soon."
            except Exception:
                logger.exception("Failed to notify owner via Pushover MCP server")
                reply = f"{reply}\n\nI wasn't able to send that just now — please try again in a bit."
        else:
            lead.confirmed = False
            reply = "That contact doesn't look like a valid email or phone number — could you double check it?"

    return ChatResponse(reply=reply, lead=lead, notified=notified)
