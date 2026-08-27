export type DataType = 'string' | 'number' | 'date' | 'time' | 'currency' | 'status';

export interface RawRow {
  [key: string]: any;
}

export interface EsteiraSheet {
  id: string;
  name: string; // e.g. "Esteira 01 - Crédito"
  rowCount: number;
  columnCount: number;
  headers: string[];
  rawRows: RawRow[];
  selected: boolean;
  emptyRowCount: number;
  completenessRate: number; // percentage of filled cells
}

export interface ColumnMapping {
  id: string;
  sourceColumn: string;       // original header name in the sheet
  targetColumn: string;       // unified header name in consolidated database
  sheetName: string;          // which sheet this column comes from
  dataType: DataType;
  isIgnored: boolean;
  customTransformation?: 'trim' | 'uppercase' | 'lowercase' | 'capitalize' | 'none';
}

export interface GroupedColumnMapping {
  targetColumnName: string;
  dataType: DataType;
  sourceMappings: {
    sheetName: string;
    originalHeader: string;
    isIgnored: boolean;
  }[];
}

export type ConsolidationFilterOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'contains' 
  | 'not_contains' 
  | 'starts_with' 
  | 'ends_with' 
  | 'greater_than' 
  | 'less_than' 
  | 'is_empty' 
  | 'is_not_empty';

export interface ConsolidationFilterRule {
  id: string;
  column: string; // Column target name or 'ALL'
  operator: ConsolidationFilterOperator;
  value: string;
}

export interface ConsolidationFilterConfig {
  enabled: boolean;
  matchLogic: 'AND' | 'OR';
  rules: ConsolidationFilterRule[];
}

export interface ConsolidationConfig {
  esteiraColumnName: string;    // Name of metadata column added to every row, e.g. "Esteira / Aba de Origem"
  deduplicate: boolean;
  dedupeKey: string;            // Column name to deduplicate by or 'ALL' for full row
  trimWhitespace: boolean;
  removeEmptyRows: boolean;
  fillMissingValue: string;     // Default string for missing cells, e.g. "-" or "N/A"
  standardizeDates: boolean;    // Convert dates to DD/MM/YYYY
  standardizeCurrency: boolean; // Format currency numbers cleanly
  groupMappings: GroupedColumnMapping[];
  filterConfig?: ConsolidationFilterConfig;
}

export interface ConsolidatedRecord {
  __id: string;                 // Internal unique ID
  __esteira: string;            // Origin sheet name
  __rowNum: number;             // Original row index in source sheet
  [key: string]: any;           // Unified key-value pairs
}

export interface ConsolidationSummary {
  totalRecords: number;
  totalEsteiras: number;
  duplicateRowsRemoved: number;
  emptyRowsRemoved: number;
  unifiedColumnsCount: number;
  recordsPerEsteira: {
    esteira: string;
    count: number;
    color: string;
  }[];
  fieldCompletenessRate: number;
  createdAt: string;
  fileName: string;
}

export interface AiAnalysisReport {
  resumoExecutivo: string;
  qualidadeDados: {
    score: number;
    diagnostico: string;
  };
  alertasInconsistencia: string[];
  insightsOperacionais: string[];
  recomendacoes: string[];
}

export interface FilterPreset {
  id: string;
  name: string;
  columnFilters?: Record<string, string[]>;
  rules?: ConsolidationFilterRule[];
  matchLogic?: 'AND' | 'OR';
}

export interface MacroPreset {
  id: string;
  name: string;
  exclusionPresetId?: string;
  mergePresetId?: string;
  conditionalPresetId?: string;
  groupingPresetId?: string;
  filterPresetId?: string;
}

export interface HistoryEntry {
  id: string;
  fileName: string;
  timestamp: string;
  totalRecords: number;
  esteiraNames: string[];
  columnsCount: number;
  summary: ConsolidationSummary;
  config: ConsolidationConfig;
}

export interface ColumnRenameRule {
  fromColumn: string;
  toColumn: string;
}

export interface AddedColumnRule {
  targetColumnName: string;
  dataType: DataType;
  defaultValue?: string;
}

export interface ColumnExclusionPreset {
  id: string;
  name: string;
  excludedColumns: string[];
  renames?: ColumnRenameRule[];
  addedColumns?: AddedColumnRule[];
}

export interface ColumnMergeRule {
  id: string;
  newColumnName: string;
  sourceColumns: string[];
  removeOriginals?: boolean;
}

export interface ColumnMergePreset {
  id: string;
  name: string;
  rules: ColumnMergeRule[];
}

export interface GroupingPreset {
  id: string;
  name: string;
  groupColumns: string[];
  aggregationType?: 'count' | 'sum' | 'both';
  sumColumn?: string;
}

export type ReplaceConditionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'anything';

export interface ConditionClause {
  id: string;
  conditionColumn: string;
  operator: ReplaceConditionOperator;
  conditionValue: string;
}

export interface ConditionalReplaceRule {
  id: string;
  targetColumn: string;
  conditions: ConditionClause[];
  matchLogic?: 'AND' | 'OR';
  // Backward compatibility fields
  conditionColumn?: string;
  operator?: ReplaceConditionOperator;
  conditionValue?: string;
  replaceType: 'fixed' | 'column';
  newValue: string;
}

export interface ConditionalReplacePreset {
  id: string;
  name: string;
  rules: ConditionalReplaceRule[];
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  connected?: boolean;
  email?: string;
  password?: string;
}

export interface SupabaseTableColumn {
  name: string;
  type?: string;
}

export interface SupabaseTable {
  name: string;
  columns?: SupabaseTableColumn[];
}

export interface SupabaseColumnMapping {
  appColumn: string;
  supabaseColumn: string;
}

