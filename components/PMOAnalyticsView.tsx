import React, { useMemo, useState, useEffect } from 'react';
import { ProjectData, Employee, FiscalYear, FiscalMode, getAbsoluteMonthIndex, Opportunity } from '../types';
import { RATE_PER_HOUR, HOURS_PER_MONTH, SKILL_MAPPING, MANPOWER_CATEGORIES, EXPENSE_CATEGORIES, CONTRACTED_EMPLOYEE_RATE, MAX_MONTHS, isConfirmedProject, classifyCategory, isSummaryOrCalculatedLabel } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, PieChart, Pie, Cell, LabelList, AreaChart, Area } from 'recharts';
import { ChevronDown, ChevronRight, ArrowRight, Users, UserPlus, TrendingUp, CreditCard, Target } from 'lucide-react';
import EmployeeRoster from './EmployeeRoster';
import EmployeeAnalysis from './EmployeeAnalysis';
import ConsolidatedTeamView from './ConsolidatedTeamView';
import { FamilyView } from './FamilyView';
import { ExpenseList } from './ExpenseList';

interface PMOAnalyticsViewProps {
  projects: any[];
  months: string[];
  employees: Employee[];
  selectedFY: FiscalYear;
  selectedFYs: FiscalYear[];
  config: any;
  mode?: FiscalMode;
  setMode?: (m: FiscalMode) => void;
  filters: any;
}

const MANPOWER_SEQUENCE = [
  'Product Manager', 'PDTL', 'Systems', 'Product Planning', 'Tech Sales',
  'Costing Cell', 'NPC', 'Hardware_CoC', 'Hardware_Vertical', 'ECAD',
  'Component Engineer', 'Lab Engineer', 'Mechanical_CoC', 'Mechanical_Vertical',
  'Material Science', 'CAE', 'Optics', 'Software_CoC', 'Software CS & FuSA',
  'Software_Vertical', 'INITIA', 'Proto Engineer', 'Application Engg',
  'Validation_CoC', 'Validation_Vertical', 'Manufacturing Engineering', 'Quality', 'Unspecified Skill'
];

const EXPENSE_SEQUENCE = [
  'Travel', 'Material', 'Labs', 'License', 'Consultant', 'HR', 'Admin', 'Others', 'Contracted Employee', 'Contracted Employee Expense'
];

const PROJECTS_SUB = ['ECS-1', 'ECS-2', 'LAS', 'INITIA', 'SCS'];
const MAINTENANCE_SUB = ['ECS-1', 'ECS-2', 'LAS'];
const PROJECT_SUPPORT_SUB = [
  'Non Projects', 'Holiday & Leaves', 'Support Services', 'Trainings', 
  'PMTS', 'Costing Cell', 'Quality', 'Others'
];
const ORG_SUPPORT_SUB = ['HR', 'Admin', 'Finance', 'Others'];

const CATEGORY_COLORS: Record<string, string> = {
  'Projects': '#3b82f6', // blue-500
  'Product Maintenance': '#10b981', // emerald-500
  'Project Support': '#f59e0b', // amber-500
  'Organization Support': '#8b5cf6', // violet-500
  'Others': '#94a3b8' // slate-400
};

const getProjectCategory = (p: any, selectedFY: FiscalYear) => {
  let fyStartYear = 2025;
  if (selectedFY && selectedFY !== 'All FY') {
    const parts = selectedFY.split(' ');
    if (parts.length > 1) {
      const yearPart = parts[1].split('-')[0];
      fyStartYear = parseInt(yearPart) + 2000;
    }
  }
  const fyStartDate = new Date(fyStartYear, 3, 1); // April 1st

  let v = (p.vertical || 'Unassigned').trim();
  const name = (p.name || '').trim();
  const code = (p.code || '').trim();
  const isMaintenance = name.toLowerCase().includes('maintenance');
  const ft = p.functionalTeam || '';
  const pStartDate = p.startDate ? new Date(p.startDate) : null;
  const isNew = pStartDate ? pStartDate >= fyStartDate : (p.category || '').toLowerCase().includes('new');

  let category = '';
  let parent = '';

  // Specific Project Code Overrides
  if (code === 'UMD-3189') {
    parent = 'Project Support';
    category = 'Project Support:Costing Cell';
  } else if (code === 'UMD-2740') {
    parent = 'Project Support';
    category = 'Project Support:Quality';
  } else if (code === 'UMD-1038') {
    parent = 'Organization Support';
    category = 'Organization Support:HR';
  } else if (code === 'UMD-2649') {
    parent = 'Organization Support';
    category = 'Organization Support:Finance';
  } else if (code === 'UMD-2650') {
    parent = 'Organization Support';
    category = 'Organization Support:Admin';
  } else if (PROJECTS_SUB.includes(v) && !isMaintenance) {
    parent = 'Projects';
    category = `Projects:${v}`;
  } else if (isMaintenance && MAINTENANCE_SUB.includes(v)) {
    parent = 'Product Maintenance';
    category = `Product Maintenance:${v}`;
  } else if (v.toUpperCase() === 'SUPPORT') {
    parent = 'Project Support';
    let sub = '';
    if (ft === 'Costing Cell') sub = 'Costing Cell';
    else if (ft === 'Quality') sub = 'Quality';
    else if (name.toLowerCase().includes('holiday') || name.toLowerCase().includes('leave')) sub = 'Holiday & Leaves';
    else if (name.toLowerCase().includes('training')) sub = 'Trainings';
    else if (name.toLowerCase().includes('pmts') || name.toLowerCase().includes('product planning')) sub = 'PMTS';
    else if (name.toLowerCase().includes('support services')) sub = 'Support Services';
    else sub = 'Non Projects';
    category = `Project Support:${sub}`;
  } else if (ORG_SUPPORT_SUB.includes(v) || v === 'Finance') {
    parent = 'Organization Support';
    category = `Organization Support:${v}`;
  } else {
    parent = 'Project Support';
    category = `Project Support:Others`;
  }

  return { category, parent, isNew };
};

const formatCr = (val: number, decimals: number = 2) => {
  return val.toFixed(decimals);
};

const formatMM = (val: number) => {
  return val.toFixed(2);
};

const formatValue = (val: number) => {
  if (typeof val !== 'number' || isNaN(val)) return '0';
  if (val === 0) return '0';
  if (val % 1 !== 0) {
    return val.toFixed(2);
  }
  return val.toFixed(0);
};

const renderCustomBarLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (!value || value === 0) return null;
  // Only show label if bar is tall enough
  if (height < 15) return null;
  
  return (
    <text 
      x={x + width / 2} 
      y={y + height / 2} 
      fill="#fff" 
      textAnchor="middle" 
      dominantBaseline="middle" 
      fontSize={9} 
      fontWeight="bold"
      style={{ pointerEvents: 'none' }}
    >
      {formatValue(value)}
    </text>
  );
};

const CustomTooltip = ({ active, payload, label, type }: any) => {
  if (active && payload && payload.length) {
    // Check if we have mode tag keys or if we can group by them
    const hasModeTags = payload.some((p: any) => {
      const k = String(p.dataKey);
      return k.includes(' (Budget)') || k.includes(' (Actuals)') || k.includes(' (Forecast)');
    });

    if (!hasModeTags) {
      // Fallback to original layout
      const items = payload
        .filter((p: any) => p.dataKey !== 'total')
        .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
      
      const totalItem = payload.find((p: any) => p.dataKey === 'total');
      const total = totalItem ? totalItem.value : items.reduce((acc: number, item: any) => acc + (item.value || 0), 0);
      
      return (
        <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-lg shadow-xl backdrop-blur-sm max-h-[400px] overflow-y-auto min-w-[200px]">
          <p className="text-slate-200 font-bold mb-2 border-b border-slate-700 pb-1 uppercase tracking-wider text-[11px]">{label}</p>
          <div className="space-y-1">
            {items.map((item: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4 text-[11px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill || item.color }} />
                  <span className="text-slate-300 truncate max-w-[150px]">{item.name || item.dataKey}:</span>
                </div>
                <span className="text-white font-mono font-bold">
                  {type === 'manpower' ? formatValue(item.value) : `₹${formatCr(item.value, 2)}`}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 text-[11px] pt-1 mt-1 border-t border-slate-700 font-bold">
              <span className="text-slate-200 uppercase tracking-widest text-[9px]">Total:</span>
              <span className="text-emerald-400 font-mono">
                {type === 'manpower' ? formatValue(total) : `₹${formatCr(total, 2)}`}
              </span>
            </div>
          </div>
        </div>
      );
    }

    // Combined chart mode-aware grouping
    const modeGroups: Record<string, { items: any[], total: number }> = {};
    
    // Sort order for groups
    ['Budget', 'Actuals', 'Forecast'].forEach(m => {
      modeGroups[m] = { items: [], total: 0 };
    });

    payload.forEach((p: any) => {
      const dataKeyStr = String(p.dataKey);
      
      // Total match, e.g., total (Budget)
      const totalMatch = dataKeyStr.match(/^total \(([^)]+)\)$/);
      if (totalMatch) {
         const mode = totalMatch[1];
         if (!modeGroups[mode]) modeGroups[mode] = { items: [], total: 0 };
         modeGroups[mode].total = p.value || 0;
         return;
      }
      
      // Category match, e.g., Application Engg (Budget)
      let cleanName = dataKeyStr;
      let mode = 'Default';
      const keyMatch = dataKeyStr.match(/^(.+?)\s*\((Budget|Actuals|Forecast)\)$/);
      if (keyMatch) {
         cleanName = keyMatch[1];
         mode = keyMatch[2];
      }
      
      if (!modeGroups[mode]) modeGroups[mode] = { items: [], total: 0 };
      
      const val = p.value || 0;
      if (val > 0.001) {
         modeGroups[mode].items.push({
           name: cleanName,
           value: val,
           fill: p.fill || p.color
         });
      }
    });

    // Delete empty groups to prevent clutter
    Object.keys(modeGroups).forEach(m => {
      if (modeGroups[m].items.length === 0 && modeGroups[m].total === 0) {
        delete modeGroups[m];
      }
    });

    const modesPresent = Object.keys(modeGroups);
    if (modesPresent.length > 0) {
      return (
        <div className="bg-slate-900/95 border border-slate-700 p-3.5 rounded-xl shadow-2xl backdrop-blur-sm max-h-[450px] overflow-y-auto min-w-[280px]">
          <p className="text-slate-200 font-extrabold mb-3 border-b border-slate-800 pb-1.5 uppercase tracking-widest text-[10px]">{label}</p>
          <div className="space-y-4">
            {modesPresent.map((mode) => {
              const group = modeGroups[mode];
              const sortedItems = [...group.items].sort((a, b) => b.value - a.value);
              const computedTotal = group.total || sortedItems.reduce((acc, item) => acc + item.value, 0);

              return (
                <div key={mode} className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/40">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-1 mb-1.5">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${
                      mode === 'Actuals' ? 'text-emerald-400' : mode === 'Budget' ? 'text-slate-300' : 'text-indigo-400'
                    }`}>
                      {mode} List
                    </span>
                    <span className="text-[10px] font-mono font-black text-slate-400">
                      Total: {type === 'manpower' ? formatValue(computedTotal) : `₹${formatCr(computedTotal, 2)}`}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {sortedItems.map((item, index) => (
                      <div key={index} className="flex items-center justify-between gap-3 text-[10px]">
                        <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.fill }} />
                          <span className="text-slate-300 truncate">{item.name}:</span>
                        </div>
                        <span className="text-white font-mono font-bold">
                          {type === 'manpower' ? formatValue(item.value) : `₹${formatCr(item.value, 2)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  }
  return null;
};

const ComparisonTooltip = ({ active, payload, label, unit = 'Cr' }: any) => {
  if (active && payload && payload.length) {
    const data: Record<string, number> = {};
    payload.forEach((item: any) => {
      data[item.name || item.dataKey] = item.value;
    });

    const budgetVal = data['Budget'] || data['budget'] || data['Budget (MM)'] || data['Budget Actual'] || data['Budget manpowerMM'] || data['Budget totalCr'] || 0;
    const actualVal = data['Actuals'] || data['actuals'] || data['Actual (MM)'] || data['Actuals Actual'] || data['Actuals manpowerMM'] || data['Actuals totalCr'] || 0;

    const diff = actualVal - budgetVal;
    const diffPct = budgetVal > 0 ? (diff / budgetVal) * 100 : 0;

    const isOver = diff > 0.001;
    const isUnder = diff < -0.001;

    return (
      <div className="bg-slate-950/95 border border-slate-800 p-3.5 rounded-xl shadow-2xl backdrop-blur-md text-xs min-w-[240px] font-sans">
        <div className="text-slate-400 font-bold mb-2.5 pb-1.5 border-b border-slate-800 uppercase tracking-widest text-[9px]">
          {label}
        </div>
        <div className="space-y-2 mb-3">
          {/* Budget row */}
          <div className="flex items-center justify-between font-medium">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2 h-2 rounded-sm bg-[#64748b] inline-block" />
              <span>Budget baseline:</span>
            </div>
            <span className="text-white font-mono font-bold">
              {unit === 'Cr' ? `₹${budgetVal.toFixed(2)} Cr` : `${budgetVal.toFixed(1)} MM`}
            </span>
          </div>
          {/* Actuals row */}
          <div className="flex items-center justify-between font-medium">
            <div className="flex items-center gap-2 text-slate-300">
              <span className={`w-2 h-2 rounded-sm inline-block ${isOver ? 'bg-[#ef4444]' : 'bg-[#10b981]'}`} />
              <span>Actual spent:</span>
            </div>
            <span className={`font-mono font-bold ${isOver ? 'text-rose-400' : 'text-emerald-400'}`}>
              {unit === 'Cr' ? `₹${actualVal.toFixed(2)} Cr` : `${actualVal.toFixed(1)} MM`}
            </span>
          </div>
          {/* Other series lines if any (eg. Forecast) */}
          {payload.filter((item: any) => item.name !== 'Budget' && item.name !== 'Actuals').map((item: any, idx: number) => {
            const val = typeof item.value === 'number' ? item.value : 0;
            return (
              <div key={idx} className="flex items-center justify-between font-medium">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: item.fill || item.color }} />
                  <span>{item.name || item.dataKey}:</span>
                </div>
                <span className="text-white font-mono font-bold">
                  {unit === 'Cr' ? `₹${val.toFixed(2)} Cr` : `${val.toFixed(1)} MM`}
                </span>
              </div>
            );
          })}
        </div>
        
        {payload.length >= 2 && (
          <div className="pt-2.5 border-t border-slate-800 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">Variance (Act - Bud):</span>
              <span className={`font-mono font-black py-0.5 px-1.5 rounded text-[10px] ${
                isOver 
                  ? 'bg-rose-950/50 text-rose-450 border border-rose-900/35' 
                  : 'bg-emerald-950/50 text-emerald-450 border border-emerald-900/35'
              }`}>
                {diff > 0 ? '+' : ''}{unit === 'Cr' ? `₹${diff.toFixed(2)} Cr` : `${diff.toFixed(1)} MM`}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">Variance %:</span>
              <span className={`font-mono font-black ${isOver ? 'text-rose-405' : 'text-emerald-405'}`}>
                {diff > 0 ? '+' : ''}{diffPct.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

const DISTINCT_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#d946ef',
  '#84cc16', '#14b8a6', '#f43f5e', '#0ea5e9', '#fbbf24',
  '#a855f7', '#22c55e', '#64748b', '#475569', '#334155'
];

const getAuthoritativeRowLocal = (
  p: any,
  cat: string,
  mode: FiscalMode
): number[] => {
  const findInObj = (obj: any, key: string) => {
    if (!obj) return undefined;
    if (obj[key] !== undefined) return obj[key];
    const keys = Object.keys(obj);
    const matchedKey = keys.find(k => k.toLowerCase() === key.toLowerCase());
    return matchedKey ? obj[matchedKey] : undefined;
  };

  const normalizeRow = (data: any): number[] => {
    const arr = new Array(144).fill(0);
    if (!data) return arr;
    if (Array.isArray(data)) {
      data.forEach((v, i) => {
        if (i < 144) arr[i] = Number(v) || 0;
      });
    } else if (typeof data === 'object') {
      Object.entries(data).forEach(([k, v]) => {
        const idx = parseInt(k);
        if (!isNaN(idx) && idx >= 0 && idx < 144) {
          arr[idx] = Number(v) || 0;
        }
      });
    }
    return arr;
  };

  const hasNonZero = (arr: number[]) => arr.some(v => v !== 0);

  // Try direct primary row for the current mode
  const primarySource = mode === 'Actuals' 
    ? (p.actuals || {}) 
    : (mode === 'Forecast' ? (p.forecast || {}) : ((p.rows && Object.keys(p.rows).length > 0) ? p.rows : (p.pmoRows || {})));

  let primaryRow = findInObj(primarySource, cat);
  if (primaryRow) {
    const normalized = normalizeRow(primaryRow);
    if (hasNonZero(normalized)) return normalized;
  }

  // Check actualsSkills / forecastSkills / pmoSkills
  if (mode === 'Actuals') {
    primaryRow = findInObj(p.actualsSkills, cat);
    if (primaryRow) {
      const normalized = normalizeRow(primaryRow);
      if (hasNonZero(normalized)) return normalized;
    }
  } else if (mode === 'Forecast') {
    primaryRow = findInObj(p.forecastSkills, cat);
    if (primaryRow) {
      const normalized = normalizeRow(primaryRow);
      if (hasNonZero(normalized)) return normalized;
    }
  } else {
    primaryRow = findInObj(p.pmoSkills, cat) || findInObj(p.skills, cat);
    if (primaryRow) {
      const normalized = normalizeRow(primaryRow);
      if (hasNonZero(normalized)) return normalized;
    }
  }

  // Fallback to employeeSkills based on mode
  const empSkillsKey = mode === 'Actuals' ? 'actualsEmployeeSkills' : (mode === 'Forecast' ? 'forecastEmployeeSkills' : 'pmoEmployeeSkills');
  const targetEmployeeSkills = ((p as any)[empSkillsKey] || (mode === 'Budget' ? p.employeeSkills : undefined)) as any;
  if (targetEmployeeSkills) {
    const allocsObj = findInObj(targetEmployeeSkills, cat);
    if (allocsObj) {
      const sumRow = new Array(144).fill(0);
      Object.values(allocsObj).forEach((allocs: any) => {
        const normalizedAlloc = normalizeRow(allocs);
        for (let i = 0; i < 144; i++) {
          sumRow[i] += normalizedAlloc[i];
        }
      });
      if (hasNonZero(sumRow)) {
        return sumRow;
      }
    }
  }

  return new Array(144).fill(0);
};

const getActiveProjectData = (p: any, mode: FiscalMode) => {
  const activeSource: Record<string, number[]> = {};
  
  let dataToProcess: Record<string, any>;
  if (mode === 'Actuals') {
    dataToProcess = {
      ...(p.actuals || {}),
      ...(p.actualsSkills || {}),
      ...(p.actualsEmployeeSkills || {})
    };
  } else if (mode === 'Forecast') {
    dataToProcess = {
      ...(p.forecast || {}),
      ...(p.forecastSkills || {}),
      ...(p.forecastEmployeeSkills || {})
    };
  } else {
    dataToProcess = {
      ...(p.rows || {}),
      ...(p.pmoRows || {}),
      ...(p.skills || {}),
      ...(p.expenses || {}),
      ...(p.pmoSkills || {}),
      ...(p.pmoEmployeeSkills || p.employeeSkills || {})
    };
  }
  
  Object.keys(dataToProcess).forEach(cat => {
    if (isSummaryOrCalculatedLabel(cat)) return;
    const row = getAuthoritativeRowLocal(p, cat, mode);
    if (row.some(v => v !== 0)) {
      const finalCat = SKILL_MAPPING[cat] || cat;

      if (!activeSource[finalCat]) {
        activeSource[finalCat] = new Array(144).fill(0);
      }
      for (let i = 0; i < 144; i++) {
        activeSource[finalCat][i] += (row[i] || 0);
      }
    }
  });
  return activeSource;
};

const PMOAnalyticsView: React.FC<PMOAnalyticsViewProps> = ({ projects, months, employees, selectedFY, selectedFYs, config, mode = 'Budget', setMode, filters }) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<'trends' | 'roster' | 'analysis' | 'family' | 'team' | 'family-won' | 'expenses'>('trends');

  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        const syncKey = import.meta.env.VITE_SYNC_KEY || '';
        const res = await fetch('/api/opportunities', { headers: { 'x-sync-key': syncKey } });
        if (res.ok) {
          const data = await res.json();
          setOpportunities(data);
        }
      } catch (err) {
        console.error('Failed to fetch opportunities:', err);
      }
    };
    fetchOpportunities();
  }, []);

  const familyEfficiencyData = useMemo(() => {
    const data: Record<string, { won: number; spend: number; ratio: number }> = {};
    
    // Determine if we should consider all fiscal years
    const isAllFYSelected = selectedFYs.includes('All FY');
    
    // Agg WON (Status = Won, Stage = B or A)
    opportunities
      .filter(o => {
        const isWon = o.status === 'Won';
        const isCorrectStage = ['B', 'A'].includes(o.stage);
        const matchesFY = isAllFYSelected || selectedFYs.includes(o.fiscalYear as any);
        return isWon && isCorrectStage && matchesFY;
      })
      .forEach(o => {
        const family = o.productFamily || 'Unknown';
        if (filters.family && !filters.family.includes('All') && !filters.family.includes(family)) return;
        if (!data[family]) data[family] = { won: 0, spend: 0, ratio: 0 };
        data[family].won += (o.value || 0);
      });

    // Agg Spend
    projects.forEach(p => {
        const family = p.productFamily || 'Unknown';
        if (filters.family && !filters.family.includes('All') && !filters.family.includes(family)) return;
        if (!data[family]) data[family] = { won: 0, spend: 0, ratio: 0 };
        data[family].spend += (p.actualSpentCr || 0);
    });

    // Finalize and Round
    Object.keys(data).forEach(family => {
        data[family].won = Math.round(data[family].won);
        data[family].spend = Math.round(data[family].spend);
        data[family].ratio = data[family].spend > 0 ? Math.round(data[family].won / data[family].spend) : 0;
    });

    return data;
  }, [opportunities, projects, filters.family]);

  const [showBars, setShowBars] = React.useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'manpowerMM' | 'totalCr'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Projects': false,
    'Product Maintenance': false,
    'Project Support': false,
    'Organization Support': false
  });

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const monthIndices = useMemo(() => {
    return months.map(m => getAbsoluteMonthIndex(m));
  }, [months]);

  const [selectedModes, setSelectedModes] = React.useState<FiscalMode[]>(['Actuals']);
  const [chartActiveMode, setChartActiveMode] = React.useState<FiscalMode>(selectedModes[0] || 'Actuals');

  React.useEffect(() => {
    if (!selectedModes.includes(chartActiveMode)) {
      setChartActiveMode(selectedModes[0] || 'Actuals');
    }
  }, [selectedModes, chartActiveMode]);

  const toggleMode = (m: FiscalMode) => {
    setSelectedModes(prev => {
      if (prev.includes(m) && prev.length === 1) return prev;
      if (prev.includes(m)) return prev.filter(x => x !== m);
      return [...prev, m];
    });
  };

  const getFYArray = React.useCallback((data: any) => {
    const arr = new Array(MAX_MONTHS).fill(0);
    if (!data) return arr;
    if (Array.isArray(data)) {
      data.forEach((v, i) => {
        if (i < MAX_MONTHS) arr[i] = Number(v) || 0;
      });
    } else if (typeof data === 'object') {
      Object.entries(data).forEach(([k, v]) => {
        const idx = parseInt(k);
        if (!isNaN(idx) && idx >= 0 && idx < MAX_MONTHS) arr[idx] = Number(v) || 0;
      });
    }
    return arr;
  }, []);

  const calculateProjectCost = React.useCallback((pObj: any, modeVal: FiscalMode) => {
    // 1. Build rates cache
    const ratesCache: Record<number, { hRate: number, cRate: number }> = {};
    for (let i = 0; i < MAX_MONTHS; i++) {
      const fyStartYear = 19 + Math.floor(i / 12);
      const fyStr = `FY ${fyStartYear}-${fyStartYear + 1}`;
      
      const fyConfig = config.fyFinancials?.[fyStr];
      ratesCache[i] = {
        hRate: (fyConfig?.hourlyRate !== undefined && fyConfig?.hourlyRate !== null) ? fyConfig.hourlyRate : (config.hourlyRate || RATE_PER_HOUR),
        cRate: (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) ? fyConfig.contractedEmployeeRate : (config.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE)
      };
    }
    const hoursPerMonth = 180;

    // 2. Month selection checker
    const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFY];
    const isAllFYSelection = fyStrings.includes('All FY');

    const isMonthSelected = (idx: number) => {
      if (isAllFYSelection) return true;
      const fyIdx = Math.floor(idx / 12);
      const fyStartYear = 19 + fyIdx;
      const fyStr = `FY ${fyStartYear}-${fyStartYear + 1}`;
      return fyStrings.includes(fyStr as any);
    };

    const isHolidayLeave = (pObj.name || '').toLowerCase().includes('holiday') || (pObj.name || '').toLowerCase().includes('leave');
    const source = getActiveProjectData(pObj, modeVal);
    
    let directMM = 0;
    let contractedMM = 0;
    let directManpowerCr = 0;
    let contractedManpowerCr = 0;
    let expenseCr = 0;

    const groupedData: Record<string, Record<number, number>> = {};
    Object.entries(source || {}).forEach(([rawCat, monthsData]) => {
      const cat = SKILL_MAPPING[rawCat] || rawCat;
      if (!groupedData[cat]) groupedData[cat] = {};
      const arr = getFYArray(monthsData);
      for (let i = 0; i < MAX_MONTHS; i++) {
        const v = arr[i] || 0;
        if (v !== 0) groupedData[cat][i] = (groupedData[cat][i] || 0) + v;
      }
    });

    Object.entries(groupedData).forEach(([cat, catMonths]) => {
      if (isSummaryOrCalculatedLabel(cat)) return;
      const normCat = cat.toLowerCase().trim();
      const isContractedExp = normCat === 'contracted employee expense';
      const catKind = classifyCategory(cat);
      const isContracted = catKind === 'CONTRACTED_MANPOWER';
      const isManpower = catKind === 'DIRECT_MANPOWER' || catKind === 'CONTRACTED_MANPOWER';
      const isExpense = catKind === 'EXPENSE';

      for (let i = 0; i < MAX_MONTHS; i++) {
        if (!isMonthSelected(i)) continue;
        const val = Number(catMonths[i]) || 0;
        if (val === 0) continue;
        const { hRate, cRate } = ratesCache[i];

        if (isManpower) {
          if (isContracted) {
            contractedMM += val;
            contractedManpowerCr += (val * cRate * hoursPerMonth) / 10000000;
          } else {
            directMM += val;
            if (!isHolidayLeave) {
              directManpowerCr += (val * hRate * hoursPerMonth) / 10000000;
            }
          }
        } else if (isExpense) {
          if (!isHolidayLeave || isContracted || isContractedExp) {
            if (isContractedExp) {
              const mmObj = groupedData['Contracted Employee'] || groupedData['Contracted Employee (MM)'] || {};
              if ((mmObj[i] || 0) === 0) {
                expenseCr += Math.abs(val) > 1000 ? val / 10000000 : val;
              }
            } else {
              expenseCr += Math.abs(val) > 1000 ? val / 10000000 : val;
            }
          }
        }
      }
    });

    const manpowerCr = directManpowerCr + contractedManpowerCr;
    const totalCr = manpowerCr + expenseCr;
    return { mm: directMM + contractedMM, directMM, contractedMM, manpowerCr, expenseCr, totalCr };
  }, [config, selectedFYs, selectedFY, getFYArray]);

  const aggregatedData = useMemo(() => {
    // Pre-calculate rates for all months to avoid repeated lookups
    const ratesCache: Record<number, { hRate: number, cRate: number }> = {};
    for (let i = 0; i < MAX_MONTHS; i++) {
      const fyStartYear = 19 + Math.floor(i / 12);
      const fyStr = `FY ${fyStartYear}-${fyStartYear + 1}`;
      
      const fyConfig = config.fyFinancials?.[fyStr];
      ratesCache[i] = {
        hRate: (fyConfig?.hourlyRate !== undefined && fyConfig?.hourlyRate !== null) ? fyConfig.hourlyRate : (config.hourlyRate || RATE_PER_HOUR),
        cRate: (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) ? fyConfig.contractedEmployeeRate : (config.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE)
      };
    }
    const hoursPerMonth = 180;

    const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFY];
    const isAllFYSelection = fyStrings.includes('All FY');

    const isMonthSelected = (idx: number) => {
      if (isAllFYSelection) return true;
      const fyIdx = Math.floor(idx / 12);
      const fyStartYear = 19 + fyIdx;
      const fyStr = `FY ${fyStartYear}-${fyStartYear + 1}`;
      return fyStrings.includes(fyStr as any);
    };

    const getMapForMode = (modeVal: FiscalMode) => {
      const dataMap: Record<string, { 
        manpowerMM: number, 
        manpowerCr: number, 
        expenseCr: number, 
        totalCr: number, 
        budgetCr: number, 
        isSubCategory?: boolean, 
        parent?: string,
        newMM: number,
        carryOverMM: number,
        isProject?: boolean,
        skills?: Record<string, number>,
        expenses?: Record<string, number>
      }> = {};

      projects.forEach(p => {
        if (!isConfirmedProject(p)) return; // Only confirmed projects for summary

        const { category, parent, isNew } = getProjectCategory(p, selectedFY);
        const primaryCosts = calculateProjectCost(p, modeVal);
        const budgetCosts = calculateProjectCost(p, 'Budget');

        const activeSource = getActiveProjectData(p, modeVal);

        const updateMap = (cat: string, isSub: boolean, pName?: string, isProj: boolean = false) => {
          if (!dataMap[cat]) {
            dataMap[cat] = { 
              manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0, 
              isSubCategory: isSub, parent: pName, newMM: 0, carryOverMM: 0, isProject: isProj,
              skills: {}, expenses: {}
            };
          }
          dataMap[cat].manpowerMM += primaryCosts.mm;
          dataMap[cat].manpowerCr += primaryCosts.manpowerCr;
          dataMap[cat].expenseCr += primaryCosts.expenseCr;
          dataMap[cat].totalCr += primaryCosts.totalCr; 
          dataMap[cat].budgetCr += budgetCosts.totalCr;
          if (isNew) dataMap[cat].newMM += primaryCosts.mm;
          else dataMap[cat].carryOverMM += primaryCosts.mm;

          // Aggregate skills
          Object.entries(activeSource || {}).forEach(([skill, monthsData]) => {
            const mappedSkill = SKILL_MAPPING[skill] || skill;
            const isContracted = mappedSkill === 'Contracted Employee';
            const isManpower = MANPOWER_CATEGORIES.includes(mappedSkill as any) || isContracted;
            if (!isManpower) return;
            const arr = getFYArray(monthsData);
            const mm = arr.reduce((acc, val, idx) => isMonthSelected(idx) ? acc + (val || 0) : acc, 0);
            dataMap[cat].skills![skill] = (dataMap[cat].skills![skill] || 0) + mm;
          });

          // Aggregate expenses
          Object.entries(activeSource || {}).forEach(([exp, monthsData]) => {
            const mappedExp = SKILL_MAPPING[exp] || exp;
            const isContractedExp = mappedExp === 'Contracted Employee Expense';
            const isExpense = EXPENSE_CATEGORIES.includes(mappedExp as any) || isContractedExp;
            if (!isExpense) return;
            const arr = getFYArray(monthsData);
            const cost = arr.reduce((acc, val, idx) => isMonthSelected(idx) ? acc + (val || 0) : acc, 0);
            dataMap[cat].expenses![exp] = (dataMap[cat].expenses![exp] || 0) + cost;
          });
        };

        updateMap(category, true, parent);
        if (parent) updateMap(parent, false);
        
        // Add project-level data
        const projectKey = `Project:${p.name}`;
        updateMap(projectKey, true, category, true);
      });

      return dataMap;
    };

    const activeModes = selectedModes; // E.g., ['Budget', 'Actuals']
    const mapsByMode: Record<string, any> = {};
    activeModes.forEach(mv => {
      mapsByMode[mv] = getMapForMode(mv);
    });

    const finalResult: any[] = [];

    if (!selectedCategory) {
      const topLevel = ['Projects', 'Product Maintenance', 'Project Support', 'Organization Support'];
      
      const sortedTopLevel = [...topLevel];
      if (sortBy !== 'name' || sortOrder !== 'asc') {
        sortedTopLevel.sort((a, b) => {
          const sortMode = activeModes[0] || 'Budget';
          const dataA = mapsByMode[sortMode]?.[a] || { manpowerMM: 0, totalCr: 0 };
          const dataB = mapsByMode[sortMode]?.[b] || { manpowerMM: 0, totalCr: 0 };
          
          let valA: any = sortMode === 'Budget' ? dataA.budgetCr : dataA[sortBy];
          let valB: any = sortMode === 'Budget' ? dataB.budgetCr : dataB[sortBy];
          
          if (sortBy === 'name') {
            valA = a.toLowerCase();
            valB = b.toLowerCase();
          }
          
          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
      }

      sortedTopLevel.forEach(key => {
        activeModes.forEach(modeVal => {
          const dataMap = mapsByMode[modeVal];
          const data = dataMap[key] || { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0, isSubCategory: false, newMM: 0, carryOverMM: 0 };
          finalResult.push({
            key: `${key}-${modeVal}`,
            categoryKey: key,
            name: key,
            mode: modeVal,
            ...data
          });
        });

        if (expandedCategories[key]) {
          let subs: string[] = [];
          if (key === 'Projects') subs = PROJECTS_SUB.map(s => `Projects:${s}`);
          else if (key === 'Product Maintenance') subs = MAINTENANCE_SUB.map(s => `Product Maintenance:${s}`);
          else if (key === 'Project Support') subs = PROJECT_SUPPORT_SUB.map(s => `Project Support:${s}`);
          else if (key === 'Organization Support') subs = ORG_SUPPORT_SUB.map(s => `Organization Support:${s}`);

          subs.forEach(subKey => {
            activeModes.forEach(modeVal => {
              const dataMap = mapsByMode[modeVal];
              const subData = dataMap[subKey] || { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0, isSubCategory: true, parent: key, newMM: 0, carryOverMM: 0 };
              finalResult.push({
                key: `${subKey}-${modeVal}`,
                categoryKey: subKey,
                name: subKey.split(':')[1],
                mode: modeVal,
                ...subData
              });
            });
          });
        }
      });
      return finalResult;
    }

    let sequence: string[] = [];
    const templateMap = mapsByMode[activeModes[0] || 'Budget'] || {};
    if (selectedCategory.startsWith('Projects') || selectedCategory.startsWith('Product Maintenance') || selectedCategory.startsWith('Project Support') || selectedCategory.startsWith('Organization Support')) {
      if (selectedCategory.includes(':')) {
        sequence = Object.keys(templateMap).filter(k => k.startsWith('Project:') && templateMap[k].parent === selectedCategory);
      } else {
        if (selectedCategory === 'Projects') sequence = PROJECTS_SUB.map(s => `Projects:${s}`);
        else if (selectedCategory === 'Product Maintenance') sequence = MAINTENANCE_SUB.map(s => `Product Maintenance:${s}`);
        else if (selectedCategory === 'Project Support') sequence = PROJECT_SUPPORT_SUB.map(s => `Project Support:${s}`);
        else if (selectedCategory === 'Organization Support') sequence = ORG_SUPPORT_SUB.map(s => `Organization Support:${s}`);
      }
    }

    if (sortBy !== 'name' || sortOrder !== 'asc') {
      sequence.sort((a, b) => {
        const firstMode = activeModes[0] || 'Budget';
        const dataA = mapsByMode[firstMode]?.[a] || { name: a, manpowerMM: 0, totalCr: 0 };
        const dataB = mapsByMode[firstMode]?.[b] || { name: b, manpowerMM: 0, totalCr: 0 };
        
        let valA: any = dataA[sortBy];
        let valB: any = dataB[sortBy];
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const result: any[] = [];
    sequence.forEach(key => {
      const name = key.startsWith('Project:') ? key.replace('Project:', '') : (key.includes(':') ? key.split(':')[1] : key);
      activeModes.forEach(modeVal => {
        const dataMap = mapsByMode[modeVal];
        const data = dataMap[key] || { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0, isSubCategory: key.includes(':'), parent: key.includes(':') ? key.split(':')[0] : undefined, newMM: 0, carryOverMM: 0 };
        result.push({
          key: `${key}-${modeVal}`,
          categoryKey: key,
          name,
          mode: modeVal,
          ...data
        });
      });
    });

    return result;
  }, [projects, selectedFY, selectedCategory, sortBy, sortOrder, expandedCategories, mode, selectedModes, getFYArray, calculateProjectCost]);

  const grandTotals = useMemo(() => {
    const totals: Record<string, {
      manpowerMM: number;
      manpowerCr: number;
      expenseCr: number;
      totalCr: number;
      budgetCr: number;
      newMM: number;
      carryOverMM: number;
    }> = {};

    selectedModes.forEach(modeVal => {
      totals[modeVal] = { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0, newMM: 0, carryOverMM: 0 };
    });

    aggregatedData.forEach(row => {
      const isProj = row.isProject || row.key.includes('Project:');
      if (!row.isSubCategory && !isProj) {
        const modeVal = row.mode || 'Budget';
        if (!totals[modeVal]) {
          totals[modeVal] = { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0, newMM: 0, carryOverMM: 0 };
        }
        totals[modeVal].manpowerMM += row.manpowerMM || 0;
        totals[modeVal].manpowerCr += row.manpowerCr || 0;
        totals[modeVal].expenseCr += row.expenseCr || 0;
        totals[modeVal].totalCr += row.totalCr || 0;
        totals[modeVal].budgetCr += row.budgetCr || 0;
        totals[modeVal].newMM += row.newMM || 0;
        totals[modeVal].carryOverMM += row.carryOverMM || 0;
      }
    });

    return totals;
  }, [aggregatedData, selectedModes]);

  const graphicalData = useMemo(() => {
    const grouped: Record<string, any> = {};
    aggregatedData.forEach(d => {
      if (!grouped[d.name]) {
        grouped[d.name] = { ...d };
      }
      grouped[d.name][`${d.mode} manpowerMM`] = d.manpowerMM;
      grouped[d.name][`${d.mode} totalCr`] = d.totalCr;
    });
    return Object.values(grouped);
  }, [aggregatedData]);

  const getConsolidatedBudget = (targetMode: FiscalMode) => {
    const manpowerData: Record<string, number[]> = {};
    const expenseData: Record<string, number[]> = {};

    const numMonths = months.length;

    MANPOWER_SEQUENCE.forEach(k => manpowerData[k] = new Array(numMonths).fill(0));
    EXPENSE_SEQUENCE.forEach(k => expenseData[k] = new Array(numMonths).fill(0));

    const filteredProjects = projects.filter(p => {
      // Keep all projects for consistent PMO analytics view
      if (!selectedCategory) return true;
      if (selectedCategory.startsWith('Project:')) {
        return p.name === selectedCategory.replace('Project:', '');
      }
      const { category, parent } = getProjectCategory(p, selectedFY);
      return category === selectedCategory || parent === selectedCategory;
    });

    const ensureArray = (data: any) => {
      let fullArray: number[] = [];
      if (Array.isArray(data)) {
        fullArray = data;
      } else if (data && typeof data === 'object') {
        fullArray = new Array(MAX_MONTHS).fill(0);
        Object.entries(data).forEach(([k, v]) => {
          const idx = parseInt(k);
          if (!isNaN(idx) && idx >= 0 && idx < MAX_MONTHS) {
            fullArray[idx] = Number(v) || 0;
          }
        });
      } else {
        return new Array(numMonths).fill(0);
      }
      
      return monthIndices.map(idx => Number(fullArray[idx]) || 0);
    };

    const totalManpowerMM = new Array(numMonths).fill(0);
    const totalDirectManpowerMM = new Array(numMonths).fill(0);
    const totalHolidayMM = new Array(numMonths).fill(0);
    const totalManpowerCr = new Array(numMonths).fill(0);
    const totalDirectManpowerCr = new Array(numMonths).fill(0);
    const totalExpenseCr = new Array(numMonths).fill(0);
    const totalBudgetCr = new Array(numMonths).fill(0);

    // Pre-calculate rates for all months to avoid repeated lookups
    const ratesCache: Record<number, { hRate: number, cRate: number }> = {};
    for (let i = 0; i < MAX_MONTHS; i++) {
      const fyStartYear = 19 + Math.floor(i / 12);
      const fyStr = `FY ${fyStartYear}-${fyStartYear + 1}`;
      
      const fyConfig = config.fyFinancials?.[fyStr];
      ratesCache[i] = {
        hRate: (fyConfig?.hourlyRate !== undefined && fyConfig?.hourlyRate !== null) ? fyConfig.hourlyRate : (config.hourlyRate || RATE_PER_HOUR),
        cRate: (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) ? fyConfig.contractedEmployeeRate : (config.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE)
      };
    }
    const hoursPerMonth = 180;

    const isHolidayLeave = (p: any) => (p.name || '').toLowerCase().includes('holiday') || (p.name || '').toLowerCase().includes('leave');

    filteredProjects.forEach(p => {
      // Determine data source - Dynamically fetch based on selected mode
      const activeSource = getActiveProjectData(p, targetMode);
      const budgetSource = activeSource;
      const expenseSource = activeSource;

      const holidayLeave = isHolidayLeave(p);
      
      const hasContractedExpense = Object.keys(expenseSource || {}).some(k => (SKILL_MAPPING[k] || k) === 'Contracted Employee Expense');

      // Pass 1: Process Manpower using grouped data to avoid duplication
      const groupedBudgetSource: Record<string, number[]> = {};
      Object.entries(budgetSource || {}).forEach(([rawCat, monthsData]) => {
        const cat = SKILL_MAPPING[rawCat] || rawCat;
        if (!groupedBudgetSource[cat]) groupedBudgetSource[cat] = new Array(numMonths).fill(0);
        const monthsArray = ensureArray(monthsData);
        for (let i = 0; i < numMonths; i++) {
          let val = (i < monthsArray.length) ? monthsArray[i] : (monthsData && typeof monthsData === 'object' ? (monthsData as any)[i] || (monthsData as any)[String(i)] || 0 : 0);
          val = Number(val) || 0;
          groupedBudgetSource[cat][i] += val;
        }
      });

      Object.entries(groupedBudgetSource).forEach(([cat, monthsArray]) => {
        // Manpower categorization updated: allowing CoCs and Verticals
        const isContracted = cat.toLowerCase().includes('contracted');
        const isManpower = MANPOWER_CATEGORIES.includes(cat as any) || 
                           cat.includes('_CoC') || 
                           cat.includes('_Vertical') || 
                           cat === 'NPC';
        
        if (!isManpower && !isContracted) return;
        
        if (!manpowerData[cat]) manpowerData[cat] = new Array(numMonths).fill(0);
        monthsArray.forEach((v: number, i: number) => {
          if (holidayLeave && !isContracted) {
            totalHolidayMM[i] += v;
          } else {
            manpowerData[cat][i] += v;
          }
          
          totalManpowerMM[i] += v;

          if (!isContracted) {
            totalDirectManpowerMM[i] += v;
          }

          if (!holidayLeave || isContracted) {
            const globalIdx = monthIndices[i];
            if (globalIdx !== undefined && globalIdx >= 0) {
              const { hRate, cRate } = ratesCache[globalIdx] || { hRate: RATE_PER_HOUR, cRate: CONTRACTED_EMPLOYEE_RATE };
              if (isContracted) {
                // ALWAYS calculate from MM to ensure it's dynamic based on configuration
                const cost = (v * cRate * hoursPerMonth) / 10000000;
                totalManpowerCr[i] += cost;
                
                // Also update expenseData for the table display
                if (!expenseData['Contracted Employee Expense']) expenseData['Contracted Employee Expense'] = new Array(numMonths).fill(0);
                expenseData['Contracted Employee Expense'][i] += cost;
              } else if (!holidayLeave) {
                const cost = (v * hRate * hoursPerMonth) / 10000000;
                totalDirectManpowerCr[i] += cost;
                totalManpowerCr[i] += cost;
              }
            }
          }
        });
      });

      // Pass 2: Process Expenses using grouped data to avoid duplication
      const groupedExpenseSource: Record<string, number[]> = {};
      Object.entries(expenseSource || {}).forEach(([rawCat, monthsData]) => {
        const cat = SKILL_MAPPING[rawCat] || rawCat;
        if (!groupedExpenseSource[cat]) groupedExpenseSource[cat] = new Array(numMonths).fill(0);
        const monthsArray = ensureArray(monthsData);
        for (let i = 0; i < numMonths; i++) {
          const globalIdx = monthIndices[i];
          let val = 0;
          if (globalIdx !== undefined && globalIdx >= 0 && globalIdx < monthsArray.length && monthsArray.length > numMonths) {
            val = monthsArray[globalIdx] ?? 0;
          } else {
            val = (i < monthsArray.length) ? monthsArray[i] : (monthsData && typeof monthsData === 'object' ? (monthsData as any)[globalIdx] ?? (monthsData as any)[i] ?? (monthsData as any)[String(globalIdx)] ?? (monthsData as any)[String(i)] ?? 0 : 0);
          }
          val = Number(val) || 0;
          groupedExpenseSource[cat][i] += val;
        }
      });

      Object.entries(groupedExpenseSource).forEach(([cat, monthsArray]) => {
        const isContracted = cat === 'Contracted Employee';
        const isContractedExp = cat === 'Contracted Employee Expense';
        const isManpower = MANPOWER_CATEGORIES.includes(cat as any) || isContracted;
        if (!EXPENSE_CATEGORIES.includes(cat as any) || isManpower) return;
        
        if (!expenseData[cat]) expenseData[cat] = new Array(numMonths).fill(0);
        monthsArray.forEach((val: number, i: number) => {
          const valCr = Math.abs(val) > 1000 ? val / 10000000 : val;
          const vCr = (typeof valCr === 'number' && !isNaN(valCr)) ? valCr : 0;

          if (!holidayLeave || isContractedExp) {
            // If it's Contracted Employee Expense, only add if there's no manpower for this month
            // This avoids double counting with the dynamic calculation above
            if (isContractedExp) {
              // Check for MM using the mapped key from grouped budget source
              const mmArray = groupedBudgetSource['Contracted Employee'] || [];
              const mm = mmArray[i] || 0;
              if (mm === 0) {
                expenseData[cat][i] += vCr;
                totalManpowerCr[i] += vCr;
              }
            } else if (!holidayLeave) {
              expenseData[cat][i] += vCr;
              totalExpenseCr[i] += vCr;
            }
          }
        });
      });
    });

    // Use aggregated expense data
    if (aggregatedData.length > 0) {
      // Ensure 'Contracted Employee Expense' is populated from aggregated expenses
      aggregatedData.forEach(d => {
        if (!d.expenses) d.expenses = {};
        // If 'Contracted Employee Expense' is not set, we can't do much, but it should be set by aggregation
      });
    }

    for (let i = 0; i < numMonths; i++) {
      totalBudgetCr[i] = totalManpowerCr[i] + totalExpenseCr[i];
    }

    const sortedManpowerKeys = Object.keys(manpowerData).sort((a, b) => {
      const indexA = (MANPOWER_CATEGORIES as readonly string[]).indexOf(a);
      const indexB = (MANPOWER_CATEGORIES as readonly string[]).indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      const sumA = manpowerData[a].reduce((acc, v) => acc + v, 0);
      const sumB = manpowerData[b].reduce((acc, v) => acc + v, 0);
      return sumB - sumA;
    });

    const sortedExpenseKeys = Object.keys(expenseData).sort((a, b) => {
      const indexA = (EXPENSE_CATEGORIES as readonly string[]).indexOf(a);
      const indexB = (EXPENSE_CATEGORIES as readonly string[]).indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      const sumA = expenseData[a].reduce((acc, v) => acc + v, 0);
      const sumB = expenseData[b].reduce((acc, v) => acc + v, 0);
      return sumB - sumA;
    });

    return {
      manpowerData,
      expenseData,
      sortedManpowerKeys,
      sortedExpenseKeys,
      totalManpowerMM,
      totalDirectManpowerMM,
      totalHolidayMM,
      totalManpowerCr,
      totalDirectManpowerCr,
      totalExpenseCr,
      totalBudgetCr
    };
  };

  const activeConsolidations = useMemo(() => {
    const results: Record<string, ReturnType<typeof getConsolidatedBudget>> = {};
    (['Budget', 'Actuals', 'Forecast'] as FiscalMode[]).forEach((m) => {
      results[m] = getConsolidatedBudget(m);
    });
    return results;
  }, [projects, selectedFY, config, aggregatedData]);

  const consolidatedBudget = useMemo(() => {
    const mpKeys = new Set<string>();
    const expKeys = new Set<string>();
    selectedModes.forEach(m => {
      const cons = activeConsolidations[m];
      if (cons) {
        cons.sortedManpowerKeys.forEach(k => mpKeys.add(k));
        cons.sortedExpenseKeys.forEach(k => expKeys.add(k));
      }
    });
    const primary = activeConsolidations[selectedModes[0]] || activeConsolidations['Budget'];
    return {
      ...primary,
      sortedManpowerKeys: Array.from(mpKeys),
      sortedExpenseKeys: Array.from(expKeys)
    };
  }, [activeConsolidations, selectedModes, mode]);

  const [viewMode, setViewMode] = useState<'tabular' | 'graphical'>('tabular');

  const filteredOpportunities = useMemo(() => {
    if (selectedFY === 'All FY') return opportunities;
    return opportunities.filter(o => o.fiscalYear === selectedFY);
  }, [opportunities, selectedFY]);

  const filteredProjects = useMemo(() => {
    if (filters.family && !filters.family.includes('All')) {
        return projects.filter(p => filters.family.includes(p.productFamily));
    }
    return projects;
  }, [projects, filters.family]);

  const renderMonthlyDataRow = (
    label: string, 
    getData: (m: string) => number[], 
    isCurrency: boolean = false,
    condition?: (total: number) => boolean,
    styleClasses: string = "hover:bg-slate-50 border-b border-slate-100",
    labelClasses: string = "font-bold uppercase tracking-tight pl-8"
  ) => {
    if (selectedModes.length > 1) {
      const sortedModes = ['Budget', 'Actuals', 'Forecast'].filter(m => selectedModes.includes(m as any));
      const modeData = sortedModes.map(modeVal => {
        const d = getData(modeVal) || new Array(months.length).fill(0);
        return {
          mode: modeVal,
          data: d,
          total: d.reduce((a, b) => a + b, 0),
          avg: (d.reduce((a, b) => a + b, 0) / months.length) || 0,
        };
      });

      const maxTotal = Math.max(...modeData.map(md => md.total));
      if (condition && !condition(maxTotal)) return null;

      const format = (v: number) => {
        const num = (typeof v === 'number' && !isNaN(v)) ? v : 0;
        return isCurrency ? `₹${formatCr(num, 2)}` : num.toFixed(2);
      };

      const getColorClass = (modeVal: string) => {
        if (modeVal === 'Budget') return 'text-blue-600 bg-blue-50/20';
        if (modeVal === 'Actuals') return 'text-emerald-600 bg-emerald-50/20';
        if (modeVal === 'Forecast') return 'text-purple-600 bg-purple-50/20';
        return '';
      };

      return (
        <tr key={`${label}-${selectedModes.join('-')}`} className={styleClasses}>
          <td className={`px-4 py-1 border-r border-slate-100 sticky left-0 bg-white z-10 w-[200px] min-w-[200px] truncate ${labelClasses}`}>
            {label}
          </td>
          {months.map((m, i) => (
              modeData.map(md => (
                <td key={`${m}-${md.mode}`} className={`px-2 py-1.5 border-r border-slate-100 text-right font-mono w-[100px] min-w-[100px] opacity-90 ${getColorClass(md.mode)}`}>
                  {format(md.data[i])}
                </td>
              ))
          ))}
          {modeData.map(md => (
            <td key={`total-${md.mode}`} className={`px-2 py-1.5 border-r border-slate-100 text-right font-mono font-black w-[100px] min-w-[100px] ${getColorClass(md.mode)}`}>
              {format(md.total)}
            </td>
          ))}
          {modeData.map(md => (
             <td key={`avg-${md.mode}`} className={`px-2 py-1.5 border-r border-slate-100 text-right font-mono w-[100px] min-w-[100px] ${getColorClass(md.mode)}`}>
               {format(md.avg)}
             </td>
          ))}
        </tr>
      );
    } else {
      // Single mode fallback
      const modeVal = selectedModes[0] || 'Budget';
      const data = getData(modeVal) || new Array(months.length).fill(0);
      const total = data.reduce((a, b) => a + b, 0);
      const avg = total / months.length;
      if (condition && !condition(total)) return null;

      const format = (v: number) => {
        const num = (typeof v === 'number' && !isNaN(v)) ? v : 0;
        return isCurrency ? `₹${formatCr(num, 2)}` : num.toFixed(2);
      };

      return (
        <tr key={`${label}-${modeVal}`} className={styleClasses}>
          <td className={`px-4 py-1 border-r border-slate-100 sticky left-0 bg-white z-10 w-[200px] min-w-[200px] truncate ${labelClasses}`}>
            {label}
          </td>
          {data.map((val, i) => (
            <td key={i} className="px-2 py-1 border-r border-slate-100 text-right font-mono w-[80px] min-w-[80px] opacity-80">
              {format(val)}
            </td>
          ))}
          <td className="px-4 py-1 border-r border-slate-100 text-right font-mono font-black w-[100px] min-w-[100px]">
            {format(total)}
          </td>
          <td className="px-4 py-1 text-right font-mono w-[80px] min-w-[80px]">
            {format(avg)}
          </td>
        </tr>
      );
    }
  };

  return (
    <div className="p-4 space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button onClick={() => setActiveAnalyticsTab('trends')} className={`px-3 py-1 rounded text-[10px] font-black uppercase ${activeAnalyticsTab === 'trends' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Trends</button>
          <button onClick={() => setActiveAnalyticsTab('family')} className={`px-3 py-1 rounded text-[10px] font-black uppercase ${activeAnalyticsTab === 'family' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Family View</button>
          <button onClick={() => setActiveAnalyticsTab('roster')} className={`px-3 py-1 rounded text-[10px] font-black uppercase ${activeAnalyticsTab === 'roster' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Employee Roster</button>
          <button onClick={() => setActiveAnalyticsTab('analysis')} className={`px-3 py-1 rounded text-[10px] font-black uppercase ${activeAnalyticsTab === 'analysis' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Employee Analysis</button>
          <button onClick={() => setActiveAnalyticsTab('team')} className={`px-3 py-1 rounded text-[10px] font-black uppercase ${activeAnalyticsTab === 'team' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Team View</button>
          <button onClick={() => setActiveAnalyticsTab('expenses')} className={`px-3 py-1 rounded text-[10px] font-black uppercase ${activeAnalyticsTab === 'expenses' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Expense Split</button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {['Budget', 'Actuals'].map((m) => (
              <label key={m} className={`flex items-center gap-2 px-3 py-1.5 bg-white border rounded-lg cursor-pointer transition-all shadow-sm ${selectedModes.includes(m as FiscalMode) ? 'border-indigo-300 text-indigo-700 ring-1 ring-indigo-100' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${selectedModes.includes(m as FiscalMode) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-slate-50'}`}>
                   {selectedModes.includes(m as FiscalMode) && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <input type="checkbox" className="hidden" checked={selectedModes.includes(m as FiscalMode)} onChange={() => toggleMode(m as FiscalMode)} />
                <span className="text-[10px] font-black uppercase tracking-wider">{m}</span>
              </label>
            ))}
          </div>

          <div className="flex bg-slate-100 rounded-lg p-1 shadow-inner border border-slate-200/60">
            <button onClick={() => setViewMode('tabular')} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'tabular' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Tabular</button>
            <button onClick={() => setViewMode('graphical')} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'graphical' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Graphical</button>
          </div>
        </div>

        {activeAnalyticsTab !== 'family' && (
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 ml-4">
            <span className="text-[9px] font-black uppercase text-slate-400 px-2">Sort By</span>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border-none rounded px-2 py-1 text-[10px] font-bold outline-none cursor-pointer"
            >
              <option value="name">Name</option>
              <option value="manpowerMM">Manpower (MM)</option>
              <option value="totalCr">Actual (Cr)</option>
            </select>
            <button 
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="bg-white p-1 rounded hover:bg-slate-50 transition-colors"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? (
                <TrendingUp size={14} className="text-emerald-500" />
              ) : (
                <TrendingUp size={14} className="text-rose-500 rotate-180" />
              )}
            </button>
          </div>
        )}
      </div>

      {activeAnalyticsTab === 'roster' ? (
        <EmployeeRoster employees={employees} projects={projects} months={months} viewMode={viewMode} selectedFY={selectedFY} mode={selectedModes} />
      ) : activeAnalyticsTab === 'analysis' ? (
        <EmployeeAnalysis employees={employees} projects={projects} months={months} selectedFY={selectedFY} mode={selectedModes} />
      ) : activeAnalyticsTab === 'team' ? (
        <div className="space-y-6">
          <ConsolidatedTeamView employees={employees} selectedFY={selectedFY} projects={projects} mode={selectedModes} />
        </div>
      ) : activeAnalyticsTab === 'family' ? (
        <FamilyView projects={filteredProjects} efficiencyData={familyEfficiencyData} viewMode={viewMode} />
      ) : activeAnalyticsTab === 'expenses' ? (
        <ExpenseList projects={filteredProjects} months={months} mode={selectedModes} selectedFY={selectedFY} />
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Consolidated Budget & Actuals Summary</h3>
              <div className="flex gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />

              </div>
            </div>

            {viewMode === 'tabular' ? (
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-slate-50/10">
                <table className="w-full text-left border-collapse font-sans bg-white">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-[0.2em] font-black">
                      <th className="px-4 py-3 border-r border-white/10 min-w-[280px]">
                        Category <span className="text-slate-500 ml-1">↑</span>
                      </th>
                      <th className="px-4 py-3 border-r border-white/10 text-right">MM</th>
                      <th className="px-4 py-3 border-r border-white/10 text-right">MM Expenses</th>
                      <th className="px-4 py-3 border-r border-white/10 text-right">% MM</th>
                      <th className="px-4 py-3 border-r border-white/10 text-right">Expenses</th>
                      <th className="px-4 py-3 border-r border-white/10 text-right">% Exp</th>
                      <th className="px-4 py-3 border-r border-white/10 text-right">Total</th>
                      <th className="px-4 py-3 border-r border-white/10 text-right">Average</th>
                      <th className="px-4 py-3 border-r border-white/10 text-right">% Tot</th>
                      <th className="px-4 py-3 border-r border-white/10 text-center">New</th>
                      <th className="px-4 py-3 text-center">CarryOver</th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px] text-slate-700">
                    {aggregatedData.map(row => {
                      const modeGrandTotal = grandTotals[row.mode || 'Budget'] || { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0 };
                      const mmExpPercentage = modeGrandTotal.manpowerCr > 0 ? (row.manpowerCr / modeGrandTotal.manpowerCr) * 100 : 0;
                      const expPercentage = modeGrandTotal.expenseCr > 0 ? (row.expenseCr / modeGrandTotal.expenseCr) * 100 : 0;
                      const totalPercentage = modeGrandTotal.totalCr > 0 ? (row.totalCr / modeGrandTotal.totalCr) * 100 : 0;
                      
                      const isSub = row.isSubCategory;
                      const isHeader = ['Projects', 'Product Maintenance', 'Project Support', 'Organization Support'].includes(row.categoryKey) && !isSub;
                      
                      // Hide sub-categories if parent is collapsed
                      if (isSub && row.parent && !expandedCategories[row.parent]) {
                        return null;
                      }

                      const newPercentage = row.manpowerMM > 0 ? (row.newMM / row.manpowerMM) * 100 : 0;
                      const carryOverPercentage = row.manpowerMM > 0 ? (row.carryOverMM / row.manpowerMM) * 100 : 0;

                      return (
                        <tr 
                          key={row.key} 
                          className={`
                            group transition-colors border-b border-slate-100 
                            ${isHeader ? 'bg-slate-50/50 cursor-pointer hover:bg-slate-100' : 'hover:bg-slate-50/80'}
                          `}
                          onClick={isHeader ? () => toggleCategory(row.categoryKey) : undefined}
                        >
                          <td className={`px-4 py-2 border-r border-slate-100 flex items-center gap-1.5 ${isSub ? 'pl-10 italic opacity-80' : 'font-bold uppercase text-[11px] tracking-tight'}`}>
                            {isHeader && (
                              expandedCategories[row.categoryKey] ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />
                            )}
                            <span className="truncate max-w-[200px]" title={row.name}>{row.name}</span>
                            <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-widest select-none shrink-0 border ${
                              row.mode === 'Budget' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              row.mode === 'Actuals' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              'bg-purple-50 text-purple-700 border-purple-200'
                            }`}>
                              {row.mode}
                            </span>
                          </td>
                          <td className="px-4 py-2 border-r border-slate-100 text-right font-mono text-[12px]">
                            {(row.manpowerMM || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-2 border-r border-slate-100 text-right font-mono text-[12px]">
                            ₹ {formatCr(row.manpowerCr || 0, 2)}
                          </td>
                          <td className="px-4 py-2 border-r border-slate-100 text-right font-mono text-[10px] text-slate-400">
                            {(mmExpPercentage || 0).toFixed(2)}%
                          </td>
                          <td className="px-4 py-2 border-r border-slate-100 text-right font-mono text-[12px]">
                            ₹ {formatCr(row.expenseCr || 0, 2)}
                          </td>
                          <td className="px-4 py-2 border-r border-slate-100 text-right font-mono text-[10px] text-slate-400">
                            {(expPercentage || 0).toFixed(2)}%
                          </td>
                          <td className="px-4 py-2 border-r border-slate-100 text-right font-black font-mono text-[13px] text-slate-900">
                            ₹ {formatCr(row.totalCr || 0, 2)}
                          </td>
                          <td className="px-4 py-2 border-r border-slate-100 text-right font-mono text-[12px] text-slate-500">
                            ₹ {formatCr((row.totalCr || 0) / (months.length || 1), 2)}
                          </td>
                          <td className="px-4 py-2 border-r border-slate-100 text-right font-mono text-[10px] text-slate-400">
                            {(totalPercentage || 0).toFixed(2)}%
                          </td>
                          <td className="px-4 py-2 border-r border-slate-100 text-center font-mono text-[12px]">
                            {newPercentage > 0 ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                <span>{newPercentage.toFixed(1)}%</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">0%</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center font-mono text-[12px]">
                            {carryOverPercentage > 0 ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                                <span>{carryOverPercentage.toFixed(1)}%</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">0%</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {['Budget', 'Actuals', 'Forecast'].filter(m => selectedModes.includes(m as any)).map(modeVal => {
                      const total = grandTotals[modeVal];
                      if (!total) return null;
                      const isBudget = modeVal === 'Budget';
                      const isActuals = modeVal === 'Actuals';
                      
                      const modeBgColor = 'bg-slate-900';
                      const modeAccentColor = isBudget ? 'text-blue-400' : (isActuals ? 'text-emerald-400' : 'text-purple-400');
                      const borderLeftColor = isBudget ? 'border-l-blue-500' : (isActuals ? 'border-l-emerald-500' : 'border-l-purple-500');

                      const grandNewPct = total.manpowerMM > 0 ? ((total.newMM / total.manpowerMM) * 100).toFixed(1) : '0';
                      const grandCarryPct = total.manpowerMM > 0 ? ((total.carryOverMM / total.manpowerMM) * 100).toFixed(1) : '0';

                      return (
                        <tr key={`grand-total-${modeVal}`} className={`${modeBgColor} text-white font-black border-b border-slate-800 border-l-[6px] ${borderLeftColor}`}>
                          <td className="px-4 py-3 border-r border-white/20 uppercase tracking-[0.2em] text-[10px]">
                            Grand Total ({modeVal})
                          </td>
                          <td className="px-4 py-3 border-r border-white/20 text-right font-mono text-sm">{total.manpowerMM.toFixed(2)}</td>
                          <td className="px-4 py-3 border-r border-white/20 text-right font-mono text-sm">₹ {formatCr(total.manpowerCr, 2)}</td>
                          <td className="px-4 py-3 border-r border-white/20 text-right font-mono text-sm opacity-50">{total.manpowerMM > 0 ? '100%' : '0%'}</td>
                          <td className="px-4 py-3 border-r border-white/20 text-right font-mono text-sm">₹ {formatCr(total.expenseCr, 2)}</td>
                          <td className="px-4 py-3 border-r border-white/20 text-right font-mono text-sm opacity-50">{total.expenseCr > 0 ? '100%' : '0%'}</td>
                          <td className={`px-4 py-3 border-r border-white/20 text-right font-mono text-lg ${modeAccentColor}`}>₹ {formatCr(total.totalCr, 2)}</td>
                          <td className="px-4 py-3 border-r border-white/20 text-right font-mono text-sm opacity-50">₹ {formatCr(total.totalCr / (months.length || 1), 2)}</td>
                          <td className="px-4 py-3 border-r border-white/20 text-right font-mono text-sm opacity-50">{total.totalCr > 0 ? '100%' : '0%'}</td>
                          <td className="px-4 py-3 border-r border-white/20 text-center font-mono">{grandNewPct}%</td>
                          <td className="px-4 py-3 text-center font-mono">{grandCarryPct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {selectedCategory && (
                      <button 
                        onClick={() => {
                          if (selectedCategory.includes(':')) {
                            setSelectedCategory(selectedCategory.split(':')[0]);
                          } else {
                            setSelectedCategory(null);
                          }
                        }}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        title="Go Back"
                      >
                        <ArrowRight className="w-4 h-4 rotate-180" />
                      </button>
                    )}
                    <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800">
                      {selectedCategory ? `Drill-down: ${selectedCategory}` : 'Executive Summary Trends'}
                    </h3>
                  </div>
                  {selectedCategory && (
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Click "Back" to return to {selectedCategory.includes(':') ? 'category' : 'top-level'} view
                    </span>
                  )}
                </div>

                {/* Key Metrics for Selected Category */}
                {(() => {
                  const activeModeForSummary = chartActiveMode || selectedModes[0] || 'Budget';
                  const projectData = selectedCategory 
                    ? graphicalData.filter(d => d.isProject)
                    : projects.map(p => {
                        const costs = calculateProjectCost(p, activeModeForSummary);
                        const activeSource = getActiveProjectData(p, activeModeForSummary);
                        
                        const skillsOnly: Record<string, number[]> = {};
                        const expensesOnly: Record<string, number[]> = {};

                        if (activeSource) {
                          Object.entries(activeSource).forEach(([skill, monthsData]) => {
                            const arr = getFYArray(monthsData);
                            const mappedCat = SKILL_MAPPING[skill] || skill;
                            const isContracted = mappedCat === 'Contracted Employee';
                            const isContractedExp = mappedCat === 'Contracted Employee Expense';
                            const isManpower = MANPOWER_CATEGORIES.includes(mappedCat as any) || isContracted;
                            const isExpense = EXPENSE_CATEGORIES.includes(mappedCat as any) || isContractedExp;
                            
                            if (isManpower) skillsOnly[skill] = arr;
                            if (isExpense) expensesOnly[skill] = arr;
                          });
                        }

                        return {
                          ...p,
                          manpowerMM: costs.mm,
                          manpowerCr: costs.manpowerCr,
                          expenseCr: costs.expenseCr,
                          totalCr: costs.totalCr,
                          budgetCr: calculateProjectCost(p, 'Budget').totalCr,
                          isProject: true,
                          skills: skillsOnly,
                          expenses: expensesOnly
                        };
                      });
                  
                  const getSum = (val: any) => Array.isArray(val) ? val.reduce((a: number, b: number) => a + (Number(b) || 0), 0) : (Number(val) || 0);
                  
                  const totalDirectManpowerMM = projectData.reduce((acc, d) => acc + (d.manpowerMM - getSum(d.skills?.['Contracted Employee'])), 0);
                  const totalContractedManpowerMM = projectData.reduce((acc, d) => acc + getSum(d.skills?.['Contracted Employee']), 0);
                  const totalDirectCost = projectData.reduce((acc, d) => acc + (d.manpowerCr - (getSum(d.expenses?.['Contracted Employee Expense']) / 10000000)), 0);
                  const totalContractedCost = projectData.reduce((acc, d) => acc + (getSum(d.expenses?.['Contracted Employee Expense']) / 10000000), 0);
                  const totalOtherExpenses = projectData.reduce((acc, d) => acc + d.expenseCr, 0);

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { label: 'Direct Manpower', value: `${totalDirectManpowerMM.toFixed(2)} MM`, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                        { label: 'Contracted Manpower', value: `${totalContractedManpowerMM.toFixed(2)} MM`, icon: UserPlus, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                        { label: 'Total People Cost', value: `₹${formatCr(totalDirectCost + totalContractedCost)}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { label: 'Other Expenses', value: `₹${formatCr(totalOtherExpenses)}`, icon: CreditCard, color: 'text-orange-600', bg: 'bg-orange-50' },
                      ].map((metric, i) => (
                        <div key={i} className={`${metric.bg} p-4 rounded-xl border border-slate-200 flex items-center gap-4`}>
                          <div className={`p-2 rounded-lg bg-white shadow-sm ${metric.color}`}>
                            <metric.icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{metric.label}</p>
                            <p className={`text-lg font-black tracking-tighter ${metric.color}`}>{metric.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white/50 rounded-xl p-6 border border-slate-200 overflow-y-auto h-[400px]">
                    <h4 className="text-xs font-black uppercase tracking-widest mb-6 text-slate-500">Strategic Health Index</h4>
                    <div className="space-y-6">
                      {graphicalData.filter(d => d.totalCr > 0).map(row => {
                        const variance = row.budgetCr > 0 ? (row.totalCr / row.budgetCr) : 1;
                        // Likert scale 1-5: 1 (Under), 3 (On Track), 5 (Over)
                        let score = 3;
                        if (variance < 0.8) score = 1;
                        else if (variance < 0.95) score = 2;
                        else if (variance <= 1.05) score = 3;
                        else if (variance <= 1.2) score = 4;
                        else score = 5;

                        const labels = ['Critical Under', 'Under', 'Optimal', 'Over', 'Critical Over'];
                        const colors = ['bg-blue-400', 'bg-blue-200', 'bg-emerald-400', 'bg-orange-300', 'bg-rose-500'];

                        return (
                          <div key={row.key} className="space-y-2">
                            <div className="flex justify-between items-end">
                              <span className="text-[10px] font-black uppercase tracking-tighter text-slate-900">{row.name}</span>
                              <span className="text-[9px] font-mono text-slate-400">{labels[score-1]} ({ (variance * 100).toFixed(2) }%)</span>
                            </div>
                            <div className="grid grid-cols-5 gap-1 h-2">
                              {[1, 2, 3, 4, 5].map(i => (
                                <div 
                                  key={i} 
                                  className={`rounded-sm transition-all duration-500 ${i <= score ? colors[score-1] : 'bg-slate-100'}`}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="h-[400px] bg-white/50 rounded-xl p-4 border border-slate-200">
                    <h4 className="text-xs font-black uppercase tracking-widest mb-4 text-slate-500">Resource Cost Mix</h4>
                    {(() => {
                      const totalDirectCost = graphicalData.reduce((acc, d) => acc + d.manpowerCr, 0);
                      const totalContractedCost = graphicalData.reduce((acc, d) => acc + ((d.expenses?.['Contracted Employee Expense'] || 0) / 10000000), 0);
                      const totalOtherExpenses = graphicalData.reduce((acc, d) => acc + (d.expenseCr - ((d.expenses?.['Contracted Employee Expense'] || 0) / 10000000)), 0);

                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Direct People', value: totalDirectCost },
                                { name: 'Contracted People', value: totalContractedCost },
                                { name: 'Operational Exp', value: totalOtherExpenses }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, value }) => `${name}: ₹${formatCr(value)}`}
                            >
                              <Cell fill="#3b82f6" />
                              <Cell fill="#6366f1" />
                              <Cell fill="#f59e0b" />
                            </Pie>
                            <Tooltip 
                              formatter={(value: number) => `₹${formatCr(value, 2)}`}
                              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc', fontSize: '10px' }}
                            />
                            <Legend verticalAlign="bottom" height={36}/>
                          </PieChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="h-[400px] bg-white/50 rounded-xl p-4 border border-slate-200 overflow-hidden flex flex-col">
                    <h4 className="text-xs font-black uppercase tracking-widest mb-4 text-slate-500">Resource Allocation (MM)</h4>
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                      <div style={{ height: Math.max(350, graphicalData.length * 35) }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={graphicalData}
                            layout="vertical"
                            margin={{ left: 20, right: 40 }}
                            onClick={(data) => {
                              if (data && data.activeLabel) {
                                const clickedItem = graphicalData.find(d => d.name === data.activeLabel);
                                if (clickedItem && !clickedItem.isProject) {
                                  setSelectedCategory(clickedItem.key);
                                }
                              }
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" strokeOpacity={0.5} />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                            <YAxis 
                              type="category" 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 9, fill: '#1e293b', fontWeight: 600 }} 
                              width={120}
                            />
                            <Tooltip 
                              cursor={{ fill: '#1e293b', fillOpacity: 0.05 }}
                              content={<CustomTooltip type="manpower" />}
                            />
                            {selectedModes.map((m) => (
                              <Bar 
                                key={m}
                                name={`${m} (MM)`}
                                dataKey={`${m} manpowerMM`} 
                                radius={[0, 4, 4, 0]}
                                fill={m === 'Budget' ? '#64748b' : (m === 'Actuals' ? '#10b981' : '#8b5cf6')}
                                barSize={selectedModes.length > 1 ? 12 : 20}
                              >
                                <LabelList dataKey={`${m} manpowerMM`} position="right" style={{ fontSize: '9px', fill: '#64748b', fontWeight: 'bold' }} formatter={(v: number) => formatMM(v)} />
                              </Bar>
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                  <div className="h-[400px] bg-white/50 rounded-xl p-4 border border-slate-200 overflow-hidden flex flex-col">
                    <h4 className="text-xs font-black uppercase tracking-widest mb-4 text-slate-500">Budget Utilization</h4>
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                      <div style={{ height: Math.max(350, graphicalData.length * 35) }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart 
                            data={graphicalData}
                            layout="vertical"
                            margin={{ left: 20, right: 40 }}
                            onClick={(data) => {
                              if (data && data.activeLabel) {
                                const clickedItem = graphicalData.find(d => d.name === data.activeLabel);
                                if (clickedItem && !clickedItem.isProject) {
                                  setSelectedCategory(clickedItem.key);
                                }
                              }
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" strokeOpacity={0.5} />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                            <YAxis 
                              type="category" 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 9, fill: '#1e293b', fontWeight: 600 }} 
                              width={120}
                            />
                            <Tooltip 
                              cursor={{ fill: '#1e293b', fillOpacity: 0.05 }}
                              content={<CustomTooltip type="expense" />}
                            />
                            {selectedModes.map((m) => (
                              <Bar 
                                key={m}
                                name={`${m} Actual`}
                                dataKey={`${m} totalCr`} 
                                radius={[0, 4, 4, 0]}
                                fill={m === 'Budget' ? '#475569' : (m === 'Actuals' ? '#059669' : '#7c3aed')}
                                barSize={selectedModes.length > 1 ? 12 : 20}
                              >
                                <LabelList dataKey={`${m} totalCr`} position="right" formatter={(v: number) => `₹${formatCr(v, 2)}`} style={{ fontSize: '9px', fill: '#64748b', fontWeight: 'bold' }} />
                              </Bar>
                            ))}
                            <Line name="Budget (Cr)" type="monotone" dataKey="budgetCr" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: '#f59e0b' }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-4">Consolidated Budget (Monthly)</h3>
            {(() => { console.log("[DEBUG] selectedModes:", selectedModes, "length:", selectedModes.length); return null; })()}
            {viewMode === 'tabular' ? (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse font-sans">
                  <thead className="bg-slate-900 z-20">
                    {selectedModes.length > 1 ? (
                      <>
                        <tr className="bg-slate-900 text-white text-[9px] uppercase tracking-[0.2em]">
                          <th rowSpan={2} className="px-4 py-2 border-r border-white/10 text-xs text-left sticky left-0 bg-slate-900 z-30 w-[200px] min-w-[200px] align-middle">Functional Unit / Label</th>
                          {months.map(m => (
                            <th key={m} colSpan={selectedModes.length} className="px-2 py-1.5 border-r border-b border-white/10 text-center">{m}</th>
                          ))}
                          <th colSpan={selectedModes.length} className="px-4 py-1.5 border-r border-b border-white/10 text-center w-[100px] min-w-[100px]">Total</th>
                          <th colSpan={selectedModes.length} className="px-4 py-1.5 border-b border-white/10 text-center w-[80px] min-w-[80px]">Average</th>
                        </tr>
                        <tr className="bg-slate-800 text-slate-300 text-[9px] uppercase tracking-[0.1em]">
                          {months.map(m => (
                             <React.Fragment key={`sub-${m}`}>
                               {['Budget', 'Actuals', 'Forecast'].filter(mode => selectedModes.includes(mode as any)).map(modeVal => (
                                  <th key={modeVal} className="px-2 py-1 border-r border-white/10 text-right w-[100px] min-w-[100px]">
                                    {modeVal}
                                  </th>
                               ))}
                             </React.Fragment>
                          ))}
                          {['Budget', 'Actuals', 'Forecast'].filter(mode => selectedModes.includes(mode as any)).map(modeVal => (
                             <th key={`total-${modeVal}`} className="px-2 py-1 border-r border-white/10 text-right w-[100px] min-w-[100px]">
                               {modeVal}
                             </th>
                          ))}
                          {['Budget', 'Actuals', 'Forecast'].filter(mode => selectedModes.includes(mode as any)).map(modeVal => (
                             <th key={`avg-${modeVal}`} className="px-2 py-1 border-r border-white/10 text-right w-[100px] min-w-[100px]">
                               {modeVal}
                             </th>
                          ))}
                        </tr>
                      </>
                    ) : (
                      <tr className="bg-slate-900 text-white text-[9px] uppercase tracking-[0.2em]">
                        <th className="px-4 py-2 border-r border-white/10 text-xs text-left sticky left-0 bg-slate-900 z-30 w-[200px] min-w-[200px]">Functional Unit / Label</th>
                        {months.map(m => (
                          <th key={m} className="px-2 py-2 border-r border-white/10 text-right w-[80px] min-w-[80px]">{m}</th>
                        ))}
                        <th className="px-4 py-2 border-r border-white/10 text-right w-[100px] min-w-[100px]">Total</th>
                        <th className="px-4 py-2 border-white/10 text-right w-[80px] min-w-[80px]">Average</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="text-[11px] text-slate-700">
                    {/* Direct Manpower Section */}
                    <tr className="bg-slate-50 font-black text-slate-900 uppercase tracking-widest text-[10px]">
                      <td colSpan={1 + (months.length + 2) * (selectedModes.length > 0 ? selectedModes.length : 1)} className="px-4 py-1.5 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-600" />
                          Direct Manpower (MM)
                        </div>
                      </td>
                    </tr>
                    {consolidatedBudget.sortedManpowerKeys.filter(k => k !== 'Contracted Employee').map(key => {
                      return renderMonthlyDataRow(key, (m) => activeConsolidations[m]?.manpowerData?.[key] || new Array(months.length).fill(0), false, (total) => total > 0 || MANPOWER_SEQUENCE.includes(key));
                    })}
                    {renderMonthlyDataRow('Holidays & Leaves (MM)', (m) => activeConsolidations[m]?.totalHolidayMM || new Array(months.length).fill(0), false, undefined, "hover:bg-slate-50 border-b border-slate-100 italic text-slate-500", "pl-8")}
                    {renderMonthlyDataRow('Total Direct Manpower (MM)', (m) => activeConsolidations[m]?.totalDirectManpowerMM || new Array(months.length).fill(0), false, undefined, "bg-slate-100 font-black text-slate-900 uppercase tracking-widest text-[10px]")}

                    {/* Contracted Manpower Section */}
                    <tr className="bg-slate-50 font-black text-slate-900 uppercase tracking-widest text-[10px]">
                      <td colSpan={1 + (months.length + 2) * (selectedModes.length > 0 ? selectedModes.length : 1)} className="px-4 py-1.5 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-indigo-600" />
                          Contracted Manpower (MM)
                        </div>
                      </td>
                    </tr>
                    {consolidatedBudget.sortedManpowerKeys.filter(k => k === 'Contracted Employee').map(key => {
                      return renderMonthlyDataRow(key, (m) => activeConsolidations[m]?.manpowerData?.[key] || new Array(months.length).fill(0), false);
                    })}
                    {renderMonthlyDataRow('Total Effort (MM)', (m) => activeConsolidations[m]?.totalManpowerMM || new Array(months.length).fill(0), false, undefined, "bg-slate-100 font-black text-slate-900 uppercase tracking-widest text-[10px]")}

                    <tr className="h-4" />

                    {/* People Cost Section */}
                    <tr className="bg-slate-50 font-black text-slate-900 uppercase tracking-widest text-[10px]">
                      <td colSpan={selectedModes.length > 1 ? (months.length + 2) * selectedModes.length + 1 : months.length + 3} className="px-4 py-1.5 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                          People Cost
                        </div>
                      </td>
                    </tr>
                    {renderMonthlyDataRow('Direct Employee Cost', (m) => activeConsolidations[m]?.totalDirectManpowerCr || new Array(months.length).fill(0), true, undefined, "hover:bg-slate-50 border-b border-slate-100", "pl-8 text-blue-600 font-semibold")}
                    {renderMonthlyDataRow('Contracted Employee Expense', (m) => activeConsolidations[m]?.expenseData?.['Contracted Employee Expense'] || new Array(months.length).fill(0), true, undefined, "hover:bg-slate-50 border-b border-slate-100", "pl-8 text-indigo-600 font-semibold")}
                    {renderMonthlyDataRow('Total People Cost', (m) => {
                      const cons = activeConsolidations[m];
                      if (!cons) return new Array(months.length).fill(0);
                      const direct = cons.totalDirectManpowerCr || new Array(months.length).fill(0);
                      const contracted = cons.expenseData?.['Contracted Employee Expense'] || new Array(months.length).fill(0);
                      return direct.map((v, i) => v + (contracted[i] || 0));
                    }, true, undefined, "bg-slate-100 font-black text-slate-900 uppercase tracking-widest text-[10px]", "")}

                    {/* Operational Expenses Section */}
                    <tr className="bg-slate-50 font-black text-slate-900 uppercase tracking-widest text-[10px]">
                      <td colSpan={selectedModes.length > 1 ? (months.length + 2) * selectedModes.length + 1 : months.length + 3} className="px-4 py-1.5 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-orange-600" />
                          Operational Expenses
                        </div>
                      </td>
                    </tr>
                    {consolidatedBudget.sortedExpenseKeys.filter(k => k !== 'Contracted Employee Expense' && k !== 'Contracted Employee').map(key => {
                      return renderMonthlyDataRow(key, (m) => activeConsolidations[m]?.expenseData?.[key] || new Array(months.length).fill(0), true, (total) => total > 0 || EXPENSE_SEQUENCE.includes(key));
                    })}

                    {renderMonthlyDataRow('Total Expense', (m) => activeConsolidations[m]?.totalExpenseCr || new Array(months.length).fill(0), true, undefined, "bg-slate-900 font-black text-white uppercase tracking-[0.2em] text-[10px]", "")}

                    {renderMonthlyDataRow('Total Budget', (m) => activeConsolidations[m]?.totalBudgetCr || new Array(months.length).fill(0), true, undefined, "bg-slate-900 font-black text-white uppercase tracking-[0.2em] text-[10px]", "")}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-8">
                {(() => {
                  const activeChartData = activeConsolidations[chartActiveMode] || consolidatedBudget;
                  if (!activeChartData) return null;

                  return (
                    <div className="space-y-12 animate-fadeIn pb-12">
                      {/* Manpower Distribution Chart */}
                      <div className="bg-white border border-slate-200/60 rounded-[32px] p-8 shadow-sm hover:shadow-xl transition-all duration-500 group">
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
                          <div className="space-y-1">
                            <h4 className="text-base font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                              <Users className="w-5 h-5 text-indigo-600" />
                              Manpower Distribution (MM)
                            </h4>
                            <p className="text-xs text-slate-500 font-medium">Monthly personnel allocations in person-months comparing {selectedModes.join(' vs ')}</p>
                          </div>
                        </div>
                        
                        <div className="h-[520px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart 
                              data={months.map((m, i) => {
                                const dataPoint: any = { name: m };
                                selectedModes.forEach(mode => {
                                  const cons = activeConsolidations[mode];
                                  if (cons) {
                                    cons.sortedManpowerKeys.forEach(key => {
                                      dataPoint[`${key} (${mode})`] = cons.manpowerData[key]?.[i] || 0;
                                    });
                                    dataPoint[`total (${mode})`] = mode === 'Budget' ? cons.totalDirectManpowerMM[i] : cons.totalManpowerMM[i];
                                  }
                                });
                                return dataPoint;
                              })}
                              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis 
                                dataKey="name" 
                                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 800 }} 
                                axisLine={false} 
                                tickLine={false} 
                                dy={10}
                              />
                              <YAxis 
                                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 800 }} 
                                axisLine={false} 
                                tickLine={false} 
                                width={40}
                              />
                              <Tooltip content={<CustomTooltip type="manpower" />} />
                              <Legend 
                                layout="vertical" 
                                align="right" 
                                verticalAlign="middle" 
                                iconType="circle"
                                wrapperStyle={{ 
                                  fontSize: '10px', 
                                  maxHeight: '450px', 
                                  overflowY: 'auto', 
                                  paddingLeft: '30px',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em'
                                }} 
                              />
                              
                              {/* Grouped Stacked Bars */}
                              {selectedModes.map((mode, mIdx) => (
                                consolidatedBudget.sortedManpowerKeys.map((key, kIdx) => (
                                  <Bar 
                                    key={`${mode}-${key}`}
                                    dataKey={`${key} (${mode})`} 
                                    stackId={mode} 
                                    name={mIdx === 0 ? key : undefined}
                                    legendType={mIdx === 0 ? 'circle' : 'none'}
                                    fill={DISTINCT_COLORS[kIdx % DISTINCT_COLORS.length]} 
                                    fillOpacity={mode === 'Budget' ? (selectedModes.length > 1 ? 0.35 : 1) : 1}
                                    stroke={mode === 'Budget' ? (selectedModes.length > 1 ? DISTINCT_COLORS[kIdx % DISTINCT_COLORS.length] : undefined) : undefined}
                                    strokeDasharray={mode === 'Budget' ? '2 2' : undefined}
                                    barSize={selectedModes.length > 1 ? 24 : 44}
                                    radius={kIdx === consolidatedBudget.sortedManpowerKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                  >
                                    <LabelList dataKey={`${key} (${mode})`} position="center" content={renderCustomBarLabel} />
                                  </Bar>
                                ))
                              ))}

                              {/* Totals Comparison Lines */}
                              {selectedModes.map((mode, idx) => {
                                const isBudget = mode === 'Budget';
                                const color = mode === 'Actuals' ? '#0f172a' : mode === 'Budget' ? '#64748b' : DISTINCT_COLORS[(idx + 15) % DISTINCT_COLORS.length];
                                return (
                                  <Line 
                                    key={`line-mm-${mode}`}
                                    type="monotone" 
                                    dataKey={`total (${mode})`} 
                                    name={`TOTAL ${mode.toUpperCase()} (MM)`}
                                    stroke={color} 
                                    strokeWidth={4} 
                                    strokeDasharray={isBudget ? '6 6' : undefined}
                                    dot={{ r: 5, fill: color, stroke: '#fff', strokeWidth: 2 }}
                                    activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }}
                                    connectNulls
                                  />
                                );
                              })}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Expense Distribution Chart */}
                      <div className="bg-white border border-slate-200/60 rounded-[32px] p-8 shadow-sm hover:shadow-xl transition-all duration-500 group">
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
                          <div className="space-y-1">
                            <h4 className="text-base font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                              <CreditCard className="w-5 h-5 text-orange-600" />
                              Expense Distribution (Cr)
                            </h4>
                            <p className="text-xs text-slate-500 font-medium">Monthly operational expenses comparing {selectedModes.join(' vs ')}</p>
                          </div>
                        </div>

                        <div className="h-[520px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart 
                              data={months.map((m, i) => {
                                const dataPoint: any = { name: m };
                                selectedModes.forEach(mode => {
                                  const cons = activeConsolidations[mode];
                                  if (cons) {
                                    cons.sortedExpenseKeys.forEach(key => {
                                      if (key === 'Contracted Employee') return;
                                      dataPoint[`${key} (${mode})`] = cons.expenseData[key]?.[i] || 0;
                                    });
                                    dataPoint[`total (${mode})`] = cons.totalExpenseCr[i] || 0;
                                  }
                                });
                                return dataPoint;
                              })}
                              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis 
                                dataKey="name" 
                                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 800 }} 
                                axisLine={false} 
                                tickLine={false}
                                dy={10}
                              />
                              <YAxis 
                                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 800 }} 
                                axisLine={false} 
                                tickLine={false} 
                                width={40}
                              />
                              <Tooltip content={<CustomTooltip type="expense" />} />
                              <Legend 
                                layout="vertical" 
                                align="right" 
                                verticalAlign="middle" 
                                iconType="circle"
                                wrapperStyle={{ 
                                  fontSize: '10px', 
                                  maxHeight: '450px', 
                                  overflowY: 'auto', 
                                  paddingLeft: '30px',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em'
                                }} 
                              />
                              
                              {/* Grouped Stacked Bars for Expenses */}
                              {selectedModes.map((mode, mIdx) => (
                                consolidatedBudget.sortedExpenseKeys.filter(k => k !== 'Contracted Employee').map((key, kIdx) => (
                                  <Bar 
                                    key={`${mode}-${key}`}
                                    dataKey={`${key} (${mode})`} 
                                    stackId={mode} 
                                    name={mIdx === 0 ? key : undefined}
                                    legendType={mIdx === 0 ? 'circle' : 'none'}
                                    fill={DISTINCT_COLORS[kIdx % DISTINCT_COLORS.length]} 
                                    fillOpacity={mode === 'Budget' ? (selectedModes.length > 1 ? 0.35 : 1) : 1}
                                    stroke={mode === 'Budget' ? (selectedModes.length > 1 ? DISTINCT_COLORS[kIdx % DISTINCT_COLORS.length] : undefined) : undefined}
                                    strokeDasharray={mode === 'Budget' ? '2 2' : undefined}
                                    barSize={selectedModes.length > 1 ? 24 : 44}
                                    radius={kIdx === consolidatedBudget.sortedExpenseKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                  >
                                    <LabelList dataKey={`${key} (${mode})`} position="center" content={renderCustomBarLabel} />
                                  </Bar>
                                ))
                              ))}

                              {/* Expense Comparison Lines */}
                              {selectedModes.map((mode, idx) => {
                                const isBudget = mode === 'Budget';
                                const color = mode === 'Actuals' ? '#0f172a' : mode === 'Budget' ? '#64748b' : DISTINCT_COLORS[(idx + 15) % DISTINCT_COLORS.length];
                                return (
                                  <Line 
                                    key={`line-exp-${mode}`}
                                    type="monotone" 
                                    dataKey={`total (${mode})`} 
                                    name={`TOTAL ${mode.toUpperCase()} (CR)`}
                                    stroke={color} 
                                    strokeWidth={4} 
                                    strokeDasharray={isBudget ? '6 6' : undefined}
                                    dot={{ r: 5, fill: color, stroke: '#fff', strokeWidth: 2 }}
                                    activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }}
                                    connectNulls
                                  />
                                );
                              })}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PMOAnalyticsView;
