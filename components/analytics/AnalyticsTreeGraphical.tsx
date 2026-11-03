import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  LabelList 
} from 'recharts';
import { 
  ArrowRight, 
  TrendingUp, 
  Users, 
  UserPlus, 
  CreditCard, 
  Briefcase, 
  Layers, 
  ChevronRight,
  Folder
} from 'lucide-react';
import { AnalyticsTreeNode } from './types';
import { FiscalMode } from '../../types';

interface AnalyticsTreeGraphicalProps {
  tree: AnalyticsTreeNode[];
  selectedModes: FiscalMode[];
  months: string[];
}

const CATEGORY_COLORS: Record<string, string> = {
  'Projects': '#3b82f6',
  'Product Maintenance': '#10b981',
  'Project Support': '#f59e0b',
  'Organization Support': '#8b5cf6',
  'Others': '#94a3b8'
};

const PIE_COLORS = ['#3b82f6', '#6366f1', '#f59e0b', '#ec4899', '#10b981'];

export const AnalyticsTreeGraphical: React.FC<AnalyticsTreeGraphicalProps> = ({
  tree,
  selectedModes,
  months
}) => {
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null);
  const [drilldownSubcategory, setDrilldownSubcategory] = useState<string | null>(null);

  const primaryMode = selectedModes[0] || 'Budget';

  // Find active node based on drilldown
  const activeCategoryNode = useMemo(() => {
    if (!drilldownCategory) return null;
    return tree.find(c => c.name === drilldownCategory) || null;
  }, [tree, drilldownCategory]);

  const activeSubcategoryNode = useMemo(() => {
    if (!activeCategoryNode || !drilldownSubcategory) return null;
    return activeCategoryNode.children.find(s => s.name === drilldownSubcategory) || null;
  }, [activeCategoryNode, drilldownSubcategory]);

  // Current display items for the hierarchy bar chart
  const currentChartItems = useMemo(() => {
    if (activeSubcategoryNode) {
      // Display projects inside selected subcategory
      return activeSubcategoryNode.children.map(p => ({
        name: p.name,
        code: p.code,
        Budget: Number((p.metrics['Budget']?.totalCr || 0).toFixed(2)),
        Actuals: Number((p.metrics['Actuals']?.totalCr || 0).toFixed(2)),
        manpowerMM: Number((p.metrics[primaryMode]?.manpowerMM || 0).toFixed(2)),
        isProject: true,
        node: p
      }));
    }

    if (activeCategoryNode) {
      // Display subcategories inside selected category
      return activeCategoryNode.children.map(s => ({
        name: s.name,
        Budget: Number((s.metrics['Budget']?.totalCr || 0).toFixed(2)),
        Actuals: Number((s.metrics['Actuals']?.totalCr || 0).toFixed(2)),
        manpowerMM: Number((s.metrics[primaryMode]?.manpowerMM || 0).toFixed(2)),
        isProject: false,
        node: s
      }));
    }

    // Top-level categories
    return tree.map(cat => ({
      name: cat.name,
      Budget: Number((cat.metrics['Budget']?.totalCr || 0).toFixed(2)),
      Actuals: Number((cat.metrics['Actuals']?.totalCr || 0).toFixed(2)),
      manpowerMM: Number((cat.metrics[primaryMode]?.manpowerMM || 0).toFixed(2)),
      isProject: false,
      node: cat
    }));
  }, [tree, activeCategoryNode, activeSubcategoryNode, primaryMode]);

  // Total Portfolio Spend for proportions
  const portfolioTotalCr = useMemo(() => {
    return tree.reduce((acc, cat) => acc + (cat.metrics[primaryMode]?.totalCr || 0), 0);
  }, [tree, primaryMode]);

  // Resource cost mix for the active scope
  const resourceMix = useMemo(() => {
    const scopeNodes = activeSubcategoryNode ? [activeSubcategoryNode] : activeCategoryNode ? [activeCategoryNode] : tree;
    let directCost = 0;
    let contractedCost = 0;
    let otherExp = 0;

    scopeNodes.forEach(node => {
      const m = node.metrics[primaryMode];
      if (m) {
        directCost += m.manpowerCr - (m.contractedMM * 180 * 1150 / 10000000);
        contractedCost += (m.contractedMM * 180 * 1150 / 10000000);
        otherExp += m.expenseCr;
      }
    });

    return [
      { name: 'Direct Personnel', value: Math.max(0, directCost) },
      { name: 'Contracted Personnel', value: Math.max(0, contractedCost) },
      { name: 'Operational Expenses', value: Math.max(0, otherExp) }
    ];
  }, [tree, activeCategoryNode, activeSubcategoryNode, primaryMode]);

  // Top 10 High Impact Projects across active branch
  const topProjects = useMemo(() => {
    const list: AnalyticsTreeNode[] = [];
    const collectProjects = (nodes: AnalyticsTreeNode[]) => {
      nodes.forEach(n => {
        if (n.level === 3) list.push(n);
        if (n.children) collectProjects(n.children);
      });
    };

    const targetNodes = activeSubcategoryNode ? [activeSubcategoryNode] : activeCategoryNode ? [activeCategoryNode] : tree;
    collectProjects(targetNodes);

    list.sort((a, b) => (b.metrics[primaryMode]?.totalCr || 0) - (a.metrics[primaryMode]?.totalCr || 0));
    return list.slice(0, 8);
  }, [tree, activeCategoryNode, activeSubcategoryNode, primaryMode]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Category Tree KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tree.map(cat => {
          const m = cat.metrics[primaryMode];
          const bud = cat.metrics['Budget']?.totalCr || 0;
          const act = cat.metrics['Actuals']?.totalCr || 0;
          const share = portfolioTotalCr > 0 ? (m.totalCr / portfolioTotalCr) * 100 : 0;
          const isSelected = drilldownCategory === cat.name;

          return (
            <div
              key={cat.id}
              onClick={() => {
                if (isSelected) {
                  setDrilldownCategory(null);
                  setDrilldownSubcategory(null);
                } else {
                  setDrilldownCategory(cat.name);
                  setDrilldownSubcategory(null);
                }
              }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                isSelected 
                  ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-200' 
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Folder size={14} className={isSelected ? 'text-blue-600' : 'text-slate-400'} />
                  {cat.name}
                </span>
                <span className="text-[10px] font-mono text-slate-400 font-bold">
                  {cat.itemCount} projects
                </span>
              </div>

              <div className="mt-3">
                <p className="text-2xl font-black font-mono text-slate-900 tracking-tight">
                  ₹ {m.totalCr.toFixed(2)} <span className="text-xs font-sans text-slate-500">Cr</span>
                </p>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-1">
                  <span>{m.manpowerMM.toFixed(2)} MM</span>
                  <span className="font-bold text-slate-700">{share.toFixed(1)}% share</span>
                </div>
              </div>

              {/* Progress bar (Actual vs Budget) */}
              <div className="mt-3 pt-2 border-t border-slate-100">
                <div className="flex justify-between text-[9px] font-mono text-slate-400 mb-1">
                  <span>Actual: ₹ {act.toFixed(2)} Cr</span>
                  <span>Budget: ₹ {bud.toFixed(2)} Cr</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, bud > 0 ? (act / bud) * 100 : 0)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-xs text-xs font-bold text-slate-600">
        <span className="text-slate-400 uppercase tracking-widest text-[10px]">Hierarchy Drilldown:</span>
        <button 
          onClick={() => { setDrilldownCategory(null); setDrilldownSubcategory(null); }}
          className={`hover:text-blue-600 transition-colors ${!drilldownCategory ? 'text-blue-600 font-black' : ''}`}
        >
          All Portfolio
        </button>
        {drilldownCategory && (
          <>
            <ChevronRight size={14} className="text-slate-300" />
            <button 
              onClick={() => setDrilldownSubcategory(null)}
              className={`hover:text-blue-600 transition-colors ${!drilldownSubcategory ? 'text-blue-600 font-black' : ''}`}
            >
              {drilldownCategory}
            </button>
          </>
        )}
        {drilldownSubcategory && (
          <>
            <ChevronRight size={14} className="text-slate-300" />
            <span className="text-indigo-600 font-black">{drilldownSubcategory}</span>
          </>
        )}
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tree Branch Spend Comparison (2 columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Layers size={14} className="text-indigo-600" />
                {activeSubcategoryNode ? `Projects inside ${drilldownSubcategory}` : activeCategoryNode ? `Subcategories inside ${drilldownCategory}` : 'Category Spend Distribution (₹ Cr)'}
              </h4>
              <p className="text-[11px] text-slate-400 font-medium">
                Click on any bar below to drill deeper down the tree
              </p>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Showing {currentChartItems.length} branches
            </span>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={currentChartItems}
                margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length > 0) {
                    const item = e.activePayload[0].payload;
                    if (!item.isProject) {
                      if (!drilldownCategory) {
                        setDrilldownCategory(item.name);
                      } else if (!drilldownSubcategory) {
                        setDrilldownSubcategory(item.name);
                      }
                    }
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  axisLine={false} 
                  tickLine={false} 
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip 
                  formatter={(val: number) => [`₹ ${val.toFixed(2)} Cr`, '']}
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                {selectedModes.includes('Budget') && (
                  <Bar dataKey="Budget" name="Budget (Cr)" fill="#3b82f6" fillOpacity={0.6} radius={[4, 4, 0, 0]} />
                )}
                {selectedModes.includes('Actuals') && (
                  <Bar dataKey="Actuals" name="Actuals (Cr)" fill="#10b981" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Resource Cost Mix Donut Chart (1 column) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Users size={14} className="text-blue-600" />
              Resource Cost Allocation
            </h4>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Direct people vs contracted vs opex
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={resourceMix}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {resourceMix.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => `₹ ${value.toFixed(2)} Cr`}
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-3 border-t border-slate-100 text-[11px] font-mono">
            {resourceMix.map((r, i) => (
              <div key={r.name} className="flex justify-between items-center text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {r.name}
                </span>
                <span className="font-bold text-slate-800">₹ {r.value.toFixed(2)} Cr</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 8 High Impact Projects in Current Branch */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-4 flex items-center gap-1.5">
          <Briefcase size={14} className="text-emerald-600" />
          High-Impact Projects in Selected Scope
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {topProjects.map(proj => {
            const bud = proj.metrics['Budget']?.totalCr || 0;
            const act = proj.metrics['Actuals']?.totalCr || 0;
            const delta = act - bud;

            return (
              <div 
                key={proj.id}
                className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    {proj.code && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-white text-slate-700 border border-slate-200">
                        {proj.code}
                      </span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                      proj.isNew ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {proj.isNew ? 'New' : 'Carry'}
                    </span>
                  </div>
                  <h5 className="text-xs font-bold text-slate-800 truncate" title={proj.name}>
                    {proj.name}
                  </h5>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {proj.subcategoryKey || proj.vertical || '-'}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between font-mono text-[11px]">
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">Total Spend</span>
                    <span className="font-black text-slate-900">₹ {act > 0 ? act.toFixed(2) : bud.toFixed(2)} Cr</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 block uppercase">Variance</span>
                    <span className={`font-bold ${delta <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(2)} Cr
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
