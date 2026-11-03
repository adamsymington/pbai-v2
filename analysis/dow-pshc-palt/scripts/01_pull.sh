#!/usr/bin/env bash
# Reproduces the raw pulls from the public USASpending.gov API (no key required).
# USASpending contract data is sourced from FPDS; field names follow the USASpending Data Dictionary.
# Usage: bash 01_pull.sh <raw_dir>
set -euo pipefail
RAW=${1:-raw}; mkdir -p "$RAW"; cd "$RAW"
API=https://api.usaspending.gov/api/v2
PSC='[["Service","R"],["Service","B"],["Service","U"]]'   # PSHC proxy scope, see METHODOLOGY.md
DOD_AWARD='{"type":"awarding","tier":"toptier","name":"Department of Defense"}'

request () { # $1=label $2=json
  curl -sS -X POST "$API/download/transactions/" -H 'Content-Type: application/json' -d "$2" > "req_$1.json"
  python3 -c "import json;print(json.load(open('req_$1.json'))['file_name'])"
}
fetch () { # $1=label
  f=$(python3 -c "import json;print(json.load(open('req_$1.json'))['file_name'])")
  until [ "$(curl -sS "$API/download/status?file_name=$f" | python3 -c 'import sys,json;print(json.load(sys.stdin)["status"])')" = finished ]; do sleep 20; done
  curl -sS -o "z_$1.zip" "https://files.usaspending.gov/generated_downloads/$f"
  unzip -o -q "z_$1.zip" -d "fy$1"; rm -f fy$1/Contracts_Subawards*
}

# 1) DoD-awarded award transactions (POs, definitive contracts, delivery/task orders, BPA calls), FY2020-FY2026 (FY2026 = whatever USASpending has published; DoD data posts with a 90-day delay)
for fy in 2020 2021 2022 2023 2024 2025 2026; do
  request $fy "{\"filters\":{\"award_type_codes\":[\"A\",\"B\",\"C\",\"D\"],\"agencies\":[$DOD_AWARD],\"time_period\":[{\"start_date\":\"$((fy-1))-10-01\",\"end_date\":\"$fy-09-30\"}],\"psc_codes\":{\"require\":$PSC}},\"file_format\":\"csv\"}"
done
# 2) DoD-awarded IDVs (IDCs and BPAs), FY2015-FY2026: used to classify BPA calls and to date internal vehicles
request idv "{\"filters\":{\"award_type_codes\":[\"IDV_B\",\"IDV_B_A\",\"IDV_B_B\",\"IDV_B_C\",\"IDV_E\"],\"agencies\":[$DOD_AWARD],\"time_period\":[{\"start_date\":\"2014-10-01\",\"end_date\":\"2026-09-30\"}],\"psc_codes\":{\"require\":$PSC}},\"file_format\":\"csv\"}"
# 3) GSA-awarded, DoD-funded actions (assisted acquisitions), FY2020-FY2026 (sensitivity check)
request gsaassist "{\"filters\":{\"award_type_codes\":[\"A\",\"B\",\"C\",\"D\"],\"agencies\":[{\"type\":\"funding\",\"tier\":\"toptier\",\"name\":\"Department of Defense\"},{\"type\":\"awarding\",\"tier\":\"toptier\",\"name\":\"General Services Administration\"}],\"time_period\":[{\"start_date\":\"2019-10-01\",\"end_date\":\"2026-09-30\"}],\"psc_codes\":{\"require\":$PSC}},\"file_format\":\"csv\"}"

for k in 2020 2021 2022 2023 2024 2025 2026 idv gsaassist; do fetch $k; done
