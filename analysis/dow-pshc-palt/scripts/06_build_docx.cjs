// Build the Word report. Usage: node 06_build_docx.js <docx_build_dir> <out.docx>
const fs = require("fs"), path = require("path");
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType,
  HeadingLevel, ImageRun, LevelFormat, BorderStyle, Footer, PageNumber, ExternalHyperlink } = require("docx");
const [B, OUTF] = process.argv.slice(2);
const D = JSON.parse(fs.readFileSync(path.join(B, "data.json")));
const FONT = "Arial", NAVY = "1F3A5F", GREY = "555555";

const p = (text, o = {}) => new Paragraph({ spacing: { after: 140, line: 276 }, ...o.para,
  children: (Array.isArray(text) ? text : [text]).map(t => typeof t === "string" ? new TextRun({ text: t, font: FONT, size: 21, ...o.run }) : t) });
const b = (t) => new TextRun({ text: t, font: FONT, size: 21, bold: true });
const r = (t) => new TextRun({ text: t, font: FONT, size: 21 });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const bullet = (runs) => new Paragraph({ numbering: { reference: "bul", level: 0 }, spacing: { after: 80, line: 276 },
  children: (Array.isArray(runs) ? runs : [runs]).map(t => typeof t === "string" ? r(t) : t) });
const num = (runs) => new Paragraph({ numbering: { reference: "num", level: 0 }, spacing: { after: 80, line: 276 },
  children: (Array.isArray(runs) ? runs : [runs]).map(t => typeof t === "string" ? r(t) : t) });
const caption = (t) => new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: t, font: FONT, size: 17, italics: true, color: GREY })] });
const img = (f, w, h) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 },
  children: [new ImageRun({ type: "png", data: fs.readFileSync(path.join(B, f)), transformation: { width: w, height: h },
    altText: { title: f, description: f, name: f } })] });

const border = { style: BorderStyle.SINGLE, size: 4, color: "C9D1DB" };
const borders = { top: border, bottom: border, left: border, right: border };
function table(head, rows, widths, hl = -1, left = [0]) {
  const total = widths.reduce((a, c) => a + c, 0);
  const cell = (t, w, i, isHead, bold) => new TableCell({ borders, width: { size: w, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    shading: isHead ? { fill: NAVY, type: ShadingType.CLEAR, color: "auto" } : (bold ? { fill: "EAF1FB", type: ShadingType.CLEAR, color: "auto" } : undefined),
    children: [new Paragraph({ alignment: left.includes(i) ? AlignmentType.LEFT : AlignmentType.RIGHT,
      children: [new TextRun({ text: String(t), font: FONT, size: 17, bold: isHead || bold, color: isHead ? "FFFFFF" : "111827" })] })] });
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: head.map((t, i) => cell(t, widths[i], i, true)) }),
      ...rows.map((row, k) => new TableRow({ children: row.map((t, i) => cell(t, widths[i], i, false, k === hl)) }))] });
}
const link = (t, url) => new ExternalHyperlink({ link: url, children: [new TextRun({ text: t, font: FONT, size: 19, style: "Hyperlink" })] });
const src = (lead, t, url) => new Paragraph({ numbering: { reference: "bul", level: 0 }, spacing: { after: 60 },
  children: [new TextRun({ text: lead + " ", font: FONT, size: 19 }), link(t, url)] });

const S = D.summary;
const children = [
  new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "ACQUISITION ANALYSIS  |  DoD / DEPARTMENT OF WAR  |  FY2020 TO FY2026", font: FONT, size: 16, color: GREY })] }),
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("Professional Services: GSA MAS vs the Open Market")] }),
  p("Spend mix, procurement administrative lead time (PALT), and the cost of building DoD-owned vehicles", { run: { italics: true, color: GREY } }),
  p([new TextRun({ text: "Data: USASpending.gov (FPDS-sourced), pulled Nov. 3, 2026. DoD-awarded actions, PSC families R, B and U. FY2026 is partial; published DoD data runs through " + S.latest_action_date_published + " because DoD contract data posts with a 90-day delay. 525,509 transactions; 102,628 new awards.", font: FONT, size: 17, color: GREY })]),

  h1("Bottom line"),
  p("For the kinds of professional-services buys DoD actually placed on MAS, the same buy took longer to award on the open market, and the gap grows with dollar value. Competed buys above the simplified acquisition threshold took a weighted median of 76.7 days on the open market against 48.4 days on MAS, a difference of 28.4 days (95% CI 22.4 to 35.3). Below the SAT there is no meaningful difference."),
  p("DoD's own multiple-award vehicles order about as fast as MAS once they exist (difference of 1.0 day, CI spanning zero). Building them is where the time goes: across the 15 largest identifiable DoD professional-services MAC families, the median time from RFP release to first IDV award was 281 days, and 233 days with the two contingency-logistics vehicles removed. That time is never recovered through faster ordering."),
  p("MAS carried 5.3% of DoD's $354.0B in professional-services obligations from FY2020 through July 2026. The open market carried 23.5%. DoD-owned IDIQs carried 57.4%."),
  table(["Measure", "Value", "Source tab"], [
    ["DoD PSHC obligations, FY20 to Jul. 2026", "$354.0B", "Spend by Vehicle"],
    ["GSA MAS share (orders + BPA calls)", "5.3% ($18.7B)", "Spend by Vehicle"],
    ["Open-market share (stand-alone; floor of Tier 0)", "23.5% ($83.1B)", "Spend by Vehicle"],
    ["MAS share by year", "6.3% FY20, 4.7% FY25, 4.9% FY26 (partial)", "Spend Share"],
    ["Matched PALT gap, competed above SAT", "+28.4 days (CI +22.4 to +35.3)", "Matched OM vs MAS, spec E"],
    ["Matched order PALT, DoD MAC minus MAS", "-1.0 day (CI -6.5 to +2.3)", "Matched MAC vs MAS"],
    ["Median DoD MAC stand-up (RFP to first award)", "281 days (233 excl. logistics)", "Vehicle Stand-up"],
  ], [4300, 3000, 2060], 4, [0, 1, 2]),
  p([new TextRun({ text: "On wording. ", font: FONT, size: 19, bold: true }), new TextRun({ text: "\"Open market\" here means stand-alone contracts and POs with no parent vehicle. That is a subset of OMB Tier 0, not all of it: official Tier 0 also includes DoD single-award IDIQs and other vehicles without a spend-under-management designation, and contract-level tier assignments are not public. Write \"open-market (Tier 0) spend of at least $83.1B,\" never \"DoD's Tier 0 spend was $83.1B.\"", font: FONT, size: 19 })],
    { para: { shading: { fill: "FFF7E6", type: ShadingType.CLEAR, color: "auto" }, spacing: { before: 200, after: 200 } } }),

  h1("1. Where the money went"),
  p("DoD awarded $354.0B in professional, administrative, management, studies and training services between October 2019 and July 2026. More than half ran through DoD's own IDIQs, single award ($107.8B) and multiple award ($95.4B). The open market took $83.1B. MAS took $18.7B, and its share slid from 6.3% in FY2020 to 4.7% in FY2025 before ticking up to 4.9% in the partial FY2026."),
  img("c1_spend.png", 600, 288),
  caption("Figure 1. Obligations by vehicle type, FY2020 through July 2026, DoD-awarded actions. Source: Spend by Vehicle tab."),
  p("GSA also awarded another $44.0B of DoD-funded professional services as assisted acquisitions over the same period. That money went overwhelmingly to non-MAS IDIQs of the OASIS type ($34.4B). Only $2.2B of it went on MAS orders. Counting assisted acquisitions does not change the picture: DoD barely uses MAS for these services."),
  p("The open-market dollars sit in PSCs MAS already covers. R425 (engineering and technical support) carried $39.2B on the open market against $5.1B on MAS. R499 (other professional support) carried $10.6B against $4.6B, and R408 (program management) carried $6.0B against $2.9B. Some of that work cannot go on MAS (classified requirements, contingency logistics, work needing cost-type contracts), but the PSC overlap is large."),

  h1("2. PALT: the raw numbers mislead"),
  p("Unmatched, the two look alike: a median of 28 days for MAS orders and BPA calls, 26 days for open-market awards. The comparison is skewed by competition. 62% of open-market awards were not competed, against 23% of MAS awards, and non-competed buys award quickly."),
  p("The fix is to compare each MAS buy only with open-market buys of the same 4-digit PSC, dollar band, fiscal year, pricing family and competition status (coarsened exact matching, weighted by MAS count per stratum, with a 500-draw bootstrap for the confidence intervals). Matched that way, the gap is consistent and concentrated in competed buys above the SAT."),
  img("c2_palt.png", 600, 256),
  caption("Figure 2. Weighted median PALT, competed buys, matched strata. SAT is $250K through FY2025 and $350K from Oct. 1, 2025 (FAC 2025-06). The >$100M band has too few matched MAS awards to report. Source: Matched by Band tab."),
  table(["Specification", "MAS n", "OM n", "MAS days", "OM days", "Gap", "95% CI"], D.t6, [3160, 900, 900, 1000, 1000, 900, 1500], 4),
  caption("Table 1. Open market minus MAS, weighted median PALT in days. Source: Matched OM vs MAS tab."),
  p("All eight specifications point the same direction, ranging from +9.3 to +28.4 days. A log-PALT fixed-effects regression with stratum-clustered standard errors gives the same answer: MAS PALT runs 19.8% shorter overall (CI 13.7% to 25.4%) and 30.9% shorter for competed buys above the SAT (CI 22.8% to 38.1%). The smallest estimate comes from matching within the same DoD component (spec H). Part of the gap reflects which commands use MAS, not only the vehicle."),

  h1("3. DoD's own vehicles: fast orders, slow to build"),
  p("Raw, DoD MAC orders look slow, at a median of 63 days against MAS's 28. Matched on the same strata, the difference disappears: for the same kind of buy, DoD MAC orders and MAS orders award within about a day of each other. Once an internal vehicle exists, it buys about as fast as MAS. The cost is in building it."),
  img("c3_vehicles.png", 600, 352),
  caption("Figure 3. RFP release to first IDV award, from the IDV records in FPDS, for the 15 largest identifiable DoD professional-services MAC families by FY2020 to FY2026 order obligations. Pre-RFP work (draft RFPs, RFIs, industry days) is outside this window, so actual development time is longer. * = contingency or expeditionary logistics."),
  table(["Vehicle", "Solicitation", "RFP (FPDS)", "First award", "Stand-up days", "Order PALT med.", "Orders $B"], D.veh, [2060, 1700, 1150, 1150, 1100, 1100, 1100], -1, [0, 1]),
  caption("Table 2. Vehicles without a confirmed program name show the awarding component; each is verifiable on SAM.gov by solicitation number. Source: Vehicle Stand-up tab."),
  p("The FPDS dates match the public record for the three biggest families. NAVSEA announced the SeaPort-NxG solicitation on June 1, 2018, and awards are dated January 2019; FPDS shows June 1 to Dec. 3, 2018. The RS3 draft RFP came out in December 2014 and the first 55 to 56 awards in May 2017; FPDS shows Mar. 15, 2015 to May 15, 2017. The LOGCAP V final RFP was released in November 2017 and awards came in April 2019; FPDS shows Nov. 20, 2017 to Apr. 12, 2019."),
  p("LOGCAP V and the probable WEXMAC 2.0 family are contingency and expeditionary logistics. MAS would not realistically host them, and they should stay out of any argument that DoD should have used MAS instead."),
  p([b("The counterfactual. "), r("An office that needed engineering or program-management support could place a competed MAS order with a median PALT of 28 days, or about 48 days for competed buys above the SAT. Building a new MAC first added a median of 233 to 281 days before the first order could even be solicited, and order PALT on the new vehicle then matched MAS. The stand-up time is the whole difference.")]),

  h1("4. Will this hold up"),
  num([b("Reproducible. "), r("The public API calls are scripted, the analysis is deterministic (seeded bootstrap), and the workbook's Records tab lists all 15,548 MAS and open-market awards behind the PALT figures with PIID, dates and a USASpending permalink.")]),
  num([b("Coverage. "), r("Solicitation date is reported on 36% to 66% of new awards depending on group and year. PALT describes the records that report a date; nothing is imputed. MAS coverage fell to 36% in the partial FY2026.")]),
  num([b("Statutory window only. "), r("PALT runs from solicitation to award (FY2019 NDAA section 878; OFPP memo of Jan. 14, 2021). It excludes requirements development and market research. Any claim that MAS saves front-end time too is not measured here.")]),
  num([b("Scope proxy. "), r("PSC families R, B and U approximate the Professional Services and Human Capital categories. They are not GSA's official crosswalk, and they include some work MAS cannot host.")]),
  num([b("Tier 0 is a floor. "), r("See the wording note in the bottom line.")]),
  num([b("Integrity checks. "), r("782 PALT values over three years were excluded; none were negative. DoD MAC orders whose solicitation date precedes the parent IDV's award (17%) were excluded from the MAC-vs-MAS comparison. Vehicle families whose earliest IDV carries a later on-ramp date were flagged and dropped.")]),
  num([b("Selection. "), r("Matching controls for PSC, size, year, pricing and competition. It cannot control for requirement complexity within a PSC or workforce differences between commands. Matching within component shrinks the gap to 9.3 days but does not remove it.")]),
  num([b("FY2026 is partial. "), r("Published data runs through " + S.latest_action_date_published + ". FY2026 adds 10 months of data and does not change any finding.")]),

  h1("Definitions"),
  table(["Term", "Definition used"], [
    ["DoD / DoW", "Awarding toptier agency = Department of Defense (097). \"Department of War\" is the secondary title under EO 14347 (Sept. 2025)."],
    ["PSHC scope", "PSC families R (professional, administrative, management support), B (special studies and analyses), U (education and training)."],
    ["PALT", "Award date minus solicitation date for the initial action (modification 0)."],
    ["GSA MAS", "Orders referencing an FSS contract, plus BPA calls under BPAs whose parent is FSS."],
    ["Open market", "Stand-alone definitive contracts and purchase orders with no referenced IDV."],
    ["DoD-owned IDIQ", "Orders under IDCs whose referenced IDV agency is DoD (97xx)."],
    ["Competed", "Stand-alone: Extent Competed A, D or F. Orders: Fair Opportunity FAIR or CSA."],
    ["SAT", "$250K through FY2025; $350K from Oct. 1, 2025 (FAC 2025-06, FAR Case 2024-001)."],
  ], [2000, 7360], -1, [0, 1]),

  h1("Sources"),
  src("USASpending.gov API v2 (data sourced from FPDS):", "api.usaspending.gov/docs/endpoints", "https://api.usaspending.gov/docs/endpoints"),
  src("OFPP, Reducing PALT Using Modern Business Practices, Jan. 14, 2021:", "archived memo", "https://trumpwhitehouse.archives.gov/wp-content/uploads/2021/01/OFPPPALTMemorandum-01-14-2021.pdf"),
  src("FY2019 NDAA section 878:", "statute text", "https://wifcon.com/dodauth19/dod19_878.htm"),
  src("OMB SUM tier definitions, USAID CAP goal report:", "performance.gov archive", "https://trumpadministration.archives.performance.gov/state/FY2021_january_Category_Management_USAID.pdf"),
  src("CRS IF12374, Small Business Contracting Under Category Management:", "sgp.fas.org", "https://sgp.fas.org/crs/misc/IF12374.pdf"),
  src("FAC 2025-06 inflation adjustment (SAT $350K, eff. Oct. 1, 2025):", "Federal Register", "https://public-inspection.federalregister.gov/2025-16412.pdf"),
  src("CRS IF13123, Acquisition Thresholds for Small Business Contractors:", "congress.gov", "https://www.congress.gov/crs_external_products/IF/PDF/IF13123/IF13123.1.pdf"),
  src("SeaPort-NxG solicitation (NAVSEA):", "navsea.navy.mil", "https://www.navsea.navy.mil/Media/News/Article/1537907/seaport-next-generation-now-accepting-vendor-proposals/"),
  src("SeaPort-NxG award timing:", "Southeast Aerospace release, Jan. 14, 2019", "https://www.aviationpros.com/aircraft-maintenance-technology/aircraft-technology/maintenance-providers/press-release/12440478/southeast-aerospace-southeast-aerospace-wins-opportunity-on-50b-seaport-next-generation-contract"),
  src("RS3 draft RFP:", "Washington Technology, Dec. 2014", "https://www.washingtontechnology.com/2014/12/army-releases-draft-rfp-for-37b-idiq/346268/"),
  src("RS3 first awards:", "WashingtonExec, 2017", "https://washingtonexec.com/2017/06/nci-earns-prime-position-37b-army-multiple-award-contract/"),
  src("RS3 on-ramp:", "Washington Technology, Oct. 2018", "https://washingtontechnology.com/2018/10/army-makes-second-round-of-awards-for-374b-rs3-vehicle/348792/"),
  src("LOGCAP V solicitation:", "GovConWire, Dec. 2017", "https://govconwire.com/2017/12/army-opens-solicitation-for-82b-logcap-v-contract/"),
  src("LOGCAP V protest:", "GAO B-417506.5", "https://www.gao.gov/docket/b-417506.5"),
  src("SOF Core Support (H92400-19-R-0003):", "HigherGov notice record", "https://highergov.com/contract-opportunity/sof-core-support-h9240019r0003-s-b86dd"),
  p([new TextRun({ text: "Code, data and workbook: analysis/dow-pshc-palt/ on branch claude/jolly-hopper-y9e8mo of adamsymington/pbai-v2.", font: FONT, size: 17, color: GREY })], { para: { spacing: { before: 200 } } }),
];

const doc = new Document({
  creator: "PBAi analysis", title: "DoD Professional Services: GSA MAS vs Open Market",
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { font: FONT, size: 40, bold: true, color: "111827" }, paragraph: { spacing: { before: 0, after: 80 }, keepNext: true } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 28, bold: true, color: NAVY }, paragraph: { spacing: { before: 320, after: 140 }, keepNext: true, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 2 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 23, bold: true }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
    { reference: "num", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
  ] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1300, bottom: 1300, left: 1440, right: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
      new TextRun({ text: "DoD PSHC: MAS vs Open Market  |  Page ", font: FONT, size: 16, color: GREY }),
      new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: GREY })] })] }) },
    children,
  }],
});
Packer.toBuffer(doc).then(buf => { fs.writeFileSync(OUTF, buf); console.log("wrote", OUTF); });
