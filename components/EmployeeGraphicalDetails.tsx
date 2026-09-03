import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export const EmployeeGraphicalDetails = ({ emp, months }: { emp: any, months: string[] }) => {
  const verticals = Object.keys(emp.verticalSummaries || {});
  
  const overallData = [{
    name: 'Overall',
    ...verticals.reduce((acc, v) => ({ ...acc, [v]: emp.verticalSummaries?.[v]?.overall || 0 }), {}),
    Billable: emp.overallBillablePct || 0,
    'Non-Billable': emp.overallNonBillablePct || 0,
    Idle: emp.overallIdlePct || 0,
  }];

  // Data for monthly stacked bar
  const mergedData = months.map((m, i) => {
    const point: any = { name: m };
    verticals.forEach(v => {
      point[v] = emp.verticalSummaries?.[v]?.monthly?.[i] || 0;
    });
    point.Billable = emp.monthlyBillablePct?.[i] || 0;
    point['Non-Billable'] = emp.monthlyNonBillablePct?.[i] || 0;
    point.Idle = emp.monthlyIdlePct?.[i] || 0;
    return point;
  });

  const [hoveredVertical, setHoveredVertical] = React.useState<string | null>(null);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const monthIndex = months.indexOf(label);
      
      const verticalPayload = payload.filter((entry: any) => verticals.includes(entry.dataKey));
      const billablePayload = payload.filter((entry: any) => ['Billable', 'Non-Billable', 'Idle'].includes(entry.dataKey));

      const activeVerticalPayload = hoveredVertical 
        ? verticalPayload.filter((entry: any) => entry.dataKey === hoveredVertical)
        : verticalPayload;

      return (
        <div className="bg-white p-3 rounded-xl shadow-lg border border-slate-100 text-xs min-w-[200px]">
          <p className="font-bold mb-2 text-slate-700">{label} Details</p>
          
          {/* Vertical Splits */}
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Projects</p>
            {activeVerticalPayload.map((entry: any, index: number) => {
              const vertical = entry.dataKey;
              const projects = emp.projects?.[vertical] || [];
              
              if (entry.value === 0) return null;

              return (
                <div key={index} className="mb-2 last:mb-0">
                  <div className="font-bold flex items-center gap-1" style={{ color: entry.color }}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                    {vertical}: {Math.round(entry.value)}%
                  </div>
                  <div className="pl-3 mt-1 space-y-1">
                    {projects.map((p: any, i: number) => {
                      const monthlyAlloc = monthIndex >= 0 ? p.monthlyAllocations[monthIndex] * 100 : p.overallPercentage;
                      if (monthlyAlloc === 0) return null;
                      return (
                        <div key={i} className="text-slate-500 flex justify-between gap-4 text-[10px]">
                          <span className="truncate flex-1">[{p.code || p.id}] {p.name}</span>
                          <span className="font-medium shrink-0">{Math.round(monthlyAlloc)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Billability Splits */}
          {billablePayload.some((entry: any) => entry.value > 0) && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Billability</p>
              {billablePayload.map((entry: any, index: number) => {
                if (entry.value === 0) return null;
                return (
                  <div key={index} className="flex justify-between items-center gap-4 text-[10px] mb-1 last:mb-0">
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                      {entry.dataKey}
                    </div>
                    <span className="font-bold text-slate-700">{Math.round(entry.value)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="py-6 bg-slate-50/50 pr-6">
      <div className="bg-white py-4 rounded-2xl shadow-sm border border-slate-100 flex">
        <div className="w-[150px] shrink-0 border-r border-slate-100">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 px-6 text-center">Overall</h4>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overallData} margin={{ top: 20, right: 0, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
                <YAxis 
                  domain={[0, 100]} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: '#64748b' }}
                  tickFormatter={(val) => `${val}%`}
                  width={35}
                />
                <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} wrapperStyle={{ zIndex: 100 }} />
                {verticals.map((v, i) => (
                  <Bar 
                    key={v} 
                    dataKey={v} 
                    stackId="verticals" 
                    fill={COLORS[i % COLORS.length]} 
                    barSize={12}
                    onMouseEnter={() => setHoveredVertical(v)}
                    onMouseLeave={() => setHoveredVertical(null)}
                  />
                ))}
                <Bar dataKey="Billable" stackId="billable" fill="#10b981" barSize={12} />
                <Bar dataKey="Non-Billable" stackId="billable" fill="#f59e0b" barSize={12} />
                <Bar dataKey="Idle" stackId="billable" fill="#94a3b8" barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex-1">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 px-6">Monthly Vertical Split & Billability</h4>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mergedData} margin={{ top: 20, right: 0, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
                <YAxis hide={true} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} wrapperStyle={{ zIndex: 100 }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                {verticals.map((v, i) => (
                  <Bar 
                    key={v} 
                    dataKey={v} 
                    stackId="verticals" 
                    fill={COLORS[i % COLORS.length]} 
                    barSize={12}
                    onMouseEnter={() => setHoveredVertical(v)}
                    onMouseLeave={() => setHoveredVertical(null)}
                  />
                ))}
                <Bar dataKey="Billable" stackId="billable" fill="#10b981" barSize={12} />
                <Bar dataKey="Non-Billable" stackId="billable" fill="#f59e0b" barSize={12} />
                <Bar dataKey="Idle" stackId="billable" fill="#94a3b8" barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
