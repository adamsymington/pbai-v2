"""DoD/DoW professional services (PSHC proxy): open market (Tier 0 proxy) vs GSA MAS.
Spend mix, PALT, like-for-like PALT comparison, and DoD internal vehicle stand-up time.

Usage: python3 -I 03_analyze.py <data_dir> <out_dir>
Every number this script prints or writes is recomputable from the two .csv.gz files in data/,
which are column subsets of public USASpending.gov downloads (see 01_pull.sh).
"""
import sys, os, json
import numpy as np
import pandas as pd

DATA, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(20261103)

tx = pd.read_csv(os.path.join(DATA, "dod_pshc_award_transactions_fy20_fy26.csv.gz"), dtype=str)
idv = pd.read_csv(os.path.join(DATA, "dod_pshc_idv_transactions_fy15_fy26.csv.gz"), dtype=str)
tx["obl"] = pd.to_numeric(tx.federal_action_obligation, errors="coerce").fillna(0.0)
tx["fy"] = tx.action_date_fiscal_year.astype(int)

# ---------- 1. Vehicle classification ----------
# BPA parent lookup: a BPA call's parent is a BPA; the BPA's own parent tells us whether it sits on MAS (FSS).
bpa = (idv[idv.idv_type_code == "E"].sort_values("modification_number")
       .drop_duplicates("award_id_piid")[["award_id_piid", "parent_award_type_code", "parent_award_agency_id"]]
       .rename(columns={"award_id_piid": "parent_award_id_piid", "parent_award_type_code": "bpa_parent_type",
                        "parent_award_agency_id": "bpa_parent_agency"}))
tx = tx.merge(bpa, on="parent_award_id_piid", how="left")

def classify(r):
    at, pt, pa = r.award_type_code, r.parent_award_type_code, str(r.parent_award_agency_id)
    if at in ("B", "D") and pd.isna(pt):
        return "Open market (stand-alone contract/PO)"
    if at == "C" and pt == "C":
        return "GSA MAS (order)"
    if at == "A":
        if r.bpa_parent_type == "C":
            return "GSA MAS (BPA call)"
        if pd.isna(r.bpa_parent_type) and r.parent_award_id_piid in bpa_set:
            return "Open-market BPA call (FAR 13)"
        return "BPA call, parent not resolved"
    if at == "C" and pt == "B":
        if pa.startswith("97"):
            return "DoD-owned IDIQ (MAC)" if r.parent_award_single_or_multiple_code == "M" else "DoD-owned IDIQ (single award)"
        if pa.startswith("47"):
            return "GSA non-MAS IDIQ (e.g., OASIS/OASIS+)"
        return "Other agency IDIQ/GWAC"
    if at == "C" and pt == "A":
        return "Other agency IDIQ/GWAC"
    if at == "C" and pt == "D":
        return "BOA order"
    return "Other/unclassified"

bpa_set = set(bpa.parent_award_id_piid)
tx["vehicle"] = tx.apply(classify, axis=1)
GROUP = {
    "Open market (stand-alone contract/PO)": "Open market (Tier 0 proxy)",
    "GSA MAS (order)": "GSA MAS", "GSA MAS (BPA call)": "GSA MAS",
}
tx["group"] = tx.vehicle.map(GROUP).fillna("Other vehicles")

# ---------- 2. Spend mix (all transactions, obligations) ----------
spend = tx.pivot_table(index="vehicle", columns="fy", values="obl", aggfunc="sum").fillna(0)
spend["FY20-26 total"] = spend.sum(axis=1)
spend = spend.sort_values("FY20-26 total", ascending=False)
spend.loc["TOTAL"] = spend.sum()
(spend / 1e6).round(1).to_csv(os.path.join(OUT, "t1_spend_by_vehicle_fy_usd_millions.csv"))
share = tx.groupby(["fy", "group"]).obl.sum().unstack().fillna(0)
share = share.div(share.sum(axis=1), axis=0)
(share * 100).round(2).to_csv(os.path.join(OUT, "t2_spend_share_by_group_pct.csv"))

# ---------- 3. PALT on new awards ----------
b = tx[tx.modification_number == "0"].copy()
b["sol"] = pd.to_datetime(b.solicitation_date, errors="coerce")
b["awd"] = pd.to_datetime(b.action_date, errors="coerce")
b["palt"] = (b.awd - b.sol).dt.days
b["value"] = pd.to_numeric(b.base_and_all_options_value, errors="coerce")
b["offers"] = pd.to_numeric(b.number_of_offers_received, errors="coerce")
b["psc4"] = b.product_or_service_code.str[:4]
b["psc2"] = b.product_or_service_code.str[:2]
# Competition flag: stand-alone awards use Extent Competed; orders/calls use Fair Opportunity.
is_order = b.award_type_code.isin(["A", "C"])
comp_sa = b.extent_competed_code.isin(["A", "D", "F"])
comp_ord = b.fair_opportunity_limited_sources_code.isin(["FAIR", "CSA"])
b["competed"] = np.where(is_order, comp_ord, comp_sa)
# SAT was $250K through FY2025 and $350K from Oct 1, 2025 (FAC 2025-06, FAR Case 2024-001).
b["sat"] = np.where(b.fy >= 2026, 350e3, 250e3)
b["above_sat"] = b.value > b.sat
labels = ["<=SAT", "SAT-1M", "1M-7.5M", "7.5M-25M", "25M-100M", ">100M"]
b["band"] = np.select([b.value <= b.sat, b.value <= 1e6, b.value <= 7.5e6, b.value <= 25e6, b.value <= 100e6],
                      labels[:5], labels[5])
b.loc[b.value.isna(), "band"] = "nan"
b["pricing"] = np.select([b.type_of_contract_pricing_code.isin(["J", "K", "L", "A", "B"]),
                          b.type_of_contract_pricing_code.isin(["Y", "Z"]),
                          b.type_of_contract_pricing_code.isin(["R", "S", "T", "U", "V"])],
                         ["Fixed-price", "T&M/LH", "Cost-type"], "Other/combination")

# All new awards (with or without a solicitation date), classified, for the cost-of-time model (07_cost_of_time.py)
b[["contract_award_unique_key", "award_id_piid", "vehicle", "group", "fy", "action_date", "period_of_performance_start_date",
   "period_of_performance_potential_end_date", "psc4", "band", "sat", "above_sat", "pricing", "competed", "value", "obl", "palt"]] \
    .to_csv(os.path.join(OUT, "r2_new_awards_classified.csv.gz"), index=False)

cov = b.groupby(["fy", "group"]).apply(lambda d: pd.Series({
    "new_awards": len(d), "with_solicitation_date": d.sol.notna().sum(),
    "coverage_pct": round(100 * d.sol.notna().mean(), 1)}), include_groups=False).unstack("group")
cov.to_csv(os.path.join(OUT, "t3_solicitation_date_coverage.csv"))

valid = b[b.palt.between(0, 1095)].copy()   # 0-3 years; out-of-range values reported, not used
dq = {"new_awards_fy20_26": int(len(b)), "with_solicitation_date": int(b.sol.notna().sum()),
      "palt_negative": int((b.palt < 0).sum()), "palt_over_3yrs_excluded": int((b.palt > 1095).sum()),
      "palt_valid": int(len(valid)),
      "palt_zero_day_share_by_group": valid.groupby("group").palt.apply(lambda s: round(float((s == 0).mean()), 3)).to_dict()}

def summ(d):
    return pd.Series({"n": len(d), "median_days": d.palt.median(), "mean_days": round(d.palt.mean(), 1),
                      "p25": d.palt.quantile(.25), "p75": d.palt.quantile(.75), "p90": d.palt.quantile(.9),
                      "obligated_usd_m_at_award": round(d.obl.sum() / 1e6, 1)})
t4 = valid.groupby("vehicle").apply(summ, include_groups=False).sort_values("n", ascending=False)
t4.to_csv(os.path.join(OUT, "t4_palt_raw_by_vehicle.csv"))
t5 = valid.groupby(["group", "band"]).apply(summ, include_groups=False)
t5.to_csv(os.path.join(OUT, "t5_palt_raw_by_group_value_band.csv"))
t5b = valid.groupby(["fy", "group"]).palt.median().unstack()
t5b.to_csv(os.path.join(OUT, "t5b_median_palt_by_fy_group.csv"))

# ---------- 4. Like-for-like (coarsened exact matching) ----------
# Strata: 4-digit PSC x value band x fiscal year x pricing family x competed flag.
# Estimand: for the kind of buys DoD actually put on MAS, how much longer/shorter did
# the same kind of buy take on the open market? (weights = MAS count per stratum)
pair = valid[valid.group.isin(["GSA MAS", "Open market (Tier 0 proxy)"])].copy()
pair["mas"] = (pair.group == "GSA MAS").astype(int)

def cem(df, keys, label):
    df = df.copy()
    df["stratum"] = df[keys].astype(str).agg("|".join, axis=1)
    g = df.groupby(["stratum", "mas"]).palt
    med = g.median().unstack(); n = g.size().unstack()
    ok = med.dropna().index
    med, n = med.loc[ok], n.loc[ok]
    w = n[1] / n[1].sum()
    diff_med = float(((med[0] - med[1]) * w).sum())
    mean = g.mean().unstack().loc[ok]
    diff_mean = float(((mean[0] - mean[1]) * w).sum())
    # bootstrap the weighted median difference by resampling within strata
    sub = df[df.stratum.isin(ok)]
    groups = {k: v.palt.to_numpy() for k, v in sub.groupby(["stratum", "mas"])}
    boots = []
    for _ in range(500):
        tot = 0.0
        for s in ok:
            a = rng.choice(groups[(s, 0)], size=len(groups[(s, 0)]))
            m = rng.choice(groups[(s, 1)], size=len(groups[(s, 1)]))
            tot += (np.median(a) - np.median(m)) * w[s]
        boots.append(tot)
    lo, hi = np.percentile(boots, [2.5, 97.5])
    return {"spec": label, "strata_keys": " x ".join(keys), "matched_strata": int(len(ok)),
            "mas_n_matched": int(n[1].sum()), "open_market_n_matched": int(n[0].sum()),
            "mas_n_total": int(df.mas.sum()), "open_market_n_total": int((1 - df.mas).sum()),
            "weighted_median_MAS_days": round(float((med[1] * w).sum()), 1),
            "weighted_median_OM_days": round(float((med[0] * w).sum()), 1),
            "OM_minus_MAS_median_days": round(diff_med, 1),
            "ci95_low": round(float(lo), 1), "ci95_high": round(float(hi), 1),
            "OM_minus_MAS_mean_days": round(diff_mean, 1)}

base_keys = ["psc4", "band", "fy", "pricing", "competed"]
specs = [
    (pair, base_keys, "A. All new awards, exact strata"),
    (pair[pair.competed], base_keys, "B. Competed only"),
    (pair[pair.competed & (pair.offers >= 2)], base_keys, "C. Competed, >=2 offers"),
    (pair[pair.above_sat], base_keys, "D. Above SAT only"),
    (pair[pair.above_sat & pair.competed], base_keys, "E. Above SAT, competed"),
    (pair[pair.palt > 0], base_keys, "F. Excluding zero-day PALT records"),
    (pair, ["psc2", "band", "fy", "pricing", "competed"], "G. Coarser PSC (2-char)"),
    (pair, base_keys + ["awarding_sub_agency_name"], "H. Adds DoD component"),
]
t6 = pd.DataFrame([cem(d, k, l) for d, k, l in specs])
# Where does the gap live? Same matched design, run separately within each value band and competition status.
by_band = []
for bnd in labels:
    for comp in (True, False):
        d = pair[(pair.band == bnd) & (pair.competed == comp)]
        if d.mas.sum() >= 20 and (1 - d.mas).sum() >= 20:
            try:
                by_band.append(cem(d, base_keys, f"{bnd} | {'competed' if comp else 'not competed'}"))
            except Exception:
                pass
t6b = pd.DataFrame(by_band)
t6b.to_csv(os.path.join(OUT, "t6b_like_for_like_palt_by_band.csv"), index=False)
# Composition: why raw medians look similar - mix of competition and pricing in each group
mix = pair.groupby("group").agg(n=("palt", "size"), competed_share=("competed", "mean"),
                                fixed_price_share=("pricing", lambda s: (s == "Fixed-price").mean()),
                                above_sat_share=("above_sat", "mean"),
                                median_value=("value", "median")).round(3)
mix.to_csv(os.path.join(OUT, "t6c_population_mix.csv"))
t6.to_csv(os.path.join(OUT, "t6_like_for_like_palt.csv"), index=False)

# Regression check: log(1+PALT) on MAS flag with stratum fixed effects (within-stratum demeaning)
def fe_reg(df, keys):
    df = df.copy(); df["y"] = np.log1p(df.palt)
    df["stratum"] = df[keys].astype(str).agg("|".join, axis=1)
    mixed = df.groupby("stratum").mas.transform(lambda s: s.nunique() == 2)
    df = df[mixed]
    yd = df.y - df.groupby("stratum").y.transform("mean")
    xd = df.mas - df.groupby("stratum").mas.transform("mean")
    beta = float((xd * yd).sum() / (xd ** 2).sum())
    resid = yd - beta * xd
    # cluster-robust SE by stratum
    sc = (xd * resid).groupby(df.stratum).sum()
    se = float(np.sqrt((sc ** 2).sum()) / (xd ** 2).sum())
    return {"beta_log": round(beta, 4), "se": round(se, 4), "pct_effect_MAS_vs_OM": round(100 * (np.exp(beta) - 1), 1),
            "ci95_pct": [round(100 * (np.exp(beta - 1.96 * se) - 1), 1), round(100 * (np.exp(beta + 1.96 * se) - 1), 1)],
            "n": int(len(df))}
reg = {"all": fe_reg(pair, base_keys), "competed_above_SAT": fe_reg(pair[pair.competed & pair.above_sat], base_keys)}

# Like-for-like spend: within PSC4 x band, what share of DoD obligations went open market vs MAS
lfl_psc = (tx.assign(psc4=tx.product_or_service_code.str[:4])
           .groupby(["psc4", "group"]).obl.sum().unstack().fillna(0))
lfl_psc["mas_share_pct"] = 100 * lfl_psc.get("GSA MAS", 0) / lfl_psc.sum(axis=1)
lfl_psc = lfl_psc.sort_values("Open market (Tier 0 proxy)", ascending=False)
desc = tx.drop_duplicates("product_or_service_code").set_index("product_or_service_code").product_or_service_code_description
lfl_psc.insert(0, "psc_description", lfl_psc.index.map(desc))
(lfl_psc.head(40)).round(0).to_csv(os.path.join(OUT, "t7_top_psc_open_market_vs_mas_obligations.csv"))

# Record-level file so any single PALT value can be checked against USASpending/FPDS
valid[valid.group.isin(["GSA MAS", "Open market (Tier 0 proxy)"])][[
        "contract_award_unique_key", "award_id_piid", "parent_award_id_piid", "vehicle", "group", "fy",
        "awarding_sub_agency_name", "product_or_service_code", "band", "pricing", "competed", "offers",
        "solicitation_date", "action_date", "palt", "value", "usaspending_permalink"]] \
    .to_csv(os.path.join(OUT, "r1_record_level_palt_mas_and_open_market.csv.gz"), index=False)

# ---------- 5. DoD internal vehicles: stand-up PALT ----------
iv = idv[(idv.idv_type_code == "B") & idv.multiple_or_single_award_idv_code.eq("M")].copy()
iv["sol"] = pd.to_datetime(iv.solicitation_date, errors="coerce")
ivb = iv.sort_values("modification_number").drop_duplicates("award_id_piid")  # base record where present
ivb = ivb.assign(base_present=ivb.modification_number.eq("0"),
                 awd=pd.to_datetime(ivb.action_date, errors="coerce"))
orders = tx[tx.parent_award_id_piid.isin(ivb.award_id_piid)]
ob = orders.groupby("parent_award_id_piid").obl.sum()
ivb["order_obl"] = ivb.award_id_piid.map(ob).fillna(0)
ivb["sol_id"] = ivb.solicitation_identifier.fillna("UNKNOWN:" + ivb.award_id_piid)
fam = ivb.groupby("sol_id").agg(
    idv_count=("award_id_piid", "nunique"), first_idv_award=("awd", "min"), last_idv_award=("awd", "max"),
    solicitation_date=("sol", "min"), base_records_in_window=("base_present", "sum"),
    order_obligations_fy20_26_usd_m=("order_obl", lambda s: round(s.sum() / 1e6, 1)),
    awarding_component=("awarding_sub_agency_name", lambda s: s.mode().iat[0]),
    example_piid=("award_id_piid", "first"))
fam["vehicle_palt_days_fpds"] = (fam.first_idv_award - fam.solicitation_date).dt.days
# A solicitation date later than the first award means the earliest IDVs carry an on-ramp/amended date: not usable.
fam["vehicle_palt_flag"] = np.where(fam.vehicle_palt_days_fpds < 0, "excluded: sol date after first award (on-ramp/amendment)",
                                    np.where(fam.base_records_in_window == 0, "no base record in FY15-25 window", ""))
fam.loc[fam.vehicle_palt_days_fpds < 0, "vehicle_palt_days_fpds"] = np.nan
fam = fam.sort_values("order_obligations_fy20_26_usd_m", ascending=False)
# order-level PALT on each family (vs MAS)
op = valid[valid.parent_award_id_piid.isin(ivb.award_id_piid)].copy()
op["sol_id"] = op.parent_award_id_piid.map(ivb.set_index("award_id_piid").sol_id)
fam["order_palt_median_days"] = op.groupby("sol_id").palt.median()
fam["orders_with_palt"] = op.groupby("sol_id").palt.size()
fam.head(25).to_csv(os.path.join(OUT, "t8_dod_mac_families_top25.csv"))

mas_order_palt = float(valid[valid.group == "GSA MAS"].palt.median())

# Data-integrity check: an order whose solicitation date precedes its parent IDV's award date is
# probably carrying the parent's RFP date (or a concurrent base+first order). Flag and test without them.
idv_base = idv[idv.idv_type_code == "B"].sort_values("modification_number").drop_duplicates("award_id_piid") \
    .set_index("award_id_piid")
valid["parent_idv_award"] = pd.to_datetime(valid.parent_award_id_piid.map(idv_base.action_date), errors="coerce")
valid["sol_before_parent"] = valid.sol < valid.parent_idv_award
integrity = valid[valid.vehicle.str.startswith("DoD-owned")].groupby("vehicle").sol_before_parent.mean().round(3).to_dict()

# Like-for-like: DoD-owned MAC orders vs GSA MAS (same CEM design)
mac = valid[(valid.vehicle == "DoD-owned IDIQ (MAC)") & ~valid.sol_before_parent.fillna(False).astype(bool)]
pair2 = pd.concat([mac.assign(mas=0), valid[valid.group == "GSA MAS"].assign(mas=1)])
t9 = pd.DataFrame([
    cem(pair2, base_keys, "MAC-A. DoD MAC orders vs MAS, exact strata"),
    cem(pair2[pair2.competed], base_keys, "MAC-B. Competed only"),
    cem(pair2[pair2.competed & pair2.above_sat], base_keys, "MAC-C. Competed, above SAT"),
]).rename(columns={"open_market_n_matched": "dod_mac_n_matched", "open_market_n_total": "dod_mac_n_total",
                   "weighted_median_OM_days": "weighted_median_DoD_MAC_days",
                   "OM_minus_MAS_median_days": "MAC_minus_MAS_median_days", "OM_minus_MAS_mean_days": "MAC_minus_MAS_mean_days"})
t9.to_csv(os.path.join(OUT, "t9_like_for_like_dod_mac_vs_mas.csv"), index=False)

# Time to first competed order: vehicle PALT (FPDS) + median order PALT on that vehicle, vs MAS order PALT
fam_ok = fam[fam.vehicle_palt_days_fpds.notna() & fam.order_palt_median_days.notna()].head(15).copy()
fam_ok["time_to_first_order_days"] = fam_ok.vehicle_palt_days_fpds + fam_ok.order_palt_median_days
fam_ok["mas_order_palt_median_days"] = mas_order_palt
fam_ok["excess_days_vs_mas"] = fam_ok.time_to_first_order_days - mas_order_palt
fam_ok.to_csv(os.path.join(OUT, "t10_vehicle_standup_vs_mas.csv"))
print(t9.to_string()); print(fam_ok.to_string())
# Sensitivity: DoD-funded actions that GSA awarded (assisted acquisition) - not in the DoD-awarded population above
ga_path = os.path.join(DATA, "gsa_awarded_dod_funded_pshc_fy20_fy26.csv.gz")
assisted = {}
if os.path.exists(ga_path):
    ga = pd.read_csv(ga_path, dtype=str)
    ga["obl"] = pd.to_numeric(ga.federal_action_obligation, errors="coerce").fillna(0)
    lab = {"C": "GSA MAS (order)", "E": "BPA call", "B": "IDIQ (e.g., OASIS)", "A": "GWAC"}
    ga["vehicle"] = ga.parent_award_type_code.map(lab).fillna("Stand-alone / open market")
    assisted = (ga.groupby("vehicle").obl.sum() / 1e9).round(2).to_dict()
    (ga.pivot_table(index="vehicle", columns=ga.action_date_fiscal_year, values="obl", aggfunc="sum").fillna(0) / 1e6) \
        .round(1).to_csv(os.path.join(OUT, "t11_gsa_assisted_dod_funded_usd_millions.csv"))

mc = tx[tx.fy == 2026].action_date.str[:7].value_counts()
latest = pd.to_datetime(tx[tx.action_date.str[:7].isin(mc[mc >= 500].index)].action_date).max().strftime("%Y-%m-%d")  # last date in a month with >=500 actions
fy26_months = tx[tx.fy == 2026].action_date.str[:7].value_counts().sort_index().to_dict()
summary = {"latest_action_date_published": latest, "fy26_transactions_by_month": fy26_months, "gsa_assisted_dod_funded_usd_b": assisted, "data_quality": dq, "regression_fe": reg, "order_sol_date_before_parent_idv_award_share": integrity, "mas_median_order_palt_days": mas_order_palt,
           "spend_total_usd_b_fy20_26": round(tx.obl.sum() / 1e9, 2),
           "spend_by_group_usd_b_fy20_26": (tx.groupby("group").obl.sum() / 1e9).round(2).to_dict()}
json.dump(summary, open(os.path.join(OUT, "summary.json"), "w"), indent=2, default=str)
print(json.dumps(summary, indent=2, default=str))
print(t4.to_string()); print(t6.to_string()); print(fam.head(15).to_string())
