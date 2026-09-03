
import React from 'react';
import { AppTab } from '../types';

interface HomeViewProps {
  updateContext: (tab: AppTab, mode?: 'Budget' | 'Forecast' | 'Actuals') => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ updateContext }) => {
  return (
    <div className="max-w-6xl mx-auto pt-4 space-y-8 animate-fadeIn">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Enterprise Portfolio Portal</h1>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Select a module to begin operational management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12 max-w-6xl mx-auto">
        {/* DCBA Portal Block */}
        <button 
          onClick={() => updateContext(AppTab.DCBA_PORTAL)}
          className="group bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-purple-200/40 transition-all text-left flex flex-col items-center justify-center space-y-6 border-b-[6px] border-b-purple-500"
        >
          <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="2"/>
              <circle cx="12" cy="12" r="6" strokeWidth="2"/>
              <circle cx="12" cy="12" r="2" strokeWidth="2"/>
            </svg>
          </div>
          <div className="text-center">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">DCBA Portal</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Opportunity Tracking & Matrix</p>
          </div>
        </button>

        {/* Budget Block */}
        <button 
          onClick={() => updateContext(AppTab.ENTRY, 'Budget')}
          className="group bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-indigo-200/40 transition-all text-left flex flex-col items-center justify-center space-y-6 border-b-[6px] border-b-indigo-500"
        >
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2"/></svg>
          </div>
          <div className="text-center">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Budget</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">FY Planning & Financial Allocation</p>
          </div>
        </button>

        {/* PMO Block */}
        <button 
          onClick={() => updateContext(AppTab.PMO, 'Actuals')}
          className="group bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-emerald-200/40 transition-all text-left flex flex-col items-center justify-center space-y-6 border-b-[6px] border-b-emerald-500"
        >
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012-2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeWidth="2"/></svg>
          </div>
          <div className="text-center">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">PMO</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Execution Tracking & Budgeting</p>
          </div>
        </button>

        {/* Second Row Layout for 2 items */}
        <div className="lg:col-start-1 lg:col-span-3 flex flex-col md:flex-row justify-center gap-6">
          {/* Resources Block */}
          <button 
            onClick={() => updateContext(AppTab.HR_RESOURCES)}
            className="group bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-amber-200/40 transition-all text-left flex flex-col items-center justify-center space-y-6 border-b-[6px] border-b-amber-500 w-full md:w-[calc(33.33%-1rem)]"
          >
            <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeWidth="2"/></svg>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Resources</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Talent Management & Allocation</p>
            </div>
          </button>

          {/* Seat Allocation Block */}
          <button 
            onClick={() => updateContext(AppTab.SEAT_ALLOCATION)}
            className="group bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-blue-200/40 transition-all text-left flex flex-col items-center justify-center space-y-6 border-b-[6px] border-b-blue-500 w-full md:w-[calc(33.33%-1rem)]"
          >
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 10h16M4 14h16M4 18h16" strokeWidth="2"/></svg>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Seat Allocation-Deskify</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Employee Seat Mapping & Layout</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
