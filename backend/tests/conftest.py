import pytest
from unittest.mock import MagicMock, patch
from httpx import AsyncClient, ASGITransport

# ── Shared Riverside Landscaping fixture ──────────────────────────────────────

RIVERSIDE_TEXT = """
Business: Riverside Landscaping LLC · FY 2023
Revenue: $1,840,000
COGS (labor + materials): $1,102,000
Gross Profit: $738,000 (40.1%)
Operating Expenses: $312,000
  — Owner salary: $120,000
  — Rent: $36,000
  — Marketing: $28,000
  — Misc: $128,000
EBITDA: $426,000
Owner SDE: ~$546,000
YoY Revenue Growth: +14%
Employees: 11 FT, 4 seasonal
Notes: Lost one major HOA contract in Q4.
"""

RIVERSIDE_JSON = {
    "business_name": "Riverside Landscaping LLC",
    "fiscal_year": "2023",
    "revenue": 1840000.0,
    "cogs": 1102000.0,
    "gross_profit": 738000.0,
    "operating_expenses": 312000.0,
    "owner_salary": 120000.0,
    "rent": 36000.0,
    "marketing": 28000.0,
    "ebitda": 426000.0,
    "sde": 546000.0,
    "yoy_growth": 0.14,
    "employee_count": 15,
    "notes": "Lost one major HOA contract in Q4.",
    "industry": "landscaping",
}


def make_claude_response(json_str: str):
    """Build a mock Anthropic response object."""
    msg = MagicMock()
    msg.content = [MagicMock(text=json_str)]
    return msg


@pytest.fixture
def mock_claude(monkeypatch):
    """Patch the Anthropic client so no real API calls are made."""
    import json
    import main as app_module

    def fake_create(**kwargs):
        prompt = kwargs.get("messages", [{}])[0].get("content", "")
        if "rationale" in prompt.lower() or "score" in prompt.lower():
            payload = json.dumps({
                "rationale": "Test rationale.",
                "whats_working": ["Revenue is healthy."],
                "whats_not": ["Expense ratio is borderline."],
                "fix_first": ["Reduce miscellaneous expenses."],
            })
        else:
            payload = json.dumps(RIVERSIDE_JSON)
        return make_claude_response(payload)

    mock_messages = MagicMock()
    mock_messages.create.side_effect = fake_create
    mock_client = MagicMock()
    mock_client.messages = mock_messages
    monkeypatch.setattr(app_module, "client", mock_client)
    return mock_client


@pytest.fixture
async def async_client(mock_claude):
    """Async HTTP test client wired to the FastAPI app (Claude is mocked)."""
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def real_client():
    """Real HTTP client — hits the actual Anthropic API. Only for integration tests."""
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
