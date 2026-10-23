# MAS market map

Where federal spending in MAS's biggest SINs actually goes (MAS, other GSA vehicles, agency
contracts, open market), who funds it down to the office (AAC), and which non-MAS contracts are
coming up for recompete.

## Run it (on a machine that can reach api.usaspending.gov)

```
pip3 install requests openpyxl
cd research/vehicle-map

# 1. Rank SINs from your SSQ+ export (see below). Writes top_sins.csv.
python3 vehicle_map.py rank --ssq ~/Downloads/<ssq export>.csv --top 10

# 2. Pull FY2024-FY2026 transactions for every NAICS in top_sins.csv.
#    Long: expect several hours for ~120 NAICS. Resumable; rerun the same command after any failure.
python3 vehicle_map.py pull --fy 2024 2025 2026 --workers 3

# 3. Trace BPA calls to their BPA's parent vehicle (MAS BPA vs agency BPA).
python3 vehicle_map.py resolve --min-obligation 100000

# 4. Build the workbook.
python3 build_workbook.py
```

Send back `MAS_Market_Map.xlsx` plus `top_sins.csv` and `skipped_sins.csv`. If the workbook is too
large to send, zip the `data/` folder instead.

## SSQ+ export for step 1

- Program: Schedule MAS. All contracts.
- Level 1: the field that lists the **12 MAS large categories** (Facilities, Information Technology,
  Professional Services, Security and Protection, ...). This is not "Governmentwide Category",
  which uses the 10 category-management categories.
- Level 2: SIN. Leave the other levels at None.
- Date type: Fiscal Year. Timeframe: FY2024 through FY2026.
- Export the data table as CSV, as you did for GS-07F-139DA.

The parser folds state/local (STLOC) and disaster (RC) SIN suffixes into the base SIN and skips
SINs with no NAICS equivalent (OLM, Ancillary).

## SIN to NAICS

`rank` uses the SIN number where it is a NAICS code (2017 codes remapped to 2022) and expands
54151S, HACS, Health IT, and 33411 to their 6-digit NAICS. It prints any SIN it can't map. Add
corrections to `naics_overrides.csv` (`sin,naics` with codes separated by `;`) and rerun `rank`.

## Vehicle buckets

| Bucket | Rule |
|---|---|
| GSA MAS | Parent is a Federal Supply Schedule with a GS/47Q PIID, or a BPA under one |
| GSA non-MAS | GSA GWACs (Alliant, 8(a) STARS, VETS), OASIS/OASIS+, other GSA IDVs |
| Other agency GWAC | SEWP, CIO-SP, other non-GSA GWACs |
| VA FSS | VA schedules, or BPAs under them |
| Agency IDIQ / BOA | Agency-awarded IDIQs and BOAs |
| Agency BPA (standalone) | Agency BPAs not under a schedule |
| BPA (parent unresolved) | BPAs below the lookup threshold in step 3 |
| Open market | No parent vehicle |

Addressable for MAS defaults to everything except the GSA buckets and unresolved BPAs; change it on
the workbook's Settings tab.

## If the API refuses a pull

Download the same filters from usaspending.gov (Advanced Search: Time Period, NAICS, Award Type =
Contracts; Download > Transactions > CSV), put the zips in a folder, and run
`python3 vehicle_map.py pull --local-zips <folder>`.
