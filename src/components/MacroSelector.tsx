import React, { useState, useEffect } from 'react';
import { MacroPreset, ColumnMergePreset, GroupingPreset, ConditionalReplacePreset, ColumnExclusionPreset, FilterPreset } from '../types';
import { Layers, Plus, Trash2, Play, Settings2, BookmarkPlus } from 'lucide-react';
import { saveToFirebase, loadFromFirebase } from '../lib/firebase';

const MACRO_STORAGE_KEY = 'esteiras_macro_presets';

interface MacroSelectorProps {
  onExecuteMacro: (macro: MacroPreset) => void;
  // We need to pass the available presets so the user can select them
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
  
  // Draft Macro state
  const [draftName, setDraftName] = useState('');
  const [draftExclusionId, setDraftExclusionId] = useState('');
  const [draftMergeId, setDraftMergeId] = useState('');
  const [draftConditionalId, setDraftConditionalId] = useState('');
  const [draftGroupingId, setDraftGroupingId] = useState('');
  const [draftFilterId, setDraftFilterId] = useState('');

  useEffect(() => {
    const loadMacros = async () => {
      try {
        const cached = localStorage.getItem(MACRO_STORAGE_KEY);
        if (cached) {
          setMacros(JSON.parse(cached));
        }
        const saved = await loadFromFirebase<MacroPreset[]>(MACRO_STORAGE_KEY);
        if (saved && Array.isArray(saved) && saved.length > 0) {
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
    localStorage.setItem(MACRO_STORAGE_KEY, JSON.stringify(newMacros));
    saveToFirebase(MACRO_STORAGE_KEY, newMacros);
  };

  const handleCreateMacro = () => {
    if (!draftName.trim()) {
      alert('Dê um nome para a macro.');
      return;
    }
    
    if (!draftExclusionId && !draftMergeId && !draftConditionalId && !draftGroupingId && !draftFilterId) {
      alert('Selecione pelo menos uma configuração para formar a combinação.');
      return;
    }

    const newMacro: MacroPreset = {
      id: `macro-${Date.now()}`,
      name: draftName,
      exclusionPresetId: draftExclusionId || undefined,
      mergePresetId: draftMergeId || undefined,
      conditionalPresetId: draftConditionalId || undefined,
      groupingPresetId: draftGroupingId || undefined,
      filterPresetId: draftFilterId || undefined,
    };

    saveMacros([...macros, newMacro]);
    setDraftName('');
    setDraftExclusionId('');
    setDraftMergeId('');
    setDraftConditionalId('');
    setDraftGroupingId('');
    setDraftFilterId('');
    setShowMacroForm(false);
  };

  const handleDeleteMacro = (id: string) => {
    if (confirm('Deseja excluir esta macro?')) {
      saveMacros(macros.filter(m => m.id !== id));
    }
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
            Execute uma sequência de configurações cadastradas (Limpeza, Filtros, Unificação, Condicionais e Agrupamento) de uma só vez e vá direto para a base final.
          </p>
        </div>
        <button
          onClick={() => setShowMacroForm(!showMacroForm)}
          className="px-3.5 py-2 text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
        >
          {showMacroForm ? <Trash2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showMacroForm ? 'Cancelar' : 'Nova Macro'}</span>
        </button>
      </div>

      {showMacroForm && (
        <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm mb-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-indigo-900 mb-1">Nome da Combinação (Macro)</label>
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Ex: Macro Completa - Relatório X"
              className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-indigo-50/30 focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">1. Exclusão de Colunas (Etapa 3)</label>
              <select value={draftExclusionId} onChange={(e) => setDraftExclusionId(e.target.value)} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white">
                <option value="">-- Padrão (Sem exclusões baseadas em Preset) --</option>
                {exclusionPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">2. Filtros de Registros (Salvos)</label>
              <select value={draftFilterId} onChange={(e) => setDraftFilterId(e.target.value)} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white">
                <option value="">-- Ignorar --</option>
                {filterPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">3. Unificação de Colunas (Etapa 4)</label>
              <select value={draftMergeId} onChange={(e) => setDraftMergeId(e.target.value)} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white">
                <option value="">-- Ignorar --</option>
                {mergePresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">4. Substituições Condicionais (Etapa 4)</label>
              <select value={draftConditionalId} onChange={(e) => setDraftConditionalId(e.target.value)} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white">
                <option value="">-- Ignorar --</option>
                {conditionalPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">5. Agrupamento (Etapa 4)</label>
              <select value={draftGroupingId} onChange={(e) => setDraftGroupingId(e.target.value)} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white">
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
            <div key={macro.id} className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-sm hover:border-indigo-300 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <h4 className="font-bold text-sm text-indigo-950 truncate" title={macro.name}>{macro.name}</h4>
                  <button onClick={() => handleDeleteMacro(macro.id)} className="text-rose-400 hover:text-rose-600 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="text-[10px] text-slate-500 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-slate-300"></span> Exclusão: {macro.exclusionPresetId ? 'Sim' : 'Não'}</div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-slate-300"></span> Filtros: {macro.filterPresetId ? 'Sim' : 'Não'}</div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-slate-300"></span> Unificação: {macro.mergePresetId ? 'Sim' : 'Não'}</div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-slate-300"></span> Condicional: {macro.conditionalPresetId ? 'Sim' : 'Não'}</div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-slate-300"></span> Agrupamento: {macro.groupingPresetId ? 'Sim' : 'Não'}</div>
                </div>
              </div>
              <button
                onClick={() => onExecuteMacro(macro)}
                className="mt-4 w-full px-3 py-2 text-xs font-bold bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <Play className="w-3 h-3" />
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