import React, { useMemo, useState, useRef } from 'react';
import { Project, FiscalMode } from '../types';
import { normalizeVertical } from '../constants';
import { toPng } from 'html-to-image';
import { Download, Search, Check, Layers, SlidersHorizontal, Award } from 'lucide-react';

interface ProductPortfolioTreeProps {
  projects: Project[];
  config?: any;
  totalsLookup?: Record<string, any>;
  calculateProjectCost?: (p: any, mode: FiscalMode) => {
    mm: number;
    directMM: number;
    contractedMM: number;
    manpowerCr: number;
    expenseCr: number;
    totalCr: number;
  };
  onSelectFamilyForScorecard?: (familyName: string) => void;
}

interface TreeProjectItem {
  id: string;
  code: string;
  name: string;
  vertical: string;
  productFamily: string;
  category: string;
  projectType: string;
  generation: string;
  inBudget: boolean;
  inActuals: boolean;
  budgetCr: number;
  actualsCr: number;
  statusClass: 'carry_over' | 'new';
  sourceClass: 'budget_only' | 'actual_only' | 'both';
}

interface PortfolioGroup {
  name: string;
  families: {
    name: string;
    projects: TreeProjectItem[];
    budgetCr: number;
    actualsCr: number;
  }[];
  budgetCr: number;
  actualsCr: number;
}

// Canonical mapping of CREAT Product Families into Playing Field Product Portfolios
const mapFamilyToPortfolio = (
  family: string,
  vertical: string
): { group: string; portfolio: string } => {
  const f = (family || '').trim().toLowerCase();
  const v = (vertical || '').trim().toUpperCase();

  // 1. Cockpit Electronics
  if (
    f.includes('wireless') ||
    f.includes('awc') ||
    f.includes('sbdt') ||
    f.includes('display') ||
    f.includes('ivi') ||
    f.includes('infotainment') ||
    f.includes('usb') ||
    f.includes('cluster') ||
    f.includes('cockpit')
  ) {
    return { group: 'Controller & Electronics', portfolio: 'Cockpit Electronics' };
  }

  // 2. Body Electronics
  if (
    f.includes('body control') ||
    f.includes('bcm') ||
    f.includes('zonal') ||
    f.includes('digital key') ||
    f.includes('hvac') ||
    f.includes('climate') ||
    f.includes('seating ecu') ||
    f.includes('vehicle controller') ||
    f.includes('gateway') ||
    f.includes('over head console') ||
    f.includes('overhead console')
  ) {
    return { group: 'Controller & Electronics', portfolio: 'Body Electronics' };
  }

  // 3. Telematics
  if (f.includes('telematics') || f.includes('tcu') || f.includes('v2x') || f.includes('connected')) {
    return { group: 'Controller & Electronics', portfolio: 'Telematics' };
  }

  // 4. EV - Charging & Power Electronics
  if (
    f.includes('ev ') ||
    f.includes('charger') ||
    f.includes('dc-dc') ||
    f.includes('dcdc') ||
    f.includes('ac-dc') ||
    f.includes('obc') ||
    f.includes('bms') ||
    f.includes('x in 1') ||
    f.includes('inverter') ||
    f.includes('mcu') ||
    f.includes('vcu') ||
    v === 'DCB'
  ) {
    return { group: 'Controller & Electronics', portfolio: 'EV– Charging Systems' };
  }

  // 5. ADAS & Sensors
  if (
    f.includes('camera') ||
    f.includes('aras') ||
    f.includes('adas') ||
    f.includes('ultrasonic') ||
    f.includes('imu') ||
    f.includes('sensor') ||
    f.includes('tpms') ||
    f.includes('radar') ||
    v === 'ECS-1' ||
    v === 'ECS-2'
  ) {
    return { group: 'ADAS, Sensors & Lighting', portfolio: 'ADAS & Sensors' };
  }

  // 6. Lighting Systems
  if (
    f.includes('lamp') ||
    f.includes('lighting') ||
    f.includes('light') ||
    f.includes('ahl') ||
    v === 'LAS'
  ) {
    return { group: 'ADAS, Sensors & Lighting', portfolio: 'Lighting Systems' };
  }

  // 7. Switches, Acoustics & Seating Mechanisms
  if (
    f.includes('switch') ||
    f.includes('hand control') ||
    f.includes('avas') ||
    f.includes('acoustic') ||
    f.includes('seat') ||
    v === 'SCS'
  ) {
    return { group: 'Switches, Acoustic & Seating', portfolio: 'Switches & Acoustics' };
  }

  if (v === 'INITIA') {
    return { group: 'INITIA & Styling', portfolio: 'INITIA Design & Innovation' };
  }

  if (v === 'AEG') {
    return { group: 'Controller & Electronics', portfolio: 'Body Electronics' };
  }

  return { group: 'Other CREAT Domains', portfolio: vertical || 'General Portfolio' };
};

const hasNonZeroMatrix = (obj: Record<string, any> | undefined): boolean => {
  if (!obj || typeof obj !== 'object') return false;
  return Object.values(obj).some(arr => {
    if (Array.isArray(arr)) return arr.some(v => (Number(v) || 0) > 0.0001);
    if (arr && typeof arr === 'object') {
      return Object.values(arr).some(v => (Number(v) || 0) > 0.0001);
    }
    return false;
  });
};

const hasNonZeroEmpSkills = (
  empSkills: Record<string, Record<string, number[]>> | undefined
): boolean => {
  if (!empSkills || typeof empSkills !== 'object') return false;
  return Object.values(empSkills).some(skillMap =>
    Object.values(skillMap || {}).some(
      arr => Array.isArray(arr) && arr.some(v => (Number(v) || 0) > 0.0001)
    )
  );
};

export const ProductPortfolioTree: React.FC<ProductPortfolioTreeProps> = ({
  projects,
  config,
  totalsLookup,
  calculateProjectCost,
  onSelectFamilyForScorecard
}) => {
  const treeRef = useRef<HTMLDivElement>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [hierarchyMode, setHierarchyMode] = useState<'playing_field' | 'department'>('department');
  const [colorMode, setColorMode] = useState<'lifecycle' | 'budget_actuals'>('lifecycle');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'both' | 'budget' | 'actuals'>('all');
  const [showFinancials, setShowFinancials] = useState<boolean>(true);
  const [includeSupport, setIncludeSupport] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const canonicalFamilies: string[] = useMemo(
    () => (Array.isArray(config?.productFamilies) ? config.productFamilies : []),
    [config]
  );

  // Extract normalized project items from Budget + Actuals
  const enrichedProjects = useMemo<TreeProjectItem[]>(() => {
    return (projects || []).map(p => {
      const code = (p.code || '').trim().toUpperCase();
      const normVert = normalizeVertical(p.vertical || 'Unspecified');
      const rawFam = (p.productFamily || 'Unassigned').trim();
      const matchedFam = canonicalFamilies.find(
        f => f.trim().toLowerCase() === rawFam.toLowerCase()
      );
      const productFamily = matchedFam ? matchedFam.trim() : rawFam;

      // Determine Budget Cr
      let budgetCr = 0;
      if ((p as any).trueBudgetCr !== undefined && (p as any).trueBudgetCr > 0) {
        budgetCr = Number((p as any).trueBudgetCr) || 0;
      } else if ((p as any).portfolioBudgetCr !== undefined && (p as any).portfolioBudgetCr > 0) {
        budgetCr = Number((p as any).portfolioBudgetCr) || 0;
      } else if (calculateProjectCost) {
        budgetCr = calculateProjectCost(p, 'Budget').totalCr || 0;
      } else if (totalsLookup && code && totalsLookup[code]?.budget?.totalCr) {
        budgetCr = Number(totalsLookup[code].budget.totalCr) || 0;
      }

      // Determine Actuals Cr
      let actualsCr = 0;
      if ((p as any).trueActualSpentCr !== undefined && (p as any).trueActualSpentCr > 0) {
        actualsCr = Number((p as any).trueActualSpentCr) || 0;
      } else if ((p as any).actualSpentCr !== undefined && (p as any).actualSpentCr > 0) {
        actualsCr = Number((p as any).actualSpentCr) || 0;
      } else if (calculateProjectCost) {
        actualsCr = calculateProjectCost(p, 'Actuals').totalCr || 0;
      } else if (totalsLookup && code && totalsLookup[code]?.actuals?.totalCr) {
        actualsCr = Number(totalsLookup[code].actuals.totalCr) || 0;
      }

      const inBudget =
        budgetCr > 0.0001 ||
        Number((p as any).trueBudgetMM) > 0.0001 ||
        hasNonZeroMatrix(p.pmoRows) ||
        hasNonZeroMatrix(p.rows) ||
        hasNonZeroMatrix(p.pmoSkills) ||
        hasNonZeroEmpSkills(p.pmoEmployeeSkills) ||
        hasNonZeroEmpSkills(p.employeeSkills);

      const inActuals =
        actualsCr > 0.0001 ||
        Number((p as any).trueActualMM) > 0.0001 ||
        hasNonZeroMatrix(p.actuals) ||
        hasNonZeroMatrix(p.actualsSkills) ||
        hasNonZeroEmpSkills(p.actualsEmployeeSkills);

      const catLower = (p.category || '').toLowerCase();
      const statusClass: 'carry_over' | 'new' = catLower.includes('carry') ? 'carry_over' : 'new';

      let sourceClass: 'budget_only' | 'actual_only' | 'both' = 'both';
      if (inBudget && inActuals) {
        sourceClass = 'both';
      } else if (inBudget && !inActuals) {
        sourceClass = 'budget_only';
      } else if (!inBudget && inActuals) {
        sourceClass = 'actual_only';
      } else {
        sourceClass = 'budget_only';
      }

      return {
        id: p.id || code || p.name,
        code,
        name: (p.name || code || 'Unnamed Project').trim(),
        vertical: normVert,
        productFamily,
        category: statusClass === 'carry_over' ? 'Carry Over' : 'New',
        projectType: p.projectType || 'NA',
        generation: p.generation || 'Current',
        inBudget,
        inActuals,
        budgetCr,
        actualsCr,
        statusClass,
        sourceClass
      };
    });
  }, [projects, canonicalFamilies, calculateProjectCost, totalsLookup]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    enrichedProjects.forEach(p => {
      if (!includeSupport && (p.vertical.toLowerCase() === 'support' || p.productFamily.toLowerCase() === 'support')) {
        return;
      }
      if (p.vertical) set.add(p.vertical);
    });
    return ['All', ...Array.from(set).sort()];
  }, [enrichedProjects, includeSupport]);

  // Filter and build Portfolio -> Product Family -> Projects tree
  const portfolioTree = useMemo<{
    rootTitle: string;
    portfolios: PortfolioGroup[];
    totalProjects: number;
    totalFamilies: number;
    totalBudgetCr: number;
    totalActualsCr: number;
  }>(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = enrichedProjects.filter(p => {
      // Exclude support / administrative rows unless toggled on
      const isSupportRow =
        p.vertical.toLowerCase() === 'support' ||
        p.productFamily.toLowerCase() === 'support' ||
        p.productFamily.toLowerCase() === 'na' ||
        p.name.toLowerCase().includes('holiday') ||
        p.name.toLowerCase().includes('leave');
      if (!includeSupport && isSupportRow) return false;

      // Must be in Budget or Actuals (or master list if All)
      if (sourceFilter === 'both' && !(p.inBudget && p.inActuals)) return false;
      if (sourceFilter === 'budget' && !p.inBudget) return false;
      if (sourceFilter === 'actuals' && !p.inActuals) return false;
      if (sourceFilter === 'all' && !p.inBudget && !p.inActuals && p.budgetCr === 0 && p.actualsCr === 0) {
        // Still allow if it has a valid family
      }

      if (selectedDepartment !== 'All' && p.vertical !== selectedDepartment) return false;

      if (q) {
        const match =
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.productFamily.toLowerCase().includes(q) ||
          p.vertical.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });

    const portfolioMap = new Map<
      string,
      Map<string, { projects: TreeProjectItem[]; budgetCr: number; actualsCr: number }>
    >();

    filtered.forEach(p => {
      const portfolioName =
        hierarchyMode === 'department'
          ? p.vertical
          : mapFamilyToPortfolio(p.productFamily, p.vertical).portfolio;

      const famName = p.productFamily || 'Unassigned';

      if (!portfolioMap.has(portfolioName)) {
        portfolioMap.set(portfolioName, new Map());
      }
      const famMap = portfolioMap.get(portfolioName)!;
      if (!famMap.has(famName)) {
        famMap.set(famName, { projects: [], budgetCr: 0, actualsCr: 0 });
      }
      const famEntry = famMap.get(famName)!;
      famEntry.projects.push(p);
      famEntry.budgetCr += p.budgetCr;
      famEntry.actualsCr += p.actualsCr;
    });

    const PORTFOLIO_ORDER = [
      'Cockpit Electronics',
      'Body Electronics',
      'Telematics',
      'EV– Charging Systems',
      'ADAS & Sensors',
      'Lighting Systems',
      'Switches & Acoustics',
      'INITIA Design & Innovation'
    ];

    const portfolios: PortfolioGroup[] = Array.from(portfolioMap.entries())
      .map(([portfolioName, famMap]) => {
        const families = Array.from(famMap.entries())
          .map(([famName, data]) => ({
            name: famName,
            projects: data.projects.sort((a, b) => {
              if (colorMode === 'lifecycle') {
                const order = { carry_over: 0, new: 1 };
                if (order[a.statusClass] !== order[b.statusClass]) {
                  return order[a.statusClass] - order[b.statusClass];
                }
              } else {
                const order = { both: 0, budget_only: 1, actual_only: 2 };
                if (order[a.sourceClass] !== order[b.sourceClass]) {
                  return order[a.sourceClass] - order[b.sourceClass];
                }
              }
              return Math.max(b.budgetCr, b.actualsCr) - Math.max(a.budgetCr, a.actualsCr);
            }),
            budgetCr: data.budgetCr,
            actualsCr: data.actualsCr
          }))
          .sort((a, b) => b.projects.length - a.projects.length);

        const budgetCr = families.reduce((s, f) => s + f.budgetCr, 0);
        const actualsCr = families.reduce((s, f) => s + f.actualsCr, 0);

        return {
          name: portfolioName,
          families,
          budgetCr,
          actualsCr
        };
      })
      .sort((a, b) => {
        const idxA = PORTFOLIO_ORDER.indexOf(a.name);
        const idxB = PORTFOLIO_ORDER.indexOf(b.name);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return b.families.length - a.families.length;
      });

    const totalFamilies = portfolios.reduce((s, p) => s + p.families.length, 0);
    const totalBudgetCr = portfolios.reduce((s, p) => s + p.budgetCr, 0);
    const totalActualsCr = portfolios.reduce((s, p) => s + p.actualsCr, 0);

    let rootTitle = 'CREAT Product Group';
    if (selectedDepartment !== 'All') {
      rootTitle =
        selectedDepartment === 'AEG'
          ? 'Controller (AEG)'
          : selectedDepartment === 'DCB'
          ? 'Power Electronics (DCB)'
          : `${selectedDepartment} Product Group`;
    } else if (portfolios.length > 0 && portfolios.every(pt => ['Cockpit Electronics', 'Body Electronics', 'Telematics', 'EV– Charging Systems'].includes(pt.name))) {
      rootTitle = 'Controller';
    }

    return {
      rootTitle,
      portfolios,
      totalProjects: filtered.length,
      totalFamilies,
      totalBudgetCr,
      totalActualsCr
    };
  }, [
    enrichedProjects,
    includeSupport,
    sourceFilter,
    selectedDepartment,
    searchQuery,
    hierarchyMode,
    colorMode
  ]);

  const getProjectCardBg = (proj: TreeProjectItem): string => {
    if (colorMode === 'budget_actuals') {
      if (proj.sourceClass === 'both') {
        return 'bg-[#0d9488] border-[#0f766e] text-white'; // Budget + Actual (Teal/Emerald)
      }
      if (proj.sourceClass === 'budget_only') {
        return 'bg-[#d97706] border-[#b45309] text-white'; // Budget Only (Amber)
      }
      return 'bg-[#7f7f7f] border-[#666666] text-white'; // Actual Only (Grey)
    } else {
      if (proj.statusClass === 'carry_over') {
        return 'bg-[#4472c4] border-[#2f5597] text-white'; // Carry Over (Medium Blue)
      }
      return 'bg-[#002060] border-[#001540] text-white'; // New (Dark Navy)
    }
  };

  const getSecondaryBadge = (proj: TreeProjectItem): { label: string; className: string } => {
    if (colorMode === 'lifecycle') {
      // Primary card is Category (Carry Over / New), so secondary pill shows Source
      if (proj.sourceClass === 'both') {
        return { label: 'Budget + Actual', className: 'bg-[#0d9488] border-white/40 text-white' };
      }
      if (proj.sourceClass === 'budget_only') {
        return { label: 'Budget Only', className: 'bg-[#d97706] border-white/40 text-white' };
      }
      return { label: 'Actual Only', className: 'bg-[#7f7f7f] border-white/40 text-white' };
    } else {
      // Primary card is Source, so secondary pill shows Category (Carry Over / New)
      if (proj.statusClass === 'carry_over') {
        return { label: 'Carry Over', className: 'bg-[#4472c4] border-white/40 text-white' };
      }
      return { label: 'New', className: 'bg-[#002060] border-white/40 text-white' };
    }
  };

  const handleExportSlide = async () => {
    if (!treeRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(treeRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `CREAT_Product_Portfolio_Tree_${selectedDepartment}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export portfolio tree:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Compact Tree View Control Bar (No duplicate search/department filters) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* Data Source Filter */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
            {([
              { id: 'all', label: 'All' },
              { id: 'both', label: 'Budget + Actuals' },
              { id: 'budget', label: 'Budget Only' },
              { id: 'actuals', label: 'Actuals Only' }
            ] as const).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSourceFilter(opt.id)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition-colors ${
                  sourceFilter === opt.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Grouping Mode */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setHierarchyMode('playing_field')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition-colors ${
                hierarchyMode === 'playing_field'
                  ? 'bg-[#0082ca] text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Portfolio Grouping
            </button>
            <button
              type="button"
              onClick={() => setHierarchyMode('department')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition-colors ${
                hierarchyMode === 'department'
                  ? 'bg-[#0082ca] text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dept Grouping
            </button>
          </div>

          {/* Color Mode */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
            <SlidersHorizontal size={12} className="text-slate-400" />
            <span className="text-[10px] font-black uppercase text-slate-400">Color By:</span>
            <select
              value={colorMode}
              onChange={e => setColorMode(e.target.value as any)}
              className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
            >
              <option value="lifecycle">Category (Carry Over / New)</option>
              <option value="budget_actuals">Source (Budget / Actual)</option>
            </select>
          </div>

          {/* Show Financials Toggle */}
          <button
            type="button"
            onClick={() => setShowFinancials(!showFinancials)}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-colors ${
              showFinancials
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {showFinancials ? '✓ Show ₹ Cr' : 'Clean Slide'}
          </button>

          {/* Support Toggle */}
          <button
            type="button"
            onClick={() => setIncludeSupport(!includeSupport)}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-colors ${
              includeSupport
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
          >
            {includeSupport ? '✓ Support Included' : '+ Support'}
          </button>

          {/* Quick Open Family Scorecard */}
          {onSelectFamilyForScorecard && (
            <button
              type="button"
              onClick={() => onSelectFamilyForScorecard('')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
              title="Open Product Family Scoring & Quarterly/Half-Yearly/Yearly Parameter Monitor"
            >
              <Award size={12} />
              Family Scorecard
            </button>
          )}

          {/* Export Slide */}
          <button
            type="button"
            onClick={handleExportSlide}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
          >
            <Download size={12} />
            {isExporting ? 'Exporting...' : 'Export Slide'}
          </button>
        </div>
      </div>

      {/* Main Slide Canvas */}
      <div
        ref={treeRef}
        className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
      >
        {/* Slide Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-slate-200 bg-white">
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-[#0082ca]">
              Product Portfolio Tree
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {portfolioTree.totalFamilies} Product Families · {portfolioTree.totalProjects} CREAT Products (Budget: ₹{portfolioTree.totalBudgetCr.toFixed(2)} Cr | Actuals: ₹{portfolioTree.totalActualsCr.toFixed(2)} Cr)
            </p>
          </div>
        </div>

        {/* Scrollable Tree Viewport */}
        {portfolioTree.portfolios.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm font-semibold">
            No CREAT product families match the current filter selection.
          </div>
        ) : (
          <div className="overflow-x-auto pb-8 pt-3 px-4">
            <div className="min-w-max relative">
              {/* Background Horizontal Bands for Product Group, Product Portfolio, Product Family */}
              <div className="grid grid-cols-[150px_1fr] items-stretch">
                {/* Left Labels Column */}
                <div className="flex flex-col pr-2 select-none z-10">
                  <div className="h-[68px] bg-[#d4def2] flex items-center px-3 font-semibold text-slate-900 text-sm rounded-l-md mb-[10px]">
                    Product Group
                  </div>
                  <div className="h-[74px] bg-[#d4def2] flex items-center px-3 font-semibold text-slate-900 text-sm rounded-l-md mb-[10px]">
                    Product Portfolio
                  </div>
                  <div className="h-[74px] bg-[#d4def2] flex items-center px-3 font-semibold text-slate-900 text-sm rounded-l-md">
                    Product Family
                  </div>
                </div>

                {/* Right Tree Diagram Area */}
                <div className="relative">
                  {/* Full-width background stripes matching the left labels */}
                  <div className="absolute inset-x-0 top-0 pointer-events-none z-0">
                    <div className="h-[68px] bg-[#d4def2] rounded-r-md mb-[10px]" />
                    <div className="h-[74px] bg-[#d4def2] rounded-r-md mb-[10px]" />
                    <div className="h-[74px] bg-[#d4def2] rounded-r-md" />
                  </div>

                  {/* Tree Content */}
                  <div className="relative z-10 flex flex-col items-center px-4">
                    {/* LEVEL 1: PRODUCT GROUP */}
                    <div className="h-[68px] flex flex-col items-center justify-center relative">
                      <div className="bg-[#595959] border border-[#404040] text-white px-7 py-2.5 rounded-xl shadow-sm text-center min-w-[180px]">
                        <div className="text-sm font-bold leading-tight">
                          {portfolioTree.rootTitle}
                        </div>
                        {showFinancials && (
                          <div className="text-[10px] font-mono text-slate-200 mt-0.5">
                            B: ₹{portfolioTree.totalBudgetCr.toFixed(2)}Cr · A: ₹{portfolioTree.totalActualsCr.toFixed(2)}Cr
                          </div>
                        )}
                      </div>
                      {/* Vertical stem down from Product Group */}
                      {portfolioTree.portfolios.length > 0 && (
                        <div className="w-[1.5px] h-[14px] bg-[#7f7f7f] absolute -bottom-[10px] left-1/2 -translate-x-1/2" />
                      )}
                    </div>

                    {/* Gap between Band 1 and Band 2 */}
                    <div className="h-[10px] w-full" />

                    {/* LEVEL 2, 3, 4: PRODUCT PORTFOLIOS -> PRODUCT FAMILIES -> PROJECTS */}
                    <div className="flex items-start justify-center">
                      {portfolioTree.portfolios.map((portfolio, pIdx) => {
                        const isFirstPortfolio = pIdx === 0;
                        const isLastPortfolio = pIdx === portfolioTree.portfolios.length - 1;
                        const isOnlyPortfolio = portfolioTree.portfolios.length === 1;

                        return (
                          <div
                            key={portfolio.name}
                            className="flex flex-col items-center relative px-2"
                          >
                            {/* Horizontal connector bar above Product Portfolio */}
                            {!isOnlyPortfolio && (
                              <div
                                className="h-[1.5px] bg-[#7f7f7f] absolute top-0"
                                style={{
                                  left: isFirstPortfolio ? '50%' : 0,
                                  right: isLastPortfolio ? '50%' : 0
                                }}
                              />
                            )}

                            {/* LEVEL 2 NODE: PRODUCT PORTFOLIO (Blue Box) */}
                            <div className="h-[74px] flex flex-col items-center justify-center relative w-full">
                              {/* Vertical drop into Product Portfolio box */}
                              <div className="w-[1.5px] h-[8px] bg-[#7f7f7f] absolute top-0 left-1/2 -translate-x-1/2" />

                              <div className="bg-[#5b9bd5] border border-[#41719c] text-white px-4 py-2 rounded-xl shadow-xs text-center w-[165px] min-h-[54px] flex flex-col items-center justify-center">
                                <div className="text-xs font-bold leading-snug line-clamp-2">
                                  {portfolio.name}
                                </div>
                                {showFinancials && (
                                  <div className="text-[9px] font-mono text-blue-50 mt-0.5">
                                    B: ₹{portfolio.budgetCr.toFixed(1)} · A: ₹{portfolio.actualsCr.toFixed(1)}Cr
                                  </div>
                                )}
                              </div>

                              {/* Vertical stem down from Product Portfolio box */}
                              {portfolio.families.length > 0 && (
                                <div className="w-[1.5px] h-[18px] bg-[#7f7f7f] absolute -bottom-[10px] left-1/2 -translate-x-1/2" />
                              )}
                            </div>

                            {/* Gap between Band 2 and Band 3 */}
                            <div className="h-[10px] w-full" />

                            {/* LEVEL 3 & 4: PRODUCT FAMILIES (Green Boxes) & VERTICAL PROJECT TREES */}
                            <div className="flex items-start justify-center">
                              {portfolio.families.map((fam, fIdx) => {
                                const isFirstFam = fIdx === 0;
                                const isLastFam = fIdx === portfolio.families.length - 1;
                                const isOnlyFam = portfolio.families.length === 1;

                                return (
                                  <div
                                    key={fam.name}
                                    className="flex flex-col items-center relative px-1.5 w-[178px]"
                                  >
                                    {/* Horizontal connector bar connecting sibling Product Families */}
                                    {!isOnlyFam && (
                                      <div
                                        className="h-[1.5px] bg-[#7f7f7f] absolute top-0"
                                        style={{
                                          left: isFirstFam ? '50%' : 0,
                                          right: isLastFam ? '50%' : 0
                                        }}
                                      />
                                    )}

                                    {/* LEVEL 3 NODE: PRODUCT FAMILY (Green Box) */}
                                    <div className="h-[74px] flex flex-col items-center justify-center relative w-full">
                                      {/* Vertical drop into Green Product Family box */}
                                      <div className="w-[1.5px] h-[8px] bg-[#7f7f7f] absolute top-0 left-1/2 -translate-x-1/2" />

                                      <div
                                        onClick={() => onSelectFamilyForScorecard && onSelectFamilyForScorecard(fam.name)}
                                        className={`bg-[#70ad47] border border-[#507e32] text-white px-2.5 py-2 rounded-xl shadow-xs text-center w-full min-h-[56px] flex flex-col items-center justify-center ${
                                          onSelectFamilyForScorecard ? 'cursor-pointer hover:bg-[#62993d] transition-colors' : ''
                                        }`}
                                        title={`${fam.name} (${fam.projects.length} projects)${onSelectFamilyForScorecard ? ' — Click to open Product Family Scorecard' : ''}`}
                                      >
                                        <div className="text-[11px] font-bold leading-tight line-clamp-2">
                                          {fam.name}
                                        </div>
                                        {showFinancials && (
                                          <div className="text-[9px] font-mono text-emerald-50 mt-0.5">
                                            B: ₹{fam.budgetCr.toFixed(1)} · A: ₹{fam.actualsCr.toFixed(1)}Cr
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* LEVEL 4: VERTICAL TREE OF CREAT PROJECTS */}
                                    <div className="w-full pt-3 flex flex-col">
                                      {fam.projects.map((proj, projIdx) => {
                                        const isLastProj = projIdx === fam.projects.length - 1;
                                        const cardStyle = getProjectCardBg(proj);

                                        return (
                                          <div
                                            key={proj.id}
                                            className="relative pl-4 pb-2.5 last:pb-0 flex items-center"
                                          >
                                            {/* Left vertical tree trunk line */}
                                            <div
                                              className="w-[1.5px] bg-[#7f7f7f] absolute left-[6px]"
                                              style={{
                                                top: projIdx === 0 ? '-12px' : 0,
                                                bottom: isLastProj ? '50%' : 0
                                              }}
                                            />
                                            {/* Horizontal branch tick into project box */}
                                            <div className="w-[10px] h-[1.5px] bg-[#7f7f7f] absolute left-[6px] top-1/2 -translate-y-1/2" />

                                            {/* Project Card */}
                                            <div
                                              className={`w-full border px-2.5 py-2 rounded-xl shadow-xs text-center min-h-[58px] flex flex-col items-center justify-center transition-transform hover:scale-[1.02] ${cardStyle}`}
                                              title={`${proj.name} (${proj.code})\nDept: ${proj.vertical} | Family: ${proj.productFamily}\nCategory: ${proj.category} | Type: ${proj.projectType}\nBudget: ₹${proj.budgetCr.toFixed(2)} Cr (${proj.inBudget ? 'Yes' : 'No'})\nActuals: ₹${proj.actualsCr.toFixed(2)} Cr (${proj.inActuals ? 'Yes' : 'No'})`}
                                            >
                                              <div className="text-[10.5px] font-semibold leading-snug line-clamp-3">
                                                {proj.name}
                                              </div>

                                              {(() => {
                                                const badge = getSecondaryBadge(proj);
                                                return (
                                                  <div className="mt-1 flex items-center justify-center">
                                                    <span
                                                      className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wide border ${badge.className}`}
                                                    >
                                                      {badge.label}
                                                    </span>
                                                  </div>
                                                );
                                              })()}

                                              {showFinancials && (
                                                <div className="mt-1 pt-1 border-t border-white/20 w-full flex items-center justify-between text-[8.5px] font-mono text-white/90">
                                                  <span className="inline-flex items-center gap-0.5">
                                                    {proj.inBudget && <Check size={8} strokeWidth={3} />}
                                                    B:₹{proj.budgetCr.toFixed(1)}
                                                  </span>
                                                  <span className="inline-flex items-center gap-0.5">
                                                    {proj.inActuals && <Check size={8} strokeWidth={3} />}
                                                    A:₹{proj.actualsCr.toFixed(1)}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Slide Footer & Bottom-Right Color Legend */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
          <div className="text-[11px] text-slate-500 space-y-0.5">
            <div className="font-bold text-slate-700">
              CREAT Product Portfolio Tree — Live Budget & PMO Actuals Portfolio Hierarchy
            </div>
            <div>
              Click either legend group on the right to switch primary card coloring between Project Category and Budget/Actual status.
            </div>
          </div>

          {/* Dual Legend Groups on Bottom Right: Carry Over / New & Budget Only / Actual Only / Budget + Actual */}
          <div className="flex flex-wrap sm:flex-nowrap items-end gap-3 select-none">
            {/* Group 1: Carry Over / New */}
            <div
              onClick={() => setColorMode('lifecycle')}
              className={`flex flex-col gap-1.5 min-w-[175px] p-2 rounded-lg border transition-all cursor-pointer ${
                colorMode === 'lifecycle'
                  ? 'bg-white border-[#0082ca] ring-2 ring-[#0082ca]/20 shadow-xs'
                  : 'bg-white/60 border-slate-200 opacity-90 hover:opacity-100'
              }`}
              title="Click to color project cards primarily by Category (Carry Over vs New)"
            >
              <div className="flex items-center justify-between px-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
                <span>Project Category</span>
                {colorMode === 'lifecycle' && (
                  <span className="text-[#0082ca]">● Primary Fill</span>
                )}
              </div>
              <div className="bg-[#4472c4] border border-[#2f5597] text-white text-xs italic font-medium text-center py-1 px-4 rounded-lg shadow-2xs">
                Carry Over
              </div>
              <div className="bg-[#002060] border border-[#001540] text-white text-xs italic font-medium text-center py-1 px-4 rounded-lg shadow-2xs">
                New
              </div>
            </div>

            {/* Group 2: Budget Only / Actual Only / Budget + Actual */}
            <div
              onClick={() => setColorMode('budget_actuals')}
              className={`flex flex-col gap-1.5 min-w-[190px] p-2 rounded-lg border transition-all cursor-pointer ${
                colorMode === 'budget_actuals'
                  ? 'bg-white border-[#0082ca] ring-2 ring-[#0082ca]/20 shadow-xs'
                  : 'bg-white/60 border-slate-200 opacity-90 hover:opacity-100'
              }`}
              title="Click to color project cards primarily by Data Source (Budget Only, Actual Only, Budget + Actual)"
            >
              <div className="flex items-center justify-between px-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
                <span>Budget / Actual Status</span>
                {colorMode === 'budget_actuals' && (
                  <span className="text-[#0082ca]">● Primary Fill</span>
                )}
              </div>
              <div className="bg-[#d97706] border border-[#b45309] text-white text-xs italic font-medium text-center py-1 px-4 rounded-lg shadow-2xs">
                Budget Only
              </div>
              <div className="bg-[#7f7f7f] border border-[#666666] text-white text-xs italic font-medium text-center py-1 px-4 rounded-lg shadow-2xs">
                Actual Only
              </div>
              <div className="bg-[#0d9488] border border-[#0f766e] text-white text-xs italic font-medium text-center py-1 px-4 rounded-lg shadow-2xs">
                Budget + Actual
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
