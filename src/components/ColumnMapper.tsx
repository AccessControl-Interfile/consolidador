import React, { useState, useEffect } from 'react';
import { DataType, GroupedColumnMapping, ColumnExclusionPreset } from '../types';
import { Columns, ArrowRight, Plus, Trash2, Tag, Check, RefreshCw, Sparkles, FileSpreadsheet, BookmarkPlus, Save, CheckSquare, Square, X, RotateCcw } from 'lucide-react';
import { saveToFirebase, loadFromFirebase } from '../lib/firebase';

interface ColumnMapperProps {
  mappings: GroupedColumnMapping[];
  onChangeMappings: (updated: GroupedColumnMapping[]) => void;
  onResetToPowerQuery: () => void;
  onApplySynonymGrouping: () => void;
  onProceed: () => void;
  onBack: () => void;
}

const EXCLUSION_STORAGE_KEY = 'esteiras_exclusion_presets';

export const ColumnMapper: React.FC<ColumnMapperProps> = ({
  mappings,
  onChangeMappings,
  onResetToPowerQuery,
  onApplySynonymGrouping,
  onProceed,
  onBack
}) => {
  const [exclusionPresets, setExclusionPresets] = useState<ColumnExclusionPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [showSavePresetModal, setShowSavePresetModal] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [deletedColumnNames, setDeletedColumnNames] = useState<string[]>([]);

  // Load saved exclusion presets from Firebase
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const saved = await loadFromFirebase<ColumnExclusionPreset[]>(EXCLUSION_STORAGE_KEY);
        if (saved && Array.isArray(saved)) {
          setExclusionPresets(saved);
        }
      } catch (e) {
        console.error('Failed to load exclusion presets from Firebase', e);
      }
    };
    loadPresets();
  }, []);

  // Save new preset (exclusions and renames)
  const handleSaveExclusionPreset = () => {
    if (!newPresetName.trim()) {
      alert('Digite um nome para a configuração.');
      return;
    }

    // Get current excluded target column names + original headers + completely deleted columns
    const currentExcluded = Array.from(new Set([
      ...mappings
        .filter(m => m.sourceMappings.length > 0 && m.sourceMappings.every(sm => sm.isIgnored))
        .flatMap(m => [m.targetColumnName, ...m.sourceMappings.map(sm => sm.originalHeader)]),
      ...deletedColumnNames
    ]));

    // Collect renames for active (non-excluded) columns
    const renamesMap = new Map<string, { fromColumn: string; toColumn: string }>();
    mappings.forEach(m => {
      const isExcluded = m.sourceMappings.length > 0 && m.sourceMappings.every(sm => sm.isIgnored);
      if (!isExcluded) {
        m.sourceMappings.forEach(sm => {
          if (sm.originalHeader && sm.originalHeader.trim() !== '' && sm.originalHeader.trim() !== m.targetColumnName.trim()) {
            const key = sm.originalHeader.trim().toLowerCase();
            renamesMap.set(key, {
              fromColumn: sm.originalHeader.trim(),
              toColumn: m.targetColumnName.trim()
            });
          }
        });
      }
    });

    const renamesList = Array.from(renamesMap.values());

    if (currentExcluded.length === 0 && renamesList.length === 0) {
      alert('Nenhuma alteração de exclusão ou renomeação para salvar nesta configuração.');
      return;
    }

    const newPreset: ColumnExclusionPreset = {
      id: `excl-${Date.now()}`,
      name: newPresetName.trim(),
      excludedColumns: currentExcluded,
      renames: renamesList
    };

    const updatedPresets = [...exclusionPresets, newPreset];
    setExclusionPresets(updatedPresets);
    saveToFirebase(EXCLUSION_STORAGE_KEY, updatedPresets);

    setSelectedPresetId(newPreset.id);
    setNewPresetName('');
    setShowSavePresetModal(false);

    let summaryText = `Configuração "${newPreset.name}" salva com sucesso!`;
    const details = [];
    if (currentExcluded.length > 0) details.push(`${currentExcluded.length} coluna(s) excluída(s)`);
    if (renamesList.length > 0) details.push(`${renamesList.length} renomeação(ões)`);
    if (details.length > 0) summaryText += ` (${details.join(', ')})`;

    alert(summaryText);
  };

  // Apply a selected preset: STEP 1 (Exclusions), then STEP 2 (Renames)
  const handleApplyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (!presetId) return;

    const preset = exclusionPresets.find(p => p.id === presetId);
    if (!preset) return;

    const excludedSet = new Set((preset.excludedColumns || []).map(c => c.toLowerCase()));

    // STEP 1: Process exclusions FIRST based on original source headers
    let updated = mappings.map(group => {
      const isTargetExcluded = group.sourceMappings.length === 0 && excludedSet.has(group.targetColumnName.toLowerCase());
      const hasExcludedSource = group.sourceMappings.some(sm => excludedSet.has(sm.originalHeader.toLowerCase()));
      const shouldIgnore = isTargetExcluded || hasExcludedSource;

      return {
        ...group,
        sourceMappings: group.sourceMappings.map(sm => ({
          ...sm,
          isIgnored: shouldIgnore || excludedSet.has(sm.originalHeader.toLowerCase())
        }))
      };
    });

    // STEP 2: Process renames SECOND, after exclusions are marked
    if (preset.renames && preset.renames.length > 0) {
      const renameRules = preset.renames;
      updated = updated.map(group => {
        const matchRule = renameRules.find(r => 
          group.sourceMappings.some(sm => sm.originalHeader.toLowerCase() === r.fromColumn.toLowerCase()) ||
          r.fromColumn.toLowerCase() === group.targetColumnName.toLowerCase()
        );

        if (matchRule && matchRule.toColumn) {
          return {
            ...group,
            targetColumnName: matchRule.toColumn
          };
        }

        return group;
      });
    }

    onChangeMappings(updated);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = exclusionPresets.filter(p => p.id !== id);
    setExclusionPresets(updated);
    saveToFirebase(EXCLUSION_STORAGE_KEY, updated);
    if (selectedPresetId === id) {
      setSelectedPresetId('');
    }
  };

  const handleUpdateTargetName = (index: number, newName: string) => {
    const updated = [...mappings];
    updated[index].targetColumnName = newName;
    onChangeMappings(updated);
  };

  const handleUpdateType = (index: number, newType: DataType) => {
    const updated = [...mappings];
    updated[index].dataType = newType;
    onChangeMappings(updated);
  };

  const handleToggleIgnoreGroup = (index: number) => {
    const updated = [...mappings];
    const allIgnored = updated[index].sourceMappings.every(sm => sm.isIgnored);
    updated[index].sourceMappings.forEach(sm => {
      sm.isIgnored = !allIgnored;
    });
    onChangeMappings(updated);
  };

  const handleToggleSourceIgnored = (groupIndex: number, sourceIndex: number) => {
    const updated = [...mappings];
    updated[groupIndex].sourceMappings[sourceIndex].isIgnored = !updated[groupIndex].sourceMappings[sourceIndex].isIgnored;
    onChangeMappings(updated);
  };

  const handleAddNewColumn = () => {
    const newColName = `Nova Coluna ${mappings.length + 1}`;
    onChangeMappings([
      ...mappings,
      {
        targetColumnName: newColName,
        dataType: 'string',
        sourceMappings: []
      }
    ]);
  };

  const handleDeleteGroup = (index: number) => {
    const groupToDelete = mappings[index];
    if (groupToDelete) {
      const namesToAdd = [
        groupToDelete.targetColumnName,
        ...groupToDelete.sourceMappings.map(sm => sm.originalHeader)
      ];
      setDeletedColumnNames(prev => [...prev, ...namesToAdd]);
    }
    const updated = mappings.filter((_, i) => i !== index);
    onChangeMappings(updated);
  };

  const handleRestoreAllExcluded = () => {
    setDeletedColumnNames([]);
    const updated = mappings.map(group => ({
      ...group,
      sourceMappings: group.sourceMappings.map(sm => ({
        ...sm,
        isIgnored: false
      }))
    }));
    onChangeMappings(updated);
  };

  const activeCount = mappings.filter(m => !m.sourceMappings.every(sm => sm.isIgnored)).length;
  const excludedCount = mappings.length - activeCount;

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
            <span>Etapa 3 de 4</span>
            <span>•</span>
            <span>Unificação & Exclusão de Colunas</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span>Unificação e Exclusão de Colunas</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Acrescentar Consultas (Power Query)</span>
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            As esteiras selecionadas estão sendo unificadas verticalmente. Defina quais colunas deseja <strong>manter ou excluir</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={onResetToPowerQuery}
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors flex items-center gap-1.5"
            title="Apenas agrupa colunas com cabeçalhos exatos entre as esteiras (Padrão Power Query)"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Redefinir Padrão Power Query</span>
          </button>

          <button
            onClick={onApplySynonymGrouping}
            className="px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors flex items-center gap-1.5"
            title="Agrupa colunas usando dicionário de sinônimos (ex: ID_Cliente com ID_Proposta)"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Sugerir por Sinônimos</span>
          </button>

          <button
            onClick={handleAddNewColumn}
            className="px-3.5 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-blue-600" />
            <span>Adicionar Coluna</span>
          </button>
        </div>
      </div>

      {/* Exclusion Preset Configuration Toolbar */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl mb-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <BookmarkPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              Configurações Salvas de Exclusão & Renomeação de Colunas
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Selecione uma configuração salva para excluir e renomear automaticamente as colunas predefinidas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Saved Presets Dropdown */}
          <div className="relative min-w-[240px]">
            <select
              value={selectedPresetId}
              onChange={(e) => handleApplyPreset(e.target.value)}
              className="w-full bg-slate-800 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">-- Selecionar Configuração Salva --</option>
              {exclusionPresets.map(preset => {
                const exclCount = preset.excludedColumns?.length || 0;
                const renCount = preset.renames?.length || 0;
                const info = [];
                if (exclCount > 0) info.push(`${exclCount} excl.`);
                if (renCount > 0) info.push(`${renCount} renom.`);
                const infoStr = info.length > 0 ? info.join(', ') : 'sem regras';
                return (
                  <option key={preset.id} value={preset.id}>
                    {preset.name} ({infoStr})
                  </option>
                );
              })}
            </select>
          </div>

          <button
            onClick={() => setShowSavePresetModal(true)}
            className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
            title="Salvar quais colunas estão atualmente excluídas e renomeadas"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar Configuração Atual</span>
          </button>

          {selectedPresetId && (
            <button
              onClick={(e) => handleDeletePreset(selectedPresetId, e)}
              className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors border border-rose-500/30"
              title="Excluir esta configuração salva"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Save Preset Modal */}
      {showSavePresetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Save className="w-4 h-4 text-amber-500" />
                Salvar Configuração de Exclusão e Renomeação
              </h3>
              <button
                onClick={() => setShowSavePresetModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              A configuração atual salvará tanto as <strong>{excludedCount} colunas excluídas</strong> quanto as <strong>renomeações personalizadas</strong>. Ao aplicar no futuro, a regra primeiro excluirá as colunas salvas e, em seguida, executará as renomeações para evitar conflitos de nomes.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nome da Configuração:
              </label>
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Ex: Excluir Colunas de Auditoria Interna"
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-blue-500"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSavePresetModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveExclusionPreset}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md"
              >
                Salvar Configuração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mappings Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-600">
          <div className="w-1/3">Nome da Coluna Unificada (Base Principal)</div>
          <div className="w-1/5">Tipo de Dado</div>
          <div className="w-1/3">Colunas Mapeadas nas Esteiras de Origem</div>
          <div className="w-24 text-right">Status / Ação</div>
        </div>

        <div className="divide-y divide-slate-100">
          {mappings.map((group, groupIdx) => {
            const isFullyIgnored = group.sourceMappings.length > 0 && group.sourceMappings.every(sm => sm.isIgnored);

            return (
              <div
                key={groupIdx}
                className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                  isFullyIgnored ? 'bg-rose-50/40 opacity-60' : 'hover:bg-slate-50/50'
                }`}
              >
                {/* 1. Target Column Name */}
                <div className="w-full md:w-1/3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={group.targetColumnName}
                      onChange={(e) => handleUpdateTargetName(groupIdx, e.target.value)}
                      className={`w-full text-xs font-bold border rounded-lg px-3 py-1.5 outline-none transition-all ${
                        isFullyIgnored
                          ? 'bg-rose-50 border-rose-200 text-rose-800 line-through'
                          : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'
                      }`}
                      placeholder="Nome do cabeçalho unificado"
                    />
                  </div>
                </div>

                {/* 2. Data Type selector */}
                <div className="w-full md:w-1/5">
                  <select
                    value={group.dataType}
                    onChange={(e) => handleUpdateType(groupIdx, e.target.value as DataType)}
                    disabled={isFullyIgnored}
                    className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 disabled:opacity-50"
                  >
                    <option value="string">Texto (String)</option>
                    <option value="number">Número (Inteiro/Decimal)</option>
                    <option value="currency">Moeda (R$)</option>
                    <option value="date">Data (DD/MM/AAAA)</option>
                    <option value="time">Hora (HH:MM:SS)</option>
                    <option value="status">Status / Categoria</option>
                  </select>
                </div>

                {/* 3. Source Mapping Badges */}
                <div className="w-full md:w-1/3">
                  <div className="flex flex-wrap gap-1.5">
                    {group.sourceMappings.length === 0 ? (
                      <span className="text-[11px] text-slate-400 italic">Coluna criada manualmente</span>
                    ) : (
                      group.sourceMappings.map((sm, smIdx) => (
                        <button
                          key={smIdx}
                          onClick={() => handleToggleSourceIgnored(groupIdx, smIdx)}
                          className={`text-[11px] px-2 py-0.5 rounded border transition-all flex items-center gap-1 ${
                            sm.isIgnored
                              ? 'line-through bg-rose-100/60 text-rose-600 border-rose-200'
                              : 'bg-blue-50 text-blue-800 font-mono border-blue-200 hover:border-blue-300'
                          }`}
                          title={`Aba: ${sm.sheetName}. Clique para ignorar/excluir ou incluir.`}
                        >
                          <span className="text-[9px] text-slate-400 font-sans font-bold">[{sm.sheetName.split('-')[0].trim()}]:</span>
                          <span>{sm.originalHeader}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* 4. Group Actions */}
                <div className="w-full md:w-24 flex items-center justify-end gap-1">
                  <button
                    onClick={() => handleToggleIgnoreGroup(groupIdx)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                      isFullyIgnored
                        ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300'
                        : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                    }`}
                    title={isFullyIgnored ? 'Restaurar coluna na base' : 'Excluir esta coluna da base'}
                  >
                    {isFullyIgnored ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Restaurar</span>
                      </>
                    ) : (
                      <>
                        <Tag className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleDeleteGroup(groupIdx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Remover grupo de colunas completamente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Dedicated Excluded Columns Area (Lixeira de Colunas) */}
      {excludedCount > 0 && (
        <div className="bg-rose-50/70 rounded-2xl border border-rose-200 p-5 mb-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-rose-200">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-700 flex items-center justify-center font-bold shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-950 flex items-center gap-2">
                  <span>Área de Colunas Excluídas</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-200 text-rose-900 font-bold border border-rose-300">
                    {excludedCount} {excludedCount === 1 ? 'coluna excluída' : 'colunas excluídas'}
                  </span>
                </h3>
                <p className="text-xs text-rose-700/90 mt-0.5">
                  Estas colunas foram desativadas e não farão parte da unificação final. Você pode restaurá-las a qualquer momento.
                </p>
              </div>
            </div>

            <button
              onClick={handleRestoreAllExcluded}
              className="px-3.5 py-2 text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-700" />
              <span>Restaurar Todas as Colunas Excluídas</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mappings.map((group, groupIdx) => {
              const isFullyIgnored = group.sourceMappings.length > 0 && group.sourceMappings.every(sm => sm.isIgnored);
              if (!isFullyIgnored) return null;

              return (
                <div
                  key={groupIdx}
                  className="bg-white p-3.5 rounded-xl border border-rose-200 flex items-center justify-between gap-3 shadow-sm hover:border-rose-300 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-rose-900 truncate line-through">
                      {group.targetColumnName}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {group.sourceMappings.map((sm, smIdx) => (
                        <span
                          key={smIdx}
                          className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-100 font-mono"
                        >
                          [{sm.sheetName}]: {sm.originalHeader}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleIgnoreGroup(groupIdx)}
                    className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1 shrink-0 shadow-sm"
                    title="Restaurar esta coluna para a base de dados"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="sticky bottom-4 z-40 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl border border-slate-700/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Columns className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">
              {activeCount} Colunas Ativas na Base Consolidada
            </div>
            <div className="text-xs text-slate-400">
              {excludedCount > 0 ? `${excludedCount} colunas serão excluídas da unificação final.` : 'Nenhuma coluna excluída.'}
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
            disabled={activeCount === 0}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <span>Consolidar Base de Dados</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
};
