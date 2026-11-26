"""PDF and Excel report generation engine for Orbit.

Generates beautiful, audit-grade downloadable reports:
- PDF (A4, clean teal brand styling, vector charts, page numbers, disclaimer)
- Excel (Multi-tab workbook with live formulas, frozen headers, styled columns)
"""
from __future__ import annotations

import io
from datetime import date, datetime, timezone
from typing import Any

import metrics
import engine

# ReportLab imports
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
)
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Group

# openpyxl imports
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


# Brand palette for reports
TEAL_DARK = colors.HexColor("#0E7C6B")
TEAL_LIGHT = colors.HexColor("#14B8A6")
TEAL_TINT = colors.HexColor("#DDF3EE")
TEXT_DARK = colors.HexColor("#10302C")
TEXT_MUTED = colors.HexColor("#5B7370")
CORAL_DANGER = colors.HexColor("#E04F5F")
GREEN_SUCCESS = colors.HexColor("#2E9E5B")
BG_CARD = colors.HexColor("#F8FCFB")


class NumberedCanvas(canvas.Canvas):
    """Canvas that prints 'Page X of Y' and disclaimer footer on every page."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_footer(num_pages)
            super().showPage()
        super().save()

    def draw_footer(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(TEXT_MUTED)

        # Thin rule above footer
        self.setStrokeColor(colors.HexColor("#D0E2DE"))
        self.setLineWidth(0.5)
        self.line(36, 32, A4[0] - 36, 32)

        # Footer text
        left_text = "Orbit — Know your body · Private on-device personal intelligence · Not medical advice"
        page_text = f"Page {self._pageNumber} of {page_count}"

        self.drawString(36, 20, left_text)
        self.drawRightString(A4[0] - 36, 20, page_text)
        self.restoreState()


def generate_pdf_report(
    records: list[dict[str, Any]],
    step_goal: int = 8000,
    sleep_goal: float = 7.0,
    ledger_rows: list[dict[str, Any]] | None = None,
) -> bytes:
    """Generate professional A4 PDF report using reportlab."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=46,
    )

    m = metrics.compute_metrics(records, step_goal=step_goal, sleep_goal=sleep_goal)
    ins_data = engine.compute_insights(records, step_goal=step_goal, sleep_goal=sleep_goal)

    styles = getSampleStyleSheet()

    # Custom typography styles
    style_title = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=TEAL_DARK,
    )
    style_subtitle = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        leading=14,
        textColor=TEXT_MUTED,
    )
    style_h2 = ParagraphStyle(
        "SectionH2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=TEAL_DARK,
        spaceBefore=12,
        spaceAfter=6,
    )
    style_body = ParagraphStyle(
        "DocBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=TEXT_DARK,
    )
    style_table_cell = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=TEXT_DARK,
    )
    style_table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=TEXT_DARK,
    )

    elements = []

    # 1. Header / Cover Banner
    anchor_str = m["anchor_date"] or date.today().isoformat()
    window_range = m["window_a"]["formatted_range"]
    score_val = m["orbit_score"]
    band_val = m["band"]

    header_data = [
        [
            Paragraph("<b>Orbit</b> <font color='#5B7370'>| Know your <b>body</b>.</font>", style_title),
            Paragraph(
                f"<para align='right'><font size=16 color='#0E7C6B'><b>Orbit Score: {score_val}/100</b></font><br/>"
                f"<font size=9 color='#5B7370'>{band_val}</font></para>",
                style_subtitle,
            ),
        ],
        [
            Paragraph(f"Health Intelligence Report · Window: <b>{window_range}</b> · Anchor: {anchor_str}", style_subtitle),
            Paragraph(f"<para align='right'><font size=8 color='#5B7370'>Generated on {date.today().strftime('%d %b %Y')}</font></para>", style_subtitle),
        ]
    ]
    header_table = Table(header_data, colWidths=[330, 192])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 10))

    # Divider bar
    divider = Table([[""]], colWidths=[522], rowHeights=[2])
    divider.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TEAL_DARK),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(divider)
    elements.append(Spacer(1, 12))

    # 2. Executive Summary Table
    elements.append(Paragraph("1. Executive Biomarker Summary (Window A vs Window B)", style_h2))

    m_steps = m["metrics"]["steps"]
    m_sleep = m["metrics"]["sleep"]
    m_heart = m["metrics"]["heart"]
    m_mood = m["metrics"]["mood"]
    m_water = m["metrics"]["water"]

    def _fmt_change(change: int | None, kind: str) -> str:
        if change is None:
            return "N/A"
        if kind == "bpm":
            return f"{change:+} bpm"
        return f"{change:+}%"

    summary_rows = [
        ["Biomarker", "This Week (Avg)", "Prior Week (Avg)", "Change", "Daily Goal", "% of Goal"],
        [
            "Daily Steps",
            f"{m_steps['avg']:,} steps" if m_steps['avg'] is not None else "Not enough data",
            f"{m_steps['prior_avg']:,} steps" if m_steps['prior_avg'] is not None else "Not enough data",
            _fmt_change(m_steps['change'], "percent"),
            f"{step_goal:,} steps",
            f"{m_steps['goal_pct']}%" if m_steps['goal_pct'] is not None else "N/A",
        ],
        [
            "Sleep Duration",
            f"{m_sleep['avg']} hrs" if m_sleep['avg'] is not None else "Not enough data",
            f"{m_sleep['prior_avg']} hrs" if m_sleep['prior_avg'] is not None else "Not enough data",
            _fmt_change(m_sleep['change'], "percent"),
            f"{sleep_goal} hrs",
            f"{m_sleep['goal_pct']}%" if m_sleep['goal_pct'] is not None else "N/A",
        ],
        [
            "Resting Heart Rate",
            f"{m_heart['avg']} bpm" if m_heart['avg'] is not None else "Not enough data",
            f"{m_heart['prior_avg']} bpm" if m_heart['prior_avg'] is not None else "Not enough data",
            _fmt_change(m_heart['change'], "bpm"),
            f"{m_heart['goal']} bpm",
            f"{m_heart['goal_pct']}%" if m_heart['goal_pct'] is not None else "N/A",
        ],
        [
            "Daily Mood Score",
            f"{m_mood['avg']}/5" if m_mood['avg'] is not None else "Not enough data",
            f"{m_mood['prior_avg']}/5" if m_mood['prior_avg'] is not None else "Not enough data",
            _fmt_change(m_mood['change'], "percent"),
            f"{m_mood['goal']}/5",
            f"{m_mood['goal_pct']}%" if m_mood['goal_pct'] is not None else "N/A",
        ],
        [
            "Water Hydration",
            f"{m_water['avg']} L" if m_water['avg'] is not None else "Not enough data",
            f"{m_water['prior_avg']} L" if m_water['prior_avg'] is not None else "Not enough data",
            _fmt_change(m_water['change'], "percent"),
            f"{m_water['goal']} L",
            f"{m_water['goal_pct']}%" if m_water['goal_pct'] is not None else "N/A",
        ],
    ]

    t_summary = Table(summary_rows, colWidths=[120, 85, 85, 75, 80, 77])
    t_summary.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TEAL_DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8.5),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8E7E4")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BG_CARD]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_summary)
    elements.append(Spacer(1, 10))

    # 3. Vector Charts (Last 14 days of steps and sleep)
    elements.append(Paragraph("2. 14-Day Vector Trends (ReportLab Native Vector)", style_h2))

    chart_drawing = _create_pdf_vector_charts(records, step_goal, sleep_goal)
    elements.append(chart_drawing)
    elements.append(Spacer(1, 10))

    # 4. Explainable Insights
    elements.append(Paragraph("3. Explainable Findings & Rules", style_h2))
    insight_rows = [["Priority", "Finding", "Key Evidence", "Deterministic Rule Used"]]
    for ins in ins_data["insights"][:5]:
        cat_label = ins.get("category", "info").replace("_", " ").title()
        evidence_str = ", ".join(f"{k}: {v}" for k, v in ins.get("evidence", {}).items())
        insight_rows.append([
            Paragraph(f"<b>{cat_label}</b>", style_table_cell_bold),
            Paragraph(f"<b>{ins['title']}</b><br/>{ins['body']}", style_table_cell),
            Paragraph(evidence_str, style_table_cell),
            Paragraph(ins.get("rule", ""), style_table_cell),
        ])

    t_insights = Table(insight_rows, colWidths=[80, 170, 130, 142])
    t_insights.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TEAL_TINT),
        ("TEXTCOLOR", (0, 0), (-1, 0), TEAL_DARK),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8E7E4")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    elements.append(t_insights)
    elements.append(Spacer(1, 12))

    # 5. Proof: Daily Data Rows used in Window A and Window B
    elements.append(Paragraph("4. Proof: Daily Data (Windows A & B Tagged)", style_h2))

    sorted_recs = sorted(records, key=lambda x: x.get("date", ""), reverse=True)
    window_a_start = m["window_a"]["start"] or ""
    window_a_end = m["window_a"]["end"] or ""
    window_b_start = m["window_b"]["start"] or ""
    window_b_end = m["window_b"]["end"] or ""

    proof_rows = [["Date", "Window Tag", "Steps", "Sleep (h)", "RHR (bpm)", "Mood", "Water (L)"]]
    for r in sorted_recs[:14]:
        d = r.get("date", "")
        if window_a_start <= d <= window_a_end:
            win_tag = "Window A (Current)"
        elif window_b_start <= d <= window_b_end:
            win_tag = "Window B (Prior)"
        else:
            win_tag = "Historical"

        proof_rows.append([
            d,
            win_tag,
            f"{r['steps']:,}" if r.get("steps") is not None else "--",
            f"{r['sleep_h']}" if r.get("sleep_h") is not None else "--",
            f"{r['rhr']}" if r.get("rhr") is not None else "--",
            f"{r['mood']}" if r.get("mood") is not None else "--",
            f"{r['water_l']}" if r.get("water_l") is not None else "--",
        ])

    t_proof = Table(proof_rows, colWidths=[70, 110, 70, 68, 68, 68, 70])
    t_proof.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2C3E50")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (2, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8E7E4")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(t_proof)
    elements.append(Spacer(1, 10))

    # 6. Method & Limits
    method_text = (
        "<b>Calculation Methodology:</b> All metrics use an anchor date = latest recorded date. "
        "Window A is the 7 calendar days ending at anchor; Window B is the 7 calendar days prior. "
        "Averages strictly skip missing days (never treated as 0). Windows with < 3 days are marked insufficient. "
        "Orbit Score weights: Steps (30%), Sleep (30% with -5% penalty per <6h night), Heart (15%), Mood (15%), "
        "Consistency (10%).<br/>"
        "<b>Data Limits:</b> Demo or user-provided CSV exports only. Not live wearable sync. Not medical advice."
    )
    elements.append(Paragraph(method_text, style_body))
    elements.append(Spacer(1, 10))

    # 7. Privacy Ledger
    elements.append(Paragraph("5. On-Device Privacy Ledger", style_h2))
    if ledger_rows:
        ledger_data = [["Timestamp (UTC)", "Event / Action", "Destination", "User Approved"]]
        for row in ledger_rows[:6]:
            ledger_data.append([
                row.get("ts", "")[:19].replace("T", " "),
                row.get("what", "ai_summary"),
                row.get("destination", "local"),
                "Yes (Explicit approval)" if row.get("approved") else "No",
            ])
        t_ledger = Table(ledger_data, colWidths=[120, 140, 120, 142])
        t_ledger.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), TEAL_DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8E7E4")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        elements.append(t_ledger)
    else:
        elements.append(Paragraph("<b>Privacy Verified:</b> Nothing has ever left your device. Local privacy confirmed.", style_body))

    doc.build(elements, canvasmaker=NumberedCanvas)
    return buf.getvalue()


def _create_pdf_vector_charts(records: list[dict], step_goal: int, sleep_goal: float) -> Drawing:
    """Create a vector drawing showing 14-day daily step bars and sleep markers."""
    d = Drawing(522, 100)

    # Background frame
    d.add(Rect(0, 0, 522, 100, fillColor=BG_CARD, strokeColor=colors.HexColor("#D0E2DE"), strokeWidth=0.5))

    # Title
    d.add(String(10, 86, "14-Day Steps vs Goal (Bars) & Sleep Duration (Line)", fontName="Helvetica-Bold", fontSize=8.5, fillColor=TEAL_DARK))

    sorted_recs = sorted(records, key=lambda x: x.get("date", ""))[-14:]
    if not sorted_recs:
        d.add(String(200, 45, "No historical data to chart", fontName="Helvetica", fontSize=9, fillColor=TEXT_MUTED))
        return d

    # Max values for scaling
    max_steps = max([r.get("steps") or 0 for r in sorted_recs] + [step_goal, 12000])
    bar_width = 16
    spacing = 34
    start_x = 24
    chart_bottom = 20
    chart_height = 55

    # Goal line for steps
    goal_y = chart_bottom + (step_goal / max_steps) * chart_height
    d.add(Line(20, goal_y, 500, goal_y, strokeColor=colors.HexColor("#E04F5F"), strokeWidth=0.8, strokeDashArray=[3, 3]))
    d.add(String(502, goal_y - 3, f"{step_goal//1000}k", fontName="Helvetica", fontSize=7, fillColor=CORAL_DANGER))

    sleep_points = []
    for idx, r in enumerate(sorted_recs):
        x = start_x + idx * spacing
        steps = r.get("steps") or 0
        bar_h = (steps / max_steps) * chart_height

        # Steps bar
        bar_color = TEAL_LIGHT if steps >= step_goal else colors.HexColor("#8EC5BE")
        d.add(Rect(x, chart_bottom, bar_width, bar_h, fillColor=bar_color, strokeColor=None))

        # Date label below
        short_date = r.get("date", "")[-5:]  # MM-DD
        d.add(String(x - 2, 8, short_date, fontName="Helvetica", fontSize=6.5, fillColor=TEXT_MUTED))

        # Sleep points for polyline
        sleep_h = r.get("sleep_h") or 0
        if sleep_h:
            sy = chart_bottom + min(chart_height, (sleep_h / 10.0) * chart_height)
            sleep_points.append((x + bar_width / 2, sy))

    # Connect sleep line
    for i in range(len(sleep_points) - 1):
        x1, y1 = sleep_points[i]
        x2, y2 = sleep_points[i + 1]
        d.add(Line(x1, y1, x2, y2, strokeColor=colors.HexColor("#5B6CFF"), strokeWidth=1.5))
        d.add(Rect(x1 - 2, y1 - 2, 4, 4, fillColor=colors.HexColor("#5B6CFF"), strokeColor=None))
    if sleep_points:
        lx, ly = sleep_points[-1]
        d.add(Rect(lx - 2, ly - 2, 4, 4, fillColor=colors.HexColor("#5B6CFF"), strokeColor=None))

    return d


# ---------------------------------------------------------------------------
# Excel Report Generator
# ---------------------------------------------------------------------------

def generate_xlsx_report(
    records: list[dict[str, Any]],
    step_goal: int = 8000,
    sleep_goal: float = 7.0,
    ledger_rows: list[dict[str, Any]] | None = None,
) -> bytes:
    """Generate multi-sheet Excel workbook with live formulas on the Summary sheet."""
    wb = openpyxl.Workbook()

    # Style constants
    font_title = Font(name="Calibri", size=16, bold=True, color="0E7C6B")
    font_header = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    font_bold = Font(name="Calibri", size=10, bold=True)
    font_regular = Font(name="Calibri", size=10)
    font_muted = Font(name="Calibri", size=9, color="5B7370", italic=True)

    fill_teal = PatternFill(start_color="0E7C6B", end_color="0E7C6B", fill_type="solid")
    fill_subtle = PatternFill(start_color="F2F8F6", end_color="F2F8F6", fill_type="solid")
    fill_tint = PatternFill(start_color="DDF3EE", end_color="DDF3EE", fill_type="solid")

    thin_border = Border(
        left=Side(style="thin", color="D0E2DE"),
        right=Side(style="thin", color="D0E2DE"),
        top=Side(style="thin", color="D0E2DE"),
        bottom=Side(style="thin", color="D0E2DE"),
    )

    align_center = Alignment(horizontal="center", vertical="center")
    align_left = Alignment(horizontal="left", vertical="center")
    align_right = Alignment(horizontal="right", vertical="center")

    m = metrics.compute_metrics(records, step_goal=step_goal, sleep_goal=sleep_goal)
    sorted_recs = sorted(records, key=lambda x: x.get("date", ""), reverse=True)

    # -----------------------------------------------------------------------
    # Sheet 1: Summary (with live Excel formulas referencing Daily Data)
    # -----------------------------------------------------------------------
    ws_summary = wb.active
    ws_summary.title = "Summary"
    ws_summary.views.sheetView[0].showGridLines = True

    ws_summary["A1"] = "Orbit — Personal Intelligence Report"
    ws_summary["A1"].font = font_title
    ws_summary["A2"] = f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} · Tagline: Know your body."
    ws_summary["A2"].font = font_muted

    # Score Card
    ws_summary["A4"] = "Orbit Score"
    ws_summary["A4"].font = font_bold
    ws_summary["B4"] = m["orbit_score"]
    ws_summary["B4"].font = Font(name="Calibri", size=14, bold=True, color="0E7C6B")

    ws_summary["A5"] = "Band"
    ws_summary["A5"].font = font_bold
    ws_summary["B5"] = m["band"]

    ws_summary["A6"] = "Goal Streak"
    ws_summary["A6"].font = font_bold
    ws_summary["B6"] = f"{m['streak']} days"

    ws_summary["A7"] = "Analysis Window"
    ws_summary["A7"].font = font_bold
    ws_summary["B7"] = m["window_a"]["label"]

    # Summary Table with Live Formulas
    headers_summary = ["Biomarker", "Window A (This Week)", "Window B (Prior Week)", "Change (%)", "Daily Goal", "% of Goal"]
    for col_idx, h in enumerate(headers_summary, start=1):
        cell = ws_summary.cell(row=9, column=col_idx, value=h)
        cell.font = font_header
        cell.fill = fill_teal
        cell.alignment = align_center

    # Metrics rows
    # Formula references to 'Daily data' sheet:
    # In 'Daily data', Row 2-8 are Window A (7 days), Row 9-15 are Window B (7 days)
    # Col C = Steps, Col D = Sleep, Col E = RHR, Col F = Mood, Col G = Water
    metrics_config = [
        ("Daily Steps", "C", step_goal, True),
        ("Sleep Duration (h)", "D", sleep_goal, False),
        ("Resting Heart Rate (bpm)", "E", 65, False),
        ("Mood Score (1-5)", "F", 4.0, False),
        ("Water Intake (L)", "G", 2.5, False),
    ]

    has_14_days = len(sorted_recs) >= 14

    for i, (name, col_letter, goal_val, is_int) in enumerate(metrics_config, start=10):
        ws_summary.cell(row=i, column=1, value=name).font = font_bold

        # Live Excel formula for Window A average
        cell_a = ws_summary.cell(row=i, column=2)
        cell_a.value = f"=AVERAGE('Daily data'!{col_letter}2:{col_letter}8)"
        cell_a.number_format = "#,##0" if is_int else "0.0"
        cell_a.alignment = align_right

        # Live Excel formula for Window B average (if data exists)
        cell_b = ws_summary.cell(row=i, column=3)
        if has_14_days:
            cell_b.value = f"=AVERAGE('Daily data'!{col_letter}9:{col_letter}15)"
        else:
            cell_b.value = m["metrics"][name.split()[0].lower()]["prior_avg"] or "N/A"
        cell_b.number_format = "#,##0" if is_int else "0.0"
        cell_b.alignment = align_right

        # Live Excel formula for change %
        cell_chg = ws_summary.cell(row=i, column=4)
        if has_14_days:
            cell_chg.value = f"=(B{i}-C{i})/C{i}"
            cell_chg.number_format = "+0.0%;-0.0%;0.0%"
        else:
            chg_val = m["metrics"][name.split()[0].lower()]["change"]
            cell_chg.value = f"{chg_val:+}%" if chg_val is not None else "N/A"
        cell_chg.alignment = align_right

        # Goal and % of goal formula
        ws_summary.cell(row=i, column=5, value=goal_val).number_format = "#,##0" if is_int else "0.0"
        cell_pct = ws_summary.cell(row=i, column=6)
        cell_pct.value = f"=B{i}/E{i}"
        cell_pct.number_format = "0.0%"
        cell_pct.alignment = align_right

        for c in range(1, 7):
            ws_summary.cell(row=i, column=c).border = thin_border

    ws_summary.freeze_panes = "A10"

    # -----------------------------------------------------------------------
    # Sheet 2: Daily data
    # -----------------------------------------------------------------------
    ws_daily = wb.create_sheet(title="Daily data")
    ws_daily.views.sheetView[0].showGridLines = True

    daily_headers = ["Date", "Window Tag", "Steps", "Sleep (h)", "Resting HR (bpm)", "Mood (1-5)", "Water (L)", "Sources"]
    for col_idx, h in enumerate(daily_headers, start=1):
        cell = ws_daily.cell(row=1, column=col_idx, value=h)
        cell.font = font_header
        cell.fill = fill_teal
        cell.alignment = align_center

    window_a_start = m["window_a"]["start"] or ""
    window_a_end = m["window_a"]["end"] or ""
    window_b_start = m["window_b"]["start"] or ""
    window_b_end = m["window_b"]["end"] or ""

    for row_idx, r in enumerate(sorted_recs, start=2):
        d_str = r.get("date", "")
        if window_a_start <= d_str <= window_a_end:
            win_tag = "Window A"
        elif window_b_start <= d_str <= window_b_end:
            win_tag = "Window B"
        else:
            win_tag = "Historical"

        ws_daily.cell(row=row_idx, column=1, value=d_str).alignment = align_center
        ws_daily.cell(row=row_idx, column=2, value=win_tag).alignment = align_center

        c_steps = ws_daily.cell(row=row_idx, column=3, value=r.get("steps"))
        c_steps.number_format = "#,##0"
        c_steps.alignment = align_right

        c_sleep = ws_daily.cell(row=row_idx, column=4, value=r.get("sleep_h"))
        c_sleep.number_format = "0.00"
        c_sleep.alignment = align_right

        c_rhr = ws_daily.cell(row=row_idx, column=5, value=r.get("rhr"))
        c_rhr.number_format = "0"
        c_rhr.alignment = align_right

        c_mood = ws_daily.cell(row=row_idx, column=6, value=r.get("mood"))
        c_mood.number_format = "0.0"
        c_mood.alignment = align_right

        c_water = ws_daily.cell(row=row_idx, column=7, value=r.get("water_l"))
        c_water.number_format = "0.00"
        c_water.alignment = align_right

        ws_daily.cell(row=row_idx, column=8, value=r.get("sources", "upload")).alignment = align_left

        for c in range(1, 9):
            ws_daily.cell(row=row_idx, column=c).border = thin_border

    ws_daily.freeze_panes = "A2"

    # -----------------------------------------------------------------------
    # Sheet 3: Insights
    # -----------------------------------------------------------------------
    ws_ins = wb.create_sheet(title="Insights")
    ws_ins.views.sheetView[0].showGridLines = True

    ins_headers = ["Category", "Metric", "Title", "Finding Description", "Evidence (Key Numbers)", "Rule Used"]
    for col_idx, h in enumerate(ins_headers, start=1):
        cell = ws_ins.cell(row=1, column=col_idx, value=h)
        cell.font = font_header
        cell.fill = fill_teal
        cell.alignment = align_center

    ins_data = engine.compute_insights(records, step_goal=step_goal, sleep_goal=sleep_goal)
    for row_idx, ins in enumerate(ins_data["insights"], start=2):
        ws_ins.cell(row=row_idx, column=1, value=ins.get("category", "")).alignment = align_left
        ws_ins.cell(row=row_idx, column=2, value=ins.get("metric", "")).alignment = align_left
        ws_ins.cell(row=row_idx, column=3, value=ins.get("title", "")).font = font_bold
        ws_ins.cell(row=row_idx, column=4, value=ins.get("body", "")).alignment = align_left
        ws_ins.cell(row=row_idx, column=5, value=str(ins.get("evidence", {}))).alignment = align_left
        ws_ins.cell(row=row_idx, column=6, value=ins.get("rule", "")).alignment = align_left

        for c in range(1, 7):
            ws_ins.cell(row=row_idx, column=c).border = thin_border

    ws_ins.freeze_panes = "A2"

    # -----------------------------------------------------------------------
    # Sheet 4: Privacy ledger
    # -----------------------------------------------------------------------
    ws_ledger = wb.create_sheet(title="Privacy ledger")
    ws_ledger.views.sheetView[0].showGridLines = True

    ledger_headers = ["ID", "Timestamp (UTC)", "Event / Action", "Destination", "User Approved"]
    for col_idx, h in enumerate(ledger_headers, start=1):
        cell = ws_ledger.cell(row=1, column=col_idx, value=h)
        cell.font = font_header
        cell.fill = fill_teal
        cell.alignment = align_center

    if ledger_rows:
        for row_idx, entry in enumerate(ledger_rows, start=2):
            ws_ledger.cell(row=row_idx, column=1, value=entry.get("id"))
            ws_ledger.cell(row=row_idx, column=2, value=entry.get("ts", "")[:19].replace("T", " "))
            ws_ledger.cell(row=row_idx, column=3, value=entry.get("what", "ai_summary"))
            ws_ledger.cell(row=row_idx, column=4, value=entry.get("destination", "local"))
            ws_ledger.cell(row=row_idx, column=5, value="Yes" if entry.get("approved") else "No")
            for c in range(1, 6):
                ws_ledger.cell(row=row_idx, column=c).border = thin_border
    else:
        ws_ledger.cell(row=2, column=1, value="—")
        ws_ledger.cell(row=2, column=2, value=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"))
        ws_ledger.cell(row=2, column=3, value="No external transfers")
        ws_ledger.cell(row=2, column=4, value="Local on-device SQLite")
        ws_ledger.cell(row=2, column=5, value="Nothing has ever left your device.")

    ws_ledger.freeze_panes = "A2"

    # -----------------------------------------------------------------------
    # Sheet 5: Method
    # -----------------------------------------------------------------------
    ws_method = wb.create_sheet(title="Method")
    ws_method.views.sheetView[0].showGridLines = True

    method_rows = [
        ("Concept", "Definition & Specification"),
        ("Anchor Date", "The latest date in the dataset with data (never assumed to be current system date)."),
        ("Window A", "7 calendar days ending at the anchor date (inclusive)."),
        ("Window B", "7 calendar days immediately preceding Window A (inclusive)."),
        ("Averages", "Sum of non-missing days divided by count of valid days. Missing days are never treated as 0."),
        ("Insufficient Data", "If either window has fewer than 3 valid days for a metric, it is marked insufficient."),
        ("Percentage Change", "(Window A Avg - Window B Avg) / Window B Avg * 100, rounded to nearest whole number."),
        ("Heart Rate Change", "Window A resting HR bpm - Window B resting HR bpm (measured in bpm difference)."),
        ("Goal Streak", "Consecutive days ending at anchor with steps >= goal. A missing day breaks the streak."),
        ("Orbit Score", "Weighted composite: Steps 30, Sleep 30 (-5% per night <6h), Heart 15, Mood 15, Consistency 10."),
        ("Bands", "80-100: In great orbit | 60-79: Steady orbit | 0-59: Drifting — gentle reset needed."),
        ("Data Limits", "Supports demo generation or CSV upload. No background wearable telemetry. Not medical advice."),
    ]
    for row_idx, (c, d) in enumerate(method_rows, start=1):
        cell_c = ws_method.cell(row=row_idx, column=1, value=c)
        cell_d = ws_method.cell(row=row_idx, column=2, value=d)
        if row_idx == 1:
            cell_c.font = font_header
            cell_d.font = font_header
            cell_c.fill = fill_teal
            cell_d.fill = fill_teal
        else:
            cell_c.font = font_bold
            cell_d.font = font_regular
        cell_c.border = thin_border
        cell_d.border = thin_border

    # Auto-adjust column widths across all sheets
    for ws in wb.worksheets:
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val_str = str(cell.value or "")
                if len(val_str) > max_len and not val_str.startswith("="):
                    max_len = len(val_str)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    out_buf = io.BytesIO()
    wb.save(out_buf)
    return out_buf.getvalue()
