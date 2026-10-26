import sys
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
src, out = sys.argv[1], sys.argv[2]
wb = load_workbook(src)
F = lambda **k: Font(name="Arial", size=k.pop("size", 10), **k)
HDR = PatternFill("solid", fgColor="1F3864"); SUB = PatternFill("solid", fgColor="D9E1F2")
T = Side(style="thin", color="BFBFBF"); BOX = Border(top=T, bottom=T, left=T, right=T)

ws = wb.create_sheet("Findings", 1)
ws.sheet_view.showGridLines = False
ws.column_dimensions["A"].width = 150
ws["A1"] = "Findings: where MAS stands and where it can gain"; ws["A1"].font = F(bold=True, size=14, color="1F3864")
ws["A2"] = "FY2024-FY2026 FPDS obligations in the NAICS of each large category's top 10 SINs. 'Lane' = awards sized for MAS (up to $10M for PS and IT, $25M otherwise); R&D, SBIR/STTR, and BAA awards excluded."
ws["A2"].font = F(italic=True, color="595959")
sections = [
 ("Bottom line", [
  "MAS holds about half of the civilian market it can realistically win and a sixth of DoD's. In the MAS lane, civilian agencies spent $79.3B through MAS and $73.3B elsewhere (52% MAS). DoD spent $22.1B through MAS and $115.9B elsewhere (16%).",
  "The gain is on agency vehicles more than open market. Of the non-MAS lane spend, $20.1B civilian and $25.8B DoD is open market; the rest ($53B civilian, $90B DoD) sits on agency IDIQs, BPAs, and non-GSA GWACs.",
  "DoD services are the largest addressable pool: $29.3B in Professional Services and $25.1B in IT inside the lane, at 20% and 30% MAS share. Navy warfare centers and systems commands lead it.",
 ]),
 ("By category", [
  "Information Technology: 60% MAS share civilian, 30% DoD. Non-MAS IT in the lane is $29.4B civilian and $25.1B DoD, mostly on agency vehicles. NASA SEWP is the main competitor: 2,053 civilian tier-1 targets sit on SEWP, and the leading incumbents (Thundercat, FCN, V3Gate, Four Points) already hold MAS.",
  "Professional Services: 57% civilian, 20% DoD. DoD has $29.3B in the lane, $24.7B of it on agency vehicles (Navy warfare centers, SeaPort-NxG task orders among tier-1 parents). Above the lane sits $105B DoD and $32B civilian; that is OASIS+ and agency IDIQ territory.",
  "Facilities: 37% civilian, 12% DoD. DoD has $11.7B in the lane. Most civilian facilities dollars ($80B) are above the lane in DOE and NNSA management-and-operating contracts, which MAS will not compete for.",
  "Security and Protection: 21% civilian, 1% DoD. Civilian lane spend is dominated by two guard programs on their own IDIQs: Federal Protective Service ($3.3B, 0% MAS) and U.S. Courts security officers ($1.7B). These are policy conversations, not order-by-order conversions. DoD lane spend is mostly military aircraft parts bought by NAVSUP and DLA Aviation under NAICS 336413; discount it.",
  "Scientific, Industrial, and Miscellaneous: MAS share of 5-17%, but DoD lane spend in these categories is largely military spares (DLA Aviation, NAVSUP Weapon Systems Support, 848th SCMG). Civilian Scientific ($3.9B non-MAS, 11% MAS) is the cleaner product opportunity.",
  "Where MAS already leads: Travel (97% civilian), Furniture (61-62%), Human Capital civilian (55%), Transportation and Logistics civilian (54%). Defend these; little conversion upside.",
 ]),
 ("Targets", [
  "24,677 civilian and 29,054 DoD in-lane, non-MAS awards end between now and April 2028. Tier 1 (the incumbent already receives MAS orders in that NAICS): 5,201 civilian ($6.5B) and 2,128 DoD ($4.4B). These convert without changing vendors.",
  "Timing: about 5,000 civilian and 6,800 DoD targets end October to December 2026. Many are annual renewals (software, maintenance, subscriptions), so the window for this cycle is now.",
  "40% of targets drew a single offer. That is the competition argument for moving them to MAS.",
  "Start with the Priority Targets tab (top 25 per category, civilian and DoD), then filter the Targets tabs to tier 1.",
 ]),
 ("Caveats", [
  "NAICS is assigned per award, so a category's market is its NAICS market, not its SIN's. Each NAICS counts once, in its home category.",
  "Incumbent on MAS means the vendor received MAS orders in that NAICS; confirm in eLibrary that its schedule covers the requirement.",
  "FY2026 is incomplete in FPDS (DoD about 90 days light). Current end dates move with option exercises; verify each target before outreach.",
  "FAA buys under its own Acquisition Management System, not the FAR. It can order from GSA schedules, but the pitch differs.",
 ]),
]
r = 4
for head, items in sections:
    c = ws.cell(row=r, column=1, value=head); c.font = F(bold=True, size=12, color="1F3864"); c.fill = SUB; r += 1
    for t in items:
        c = ws.cell(row=r, column=1, value=t); c.font = F(); c.alignment = Alignment(wrap_text=True, vertical="top")
        ws.row_dimensions[r].height = 15 * (1 + len(t) // 170); r += 1
    r += 1

ws2 = wb.create_sheet("Top Offices", 2)
ws2["A1"] = "Ten civilian and ten DoD offices to approach first"; ws2["A1"].font = F(bold=True, size=14, color="1F3864")
ws2["A2"] = "Ranked by in-lane non-MAS spend, FY2024-FY2026, across all categories (DoD: services categories only, excluding spare-parts buyers). Targets = in-lane non-MAS awards ending by Apr 2028."
ws2["A2"].font = F(italic=True, color="595959")
heads = ["#", "Segment", "Funding office (AAC)", "Office", "Contracting office (AAC)", "In-lane non-MAS ($M)", "Open market ($M)", "GSA MAS ($M)", "MAS share", "Targets", "Tier 1", "Play"]
widths = [4, 9, 12, 34, 12, 12, 11, 11, 9, 8, 7, 90]
for j, (h, w) in enumerate(zip(heads, widths), start=1):
    c = ws2.cell(row=4, column=j, value=h); c.font = F(bold=True, color="FFFFFF"); c.fill = HDR; c.border = BOX
    c.alignment = Alignment(wrap_text=True, vertical="center")
    ws2.column_dimensions[c.column_letter].width = w
rows = [
 ("Civilian","693JG2","FAA","697DCK",2335,282,53,213,730,"Largest civilian pool at 2% MAS across IT and PS. 213 renewals already held by MAS vendors. FAA buys under AMS and eFAST; position MAS as the faster compliant option."),
 ("Civilian","36C10B","VA Technology Acquisition Center NJ","36C10B",1903,189,3119,178,534,"Already 62% MAS; $1.9B still elsewhere (T4NG, SEWP). Retention plus conversion of 178 tier-1 IT renewals."),
 ("Civilian","19XDS0","State, Bureau of Diplomatic Security","19AQMM",1347,747,98,17,144,"7% MAS with $747M open market in security and facilities. Open-market buys are the easiest to move."),
 ("Civilian","75D301","CDC Office of Acquisition Services","75D301",1082,556,863,51,321,"44% MAS, $556M open market across six categories. Broad, mid-size buyer; good for SIN-by-SIN outreach."),
 ("Civilian","2032H9","IRS Chief Information Officer","2032H5",1060,302,1465,90,169,"58% MAS in IT; 90 tier-1 renewals."),
 ("Civilian","75F401","FDA Office of Acquisition and Grant Services","75F401",1030,326,1848,63,402,"64% MAS; 402 targets across IT, PS, and scientific."),
 ("Civilian","19X0B0","State, Overseas Buildings Operations","19AQMM",804,119,55,21,323,"6% MAS; 323 facilities and PS targets."),
 ("Civilian","960102","USACE Civil Works","W91278",764,209,17,10,198,"2% MAS; facilities and PS work placed through district IDIQs."),
 ("Civilian","70Z00P","Coast Guard, Mission Support","70Z084",693,86,208,43,230,"23% MAS; 230 targets in facilities, IT, PS."),
 ("Civilian","693KA9","FAA Contracting for Services","693KA9",629,27,9,66,166,"Professional services at 1% MAS; 66 tier-1 renewals."),
 ("DoD","N00039","Naval Information Warfare Systems Command","N00039",1631,106,203,37,152,"11% MAS in IT and PS; 37 tier-1 renewals."),
 ("DoD","N00421","Naval Air Warfare Center Aircraft Division","N00421",1446,150,121,55,213,"8% MAS; 213 targets, 55 tier 1."),
 ("DoD","W912DY","USACE Engineering and Support Center Huntsville","W912DY",1207,280,186,47,115,"13% MAS; $280M open market in facilities, IT, PS."),
 ("DoD","N66001","NIWC Pacific","N66001",1061,62,28,82,206,"3% MAS; 82 tier-1 renewals, the most of any DoD office."),
 ("DoD","N00024","NAVSEA HQ (via NIWC Atlantic)","N65236",963,148,42,18,148,"4% MAS in IT and PS."),
 ("DoD","N65236","NIWC Atlantic","N65236",780,48,0,55,99,"Effectively 0% MAS; 55 tier-1 renewals."),
 ("DoD","M95450","Marine Corps (MCSC contracting)","M67854",788,61,68,16,76,"8% MAS in IT and PS."),
 ("DoD","SP4709/SP4701","DLA DCSO Philadelphia","SP4709",1432,72,204,71,212,"IT buying at 0-25% MAS; 71 tier-1 renewals across the two offices."),
 ("DoD","HC1047/HC1085","Defense Information Systems Agency","HC1047",1181,113,636,38,143,"29-40% MAS already; expand within DISA's IT renewals."),
 ("DoD","N61340","NAWC Training Systems Division","N61340",754,141,2,1,86,"0% MAS; training systems and PS."),
]
for i, (seg, aac, name, ko, lane, opn, mas, t1, tg, play) in enumerate(rows, start=5):
    vals = [i - 4, seg, aac, name, ko, lane, opn, mas, None, tg, t1, play]
    for j, v in enumerate(vals, start=1):
        c = ws2.cell(row=i, column=j, value=v); c.font = F(); c.border = BOX
        c.alignment = Alignment(wrap_text=(j == 12), vertical="top")
    ws2.cell(row=i, column=9, value=f"=H{i}/(H{i}+F{i})").number_format = "0%"
    for col in "FGH":
        ws2[f"{col}{i}"].number_format = "#,##0"
n = 5 + len(rows) + 1
notes = ["Not ranked, but large: Federal Protective Service (70MFPS, $3.3B, 0% MAS) and U.S. Courts (1033D3, $1.7B) security-officer programs, which run on agency-specific IDIQs.",
         "Excluded from the DoD list: spare-parts and supply-chain buyers (NAVSUP Weapon Systems Support, DLA Aviation, 848th SCMG, NAVSUP FLC Jacksonville ERP).",
         "Figures from the Top Funders tab, summed across categories. Tier 1 = incumbent already receives MAS orders in that NAICS."]
for k, t in enumerate(notes):
    c = ws2.cell(row=n + k, column=1, value=t); c.font = F(italic=True, size=9, color="595959")
ws2.freeze_panes = "E5"
wb.save(out)
print("saved", out)
