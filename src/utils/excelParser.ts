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

    // Convert to JSON with formatted values (dates, strings) and raw values (true numbers)
    const rawJson: RawRow[] = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
      raw: false,
      dateNF: 'yyyy-mm-dd'
    });

    const rawVals: RawRow[] = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
      raw: true
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

    // Extract all unique headers from all rows in this sheet while trimming keys
    const headersSet = new Set<string>();
    const cleanedRows: RawRow[] = [];
    let emptyRows = 0;
    let filledCells = 0;

    // First pass: extract all headers
    rawJson.forEach((row) => {
      Object.keys(row).forEach(key => {
        if (!key || key.startsWith('__EMPTY')) return;
        const cleanKey = key.trim();
        if (cleanKey) {
          headersSet.add(cleanKey);
        }
      });
    });

    const headers = Array.from(headersSet);

    // Second pass: construct cleaned rows with trimmed keys, preserving exact numeric floats
    rawJson.forEach((row, rIdx) => {
      const rawRow = rawVals[rIdx] || {};
      const isAllEmpty = Object.values(row).every(
        val => val === null || val === undefined || String(val).trim() === ''
      );

      if (isAllEmpty) {
        emptyRows++;
      } else {
        const cleanedRow: RawRow = {};

        // Build a lookup map of trimmed key -> value from this row
        const rowKeyMap = new Map<string, any>();
        Object.keys(row).forEach(k => {
          if (!k || k.startsWith('__EMPTY')) return;
          rowKeyMap.set(k.trim(), row[k]);
        });

        // Also build lookup from rawRow for preserving numbers
        const rawKeyMap = new Map<string, any>();
        Object.keys(rawRow).forEach(k => {
          if (!k || k.startsWith('__EMPTY')) return;
          rawKeyMap.set(k.trim(), rawRow[k]);
        });

        headers.forEach(h => {
          let val = rowKeyMap.get(h);

          // If raw cell is a real number, preserve the true numeric precision (e.g. 0.94, 1.03)
          const rawVal = rawKeyMap.get(h);
          if (typeof rawVal === 'number' && !isNaN(rawVal)) {
            val = rawVal;
          }

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

    const totalCellsPossible = cleanedRows.length * (headers.length || 1);
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
