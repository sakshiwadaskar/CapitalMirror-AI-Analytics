# CapitalMirror — Business Health Dashboard

Paste or upload a P&L. Get a health score, AI insights, and live assumption sliders — in under 60 seconds.

---

## What it does

### 1. Document Ingestion
Accepts CSV, PDF, or pasted text in any format — QuickBooks exports, accountant emails, messy spreadsheets, or plain prose. Claude Sonnet extracts structured financial data: revenue, COGS, gross profit, OpEx, owner salary, EBITDA, SDE, YoY growth, industry, and more. Handles inconsistent formatting, abbreviations ($1.84M), monthly/quarterly figures (auto-annualised), and mixed-period documents.

### 2. Business Health Score
A single 0–100 score calculated from four components against industry benchmarks:

| Component | Weight | What it measures |
|---|---|---|
| Gross Margin | 30 pts | Revenue quality after direct costs |
| SDE Ratio | 25 pts | Owner earnings as % of revenue |
| YoY Growth | 25 pts | Revenue momentum |
| Expense Efficiency | 20 pts | OpEx as % of gross profit |

Benchmarks across 10 industries: Landscaping, Restaurant, SaaS, Retail, Construction, Professional Services, E-commerce, Healthcare, Manufacturing, General. Score updates instantly when assumptions change — no API call, pure client-side math.

Claude Haiku generates a 2–3 sentence plain-English rationale explaining the score, debounced 800ms after any assumption change.

### 3. Metrics Dashboard
Six KPI cards — Revenue, Gross Margin, Owner SDE, Monthly Burn, YoY Growth, Expense Ratio — each with an industry benchmark badge (above / at / below average). P&L waterfall bar chart: Revenue → COGS → Gross Profit → OpEx → EBITDA → SDE.

### 4. Editable Assumptions
Four live sliders that update the score and all metrics with zero latency:
- **Owner Salary** — strips doc salary from OpEx, swaps in assumed value (SDE stays accurate regardless of how compensation is labelled)
- **YoY Growth Rate** — updates projected revenue and growth score
- **COGS Adjustment** — ±% of base COGS
- **OpEx Adjustment** — ±% of base OpEx

AI rationale regenerates automatically after each change.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI (Python) + Anthropic Claude API |
| Parsing | Claude Sonnet — structured extraction from any format |
| Insights | Claude Haiku — score rationale + what's working / not / fix first |
| File parsing | pdfplumber (PDF), stdlib csv |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| Charts | Recharts |
| Hosting | Railway (backend) · Vercel (frontend) |

Score calculation runs entirely in the browser (`src/lib/scoring.ts`). Claude is called only twice: once to parse input, once to generate rationale.

---

## Running locally

**Backend**
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # add your ANTHROPIC_API_KEY
uvicorn main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
# create .env.local with: VITE_API_URL=http://localhost:8000
npm run dev
```

---

## API endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/parse` | POST | Extract financials from pasted text |
| `/parse-file` | POST | Extract from PDF / CSV / text file upload |
| `/rationale` | POST | Generate score rationale + AI insights |

---

## Sample input

```
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
Notes: Lost one major HOA contract in Q4. New equipment lease starts Jan 2024.
```
