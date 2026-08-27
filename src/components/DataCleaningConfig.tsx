import React, { useState, useEffect } from 'react';
import { ConsolidationConfig, GroupedColumnMapping, ConsolidationFilterRule, ConsolidationFilterOperator, FilterPreset } from '../types';
import { Settings2, ShieldCheck, Sparkles, Filter, Trash2, Calendar, DollarSign, Layers, ArrowRight, Plus, HelpCircle, Save, FolderOpen, BookmarkPlus } from 'lucide-react';
import { saveToFirebase, loadFromFirebase } from '../lib/firebase';

interface DataCleaningConfigProps {
  config: ConsolidationConfig;
  onChangeConfig: (updated: ConsolidationConfig) => void;
  availableColumns: GroupedColumnMapping[];
  onConsolidate: () => void;
  onBack: () => void;
}

const FILTER_STORAGE_KEY = 'esteiras_filter_presets';

export const DataCleaningConfig: React.FC<DataCleaningConfigProps> = ({
  config,
  onChangeConfig,
  availableColumns,
  onConsolidate,
  onBack
}) => {
  const activeColumnNames = availableColumns
    .filter(g => !g.sourceMappings.every(sm => sm.isIgnored))
    .map(g => g.targetColumnName);

  const filterConfig = config.filterConfig || {
    enabled: false,
    matchLogic: 'AND',
    rules: []
  };

  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>(() => {
    try {
      const cached = localStorage.getItem(FILTER_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [selectedFilterPresetId, setSelectedFilterPresetId] = useState<string>('');
  const [presetSaveName, setPresetSaveName] = useState<string>('');

  useEffect(() => {
    const loadPresets = async () => {
      try {
        const fb = await loadFromFirebase<FilterPreset[]>(FILTER_STORAGE_KEY);
        if (fb && Array.isArray(fb) && fb.length > 0) {
          setFilterPresets(fb);
          localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(fb));
        }
      } catch (e) {
        console.error('Error loading filter presets in DataCleaningConfig:', e);
      }
    };
    loadPresets();
  }, []);

  const updateAndSaveFilterPresets = (updated: FilterPreset[]) => {
    setFilterPresets(updated);
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    saveToFirebase(FILTER_STORAGE_KEY, updated);
  };

  const handleSaveFilterPreset = () => {
    if (!presetSaveName.trim()) {
      alert('Informe um nome para salvar esta configuração de filtros.');
      return;
    }
    if (filterConfig.rules.length === 0) {
      alert('Adicione ao menos uma regra de filtro antes de salvar.');
      return;
    }

    const newPreset: FilterPreset = {
      id: `filter-${Date.now()}`,
      name: presetSaveName.trim(),
      rules: filterConfig.rules,
      matchLogic: filterConfig.matchLogic
    };

    const updated = [...filterPresets, newPreset];
    updateAndSaveFilterPresets(updated);
    setSelectedFilterPresetId(newPreset.id);
    setPresetSaveName('');
    alert(`Configuração de filtros "${newPreset.name}" salva com sucesso!`);
  };

  const handleSelectFilterPreset = (presetId: string) => {
    setSelectedFilterPresetId(presetId);
    if (!presetId) return;

    const preset = filterPresets.find(p => p.id === presetId);
    if (preset) {
      if (preset.rules && preset.rules.length > 0) {
        onChangeConfig({
          ...config,
          filterConfig: {
            enabled: true,
            matchLogic: preset.matchLogic || 'AND',
            rules: preset.rules
          }
        });
      }
    }
  };

  const handleDeleteFilterPreset = (presetId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!presetId) return;
    const target = filterPresets.find(p => p.id === presetId);
    if (!target) return;

    const updated = filterPresets.filter(p => p.id !== presetId);
    updateAndSaveFilterPresets(updated);
    if (selectedFilterPresetId === presetId) {
      setSelectedFilterPresetId('');
    }
  };

  const handleToggleFilter = (enabled: boolean) => {
    const currentRules = filterConfig.rules.length > 0 ? filterConfig.rules : [
      { id: `rule-${Date.now()}`, column: activeColumnNames[0] || 'ALL', operator: 'equals', value: '' }
    ];
    onChangeConfig({
      ...config,
      filterConfig: {
        ...filterConfig,
        enabled,
        rules: currentRules
      }
    });
  };

  const handleSetMatchLogic = (matchLogic: 'AND' | 'OR') => {
    onChangeConfig({
      ...config,
      filterConfig: {
        ...filterConfig,
        matchLogic
      }
    });
  };

  const handleAddFilterRule = () => {
    const newRule: ConsolidationFilterRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      column: activeColumnNames[0] || 'ALL',
      operator: 'equals',
      value: ''
    };
    onChangeConfig({
      ...config,
      filterConfig: {
        ...filterConfig,
        enabled: true,
        rules: [...filterConfig.rules, newRule]
      }
    });
  };

  const handleRemoveFilterRule = (ruleId: string) => {
    const updatedRules = filterConfig.rules.filter(r => r.id !== ruleId);
    onChangeConfig({
      ...config,
      filterConfig: {
        ...filterConfig,
        rules: updatedRules
      }
    });
  };

  const handleUpdateFilterRule = (ruleId: string, field: keyof ConsolidationFilterRule, value: any) => {
    const updatedRules = filterConfig.rules.map(r => r.id === ruleId ? { ...r, [field]: value } : r);
    onChangeConfig({
      ...config,
      filterConfig: {
        ...filterConfig,
        rules: updatedRules
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
          <span>Etapa 4 de 5</span>
          <span>•</span>
          <span>Higienização e Padronização</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-900">
          Regras de Limpeza, Filtro e Tratamento da Base
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure as regras automáticas de desduplicação, filtros avançados de registros, limpeza de texto, formatação de datas e rotulagem de origem para garantir uma base de alta qualidade.
        </p>
      </div>

      <div className="space-y-6 mb-8">
        
        {/* Rule 1: Origin Column Naming */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900">Coluna de Rastreabilidade da Esteira</h3>
              <p className="text-xs text-slate-500 mb-3">
                Nome da coluna que será inserida em todas as linhas indicando a aba de origem do registro.
              </p>
              <input
                type="text"
                value={config.esteiraColumnName}
                onChange={(e) => onChangeConfig({ ...config, esteiraColumnName: e.target.value })}
                className="w-full max-w-md text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                placeholder="Ex: Esteira / Origem"
              />
            </div>
          </div>
        </div>

        {/* Rule 2: Deduplication */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Remover Registros Duplicados</h3>
                  <p className="text-xs text-slate-500">
                    Evita que o mesmo cliente/operação apareça repetido se estiver em mais de uma esteira.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.deduplicate}
                  onChange={(e) => onChangeConfig({ ...config, deduplicate: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {config.deduplicate && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Coluna Chave para Identificar Duplicatas:
                  </label>
                  <select
                    value={config.dedupeKey}
                    onChange={(e) => onChangeConfig({ ...config, dedupeKey: e.target.value })}
                    className="w-full max-w-md text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                  >
                    <option value="ALL">Qualquer linha exatamente idêntica (Todas as Colunas)</option>
                    {activeColumnNames.map((colName, i) => (
                      <option key={i} value={colName}>
                        Campo Chave: {colName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rule 3: Custom Data Filters */}
        <div className={`p-5 rounded-2xl border transition-all ${filterConfig.enabled ? 'bg-purple-50/40 border-purple-300 shadow-md ring-2 ring-purple-500/20' : 'bg-white border-purple-200 hover:border-purple-300 shadow-sm'}`}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Filter className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Filtros Personalizados da Base</span>
                    {filterConfig.enabled ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-600 text-white">
                        {filterConfig.rules.length} filtro(s) ativo(s)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        Inativo
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Filtre quais linhas serão mantidas na base consolidada final com base em condições de texto, números ou datas.
                  </p>
                </div>
                
                <button
                  type="button"
                  onClick={() => handleToggleFilter(!filterConfig.enabled)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 ${
                    filterConfig.enabled 
                      ? 'bg-purple-700 hover:bg-purple-800 text-white shadow-xs' 
                      : 'bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{filterConfig.enabled ? 'Filtros Ativados' : 'Ativar Filtros de Base'}</span>
                </button>
              </div>

              {filterConfig.enabled ? (
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-4">
                  {/* Saved Filter Presets Dropdown */}
                  <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-200/70 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-purple-950">
                      <span className="flex items-center gap-1.5">
                        <FolderOpen className="w-3.5 h-3.5 text-purple-600" />
                        <span>Configurações de Filtros Salvas:</span>
                      </span>
                      {selectedFilterPresetId && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteFilterPreset(selectedFilterPresetId, e)}
                          className="text-[11px] text-rose-600 hover:underline font-semibold flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Excluir Configuração</span>
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={selectedFilterPresetId}
                        onChange={(e) => handleSelectFilterPreset(e.target.value)}
                        className="flex-1 text-xs font-semibold px-3 py-2 border border-purple-300 rounded-lg bg-white outline-none focus:border-purple-600 shadow-xs"
                      >
                        <option value="">-- Carregar configuração de filtro salva --</option>
                        {filterPresets.map(preset => {
                          const ruleCount = preset.rules ? preset.rules.length : (preset.columnFilters ? Object.keys(preset.columnFilters).length : 0);
                          return (
                            <option key={preset.id} value={preset.id}>
                              {preset.name} ({ruleCount} regra(s))
                            </option>
                          );
                        })}
                      </select>
                      {selectedFilterPresetId && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteFilterPreset(selectedFilterPresetId, e)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors shrink-0"
                          title="Excluir esta configuração de filtros salva"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Logic match selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-50/60 p-3 rounded-xl border border-purple-100">
                    <span className="text-xs font-bold text-purple-900">
                      Lógica de Aplicação dos Filtros:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSetMatchLogic('AND')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          filterConfig.matchLogic === 'AND'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-purple-100 border border-purple-200'
                        }`}
                      >
                        Atender TODAS (E / AND)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetMatchLogic('OR')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          filterConfig.matchLogic === 'OR'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-purple-100 border border-purple-200'
                        }`}
                      >
                        Atender QUALQUER (OU / OR)
                      </button>
                    </div>
                  </div>

                  {/* Filter rules list */}
                  <div className="space-y-3">
                    {filterConfig.rules.map((rule, idx) => {
                      const isNoValOperator = rule.operator === 'is_empty' || rule.operator === 'is_not_empty';
                      return (
                        <div
                          key={rule.id}
                          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-xs"
                        >
                          <span className="text-[11px] font-bold text-slate-400 min-w-[20px]">
                            #{idx + 1}
                          </span>

                          {/* Target Column */}
                          <div className="flex-1 min-w-[160px]">
                            <select
                              value={rule.column}
                              onChange={(e) => handleUpdateFilterRule(rule.id, 'column', e.target.value)}
                              className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-purple-500"
                            >
                              <option value="ALL">Todas as Colunas (Busca Geral)</option>
                              <option value={config.esteiraColumnName || 'Esteira / Origem'}>
                                {config.esteiraColumnName || 'Esteira / Origem'} (Origem)
                              </option>
                              {activeColumnNames.map((col, i) => (
                                <option key={i} value={col}>
                                  {col}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Operator */}
                          <div className="w-full sm:w-44">
                            <select
                              value={rule.operator}
                              onChange={(e) => handleUpdateFilterRule(rule.id, 'operator', e.target.value as ConsolidationFilterOperator)}
                              className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-purple-500"
                            >
                              <option value="equals">É igual a</option>
                              <option value="not_equals">É diferente de</option>
                              <option value="contains">Contém</option>
                              <option value="not_contains">Não contém</option>
                              <option value="starts_with">Começa com</option>
                              <option value="ends_with">Termina com</option>
                              <option value="greater_than">Maior que (&gt;)</option>
                              <option value="less_than">Menor que (&lt;)</option>
                              <option value="is_empty">Está em branco / vazio</option>
                              <option value="is_not_empty">Preenchido / Não vazio</option>
                            </select>
                          </div>

                          {/* Value Input */}
                          {!isNoValOperator && (
                            <div className="flex-1 min-w-[140px]">
                              <input
                                type="text"
                                value={rule.value}
                                onChange={(e) => handleUpdateFilterRule(rule.id, 'value', e.target.value)}
                                placeholder="Valor para filtrar..."
                                className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-purple-500"
                              />
                            </div>
                          )}

                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveFilterRule(rule.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 self-end sm:self-center"
                            title="Remover esta regra de filtro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Rule Button */}
                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleAddFilterRule}
                      className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Nova Condição de Filtro</span>
                    </button>

                    <p className="text-[11px] text-slate-400">
                      * Linhas que não atenderem aos filtros serão ignoradas na consolidação.
                    </p>
                  </div>

                  {/* Save Filter Preset Box */}
                  <div className="pt-3 border-t border-purple-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex-1 w-full">
                      <input
                        type="text"
                        value={presetSaveName}
                        onChange={(e) => setPresetSaveName(e.target.value)}
                        placeholder="Nome para salvar esta configuração de filtros (Ex: Somente Aprovados SP)"
                        className="w-full text-xs px-3 py-2 border border-purple-200 rounded-lg outline-none focus:border-purple-600 bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveFilterPreset}
                      disabled={filterConfig.rules.length === 0}
                      className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shrink-0 transition-colors shadow-xs"
                      title="Salvar estas regras de filtro como uma configuração reutilizável"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Salvar Configuração de Filtro</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 p-3.5 bg-purple-100/60 border border-purple-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-purple-900">
                  <span className="font-medium">
                    Deseja filtrar linhas por texto, coluna específica ou valor antes de gerar a consolidação?
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleFilter(true)}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs shrink-0"
                  >
                    Ativar e Configurar Filtros
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rule 4: Text & Formatting Options */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Padronização de Formato</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                
                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.trimWhitespace}
                    onChange={(e) => onChangeConfig({ ...config, trimWhitespace: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Remover Espaços Extras</span>
                    <span className="text-[11px] text-slate-500">Trim no início/fim de textos</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.removeEmptyRows}
                    onChange={(e) => onChangeConfig({ ...config, removeEmptyRows: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Descartar Linhas 100% Vazias</span>
                    <span className="text-[11px] text-slate-500">Filtrar linhas em branco da planilha</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.standardizeDates}
                    onChange={(e) => onChangeConfig({ ...config, standardizeDates: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Padronizar Datas</span>
                    <span className="text-[11px] text-slate-500">Converter tudo para DD/MM/AAAA</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.standardizeCurrency}
                    onChange={(e) => onChangeConfig({ ...config, standardizeCurrency: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Padronizar Valores Monetários</span>
                    <span className="text-[11px] text-slate-500">Tratar R$, pontos e vírgulas</span>
                  </div>
                </label>

              </div>

              {/* Fill missing values */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Texto para Preencher Células Sem Informação:
                </label>
                <input
                  type="text"
                  value={config.fillMissingValue}
                  onChange={(e) => onChangeConfig({ ...config, fillMissingValue: e.target.value })}
                  className="w-48 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 outline-none focus:border-blue-500"
                  placeholder="Ex: - ou N/A"
                />
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* Navigation Footer */}
      <div className="sticky bottom-4 z-40 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl border border-slate-700/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">
              Tudo Pronto para Consolidar!
            </div>
            <div className="text-xs text-slate-300">
              O sistema irá gerar a base principal unificada e o relatório analítico
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
            onClick={onConsolidate}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all"
          >
            <span>Gerar Base de Dados Principal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
};
