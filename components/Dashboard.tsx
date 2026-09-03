
import React, { useMemo, useState, useRef } from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend,
  BarChart,
  Bar,
  ComposedChart, 
  Line,
  LabelList,
  ReferenceLine
} from 'recharts';
import { toBlob, toPng } from 'html-to-image';
import { 
  ChevronDown, 
  ChevronRight, 
  Users, 
  UserPlus, 
  TrendingUp, 
  CreditCard, 
  Target,
  Building,
  Building2,
  Boxes,
  Cpu,
  Layers,
  Globe,
  Copy,
  Check,
  Table as TableIcon,
  BarChart3,
  ArrowUpDown,
  Sparkles,
  DollarSign,
  Briefcase,
  LayoutGrid
} from 'lucide-react';
import { FamilyView } from './FamilyView';
import { 
  EXPENSE_CATEGORIES, 
  MANPOWER_CATEGORIES, 
  ProjectData, 
  User,
  MasterConfigState,
  FiscalYear,
  FiscalMode,
  getPreviousFY,
  getMonthsForFY,
  getAbsoluteMonthIndex
} from '../types';
import { MAX_MONTHS, SKILL_MAPPING, RATE_PER_HOUR, CONTRACTED_EMPLOYEE_RATE, isConfirmedProject, classifyCategory, isSummaryOrCalculatedLabel } from '../constants';

const isNew = (cat: string) => (cat || '').trim().toLowerCase().includes('new');
const isCO = (cat: string) => (cat || '').trim().toLowerCase().includes('carry');
const CHART_COLORS = [
  '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
  '#3b82f6', '#84cc16', '#a855f7', '#0ea5e9', '#d946ef',
  '#fbbf24', '#f472b6', '#34d399', '#60a5fa', '#a78bfa'
];

const VERTICAL_COLORS: Record<string, string> = {
  'ECS-1': '#4f46e5',
  'CoC': '#10b981',
  'ECS-2': '#f59e0b',
  'INITIA': '#ef4444',
  'LAS': '#8b5cf6',
  'ATG': '#64748b'
};

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

const getProjectCategory = (p: any, selectedFYs: FiscalYear | FiscalYear[] | null) => {
  const fys = Array.isArray(selectedFYs) ? selectedFYs : (selectedFYs ? [selectedFYs as FiscalYear] : []);
  const isAllFY = fys.includes('All FY');
  const primaryFY = fys[0] || 'FY 25-26';
  
  let fyStartYear = 2019;
  if (!isAllFY && primaryFY) {
    const parts = primaryFY.split(' ');
    if (parts.length > 1) {
      const yearPart = parts[1].split('-')[0];
      fyStartYear = parseInt(yearPart) + 2000;
    }
  } else if (!primaryFY) {
    fyStartYear = 2025;
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

const formatCr = (val: number, decimals: number = 0) => {
  return val.toFixed(decimals);
};

const formatMM = (val: number) => {
  if (val === 0) return '0';
  return val < 1 ? val.toFixed(2) : val.toFixed(1);
};

const formatValue = (val: number) => {
  if (typeof val !== 'number' || isNaN(val)) return '0';
  if (val === 0) return '0';
  return val < 1 ? val.toFixed(2) : val.toFixed(1);
};

const CORE_VERTICALS = ['ECS-1', 'ECS-2', 'LAS', 'CoC', 'INITIA', 'Support'];
const ADJ_DISTRIBUTION_TARGETS = ['ECS-1', 'ECS-2', 'LAS'];

const renderDonutLabel = ({ name, percent }: any) => {
  return `${name} ${(percent * 100).toFixed(0)}%`;
};

const copyStyledToClipboard = async (html: string, plain: string) => {
  try {
    const blobHtml = new Blob([html], { type: 'text/html' });
    const blobText = new Blob([plain], { type: 'text/plain' });
    const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
    await navigator.clipboard.write(data);
    alert("Protocol Success: Styled table copied to clipboard.");
  } catch (err) {
    console.error("Clipboard Error:", err);
    await navigator.clipboard.writeText(plain);
    alert("Copied as plain TSV (Styling fallback triggered).");
  }
};

const copyTsvToClipboard = async (plain: string) => {
  await navigator.clipboard.writeText(plain);
  alert("Protocol Success: TSV copied to clipboard.");
};

const SortIndicator = ({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) => {
  if (!active) return <span className="ml-1 opacity-20 text-[8px]">↕</span>;
  return <span className="ml-1 text-indigo-500 font-black text-[9px]">{direction === 'asc' ? '↑' : '↓'}</span>;
};

const DISTINCT_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#d946ef',
  '#84cc16', '#14b8a6', '#f43f5e', '#0ea5e9', '#fbbf24',
  '#a855f7', '#22c55e', '#64748b', '#475569', '#334155'
];

const renderCustomBarLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (!value || value === 0) return null;
  if (height < 15) return null;
  return (
    <text x={x + width / 2} y={y + height / 2} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight="bold" style={{ pointerEvents: 'none' }}>
      {value.toFixed(0)}
    </text>
  );
};

const CustomTooltip = ({ active, payload, label, type }: any) => {
  if (active && payload && payload.length) {
    const items = payload.filter((p: any) => p.dataKey !== 'total').sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
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
                <span className="text-slate-300 truncate max-w-[150px]">{item.name}:</span>
              </div>
              <span className="text-white font-mono font-bold">{type === 'manpower' ? (item.value < 1 ? item.value.toFixed(2) : item.value.toFixed(1)) : `₹${item.value < 1 ? item.value.toFixed(2) : item.value.toFixed(1)}`}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 text-[11px] pt-1 mt-1 border-t border-slate-700 font-bold">
            <span className="text-slate-200 uppercase tracking-widest text-[9px]">Total:</span>
            <span className="text-emerald-400 font-mono">{type === 'manpower' ? (total < 1 ? total.toFixed(2) : total.toFixed(1)) : `₹${total < 1 ? total.toFixed(2) : total.toFixed(1)}`}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const PortfolioIntelligenceBar: React.FC<{ stats: any, label?: string, fiscalMode?: string, setFiscalMode?: (mode: string) => void }> = ({ stats, label, fiscalMode, setFiscalMode }) => {
  const newShare = stats.baseTotalCr > 0 ? (stats.baseNewCr / stats.baseTotalCr) * 100 : 0;
  const coShare = stats.baseTotalCr > 0 ? (stats.baseCoCr / stats.baseTotalCr) * 100 : 0;

  const currentLabel = label || 'Portfolio Hub';

  const isActualBlank = (val: number) => false;
  // Use em-dash instead of empty string to preserve vertical layout height
  const fmt = (v: number) => {
    if (v === 0) return '0';
    return v < 1 ? v.toFixed(2) : Math.round(v).toLocaleString();
  };
  const fmtCr = (val: number) => {
    if (typeof val !== 'number' || isNaN(val) || Math.abs(val) < 0.000001) return '0.00';
    return val.toFixed(2);
  };

  return (
    <div className="bg-white border border-slate-100 p-1 rounded-full flex flex-col md:flex-row items-center shadow-sm overflow-hidden w-full shrink-0 gap-2 md:gap-0 min-h-[50px]">
      <div className="px-6 flex flex-col shrink-0 text-center md:text-left">
        <h2 className="text-[12px] font-black text-slate-800 uppercase tracking-tighter leading-none">{currentLabel}</h2>
        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 leading-none">Portfolio Metrics</span>
      </div>
      <div className="flex-grow flex items-center bg-slate-50/50 rounded-full py-1.5 px-4 border border-slate-100 w-full justify-between divide-x divide-slate-200/60 overflow-hidden h-full">
        <div className="px-4 xl:px-6 text-center bg-emerald-600 rounded-full py-2.5 mx-1 shadow-lg shrink-0 min-w-[85px] flex flex-col justify-center h-[calc(100%-4px)] my-auto transition-all">
          <p className="text-[16px] xl:text-[18px] font-black text-white leading-none h-[1em] mb-1">{fmtCr(stats.baseTotalCr)}</p>
          <h4 className="text-[7px] xl:text-[8px] font-black text-white/70 uppercase tracking-widest leading-none">TOTAL</h4>
        </div>
        <div className="px-3 xl:px-4 text-center shrink-0 min-w-[70px] flex flex-col justify-center">
          <p className="text-[14px] xl:text-[16px] font-black text-indigo-600 leading-none h-[1em] mb-1">{fmtCr(stats.baseNewCr)}</p>
          <h4 className="text-[7px] xl:text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none">New ({newShare.toFixed(0)}%) <span className="text-[6px] opacity-60">BASE</span></h4>
        </div>
        <div className="px-3 xl:px-4 text-center shrink-0 min-w-[70px] flex flex-col justify-center">
          <p className="text-[14px] xl:text-[16px] font-black text-orange-600 leading-none h-[1em] mb-1">{fmtCr(stats.baseCoCr)}</p>
          <h4 className="text-[7px] xl:text-[8px] font-black text-orange-400 uppercase tracking-widest leading-none">CO ({coShare.toFixed(0)}%) <span className="text-[6px] opacity-60">BASE</span></h4>
        </div>
        <div className="px-3 xl:px-4 text-center shrink-0 min-w-[70px] flex flex-col justify-center">
          <p className="text-[14px] xl:text-[16px] font-black text-emerald-600 leading-none h-[1em] mb-1">{fmtCr(stats.baseExpensesCr)}</p>
          <h4 className="text-[7px] xl:text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none">Expenses <span className="text-[6px] opacity-60">BASE</span></h4>
        </div>
        <div className="px-3 xl:px-4 text-center shrink-0 min-w-[70px] flex flex-col justify-center">
          <p className="text-[14px] xl:text-[16px] font-black text-blue-600 leading-none h-[1em] mb-1">{fmtCr(stats.baseManpowerCr)}</p>
          <h4 className="text-[7px] xl:text-[8px] font-black text-blue-400 uppercase tracking-widest leading-none">Manpower <span className="text-[6px] opacity-60">BASE</span></h4>
        </div>
        <div className="px-3 xl:px-4 text-center shrink-0 min-w-[70px] flex flex-col justify-center">
          <p className="text-[14px] xl:text-[16px] font-black text-slate-900 leading-none h-[1em] mb-1">{fmt(stats.baseEffortsMM)}</p>
          <h4 className="text-[7px] xl:text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Efforts <span className="text-[6px] opacity-60">BASE</span></h4>
        </div>
        <div className="px-3 xl:px-4 text-center first:pl-0 shrink-0 min-w-[70px] flex flex-col justify-center">
          <p className="text-[14px] xl:text-[16px] font-black text-slate-900 leading-none h-[1em] mb-1">
            {stats.confirmedCount} <span className="text-[9px] text-slate-300 font-bold">/ {stats.portfolioCount}</span>
          </p>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mb-1">
            {fmtCr(stats.confirmedTotalCr)} <span className="text-[7px] text-slate-300">/ {fmtCr(stats.portfolioTotalCr)}</span>
          </p>
          <h4 className="text-[7px] xl:text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Conf / Port</h4>
        </div>
      </div>
    </div>
  );
};

interface DashboardProps {
  allProjects: ProjectData[];
  prevYearProjects: ProjectData[] | null;
  isPrevYearLoading: boolean;
  selectedFYs: FiscalYear | FiscalYear[] | null;
  hourlyRate: number;
  hoursPerMonth: number;
  projectCategories: string[];
  currentUser: User;
  verticals: string[];
  config: MasterConfigState;
  filters: any;
  setFilters: (f: any) => void;
  dynamicOptions: any;
  authorizedVerticals: string[];
  months: string[];
  fiscalMode: FiscalMode;
  setFiscalMode?: (m: FiscalMode) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  allProjects, 
  prevYearProjects,
  isPrevYearLoading,
  selectedFYs,
  hourlyRate, 
  hoursPerMonth, 
  verticals,
  config,
  filters,
  months,
  fiscalMode,
  setFiscalMode
}) => {
  const [globalViewType, setGlobalViewType] = useState<'tabular' | 'graphical'>('graphical');
  const activeMode = fiscalMode;
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'executive_splits' | 'investment_breakdown' | 'trends' | 'family_view'>('executive_splits');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'manpowerMM' | 'totalCr'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Projects': false,
    'Product Maintenance': false,
    'Project Support': false,
    'Organization Support': false
  });

  const grossCardRef = useRef<HTMLDivElement>(null);
  const adjCardRef = useRef<HTMLDivElement>(null);
  const pdhCardRef = useRef<HTMLDivElement>(null);
  const buCardRef = useRef<HTMLDivElement>(null);
  const familyCardRef = useRef<HTMLDivElement>(null);
  const waterfallCardRef = useRef<HTMLDivElement>(null);
  const trendDeploymentRef = useRef<HTMLDivElement>(null);
  const trendExpenseRef = useRef<HTMLDivElement>(null);
  const customerSplitRef = useRef<HTMLDivElement>(null);
  const familySplitRef = useRef<HTMLDivElement>(null);
  const verticalSplitRef = useRef<HTMLDivElement>(null);
  const buSplitRef = useRef<HTMLDivElement>(null);
  const domainSplitRef = useRef<HTMLDivElement>(null);

  const activeVerticals = useMemo(() => {
    if ((filters?.vertical || []).includes('All')) return verticals || [];
    return (filters?.vertical || []).map((v: string) => v.toUpperCase());
  }, [filters?.vertical, verticals]);

  const [snapshotToast, setSnapshotToast] = useState<string | null>(null);

  const copyWidgetImage = async (ref: React.RefObject<HTMLDivElement | null>, widgetTitle: string = 'Widget') => {
    if (!ref.current) return;
    try {
      // 1. Render PNG with skipFonts: true to prevent cross-origin font fetch/taint issues
      const dataUrl = await toPng(ref.current, { 
        backgroundColor: '#ffffff', 
        pixelRatio: 2,
        skipFonts: true,
        cacheBust: false
      });

      // 2. Automatically download image file so the user always receives their snapshot
      const safeTitle = (widgetTitle || 'widget-snapshot').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const filename = `${safeTitle}-${new Date().toISOString().slice(0, 10)}.png`;
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 3. Also copy to clipboard if environment permits
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
        }
      } catch (clipErr) {
        console.warn("Clipboard write skipped:", clipErr);
      }

      setSnapshotToast(`Snapshot "${widgetTitle}" saved & downloaded!`);
      setTimeout(() => setSnapshotToast(null), 3000);
    } catch (err: any) {
      console.error("Snapshot generation error:", err);
      try {
        const blob = await toBlob(ref.current, { backgroundColor: '#ffffff', pixelRatio: 1.5, skipFonts: true });
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `${widgetTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setSnapshotToast(`Snapshot downloaded successfully!`);
          setTimeout(() => setSnapshotToast(null), 3000);
          return;
        }
      } catch (fallbackErr) {
        console.error("Snapshot fallback error:", fallbackErr);
      }
      setSnapshotToast(`Snapshot capture failed. Please try again.`);
      setTimeout(() => setSnapshotToast(null), 3000);
    }
  };

  const yearOffset = useMemo(() => {
    const fys = Array.isArray(selectedFYs) ? selectedFYs : (selectedFYs ? [selectedFYs as FiscalYear] : []);
    const isAllFY = fys.includes('All FY');
    if (isAllFY || fys.length === 0) return 0;
    const startMonth = getMonthsForFY(fys[0])[0];
    return getAbsoluteMonthIndex(startMonth);
  }, [selectedFYs]);

  const monthIndices = useMemo(() => {
    return months.map(m => getAbsoluteMonthIndex(m));
  }, [months]);

  const numMonths = months.length;

  const getProjectMetrics = (p: ProjectData, source: 'rows' | 'actuals' | 'forecast' = 'rows') => {
    let directMM = 0, contractedMM = 0, exp = 0, contractedExp = 0;
    const rawSource = source === 'rows' 
      ? (p.rows && Object.keys(p.rows).length > 0 ? p.rows : {})
      : (p[source] || {});
    const hasData = rawSource && Object.keys(rawSource).length > 0;
    const dataSource = hasData 
      ? rawSource 
      : (source === 'rows' 
          ? { ...(p.rows || {}), ...(p.skills || {}), ...(p.expenses || {}) } 
          : (source === 'actuals' ? (p.actuals || {}) : (p.forecast || {})));
    

    const isHolidayLeave = (p.name || '').toLowerCase().includes('holiday') || (p.name || '').toLowerCase().includes('leave');
    const hpm = 180;

    // Pre-calculate rates for all months
    const ratesCache: Record<number, { hRate: number, cRate: number }> = {};
    for (let i = 0; i < MAX_MONTHS; i++) {
      const startYear = 19 + Math.floor(i / 12);
      const fyStr = `FY ${startYear}-${startYear + 1}`;
      const fyConfig = config.fyFinancials?.[fyStr];
      ratesCache[i] = {
        hRate: (fyConfig?.hourlyRate !== undefined && fyConfig?.hourlyRate !== null) ? fyConfig.hourlyRate : (config.hourlyRate || RATE_PER_HOUR),
        cRate: (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) ? fyConfig.contractedEmployeeRate : (config.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE)
      };
    }

    let directManCost = 0;
    let contractedManCost = 0;
    let otherExp = 0;

    // Group and map categories first to avoid duplication
    const groupedData: Record<string, Record<number, number>> = {};
    Object.entries(dataSource).forEach(([rawCat, catMonths]) => {
      const cat = SKILL_MAPPING[rawCat] || rawCat;
      if (!groupedData[cat]) groupedData[cat] = {};
      const getVal = (idx: number) => {
        if (Array.isArray(catMonths)) return catMonths[idx] || 0;
        if (catMonths && typeof catMonths === 'object') return (catMonths as any)[idx] || (catMonths as any)[String(idx)] || 0;
        return 0;
      };
      for (let i = 0; i < MAX_MONTHS; i++) {
        const v = getVal(i);
        if (v !== 0) groupedData[cat][i] = (groupedData[cat][i] || 0) + v;
      }
    });

    // Process grouped entries
    Object.entries(groupedData).forEach(([cat, catMonths]) => {
      if (isSummaryOrCalculatedLabel(cat)) return;
      const normCat = cat.toLowerCase().trim();
      const isContractedExp = normCat === 'contracted employee expense';
      const catKind = classifyCategory(cat);
      const isContracted = catKind === 'CONTRACTED_MANPOWER';
      const isManpower = catKind === 'DIRECT_MANPOWER' || catKind === 'CONTRACTED_MANPOWER';
      const isExpense = catKind === 'EXPENSE';

      for (let i = 0; i < MAX_MONTHS; i++) {
        const v = catMonths[i] || 0;
        const absoluteMonthIdx = i;
        const fyStartYear = 19 + Math.floor(absoluteMonthIdx / 12);
        const fyStr = `FY ${fyStartYear}-${fyStartYear + 1}`;
        const fys = Array.isArray(selectedFYs) ? selectedFYs : (selectedFYs ? [selectedFYs as FiscalYear] : []);
        const isAllFY = fys.includes('All FY');

        if (isAllFY || fys.includes(fyStr as any)) {
          const val = Number(v) || 0;
          if (val === 0) continue;

          const { hRate, cRate } = ratesCache[i];
          if (isManpower) {
            if (isContracted) {
              contractedMM += val;
              contractedManCost += (val * cRate * hpm) / 10000000;
            } else {
              directMM += val;
              if (!isHolidayLeave) {
                directManCost += (val * hRate * hpm) / 10000000;
              }
            }
          } else if (isExpense) {
            if (!isHolidayLeave || isContracted || isContractedExp) {
              if (isContractedExp) {
                const mmObj = groupedData['Contracted Employee'] || groupedData['Contracted Employee (MM)'] || {};
                if ((mmObj[i] || 0) === 0) {
                  contractedExp += Math.abs(val) > 1000 ? val / 10000000 : val;
                }
              } else {
                otherExp += Math.abs(val) > 1000 ? val / 10000000 : val;
              }
            }
          }
        }
      }
    });

    const totalManCr = directManCost + contractedManCost;
    const total = totalManCr + otherExp + contractedExp;
    
    let newCr = 0, coCr = 0;
    if (isNew(p.category)) newCr = total;
    else if (isCO(p.category)) coCr = total;

    return { total, newCr, coCr, mm: directMM + contractedMM, directMM, contractedMM, manCr: totalManCr, expCr: otherExp + contractedExp };
  };

  const filteredProjects = useMemo(() => {
    const searchStr = (filters.search || '').toLowerCase().trim();
    return allProjects.filter(p => {
    const matchVertical = (filters?.vertical || []).includes('All') ? true : (filters?.vertical || []).map((v:any)=>v.toUpperCase()).includes((p.vertical || "").toUpperCase());
    const matchDomain = (filters?.domain || []).includes('All') ? true : (filters?.domain || []).includes(p.buDomain);
    const matchBu = (filters?.bu || []).includes('All') ? true : (filters?.bu || []).includes(p.businessUnit);
    const matchType = (filters?.projectType || []).includes('All') ? true : (filters?.projectType || []).includes(p.projectType);
    const matchTbc = (filters?.tbc || []).includes('All') ? true : (filters?.tbc || []).map((v:any)=>String(v).toUpperCase()).includes(String(p.tbc || "Yes").toUpperCase());
    const matchCategory = (filters?.category || []).includes('All') ? true : (filters?.category || []).includes(p.category);
    const matchFamily = (filters?.family || []).includes('All') ? true : (filters?.family || []).includes(p.productFamily);
    const matchPdh = (filters?.pdh || []).includes('All') ? true : (filters?.pdh || []).includes(p.pdh);
    const matchGeneration = (filters?.generation || []).includes('All') ? true : (filters?.generation || []).includes(p.generation || 'Current');
      const matchSearch = !searchStr || (p.code || '').toLowerCase().includes(searchStr) || (p.name || '').toLowerCase().includes(searchStr);
      const matchProjectId = (filters?.projectId || []).includes('All') ? true : (filters?.projectId || []).includes(p.code);
      return matchVertical && matchDomain && matchBu && matchType && matchTbc && matchCategory && matchFamily && matchPdh && matchGeneration && matchSearch && matchProjectId;
    });
  }, [allProjects, filters]);

  const stats = useMemo(() => {
    const sourceKey = fiscalMode === 'Actuals' ? 'actuals' : (fiscalMode === 'Forecast' ? 'forecast' : 'rows');
    let baseEffortsMM = 0, baseManpowerCr = 0, baseExpensesCr = 0, baseNewCr = 0, baseCoCr = 0, baseTotalCr = 0;
    let baseIviCr = 0, baseExpoCr = 0, baseInitiaCr = 0;
    let consolidatedTotalCr = 0;
    let confirmedCount = 0;
    let portfolioCount = 0;
    let confirmedTotalCr = 0;
    let portfolioTotalCr = 0;

    filteredProjects.forEach(p => {
      const m = getProjectMetrics(p, sourceKey);
      
      portfolioCount++;
      portfolioTotalCr += m.total;
      if (isConfirmedProject(p)) {
        confirmedCount++;
        confirmedTotalCr += m.total;
      }
      consolidatedTotalCr += m.total;
      baseEffortsMM += m.mm; 
      baseManpowerCr += m.manCr; 
      baseExpensesCr += m.expCr; 
      baseTotalCr += m.total;
      if (isNew(p.category)) baseNewCr += m.total; 
      else if (isCO(p.category)) baseCoCr += m.total;
    });

    const totalCoreA = CORE_VERTICALS.reduce((acc, v) => {
      const vProjects = filteredProjects.filter(p => (p.vertical || 'NA').toUpperCase() === v.toUpperCase());
      const vTotal = vProjects.reduce((sum, p) => {
        const metrics = getProjectMetrics(p, sourceKey);
        return sum + metrics.total;
      }, 0);
      return acc + vTotal;
    }, 0);

    return { confirmedCount, portfolioCount, confirmedTotalCr, portfolioTotalCr, baseEffortsMM, baseManpowerCr, baseExpensesCr, baseNewCr, baseCoCr, baseTotalCr, consolidatedTotalCr, totalCoreA };
  }, [filteredProjects, hourlyRate, hoursPerMonth, fiscalMode]);
  const aggregatedData = useMemo(() => {
    const dataMap: Record<string, any> = {};

    filteredProjects.forEach(p => {
      if (!isConfirmedProject(p)) return; // Only confirmed projects for summary

      const { category, parent, isNew } = getProjectCategory(p, selectedFYs);
      const m = getProjectMetrics(p, fiscalMode === 'Actuals' ? 'actuals' : (fiscalMode === 'Forecast' ? 'forecast' : 'rows'));
      
      const updateMap = (cat: string, isSub: boolean, pName?: string, isProj: boolean = false) => {
        if (!dataMap[cat]) {
          dataMap[cat] = { 
            manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0, 
            isSubCategory: isSub, parent: pName, newMM: 0, carryOverMM: 0, isProject: isProj,
            skills: {}, expenses: {}
          };
        }
        dataMap[cat].manpowerMM += m.mm;
        dataMap[cat].manpowerCr += m.manCr;
        dataMap[cat].expenseCr += m.expCr;
        dataMap[cat].totalCr += m.total; 
        dataMap[cat].budgetCr += m.total;
        if (isNew) dataMap[cat].newMM += m.mm;
        else dataMap[cat].carryOverMM += m.mm;
      };

      updateMap(category, true, parent);
      if (parent) updateMap(parent, false);
      // Removed project-level drill down as per user request
    });

    if (!selectedCategory) {
      const topLevel = ['Projects', 'Product Maintenance', 'Project Support', 'Organization Support'];
      const baseResult = topLevel.map(key => ({ key, name: key, ...(dataMap[key] || { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0, isSubCategory: false, newMM: 0, carryOverMM: 0 }) }));
      
      const finalResult: any[] = [];
      baseResult.forEach(row => {
        finalResult.push(row);
        if (expandedCategories[row.name]) {
          let subs: string[] = [];
          if (row.name === 'Projects') subs = PROJECTS_SUB.map(s => `Projects:${s}`);
          else if (row.name === 'Product Maintenance') subs = MAINTENANCE_SUB.map(s => `Product Maintenance:${s}`);
          else if (row.name === 'Project Support') subs = PROJECT_SUPPORT_SUB.map(s => `Project Support:${s}`);
          else if (row.name === 'Organization Support') subs = ORG_SUPPORT_SUB.map(s => `Organization Support:${s}`);
          
          subs.forEach(subKey => {
            const subData = dataMap[subKey] || { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0, isSubCategory: true, parent: row.name, newMM: 0, carryOverMM: 0 };
            finalResult.push({ key: subKey, name: subKey.split(':')[1], ...subData });
          });
        }
      });
      return finalResult;
    }

    let sequence: string[] = [];
    if (selectedCategory.includes(':')) {
      sequence = Object.keys(dataMap).filter(k => k.startsWith('Project:') && dataMap[k].parent === selectedCategory);
    } else {
      if (selectedCategory === 'Projects') sequence = PROJECTS_SUB.map(s => `Projects:${s}`);
      else if (selectedCategory === 'Product Maintenance') sequence = MAINTENANCE_SUB.map(s => `Product Maintenance:${s}`);
      else if (selectedCategory === 'Project Support') sequence = PROJECT_SUPPORT_SUB.map(s => `Project Support:${s}`);
      else if (selectedCategory === 'Organization Support') sequence = ORG_SUPPORT_SUB.map(s => `Organization Support:${s}`);
    }
    
    return sequence.map(key => ({
      key,
      name: key.startsWith('Project:') ? key.replace('Project:', '') : (key.includes(':') ? key.split(':')[1] : key),
      ...(dataMap[key] || { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0, isSubCategory: key.includes(':'), parent: key.includes(':') ? key.split(':')[0] : undefined, newMM: 0, carryOverMM: 0 })
    }));
  }, [filteredProjects, selectedFYs, selectedCategory, expandedCategories, fiscalMode, config]);

  const grandTotal = useMemo(() => {
    return aggregatedData
      .filter(row => !row.isSubCategory && !row.isProject)
      .reduce((acc, curr) => ({
        manpowerMM: acc.manpowerMM + curr.manpowerMM,
        manpowerCr: acc.manpowerCr + curr.manpowerCr,
        expenseCr: acc.expenseCr + curr.expenseCr,
        totalCr: acc.totalCr + curr.totalCr,
        budgetCr: acc.budgetCr + curr.budgetCr,
      }), { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0 });
  }, [aggregatedData]);

  const consolidatedBudget = useMemo(() => {
    const manpowerData: Record<string, number[]> = {};
    const expenseData: Record<string, number[]> = {};
    MANPOWER_SEQUENCE.forEach(k => manpowerData[k] = new Array(numMonths).fill(0));
    EXPENSE_SEQUENCE.forEach(k => expenseData[k] = new Array(numMonths).fill(0));

    // Pre-calculate rates for all months
    const ratesCache: Record<number, { hRate: number, cRate: number }> = {};
    for (let i = 0; i < MAX_MONTHS; i++) {
      const startYear = 19 + Math.floor(i / 12);
      const fyStr = `FY ${startYear}-${startYear + 1}`;
      const fyConfig = config.fyFinancials?.[fyStr];
      ratesCache[i] = {
        hRate: (fyConfig?.hourlyRate !== undefined && fyConfig?.hourlyRate !== null) ? fyConfig.hourlyRate : (config.hourlyRate || RATE_PER_HOUR),
        cRate: (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) ? fyConfig.contractedEmployeeRate : (config.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE)
      };
    }
    const hpm = 180;

    const totalManpowerMM = new Array(numMonths).fill(0);
    const totalDirectManpowerMM = new Array(numMonths).fill(0);
    const totalHolidayMM = new Array(numMonths).fill(0);
    const totalManpowerCr = new Array(numMonths).fill(0);
    const totalDirectManpowerCr = new Array(numMonths).fill(0);
    const totalExpenseCr = new Array(numMonths).fill(0);
    const totalBudgetCr = new Array(numMonths).fill(0);

    const sourceKey = fiscalMode === 'Actuals' ? 'actuals' : (fiscalMode === 'Forecast' ? 'forecast' : 'rows');

    filteredProjects.forEach(p => {
      if (!isConfirmedProject(p)) return; // Only confirmed projects for summary
      const dataSource = sourceKey === 'actuals' ? (p.actuals || {}) : (sourceKey === 'forecast' ? (p.forecast || {}) : ((p.rows && Object.keys(p.rows).length > 0) ? p.rows : (p.pmoRows || {})));
      const isHolidayLeave = (p.name || '').toLowerCase().includes('holiday') || (p.name || '').toLowerCase().includes('leave');

      // Group and map categories first to avoid duplication
      const groupedPMOData: Record<string, Record<number, number>> = {};
      Object.entries(dataSource).forEach(([rawCat, monthsData]) => {
        const cat = SKILL_MAPPING[rawCat] || rawCat;
        if (!groupedPMOData[cat]) groupedPMOData[cat] = {};
        const getV = (idx: number) => {
          if (Array.isArray(monthsData)) return monthsData[idx] || 0;
          if (monthsData && typeof monthsData === 'object') return (monthsData as any)[idx] || (monthsData as any)[String(idx)] || 0;
          return 0;
        };
        for (let i = 0; i < numMonths; i++) {
          const gIdx = monthIndices[i];
          const val = getV(gIdx);
          if (val !== 0) groupedPMOData[cat][i] = (groupedPMOData[cat][i] || 0) + val;
        }
      });

      Object.entries(groupedPMOData).forEach(([cat, catMonths]) => {
        if (isSummaryOrCalculatedLabel(cat)) return;
        const normCat = cat.toLowerCase().trim();
        const isContractedExp = normCat === 'contracted employee expense';
        const catKind = classifyCategory(cat);
        const isContracted = catKind === 'CONTRACTED_MANPOWER';
        const isManpower = catKind === 'DIRECT_MANPOWER' || catKind === 'CONTRACTED_MANPOWER';
        const isExpense = catKind === 'EXPENSE';

        for (let i = 0; i < numMonths; i++) {
          const v = catMonths[i] || 0;
          const globalIdx = monthIndices[i];
          if (v === 0) continue;

          if (isManpower) {
            if (isHolidayLeave && !isContracted) totalHolidayMM[i] += v;
            else {
              if (!manpowerData[cat]) manpowerData[cat] = new Array(numMonths).fill(0);
              manpowerData[cat][i] += v;
            }
            totalManpowerMM[i] += v;
            if (!isContracted) totalDirectManpowerMM[i] += v;

            if (!isHolidayLeave || isContracted) {
              const { hRate, cRate } = ratesCache[globalIdx];
              const cost = isContracted ? (v * cRate * hpm) / 10000000 : (v * hRate * hpm) / 10000000;
              totalManpowerCr[i] += cost;
              if (!isContracted) totalDirectManpowerCr[i] += cost;
              if (isContracted) {
                if (!expenseData['Contracted Employee Expense']) expenseData['Contracted Employee Expense'] = new Array(numMonths).fill(0);
                expenseData['Contracted Employee Expense'][i] += cost;
              }
            }
          } else if (isExpense && !isContractedExp) {
            if (!isHolidayLeave) {
              if (!expenseData[cat]) expenseData[cat] = new Array(numMonths).fill(0);
              const cost = Math.abs(v) > 1000 ? v / 10000000 : v;
              expenseData[cat][i] += cost;
              totalExpenseCr[i] += cost;
            }
          } else if (isContractedExp) {
            const mmArr = Array.isArray(dataSource['Contracted Employee'] || dataSource['Contracted Employee (MM)']) ? (dataSource['Contracted Employee'] || dataSource['Contracted Employee (MM)']) : [];
            if ((mmArr[globalIdx] || 0) === 0) {
              const cost = Math.abs(v) > 1000 ? v / 10000000 : v;
              if (!expenseData[cat]) expenseData[cat] = new Array(numMonths).fill(0);
              expenseData[cat][i] += cost;
              totalManpowerCr[i] += cost;
            }
          }
        }
      });
    });

    for (let i = 0; i < numMonths; i++) totalBudgetCr[i] = totalManpowerCr[i] + totalExpenseCr[i];

    return {
      manpowerData,
      expenseData,
      sortedManpowerKeys: Object.keys(manpowerData).sort((a, b) => MANPOWER_CATEGORIES.indexOf(a as any) - MANPOWER_CATEGORIES.indexOf(b as any)),
      sortedExpenseKeys: Object.keys(expenseData).sort((a, b) => EXPENSE_CATEGORIES.indexOf(a as any) - EXPENSE_CATEGORIES.indexOf(b as any)),
      totalManpowerMM,
      totalDirectManpowerMM,
      totalHolidayMM,
      totalManpowerCr,
      totalDirectManpowerCr,
      totalExpenseCr,
      totalBudgetCr
    };
  }, [filteredProjects, selectedFYs, config, fiscalMode, numMonths, yearOffset, months]);

  const breakdownData = useMemo(() => {
    const sourceKey = fiscalMode === 'Actuals' ? 'actuals' : (fiscalMode === 'Forecast' ? 'forecast' : 'rows');
    const metrics: Record<string, any> = {};
    const strategic = {
      ivi: { total: 0, newCr: 0, coCr: 0, confirmed: 0, newCount: 0, coCount: 0 },
      ae: { total: 0, newCr: 0, coCr: 0, confirmed: 0, newCount: 0, coCount: 0 },
      initia_add: { total: 0, newCr: 0, coCr: 0, confirmed: 0, newCount: 0, coCount: 0 }
    };

    const allProjectVerticals = Array.from(new Set([
      ...CORE_VERTICALS,
      ...(verticals || []),
      ...filteredProjects.map(p => p.vertical).filter(Boolean)
    ]));

    [...new Set([...allProjectVerticals, 'ATG', 'NA'])].forEach(v => {
      metrics[v] = { total: 0, newCr: 0, coCr: 0, confirmed: 0, newCount: 0, coCount: 0 };
    });

    let grandTotalCr = 0;

    filteredProjects.forEach(p => {
      if (isConfirmedProject(p)) {
        const m = getProjectMetrics(p, sourceKey);
        const v = p.vertical || 'NA';
        grandTotalCr += m.total;

        if (!metrics[v]) {
          metrics[v] = { total: 0, newCr: 0, coCr: 0, confirmed: 0, newCount: 0, coCount: 0 };
        }

        if (p.productFamily === 'IVI' && isNew(p.category)) {
          strategic.ivi.total += m.total; strategic.ivi.newCr += m.newCr; strategic.ivi.coCr += m.coCr; strategic.ivi.confirmed++; strategic.ivi.newCount++;
        } else if (p.productFamily === 'Auto Expo') {
          strategic.ae.total += m.total; strategic.ae.newCr += m.newCr; strategic.ae.coCr += m.coCr; strategic.ae.confirmed++; strategic.ae.newCount++;
        } else if (p.productFamily === 'INITIA' && isNew(p.category)) {
          strategic.initia_add.total += m.total; strategic.initia_add.newCr += m.newCr; strategic.initia_add.coCr += m.coCr; strategic.initia_add.confirmed++; strategic.initia_add.newCount++;
        } else {
          metrics[v].total += m.total; metrics[v].newCr += m.newCr; metrics[v].coCr += m.coCr; metrics[v].confirmed++;
          if (isNew(p.category)) metrics[v].newCount++; else if (isCO(p.category)) metrics[v].coCount++;
        }
      }
    });

    const adjustedMetrics: Record<string, any> = {};
    allProjectVerticals.forEach(v => {
      adjustedMetrics[v] = { ...( (metrics && metrics[v]) || { total: 0, newCr: 0, coCr: 0, confirmed: 0, newCount: 0, coCount: 0 }) };
    });
    
    const redistributionSource = (metrics['CoC'] || { total: 0, newCr: 0, coCr: 0, confirmed: 0, newCount: 0, coCount: 0 });
    const totalDistOther = (metrics['NA']?.total || 0);
    const totalToDistribute = redistributionSource.total + totalDistOther;
    const newToDistribute = redistributionSource.newCr + (metrics['NA']?.newCr || 0);
    const coToDistribute = redistributionSource.coCr + (metrics['NA']?.coCr || 0);
    
    ADJ_DISTRIBUTION_TARGETS.forEach(v => {
      if (adjustedMetrics[v]) {
        adjustedMetrics[v].total += totalToDistribute / 3;
        adjustedMetrics[v].newCr += newToDistribute / 3;
        adjustedMetrics[v].coCr += coToDistribute / 3;
      }
    });

    const activeCoreList = allProjectVerticals.filter(v => v !== 'ATG' && v !== 'NA');

    const totalCoreA = activeCoreList.reduce((acc, v) => {
      const m = metrics[v] || { total: 0, newCr: 0, coCr: 0, confirmed: 0, newCount: 0, coCount: 0 };
      acc.total += m.total; acc.newCr += m.newCr; acc.coCr += m.coCr; acc.confirmed += m.confirmed; acc.newCount += m.newCount; acc.coCount += m.coCount;
      return acc;
    }, { total: 0, newCr: 0, coCr: 0, confirmed: 0, newCount: 0, coCount: 0 });

    return { metrics, adjustedMetrics, strategic, totalCoreA, allVerticals: activeCoreList, grandTotalCr };
  }, [filteredProjects, verticals, fiscalMode, config, selectedFYs, hoursPerMonth, hourlyRate]);

  const executiveSplitsData = useMemo(() => {
    const sourceKey = fiscalMode === 'Actuals' ? 'actuals' : (fiscalMode === 'Forecast' ? 'forecast' : 'rows');
    const customerMap: Record<string, any> = {};
    const familyMap: Record<string, any> = {};
    const verticalMap: Record<string, any> = {};
    const buMap: Record<string, any> = {};
    const domainMap: Record<string, any> = {};
    let grandTotalCr = 0;
    let grandTotalMM = 0;

    const confirmedProjects = filteredProjects.filter(p => isConfirmedProject(p));

    confirmedProjects.forEach(p => {
      const m = getProjectMetrics(p, sourceKey);
      let cust = (p.customer || '').trim();
      if (!cust || cust.toLowerCase() === 'na' || cust.toLowerCase() === 'n/a') cust = 'NA / Internal';
      let fam = (p.productFamily || '').trim();
      if (!fam || fam.toLowerCase() === 'na' || fam.toLowerCase() === 'n/a') fam = 'NA / Unassigned';
      let vert = (p.vertical || '').trim();
      if (!vert || vert.toLowerCase() === 'na' || vert.toLowerCase() === 'n/a') vert = 'NA / Unassigned';
      let bu = (p.businessUnit || '').trim();
      if (!bu || bu.toLowerCase() === 'na' || bu.toLowerCase() === 'n/a') bu = 'NA / Unassigned';
      let dom = (p.buDomain || '').trim();
      if (!dom || dom.toLowerCase() === 'na' || dom.toLowerCase() === 'n/a') dom = 'NA / Unassigned';

      grandTotalCr += m.total;
      grandTotalMM += m.directMM;

      const initMap = (map: Record<string, any>, key: string) => {
        if (!map[key]) map[key] = { name: key, confirmed: 0, newCount: 0, coCount: 0, newCr: 0, coCr: 0, mm: 0, directMM: 0, totalCr: 0 };
      };

      initMap(customerMap, cust);
      initMap(familyMap, fam);
      initMap(verticalMap, vert);
      initMap(buMap, bu);
      initMap(domainMap, dom);

      [customerMap[cust], familyMap[fam], verticalMap[vert], buMap[bu], domainMap[dom]].forEach(item => {
        item.confirmed++;
        item.totalCr += m.total;
        item.mm += m.mm;
        item.directMM += m.directMM;
        if (isNew(p.category)) { item.newCount++; item.newCr += m.total; }
        else if (isCO(p.category)) { item.coCount++; item.coCr += m.total; }
      });
    });

    const finalize = (map: Record<string, any>) => Object.values(map).map((item: any) => ({
      ...item,
      share: grandTotalCr > 0 ? (item.totalCr / grandTotalCr) * 100 : 0
    })).sort((a: any, b: any) => b.totalCr - a.totalCr);

    return {
      customers: finalize(customerMap),
      families: finalize(familyMap),
      verticals: finalize(verticalMap),
      bus: finalize(buMap),
      domains: finalize(domainMap),
      grandTotalCr,
      grandTotalMM,
      confirmedCount: confirmedProjects.length
    };
  }, [filteredProjects, fiscalMode, config, selectedFYs, hoursPerMonth, hourlyRate]);

  const loadAnalysisData = useMemo(() => {
    const sourceKey = fiscalMode === 'Actuals' ? 'actuals' : (fiscalMode === 'Forecast' ? 'forecast' : 'rows');
    const pdhMap: Record<string, any> = {};
    const buMap: Record<string, any> = {};
    const familyMap: Record<string, any> = {};
    let grandTotalCr = 0;

    filteredProjects.filter(p => isConfirmedProject(p)).forEach(p => {
      const m = getProjectMetrics(p, sourceKey);
      const pdh = p.pdh || 'NA';
      const bu = p.businessUnit || 'NA';
      const family = p.productFamily || 'NA';
      grandTotalCr += m.total;

      const initMap = (map: Record<string, any>, key: string) => {
        if (!map[key]) map[key] = { name: key, confirmed: 0, newCount: 0, coCount: 0, newCr: 0, coCr: 0, mm: 0, totalCr: 0 };
      };

      initMap(pdhMap, pdh); initMap(buMap, bu); initMap(familyMap, family);

      [pdhMap[pdh], buMap[bu], familyMap[family]].forEach(item => {
        item.confirmed++;
        item.totalCr += m.total;
        item.mm += m.mm;
        if (isNew(p.category)) { item.newCount++; item.newCr += m.total; }
        else if (isCO(p.category)) { item.coCount++; item.coCr += m.total; }
      });
    });

    const finalize = (map: Record<string, any>) => Object.values(map).map((item: any) => ({
      ...item,
      share: grandTotalCr > 0 ? (item.totalCr / grandTotalCr) * 100 : 0
    })).sort((a: any, b: any) => b.totalCr - a.totalCr);

    return { pdhList: finalize(pdhMap), buList: finalize(buMap), familyList: finalize(familyMap), grandTotalCr };
  }, [filteredProjects, hourlyRate, hoursPerMonth]);

  const monthlyRollupBase = useMemo(() => {
    const sourceKey = fiscalMode === 'Actuals' ? 'actuals' : (fiscalMode === 'Forecast' ? 'forecast' : 'rows');

    return months.map((m, mIdx) => {
      const rollup: any = { name: m, totalMM: 0, totalExpOnlyCR: 0 };
      filteredProjects.filter(p => isConfirmedProject(p)).forEach(p => {
        const dataSource = sourceKey === 'rows'
          ? ((p.rows && Object.keys(p.rows).length > 0) ? p.rows : (p.pmoRows || {}))
          : (p[sourceKey] || {});
        const dataIdx = monthIndices[mIdx];
        
        if (dataIdx >= 0 && dataIdx < MAX_MONTHS) {
          Object.entries(dataSource).forEach(([rawCat, monthsData]) => {
            if (isSummaryOrCalculatedLabel(rawCat)) return;
            const cat = SKILL_MAPPING[rawCat] || rawCat;
            const catKind = classifyCategory(cat);
            const getVal = (idx: number) => {
              if (Array.isArray(monthsData)) return monthsData[idx] || 0;
              if (monthsData && typeof monthsData === 'object') return (monthsData as any)[idx] || (monthsData as any)[String(idx)] || 0;
              return 0;
            };
            const val = getVal(dataIdx);
            if (val === 0) return;

            if (catKind === 'DIRECT_MANPOWER' || catKind === 'CONTRACTED_MANPOWER') {
              rollup[cat] = (rollup[cat] || 0) + val;
              rollup.totalMM += val;
            } else if (catKind === 'EXPENSE') {
              const expVal = Math.abs(val) > 1000 ? val / 10000000 : val;
              rollup['Exp_' + cat] = (rollup['Exp_' + cat] || 0) + expVal;
              rollup.totalExpOnlyCR += expVal;
            }
          });
        }
      });
      return rollup;
    });
  }, [filteredProjects, months, hoursPerMonth, hourlyRate, selectedFYs, monthIndices, fiscalMode]);

  interface SplitItem {
    name: string;
    confirmed: number;
    newCount: number;
    coCount: number;
    newCr: number;
    coCr: number;
    totalCr: number;
    mm: number;
    directMM: number;
    share: number;
  }

  interface HorizontalSplitCardProps {
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    data: SplitItem[];
    totalCr: number;
    accentColor?: string;
    barColor?: string;
    cardRef?: React.RefObject<HTMLDivElement | null>;
    globalViewType: 'tabular' | 'graphical';
  }

  const HorizontalSplitCard: React.FC<HorizontalSplitCardProps> = ({
    title,
    subtitle,
    icon,
    data,
    totalCr,
    accentColor = "border-indigo-500",
    barColor = "#4f46e5",
    cardRef,
    globalViewType
  }) => {
    const [localViewType, setLocalViewType] = useState<'tabular' | 'graphical' | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'totalCr', direction: 'desc' });
    const viewType = localViewType || globalViewType;

    const sortedData = useMemo(() => {
      const list = data.map(item => ({
        ...item,
        labelWithPct: `₹${item.totalCr.toFixed(2)} Cr (${item.share.toFixed(1)}%)`
      }));
      return list.sort((a, b) => {
        let valA = a[sortConfig.key as keyof SplitItem];
        let valB = b[sortConfig.key as keyof SplitItem];
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
      });
    }, [data, sortConfig]);

    const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const fmtPct = (v: number) => `${v.toFixed(2)}%`;

    const handleSort = (key: string) => {
      setSortConfig(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
      }));
    };

    const handleTsvCopy = () => {
      const header = ["Dimension", "Confirmed (N/CO)", "New Cr", "CO Cr", "Total Cr", "Average/Mo", "Direct MM", "% Share"];
      const rows = sortedData.map(item => [
        item.name,
        `${item.confirmed} (${item.newCount}/${item.coCount})`,
        item.newCr.toFixed(2),
        item.coCr.toFixed(2),
        item.totalCr.toFixed(2),
        (item.totalCr / (months.length || 12)).toFixed(2),
        item.directMM.toFixed(1),
        `${item.share.toFixed(2)}%`
      ]);
      copyTsvToClipboard([header, ...rows].map(r => r.join('\t')).join('\n'));
    };

    const handleStyledCopy = () => {
      const header = ["Dimension", "Confirmed (N/CO)", "New Cr", "CO Cr", "Total Cr", "Average/Mo", "Direct MM", "% Share"];
      const rows = sortedData.map(item => [
        item.name,
        `${item.confirmed} (${item.newCount}/${item.coCount})`,
        item.newCr.toFixed(2),
        item.coCr.toFixed(2),
        item.totalCr.toFixed(2),
        (item.totalCr / (months.length || 12)).toFixed(2),
        item.directMM.toFixed(1),
        `${item.share.toFixed(2)}%`
      ]);
      const html = `<table border="1" style="border-collapse: collapse; font-family: Inter, sans-serif; font-size: 11px;"><thead style="background: #0f172a; color: #fff;"><tr>${header.map(h => `<th style="padding: 8px;">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td style="padding: 6px; border: 1px solid #e2e8f0; ${i === 2 ? 'color: #4f46e5;' : i === 3 ? 'color: #f97316;' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      copyStyledToClipboard(html, rows.map(r => r.join('\t')).join('\n'));
    };

    const dynamicHeight = Math.max(340, Math.min(650, sortedData.length * 36 + 60));

    return (
      <div ref={cardRef} className="bg-white border border-slate-200 p-6 sm:p-8 rounded-[2.5rem] shadow-sm flex flex-col relative group overflow-hidden">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 text-indigo-600 shadow-sm">
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">{title}</h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {sortedData.length} items
                </span>
              </div>
              {subtitle && (
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex p-1 bg-slate-100 rounded-xl">
              <button 
                onClick={() => setLocalViewType('graphical')} 
                className={`px-2.5 py-1 text-[9px] font-black rounded-lg transition-all flex items-center gap-1 uppercase ${viewType === 'graphical' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <BarChart3 className="w-3 h-3" />
                Chart
              </button>
              <button 
                onClick={() => setLocalViewType('tabular')} 
                className={`px-2.5 py-1 text-[9px] font-black rounded-lg transition-all flex items-center gap-1 uppercase ${viewType === 'tabular' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <TableIcon className="w-3 h-3" />
                Table
              </button>
            </div>

            {/* Export & Copy */}
            <div className="flex p-1 bg-slate-100 rounded-xl">
              <button onClick={handleTsvCopy} className="px-2.5 py-1 text-[9px] font-black text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all uppercase" title="Copy TSV">
                TSV
              </button>
              <button onClick={handleStyledCopy} className="px-2.5 py-1 text-[9px] font-black text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all uppercase" title="Copy Styled HTML">
                Styled
              </button>
            </div>

            {cardRef && (
              <button 
                onClick={() => copyWidgetImage(cardRef, title)} 
                className="bg-slate-900 text-white p-2 rounded-xl shadow hover:bg-black transition-all flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95" 
                title="Download & Copy Snapshot"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="2.5"/><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2.5"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* Content View */}
        {viewType === 'graphical' ? (
          <div className="w-full overflow-y-auto no-scrollbar" style={{ height: `${dynamicHeight}px` }}>
            <ResponsiveContainer width="100%" height={dynamicHeight}>
              <BarChart
                layout="vertical"
                data={sortedData}
                margin={{ top: 8, right: 160, left: 10, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis 
                  type="number" 
                  tickFormatter={(v) => `₹${v.toFixed(1)} Cr`} 
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fontSize: 11, fontWeight: 800, fill: '#334155' }}
                  width={150}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as SplitItem;
                      return (
                        <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl text-xs font-sans border border-slate-800 space-y-1.5 min-w-[220px]">
                          <div className="font-black uppercase text-indigo-400 border-b border-slate-800 pb-1 flex justify-between items-center">
                            <span>{d.name}</span>
                            <span className="text-emerald-400 font-mono">{d.share.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Total Budget:</span>
                            <span className="font-bold text-white font-mono">₹{d.totalCr.toFixed(2)} Cr ({d.share.toFixed(1)}%)</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>New vs Carryover:</span>
                            <span className="font-bold text-indigo-300 font-mono">₹{d.newCr.toFixed(2)} / ₹{d.coCr.toFixed(2)} Cr</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Confirmed Projects:</span>
                            <span className="font-bold text-white font-mono">{d.confirmed} ({d.newCount} New / {d.coCount} CO)</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Direct Effort:</span>
                            <span className="font-bold text-sky-400 font-mono">{d.directMM.toFixed(1)} MM</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="totalCr" 
                  radius={[0, 8, 8, 0]}
                  barSize={18}
                >
                  {sortedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={DISTINCT_COLORS[index % DISTINCT_COLORS.length]} />
                  ))}
                  <LabelList 
                    dataKey="labelWithPct" 
                    position="right" 
                    style={{ fill: '#334155', fontSize: 10, fontWeight: 800, fontFamily: 'monospace' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="overflow-auto no-scrollbar flex-grow max-h-[500px] border border-slate-100 rounded-2xl">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="text-[8px] font-black uppercase text-slate-400 sticky top-0 bg-slate-50 z-10">
                <tr>
                  <th onClick={() => handleSort('name')} className="px-4 py-3 border-b cursor-pointer hover:text-indigo-600 transition-colors">Dimension <SortIndicator active={sortConfig.key === 'name'} direction={sortConfig.direction} /></th>
                  <th onClick={() => handleSort('confirmed')} className="px-4 py-3 border-b text-center cursor-pointer hover:text-indigo-600 transition-colors">Confirmed (N/CO) <SortIndicator active={sortConfig.key === 'confirmed'} direction={sortConfig.direction} /></th>
                  <th onClick={() => handleSort('newCr')} className="px-4 py-3 border-b text-right cursor-pointer hover:text-indigo-600 transition-colors">New Cr <SortIndicator active={sortConfig.key === 'newCr'} direction={sortConfig.direction} /></th>
                  <th onClick={() => handleSort('coCr')} className="px-4 py-3 border-b text-right cursor-pointer hover:text-indigo-600 transition-colors">CO Cr <SortIndicator active={sortConfig.key === 'coCr'} direction={sortConfig.direction} /></th>
                  <th onClick={() => handleSort('totalCr')} className="px-4 py-3 border-b text-right cursor-pointer hover:text-indigo-600 transition-colors">Total Cr <SortIndicator active={sortConfig.key === 'totalCr'} direction={sortConfig.direction} /></th>
                  <th onClick={() => handleSort('directMM')} className="px-4 py-3 border-b text-right cursor-pointer hover:text-indigo-600 transition-colors">Direct MM <SortIndicator active={sortConfig.key === 'directMM'} direction={sortConfig.direction} /></th>
                  <th onClick={() => handleSort('share')} className="px-4 py-3 border-b text-center cursor-pointer hover:text-indigo-600 transition-colors">% Share <SortIndicator active={sortConfig.key === 'share'} direction={sortConfig.direction} /></th>
                </tr>
              </thead>
              <tbody className="text-[10px] font-black text-slate-700">
                {sortedData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 h-9 transition-colors">
                    <td className="px-4 border-b border-slate-50 uppercase text-slate-700 font-bold truncate max-w-[200px]">{item.name}</td>
                    <td className="px-4 border-b border-slate-50 text-center">{item.confirmed} (<span className="text-indigo-600">{item.newCount}</span>/<span className="text-orange-600">{item.coCount}</span>)</td>
                    <td className="px-4 border-b border-slate-50 text-right font-mono text-indigo-600">{fmt(item.newCr)}</td>
                    <td className="px-4 border-b border-slate-50 text-right font-mono text-orange-600">{fmt(item.coCr)}</td>
                    <td className="px-4 border-b border-slate-50 text-right font-mono text-slate-900">{fmt(item.totalCr)}</td>
                    <td className="px-4 border-b border-slate-50 text-right font-mono text-sky-600">{fmt(item.directMM)}</td>
                    <td className="px-4 border-b border-slate-50 text-center font-mono text-emerald-600">{fmtPct(item.share)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-900 text-white font-black h-12 uppercase tracking-widest border-t-2 border-indigo-500 sticky bottom-0">
                  <td className="px-4">TOTAL AGGREGATE</td>
                  <td className="px-4 text-center">{data.reduce((s, i) => s + i.confirmed, 0)}</td>
                  <td className="px-4 text-right font-mono text-indigo-400">{fmt(data.reduce((s, i) => s + i.newCr, 0))}</td>
                  <td className="px-4 text-right font-mono text-orange-400">{fmt(data.reduce((s, i) => s + i.coCr, 0))}</td>
                  <td className="px-4 text-right font-mono text-base">{fmt(totalCr)}</td>
                  <td className="px-4 text-right font-mono text-sky-300">{fmt(data.reduce((s, i) => s + i.directMM, 0))}</td>
                  <td className="px-4 text-center font-mono">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const AllocationTable = ({ title, data, totalC, isAdjusted, cardRef, globalViewType }: any) => {
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const coreTargets = isAdjusted ? ['ECS-1', 'ECS-2', 'LAS', 'INITIA', 'Support'] : (data?.allVerticals || CORE_VERTICALS);
    const targetMetrics = (isAdjusted ? data?.adjustedMetrics : data?.metrics) || {};
    
    const getMetric = (v: string) => targetMetrics[v] || { total: 0, newCr: 0, coCr: 0, confirmed: 0, newCount: 0, coCount: 0 };

    const sortedTargets = useMemo(() => {
      const list = [...coreTargets];
      if (!sortConfig) return list;
      return list.sort((a, b) => {
        const mA = getMetric(a);
        const mB = getMetric(b);
        let valA: any = a, valB: any = b;
        if (sortConfig.key === 'vertical') { valA = a; valB = b; }
        else if (sortConfig.key === 'confirmed') { valA = mA.confirmed; valB = mB.confirmed; }
        else if (sortConfig.key === 'newCr') { valA = mA.newCr; valB = mB.newCr; }
        else if (sortConfig.key === 'coCr') { valA = mA.coCr; valB = mB.coCr; }
        else if (sortConfig.key === 'total') { valA = mA.total; valB = mB.total; }
        
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
      });
    }, [coreTargets, targetMetrics, sortConfig]);

    const chartData = useMemo(() => {
      return sortedTargets.map(v => ({ name: v, value: getMetric(v).total }));
    }, [sortedTargets, targetMetrics]);

    const handleSort = (key: string) => {
      setSortConfig(prev => ({ key, direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const atg = data?.metrics?.['ATG'] || { total: 0, newCr: 0, coCr: 0, confirmed: 0, newCount: 0, coCount: 0 };
    const totalA = coreTargets.reduce((acc: any, v: string) => { const m = getMetric(v); acc.total += m.total; acc.newCr += m.newCr; acc.coCr += m.coCr; acc.confirmed += m.confirmed; acc.newCount += m.newCount; acc.coCount += m.coCount; return acc; }, { total: 0, newCr: 0, coCr: 0, confirmed: 0, newCount: 0, coCount: 0 });
    const strat = data?.strategic || { ivi: { total: 0, newCr: 0, coCr: 0, confirmed: 0, newCount: 0, coCount: 0 }, ae: { total: 0, newCr: 0, coCr: 0, confirmed: 0, newCount: 0, coCount: 0 }, initia_add: { total: 0, newCr: 0, coCr: 0, confirmed: 0, newCount: 0, coCount: 0 } };
    const totalB = { total: totalA.total + strat.ivi.total + strat.ae.total + strat.initia_add.total, newCr: totalA.newCr + strat.ivi.newCr + strat.ae.newCr + strat.initia_add.newCr, coCr: totalA.coCr + strat.ivi.coCr + strat.ae.coCr + strat.initia_add.coCr, confirmed: totalA.confirmed + strat.ivi.confirmed + strat.ae.confirmed + strat.initia_add.confirmed, newCount: totalA.newCount + strat.ivi.newCount + strat.ae.newCount + strat.initia_add.newCount, coCount: totalA.coCount + strat.ivi.coCount + strat.ae.coCount + strat.initia_add.coCount };
    const finalTotalC = { total: totalB.total + atg.total, newCr: totalB.newCr + atg.newCr, coCr: totalB.coCr + atg.coCr, confirmed: totalB.confirmed + atg.confirmed, newCount: totalB.newCount + atg.newCount, coCount: totalB.coCount + atg.coCount };

    const effectiveTotal = finalTotalC.total > 0 ? finalTotalC.total : (totalC || 1);

    const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const fmtPct = (v: number) => `${v.toFixed(2)}%`;

    const handleTsvCopy = () => {
      const header = ["Vertical", "Confirmed (N/CO)", "New Cr", "CO Cr", "Total Crs", "% Share"];
      const rows = sortedTargets.map(v => { const m = getMetric(v); return [v, `${m.confirmed} (${m.newCount}/${m.coCount})`, m.newCr.toFixed(2), m.coCr.toFixed(2), m.total.toFixed(2), `${((m.total / effectiveTotal) * 100).toFixed(2)}%`]; });
      copyTsvToClipboard([header, ...rows].map(r => r.join('\t')).join('\n'));
    };

    const handleStyledCopy = () => {
      const header = ["Vertical", "Confirmed (N/CO)", "New Cr", "CO Cr", "Total Crs", "% Share"];
      const rows = sortedTargets.map(v => { const m = getMetric(v); return [v, `${m.confirmed} (${m.newCount}/${m.coCount})`, m.newCr.toFixed(2), m.coCr.toFixed(2), m.total.toFixed(2), `${((m.total / effectiveTotal) * 100).toFixed(2)}%`]; });
      const html = `<table border="1" style="border-collapse: collapse; font-family: Inter, sans-serif; font-size: 11px;"><thead style="background: #0f172a; color: #fff;"><tr>${header.map(h => `<th style="padding: 8px;">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td style="padding: 6px; border: 1px solid #e2e8f0; ${i === 2 ? 'color: #4f46e5;' : i === 3 ? 'color: #f97316;' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      copyStyledToClipboard(html, rows.map(r => r.join('\t')).join('\n'));
    };

    return (
      <div ref={cardRef} className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm flex flex-col h-[500px] relative group overflow-hidden">
        <div className="flex items-center justify-between mb-8 shrink-0">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight border-l-4 border-indigo-500 pl-4">{title}</h3>
          <div className="flex items-center space-x-2">
            {globalViewType === 'tabular' ? (
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <button onClick={handleTsvCopy} className="px-3 py-1 text-[8px] font-black text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all uppercase">TSV</button>
                <button onClick={handleStyledCopy} className="px-3 py-1 text-[8px] font-black text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all uppercase">Styled</button>
              </div>
            ) : (
              <button 
                onClick={() => copyWidgetImage(cardRef, title)} 
                className="bg-slate-900 text-white p-2 rounded-xl shadow-lg hover:bg-black transition-all flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95"
                title="Download & Copy Snapshot"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="2.5"/><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2.5"/></svg>
              </button>
            )}
          </div>
        </div>
        
        {globalViewType === 'tabular' ? (
          <div className="overflow-auto no-scrollbar flex-grow">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="text-[8px] font-black uppercase text-slate-400 sticky top-0 bg-white z-10">
                <tr>
                  <th onClick={() => handleSort('vertical')} className="px-4 py-2 border-b cursor-pointer hover:text-indigo-600 transition-colors">Vertical <SortIndicator active={sortConfig?.key === 'vertical'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('confirmed')} className="px-4 py-2 border-b text-center cursor-pointer hover:text-indigo-600 transition-colors">Confirmed (N/CO) <SortIndicator active={sortConfig?.key === 'confirmed'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('newCr')} className="px-4 py-2 border-b text-right cursor-pointer hover:text-indigo-600 transition-colors">New Cr <SortIndicator active={sortConfig?.key === 'newCr'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('coCr')} className="px-4 py-2 border-b text-right cursor-pointer hover:text-indigo-600 transition-colors">CO Cr <SortIndicator active={sortConfig?.key === 'coCr'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('total')} className="px-4 py-2 border-b text-right cursor-pointer hover:text-indigo-600 transition-colors">{isAdjusted ? 'Adj Total Crs' : 'Total Crs'} <SortIndicator active={sortConfig?.key === 'total'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th className="px-4 py-2 border-b text-center">% Share</th>
                </tr>
              </thead>
              <tbody className="text-[10px] font-black text-slate-700">
                {sortedTargets.map(v => {
                  const m = getMetric(v);
                  const share = totalC > 0 ? (m.total / totalC) * 100 : 0;
                  return (
                    <tr key={v} className="hover:bg-slate-50 h-9">
                      <td className="px-4 border-b border-slate-50 uppercase text-slate-400">{v}</td>
                      <td className="px-4 border-b border-slate-50 text-center">
                        {m.confirmed} (<span className="text-indigo-600">{m.newCount}</span>/<span className="text-orange-600">{m.coCount}</span>)
                      </td>
                      <td className="px-4 border-b border-slate-50 text-right font-mono text-indigo-600">{fmt(m.newCr)}</td>
                      <td className="px-4 border-b border-slate-50 text-right font-mono text-orange-600">{fmt(m.coCr)}</td>
                      <td className="px-4 border-b border-slate-50 text-right font-mono">{fmt(m.total)}</td>
                      <td className="px-4 border-b border-slate-50 text-center font-mono text-emerald-500">{fmtPct(share)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-900 text-white font-black h-10 italic"><td className="px-4">Total (A)</td><td className="px-4 text-center">{totalA.confirmed} ({totalA.newCount}/{totalA.coCount})</td><td className="px-4 text-right font-mono text-indigo-300">{fmt(totalA.newCr)}</td><td className="px-4 text-right font-mono text-orange-300">{fmt(totalA.coCr)}</td><td className="px-4 text-right font-mono">{fmt(totalA.total)}</td><td className="px-4 text-center font-mono">{totalC > 0 ? fmtPct((totalA.total / totalC) * 100) : ""}</td></tr>
                {['IVI', 'AUTO EXPO', 'INITIA (ADD)'].map(seg => {
                  const s = seg === 'IVI' ? data.strategic.ivi : seg === 'AUTO EXPO' ? data.strategic.ae : data.strategic.initia_add;
                  const share = totalC > 0 ? (s.total / totalC) * 100 : 0;
                  return (
                    <tr key={seg} className="hover:bg-slate-50 h-9 font-bold text-indigo-600">
                      <td className="px-4 border-b border-slate-50">{seg}</td>
                      <td className="px-4 border-b border-slate-50 text-center">
                        {s.confirmed} (<span className="text-indigo-600/70">{s.newCount}</span>/<span className="text-orange-600/70">{s.coCount}</span>)
                      </td>
                      <td className="px-4 border-b border-slate-50 text-right font-mono text-indigo-600/70">{fmt(s.newCr)}</td>
                      <td className="px-4 border-b border-slate-50 text-right font-mono text-orange-600/70">{fmt(s.coCr)}</td>
                      <td className="px-4 border-b border-slate-50 text-right font-mono">{fmt(s.total)}</td>
                      <td className="px-4 border-b border-slate-50 text-center font-mono">{fmtPct(share)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-900 text-white font-black h-12 uppercase tracking-widest border-t-2 border-indigo-500"><td className="px-4">TOTAL (C)</td><td className="px-4 text-center">{finalTotalC.confirmed} ({finalTotalC.newCount}/{finalTotalC.coCount})</td><td className="px-4 text-right font-mono text-indigo-400">{fmt(finalTotalC.newCr)}</td><td className="px-4 text-right font-mono text-orange-400">{fmt(finalTotalC.coCr)}</td><td className="px-4 text-right font-mono text-base">{fmt(finalTotalC.total)}</td><td className="px-4 text-center font-mono">100%</td></tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-grow w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                  label={renderDonutLabel}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={VERTICAL_COLORS[entry.name] || CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  const LoadTable = ({ title, data, totalC, cardRef, accentColor, globalViewType }: { title: string, data: any[], totalC: number, cardRef: React.RefObject<HTMLDivElement | null>, accentColor: string, globalViewType: 'tabular' | 'graphical' }) => {
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const sortedData = useMemo(() => {
      const list = [...data];
      if (!sortConfig) return list;
      return list.sort((a, b) => {
        let valA = a[sortConfig.key as keyof any];
        let valB = b[sortConfig.key as keyof any];
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
      });
    }, [data, sortConfig]);

    const chartData = useMemo(() => {
      return sortedData.slice(0, 10).map(item => ({ name: item.name, value: item.totalCr }));
    }, [sortedData]);

    const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const fmtPct = (v: number) => `${v.toFixed(2)}%`;

    const handleSort = (key: string) => setSortConfig(prev => ({ key, direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));

    const handleTsvCopy = () => {
      const header = ["Operational Unit", "Confirmed (N/CO)", "New Cr", "CO Cr", "Total Cr", "Average Cr", "% Share"];
      const rows = sortedData.map(item => [item.name, `${item.confirmed} (${item.newCount}/${item.coCount})`, item.newCr.toFixed(2), item.coCr.toFixed(2), item.totalCr.toFixed(2), (item.totalCr / months.length).toFixed(2), `${item.share.toFixed(2)}%`]);
      copyTsvToClipboard([header, ...rows].map(r => r.join('\t')).join('\n'));
    };

    const handleStyledCopy = () => {
      const header = ["Operational Unit", "Confirmed (N/CO)", "New Cr", "CO Cr", "Total Cr", "Average Cr", "% Share"];
      const rows = sortedData.map(item => [item.name, `${item.confirmed} (${item.newCount}/${item.coCount})`, item.newCr.toFixed(2), item.coCr.toFixed(2), item.totalCr.toFixed(2), (item.totalCr / months.length).toFixed(2), `${item.share.toFixed(2)}%`]);
      const html = `<table border="1" style="border-collapse: collapse; font-family: Inter, sans-serif; font-size: 11px;"><thead style="background: #0f172a; color: #fff;"><tr>${header.map(h => `<th style="padding: 8px;">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td style="padding: 6px; border: 1px solid #e2e8f0; ${i === 2 ? 'color: #4f46e5;' : i === 3 ? 'color: #f97316;' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      copyStyledToClipboard(html, rows.map(r => r.join('\t')).join('\n'));
    };

    return (
      <div ref={cardRef} className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm flex flex-col h-[500px] relative group overflow-hidden">
        <div className="flex items-center justify-between mb-8 shrink-0">
          <h3 className={`text-sm font-black text-slate-800 uppercase tracking-tight border-l-4 ${accentColor} pl-4`}>{title}</h3>
          <div className="flex items-center space-x-2">
            {globalViewType === 'tabular' ? (
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <button onClick={handleTsvCopy} className="px-3 py-1 text-[8px] font-black text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all uppercase">TSV</button>
                <button onClick={handleStyledCopy} className="px-3 py-1 text-[8px] font-black text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all uppercase">Styled</button>
              </div>
            ) : (
              <button 
                onClick={() => copyWidgetImage(cardRef, title)} 
                className="bg-slate-900 text-white p-2 rounded-xl shadow-lg hover:bg-black transition-all flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95"
                title="Download & Copy Snapshot"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="3"/><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="3"/></svg>
              </button>
            )}
          </div>
        </div>
        
        {globalViewType === 'tabular' ? (
          <div className="overflow-auto no-scrollbar flex-grow">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="text-[8px] font-black uppercase text-slate-400 sticky top-0 bg-white z-10">
                <tr>
                  <th onClick={() => handleSort('name')} className="px-4 py-2 border-b cursor-pointer hover:text-indigo-600 transition-colors">Operational Unit <SortIndicator active={sortConfig?.key === 'name'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('confirmed')} className="px-4 py-2 border-b text-center cursor-pointer hover:text-indigo-600 transition-colors">Confirmed (N/CO) <SortIndicator active={sortConfig?.key === 'confirmed'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('newCr')} className="px-4 py-2 border-b text-right cursor-pointer hover:text-indigo-600 transition-colors">New Cr <SortIndicator active={sortConfig?.key === 'newCr'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('coCr')} className="px-4 py-2 border-b text-right cursor-pointer hover:text-indigo-600 transition-colors">CO Cr <SortIndicator active={sortConfig?.key === 'coCr'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('totalCr')} className="px-4 py-2 border-b text-right cursor-pointer hover:text-indigo-600 transition-colors">Total Cr <SortIndicator active={sortConfig?.key === 'totalCr'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th className="px-4 py-2 border-b text-right">Average</th>
                  <th className="px-4 py-2 border-b text-center">% Share</th>
                </tr>
              </thead>
              <tbody className="text-[10px] font-black text-slate-700">
                {sortedData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 h-9">
                    <td className="px-4 border-b border-slate-50 uppercase text-slate-400 truncate max-w-[150px]">{item.name}</td>
                    <td className="px-4 border-b border-slate-50 text-center">{item.confirmed} (<span className="text-indigo-600">{item.newCount}</span>/<span className="text-orange-600">{item.coCount}</span>)</td>
                    <td className="px-4 border-b border-slate-50 text-right font-mono text-indigo-600">{fmt(item.newCr)}</td>
                    <td className="px-4 border-b border-slate-50 text-right font-mono text-orange-600">{fmt(item.coCr)}</td>
                    <td className="px-4 border-b border-slate-50 text-right font-mono text-slate-900">{fmt(item.totalCr)}</td>
                    <td className="px-4 border-b border-slate-50 text-right font-mono text-slate-500">{fmt(item.totalCr / months.length)}</td>
                    <td className="px-4 border-b border-slate-50 text-center font-mono text-emerald-500">{fmtPct(item.share)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-900 text-white font-black h-12 uppercase tracking-widest border-t-2 border-indigo-500 sticky bottom-0">
                  <td className="px-4">TOTAL AGGREGATE</td>
                  <td className="px-4 text-center">{data.reduce((s,i)=>s+i.confirmed,0)}</td>
                  <td className="px-4 text-right font-mono text-indigo-400">{fmt(data.reduce((s,i)=>s+i.newCr,0))}</td>
                  <td className="px-4 text-right font-mono text-orange-400">{fmt(data.reduce((s,i)=>s+i.coCr,0))}</td>
                  <td className="px-4 text-right font-mono text-base">{fmt(totalC)}</td>
                  <td className="px-4 text-right font-mono text-slate-400">{fmt(totalC / months.length)}</td>
                  <td className="px-4 text-center font-mono">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-grow w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={renderDonutLabel}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" iconType="circle" height={40}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  const WaterfallDecomposition = ({ data, cardRef, globalViewType }: { data: any, cardRef: React.RefObject<HTMLDivElement | null>, globalViewType: 'tabular' | 'graphical' }) => {
    const waterfallData = [
      { name: 'Base Core', value: data?.totalCoreA?.total || 0, color: '#4f46e5' },
      { name: 'IVI (Strat)', value: data?.strategic?.ivi?.total || 0, color: '#ec4899' },
      { name: 'Auto Expo', value: data?.strategic?.ae?.total || 0, color: '#f59e0b' },
      { name: 'INITIA Add', value: data?.strategic?.initia_add?.total || 0, color: '#ef4444' },
      { name: 'ATG', value: data?.metrics?.['ATG']?.total || 0, color: '#64748b' }
    ];

    const totalCr = waterfallData.reduce((s, i) => s + i.value, 0);

    return (
      <div ref={cardRef} className="bg-[#0f172a] text-white p-10 rounded-[3rem] shadow-2xl flex flex-col xl:flex-row gap-10 items-center overflow-hidden">
        <div className="xl:w-1/3 shrink-0">
          <h3 className="text-xl font-black uppercase tracking-tight mb-2">Waterfall: Strategic Segment Decomposition</h3>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-8">Analyzing Base Core vs. Strategic Initiatives (INR)</p>
          <div className="space-y-6">
            {waterfallData.map(item => (
              <div key={item.name} className="flex justify-between items-center group">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-8 rounded-full" style={{ background: item.color }}></div>
                  <span className="text-sm font-black text-slate-300 uppercase group-hover:text-white transition-colors">{item.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black">{item.value.toFixed(2)} <span className="text-[10px] text-slate-500">CR</span></div>
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">SHARE: {totalCr > 0 ? ((item.value / totalCr) * 100).toFixed(2) : 0}%</div>
                </div>
              </div>
            ))}
            <div className="pt-8 border-t border-slate-800 flex justify-between items-end">
              <span className="text-sm font-black uppercase text-indigo-400 tracking-widest">CONSOLIDATED GRAND TOTAL</span>
              <span className="text-3xl font-black text-white">{totalCr.toFixed(2)} <span className="text-xs text-slate-500">CR</span></span>
            </div>
          </div>
        </div>
        {globalViewType === 'tabular' ? (
          <div className="flex-grow w-full bg-slate-900 rounded-2xl p-6 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-[10px] uppercase tracking-widest">
                  <th className="py-3 px-4">Segment</th>
                  <th className="py-3 px-4 text-right">Value</th>
                  <th className="py-3 px-4 text-right">Average</th>
                  <th className="py-3 px-4 text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {waterfallData.map(item => (
                  <tr key={item.name} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-black flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: item.color }}></div>
                      {item.name}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{item.value.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">{(item.value / months.length).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">{totalCr > 0 ? ((item.value / totalCr) * 100).toFixed(2) : 0}%</td>
                  </tr>
                ))}
                <tr className="bg-slate-800 text-white font-black">
                  <td className="py-3 px-4 text-indigo-400">GRAND TOTAL</td>
                  <td className="py-3 px-4 text-right font-mono">{totalCr.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">{(totalCr / months.length).toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-grow h-[400px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={waterfallData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                 <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                 <YAxis hide />
                 <Tooltip 
                   cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                   contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '1rem', fontWeight: 900 }} 
                   formatter={(v: number) => `₹${v.toFixed(2)}`}
                 />
                 <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                   {waterfallData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                   <LabelList dataKey="value" position="top" style={{ fill: 'white', fontSize: 11, fontWeight: 900 }} formatter={(v: number) => v.toFixed(2)} />
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {([
            { id: 'executive_splits', label: 'Executive Splits (CTO/CMO)' },
            { id: 'investment_breakdown', label: 'Investment Breakdown' },
            { id: 'trends', label: 'Trends & Rollup' },
            { id: 'family_view', label: 'Family View' }
          ] as const).map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveAnalysisTab(tab.id as any)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all tracking-widest ${activeAnalysisTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Mode Selector */}
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {['Budget', 'Actuals', 'Forecast'].map((m) => (
                 <label key={m} className={`flex items-center gap-2 px-3 py-1.5 bg-white border rounded-lg cursor-pointer transition-all shadow-sm ${fiscalMode === m ? 'border-indigo-300 text-indigo-700 ring-1 ring-indigo-100' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                   <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${fiscalMode === m ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-slate-50'}`}>
                      {fiscalMode === m && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                   </div>
                   <input type="checkbox" className="hidden" checked={fiscalMode === m} onChange={() => { if(setFiscalMode) setFiscalMode(m as FiscalMode); }} />
                   <span className={`text-[10px] font-black uppercase tracking-wider`}>{m}</span>
                 </label>
              ))}
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
               <button onClick={() => setGlobalViewType('graphical')} className={`p-2 rounded-lg transition-all ${globalViewType === 'graphical' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Switch to Visualizations">
                 <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeWidth="2.5"/></svg>
               </button>
               <button onClick={() => setGlobalViewType('tabular')} className={`p-2 rounded-lg transition-all ${globalViewType === 'tabular' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Switch to Tabular Data">
                 <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" strokeWidth="2.5"/></svg>
               </button>
            </div>
        </div>
      </div>

      {activeAnalysisTab === 'executive_splits' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Executive KPI Summary Banner */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-white border border-slate-200/80 p-4 rounded-3xl shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">
                <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                <span>Confirmed Budget</span>
              </div>
              <div className="text-xl font-black text-slate-900 font-mono">₹{executiveSplitsData.grandTotalCr.toFixed(2)} <span className="text-xs text-slate-400 font-normal">Cr</span></div>
              <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">{executiveSplitsData.confirmedCount} Active Projects</div>
            </div>

            <div className="bg-white border border-slate-200/80 p-4 rounded-3xl shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">
                <Users className="w-3.5 h-3.5 text-sky-600" />
                <span>Direct Effort</span>
              </div>
              <div className="text-xl font-black text-slate-900 font-mono">{executiveSplitsData.grandTotalMM.toFixed(1)} <span className="text-xs text-slate-400 font-normal">MM</span></div>
              <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">Across Core & Projects</div>
            </div>

            <div className="bg-white border border-slate-200/80 p-4 rounded-3xl shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">
                <Building className="w-3.5 h-3.5 text-emerald-600" />
                <span>Top Customer</span>
              </div>
              <div className="text-sm font-black text-slate-900 truncate uppercase" title={executiveSplitsData.customers[0]?.name || 'N/A'}>
                {executiveSplitsData.customers[0]?.name || 'N/A'}
              </div>
              <div className="text-[10px] font-bold text-emerald-600 font-mono mt-1">
                ₹{executiveSplitsData.customers[0]?.totalCr.toFixed(2) || '0.00'} Cr ({executiveSplitsData.customers[0]?.share.toFixed(1) || '0'}%)
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 p-4 rounded-3xl shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">
                <Layers className="w-3.5 h-3.5 text-pink-600" />
                <span>Top Product Family</span>
              </div>
              <div className="text-sm font-black text-slate-900 truncate uppercase" title={executiveSplitsData.families[0]?.name || 'N/A'}>
                {executiveSplitsData.families[0]?.name || 'N/A'}
              </div>
              <div className="text-[10px] font-bold text-pink-600 font-mono mt-1">
                ₹{executiveSplitsData.families[0]?.totalCr.toFixed(2) || '0.00'} Cr ({executiveSplitsData.families[0]?.share.toFixed(1) || '0'}%)
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 p-4 rounded-3xl shadow-sm col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">
                <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                <span>Top Vertical</span>
              </div>
              <div className="text-sm font-black text-slate-900 truncate uppercase" title={executiveSplitsData.verticals[0]?.name || 'N/A'}>
                {executiveSplitsData.verticals[0]?.name || 'N/A'}
              </div>
              <div className="text-[10px] font-bold text-amber-600 font-mono mt-1">
                ₹{executiveSplitsData.verticals[0]?.totalCr.toFixed(2) || '0.00'} Cr ({executiveSplitsData.verticals[0]?.share.toFixed(1) || '0'}%)
              </div>
            </div>
          </div>

          {/* 5 Dimensional Horizontal Split Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HorizontalSplitCard 
              title="Customer Wise Split" 
              subtitle="Confirmed investment distribution across client accounts"
              icon={<Building className="w-5 h-5" />}
              data={executiveSplitsData.customers} 
              totalCr={executiveSplitsData.grandTotalCr} 
              cardRef={customerSplitRef} 
              globalViewType={globalViewType} 
            />

            <HorizontalSplitCard 
              title="Product Family Wise Split" 
              subtitle="Portfolio breakdown by product architecture family"
              icon={<Layers className="w-5 h-5 text-pink-600" />}
              data={executiveSplitsData.families} 
              totalCr={executiveSplitsData.grandTotalCr} 
              cardRef={familySplitRef} 
              globalViewType={globalViewType} 
            />

            <HorizontalSplitCard 
              title="Vertical Wise Split" 
              subtitle="Resource & budget allocation across engineering verticals"
              icon={<Briefcase className="w-5 h-5 text-emerald-600" />}
              data={executiveSplitsData.verticals} 
              totalCr={executiveSplitsData.grandTotalCr} 
              cardRef={verticalSplitRef} 
              globalViewType={globalViewType} 
            />

            <HorizontalSplitCard 
              title="Business Unit (BU) Wise Split" 
              subtitle="Strategic capital spread across internal business units"
              icon={<Building2 className="w-5 h-5 text-amber-600" />}
              data={executiveSplitsData.bus} 
              totalCr={executiveSplitsData.grandTotalCr} 
              cardRef={buSplitRef} 
              globalViewType={globalViewType} 
            />

            <div className="lg:col-span-2">
              <HorizontalSplitCard 
                title="Domain Wise Split" 
                subtitle="Domain & technology practice investment distribution"
                icon={<LayoutGrid className="w-5 h-5 text-cyan-600" />}
                data={executiveSplitsData.domains} 
                totalCr={executiveSplitsData.grandTotalCr} 
                cardRef={domainSplitRef} 
                globalViewType={globalViewType} 
              />
            </div>
          </div>
        </div>
      )}

      {activeAnalysisTab === 'investment_breakdown' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AllocationTable title="Gross Budget Distribution" data={breakdownData} totalC={breakdownData.totalCoreA?.total || 1} isAdjusted={false} cardRef={grossCardRef} globalViewType={globalViewType} />
            <AllocationTable title="Redistributed Core Budget" data={breakdownData} totalC={breakdownData.totalCoreA?.total || 1} isAdjusted={true} cardRef={adjCardRef} globalViewType={globalViewType} />
          </div>
          <WaterfallDecomposition data={breakdownData} cardRef={waterfallCardRef} globalViewType={globalViewType} />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <LoadTable title="PDH Resource Load" data={loadAnalysisData.pdhList} totalC={loadAnalysisData.grandTotalCr} cardRef={pdhCardRef} accentColor="border-indigo-500" globalViewType={globalViewType} />
            <LoadTable title="BU Investment Structure" data={loadAnalysisData.buList} totalC={loadAnalysisData.grandTotalCr} cardRef={buCardRef} accentColor="border-emerald-500" globalViewType={globalViewType} />
            <LoadTable title="Family Contribution" data={loadAnalysisData.familyList} totalC={loadAnalysisData.grandTotalCr} cardRef={familyCardRef} accentColor="border-amber-500" globalViewType={globalViewType} />
          </div>
        </div>
      )}

      {activeAnalysisTab === 'trends' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Consolidated Summary Table */}
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Consolidated Budget & Actuals Summary</h3>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confirmed Projects Only</span>
              </div>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse font-sans min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-[0.2em]">
                    <th className="px-4 py-4 border-r border-white/10 text-xs sticky left-0 bg-slate-900 z-10">Category</th>
                    <th className="px-4 py-4 border-r border-white/10 text-right">MM</th>
                    <th className="px-4 py-4 border-r border-white/10 text-right">MM Expenses</th>
                    <th className="px-4 py-4 border-r border-white/10 text-right">% MM</th>
                    <th className="px-4 py-4 border-r border-white/10 text-right">Expenses</th>
                    <th className="px-4 py-4 border-r border-white/10 text-right">% Exp</th>
                    <th className="px-4 py-4 border-r border-white/10 text-right">Total</th>
                    <th className="px-4 py-4 border-r border-white/10 text-right">Average</th>
                    <th className="px-4 py-4 border-r border-white/10 text-right">% Tot</th>
                    <th className="px-4 py-4 border-r border-white/10 text-center">New</th>
                    <th className="px-4 py-4 text-center">CarryOver</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] text-slate-700">
                  {aggregatedData.map((row) => {
                    const mmExpPercentage = grandTotal.manpowerCr > 0 ? (row.manpowerCr / grandTotal.manpowerCr) * 100 : 0;
                    const expPercentage = grandTotal.expenseCr > 0 ? (row.expenseCr / grandTotal.expenseCr) * 100 : 0;
                    const totalPercentage = grandTotal.totalCr > 0 ? (row.totalCr / grandTotal.totalCr) * 100 : 0;
                    const newPercentage = row.manpowerMM > 0 ? (row.newMM / row.manpowerMM) * 100 : 0;
                    const carryOverPercentage = row.manpowerMM > 0 ? (row.carryOverMM / row.manpowerMM) * 100 : 0;

                    const isSub = row.isSubCategory;
                    const isHeader = ['Projects', 'Product Maintenance', 'Project Support', 'Organization Support'].includes(row.name) && !isSub;

                    return (
                      <tr key={row.key} className={`
                        transition-all border-b border-slate-100 
                        ${isHeader ? 'bg-slate-50 text-slate-900 font-black cursor-pointer hover:bg-slate-100' : 'hover:bg-slate-50'}
                      `} onClick={isHeader ? () => setExpandedCategories(prev => ({ ...prev, [row.name]: !prev[row.name] })) : undefined}>
                        <td className={`px-4 py-2 border-r border-slate-100 sticky left-0 z-10 ${isHeader ? 'bg-slate-50' : 'bg-white group-hover:bg-slate-50'} flex items-center gap-2 ${isSub ? 'pl-10 italic opacity-80' : 'font-bold uppercase tracking-tight'}`}>
                          {isHeader && (
                            expandedCategories[row.name] ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />
                          )}
                          {row.name}
                        </td>
                        <td className="px-4 py-2 border-r border-slate-100 text-right font-mono">{(row.manpowerMM || 0).toFixed(2)}</td>
                        <td className="px-4 py-2 border-r border-slate-100 text-right font-mono">₹{(row.manpowerCr || 0).toFixed(2)}</td>
                        <td className="px-4 py-2 border-r border-slate-100 text-right font-mono opacity-50 text-[9px]">{(mmExpPercentage || 0).toFixed(2)}%</td>
                        <td className="px-4 py-2 border-r border-slate-100 text-right font-mono">₹{(row.expenseCr || 0).toFixed(2)}</td>
                        <td className="px-4 py-2 border-r border-slate-100 text-right font-mono opacity-50 text-[9px]">{(expPercentage || 0).toFixed(2)}%</td>
                        <td className="px-4 py-2 border-r border-slate-100 text-right font-black text-slate-900">₹{(row.totalCr || 0).toFixed(2)}</td>
                        <td className="px-4 py-2 border-r border-slate-100 text-right font-mono text-slate-500">₹{((row.totalCr || 0) / months.length).toFixed(2)}</td>
                        <td className="px-4 py-2 border-r border-slate-100 text-right font-mono opacity-50 text-[9px]">{(totalPercentage || 0).toFixed(2)}%</td>
                        <td className="px-4 py-2 border-r border-slate-100 text-center font-mono">
                          {newPercentage > 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                              <span className="text-blue-600 font-bold">{newPercentage.toFixed(1)}%</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">0%</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center font-mono">
                          {carryOverPercentage > 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              <span className="text-emerald-600 font-bold">{carryOverPercentage.toFixed(1)}%</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">0%</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-900 text-white font-black uppercase tracking-widest text-[10px]">
                    <td className="px-4 py-4 sticky left-0 bg-slate-900 z-10">GRAND TOTAL</td>
                    <td className="px-4 py-4 text-right font-mono">{grandTotal.manpowerMM.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right font-mono">₹{grandTotal.manpowerCr.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right font-mono">{grandTotal.manpowerMM > 0 ? '100%' : '0%'}</td>
                    <td className="px-4 py-4 text-right font-mono">₹{grandTotal.expenseCr.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right font-mono">{grandTotal.expenseCr > 0 ? '100%' : '0%'}</td>
                    <td className="px-4 py-4 text-right font-mono">₹{grandTotal.totalCr.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right font-mono">₹{(grandTotal.totalCr / months.length).toFixed(2)}</td>
                    <td className="px-4 py-4 text-right font-mono">{grandTotal.totalCr > 0 ? '100%' : '0%'}</td>
                    <td className="px-4 py-4 text-center font-mono">{grandTotal.manpowerMM > 0 ? `${((grandTotal.newMM / grandTotal.manpowerMM) * 100).toFixed(1)}%` : '0%'}</td>
                    <td className="px-4 py-4 text-center font-mono">{grandTotal.manpowerMM > 0 ? `${((grandTotal.carryOverMM / grandTotal.manpowerMM) * 100).toFixed(1)}%` : '0%'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Consolidated Budget (Monthly) Table */}
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 p-8 overflow-hidden" ref={trendDeploymentRef}>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Consolidated Budget (Monthly)</h3>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Financial & Effort Breakdown</span>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead>
                  <tr className="bg-slate-900 text-white text-[9px] uppercase tracking-[0.2em]">
                    <th className="px-4 py-4 font-black sticky left-0 bg-slate-900 z-10 w-[250px]">Description</th>
                    {months.map(m => (
                      <th key={m} className="px-4 py-4 text-right font-black">{m}</th>
                    ))}
                    <th className="px-4 py-4 text-right font-black bg-slate-800">Total</th>
                    <th className="px-4 py-4 text-right font-black bg-slate-700">Average</th>
                  </tr>
                </thead>
                <tbody className="text-[11px]">
                  {/* DIRECT MANPOWER (MM) SECTION */}
                  <tr className="bg-slate-50 font-black text-slate-900 uppercase tracking-widest text-[9px]">
                    <td colSpan={months.length + 3} className="px-4 py-2 border-y border-slate-200">Direct Manpower (MM)</td>
                  </tr>
                  {consolidatedBudget.sortedManpowerKeys.filter(k => k !== 'Contracted Employee').map(key => (
                    <tr key={key} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2 sticky left-0 bg-white group-hover:bg-slate-50 font-medium text-slate-700">{key}</td>
                      {consolidatedBudget.manpowerData[key].map((v, i) => (
                        <td key={i} className="px-4 py-2 text-right font-mono text-slate-500">{(v || 0).toFixed(2)}</td>
                      ))}
                      <td className="px-4 py-2 text-right font-mono font-bold bg-slate-50/50">{consolidatedBudget.manpowerData[key].reduce((a, b) => a + b, 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-400 bg-slate-50/30">{(consolidatedBudget.manpowerData[key].reduce((a, b) => a + b, 0) / months.length).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100/50 font-bold text-slate-900 border-b border-slate-200">
                    <td className="px-4 py-2 sticky left-0 bg-slate-100/50">Sub-Total Direct Manpower (MM)</td>
                    {consolidatedBudget.totalDirectManpowerMM.map((v, i) => (
                      <td key={i} className="px-4 py-2 text-right font-mono">{(v || 0).toFixed(2)}</td>
                    ))}
                    <td className="px-4 py-2 text-right font-mono font-black bg-slate-200/50">{consolidatedBudget.totalDirectManpowerMM.reduce((a, b) => a + b, 0).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-500 bg-slate-200/30">{(consolidatedBudget.totalDirectManpowerMM.reduce((a, b) => a + b, 0) / months.length).toFixed(2)}</td>
                  </tr>

                  {/* CONTRACTED MANPOWER (MM) SECTION */}
                  <tr className="bg-slate-50 font-black text-slate-900 uppercase tracking-widest text-[9px]">
                    <td colSpan={months.length + 3} className="px-4 py-2 border-y border-slate-200">Contracted Manpower (MM)</td>
                  </tr>
                  {consolidatedBudget.manpowerData['Contracted Employee'] && (
                    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2 sticky left-0 bg-white group-hover:bg-slate-50 font-medium text-slate-700">Contracted Employee</td>
                      {consolidatedBudget.manpowerData['Contracted Employee'].map((v, i) => (
                        <td key={i} className="px-4 py-2 text-right font-mono text-slate-500">{(v || 0).toFixed(2)}</td>
                      ))}
                      <td className="px-4 py-2 text-right font-mono font-bold bg-slate-50/50">{consolidatedBudget.manpowerData['Contracted Employee'].reduce((a, b) => a + b, 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-400 bg-slate-50/30">{(consolidatedBudget.manpowerData['Contracted Employee'].reduce((a, b) => a + b, 0) / months.length).toFixed(2)}</td>
                    </tr>
                  )}
                  <tr className="bg-slate-100/50 font-bold text-slate-900 border-b border-slate-200">
                    <td className="px-4 py-2 sticky left-0 bg-slate-100/50">Total Effort (MM)</td>
                    {consolidatedBudget.totalManpowerMM.map((v, i) => (
                      <td key={i} className="px-4 py-2 text-right font-mono">{(v || 0).toFixed(2)}</td>
                    ))}
                    <td className="px-4 py-2 text-right font-mono font-black bg-slate-200/50">{consolidatedBudget.totalManpowerMM.reduce((a, b) => a + b, 0).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-500 bg-slate-200/30">{(consolidatedBudget.totalManpowerMM.reduce((a, b) => a + b, 0) / months.length).toFixed(2)}</td>
                  </tr>

                  {/* PEOPLE COST (CR) SECTION */}
                  <tr className="bg-slate-50 font-black text-slate-900 uppercase tracking-widest text-[9px]">
                    <td colSpan={months.length + 3} className="px-4 py-2 border-y border-slate-200">People Cost</td>
                  </tr>
                  <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2 sticky left-0 bg-white group-hover:bg-slate-50 font-medium text-slate-700">Total People Cost</td>
                    {consolidatedBudget.totalManpowerCr.map((v, i) => (
                      <td key={i} className="px-4 py-2 text-right font-mono text-slate-500">₹{(v || 0).toFixed(2)}</td>
                    ))}
                    <td className="px-4 py-2 text-right font-mono font-bold bg-slate-50/50">₹{consolidatedBudget.totalManpowerCr.reduce((a, b) => a + b, 0).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-400 bg-slate-50/30">₹{(consolidatedBudget.totalManpowerCr.reduce((a, b) => a + b, 0) / months.length).toFixed(2)}</td>
                  </tr>

                  {/* OPERATIONAL EXPENSES (CR) SECTION */}
                  <tr className="bg-slate-50 font-black text-slate-900 uppercase tracking-widest text-[9px]">
                    <td colSpan={months.length + 3} className="px-4 py-2 border-y border-slate-200">Operational Expenses</td>
                  </tr>
                  {consolidatedBudget.sortedExpenseKeys.filter(k => k !== 'Contracted Employee' && k !== 'Contracted Employee Expense').map(key => (
                    <tr key={key} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2 sticky left-0 bg-white group-hover:bg-slate-50 font-medium text-slate-700">{key}</td>
                      {consolidatedBudget.expenseData[key].map((v, i) => (
                        <td key={i} className="px-4 py-2 text-right font-mono text-slate-500">₹{(v || 0).toFixed(2)}</td>
                      ))}
                      <td className="px-4 py-2 text-right font-mono font-bold bg-slate-50/50">₹{consolidatedBudget.expenseData[key].reduce((a, b) => a + b, 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-400 bg-slate-50/30">₹{(consolidatedBudget.expenseData[key].reduce((a, b) => a + b, 0) / months.length).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100/50 font-bold text-slate-900 border-b border-slate-200">
                    <td className="px-4 py-2 sticky left-0 bg-slate-100/50">Total Expense</td>
                    {consolidatedBudget.totalExpenseCr.map((v, i) => (
                      <td key={i} className="px-4 py-2 text-right font-mono">₹{(v || 0).toFixed(2)}</td>
                    ))}
                    <td className="px-4 py-2 text-right font-mono font-black bg-slate-200/50">₹{consolidatedBudget.totalExpenseCr.reduce((a, b) => a + b, 0).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-500 bg-slate-200/30">₹{(consolidatedBudget.totalExpenseCr.reduce((a, b) => a + b, 0) / months.length).toFixed(2)}</td>
                  </tr>

                  {/* GRAND TOTAL SECTION */}
                  <tr className="bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px]">
                    <td className="px-4 py-4 sticky left-0 bg-indigo-600">Total Budget</td>
                    {consolidatedBudget.totalBudgetCr.map((v, i) => (
                      <td key={i} className="px-4 py-4 text-right font-mono">₹{(v || 0).toFixed(2)}</td>
                    ))}
                    <td className="px-4 py-4 text-right font-mono font-black bg-indigo-700">₹{consolidatedBudget.totalBudgetCr.reduce((a, b) => a + b, 0).toFixed(2)}</td>
                    <td className="px-4 py-4 text-right font-mono font-black bg-indigo-800">₹{(consolidatedBudget.totalBudgetCr.reduce((a, b) => a + b, 0) / months.length).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {activeAnalysisTab === 'family_view' && (
        <FamilyView projects={filteredProjects} />
      )}

      {snapshotToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-950 text-white text-xs font-black uppercase px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-fadeIn">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="tracking-wider">{snapshotToast}</span>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
