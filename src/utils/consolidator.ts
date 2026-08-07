import {
  ConsolidatedRecord,
  ConsolidationConfig,
  ConsolidationSummary,
  EsteiraSheet,
  GroupedColumnMapping,
  ConsolidationFilterConfig,
  ConsolidationFilterRule
} from '../types';

function evaluateFilterRule(record: ConsolidatedRecord, rule: ConsolidationFilterRule): boolean {
  if (!rule.column) return true;

  const targetValue = rule.value ? rule.value.trim().toLowerCase() : '';

  // Get cell values to inspect
  let cellValues: string[] = [];
  if (rule.column === 'ALL') {
    cellValues = Object.entries(record)
      .filter(([k]) => !k.startsWith('__'))
      .map(([, v]) => (v === null || v === undefined ? '' : String(v).trim()));
  } else {
    const rawVal = record[rule.column];
    cellValues = [rawVal === null || rawVal === undefined ? '' : String(rawVal).trim()];
  }

  const checkSingle = (val: string): boolean => {
    const valLower = val.toLowerCase();

    switch (rule.operator) {
      case 'equals':
        return valLower === targetValue;
      case 'not_equals':
        return valLower !== targetValue;
      case 'contains':
        return valLower.includes(targetValue);
      case 'not_contains':
        return !valLower.includes(targetValue);
      case 'starts_with':
        return valLower.startsWith(targetValue);
      case 'ends_with':
        return valLower.endsWith(targetValue);
      case 'greater_than': {
        const numVal = parseFloat(val.replace(',', '.'));
        const numTarget = parseFloat(targetValue.replace(',', '.'));
        return !isNaN(numVal) && !isNaN(numTarget) && numVal > numTarget;
      }
      case 'less_than': {
        const numVal = parseFloat(val.replace(',', '.'));
        const numTarget = parseFloat(targetValue.replace(',', '.'));
        return !isNaN(numVal) && !isNaN(numTarget) && numVal < numTarget;
      }
      case 'is_empty':
        return val === '' || val === '-';
      case 'is_not_empty':
        return val !== '' && val !== '-';
      default:
        return true;
    }
  };

  if (rule.column === 'ALL') {
    if (rule.operator === 'not_equals' || rule.operator === 'not_contains' || rule.operator === 'is_not_empty') {
      return cellValues.every(checkSingle);
    }
    return cellValues.some(checkSingle);
  }

  return checkSingle(cellValues[0] || '');
}

function passesFilterConfig(record: ConsolidatedRecord, filterConfig?: ConsolidationFilterConfig): boolean {
  if (!filterConfig || !filterConfig.enabled || !filterConfig.rules || filterConfig.rules.length === 0) {
    return true;
  }

  const validRules = filterConfig.rules.filter(
    r => r.column && (r.operator === 'is_empty' || r.operator === 'is_not_empty' || r.value.trim() !== '')
  );
  if (validRules.length === 0) return true;

  if (filterConfig.matchLogic === 'OR') {
    return validRules.some(rule => evaluateFilterRule(record, rule));
  } else {
    return validRules.every(rule => evaluateFilterRule(record, rule));
  }
}

export function formatDateValue(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const day = String(val.getDate()).padStart(2, '0');
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const year = val.getFullYear();
    return `${day}/${month}/${year}`;
  }

  const str = String(val).trim();
  if (!str) return '';

  // Excel serial number format (e.g., 44927 or 44927.60416 with time fraction)
  const numVal = Number(str);
  if (!isNaN(numVal) && numVal > 20000 && numVal < 70000) {
    const serialDate = Math.floor(numVal);
    const dateObj = new Date((serialDate - 25569) * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      const day = String(dateObj.getUTCDate()).padStart(2, '0');
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const year = dateObj.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }
  }

  // Check BR string DD/MM/YYYY or DD/MM/YY (ignoring any subsequent time)
  const brMatch = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (brMatch) {
    let [, d, m, y] = brMatch;
    if (y.length === 2) {
      y = `20${y}`;
    }
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  // Check ISO string YYYY-MM-DD or YYYY/MM/DD (ignoring any subsequent time or T)
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  // If text contains space or T with time (e.g., "12/05/2023 14:30:00")
  const dateOnlyPart = str.split(/[ T]/)[0];
  if (dateOnlyPart && dateOnlyPart !== str) {
    return formatDateValue(dateOnlyPart);
  }

  // Try parsing JS Date
  const parsedDate = new Date(str);
  if (!isNaN(parsedDate.getTime())) {
    const day = String(parsedDate.getDate()).padStart(2, '0');
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const year = parsedDate.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return str;
}

export function parseCurrencyValue(val: any): number | string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') return val;

  let str = String(val).replace(/R\$/gi, '').replace(/\s/g, '').trim();
  // Handle Brazilian formatting e.g. 15.000,50 -> 15000.50
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? val : num;
}

export function consolidateSheets(
  sheets: EsteiraSheet[],
  config: ConsolidationConfig,
  fileName: string
): { records: ConsolidatedRecord[]; summary: ConsolidationSummary } {
  const selectedSheets = sheets.filter(s => s.selected);
  // Filter active mappings to only include non-excluded column groups
  const activeMappings = config.groupMappings.filter(group => {
    if (!group.sourceMappings || group.sourceMappings.length === 0) return true;
    return !group.sourceMappings.every(sm => sm.isIgnored);
  });

  // Build a fast lookup: sheetName + originalHeader -> { targetColumnName, dataType, isIgnored }
  const headerLookup = new Map<string, { targetColumnName: string; dataType: string; isIgnored: boolean }>();

  activeMappings.forEach(group => {
    group.sourceMappings.forEach(sm => {
      const key = `${sm.sheetName}:::${sm.originalHeader}`;
      headerLookup.set(key, {
        targetColumnName: group.targetColumnName,
        dataType: group.dataType,
        isIgnored: sm.isIgnored
      });
    });
  });

  const rawConsolidatedList: ConsolidatedRecord[] = [];
  let emptyRowsCount = 0;

  // Track counts per esteira
  const esteiraCountsMap = new Map<string, number>();
  selectedSheets.forEach(s => esteiraCountsMap.set(s.name, 0));

  let recordIndex = 1;

  selectedSheets.forEach(sheet => {
    sheet.rawRows.forEach((row, rowIdx) => {
      // Check if row is entirely empty
      const isRowEmpty = Object.values(row).every(v => v === null || v === undefined || String(v).trim() === '');
      if (isRowEmpty) {
        emptyRowsCount++;
        if (config.removeEmptyRows) return;
      }

      const esteiraName = sheet.name.toUpperCase();
      const defaultFill = typeof config.fillMissingValue === 'string'
        ? config.fillMissingValue.toUpperCase()
        : (config.fillMissingValue || '');

      const esteiraColName = config.esteiraColumnName || 'Esteira / Origem';

      const consolidatedRow: ConsolidatedRecord = {
        __id: `rec-${recordIndex++}`,
        __esteira: esteiraName,
        __rowNum: rowIdx + 1,
        [esteiraColName]: esteiraName
      };

      // Populate mapped target columns
      activeMappings.forEach(group => {
        consolidatedRow[group.targetColumnName] = defaultFill;
      });

      // Iterate through each header in original row
      Object.entries(row).forEach(([origHeader, origVal]) => {
        const lookupKey = `${sheet.name}:::${origHeader}`;
        const mapping = headerLookup.get(lookupKey);

        if (mapping && !mapping.isIgnored) {
          let processedVal = origVal;

          if (processedVal !== null && processedVal !== undefined) {
            if (config.trimWhitespace && typeof processedVal === 'string') {
              processedVal = processedVal.trim();
            }

            if (mapping.dataType === 'date') {
              processedVal = formatDateValue(processedVal);
            } else if (mapping.dataType === 'currency') {
              processedVal = parseCurrencyValue(processedVal);
            }

            if (typeof processedVal === 'string') {
              processedVal = processedVal.toUpperCase();
            }
          }

          if (processedVal !== null && processedVal !== undefined && String(processedVal).trim() !== '') {
            consolidatedRow[mapping.targetColumnName] = processedVal;
          }
        }
      });

      // Filter step: verify if record satisfies Stage 4 custom filters
      if (!passesFilterConfig(consolidatedRow, config.filterConfig)) {
        return;
      }

      rawConsolidatedList.push(consolidatedRow);
      esteiraCountsMap.set(sheet.name, (esteiraCountsMap.get(sheet.name) || 0) + 1);
    });
  });

  // Deduplication step
  let finalRecords: ConsolidatedRecord[] = [];
  let duplicateCount = 0;

  if (config.deduplicate && config.dedupeKey) {
    const seenKeys = new Set<string>();

    rawConsolidatedList.forEach(rec => {
      let dedupeVal = '';

      if (config.dedupeKey === 'ALL') {
        const keyObj = { ...rec };
        delete keyObj.__id;
        delete keyObj.__rowNum;
        dedupeVal = JSON.stringify(keyObj);
      } else {
        const rawVal = rec[config.dedupeKey];
        dedupeVal = rawVal ? String(rawVal).trim().toLowerCase() : '';
      }

      if (dedupeVal && seenKeys.has(dedupeVal)) {
        duplicateCount++;
      } else {
        if (dedupeVal) seenKeys.add(dedupeVal);
        finalRecords.push(rec);
      }
    });
  } else {
    finalRecords = rawConsolidatedList;
  }

  // Color palette for charts
  const palette = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#6366F1'];

  const recordsPerEsteira = Array.from(esteiraCountsMap.entries()).map(([esteira, count], i) => ({
    esteira,
    count,
    color: palette[i % palette.length]
  }));

  // Field completeness calculation across final records
  const targetColNames = activeMappings.map(g => g.targetColumnName);
  let totalFieldSlots = finalRecords.length * targetColNames.length;
  let filledSlots = 0;

  finalRecords.forEach(rec => {
    targetColNames.forEach(col => {
      const v = rec[col];
      if (v !== null && v !== undefined && String(v).trim() !== '' && v !== config.fillMissingValue) {
        filledSlots++;
      }
    });
  });

  const completeness = totalFieldSlots > 0 ? Math.round((filledSlots / totalFieldSlots) * 100) : 0;

  const summary: ConsolidationSummary = {
    totalRecords: finalRecords.length,
    totalEsteiras: selectedSheets.length,
    duplicateRowsRemoved: duplicateCount,
    emptyRowsRemoved: emptyRowsCount,
    unifiedColumnsCount: targetColNames.length + 1, // including Esteira metadata
    recordsPerEsteira,
    fieldCompletenessRate: completeness,
    createdAt: new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    fileName
  };

  return { records: finalRecords, summary };
}
