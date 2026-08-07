import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Sparkles, CheckCircle2, ShieldCheck, ArrowRight, Download, Layers } from 'lucide-react';

interface UploadSectionProps {
  onFileUpload: (file: File) => void;
  onLoadDemo: () => void;
  onDownloadDemoTemplate: () => void;
  isLoading: boolean;
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  onFileUpload,
  onLoadDemo,
  onDownloadDemoTemplate,
  isLoading
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.match(/\.(xlsx|xls|csv)$/i)) {
        onFileUpload(file);
      } else {
        alert('Por favor, envie um arquivo de planilha no formato .xlsx, .xls ou .csv.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      
      {/* Hero Welcome Banner */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Consolidador Universal de Tabuladores e Esteiras</span>
        </div>
      </div>

      {/* Upload Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-blue-500 bg-blue-50/80 scale-[1.01] shadow-xl'
            : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/80 shadow-sm'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleFileChange}
          className="hidden"
        />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-base font-semibold text-slate-800">Lendo e analisando as abas do Excel...</p>
            <p className="text-xs text-slate-500 mt-1">Extraindo tabelas de cada esteira</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner">
              <Upload className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Arraste e solte seu arquivo Excel aqui
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              ou <span className="text-blue-600 font-semibold underline underline-offset-2">clique para selecionar do seu computador</span>
            </p>

            <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Suporta .xlsx, .xls, .csv
              </span>
              <span>•</span>
              <span>Análise Instantânea sem Envio de Dados Sensíveis para Servidores Externos</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
