import React from 'react';
import { Layers, FileSpreadsheet, Sparkles, Download, RefreshCw, Flame, LogOut } from 'lucide-react';

interface HeaderProps {
  currentStep: number;
  totalSteps: number;
  onReset: () => void;
  onLoadDemo: () => void;
  onDownloadDemoTemplate: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStep,
  totalSteps,
  onReset,
  onLoadDemo,
  onDownloadDemoTemplate,
  onLogout
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={onReset}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wide flex items-center gap-2">
              Consolidador de Esteiras
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium border border-blue-500/30">
                Excel
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30 flex items-center gap-1" title="Sincronizado com Firebase DB (banco-qualityvision)">
                <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Firebase DB</span>
              </span>
            </h1>
            <p className="text-xs text-slate-400">Unificação inteligente de planilhas e tabuladores</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="hidden md:flex items-center gap-2 text-xs font-medium bg-slate-800/80 px-4 py-2 rounded-full border border-slate-700">
          <span className="text-slate-400">Etapa {currentStep} de {totalSteps}:</span>
          <span className="text-blue-400 font-semibold">
            {currentStep === 1 && 'Importação do Arquivo'}
            {currentStep === 2 && 'Seleção de Esteiras'}
            {currentStep === 3 && 'Unificação e Exclusão de Colunas'}
            {currentStep === 4 && 'Base Principal Consolidade'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {currentStep > 1 && (
            <button
              onClick={onReset}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              title="Nova Consolidação"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-all"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
