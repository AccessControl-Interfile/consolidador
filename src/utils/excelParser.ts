import * as XLSX from 'xlsx';
import { EsteiraSheet, RawRow } from '../types';

export function parseExcelFile(arrayBuffer: ArrayBuffer, fileName: string): EsteiraSheet[] {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
  const esteiras: EsteiraSheet[] = [];

  workbook.SheetNames.forEach((sheetName, index) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) {
      // Empty sheet
      esteiras.push({
        id: `sheet-${index}-${Date.now()}`,
        name: sheetName,
        rowCount: 0,
        columnCount: 0,
        headers: [],
        rawRows: [],
        selected: false,
        emptyRowCount: 0,
        completenessRate: 0
      });
      return;
    }

    // Convert to JSON with header option
    const rawJson: RawRow[] = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
      raw: false,
      dateNF: 'yyyy-mm-dd'
    });

    if (rawJson.length === 0) {
      esteiras.push({
        id: `sheet-${index}-${Date.now()}`,
        name: sheetName,
        rowCount: 0,
        columnCount: 0,
        headers: [],
        rawRows: [],
        selected: false,
        emptyRowCount: 0,
        completenessRate: 0
      });
      return;
    }

    // Extract all unique headers from all rows in this sheet
    const headersSet = new Set<string>();
    rawJson.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key && !key.startsWith('__EMPTY')) {
          headersSet.add(key.trim());
        }
      });
    });

    const headers = Array.from(headersSet);

    // Calculate empty rows and completeness rate
    let emptyRows = 0;
    let filledCells = 0;
    const totalCellsPossible = rawJson.length * (headers.length || 1);

    const cleanedRows: RawRow[] = [];

    rawJson.forEach(row => {
      const isAllEmpty = Object.values(row).every(val => val === null || val === undefined || String(val).trim() === '');
      if (isAllEmpty) {
        emptyRows++;
      } else {
        const cleanedRow: RawRow = {};
        headers.forEach(h => {
          const val = row[h];
          if (val !== null && val !== undefined && String(val).trim() !== '') {
            filledCells++;
            cleanedRow[h] = val;
          } else {
            cleanedRow[h] = '';
          }
        });
        cleanedRows.push(cleanedRow);
      }
    });

    const completenessRate = totalCellsPossible > 0 
      ? Math.min(100, Math.round((filledCells / totalCellsPossible) * 100))
      : 0;

    esteiras.push({
      id: `sheet-${index}-${Date.now()}`,
      name: sheetName,
      rowCount: cleanedRows.length,
      columnCount: headers.length,
      headers,
      rawRows: cleanedRows,
      selected: true,
      emptyRowCount: emptyRows,
      completenessRate
    });
  });

  return esteiras;
}
