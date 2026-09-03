import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Employee, ProjectData, FiscalYear } from '../types';
import { HOURS_PER_MONTH, SKILL_ORDER, MAX_MONTHS } from '../constants';
import { Search, Filter, Download, User, Briefcase, Clock, TrendingDown, TrendingUp, ChevronDown, ChevronRight, Plus, Minus } from 'lucide-react';

interface EmployeeAnalysisProps {
  employees: Employee[];
  projects: ProjectData[];
  allProjects?: ProjectData[];
  months: string[];
  selectedFY: FiscalYear;
  mode?: string | string[];
  hideMetricsRow?: boolean;
}

const EmployeeAnalysis: React.FC<EmployeeAnalysisProps> = ({ 
  employees, 
  projects, 
  allProjects,
  months, 
  selectedFY, 
  mode,
  hideMetricsRow = false 
}) => {
  const [search, setSearch] = useState("");
  const [minIdlePct, setMinIdlePct] = useState(0);
  const [idleType, setIdleType] = useState<'explicit' | 'effective'>('explicit');
  const [groupBySkill, setGroupBySkill] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const accelerationRef = useRef(1);

  const adjustIdlePct = (delta: number) => {
    setMinIdlePct(prev => Math.max(0, Math.min(100, prev + delta)));
  };

  const startAdjusting = (delta: number) => {
    adjustIdlePct(delta);
    let count = 0;
    const interval = setInterval(() => {
      count++;
      // Accelerate after 5 ticks
      const speed = count > 15 ? 5 : (count > 5 ? 2 : 1);
      adjustIdlePct(delta * speed);
    }, 100);
    timerRef.current = interval;
  };

  const stopAdjusting = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopAdjusting();
  }, []);
  const [expandedSkills, setExpandedSkills] = useState<Record<string, boolean>>({});

  const monthIndices = useMemo(() => {
    return months.map(m => {
      const parts = m.split('-');
      const monthName = parts[0];
      const yearVal = parseInt(parts[1]);
      const year = yearVal < 100 ? 2000 + yearVal : yearVal;
      const monthIdx = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(monthName);
      return (year - 2019) * 12 + monthIdx - 3;
    });
  }, [months]);

  const targetEmployees = useMemo(() => {
    if (projects.length === 1) {
      const p = projects[0];
      return employees.filter(emp => {
        const email = emp.email?.toLowerCase();
        if (!email) return false;
        const inInfo = !!(p.employeeInfo && p.employeeInfo[email]);
        const inSkills = ['employeeSkills', 'actualsEmployeeSkills', 'forecastEmployeeSkills'].some(key => {
          const skillsMap = (p as any)[key];
          if (!skillsMap) return false;
          return Object.values(skillsMap).some((sMap: any) => !!sMap?.[email]);
        });
        return inInfo || inSkills;
      });
    }
    return employees;
  }, [employees, projects]);

  const projectsForCalculation = useMemo(() => {
    return (allProjects && allProjects.length > 0) ? allProjects : projects;
  }, [allProjects, projects]);

  const analysisData = useMemo(() => {
    const data = targetEmployees.map(emp => {
      const email = emp.email?.toLowerCase() || '';
      const projectsForEmp = projects.filter(p => p.employeeInfo && p.employeeInfo[email]);
      const calcProjectsForEmp = projectsForCalculation.filter(p => p.employeeInfo && p.employeeInfo[email]);
      
      const numMonths = months.length;
      const monthlyIdle = new Array(numMonths).fill(0);
      let totalIdle = 0;

      projectsForEmp.forEach(p => {
        if (p.employeeIdleHours && p.employeeIdleHours[email]) {
          const fullArray = p.employeeIdleHours[email];
          monthIndices.forEach((globalIdx, i) => {
            const h = (typeof fullArray[globalIdx] === 'number' && !isNaN(fullArray[globalIdx])) ? fullArray[globalIdx] : 0;
            monthlyIdle[i] += h;
            totalIdle += h;
          });
        }
      });

      const monthlyUtilization = new Array(numMonths).fill(0);
      const activeModes = Array.isArray(mode) ? mode : [mode || 'Budget'];
      
      calcProjectsForEmp.forEach(p => {
        activeModes.forEach(mVal => {
          const empSkillsKey = mVal === 'Actuals' ? 'actualsEmployeeSkills' : (mVal === 'Forecast' ? 'forecastEmployeeSkills' : 'employeeSkills');
          const targetEmployeeSkills = p[empSkillsKey] || (mVal === 'Budget' ? p.employeeSkills : {});
          if (targetEmployeeSkills) {
            Object.values(targetEmployeeSkills).forEach((skillMap: any) => {
              if (skillMap[email]) {
                const fullArray = skillMap[email];
                monthIndices.forEach((globalIdx, i) => {
                  const alloc = (typeof fullArray[globalIdx] === 'number' && !isNaN(fullArray[globalIdx])) ? fullArray[globalIdx] : 0;
                  monthlyUtilization[i] += alloc;
                });
              }
            });
          }
        });
      });

      const monthlyUnallocatedPct = monthlyUtilization.map(u => Math.max(0, 100 - Math.round(u * 100)));
      const monthlyExplicitIdlePct = monthlyIdle.map(h => Math.round((h / HOURS_PER_MONTH) * 100));
      const monthlyEffectiveIdlePct = monthlyUnallocatedPct.map((unalloc, i) => Math.max(unalloc, monthlyExplicitIdlePct[i]));
      
      const overallExplicitPct = numMonths > 0 ? Math.round(monthlyExplicitIdlePct.reduce((a, b) => a + b, 0) / numMonths) : 0;
      const overallEffectivePct = numMonths > 0 ? Math.round(monthlyEffectiveIdlePct.reduce((a, b) => a + b, 0) / numMonths) : 0;

      const overallUtilization = numMonths > 0 ? Math.round(monthlyUtilization.reduce((a, b) => a + b, 0) / numMonths * 100) : 0;

      const monthlyBillable = new Array(numMonths).fill(0);
      projectsForEmp.forEach(p => {
        if (p.employeeBillableHours && p.employeeBillableHours[email]) {
          const fullArray = p.employeeBillableHours[email];
          monthIndices.forEach((globalIdx, i) => {
            const h = (typeof fullArray[globalIdx] === 'number' && !isNaN(fullArray[globalIdx])) ? fullArray[globalIdx] : 0;
            monthlyBillable[i] += h;
          });
        }
      });

      const overallBillablePct = numMonths > 0 ? Math.round(monthlyBillable.reduce((a, b) => a + b, 0) / (numMonths * HOURS_PER_MONTH) * 100) : 0;

      return {
        ...emp,
        monthlyIdlePct: monthlyExplicitIdlePct,
        monthlyUnallocatedPct,
        monthlyEffectiveIdlePct,
        overallExplicitPct,
        overallEffectivePct,
        overallUtilization,
        overallBillablePct,
        overallIdlePct: idleType === 'explicit' ? overallExplicitPct : overallEffectivePct
      };
    }).filter(emp => emp.overallIdlePct > 0 && emp.overallIdlePct >= minIdlePct)
      .filter(emp => !search || emp.name.toLowerCase().includes(search.toLowerCase()) || emp.empId?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.overallIdlePct - a.overallIdlePct);

    if (!groupBySkill) return { flat: data, grouped: {} };

    const grouped: Record<string, typeof data> = {};
    data.forEach(emp => {
      const skill = emp.skill || 'Unspecified';
      if (skill === 'Contracted Employee' || skill === 'Contracted Employee(CUSTOM)' || skill === 'Consultant') return;
      if (!grouped[skill]) grouped[skill] = [];
      grouped[skill].push(emp);
    });

    return { flat: data, grouped };
  }, [targetEmployees, projects, projectsForCalculation, search, minIdlePct, idleType, groupBySkill]);

  const stats = useMemo(() => {
    const data = analysisData.flat;
    const totalEmployees = employees.length;
    const idleCount = data.length;
    
    const numMonths = months.length;
    // Calculate overall utilization across ALL employees
    const activeModes = Array.isArray(mode) ? mode : [mode || 'Budget'];
    const allEmpsData = employees.map(emp => {
      const email = emp.email?.toLowerCase() || '';
      const projectsForEmp = projects.filter(p => p.employeeInfo && p.employeeInfo[email]);
      const monthlyUtilization = new Array(numMonths).fill(0);
      projectsForEmp.forEach(p => {
        activeModes.forEach(mVal => {
          const empSkillsKey = mVal === 'Actuals' ? 'actualsEmployeeSkills' : (mVal === 'Forecast' ? 'forecastEmployeeSkills' : 'employeeSkills');
          const targetEmployeeSkills = p[empSkillsKey] || (mVal === 'Budget' ? p.employeeSkills : {});
          if (targetEmployeeSkills) {
            Object.values(targetEmployeeSkills).forEach((skillMap: any) => {
              if (skillMap[email]) {
                const fullArray = skillMap[email];
                monthIndices.forEach((globalIdx, i) => {
                  const alloc = (typeof fullArray[globalIdx] === 'number' && !isNaN(fullArray[globalIdx])) ? fullArray[globalIdx] : 0;
                  monthlyUtilization[i] += alloc;
                });
              }
            });
          }
        });
      });
      return numMonths > 0 ? monthlyUtilization.reduce((a, b) => a + b, 0) / numMonths : 0;
    });
    
    const avgUtilization = totalEmployees > 0 
      ? Math.round((allEmpsData.reduce((a, b) => a + b, 0) / totalEmployees) * 100)
      : 0;

    const avgIdle = idleCount > 0
      ? Math.round(data.reduce((acc, curr) => acc + curr.overallIdlePct, 0) / idleCount)
      : 0;

    const totalBillablePct = employees.reduce((acc, emp) => {
      const email = emp.email?.toLowerCase() || '';
      const projectsForEmp = projects.filter(p => p.employeeInfo && p.employeeInfo[email]);
      const monthlyBillable = new Array(numMonths).fill(0);
      projectsForEmp.forEach(p => {
        if (p.employeeBillableHours && p.employeeBillableHours[email]) {
          const fullArray = p.employeeBillableHours[email];
          monthIndices.forEach((globalIdx, i) => {
            const h = (typeof fullArray[globalIdx] === 'number' && !isNaN(fullArray[globalIdx])) ? fullArray[globalIdx] : 0;
            monthlyBillable[i] += h;
          });
        }
      });
      const overallBillable = numMonths > 0 ? Math.round(monthlyBillable.reduce((a, b) => a + b, 0) / (numMonths * HOURS_PER_MONTH) * 100) : 0;
      return acc + overallBillable;
    }, 0);

    const avgBillablePct = totalEmployees > 0 ? Math.round(totalBillablePct / totalEmployees) : 0;

    return {
      avgIdle,
      idleCount,
      totalEmployees,
      avgUtilization,
      avgBillablePct
    };
  }, [analysisData, employees, projects]);

  const toggleSkill = (skill: string) => {
    setExpandedSkills(prev => ({ ...prev, [skill]: !prev[skill] }));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Stats */}
      {!hideMetricsRow && projects.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-1 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Employee Analysis</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Idle Capacity Monitoring
          </p>
        </div>
        
        <div className="bg-emerald-50 rounded-3xl p-6 border border-emerald-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block">Overall Utilization</span>
            <span className="text-2xl font-black text-emerald-900">{stats.avgUtilization}%</span>
          </div>
        </div>

        <div className="bg-indigo-50 rounded-3xl p-6 border border-indigo-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
            <User className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black text-indigo-800 uppercase tracking-widest block">Total Employees</span>
            <span className="text-2xl font-black text-indigo-900">{stats.totalEmployees}</span>
          </div>
        </div>

        <div className="bg-blue-50 rounded-3xl p-6 border border-blue-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest block">Billable %</span>
            <span className="text-2xl font-black text-blue-900">{stats.avgBillablePct}%</span>
          </div>
        </div>

        <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest block">Idle Employees</span>
            <span className="text-2xl font-black text-amber-900">{stats.idleCount}</span>
          </div>
        </div>
      </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex bg-slate-100 rounded-xl p-1">
          <button 
            onClick={() => setIdleType('explicit')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${idleType === 'explicit' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
          >
            Explicit Idle (Tasks)
          </button>
          <button 
            onClick={() => setIdleType('effective')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${idleType === 'effective' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
          >
            Effective Idle (Total)
          </button>
        </div>

        <button 
          onClick={() => setGroupBySkill(!groupBySkill)}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${groupBySkill ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          {groupBySkill ? 'Grouped by Skill' : 'Flat List'}
        </button>

        <div className="relative flex-grow max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search by name or ID..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Min Idle %:</span>
          <div className="flex items-center gap-2">
            <button 
              onMouseDown={() => startAdjusting(-1)}
              onMouseUp={stopAdjusting}
              onMouseLeave={stopAdjusting}
              className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
            >
              <Minus className="w-3 h-3" />
            </button>
            <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden relative group">
              <div 
                className="absolute left-0 top-0 h-full bg-indigo-600 transition-all duration-150"
                style={{ width: `${minIdlePct}%` }}
              />
              <input 
                type="range"
                min="0"
                max="100"
                step="1"
                value={minIdlePct}
                onChange={(e) => setMinIdlePct(parseInt(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <button 
              onMouseDown={() => startAdjusting(1)}
              onMouseUp={stopAdjusting}
              onMouseLeave={stopAdjusting}
              className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <span className="text-xs font-black text-indigo-600 w-10 text-center">{minIdlePct}%</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 text-[9px] font-black uppercase tracking-widest">
              <tr>
                <th className="px-4 py-4 w-[40px]">#</th>
                <th className="px-6 py-4 w-[200px]">Name</th>
                <th className="px-6 py-4 w-[200px]">Email ID</th>
                <th className="px-6 py-4 w-[150px] text-center">Overall {idleType === 'explicit' ? 'Task' : 'Total'} Idle %</th>
                {months.map(m => (
                  <th key={m} className="px-6 py-4 w-[100px] text-center">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.idleCount === 0 ? (
                <tr>
                  <td colSpan={months.length + 4} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Briefcase className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-sm font-black uppercase tracking-widest">No idle employees found</p>
                      <p className="text-[10px] font-bold mt-1">Adjust your filters to see more results</p>
                    </div>
                  </td>
                </tr>
              ) : groupBySkill ? (
                Object.entries(analysisData.grouped).sort((a, b) => {
                  const indexA = SKILL_ORDER.indexOf(a[0]);
                  const indexB = SKILL_ORDER.indexOf(b[0]);
                  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                  if (indexA !== -1) return -1;
                  if (indexB !== -1) return 1;
                  return a[0].localeCompare(b[0]);
                }).map(([skill, emps]) => (
                  <React.Fragment key={skill}>
                    <tr 
                      className="bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors"
                      onClick={() => toggleSkill(skill)}
                    >
                      <td className="px-4 py-2 font-black text-slate-500 uppercase text-[10px] flex items-center gap-2">
                        {expandedSkills[skill] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </td>
                      <td className="px-6 py-2 font-black text-slate-500 uppercase text-[10px]" colSpan={2}>
                        {skill} <span className="ml-2 text-[8px] bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded-full">{emps.length} Employees</span>
                      </td>
                      <td className="px-6 py-4 font-black text-slate-500 text-[10px] text-center">
                        {Math.round(emps.reduce((acc, curr) => acc + curr.overallIdlePct, 0) / emps.length)}%
                      </td>
                      {months.map((_, i) => {
                        const avgIdle = Math.round(emps.reduce((acc, curr) => acc + (idleType === 'explicit' ? curr.monthlyIdlePct[i] : curr.monthlyEffectiveIdlePct[i]), 0) / emps.length);
                        return (
                          <td key={i} className="px-6 py-4 font-black text-slate-500 text-[10px] text-center">
                            {avgIdle}%
                          </td>
                        );
                      })}
                    </tr>
                    {expandedSkills[skill] && emps.map((emp, index) => (
                      <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-4 py-4 text-[10px] font-bold text-slate-500 w-[40px]">{index + 1}</td>
                        <td className="px-6 py-4 text-[10px] font-black text-slate-900 w-[200px]">
                          {emp.name}
                        </td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-600 w-[200px]">{emp.email}</td>
                        <td className="px-6 py-4 text-center w-[150px]">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-[12px] font-black ${emp.overallIdlePct > 50 ? 'text-rose-600' : emp.overallIdlePct > 20 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {emp.overallIdlePct}%
                            </span>
                            <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${emp.overallIdlePct > 50 ? 'bg-rose-500' : emp.overallIdlePct > 20 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${emp.overallIdlePct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        {months.map((_, i) => {
                          const idle = idleType === 'explicit' ? emp.monthlyIdlePct[i] : emp.monthlyEffectiveIdlePct[i];
                          return (
                            <td key={i} className="px-6 py-4 text-center w-[100px]">
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`text-[10px] font-black ${idle > 50 ? 'text-rose-600' : idle > 20 ? 'text-amber-600' : 'text-slate-400'}`}>
                                  {idle > 0 ? `${idle}%` : '0%'}
                                </span>
                                {idle > 0 && (
                                  <div className="flex flex-col text-[7px] font-bold uppercase tracking-tighter leading-none opacity-60">
                                    {idleType === 'effective' && emp.monthlyIdlePct[i] > 0 && <span className="text-slate-500">Task: {emp.monthlyIdlePct[i]}%</span>}
                                    {idleType === 'effective' && emp.monthlyUnallocatedPct[i] > 0 && <span className="text-indigo-400">Unalloc: {emp.monthlyUnallocatedPct[i]}%</span>}
                                    {idleType === 'explicit' && emp.monthlyUnallocatedPct[i] > 0 && <span className="text-indigo-400">Unalloc: {emp.monthlyUnallocatedPct[i]}%</span>}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                analysisData.flat.map((emp, index) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-4 text-[10px] font-bold text-slate-500 w-[40px]">{index + 1}</td>
                    <td className="px-6 py-4 text-[10px] font-black text-slate-900 w-[200px]">
                      {emp.name}
                    </td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-600 w-[200px]">{emp.email}</td>
                    <td className="px-6 py-4 text-center w-[150px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-[12px] font-black ${emp.overallIdlePct > 50 ? 'text-rose-600' : emp.overallIdlePct > 20 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {emp.overallIdlePct}%
                        </span>
                        <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${emp.overallIdlePct > 50 ? 'bg-rose-500' : emp.overallIdlePct > 20 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${emp.overallIdlePct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    {months.map((_, i) => {
                      const idle = idleType === 'explicit' ? emp.monthlyIdlePct[i] : emp.monthlyEffectiveIdlePct[i];
                      return (
                        <td key={i} className="px-6 py-4 text-center w-[100px]">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`text-[10px] font-black ${idle > 50 ? 'text-rose-600' : idle > 20 ? 'text-amber-600' : 'text-slate-400'}`}>
                              {idle > 0 ? `${idle}%` : '0%'}
                            </span>
                            {idle > 0 && (
                              <div className="flex flex-col text-[7px] font-bold uppercase tracking-tighter leading-none opacity-60">
                                {idleType === 'effective' && emp.monthlyIdlePct[i] > 0 && <span className="text-slate-500">Task: {emp.monthlyIdlePct[i]}%</span>}
                                {idleType === 'effective' && emp.monthlyUnallocatedPct[i] > 0 && <span className="text-indigo-400">Unalloc: {emp.monthlyUnallocatedPct[i]}%</span>}
                                {idleType === 'explicit' && emp.monthlyUnallocatedPct[i] > 0 && <span className="text-indigo-400">Unalloc: {emp.monthlyUnallocatedPct[i]}%</span>}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmployeeAnalysis;
