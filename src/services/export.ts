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
