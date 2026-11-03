import React from 'react';
import { X, TrendingUp, Users, UserPlus, CreditCard, Calendar, Briefcase, CheckCircle2, DollarSign } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { AnalyticsTreeNode } from './types';
import { FiscalMode } from '../../types';

interface ProjectDetailDrawerProps {
  node: AnalyticsTreeNode | null;
  onClose: () => void;
  months: string[];
  selectedModes: FiscalMode[];
}

export const ProjectDetailDrawer: React.FC<ProjectDetailDrawerProps> = ({
  node,
  onClose,
  months,
  selectedModes
}) => {
  if (!node) return null;

  const budget = node.metrics['Budget'] || { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, monthlyData: [] };
  const actuals = node.metrics['Actuals'] || { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, monthlyData: [] };
  const varianceCr = actuals.totalCr - budget.totalCr;
  const variancePct = budget.totalCr > 0 ? (varianceCr / budget.totalCr) * 100 : 0;

  const chartData = months.map((m, i) => {
    const item: any = { month: m };
    if (selectedModes.includes('Budget')) item.Budget = Number((budget.monthlyData[i] || 0).toFixed(2));
    if (selectedModes.includes('Actuals')) item.Actuals = Number((actuals.monthlyData[i] || 0).toFixed(2));
    if (selectedModes.includes('Forecast')) item.Forecast = Number((node.metrics['Forecast']?.monthlyData[i] || 0).toFixed(2));
    return item;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end animate-fadeIn">
      <div 
        className="w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col border-l border-slate-200 animate-slideLeft"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <Briefcase size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {node.code && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-blue-300 border border-white/10">
                    {node.code}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                  node.isNew ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-300'
                }`}>
                  {node.isNew ? 'New Initiative' : 'Carry Over'}
                </span>
                {node.status && (
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-500/20 text-blue-200">
                    {node.status}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black tracking-tight text-white mt-1">{node.name}</h3>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
              <p className="text-[10px] font-bold uppercase text-slate-400">Category</p>
              <p className="text-xs font-black text-slate-800 mt-0.5 truncate">{node.categoryKey || '-'}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
              <p className="text-[10px] font-bold uppercase text-slate-400">Subcategory / Vertical</p>
              <p className="text-xs font-black text-slate-800 mt-0.5 truncate">{node.subcategoryKey || node.vertical || '-'}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
              <p className="text-[10px] font-bold uppercase text-slate-400">Manager / Lead</p>
              <p className="text-xs font-black text-slate-800 mt-0.5 truncate">{node.manager || '-'}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
              <p className="text-[10px] font-bold uppercase text-slate-400">Customer</p>
              <p className="text-xs font-black text-slate-800 mt-0.5 truncate">{node.customer || '-'}</p>
            </div>
          </div>

          {/* Financial Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/70">
              <div className="flex items-center justify-between text-blue-700">
                <span className="text-[10px] font-black uppercase tracking-wider">Budget Allocation</span>
                <DollarSign size={16} />
              </div>
              <p className="text-2xl font-black font-mono text-blue-900 mt-2">
                ₹ {budget.totalCr.toFixed(2)} <span className="text-xs text-blue-600 font-sans">Cr</span>
              </p>
              <p className="text-[11px] font-mono text-blue-700 mt-1">
                {budget.manpowerMM.toFixed(2)} MM • ₹ {budget.manpowerCr.toFixed(2)} Cr Manpower
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/70">
              <div className="flex items-center justify-between text-emerald-700">
                <span className="text-[10px] font-black uppercase tracking-wider">Actual Spend</span>
                <TrendingUp size={16} />
              </div>
              <p className="text-2xl font-black font-mono text-emerald-900 mt-2">
                ₹ {actuals.totalCr.toFixed(2)} <span className="text-xs text-emerald-600 font-sans">Cr</span>
              </p>
              <p className="text-[11px] font-mono text-emerald-700 mt-1">
                {actuals.manpowerMM.toFixed(2)} MM • ₹ {actuals.expenseCr.toFixed(2)} Cr Expenses
              </p>
            </div>

            <div className={`p-4 rounded-2xl border ${
              varianceCr <= 0 ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  varianceCr <= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  Variance (Delta)
                </span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                  varianceCr <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {varianceCr <= 0 ? 'Under Budget' : 'Over Budget'}
                </span>
              </div>
              <p className={`text-2xl font-black font-mono mt-2 ${
                varianceCr <= 0 ? 'text-emerald-800' : 'text-rose-800'
              }`}>
                {varianceCr >= 0 ? '+' : ''}{varianceCr.toFixed(2)} <span className="text-xs font-sans">Cr</span>
              </p>
              <p className="text-[11px] font-mono text-slate-500 mt-1">
                {variancePct >= 0 ? '+' : ''}{variancePct.toFixed(1)}% of budget
              </p>
            </div>
          </div>

          {/* Monthly Burn Trend */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 mb-4 flex items-center gap-2">
              <Calendar size={14} className="text-indigo-600" />
              Monthly Spend Trend ({selectedModes.join(' vs ')})
            </h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip 
                    formatter={(val: number) => [`₹ ${val.toFixed(2)} Cr`, '']}
                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                  {selectedModes.includes('Budget') && (
                    <Bar dataKey="Budget" name="Budget" fill="#3b82f6" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
                  )}
                  {selectedModes.includes('Actuals') && (
                    <Line type="monotone" dataKey="Actuals" name="Actuals" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
                  )}
                  {selectedModes.includes('Forecast') && (
                    <Line type="monotone" dataKey="Forecast" name="Forecast" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Skills Breakdown Table */}
          {node.skills && Object.keys(node.skills).length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Users size={14} className="text-blue-600" />
                  Manpower & Skills Allocation
                </span>
                <span className="text-[11px] font-mono text-slate-500 font-bold">
                  {Object.keys(node.skills).length} roles
                </span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-[10px] uppercase font-black tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Role / Skill</th>
                    <th className="px-4 py-2 text-right">Effort (MM)</th>
                    <th className="px-4 py-2 text-right">Cost (₹ Cr)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {Object.entries(node.skills).map(([skillName, s]) => (
                    <tr key={skillName} className="hover:bg-slate-50/80">
                      <td className="px-4 py-2 font-sans font-bold text-slate-700 flex items-center gap-1.5">
                        {skillName.toLowerCase().includes('contracted') ? (
                          <UserPlus size={12} className="text-indigo-500" />
                        ) : (
                          <Users size={12} className="text-blue-500" />
                        )}
                        {skillName}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-800 font-bold">{s.mm.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-slate-900 font-black">₹ {s.cr.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Expenses Breakdown Table */}
          {node.expenses && Object.keys(node.expenses).length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <CreditCard size={14} className="text-orange-600" />
                  Operational Expenses Breakdown
                </span>
                <span className="text-[11px] font-mono text-slate-500 font-bold">
                  {Object.keys(node.expenses).length} items
                </span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-[10px] uppercase font-black tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Expense Category</th>
                    <th className="px-4 py-2 text-right">Amount (₹ Cr)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {Object.entries(node.expenses).map(([expName, e]) => (
                    <tr key={expName} className="hover:bg-slate-50/80">
                      <td className="px-4 py-2 font-sans font-bold text-slate-700">{expName}</td>
                      <td className="px-4 py-2 text-right text-slate-900 font-black">₹ {e.cr.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
