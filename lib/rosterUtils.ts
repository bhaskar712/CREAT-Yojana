import { Employee, ProjectData, TaskInfo } from "../types";
import { HOURS_PER_MONTH } from "../constants";

export const calculateRosterData = (
  employees: Employee[],
  projects: ProjectData[],
  monthIndices: number[],
  mode?: string | string[],
) => {
  const yearLimit = monthIndices.length;
  
  const data = employees.map((emp) => {
    const email = emp.email?.toLowerCase() || "";

    const projectsForEmp = projects.filter(
      (p) => p.employeeInfo && p.employeeInfo[email],
    );

    const projectDetails = projectsForEmp.map((p) => {
      const monthlyAllocations = new Array(yearLimit).fill(0);
      const monthlyBillable = new Array(yearLimit).fill(0);
      const monthlyNonBillable = new Array(yearLimit).fill(0);
      const monthlyIdle = new Array(yearLimit).fill(0);

      const activeModes = Array.isArray(mode) ? mode : [mode || 'Budget'];

      activeModes.forEach((mVal) => {
        const empSkillsKey = mVal === 'Actuals' ? 'actualsEmployeeSkills' : (mVal === 'Forecast' ? 'forecastEmployeeSkills' : (mVal === 'Budget' ? 'employeeSkills' : 'pmoEmployeeSkills'));
        const targetEmployeeSkills = (p as any)[empSkillsKey] || {};

        if (targetEmployeeSkills) {
          Object.values(targetEmployeeSkills).forEach((skillMap) => {
            if (skillMap[email]) {
              const fullArray = skillMap[email];
              monthIndices.forEach((globalIdx, i) => {
                const alloc = (typeof fullArray[globalIdx] === 'number' && !isNaN(fullArray[globalIdx])) ? fullArray[globalIdx] : 0;
                monthlyAllocations[i] += alloc;
              });
            }
          });
        }
      });

      const billableSource = p.employeeBillableHours?.[email];
      const nonBillableSource = p.employeeNonBillableHours?.[email];
      const idleSource = p.employeeIdleHours?.[email];

      monthIndices.forEach((globalIdx, i) => {
        if (billableSource) {
           const h = (typeof billableSource[globalIdx] === 'number' && !isNaN(billableSource[globalIdx])) ? billableSource[globalIdx] : 0;
           monthlyBillable[i] += h;
        }
        if (nonBillableSource) {
           const h = (typeof nonBillableSource[globalIdx] === 'number' && !isNaN(nonBillableSource[globalIdx])) ? nonBillableSource[globalIdx] : 0;
           monthlyNonBillable[i] += h;
        }
        if (idleSource) {
           const h = (typeof idleSource[globalIdx] === 'number' && !isNaN(idleSource[globalIdx])) ? idleSource[globalIdx] : 0;
           monthlyIdle[i] += h;
        }
      });

      const totalAllocation = monthlyAllocations.reduce((a, b) => a + b, 0);
      const overallPercentage = yearLimit > 0 ? (totalAllocation / yearLimit) * 100 : 0;
      const totalHours = totalAllocation * HOURS_PER_MONTH;

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        vertical: p.vertical,
        monthlyAllocations,
        monthlyBillable,
        monthlyNonBillable,
        monthlyIdle,
        overallPercentage,
        totalAllocation,
        totalHours,
        monthlyHours: monthlyAllocations.map((a) => a * HOURS_PER_MONTH),
        tasks: p.employeeTasks?.[email] || {},
      };
    });

    const groupedProjects = projectDetails.reduce(
      (acc, p) => {
        const vertical = p.vertical || "Uncategorized";
        if (!acc[vertical]) acc[vertical] = [];
        acc[vertical].push(p);
        return acc;
      },
      {} as Record<string, typeof projectDetails>,
    );

    const monthlyUtilization = new Array(yearLimit).fill(0);
    const monthlyHoursArr = new Array(yearLimit).fill(0);
    const monthlyBillable = new Array(yearLimit).fill(0);
    const monthlyNonBillable = new Array(yearLimit).fill(0);
    const monthlyIdle = new Array(yearLimit).fill(0);
    let totalAllocationSum = 0;
    let totalBillable = 0;
    let totalNonBillable = 0;
    let totalIdle = 0;

    projectDetails.forEach((p) => {
      p.monthlyAllocations.forEach((alloc, i) => {
        monthlyUtilization[i] += alloc * 100;
        monthlyHoursArr[i] += alloc * HOURS_PER_MONTH;
        totalAllocationSum += alloc;
      });
      p.monthlyBillable.forEach((h, i) => {
        monthlyBillable[i] += h;
        totalBillable += h;
      });
      p.monthlyNonBillable.forEach((h, i) => {
        monthlyNonBillable[i] += h;
        totalNonBillable += h;
      });
      p.monthlyIdle.forEach((h, i) => {
        monthlyIdle[i] += h;
        totalIdle += h;
      });
    });

    const totalHoursAgg = totalAllocationSum * HOURS_PER_MONTH;
    const overallUtilization = yearLimit > 0 ? (totalAllocationSum / yearLimit) * 100 : 0;

    // Correct idle calculation: base (180h) - billable - non-billable
    const overallIdleHours = Math.max(0, (yearLimit * HOURS_PER_MONTH) - totalBillable - totalNonBillable);
    const overallIdlePct = (yearLimit > 0) ? (overallIdleHours / (yearLimit * HOURS_PER_MONTH)) * 100 : 0;

    return {
      ...emp,
      projects: groupedProjects,
      allProjectDetails: projectDetails,
      monthlyUtilization,
      monthlyHours: monthlyHoursArr,
      monthlyBillable,
      monthlyNonBillable,
      monthlyIdle,
      totalAllocationSum,
      totalHours: totalHoursAgg,
      totalBillable,
      totalNonBillable,
      totalIdle,
      overallUtilization,
      overallIdleHours,
      overallIdlePct,
    };
  });

  const skillSummary = data.reduce(
    (acc, emp) => {
      const skill = emp.skill || "Unknown";
      if (!acc[skill]) {
        acc[skill] = {
          count: 0,
          totalUtilization: 0,
          totalIdlePct: 0,
          totalHours: 0,
          monthlyUtilization: new Array(yearLimit).fill(0),
          monthlyHours: new Array(yearLimit).fill(0),
        };
      }
      acc[skill].count++;
      acc[skill].totalUtilization += emp.overallUtilization;
      acc[skill].totalIdlePct += emp.overallIdlePct;
      acc[skill].totalHours += emp.totalHours;
      
      emp.monthlyUtilization.forEach((util, i) => {
        acc[skill].monthlyUtilization[i] += util / (data.filter(e => (e.skill || 'Unknown') === skill).length); 
      });
      emp.monthlyHours.forEach((h, i) => {
        acc[skill].monthlyHours[i] += h;
      });
      
      return acc;
    },
    {} as Record<
      string,
      { 
        count: number; 
        totalUtilization: number; 
        totalIdlePct: number; 
        totalHours: number; 
        monthlyUtilization: number[]; 
        monthlyHours: number[];
        overallUtilization?: number; // Added this
      }
    >,
  );

  // Normalize skill averages
  Object.keys(skillSummary).forEach(skill => {
    const count = skillSummary[skill].count;
    if (count > 0) {
      skillSummary[skill].overallUtilization = skillSummary[skill].totalUtilization / count;
    } else {
      skillSummary[skill].overallUtilization = 0;
    }
  });

  return {
    processedEmployees: data,
    skillSummary,
  };
};
