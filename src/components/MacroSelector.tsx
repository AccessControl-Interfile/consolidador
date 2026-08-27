import React, { useState, useEffect } from 'react';
import { MacroPreset, ColumnMergePreset, GroupingPreset, ConditionalReplacePreset, ColumnExclusionPreset, FilterPreset } from '../types';
import { Layers, Plus, Trash2, Play, Settings2, BookmarkPlus, Check, X, AlertTriangle } from 'lucide-react';
import { saveToFirebase, loadFromFirebase } from '../lib/firebase';

const MACRO_STORAGE_KEY = 'esteiras_macro_presets';

interface MacroSelectorProps {
  onExecuteMacro: (macro: MacroPreset) => void;
  exclusionPresets: ColumnExclusionPreset[];
  mergePresets: ColumnMergePreset[];
  conditionalPresets: ConditionalReplacePreset[];
  groupingPresets: GroupingPreset[];
  filterPresets?: FilterPreset[];
}

export const MacroSelector: React.FC<MacroSelectorProps> = ({
  onExecuteMacro,
  exclusionPresets,
  mergePresets,
  conditionalPresets,
  groupingPresets,
  filterPresets = []
}) => {
  const [macros, setMacros] = useState<MacroPreset[]>([]);
  const [showMacroForm, setShowMacroForm] = useState(false);
  const [macroToDelete, setMacroToDelete] = useState<string | null>(null);
  
  // Draft Macro state
  const [draftName, setDraftName] = useState('');
  const [draftExclusionId, setDraftExclusionId] = useState('');
  const [draftMergeId, setDraftMergeId] = useState('');
  const [draftConditionalId, setDraftConditionalId] = useState('');
  const [draftFilterId, setDraftFilterId] = useState('');
  const [draftGroupingId, setDraftGroupingId] = useState('');

  useEffect(() => {
    const loadMacros = async () => {
      try {
        const cached = localStorage.getItem(MACRO_STORAGE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              setMacros(parsed);
            }
          } catch (e) {}
        }
        const saved = await loadFromFirebase<MacroPreset[]>(MACRO_STORAGE_KEY);
        if (saved !== null && Array.isArray(saved)) {
          setMacros(saved);
          localStorage.setItem(MACRO_STORAGE_KEY, JSON.stringify(saved));
        }
      } catch (e) {
        console.error('Failed to load macros', e);
      }
    };
    loadMacros();
  }, []);

  const saveMacros = (newMacros: MacroPreset[]) => {
    setMacros(newMacros);
    try {
      localStorage.setItem(MACRO_STORAGE_KEY, JSON.stringify(newMacros));
    } catch (e) {}
    saveToFirebase(MACRO_STORAGE_KEY, newMacros);
  };

  const handleCreateMacro = () => {
    if (!draftName.trim()) {
      alert('Dê um nome para a macro.');
      return;
    }
    
    if (!draftExclusionId && !draftMergeId && !draftConditionalId && !draftFilterId && !draftGroupingId) {
      alert('Selecione pelo menos uma configuração para formar a combinação.');
      return;
    }

    const newMacro: MacroPreset = {
      id: `macro-${Date.now()}`,
      name: draftName.trim(),
      exclusionPresetId: draftExclusionId || undefined,
      mergePresetId: draftMergeId || undefined,
      conditionalPresetId: draftConditionalId || undefined,
      filterPresetId: draftFilterId || undefined,
      groupingPresetId: draftGroupingId || undefined,
    };

    saveMacros([...macros, newMacro]);
    setDraftName('');
    setDraftExclusionId('');
    setDraftMergeId('');
    setDraftConditionalId('');
    setDraftFilterId('');
    setDraftGroupingId('');
    setShowMacroForm(false);
  };

  const confirmDeleteMacro = (id: string) => {
    const updated = macros.filter(m => m.id !== id);
    saveMacros(updated);
    setMacroToDelete(null);
  };

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-5 rounded-2xl border border-indigo-100 shadow-sm mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-indigo-950 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-indigo-600" />
            Macros / Combinações de Configurações
          </h3>
          <p className="text-xs text-indigo-700/80 mt-1">
            Execute uma sequência ordenada de configurações (1. Etapa 3 &rarr; 2. Unificação &rarr; 3. Substituições &rarr; 4. Filtros &rarr; 5. Agrupamentos) de uma só vez e vá direto para a base final.
          </p>
        </div>
        <button
          onClick={() => setShowMacroForm(!showMacroForm)}
          className="px-3.5 py-2 text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
        >
          {showMacroForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showMacroForm ? 'Cancelar' : 'Nova Macro'}</span>
        </button>
      </div>

      {showMacroForm && (
        <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm mb-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
          <div>
            <label className="block text-xs font-bold text-indigo-900 mb-1">Nome da Combinação (Macro)</label>
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Ex: Macro Completa - Relatório Operacional"
              className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-indigo-50/30 focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">1. Configuração da Etapa 3 (Colunas)</label>
              <select value={draftExclusionId} onChange={(e) => setDraftExclusionId(e.target.value)} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white font-medium">
                <option value="">-- Padrão (Sem configuração da Etapa 3) --</option>
                {exclusionPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">2. Unificação de Colunas (Etapa 4)</label>
              <select value={draftMergeId} onChange={(e) => setDraftMergeId(e.target.value)} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white font-medium">
                <option value="">-- Ignorar --</option>
                {mergePresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">3. Substituições Condicionais (Etapa 4)</label>
              <select value={draftConditionalId} onChange={(e) => setDraftConditionalId(e.target.value)} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white font-medium">
                <option value="">-- Ignorar --</option>
                {conditionalPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">4. Filtros de Registros (Salvos)</label>
              <select value={draftFilterId} onChange={(e) => setDraftFilterId(e.target.value)} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white font-medium">
                <option value="">-- Ignorar --</option>
                {filterPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">5. Agrupamento (Etapa 4)</label>
              <select value={draftGroupingId} onChange={(e) => setDraftGroupingId(e.target.value)} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white font-medium">
                <option value="">-- Ignorar --</option>
                {groupingPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleCreateMacro}
              className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span>Salvar Macro</span>
            </button>
          </div>
        </div>
      )}

      {macros.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {macros.map(macro => (
            <div key={macro.id} className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-sm hover:border-indigo-300 transition-colors flex flex-col justify-between relative overflow-hidden">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-sm text-indigo-950 truncate" title={macro.name}>{macro.name}</h4>
                  
                  {macroToDelete === macro.id ? (
                    <div className="flex items-center gap-1 shrink-0 animate-in fade-in duration-100">
                      <button
                        onClick={() => confirmDeleteMacro(macro.id)}
                        className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded flex items-center gap-1 shadow-xs"
                        title="Confirmar exclusão da macro"
                      >
                        <Check className="w-3 h-3" />
                        <span>Confirmar</span>
                      </button>
                      <button
                        onClick={() => setMacroToDelete(null)}
                        className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded"
                        title="Cancelar"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setMacroToDelete(macro.id)}
                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded transition-colors shrink-0"
                      title="Excluir esta macro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="mt-2.5 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                    <span>1. Etapa 3 (Colunas):</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${macro.exclusionPresetId ? 'bg-indigo-100 text-indigo-800' : 'text-slate-400'}`}>
                      {macro.exclusionPresetId ? 'Ativo' : 'Não'}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                    <span>2. Unificação:</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${macro.mergePresetId ? 'bg-indigo-100 text-indigo-800' : 'text-slate-400'}`}>
                      {macro.mergePresetId ? 'Ativo' : 'Não'}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                    <span>3. Substituição:</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${macro.conditionalPresetId ? 'bg-indigo-100 text-indigo-800' : 'text-slate-400'}`}>
                      {macro.conditionalPresetId ? 'Ativo' : 'Não'}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                    <span>4. Filtros:</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${macro.filterPresetId ? 'bg-indigo-100 text-indigo-800' : 'text-slate-400'}`}>
                      {macro.filterPresetId ? 'Ativo' : 'Não'}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                    <span>5. Agrupamento:</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${macro.groupingPresetId ? 'bg-indigo-100 text-indigo-800' : 'text-slate-400'}`}>
                      {macro.groupingPresetId ? 'Ativo' : 'Não'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onExecuteMacro(macro)}
                className="mt-3.5 w-full px-3 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Executar Macro</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-6 bg-white/50 rounded-xl border border-indigo-100/50">
          <p className="text-xs text-indigo-800/60 font-medium">Nenhuma macro cadastrada ainda.</p>
        </div>
      )}
    </div>
  );
};