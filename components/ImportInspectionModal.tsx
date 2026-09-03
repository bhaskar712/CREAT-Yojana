import React from 'react';
import { FiscalMode } from '../types';

export const ImportInspectionModal = ({ isOpen, data, onClose, onConfirm, fiscalMode }: { 
  isOpen: boolean, 
  data: any, 
  onClose: () => void, 
  onConfirm: () => void,
  fiscalMode: FiscalMode
}) => {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col max-h-[90vh]">
        <div className={`${fiscalMode === 'Actuals' ? 'bg-emerald-600' : (fiscalMode === 'Forecast' ? 'bg-amber-600' : 'bg-indigo-600')} p-8 text-white shrink-0 transition-colors duration-500`}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tight">Importing into {fiscalMode}</h3>
              <p className="text-[10px] font-black opacity-70 uppercase mt-1 tracking-widest">Validating External Data Payload for {fiscalMode} Context</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3"/></svg>
            </button>
          </div>
          <div className="flex wrap gap-4 mt-6">
            <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10">
              <span className="text-[8px] font-black uppercase opacity-60 block">Total Entries</span>
              <span className="text-xl font-black none">{data.summary.total}</span>
            </div>
            <div className="bg-emerald-50/20 px-4 py-2 rounded-xl border border-emerald-500/20">
              <span className="text-[8px] font-black uppercase opacity-60 block">Valid New</span>
              <span className="text-xl font-black none">{data.summary.valid}</span>
            </div>
            <div className="bg-blue-50/20 px-4 py-2 rounded-xl border border-blue-500/20">
              <span className="text-[8px] font-black uppercase opacity-60 block">Updates</span>
              <span className="text-xl font-black none">{data.summary.updates}</span>
            </div>
            <div className="bg-red-50/20 px-4 py-2 rounded-xl border border-red-500/20">
              <span className="text-[8px] font-black uppercase opacity-60 block">Errors</span>
              <span className="text-xl font-black none">{data.summary.errors}</span>
            </div>
          </div>
        </div>
        <div className="flex-grow overflow-y-auto p-6 no-scrollbar">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">ID / Code</th>
                <th className="px-4 py-3">Project Name</th>
                <th className="px-4 py-3">Vertical</th>
                <th className="px-4 py-3">Validation Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.projects.map((p: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors h-12">
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-[7px] font-black uppercase ${
                      p.status === 'valid' ? 'bg-emerald-50 text-emerald-600' :
                      p.status === 'update' ? 'bg-blue-50 text-blue-600' :
                      'bg-red-50 text-red-600'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-[10px] font-bold text-slate-600">{p.code}</td>
                  <td className="px-4 py-2 text-[10px] font-black text-slate-900 uppercase truncate max-w-[200px]">{p.name}</td>
                  <td className="px-4 py-2 text-[10px] font-bold text-slate-500">{p.vertical}</td>
                  <td className="px-4 py-2">
                    {p.errors?.length > 0 ? (
                      <div className="text-[8px] text-red-500 font-bold uppercase depth-tight">
                        {p.errors.map((e: string, i: number) => <div key={i}>• {e}</div>)}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] text-slate-300 font-black uppercase">Protocol Compliant {p.hasEstimationData ? '(Budget Found)' : ''}</span>
                        {p.mappedSummary && (p.mappedSummary.skills.length > 0 || p.mappedSummary.expenses.length > 0) && (
                          <div className="flex flex-wrap gap-1">
                            {p.mappedSummary.skills.map((s: string) => (
                              <span key={s} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-500 text-[6px] font-black rounded uppercase border border-indigo-100">{s}</span>
                            ))}
                            {p.mappedSummary.expenses.map((e: string) => (
                              <span key={e} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-500 text-[6px] font-black rounded uppercase border border-emerald-100">{e}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <button onClick={onClose} className="px-8 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-700">Abort Import</button>
          <button 
            onClick={onConfirm} 
            disabled={data.summary.valid === 0 && data.summary.updates === 0}
            className="bg-indigo-600 text-white px-12 py-4 rounded-2xl w-full sm:w-auto text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Finalize & Commit {fiscalMode} Changes
          </button>
        </div>
      </div>
    </div>
  );
};
