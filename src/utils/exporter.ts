import * as XLSX from 'xlsx';
import { ConsolidatedRecord, ConsolidationSummary } from '../types';

export function exportToExcel(
  records: ConsolidatedRecord[],
  summary: ConsolidationSummary,
  customFileName?: string
) {
  const wb = XLSX.utils.book_new();

  // Clean records for export (remove internal __id and __rowNum)
  const exportableRecords = records.map(rec => {
    const clean: Record<string, any> = {};
    Object.keys(rec).forEach(k => {
      if (!k.startsWith('__')) {
        clean[k] = rec[k];
      }
    });
    return clean;
  });

  // 1. Create Main Database Sheet
  const wsMain = XLSX.utils.json_to_sheet(exportableRecords);

  // Auto column widths
  if (exportableRecords.length > 0) {
    const keys = Object.keys(exportableRecords[0]);
    const colWidths = keys.map(key => {
      let maxLen = key.length;
      exportableRecords.forEach(row => {
        const valStr = row[key] !== undefined && row[key] !== null ? String(row[key]) : '';
        if (valStr.length > maxLen) {
          maxLen = Math.min(valStr.length, 50); // cap max length
        }
      });
      return { wch: Math.max(maxLen + 4, 12) };
    });
    wsMain['!cols'] = colWidths;
  }

  XLSX.utils.book_append_sheet(wb, wsMain, 'Base Principal');

  // 2. Create Summary Sheet
  const summaryRows = [
    { "Métrica": "Arquivo de Origem", "Valor": summary.fileName },
    { "Métrica": "Data da Consolidação", "Valor": summary.createdAt },
    { "Métrica": "Total de Esteiras Consolidadas", "Valor": summary.totalEsteiras },
    { "Métrica": "Total de Registros Unificados", "Valor": summary.totalRecords },
    { "Métrica": "Linhas Duplicadas Removidas", "Valor": summary.duplicateRowsRemoved },
    { "Métrica": "Linhas Vazias Descartadas", "Valor": summary.emptyRowsRemoved },
    { "Métrica": "Taxa de Preenchimento das Colunas", "Valor": `${summary.fieldCompletenessRate}%` },
    { "Métrica": "", "Valor": "" },
    { "Métrica": "--- DISTRIBUIÇÃO POR ESTEIRA ---", "Valor": "" }
  ];

  summary.recordsPerEsteira.forEach(item => {
    summaryRows.push({
      "Métrica": `Esteira: ${item.esteira}`,
      "Valor": `${item.count} registros`
    });
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 30 }];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo Estatístico');

  // Trigger File Download
  const filename = customFileName || `Base_Consolidada_${summary.fileName.replace(/\.[^/.]+$/, '')}_${Date.now()}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportToCSV(records: ConsolidatedRecord[], fileName: string) {
  const exportableRecords = records.map(rec => {
    const clean: Record<string, any> = {};
    Object.keys(rec).forEach(k => {
      if (!k.startsWith('__')) {
        clean[k] = rec[k];
      }
    });
    return clean;
  });

  const ws = XLSX.utils.json_to_sheet(exportableRecords);
  const csvOutput = XLSX.utils.sheet_to_csv(ws);

  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${fileName.replace(/\.[^/.]+$/, '')}_consolidado.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToJSON(records: ConsolidatedRecord[], fileName: string) {
  const exportableRecords = records.map(rec => {
    const clean: Record<string, any> = {};
    Object.keys(rec).forEach(k => {
      if (!k.startsWith('__')) {
        clean[k] = rec[k];
      }
    });
    return clean;
  });

  const jsonStr = JSON.stringify(exportableRecords, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${fileName.replace(/\.[^/.]+$/, '')}_consolidado.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
