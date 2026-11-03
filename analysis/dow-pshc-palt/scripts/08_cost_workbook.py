"""Add the cost-of-time model to the workbook (formulas only; inputs in one tab).
Usage: python3 -I 08_cost_workbook.py <output_dir> <xlsx_path>   (run after 04_export_xlsx.py and 07_cost_of_time.py)
"""
import sys, os
import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter as L
from openpyxl.comments import Comment

OUT, XLSX = sys.argv[1], sys.argv[2]
_c5 = pd.read_csv(os.path.join(OUT, "c5_extensions.csv"))
_m = _c5[_c5.measure.str.startswith("Matched")].set_index("group").extended_rate
_r = _c5[_c5.measure == "Raw"].set_index("group").extended_rate
PEXT_LO, PEXT_BASE, PEXT_HI = round(float(_m["GSA MAS"]), 4), round(float(_m["Open market (Tier 0 proxy)"]), 4), round(float(_r["Open market (Tier 0 proxy)"]), 4)
F = "Arial"
HDR = dict(font=Font(name=F, bold=True, color="FFFFFF", size=10), fill=PatternFill("solid", start_color="1F3A5F"))
BODY, BOLD = Font(name=F, size=10), Font(name=F, size=10, bold=True)
INPUT = Font(name=F, size=10, color="0000FF")          # blue = hardcoded input
LINK = Font(name=F, size=10, color="008000")           # green = pulled from another tab
NOTE = Font(name=F, size=9, italic=True, color="555555")
KEY = PatternFill("solid", start_color="FFFF00")         # yellow = key assumption
SEC = Font(name=F, size=11, bold=True, color="1F3A5F")
USD, USDM, PCT, DAYS = '$#,##0;($#,##0);-', '$#,##0.0,,"M";($#,##0.0,,"M");-', "0.0%", "0.0"

wb = load_workbook(XLSX)
for n in ["Cost Summary", "Cost Inputs", "Cost Population", "Cost Model", "Vehicle Cost"]:
    if n in wb.sheetnames: del wb[n]

def hdr(ws, r, labels, c0=1):
    for j, t in enumerate(labels):
        c = ws.cell(row=r, column=c0 + j, value=t); c.font, c.fill = HDR["font"], HDR["fill"]
        c.alignment = Alignment(wrap_text=True, vertical="center")
def put(ws, r, c, v, fmt=None, font=BODY, fill=None):
    x = ws.cell(row=r, column=c, value=v); x.font = font
    if fmt: x.number_format = fmt
    if fill: x.fill = fill
    return x

# ======================= Cost Inputs =======================
ws = wb.create_sheet("Cost Inputs")
ws["A1"] = "Cost-of-time model: inputs and assumptions"; ws["A1"].font = Font(name=F, size=13, bold=True)
ws["A2"] = "Blue = hardcoded input. Yellow fill = key judgment assumption (no published source; drives results). Change any value; every tab recalculates."; ws["A2"].font = NOTE
hdr(ws, 4, ["Input", "Low", "Base", "High", "Unit", "Source / logic"])
INPUTS = [
 # key, label, low, base, high, unit, source, is_key_assumption
 ("eci", "Annual wage/price escalation for professional services", 0.025, 0.031, 0.04, "%/yr",
  "BLS Employment Cost Index release of Oct. 30, 2026: civilian wages and salaries +3.1% for the 12 months ending Sept. 2026 (base). Range is judgment. https://www.bls.gov/news.release/archives/eci_10302026.htm", False),
 ("sal", "GS-13 step 5 annual salary, Washington-Baltimore locality, 2026", 138023, 138023, 138023, "$/yr",
  "OPM 2026 GS base table GS-13/5 = $103,049 x (1 + 33.94% DC locality) = $138,023. Computed; verify against OPM 2026 DCB table. Used as the blended rate for contracting/technical staff.", False),
 ("fringe", "Civilian fringe benefit factor", 0.3625, 0.3625, 0.3625, "% of pay",
  "OMB Memo M-08-13 (Mar. 2008): full fringe factor 36.25% of basic pay for A-76 cost comparisons. Latest published factor found; verify current.", False),
 ("ovh", "Government overhead factor", 0.12, 0.12, 0.12, "% of pay",
  "OMB Circular A-76 standard 12% overhead factor (see GAO/NSIAD-98-62 on its basis).", False),
 ("hrs", "Paid hours per FTE-year", 2087, 2087, 2087, "hours",
  "OPM standard hours used to convert annual to hourly pay (5 U.S.C. 5504(b)).", False),
 ("effort", "Government labor hours per extra PALT day, per competed action", 0.5, 1.0, 2.0, "hours/day",
  "ASSUMPTION. PALT is calendar time, not labor. A competed source selection runs multiple people part-time (CO, specialist, evaluators, legal, requirements owner). No published hours-per-action figure found for DoD services; range reflects 0.5 to 2 hours of combined team effort for each extra calendar day.", True),
 ("movable", "Share of addressable open-market buys realistically movable to MAS", 0.25, 0.50, 0.75, "%",
  "ASSUMPTION. Addressable set is already limited to PSC x dollar band x FY x pricing strata where DoD also bought on MAS. This share covers buys still unfit for MAS (security, unique terms, vendor not on MAS).", True),
 ("lost", "Share of delay days where the need goes unmet (vs. performance simply shifting later)", 0.0, 0.25, 0.50, "%",
  "ASSUMPTION. If performance just shifts right, delay costs only time value and escalation. If the need exists on a fixed date (exercise, deployment, expiring predecessor), the delay days are service the government does not get. Valued at contract price, the government's revealed minimum value for the service.", True),
 ("disc", "Real discount rate (time value of deferred service)", 0.015, 0.02, 0.03, "%/yr",
  "OMB Circular A-4 (2023 revision) default real rate 2.0%; A-94 Appendix C rates updated annually (M-26-09, Mar. 2026). Verify current Appendix C value.", False),
 ("iff", "GSA MAS Industrial Funding Fee", 0.0075, 0.0075, 0.0075, "% of sales",
  "GSAR 552.238-80; GSA Vendor Support Center: MAS IFF is 0.75%. Built into MAS prices, so it is a cost to the ordering agency.", False),
 ("ftesmall", "Stand-up team FTE, vehicle with <=10 awardees", 3, 5, 8, "FTE",
  "ASSUMPTION. Contracting, legal, technical evaluators and program staff during RFP-to-award. Judgment; no published DoD figure found.", True),
 ("ftemid", "Stand-up team FTE, vehicle with 11-100 awardees", 5, 10, 15, "FTE", "ASSUMPTION. As above, scaled for evaluation volume.", True),
 ("ftelarge", "Stand-up team FTE, vehicle with >100 awardees", 10, 20, 40, "FTE", "ASSUMPTION. As above; SeaPort-NxG evaluated ~1,900 awardees, RS3 ~280.", True),
 ("offratio", "Offerors per awardee", 1.0, 1.5, 2.0, "ratio",
  "ASSUMPTION. Low = every offeror won (pass/fail on-ramps such as SeaPort-NxG award nearly all qualified offerors).", True),
 ("propcost", "Industry cost to prepare one IDIQ proposal", 15000, 40000, 100000, "$/proposal",
  "ASSUMPTION anchored to American Express OPEN for Government Contracts survey (released Jan. 2017): small businesses spent an average $148,124 per year on ALL federal bidding. One IDIQ proposal is a fraction of that. Large-business proposals cost more.", True),
 ("dupmult", "Multiplier on measured MAS-overlap share (duplicated proposal effort)", 1.0, 1.5, 2.0, "x",
  "Measured overlap (Vehicle Cost tab) counts only awardees with a DoD PSHC MAS order FY20-26, a lower bound on MAS holders. Base and high scale it up; capped at 100%.", True),
 ("pmofte", "DoD program-office FTE to run one vehicle, per year", 1, 2, 4, "FTE",
  "ASSUMPTION. Ordering guides, on-ramps, ceiling management, reporting. MAS needs none of this from DoD (GSA runs it, funded by the IFF).", True),
 ("life", "Ordering life of a DoD MAC (years), for spreading one-time stand-up costs", 10, 10, 10, "years",
  "SeaPort-NxG: 5-year base + 5-year option (10 years); RS3: 10-year ordering period ($37.4B); LOGCAP V: 10 years. Per vehicle announcements cited in the report.", False),
 ("premium", "Price premium on extension / bridge work (non-competed)", 0.0, 0.05, 0.10, "%",
  "ASSUMPTION. No published % premium for bridges found. GAO-16-15 flags overpayment risk on sole-source bridges; DoD IG (DODIG-2022-104) found DoD paid at least $71.9M in escalation on 21 of 34 sole-source contracts; IDA (P-4542) documents bridge prevalence in DoD services.", True),
 ("pext", "Probability a predecessor contract is extended past its planned end", PEXT_LO, PEXT_BASE, PEXT_HI, "%",
  "MEASURED (Cost Population tab, extensions table): competed above-SAT awards whose original end passed by Jan. 2026. Low = matched MAS rate, base = matched open-market rate, high = raw open-market rate.", False),
 ("waitrep", "Share of a REPLACEMENT vehicle's demand that waited for it (predecessor could not take it)", 0.0, 0.05, 0.15, "%",
  "ASSUMPTION. Predecessor kept ordering during stand-up (e.g., SeaPort-e task orders ran to completion), so only work outside its scope or ceiling waited.", True),
 ("waitnew", "Share of a NEW vehicle's demand that waited for it (rather than buying another way)", 0.10, 0.25, 0.50, "%",
  "ASSUMPTION. With no predecessor, offices could buy open market or on other vehicles; this is the share that held off until the vehicle existed.", True),
 ("years", "Years in the data window (FY2020 to FY2026 through Jul. 2026)", 6.8333, 6.8333, 6.8333, "years",
  "6 full fiscal years + 10 months of FY2026. Used to annualize.", False),
]
ROW = {}
for i, (k, lab, lo, ba, hi, unit, src, key) in enumerate(INPUTS, 5):
    ROW[k] = i
    put(ws, i, 1, lab)
    fmt = PCT if unit.startswith("%") else ('$#,##0' if unit.startswith("$") else '#,##0.0###')
    for j, v in enumerate((lo, ba, hi), 2):
        put(ws, i, j, v, fmt, INPUT, KEY if key else None)
    put(ws, i, 5, unit); c = put(ws, i, 6, src, font=NOTE); c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[i].height = 42 if len(src) > 120 else 28
r = len(INPUTS) + 6
put(ws, r, 1, "Derived: fully loaded hourly rate", font=BOLD)
for j in (2, 3, 4):
    cl = L(j)
    put(ws, r, j, f"={cl}{ROW['sal']}*(1+{cl}{ROW['fringe']}+{cl}{ROW['ovh']})/{cl}{ROW['hrs']}", '$#,##0.00', BOLD)
put(ws, r, 6, "Formula: salary x (1 + fringe + overhead) / paid hours", font=NOTE); ROW["rate"] = r
put(ws, r + 1, 1, "Derived: fully loaded annual cost per FTE", font=BOLD)
for j in (2, 3, 4):
    cl = L(j); put(ws, r + 1, j, f"={cl}{ROW['sal']}*(1+{cl}{ROW['fringe']}+{cl}{ROW['ovh']})", '$#,##0', BOLD)
ROW["annual"] = r + 1
for col, w in zip("ABCDEF", (58, 13, 13, 13, 11, 110)): ws.column_dimensions[col].width = w
ws.freeze_panes = "B5"
CI = lambda key, case: f"'Cost Inputs'!${'BCD'[case]}${ROW[key]}"   # case 0=low 1=base 2=high

# ======================= Cost Population =======================
wp = wb.create_sheet("Cost Population")
c1 = pd.read_csv(os.path.join(OUT, "c1_population_by_band.csv"))
c2 = pd.read_csv(os.path.join(OUT, "c2_band_gaps.csv"))
c3 = pd.read_csv(os.path.join(OUT, "c3_year_end_timing.csv"))
wp["A1"] = "Populations and measured gaps (computed from FPDS data by scripts/07_cost_of_time.py; not assumptions)"; wp["A1"].font = SEC
hdr(wp, 3, ["Scope", "Band", "New awards", "Base + all options value ($)", "Obligated at award ($)",
            "Sum of daily contract value ($/day)", "Awards with usable PoP", "Median PoP (days)",
            "PALT gap low (days)", "PALT gap base (days)", "PALT gap high (days)", "Gap basis"])
POP = {}
r = 4
for _, x in c1.iterrows():
    g = c2[c2.band == x.band].iloc[0]
    vals = [x.scope, x.band, int(x.awards), x.value_usd, x.obligated_at_award_usd, x.daily_value_sum_usd,
            int(x.awards_with_pop), x.median_pop_days, g.gap_low_days, g.gap_base_days, g.gap_high_days, g.basis]
    fm = [None, None, "#,##0", USD, USD, USD, "#,##0", "#,##0", DAYS, DAYS, DAYS, None]
    for j, (v, f) in enumerate(zip(vals, fm), 1): put(wp, r, j, v, f)
    POP.setdefault(x.scope, []).append(r); r += 1
put(wp, r + 1, 1, "Addressable = open-market competed above-SAT new awards in a 4-digit PSC x dollar band x FY x pricing stratum where DoD also made a competed above-SAT MAS award. All new awards count, with or without a reported solicitation date.", font=NOTE)
put(wp, r + 2, 1, "Daily contract value = base-and-all-options value / (potential end date - PoP start), awards with PoP >= 30 days. PALT gaps: matched open-market minus MAS medians, competed buys, by band (Matched by Band tab); >$100M uses the pooled above-SAT estimate.", font=NOTE)
r += 4
put(wp, r, 1, "Year-end timing check (FY2020-FY2025 new awards)", font=SEC); r += 1
hdr(wp, r, ["Group", "New awards", "Share awarded in September", "Share in last 2 weeks of FY", "Median PALT (days)"]); r += 1
for _, x in c3.iterrows():
    for j, (v, f) in enumerate(zip([x.group, int(x.new_awards), x.september_share, x.last_two_weeks_share, x.median_palt_days],
                                   [None, "#,##0", PCT, PCT, DAYS]), 1): put(wp, r, j, v, f)
    r += 1
put(wp, r, 1, "Result: open-market and MAS buys land in September at the same rate, so year-end (expiring-funds) risk is NOT counted as a cost of open-market delay.", font=NOTE)
r += 3
c5 = pd.read_csv(os.path.join(OUT, "c5_extensions.csv"))
put(wp, r, 1, "Extensions past the original planned end (competed above-SAT awards whose original end passed by Jan. 31, 2026)", font=SEC); r += 1
hdr(wp, r, ["Group", "Measure", "Awards", "Share extended", "Mean extension days (all awards)", "Median extension days, if extended"]); r += 1
for _, x in c5.iterrows():
    for j, (v, f) in enumerate(zip([x.group, x.measure, int(x.awards), x.extended_rate, x.mean_ext_days, x.median_ext_days_if_extended],
                                   [None, None, "#,##0", PCT, DAYS, DAYS]), 1): put(wp, r, j, None if (isinstance(v, float) and pd.isna(v)) else v, f)
    r += 1
put(wp, r, 1, "Result: matched like-for-like, open-market and MAS awards are extended at the same rate and length. Extensions are a cost of late follow-ons generally, not of the vehicle; the model counts only extension days avoided by MAS's shorter PALT.", font=NOTE)
r += 3
c6 = pd.read_csv(os.path.join(OUT, "c6_bridge_type_awards.csv"))
put(wp, r, 1, "Bridge-type awards (GAO-16-15 definition applied to FPDS), FY2020 to Jul. 2026", font=SEC); r += 1
hdr(wp, r, ["Group of the bridge award", "Bridge awards", "Base + all options value ($)", "Obligated FY20-26 ($)", "Median PoP (days)", "Obligated per year ($)"]); r += 1
for _, x in c6.iterrows():
    for j, (v, f) in enumerate(zip([x.group, int(x.bridge_awards), x.value_usd, x.obligated_usd, x.median_pop_days, x.per_year_obligated_usd],
                                   [None, "#,##0", USD, USD, "#,##0", USD]), 1): put(wp, r, j, v, f)
    if x.group == "All": BRIDGE_ALL_ROW = r
    r += 1
put(wp, r, 1, "Definition: new award, not competed (FAR 6.302 one source / follow-on / urgency / unique, or fair-opportunity follow-on / urgency / one source), potential PoP <= 12 months, to the incumbent: same UEI, awarding office and 4-digit PSC with another award ending 180 days before to 30 days after the start. Record list: output/r3_bridge_type_awards.csv.gz.", font=NOTE)
for j, w in enumerate((40, 11, 12, 20, 18, 20, 13, 12, 12, 12, 12, 42), 1): wp.column_dimensions[L(j)].width = w

# ======================= Cost Model =======================
wm = wb.create_sheet("Cost Model")
wm["A1"] = "Cost of open-market delay vs MAS: formulas by dollar band, low / base / high"; wm["A1"].font = Font(name=F, size=13, bold=True)
wm["A2"] = "Low = every input at its low value (including the low end of the PALT-gap CI); High = every input high. Corner cases, not a probability interval."; wm["A2"].font = NOTE
COMP = ["Escalation", "Gov't labor", "Time value", "Unmet need", "Bridge premium", "MAS fee (IFF)"]
W6 = 6
CASES = ["Low", "Base", "High"]
def block(top, scope, title):
    put(wm, top, 1, title, font=SEC)
    hr = top + 1
    put(wm, hr, 1, "Band"); wm.cell(row=hr, column=1).font, wm.cell(row=hr, column=1).fill = HDR["font"], HDR["fill"]
    for k, case in enumerate(CASES):
        hdr(wm, hr, [f"{case}: {c}" for c in COMP], 2 + W6 * k)
    rows = POP[scope]
    for i, pr in enumerate(rows):
        rr = hr + 1 + i
        put(wm, rr, 1, f"='Cost Population'!B{pr}", font=LINK)
        n, val, daily = f"'Cost Population'!$C${pr}", f"'Cost Population'!$D${pr}", f"'Cost Population'!$F${pr}"
        for k in range(3):
            gap = f"'Cost Population'!${'IJK'[k]}${pr}"
            f = [f"={val}*{CI('eci',k)}*{gap}/365",
                 f"={n}*{gap}*{CI('effort',k)}*'Cost Inputs'!${'BCD'[k]}${ROW['rate']}",
                 f"={val}*((1+{CI('disc',k)})^({gap}/365)-1)",
                 f"={daily}*{gap}*{CI('lost',k)}",
                 f"={daily}*{gap}*{CI('pext',k)}*{CI('premium',k)}",
                 f"=-{val}*{CI('iff',k)}"]
            for j, fx in enumerate(f): put(wm, rr, 2 + W6 * k + j, fx, USD)
    first, last = hr + 1, hr + len(rows)
    t = last + 1
    put(wm, t, 1, "Total, FY20-26 window, all buys in scope", font=BOLD)
    for j in range(2, 2 + 3 * W6): put(wm, t, j, f"=SUM({L(j)}{first}:{L(j)}{last})", USD, BOLD)
    out = {}
    lab = [("Gross time cost, movable share, per year", "gross"), ("MAS fee on the same buys, per year", "fee"), ("Net cost of open-market delay, per year", "net")]
    for i, (txt, key) in enumerate(lab):
        rr = t + 2 + i; put(wm, rr, 1, txt, font=BOLD)
        for k in range(3):
            c0 = 2 + W6 * k
            mv, yr = CI("movable", k), CI("years", k)
            if key == "gross":
                fx = f"=SUM({L(c0)}{t}:{L(c0+4)}{t})*{mv}/{yr}"
            elif key == "fee":
                fx = f"={L(c0+5)}{t}*{mv}/{yr}"
            else:
                fx = f"={L(c0)}{t+2}+{L(c0)}{t+3}"
            put(wm, rr, c0, fx, USD, BOLD)
            put(wm, rr, c0 + 1, CASES[k], font=NOTE)
        out[key] = t + 2 + i
    rr = t + 6; put(wm, rr, 1, "Contract value delayed (dollar-days / 365), movable share, per year", font=BOLD)
    for k in range(3):
        c0 = 2 + W6 * k
        put(wm, rr, c0, f"=SUMPRODUCT('Cost Population'!$D${rows[0]}:$D${rows[-1]},'Cost Population'!${'IJK'[k]}${rows[0]}:${'IJK'[k]}${rows[-1]})/365*{CI('movable',k)}/{CI('years',k)}", USD, BOLD)
    put(wm, rr + 1, 1, "Read: the dollar value of services whose start slipped by a full year, equivalent. A size-of-delay measure, not a cost.", font=NOTE)
    out["dd"] = rr
    rb = rr + 2; put(wm, rb, 1, "Breakeven: share of each delay day's contract value that must be lost for MAS to win", font=BOLD)
    for k in range(3):
        c0 = 2 + W6 * k
        put(wm, rb, c0, f"=MAX(0,-(SUM({L(c0)}{t}:{L(c0+2)}{t})+{L(c0+4)}{t}+{L(c0+5)}{t})/SUMPRODUCT('Cost Population'!$F${rows[0]}:$F${rows[-1]},'Cost Population'!${'IJK'[k]}${rows[0]}:${'IJK'[k]}${rows[-1]}))", PCT, BOLD)
        put(wm, rb, c0 + 1, CASES[k], font=NOTE)
    put(wm, rb + 1, 1, "Read: if more than this share of a delayed day's contract value is need that goes unmet, MAS wins on cost. Compare with the unmet-need assumption in Cost Inputs.", font=NOTE)
    out["be"] = rb
    return out, rb + 3
A, nxt = block(4, "Addressable (strata where MAS also bought)", "A. Addressable open-market buys (headline)")
B, _ = block(nxt, "All open-market competed above SAT", "B. Sensitivity: every open-market competed above-SAT buy (includes $18B of >$100M awards MAS rarely hosts)")
put(wm, _ + 1, 1, "Formulas: Escalation = value x escalation rate x gap/365. Gov't labor = awards x gap days x hours per day x loaded hourly rate. Time value = value x ((1+r)^(gap/365) - 1). Unmet need = sum of daily contract value x gap days x unmet share. Bridge premium = sum of daily contract value x gap days x P(predecessor extended) x premium. MAS fee = -(value x IFF).", font=NOTE)
wm.column_dimensions["A"].width = 62
for j in range(2, 2 + 3 * W6): wm.column_dimensions[L(j)].width = 15
wm.freeze_panes = "B4"

# ======================= Vehicle Cost =======================
wv = wb.create_sheet("Vehicle Cost")
c4 = pd.read_csv(os.path.join(OUT, "c4_vehicle_families.csv"))
wv["A1"] = "Cost of building DoD-owned MACs vs ordering on MAS: largest 15 identifiable families"; wv["A1"].font = Font(name=F, size=13, bold=True)
wv["A2"] = "In scope = 1 for families MAS could plausibly host; LOGCAP V and probable WEXMAC 2.0 are 0 and drop out of totals. Edit the In-scope column to change."; wv["A2"].font = NOTE
cols = ["Program", "Solicitation", "Awardees (IDVs)", "Stand-up days (FPDS)", "Orders FY20-26 ($)", "MAS overlap (lower bound)", "In scope (1/0)"]
for case in CASES: cols += [f"{case}: Gov't stand-up labor"]
for case in CASES: cols += [f"{case}: Industry proposal cost"]
for case in CASES: cols += [f"{case}: Duplicated proposal cost"]
for case in CASES: cols += [f"{case}: DoD PMO cost, FY20-26"]
cols += ["MAS fee avoided, FY20-26"]
hdr(wv, 4, cols)
first = 5
for i, x in c4.iterrows():
    r = first + i
    for j, (v, f) in enumerate(zip([x.program, x.sol_id, int(x.awardees_idv_count), x.standup_days, x.order_obligations_fy20_26_usd, x.mas_overlap_share_lower_bound,
                                    0 if str(x.mas_substitutable).startswith("No") else 1], [None, None, "#,##0", "#,##0", USD, PCT, "0"]), 1):
        put(wv, r, j, v, f, INPUT if j == 7 else BODY)
    for k in range(3):
        fte = f"IF(C{r}>100,{CI('ftelarge',k)},IF(C{r}>10,{CI('ftemid',k)},{CI('ftesmall',k)}))"
        put(wv, r, 8 + k, f"={fte}*D{r}/365*'Cost Inputs'!${'BCD'[k]}${ROW['annual']}", USD)
        put(wv, r, 11 + k, f"=C{r}*{CI('offratio',k)}*{CI('propcost',k)}", USD)
        put(wv, r, 14 + k, f"={L(11+k)}{r}*MIN(1,F{r}*{CI('dupmult',k)})", USD)
        put(wv, r, 17 + k, f"={CI('pmofte',k)}*'Cost Inputs'!${'BCD'[k]}${ROW['annual']}*{CI('years',k)}", USD)
    put(wv, r, 20, f"=E{r}*{CI('iff',1)}", USD)
last = first + len(c4) - 1
t = last + 1
put(wv, t, 1, "Total, in-scope families", font=BOLD)
for j in range(3, 21):
    if j in (6, 7): continue
    fm = "#,##0" if j in (3, 4) else USD
    put(wv, t, j, f"=SUMPRODUCT({L(j)}{first}:{L(j)}{last},$G${first}:$G${last})", fm, BOLD)
put(wv, t + 1, 1, "Median stand-up days, in-scope families", font=BOLD)
hdr(wv, 4, ["Stand-up days if in scope"], 21)
for rr in range(first, last + 1): put(wv, rr, 21, f'=IF(G{rr}=1,D{rr},"")', "#,##0")
put(wv, t + 1, 4, f"=MEDIAN(U{first}:U{last})", "#,##0", BOLD)
hdr(wv, 4, ["Predecessor status", "Daily order value ($)"] + [f"{c}: Capability delay of stand-up" for c in CASES] + ["Stand-up dollar-days"], 22)
for i, x in c4.iterrows():
    rr = first + i
    put(wv, rr, 22, x.predecessor_status, None, INPUT)
    put(wv, rr, 23, x.daily_order_value_usd, USD)
    for k in range(3):
        put(wv, rr, 24 + k, f'=D{rr}*W{rr}*IF(V{rr}="Replacement",{CI("waitrep",k)},{CI("waitnew",k)})*{CI("lost",k)}', USD)
    put(wv, rr, 27, f"=D{rr}*W{rr}", USD)
for j in range(24, 28):
    put(wv, t, j, f"=SUMPRODUCT({L(j)}{first}:{L(j)}{last},$G${first}:$G${last})", USD, BOLD)
for j, w in zip(range(22, 28), (24, 14, 16, 16, 16, 18)): wv.column_dimensions[L(j)].width = w
VT = t
notes = [
 "Gov't stand-up labor = team FTE (by awardee tier) x stand-up days / 365 x loaded annual cost per FTE.",
 "Industry proposal cost = awardees x offerors per awardee x cost per proposal. Contractors recover bid-and-proposal cost through indirect rates (FAR 31.205-18), so the government pays much of it in later prices.",
 "Duplicated proposal cost = industry proposal cost x MAS-overlap share (measured lower bound x multiplier, capped at 100%): proposal effort spent by firms already holding MAS, so the work was available without the new vehicle.",
 "DoD PMO cost = PMO FTE x loaded annual cost x years in window, per family. MAS fee avoided = FY20-26 orders x 0.75%: what DoD would have paid GSA had the same orders gone on MAS. These two are the fee-side trade.",
 "Capability delay of stand-up = stand-up days x daily order value (FY20-26 orders / 2,494 days) x share of demand that waited (replacement vs new vehicle) x unmet-need share. Valued at contract price, a floor on mission value.",
 "Predecessor status: SeaPort-NxG replaced SeaPort-e; RS3 consolidated five existing Army IDIQs; SOF Core Support recompeted SWMS; the rolling admission is an on-ramp. Others: no predecessor identified, treated as new (edit column V to change).",
]
for i, n_ in enumerate(notes): put(wv, t + 3 + i, 1, n_, font=NOTE)
for j, w in enumerate([30, 15, 11, 11, 16, 12, 9] + [15] * 13, 1): wv.column_dimensions[L(j)].width = w
wv.freeze_panes = "C5"

# ======================= Cost Summary =======================
wsum = wb.create_sheet("Cost Summary", 1)
wsum["A1"] = "Cost of time: summary (all values are formulas)"; wsum["A1"].font = Font(name=F, size=14, bold=True)
wsum["A2"] = "Internal research estimate. Low / base / high are corner cases. Assumptions: Cost Inputs tab (yellow = judgment)."; wsum["A2"].font = NOTE
hdr(wsum, 4, ["Measure", "Low", "Base", "High", "Read it as"])
M = lambda row, k: f"='Cost Model'!{L(2+W6*k)}{row}"
V = lambda col0, k: f"='Vehicle Cost'!{L(col0+k)}{VT}"
lines = [
 ("SECTION", "1. Open-market buys that could have gone on MAS (addressable scope)"),
 ("Gross cost of extra PALT, per year", [M(A['gross'], k) for k in range(3)], USD, "Escalation + government labor + time value + unmet need, movable share"),
 ("MAS fee on the same buys, per year", [M(A['fee'], k) for k in range(3)], USD, "What moving them to MAS would cost in GSA fees"),
 ("Net cost of open-market delay, per year", [M(A['net'], k) for k in range(3)], USD, "Positive = the delay costs more than the MAS fee"),
 ("Breakeven unmet-need share for MAS to win", [M(A['be'], k) for k in range(3)], PCT, "Compare with the unmet-need input (0% / 25% / 50%)"),
 ("Context: bridge-type awards, all DoD PSHC vehicles, value at award per year", [f"='Cost Population'!C{BRIDGE_ALL_ROW}/{CI('years', k)}" for k in range(3)], USD, "Measured. Obligations ran higher ($0.8B/yr) because bridges themselves got extended; value at award is the conservative base"),
 ("Context: premium paid on that bridge work, per year", [f"='Cost Population'!C{BRIDGE_ALL_ROW}/{CI('years', k)}*{CI('premium', k)}" for k in range(3)], USD, "Portfolio-wide cost of late awards at the premium assumption; not attributable to one vehicle"),
 ("Contract value delayed, dollar-years per year", [M(A['dd'], k) for k in range(3)], USD, "Size of the delay, not a cost"),
 ("Sensitivity: net, all open-market competed above SAT, per year", [M(B['net'], k) for k in range(3)], USD, "Includes very large buys MAS rarely hosts"),
 ("SECTION", "2. Building DoD-owned MACs instead of using MAS (13 in-scope families), per year"),
 ("Government stand-up labor, spread over vehicle life", [f"={V(8, k)[1:]}/{CI('life', k)}" for k in range(3)], USD, "One-time cost / ordering life"),
 ("Duplicated industry proposal cost, spread over vehicle life", [f"={V(14, k)[1:]}/{CI('life', k)}" for k in range(3)], USD, "Proposal effort by firms already on MAS / ordering life"),
 ("DoD program-office cost, per year", [f"={V(17, k)[1:]}/{CI('years', k)}" for k in range(3)], USD, "Running the vehicles"),
 ("MAS fee avoided, per year", [f"='Vehicle Cost'!T{VT}/{CI('years', k)}" for k in range(3)], USD, "Savings to DoD from not paying 0.75% on these orders"),
 ("Net cost of DoD vehicles vs MAS, before capability delay, per year", [f"=B{{s}}+B{{d}}+B{{p}}-B{{f}}".replace("B", c) for c in "BCD"], USD, "Positive = building cost more than MAS would have; negative = DoD vehicles cheaper on cost"),
 ("Capability delay of stand-up (demand that waited), spread over vehicle life", [f"='Vehicle Cost'!{L(24+k)}{VT}/{CI('life', k)}" for k in range(3)], USD, "Stand-up days x daily orders x waited share x unmet share / life"),
 ("Net after capability delay, per year", [f"={c}{{n}}+{c}{{cap}}" for c in "BCD"], USD, "Positive = DoD vehicles cost more than MAS once time is priced"),
 ("Breakeven: share of a stand-up day's order value that must be lost for MAS to win", [f"=MAX(0,-{c}{{n}})*{CI('life', k)}/'Vehicle Cost'!AA{VT}" for k, c in enumerate("BCD")], "0.0%", "Combined (waited share x unmet share). Base inputs give 5%-25% x 25%"),
 ("Breakeven: MAS price advantage needed to offset the net, % of order value", [f"=MAX(0,-{c}{{n}})/('Vehicle Cost'!E{VT}/{CI('years', k)})" for k, c in enumerate("BCD")], "0.00%", "If MAS labor rates run this much below DoD-vehicle rates, MAS wins on cost"),
 ("One-time totals for reference: industry proposal cost (all awardees)", [V(11, k) for k in range(3)], USD, "Largely recovered through contractor indirect rates (FAR 31.205-18)"),
 ("Median stand-up days, in-scope families", [f"='Vehicle Cost'!D{VT+1}"] * 3, "#,##0", "Calendar time before the first order can be solicited"),
]
r = 5; pos = {}
for item in lines:
    if item[0] == "SECTION":
        put(wsum, r, 1, item[1], font=SEC); r += 1; continue
    lab, fs, fm, read = item; pos[lab] = r
    put(wsum, r, 1, lab, font=BOLD if lab.startswith("Net") else BODY)
    if lab.startswith("Net"):
        for cc in range(1, 6): wsum.cell(row=r, column=cc).fill = PatternFill("solid", start_color="EAF1FB")
    for k, fx in enumerate(fs):
        if "{n}" in fx or "{cap}" in fx:
            fx = fx.format(n=pos["Net cost of DoD vehicles vs MAS, before capability delay, per year"],
                           cap=pos.get("Capability delay of stand-up (demand that waited), spread over vehicle life", 0))
        if "{s}" in fx:
            fx = fx.format(s=pos["Government stand-up labor, spread over vehicle life"], d=pos["Duplicated industry proposal cost, spread over vehicle life"],
                           p=pos["DoD program-office cost, per year"], f=pos["MAS fee avoided, per year"])
        put(wsum, r, 2 + k, fx, fm, LINK if ("!" in fx and "{" not in fx) else BOLD)
    put(wsum, r, 5, read, font=NOTE); r += 1
r += 1
for t_ in ["Biggest unpriced factor: any difference in labor rates between MAS and open-market awards. A 1% price difference on the addressable $6.0B equals about $9M a year, larger than every priced item above. Next research step.",
           "The MAS fee is a transfer to GSA that pays for work GSA does instead of DoD (vehicle stand-up, administration). Government-wide it is not a pure cost; in DoD's budget it is.",
           "Bridges and extensions: priced only for the days MAS's shorter PALT would remove. Matched open-market and MAS awards are extended at the same rate, so extensions are not otherwise a MAS advantage.",
           "Not priced: mission impact beyond contract value, bid protests, workforce opportunity cost. Year-end risk was tested and dropped (no difference in September share).",
           "Caution: the low and high columns combine every input at one extreme. The plausible range is narrower than low-to-high suggests."]:
    put(wsum, r, 1, t_, font=NOTE); r += 1
for col, w in zip("ABCDE", (78, 16, 16, 16, 62)): wsum.column_dimensions[col].width = w

wb.save(XLSX)
print("cost tabs added")
