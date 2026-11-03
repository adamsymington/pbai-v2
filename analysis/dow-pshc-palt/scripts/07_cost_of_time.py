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
