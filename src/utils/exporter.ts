import * as XLSX from 'xlsx';
import { ConsolidatedRecord, ConsolidationSummary } from '../types';

export interface ExportExcelOptions {
  ignoreEmptyColumns?: boolean;
}

export function isValueEmptyOrDash(val: any): boolean {
  if (val === undefined || val === null) return true;
  const str = String(val).trim();
  return str === '' || str === '-' || str === '—' || str === '–';
}

export function exportToExcel(
  records: ConsolidatedRecord[],
  summary: ConsolidationSummary,
  customFileName?: string,
  options?: ExportExcelOptions
) {
  const wb = XLSX.utils.book_new();

  // Find all columns across records
  const allKeysSet = new Set<string>();
  records.forEach(rec => {
    Object.keys(rec).forEach(k => {
      if (!k.startsWith('__')) {
        allKeysSet.add(k);
      }
    });
  });
  const allKeys = Array.from(allKeysSet);

  let finalKeys = allKeys;
  let ignoredColsCount = 0;

  if (options?.ignoreEmptyColumns && records.length > 0) {
    finalKeys = allKeys.filter(colKey => {
      // Keep column if at least one row has a non-empty, non-dash value
      return records.some(rec => !isValueEmptyOrDash(rec[colKey]));
    });

    if (finalKeys.length === 0) {
      finalKeys = allKeys;
    } else {
      ignoredColsCount = allKeys.length - finalKeys.length;
    }
  }

  // Clean records for export (only keep finalKeys without internal meta fields)
  const exportableRecords = records.map(rec => {
    const clean: Record<string, any> = {};
    finalKeys.forEach(k => {
      clean[k] = rec[k] !== undefined && rec[k] !== null ? rec[k] : '';
    });
    return clean;
  });

  // 1. Create Main Database Sheet
  const wsMain = XLSX.utils.json_to_sheet(exportableRecords, { header: finalKeys });

  // Auto column widths
  if (exportableRecords.length > 0 && finalKeys.length > 0) {
    const colWidths = finalKeys.map(key => {
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
  const summaryRows: Record<string, any>[] = [
    { "Métrica": "Arquivo de Origem", "Valor": summary.fileName },
    { "Métrica": "Data da Consolidação", "Valor": summary.createdAt },
    { "Métrica": "Total de Esteiras Consolidadas", "Valor": summary.totalEsteiras },
    { "Métrica": "Total de Registros Unificados", "Valor": summary.totalRecords },
    { "Métrica": "Linhas Duplicadas Removidas", "Valor": summary.duplicateRowsRemoved },
    { "Métrica": "Linhas Vazias Descartadas", "Valor": summary.emptyRowsRemoved },
    { "Métrica": "Taxa de Preenchimento das Colunas", "Valor": `${summary.fieldCompletenessRate}%` }
  ];

  if (options?.ignoreEmptyColumns) {
    summaryRows.push({
      "Métrica": "Colunas 100% Sem Valor Descartadas",
      "Valor": `${ignoredColsCount} coluna(s)`
    });
  }

  summaryRows.push(
    { "Métrica": "", "Valor": "" },
    { "Métrica": "--- DISTRIBUIÇÃO POR ESTEIRA ---", "Valor": "" }
  );

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

export function exportToCSV(records: ConsolidatedRecord[], fileName: string, options?: ExportExcelOptions) {
  const allKeysSet = new Set<string>();
  records.forEach(rec => {
    Object.keys(rec).forEach(k => {
      if (!k.startsWith('__')) {
        allKeysSet.add(k);
      }
    });
  });
  let finalKeys = Array.from(allKeysSet);

  if (options?.ignoreEmptyColumns && records.length > 0) {
    const filtered = finalKeys.filter(colKey => {
      return records.some(rec => !isValueEmptyOrDash(rec[colKey]));
    });
    if (filtered.length > 0) finalKeys = filtered;
  }

  const exportableRecords = records.map(rec => {
    const clean: Record<string, any> = {};
    finalKeys.forEach(k => {
      clean[k] = rec[k] !== undefined && rec[k] !== null ? rec[k] : '';
    });
    return clean;
  });

  const ws = XLSX.utils.json_to_sheet(exportableRecords, { header: finalKeys });
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

export function exportToJSON(records: ConsolidatedRecord[], fileName: string, options?: ExportExcelOptions) {
  const allKeysSet = new Set<string>();
  records.forEach(rec => {
    Object.keys(rec).forEach(k => {
      if (!k.startsWith('__')) {
        allKeysSet.add(k);
      }
    });
  });
  let finalKeys = Array.from(allKeysSet);

  if (options?.ignoreEmptyColumns && records.length > 0) {
    const filtered = finalKeys.filter(colKey => {
      return records.some(rec => !isValueEmptyOrDash(rec[colKey]));
    });
    if (filtered.length > 0) finalKeys = filtered;
  }

  const exportableRecords = records.map(rec => {
    const clean: Record<string, any> = {};
    finalKeys.forEach(k => {
      clean[k] = rec[k] !== undefined && rec[k] !== null ? rec[k] : '';
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
