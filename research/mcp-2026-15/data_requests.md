# MCP 2026-15: Data Requests and Pull Specifications

Send in this order. FAIRS has the longest lead time, so it goes out today.

## 1. FAIRS data request to OGP (send first)

To: OGP Office of Asset and Transportation Management, Federal Aviation Policy

> Subject: Data request, federal helicopter inventory, for FAS MAS business case (MCP 2026-15)
>
> FAS is preparing a business case on a proposed MAS Special Item Number for commercially available helicopters. We request the following from FAIRS for all federally owned, leased, and loaned rotary-wing aircraft, FY2016 through the most recent reporting period:
>
> 1. Agency, bureau, and operating unit
> 2. Manufacturer, model, and series
> 3. Year of manufacture and year acquired
> 4. Acquisition method (purchase, lease, transfer from DoD or other agency, forfeiture, other) and acquisition cost where recorded
> 5. Ownership status (owned, leased, loaned, CAS/contracted)
> 6. Mission category and annual flight hours
> 7. Disposal date and method for aircraft retired in the period
>
> A CSV or Excel extract is fine. We are also interested in OGP's view on whether a dedicated helicopter SIN is consistent with 41 CFR 102-33 acquisition requirements, and would welcome a short conversation once the data is in hand.

Why it matters: fleet age by model gives the replacement curve (fact #8). Acquisition method shows how many civilian aircraft came through DoD transfer rather than purchase. Opening the conversation now sets up OGP concurrence later.

## 2. USAspending pulls (the anchor dataset)

Run three separate downloads from USAspending Advanced Search, Award Data download, Contracts, Prime Award Transactions (not Prime Award Summaries; transactions keep each modification).

| Pull | Filters | File name |
|---|---|---|
| A | PSC = 1520; Action date 10/01/2015 to present | `psc1520.csv` |
| B | NAICS = 336411; same dates | `naics336411.csv` |
| C | PSC in V111, V112, V113, V121, V122, V129 (air charter/passenger/freight), J015, J016, J017, J019, K015, K016, 1615, 1620, 1630, 1680, 2840, 2995; same dates. Optionally filter keyword "helicopter" OR "rotor" OR "rotary" to cut fixed-wing noise | `adjacent.csv` |

All columns, no filtering of fields. The script needs these at minimum: `contract_transaction_unique_key`, `contract_award_unique_key`, `award_id_piid`, `modification_number`, `parent_award_id_piid`, `parent_award_type`, `federal_action_obligation`, `action_date`, `action_date_fiscal_year`, awarding and funding agency and sub-agency names, `recipient_name`, `recipient_parent_name`, `product_or_service_code`, `naics_code`, `extent_competed_code`, `number_of_offers_received`, `other_than_full_and_open_competition_code`, `fair_opportunity_limited_sources_code`, `award_type_code`, `transaction_description`, `prime_award_base_transaction_description`.

If you pull from SAM.gov Data Bank or FPDS ezSearch instead, the script's alias table covers the common FPDS field names. Add an alias in `ALIASES` if a column is missed.

Separately, for the CBP orders, pull the full FPDS record set (every modification) for each order under GS-07F-139DA and save the posted limited-sources justifications from eBuy. Those are the documents that state CBP's brand-name rationale.

## 3. SRP sales, GS-07F-139DA (internal)

From the Sales Reporting Portal / FSS19: quarterly reported sales by SIN, FY2016 to present, split federal vs. state/local (Cooperative Purchasing, Disaster Purchasing, 1122, and Public Health Emergencies if tagged separately). Columns: `fiscal_year`, `quarter`, `sin`, `customer_type`, `sales`. Same pull for any other contract with aircraft line items found in step 5.

## 4. TDR (if Davenport reports under TDR)

Order-level line items for GS-07F-139DA: aircraft model, configuration items, unit price, quantity, customer. This is the cleanest source for the completion-work share. Request through the FAS data team / D2D.

## 5. GSA eLibrary and Advantage

- SIN 336413: list every holder; note any with a complete aircraft (helicopter or fixed-wing) on the price list
- Search Advantage for "helicopter", "H125", "AS350", "Bell 505", "Bell 407", "AW119", "H145" in product catalogs
- Confirm GS-07F-139DA's current option period (base July 1, 2016; first option would have run to mid-2026) and current SINs
- Find the document authorizing the "temporary accommodation" of helicopters under the Security and Protection SIN, and its effective date. Ask the Security and Protection category team directly if it is not on Interact

## 6. DLA LESO / 1033

From DLA Disposition Services public LESO data: all aircraft currently on the LESO property book, with state, agency, item name (model), NSN, quantity, acquisition value, and ship date. Output feeds the state/local replacement curve.

## 7. Grants

USAspending Assistance search, FY2016 to present, CFDA/ALN 97.067 (HSGP, including OPSG) and 16.738 (Byrne JAG). Keyword: helicopter, aircraft, aviation. Also pull the current FEMA AEL for aviation items and note OPSG pre-approval requirements.

## 8. Outreach

- APSA: current member fleet counts by agency type, model, age, and procurement method; whether members use GSA Cooperative Purchasing or 1122
- Sourcewell, NASPO ValuePoint, HGACBuy: confirm whether any contract carries complete helicopters
- GAMA: annual rotorcraft shipment detail by manufacturer, 2016-2025
- RFI responses (closed October 14, 2026): extract each respondent's commercial pricing practice for configured vs. green aircraft and whether they price mission equipment as part of a single commercial item

## Running the analysis

```
python3 pull_usaspending.py --out data    # pulls 2 and 7, plus every GS-07F-139DA order
python3 analyze.py --psc data/psc1520.csv --naics data/naics336411.csv \
    --adjacent data/adjacent.csv --srp data/srp_gs07f139da.csv \
    --overrides quantity_overrides.csv --out outputs
```

Then open `outputs/award_review.csv`, fix any aircraft counts, model, or configured flag the parser got wrong in `quantity_overrides.csv` (columns: `award_key, quantity, configured, model, seller_type`), and re-run. Quote nothing until that review is done.
