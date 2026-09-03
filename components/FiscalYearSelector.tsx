
import React, { useState } from 'react';
import { FiscalYear } from '../types';
import { DEFAULT_FY } from '../constants';

export const FiscalYearSelector = ({ 
  onSelect, 
  isAdmin, 
  fiscalLocks, 
  onToggleLock,
  selectedFY
}: { 
  onSelect: (fy: FiscalYear) => void, 
  isAdmin: boolean,
  fiscalLocks: Record<string, boolean>,
  onToggleLock: (fy: FiscalYear) => void,
  selectedFY: FiscalYear | null
}) => {
  const [viewedFY, setViewedFY] = useState<FiscalYear>(selectedFY || DEFAULT_FY);
  const years: { id: FiscalYear, label: string, status: string, color: string }[] = [
    { id: 'FY 21-22', label: 'FY 2021-22', status: 'HISTORICAL', color: 'bg-slate-400' },
    { id: 'FY 22-23', label: 'FY 2022-23', status: 'HISTORICAL', color: 'bg-slate-400' },
    { id: 'FY 23-24', label: 'FY 2023-24', status: 'HISTORICAL', color: 'bg-slate-400' },
    { id: 'FY 24-25', label: 'FY 2024-25', status: 'ARCHIVE', color: 'bg-slate-500' },
    { id: 'FY 25-26', label: 'FY 2025-26', status: 'PREVIOUS FY', color: 'bg-slate-500' },
    { id: 'FY 26-27', label: 'FY 2026-27', status: 'ACTIVE PLANNING', color: 'bg-indigo-600' },
    { id: 'FY 27-28', label: 'FY 2027-28', status: 'FUTURE', color: 'bg-slate-300' },
    { id: 'FY 28-29', label: 'FY 2028-29', status: 'FUTURE', color: 'bg-slate-300' },
    { id: 'FY 29-30', label: 'FY 2029-30', status: 'FUTURE', color: 'bg-slate-300' },
    { id: 'FY 30-31', label: 'FY 2030-31', status: 'FUTURE', color: 'bg-slate-300' },
  ];

  const currentFYIndex = years.findIndex(y => y.id === viewedFY);
  const visibleYears = years.slice(Math.max(0, currentFYIndex - 1), Math.min(years.length, currentFYIndex + 2));

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-6 sm:p-12 animate-fadeIn">
      <div className="w-full max-w-7xl">
        <div className="flex items-center justify-between mb-12">
          <button onClick={() => {
            const currentIndex = years.findIndex(y => y.id === viewedFY);
            if (currentIndex > 0) setViewedFY(years[currentIndex - 1].id);
          }} className="p-4 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-all">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div className="text-center">
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight mb-2">Select Fiscal Context</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Initialize registry session for a specific planning cycle</p>
          </div>
          <button onClick={() => {
            const currentIndex = years.findIndex(y => y.id === viewedFY);
            if (currentIndex < years.length - 1) setViewedFY(years[currentIndex + 1].id);
          }} className="p-4 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-all">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 justify-center">
          {visibleYears.map((y) => {
            const isLocked = fiscalLocks[y.id];
            return (
              <div 
                key={y.id} 
                className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer group flex flex-col items-center text-center relative overflow-hidden"
              >
                <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-[1.5rem] text-[8px] font-black text-white tracking-widest uppercase ${y.color} shadow-lg`}>
                  {y.status}
                </div>
                
                {isAdmin && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onToggleLock(y.id); }}
                    className={`absolute top-2 left-2 p-2 rounded-xl transition-all shadow-sm z-50 ${isLocked ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}
                    title={isLocked ? "Unlock Budget" : "Lock Budget"}
                  >
                    {isLocked ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 11V7a4 1 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
                    )}
                  </button>
                )}

                <div onClick={() => onSelect(y.id)} className="w-full flex flex-col items-center">
                  <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mb-8 border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors shadow-inner relative">
                    <svg className={`w-10 h-10 ${y.id === 'FY 26-27' ? 'text-indigo-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 0 -2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" />
                    </svg>
                    {isLocked && (
                      <div className="absolute -bottom-2 -right-2 bg-red-600 text-white p-1 rounded-full shadow-lg">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                      </div>
                    )}
                  </div>

                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-2">{y.id}</h3>
                  <p className="text-[11px] font-bold text-slate-400 uppercase mb-8">{y.label}</p>

                  <button className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                    y.id === 'FY 26-27' ? 'bg-indigo-600 text-white shadow-lg group-hover:bg-indigo-700' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                  }`}>
                    {isLocked ? 'View Registry' : 'Enter Portal'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        
        <p className="text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-16">
          System Notice: Real-time synchronization is currently active for all fiscal datasets.
        </p>
      </div>
    </div>
  );
};
