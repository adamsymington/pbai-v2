# DoD/DoW Professional Services: Open Market (Tier 0) vs GSA MAS — Spend and PALT, FY2020–FY2026 (through Jul. 2026)

Every figure in this analysis is computed from public USASpending.gov contract data, which is sourced from FPDS.
Anyone can rerun it end to end:

```bash
bash scripts/01_pull.sh raw            # ~10 min; public API, no key
python3 -I scripts/02_extract.py raw data
python3 -I scripts/03_analyze.py data output
python3 -I scripts/04_export_xlsx.py output DoD_PSHC_MAS_vs_OpenMarket_FY20-26.xlsx   # then recalc in Excel/LibreOffice
python3 -I scripts/05_charts.py output docx_build                 # charts + table data for the Word build
node scripts/06_build_docx.cjs docx_build DoD_PSHC_MAS_vs_OpenMarket_FY20-26.docx
```

FY2026 is partial: DoD contract data posts to FPDS/USASpending with a 90-day delay, so the Nov. 3, 2026 pull runs
through July 31, 2026. The SAT used for dollar bands is $250K through FY2025 and $350K from Oct. 1, 2025 (FAC 2025-06).

`data/` holds the column-subset extracts actually analyzed, so the run reproduces without re-pulling.
`output/r1_record_level_palt_mas_and_open_market.csv.gz` lists every MAS and open-market award used in the PALT
comparison, with PIID, solicitation date, award date, PALT and the USASpending permalink. Any single data point can
be checked against the public record.

## Definitions

| Term | Operational definition | Source field(s) |
|---|---|---|
| DoD / DoW | Awarding toptier agency = Department of Defense (097). "Department of War" is the secondary title under EO 14347 (Sept. 2025); the data still carries DoD. | `awarding_agency` filter |
| PSHC scope (proxy) | PSC families **R** (professional, administrative and management support), **B** (special studies and analyses) and **U** (education and training). This approximates the Professional Services and Human Capital categories. It is not GSA's official PSC-to-category crosswalk. | `product_or_service_code` |
| PALT | Solicitation issue date to award date, in days, for the initial action (modification 0). This follows the Section 878 (FY2019 NDAA) and OFPP Jan. 14, 2021 memo definition. | `action_date − solicitation_date` |
| GSA MAS | Orders whose referenced IDV type is FSS (`parent_award_type_code = C`), plus BPA calls under BPAs whose own parent is FSS. | `parent_award_type_code`, BPA lookup from IDV file |
| Open market (Tier 0 proxy) | Stand-alone definitive contracts and purchase orders (`award_type_code` D or B) with no referenced IDV. | `award_type_code`, `parent_award_type_code` |
| DoD-owned IDIQ (MAC / single) | Task and delivery orders under IDCs whose referenced IDV agency is DoD (97xx), split by `parent_award_single_or_multiple_code`. | |
| Competed | Stand-alone: Extent Competed A/D/F. Orders: Fair Opportunity = FAIR or CSA. | |

### Tier 0 caveat (read this before quoting "Tier 0")
OMB's spend-under-management tiers are: Tier 3 = BIC, Tier 2 = multi-agency/government-wide (MAS is Tier 2), Tier 1 =
agency-wide mandatory, Tier 0 = everything else. The official tier for each contract is assigned in GSA's
category-management data, which is not public at the transaction level. Here, "open market" (stand-alone contracts and
POs) is used as a **floor estimate of Tier 0**. The official Tier 0 is larger, because it also includes DoD single-award
IDIQs and other vehicles that carry no SUM designation. Do not describe the $83.1B open-market figure as "DoD's Tier 0
spend". Call it "open-market (stand-alone) spend, a subset of Tier 0".

## Like-for-like method
Coarsened exact matching. Each MAS award is compared only with open-market awards in the same
**4-digit PSC × dollar band × fiscal year × pricing family × competed/not-competed** stratum. Within-stratum medians are
differenced and weighted by MAS count, so the result answers: for the kinds of buys DoD actually put on MAS, how much
longer did the same kind of buy take on the open market? 95% CIs come from a within-stratum bootstrap (500 draws).
A log-PALT fixed-effects regression with stratum-clustered SEs is reported as a check. Eight alternative specifications
are reported in `output/t6_like_for_like_palt.csv`.

Dollar bands use base-and-all-options value at award: ≤SAT, SAT–1M, $1M–7.5M, $7.5M–25M,
$25M–100M, >$100M, with the first cut at the SAT in force for that fiscal year.

## Known limitations (stated up front so nobody else gets to state them first)
1. **Solicitation-date coverage is partial**: about 36–66% of new awards, depending on group and year
   (`output/t3_solicitation_date_coverage.csv`). PALT results describe the records that report a date. Coverage is
   lower for MAS in the partial FY2026 (36%).
2. **PALT excludes pre-solicitation time.** That covers requirements definition, market research, acquisition strategy
   and draft RFPs, which is where much of the real time goes. Real acquisition lead time is longer than PALT for every
   group.
3. PALT values over 3 years (782 records) are excluded as likely data errors. None were negative.
4. 17% of DoD MAC orders and 7% of single-award orders report a solicitation date earlier than the parent IDV's award
   date, probably the IDV's RFP date or a concurrent base and first order. These are excluded from the MAC-vs-MAS
   comparison.
5. Vehicle stand-up time uses the IDV record's FPDS solicitation date, which is the RFP release, to first IDV award. It
   **understates** development time because draft RFPs, RFIs and industry days come earlier. Press-reported dates
   corroborate the FPDS dates for SeaPort-NxG, RS3 and LOGCAP V (see report).
6. Scope is DoD-**awarded** actions. GSA-awarded, DoD-funded assisted acquisitions ($44.0B FY20–26, mostly OASIS-type
   IDIQs; only $2.2B MAS) are reported separately in `t11`.
7. FPDS data is entered by contracting offices and has known error rates. Nothing here corrects source data. Every
   record is traceable to its public permalink.

## Output index
| File | Contents |
|---|---|
| t1 | Obligations by vehicle type × FY ($M) |
| t2 | Share of obligations: MAS / open market / other |
| t3 | Solicitation-date coverage |
| t4, t5, t5b | Raw PALT by vehicle, by dollar band, by FY |
| t6, t6b, t6c | Like-for-like PALT: open market vs MAS, overall, by band, population mix |
| t7 | Top PSCs: open-market vs MAS obligations |
| t8, t10 | DoD MAC families: stand-up PALT, order PALT, time to first order vs MAS |
| t9 | Like-for-like PALT: DoD MAC orders vs MAS |
| t11 | GSA-assisted, DoD-funded actions |
| summary.json | Data quality counts, regression results, totals |

## Cost-of-time model (internal research)
```bash
python3 -I scripts/07_cost_of_time.py output data                                   # populations, gaps, year-end check, vehicle families
python3 -I scripts/08_cost_workbook.py output DoD_PSHC_MAS_vs_OpenMarket_FY20-26.xlsx  # adds Cost Summary/Inputs/Population/Model/Vehicle Cost tabs
node scripts/09_cost_memo.cjs DoD_PSHC_Cost_of_Time_Memo.docx
```
All assumptions sit in the workbook's **Cost Inputs** tab (blue = input, yellow = judgment call, each with source/logic);
every result is a formula. `04_export_xlsx.py` rebuilds the workbook without the cost tabs, so run `08` after it.
The memo's figures are copied from the Cost Summary tab at base inputs; regenerate it if inputs change.
