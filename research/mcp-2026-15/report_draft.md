# MCP 2026-15: Market Research, Rotary-Wing Aircraft SIN

Draft for insertion into the MCP business case. Status as of October 19, 2026: public-source findings are complete. Obligation figures are pending the FPDS/USAspending, SRP, and FAIRS pulls specified in `data_requests.md`. Cells marked **[DATA]** fill from `analyze.py` output; nothing in those cells should be estimated by hand.

---

## Part 1. Facts and Figures (leadership sheet)

### The question this section answers first

GSS recommended in September 2025 that helicopters come off MAS. CBP placed a $95.5 million MAS order for ten H125s in May 2026. Both made sense when they happened, because the rules changed between them. GSA's MAS Refresh 26 (SF30 dated April 25, 2025, Mass Mod A897) added language to SIN 336413 stating that "the award of rotary-wing or fixed-wing aircraft is explicitly excluded," and Refresh 27 listed fully assembled aircraft among items GSA will not award. The GSS recommendation followed that policy. By September 30, 2026, GSA's own RFI described helicopters as "currently accommodated on a temporary basis under an existing Security and Protection SIN." Somewhere between those dates GSA authorized a temporary accommodation, and the CBP order rests on it.

That makes one document the most important item in the file: the instrument that created the temporary accommodation (deviation, mass mod, or category decision memo) and its effective date. If it postdates the CBP order, the order sat outside the stated scope of the SIN it was placed under, and the business case has to say so before a protester does.

### Ten numbers

| # | Measure | Value | Basis / status |
|---|---|---|---|
| 1 | Annual civilian helicopter obligations, FY16-FY26 (mean, median, range) | **[DATA]** | PSC 1520 + NAICS 336411, DoD program aircraft removed. Report median and range, not just mean; buying is lumpy |
| 2 | CBP share of civilian demand | **[DATA]**, dollars and aircraft, 10-yr and rolling 3-yr | The draft package's "about 70 percent" has no stated base. `cbp_share_matrix.csv` shows the figure under every base so the source can be matched or retired |
| 3 | Share of civilian helicopter dollars already moving through MAS | **[DATA]** | Referenced IDV prefix GS-/47Q or IDV type FSS |
| 4 | Average offers per civilian award; single-offer rate; brand-name rate | **[DATA]** | Public record: CBP's FY2026 buy was forecast as brand-name-only, small business set-aside, MAS via eBuy |
| 5 | Price per configured aircraft | $9.55M (CBP, 2026) vs. $6.56M (CBP, 2018) | Public: $95,507,814 / 10; $45.9M / 7. Nominal increase about 46 percent. Confirm both against FPDS, including any separate actions for training, spares, or configuration |
| 6 | State and local volume through the existing channel | 23 helicopters ordered by federal, state, and local customers as of January 2020; at least 5 state/local orders since | Public: GSA R7 release (Jan 2020); Baltimore City 2021 ($17.9M), Albuquerque PD (2 aircraft), New Mexico State Police (Nov 2025), Baltimore County PD (Aug 2026, its second). SRP pull gives dollars **[DATA]** |
| 7 | OEMs holding aircraft on MAS | 0 confirmed; 1 authorized dealer (Davenport Aviation, GS-07F-139DA) | eLibrary search under SIN 336413 and NAICS 336411 still required **[DATA]** |
| 8 | Fleet replacement estimate | **[DATA]** | Inputs: FAIRS ages, 1033 airframe ages, APSA fleet counts |
| 9 | Adjacent rotary-wing spend (charter, exclusive-use, MRO, parts) | **[DATA]** | V1xx, J01x, K01x, parts PSCs. Shows the ceiling on what an aircraft-purchase SIN can ever touch |
| 10 | Projected IFF | $716K on the 2026 CBP order alone (0.75% × $95.5M); annualized **[DATA]** | Use the 10-yr median of addressable MAS volume, not a peak year |

---

## Part 2. Full Report (drops into MCP template headings)

### 1. Customer Analysis

#### 1.1 Federal civilian demand

**[DATA: annual civilian obligations table, FY16-FY26, from `tables.md`.]**

What the public record already shows is concentration in one buyer with a steady procurement rhythm. CBP Air and Marine Operations has bought H125 Light Enforcement Helicopters (LEH) in at least four actions since 2018:

| Date | Action | Aircraft | Value | Implied unit | Vehicle |
|---|---|---|---|---|---|
| Jul 2018 | DHS award, FY17-18 funds | 7 | $45.9M | $6.56M | GSA schedule, Davenport (GSA recognized AMO for the buy) |
| Undated (FY17-18 funds) | CBP LEH contract | 9 + 1 option | $59.1M ($65.7M w/ option) | $6.57M | Not stated in release; confirm in FPDS |
| Jan 2021 | Initial award, FY20 funds | up to 9 | $21.2M obligated; $65.9M potential | ~$7.3M if all 9 | Not stated; confirm in FPDS |
| May 2026 | Delivery order (Airbus announced Jul 7, 2026) | 10 | $95.5M | $9.55M | GSA MAS, Davenport, brand-name-only, small business set-aside |

The 2018 and undated contracts may be the same buy reported twice; FPDS will settle it. CBP's 2020 release says AMO accepted the first of 17 H125s that year, while trade press says 16 were ordered. Use the FPDS count.

The unit price rose roughly 46 percent nominal from 2018 to 2026. CPI-U rose by roughly 30 percent across the same span, so the real increase is in the low teens. Some of that is scope: the FY2026 forecast described "configuration and management" of up to ten aircraft "and the supply of related equipment," with performance through April 2028. Whether the $95.5M includes training, spares, or program management in addition to configured aircraft is the single biggest unknown in the unit-price analysis. Pull every action under the order, not just the base.

CBP is not the only federal buyer, but it is the only one visible in press. CBP's UH-60s come through Army contracts (DoD awarding, DHS funding), so the script assigns customer by funding agency. Otherwise CBP's twin-engine fleet shows up as DoD and the CBP share is understated.

Fleet context from FAIRS, as reported to the Senate Judiciary Committee in June 2025 (FY2024, all aircraft types, not helicopters alone): DHS 202, USDA 100, DOI 88, DOT 37, DOE 30, DOJ 6. GAO-17-73R counted 414 helicopters among 924 aircraft owned by 11 civilian agencies in July 2016. The DOJ figure looks low for an organization that includes FBI and DEA aviation and probably reflects ownership rules (leased and loaned aircraft excluded). The FAIRS request asks for helicopters by agency, model, year of manufacture, and acquisition method.

#### 1.2 State and local demand

The GSS characterization of state and local demand as "limited" does not survive the record of how this channel started. GSA added the H125 to the schedule in 2017, under SIN 567-99 on legacy Schedule 84, after the Mississippi Department of Public Safety and the Hillsborough County Sheriff's Office asked for an expedited award (Federal Times, March 2017). State and local buyers created the channel. CBP came later.

By January 2020 GSA Region 7 reported 23 helicopters ordered through it "from a variety of federal, state and local customers," including Albuquerque PD's first H125 bought through Schedule 84 Cooperative Purchasing. Known state and local orders on GS-07F-139DA since then:

- Baltimore City: Board of Estimates approved $17,926,923 for police helicopters (December 2021)
- Albuquerque PD: second H125 (city and state funds)
- New Mexico State Police: H125 (November 2025), the third New Mexico law enforcement H125 through the contract
- Baltimore County PD: second H125, replacing an AS350B3 (August 2026)
- Phoenix PD: H145 (date not confirmed)

**[DATA: SRP state/local vs. federal sales on GS-07F-139DA by fiscal year.]**

"Limited" is still partly right, for a reason neither prior document identified. Much state and local rotary-wing demand never reaches a commercial market. The DoD 1033 program had distributed 616 aircraft to law enforcement agencies since 2006, most of them helicopters (Vertical, ~2015); Florida alone held almost 100. Those aircraft are controlled property, loaned with title retained by DLA, and agencies paid a service fee rather than a purchase price (Citrus County, Florida took four OH-58s for $12,000). A sheriff with free airframes does not shop the schedule.

That pool is aging out. OH-58s and UH-1s transferred in the late 1990s and 2000s were built in the late 1960s and 1970s and are now 50 years old or more, and the replacement path visible in the press is commercial: San Juan County, New Mexico went from a 1033 OH-58 to a new Bell 505. The LESO data request (current aircraft on the property book, by type and transfer year) turns that into a replacement curve.

Grant funding is the other channel shaping state and local behavior. Operation Stonegarden requires a detailed justification and program approval before purchases of controlled equipment, and the 2017 DHS OIG audit found weak supplantation review. If grant-funded aircraft purchases carry federal procurement standards (2 CFR 200.317-327), the schedule gives a buyer a compliant vehicle. **[DATA: USAspending assistance search for HSGP/OPSG/Byrne JAG awards with aircraft in the description; FEMA AEL for aviation items.]**

State and local fleet size: the most rigorous national figure is old. BJS counted 201 aviation units and 604 helicopters in agencies with 100+ sworn officers in 2007. Older ALEA material cites 800+ agencies with aircraft. APSA outreach should produce a current count.

#### 1.3 DoD

DoD's commercial-derivative buys stay out of the civilian numbers. The UH-72 program is now mostly sustainment: Army modifications of $315M (P00171, January 2025) and $323.7M (P00214, through December 2026) under W58RGZ-22-C-0022 for logistics and engineering support. Those land under J- and K-series PSCs, not 1520, and belong in the adjacent-spend table. DoD aircraft lots (UH-72, TH-73) are reported separately as evidence that OEMs sell direct when volume justifies a program contract.

### 2. Industry Analysis

#### 2.1 Who sells

The visible federal and state/local schedule channel runs through one authorized dealer, Davenport Aviation (woman-owned small business, GS-07F-139DA, awarded July 2016). Davenport sells Airbus aircraft; the OEM itself does not appear as a schedule holder in any source found. One other MAS holder, Helicopter Services, Inc. (47QMCA20D001T, option period through May 31, 2030), carries SIN 336413 and NAICS 488190; whether it lists aircraft or only equipment requires an eLibrary and Advantage check. **[DATA: full eLibrary list of SIN 336413 holders with any aircraft line items.]**

The market structure explains the dealer model. GAMA reports 732 turbine helicopter deliveries worldwide in 2025 (preliminary), with helicopter deliveries valued at about $4.7 billion. Federal civilian purchases of ten or so aircraft in a good year are a rounding error to an OEM, which is why Airbus sells to CBP through a dealer under a schedule, and to the Army through a program contract when the lot is 30-plus aircraft.

Completion centers (mission equipment integration: FLIR, hoists, searchlights, tactical radios, NVG cockpits) are the third seller type. **[DATA: completion-center vendors appearing under PSC 1520, 1680, J/K codes for the same customers.]**

#### 2.2 Competition

**[DATA: `competition.csv`: offers, single-offer rate, sole-source and brand-name rates by vehicle.]**

The public record on the CBP buys already predicts the result: brand-name-only, small business set-aside, MAS via eBuy, with an incumbent dealer. Under FAR 8.405-6, a brand-name order over the simplified acquisition threshold needs a limited-sources justification posted with the RFQ. Pull those justifications; they state CBP's reasons for fleet commonality and are the strongest evidence on whether competition among Airbus resellers is realistic.

That bears directly on the GSS claim that open-market competition among Airbus resellers would beat MAS pricing. The claim is testable two ways: (1) compare CBP's per-aircraft MAS price against any open-market H125 buys by DOJ, State, or DOI, normalized for configuration (`unit_prices.csv`); (2) count how many authorized Airbus dealers hold the small business status a set-aside requires. If the answer to (2) is one, open-market competition under the same set-aside does not exist, and the comparison is between MAS and a sole-source buy.

#### 2.3 Other channels for state and local buyers

No evidence found that Sourcewell, NASPO ValuePoint, or HGACBuy carries complete helicopters. Confirm by direct search of each contract portal before the BCA asserts there is no competing cooperative channel. The 1122 program (counter-drug, homeland security, emergency response purchases by state and local agencies through MAS) is a second legal route onto the schedule; Georgia reports 1122 purchases of helicopter parts and fuel, not whole aircraft.

### 3. Analysis of Alternatives

Three alternatives, each assessed against what the data shows.

**A. Remove helicopters from MAS (GSS, September 2025).** Federal buyers go open market or direct. Consequence the GSS memo did not address: state and local buyers lose their only federal channel. Cooperative Purchasing authority (40 U.S.C. 502(c)(1)(B)) extends to "law enforcement and security equipment" in the legacy FSC 84 group; it does not extend to agency open-market contracts. Baltimore City, Baltimore County, Albuquerque, and New Mexico State Police would revert to their own procurement processes. CBP would need a standalone competition for each buy, and the brand-name justification it now posts on eBuy becomes a J&A under FAR 6.302.

**B. Status quo (temporary accommodation under a Security and Protection SIN).** Keeps the channel open but rests on an accommodation that contradicts the SIN's own solicitation text. Every order placed under it carries scope risk until the accommodation is documented and published.

**C. Dedicated rotary-wing SIN (MCP 2026-15).** Formalizes the channel. Two design questions decide whether it works:

1. *Cooperative Purchasing eligibility.* The new SIN must sit where 40 U.S.C. 502(c)(1)(B) reaches. If it is placed outside the Security and Protection category or not designated as Cooperative Purchasing eligible, the state and local half of the market disappears. Get an OGC opinion on whether complete helicopters qualify as "law enforcement and security equipment" before the SIN text is final.

2. *Scope of configuration work.* The draft RFI puts mission-system integration outside Phase 1. CBP's order is for configured aircraft at $9.55M each, and the FY2026 forecast explicitly bought "configuration and management." If the completion-work share is large, a bare-airframe SIN cannot carry the anchor customer's next order, and CBP will have to split the buy or leave the schedule. **[DATA: `completion_share.csv`.]** One workable design: allow the aircraft SIN to cover a complete aircraft as delivered, including mission equipment the dealer or completion center installs before delivery, and put training, spares, and program management on the Ancillary Supplies and Services SIN. The RFI responses (due October 14, 2026) should show whether industry prices configured aircraft as a single commercial item.

**[Recommendation to be written after the data pulls. The facts so far favor C, conditioned on both design questions above.]**

### 4. Financial Analysis

The draft package carries forward a $1.2 billion projection from the Grants QSMO 518210GM template. Delete it. No helicopter figure supports it.

Build the projection from three components:

| Component | Method | Value |
|---|---|---|
| Federal civilian MAS volume | 10-yr median annual civilian obligations × MAS share, with CBP recompete timing overlaid | **[DATA]** |
| State/local MAS volume | SRP state/local sales on GS-07F-139DA, 10-yr median, plus 1033 replacement curve | **[DATA]** |
| IFF | 0.75% of the above | **[DATA]**; for scale, the May 2026 CBP order alone generates about $716K |

Present the projection as a range (low = median year without a CBP order; high = median year with one) rather than a single number. With one buyer dominating and orders arriving every two to five years, a point estimate will be wrong in every individual year.

---

## Watch-outs carried into the analysis

- FY2026 is incomplete in FPDS, and DoD data runs about 90 days behind. State this in every table that includes FY2026.
- CBP orders may split configuration, training, and spares into separate CLINs or separate actions. The script rolls all modifications up to the award; separate awards for the same aircraft need to be linked by hand in `quantity_overrides.csv`.
- The 70 percent figure may count aircraft rather than dollars. CBP buys light singles; other agencies buy twins. The matrix reports both.
- NAICS 336411 includes fixed-wing aircraft. The script keeps non-1520 rows only when the description names a helicopter and writes the rest to `excluded_naics_rows.csv` for review.

## Sources

- GSA, MAS Refresh 26 SF30 attachment, solicitation 47QSMD20R0001 (April 25, 2025): https://vsc.gsa.gov/drupal/sites/default/files/internal-files/SF30%20Attachment%20for%20Refresh%20Mod%2047QSMD20R0001%20-%20Refresh%2026.pdf
- GSA, Refresh 26 Q&A on SIN 336413: https://buy.gsa.gov/interact/system/files/Refresh_26_QA.pdf
- GSA Interact MAS activity feed (helicopter SIN RFI, September 30, 2026): https://buy.gsa.gov/interact/community/6/activity-feed
- Gormley Group, GSA seeks feedback on potential MAS SIN for helicopters: https://gormgroup.com/gsa-seeks-industry-feedback-on-potential-new-mas-sin-for-helicopters/
- Airbus, CBP orders 10 H125 helicopters (July 2026): https://www.airbus.com/en/newsroom/press-releases/2026-07-us-customs-and-border-protection-orders-10-airbus-h125-helicopters
- GovConWire, CBP plans FY2026 recompetition for H125 configuration and management: https://www.govconwire.com/articles/cbp-amo-recompete-h125-airbus
- Sen. Hyde-Smith, $45.9M contract for CBP helicopters (July 2018): https://www.hydesmith.senate.gov/hyde-smith-459-million-contract-awarded-customs-border-protection-helicopters
- Sen. Hyde-Smith, $59.1M contract: https://www.hydesmith.senate.gov/hyde-smith-announces-591-million-contract-miss-produce-helicopters-border-security
- Sen. Hyde-Smith, $21.2M contract (January 2021): https://www.hydesmith.senate.gov/hyde-smith-cpb-issues-212-million-contract-border-security-helicopters-built-miss
- CBP, AMO acquisition team recognized for supporting woman-owned small business: https://www.cbp.gov/newsroom/national-media-release/cbp-s-air-and-marine-operations-acquisition-team-recognized
- CBP, AMO continues to update and standardize its aviation fleet: https://www.cbp.gov/newsroom/national-media-release/amo-continues-update-and-standardize-its-aviation-fleet
- GSA R7, FAS procures new Airbus H125 for Albuquerque PD (January 2020): https://www.gsa.gov/about-us/gsa-regions/region-7-greater-southwest/region-7-newsroom/greater-southwest-feature-stories-and-news-releases/fas-procures-new-airbus-h125-for-city-of-albuquerques-police-department-01302020
- Federal Times, "Your agency need a helicopter? GSA can help with that" (March 2017): https://www.federaltimes.com/smr/acquisition/2017/03/24/your-agency-need-a-helicopter-gsa-can-help-with-that/
- Baltimore City Comptroller, Board of Estimates agenda (December 22, 2021): https://www.baltimorecity.gov/comptroller/news-media/press-releases/2021-12-22-release-board-estimates-agenda
- Vertical, Baltimore County PD orders second H125 through Davenport: https://verticalmag.com/press-releases/baltimore-county-police-department-orders-second-h125-through-davenport-aviation/
- Davenport Aviation, New Mexico State Police orders H125: https://www.davenportaviation.com/new-mexico-state-police-h125-order/
- Sen. Grassley, letter to DHS on federal agency aircraft oversight (June 23, 2025): https://www.grassley.senate.gov/download/grassley-to-dhs_-federal-agency-aircraft-oversight?download=1
- GAO-17-73R, Reported Inventory, Use, and Cost of Federally Owned Aircraft: https://www.gao.gov/products/GAO-17-73R
- DLA, LESO/1033 Program FAQs: https://www.dla.mil/Disposition-Services/Offers/Law-Enforcement/Program-FAQs/
- Vertical, "In the crosshairs" (1033 aircraft): https://verticalmag.com/features/in-the-crosshairs/
- Citrus County Chronicle, sheriff's office helicopter fleet changes: https://www.chronicleonline.com/news/local/to-reduce-costs-sheriffs-office-makes-changes-to-helicopter-fleet/article_d39ee3ef-8124-5e2d-a5b2-b12eff57db52.html
- GSA, Programs for state and local governments: https://www.gsa.gov/buy-through-us/purchasing-programs/programs-for-state-and-local-governments
- Public Law 110-248 (Local Preparedness Acquisition Act): https://uscode.house.gov/statutes/pl/110/248.pdf
- DHS OIG-18-13, Operation Stonegarden oversight: https://www.oig.dhs.gov/sites/default/files/assets/2017-11/OIG-18-13-Nov17.pdf
- BJS, Aviation Units in Large Law Enforcement Agencies, 2007: https://bjs.ojp.gov/content/pub/pdf/aullea07.pdf
- GAMA, 2025 aircraft shipment and billing report: https://gama.aero/news-and-events/press-releases/gama-releases-2025-aircraft-shipment-and-billing-report/
- GovConWire, UH-72 Lakota contract modification (January 2025): https://govconwire.com/2025/01/airbus-us-space-defense-contract-modification-uh72-lakota
- GSA eLibrary, Helicopter Services, Inc. (47QMCA20D001T)

Sources were located through web search; several (Hyde-Smith releases, trade press) are secondary. Verify every dollar figure against FPDS before it goes to leadership.
