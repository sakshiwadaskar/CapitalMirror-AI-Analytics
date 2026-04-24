"""
Run once to generate .pdf versions of each .txt fixture:
  python tests/fixtures/generate_pdfs.py
"""
from pathlib import Path
from fpdf import FPDF

FIXTURES = Path(__file__).parent

for txt_path in FIXTURES.glob("*.txt"):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Courier", size=10)
    for line in txt_path.read_text().splitlines():
        # Replace non-latin-1 characters for Courier font compatibility
        safe = line.encode("latin-1", errors="replace").decode("latin-1")
        pdf.cell(0, 5, safe, new_x="LMARGIN", new_y="NEXT")
    out = txt_path.with_suffix(".pdf")
    pdf.output(str(out))
    print(f"Created {out.name}")
