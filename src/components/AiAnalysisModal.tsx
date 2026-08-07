import React, { useState, useEffect } from 'react';
import { AiAnalysisReport, ConsolidationSummary, ConsolidatedRecord } from '../types';
import { Sparkles, X, AlertTriangle, CheckCircle2, TrendingUp, Lightbulb, RefreshCw, ShieldCheck } from 'lucide-react';

interface AiAnalysisModalProps {
  summary: ConsolidationSummary;
  records: ConsolidatedRecord[];
  onClose: () => void;
}

export const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({
  summary,
  records,
  onClose
}) => {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<AiAnalysisReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAiAnalysis = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const columnNames = records.length > 0 ? Object.keys(records[0]).filter(k => !k.startsWith('__')) : [];
      const sampleData = records.slice(0, 5).map(r => {
        const clean: any = {};
        columnNames.forEach(c => clean[c] = r[c]);
        return clean;
      });

      const response = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          esteirasSummary: summary.recordsPerEsteira,
          sampleData,
          columnNames,
          totalRecords: summary.totalRecords
        })
      });

      const data = await response.json();

      if (data.error && !data.analysis) {
        setErrorMsg(data.error);
        // Provide fallback local report if server key is missing
        setReport({
          resumoExecutivo: "A consolidação reuniu com sucesso todas as esteiras selecionadas em uma estrutura unificada.",
          qualidadeDados: {
            score: summary.fieldCompletenessRate,
            diagnostico: `A base unificada apresentou uma taxa global de preenchimento de ${summary.fieldCompletenessRate}%.`
          },
          alertasInconsistencia: [
            "Verifique se as colunas com nomes parecidos nas esteiras originais foram todas mapeadas para a mesma coluna unificada.",
            "Certifique-se de que formatos de data e valores numéricos estão padronizados."
          ],
          insightsOperacionais: [
            `A esteira de maior volume no tabulador é "${summary.recordsPerEsteira[0]?.esteira || 'Esteira 1'}" com ${summary.recordsPerEsteira[0]?.count || 0} registros.`,
            `Total de ${summary.duplicateRowsRemoved} linhas duplicadas removidas durante o saneamento.`
          ],
          recomendacoes: [
            "Recomendamos padronizar os nomes das abas dos tabuladores mensais para otimizar futuras importações.",
            "Criar um padrão único de documento (CPF/CNPJ) em todas as esteiras de entrada."
          ]
        });
      } else if (data.analysis) {
        setReport(data.analysis);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Serviço temporariamente indisponível. Exibindo auditoria estática de integridade.');
      setReport({
        resumoExecutivo: "A consolidação das esteiras foi concluída com sucesso.",
        qualidadeDados: {
          score: summary.fieldCompletenessRate,
          diagnostico: `A taxa de preenchimento total é de ${summary.fieldCompletenessRate}%.`
        },
        alertasInconsistencia: [
          "Inconsistências potenciais em cabeçalhos de abas secundárias.",
          "Valores ausentes em campos opcionais."
        ],
        insightsOperacionais: [
          `Esteira principal representa a maior fatia da base.`
        ],
        recomendacoes: [
          "Manter a desduplicação por CPF/ID ativada nas próximas consolidações."
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAiAnalysis();
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Auditoria Inteligente da Consolidação</h3>
              <p className="text-xs text-slate-300">Análise diagnóstica e validação de qualidade das esteiras</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto max-h-[75vh] space-y-6">
          
          {loading ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
              <p className="text-sm font-bold text-slate-800">Analisando padrão das esteiras com Inteligência Artificial...</p>
              <p className="text-xs text-slate-500 mt-1">Auditando integridade, duplicatas e distribuição de dados</p>
            </div>
          ) : report ? (
            <>
              {/* Executive Summary */}
              <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200/80">
                <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" /> Resumo Executivo
                </h4>
                <p className="text-xs text-blue-950 leading-relaxed font-medium">
                  {report.resumoExecutivo}
                </p>
              </div>

              {/* Data Quality Score Card */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 font-extrabold text-xl text-white ${
                  report.qualidadeDados.score >= 80 ? 'bg-emerald-600' : report.qualidadeDados.score >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                }`}>
                  <span>{report.qualidadeDados.score}</span>
                  <span className="text-[9px] font-normal uppercase opacity-80">Score</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Diagnóstico da Base de Dados</h4>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {report.qualidadeDados.diagnostico}
                  </p>
                </div>
              </div>

              {/* Alerts */}
              {report.alertasInconsistencia && report.alertasInconsistencia.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Pontos de Atenção
                  </h4>
                  <div className="space-y-1.5">
                    {report.alertasInconsistencia.map((alerta, i) => (
                      <div key={i} className="text-xs text-slate-700 p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <span>{alerta}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Insights */}
              {report.insightsOperacionais && report.insightsOperacionais.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-indigo-600" /> Insights das Esteiras
                  </h4>
                  <div className="space-y-1.5">
                    {report.insightsOperacionais.map((insight, i) => (
                      <div key={i} className="text-xs text-slate-700 p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-100 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {report.recomendacoes && report.recomendacoes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-emerald-600" /> Recomendações de Padronização
                  </h4>
                  <div className="space-y-1.5">
                    {report.recomendacoes.map((rec, i) => (
                      <div key={i} className="text-xs text-slate-700 p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </>
          ) : null}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={fetchAiAnalysis}
            disabled={loading}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reanalisar</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl"
          >
            Concluído
          </button>
        </div>

      </div>
    </div>
  );
};
