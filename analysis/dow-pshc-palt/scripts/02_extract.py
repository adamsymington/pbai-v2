"""Reduce raw USASpending transaction CSVs to the columns this analysis uses.
Usage: python3 02_extract.py <raw_dir> <out_dir>
raw_dir holds fy2020..fy2026/, fyidv*/ and fygsa*/ subfolders produced by 01_pull.sh.
"""
import sys, glob, os
import pandas as pd

COLS = ["contract_transaction_unique_key","contract_award_unique_key","award_id_piid","modification_number",
 "parent_award_agency_id","parent_award_agency_name","parent_award_id_piid","federal_action_obligation",
 "base_and_exercised_options_value","base_and_all_options_value","action_date","action_date_fiscal_year",
 "period_of_performance_start_date","solicitation_date","solicitation_identifier","awarding_sub_agency_name",
 "awarding_office_name","recipient_uei","recipient_name","award_type_code","idv_type_code",
 "multiple_or_single_award_idv_code","type_of_contract_pricing_code","product_or_service_code",
 "product_or_service_code_description","naics_code","extent_competed_code","solicitation_procedures_code",
 "number_of_offers_received","type_of_set_aside_code","fair_opportunity_limited_sources_code",
 "other_than_full_and_open_competition_code","commercial_item_acquisition_procedures_code",
 "parent_award_type_code","parent_award_single_or_multiple_code","contracting_officers_determination_of_business_size_code",
 "undefinitized_action_code","national_interest_action_code","usaspending_permalink"]

raw, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
frames = []
for d in sorted(glob.glob(os.path.join(raw, "fy20[0-9][0-9]"))):
    for f in glob.glob(os.path.join(d, "Contracts_PrimeTransactions*.csv")):
        df = pd.read_csv(f, usecols=lambda c: c in COLS, dtype=str, low_memory=False)
        frames.append(df); print(f, len(df))
tx = pd.concat(frames, ignore_index=True).drop_duplicates("contract_transaction_unique_key")
tx.to_csv(os.path.join(out, "dod_pshc_award_transactions_fy20_fy26.csv.gz"), index=False)
print("award transactions", len(tx))
idv = []
for f in glob.glob(os.path.join(raw, "fyidv*", "**", "Contracts_PrimeTransactions*.csv"), recursive=True):
    idv.append(pd.read_csv(f, usecols=lambda c: c in COLS, dtype=str, low_memory=False))
idv = pd.concat(idv, ignore_index=True).drop_duplicates("contract_transaction_unique_key")
idv.to_csv(os.path.join(out, "dod_pshc_idv_transactions_fy15_fy26.csv.gz"), index=False)
print("idv transactions", len(idv))
gsa = []
for f in glob.glob(os.path.join(raw, "fygsa*", "Contracts_PrimeTransactions*.csv")):
    gsa.append(pd.read_csv(f, usecols=lambda c: c in COLS, dtype=str, low_memory=False))
if gsa:
    gsa = pd.concat(gsa, ignore_index=True).drop_duplicates("contract_transaction_unique_key")
    gsa.to_csv(os.path.join(out, "gsa_awarded_dod_funded_pshc_fy20_fy26.csv.gz"), index=False)
    print("gsa-assisted transactions", len(gsa))
