import React, { useState, useEffect } from 'react';
import { X, Trash2, Database, AlertTriangle, RefreshCw, CheckCircle2, Calendar, Filter, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SupabaseTable {
  name: string;
  columns: { name: string; type?: string }[];
}

interface ClearSupabaseTableModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatDateDisplayBR(isoDate: string): string {
  if (!isoDate) return '';
  const clean = isoDate.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

export const ClearSupabaseTableModal: React.FC<ClearSupabaseTableModalProps> = ({
  isOpen,
  onClose
}) => {
  const [tables, setTables] = useState<SupabaseTable[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [customTableName, setCustomTableName] = useState('');
  
  // Clear Mode: 'all' | 'period'
  const [clearMode, setClearMode] = useState<'all' | 'period'>('all');
  const [periodStartDate, setPeriodStartDate] = useState<string>('');
  const [periodEndDate, setPeriodEndDate] = useState<string>('');
  const [periodDateColumn, setPeriodDateColumn] = useState<string>('data');

  const [isClearing, setIsClearing] = useState(false);
  const [clearStatus, setClearStatus] = useState('');
  const [clearError, setClearError] = useState<string | null>(null);
  const [clearSuccess, setClearSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      testAndFetchSchema();
    } else {
      // Reset state
      setClearError(null);
      setClearSuccess(false);
      setClearStatus('');
      setIsClearing(false);
    }
  }, [isOpen]);

  const testAndFetchSchema = async () => {
    setIsLoadingTables(true);
    setConnectionError(null);
    const cleanUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '');
    const cleanKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
    if (!cleanUrl || !cleanKey) {
      setConnectionError('Configuração de URL/Key do Supabase ausente no .env');
      setIsLoadingTables(false);
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || cleanKey;
      const openApiRes = await fetch(`${cleanUrl}/rest/v1/?apikey=${cleanKey}`, {
        headers: {
          'apikey': cleanKey,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json, application/openapi+json'
        }
      });
      let discoveredTables: SupabaseTable[] = [];
      if (openApiRes.ok) {
        const swagger = await openApiRes.json();
        const schemas = swagger?.components?.schemas || swagger?.definitions || {};
        Object.keys(schemas).forEach(tableName => {
          if (tableName.startsWith('rpc/') || tableName.startsWith('_')) return;
          const def = schemas[tableName];
          const cols: { name: string; type?: string }[] = [];
          if (def && def.properties) {
            Object.keys(def.properties).forEach(propName => {
              cols.push({ name: propName, type: def.properties[propName].type || 'string' });
            });
          }
          discoveredTables.push({ name: tableName, columns: cols });
        });
        if (swagger && swagger.paths) {
          Object.keys(swagger.paths).forEach(pathKey => {
            if (pathKey.startsWith('/') && pathKey !== '/' && !pathKey.startsWith('/rpc/')) {
              const rawName = pathKey.replace(/^\//, '').split('?')[0];
              if (rawName && !rawName.startsWith('_') && !discoveredTables.some(t => t.name === rawName)) {
                discoveredTables.push({ name: rawName, columns: [] });
              }
            }
          });
        }
      }
      setTables(discoveredTables);
      
      if (discoveredTables.length > 0) {
        if (!selectedTable) {
          setSelectedTable(discoveredTables[0].name);
          handleSelectTable(discoveredTables[0].name, discoveredTables);
        }
      }

    } catch (err: any) {
      setConnectionError(err.message || 'Falha ao buscar tabelas do Supabase.');
    } finally {
      setIsLoadingTables(false);
    }
  };

  const handleSelectTable = (tableName: string, tableList = tables) => {
    setSelectedTable(tableName);
    if (tableName === 'custom') {
      setPeriodDateColumn('data');
      return;
    }
    const t = tableList.find(x => x.name === tableName);
    if (t && t.columns) {
      const colNames = t.columns.map(c => c.name);
      const matchedDataCol = colNames.find(c => c.toLowerCase() === 'data') ||
        colNames.find(c => c.toLowerCase().includes('data') || c.toLowerCase().includes('date') || c.toLowerCase().includes('dt_')) ||
        'data';
      setPeriodDateColumn(matchedDataCol);
    } else {
      setPeriodDateColumn('data');
    }
  };

  const handleSetCurrentMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    setPeriodStartDate(start.toISOString().split('T')[0]);
    setPeriodEndDate(end.toISOString().split('T')[0]);
  };

  const handleSetPreviousMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    setPeriodStartDate(start.toISOString().split('T')[0]);
    setPeriodEndDate(end.toISOString().split('T')[0]);
  };

  const handleStartClear = async () => {
    const activeTableName = selectedTable === 'custom' ? customTableName.trim() : selectedTable;
    if (!activeTableName) {
      alert('Selecione ou digite o nome da tabela de destino.');
      return;
    }

    if (clearMode === 'period') {
      if (!periodStartDate || !periodEndDate) {
        alert('Por favor, selecione a Data Inicial e a Data Final do período a ser excluído.');
        return;
      }
      if (periodStartDate > periodEndDate) {
        alert('A Data Inicial não pode ser posterior à Data Final.');
        return;
      }
      const targetDateCol = (periodDateColumn || 'data').trim();
      if (!targetDateCol) {
        alert('Informe a coluna de data (padrão: data).');
        return;
      }

      const startDisplay = formatDateDisplayBR(periodStartDate);
      const endDisplay = formatDateDisplayBR(periodEndDate);

      setIsClearing(true);
      setClearStatus(`Excluindo registros no período de ${startDisplay} a ${endDisplay}...`);
      setClearError(null);
      setClearSuccess(false);

      try {
        const endOfDayISO = `${periodEndDate}T23:59:59.999Z`;

        let { error: delErr } = await supabase
          .from(activeTableName)
          .delete()
          .gte(targetDateCol, periodStartDate)
          .lte(targetDateCol, endOfDayISO);

        if (delErr) {
          const { error: delErr2 } = await supabase
            .from(activeTableName)
            .delete()
            .gte(targetDateCol, periodStartDate)
            .lte(targetDateCol, periodEndDate);

          if (delErr2) {
            throw new Error(`Erro ao excluir registros do período (${startDisplay} a ${endDisplay}) na coluna "${targetDateCol}": ${delErr2.message || delErr.message}`);
          }
        }

        setClearSuccess(true);
        setClearStatus(`Sucesso! Os registros do período de ${startDisplay} a ${endDisplay} foram removidos da tabela "${activeTableName}".`);
      } catch (err: any) {
        setClearError(err.message || 'Ocorreu um erro ao limpar o período na tabela do Supabase.');
      } finally {
        setIsClearing(false);
      }
    } else {
      // Full clear
      setIsClearing(true);
      setClearStatus(`Excluindo todos os dados da tabela "${activeTableName}"...`);
      setClearError(null);
      setClearSuccess(false);

      try {
        let targetCol = 'id';
        const t = tables.find(x => x.name === activeTableName);
        if (t && t.columns && t.columns.length > 0) {
          targetCol = t.columns[0].name;
        }

        const { error: delErr1 } = await supabase.from(activeTableName).delete().not(targetCol, 'is', null);
        const { error: delErr2 } = await supabase.from(activeTableName).delete().is(targetCol, null);

        if (delErr1 && delErr2) {
          throw new Error(`Erro ao excluir dados da tabela "${activeTableName}": ${delErr1.message || delErr2.message}`);
        }

        setClearSuccess(true);
        setClearStatus(`Sucesso! Todos os registros da tabela "${activeTableName}" foram removidos.`);
      } catch (err: any) {
        setClearError(err.message || 'Ocorreu um erro ao limpar a tabela no Supabase.');
      } finally {
        setIsClearing(false);
      }
    }
  };

  const selectedTableObj = tables.find(t => t.name === selectedTable);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shadow-inner">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                Limpeza de Base de Dados (Supabase)
              </h3>
              <p className="text-[11px] text-slate-400">
                Remova registros por período de datas ou esvazie a tabela completamente.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50/50 space-y-4 max-h-[75vh]">
          {/* Connection Check / Table Selection */}
          {isLoadingTables ? (
            <div className="flex flex-col items-center justify-center py-6 text-slate-500 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
              <span className="text-sm font-medium">Buscando tabelas no Supabase...</span>
            </div>
          ) : connectionError ? (
            <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 text-sm text-rose-700">
              <p className="font-bold flex items-center gap-2 mb-1">
                <X className="w-4 h-4" /> Erro de Conexão
              </p>
              <p className="text-xs">{connectionError}</p>
              <button onClick={testAndFetchSchema} className="mt-3 px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold rounded-lg transition-colors">
                Tentar Novamente
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Table Picker */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Tabela no Supabase para Limpar:
                </label>
                <select
                  value={selectedTable}
                  onChange={(e) => handleSelectTable(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition-all font-medium text-xs text-slate-700"
                >
                  {tables.map(t => (
                    <option key={t.name} value={t.name}>
                      {t.name} ({t.columns.length} colunas mapeadas)
                    </option>
                  ))}
                  <option value="custom">-- Digitar nome da tabela manualmente --</option>
                </select>

                {selectedTable === 'custom' && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <input
                      type="text"
                      value={customTableName}
                      onChange={(e) => setCustomTableName(e.target.value)}
                      placeholder="Ex: base_esteiras"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-rose-500 text-xs font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Mode Selection */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-600" />
                  <span>Tipo de Limpeza:</span>
                </label>
                
                <div className="grid grid-cols-2 gap-2">
                  <label
                    onClick={() => setClearMode('period')}
                    className={`flex flex-col p-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                      clearMode === 'period'
                        ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <input
                        type="radio"
                        name="clearModeType"
                        checked={clearMode === 'period'}
                        onChange={() => setClearMode('period')}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" />
                        <span>Por Período de Datas</span>
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight pl-4">
                      Apaga apenas os registros dentro de um intervalo de datas.
                    </span>
                  </label>

                  <label
                    onClick={() => setClearMode('all')}
                    className={`flex flex-col p-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                      clearMode === 'all'
                        ? 'border-rose-500 bg-rose-50/60 ring-1 ring-rose-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <input
                        type="radio"
                        name="clearModeType"
                        checked={clearMode === 'all'}
                        onChange={() => setClearMode('all')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-xs font-bold text-rose-950 flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Toda a Tabela</span>
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight pl-4">
                      Esvazia todos os registros salvos na tabela.
                    </span>
                  </label>
                </div>

                {/* Period Configuration Details */}
                {clearMode === 'period' && (
                  <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between gap-1 pb-1 border-b border-amber-200/60">
                      <span className="text-[11px] font-bold text-amber-950">Intervalo de Datas:</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={handleSetCurrentMonth}
                          className="px-2 py-0.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-semibold"
                        >
                          Mês Atual
                        </button>
                        <button
                          type="button"
                          onClick={handleSetPreviousMonth}
                          className="px-2 py-0.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-semibold"
                        >
                          Mês Anterior
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-amber-950 mb-1">
                        Coluna de Data (no Supabase):
                      </label>
                      <input
                        type="text"
                        list="clear-supabase-date-cols-list"
                        value={periodDateColumn}
                        onChange={(e) => setPeriodDateColumn(e.target.value)}
                        placeholder="Ex: data"
                        className="w-full text-xs px-2.5 py-1.5 border border-amber-300 rounded-lg outline-none bg-white font-mono"
                      />
                      <datalist id="clear-supabase-date-cols-list">
                        <option value="data" />
                        {selectedTableObj?.columns.map((c, i) => (
                          <option key={i} value={c.name} />
                        ))}
                      </datalist>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-amber-950 mb-1">
                          Data Inicial:
                        </label>
                        <input
                          type="date"
                          value={periodStartDate}
                          onChange={(e) => setPeriodStartDate(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 border border-amber-300 rounded-lg outline-none bg-white font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-amber-950 mb-1">
                          Data Final:
                        </label>
                        <input
                          type="date"
                          value={periodEndDate}
                          onChange={(e) => setPeriodEndDate(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 border border-amber-300 rounded-lg outline-none bg-white font-medium"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Warning Notice */}
              <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200 flex gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900 leading-relaxed">
                  {clearMode === 'period' ? (
                    <span>
                      Registros na coluna <strong>"{periodDateColumn || 'data'}"</strong> entre{' '}
                      <strong>{periodStartDate ? formatDateDisplayBR(periodStartDate) : '...'}</strong> e{' '}
                      <strong>{periodEndDate ? formatDateDisplayBR(periodEndDate) : '...'}</strong> serão permanentemente removidos da tabela selecionada no Supabase.
                    </span>
                  ) : (
                    <span>
                      Todos os registros da tabela selecionada no Supabase serão permanentemente apagados. Os dados da visualização em tela continuarão intactos.
                    </span>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* Clear Status / Errors */}
          {clearError && (
            <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-200 text-xs text-rose-700 animate-in fade-in">
              <p className="font-bold mb-1">Erro ao Limpar Tabela:</p>
              <p className="break-all">{clearError}</p>
            </div>
          )}

          {clearSuccess && (
            <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 text-xs text-emerald-800 animate-in fade-in flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">Operação Concluída com Sucesso!</p>
                <p className="leading-relaxed">{clearStatus}</p>
              </div>
            </div>
          )}

          {isClearing && !clearSuccess && !clearError && (
            <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-200 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                <div>
                  <p className="text-xs font-bold text-blue-900">Excluindo dados...</p>
                  <p className="text-[11px] text-blue-700 mt-0.5">{clearStatus}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isClearing}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
          >
            {clearSuccess ? 'Fechar' : 'Cancelar'}
          </button>
          
          {!clearSuccess && (
            <button
              onClick={handleStartClear}
              disabled={isClearing || isLoadingTables || !!connectionError}
              className={`px-5 py-2 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-[0.98] ${
                clearMode === 'period'
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-rose-600 hover:bg-rose-500'
              } disabled:opacity-50`}
            >
              {isClearing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : clearMode === 'period' ? (
                <>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Limpar Período Selecionado</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Apagar Toda a Tabela</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

