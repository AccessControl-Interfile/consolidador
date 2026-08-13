import React, { useState } from 'react';
import { EsteiraSheet, MacroPreset, ColumnMergePreset, GroupingPreset, ConditionalReplacePreset, ColumnExclusionPreset } from '../types';
import { Layers, CheckSquare, Square, Eye, ArrowRight, Table, AlertTriangle, FileCheck, RotateCcw, Trash2 } from 'lucide-react';
import { MacroSelector } from './MacroSelector';

interface SheetSelectorProps {
  sheets: EsteiraSheet[];
  onToggleSheet: (sheetId: string) => void;
  onSelectAll: (select: boolean) => void;
  onProceed: () => void;
  onBack: () => void;
  
  // Macros
  onExecuteMacro: (macro: MacroPreset) => void;
  exclusionPresets: ColumnExclusionPreset[];
  mergePresets: ColumnMergePreset[];
  conditionalPresets: ConditionalReplacePreset[];
  groupingPresets: GroupingPreset[];
}

export const SheetSelector: React.FC<SheetSelectorProps> = ({
  sheets,
  onToggleSheet,
  onSelectAll,
  onProceed,
  onBack,
  onExecuteMacro,
  exclusionPresets,
  mergePresets,
  conditionalPresets,
  groupingPresets
}) => {
  const [previewSheet, setPreviewSheet] = useState<EsteiraSheet | null>(null);

  const selectedSheets = sheets.filter(s => s.selected);
  const deselectedSheets = sheets.filter(s => !s.selected);
  const totalRowsSelected = selectedSheets.reduce((acc, s) => acc + s.rowCount, 0);

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      
      {/* Step Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
            <span>Etapa 2 de 4</span>
            <span>•</span>
            <span>Seleção de Esteiras / Abas</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            Selecione as Esteiras (Abas) para Consolidar
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Identificamos <strong className="text-slate-800">{sheets.length} abas</strong> neste arquivo Excel. Marque as que farão parte da base consolidada.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectAll(true)}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
            <span>Marcar Todas</span>
          </button>
          <button
            onClick={() => onSelectAll(false)}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Square className="w-3.5 h-3.5 text-slate-400" />
            <span>Desmarcar Todas</span>
          </button>
        </div>
      </div>

      {/* Sheets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {sheets.map((sheet) => (
          <div
            key={sheet.id}
            onClick={() => onToggleSheet(sheet.id)}
            className={`relative p-5 rounded-2xl border transition-all cursor-pointer ${
              sheet.selected
                ? 'bg-blue-50/40 border-blue-400 shadow-sm ring-1 ring-blue-400/50'
                : 'bg-white border-slate-200 hover:border-slate-300 opacity-80'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                    sheet.selected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {sheet.selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    {sheet.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <span className="font-semibold text-slate-700">{sheet.rowCount} registros</span>
                    <span>•</span>
                    <span>{sheet.columnCount} colunas</span>
                  </div>
                </div>
              </div>

              {/* Quality badge */}
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    sheet.completenessRate >= 90
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : sheet.completenessRate >= 70
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                  title="Taxa de células preenchidas nesta aba"
                >
                  {sheet.completenessRate}% Completo
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewSheet(sheet);
                  }}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Visualizar prévia das linhas"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Header Tags Preview */}
            <div className="mt-4 pt-3 border-t border-slate-200/60 flex flex-wrap gap-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-full">
                Colunas detectadas:
              </span>
              {sheet.headers.slice(0, 6).map((h, i) => (
                <span
                  key={i}
                  className="text-[11px] bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded border border-slate-200/80"
                >
                  {h}
                </span>
              ))}
              {sheet.headers.length > 6 && (
                <span className="text-[11px] text-slate-400 italic px-1">
                  +{sheet.headers.length - 6} outras
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Dedicated Excluded Sheets Area */}
      {deselectedSheets.length > 0 && (
        <div className="bg-rose-50/70 rounded-2xl border border-rose-200 p-5 mb-8 shadow-sm">
          {/* ... existing excluded area ... */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-rose-200">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-700 flex items-center justify-center font-bold shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-950 flex items-center gap-2">
                  <span>Área de Esteiras (Abas) Desmarcadas / Excluídas</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-200 text-rose-900 font-bold border border-rose-300">
                    {deselectedSheets.length} {deselectedSheets.length === 1 ? 'aba excluída' : 'abas excluídas'}
                  </span>
                </h3>
                <p className="text-xs text-rose-700/90 mt-0.5">
                  As abas nesta área foram desmarcadas e não serão processadas. Clique em "Restaurar" para incluí-las novamente.
                </p>
              </div>
            </div>

            <button
              onClick={() => onSelectAll(true)}
              className="px-3.5 py-2 text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-700" />
              <span>Restaurar Todas as Esteiras</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {deselectedSheets.map(sheet => (
              <div
                key={sheet.id}
                className="bg-white p-3.5 rounded-xl border border-rose-200 flex items-center justify-between gap-3 shadow-sm hover:border-rose-300 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-rose-900 truncate line-through">
                    {sheet.name}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {sheet.rowCount} registros • {sheet.columnCount} colunas
                  </div>
                </div>

                <button
                  onClick={() => onToggleSheet(sheet.id)}
                  className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1 shrink-0 shadow-sm"
                  title="Restaurar esta esteira/aba para o processamento"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Macro Selector */}
      {selectedSheets.length > 0 && (
        <MacroSelector 
          onExecuteMacro={onExecuteMacro}
          exclusionPresets={exclusionPresets}
          mergePresets={mergePresets}
          conditionalPresets={conditionalPresets}
          groupingPresets={groupingPresets}
        />
      )}

      {/* Summary Footer bar */}
      <div className="sticky bottom-4 z-40 mt-8 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl border border-slate-700/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">
              {selectedSheets.length} de {sheets.length} Esteiras Selecionadas
            </div>
            <div className="text-xs text-slate-300">
              Total estimado de <strong className="text-blue-400 font-bold">{totalRowsSelected} registros</strong> prontos para consolidação
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={onBack}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Voltar
          </button>

          <button
            onClick={onProceed}
            disabled={selectedSheets.length === 0}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <span>Avançar para Mapeamento</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal Preview Drawer */}
      {previewSheet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Table className="w-5 h-5 text-blue-600" />
                  Prévia da Aba: {previewSheet.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Mostrando primeiras 5 linhas de {previewSheet.rowCount} registros
                </p>
              </div>
              <button
                onClick={() => setPreviewSheet(null)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                Fechar
              </button>
            </div>

            <div className="p-5 overflow-auto flex-1">
              <table className="w-full text-xs text-left text-slate-700 border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-200 font-bold">
                    <th className="p-2 border-r border-slate-200">#</th>
                    {previewSheet.headers.map((h, i) => (
                      <th key={i} className="p-2 border-r border-slate-200 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewSheet.rawRows.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="p-2 font-mono text-slate-400 border-r border-slate-200">{idx + 1}</td>
                      {previewSheet.headers.map((h, i) => (
                        <td key={i} className="p-2 border-r border-slate-200 whitespace-nowrap">
                          {row[h] !== undefined && row[h] !== null ? String(row[h]) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
