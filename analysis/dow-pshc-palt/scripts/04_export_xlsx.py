"""Build the analysis workbook (Summary tab driven by formulas over the data tabs).
Usage: python3 -I 04_export_xlsx.py <output_dir> <xlsx_path>
"""
import sys, os
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

OUT, XLSX = sys.argv[1], sys.argv[2]
import json
LATEST = json.load(open(os.path.join(OUT, "summary.json")))["latest_action_date_published"]
rd = lambda f, **k: pd.read_csv(os.path.join(OUT, f), **k)

F = "Arial"
HDR_FILL = PatternFill("solid", start_color="1F3A5F")
HDR_FONT = Font(name=F, bold=True, color="FFFFFF", size=10)
BODY = Font(name=F, size=10)
BOLD = Font(name=F, size=10, bold=True)
NOTE = Font(name=F, size=9, italic=True, color="555555")
LINK = Font(name=F, size=10, color="008000")
KEY_FILL = PatternFill("solid", start_color="EAF1FB")
thin = Side(style="thin", color="C9D1DB")

wb = Workbook()
wb.remove(wb.active)

VEH_NAMES = {
    "N0017818R7000": ("SeaPort-NxG", "Yes"), "W52P1J16R0001": ("LOGCAP V (contingency logistics)", "No"),
    "W15P7T15R0008": ("RS3", "Yes"), "H9240019R0003": ("SOF Core Support", "Yes"),
    "N0017821R7000": ("SeaPort-NxG rolling admission", "Yes"),
    "N0002324R0001": ("Probable WEXMAC 2.0 (expeditionary logistics; verify)", "No"),
}

def write_df(ws, df, start_row=1, notes=None, numfmt=None):
    for j, c in enumerate(df.columns, 1):
        cell = ws.cell(row=start_row, column=j, value=str(c))
        cell.font, cell.fill = HDR_FONT, HDR_FILL
        cell.alignment = Alignment(wrap_text=True, vertical="center")
    for i, row in enumerate(df.itertuples(index=False), start_row + 1):
        for j, v in enumerate(row, 1):
            if isinstance(v, float) and pd.isna(v):
                v = None
            cell = ws.cell(row=i, column=j, value=v)
            cell.font = BODY
            if numfmt and df.columns[j - 1] in numfmt:
                cell.number_format = numfmt[df.columns[j - 1]]
    ws.freeze_panes = ws.cell(row=start_row + 1, column=1)
    for j, c in enumerate(df.columns, 1):
        w = max([len(str(c))] + [len(str(x)) for x in df.iloc[:200, j - 1].tolist()])
        ws.column_dimensions[get_column_letter(j)].width = min(max(10, w + 2), 48)
    ws.row_dimensions[start_row].height = 30
    r = start_row + len(df) + 2
    for n in (notes or []):
        ws.cell(row=r, column=1, value=n).font = NOTE
        r += 1
    return start_row + len(df)

SRC = "Source: USASpending.gov API v2 (FPDS-sourced), pulled 2026-11-03; computed by scripts/03_analyze.py."

# ---------------- data tabs ----------------
t1 = rd("t1_spend_by_vehicle_fy_usd_millions.csv").rename(columns={"vehicle": "Vehicle type"})
t1.columns = ["Vehicle type"] + [f"FY{c}" if c.isdigit() else c for c in t1.columns[1:]]
ws = wb.create_sheet("Spend by Vehicle")
write_df(ws, t1, notes=["Obligations in $ millions, all transactions (base awards and modifications). DoD-awarded; PSC families R, B, U.",
                        "Open market = stand-alone definitive contracts and purchase orders with no referenced IDV (a floor estimate of OMB Tier 0).", SRC],
         numfmt={c: '#,##0.0;(#,##0.0);-' for c in t1.columns[1:]})

t2 = rd("t2_spend_share_by_group_pct.csv")
t2["fy"] = "FY" + t2.fy.astype(str)
for c in t2.columns[1:]:
    t2[c] = t2[c] / 100
ws = wb.create_sheet("Spend Share")
write_df(ws, t2.rename(columns={"fy": "Fiscal year"}), notes=["Share of DoD PSHC obligations by group.", SRC],
         numfmt={c: "0.0%" for c in t2.columns[1:]})

raw = rd("t3_solicitation_date_coverage.csv", header=[0, 1], index_col=0)
raw = raw[raw.index.notna() & (raw.index != "fy")]
t3 = pd.DataFrame({"Fiscal year": ["FY" + str(i) for i in raw.index]})
for metric, lab in [("new_awards", "New awards"), ("with_solicitation_date", "With solicitation date")]:
    for g in ["GSA MAS", "Open market (Tier 0 proxy)", "Other vehicles"]:
        t3[f"{lab}: {g}"] = raw[(metric, g)].astype(float).astype(int).values
ws = wb.create_sheet("Sol Date Coverage")
end = write_df(ws, t3, notes=["Coverage % = with solicitation date / new awards (formula columns to the right).", SRC])
for k, g in enumerate(["GSA MAS", "Open market", "Other vehicles"]):
    col = 8 + k
    ws.cell(row=1, column=col, value=f"Coverage: {g}").font = HDR_FONT
    ws.cell(row=1, column=col).fill = HDR_FILL
    ws.column_dimensions[get_column_letter(col)].width = 18
    for r in range(2, end + 1):
        c = ws.cell(row=r, column=col, value=f"=IF({get_column_letter(2+k)}{r}=0,\"\",{get_column_letter(5+k)}{r}/{get_column_letter(2+k)}{r})")
        c.number_format, c.font = "0.0%", BODY

t4 = rd("t4_palt_raw_by_vehicle.csv")
ws = wb.create_sheet("PALT Raw by Vehicle")
write_df(ws, t4, notes=["PALT = award date minus solicitation date (days), new awards (mod 0) with a valid date, 0-1,095 days.", SRC],
         numfmt={"n": "#,##0", "obligated_usd_m_at_award": "#,##0.0"})

t5 = rd("t5_palt_raw_by_group_value_band.csv")
ws = wb.create_sheet("PALT Raw by Band")
write_df(ws, t5, notes=["Raw (unmatched) PALT by group and dollar band (base and all options value at award).", SRC])

t5b = rd("t5b_median_palt_by_fy_group.csv"); t5b["fy"] = "FY" + t5b.fy.astype(str)
ws = wb.create_sheet("PALT Median by FY")
write_df(ws, t5b, notes=["Raw median PALT (days) by fiscal year and group.", SRC])

t6 = rd("t6_like_for_like_palt.csv")
ws = wb.create_sheet("Matched OM vs MAS")
write_df(ws, t6, notes=["Coarsened exact matching; differences weighted by MAS count per stratum; 95% CI from 500-draw within-stratum bootstrap (seed 20261103).",
                        "Positive values = open market took longer than MAS.", SRC])

t6b = rd("t6b_like_for_like_palt_by_band.csv")
ws = wb.create_sheet("Matched by Band")
write_df(ws, t6b, notes=["Same matched design run within each dollar band and competition status. >$100M row has 3 MAS awards; do not cite.", SRC])

t6c = rd("t6c_population_mix.csv")
ws = wb.create_sheet("Population Mix")
write_df(ws, t6c, notes=["Explains why raw medians look similar: open market is mostly non-competed.", SRC],
         numfmt={"competed_share": "0.0%", "fixed_price_share": "0.0%", "above_sat_share": "0.0%", "median_value": "$#,##0"})

t7 = rd("t7_top_psc_open_market_vs_mas_obligations.csv")
for c in ["GSA MAS", "Open market (Tier 0 proxy)", "Other vehicles"]:
    t7[c] = t7[c] / 1e6
t7 = t7.drop(columns=["mas_share_pct"])
ws = wb.create_sheet("Top PSCs")
end = write_df(ws, t7.rename(columns={"GSA MAS": "GSA MAS ($M)", "Open market (Tier 0 proxy)": "Open market ($M)", "Other vehicles": "Other vehicles ($M)"}),
               notes=["Top 40 PSCs by open-market obligations, FY20-26. MAS share is a formula.", SRC],
               numfmt={"GSA MAS ($M)": "#,##0.0", "Open market ($M)": "#,##0.0", "Other vehicles ($M)": "#,##0.0"})
ws.cell(row=1, column=6, value="MAS share").font = HDR_FONT; ws.cell(row=1, column=6).fill = HDR_FILL
for r in range(2, end + 1):
    c = ws.cell(row=r, column=6, value=f"=IF(SUM(C{r}:E{r})=0,\"\",C{r}/SUM(C{r}:E{r}))"); c.number_format, c.font = "0.0%", BODY

t8 = rd("t8_dod_mac_families_top25.csv")
t8.insert(1, "program_name", t8.sol_id.map(lambda s: VEH_NAMES.get(s, ("", ""))[0]))
ws = wb.create_sheet("DoD MAC Families")
write_df(ws, t8, notes=["Families = DoD-owned multiple-award IDCs grouped by solicitation identifier. Dates from the IDV records in FPDS.",
                        "Program names given only where a public source confirms the solicitation number; others verifiable on SAM.gov by solicitation number.", SRC])

t9 = rd("t9_like_for_like_dod_mac_vs_mas.csv")
ws = wb.create_sheet("Matched MAC vs MAS")
write_df(ws, t9, notes=["DoD MAC orders whose solicitation date precedes the parent IDV award are excluded.", SRC])

t10 = rd("t10_vehicle_standup_vs_mas.csv")
t10.insert(1, "program_name", t10.sol_id.map(lambda s: VEH_NAMES.get(s, ("", ""))[0]))
t10.insert(2, "mas_substitutable", t10.sol_id.map(lambda s: VEH_NAMES.get(s, ("", "Unassessed"))[1]))
t10.insert(3, "identifiable", t10.sol_id.map(lambda s: "No" if s.startswith("UNKNOWN") else "Yes"))
ws = wb.create_sheet("Vehicle Stand-up")
end = write_df(ws, t10, notes=["Stand-up days = first IDV award date minus IDV solicitation date (FPDS). Excludes draft RFPs, RFIs and industry days, so it understates development time.",
                               "Columns T-U are formula helpers feeding the Summary tab medians.", SRC])
cols = {c: get_column_letter(i + 1) for i, c in enumerate(t10.columns)}
for k, (lab, cond) in enumerate([("Stand-up days (identifiable)", f'{cols["identifiable"]}{{r}}="Yes"'),
                                 ("Stand-up days (identifiable, excl. logistics)", f'AND({cols["identifiable"]}{{r}}="Yes",{cols["mas_substitutable"]}{{r}}<>"No")')]):
    col = len(t10.columns) + 1 + k
    ws.cell(row=1, column=col, value=lab).font = HDR_FONT; ws.cell(row=1, column=col).fill = HDR_FILL
    ws.column_dimensions[get_column_letter(col)].width = 22
    for r in range(2, end + 1):
        ws.cell(row=r, column=col, value=f'=IF({cond.format(r=r)},{cols["vehicle_palt_days_fpds"]}{r},"")').font = BODY
HELP1, HELP2 = get_column_letter(len(t10.columns) + 1), get_column_letter(len(t10.columns) + 2)
VEH_END = end

t11 = rd("t11_gsa_assisted_dod_funded_usd_millions.csv")
t11.columns = ["Vehicle"] + [f"FY{c}" for c in t11.columns[1:]]
ws = wb.create_sheet("GSA Assisted")
end11 = write_df(ws, t11, notes=["GSA-awarded, DoD-funded PSHC actions ($M). Not included in the DoD-awarded totals.", SRC],
                 numfmt={c: "#,##0.0" for c in t11.columns[1:]})
GTC = len(t11.columns) + 1; GT = get_column_letter(GTC)
ws.cell(row=1, column=GTC, value="FY20-26 total").font = HDR_FONT; ws.cell(row=1, column=GTC).fill = HDR_FILL
for r in range(2, end11 + 1):
    c = ws.cell(row=r, column=GTC, value=f"=SUM(B{r}:{get_column_letter(GTC-1)}{r})"); c.number_format, c.font = "#,##0.0", BODY

rec = rd("r1_record_level_palt_mas_and_open_market.csv.gz")
rec["competed"] = rec.competed.map({True: "Yes", False: "No"})
ws = wb.create_sheet("Records")
write_df(ws, rec, notes=[], numfmt={"value": "$#,##0"})
REC_N = len(rec)

# ---------------- Definitions & Sources ----------------
ws = wb.create_sheet("Definitions")
defs = [
    ("Term", "Definition used", "FPDS / USASpending field"),
    ("DoD / DoW", "Awarding toptier agency = Department of Defense (097). 'Department of War' is the secondary title under EO 14347 (Sept. 2025).", "awarding agency filter"),
    ("PSHC scope (proxy)", "PSC families R (professional/administrative/management support), B (special studies/analyses), U (education/training). Not GSA's official category crosswalk.", "product_or_service_code"),
    ("PALT", "Solicitation issue date to award date, initial action (mod 0). FY2019 NDAA sec. 878; OFPP memo of Jan. 14, 2021.", "action_date - solicitation_date"),
    ("GSA MAS", "Orders whose referenced IDV type is FSS, plus BPA calls under BPAs whose parent is FSS.", "parent_award_type_code = C; BPA lookup"),
    ("Open market (Tier 0 floor)", "Stand-alone definitive contracts and POs with no referenced IDV. A subset of OMB Tier 0; official Tier 0 also includes unmanaged IDIQs.", "award_type_code B/D, no parent"),
    ("DoD-owned IDIQ", "Orders under IDCs whose referenced IDV agency is DoD (97xx), split multiple vs single award.", "parent_award_agency_id, parent_award_single_or_multiple_code"),
    ("Competed", "Stand-alone: Extent Competed A, D, F. Orders: Fair Opportunity FAIR or CSA.", "extent_competed_code, fair_opportunity_limited_sources_code"),
    ("Dollar band", "Base and all options value at award: <=SAT ($250K through FY2025; $350K from Oct. 1, 2025 per FAC 2025-06), SAT-1M, $1M-7.5M, $7.5M-25M, $25M-100M, >$100M.", "base_and_all_options_value"),
    ("Matched comparison", "Coarsened exact matching on 4-digit PSC x dollar band x FY x pricing family x competed; within-stratum median differences weighted by MAS count.", ""),
    ("Limitation: coverage", "Solicitation date is reported on 36-66% of new awards depending on group and year; missing dates are not imputed.", ""),
    ("Limitation: PALT window", "PALT excludes requirements development, market research and draft-RFP time.", ""),
    ("Limitation: exclusions", "782 PALT values over 3 years excluded; none negative. 18% of DoD MAC orders carry a solicitation date before the parent IDV award and are excluded from the MAC-vs-MAS comparison.", ""),
]
for i, row in enumerate(defs, 1):
    for j, v in enumerate(row, 1):
        c = ws.cell(row=i, column=j, value=v); c.alignment = Alignment(wrap_text=True, vertical="top")
        c.font = HDR_FONT if i == 1 else BODY
        if i == 1: c.fill = HDR_FILL
for col, w in zip("ABC", (26, 90, 40)): ws.column_dimensions[col].width = w

ws = wb.create_sheet("Sources")
srcs = [("Source", "URL"),
        ("USASpending.gov API v2 (data sourced from FPDS)", "https://api.usaspending.gov/docs/endpoints"),
        ("OFPP PALT memorandum, Jan. 14, 2021", "https://trumpwhitehouse.archives.gov/wp-content/uploads/2021/01/OFPPPALTMemorandum-01-14-2021.pdf"),
        ("FY2019 NDAA sec. 878 (PALT)", "https://wifcon.com/dodauth19/dod19_878.htm"),
        ("OMB SUM tier definitions (USAID CAP goal report)", "https://trumpadministration.archives.performance.gov/state/FY2021_january_Category_Management_USAID.pdf"),
        ("CRS IF12374, Small Business Contracting Under Category Management", "https://sgp.fas.org/crs/misc/IF12374.pdf"),
        ("NAVSEA: SeaPort-NxG solicitation (June 2018)", "https://www.navsea.navy.mil/Media/News/Article/1537907/seaport-next-generation-now-accepting-vendor-proposals/"),
        ("SeaPort-NxG award timing (Jan. 2019 release)", "https://www.aviationpros.com/aircraft-maintenance-technology/aircraft-technology/maintenance-providers/press-release/12440478/southeast-aerospace-southeast-aerospace-wins-opportunity-on-50b-seaport-next-generation-contract"),
        ("RS3 draft RFP (Dec. 2014)", "https://www.washingtontechnology.com/2014/12/army-releases-draft-rfp-for-37b-idiq/346268/"),
        ("RS3 first awards (May 2017)", "https://washingtonexec.com/2017/06/nci-earns-prime-position-37b-army-multiple-award-contract/"),
        ("RS3 on-ramp awards (Oct. 2018)", "https://washingtontechnology.com/2018/10/army-makes-second-round-of-awards-for-374b-rs3-vehicle/348792/"),
        ("LOGCAP V solicitation (Dec. 2017)", "https://govconwire.com/2017/12/army-opens-solicitation-for-82b-logcap-v-contract/"),
        ("GAO B-417506.5 (LOGCAP V protest)", "https://www.gao.gov/docket/b-417506.5"),
        ("SOF Core Support H92400-19-R-0003", "https://highergov.com/contract-opportunity/sof-core-support-h9240019r0003-s-b86dd"),
        ("FAC 2025-06 / FAR Case 2024-001 inflation adjustment (SAT $350K eff. Oct. 1, 2025)", "https://public-inspection.federalregister.gov/2025-16412.pdf"),
        ("Reproduction code and data", "analysis/dow-pshc-palt/ on branch claude/jolly-hopper-y9e8mo (adamsymington/pbai-v2)")]
for i, row in enumerate(srcs, 1):
    for j, v in enumerate(row, 1):
        c = ws.cell(row=i, column=j, value=v); c.font = HDR_FONT if i == 1 else BODY
        if i == 1: c.fill = HDR_FILL
ws.column_dimensions["A"].width = 62; ws.column_dimensions["B"].width = 110

# ---------------- Summary (formulas only) ----------------
ws = wb.create_sheet("Summary", 0)
ws.column_dimensions["A"].width = 62; ws.column_dimensions["B"].width = 16; ws.column_dimensions["C"].width = 70
ws["A1"] = "DoD Professional Services: GSA MAS vs Open Market, FY2020-FY2026"; ws["A1"].font = Font(name=F, size=14, bold=True)
ws["A2"] = "Every value below is a formula over the data tabs (green text = pulled from another tab). FY2026 is partial: published data runs through " + LATEST + "."; ws["A2"].font = NOTE
SV = "'Spend by Vehicle'"
TOTC = get_column_letter(len(t1.columns))
def tot(label):  # FY20-26 total for a vehicle row in Spend by Vehicle (last column)
    return f'INDEX({SV}!${TOTC}:${TOTC},MATCH("{label}",{SV}!$A:$A,0))'
def m6(spec, col):
    return f"INDEX('Matched OM vs MAS'!${col}:${col},MATCH(\"{spec}\",'Matched OM vs MAS'!$A:$A,0))"
def m9(spec, col):
    return f"INDEX('Matched MAC vs MAS'!${col}:${col},MATCH(\"{spec}\",'Matched MAC vs MAS'!$A:$A,0))"
# column letters in t6/t9: H weighted MAS, I weighted OM/MAC, J diff, K ci low, L ci high
rows = [
    ("SPEND (DoD-awarded, PSC R/B/U, $ millions)", None, None, "section"),
    ("Total obligations FY20-26", f"={tot('TOTAL')}", "#,##0", "Spend by Vehicle, TOTAL row"),
    ("GSA MAS (orders + BPA calls)", f'={tot("GSA MAS (order)")}+{tot("GSA MAS (BPA call)")}', "#,##0", ""),
    ("Open market (stand-alone; floor of Tier 0)", f'={tot("Open market (stand-alone contract/PO)")}', "#,##0", "Subset of OMB Tier 0; do not label as total Tier 0"),
    ("DoD-owned IDIQs (single + multiple award)", f'={tot("DoD-owned IDIQ (single award)")}+{tot("DoD-owned IDIQ (MAC)")}', "#,##0", ""),
    ("MAS share of total", "={MAS}/{TOTAL}", "0.0%", ""),
    ("Open-market share of total", "={OM}/{TOTAL}", "0.0%", ""),
    ("DoD-owned IDIQ share of total", "={DOD}/{TOTAL}", "0.0%", ""),
    ("MAS share, FY2020", "='Spend Share'!B2", "0.00%", ""),
    ("MAS share, FY2025", "='Spend Share'!B7", "0.00%", ""),
    ("MAS share, FY2026 (partial year)", "='Spend Share'!B8", "0.00%", "FY2026 through latest published date (see Data Quality)"),
    ("FY2026 obligations published to date", f"=INDEX({SV}!$H:$H,MATCH(\"TOTAL\",{SV}!$A:$A,0))", "#,##0", "Spend by Vehicle, FY2026 column"),
    ("GSA-assisted, DoD-funded (separate population)", f"=SUM('GSA Assisted'!{GT}2:{GT}{end11})", "#,##0", "GSA Assisted tab"),
    ("  of which MAS orders", f"=INDEX('GSA Assisted'!${GT}:${GT},MATCH(\"GSA MAS (order)\",'GSA Assisted'!$A:$A,0))", "#,##0", "BPA calls under GSA-awarded BPAs (~$0.7B) not counted; parent schedule not resolved"),
    ("PALT, OPEN MARKET vs MAS (days, matched)", None, None, "section"),
    ("All new awards: open market minus MAS", f'={m6("A. All new awards, exact strata","J")}', "0.0", "Matched OM vs MAS, spec A"),
    ("  95% CI low", f'={m6("A. All new awards, exact strata","K")}', "0.0", ""),
    ("  95% CI high", f'={m6("A. All new awards, exact strata","L")}', "0.0", ""),
    ("Competed, above SAT: MAS weighted median", f'={m6("E. Above SAT, competed","H")}', "0.0", "Spec E (headline)"),
    ("Competed, above SAT: open-market weighted median", f'={m6("E. Above SAT, competed","I")}', "0.0", ""),
    ("Competed, above SAT: open market minus MAS", f'={m6("E. Above SAT, competed","J")}', "0.0", ""),
    ("  95% CI low", f'={m6("E. Above SAT, competed","K")}', "0.0", ""),
    ("  95% CI high", f'={m6("E. Above SAT, competed","L")}', "0.0", ""),
    ("Smallest estimate across 8 specifications", "=MIN('Matched OM vs MAS'!J2:J9)", "0.0", "All eight specs positive"),
    ("Largest estimate across 8 specifications", "=MAX('Matched OM vs MAS'!J2:J9)", "0.0", ""),
    ("Raw median PALT, MAS orders", "=INDEX('PALT Raw by Vehicle'!$C:$C,MATCH(\"GSA MAS (order)\",'PALT Raw by Vehicle'!$A:$A,0))", "0.0", "Unmatched; misleading alone (see Population Mix)"),
    ("Raw median PALT, open market", "=INDEX('PALT Raw by Vehicle'!$C:$C,MATCH(\"Open market (stand-alone contract/PO)\",'PALT Raw by Vehicle'!$A:$A,0))", "0.0", ""),
    ("Open market share not competed", "=1-INDEX('Population Mix'!$C:$C,MATCH(\"Open market (Tier 0 proxy)\",'Population Mix'!$A:$A,0))", "0.0%", ""),
    ("MAS share not competed", "=1-INDEX('Population Mix'!$C:$C,MATCH(\"GSA MAS\",'Population Mix'!$A:$A,0))", "0.0%", ""),
    ("DoD-OWNED VEHICLES", None, None, "section"),
    ("Matched order PALT: DoD MAC minus MAS (competed, above SAT)", f'={m9("MAC-C. Competed, above SAT","J")}', "0.0", "Matched MAC vs MAS; CI spans zero"),
    ("  95% CI low", f'={m9("MAC-C. Competed, above SAT","K")}', "0.0", ""),
    ("  95% CI high", f'={m9("MAC-C. Competed, above SAT","L")}', "0.0", ""),
    ("Median stand-up days, identifiable top families", f"=MEDIAN('Vehicle Stand-up'!{HELP1}2:{HELP1}{VEH_END})", "0.0", "RFP release to first IDV award (FPDS)"),
    ("Median stand-up days, excluding logistics vehicles", f"=MEDIAN('Vehicle Stand-up'!{HELP2}2:{HELP2}{VEH_END})", "0.0", "Excludes LOGCAP V and probable WEXMAC 2.0"),
    ("Min stand-up days", f"=MIN('Vehicle Stand-up'!{HELP1}2:{HELP1}{VEH_END})", "0", ""),
    ("Max stand-up days", f"=MAX('Vehicle Stand-up'!{HELP1}2:{HELP1}{VEH_END})", "0", ""),
    ("MAS median order PALT (all MAS new awards)", f"='Vehicle Stand-up'!{cols['mas_order_palt_median_days']}2", "0.0", ""),
    ("DATA QUALITY", None, None, "section"),
    ("MAS + open-market awards in PALT comparison", "=COUNTA(Records!A:A)-1", "#,##0", "Records tab; each row has a USASpending permalink"),
    ("Solicitation-date coverage, MAS FY2025", "='Sol Date Coverage'!H7", "0.0%", ""),
    ("Solicitation-date coverage, open market FY2025", "='Sol Date Coverage'!I7", "0.0%", ""),
    ("Solicitation-date coverage, MAS FY2026", "='Sol Date Coverage'!H8", "0.0%", ""),
    ("Solicitation-date coverage, open market FY2026", "='Sol Date Coverage'!I8", "0.0%", ""),
    ("Raw median PALT FY2026, MAS", "=INDEX('PALT Median by FY'!$B:$B,MATCH(\"FY2026\",'PALT Median by FY'!$A:$A,0))", "0.0", ""),
    ("Raw median PALT FY2026, open market", "=INDEX('PALT Median by FY'!$C:$C,MATCH(\"FY2026\",'PALT Median by FY'!$A:$A,0))", "0.0", ""),
    ("Latest action date in published data", LATEST, "@", "Hardcoded from summary.json; DoD data posts to FPDS/USASpending with a 90-day delay"),
]
# first pass: assign rows so formulas can reference each other by key
keys = {"Total obligations FY20-26": "TOTAL", "GSA MAS (orders + BPA calls)": "MAS",
        "Open market (stand-alone; floor of Tier 0)": "OM", "DoD-owned IDIQs (single + multiple award)": "DOD"}
pos, r = {}, 4
for lab, f, fmt, note in rows:
    if f is None:
        r += 2; continue
    if lab in keys: pos[keys[lab]] = f"B{r}"
    r += 1
rows = [(l, (f.format(**pos) if f and "{" in f and "}" in f and "INDEX" not in f and "MEDIAN" not in f else f), fm, n) for l, f, fm, n in rows]
r = 4
for lab, f, fmt, note in rows:
    if f is None:
        r += 1
        c = ws.cell(row=r, column=1, value=lab); c.font = Font(name=F, size=10, bold=True, color="1F3A5F")
        ws.cell(row=r, column=1).border = Border(bottom=Side(style="medium", color="1F3A5F"))
        r += 1
        continue
    a = ws.cell(row=r, column=1, value=lab); a.font = BODY
    b = ws.cell(row=r, column=2, value=f); b.number_format = fmt; b.font = LINK if (isinstance(f, str) and "!" in f) else Font(name=F, size=10)
    ws.cell(row=r, column=3, value=note).font = NOTE
    r += 1
ws.cell(row=r + 1, column=1, value=SRC).font = NOTE
wb.save(XLSX)
print("saved", XLSX, "records", REC_N)
