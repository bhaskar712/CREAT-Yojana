import React, { useMemo, useState, useRef, useEffect } from "react";
import { Employee, ProjectData, FiscalYear } from "../types";
import { SKILL_ORDER } from "../constants";
import { calculateRosterData } from "../lib/rosterUtils";
import { EmployeeRow } from "./roster/EmployeeRow";
import {
  ChevronDown,
  ChevronRight,
  Briefcase,
  User,
  Clock,
  Plus,
  Minus,
  Search,
  TrendingUp,
} from "lucide-react";

interface EmployeeRosterProps {
  employees: Employee[];
  projects: ProjectData[];
  months: string[];
  viewMode?: "tabular" | "graphical";
  selectedFY: FiscalYear;
  mode?: string | string[];
  hideMetricsRow?: boolean;
}

const EmployeeRoster: React.FC<EmployeeRosterProps> = ({
  employees,
  projects,
  months,
  viewMode = "tabular",
  selectedFY,
  mode,
  hideMetricsRow = false,
}) => {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [expandedSkills, setExpandedSkills] = useState<Record<string, boolean>>(
    {},
  );
  const [expandedTaskLists, setExpandedTaskLists] = useState<
    Record<string, boolean>
  >({});
  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >({});
  const [taskViewMode, setTaskViewMode] = useState<"hours" | "percentage">(
    "hours",
  );
  const [groupBySkill, setGroupBySkill] = useState(true);
  const [minIdlePct, setMinIdlePct] = useState(0);
  const [search, setSearch] = useState("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const accelerationRef = useRef(1);

  const adjustIdlePct = (delta: number) => {
    setMinIdlePct((prev) => Math.max(0, Math.min(100, prev + delta)));
  };

  const startAdjusting = (delta: number) => {
    adjustIdlePct(delta);
    let count = 0;
    const interval = setInterval(() => {
      count++;
      const speed = count > 15 ? 5 : count > 5 ? 2 : 1;
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

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSkill = (skill: string) => {
    setExpandedSkills((prev) => ({ ...prev, [skill]: !prev[skill] }));
  };

  const toggleTaskList = (
    empId: string,
    projectCode: string,
    taskList: string,
  ) => {
    const key = `${empId}-${projectCode}-${taskList}`;
    setExpandedTaskLists((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
  };

  const toggleProject = (empId: string, projectCode: string) => {
    const key = `${empId}-${projectCode}`;
    setExpandedProjects((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
  };

  const monthIndices = useMemo(() => {
    return months.map((m) => {
      const parts = m.split(" ");
      if (parts.length < 2) return 0;
      const monthName = parts[0];
      const year = parseInt(parts[1]);
      const monthIdx = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ].indexOf(monthName);
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

  const rosterData = useMemo(() => {
    return calculateRosterData(targetEmployees, projects, monthIndices, mode);
  }, [targetEmployees, projects, monthIndices, mode]);

  const {
    processedEmployees: allEmployees,
    skillSummary,
  } = rosterData;

  const processedEmployees = useMemo(() => {
    return allEmployees.filter((emp: any) => {
      const matchesSearch =
        emp.name.toLowerCase().includes(search.toLowerCase()) ||
        emp.id.toLowerCase().includes(search.toLowerCase());
      const matchesIdle = emp.overallIdlePct >= minIdlePct;
      return matchesSearch && matchesIdle;
    }).sort((a: any, b: any) => (b.totalHours || 0) - (a.totalHours || 0));
  }, [allEmployees, search, minIdlePct]);

  const groupedBySkill = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    processedEmployees.forEach((emp: any) => {
      const skill =
        emp.skill && emp.skill !== "Unknown"
          ? emp.skill
          : emp.skillLevel2 && emp.skillLevel2 !== "Unknown"
            ? emp.skillLevel2
            : "Uncategorized";
      if (!grouped[skill]) grouped[skill] = [];
      grouped[skill].push(emp);
    });
    return grouped;
  }, [processedEmployees]);

  const idleAnalytics = useMemo(() => {
    if (!processedEmployees || processedEmployees.length === 0) return null;

    // Define idle as (100 - utilization) OR explicit idle hours
    const totalEmployees = processedEmployees.length;
    const allUtilizationSum = processedEmployees.reduce(
      (acc: number, emp: any) => acc + emp.overallUtilization,
      0,
    );
    const avgUtilization =
      totalEmployees > 0 ? allUtilizationSum / totalEmployees : 0;

    const empsWithIdle = processedEmployees.map((emp: any) => {
      const unallocatedPct = Math.max(0, 100 - emp.overallUtilization);
      const explicitIdlePct = emp.overallIdlePct || 0;
      const effectiveIdlePct = Math.max(unallocatedPct, explicitIdlePct);
      return { ...emp, effectiveIdlePct, explicitIdlePct };
    });

    const idleCount = empsWithIdle.filter(
      (emp: any) => emp.explicitIdlePct > 0,
    ).length;
    const totalIdlePct = empsWithIdle.reduce(
      (acc: number, emp: any) => acc + emp.effectiveIdlePct,
      0,
    );
    const overallIdleAvg = totalIdlePct / (processedEmployees.length || 1);

    const totalBillablePct = processedEmployees.reduce(
      (acc: number, emp: any) => acc + (emp.overallBillablePct || 0),
      0,
    );
    const avgBillablePct =
      totalEmployees > 0 ? totalBillablePct / totalEmployees : 0;

    return {
      overallIdleAvg,
      idleCount,
      totalCount: totalEmployees,
      avgUtilization,
      avgBillablePct,
    };
  }, [processedEmployees]);

  return (
    <div className="flex flex-col gap-6">
      {/* Analytics Summary */}
      {idleAnalytics && !hideMetricsRow && projects.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-1 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Employee Roster
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Workforce Allocation Overview
            </p>
          </div>

          <div className="bg-emerald-50 rounded-3xl p-6 border border-emerald-100 shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block">
                Overall Utilization
              </span>
              <span className="text-2xl font-black text-emerald-900">
                {Math.round(idleAnalytics.avgUtilization || 0)}%
              </span>
            </div>
          </div>

          <div className="bg-indigo-50 rounded-3xl p-6 border border-indigo-100 shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
              <User className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black text-indigo-800 uppercase tracking-widest block">
                Total Employees
              </span>
              <span className="text-2xl font-black text-indigo-900">
                {idleAnalytics.totalCount}
              </span>
            </div>
          </div>

          <div className="bg-blue-50 rounded-3xl p-6 border border-blue-100 shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest block">
                Billable %
              </span>
              <span className="text-2xl font-black text-blue-900">
                {Math.round(idleAnalytics.avgBillablePct || 0)}%
              </span>
            </div>
          </div>

          <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100 shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest block">
                Idle Employees
              </span>
              <span className="text-2xl font-black text-amber-900">
                {idleAnalytics.idleCount}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-4">
          <button
            onClick={() => setGroupBySkill(!groupBySkill)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${groupBySkill ? "bg-indigo-600 border-indigo-600 text-white shadow-md" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {groupBySkill ? "Grouped by Skill" : "Flat List"}
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
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Min Idle %:
            </span>
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
            <span className="text-xs font-black text-indigo-600 w-10 text-center">
              {minIdlePct}%
            </span>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg ml-auto">
            <button
              onClick={() => setTaskViewMode("hours")}
              className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${taskViewMode === "hours" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Hours
            </button>
            <button
              onClick={() => setTaskViewMode("percentage")}
              className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${taskViewMode === "percentage" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Percentage
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-[9px] font-black uppercase tracking-widest">
              <tr>
                <th className="px-4 py-4 w-[40px]">#</th>
                <th className="px-6 py-4 w-[200px]">Name</th>
                <th className="px-6 py-4 w-[200px]">Email ID</th>
                <th className="px-6 py-4 w-[150px]">
                  {taskViewMode === "hours"
                    ? "Overall Hours"
                    : "Overall Util %"}
                </th>
                {months.map((m) => (
                  <th key={m} className="px-6 py-4 w-[100px]">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupBySkill
                ? (Object.entries(groupedBySkill) as [string, any[]][])
                    .sort(([skillA], [skillB]) => {
                      const indexA = SKILL_ORDER.indexOf(skillA);
                      const indexB = SKILL_ORDER.indexOf(skillB);
                      if (indexA !== -1 && indexB !== -1)
                        return indexA - indexB;
                      if (indexA !== -1) return -1;
                      if (indexB !== -1) return 1;
                      return skillA.localeCompare(skillB);
                    })
                    .map(([skill, employees]) => {
                      const filteredEmployees = employees;
                      if (filteredEmployees.length === 0) return null;
                      const isSkillExpanded = expandedSkills[skill] ?? false;

                      return (
                        <React.Fragment key={skill}>
                          <tr
                            className="bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors"
                            onClick={() => toggleSkill(skill)}
                          >
                            <td className="px-4 py-2 font-black text-slate-500 uppercase text-[10px] flex items-center gap-2">
                              {isSkillExpanded ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </td>
                            <td
                              className="px-6 py-2 font-black text-slate-500 uppercase text-[10px]"
                              colSpan={2}
                            >
                              {skill}
                            </td>
                            <td className="px-6 py-4 font-black text-slate-500 text-[10px]">
                              <div className="flex flex-col">
                                <span>
                                  {taskViewMode === "hours"
                                    ? `${Math.round(skillSummary[skill]?.totalHours || 0)} hrs`
                                    : `${Math.round(skillSummary[skill]?.overallUtilization || 0)}%`}
                                </span>
                              </div>
                            </td>
                            {skillSummary[skill]?.monthlyUtilization.map(
                              (util: number, i: number) => (
                                <td
                                  key={i}
                                  className="px-6 py-4 font-black text-slate-500 text-[10px]"
                                >
                                  <div className="flex flex-col">
                                    <span>
                                      {taskViewMode === "hours"
                                        ? `${Math.round(skillSummary[skill]?.monthlyHours[i] || 0)}`
                                        : `${Math.round(util || 0)}%`}
                                    </span>
                                  </div>
                                </td>
                              ),
                            )}
                          </tr>
                          {isSkillExpanded &&
                            filteredEmployees.map((emp: any, index: number) => (
                              <EmployeeRow
                                key={emp.id}
                                emp={emp}
                                index={index}
                                isExpanded={expandedRows[emp.id] ?? false}
                                toggleRow={() => toggleRow(emp.id)}
                                taskViewMode={taskViewMode}
                                viewMode={viewMode}
                                months={months}
                                expandedProjects={expandedProjects}
                                toggleProject={(projectCode) =>
                                  toggleProject(emp.id, projectCode)
                                }
                                expandedTaskLists={expandedTaskLists}
                                toggleTaskList={(projectCode, taskList) =>
                                  toggleTaskList(emp.id, projectCode, taskList)
                                }
                                monthIndices={monthIndices}
                              />
                            ))}
                        </React.Fragment>
                      );
                    })
                : processedEmployees.map((emp: any, index: number) => (
                    <EmployeeRow
                      key={emp.id}
                      emp={emp}
                      index={index}
                      isExpanded={expandedRows[emp.id] ?? false}
                      toggleRow={() => toggleRow(emp.id)}
                      taskViewMode={taskViewMode}
                      viewMode={viewMode}
                      months={months}
                      expandedProjects={expandedProjects}
                      toggleProject={(projectCode) =>
                        toggleProject(emp.id, projectCode)
                      }
                      expandedTaskLists={expandedTaskLists}
                      toggleTaskList={(projectCode, taskList) =>
                        toggleTaskList(emp.id, projectCode, taskList)
                      }
                      monthIndices={monthIndices}
                    />
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmployeeRoster;
