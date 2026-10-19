#!/usr/bin/env python3
"""Pull every USAspending dataset the MCP 2026-15 analysis needs.

Uses the public USAspending API (no key required). Each pull is a
prime-transaction download (every modification, all columns), written as one
CSV in --out so analyze.py can read it directly.

Pulls:
    psc1520        Contracts, PSC 1520 (aircraft, rotary wing), FY2016 to date
    naics336411    Contracts, NAICS 336411 (aircraft manufacturing), FY2016 to date
    adjacent       Contracts, aviation services / MRO / modification / parts PSCs,
                   limited to helicopter keywords
    misc_1510      Contracts, PSC 1510 and 1560 with helicopter keywords (miscoding check)
    grants         Assistance, HSGP/OPSG (97.067) and Byrne JAG (16.738) with aircraft keywords
    davenport      Every order and modification under GS-07F-139DA (child awards of the IDV)

Usage:
    pip install requests
    python3 pull_usaspending.py --out data                 # everything
    python3 pull_usaspending.py --out data --only psc1520 davenport
    python3 pull_usaspending.py --dry-run                   # print request bodies, send nothing

Then:
    python3 analyze.py --psc data/psc1520.csv --naics data/naics336411.csv data/misc_1510.csv \
        --adjacent data/adjacent.csv --out outputs
"""

import argparse
import csv
import io
import json
import sys
import time
import zipfile
from pathlib import Path

import requests

API = "https://api.usaspending.gov/api/v2"
START, END = "2015-10-01", "2026-09-30"  # FY2016 through FY2026
CONTRACTS = ["A", "B", "C", "D"]          # BPA call, purchase order, delivery order, definitive contract
GRANTS = ["02", "03", "04", "05"]
HELO_KEYWORDS = ["helicopter", "rotorcraft", "rotary wing", "rotary-wing", "H125", "AS350", "UH-72", "UH-60"]
GSA_IDV_PIID = "GS07F139DA"

ADJACENT_PSC = [
    # Air charter and aviation services (fire, survey, passenger, cargo)
    "V111", "V112", "V113", "V114", "V119", "V121", "V122", "V123", "V124", "V125", "V126", "V127", "V129",
    # Aircraft maintenance, repair, modification
    "J015", "J016", "J017", "J019", "K015", "K016", "K017",
    # Rotary-wing components and parts
    "1615", "1620", "1630", "1680", "2840", "2995",
]


def time_period():
    return [{"start_date": START, "end_date": END}]


PULLS = {
    "psc1520": {
        "filters": {"time_period": time_period(), "award_type_codes": CONTRACTS, "psc_codes": ["1520"]},
    },
    "naics336411": {
        "filters": {"time_period": time_period(), "award_type_codes": CONTRACTS,
                    "naics_codes": {"require": ["336411"]}},
    },
    "adjacent": {
        "filters": {"time_period": time_period(), "award_type_codes": CONTRACTS,
                    "psc_codes": ADJACENT_PSC, "keywords": HELO_KEYWORDS},
    },
    "misc_1510": {
        "filters": {"time_period": time_period(), "award_type_codes": CONTRACTS,
                    "psc_codes": ["1510", "1560"], "keywords": HELO_KEYWORDS},
    },
    "grants": {
        "filters": {"time_period": time_period(), "award_type_codes": GRANTS,
                    "program_numbers": ["97.067", "16.738"],
                    "keywords": ["helicopter", "aircraft", "aviation", "rotorcraft"]},
    },
}


class Client:
    def __init__(self, dry_run=False):
        self.s = requests.Session()
        self.s.headers.update({"Content-Type": "application/json", "User-Agent": "mcp-2026-15-market-research"})
        self.dry_run = dry_run

    def call(self, method, path, body=None, params=None, tries=5):
        url = path if path.startswith("http") else f"{API}{path}"
        for attempt in range(tries):
            try:
                r = self.s.request(method, url, json=body, params=params, timeout=120)
                if r.status_code in (429, 500, 502, 503, 504):
                    raise requests.HTTPError(f"{r.status_code}: {r.text[:200]}")
                r.raise_for_status()
                return r.json()
            except (requests.ConnectionError, requests.Timeout, requests.HTTPError) as e:
                if attempt == tries - 1:
                    raise
                wait = 2 ** (attempt + 1)
                print(f"  retry in {wait}s after: {e}", file=sys.stderr)
                time.sleep(wait)


def bulk_transactions(client, name, spec, out_dir, poll=15, max_wait=3600):
    """Queue a prime-transaction download, wait for it, and merge the zipped CSVs into one file."""
    body = {"filters": spec["filters"], "columns": [], "file_format": "csv"}
    if client.dry_run:
        print(f"POST {API}/download/transactions/\n{json.dumps(body, indent=2)}\n")
        return None
    print(f"[{name}] queuing download")
    job = client.call("POST", "/download/transactions/", body)
    file_name = job["file_name"]
    waited = 0
    while True:
        st = client.call("GET", "/download/status/", params={"file_name": file_name})
        status = st.get("status")
        print(f"[{name}] {status} rows={st.get('total_rows')} elapsed={waited}s")
        if status == "finished":
            break
        if status == "failed":
            raise RuntimeError(f"[{name}] download failed: {st.get('message')}")
        if waited >= max_wait:
            raise TimeoutError(f"[{name}] not finished after {max_wait}s; status URL: {job.get('status_url')}")
        time.sleep(poll)
        waited += poll

    print(f"[{name}] fetching {st['file_url']}")
    z = requests.get(st["file_url"], timeout=600)
    z.raise_for_status()
    raw_dir = out_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    (raw_dir / f"{name}.zip").write_bytes(z.content)

    out_path = out_dir / f"{name}.csv"
    rows = 0
    with zipfile.ZipFile(io.BytesIO(z.content)) as zf, open(out_path, "w", newline="", encoding="utf-8") as out:
        # Large results are split across numbered files; keep only prime-transaction CSVs and one header.
        members = sorted(m for m in zf.namelist() if m.endswith(".csv") and "PrimeTransactions" in m)
        if not members:
            members = sorted(m for m in zf.namelist() if m.endswith(".csv"))
        writer = None
        for m in members:
            with zf.open(m) as f:
                reader = csv.reader(io.TextIOWrapper(f, encoding="utf-8-sig"))
                header = next(reader, None)
                if header is None:
                    continue
                if writer is None:
                    writer = csv.writer(out)
                    writer.writerow(header)
                for row in reader:
                    writer.writerow(row)
                    rows += 1
    print(f"[{name}] wrote {rows:,} rows to {out_path}")
    return out_path


def find_idv(client, piid):
    """Resolve a PIID to USAspending's generated award ID (needed by the IDV endpoints)."""
    body = {
        "filters": {"award_type_codes": ["IDV_A", "IDV_B", "IDV_B_A", "IDV_B_B", "IDV_B_C", "IDV_C", "IDV_D", "IDV_E"],
                    "award_ids": [piid], "time_period": [{"start_date": "2007-10-01", "end_date": END}]},
        "fields": ["Award ID", "Recipient Name", "generated_internal_id"],
        "limit": 10, "page": 1,
    }
    res = client.call("POST", "/search/spending_by_award/", body).get("results", [])
    hits = [r for r in res if str(r.get("Award ID", "")).replace("-", "").upper() == piid.replace("-", "").upper()]
    if not hits:
        raise LookupError(f"IDV {piid} not found; results were: {res}")
    return hits[0]["generated_internal_id"]


def davenport_orders(client, out_dir):
    """Every child order under GS-07F-139DA with every modification, flattened to one CSV."""
    if client.dry_run:
        print(f"Resolve {GSA_IDV_PIID} via POST {API}/search/spending_by_award/, then page "
              f"POST {API}/idvs/awards/ (child_awards) and POST {API}/transactions/ per order\n")
        return None
    idv = find_idv(client, GSA_IDV_PIID)
    print(f"[davenport] IDV id {idv}")

    orders, page = [], 1
    while True:
        res = client.call("POST", "/idvs/awards/", {"award_id": idv, "type": "child_awards",
                                                     "limit": 100, "page": page, "sort": "period_of_performance_start_date",
                                                     "order": "asc"})
        orders.extend(res.get("results", []))
        if not res.get("page_metadata", {}).get("hasNext"):
            break
        page += 1
    print(f"[davenport] {len(orders)} orders")

    rows = []
    for o in orders:
        gid = o.get("generated_unique_award_id")
        detail = client.call("GET", f"/awards/{gid}/")
        txns, tp = [], 1
        while True:
            t = client.call("POST", "/transactions/", {"award_id": gid, "limit": 100, "page": tp,
                                                        "sort": "action_date", "order": "asc"})
            txns.extend(t.get("results", []))
            if not t.get("page_metadata", {}).get("hasNext"):
                break
            tp += 1
        base = {
            "contract_award_unique_key": gid,
            "award_id_piid": o.get("piid"),
            "parent_award_id_piid": GSA_IDV_PIID,
            "parent_award_type": "FSS",
            "awarding_agency_name": (detail.get("awarding_agency") or {}).get("toptier_agency", {}).get("name"),
            "awarding_sub_agency_name": (detail.get("awarding_agency") or {}).get("subtier_agency", {}).get("name"),
            "funding_agency_name": (detail.get("funding_agency") or {}).get("toptier_agency", {}).get("name"),
            "funding_sub_agency_name": (detail.get("funding_agency") or {}).get("subtier_agency", {}).get("name"),
            "recipient_name": (detail.get("recipient") or {}).get("recipient_name"),
            "product_or_service_code": (detail.get("latest_transaction_contract_data") or {}).get("product_or_service_code"),
            "naics_code": (detail.get("latest_transaction_contract_data") or {}).get("naics"),
            "extent_competed_code": (detail.get("latest_transaction_contract_data") or {}).get("extent_competed"),
            "number_of_offers_received": (detail.get("latest_transaction_contract_data") or {}).get("number_of_offers_received"),
            "fair_opportunity_limited_sources_code": (detail.get("latest_transaction_contract_data") or {}).get("fair_opportunity_limited"),
            "prime_award_base_transaction_description": detail.get("description"),
            "pop_state": ((detail.get("place_of_performance") or {}).get("state_code")),
            "total_obligation": detail.get("total_obligation"),
            "base_and_all_options_value": detail.get("base_and_all_options"),
        }
        for t in txns:
            rows.append({**base,
                         "contract_transaction_unique_key": f"{gid}_{t.get('modification_number')}",
                         "modification_number": t.get("modification_number"),
                         "action_date": t.get("action_date"),
                         "federal_action_obligation": t.get("federal_action_obligation"),
                         "transaction_description": t.get("description"),
                         "action_type": t.get("action_type_description")})
        time.sleep(0.3)  # be polite; this is one call pair per order

    out_path = out_dir / "davenport_gs07f139da.csv"
    if rows:
        with open(out_path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
    print(f"[davenport] wrote {len(rows):,} transactions to {out_path}")
    return out_path


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="data")
    ap.add_argument("--only", nargs="+", choices=list(PULLS) + ["davenport"], help="Run a subset of pulls")
    ap.add_argument("--dry-run", action="store_true", help="Print request bodies without calling the API")
    args = ap.parse_args(argv)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    client = Client(dry_run=args.dry_run)
    wanted = args.only or list(PULLS) + ["davenport"]

    failures = []
    for name in wanted:
        try:
            if name == "davenport":
                davenport_orders(client, out_dir)
            else:
                bulk_transactions(client, name, PULLS[name], out_dir)
        except Exception as e:  # keep going so one bad pull doesn't cost the others
            failures.append((name, e))
            print(f"[{name}] FAILED: {e}", file=sys.stderr)

    manifest = {"pulled_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "window": [START, END],
                "pulls": {n: PULLS.get(n, {"source": "IDV child awards", "piid": GSA_IDV_PIID}) for n in wanted},
                "failures": {n: str(e) for n, e in failures}}
    if not args.dry_run:
        (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
