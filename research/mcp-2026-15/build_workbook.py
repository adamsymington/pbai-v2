#!/usr/bin/env python3
"""Build the MCP 2026-15 market research workbook (the spreadsheet version of report_draft.md).

Inputs are the files pulled for this analysis; pass their paths on the command line.
Every summary number in the workbook is a formula over the data tabs.

    python3 build_workbook.py --uploads <dir with pulled files> --out MCP_2026-15_Helicopter_Market_Research.xlsx
"""

import argparse
import csv
import glob
import io
import os
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd
from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import analyze as A  # noqa: E402

FONT = "Arial"
BLUE = "0000FF"
GREEN = "008000"
HDR_FILL = PatternFill("solid", fgColor="1F3864")
SUB_FILL = PatternFill("solid", fgColor="D9E1F2")
INPUT_FILL = PatternFill("solid", fgColor="FFFF00")
THIN = Side(style="thin", color="BFBFBF")
BOX = Border(top=THIN, bottom=THIN, left=THIN, right=THIN)
MONEY_M = '$#,##0.0,,"M";($#,##0.0,,"M");"-"'
MONEY = '$#,##0;($#,##0);"-"'
PCT = '0%;(0%);"-"'
SERIES = ["2A78D6", "EB6834", "1BAF7A"]  # validated categorical slots 1-3
FYS = list(range(2016, 2027))


def font(**kw):
    kw.setdefault("name", FONT)
    kw.setdefault("size", 10)
    return Font(**kw)


def find(upload_dir, pattern):
    hits = glob.glob(os.path.join(upload_dir, pattern))
    if not hits:
        raise FileNotFoundError(f"{pattern} not found in {upload_dir}")
    return hits[0]


def header(ws, row, labels, col=1, widths=None):
    for i, lab in enumerate(labels):
        c = ws.cell(row=row, column=col + i, value=lab)
        c.font = font(bold=True, color="FFFFFF")
        c.fill = HDR_FILL
        c.alignment = Alignment(wrap_text=True, vertical="center")
        c.border = BOX
    if widths:
        for i, w in enumerate(widths):
            ws.column_dimensions[get_column_letter(col + i)].width = w


def title(ws, text, sub=None):
    ws["A1"] = text
    ws["A1"].font = font(bold=True, size=14, color="1F3864")
    if sub:
        ws["A2"] = sub
        ws["A2"].font = font(italic=True, color="595959")


def note(ws, cell, text, width_cols=None):
    ws[cell] = text
    ws[cell].font = font(italic=True, size=9, color="595959")
    ws[cell].alignment = Alignment(wrap_text=False)


def style_range(ws, rng, fmt=None, bold=False, color=None, wrap=False):
    for row in ws[rng]:
        for c in row:
            c.font = font(bold=bold, color=color)
            c.border = BOX
            if fmt:
                c.number_format = fmt
            c.alignment = Alignment(wrap_text=wrap, vertical="top")


def section(ws, row, text, ncols=6):
    c = ws.cell(row=row, column=1, value=text)
    c.font = font(bold=True, size=11, color="1F3864")
    for i in range(1, ncols + 1):
        ws.cell(row=row, column=i).fill = SUB_FILL


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_inputs(up):
    d = {}
    d["purchases"] = pd.read_csv(HERE / "civilian_aircraft_purchases.csv")
    d["davenport"] = pd.read_csv(find(up, "*davenport_gs07f139da.csv"), dtype=str)
    d["by_vehicle"] = pd.read_csv(find(up, "*by_vehicle.csv"))
    d["by_customer"] = pd.read_csv(find(up, "*by_customer.csv"))

    # SSQ+ export is UTF-16, tab-separated, two header rows (FY, quarter)
    raw = open(find(up, "*Data_Table_-_Report_Builder.csv"), "rb").read().decode("utf-16")
    rows = list(csv.reader(raw.splitlines(), delimiter="\t"))
    hdr = [(a.strip(), b.strip()) for a, b in zip(rows[0], rows[1])]
    ssq = []
    for r in rows[3:]:
        if len(r) < 5 or not r[1].strip() or r[0].startswith("Grand"):
            continue
        sin, ctype = r[1].strip(), r[2].strip()
        base_sin = sin.replace("STLOC", "").replace("RC", "").strip()
        for i in range(6, min(len(r), len(hdr))):
            fy, q = hdr[i]
            if not fy.startswith("FY"):
                continue
            v = r[i].replace("$", "").replace(",", "").strip()
            if not v:
                continue
            amt = float(v)
            if amt == 0:
                continue
            ssq.append({"fy": int(fy.split()[1]), "q": int(q[1]), "sin": base_sin, "ctype": ctype, "sales": amt})
    d["ssq"] = pd.DataFrame(ssq)

    # Adjacent spend: repair (J/K) and services (V) transactions, civilian/DoD by funding agency
    adj = A.load([find(up, "*adj_mro.csv"), find(up, "*adj_services.csv")]).drop_duplicates("txn_key")
    adj = A.segment(adj[(adj.fy >= 2016) & (adj.fy <= 2026)])
    cat = adj.psc.str.upper().str[0].map({"V": "Aviation services (V1xx)", "J": "Maintenance and repair (J01x)",
                                          "K": "Modification (K01x)"})
    a1 = adj.assign(category=cat).dropna(subset=["category"]).groupby(
        ["segment", "category", "fy"]).obligation.sum().reset_index()
    parts = pd.read_csv(find(up, "*adj_parts_summary.csv"))
    a2 = parts.rename(columns={"action_date_fiscal_year": "fy", "amt": "obligation"}).assign(
        category="Parts and components (1615-2995)").groupby(["segment", "category", "fy"]).obligation.sum().reset_index()
    d["adjacent"] = pd.concat([a1, a2], ignore_index=True)
    d["adjacent"]["fy"] = d["adjacent"]["fy"].astype(int)
    return d


# CBP aircraft actions on GS-07F-139DA, aircraft added per action (from modification descriptions)
CBP_AIRCRAFT = {
    ("70B02C18F00000452", "0"): 7,
    ("70B02C19F00000617", "0"): 9, ("70B02C19F00000617", "P00001"): 1,
    ("70B02C21F00000080", "0"): 3, ("70B02C21F00000080", "P00001"): 4, ("70B02C21F00000080", "P00004"): 2,
    ("70B02C23F00000959", "0"): 1, ("70B02C23F00000959", "P00002"): 3, ("70B02C23F00000959", "P00004"): 2,
    ("70B02C26F00000290", "0"): 10,
}
AIRCRAFT_BASIS = {
    ("70B02C18F00000452", "0"): "Press: $45.9M for seven LEH (Hyde-Smith, Jul 2018)",
    ("70B02C19F00000617", "0"): "Nine aircraft; option for a tenth (Hyde-Smith $59.1M release)",
    ("70B02C19F00000617", "P00001"): "Mod text: exercise option to order LEH 10",
    ("70B02C21F00000080", "0"): "Initial three of up to nine (Hyde-Smith $21.2M release)",
    ("70B02C21F00000080", "P00001"): "Mod text: order LEH number 4 through 7",
    ("70B02C21F00000080", "P00004"): "Mod text: order two LEH",
    ("70B02C23F00000959", "0"): "Inferred: one aircraft at base; price likely includes one-time costs",
    ("70B02C23F00000959", "P00002"): "Mod text: order 3 LEPs",
    ("70B02C23F00000959", "P00004"): "Mod text: order 2 LEH",
    ("70B02C26F00000290", "0"): "Order text: H125 quantity 10",
}


# ---------------------------------------------------------------------------
# Tabs
# ---------------------------------------------------------------------------

def tab_purchases(wb, d):
    ws = wb.create_sheet("Purchases")
    title(ws, "Civilian helicopter purchases, FY2016-FY2026",
          "Complete aircraft only. Sustainment, parts, overhaul, and the Coast Guard H-60 hull rebuild excluded. "
          "Hand-tagged from FPDS award descriptions.")
    cols = ["FY", "Customer", "Vehicle", "Vendor", "Model", "New/used", "Aircraft", "Obligations",
            "Per aircraft", "Offers", "Extent competed", "CBP?", "Count basis", "FPDS award"]
    header(ws, 4, cols, widths=[7, 20, 13, 22, 22, 10, 9, 14, 13, 8, 10, 7, 48, 50])
    p = d["purchases"]
    for i, r in enumerate(p.itertuples(index=False), start=5):
        vals = [int(r.fy), r.customer, r.vehicle, r.vendor, r.model, r.new_or_used,
                None if pd.isna(r.aircraft) else int(r.aircraft), float(r.obligations), None,
                None if pd.isna(r.offers) else int(r.offers), r.extent_competed, None, r.count_basis, r.award_key]
        for j, v in enumerate(vals, start=1):
            ws.cell(row=i, column=j, value=v)
        ws.cell(row=i, column=9, value=f'=IF(G{i}>0,H{i}/G{i},"")')
        ws.cell(row=i, column=12, value=f'=IF(B{i}="CBP","Yes","No")')
    last = 4 + len(p)
    style_range(ws, f"A5:N{last}")
    for c in ("H", "I"):
        style_range(ws, f"{c}5:{c}{last}", MONEY)
    tr = last + 1
    ws.cell(row=tr, column=1, value="Total")
    ws.cell(row=tr, column=7, value=f"=SUM(G5:G{last})")
    ws.cell(row=tr, column=8, value=f"=SUM(H5:H{last})")
    style_range(ws, f"A{tr}:N{tr}", bold=True)
    ws[f"H{tr}"].number_format = MONEY
    note(ws, f"A{tr + 2}", "Blank aircraft counts: FPDS description does not state a count (APHIS FY2016, DEA used 407s, "
                           "U.S. Park Police). Per-aircraft price shown only where the count is known.")
    note(ws, f"A{tr + 3}", "Source: USAspending prime award transactions, pulled Oct 19, 2026; civilian_aircraft_purchases.csv.")
    ws.freeze_panes = "C5"
    return {"first": 5, "last": last, "total": tr}


def tab_cbp(wb, d):
    ws = wb.create_sheet("CBP Orders")
    title(ws, "CBP Light Enforcement Helicopter orders on GS-07F-139DA (Davenport Aviation)",
          "Every action that ordered aircraft, plus configuration upgrades and simulators. Blue = hand-entered from mod text.")
    cols = ["Order", "Mod", "Action date", "FY", "Description", "Aircraft added", "Obligation",
            "Per aircraft", "Offers on order", "Fair opportunity code", "Aircraft count basis"]
    header(ws, 4, cols, widths=[20, 9, 12, 7, 60, 9, 14, 13, 9, 10, 52])
    dv = d["davenport"].copy()
    dv["obl"] = pd.to_numeric(dv.federal_action_obligation, errors="coerce").fillna(0)
    keep = dv[(dv.funding_sub_agency_name == "U.S. Customs and Border Protection") & (dv.obl != 0)]
    keep = keep.sort_values("action_date")
    r = 5
    for x in keep.itertuples(index=False):
        k = (x.award_id_piid, str(x.modification_number))
        dt = pd.to_datetime(x.action_date)
        fy = dt.year + (1 if dt.month >= 10 else 0)
        ac = CBP_AIRCRAFT.get(k, 0)
        vals = [x.award_id_piid, x.modification_number, dt.date(), fy, x.transaction_description, ac, x.obl,
                None, int(x.number_of_offers_received), x.fair_opportunity_limited_sources_code,
                AIRCRAFT_BASIS.get(k, "Not an aircraft action (configuration upgrade or simulator)")]
        for j, v in enumerate(vals, start=1):
            ws.cell(row=r, column=j, value=v)
        ws.cell(row=r, column=8, value=f'=IF(F{r}>0,G{r}/F{r},"")')
        r += 1
    last = r - 1
    style_range(ws, f"A5:K{last}")
    style_range(ws, f"G5:H{last}", MONEY)
    for i in range(5, last + 1):
        ws[f"C{i}"].number_format = "yyyy-mm-dd"
        ws[f"F{i}"].font = font(color=BLUE)
    ws.cell(row=last + 1, column=1, value="Total")
    ws.cell(row=last + 1, column=6, value=f"=SUM(F5:F{last})")
    ws.cell(row=last + 1, column=7, value=f"=SUM(G5:G{last})")
    style_range(ws, f"A{last + 1}:K{last + 1}", bold=True)
    ws[f"G{last + 1}"].number_format = MONEY

    # Order summary
    s0 = last + 4
    section(ws, s0 - 1, "Order summary", 8)
    header(ws, s0, ["Order", "First action", "Aircraft", "Aircraft obligations", "Other obligations",
                    "Per aircraft", "Offers"])
    orders = keep.groupby("award_id_piid").agg(first=("action_date", "min"),
                                               offers=("number_of_offers_received", "first")).reset_index()
    order_rows = {}
    for i, o in enumerate(orders.itertuples(index=False), start=s0 + 1):
        ws.cell(row=i, column=1, value=o.award_id_piid)
        ws.cell(row=i, column=2, value=pd.to_datetime(o.first).date()).number_format = "yyyy-mm-dd"
        ws.cell(row=i, column=3, value=f"=SUMIFS($F$5:$F${last},$A$5:$A${last},A{i})")
        ws.cell(row=i, column=4, value=f'=SUMIFS($G$5:$G${last},$A$5:$A${last},A{i},$F$5:$F${last},">0")')
        ws.cell(row=i, column=5, value=f'=SUMIFS($G$5:$G${last},$A$5:$A${last},A{i},$F$5:$F${last},0)')
        ws.cell(row=i, column=6, value=f'=IF(C{i}>0,D{i}/C{i},"")')
        ws.cell(row=i, column=7, value=int(o.offers))
        order_rows[o.award_id_piid] = i
    se = s0 + len(orders)
    style_range(ws, f"A{s0 + 1}:G{se}")
    style_range(ws, f"D{s0 + 1}:F{se}", MONEY)
    ws.cell(row=se + 1, column=1, value="Total")
    for c in "CDE":
        ws[f"{c}{se + 1}"] = f"=SUM({c}{s0 + 1}:{c}{se})"
    style_range(ws, f"A{se + 1}:G{se + 1}", bold=True)
    style_range(ws, f"D{se + 1}:E{se + 1}", MONEY, bold=True)

    # Configuration share
    c0 = se + 4
    section(ws, c0 - 1, "How much of the price is configuration?", 8)
    rows = [
        ("FWS H125, lightly equipped, MAS order 140D0422F0391 (May 2022)", 4770051),
        ("CBP H125, configured, P00004 to 70B02C21F00000080 (Sep 2022)", None),
    ]
    ws.cell(row=c0, column=1, value=rows[0][0])
    ws.cell(row=c0, column=7, value=rows[0][1]).font = font(color=BLUE)
    ws.cell(row=c0 + 1, column=1, value=rows[1][0])
    sep22 = [i for i in range(5, last + 1) if ws[f"A{i}"].value == "70B02C21F00000080" and ws[f"B{i}"].value == "P00004"][0]
    ws.cell(row=c0 + 1, column=7, value=f"=H{sep22}")
    ws.cell(row=c0 + 2, column=1, value="Configuration and related work as share of configured price")
    ws.cell(row=c0 + 2, column=7, value=f"=1-G{c0}/G{c0 + 1}")
    style_range(ws, f"A{c0}:G{c0 + 2}")
    ws[f"G{c0}"].number_format = MONEY
    ws[f"G{c0}"].font = font(color=BLUE)
    ws[f"G{c0 + 1}"].number_format = MONEY
    ws[f"G{c0 + 2}"].number_format = PCT
    ws[f"G{c0 + 2}"].font = font(bold=True)
    note(ws, f"A{c0 + 3}", "Third-party equipment on CBP orders: FLIR 380X upgrade (P00003, Apr 2025) and Troll switch "
                           "integration (P00006, Apr 2026). Both fall outside the RFI's Phase 1 scope.")

    # Price trend chart: aircraft actions only
    p0 = c0 + 6
    section(ws, p0 - 1, "Price per aircraft by ordering action (chart data)", 8)
    header(ws, p0, ["Action", "Per aircraft"])
    ac_rows = [i for i in range(5, last + 1) if CBP_AIRCRAFT.get((ws[f"A{i}"].value, str(ws[f"B{i}"].value)), 0) > 0]
    for n, i in enumerate(ac_rows, start=p0 + 1):
        dt = ws[f"C{i}"].value
        ws.cell(row=n, column=1, value=dt.strftime("%b %Y"))
        ws.cell(row=n, column=2, value=f"=H{i}").number_format = MONEY_M
    pe = p0 + len(ac_rows)
    style_range(ws, f"A{p0 + 1}:B{pe}")
    style_range(ws, f"B{p0 + 1}:B{pe}", MONEY_M)
    ch = LineChart()
    ch.title = "CBP price per configured H125, by ordering action"
    ch.y_axis.title = "Per aircraft"
    ch.y_axis.number_format = '$0.0,,"M"'
    ch.add_data(Reference(ws, min_col=2, min_row=p0, max_row=pe), titles_from_data=True)
    ch.set_categories(Reference(ws, min_col=1, min_row=p0 + 1, max_row=pe))
    s = ch.series[0]
    s.graphicalProperties.line.solidFill = SERIES[0]
    s.graphicalProperties.line.width = 25400
    s.marker.symbol = "circle"
    s.marker.size = 7
    s.marker.graphicalProperties.solidFill = SERIES[0]
    s.dLbls = DataLabelList()
    s.dLbls.showVal = True
    s.dLbls.numFmt = '$0.0,,"M"'
    ch.legend = None
    ch.height, ch.width = 8, 18
    ch.y_axis.majorGridlines = None
    ch.x_axis.delete = False
    ch.y_axis.delete = False
    ws.add_chart(ch, f"D{p0}")
    ws.freeze_panes = "A5"
    return {"first": 5, "last": last, "orders": (s0 + 1, se), "order_rows": order_rows, "config": c0 + 2, "price_first": ac_rows[0],
            "price_last": ac_rows[-1]}


def tab_sales(wb, d):
    ws = wb.create_sheet("Contract Sales")
    title(ws, "Reported schedule sales on GS-07F-139DA (SSQ+), FY2017 Q2 to FY2026 Q2",
          "Sales are reported at invoicing, usually aircraft delivery, so they lag FPDS orders. Nonzero quarters only.")
    header(ws, 4, ["FY", "Quarter", "Period", "SIN", "Customer type", "Sales"], widths=[7, 8, 9, 11, 18, 14])
    s = d["ssq"].sort_values(["fy", "q", "sin", "ctype"])
    for i, r in enumerate(s.itertuples(index=False), start=5):
        ws.cell(row=i, column=1, value=r.fy)
        ws.cell(row=i, column=2, value=r.q)
        ws.cell(row=i, column=3, value=f"=A{i}+B{i}/10")
        ws.cell(row=i, column=4, value=r.sin)
        ws.cell(row=i, column=5, value=r.ctype)
        ws.cell(row=i, column=6, value=r.sales)
    last = 4 + len(s)
    style_range(ws, f"A5:F{last}")
    style_range(ws, f"F5:F{last}", MONEY)
    rng = lambda c: f"${c}$5:${c}${last}"  # noqa: E731

    # FY x customer type
    col0 = 8
    ws.cell(row=4, column=col0, value="By fiscal year")
    ws.cell(row=4, column=col0).font = font(bold=True, color="1F3864")
    types = ["Standard", "State or Local Gov", "Recovery"]
    header(ws, 5, ["FY", "Federal", "State or local", "Disaster recovery", "Total", "State/local share"], col=col0,
           widths=[7, 13, 13, 13, 13, 11])
    years = list(range(2017, 2027))
    for n, y in enumerate(years, start=6):
        ws.cell(row=n, column=col0, value=y)
        for k, t in enumerate(types):
            ws.cell(row=n, column=col0 + 1 + k,
                    value=f'=SUMIFS({rng("F")},{rng("A")},{get_column_letter(col0)}{n},{rng("E")},"{t}")')
        L = get_column_letter
        ws.cell(row=n, column=col0 + 4, value=f"=SUM({L(col0 + 1)}{n}:{L(col0 + 3)}{n})")
        ws.cell(row=n, column=col0 + 5, value=f'=IF({L(col0 + 4)}{n}>0,{L(col0 + 2)}{n}/{L(col0 + 4)}{n},"")')
    fe = 5 + len(years)
    tr = fe + 1
    L = get_column_letter
    ws.cell(row=tr, column=col0, value="Total")
    for k in range(1, 5):
        ws.cell(row=tr, column=col0 + k, value=f"=SUM({L(col0 + k)}6:{L(col0 + k)}{fe})")
    ws.cell(row=tr, column=col0 + 5, value=f"={L(col0 + 2)}{tr}/{L(col0 + 4)}{tr}")
    style_range(ws, f"{L(col0)}6:{L(col0 + 5)}{tr}")
    style_range(ws, f"{L(col0 + 1)}6:{L(col0 + 4)}{tr}", MONEY_M)
    style_range(ws, f"{L(col0 + 5)}6:{L(col0 + 5)}{tr}", PCT)
    for c in range(col0, col0 + 6):
        ws.cell(row=tr, column=c).font = font(bold=True)

    # By SIN
    r0 = tr + 3
    ws.cell(row=r0 - 1, column=col0, value="By SIN (helicopter sales were reported under three SINs)").font = font(bold=True, color="1F3864")
    header(ws, r0, ["SIN", "Federal", "State or local", "Disaster recovery", "Total", "SIN title"], col=col0)
    ws.column_dimensions[L(col0 + 5)].width = 60
    sins = [("567 99", "Legacy Schedule 84 new products SIN"),
            ("332216", "Law Enforcement, Firefighting and Rescue Tools, Equipment and Accessories (Cooperative Purchasing)"),
            ("336413", "Aircraft Armoring and Helicopter Equipment (complete aircraft excluded by Refresh 26, Apr 2025)"),
            ("OLM", "Order-level materials"), ("334516", "Other (COVID test kits)")]
    for n, (sn, t) in enumerate(sins, start=r0 + 1):
        ws.cell(row=n, column=col0, value=sn)
        for k, ty in enumerate(types):
            ws.cell(row=n, column=col0 + 1 + k,
                    value=f'=SUMIFS({rng("F")},{rng("D")},{L(col0)}{n},{rng("E")},"{ty}")')
        ws.cell(row=n, column=col0 + 4, value=f"=SUM({L(col0 + 1)}{n}:{L(col0 + 3)}{n})")
        ws.cell(row=n, column=col0 + 5, value=t)
    se = r0 + len(sins)
    style_range(ws, f"{L(col0)}{r0 + 1}:{L(col0 + 5)}{se}")
    style_range(ws, f"{L(col0 + 1)}{r0 + 1}:{L(col0 + 4)}{se}", MONEY_M)

    # Key derived figures
    k0 = se + 3
    ws.cell(row=k0 - 1, column=col0, value="Derived figures").font = font(bold=True, color="1F3864")
    items = [
        ("Sales on SIN 336413 after the Refresh 26 exclusion (FY2025 Q3 on)",
         f'=SUMIFS({rng("F")},{rng("D")},"336413",{rng("C")},">=2025.3")', MONEY_M),
        ("State/local sales reported FY2025-FY2026 (possibly CBP deliveries)",
         f'=SUMIFS({rng("F")},{rng("E")},"State or Local Gov",{rng("A")},">=2025")', MONEY_M),
        ("State/local sales, as reported", f"={L(col0 + 2)}{tr}", MONEY_M),
        ("State/local sales, low reading (FY2025-26 reassigned to federal)", f"={L(col0 + 2)}{tr}-{L(col0 + 1)}{k0 + 1}", MONEY_M),
        ("State/local share of total sales, as reported", f"={L(col0 + 2)}{tr}/{L(col0 + 4)}{tr}", PCT),
        ("State/local share of total sales, low reading", f"={L(col0 + 1)}{k0 + 3}/{L(col0 + 4)}{tr}", PCT),
        ("Years of reported sales (FY2020 Q1 to FY2026 Q2)", 6.5, "0.0"),
        ("Average annual sales", f"={L(col0 + 4)}{tr}/{L(col0 + 1)}{k0 + 6}", MONEY_M),
        ("State/local sales per year (low reading)", f"={L(col0 + 1)}{k0 + 3}/{L(col0 + 1)}{k0 + 6}", MONEY_M),
        ("State/local sales per year (as reported)", f"={L(col0 + 2)}{tr}/{L(col0 + 1)}{k0 + 6}", MONEY_M),
    ]
    for n, (lab, f, fmt) in enumerate(items, start=k0):
        ws.cell(row=n, column=col0, value=lab)
        c = ws.cell(row=n, column=col0 + 1, value=f)
        c.number_format = fmt
        if not isinstance(f, str):
            c.font = font(color=BLUE)
    style_range(ws, f"{L(col0)}{k0}:{L(col0 + 1)}{k0 + len(items) - 1}")
    for n, (_, f, fmt) in enumerate(items, start=k0):
        ws.cell(row=n, column=col0 + 1).number_format = fmt
    ws.cell(row=k0 + 6, column=col0 + 1).font = font(color=BLUE)
    note(ws, f"{L(col0)}{k0 + len(items)}",
         "Federal sales fall to $0.9M over FY2025-FY2026 while CBP had $42M in aircraft due for delivery; "
         "the low reading treats that window's state/local sales as CBP. Contractor confirmation not available.")
    ws.column_dimensions[L(col0)].width = 58
    ws.freeze_panes = "A5"

    # Chart: federal vs state/local by FY
    ch = BarChart()
    ch.type = "col"
    ch.grouping = "stacked"
    ch.overlap = 100
    ch.title = "Reported sales on GS-07F-139DA by customer type"
    ch.y_axis.number_format = '$0,,"M"'
    data = Reference(ws, min_col=col0 + 1, max_col=col0 + 3, min_row=5, max_row=fe)
    ch.add_data(data, titles_from_data=True)
    ch.set_categories(Reference(ws, min_col=col0, min_row=6, max_row=fe))
    for sr, colr in zip(ch.series, SERIES):
        sr.graphicalProperties.solidFill = colr
        sr.graphicalProperties.line.solidFill = "FFFFFF"
    ch.gapWidth = 60
    ch.height, ch.width = 8, 18
    ch.y_axis.majorGridlines = None
    ch.x_axis.delete = False
    ch.y_axis.delete = False
    ch.legend.position = "b"
    ws.add_chart(ch, f"{L(col0 + 7)}4")
    return {"fy_first": 6, "fy_last": fe, "total": tr, "col0": col0, "derived": k0,
            "post_excl": k0, "sl_low": k0 + 3, "sl_share_rep": k0 + 4, "sl_share_low": k0 + 5,
            "years": k0 + 6, "avg_sales": k0 + 7, "sl_py_low": k0 + 8, "sl_py_rep": k0 + 9}


def tab_adjacent(wb, d, P):
    ws = wb.create_sheet("Adjacent Spend")
    title(ws, "Rotary-wing spend outside aircraft purchases, FY2016-FY2026",
          "Floor values: each pull required a helicopter keyword. Fire aviation is barely captured.")
    header(ws, 4, ["Segment", "Category", "FY", "Obligations"], widths=[10, 34, 7, 14])
    a = d["adjacent"].sort_values(["segment", "category", "fy"])
    for i, r in enumerate(a.itertuples(index=False), start=5):
        ws.cell(row=i, column=1, value=r.segment)
        ws.cell(row=i, column=2, value=r.category)
        ws.cell(row=i, column=3, value=int(r.fy))
        ws.cell(row=i, column=4, value=float(r.obligation))
    last = 4 + len(a)
    style_range(ws, f"A5:D{last}")
    style_range(ws, f"D5:D{last}", MONEY)
    rng = lambda c: f"${c}$5:${c}${last}"  # noqa: E731
    col0 = 6
    L = get_column_letter
    cats = ["Parts and components (1615-2995)", "Maintenance and repair (J01x)", "Aviation services (V1xx)",
            "Modification (K01x)"]
    header(ws, 4, ["Category", "Civilian", "DoD"], col=col0, widths=[34, 14, 14])
    for n, c in enumerate(cats, start=5):
        ws.cell(row=n, column=col0, value=c)
        for k, seg in enumerate(["Civilian", "DoD"]):
            ws.cell(row=n, column=col0 + 1 + k,
                    value=f'=SUMIFS({rng("D")},{rng("A")},"{seg}",{rng("B")},{L(col0)}{n})')
    te = 4 + len(cats)
    ws.cell(row=te + 1, column=col0, value="Adjacent total")
    ws.cell(row=te + 2, column=col0, value="Civilian aircraft purchases (Purchases tab)")
    ws.cell(row=te + 3, column=col0, value="Purchases as share of civilian rotary-wing contract spend")
    for k in range(2):
        ws.cell(row=te + 1, column=col0 + 1 + k, value=f"=SUM({L(col0 + 1 + k)}5:{L(col0 + 1 + k)}{te})")
    ws.cell(row=te + 2, column=col0 + 1, value=f"=Purchases!H{P['total']}")
    ws.cell(row=te + 3, column=col0 + 1, value=f"={L(col0 + 1)}{te + 2}/({L(col0 + 1)}{te + 1}+{L(col0 + 1)}{te + 2})")
    style_range(ws, f"{L(col0)}5:{L(col0 + 2)}{te + 3}")
    style_range(ws, f"{L(col0 + 1)}5:{L(col0 + 2)}{te + 2}", MONEY_M)
    ws.cell(row=te + 2, column=col0 + 1).font = font(color=GREEN)
    ws.cell(row=te + 3, column=col0 + 1).number_format = PCT
    for c in range(col0, col0 + 3):
        ws.cell(row=te + 1, column=c).font = font(bold=True)
    note(ws, f"{L(col0)}{te + 5}", "Coast Guard bought 97% of civilian helicopter parts (MH-60T and MH-65 fleets).")
    note(ws, f"{L(col0)}{te + 6}", "Segment = funding agency. Parts split uses agency name containing 'Defense'.")
    ws.freeze_panes = "A5"
    return {"last": last, "civ_total": f"{L(col0 + 1)}{te + 1}", "share": f"{L(col0 + 1)}{te + 3}",
            "parts_civ": f"{L(col0 + 1)}5"}


def tab_trends(wb, d, P, S, ADJ):
    ws = wb.create_sheet("Annual Trends", 1)
    title(ws, "Annual trends, FY2016-FY2026",
          "Purchases by award year (Purchases tab). MAS obligations by obligation year (FPDS). "
          "Contract sales by report year (SSQ+). FY2026 is incomplete in FPDS and SSQ+.")
    cols = ["FY", "Civilian purchases", "CBP", "Other agencies", "CBP share", "Aircraft (known counts)",
            "MAS obligations, civilian (FPDS)", "Contract sales, federal (SSQ+)", "Contract sales, state/local",
            "Contract sales, total", "IFF on contract sales", "Adjacent civilian spend"]
    header(ws, 4, cols, widths=[7, 13, 13, 13, 9, 10, 15, 15, 15, 14, 12, 14])
    pr = f"Purchases!$A${P['first']}:$A${P['last']}"
    ph = f"Purchases!$H${P['first']}:$H${P['last']}"
    pb = f"Purchases!$B${P['first']}:$B${P['last']}"
    pg = f"Purchases!$G${P['first']}:$G${P['last']}"
    mas = d["by_vehicle"].set_index("sv").loc["Civilian / GSA MAS order / BPA"]
    sl = "'Contract Sales'"
    c0 = get_column_letter(S["col0"])
    for n, y in enumerate(FYS, start=5):
        ws.cell(row=n, column=1, value=y)
        ws.cell(row=n, column=2, value=f"=SUMIFS({ph},{pr},A{n})")
        ws.cell(row=n, column=3, value=f'=SUMIFS({ph},{pr},A{n},{pb},"CBP")')
        ws.cell(row=n, column=4, value=f"=B{n}-C{n}")
        ws.cell(row=n, column=5, value=f'=IF(B{n}>0,C{n}/B{n},"")')
        ws.cell(row=n, column=6, value=f"=SUMIFS({pg},{pr},A{n})")
        ws.cell(row=n, column=7, value=float(mas[str(y)])).font = font(color=BLUE)
        fyr = f"{sl}!${c0}${S['fy_first']}:${c0}${S['fy_last']}"
        for k, col in enumerate(["I", "J"]):
            colL = get_column_letter(S["col0"] + 1 + k)
            ws.cell(row=n, column=8 + k,
                    value=f"=SUMIFS({sl}!${colL}${S['fy_first']}:${colL}${S['fy_last']},{fyr},A{n})")
        totL = get_column_letter(S["col0"] + 4)
        ws.cell(row=n, column=10, value=f"=SUMIFS({sl}!${totL}${S['fy_first']}:${totL}${S['fy_last']},{fyr},A{n})")
        ws.cell(row=n, column=11, value=f"=J{n}*Projection!$C$9")
        ws.cell(row=n, column=12,
                value=f"=SUMIFS('Adjacent Spend'!$D$5:$D${ADJ['last']},'Adjacent Spend'!$A$5:$A${ADJ['last']},\"Civilian\","
                      f"'Adjacent Spend'!$C$5:$C${ADJ['last']},A{n})")
    last = 4 + len(FYS)
    tr = last + 1
    ws.cell(row=tr, column=1, value="Total")
    for c in "BCDFGHIJKL":
        ws[f"{c}{tr}"] = f"=SUM({c}5:{c}{last})"
    ws[f"E{tr}"] = f"=C{tr}/B{tr}"
    stats = [("Mean", "AVERAGE"), ("Median", "MEDIAN")]
    for k, (lab, fn) in enumerate(stats, start=tr + 1):
        ws.cell(row=k, column=1, value=lab)
        for c in "BG":
            ws[f"{c}{k}"] = f"={fn}({c}5:{c}{last})"
    style_range(ws, f"A5:L{tr + 2}")
    for c in "BCDGHIJKL":
        style_range(ws, f"{c}5:{c}{tr + 2}", MONEY_M)
    style_range(ws, f"E5:E{tr}", PCT)
    for i in range(5, last + 1):
        ws[f"G{i}"].font = font(color=BLUE)
    for c in range(1, 13):
        ws.cell(row=tr, column=c).font = font(bold=True)
    note(ws, f"A{tr + 4}", "Column G is hard-coded from analyze.py output (by_vehicle.csv, civilian GSA MAS row); it includes "
                           "CBP simulators. Contract sales start in FY2020; FY2017-FY2019 had none reported.")
    note(ws, f"A{tr + 5}", "Purchases and contract sales measure different events (order vs delivery) and do not reconcile by year.")

    # Chart 1: purchases CBP vs other
    ch = BarChart()
    ch.type = "col"
    ch.grouping = "stacked"
    ch.overlap = 100
    ch.title = "Civilian helicopter purchases by award year"
    ch.y_axis.number_format = '$0,,"M"'
    ch.add_data(Reference(ws, min_col=3, max_col=4, min_row=4, max_row=last), titles_from_data=True)
    ch.set_categories(Reference(ws, min_col=1, min_row=5, max_row=last))
    for sr, colr in zip(ch.series, SERIES):
        sr.graphicalProperties.solidFill = colr
        sr.graphicalProperties.line.solidFill = "FFFFFF"
    ch.gapWidth = 60
    ch.height, ch.width = 8, 16
    ch.y_axis.majorGridlines = None
    ch.x_axis.delete = False
    ch.y_axis.delete = False
    ch.legend.position = "b"
    ws.add_chart(ch, f"A{tr + 8}")

    ch2 = BarChart()
    ch2.type = "col"
    ch2.grouping = "stacked"
    ch2.overlap = 100
    ch2.title = "Reported contract sales: federal vs state/local"
    ch2.y_axis.number_format = '$0,,"M"'
    ch2.add_data(Reference(ws, min_col=8, max_col=9, min_row=4, max_row=last), titles_from_data=True)
    ch2.set_categories(Reference(ws, min_col=1, min_row=5, max_row=last))
    for sr, colr in zip(ch2.series, SERIES):
        sr.graphicalProperties.solidFill = colr
        sr.graphicalProperties.line.solidFill = "FFFFFF"
    ch2.gapWidth = 60
    ch2.height, ch2.width = 8, 16
    ch2.y_axis.majorGridlines = None
    ch2.x_axis.delete = False
    ch2.y_axis.delete = False
    ch2.legend.position = "b"
    ws.add_chart(ch2, f"H{tr + 8}")
    ws.freeze_panes = "B5"
    return {"total": tr, "mean": tr + 1, "median": tr + 2}


def tab_buyers(wb, d, P):
    ws = wb.create_sheet("Buyers & Competition")
    title(ws, "Who buys, through what, and how much competition",
          "All figures are formulas over the Purchases tab unless noted.")
    pr = lambda c: f"Purchases!${c}${P['first']}:${c}${P['last']}"  # noqa: E731
    L = get_column_letter

    section(ws, 4, "By buyer", 7)
    header(ws, 5, ["Customer", "Purchases", "Share", "Aircraft (known)", "Awards", "Avg offers (where reported)",
                   "Main vendor"], widths=[26, 14, 9, 11, 9, 13, 24])
    p = d["purchases"]
    cust = p.groupby("customer").obligations.sum().sort_values(ascending=False)
    main_vendor = p.groupby("customer").apply(lambda g: g.groupby("vendor").obligations.sum().idxmax(),
                                              include_groups=False)
    for n, c in enumerate(cust.index, start=6):
        ws.cell(row=n, column=1, value=c)
        ws.cell(row=n, column=2, value=f"=SUMIFS({pr('H')},{pr('B')},A{n})")
        ws.cell(row=n, column=3, value=f"=B{n}/Purchases!$H${P['total']}")
        ws.cell(row=n, column=4, value=f"=SUMIFS({pr('G')},{pr('B')},A{n})")
        ws.cell(row=n, column=5, value=f"=COUNTIFS({pr('B')},A{n})")
        ws.cell(row=n, column=6, value=f'=IFERROR(AVERAGEIFS({pr("J")},{pr("B")},A{n}),"n/r")')
        ws.cell(row=n, column=7, value=main_vendor[c])
    be = 5 + len(cust)
    style_range(ws, f"A6:G{be}")
    style_range(ws, f"B6:B{be}", MONEY_M)
    style_range(ws, f"C6:C{be}", PCT)
    style_range(ws, f"F6:F{be}", "0.0")

    v0 = be + 3
    section(ws, v0 - 1, "By vehicle", 7)
    header(ws, v0, ["Vehicle", "Purchases", "Share", "Awards", "Avg offers", "Single-offer awards",
                    "Awards reporting offers"])
    for n, v in enumerate(["GSA MAS", "Agency IDV", "Open market"], start=v0 + 1):
        ws.cell(row=n, column=1, value=v)
        ws.cell(row=n, column=2, value=f"=SUMIFS({pr('H')},{pr('C')},A{n})")
        ws.cell(row=n, column=3, value=f"=B{n}/Purchases!$H${P['total']}")
        ws.cell(row=n, column=4, value=f"=COUNTIFS({pr('C')},A{n})")
        ws.cell(row=n, column=5, value=f'=IFERROR(AVERAGEIFS({pr("J")},{pr("C")},A{n}),"n/r")')
        ws.cell(row=n, column=6, value=f"=COUNTIFS({pr('C')},A{n},{pr('J')},1)")
        ws.cell(row=n, column=7, value=f'=COUNTIFS({pr("C")},A{n},{pr("J")},">0")')
    ve = v0 + 3
    style_range(ws, f"A{v0 + 1}:G{ve}")
    style_range(ws, f"B{v0 + 1}:B{ve}", MONEY_M)
    style_range(ws, f"C{v0 + 1}:C{ve}", PCT)
    style_range(ws, f"E{v0 + 1}:E{ve}", "0.0")
    note(ws, f"A{ve + 1}", "Agency IDV orders (FBI, DEA with Bell) do not report offers at the order level. "
                           "FBI's five Bell 429s are two ledger rows (FY2018, FY2021).")

    s0 = ve + 4
    section(ws, s0 - 1, "By seller", 7)
    header(ws, s0, ["Vendor", "Purchases", "Share", "Non-CBP purchases", "Share of non-CBP", "Seller type"])
    vend = p.groupby("vendor").obligations.sum().sort_values(ascending=False)
    stype = {"Davenport Aviation": "Authorized dealer on MAS (Airbus)", "Bell Textron": "OEM direct",
             "Leonardo Helicopters": "OEM direct"}
    for n, v in enumerate(vend.index, start=s0 + 1):
        ws.cell(row=n, column=1, value=v)
        ws.cell(row=n, column=2, value=f"=SUMIFS({pr('H')},{pr('D')},A{n})")
        ws.cell(row=n, column=3, value=f"=B{n}/Purchases!$H${P['total']}")
        ws.cell(row=n, column=4, value=f'=SUMIFS({pr("H")},{pr("D")},A{n},{pr("B")},"<>CBP")')
        ws.cell(row=n, column=5, value=f'=D{n}/SUMIFS({pr("H")},{pr("B")},"<>CBP")')
        ws.cell(row=n, column=6, value=stype.get(v, "Dealer or used-aircraft seller"))
    se = s0 + len(vend)
    style_range(ws, f"A{s0 + 1}:F{se}")
    style_range(ws, f"B{s0 + 1}:B{se}", MONEY_M)
    style_range(ws, f"D{s0 + 1}:D{se}", MONEY_M)
    style_range(ws, f"C{s0 + 1}:C{se}", PCT)
    style_range(ws, f"E{s0 + 1}:E{se}", PCT)

    c0 = se + 4
    section(ws, c0 - 1, "Context: all civilian PSC 1520 / helicopter-described obligations, FY2016-FY2026 (includes sustainment)", 7)
    header(ws, c0, ["Buyer (funding sub-agency)", "Obligations"])
    bc = d["by_customer"]
    bc = bc[bc.cust.str.startswith("Civilian")].copy()
    bc["name"] = bc.cust.str.split(" / ").str[-1]
    bc = bc[bc.Total > 1e6].sort_values("Total", ascending=False)
    for n, r in enumerate(bc.itertuples(index=False), start=c0 + 1):
        ws.cell(row=n, column=1, value=r.name)
        ws.cell(row=n, column=2, value=float(r.Total)).font = font(color=BLUE)
    ce = c0 + len(bc)
    style_range(ws, f"A{c0 + 1}:B{ce}")
    style_range(ws, f"B{c0 + 1}:B{ce}", MONEY_M)
    for n in range(c0 + 1, ce + 1):
        ws[f"B{n}"].font = font(color=BLUE)
    note(ws, f"A{ce + 1}", "Hard-coded from analyze.py output (by_customer.csv). Coast Guard's $638M is almost all MH-60T/MH-65 "
                           "sustainment and a $315M H-60 hull rebuild, not purchases a SIN could carry.")
    return {"vehicle": (v0 + 1, ve), "seller": (s0 + 1, se)}


def tab_projection(wb, S, P):
    ws = wb.create_sheet("Projection")
    title(ws, "Five-year volume and IFF projection",
          "Yellow cells are assumptions; change them and the table recalculates. Built on actual contract sales.")
    sl = "'Contract Sales'"
    c0 = get_column_letter(S["col0"])
    c1 = get_column_letter(S["col0"] + 1)
    c2 = get_column_letter(S["col0"] + 2)
    header(ws, 3, ["Assumption", "", "Value", "Basis"], widths=[50, 2, 14, 70])
    tot = S["total"]
    rows = [
        ("Federal sales per year, as reported", f"={sl}!{c1}{tot}/{sl}!{c1}{S['years']}", MONEY_M,
         "SSQ+ federal sales / 6.5 years"),
        ("Federal sales per year, with FY2025-26 state/local reassigned", f"=({sl}!{c1}{tot}+{sl}!{c1}{S['derived'] + 1})/{sl}!{c1}{S['years']}",
         MONEY_M, "Low reading of state/local"),
        ("Base federal volume (year 1)", "=AVERAGE(C4:C5)", MONEY_M, "Midpoint of the two readings"),
        ("Base state/local volume (year 1)", f"=AVERAGE({sl}!{c1}{S['sl_py_low']},{sl}!{c1}{S['sl_py_rep']})", MONEY_M,
         "Midpoint of low and as-reported state/local per year"),
        ("Annual price growth", 0.05, PCT, "CBP per-aircraft price rose ~5%/yr, FY2019-FY2026 (CBP Orders tab)"),
        ("IFF rate", 0.0075, "0.00%", "MAS Industrial Funding Fee"),
        ("Bell civilian purchase volume per year", f'=SUMIFS(Purchases!$H${P["first"]}:$H${P["last"]},Purchases!$D${P["first"]}:$D${P["last"]},"Bell Textron")/11',
         MONEY_M, "Purchases tab, Bell Textron, FY2016-FY2026 / 11 years"),
        ("Share of Bell volume moving to MAS if a Bell dealer is awarded", 1 / 3, PCT,
         "Assumption: one-third, starting year 3"),
        ("Year a Bell dealer is awarded", 3, "0", "Assumption"),
    ]
    for n, (lab, val, fmt, basis) in enumerate(rows, start=4):
        ws.cell(row=n, column=1, value=lab)
        c = ws.cell(row=n, column=3, value=val)
        c.number_format = fmt
        ws.cell(row=n, column=4, value=basis)
        if not (isinstance(val, str) and val.startswith("=")):
            c.font = font(color=BLUE)
            c.fill = INPUT_FILL
    # The IFF rate lives in C9 for other tabs
    style_range(ws, "A4:D12")
    for n, (_, val, fmt, _) in enumerate(rows, start=4):
        ws.cell(row=n, column=3).number_format = fmt
        if not (isinstance(val, str) and val.startswith("=")):
            ws.cell(row=n, column=3).font = font(color=BLUE)
            ws.cell(row=n, column=3).fill = INPUT_FILL

    t0 = 15
    section(ws, t0 - 1, "Projection built on actuals", 9)
    header(ws, t0, ["Year", "", "Federal", "State/local", "Bell upside", "Total", "IFF", "Change package total",
                    "Change package IFF"])
    for c, w in zip("EFGHI", [13, 13, 12, 16, 14]):
        ws.column_dimensions[c].width = w
    cp_total = [50000000, 66500000, 78349500, 90563620, 103158073]
    cp_iff = [375000, 498750, 587621, 679227, 773686]
    for k in range(5):
        n = t0 + 1 + k
        ws.cell(row=n, column=1, value=k + 1)
        ws.cell(row=n, column=3, value=f"=$C$6*(1+$C$8)^(A{n}-1)")
        ws.cell(row=n, column=4, value=f"=$C$7*(1+$C$8)^(A{n}-1)")
        ws.cell(row=n, column=5, value=f"=IF(A{n}>=$C$12,$C$10*$C$11*(1+$C$8)^(A{n}-1),0)")
        ws.cell(row=n, column=6, value=f"=SUM(C{n}:E{n})")
        ws.cell(row=n, column=7, value=f"=F{n}*$C$9")
        ws.cell(row=n, column=8, value=cp_total[k]).font = font(color=BLUE)
        ws.cell(row=n, column=9, value=cp_iff[k]).font = font(color=BLUE)
    te = t0 + 5
    ws.cell(row=te + 1, column=1, value="5-year total")
    for c in "CDEFGHI":
        ws[f"{c}{te + 1}"] = f"=SUM({c}{t0 + 1}:{c}{te})"
    style_range(ws, f"A{t0 + 1}:I{te + 1}")
    style_range(ws, f"C{t0 + 1}:F{te + 1}", MONEY_M)
    style_range(ws, f"G{t0 + 1}:G{te + 1}", MONEY)
    style_range(ws, f"H{t0 + 1}:H{te + 1}", MONEY_M)
    style_range(ws, f"I{t0 + 1}:I{te + 1}", MONEY)
    for n in range(t0 + 1, te + 1):
        ws[f"H{n}"].font = font(color=BLUE)
        ws[f"I{n}"].font = font(color=BLUE)
    for c in range(1, 10):
        ws.cell(row=te + 1, column=c).font = font(bold=True)
    ws.cell(row=te + 2, column=1, value="Projection as share of change package")
    ws[f"F{te + 2}"] = f"=F{te + 1}/H{te + 1}"
    ws[f"F{te + 2}"].number_format = PCT
    note(ws, f"A{te + 4}", "Change package columns: completed draft MCP 2026-15, Customer Analysis projection table "
                           "($100M/yr federal demand assumption, 40-65% capture, state/local $10M-$30M).")
    note(ws, f"A{te + 5}", "Volume arrives in lumps: FY2026 civilian MAS obligations were $98.6M; FY2016-FY2017 were zero.")
    ws.freeze_panes = "A4"
    return {"y1_total": f"F{t0 + 1}", "y5_total": f"F{te}", "y1_iff": f"G{t0 + 1}", "y5_iff": f"G{te}",
            "cp_y5": f"H{te}"}


def tab_claims(wb):
    ws = wb.create_sheet("Claims Check")
    title(ws, "Claims in the source documents, checked against the data")
    header(ws, 3, ["Source", "Claim", "Verdict", "What the data shows", "Tab"], widths=[16, 48, 14, 70, 20])
    rows = [
        ("GSS memo, Sep 2025", "CBP is 70% of civilian helicopter purchasing", "Holds",
         "70% of aircraft with known counts (42 of 60); 63% of purchase dollars", "Summary, Purchases"),
        ("GSS memo, Sep 2025", "DOJ buys Bell helicopters", "Holds",
         "FBI five Bell 429s; DEA Bell 407s new and used; $55.2M combined", "Buyers & Competition"),
        ("GSS memo, Sep 2025", "State is an active helicopter buyer", "Not supported",
         "One used Bell 206B3 ($0.8M). State's other PSC 1520 spend is depot maintenance of partner-nation aircraft",
         "Purchases"),
        ("GSS memo, Sep 2025", "State and local demand is limited", "Not supported",
         "$63M-$113M in state/local sales on the contract, FY2020-FY2026 Q2 (22-38% of sales)", "Contract Sales"),
        ("GSS memo, Sep 2025", "CBP previously sourced helicopters directly from Airbus", "No evidence",
         "No CBP purchase direct from Airbus in FY2016-FY2026 FPDS; all five CBP orders went to Davenport on MAS",
         "CBP Orders"),
        ("GSS memo, Sep 2025", "Open-market competition among Airbus resellers would yield better pricing", "No evidence",
         "No open-market purchase of a configured H125 exists to compare. The May 2026 MAS order drew two bids",
         "CBP Orders"),
        ("GSS memo, Sep 2025", "MAS creates a near sole-source environment", "Partly",
         "Four of five CBP orders drew one offer. Cause is the brand-name requirement and one reseller on schedule",
         "CBP Orders"),
        ("Change package", "Helicopters were removed from MAS as low-demand", "Not supported",
         "$293.9M in sales FY2020-FY2026 Q2; $39.3M on SIN 336413 after the April 2025 exclusion", "Contract Sales"),
        ("Change package", "CBP bought 16 aircraft in 2020", "Not supported",
         "FPDS shows two orders totaling 19 aircraft (Aug 2019 and Feb 2021-Sep 2022). 42 aircraft across five orders",
         "CBP Orders"),
        ("Change package", "Federal civilian demand of $100M/yr (10-15 aircraft)", "Not supported",
         "Purchases averaged $46M/yr and about 5.5 aircraft/yr, FY2016-FY2026", "Annual Trends"),
        ("Change package", "SIN capture of federal demand starts at 40%", "Not supported",
         "MAS already carries 68% of federal civilian purchase dollars", "Buyers & Competition"),
        ("Change package", "Year-1 volume $50M", "Holds",
         "Contract sales averaged about $45M/yr, FY2020-FY2026 Q2", "Projection"),
        ("Change package", "Volume grows to $103M by year 5", "Not supported",
         "No buyer growth in the data; growth beyond price escalation requires a second manufacturer", "Projection"),
        ("Change package", "$10M maximum order fits a configured light helicopter", "At risk",
         "CBP paid $9.55M in May 2026, rising ~5%/yr; NNSA paid $18M per twin", "CBP Orders"),
        ("Change package / RFI", "Phase 1 can exclude third-party mission-system integration", "Not supported for CBP",
         "CBP orders carry FLIR 380X and Troll integration mods; configuration is about a third of price", "CBP Orders"),
        ("Change package", "CBP's May 2026 order drew two bids", "Holds", "FPDS offers received = 2", "CBP Orders"),
        ("RFI draft", "Agencies generally buy through agency-specific contracts, not MAS", "Not supported",
         "68% of federal civilian purchase dollars went through MAS", "Buyers & Competition"),
    ]
    fills = {"Holds": "E2EFDA", "Partly": "FFF2CC", "At risk": "FFF2CC", "No evidence": "EDEDED",
             "Not supported": "FCE4D6", "Not supported for CBP": "FCE4D6"}
    for n, r in enumerate(rows, start=4):
        for j, v in enumerate(r, start=1):
            ws.cell(row=n, column=j, value=v)
    style_range(ws, f"A4:E{3 + len(rows)}", wrap=True)
    for n, r in enumerate(rows, start=4):
        ws.cell(row=n, column=3).fill = PatternFill("solid", fgColor=fills[r[2]])
        ws.cell(row=n, column=3).font = font(bold=True)
    ws.freeze_panes = "A4"


def tab_gaps(wb):
    ws = wb.create_sheet("Gaps & Sources")
    title(ws, "Information gaps, method, and sources")
    header(ws, 3, ["Missing input", "What it would settle", "How the workbook handles it"], widths=[40, 55, 65])
    gaps = [
        ("Document creating the temporary accommodation, with effective date",
         "Whether CBP's Sep 2025 ($17.6M) and May 2026 ($95.5M) orders were in scope at award",
         "States the timing risk; recommends the PMO document the accommodation before approval"),
        ("Davenport confirmation of FY2025-FY2026 customer-type split",
         "Whether $49.2M reported as state/local was CBP deliveries",
         "Shows state/local as a range and leads with the low end (22% of sales)"),
        ("FAIRS helicopter counts, models, and ages", "Fleet replacement demand",
         "Uses observed purchases (~5.5 aircraft/yr) instead of an inventory estimate"),
        ("LESO/1033 aircraft holdings", "Size and timing of state/local replacement demand",
         "Described qualitatively; no projection figure depends on it"),
        ("Full eLibrary listing of SIN 336413 holders", "Whether any other MAS contractor lists complete aircraft",
         "FPDS and SSQ+ show no other seller of complete aircraft"),
        ("GSS memo's supporting Google Doc", "The data behind the Sep 2025 conclusions",
         "Memo claims checked directly against FPDS and SSQ+ (Claims Check tab)"),
    ]
    for n, g in enumerate(gaps, start=4):
        for j, v in enumerate(g, start=1):
            ws.cell(row=n, column=j, value=v)
    style_range(ws, f"A4:C{3 + len(gaps)}", wrap=True)

    m0 = 6 + len(gaps)
    section(ws, m0, "Method", 3)
    method = [
        "FPDS: USAspending prime award transactions for PSC 1520, NAICS 336411 (helicopter descriptions only), "
        "and PSCs 1510/1560 with helicopter keywords, FY2016-FY2026. Pulled Oct 19, 2026.",
        "Purchases: complete aircraft hand-tagged from award descriptions; sustainment, parts, overhaul, and the Coast Guard "
        "H-60 hull rebuild excluded. Customer = funding agency.",
        "CBP orders: every action under GS-07F-139DA from the USAspending IDV child-award endpoint; aircraft counts from "
        "modification text and press releases (CBP Orders tab, column K).",
        "Contract sales: SSQ+ (Schedule Sales Query Plus), GS-07F-139DA, by SIN and customer type, FY2017 Q2 to FY2026 Q2.",
        "Adjacent spend: helicopter-keyword pulls of V1xx, J01x, K01x, and parts PSCs. Floors, not totals.",
        "FY2026 is incomplete in FPDS and SSQ+. DoD data runs about 90 days behind.",
        "Color key: blue text = hard-coded input; yellow fill = assumption to vary; green = cross-tab link; black = formula.",
    ]
    for n, t in enumerate(method, start=m0 + 1):
        ws.cell(row=n, column=1, value=t).alignment = Alignment(wrap_text=True, vertical="top")
        ws.merge_cells(start_row=n, start_column=1, end_row=n, end_column=3)
        ws.row_dimensions[n].height = 28
        ws.cell(row=n, column=1).font = font()

    s0 = m0 + len(method) + 2
    section(ws, s0, "Sources", 3)
    sources = [
        "USAspending.gov prime award transactions and IDV child awards (pulled Oct 19, 2026)",
        "GSA SSQ+ Schedule Sales Query Plus, GS-07F-139DA",
        "GSA MAS Refresh 26 SF30 attachment, solicitation 47QSMD20R0001 (Apr 25, 2025)",
        "GSA Interact, helicopter SIN RFI (Sep 30, 2026)",
        "GSS, Market Research Results for Helicopter Marketplace (Sep 2025)",
        "MCP 2026-15 completed draft change package; Helicopter SIN RFI draft",
        "Airbus, CBP orders 10 H125 helicopters (Jul 2026); GovConWire, CBP FY2026 H125 recompete",
        "Sen. Hyde-Smith releases on CBP LEH awards (Jul 2018, Jan 2021)",
        "GSA R7, FAS procures Airbus H125 for Albuquerque PD (Jan 2020); Federal Times (Mar 2017)",
        "Baltimore City Board of Estimates (Dec 2021); Davenport Aviation and Vertical releases (NMSP Nov 2025, Baltimore County Aug 2026)",
        "Sen. Grassley letters on federal aircraft (Jun 23, 2025); GAO-17-73R",
        "DLA LESO/1033 FAQs; Vertical, 'In the crosshairs'; BJS Aviation Units in Large Law Enforcement Agencies (2007)",
        "GAMA 2025 aircraft shipment and billing report",
    ]
    for n, t in enumerate(sources, start=s0 + 1):
        ws.cell(row=n, column=1, value=t).font = font()
        ws.merge_cells(start_row=n, start_column=1, end_row=n, end_column=3)


def tab_summary(wb, P, C, S, ADJ, T, PRJ, B):
    ws = wb["Summary"]
    title(ws, "MCP 2026-15 Market Research: Rotary-Wing Aircraft SIN",
          "Federal contract data FY2016-FY2026 (USAspending) and contract sales FY2020-FY2026 Q2 (SSQ+). "
          "Prepared Oct 2026. Every number below is a formula over the data tabs.")
    ws.column_dimensions["A"].width = 58
    ws.column_dimensions["B"].width = 16
    ws.column_dimensions["C"].width = 80

    ws["A4"] = "Bottom line"
    ws["A4"].font = font(bold=True, size=11, color="1F3864")
    ws["A5"] = ("Helicopters never left MAS. CBP has bought every Light Enforcement Helicopter since 2018 through "
                "GS-07F-139DA, state and local buyers account for a fifth or more of the contract's sales, and the aircraft "
                "have been sold under SINs not written for them, including after Refresh 26 excluded them. A dedicated SIN "
                "is the right fix, on three conditions: configured aircraft in scope, Cooperative Purchasing eligibility, "
                "and a second manufacturer (realistically a Bell dealer).")
    ws.merge_cells("A5:C5")
    ws["A5"].alignment = Alignment(wrap_text=True, vertical="top")
    ws["A5"].font = font(size=11)
    ws.row_dimensions[5].height = 62

    header(ws, 7, ["Key number", "Value", "Basis"])
    pt = P["total"]
    pr = lambda c: f"Purchases!${c}${P['first']}:${c}${P['last']}"  # noqa: E731
    sl = "'Contract Sales'"
    c1 = get_column_letter(S["col0"] + 1)
    c2 = get_column_letter(S["col0"] + 2)
    c4 = get_column_letter(S["col0"] + 4)
    o1, o2 = C["orders"]
    rows = [
        ("Civilian helicopter purchases, FY2016-FY2026", f"=Purchases!H{pt}", MONEY_M,
         "20 awards, 11 buying organizations; complete aircraft only"),
        ("Average purchases per year", f"='Annual Trends'!B{T['mean']}", MONEY_M,
         "Median is nearly identical; three years had no purchases"),
        ("CBP share of purchase dollars", f'=SUMIFS({pr("H")},{pr("B")},"CBP")/Purchases!H{pt}', PCT,
         "The draft's 'about 70 percent' holds on aircraft, not dollars"),
        ("CBP share of aircraft (known counts)", f'=SUMIFS({pr("G")},{pr("B")},"CBP")/Purchases!G{pt}', PCT,
         "42 of 60 aircraft whose counts FPDS states"),
        ("Share of purchase dollars through MAS", f'=SUMIFS({pr("H")},{pr("C")},"GSA MAS")/Purchases!H{pt}', PCT,
         "All of it one dealer, Davenport Aviation (Airbus)"),
        ("CBP aircraft ordered on MAS since 2018", f"='CBP Orders'!C{o2 + 1}", "0",
         "Five orders; every CBP helicopter purchase in the period"),
        ("CBP price per aircraft, first order (Jul 2018)", f"='CBP Orders'!F{C['order_rows']['70B02C18F00000452']}", MONEY_M, "Configured H125"),
        ("CBP price per aircraft, latest order (May 2026)", f"='CBP Orders'!F{C['order_rows']['70B02C26F00000290']}", MONEY_M,
         "About 5% a year; crosses the proposed $10M maximum order on the next buy"),
        ("Configuration share of price", f"='CBP Orders'!G{C['config']}", PCT,
         "Lightly equipped FWS H125 vs. CBP configured H125, 2022. Includes third-party FLIR and Troll equipment"),
        ("Offers on CBP's five MAS orders", "1, 1, 1, 1, 2", None, "Brand-name, small-business set-aside; the May 2026 order drew two"),
        ("Bell share of non-CBP purchases", f'=SUMIFS({pr("H")},{pr("D")},"Bell Textron",{pr("B")},"<>CBP")/SUMIFS({pr("H")},{pr("B")},"<>CBP")',
         PCT, "All off-schedule: FBI and DEA IDIQs, Park Police open market (not competed)"),
        ("Contract sales, FY2020-FY2026 Q2", f"={sl}!{c4}{S['total']}", MONEY_M, "SSQ+, all SINs, GS-07F-139DA"),
        ("State/local share of contract sales (low reading)", f"={sl}!{c1}{S['sl_share_low']}", PCT,
         "Treats FY2025-26 state/local sales as misreported CBP deliveries"),
        ("State/local share of contract sales (as reported)", f"={sl}!{c1}{S['sl_share_rep']}", PCT,
         "Either reading contradicts GSS's 'limited'"),
        ("Sales on SIN 336413 after the Refresh 26 exclusion", f"={sl}!{c1}{S['post_excl']}", MONEY_M,
         "Plus CBP orders of $17.6M (Sep 2025) and $95.5M (May 2026)"),
        ("IFF actually collected on contract sales", f"='Annual Trends'!K{T['total']}", MONEY,
         "0.75% of SSQ+ sales, FY2020-FY2026 Q2"),
        ("Civilian adjacent spend (parts, repair, services)", f"='Adjacent Spend'!{ADJ['civ_total']}", MONEY_M,
         "Floor; Coast Guard is 97% of parts"),
        ("Purchases as share of civilian rotary-wing contract spend", f"='Adjacent Spend'!{ADJ['share']}", PCT,
         "A purchase SIN reaches about a third at most"),
        ("Projected volume, year 1 / year 5", f"=Projection!{PRJ['y1_total']}", MONEY_M,
         "Year 5 in the next row; change package projects $50M rising to $103M"),
        ("", f"=Projection!{PRJ['y5_total']}", MONEY_M, "Year 5 with a Bell dealer from year 3"),
        ("Projected IFF, year 1 / year 5", f"=Projection!{PRJ['y1_iff']}", MONEY, ""),
        ("", f"=Projection!{PRJ['y5_iff']}", MONEY, ""),
    ]
    for n, (lab, f, fmt, basis) in enumerate(rows, start=8):
        ws.cell(row=n, column=1, value=lab)
        c = ws.cell(row=n, column=2, value=f)
        if fmt:
            c.number_format = fmt
        ws.cell(row=n, column=3, value=basis)
    ke = 7 + len(rows)
    style_range(ws, f"A8:C{ke}", wrap=True)
    for n, (_, f, fmt, _) in enumerate(rows, start=8):
        c = ws.cell(row=n, column=2)
        if fmt:
            c.number_format = fmt
        c.font = font(bold=True, color=GREEN if isinstance(f, str) and f.startswith("=") else "000000")
        c.alignment = Alignment(horizontal="right", vertical="top")

    f0 = ke + 2
    section(ws, f0, "Key findings", 3)
    findings = [
        "1. CBP has bought every Light Enforcement Helicopter since 2018 on GS-07F-139DA: five orders, 42 aircraft. "
        "GSS recommended moving off MAS a customer that had used nothing else for seven years, and CBP placed another order the same month.",
        "2. The 70% CBP figure holds on aircraft counts (70%) and nearly on dollars (63%). Say 'about two-thirds.'",
        "3. State and local demand is not limited: 22-38% of the contract's sales, $10M-$17M a year. The channel began in 2017 at state and local request.",
        "4. The aircraft have never had a SIN written for them: sales ran under legacy 567-99, SIN 332216 (law enforcement tools), and SIN 336413, "
        "including $39M after Refresh 26 excluded complete aircraft. The authorizing document for the temporary accommodation was not located.",
        "5. Configuration is about a third of CBP's price and includes third-party equipment (FLIR, Troll). A Phase 1 SIN without mission-system "
        "integration cannot carry CBP's next order.",
        "6. Outside CBP, Bell won 61% of civilian purchases, all off-schedule. Growth beyond CBP depends on a Bell dealer joining the SIN.",
        "7. Federal civilian demand is about $46M a year, half the change package's $100M assumption. Actual contract sales of ~$45M a year "
        "support the package's year-1 figure but not growth to $103M.",
        "8. No evidence that open-market buying would beat MAS for CBP: no open-market configured H125 exists to compare, and the latest MAS order drew two bids.",
    ]
    for n, t in enumerate(findings, start=f0 + 1):
        ws.cell(row=n, column=1, value=t)
        ws.merge_cells(start_row=n, start_column=1, end_row=n, end_column=3)
        ws.cell(row=n, column=1).alignment = Alignment(wrap_text=True, vertical="top")
        ws.cell(row=n, column=1).font = font()
        ws.row_dimensions[n].height = 30

    r0 = f0 + len(findings) + 2
    section(ws, r0, "Recommendation", 3)
    rec = [
        "Establish the dedicated SIN (Alternative C), conditioned on:",
        "  a. Dealer-installed mission equipment delivered with the aircraft in Phase 1 scope, priced as listed options.",
        "  b. Cooperative Purchasing and 1122 eligibility, confirmed by OGC before the SIN text is final.",
        "  c. Outreach to Bell dealers as part of launch; without a second manufacturer the SIN is one dealer serving one customer.",
        "  d. Maximum order raised to $15M, and the temporary accommodation documented by the PMO before approval.",
    ]
    for n, t in enumerate(rec, start=r0 + 1):
        ws.cell(row=n, column=1, value=t).font = font(bold=(n == r0 + 1))
        ws.merge_cells(start_row=n, start_column=1, end_row=n, end_column=3)

    g0 = r0 + len(rec) + 2
    section(ws, g0, "Not available for this analysis (see Gaps & Sources)", 3)
    gaps = ["Temporary-accommodation document and effective date", "Davenport confirmation of FY2025-26 customer split",
            "FAIRS helicopter ages; LESO/1033 holdings; full eLibrary SIN listing; GSS memo's supporting data"]
    for n, t in enumerate(gaps, start=g0 + 1):
        ws.cell(row=n, column=1, value=t).font = font()
        ws.merge_cells(start_row=n, start_column=1, end_row=n, end_column=3)

    t0 = g0 + len(gaps) + 2
    section(ws, t0, "Tabs", 3)
    tabs = [("Annual Trends", "Purchases, MAS obligations, contract sales, and adjacent spend by fiscal year, with charts"),
            ("Purchases", "The 20 civilian helicopter purchases, FY2016-FY2026, with source awards"),
            ("CBP Orders", "Every CBP ordering action on GS-07F-139DA, price per aircraft, configuration share"),
            ("Contract Sales", "SSQ+ sales by SIN, customer type, and quarter"),
            ("Buyers & Competition", "By buyer, vehicle, and seller; offers received"),
            ("Adjacent Spend", "Parts, repair, and services spend, civilian vs DoD"),
            ("Projection", "Five-year projection with adjustable assumptions, vs the change package"),
            ("Claims Check", "Each claim in the GSS memo, change package, and RFI, with a verdict"),
            ("Gaps & Sources", "Missing inputs, method, and sources")]
    for n, (t, desc) in enumerate(tabs, start=t0 + 1):
        ws.cell(row=n, column=1, value=t).font = font(bold=True)
        ws.cell(row=n, column=2, value=desc).font = font()
        ws.merge_cells(start_row=n, start_column=2, end_row=n, end_column=3)
    ws.sheet_view.showGridLines = False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--uploads", required=True)
    ap.add_argument("--out", default=str(HERE / "MCP_2026-15_Helicopter_Market_Research.xlsx"))
    args = ap.parse_args()
    d = load_inputs(args.uploads)

    wb = Workbook()
    wb.active.title = "Summary"
    P = tab_purchases(wb, d)
    C = tab_cbp(wb, d)
    S = tab_sales(wb, d)
    ADJ = tab_adjacent(wb, d, P)
    B = tab_buyers(wb, d, P)
    PRJ = tab_projection(wb, S, P)
    T = tab_trends(wb, d, P, S, ADJ)
    tab_claims(wb)
    tab_gaps(wb)
    tab_summary(wb, P, C, S, ADJ, T, PRJ, B)
    order = ["Summary", "Annual Trends", "Purchases", "CBP Orders", "Contract Sales", "Buyers & Competition",
             "Adjacent Spend", "Projection", "Claims Check", "Gaps & Sources"]
    wb._sheets = [wb[n] for n in order]
    wb["Summary"].sheet_properties.tabColor = "1F3864"
    wb.save(args.out)
    print(args.out)


if __name__ == "__main__":
    main()
