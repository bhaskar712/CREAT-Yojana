import React, { useState } from 'react';
import { MasterConfigState, FiscalYear, FiscalMode } from '../types';
import { ALL_FISCAL_YEARS } from '../constants';
import { 
  Lock, 
  Unlock, 
  ShieldAlert, 
  CheckCircle2, 
  Info, 
  Calendar, 
  Sliders, 
  HelpCircle,
  Clock,
  CheckCircle
} from 'lucide-react';

interface SpreadsheetLocksProps {
  config: MasterConfigState;
  fiscalLocks: Record<string, boolean>;
  forecastMonthLocks: Record<string, boolean[]>;
  onToggleFiscalLock: (fy: FiscalYear, mode?: FiscalMode, type?: 'budget' | 'pmo') => void;
  onToggleMonthLock: (fy: FiscalYear, monthIndex: number | 'all' | 'none') => void;
}

export const SpreadsheetLocks: React.FC<SpreadsheetLocksProps> = ({
  config,
  fiscalLocks,
  forecastMonthLocks,
  onToggleFiscalLock,
  onToggleMonthLock
}) => {
  const fiscalYears = ALL_FISCAL_YEARS.filter(y => y !== 'All FY') as FiscalYear[];
  
  // State for advanced batch controller
  const [selectedMonthFY, setSelectedMonthFY] = useState<FiscalYear>('FY 25-26');
  
  // Interactive cell hover coordinate trackers
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);

  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-8 space-y-8 animate-fadeIn">
      
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-6">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="bg-emerald-50 p-2 rounded-xl text-emerald-600 border border-emerald-100">
              <Sliders className="w-5 h-5" />
            </div>
            <h3 className="text-base font-extrabold tracking-tight text-slate-800">
              Access Control & Permissions
            </h3>
          </div>
          <p className="text-[11px] text-slate-405 font-medium leading-relaxed pl-1 max-w-2xl">
            Manage global and period-specific read/write access across projects and months.
          </p>
        </div>

        {/* Global Master Status Pill */}
        <div className="flex items-center space-x-3 bg-slate-50 p-2 rounded-2xl border border-slate-150 self-start md:self-auto shadow-sm">
          <span className="pl-2.5 pr-1 text-[9px] font-black text-slate-550 uppercase tracking-widest flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" /> Global Override
          </span>
          <div className={`px-4 py-2 rounded-xl text-[10.5px] font-black uppercase tracking-wider shadow-sm flex items-center space-x-1.5 transition-all duration-300 ${
            config.isFiscalLocked 
              ? 'bg-rose-600 text-white ring-4 ring-rose-50' 
              : 'bg-emerald-600 text-white ring-4 ring-emerald-50'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-white ${config.isFiscalLocked ? 'animate-pulse' : ''}`} />
            <span>{config.isFiscalLocked ? 'Locked' : 'Unlocked'}</span>
          </div>
        </div>
      </div>

      {/* The Premium Spreadsheet Component */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-max w-full text-xs font-sans text-left">
            <thead>
              {/* Row 1: Spreadsheet Table Headings */}
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                {/* Visual Label 1A */}
                <td className="px-4 py-3 font-extrabold uppercase tracking-wider text-[10px] text-slate-500 whitespace-nowrap border-r border-slate-200/60 sticky left-0 bg-slate-50 z-10">
                  Fiscal Year
                </td>
                
                {/* Headings 1B to 1F */}
                <td className="px-3 py-3 font-extrabold uppercase tracking-wider text-[10px] text-slate-500 text-center whitespace-nowrap border-r border-slate-200/60">
                  All Lock
                </td>
                <td className="px-3 py-3 font-extrabold uppercase tracking-wider text-[10px] text-slate-500 text-center whitespace-nowrap border-r border-slate-200/60">
                  Budget Workspace Lock
                </td>
                <td className="px-3 py-3 font-extrabold uppercase tracking-wider text-[10px] text-slate-500 text-center whitespace-nowrap border-r border-slate-200/60">
                  PMO Budgeting Lock
                </td>
                <td className="px-3 py-3 font-extrabold uppercase tracking-wider text-[10px] text-slate-500 text-center whitespace-nowrap border-r border-slate-200/60">
                  PMO Actuals Lock
                </td>
                <td className="px-3 py-3 font-extrabold uppercase tracking-wider text-[10px] text-slate-500 text-center whitespace-nowrap border-r border-slate-200/60">
                  PMO Forecast Lock
                </td>

                {/* Granular Period Headers */}
                {months.map((month, mIdx) => {
                  const letter = String.fromCharCode(71 + mIdx); // G onwards
                  return (
                    <td 
                      key={month} 
                      className={`px-3 py-3 font-bold text-center text-[10px] transition-colors duration-150 uppercase tracking-widest border-r border-slate-200/60 whitespace-nowrap ${
                        hoveredCol === letter ? 'bg-indigo-50/50 text-indigo-700' : 'text-slate-500'
                      }`}
                      onMouseEnter={() => setHoveredCol(letter)}
                      onMouseLeave={() => setHoveredCol(null)}
                    >
                      {month}
                    </td>
                  );
                })}
              </tr>
            </thead>
            
            <tbody className="bg-white divide-y divide-slate-100">
              {fiscalYears.map((fy, fyIdx) => {
                
                // Master, operational and page lock lookups
                const isAllLocked = !!fiscalLocks[`pmo_page_${fy}_master`];
                const isBudgetLocked = !!fiscalLocks[`budget_page_${fy}`];
                const isPmoBudgetLocked = !!fiscalLocks[`pmo_page_${fy}_Budget`] || isAllLocked;
                const isPmoActualLocked = !!fiscalLocks[`pmo_page_${fy}_Actuals`] || isAllLocked;
                const isPmoForecastLocked = !!fiscalLocks[`pmo_page_${fy}_Forecast`] || isAllLocked;
                
                // Month locks array lookup
                const fyMonthLocks = forecastMonthLocks[fy] || config.forecastMonthLocks?.[fy] || new Array(12).fill(false);
                
                return (
                  <tr 
                    key={fy} 
                    className={`transition-colors duration-150 hover:bg-slate-50/50 ${
                      hoveredRow === fy ? 'bg-slate-50/80' : ''
                    }`}
                    onMouseEnter={() => setHoveredRow(fy)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    
                    {/* FY Label Cell */}
                    <td className="px-4 py-2 font-black text-slate-800 select-none text-[12px] tracking-tight whitespace-nowrap border-r border-slate-100 sticky left-0 bg-white z-10">
                      {fy}
                    </td>
                    
                    {/* All Lock Cell */}
                    <td className="px-2 py-2 border-r border-slate-100 align-middle text-center w-[120px]">
                      <button 
                        onClick={() => onToggleFiscalLock(fy as FiscalYear, undefined, 'pmo')}
                        className={`w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border ${
                          isAllLocked 
                            ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/90'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 active:scale-95'
                        }`}
                        title="Click to toggle Year-Wide Lock"
                      >
                        {isAllLocked ? (
                          <>
                            <Lock className="w-3 h-3 text-rose-500 flex-shrink-0" />
                            <span>Locked</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                            <span>Unlocked</span>
                          </>
                        )}
                      </button>
                    </td>
                    
                    {/* Budget Workspace Lock Cell (Column C) */}
                    <td className="px-2 py-2 border-r border-slate-100 align-middle text-center w-[160px]">
                      {isAllLocked ? (
                        <div className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-[10px] font-bold bg-slate-50 border border-slate-100 text-slate-400 cursor-not-allowed uppercase italic">
                          <Lock className="w-3 h-3 text-slate-350" />
                          <span>Locked</span>
                        </div>
                      ) : (
                        <button 
                          onClick={() => onToggleFiscalLock(fy as FiscalYear, undefined, 'budget')}
                          className={`w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border ${
                            isBudgetLocked 
                              ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/90'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 active:scale-95'
                          }`}
                          title="Toggles editing lock on central budget page"
                        >
                          {isBudgetLocked ? (
                            <>
                              <Lock className="w-3 h-3 text-rose-500 flex-shrink-0" />
                              <span>Locked</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                              <span>Unlocked</span>
                            </>
                          )}
                        </button>
                      )}
                    </td>
                    
                    {/* PMO Budgeting Lock Cell (Column D) */}
                    <td className="px-2 py-2 border-r border-slate-100 align-middle text-center w-[160px]">
                      {isAllLocked ? (
                        <div className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-[10px] font-bold bg-slate-50 border border-slate-100 text-slate-400 cursor-not-allowed uppercase italic">
                          <Lock className="w-3 h-3 text-slate-350" />
                          <span>Locked</span>
                        </div>
                      ) : (
                        <button 
                          onClick={() => onToggleFiscalLock(fy as FiscalYear, 'Budget', 'pmo')}
                          className={`w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border ${
                            isPmoBudgetLocked
                              ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/90'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 active:scale-95'
                          }`}
                        >
                          {isPmoBudgetLocked ? (
                            <>
                              <Lock className="w-3 h-3 text-rose-500" />
                              <span>Locked</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3 text-emerald-500" />
                              <span>Unlocked</span>
                            </>
                          )}
                        </button>
                      )}
                    </td>
                    
                    {/* PMO Actuals Lock Cell (Column E) */}
                    <td className="px-2 py-2 border-r border-slate-100 align-middle text-center w-[160px]">
                      {isAllLocked ? (
                        <div className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-[10px] font-bold bg-slate-50 border border-slate-100 text-slate-400 cursor-not-allowed uppercase italic">
                          <Lock className="w-3 h-3 text-slate-350" />
                          <span>Locked</span>
                        </div>
                      ) : (
                        <button 
                          onClick={() => onToggleFiscalLock(fy as FiscalYear, 'Actuals', 'pmo')}
                          className={`w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border ${
                            isPmoActualLocked
                              ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/90'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 active:scale-95'
                          }`}
                        >
                          {isPmoActualLocked ? (
                            <>
                              <Lock className="w-3 h-3 text-rose-500" />
                              <span>Locked</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3 text-emerald-500" />
                              <span>Unlocked</span>
                            </>
                          )}
                        </button>
                      )}
                    </td>
                    
                    {/* PMO Forecast Lock Cell (Column F) */}
                    <td className="px-2 py-2 border-r border-slate-100 align-middle text-center w-[160px]">
                      {isAllLocked ? (
                        <div className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-[10px] font-bold bg-slate-50 border border-slate-100 text-slate-400 cursor-not-allowed uppercase italic">
                          <Lock className="w-3 h-3 text-slate-350" />
                          <span>Locked</span>
                        </div>
                      ) : (
                        <button 
                          onClick={() => onToggleFiscalLock(fy as FiscalYear, 'Forecast', 'pmo')}
                          className={`w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border ${
                            isPmoForecastLocked
                              ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/90'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 active:scale-95'
                          }`}
                        >
                          {isPmoForecastLocked ? (
                            <>
                              <Lock className="w-3 h-3 text-rose-500" />
                              <span>Locked</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3 text-emerald-500" />
                              <span>Unlocked</span>
                            </>
                          )}
                        </button>
                      )}
                    </td>
                    
                    {/* Month cells (Columns G to R) */}
                    {months.map((m, mIdx) => {
                      const isMonthLocked = fyMonthLocks[mIdx];
                      const letter = String.fromCharCode(71 + mIdx);
                      const isLastCol = mIdx === months.length - 1;
                      
                      return (
                        <td 
                          key={m}
                          onClick={() => !isAllLocked && onToggleMonthLock(fy as FiscalYear, mIdx)}
                          onMouseEnter={() => setHoveredCol(letter)}
                          onMouseLeave={() => setHoveredCol(null)}
                          className={`border-r border-slate-100/50 text-center transition-all duration-200 select-none ${isLastCol ? 'border-transparent' : ''} ${
                            isAllLocked
                              ? 'text-slate-300 cursor-not-allowed'
                              : isMonthLocked
                                ? 'bg-rose-50/20 hover:bg-rose-50/50 cursor-pointer text-rose-600'
                                : 'bg-transparent hover:bg-emerald-50/20 cursor-pointer text-slate-400'
                          } ${
                            hoveredCol === letter && !isAllLocked ? 'bg-indigo-50/30' : ''
                          }`}
                          title={isAllLocked ? "Locked by Master Override" : `${m} is ${isMonthLocked ? 'Locked' : 'Unlocked'}. Click to toggle.`}
                        >
                          <div className="h-[48px] px-1 w-full flex items-center justify-center min-w-[60px]">
                            {isAllLocked ? (
                              <Lock className="w-3 h-3 text-slate-300 opacity-60" />
                            ) : isMonthLocked ? (
                              <div className="flex flex-col items-center justify-center animate-fadeIn bg-rose-100/50 p-2 rounded-xl border border-rose-200/50 shadow-sm">
                                <Lock className="w-3 h-3 text-rose-500" />
                              </div>
                            ) : (
                              <div className="group flex items-center justify-center w-full h-full">
                                <div className="w-2.5 h-2.5 rounded-full border border-slate-200 bg-slate-50 group-hover:scale-125 group-hover:bg-emerald-100 group-hover:border-emerald-500 transition-all duration-200" />
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
