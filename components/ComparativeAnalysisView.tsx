import React, { useMemo, useState, useEffect } from 'react';
import { Project, FiscalYear, FiscalMode, getAbsoluteMonthIndex } from '../types';
import {
  RATE_PER_HOUR,
  CONTRACTED_EMPLOYEE_RATE,
  HOURS_PER_MONTH,
  MAX_MONTHS,
  SKILL_MAPPING,
  MANPOWER_CATEGORIES,
  EXPENSE_CATEGORIES,
  classifyCategory,
  isSummaryOrCalculatedLabel,
  normalizeVertical
} from '../constants';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  ReferenceLine
} from 'recharts';
import {
  Layers,
  Briefcase,
  Calendar,
  Target,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Building2,
  Search,
  Check,
  Minus,
  Link2,
  Link2Off,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { ProductPortfolioTree } from './ProductPortfolioTree';

interface ComparativeAnalysisViewProps {
  projects: Project[];
  months: string[];
  selectedFY: FiscalYear;
  viewMode: 'tabular' | 'graphical';
  setViewMode: (mode: 'tabular' | 'graphical') => void;
  totalsLookup?: Record<string, any>;
  config?: any;
  calculateProjectCost?: (p: any, mode: FiscalMode) => {
    mm: number;
    directMM: number;
    contractedMM: number;
    manpowerCr: number;
    expenseCr: number;
    totalCr: number;
  };
  getActiveProjectData?: (p: any, mode: FiscalMode) => Record<string, number[]>;
  activeSubView?: 'table' | 'burndown' | 'dept_charts';
  onSubViewChange?: (v: 'table' | 'burndown' | 'dept_charts') => void;
}

const formatCr = (val: number, decimals: number = 2) => {
  return (val || 0).toFixed(decimals);
};

export const ComparativeAnalysisView: React.FC<ComparativeAnalysisViewProps> = ({
  projects,
  months,
  selectedFY,
  viewMode,
  setViewMode,
  totalsLookup,
  config,
  calculateProjectCost,
  getActiveProjectData,
  activeSubView,
  onSubViewChange
}) => {
  const [budgetAsOfIndex, setBudgetAsOfIndex] = useState<number>(Math.max(0, months.length - 1));
  const [asOfIndex, setAsOfIndex] = useState<number>(Math.max(0, months.length - 1));
  const [syncHorizons, setSyncHorizons] = useState<boolean>(true);
  const [internalSubView, setInternalSubView] = useState<'table' | 'burndown' | 'dept_charts'>(
    viewMode === 'graphical' ? 'burndown' : 'table'
  );
  const subView = activeSubView ?? internalSubView;
  const setSubView = (v: 'table' | 'burndown' | 'dept_charts') => {
    setInternalSubView(v);
    if (onSubViewChange) onSubViewChange(v);
  };
  const [treeDepth, setTreeDepth] = useState<number>(1);
  const [searchQuery] = useState<string>('');
  const [presenceFilter, setPresenceFilter] = useState<'all' | 'both' | 'budget_only' | 'actuals_only'>('all');
  const [chartGroupBy, setChartGroupBy] = useState<'department' | 'family'>('department');
  const [burnChartMode, setBurnChartMode] = useState<'burndown' | 'burnup'>('burndown');
  const [burnScopeDept] = useState<string>('All');
  const [deptChartMode, setDeptChartMode] = useState<'burndown' | 'standard'>('burndown');

  useEffect(() => {
    const maxIdx = Math.max(0, months.length - 1);
    setBudgetAsOfIndex(maxIdx);
    setAsOfIndex(maxIdx);
  }, [months.length, selectedFY]);

  const handleBudgetHorizonChange = (idx: number) => {
    setBudgetAsOfIndex(idx);
    if (syncHorizons) setAsOfIndex(idx);
  };

  const handleActualsHorizonChange = (idx: number) => {
    setAsOfIndex(idx);
    if (syncHorizons) setBudgetAsOfIndex(idx);
  };

  const toggleSyncHorizons = () => {
    const next = !syncHorizons;
    setSyncHorizons(next);
    if (next) {
      setBudgetAsOfIndex(asOfIndex);
    }
  };

  const monthIndices = useMemo(() => {
    return months.map(m => getAbsoluteMonthIndex(m));
  }, [months]);

  const ratesCache = useMemo(() => {
    const safeConfig = config || {};
    const cache: Record<number, { hRate: number; cRate: number }> = {};
    for (let i = 0; i < MAX_MONTHS; i++) {
      const fyStartYear = 19 + Math.floor(i / 12);
      const fyStr = `FY ${fyStartYear}-${fyStartYear + 1}`;
      const fyConfig = safeConfig.fyFinancials?.[fyStr];
      cache[i] = {
        hRate:
          fyConfig?.hourlyRate !== undefined && fyConfig?.hourlyRate !== null
            ? fyConfig.hourlyRate
            : safeConfig.hourlyRate || RATE_PER_HOUR,
        cRate:
          fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null
            ? fyConfig.contractedEmployeeRate
            : safeConfig.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE
      };
    }
    return cache;
  }, [config]);

  // Helper to extract monthly Cr array (length = months.length) for a project and mode
  const getProjectMonthlyCrs = (p: any, mode: FiscalMode): number[] => {
    const numMonths = months.length;
    const monthly = new Array(numMonths).fill(0);
    const isHolidayLeave =
      (p.name || '').toLowerCase().includes('holiday') ||
      (p.name || '').toLowerCase().includes('leave');

    let activeSource: Record<string, any> = {};
    if (getActiveProjectData) {
      activeSource = getActiveProjectData(p, mode) || {};
    } else if (mode === 'Actuals') {
      activeSource = {
        ...(p.actuals || {}),
        ...(p.actualsSkills || {}),
        ...(p.actualsEmployeeSkills || {})
      };
    } else {
      activeSource = {
        ...(p.skills || {}),
        ...(p.expenses || {}),
        ...(p.pmoSkills || {}),
        ...(p.pmoEmployeeSkills || {}),
        ...(p.pmoRows || {}),
        ...(p.rows || {})
      };
    }

    const groupedData: Record<string, Record<number, number>> = {};
    Object.entries(activeSource).forEach(([rawCat, dataArray]) => {
      if (isSummaryOrCalculatedLabel(rawCat)) return;
      const cat = SKILL_MAPPING[rawCat] || rawCat;
      if (isSummaryOrCalculatedLabel(cat)) return;
      if (!groupedData[cat]) groupedData[cat] = {};

      if (Array.isArray(dataArray)) {
        dataArray.forEach((v, idx) => {
          const num = Number(v) || 0;
          if (num !== 0) groupedData[cat][idx] = (groupedData[cat][idx] || 0) + num;
        });
      } else if (dataArray && typeof dataArray === 'object') {
        Object.entries(dataArray).forEach(([k, v]) => {
          const idx = parseInt(k, 10);
          const num = Number(v) || 0;
          if (!isNaN(idx) && num !== 0) {
            groupedData[cat][idx] = (groupedData[cat][idx] || 0) + num;
          }
        });
      }
    });

    for (let i = 0; i < numMonths; i++) {
      const globalIdx = monthIndices[i];
      if (globalIdx === undefined || globalIdx < 0) continue;
      const { hRate, cRate } = ratesCache[globalIdx] || {
        hRate: RATE_PER_HOUR,
        cRate: CONTRACTED_EMPLOYEE_RATE
      };

      let monthDirectMM = 0;
      let monthContractedMM = 0;
      let monthExpCr = 0;

      Object.entries(groupedData).forEach(([cat, catMonths]) => {
        const val = Number(catMonths[globalIdx] || 0);
        if (val === 0) return;

        const normCat = cat.toLowerCase().trim();
        const isContractedExp = normCat === 'contracted employee expense';
        const catKind = classifyCategory(cat);
        const isContracted =
          catKind === 'CONTRACTED_MANPOWER' ||
          (normCat.includes('contracted') && !isContractedExp);
        const isManpower =
          catKind === 'DIRECT_MANPOWER' ||
          catKind === 'CONTRACTED_MANPOWER' ||
          MANPOWER_CATEGORIES.includes(cat as any) ||
          cat.includes('_CoC') ||
          cat.includes('_Vertical') ||
          cat === 'NPC';
        const isExpense =
          catKind === 'EXPENSE' ||
          EXPENSE_CATEGORIES.includes(cat as any) ||
          isContractedExp;

        if (isManpower) {
          if (isContracted) {
            monthContractedMM += val;
          } else {
            monthDirectMM += val;
          }
        } else if (isExpense) {
          if (!isHolidayLeave || isContracted || isContractedExp) {
            if (isContractedExp) {
              const mmObj =
                groupedData['Contracted Employee'] ||
                groupedData['Contracted Employee (MM)'] ||
                {};
              if ((mmObj[globalIdx] || 0) === 0) {
                monthExpCr += val / 10000000;
              }
            } else {
              monthExpCr += val / 10000000;
            }
          }
        }
      });

      const monthDirectCr = !isHolidayLeave
        ? (monthDirectMM * hRate * HOURS_PER_MONTH) / 10000000
        : 0;
      const monthContractedCr =
        (monthContractedMM * cRate * HOURS_PER_MONTH) / 10000000;

      monthly[i] = monthDirectCr + monthContractedCr + monthExpCr;
    }

    return monthly;
  };

  // Helper to calculate total project budget in Crores (Cr) and MM
  const getProjectBudgetInfo = (p: Project): { totalCr: number; mm: number } => {
    if (calculateProjectCost) {
      const c = calculateProjectCost(p, 'Budget');
      if (c && (c.totalCr > 0 || c.mm > 0)) {
        return { totalCr: c.totalCr, mm: c.mm || 0 };
      }
    }
    const pLookup = totalsLookup
      ? totalsLookup[p.id] || (p.code ? totalsLookup[p.code] : undefined)
      : undefined;
    if (pLookup?.budget) {
      const bTotal =
        pLookup.budget.grandTotalCrs ??
        pLookup.budget.totalCr ??
        (pLookup.budget.manpowerCr || 0) + (pLookup.budget.expensesCr || 0);
      const bMM = pLookup.budget.mm || 0;
      if (bTotal > 0 || bMM > 0) return { totalCr: bTotal, mm: bMM };
    }
    if ((p as any).portfolioBudgetCr !== undefined && (p as any).portfolioBudgetCr > 0) {
      return { totalCr: Number((p as any).portfolioBudgetCr) || 0, mm: 0 };
    }
    const monthly = getProjectMonthlyCrs(p, 'Budget');
    return { totalCr: monthly.reduce((a, b) => a + b, 0), mm: 0 };
  };

  // Helper to calculate project full-year actuals in Crores (Cr)
  const getProjectActualsFullYear = (
    p: Project
  ): { totalCr: number; manpowerCr: number; expenseCr: number; mm: number } => {
    if (calculateProjectCost) {
      const c = calculateProjectCost(p, 'Actuals');
      if (c && (c.totalCr > 0 || c.mm > 0)) {
        return {
          totalCr: c.totalCr,
          manpowerCr: c.manpowerCr || 0,
          expenseCr: c.expenseCr || 0,
          mm: c.mm || 0
        };
      }
    }
    const pLookup = totalsLookup
      ? totalsLookup[p.id] || (p.code ? totalsLookup[p.code] : undefined)
      : undefined;
    if (pLookup?.actuals) {
      const act = pLookup.actuals;
      const totalCr =
        act.grandTotalCrs ??
        act.totalCr ??
        (act.manpowerCr || 0) + (act.expensesCr ?? act.expenseCr ?? 0);
      if (totalCr > 0 || (act.mm || 0) > 0) {
        return {
          totalCr,
          manpowerCr: act.manpowerCr || 0,
          expenseCr: act.expensesCr ?? act.expenseCr ?? 0,
          mm: act.mm || 0
        };
      }
    }
    if ((p as any).trueActualSpentCr !== undefined && ((p as any).trueActualSpentCr > 0 || (p as any).trueActualMM > 0)) {
      return {
        totalCr: Number((p as any).trueActualSpentCr) || 0,
        manpowerCr: Number((p as any).trueActualManpowerSpentCr) || 0,
        expenseCr: Number((p as any).trueActualExpenseSpentCr) || 0,
        mm: Number((p as any).trueActualMM) || 0
      };
    }
    if ((p as any).actualSpentCr !== undefined && (p as any).actualSpentCr > 0) {
      return {
        totalCr: Number((p as any).actualSpentCr) || 0,
        manpowerCr: Number((p as any).manpowerSpentCr) || 0,
        expenseCr: Number((p as any).expenseSpentCr) || 0,
        mm: Number((p as any).totalMM) || 0
      };
    }
    const monthly = getProjectMonthlyCrs(p, 'Actuals');
    const sumCr = monthly.reduce((a, b) => a + b, 0);
    return { totalCr: sumCr, manpowerCr: 0, expenseCr: 0, mm: 0 };
  };

  // Helper to calculate project budget up to budgetAsOfIndex (cumulative month-on-month) in Crores (Cr)
  const getProjectBudgetYTD = (p: Project, upToIdx: number): number => {
    const fullYear = getProjectBudgetInfo(p).totalCr;

    if (upToIdx >= months.length - 1) {
      return fullYear;
    }

    const monthlyCrs = getProjectMonthlyCrs(p, 'Budget');
    let ytdSum = 0;
    let totalMonthlySum = 0;
    for (let i = 0; i < monthlyCrs.length; i++) {
      const v = Number(monthlyCrs[i]) || 0;
      totalMonthlySum += v;
      if (i <= upToIdx) {
        ytdSum += v;
      }
    }

    if (totalMonthlySum > 0) {
      if (fullYear > 0) {
        return fullYear * (ytdSum / totalMonthlySum);
      }
      return ytdSum;
    }

    if (fullYear > 0 && months.length > 0) {
      return fullYear * ((upToIdx + 1) / months.length);
    }

    return 0;
  };

  // Helper to calculate project actuals up to asOfIndex (cumulative month-on-month) in Crores (Cr)
  const getProjectActualsYTD = (p: Project, upToIdx: number): number => {
    const fullYear = getProjectActualsFullYear(p).totalCr;

    if (upToIdx >= months.length - 1) {
      return fullYear;
    }

    const monthlyCrs = getProjectMonthlyCrs(p, 'Actuals');
    let ytdSum = 0;
    let totalMonthlySum = 0;
    for (let i = 0; i < monthlyCrs.length; i++) {
      const v = Number(monthlyCrs[i]) || 0;
      totalMonthlySum += v;
      if (i <= upToIdx) {
        ytdSum += v;
      }
    }

    if (totalMonthlySum > 0) {
      if (fullYear > 0) {
        return fullYear * (ytdSum / totalMonthlySum);
      }
      return ytdSum;
    }

    return 0;
  };

  type TreeNode = {
    id: string;
    name: string;
    code?: string;
    type: 'overall' | 'department' | 'family' | 'project';
    projectCount: number;
    inBudgetCount: number;
    inActualsCount: number;
    inBudget: boolean;
    inActuals: boolean;
    budget: number;
    budgetFullYear: number;
    actualsYTD: number;
    actualsFullYear: number;
    actualsManpowerCr: number;
    actualsExpenseCr: number;
    actualsMM: number;
    children: TreeNode[];
  };

  const treeData = useMemo(() => {
    const root: TreeNode = {
      id: 'root',
      name: 'Overall',
      type: 'overall',
      projectCount: 0,
      inBudgetCount: 0,
      inActualsCount: 0,
      inBudget: false,
      inActuals: false,
      budget: 0,
      budgetFullYear: 0,
      actualsYTD: 0,
      actualsFullYear: 0,
      actualsManpowerCr: 0,
      actualsExpenseCr: 0,
      actualsMM: 0,
      children: []
    };

    const q = searchQuery.trim().toLowerCase();

    const canonicalVerticals: string[] = Array.isArray(config?.verticals) ? config.verticals : [];
    const canonicalFamilies: string[] = Array.isArray(config?.productFamilies) ? config.productFamilies : [];

    projects.forEach(p => {
      const rawDept = (p.vertical || 'Unassigned Department').trim();
      const normDept = normalizeVertical(rawDept);
      const matchedVertical = canonicalVerticals.find(
        v => v.trim().toLowerCase() === normDept.toLowerCase()
      );
      const deptName = matchedVertical ? matchedVertical.trim() : normDept;

      const rawFamily = (p.productFamily || 'Unassigned Family').trim();
      const matchedFamily = canonicalFamilies.find(
        f => f.trim().toLowerCase() === rawFamily.toLowerCase()
      );
      const familyName = matchedFamily ? matchedFamily.trim() : rawFamily;

      const projName = (p.name || p.code || 'Unnamed Project').trim();
      const projCode = (p.code || '').trim();

      if (q) {
        const matches =
          deptName.toLowerCase().includes(q) ||
          familyName.toLowerCase().includes(q) ||
          projName.toLowerCase().includes(q) ||
          projCode.toLowerCase().includes(q);
        if (!matches) return;
      }

      const budgetInfo = getProjectBudgetInfo(p);
      const budgetFullYear = budgetInfo.totalCr;
      const budget = getProjectBudgetYTD(p, budgetAsOfIndex);
      const actFullObj = getProjectActualsFullYear(p);
      const actYTD = getProjectActualsYTD(p, asOfIndex);

      const hasBudget = budgetFullYear > 0.0001 || budgetInfo.mm > 0.0001;
      const hasActuals =
        actFullObj.totalCr > 0.0001 || actYTD > 0.0001 || actFullObj.mm > 0.0001;

      if (presenceFilter === 'both' && !(hasBudget && hasActuals)) return;
      if (presenceFilter === 'budget_only' && !(hasBudget && !hasActuals)) return;
      if (presenceFilter === 'actuals_only' && !(!hasBudget && hasActuals)) return;

      let deptNode = root.children.find(
        c => c.name.trim().toLowerCase() === deptName.toLowerCase()
      );
      if (!deptNode) {
        deptNode = {
          id: `dept-${deptName.toLowerCase()}`,
          name: deptName,
          type: 'department',
          projectCount: 0,
          inBudgetCount: 0,
          inActualsCount: 0,
          inBudget: false,
          inActuals: false,
          budget: 0,
          budgetFullYear: 0,
          actualsYTD: 0,
          actualsFullYear: 0,
          actualsManpowerCr: 0,
          actualsExpenseCr: 0,
          actualsMM: 0,
          children: []
        };
        root.children.push(deptNode);
      } else if (deptNode.name === deptNode.name.toLowerCase() && deptName !== deptName.toLowerCase()) {
        deptNode.name = deptName;
      }

      let familyNode = deptNode.children.find(
        c => c.name.trim().toLowerCase() === familyName.toLowerCase()
      );
      if (!familyNode) {
        familyNode = {
          id: `fam-${deptNode.name.toLowerCase()}-${familyName.toLowerCase()}`,
          name: familyName,
          type: 'family',
          projectCount: 0,
          inBudgetCount: 0,
          inActualsCount: 0,
          inBudget: false,
          inActuals: false,
          budget: 0,
          budgetFullYear: 0,
          actualsYTD: 0,
          actualsFullYear: 0,
          actualsManpowerCr: 0,
          actualsExpenseCr: 0,
          actualsMM: 0,
          children: []
        };
        deptNode.children.push(familyNode);
      } else if (familyNode.name === familyNode.name.toLowerCase() && familyName !== familyName.toLowerCase()) {
        familyNode.name = familyName;
      }

      const pNode: TreeNode = {
        id: `proj-${p.id || projCode || projName}`,
        name: projName,
        code: projCode,
        type: 'project',
        projectCount: 1,
        inBudgetCount: hasBudget ? 1 : 0,
        inActualsCount: hasActuals ? 1 : 0,
        inBudget: hasBudget,
        inActuals: hasActuals,
        budget,
        budgetFullYear,
        actualsYTD: actYTD,
        actualsFullYear: actFullObj.totalCr,
        actualsManpowerCr: actFullObj.manpowerCr,
        actualsExpenseCr: actFullObj.expenseCr,
        actualsMM: actFullObj.mm,
        children: []
      };

      familyNode.children.push(pNode);

      [familyNode, deptNode, root].forEach(node => {
        node.projectCount += 1;
        node.inBudgetCount += pNode.inBudgetCount;
        node.inActualsCount += pNode.inActualsCount;
        node.inBudget = node.inBudgetCount > 0;
        node.inActuals = node.inActualsCount > 0;
        node.budget += pNode.budget;
        node.budgetFullYear += pNode.budgetFullYear;
        node.actualsYTD += pNode.actualsYTD;
        node.actualsFullYear += pNode.actualsFullYear;
        node.actualsManpowerCr += pNode.actualsManpowerCr;
        node.actualsExpenseCr += pNode.actualsExpenseCr;
        node.actualsMM += pNode.actualsMM;
      });
    });

    // Sort each level by combined financial weight (Budget + Actuals) descending
    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        const weightB = Math.max(b.budget, b.budgetFullYear, b.actualsYTD, b.actualsFullYear);
        const weightA = Math.max(a.budget, a.budgetFullYear, a.actualsYTD, a.actualsFullYear);
        if (Math.abs(weightB - weightA) > 0.0001) return weightB - weightA;
        return a.name.localeCompare(b.name);
      });
      nodes.forEach(n => {
        if (n.children.length > 0) sortNodes(n.children);
      });
    };

    sortNodes(root.children);
    return root;
  }, [
    projects,
    budgetAsOfIndex,
    asOfIndex,
    months,
    totalsLookup,
    config,
    calculateProjectCost,
    getActiveProjectData,
    searchQuery,
    presenceFilter
  ]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true });

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandToLevel = (maxLevel: number) => {
    setTreeDepth(maxLevel);
    const next: Record<string, boolean> = {};
    const walk = (node: TreeNode, level: number) => {
      if (level < maxLevel && node.children.length > 0) {
        next[node.id] = true;
        node.children.forEach(c => walk(c, level + 1));
      }
    };
    walk(treeData, 0);
    setExpanded(next);
  };

  // Month-by-month Burn-Down and Cumulative Burn-Up series
  const monthlyBurnData = useMemo(() => {
    const numMonths = months.length;
    if (numMonths === 0) return { points: [], totalAnnualBudget: 0, totalActualsYTD: 0, activeActualMonthIdx: 0 };

    const mBudget = new Array(numMonths).fill(0);
    const mActuals = new Array(numMonths).fill(0);
    let totalAnnualBudget = 0;

    const canonicalVerticals: string[] = Array.isArray(config?.verticals) ? config.verticals : [];

    projects.forEach(p => {
      const rawDept = (p.vertical || 'Unassigned Department').trim();
      const normDept = normalizeVertical(rawDept);
      const matchedVertical = canonicalVerticals.find(
        v => v.trim().toLowerCase() === normDept.toLowerCase()
      );
      const deptName = matchedVertical ? matchedVertical.trim() : normDept;

      if (burnScopeDept !== 'All' && deptName.toLowerCase() !== burnScopeDept.toLowerCase()) {
        return;
      }

      const bFull = getProjectBudgetInfo(p).totalCr;
      const aFull = getProjectActualsFullYear(p).totalCr;
      totalAnnualBudget += bFull;

      const rawMBudget = getProjectMonthlyCrs(p, 'Budget');
      const rawBSum = rawMBudget.reduce((s, v) => s + (Number(v) || 0), 0);
      if (rawBSum > 0.0001) {
        const scale = bFull > 0 ? bFull / rawBSum : 1;
        for (let i = 0; i < numMonths; i++) {
          mBudget[i] += (Number(rawMBudget[i]) || 0) * scale;
        }
      } else if (bFull > 0) {
        const perMonth = bFull / numMonths;
        for (let i = 0; i < numMonths; i++) {
          mBudget[i] += perMonth;
        }
      }

      const rawMActuals = getProjectMonthlyCrs(p, 'Actuals');
      const rawASum = rawMActuals.reduce((s, v) => s + (Number(v) || 0), 0);
      if (rawASum > 0.0001) {
        const scale = aFull > 0 ? aFull / rawASum : 1;
        for (let i = 0; i < numMonths; i++) {
          mActuals[i] += (Number(rawMActuals[i]) || 0) * scale;
        }
      } else if (aFull > 0) {
        // Fallback if project only has summary actuals without monthly breakdown
        const effectiveMonths = Math.max(1, asOfIndex + 1);
        const perMonth = aFull / effectiveMonths;
        for (let i = 0; i < effectiveMonths; i++) {
          mActuals[i] += perMonth;
        }
      }
    });

    // Find last month index that has actuals within asOfIndex
    let lastActiveActualIdx = -1;
    for (let i = Math.min(asOfIndex, numMonths - 1); i >= 0; i--) {
      if (mActuals[i] > 0.001) {
        lastActiveActualIdx = i;
        break;
      }
    }
    if (lastActiveActualIdx === -1) {
      lastActiveActualIdx = Math.min(asOfIndex, numMonths - 1);
    }

    const totalActualsUpToActive = mActuals
      .slice(0, lastActiveActualIdx + 1)
      .reduce((s, v) => s + v, 0);
    const avgMonthlyActualBurn =
      lastActiveActualIdx >= 0 ? totalActualsUpToActive / (lastActiveActualIdx + 1) : 0;

    let cumBudget = 0;
    let cumActuals = 0;

    const points: any[] = [
      {
        name: 'Start',
        MonthlyBudget: 0,
        MonthlyActuals: 0,
        CumulativeBudget: 0,
        CumulativeActuals: 0,
        PlannedRemaining: Number(totalAnnualBudget.toFixed(2)),
        ActualRemaining: Number(totalAnnualBudget.toFixed(2)),
        ProjectedRemaining: null
      }
    ];

    for (let i = 0; i < numMonths; i++) {
      const bVal = i <= budgetAsOfIndex ? mBudget[i] : mBudget[i];
      const aVal = i <= asOfIndex ? mActuals[i] : 0;
      cumBudget += bVal;
      if (i <= lastActiveActualIdx) {
        cumActuals += aVal;
      }

      const plannedRem = totalAnnualBudget - cumBudget;
      const actualRem = i <= lastActiveActualIdx ? totalAnnualBudget - cumActuals : null;

      let projectedRem: number | null = null;
      if (i === lastActiveActualIdx) {
        projectedRem = Number((totalAnnualBudget - cumActuals).toFixed(2));
      } else if (i > lastActiveActualIdx && avgMonthlyActualBurn > 0) {
        const monthsAhead = i - lastActiveActualIdx;
        projectedRem = Number(
          (totalAnnualBudget - (cumActuals + avgMonthlyActualBurn * monthsAhead)).toFixed(2)
        );
      }

      points.push({
        name: months[i],
        MonthlyBudget: Number(bVal.toFixed(2)),
        MonthlyActuals: i <= lastActiveActualIdx ? Number(aVal.toFixed(2)) : 0,
        CumulativeBudget: Number(cumBudget.toFixed(2)),
        CumulativeActuals: i <= lastActiveActualIdx ? Number(cumActuals.toFixed(2)) : null,
        PlannedRemaining: Number(plannedRem.toFixed(2)),
        ActualRemaining: actualRem !== null ? Number(actualRem.toFixed(2)) : null,
        ProjectedRemaining: projectedRem
      });
    }

    return {
      points,
      totalAnnualBudget,
      totalActualsYTD: cumActuals,
      activeActualMonthIdx: lastActiveActualIdx,
      avgMonthlyActualBurn
    };
  }, [projects, months, budgetAsOfIndex, asOfIndex, burnScopeDept, config, totalsLookup, calculateProjectCost]);

  const chartData = useMemo(() => {
    let baseRows: {
      name: string;
      Budget: number;
      ActualsYTD: number;
      ActualsFullYear: number;
      Variance: number;
      Utilization: number;
      projectCount: number;
    }[] = [];

    if (chartGroupBy === 'department') {
      baseRows = treeData.children.map(dept => ({
        name: dept.name,
        Budget: Number(dept.budget.toFixed(2)),
        ActualsYTD: Number(dept.actualsYTD.toFixed(2)),
        ActualsFullYear: Number(dept.actualsFullYear.toFixed(2)),
        Variance: Number((dept.actualsYTD - dept.budget).toFixed(2)),
        Utilization:
          dept.budget > 0 ? Number(((dept.actualsYTD / dept.budget) * 100).toFixed(1)) : 0,
        projectCount: dept.projectCount
      }));
    } else {
      const famMap: Record<
        string,
        { budget: number; actualsYTD: number; actualsFullYear: number; count: number }
      > = {};
      treeData.children.forEach(dept => {
        dept.children.forEach(fam => {
          if (!famMap[fam.name]) {
            famMap[fam.name] = { budget: 0, actualsYTD: 0, actualsFullYear: 0, count: 0 };
          }
          famMap[fam.name].budget += fam.budget;
          famMap[fam.name].actualsYTD += fam.actualsYTD;
          famMap[fam.name].actualsFullYear += fam.actualsFullYear;
          famMap[fam.name].count += fam.projectCount;
        });
      });
      baseRows = Object.entries(famMap)
        .map(([name, d]) => ({
          name,
          Budget: Number(d.budget.toFixed(2)),
          ActualsYTD: Number(d.actualsYTD.toFixed(2)),
          ActualsFullYear: Number(d.actualsFullYear.toFixed(2)),
          Variance: Number((d.actualsYTD - d.budget).toFixed(2)),
          Utilization: d.budget > 0 ? Number(((d.actualsYTD / d.budget) * 100).toFixed(1)) : 0,
          projectCount: d.count
        }))
        .sort((a, b) => Math.max(b.Budget, b.ActualsYTD) - Math.max(a.Budget, a.ActualsYTD));
    }

    // Add cumulative burn-down & cumulative spend across categories
    const totalBudgetSum = baseRows.reduce((s, r) => s + r.Budget, 0);
    let cumBudget = 0;
    let cumActuals = 0;

    return baseRows.map(r => {
      cumBudget += r.Budget;
      cumActuals += r.ActualsYTD;
      return {
        ...r,
        CumulativeBudget: Number(cumBudget.toFixed(2)),
        CumulativeActuals: Number(cumActuals.toFixed(2)),
        RemainingBudgetBurnDown: Number((totalBudgetSum - cumActuals).toFixed(2)),
        PlannedBurnDown: Number((totalBudgetSum - cumBudget).toFixed(2))
      };
    });
  }, [treeData, chartGroupBy]);

  const renderTree = (node: TreeNode, level: number = 0): React.ReactNode => {
    const isExpanded = !!expanded[node.id] || searchQuery.trim().length > 0;
    const variance = node.actualsYTD - node.budget;
    const util = node.budget > 0 ? (node.actualsYTD / node.budget) * 100 : 0;
    const isOver = variance > 0.001;

    const rowBgClass =
      level === 0
        ? 'bg-slate-900 text-white font-black'
        : level === 1
        ? 'bg-slate-50/90 hover:bg-slate-100/80 text-slate-900 font-bold'
        : level === 2
        ? 'bg-white hover:bg-indigo-50/30 text-slate-800 font-semibold'
        : 'bg-white hover:bg-slate-50 text-slate-600 font-medium';

    const levelBadge =
      node.type === 'overall' ? (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
          Overall
        </span>
      ) : node.type === 'department' ? (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
          Dept
        </span>
      ) : node.type === 'family' ? (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-200">
          Family
        </span>
      ) : null;

    return (
      <React.Fragment key={node.id}>
        <tr
          className={`border-b border-slate-100 transition-colors ${rowBgClass} ${
            node.children.length > 0 ? 'cursor-pointer' : ''
          }`}
          onClick={() => {
            if (node.children.length > 0) toggleExpand(node.id);
          }}
        >
          <td className="py-2.5 px-4" style={{ paddingLeft: `${level * 24 + 16}px` }}>
            <div className="flex items-center gap-2">
              {node.children.length > 0 ? (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    toggleExpand(node.id);
                  }}
                  className={`p-1 rounded transition-colors ${
                    level === 0 ? 'hover:bg-white/10 text-white' : 'hover:bg-slate-200 text-slate-500'
                  }`}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span className="w-6 inline-block" />
              )}

              {node.type === 'overall' ? (
                <FolderTree size={14} className="text-indigo-400 shrink-0" />
              ) : node.type === 'department' ? (
                <Building2 size={14} className="text-blue-600 shrink-0" />
              ) : node.type === 'family' ? (
                <Layers size={13} className="text-purple-600 shrink-0" />
              ) : (
                <Briefcase size={12} className="text-slate-400 shrink-0" />
              )}

              <span className={level === 0 ? 'text-sm font-black' : 'text-xs'}>{node.name}</span>

              {node.type === 'project' && node.code && node.code !== node.name && (
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[10px]">
                  {node.code}
                </span>
              )}

              {levelBadge}
            </div>
          </td>

          {/* Column 1: In Budget Indicator */}
          <td className="py-2.5 px-3 text-center">
            {node.type === 'project' ? (
              node.inBudget ? (
                <span
                  title="Present in Budget"
                  className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black"
                >
                  <Check size={12} strokeWidth={3} />
                </span>
              ) : (
                <span
                  title="Not in Budget"
                  className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold"
                >
                  <Minus size={11} strokeWidth={2.5} />
                </span>
              )
            ) : (
              <span
                title={`${node.inBudgetCount} of ${node.projectCount} projects in Budget`}
                className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                  level === 0
                    ? 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
                    : node.inBudgetCount > 0
                    ? 'bg-blue-50 text-blue-700 border border-blue-200/70'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {node.inBudgetCount > 0 && <Check size={10} strokeWidth={3} />}
                {node.inBudgetCount}/{node.projectCount}
              </span>
            )}
          </td>

          {/* Column 2: In Actuals Indicator */}
          <td className="py-2.5 px-3 text-center">
            {node.type === 'project' ? (
              node.inActuals ? (
                <span
                  title="Present in PMO Actuals"
                  className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black"
                >
                  <Check size={12} strokeWidth={3} />
                </span>
              ) : (
                <span
                  title="Not in PMO Actuals"
                  className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold"
                >
                  <Minus size={11} strokeWidth={2.5} />
                </span>
              )
            ) : (
              <span
                title={`${node.inActualsCount} of ${node.projectCount} projects in PMO Actuals`}
                className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                  level === 0
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                    : node.inActualsCount > 0
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {node.inActualsCount > 0 && <Check size={10} strokeWidth={3} />}
                {node.inActualsCount}/{node.projectCount}
              </span>
            )}
          </td>

          <td className="py-2.5 px-4 text-center font-mono text-xs">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                level === 0
                  ? 'bg-white/10 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {node.projectCount}
            </span>
          </td>

          <td
            className={`py-2.5 px-4 text-right font-mono font-bold ${
              level === 0 ? 'text-white' : 'text-slate-900'
            }`}
          >
            ₹{formatCr(node.budget, 2)}
          </td>

          <td
            className={`py-2.5 px-4 text-right font-mono font-bold ${
              level === 0 ? 'text-emerald-400' : 'text-emerald-600'
            }`}
          >
            ₹{formatCr(node.actualsYTD, 2)}
          </td>

          <td
            className={`py-2.5 px-4 text-right font-mono font-bold ${
              level === 0
                ? isOver
                  ? 'text-rose-300'
                  : 'text-indigo-300'
                : isOver
                ? 'text-rose-600'
                : 'text-indigo-600'
            }`}
          >
            {variance > 0 ? '+' : ''}₹{formatCr(variance, 2)}
          </td>

          <td className="py-2.5 px-4 text-right font-mono font-black">
            <span
              className={`px-2 py-0.5 rounded text-[10px] ${
                level === 0
                  ? 'bg-white/10 text-white'
                  : util > 100
                  ? 'bg-rose-100 text-rose-800'
                  : util > 80
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {util.toFixed(1)}%
            </span>
          </td>
        </tr>
        {isExpanded && node.children.map(child => renderTree(child, level + 1))}
      </React.Fragment>
    );
  };

  const overallVariance = treeData.actualsYTD - treeData.budget;
  const overallUtil = treeData.budget > 0 ? (treeData.actualsYTD / treeData.budget) * 100 : 0;
  const isBudgetFullYear = budgetAsOfIndex >= months.length - 1;
  const isActualsFullYear = asOfIndex >= months.length - 1;
  const hasDifferentFullYearActuals = Math.abs(treeData.actualsFullYear - treeData.actualsYTD) > 0.01;

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 p-5 shadow-sm space-y-4 animate-fadeIn">
      {/* Unified Executive Control Strip: Horizon Capsule + Context View Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 border border-slate-200/80 px-3.5 py-2 rounded-2xl">
        {/* Left: Unified Budget & Actuals Horizon Capsule */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-700 pr-2 border-r border-slate-200">
            <Calendar size={14} className="text-indigo-600 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider">Horizon</span>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1">
            <span className="text-[9px] font-black uppercase text-blue-600">Budget:</span>
            <select
              value={budgetAsOfIndex}
              onChange={e => handleBudgetHorizonChange(Number(e.target.value))}
              className="bg-transparent text-[11px] font-bold text-slate-800 outline-none cursor-pointer"
            >
              {months.map((m, idx) => (
                <option key={idx} value={idx}>
                  Up to {m} ({idx + 1}M)
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={toggleSyncHorizons}
            title={
              syncHorizons
                ? 'Horizons synced (click to set Budget & Actuals horizons independently)'
                : 'Horizons independent (click to sync Budget & Actuals to same month)'
            }
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-colors cursor-pointer ${
              syncHorizons
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                : 'bg-slate-200/70 text-slate-500 hover:text-slate-800'
            }`}
          >
            {syncHorizons ? <Link2 size={11} /> : <Link2Off size={11} />}
            {syncHorizons ? 'Synced' : 'Unlinked'}
          </button>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1">
            <span className="text-[9px] font-black uppercase text-emerald-600">Actuals:</span>
            <select
              value={asOfIndex}
              onChange={e => handleActualsHorizonChange(Number(e.target.value))}
              className="bg-transparent text-[11px] font-bold text-slate-800 outline-none cursor-pointer"
            >
              {months.map((m, idx) => (
                <option key={idx} value={idx}>
                  Up to {m} ({idx + 1}M)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Context-Specific Controls (No duplicate search or scope filters) */}
        <div className="flex flex-wrap items-center gap-2">
          {!activeSubView && (
            <div className="flex bg-white p-0.5 rounded-xl border border-slate-200">
              {(
                [
                  { id: 'table', label: 'Variance Table' },
                  { id: 'burndown', label: 'Burn-Down Chart' },
                  { id: 'dept_charts', label: 'Dept & Family Charts' }
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubView(tab.id)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                    subView === tab.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {subView === 'table' && (
            <>
              {/* Presence Filter */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'both', label: 'Both' },
                    { id: 'budget_only', label: 'Budget Only' },
                    { id: 'actuals_only', label: 'Actuals Only' }
                  ] as const
                ).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPresenceFilter(opt.id)}
                    className={`px-2 py-1 rounded-md text-[9px] font-black uppercase transition-colors ${
                      presenceFilter === opt.id
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* View Depth */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                {(
                  [
                    { level: 1, label: 'Depts' },
                    { level: 2, label: 'Families' },
                    { level: 3, label: 'Projects' }
                  ] as const
                ).map(item => (
                  <button
                    key={item.level}
                    type="button"
                    onClick={() => expandToLevel(item.level)}
                    className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-colors ${
                      treeDepth === item.level
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {subView === 'burndown' && (
            <div className="flex bg-white p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setBurnChartMode('burndown')}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                  burnChartMode === 'burndown'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingDown size={12} />
                Burn-Down (Remaining Budget)
              </button>
              <button
                type="button"
                onClick={() => setBurnChartMode('burnup')}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                  burnChartMode === 'burnup'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp size={12} />
                Cumulative Burn-Up (Spend)
              </button>
            </div>
          )}

          {subView === 'dept_charts' && (
            <>
              <div className="flex bg-white p-0.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setChartGroupBy('department')}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                    chartGroupBy === 'department'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  By Department
                </button>
                <button
                  type="button"
                  onClick={() => setChartGroupBy('family')}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                    chartGroupBy === 'family'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  By Product Family
                </button>
              </div>

              <div className="flex bg-white p-0.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setDeptChartMode('burndown')}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                    deptChartMode === 'burndown'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Cumulative Burn-Down
                </button>
                <button
                  type="button"
                  onClick={() => setDeptChartMode('standard')}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                    deptChartMode === 'standard'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Periodic Bars
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 3 Non-Redundant Executive KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Card 1: Planned Budget */}
        <div className="bg-slate-50/70 border border-slate-200/80 px-4 py-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">
              {isBudgetFullYear
                ? `Planned Budget (${months.length} Mos)`
                : `Budget YTD (Up to ${months[budgetAsOfIndex]} · ${budgetAsOfIndex + 1}M)`}
            </span>
            <span className="text-[9px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
              {treeData.inBudgetCount}/{treeData.projectCount} in Budget
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 my-1">
            ₹{formatCr(treeData.budget, 2)} Cr
          </div>
          <div className="text-[10px] text-slate-500 font-semibold flex items-center justify-between">
            <span>Full Year (12M) Ceiling:</span>
            <span className="font-mono font-bold text-slate-700">₹{formatCr(treeData.budgetFullYear, 2)} Cr</span>
          </div>
        </div>

        {/* Card 2: Actual Spend (Combines YTD + Manpower/Expense Breakdown without a duplicate card) */}
        <div className="bg-emerald-50/40 border border-emerald-200/80 px-4 py-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
              {isActualsFullYear
                ? `Actual Spend (${months.length} Mos)`
                : `Actual Spend (Up to ${months[asOfIndex]} · ${asOfIndex + 1}M)`}
            </span>
            <span className="text-[9px] font-bold text-emerald-700 bg-white border border-emerald-200 px-2 py-0.5 rounded-full">
              {treeData.inActualsCount}/{treeData.projectCount} in Actuals
            </span>
          </div>
          <div className="flex items-baseline gap-2 my-1">
            <span className="text-2xl font-black font-mono text-emerald-700">
              ₹{formatCr(treeData.actualsYTD, 2)} Cr
            </span>
            {hasDifferentFullYearActuals && (
              <span className="text-[10px] font-mono font-bold text-slate-500">
                (Full FY: ₹{formatCr(treeData.actualsFullYear, 2)} Cr)
              </span>
            )}
          </div>
          <div className="text-[10px] text-emerald-700 font-semibold flex items-center justify-between">
            <span>Manpower: ₹{formatCr(treeData.actualsManpowerCr, 2)} Cr</span>
            <span>Expense: ₹{formatCr(treeData.actualsExpenseCr, 2)} Cr</span>
          </div>
        </div>

        {/* Card 3: Net Variance & Utilization */}
        <div
          className={`px-4 py-3.5 rounded-2xl border flex flex-col justify-between ${
            overallVariance > 0.001
              ? 'bg-rose-50/40 border-rose-200'
              : 'bg-indigo-50/40 border-indigo-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[10px] font-black uppercase tracking-wider ${
                overallVariance > 0.001 ? 'text-rose-600' : 'text-indigo-600'
              }`}
            >
              Variance ({months[asOfIndex]} vs {months[budgetAsOfIndex]})
            </span>
            <span
              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                overallVariance > 0.001
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              {overallUtil.toFixed(1)}% Utilized
            </span>
          </div>
          <div
            className={`text-2xl font-black font-mono my-1 ${
              overallVariance > 0.001 ? 'text-rose-700' : 'text-indigo-700'
            }`}
          >
            {overallVariance > 0 ? '+' : ''}₹{formatCr(overallVariance, 2)} Cr
          </div>
          <div className="w-full bg-white/80 h-1.5 rounded-full overflow-hidden border border-slate-200/60">
            <div
              className={`h-full rounded-full transition-all ${
                overallUtil > 100 ? 'bg-rose-500' : overallUtil > 85 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, overallUtil))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content Area by Sub-View */}
      {subView === 'table' ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <th className="py-3 px-4 font-black">
                  Hierarchy (Overall {'>'} Dept {'>'} Product Family {'>'} Project)
                </th>
                <th className="py-3 px-3 font-black text-center">In Budget</th>
                <th className="py-3 px-3 font-black text-center">In Actuals</th>
                <th className="py-3 px-4 font-black text-center">Projects</th>
                <th className="py-3 px-4 font-black text-right">
                  Budget {isBudgetFullYear ? '(12M)' : `(${months[budgetAsOfIndex]})`} (₹ Cr)
                </th>
                <th className="py-3 px-4 font-black text-right">
                  Actuals {isActualsFullYear ? '(12M)' : `(${months[asOfIndex]})`} (₹ Cr)
                </th>
                <th className="py-3 px-4 font-black text-right">Variance (₹ Cr)</th>
                <th className="py-3 px-4 font-black text-right">Utilization %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {renderTree(treeData)}
            </tbody>
          </table>
        </div>
      ) : subView === 'burndown' ? (
        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                {burnChartMode === 'burndown' ? (
                  <TrendingDown size={15} className="text-emerald-600" />
                ) : (
                  <TrendingUp size={15} className="text-indigo-600" />
                )}
                {burnChartMode === 'burndown'
                  ? 'Portfolio Budget Burn-Down Trajectory (Remaining Budget vs Ideal Glidepath)'
                  : 'Cumulative Budget vs Actuals Burn-Up Trajectory'}
              </h4>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                {burnChartMode === 'burndown'
                  ? `Starting from ₹${monthlyBurnData.totalAnnualBudget.toFixed(2)} Cr Annual Budget — Remaining: ₹${(monthlyBurnData.totalAnnualBudget - monthlyBurnData.totalActualsYTD).toFixed(2)} Cr (Avg burn: ₹${(monthlyBurnData.avgMonthlyActualBurn || 0).toFixed(2)} Cr/mo)`
                  : `Cumulative month-on-month spend up to ${months[monthlyBurnData.activeActualMonthIdx] || 'Latest'} (${treeData.projectCount} filtered projects)`}
              </p>
            </div>
          </div>

          <div className="h-[430px] w-full bg-white p-4 rounded-xl border border-slate-200/80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={monthlyBurnData.points}
                margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="burnDownActualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="burnUpActualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#475569', fontWeight: 700 }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#475569' }}
                  unit="Cr"
                />
                <Tooltip
                  formatter={(val: any, name: string) => [
                    val !== null && val !== undefined ? `₹${Number(val).toFixed(2)} Cr` : '—',
                    name
                  ]}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '12px', fontSize: '11px', fontWeight: 'bold' }}
                />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />

                {burnChartMode === 'burndown' ? (
                  <>
                    <Bar
                      dataKey="MonthlyActuals"
                      name="Monthly Actual Burn"
                      fill="#cbd5e1"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={28}
                    />
                    <Line
                      type="monotone"
                      dataKey="PlannedRemaining"
                      name="Planned Budget Burn-Down (Ideal)"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      dot={{ r: 3.5, fill: '#3b82f6' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="ActualRemaining"
                      name="Actual Remaining Budget (Burn-Down)"
                      stroke="#10b981"
                      strokeWidth={3.5}
                      fill="url(#burnDownActualGrad)"
                      dot={{ r: 4.5, fill: '#10b981', stroke: '#fff', strokeWidth: 1.5 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="ProjectedRemaining"
                      name="Projected Year-End Burn-Down (Run Rate)"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      strokeDasharray="4 4"
                      dot={{ r: 3.5, fill: '#f59e0b' }}
                      connectNulls={false}
                    />
                  </>
                ) : (
                  <>
                    <ReferenceLine
                      y={Number(monthlyBurnData.totalAnnualBudget.toFixed(2))}
                      stroke="#ef4444"
                      strokeDasharray="5 5"
                      label={{
                        value: `Annual Budget Ceiling: ₹${monthlyBurnData.totalAnnualBudget.toFixed(2)} Cr`,
                        position: 'insideTopLeft',
                        fill: '#ef4444',
                        fontSize: 10,
                        fontWeight: 700
                      }}
                    />
                    <Bar
                      dataKey="MonthlyBudget"
                      name="Monthly Budget"
                      fill="#93c5fd"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={22}
                    />
                    <Bar
                      dataKey="MonthlyActuals"
                      name="Monthly Actuals"
                      fill="#6ee7b7"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={22}
                    />
                    <Line
                      type="monotone"
                      dataKey="CumulativeBudget"
                      name="Cumulative Planned Budget"
                      stroke="#2563eb"
                      strokeWidth={3}
                      strokeDasharray="6 4"
                      dot={{ r: 3.5, fill: '#2563eb' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="CumulativeActuals"
                      name="Cumulative Actual Spend (YTD)"
                      stroke="#059669"
                      strokeWidth={3.5}
                      fill="url(#burnUpActualGrad)"
                      dot={{ r: 4.5, fill: '#059669', stroke: '#fff', strokeWidth: 1.5 }}
                      connectNulls={false}
                    />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200 space-y-3">
          <div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              {deptChartMode === 'burndown'
                ? `Cumulative Burn-Down & Spend by ${chartGroupBy === 'department' ? 'Department' : 'Product Family'}`
                : `Budget (${months[budgetAsOfIndex]}) vs Actuals (${months[asOfIndex]}) by ${chartGroupBy === 'department' ? 'Department' : 'Product Family'}`}
            </h4>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {deptChartMode === 'burndown'
                ? 'Individual category bars alongside cumulative spend and remaining portfolio budget burn-down'
                : 'Direct side-by-side comparison with utilization percentage'}
            </p>
          </div>

          <div className="h-[440px] w-full bg-white p-4 rounded-xl border border-slate-200/80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                  height={70}
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} unit="Cr" />
                {deptChartMode === 'standard' && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10, fill: '#f59e0b' }}
                    unit="%"
                    domain={[0, 150]}
                  />
                )}
                <Tooltip
                  formatter={(val: any, name: string) => [
                    name === 'Utilization %'
                      ? `${Number(val).toFixed(1)}%`
                      : `₹${Number(val).toFixed(2)} Cr`,
                    name
                  ]}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '15px', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="Budget"
                  name={`Budget (${months[budgetAsOfIndex]})`}
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={42}
                />
                <Bar
                  yAxisId="left"
                  dataKey="ActualsYTD"
                  name={`Actuals (${months[asOfIndex]})`}
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={42}
                />
                {deptChartMode === 'burndown' ? (
                  <>
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="RemainingBudgetBurnDown"
                      name="Remaining Budget Burn-Down"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={{ r: 4.5, fill: '#f59e0b', stroke: '#fff', strokeWidth: 1.5 }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="CumulativeActuals"
                      name="Cumulative Actuals Spent"
                      stroke="#059669"
                      strokeWidth={2.5}
                      strokeDasharray="5 4"
                      dot={{ r: 3.5, fill: '#059669' }}
                    />
                  </>
                ) : (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Utilization"
                    name="Utilization %"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
