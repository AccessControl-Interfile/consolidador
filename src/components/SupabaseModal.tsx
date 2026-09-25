import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Database, CheckCircle2, AlertCircle, RefreshCw, UploadCloud, Table, Calendar, Trash2, Sparkles, Filter, Info } from 'lucide-react';
import { SupabaseTable, SupabaseColumnMapping, ConsolidatedRecord } from '../types';
import { parseNumericValue } from '../utils/consolidator';

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

function formatDateDisplayBR(isoDate: string): string {
  if (!isoDate) return '';
  const clean = isoDate.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
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
  
  // Cleanup Mode: 'none' | 'period' | 'all'
  const [cleanupMode, setCleanupMode] = useState<'none' | 'period' | 'all'>('none');
  const [periodStartDate, setPeriodStartDate] = useState<string>('');
  const [periodEndDate, setPeriodEndDate] = useState<string>('');
  const [periodDateColumn, setPeriodDateColumn] = useState<string>('data');

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  useEffect(() => {
    if (isOpen) {
      testAndFetchSchema();
      // Try to auto-detect date range from records
      detectDateRangeFromRecords();
    }
  }, [isOpen]);

  const detectDateRangeFromRecords = () => {
    if (!recordsToUpload || recordsToUpload.length === 0) return;

    // Find date columns in appColumns
    const dateCandidates = appColumns.filter(c => {
      const low = c.toLowerCase();
      return low.includes('data') || low.includes('date') || low.includes('dt') || low.includes('periodo') || low.includes('referencia');
    });

    const colsToSearch = dateCandidates.length > 0 ? dateCandidates : appColumns;

    for (const col of colsToSearch) {
      let minD: string | null = null;
      let maxD: string | null = null;
      let validDatesFound = 0;

      for (const rec of recordsToUpload) {
        const val = rec[col];
        if (val !== undefined && val !== null) {
          const str = String(val).trim();
          const iso = convertBRDateToISO(str).split('T')[0];
          if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
            validDatesFound++;
            if (!minD || iso < minD) minD = iso;
            if (!maxD || iso > maxD) maxD = iso;
          }
        }
      }

      if (validDatesFound > 0 && minD && maxD) {
        setPeriodStartDate(minD);
        setPeriodEndDate(maxD);
        return;
      }
    }
  };

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

  const fetchColumnsDirectly = async (tableName: string) => {
    const cleanName = tableName.trim();
    if (!cleanName || cleanName === 'custom') return;
    try {
      const { data, error } = await supabase.from(cleanName).select('*').limit(1);
      if (!error && data && data.length > 0 && data[0]) {
        const discovered = Object.keys(data[0]);
        if (discovered.length > 0) {
          setTableColumns(discovered);
          const matchedDataCol = discovered.find(c => c.toLowerCase() === 'data') ||
            discovered.find(c => c.toLowerCase().includes('data') || c.toLowerCase().includes('date') || c.toLowerCase().includes('dt_')) ||
            'data';
          setPeriodDateColumn(matchedDataCol);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleSelectTable = (tableName: string, tableList = tables) => {
    setSelectedTable(tableName);
    if (tableName === 'custom') {
      setTableColumns([]);
      setPeriodDateColumn('data');
      if (customTableName.trim()) {
        fetchColumnsDirectly(customTableName.trim());
      }
      return;
    }
    const t = tableList.find(x => x.name === tableName);
    if (t && t.columns && t.columns.length > 0) {
      const colNames = t.columns.map(c => c.name);
      setTableColumns(colNames);
      
      // Auto-detect 'data' or similar date column in table
      const matchedDataCol = colNames.find(c => c.toLowerCase() === 'data') ||
        colNames.find(c => c.toLowerCase().includes('data') || c.toLowerCase().includes('date') || c.toLowerCase().includes('dt_')) ||
        'data';
      setPeriodDateColumn(matchedDataCol);
    } else {
      setTableColumns([]);
      setPeriodDateColumn('data');
      fetchColumnsDirectly(tableName);
    }
  };

  const handleMappingChange = (appCol: string, targetCol: string) => {
    setColumnMappings(prev =>
      prev.map(m => m.appColumn === appCol ? { ...m, supabaseColumn: targetCol } : m)
    );
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

    // Validate period cleanup if active
    if (cleanupMode === 'period') {
      if (!periodStartDate || !periodEndDate) {
        alert('Por favor, defina a Data Inicial e a Data Final para o período de limpeza da base.');
        return;
      }
      if (periodStartDate > periodEndDate) {
        alert('A Data Inicial não pode ser posterior à Data Final.');
        return;
      }
      const targetDateCol = (periodDateColumn || 'data').trim();
      if (!targetDateCol) {
        alert('Informe a coluna de data a ser considerada para exclusão no Supabase (padrão: data).');
        return;
      }
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Autenticando e preparando envio...');
    setUploadError(null);
    setUploadSuccess(false);

    try {
      // 1. EXECUTE CLEANUP IF REQUESTED
      if (cleanupMode === 'period') {
        const targetDateCol = (periodDateColumn || 'data').trim();
        const startDisplay = formatDateDisplayBR(periodStartDate);
        const endDisplay = formatDateDisplayBR(periodEndDate);
        
        setUploadStatus(`Limpando registros existentes no período de ${startDisplay} a ${endDisplay} na tabela "${activeTableName}" (coluna "${targetDateCol}")...`);
        
        // Deletion query in Supabase (handles timestamp end-of-day as well as date formats)
        const endOfDayISO = `${periodEndDate}T23:59:59.999Z`;

        // First attempt with ISO timestamp bounds
        let { error: delErr } = await supabase
          .from(activeTableName)
          .delete()
          .gte(targetDateCol, periodStartDate)
          .lte(targetDateCol, endOfDayISO);

        if (delErr) {
          // Fallback attempt with pure date string bounds for strict SQL DATE columns
          const { error: delErr2 } = await supabase
            .from(activeTableName)
            .delete()
            .gte(targetDateCol, periodStartDate)
            .lte(targetDateCol, periodEndDate);

          if (delErr2) {
            throw new Error(`Erro ao excluir registros do período (${startDisplay} a ${endDisplay}) na coluna "${targetDateCol}": ${delErr2.message || delErr.message}`);
          }
        }
      } else if (cleanupMode === 'all') {
        setUploadStatus(`Excluindo todos os dados existentes da tabela "${activeTableName}"...`);
        const targetCol = validMappings[0]?.supabaseColumn || 'id';

        const { error: delErr1 } = await supabase.from(activeTableName).delete().not(targetCol, 'is', null);
        const { error: delErr2 } = await supabase.from(activeTableName).delete().is(targetCol, null);

        if (delErr1 && delErr2) {
          throw new Error(`Erro ao excluir dados antigos da tabela "${activeTableName}": ${delErr1.message || delErr2.message}`);
        }
      }

      // 2. CONSTRUCT PAYLOAD AND INSERT RECORDS
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
              } else if (!val.includes('/')) {
                // Convert numeric string (with comma or period) to real American float/int
                const parsedNum = parseNumericValue(val);
                if (typeof parsedNum === 'number' && !isNaN(parsedNum)) {
                  val = parsedNum;
                } else if (!isNaN(Number(val)) && !val.includes('-')) {
                  val = Number(val);
                }
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
        setUploadStatus(`Enviando registros ${i + 1} até ${Math.min(i + BATCH_SIZE, totalRows)} de ${totalRows}...`);

        const { error } = await supabase.from(activeTableName).insert(batch);

        if (error) {
          if (error.code === '22P02' && (error.message.includes('bigint') || error.message.includes('integer'))) {
            throw new Error(
              `Erro no banco Supabase: Uma coluna na tabela "${activeTableName}" está configurada como Inteiro (bigint/integer) e rejeitou valores com casas decimais.\n` +
              `Mensagem do banco: "${error.message}".\n\n` +
              `👉 Para corrigir e permitir decimais como 0.94 ou 1.03, altere o tipo da coluna no Supabase para 'numeric' ou 'double precision', ou execute no SQL Editor do Supabase:\n` +
              `ALTER TABLE ${activeTableName} ALTER COLUMN <nome_da_coluna> TYPE numeric USING <nome_da_coluna>::numeric;`
            );
          }
          throw new Error(`Erro no Supabase (Registros ${i + 1}-${Math.min(i + BATCH_SIZE, totalRows)}): ${error.message}`);
        }

        setUploadProgress(Math.round(((i + batch.length) / totalRows) * 100));
      }

      setUploadSuccess(true);
      let successMsg = `${totalRows} registros inseridos com sucesso na tabela "${activeTableName}".`;
      if (cleanupMode === 'period') {
        successMsg = `Período (${formatDateDisplayBR(periodStartDate)} a ${formatDateDisplayBR(periodEndDate)}) limpo e ${totalRows} novos registros inseridos na tabela "${activeTableName}".`;
      } else if (cleanupMode === 'all') {
        successMsg = `Tabela "${activeTableName}" limpa e ${totalRows} novos registros gravados com sucesso.`;
      }
      setUploadStatus(successMsg);
    } catch (err: any) {
      setUploadError(err.message || 'Ocorreu um erro ao enviar os dados para o Supabase.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                Exportar para Banco de Dados (Supabase)
              </h3>
              <p className="text-[11px] text-slate-400">
                Selecione a tabela de destino, defina as regras de limpeza e mapeie os campos antes de enviar.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
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

          {/* Destination Table Selection */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Table className="w-4 h-4 text-emerald-600" />
                <span>Tabela de Destino no Supabase:</span>
              </label>
              {isLoadingTables ? (
                <div className="text-xs text-slate-500 flex items-center gap-2 py-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" /> Carregando tabelas do banco...
                </div>
              ) : tables.length > 0 ? (
                <div className="flex gap-2">
                  <select
                    value={selectedTable}
                    onChange={(e) => handleSelectTable(e.target.value)}
                    className="w-1/2 text-xs px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 font-medium bg-white shadow-sm"
                  >
                    {tables.map(t => (
                      <option key={t.name} value={t.name}>{t.name} ({t.columns?.length || 0} colunas mapeadas)</option>
                    ))}
                    <option value="custom">-- Digitar Nome Manualmente --</option>
                  </select>
                  {selectedTable === 'custom' && (
                    <input
                      type="text"
                      value={customTableName}
                      onChange={(e) => {
                        setCustomTableName(e.target.value);
                        fetchColumnsDirectly(e.target.value);
                      }}
                      onBlur={() => fetchColumnsDirectly(customTableName)}
                      placeholder="Nome exato da tabela no Supabase"
                      className="w-1/2 text-xs px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 font-mono bg-white shadow-sm"
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
                    fetchColumnsDirectly(e.target.value);
                  }}
                  onBlur={() => fetchColumnsDirectly(customTableName)}
                  placeholder="Nome exato da tabela no Supabase (ex: base_esteiras)"
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 font-mono bg-white shadow-sm"
                />
              )}
            </div>
          </div>

          {/* Database Cleaning Strategy Section */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-indigo-600" />
                <span>Opções de Limpeza de Base (Antes de Subir os Dados)</span>
              </label>
              <span className="text-[10px] text-slate-500 font-medium">Escolha como tratar os registros existentes no banco</span>
            </div>

            {/* Mode selection radio cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              
              {/* Option 1: No cleaning */}
              <label
                onClick={() => setCleanupMode('none')}
                className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all select-none ${
                  cleanupMode === 'none'
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="cleanupMode"
                    checked={cleanupMode === 'none'}
                    onChange={() => setCleanupMode('none')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Apenas Inserir</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug pl-5">
                  Mantém todos os dados atuais da tabela e anexa os novos registros.
                </p>
              </label>

              {/* Option 2: Date Period Cleaning */}
              <label
                onClick={() => setCleanupMode('period')}
                className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all select-none ${
                  cleanupMode === 'period'
                    ? 'border-amber-500 bg-amber-50/50 shadow-sm ring-1 ring-amber-500'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="cleanupMode"
                    checked={cleanupMode === 'period'}
                    onChange={() => setCleanupMode('period')}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>Limpar por Período</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug pl-5">
                  Exclui apenas os dados do intervalo de datas selecionado antes de subir.
                </p>
              </label>

              {/* Option 3: Full Clean (Overwrite) */}
              <label
                onClick={() => setCleanupMode('all')}
                className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all select-none ${
                  cleanupMode === 'all'
                    ? 'border-rose-500 bg-rose-50/50 shadow-sm ring-1 ring-rose-500'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="cleanupMode"
                    checked={cleanupMode === 'all'}
                    onChange={() => setCleanupMode('all')}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs font-bold text-rose-900 flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Limpar Toda a Tabela</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug pl-5">
                  Apaga todos os registros atuais da tabela (Sobrescrever tudo).
                </p>
              </label>

            </div>

            {/* Period Details Sub-Panel (when period mode is active) */}
            {cleanupMode === 'period' && (
              <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-200 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-amber-200/70">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-700" />
                    <span>Configuração do Intervalo de Limpeza:</span>
                  </span>
                  
                  {/* Quick Shortcuts */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={detectDateRangeFromRecords}
                      className="px-2 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-xs"
                      title="Calcular período automaticamente a partir dos dados da planilha atual"
                    >
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>Detectar da Planilha</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSetCurrentMonth}
                      className="px-2 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[11px] font-semibold transition-colors shadow-xs"
                    >
                      Mês Atual
                    </button>
                    <button
                      type="button"
                      onClick={handleSetPreviousMonth}
                      className="px-2 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[11px] font-semibold transition-colors shadow-xs"
                    >
                      Mês Anterior
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Target Date Column in Supabase */}
                  <div>
                    <label className="block text-[11px] font-bold text-amber-950 mb-1">
                      Coluna de Data (no Supabase):
                    </label>
                    <input
                      type="text"
                      list="supabase-date-cols-list"
                      value={periodDateColumn}
                      onChange={(e) => setPeriodDateColumn(e.target.value)}
                      placeholder="Ex: data"
                      className="w-full text-xs px-3 py-2 border border-amber-300 rounded-lg outline-none bg-white font-mono font-medium focus:border-amber-500 shadow-sm"
                    />
                    <datalist id="supabase-date-cols-list">
                      <option value="data" />
                      {tableColumns.map((col, idx) => (
                        <option key={idx} value={col} />
                      ))}
                    </datalist>
                  </div>

                  {/* Start Date */}
                  <div>
                    <label className="block text-[11px] font-bold text-amber-950 mb-1">
                      Data Inicial (Início do Período):
                    </label>
                    <input
                      type="date"
                      value={periodStartDate}
                      onChange={(e) => setPeriodStartDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-amber-300 rounded-lg outline-none bg-white font-medium focus:border-amber-500 shadow-sm"
                    />
                  </div>

                  {/* End Date */}
                  <div>
                    <label className="block text-[11px] font-bold text-amber-950 mb-1">
                      Data Final (Fim do Período):
                    </label>
                    <input
                      type="date"
                      value={periodEndDate}
                      onChange={(e) => setPeriodEndDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-amber-300 rounded-lg outline-none bg-white font-medium focus:border-amber-500 shadow-sm"
                    />
                  </div>

                </div>

                {/* Explanation Banner */}
                <div className="flex items-start gap-2 bg-amber-100/60 p-2.5 rounded-lg border border-amber-300/60 text-amber-900 text-[11px] leading-relaxed">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    Ao prosseguir, todos os registros existentes na tabela{' '}
                    <span className="font-bold font-mono text-amber-950">
                      "{selectedTable === 'custom' ? (customTableName || 'tabela_destino') : selectedTable}"
                    </span>{' '}
                    onde a coluna{' '}
                    <span className="font-bold font-mono text-amber-950">"{periodDateColumn || 'data'}"</span>{' '}
                    estiver entre{' '}
                    <span className="font-bold text-amber-950">
                      {periodStartDate ? formatDateDisplayBR(periodStartDate) : 'DD/MM/AAAA'}
                    </span>{' '}
                    e{' '}
                    <span className="font-bold text-amber-950">
                      {periodEndDate ? formatDateDisplayBR(periodEndDate) : 'DD/MM/AAAA'}
                    </span>{' '}
                    serão excluídos do Supabase e, logo em seguida, os novos {recordsToUpload.length} registros serão inseridos.
                  </div>
                </div>

              </div>
            )}

            {/* Full clean warning notice */}
            {cleanupMode === 'all' && (
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block mb-0.5">Atenção ao Sobrescrever:</strong>
                  <span>
                    Todos os registros salvos na tabela selecionada no Supabase serão permanentemente apagados antes da inserção dos novos registros.
                  </span>
                </div>
              </div>
            )}

          </div>

          {/* Column Mappings Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 grid grid-cols-12 gap-4">
              <div className="col-span-6">Coluna na Planilha / App</div>
              <div className="col-span-1 text-center"></div>
              <div className="col-span-5">Coluna no Supabase</div>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 bg-white">
              {columnMappings.map(mapItem => (
                <div key={mapItem.appColumn} className="px-4 py-2 text-xs grid grid-cols-12 gap-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-6 font-medium text-slate-700 truncate" title={mapItem.appColumn}>
                    {mapItem.appColumn}
                  </div>
                  <div className="col-span-1 flex justify-center text-slate-400">
                    →
                  </div>
                  <div className="col-span-5">
                    {tableColumns.length > 0 ? (
                      <select
                        value={mapItem.supabaseColumn}
                        onChange={(e) => handleMappingChange(mapItem.appColumn, e.target.value)}
                        className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-md outline-none focus:border-emerald-500 font-mono bg-white shadow-xs"
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
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 font-mono shadow-xs"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upload Progress Status */}
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

          {/* Upload Success Feedback */}
          {uploadSuccess && (
            <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-sm block mb-0.5">Sincronização Concluída com Sucesso!</strong>
                <span>{uploadStatus}</span>
              </div>
            </div>
          )}

          {/* Upload Error Feedback */}
          {uploadError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-sm block mb-0.5">Erro durante o envio:</strong>
                <span>{uploadError}</span>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleStartUpload}
              disabled={isUploading || recordsToUpload.length === 0}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98]"
            >
              <UploadCloud className="w-4 h-4" />
              <span>
                {isUploading 
                  ? 'Processando...' 
                  : cleanupMode === 'period'
                    ? `Limpar Período e Subir ${recordsToUpload.length} Registros`
                    : cleanupMode === 'all'
                      ? `Sobrescrever e Subir ${recordsToUpload.length} Registros`
                      : `Subir ${recordsToUpload.length} Registros`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

