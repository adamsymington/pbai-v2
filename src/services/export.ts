import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  HeadingLevel,
  BorderStyle,
  AlignmentType
} from 'docx';
import { AnalysisResult, QaspItem, PwstItem, Requirement } from '../types';

// Helper to trigger download
const downloadFile = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};

export const exportToExcel = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadFile(blob, `${fileName}.xlsx`);
};

export const exportToCSV = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, `${fileName}.csv`);
};

export const exportToPDF = (title: string, headers: string[], data: any[][], fileName: string) => {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  
  autoTable(doc, {
    startY: 30,
    head: [headers],
    body: data,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [79, 70, 229] } // Indigo-600
  });
  
  doc.save(`${fileName}.pdf`);
};

export const exportToDocx = async (title: string, sections: { title: string, content: string | any[][] }[], fileName: string) => {
  const children: any[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 400 },
    }),
  ];

  sections.forEach(section => {
    children.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      })
    );

    if (typeof section.content === 'string') {
      children.push(
        new Paragraph({
          children: [new TextRun(section.content)],
          spacing: { after: 200 },
        })
      );
    } else {
      // Table
      const rows = section.content.map(rowData => {
        return new TableRow({
          children: rowData.map(cellData => {
            return new TableCell({
              children: [new Paragraph({ text: String(cellData), spacing: { before: 100, after: 100 } })],
              width: { size: 100 / rowData.length, type: WidthType.PERCENTAGE },
            });
          }),
        });
      });

      children.push(
        new Table({
          rows: rows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      );
    }
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  downloadFile(blob, `${fileName}.docx`);
};

export const exportComprehensiveExcelReport = (result: AnalysisResult) => {
  const fileName = `Comprehensive_Analysis_Report_${new Date().getTime()}.xlsx`;
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Executive Summary & Methodology
  const summaryData = [
    ["PWS ANALYSIS COMPREHENSIVE REPORT"],
    ["Generated On", new Date().toLocaleString()],
    ["Document Type", result.document_type],
    ["Overall Document Score", result.overall_document_score],
    [""],
    ["EXECUTIVE SUMMARY"],
    [result.executive_summary],
    [""],
    ["METHODOLOGY"],
    ["The PWS Analysis Tool uses a multi-agent AI architecture (PWS-INTEL) to evaluate procurement documents."],
    ["1. Extraction: Requirements are identified using explicit and implied linguistic patterns."],
    ["2. Scoring: Each requirement is evaluated across 5 dimensions (0-100 scale):"],
    ["   - Outcome Orientation: Focus on results vs. process."],
    ["   - Measurability: Presence of clear metrics and standards."],
    ["   - Flexibility: Allowance for contractor innovation."],
    ["   - Surveillance Linkage: Alignment with QASP/oversight."],
    ["   - Clarity & Conciseness: Lack of ambiguity and jargon."],
    ["3. Aggregation: Composite scores are weighted averages of individual requirement performance."],
    ["4. Validation: A consistency agent spot-checks for contradictory tags or score outliers."]
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary & Methodology");

  // Sheet 2: Composite Scores (Dimension Averages)
  const compositeData = [
    ["Dimension", "Average Score"],
    ["Outcome Orientation", result.dimension_averages.outcome_orientation],
    ["Measurability", result.dimension_averages.measurability],
    ["Flexibility", result.dimension_averages.flexibility],
    ["Surveillance Linkage", result.dimension_averages.surveillance_linkage],
    ["Clarity & Conciseness", result.dimension_averages.clarity_conciseness],
    [""],
    ["Classification Breakdown"],
    ["Category", "Count"],
    ...result.classification_breakdown.map(c => [c.classification, c.count])
  ];
  const compositeSheet = XLSX.utils.aoa_to_sheet(compositeData);
  XLSX.utils.book_append_sheet(workbook, compositeSheet, "Composite Scores");

  // Sheet 3: Individual Requirement Scoring
  const requirementData = [
    ["ID", "Score", "Criticality", "Classification", "Outcome", "Measurability", "Flexibility", "Surveillance", "Clarity", "Original Text", "Reasoning"],
    ...result.requirements.map(r => [
      r.req_id,
      r.overall_score,
      r.criticality,
      r.classification,
      r.dimension_scores.outcome_orientation,
      r.dimension_scores.measurability,
      r.dimension_scores.flexibility,
      r.dimension_scores.surveillance_linkage,
      r.dimension_scores.clarity_conciseness,
      r.original_text,
      r.reasoning
    ])
  ];
  const requirementSheet = XLSX.utils.aoa_to_sheet(requirementData);
  XLSX.utils.book_append_sheet(workbook, requirementSheet, "Requirement Scoring");

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadFile(blob, fileName);
};

// Specific export for Analysis Overview
export const exportAnalysisReport = async (result: AnalysisResult, format: 'xlsx' | 'csv' | 'pdf' | 'docx' = 'docx') => {
  const fileName = `Analysis_Report_${new Date().getTime()}`;
  
  if (format === 'xlsx' || format === 'csv') {
    const data = result.requirements.map(r => ({
      ID: r.req_id,
      Score: r.overall_score,
      Criticality: r.criticality,
      Text: r.original_text,
      Reasoning: r.reasoning
    }));
    if (format === 'xlsx') exportToExcel(data, fileName);
    else exportToCSV(data, fileName);
    return;
  }

  if (format === 'pdf') {
    const headers = ['ID', 'Score', 'Criticality', 'Text'];
    const data = result.requirements.map(r => [
      r.req_id, 
      r.overall_score, 
      r.criticality, 
      r.original_text.substring(0, 150) + (r.original_text.length > 150 ? '...' : '')
    ]);
    exportToPDF(`Analysis Report - ${result.document_type}`, headers, data, fileName);
    return;
  }

  const sections = [
    { title: 'Executive Summary', content: result.executive_summary || 'No summary available.' },
    { title: 'Strengths', content: (result.strengths || []).join('\n') || 'None identified.' },
    { title: 'Areas for Improvement', content: (result.areas_for_improvement || []).join('\n') || 'None identified.' },
    { 
      title: 'Requirements Summary', 
      content: [
        ['ID', 'Score', 'Criticality', 'Original Text'],
        ...result.requirements.map(r => [r.req_id, r.overall_score, r.criticality, r.original_text.substring(0, 100) + '...'])
      ]
    }
  ];

  await exportToDocx(`PWS Analysis Report - ${result.document_type}`, sections, fileName);
};

export const exportQaspData = async (qasp: QaspItem[], format: 'xlsx' | 'csv' | 'pdf' | 'docx') => {
  const fileName = `QASP_${new Date().getTime()}`;
  const headers = ['Performance Objective', 'Performance Standard', 'Surveillance Method', 'Sampling Frequency', 'Incentive/Disincentive'];
  const data = qasp.map(item => [
    item.performance_objective,
    item.performance_standard,
    item.surveillance_method,
    item.sampling_frequency,
    item.incentive_disincentive
  ]);

  switch (format) {
    case 'xlsx': exportToExcel(qasp, fileName); break;
    case 'csv': exportToCSV(qasp, fileName); break;
    case 'pdf': exportToPDF('Quality Assurance Surveillance Plan (QASP)', headers, data, fileName); break;
    case 'docx': 
      await exportToDocx('Quality Assurance Surveillance Plan (QASP)', [
        { title: 'Surveillance Matrix', content: [headers, ...data] }
      ], fileName);
      break;
  }
};

export const exportPwstData = async (pwst: PwstItem[], format: 'xlsx' | 'csv' | 'pdf' | 'docx') => {
  const fileName = `PWST_${new Date().getTime()}`;
  const headers = ['Task Ref', 'Performance Objective', 'Performance Standard', 'AQL', 'Surveillance Method'];
  const data = pwst.map(item => [
    item.pws_task_reference,
    item.performance_objective,
    item.performance_standard,
    item.acceptable_quality_level,
    item.surveillance_method
  ]);

  switch (format) {
    case 'xlsx': exportToExcel(pwst, fileName); break;
    case 'csv': exportToCSV(pwst, fileName); break;
    case 'pdf': exportToPDF('Performance Work Statement Table (PWST)', headers, data, fileName); break;
    case 'docx': 
      await exportToDocx('Performance Work Statement Table (PWST)', [
        { title: 'Performance Requirements Summary', content: [headers, ...data] }
      ], fileName);
      break;
  }
};
