import React, { useState } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Maximize2, 
  Minimize2, 
  Folder, 
  FolderOpen, 
  Layers, 
  Briefcase, 
  Calendar,
  Layers as LayersIcon,
  Users
} from 'lucide-react';
import { AnalyticsTreeNode } from './types';
import { FiscalMode } from '../../types';

interface AnalyticsTreeMonthlyProps {
  tree: AnalyticsTreeNode[];
  months: string[];
  selectedModes: FiscalMode[];
  renderFunctionalSkillsView?: () => React.ReactNode;
  viewMode?: 'tabular' | 'graphical';
  setViewMode?: (m: 'tabular' | 'graphical') => void;
}

export const AnalyticsTreeMonthly: React.FC<AnalyticsTreeMonthlyProps> = ({
  tree,
  months,
  selectedModes,
  renderFunctionalSkillsView,
  viewMode = 'tabular',
  setViewMode
}) => {
  const [monthlyViewType, setMonthlyViewType] = useState<'functional' | 'tree'>('functional');
  const [metricUnit, setMetricUnit] = useState<'cost' | 'manpower'>('cost'); // 'cost' (₹ Cr) or 'manpower' (MM)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    // Default categories expanded
    return new Set<string>(tree.map(t => t.id));
  });

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    const collect = (nodes: AnalyticsTreeNode[]) => {
      nodes.forEach(n => {
        if (n.children && n.children.length > 0) {
          all.add(n.id);
          collect(n.children);
        }
      });
    };
    collect(tree);
    setExpandedNodes(all);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Flatten visible tree nodes
  const visibleRows: { node: AnalyticsTreeNode; depth: number }[] = [];
  const traverse = (nodes: AnalyticsTreeNode[], depth: number) => {
    nodes.forEach(node => {
      // Show categories, subcategories, and projects in monthly tree
      if (node.level <= 3) {
        visibleRows.push({ node, depth });
        if (expandedNodes.has(node.id) && node.children && node.children.length > 0) {
          traverse(node.children, depth + 1);
        }
      }
    });
  };
  traverse(tree, 0);

  const formatVal = (v: number) => {
    if (metricUnit === 'cost') return `₹ ${v.toFixed(2)}`;
    return v.toFixed(2);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Consolidated Budget (Monthly)
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Month-by-month consolidated manpower (MM), people cost, operational expenses, and total budget across fiscal periods
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Type Toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1 shadow-inner border border-slate-200/60">
            <button
              onClick={() => setMonthlyViewType('functional')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                monthlyViewType === 'functional' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users size={12} />
              Consolidated Budget (Monthly)
            </button>
            <button
              onClick={() => setMonthlyViewType('tree')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                monthlyViewType === 'tree' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayersIcon size={12} />
              Tree-Wise Monthly Burn
            </button>
          </div>

          {monthlyViewType === 'functional' && setViewMode && (
            <div className="flex bg-slate-100 rounded-xl p-1 text-[10px] font-bold text-slate-600 border border-slate-200/60">
              <button
                onClick={() => setViewMode('tabular')}
                className={`px-2.5 py-1 rounded-lg uppercase tracking-wider transition-all ${
                  viewMode === 'tabular' ? 'bg-white text-indigo-700 shadow-xs font-black' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode('graphical')}
                className={`px-2.5 py-1 rounded-lg uppercase tracking-wider transition-all ${
                  viewMode === 'graphical' ? 'bg-white text-indigo-700 shadow-xs font-black' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Charts
              </button>
            </div>
          )}

          {monthlyViewType === 'tree' && (
            <>
              {/* Metric Unit Toggle */}
              <div className="flex bg-slate-100 rounded-xl p-1 text-[10px] font-bold text-slate-600">
                <button
                  onClick={() => setMetricUnit('cost')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    metricUnit === 'cost' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500'
                  }`}
                >
                  Cost (₹ Cr)
                </button>
                <button
                  onClick={() => setMetricUnit('manpower')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    metricUnit === 'manpower' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500'
                  }`}
                >
                  Effort (MM)
                </button>
              </div>

              {/* Expand / Collapse All */}
              <div className="flex items-center gap-1">
                <button
                  onClick={expandAll}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                  title="Expand All"
                >
                  <Maximize2 size={13} />
                </button>
                <button
                  onClick={collapseAll}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                  title="Collapse All"
                >
                  <Minimize2 size={13} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Render selected monthly view */}
      {monthlyViewType === 'functional' && renderFunctionalSkillsView ? (
        renderFunctionalSkillsView()
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse font-sans">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-[0.15em] font-black">
                <th className="px-4 py-3 border-r border-white/10 min-w-[280px] sticky left-0 bg-slate-900 z-20">
                  Tree Node / Hierarchy
                </th>
                <th className="px-3 py-3 border-r border-white/10 text-center min-w-[70px]">Mode</th>
                {months.map(m => (
                  <th key={m} className="px-2.5 py-3 border-r border-white/10 text-right min-w-[80px]">
                    {m}
                  </th>
                ))}
                <th className="px-3.5 py-3 border-r border-white/10 text-right min-w-[95px] bg-slate-950">
                  Total
                </th>
                <th className="px-3 py-3 text-right min-w-[80px] bg-slate-950">
                  Avg / Mo
                </th>
              </tr>
            </thead>
            <tbody className="text-[11px] text-slate-700 divide-y divide-slate-100">
              {visibleRows.map(({ node, depth }) => {
                const hasChildren = node.children && node.children.some(c => c.level <= 3);
                const isExpanded = expandedNodes.has(node.id);
                const isCategory = node.level === 1;
                const isSubcategory = node.level === 2;
                const isProject = node.level === 3;

                return (
                  <React.Fragment key={node.id}>
                    {selectedModes.map((modeVal, mIdx) => {
                      const m = node.metrics[modeVal];
                      if (!m) return null;

                      const monthlyArr = metricUnit === 'cost' ? m.monthlyData : (m.monthlyManpowerMM || m.monthlyData);
                      const rowTotal = metricUnit === 'cost' ? m.totalCr : m.manpowerMM;
                      const rowAvg = rowTotal / (months.length || 1);

                      const rowBg = isCategory 
                        ? 'bg-slate-50 font-bold text-slate-900' 
                        : isSubcategory 
                        ? 'bg-slate-50/40 text-slate-800' 
                        : 'hover:bg-slate-50 text-slate-700';

                      return (
                        <tr 
                          key={`${node.id}-${modeVal}`}
                          className={`transition-colors border-b border-slate-100 ${rowBg}`}
                        >
                          {/* Tree Label (only render full label on first mode row) */}
                          <td className={`px-4 py-1.5 border-r border-slate-100 sticky left-0 z-10 ${
                            isCategory ? 'bg-slate-50' : 'bg-white'
                          }`}>
                            <div 
                              className="flex items-center gap-1.5"
                              style={{ paddingLeft: `${depth * 18}px` }}
                            >
                              {depth > 0 && <span className="text-slate-300 font-mono select-none">└─</span>}

                              {hasChildren && mIdx === 0 ? (
                                <button
                                  onClick={() => toggleNode(node.id)}
                                  className="p-1 rounded hover:bg-slate-200 text-slate-500 shrink-0"
                                >
                                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                </button>
                              ) : (
                                <span className="w-4 shrink-0" />
                              )}

                              {isCategory && (isExpanded ? <FolderOpen size={14} className="text-blue-600 shrink-0" /> : <Folder size={14} className="text-blue-600 shrink-0" />)}
                              {isSubcategory && <Layers size={13} className="text-indigo-500 shrink-0" />}
                              {isProject && <Briefcase size={13} className="text-emerald-600 shrink-0" />}

                              <span className="truncate max-w-[220px]" title={node.name}>
                                {node.name}
                              </span>

                              {node.code && (
                                <span className="px-1 py-0.2 rounded text-[8px] font-mono bg-slate-100 text-slate-600">
                                  {node.code}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Mode Pill */}
                          <td className="px-2 py-1.5 border-r border-slate-100 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                              modeVal === 'Budget' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                              modeVal === 'Actuals' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}>
                              {modeVal}
                            </span>
                          </td>

                          {/* Monthly Values */}
                          {months.map((_, i) => (
                            <td 
                              key={i} 
                              className="px-2 py-1.5 border-r border-slate-100 text-right font-mono text-[11px]"
                            >
                              {formatVal(monthlyArr[i] || 0)}
                            </td>
                          ))}

                          {/* Row Total */}
                          <td className="px-3 py-1.5 border-r border-slate-100 text-right font-mono font-black text-[12px] bg-slate-50/50">
                            {formatVal(rowTotal)}
                          </td>

                          {/* Row Average */}
                          <td className="px-3 py-1.5 text-right font-mono text-[11px] text-slate-500 bg-slate-50/50">
                            {formatVal(rowAvg)}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
