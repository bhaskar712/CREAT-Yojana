
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Opportunity, 
  DCBAStage, 
  DCBA_STAGES, 
  MasterConfigState
} from '../types';
import { 
  Search, 
  Filter, 
  LayoutGrid,
  Table as TableIcon,
  ChevronRight,
  ChevronDown,
  Calendar,
  Target,
  Users,
  TrendingUp,
  FileText
} from 'lucide-react';

interface GreenMatrixProps {
  masterConfig: MasterConfigState;
  opportunities: Opportunity[];
  onEdit: (opp: Opportunity) => void;
  showNumbers?: boolean;
}

const StatusDot = ({ status }: { status?: string }) => {
  if (!status || status === '-' || status.toLowerCase().trim() === 'none' || status.toLowerCase().trim() === 'na') {
    return <div className="w-1.5 h-1.5 rounded-full bg-slate-200/20" title={status || 'No status'} />;
  }
  const s = status.toLowerCase().trim();
  if (s === 'green' || s === 'g' || s.includes('green') || s === 'ok' || s === 'good' || s === 'complete') {
    return <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" title={status} />;
  }
  if (s === 'red' || s === 'r' || s.includes('red') || s === 'nok' || s === 'critical' || s === 'bad' || s === 'issue') {
    return <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.5)]" title={status} />;
  }
  if (s === 'yellow' || s === 'y' || s.includes('yellow') || s === 'amber' || s === 'warning' || s === 'pending' || s === 'wip') {
    return <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.5)]" title={status} />;
  }
  return <div className="w-1.5 h-1.5 rounded-full bg-slate-400" title={status} />;
};

export const GreenMatrix: React.FC<GreenMatrixProps> = ({ masterConfig, opportunities, onEdit, showNumbers = true }) => {
  const [sortConfig, setSortConfig] = useState<{ key: 'total' | 'name'; direction: 'asc' | 'desc' }>({
    key: 'total',
    direction: 'desc'
  });
  const filteredOpportunities = opportunities;

  const matrixData = useMemo(() => {
    const products = Array.from(new Set(filteredOpportunities.map(o => o.productFamily)));
    const custs = Array.from(new Set(filteredOpportunities.map(o => o.customerName))).sort();
    
    const grid: Record<string, Record<string, Opportunity[]>> = {};
    const rowTotals: Record<string, { count: number, value: number }> = {};
    const colTotals: Record<string, { count: number, value: number }> = {};
    let grandTotal = { count: 0, value: 0 };

    products.forEach(p => {
      grid[p] = {};
      rowTotals[p] = { count: 0, value: 0 };
      custs.forEach(c => {
        const opps = filteredOpportunities.filter(o => o.productFamily === p && o.customerName === c);
        grid[p][c] = opps;
        
        const cellCount = opps.length;
        const cellValue = opps.reduce((sum, o) => sum + o.value, 0);
        
        rowTotals[p].count += cellCount;
        rowTotals[p].value += cellValue;
        
        if (!colTotals[c]) colTotals[c] = { count: 0, value: 0 };
        colTotals[c].count += cellCount;
        colTotals[c].value += cellValue;
        
        grandTotal.count += cellCount;
        grandTotal.value += cellValue;
      });
    });

    // Apply sorting to products
    const sortedProducts = [...products].sort((a, b) => {
      if (sortConfig.key === 'total') {
        const valA = rowTotals[a].value;
        const valB = rowTotals[b].value;
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      } else {
        return sortConfig.direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
      }
    });

    return { products: sortedProducts, custs, grid, rowTotals, colTotals, grandTotal };
  }, [filteredOpportunities, sortConfig]);

  const toggleSort = (key: 'total' | 'name') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[8px] uppercase tracking-[0.1em]">
                <th 
                  className="px-2 py-2 font-bold sticky left-0 bg-slate-900 z-20 border-r border-slate-800 min-w-[200px] cursor-pointer hover:bg-slate-800 transition-colors"
                  onClick={() => toggleSort('name')}
                >
                  <div className="flex items-center justify-between">
                    <span>Product Family</span>
                    {sortConfig.key === 'name' && (
                      <Filter size={8} className={`ml-1 ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </th>
                {matrixData.custs.map(cust => (
                  <th key={cust} className="px-2 py-2 font-bold text-center min-w-[120px] border-r border-slate-800 last:border-r-0">
                    {cust}
                  </th>
                ))}
                <th 
                  className="px-2 py-2 font-bold text-center min-w-[100px] bg-slate-800 cursor-pointer hover:bg-slate-700 transition-colors"
                  onClick={() => toggleSort('total')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Total</span>
                    {sortConfig.key === 'total' && (
                      <Filter size={8} className={`${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Total Row at Top */}
              <tr className="bg-slate-50 text-slate-900 font-bold border-b-2 border-slate-200">
                <td className="px-2 py-2 sticky left-0 bg-slate-50 z-10 border-r border-slate-200 uppercase tracking-widest text-[8px]">
                  Grand Total
                </td>
                {matrixData.custs.map(cust => (
                  <td key={cust} className="px-2 py-2 text-center border-r border-slate-100 last:border-r-0">
                    {showNumbers && (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-indigo-600 font-black">₹{Math.round(matrixData.colTotals[cust]?.value || 0)}</span>
                        <span className="text-[7px] font-bold text-slate-400">{matrixData.colTotals[cust]?.count || 0}</span>
                      </div>
                    )}
                  </td>
                ))}
                <td className="px-2 py-2 text-center bg-slate-100/50">
                  {showNumbers && (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] text-indigo-600 font-black">₹{Math.round(matrixData.grandTotal.value)}</span>
                      <span className="text-[8px] font-bold text-slate-400">{matrixData.grandTotal.count}</span>
                    </div>
                  )}
                </td>
              </tr>

              {matrixData.products.map(product => (
                <tr key={product} className="hover:bg-emerald-50/30 transition-colors group">
                  <td className="px-2 py-2 sticky left-0 bg-white group-hover:bg-emerald-50/50 z-10 border-r border-emerald-100 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                      <div>
                        <p className="font-black text-slate-900 text-[10px] tracking-tight leading-none">{product}</p>
                        <p className="text-[7px] text-emerald-600 font-bold uppercase tracking-widest mt-0.5">
                          {filteredOpportunities.find(o => o.productFamily === product)?.vertical || 'General'}
                        </p>
                      </div>
                    </div>
                  </td>
                  {matrixData.custs.map(cust => {
                    const opps = matrixData.grid[product][cust] || [];
                    return (
                      <td key={cust} className="px-2 py-2 border-r border-emerald-50 last:border-r-0">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {(() => {
                            const groupedOpps = Object.entries(
                              opps.reduce((acc, opp) => {
                                if (!acc[opp.stage]) acc[opp.stage] = [];
                                acc[opp.stage].push(opp);
                                return acc;
                               }, {} as Record<string, Opportunity[]>)
                            ).sort((a, b) => a[0].localeCompare(b[0]));

                            return groupedOpps.map(([stage, stageOpps]) => {
                              const stageInfo = DCBA_STAGES.find(s => s.value === stage);
                              const isMultiple = stageOpps.length > 1;
                              const totalValue = stageOpps.reduce((sum, o) => sum + o.value, 0);

                              return (
                                <div 
                                  key={stage}
                                  onClick={() => {
                                    if (!isMultiple) {
                                      onEdit(stageOpps[0]);
                                    }
                                  }}
                                  className={`group/item relative w-8 h-8 rounded-lg ${stageInfo?.color || 'bg-slate-500'} text-slate-900 flex flex-col items-center justify-center shadow-lg shadow-slate-900/10 hover:scale-110 hover:-translate-y-1 transition-all ${!isMultiple ? 'cursor-pointer' : 'cursor-default'}`}
                                >
                                  <span className={`font-bold leading-none ${showNumbers ? 'text-[8px] mb-0.5' : 'text-xs'}`}>{stage}</span>
                                  {showNumbers && (
                                    <div className="flex flex-col items-center leading-none">
                                      <span className="text-[6px] font-black">₹{Math.round(totalValue)}</span>
                                      <span className="text-[6px] font-bold mt-0.5 opacity-60">{stageOpps.length}</span>
                                    </div>
                                  )}
                                  
                                  {/* Tooltip Wrapper */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-3 w-56 opacity-0 group-hover/item:opacity-100 transition-all z-50 invisible group-hover/item:visible">
                                    {/* Tooltip Content */}
                                    <div className="p-4 bg-slate-900 text-white rounded-2xl text-[10px] shadow-2xl relative pointer-events-auto">
                                      <div className="space-y-3 max-h-[200px] overflow-y-auto no-scrollbar">
                                        <p className="font-black uppercase tracking-widest border-b border-white/10 pb-1 sticky top-0 bg-slate-900 z-10">
                                          {cust} - Stage {stage}
                                        </p>
                                        {stageOpps.map((opp) => (
                                          <div 
                                            key={opp.id} 
                                            className="space-y-1 pb-2 border-b border-white/5 last:border-0 last:pb-0 hover:bg-white/10 p-1.5 -mx-1.5 rounded cursor-pointer transition-colors"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onEdit(opp);
                                            }}
                                          >
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Value:</span>
                                              <span className="font-black text-emerald-400">₹{opp.value.toFixed(0)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Status:</span>
                                              <span className="font-black">{opp.status}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">FY:</span>
                                              <span className="font-black">{opp.fiscalYear}</span>
                                            </div>
                                          </div>
                                        ))}
                                        {isMultiple && (
                                          <div className="flex justify-between pt-2 border-t border-white/10 sticky bottom-0 bg-slate-900 z-10">
                                            <span className="text-slate-400 font-bold">Total Value:</span>
                                            <span className="font-black text-emerald-400">₹{totalValue.toFixed(0)}</span>
                                          </div>
                                        )}
                                      </div>
                                      {/* Arrow */}
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                          {opps.length === 0 && (
                            <div className="w-10 h-10 rounded-xl border-2 border-dashed border-emerald-100 flex items-center justify-center">
                              <span className="text-emerald-100 font-black text-xs">0</span>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-6 py-3 bg-slate-50/50 border-l border-slate-100">
                    {showNumbers && (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className="text-sm font-black text-indigo-600">₹{Math.round(matrixData.rowTotals[product].value)}</span>
                        <span className="text-[10px] font-bold text-slate-400">{matrixData.rowTotals[product].count}</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              
              {matrixData.products.length === 0 && (
                <tr>
                  <td colSpan={matrixData.custs.length + 1} className="py-32 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-6 bg-emerald-50 text-emerald-200 rounded-full">
                        <Filter size={48} />
                      </div>
                      <p className="text-slate-400 font-black uppercase tracking-widest">No matching opportunities found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
