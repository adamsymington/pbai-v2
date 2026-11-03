"""Cost-of-time populations: the data side of the cost model. Assumptions live in the workbook, not here.
Usage: python3 -I 07_cost_of_time.py <output_dir> <data_dir>
Writes:
  c1_population_by_band.csv     open-market competed above-SAT new awards, by dollar band (addressable and all)
  c2_band_gaps.csv              matched PALT gap (open market minus MAS) by band, with 95% CI
  c3_year_end_timing.csv        share of new awards made in September / last 2 weeks of FY, by group
  c4_vehicle_families.csv       DoD MAC families used in the stand-up cost block
"""
import sys, os, json
import numpy as np
import pandas as pd

OUT, DATA = sys.argv[1], sys.argv[2]
b = pd.read_csv(os.path.join(OUT, "r2_new_awards_classified.csv.gz"), dtype={"psc4": str})
b["competed"] = b.competed.astype(str).str.lower().eq("true")
b["above_sat"] = b.above_sat.astype(str).str.lower().eq("true")
YEARS = 6 + 10 / 12  # FY2020-FY2025 plus FY2026 through July 2026

# Daily contract value: base-and-all-options value / potential period of performance (days); PoP < 30 days dropped
s = pd.to_datetime(b.period_of_performance_start_date, errors="coerce")
e = pd.to_datetime(b.period_of_performance_potential_end_date, errors="coerce")
b["pop_days"] = (e - s).dt.days
b["daily_value"] = np.where(b.pop_days >= 30, b.value / b.pop_days, np.nan)

om = b[(b.group == "Open market (Tier 0 proxy)") & b.competed & b.above_sat & b.value.notna()].copy()
mas = b[(b.group == "GSA MAS") & b.competed & b.above_sat]
keys = ["psc4", "band", "fy", "pricing"]
mas_strata = set(map(tuple, mas[keys].astype(str).drop_duplicates().values))
om["addressable"] = [tuple(x) in mas_strata for x in om[keys].astype(str).values]

order = ["SAT-1M", "1M-7.5M", "7.5M-25M", "25M-100M", ">100M"]
def agg(d):
    return pd.Series({"awards": len(d), "value_usd": d.value.sum(), "obligated_at_award_usd": d.obl.sum(),
                      "daily_value_sum_usd": d.daily_value.sum(skipna=True), "awards_with_pop": d.daily_value.notna().sum(),
                      "median_pop_days": d.pop_days.median()})
rows = []
for scope, d in [("Addressable (strata where MAS also bought)", om[om.addressable]), ("All open-market competed above SAT", om)]:
    g = d.groupby("band").apply(agg, include_groups=False).reindex(order).fillna(0)
    g.insert(0, "scope", scope)
    rows.append(g.reset_index())
c1 = pd.concat(rows, ignore_index=True)
c1["years_covered"] = round(YEARS, 4)
c1.to_csv(os.path.join(OUT, "c1_population_by_band.csv"), index=False)

t6b = pd.read_csv(os.path.join(OUT, "t6b_like_for_like_palt_by_band.csv"))
t6 = pd.read_csv(os.path.join(OUT, "t6_like_for_like_palt.csv"))
headline = t6[t6.spec == "E. Above SAT, competed"].iloc[0]
gaps = []
for band in order:
    r = t6b[t6b.spec == f"{band} | competed"]
    if band == ">100M" or r.empty:   # too few matched MAS awards in >$100M: use the pooled above-SAT competed estimate
        gaps.append([band, headline.OM_minus_MAS_median_days, headline.ci95_low, headline.ci95_high, "Pooled spec E (band too thin)"])
    else:
        r = r.iloc[0]
        gaps.append([band, r.OM_minus_MAS_median_days, r.ci95_low, r.ci95_high, f"Band estimate, {int(r.mas_n_matched)} MAS / {int(r.open_market_n_matched)} OM matched"])
pd.DataFrame(gaps, columns=["band", "gap_base_days", "gap_low_days", "gap_high_days", "basis"]).to_csv(os.path.join(OUT, "c2_band_gaps.csv"), index=False)

ad = pd.to_datetime(b.action_date)
b["sep"] = ad.dt.month.eq(9)
b["last2wk"] = (ad.dt.month.eq(9)) & (ad.dt.day >= 17)
yt = b[b.fy <= 2025].groupby("group").agg(new_awards=("sep", "size"), september_share=("sep", "mean"),
                                         last_two_weeks_share=("last2wk", "mean"), median_palt_days=("palt", "median"))
yt.to_csv(os.path.join(OUT, "c3_year_end_timing.csv"))

t10 = pd.read_csv(os.path.join(OUT, "t10_vehicle_standup_vs_mas.csv"))
t10 = t10[~t10.sol_id.str.startswith("UNKNOWN")].head(15)
names = {"N0017818R7000": "SeaPort-NxG", "W52P1J16R0001": "LOGCAP V", "W15P7T15R0008": "RS3", "H9240019R0003": "SOF Core Support",
         "N0002324R0001": "Probable WEXMAC 2.0", "N0017821R7000": "SeaPort-NxG rolling admission"}
logistics = {"W52P1J16R0001", "N0002324R0001"}
c4 = pd.DataFrame({"sol_id": t10.sol_id, "program": t10.sol_id.map(names).fillna(t10.awarding_component),
                   "awardees_idv_count": t10.idv_count, "standup_days": t10.vehicle_palt_days_fpds,
                   "order_obligations_fy20_26_usd": t10.order_obligations_fy20_26_usd_m * 1e6,
                   "mas_substitutable": np.where(t10.sol_id.isin(logistics), "No (contingency logistics)", "Assumed yes")})
# Awardee overlap with MAS: share of each family's awardee UEIs that also received >=1 DoD MAS order or MAS BPA call
# in FY20-26 (DoD-awarded, PSC R/B/U). A LOWER BOUND on MAS-holder share: firms holding MAS but with no DoD PSHC MAS order are missed.
tx = pd.read_csv(os.path.join(DATA, "dod_pshc_award_transactions_fy20_fy26.csv.gz"), dtype=str,
                 usecols=["recipient_uei", "parent_award_type_code", "award_type_code", "parent_award_id_piid"])
idv = pd.read_csv(os.path.join(DATA, "dod_pshc_idv_transactions_fy15_fy26.csv.gz"), dtype=str,
                  usecols=["award_id_piid", "solicitation_identifier", "recipient_uei", "idv_type_code", "parent_award_type_code"])
mas_bpas = set(idv[(idv.idv_type_code == "E") & (idv.parent_award_type_code == "C")].award_id_piid)
mas_ueis = set(tx[(tx.parent_award_type_code == "C") | tx.parent_award_id_piid.isin(mas_bpas)].recipient_uei.dropna())
fam_ueis = idv[idv.idv_type_code == "B"].dropna(subset=["solicitation_identifier"]).groupby("solicitation_identifier").recipient_uei.apply(lambda x: set(x.dropna()))
c4["awardee_ueis"] = c4.sol_id.map(lambda k: len(fam_ueis.get(k, set())))
c4["ueis_with_dod_mas_pshc_order"] = c4.sol_id.map(lambda k: len(fam_ueis.get(k, set()) & mas_ueis))
c4["mas_overlap_share_lower_bound"] = (c4.ueis_with_dod_mas_pshc_order / c4.awardee_ueis.replace(0, np.nan)).round(3)
c4.to_csv(os.path.join(OUT, "c4_vehicle_families.csv"), index=False)
print("distinct DoD PSHC MAS vendors:", len(mas_ueis)); print(c1.to_string()); print(pd.read_csv(os.path.join(OUT, "c2_band_gaps.csv")).to_string()); print(yt.to_string()); print(c4.to_string())

# ---------------- c5: extensions beyond the original potential end date (FAR 52.217-8 style) ----------------
txf = pd.read_csv(os.path.join(DATA, "dod_pshc_award_transactions_fy20_fy26.csv.gz"), dtype=str)
txf["pe"] = pd.to_datetime(txf.period_of_performance_potential_end_date, errors="coerce")
txf["obl"] = pd.to_numeric(txf.federal_action_obligation, errors="coerce").fillna(0)
mod0 = txf[txf.modification_number == "0"][["contract_award_unique_key", "pe", "period_of_performance_start_date"]] \
    .rename(columns={"pe": "orig_end", "period_of_performance_start_date": "pop_start"})
ext = mod0.merge(b[["contract_award_unique_key", "group", "vehicle", "psc4", "band", "fy", "pricing", "competed", "above_sat", "value"]],
                 on="contract_award_unique_key")
OBS_CUT = pd.Timestamp("2026-01-31")   # original end must be at least 6 months before the last published data
ext = ext[(ext.orig_end <= OBS_CUT) & ext.competed & ext.above_sat].copy()
final_end = txf[txf.contract_award_unique_key.isin(ext.contract_award_unique_key)].groupby("contract_award_unique_key").pe.max()
ext["ext_days"] = (ext.contract_award_unique_key.map(final_end) - ext.orig_end).dt.days.clip(lower=0)
ext["orig_pop"] = (ext.orig_end - pd.to_datetime(ext.pop_start, errors="coerce")).dt.days
ext = ext[ext.orig_pop >= 30]
ext["extended"] = (ext.ext_days > 0).astype(float)
ext["ext_share_of_pop"] = ext.ext_days / ext.orig_pop
raw = ext.groupby("group").agg(awards=("extended", "size"), extended_rate=("extended", "mean"),
                               mean_ext_days=("ext_days", "mean"), median_ext_days_if_extended=("ext_days", lambda s: s[s > 0].median()))
raw.insert(0, "measure", "Raw")
pm = ext[ext.group.isin(["GSA MAS", "Open market (Tier 0 proxy)"])].copy()
pm["mas"] = (pm.group == "GSA MAS").astype(int)
pm["s"] = pm[["psc4", "band", "fy", "pricing"]].astype(str).agg("|".join, axis=1)
g = pm.groupby(["s", "mas"]).agg(n=("extended", "size"), er=("extended", "mean"), ed=("ext_days", "mean")).unstack().dropna()
w = g[("n", 1)] / g[("n", 1)].sum()
matched = pd.DataFrame({"measure": "Matched (PSC4 x band x FY x pricing, MAS-weighted)",
                        "awards": [g[("n", 1)].sum(), g[("n", 0)].sum()],
                        "extended_rate": [(g[("er", 1)] * w).sum(), (g[("er", 0)] * w).sum()],
                        "mean_ext_days": [(g[("ed", 1)] * w).sum(), (g[("ed", 0)] * w).sum()],
                        "median_ext_days_if_extended": [np.nan, np.nan]}, index=["GSA MAS", "Open market (Tier 0 proxy)"])
c5 = pd.concat([raw, matched]).round(4)
c5.index.name = "group"
c5.to_csv(os.path.join(OUT, "c5_extensions.csv"))

# ---------------- c6: bridge-type awards (GAO-16-15 definition, applied to FPDS) ----------------
# A new award (mod 0) that is (a) not competed, (b) <= 12 months potential PoP, and (c) to the incumbent: the same
# recipient UEI, awarding office and 4-digit PSC held another award whose final potential end date fell within
# 180 days before to 30 days after the new award's start.
m0 = txf[txf.modification_number == "0"].copy()
m0["start"] = pd.to_datetime(m0.period_of_performance_start_date, errors="coerce")
m0["pop"] = (m0.pe - m0.start).dt.days
m0["psc4"] = m0.product_or_service_code.str[:4]
noncomp = (m0.award_type_code.isin(["B", "D"]) & m0.other_than_full_and_open_competition_code.isin(["ONE", "FOC", "URG", "UNQ"])) | \
          (m0.award_type_code.isin(["A", "C"]) & m0.fair_opportunity_limited_sources_code.isin(["FOO", "URG", "ONE"]))
cand = m0[noncomp & m0["pop"].between(1, 366)].copy()
aw = txf.assign(psc4=txf.product_or_service_code.str[:4]).groupby("contract_award_unique_key").agg(
    uei=("recipient_uei", "first"), office=("awarding_office_name", "first"), psc4=("psc4", "first"), end=("pe", "max"))
aw = aw.dropna(subset=["uei", "office", "end"])
key = aw.reset_index().groupby(["uei", "office", "psc4"])
lookup = {k: v[["contract_award_unique_key", "end"]].values for k, v in key}
def is_bridge(r):
    arr = lookup.get((r.recipient_uei, r.awarding_office_name, r.psc4))
    if arr is None or pd.isna(r.start): return False
    for k, e in arr:
        if k != r.contract_award_unique_key and (r.start - pd.Timedelta(days=180)) <= e <= (r.start + pd.Timedelta(days=30)):
            return True
    return False
cand["bridge"] = cand.apply(is_bridge, axis=1)
br = cand[cand.bridge].merge(b[["contract_award_unique_key", "group", "vehicle"]], on="contract_award_unique_key", how="left")
br["value"] = pd.to_numeric(br.base_and_all_options_value, errors="coerce")
br_obl = txf[txf.contract_award_unique_key.isin(br.contract_award_unique_key)].groupby("contract_award_unique_key").obl.sum()
br["obligated_fy20_26"] = br.contract_award_unique_key.map(br_obl)
c6 = br.groupby("group").agg(bridge_awards=("bridge", "size"), value_usd=("value", "sum"), obligated_usd=("obligated_fy20_26", "sum"),
                              median_pop_days=("pop", "median"))
c6.loc["All"] = [len(br), br.value.sum(), br.obligated_fy20_26.sum(), br["pop"].median()]
c6["per_year_obligated_usd"] = c6.obligated_usd / YEARS
c6.to_csv(os.path.join(OUT, "c6_bridge_type_awards.csv"))
br[["contract_award_unique_key", "award_id_piid", "group", "vehicle", "recipient_name", "awarding_office_name", "psc4", "start", "pop",
    "value", "obligated_fy20_26", "usaspending_permalink"]].to_csv(os.path.join(OUT, "r3_bridge_type_awards.csv.gz"), index=False)

# ---------------- c4 additions: predecessor status and daily order value ----------------
pred = {"N0017818R7000": ("Replacement", "Replaced SeaPort-e (NAVSEA 2020 industry brief)"),
        "N0017821R7000": ("Replacement", "On-ramp to existing SeaPort-NxG"),
        "W15P7T15R0008": ("Replacement", "Consolidated five existing or expiring Army IDIQs incl. S3 (GovConWire / Washington Technology)"),
        "H9240019R0003": ("Replacement", "Recompete of SOCOM Wide Mission Support (SWMS) suite (SAM notice via HigherGov)"),
        "W52P1J16R0001": ("Replacement", "Successor to LOGCAP IV")}
c4 = pd.read_csv(os.path.join(OUT, "c4_vehicle_families.csv"))
c4["predecessor_status"] = c4.sol_id.map(lambda k: pred.get(k, ("Unknown (treated as new)", ""))[0])
c4["predecessor_basis"] = c4.sol_id.map(lambda k: pred.get(k, ("", "No predecessor identified; verify on SAM.gov"))[1])
c4["daily_order_value_usd"] = c4.order_obligations_fy20_26_usd / (YEARS * 365)
c4.to_csv(os.path.join(OUT, "c4_vehicle_families.csv"), index=False)
print(c5.to_string()); print(c6.to_string()); print(c4[["program", "predecessor_status", "daily_order_value_usd"]].to_string())
