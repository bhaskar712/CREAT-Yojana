import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TaskListRow } from "./TaskListRow";

interface ProjectRowProps {
  project: any;
  empId: string;
  isProjectExpanded: boolean;
  toggleProject: () => void;
  taskViewMode: "hours" | "percentage";
  monthIndices: number[];
  expandedTaskLists: Record<string, boolean>;
  toggleTaskList: (taskList: string) => void;
}

export const ProjectRow: React.FC<ProjectRowProps> = ({
  project: p,
  empId,
  isProjectExpanded,
  toggleProject,
  taskViewMode,
  monthIndices,
  expandedTaskLists,
  toggleTaskList,
}) => {
  return (
    <React.Fragment>
      <tr
        className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-50 cursor-pointer"
        onClick={toggleProject}
      >
        <td className="px-6 py-2"></td>
        <td
          colSpan={2}
          className="px-6 py-2 text-[10px] font-bold text-slate-900 pl-10"
        >
          <div className="flex items-center gap-2">
            <div className="text-slate-400">
              {isProjectExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </div>
            <span className="text-slate-400 font-medium mr-1">
              [{p.code || p.id}]
            </span>{" "}
            {p.name}
          </div>
        </td>
        <td className="px-6 py-2 text-[10px] font-bold text-slate-600">
          <div className="flex flex-col">
            <span>
              {taskViewMode === "hours"
                ? `${Math.round(p.totalHours || 0)} hrs`
                : `${Math.round(p.overallPercentage || 0)}%`}
            </span>
          </div>
        </td>
        {taskViewMode === "hours"
          ? p.monthlyHours?.map((hrs: number, j: number) => (
              <td key={j} className="px-6 py-2 text-[10px] font-bold text-slate-600">
                <div className="flex flex-col">
                  <span>{hrs > 0 ? Math.round(hrs) : "-"}</span>
                </div>
              </td>
            ))
          : p.monthlyAllocations.map((alloc: number, j: number) => (
              <td
                key={j}
                className={`px-6 py-2 text-[10px] font-bold ${
                  alloc > 1
                    ? "bg-red-50 text-red-900"
                    : alloc > 0.8
                      ? "bg-amber-50 text-amber-900"
                      : alloc > 0
                        ? "bg-emerald-50 text-emerald-900"
                        : "text-slate-600"
                }`}
              >
                <div className="flex flex-col">
                  <span>{alloc > 0 ? `${Math.round(alloc * 100)}%` : "-"}</span>
                </div>
              </td>
            ))}
      </tr>
      {isProjectExpanded &&
        Object.entries(p.tasks || {}).map(([taskList, tasks]) => {
          const isTaskListExpanded =
            expandedTaskLists[`${empId}-${p.code}-${taskList}`] ?? false;
          return (
            <TaskListRow
              key={taskList}
              taskList={taskList}
              tasks={tasks as any}
              isTaskListExpanded={isTaskListExpanded}
              toggleTaskList={() => toggleTaskList(taskList)}
              taskViewMode={taskViewMode}
              monthIndices={monthIndices}
            />
          );
        })}
    </React.Fragment>
  );
};
