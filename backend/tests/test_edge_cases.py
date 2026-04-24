"""
Adversarial edge-case suite — four broken financial scenarios.
Tests the /rationale endpoint's formula robustness, not Claude output.
"""
import re
import pytest
from httpx import AsyncClient


def assert_no_numeric_nan(prompt: str):
    """Check for the float sentinel NaN, not the substring inside 'financial'."""
    assert not re.search(r'\bnan\b', prompt.lower()), \
        f"Numeric NaN found in prompt: {prompt[:200]}"


# ─── Edge Case 1 — Pre-Revenue Burn ──────────────────────────────────────────

class TestPreRevenueBurn:
    """Revenue=$0, COGS=$0, OpEx=$15K, Cash=$300K.
    System must not crash from division-by-zero. Runway should appear in prompt."""

    PAYLOAD = {
        "data": {
            "business_name": "Startup Co", "fiscal_year": "2024",
            "revenue": 0, "cogs": 0, "gross_profit": 0,
            "operating_expenses": 15_000, "owner_salary": 0,
            "rent": None, "marketing": None, "ebitda": None, "sde": None,
            "yoy_growth": None, "employee_count": None, "notes": None,
            "industry": "saas", "cash_on_hand": 300_000,
        },
        "assumptions": {"owner_salary": 0, "growth_rate": 0,
                        "cogs_adjustment": 0.0, "opex_adjustment": 0.0},
        "score": 5,
    }

    async def test_returns_200_no_crash(self, async_client: AsyncClient):
        res = await async_client.post("/rationale", json=self.PAYLOAD)
        assert res.status_code == 200

    async def test_runway_appears_in_prompt(self, async_client: AsyncClient, mock_claude):
        """EBITDA = 0 − 15K = −$15K → runway = 300K / (15K/12) = 240 months."""
        await async_client.post("/rationale", json=self.PAYLOAD)
        prompt = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        assert "Runway" in prompt
        assert "300,000" in prompt   # cash on hand

    async def test_zero_revenue_shows_na_ratios_not_absurd_percentages(
        self, async_client: AsyncClient, mock_claude
    ):
        """$0 revenue → gross_margin and sde_ratio must show N/A, not e.g. 1,499,900%."""
        await async_client.post("/rationale", json=self.PAYLOAD)
        prompt = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        assert_no_numeric_nan(prompt)
        assert "N/A" in prompt, "Expected N/A for ratios when revenue is $0"
        # Must NOT show absurdly inflated revenue ($1 instead of $0)
        assert "Revenue: $1\n" not in prompt


# ─── Edge Case 2 — Accounting Error Paradox ──────────────────────────────────

class TestAccountingErrorParadox:
    """Revenue=$500K, COGS=$600K, claimed GP=$100K (wrong — calculated is −$100K).
    Backend must use COGS to compute reality, not accept the claimed gross_profit."""

    PAYLOAD = {
        "data": {
            "business_name": "Bad Books LLC", "fiscal_year": "2024",
            "revenue": 500_000, "cogs": 600_000,
            "gross_profit": 100_000,   # claimed — wrong
            "operating_expenses": 80_000, "owner_salary": 60_000,
            "rent": None, "marketing": None, "ebitda": None, "sde": None,
            "yoy_growth": 0.05, "employee_count": None, "notes": None,
            "industry": "general", "cash_on_hand": None,
        },
        "assumptions": {"owner_salary": 60_000, "growth_rate": 0.05,
                        "cogs_adjustment": 0.0, "opex_adjustment": 0.0},
        "score": 15,
    }

    async def test_returns_200(self, async_client: AsyncClient):
        res = await async_client.post("/rationale", json=self.PAYLOAD)
        assert res.status_code == 200

    async def test_prompt_uses_calculated_gross_profit_not_claimed(
        self, async_client: AsyncClient, mock_claude
    ):
        """Calculated GP = 500K − 600K = −$100K. Prompt must NOT contain +$100K."""
        await async_client.post("/rationale", json=self.PAYLOAD)
        prompt = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        # Calculated reality: gross_profit = -100,000 → prompt shows negative GP
        assert "-100,000" in prompt or "−100,000" in prompt

    async def test_prompt_does_not_contain_wrong_claimed_value(
        self, async_client: AsyncClient, mock_claude
    ):
        await async_client.post("/rationale", json=self.PAYLOAD)
        prompt = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        # Gross Profit line must NOT say +$100,000 (the claimed wrong value)
        # It should show the negative calculated value
        lines = [l for l in prompt.splitlines() if "Gross Profit" in l]
        assert lines, "Gross Profit line missing from prompt"
        assert "100,000" not in lines[0].replace("-100,000", ""), \
            f"Prompt used claimed $100K instead of calculated −$100K: {lines[0]}"

    async def test_negative_gp_shows_na_expense_ratio_not_absurd_percentage(
        self, async_client: AsyncClient, mock_claude
    ):
        """gross_profit = −$100K → expense_ratio must show N/A, not 8,000,000%."""
        await async_client.post("/rationale", json=self.PAYLOAD)
        prompt = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        assert_no_numeric_nan(prompt)
        assert "N/A" in prompt, "Expected N/A for expense_ratio when gross_profit is negative"


# ─── Edge Case 3 — 100% Lifestyle Solopreneur ────────────────────────────────

class TestLifestyleSolopreneur:
    """Revenue=$200K, COGS=$0, Owner Salary=$200K, Other OpEx=$0.
    EBITDA must be $0. SDE must be $200K and invariant to salary slider."""

    BASE_DATA = {
        "business_name": "Solo LLC", "fiscal_year": "2024",
        "revenue": 200_000, "cogs": 0, "gross_profit": 200_000,
        "operating_expenses": 200_000, "owner_salary": 200_000,
        "rent": None, "marketing": None, "ebitda": None, "sde": None,
        "yoy_growth": 0.08, "employee_count": 1, "notes": None,
        "industry": "professional_services", "cash_on_hand": None,
    }

    async def test_returns_200(self, async_client: AsyncClient):
        payload = {"data": self.BASE_DATA,
                   "assumptions": {"owner_salary": 200_000, "growth_rate": 0.08,
                                   "cogs_adjustment": 0.0, "opex_adjustment": 0.0},
                   "score": 60}
        res = await async_client.post("/rationale", json=payload)
        assert res.status_code == 200

    async def test_sde_is_200k_in_prompt(self, async_client: AsyncClient, mock_claude):
        payload = {"data": self.BASE_DATA,
                   "assumptions": {"owner_salary": 200_000, "growth_rate": 0.08,
                                   "cogs_adjustment": 0.0, "opex_adjustment": 0.0},
                   "score": 60}
        await async_client.post("/rationale", json=payload)
        prompt = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        assert "200,000" in prompt   # SDE line

    async def test_sde_invariant_at_100k_slider(self, async_client: AsyncClient, mock_claude):
        payload = {"data": self.BASE_DATA,
                   "assumptions": {"owner_salary": 100_000, "growth_rate": 0.08,
                                   "cogs_adjustment": 0.0, "opex_adjustment": 0.0},
                   "score": 60}
        await async_client.post("/rationale", json=payload)
        prompt = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        # SDE must still be $200K, not $100K
        sde_lines = [l for l in prompt.splitlines() if "SDE" in l and "Owner" in l]
        assert sde_lines, "SDE line missing from prompt"
        assert "200,000" in sde_lines[0], \
            f"SDE changed when it shouldn't have: {sde_lines[0]}"

    async def test_runway_absent_when_ebitda_zero(self, async_client: AsyncClient, mock_claude):
        """EBITDA = $0 → not burning cash → no runway line."""
        payload = {"data": self.BASE_DATA,
                   "assumptions": {"owner_salary": 200_000, "growth_rate": 0.08,
                                   "cogs_adjustment": 0.0, "opex_adjustment": 0.0},
                   "score": 60}
        await async_client.post("/rationale", json=payload)
        prompt = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        assert "Runway" not in prompt


# ─── Edge Case 4 — 9,900% Hyper-Growth ───────────────────────────────────────

class TestHyperGrowth:
    """Current Revenue=$1M, Prior Year=$10K → YoY = 9,900% (decimal 99.0).
    System must handle 4-digit percentages. No NaN. Score must not hallucinate."""

    PAYLOAD = {
        "data": {
            "business_name": "Rocket Inc", "fiscal_year": "2024",
            "revenue": 1_000_000, "cogs": 300_000, "gross_profit": 700_000,
            "operating_expenses": 400_000, "owner_salary": 120_000,
            "rent": None, "marketing": None, "ebitda": None, "sde": None,
            "yoy_growth": 99.0, "employee_count": 8, "notes": None,
            "industry": "saas", "cash_on_hand": None,
        },
        "assumptions": {"owner_salary": 120_000, "growth_rate": 99.0,
                        "cogs_adjustment": 0.0, "opex_adjustment": 0.0},
        "score": 88,
    }

    async def test_returns_200(self, async_client: AsyncClient):
        res = await async_client.post("/rationale", json=self.PAYLOAD)
        assert res.status_code == 200

    async def test_prompt_contains_4_digit_growth_percentage(
        self, async_client: AsyncClient, mock_claude
    ):
        await async_client.post("/rationale", json=self.PAYLOAD)
        prompt = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        # growth_rate=99.0 → formatted as "9900.0%"
        assert "9900" in prompt

    async def test_no_numeric_nan_in_prompt(self, async_client: AsyncClient, mock_claude):
        await async_client.post("/rationale", json=self.PAYLOAD)
        prompt = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        assert_no_numeric_nan(prompt)

    async def test_sde_invariant_at_extreme_growth(
        self, async_client: AsyncClient, mock_claude
    ):
        """SDE must stay stable even with 9900% growth assumption."""
        for salary in [120_000, 300_000, 600_000]:
            payload = {**self.PAYLOAD,
                       "assumptions": {"owner_salary": salary, "growth_rate": 99.0,
                                       "cogs_adjustment": 0.0, "opex_adjustment": 0.0}}
            res = await async_client.post("/rationale", json=payload)
            assert res.status_code == 200, f"Failed for salary={salary}"
