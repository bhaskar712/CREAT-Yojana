import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TaskInfo } from "../../types";
import { TaskRow } from "./TaskRow";

interface TaskListRowProps {
  taskList: string;
  tasks: TaskInfo[];
  isTaskListExpanded: boolean;
  toggleTaskList: () => void;
  taskViewMode: "hours" | "percentage";
  monthIndices: number[];
}

export const TaskListRow: React.FC<TaskListRowProps> = ({
  taskList,
  tasks,
  isTaskListExpanded,
  toggleTaskList,
  taskViewMode,
  monthIndices,
}) => {
  const numMonths = monthIndices.length;
  const listMonthlyAllocations = new Array(numMonths).fill(0);
  const listMonthlyHours = new Array(numMonths).fill(0);

  tasks.forEach((t) => {
    if (t.monthlyAllocations) {
      monthIndices.forEach((globalIdx, i) => {
        const val = (typeof t.monthlyAllocations[globalIdx] === 'number' && !isNaN(t.monthlyAllocations[globalIdx])) ? t.monthlyAllocations[globalIdx] : 0;
        listMonthlyAllocations[i] += val;
      });
    }
    if (t.monthlyHours) {
      monthIndices.forEach((globalIdx, i) => {
        const val = (typeof t.monthlyHours[globalIdx] === 'number' && !isNaN(t.monthlyHours[globalIdx])) ? t.monthlyHours[globalIdx] : 0;
        listMonthlyHours[i] += val;
      });
    }
  });

  const listPct = numMonths > 0 ? (listMonthlyAllocations.reduce((a, b) => a + b, 0) / numMonths) : 0;
  const listHours = listMonthlyHours.reduce((a, b) => a + b, 0);

  return (
    <React.Fragment>
      <tr
        className="bg-slate-50/30 hover:bg-slate-100/50 transition-colors border-b border-slate-50 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          toggleTaskList();
        }}
      >
        <td className="px-6 py-2"></td>
        <td
          colSpan={2}
          className="px-6 py-1.5 text-[9px] font-black text-slate-900 uppercase tracking-widest pl-16"
        >
          <div className="flex items-center gap-2">
            <div className="text-slate-400">
              {isTaskListExpanded ? (
                <ChevronDown className="w-2.5 h-2.5" />
              ) : (
                <ChevronRight className="w-2.5 h-2.5" />
              )}
            </div>
            <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
            <span>{taskList}</span>
          </div>
        </td>
        <td className="px-6 py-1.5 text-[9px] font-bold text-slate-500">
          {taskViewMode === "hours"
            ? `${Math.round(listHours)} hrs`
            : `${Math.round(listPct * 100)}%`}
        </td>
        {taskViewMode === "hours"
          ? listMonthlyHours.map((hrs, j) => (
              <td
                key={j}
                className="px-6 py-1.5 text-[9px] font-bold text-slate-500"
              >
                {hrs > 0 ? `${Math.round(hrs)}` : "-"}
              </td>
            ))
          : listMonthlyAllocations.map((alloc, j) => (
              <td
                key={j}
                className="px-6 py-1.5 text-[9px] font-bold text-slate-500"
              >
                {alloc > 0 ? `${Math.round(alloc * 100)}%` : "-"}
              </td>
            ))}
      </tr>
      {isTaskListExpanded &&
        tasks.map((task, idx) => {
          const taskFyHours = monthIndices.map(globalIdx => (typeof task.monthlyHours?.[globalIdx] === 'number' && !isNaN(task.monthlyHours?.[globalIdx])) ? task.monthlyHours?.[globalIdx] : 0);
          const taskFyAllocations = monthIndices.map(globalIdx => (typeof task.monthlyAllocations?.[globalIdx] === 'number' && !isNaN(task.monthlyAllocations?.[globalIdx])) ? task.monthlyAllocations?.[globalIdx] : 0);
          const taskHours = taskFyHours.reduce((a, b) => a + b, 0);
          const taskPct = numMonths > 0 ? (taskFyAllocations.reduce((a, b) => a + b, 0) / numMonths) : 0;
          return (
            <TaskRow
              key={idx}
              task={task}
              taskViewMode={taskViewMode}
              taskHours={taskHours}
              taskPct={taskPct}
              taskFyHours={taskFyHours}
              taskFyAllocations={taskFyAllocations}
              numMonths={numMonths}
            />
          );
        })}
    </React.Fragment>
  );
};
