import React from 'react';
import { ConsolidationSummary, ConsolidatedRecord } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Layers, CheckCircle2, ShieldCheck, Database, DollarSign, TrendingUp, Sparkles, FileSpreadsheet } from 'lucide-react';

interface AnalyticsDashboardProps {
  summary: ConsolidationSummary;
  records: ConsolidatedRecord[];
  onOpenAiAudit: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  summary,
  records,
  onOpenAiAudit
}) => {
  // Detect if there is a currency column to sum total values
  let totalFinancialValue = 0;
  let currencyColumnName = '';

  if (records.length > 0) {
    const keys = Object.keys(records[0]);
    const currencyKey = keys.find(k => k.toLowerCase().includes('valor') || k.toLowerCase().includes('limite') || k.toLowerCase().includes('saldo'));
    if (currencyKey) {
      currencyColumnName = currencyKey;
      records.forEach(r => {
        const val = r[currencyKey];
        if (typeof val === 'number') {
          totalFinancialValue += val;
        } else if (typeof val === 'string') {
          const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
          if (!isNaN(parsed)) totalFinancialValue += parsed;
        }
      });
    }
  }

  return (
    <div className="space-y-6 mb-8">
      
      {/* Top Banner KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{summary.totalRecords}</div>
            <div className="text-xs font-semibold text-slate-500">Registros Unificados</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{summary.totalEsteiras}</div>
            <div className="text-xs font-semibold text-slate-500">Esteiras Integradas</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{summary.duplicateRowsRemoved}</div>
            <div className="text-xs font-semibold text-slate-500">Duplicatas Removidas</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{summary.fieldCompletenessRate}%</div>
            <div className="text-xs font-semibold text-slate-500">Taxa de Preenchimento</div>
          </div>
        </div>

        {currencyColumnName ? (
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-4 rounded-2xl shadow-sm col-span-2 sm:col-span-1 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-tight">
                {totalFinancialValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="text-[11px] font-medium text-emerald-100">
                Soma Total ({currencyColumnName})
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{summary.unifiedColumnsCount}</div>
              <div className="text-xs font-semibold text-slate-500">Colunas na Base</div>
            </div>
          </div>
        )}

      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Bar Chart of Esteiras */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Volume de Registros por Esteira</h3>
              <p className="text-xs text-slate-500">Distribuição absoluta das linhas por aba de origem</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">Consolidado</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.recordsPerEsteira} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="esteira" tick={{ fontSize: 10, fill: '#64748B' }} interval={0} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '12px', fontSize: '12px', border: 'none' }}
                  formatter={(val: any) => [`${val} registros`, 'Volume']}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {summary.recordsPerEsteira.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Donut Chart Share */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-900 text-sm">Proporção das Esteiras</h3>
              <span className="text-xs text-slate-400">% Share</span>
            </div>
            <p className="text-xs text-slate-500 mb-2">Participação relativa na base unificada</p>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={summary.recordsPerEsteira}
                  dataKey="count"
                  nameKey="esteira"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                >
                  {summary.recordsPerEsteira.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '12px', fontSize: '12px', border: 'none' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* AI Auditor CTA Banner */}
          <button
            onClick={onOpenAiAudit}
            className="w-full mt-2 py-2.5 px-3 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 hover:from-blue-800 hover:to-indigo-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>Gerar Relatório de Auditoria com IA</span>
          </button>
        </div>

      </div>

    </div>
  );
};
