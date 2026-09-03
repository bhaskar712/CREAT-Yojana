import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { EmployeeGraphicalDetails } from "../EmployeeGraphicalDetails";
import { ProjectRow } from "./ProjectRow";

interface EmployeeRowProps {
  emp: any;
  index: number;
  isExpanded: boolean;
  toggleRow: () => void;
  taskViewMode: "hours" | "percentage";
  viewMode: "tabular" | "graphical";
  months: string[];
  expandedProjects: Record<string, boolean>;
  toggleProject: (projectCode: string) => void;
  expandedTaskLists: Record<string, boolean>;
  toggleTaskList: (projectCode: string, taskList: string) => void;
  monthIndices: number[];
}

export const EmployeeRow: React.FC<EmployeeRowProps> = ({
  emp,
  index,
  isExpanded,
  toggleRow,
  taskViewMode,
  viewMode,
  months,
  expandedProjects,
  toggleProject,
  expandedTaskLists,
  toggleTaskList,
  monthIndices,
}) => {
  return (
    <React.Fragment>
      <tr
        className="hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={toggleRow}
      >
        <td className="px-4 py-4 text-[10px] font-bold text-slate-500 w-[40px]">
          {index + 1}
        </td>
        <td className="px-6 py-4 text-[10px] font-black text-slate-900 flex items-center gap-2 w-[200px]">
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          {emp.name}
        </td>
        <td className="px-6 py-4 text-[10px] font-bold text-slate-600 w-[200px]">
          {emp.email}
        </td>
        <td className="px-6 py-4 text-[10px] font-bold text-slate-600 w-[150px]">
          <div className="flex flex-col gap-1">
            <span className="text-[12px]">
              {taskViewMode === "hours"
                ? `${Math.round(emp.totalHours || 0)} hrs`
                : `${Math.round(emp.overallUtilization || 0)}%`}
            </span>
            <div className="flex gap-2 text-[9px]">
              <span className="text-emerald-600" title="Billable">
                {taskViewMode === "hours"
                  ? `B: ${Math.round(emp.totalBillable || 0)}`
                  : `B: ${Math.round(emp.overallBillablePct || 0)}%`}
              </span>
              <span className="text-amber-600" title="Non-Billable">
                {taskViewMode === "hours"
                  ? `NB: ${Math.round(emp.totalNonBillable || 0)}`
                  : `NB: ${Math.round(emp.overallNonBillablePct || 0)}%`}
              </span>
              <span className="text-slate-400" title="Idle">
                {taskViewMode === "hours"
                  ? `I: ${Math.round(emp.totalIdle || 0)}`
                  : `I: ${Math.round(emp.overallIdlePct || 0)}%`}
              </span>
            </div>
          </div>
        </td>
        {emp.monthlyUtilization.map((util: number, i: number) => (
          <td
            key={i}
            className={`px-6 py-4 text-[10px] font-bold w-[100px] ${
              util > 100
                ? "bg-red-100 text-red-900"
                : util > 80
                  ? "bg-amber-100 text-amber-900"
                  : util > 0
                    ? "bg-emerald-50 text-emerald-900"
                    : "text-slate-600"
            }`}
          >
            <div className="flex flex-col gap-1">
              <span>
                {taskViewMode === "hours"
                  ? `${Math.round(emp.monthlyHours[i] || 0)}`
                  : `${Math.round(util || 0)}%`}
              </span>
              {util > 0 && (
                <div className="flex flex-col gap-0.5 text-[8px] opacity-80 font-medium">
                  {emp.monthlyBillablePct[i] > 0 && (
                    <span className="text-emerald-700" title="Billable">
                      {taskViewMode === "hours"
                        ? `B: ${Math.round(emp.monthlyBillable[i] || 0)}`
                        : `B: ${Math.round(emp.monthlyBillablePct[i] || 0)}%`}
                    </span>
                  )}
                  {emp.monthlyNonBillablePct[i] > 0 && (
                    <span className="text-amber-700" title="Non-Billable">
                      {taskViewMode === "hours"
                        ? `NB: ${Math.round(emp.monthlyNonBillable[i] || 0)}`
                        : `NB: ${Math.round(emp.monthlyNonBillablePct[i] || 0)}%`}
                    </span>
                  )}
                  {emp.monthlyIdlePct[i] > 0 && (
                    <span className="text-slate-500" title="Idle">
                      {taskViewMode === "hours"
                        ? `I: ${Math.round(emp.monthlyIdle[i] || 0)}`
                        : `I: ${Math.round(emp.monthlyIdlePct[i] || 0)}%`}
                    </span>
                  )}
                </div>
              )}
            </div>
          </td>
        ))}
      </tr>
      {isExpanded && (
        <>
          {viewMode === "graphical" ? (
            <tr className="bg-slate-50 border-b border-slate-100">
              <td colSpan={3} className="p-0"></td>
              <td colSpan={1 + months.length} className="p-0">
                <EmployeeGraphicalDetails emp={emp} months={months} />
              </td>
            </tr>
          ) : (
            <>
              <tr className="bg-slate-50 border-b border-slate-100">
                <td colSpan={4 + months.length} className="px-6 py-2">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Projects:
                  </p>
                </td>
              </tr>
              {Object.entries((emp.projects || {}) as Record<string, any[]>).map(
                ([vertical, projects]) => (
                  <React.Fragment key={vertical}>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <td className="px-6 py-2"></td>
                      <td
                        colSpan={2}
                        className="px-6 py-2 font-black text-slate-500 uppercase text-[9px]"
                      >
                        {vertical}
                      </td>
                      <td className="px-6 py-2 font-black text-slate-600 text-[9px]">
                        <div className="flex flex-col">
                          <span>
                            {taskViewMode === "hours"
                              ? `${Math.round(emp.verticalSummaries?.[vertical]?.totalHours || 0)} hrs`
                              : `${Math.round(emp.verticalSummaries?.[vertical]?.overall || 0)}%`}
                          </span>
                        </div>
                      </td>
                      {emp.verticalSummaries?.[vertical]?.monthly?.map(
                        (util: number, i: number) => (
                          <td
                            key={i}
                            className="px-6 py-2 font-black text-slate-600 text-[9px]"
                          >
                            <div className="flex flex-col">
                              <span>
                                {taskViewMode === "hours"
                                  ? `${Math.round(emp.verticalSummaries?.[vertical]?.monthlyHours?.[i] || 0)}`
                                  : `${Math.round(util || 0)}%`}
                              </span>
                            </div>
                          </td>
                        ),
                      )}
                    </tr>
                    {projects.map((p, i) => {
                      const isProjectExpanded =
                        expandedProjects[`${emp.id}-${p.code}`] ?? false;
                      return (
                        <ProjectRow
                          key={i}
                          project={p}
                          empId={emp.id}
                          isProjectExpanded={isProjectExpanded}
                          toggleProject={() => toggleProject(p.code)}
                          taskViewMode={taskViewMode}
                          monthIndices={monthIndices}
                          expandedTaskLists={expandedTaskLists}
                          toggleTaskList={(taskList) =>
                            toggleTaskList(p.code, taskList)
                          }
                        />
                      );
                    })}
                  </React.Fragment>
                ),
              )}
            </>
          )}
        </>
      )}
    </React.Fragment>
  );
};
