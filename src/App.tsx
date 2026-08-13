import React, { useState, useEffect } from 'react';
import {
  EsteiraSheet, GroupedColumnMapping, ConsolidationConfig,
  ConsolidatedRecord, ConsolidationSummary, HistoryEntry,
  MacroPreset, ColumnExclusionPreset, ColumnMergePreset,
  ConditionalReplacePreset, GroupingPreset
} from './types';
import { parseExcelFile } from './utils/excelParser';
import { createDemoSheets, generateDemoExcelFile } from './utils/demoData';
import { generateSmartColumnMappings } from './utils/columnMatcher';
import { consolidateSheets } from './utils/consolidator';
import { applyMergeRules, applyConditionalReplaceRules } from './utils/macroProcessor';
import { Header } from './components/Header';
import { UploadSection } from './components/UploadSection';
import { SheetSelector } from './components/SheetSelector';
import { ColumnMapper } from './components/ColumnMapper';
import { MainDatabaseGrid } from './components/MainDatabaseGrid';
import { LoginScreen } from './components/LoginScreen';
import { CheckCircle2, RefreshCw, ArrowLeft } from 'lucide-react';
import { supabase } from './lib/supabase';
import { loadFromFirebase } from './lib/firebase';

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

  // Presets State for Macros
  const [exclusionPresets, setExclusionPresets] = useState<ColumnExclusionPreset[]>([]);
  const [mergePresets, setMergePresets] = useState<ColumnMergePreset[]>([]);
  const [conditionalPresets, setConditionalPresets] = useState<ConditionalReplacePreset[]>([]);
  const [groupingPresets, setGroupingPresets] = useState<GroupingPreset[]>([]);
  const [initialMacroGroupingPresetId, setInitialMacroGroupingPresetId] = useState<string>('');

  useEffect(() => {
    const loadAllPresets = async () => {
      // First load from localStorage for immediate render
      try {
        const p1 = localStorage.getItem('esteiras_exclusion_presets');
        if (p1) setExclusionPresets(JSON.parse(p1));
        
        const p2 = localStorage.getItem('esteiras_merge_presets');
        if (p2) setMergePresets(JSON.parse(p2));

        const p3 = localStorage.getItem('esteiras_conditional_replace_presets');
        if (p3) setConditionalPresets(JSON.parse(p3));

        const p4 = localStorage.getItem('esteiras_grouping_presets');
        if (p4) setGroupingPresets(JSON.parse(p4));
      } catch (e) {
        console.error('Error parsing local presets in App:', e);
      }

      // Then load from Firebase for up-to-date values
      try {
        const fb1 = await loadFromFirebase<ColumnExclusionPreset[]>('esteiras_exclusion_presets');
        if (fb1 && Array.isArray(fb1)) setExclusionPresets(fb1);

        const fb2 = await loadFromFirebase<ColumnMergePreset[]>('esteiras_merge_presets');
        if (fb2 && Array.isArray(fb2)) setMergePresets(fb2);

        const fb3 = await loadFromFirebase<ConditionalReplacePreset[]>('esteiras_conditional_replace_presets');
        if (fb3 && Array.isArray(fb3)) setConditionalPresets(fb3);

        const fb4 = await loadFromFirebase<GroupingPreset[]>('esteiras_grouping_presets');
        if (fb4 && Array.isArray(fb4)) setGroupingPresets(fb4);
      } catch (e) {
        console.error('Error loading presets from Firebase in App:', e);
      }
    };
    
    loadAllPresets();
  }, [currentStep]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  };

  // Consolidated Output State
  const [consolidatedRecords, setConsolidatedRecords] = useState<ConsolidatedRecord[]>([]);
  const [consolidationSummary, setConsolidationSummary] = useState<ConsolidationSummary | null>(null);

  // History Drawer


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

  const handleExecuteMacro = (macro: MacroPreset) => {
    const selected = sheets.filter(s => s.selected);
    if (selected.length === 0) {
      alert('Selecione ao menos uma aba (esteira) para prosseguir.');
      return;
    }

    setIsLoading(true);
    setLoadingMessage(`Executando Macro: ${macro.name}...`);

    setTimeout(() => {
      try {
        // 1. Generate Smart Column Mappings
        let mappings = generateSmartColumnMappings(sheets, false);
        
        // 2. Apply Exclusion Preset if present
        if (macro.exclusionPresetId) {
          const excPreset = exclusionPresets.find(p => p.id === macro.exclusionPresetId);
          if (excPreset) {
            mappings = mappings.map(m => {
              if (excPreset.excludedColumns.includes(m.targetColumnName)) {
                return { ...m, sourceMappings: m.sourceMappings.map(sm => ({ ...sm, isIgnored: true })) };
              }
              const renameRule = excPreset.renames?.find(r => r.originalName === m.targetColumnName);
              if (renameRule) {
                return { ...m, targetColumnName: renameRule.newName };
              }
              return m;
            });
          }
        }
        setColumnMappings(mappings);

        // 3. Consolidate Base
        const activeMappings = mappings.filter(m => !m.sourceMappings.every(sm => sm.isIgnored));
        const fullConfig: ConsolidationConfig = {
          ...cleaningConfig,
          groupMappings: mappings
        };

        let { records, summary } = consolidateSheets(sheets, fullConfig, fileName);

        // 4. Apply Merge Preset
        if (macro.mergePresetId) {
          const mPreset = mergePresets.find(p => p.id === macro.mergePresetId);
          if (mPreset && mPreset.rules.length > 0) {
            records = applyMergeRules(records, mPreset.rules);
          }
        }

        // 5. Apply Conditional Replace Preset
        if (macro.conditionalPresetId) {
          const cPreset = conditionalPresets.find(p => p.id === macro.conditionalPresetId);
          if (cPreset && cPreset.rules.length > 0) {
            records = applyConditionalReplaceRules(records, cPreset.rules);
          }
        }

        setConsolidatedRecords(records);
        setConsolidationSummary(summary);
        
        // 6. Apply Grouping Preset
        if (macro.groupingPresetId) {
          setInitialMacroGroupingPresetId(macro.groupingPresetId);
        } else {
          setInitialMacroGroupingPresetId('');
        }

        setCurrentStep(4);
      } catch (err) {
        console.error('Erro na macro:', err);
        alert('Ocorreu um erro durante a execução da Macro.');
      } finally {
        setIsLoading(false);
      }
    }, 300);
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
            onExecuteMacro={handleExecuteMacro}
            exclusionPresets={exclusionPresets}
            mergePresets={mergePresets}
            conditionalPresets={conditionalPresets}
            groupingPresets={groupingPresets}
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
              initialMacroGroupingPresetId={initialMacroGroupingPresetId}
            />

          </div>
        )}

      </main>



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
