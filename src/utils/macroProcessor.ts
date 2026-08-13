import { ConsolidatedRecord, ColumnMergeRule, ConditionalReplaceRule, ConditionClause } from '../types';

export const applyMergeRules = (records: ConsolidatedRecord[], rules: ColumnMergeRule[]): ConsolidatedRecord[] => {
  let updatedRecords = records.map(rec => ({ ...rec }));

  rules.forEach(rule => {
    const targetCol = rule.newColumnName;
    updatedRecords = updatedRecords.map(rec => {
      const copy = { ...rec };
      let mergedVal: any = '-';

      for (const col of rule.sourceColumns) {
        const val = rec[col];
        if (val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '-') {
          mergedVal = typeof val === 'string' ? val.toUpperCase() : val;
          break;
        }
      }

      copy[targetCol] = mergedVal;

      if (rule.removeOriginals) {
        rule.sourceColumns.forEach(col => {
          if (col !== targetCol) {
            delete copy[col];
          }
        });
      }

      return copy;
    });
  });

  return updatedRecords;
};

export const applyConditionalReplaceRules = (records: ConsolidatedRecord[], rules: ConditionalReplaceRule[]): ConsolidatedRecord[] => {
  return records.map(rec => {
    const newRec = { ...rec };

    rules.forEach(rule => {
      const clauses: ConditionClause[] = rule.conditions && rule.conditions.length > 0
        ? rule.conditions
        : (rule.conditionColumn ? [{
            id: 'legacy-1',
            conditionColumn: rule.conditionColumn,
            operator: rule.operator || 'equals',
            conditionValue: rule.conditionValue || ''
          }] : []);

      if (clauses.length === 0) return;

      const isOr = rule.matchLogic === 'OR';

      const clauseResults = clauses.map(clause => {
        const condValRaw = newRec[clause.conditionColumn];
        const condValStr = condValRaw !== undefined && condValRaw !== null ? String(condValRaw).trim() : '';
        const targetCondVal = (clause.conditionValue || '').trim();

        switch (clause.operator) {
          case 'equals':
            return condValStr.toLowerCase() === targetCondVal.toLowerCase();
          case 'not_equals':
            return condValStr.toLowerCase() !== targetCondVal.toLowerCase();
          case 'contains':
            return condValStr.toLowerCase().includes(targetCondVal.toLowerCase());
          case 'starts_with':
            return condValStr.toLowerCase().startsWith(targetCondVal.toLowerCase());
          case 'ends_with':
            return condValStr.toLowerCase().endsWith(targetCondVal.toLowerCase());
          case 'is_empty':
            return condValStr === '' || condValStr === '-';
          case 'is_not_empty':
            return condValStr !== '' && condValStr !== '-';
          case 'anything':
            return true;
          default:
            return false;
        }
      });

      const isMatch = isOr ? clauseResults.some(r => r) : clauseResults.every(r => r);

      if (isMatch) {
        const targetColsToReplace = [rule.targetColumn];

        targetColsToReplace.forEach(col => {
          if (!col) return;
          const currentVal = newRec[col];
          const currentValStr = currentVal !== undefined && currentVal !== null ? String(currentVal) : '';
          
          let newValToSet = '';
          if (rule.replaceType === 'column') {
            const srcVal = newRec[rule.newValue || ''];
            newValToSet = srcVal !== undefined && srcVal !== null ? String(srcVal).toUpperCase() : '-';
          } else {
            newValToSet = (rule.newValue || '').toUpperCase();
          }

          if (currentValStr !== newValToSet) {
            newRec[col] = newValToSet;
          }
        });
      }
    });

    return newRec;
  });
};
