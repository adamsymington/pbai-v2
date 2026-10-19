#!/usr/bin/env python3
"""Write a small synthetic USAspending-format extract so analyze.py can be smoke-tested.

All rows are invented. None of these values may be quoted as market data.
"""

import csv
import sys
from pathlib import Path

COLS = [
    "contract_transaction_unique_key", "contract_award_unique_key", "award_id_piid", "modification_number",
    "parent_award_id_piid", "parent_award_type", "federal_action_obligation", "action_date",
    "action_date_fiscal_year", "awarding_agency_name", "awarding_sub_agency_name", "funding_agency_name",
    "funding_sub_agency_name", "recipient_name", "recipient_parent_name", "product_or_service_code",
    "naics_code", "extent_competed_code", "number_of_offers_received",
    "other_than_full_and_open_competition_code", "fair_opportunity_limited_sources_code",
    "award_type_code", "transaction_description",
]

DHS, CBP = "Department of Homeland Security", "U.S. Customs and Border Protection"
DOJ, DOD = "Department of Justice", "Department of Defense"


def row(key, mod, parent, ptype, amt, date, fy, aw, aws, fa, fas, vendor, parent_name, psc, naics,
        ec, offers, nc, fo, desc):
    return [f"{key}_{mod}", key, key.split("_")[0], mod, parent, ptype, amt, date, fy, aw, aws, fa, fas,
            vendor, parent_name, psc, naics, ec, offers, nc, fo, "C", desc]


ROWS = [
    # CBP MAS order: 7 configured H125s, base + configuration mod
    row("70B01C18F001_GS07F139DA", "0", "GS07F139DA", "FSS", "40000000", "2018-07-18", "2018", DHS, CBP, DHS,
        CBP, "DAVENPORT AVIATION INC", "DAVENPORT AVIATION INC", "1520", "336411", "A", "2", "", "BND",
        "SEVEN (7) H125 LIGHT ENFORCEMENT HELICOPTERS BRAND NAME"),
    row("70B01C18F001_GS07F139DA", "1", "GS07F139DA", "FSS", "5900000", "2018-12-01", "2019", DHS, CBP, DHS,
        CBP, "DAVENPORT AVIATION INC", "DAVENPORT AVIATION INC", "1520", "336411", "A", "", "", "",
        "MISSION EQUIPMENT CONFIGURATION"),
    # CBP MAS order 2026: 10 configured
    row("70B01C26F010_47QSWA21D0001", "0", "GS07F139DA", "FSS", "95507814", "2026-05-12", "2026", DHS, CBP, DHS,
        CBP, "DAVENPORT AVIATION INC", "DAVENPORT AVIATION INC", "1520", "336411", "A", "1", "", "BND",
        "10 H125 LEH CONFIGURED AIRCRAFT"),
    # CBP UH-60 through Army: DoD awards, DHS funds
    row("W58RGZ20C0001_", "0", "", "", "30000000", "2020-03-01", "2020", DOD, "Department of the Army", DHS,
        CBP, "SIKORSKY AIRCRAFT CORP", "LOCKHEED MARTIN CORP", "1520", "336411", "C", "1", "UNQ", "",
        "2 UH-60L CONVERSION AIRCRAFT FOR CBP"),
    # DOJ open-market green aircraft, competed
    row("15F06722C0001_", "0", "", "", "4200000", "2022-05-01", "2022", DOJ, "Federal Bureau of Investigation",
        DOJ, "Federal Bureau of Investigation", "AIRBUS HELICOPTERS INC", "AIRBUS SE", "1520", "336411", "A",
        "3", "", "", "ONE (1) NEW H125 HELICOPTER"),
    # DoD program buy
    row("W58RGZ19C0050_", "0", "", "", "250000000", "2019-06-01", "2019", DOD, "Department of the Army", DOD,
        "Department of the Army", "AIRBUS HELICOPTERS INC", "AIRBUS SE", "1520", "336411", "C", "1", "UNQ", "",
        "UH-72B LAKOTA LOT 14 (35) AIRCRAFT"),
    # NAICS 336411 fixed-wing row: must be excluded
    row("70Z02323C0001_", "0", "", "", "60000000", "2023-02-01", "2023", DHS, "U.S. Coast Guard", DHS,
        "U.S. Coast Guard", "LOCKHEED MARTIN CORP", "LOCKHEED MARTIN CORP", "1510", "336411", "C", "1", "UNQ", "",
        "HC-130J AIRCRAFT"),
    # NAICS row miscoded under 1680 but clearly a helicopter: must be kept
    row("140D0424F0001_GS07F139DA", "0", "GS07F139DA", "FSS", "8000000", "2024-08-01", "2024",
        "Department of the Interior", "U.S. Park Police", "Department of the Interior", "U.S. Park Police",
        "DAVENPORT AVIATION INC", "DAVENPORT AVIATION INC", "1680", "336411", "A", "1", "", "",
        "ONE CONFIGURED H125 HELICOPTER WITH FLIR AND HOIST"),
]


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    psc = [r for r in ROWS if r[15] == "1520"]
    with open(out / "psc1520.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(COLS)
        w.writerows(psc)
    with open(out / "naics336411.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(COLS)
        w.writerows(ROWS)  # overlaps PSC file on purpose to exercise de-duplication


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "fixture")
