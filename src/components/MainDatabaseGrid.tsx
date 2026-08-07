import React, { useState, useMemo, useEffect } from 'react';
import { ConsolidatedRecord, ConsolidationSummary, ColumnMergePreset, ColumnMergeRule, GroupingPreset, ConditionalReplaceRule, ConditionalReplacePreset, ReplaceConditionOperator, ConditionClause } from '../types';
import {
  Download, ArrowUpDown, ChevronLeft, ChevronRight,
  Eye, Edit3, Trash2, Plus, FileSpreadsheet, Check, X,
  SlidersHorizontal, Layers, Merge, Save, BookmarkPlus, Edit, FolderOpen, RotateCcw, Replace, Database, UploadCloud, Filter, Search
} from 'lucide-react';
import { exportToExcel } from '../utils/exporter';
import { SupabaseModal } from './SupabaseModal';
import { saveToFirebase, loadFromFirebase } from '../lib/firebase';

interface MainDatabaseGridProps {
  records: ConsolidatedRecord[];
  summary: ConsolidationSummary;
  onUpdateRecord: (updatedRecord: ConsolidatedRecord) => void;
  onDeleteRecord: (id: string) => void;
  onAddRecord: (newRecord: ConsolidatedRecord) => void;
  onBulkUpdateRecords: (updatedRecords: ConsolidatedRecord[]) => void;
  onResetAll: () => void;
}

const MERGE_STORAGE_KEY = 'esteiras_merge_presets';
const GROUPING_STORAGE_KEY = 'esteiras_grouping_presets';
const CONDITIONAL_REPLACE_STORAGE_KEY = 'esteiras_conditional_replace_presets';

export const MainDatabaseGrid: React.FC<MainDatabaseGridProps> = ({
  records,
  summary,
  onUpdateRecord,
  onDeleteRecord,
  onAddRecord,
  onBulkUpdateRecords,
  onResetAll
}) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Column Filter state (Excel-like)
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [pendingFilterSelections, setPendingFilterSelections] = useState<Set<string>>(new Set());

  // Pagination state (default 20 records for performance)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Cell editing state
  const [editingCell, setEditingCell] = useState<{ recordId: string; colName: string } | null>(null);
  const [cellValue, setCellValue] = useState('');

  // Selected Row for Modal View
  const [detailRecord, setDetailRecord] = useState<ConsolidatedRecord | null>(null);

  // Column Visibility toggle state
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColumnToggleMenu, setShowColumnToggleMenu] = useState(false);

  // Multi-Rule Merge Columns Configuration state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergePresets, setMergePresets] = useState<ColumnMergePreset[]>([]);
  const [selectedMergePresetId, setSelectedMergePresetId] = useState<string>('');
  const [mergeRules, setMergeRules] = useState<ColumnMergeRule[]>([]);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Form state for single rule inside draft
  const [newColumnName, setNewColumnName] = useState<string>('');
  const [selectedSourceCols, setSelectedSourceCols] = useState<string[]>([]);
  const [removeOriginals, setRemoveOriginals] = useState<boolean>(false);
  const [presetSaveName, setPresetSaveName] = useState<string>('');

  // Grouping State
  const [showGroupingModal, setShowGroupingModal] = useState(false);
  const [groupingPresets, setGroupingPresets] = useState<GroupingPreset[]>([]);
  const [selectedGroupingPresetId, setSelectedGroupingPresetId] = useState<string>('');
  const [draftGroupColumns, setDraftGroupColumns] = useState<string[]>([]);
  const [groupingSaveName, setGroupingSaveName] = useState<string>('');
  const [activeGroupColumns, setActiveGroupColumns] = useState<string[]>([]);
  const [splitByCommaInGrouping, setSplitByCommaInGrouping] = useState<boolean>(true);

  // Supabase Upload Modal State
  const [showSupabaseModal, setShowSupabaseModal] = useState<boolean>(false);

  // Conditional Replace State
  const [showConditionalModal, setShowConditionalModal] = useState(false);
  const [conditionalPresets, setConditionalPresets] = useState<ConditionalReplacePreset[]>([]);
  const [selectedConditionalPresetId, setSelectedConditionalPresetId] = useState<string>('');
  const [conditionalRules, setConditionalRules] = useState<ConditionalReplaceRule[]>([]);

  // Conditional Replace Form Draft
  const [draftTargetCol, setDraftTargetCol] = useState<string>('');
  const [draftConditions, setDraftConditions] = useState<ConditionClause[]>([
    { id: 'cond-1', conditionColumn: '', operator: 'equals', conditionValue: '' }
  ]);
  const [draftMatchLogic, setDraftMatchLogic] = useState<'AND' | 'OR'>('AND');
  const [draftReplaceType, setDraftReplaceType] = useState<'fixed' | 'column'>('fixed');
  const [draftNewVal, setDraftNewVal] = useState<string>('');
  const [conditionalSaveName, setConditionalSaveName] = useState<string>('');

  const handleAddConditionClause = () => {
    setDraftConditions(prev => [
      ...prev,
      { id: `cond-${Date.now()}-${prev.length + 1}`, conditionColumn: '', operator: 'equals', conditionValue: '' }
    ]);
  };

  const handleRemoveConditionClause = (id: string) => {
    if (draftConditions.length <= 1) return;
    setDraftConditions(prev => prev.filter(c => c.id !== id));
  };

  const handleUpdateConditionClause = (id: string, field: keyof ConditionClause, value: any) => {
    setDraftConditions(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  // Load saved merge, grouping & conditional presets from Firebase
  useEffect(() => {
    const loadAllPresets = async () => {
      try {
        const savedMerge = await loadFromFirebase<ColumnMergePreset[]>(MERGE_STORAGE_KEY);
        if (savedMerge && Array.isArray(savedMerge)) {
          setMergePresets(savedMerge);
        }
        const savedGrouping = await loadFromFirebase<GroupingPreset[]>(GROUPING_STORAGE_KEY);
        if (savedGrouping && Array.isArray(savedGrouping)) {
          setGroupingPresets(savedGrouping);
        }
        const savedConditional = await loadFromFirebase<ConditionalReplacePreset[]>(CONDITIONAL_REPLACE_STORAGE_KEY);
        if (savedConditional && Array.isArray(savedConditional)) {
          setConditionalPresets(savedConditional);
        }
      } catch (e) {
        console.error('Failed to load presets from Firebase', e);
      }
    };
    loadAllPresets();
  }, []);

  // Extract raw column keys from base records
  const allRawColumns = useMemo(() => {
    if (records.length === 0) return [];
    const keys = Object.keys(records[0]).filter(k => !k.startsWith('__'));
    return keys;
  }, [records]);

  // 1. Filter base records by active column filters
  const filteredBaseRecords = useMemo(() => {
    const activeFilters = (Object.entries(columnFilters) as [string, Set<string>][]).filter(([_, allowedValues]) => allowedValues.size > 0);
    if (activeFilters.length === 0) return records;

    return records.filter(rec => {
      return activeFilters.every(([col, allowedValues]) => {
        const val = rec[col];
        const strVal = val === null || val === undefined ? '' : String(val);
        return allowedValues.has(strVal);
      });
    });
  }, [records, columnFilters]);

  // 2. Computed Grouped Records (Power Query style with optional comma splitting)
  const displayRecords = useMemo(() => {
    if (activeGroupColumns.length === 0) {
      return filteredBaseRecords;
    }

    const groupMap = new Map<string, { comboValues: string[]; count: number }>();

    filteredBaseRecords.forEach(rec => {
      // Get array of string values for each grouped column
      const colOptions: string[][] = activeGroupColumns.map(col => {
        const raw = rec[col];
        const valStr = raw !== undefined && raw !== null ? String(raw).trim() : '';
        if (splitByCommaInGrouping && valStr.includes(',')) {
          const parts = valStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
          return parts.length > 0 ? parts : ['-'];
        }
        return [valStr || '-'];
      });

      // Cartesian product of column options
      const cartesian = (arrays: string[][]): string[][] => {
        return arrays.reduce<string[][]>(
          (acc, curr) => acc.flatMap(d => curr.map(e => [...d, e])),
          [[]]
        );
      };

      const combinations = cartesian(colOptions);

      combinations.forEach(combo => {
        const groupKey = combo.map(k => k.toLowerCase()).join(':::');

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, { comboValues: combo, count: 1 });
        } else {
          groupMap.get(groupKey)!.count += 1;
        }
      });
    });

    const result: ConsolidatedRecord[] = [];
    let idx = 1;

    groupMap.forEach(({ comboValues, count }) => {
      const groupedRec: ConsolidatedRecord = {
        __id: `grouped-${idx}`,
        __esteira: 'Visão Agrupada',
        __rowNum: idx,
        'Quantidade': count
      };

      activeGroupColumns.forEach((col, colIdx) => {
        groupedRec[col] = comboValues[colIdx] || '-';
      });

      result.push(groupedRec);
      idx++;
    });

    return result;
  }, [records, activeGroupColumns, splitByCommaInGrouping]);

  // Active columns to display in table
  const allColumns = useMemo(() => {
    if (activeGroupColumns.length > 0) {
      return [...activeGroupColumns, 'Quantidade'];
    }
    return allRawColumns;
  }, [allRawColumns, activeGroupColumns]);

  const visibleColumns = useMemo(() => {
    return allColumns.filter(c => !hiddenColumns.has(c));
  }, [allColumns, hiddenColumns]);

  // Sorting (optimized to skip sorting if sortColumn is null)
  const sortedRecords = useMemo(() => {
    if (!sortColumn) return displayRecords;

    return [...displayRecords].sort((a, b) => {
      const valA = a[sortColumn];
      const valB = b[sortColumn];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      return sortDirection === 'asc'
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  }, [displayRecords, sortColumn, sortDirection]);

  // Pagination calculation
  const totalPages = Math.ceil(sortedRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  // Extract unique values for a specific column (used by column filters)
  const getUniqueValuesForColumn = (col: string) => {
    // Get unique string values from the UNFILTERED base records
    const unique = new Set<string>();
    records.forEach(rec => {
      const val = rec[col];
      const strVal = val === null || val === undefined ? '' : String(val);
      unique.add(strVal);
    });
    const sorted = Array.from(unique).sort((a, b) => a.localeCompare(b));
    return sorted;
  };

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const handleStartEditCell = (rec: ConsolidatedRecord, colName: string) => {
    setEditingCell({ recordId: rec.__id, colName });
    setCellValue(rec[colName] !== undefined && rec[colName] !== null ? String(rec[colName]) : '');
  };

  const handleSaveEditCell = (rec: ConsolidatedRecord) => {
    if (!editingCell) return;
    const finalVal = typeof cellValue === 'string' ? cellValue.toUpperCase() : cellValue;
    const updated = {
      ...rec,
      [editingCell.colName]: finalVal
    };
    onUpdateRecord(updated);
    setEditingCell(null);
  };

  const handleToggleColumnHide = (col: string) => {
    const next = new Set(hiddenColumns);
    if (next.has(col)) {
      next.delete(col);
    } else {
      next.add(col);
    }
    setHiddenColumns(next);
  };

  const handleToggleSelectMergeCol = (col: string) => {
    if (selectedSourceCols.includes(col)) {
      setSelectedSourceCols(selectedSourceCols.filter(c => c !== col));
    } else {
      setSelectedSourceCols([...selectedSourceCols, col]);
    }
  };

  // Rule management within current draft
  const handleAddOrUpdateRule = () => {
    if (!newColumnName.trim()) {
      alert('Digite o nome da nova coluna para a regra.');
      return;
    }
    if (selectedSourceCols.length < 2) {
      alert('Selecione pelo menos 2 colunas para unificar nesta regra.');
      return;
    }

    if (editingRuleId) {
      // Update existing rule
      setMergeRules(prev => prev.map(r => r.id === editingRuleId ? {
        ...r,
        newColumnName: newColumnName.trim(),
        sourceColumns: [...selectedSourceCols],
        removeOriginals
      } : r));
      setEditingRuleId(null);
    } else {
      // Add new rule
      const newRule: ColumnMergeRule = {
        id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        newColumnName: newColumnName.trim(),
        sourceColumns: [...selectedSourceCols],
        removeOriginals
      };
      setMergeRules(prev => [...prev, newRule]);
    }

    // Reset rule form
    setNewColumnName('');
    setSelectedSourceCols([]);
    setRemoveOriginals(false);
  };

  const handleEditRule = (rule: ColumnMergeRule) => {
    setEditingRuleId(rule.id);
    setNewColumnName(rule.newColumnName);
    setSelectedSourceCols([...rule.sourceColumns]);
    setRemoveOriginals(!!rule.removeOriginals);
  };

  const handleDeleteRule = (ruleId: string) => {
    setMergeRules(prev => prev.filter(r => r.id !== ruleId));
    if (editingRuleId === ruleId) {
      setEditingRuleId(null);
      setNewColumnName('');
      setSelectedSourceCols([]);
      setRemoveOriginals(false);
    }
  };

  const handleSaveMergePreset = () => {
    if (!presetSaveName.trim()) {
      alert('Digite um nome para identificar esta configuração com múltiplas unificações.');
      return;
    }
    if (mergeRules.length === 0) {
      alert('Adicione ao menos uma regra de unificação à configuração antes de salvar.');
      return;
    }

    const newPreset: ColumnMergePreset = {
      id: `merge-${Date.now()}`,
      name: presetSaveName.trim(),
      rules: [...mergeRules]
    };

    const updatedPresets = [...mergePresets, newPreset];
    setMergePresets(updatedPresets);
    saveToFirebase(MERGE_STORAGE_KEY, updatedPresets);
    setSelectedMergePresetId(newPreset.id);
    setPresetSaveName('');
    alert(`Configuração "${newPreset.name}" salva com sucesso contendo ${newPreset.rules.length} unificações de colunas!`);
  };

  const handleApplyMergePreset = (presetId: string) => {
    setSelectedMergePresetId(presetId);
    if (!presetId) return;
    const preset = mergePresets.find(p => p.id === presetId);
    if (!preset) return;

    setMergeRules([...preset.rules]);
    setEditingRuleId(null);
    setNewColumnName('');
    setSelectedSourceCols([]);
    setRemoveOriginals(false);
  };

  const handleDeleteMergePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = mergePresets.filter(p => p.id !== id);
    setMergePresets(updated);
    saveToFirebase(MERGE_STORAGE_KEY, updated);
    if (selectedMergePresetId === id) {
      setSelectedMergePresetId('');
      setMergeRules([]);
    }
  };

  const handleExecuteColumnMerge = () => {
    if (mergeRules.length === 0) {
      alert('Nenhuma regra de unificação foi configurada.');
      return;
    }

    let updatedRecords = records.map(rec => ({ ...rec }));

    mergeRules.forEach(rule => {
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

    onBulkUpdateRecords(updatedRecords);
    setShowMergeModal(false);
    setMergeRules([]);
    setSelectedSourceCols([]);
    setNewColumnName('');
    alert(`Sucesso! Foram aplicadas ${mergeRules.length} regras de unificação na base consolidada.`);
  };

  // Grouping handlers
  const handleToggleDraftGroupCol = (col: string) => {
    setDraftGroupColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleSaveGroupingPreset = () => {
    if (!groupingSaveName.trim()) {
      alert('Digite um nome para identificar e salvar este agrupamento.');
      return;
    }
    if (draftGroupColumns.length === 0) {
      alert('Selecione ao menos 1 coluna para agrupar.');
      return;
    }

    const newPreset: GroupingPreset = {
      id: `grouping-${Date.now()}`,
      name: groupingSaveName.trim(),
      groupColumns: [...draftGroupColumns]
    };

    const updatedPresets = [...groupingPresets, newPreset];
    setGroupingPresets(updatedPresets);
    saveToFirebase(GROUPING_STORAGE_KEY, updatedPresets);
    setSelectedGroupingPresetId(newPreset.id);
    setGroupingSaveName('');
    alert(`Configuração de agrupamento "${newPreset.name}" salva com sucesso!`);
  };

  const handleApplyGrouping = (colsToApply?: string[]) => {
    const cols = colsToApply || draftGroupColumns;
    if (cols.length === 0) {
      alert('Selecione ao menos uma coluna para realizar o agrupamento.');
      return;
    }
    setActiveGroupColumns([...cols]);
    setShowGroupingModal(false);
    setCurrentPage(1);
  };

  const handleClearGrouping = () => {
    setActiveGroupColumns([]);
    setDraftGroupColumns([]);
    setSelectedGroupingPresetId('');
    setCurrentPage(1);
  };

  const handleLoadGroupingPreset = (presetId: string) => {
    setSelectedGroupingPresetId(presetId);
    if (!presetId) return;
    const preset = groupingPresets.find(p => p.id === presetId);
    if (!preset) return;

    setDraftGroupColumns([...preset.groupColumns]);
    setActiveGroupColumns([...preset.groupColumns]);
    setShowGroupingModal(false);
    setCurrentPage(1);
  };

  const handleDeleteGroupingPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = groupingPresets.filter(p => p.id !== id);
    setGroupingPresets(updated);
    saveToFirebase(GROUPING_STORAGE_KEY, updated);
    if (selectedGroupingPresetId === id) {
      setSelectedGroupingPresetId('');
    }
  };

  // Conditional Replacement Handlers
  const handleAddConditionalRule = () => {
    if (!draftTargetCol) {
      alert('Selecione a coluna que terá os valores alterados (coluna alvo).');
      return;
    }
    if (draftConditions.length === 0) {
      alert('Adicione ao menos 1 condição para a regra.');
      return;
    }

    for (let i = 0; i < draftConditions.length; i++) {
      const cond = draftConditions[i];
      if (!cond.conditionColumn) {
        alert(`Selecione a coluna da Condição ${i + 1}.`);
        return;
      }
      if (['equals', 'contains', 'starts_with', 'ends_with'].includes(cond.operator) && !cond.conditionValue.trim()) {
        alert(`Informe o valor de comparação na Condição ${i + 1} (${cond.conditionColumn}).`);
        return;
      }
    }

    if (!draftNewVal.trim()) {
      alert(draftReplaceType === 'fixed' ? 'Informe o valor fixo substituto.' : 'Selecione a coluna de origem do novo valor.');
      return;
    }

    const newRule: ConditionalReplaceRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      targetColumn: draftTargetCol,
      conditions: draftConditions.map(c => ({
        ...c,
        conditionValue: c.conditionValue.trim()
      })),
      matchLogic: draftMatchLogic,
      replaceType: draftReplaceType,
      newValue: draftNewVal.trim()
    };

    setConditionalRules(prev => [...prev, newRule]);
    
    // Reset condition clauses draft
    setDraftConditions([
      { id: `cond-${Date.now()}`, conditionColumn: '', operator: 'equals', conditionValue: '' }
    ]);
    setDraftNewVal('');
  };

  const handleRemoveConditionalRule = (ruleId: string) => {
    setConditionalRules(prev => prev.filter(r => r.id !== ruleId));
  };

  const handleSaveConditionalPreset = () => {
    if (!conditionalSaveName.trim()) {
      alert('Digite um nome para identificar e salvar esta configuração de substituição.');
      return;
    }
    if (conditionalRules.length === 0) {
      alert('Adicione ao menos 1 regra de substituição antes de salvar.');
      return;
    }

    const newPreset: ConditionalReplacePreset = {
      id: `cond-preset-${Date.now()}`,
      name: conditionalSaveName.trim(),
      rules: [...conditionalRules]
    };

    const updatedPresets = [...conditionalPresets, newPreset];
    setConditionalPresets(updatedPresets);
    saveToFirebase(CONDITIONAL_REPLACE_STORAGE_KEY, updatedPresets);
    setSelectedConditionalPresetId(newPreset.id);
    setConditionalSaveName('');
    alert(`Configuração de substituição condicional "${newPreset.name}" salva com sucesso!`);
  };

  const handleLoadConditionalPreset = (presetId: string) => {
    setSelectedConditionalPresetId(presetId);
    if (!presetId) return;
    const preset = conditionalPresets.find(p => p.id === presetId);
    if (!preset) return;

    setConditionalRules([...preset.rules]);
  };

  const handleDeleteConditionalPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = conditionalPresets.filter(p => p.id !== id);
    setConditionalPresets(updated);
    saveToFirebase(CONDITIONAL_REPLACE_STORAGE_KEY, updated);
    if (selectedConditionalPresetId === id) {
      setSelectedConditionalPresetId('');
    }
  };

  const handleApplyConditionalReplace = () => {
    if (conditionalRules.length === 0) {
      alert('Adicione ao menos uma regra para realizar a substituição.');
      return;
    }

    let totalReplacements = 0;
    let affectedRecords = 0;

    const updatedRecords = records.map(rec => {
      let recModified = false;
      const newRec = { ...rec };

      conditionalRules.forEach(rule => {
        // Resolve conditions list (supporting legacy rules if loaded)
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

        const isMatch = isOr
          ? clauseResults.some(res => res)
          : clauseResults.every(res => res);

        if (isMatch) {
          let replacement = '';
          if (rule.replaceType === 'fixed') {
            replacement = (rule.newValue || '').toUpperCase();
          } else {
            const srcVal = newRec[rule.newValue];
            replacement = srcVal !== undefined && srcVal !== null ? String(srcVal).toUpperCase() : '-';
          }

          if (newRec[rule.targetColumn] !== replacement) {
            newRec[rule.targetColumn] = replacement;
            totalReplacements++;
            recModified = true;
          }
        }
      });

      if (recModified) affectedRecords++;
      return newRec;
    });

    onBulkUpdateRecords(updatedRecords);
    setShowConditionalModal(false);
    alert(`Substituição condicional realizada com sucesso!\n\n• Regras aplicadas: ${conditionalRules.length}\n• Registros afetados: ${affectedRecords}\n• Células modificadas: ${totalReplacements}`);
  };

  const handleAddNewBlankRecord = () => {
    if (records.length === 0) return;
    const firstEsteira = records[0]?.__esteira || 'Esteira Manual';
    const newRec: ConsolidatedRecord = {
      __id: `rec-manual-${Date.now()}`,
      __esteira: firstEsteira,
      __rowNum: records.length + 1,
      'Esteira / Origem': firstEsteira
    };

    allColumns.forEach(col => {
      if (!newRec[col]) newRec[col] = '-';
    });

    onAddRecord(newRec);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-12">
      
      {/* Table Control Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Column Visibility Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowColumnToggleMenu(!showColumnToggleMenu)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-sm transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Exibir Colunas ({visibleColumns.length}/{allColumns.length})</span>
            </button>

            {showColumnToggleMenu && (
              <div className="absolute left-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-3 text-xs max-h-64 overflow-y-auto">
                <div className="font-bold text-slate-800 mb-2 pb-1 border-b border-slate-100 flex items-center justify-between">
                  <span>Exibir/Ocultar Colunas</span>
                  <button
                    onClick={() => setHiddenColumns(new Set())}
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    Exibir Todas
                  </button>
                </div>
                {allColumns.map((col, idx) => (
                  <label key={idx} className="flex items-center gap-2 py-1.5 hover:bg-slate-50 rounded px-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!hiddenColumns.has(col)}
                      onChange={() => handleToggleColumnHide(col)}
                      className="w-3.5 h-3.5 text-blue-600 rounded"
                    />
                    <span className="truncate text-slate-700">{col}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Merge / Unify Columns Button */}
          <button
            onClick={() => setShowMergeModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20"
            title="Configurar unificação a posteriori de colunas da base"
          >
            <Merge className="w-3.5 h-3.5 text-indigo-200" />
            <span>Unificação de Colunas</span>
          </button>

          {/* Groupings Button */}
          <button
            onClick={() => setShowGroupingModal(true)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all shadow-md ${
              activeGroupColumns.length > 0
                ? 'bg-purple-700 text-white shadow-purple-700/20 ring-2 ring-purple-300'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20'
            }`}
            title="Agrupar base consolidada por colunas específicas e gerar contagem 'Quantidade'"
          >
            <Layers className="w-3.5 h-3.5 text-purple-200" />
            <span>
              {activeGroupColumns.length > 0
                ? `Agrupamento Ativo (${activeGroupColumns.length})`
                : 'Agrupamentos'}
            </span>
          </button>

          {/* Conditional Value Replacement Button */}
          <button
            onClick={() => setShowConditionalModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-600/20"
            title="Substituir valores de uma coluna de acordo com o valor de outra coluna"
          >
            <Replace className="w-3.5 h-3.5 text-amber-200" />
            <span>Substituição Condicional</span>
          </button>

        </div>

        {/* Action Buttons: Export Excel & Supabase */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          
          {/* Supabase Button */}
          <button
            onClick={() => setShowSupabaseModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-700/20"
            title="Sincronizar a tabela agrupada ou consolidada diretamente com o Supabase"
          >
            <Database className="w-4 h-4 text-emerald-300" />
            <span>Subir no Supabase</span>
          </button>

          {/* Direct Export to Excel */}
          {activeGroupColumns.length > 0 && (
            <button
              onClick={() => exportToExcel(sortedRecords, summary, `Base_Agrupada_${Date.now()}.xlsx`)}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-600/20"
              title="Exportar visão agrupada em formato Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Baixar Excel Agrupado</span>
            </button>
          )}
          <button
            onClick={() => exportToExcel(activeGroupColumns.length === 0 ? sortedRecords : filteredBaseRecords, summary, `Base_Consolidada_${Date.now()}.xlsx`)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-600/20"
            title="Exportar dados da base (com filtros aplicados) em formato Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Baixar Excel da Base</span>
          </button>

        </div>

      </div>

      {/* Active Grouping Banner */}
      {activeGroupColumns.length > 0 && (
        <div className="bg-purple-50 p-3 px-5 border-b border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-purple-950 font-bold">
            <Layers className="w-4 h-4 text-purple-600 shrink-0" />
            <span>Visão Agrupada por:</span>
            <div className="flex flex-wrap gap-1">
              {activeGroupColumns.map((col, idx) => (
                <span key={idx} className="bg-purple-200 text-purple-900 px-2.5 py-0.5 rounded-md font-mono text-[11px] border border-purple-300">
                  {col}
                </span>
              ))}
              {splitByCommaInGrouping && (
                <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md font-bold text-[11px] border border-emerald-300">
                  Separando valores por vírgula
                </span>
              )}
            </div>
            <span className="text-purple-700 font-semibold text-[11px] ml-1">
              ({displayRecords.length} grupos • Coluna "Quantidade" gerada)
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowSupabaseModal(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
            >
              <UploadCloud className="w-3.5 h-3.5 text-emerald-200" />
              <span>Subir Agrupamento no Supabase</span>
            </button>

            <button
              onClick={handleClearGrouping}
              className="px-3.5 py-1.5 bg-white hover:bg-purple-100 text-purple-900 font-bold border border-purple-300 rounded-xl text-xs transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5 text-purple-700" />
              <span>Restaurar Base Detalhada</span>
            </button>
          </div>
        </div>
      )}


      {/* Column Merge Config Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/30 text-indigo-200 flex items-center justify-center">
                  <Merge className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Configuração de Unificação de Colunas</h3>
                  <p className="text-xs text-indigo-200">Defina o nome da nova coluna e selecione as colunas que serão unificadas nela.</p>
                </div>
              </div>
              <button
                onClick={() => setShowMergeModal(false)}
                className="p-1 hover:bg-indigo-800 rounded-lg text-indigo-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              
              {/* Presets dropdown */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <BookmarkPlus className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Carregar Configuração de Unificação Salva:</span>
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMergePresetId}
                    onChange={(e) => handleApplyMergePreset(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 text-xs font-medium rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Selecionar Configuração Salva --</option>
                    {mergePresets.map(preset => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name} ({preset.rules?.length || 0} unificações configuradas)
                      </option>
                    ))}
                  </select>
                  {selectedMergePresetId && (
                    <button
                      onClick={(e) => handleDeleteMergePreset(selectedMergePresetId, e)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
                      title="Excluir configuração de unificação salva"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* List of active merge rules in current draft */}
              <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Merge className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Unificações nesta Configuração ({mergeRules.length})</span>
                  </h4>
                  {mergeRules.length > 0 && (
                    <button
                      onClick={() => setMergeRules([])}
                      className="text-[11px] text-rose-600 hover:underline font-semibold"
                    >
                      Limpar Todas
                    </button>
                  )}
                </div>

                {mergeRules.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">
                    Nenhuma regra de unificação adicionada. Preencha o formulário abaixo e clique em "+ Adicionar Unificação" para incluir quantas unificações desejar nesta configuração.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {mergeRules.map((rule, idx) => (
                      <div
                        key={rule.id}
                        className="bg-white p-3 rounded-lg border border-indigo-200 flex items-start justify-between gap-3 shadow-sm"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-mono flex items-center justify-center shrink-0">
                              #{idx + 1}
                            </span>
                            <span>Nova Coluna: "{rule.newColumnName}"</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1 items-center text-[11px] text-slate-600">
                            <span className="font-semibold text-slate-500">Origens:</span>
                            {rule.sourceColumns.map((sc, sIdx) => (
                              <span key={sIdx} className="bg-slate-100 text-slate-800 font-mono px-1.5 py-0.5 rounded border text-[10px]">
                                {sc}
                              </span>
                            ))}
                            {rule.removeOriginals && (
                              <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                Remover Originais
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleEditRule(rule)}
                            className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Editar esta unificação"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                            title="Remover esta unificação da configuração"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add / Edit Rule Form Box */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-900 flex items-center justify-between pb-2 border-b border-slate-100">
                  <span>{editingRuleId ? 'Editar Unificação de Coluna' : 'Adicionar Nova Unificação de Colunas à Configuração'}</span>
                  {editingRuleId && (
                    <button
                      onClick={() => {
                        setEditingRuleId(null);
                        setNewColumnName('');
                        setSelectedSourceCols([]);
                        setRemoveOriginals(false);
                      }}
                      className="text-[11px] text-slate-500 hover:text-slate-800"
                    >
                      Cancelar Edição
                    </button>
                  )}
                </div>

                {/* New Column Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome da Nova Coluna Unificada:
                  </label>
                  <input
                    type="text"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    placeholder="Ex: Documento Unificado, Telefone Principal, Endereço Completo..."
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 shadow-sm"
                  />
                </div>

                {/* Select Source Columns */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Selecione as colunas da base a serem unificadas nessa nova coluna:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                    {allColumns.map((col, idx) => {
                      const isSelected = selectedSourceCols.includes(col);
                      return (
                        <label
                          key={idx}
                          onClick={() => handleToggleSelectMergeCol(col)}
                          className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs transition-colors border ${
                            isSelected
                              ? 'bg-indigo-50 text-indigo-900 border-indigo-300 font-bold'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by row click
                            className="w-3.5 h-3.5 text-indigo-600 rounded"
                          />
                          <span className="truncate">{col}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Remove originals checkbox */}
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700 pt-1">
                  <input
                    type="checkbox"
                    id="removeOriginals"
                    checked={removeOriginals}
                    onChange={(e) => setRemoveOriginals(e.target.checked)}
                    className="w-3.5 h-3.5 text-indigo-600 rounded"
                  />
                  <label htmlFor="removeOriginals" className="cursor-pointer select-none">
                    Remover as colunas originais selecionadas após criar esta nova coluna
                  </label>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleAddOrUpdateRule}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{editingRuleId ? 'Atualizar Unificação' : '+ Adicionar Unificação à Configuração'}</span>
                  </button>
                </div>
              </div>

              {/* Save Preset Box */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex-1 w-full">
                  <input
                    type="text"
                    value={presetSaveName}
                    onChange={(e) => setPresetSaveName(e.target.value)}
                    placeholder="Nome para salvar a configuração inteira (Ex: Regra Padrão CPF + Tel)"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  onClick={handleSaveMergePreset}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shrink-0 transition-colors shadow-sm"
                  title="Salvar o conjunto de todas as unificações adicionadas acima"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Configuração ({mergeRules.length} Unificações)</span>
                </button>
              </div>

            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowMergeModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteColumnMerge}
                disabled={mergeRules.length === 0}
                className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl shadow-md flex items-center gap-1.5"
              >
                <Merge className="w-3.5 h-3.5" />
                <span>Aplicar {mergeRules.length} Unificação(ões) na Base</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grouping Modal */}
      {showGroupingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 bg-purple-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/30 text-purple-200 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Agrupamento de Dados da Base Consolidada</h3>
                  <p className="text-xs text-purple-200">
                    Selecione as colunas para agrupar e gerar uma coluna com a contagem "Quantidade" de linhas.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGroupingModal(false)}
                className="p-1 hover:bg-purple-800 rounded-lg text-purple-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              {/* Presets dropdown */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-purple-600" />
                    <span>Configurações de Agrupamento Salvas:</span>
                  </span>
                  {selectedGroupingPresetId && (
                    <button
                      onClick={(e) => handleDeleteGroupingPreset(selectedGroupingPresetId, e)}
                      className="text-[11px] text-rose-600 hover:underline font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Excluir Configuração Salva</span>
                    </button>
                  )}
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedGroupingPresetId}
                    onChange={(e) => handleLoadGroupingPreset(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white font-medium focus:border-purple-500"
                  >
                    <option value="">-- Selecionar Agrupamento Salvo --</option>
                    {groupingPresets.map(preset => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name} ({preset.groupColumns.join(', ')})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grouping Configuration Form */}
              <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-200 space-y-3">
                <div className="text-xs font-bold text-purple-950 flex items-center gap-1.5 pb-2 border-b border-purple-200">
                  <Layers className="w-3.5 h-3.5 text-purple-600" />
                  <span>Novo Agrupamento / Seleção de Colunas</span>
                </div>

                {/* Comma separation option checkbox */}
                <label className="flex items-start gap-2.5 p-3 bg-white rounded-lg border border-purple-200 cursor-pointer hover:bg-purple-50/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={splitByCommaInGrouping}
                    onChange={(e) => setSplitByCommaInGrouping(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded mt-0.5 focus:ring-purple-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-purple-950 block">
                      Separar e contar individualmente valores compostos por vírgula
                    </span>
                    <span className="text-[11px] text-slate-600 font-normal block leading-tight mt-0.5">
                      Exemplo: se uma célula contiver <code className="bg-purple-100 text-purple-900 px-1 py-0.2 rounded font-mono">"ABERTURA, MANUTENÇÃO"</code>, o sistema separará os termos e somará +1 para <code className="bg-purple-100 text-purple-900 px-1 py-0.2 rounded font-mono">ABERTURA</code> e +1 para <code className="bg-purple-100 text-purple-900 px-1 py-0.2 rounded font-mono">MANUTENÇÃO</code>.
                    </span>
                  </div>
                </label>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Selecione as colunas da base que farão parte deste agrupamento:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-2.5 bg-white rounded-lg border border-slate-200 shadow-inner">
                    {allRawColumns.map((col, idx) => {
                      const isSelected = draftGroupColumns.includes(col);
                      return (
                        <label
                          key={idx}
                          onClick={() => handleToggleDraftGroupCol(col)}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer text-xs transition-colors border ${
                            isSelected
                              ? 'bg-purple-100 text-purple-900 border-purple-300 font-bold'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by row click
                            className="w-3.5 h-3.5 text-purple-600 rounded"
                          />
                          <span className="truncate">{col}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {draftGroupColumns.length > 0 && (
                  <div className="p-2.5 bg-white rounded-lg border border-purple-200 text-xs">
                    <span className="font-bold text-purple-900">Resultado do Agrupamento:</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      A tabela exibirá a combinação única de <span className="font-semibold text-slate-800">{draftGroupColumns.join(', ')}</span> acompanhada de uma coluna com a contagem total de ocorrências <span className="font-bold text-purple-700">"Quantidade"</span>.
                    </p>
                  </div>
                )}
              </div>

              {/* Save Preset Box */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex-1 w-full">
                  <input
                    type="text"
                    value={groupingSaveName}
                    onChange={(e) => setGroupingSaveName(e.target.value)}
                    placeholder="Nome para salvar a configuração de agrupamento (Ex: Agrupamento por Esteira e Status)"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-purple-500"
                  />
                </div>
                <button
                  onClick={handleSaveGroupingPreset}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shrink-0 transition-colors shadow-sm"
                  title="Salvar esta seleção de colunas para uso futuro"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Configuração</span>
                </button>
              </div>

            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                onClick={handleClearGrouping}
                className="px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-xl"
              >
                Limpar Agrupamento
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGroupingModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleApplyGrouping()}
                  disabled={draftGroupColumns.length === 0}
                  className="px-5 py-2 text-xs font-bold bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white rounded-xl shadow-md flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Carregar / Aplicar Agrupamento</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conditional Value Replacement Modal */}
      {showConditionalModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 bg-amber-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/30 text-amber-200 flex items-center justify-center">
                  <Replace className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Substituição Condicional de Valores entre Colunas</h3>
                  <p className="text-xs text-amber-200">
                    Substitua valores de uma coluna específica com base no valor ou estado de outra coluna.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConditionalModal(false)}
                className="p-1 hover:bg-amber-800 rounded-lg text-amber-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              {/* Presets dropdown */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
                    <span>Configurações Salvas de Substituição:</span>
                  </span>
                  {selectedConditionalPresetId && (
                    <button
                      onClick={(e) => handleDeleteConditionalPreset(selectedConditionalPresetId, e)}
                      className="text-[11px] text-rose-600 hover:underline font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Excluir Configuração Salva</span>
                    </button>
                  )}
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedConditionalPresetId}
                    onChange={(e) => handleLoadConditionalPreset(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white font-medium focus:border-amber-500"
                  >
                    <option value="">-- Selecionar Substituição Salva --</option>
                    {conditionalPresets.map(preset => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name} ({preset.rules.length} regra{preset.rules.length === 1 ? '' : 's'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Form to construct a new rule */}
              <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 space-y-4">
                <div className="text-xs font-bold text-amber-950 flex items-center justify-between pb-2 border-b border-amber-200">
                  <span className="flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-amber-600" />
                    <span>Criar Nova Regra de Substituição</span>
                  </span>
                </div>

                {/* Target Column */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-800 mb-1">
                    1. Coluna que terá o valor alterado (Coluna Alvo):
                  </label>
                  <select
                    value={draftTargetCol}
                    onChange={(e) => setDraftTargetCol(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white font-medium focus:border-amber-500 shadow-sm"
                  >
                    <option value="">-- Selecionar Coluna Alvo --</option>
                    {allRawColumns.map((col, idx) => (
                      <option key={idx} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                {/* Multiple Condition Clauses Section */}
                <div className="space-y-3 pt-2 border-t border-amber-200/70">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                      <span>2. Colunas de Condição / Referência ({draftConditions.length}):</span>
                    </label>

                    {draftConditions.length > 1 && (
                      <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-lg border border-amber-300 text-xs">
                        <span className="text-[11px] font-semibold text-slate-600">Lógica:</span>
                        <label className="flex items-center gap-1 text-[11px] font-medium text-slate-800 cursor-pointer">
                          <input
                            type="radio"
                            name="matchLogic"
                            checked={draftMatchLogic === 'AND'}
                            onChange={() => setDraftMatchLogic('AND')}
                            className="text-amber-600 focus:ring-amber-500"
                          />
                          <span>E (Todas)</span>
                        </label>
                        <label className="flex items-center gap-1 text-[11px] font-medium text-slate-800 cursor-pointer">
                          <input
                            type="radio"
                            name="matchLogic"
                            checked={draftMatchLogic === 'OR'}
                            onChange={() => setDraftMatchLogic('OR')}
                            className="text-amber-600 focus:ring-amber-500"
                          />
                          <span>OU (Qualquer)</span>
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {draftConditions.map((cond, index) => (
                      <div
                        key={cond.id}
                        className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm space-y-2 relative"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded">
                            Condição {index + 1}
                          </span>
                          {draftConditions.length > 1 && (
                            <button
                              onClick={() => handleRemoveConditionClause(cond.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded"
                              title="Remover esta condição"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {/* Condition Column */}
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                              Coluna Referência
                            </label>
                            <select
                              value={cond.conditionColumn}
                              onChange={(e) => handleUpdateConditionClause(cond.id, 'conditionColumn', e.target.value)}
                              className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg outline-none bg-white focus:border-amber-500"
                            >
                              <option value="">-- Selecionar --</option>
                              {allRawColumns.map((col, idx) => (
                                <option key={idx} value={col}>{col}</option>
                              ))}
                            </select>
                          </div>

                          {/* Operator */}
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                              Operador / Regra
                            </label>
                            <select
                              value={cond.operator}
                              onChange={(e) => handleUpdateConditionClause(cond.id, 'operator', e.target.value as ReplaceConditionOperator)}
                              className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg outline-none bg-white focus:border-amber-500"
                            >
                              <option value="equals">For igual a</option>
                              <option value="contains">Contiver o texto</option>
                              <option value="starts_with">Começar com</option>
                              <option value="ends_with">Terminar com</option>
                              <option value="is_empty">Estiver em branco / nulo</option>
                              <option value="is_not_empty">Não estiver em branco</option>
                              <option value="anything">Qualquer valor (Sempre)</option>
                            </select>
                          </div>

                          {/* Condition Value */}
                          {!['is_empty', 'is_not_empty', 'anything'].includes(cond.operator) ? (
                            <div>
                              <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                                Valor Esperado
                              </label>
                              <input
                                type="text"
                                value={cond.conditionValue}
                                onChange={(e) => handleUpdateConditionClause(cond.id, 'conditionValue', e.target.value)}
                                placeholder="Ex: Pendente, SP, 10"
                                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg outline-none focus:border-amber-500"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center text-[11px] text-slate-400 italic pt-4">
                              (Sem valor adicional)
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleAddConditionClause}
                    className="w-full py-2 bg-amber-100 hover:bg-amber-200/80 text-amber-900 border border-dashed border-amber-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-700" />
                    <span>Adicionar Outra Coluna de Condição</span>
                  </button>
                </div>

                {/* Replacement Type & Value */}
                <div className="pt-3 border-t border-amber-200/70 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 mb-1">
                      3. Tipo de Novo Valor:
                    </label>
                    <div className="flex items-center gap-3 py-1">
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="replaceType"
                          checked={draftReplaceType === 'fixed'}
                          onChange={() => setDraftReplaceType('fixed')}
                          className="text-amber-600 focus:ring-amber-500"
                        />
                        <span>Texto Fixo</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="replaceType"
                          checked={draftReplaceType === 'column'}
                          onChange={() => setDraftReplaceType('column')}
                          className="text-amber-600 focus:ring-amber-500"
                        />
                        <span>Valor de Outra Coluna</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 mb-1">
                      {draftReplaceType === 'fixed' ? 'Novo Valor (Texto Fixo):' : 'Coluna Origem do Novo Valor:'}
                    </label>
                    {draftReplaceType === 'fixed' ? (
                      <input
                        type="text"
                        value={draftNewVal}
                        onChange={(e) => setDraftNewVal(e.target.value)}
                        placeholder="Ex: Aprovado, Sudeste, Cancelado"
                        className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg outline-none bg-white focus:border-amber-500"
                      />
                    ) : (
                      <select
                        value={draftNewVal}
                        onChange={(e) => setDraftNewVal(e.target.value)}
                        className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg outline-none bg-white font-medium focus:border-amber-500"
                      >
                        <option value="">-- Selecionar Coluna Origem --</option>
                        {allRawColumns.map((col, idx) => (
                          <option key={idx} value={col}>{col}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleAddConditionalRule}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Regra à Lista</span>
                  </button>
                </div>
              </div>

              {/* List of active rules */}
              {conditionalRules.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>Regras Configuradas ({conditionalRules.length}):</span>
                    <button
                      onClick={() => setConditionalRules([])}
                      className="text-[11px] text-rose-600 hover:underline"
                    >
                      Limpar Todas as Regras
                    </button>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {conditionalRules.map((rule, idx) => {
                      const opTextMap: Record<ReplaceConditionOperator, string> = {
                        equals: 'for igual a',
                        contains: 'contiver',
                        starts_with: 'começar com',
                        ends_with: 'terminar com',
                        is_empty: 'estiver em branco',
                        is_not_empty: 'não estiver em branco',
                        anything: 'for qualquer valor'
                      };

                      const clauses = rule.conditions && rule.conditions.length > 0
                        ? rule.conditions
                        : (rule.conditionColumn ? [{
                            id: 'legacy',
                            conditionColumn: rule.conditionColumn,
                            operator: rule.operator || 'equals',
                            conditionValue: rule.conditionValue || ''
                          }] : []);

                      const joinText = rule.matchLogic === 'OR' ? ' OU ' : ' E ';

                      return (
                        <div
                          key={rule.id || idx}
                          className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-sm flex items-start justify-between gap-3"
                        >
                          <div className="text-xs text-slate-800 leading-relaxed">
                            <div className="font-bold text-slate-700 mb-1">
                              Regra {idx + 1}: Alterar <span className="text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded font-mono">[{rule.targetColumn}]</span> para <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">{rule.replaceType === 'fixed' ? `"${rule.newValue}"` : `[Coluna ${rule.newValue}]`}</span>
                            </div>
                            <div className="text-slate-600 pl-2 border-l-2 border-amber-300 space-y-0.5">
                              <span className="font-medium text-slate-500">Quando:</span>{' '}
                              {clauses.map((c, cIdx) => (
                                <React.Fragment key={c.id || cIdx}>
                                  {cIdx > 0 && <span className="font-bold text-amber-800 px-1">{joinText}</span>}
                                  <span className="font-bold text-amber-900 bg-amber-100/70 px-1 py-0.5 rounded font-mono">
                                    [{c.conditionColumn}]
                                  </span>{' '}
                                  <span>{opTextMap[c.operator]}</span>{' '}
                                  {!['is_empty', 'is_not_empty', 'anything'].includes(c.operator) && (
                                    <span className="font-bold text-slate-900">"{c.conditionValue}"</span>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>

                          <button
                            onClick={() => handleRemoveConditionalRule(rule.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 mt-0.5"
                            title="Remover esta regra"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Save Preset Section */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex-1 w-full">
                  <input
                    type="text"
                    value={conditionalSaveName}
                    onChange={(e) => setConditionalSaveName(e.target.value)}
                    placeholder="Nome para salvar o conjunto de regras (Ex: Normalização de Status por UF)"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-amber-500"
                  />
                </div>
                <button
                  onClick={handleSaveConditionalPreset}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shrink-0 transition-colors shadow-sm"
                  title="Salvar este conjunto de regras para uso futuro"
                >
                  <Save className="w-3.5 h-3.5 text-slate-300" />
                  <span>Salvar Configuração</span>
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                onClick={() => setShowConditionalModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyConditionalReplace}
                disabled={conditionalRules.length === 0}
                className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl shadow-md flex items-center gap-1.5"
              >
                <Replace className="w-3.5 h-3.5" />
                <span>Aplicar {conditionalRules.length} Regra(s) na Base</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Data Table */}
      <div className="overflow-x-auto min-h-[380px]">
        <table className="w-full text-xs text-left border-collapse">
          
          {/* Table Header */}
          <thead className="bg-slate-900 text-white font-bold sticky top-0 z-10">
            <tr>
              <th className="p-3 border-r border-slate-800 text-slate-400 w-12 text-center">#</th>
              {visibleColumns.map((col, idx) => {
                const uniqueVals = activeFilterColumn === col ? getUniqueValuesForColumn(col) : [];
                const filteredVals = uniqueVals.filter(v => v.toLowerCase().includes(filterSearchQuery.toLowerCase()));
                const activeSet = columnFilters[col];
                const hasActiveFilter = activeSet !== undefined;

                return (
                  <th
                    key={idx}
                    className="p-3 border-r border-slate-800 whitespace-nowrap transition-colors select-none relative"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div
                        onClick={() => handleSort(col)}
                        className="cursor-pointer hover:text-white flex-1 flex items-center gap-1.5"
                      >
                        <span>{col}</span>
                        {sortColumn === col ? (
                          <ArrowUpDown className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''} text-blue-400`} />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                        )}
                      </div>

                      {col !== 'Quantidade' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeFilterColumn === col) {
                              setActiveFilterColumn(null);
                            } else {
                              setActiveFilterColumn(col);
                              setFilterSearchQuery('');
                              const currentVals = columnFilters[col];
                              setPendingFilterSelections(currentVals ? new Set(currentVals) : new Set(getUniqueValuesForColumn(col)));
                            }
                          }}
                          className={`p-1.5 rounded transition-colors ${hasActiveFilter ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/40' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                          title="Filtrar valores"
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {activeFilterColumn === col && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setActiveFilterColumn(null)} 
                        />
                        <div 
                          className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 text-slate-800 font-normal overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="p-3 border-b border-slate-100 bg-slate-50">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                autoFocus
                                value={filterSearchQuery}
                                onChange={e => setFilterSearchQuery(e.target.value)}
                                placeholder="Pesquisar valor..."
                                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-500 transition-colors"
                              />
                            </div>
                          </div>
                          
                          <div className="max-h-60 overflow-y-auto p-2">
                            <div className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer mb-1 border-b border-slate-100">
                              <input
                                type="checkbox"
                                checked={pendingFilterSelections.size === uniqueVals.length}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  if (checked) {
                                    setPendingFilterSelections(new Set(uniqueVals));
                                  } else {
                                    setPendingFilterSelections(new Set());
                                  }
                                }}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-slate-700">(Selecionar Tudo)</span>
                            </div>
                            
                            {filteredVals.length === 0 ? (
                              <p className="text-xs text-slate-400 text-center py-4">Nenhum valor encontrado.</p>
                            ) : (
                              filteredVals.map((val, vIdx) => {
                                const isChecked = pendingFilterSelections.has(val);
                                return (
                                  <label key={vIdx} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setPendingFilterSelections(prev => {
                                          const newSet = new Set(prev);
                                          if (checked) {
                                            newSet.add(val);
                                          } else {
                                            newSet.delete(val);
                                          }
                                          return newSet;
                                        });
                                      }}
                                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <span className="text-xs text-slate-600 truncate" title={val || '(Vazio)'}>
                                      {val || <span className="text-slate-400 italic">(Vazio)</span>}
                                    </span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                          
                          <div className="p-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
                            <button
                              onClick={() => {
                                setColumnFilters(prev => {
                                  const newFilters = { ...prev };
                                  delete newFilters[col];
                                  return newFilters;
                                });
                                setActiveFilterColumn(null);
                                setCurrentPage(1);
                              }}
                              className="flex-1 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-200 py-1.5 rounded-lg font-bold transition-colors"
                            >
                              Limpar
                            </button>
                            <button
                              onClick={() => {
                                setColumnFilters(prev => {
                                  const newFilters = { ...prev };
                                  if (pendingFilterSelections.size === uniqueVals.length) {
                                    delete newFilters[col]; // All selected means no filter
                                  } else {
                                    newFilters[col] = pendingFilterSelections;
                                  }
                                  return newFilters;
                                });
                                setActiveFilterColumn(null);
                                setCurrentPage(1);
                              }}
                              className="flex-1 text-xs text-white bg-blue-600 hover:bg-blue-700 py-1.5 rounded-lg font-bold transition-colors"
                            >
                              Aplicar
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="text-center py-12 text-slate-400 text-xs">
                  Nenhum registro encontrado na base consolidada.
                </td>
              </tr>
            ) : (
              paginatedRecords.map((rec, rowIdx) => {
                const globalRowIndex = rowIdx + 1;

                return (
                  <tr key={rec.__id} className="hover:bg-blue-50/30 transition-colors group">
                    
                    {/* Index */}
                    <td className="p-3 font-mono text-slate-400 text-center border-r border-slate-100 text-[11px]">
                      {globalRowIndex}
                    </td>

                    {/* Columns */}
                    {visibleColumns.map((colName, colIdx) => {
                      const isEditing = editingCell?.recordId === rec.__id && editingCell?.colName === colName;
                      const rawVal = rec[colName];
                      const valStr = rawVal !== undefined && rawVal !== null ? String(rawVal) : '';

                      const isEsteiraCol = colName.toLowerCase().includes('esteira') || colName.toLowerCase().includes('origem');

                      return (
                        <td
                          key={colIdx}
                          onDoubleClick={() => handleStartEditCell(rec, colName)}
                          className="p-3 border-r border-slate-100 whitespace-nowrap max-w-[260px] truncate"
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={cellValue}
                                onChange={(e) => setCellValue(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditCell(rec);
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                                className="w-full text-xs font-semibold px-2 py-1 bg-white border border-blue-500 rounded outline-none shadow-sm"
                              />
                              <button
                                onClick={() => handleSaveEditCell(rec)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-1 group/cell">
                              {isEsteiraCol ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  <Layers className="w-3 h-3 text-blue-500" />
                                  {valStr}
                                </span>
                              ) : (
                                <span className="text-slate-800 font-medium text-xs">{valStr || '-'}</span>
                              )}

                              <button
                                onClick={() => handleStartEditCell(rec, colName)}
                                className="opacity-0 group-hover/cell:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 transition-opacity"
                                title="Duplo-clique para editar"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>
                      );
                    })}

                  </tr>
                );
              })
            )}
          </tbody>

        </table>
      </div>

      {/* Status Footer - Strictly 20 preview lines */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-slate-600">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>
            Exibindo prévia das <strong className="text-slate-900">{paginatedRecords.length} primeiras linhas</strong> de{' '}
            <strong className="text-slate-900">{sortedRecords.length}</strong> registros consolidados na base.
          </span>
        </div>
        <div className="text-[11px] text-slate-500 font-normal">
          * A exportação para Excel e os agrupamentos utilizam sempre a base completa ({sortedRecords.length} linhas).
        </div>
      </div>

      {/* Row Detail Modal */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  Detalhes do Registro Consolidado
                </h3>
                <p className="text-xs text-slate-300">Esteira Origem: {detailRecord.__esteira}</p>
              </div>
              <button
                onClick={() => setDetailRecord(null)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-3">
              {allColumns.map((col, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{col}:</span>
                  <span className="text-xs font-semibold text-slate-900 font-mono">
                    {detailRecord[col] !== undefined && detailRecord[col] !== null ? String(detailRecord[col]) : '-'}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 text-right">
              <button
                onClick={() => setDetailRecord(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supabase Upload Modal */}
      <SupabaseModal
        isOpen={showSupabaseModal}
        onClose={() => setShowSupabaseModal(false)}
        appColumns={visibleColumns}
        recordsToUpload={sortedRecords}
        isGroupedView={activeGroupColumns.length > 0}
      />

    </div>
  );
};

