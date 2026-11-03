"""Render report charts (PNG) from output tables. Usage: python3 -I 05_charts.py <output_dir> <img_dir>"""
import sys, os
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
OUT, IMG = sys.argv[1], sys.argv[2]; os.makedirs(IMG, exist_ok=True)
MAS, OM, GRY, INK, MUTED, RULE = "#2a78d6", "#eb6834", "#9aa3af", "#111827", "#4b5563", "#dde1e7"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "axes.edgecolor": RULE, "axes.labelcolor": MUTED,
                     "xtick.color": MUTED, "ytick.color": INK, "axes.spines.top": False, "axes.spines.right": False, "axes.formatter.use_mathtext": False})

# 1 spend
t1 = pd.read_csv(os.path.join(OUT, "t1_spend_by_vehicle_fy_usd_millions.csv")).set_index("vehicle")["FY20-26 total"] / 1e3
rows = [("DoD-owned IDIQ, single award", t1["DoD-owned IDIQ (single award)"], GRY),
        ("DoD-owned IDIQ, multiple award", t1["DoD-owned IDIQ (MAC)"], GRY),
        ("Open market (stand-alone)", t1["Open market (stand-alone contract/PO)"], OM),
        ("GSA non-MAS IDIQ (OASIS-type)", t1["GSA non-MAS IDIQ (e.g., OASIS/OASIS+)"], GRY),
        ("GSA MAS (orders + BPA calls)", t1["GSA MAS (order)"] + t1["GSA MAS (BPA call)"], MAS),
        ("BOA orders", t1["BOA order"], GRY), ("Other agency IDIQ/GWAC", t1["Other agency IDIQ/GWAC"], GRY),
        ("Open-market BPA calls", t1["Open-market BPA call (FAR 13)"], GRY)]
fig, ax = plt.subplots(figsize=(7.5, 3.6), dpi=200)
y = range(len(rows))[::-1]
ax.barh(list(y), [r[1] for r in rows], color=[r[2] for r in rows], height=0.6)
ax.set_yticks(list(y)); ax.set_yticklabels([r[0] for r in rows])
for yi, r in zip(y, rows): ax.text(r[1] + 1, yi, f"\\${r[1]:.1f}B", va="center", fontsize=9, color=INK)
ax.set_xlabel(r"Obligations, FY2020 to FY2026 through Jul. 2026 (\$B)"); ax.grid(axis="x", color=RULE); ax.set_axisbelow(True)
ax.set_xlim(0, max(r[1] for r in rows) * 1.15)
fig.tight_layout(); fig.savefig(os.path.join(IMG, "c1_spend.png")); plt.close(fig)

# 2 dumbbell
t = pd.read_csv(os.path.join(OUT, "t6b_like_for_like_palt_by_band.csv"))
t = t[t.spec.str.endswith("| competed") & ~t.spec.str.startswith(">100M")].reset_index(drop=True)
lab = {"<=SAT": "≤ SAT", "SAT-1M": r"SAT to \$1M", "1M-7.5M": r"\$1M to \$7.5M", "7.5M-25M": r"\$7.5M to \$25M", "25M-100M": r"\$25M to \$100M"}
fig, ax = plt.subplots(figsize=(7.5, 3.2), dpi=200)
for i, r in t.iterrows():
    yy = len(t) - 1 - i
    ax.plot([r.weighted_median_MAS_days, r.weighted_median_OM_days], [yy, yy], color=GRY, lw=2, zorder=1)
    ax.scatter(r.weighted_median_MAS_days, yy, s=60, color=MAS, zorder=2, edgecolor="white", linewidth=1.5, label="GSA MAS" if i == 0 else None)
    ax.scatter(r.weighted_median_OM_days, yy, s=60, color=OM, zorder=2, edgecolor="white", linewidth=1.5, label="Open market" if i == 0 else None)
    ax.text(232, yy, f"{r.OM_minus_MAS_median_days:+.1f} d  [{r.ci95_low:.1f}, {r.ci95_high:.1f}]", va="center", fontsize=8.5, color=INK)
ax.set_yticks(range(len(t))); ax.set_yticklabels([lab[s.split(" |")[0]] for s in t.spec][::-1])
ax.set_xlim(0, 320); ax.set_xticks([0, 50, 100, 150, 200]); ax.set_xlabel("Weighted median PALT, days (competed buys, matched strata)")
ax.text(232, len(t) - 0.4, "Gap  [95% CI]", fontsize=8.5, color=MUTED)
ax.grid(axis="x", color=RULE); ax.set_axisbelow(True); ax.legend(loc="upper center", bbox_to_anchor=(0.35, 1.16), ncol=2, frameon=False, fontsize=9)
fig.tight_layout(); fig.savefig(os.path.join(IMG, "c2_palt.png")); plt.close(fig)

# 3 vehicles
v = pd.read_csv(os.path.join(OUT, "t10_vehicle_standup_vs_mas.csv"))
v = v[~v.sol_id.str.startswith("UNKNOWN")].head(15)
names = {"N0017818R7000": "SeaPort-NxG", "W52P1J16R0001": "LOGCAP V*", "W15P7T15R0008": "RS3", "H9240019R0003": "SOF Core Support",
         "N0002324R0001": "Probable WEXMAC 2.0*", "N0017821R7000": "SeaPort-NxG rolling admission"}
logi = {"W52P1J16R0001", "N0002324R0001"}
fig, ax = plt.subplots(figsize=(7.5, 4.4), dpi=200)
yy = list(range(len(v)))[::-1]
ax.barh(yy, v.vehicle_palt_days_fpds, color=[GRY if s not in logi else "#cfd4da" for s in v.sol_id], height=0.6)
ax.set_yticks(yy); ax.set_yticklabels([f"{names.get(s, '')}  {s}".strip() for s in v.sol_id], fontsize=8)
for y_, d in zip(yy, v.vehicle_palt_days_fpds): ax.text(d + 15, y_, f"{int(d)}", va="center", fontsize=8, color=INK)
ax.axvline(28, color=MAS, lw=2); ax.text(40, len(v) - 0.3, "MAS median order PALT: 28 days", color=MAS, fontsize=8.5)
ax.set_xlabel("Days from RFP release to first IDV award (FPDS)"); ax.set_xlim(0, 1800)
ax.grid(axis="x", color=RULE); ax.set_axisbelow(True)
fig.tight_layout(); fig.savefig(os.path.join(IMG, "c3_vehicles.png")); plt.close(fig)
print("ok")

# table data for the Word build (06_build_docx.cjs)
import json
t6 = pd.read_csv(os.path.join(OUT, "t6_like_for_like_palt.csv"))
data = {"t6": [[r.spec, f"{r.mas_n_matched:,}", f"{r.open_market_n_matched:,}", f"{r.weighted_median_MAS_days:.1f}",
                f"{r.weighted_median_OM_days:.1f}", f"{r.OM_minus_MAS_median_days:+.1f}", f"{r.ci95_low:+.1f} to {r.ci95_high:+.1f}"] for r in t6.itertuples()],
        "veh": [[names.get(r.sol_id, r.awarding_component), r.sol_id, r.solicitation_date, r.first_idv_award, f"{int(r.vehicle_palt_days_fpds)}",
                 f"{r.order_palt_median_days:g}", f"{r.order_obligations_fy20_26_usd_m / 1000:.2f}"] for r in v.itertuples()],
        "summary": json.load(open(os.path.join(OUT, "summary.json")))}
json.dump(data, open(os.path.join(IMG, "data.json"), "w"), indent=1, default=str)
