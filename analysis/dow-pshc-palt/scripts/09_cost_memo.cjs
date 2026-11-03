// Cost-of-time memo. Usage: node 09_cost_memo.cjs <out.docx>
// Figures are copied from the workbook's Cost Summary tab as delivered (base inputs); rerun 08 and update if inputs change.
const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType,
  HeadingLevel, LevelFormat, BorderStyle, Footer, PageNumber } = require("docx");
const OUTF = process.argv[2];
const FONT = "Arial", NAVY = "1F3A5F", GREY = "555555";
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: 21, ...o });
const p = (parts, o = {}) => new Paragraph({ spacing: { after: 140, line: 276 }, ...o,
  children: (Array.isArray(parts) ? parts : [parts]).map(x => typeof x === "string" ? run(x) : x) });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const num = (parts) => new Paragraph({ numbering: { reference: "num", level: 0 }, spacing: { after: 90, line: 276 },
  children: (Array.isArray(parts) ? parts : [parts]).map(x => typeof x === "string" ? run(x) : x) });
const bul = (parts) => new Paragraph({ numbering: { reference: "bul", level: 0 }, spacing: { after: 70, line: 276 },
  children: (Array.isArray(parts) ? parts : [parts]).map(x => typeof x === "string" ? run(x) : x) });
const formula = (t) => new Paragraph({ spacing: { after: 100 }, indent: { left: 360 },
  shading: { fill: "F2F4F7", type: ShadingType.CLEAR, color: "auto" }, children: [new TextRun({ text: t, font: "Courier New", size: 18 })] });
const cap = (t) => new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: t, font: FONT, size: 17, italics: true, color: GREY })] });
const bd = { style: BorderStyle.SINGLE, size: 4, color: "C9D1DB" };
function table(head, rows, widths, left = [0], hl = []) {
  const cell = (t, w, i, isH, isHl) => new TableCell({ borders: { top: bd, bottom: bd, left: bd, right: bd }, width: { size: w, type: WidthType.DXA },
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    shading: isH ? { fill: NAVY, type: ShadingType.CLEAR, color: "auto" } : (isHl ? { fill: "EAF1FB", type: ShadingType.CLEAR, color: "auto" } : undefined),
    children: [new Paragraph({ alignment: left.includes(i) ? AlignmentType.LEFT : AlignmentType.RIGHT,
      children: [new TextRun({ text: String(t), font: FONT, size: 17, bold: isH || isHl, color: isH ? "FFFFFF" : "111827" })] })] });
  return new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: head.map((t, i) => cell(t, widths[i], i, true)) }),
      ...rows.map((r, k) => new TableRow({ children: r.map((t, i) => cell(t, widths[i], i, false, hl.includes(k))) }))] });
}

const children = [
  new Paragraph({ spacing: { after: 60 }, children: [run("INTERNAL RESEARCH  |  BUSINESS CASE INPUT  |  NOT FOR EXTERNAL RELEASE", { size: 16, color: GREY })] }),
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("The Cost of Time: Open Market, DoD Vehicles and GSA MAS")] }),
  p(run("DoD professional services (PSC R, B, U), FY2020 through July 2026. Companion to the analysis workbook; every number here traces to its Cost Summary, Cost Model, Vehicle Cost and Cost Inputs tabs.", { size: 18, color: GREY })),

  h1("Bottom line"),
  p("Priced in dollars, the cost of time is small, and on fees alone DoD's own vehicles beat MAS. The case for MAS has to rest on speed to capability, duplicated industry effort and labor-rate differences, not on administrative cost."),
  p([run("Open-market delay. ", { bold: true }), run("Moving the open-market buys that MAS could have handled would save about $7.0M a year in base-case time costs, but would also cost about $3.3M a year in GSA fees. The net is about $3.7M a year (range of -$1.2M to +$26.6M). Nearly all of the net comes from one assumption: that a quarter of the delay days are service the government needed and did not get. Strip that out and the savings and the fee roughly cancel (-$0.6M).")]),
  p([run("DoD-owned vehicles. ", { bold: true }), run("Standing up the 13 in-scope MAC families and running them costs DoD about $15.3M a year in base-case labor and duplicated industry proposals spread over vehicle life. Ordering the same $45.4B on MAS would have cost about $49.8M a year in GSA fees. On cost alone, DoD's vehicles come out about $34.5M a year cheaper (range $4.6M to $44.2M cheaper). MAS would need labor rates about 0.52% lower than DoD-vehicle rates to break even.")]),
  p([run("What the money view misses. ", { bold: true }), run("Time. A new DoD MAC took a median of 233 days from RFP release to first award before a single order could be solicited, and competed open-market buys above the SAT took 28 days longer than matched MAS orders. For a requirement with no existing vehicle, that is 233 or more days of capability not delivered. The model puts a dollar figure on that only through the unmet-need assumption, and you should treat that figure as the weakest number in it.")]),

  h1("1. Results"),
  table(["Per year unless noted", "Low", "Base", "High"], [
    ["Open market: gross cost of extra PALT", "$0.5M", "$7.0M", "$31.5M"],
    ["Open market: MAS fee on the same buys", "-$1.6M", "-$3.3M", "-$4.9M"],
    ["Open market: net cost of delay", "-$1.2M", "$3.7M", "$26.6M"],
    ["Open market: contract value delayed (dollar-years)", "$10.4M", "$47.9M", "$126.7M"],
    ["Sensitivity: net, every open-market competed buy above SAT", "-$6.0M", "$6.3M", "$69.7M"],
    ["Vehicles: government stand-up labor, spread over life", "$1.9M", "$3.7M", "$6.7M"],
    ["Vehicles: duplicated industry proposals, spread over life", "$1.1M", "$6.3M", "$27.8M"],
    ["Vehicles: DoD program-office cost", "$2.7M", "$5.3M", "$10.6M"],
    ["Vehicles: MAS fee avoided", "$49.8M", "$49.8M", "$49.8M"],
    ["Vehicles: net cost vs MAS (negative = DoD vehicles cheaper)", "-$44.2M", "-$34.5M", "-$4.6M"],
    ["Breakeven MAS rate advantage", "0.67%", "0.52%", "0.07%"],
    ["One-time: industry proposal cost, 13 families", "$44.9M", "$179.6M", "$598.8M"],
  ], [5560, 1270, 1270, 1270], [0], [2, 9]),
  cap("Table 1. Low and high are corner cases: every input at its low or high value at once. The plausible range is narrower. Source: Cost Summary tab."),

  h1("2. What is being priced"),
  p("Two counterfactuals, each measured against what the data shows actually happened."),
  num([run("Open market to MAS. ", { bold: true }), run("The population is open-market, competed, above-SAT new awards, FY2020 to July 2026, limited to the 4-digit PSC, dollar band, fiscal year and pricing combinations where DoD also made a competed above-SAT MAS award: 1,484 awards worth $6.0B in base-and-all-options value, about 217 awards and $878M a year. Each band gets the matched PALT gap measured in the main analysis: SAT to $1M, 13.0 days; $1M to $7.5M, 35.3; $7.5M to $25M, 51.3; $25M to $100M, 43.0; above $100M, 28.4 (pooled, band too thin). Low and high use each band's 95% confidence interval.")]),
  num([run("DoD vehicle to MAS. ", { bold: true }), run("The population is the 15 largest identifiable DoD professional-services MAC families by FY2020 to FY2026 order obligations, less LOGCAP V and the probable WEXMAC 2.0, which are contingency logistics MAS would not host. That leaves 13 families, 2,994 awardee IDVs and $45.4B in orders. Stand-up time comes from FPDS: RFP release to first IDV award, median 233 days.")]),

  h1("3. The math"),
  p("Open-market block, per dollar band, then summed, multiplied by the movable share and divided by 6.833 years (six fiscal years plus ten months of FY2026):"),
  formula("Escalation      = contract value x escalation rate x gap days / 365"),
  formula("Gov't labor     = awards x gap days x labor hours per gap day x loaded hourly rate"),
  formula("Time value      = contract value x ((1 + real discount rate)^(gap days / 365) - 1)"),
  formula("Unmet need      = sum of daily contract value x gap days x unmet share"),
  formula("MAS fee         = -(contract value x 0.75%)"),
  formula("Net per year    = (sum of the five lines) x movable share / 6.833"),
  p("Daily contract value is base-and-all-options value divided by the potential period of performance, for awards with at least 30 days of performance."),
  p("Vehicle block, per family, then summed over in-scope families:"),
  formula("Stand-up labor  = team FTE (by awardee tier) x stand-up days / 365 x loaded annual cost"),
  formula("Proposal cost   = awardees x offerors per awardee x cost per proposal"),
  formula("Duplicated      = proposal cost x min(1, measured MAS overlap x multiplier)"),
  formula("PMO cost        = PMO FTE x loaded annual cost x 6.833 years"),
  formula("Fee avoided     = FY20-26 orders x 0.75%"),
  formula("Net per year    = (stand-up + duplicated) / 10-yr life + PMO / 6.833 - fee avoided / 6.833"),
  formula("Breakeven rate  = max(0, -net per year) / (orders / 6.833)"),
  p("Worked check, base case, SAT to $1M band: escalation = $398.4M x 3.1% x 13.0 / 365 = $439,867. Government labor = 765 awards x 13.0 days x 1.0 hour x $98.04 = $975,054. Unmet need = $847,960 per day x 13.0 x 25% = $2,755,869. All three match the Cost Model tab."),

  h1("4. Inputs and assumptions"),
  table(["Input", "Low", "Base", "High", "Basis"], [
    ["Escalation rate", "2.5%", "3.1%", "4.0%", "BLS ECI, Oct. 30, 2026: civilian wages +3.1%, 12 months to Sept. 2026"],
    ["Loaded hourly rate", "$98.04", "$98.04", "$98.04", "GS-13/5 DC 2026 $138,023 x (1 + 36.25% fringe + 12% overhead) / 2,087 hrs"],
    ["Labor hours per extra PALT day", "0.5", "1.0", "2.0", "Assumption: combined team effort; no published DoD figure"],
    ["Share movable to MAS", "25%", "50%", "75%", "Assumption"],
    ["Share of delay that is unmet need", "0%", "25%", "50%", "Assumption: drives the open-market result"],
    ["Real discount rate", "1.5%", "2.0%", "3.0%", "OMB Circular A-4 (2023) default 2.0%"],
    ["MAS fee (IFF)", "0.75%", "0.75%", "0.75%", "GSAR 552.238-80; GSA Vendor Support Center"],
    ["Stand-up team FTE (<=10 / 11-100 / >100 awardees)", "3/5/10", "5/10/20", "8/15/40", "Assumption"],
    ["Offerors per awardee", "1.0", "1.5", "2.0", "Assumption"],
    ["Cost per IDIQ proposal", "$15K", "$40K", "$100K", "Assumption anchored to AmEx survey: $148,124/yr all bidding, small business"],
    ["Multiplier on measured MAS overlap", "1.0x", "1.5x", "2.0x", "Measured overlap is a lower bound"],
    ["PMO FTE per vehicle per year", "1", "2", "4", "Assumption"],
    ["Vehicle ordering life", "10 yrs", "10 yrs", "10 yrs", "SeaPort-NxG 5+5, RS3 10-year, LOGCAP V 10-year"],
  ], [2700, 900, 900, 900, 3960], [0, 4]),
  cap("Table 2. Yellow-shaded cells in the Cost Inputs tab mark the judgment assumptions. Change them there and every tab recalculates."),
  p([run("Measured, not assumed: ", { bold: true }), run("the share of each vehicle's awardees that also received a DoD professional-services MAS order in FY2020 to FY2026. SeaPort-NxG: 23% (435 of 1,904). RS3: 32% (90 of 284). SOF Core Support: 23%. Two Air Force vehicles: 67% and 90%. This is a lower bound on MAS holders, because a firm can hold MAS without a DoD order in these PSCs.")]),
  p([run("Tested and dropped: ", { bold: true }), run("year-end risk. 22.5% of open-market awards and 22.1% of MAS awards were made in September (FY2020 to FY2025), with 14.9% and 14.2% in the last two weeks. No difference, so expiring-funds risk is not counted against the open market.")]),

  h1("5. What this does not price"),
  bul([run("Labor-rate differences between MAS and open-market or DoD-vehicle awards. ", { bold: true }), run("This is the biggest lever. A 1% price difference on the addressable $6.0B is about $8.8M a year, more than any priced line in the open-market block. On the $45.4B of DoD-vehicle orders, a 0.52% difference flips the vehicle result. Next research step: compare awarded labor rates for matched categories.")]),
  bul("Mission value of capability delivered late, beyond the contract-price floor used for unmet need."),
  bul("Bid protests, bridge contracts and sole-source extensions caused by late awards (GAO-16-15). Partly observable in FPDS; not modeled."),
  bul("Workforce opportunity cost: the 233 days of stand-up and the extra PALT days are contracting capacity not spent on other requirements. Shown in hours on request, not priced."),
  p([run("On the fee: ", { bold: true }), run("the 0.75% is a transfer to GSA that pays for work GSA does in DoD's place (building and administering the schedule). Government-wide it is not a pure cost. In DoD's budget it is, which is the view this memo takes.")]),

  h1("Sources"),
  bul("BLS Employment Cost Index release, Oct. 30, 2026: bls.gov/news.release/archives/eci_10302026.htm"),
  bul("OPM 2026 General Schedule and Washington-Baltimore locality (33.94%); GS-13/5 base $103,049. Verify at opm.gov."),
  bul("OMB Memorandum M-08-13 (fringe factor 36.25%); OMB Circular A-76 overhead 12% (GAO/NSIAD-98-62)."),
  bul("OMB Circular A-4 (2023) and A-94 Appendix C (M-26-09, Mar. 2026) discount rates."),
  bul("GSAR 552.238-80, Industrial Funding Fee and Sales Reporting; GSA Vendor Support Center (0.75%)."),
  bul("American Express OPEN for Government Contracts survey (released Jan. 2017), via Government Executive."),
  bul("Liebman and Mahoney, American Economic Review 107(11), 2017 (year-end spending); GAO-16-15 (bridge contracts)."),
  bul("FPDS via USASpending.gov for all populations, gaps, stand-up times and awardee overlap; scripts 03, 07 and 08 in analysis/dow-pshc-palt/."),
];

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 21 } } }, paragraphStyles: [
    { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { font: FONT, size: 36, bold: true }, paragraph: { spacing: { before: 0, after: 80 }, keepNext: true } },
    { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 26, bold: true, color: NAVY },
      paragraph: { spacing: { before: 280, after: 120 }, keepNext: true, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 2 } } } }] },
  numbering: { config: [
    { reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
    { reference: "num", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] }] },
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1300, bottom: 1300, left: 1440, right: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
      new TextRun({ text: "Cost of Time  |  Internal research  |  Page ", font: FONT, size: 16, color: GREY }),
      new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: GREY })] })] }) },
    children }],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync(OUTF, b); console.log("wrote", OUTF); });
