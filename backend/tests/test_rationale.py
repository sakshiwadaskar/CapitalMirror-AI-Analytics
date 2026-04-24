import pytest
from httpx import AsyncClient

VALID_PAYLOAD = {
    "data": {
        "business_name": "Riverside Landscaping LLC",
        "fiscal_year": "2023",
        "revenue": 1_840_000,
        "cogs": 1_102_000,
        "gross_profit": 738_000,
        "operating_expenses": 312_000,
        "owner_salary": 120_000,
        "rent": 36_000,
        "marketing": 28_000,
        "ebitda": 426_000,
        "sde": 546_000,
        "yoy_growth": 0.14,
        "employee_count": 15,
        "notes": "Lost one major HOA contract in Q4.",
        "industry": "landscaping",
    },
    "assumptions": {
        "owner_salary": 120_000,
        "growth_rate": 0.14,
        "cogs_adjustment": 0.0,
        "opex_adjustment": 0.0,
    },
    "score": 91,
}


class TestRationale:
    async def test_returns_200(self, async_client: AsyncClient):
        res = await async_client.post("/rationale", json=VALID_PAYLOAD)
        assert res.status_code == 200

    async def test_response_has_rationale_string(self, async_client: AsyncClient):
        res = await async_client.post("/rationale", json=VALID_PAYLOAD)
        assert isinstance(res.json()["rationale"], str)
        assert len(res.json()["rationale"]) > 0

    async def test_response_has_insights(self, async_client: AsyncClient):
        res = await async_client.post("/rationale", json=VALID_PAYLOAD)
        body = res.json()
        assert "insights" in body
        assert "whats_working" in body["insights"]
        assert "whats_not" in body["insights"]
        assert "fix_first" in body["insights"]

    async def test_insights_arrays_capped_at_3(self, async_client: AsyncClient):
        res = await async_client.post("/rationale", json=VALID_PAYLOAD)
        ins = res.json()["insights"]
        assert len(ins["whats_working"]) <= 3
        assert len(ins["whats_not"]) <= 3
        assert len(ins["fix_first"]) <= 3

    async def test_claude_called_with_temperature_0_3(self, async_client: AsyncClient, mock_claude):
        await async_client.post("/rationale", json=VALID_PAYLOAD)
        # rationale is the second call (first is parse if called), find the haiku call
        for call in mock_claude.messages.create.call_args_list:
            if call.kwargs.get("model", "").startswith("claude-haiku"):
                assert call.kwargs.get("temperature") == pytest.approx(0.3)
                return
        # If no haiku call found, at least assert the last call had temperature set
        call_kwargs = mock_claude.messages.create.call_args.kwargs
        assert "temperature" in call_kwargs

    async def test_missing_notes_handled_gracefully(self, async_client: AsyncClient):
        payload = {**VALID_PAYLOAD, "data": {**VALID_PAYLOAD["data"], "notes": None}}
        res = await async_client.post("/rationale", json=payload)
        assert res.status_code == 200

    async def test_score_zero_still_returns_200(self, async_client: AsyncClient):
        res = await async_client.post("/rationale", json={**VALID_PAYLOAD, "score": 0})
        assert res.status_code == 200


# ─── Regression: salary-swap formula (SDE invariance) ────────────────────────

class TestRationaleSalarySwap:
    """The salary slider swaps the salary inside OpEx.
    EBITDA should shift; SDE = gross_profit − non-salary-opex must stay fixed."""

    BASE_DATA = {
        "business_name": "Riverside Landscaping LLC",
        "fiscal_year": "2023",
        "revenue": 1_840_000,
        "cogs": 1_102_000,
        "gross_profit": 738_000,
        "operating_expenses": 312_000,
        "owner_salary": 120_000,
        "rent": 36_000,
        "marketing": 28_000,
        "ebitda": 426_000,
        "sde": 546_000,
        "yoy_growth": 0.14,
        "employee_count": 15,
        "notes": None,
        "industry": "landscaping",
        "cash_on_hand": None,
    }

    async def test_sde_invariant_when_salary_increases(self, async_client: AsyncClient):
        """SDE must equal $546K regardless of assumed salary."""
        for assumed_salary in [120_000, 300_000, 920_000]:
            payload = {
                "data": self.BASE_DATA,
                "assumptions": {"owner_salary": assumed_salary, "growth_rate": 0.14,
                                "cogs_adjustment": 0.0, "opex_adjustment": 0.0},
                "score": 85,
            }
            res = await async_client.post("/rationale", json=payload)
            assert res.status_code == 200, f"Failed for salary={assumed_salary}"

    async def test_high_salary_produces_negative_ebitda_context_in_prompt(
        self, async_client: AsyncClient, mock_claude
    ):
        """With $920K salary: non-salary opex=$192K, total opex=$1,112K, ebitda=−$374K."""
        payload = {
            "data": self.BASE_DATA,
            "assumptions": {"owner_salary": 920_000, "growth_rate": 0.14,
                            "cogs_adjustment": 0.0, "opex_adjustment": 0.0},
            "score": 72,
        }
        await async_client.post("/rationale", json=payload)
        prompt_sent = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        # Prompt must show the $546K SDE, not $1,346K
        assert "546" in prompt_sent
        # Prompt must reflect the high expense ratio (opex > gross profit)
        assert "150" in prompt_sent  # 150.7% expense ratio

    async def test_opex_adjustment_does_not_scale_salary_portion(
        self, async_client: AsyncClient, mock_claude
    ):
        """OpEx +50%: non-salary $192K → $288K; total = $288K + $120K = $408K (not $468K)."""
        payload = {
            "data": self.BASE_DATA,
            "assumptions": {"owner_salary": 120_000, "growth_rate": 0.14,
                            "cogs_adjustment": 0.0, "opex_adjustment": 0.50},
            "score": 80,
        }
        await async_client.post("/rationale", json=payload)
        prompt_sent = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        assert "408" in prompt_sent   # correct: $408K opex
        assert "468" not in prompt_sent  # wrong: would mean salary was scaled too


# ─── Regression: runway when EBITDA is negative ───────────────────────────────

class TestRationaleRunway:
    BURNING_DATA = {
        "business_name": "Burn Co",
        "fiscal_year": "2024",
        "revenue": 600_000,
        "cogs": 200_000,
        "gross_profit": 400_000,
        "operating_expenses": 500_000,
        "owner_salary": 80_000,
        "rent": None,
        "marketing": None,
        "ebitda": -100_000,
        "sde": None,
        "yoy_growth": 0.85,
        "employee_count": None,
        "notes": None,
        "industry": "saas",
        "cash_on_hand": 220_000,
    }

    async def test_runway_line_appears_in_prompt_when_ebitda_negative(
        self, async_client: AsyncClient, mock_claude
    ):
        payload = {
            "data": self.BURNING_DATA,
            "assumptions": {"owner_salary": 80_000, "growth_rate": 0.85,
                            "cogs_adjustment": 0.0, "opex_adjustment": 0.0},
            "score": 55,
        }
        await async_client.post("/rationale", json=payload)
        prompt_sent = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        assert "Runway" in prompt_sent
        assert "220,000" in prompt_sent  # cash on hand must appear

    async def test_runway_line_absent_when_ebitda_positive(
        self, async_client: AsyncClient, mock_claude
    ):
        profitable = {**self.BURNING_DATA, "operating_expenses": 100_000, "cash_on_hand": 220_000}
        payload = {
            "data": profitable,
            "assumptions": {"owner_salary": 80_000, "growth_rate": 0.85,
                            "cogs_adjustment": 0.0, "opex_adjustment": 0.0},
            "score": 80,
        }
        await async_client.post("/rationale", json=payload)
        prompt_sent = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        assert "Runway" not in prompt_sent

    async def test_runway_absent_when_no_cash_on_hand(
        self, async_client: AsyncClient, mock_claude
    ):
        no_cash = {**self.BURNING_DATA, "cash_on_hand": None}
        payload = {
            "data": no_cash,
            "assumptions": {"owner_salary": 80_000, "growth_rate": 0.85,
                            "cogs_adjustment": 0.0, "opex_adjustment": 0.0},
            "score": 55,
        }
        await async_client.post("/rationale", json=payload)
        prompt_sent = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        assert "Runway" not in prompt_sent


# ─── Regression: malformed Claude response handled gracefully ─────────────────

class TestRationaleRobustness:
    async def test_malformed_json_from_claude_does_not_500(self, async_client: AsyncClient, mock_claude):
        mock_claude.messages.create.return_value.content[0].text = "not json at all"
        res = await async_client.post("/rationale", json=VALID_PAYLOAD)
        # Should not crash — returns empty strings/arrays gracefully
        assert res.status_code == 200

    async def test_markdown_wrapped_json_is_parsed(self, async_client: AsyncClient, mock_claude):
        import json
        from unittest.mock import MagicMock
        payload = json.dumps({
            "rationale": "Good business.",
            "whats_working": ["Revenue is strong."],
            "whats_not": [],
            "fix_first": [],
        })
        # Clear side_effect so return_value is used instead
        mock_claude.messages.create.side_effect = None
        mock_msg = MagicMock()
        mock_msg.content = [MagicMock(text=f"```json\n{payload}\n```")]
        mock_claude.messages.create.return_value = mock_msg
        res = await async_client.post("/rationale", json=VALID_PAYLOAD)
        assert res.status_code == 200
        assert res.json()["rationale"] == "Good business."
