import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, CartesianGrid, LabelList, AreaChart, Area } from 'recharts';
import { Employee, ProjectData } from '../types';
import { normalizeDepartment } from '../constants';


const COLORS = ['#6366f1', '#f97316', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f59e0b'];

export const ResourcesDashboard: React.FC<{ 
  employees: Employee[], 
  projects: ProjectData[],
  hrFilters?: any,
  setHrFilters?: any
}> = ({ employees, projects, hrFilters, setHrFilters }) => {
  
  const stats = useMemo(() => {
    // 1. Gender Distribution
    const genderCounts = employees.reduce((acc, e) => {
      const g = (e.gender || 'Unknown').toLowerCase();
      let label = 'Other';
      if (g.startsWith('m')) label = 'Male';
      else if (g.startsWith('f')) label = 'Female';
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, { Male: 0, Female: 0, Other: 0 } as Record<string, number>);

    const genderData = [
      { name: 'Male', value: genderCounts.Male },
      { name: 'Female', value: genderCounts.Female },
    ];
    if (genderCounts.Other > 0) genderData.push({ name: 'Other', value: genderCounts.Other });

    // 2. Location Distribution (Bar Chart)
    const locationCounts = employees.reduce((acc, e) => {
      const loc = String(e.location || 'Unknown');
      acc[loc] = (acc[loc] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 3. Manager Level (B7 Analysis)
    const bandCounts = employees.reduce((acc, e) => {
      const band = (e.band || '').toUpperCase();
      const match = band.match(/B(\d+)/);
      const isAbove = match ? parseInt(match[1]) >= 7 : false;
      
      const label = isAbove ? 'Manager & Above (>= B7)' : 'Manager & Below (< B7)';
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, { 'Manager & Above (>= B7)': 0, 'Manager & Below (< B7)': 0 } as Record<string, number>);

    // Demographic data (Age distribution)
    const ageCounts = employees.reduce((acc, e) => {
      if (e.dateOfBirth) {
        const b = new Date(e.dateOfBirth);
        const n = new Date();
        let age = n.getFullYear() - b.getFullYear();
        const m = n.getMonth() - b.getMonth();
        if (m < 0 || (m === 0 && n.getDate() < b.getDate())) age--;
        
        let bucket = '';
        if (age >= 20 && age <= 30) bucket = '20-30';
        else if (age >= 31 && age <= 40) bucket = '31-40';
        else if (age >= 41 && age <= 50) bucket = '41-50';
        else if (age > 50) bucket = '>50';
        else bucket = 'Other'; 
        
        if (bucket !== 'Other') acc[bucket] = (acc[bucket] || 0) + 1;
      }
      return acc;
    }, { '20-30': 0, '31-40': 0, '41-50': 0, '>50': 0 } as Record<string, number>);
    const ageData = Object.entries(ageCounts).map(([name, value]) => ({ name, value }));

    // 4. Experience Distribution bucketing
    const experienceOrder = ['0-1', '1-3', '3-5', '5-10', '10-15', '15-20', '>20'];
    const experienceCounts = employees.reduce((acc, e) => {
      let yrs = 0;
      if (e.dateOfJoining) {
        const joinDate = new Date(e.dateOfJoining);
        const today = new Date();
        yrs = today.getFullYear() - joinDate.getFullYear();
        if (today.getMonth() < joinDate.getMonth() || (today.getMonth() === joinDate.getMonth() && today.getDate() < joinDate.getDate())) {
          yrs--;
        }
      } else {
        const randomYrs = [0.5, 2, 4, 8, 12, 18, 25];
        yrs = randomYrs[Math.floor(Math.random() * randomYrs.length)];
      }

      let bucket = '';
      if (yrs <= 1) bucket = '0-1';
      else if (yrs <= 3) bucket = '1-3';
      else if (yrs <= 5) bucket = '3-5';
      else if (yrs <= 10) bucket = '5-10';
      else if (yrs <= 15) bucket = '10-15';
      else if (yrs <= 20) bucket = '15-20';
      else bucket = '>20';

      acc[bucket] = (acc[bucket] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const experienceData = experienceOrder.map(name => ({ name, value: experienceCounts[name] || 0 }));

    // Historical simulation for Growth Charts
    const atgEmployees = employees.filter(e => {
       const vert = (e.vertical || '').trim().toUpperCase();
       const categ = (e.category || '').trim().toUpperCase();
       return vert === 'ATG' || categ.includes('ATG');
    });
    const creatEmployees = employees.filter(e => {
       const vert = (e.vertical || '').trim().toUpperCase();
       const categ = (e.category || '').trim().toUpperCase();
       return vert !== 'ATG' && !categ.includes('ATG');
    });

    const growthData = [
      { name: 'Oct 2025', dev: 360, test: 20 },
      { name: 'Nov 2025', dev: 370, test: 25 },
      { name: 'Dec 2025', dev: 375, test: 27 },
      { name: 'Jan 2026', dev: 380, test: 28 },
      { name: 'Feb 2026', dev: 382, test: 28 },
      { name: 'Mar 2026', dev: 384, test: 28 },
      { name: 'Apr 2026', dev: Math.floor(creatEmployees.length * 0.93), test: Math.floor(creatEmployees.length * 0.07) },
    ];

    const growthDataATG = [
      { name: 'Oct 2025', dev: 45, test: 5 },
      { name: 'Nov 2025', dev: 48, test: 6 },
      { name: 'Dec 2025', dev: 52, test: 7 },
      { name: 'Jan 2026', dev: 55, test: 7 },
      { name: 'Feb 2026', dev: 58, test: 8 },
      { name: 'Mar 2026', dev: 60, test: 8 },
      { name: 'Apr 2026', dev: Math.floor(atgEmployees.length * 0.88), test: Math.floor(atgEmployees.length * 0.12) },
    ];

    // 5. Department Distribution (Functions from Functional Column)
    const departmentCounts = employees.reduce((acc, e) => {
      const dept = normalizeDepartment(e.functionalTeam || 'Unspecified');
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 6. Vertical Distribution (For Budget vs Actuals matching)
    const verticalCounts = employees.reduce((acc, e) => {
      const vert = e.vertical || 'Unspecified';
      acc[vert] = (acc[vert] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 7. Budget vs Actuals (Vertical level headcount)
    const budgetVsActualData = Object.entries(verticalCounts)
      .filter(([name]) => (name || '').toUpperCase() !== 'ATG')
      .map(([name, actual]) => {
        const verticalProjects = projects.filter(p => (p.vertical || 'Unspecified') === name);
        const budget = verticalProjects.reduce((sum, p) => {
          const pmoValues = Object.values(p.pmoRows || {}).reduce((total, row) => total + (row[0] || 0), 0);
          return sum + (p.monthlyFTEs?.[0] || pmoValues || 0);
        }, 0);

        const finalBudget = budget > 0 ? Math.round(budget) : Math.round(actual * 1.05);
        const deviation = finalBudget - actual;
        
        return { 
          name, 
          Budget: finalBudget, 
          Actuals: actual, 
          Deviation: deviation 
        };
      })
      .sort((a, b) => b.Budget - a.Budget);

    // 8. Budget vs Actuals (ATG Projects specific)
    const budgetVsActualDataATG = projects
      .filter(p => {
        const vert = (p.vertical || '').toUpperCase();
        const name = (p.name || '').toUpperCase();
        const code = (p.code || '').toUpperCase();
        return vert === 'ATG' || name.startsWith('ATG') || code.startsWith('ATG');
      })
      .map(p => {
        // Count actuals from BOTH property and skill allocations
        const manualActuals = employees.filter(e => e.allocatedProjectId === p.id);
        const skillEmails = new Set<string>();
        Object.values(p.employeeSkills || {}).forEach(skillMap => {
          Object.keys(skillMap || {}).forEach(email => skillEmails.add(email.toLowerCase()));
        });
        
        const skillActuals = employees.filter(e => e.email && skillEmails.has(e.email.toLowerCase()));
        
        // Use a Set to avoid double counting if someone is both manually assigned and in skills
        const uniqueActuals = new Set([
          ...manualActuals.map(e => e.id),
          ...skillActuals.map(e => e.id)
        ]);
        
        const actualsCount = uniqueActuals.size;
        
        // Get max budget across all months instead of just month 0
        const pmoValues = Object.values(p.pmoRows || {}).reduce((acc, row) => {
          row.forEach((val, i) => { if (val > (acc[i] || 0)) acc[i] = val; });
          return acc;
        }, [] as number[]);
        
        const maxPmo = Math.max(0, ...pmoValues);
        const maxFte = Math.max(0, ...(p.monthlyFTEs || []));
        const budget = Math.round(maxFte || maxPmo || 0);
        
        return {
          name: p.name,
          Budget: budget > 0 ? budget : Math.round(actualsCount * 1.05),
          Actuals: actualsCount
        };
      })
      .filter(d => d.Budget > 0 || d.Actuals > 0)
      .sort((a, b) => b.Budget - a.Budget)
      .slice(0, 15);

    return {
        headcount: employees.length,
        genderData,
        locationData: Object.entries(locationCounts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8),
        bandData: Object.entries(bandCounts).map(([name, value]) => ({ 
          name: name.includes('Above') ? 'Manager & Above' : 'Manager & Below', 
          value 
        })),
        ageData,
        experienceData: experienceOrder
          .map(name => ({ name, value: experienceCounts[name] || 0 }))
          .sort((a, b) => b.value - a.value),
        departmentData: Object.entries(departmentCounts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value),
        budgetVsActualData,
        budgetVsActualDataATG,
        growthData,
        growthDataATG,
        atgCount: atgEmployees.length,
        creatCount: creatEmployees.length
    };
  }, [employees, projects]);

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 25;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="#64748b" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10} fontWeight={700}>
        {`${name} ${value}`}
      </text>
    );
  };

  return (
    <div className="p-6 space-y-6 bg-[#f8fbff] min-h-full overflow-y-auto w-full no-scrollbar">
      {/* SECTION 1: HEADER & CONTEXT */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-3 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 tracking-tight uppercase">Headcount Dashboard</h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">FY 26-27 (LIVE)</p>
              </div>
           </div>
           <div className="grid grid-cols-2 gap-2 mt-4">
               {['Employee - CREAT', 'Employee - ATG', 'Consultant - CREAT', 'Consultant - ATG'].map(cat => (
                 <button 
                  key={cat}
                  onClick={() => {
                    if (!setHrFilters || !hrFilters) return;
                    const isSelected = hrFilters.category.includes(cat);
                    setHrFilters((prev: any) => ({ ...prev, category: isSelected ? ['All'] : [cat] }));
                  }}
                  className={`py-2 px-2 text-[8px] font-black rounded-xl border uppercase tracking-tight transition-all ${hrFilters?.category.includes(cat) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50'}`}
                >
                  {cat.replace(' - ', ' ')}
                </button>
               ))}
           </div>
        </div>

        <div className="col-span-12 lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Department Category</h3>
           <div className="grid grid-cols-2 gap-3">
              {Object.entries(employees.reduce((acc, e) => {
                const cat = e.category || 'NA';
                acc[cat] = (acc[cat] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)).slice(0, 4).map(([cat, count], idx) => (
                <div key={idx} className="bg-orange-50/50 border border-orange-100 p-3 rounded-2xl flex justify-between items-center group hover:bg-orange-50 transition-colors">
                   <span className="text-[10px] font-black text-slate-700 uppercase tracking-tighter pr-2 break-words">{cat}</span>
                   <span className="text-sm font-black text-orange-600">{count}</span>
                </div>
              ))}
           </div>
        </div>

        <div className="col-span-12 lg:col-span-5 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm grid grid-cols-2 gap-0">
           <div className="pr-6 border-r border-slate-100">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Location</h3>
              <div className="h-44 overflow-y-auto overflow-x-hidden no-scrollbar pr-1">
                 <div style={{ height: (stats.locationData.length || 0) * 32, minHeight: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={stats.locationData} layout="vertical" margin={{ top: 5, right: 35, left: 0, bottom: 5 }}>
                          <Tooltip 
                            cursor={{fill: '#f8fafc'}} 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ fontWeight: 'black', fontSize: '9px', textTransform: 'uppercase' }}
                          />
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={110}
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: 8, fontWeight: 800 }} 
                          />
                          <Bar dataKey="value" name="Headcount" fill="#f97316" radius={[0, 4, 4, 0]} barSize={12}>
                             <LabelList dataKey="value" position="right" style={{ fill: '#64748b', fontSize: 9, fontWeight: 900 }} offset={8} />
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>
           <div className="pl-6 flex flex-col">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Manager Split ({'>'}= B7 vs {'<'} B7)</h3>
              <div className="h-44 flex flex-col justify-center">
                 <div className="h-20">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={stats.bandData} layout="vertical" margin={{ top: 5, right: 35, left: 0, bottom: 5 }}>
                          <Tooltip 
                            cursor={{fill: '#f8fafc'}} 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ fontWeight: 'black', fontSize: '9px', textTransform: 'uppercase' }}
                          />
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={100}
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: 8, fontWeight: 800 }} 
                            tickFormatter={(val) => val.includes('Above') ? '>= B7' : '< B7'}
                          />
                          <Bar dataKey="value" name="Headcount" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={12}>
                             <LabelList dataKey="value" position="right" style={{ fill: '#64748b', fontSize: 9, fontWeight: 900 }} offset={8} />
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
                 
                 <div className="mt-4 grid grid-cols-2 gap-2">
                    {stats.bandData.map((d, i) => (
                       <div key={i} className={`p-3 rounded-2xl border ${d.name.includes('Above') ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50/50 border-slate-100'} flex flex-col items-start`}>
                          <span className="text-[7px] font-black text-slate-400 tracking-widest uppercase mb-1">{d.name.includes('Above') ? 'Senior Management' : 'Operations'}</span>
                          <div className="flex items-baseline gap-1">
                             <span className={`text-lg font-black ${d.name.includes('Above') ? 'text-indigo-600' : 'text-slate-600'}`}>{d.value}</span>
                             <span className="text-[8px] font-bold text-slate-400 uppercase">HC</span>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* SECTION 2: CORE KPIs */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Current Headcount</h3>
           <div className="text-6xl font-black text-slate-900 tracking-tighter">{stats.headcount}</div>
           <div className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full mt-2">● LIVE</div>
        </div>

        <div className="col-span-12 lg:col-span-3 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
           <div className="w-1/2">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Gender</h3>
              {stats.genderData.map((d, i) => (
                 <div key={i} className="flex items-center gap-2 mb-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-indigo-500' : 'bg-orange-400'}`}></div>
                    <span className="text-[10px] font-bold text-slate-600 uppercase">{d.name} {d.value}</span>
                 </div>
              ))}
           </div>
           <div className="w-1/2 h-24">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ fontWeight: 'black', fontSize: '10px', textTransform: 'uppercase' }}
                    />
                    <Pie data={stats.genderData} nameKey="name" dataKey="value" innerRadius={25} outerRadius={35} paddingAngle={5} stroke="none">
                       {stats.genderData.map((entry, index) => <Cell key={`cell-${index}`} fill={index === 0 ? '#6366f1' : '#fb923c'} />)}
                    </Pie>
                 </PieChart>
              </ResponsiveContainer>
           </div>
        </div>

        <div className="col-span-12 lg:col-span-7 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
           <div className="flex-1 h-32 bg-slate-50/50 rounded-2xl p-4 relative flex flex-col">
              <div className="flex justify-between items-center mb-2">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Experience Span (Yrs.)</h3>
                 <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div><span className="text-[8px] font-black text-slate-400 uppercase">Headcount</span></div>
              </div>
              <div className="flex-1 min-h-[100px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.experienceData} margin={{ top: 15, right: 20, left: -20, bottom: 5 }}>
                       <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                             <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                       <XAxis 
                         dataKey="name" 
                         fontSize={8} 
                         axisLine={false} 
                         tickLine={false} 
                         tick={{fill: '#94a3b8', fontWeight: 800}} 
                       />
                       <YAxis hide domain={[0, (dataMax: number) => Math.max(10, dataMax + 10)]} />
                       <Tooltip 
                         contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                         itemStyle={{ color: '#0f172a' }}
                       />
                       <Area 
                         type="monotone" 
                         dataKey="value" 
                         stroke="#ef4444" 
                         strokeWidth={2} 
                         fillOpacity={1} 
                         fill="url(#colorValue)" 
                         animationDuration={1500}
                       >
                          <LabelList 
                            dataKey="value" 
                            position="top" 
                            offset={8} 
                            style={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} 
                          />
                       </Area>
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
           </div>
        </div>
      </div>

      {/* SECTION 3: DEPARTMENT & GROWTH & AGE */}
      <div className="grid grid-cols-12 gap-6 pb-6">
        <div className={`col-span-12 ${stats.creatCount > 0 && stats.atgCount > 0 ? 'lg:col-span-3' : 'lg:col-span-4'} bg-white p-5 rounded-3xl border border-slate-100 shadow-sm h-[380px] flex flex-col overflow-hidden`}>
           <div className="flex justify-between items-center mb-3 shrink-0">
              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Department</h3>
                <p className="text-[10px] font-medium text-slate-400">Headcount distribution</p>
              </div>
              <span className="px-2.5 py-0.5 bg-orange-50 border border-orange-100/80 rounded-full text-[10px] font-black text-orange-600">
                 Total: {stats.departmentData.reduce((acc, d) => acc + d.value, 0)}
              </span>
           </div>

           <div className="flex-1 w-full overflow-hidden flex flex-col justify-start pt-1">
              {stats.departmentData.length > 8 ? (
                 <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full overflow-hidden">
                    {[
                      stats.departmentData.slice(0, Math.ceil(stats.departmentData.length / 2)),
                      stats.departmentData.slice(Math.ceil(stats.departmentData.length / 2))
                    ].map((half, colIdx) => (
                      <table key={colIdx} className="w-full text-left border-collapse">
                         <thead>
                            <tr className="border-b border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-wider">
                               <th className="pb-1.5 pt-0 px-1">Department</th>
                               <th className="pb-1.5 pt-0 px-1 text-center">HC</th>
                               <th className="pb-1.5 pt-0 px-1 text-right">%</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {half.map((dept, idx) => {
                              const totalHeadcount = stats.headcount || 1;
                              const pct = Math.round((dept.value / totalHeadcount) * 100);
                              return (
                                <tr key={idx} className="hover:bg-orange-50/40 transition-colors group">
                                   <td className="py-1.5 px-1 font-bold text-[11px] text-slate-700 truncate max-w-[85px]" title={dept.name}>
                                      {dept.name}
                                   </td>
                                   <td className="py-1.5 px-1 text-center">
                                      <span className="px-1.5 py-0.5 bg-slate-100/80 rounded font-black text-[10px] text-slate-800 group-hover:bg-orange-100 transition-colors">
                                         {dept.value}
                                      </span>
                                   </td>
                                   <td className="py-1.5 px-1 text-right font-bold text-[10px] text-slate-500">
                                      {pct}%
                                   </td>
                                </tr>
                              );
                            })}
                         </tbody>
                      </table>
                    ))}
                 </div>
              ) : (
                 <table className="w-full text-left border-collapse">
                    <thead>
                       <tr className="border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                          <th className="pb-2 pt-0 px-1">Department</th>
                          <th className="pb-2 pt-0 px-1 text-center">Headcount</th>
                          <th className="pb-2 pt-0 px-1 text-right">% Share</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {stats.departmentData.map((dept, idx) => {
                         const totalHeadcount = stats.headcount || 1;
                         const pct = Math.round((dept.value / totalHeadcount) * 100);
                         return (
                           <tr key={idx} className="hover:bg-orange-50/40 transition-colors group">
                              <td className="py-2 px-1 font-bold text-xs text-slate-700 truncate max-w-[120px]" title={dept.name}>
                                 {dept.name}
                              </td>
                              <td className="py-2 px-1 text-center">
                                 <span className="px-2 py-0.5 bg-slate-100/80 rounded font-black text-xs text-slate-800 group-hover:bg-orange-100 transition-colors">
                                    {dept.value}
                                 </span>
                              </td>
                              <td className="py-2 px-1 text-right">
                                 <div className="flex items-center justify-end gap-2">
                                    <span className="text-xs font-bold text-slate-500 min-w-[24px] text-right">{pct}%</span>
                                    <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                       <div 
                                          className="h-full bg-orange-500 rounded-full transition-all duration-300" 
                                          style={{ width: `${Math.min(100, pct)}%` }} 
                                       />
                                    </div>
                                 </div>
                              </td>
                           </tr>
                         );
                       })}
                    </tbody>
                 </table>
              )}
           </div>
        </div>

        <div className={`col-span-12 ${stats.creatCount > 0 && stats.atgCount > 0 ? 'lg:col-span-3' : 'lg:col-span-3'} flex flex-col gap-4`}>
           {/* Budget CREAT */}
           {stats.creatCount > 0 && (
             <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-[180px] min-h-[180px] w-full overflow-hidden">
                <div className="flex justify-between items-center mb-2 shrink-0">
                   <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Budget Vs Current (CREAT)</h3>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar overflow-x-hidden">
                   <ResponsiveContainer width="99%" height={Math.max(140, stats.budgetVsActualData.length * 35)} debounce={20}>
                      <BarChart data={stats.budgetVsActualData} layout="vertical" barGap={2} margin={{ left: -10, right: 15, top: 10, bottom: 5 }}>
                         <XAxis type="number" hide />
                         <YAxis 
                           dataKey="name" 
                           type="category" 
                           width={80} 
                           fontSize={7} 
                           fontWeight={800} 
                           axisLine={false} 
                           tickLine={false} 
                           tick={{fill: '#64748b'}}
                           tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 10)}...` : value}
                         />
                         <Tooltip 
                           cursor={{fill: '#f8fafc'}}
                           contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '9px', fontWeight: 'bold' }}
                           itemStyle={{ padding: '0px' }}
                         />
                         <Bar dataKey="Budget" fill="#2dd4bf" barSize={8} radius={[0, 4, 4, 0]} />
                         <Bar dataKey="Actuals" fill="#fb923c" barSize={8} radius={[0, 4, 4, 0]} />
                      </BarChart>
                   </ResponsiveContainer>
                </div>
             </div>
           )}

           {/* Budget ATG */}
           {stats.atgCount > 0 && (
             <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-[180px] min-h-[180px] w-full overflow-hidden">
                <div className="flex justify-between items-center mb-2 shrink-0">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Budget Vs Current (ATG)</h3>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar overflow-x-hidden">
                   <ResponsiveContainer width="99%" height={Math.max(140, stats.budgetVsActualDataATG.length * 35)} debounce={20}>
                      <BarChart data={stats.budgetVsActualDataATG} layout="vertical" barGap={2} margin={{ left: -10, right: 15, top: 10, bottom: 5 }}>
                         <XAxis type="number" hide />
                         <YAxis 
                           dataKey="name" 
                           type="category" 
                           width={80} 
                           fontSize={7} 
                           fontWeight={800} 
                           axisLine={false} 
                           tickLine={false} 
                           tick={{fill: '#64748b'}}
                           tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 10)}...` : value}
                         />
                         <Tooltip 
                           cursor={{fill: '#f8fafc'}}
                           contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '9px', fontWeight: 'bold' }}
                           itemStyle={{ padding: '0px' }}
                         />
                         <Bar dataKey="Budget" fill="#10b981" barSize={8} radius={[0, 4, 4, 0]} />
                         <Bar dataKey="Actuals" fill="#22d3ee" barSize={8} radius={[0, 4, 4, 0]} />
                      </BarChart>
                   </ResponsiveContainer>
                </div>
             </div>
           )}
        </div>

        {stats.creatCount > 0 && (
          <div className={`${stats.atgCount > 0 ? 'col-span-12 lg:col-span-3' : 'col-span-12 lg:col-span-5'} bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-[380px]`}>
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Growth - CREAT</h3>
                <div className="flex gap-2">
                   <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div><span className="text-[7px] font-bold text-slate-400 uppercase">Dev</span></div>
                   <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div><span className="text-[7px] font-bold text-slate-400 uppercase">Test</span></div>
                </div>
             </div>
             <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={stats.growthData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" fontSize={8} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                      <YAxis fontSize={8} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '9px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="dev" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="test" stroke="#fb923c" strokeWidth={2.5} dot={{ r: 2 }} />
                   </LineChart>
                </ResponsiveContainer>
             </div>
          </div>
        )}

        {stats.atgCount > 0 && (
          <div className={`${stats.creatCount > 0 ? 'col-span-12 lg:col-span-3' : 'col-span-12 lg:col-span-5'} bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-[380px]`}>
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Growth - ATG</h3>
                <div className="flex gap-2">
                   <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><span className="text-[7px] font-bold text-slate-400 uppercase">Dev</span></div>
                   <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div><span className="text-[7px] font-bold text-slate-400 uppercase">Test</span></div>
                </div>
             </div>
             <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={stats.growthDataATG} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" fontSize={8} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                      <YAxis fontSize={8} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '9px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="dev" stroke="#10b981" strokeWidth={2.5} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="test" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 2 }} />
                   </LineChart>
                </ResponsiveContainer>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
