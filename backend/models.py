from pydantic import BaseModel
from typing import Optional


class FinancialData(BaseModel):
    business_name: Optional[str] = None
    fiscal_year: Optional[str] = None
    revenue: Optional[float] = None
    cogs: Optional[float] = None
    gross_profit: Optional[float] = None
    operating_expenses: Optional[float] = None
    owner_salary: Optional[float] = None
    rent: Optional[float] = None
    marketing: Optional[float] = None
    ebitda: Optional[float] = None
    sde: Optional[float] = None
    yoy_growth: Optional[float] = None  # as decimal, e.g. 0.14 for 14%
    employee_count: Optional[int] = None
    cash_on_hand: Optional[float] = None
    notes: Optional[str] = None
    industry: Optional[str] = None


class Assumptions(BaseModel):
    owner_salary: float
    growth_rate: float   # decimal
    cogs_adjustment: float  # decimal, e.g. 0.05 = 5% increase
    opex_adjustment: float  # decimal


class RationaleRequest(BaseModel):
    data: FinancialData
    assumptions: Assumptions
    score: float


class ParseTextRequest(BaseModel):
    text: str


class ParseResponse(BaseModel):
    data: FinancialData


class BusinessInsights(BaseModel):
    whats_working: list[str] = []
    whats_not: list[str] = []
    fix_first: list[str] = []


class RationaleResponse(BaseModel):
    rationale: str
    insights: BusinessInsights
