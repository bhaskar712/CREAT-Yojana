import React, { useMemo, useState } from 'react';
import { Project } from '../types';
import { ArrowLeftRight, Layers } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { VERTICAL_COLORS_CLASS as FAMILY_COLORS } from '../constants/colors';

interface FamilyViewProps {
  projects: Project[];
  efficiencyData?: Record<string, { won: number; spend: number; ratio: number }>;
  viewMode?: 'tabular' | 'graphical';
}

export const FamilyView: React.FC<FamilyViewProps> = ({ projects, efficiencyData, viewMode = 'tabular' }) => {
  const [isFlipped, setIsFlipped] = useState(true);
  const [isCombined, setIsCombined] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  const matrix = useMemo(() => {
    let families = Array.from(new Set(projects.map(p => p.productFamily))).filter(Boolean);
    if (isCombined) {
      families = ['All Families'];
    }
    const generations = ['Level Up + 2', 'Level Up + 1', 'Current'];
    const flippedGenerations = ['Current', 'Level Up + 1', 'Level Up + 2'];
    const categories = ['Carryover', 'New'];
    const flippedCategories = ['New', 'Carryover'];

    const data: any = {};
    families.forEach(family => {
      data[family] = {};
      generations.forEach(gen => {
        data[family][gen] = { Carryover: [], New: [] };
      });
    });

    projects.forEach(p => {
      const family = isCombined ? 'All Families' : (p.productFamily || 'Unassigned');
      const gen = p.generation || 'Current';
      
      // Explicit overrides based on user request
      let cat = (p.category || '').toLowerCase().includes('carry') ? 'Carryover' : 'New';
      if (['C-UML Camera Platform AHL', 'M&M W616 AWC FR & RR Wireless charger Front Qi 1.3 - with FAN (Front) Z121'].includes(p.name)) {
        cat = 'Carryover';
      }
      if (['C-UML GMSL Camera VAVE (SP 1000 INR)', 'D-UML Camera based Helmet detection', 'C-UML Qi 2.2 MPP M&M Focus (25 W)'].includes(p.name)) {
        cat = 'New';
      }
      
      if (!data[family]) data[family] = {};
      if (!data[family][gen]) data[family][gen] = { Carryover: [], New: [] };
      
      data[family][gen][cat].push({ name: p.name, vertical: p.vertical || 'Unassigned' });
    });

    return { data, families, generations, flippedGenerations, categories, flippedCategories };
  }, [projects, isCombined]);

  const chartData = useMemo(() => {
    if (!efficiencyData) return [];
    return Object.entries(efficiencyData).map(([family, values]) => ({
      family,
      ...values
    })).filter(d => matrix.families.includes(d.family) || isCombined);
  }, [efficiencyData, matrix.families, isCombined]);

  const renderProjectPills = (projectList: { name: string, vertical: string }[]) => {
    if (isCombined) {
      const grouped = projectList.reduce((acc: any, p) => {
        if (!acc[p.vertical]) acc[p.vertical] = [];
        acc[p.vertical].push(p.name);
        return acc;
      }, {});

      return Object.entries(grouped).map(([vertical, names]: [string, any]) => (
        <div key={vertical} className="mb-4 last:mb-0">
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${(FAMILY_COLORS && FAMILY_COLORS[vertical]?.split(' ')[0]) || 'bg-slate-400'}`} />
            {vertical}
          </div>
          <div className="flex flex-wrap gap-2">
            {names.map((name: string, i: number) => (
              <span key={i} className={`px-3 py-2 rounded-lg text-[11px] font-bold border shadow-sm bg-white ${(FAMILY_COLORS && FAMILY_COLORS[vertical]) || 'text-slate-700 border-slate-200'}`}>
                {name}
              </span>
            ))}
          </div>
        </div>
      ));
    }

    return (
      <div className="flex flex-wrap gap-2">
        {projectList.map((p, i) => {
          const palettes = [
            'bg-white text-blue-700 border-blue-200',
            'bg-white text-indigo-700 border-indigo-200',
            'bg-white text-emerald-700 border-emerald-200',
            'bg-white text-sky-700 border-sky-200',
            'bg-white text-violet-700 border-violet-200',
            'bg-white text-slate-700 border-slate-200'
          ];
          let hash = 0;
          for (let j = 0; j < p.name.length; j++) {
            hash = p.name.charCodeAt(j) + ((hash << 5) - hash);
          }
          const colorIndex = Math.abs(hash) % palettes.length;
          const pillColorClass = palettes[colorIndex];
          
          return (
            <span key={i} className={`px-3 py-2 rounded-lg text-[11px] font-bold border shadow-sm ${pillColorClass}`}>
              {p.name}
            </span>
          );
        })}
      </div>
    );
  };

  const renderEfficiency = (family: string) => {
    if (!efficiencyData || !efficiencyData[family] || isCombined) return null;
    const { won, spend, ratio } = efficiencyData[family];
    return (
      <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
        <div className="flex justify-between text-[9px] uppercase font-bold text-slate-400">
          <span>Won</span>
          <span className="text-emerald-600">₹{won}Cr</span>
        </div>
        <div className="flex justify-between text-[9px] uppercase font-bold text-slate-400">
          <span>Spent</span>
          <span className="text-indigo-600">₹{spend}Cr</span>
        </div>
        <div className="flex justify-between text-[9px] uppercase font-bold text-slate-400 border-t border-slate-50 mt-1 pt-1 font-black">
          <span>Ratio</span>
          <span className={ratio >= 1 ? 'text-emerald-700' : 'text-rose-700'}>{ratio}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
            {viewMode === 'tabular' ? 'Family View Roadmap' : 'Family Efficiency Chart'}
          </h3>
          <div className="flex items-center gap-2">
            {viewMode === 'tabular' ? (
              <>
                <button 
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all border border-slate-200 shadow-sm"
                >
                  <ArrowLeftRight size={14} />
                  Flip Axis
                </button>
                <button 
                  onClick={() => setIsCombined(!isCombined)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm ${
                    isCombined 
                    ? 'bg-indigo-600 text-white border-indigo-700' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                  }`}
                >
                  <Layers size={14} />
                  {isCombined ? 'Split View' : 'Combined View'}
                </button>
              </>
            ) : (
              <button 
                onClick={() => setShowLabels(!showLabels)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all border border-slate-200 shadow-sm"
              >
                {showLabels ? 'Hide Labels' : 'Show Labels'}
              </button>
            )}
          </div>
        </div>
        {viewMode === 'tabular' && (
          <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-100/70 border border-blue-200"></div> Carryover</span>
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-50/60 border border-blue-200"></div> New</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto min-h-[500px]">
        {viewMode === 'tabular' ? (
          !isFlipped ? (
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr>
                  <th className="p-6 border-b border-slate-200 w-[15%] text-[11px] font-black uppercase tracking-widest text-slate-500">Family</th>
                  <th className="p-6 border-b border-slate-200 w-[15%] text-[11px] font-black uppercase tracking-widest text-slate-500">Generation</th>
                  {matrix.categories.map((cat, i) => (
                    <th key={cat} className={`p-6 border-b border-slate-200 text-center text-[11px] font-black uppercase tracking-widest w-[35%] ${cat === 'Carryover' ? 'text-slate-400' : 'text-slate-600'} ${i === 0 ? 'border-r border-slate-200' : ''}`}>{cat}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.families.map(family => (
                  <React.Fragment key={family}>
                    {matrix.generations.map((gen, genIdx) => {
                      const getRowColors = (gen: string) => {
                        const g = gen.toUpperCase();
                        if (g === 'LEVEL UP + 2') return { co: 'bg-emerald-50/60', new: 'bg-emerald-100/70' }; // Greenish
                        if (g === 'LEVEL UP + 1') return { co: 'bg-amber-50/60', new: 'bg-amber-100/70' }; // Yellowish
                        if (g === 'CURRENT') return { co: 'bg-blue-50/60', new: 'bg-blue-100/70' }; // Bluish
                        return { co: 'bg-slate-50', new: 'bg-slate-100' };
                      };
                      const rowColors = getRowColors(gen);

                      return (
                        <tr key={`${family}-${gen}`} className="border-b border-slate-200">
                          {genIdx === 0 && (
                            <td rowSpan={3} className="p-6 font-black text-slate-800 border-r border-slate-200 bg-white align-top">
                              {family}
                              {renderEfficiency(family)}
                            </td>
                          )}
                          <td className="p-6 text-slate-400 font-bold text-[10px] uppercase border-r border-slate-200 bg-white">{gen}</td>
                          {matrix.categories.map((cat, catIdx) => {
                            const cellColorClass = cat === 'Carryover' ? rowColors.co : rowColors.new;
                            return (
                              <td key={cat} className={`p-0 align-top ${catIdx === 0 ? 'border-r border-slate-200' : ''} ${cellColorClass}`}>
                                <div className={`min-h-[120px] p-4 h-full`}>
                                  {renderProjectPills(matrix.data[family][gen][cat])}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr>
                  <th className="p-6 border-b border-slate-200 w-[15%] text-[11px] font-black uppercase tracking-widest text-slate-500">Family</th>
                  <th className="p-6 border-b border-slate-200 w-[10%] text-[11px] font-black uppercase tracking-widest text-slate-500">Category</th>
                  {matrix.flippedGenerations.map((gen: string, i: number) => (
                    <th key={gen} className={`p-6 border-b border-slate-200 text-center text-[11px] font-black uppercase tracking-widest text-slate-600 w-[25%] ${i < matrix.flippedGenerations.length - 1 ? 'border-r border-slate-200' : ''}`}>{gen}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.families.map(family => (
                  <React.Fragment key={family}>
                    {matrix.flippedCategories.map((cat: string, catIdx: number) => {
                      return (
                        <tr key={`${family}-${cat}`} className="border-b border-slate-200">
                          {catIdx === 0 && (
                            <td rowSpan={2} className="p-6 font-black text-slate-800 border-r border-slate-200 bg-white align-top">
                              {family}
                              {renderEfficiency(family)}
                            </td>
                          )}
                          <td className="p-6 text-slate-400 font-bold text-[10px] uppercase border-r border-slate-200 bg-white">{cat}</td>
                          {matrix.flippedGenerations.map((gen: string, genIdx: number) => {
                            const getRowColors = (gen: string) => {
                              const g = gen.toUpperCase();
                              if (g === 'LEVEL UP + 2') return { co: 'bg-emerald-50/60', new: 'bg-emerald-100/70' }; // Greenish
                              if (g === 'LEVEL UP + 1') return { co: 'bg-amber-50/60', new: 'bg-amber-100/70' }; // Yellowish
                              if (g === 'CURRENT') return { co: 'bg-blue-50/60', new: 'bg-blue-100/70' }; // Bluish
                              return { co: 'bg-slate-50', new: 'bg-slate-100' };
                            };
                            const rowColors = getRowColors(gen);
                            const cellColorClass = cat === 'Carryover' ? rowColors.co : rowColors.new;

                            return (
                              <td key={gen} className={`p-0 align-top ${genIdx < matrix.flippedGenerations.length - 1 ? 'border-r border-slate-200' : ''} ${cellColorClass}`}>
                                <div className={`min-h-[120px] p-4 h-full`}>
                                  {renderProjectPills(matrix.data[family][gen][cat])}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <div className="h-[500px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="spend" name="Actual Spend" unit=" Cr" label={{ value: 'Actual Spend (Cr)', position: 'bottom', offset: 20 }} />
                <YAxis type="number" dataKey="won" name="Business WON" unit=" Cr" label={{ value: 'Business WON (Cr)', angle: -90, position: 'left', offset: 10 }} />
                <ZAxis type="number" dataKey="ratio" range={[60, 400]} name="Ratio" />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }} 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white p-2 border border-slate-200 shadow-lg rounded text-xs select-none">
                          <p className="font-bold mb-1 text-slate-900">{d.family}</p>
                          <div className="space-y-0.5">
                            <p className="text-indigo-600">Actual Spend: ₹{Math.round(d.spend)} Cr</p>
                            <p className="text-emerald-600">Business WON: ₹{Math.round(d.won)} Cr</p>
                            <p className="text-slate-900 font-bold border-t border-slate-100 pt-0.5 mt-0.5">Efficiency Ratio: {Math.round(d.ratio)}</p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter name="Family Performance" data={chartData} fill="#6366f1">
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.ratio > 1 ? '#10b981' : entry.ratio > 0.5 ? '#f59e0b' : '#ef4444'} />
                  ))}
                  {showLabels && (
                    <LabelList 
                      content={(props: any) => {
                        const { x, y, payload } = props;
                        const d = payload.payload;
                        return (
                          <g transform={`translate(${x},${y - 45})`}>
                            <rect 
                              width={120} 
                              height={45} 
                              fill="white" 
                              stroke="#e2e8f0" 
                              rx={4} 
                              style={{ filter: 'drop-shadow(0 4px 6px -1px rgb(0 0 0 / 0.1))' }} 
                            />
                            <text x={5} y={15} fontSize={8} fontWeight="bold" fill="#0f172a">{d.family}</text>
                            <text x={5} y={28} fontSize={7} fontWeight="medium" fill="#4f46e5">Spend: ₹{Math.round(d.spend)}Cr</text>
                            <text x={5} y={38} fontSize={7} fontWeight="medium" fill="#059669">Won: ₹{Math.round(d.won)}Cr</text>
                          </g>
                        );
                      }}
                    />
                  )}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
