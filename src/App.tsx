import React, { useState, useEffect } from 'react';
import {
  EsteiraSheet, GroupedColumnMapping, ConsolidationConfig,
  ConsolidatedRecord, ConsolidationSummary, HistoryEntry
} from './types';
import { parseExcelFile } from './utils/excelParser';
import { createDemoSheets, generateDemoExcelFile } from './utils/demoData';
import { generateSmartColumnMappings } from './utils/columnMatcher';
import { consolidateSheets } from './utils/consolidator';
import { Header } from './components/Header';
import { UploadSection } from './components/UploadSection';
import { SheetSelector } from './components/SheetSelector';
import { ColumnMapper } from './components/ColumnMapper';
import { MainDatabaseGrid } from './components/MainDatabaseGrid';
import { HistoryDrawer } from './components/HistoryDrawer';
import { LoginScreen } from './components/LoginScreen';
import { CheckCircle2, RefreshCw, ArrowLeft } from 'lucide-react';
import { purgeLocalStorage, saveToFirebase, loadFromFirebase, deleteFromFirebase } from './lib/firebase';
import { supabase } from './lib/supabase';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Navigation Step: 1 = Upload, 2 = Selecionar Esteiras, 3 = Mapear/Excluir Colunas, 4 = Base Consolidada
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Processando dados...');
  const [fileName, setFileName] = useState<string>('Tabulador_Esteiras.xlsx');

  // Core Data State
  const [sheets, setSheets] = useState<EsteiraSheet[]>([]);
  const [columnMappings, setColumnMappings] = useState<GroupedColumnMapping[]>([]);
  const [cleaningConfig, setCleaningConfig] = useState<ConsolidationConfig>({
    esteiraColumnName: 'Esteira / Origem',
    deduplicate: false,
    dedupeKey: 'ALL',
    trimWhitespace: true,
    removeEmptyRows: true,
    fillMissingValue: '-',
    standardizeDates: false,
    standardizeCurrency: false,
    groupMappings: [],
    filterConfig: {
      enabled: false,
      matchLogic: 'AND',
      rules: []
    }
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  };

  // Consolidated Output State
  const [consolidatedRecords, setConsolidatedRecords] = useState<ConsolidatedRecord[]>([]);
  const [consolidationSummary, setConsolidationSummary] = useState<ConsolidationSummary | null>(null);

  // History Drawer
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);

  // Purge localStorage and load history from Firebase
  useEffect(() => {
    purgeLocalStorage();

    const loadHistory = async () => {
      try {
        const saved = await loadFromFirebase<HistoryEntry[]>('esteiras_consolidation_history');
        if (saved && Array.isArray(saved)) {
          setHistoryList(saved);
        }
      } catch (e) {
        console.error('Failed to load history from Firebase', e);
      }
    };
    loadHistory();
  }, []);

  const saveToHistory = (summary: ConsolidationSummary, records: ConsolidatedRecord[], config: ConsolidationConfig) => {
    const newEntry: HistoryEntry = {
      id: `hist-${Date.now()}`,
      fileName: summary.fileName,
      timestamp: summary.createdAt,
      totalRecords: summary.totalRecords,
      esteiraNames: summary.recordsPerEsteira.map(r => r.esteira),
      columnsCount: summary.unifiedColumnsCount,
      summary,
      records,
      config
    };

    const updated = [newEntry, ...historyList.slice(0, 9)]; // Keep last 10
    setHistoryList(updated);
    saveToFirebase('esteiras_consolidation_history', updated);
  };

  const handleFileUpload = (file: File) => {
    setIsLoading(true);
    setLoadingMessage('Lendo e analisando a planilha Excel...');
    setFileName(file.name);

    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const parsedSheets = parseExcelFile(buffer, file.name);

          if (parsedSheets.length === 0) {
            alert('Nenhuma aba válida com dados foi encontrada no arquivo.');
            setIsLoading(false);
            return;
          }

          setSheets(parsedSheets);
          setCurrentStep(2);
        } catch (err) {
          console.error(err);
          alert('Erro ao ler a planilha Excel. Verifique se o arquivo não está corrompido.');
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    }, 100);
  };

  const handleLoadDemo = () => {
    setIsLoading(true);
    setLoadingMessage('Gerando base demonstrativa...');
    setFileName('Tabulador_Demonstrativo_Esteiras.xlsx');

    setTimeout(() => {
      const demoSheets = createDemoSheets();
      setSheets(demoSheets);
      setCurrentStep(2);
      setIsLoading(false);
    }, 300);
  };

  const handleDownloadDemoTemplate = () => {
    const arrayBuffer = generateDemoExcelFile();
    const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Modelo_Tabulador_Esteiras_Exemplo.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Step 2 actions: Sheets selection
  const handleToggleSheet = (sheetId: string) => {
    setSheets(prev => prev.map(s => s.id === sheetId ? { ...s, selected: !s.selected } : s));
  };

  const handleSelectAllSheets = (select: boolean) => {
    setSheets(prev => prev.map(s => ({ ...s, selected: select })));
  };

  const handleProceedToMapping = () => {
    const selected = sheets.filter(s => s.selected);
    if (selected.length === 0) {
      alert('Selecione ao menos uma aba (esteira) para prosseguir.');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Mapeando colunas e analisando cabeçalhos das esteiras...');

    setTimeout(() => {
      // Standard Power Query mode (exact header union)
      const mappings = generateSmartColumnMappings(sheets, false);
      setColumnMappings(mappings);
      setCurrentStep(3);
      setIsLoading(false);
    }, 150);
  };

  const handleResetToPowerQuery = () => {
    setIsLoading(true);
    setLoadingMessage('Resetando unificação de colunas para o padrão...');
    setTimeout(() => {
      const mappings = generateSmartColumnMappings(sheets, false);
      setColumnMappings(mappings);
      setIsLoading(false);
    }, 150);
  };

  const handleApplySynonymGrouping = () => {
    setIsLoading(true);
    setLoadingMessage('Buscando e agrupando sinônimos automáticos...');
    setTimeout(() => {
      const mappings = generateSmartColumnMappings(sheets, true);
      setColumnMappings(mappings);
      setIsLoading(false);
    }, 150);
  };

  // Step 3 -> Step 4: Execute Consolidation directly (No Step 4 cleaning)
  const handleProceedToConsolidation = () => {
    const activeMappings = columnMappings.filter(m => !m.sourceMappings.every(sm => sm.isIgnored));
    if (activeMappings.length === 0) {
      alert('Defina ao menos uma coluna unificada ativa para prosseguir.');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Consolidando e padronizando todas as esteiras de dados...');

    setTimeout(() => {
      try {
        const fullConfig: ConsolidationConfig = {
          ...cleaningConfig,
          groupMappings: columnMappings
        };

        const { records, summary } = consolidateSheets(sheets, fullConfig, fileName);

        setConsolidatedRecords(records);
        setConsolidationSummary(summary);
        saveToHistory(summary, records, fullConfig);

        setCurrentStep(4);
      } catch (err) {
        console.error('Erro na consolidação:', err);
        alert('Ocorreu um erro durante a consolidação da base de dados.');
      } finally {
        setIsLoading(false);
      }
    }, 300);
  };

  const handleBackToStep3 = () => {
    setIsLoading(true);
    setLoadingMessage('Retornando à Etapa 3 de Mapeamento...');
    setTimeout(() => {
      setCurrentStep(3);
      setIsLoading(false);
    }, 150);
  };

  // Grid mutations in Step 4
  const handleUpdateRecord = (updatedRecord: ConsolidatedRecord) => {
    setConsolidatedRecords(prev => prev.map(r => r.__id === updatedRecord.__id ? updatedRecord : r));
  };

  const handleDeleteRecord = (id: string) => {
    setConsolidatedRecords(prev => prev.filter(r => r.__id !== id));
    if (consolidationSummary) {
      setConsolidationSummary({
        ...consolidationSummary,
        totalRecords: consolidationSummary.totalRecords - 1
      });
    }
  };

  const handleAddRecord = (newRecord: ConsolidatedRecord) => {
    setConsolidatedRecords(prev => [newRecord, ...prev]);
    if (consolidationSummary) {
      setConsolidationSummary({
        ...consolidationSummary,
        totalRecords: consolidationSummary.totalRecords + 1
      });
    }
  };

  const handleResetAll = () => {
    setCurrentStep(1);
    setSheets([]);
    setColumnMappings([]);
    setConsolidatedRecords([]);
    setConsolidationSummary(null);
  };

  const handleSelectHistoryEntry = (entry: HistoryEntry) => {
    setConsolidatedRecords(entry.records);
    setConsolidationSummary(entry.summary);
    setCleaningConfig(entry.config);
    setFileName(entry.fileName);
    setCurrentStep(4);
    setShowHistoryDrawer(false);
  };

  const handleDeleteHistoryEntry = (id: string) => {
    const updated = historyList.filter(h => h.id !== id);
    setHistoryList(updated);
    saveToFirebase('esteiras_consolidation_history', updated);
  };

  const handleClearAllHistory = () => {
    setHistoryList([]);
    deleteFromFirebase('esteiras_consolidation_history');
  };

  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col antialiased">
      
      {/* Top Header */}
      <Header
        currentStep={currentStep}
        totalSteps={4}
        onReset={handleResetAll}
        onLoadDemo={handleLoadDemo}
        onDownloadDemoTemplate={handleDownloadDemoTemplate}
        onOpenHistory={() => setShowHistoryDrawer(true)}
        historyCount={historyList.length}
        onLogout={handleLogout}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Step 1: Upload */}
        {currentStep === 1 && (
          <UploadSection
            onFileUpload={handleFileUpload}
            onLoadDemo={handleLoadDemo}
            onDownloadDemoTemplate={handleDownloadDemoTemplate}
            isLoading={isLoading}
          />
        )}

        {/* Step 2: Select Sheets */}
        {currentStep === 2 && (
          <SheetSelector
            sheets={sheets}
            onToggleSheet={handleToggleSheet}
            onSelectAll={handleSelectAllSheets}
            onProceed={handleProceedToMapping}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {/* Step 3: Column Mapping & Exclusions */}
        {currentStep === 3 && (
          <ColumnMapper
            mappings={columnMappings}
            onChangeMappings={setColumnMappings}
            onResetToPowerQuery={handleResetToPowerQuery}
            onApplySynonymGrouping={handleApplySynonymGrouping}
            onProceed={handleProceedToConsolidation}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {/* Step 4: Consolidated Master Database View */}
        {currentStep === 4 && consolidationSummary && (
          <div className="space-y-6">
            
            {/* Success Banner */}
            <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-emerald-800/50">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-inner">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    Base Principal Consolidade com Sucesso!
                  </h2>
                  <p className="text-xs text-emerald-100/90 mt-1">
                    Arquivo: <strong className="text-white font-mono">{consolidationSummary.fileName}</strong> • Unificadas <strong className="text-emerald-300 font-bold">{consolidationSummary.totalEsteiras} esteiras</strong> resultando em <strong className="text-emerald-300 font-bold">{consolidationSummary.totalRecords} registros</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={handleBackToStep3}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl border border-emerald-500 flex items-center gap-1.5 transition-colors shadow-md"
                  title="Voltar para a Etapa 3 de Mapeamento para reconfigurar colunas e reprocessar a base"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar para Mapeamento (Etapa 3)</span>
                </button>

                <button
                  onClick={handleResetAll}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Nova Consolidação</span>
                </button>
              </div>
            </div>

            {/* Master Interactive Data Grid */}
            <MainDatabaseGrid
              records={consolidatedRecords}
              summary={consolidationSummary}
              onUpdateRecord={handleUpdateRecord}
              onDeleteRecord={handleDeleteRecord}
              onAddRecord={handleAddRecord}
              onBulkUpdateRecords={setConsolidatedRecords}
              onResetAll={handleResetAll}
              onBackToStep3={handleBackToStep3}
            />

          </div>
        )}

      </main>

      {/* History Drawer */}
      {showHistoryDrawer && (
        <HistoryDrawer
          history={historyList}
          onSelectHistory={handleSelectHistoryEntry}
          onDeleteHistory={handleDeleteHistoryEntry}
          onClearAll={handleClearAllHistory}
          onClose={() => setShowHistoryDrawer(false)}
        />
      )}

      {/* Global Processing Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-sm w-full flex flex-col items-center text-center space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin" />
              <RefreshCw className="w-6 h-6 text-emerald-600 absolute animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base sm:text-lg">{loadingMessage || 'Processando dados...'}</h3>
              <p className="text-xs text-slate-500 mt-1">Aguarde alguns instantes enquanto o sistema conclui o processamento.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
