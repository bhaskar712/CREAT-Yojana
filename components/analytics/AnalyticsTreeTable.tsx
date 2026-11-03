import React, { useState, useMemo, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Search, 
  Maximize2, 
  Minimize2, 
  Briefcase, 
  Folder, 
  FolderOpen, 
  Layers, 
  TrendingUp, 
  Users, 
  UserPlus, 
  CreditCard, 
  Filter,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  SlidersHorizontal,
  ArrowUpDown
} from 'lucide-react';
import { AnalyticsTreeNode, TreeSortField, TreeSortOrder } from './types';
import { filterAnalyticsTree, sortAnalyticsTree, TOP_CATEGORIES } from './treeBuilder';
import { FiscalMode } from '../../types';
import { ProjectDetailDrawer } from './ProjectDetailDrawer';

interface AnalyticsTreeTableProps {
  tree: AnalyticsTreeNode[];
  months: string[];
  selectedModes: FiscalMode[];
  toggleMode: (mode: FiscalMode) => void;
  totalsLookup?: Record<string, any>;
}

export const AnalyticsTreeTable: React.FC<AnalyticsTreeTableProps> = ({
  tree,
  months,
  selectedModes,
  toggleMode
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    // Default: categories (Level 1) expanded so subcategories are visible
    return new Set<string>(TOP_CATEGORIES.map(c => `cat:${c}`));
  });
  const [sortBy, setSortBy] = useState<TreeSortField>('name');
  const [sortOrder, setSortOrder] = useState<TreeSortOrder>('asc');
  const [selectedProject, setSelectedProject] = useState<AnalyticsTreeNode | null>(null);

  // Compute Grand Totals across all top categories for each selected mode
  const portfolioGrandTotals = useMemo(() => {
    const totals: Record<FiscalMode, {
      manpowerMM: number;
      manpowerCr: number;
      expenseCr: number;
      totalCr: number;
      budgetCr: number;
      newMM: number;
      carryOverMM: number;
    }> = {
      Budget: { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0, newMM: 0, carryOverMM: 0 },
      Actuals: { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0, newMM: 0, carryOverMM: 0 },
      Forecast: { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0, newMM: 0, carryOverMM: 0 },
      Variance: { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0, newMM: 0, carryOverMM: 0 },
      PMO_Budget: { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0, newMM: 0, carryOverMM: 0 }
    };

    tree.forEach(cat => {
      selectedModes.forEach(m => {
        const cm = cat.metrics[m];
        if (cm) {
          totals[m].manpowerMM += cm.manpowerMM;
          totals[m].manpowerCr += cm.manpowerCr;
          totals[m].expenseCr += cm.expenseCr;
          totals[m].totalCr += cm.totalCr;
          totals[m].budgetCr += cm.budgetCr;
          totals[m].newMM += cm.newMM;
          totals[m].carryOverMM += cm.carryOverMM;
        }
      });
    });

    return totals;
  }, [tree, selectedModes]);

  // Apply search filtering
  const { filteredTree, matchedIds } = useMemo(() => {
    return filterAnalyticsTree(tree, searchQuery);
  }, [tree, searchQuery]);

  // Auto-expand nodes when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedNodes(new Set(matchedIds));
    }
  }, [searchQuery, matchedIds]);

  // Apply sorting
  const processedTree = useMemo(() => {
    return sortAnalyticsTree(filteredTree, sortBy, sortOrder, selectedModes[0] || 'Budget');
  }, [filteredTree, sortBy, sortOrder, selectedModes]);

  // Expand / Collapse toggles
  const toggleNode = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: AnalyticsTreeNode[]) => {
      nodes.forEach(n => {
        if (n.children && n.children.length > 0) {
          allIds.add(n.id);
          collectIds(n.children);
        }
      });
    };
    collectIds(tree);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const expandToLevel = (targetLevel: number) => {
    const newSet = new Set<string>();
    const collect = (nodes: AnalyticsTreeNode[]) => {
      nodes.forEach(n => {
        if (n.level < targetLevel && n.children && n.children.length > 0) {
          newSet.add(n.id);
          collect(n.children);
        }
      });
    };
    collect(tree);
    setExpandedNodes(newSet);
  };

  // Helper to highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} className="bg-yellow-200 text-slate-900 rounded px-0.5 font-black">{part}</span>
      ) : part
    );
  };

  // Flatten tree into visible rows based on expandedNodes state
  const visibleRows = useMemo(() => {
    const rows: { node: AnalyticsTreeNode; depth: number }[] = [];

    const traverse = (nodes: AnalyticsTreeNode[], depth: number) => {
      nodes.forEach(node => {
        rows.push({ node, depth });
        if (expandedNodes.has(node.id) && node.children && node.children.length > 0) {
          traverse(node.children, depth + 1);
        }
      });
    };

    traverse(processedTree, 0);
    return rows;
  }, [processedTree, expandedNodes]);

  const numMonths = months.length || 1;
  const primaryMode = selectedModes[0] || 'Budget';
  const isComparingBudgetActuals = selectedModes.includes('Budget') && selectedModes.includes('Actuals');

  return (
    <div className="space-y-4">
      {/* Top Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {selectedModes.map(modeVal => {
          const t = portfolioGrandTotals[modeVal];
          const isBudget = modeVal === 'Budget';
          const isActuals = modeVal === 'Actuals';
          const accentColor = isBudget ? 'text-blue-600' : isActuals ? 'text-emerald-600' : 'text-purple-600';
          const borderTop = isBudget ? 'border-t-blue-500' : isActuals ? 'border-t-emerald-500' : 'border-t-purple-500';

          return (
            <div key={`kpi-${modeVal}`} className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-200 border-t-4 ${borderTop}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {modeVal} Portfolio Total
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                  isBudget ? 'bg-blue-50 text-blue-700' : isActuals ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'
                }`}>
                  {modeVal}
                </span>
              </div>
              <p className={`text-2xl font-black font-mono tracking-tight mt-2 ${accentColor}`}>
                ₹ {t.totalCr.toFixed(2)} <span className="text-xs font-sans text-slate-500">Cr</span>
              </p>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-2 pt-2 border-t border-slate-100">
                <span>Effort: <strong className="text-slate-800">{t.manpowerMM.toFixed(2)} MM</strong></span>
                <span>Expenses: <strong className="text-slate-800">₹ {t.expenseCr.toFixed(2)} Cr</strong></span>
              </div>
            </div>
          );
        })}

        {isComparingBudgetActuals && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 border-t-4 border-t-indigo-500">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Actuals vs Budget Variance
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                portfolioGrandTotals['Actuals'].totalCr <= portfolioGrandTotals['Budget'].totalCr
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}>
                {portfolioGrandTotals['Actuals'].totalCr <= portfolioGrandTotals['Budget'].totalCr ? 'Favorable' : 'Over Budget'}
              </span>
            </div>
            {(() => {
              const delta = portfolioGrandTotals['Actuals'].totalCr - portfolioGrandTotals['Budget'].totalCr;
              const pct = portfolioGrandTotals['Budget'].totalCr > 0 ? (delta / portfolioGrandTotals['Budget'].totalCr) * 100 : 0;
              return (
                <>
                  <p className={`text-2xl font-black font-mono tracking-tight mt-2 ${delta <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(2)} <span className="text-xs font-sans text-slate-500">Cr ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)</span>
                  </p>
                  <div className="text-[11px] font-mono text-slate-500 mt-2 pt-2 border-t border-slate-100">
                    Budget: ₹ {portfolioGrandTotals['Budget'].totalCr.toFixed(2)} Cr → Actuals: ₹ {portfolioGrandTotals['Actuals'].totalCr.toFixed(2)} Cr
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Tree Controls Toolbar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text"
              placeholder="Search tree by project, code (UMD-xxx), manager, vertical..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Level Selectors & Quick Actions */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex bg-slate-100 rounded-xl p-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
            <button 
              onClick={() => expandToLevel(1)} 
              className="px-2.5 py-1 rounded-lg hover:bg-white hover:text-slate-800 hover:shadow-xs transition-all"
              title="Only show Category headers"
            >
              L1: Categories
            </button>
            <button 
              onClick={() => expandToLevel(2)} 
              className="px-2.5 py-1 rounded-lg hover:bg-white hover:text-slate-800 hover:shadow-xs transition-all"
              title="Expand down to Subcategories"
            >
              L2: Subcategories
            </button>
            <button 
              onClick={() => expandToLevel(3)} 
              className="px-2.5 py-1 rounded-lg hover:bg-white hover:text-slate-800 hover:shadow-xs transition-all"
              title="Expand down to Projects"
            >
              L3: Projects
            </button>
            <button 
              onClick={() => expandToLevel(4)} 
              className="px-2.5 py-1 rounded-lg hover:bg-white hover:text-slate-800 hover:shadow-xs transition-all"
              title="Expand down to Skills & Expenses"
            >
              L4: Details
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button 
              onClick={expandAll}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
              title="Expand all tree levels"
            >
              <Maximize2 size={12} />
              Expand All
            </button>
            <button 
              onClick={collapseAll}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
              title="Collapse all tree levels"
            >
              <Minimize2 size={12} />
              Collapse All
            </button>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1 text-[10px] font-bold text-slate-600">
            <span className="px-2 text-slate-400 uppercase font-black text-[9px]">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as TreeSortField)}
              className="bg-white rounded-lg px-2 py-1 text-[10px] font-bold text-slate-800 border-none outline-none cursor-pointer"
            >
              <option value="name">Name (A-Z)</option>
              <option value="manpowerMM">Manpower (MM)</option>
              <option value="totalCr">Total (₹ Cr)</option>
              <option value="variance">Budget Variance</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-1 rounded bg-white hover:bg-slate-50 transition-colors text-slate-600"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              <ArrowUpDown size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Tree Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-[0.15em] font-black select-none">
                <th className="px-4 py-3.5 border-r border-white/10 min-w-[320px] sticky left-0 bg-slate-900 z-20">
                  <div className="flex items-center gap-2">
                    <span>Hierarchy Structure (Tree)</span>
                    <span className="text-[9px] font-mono text-slate-400 font-normal">
                      ({visibleRows.length} displayed)
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3.5 border-r border-white/10 text-right min-w-[90px]">MM</th>
                <th className="px-4 py-3.5 border-r border-white/10 text-right min-w-[110px]">People Cost</th>
                <th className="px-4 py-3.5 border-r border-white/10 text-right min-w-[70px]">% MM</th>
                <th className="px-4 py-3.5 border-r border-white/10 text-right min-w-[110px]">Expenses</th>
                <th className="px-4 py-3.5 border-r border-white/10 text-right min-w-[70px]">% Exp</th>
                <th className="px-4 py-3.5 border-r border-white/10 text-right min-w-[120px]">Grand Total</th>
                <th className="px-4 py-3.5 border-r border-white/10 text-right min-w-[100px]">Monthly Run</th>
                <th className="px-4 py-3.5 border-r border-white/10 text-right min-w-[70px]">% Portfolio</th>
                <th className="px-4 py-3.5 border-r border-white/10 text-center min-w-[90px]">Initiative</th>
                {isComparingBudgetActuals && (
                  <th className="px-4 py-3.5 text-right min-w-[130px] bg-indigo-950 text-indigo-200">
                    Variance (Act - Bud)
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="text-[12px] text-slate-700 divide-y divide-slate-100">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 font-medium">
                    No matching tree nodes found for query "{searchQuery}".
                  </td>
                </tr>
              ) : (
                visibleRows.map(({ node, depth }) => {
                  const hasChildren = node.children && node.children.length > 0;
                  const isExpanded = expandedNodes.has(node.id);

                  // Primary mode metric
                  const primaryMetric = node.metrics[primaryMode] || { manpowerMM: 0, manpowerCr: 0, expenseCr: 0, totalCr: 0, budgetCr: 0, newMM: 0, carryOverMM: 0 };
                  const grandTotalMode = portfolioGrandTotals[primaryMode] || { manpowerMM: 1, manpowerCr: 1, expenseCr: 1, totalCr: 1 };

                  const mmPct = grandTotalMode.manpowerMM > 0 ? (primaryMetric.manpowerMM / grandTotalMode.manpowerMM) * 100 : 0;
                  const expPct = grandTotalMode.expenseCr > 0 ? (primaryMetric.expenseCr / grandTotalMode.expenseCr) * 100 : 0;
                  const totalPct = grandTotalMode.totalCr > 0 ? (primaryMetric.totalCr / grandTotalMode.totalCr) * 100 : 0;

                  // Initiative breakdown
                  const newPct = primaryMetric.manpowerMM > 0 ? (primaryMetric.newMM / primaryMetric.manpowerMM) * 100 : 0;
                  const carryPct = primaryMetric.manpowerMM > 0 ? (primaryMetric.carryOverMM / primaryMetric.manpowerMM) * 100 : 0;

                  // Variance calculation
                  const budgetTotal = node.metrics['Budget']?.totalCr || 0;
                  const actualsTotal = node.metrics['Actuals']?.totalCr || 0;
                  const deltaCr = actualsTotal - budgetTotal;
                  const deltaPct = budgetTotal > 0 ? (deltaCr / budgetTotal) * 100 : 0;

                  // Row visual styling depending on level
                  const isCategory = node.level === 1;
                  const isSubcategory = node.level === 2;
                  const isProject = node.level === 3;
                  const isDetailGroup = node.level === 4;
                  const isDetailItem = node.level === 5;

                  const rowBg = isCategory 
                    ? 'bg-slate-50/90 hover:bg-slate-100/90 font-black text-slate-900 border-t-2 border-slate-200' 
                    : isSubcategory 
                    ? 'bg-slate-50/30 hover:bg-slate-100/60 font-bold text-slate-800' 
                    : isProject
                    ? 'hover:bg-blue-50/40 text-slate-800 font-medium'
                    : 'hover:bg-slate-50 text-slate-600 text-[11px]';

                  return (
                    <React.Fragment key={node.id}>
                      <tr 
                        className={`transition-colors border-b border-slate-100 ${rowBg}`}
                      >
                        {/* Tree Structure Column */}
                        <td className={`px-4 py-2 border-r border-slate-100 sticky left-0 z-10 ${
                          isCategory ? 'bg-slate-50' : 'bg-white'
                        }`}>
                          <div 
                            className="flex items-center gap-1.5"
                            style={{ paddingLeft: `${depth * 20}px` }}
                          >
                            {/* Indentation guide lines */}
                            {depth > 0 && (
                              <span className="text-slate-300 font-mono select-none mr-1">
                                └─
                              </span>
                            )}

                            {/* Expander Button */}
                            {hasChildren ? (
                              <button
                                onClick={() => toggleNode(node.id)}
                                className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors shrink-0"
                                title={isExpanded ? 'Collapse' : 'Expand'}
                              >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            ) : (
                              <span className="w-5 shrink-0" />
                            )}

                            {/* Node Type Icon */}
                            {isCategory && (
                              isExpanded ? <FolderOpen size={16} className="text-blue-600 shrink-0" /> : <Folder size={16} className="text-blue-600 shrink-0" />
                            )}
                            {isSubcategory && (
                              <Layers size={14} className="text-indigo-500 shrink-0" />
                            )}
                            {isProject && (
                              <Briefcase size={14} className="text-emerald-600 shrink-0" />
                            )}
                            {isDetailGroup && (
                              node.name.includes('Direct') ? <Users size={12} className="text-blue-500 shrink-0" /> :
                              node.name.includes('Contracted') ? <UserPlus size={12} className="text-indigo-500 shrink-0" /> :
                              <CreditCard size={12} className="text-orange-500 shrink-0" />
                            )}

                            {/* Node Name */}
                            <span 
                              className={`truncate max-w-[280px] ${
                                isProject ? 'cursor-pointer text-indigo-700 hover:underline font-bold' : ''
                              }`}
                              title={node.name}
                              onClick={isProject ? () => setSelectedProject(node) : undefined}
                            >
                              {highlightMatch(node.name, searchQuery)}
                            </span>

                            {/* Project Code Pill */}
                            {node.code && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                                {node.code}
                              </span>
                            )}

                            {/* Project Count Badge for Category & Subcategory */}
                            {(isCategory || isSubcategory) && node.itemCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-200/70 text-slate-600 shrink-0">
                                {node.itemCount} proj
                              </span>
                            )}

                            {/* Initiative Badge */}
                            {isProject && (
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shrink-0 ${
                                node.isNew ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {node.isNew ? 'New' : 'Carry'}
                              </span>
                            )}

                            {/* Details Drawer Trigger Icon */}
                            {isProject && (
                              <button 
                                onClick={() => setSelectedProject(node)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition-opacity ml-1"
                                title="View Project Analytics Detail"
                              >
                                <ExternalLink size={12} />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Manpower MM */}
                        <td className="px-4 py-2 border-r border-slate-100 text-right font-mono text-[12px]">
                          {primaryMetric.manpowerMM.toFixed(2)}
                        </td>

                        {/* People Cost (₹ Cr) */}
                        <td className="px-4 py-2 border-r border-slate-100 text-right font-mono text-[12px]">
                          ₹ {primaryMetric.manpowerCr.toFixed(2)}
                        </td>

                        {/* % MM */}
                        <td className="px-4 py-2 border-r border-slate-100 text-right font-mono text-[10px] text-slate-400">
                          {mmPct.toFixed(1)}%
                        </td>

                        {/* Expenses (₹ Cr) */}
                        <td className="px-4 py-2 border-r border-slate-100 text-right font-mono text-[12px]">
                          ₹ {primaryMetric.expenseCr.toFixed(2)}
                        </td>

                        {/* % Exp */}
                        <td className="px-4 py-2 border-r border-slate-100 text-right font-mono text-[10px] text-slate-400">
                          {expPct.toFixed(1)}%
                        </td>

                        {/* Grand Total (₹ Cr) */}
                        <td className={`px-4 py-2 border-r border-slate-100 text-right font-mono font-bold text-[12px] ${
                          isCategory ? 'text-slate-900 font-black text-sm' : 'text-slate-800'
                        }`}>
                          ₹ {primaryMetric.totalCr.toFixed(2)}
                        </td>

                        {/* Monthly Average */}
                        <td className="px-4 py-2 border-r border-slate-100 text-right font-mono text-[11px] text-slate-500">
                          ₹ {(primaryMetric.totalCr / numMonths).toFixed(2)}
                        </td>

                        {/* % Total Portfolio */}
                        <td className="px-4 py-2 border-r border-slate-100 text-right font-mono text-[10px] text-slate-400 font-bold">
                          {totalPct.toFixed(1)}%
                        </td>

                        {/* Initiative Breakdown (New vs Carry) */}
                        <td className="px-4 py-2 border-r border-slate-100 text-center font-mono text-[11px]">
                          {primaryMetric.manpowerMM > 0 ? (
                            <div className="flex items-center justify-center gap-1.5 text-[10px]">
                              {newPct > 0 && <span className="text-blue-600 font-bold">{newPct.toFixed(0)}% N</span>}
                              {newPct > 0 && carryPct > 0 && <span className="text-slate-300">•</span>}
                              {carryPct > 0 && <span className="text-amber-600 font-bold">{carryPct.toFixed(0)}% C</span>}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Variance Column (Budget vs Actuals) */}
                        {isComparingBudgetActuals && (
                          <td className="px-4 py-2 text-right font-mono text-[11px]">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              deltaCr <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              {deltaCr >= 0 ? '+' : ''}{deltaCr.toFixed(2)} ({deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%)
                            </span>
                          </td>
                        )}
                      </tr>

                      {/* If multiple modes selected and not detail items, render secondary mode rows if requested */}
                      {selectedModes.length > 1 && isCategory && selectedModes.slice(1).map(secMode => {
                        const secMetric = node.metrics[secMode];
                        const secGrand = portfolioGrandTotals[secMode];
                        if (!secMetric || !secGrand) return null;

                        return (
                          <tr key={`${node.id}-${secMode}`} className="bg-slate-50/40 text-[11px] text-slate-500 border-b border-slate-100">
                            <td className="px-4 py-1.5 border-r border-slate-100 sticky left-0 bg-slate-50/40 pl-12 font-bold flex items-center gap-2">
                              <span className="text-[9px] font-black uppercase text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                                {secMode}
                              </span>
                              <span className="text-slate-500">{node.name}</span>
                            </td>
                            <td className="px-4 py-1 border-r border-slate-100 text-right font-mono">{secMetric.manpowerMM.toFixed(2)}</td>
                            <td className="px-4 py-1 border-r border-slate-100 text-right font-mono">₹ {secMetric.manpowerCr.toFixed(2)}</td>
                            <td className="px-4 py-1 border-r border-slate-100 text-right font-mono text-[10px]">
                              {secGrand.manpowerMM > 0 ? ((secMetric.manpowerMM / secGrand.manpowerMM) * 100).toFixed(1) : 0}%
                            </td>
                            <td className="px-4 py-1 border-r border-slate-100 text-right font-mono">₹ {secMetric.expenseCr.toFixed(2)}</td>
                            <td className="px-4 py-1 border-r border-slate-100 text-right font-mono text-[10px]">
                              {secGrand.expenseCr > 0 ? ((secMetric.expenseCr / secGrand.expenseCr) * 100).toFixed(1) : 0}%
                            </td>
                            <td className="px-4 py-1 border-r border-slate-100 text-right font-mono font-bold text-slate-800">₹ {secMetric.totalCr.toFixed(2)}</td>
                            <td className="px-4 py-1 border-r border-slate-100 text-right font-mono">₹ {(secMetric.totalCr / numMonths).toFixed(2)}</td>
                            <td className="px-4 py-1 border-r border-slate-100 text-right font-mono text-[10px]">
                              {secGrand.totalCr > 0 ? ((secMetric.totalCr / secGrand.totalCr) * 100).toFixed(1) : 0}%
                            </td>
                            <td className="px-4 py-1 border-r border-slate-100 text-center">-</td>
                            {isComparingBudgetActuals && <td className="px-4 py-1" />}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}

              {/* Grand Total Rows for each selected mode */}
              {selectedModes.map(modeVal => {
                const total = portfolioGrandTotals[modeVal];
                const isBudget = modeVal === 'Budget';
                const isActuals = modeVal === 'Actuals';
                const accentColor = isBudget ? 'text-blue-400' : isActuals ? 'text-emerald-400' : 'text-purple-400';
                const borderLeft = isBudget ? 'border-l-blue-500' : isActuals ? 'border-l-emerald-500' : 'border-l-purple-500';

                return (
                  <tr 
                    key={`grand-total-${modeVal}`}
                    className={`bg-slate-900 text-white font-black border-t-2 border-slate-800 border-l-[6px] ${borderLeft}`}
                  >
                    <td className="px-4 py-3.5 border-r border-white/20 uppercase tracking-[0.15em] text-[11px] sticky left-0 bg-slate-900 z-20">
                      Portfolio Grand Total ({modeVal})
                    </td>
                    <td className="px-4 py-3.5 border-r border-white/20 text-right font-mono text-sm">{total.manpowerMM.toFixed(2)}</td>
                    <td className="px-4 py-3.5 border-r border-white/20 text-right font-mono text-sm">₹ {total.manpowerCr.toFixed(2)}</td>
                    <td className="px-4 py-3.5 border-r border-white/20 text-right font-mono text-sm opacity-50">100%</td>
                    <td className="px-4 py-3.5 border-r border-white/20 text-right font-mono text-sm">₹ {total.expenseCr.toFixed(2)}</td>
                    <td className="px-4 py-3.5 border-r border-white/20 text-right font-mono text-sm opacity-50">100%</td>
                    <td className={`px-4 py-3.5 border-r border-white/20 text-right font-mono text-base ${accentColor}`}>
                      ₹ {total.totalCr.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 border-r border-white/20 text-right font-mono text-sm opacity-60">
                      ₹ {(total.totalCr / numMonths).toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 border-r border-white/20 text-right font-mono text-sm opacity-50">100%</td>
                    <td className="px-4 py-3.5 border-r border-white/20 text-center font-mono text-[11px]">
                      {total.manpowerMM > 0 ? `${((total.newMM / total.manpowerMM) * 100).toFixed(0)}% N` : '-'}
                    </td>
                    {isComparingBudgetActuals && (
                      <td className="px-4 py-3.5 text-right font-mono text-sm bg-indigo-950 text-indigo-300">
                        {modeVal === 'Actuals' ? (
                          (() => {
                            const diff = portfolioGrandTotals['Actuals'].totalCr - portfolioGrandTotals['Budget'].totalCr;
                            return `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} Cr`;
                          })()
                        ) : '-'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project Detail Slide-over Drawer */}
      <ProjectDetailDrawer 
        node={selectedProject} 
        onClose={() => setSelectedProject(null)} 
        months={months} 
        selectedModes={selectedModes} 
      />
    </div>
  );
};
