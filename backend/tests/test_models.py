import pytest
from pydantic import ValidationError
from models import FinancialData, Assumptions, RationaleRequest, ParseTextRequest


class TestFinancialData:
    def test_all_fields_optional(self):
        fd = FinancialData()
        assert fd.revenue is None
        assert fd.industry is None

    def test_accepts_full_riverside_data(self):
        fd = FinancialData(
            business_name="Riverside Landscaping LLC",
            fiscal_year="2023",
            revenue=1_840_000,
            cogs=1_102_000,
            gross_profit=738_000,
            operating_expenses=312_000,
            owner_salary=120_000,
            ebitda=426_000,
            sde=546_000,
            yoy_growth=0.14,
            employee_count=15,
            industry="landscaping",
        )
        assert fd.revenue == 1_840_000
        assert fd.industry == "landscaping"

    def test_employee_count_must_be_int(self):
        with pytest.raises(ValidationError):
            FinancialData(employee_count="fifteen")

    def test_yoy_growth_as_decimal(self):
        fd = FinancialData(yoy_growth=0.14)
        assert fd.yoy_growth == pytest.approx(0.14)


class TestAssumptions:
    def test_all_fields_required(self):
        with pytest.raises(ValidationError):
            Assumptions()  # missing required fields

    def test_valid_assumptions(self):
        a = Assumptions(owner_salary=120_000, growth_rate=0.14, cogs_adjustment=0.0, opex_adjustment=0.0)
        assert a.owner_salary == 120_000
        assert a.growth_rate == pytest.approx(0.14)

    def test_negative_adjustments_valid(self):
        a = Assumptions(owner_salary=0, growth_rate=-0.10, cogs_adjustment=-0.20, opex_adjustment=-0.15)
        assert a.cogs_adjustment == pytest.approx(-0.20)


class TestParseTextRequest:
    def test_requires_text_field(self):
        with pytest.raises(ValidationError):
            ParseTextRequest()

    def test_accepts_text(self):
        req = ParseTextRequest(text="Revenue: $1,000,000")
        assert req.text == "Revenue: $1,000,000"


class TestRationaleRequest:
    def test_valid_request(self):
        req = RationaleRequest(
            data=FinancialData(revenue=1_000_000),
            assumptions=Assumptions(owner_salary=80_000, growth_rate=0.10, cogs_adjustment=0, opex_adjustment=0),
            score=75.0,
        )
        assert req.score == 75.0

    def test_score_accepts_float(self):
        req = RationaleRequest(
            data=FinancialData(),
            assumptions=Assumptions(owner_salary=0, growth_rate=0, cogs_adjustment=0, opex_adjustment=0),
            score=83.5,
        )
        assert req.score == pytest.approx(83.5)
