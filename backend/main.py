import io
import os
import csv
import json

import pdfplumber
import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import (
    FinancialData,
    ParseTextRequest,
    ParseResponse,
    RationaleRequest,
    RationaleResponse,
    BusinessInsights,
)

load_dotenv()

app = FastAPI(title="Business Health API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

EXTRACT_PROMPT = """You are a financial data extractor. Given ANY format of financial input — structured tables, CSV, PDF text, messy spreadsheet exports, or plain prose — extract the fields below and return a single JSON object. Use null for any field not found. Never invent or default-to-zero a missing field.

═══ RULE 1 — NUMBER FORMATS ═══
• Strip all currency symbols ($, €, £, ¥, etc.), commas, and whitespace from numbers.
• Expand abbreviations: K = ×1,000 | M = ×1,000,000 | B = ×1,000,000,000
  Examples: "$1.84M" → 1840000 | "£420K" → 420000 | "2.1B" → 2100000000
• Ranges like "$1.5M–$2M" or "~$800K" → use the midpoint or stated approximation.
• Percentages: "+14%" → 0.14 | "−5%" → −0.05 | "85% YoY" → 0.85

═══ RULE 2 — PERIODICITY: ALL OUTPUTS MUST BE ANNUAL ═══
Step 1 — Identify the period of EACH figure in the source:
  MONTHLY  → labels: "Monthly", "per month", "/mo", "MRR" (monthly recurring revenue), or figures clearly too small for an annual business
  QUARTERLY → labels: "Q1/Q2/Q3/Q4", "quarterly", "per quarter", or a single quarter P&L
  ANNUAL   → labels: "Annual", "Yearly", "FY 20XX", "TTM", "trailing 12 months", "LTM", "ARR" (annual recurring revenue), or a full-year P&L
Step 2 — Annualise every monetary figure before outputting:
  Monthly  × 12 | Quarterly × 4 | Annual × 1
Step 3 — Mixed-period documents: annualise EACH LINE individually using its own period label before summing.
Step 4 — Ambiguous magnitude: if a label gives no period hint, infer from context.
  Example: a described SaaS business showing "Revenue: 85000" with no label is almost certainly monthly (annual $85K is implausibly small for SaaS) → output 1020000.

═══ RULE 3 — FIELD CLASSIFICATION ═══
revenue      Total income from ALL sources combined (subscriptions, services, product sales, licences). If only MRR is given, ARR = MRR × 12.
cogs         DIRECT costs that vary with delivery — what changes if you serve one more customer:
               • SaaS/software: hosting, infrastructure, payment processing, third-party API/data fees
               • Services (landscaping, construction, consulting): direct labour, materials, subcontractors
               • Retail/ecommerce: cost of goods, fulfilment, shipping
               NOT cogs: management salaries, marketing, rent, admin, support contractors, office software
gross_profit revenue − cogs. Compute if not explicitly stated.
operating_expenses  ALL costs EXCLUDING cogs. Includes: owner/employee salaries, marketing, rent, utilities, SaaS tools, admin, insurance, support contractors, professional fees.
owner_salary Total annual compensation for ALL owners/founders combined. If multiple founders have separate lines, sum them. Annualise if monthly.
marketing    Annual paid marketing, advertising, or customer acquisition spend. Extract from opex if itemised separately.
rent         Annual rent or lease payments for physical space.
ebitda       gross_profit − operating_expenses. Compute if not explicitly stated.
sde          ebitda + owner_salary. Compute if not explicitly stated.
yoy_growth   Year-over-year revenue growth as a decimal. "Revenue grew 85%" → 0.85 | "down 10%" → −0.10.
employee_count  Headcount as an integer. "15 FTEs" → 15.
business_name  Company or business name if mentioned.
fiscal_year  Four-digit year string, e.g. "2024". Infer from date labels if not explicit.
notes        Any qualitative context: churn rate, runway, key risks, customer concentration, one-time items, business model details.
industry     Detect from context. Use EXACTLY one of: "landscaping" | "restaurant" | "saas" | "retail" | "construction" | "professional_services" | "ecommerce" | "healthcare" | "manufacturing" | "general"

═══ RULE 4 — DISAMBIGUATION ═══
• "SaaS Subscriptions" as an INCOME line → revenue. As an EXPENSE line → operating_expenses (software tools).
• "Customer Support (Contractors)" → operating_expenses (not cogs unless explicitly described as direct service delivery).
• "Total Expenses" with no breakdown → use as operating_expenses only; set cogs = null.
• A line labelled "Expenses" or "Costs" that clearly bundles everything → split into cogs and operating_expenses using business-type logic; if unsure, put in operating_expenses and set cogs = null.
• "Runway: 18 months" → notes field only (derived, not a source figure).
• "Cash on Hand: $220K" or "Cash: $220K" or "Cash & equivalents: $220K" → cash_on_hand field (number, not annualised — it is a balance, not a flow).

═══ RULE 5 — PROSE / NARRATIVE INPUT ═══
Extract numbers from natural-language sentences:
  "We generated $1.8M in revenue last year" → revenue = 1800000
  "Our monthly burn is approximately $50K" → notes (burn not a direct field; owner can infer)
  "The founder takes home $8,000 a month" → owner_salary = 96000 (monthly × 12)
Apply all annualisation and classification rules identically to prose.

═══ OUTPUT ═══
Return ONLY valid JSON — no markdown, no code fences, no explanation, no commentary.
Keys: business_name, fiscal_year, revenue, cogs, gross_profit, operating_expenses, owner_salary, rent, marketing, ebitda, sde, yoy_growth, employee_count, cash_on_hand, notes, industry

Raw financial data:
"""


def call_claude_extract(raw_text: str) -> FinancialData:
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        temperature=0,
        messages=[{"role": "user", "content": EXTRACT_PROMPT + raw_text}],
    )
    content = message.content[0].text.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}") + 1
        if start >= 0 and end > start:
            parsed = json.loads(content[start:end])
        else:
            raise HTTPException(status_code=422, detail="Could not parse financial data from input")
    return FinancialData(**{k: parsed.get(k) for k in FinancialData.model_fields})


def extract_csv_text(content: bytes) -> str:
    text = content.decode("utf-8", errors="replace")
    rows = list(csv.reader(io.StringIO(text)))
    return "\n".join(",".join(row) for row in rows)


def extract_pdf_text(content: bytes) -> str:
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/parse", response_model=ParseResponse)
async def parse_text(req: ParseTextRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="No text provided")
    data = call_claude_extract(req.text)
    return ParseResponse(data=data)


@app.post("/parse-file", response_model=ParseResponse)
async def parse_file(file: UploadFile = File(...)):
    content = await file.read()
    name = (file.filename or "").lower()
    if name.endswith(".pdf"):
        raw = extract_pdf_text(content)
    elif name.endswith(".csv"):
        raw = extract_csv_text(content)
    else:
        raw = content.decode("utf-8", errors="replace")
    if not raw.strip():
        raise HTTPException(status_code=422, detail="Could not extract text from file")
    data = call_claude_extract(raw)
    return ParseResponse(data=data)


RATIONALE_PROMPT = """You are a plain-speaking business analyst. Given the following business financials and health score, return a JSON object with exactly these four keys:

1. "rationale": 2-3 sentences explaining what the score means — what's driving it, what's working, and the single most important thing to address. Written for a business owner, not an analyst. No jargon.

2. "whats_working": array of up to 3 short sentences (one each) describing what is genuinely strong about this business.

3. "whats_not": array of up to 3 short sentences describing the biggest weaknesses or risks.

4. "fix_first": array of up to 3 short sentences describing the highest-priority actions to take, in order.

Each point in the arrays must be a single short sentence written for a business owner. Be specific to the numbers, not generic.

IMPORTANT: Use ONLY the exact numbers provided below. Do not estimate, round differently, or generate your own calculations. Every number you mention must match exactly what is provided here. When referencing SDE ratio, always describe it as '% of revenue', never '% of gross profit'. When referencing expense ratio, always describe it as '% of gross profit', never '% of revenue'.

Score: {score}/100
Revenue: ${revenue:,.0f}
Gross Profit: ${gross_profit:,.0f}
Gross Margin: {gross_margin}
Operating Expenses (OpEx): ${opex:,.0f}
Expense Ratio (OpEx/Gross Profit): {expense_ratio}
Owner Salary: ${owner_salary:,.0f}
SDE (Owner Earnings): ${sde:,.0f}
SDE as % of Revenue: {sde_ratio}
YoY Growth: {yoy_growth}%
{runway_line}Notes: {notes}

Return ONLY valid JSON. No markdown, no code fences, no explanation."""


@app.post("/rationale", response_model=RationaleResponse)
async def get_rationale(req: RationaleRequest):
    d = req.data
    a = req.assumptions
    revenue = d.revenue if d.revenue is not None else 0

    base_cogs = d.cogs if d.cogs is not None else (revenue - (d.gross_profit or 0))
    cogs = base_cogs * (1 + a.cogs_adjustment)
    gross_profit = revenue - cogs

    document_salary = d.owner_salary or 0
    base_non_salary_opex = (d.operating_expenses or 0) - document_salary
    non_salary_opex = base_non_salary_opex * (1 + a.opex_adjustment)
    opex = non_salary_opex + a.owner_salary

    ebitda = gross_profit - opex
    sde = ebitda + a.owner_salary

    if ebitda < 0 and d.cash_on_hand:
        monthly_burn = abs(ebitda) / 12
        runway_months = d.cash_on_hand / monthly_burn
        runway_line = f"Cash on Hand: ${d.cash_on_hand:,.0f} | Monthly Burn: ${monthly_burn:,.0f} | Runway: {runway_months:.1f} months\n"
    else:
        runway_line = ""

    def pct(numerator: float, denominator: float) -> str:
        if denominator <= 0:
            return "N/A"
        return f"{round(numerator / denominator * 100, 1)}%"

    prompt = RATIONALE_PROMPT.format(
        score=round(req.score),
        revenue=revenue,
        gross_profit=gross_profit,
        gross_margin=pct(gross_profit, revenue),
        opex=opex,
        expense_ratio=pct(opex, gross_profit),
        owner_salary=a.owner_salary,
        sde=sde,
        sde_ratio=pct(sde, revenue),
        yoy_growth=round(a.growth_rate * 100, 1),
        runway_line=runway_line,
        notes=d.notes or "None provided",
    )
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        temperature=0.3,
        messages=[{"role": "user", "content": prompt}],
    )
    content = message.content[0].text.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}") + 1
        parsed = json.loads(content[start:end]) if start >= 0 and end > start else {}

    return RationaleResponse(
        rationale=parsed.get("rationale", ""),
        insights=BusinessInsights(
            whats_working=parsed.get("whats_working", [])[:3],
            whats_not=parsed.get("whats_not", [])[:3],
            fix_first=parsed.get("fix_first", [])[:3],
        ),
    )
