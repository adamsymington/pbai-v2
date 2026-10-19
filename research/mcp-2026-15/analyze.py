#!/usr/bin/env python3
"""Helicopter market research pipeline for MCP 2026-15.

Ingests USAspending / FPDS contract-transaction exports for PSC 1520 and
NAICS 336411 (plus optional adjacent-spend and SRP files) and produces the
tables and headline numbers the BCA market research section needs.

Usage:
    python3 analyze.py --psc data/psc1520.csv --naics data/naics336411.csv \
        [--adjacent data/adjacent.csv] [--srp data/srp_gs07f139da.csv] \
        [--overrides quantity_overrides.csv] [--green-price H125=3800000] \
        [--out outputs]

Every number the script reports traces to transaction rows in the inputs.
Quantities parsed from free-text descriptions are a first pass only; review
outputs/award_review.csv and correct them in the overrides file.
"""

import argparse
import json
import re
import sys
from pathlib import Path

import pandas as pd

FY_START, FY_END = 2016, 2026

# Column aliases: canonical name -> names seen in USAspending downloads and FPDS ezSearch exports.
ALIASES = {
    "txn_key": ["contract_transaction_unique_key"],
    "award_key": ["contract_award_unique_key", "award_unique_key"],
    "piid": ["award_id_piid", "piid", "procurement_instrument_identifier"],
    "mod": ["modification_number"],
    "parent_piid": ["parent_award_id_piid", "referenced_idv_piid", "parent_award_id"],
    "parent_type": ["parent_award_type", "referenced_idv_type", "idv_type"],
    "obligation": ["federal_action_obligation", "action_obligation", "dollars_obligated"],
    "action_date": ["action_date", "date_signed"],
    "fy": ["action_date_fiscal_year", "fiscal_year"],
    "awarding_agency": ["awarding_agency_name", "contracting_department_name"],
    "awarding_sub": ["awarding_sub_agency_name", "contracting_agency_name"],
    "funding_agency": ["funding_agency_name", "funding_department_name"],
    "funding_sub": ["funding_sub_agency_name", "funding_agency_name_sub"],
    "vendor": ["recipient_name", "vendor_name", "legal_business_name"],
    "vendor_parent": ["recipient_parent_name", "ultimate_parent_legal_business_name"],
    "psc": ["product_or_service_code", "psc_code", "product_or_service_code_psc"],
    "naics": ["naics_code", "principal_naics_code"],
    "extent_competed": ["extent_competed_code", "extent_competed"],
    "offers": ["number_of_offers_received"],
    "not_competed_reason": ["other_than_full_and_open_competition_code", "reason_not_competed"],
    "fair_opp": ["fair_opportunity_limited_sources_code", "fair_opportunity_limited_sources"],
    "award_type": ["award_type_code", "award_type", "contract_type"],
    "desc": ["transaction_description", "description_of_requirement"],
    "base_desc": ["prime_award_base_transaction_description"],
    "pop_state": ["primary_place_of_performance_state_code"],
}

# Commercial-derivative and military program aircraft: segment out before any civilian math.
DOD_PROGRAM_RX = re.compile(
    r"UH-?72|LAKOTA|TH-?73|TH-?57|UH-?60|BLACK\s*HAWK|HH-?60|MH-?60|CH-?47|CHINOOK|AH-?64|APACHE|"
    r"UH-?1Y|AH-?1Z|MH-?139|GREY\s*WOLF|CH-?53|V-?22|OSPREY|FLRAA|FARA|MV-?75",
    re.I,
)
HELO_RX = re.compile(
    r"HELICOPTER|ROTOR|ROTARY|H1[2-7]\d|AS-?350|EC-?1[2-5]\d|BELL\s*\d{3}|AW-?1\d\d|AW-?609|"
    r"MD\s*5\d\d|MD\s*902|R-?44|R-?66|S-?76|S-?92|UH-?|AH-?|CH-?|LEH\b|LIGHT\s+ENFORCEMENT",
    re.I,
)
CONFIG_RX = re.compile(
    r"CONFIG|COMPLETION|MISSION\s+(?:EQUIP|SYS)|INTEGRAT|FLIR|EO/?IR|SENSOR|AVIONICS|HOIST|"
    r"SEARCH\s*LIGHT|NVG|NIGHT\s+VISION|TACTICAL|LEH\b|LIGHT\s+ENFORCEMENT|MODIFICATION KIT",
    re.I,
)
BRAND_RX = re.compile(r"BRAND[\s-]*NAME|BRAND\s+ONLY|AIRBUS\s+ONLY|SOLE\s+BRAND", re.I)
MODEL_RX = re.compile(
    r"(H1[2-7]\d|AS-?350\w*|EC-?1[2-5]\d|BELL\s*\d{3}\w*|AW-?1\d\d\w*|MD\s*\d{3}\w*|R-?44|R-?66|"
    r"S-?76\w*|UH-?\d+\w*|HH-?\d+\w*|TH-?\d+\w*|MH-?\d+\w*)",
    re.I,
)
WORD_NUM = {"ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5, "SIX": 6, "SEVEN": 7,
            "EIGHT": 8, "NINE": 9, "TEN": 10, "ELEVEN": 11, "TWELVE": 12}
AIRCRAFT_NOUN = r"(?:[A-Z0-9/-]+\s+){0,3}(?:HELICOPTERS?|AIRCRAFT|AIRFRAMES?|LEHS?)\b"
# "(35) AIRCRAFT" beats "LOT 14 (35) AIRCRAFT"; then "SEVEN (7) H125 ... HELICOPTERS"; then "2 UH-60L CONVERSION AIRCRAFT".
QTY_RX_PAREN = re.compile(r"\((\d{1,3})\)\s*" + AIRCRAFT_NOUN, re.I)
QTY_RX = re.compile(
    r"\b(\d{1,3}|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE)\b\s*"
    r"(?:\(\d{1,3}\)\s*)?(?:EA\.?\s+|EACH\s+)?" + AIRCRAFT_NOUN,
    re.I,
)

# Seller classification. Extend from the vendor table; anything unlisted lands in "Unclassified".
VENDOR_CLASS = [
    (r"AIRBUS|EUROCOPTER|AMERICAN EUROCOPTER", "OEM"),
    (r"BELL\s+(TEXTRON|HELICOPTER)|TEXTRON", "OEM"),
    (r"LEONARDO|AGUSTA|ALENIA", "OEM"),
    (r"SIKORSKY|LOCKHEED", "OEM"),
    (r"MD HELICOPTERS|MCDONNELL DOUGLAS HELI", "OEM"),
    (r"ROBINSON HELICOPTER", "OEM"),
    (r"BOEING", "OEM"),
    (r"DAVENPORT AVIATION", "Authorized dealer"),
    (r"METRO AVIATION|AIR METHODS|HELIWERKS|ORIGIN AIR|HELICOPTER SPECIALTIES|"
     r"VECTOR AEROSPACE|STANDARDAERO|SPRINGSHOT|MAG AEROSPACE|ARCHANGEL|BRAND\s+AVIATION", "Completion / MRO"),
]

DOD_NAMES = re.compile(r"DEFENSE|DEPT OF THE (?:ARMY|NAVY|AIR FORCE)|^ARMY|^NAVY|^AIR FORCE", re.I)
CBP_RX = re.compile(r"CUSTOMS AND BORDER|U\.?S\.? CUSTOMS|\bCBP\b", re.I)


def load(paths):
    frames = []
    for p in paths:
        if not p:
            continue
        df = pd.read_csv(p, dtype=str, low_memory=False)
        df.columns = [c.strip().lower() for c in df.columns]
        out = pd.DataFrame(index=df.index)
        for canon, names in ALIASES.items():
            hit = next((n for n in names if n in df.columns), None)
            out[canon] = df[hit] if hit else pd.NA
        out["source_file"] = Path(p).name
        frames.append(out)
    if not frames:
        return pd.DataFrame(columns=list(ALIASES) + ["source_file"])
    df = pd.concat(frames, ignore_index=True)
    df["obligation"] = pd.to_numeric(df["obligation"], errors="coerce").fillna(0.0)
    df["offers"] = pd.to_numeric(df["offers"], errors="coerce")
    df["action_date"] = pd.to_datetime(df["action_date"], errors="coerce")
    fy = pd.to_numeric(df["fy"], errors="coerce")
    derived = df["action_date"].dt.year + (df["action_date"].dt.month >= 10).astype("Int64")
    df["fy"] = fy.fillna(derived).astype("Int64")
    for c in ["psc", "naics", "desc", "base_desc", "parent_piid", "parent_type", "vendor",
              "vendor_parent", "awarding_agency", "funding_agency", "funding_sub", "awarding_sub",
              "extent_competed", "not_competed_reason", "fair_opp", "award_type", "piid", "mod"]:
        df[c] = df[c].fillna("").astype(str).str.strip()
    if df["award_key"].isna().all() or (df["award_key"].astype(str) == "").all():
        df["award_key"] = df["piid"] + "|" + df["parent_piid"]
    df["award_key"] = df["award_key"].fillna(df["piid"] + "|" + df["parent_piid"]).astype(str)
    df["txn_key"] = df["txn_key"].fillna(df["award_key"] + "|" + df["mod"]).astype(str)
    return df


def segment(df):
    text = (df["desc"] + " " + df["base_desc"]).str.upper()
    df["text"] = text
    df["in_psc1520"] = df["psc"].str.upper().eq("1520")
    df["helo_text"] = text.str.contains(HELO_RX)
    # NAICS 336411 covers fixed-wing too; keep non-1520 rows only when the description names a helicopter.
    df["in_scope"] = df["in_psc1520"] | (df["naics"].str.startswith("336411") & df["helo_text"])
    df["customer_agency"] = df["funding_agency"].where(df["funding_agency"] != "", df["awarding_agency"])
    df["customer_sub"] = df["funding_sub"].where(df["funding_sub"] != "", df["awarding_sub"])
    df["is_dod_customer"] = df["customer_agency"].str.contains(DOD_NAMES)
    df["dod_program"] = text.str.contains(DOD_PROGRAM_RX)
    # CBP UH-60s are bought through Army contracts: DoD awarding, DHS funding. Keep them civilian by customer.
    df["segment"] = "Civilian"
    df.loc[df["is_dod_customer"], "segment"] = "DoD"
    df["is_cbp"] = df["customer_sub"].str.contains(CBP_RX) | df["awarding_sub"].str.contains(CBP_RX)
    return df


def vehicle(df):
    pp = df["parent_piid"].str.upper().str.replace("-", "", regex=False)
    ptype = df["parent_type"].str.upper()
    gsa_parent = pp.str.startswith("GS") | pp.str.startswith("47Q")
    v = pd.Series("Open market (definitive / PO)", index=df.index)
    v[pp != ""] = "Agency IDV order (IDIQ / BPA / BOA)"
    v[gsa_parent & ~ptype.str.contains("GWAC")] = "GSA MAS order / BPA"
    v[gsa_parent & ptype.str.contains("GWAC")] = "GSA GWAC order"
    v[ptype.str.contains("FSS")] = "GSA MAS order / BPA"
    v[(df["segment"] == "DoD") & df["dod_program"]] = "DoD program contract"
    df["vehicle"] = v
    return df


def competition_flags(df):
    ec = df["extent_competed"].str.upper()
    nc = df["not_competed_reason"].str.upper()
    fo = df["fair_opp"].str.upper()
    df["sole_source"] = (
        ec.str.match(r"^(B|C|G|NOT AVAILABLE|NOT COMPETED)")
        | fo.str.contains(r"ONE|UNIQUE|ONLY ONE|FOLLOW-?ON|URGENCY|LOGICAL", regex=True)
    )
    df["brand_name"] = (
        nc.str.contains(r"\bBND\b|BRAND", regex=True)
        | fo.str.contains(r"\bBND\b|BRAND", regex=True)
        | df["text"].str.contains(BRAND_RX)
    )
    return df


def parse_qty(text):
    m = QTY_RX_PAREN.search(text or "") or QTY_RX.search(text or "")
    if not m:
        return None
    tok = m.group(1).upper()
    n = int(tok) if tok.isdigit() else WORD_NUM.get(tok)
    return n if n and 0 < n <= 200 else None


def classify_vendor(name):
    for rx, label in VENDOR_CLASS:
        if re.search(rx, name or "", re.I):
            return label
    return "Unclassified"


def build_awards(df, overrides):
    """Roll transactions up to awards so per-aircraft price uses all mods, not just the base CLIN."""
    g = df.sort_values(["award_key", "action_date"]).groupby("award_key", sort=False)
    awards = g.agg(
        first_fy=("fy", "min"),
        piid=("piid", "first"),
        parent_piid=("parent_piid", "first"),
        customer_agency=("customer_agency", "first"),
        customer_sub=("customer_sub", "first"),
        segment=("segment", "first"),
        vehicle=("vehicle", "first"),
        vendor=("vendor", "first"),
        vendor_parent=("vendor_parent", "first"),
        is_cbp=("is_cbp", "max"),
        obligations=("obligation", "sum"),
        actions=("txn_key", "nunique"),
        offers=("offers", "max"),
        extent_competed=("extent_competed", "first"),
        sole_source=("sole_source", "max"),
        brand_name=("brand_name", "max"),
        text=("text", lambda s: " || ".join(dict.fromkeys(t for t in s if t))),
    ).reset_index()
    awards["parsed_qty"] = awards["text"].map(parse_qty)
    awards["model"] = awards["text"].map(lambda t: (MODEL_RX.search(t or "") or [None])[0])
    awards["configured"] = awards["text"].str.contains(CONFIG_RX)
    awards["seller_type"] = awards.apply(
        lambda r: classify_vendor(r["vendor_parent"] or r["vendor"]), axis=1)
    awards["quantity"] = awards["parsed_qty"]
    if overrides is not None and not overrides.empty:
        o = overrides.drop_duplicates("award_key", keep="last").set_index("award_key")
        for col in ["quantity", "configured", "model", "seller_type"]:
            if col not in o.columns:
                continue
            vals = o[col].replace("", pd.NA).dropna()
            if col == "quantity":
                vals = pd.to_numeric(vals, errors="coerce")
            if col == "configured":
                vals = vals.str.strip().str.upper().isin({"1", "TRUE", "Y", "YES"})
            m = awards["award_key"].map(vals)
            awards[col] = m.where(m.notna(), awards[col])
        awards["configured"] = awards["configured"].astype(bool)
    awards["unit_price"] = awards["obligations"] / awards["quantity"]
    return awards


def fy_pivot(df, by):
    t = df.groupby([by, df["fy"].astype(int)])["obligation"].sum().unstack()
    t = t.reindex(columns=range(FY_START, FY_END + 1)).fillna(0.0)
    t["Total"] = t.sum(axis=1)
    return t.sort_values("Total", ascending=False)


def lumpiness(series):
    s = series.reindex(range(FY_START, FY_END + 1), fill_value=0.0)
    mean = s.mean()
    return {
        "mean": mean,
        "median": s.median(),
        "min": s.min(),
        "max": s.max(),
        "coef_variation": (s.std(ddof=0) / mean) if mean else None,
        "max_year_share": (s.max() / s.sum()) if s.sum() else None,
        "zero_years": int((s <= 0).sum()),
    }


def cbp_share_matrix(core, awards):
    """Reproduce the '70 percent' figure under every plausible base so the source's definition can be matched."""
    rows = []
    bases = {
        "Civilian only": core[core["segment"] == "Civilian"],
        "All federal excl. DoD program aircraft": core[core["vehicle"] != "DoD program contract"],
        "All federal": core,
    }
    windows = [(FY_START, FY_END)] + [(y, y + 2) for y in range(FY_START, FY_END - 1)]
    for bname, b in bases.items():
        bawards = awards[awards["award_key"].isin(b["award_key"])]
        for lo, hi in windows:
            w = b[(b["fy"] >= lo) & (b["fy"] <= hi)]
            dol = w["obligation"].sum()
            cbp_dol = w.loc[w["is_cbp"], "obligation"].sum()
            aw = bawards[(bawards["first_fy"] >= lo) & (bawards["first_fy"] <= hi)]
            qty = aw["quantity"].sum(min_count=1)
            cbp_qty = aw.loc[aw["is_cbp"], "quantity"].sum(min_count=1)
            rows.append({
                "base": bname, "window": f"FY{lo % 100:02d}-FY{hi % 100:02d}",
                "dollars": dol, "cbp_dollars": cbp_dol,
                "cbp_share_dollars": cbp_dol / dol if dol else None,
                "aircraft": qty, "cbp_aircraft": cbp_qty,
                "cbp_share_aircraft": (cbp_qty / qty) if qty and pd.notna(qty) and pd.notna(cbp_qty) else None,
            })
    return pd.DataFrame(rows)


def competition_table(awards):
    a = awards[awards["obligations"] > 0]
    def summ(x):
        return pd.Series({
            "awards": len(x),
            "obligations": x["obligations"].sum(),
            "avg_offers": x["offers"].mean(),
            "median_offers": x["offers"].median(),
            "single_offer_rate": (x["offers"] == 1).mean() if x["offers"].notna().any() else None,
            "sole_source_rate": x["sole_source"].mean(),
            "brand_name_rate": x["brand_name"].mean(),
            "sole_source_dollar_share": x.loc[x["sole_source"], "obligations"].sum() / x["obligations"].sum()
            if x["obligations"].sum() else None,
        })
    return a.groupby(["segment", "vehicle"]).apply(summ, include_groups=False).reset_index()


def unit_price_table(awards, green_prices):
    a = awards[(awards["quantity"].notna()) & (awards["quantity"] > 0) & (awards["obligations"] > 0)].copy()
    a["model_norm"] = a["model"].fillna("UNKNOWN").str.upper().str.replace("-", "", regex=False)
    t = a.groupby(["segment", "model_norm", "configured", "vehicle"]).agg(
        awards=("award_key", "count"), aircraft=("quantity", "sum"),
        obligations=("obligations", "sum"), min_unit=("unit_price", "min"),
        max_unit=("unit_price", "max")).reset_index()
    t["wtd_unit_price"] = t["obligations"] / t["aircraft"]
    # Completion share: configured unit price vs. an observed green price for the same model, else a supplied list price.
    shares = []
    for model, grp in t.groupby("model_norm"):
        conf = grp[grp["configured"]]
        green = grp[~grp["configured"]]
        green_px = (green["obligations"].sum() / green["aircraft"].sum()) if not green.empty else None
        src = "observed green awards"
        if green_px is None and model in green_prices:
            green_px, src = green_prices[model], "supplied list price"
        if conf.empty or not green_px:
            continue
        conf_px = conf["obligations"].sum() / conf["aircraft"].sum()
        shares.append({"model": model, "configured_unit": conf_px, "green_unit": green_px,
                       "green_basis": src, "completion_share": 1 - green_px / conf_px})
    return t, pd.DataFrame(shares)


def srp_summary(path):
    s = pd.read_csv(path, dtype=str)
    s.columns = [c.strip().lower() for c in s.columns]
    sales_col = next(c for c in s.columns if "sales" in c or "amount" in c)
    fy_col = next(c for c in s.columns if "year" in c or c == "fy")
    cust_col = next((c for c in s.columns if "customer" in c or "type" in c or "level" in c), None)
    s[sales_col] = pd.to_numeric(s[sales_col].str.replace(r"[$,]", "", regex=True), errors="coerce")
    idx = [fy_col] + ([cust_col] if cust_col else [])
    return s.groupby(idx)[sales_col].sum().unstack(fill_value=0.0) if cust_col else s.groupby(idx)[sales_col].sum()


def adjacent_summary(adj):
    psc = adj["psc"].str.upper()
    bucket = pd.Series("Other", index=adj.index)
    bucket[psc.str.match(r"^V1")] = "Charter / exclusive-use aviation services (V1xx)"
    bucket[psc.str.match(r"^J01|^J015|^J016")] = "Aircraft maintenance & repair (J01x)"
    bucket[psc.str.match(r"^K01")] = "Aircraft modification (K01x)"
    bucket[psc.str.match(r"^1615|^1620|^1630|^1680|^2840|^2995")] = "Rotary-wing parts & components"
    bucket[psc.str.match(r"^1510|^1560")] = "Possible miscoded aircraft (1510/1560): review"
    adj = adj.assign(bucket=bucket)
    return fy_pivot(adj, "bucket")


def md(df, index=True, floatfmt=None):
    """Render a DataFrame as a GitHub markdown table without the tabulate dependency."""
    d = df.reset_index() if index else df
    def cell(v):
        if isinstance(v, float) and floatfmt and pd.notna(v):
            return format(v, floatfmt)
        return "" if v is None or (not isinstance(v, str) and pd.isna(v)) else str(v)
    head = "| " + " | ".join(str(c) for c in d.columns) + " |"
    sep = "|" + "---|" * len(d.columns)
    body = ["| " + " | ".join(cell(v) for v in row) + " |" for row in d.itertuples(index=False)]
    return "\n".join([head, sep] + body)


def money(x):
    return "n/a" if x is None or pd.isna(x) else f"${x / 1e6:,.1f}M"


def pct(x):
    return "n/a" if x is None or pd.isna(x) else f"{x * 100:.0f}%"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--psc", nargs="+", required=True, help="USAspending/FPDS export(s) filtered to PSC 1520")
    ap.add_argument("--naics", nargs="*", default=[], help="Export(s) filtered to NAICS 336411")
    ap.add_argument("--adjacent", nargs="*", default=[], help="Export(s) for V1xx, J01x, K01x, parts PSCs")
    ap.add_argument("--srp", help="SRP sales export for GS-07F-139DA (fiscal year, customer type, sales)")
    ap.add_argument("--overrides", help="CSV: award_key, quantity, configured, model, seller_type")
    ap.add_argument("--green-price", action="append", default=[], help="MODEL=price, e.g. H125=3800000")
    ap.add_argument("--out", default="outputs")
    args = ap.parse_args(argv)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    green = {k.upper().replace("-", ""): float(v) for k, v in (g.split("=", 1) for g in args.green_price)}
    overrides = pd.read_csv(args.overrides, dtype=str) if args.overrides else None
    if overrides is not None:
        overrides.columns = [c.strip().lower() for c in overrides.columns]

    raw = load(args.psc + args.naics)
    raw = raw.drop_duplicates("txn_key")
    df = competition_flags(vehicle(segment(raw)))
    df = df[(df["fy"] >= FY_START) & (df["fy"] <= FY_END)]
    core = df[df["in_scope"]].copy()
    review_out = df[~df["in_scope"]]
    review_out.to_csv(out / "excluded_naics_rows.csv", index=False)

    awards = build_awards(core, overrides)
    awards.drop(columns=["text"]).assign(description=awards["text"].str[:500]).to_csv(
        out / "award_review.csv", index=False)

    civ = core[core["segment"] == "Civilian"]
    annual_civ = civ.groupby("fy")["obligation"].sum()
    annual_dod = core[core["segment"] == "DoD"].groupby("fy")["obligation"].sum()
    by_customer = fy_pivot(core.assign(cust=core["segment"] + " / " + core["customer_agency"] + " / "
                                       + core["customer_sub"]), "cust")
    by_vehicle = fy_pivot(core.assign(sv=core["segment"] + " / " + core["vehicle"]), "sv")
    seller = awards.groupby(["segment", "seller_type", "vendor_parent"]).agg(
        awards=("award_key", "count"), obligations=("obligations", "sum")).reset_index().sort_values(
        "obligations", ascending=False)
    comp = competition_table(awards)
    unit, completion = unit_price_table(awards, green)
    cbp = cbp_share_matrix(core, awards)

    civ_total = civ["obligation"].sum()
    civ_mas = civ.loc[civ["vehicle"] == "GSA MAS order / BPA", "obligation"].sum()
    civ_awards = awards[(awards["segment"] == "Civilian") & (awards["obligations"] > 0)]
    full_cbp = cbp[(cbp["base"] == "Civilian only") & (cbp["window"] == f"FY{FY_START % 100:02d}-FY{FY_END % 100:02d}")]
    civ_conf = unit[(unit["segment"] == "Civilian") & unit["configured"]].groupby("model_norm")[
        ["obligations", "aircraft"]].sum()
    conf_by_model = (civ_conf["obligations"] / civ_conf["aircraft"]).to_dict()
    facts = {
        "window": f"FY{FY_START}-FY{FY_END} (FY{FY_END} incomplete; DoD lags ~90 days)",
        "civilian_annual": lumpiness(annual_civ),
        "dod_annual": lumpiness(annual_dod),
        "civilian_total": civ_total,
        "cbp_share_dollars_civilian_10yr": full_cbp["cbp_share_dollars"].iloc[0] if len(full_cbp) else None,
        "cbp_share_aircraft_civilian_10yr": full_cbp["cbp_share_aircraft"].iloc[0] if len(full_cbp) else None,
        "mas_share_civilian_dollars": civ_mas / civ_total if civ_total else None,
        "avg_offers_civilian": civ_awards["offers"].mean(),
        "single_offer_rate_civilian": (civ_awards["offers"] == 1).mean() if civ_awards["offers"].notna().any() else None,
        "brand_name_rate_civilian": civ_awards["brand_name"].mean() if len(civ_awards) else None,
        "configured_unit_price_civilian_by_model": conf_by_model,
        "completion_share": completion.to_dict("records"),
        "seller_types_civilian": seller[seller["segment"] == "Civilian"].groupby("seller_type")[
            "obligations"].sum().to_dict(),
        "awards_needing_quantity_review": int(((awards["quantity"].isna()) & (awards["obligations"] > 250_000)).sum()),
    }

    by_customer.to_csv(out / "by_customer.csv")
    by_vehicle.to_csv(out / "by_vehicle.csv")
    seller.to_csv(out / "by_seller.csv", index=False)
    comp.to_csv(out / "competition.csv", index=False)
    unit.to_csv(out / "unit_prices.csv", index=False)
    completion.to_csv(out / "completion_share.csv", index=False)
    cbp.to_csv(out / "cbp_share_matrix.csv", index=False)
    if args.adjacent:
        adj = load(args.adjacent).drop_duplicates("txn_key")
        adj = adj[(adj["fy"] >= FY_START) & (adj["fy"] <= FY_END)]
        adjacent_summary(adj).to_csv(out / "adjacent_spend.csv")
        facts["adjacent_total"] = adj["obligation"].sum()
    if args.srp:
        srp_summary(args.srp).to_csv(out / "srp_summary.csv")
    (out / "facts.json").write_text(json.dumps(facts, indent=2, default=lambda o: None if pd.isna(o) else float(o)))

    lines = [
        "# MCP 2026-15 helicopter market data: generated tables",
        f"\nWindow: {facts['window']}. Rows in scope: {len(core):,}; awards: {len(awards):,}; "
        f"NAICS-only rows excluded as non-helicopter: {len(review_out):,} (see excluded_naics_rows.csv).",
        "\n## Headline numbers",
        f"- Civilian obligations, 10-yr total: {money(civ_total)}; annual mean {money(facts['civilian_annual']['mean'])}, "
        f"median {money(facts['civilian_annual']['median'])}, range {money(facts['civilian_annual']['min'])}"
        f" to {money(facts['civilian_annual']['max'])}; largest single year = {pct(facts['civilian_annual']['max_year_share'])} of the decade.",
        f"- CBP share of civilian dollars (10 yr): {pct(facts['cbp_share_dollars_civilian_10yr'])}; "
        f"of civilian aircraft: {pct(facts['cbp_share_aircraft_civilian_10yr'])}",
        f"- Civilian dollars through GSA MAS: {pct(facts['mas_share_civilian_dollars'])}",
        f"- Civilian awards: mean offers {facts['avg_offers_civilian'] if pd.notna(facts['avg_offers_civilian']) else 'n/a'}, "
        f"single-offer rate {pct(facts['single_offer_rate_civilian'])}, brand-name rate {pct(facts['brand_name_rate_civilian'])}",
        "- Configured civilian unit price by model (weighted): "
        + (", ".join(f"{k} {money(v)}" for k, v in conf_by_model.items()) or "n/a"),
        f"- Awards over $250K still missing an aircraft count: {facts['awards_needing_quantity_review']} (fix in overrides)",
        "\n## Annual obligations, civilian vs DoD",
        md(pd.DataFrame({"Civilian": annual_civ, "DoD": annual_dod}).reindex(range(FY_START, FY_END + 1))
           .fillna(0).map(money)),
        "\n## By vehicle", md(by_vehicle.map(money)),
        "\n## CBP share under each base and window", md(cbp.assign(
            dollars=cbp["dollars"].map(money), cbp_dollars=cbp["cbp_dollars"].map(money),
            cbp_share_dollars=cbp["cbp_share_dollars"].map(pct),
            cbp_share_aircraft=cbp["cbp_share_aircraft"].map(pct)), index=False),
        "\n## Competition by vehicle", md(comp.assign(obligations=comp["obligations"].map(money)), index=False, floatfmt=".2f"),
        "\n## Unit prices", md(unit, index=False, floatfmt=",.0f"),
        "\n## Completion-work share", md(completion, index=False, floatfmt=",.2f") if len(completion)
        else "No model had both configured and green pricing. Supply --green-price MODEL=price.",
        "\n## Top 25 customers", md(by_customer.head(25).map(money)),
        "\n## Sellers", md(seller.head(30), index=False, floatfmt=",.0f"),
    ]
    (out / "tables.md").write_text("\n".join(lines) + "\n")
    print(f"Wrote {out}/tables.md, facts.json and CSVs. Review {out}/award_review.csv before quoting unit prices.")


if __name__ == "__main__":
    sys.exit(main())
