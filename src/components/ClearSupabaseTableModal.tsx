import React, { useState, useEffect } from 'react';
import { X, Trash2, Database, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SupabaseTable {
  name: string;
  columns: { name: string; type?: string }[];
}

interface ClearSupabaseTableModalProps {
  isOpen: boolean;
  onClose: () => void;
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
        }
      }

    } catch (err: any) {
      setConnectionError(err.message || 'Falha ao buscar tabelas do Supabase.');
    } finally {
      setIsLoadingTables(false);
    }
  };

  const handleStartClear = async () => {
    const activeTableName = selectedTable === 'custom' ? customTableName.trim() : selectedTable;
    if (!activeTableName) {
      alert('Selecione ou digite o nome da tabela de destino.');
      return;
    }

    if (!confirm(`TEM CERTEZA? Isso irá apagar TODOS os registros da tabela "${activeTableName}" no banco de dados. Esta ação não pode ser desfeita.`)) {
      return;
    }

    setIsClearing(true);
    setClearStatus(`Excluindo dados da tabela "${activeTableName}"...`);
    setClearError(null);
    setClearSuccess(false);

    try {
      // Find a column to use for the deletion filter, since Supabase often requires one
      let targetCol = 'id';
      const t = tables.find(x => x.name === activeTableName);
      if (t && t.columns && t.columns.length > 0) {
        targetCol = t.columns[0].name;
      }

      // We run two deletes to catch both null and non-null values for the target column
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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shadow-inner">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                Limpar Tabela do Banco de Dados
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50/50">
          <div className="space-y-6">

            {/* Warning Box */}
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-sm text-amber-900">
                <p className="font-bold mb-1">Atenção!</p>
                <p className="text-amber-800 leading-relaxed text-xs">
                  Esta ação irá apagar <strong>todos os registros</strong> da tabela selecionada no Supabase. Os dados da tabela consolida nesta tela continuarão intactos, mas o banco de dados será esvaziado.
                </p>
              </div>
            </div>

            {/* Connection Check / Table Selection */}
            {isLoadingTables ? (
              <div className="flex flex-col items-center justify-center py-6 text-slate-500 gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
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
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-800">
                    Selecione a Tabela no Supabase para Limpar
                  </label>
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200 transition-all font-medium text-slate-700"
                  >
                    {tables.map(t => (
                      <option key={t.name} value={t.name}>
                        {t.name} ({t.columns.length} colunas mapeadas)
                      </option>
                    ))}
                    <option value="custom">-- Digitar nome da tabela manualmente --</option>
                  </select>
                </div>

                {selectedTable === 'custom' && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="block text-sm font-bold text-slate-800">
                      Nome Exato da Tabela
                    </label>
                    <input
                      type="text"
                      value={customTableName}
                      onChange={(e) => setCustomTableName(e.target.value)}
                      placeholder="Ex: base_clientes_final"
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200 transition-all"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Clear Status / Errors */}
            {clearError && (
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 text-sm text-rose-700 animate-in fade-in">
                <p className="font-bold mb-1">Erro ao Limpar Tabela:</p>
                <p className="text-xs break-all">{clearError}</p>
              </div>
            )}

            {clearSuccess && (
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-sm text-emerald-800 animate-in fade-in flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-1">Tabela Limpa com Sucesso!</p>
                  <p className="text-xs leading-relaxed">{clearStatus}</p>
                </div>
              </div>
            )}

            {isClearing && !clearSuccess && !clearError && (
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                  <div>
                    <p className="text-sm font-bold text-blue-900">Excluindo dados...</p>
                    <p className="text-xs text-blue-700 mt-0.5">{clearStatus}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isClearing}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
          >
            {clearSuccess ? 'Fechar' : 'Cancelar'}
          </button>
          
          {!clearSuccess && (
            <button
              onClick={handleStartClear}
              disabled={isClearing || isLoadingTables || !!connectionError}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              {isClearing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Limpando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Apagar Tudo
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
