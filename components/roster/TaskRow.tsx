import React from "react";
import { TaskInfo } from "../../types";

interface TaskRowProps {
  task: TaskInfo;
  taskViewMode: "hours" | "percentage";
  taskHours: number;
  taskPct: number;
  taskFyHours: number[];
  taskFyAllocations: number[];
  numMonths: number;
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  taskViewMode,
  taskHours,
  taskPct,
  taskFyHours,
  taskFyAllocations,
  numMonths,
}) => {
  return (
    <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-50">
      <td className="px-6 py-1"></td>
      <td
        colSpan={2}
        className="px-6 py-1 text-[9px] font-bold text-slate-600 uppercase pl-24"
      >
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
          <span>{task.name}</span>
        </div>
      </td>
      <td className="px-6 py-1 text-[9px] font-bold text-slate-400">
        {taskViewMode === "hours"
          ? `${Math.round(taskHours)} hrs`
          : `${Math.round(taskPct * 100)}%`}
      </td>
      {new Array(numMonths).fill(0).map((_, j) => {
        const hrs = taskFyHours[j] || 0;
        const alloc = taskFyAllocations[j] || 0;
        return (
          <td key={j} className="px-6 py-1 text-[9px] font-bold text-slate-400">
            {taskViewMode === "hours"
              ? hrs > 0
                ? `${Math.round(hrs)}`
                : "-"
              : alloc > 0
                ? `${Math.round(alloc * 100)}%`
                : "-"}
          </td>
        );
      })}
    </tr>
  );
};
