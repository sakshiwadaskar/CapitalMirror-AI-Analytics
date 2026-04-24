"""
Document ingestion test suite — three layers:

  Layer 1 — Text extraction (no LLM, instant)
      Tests extract_pdf_text() and extract_csv_text() directly.

  Layer 2 — Prompt construction (mock LLM, fast)
      Verifies the right content reaches the model for varied input formats.
      Run with: pytest tests/test_ingestion.py

  Layer 3 — Real extraction quality (real Claude, slow, costs API credits)
      Run with: pytest tests/test_ingestion.py -m integration
      Validates actual field values extracted from each fixture.
"""
import io
import json
import pytest
from pathlib import Path
from httpx import AsyncClient

FIXTURES = Path(__file__).parent / "fixtures"


# ─────────────────────────────────────────────────────────────────────────────
# Layer 1 — Text extraction (pure Python, no LLM)
# ─────────────────────────────────────────────────────────────────────────────

class TestPDFExtraction:
    """extract_pdf_text() must return a non-empty string for every fixture PDF."""

    @pytest.mark.parametrize("pdf_name", [
        "riverside_annual.pdf",
        "saas_monthly.pdf",
        "quarterly_pl.pdf",
        "narrative_paragraph.pdf",
        "messy_export.pdf",
        "missing_fields.pdf",
    ])
    def test_extracts_text_from_pdf(self, pdf_name: str):
        from main import extract_pdf_text
        raw = (FIXTURES / pdf_name).read_bytes()
        text = extract_pdf_text(raw)
        assert isinstance(text, str)
        assert len(text.strip()) > 10, f"{pdf_name}: extracted text too short"

    def test_pdf_contains_key_words(self):
        from main import extract_pdf_text
        raw = (FIXTURES / "riverside_annual.pdf").read_bytes()
        text = extract_pdf_text(raw)
        assert "1,840,000" in text or "1840000" in text

    def test_messy_pdf_extracts_without_crash(self):
        from main import extract_pdf_text
        raw = (FIXTURES / "messy_export.pdf").read_bytes()
        assert extract_pdf_text(raw)  # non-empty, no exception


class TestCSVExtraction:
    """extract_csv_text() must produce readable row text from varied CSV inputs."""

    def test_standard_csv(self):
        from main import extract_csv_text
        raw = (FIXTURES / "minimal.csv").read_bytes()
        text = extract_csv_text(raw)
        assert "revenue" in text.lower()
        assert "1840000" in text

    def test_empty_csv_returns_empty_string(self):
        from main import extract_csv_text
        assert extract_csv_text(b"") == ""

    def test_single_row_csv(self):
        from main import extract_csv_text
        text = extract_csv_text(b"revenue\n500000")
        assert "500000" in text

    def test_csv_with_headers_and_multiple_rows(self):
        from main import extract_csv_text
        data = b"metric,value,notes\nrevenue,1000000,annual\ncogs,400000,direct"
        text = extract_csv_text(data)
        assert "revenue" in text
        assert "1000000" in text

    def test_csv_with_dollar_signs_preserved(self):
        from main import extract_csv_text
        text = extract_csv_text(b"Revenue,$1,840,000\nCOGS,$1,102,000")
        assert "1,840,000" in text or "1840000" in text


# ─────────────────────────────────────────────────────────────────────────────
# Layer 2 — Prompt construction (mock LLM, parametrized over all fixtures)
# ─────────────────────────────────────────────────────────────────────────────

FIXTURE_CASES = [
    ("riverside_annual.txt",     "text/plain",  {"revenue_hint": "1,840,000", "industry_hint": "landscap"}),
    ("saas_monthly.txt",         "text/plain",  {"revenue_hint": "85,000",    "industry_hint": None}),
    ("quarterly_pl.txt",         "text/plain",  {"revenue_hint": "480,000",   "industry_hint": "construct"}),
    ("narrative_paragraph.txt",  "text/plain",  {"revenue_hint": "498,000",   "industry_hint": None}),
    ("messy_export.txt",         "text/plain",  {"revenue_hint": "1,036,000", "industry_hint": None}),
    ("missing_fields.txt",       "text/plain",  {"revenue_hint": "180,000",   "industry_hint": None}),
    ("minimal.csv",              "text/csv",    {"revenue_hint": "1840000",   "industry_hint": "landscap"}),
    ("riverside_annual.pdf",     "application/pdf", {"revenue_hint": "1,840,000", "industry_hint": None}),
]


class TestParseFileVariousFormats:
    """Every fixture file should return 200 and a valid FinancialData schema."""

    @pytest.mark.parametrize("filename,mime,hints", FIXTURE_CASES)
    async def test_returns_200(
        self, async_client: AsyncClient, filename: str, mime: str, hints: dict
    ):
        raw = (FIXTURES / filename).read_bytes()
        res = await async_client.post(
            "/parse-file",
            files={"file": (filename, raw, mime)},
        )
        assert res.status_code == 200, f"{filename}: got {res.status_code} — {res.text[:200]}"

    @pytest.mark.parametrize("filename,mime,hints", FIXTURE_CASES)
    async def test_response_has_required_schema_fields(
        self, async_client: AsyncClient, filename: str, mime: str, hints: dict
    ):
        raw = (FIXTURES / filename).read_bytes()
        res = await async_client.post(
            "/parse-file",
            files={"file": (filename, raw, mime)},
        )
        data = res.json()["data"]
        for field in ["revenue", "gross_profit", "operating_expenses", "industry"]:
            assert field in data, f"{filename}: missing field '{field}'"

    @pytest.mark.parametrize("filename,mime,hints", FIXTURE_CASES)
    async def test_prompt_contains_source_text(
        self, async_client: AsyncClient, mock_claude,
        filename: str, mime: str, hints: dict
    ):
        """The raw file text must actually reach the prompt — nothing silently dropped."""
        raw = (FIXTURES / filename).read_bytes()
        await async_client.post(
            "/parse-file",
            files={"file": (filename, raw, mime)},
        )
        prompt = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        hint = hints["revenue_hint"]
        if hint:
            assert hint in prompt, \
                f"{filename}: expected '{hint}' in prompt but it wasn't there"


class TestParseTextVariousFormats:

    async def test_clean_annual_pl_text(self, async_client: AsyncClient):
        text = (FIXTURES / "riverside_annual.txt").read_text()
        res = await async_client.post("/parse", json={"text": text})
        assert res.status_code == 200

    async def test_monthly_saas_text(self, async_client: AsyncClient):
        text = (FIXTURES / "saas_monthly.txt").read_text()
        res = await async_client.post("/parse", json={"text": text})
        assert res.status_code == 200

    async def test_narrative_paragraph_text(self, async_client: AsyncClient):
        text = (FIXTURES / "narrative_paragraph.txt").read_text()
        res = await async_client.post("/parse", json={"text": text})
        assert res.status_code == 200

    async def test_whitespace_garbage_returns_400(self, async_client: AsyncClient):
        res = await async_client.post("/parse", json={"text": "   \n\n\t  "})
        assert res.status_code == 400

    async def test_unicode_symbols_do_not_crash(self, async_client: AsyncClient):
        text = "Revenue: €1,200,000\nCOGS: €480,000\nIndustrie: Einzelhandel"
        res = await async_client.post("/parse", json={"text": text})
        assert res.status_code == 200

    async def test_temperature_zero_on_all_parse_calls(
        self, async_client: AsyncClient, mock_claude
    ):
        text = (FIXTURES / "riverside_annual.txt").read_text()
        await async_client.post("/parse", json={"text": text})
        call_kwargs = mock_claude.messages.create.call_args.kwargs
        assert call_kwargs.get("temperature") == 0


class TestPromptContainsAnnualisationRule:
    """Verify the extraction prompt instructs Claude to annualise monthly data."""

    async def test_annualisation_rule_in_prompt(
        self, async_client: AsyncClient, mock_claude
    ):
        text = (FIXTURES / "saas_monthly.txt").read_text()
        await async_client.post("/parse", json={"text": text})
        prompt = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        assert "ANNUAL" in prompt.upper() or "annuali" in prompt.lower()

    async def test_quarterly_signals_in_prompt(
        self, async_client: AsyncClient, mock_claude
    ):
        text = (FIXTURES / "quarterly_pl.txt").read_text()
        await async_client.post("/parse", json={"text": text})
        prompt = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
        assert "quarterly" in prompt.lower() or "Q3" in prompt


# ─────────────────────────────────────────────────────────────────────────────
# Layer 3 — Real extraction quality (pytest -m integration)
# These call the real Anthropic API and validate actual extracted values.
# Skip by default; run explicitly when testing extraction prompt changes.
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.integration
class TestRealExtractionRiverside:
    """Riverside annual P&L — all key values must be correct."""

    async def test_revenue_extracted(self, real_client: AsyncClient):
        text = (FIXTURES / "riverside_annual.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        assert res.json()["data"]["revenue"] == pytest.approx(1_840_000, rel=0.01)

    async def test_gross_profit_extracted(self, real_client: AsyncClient):
        text = (FIXTURES / "riverside_annual.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        assert res.json()["data"]["gross_profit"] == pytest.approx(738_000, rel=0.01)

    async def test_owner_salary_extracted(self, real_client: AsyncClient):
        text = (FIXTURES / "riverside_annual.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        assert res.json()["data"]["owner_salary"] == pytest.approx(120_000, rel=0.01)

    async def test_yoy_growth_extracted(self, real_client: AsyncClient):
        text = (FIXTURES / "riverside_annual.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        assert res.json()["data"]["yoy_growth"] == pytest.approx(0.14, abs=0.01)

    async def test_industry_detected_as_landscaping(self, real_client: AsyncClient):
        text = (FIXTURES / "riverside_annual.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        assert res.json()["data"]["industry"] == "landscaping"


@pytest.mark.integration
class TestRealExtractionSaaSMonthly:
    """SaaS monthly data — annualisation must be applied (×12)."""

    async def test_revenue_annualised(self, real_client: AsyncClient):
        text = (FIXTURES / "saas_monthly.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        revenue = res.json()["data"]["revenue"]
        # 85,000 × 12 = 1,020,000 — must NOT be raw 85,000
        assert revenue == pytest.approx(1_020_000, rel=0.05), \
            f"Expected annualised revenue ~$1.02M, got ${revenue:,.0f}"

    async def test_founder_salary_annualised(self, real_client: AsyncClient):
        text = (FIXTURES / "saas_monthly.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        salary = res.json()["data"]["owner_salary"]
        # 8,000 × 12 = 96,000
        assert salary == pytest.approx(96_000, rel=0.05), \
            f"Expected annualised salary ~$96K, got ${salary:,.0f}"

    async def test_yoy_growth_correct(self, real_client: AsyncClient):
        text = (FIXTURES / "saas_monthly.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        assert res.json()["data"]["yoy_growth"] == pytest.approx(0.85, abs=0.02)

    async def test_cash_on_hand_extracted(self, real_client: AsyncClient):
        text = (FIXTURES / "saas_monthly.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        cash = res.json()["data"].get("cash_on_hand")
        assert cash == pytest.approx(220_000, rel=0.05), \
            f"Expected cash_on_hand $220K, got {cash}"

    async def test_industry_detected_as_saas(self, real_client: AsyncClient):
        text = (FIXTURES / "saas_monthly.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        assert res.json()["data"]["industry"] == "saas"


@pytest.mark.integration
class TestRealExtractionQuarterly:
    """Q3 construction P&L — values must be multiplied by 4."""

    async def test_revenue_annualised_from_quarterly(self, real_client: AsyncClient):
        text = (FIXTURES / "quarterly_pl.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        revenue = res.json()["data"]["revenue"]
        # $480,000 × 4 = $1,920,000
        assert revenue == pytest.approx(1_920_000, rel=0.05), \
            f"Expected annualised quarterly revenue ~$1.92M, got ${revenue:,.0f}"

    async def test_industry_detected_as_construction(self, real_client: AsyncClient):
        text = (FIXTURES / "quarterly_pl.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        assert res.json()["data"]["industry"] == "construction"


@pytest.mark.integration
class TestRealExtractionNarrative:
    """Prose paragraph — key metrics extracted from natural language."""

    async def test_revenue_extracted_from_prose(self, real_client: AsyncClient):
        text = (FIXTURES / "narrative_paragraph.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        revenue = res.json()["data"]["revenue"]
        assert revenue == pytest.approx(498_000, rel=0.05), \
            f"Expected ~$498K revenue from prose, got ${revenue:,.0f}"

    async def test_owner_salary_from_prose(self, real_client: AsyncClient):
        text = (FIXTURES / "narrative_paragraph.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        salary = res.json()["data"]["owner_salary"]
        assert salary == pytest.approx(72_000, rel=0.05)

    async def test_yoy_growth_from_prose(self, real_client: AsyncClient):
        text = (FIXTURES / "narrative_paragraph.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        growth = res.json()["data"]["yoy_growth"]
        assert growth == pytest.approx(0.09, abs=0.02)


@pytest.mark.integration
class TestRealExtractionMissingFields:
    """Sparse input — missing fields must be null, not invented."""

    async def test_missing_cogs_is_null(self, real_client: AsyncClient):
        text = (FIXTURES / "missing_fields.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        assert res.json()["data"]["cogs"] is None

    async def test_missing_yoy_growth_is_null(self, real_client: AsyncClient):
        text = (FIXTURES / "missing_fields.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        assert res.json()["data"]["yoy_growth"] is None

    async def test_revenue_extracted_despite_sparse_input(self, real_client: AsyncClient):
        text = (FIXTURES / "missing_fields.txt").read_text()
        res = await real_client.post("/parse", json={"text": text})
        revenue = res.json()["data"]["revenue"]
        assert revenue == pytest.approx(180_000, rel=0.10)


@pytest.mark.integration
class TestRealExtractionPDF:
    """PDF upload — pdfplumber + Claude round-trip."""

    async def test_riverside_pdf_matches_text_extraction(self, real_client: AsyncClient):
        pdf_bytes = (FIXTURES / "riverside_annual.pdf").read_bytes()
        txt_text  = (FIXTURES / "riverside_annual.txt").read_text()

        pdf_res = await real_client.post(
            "/parse-file",
            files={"file": ("riverside_annual.pdf", pdf_bytes, "application/pdf")},
        )
        txt_res = await real_client.post("/parse", json={"text": txt_text})

        pdf_data = pdf_res.json()["data"]
        txt_data = txt_res.json()["data"]

        assert pdf_data["revenue"] == pytest.approx(txt_data["revenue"], rel=0.02), \
            "PDF and text extraction produced different revenue values"
