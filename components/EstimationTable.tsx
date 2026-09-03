import React, { useState, useRef, useEffect } from 'react';
import { RemarkEntry, FiscalMode, MonthIndex } from '../types';
import { MANPOWER_CATEGORIES, EXPENSE_CATEGORIES, IG_LEVELS, GATE_COLORS } from '../constants';
import { MessageSquare, Plus, X, Users, UserPlus, TrendingUp, CreditCard } from 'lucide-react';

interface EstimationTableProps {
  months: string[];
  igGates: string[];
  manpowerRows: Record<string, number[]>;
  expenseRows: Record<string, number[]>;
  otherManpowerRows?: Record<string, number[]>;
  otherExpenseRows?: Record<string, number[]>;
  monthlyMM: number[];
  monthlyCr: number[];
  directCr?: number[];
  contractedCr?: number[];
  monthlyExpCr: number[];
  grandTotal: number[];
  totalMM: number;
  totalManpowerCr: number;
  totalExpenseCr: number;
  totalBudgetCr: number;
  remarks: Record<string, RemarkEntry[]>;
  onUpdateIgGate: (monthIdx: number, val: string) => void;
  onUpdateEstimation: (category: string, monthIdx: number, value: number, type: 'manpower' | 'expense') => void;
  onUpdateRemark: (category: string, text: string) => void;
  canEdit: boolean;
  isLocked: boolean;
  mode: FiscalMode;
  showRemarks?: boolean;
  isAdmin?: boolean;
  currentMonthIndex?: number;
  monthLocks?: boolean[];
}

const RowRemarkCell = ({ 
  category, 
  remarks = [], 
  onUpdate, 
  disabled 
}: { 
  category: string, 
  remarks: RemarkEntry[], 
  onUpdate: (text: string) => void,
  disabled: boolean
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempText, setTempText] = useState("");
  const lastRemark = remarks.length > 0 ? remarks[remarks.length - 1] : null;

  const handleSave = () => {
    onUpdate(tempText);
    setIsEditing(false);
  };

  return (
    <td className="px-2 py-1 border-b border-slate-100 bg-slate-50/30 min-w-[120px]">
      {isEditing ? (
        <div className="flex items-center space-x-1">
          <input
            type="text"
            value={tempText}
            onChange={(e) => setTempText(e.target.value)}
            className="w-full bg-white border border-indigo-200 rounded px-1 py-0.5 text-[8px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <button onClick={handleSave} className="text-emerald-500 hover:text-emerald-600"><Plus size={10} /></button>
          <button onClick={() => setIsEditing(false)} className="text-rose-500 hover:text-rose-600"><X size={10} /></button>
        </div>
      ) : (
        <div className="flex items-center justify-between group">
          <span className="text-[8px] text-slate-400 italic truncate max-w-[100px]">
            {lastRemark?.text || "No remarks..."}
          </span>
          {!disabled && (
            <button 
              onClick={() => {
                setTempText(lastRemark?.text || "");
                setIsEditing(true);
              }}
              className="opacity-0 group-hover:opacity-100 text-indigo-500 hover:text-indigo-600 transition-opacity"
            >
              <MessageSquare size={10} />
            </button>
          )}
        </div>
      )}
    </td>
  );
};

const EstimationInputCell = ({ val, isDisabled, onChange, className }: { val: number, isDisabled: boolean, onChange: (val: number) => void, className: string }) => {
  const [localVal, setLocalVal] = useState<string | null>(null);

  useEffect(() => {
    setLocalVal(null);
  }, [val]);

  const numVal = (val === undefined || val === null || isNaN(val)) ? 0 : val;
  const roundedVal = Math.round((numVal + Number.EPSILON) * 100) / 100;
  const displayVal = localVal !== null ? localVal : roundedVal.toFixed(2);

  const handleBlur = () => {
    if (localVal !== null) {
      onChange(localVal === '' ? 0 : parseFloat(localVal));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input 
      type="number"
      step="0.01"
      disabled={isDisabled}
      value={displayVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
    />
  );
};

export const EstimationTable: React.FC<EstimationTableProps> = ({
  months,
  igGates,
  manpowerRows,
  expenseRows,
  otherManpowerRows = {},
  otherExpenseRows = {},
  monthlyMM,
  monthlyCr,
  directCr,
  contractedCr,
  monthlyExpCr,
  grandTotal,
  totalMM,
  totalManpowerCr,
  totalExpenseCr,
  totalBudgetCr,
  remarks,
  onUpdateIgGate,
  onUpdateEstimation,
  onUpdateRemark,
  canEdit,
  isLocked,
  mode,
  showRemarks = true,
  isAdmin = false,
  currentMonthIndex = 0,
  monthLocks = []
}) => {
  console.log('EstimationTable manpowerRows:', manpowerRows);
  const [gatePickerMonth, setGatePickerMonth] = useState<number | null>(null);
  const gatePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (gatePickerRef.current && !gatePickerRef.current.contains(e.target as Node)) {
        setGatePickerMonth(null);
      }
    };
    if (gatePickerMonth !== null) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [gatePickerMonth]);

  const handleGateInteraction = (monthIdx: number, currentVal: string) => {
    if (!canEdit || (isLocked && !isAdmin)) return;
    if (currentVal) {
      onUpdateIgGate(monthIdx, '');
      return;
    }
    setGatePickerMonth(monthIdx);
  };

  const setGate = (monthIdx: number, gate: string) => {
    onUpdateIgGate(monthIdx, gate);
    setGatePickerMonth(null);
  };

  const renderRow = (cat: string, row: number[], type: 'manpower' | 'expense', isOther: boolean = false) => {
    const rowSum = row.reduce((a, b) => a + b, 0);
    const avg = rowSum / months.length;
    const isManpower = type === 'manpower';

    const isReadOnly = cat === 'Contracted Employee Expense';
    const isContracted = cat === 'Contracted Employee' || cat === 'Contracted Employee Expense';

    return (
      <tr key={cat} className="hover:bg-slate-50 border-b border-slate-100 transition-colors h-7">
        <td className={`px-4 py-0.5 border-r border-slate-100 sticky left-0 z-10 w-[200px] min-w-[200px] truncate font-bold uppercase tracking-tight pl-8 ${
          isContracted ? 'text-indigo-600 bg-white' : 'text-slate-700 bg-white'
        }`}>
          {cat}
          {isOther && <span className="ml-1 text-[8px] text-indigo-400 font-black tracking-tighter">(CUSTOM)</span>}
        </td>
        {row.map((val, i) => (
          <td key={i} className="px-2 py-0.5 border-r border-slate-100 text-right font-mono p-0 w-[80px] min-w-[80px]">
            <EstimationInputCell
              val={val}
              onChange={(newVal) => onUpdateEstimation(cat, i, newVal, type)}
              isDisabled={!canEdit || (isLocked && !isAdmin) || isReadOnly || (mode === 'Forecast' && (monthLocks.length > 0 ? monthLocks[i] : i < Math.max(0, currentMonthIndex || 0)))}
              className={`w-full h-full text-right pr-2 bg-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all ${(!canEdit || (isLocked && !isAdmin) || isReadOnly || (mode === 'Forecast' && (monthLocks.length > 0 ? monthLocks[i] : i < Math.max(0, currentMonthIndex || 0)))) ? 'cursor-not-allowed opacity-50' : ''}`}
            />
          </td>
        ))}
        <td className="px-4 py-0.5 border-r border-slate-100 text-right font-mono font-black w-[100px] min-w-[100px] bg-slate-50/30">
          {(Math.round((rowSum || 0) * 100) / 100).toFixed(2)}
        </td>
        <td className="px-4 py-0.5 text-right font-mono w-[80px] min-w-[80px] bg-slate-50/30">
          {(Math.round((avg || 0) * 100) / 100).toFixed(2)}
        </td>
        {showRemarks && (
          <RowRemarkCell 
            category={cat} 
            remarks={remarks[cat]} 
            onUpdate={(text) => onUpdateRemark(cat, text)}
            disabled={!canEdit || (isLocked && !isAdmin)}
          />
        )}
      </tr>
    );
  };

    return (
    <tbody className="text-[11px] text-slate-700">
      {/* IG GATE PLANNING */}
      <tr className="bg-slate-900 text-white">
        <td className="px-4 py-1 border-r border-white/10 sticky left-0 bg-slate-900 z-10 text-[9px] font-black uppercase tracking-[0.2em] w-[200px] min-w-[200px]">IG GATE PLANNING</td>
        {months.map((_, i) => {
          const gate = (igGates[i] || '').trim();
          return (
            <td key={i} className="px-1 border-r border-white/10 relative group p-0 w-[80px] min-w-[80px]">
              <button
                onClick={() => handleGateInteraction(i, gate)}
                disabled={!canEdit || (isLocked && !isAdmin)}
                className={`w-full h-5 flex items-center justify-center transition-all ${
                  gate ? GATE_COLORS[gate] || 'bg-indigo-500' : 'bg-white/5 hover:bg-white/10'
                } ${(!canEdit || (isLocked && !isAdmin)) ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <span className="text-[8px] font-black uppercase text-white">{gate || "-"}</span>
              </button>
              
              {gatePickerMonth === i && (
                <div 
                  ref={gatePickerRef}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 grid grid-cols-4 gap-1 min-w-[160px]"
                >
                  {IG_LEVELS.map(g => (
                    <button
                      key={g}
                      onClick={() => setGate(i, g)}
                      className={`px-2 py-1.5 rounded-lg text-[7px] font-black uppercase transition-all border border-white/5 ${GATE_COLORS[g]} text-white hover:scale-110 hover:shadow-lg`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </td>
          );
        })}
        <td className="px-4 py-1 border-r border-white/10 bg-slate-800/50 w-[100px] min-w-[100px]"></td>
        <td className="px-4 py-1 bg-slate-800/50 w-[80px] min-w-[80px]"></td>
        {showRemarks && <td className="px-4 py-1 bg-slate-800/50 min-w-[120px]"></td>}
      </tr>

      {/* MANPOWER SECTION */}
      <tr className="bg-slate-50 font-black text-slate-900 uppercase tracking-widest text-[10px]">
        <td colSpan={months.length + (showRemarks ? 4 : 3)} className="px-4 py-1 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            Direct Manpower (MM)
          </div>
        </td>
      </tr>
      {MANPOWER_CATEGORIES.filter(cat => cat !== 'Contracted Employee').map(cat => renderRow(cat, manpowerRows[cat] || Array(months.length).fill(0), 'manpower'))}
      {Object.entries(otherManpowerRows).map(([cat, row]) => renderRow(cat, row, 'manpower', true))}

      <tr className="bg-slate-50 font-black text-slate-900 uppercase tracking-widest text-[10px]">
        <td colSpan={months.length + (showRemarks ? 4 : 3)} className="px-4 py-1 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-600" />
            Contracted Manpower (MM)
          </div>
        </td>
      </tr>
      {renderRow('Contracted Employee', manpowerRows['Contracted Employee'] || Array(months.length).fill(0), 'manpower')}

      {/* MANPOWER SUMMARY */}
      <tr className="bg-slate-100 font-black text-slate-900 uppercase tracking-widest text-[10px]">
        <td className="px-4 py-1 border-r border-slate-200 sticky left-0 bg-slate-100 z-10 w-[200px] min-w-[200px]">Total Effort (MM)</td>
        {monthlyMM.map((v, i) => (
          <td key={i} className="px-2 py-1 border-r border-slate-200 text-right font-mono w-[80px] min-w-[80px]">{(Math.round((v || 0) * 100) / 100).toFixed(2)}</td>
        ))}
        <td className="px-4 py-1 border-r border-slate-200 text-right font-mono w-[100px] min-w-[100px]">{totalMM.toFixed(2)}</td>
        <td className="px-4 py-1 text-right font-mono w-[80px] min-w-[80px]">{(totalMM / months.length).toFixed(2)}</td>
        {showRemarks && <td className="px-4 py-1 min-w-[120px]"></td>}
      </tr>

      <tr className="h-2" />

      {/* PEOPLE COST SECTION */}
      <tr className="bg-slate-50 font-black text-slate-900 uppercase tracking-widest text-[10px]">
        <td colSpan={months.length + (showRemarks ? 4 : 3)} className="px-4 py-1 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            People Cost (Cr)
          </div>
        </td>
      </tr>
      {/* Direct Employee Cost Row */}
      <tr className="hover:bg-slate-50 border-b border-slate-100 transition-colors h-7">
        <td className="px-4 py-0.5 border-r border-slate-100 sticky left-0 z-10 w-[200px] min-w-[200px] truncate font-bold uppercase tracking-tight pl-8 text-slate-700 bg-white">
          Direct Employee Cost
        </td>
        {(directCr || Array(months.length).fill(0)).map((val, i) => (
          <td key={i} className="px-2 py-0.5 border-r border-slate-100 text-right font-mono w-[80px] min-w-[80px] bg-slate-50/10">
            {(Math.round((val || 0) * 100) / 100).toFixed(2)}
          </td>
        ))}
        <td className="px-4 py-0.5 border-r border-slate-100 text-right font-mono font-black w-[100px] min-w-[100px] bg-slate-50/30">
          {((directCr || []).reduce((a, b) => a + b, 0)).toFixed(2)}
        </td>
        <td className="px-4 py-0.5 text-right font-mono w-[80px] min-w-[80px] bg-slate-50/30">
          {(((directCr || []).reduce((a, b) => a + b, 0) / months.length)).toFixed(2)}
        </td>
        {showRemarks && <td className="px-4 py-0.5 bg-slate-50/30 min-w-[120px]"></td>}
      </tr>
      {/* Contracted Employee Expense Row */}
      {renderRow('Contracted Employee Expense', expenseRows['Contracted Employee Expense'] || Array(months.length).fill(0), 'expense')}

      <tr className="bg-slate-100 font-black text-slate-900 uppercase tracking-widest text-[10px]">
        <td className="px-4 py-1 border-r border-slate-200 sticky left-0 bg-slate-100 z-10 w-[200px] min-w-[200px]">Total People Cost (Cr)</td>
        {monthlyCr.map((v, i) => (
          <td key={i} className="px-2 py-1 border-r border-slate-200 text-right font-mono w-[80px] min-w-[80px]">{(Math.round((v || 0) * 100) / 100).toFixed(2)}</td>
        ))}
        <td className="px-4 py-1 border-r border-slate-200 text-right font-mono w-[100px] min-w-[100px]">{totalManpowerCr.toFixed(2)}</td>
        <td className="px-4 py-1 text-right font-mono w-[80px] min-w-[80px]">{(totalManpowerCr / months.length).toFixed(2)}</td>
        {showRemarks && <td className="px-4 py-1 min-w-[120px]"></td>}
      </tr>

      <tr className="h-2" />

      {/* OPERATIONAL EXPENSES SECTION */}
      <tr className="bg-slate-50 font-black text-slate-900 uppercase tracking-widest text-[10px]">
        <td colSpan={months.length + (showRemarks ? 4 : 3)} className="px-4 py-1 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-orange-600" />
            Operational Expenses (Cr)
          </div>
        </td>
      </tr>
      {EXPENSE_CATEGORIES.filter(cat => cat !== 'Contracted Employee Expense' && cat !== 'Contracted Employee').map(cat => renderRow(cat, expenseRows[cat] || Array(months.length).fill(0), 'expense'))}
      {Object.entries(otherExpenseRows).map(([cat, row]) => renderRow(cat, row, 'expense', true))}

      {/* EXPENSE SUMMARY */}
      <tr className="bg-slate-900 font-black text-white uppercase tracking-[0.2em] text-[10px]">
        <td className="px-4 py-1 border-r border-white/10 sticky left-0 bg-slate-900 z-10 w-[200px] min-w-[200px]">Total Operational Expenses (Cr)</td>
        {monthlyExpCr.map((v, i) => (
          <td key={i} className="px-2 py-1 border-r border-white/10 text-right font-mono w-[80px] min-w-[80px]">{(Math.round((v || 0) * 100) / 100).toFixed(2)}</td>
        ))}
        <td className="px-4 py-1 border-r border-white/10 text-right font-mono w-[100px] min-w-[100px]">{totalExpenseCr.toFixed(2)}</td>
        <td className="px-4 py-1 text-right font-mono w-[80px] min-w-[80px]">{(totalExpenseCr / months.length).toFixed(2)}</td>
        {showRemarks && <td className="px-4 py-1 min-w-[120px]"></td>}
      </tr>

      {/* GRAND TOTAL */}
      <tr className="bg-slate-900 font-black text-white uppercase tracking-[0.2em] text-[10px]">
        <td className="px-4 py-1 border-r border-white/10 sticky left-0 bg-slate-900 z-10 w-[200px] min-w-[200px]">Total Budget (Cr)</td>
        {grandTotal.map((v, i) => (
          <td key={i} className="px-2 py-1 border-r border-white/10 text-right font-mono w-[80px] min-w-[80px]">{(Math.round((v || 0) * 100) / 100).toFixed(2)}</td>
        ))}
        <td className="px-4 py-1 border-r border-white/10 text-right font-mono w-[100px] min-w-[100px]">{totalBudgetCr.toFixed(2)}</td>
        <td className="px-4 py-1 text-right font-mono w-[80px] min-w-[80px]">{(totalBudgetCr / months.length).toFixed(2)}</td>
        {showRemarks && <td className="px-4 py-1 min-w-[120px]"></td>}
      </tr>
    </tbody>
  );
};
