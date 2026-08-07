import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Database, CheckCircle2, AlertCircle, RefreshCw, UploadCloud, Table } from 'lucide-react';
import { SupabaseTable, SupabaseColumnMapping, ConsolidatedRecord } from '../types';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  appColumns: string[];
  recordsToUpload: ConsolidatedRecord[];
  isGroupedView?: boolean;
}

export function toCamelCase(str: string): string {
  if (!str) return '';
  const normalized = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const clean = normalized.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return str.toLowerCase();
  if (words.length === 1) {
    const single = words[0];
    if (single === single.toUpperCase()) return single.toLowerCase();
    return single.charAt(0).toLowerCase() + single.slice(1);
  }
  return words
    .map((w, idx) => {
      const lower = w.toLowerCase();
      if (idx === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

function convertBRDateToISO(val: string): string {
  const str = val.trim();
  if (!str) return str;
  const brRegex = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
  const match = str.match(brRegex);
  if (match) {
    let [, dayStr, monthStr, yearStr, hh, mm, ss] = match;
    let day = parseInt(dayStr, 10);
    let month = parseInt(monthStr, 10);
    let year = parseInt(yearStr, 10);
    if (yearStr.length === 2) year = 2000 + year;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const yyyy = String(year).padStart(4, '0');
      const mmStr = String(month).padStart(2, '0');
      const ddStr = String(day).padStart(2, '0');
      if (hh !== undefined && mm !== undefined) {
        const hhStr = String(hh).padStart(2, '0');
        const minStr = String(mm).padStart(2, '0');
        const ssStr = ss !== undefined ? String(ss).padStart(2, '0') : '00';
        return `${yyyy}-${mmStr}-${ddStr}T${hhStr}:${minStr}:${ssStr}`;
      }
      return `${yyyy}-${mmStr}-${ddStr}`;
    }
  }
  return str;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  appColumns,
  recordsToUpload,
  isGroupedView = false,
}) => {
  const [tables, setTables] = useState<SupabaseTable[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState<boolean>(false);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [customTableName, setCustomTableName] = useState<string>('');
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [columnMappings, setColumnMappings] = useState<SupabaseColumnMapping[]>([]);

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  useEffect(() => {
    if (isOpen) {
      testAndFetchSchema();
    }
  }, [isOpen]);

  useEffect(() => {
    if (appColumns.length > 0) {
      setColumnMappings(prev => {
        return appColumns.map(col => {
          const colCamel = toCamelCase(col);
          const colClean = col.toLowerCase().replace(/[^a-z0-9]/g, '');
          const matchedTarget = tableColumns.find(tc => tc.toLowerCase().replace(/[^a-z0-9]/g, '') === colClean);

          const existing = prev.find(p => p.appColumn === col);
          if (existing) {
            if (matchedTarget && (!existing.supabaseColumn || existing.supabaseColumn === colClean || existing.supabaseColumn === col)) {
              return { ...existing, supabaseColumn: matchedTarget };
            }
            return existing;
          }

          return {
            appColumn: col,
            supabaseColumn: matchedTarget || colCamel
          };
        });
      });
    }
  }, [appColumns, tableColumns]);

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
      setTableColumns([]);
      return;
    }
    const t = tableList.find(x => x.name === tableName);
    if (t && t.columns) {
      setTableColumns(t.columns.map(c => c.name));
    } else {
      setTableColumns([]);
    }
  };

  const handleMappingChange = (appCol: string, targetCol: string) => {
    setColumnMappings(prev =>
      prev.map(m => m.appColumn === appCol ? { ...m, supabaseColumn: targetCol } : m)
    );
  };

  const handleStartUpload = async () => {
    const activeTableName = selectedTable === 'custom' ? customTableName.trim() : selectedTable;
    if (!activeTableName) {
      alert('Selecione ou digite o nome da tabela de destino.');
      return;
    }

    const validMappings = columnMappings.filter(m => m.supabaseColumn && m.supabaseColumn !== '-- IG NORAR --');
    if (validMappings.length === 0) {
      alert('Por favor, relacione pelo menos 1 coluna para subir no Supabase.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Autenticando e preparando envio...');
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const payloads = recordsToUpload.map(rec => {
        const row: Record<string, any> = {};
        validMappings.forEach(map => {
          let val = rec[map.appColumn];
          if (val === undefined || val === null) {
            val = null;
          } else if (typeof val === 'number') {
            val = isNaN(val) ? null : val;
          } else if (typeof val === 'string') {
            val = val.trim();
            if (val === '' || val === '-' || val.toLowerCase() === 'null' || val.toLowerCase() === 'undefined') {
              val = null;
            } else {
              const isoDate = convertBRDateToISO(val);
              if (isoDate !== val) {
                val = isoDate;
              } else if (!isNaN(Number(val)) && !val.includes('/') && !val.includes('-')) {
                val = Number(val);
              }
            }
          }
          row[map.supabaseColumn] = val;
        });
        return row;
      });

      const totalRows = payloads.length;
      const BATCH_SIZE = 100;

      for (let i = 0; i < totalRows; i += BATCH_SIZE) {
        const batch = payloads.slice(i, i + BATCH_SIZE);
        setUploadStatus(`Enviando linhas ${i + 1} até ${Math.min(i + BATCH_SIZE, totalRows)} de ${totalRows}...`);

        const { error } = await supabase.from(activeTableName).insert(batch);

        if (error) {
          throw new Error(`Erro no Supabase (Linhas ${i + 1}-${Math.min(i + BATCH_SIZE, totalRows)}): ${error.message}`);
        }

        setUploadProgress(Math.round(((i + batch.length) / totalRows) * 100));
      }

      setUploadSuccess(true);
      setUploadStatus(`Sucesso! ${totalRows} registros foram inseridos na tabela "${activeTableName}".`);
    } catch (err: any) {
      setUploadError(err.message || 'Ocorreu um erro ao enviar os dados para o Supabase.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                Exportar para Banco de Dados
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          {connectionError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold text-sm block mb-0.5">Erro de conexão:</strong>
                  <span>{connectionError}</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome da Tabela de Destino:
                </label>
                {isLoadingTables ? (
                  <div className="text-xs text-slate-500 flex items-center gap-2 py-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Carregando tabelas do banco...
                  </div>
                ) : tables.length > 0 ? (
                  <div className="flex gap-2">
                    <select
                      value={selectedTable}
                      onChange={(e) => handleSelectTable(e.target.value)}
                      className="w-1/2 text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 font-medium"
                    >
                      {tables.map(t => (
                        <option key={t.name} value={t.name}>{t.name} ({t.columns?.length || 0} colunas)</option>
                      ))}
                      <option value="custom">-- Digitar Nome Manualmente --</option>
                    </select>
                    {selectedTable === 'custom' && (
                      <input
                        type="text"
                        value={customTableName}
                        onChange={(e) => setCustomTableName(e.target.value)}
                        placeholder="Nome exato da tabela"
                        className="w-1/2 text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 font-mono"
                      />
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={customTableName}
                    onChange={(e) => {
                      setCustomTableName(e.target.value);
                      setSelectedTable('custom');
                    }}
                    placeholder="Nome exato da tabela"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 font-mono"
                  />
                )}
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 grid grid-cols-12 gap-4">
                <div className="col-span-6">Coluna no App</div>
                <div className="col-span-1 text-center"></div>
                <div className="col-span-5">Coluna no Supabase</div>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 bg-white">
                {columnMappings.map(mapItem => (
                  <div key={mapItem.appColumn} className="px-4 py-2 text-xs grid grid-cols-12 gap-4 items-center hover:bg-slate-50 transition-colors">
                    <div className="col-span-6 font-medium text-slate-700 truncate" title={mapItem.appColumn}>
                      {mapItem.appColumn}
                    </div>
                    <div className="col-span-1 flex justify-center text-slate-300">
                      →
                    </div>
                    <div className="col-span-5">
                      {tableColumns.length > 0 ? (
                        <select
                          value={mapItem.supabaseColumn}
                          onChange={(e) => handleMappingChange(mapItem.appColumn, e.target.value)}
                          className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-md outline-none focus:border-emerald-500 font-mono bg-white"
                        >
                          <option value="-- IG NORAR --" className="text-slate-400 italic">-- NÃO ENVIAR (Ignorar) --</option>
                          {tableColumns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                          {!tableColumns.includes(mapItem.supabaseColumn) && mapItem.supabaseColumn !== '-- IG NORAR --' && (
                            <option value={mapItem.supabaseColumn}>{mapItem.supabaseColumn}</option>
                          )}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={mapItem.supabaseColumn}
                          onChange={(e) => handleMappingChange(mapItem.appColumn, e.target.value)}
                          placeholder="Nome da coluna"
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 font-mono"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {isUploading && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                  <span>{uploadStatus}</span>
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2.5 bg-emerald-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {uploadSuccess && (
            <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-sm block mb-0.5">Sincronização Concluída!</strong>
                <span>{uploadStatus}</span>
              </div>
            </div>
          )}

          {uploadError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-sm block mb-0.5">Erro durante o envio:</strong>
                <span>{uploadError}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleStartUpload}
              disabled={isUploading || recordsToUpload.length === 0}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all"
            >
              <UploadCloud className="w-4 h-4" />
              <span>{isUploading ? 'Enviando...' : `Subir ${recordsToUpload.length} Registros`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
