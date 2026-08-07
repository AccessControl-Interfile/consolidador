import React from 'react';
import { HistoryEntry } from '../types';
import { History, X, Download, Trash2, ArrowRight, Layers, FileSpreadsheet, Calendar } from 'lucide-react';
import { exportToExcel } from '../utils/exporter';

interface HistoryDrawerProps {
  history: HistoryEntry[];
  onSelectHistory: (entry: HistoryEntry) => void;
  onDeleteHistory: (id: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  history,
  onSelectHistory,
  onDeleteHistory,
  onClearAll,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-base text-white">Histórico de Consolidações</h3>
              <p className="text-xs text-slate-400">Bases salvas localmente neste navegador</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700">Nenhum histórico encontrado</p>
              <p className="text-xs text-slate-500 mt-1">
                As consolidações realizadas ficarão salvas aqui para acesso rápido.
              </p>
            </div>
          ) : (
            history.map((entry) => (
              <div
                key={entry.id}
                className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 hover:border-blue-300 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs truncate max-w-[220px]">
                      {entry.fileName}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{entry.timestamp}</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {entry.totalRecords} linhas
                  </span>
                </div>

                {/* Esteiras list badges */}
                <div className="flex flex-wrap gap-1">
                  {entry.esteiraNames.map((eName, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200"
                    >
                      {eName}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                  <button
                    onClick={() => onDeleteHistory(entry.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    title="Remover do histórico"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => exportToExcel(entry.records, entry.summary, entry.fileName)}
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1"
                    >
                      <Download className="w-3 h-3 text-emerald-600" />
                      <span>.xlsx</span>
                    </button>

                    <button
                      onClick={() => onSelectHistory(entry)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                    >
                      <span>Abrir Base</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={onClearAll}
              className="text-xs font-semibold text-rose-600 hover:underline"
            >
              Limpar Histórico Completo
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
            >
              Fechar
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
