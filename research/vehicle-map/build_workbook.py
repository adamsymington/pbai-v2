#!/usr/bin/env python3
"""Build the MAS market-map workbook from vehicle_map.py output.

Reads top_sins.csv, data/agg/*.csv, data/awards/*.csv, data/mas_vendors/*.csv, and
data/bpa_parents.json. Writes MAS_Market_Map.xlsx.

The Settings tab controls which vehicles count as addressable, the segment (All, Civilian,
DoD), and the fiscal year; the market tabs recalculate. Top Funders and Targets are computed
here with the default addressable definition and are static.

    python3 build_workbook.py [--as-of 2026-10-23] [--horizon-months 18] [--min-target 250000]
"""

import argparse
import csv
import os
import json
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter as L
from openpyxl.worksheet.datavalidation import DataValidation

import vehicle_map as VM

HERE = Path(__file__).resolve().parent
WORK = Path(os.environ.get("MASMAP_DIR", HERE))  # where inputs and outputs live
DATA = WORK / "data"
csv.field_size_limit(10 ** 8)

FONT = "Arial"
BLUE, GREEN = "0000FF", "008000"
HDR = PatternFill("solid", fgColor="1F3864")
SUB = PatternFill("solid", fgColor="D9E1F2")
YELLOW = PatternFill("solid", fgColor="FFFF00")
THIN = Side(style="thin", color="BFBFBF")
BOX = Border(top=THIN, bottom=THIN, left=THIN, right=THIN)
M = '$#,##0.0,,"M";($#,##0.0,,"M");"-"'
D = '$#,##0;($#,##0);"-"'
P = '0%;(0%);"-"'
SERIES = ["2A78D6", "EB6834", "1BAF7A"]

BUCKETS = [b for b in VM.BUCKETS if b != "BPA (parent unresolved)"] + ["BPA (parent unresolved)"]
DEFAULT_ADDRESSABLE = {"Other agency GWAC", "VA FSS", "Agency IDIQ / BOA", "Agency BPA (standalone)", "Open market"}
AGENCY_IDV = {"Agency IDIQ / BOA", "Agency BPA (standalone)", "Other agency GWAC", "VA FSS"}


def f(**kw):
    kw.setdefault("name", FONT)
    kw.setdefault("size", 10)
    return Font(**kw)


def hdr(ws, row, labels, col=1, widths=None):
    for i, t in enumerate(labels):
        c = ws.cell(row=row, column=col + i, value=t)
        c.font = f(bold=True, color="FFFFFF")
        c.fill = HDR
        c.border = BOX
        c.alignment = Alignment(wrap_text=True, vertical="center")
    for i, w in enumerate(widths or []):
        ws.column_dimensions[L(col + i)].width = w


def box(ws, rng, fmt=None, bold=False, color=None, wrap=False):
    for row in ws[rng]:
        for c in row:
            c.font = f(bold=bold, color=color)
            c.border = BOX
            c.alignment = Alignment(wrap_text=wrap, vertical="top")
            if fmt:
                c.number_format = fmt


def title(ws, t, sub=None):
    ws["A1"] = t
    ws["A1"].font = f(bold=True, size=14, color="1F3864")
    if sub:
        ws["A2"] = sub
        ws["A2"].font = f(italic=True, color="595959")


def note(ws, cell, t):
    ws[cell] = t
    ws[cell].font = f(italic=True, size=9, color="595959")


# ---------------------------------------------------------------------------
# Load
# ---------------------------------------------------------------------------

def load(args):
    top = list(csv.DictReader(open(WORK / "top_sins.csv")))
    bpa = json.loads((DATA / "bpa_parents.json").read_text()) if (DATA / "bpa_parents.json").exists() else {}
    bpa_bucket = {k: VM.bucket_for_bpa(v.get("parent")) for k, v in bpa.items() if v.get("found")}

    def rebucket(bucket, key):
        return bpa_bucket.get(key, bucket) if bucket == "BPA (parent unresolved)" else bucket

    agg = []
    for p in sorted((DATA / "agg").glob("*.csv")):
        for r in csv.DictReader(open(p)):
            r["bucket"] = rebucket(r["bucket"], r["bpa_key"])
            r["obligations"] = float(r["obligations"])
            agg.append(r)
    awards = []
    for p in sorted((DATA / "awards").glob("*.csv")):
        for r in csv.DictReader(open(p)):
            r["bucket"] = rebucket(r["bucket"], r.get("bpa_key", ""))
            if r["bucket"] == "GSA MAS":
                continue
            awards.append(r)
    mas_vendors = defaultdict(set)
    for p in sorted((DATA / "mas_vendors").glob("*.csv")) if (DATA / "mas_vendors").exists() else []:
        for r in csv.DictReader(open(p)):
            if rebucket(r["bucket"], r.get("bpa_key", "")) == "GSA MAS":
                mas_vendors[r["naics"]].add(r["recipient_uei"])
    return top, agg, awards, mas_vendors, bpa


# ---------------------------------------------------------------------------
# Tabs
# ---------------------------------------------------------------------------

def tab_settings(wb, fys):
    ws = wb.create_sheet("Settings")
    title(ws, "Settings", "Yellow cells drive every formula on the Category Map, SIN Map, and NAICS Market tabs.")
    hdr(ws, 4, ["Vehicle bucket", "Counts as addressable for MAS? (Y/N)", "What it is"], widths=[34, 16, 80])
    desc = {
        "GSA MAS": "Orders and BPA calls under GSA Multiple Award Schedule contracts",
        "GSA non-MAS (GWAC, OASIS+, other)": "Alliant, 8(a) STARS, VETS, OASIS/OASIS+, and other GSA IDVs. Already GSA business",
        "Other agency GWAC": "Non-GSA GWACs such as NASA SEWP and NIH CIO-SP",
        "VA FSS": "VA Federal Supply Schedule orders and BPA calls",
        "Agency IDIQ / BOA": "Agency-awarded IDIQs and basic ordering agreements",
        "Agency BPA (standalone)": "Agency BPAs not established under a schedule",
        "BPA (parent unresolved)": "BPA calls whose BPA could not be traced to a parent (small BPAs below the lookup threshold)",
        "Open market": "Definitive contracts and purchase orders with no parent vehicle",
    }
    for i, b in enumerate(BUCKETS, start=5):
        ws.cell(row=i, column=1, value=b)
        c = ws.cell(row=i, column=2, value="Y" if b in DEFAULT_ADDRESSABLE else "N")
        c.fill = YELLOW
        c.font = f(color=BLUE, bold=True)
        ws.cell(row=i, column=3, value=desc[b])
    last = 4 + len(BUCKETS)
    box(ws, f"A5:C{last}")
    for i in range(5, last + 1):
        ws.cell(row=i, column=2).fill = YELLOW
        ws.cell(row=i, column=2).font = f(color=BLUE, bold=True)
        ws.cell(row=i, column=2).alignment = Alignment(horizontal="center")
    dv = DataValidation(type="list", formula1='"Y,N"', allow_blank=False)
    ws.add_data_validation(dv)
    dv.add(f"B5:B{last}")

    r = last + 2
    ws.cell(row=r, column=1, value="Segment (All, Civilian, DoD)").font = f(bold=True)
    ws.cell(row=r, column=2, value="All")
    ws.cell(row=r + 1, column=1, value="Fiscal year (All or a year)").font = f(bold=True)
    ws.cell(row=r + 1, column=2, value="All")
    for c in (ws.cell(row=r, column=2), ws.cell(row=r + 1, column=2)):
        c.fill = YELLOW
        c.font = f(color=BLUE, bold=True)
        c.border = BOX
        c.alignment = Alignment(horizontal="center")
    dv2 = DataValidation(type="list", formula1='"All,Civilian,DoD"')
    dv3 = DataValidation(type="list", formula1='"All,' + ",".join(str(y) for y in fys) + '"')
    ws.add_data_validation(dv2)
    ws.add_data_validation(dv3)
    dv2.add(f"B{r}")
    dv3.add(f"B{r + 1}")
    # Helper criteria: "<>~none~" matches every value, so "All" needs no wildcard support
    ws.cell(row=r, column=4, value=f'=IF(B{r}="All","<>~none~",B{r})')
    ws.cell(row=r + 1, column=4, value=f'=IF(B{r + 1}="All","<>~none~",B{r + 1})')
    ws.cell(row=r, column=3, value="Criteria helper (do not edit)")
    ws.cell(row=r + 1, column=3, value="Criteria helper (do not edit)")
    for c in (ws.cell(row=r, column=3), ws.cell(row=r + 1, column=3)):
        c.font = f(italic=True, size=9, color="595959")
    ws.cell(row=r + 2, column=1, value="As-of date for the target window").font = f(bold=True)
    return {"flags": (5, last), "seg": f"Settings!$D${r}", "fy": f"Settings!$D${r + 1}",
            "seg_val": f"Settings!$B${r}", "fy_val": f"Settings!$B${r + 1}", "asof_row": r + 2,
            "asof": f"Settings!$B${r + 2}"}


def tab_data(wb, agg):
    ws = wb.create_sheet("Data")
    title(ws, "Obligations by NAICS, fiscal year, segment, and vehicle",
          "USAspending contract transactions; BPA calls re-bucketed by their BPA's parent. Feeds every market formula.")
    hdr(ws, 4, ["FY", "NAICS", "Segment", "Bucket", "Obligations", "Transactions"], widths=[7, 9, 10, 34, 16, 12])
    rows = defaultdict(lambda: [0.0, 0])
    for r in agg:
        k = (r["fy"], r["naics"], r["segment"], r["bucket"])
        rows[k][0] += r["obligations"]
        rows[k][1] += int(r["transactions"])
    for i, (k, v) in enumerate(sorted(rows.items()), start=5):
        ws.cell(row=i, column=1, value=int(k[0]) if str(k[0]).isdigit() else k[0])
        ws.cell(row=i, column=2, value=k[1])
        ws.cell(row=i, column=3, value=k[2])
        ws.cell(row=i, column=4, value=k[3])
        ws.cell(row=i, column=5, value=round(v[0], 2)).number_format = D
        ws.cell(row=i, column=6, value=v[1])
    last = 4 + len(rows)
    ws.freeze_panes = "A5"
    rng = {c: f"Data!${c}$5:${c}${last}" for c in "ABCDEF"}
    return rng


def sumifs(rng, S, naics_list, bucket_cell=None, bucket_text=None):
    """SUM of SUMIFS over a list of NAICS codes, honoring the segment and FY selectors."""
    parts = []
    for n in naics_list:
        crit = [f'{rng["B"]},"{n}"', f'{rng["C"]},{S["seg"]}', f'{rng["A"]},{S["fy"]}']
        if bucket_cell:
            crit.append(f'{rng["D"]},{bucket_cell}')
        elif bucket_text:
            crit.append(f'{rng["D"]},"{bucket_text}"')
        parts.append(f'SUMIFS({rng["E"]},{",".join(crit)})')
    return "=" + "+".join(parts) if parts else "=0"


def market_block(ws, row, first_col, naics_list, rng, S):
    """Writes Total, one column per bucket, MAS share, Addressable, Addressable share. Returns column map."""
    cols = {}
    c = first_col
    bucket_cols = []
    for b in BUCKETS:
        ws.cell(row=row, column=c, value=sumifs(rng, S, naics_list, bucket_text=b)).number_format = M
        bucket_cols.append(c)
        cols[b] = c
        c += 1
    tot = c
    ws.cell(row=row, column=tot, value=f"=SUM({L(bucket_cols[0])}{row}:{L(bucket_cols[-1])}{row})").number_format = M
    flags = S["flags"]
    addr = tot + 1
    terms = [f'IF(Settings!$B${flags[0] + i}="Y",{L(bc)}{row},0)' for i, bc in enumerate(bucket_cols)]
    ws.cell(row=row, column=addr, value="=" + "+".join(terms)).number_format = M
    ws.cell(row=row, column=addr + 1, value=f'=IF({L(tot)}{row}<>0,{L(cols["GSA MAS"])}{row}/{L(tot)}{row},"")').number_format = P
    ws.cell(row=row, column=addr + 2, value=f'=IF({L(tot)}{row}<>0,{L(addr)}{row}/{L(tot)}{row},"")').number_format = P
    cols.update({"Total": tot, "Addressable": addr, "MAS share": addr + 1, "Addressable share": addr + 2})
    return cols


MARKET_HEADERS = BUCKETS + ["Total market", "Addressable", "MAS share", "Addressable share"]


def tab_naics(wb, top, rng, S):
    ws = wb.create_sheet("NAICS Market")
    title(ws, "Market by NAICS", "Each NAICS once, with the SINs and categories that map to it.")
    naics_sins = defaultdict(list)
    for r in top:
        for n in r["naics"].split(";"):
            naics_sins[n].append(f'{r["sin"]} ({r["category"]})')
    hdr(ws, 4, ["NAICS", "SINs (category)"] + MARKET_HEADERS, widths=[9, 44] + [13] * len(MARKET_HEADERS))
    for i, n in enumerate(sorted(naics_sins), start=5):
        ws.cell(row=i, column=1, value=n)
        ws.cell(row=i, column=2, value="; ".join(naics_sins[n]))
        market_block(ws, i, 3, [n], rng, S)
    last = 4 + len(naics_sins)
    box(ws, f"A5:B{last}")
    ws.freeze_panes = "C5"
    return last


def tab_sin(wb, top, rng, S, fys):
    ws = wb.create_sheet("SIN Map")
    title(ws, "Top SINs by MAS sales in each large category, and their NAICS market",
          "SSQ+ sales are MAS-reported sales; market columns are FPDS obligations in the SIN's NAICS codes. "
          "A NAICS can serve several SINs, so SIN rows overlap; category totals on Category Map do not.")
    sales_cols = [f"MAS sales FY{y} (SSQ+)" for y in fys]
    heads = ["Category", "Rank", "SIN", "NAICS"] + sales_cols + ["MAS sales total"] + MARKET_HEADERS
    hdr(ws, 4, heads, widths=[26, 6, 12, 22] + [13] * (len(sales_cols) + 1 + len(MARKET_HEADERS)))
    for i, r in enumerate(top, start=5):
        ws.cell(row=i, column=1, value=r["category"])
        ws.cell(row=i, column=2, value=int(r["rank"]))
        ws.cell(row=i, column=3, value=r["sin"])
        ws.cell(row=i, column=4, value=r["naics"].replace(";", ", "))
        for j, y in enumerate(fys):
            c = ws.cell(row=i, column=5 + j, value=float(r.get(f"sales_fy{y}", 0) or 0))
            c.number_format = M
            c.font = f(color=BLUE)
        tc = 5 + len(fys)
        ws.cell(row=i, column=tc, value=f"=SUM({L(5)}{i}:{L(tc - 1)}{i})").number_format = M
        market_block(ws, i, tc + 1, r["naics"].split(";"), rng, S)
    last = 4 + len(top)
    box(ws, f"A5:D{last}")
    for i in range(5, last + 1):
        for j in range(len(fys)):
            ws.cell(row=i, column=5 + j).font = f(color=BLUE)
    ws.freeze_panes = "E5"
    return last


def tab_category(wb, top, rng, S):
    ws = wb.create_sheet("Category Map")
    title(ws, "Market by MAS large category (top SINs' NAICS, each NAICS counted once per category)")
    cats = defaultdict(list)
    for r in top:
        for n in r["naics"].split(";"):
            if n not in cats[r["category"]]:
                cats[r["category"]].append(n)
    hdr(ws, 4, ["Large category", "SINs", "NAICS codes"] + MARKET_HEADERS,
        widths=[30, 7, 40] + [13] * len(MARKET_HEADERS))
    cols = None
    for i, cat in enumerate(sorted(cats), start=5):
        ws.cell(row=i, column=1, value=cat)
        ws.cell(row=i, column=2, value=sum(1 for r in top if r["category"] == cat))
        ws.cell(row=i, column=3, value=", ".join(cats[cat]))
        cols = market_block(ws, i, 4, cats[cat], rng, S)
    last = 4 + len(cats)
    box(ws, f"A5:C{last}", wrap=True)
    allnaics = sorted({n for v in cats.values() for n in v})
    tr = last + 1
    ws.cell(row=tr, column=1, value="All categories (each NAICS once)")
    market_block(ws, tr, 4, allnaics, rng, S)
    for c in range(1, 4 + len(MARKET_HEADERS)):
        ws.cell(row=tr, column=c).font = f(bold=True)
        ws.cell(row=tr, column=c).border = BOX
    ws.freeze_panes = "D5"

    ch = BarChart()
    ch.type = "bar"
    ch.grouping = "stacked"
    ch.overlap = 100
    ch.title = "Market by category: MAS, other GSA, addressable"
    ch.x_axis.number_format = '$0,,,"B"'
    for b, color in zip(["GSA MAS", "GSA non-MAS (GWAC, OASIS+, other)", "Addressable"], SERIES):
        col = cols[b] if b in cols else cols["Addressable"]
        ref = Reference(ws, min_col=col, min_row=4, max_row=last)
        ch.add_data(ref, titles_from_data=True)
        ch.series[-1].graphicalProperties.solidFill = color
        ch.series[-1].graphicalProperties.line.solidFill = "FFFFFF"
    ch.set_categories(Reference(ws, min_col=1, min_row=5, max_row=last))
    ch.height, ch.width = 10, 20
    ch.legend.position = "b"
    ch.y_axis.majorGridlines = None
    ch.x_axis.delete = False
    ch.y_axis.delete = False
    ws.add_chart(ch, f"A{tr + 4}")
    note(ws, f"A{tr + 1 + 1}", "Addressable excludes GSA vehicles by default; change the definition on Settings. "
                               "'Other' (unresolved BPA, Other GWAC, VA FSS) is included in Total.")
    return {"last": last, "total": tr, "cols": cols, "cats": cats}


def category_of(top):
    m = defaultdict(list)
    for r in top:
        for n in r["naics"].split(";"):
            m[n].append((r["category"], int(r["rank"]), r["sin"]))
    return m


def tab_funders(wb, top, agg, fys):
    ws = wb.create_sheet("Top Funders")
    title(ws, "Top funding offices (AAC) by addressable spend in each category's NAICS",
          "Static, default addressable definition (non-GSA vehicles). All segments. Top 25 offices per category.")
    cmap = category_of(top)
    stats = defaultdict(lambda: defaultdict(float))
    meta = {}
    for r in agg:
        for cat in {c for c, _, _ in cmap.get(r["naics"], [])}:
            k = (cat, r["funding_office_code"] or "(none)")
            meta.setdefault(k, (r["funding_agency"], r["funding_sub_agency"], r["funding_office_name"], r["segment"]))
            s = stats[k]
            s["total"] += r["obligations"]
            if r["bucket"] == "GSA MAS":
                s["mas"] += r["obligations"]
            elif r["bucket"] == "GSA non-MAS (GWAC, OASIS+, other)":
                s["gsa_other"] += r["obligations"]
            if r["bucket"] in DEFAULT_ADDRESSABLE:
                s["addr"] += r["obligations"]
                s[f"addr_{r['fy']}"] += r["obligations"]
            if r["bucket"] == "Open market":
                s["open"] += r["obligations"]
            if r["bucket"] in AGENCY_IDV:
                s["agency_idv"] += r["obligations"]
            s["awarding:" + (r["awarding_office_code"] or "")] += r["obligations"]
    heads = ["Category", "Rank", "Funding office (AAC)", "Office name", "Agency", "Sub-agency", "Segment",
             "Total spend", "GSA MAS", "Other GSA", "Addressable", "Open market", "Agency IDVs", "MAS share",
             "Addressable share"] + [f"Addressable FY{y}" for y in fys] + ["Trend (first to last FY)",
                                                                          "Main contracting office (AAC)"]
    hdr(ws, 4, heads, widths=[24, 6, 12, 32, 24, 26, 9] + [12] * (len(heads) - 9) + [12, 14])
    row = 5
    for cat in sorted({c for c, _ in stats}):
        offices = sorted([k for k in stats if k[0] == cat], key=lambda k: -stats[k]["addr"])[:25]
        for rank, k in enumerate(offices, start=1):
            s, m = stats[k], meta[k]
            awarding = max(((kk.split(":", 1)[1], v) for kk, v in s.items() if kk.startswith("awarding:")),
                           key=lambda x: x[1], default=("", 0))[0]
            vals = [cat, rank, k[1], m[2], m[0], m[1], m[3], s["total"], s["mas"], s["gsa_other"], s["addr"],
                    s["open"], s["agency_idv"], None, None] + [s.get(f"addr_{y}", 0.0) for y in fys] + [None, awarding]
            for j, v in enumerate(vals, start=1):
                ws.cell(row=row, column=j, value=v)
            ws.cell(row=row, column=14, value=f'=IF(H{row}<>0,I{row}/H{row},"")')
            ws.cell(row=row, column=15, value=f'=IF(H{row}<>0,K{row}/H{row},"")')
            fc, lc = L(16), L(15 + len(fys))
            ws.cell(row=row, column=16 + len(fys), value=f'=IF({fc}{row}>0,{lc}{row}/{fc}{row}-1,"")')
            row += 1
    last = row - 1
    box(ws, f"A5:{L(len(heads))}{last}")
    for c in ["H", "I", "J", "K", "L", "M"] + [L(16 + j) for j in range(len(fys))]:
        for i in range(5, last + 1):
            ws[f"{c}{i}"].number_format = M
    for c in ["N", "O", L(16 + len(fys))]:
        for i in range(5, last + 1):
            ws[f"{c}{i}"].number_format = P
    note(ws, f"A{last + 2}", "Funding office = the office whose money it is (the customer). Main contracting office = "
                             "the awarding office that placed most of these dollars. FY2026 is incomplete, so the trend "
                             "column understates growth for DoD.")
    ws.freeze_panes = "E5"
    ws.auto_filter.ref = f"A4:{L(len(heads))}{last}"


def tab_targets(wb, top, awards, mas_vendors, fys, as_of, horizon_end, min_target, S):
    ws = wb.create_sheet("Targets")
    title(ws, f"Conversion targets: non-MAS awards ending {as_of:%b %d, %Y} to {horizon_end:%b %d, %Y}",
          f"Addressable vehicles only, at least ${min_target:,.0f} obligated FY{fys[0]}-FY{fys[-1]}. "
          "Ranked within each category by obligations. 'Incumbent on MAS' = the vendor received MAS orders in the same NAICS.")
    cmap = category_of(top)
    rows = []
    for a in awards:
        if a["bucket"] not in DEFAULT_ADDRESSABLE:
            continue
        end = a.get("pop_current_end") or ""
        try:
            end_d = datetime.strptime(end[:10], "%Y-%m-%d").date()
        except ValueError:
            continue
        if not (as_of <= end_d <= horizon_end):
            continue
        obl = sum(float(a.get(f"obl_fy{y}") or 0) for y in fys)
        if obl < min_target:
            continue
        cats = cmap.get(a["naics"], [])
        if not cats:
            continue
        cat, rank, sin = sorted(cats, key=lambda x: x[1])[0]
        rows.append((cat, sin, end_d, obl, a, a.get("recipient_uei") in mas_vendors.get(a["naics"], set())))
    heads = ["Category", "SIN", "Rank in category", "Current end", "Months to end", "Obligated FY24-26",
             "Base + all options", "Vehicle", "PIID", "Parent IDV", "NAICS", "PSC", "Funding agency", "Funding sub-agency",
             "Funding office (AAC)", "Funding office", "Contracting office (AAC)", "Contracting office", "Vendor",
             "Vendor UEI", "Incumbent on MAS", "Set-aside", "Extent competed", "Offers", "Potential end", "Description"]
    hdr(ws, 4, heads, widths=[22, 10, 7, 11, 8, 14, 14, 18, 20, 18, 8, 7, 22, 24, 11, 28, 11, 28, 28, 14, 9, 9, 8, 7, 11, 60])
    rows.sort(key=lambda x: (x[0], -x[3]))
    r = 5
    per_cat = defaultdict(int)
    for cat, sin, end_d, obl, a, inc in rows:
        per_cat[cat] += 1
        vals = [cat, sin, per_cat[cat], end_d, None, obl, float(a.get("base_and_all_options") or 0) or None, a["bucket"],
                a["piid"], a.get("parent_piid", ""), a["naics"], a.get("psc"), a.get("funding_agency"),
                a.get("funding_sub_agency"), a.get("funding_office_code"), a.get("funding_office_name"),
                a.get("awarding_office_code"), a.get("awarding_office_name"), a.get("recipient"), a.get("recipient_uei"),
                "Yes" if inc else "No", a.get("set_aside"), a.get("extent_competed"), a.get("offers"),
                a.get("pop_potential_end", "")[:10], a.get("description")]
        for j, v in enumerate(vals, start=1):
            ws.cell(row=r, column=j, value=v)
        ws.cell(row=r, column=5, value=f'=ROUND((D{r}-{S["asof"]})/30.4,0)')
        r += 1
    last = r - 1
    if last >= 5:
        box(ws, f"A5:{L(len(heads))}{last}")
        for i in range(5, last + 1):
            ws[f"D{i}"].number_format = "yyyy-mm-dd"
            ws[f"F{i}"].number_format = D
            ws[f"G{i}"].number_format = D
    ws.freeze_panes = "E5"
    ws.auto_filter.ref = f"A4:{L(len(heads))}{max(last, 5)}"
    return len(rows)


def tab_trends(wb, top, agg, fys):
    ws = wb.create_sheet("Trends")
    title(ws, "MAS share and addressable spend by category and fiscal year",
          "Static, default addressable definition, all segments. FY2026 is incomplete in FPDS (DoD about 90 days light).")
    cmap = category_of(top)
    t = defaultdict(lambda: defaultdict(float))
    for r in agg:
        for cat in {c for c, _, _ in cmap.get(r["naics"], [])}:
            s = t[(cat, r["fy"])]
            s["total"] += r["obligations"]
            if r["bucket"] == "GSA MAS":
                s["mas"] += r["obligations"]
            if r["bucket"] in DEFAULT_ADDRESSABLE:
                s["addr"] += r["obligations"]
    heads = ["Category"] + [f"Total FY{y}" for y in fys] + [f"MAS FY{y}" for y in fys] + \
            [f"MAS share FY{y}" for y in fys] + [f"Addressable FY{y}" for y in fys] + ["MAS share change (pts)"]
    hdr(ws, 4, heads, widths=[30] + [12] * (len(heads) - 1))
    n = len(fys)
    for i, cat in enumerate(sorted({c for c, _ in t}), start=5):
        ws.cell(row=i, column=1, value=cat)
        for j, y in enumerate(fys):
            s = t[(cat, str(y))]
            ws.cell(row=i, column=2 + j, value=s["total"]).number_format = M
            ws.cell(row=i, column=2 + n + j, value=s["mas"]).number_format = M
            ws.cell(row=i, column=2 + 2 * n + j,
                    value=f'=IF({L(2 + j)}{i}<>0,{L(2 + n + j)}{i}/{L(2 + j)}{i},"")').number_format = P
            ws.cell(row=i, column=2 + 3 * n + j, value=s["addr"]).number_format = M
        ws.cell(row=i, column=2 + 4 * n,
                value=f'=IF(AND({L(2 + 2 * n)}{i}<>"",{L(1 + 3 * n)}{i}<>""),({L(1 + 3 * n)}{i}-{L(2 + 2 * n)}{i})*100,"")'
                ).number_format = '0.0;(0.0);"-"'
    last = 4 + len({c for c, _ in t})
    box(ws, f"A5:A{last}")
    ws.freeze_panes = "B5"


def tab_agency(wb, top, agg):
    ws = wb.create_sheet("Agency View")
    title(ws, "Addressable spend by funding agency and category",
          "Static, default addressable definition, FY2024-FY2026, all segments. Agencies ranked by total addressable.")
    cmap = category_of(top)
    cats = sorted({r["category"] for r in top})
    t = defaultdict(lambda: defaultdict(float))
    mas = defaultdict(float)
    tot = defaultdict(float)
    for r in agg:
        ag = r["funding_agency"] or "(none)"
        for cat in {c for c, _, _ in cmap.get(r["naics"], [])}:
            if r["bucket"] in DEFAULT_ADDRESSABLE:
                t[ag][cat] += r["obligations"]
        tot[ag] += r["obligations"]
        if r["bucket"] == "GSA MAS":
            mas[ag] += r["obligations"]
    hdr(ws, 4, ["Funding agency"] + cats + ["Addressable, all categories*", "MAS share of agency's spend"],
        widths=[40] + [13] * (len(cats) + 2))
    agencies = sorted(t, key=lambda a: -sum(t[a].values()))[:40]
    for i, ag in enumerate(agencies, start=5):
        ws.cell(row=i, column=1, value=ag)
        for j, cat in enumerate(cats, start=2):
            ws.cell(row=i, column=j, value=t[ag].get(cat, 0.0)).number_format = M
        ws.cell(row=i, column=2 + len(cats), value=f"=SUM(B{i}:{L(1 + len(cats))}{i})").number_format = M
        ws.cell(row=i, column=3 + len(cats), value=mas[ag] / tot[ag] if tot[ag] else None).number_format = P
    last = 4 + len(agencies)
    box(ws, f"A5:A{last}")
    note(ws, f"A{last + 2}", "*A NAICS mapped to SINs in two categories counts in both, so the all-categories column can "
                             "exceed the agency's true addressable total. MAS share is over all pulled NAICS.")
    ws.freeze_panes = "B5"



# ---------------------------------------------------------------------------
# MAS lane: award-size bands where MAS competes (OASIS+ and agency vehicles take larger work)
# ---------------------------------------------------------------------------

SERVICE_CATS = {"Professional Services", "Information Technology"}
TIER_TEXT = {1: "1 - Incumbent already on MAS", 2: "2 - Open market (no vehicle)", 3: "3 - Agency vehicle"}


def lane_for(cat, args):
    if cat in SERVICE_CATS:
        return args.svc_floor, args.svc_ceiling
    return args.floor, args.ceiling


def window_obl(a, fys):
    vals = [float(a.get(f"obl_fy{y}") or 0) for y in fys]
    active = sum(1 for v in vals if v > 0) or 1
    return sum(vals), sum(vals) / active


def award_categories(a, cmap):
    return sorted({c for c, _, _ in cmap.get(a["naics"], [])})


def tab_lane(wb, top, agg, awards, fys, args):
    ws = wb.create_sheet("MAS Lane")
    title(ws, "The market MAS can realistically win: awards inside the MAS size lane",
          f"Lane = awards with FY{fys[0]}-FY{fys[-1]} obligations up to ${args.svc_ceiling / 1e6:,.0f}M for Professional "
          f"Services and IT (larger work goes to OASIS+ and agency IDIQs) and up to ${args.ceiling / 1e6:,.0f}M for other "
          "categories. Excludes M&O contracts, weapon programs, and enterprise deals. Default addressable vehicles.")
    cmap = category_of(top)
    cats = sorted({r["category"] for r in top})
    mas = defaultdict(float)
    gsa_other = defaultdict(float)
    for r in agg:
        for c in {c for c, _, _ in cmap.get(r["naics"], [])}:
            if r["bucket"] == "GSA MAS":
                mas[(c, r["segment"])] += r["obligations"]
            elif r["bucket"] == "GSA non-MAS (GWAC, OASIS+, other)":
                gsa_other[(c, r["segment"])] += r["obligations"]
    lane = defaultdict(lambda: defaultdict(float))
    for a in awards:
        if a["bucket"] not in DEFAULT_ADDRESSABLE:
            continue
        tot, _ = window_obl(a, fys)
        if tot <= 0:
            continue
        for c in award_categories(a, cmap):
            _, ceiling = lane_for(c, args)
            s = lane[(c, a["segment"])]
            if tot <= ceiling:
                s["in"] += tot
                s["in_n"] += 1
                s["in_open" if a["bucket"] == "Open market" else "in_idv"] += tot
            else:
                s["above"] += tot
                s["above_n"] += 1
    heads = ["Category", "Segment", "Lane ceiling", "GSA MAS", "In-lane addressable", "In-lane awards",
             "  of which open market", "  of which agency vehicles", "MAS share of lane market",
             "Above-lane addressable", "Above-lane awards", "Other GSA vehicles (GWAC, OASIS+)"]
    hdr(ws, 4, heads, widths=[30, 10, 11, 13, 14, 10, 14, 14, 12, 14, 10, 15])
    r = 5
    for c in cats:
        for seg in ("Civilian", "DoD"):
            s = lane[(c, seg)]
            vals = [c, seg, lane_for(c, args)[1], mas[(c, seg)], s["in"], int(s["in_n"]), s["in_open"], s["in_idv"],
                    None, s["above"], int(s["above_n"]), gsa_other[(c, seg)]]
            for j, v in enumerate(vals, start=1):
                ws.cell(row=r, column=j, value=v)
            ws.cell(row=r, column=9, value=f'=IF((D{r}+E{r})>0,D{r}/(D{r}+E{r}),"")')
            r += 1
    last = r - 1
    ws.cell(row=r, column=1, value="All categories")
    for col in "DEFGHJKL":
        ws[f"{col}{r}"] = f"=SUM({col}5:{col}{last})"
    ws[f"I{r}"] = f'=IF((D{r}+E{r})>0,D{r}/(D{r}+E{r}),"")'
    box(ws, f"A5:L{r}")
    for i in range(5, r + 1):
        for col in "CDEGHJL":
            ws[f"{col}{i}"].number_format = M
        ws[f"I{i}"].number_format = P
    for col in range(1, 13):
        ws.cell(row=r, column=col).font = f(bold=True)
    note(ws, f"A{r + 2}", "MAS dollars are all MAS orders in the category's NAICS (MAS orders are rarely above the lane). "
                          "A NAICS mapped to two categories counts in both; the All row can overstate.")
    ws.freeze_panes = "C5"
    return {"first": 5, "last": last, "total": r}


def build_targets(top, awards, mas_vendors, fys, as_of, horizon_end, args):
    cmap = category_of(top)
    out = []
    for a in awards:
        if a["bucket"] not in DEFAULT_ADDRESSABLE:
            continue
        try:
            end_d = datetime.strptime((a.get("pop_current_end") or "")[:10], "%Y-%m-%d").date()
        except ValueError:
            continue
        if not (as_of <= end_d <= horizon_end):
            continue
        cats = cmap.get(a["naics"], [])
        if not cats:
            continue
        cat, rank, sin = sorted(cats, key=lambda x: x[1])[0]
        tot, per_year = window_obl(a, fys)
        floor, ceiling = lane_for(cat, args)
        if not (floor <= tot <= ceiling):
            continue
        inc = a.get("recipient_uei") in mas_vendors.get(a["naics"], set())
        tier = 1 if inc else (2 if a["bucket"] == "Open market" else 3)
        out.append({"cat": cat, "sin": sin, "end": end_d, "tot": tot, "per_year": per_year, "tier": tier,
                    "inc": inc, "a": a})
    out.sort(key=lambda x: (x["cat"], x["tier"], -x["tot"]))
    return out


TARGET_HEADS = ["Category", "SIN", "Priority tier", "Current end", "Months to end", "Obligated FY24-26",
                "Average per active year", "Vehicle", "PIID", "Parent IDV", "NAICS", "PSC", "Funding agency",
                "Funding sub-agency", "Funding office (AAC)", "Funding office", "Contracting office (AAC)",
                "Contracting office", "Vendor", "Vendor UEI", "Incumbent on MAS", "Set-aside", "Extent competed",
                "Offers", "Single offer", "Potential end", "Description"]
TARGET_WIDTHS = [22, 10, 22, 11, 8, 14, 13, 18, 20, 18, 8, 7, 22, 24, 11, 28, 11, 28, 28, 14, 9, 9, 8, 7, 7, 11, 60]


def write_targets(wb, name, subtitle, rows, S):
    ws = wb.create_sheet(name)
    title(ws, name, subtitle)
    hdr(ws, 4, TARGET_HEADS, widths=TARGET_WIDTHS)
    r = 5
    for t in rows:
        a = t["a"]
        offers = a.get("offers") or ""
        vals = [t["cat"], t["sin"], TIER_TEXT[t["tier"]], t["end"], None, t["tot"], t["per_year"], a["bucket"],
                a["piid"], a.get("parent_piid", ""), a["naics"], a.get("psc"), a.get("funding_agency"),
                a.get("funding_sub_agency"), a.get("funding_office_code"), a.get("funding_office_name"),
                a.get("awarding_office_code"), a.get("awarding_office_name"), a.get("recipient"), a.get("recipient_uei"),
                "Yes" if t["inc"] else "No", a.get("set_aside"), a.get("extent_competed"), offers,
                "Yes" if str(offers).strip() in ("1", "1.0") else "", (a.get("pop_potential_end") or "")[:10],
                a.get("description")]
        for j, v in enumerate(vals, start=1):
            ws.cell(row=r, column=j, value=v)
        ws.cell(row=r, column=5, value=f'=ROUND((D{r}-{S["asof"]})/30.4,0)')
        r += 1
    last = r - 1
    if last >= 5:
        for i in range(5, last + 1):
            ws[f"D{i}"].number_format = "yyyy-mm-dd"
            ws[f"F{i}"].number_format = D
            ws[f"G{i}"].number_format = D
    ws.freeze_panes = "D5"
    ws.auto_filter.ref = f"A4:{L(len(TARGET_HEADS))}{max(last, 5)}"
    return last - 4


def tab_lane_funders(wb, top, agg, awards, targets, fys, args):
    ws = wb.create_sheet("Top Funders")
    title(ws, "Top funding offices (AAC) by in-lane addressable spend, by category and segment",
          "In-lane = awards inside the MAS size lane (see MAS Lane). Top 25 offices per category for Civilian and for DoD.")
    cmap = category_of(top)
    mas = defaultdict(float)
    for r in agg:
        if r["bucket"] == "GSA MAS":
            for c in {c for c, _, _ in cmap.get(r["naics"], [])}:
                mas[(c, r["segment"], r["funding_office_code"] or "(none)")] += r["obligations"]
    st = defaultdict(lambda: defaultdict(float))
    meta = {}
    for a in awards:
        if a["bucket"] not in DEFAULT_ADDRESSABLE:
            continue
        tot, _ = window_obl(a, fys)
        if tot <= 0:
            continue
        for c in award_categories(a, cmap):
            if tot > lane_for(c, args)[1]:
                continue
            k = (c, a["segment"], a.get("funding_office_code") or "(none)")
            meta.setdefault(k, (a.get("funding_agency"), a.get("funding_sub_agency"), a.get("funding_office_name")))
            s = st[k]
            s["lane"] += tot
            s["n"] += 1
            s["open" if a["bucket"] == "Open market" else "idv"] += tot
            for y in fys:
                s[f"y{y}"] += float(a.get(f"obl_fy{y}") or 0)
            s["ko:" + (a.get("awarding_office_code") or "")] += tot
    tcount = defaultdict(lambda: [0, 0])
    for t in targets:
        k = (t["cat"], t["a"]["segment"], t["a"].get("funding_office_code") or "(none)")
        tcount[k][0] += 1
        tcount[k][1] += 1 if t["tier"] == 1 else 0
    heads = ["Category", "Segment", "Rank", "Funding office (AAC)", "Office name", "Agency", "Sub-agency",
             "In-lane addressable", "In-lane awards", "Open market", "Agency vehicles", "GSA MAS", "MAS share",
             "Targets ending in 18 months", "  of which incumbent on MAS"] + [f"In-lane FY{y}" for y in fys] +             ["Main contracting office (AAC)"]
    hdr(ws, 4, heads, widths=[24, 9, 6, 12, 32, 24, 26, 13, 9, 12, 12, 12, 9, 10, 10] + [12] * len(fys) + [14])
    r = 5
    for c in sorted({k[0] for k in st}):
        for seg in ("Civilian", "DoD"):
            keys = sorted([k for k in st if k[0] == c and k[1] == seg], key=lambda k: -st[k]["lane"])[:args.top_offices]
            for rank, k in enumerate(keys, start=1):
                s, m = st[k], meta[k]
                ko = max(((kk.split(":", 1)[1], v) for kk, v in s.items() if kk.startswith("ko:")),
                         key=lambda x: x[1], default=("", 0))[0]
                vals = [c, seg, rank, k[2], m[2], m[0], m[1], s["lane"], int(s["n"]), s["open"], s["idv"],
                        mas.get(k, 0.0), None, tcount[k][0], tcount[k][1]] + [s[f"y{y}"] for y in fys] + [ko]
                for j, v in enumerate(vals, start=1):
                    ws.cell(row=r, column=j, value=v)
                ws.cell(row=r, column=13, value=f'=IF((H{r}+L{r})>0,L{r}/(H{r}+L{r}),"")')
                r += 1
    last = r - 1
    if last >= 5:
        for i in range(5, last + 1):
            for col in ["H", "J", "K", "L"] + [L(16 + j) for j in range(len(fys))]:
                ws[f"{col}{i}"].number_format = M
            ws[f"M{i}"].number_format = P
    ws.freeze_panes = "E5"
    ws.auto_filter.ref = f"A4:{L(len(heads))}{max(last, 5)}"


def tab_priority(wb, targets, S, n):
    picked = []
    seen = defaultdict(int)
    for t in targets:  # already sorted by category, tier, size
        k = (t["cat"], t["a"]["segment"])
        if seen[k] < n:
            picked.append(t)
            seen[k] += 1
    picked.sort(key=lambda t: (t["a"]["segment"], t["cat"], t["tier"], -t["tot"]))
    return write_targets(wb, "Priority Targets",
                         f"Top {n} per category for Civilian and for DoD: incumbents already on MAS first, then open "
                         "market, then agency vehicles; largest first within each tier.", picked, S)


def summary_lane(ws, row, lane_info, targets, cats):
    ws.cell(row=row, column=1, value="The MAS lane: awards sized for MAS (see MAS Lane tab)").font = f(bold=True, size=11, color="1F3864")
    heads = ["Large category", "Civilian lane market", "Civilian MAS share", "DoD lane market", "DoD MAS share",
             "Civilian targets", "  incumbent on MAS", "DoD targets", "  incumbent on MAS"]
    hdr(ws, row + 1, heads)
    cnt = defaultdict(lambda: [0, 0])
    for t in targets:
        k = (t["cat"], t["a"]["segment"])
        cnt[k][0] += 1
        cnt[k][1] += 1 if t["tier"] == 1 else 0
    r = row + 2
    for n, cat in enumerate(cats):
        i = lane_info["first"] + 2 * n  # Civilian row; DoD is the next row
        ws.cell(row=r, column=1, value=f"='MAS Lane'!A{i}")
        ws.cell(row=r, column=2, value=f"='MAS Lane'!D{i}+'MAS Lane'!E{i}").number_format = M
        ws.cell(row=r, column=3, value=f"='MAS Lane'!I{i}").number_format = P
        ws.cell(row=r, column=4, value=f"='MAS Lane'!D{i + 1}+'MAS Lane'!E{i + 1}").number_format = M
        ws.cell(row=r, column=5, value=f"='MAS Lane'!I{i + 1}").number_format = P
        for j, v in enumerate([cnt[(cat, "Civilian")][0], cnt[(cat, "Civilian")][1], cnt[(cat, "DoD")][0],
                               cnt[(cat, "DoD")][1]], start=6):
            ws.cell(row=r, column=j, value=v).number_format = "#,##0"
        r += 1
    t = lane_info["total"]
    ws.cell(row=r, column=1, value="All categories")
    for j, col in ((2, "B"), (4, "D"), (6, "F"), (7, "G"), (8, "H"), (9, "I")):
        ws.cell(row=r, column=j, value=f"=SUM({col}{row + 2}:{col}{r - 1})").number_format = "#,##0" if j > 5 else M
    box(ws, f"A{row + 2}:I{r}")
    for rr in range(row + 2, r + 1):
        for j, fmt in ((2, M), (3, P), (4, M), (5, P)):
            ws.cell(row=rr, column=j).number_format = fmt
        for j in range(6, 10):
            ws.cell(row=rr, column=j).number_format = "#,##0"
        for j in (1, 2, 3, 4, 5):
            ws.cell(row=rr, column=j).font = f(color=GREEN, bold=(rr == r))
    for j in range(1, 10):
        ws.cell(row=r, column=j).font = f(bold=True, color=GREEN if j <= 5 else "000000")
    return r


def tab_summary(wb, cm, top, n_targets, fys, as_of, S, bpa, lane_info=None, targets=(), cats=()):
    ws = wb["Summary"]
    title(ws, "MAS Market Map: open market vs MAS vs other vehicles",
          f"Top {max(int(r['rank']) for r in top)} SINs by MAS sales in each large category; FPDS obligations "
          f"FY{fys[0]}-FY{fys[-1]} in their NAICS. Prepared {as_of:%b %d, %Y}.")
    ws.column_dimensions["A"].width = 32
    ws["A3"] = "Current view:"
    ws["B3"] = f'="Segment: "&{S["seg_val"]}&"   FY: "&{S["fy_val"]}'
    ws["A3"].font = f(bold=True)
    ws["B3"].font = f(color=GREEN)
    cols = cm["cols"]
    show = [("Total market", "Total"), ("GSA MAS", "GSA MAS"), ("Other GSA vehicles", "GSA non-MAS (GWAC, OASIS+, other)"),
            ("Open market", "Open market"), ("Agency IDIQ / BOA", "Agency IDIQ / BOA"), ("Addressable", "Addressable"),
            ("MAS share", "MAS share"), ("Addressable share", "Addressable share")]
    hdr(ws, 5, ["Large category"] + [s[0] for s in show], widths=[32] + [14] * len(show))
    end = cm["total"] + 1
    for i in range(6, end + 1):
        src = i - 1  # Category Map data starts on row 5
        ws.cell(row=i, column=1, value=f"='Category Map'!A{src}")
        for j, (_, key) in enumerate(show, start=2):
            ws.cell(row=i, column=j, value=f"='Category Map'!{L(cols[key])}{src}")
    box(ws, f"A6:{L(1 + len(show))}{end}")
    for i in range(6, end + 1):
        for j, (_, key) in enumerate(show, start=2):
            ws.cell(row=i, column=j).number_format = P if "share" in key else M
            ws.cell(row=i, column=j).font = f(color=GREEN, bold=(i == end))
        ws.cell(row=i, column=1).font = f(color=GREEN, bold=(i == end))
    ws.cell(row=end + 1, column=1, value="Total market includes management-and-operating contracts, weapon programs, and "
            "enterprise deals that MAS will not compete for. The MAS lane below is the realistic view.").font = f(italic=True, size=9, color="595959")
    end = summary_lane(ws, end + 3, lane_info, targets, cats) if lane_info else end
    r0 = end + 2
    ws.cell(row=r0, column=1, value="Findings").font = f(bold=True, size=11, color="1F3864")
    ws.cell(row=r0 + 1, column=1, value="To be written after reviewing the data. See Top Funders and Targets for the opportunity lists.")
    ws.cell(row=r0 + 1, column=1).font = f(italic=True)
    ws.cell(row=r0 + 3, column=1, value="Conversion targets listed (Civilian / DoD)").font = f(bold=True)
    ws.cell(row=r0 + 3, column=2, value=n_targets)
    resolved = sum(1 for v in bpa.values() if v.get("found"))
    ws.cell(row=r0 + 4, column=1, value="BPAs traced to a parent vehicle").font = f(bold=True)
    ws.cell(row=r0 + 4, column=2, value=resolved)
    ws.cell(row=r0 + 6, column=1, value="Tabs").font = f(bold=True, size=11, color="1F3864")
    tabs = [("Settings", "Addressable definition, segment, and FY selectors"),
            ("Category Map", "Market by large category (NAICS counted once per category), with chart"),
            ("SIN Map", "Each top SIN: MAS sales (SSQ+) next to its FPDS market by vehicle"),
            ("NAICS Market", "Each NAICS once, by vehicle"),
            ("MAS Lane", "Market inside the MAS size lane, by category and segment, vs above-lane work"),
            ("Top Funders", "Top 25 funding offices (AAC) per category and segment by in-lane spend"),
            ("Priority Targets", "Top 25 targets per category and segment, incumbents on MAS first"),
            ("Targets Civilian", "Every in-lane civilian non-MAS award ending in the next 18 months"),
            ("Targets DoD", "Same for DoD"),
            ("Trends", "MAS share and addressable spend by year"),
            ("Agency View", "Addressable spend by funding agency and category"),
            ("Data", "Obligations by NAICS, FY, segment, vehicle"),
            ("Method", "Sources, classification rules, caveats")]
    for i, (t, d) in enumerate(tabs, start=r0 + 7):
        ws.cell(row=i, column=1, value=t).font = f(bold=True)
        ws.cell(row=i, column=2, value=d).font = f()
    ws.sheet_view.showGridLines = False


def tab_method(wb, fys, as_of):
    ws = wb.create_sheet("Method")
    title(ws, "Method and caveats")
    ws.column_dimensions["A"].width = 140
    lines = [
        f"Market: USAspending contract transactions (award types A-D) for FY{fys[0]}-FY{fys[-1]}, one pull per NAICS, "
        "for every NAICS mapped to a top SIN.",
        "SIN ranking: SSQ+ reported MAS sales by large category and SIN, summed across the window; state/local and "
        "disaster-recovery SIN suffixes folded into the base SIN. SINs with no NAICS equivalent (OLM, Ancillary) skipped.",
        "SIN to NAICS: the SIN number where it is a NAICS code (2017 codes remapped to 2022); 54151S, HACS, Health IT, "
        "and 33411 expanded to their 6-digit NAICS; naics_overrides.csv corrections applied.",
        "Vehicle: from the referenced IDV. Parent FSS with a GS/47Q PIID = GSA MAS; other FSS = VA FSS; GWAC with a GSA "
        "PIID = GSA non-MAS, other GWAC = Other agency GWAC; other GSA IDVs (OASIS/OASIS+) = GSA non-MAS; other IDIQs and "
        "BOAs = Agency IDIQ/BOA; no parent = Open market.",
        "BPA calls: re-bucketed by the BPA's own parent (USAspending award record). BPAs below the lookup threshold "
        "remain 'BPA (parent unresolved)'.",
        "Segment: DoD where the funding agency is the Department of Defense; otherwise Civilian.",
        "NAICS is assigned per award by the contracting officer, so MAS orders under a SIN can carry a different NAICS. "
        "Market totals by NAICS approximate, not equal, the SIN's market.",
        "SSQ+ sales (reported at invoicing) and FPDS obligations (recorded at award) measure different events; compare "
        "them as orders of magnitude, not to the dollar.",
        "MAS lane: awards whose FY2024-FY2026 obligations fall at or under the lane ceiling ($10M for Professional "
        "Services and IT, where larger work goes to OASIS+ and agency IDIQs; $25M otherwise). Floors for targets: $100K "
        "PS/IT, $50K otherwise. All are command-line options on build_workbook.py.",
        f"Targets: in-lane addressable awards whose current period of performance ends between {as_of:%b %d, %Y} and 18 "
        "months later. Tier 1 = vendor already receives MAS orders in that NAICS; tier 2 = open market; tier 3 = agency "
        "vehicle. Current end dates move with option exercises; verify each in FPDS before outreach.",
        "Award size is total obligations in the window, not contract ceiling. USAspending's base-and-all-options field is "
        "reported per modification, so it is not used.",
        "Incumbent on MAS: the vendor's UEI received GSA MAS orders in the same NAICS in the window. It is a pointer to "
        "check eLibrary, not proof the vendor's MAS contract covers the requirement.",
    ]
    for i, t in enumerate(lines, start=3):
        ws.cell(row=i, column=1, value=t).alignment = Alignment(wrap_text=True, vertical="top")
        ws.cell(row=i, column=1).font = f()
        ws.row_dimensions[i].height = 30


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--as-of", default=str(date.today()))
    ap.add_argument("--horizon-months", type=int, default=18)
    ap.add_argument("--svc-floor", type=float, default=100000, help="Professional Services and IT target floor")
    ap.add_argument("--svc-ceiling", type=float, default=10000000, help="PS and IT lane ceiling (OASIS+ above)")
    ap.add_argument("--floor", type=float, default=50000, help="Target floor, other categories")
    ap.add_argument("--ceiling", type=float, default=25000000, help="Lane ceiling, other categories")
    ap.add_argument("--top-offices", type=int, default=25)
    ap.add_argument("--priority-n", type=int, default=25)
    ap.add_argument("--out", default=str(WORK / "MAS_Market_Map.xlsx"))
    args = ap.parse_args()
    as_of = datetime.strptime(args.as_of, "%Y-%m-%d").date()
    y, m = as_of.year, as_of.month + args.horizon_months
    y, m = y + (m - 1) // 12, (m - 1) % 12 + 1
    horizon_end = date(y, m, min(as_of.day, 28))

    top, agg, awards, mas_vendors, bpa = load(args)
    fys = sorted({int(r["fy"]) for r in agg if r["fy"]})
    wb = Workbook()
    wb.active.title = "Summary"
    S = tab_settings(wb, fys)
    S["flags"] = S["flags"]
    ws = wb["Settings"]
    c = ws.cell(row=S["asof_row"], column=2, value=as_of)
    c.number_format = "yyyy-mm-dd"
    c.font = f(color=BLUE, bold=True)
    c.fill = YELLOW
    c.border = BOX
    rng = tab_data(wb, agg)
    cm = tab_category(wb, top, rng, S)
    tab_sin(wb, top, rng, S, fys)
    tab_naics(wb, top, rng, S)
    cats = sorted({r["category"] for r in top})
    lane_info = tab_lane(wb, top, agg, awards, fys, args)
    targets = build_targets(top, awards, mas_vendors, fys, as_of, horizon_end, args)
    tab_lane_funders(wb, top, agg, awards, targets, fys, args)
    tab_priority(wb, targets, S, args.priority_n)
    sub = (f"In-lane, addressable awards ending {as_of:%b %d, %Y} to {horizon_end:%b %d, %Y}. Lane: "
           f"${args.svc_floor / 1e3:,.0f}K-${args.svc_ceiling / 1e6:,.0f}M for PS and IT, "
           f"${args.floor / 1e3:,.0f}K-${args.ceiling / 1e6:,.0f}M otherwise (FY{fys[0]}-FY{fys[-1]} obligations). "
           "Sorted by category, tier, size.")
    n_civ = write_targets(wb, "Targets Civilian", sub, [t for t in targets if t["a"]["segment"] == "Civilian"], S)
    n_dod = write_targets(wb, "Targets DoD", sub, [t for t in targets if t["a"]["segment"] == "DoD"], S)
    n_targets = f"{n_civ:,} / {n_dod:,}"
    tab_trends(wb, top, agg, fys)
    tab_agency(wb, top, agg)
    tab_method(wb, fys, as_of)
    tab_summary(wb, cm, top, n_targets, fys, as_of, S, bpa, lane_info, targets, cats)
    order = ["Summary", "Settings", "Category Map", "MAS Lane", "SIN Map", "NAICS Market", "Top Funders",
             "Priority Targets", "Targets Civilian", "Targets DoD", "Trends", "Agency View", "Data", "Method"]
    wb._sheets = [wb[n] for n in order]
    wb.save(args.out)
    print(args.out, f"{n_targets} targets")


if __name__ == "__main__":
    main()
