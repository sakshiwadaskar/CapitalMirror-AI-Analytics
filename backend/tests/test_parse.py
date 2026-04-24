import json
import pytest
from httpx import AsyncClient


# ─── POST /parse ─────────────────────────────────────────────────────────────

class TestParseText:
    async def test_returns_200_with_valid_text(self, async_client: AsyncClient, conftest_riverside_text):
        res = await async_client.post("/parse", json={"text": conftest_riverside_text})
        assert res.status_code == 200

    async def test_returns_financial_data_structure(self, async_client: AsyncClient, conftest_riverside_text):
        res = await async_client.post("/parse", json={"text": conftest_riverside_text})
        data = res.json()["data"]
        assert "revenue" in data
        assert "gross_profit" in data
        assert "industry" in data

    async def test_riverside_revenue_extracted_correctly(self, async_client: AsyncClient, conftest_riverside_text):
        res = await async_client.post("/parse", json={"text": conftest_riverside_text})
        assert res.json()["data"]["revenue"] == 1_840_000.0

    async def test_riverside_industry_detected_as_landscaping(self, async_client: AsyncClient, conftest_riverside_text):
        res = await async_client.post("/parse", json={"text": conftest_riverside_text})
        assert res.json()["data"]["industry"] == "landscaping"

    async def test_empty_text_returns_400(self, async_client: AsyncClient):
        res = await async_client.post("/parse", json={"text": ""})
        assert res.status_code == 400

    async def test_whitespace_only_returns_400(self, async_client: AsyncClient):
        res = await async_client.post("/parse", json={"text": "   \n\t  "})
        assert res.status_code == 400

    async def test_response_structure_has_all_expected_fields(self, async_client: AsyncClient):
        res = await async_client.post("/parse", json={"text": "Revenue: $500,000"})
        data = res.json()["data"]
        expected_fields = ["revenue", "cogs", "gross_profit", "operating_expenses",
                           "owner_salary", "ebitda", "sde", "yoy_growth", "industry"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"


# ─── POST /parse-file ────────────────────────────────────────────────────────

class TestParseFile:
    async def test_csv_upload_returns_200(self, async_client: AsyncClient):
        csv_content = b"revenue,cogs,gross_profit,operating_expenses\n1840000,1102000,738000,312000"
        res = await async_client.post(
            "/parse-file",
            files={"file": ("data.csv", csv_content, "text/csv")},
        )
        assert res.status_code == 200

    async def test_csv_upload_extracts_revenue(self, async_client: AsyncClient):
        csv_content = b"revenue,cogs\n1840000,1102000"
        res = await async_client.post(
            "/parse-file",
            files={"file": ("data.csv", csv_content, "text/csv")},
        )
        assert res.json()["data"]["revenue"] == 1_840_000.0

    async def test_txt_upload_returns_200(self, async_client: AsyncClient, conftest_riverside_text):
        res = await async_client.post(
            "/parse-file",
            files={"file": ("pl.txt", conftest_riverside_text.encode(), "text/plain")},
        )
        assert res.status_code == 200

    async def test_empty_file_returns_422(self, async_client: AsyncClient):
        res = await async_client.post(
            "/parse-file",
            files={"file": ("empty.txt", b"", "text/plain")},
        )
        assert res.status_code == 422

    async def test_response_has_data_key(self, async_client: AsyncClient):
        csv_content = b"revenue\n500000"
        res = await async_client.post(
            "/parse-file",
            files={"file": ("r.csv", csv_content, "text/csv")},
        )
        assert "data" in res.json()


# ─── Regression: temperature=0 on extraction ─────────────────────────────────

class TestExtractionTemperature:
    async def test_claude_called_with_temperature_zero(self, async_client: AsyncClient, mock_claude, conftest_riverside_text):
        await async_client.post("/parse", json={"text": conftest_riverside_text})
        call_kwargs = mock_claude.messages.create.call_args.kwargs
        assert call_kwargs.get("temperature") == 0


# ─── Fixtures only needed in this module ─────────────────────────────────────

@pytest.fixture
def conftest_riverside_text():
    from tests.conftest import RIVERSIDE_TEXT
    return RIVERSIDE_TEXT
