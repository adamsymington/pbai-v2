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
  new Paragraph({ spacing: { after: 60 }, children: [run("INTERNAL RESEARCH  |  BUSINESS CASE INPUT  |  REVISION 2  |  NOT FOR EXTERNAL RELEASE", { size: 16, color: GREY })] }),
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("The Cost of Time: Open Market, DoD Vehicles and GSA MAS")] }),
  p(run("DoD professional services (PSC R, B, U), FY2020 through July 2026. Every number traces to the workbook's Cost Summary, Cost Model, Vehicle Cost, Cost Population and Cost Inputs tabs. Revision 2 adds breakevens, measured bridges and extensions, and the capability cost of vehicle stand-up.", { size: 18, color: GREY })),

  h1("Bottom line"),
  p("Time now has a price in this model, and the decision turns on one question: how much of a delayed day's work is need that goes unmet? The thresholds are low."),
  p([run("Open market. ", { bold: true }), run("MAS beats open-market buying on cost if just 1.5% of each delayed day's contract value is need that goes unmet (base inputs). The base assumption is 25%, which puts the net cost of open-market delay at about $4.1M a year (range of -$1.2M to +$28.6M). Even the low case only needs 27.5% to flip.")]),
  p([run("DoD-owned vehicles. ", { bold: true }), run("Before time is priced, DoD's own vehicles beat MAS by about $34.5M a year, almost entirely because they avoid GSA's 0.75% fee on $45.4B of orders. Pricing the capability gap during their 233-day median stand-up cuts that to about $20.0M a year in the base case, and the high case flips it to MAS being $66.3M a year cheaper. MAS wins when more than 5.4% of a stand-up day's order value is need that waited and went unmet.")]),
  p([run("Late awards across the portfolio. ", { bold: true }), run("DoD made about 1,400 bridge-type awards in professional services from FY2020 to July 2026, worth $2.8B at award (about $406M a year). At a 5% non-competed premium, late awards cost about $20M a year in premiums alone. That is a measured cost of time, but it falls on every vehicle; MAS does not avoid extensions any more than the open market does.")]),
  p([run("Read with care. ", { bold: true }), run("The unmet-need share and the waited share are judgment calls, and they now drive the answer. The breakevens are there so a reader can supply their own view of mission value instead of accepting ours.")]),

  h1("1. Results"),
  table(["Per year unless noted", "Low", "Base", "High"], [
    ["Open market: gross cost of extra PALT (incl. bridge premium)", "$0.5M", "$7.4M", "$33.5M"],
    ["Open market: MAS fee on the same buys", "-$1.6M", "-$3.3M", "-$4.9M"],
    ["Open market: net cost of delay", "-$1.2M", "$4.1M", "$28.6M"],
    ["Open market: breakeven unmet-need share for MAS to win", "27.5%", "1.5%", "0%"],
    ["Vehicles: net vs MAS before capability delay", "-$44.2M", "-$34.5M", "-$4.6M"],
    ["Vehicles: capability delay of stand-up", "$0", "$14.6M", "$71.0M"],
    ["Vehicles: net vs MAS after capability delay", "-$44.2M", "-$20.0M", "$66.3M"],
    ["Vehicles: breakeven lost share of a stand-up day's orders", "6.9%", "5.4%", "0.7%"],
    ["Vehicles: breakeven MAS labor-rate advantage (before capability)", "0.67%", "0.52%", "0.07%"],
    ["Portfolio: bridge-type award value at award", "$406M", "$406M", "$406M"],
    ["Portfolio: premium on bridge work", "$0", "$20.3M", "$40.6M"],
  ], [5560, 1270, 1270, 1270], [0], [2, 3, 6, 7]),
  cap("Table 1. Negative vehicle nets mean DoD's own vehicles cost less than MAS. Low and high are corner cases, every input at one extreme, so the plausible range is narrower. Source: Cost Summary tab."),

  h1("2. What changed in Revision 2"),
  num([run("Breakevens. ", { bold: true }), run("Instead of asserting a mission value, the model solves for the value at which MAS wins. For the open market that is the share of a delayed day's contract value that must be unmet need. For vehicles it is the share of a stand-up day's order value that must be lost (waited share times unmet share).")]),
  num([run("Bridges and extensions, measured. ", { bold: true }), run("Two FPDS measures. Extensions: 38.1% of matched open-market awards and 36.7% of matched MAS awards ran past their original end, by about 102 days on average in both. No difference, so MAS gets credit only for the extension days its shorter PALT removes. Bridge-type awards (GAO-16-15 definition, below): 1,402 awards, $2.8B at award, $5.5B obligated as many were themselves extended.")]),
  num([run("Capability cost of vehicle stand-up. ", { bold: true }), run("Revision 1 charged $0, on the theory that a predecessor kept the work flowing. Revision 2 charges each family for demand that waited: 5% of daily order volume for replacement vehicles (SeaPort-NxG, RS3, SOF Core Support, the SeaPort-NxG rolling admission), 25% for vehicles with no identified predecessor, times the 25% unmet-need share.")]),

  h1("3. The math"),
  p("Open-market block, per dollar band, summed, times the movable share, divided by 6.833 years:"),
  formula("Escalation      = contract value x escalation rate x gap days / 365"),
  formula("Gov't labor     = awards x gap days x labor hours per gap day x loaded hourly rate"),
  formula("Time value      = contract value x ((1 + real discount rate)^(gap days / 365) - 1)"),
  formula("Unmet need      = sum of daily contract value x gap days x unmet share"),
  formula("Bridge premium  = sum of daily contract value x gap days x P(extended) x premium"),
  formula("MAS fee         = -(contract value x 0.75%)"),
  formula("Breakeven share = -(escalation + labor + time value + bridge + fee)"),
  formula("                  / (sum of daily contract value x gap days)"),
  p("Vehicle block, per in-scope family, then summed:"),
  formula("Stand-up labor  = team FTE x stand-up days / 365 x loaded annual cost"),
  formula("Duplicated      = awardees x offerors per awardee x cost per proposal x min(1, MAS overlap x multiplier)"),
  formula("PMO cost        = PMO FTE x loaded annual cost x 6.833 years"),
  formula("Fee avoided     = FY20-26 orders x 0.75%"),
  formula("Capability      = stand-up days x daily order value x waited share x unmet share"),
  formula("Net per year    = (stand-up + duplicated + capability) / 10-yr life + (PMO - fee avoided) / 6.833"),
  formula("Breakeven       = max(0, -net before capability) x 10 / sum(stand-up days x daily order value)"),
  p("Daily order value is FY2020 to FY2026 orders divided by 2,494 days. Worked check, base case, SAT to $1M band: bridge premium = $847,960 per day x 13.0 days x 38.1% x 5% = $209,997, which matches the Cost Model tab."),

  h1("4. Inputs and assumptions"),
  table(["Input", "Low", "Base", "High", "Basis"], [
    ["Escalation rate", "2.5%", "3.1%", "4.0%", "BLS ECI, Oct. 30, 2026 release"],
    ["Loaded hourly rate", "$98.04", "$98.04", "$98.04", "GS-13/5 DC 2026 x (1 + 36.25% + 12%) / 2,087"],
    ["Labor hours per extra PALT day", "0.5", "1.0", "2.0", "Assumption"],
    ["Share movable to MAS", "25%", "50%", "75%", "Assumption"],
    ["Unmet-need share of a delay day", "0%", "25%", "50%", "Assumption: drives results; see breakevens"],
    ["Real discount rate", "1.5%", "2.0%", "3.0%", "OMB Circular A-4 (2023)"],
    ["MAS fee (IFF)", "0.75%", "0.75%", "0.75%", "GSAR 552.238-80"],
    ["P(predecessor extended)", "36.7%", "38.1%", "45.2%", "Measured: matched MAS / matched OM / raw OM"],
    ["Premium on bridge / extension work", "0%", "5%", "10%", "Assumption: no published % found"],
    ["Waited share, replacement vehicle", "0%", "5%", "15%", "Assumption"],
    ["Waited share, new vehicle", "10%", "25%", "50%", "Assumption"],
    ["Stand-up team FTE (<=10 / 11-100 / >100)", "3/5/10", "5/10/20", "8/15/40", "Assumption"],
    ["Offerors per awardee; cost per proposal", "1.0; $15K", "1.5; $40K", "2.0; $100K", "Assumption; AmEx survey anchor"],
    ["PMO FTE per vehicle; vehicle life", "1; 10 yrs", "2; 10 yrs", "4; 10 yrs", "Assumption; vehicle terms"],
  ], [2700, 900, 900, 900, 3960], [0, 4]),
  cap("Table 2. Full source notes sit beside each input in the Cost Inputs tab."),
  p([run("Bridge-type award definition. ", { bold: true }), run("A new award that is not competed (FAR 6.302 only one source, follow-on, urgency or unique source; or a fair-opportunity exception for follow-on, urgency or one source), with a potential period of performance of 12 months or less, to the incumbent: the same contractor, awarding office and 4-digit PSC held another award ending between 180 days before and 30 days after the new award's start. Each of the 1,402 records is listed with its USASpending permalink (output/r3_bridge_type_awards.csv.gz).")]),
  p([run("Tested and dropped: ", { bold: true }), run("year-end risk (22.5% of open-market and 22.1% of MAS awards in September), and extension incidence as a MAS advantage (matched rates 38.1% vs 36.7%).")]),

  h1("5. Still not priced"),
  bul([run("Labor-rate differences, prices paid. ", { bold: true }), run("A 1% difference on the addressable $6.0B is about $8.8M a year; 0.52% flips the vehicle result before capability delay. MAS ceiling rates overstate prices paid because FAR 8.405-4 requires seeking price reductions, so the comparison must use prices paid by labor category.")]),
  bul("Mission value above contract price. The unmet-need valuation uses contract price, a floor."),
  bul("Bid protests, which add months to large stand-ups (RS3 drew multiple), and workforce opportunity cost."),
  p([run("On the fee: ", { bold: true }), run("the 0.75% pays GSA for work it does in DoD's place. Government-wide it is a transfer; in DoD's budget it is a cost, which is the view taken here.")]),

  h1("Sources"),
  bul("BLS Employment Cost Index release, Oct. 30, 2026; OPM 2026 GS tables (DC locality 33.94%)."),
  bul("OMB M-08-13 (fringe 36.25%); OMB Circular A-76 overhead 12% (GAO/NSIAD-98-62); OMB Circular A-4 (2023); A-94 Appendix C (M-26-09)."),
  bul("GSAR 552.238-80 and GSA Vendor Support Center (IFF 0.75%); FAR 8.405-4 (price reductions)."),
  bul("GAO-16-15 (bridge contracts); DODIG-2022-104 (sole-source pricing); IDA P-4542 (competition in DoD services)."),
  bul("NAVSEA 2020 small business industry brief (SeaPort-e to SeaPort-NxG transition); GovConWire and Washington Technology (RS3 consolidation); SAM.gov notice H92400-19-R-0003 via HigherGov (SWMS recompete)."),
  bul("American Express OPEN for Government Contracts survey (Jan. 2017); Liebman and Mahoney, AER 2017."),
  bul("FPDS via USASpending.gov for populations, gaps, extensions, bridges, stand-up times and awardee overlap; scripts 03, 07, 08 in analysis/dow-pshc-palt/."),
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
