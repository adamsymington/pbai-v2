#!/usr/bin/env python3
"""MAS market map: open market vs MAS vs other vehicles, by MAS large category and SIN.

Four steps, each resumable:

  1. rank     Parse an SSQ+ export (Large Category x SIN, FY2024-FY2026), keep the top N SINs
              per category that have a NAICS equivalent, and write top_sins.csv plus the
              SIN-to-NAICS crosswalk it used (edit naics_overrides.csv to correct any mapping).

  2. pull     For every NAICS in top_sins.csv and every fiscal year, download USAspending
              contract transactions, classify each dollar by vehicle, and write compact
              aggregates (by funding office / AAC, awarding office, vehicle) plus award-level
              records for non-MAS awards. Raw zips are deleted after processing.

  3. resolve  Look up the parent of every BPA that received BPA-call obligations, so calls
              under MAS BPAs count as MAS and calls under agency BPAs count as agency.

  4. build    Produce the workbook (see build_workbook.py).

Usage:
  python3 vehicle_map.py rank --ssq ssq_export.csv --top 10
  python3 vehicle_map.py pull --fy 2024 2025 2026 --workers 3
  python3 vehicle_map.py resolve --min-obligation 100000
  python3 build_workbook.py

If the API refuses a pull, download the same filters from the USAspending website
(Advanced Search > Download > Transactions, CSV) and process them with
  python3 vehicle_map.py pull --local-zips <folder of zips>
"""

import argparse
import csv
import os
import io
import json
import re
import sys
import threading
import time
import zipfile
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORK = Path(os.environ.get("MASMAP_DIR", HERE))  # where inputs and outputs live
DATA = WORK / "data"
API = "https://api.usaspending.gov/api/v2"
CONTRACTS = ["A", "B", "C", "D"]
ROW_CAP = 500000  # USAspending custom download limit
csv.field_size_limit(10 ** 8)

# ---------------------------------------------------------------------------
# SIN -> NAICS crosswalk
# ---------------------------------------------------------------------------

# FPDS uses NAICS 2022 for FY2024-FY2026. MAS SINs still carry some 2017 codes.
NAICS_2017_TO_2022 = {"511210": "513210", "517311": "517111", "517312": "517112", "519130": "519290",
                      "511120": "513120", "511130": "513130", "511140": "513140", "511199": "513199",
                      "515111": "516110", "515120": "516120", "517919": "517810", "454110": "455219"}

# 5-digit and lettered SINs that cover several 6-digit NAICS codes
SIN_EXPANSIONS = {
    "54151": ["541511", "541512", "541513", "541519"],     # 54151S IT Professional Services
    "54151HACS": ["541512", "541519"],                     # Highly Adaptive Cybersecurity Services
    "54151HEAL": ["541511", "541512", "541519"],           # Health IT Services
    "33411": ["334111", "334112", "334118"],               # Purchasing of New Electronic Equipment
    "33411REF": ["334111", "334112", "334118"],            # Refurbished IT equipment
    "518210C": ["518210"],                                 # Cloud and cloud-related IT
    "511210": ["513210"],                                  # Software licenses
}
NO_NAICS = {"OLM", "ANCILLARY", "ANCILLARYREPAIR", "NEW", "INTRO"}

SL_SUFFIX = re.compile(r"(STLOC|RC|PHE)$")


def base_sin(raw):
    s = re.sub(r"\s+", "", str(raw or "")).upper()
    s = SL_SUFFIX.sub("", s)
    return s


def sin_to_naics(sin, overrides):
    """Return (naics list, note). Empty list means no NAICS equivalent."""
    if sin in overrides:
        return overrides[sin], "override"
    if sin in NO_NAICS or not re.match(r"^\d", sin):
        return [], "no NAICS equivalent"
    if sin in SIN_EXPANSIONS:
        return SIN_EXPANSIONS[sin], "expansion"
    digits = re.match(r"^(\d+)", sin).group(1)
    if digits in SIN_EXPANSIONS:
        return SIN_EXPANSIONS[digits], "expansion"
    if len(digits) == 6:
        n = NAICS_2017_TO_2022.get(digits, digits)
        return [n], "SIN number" + (" (2017 code remapped)" if n != digits else "")
    return [], f"unmapped ({digits}); add to naics_overrides.csv"


def load_overrides(path):
    out = {}
    if path and Path(path).exists():
        for r in csv.DictReader(open(path, encoding="utf-8-sig")):
            sin = base_sin(r.get("sin"))
            codes = [c.strip() for c in re.split(r"[;, ]+", r.get("naics", "")) if c.strip()]
            if sin:
                out[sin] = codes
    return out


# ---------------------------------------------------------------------------
# Step 1: rank SINs from an SSQ+ export
# ---------------------------------------------------------------------------

def read_ssq(path):
    """Tolerant SSQ+ reader: UTF-16 or UTF-8, tab or comma, one or two header rows.

    Returns rows of (category, sin, {fy: sales}). The first label column is taken as the
    category and the second as the SIN.
    """
    raw = open(path, "rb").read()
    for enc in ("utf-16", "utf-8-sig", "latin-1"):
        try:
            text = raw.decode(enc)
            if "\x00" not in text:
                break
        except UnicodeError:
            continue
    delim = "\t" if text.count("\t") > text.count(",") else ","
    rows = list(csv.reader(text.splitlines(), delimiter=delim))

    def money(x):
        x = (x or "").replace("$", "").replace(",", "").strip()
        if x.startswith("(") and x.endswith(")"):
            x = "-" + x[1:-1]
        try:
            return float(x)
        except ValueError:
            return None

    # Header rows: any row before the first row with a dollar value
    first_data = next(i for i, r in enumerate(rows) if any(money(c) is not None and "$" in c for c in r))
    col_fy, total_cols = {}, set()
    for r in rows[:first_data]:
        last = None
        for j, c in enumerate(r):
            m = re.search(r"FY\s*(\d{4})", c or "")
            if m:
                last = int(m.group(1))
            if last and not re.search(r"total", c or "", re.I):
                col_fy.setdefault(j, last)
            if re.search(r"total", c or "", re.I):
                col_fy.pop(j, None)
                total_cols.add(j)
                last = None
    out = []
    for r in rows[first_data:]:
        labels = [c.strip() for j, c in enumerate(r)
                  if j not in col_fy and j not in total_cols and c.strip() and "$" not in c]
        if not labels or labels[0].lower().startswith("grand total") or labels[0].lower() == "total":
            continue
        if len(labels) < 2:
            continue
        sales = defaultdict(float)
        for j, fy in col_fy.items():
            if j < len(r):
                v = money(r[j])
                if v is not None:
                    sales[fy] += v
        out.append((labels[0], labels[1], dict(sales)))
    if not col_fy:
        raise ValueError("No 'FY yyyy' headers found in the SSQ+ export")
    return out


def cmd_rank(args):
    overrides = load_overrides(WORK / "naics_overrides.csv")
    rows = read_ssq(args.ssq)
    agg = defaultdict(lambda: defaultdict(float))
    for cat, sin, sales in rows:
        b = base_sin(sin)
        for fy, v in sales.items():
            agg[(cat, b)][fy] += v
    fys = sorted({fy for v in agg.values() for fy in v})
    out, skipped = [], []
    by_cat = defaultdict(list)
    for (cat, sin), s in agg.items():
        by_cat[cat].append((sum(s.values()), sin, s))
    for cat, items in sorted(by_cat.items()):
        rank = 0
        for total, sin, s in sorted(items, reverse=True):
            naics, note = sin_to_naics(sin, overrides)
            if not naics:
                skipped.append({"category": cat, "sin": sin, "total_sales": round(total, 2), "note": note})
                continue
            rank += 1
            if rank > args.top:
                break
            row = {"category": cat, "rank": rank, "sin": sin, "naics": ";".join(naics), "mapping": note,
                   "total_sales": round(total, 2)}
            row.update({f"sales_fy{fy}": round(s.get(fy, 0.0), 2) for fy in fys})
            out.append(row)
    DATA.mkdir(parents=True, exist_ok=True)
    write_csv(WORK / "top_sins.csv", out)
    write_csv(WORK / "skipped_sins.csv", skipped)
    naics = sorted({n for r in out for n in r["naics"].split(";")})
    print(f"{len(by_cat)} categories, {len(out)} SINs kept, {len(naics)} unique NAICS to pull. "
          f"Skipped (no NAICS equivalent): {len(skipped)} -> skipped_sins.csv")
    unmapped = [s for s in skipped if s["note"].startswith("unmapped")]
    if unmapped:
        print("Unmapped SINs that would have made the top list; add them to naics_overrides.csv:")
        for s in unmapped[:20]:
            print("  ", s["category"], s["sin"])


# ---------------------------------------------------------------------------
# Step 2: pull and classify
# ---------------------------------------------------------------------------

COLUMNS = [
    "contract_transaction_unique_key", "contract_award_unique_key", "award_id_piid", "modification_number",
    "parent_award_agency_id", "parent_award_id_piid", "parent_award_type_code", "parent_award_type",
    "federal_action_obligation", "action_date", "action_date_fiscal_year",
    "period_of_performance_start_date", "period_of_performance_current_end_date",
    "period_of_performance_potential_end_date", "base_and_all_options_value",
    "awarding_agency_name", "awarding_sub_agency_name", "awarding_office_code", "awarding_office_name",
    "funding_agency_name", "funding_sub_agency_name", "funding_office_code", "funding_office_name",
    "recipient_uei", "recipient_name", "recipient_parent_name", "award_type_code",
    "naics_code", "product_or_service_code", "transaction_description",
    "prime_award_base_transaction_description", "extent_competed_code", "number_of_offers_received",
    "type_of_set_aside_code", "contracting_officers_determination_of_business_size_code",
]

GSA_PREFIX = re.compile(r"^(GS|47Q)", re.I)
BUCKETS = ["GSA MAS", "GSA non-MAS (GWAC, OASIS+, other)", "Other agency GWAC", "VA FSS",
           "Agency IDIQ / BOA", "Agency BPA (standalone)", "BPA (parent unresolved)", "Open market"]


def parent_type(code, text):
    c = (code or "").strip().upper()
    t = (text or "").strip().upper()
    if c == "A" or "GWAC" in t or "GOVERNMENT WIDE" in t:
        return "GWAC"
    if c == "C" or t == "FSS" or "SUPPLY SCHEDULE" in t:
        return "FSS"
    if c == "E" or t == "BPA" or "BLANKET" in t:
        return "BPA"
    if c == "D" or t == "BOA" or "BASIC ORDERING" in t:
        return "BOA"
    if c == "B" or t == "IDC" or "INDEFINITE" in t:
        return "IDC"
    return t or c


def classify(row):
    """Vehicle bucket for one transaction. BPA calls get a provisional bucket until resolved."""
    piid = (row.get("parent_award_id_piid") or "").strip()
    if not piid:
        return "Open market"
    pt = parent_type(row.get("parent_award_type_code"), row.get("parent_award_type"))
    gsa = bool(GSA_PREFIX.match(piid))
    if pt == "FSS":
        return "GSA MAS" if gsa else "VA FSS"
    if pt == "GWAC":
        return "GSA non-MAS (GWAC, OASIS+, other)" if gsa else "Other agency GWAC"
    if pt == "BPA":
        return "BPA (parent unresolved)"
    if gsa:
        return "GSA non-MAS (GWAC, OASIS+, other)"
    return "Agency IDIQ / BOA"


def bucket_for_bpa(parent):
    """Bucket for calls under a BPA, given the BPA's parent record (or None)."""
    if not parent or not parent.get("piid"):
        return "Agency BPA (standalone)"
    piid = parent["piid"]
    desc = (parent.get("idv_type_description") or parent.get("type") or "").upper()
    gsa = bool(GSA_PREFIX.match(piid))
    if "SUPPLY SCHEDULE" in desc or desc == "FSS":
        return "GSA MAS" if gsa else "VA FSS"
    if "GOVERNMENT WIDE" in desc or "GWAC" in desc:
        return "GSA non-MAS (GWAC, OASIS+, other)" if gsa else "Other agency GWAC"
    if gsa:
        # GSA-awarded BPAs and IDVs without a type description: MAS contracts start GS-xxF or 47QxxA
        return "GSA MAS" if re.match(r"^(GS-?\d\dF|47Q[A-Z]{3}\d\dD)", piid, re.I) else "GSA non-MAS (GWAC, OASIS+, other)"
    return "Agency IDIQ / BOA"


def segment(funding_agency, awarding_agency):
    a = funding_agency or awarding_agency or ""
    return "DoD" if "DEFENSE" in a.upper() else "Civilian"


class Client:
    def __init__(self):
        import requests
        self.r = requests
        self.s = requests.Session()
        self.s.headers.update({"Content-Type": "application/json", "User-Agent": "mas-market-map"})

    def call(self, method, path, body=None, params=None, tries=6):
        url = path if path.startswith("http") else f"{API}{path}"
        for k in range(tries):
            try:
                resp = self.s.request(method, url, json=body, params=params, timeout=180)
                if resp.status_code in (429, 500, 502, 503, 504):
                    raise self.r.HTTPError(f"{resp.status_code}: {resp.text[:200]}")
                if resp.status_code == 400:
                    raise ValueError(f"400 Bad Request: {resp.text[:400]}")
                if resp.status_code == 404:
                    return None
                resp.raise_for_status()
                return resp.json()
            except ValueError:
                raise
            except Exception as e:  # network or 5xx
                if k == tries - 1:
                    raise
                time.sleep(min(60, 2 ** (k + 1)))

    def download(self, filters, tag, poll=15, max_wait=7200, columns=True):
        body = {"filters": filters, "file_format": "csv", "columns": COLUMNS if columns else []}
        try:
            job = self.call("POST", "/download/transactions/", body)
        except ValueError as e:
            if columns:
                print(f"  [{tag}] column list refused ({e}); retrying with all columns", file=sys.stderr)
                return self.download(filters, tag, poll, max_wait, columns=False)
            raise
        waited = 0
        while True:
            st = self.call("GET", "/download/status/", params={"file_name": job["file_name"]})
            if st["status"] == "finished":
                break
            if st["status"] == "failed":
                raise RuntimeError(f"[{tag}] download failed: {st.get('message')}")
            if waited > max_wait:
                raise TimeoutError(f"[{tag}] still running after {max_wait}s")
            time.sleep(poll)
            waited += poll
        z = self.s.get(st["file_url"], timeout=1200)
        z.raise_for_status()
        return z.content, int(st.get("total_rows") or 0)


def fy_window(fy):
    return date(fy - 1, 10, 1), date(fy, 9, 30)


def split_window(a, b):
    mid = a + (b - a) / 2
    return [(a, mid), (mid + timedelta(days=1), b)]


class Accumulator:
    """Aggregates classified transactions for one NAICS and holds award-level records."""

    AGG_KEYS = ["fy", "naics", "segment", "funding_agency", "funding_sub_agency", "funding_office_code",
                "funding_office_name", "awarding_agency", "awarding_office_code", "awarding_office_name",
                "bucket", "bpa_key"]

    def __init__(self):
        self.agg = defaultdict(lambda: [0.0, 0])
        self.awards = {}
        self.seen = set()
        self.mas_vendors = set()

    def add_row(self, r):
        key = r.get("contract_transaction_unique_key")
        if key:
            if key in self.seen:
                return
            self.seen.add(key)
        try:
            amt = float(r.get("federal_action_obligation") or 0)
        except ValueError:
            amt = 0.0
        fy = (r.get("action_date_fiscal_year") or "").strip()
        bucket = classify(r)
        bpa_key = ""
        if bucket == "BPA (parent unresolved)":
            bpa_key = f"{(r.get('parent_award_id_piid') or '').strip()}|{(r.get('parent_award_agency_id') or '').strip()}"
        seg = segment(r.get("funding_agency_name"), r.get("awarding_agency_name"))
        k = (fy, (r.get("naics_code") or "").strip(), seg, r.get("funding_agency_name") or "",
             r.get("funding_sub_agency_name") or "", r.get("funding_office_code") or "",
             r.get("funding_office_name") or "", r.get("awarding_agency_name") or "",
             r.get("awarding_office_code") or "", r.get("awarding_office_name") or "", bucket, bpa_key)
        a = self.agg[k]
        a[0] += amt
        a[1] += 1
        if bucket != "GSA MAS":
            self._award(r, fy, amt, bucket, bpa_key, seg)
        if bucket in ("GSA MAS", "BPA (parent unresolved)") and r.get("recipient_uei"):
            self.mas_vendors.add((k[1], r["recipient_uei"], bucket, bpa_key))

    def _award(self, r, fy, amt, bucket, bpa_key, seg):
        ak = r.get("contract_award_unique_key") or r.get("award_id_piid")
        rec = self.awards.get(ak)
        if rec is None:
            rec = self.awards[ak] = {
                "award_key": ak, "piid": r.get("award_id_piid"), "parent_piid": r.get("parent_award_id_piid") or "",
                "bucket": bucket, "bpa_key": bpa_key, "segment": seg, "naics": r.get("naics_code"),
                "psc": r.get("product_or_service_code"), "funding_agency": r.get("funding_agency_name"),
                "funding_sub_agency": r.get("funding_sub_agency_name"), "funding_office_code": r.get("funding_office_code"),
                "funding_office_name": r.get("funding_office_name"), "awarding_agency": r.get("awarding_agency_name"),
                "awarding_office_code": r.get("awarding_office_code"), "awarding_office_name": r.get("awarding_office_name"),
                "recipient": r.get("recipient_name"), "recipient_uei": r.get("recipient_uei"),
                "recipient_parent": r.get("recipient_parent_name"), "business_size": r.get("contracting_officers_determination_of_business_size_code"),
                "set_aside": r.get("type_of_set_aside_code"), "extent_competed": r.get("extent_competed_code"),
                "offers": r.get("number_of_offers_received"), "description": (r.get("prime_award_base_transaction_description") or r.get("transaction_description") or "")[:300],
                "pop_start": r.get("period_of_performance_start_date"), "pop_current_end": r.get("period_of_performance_current_end_date"),
                "pop_potential_end": r.get("period_of_performance_potential_end_date"),
                "base_and_all_options": r.get("base_and_all_options_value"), "last_action": r.get("action_date"),
            }
        rec[f"obl_fy{fy}"] = rec.get(f"obl_fy{fy}", 0.0) + amt
        if (r.get("action_date") or "") >= (rec.get("last_action") or ""):
            # Latest action carries the current end date and options value
            for f, src in [("pop_current_end", "period_of_performance_current_end_date"),
                           ("pop_potential_end", "period_of_performance_potential_end_date"),
                           ("base_and_all_options", "base_and_all_options_value"), ("last_action", "action_date")]:
                if r.get(src):
                    rec[f] = r.get(src)

    def add_zip(self, content):
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            names = [n for n in zf.namelist() if n.endswith(".csv") and "Subaward" not in n]
            for n in names:
                with zf.open(n) as f:
                    for r in csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig")):
                        self.add_row(r)

    def write(self, naics):
        rows = [dict(zip(self.AGG_KEYS, k), obligations=round(v[0], 2), transactions=v[1]) for k, v in self.agg.items()]
        write_csv(DATA / "agg" / f"{naics}.csv", rows)
        write_csv(DATA / "awards" / f"{naics}.csv", list(self.awards.values()))
        write_csv(DATA / "mas_vendors" / f"{naics}.csv",
                  [dict(zip(["naics", "recipient_uei", "bucket", "bpa_key"], v)) for v in sorted(self.mas_vendors)])


def pull_window(client, naics, a, b, tag, depth=0):
    filters = {"time_period": [{"start_date": str(a), "end_date": str(b)}], "award_type_codes": CONTRACTS,
               "naics_codes": {"require": [naics]}}
    content, rows = client.download(filters, tag)
    if rows >= ROW_CAP and depth < 5:
        print(f"  [{tag}] hit the {ROW_CAP:,} row cap; splitting {a}..{b}")
        parts = []
        for x, y in split_window(a, b):
            parts.extend(pull_window(client, naics, x, y, f"{tag}/{x}", depth + 1))
        return parts
    return [content]


_print_lock = threading.Lock()


def pull_naics(client, naics, fys):
    done = DATA / "agg" / f"{naics}.csv"
    if done.exists():
        return naics, "skipped (already pulled)"
    acc = Accumulator()
    for fy in fys:
        a, b = fy_window(fy)
        for content in pull_window(client, naics, a, b, f"{naics} FY{fy}"):
            acc.add_zip(content)
        with _print_lock:
            print(f"  {naics} FY{fy}: {len(acc.seen):,} transactions so far")
    acc.write(naics)
    return naics, f"{len(acc.seen):,} transactions, {len(acc.awards):,} non-MAS awards"


def cmd_pull(args):
    (DATA / "agg").mkdir(parents=True, exist_ok=True)
    (DATA / "awards").mkdir(parents=True, exist_ok=True)
    if args.local_zips:
        acc_by = defaultdict(Accumulator)
        for z in sorted(Path(args.local_zips).glob("*.zip")):
            content = z.read_bytes()
            # Split rows by NAICS so each lands in its own file
            tmp = Accumulator()
            tmp.add_zip(content)
            for k, v in tmp.agg.items():
                acc = acc_by[k[1]]
                acc.agg[k][0] += v[0]
                acc.agg[k][1] += v[1]
            for ak, rec in tmp.awards.items():
                acc_by[rec["naics"]].awards[ak] = rec
            for v in tmp.mas_vendors:
                acc_by[v[0]].mas_vendors.add(v)
            print(f"processed {z.name}")
        for naics, acc in acc_by.items():
            acc.write(naics)
        print(f"wrote {len(acc_by)} NAICS files from local zips")
        return
    top = list(csv.DictReader(open(WORK / "top_sins.csv")))
    naics = sorted({n for r in top for n in r["naics"].split(";") if n})
    if args.only:
        naics = [n for n in naics if n in set(args.only)]
    print(f"Pulling {len(naics)} NAICS x FY{args.fy}. Resumable: finished NAICS are skipped on rerun.")
    client = Client()
    failures = []
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(pull_naics, client, n, args.fy): n for n in naics}
        for f in as_completed(futs):
            n = futs[f]
            try:
                _, msg = f.result()
                print(f"[{n}] {msg}")
            except Exception as e:
                failures.append((n, str(e)))
                print(f"[{n}] FAILED: {e}", file=sys.stderr)
    if failures:
        write_csv(DATA / "pull_failures.csv", [{"naics": n, "error": e} for n, e in failures])
        print(f"{len(failures)} NAICS failed; rerun the same command to retry them (see data/pull_failures.csv)")


# ---------------------------------------------------------------------------
# Step 3: resolve BPA parents
# ---------------------------------------------------------------------------

def cmd_resolve(args):
    cache_path = DATA / "bpa_parents.json"
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    totals = defaultdict(float)
    for f in (DATA / "agg").glob("*.csv"):
        for r in csv.DictReader(open(f)):
            if r["bpa_key"]:
                totals[r["bpa_key"]] += float(r["obligations"])
    todo = [k for k, v in sorted(totals.items(), key=lambda x: -abs(x[1]))
            if abs(v) >= args.min_obligation and k not in cache]
    print(f"{len(totals):,} BPAs with calls; {len(todo):,} above ${args.min_obligation:,.0f} to look up")
    client = Client()
    lock = threading.Lock()

    def look(key):
        piid, agency = key.split("|")
        rec = client.call("GET", f"/awards/CONT_IDV_{piid}_{agency}/")
        parent = (rec or {}).get("parent_award") or None
        out = {"found": rec is not None,
               "parent": {"piid": parent.get("piid"), "idv_type_description": parent.get("idv_type_description"),
                          "agency": parent.get("agency_name")} if parent else None}
        return key, out

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        for n, f in enumerate(as_completed([ex.submit(look, k) for k in todo]), 1):
            try:
                k, v = f.result()
                with lock:
                    cache[k] = v
            except Exception as e:
                print(f"  lookup failed: {e}", file=sys.stderr)
            if n % 200 == 0:
                cache_path.write_text(json.dumps(cache))
                print(f"  {n:,}/{len(todo):,}")
    cache_path.write_text(json.dumps(cache))
    resolved = sum(abs(totals[k]) for k in totals if k in cache and cache[k]["found"])
    print(f"Resolved BPAs cover {resolved / max(1, sum(abs(v) for v in totals.values())):.0%} of BPA-call dollars.")


def write_csv(path, rows):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    keys = []
    for r in rows:
        for k in r:
            if k not in keys:
                keys.append(k)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=keys or ["empty"])
        w.writeheader()
        w.writerows(rows)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("rank")
    r.add_argument("--ssq", required=True)
    r.add_argument("--top", type=int, default=10)
    p = sub.add_parser("pull")
    p.add_argument("--fy", type=int, nargs="+", default=[2024, 2025, 2026])
    p.add_argument("--workers", type=int, default=3)
    p.add_argument("--only", nargs="*", help="Limit to these NAICS codes")
    p.add_argument("--local-zips", help="Process USAspending zips downloaded by hand instead of calling the API")
    s = sub.add_parser("resolve")
    s.add_argument("--min-obligation", type=float, default=100000)
    s.add_argument("--workers", type=int, default=4)
    args = ap.parse_args(argv)
    {"rank": cmd_rank, "pull": cmd_pull, "resolve": cmd_resolve}[args.cmd](args)


if __name__ == "__main__":
    main()
