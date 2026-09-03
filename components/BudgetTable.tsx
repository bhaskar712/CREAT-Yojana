import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Download } from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  Legend 
} from 'recharts';
import { EstimationHeader } from './EstimationHeader';
import { EstimationTable } from './EstimationTable';
import { 
  ProjectData, 
  MANPOWER_CATEGORIES, 
  EXPENSE_CATEGORIES,
  MonthIndex,
  ProjectStatus,
  PROJECT_STATUS_OPTIONS,
  MasterConfigState,
  FiscalMode,
  RemarkEntry,
  FiscalYear,
  getMonthsForFY,
  getAbsoluteMonthIndex,
  getPreviousFY,
  getNextFY
} from '../types';
import { MAX_MONTHS, SKILL_MAPPING, isSummaryOrCalculatedLabel, classifyCategory } from '../constants';
import { exportProjectRegistry } from '../services/exportService';

interface BudgetTableProps {
  project: ProjectData;
  config: MasterConfigState;
  hourlyRate: number;
  hoursPerMonth: number;
  isAdmin: boolean;
  canEdit: boolean;
  fiscalMode: FiscalMode;
  selectedFYs: FiscalYear[];
  lockedBy?: { userId: string, username: string };
  onEditStart?: () => void;
  onEditEnd?: () => void;
  allAvailableProjects?: ProjectData[];
  onUpdate: (projectId: string, category: string, month: MonthIndex, value: number, mode: FiscalMode) => void;
  onUpdateTbc: (projectId: string, status: ProjectStatus) => void;
  onUpdateMetadata: (field: string, value: any) => void;
  onShiftTimeline?: (projectId: string, direction: 'forward' | 'backward') => void;
  onCopyData?: (targetId: string, sourceId: string) => void;
  onWipeData?: (projectId: string) => void;
  onDelete: (projectId: string) => void;
}

const IG_LEVELS = ["TBD", "NA", "IG 0", "IG 1", "IG 2", "IG 3", "IG 4", "IG 5", "IG 6", "IG 7", "IG 8", "IG 9"];

const GATE_COLORS: Record<string, string> = {
  "IG 0": "bg-teal-500",
  "IG 1": "bg-sky-500",
  "IG 2": "bg-blue-500",
  "IG 3": "bg-indigo-500",
  "IG 4": "bg-violet-600",
  "IG 5": "bg-purple-700",
  "IG 6": "bg-slate-800",
  "IG 7": "bg-rose-600",
  "IG 8": "bg-orange-600",
  "IG 9": "bg-emerald-600"
};

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const MetaItem = ({ label, value, maxW = "max-w-[80px]" }: { label: string, value: string, maxW?: string }) => (
  <div className="flex items-baseline space-x-1 shrink-0">
    <span className="text-[6px] font-black text-slate-400 uppercase tracking-tighter opacity-70">{label}:</span>
    <span className={`text-[8px] font-black text-slate-700 uppercase truncate ${maxW}`}>{value || 'NA'}</span>
  </div>
);

const RowRemarkCell = ({ 
  category, 
  project, 
  canEdit, 
  isActuallyLocked, 
  isAdmin, 
  onUpdateMetadata 
}: { 
  category: string; 
  project: ProjectData; 
  canEdit: boolean; 
  isActuallyLocked: boolean; 
  isAdmin: boolean; 
  onUpdateMetadata: (field: string, value: any) => void; 
}) => {
  const history = project.rowRemarks?.[category] || [];
  const latest = history[history.length - 1];
  const [local, setLocal] = useState(latest?.text || '');

  useEffect(() => {
    setLocal(latest?.text || '');
  }, [latest?.text]);

  const handleBlur = () => {
    if (local.trim() !== (latest?.text || '')) {
      onUpdateMetadata('rowRemarks', { [category]: local.trim() });
    }
  };

  return (
    <td className="px-2 py-0 border-r border-slate-50 min-w-[120px]">
      <input 
        disabled={!canEdit || (isActuallyLocked && !isAdmin)}
        type="text" 
        value={local} 
        onChange={e => setLocal(e.target.value)}
        onBlur={handleBlur}
        placeholder="..."
        className="w-full h-6 bg-transparent outline-none text-[8px] font-black text-slate-400 uppercase placeholder-slate-200 focus:text-indigo-600" 
        title={latest ? `By ${latest.username} at ${new Date(latest.timestamp).toLocaleString()}` : ""}
      />
    </td>
  );
};

const InfoField = ({ 
  label, 
  field, 
  type = "text", 
  options, 
  project, 
  canEdit, 
  isActuallyLocked, 
  isAdmin, 
  onUpdateMetadata 
}: { 
  label: string; 
  field: string; 
  type?: "text" | "select" | "number"; 
  options?: string[]; 
  project: ProjectData; 
  canEdit: boolean; 
  isActuallyLocked: boolean; 
  isAdmin: boolean; 
  onUpdateMetadata: (field: string, value: any) => void; 
}) => {
  const value = (project as any)[field];
  return (
    <div className="flex flex-col space-y-1">
      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
      {type === "select" ? (
        <select 
          disabled={!canEdit || (isActuallyLocked && !isAdmin)}
          className="h-8 px-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
          value={value || ''}
          onChange={(e) => onUpdateMetadata(field, e.target.value)}
        >
          {options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input 
          disabled={!canEdit || (isActuallyLocked && !isAdmin)}
          type={type}
          step={type === "number" ? "0.01" : undefined}
          className="h-8 px-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
          value={value === undefined || value === null ? '' : value}
          onChange={(e) => onUpdateMetadata(field, type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
        />
      )}
    </div>
  );
};

const BudgetTable: React.FC<BudgetTableProps> = ({ 
  project, 
  config,
  hourlyRate, 
  hoursPerMonth, 
  isAdmin, 
  canEdit, 
  fiscalMode,
  selectedFYs,
  lockedBy,
  onEditStart,
  onEditEnd,
  allAvailableProjects = [],
  onUpdate, 
  onUpdateTbc, 
  onUpdateMetadata, 
  onShiftTimeline, 
  onCopyData,
  onWipeData,
  onDelete
}) => {
  const months = useMemo(() => {
    return selectedFYs.flatMap(fy => getMonthsForFY(fy));
  }, [selectedFYs]);

  const hasDataForFY = useCallback((fy: FiscalYear | null) => {
    if (!fy) return false;
    const fyMonths = getMonthsForFY(fy);
    if (fyMonths.length === 0) return false;
    const startMonth = fyMonths[0] || 'Apr-25';
    const yearOffset = getAbsoluteMonthIndex(startMonth);
    const offset = project.timelineOffset || 0;
    
    let hasData = false;
    
    // Check all data sources
    const budgetSource = (project.rows && Object.keys(project.rows).length > 0) ? project.rows : { ...(project.skills || {}), ...(project.expenses || {}) };
    const sources = [budgetSource, project.actuals, project.forecast];
    for (const source of sources) {
      if (!source) continue;
      for (const cat of Object.keys(source)) {
        const arr = source[cat];
        if (!arr) continue;
        for (let i = 0; i < 12; i++) {
          const absoluteIdx = i + yearOffset - offset;
          if (absoluteIdx >= 0 && absoluteIdx < MAX_MONTHS && arr[absoluteIdx] > 0) {
            hasData = true;
            break;
          }
        }
        if (hasData) break;
      }
      if (hasData) break;
    }
    
    // Check IG Gates
    if (!hasData && project.igGates) {
      for (let i = 0; i < 12; i++) {
        const absoluteIdx = i + yearOffset - offset;
        if (absoluteIdx >= 0 && absoluteIdx < MAX_MONTHS && project.igGates[absoluteIdx] && project.igGates[absoluteIdx] !== 'NA' && project.igGates[absoluteIdx] !== 'TBD') {
          hasData = true;
          break;
        }
      }
    }
    
    return hasData;
  }, [project]);

  const [isExpanded, setIsExpanded] = useState(false);
  
  useEffect(() => {
    if (isExpanded && onEditStart) {
      onEditStart();
    } else if (!isExpanded && onEditEnd) {
      onEditEnd();
    }
  }, [isExpanded, onEditStart, onEditEnd]);
  const [activeInnerTab, setActiveInnerTab] = useState<'info' | 'estimation' | 'analytics'>('info');
  const [gatePickerMonth, setGatePickerMonth] = useState<number | null>(null);
  const gatePickerRef = useRef<HTMLDivElement>(null);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copyData, setCopyData] = useState<{ sourceId: string, targetId: string } | null>(null);
  
  const toCrs = (inr: number) => inr / 10000000;
  const offset = project.timelineOffset || 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (gatePickerRef.current && !gatePickerRef.current.contains(e.target as Node)) {
        setGatePickerMonth(null);
      }
    };
    if (gatePickerMonth !== null) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [gatePickerMonth]);

  const handleExportProject = async () => {
    try {
      const currentMonths = getMonthsForFY(selectedFYs[0]);
      await exportProjectRegistry([project], config, selectedFYs[0], currentMonths, fiscalMode, false, undefined, true);
    } catch (e) {
      console.error("Export failed:", e);
      alert("Export failed.");
    }
  };

  const handleToggleExpand = () => {
    const nextState = !isExpanded;
    setIsExpanded(nextState);
    if (nextState) {
      onEditStart?.();
    } else {
      onEditEnd?.();
      setActiveInnerTab('info'); // Reset to default 'Project Info' tab on close
    }
  };

  const displayGates = useMemo(() => {
    const rawGates = project.igGates || [];
    const gates = Array(months.length).fill("");
    const startMonth = months[0] || 'Apr-25';
    const yearOffset = getAbsoluteMonthIndex(startMonth);
    for (let i = 0; i < months.length; i++) {
      const dataIdx = i + yearOffset;
      if (dataIdx >= 0 && dataIdx < MAX_MONTHS) {
        gates[i] = (rawGates[dataIdx] || '').trim();
      }
    }
    return gates;
  }, [project.igGates, offset, months]);

  const handleGateInteraction = (monthIdx: number, currentVal: string) => {
    if (!canEdit || (isActuallyLocked && !isAdmin)) return;
    const startMonth = months[0] || 'Apr-25';
    const yearOffset = getAbsoluteMonthIndex(startMonth);
    const absoluteMonthIdx = monthIdx + yearOffset;
    if (currentVal) {
      onUpdateMetadata('igGateUpdate', { monthIdx: absoluteMonthIdx, gateVal: '' });
      return;
    }
    setGatePickerMonth(monthIdx);
  };

  const setGate = (monthIdx: number, gate: string) => {
    const startMonth = months[0] || 'Apr-25';
    const yearOffset = getAbsoluteMonthIndex(startMonth);
    const absoluteMonthIdx = monthIdx + yearOffset;
    onUpdateMetadata('igGateUpdate', { monthIdx: absoluteMonthIdx, gateVal: gate });
    setGatePickerMonth(null);
  };

  const getVisibleRows = (dataSource: Record<string, number[]> | undefined, categories: string[], isOther: boolean = false, fallbackSource?: Record<string, number[]>) => {
    const rows: Record<string, number[]> = {};
    if (!dataSource && !fallbackSource) return rows;
    const startMonth = months[0] || 'Apr-25';
    const yearOffset = getAbsoluteMonthIndex(startMonth);
    
    const targetCats = isOther 
      ? Array.from(new Set([...Object.keys(dataSource || {}), ...Object.keys(fallbackSource || {})])).filter(k => {
          const lowerK = k.toLowerCase().trim();
          return !MANPOWER_CATEGORIES.some(m => m.toLowerCase() === lowerK) && 
                 !EXPENSE_CATEGORIES.some(e => e.toLowerCase() === lowerK) &&
                 lowerK !== 'contracted employee' &&
                 lowerK !== 'contracted employee expense' &&
                 !isSummaryOrCalculatedLabel(k);
        })
      : categories;

    targetCats.forEach(cat => {
      const lowerCat = cat.toLowerCase().trim();
      let fullRow: number[] | undefined;
      
      if (dataSource) {
        const key = Object.keys(dataSource).find(k => k.toLowerCase().trim() === lowerCat);
        if (key) fullRow = dataSource[key];
      }
      
      if (!fullRow && fallbackSource) {
        const key = Object.keys(fallbackSource).find(k => k.toLowerCase().trim() === lowerCat);
        if (key) fullRow = fallbackSource[key];
      }
      
      if (!fullRow) fullRow = Array(MAX_MONTHS).fill(0);
      
      rows[cat] = Array(months.length).fill(0).map((_, i) => {
        const dataIdx = i + yearOffset;
        return (dataIdx >= 0 && dataIdx < MAX_MONTHS) ? (fullRow as number[])[dataIdx] : 0;
      });
    });
    return rows;
  };

  const hasMeaningfulData = (data: Record<string, number[]>) => {
    return Object.values(data).some(arr => arr.some(v => v !== 0));
  };

  const budgetSource = useMemo(() => {
    if (project.rows && Object.keys(project.rows).length > 0) return project.rows;
    return { ...(project.skills || {}), ...(project.expenses || {}) };
  }, [project.rows, project.skills, project.expenses]);

  const visibleBudgetManpower = useMemo(() => getVisibleRows(budgetSource, [...MANPOWER_CATEGORIES, 'Contracted Employee'] as any, false), [budgetSource, offset]);
  const visibleActualManpower = useMemo(() => getVisibleRows(project.actuals || {}, [...MANPOWER_CATEGORIES, 'Contracted Employee'] as any), [project.actuals, offset]);
  
  const visibleBudgetExpenses = useMemo(() => getVisibleRows(budgetSource, EXPENSE_CATEGORIES as any, false), [budgetSource, offset]);
  const visibleActualExpenses = useMemo(() => getVisibleRows(project.actuals || {}, EXPENSE_CATEGORIES as any), [project.actuals, offset]);
  const visibleForecastManpower = useMemo(() => getVisibleRows(project.forecast || {}, [...MANPOWER_CATEGORIES, 'Contracted Employee'] as any), [project.forecast, offset]);
  const visibleForecastExpenses = useMemo(() => getVisibleRows(project.forecast || {}, EXPENSE_CATEGORIES as any), [project.forecast, offset]);

  // Handle unknown categories (Other Skills/Expenses)
  const visibleBudgetOthers = useMemo(() => getVisibleRows(budgetSource, [], true), [budgetSource, offset]);
  const visibleActualOthers = useMemo(() => getVisibleRows(project.actuals || {}, [], true), [project.actuals, offset]);
  const visibleForecastOthers = useMemo(() => getVisibleRows(project.forecast || {}, [], true), [project.forecast, offset]);

  const calculateAggregates = (manpowerRows: Record<string, number[]>, expenseRows: Record<string, number[]>, otherRows: Record<string, number[]> = {}) => {
    const monthlyMM = Array(months.length).fill(0);
    const contractedMM = Array(months.length).fill(0);

    Object.entries(manpowerRows).forEach(([rawCat, row]) => {
      const cat = SKILL_MAPPING[rawCat] || rawCat;
      if (Array.isArray(row)) {
        if (cat === 'Contracted Employee') {
          row.forEach((v, i) => { if (i < contractedMM.length) contractedMM[i] += (v || 0); });
        } else {
          row.forEach((v, i) => { if (i < monthlyMM.length) monthlyMM[i] += (v || 0); });
        }
      }
    });

    const monthlyCr = monthlyMM.map(mm => toCrs(mm * 180 * hourlyRate));
    
    const primaryFY = selectedFYs[0];
    const fy = project.fiscalYear || primaryFY;
    const fyConfig = config.fyFinancials?.[fy];
    const contractedRate = (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) 
      ? fyConfig.contractedEmployeeRate 
      : (config.contractedEmployeeRate || 1650);
    // User requested "ground is always 180 hours"
    const hpm = 180;
    
    const monthlyExpCr = Array(months.length).fill(0);
    
    const contractedCr = contractedMM.map((mm, i) => {
      // ALWAYS calculate from MM to ensure it's dynamic
      if (mm > 0) return Math.round(toCrs(mm * hpm * contractedRate) * 100) / 100;
      return 0;
    });

    Object.entries(expenseRows).forEach(([cat, row]) => {
      const mappedCat = SKILL_MAPPING[cat] || cat;
      if (Array.isArray(row)) {
        if (mappedCat === 'Contracted Employee') {
          // Skip, handled via contractedMM
        } else if (mappedCat === 'Contracted Employee Expense') {
          row.forEach((v, i) => { 
            // Only add if there's no manpower for this month to avoid double counting
            if (i < monthlyExpCr.length && (contractedMM[i] || 0) === 0) {
              contractedCr[i] += toCrs(v || 0); 
            }
          });
        } else {
          row.forEach((v, i) => { if (i < monthlyExpCr.length) monthlyExpCr[i] += toCrs(v || 0); });
        }
      }
    });

    Object.entries(otherRows).forEach(([cat, row]) => {
      if (isSummaryOrCalculatedLabel(cat)) return;
      if (Array.isArray(row)) {
        const catKind = classifyCategory(cat);
        const isManpower = catKind === 'DIRECT_MANPOWER' || catKind === 'CONTRACTED_MANPOWER' || catKind === 'UNKNOWN_MANPOWER';

        if (isManpower) {
          row.forEach((v, i) => { 
            const mm = v || 0;
            if (i < monthlyMM.length) {
              monthlyMM[i] += mm;
              monthlyCr[i] += toCrs(mm * hpm * hourlyRate);
            }
          });
        } else {
          row.forEach((v, i) => { if (i < monthlyExpCr.length) monthlyExpCr[i] += toCrs(v || 0); });
        }
      }
    });
    
    const totalMM = monthlyMM.map((mm, i) => mm + (contractedMM[i] || 0));
    const totalManpowerCr = monthlyCr.map((cr, i) => cr + (contractedCr[i] || 0));
    const grandTotal = totalManpowerCr.map((mCr, i) => mCr + monthlyExpCr[i]);
    
    return {
      monthlyMM: totalMM,
      monthlyCr: totalManpowerCr,
      monthlyExpCr,
      grandTotal,
      contractedCr,
      aggMM: totalMM.reduce((a, b) => a + b, 0),
      aggCr: totalManpowerCr.reduce((a, b) => a + b, 0),
      aggExpCr: monthlyExpCr.reduce((a, b) => a + b, 0),
      aggTotalCr: grandTotal.reduce((a, b) => a + b, 0)
    };
  };

  const budgetStats = useMemo(() => calculateAggregates(visibleBudgetManpower, visibleBudgetExpenses, visibleBudgetOthers), [visibleBudgetManpower, visibleBudgetExpenses, visibleBudgetOthers]);
  const actualStats = useMemo(() => calculateAggregates(visibleActualManpower, visibleActualExpenses, visibleActualOthers), [visibleActualManpower, visibleActualExpenses, visibleActualOthers]);
  const forecastStats = useMemo(() => calculateAggregates(visibleForecastManpower, visibleForecastExpenses, visibleForecastOthers), [visibleForecastManpower, visibleForecastExpenses, visibleForecastOthers]);

  const burnRate = budgetStats.aggTotalCr > 0 ? (actualStats.aggTotalCr / budgetStats.aggTotalCr) * 100 : 0;

  const pjFY = project.fiscalYear || selectedFYs[0] || 'FY 25-26';
  const isActuallyLocked = !!lockedBy || 
    !!config.isFiscalLocked || 
    !!config.fiscalLocks?.[`budget_page_${pjFY}`] || 
    (selectedFYs.includes('All FY') 
      ? Object.keys(config.fiscalLocks || {}).some(k => k.startsWith('budget_page_') && config.fiscalLocks?.[k])
      : selectedFYs.some(fy => !!config.fiscalLocks?.[`budget_page_${fy}`])
    );

  const fmtTotal = (val: number) => (val || 0).toFixed(2);

  const startMonthForIndex = months[0] || 'Apr-25';
  const yearOffsetForIndex = getAbsoluteMonthIndex(startMonthForIndex);
  const currentMonthIndex = useMemo(() => {
    const now = new Date();
    const currentAbs = (now.getFullYear() - 2019) * 12 + (now.getMonth() - 3);
    return currentAbs - yearOffsetForIndex;
  }, [yearOffsetForIndex]);
  const forecastHorizon = project.forecastMonths || config.defaultForecastMonths || 3;

  const getCompositeForecastStats = () => {
    const monthlyMM = Array(months.length).fill(0);
    const monthlyCr = Array(months.length).fill(0);
    const monthlyExpCr = Array(months.length).fill(0);
    const grandTotal = Array(months.length).fill(0);
    const contractedCr = Array(months.length).fill(0);

    for (let i = 0; i < months.length; i++) {
      if (i >= currentMonthIndex && i < currentMonthIndex + forecastHorizon) {
        // Forecast Window: Use Forecast
        monthlyMM[i] = forecastStats.monthlyMM[i];
        monthlyCr[i] = forecastStats.monthlyCr[i];
        monthlyExpCr[i] = forecastStats.monthlyExpCr[i];
        contractedCr[i] = (forecastStats as any).contractedCr?.[i] || 0;
      } else if (i < currentMonthIndex) {
        // Past: Use Actuals
        monthlyMM[i] = actualStats.monthlyMM[i];
        monthlyCr[i] = actualStats.monthlyCr[i];
        monthlyExpCr[i] = actualStats.monthlyExpCr[i];
        contractedCr[i] = (actualStats as any).contractedCr?.[i] || 0;
      } else {
        // Future: Use Budget
        monthlyMM[i] = budgetStats.monthlyMM[i];
        monthlyCr[i] = budgetStats.monthlyCr[i];
        monthlyExpCr[i] = budgetStats.monthlyExpCr[i];
        contractedCr[i] = (budgetStats as any).contractedCr?.[i] || 0;
      }
      grandTotal[i] = monthlyCr[i] + monthlyExpCr[i];
    }

    return {
      monthlyMM,
      monthlyCr,
      monthlyExpCr,
      grandTotal,
      contractedCr,
      aggMM: monthlyMM.reduce((a, b) => a + b, 0),
      aggCr: monthlyCr.reduce((a, b) => a + b, 0),
      aggExpCr: monthlyExpCr.reduce((a, b) => a + b, 0),
      aggTotalCr: grandTotal.reduce((a, b) => a + b, 0)
    };
  };

  const compositeForecastStats = useMemo(() => getCompositeForecastStats(), [actualStats, forecastStats, budgetStats, currentMonthIndex, forecastHorizon]);

  const currentDisplayStats = fiscalMode === 'Actuals' ? actualStats : (fiscalMode === 'Forecast' ? compositeForecastStats : budgetStats);

  const getRowData = (cat: string, type: 'manpower' | 'expense' | 'other') => {
    let budgetRow: number[];
    let actualRow: number[];
    let forecastRow: number[];

    if (cat === 'Contracted Employee Expense') {
      return currentDisplayStats.contractedCr || Array(months.length).fill(0);
    }

    if (type === 'manpower') {
      budgetRow = visibleBudgetManpower[cat] || Array(months.length).fill(0);
      actualRow = visibleActualManpower[cat] || Array(months.length).fill(0);
      forecastRow = visibleForecastManpower[cat] || Array(months.length).fill(0);
    } else if (type === 'expense') {
      budgetRow = visibleBudgetExpenses[cat] || Array(months.length).fill(0);
      actualRow = visibleActualExpenses[cat] || Array(months.length).fill(0);
      forecastRow = visibleForecastExpenses[cat] || Array(months.length).fill(0);
    } else {
      budgetRow = visibleBudgetOthers[cat] || Array(months.length).fill(0);
      actualRow = visibleActualOthers[cat] || Array(months.length).fill(0);
      forecastRow = visibleForecastOthers[cat] || Array(months.length).fill(0);
    }
    
    return Array(months.length).fill(0).map((_, i) => {
      let val = 0;
      if (fiscalMode === 'Actuals') val = actualRow[i];
      else if (fiscalMode === 'Forecast') {
        if (i >= currentMonthIndex && i < currentMonthIndex + forecastHorizon) val = forecastRow[i];
        else if (i < currentMonthIndex) val = actualRow[i];
        else val = budgetRow[i];
      } else {
        val = budgetRow[i];
      }
      
      if (type === 'expense' || (type === 'other' && !MANPOWER_CATEGORIES.some(m => m.toLowerCase() === cat.toLowerCase()))) {
        if (cat === 'Contracted Employee') {
          return val; // MM
        } else if (cat === 'Contracted Employee Expense') {
          const primaryFY = selectedFYs[0];
          const fy = project.fiscalYear || primaryFY;
          const fyConfig = config.fyFinancials?.[fy];
          const contractedRate = (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) 
            ? fyConfig.contractedEmployeeRate 
            : (config.contractedEmployeeRate || 1650);
          const hpm = 180;
          
          let mmVal = 0;
          if (fiscalMode === 'Actuals') mmVal = visibleActualExpenses['Contracted Employee']?.[i] || 0;
          else if (fiscalMode === 'Forecast') {
            if (i >= currentMonthIndex && i < currentMonthIndex + forecastHorizon) mmVal = visibleForecastExpenses['Contracted Employee']?.[i] || 0;
            else if (i < currentMonthIndex) mmVal = visibleActualExpenses['Contracted Employee']?.[i] || 0;
            else mmVal = visibleBudgetExpenses['Contracted Employee']?.[i] || 0;
          } else {
            mmVal = visibleBudgetExpenses['Contracted Employee']?.[i] || 0;
          }
          return Math.round(toCrs(mmVal * hpm * contractedRate) * 100) / 100;
        }
        return toCrs(val);
      }
      return val;
    });
  };

  const manpowerRowsData = Object.fromEntries([...MANPOWER_CATEGORIES, 'Contracted Employee'].map(cat => [cat, getRowData(cat, cat === 'Contracted Employee' ? 'expense' : 'manpower')]));
  const expenseRowsData = Object.fromEntries(EXPENSE_CATEGORIES.filter(cat => cat !== 'Contracted Employee').map(cat => [cat, getRowData(cat, 'expense')]));
  const otherManpowerRowsData = Object.fromEntries(
    Object.keys(visibleBudgetOthers)
      .filter(cat => MANPOWER_CATEGORIES.some(m => m.toLowerCase() === cat.toLowerCase()))
      .map(cat => [cat, getRowData(cat, 'other')])
  );
  const otherExpenseRowsData = Object.fromEntries(
    Object.keys(visibleBudgetOthers)
      .filter(cat => !MANPOWER_CATEGORIES.some(m => m.toLowerCase() === cat.toLowerCase()))
      .map(cat => [cat, getRowData(cat, 'other')])
  );

  // Analysis Data
  const analysisData = useMemo(() => {
    return months.map((m, i) => ({
      name: m,
      manpower: currentDisplayStats.monthlyCr[i] || 0,
      expense: currentDisplayStats.monthlyExpCr[i] || 0,
      total: currentDisplayStats.grandTotal[i] || 0,
      mm: currentDisplayStats.monthlyMM[i] || 0
    }));
  }, [months, currentDisplayStats]);

  const pieData = useMemo(() => [
    { name: 'Manpower', value: currentDisplayStats.aggCr || 0, color: '#4f46e5' },
    { name: 'Expense', value: currentDisplayStats.aggExpCr || 0, color: '#10b981' }
  ], [currentDisplayStats]);

  return (
    <div className={`bg-white rounded-xl shadow-xs border transition-all ${isActuallyLocked ? 'border-amber-200 ring-1 ring-amber-50' : project.status !== 'Active' ? 'border-orange-100' : 'border-slate-200'} overflow-hidden w-full relative mb-1`}>
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteId(null)}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
             <div className="p-8 text-center">
                <h3 className="text-lg font-black text-slate-800 mb-2">Confirm Delete</h3>
                <p className="text-sm text-slate-500 mb-6">Are you sure you want to delete this project? This action cannot be undone.</p>
                <div className="flex gap-4">
                   <button onClick={() => setDeleteId(null)} className="flex-1 py-2 rounded-xl text-xs font-black uppercase bg-slate-100 hover:bg-slate-200">Cancel</button>
                   <button onClick={() => { onDelete(deleteId); setDeleteId(null); }} className="flex-1 py-2 rounded-xl text-xs font-black uppercase bg-rose-600 text-white hover:bg-rose-700">Delete</button>
                </div>
             </div>
          </div>
        </div>
      )}
      {copyData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCopyData(null)}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
             <div className="p-8 text-center">
                <h3 className="text-lg font-black text-slate-800 mb-2">Confirm Clone</h3>
                <p className="text-sm text-slate-500 mb-6">Are you sure you want to clone data from the selected project? This will overwrite existing data.</p>
                <div className="flex gap-4">
                   <button onClick={() => setCopyData(null)} className="flex-1 py-2 rounded-xl text-xs font-black uppercase bg-slate-100 hover:bg-slate-200">Cancel</button>
                   <button onClick={() => { onCopyData?.(copyData.sourceId, copyData.targetId); setCopyData(null); }} className="flex-1 py-2 rounded-xl text-xs font-black uppercase bg-indigo-600 text-white hover:bg-indigo-700">Clone</button>
                </div>
             </div>
          </div>
        </div>
      )}
      {isActuallyLocked && lockedBy && (
        <div className="absolute top-0 right-0 bg-amber-500 text-white px-3 py-0.5 rounded-bl-lg text-[6px] font-black uppercase tracking-widest z-10 animate-pulse shadow-xs">
          Editing: {lockedBy.username}
        </div>
      )}

      {/* Card Header (Collapsed Summary) */}
      <div className={`flex flex-col lg:flex-row lg:items-center justify-between px-3 sm:px-4 py-2 cursor-pointer ${isActuallyLocked ? 'bg-amber-50/20' : 'bg-white hover:bg-slate-50/30'} transition-all select-none gap-2`} onClick={handleToggleExpand}>
        <div className="flex items-center space-x-3 min-w-0 flex-grow">
          <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 shrink-0 ${isExpanded ? 'rotate-90 text-indigo-500' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M9 5l7 7-7 7" /></svg>
          <span className="bg-[#001e3c] text-white px-2 py-1 rounded-full text-[8px] font-black uppercase shrink-0 shadow-xs leading-none border border-white/10">{project.code}</span>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
            <h3 className={`font-black text-[11px] truncate leading-none uppercase tracking-tight transition-all ${project.status === 'Closed' ? 'text-red-500 line-through opacity-70' : 'text-slate-900'}`}>{project.name}</h3>
            <div className="hidden sm:flex items-center space-x-3 shrink-0 border-l border-slate-100 pl-3">
               <MetaItem label="DOM" value={project.buDomain} maxW="max-w-[40px]" />
               <MetaItem label="BU" value={project.businessUnit} maxW="max-w-[50px]" />
               <MetaItem label="MODE" value={fiscalMode === 'Forecast' ? 'BUDGET (EXEC)' : fiscalMode} maxW="max-w-[100px]" />
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-3 sm:gap-5 shrink-0">
          <div className="flex items-center divide-x divide-slate-100 gap-0">
            <div className="flex flex-col px-3 text-center"><span className="text-[6px] text-slate-400 uppercase font-black tracking-tighter leading-none mb-0.5">MM</span><span className="text-[11px] font-black text-slate-900 leading-none">{fmtTotal(currentDisplayStats.aggMM)}</span></div>
            <div className="flex flex-col px-3 text-center"><span className="text-[6px] text-blue-500 uppercase font-black tracking-tighter leading-none mb-0.5">MANPOWER</span><span className="text-[11px] font-black text-blue-600 leading-none">{fmtTotal(currentDisplayStats.aggCr)}</span></div>
            <div className="flex flex-col px-3 text-center"><span className="text-[6px] text-emerald-500 uppercase font-black tracking-tighter leading-none mb-0.5">EXPENSE</span><span className="text-[11px] font-black text-emerald-600 leading-none">{fmtTotal(currentDisplayStats.aggExpCr)}</span></div>
            <div className="flex flex-col px-3 text-right"><span className="text-[6px] text-indigo-500 uppercase font-black tracking-tighter mb-0.5">TOTAL</span><span className="text-[12px] font-black text-indigo-700 leading-none">{fmtTotal(currentDisplayStats.aggTotalCr)}</span></div>
          </div>

          <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
            <button 
              onClick={(e) => { e.stopPropagation(); handleExportProject(); }} 
              title={`Export specific Excel data for project ${project.code}`}
              className="p-1.5 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-100/50 hover:border-indigo-600 shadow-xs transition-all active:scale-95 flex items-center justify-center cursor-pointer group"
            >
              <Download className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </button>
            <select
              value={project.tbc !== undefined && project.tbc !== null ? String(project.tbc) : "Yes"}
              onChange={(e) => {
                onUpdateMetadata('tbc', e.target.value);
              }}
              disabled={!canEdit || (isActuallyLocked && !isAdmin)}
              className="px-2 py-1 rounded-lg border border-slate-200 text-[8px] font-black uppercase tracking-tighter bg-slate-50 text-slate-700 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50"
              title="TBC Status"
            >
              <option value="Yes">TBC: Yes</option>
              <option value="No">TBC: No</option>
              <option value="TBD">TBC: TBD</option>
            </select>
            {project.status && (
              <div className={`px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-tighter transition-all shadow-xs ${
                project.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                project.status === 'Closed' ? 'bg-red-50 text-red-700 border-red-100' :
                'bg-amber-50 text-amber-700 border-amber-100'
              }`}>
                {project.status}
              </div>
            )}
            {isAdmin && (
              <div className="flex items-center space-x-0.5 border-l border-slate-100 pl-1.5">
                <button 
                  onClick={(e) => { e.stopPropagation(); onUpdateMetadata('isLocked', !project.isLocked); }}
                  className={`p-1.5 rounded-lg transition-all ${project.isLocked ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'text-slate-300 hover:bg-slate-50'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {project.isLocked ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 11V7a4 1 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>
                    )}
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Workspace */}
      {isExpanded && (
        <div className="border-t border-slate-100 p-0 animate-fadeIn relative flex flex-col">
          {/* Tab Selector & Toolbar */}
          <div className="bg-slate-50 border-b border-slate-100 px-4 py-1.5 flex flex-wrap items-center justify-between gap-4">
             <div className="flex items-center bg-white p-1 rounded-xl shadow-xs border border-slate-200">
                <button 
                  onClick={() => setActiveInnerTab('info')}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeInnerTab === 'info' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Project Info
                </button>
                <button 
                  onClick={() => setActiveInnerTab('estimation')}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeInnerTab === 'estimation' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Estimation
                </button>
                <button 
                  onClick={() => setActiveInnerTab('analytics')}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeInnerTab === 'analytics' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Analytics
                </button>
             </div>

             <div className="flex items-center gap-4">
               {activeInnerTab === 'estimation' && fiscalMode === 'Budget' && (
                 <div className="flex items-center space-x-1.5 border-r border-slate-200 pr-4">
                   <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Timeline:</span>
                   <button disabled={!canEdit || (isActuallyLocked && !isAdmin)} onClick={(e) => { e.stopPropagation(); onShiftTimeline?.(project.id, 'backward'); }} className="h-7 px-3 bg-white border border-slate-200 rounded-lg text-[7px] font-black text-slate-600 hover:bg-slate-50 shadow-xs uppercase transition-all">Accel (-1M)</button>
                   <button disabled={!canEdit || (isActuallyLocked && !isAdmin)} onClick={(e) => { e.stopPropagation(); onShiftTimeline?.(project.id, 'forward'); }} className="h-7 px-3 bg-white border border-slate-200 rounded-lg text-[7px] font-black text-slate-600 hover:bg-slate-50 shadow-xs uppercase transition-all">Delay (+1M)</button>
                 </div>
               )}
               
               <div className="flex items-center space-x-1.5">
                 <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Maintenance:</span>
                 <div className="relative">
                   <button disabled={!canEdit || (isActuallyLocked && !isAdmin)} onClick={(e) => { e.stopPropagation(); setIsCopyMode(!isCopyMode); }} className={`h-7 w-7 flex items-center justify-center rounded-lg border transition-all ${isCopyMode ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600 shadow-xs'}`}>
                     <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                   </button>
                   {isCopyMode && (
                     <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-[100] p-3 animate-fadeIn">
                       <p className="text-[8px] font-black text-slate-400 uppercase mb-2">Clone data from project:</p>
                       <div className="max-h-48 overflow-y-auto space-y-1 no-scrollbar">
                         {allAvailableProjects.filter(p => p.id !== project.id).map(p => (
                           <button key={p.id} onClick={() => { setCopyData({ sourceId: p.id, targetId: project.id }); setIsCopyMode(false); }} className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-indigo-50 text-[9px] font-black text-slate-600 uppercase truncate transition-all">
                             {p.code}: {p.name}
                           </button>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>
                 <button disabled={!canEdit || (isActuallyLocked && !isAdmin)} onClick={(e) => { e.stopPropagation(); setDeleteId(project.id); }} className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 shadow-xs transition-all">
                   <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                 </button>
               </div>
             </div>
          </div>

          {/* Inner Content Area */}
          {activeInnerTab === 'info' && (
            <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-4 gap-4 animate-fadeIn">
               <div className="md:col-span-1 space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                     <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">Core Identity</h4>
                     <div className="space-y-3">
                        <InfoField label="Project Code" field="code" project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                        <InfoField label="Project Name" field="name" project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                        <InfoField label="Vertical" field="vertical" type="select" options={config.verticals} project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                        <InfoField label="Status" field="status" type="select" options={PROJECT_STATUS_OPTIONS} project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                        <InfoField label="TBC" field="tbc" type="select" options={['Yes', 'No', 'TBD']} project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                     </div>
                  </div>
                  <div className="bg-indigo-50/30 p-4 rounded-xl border border-indigo-100/50">
                     <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-3">Realization Metrics</h4>
                     <div className="grid grid-cols-2 gap-3">
                        <div>
                           <span className="text-[7px] font-black text-slate-400 uppercase block mb-1">FY BUDGET</span>
                           <span className="text-sm font-black text-indigo-600 font-mono tracking-tighter">₹{currentDisplayStats.aggTotalCr.toFixed(0)}</span>
                        </div>
                        <div>
                           <span className="text-[7px] font-black text-slate-400 uppercase block mb-1">REMAINING</span>
                           <span className="text-sm font-black text-slate-900 font-mono tracking-tighter">
                             ₹{((project.prevYearBudget || 0) - (project.expenseTillMar26 || 0)).toFixed(0)}
                           </span>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="md:col-span-2 grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 border-l-4 border-slate-200">Domain & Function</h4>
                    <InfoField label="Domain" field="buDomain" type="select" options={config.buDomains} project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                    <InfoField label="Business Unit" field="businessUnit" type="select" options={config.businessUnits} project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                    <InfoField label="Product Family" field="productFamily" type="select" options={config.productFamilies} project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                    <InfoField label="PDH / Manager" field="pdh" project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                  </div>
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 border-l-4 border-slate-200">Market Profile</h4>
                    <InfoField label="Project Type" field="projectType" type="select" options={config.projectTypes} project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                    <InfoField label="Customer" field="customer" project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                    <InfoField label="Category" field="category" type="select" options={config.projectCategories} project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                    <InfoField label="Generation" field="generation" type="select" options={['Current', 'Level Up + 1', 'Level Up + 2']} project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                    <div className="grid grid-cols-2 gap-3">
                       <InfoField label="PACE" field="pace" type="select" options={config.paces} project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                       <InfoField label="Segment" field="segment" type="select" options={config.segments} project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                    </div>
                  </div>
               </div>

               <div className="md:col-span-1 space-y-6">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4">Milestone Context</h4>
                     <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                           <InfoField label="SOP Month" field="sopMonth" type="select" options={Array.from(new Set(months.map(m => m.split('-')[0])))} project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                           <InfoField label="SOP FY" field="sopFyYear" project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                        </div>
                        <InfoField label="Current IG Gate" field="currentGate" type="select" options={IG_LEVELS} project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                        <InfoField label="Budget Horizon (Months)" field="forecastMonths" type="number" project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                     </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Carry-over Financials</h4>
                     <div className="space-y-4">
                        <InfoField label="Prev. Budget" field="prevYearBudget" type="number" project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                        <InfoField label="Exp till Mar'26" field="expenseTillMar26" type="number" project={project} canEdit={canEdit} isActuallyLocked={isActuallyLocked} isAdmin={isAdmin} onUpdateMetadata={onUpdateMetadata} />
                     </div>
                  </div>
               </div>

               <div className="md:col-span-4 mt-4">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Project Remarks History</label>
                  <textarea 
                    disabled={!canEdit || (isActuallyLocked && !isAdmin)}
                    className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-100 uppercase transition-all"
                    placeholder="ENTER PROJECT LEVEL REMARKS..."
                    value={project.remarks && project.remarks.length > 0 ? project.remarks[project.remarks.length - 1].text : ''}
                    onChange={(e) => onUpdateMetadata('remarks', e.target.value)}
                  />
                  {project.remarks && project.remarks.length > 0 && (
                    <p className="mt-2 text-[7px] font-black text-slate-400 uppercase tracking-tighter italic">
                      Last edited by {project.remarks[project.remarks.length - 1].username} at {new Date(project.remarks[project.remarks.length - 1].timestamp).toLocaleString()}
                    </p>
                  )}
               </div>
            </div>
          )}

          {activeInnerTab === 'estimation' && (
            <div className="overflow-x-auto no-scrollbar animate-fadeIn">
              <table className="w-full text-left border-separate border-spacing-0">
                <EstimationHeader 
                  months={months} 
                  currentMonthIndex={currentMonthIndex} 
                  forecastHorizon={forecastHorizon} 
                  fiscalMode={fiscalMode} 
                  title={selectedFYs.join(', ')} 
                  showRemarks={true} 
                />
                <EstimationTable
                  months={months}
                  igGates={displayGates}
                  manpowerRows={manpowerRowsData}
                  expenseRows={expenseRowsData}
                  otherManpowerRows={otherManpowerRowsData}
                  otherExpenseRows={otherExpenseRowsData}
                  monthlyMM={currentDisplayStats.monthlyMM}
                  monthlyCr={currentDisplayStats.monthlyCr}
                  directCr={currentDisplayStats.monthlyCr.map((v, i) => Math.round((v - (currentDisplayStats.contractedCr?.[i] || 0)) * 100) / 100)}
                  contractedCr={currentDisplayStats.contractedCr}
                  monthlyExpCr={currentDisplayStats.monthlyExpCr}
                  grandTotal={currentDisplayStats.grandTotal}
                  totalMM={currentDisplayStats.aggMM}
                  totalManpowerCr={currentDisplayStats.aggCr}
                  totalExpenseCr={currentDisplayStats.aggExpCr}
                  totalBudgetCr={currentDisplayStats.aggTotalCr}
                  remarks={project.rowRemarks || {}}
                  onUpdateIgGate={(idx, val) => setGate(idx, val)}
                  onUpdateEstimation={(cat, idx, val, type) => {
                    const targetMode = fiscalMode === 'Forecast' ? 'Forecast' : fiscalMode;
                    const startYear = months[0] ? parseInt(months[0].split('-')[1]) : 25;
                    const yearOffset = (startYear - 19) * 12;
                    const absoluteMonthIndex = idx + yearOffset;
                    
                    let finalVal = val;
                    if (type === 'expense') {
                      if (cat !== 'Contracted Employee') {
                        finalVal = val * 10000000;
                      }
                    }
                    
                    onUpdate(project.id, cat, absoluteMonthIndex as MonthIndex, finalVal, targetMode);
                  }}
                  onUpdateRemark={(cat, text) => onUpdateMetadata('remarkUpdate', { category: cat, text })}
                  canEdit={canEdit}
                  isLocked={isActuallyLocked}
                  mode={fiscalMode}
                  showRemarks={true}
                  isAdmin={isAdmin}
                />
              </table>
            </div>
          )}

          {activeInnerTab === 'analytics' && (
            <div className="p-10 bg-slate-50 space-y-10 animate-fadeIn">
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Monthly Outflow Trend */}
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm col-span-2 flex flex-col h-[400px]">
                     <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-6 pl-4 border-l-4 border-indigo-600">Monthly Cash Outflow (INR)</h4>
                     <div className="flex-grow w-full">
                        {analysisData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                             <LineChart data={analysisData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                                <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                <Legend verticalAlign="top" height={36} iconType="circle" />
                                <Line name="Manpower" type="monotone" dataKey="manpower" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5' }} activeDot={{ r: 6 }} />
                                <Line name="Expense" type="monotone" dataKey="expense" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                                <Line name="Grand Total" type="monotone" dataKey="total" stroke="#001e3c" strokeWidth={4} strokeDasharray="5 5" dot={false} />
                             </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-full text-slate-400 text-xs">No analytics data available</div>
                        )}
                     </div>
                  </div>

                  {/* Resource Composition */}
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-[400px]">
                     <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-6 pl-4 border-l-4 border-emerald-500">Cost Composition</h4>
                     <div className="flex-grow w-full">
                        {pieData.some(d => d.value > 0) ? (
                          <ResponsiveContainer width="100%" height="100%">
                             <PieChart>
                                <Pie
                                   data={pieData}
                                   cx="50%"
                                   cy="50%"
                                   innerRadius={70}
                                   outerRadius={100}
                                   paddingAngle={8}
                                   dataKey="value"
                                >
                                   {pieData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                   ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                             </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-full text-slate-400 text-xs">No cost data available</div>
                        )}
                     </div>
                     <div className="pt-4 mt-auto text-center border-t border-slate-50">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Lifecycle Budget</span>
                        <p className="text-xl font-black text-slate-900">₹{currentDisplayStats.aggTotalCr.toFixed(0)}</p>
                     </div>
                  </div>
               </div>

               {/* Effort Deployment Chart */}
               <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-[350px]">
                  <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-6 pl-4 border-l-4 border-amber-500">Monthly Resource Load (MM)</h4>
                  <div className="flex-grow w-full">
                     {analysisData.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analysisData}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                             <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                             <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                             <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                             <Bar name="Effort (MM)" dataKey="mm" fill="#6366f1" radius={[8, 8, 0, 0]} />
                          </BarChart>
                       </ResponsiveContainer>
                     ) : (
                       <div className="flex items-center justify-center h-full text-slate-400 text-xs">No effort data available</div>
                     )}
                  </div>
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BudgetTable;